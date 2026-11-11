# 0005: Concurrency and idempotency enforced at the database, not the route

**Context.** Three races are named explicitly: two simultaneous joins for
seat B (brief §4), two simultaneous submissions completing a round (item 6),
two simultaneous `Next` clicks for one `fromRoundId` (item 8). Check-then-act
in a route is a classic TOCTOU race.

**Options.** (1) Check state in the handler, then act, trusting requests not
to interleave. (2) One transaction per operation, backed by database unique
constraints, so a losing request fails at the constraint.

**Decision.** Chose (2):
[`415e18d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/415e18d)
(join),
[`d588d9f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/d588d9f)
(submissions),
[`5f5c8af`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/5f5c8af)
(advance). Every state-changing repo function is a `db.transaction(...)`.
`UNIQUE (table_id, seat)` lets at most one concurrent join claim seat B; the
loser gets `{outcome: "full"}`. `UNIQUE (round_id, identity)` with `INSERT OR
IGNORE` makes a duplicate submission harmless and a changed repeat a no-op.
`advance()` checks the requested `fromRoundId` against the table's actual
current round in its own transaction, so a second `Next` for an
already-applied round returns the current snapshot, not a new one.

**Cost.** Each write path carries its own transaction and idempotency logic
rather than one shared lock: more code per operation, but each is provable
from its own constraint. Concurrent-request tests across spec/ guard
regressions.
