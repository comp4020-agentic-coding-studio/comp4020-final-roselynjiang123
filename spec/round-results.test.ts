import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { roundResult } from "../src/resultsAndSummary.mjs";

// T06 Round results: every example in scoring-fixtures.json -> examples
// reproduces exactly. The fixture file is read-only (CLAUDE.md,
// docs/content/scoring-fixtures.json's own header); this test only reads it.
const bank = JSON.parse(readFileSync(new URL("../content/case-bank.v2.json", import.meta.url).pathname, "utf8"));
const fixtures = JSON.parse(readFileSync(new URL("../docs/content/scoring-fixtures.json", import.meta.url).pathname, "utf8"));
const casesById: Record<string, any> = Object.fromEntries(bank.cases.map((c: any) => [c.caseId, c]));

// Each example's "A"/"B" blocks carry {given, actual, outcome} per field,
// not the raw submission; roundResult() takes raw submissions and recomputes
// those, so this reconstructs each example's input submission from its own
// "given" values and decision -- the shape scoreSeat()/roundResult() expect.
function submissionFromExample(seatBlock: any) {
  const fields: Record<string, string> = {};
  for (const [key, f] of Object.entries<any>(seatBlock.fields)) fields[key] = f.given;
  return { fields, action: seatBlock.decision.action, evidenceId: seatBlock.decision.evidenceId };
}

describe("T06 round results reproduce docs/content/scoring-fixtures.json examples exactly", () => {
  for (const [name, example] of Object.entries<any>(fixtures.examples)) {
    it(`reproduces ${name}`, () => {
      const caseDef = casesById[example.caseId];
      const subA = submissionFromExample(example.A);
      const subB = submissionFromExample(example.B);
      const result = roundResult(caseDef, subA, subB);

      expect(result.A).toEqual(example.A);
      expect(result.B).toEqual(example.B);
      expect(result.pair).toEqual(example.pair);
    });
  }
});
