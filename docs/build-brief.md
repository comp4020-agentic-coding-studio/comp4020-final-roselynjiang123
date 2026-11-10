# Second Pair of Eyes — Build Brief
## MVP v1.1: implementation contract

Repo location: `docs/build-brief.md`. Visual reference: `docs/reference/ui-reference.html`.
This brief is planning material, not the student's README or PROCESS. The product UI is English; the student may discuss decisions in Chinese.

**v1.1 changes (scope unchanged):** work in four rounds and stop after each (§10); newcomer try-it box on `/readme/` and `/` (§4a); two separate record cards with a fixed label-style field order (§5, §8); exact UI reference, no generated images (§8); deployment gotchas (§7a); spec-first run, evidence log, ADRs and a deployed latency script (§9).

## 1. Your task and first action

Build a deployed, two-person, real-time nursing education game with persistent state. It explores independent checking, disagreement and the difference between consensus and accuracy.

Work only on the round the student pastes. Stop at the end of each round and report as that round asks.

First inspect the actual repository: applicable AGENTS.md/CLAUDE.md, package.json/lockfile, fly.toml, Dockerfile, spec/README.md, CI, README/CLAUDE/PROCESS templates and existing evidence tooling. Preserve shipped checks, package-manager conventions and the deployment contract. Confirm the marking viewport sizes from the starter (expected 1920×1080 and 390×844); do not invent others. Do not delete starter constraints to make checks pass.

Ask only about material contradictions or genuinely missing access; make routine implementation decisions within this brief and list them in your report. If repository constraints conflict with this plan, explain the concrete conflict before changing scope or architecture.

Use the course-provided Fly app `comp4020-final-roselynjiang123` and its volume. Deploy with `mise exec -- flyctl deploy --remote-only --ha=false -a comp4020-final-roselynjiang123`; live URL `https://comp4020-final-roselynjiang123.fly.dev`. Run every flyctl command through `mise exec --` (that is what supplies the token). The token lives in the gitignored `mise.local.toml`: never open, print, copy or commit that file. Never claim a deployment succeeded without observing it. Do not create an unrelated hosting project.

## 2. Product argument and learning goals

Working definition of good: the system protects the opportunity to form an independent judgement, makes disagreement and shared mistakes visible, and describes its limitations honestly.

Learners should be able to compare five supplied fields, explain why another checker's answer is withheld, and distinguish agreement, record accuracy and clinical safety. These are intended outcomes, not established educational effects.

This is a record-comparison learning game inspired by nursing checks. It is not a clinical tool, validated training assessment or experiment proving that double checking improves patient outcomes. The selected five fields are a teaching scope, not an exhaustive list of medication responsibilities.

Display concise copy: “Educational simulation. All records are fictional. Compare the supplied records; do not use this game to make clinical decisions.” All case names and doses are training placeholders. Require no personal or health data.

## 3. Locked feature scope

Required: server-issued anonymous identity; a two-seat table and invitation link; six authored cases; five field judgements and one consistent overall judgement; independent immutable submission; automatic joint reveal; explanatory feedback; progression; persistent history; reconnection recovery; meaningful integration tests; server-rendered full README with a try-it box.

Do not add: accounts, nickname input, chat, public leaderboard, time pressure, badges, images, generated art, icon sets, animation, drag-and-drop, hospital maps, real medicine data, uploads, AI-generated cases, model or image API calls, non-independent mode, A/B statistics, a medication-release action, post-reveal resubmission, spectator mode, presence tracking or automatic replacement of absent players. No research-note.md (COMP4020).

## 4. User journey

1. `/readme/` contains the full current README in server-rendered HTML with its headings, below the try-it box (§4a), and links to Play at `/`. Root introduces the task and creates a table; root also offers My tables for the current identity.
2. Server creates a high-entropy opaque browser-session cookie when needed. Display Checker A and Checker B; no user-entered names.
3. Creating a table claims seat A and returns an unguessable invitation URL with a Copy invite link button. A second browser visits the URL and explicitly clicks Join to claim B. A GET must not consume a seat. Until joined, do not return private table state. A full table shows “This table already has two checkers” and offers a new table.
4. Both members can then check the first case. Either may submit first. Before two members exist, show waiting with the invite link, not a fake player or a solo mode.
5. Show the Order card and the Prepared record card (§5), each with complete patient, medicine, dose, route and scheduled-time fields.
6. Each field requires an initially unselected radio: Matches / Does not match. Also require Records match / Discrepancy found. Overall must be consistent with the learner's own five selections. Validate on the server; reject malformed, missing, extra or inconsistent answers. This validation must not disclose correctness.
7. Allow editing before submission. After the server accepts a submission, it is immutable. Partner sees only Submitted / Not submitted, not choices or partial correctness. No per-field feedback until both submit.
8. Once both submissions are durably stored, reveal automatically to both clients. Show both answers, field-by-field expected comparisons, explanatory text, agreement and each learner's full-answer accuracy as separate concepts.
9. Retain the reveal until either member clicks Next case. The request names the revealed round. Concurrent clicks for the same round must advance only once. Do not clear the reveal by a timer.
10. Repeat for six cases. Show a calm final review: completed cases, each learner's fully correct cases as a count (e.g. 4/6), and cases both missed. Preserve per-round review and link to My tables. Do not present results as clinical competence or research evidence.

