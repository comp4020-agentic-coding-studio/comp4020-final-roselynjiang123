# Second Pair of Eyes

## What this is

Paired medication-check practice for nursing, medical and other health students on a simulated ward. Two students check the same six fictional cases in their own browsers: compare the chart with what was prepared, then choose a next step and its evidence. Neither sees the other's answer, the reference or feedback until both have signed. Then both checks open together: what each caught, what both missed. Alone you get a score; together you learn what your agreement was worth. Three new situations and an end review follow (20–25 minutes).

**To try it:** create a table, open the invite link in a second Chrome profile or private window, and press Join.

## Why I made it

New clinicians often know a drug's pharmacology and still get its dose, timing or frequency wrong. Incorrect dose is the most common prescribing error in hospitals [R1], and wrong dose form, omission and wrong time lead nursing students' errors [R2]. On the wards where I trained in China, experienced nurses check new prescribers' orders for exactly this. I want students to practise that check before a ward, so that a textbook fact becomes a dose on a chart and, I hope, the foundation courses feel worth learning.

## What good means here

My first version passed every test I wrote and practised nothing a ward needs ([PROCESS](PROCESS.md), Moment 1). Good now means four things. What can be tested is **enforced** in `spec/`; the rest is **judged** against criteria V1–V6, fixed in `docs/validation/plan.md` before the sessions that test them.

1. **Each first judgement is formed alone.** Before both sign, no page, response or event stream carries the partner's answer, the reference or feedback. *Enforced:* T01–T03, T14. *Judged:* V3.
2. **Who found what stays visible.** The debrief separates agreeing from being right and names each checker's finds and shared misses. Signed answers never change. *Enforced:* T05–T08, T13. *Judged:* V4.
3. **Matching records are not permission.** Each case ends in a next step with evidence, and records can match on every field and still need a pause. *Enforced:* T04, T06. *Judged:* V5, on new situations.
4. **It is honest about content and effect.** Each case shows its version, sources and real review status; feedback is fixed rules and prewritten text, never live AI; nothing calls a medicine safe or claims an effect. *Enforced:* T10–T12, T17. *Judged:* V1, a nurse or pharmacist's review.

None is judged met yet; `docs/validation/findings.md` records each session.

## What I read

ISMP Canada defines an independent double check as one where the second checker isn't told what the first expects [R3]. In a children's hospital, mandated double checks were almost never independent, and primed checks did no better than single ones [R4]. In a 2026 trial, independent checking helped experienced nurses but not early-career ones, who found fewer errors as first checker than alone [R5]. Those are the students this is for, so the app teaches why to check alone, and the debrief names what each checker found. ISMP urges using double checks selectively [R6], and the evidence that they reduce errors or harm is insufficient [R7], so the app claims no effect.

Shirky [R8] and Sloan [R9] license building for one group without platform machinery. Sloan judges his app at his own table; I'm not a nursing student, so mine has to be judged by the people it is for.

## What I chose not to build

No sharing or discussing answers before the reveal: that is a primed check. No resubmission: a revised answer is no longer independent. No hints inside a case: they point at what the learner must find alone. No wrong-medicine scenes or characters to dress up: they would make it more game and less practice. No live AI, which can give inaccurate or incomplete health information [R10]. No timer, leaderboard or accounts [R11].

## Limits

A second browser isn't proof of a second person; pairs can still talk. Clearing cookies loses the seat. Every case is a fictional draft that an AI-assisted desk review says needs changes, and it certifies nothing.

## Sources

- [R1] Lewis PJ et al. (2009). Prevalence, incidence and nature of prescribing errors in hospital inpatients: a systematic review. Drug Saf 32(5):379–389. https://doi.org/10.2165/00002018-200932050-00002
- [R2] Triantafyllou C, Gamvrouli M, Myrianthefs P (2023). Frequency of nursing student medication errors: a systematic review. Health & Research Journal. https://ejournals.epublishing.ekt.gr/index.php/HealthResJ/article/view/33669
- [R3] ISMP Canada. Definitions of Terms: Independent Double Check. https://ismpcanada.ca/resource/definitions-of-terms/
- [R4] Westbrook JI et al. (2021). BMJ Qual Saf 30(4):320–330. https://doi.org/10.1136/bmjqs-2020-011473
- [R5] Westbrook JI et al. (2026). Randomised simulation trial of independent double-checking. BMJ Qual Saf. https://researchers.mq.edu.au/en/publications/is-independent-double-checking-superior-to-single-checking-in-med/
- [R6] ISMP. Independent Double Checks: Worth the Effort if Used Judiciously and Properly. https://home.ecri.org/blogs/ismp-alerts-and-articles-library/independent-double-checks-worth-the-effort-if-used-judiciously-and-properly
- [R7] Koyama AK et al. (2020). BMJ Qual Saf 29(7):595–603. https://doi.org/10.1136/bmjqs-2019-009552
- [R8] Shirky C (2004). Situated Software. https://gwern.net/doc/technology/2004-03-30-shirky-situatedsoftware
- [R9] Sloan R (2020). An app can be a home-cooked meal. https://www.robinsloan.com/notes/home-cooked-app/
- [R10] World Health Organization (2024). Ethics and governance of artificial intelligence for health: guidance on large multi-modal models. https://www.who.int/publications/i/item/9789240084759
- [R11] Case A. Principles of Calm Technology. https://calmtech.com/
