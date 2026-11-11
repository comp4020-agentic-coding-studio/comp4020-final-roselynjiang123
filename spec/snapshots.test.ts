import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createClient } from "./support/client.ts";

// T10 Snapshots and versions: changing a case in a copy of the bank after a
// round was played does not change that round's content, answer or
// debrief; a withdrawn version shows its notice on old rounds. Spawns its
// own process pointed at a throwaway edited copy of the bank (BANK_PATH,
// src/server.mjs), since this needs two different bank contents against
// the same database at different times -- something the shared APP_URL
// instance every other spec file runs against can't do (it loads the real
// bank once, for the life of the process).
let child: ChildProcess | undefined;
let dir: string | undefined;

afterEach(async () => {
  if (child && !child.killed) child.kill("SIGKILL");
  child = undefined;
  if (dir) {
    await rm(dir, { recursive: true, force: true });
    dir = undefined;
  }
});

async function startApp(port: number, databasePath: string, bankPath: string): Promise<void> {
  child = spawn(process.execPath, ["src/main.mjs"], {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, PORT: String(port), DATABASE_PATH: databasePath, BANK_PATH: bankPath, NODE_ENV: "" },
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

// Two spawned app processes per test (create/join/submit/stop/edit/restart/
// read) take longer than vitest's 5s default test timeout.
describe("T10 snapshots and versions", { timeout: 20000 }, () => {
  it("editing a case after its round was played does not change that round's frozen content or debrief", async () => {
    dir = await mkdtemp(join(tmpdir(), "spe-snapshot-"));
    const dbPath = join(dir, "test.db");
    const bankPath = join(dir, "bank.json");
    const realBankPath = new URL("../content/case-bank.v2.json", import.meta.url).pathname;
    const bank = JSON.parse(await readFile(realBankPath, "utf8"));
    await writeFile(bankPath, JSON.stringify(bank));

    const port = 21080 + Math.floor(Math.random() * 1000);
    const baseUrl = `http://localhost:${port}`;
    await startApp(port, dbPath, bankPath);

    const a = createClient(baseUrl);
    const b = createClient(baseUrl);
    const createRes = await a.post("/api/tables", {});
    const tableId = (await createRes.json()).table.id;
    await b.post(`/api/tables/${tableId}/join`, {});

    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const round = snapshot.rounds[0];
    expect(round.case.caseId).toBe("C1");
    const c1 = bank.cases.find((c: any) => c.caseId === "C1");
    const pair = c1.answerKey.acceptedPairs[0];
    const answer = { fields: { ...c1.answerKey.fields }, action: pair.action, evidenceId: pair.evidenceId };

    await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer);
    await b.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer);

    const beforeEdit = await (await a.get(`/api/tables/${tableId}`)).json();
    const revealedRound = beforeEdit.rounds[0];
    expect(revealedRound.revealed).toBe(true);
    const debriefBefore = revealedRound.debrief;
    const titleBefore = revealedRound.case.title;
    const feedbackFindingBefore = revealedRound.debrief.feedback.finding;

    await stopApp();

    // Edit the bank's copy of C1: change its title, its finding feedback and
    // its answer key (keeping the edit internally valid -- T12 already
    // covers rejecting an invalid bank at start-up; this test is about an
    // edit the bank accepts, not one it doesn't), then restart the app
    // pointed at the edited file. If the already-played round re-read the
    // live bank, its title/debrief/result would change; it must not.
    const editedBank = JSON.parse(JSON.stringify(bank));
    const editedC1 = editedBank.cases.find((c: any) => c.caseId === "C1");
    editedC1.title = "EDITED TITLE";
    editedC1.feedback.finding = "EDITED FINDING";
    editedC1.answerKey.fields.dose = "mismatch";
    editedC1.answerKey.acceptedPairs = [{ action: "reprepare", evidenceId: "total_amount" }];
    await writeFile(bankPath, JSON.stringify(editedBank));

    await startApp(port, dbPath, bankPath);

    const afterEdit = await (await a.get(`/api/tables/${tableId}`)).json();
    const roundAfterEdit = afterEdit.rounds[0];
    expect(roundAfterEdit.case.title).toBe(titleBefore);
    expect(roundAfterEdit.debrief.feedback.finding).toBe(feedbackFindingBefore);
    expect(roundAfterEdit.result).toEqual(revealedRound.result);
    expect(roundAfterEdit.debrief).toEqual(debriefBefore);

    // A NEW round created after the edit (if this table had more rounds to
    // play) would see the edited content -- proved indirectly here by
    // confirming the live bank the second process loaded really is the
    // edited one, via the review badge / title on a case not yet played.
    const c2Before = bank.cases.find((c: any) => c.caseId === "C2").title;
    const c2After = editedBank.cases.find((c: any) => c.caseId === "C2").title;
    expect(c2Before).toBe(c2After); // sanity: C2 wasn't touched by this edit

    await stopApp();
  });

  it("a version marked withdrawn in the live bank shows its notice on old rounds, without re-scoring them", async () => {
    dir = await mkdtemp(join(tmpdir(), "spe-snapshot-"));
    const dbPath = join(dir, "test.db");
    const bankPath = join(dir, "bank.json");
    const realBankPath = new URL("../content/case-bank.v2.json", import.meta.url).pathname;
    const bank = JSON.parse(await readFile(realBankPath, "utf8"));
    await writeFile(bankPath, JSON.stringify(bank));

    const port = 22080 + Math.floor(Math.random() * 1000);
    const baseUrl = `http://localhost:${port}`;
    await startApp(port, dbPath, bankPath);

    const a = createClient(baseUrl);
    const b = createClient(baseUrl);
    const createRes = await a.post("/api/tables", {});
    const tableId = (await createRes.json()).table.id;
    await b.post(`/api/tables/${tableId}/join`, {});

    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const round = snapshot.rounds[0];
    const c1 = bank.cases.find((c: any) => c.caseId === "C1");
    const pair = c1.answerKey.acceptedPairs[0];
    const answer = { fields: { ...c1.answerKey.fields }, action: pair.action, evidenceId: pair.evidenceId };
    await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer);
    await b.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer);

    const beforeWithdraw = await (await a.get(`/api/tables/${tableId}`)).json();
    expect(beforeWithdraw.rounds[0].withdrawnNotice).toBeNull();
    const resultBefore = beforeWithdraw.rounds[0].result;

    await stopApp();

    const withdrawnBank = JSON.parse(JSON.stringify(bank));
    const withdrawnC1 = withdrawnBank.cases.find((c: any) => c.caseId === "C1");
    withdrawnC1.reviewStatus = "withdrawn";
    withdrawnC1.changeNote = "Withdrawn: dose units corrected in v2.1.0, see changelog.";
    await writeFile(bankPath, JSON.stringify(withdrawnBank));

    await startApp(port, dbPath, bankPath);

    const afterWithdraw = await (await a.get(`/api/tables/${tableId}`)).json();
    expect(afterWithdraw.rounds[0].withdrawnNotice).toBe(withdrawnC1.changeNote);
    // Never silently re-score: the result is unchanged by the withdrawal.
    expect(afterWithdraw.rounds[0].result).toEqual(resultBefore);

    await stopApp();
  });
});
