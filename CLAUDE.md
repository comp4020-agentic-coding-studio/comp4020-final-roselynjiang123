# Your harness

Project: "Second Pair of Eyes", a two-person real-time paired medication-check teaching game for nursing students (v2: training + transfer phases). Scope and contract: [build brief](docs/build-brief.md) v2. Visual spec: `docs/reference/ui-reference.html` v2.1. Marking viewports: 1920×1080 and 390×844. v1.1 material lives in `docs/planning/` as history, not instructions (migration: `docs/process/v2-implementation-map.md`).

## Engine invariants (brief §4, unchanged since v1 — keep them all passing)

- MUST derive session identity from server-validated storage; NEVER trust a client-supplied participant ID. enforced: T03.
- MUST enforce exactly two seats per table; a GET never claims a seat; a third identity cannot join; no seat replacement. enforced: T01, T03.
- MUST reject a state-changing write whose Origin doesn't match the request's own host (same-origin writes only); after every committed write, and on each SSE (re)connect, send a fresh authorised snapshot carrying a monotonically increasing table version; clients never roll back to an older version. enforced: T14.
- MUST keep one allowlist serializer building every GET, POST response and SSE payload. Private responses are `Cache-Control: no-store`. enforced: T01, T02.
- MUST treat submissions as immutable once accepted: a duplicate identical POST is harmless; a changed repeat is rejected; concurrent submissions create exactly two rows and one reveal. enforced: T05.
- MUST reveal a round only once both submissions are durably stored. enforced: T01, T05.
- MUST accept `fromRoundId` or `fromStage` on `/next`; concurrent identical requests advance exactly once; stale requests never skip or mutate history. enforced: T05, T09.
- MUST keep SQLite as source of truth, persisted before any SSE broadcast; restarts and redeploys lose nothing accepted. enforced: T13, T14.
- NEVER log cookie tokens or full submitted answers. enforced: T16.
- NEVER serve the bank file, fixtures, test files, the database, or any answer key/accepted pair/feedback/result/debrief as a static asset or in initial HTML before reveal. enforced: T01, T02.
- MUST write exactly one server-side action-log line per accepted action, including v2's stage changes (`summary`, `transfer`, `complete`); a rejected request writes no line; never log a cookie, session, answer or evidence value on that line. enforced: T18.

## Working definition of good (brief §1)

- MUST make "who found what" visible: the debrief separates agreement from accuracy and names each checker's complementary finds and shared misses, over signed answers that never change. enforced: T06.
- MUST keep "the records match" separate from "give it now": every case ends in a next step with evidence, and an all-match record may still require pause/clarify, not just continue. enforced: T04, T06.

## Submission validation (brief §7)

- MUST require all five fields plus exactly one `action` and one `evidenceId` from the bank's global lists; reject missing, extra or unknown keys/values without revealing the reference answer; reject `action: "continue_checks"` whenever any field is `mismatch` (self-consistency, not correctness). enforced: T04.

## Pure scoring and summaries (brief §8)

- MUST implement round results, the debrief composer and session summaries as pure functions with no I/O, reproducing every example in `docs/content/scoring-fixtures.json` exactly (sum counts, never average per-case percentages; zero denominator → "No opportunity this time"). enforced: T06, T07, T08, T17. The fixtures file is read-only to the agent.

## Review status / content governance (brief §6.3)

- NEVER change `reviewStatus`, `reviewerRole`, `reviewedAt` or `sourceCheckedAt` in `content/case-bank.v2.json`; only the student edits clinical wording, answers and `reviewStatus`. The agent may fix JSON syntax or add non-clinical fields the code needs, and must report doing so.
- MUST fail start-up validation when `educator_reviewed` lacks `reviewerRole`/`reviewedAt`, or `source_checked` has a claim whose only source says "TO VERIFY". enforced: T11, T12.
- MUST freeze each round's complete case snapshot at creation; editing the bank afterward never changes an existing round's content, answer or debrief; a withdrawn version shows its notice on old rounds. enforced: T10.

## Interface (brief §10.1)

- MUST copy the CSS inside `<style id="app-css">` of `docs/reference/ui-reference.html` verbatim into the app stylesheet; never `<style id="mock-only">` or the mock state switcher.
- MUST reuse the reference's markup, class names and English copy for every state (`start`, `waiting`, `checking`, `signed`, `debrief`, `summary`, `transfer-intro`, `end`, `sources`); compose a missing state only from existing classes and report it. judged: human review against the reference and `docs/reference/shots/` at both viewports.
- MUST serve `/`, `/readme/`, `/guide/` and `/sources/` as server-rendered HTML with their headings present before JavaScript runs. enforced: T15.

## §14 — never do

Invent or edit clinical facts, answers or review status; mark content reviewed; invent sources, page numbers or dates; write the README/PROCESS/crit argument, user-test results or motivations; claim a deployment, measurement or test passed without observing it; weaken a test to pass (stop and explain instead); add anything from §2 (live/runtime AI, accounts, teacher dashboard, chat, leaderboards, timers, badges, random/generated cases, drug encyclopedia, ward map/health bars, pixel body fonts, post-reveal resubmission, spectator mode, replacing absent players, non-independent mode, cross-session inference, PDF service, new infrastructure).

## Process, evidence and Assignment-2 carryover

- NEVER change stack or architecture before reporting the concrete conflict and getting the student's answer. ADR 0001's stack revert was carried out first and reported after; that was the wrong order. judged: human review of ADRs and evidence-log against commit order.
- MUST log every agent mistake a test/check/student caught in `docs/evidence-log.md`, fix landing in `spec/` or here, not only a retry.
- **Never commit a red check state**: `pnpm check` before every commit.
- **Scope discipline**: do not add features the brief or spec doesn't call for. **Small, honest commits**: one logical change, message says what.
- **Banned filler phrasing:** delve, tapestry, embark, journey, unlock, "in today's", "rapidly evolving", "it's important to note", "navigate the complexities", game-changer, cutting-edge, "dive into", "deep dive", "a testament to", "whether you're".
