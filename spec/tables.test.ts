import { describe, expect, it } from "vitest";
import { createAndJoinTable, createClient, createTable, baseUrl } from "./support/game.ts";

// Brief §9 item 1: seats.
describe("sessions, tables and the two-seat join", () => {
  it("creating a table claims seat A", async () => {
    const { tableId } = await createTable();
    expect(tableId.length).toBeGreaterThan(10);
  });

  it("same identity in two tabs cannot occupy both seats", async () => {
    const { owner, tableId } = await createTable();
    // "two tabs" = same cookie jar, i.e. the same Client reused.
    const res = await owner.post(`/api/tables/${tableId}/join`, {});
    expect(res.status).toBe(200);
    const snapshot = await res.json();
    expect(snapshot.seats.B.joined).toBe(false);
  });

  it("a second identity can join as seat B", async () => {
    const { tableId } = await createAndJoinTable();
    const snapshot = await (await createClient(baseUrl).get(`/api/tables/${tableId}`)).json();
    expect(snapshot.joinable).toBe(false);
  });

  it("third identity cannot join a full table", async () => {
    const { tableId } = await createAndJoinTable();
    const c = createClient(baseUrl);
    const res = await c.post(`/api/tables/${tableId}/join`, {});
    expect(res.status).toBe(409);
  });

  it("concurrent joins produce one B", async () => {
    const { tableId } = await createTable();
    const b1 = createClient(baseUrl);
    const b2 = createClient(baseUrl);
    const [r1, r2] = await Promise.all([
      b1.post(`/api/tables/${tableId}/join`, {}),
      b2.post(`/api/tables/${tableId}/join`, {}),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  it("a GET does not consume a seat", async () => {
    const { tableId } = await createTable();
    const outsider = createClient(baseUrl);
    await outsider.get(`/api/tables/${tableId}`);
    const joinRes = await outsider.post(`/api/tables/${tableId}/join`, {});
    expect(joinRes.status).toBe(200);
  });

  it("nonmembers cannot read full snapshots before joining", async () => {
    const { tableId } = await createAndJoinTable();
    const outsider = createClient(baseUrl);
    const res = await outsider.get(`/api/tables/${tableId}`);
    const body = await res.json();
    expect(body.table?.status).toBeUndefined();
    expect(body.seats).toBeUndefined();
  });
});
