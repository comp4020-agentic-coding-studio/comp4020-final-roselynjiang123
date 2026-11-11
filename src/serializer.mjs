import { tableCode } from "./ids.mjs";
import { publicCaseView } from "./caseSnapshot.mjs";
import { roundResult, sessionSummary } from "./resultsAndSummary.mjs";
import { composeDebrief, reviewBadgeText } from "./debrief.mjs";
import { trainingCases, transferCases } from "./stages.mjs";

// The one explicit allowlist-based serializer (brief §4 item 4, §6.2): every
// GET, POST response and SSE event is built by this function, from a repo
// snapshot, so there is no second code path that could leak a field this
// one withholds.
//
// Before both submissions exist for a round: only "own submitted"/"partner
// submitted" booleans, plus the viewer's OWN submitted fields/action/
// evidenceId echoed back to them without scoring (brief §6.2: "Your own
// submission is returned to you after you sign, without any scoring.").
// Never the partner's answer, never a result, never a debrief, never the
// case's answerKey/acceptedPairs/feedback/claims -- publicCaseView() is the
// only projection of a round's case content used before revealed_at is set.
export function serializeSnapshot(snapshot, bank) {
  const { table, members, rounds, viewerIdentity } = snapshot;
  const viewerMember = members.find((m) => m.identity === viewerIdentity);
  const seatOf = (identity) => members.find((m) => m.identity === identity)?.seat ?? null;

  const seats = {
    A: { joined: members.some((m) => m.seat === "A") },
    B: { joined: members.some((m) => m.seat === "B") },
  };

  const liveCasesById = Object.fromEntries(bank.cases.map((c) => [c.caseId, c]));
  const roundsOut = rounds.map((round) => serializeRound(round, viewerIdentity, seatOf, liveCasesById));

  const result = {
    table: {
      id: table.id,
      code: tableCode(table.id),
      stage: table.stage,
      status: table.status,
      version: table.version,
      bankMajorVersion: table.bank_major_version,
      bankVersion: table.bank_version,
    },
    viewer: viewerMember ? { seat: viewerMember.seat } : null,
    seats,
    trainingCaseCount: trainingCases(bank).length,
    transferCaseCount: transferCases(bank).length,
    rounds: roundsOut,
    // Public, case-independent bank content (brief §6.2: the knowledge card
    // may be public) -- exposed at the top level, not just per-round, so the
    // `waiting_for_partner` stage's "Before you start" card (brief §5) has
    // something to show before round 1 exists (it's created only once B
    // joins). Read from the live bank, not a frozen snapshot: there is no
    // round yet to freeze it into, and the knowledge card isn't part of any
    // one case's graded content.
    knowledgeCard: bank.knowledgeCard,
    // setting.pairNote (brief §6.1: "appears on the waiting screen and in
    // the Guide with links to its setting.pairNoteSourceIds") resolved to
    // full source objects here, the one allowlist path, rather than making
    // the client re-resolve ids against a source list it would otherwise
    // need fetched separately.
    setting: {
      ward: bank.setting.ward,
      hospital: bank.setting.hospital,
      description: bank.setting.description,
      pairNote: bank.setting.pairNote,
      pairNoteSources: (bank.setting.pairNoteSourceIds ?? [])
        .map((sid) => bank.sources.find((s) => s.id === sid))
        .filter(Boolean),
    },
    // Public, case-independent bank content the summary screen needs to word
    // its suggestions (brief §8.3's `suggestions[tag]` templates and the
    // capability tag labels) -- a plain pass-through, not clinical answer
    // content, so safe before and after reveal alike.
    capabilityTags: bank.capabilityTags,
    suggestionsText: bank.suggestions,
  };

  if (table.stage === "training_summary" || table.stage === "transfer" || table.stage === "completed") {
    result.trainingSummary = summaryForPhase(roundsOut, "training", bank, viewerMember);
  }
  if (table.stage === "completed") {
    result.transferSummary = summaryForPhase(roundsOut, "transfer", bank, viewerMember);
  }

  return result;
}

