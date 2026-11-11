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
