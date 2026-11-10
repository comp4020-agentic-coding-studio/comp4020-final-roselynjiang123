import { caseSnapshot, CASE_COUNT } from "./cases.mjs";
import { uuid } from "./ids.mjs";

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
    bumpTableVersion: db.prepare("UPDATE tables SET version = version + 1 WHERE id = ?"),
    setTableStatus: db.prepare("UPDATE tables SET status = ? WHERE id = ?"),

    insertMember: db.prepare(
      "INSERT INTO table_members (table_id, seat, identity) VALUES (?, ?, ?)",
    ),
    membersForTable: db.prepare("SELECT * FROM table_members WHERE table_id = ? ORDER BY seat"),
    memberByIdentity: db.prepare(
      "SELECT * FROM table_members WHERE table_id = ? AND identity = ?",
    ),

    insertRound: db.prepare(
      "INSERT INTO rounds (id, table_id, round_index, case_data) VALUES (?, ?, ?, ?)",
    ),
    currentRound: db.prepare(
      "SELECT * FROM rounds WHERE table_id = ? ORDER BY round_index DESC LIMIT 1",
    ),
    roundById: db.prepare("SELECT * FROM rounds WHERE id = ?"),
    roundsForTable: db.prepare("SELECT * FROM rounds WHERE table_id = ? ORDER BY round_index"),
    revealRound: db.prepare(
      "UPDATE rounds SET revealed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    ),

    insertSubmission: db.prepare(
      "INSERT OR IGNORE INTO submissions (id, round_id, identity, answer) VALUES (?, ?, ?, ?)",
    ),
    submissionsForRound: db.prepare("SELECT * FROM submissions WHERE round_id = ?"),
  };

  function ensureSession(token) {
    stmt.insertSession.run(token);
  }

  // Creates a table, claims seat A, and starts round 1 -- one transaction so
  // a table is never observed without its creator's seat or its first round.
  const createTable = db.transaction((tableId, identity) => {
    stmt.insertTable.run(tableId);
    stmt.insertMember.run(tableId, "A", identity);
    stmt.insertRound.run(uuid(), tableId, 1, JSON.stringify(caseSnapshot(1)));
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
    stmt.bumpTableVersion.run(tableId);
    return { outcome: "ok", snapshot: getSnapshot(tableId, identity) };
  });

  // Records one member's immutable submission for a round. If both members
  // now have a submission, reveals the round in the same transaction, so a
  // snapshot read can never observe "two submissions, not yet revealed"
  // (brief §6: "Only a round with two immutable submissions is revealed").
  // INSERT OR IGNORE makes a duplicate identical POST harmless and a changed
  // repeat a no-op rather than an overwrite (brief §9 item 6).
  const submitAnswer = db.transaction((tableId, roundId, identity, answer) => {
    const round = stmt.roundById.get(roundId);
    if (!round || round.table_id !== tableId) return { outcome: "not_found" };

    const member = stmt.memberByIdentity.get(tableId, identity);
    if (!member) return { outcome: "forbidden" };

    const current = stmt.currentRound.get(tableId);
    if (!current || current.id !== roundId || current.revealed_at) {
      return { outcome: "stale" };
    }

    stmt.insertSubmission.run(uuid(), roundId, identity, JSON.stringify(answer));
    const submissions = stmt.submissionsForRound.all(roundId);
    if (submissions.length === 2) {
      stmt.revealRound.run(roundId);
      if (current.round_index === CASE_COUNT) {
        stmt.setTableStatus.run("completed", tableId);
      }
    }
    stmt.bumpTableVersion.run(tableId);
    return { outcome: "ok", snapshot: getSnapshot(tableId, identity) };
  });

  // Advances from a revealed round to the next case. Idempotent per
  // fromRoundId: a second concurrent call for the same already-applied
  // fromRoundId returns the current snapshot rather than creating a second
  // round (brief §6, §9 item 8).
  const advance = db.transaction((tableId, identity, fromRoundId) => {
    const member = stmt.memberByIdentity.get(tableId, identity);
    if (!member) return { outcome: "forbidden" };

    const current = stmt.currentRound.get(tableId);
    if (!current) return { outcome: "not_found" };

    if (current.id !== fromRoundId) {
      // Either already advanced past fromRoundId (idempotent replay) or
      // fromRoundId never was current for this table.
      const target = stmt.roundById.get(fromRoundId);
      if (target && target.table_id === tableId && target.round_index < current.round_index) {
        return { outcome: "ok", snapshot: getSnapshot(tableId, identity) };
      }
      return { outcome: "stale" };
    }
    if (!current.revealed_at) return { outcome: "stale" };

    if (current.round_index >= CASE_COUNT) {
      return { outcome: "ok", snapshot: getSnapshot(tableId, identity) };
    }

    const nextIndex = current.round_index + 1;
    stmt.insertRound.run(uuid(), tableId, nextIndex, JSON.stringify(caseSnapshot(nextIndex)));
    stmt.bumpTableVersion.run(tableId);
    return { outcome: "ok", snapshot: getSnapshot(tableId, identity) };
  });

  // The one allowlist-based read path (brief §7): builds exactly what a
  // given identity is allowed to see, for GET and POST responses alike.
  // See src/serializer.mjs for the shape and what it withholds pre-reveal.
  function getSnapshot(tableId, identity) {
    const table = stmt.getTable.get(tableId);
    if (!table) return null;
    const members = stmt.membersForTable.all(tableId);
    const rounds = stmt.roundsForTable.all(tableId).map((round) => ({
      ...round,
      case: JSON.parse(round.case_data),
      submissions: stmt.submissionsForRound.all(round.id).map((s) => ({
        ...s,
        answer: JSON.parse(s.answer),
      })),
    }));
    return { table, members, rounds, viewerIdentity: identity };
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
    submitAnswer,
    advance,
    getSnapshot,
    listTablesForIdentity,
    isMember,
  };
}