Every accepted submission is persisted immediately; incomplete tables must also survive restarts. A returning member with the same cookie can resume or read completed rounds. New browser identities cannot take over occupied seats. If a partner leaves, retain the table and explain that they can return with the same browser; offer creating a new table. Clearing cookies loses access to the old identity in this MVP; disclose this limitation briefly.

### 4a. Newcomer instructions

Markers arrive with only the URL and start at `/readme/`. Above the README article, server-render a box titled “Try it in two browsers” (it is page chrome, not part of README.md, so it does not count toward README words). Use the exact copy in the UI reference:

1. Open this site in two Chrome profiles or two browsers. An incognito window works but forgets who you are when it closes; use normal profiles if you want to come back tomorrow.
2. In the first, choose Play, then Create a table, then Copy invite link.
3. Open the link in the second and choose Join. Check each case on your own; both answers appear once you have both submitted.

`/` shows the same three steps in short form.

## 5. Case content: implement exactly six

Use a server-only case module. Case IDs and pre-reveal headings must be neutral (e.g. Case 1), not “wrong dose”. Fixed order is required for v1; do not add randomisation infrastructure.

Every order uses:

| Field key | Label | Display value |
|---|---|---|
| patient | Patient | SIM-014 |
| medicine | Medicine | Training Medicine A |
| dose | Dose | 0.5 training units |
| route | Route | Oral (by mouth) |
| time | Scheduled time | 09:00 |

Prepared record starts as an exact copy, with the following overrides:

| Case | Override | Expected mismatches | Post-reveal teaching point |
|---|---|---|---|
| 1 | none | none | Checking does not mean there must always be a discrepancy. |
| 2 | patient = SIM-041 | patient only | Compare the complete identifier, not its general appearance. |
| 3 | medicine = Training Medicine B | medicine only | Compare the full supplied label, not familiarity. |
| 4 | dose = 5 training units | dose only | The decimal change makes a tenfold difference in these fictional training values. |
| 5 | route = Intravenous (into a vein) | route only | Compare the stated routes; this does not establish appropriate routes for a real drug. |
| 6 | time = 21:00 | time only | Compare scheduled record times; no clinical administration window is modelled. |

Display order (fixed for all six cases): the Order card lists patient, medicine, dose, route, time. The Prepared record card lists the same five labelled fields in label order: medicine, dose, route, patient, time. The check form follows the Order card's order. This mirrors real documents with different layouts; it is not a per-case trick, and every field is always visible and labelled.

Provide a short visible glossary (collapsible) for the five field names and the two route terms. Do not tie scheduled times to the user's clock. Do not ask learners to calculate clinical doses.

Store per-round immutable snapshots of materials, expected field comparisons and explanations. History must not change when future source cases are edited. Snapshot answer keys remain server-only until reveal. Do not serve this module, database, test fixtures or repository files as static assets. The source repository is inspectable by design; the claim is protection against application disclosure, not secrecy from someone who reads public source or compares the records themselves.

## 6. State and correctness

Table states: waiting_for_partner → playing → completed. Round state is derived from accepted submissions: checking (zero), waiting_for_partner_submission (one), revealed (two). A client receives its own submission status and the partner's status, but no submitted answers or scoring until revealed. Local unsubmitted selections stay local.

Only a round with two immutable submissions is revealed. Divergent answers reveal for educational discussion; they are not overridden or reconciled by resubmission. Seeing the partner's answer ends the independent phase permanently for that round.

Compute expected field comparisons from the frozen materials; fully correct means all five field choices and the consistent overall judgement are correct. Agreement means the two complete answer objects match, not merely that both chose “Discrepancy found”.

Keep agreement and accuracy separate. If both agree but are wrong, say “You agreed, but the records show a different result” and explain the fields. If neither is fully correct but their errors differ, show that too. Never manufacture a participant answer, force a failure or label consensus as medication safety.

