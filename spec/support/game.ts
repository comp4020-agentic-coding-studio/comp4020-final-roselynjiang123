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

export { createClient, type Client };
export { baseUrl };
