# 0002: SSE delivers fresh snapshots, not a replayed event log

**Context.** Brief §7 wants updates in about a second, clean reconnects, no
rollback to stale state, and SQLite (not the SSE subscriber list) as the
single source of truth.

**Options.** (1) An append-only event log per table, replayed from a
client-supplied cursor on reconnect. (2) On every connect and every
`sse.notify()`, read the current authorised snapshot from SQLite and send
that, with nothing to replay.

**Decision.** Chose (2):
[`1145ef9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/1145ef9).
`GET /api/tables/:id/events` authorises membership, sends one snapshot on
connect and one more on each `notify()` after a committed write
(`src/sse.mjs`, `src/server.mjs`). `src/repo.mjs` persists before any
`notify()` call, so a push can never describe a change that isn't yet
durable. `tables.version` (migration `0002_table_version`) lets a client
discard a stale response arriving after a newer one.

**Cost.** A reconnect after a missed update reconstructs the whole snapshot
rather than replaying just what was missed. Negligible at this table size,
and it buys the simpler invariant the brief names: "this avoids an event
replay log." No ordering or gap-detection logic exists to get wrong.
