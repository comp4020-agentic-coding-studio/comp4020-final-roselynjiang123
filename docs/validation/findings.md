# Findings

**Status:** after S1. S0 and S1 were informal and came before `plan.md`, so this section reports what they showed without scoring them against the plan's criteria. Criteria V1–V6 apply from S2.

## What S1 showed

Non-nursing peers played v2 with the v1 stylesheet (see `sessions.md`).

1. **The purpose wasn't clear.** They didn't understand why two people check independently or why it matters. If this happens again in S2, V3 fails. The waiting screen already has Lee's prebrief and the note that real wards reserve independent double checks for selected high-risk medicines, but it says *what* happens, not *why*.
2. **They doubted the medical content.** Part of this is accurate: every case is still labelled "Draft · not yet source checked", and some sources are marked "Not yet verified". The main fix is content work, not interface work: verify the ⚠ items, mark cases `source_checked` only where every claim is checked, and get one reviewer (V1).
3. **Too much scrolling.** They lost track of what they'd read while moving between the records and the answer controls. They were using the old stylesheet with large status cards. The v2.1 layout shrinks those cards to one strip but still puts the records above the answers, so the risk remains.
4. **They asked for help inside a case:** a question panel or hints.

S1 doesn't show anything about a nursing audience, clinical accuracy, independent checking or learning.

## Fix list

### In Round D

- **F1 · Explain why before play.** On the start page and the waiting screen, above Lee's prebrief, add this text exactly:

  > **Why check on your own first?** A second checker only helps if they look for themselves. Once you've heard your partner's answer, it's easy to see what you expect and stop looking. So neither of you sees the other's answer until you've both signed. Then you see what each of you caught, and what you both missed. Two people can agree and still both be wrong.

  Check in S2: each participant can explain in their own words why answers are hidden (V3).

- **F2 · Show where the content comes from, without giving answers away.** On the checking screen, under the case heading, add a "Sources and review status" line: the review badge, links to the sources of this case's medicine card, and a link to `/sources/`. Don't show the case's claims before reveal, because they would give the answer away (for example, "amoxicillin is a penicillin" in Case 5). Label the records header "Fictional order for this scenario" and the medicine card "General information". Check in S2: a participant can find a source and say what the review status means.

- **F3 · Less scrolling.** Keep the v2.1 layout for now: it shrinks the large status cards S1 saw into one strip. Check in S2 at 1920×1080 and 390×844 whether anyone still loses their place (V2). If they do, the next change is to keep the records fixed on the left on wide screens with the answers on the right.

- **F4 · Space for questions, without storing them.** In the printed end review, add a section headed "Questions for my facilitator" with blank lines. Nothing is typed in or stored. This covers the request for a question panel without adding a hidden free-text field before reveal.

### Content work (mine)

- **F5** Verify the ⚠ items in `docs/content/review-pack.md`, update the sources marked "TO VERIFY", and change `reviewStatus` only where that is actually done. Send the review pack to one reviewer and record the result in `content-review.md` (V1).

### Not in this version

- **Hints tied to a case.** A hint that points to the relevant evidence ("look at the administration record") gives away the thing the learner is supposed to find on their own, which is what the exercise is about. The toolbox keeps its general notes, which are the same in every case.
- **A typed question field.** Free text stored before reveal is a new hidden data path, and it needs its own privacy wording. F4 covers the need on paper.
- **Live AI help.** Out of scope for this version (brief §2).

### Next

- **S2** using `plan.md`, with the observation sheet filled in from the start.
