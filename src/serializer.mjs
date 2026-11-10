import { CASE_COUNT, FIELD_LABELS, ORDER_DISPLAY, PREPARED_DISPLAY } from "./cases.mjs";
import { tableCode } from "./ids.mjs";
import { answersEqual, expectedAnswer, fieldResults, isFullyCorrect } from "./scoring.mjs";

// The one explicit allowlist-based serializer (brief §7): every GET, POST
// response and SSE event is built by this function, from a repo snapshot, so
// there is no second code path that could leak a field this one withholds.
//
// Before both submissions exist for a round: only "own submitted" and
// "partner submitted" booleans are included. No partner answer, no
// correctness, no expected mismatch fields, no case answer key, no
// explanation (brief §6, §9 items 3-4). mismatchFields and teachingPoint are
// case-module internals (src/cases.mjs) and are never read by this function
// before revealed_at is set.
export function serializeSnapshot(snapshot) {
  const { table, members, rounds, viewerIdentity } = snapshot;
  const viewerMember = members.find((m) => m.identity === viewerIdentity);
  const seatOf = (identity) => members.find((m) => m.identity === identity)?.seat ?? null;

  const seats = {
    A: { joined: members.some((m) => m.seat === "A") },
    B: { joined: members.some((m) => m.seat === "B") },
  };

  const roundsOut = rounds.map((round) => serializeRound(round, viewerIdentity, seatOf));

  return {
    table: {
      id: table.id,
      code: tableCode(table.id),
      status: table.status,
      version: table.version,
    },
    viewer: viewerMember ? { seat: viewerMember.seat } : null,
    seats,
    caseCount: CASE_COUNT,
    rounds: roundsOut,
    fieldOrder: {
      order: ORDER_DISPLAY,
      prepared: PREPARED_DISPLAY,
      labels: FIELD_LABELS,
    },
  };
}

function serializeRound(round, viewerIdentity, seatOf) {
  const mine = round.submissions.find((s) => s.identity === viewerIdentity);
  const partner = round.submissions.find((s) => s.identity !== viewerIdentity);
  const revealed = Boolean(round.revealed_at);

  const base = {
    id: round.id,
    index: round.round_index,
    case: { id: round.case.id, order: round.case.order, prepared: round.case.prepared },
    mine: { submitted: Boolean(mine) },
    partner: { submitted: Boolean(partner) },
    revealed,
  };

  if (!revealed) {
    // Pre-reveal: no answers, no scoring, no answer key (brief §6, §9 #3/#4).
    return base;
  }

  const expected = expectedAnswer(round.case);
  const bySeat = {};
  for (const submission of round.submissions) {
    bySeat[seatOf(submission.identity)] = submission.answer;
  }
  const answerA = bySeat.A;
  const answerB = bySeat.B;

  return {
    ...base,
    reveal: {
      fields: fieldResults(answerA, answerB, expected),
      sameAnswer: answersEqual(answerA, answerB),
      aFullyCorrect: isFullyCorrect(answerA, expected),
      bFullyCorrect: isFullyCorrect(answerB, expected),
      teachingPoint: round.case.teachingPoint,
    },
  };
}
