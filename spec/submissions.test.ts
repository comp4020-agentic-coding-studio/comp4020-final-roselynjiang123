import { beforeEach, describe, expect, it } from "vitest";
import {
  answerWith,
  correctAnswerFor,
  createAndJoinTable,
  createClient,
  currentRound,
  type Client,
  baseUrl,
} from "./support/game.ts";

// T01 Independence, T04 Validation, T05 Immutability and concurrency (brief
// §12). Rewritten for the v2 submission body (brief §7.1: fields + action +
// evidenceId, no `overall`) -- v1's "overall" field and its pair-review
// text no longer exist; multi-discrepancy scoring and session suggestions
// are T06/T07/T08's job now (spec/round-results.test.ts,
// spec/session-summary.test.ts), reproducing docs/content/scoring-
// fixtures.json exactly rather than re-deriving expected text here.
describe("independent submission and joint reveal", () => {
  it("nonmembers cannot submit", async () => {
    const { tableId } = await createAndJoinTable();
    const outsider = createClient(baseUrl);
    const res = await outsider.post(`/api/tables/${tableId}/rounds/anything/submissions`, answerWith([]));
    expect(res.status).toBe(403);
  });

  it("T01: GET snapshot before reveal has no answer key or reveal data", async () => {
    const { a, tableId } = await createAndJoinTable();
    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const round = currentRound(snapshot);
    expect(round.result).toBeUndefined();
    expect(round.debrief).toBeUndefined();
    expect(round.case.answerKey).toBeUndefined();
    expect(round.case.feedback).toBeUndefined();
    expect(round.case.claims).toBeUndefined();
  });

  it("T01: the first submitter's own POST response leaks nothing about the partner", async () => {
    const { a, tableId } = await createAndJoinTable();
    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const round = currentRound(snapshot);
    const res = await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, correctAnswerFor(round.case.caseId));
    const body = await res.json();
    const after = currentRound(body);
    expect(after.result).toBeUndefined();
    expect(after.debrief).toBeUndefined();
    expect(after.partner.submitted).toBe(false);
    // The viewer's own submission is echoed back, without scoring (brief
    // §6.2: "Your own submission is returned to you after you sign,
    // without any scoring").
    expect(after.mine.submitted).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/fullyCorrect|outcome|"TP"|"FN"|"FP"|"TN"/);
  });

  describe("T04 answer validation (brief §7.1)", () => {
    let a: Client;
    let tableId: string;
    let roundId: string;
    let caseId: string;

    beforeEach(async () => {
      const created = await createAndJoinTable();
      a = created.a;
      tableId = created.tableId;
      const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
      const round = currentRound(snapshot);
      roundId = round.id;
      caseId = round.case.caseId;
    });

    it("rejects a missing field without revealing correctness", async () => {
      const { evidenceId, ...incomplete } = correctAnswerFor(caseId);
      const res = await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, incomplete);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(JSON.stringify(body)).not.toMatch(/correct/i);
    });

    it("rejects an unknown evidence id", async () => {
      const res = await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, {
        ...correctAnswerFor(caseId),
        evidenceId: "not_a_real_option",
      });
      expect(res.status).toBe(400);
    });

    it("rejects an extra field", async () => {
      const res = await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, {
        ...correctAnswerFor(caseId),
        bogus: "x",
      });
      expect(res.status).toBe(400);
    });

    it("rejects the consistency rule: continue_checks with a mismatch", async () => {
      const res = await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, answerWith(["dose"], { action: "continue_checks" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Continue with the remaining checks/);
    });

    it("accepts a well-formed but wrong answer", async () => {
      const res = await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, answerWith(["dose"], { action: "pause_clarify" }));
      expect(res.status).toBe(200);
    });
  });

  describe("T05 duplicate and concurrent submissions", () => {
    it("a duplicate identical submission is harmless", async () => {
      const { a, tableId } = await createAndJoinTable();
      const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
      const round = currentRound(snapshot);
      const answer = correctAnswerFor(round.case.caseId);
      const first = await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer);
      expect(first.status).toBe(200);
      const second = await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer);
      expect(second.status).toBe(200);
    });

    it("a changed repeat cannot overwrite the original", async () => {
      const { a, b, tableId } = await createAndJoinTable();
      const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
      const round = currentRound(snapshot);
      const original = correctAnswerFor(round.case.caseId);
      await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, original);
      await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answerWith(["dose"], { action: "pause_clarify" }));
      await b.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, original);
      const final = await (await a.get(`/api/tables/${tableId}`)).json();
      const after = currentRound(final);
      expect(after.result.A.fields.dose.given).toBe(original.fields.dose);
    });

    it("concurrent submissions from both members create exactly two rows and one reveal, with the same result for both", async () => {
      const { a, b, tableId } = await createAndJoinTable();
      const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
      const round = currentRound(snapshot);
      const answer = correctAnswerFor(round.case.caseId);
      const [resA, resB] = await Promise.all([
        a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer),
        b.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer),
      ]);
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      const bodyA = await (await a.get(`/api/tables/${tableId}`)).json();
      const bodyB = await (await b.get(`/api/tables/${tableId}`)).json();
      expect(currentRound(bodyA).revealed).toBe(true);
      expect(currentRound(bodyB).revealed).toBe(true);
      expect(currentRound(bodyA).result.A.fullyCorrect).toBe(currentRound(bodyB).result.A.fullyCorrect);
    });
  });
});
