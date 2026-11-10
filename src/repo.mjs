// All SQL lives here, as prepared-statement functions bound to one database.
// Every state-changing operation is a transaction (brief §7: "Use
// transactions for competing joins, recording/revealing submissions and
// progression. Protect stale requests and double clicks at the server/
// database level.") so concurrent requests cannot race past the uniqueness
// constraints in src/db.mjs.
export function createRepo(db) {
  const stmt = {
    insertSession: db.prepare("INSERT OR IGNORE INTO sessions (token) VALUES (?)"),
    sessionExists: db.prepare("SELECT 1 FROM sessions WHERE token = ?"),

    insertTable: db.prepare("INSERT INTO tables (id) VALUES (?)"),
    getTable: db.prepare("SELECT * FROM tables WHERE id = ?"),
    setTableStatus: db.prepare("UPDATE tables SET status = ? WHERE id = ?"),

    insertMember: db.prepare(
      "INSERT INTO table_members (table_id, seat, identity) VALUES (?, ?, ?)",
    ),
    membersForTable: db.prepare("SELECT * FROM table_members WHERE table_id = ? ORDER BY seat"),
    memberByIdentity: db.prepare(
      "SELECT * FROM table_members WHERE table_id = ? AND identity = ?",
    ),
  };

  function ensureSession(token) {
    stmt.insertSession.run(token);
  }

  // Creates a table and claims seat A, in one transaction so a table is
  // never observed without its creator's seat.
  const createTable = db.transaction((tableId, identity) => {
    stmt.insertTable.run(tableId);
    stmt.insertMember.run(tableId, "A", identity);
    return getSnapshot(tableId, identity);
  });

  // Claims seat B, or resumes an existing membership (brief §4 step 3: "A
  // GET must not consume a seat" -- this is the POST that does, and it is
  // idempotent for the same identity). Returns a typed outcome rather than
  // throwing, so the route layer can map it to the right HTTP status without
  // string-matching an error message.
  const joinTable = db.transaction((tableId, identity) => {
    const table = stmt.getTable.get(tableId);
    if (!table) return { outcome: "not_found" };

    const existing = stmt.memberByIdentity.get(tableId, identity);
    if (existing) return { outcome: "ok", snapshot: getSnapshot(tableId, identity) };

    const members = stmt.membersForTable.all(tableId);
    if (members.length >= 2) return { outcome: "full" };

    stmt.insertMember.run(tableId, "B", identity);
    stmt.setTableStatus.run("playing", tableId);
    return { outcome: "ok", snapshot: getSnapshot(tableId, identity) };
  });

  function getSnapshot(tableId, identity) {
    const table = stmt.getTable.get(tableId);
    if (!table) return null;
    const members = stmt.membersForTable.all(tableId);
    return { table, members, viewerIdentity: identity };
  }

  function listTablesForIdentity(identity) {
    return db
      .prepare(
        `SELECT t.id as table_id, t.status, m.seat
         FROM table_members m JOIN tables t ON t.id = m.table_id
         WHERE m.identity = ? ORDER BY m.joined_at DESC`,
      )
      .all(identity);
  }

  function isMember(tableId, identity) {
    return Boolean(stmt.memberByIdentity.get(tableId, identity));
  }

  return {
    ensureSession,
    sessionExists: (token) => Boolean(stmt.sessionExists.get(token)),
    createTable,
    joinTable,
    getSnapshot,
    listTablesForIdentity,
    isMember,
  };
}
