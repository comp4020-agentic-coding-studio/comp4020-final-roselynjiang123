import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createAndJoinTable, currentRound } from "./support/game.ts";

// T07/T08 must also pass end-to-end over HTTP (brief's Round C instruction),
// not only as pure-function tests against resultsAndSummary.mjs directly
// (spec/session-summary.test.ts). This drives the mockSession's own answers
// through two real HTTP clients for all nine rounds and checks the server's
// own serialized trainingSummary/transferSummary -- not sessionSummary()
// called in-process -- match docs/content/scoring-fixtures.json exactly,
// proving the whole route+serializer path reproduces the fixture, not just
// the pure function it wraps.
const fixtures = JSON.parse(readFileSync(new URL("../docs/content/scoring-fixtures.json", import.meta.url).pathname, "utf8"));

describe("T07/T08 session summaries reproduce mockSession exactly over real HTTP", () => {
  it("driving mockSession.answers through two cookies produces the fixture trainingSummary/transferSummary for both seats", async () => {
    const { a, b, tableId } = await createAndJoinTable();

    for (;;) {
      const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
      if (snapshot.table.stage === "training_summary") {
        await a.post(`/api/tables/${tableId}/next`, { fromStage: "training_summary" });
        continue;
      }
      if (snapshot.table.stage === "completed") break;
      const round = currentRound(snapshot);
      const subs = fixtures.mockSession.answers[round.case.caseId];
      if (!round.mine.submitted) await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, subs.A);
      await b.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, subs.B);
      await a.post(`/api/tables/${tableId}/next`, { fromRoundId: round.id });
    }

    // The serializer only ever returns the viewer's OWN seat key plus
    // "partner" (brief §6.2: your own data is yours, the rest comes back as
    // "partner", never a second seat letter directly) -- so checking both
    // A's and B's exact fixture match means fetching the snapshot as each
    // of them, not reading two seat keys off one response.
    const asA = await (await a.get(`/api/tables/${tableId}`)).json();
    expect(asA.table.stage).toBe("completed");
    expect(asA.trainingSummary.A).toEqual(fixtures.mockSession.trainingSummary.A);
    expect(asA.trainingSummary.partner).toEqual(fixtures.mockSession.trainingSummary.B);
    expect(asA.transferSummary.A).toEqual(fixtures.mockSession.transferSummary.A);
    expect(asA.transferSummary.partner).toEqual(fixtures.mockSession.transferSummary.B);

    const asB = await (await b.get(`/api/tables/${tableId}`)).json();
    expect(asB.trainingSummary.B).toEqual(fixtures.mockSession.trainingSummary.B);
    expect(asB.trainingSummary.partner).toEqual(fixtures.mockSession.trainingSummary.A);
    expect(asB.transferSummary.B).toEqual(fixtures.mockSession.transferSummary.B);
    expect(asB.transferSummary.partner).toEqual(fixtures.mockSession.transferSummary.A);
  });

  it("an incomplete table (stopped after 4 of 6 training cases) is not listed as completed and shows the partial count over HTTP", async () => {
    const { a, b, tableId } = await createAndJoinTable();
    for (let i = 0; i < 4; i++) {
      const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
      const round = currentRound(snapshot);
      const subs = fixtures.mockSession.answers[round.case.caseId];
      await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, subs.A);
      await b.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, subs.B);
      if (i < 3) await a.post(`/api/tables/${tableId}/next`, { fromRoundId: round.id });
    }
    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    expect(snapshot.table.stage).toBe("training");
    expect(snapshot.trainingSummary).toBeUndefined();
    expect(snapshot.rounds.filter((r: any) => r.revealed).length).toBe(4);
  });
});
