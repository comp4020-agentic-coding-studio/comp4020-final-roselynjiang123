# Content review — Second Pair of Eyes

**Reviewed:** 12 November 2026 (Australia/Sydney).  
**Material:** `review-pack(1).md`, headed *content review pack (2.0.0-draft)*, generated from `content/case-bank.v2.json`.  
**Input SHA-256:** `c1563890f800be357f8e746717b91ab702b7d8c6e1361ac7a3a8bcd55aa54092`.

**Reviewer identity and scope:** AI-assisted, source-based desk review using two analytical lenses: senior nursing practice/education and pharmacy/medication safety. No registered nurse or pharmacist has signed this report. These are two perspectives within one AI review, not two independent professional reviews. The JSON, running application, complete medication charts and local hospital procedures were not inspected. No edits to the source pack or clinical content have been made.

**Decision: changes required.** Retain draft status. The case concepts and arithmetic are useful, but the current pack should not be described as professionally reviewed or ready for unqualified classroom adoption. After the corrections below, it is a reasonable candidate for a facilitated first-year exercise, subject to actual content-owner checking and nursing-educator/pharmacist review. This is a content judgement, not a regulatory determination.

## 1. Priority findings

| ID | Priority | Finding | Required response |
|---|---|---|---|
| CR01 | P1 | C6 calls nebulisation and pMDI use different routes and can imply a 25-fold clinical overdose. Both deliver salbutamol by inhalation; device, formulation and nominal dose differ. | Correct the explanation. Keep the combined route/form mismatch only because the specified device/form does not match. Explicitly distinguish nominal mass ratio from clinical dose equivalence. |
| CR02 | P1 | C4's morphine hydrochloride 1 mg/mL is not established as a currently supplied Australian product. The retrieved ORDINE PI/CMI lists 1 mg/mL but marks it not currently distributed/available. | Identify an actual product and formulation. One possible content revision is verified ORDINE 2 mg/mL, 1.25 mL for the stated 2.5 mg order; update every dependent label and explanation. This is a proposed scenario revision, not a patient prescription. |
| CR03 | P1 | T2 says a PRN dose is “due”; C4's earliest-next-dose statement can be read as future permission to administer. | Describe an interval being met/not met. PRN indication, assessment and remaining checks still apply. |
| CR04 | P1 | C1/T2 feedback moves directly to observing ingestion and signing; “Stop and re-prepare” states that the order is fine. | Keep the simulation's checking boundary consistent. Include supervision and remaining checks; do not certify the clinical appropriateness of the order. |
| CR05 | P1 | C6 excludes a defensible pause/escalation response despite a breathless patient; C4 prioritises disposal before reassessment. | Accept evidence-based pausing in C6; prioritise assessment/escalation over a mechanical medication-preparation sequence. |
| CR06 | P1 | T2's rolling 24-hour total assumes the displayed extract is complete; C1's older patient has no context sufficient to endorse 4 g/day. | State the completeness of relevant administration history, including other paracetamol-containing medicines. Add relevant assumptions or narrow the conclusion. |
| CR07 | P1 | Several drug claims still cite a search facility rather than a specific PI/CMI. S11's supplied URL returned 404. | Replace placeholders with product-level citations and sections; replace or repair S11. A missing link is not evidence that a policy never existed. |
| CR08 | P1 | “A penicillin allergy applies” and T3's remote unspecified rash can teach permanent class-wide exclusion without assessment. | Retain “pause and clarify”; distinguish a recorded allergy label from a confirmed diagnosis and specialist assessment. Do not teach students to remove labels or perform challenges themselves. |
| CR09 | P2 | PRN prebrief says a maximum “may” be given; C6 omits it while invoking NIMC-style charting. | Explain the maximum field and its limits accurately; complete the simulated order or explicitly scope out prescription-completeness assessment. Do not invent a maximum. |
| CR10 | P2 | C2 tests identification but is mapped only to LO1, a dose-calculation objective. | Revise the objective mapping/wording so identification performance is not reported as dose-calculation learning. |

P1 means correct before presenting the affected material as dependable teaching content. P2 means improve teaching fidelity or interpretation. The priorities are this review's recommendations, not severity ratings issued by WHO or a regulator.

## 2. Case-by-case review

Realism scores below are **provisional desk judgements**, not ratings from clinical staff: 1 = poor fit; 2 = substantial contextual revision; 3 = plausible with qualifications; 4 = closely specified and well supported. “Derivable” concerns the intended exercise answer, not permission to administer a medicine.

