import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readSseEvents } from "./support/client.ts";
import { createClient } from "./support/client.ts";

// Brief §9 items 9-10: restart and reconnect. This spawns its own instance
// of the actual app process (not the shared APP_URL instance spec/global-setup.ts
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

describe("restart and reconnect (brief §9 items 9-10)", () => {
  it("an incomplete table resumes and completed records remain after a process restart", async () => {
    dir = await mkdtemp(join(tmpdir(), "spe-restart-"));
    const dbPath = join(dir, "test.db");
    const port = 18080 + Math.floor(Math.random() * 1000);
    const baseUrl = `http://localhost:${port}`;

    await startApp(port, dbPath);

    const a = createClient(baseUrl);
    const createRes = await a.post("/api/tables", {});
    const created = await createRes.json();
    const tableId = created.table.id;

    const b = createClient(baseUrl);
    await b.post(`/api/tables/${tableId}/join`, {});

    const CORRECT = { patient: "match", medicine: "match", dose: "match", route: "match", time: "match", overall: "match" };
    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const round1 = snapshot.rounds[0];
    await a.post(`/api/tables/${tableId}/rounds/${round1.id}/submissions`, { answer: CORRECT });
    await b.post(`/api/tables/${tableId}/rounds/${round1.id}/submissions`, { answer: CORRECT });

    const beforeRestart = await (await a.get(`/api/tables/${tableId}`)).json();
    expect(beforeRestart.rounds[0].revealed).toBe(true);

    await stopApp();
    await startApp(port, dbPath);

    const afterRestart = await (await a.get(`/api/tables/${tableId}`)).json();
    expect(afterRestart.rounds[0].revealed).toBe(true);
    expect(afterRestart.rounds[0].reveal.aFullyCorrect).toBe(true);
    // table is incomplete (one of six cases done) and resumable
    expect(afterRestart.rounds.length).toBe(1);
    expect(afterRestart.table.status).not.toBe("completed");

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
    const created = await createRes.json();
    const tableId = created.table.id;
    const b = createClient(baseUrl);
    await b.post(`/api/tables/${tableId}/join`, {});

    await stopApp();
    await startApp(port, dbPath);

    const sseRes = await a.get(`/api/tables/${tableId}/events`);
    const [event] = await readSseEvents(sseRes, 1);
    expect((event as any).table.id).toBe(tableId);
    expect((event as any).seats.B.joined).toBe(true);
    expect(JSON.stringify(event)).not.toMatch(/mismatchFields|teachingPoint/);

    await stopApp();
  });
});
