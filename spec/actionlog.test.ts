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
// correct v2 submission for any case id.
async function loadBankForTest() {
  const bankPath = new URL("../content/case-bank.v2.json", import.meta.url).pathname;
  return JSON.parse(await readFile(bankPath, "utf8"));
}

function correctAnswerForCase(bank: any, caseId: string) {
  const c = bank.cases.find((c2: any) => c2.caseId === caseId);
  const pair = c.answerKey.acceptedPairs[0];
  return { fields: { ...c.answerKey.fields }, action: pair.action, evidenceId: pair.evidenceId };
}

async function correctAnswerForC1() {
  return correctAnswerForCase(await loadBankForTest(), "C1");
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

  it("T18: a rejected submission writes no action line, and each v2 stage change writes exactly one", async () => {
    dir = await mkdtemp(join(tmpdir(), "spe-actionlog-"));
    const dbPath = join(dir, "test.db");
    const port = 23080 + Math.floor(Math.random() * 1000);
    const baseUrl = `http://localhost:${port}`;
    const bank = await loadBankForTest();

    await startApp(port, dbPath);

    const a = createClient(baseUrl);
    const b = createClient(baseUrl);
    const createRes = await a.post("/api/tables", {});
    const tableId = (await createRes.json()).table.id;
    await b.post(`/api/tables/${tableId}/join`, {});

    // A rejected submission (missing fields) writes no action line at all.
    const linesBeforeReject = stdout.length;
    const snapshotForReject = await (await a.get(`/api/tables/${tableId}`)).json();
    const roundForReject = snapshotForReject.rounds[0];
    const rejectRes = await a.post(`/api/tables/${tableId}/rounds/${roundForReject.id}/submissions`, {
      action: "continue_checks",
      evidenceId: "all_fields_match",
    });
    expect(rejectRes.status).toBe(400);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(stdout.length, "a rejected submission should write no action line").toBe(linesBeforeReject);

    // Drive the whole table to completed, submitting each round's own
    // correct answer for both members, crossing both stage gates
    // (training_summary via fromStage, then round-by-round to round 9).
    for (;;) {
      const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
      const stage = snapshot.table.stage;
      if (stage === "training_summary") {
        await a.post(`/api/tables/${tableId}/next`, { fromStage: "training_summary" });
        continue;
      }
      if (stage === "completed") break;
      const round = snapshot.rounds[snapshot.rounds.length - 1];
      const answer = correctAnswerForCase(bank, round.case.caseId);
      if (!round.mine.submitted) await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer);
      if (!round.revealed) await b.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer);
      await a.post(`/api/tables/${tableId}/next`, { fromRoundId: round.id });
    }

    // console.log on a piped child stdout can lag the HTTP response that
    // triggered it by a tick; give the last writes a moment to arrive.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const actionLines = stdout.filter((l) => / \| [\w-]{4} \| [AB] \| \w+ \| \d+$/.test(l));
    const actions = actionLines.map((l) => l.split(" | ")[3]);

    // Exactly one "summary" (round 6 -> training_summary) and one
    // "transfer" (training_summary -> round 7) line -- never more, since
    // each stage gate is crossed exactly once regardless of how the test
    // loop above polls GET in between.
    expect(actions.filter((a2) => a2 === "summary").length).toBe(1);
    expect(actions.filter((a2) => a2 === "transfer").length).toBe(1);
    expect(actions.filter((a2) => a2 === "complete").length).toBe(1);

    // No line contains a cookie or session value.
    const joined = actionLines.join("\n");
    expect(joined).not.toContain(a.cookie ?? "\u0000");
    expect(joined).not.toContain(b.cookie ?? "\u0000");
    expect(joined.toLowerCase()).not.toContain("spe_session");
  });
});
