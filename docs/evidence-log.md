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
2026-11-12 | `public/play.js`'s `render()` crashed on the `waiting` state
with `TypeError: Cannot read properties of undefined (reading 'id')`: round
1 doesn't exist until B joins (`src/repo.mjs` only creates it once both
seats are claimed), so `snapshot.rounds[snapshot.rounds.length - 1]` is
`undefined` while waiting, but `render()` unconditionally read
`current.revealed`/`current.mine.submitted` before checking
`seatsBothJoined`'s `nextMode = "waiting"` branch separately from the branches
that actually need `current`. Pre-existing (present at HEAD before this
round, not introduced by Round D's CSS/markup work) -- never caught earlier
because no headless browser was available (jsdom doesn't execute `<script
type="module">`) until this round installed Playwright + Chromium and
`scripts/screenshot-v2.mjs` loaded `/play/:id` for the first screenshot.
Fixed with optional chaining on every `current.*` read reachable before
`seatsBothJoined` is true | public/play.js (`render()`) | (Round D of E
commit, screenshot script + play.js fix)
2026-11-12 | `composeDebrief`'s comparison table (brief §8.2 step 2) showed
raw `action`/`evidenceId` strings ("continue_checks", "total_amount")
instead of the bank's short labels, had no ✓/✗ match marks on any cell
(U09: "meaning never by colour alone" needs a mark, not just a background
tint), and the Next step/Evidence rows' Reference and Between you columns
were always `null` -- so a screen reader or a printed page showed nothing
there at all. Caught by screenshotting `debrief` for the first time
(Playwright now available) and comparing against
`docs/reference/shots/debrief-1920x1080.png`, which shows labelled,
marked, fully-populated rows. Fixed `comparisonTable()` to resolve labels
from `bank.actions`/`bank.evidenceOptions`, mark each seat cell with its
own actionOk/evidenceOk, and fill Reference (every accepted option, joined
with "or", for cases with more than one accepted pair -- the brief doesn't
name a single "the" reference answer for those) and Between you (the pair's
existing `decisionCoverage`) for both decision rows. Also had to add
`actions`/`evidenceOptions` to `src/serializer.mjs`'s `caseSnapshotBank()`,
which was already freezing them per round but not forwarding them to
`composeDebrief` | src/debrief.mjs (`comparisonTable()`), src/serializer.mjs
(`caseSnapshotBank()`), spec/no-network.test.ts (test bank shape updated to
match), public/play.js (`comparisonTableHtml()`/`seatCellHtml()`) | (Round D
of E commit, debrief comparison table fix)
2026-11-12 | `/sources/`'s review-status legend showed the literal
placeholder string `Reviewed by {role}, {date}` instead of a filled example,
unlike the reference's "Reviewed by a registered nurse, 2026-11-20" --
`src/pages.mjs` had the template syntax left in a string with no
interpolation to fill it. Caught by screenshotting `/sources/` for the
first time and comparing against
`docs/reference/shots/sources-1920x1080.png` side by side | src/pages.mjs
(the legend's third `<span class="review ok">`) | (Round D of E commit,
visual-contract commit)
2026-11-12 | First real deploy attempt crashed the Fly machine on every
boot (`ENOENT: no such file or directory, open '/app/content/case-bank.v2.json'`,
then the same for `docs/guide.md` once the first was fixed): the Dockerfile's
runtime stage never `COPY`d `content/` or `docs/guide.md` into the image,
only `src/`, `public/` and `README.md`, even though `src/bank.mjs` and
`src/server.mjs`'s `/guide/` route both `readFileSync` them at start-up/
request time from `repoRoot` (`/app` in the container). `pnpm check` can't
catch this: it runs the spec against a locally-spawned `node src/main.mjs`
from the repo root, where both paths already exist on disk, so the gap only
shows up against the actual built image. Caught by watching `mise exec --
flyctl deploy`'s first attempt crash-loop and reading `flyctl logs` |
Dockerfile (two added `COPY` lines) | (Round D of E deploy commit)
2026-11-12 | `scripts/smoke-deployed.mjs` still posted the v1 submission
shape (`{ answer: { patient: "match", ..., overall: "match" } }`) to the
v2 `/submissions` route, which the v2 validator rejects outright (needs
`fields`/`action`/`evidenceId`) -- the script was never updated when the
engine moved to v2, so every run would have failed its first submission
with a 400 before reaching the part that measures latency. Caught before
running it against the real deployment, by reading the route's actual
validator (`validateSubmissionV2`) against the script's hardcoded body.
Fixed to read case C1's own `answerKey` from the live bank and post its
first accepted pair instead of a hand-written v1 constant | scripts/
smoke-deployed.mjs | (Round D of E deploy commit)
2026-11-12 | S1 (docs/validation/findings.md) found that non-nursing
playtesters didn't understand why two people check independently: the
waiting screen said *what* happens (don't tell your partner until you've
both signed) but never *why* hiding the answer matters, so F1 adds the
finding's exact "Why check on your own first?" text above Lee's prebrief
on the waiting screen, and above "What you'll practise" on the start page
(the only two places a participant is told to check alone before
anything is hidden from them) | public/shell.js (`WHY_CHECK_ALONE`),
public/landing.js, public/play.js (`renderWaiting()`) | (Round D of E F1
commit)
