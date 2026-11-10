import { beforeEach, describe, expect, it } from "vitest";
import {
  CASE1_ANSWER_CORRECT,
  createAndJoinTable,
  createClient,
  currentRound,
  type Client,
  baseUrl,
} from "./support/game.ts";

// Brief §9 item 3: pre-reveal payloads leak nothing.
describe("independent submission and joint reveal", () => {
  it("nonmembers cannot submit", async () => {
    const { tableId } = await createAndJoinTable();
    const outsider = createClient(baseUrl);
    const res = await outsider.post(`/api/tables/${tableId}/rounds/anything/submissions`, {
      answer: CASE1_ANSWER_CORRECT,
    });
    expect(res.status).toBe(403);
  });

  it("GET snapshot before reveal has no answer key or reveal data", async () => {
    const { a, tableId } = await createAndJoinTable();
    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const round = currentRound(snapshot);
    expect(round.reveal).toBeUndefined();
    expect(round.case.mismatchFields).toBeUndefined();
    expect(round.case.teachingPoint).toBeUndefined();
  });

  it("the first submitter's own POST response leaks nothing about the partner", async () => {
    const { a, tableId } = await createAndJoinTable();
    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const roundId = currentRound(snapshot).id;
    const res = await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, {
      answer: CASE1_ANSWER_CORRECT,
    });
    const body = await res.json();
    const round = currentRound(body);
    expect(round.reveal).toBeUndefined();
    expect(round.partner.submitted).toBe(false);
  });

  it("own per-field scoring does not leak before reveal", async () => {
    const { a, tableId } = await createAndJoinTable();
    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const roundId = currentRound(snapshot).id;
    const res = await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, {
      answer: CASE1_ANSWER_CORRECT,
    });
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/fullyCorrect|aCorrect|bCorrect/);
  });

  describe("answer validation (brief §9 item 5)", () => {
    let a: Client;
    let tableId: string;
    let roundId: string;

    beforeEach(async () => {
      const created = await createAndJoinTable();
      a = created.a;
      tableId = created.tableId;
      const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
      roundId = currentRound(snapshot).id;
    });

    it("rejects a missing field without revealing correctness", async () => {
      const { overall, ...incomplete } = CASE1_ANSWER_CORRECT;
      const res = await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, {
        answer: incomplete,
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(JSON.stringify(body)).not.toMatch(/correct/i);
    });

    it("rejects an invalid value", async () => {
      const res = await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, {
        answer: { ...CASE1_ANSWER_CORRECT, patient: "sort-of" },
      });
      expect(res.status).toBe(400);
    });

    it("rejects an extra field", async () => {
      const res = await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, {
        answer: { ...CASE1_ANSWER_CORRECT, bogus: "x" },
      });
      expect(res.status).toBe(400);
    });

    it("rejects an inconsistent overall judgement", async () => {
      const res = await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, {
        answer: { ...CASE1_ANSWER_CORRECT, overall: "discrepancy" },
      });
      expect(res.status).toBe(400);
    });

    it("accepts a valid answer regardless of correctness", async () => {
      const res = await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, {
        answer: { ...CASE1_ANSWER_CORRECT, patient: "mismatch", overall: "discrepancy" },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("duplicate and concurrent submissions (brief §9 item 6)", () => {
    it("a duplicate identical submission is harmless", async () => {
      const { a, tableId } = await createAndJoinTable();
      const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
      const roundId = currentRound(snapshot).id;
      const first = await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, {
        answer: CASE1_ANSWER_CORRECT,
      });
      expect(first.status).toBe(200);
      const second = await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, {
        answer: CASE1_ANSWER_CORRECT,
      });
      expect(second.status).toBe(200);
    });

    it("a changed repeat cannot overwrite the original", async () => {
      const { a, b, tableId } = await createAndJoinTable();
      const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
      const roundId = currentRound(snapshot).id;
      await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, {
        answer: CASE1_ANSWER_CORRECT,
      });
      await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, {
        answer: { ...CASE1_ANSWER_CORRECT, patient: "mismatch", overall: "discrepancy" },
      });
      await b.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, {
        answer: CASE1_ANSWER_CORRECT,
      });
      const final = await (await a.get(`/api/tables/${tableId}`)).json();
      const round = currentRound(final);
      expect(round.reveal.fields.patient.a).toBe("match");
    });

    it("concurrent submissions from both members create exactly two rows and one reveal", async () => {
      const { a, b, tableId } = await createAndJoinTable();
      const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
      const roundId = currentRound(snapshot).id;
      const [resA, resB] = await Promise.all([
        a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, { answer: CASE1_ANSWER_CORRECT }),
        b.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, { answer: CASE1_ANSWER_CORRECT }),
      ]);
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      const bodyA = await (await a.get(`/api/tables/${tableId}`)).json();
      const bodyB = await (await b.get(`/api/tables/${tableId}`)).json();
      expect(currentRound(bodyA).revealed).toBe(true);
      expect(currentRound(bodyB).revealed).toBe(true);
      expect(currentRound(bodyA).reveal.aFullyCorrect).toBe(currentRound(bodyB).reveal.aFullyCorrect);
    });
  });

  describe("agreement vs accuracy (brief §9 item 7)", () => {
    async function playRound(
      a: Client,
      b: Client,
      tableId: string,
      answerA: Record<string, string>,
      answerB: Record<string, string>,
    ) {
      const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
      const roundId = currentRound(snapshot).id;
      await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, { answer: answerA });
      const res = await b.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, { answer: answerB });
      return currentRound(await res.json());
    }

    it("correct consensus: both agree and both correct", async () => {
      const { a, b, tableId } = await createAndJoinTable();
      const round = await playRound(a, b, tableId, CASE1_ANSWER_CORRECT, CASE1_ANSWER_CORRECT);
      expect(round.reveal.sameAnswer).toBe(true);
      expect(round.reveal.aFullyCorrect).toBe(true);
      expect(round.reveal.bFullyCorrect).toBe(true);
    });

    it("incorrect consensus: both agree and both wrong", async () => {
      const { a, b, tableId } = await createAndJoinTable();
      const wrong = { ...CASE1_ANSWER_CORRECT, patient: "mismatch", overall: "discrepancy" };
      const round = await playRound(a, b, tableId, wrong, wrong);
      expect(round.reveal.sameAnswer).toBe(true);
      expect(round.reveal.aFullyCorrect).toBe(false);
      expect(round.reveal.bFullyCorrect).toBe(false);
    });

    it("divergent answers: different, one correct", async () => {
      const { a, b, tableId } = await createAndJoinTable();
      const wrong = { ...CASE1_ANSWER_CORRECT, patient: "mismatch", overall: "discrepancy" };
      const round = await playRound(a, b, tableId, CASE1_ANSWER_CORRECT, wrong);
      expect(round.reveal.sameAnswer).toBe(false);
      expect(round.reveal.aFullyCorrect).toBe(true);
      expect(round.reveal.bFullyCorrect).toBe(false);
    });

    it("differing partial errors: different, both wrong", async () => {
      const { a, b, tableId } = await createAndJoinTable();
      const wrongA = { ...CASE1_ANSWER_CORRECT, patient: "mismatch", overall: "discrepancy" };
      const wrongB = { ...CASE1_ANSWER_CORRECT, medicine: "mismatch", overall: "discrepancy" };
      const round = await playRound(a, b, tableId, wrongA, wrongB);
      expect(round.reveal.sameAnswer).toBe(false);
      expect(round.reveal.aFullyCorrect).toBe(false);
      expect(round.reveal.bFullyCorrect).toBe(false);
    });
  });
});
