import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateSubmissionV2 } from "../src/submissionValidator.mjs";

// T04 Validation (brief §7.1): missing/extra/unknown keys, unknown evidence
// id and the consistency rule are rejected without revealing answers;
// valid wrong answers are accepted. This module validates shape and
// self-consistency only -- it never looks at a case's answerKey, so "valid
// wrong answers are accepted" isn't a thing this module can reject in the
// first place (src/resultsAndSummary.mjs scores correctness separately).
const bankPath = new URL("../content/case-bank.v2.json", import.meta.url).pathname;
const bank = JSON.parse(readFileSync(bankPath, "utf8"));

const VALID = {
  fields: { patient: "match", medicine: "match", dose: "match", route: "match", time: "match" },
  action: "continue_checks",
  evidenceId: "all_fields_match",
};

describe("T04 submission validation (brief §7.1)", () => {
  it("accepts a well-formed, self-consistent all-match submission", () => {
    expect(validateSubmissionV2(VALID, bank)).toBeNull();
  });

  it("accepts a well-formed submission with a mismatch and a non-continue_checks action (valid, even though wrong)", () => {
    const answer = { ...VALID, fields: { ...VALID.fields, dose: "mismatch" }, action: "reprepare", evidenceId: "total_amount" };
    expect(validateSubmissionV2(answer, bank)).toBeNull();
  });

  it("rejects a missing field key", () => {
    const { time, ...incomplete } = VALID.fields;
    const answer = { ...VALID, fields: incomplete };
    const error = validateSubmissionV2(answer, bank);
    expect(error).not.toBeNull();
    expect(error).toMatch(/missing field/i);
  });

  it("rejects an extra field key", () => {
    const answer = { ...VALID, fields: { ...VALID.fields, extraField: "match" } };
    const error = validateSubmissionV2(answer, bank);
    expect(error).not.toBeNull();
    expect(error).toMatch(/unexpected field/i);
  });

  it("rejects a top-level missing key (no action)", () => {
    const { action, ...rest } = VALID;
    const error = validateSubmissionV2(rest, bank);
    expect(error).not.toBeNull();
    expect(error).toMatch(/missing field/i);
  });

  it("rejects a top-level extra key", () => {
    const answer = { ...VALID, bogus: "x" };
    const error = validateSubmissionV2(answer, bank);
    expect(error).not.toBeNull();
    expect(error).toMatch(/unexpected field/i);
  });

  it("rejects an unknown evidence id", () => {
    const answer = { ...VALID, evidenceId: "not_a_real_evidence_option" };
    const error = validateSubmissionV2(answer, bank);
    expect(error).not.toBeNull();
    expect(error).toMatch(/evidenceId/);
  });

  it("rejects an unknown action", () => {
    const answer = { ...VALID, action: "do_something_else" };
    const error = validateSubmissionV2(answer, bank);
    expect(error).not.toBeNull();
    expect(error).toMatch(/action/);
  });

  it("rejects an unknown field value", () => {
    const answer = { ...VALID, fields: { ...VALID.fields, patient: "sort-of" } };
    const error = validateSubmissionV2(answer, bank);
    expect(error).not.toBeNull();
  });

  it("rejects continue_checks when any field is mismatch, without revealing which field is the real mismatch", () => {
    const answer = { ...VALID, fields: { ...VALID.fields, route: "mismatch" }, action: "continue_checks" };
    const error = validateSubmissionV2(answer, bank);
    expect(error).not.toBeNull();
    expect(error).toMatch(/Continue with the remaining checks/);
    // Never discloses correctness: the message names the rule, not the case's
    // actual answer key or which field the bank considers a real mismatch.
    expect(error!.toLowerCase()).not.toMatch(/correct|reference|answer key/);
  });

  it("accepts any non-continue_checks action when a field is mismatch", () => {
    for (const action of ["reprepare", "pause_clarify"]) {
      const answer = { ...VALID, fields: { ...VALID.fields, route: "mismatch" }, action };
      expect(validateSubmissionV2(answer, bank)).toBeNull();
    }
  });

  it("all-match answers may choose any action, including pause_clarify", () => {
    const answer = { ...VALID, action: "pause_clarify" };
    expect(validateSubmissionV2(answer, bank)).toBeNull();
  });
});
