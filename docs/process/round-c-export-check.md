# `pnpm export:evaluation` manual check (Round C step 8)

`scripts/export-evaluation.ts` reads straight from `DATABASE_PATH`, not the
spec's isolated per-run test database, so there is no automated end-to-end
test that runs the actual CLI command; T16's export half is checked here,
by hand, each time the script changes.

## What was checked

Ran the dev server against a scratch `data/dev.db`, played one round with
seat A logging one `reference_opened` usage event for a real medicine-card
id, then ran `DATABASE_PATH=data/dev.db pnpm export:evaluation`.

Output (`docs/validation/data/export-2026-11-11.csv`, not committed --
`.gitignore` excludes `docs/validation/data/`):

```
table_code,seat,phase,case_id,case_version,patient,medicine,dose,route,time,action,evidence_id,duration_seconds,reference_opened_count
HA2F,A,training,C1,2.0.0,match,match,match,match,match,continue_checks,total_amount,9.707,1
HA2F,B,training,C1,2.0.0,match,match,match,match,match,continue_checks,total_amount,9.716,0
```

Checked:

- The SELECT in `scripts/export-evaluation.ts` never names `identity`
  (the session-cookie token column) in any query -- grepped the file by
  hand to confirm.
- Diffed the two cookie jars' actual token values (`pzWOJuBGWW...`,
  `OfMZ0g5m92...`) against the CSV with `grep` -- no match.
- `reference_opened_count` for seat A is 1 (the one event logged before
  submitting), seat B's is 0 (B never opened the toolbox) -- matches what
  was actually clicked, not a stale or swapped count.
- `duration_seconds` is a small positive number (round created, then
  submitted a few seconds later in the same scripted run), not blank, NaN
  or negative.
- `table_code` is the same 4-character display code the app's own API
  returns (`HA2F`), never the full table id.

Not automated because the export script talks to whatever `DATABASE_PATH`
points at when it runs, and `pnpm check`'s vitest run uses its own isolated
database via `spec/global-setup.ts` -- there is no single database both the
running app-under-test and a `pnpm export:evaluation` subprocess could both
see without changing that isolation. `spec/usage-log.test.ts` covers
everything upstream of the export (the `/log` route's allowlist, rate
limit, membership check, and that a stored row/response never carries a
cookie value) over real HTTP instead.
