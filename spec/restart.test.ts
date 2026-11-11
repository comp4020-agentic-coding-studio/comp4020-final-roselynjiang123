import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readSseEvents } from "./support/client.ts";
import { createClient } from "./support/client.ts";

// T13 Persistence, T14 SSE (the restart half). Spawns its own instance of
// the actual app process (not the shared APP_URL instance spec/global-setup.ts
// found) against a private temp SQLite file, so it can kill -SIGTERM and
// restart it -- something the shared instance under test by every other
// spec file must stay up for.
let child: ChildProcess | undefined;
let dir: string | undefined;

afterEach(async () => {
  if (child && !child.killed) {
    child.kill("SIGKILL");
  }
  child = undefined;
  if (dir) {
    await rm(dir, { recursive: true, force: true });
    dir = undefined;
  }
});

async function startApp(port: number, databasePath: string): Promise<void> {
  child = spawn(process.execPath, ["src/main.mjs"], {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, PORT: String(port), DATABASE_PATH: databasePath, NODE_ENV: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (let attempt = 0; ; attempt++) {
    try {
      await fetch(`http://localhost:${port}/healthz`);
      return;
    } catch {
      // not up yet
    }
    if (attempt >= 100) throw new Error(`app did not start on port ${port}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function stopApp(): Promise<void> {
  if (!child) return;
  const exited = new Promise<void>((resolve) => child!.once("exit", () => resolve()));
  child.kill("SIGTERM");
  await exited;
}

// This file spawns its own process rather than using the shared baseUrl
// spec/support/game.ts binds to, so it reads the real bank directly to
// build a correct submission for round 1's case (always C1, brief §5's
// fixed bank order), the same read-only access spec/support/game.ts uses.
async function correctAnswerForC1() {
  const bankPath = new URL("../content/case-bank.v2.json", import.meta.url).pathname;
  const bank = JSON.parse(await readFile(bankPath, "utf8"));
  const c1 = bank.cases.find((c: any) => c.caseId === "C1");
  const pair = c1.answerKey.acceptedPairs[0];
  return { fields: { ...c1.answerKey.fields }, action: pair.action, evidenceId: pair.evidenceId };
}

describe("restart and reconnect (T13, T14)", () => {
  it("an incomplete table resumes and completed records remain after a process restart", async () => {
    dir = await mkdtemp(join(tmpdir(), "spe-restart-"));
    const dbPath = join(dir, "test.db");
    const port = 18080 + Math.floor(Math.random() * 1000);
    const baseUrl = `http://localhost:${port}`;

    await startApp(port, dbPath);

    // Each setup call is asserted as it's made: an unasserted setup call that
    // silently fails (e.g. every route 404ing, as it did against the Round 1
    // skeleton -- docs/evidence-log.md) lets execution reach the real
    // assertions below anyway, which can then pass vacuously on state that
    // was never actually set up.
    const a = createClient(baseUrl);
    const createRes = await a.post("/api/tables", {});
    expect(createRes.status, "table creation should succeed").toBe(201);
    const created = await createRes.json();
    const tableId = created.table.id;

    const b = createClient(baseUrl);
    const joinRes = await b.post(`/api/tables/${tableId}/join`, {});
    expect(joinRes.status, "join should succeed").toBe(200);

    const answer = await correctAnswerForC1();
    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const round1 = snapshot.rounds[0];
    const submitA = await a.post(`/api/tables/${tableId}/rounds/${round1.id}/submissions`, answer);
    expect(submitA.status, "A's submission should succeed").toBe(200);
    const submitB = await b.post(`/api/tables/${tableId}/rounds/${round1.id}/submissions`, answer);
    expect(submitB.status, "B's submission should succeed").toBe(200);

    const beforeRestart = await (await a.get(`/api/tables/${tableId}`)).json();
    expect(beforeRestart.rounds[0].revealed).toBe(true);

    await stopApp();
    await startApp(port, dbPath);

    const afterRestart = await (await a.get(`/api/tables/${tableId}`)).json();
    expect(afterRestart.rounds[0].revealed).toBe(true);
    expect(afterRestart.rounds[0].result.A.fullyCorrect).toBe(true);
    // table is incomplete (one of nine rounds done) and resumable, still at
    // the training stage
    expect(afterRestart.rounds.length).toBe(1);
    expect(afterRestart.table.stage).toBe("training");
    expect(afterRestart.table.stage).not.toBe("completed");

    await stopApp();
  });

  it("SSE reconnect after a restart returns the latest authorised state", async () => {
    dir = await mkdtemp(join(tmpdir(), "spe-restart-"));
    const dbPath = join(dir, "test.db");
    const port = 19080 + Math.floor(Math.random() * 1000);
    const baseUrl = `http://localhost:${port}`;

    await startApp(port, dbPath);

    const a = createClient(baseUrl);
    const createRes = await a.post("/api/tables", {});
    expect(createRes.status, "table creation should succeed").toBe(201);
    const created = await createRes.json();
    const tableId = created.table.id;
    const b = createClient(baseUrl);
    const joinRes = await b.post(`/api/tables/${tableId}/join`, {});
    expect(joinRes.status, "join should succeed").toBe(200);

    await stopApp();
    await startApp(port, dbPath);

    const sseRes = await a.get(`/api/tables/${tableId}/events`);
    const [event] = await readSseEvents(sseRes, 1);
    expect((event as any).table.id).toBe(tableId);
    expect((event as any).seats.B.joined).toBe(true);
    expect(JSON.stringify(event)).not.toMatch(/"answerKey"|"acceptedPairs"|"debrief"|"result"/);

    await stopApp();
  });
});
