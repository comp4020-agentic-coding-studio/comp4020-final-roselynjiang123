// Table stage machine (brief §5): waiting_for_partner -> training ->
// training_summary -> transfer -> completed. Pure functions over the bank's
// case list and a table's current stage/round-index, so src/repo.mjs's
// transactions can call these without duplicating the stage rules inline.

export const STAGES = ["waiting_for_partner", "training", "training_summary", "transfer", "completed"];

// Cases in bank order, split by phase (brief §5: "Rounds 1-6 (cases C1-C6 in
// bank order)", "Rounds 7-9 (T1-T3)"). `bank.cases` is already in `order`
// sequence in content/case-bank.v2.json, but this sorts defensively rather
// than assuming the file's array order matches the `order` field.
function casesByPhase(bank, phase) {
  return bank.cases.filter((c) => c.phase === phase).sort((a, b) => a.order - b.order);
}

export function trainingCases(bank) {
  return casesByPhase(bank, "training");
}

export function transferCases(bank) {
  return casesByPhase(bank, "transfer");
}

// The case for a given 1-indexed round number across the whole table
// (1..6 = training, 7..9 = transfer), or null past the end of transfer.
export function caseForRoundIndex(bank, roundIndex) {
  const training = trainingCases(bank);
  if (roundIndex <= training.length) return training[roundIndex - 1];
  const transfer = transferCases(bank);
  const transferIndex = roundIndex - training.length;
  if (transferIndex <= transfer.length) return transfer[transferIndex - 1];
  return null;
}

// What happens when the round at `roundIndex` (now revealed) is left via
// Next (brief §5's "leaves the stage when" column): either the next round
// in the same phase, a stage-only transition (no new round), or nothing
// (completed is terminal, reached by advancing from round 9).
export function afterRound(bank, roundIndex) {
  const trainingCount = trainingCases(bank).length;
  const transferCount = transferCases(bank).length;
  if (roundIndex < trainingCount) return { kind: "next_round", nextRoundIndex: roundIndex + 1, stage: "training" };
  if (roundIndex === trainingCount) return { kind: "stage_only", stage: "training_summary" };
  if (roundIndex < trainingCount + transferCount) {
    return { kind: "next_round", nextRoundIndex: roundIndex + 1, stage: "transfer" };
  }
  return { kind: "stage_only", stage: "completed" };
}

// Leaving training_summary (brief §5: "Either member clicks Start the new
// situations (fromStage: 'training_summary') -> create round 7").
export function afterStage(bank, stage) {
  if (stage === "training_summary") {
    const trainingCount = trainingCases(bank).length;
    return { kind: "next_round", nextRoundIndex: trainingCount + 1, stage: "transfer" };
  }
  return null;
}
