# Test migration, Rounds A-B (84 -> 77 tests)

Produced for Round C step 4: every test present at the end of Round A
(`4db8cc0`, 84 tests, 13 files, confirmed by running that commit's actual
suite in a `git worktree`, not by estimating from the commit message) and
what v2 behaviour now covers it after Round B's rewrite (`53fb944`, 77
tests). Three categories below: same name kept, renamed/adapted (same
behaviour, v2 shape), and folded into a different test (same assertion,
moved).

No genuinely untested behaviour was found; every v1 test maps onto a
specific v2 test or an explicit fold. Nothing in this table needed
restoring.

## spec/submissions.test.ts (22 -> 11)

| v1 test (4db8cc0) | v2 coverage (current) |
|---|---|
| nonmembers cannot submit | same name, kept |
| GET snapshot before reveal has no answer key or reveal data | renamed "T01: GET snapshot before reveal has no answer key or reveal data" |
| the first submitter's own POST response leaks nothing about the partner | renamed "T01: the first submitter's own POST response leaks nothing about the partner" |
| own per-field scoring does not leak before reveal | folded into the T01 test above (`not.toMatch(/fullyCorrect\|outcome\|"TP"\|"FN"\|"FP"\|"TN"/)` is its last assertion) |
| rejects a missing field without revealing correctness | same name, kept |
| rejects an invalid value | HTTP-level case dropped; the underlying rule (bad field value rejected) is unit-tested in spec/submission-validator-v2.test.ts ("rejects an unknown field value"), new in Round A |
| rejects an extra field | same name, kept |
| rejects an inconsistent overall judgement | the `overall` field no longer exists (brief §7.1); replaced by "rejects the consistency rule: continue_checks with a mismatch" |
| accepts a valid answer regardless of correctness | renamed "accepts a well-formed but wrong answer" |
| a duplicate identical submission is harmless | same name, kept |
| a changed repeat cannot overwrite the original | same name, kept |
| concurrent submissions from both members create exactly two rows and one reveal | same test, name extended "...with the same result for both" |
| correct consensus: both agree and both correct | scoring-outcome tests moved to fixture reproduction: spec/round-results.test.ts's 5 examples (T06) and spec/session-summary.test.ts (T07/T08) reproduce docs/content/scoring-fixtures.json exactly, a stronger guarantee than the v1 hand-derived expectations these 4+5 tests asserted |
| incorrect consensus: both agree and both wrong | as above |
| divergent answers: different, one correct | as above |
| differing partial errors: different, both wrong | as above |
| a case with two discrepancies scores both fields (case 3) | as above (C6's two fixture examples cover two-discrepancy scoring) |
| category 1: both fully correct on a no-discrepancy case | as above |
| category 2: exactly one fully correct -- false flag | as above |
| category 3: both missed the same discrepancy | as above (C6_sharedMiss_agreed) |
| category 4: complementary finds | as above (C6_partialFind_vs_fullFind) |
| category 5: neither check was complete | as above (C1_falseMismatch) |

## spec/progression.test.ts (7 -> 9, net +2)

| v1 test | v2 coverage |
|---|---|
| nonmembers cannot advance | same name, kept |
| an unrevealed round cannot be advanced | same name, kept |
| advancing a revealed round starts the next case | renamed "...starts the next round" |
| concurrent Next requests for one fromRoundId advance once | same name, kept |
| a stale (already-advanced) round cannot be edited back | same name, kept |
| all six cases can complete without skipping, and the table completes | superseded by "T09: waiting -> training (6) -> training_summary -> transfer (3) -> completed, over real HTTP with two cookies" -- strictly more (the full 4-stage flow, not just 6 rounds) |
| advancing past the last case does not create a seventh round | renamed "...does not create an extra round" |
| *(new)* | "a request with neither fromRoundId nor fromStage is rejected" |
| *(new)* | "a request with both fromRoundId and fromStage is rejected" |

## spec/sse.test.ts (6 -> 6)

| v1 test | v2 coverage |
|---|---|
| nonmembers cannot open the SSE stream | same name, kept |
| a member's SSE stream sends a snapshot immediately on connect | same name, kept |
| SSE events before reveal carry no partner answers or answer key | renamed "T14: SSE events before reveal carry no partner answers, result or debrief fields" |
| a submission by one member pushes a fresh snapshot to the other member's SSE stream | same name, kept |
| forged identity in the request body does not bypass session identity | renamed "an unknown key in a submission body (e.g. a forged identity) is rejected, not silently dropped" -- v2's allowlist validator rejects any extra top-level key outright (brief §7.1), so the mechanism proving the claim changed from "it's accepted but ignored" (v1) to "it's rejected" (v2), not the claim itself |
| a write without a matching Origin is rejected | same name, kept |

## spec/restart.test.ts (2 -> 2), spec/actionlog.test.ts (1 -> 2)

Both kept their original test(s) under the same name, adapted for the v2
submission/snapshot shape (`result.A.fullyCorrect` instead of
`reveal.aFullyCorrect`, `table.stage` instead of `table.status`, bank-read
helpers instead of a fixed six-case answer constant). actionlog.test.ts
gained T18 in this round (Round C step 3), on top of its original test.

## spec/static-assets.test.ts (2 -> 2)

Both kept, renamed for v2 markers: "the case module and database are not
servable" -> "the bank file, fixtures, tests and database are not
servable" (T02), same mechanism (express.static only serves public/),
updated marker strings (bank field names instead of v1 case content).

## Net change and why it's not a coverage loss

11 fewer tests overall, concentrated entirely in submissions.test.ts (-11),
offset by +2 in progression.test.ts and +2 in actionlog.test.ts (T18, this
round). The reduction is real but not a loss: 9 of the removed
submissions.test.ts tests asserted scoring/pair-review outcomes by
hand-deriving the expected result inline (e.g. "both agree and both
correct" against one v1 fixed answer); their v2 replacements
(round-results.test.ts, session-summary.test.ts) assert the same category
of outcome against docs/content/scoring-fixtures.json's golden, externally
produced values instead -- fewer test functions, same or greater coverage
per brief §12's T06/T07 definitions ("every example... reproduces
exactly").
