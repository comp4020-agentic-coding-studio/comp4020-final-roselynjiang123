import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { roundResult, sessionSummary } from "../src/resultsAndSummary.mjs";

// T07 Session summaries, T08 Zero denominators and incomplete tables.
const bank = JSON.parse(readFileSync(new URL("../content/case-bank.v2.json", import.meta.url).pathname, "utf8"));
const fixtures = JSON.parse(readFileSync(new URL("../docs/content/scoring-fixtures.json", import.meta.url).pathname, "utf8"));
const casesById: Record<string, any> = Object.fromEntries(bank.cases.map((c: any) => [c.caseId, c]));

// mockSession.answers holds raw {A, B} submissions per case id; this
// recomputes every round result from those, the same inputs
// tools/content/reference_scoring.py used to produce the fixtures, so the
// summaries below are built from the same starting point as the normative
// output.
const mockResults = Object.entries<any>(fixtures.mockSession.answers).map(([caseId, subs]) =>
  roundResult(casesById[caseId], subs.A, subs.B),
);

describe("T07 session summaries reproduce mockSession exactly", () => {
  for (const seat of ["A", "B"] as const) {
    for (const phase of ["training", "transfer"] as const) {
      it(`${seat} ${phase} summary matches fixtures exactly`, () => {
        const summary = sessionSummary(mockResults, seat, phase, casesById, bank);
        const expected = fixtures.mockSession[`${phase}Summary`][seat];
        expect(summary).toEqual(expected);
      });
    }
  }

  it("suggestions are ordered by distinct cases desc, then wrong items desc, then capabilityTagOrder", () => {
    const summary = sessionSummary(mockResults, "A", "training", casesById, bank);
    const expected = fixtures.mockSession.trainingSummary.A.suggestions;
    expect(summary.suggestions.map((s: any) => s.tag)).toEqual(expected.map((s: any) => s.tag));
    expect(summary.suggestions).toEqual(expected);
  });
});

describe("T08 zero denominators and incomplete tables", () => {
  it("a field with no real mismatches anywhere in the phase never divides by zero and the UI text comes from a 0-denominator result, not NaN/undefined", () => {
    // C1, C4 and C5 have no real mismatches on any field (content/case-bank.v2.json);
    // a summary scoped to only those rounds has a zero "found" denominator
    // for every field -- this must stay a clean [0, 0], not NaN or undefined,
    // so the caller can render "No opportunity this time" instead of "0/0".
    const onlyNoMismatchCases = ["C1", "C4", "C5"];
    const subset = mockResults.filter((r: any) => onlyNoMismatchCases.includes(r.caseId));
    const summary = sessionSummary(subset, "A", "training", casesById, bank);
    for (const field of bank.fieldKeys) {
      expect(summary.perField[field].found).toEqual([0, 0]);
      expect(Number.isNaN(summary.perField[field].found[0])).toBe(false);
      expect(Number.isNaN(summary.perField[field].found[1])).toBe(false);
    }
  });

  it("the incompleteExample (only C1-C4 revealed) reproduces exactly and casesCounted is 4, not 6", () => {
    const first4 = mockResults.slice(0, 4);
    expect(first4.map((r: any) => r.caseId)).toEqual(["C1", "C2", "C3", "C4"]);
    const summary = sessionSummary(first4, "B", "training", casesById, bank);
    expect(summary).toEqual(fixtures.mockSession.incompleteExample.B);
    expect(summary.casesCounted).toBe(4);
  });
});
