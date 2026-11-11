# 0004: Withhold answers until both submissions are durably stored

**Context.** The product argument (brief §2) depends on each checker forming
a genuinely independent judgement; seeing a partner's partial answer, or
even one's own per-field correctness, before both have committed would let
one checker's view leak into the other's.

**Options.** (1) Show per-field correctness or in-progress choices live.
(2) Reveal only submitted/not-submitted booleans until two immutable
submissions exist for a round, then reveal everything at once to both
sides.

**Decision.** Chose (2):
[`d588d9f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/d588d9f).
`src/serializer.mjs`'s `serializeRound()` returns only `mine.submitted` /
`partner.submitted` pre-reveal -- no answers, no per-field correctness, no
case answer key -- computing `reveal` only once `revealed_at` is set.
`src/repo.mjs`'s `submitAnswer()` sets `revealed_at` in the same
transaction as the second INSERT, so no intermediate "two submissions, not
revealed" state is ever observable. This is the one allowlist serializer
brief §7 asks for: every GET, POST response and SSE event goes through it,
so no second code path can leak a withheld field.

**Cost.** A learner gets no feedback on their own check until their partner
also commits, an open-ended wait mitigated by disclosing the limitation and
offering a new table. spec/submissions.test.ts's leak-nothing tests guard
against a regression here.
