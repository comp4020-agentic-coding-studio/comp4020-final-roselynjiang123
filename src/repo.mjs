import { uuid } from "./ids.mjs";
import { buildCaseSnapshot } from "./caseSnapshot.mjs";
import { caseForRoundIndex, afterRound, afterStage, trainingCases, transferCases } from "./stages.mjs";

// All SQL lives here, as prepared-statement functions bound to one database.
// Every state-changing operation is a transaction (brief §7: "Use
// transactions for competing joins, recording/revealing submissions and
// progression. Protect stale requests and double clicks at the server/
// database level.") so concurrent requests cannot race past the uniqueness
// constraints in src/db.mjs.
//
// `bank` is the already-loaded, already-validated content/case-bank.v2.json
// (src/bank.mjs). It is passed in rather than imported, so tests can pass a
// bank fixture without touching the real file (brief: the bank is read-only
// content, not something a test should need to load from disk to exercise
// the repo).
export function createRepo(db, bank) {
  const stmt = {
    insertSession: db.prepare("INSERT OR IGNORE INTO sessions (token) VALUES (?)"),
    sessionExists: db.prepare("SELECT 1 FROM sessions WHERE token = ?"),

    insertTable: db.prepare(
      "INSERT INTO tables (id, stage, bank_major_version, bank_version) VALUES (?, ?, ?, ?)",
    ),
    getTable: db.prepare("SELECT * FROM tables WHERE id = ?"),
    bumpTableVersion: db.prepare("UPDATE tables SET version = version + 1 WHERE id = ?"),
    setTableStage: db.prepare("UPDATE tables SET stage = ?, status = ? WHERE id = ?"),

    insertMember: db.prepare(
      "INSERT INTO table_members (table_id, seat, identity) VALUES (?, ?, ?)",
    ),
    membersForTable: db.prepare("SELECT * FROM table_members WHERE table_id = ? ORDER BY seat"),
    memberByIdentity: db.prepare(
      "SELECT * FROM table_members WHERE table_id = ? AND identity = ?",
    ),

    insertRound: db.prepare(
      "INSERT INTO rounds (id, table_id, round_index, case_data, phase, case_version) VALUES (?, ?, ?, ?, ?, ?)",
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
      "INSERT OR IGNORE INTO submissions (id, round_id, identity, answer, action, evidence_id) VALUES (?, ?, ?, ?, ?, ?)",
    ),
    submissionsForRound: db.prepare("SELECT * FROM submissions WHERE round_id = ?"),
  };

  // v1 tables' status mirrors directly onto a v2 stage (brief §6.1: "v1
  // tables and rounds remain readable"); this is the same mapping the
  // 0003 migration used to backfill existing rows, kept here so new tables
  // and the migration agree on what each status value means.
  function statusForStage(stage) {
    if (stage === "waiting_for_partner") return "waiting_for_partner";
    if (stage === "completed") return "completed";
    return "playing";
  }

  function ensureSession(token) {
    stmt.insertSession.run(token);
  }

  function insertRoundForIndex(tableId, roundIndex) {
    const caseDef = caseForRoundIndex(bank, roundIndex);
    const snapshot = buildCaseSnapshot(bank, caseDef);
    stmt.insertRound.run(uuid(), tableId, roundIndex, JSON.stringify(snapshot), caseDef.phase, caseDef.caseVersion);
  }

  // Creates a table, claims seat A -- no round yet (brief §5: round 1 is
  // created only once B joins, "B joins -> create round 1"; before that the
  // table sits in waiting_for_partner with no case to leak). One transaction
  // so a table is never observed without its creator's seat.
  const createTable = db.transaction((tableId, identity) => {
    stmt.insertTable.run(tableId, "waiting_for_partner", bank.bankMajorVersion, bank.bankVersion);
    stmt.insertMember.run(tableId, "A", identity);
    return { seat: "A", roundIndex: 0, snapshot: getSnapshot(tableId, identity) };
  });

  // Claims seat B, or resumes an existing membership (brief §4 step 3: "A
  // GET must not consume a seat" -- this is the POST that does, and it is
  // idempotent for the same identity). Returns a typed outcome rather than
  // throwing, so the route layer can map it to the right HTTP status without
  // string-matching an error message. Joining is what creates round 1
  // (brief §5).
  const joinTable = db.transaction((tableId, identity) => {
    const table = stmt.getTable.get(tableId);
    if (!table) return { outcome: "not_found" };

    const existing = stmt.memberByIdentity.get(tableId, identity);
    if (existing) {
      return { outcome: "ok", seat: existing.seat, roundIndex: 1, snapshot: getSnapshot(tableId, identity) };
    }

    const members = stmt.membersForTable.all(tableId);
    if (members.length >= 2) return { outcome: "full" };

    stmt.insertMember.run(tableId, "B", identity);
    stmt.setTableStage.run("training", statusForStage("training"), tableId);
    insertRoundForIndex(tableId, 1);
    stmt.bumpTableVersion.run(tableId);
    return { outcome: "ok", seat: "B", roundIndex: 1, snapshot: getSnapshot(tableId, identity) };
  });

  // Records one member's immutable submission for a round. If both members
  // now have a submission, reveals the round in the same transaction, so a
  // snapshot read can never observe "two submissions, not yet revealed"
  // (brief §6.2). INSERT OR IGNORE makes a duplicate identical POST harmless
  // and a changed repeat a no-op rather than an overwrite (brief §4 item 5).
  // `revealed` tells the route layer whether *this* call completed the
  // reveal, so it logs a "reveal" line only once (a replay cannot reach
  // this far: once revealed_at is set, the "stale" check below rejects
  // further submissions to the same round).
  const submitAnswer = db.transaction((tableId, roundId, identity, submission) => {
    const round = stmt.roundById.get(roundId);
    if (!round || round.table_id !== tableId) return { outcome: "not_found" };

    const member = stmt.memberByIdentity.get(tableId, identity);
    if (!member) return { outcome: "forbidden" };

    const current = stmt.currentRound.get(tableId);
    if (!current || current.id !== roundId || current.revealed_at) {
      return { outcome: "stale" };
    }

    stmt.insertSubmission.run(
      uuid(),
      roundId,
      identity,
      JSON.stringify(submission.fields),
      submission.action,
      submission.evidenceId,
    );
    const submissions = stmt.submissionsForRound.all(roundId);
    const revealed = submissions.length === 2;
    const trainingCount = trainingCases(bank).length;
    const transferCount = transferCases(bank).length;
    let completed = false;
    if (revealed) {
      stmt.revealRound.run(roundId);
      if (current.round_index === trainingCount + transferCount) {
        stmt.setTableStage.run("completed", statusForStage("completed"), tableId);
        completed = true;
      }
    }
    stmt.bumpTableVersion.run(tableId);
    return {
      outcome: "ok",
      seat: member.seat,
      roundIndex: current.round_index,
      revealed,
      // Tells the route layer to log a "complete" action line (brief §4
      // item 11) exactly once, on the call that reveals round 9 and moves
      // the table to "completed" -- never on a later idempotent read.
      completed,
      snapshot: getSnapshot(tableId, identity),
    };
  });

  // Advances from a revealed round to the next round, or from
  // training_summary to the first transfer round (brief §4 item 7:
  // "fromRoundId or fromStage"). Idempotent per fromRoundId/fromStage: a
  // second concurrent call for an already-applied one returns the current
  // snapshot rather than mutating again.
  const advance = db.transaction((tableId, identity, { fromRoundId, fromStage }) => {
    const member = stmt.memberByIdentity.get(tableId, identity);
    if (!member) return { outcome: "forbidden" };

    const table = stmt.getTable.get(tableId);
    if (!table) return { outcome: "not_found" };

    if (fromStage) {
      if (fromStage !== "training_summary") return { outcome: "stale" };
      if (table.stage !== "training_summary") {
        // Already advanced past training_summary (idempotent replay) if
        // we're now in transfer or completed; anything else is a stale
        // request that was never valid for this table.
        if (table.stage === "transfer" || table.stage === "completed") {
          return { outcome: "ok", seat: member.seat, roundIndex: null, snapshot: getSnapshot(tableId, identity) };
        }
        return { outcome: "stale" };
      }
      const transition = afterStage(bank, fromStage);
      stmt.setTableStage.run(transition.stage, statusForStage(transition.stage), tableId);
      insertRoundForIndex(tableId, transition.nextRoundIndex);
      stmt.bumpTableVersion.run(tableId);
      // "transfer" action (brief §4 item 11): training_summary -> round 7,
      // logged by the route layer from this stageAction, same reasoning as
      // "summary"/"complete" below -- only the call that actually performs
      // the transition sets it, never an idempotent replay (the earlier
      // table.stage !== "training_summary" branch returns before here).
      return {
        outcome: "ok",
        seat: member.seat,
        roundIndex: transition.nextRoundIndex,
        applied: true,
        stageAction: "transfer",
        snapshot: getSnapshot(tableId, identity),
      };
    }

    const current = stmt.currentRound.get(tableId);
    if (!current) return { outcome: "not_found" };

    if (current.id !== fromRoundId) {
      // Either already advanced past fromRoundId (idempotent replay) or
      // fromRoundId never was current for this table. `applied: false`
      // (brief §4 item 11: one log line per accepted action, not per
      // request) -- this call mutated nothing, so the route layer must not
      // log a second "next" for it.
      const target = stmt.roundById.get(fromRoundId);
      if (target && target.table_id === tableId && target.round_index < current.round_index) {
        return {
          outcome: "ok",
          seat: member.seat,
          roundIndex: target.round_index,
          applied: false,
          snapshot: getSnapshot(tableId, identity),
        };
      }
      return { outcome: "stale" };
    }
    if (!current.revealed_at) return { outcome: "stale" };

    const transition = afterRound(bank, current.round_index);
    if (transition.kind === "stage_only") {
      // afterRound() returns "stage_only" for two different transitions:
      // round 6 -> training_summary ("summary"), and round 9 -> completed.
      // Round 9's completed transition is normally already applied by
      // submitAnswer() when the second signature reveals it, before
      // anyone calls /next -- but the client still sends fromRoundId for
      // the last round in a phase (its "Next" button reads "See summary"
      // but posts the same body either way), so this branch is reachable
      // for round 9 too and must not log a second line for it: `applied:
      // false` when the table is already at the target stage (a no-op
      // idempotent read, not a transition this call performed).
      if (table.stage === transition.stage) {
        return {
          outcome: "ok",
          seat: member.seat,
          roundIndex: current.round_index,
          applied: false,
          snapshot: getSnapshot(tableId, identity),
        };
      }
      stmt.setTableStage.run(transition.stage, statusForStage(transition.stage), tableId);
      stmt.bumpTableVersion.run(tableId);
      return {
        outcome: "ok",
        seat: member.seat,
        roundIndex: current.round_index,
        applied: true,
        stageAction: transition.stage === "training_summary" ? "summary" : null,
        snapshot: getSnapshot(tableId, identity),
      };
    }

    stmt.setTableStage.run(transition.stage, statusForStage(transition.stage), tableId);
    insertRoundForIndex(tableId, transition.nextRoundIndex);
    stmt.bumpTableVersion.run(tableId);
    return {
      outcome: "ok",
      seat: member.seat,
      roundIndex: current.round_index,
      applied: true,
      snapshot: getSnapshot(tableId, identity),
    };
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
        fields: JSON.parse(s.answer),
      })),
    }));
    return { table, members, rounds, viewerIdentity: identity };
  }

  function listTablesForIdentity(identity) {
    return db
      .prepare(
        `SELECT t.id as table_id, t.status, t.stage, m.seat
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
