# Crit 9 — All at once

## What was the breakthrough that moved the work forward?

Realising that for this app the real-time question is what must not travel. The obvious reading of the week was to make everything live. But a double check is only independent while neither checker knows the other's answer, so the decision I wrote down (ADR 0004) splits the state in two. Whether each checker has signed reaches the partner within about a second (median 47 ms, max 202 ms over ten scripted runs on the live app; `docs/evidence/latency.txt`). Choices, correctness (even your own) and the answer key travel only once both submissions are stored, and then to both at once. The option I rejected was showing in-progress choices or per-field correctness live: it feels more together, but one checker's view would leak into the other's. The second submission and the reveal are written in the same transaction, so there is never a moment when both have signed and nothing is shown. The cost is real: nobody gets feedback until their partner commits, and if a partner leaves, the wait has no end; the app says so and offers a new table.

What made the decision hold was enforcing it in one place. Every response, GET, POST or event stream, goes through one allowlist serializer ([`d588d9f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/d588d9f)), and the tests read the actual payloads, including the first signer's own response, for anything that should still be hidden. Reconnects get a fresh snapshot from the database rather than a replay (ADR 0002, [`1145ef9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/1145ef9)).

The redesign I have planned keeps the rule. Its written debrief, summaries and new transfer cases are specified to wait for both signatures too, so it grows the list of what is held back rather than changing the decision.

## What did this work change about who I want to be as a software developer?

I used to think of real-time as a speed problem. Now I think the most important real-time decision is what to hold back, and who decides. I want to design what people must not see yet as carefully as what they can see now.
