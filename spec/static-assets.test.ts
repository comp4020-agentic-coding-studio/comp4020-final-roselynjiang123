import { it, expect } from "vitest";
import { inject } from "vitest";

// T02 Static secrecy: the bank file, fixtures, tests and database are not
// reachable over HTTP; no front-end bundle contains an answer key. The app
// already passes this by construction (express.static only serves public/,
// and the only route reading content/case-bank.v2.json is behind
// repo.isMember()), but "passed by construction" is not the same as "a test
// catches a regression," so this makes the invariant enforced going forward.
const baseUrl = inject("baseUrl");

const CASE_CONTENT_MARKERS = [
  "answerKey",
  "acceptedPairs",
  "ELLIS",
  "Margaret",
  "4471023",
  "buildCaseSnapshot",
];

it("the bank file, fixtures, tests and database are not servable as static assets", async () => {
  for (const path of [
    "/content/case-bank.v2.json",
    "/case-bank.v2.json",
    "/src/bank.mjs",
    "/docs/content/scoring-fixtures.json",
    "/spec/bank.test.ts",
    "/data/dev.db",
    "/data/app.db",
  ]) {
    const res = await fetch(new URL(path, baseUrl));
    expect(res.status, `${path} should not be servable`).toBe(404);
  }
});

it("initial HTML for / and /play/:id carries no case content or answer key", async () => {
  for (const path of ["/", "/play/anything", "/join/anything", "/tables", "/readme/"]) {
    const res = await fetch(new URL(path, baseUrl));
    const html = await res.text();
    for (const marker of CASE_CONTENT_MARKERS) {
      expect(html, `${path} leaked "${marker}"`).not.toContain(marker);
    }
  }
});