| Case | Accuracy judgement | Australian adult-ward realism | Reference answer derivable? | First-year feedback |
|---|---|---:|---|---|
| C1 | Needs change; arithmetic accurate | 2/4 | Five comparisons: yes. Overall clinical suitability: not established. | Needs change |
| C2 | Needs change; identification mismatch accurate | 3/4 | Yes, if the patient details are explicitly the ID-band data | Needs change |
| C3 | Needs change in action framing; arithmetic accurate | 3/4 | Yes | Needs change |
| C4 | Needs change; interval calculation accurate | 2/4 | Yes for withholding now; not for full clinical suitability | Needs change |
| C5 | Needs change in generalisations; pausing is appropriate | 3/4 | Yes | Needs change |
| C6 | Inaccurate route explanation; intended preparation mismatch valid | 2/4 | Mismatch: yes. Exclusive next-step scoring: no | Needs change |
| T1 | Needs change in product/order and action framing; arithmetic accurate | 3/4 | Dose mismatch: yes | Needs change |
| T2 | Needs change in PRN language and data completeness | 3/4 | Interval: yes. Total: depends on completeness | Needs change |
| T3 | Needs change in allergy interpretation and IV-task scope | 2/4 | Yes for pausing to clarify | Needs change |

### C1 — Morning tablets

**Nursing lens:** A scheduled analgesic for a wrist fracture is plausible. An around-the-clock 02:00/08:00/14:00/20:00 order is possible, but should not be taught as the default routine for all older patients. Do not change it to a different schedule without also changing the frequency and records. The conclusion should concern the supplied comparisons; checking a cup does not replace bedside assessment, consent or supervision.

**Pharmacy lens:** 2 × 500 mg = 1000 mg = 1 g is correct. A 500 mg oral tablet is supported by TGA material. The order totals 4 g/day. Age 78 alone does not prove it is wrong, but weight, frailty, hepatic/renal factors and other sources of paracetamol matter; the OTC monograph does not establish suitability for this fictional inpatient. NSW CEC specifically identifies older/frail and underweight patients as groups requiring dose consideration. [R01, R02]

**Proposed replacement finding:**
> No discrepancy is identified in these five record comparisons. Two 500 mg tablets contain the ordered 1 g. This calculation does not establish that the prescribed regimen is appropriate for every patient.

**Proposed next-step replacement for C1 and equivalent wording in T2:**
> Continue the remaining checks with your supervising nurse or facilitator, including the patient's identity, allergy status, current assessment and willingness to take the medicine. In real practice, administration and documentation follow local policy and your authorised scope.

**Acceptance:** retain all five matches; remove categorical reassurance that nothing stops administration. Either supply relevant patient-specific assumptions and a complete relevant history, or explicitly limit this case to comparing the ordered and prepared amounts.

### C2 — Antibiotic round

**Nursing lens:** The three identifiers conflict clearly. The similar surname and nearby bed are plausible distractors; bed number is not an approved identity substitute. The pack references a band but displays a general patient heading: make the band's actual identifiers explicit. “Dispensed for” asserts a pharmacy event not established by a medicine-cup label. Use “prepared for another patient” unless a genuine simulated dispensing label is shown. [R03, R04]

**Pharmacy lens:** Two 500 mg capsules contain 1 g; the presentation is supported. Amoxicillin 1 g orally every eight hours appears in Australian pneumonia guidance, but the PI alone does not justify that regimen for every pneumonia inpatient. Distinguish a plausible given order from an exercise asking students to choose antimicrobial therapy. [R05, R06]

**Changes:**
- Replace “return them” with “keep the dose separate and notify the supervising nurse; follow local procedures for its disposition”. Do not imply loose prepared capsules may automatically be returned to stock.
- Describe a similar-name alert as following local procedure; do not promise a particular flagging system.
- Replace ambiguous 24:00 with a dated midnight entry if retained. Review overnight scheduling with the content owner; the terminology guidance recommends avoiding midnight administration where practicable. [R07]
- Map this case to an explicit identification objective, rather than dose-only LO1.

**Acceptance:** patient mismatch; four remaining matches; both the existing pause and re-preparation pathways can remain accepted with identification evidence and appropriate supervision.

### C3 — After surgery

**Nursing lens:** The under-prepared dose is clear. A first-year should recognise and raise the discrepancy, not infer an independent authority to correct and administer it. A cautious “pause and clarify” with the dose evidence is also defensible for a student; if the curriculum intentionally assesses a narrower re-preparation workflow, explain that simulated role.

**Pharmacy lens:** 500 mg is half of 1 g. “Pain may not be controlled” is appropriately conditional; do not turn it into a guaranteed outcome. A correct stock strength does not establish the correct total quantity. [R01]

**Proposed action:**
> Do not administer this preparation. Tell your supervising nurse that the prepared amount is 500 mg rather than the ordered 1 g. Correct the preparation within the agreed simulated role and repeat the relevant checks.

