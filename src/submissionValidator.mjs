// Validates a v2 submission body against the bank's global option lists
// (brief §7.1). Pure and bank-shaped, not case-shaped: the same seven
// evidence options and three actions apply to every case, so this never
// needs the specific case to validate a submission's *shape* -- only
// src/scoring.mjs's correctness check needs the case's answerKey.
//
// Returns an error string, or null if the answer is well-formed and
// self-consistent. Never discloses correctness (brief §7.1): every message
// here describes the learner's own submission, never the reference answer.
export function validateSubmissionV2(body, bank) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return "submission must be an object";
  }

  const topKeys = Object.keys(body);
  const allowedTop = ["fields", "action", "evidenceId"];
  const missingTop = allowedTop.filter((k) => !topKeys.includes(k));
  const extraTop = topKeys.filter((k) => !allowedTop.includes(k));
  if (missingTop.length > 0) return `missing field(s): ${missingTop.join(", ")}`;
  if (extraTop.length > 0) return `unexpected field(s): ${extraTop.join(", ")}`;

  const { fields, action, evidenceId } = body;
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) {
    return "fields must be an object";
  }

  const fieldKeys = bank.fieldKeys;
  const fieldsGiven = Object.keys(fields);
  const missingFields = fieldKeys.filter((k) => !fieldsGiven.includes(k));
  const extraFields = fieldsGiven.filter((k) => !fieldKeys.includes(k));
  if (missingFields.length > 0) return `missing field(s): ${missingFields.join(", ")}`;
  if (extraFields.length > 0) return `unexpected field(s): ${extraFields.join(", ")}`;

  for (const key of fieldKeys) {
    if (fields[key] !== "match" && fields[key] !== "mismatch") {
      return `${key} must be "match" or "mismatch"`;
    }
  }

  const actionIds = new Set(bank.actions.map((a) => a.id));
  if (typeof action !== "string" || !actionIds.has(action)) {
    return "action must be one of the listed next steps";
  }

  const evidenceIds = new Set(bank.evidenceOptions.map((e) => e.id));
  if (typeof evidenceId !== "string" || !evidenceIds.has(evidenceId)) {
    return "evidenceId must be one of the listed evidence options";
  }

  // Consistency rule (brief §7.1): a mismatch means something here needs
  // more than "carry on as normal", so continue_checks is never the
  // response to a marked mismatch -- regardless of whether that mismatch
  // is the one the case's answerKey actually has. This is self-consistency,
  // not correctness: a wrong mismatch still blocks continue_checks.
  const anyMismatch = fieldKeys.some((key) => fields[key] === "mismatch");
  if (anyMismatch && action === "continue_checks") {
    return "You marked a mismatch, so ‘Continue with the remaining checks’ doesn't fit. Choose another next step.";
  }

  return null;
}
