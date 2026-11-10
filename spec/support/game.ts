import { inject } from "vitest";
import { createClient, type Client } from "./client.ts";

const baseUrl = inject("baseUrl");

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

export const CASE1_ANSWER_CORRECT = {
  patient: "match",
  medicine: "match",
  dose: "match",
  route: "match",
  time: "match",
  overall: "match",
};

const FIELD_KEYS = ["patient", "medicine", "dose", "route", "time"];

// Builds a well-formed, self-consistent answer with exactly `mismatchKeys`
// marked "Does not match". validateAnswer only checks internal consistency,
// not the answer against any particular case, so this is valid for any case
// regardless of that case's real discrepancies -- useful for driving an
// answer that's deliberately right or wrong about a specific frozen case.
export function answerWith(mismatchKeys: string[]): Record<string, string> {
  const answer: Record<string, string> = {};
  for (const key of FIELD_KEYS) answer[key] = mismatchKeys.includes(key) ? "mismatch" : "match";
  answer.overall = mismatchKeys.length > 0 ? "discrepancy" : "match";
  return answer;
}

// Submits CASE1_ANSWER_CORRECT for both members and advances, repeatedly,
// until the table's current round is `targetIndex` -- a case-content-
// agnostic way to reach case 2, 3, etc. for a test. Correctness doesn't
// matter while passing through; validateAnswer only checks self-consistency.
export async function advanceToRound(a: Client, b: Client, tableId: string, targetIndex: number): Promise<string> {
  for (;;) {
    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const round = currentRound(snapshot);
    if (round.index === targetIndex) return round.id;
    await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, { answer: CASE1_ANSWER_CORRECT });
    await b.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, { answer: CASE1_ANSWER_CORRECT });
    await a.post(`/api/tables/${tableId}/next`, { fromRoundId: round.id });
  }
}

export { createClient, type Client };
export { baseUrl };