**Acceptance:** dose mismatch only. Do not score this as a prescribing error or require changing the order.

### C4 — Pain relief request

**Nursing lens:** 07:30 to 08:15 is 45 minutes; the specified four-hour minimum has not elapsed. Pain still needs attention now. Reassessment and escalation should precede a lengthy disposal workflow. Add a brief reminder to assess sedation and respiratory status in opioid scenarios, without inventing observations, numeric withholding thresholds or an alternative analgesic order.

**Pharmacy lens:** The intended 2.5 mg is a plausible conservative fictional order for an older adult, but it cannot be individually endorsed from age alone. The ORDINE information advises lower doses/caution in older patients. More importantly, its 1 mg/mL presentation is listed as not currently distributed in Australia; an ARTG registration alone does not establish supply. The 10 mg/mL strength used in T1 is listed. This review has not checked real-time pharmacy stock or excluded all other preparations. [R08, R09]

**Changes:**
- Choose and cite the actual product. If changing to 2 mg/mL, the matching prepared volume for this scenario's 2.5 mg is 1.25 mL; update the order, prepared record, feedback and fixtures together.
- If adopting NSW-style medication handling, include the oral-liquid strength and corresponding volume in the order; the NSW policy explicitly calls for these details. Use that rule only with its jurisdiction stated. [R10]
- Replace “earliest next dose is 11:30” with “the four-hour minimum would be reached at 11:30; another dose would still require a current indication and the remaining checks”.
- Describe the displayed timing check as **PRN schedule matches**, not proof that administration at 08:15 matches an authorised administration time.
- Retain witnessed handling/disposal only with a verified policy applicable to this simulated ward. Safe custody, witnessing, recording and destruction are related but different requirements; the student pair is not a pair of authorised S8 witnesses. [R10]

**Proposed next step:**
> Do not give another dose now. Notify the supervising nurse and reassess Arthur's pain and condition, including opioid-related sedation and breathing concerns. Seek prompt clinical review if needed. The authorised staff must secure and manage the prepared dose under the local Schedule 8 procedure, including the applicable witness and documentation requirements.

**Research note:** The 2026 Westbrook simulation trial exists. Use “no statistically significant improvement was found in the early-career subgroup”, rather than implying proof of no benefit for every novice. It involved paediatric nurses in simulation, not first-year students or this app. Detailed independent appraisal here is limited to the accessible abstract/university record. [R11]

**Acceptance:** five preparation comparisons can remain matches under the stated interface definition; pause + administration record remains the reference pair. Patient testimony should also trigger checking the record, rather than being treated as irrelevant.

### C5 — First dose of a new antibiotic

**Nursing lens:** A recorded history of hives and lip swelling is sufficient reason to pause and raise the conflict before this first dose. The patient is not currently having an allergic reaction in the case; do not describe the historical reaction as a present emergency or infer a confirmed past anaphylaxis diagnosis. A red band is a cue to read documentation, not a diagnosis.

**Pharmacy lens:** Amoxicillin is a penicillin. The retrieved product information supports checking hypersensitivity history. Retain the prescribed/prepared matches while explaining the separate allergy concern. Avoid teaching that all recorded allergy labels are permanent confirmed allergies. Structured assessment may later change a label, but first-year students must not override it or choose a replacement antibiotic. [R05, R12]

**Changes:** scope red-band interpretation to the simulated ward. NSW's policy covers documented medicine allergies/adverse reactions and certain severe food allergies; it is not evidence of ACT implementation or a universal penicillin-specific colour code. A white band must not be taught as proof that no allergy exists. [R03, R04]

**Proposed action:**
> Withhold this prepared dose and raise the recorded allergy–medicine conflict with your supervising nurse and prescriber/pharmacist. Clarify the allergy history and treatment plan, and document the outcome. Do not independently remove the allergy label or substitute another antibiotic.

**Acceptance:** five matches; pause + allergy record retained. Source supports the drug-class fact and recorded-reaction concern, not a claim that an allergic reaction would certainly occur.

### C6 — Breathless this morning

**Nursing lens:** A patient with worsening breathlessness requires assessment; the medication comparison must not train learners to postpone escalation until they finish the game. Add visible information that the supervising nurse is assessing the patient, or accept a pause/escalation response with relevant evidence. No vital-sign values or emergency treatment plan should be invented merely to make the case seem complete.

**Pharmacy lens:** The 100 micrograms/puff inhaler and 5 mg/2.5 mL nebuliser solution are supported product presentations. Both are administered by inhalation. Their formulations/devices and prescribed nominal amounts differ. The calculation 5000/200 = 25 is numerically correct, but does **not** establish 25-fold delivered lung dose, equivalent bronchodilator effect or toxicity. Nebulised doses and pMDI doses are not interchangeable by simple mass ratio. [R13, R14]