Advance only from a revealed current round and only when another case exists. Next requests contain `fromRoundId`. An already-applied advance may return the current snapshot; it must never skip another case. Requests to submit to an old or revealed round cannot mutate history. Final review remains after case 6.

## 7. Minimal architecture

- Node.js + Express + better-sqlite3; plain HTML/CSS/JS. Use a supported Node LTS compatible with the repository and the native SQLite dependency; pin runtime and dependencies. No frontend framework, ORM or build pipeline unless the starter already requires one. pnpm remains the course entry point.
- One application process, one Fly Machine, one mounted persistent volume, following starter comments. `DATABASE_PATH` points inside the actual volume mount in production. Use separate local/test paths. Never silently fall back to an ephemeral production database.
- Ordinary authenticated JSON POST for changes; SSE for server-to-browser snapshots. No parallel polling subsystem in v1.
- SQLite is the source of truth. Persist before broadcasting. In-memory SSE subscriber lists are delivery plumbing, not durable game state.
- On every SSE connection/reconnection, authorise membership and send a fresh database-derived snapshot filtered for that identity. Subsequent committed changes broadcast fresh filtered snapshots. This avoids an event replay log. Include monotonically increasing table versions; clients must not roll back on an older response arriving late.
- Show reconnecting status. EventSource retry alone does not restore business state; snapshot reconstruction must do that. Clean up closed subscriptions and use a lightweight keepalive. Do not implement online presence.
- Target visible updates within about one second on a normal deployed connection; measure it (§9 item 12). Do not claim a guarantee on arbitrarily slow networks.

Suggested durable entities: sessions; tables; table_members; rounds with frozen case data and reveal timestamp; submissions. Exact filenames and SQL layout are implementation choices. Enforce unique (table, seat), unique (table, identity), unique (round, identity), and a single round per table/index. Use transactions for competing joins, recording/revealing submissions and progression. Protect stale requests and double clicks at the server/database level.

Session token is server-generated and validated against persistent storage; never accept a client-supplied participant ID as authority. Use HttpOnly, SameSite=Lax and production Secure cookies. Add simple same-origin protection for writes and bounded JSON bodies. Do not log cookie tokens or full submitted answers. Private responses are `Cache-Control: no-store`. Use one explicit allowlist-based serializer for GET, POST and SSE so hidden data cannot leak through a second code path.

An invitation admits a second browser identity; it is not verification of a second human. Same-browser tabs share one identity. A person can still create another identity in a separate profile or communicate offline. State these limits rather than building identity verification.

Suggested endpoints (adapt names if needed without changing semantics):

- GET `/api/me/tables`: current identity's table list.
- POST `/api/tables`: create and claim A.
- POST `/api/tables/:id/join`: claim B or resume existing membership.
- GET `/api/tables/:id`: filtered current snapshot plus revealed history.
- GET `/api/tables/:id/events`: authorised SSE snapshot stream.
- POST `/api/tables/:id/rounds/:roundId/submissions`: validated immutable submission.
- POST `/api/tables/:id/next`: body contains `fromRoundId`.
- GET `/healthz`: 200 when the database opens and a trivial query succeeds; reveals no paths or data.

### 7a. Deployment gotchas (read before coding)

