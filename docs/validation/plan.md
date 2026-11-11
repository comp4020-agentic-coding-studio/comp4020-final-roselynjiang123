# Validation plan

Written on 12 November 2026, before session S2. I commit this file before that session so the commit time shows the criteria came before the data. I don't change a criterion after seeing results; if one turns out to be badly chosen, I add a note under it and keep the original.

## What this tests

The tests in `spec/` check that the app does what its spec says (verification). This plan checks whether the app does what the README says good means (validation): that learners can explain why matching records can still mean pausing, can see what a partner found and missed, and understand why answers stay hidden until both have signed.

Version under test: whatever is deployed at the time of each session. `sessions.md` notes which round it came after.

Two informal sessions happened before this plan and are recorded in `sessions.md` as background: S0 (v1, my housemate) and S1 (v2 before the new stylesheet, non-nursing peers). They shaped this plan. They are not scored against it.

## Who

- **Session S2 onwards:** at least one pair of participants who haven't played before. If I can, one pair with a nursing background and one without. If every participant is non-nursing, I say so in `findings.md` and make no claim about suitability for nursing students.
- **Content reviewer:** one registered nurse, clinical facilitator or pharmacist, reviewing `docs/content/review-pack.md` remotely. I record their role, not their name.

## Procedure (about 40 minutes per pair)

1. Verbal consent: a practice simulation; no names or health information recorded; they can stop at any time.
2. Two devices, seated apart or back to back. I give them only the URL.
3. They play the six cases, the summary and the three new situations. I don't help with how to use it unless a screen is broken; I note their questions and answer them at the end.
4. Five-minute interview (questions below).
5. Afterwards I run `pnpm export:evaluation` for that table and fill in the observation sheet in `sessions.md`.

## Criteria

| ID | Question | Met if | Evidence |
|---|---|---|---|
| V1 | Is the content accurate and realistic? | The reviewer marks no case "inaccurate" that I haven't fixed, and agrees each reference answer can be worked out from what's on the page | `content-review.md` |
| V2 | Can a pair use it without help? | They complete the six cases and the summary without help on how to use it (questions about the content don't count), in 20–30 minutes, and neither says they kept losing their place while scrolling | `sessions.md`, export |
| V3 | Do they understand why answers are hidden? | Each participant can say in their own words why they can't see their partner's answers until both have signed | interview |
| V4 | Do they tell agreeing apart from being right? | At least one participant explains it using a case from the game | interview |
| V5 | Does the method carry over to new situations? | Across all participants, at least half of the next-step-and-evidence decisions in the three new situations fit, reported next to their first attempts at the matching training cases | export |
| V6 | Do they check independently? | They don't discuss answers before both have signed in at least five of the six training cases | observation sheet |

## If a criterion isn't met

It goes into the Fix list in `findings.md`, smallest fix first. If there's time I fix it and run another session; if not, I report it as not met. A V6 failure is a finding about the room, not the code: the fix is the seating advice in the Guide, and the README says so.

## Limits

Very few participants, most of whom I know; a same-day transfer check with no control group; content stays draft unless the reviewer has looked at it. I report what I observed in N sessions. I don't claim the game improves anyone's checking.

## Interview questions

1. In your own words, why can't you see your partner's answers until you've both signed?
2. Was there a case where you agreed and were both wrong? What does that tell you?
3. Where did you get stuck or lose your place?
4. Did anything make you doubt the medical information? What would make you trust it?
5. (Nursing background only) Would this be useful in a first-year skills lab? What would you change?