**Replace the finding with:**
> The preparation does not match the order: it uses nebuliser solution and a nebuliser device rather than the prescribed pMDI with spacer, and its nominal amount is 5 mg rather than 200 micrograms. Both use inhalation. The numerical mass difference does not establish clinical equivalence or a 25-fold overdose.

**Required changes:**
- Change the “Routes and forms” teaching card so nebulisation is described as a method of inhaled delivery, including mask or mouthpiece as appropriate.
- “Route & form: mismatch” may remain because this is a combined field and the form/device differs. If split, route alone is inhaled for both; device/form differs.
- Accept `Pause and clarify + route/form` as well as supervised correction of the mismatched preparation. Consider patient-statement evidence where the action explicitly concerns assessing breathlessness.
- Do not define re-preparation as proof that the order is clinically adequate for an acute COPD exacerbation.
- Resolve the absent PRN maximum/order-completeness issue with a content owner. Do not make the model invent an inhaler maximum or teach that the missing field never matters. [R15]

**Acceptance:** medicine identity matches; dose and combined route/form do not match the specified order; no statement calls nebulisation a non-inhaled route or infers clinical overdose from the 25:1 nominal ratio.

### T1 — A liquid dose

**Nursing lens:** This is a strong new-format transfer question. Its value is recognising the preparation error before administration. Protect and report the prepared S8 dose, then correct under supervision and the applicable policy; avoid issuing an unsupported universal disposal method.

**Pharmacy lens:** 10 mg/mL × 5 mL = 50 mg; 50/5 = 10 times the ordered amount. Unlike the pMDI/nebuliser comparison in C6, this compares the same intended oral formulation, so the tenfold preparation error is meaningful. For the same 10 mg/mL solution, 5 mg corresponds to 0.5 mL. This arithmetic is not an endorsement of that concentration as preferred stock for a low dose. [R08, R09]

**Changes:** identify the ordered product and strength so the exercise tests a preparation error rather than an ambiguous liquid order. Replace “re-prepare from the correct strength” with “re-prepare the ordered amount using the prescribed/approved formulation and verified concentration”; the pack does not establish that 10 mg/mL is itself the wrong product. Local use of a lower concentration is a separate selection decision. If using NSW policies, apply the strength-and-volume order convention. [R10]

**Acceptance:** dose mismatch only; 05:20→10:00 is 4 h 40 min, satisfying this order's minimum interval. Do not mark the interval met as a complete opioid assessment.

### T2 — Overnight pain relief

**Nursing lens:** Useful cross-midnight transfer. “It is due” is inappropriate for PRN: a dose may be considered when needed once the minimum interval is satisfied. The pain request supplies an indication to assess, not automatic authorisation to give.

**Pharmacy lens:** 21:40→04:00 next day is 6 h 20 min; the six-hour minimum is reached at 03:40. The shown previous doses sum to 2 g and the proposed dose would bring that to 3 g. But that is a verified rolling-24-hour total only if the record covers the full period from 04:00 on 10 November to 04:00 on 11 November and includes relevant regular/PRN, other-route and combination products. [R01, R02, R15]

**Proposed replacement finding:**
> The minimum interval in this PRN order has been met. If this is the complete relevant administration record for the preceding 24 hours, the proposed 1 g would bring the total to 3 g, below this scenario's stated 4 g maximum. Continue the assessment and remaining checks; a PRN dose is not automatically due.

**Acceptance:** show an explicit completeness statement or supply the missing history. Continue + administration-record evidence remains appropriate within the exercise boundary. Do not say calendar midnight resets a 24-hour maximum.

### T3 — A different antibiotic

**Nursing lens:** Pause and clarify is appropriate with a recorded, unresolved allergy label. However “rash (2015)” lacks timing after dosing, morphology, severity, treatment and later tolerance. It cannot establish confirmed IgE-mediated allergy or anaphylaxis. The omission can become the lesson: identify a conflict and ask for an assessment, rather than diagnose the reaction.

**Pharmacy lens:** Flucloxacillin is a penicillin; a 1 g vial is supported. Australian sources support 2 g IV six-hourly in selected serious infection settings, including a Queensland cellulitis/sepsis regimen. That establishes plausibility, not patient-specific appropriateness in every uncomplicated cellulitis case. Specify the intended inpatient context without adding sepsis merely to match a citation. [R16, R17]

