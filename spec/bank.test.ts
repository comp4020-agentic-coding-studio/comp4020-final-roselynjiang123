import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { loadBank, validateBank } from "../src/bank.mjs";

// T11 Review status, T12 Bank validation. Tests load the real
// content/case-bank.v2.json and also build minimal invalid variants by
// deep-cloning it and breaking one rule at a time -- the real bank is
// read-only content (CLAUDE.md), so these never write to it; every "bad"
// case is a throwaway in-memory copy.
const bankPath = new URL("../content/case-bank.v2.json", import.meta.url).pathname;
const realBank = JSON.parse(readFileSync(bankPath, "utf8"));

function clone(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

describe("T12 bank validation (content/case-bank.v2.json)", () => {
  it("the real bank loads and validates with zero errors", () => {
    expect(() => loadBank(bankPath)).not.toThrow();
    expect(validateBank(realBank)).toEqual([]);
  });

  it("an accepted pair with continue_checks on a case with a mismatch fails validation", () => {
    const bad = clone(realBank);
    const c2 = bad.cases.find((c: any) => c.caseId === "C2");
    expect(Object.values(c2.answerKey.fields)).toContain("mismatch");
    c2.answerKey.acceptedPairs = [{ action: "continue_checks", evidenceId: "identifiers" }];
    const errors = validateBank(bad);
    expect(errors.some((e: string) => e.includes('case "C2"') && e.includes("continue_checks"))).toBe(true);
  });

  it("an unknown source id fails validation", () => {
    const bad = clone(realBank);
    bad.cases[0].claims[0].sourceIds = ["S-does-not-exist"];
    const errors = validateBank(bad);
    expect(errors.some((e: string) => e.includes("unknown source"))).toBe(true);
  });

  it("an unknown medicine card id fails validation", () => {
    const bad = clone(realBank);
    bad.cases[0].medicineCardIds = ["not-a-real-card"];
    const errors = validateBank(bad);
    expect(errors.some((e: string) => e.includes("unknown medicineCardIds"))).toBe(true);
  });
});

describe("T11 review status", () => {
  it("draft never requires reviewerRole/reviewedAt (no false failure)", () => {
    const bad = clone(realBank);
    bad.cases[0].reviewStatus = "draft";
    bad.cases[0].reviewerRole = null;
    bad.cases[0].reviewedAt = null;
    expect(validateBank(bad)).toEqual([]);
  });

  it("educator_reviewed without reviewerRole/reviewedAt fails validation", () => {
    const bad = clone(realBank);
    bad.cases[0].reviewStatus = "educator_reviewed";
    bad.cases[0].reviewerRole = null;
    bad.cases[0].reviewedAt = null;
    const errors = validateBank(bad);
    expect(errors.some((e: string) => e.includes('case "C1"') && e.includes("educator_reviewed"))).toBe(true);
  });

  it("source_checked with only a TO VERIFY source on a claim fails validation", () => {
    const bad = clone(realBank);
    const toVerifySource = bad.sources.find((s: any) => s.verification.startsWith("TO VERIFY"));
    expect(toVerifySource).toBeDefined();
    bad.cases[0].reviewStatus = "source_checked";
    bad.cases[0].claims[0].sourceIds = [toVerifySource.id];
    const errors = validateBank(bad);
    expect(errors.some((e: string) => e.includes('case "C1"') && e.includes("source_checked"))).toBe(true);
  });
});
