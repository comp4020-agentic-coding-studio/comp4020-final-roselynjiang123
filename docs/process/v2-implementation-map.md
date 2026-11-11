# v2 implementation map

## What exists today (v1.2)
Engine: `src/cases.mjs` (6 frozen cases, server-only), `src/scoring.mjs`
(`validateAnswer`/`expectedAnswer`/`fieldResults`/`pairReview`; answer shape
`{patient,medicine,dose,route,time,overall}`), `src/serializer.mjs` (one
allowlist path for GET/POST/SSE), `src/repo.mjs` (transactional
create/join/submit/advance), `src/session.mjs`, `src/sse.mjs`,
`src/actionlog.mjs`. Routes: `POST /api/tables`, `/join`, `/rounds/:id/
submissions`, `/next` (`fromRoundId` only), `GET /api/tables/:id`, `/events`,
`/api/me/tables`, `/readme/`, `/healthz`. DB: `sessions`, `tables` (status,
version), `table_members`, `rounds` (round_index, case_data, revealed_at),
`submissions` — 2 additive migrations. 9 spec files, 53 passing tests.
`public/style.css`+`play.js` render v1's record/sign-off/progress/pair-
review/reveal-table markup.

## What v2 changes
Single round → 9-round, 4-stage flow (`waiting_for_partner → training →
training_summary → transfer → completed`); `fromStage` alongside
`fromRoundId`; answer shape gains `action`+`evidenceId`, drops `overall`;
scoring gains TP/FN/FP/TN, decision acceptance, pair coverage/complementary/
identical, session summaries, suggestions; content moves from
`src/cases.mjs` to `content/case-bank.v2.json` (externally versioned,
validated at startup); new routes (`/api/me/history`, `/log`,
`/t/:id`, `/guide/`, `/sources/`, export/review-pack CLI tools); new UI
(reference v2.1, different class names) replacing v1.2's.

## What stays
All ten §4 engine invariants (cookie identity, two-seat join, same-origin
writes, one serializer, immutability, reveal-on-both, SQLite-as-truth, no
secret logging, no static leakage) are already built and tested; items 1–6
and 8–10 need only extension to new shapes/stages, not new mechanisms.
Migrations stay additive; `pnpm check`/`check:evidence` stay the gate.

## Does the §4 two-player engine already work?
**Yes, for a single round** — every §4 invariant is implemented and
spec-tested today. **No** for the full flow: `/next` only understands
`fromRoundId`, not `fromStage` (item 7), and nothing yet creates round 7 on
leaving `training_summary` or stops at `training_summary`/`completed`
instead of case 10. That's new work (§10.1 CSS is deferred to Round D;
stage logic is Round B's).

## Conflicts between v1.2/old CLAUDE.md and v2, resolved
| Old (v1.2) | v2 | Resolution |
|---|---|---|
| `overall: match\|discrepancy` field | §7.1 drops it; adds `action`+`evidenceId` | v2 wins — submission shape changes |
| 5 fields only, no next-step | §7.1 "next step with evidence" | v2 wins |
| Server-only `src/cases.mjs`, agent-authored cases | `content/case-bank.v2.json`, student-owned clinical content | v2 wins; CLAUDE.md gets "clinical content lives only in the bank, student edits only wording/answers/reviewStatus" |
| Six cases, one round each | 9 cases across training+transfer, 4 stages | v2 wins |
| `docs/reference/ui-reference.html` (v2, clinical-doc CSS) | `ui-reference-v2.html` (v2.1, different palette/markup) | v2 wins — old file moves to `docs/planning/ui-reference-v1.1.html` as history |
| CLAUDE.md pair-review/scoring rules tied to `overall` | §8 pure-function result/summary rules | v2 wins; old rules removed, logged, replaced |
| No `fromStage` concept | `/next` accepts `fromStage` | v2 wins — additive to existing route |
| No content-governance (reviewStatus) rule | §6.3 review status gating | v2 wins — new CLAUDE.md rule |
| `docs/build-brief.md` v1.2 is canonical | v2 brief says v1 planning files are history, not instructions | v2 wins; v1.2 brief moves to `docs/planning/build-brief-v1.1.md` |

No conflict with starter constraints (`spec/README.md`, `fly.toml`,
`Dockerfile`, CI) — v2 keeps the same stack, deploy command and checks.

Bank validation (§6.1 rules, checked by hand): **0 errors** across all 9
cases, the knowledge card and 5 medicine cards. Safe to build against as-is.