**Changes:**
- Teach that the prescriber/pharmacist or an appropriately trained allergy team clarifies the history and plan; a remote rash does not justify student-led de-labelling, nor a lifetime ban asserted by this game. [R12]
- The bag description does not establish dilution, compatibility, stability or infusion rate. Either state these are outside this comparison task and not assessed, or supply a verified preparation/administration protocol. Do not label the entire IV preparation correct just because two vials total 2 g.
- Retain route/form match at the limited record-comparison level and pause + allergy evidence. Red-band qualifications from C5 also apply.

**Acceptance:** the action remains to clarify before giving the first dose; no claim that rash alone diagnoses the mechanism or determines the replacement drug.

## 3. Cross-case teaching corrections

1. **Define the exercise's five comparisons clearly.** These are not an exhaustive medication-safety checklist or a replacement for the clinical “rights”. Allergy, indication, assessment, consent, monitoring and documentation still matter. Record agreement must never become a proxy for clinical appropriateness.
2. **Revise next-step definitions.** Replace “The order is fine” with “The preparation does not match the order; stop, notify the supervising nurse and arrange correction within the simulated role.” A chosen correction does not validate the prescription.
3. **Make the first-year role explicit.** State that students practise recognising and explaining concerns under supervision; they are not independently prescribing, administering S8 medicines, witnessing controlled-drug procedures or selecting substitute therapy. Do not use a policy written for qualified enrolled nurses as proof of student authority.
4. **Support cautious, reasoned alternatives.** A student who recognises a discrepancy and escalates should not receive the same feedback as a student who overlooks it. Where the task intentionally requires one route, explain why alternatives are out of scope. Multiple-choice evidence reflects a teaching target, not the only clinical evidence with value.
5. **Patient testimony is evidence.** The C4 statement should prompt record verification, not be dismissed because only the administration-record option scores. Define whether evidence selection asks for the final documentary check or the first trigger for concern.
6. **Correct prebrief PRN wording.** Under the referenced NIMC framework, include indication, dose, frequency and maximum; check previous regular as well as PRN administrations. Distinguish a PRN chart maximum from the safe total across all sources. [R15]
7. **Teach safe units without overstating the source.** Full “micrograms” and “units” are appropriate project choices. The ACSQHC document also permits selected microgram abbreviations; do not claim every abbreviation is prohibited. Avoid ambiguous time notation. [R07]
8. **Avoid jurisdiction drift.** A fictional Australian ward may explicitly model selected NSW conventions. That is easier to substantiate than silently presenting NSW bands and S8 procedures as ACT policy or Australian law everywhere.
9. **APINCHS needs qualification.** Amoxicillin and flucloxacillin are antimicrobials, but a broad mnemonic category is not proof that every antimicrobial has the same high-risk status or requires an independent double check. The ACSQHC page lists specific antimicrobial examples and notes local variation. Morphine is explicitly represented in its opioid category. [R18]
10. **Align objectives.** Revise LO1 to include patient/medicine identification, prescribed amount and device/form comparisons, or add an identification objective. Keep LO2 for history/context and LO3 for evidence-based action and reflection. Do not present C2's score as evidence of dose-conversion competence.

## 4. Reference audit of the supplied S01–S21 list

