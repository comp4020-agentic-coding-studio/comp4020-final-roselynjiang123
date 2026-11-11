#!/usr/bin/env node
// pnpm export:evaluation (brief §9): writes docs/validation/data/export-
// <date>.csv -- one row per submission: table code, seat, phase, case id,
// case version, the five fields, action, evidence, submitted-at minus
// round-created-at in seconds, and how many reference_opened usage events
// that seat logged for that round. No tokens, no cookie values, no IPs
// (T16): `identity` (the session token) never appears in the SELECT below,
// only the display-only table code derived from the table id the same way
// the app's own API does (src/ids.mjs).
import { mkdirSync, writeFileSync } from "node:fs";
import { openDatabase, resolveDatabasePath } from "../src/db.mjs";
import { tableCode } from "../src/ids.mjs";

const FIELD_KEYS = ["patient", "medicine", "dose", "route", "time"];

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

interface Row {
  table_id: string;
  round_id: string;
  seat: string;
  phase: string | null;
  case_data: string;
  round_created_at: string | null;
  answer: string;
  action: string | null;
  evidence_id: string | null;
  submitted_at: string;
}

function main(): void {
  const db = openDatabase(resolveDatabasePath());

  const rows = db
    .prepare(
      `SELECT
         r.table_id as table_id,
         r.id as round_id,
         m.seat as seat,
         r.phase as phase,
         r.case_data as case_data,
         r.created_at as round_created_at,
         s.answer as answer,
         s.action as action,
         s.evidence_id as evidence_id,
         s.submitted_at as submitted_at
       FROM submissions s
       JOIN rounds r ON r.id = s.round_id
       JOIN table_members m ON m.table_id = r.table_id AND m.identity = s.identity
       ORDER BY r.table_id, r.round_index, m.seat`,
    )
    .all() as Row[];

  const refCountByRoundSeat = db.prepare(
    `SELECT COUNT(*) as n FROM usage_events WHERE round_id = ? AND seat = ? AND type = 'reference_opened'`,
  );

  const header = [
    "table_code",
    "seat",
    "phase",
    "case_id",
    "case_version",
    "patient",
    "medicine",
    "dose",
    "route",
    "time",
    "action",
    "evidence_id",
    "duration_seconds",
    "reference_opened_count",
  ];
  const lines = [header.join(",")];

  for (const row of rows) {
    const caseData = JSON.parse(row.case_data) as { caseId: string; caseVersion?: string };
    const fields = JSON.parse(row.answer) as Record<string, string>;
    const durationSeconds = row.round_created_at
      ? (new Date(row.submitted_at).getTime() - new Date(row.round_created_at).getTime()) / 1000
      : "";
    const refCount = (refCountByRoundSeat.get(row.round_id, row.seat) as { n: number }).n;

    const cells = [
      tableCode(row.table_id),
      row.seat,
      row.phase ?? "",
      caseData.caseId,
      caseData.caseVersion ?? "",
      ...FIELD_KEYS.map((k) => fields[k] ?? ""),
      row.action ?? "",
      row.evidence_id ?? "",
      durationSeconds,
      refCount,
    ];
    lines.push(cells.map(csvCell).join(","));
  }

  const date = new Date().toISOString().slice(0, 10);
  const outDir = "docs/validation/data";
  mkdirSync(outDir, { recursive: true });
  const outPath = `${outDir}/export-${date}.csv`;
  writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
  console.log(`wrote ${lines.length - 1} rows to ${outPath}`);

  db.close();
}

main();
