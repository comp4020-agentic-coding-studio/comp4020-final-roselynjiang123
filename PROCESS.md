# Process

## What I built

Second Pair of Eyes is paired medication-check practice for nursing students ([README](README.md)). A second check adds something only when it is a second judgement, not the first one repeated. That idea also describes how I built it: each moment below is where an independent look changed the work, or its absence let a problem through.

## How I worked

A planning session (Claude) reviewed my plans and wrote the contract (`docs/build-brief.md`), the visual reference and a reference scoring implementation. Sonnet 5 built in rounds (1–4 for v1, A–E for v2), reporting after each. I set scope, read every report and own clinical wording, answers and review status (brief §6.3, §14). So the agent writing the code never wrote the rules it is checked against, at the cost of speed. Every round began in a fresh session reading CLAUDE.md, the brief and the evidence log, so state lived in files, not a compacted conversation. v1's plans predate any code ([`09fb08e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/09fb08e)); v2 began by mapping what to keep ([`194c5f5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/194c5f5)).

## Why this stack

Express, better-sqlite3 and plain HTML on one Fly machine; POSTs for writes, server-sent events for updates, since only the server pushes. Most of what the app guarantees is what must not travel or change, so each guarantee has one testable home:

- one allowlist serializer for every response and event, so hidden answers have no second exit (ADR 0004, [`d588d9f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/d588d9f));
- a fresh database snapshot per connection, not a replayed event log (ADR 0002, [`1145ef9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/1145ef9)), so no record of who saw what;
- one SQLite file, so signing, revealing and advancing are single transactions (ADR 0005): simultaneous signatures both count and reveal once, with no failover;
- anonymous cookies, not accounts (ADR 0003), so no recovery across devices.

ADR 0006 ([`5d76e2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/5d76e2a)) composes feedback from prewritten text: a model could answer what the bank never anticipated, but only with unreviewed clinical text.

## Moment 1: it passed, and it wasn't good

v1 met the three fixed requirements with a green suite. My housemate and I played it (S0): she understood how to play but not what it would do for anyone, and found it boring. Looking again as a nurse, I saw why. Everything it passed was verification, that it did what its spec said; none of it was validation, that it was the right thing to build ([Boehm, 1984](https://doi.org/10.1109/MS.1984.233702)). It compared text, and a ward check is a decision about a patient.

The obvious response was more delivery: more cases, a better stylesheet, animation. Agents make that cheap, and week 11 warned that AI automates delivery before discovery. I went back to discovery. v2 puts each medicine in a chart with a patient, allergies and an administration record, and asks for a next step with evidence, so "the records match" and "give it now" become different answers.

How I knew: not yet that it teaches, but that v2 fails in new ways. In an informal session (S1), non-nursing peers didn't see why each checks alone and doubted the medical content; those became fixes F1 and F2, queued with checks for S2 in `docs/validation/findings.md`. Before any session that counts, I committed what success means: six criteria in `docs/validation/plan.md` ([`2060972`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/2060972)) that I may annotate but not change.

## Moment 2: a primed checker of my own work

The planning session wrote v1's cases, reviewed them and kept a pattern (one error per case, in field order) that another AI assistant's review found. Rewriting them ([`20464a1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/20464a1)) fixed the pattern, not the review. A checker who knows what was meant sees what was meant: the primed check [Westbrook et al.](https://doi.org/10.1136/bmjqs-2020-011473) describe, in software.

So v2 puts independence in the harness instead of asking for more care. Scoring expectations come from a separate Python implementation written from the brief before Sonnet wrote its own (`tools/content/reference_scoring.py`). T06 and T07 must reproduce every example, and my prepared reply to a failing test was "Stop. Do not change the test or docs/content/scoring-fixtures.json." Their first run could only fail to load, because the modules didn't exist yet (`docs/process/spec-first-run-v2.txt`); [`4db8cc0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/4db8cc0) made them pass.

The limit is the app's own lesson: two implementations agreeing show the code matches my reference, not that the reference is clinically right. An AI-assisted desk review of the content found changes needed (`docs/validation/content-review.md`), so every case stays Draft, V1 still needs a nurse or pharmacist, and only I can change the badge (T11).

## Moment 3: corrections that landed in one place

A facts-only change record I had Sonnet compile (`docs/process/change-record.md`), read as a second checker of my own harness, found corrections that had reached only one of the three places good lives. The action log crit 10 rests on ([`fc58c0a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/fc58c0a)) was never in v1's contract, and the v2 brief left it out; I added it as invariant §4.11 with T18 ([`08957bf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/08957bf), [`5214c2a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/5214c2a)), but CLAUDE.md, rewritten earlier that evening, never gained it, and had no rule for two of the README's four claims. Round D's fixes were in code alone. The first v2 deploy crashed on boot because the Dockerfile never copied the case bank ([`7c642ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/7c642ef)). The waiting screen crashed, and the debrief's "Between you" column, the visible half of claim 2, was blank for the decision rows, until a headless browser opened the page ([`a078257`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/a078257)).

The obvious reading was that all this was fixed: tests passed and the app ran. But a fix that lives only in code is lost the next time someone rewrites it, as the action log nearly was. CLAUDE.md now has the missing rules ([`00a1c39`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/00a1c39)). How I knew they took: rerunning the record's consistency map leaves no row marked missing. The Round D fixes still have no tests of their own; writing them is the next piece of harness work.

## What each check can show

Each rung needs a different witness:

1. The code does what the spec says: 100 tests covering T01–T18.
2. It holds up live. Every crash above happened with all tests green, as weeks 5 and 6 warned. Now latency is 80 ms median and 226 ms worst over ten runs (`docs/evidence/latency-v2.txt`), and two tables survived a restart and a redeploy ([`cf1f8f2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/cf1f8f2), [`c33129e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/c33129e)). Tokens committed in [`660af8e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/660af8e) are revoked on the live database, not rewritten out of history ([`1c10652`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/1c10652)).
3. Strangers can use it, it teaches, its content is right: V1–V6. None is met yet.
4. It makes checking safer: not claimed. [Koyama et al.](https://doi.org/10.1136/bmjqs-2019-009552) find insufficient evidence even for real double checks.

## My position

Shirky and Sloan gave me permission to build for one group and skip the platform. Nursing education is turning to serious games and virtual wards ([Shao et al., 2026](https://games.jmir.org/2026/1/e86092)); I made the narrower cut, one step of a ward I rarely saw practised on its own, kept plain so the game wouldn't outweigh the practice. But Sloan's home-cooked app is judged at his own table. I'm not a nursing student learning to check, so the permission came with a duty: the people it is for must judge it, against criteria fixed before I saw their answers. That is the rule the app enforces between two checkers. Week 5 asked what value humans still bring to software. Here: choosing who judges whether the work is good, and deciding what counts before looking. What pleases me most as a developer is that this time the thing I built aims at a real need, and I know how to find out whether it meets it.
