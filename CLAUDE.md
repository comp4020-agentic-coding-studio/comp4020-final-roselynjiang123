# Your harness

Project: "Second Pair of Eyes", a two-person real-time record-comparison game.
Scope and contract: [build brief](docs/build-brief.md). Visual spec:
`docs/reference/ui-reference.html`. Marking viewports: 1920×1080 and 390×844.

## Product invariants

- MUST never reveal a round until both members have an immutable submission
  stored. judged: spec test 3, spec test 4.
- MUST reject malformed/missing/extra/inconsistent answers without disclosing
  correctness. judged: spec test 5.
- MUST treat agreement and accuracy as separate concepts; never relabel
  consensus as correctness or clinical safety. judged: spec test 7.
- MUST NOT let a changed resubmission overwrite an original submission; a
  duplicate identical submission is harmless. judged: spec test 6.
- MUST NOT let two Next requests for the same `fromRoundId` advance more than
  once. judged: spec test 8.
- MUST derive session identity from server-validated storage; NEVER trust a
  client-supplied participant ID. judged: spec test 2.
- MUST keep SQLite as source of truth, persisted before any SSE broadcast.
  judged: spec test 9, spec test 10.
- MUST survive a machine restart with no data loss for accepted submissions
  and incomplete tables. judged: spec test 9.
- MUST keep `/`, `/readme/` and `/healthz` passing exactly as the starter
  defines them throughout every round. judged: spec test 11, invariants.test.ts.
- NEVER serve case answer keys, case modules, or DB content as static assets
  or in initial HTML/GET payloads before reveal. judged: spec test 3, spec
  test 4.
- NEVER invent participant answers, user-test results, or literature claims
  in README/PROCESS/ADRs. judged: human review at each round's report.
- MUST follow `docs/reference/ui-reference.html` markup/class names/copy
  exactly; no new colours, fonts, images, or animation. judged: human review
  against the reference at both marking viewports.
- MUST log every agent mistake a test/check/student caught in
  `docs/evidence-log.md`, with the fix landing in `spec/` or here, not only a
  retry. judged: human review of docs/evidence-log.md.

## Carried forward from Assignment 2

Standards I hold the agent to regardless of the brief, not answers to any one
week's spec.

- **Never commit a red check state.** Run `pnpm check` before every commit; a
  failing check blocks the commit.
- **Scope discipline.** Speed over polish — correct and shippable beats
  polished. Do not add features the brief or spec doesn't call for.
- **Small, honest commits.** One logical change per commit, with a message that
  says what it does. These are the process evidence a crit and A3 read.
- **Banned filler phrasing:** delve, tapestry, embark, journey, unlock, "in
  today's", "rapidly evolving", "it's important to note", "navigate the
  complexities", game-changer, cutting-edge, "dive into", "deep dive", "a
  testament to", "whether you're".