- pnpm 10+ does not run dependency build scripts by default, and better-sqlite3 needs its install script. Approve it with the mechanism for the repo's pnpm version (e.g. `pnpm approve-builds`, which records `onlyBuiltDependencies`) and commit that config so the Docker build gets the native binding. `/healthz` on the deployed app proves it loads. If the native module still fails in the course image after one honest attempt, switch to built-in `node:sqlite` (Node ≥ 22.13) behind the same small DB module and record why in an ADR. Do not spend a round on native builds.
- Read the volume mount path from fly.toml `[mounts]` and the port from `internal_port`; listen on `0.0.0.0` and that port. In production, refuse to boot if `DATABASE_PATH` is not inside the mount.
- SQLite pragmas: `journal_mode = WAL`, `busy_timeout = 5000`, `foreign_keys = ON`. Migrations are idempotent and versioned; never drop or reset on boot. Close the database on SIGTERM/SIGINT (Fly stops idle machines).
- Behind Fly's proxy set `app.set('trust proxy', 1)`; set the cookie's Secure flag only in production.
- SSE route: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`; call `res.flushHeaders()`; send `retry: 2000`; no compression middleware (simplest: none in the app); a `: keepalive` comment every 20 s; remove the subscriber on `req.on('close')`.
- Same-origin write check: compare the `Origin` header's host (fallback `Referer`) with the request host. Tests and the smoke script send a matching Origin.
- Never commit or print the Fly token; confirm `mise.local.toml` is gitignored (`git check-ignore mise.local.toml`) before the first commit. Status and logs: `mise exec -- flyctl status -a comp4020-final-roselynjiang123`, `mise exec -- flyctl logs -a comp4020-final-roselynjiang123`.
- Keep the starter's `/readme/` rendering and its shipped checks; extend them rather than replace them.

## 8. Visual and interaction design

Follow `docs/reference/ui-reference.html` exactly. It is the numeric spec; do not reinterpret it.

- Copy the CSS inside `<style id="app-css">` verbatim into `public/style.css`. Do not copy `.ref-*` rules or the reference-only frames and labels.
- Reuse its markup structure, class names and UI copy for each state: landing, join, waiting for partner, checking, submitted/waiting, revealed, agreed-but-wrong callout, final review, My tables, `/readme/`. Where the reference has text, use that text.
- No new colours, fonts, shadows, images, icon sets, generated art or animation. The only icon is the inline SVG favicon in the reference. Do not call the image-generation API.
- Order and Prepared record are two separate cards: side by side at ≥ 760 px, stacked below. The check form sits below both cards.
- At 390×844 there is no horizontal page scroll; the reveal table turns into stacked rows (the reference CSS does this via `data-label`).
- Native labelled controls, semantic headings, visible keyboard focus, readable contrast and text labels (“Correct”, “Incorrect”, “Submitted”) in addition to colour.
- Preserve current local choices and keyboard focus during status refreshes. An unsubmitted draft may disappear on full reload; an accepted submission may never disappear.
- One polite `aria-live` region announces partner joined, partner submitted and reveal; never keepalives. Never display “Submitted” before a successful server response. Errors preserve unsent choices and offer retry; duplicate retries must not create another record.

If a state the brief needs is missing from the reference, compose it only from existing classes and say so in your report.

## 9. Harness and required checks

Turn the product invariants into a concise CLAUDE.md and real tests in spec/. Use node:test, or the starter's required test setup. Preserve and extend `pnpm check` and `pnpm check:evidence` according to spec/README.md. Do not replace them with no-op scripts or fabricated evidence. Use isolated temporary databases and real HTTP requests for integration tests; close SSE streams and server handles reliably.

CLAUDE.md: at most about 80 lines. Each invariant is a MUST/NEVER rule naming the spec test that enforces it, or marked “judged: <how>”. It links this brief for scope and lists the marking viewports.

Minimum meaningful coverage:

1. Same identity in two tabs cannot occupy both seats; third identity cannot join a full table. Concurrent joins produce one B.
2. Nonmembers cannot read snapshots, history or SSE, or submit/advance. Forged IDs in bodies do not bypass session identity.
3. Before reveal, inspect actual GET, POST and SSE payloads, including the first submitter's response. No partner selections, correctness, expected mismatch fields, answer key or explanation leaks. Own per-field scoring must not leak either.
4. Static assets and initial HTML do not include server-only case keys, revealing case titles or database content. Do not implement hiding with CSS.
5. Missing/invalid/inconsistent selections are rejected without revealing the correct answer. Valid answers are accepted regardless of correctness.
6. A duplicate identical submission is harmless; a changed repeat cannot overwrite the original. Concurrent submissions create exactly two rows and one reveal; both members see the same final result.
7. Correct consensus, incorrect consensus, divergent answers and differing partial errors produce correct separate agreement/accuracy feedback. Use deliberate test answers; the live game never fabricates player behaviour.
8. Concurrent Next requests for one `fromRoundId` advance once. Unrevealed or stale rounds cannot be edited, and all six cases can complete without skipping.
9. Close and restart the actual app process with the same SQLite file and cookies. An incomplete game resumes and completed records remain. Case snapshots preserve old explanations after a changed fixture.
10. SSE reconnect returns the latest authorised state after a missed update or restart; status updates do not expose hidden fields.
11. `/` responds; `/readme/` contains the try-it box and the full rendered README with its headings in the original server response, not only after JavaScript.
12. `scripts/smoke-deployed.mjs <url>` (manual, not in `pnpm check`): two independent cookie jars create and join a table, both submit case 1 with a matching Origin, and it measures milliseconds from the second submission's POST response to the first client's SSE reveal snapshot. Ten runs; print median and max. Save the output to `docs/evidence/latency.txt`.

Process evidence (facts only, no first-person reflection):

- **Spec-first run.** Before implementing the game, write tests 1–8 and 11, run them against the skeleton and save the full failing output to `docs/process/spec-first-run.txt`. Commit tests together with the code that makes them pass; never commit red.
- **Evidence log.** `docs/evidence-log.md`: one line per agent mistake caught by a test, a check or the student: `date | what went wrong | where the fix landed (file) | commit`. When a mistake reveals a missing invariant, the fix lands in spec/ or CLAUDE.md, not only in a retry.
- **ADRs.** `docs/adr/`: 0001 stack, 0002 SSE with fresh snapshots, 0003 anonymous cookie identity, 0004 withhold answers until both submit, 0005 concurrency and idempotency. Each: Context, Options, Decision, Cost; at most 200 words; cite commits. The student reviews and may rewrite them.

Human verification (done by the student): two independent Chrome profiles from the URL, both marking viewports, keyboard path, no-refresh synchronisation, a throttled connection, next-day return. Automated tests cannot prove learning, comfort or clinical benefit; never invent participants, trials or feedback.

## 10. Rounds and evidence

Stop after each round and report. Commit when coherent verified changes exist, with `pnpm check` green before each commit; do not manufacture a fixed count, fabricate earlier crits or backdate commits.

1. **Round 1:** inspect the starter; confirm the placeholder the student already deployed is live; write CLAUDE.md v1 and the evidence-log/ADR scaffolding; build a walking skeleton (Express + SQLite on the volume + `/healthz`, starter `/` and `/readme/` still passing); deploy; confirm the database survives a machine restart.
2. **Round 2:** spec-first tests; the full MVP (§3–§8) with all §9 tests; deploy; run the latency script.
3. **Round 3:** fixes from the student's two-browser test, each with a regression test where testable; restart and redeploy persistence evidence in `docs/evidence/persistence.txt`; ADRs; CLAUDE.md update.
4. **Round 4:** after the student writes README.md and PROCESS.md: render, word counts, link checks, a claim → enforcement map in `docs/claims.md`, both checks green, deploy, `/ship`.

The student owns the README/PROCESS argument. Do not write submission-ready first-person reflections, invented motivations, claimed literature reading, user-test results or crit reflections. You may record objective implementation/test facts, maintain technical instructions and suggest an outline. If an author draft exists, preserve its voice; change wording only when asked.

COMP4020 deliverables: deployed *.fly.dev URL; source; README 400–600 words published in full at /readme/; PROCESS 900–1100 words explaining actual stack/workflow decisions; CLAUDE and referenced rules; spec checks; required crit reflections and real commit history. Do not assume the extension date or submit course work on the student's behalf.

## 11. Sources and limits to preserve

Use these sources for the stated design rationale, not as validation of the invented cases. Paraphrase accurately and do not invent bibliographic dates or statistics. Access checked 2026-11-11.

**R1. ISMP Canada, Definitions of Terms — Independent Double Check.** https://ismpcanada.ca/resource/definitions-of-terms/
Supports avoiding communication of the expected finding before independent verification. Does not establish that hiding UI answers ensures full human independence.

**R2. ISMP, Independent Double Checks: Worth the Effort if Used Judiciously and Properly.** https://home.ecri.org/blogs/guidance-insights-tools/independent-double-checks-worth-the-effort-if-used-judiciously-and-properly
Supports selective, properly implemented checking. Do not claim universal effectiveness or that every medicine requires this process.

**R3. Koyama AK, Sheridan Maddox C-S, Li L, Bucknall T, Westbrook JI. (2020). Effectiveness of double checking to reduce medication administration errors: a systematic review. BMJ Quality & Safety 29(7):595–603.** https://doi.org/10.1136/bmjqs-2019-009552 ; https://pubmed.ncbi.nlm.nih.gov/31391315/
Online first 2019, journal issue 2020. Supports caution about effectiveness claims and the importance of definitions/adherence. The game does not resolve that evidence gap.

**R4. Amber Case, Principles of Calm Technology.** https://calmtech.com/
Informs limited scope, restrained updates and lack of speed pressure. Do not claim a worksheet requiring focused attention fully embodies all calm technology principles.

**Technical references:**

- SSE: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
- Fly storage: https://docs.fly.io/volumes/overview
- SQLite library: https://github.com/WiseLibs/better-sqlite3
- Node tests: https://nodejs.org/api/test.html

Definition of done: a newcomer can use two independent browsers to complete the game from the URL; normal updates appear in about a second without refresh; no application answer leakage occurs before reveal; consensus and accuracy remain distinct; all accepted progress persists through restart and redeploy; required checks pass; remaining limitations and actual evidence are stated honestly.
