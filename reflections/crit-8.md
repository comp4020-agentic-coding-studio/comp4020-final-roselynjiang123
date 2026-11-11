# Crit 8 — It's alive

## What was the breakthrough that moved the work forward?

Deciding not to start building yet. I had a Chinese baseline plan and an English build brief, both now in `docs/planning/` (commit `09fb08e`). The baseline held my first definition of good: a check that protects each checker's independent judgement, makes disagreement and shared misses visible, and says honestly what it cannot prove. It came from ISMP Canada's definition of an independent double check, Koyama et al.'s review of the evidence for double checking, and Amber Case's principles of calm technology.

Before Sonnet wrote any code, I had a separate session review the plan for one question: could an agent actually carry this out? The review found nine problems the plan had hidden. The SQLite driver would not install under pnpm 10 without approving its build. Server-sent events on Fly needed compression switched off and a heartbeat. A marker in an incognito window would lose their identity overnight. Markers arrive with only a URL and would not know they needed two browsers. And the visual direction was all adjectives, which in crit 5 cost me eight rounds. Each problem became a line in the build brief, and Round 1 became a walking skeleton whose only job was to prove the risky parts: Express and SQLite on the Fly volume, `/healthz`, and the database surviving a machine restart (commit `a222b5e`).

The same week produced the first correction. An earlier session had converted the repo to Astro; Sonnet reverted it before reporting the conflict (`4a579a2`). The revert was right and the order was wrong, and ADR 0001 records both (`b845b43`).

## What did this work change about who I want to be as a software developer?

In nursing, giving the right medicine without doing the check is still a problem, because the check is what makes the next result right. I want to keep that habit in software: when an agent reaches the right result the wrong way, I treat it as a near miss, not a success. And I want to review the plan before the code, because the cheapest bug to fix is still a sentence.
