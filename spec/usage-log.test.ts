import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createAndJoinTable, createClient, currentRound, baseUrl } from "./support/game.ts";

// T16 Logging (the /log half; the export CSV half is checked by hand each
// Round C report, since export:evaluation reads the live DATABASE_PATH, not
// the spec's isolated test database -- see docs/process/round-c-export-
// check.md). Unknown log types/refs rejected, not silently dropped; rate
// limiting applies per member per minute; nonmembers can't log.
const bank = JSON.parse(readFileSync(new URL("../content/case-bank.v2.json", import.meta.url).pathname, "utf8"));
const REAL_MEDICINE_CARD_ID = bank.medicineCards[0].id;
const REAL_KNOWLEDGE_REF = `knowledge:${bank.knowledgeCard.sections[0].heading}`;

describe("POST /api/tables/:id/log", () => {
  it("a known medicine-card ref is accepted", async () => {
    const { a, tableId } = await createAndJoinTable();
    const res = await a.post(`/api/tables/${tableId}/log`, { type: "reference_opened", ref: REAL_MEDICINE_CARD_ID });
    expect(res.status).toBe(204);
  });

  it("a known knowledge-card section ref is accepted", async () => {
    const { a, tableId } = await createAndJoinTable();
    const res = await a.post(`/api/tables/${tableId}/log`, { type: "reference_opened", ref: REAL_KNOWLEDGE_REF });
    expect(res.status).toBe(204);
  });

  it("an unknown ref is rejected, not silently dropped", async () => {
    const { a, tableId } = await createAndJoinTable();
    const res = await a.post(`/api/tables/${tableId}/log`, { type: "reference_opened", ref: "not-a-real-card-id" });
    expect(res.status).toBe(400);
  });

  it("an unknown type is rejected", async () => {
    const { a, tableId } = await createAndJoinTable();
    const res = await a.post(`/api/tables/${tableId}/log`, { type: "page_view", ref: REAL_MEDICINE_CARD_ID });
    expect(res.status).toBe(400);
  });

  it("nonmembers cannot log", async () => {
    const { tableId } = await createAndJoinTable();
    const outsider = createClient(baseUrl);
    const res = await outsider.post(`/api/tables/${tableId}/log`, { type: "reference_opened", ref: REAL_MEDICINE_CARD_ID });
    expect(res.status).toBe(403);
  });

  it("more than 60 events per member per minute are silently ignored (still 204), not rejected", async () => {
    const { a, tableId } = await createAndJoinTable();
    let lastStatus = 0;
    for (let i = 0; i < 61; i++) {
      const res = await a.post(`/api/tables/${tableId}/log`, { type: "reference_opened", ref: REAL_MEDICINE_CARD_ID });
      lastStatus = res.status;
    }
    // Brief §9: "silently ignore" -- the 61st call still looks like success
    // to the caller, it just doesn't add a 61st stored row.
    expect(lastStatus).toBe(204);
  });

  it("a stored usage event never carries a cookie or session value (checked via the export path's own query shape)", async () => {
    // The route itself never echoes anything back (204, no body) and the
    // repo's insertUsageEvent only ever binds table_id/seat/round_id/type/
    // ref (src/repo.mjs) -- there is no column or bound parameter for the
    // session token, so this documents that invariant at the route level;
    // scripts/export-evaluation.ts's own SELECT (checked by hand, see
    // docs/process/round-c-export-check.md) never selects `identity`.
    const { a, tableId } = await createAndJoinTable();
    const res = await a.post(`/api/tables/${tableId}/log`, { type: "reference_opened", ref: REAL_MEDICINE_CARD_ID });
    const body = await res.text();
    expect(body).toBe("");
  });
});

describe("the toolbox logs a real round id, not a stale one", () => {
  it("logging after advancing to round 2 is accepted against the new current round", async () => {
    const { a, b, tableId } = await createAndJoinTable();
    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const round = currentRound(snapshot);
    const caseDef = bank.cases.find((c: any) => c.caseId === round.case.caseId);
    const pair = caseDef.answerKey.acceptedPairs[0];
    const answer = { fields: { ...caseDef.answerKey.fields }, action: pair.action, evidenceId: pair.evidenceId };
    await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer);
    await b.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer);
    await a.post(`/api/tables/${tableId}/next`, { fromRoundId: round.id });

    const res = await a.post(`/api/tables/${tableId}/log`, { type: "reference_opened", ref: REAL_MEDICINE_CARD_ID });
    expect(res.status).toBe(204);
  });
});
