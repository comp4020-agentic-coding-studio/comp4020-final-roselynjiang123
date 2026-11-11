# Evidence log

One line per agent mistake caught by a test, a check or the student:

`date | what went wrong | where the fix landed (file) | commit`

When a mistake reveals a missing invariant, the fix lands in `spec/` or
`CLAUDE.md`, not only in a retry.

2026-11-11 | Brief §9 items 2 ("or submit/advance") and 4 (static assets/
initial HTML never leak case content) had no automated test, even though
both were already satisfied by the implementation | spec/progression.test.ts
("nonmembers cannot advance"), spec/static-assets.test.ts (new file) | (this
round's tidy-up commit)
2026-11-11 | Round 1's stack reverted from Astro to Express before the
conflict was reported to the student, against brief §1's "explain the
concrete conflict before changing scope or architecture" (ADR 0001 already
recorded the revert itself, but not this process violation) | CLAUDE.md (new
rule, below) | (this round's tidy-up commit)
2026-11-11 | scripts/smoke-deployed.mjs started its timer after awaiting the
second submitter's own POST response, not before sending it; since the
server calls sse.notify() before that response is sent, the SSE push and the
old timer's start point raced back over two TCP connections in the same
tick, producing a near-zero/negative "median 0ms" that measured a race, not
network latency | scripts/smoke-deployed.mjs, docs/evidence/latency.txt
(before Round 4)
2026-11-11 | spec/restart.test.ts's two tests made setup calls (create, join,
submit) without asserting their responses, so a setup failure (e.g. every
route 404ing, which is what happens against the Round 1 skeleton) let
execution continue to the real assertions anyway -- proved by running these
tests in a `git worktree` of a222b5e, where they now fail with "table
creation should succeed: expected 404 to be 201" instead of passing
vacuously | spec/restart.test.ts (before Round 4)
2026-11-11 | CLAUDE.md rewritten for the v2 brief; removed because v2
supersedes them, not because they were wrong: (1) "MUST reject malformed/
missing/extra/inconsistent answers... spec test 5" -- the v1 answer shape
(5 fields + `overall`) no longer exists; replaced by the v2 "Submission
validation (brief §7)" rule (5 fields + `action` + `evidenceId`,
consistency rule against `continue_checks`). (2) "MUST treat agreement and
accuracy as separate concepts... spec test 7" and "MUST score every case
for its actual discrepancy count (0-5 fields)... spec test 7" -- v1's
match/mismatch pair-review scoring is replaced by v2's TP/FN/FP/TN +
decision-acceptance scoring against the bank's `answerKey`; replaced by the
v2 "Pure scoring and summaries (brief §8)" rule (fixtures-exact). (3)
"NEVER say or imply a pair review result makes a medication safe... judged:
spec test 7, human review of pair-review copy" -- v1's "pair review"
concept is replaced by v2's debrief/summary; the same never-claim-clinical-
effect constraint now lives in the product definition (brief §1) and is
enforced by the §14 never-do list and the brief §11 copy requirements,
rather than a standalone CLAUDE.md line, to fit the 100-line budget. (4)
"MUST follow docs/reference/ui-reference.html markup/class names/copy
exactly... human review against the reference at both marking viewports"
-- re-pointed, not dropped: the v2 "Interface (brief §10.1)" rule names the
same obligation against the new v2.1 reference and its `mock-only`
exclusion. (5) "MUST keep /, /readme/ and /healthz passing exactly as the
starter defines them... spec test 11, invariants.test.ts" -- not
restated as its own line under the 100-line cap; spec/invariants.test.ts is
unchanged and still runs under `pnpm check`, and T15 (brief §12) now covers
the same server-rendered-HTML requirement across more pages (`/readme/`,
`/guide/`, `/sources/`), so this is folded into "never commit a red check
state" plus T15 rather than named separately | CLAUDE.md (v2 rewrite,
Round A of E) | (this round's CLAUDE.md commit)
2026-11-11 | Two mistakes caught by checking the server's actual JSON shape
against what public/play.js reads (no headless browser available to render
and catch these visually -- Playwright needs sudo for missing shared
libraries, jsdom 30 doesn't execute `<script type="module">`): (1) the
"Before you start" knowledge card had no data to render on the
waiting_for_partner screen, since the serializer only put knowledgeCard
inside each round's frozen case snapshot, and no round exists before B
joins; (2) the status strip's progress dots and "Case n of 6" label used
the round's global index (1..9 across training+transfer) against a fixed
6-case total, which would mislabel every transfer round (e.g. round 7/9
shown as "case 7 of 6", every dot "done") | src/serializer.mjs (top-level
`knowledgeCard` field), public/play.js (`phasePosition()`) | (Round B of E
commit, five-screens)