// Session summaries (brief §8.3) are computed from already-serialized,
// already-revealed rounds (round.result), not from the DB again, so there
// is exactly one place (this function) that turns a result into a summary
// for the HTTP response. Legacy v1 rows (round.legacyNotCollected) are
// excluded, never scored as wrong (brief §6.1).
function summaryForPhase(roundsOut, phase, bank, viewerMember) {
  if (!viewerMember) return null;
  const scorable = roundsOut.filter((r) => r.case.phase === phase && r.revealed && !r.legacyNotCollected);
  const casesById = Object.fromEntries(scorable.map((r) => [r.case.caseId, { phase, decisionTag: r.result.decisionTag }]));
  const results = scorable.map((r) => ({ caseId: r.case.caseId, A: r.result.A, B: r.result.B, pair: r.result.pair }));
  const totalInPhase = phase === "training" ? trainingCases(bank).length : transferCases(bank).length;
  return {
    completedCount: scorable.length,
    totalCount: totalInPhase,
    [viewerMember.seat]: sessionSummary(results, viewerMember.seat, phase, casesById, bank),
    partner: sessionSummary(results, viewerMember.seat === "A" ? "B" : "A", phase, casesById, bank),
  };
}

function serializeRound(round, viewerIdentity, seatOf, liveCasesById) {
  const mine = round.submissions.find((s) => s.identity === viewerIdentity);
  const partner = round.submissions.find((s) => s.identity !== viewerIdentity);
  const revealed = Boolean(round.revealed_at);
  const caseSnapshot = round.case;
  // Withdrawn notice (brief §6.3) compares the frozen snapshot's review
  // status against the LIVE bank's current status for the same caseId:
  // the snapshot's own reviewStatus is fixed forever at round-creation
  // time (that's the point of freezing it), so a later withdrawal can
  // only be detected by checking what the bank says about this case now.
  // "Never silently re-score" means the frozen result/debrief below is
  // still built from caseSnapshot, not the live case -- only the notice
  // itself looks live.
  const liveCase = liveCasesById[caseSnapshot.caseId];
  const withdrawnNotice = liveCase?.reviewStatus === "withdrawn" ? liveCase.changeNote : null;

  const base = {
    id: round.id,
    index: round.round_index,
    case: publicCaseView(caseSnapshot),
    mine: mine
      ? { submitted: true, fields: mine.fields, action: mine.action, evidenceId: mine.evidence_id }
      : { submitted: false },
    partner: { submitted: Boolean(partner) },
    revealed,
    // Not secret (brief §6.2 only lists answerKey/acceptedPairs/feedback/
    // claims/result/the partner's submission): a plain timestamp, exposed so
    // the end-review screen can say when the table finished without
    // inventing a date (brief §5's "end" screen, reference's "practice
    // complete · {date}").
    revealedAt: round.revealed_at,
    withdrawnNotice,
  };

  if (!revealed) {
    // Pre-reveal: no partner data, no scoring, no answer key (brief §6.2).
    return base;
  }

  // v1 rows have no action/evidenceId (brief §6.1): "Old submissions without
  // action/evidenceId display 'Not collected in this version' and are
  // excluded from v2 summaries, not scored as wrong." Detected per-round,
  // not per-table, since a bank-version migration happens between rounds,
  // not mid-round.
  const legacyNotCollected = mine.action == null || partner.action == null;
  if (legacyNotCollected) {
    return { ...base, legacyNotCollected: true };
  }

  const bySeat = {};
  for (const submission of round.submissions) {
    bySeat[seatOf(submission.identity)] = {
      fields: submission.fields,
      action: submission.action,
      evidenceId: submission.evidence_id,
    };
  }
  const result = roundResult(caseSnapshot, bySeat.A, bySeat.B);
  const viewerSeat = seatOf(viewerIdentity);
  const debrief = composeDebrief({ caseDef: caseSnapshot, bank: caseSnapshotBank(caseSnapshot) }, result, viewerSeat);

  return {
    ...base,
    result: { ...result, decisionTag: caseSnapshot.decisionTag },
    debrief,
    reviewBadge: reviewBadgeText(caseSnapshot),
  };
}

// composeDebrief() needs a bank-shaped object (fields/templates/sources) to
// render labels and template text; the round's frozen snapshot already
// carries fields/actions/evidenceOptions/sources (src/caseSnapshot.mjs), so
// this assembles the minimal bank-shaped view from the snapshot itself
// rather than reading the live (possibly since-edited) bank -- keeping the
// debrief, like the result, computed only from what was frozen at round
// creation (brief §6.1).
function caseSnapshotBank(caseSnapshot) {
  return {
    fields: caseSnapshot.fields,
    templates: caseSnapshot.templates,
    sources: caseSnapshot.sources,
  };
}
