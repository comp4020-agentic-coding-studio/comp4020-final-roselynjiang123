# Crit 10 — Fly by instruments

## What was the breakthrough that moved the work forward?

Deciding what counts as a person here, then checking it where the page cannot bypass it. The app tells two browsers apart, not two humans: a server-issued cookie; a seat claimed only by an explicit Join, never by opening a link; one browser in two tabs counted as one checker; a third browser turned away from a full table. Each rule is checked on the server, never trusted from the request, and each is a test (ADR 0003). The spec-first review also found a promise nobody had tested: a nonmember could not read a table, but nothing proved they could not advance it (`97ed696`).

The logs came last, and that was the lesson. The brief I wrote never asked for them, so the first version could not say who did what. Now every accepted action writes one line: time, table, seat, action and round, with no cookie and no answer (`fc58c0a`), for example `2026-11-11T01:07:00.486Z | BIIJ | A | create | 1`.

The strongest evidence against my definition of good came from outside the logs, which only show people doing what the app allows. My housemate and I tried it first. She understood what it was for and how to play it, but not what it would actually do for anyone, and she found it boring. I looked at it again as a nurse and saw why: every check it passed was verification, proof that it did what its spec said, and nothing showed that a student would check medicines any better. The cases compared text, with no patient, no chart and no decision about what happens next. A separate review found that they also taught a pattern, one error each in field order; rewriting them with zero to two discrepancies (`20464a1`) fixed the pattern, not the problem. So good changed. The redesign I have planned puts each medicine back in a chart, separates “the records match” from “give it now”, and sets its validation criteria before any data is collected.

## What did this work change about who I want to be as a software developer?

I want to read what people actually did before I believe what I meant them to do. And I want to ask for a second pair of eyes on purpose, most of all on my own plans.
