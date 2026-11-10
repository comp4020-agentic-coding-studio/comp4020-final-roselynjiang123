// Pure answer validation and scoring (brief §6). Kept separate from
// src/cases.mjs (case content) and src/serializer.mjs (what a client is
// allowed to see).

const FIELD_KEYS = ["patient", "medicine", "dose", "route", "time"];
const ALL_KEYS = [...FIELD_KEYS, "overall"];

// Reject malformed, missing, extra or inconsistent answers without
// disclosing correctness (brief §4 step 6, §9 item 5). Returns an error
// string, or null if the answer is well-formed and self-consistent.
export function validateAnswer(answer) {
  if (answer === null || typeof answer !== "object" || Array.isArray(answer)) {
    return "answer must be an object";
  }
  const keys = Object.keys(answer);
  const missing = ALL_KEYS.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !ALL_KEYS.includes(k));
  if (missing.length > 0) return `missing field(s): ${missing.join(", ")}`;
  if (extra.length > 0) return `unexpected field(s): ${extra.join(", ")}`;

  for (const key of FIELD_KEYS) {
    if (answer[key] !== "match" && answer[key] !== "mismatch") {
      return `${key} must be "match" or "mismatch"`;
    }
  }
  if (answer.overall !== "match" && answer.overall !== "discrepancy") {
    return 'overall must be "match" or "discrepancy"';
  }

  const allFieldsMatch = FIELD_KEYS.every((key) => answer[key] === "match");
  const consistent = allFieldsMatch ? answer.overall === "match" : answer.overall === "discrepancy";
  if (!consistent) {
    return allFieldsMatch
      ? "overall must agree with your field answers: every field matches, so choose Records match."
      : "overall must agree with your field answers: you marked a field as not matching, so choose Discrepancy found.";
  }

  return null;
}

// Expected comparisons derived from the frozen case snapshot (brief §6).
export function expectedAnswer(snapshot) {
  const expected = {};
  for (const key of FIELD_KEYS) {
    expected[key] = snapshot.mismatchFields.includes(key) ? "mismatch" : "match";
  }
  expected.overall = snapshot.mismatchFields.length > 0 ? "discrepancy" : "match";
  return expected;
}

export function isFullyCorrect(answer, expected) {
  return ALL_KEYS.every((key) => answer[key] === expected[key]);
}

export function answersEqual(a, b) {
  return ALL_KEYS.every((key) => a[key] === b[key]);
}

// Per-field correctness used to render the reveal table (brief §4 step 8).
export function fieldResults(answerA, answerB, expected) {
  const results = {};
  for (const key of ALL_KEYS) {
    results[key] = {
      expected: expected[key],
      a: answerA[key],
      b: answerB[key],
      aCorrect: answerA[key] === expected[key],
      bCorrect: answerB[key] === expected[key],
    };
  }
  return results;
}
