import { inject } from "vitest";
import { readFileSync } from "node:fs";
import { createClient, type Client } from "./client.ts";

const baseUrl = inject("baseUrl");

// The real bank, read-only (CLAUDE.md): tests build deliberate v2
// submissions against its actual field keys / cases, never a fixture
// mirror that could drift from what the server actually loaded.
export const BANK = JSON.parse(readFileSync(new URL("../../content/case-bank.v2.json", import.meta.url).pathname, "utf8"));
export const FIELD_KEYS: string[] = BANK.fieldKeys;

export async function createTable(): Promise<{ owner: Client; tableId: string }> {
  const owner = createClient(baseUrl);
  const res = await owner.post("/api/tables", {});
  if (res.status !== 201) throw new Error(`create table failed: ${res.status}`);
  const body = await res.json();
  return { owner, tableId: body.table.id };
}

export async function createAndJoinTable(): Promise<{ a: Client; b: Client; tableId: string }> {
  const { owner: a, tableId } = await createTable();
  const b = createClient(baseUrl);
  const joinRes = await b.post(`/api/tables/${tableId}/join`, {});
  if (joinRes.status !== 200) throw new Error(`join failed: ${joinRes.status}`);
  return { a, b, tableId };
}

export function currentRound(snapshot: any) {
  return snapshot.rounds[snapshot.rounds.length - 1];
}

// A well-formed submission body for `caseId`, using one of that case's own
// accepted pairs -- always "fully correct" for that case specifically,
// unlike a single fixed constant, since every v2 case has its own
// answerKey.fields and acceptedPairs (brief §7.1; no single "all match,
// continue_checks" answer is correct for every case the way v1's six
// fixed cases allowed).
export function correctAnswerFor(caseId: string) {
  const caseDef = BANK.cases.find((c: any) => c.caseId === caseId);
  if (!caseDef) throw new Error(`no such case: ${caseId}`);
  const pair = caseDef.answerKey.acceptedPairs[0];
  return { fields: { ...caseDef.answerKey.fields }, action: pair.action, evidenceId: pair.evidenceId };
}

// Builds a well-formed, self-consistent submission with exactly
// `mismatchKeys` marked "mismatch" -- valid regardless of a case's real
// answerKey (shape/consistency only, brief §7.1), useful for deliberately
// right-or-wrong test answers against any case. `action`/`evidenceId`
// default to values that satisfy the continue_checks-on-mismatch
// consistency rule for any mismatch count.
export function answerWith(mismatchKeys: string[], overrides: { action?: string; evidenceId?: string } = {}) {
  const fields: Record<string, string> = {};
  for (const key of FIELD_KEYS) fields[key] = mismatchKeys.includes(key) ? "mismatch" : "match";
  const action = overrides.action ?? (mismatchKeys.length > 0 ? "pause_clarify" : "continue_checks");
  const evidenceId = overrides.evidenceId ?? "all_fields_match";
  return { fields, action, evidenceId };
}

// Submits each round's own correct answer for both members and advances,
// repeatedly, until the table reaches round `targetIndex` (1-indexed across
// training+transfer) -- case-content-agnostic the same way v1's
// advanceToRound() was, but now resolving each round's own correct
// submission via correctAnswerFor() rather than one fixed constant, and
// crossing the training_summary stage gate with fromStage when needed.
export async function advanceToRound(a: Client, b: Client, tableId: string, targetIndex: number): Promise<string> {
  for (;;) {
    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    if (snapshot.table.stage === "training_summary") {
      await a.post(`/api/tables/${tableId}/next`, { fromStage: "training_summary" });
      continue;
    }
    const round = currentRound(snapshot);
    if (round.index === targetIndex) return round.id;
    const answer = correctAnswerFor(round.case.caseId);
    if (!round.mine.submitted) await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer);
    await b.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer);
    await a.post(`/api/tables/${tableId}/next`, { fromRoundId: round.id });
  }
}

// Advances a joined-but-not-yet-played table all the way to `completed`,
// submitting each round's own correct answer for both members. Used by
// tests that need a finished table (summaries, persistence) rather than a
// specific round.
export async function completeTable(a: Client, b: Client, tableId: string): Promise<void> {
  for (;;) {
    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    if (snapshot.table.stage === "completed") return;
    if (snapshot.table.stage === "training_summary") {
      await a.post(`/api/tables/${tableId}/next`, { fromStage: "training_summary" });
      continue;
    }
    const round = currentRound(snapshot);
    const answer = correctAnswerFor(round.case.caseId);
    if (!round.mine.submitted) await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer);
    if (!round.revealed) await b.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer);
    await a.post(`/api/tables/${tableId}/next`, { fromRoundId: round.id });
  }
}

export { createClient, type Client };
export { baseUrl };
