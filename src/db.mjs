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