| Pack ID | Audit result / action |
|---|---|
| S01 | ISMP Canada definition located. Appropriate for avoiding priming; it does not prove that the interface guarantees independent human judgement. |
| S02 | Article located via redirect. Selective-use framing is appropriate. Use the resolved canonical URL; do not transfer its effect estimates to this app. |
| S03 | Systematic review located. “Evidence limited” is reasonable; insufficient evidence is not proof of ineffectiveness. |
| S04 | Paper located. Replace “primed checks showed no benefit” with a finding about mandated checks as observed; most were primed. Optional checking showed an association with fewer errors. It is observational and cannot establish that priming caused the results. [R19] |
| S05 | 2026 trial verified through abstract/university record; add DOI `10.1136/bmjqs-2025-019743`. Preserve paediatric-nurse, simulation and subgroup limitations. [R11] |
| S06 | APINCHS source verified; qualify individual antibiotic labels as above. [R18] |
| S07 | Standard band specification verified; it allows local implementation. It does not require every alert to be encoded by a red band everywhere. [R04] |
| S08 | Supplied NSW PDF accessible, marked Active, with a stated review date in August 2026. That review date alone does not establish withdrawal. NSW policy is not confirmation of ACT practice. [R03] |
| S09 | November 2024 terminology document verified. Good for units and notation; not the most specific source for multiplication or every clinical route claim. [R07] |
| S10 | 2019 NIMC guide located; section 7.1 supports the PRN-record checks. Preserve its year and scope. [R15] |
| S11 | Supplied SESLHD link returned 404. Cannot validate that exact document/version through this URL. Replace with a retrievable applicable policy; NSW PD2022_032 provides more directly scoped inpatient and S8 sections, but is still NSW-specific. [R10] |
| S12 | A PI/CMI search page is a discovery tool, not adequate product evidence. Add the product, sponsor, PI/CMI version, relevant section and direct link for each claim. |
| S13 | TGA monograph verified. Useful for listed oral presentations and label directions; not an individual inpatient prescription authority. [R01] |
| S14 | Amoxycillin Generichealth PI/CMI content verified on Medicine Finder. It supports drug class and capsule strength, not universal endorsement of the pneumonia regimen. Identify the manufacturer document rather than implying ACSQHC authored the drug advice. [R05] |
| S15 | INACSL landing page verified. Distinguish planning informed by standards from accreditation or proven educational effectiveness. |
| S16 | WHO guidance and the 2024 release located. It identifies benefits and risks of LMMs, including educational uses. Runtime non-use is this project's design decision, not a WHO prohibition. [R20] |
| S17 | Outside detailed clinical review scope. The provided WCAG reference is appropriate as a UI standard, not evidence of clinical accuracy or full application conformance. |
| S18 | Public Simulation Canada page verified; it reports external review and student piloting. Login-only game content was not assessed; its validation does not validate this project. |
| S19 | Publisher full text located. Description broadly supported. More precisely: one simulation centre, participants recruited from one college and five hospitals. Its “experienced” group was >1 and <5 years, unlike the 2026 trial's experience categories; do not combine them as equivalent groups. [R21] |
| S20 | Calm Technology principles located. No timers/minimal notifications are project design choices inspired by the principles, not a mandated clinical or educational standard. |
| S21 | Pilot located. Abstract reports 42.6%, while the results prose reports 42.9% for the individual questionnaire. If retaining a number, specify its location and the discrepancy, or omit the percentages. Do not treat the differently structured tasks as proof that this app's independent pairs outperform individuals. [R22] |

## 5. Proposed exact wording changes

The following wording is a proposed correction for the content owner, not an edit already applied to JSON.

| Location | Proposed replacement |
|---|---|
| Global next step: Stop and re-prepare | “The preparation does not match the order. Stop and tell your supervising nurse. Arrange correction and repeat the relevant checks within your agreed role.” |
| Prebrief: nebulised | “Nebulised: a liquid is converted into an aerosol and inhaled through an appropriate device, using a mouthpiece or mask. This is an inhaled delivery method.” |
| Medicine card: salbutamol | “Check the prescribed formulation, device and nominal dose. pMDI doses and nebuliser doses must not be substituted using a simple microgram-to-milligram conversion.” |
| Allergy cards | “Check the documented allergy and reaction history. This medicine belongs to the penicillin family; an unresolved penicillin-allergy label requires clarification before administration. Do not independently override the label.” |
| C4 interval | “The four-hour minimum would be reached at 11:30. That time alone does not authorise another dose.” |
| C4 evidence explanation | “The patient described a recent dose; the administration record confirms its documented time. Use both sources to investigate the concern.” |
| T2 PRN finding | “The minimum interval has been met. A further dose may be considered if clinically indicated and after the remaining checks; it is not automatically due.” |
| T1 correction | “Re-prepare the ordered amount using the prescribed/approved formulation and a verified concentration, under the applicable supervision and Schedule 8 procedure.” |
| Research caption | “A paediatric-nurse simulation trial found greater detection with IDC among experienced nurses, but no statistically significant improvement in its early-career subgroup. This does not establish effectiveness for this student exercise.” |
| WHO/source caption | “WHO guidance informed consideration of generative-AI risks and oversight. The decision to use predefined feedback is the project's own design choice.” |

## 6. Changes and re-review acceptance checklist

- [ ] C6 distinguishes inhaled route from device/form; removes the inferred 25-fold clinical overdose.
- [ ] C4 names a supported product/strength; all dose–volume examples and tests are recalculated together. No assertion of current supply is based only on ARTG registration.
- [ ] Liquid-order specificity matches the stated simulated jurisdiction or is explicitly identified as a simplified representation.
- [ ] C1 and T2 no longer jump from comparison to administration; student supervision and remaining checks are stated.
- [ ] C4 and T2 separate PRN minimum intervals from automatic administration permission.
- [ ] Full relevant rolling-24-hour history is supplied or the totals are expressly conditional; paracetamol from all relevant sources is considered.
- [ ] The C1 older-adult context is appropriately qualified; no universal recommendation of 4 g/day for older patients is implied.
- [ ] C5/T3 distinguish recorded labels, confirmation and trained allergy assessment; no student-led replacement drug choice or de-labelling is taught.
- [ ] Breathlessness and unresolved pain trigger assessment/escalation, not only re-preparation/disposal.
- [ ] S8 roles, custody, witness and disposal wording use a retrievable, appropriately scoped policy; student signatures are not represented as legal S8 witnessing.
- [ ] C6's PRN order completeness and T3's unassessed IV-preparation elements are explicitly resolved.
- [ ] Clinically defensible alternative actions are accepted or the simulated role and narrow scoring objective are explained.
- [ ] Band meanings are localised and never replace the documented reaction history; bed number is not used as an identifier.
- [ ] Each medical claim has a product- or policy-specific citation and section; broken and placeholder references are corrected.
- [ ] LO mapping reflects identification, calculation, context and action separately.
- [ ] Regenerate the pack from the corrected JSON; check answer keys, visible evidence, feedback, hints and stored summaries remain consistent.
- [ ] Re-review the revised pack with a genuine nursing educator/RN and pharmacist for intended classroom use. Keep this AI report separate from their review records.

