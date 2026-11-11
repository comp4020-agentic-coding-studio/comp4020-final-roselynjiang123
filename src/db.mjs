import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Fixed by fly.toml [mounts]; the only storage that survives a restart or
// redeploy (brief §7a).
const MOUNT_PATH = "/data";

export function resolveDatabasePath() {
  const configured = process.env.DATABASE_PATH;
  if (process.env.NODE_ENV === "production") {
    if (!configured) {
      throw new Error("DATABASE_PATH must be set in production (inside the Fly volume mount)");
    }
    const abs = resolve(configured);
    if (abs !== MOUNT_PATH && !abs.startsWith(`${MOUNT_PATH}/`)) {
      throw new Error(`DATABASE_PATH (${abs}) must be inside the mounted volume at ${MOUNT_PATH}`);
    }
    return abs;
  }
  return resolve(configured ?? "data/dev.db");
}

// Durable entities (brief §7): sessions, tables, table_members, rounds
// (frozen case data + reveal timestamp), submissions.
//
// tables.id doubles as the invitation token: it is the only identifier, is
// generated with enough entropy to be unguessable (src/ids.mjs), and the
// "table code" shown in the UI is a display-only derivation of it (first 4
// characters, uppercased) -- never a second secret to manage.
//
// tables.version increases on every state-changing write to that table, so
// SSE subscribers and the client can detect and discard a stale response
// that arrives after a newer one (brief §7). Added in 0002 rather than 0001:
// 0001 already ran against the deployed Fly volume in Round 1, so changing it
// in place would silently skip the column on that volume (migrations never
// re-run once applied -- brief §7a).
const MIGRATIONS = [
  {
    id: "0001_initial",
    sql: `
      CREATE TABLE sessions (
        token TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE tables (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'waiting_for_partner',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE table_members (
        table_id TEXT NOT NULL REFERENCES tables(id),
        seat TEXT NOT NULL CHECK (seat IN ('A', 'B')),
        identity TEXT NOT NULL,
        joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (table_id, seat),
        UNIQUE (table_id, identity)
      );

      CREATE TABLE rounds (
        id TEXT PRIMARY KEY,
        table_id TEXT NOT NULL REFERENCES tables(id),
        round_index INTEGER NOT NULL,
        case_data TEXT NOT NULL,
        revealed_at TEXT,
        UNIQUE (table_id, round_index)
      );

      CREATE TABLE submissions (
        id TEXT PRIMARY KEY,
        round_id TEXT NOT NULL REFERENCES rounds(id),
        identity TEXT NOT NULL,
        answer TEXT NOT NULL,
        submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (round_id, identity)
      );
    `,
  },
  {
    id: "0002_table_version",
    sql: `ALTER TABLE tables ADD COLUMN version INTEGER NOT NULL DEFAULT 0;`,
  },
  // v2 (brief §5, §6.1): stage replaces the single-round status/next-case
  // model with four stages (waiting_for_partner -> training ->
  // training_summary -> transfer -> completed); bank_major_version/
  // bank_version record which content/case-bank.v2.json version a table was
  // created against (brief §6.1: "Each table records bankMajorVersion and
  // bankVersion at creation"). Existing rows backfill to the v1-equivalent
  // stage/status so they keep reading correctly with no data loss: a v1
  // table's `status` already distinguishes waiting/playing/completed, and
  // every v1 game was a single six-case "training"-shaped sequence, so
  // status='playing' backfills to stage='training'. bank_major_version/
  // bank_version are left NULL for pre-v2 rows -- there is no bank version
  // to backfill them to, and NULL is how the rest of this migration set
  // marks "not collected in this version" content.
  {
    id: "0003_tables_stage_and_bank_version",
    sql: `
      ALTER TABLE tables ADD COLUMN stage TEXT;
      ALTER TABLE tables ADD COLUMN bank_major_version INTEGER;
      ALTER TABLE tables ADD COLUMN bank_version TEXT;
      UPDATE tables SET stage = CASE status
        WHEN 'waiting_for_partner' THEN 'waiting_for_partner'
        WHEN 'playing' THEN 'training'
        WHEN 'completed' THEN 'completed'
        ELSE 'waiting_for_partner'
      END WHERE stage IS NULL;
    `,
  },
  // phase (training|transfer) and case_version let a round be read without
  // re-parsing case_data's JSON blob just to know which; both are NULL for
  // pre-v2 rows (no case_version existed, and every v1 round was
  // training-equivalent, so phase backfills to 'training' -- a factual,
  // non-destructive default, not a guess, since v1 had no transfer phase at
  // all).
  {
    id: "0004_rounds_phase_and_case_version",
    sql: `
      ALTER TABLE rounds ADD COLUMN phase TEXT;
      ALTER TABLE rounds ADD COLUMN case_version TEXT;
      UPDATE rounds SET phase = 'training' WHERE phase IS NULL;
    `,
  },
  // action/evidence_id (brief §7.1's decision step) are new in v2 and have
  // no v1 equivalent, so existing submission rows leave them NULL -- the
  // serializer displays a NULL action/evidence_id round's decision as "Not
  // collected in this version" (brief §6.1) rather than scoring it as wrong.
  {
    id: "0005_submissions_action_and_evidence",
    sql: `
      ALTER TABLE submissions ADD COLUMN action TEXT;
      ALTER TABLE submissions ADD COLUMN evidence_id TEXT;
    `,
  },
];

export function openDatabase(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  const applied = new Set(db.prepare("SELECT id FROM schema_migrations").all().map((row) => row.id));
  const migrate = db.transaction(() => {
    for (const { id, sql } of MIGRATIONS) {
      if (applied.has(id)) continue;
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(id);
    }
  });
  migrate();

  return db;
}
