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
