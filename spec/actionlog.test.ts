import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createClient } from "./support/client.ts";

// crit-10 requirement: server-side action logs (src/actionlog.mjs). Spawns
// its own app process with a piped stdout, like spec/restart.test.ts, so
// this can capture exactly what the server wrote to the log for one
// request -- the shared APP_URL instance every other spec file runs
// against was not spawned by this test, so its stdout isn't available here.
let child: ChildProcess | undefined;
let dir: string | undefined;
let stdout: string[] = [];

afterEach(async () => {
  if (child && !child.killed) {
    child.kill("SIGKILL");
  }
  child = undefined;
  stdout = [];
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
  child.stdout!.setEncoding("utf8");
  child.stdout!.on("data", (chunk: string) => {
    stdout.push(...chunk.split("\n").filter((l) => l.length > 0));
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

// console.log on a piped child stdout can arrive at this process a moment
// after the HTTP response does (both are written synchronously inside the
// route handler, but the pipe read is a separate async event); poll briefly
// rather than racing a fixed sleep against it.
async function waitForLineCount(count: number, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (stdout.length < count) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${count} stdout line(s), got ${stdout.length}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

// Reads the real bank directly (this file spawns its own process rather
// than using the shared baseUrl spec/support/game.ts binds to) to build a
// correct v2 submission for round 1's case (always C1, brief §5's fixed
// bank order).
async function correctAnswerForC1() {
  const bankPath = new URL("../content/case-bank.v2.json", import.meta.url).pathname;
  const bank = JSON.parse(await readFile(bankPath, "utf8"));
  const c1 = bank.cases.find((c: any) => c.caseId === "C1");
  const pair = c1.answerKey.acceptedPairs[0];
  return { fields: { ...c1.answerKey.fields }, action: pair.action, evidenceId: pair.evidenceId };
}

describe("server-side action logs (crit-10)", () => {
  it("a sign request logs exactly one line with seat and action, and no answer values", async () => {
    dir = await mkdtemp(join(tmpdir(), "spe-actionlog-"));
    const dbPath = join(dir, "test.db");
    const port = 20080 + Math.floor(Math.random() * 1000);
    const baseUrl = `http://localhost:${port}`;

    await startApp(port, dbPath);

    const a = createClient(baseUrl);
    const createRes = await a.post("/api/tables", {});
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const tableId = created.table.id;

    const b = createClient(baseUrl);
    const joinRes = await b.post(`/api/tables/${tableId}/join`, {});
    expect(joinRes.status).toBe(200);

    await waitForLineCount(3); // "listening on..." + create + join
    const linesBeforeSign = stdout.length;

    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const roundId = snapshot.rounds[0].id;
    const answer = await correctAnswerForC1();

    // Only A submits: this produces exactly a "sign" line, not "reveal"
    // (that requires both members' submissions, brief §4 item 6).
    const submitRes = await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, answer);
    expect(submitRes.status).toBe(200);

    await waitForLineCount(linesBeforeSign + 1);
    const newLines = stdout.slice(linesBeforeSign);

    expect(newLines.length, `expected exactly one new log line, got: ${JSON.stringify(newLines)}`).toBe(1);
    const [line] = newLines;

    // ISO time | table code | seat | action | round (src/actionlog.mjs).
    expect(line).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \| [\w-]{4} \| A \| sign \| 1$/);

    // No answer content, cookie or session token anywhere in the new output.
    const joined = newLines.join("\n");
    for (const forbidden of [
      "match",
      "mismatch",
      "patient",
      "medicine",
      "dose",
      "route",
      "continue_checks",
      "reprepare",
      "pause_clarify",
      "evidence",
      "spe_session",
      a.cookie ?? "",
    ]) {
      if (forbidden === "") continue;
      expect(joined.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
