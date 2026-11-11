import { reviewBadgeText } from "./debrief.mjs";

// F2 (docs/validation/findings.md, Round D): resolves a medicine card's
// sourceIds to {id, org, title, url} only -- deliberately never `supports`,
// `limits` or `verification`, since a source's `supports` text can be the
// same sentence as a case's claim (e.g. source S14's `supports` is
// "Amoxicillin is a penicillin-class antibiotic", word-for-word Case 5's
// claim that gives its answer away). The id/org/title/url are enough to
// link to the source's full entry on `/sources/#<id>` without repeating
// what it's cited for.
function resolveCardSources(bank, sourceIds) {
  return (sourceIds ?? [])
    .map((sid) => bank.sources.find((s) => s.id === sid))
    .filter(Boolean)
    .map((s) => ({ id: s.id, org: s.org, title: s.title, url: s.url }));
}

// Builds a round's frozen case snapshot (brief §6.1: "Each round freezes a
// complete snapshot of its case -- public part, answer key, accepted pairs,
// feedback, claims, card content, review status at the time. History never
// changes when the bank changes."). This is the ONLY place that reads a
// case out of the live bank to create a round; once stored as JSON in
// rounds.case_data, nothing here runs again for that round, so a later bank
// edit (or review-status change) cannot retroactively alter a played round.
//
// Includes the referenced medicine cards' full content (not just their ids)
// precisely so an edit to a medicine card after the round is played doesn't
// change what that round shows (same freezing rule, brief §6.1). Each
// card's `sources` (F2) are resolved and frozen here too, for the same
// reason.
export function buildCaseSnapshot(bank, caseDef) {
  const medicineCards = (caseDef.medicineCardIds ?? []).map((id) => {
    const card = bank.medicineCards.find((m) => m.id === id);
    return { ...card, sources: resolveCardSources(bank, card.sourceIds), reviewBadge: reviewBadgeText(card) };
  });
  return {
    caseId: caseDef.caseId,
    caseVersion: caseDef.caseVersion,
    phase: caseDef.phase,
    order: caseDef.order,
    title: caseDef.title,
    decisionTag: caseDef.decisionTag,
    simulationDateTime: caseDef.simulationDateTime,
    secondCheckNote: caseDef.secondCheckNote,
    patient: caseDef.patient,
    chart: caseDef.chart,
    prepared: caseDef.prepared,
    medicineCards,
    knowledgeCard: bank.knowledgeCard,
    fieldKeys: bank.fieldKeys,
    fields: bank.fields,
    fieldNote: bank.fieldNote,
    actions: bank.actions,
    evidenceOptions: bank.evidenceOptions,
    templates: bank.templates,
    answerKey: caseDef.answerKey,
    feedback: caseDef.feedback,
    claims: caseDef.claims,
    sources: bank.sources,
    reviewStatus: caseDef.reviewStatus,
    reviewerRole: caseDef.reviewerRole,
    reviewedAt: caseDef.reviewedAt,
    changeNote: caseDef.changeNote,
  };
}

// Public projection (brief §6.2): everything a client may see before both
// members have signed. Never includes answerKey, feedback or claims -- T01
// (independence) depends on this function being the only place that reads
// a frozen snapshot into an HTTP-facing shape pre-reveal.
export function publicCaseView(snapshot) {
  return {
    caseId: snapshot.caseId,
    caseVersion: snapshot.caseVersion,
    phase: snapshot.phase,
    order: snapshot.order,
    title: snapshot.title,
    simulationDateTime: snapshot.simulationDateTime,
    secondCheckNote: snapshot.secondCheckNote,
    patient: snapshot.patient,
    chart: snapshot.chart,
    prepared: snapshot.prepared,
    medicineCards: snapshot.medicineCards,
    knowledgeCard: snapshot.knowledgeCard,
    fieldKeys: snapshot.fieldKeys,
    fields: snapshot.fields,
    fieldNote: snapshot.fieldNote,
    actions: snapshot.actions,
    evidenceOptions: snapshot.evidenceOptions,
    reviewStatus: snapshot.reviewStatus,
    reviewerRole: snapshot.reviewerRole,
    reviewedAt: snapshot.reviewedAt,
    changeNote: snapshot.changeNote,
  };
}
