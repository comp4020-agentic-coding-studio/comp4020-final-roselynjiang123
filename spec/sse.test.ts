import { describe, expect, it } from "vitest";
import { readSseEvents } from "./support/client.ts";
import { CASE1_ANSWER_CORRECT, createAndJoinTable, createClient, currentRound, baseUrl } from "./support/game.ts";

// Brief §9 item 2 (SSE half) and the SSE-snapshot half of §7/§9 item 10
// (restart/reconnect recovery is covered in spec/restart.test.ts, commit f,
// since it needs the actual process to restart).
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

  it("SSE events before reveal carry no partner answers or answer key", async () => {
    const { a, tableId } = await createAndJoinTable();
    const sseRes = await a.get(`/api/tables/${tableId}/events`);
    const [event] = await readSseEvents(sseRes, 1);
    expect(JSON.stringify(event)).not.toMatch(/mismatchFields|teachingPoint/);
  });

  it("a submission by one member pushes a fresh snapshot to the other member's SSE stream", async () => {
    const { a, b, tableId } = await createAndJoinTable();
    const sseRes = await b.get(`/api/tables/${tableId}/events`);
    const eventsPromise = readSseEvents(sseRes, 2); // initial connect snapshot + the push after A submits

    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const roundId = currentRound(snapshot).id;
    await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, { answer: CASE1_ANSWER_CORRECT });

    const events = await eventsPromise;
    const pushed = currentRound(events[1] as any);
    expect(pushed.partner.submitted).toBe(true);
  });

  it("forged identity in the request body does not bypass session identity", async () => {
    const { a, tableId } = await createAndJoinTable();
    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const roundId = currentRound(snapshot).id;
    const res = await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, {
      answer: CASE1_ANSWER_CORRECT,
      identity: "someone-else",
    });
    expect(res.status).toBe(200);
    const after = await res.json();
    expect(currentRound(after).mine.submitted).toBe(true);
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
