import { describe, expect, it } from "vitest";
import {
  BANK,
  correctAnswerFor,
  createAndJoinTable,
  createClient,
  type Client,
  currentRound,
  baseUrl,
} from "./support/game.ts";

const TRAINING_COUNT = BANK.cases.filter((c: any) => c.phase === "training").length;
const TRANSFER_COUNT = BANK.cases.filter((c: any) => c.phase === "transfer").length;

// T05 Immutability and concurrency (the /next half), T09 Stages. Rewritten
// for v2's four-stage flow (brief §5): a single round_index no longer maps
// 1:1 onto "case count"; progress now also crosses two stage-only gates
// (training -> training_summary, training_summary -> transfer) that create
// no new round, advanced with fromStage rather than fromRoundId (brief §4
// item 7).
describe("progression through training, summary, transfer and completion", () => {
  async function revealCurrent(a: Client, b: Client, tableId: string) {
    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const round = currentRound(snapshot);
    const answer = correctAnswerFor(round.case.caseId);
    await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer);
    await b.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer);
    return round.id;
  }

  it("nonmembers cannot advance", async () => {
    const { tableId } = await createAndJoinTable();
    const outsider = createClient(baseUrl);
    const res = await outsider.post(`/api/tables/${tableId}/next`, { fromRoundId: "anything" });
    expect(res.status).toBe(403);
  });

  it("a request with neither fromRoundId nor fromStage is rejected", async () => {
    const { a, tableId } = await createAndJoinTable();
    const res = await a.post(`/api/tables/${tableId}/next`, {});
    expect(res.status).toBe(400);
  });

  it("a request with both fromRoundId and fromStage is rejected", async () => {
    const { a, tableId } = await createAndJoinTable();
    const res = await a.post(`/api/tables/${tableId}/next`, { fromRoundId: "x", fromStage: "training_summary" });
    expect(res.status).toBe(400);
  });

  it("an unrevealed round cannot be advanced", async () => {
    const { a, tableId } = await createAndJoinTable();
    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const roundId = currentRound(snapshot).id;
    const res = await a.post(`/api/tables/${tableId}/next`, { fromRoundId: roundId });
    expect(res.status).toBe(409);
  });

  it("advancing a revealed round starts the next round", async () => {
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
    const res = await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, correctAnswerFor(BANK.cases[0].caseId));
    expect(res.status).toBe(409);
  });

  it("T09: waiting -> training (6) -> training_summary -> transfer (3) -> completed, over real HTTP with two cookies", async () => {
    const { a, b, tableId } = await createAndJoinTable();

    for (let i = 0; i < TRAINING_COUNT; i++) {
      const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
      expect(snapshot.table.stage).toBe("training");
      const round = currentRound(snapshot);
      expect(round.index).toBe(i + 1);
      expect(round.case.phase).toBe("training");
      await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, correctAnswerFor(round.case.caseId));
      await b.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, correctAnswerFor(round.case.caseId));
      await a.post(`/api/tables/${tableId}/next`, { fromRoundId: round.id });
    }

    const afterTraining = await (await a.get(`/api/tables/${tableId}`)).json();
    expect(afterTraining.table.stage).toBe("training_summary");
    expect(afterTraining.rounds.length).toBe(TRAINING_COUNT);
    expect(afterTraining.trainingSummary.completedCount).toBe(TRAINING_COUNT);
    // Advancing a round or submitting during training_summary is invalid:
    // there is no current unrevealed round to act on (brief §5's "no new
    // round" for this stage).
    const lastTrainingRound = currentRound(afterTraining);
    const badSubmit = await a.post(`/api/tables/${tableId}/rounds/${lastTrainingRound.id}/submissions`, correctAnswerFor(lastTrainingRound.case.caseId));
    expect(badSubmit.status).toBe(409);

    const toTransfer = await a.post(`/api/tables/${tableId}/next`, { fromStage: "training_summary" });
    expect(toTransfer.status).toBe(200);
    const afterStart = await toTransfer.json();
    expect(afterStart.table.stage).toBe("transfer");
    expect(afterStart.rounds.length).toBe(TRAINING_COUNT + 1);
    expect(currentRound(afterStart).case.phase).toBe("transfer");

    for (let i = 0; i < TRANSFER_COUNT; i++) {
      const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
      expect(snapshot.table.stage).toBe("transfer");
      const round = currentRound(snapshot);
      expect(round.index).toBe(TRAINING_COUNT + i + 1);
      await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, correctAnswerFor(round.case.caseId));
      await b.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, correctAnswerFor(round.case.caseId));
      await a.post(`/api/tables/${tableId}/next`, { fromRoundId: round.id });
    }

    const final = await (await a.get(`/api/tables/${tableId}`)).json();
    expect(final.table.stage).toBe("completed");
    expect(final.rounds.length).toBe(TRAINING_COUNT + TRANSFER_COUNT);
    expect(final.rounds.every((r: any) => r.revealed)).toBe(true);
    expect(final.trainingSummary.completedCount).toBe(TRAINING_COUNT);
    expect(final.transferSummary.completedCount).toBe(TRANSFER_COUNT);

    // Transfer results never alter training results (brief §8.3): the
    // training summary seen now is identical to the one seen right after
    // training finished.
    expect(final.trainingSummary).toEqual(afterTraining.trainingSummary);
  });

  it("advancing past the last round does not create an extra round", async () => {
    const { a, b, tableId } = await createAndJoinTable();
    let lastRoundId = "";
    for (let i = 0; i < TRAINING_COUNT; i++) {
      const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
      const round = currentRound(snapshot);
      lastRoundId = round.id;
      await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, correctAnswerFor(round.case.caseId));
      await b.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, correctAnswerFor(round.case.caseId));
      if (i < TRAINING_COUNT - 1) {
        await a.post(`/api/tables/${tableId}/next`, { fromRoundId: round.id });
      }
    }
    // Stale fromRoundId against a round that's no longer current and was
    // never a round -> training_summary transition: still a valid
    // idempotent replay target since it's revealed and current.
    const res = await a.post(`/api/tables/${tableId}/next`, { fromRoundId: lastRoundId });
    expect(res.status).toBe(200);
    const final = await (await a.get(`/api/tables/${tableId}`)).json();
    expect(final.rounds.length).toBe(TRAINING_COUNT);
    expect(final.table.stage).toBe("training_summary");

    // A second identical fromStage call after already leaving
    // training_summary is an idempotent replay, not a second transfer round.
    await a.post(`/api/tables/${tableId}/next`, { fromStage: "training_summary" });
    const afterFirstStart = await (await a.get(`/api/tables/${tableId}`)).json();
    const roundsAfterFirstStart = afterFirstStart.rounds.length;
    const replay = await a.post(`/api/tables/${tableId}/next`, { fromStage: "training_summary" });
    expect(replay.status).toBe(200);
    const afterReplay = await (await a.get(`/api/tables/${tableId}`)).json();
    expect(afterReplay.rounds.length).toBe(roundsAfterFirstStart);
  });
});
