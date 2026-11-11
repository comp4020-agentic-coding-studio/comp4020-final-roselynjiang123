import { describe, expect, it } from "vitest";
import { readSseEvents } from "./support/client.ts";
import { correctAnswerFor, createAndJoinTable, createClient, currentRound, baseUrl } from "./support/game.ts";

// T03 Membership (SSE half), T14 SSE.
describe("SSE snapshots, reconnect and concurrency guards", () => {
  it("nonmembers cannot open the SSE stream", async () => {
    const { tableId } = await createAndJoinTable();
    const outsider = createClient(baseUrl);
    const res = await outsider.get(`/api/tables/${tableId}/events`);
    expect(res.status).toBe(403);
  });

  it("a member's SSE stream sends a snapshot immediately on connect", async () => {
    const { a, tableId } = await createAndJoinTable();
    const res = await a.get(`/api/tables/${tableId}/events`);
    const [first] = await readSseEvents(res, 1);
    expect((first as any).table.id).toBe(tableId);
  });

  it("T14: SSE events before reveal carry no partner answers, result or debrief fields", async () => {
    const { a, tableId } = await createAndJoinTable();
    const sseRes = await a.get(`/api/tables/${tableId}/events`);
    const [event] = await readSseEvents(sseRes, 1);
    expect(JSON.stringify(event)).not.toMatch(/"answerKey"|"acceptedPairs"|"debrief"|"result"/);
  });

  it("a submission by one member pushes a fresh snapshot to the other member's SSE stream", async () => {
    const { a, b, tableId } = await createAndJoinTable();
    const sseRes = await b.get(`/api/tables/${tableId}/events`);
    const eventsPromise = readSseEvents(sseRes, 2); // initial connect snapshot + the push after A submits

    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const round = currentRound(snapshot);
    await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, correctAnswerFor(round.case.caseId));

    const events = await eventsPromise;
    const pushed = currentRound(events[1] as any);
    expect(pushed.partner.submitted).toBe(true);
  });

  it("an unknown key in a submission body (e.g. a forged identity) is rejected, not silently dropped", async () => {
    // req.identity always comes from the session cookie (src/session.mjs),
    // never from req.body -- validateSubmissionV2's allowlist rejects any
    // extra top-level key outright, so there is no code path through which
    // a client-supplied "identity" field could reach repo.submitAnswer().
    const { a, tableId } = await createAndJoinTable();
    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const round = currentRound(snapshot);
    const res = await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, {
      ...correctAnswerFor(round.case.caseId),
      identity: "someone-else",
    });
    expect(res.status).toBe(400);
  });

  it("a write without a matching Origin is rejected", async () => {
    const { tableId } = await createAndJoinTable();
    const res = await fetch(new URL(`/api/tables/${tableId}/join`, baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: "{}",
    });
    expect(res.status).toBe(403);
  });
});
