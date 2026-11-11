import { describe, expect, it } from "vitest";
import { completeTable, createAndJoinTable, createClient, createTable, baseUrl } from "./support/game.ts";

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

// T03 Membership (extended, brief §9 "GET /api/me/history"): owner-only,
// §8.4's five fields, newest first, excludes the current table on request.
describe("GET /api/me/history", () => {
  it("a brand-new identity with no completed tables gets an empty list", async () => {
    const outsider = createClient(baseUrl);
    const res = await outsider.get("/api/me/history");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.history).toEqual([]);
  });

  it("another cookie cannot read my history", async () => {
    const { a, b, tableId } = await createAndJoinTable();
    await completeTable(a, b, tableId);
    const mine = await (await a.get("/api/me/history")).json();
    expect(mine.history.length).toBe(1);

    const outsider = createClient(baseUrl);
    const theirs = await (await outsider.get("/api/me/history")).json();
    expect(theirs.history).toEqual([]);
  });

  it("lists completed tables with §8.4's fields, newest first, excluding ?exclude", async () => {
    const { a, b: b1, tableId: t1 } = await createAndJoinTable();
    await completeTable(a, b1, t1);

    // Same identity (`a`'s cookie jar) creates and completes a second table,
    // so this checks both newest-first ordering and that ?exclude drops only
    // the named table, not every entry.
    const t2create = await a.post("/api/tables", {});
    const t2 = (await t2create.json()).table.id;
    const b2 = createClient(baseUrl);
    await b2.post(`/api/tables/${t2}/join`, {});
    await completeTable(a, b2, t2);

    const history = await (await a.get("/api/me/history")).json();
    expect(history.history.map((h: any) => h.tableId)).toEqual([t2, t1]);
    const entry = history.history[0];
    expect(entry.tableId).toBe(t2);
    expect(typeof entry.code).toBe("string");
    expect(typeof entry.completedAt).toBe("string");
    expect(entry).toHaveProperty("bankMajorVersion");
    expect(entry).toHaveProperty("bankVersion");
    expect(entry).toHaveProperty("trainingMismatchesFound");
    expect(entry).toHaveProperty("trainingFalseMarks");
    expect(entry).toHaveProperty("trainingDecisionsAccepted");
    expect(entry).toHaveProperty("transferDecisionsAccepted");

    // Excluding t2 (as the end-review screen does for its own table) leaves
    // only t1, not an empty list.
    const excluded = await (await a.get(`/api/me/history?exclude=${t2}`)).json();
    expect(excluded.history.map((h: any) => h.tableId)).toEqual([t1]);
  });

  it("an in-progress (not completed) table never appears in history", async () => {
    const { a, tableId } = await createAndJoinTable();
    void tableId;
    const history = await (await a.get("/api/me/history")).json();
    expect(history.history).toEqual([]);
  });
});