**Status handling:** This report does not authorise changing any case to `educator_reviewed` or recording a fictional RN/pharmacist reviewer. The author may use the linked findings to complete documented source checks under the project's actual workflow. Any professional review must identify the real role and review date. No approval is implied for the unchanged draft.

## 7. Evidence register

Accessed 12 November 2026. Manufacturer PI/CMI reproduced on ACSQHC Medicine Finder is identified as product information, not advice newly authored by the Commission. Retrieval does not prove live stock, local formulary use or individual clinical appropriateness. PDF page references distinguish printed numbering where known.

- **R01 — TGA, OTC medicine monograph: Paracetamol for oral use.** “Dosage forms and strengths” and “Directions for use”; page last updated 16 October 2024. https://www.tga.gov.au/resources/guidance/over-counter-otc-medicine-monograph-paracetamol-oral-use
- **R02 — NSW Clinical Excellence Commission, Paracetamol: High-risk medicines standard.** Published February 2024; “Prescribing” and “Administration”. The standard identifies dose-consideration groups and total-source checks; it does not provide a complete individual dosing guideline. https://cec.health.nsw.gov.au/therapeutics-safety/high-risk/paracetamol
- **R03 — NSW Health, Patient Identification Bands, PD2021_033.** Sections 2.1–2.2, printed pp. 1–2; document marked Active when retrieved. https://www1.health.nsw.gov.au/pds/ActivePDSDocuments/PD2021_033.pdf
- **R04 — ACSQHC, Specifications for a standard patient identification band.** Colour/alerts section and patient-identifier specifications. https://www.safetyandquality.gov.au/sites/default/files/migrated/Specs-PatID-Band.pdf
- **R05 — Amoxycillin Generichealth, product PI/CMI reproduced on Medicine Finder.** PI sections 2, 4.2–4.4 and CMI product description; retrieved page identifies 2024 product information. https://www.safetyandquality.gov.au/medicine-finder/amoxycillin-generichealth
- **R06 — Therapeutic Guidelines, Antibiotic prescribing in primary care: summary table, version 20; Queensland Health, Pneumonia pathway.** The former includes community-acquired pneumonia oral treatment; the latter concerns residential aged care. Neither substitutes for inpatient severity assessment. https://ccmsfiles.tg.org.au/s4/PDFs/GPSummary_v20.pdf ; https://www.health.qld.gov.au/clinical-practice/guidelines-procedures/clinical-pathways/residential-aged-care-clinical-pathways/all-pathways/pneumonia
- **R07 — ACSQHC, Recommendations for safe use of medicines terminology (November 2024).** Principle 12; Tables F–G. https://www.safetyandquality.gov.au/sites/default/files/2024-12/recommendations-for-safe-use-of-medicines-terminology.pdf
- **R08 — ORDINE PI/CMI reproduced on Medicine Finder.** PI sections 2, 4.2, 4.4; CMI product details and supply footnote. Page identifies PI revision January 2026 and CMI prepared September 2025. https://www.safetyandquality.gov.au/medicine-finder/ordine
- **R09 — TGA ARTG product records.** 10 mg/mL: AUST R 150222; 2 mg/mL: AUST R 150220; 1 mg/mL: AUST R 150219. These establish registration details, not current supply. PI download encountered a licence gateway; the PI text used for this review was the attributed reproduction in R08. https://www.tga.gov.au/resources/artg/150222 ; https://www.tga.gov.au/resources/artg/150220 ; https://www.tga.gov.au/resources/artg/150219
- **R10 — NSW Health, Medication Handling, PD2022_032 (2022).** Section 3.2 oral-liquid order specificity; section 6.6 safe administration; sections 6.8.3–6.8.4 inpatient S8 requirements; section 6.9 discards. Jurisdiction: NSW public health facilities; not verified as ACT policy. https://www1.health.nsw.gov.au/pds/ActivePDSDocuments/PD2022_032.pdf
- **R11 — Westbrook JI et al. (2026), Is independent double-checking superior to single-checking in medication administration error detection? A randomised controlled simulation trial.** DOI: 10.1136/bmjqs-2025-019743. Abstract/university record reviewed; publisher full text was inaccessible through this retrieval route. https://researchers.mq.edu.au/en/publications/is-independent-double-checking-superior-to-single-checking-in-med/ ; https://pubmed.ncbi.nlm.nih.gov/41825963/
- **R12 — ASCIA, Adult Penicillin Allergy Management, 2026 update; NSW CEC, Antibiotic allergy.** Reaction-history assessment, trained assessment and de-labelling context; not authorisation for independent student challenges. https://allergy.org.au/hp/drug-allergy/penicillin-management-guidelines-adult ; https://cec.health.nsw.gov.au/therapeutics-safety/medicines-improvement/antimicrobial/antibiotics
- **R13 — Ventolin CFC-Free Inhaler (with counter), manufacturer CMI reproduced on Medicine Finder.** Product details: 100 micrograms salbutamol per puff; CMI prepared July 2025. https://www.safetyandquality.gov.au/medicine-finder/ventolin-cfc-free-inhaler-with-counter
- **R14 — Salbutamol Cipla, manufacturer PI reproduced on Medicine Finder.** Sections 2–4.2: nebuliser solution presentations and inhalation use; retrieved page identifies PI revision December 2025. https://www.safetyandquality.gov.au/medicine-finder/salbutamol-cipla
- **R15 — ACSQHC, National Inpatient Medication Chart User Guide (2019).** Section 7.1, PRN orders and previous administrations. https://www.safetyandquality.gov.au/resources/national-inpatient-medication-chart-nimc-user-guide ; https://www.safetyandquality.gov.au/sites/default/files/resources/attachments//nimc_user_guide_2019.pdf
- **R16 — Flucloxacillin Baxter, manufacturer PI reproduced on Medicine Finder.** Sections 2, 4.2–4.4 and 6.5: 1 g vial, administration/preparation and hypersensitivity precautions. https://www.safetyandquality.gov.au/medicine-finder/flucloxacillin-baxter
- **R17 — Queensland Health, Adult Community Acquired Sepsis Prescribing Guidelines – First dose, SW1283 v2.00 (December 2024), p. 2.** Cellulitis/sepsis regimen is context-specific. https://www.health.qld.gov.au/clinical-practice/guidelines-procedures/clinical-resources?external-uuid=c653c6c4-8591-47be-9c3d-3af9d3beb897
- **R18 — ACSQHC, High risk medicines and systems.** APINCHS explanation and examples; includes explicit scope variation. https://www.safetyandquality.gov.au/clinical-topics/medicines-safety-and-quality/high-risk-medicines-and-systems
- **R19 — Westbrook JI et al. (2021), Associations between double-checking and medication administration errors.** Results by mandated/optional checking; DOI 10.1136/bmjqs-2020-011473. https://pmc.ncbi.nlm.nih.gov/articles/PMC7982937/
- **R20 — WHO, Ethics and governance of artificial intelligence for health: Guidance on large multi-modal models.** Report landing page and official release of 18 January 2024; governance context, not medicine-specific evidence. The current report landing page displays a different publication-page date; distinguish the report/release from page metadata when formatting references. https://www.who.int/publications/i/item/9789240084759 ; https://www.who.int/news/item/18-01-2024-who-releases-ai-ethics-and-governance-guidance-for-large-multi-modal-models
- **R21 — Lee SE et al. (2025), Patient safety in the ‘Room of Horrors’ simulation.** Methods: single simulation centre and group definitions. https://doi.org/10.1186/s12912-025-03700-x
- **R22 — Reime MH et al. (2022), Why an IPE Team Matters…** DOI 10.2147/JMDH.S368363; abstract 42.6% versus results prose 42.9% discrepancy noted. https://www.tandfonline.com/doi/full/10.2147/JMDH.S368363 ; https://pubmed.ncbi.nlm.nih.gov/35757786/

**Other directly checked pack references:** ISMP Canada definition https://ismpcanada.ca/resource/definitions-of-terms/ ; ISMP/ECRI selective double-checking https://home.ecri.org/blogs/guidance-insights-tools/independent-double-checks-worth-the-effort-if-used-judiciously-and-properly ; Koyama review https://pmc.ncbi.nlm.nih.gov/articles/PMC7362775/ ; INACSL standards overview https://www.inacsl.org/healthcare-simulation-standards-of-best-practice ; Simulation Canada public description https://simulationcanada.ca/scenario/medication-administration-safety-adult/ ; Calm Technology principles https://calmtech.com/ . These support the limited reference-audit statements above, not approval of the cases.
