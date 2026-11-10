import { describe, expect, it } from "vitest";
import { CASE1_ANSWER_CORRECT, createAndJoinTable, type Client, currentRound } from "./support/game.ts";

// Brief §9 item 8: advancing rounds; also exercises the six frozen cases
// (src/cases.mjs) end to end, since completing all six is the only way to
// reach the final review state the brief describes.
describe("progression through six cases", () => {
  async function revealCurrent(a: Client, b: Client, tableId: string) {
    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const roundId = currentRound(snapshot).id;
    await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, { answer: CASE1_ANSWER_CORRECT });
    await b.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, { answer: CASE1_ANSWER_CORRECT });
    return roundId;
  }

  it("an unrevealed round cannot be advanced", async () => {
    const { a, tableId } = await createAndJoinTable();
    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const roundId = currentRound(snapshot).id;
    const res = await a.post(`/api/tables/${tableId}/next`, { fromRoundId: roundId });
    expect(res.status).toBe(409);
  });

  it("advancing a revealed round starts the next case", async () => {
    const { a, b, tableId } = await createAndJoinTable();
    const roundId = await revealCurrent(a, b, tableId);
    const res = await a.post(`/api/tables/${tableId}/next`, { fromRoundId: roundId });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(currentRound(body).index).toBe(2);
  });

  it("concurrent Next requests for one fromRoundId advance once", async () => {
    const { a, b, tableId } = await createAndJoinTable();
    const roundId = await revealCurrent(a, b, tableId);
    const [r1, r2] = await Promise.all([
      a.post(`/api/tables/${tableId}/next`, { fromRoundId: roundId }),
      b.post(`/api/tables/${tableId}/next`, { fromRoundId: roundId }),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const final = await (await a.get(`/api/tables/${tableId}`)).json();
    expect(final.rounds.length).toBe(2);
  });

  it("a stale (already-advanced) round cannot be edited back", async () => {
    const { a, b, tableId } = await createAndJoinTable();
    const roundId = await revealCurrent(a, b, tableId);
    await a.post(`/api/tables/${tableId}/next`, { fromRoundId: roundId });
    const res = await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, {
      answer: CASE1_ANSWER_CORRECT,
    });
    expect(res.status).toBe(409);
  });

  it("all six cases can complete without skipping, and the table completes", async () => {
    const { a, b, tableId } = await createAndJoinTable();
    for (let i = 0; i < 6; i++) {
      const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
      const round = currentRound(snapshot);
      expect(round.index).toBe(i + 1);
      await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, { answer: CASE1_ANSWER_CORRECT });
      await b.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, { answer: CASE1_ANSWER_CORRECT });
      if (i < 5) {
        await a.post(`/api/tables/${tableId}/next`, { fromRoundId: round.id });
      }
    }
    const final = await (await a.get(`/api/tables/${tableId}`)).json();
    expect(final.rounds.length).toBe(6);
    expect(final.table.status).toBe("completed");
    expect(final.rounds.every((r: any) => r.revealed)).toBe(true);
  });

  it("advancing past the last case does not create a seventh round", async () => {
    const { a, b, tableId } = await createAndJoinTable();
    let roundId = "";
    for (let i = 0; i < 6; i++) {
      const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
      const round = currentRound(snapshot);
      roundId = round.id;
      await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, { answer: CASE1_ANSWER_CORRECT });
      await b.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, { answer: CASE1_ANSWER_CORRECT });
      if (i < 5) {
        await a.post(`/api/tables/${tableId}/next`, { fromRoundId: round.id });
      }
    }
    const res = await a.post(`/api/tables/${tableId}/next`, { fromRoundId: roundId });
    expect(res.status).toBe(200);
    const final = await (await a.get(`/api/tables/${tableId}`)).json();
    expect(final.rounds.length).toBe(6);
  });
});
