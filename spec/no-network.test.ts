import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { roundResult, sessionSummary } from "../src/resultsAndSummary.mjs";
import { composeDebrief } from "../src/debrief.mjs";

// T17 No AI calls: no outbound network call is made while scoring or
// summarising. Stubs global fetch (the one outbound entry point reachable
// from plain ESM code without a bare `node:http(s)` import -- Node's own
// ESM module namespaces aren't spy-redefinable, so http.request/get aren't
// stubbed directly here) to throw if called, then drives
// roundResult/sessionSummary/composeDebrief -- the brief's named "pure
// functions with no I/O" (§8) -- against real bank/fixture data and asserts
// the stub never fired. Backed by a static check in the same file that
// neither module imports node:http/node:https/node:net at all, which is
// what would be needed to reach the network without going through fetch.
const bank = JSON.parse(readFileSync(new URL("../content/case-bank.v2.json", import.meta.url).pathname, "utf8"));
const fixtures = JSON.parse(readFileSync(new URL("../docs/content/scoring-fixtures.json", import.meta.url).pathname, "utf8"));
const casesById: Record<string, any> = Object.fromEntries(bank.cases.map((c: any) => [c.caseId, c]));

describe("src/resultsAndSummary.mjs and src/debrief.mjs cannot reach the network at all", () => {
  it("neither module imports node:http, node:https or node:net", () => {
    for (const path of ["src/resultsAndSummary.mjs", "src/debrief.mjs"]) {
      const source = readFileSync(path, "utf8");
      expect(source, `${path} must not import a network module`).not.toMatch(/from\s+["']node:(https?|net|dgram)["']/);
    }
  });
});

describe("T17: scoring and summarising never touch the network", () => {
  let originalFetch: typeof fetch;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchSpy = vi.fn(() => {
      throw new Error("unexpected outbound fetch() during scoring/summarising");
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("roundResult + composeDebrief for every scoring-fixtures example never call the network", () => {
    for (const example of Object.values<any>(fixtures.examples)) {
      const caseDef = casesById[example.caseId];
      const fields = (block: any) => {
        const out: Record<string, string> = {};
        for (const [key, f] of Object.entries<any>(block.fields)) out[key] = f.given;
        return out;
      };
      const subA = { fields: fields(example.A), action: example.A.decision.action, evidenceId: example.A.decision.evidenceId };
      const subB = { fields: fields(example.B), action: example.B.decision.action, evidenceId: example.B.decision.evidenceId };
      const result = roundResult(caseDef, subA, subB);
      const debriefBank = { fields: bank.fields, actions: bank.actions, evidenceOptions: bank.evidenceOptions, templates: bank.templates, sources: bank.sources };
      composeDebrief({ caseDef, bank: debriefBank }, result, "A");
      composeDebrief({ caseDef, bank: debriefBank }, result, "B");
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sessionSummary over the full mockSession never calls the network", () => {
    const mockResults = Object.entries<any>(fixtures.mockSession.answers).map(([caseId, subs]) =>
      roundResult(casesById[caseId], subs.A, subs.B),
    );
    for (const seat of ["A", "B"] as const) {
      for (const phase of ["training", "transfer"] as const) {
        sessionSummary(mockResults, seat, phase, casesById, bank);
      }
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
