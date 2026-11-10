import { it, expect } from "vitest";
import { inject } from "vitest";

// Brief §9 item 4: static assets and initial HTML never include server-only
// case keys, revealing case titles or database content. This was never
// written as an automated test in Round 2 -- docs/evidence-log.md records
// it as a spec gap, found when tidying Round 2 rather than by a failing
// check. The app already passed it by construction (express.static only
// serves public/, and the only route reading src/cases.mjs is behind
// repo.isMember()), but "passed by construction" is not the same as "a test
// catches a regression," so this makes the invariant enforced going forward.
const baseUrl = inject("baseUrl");

const CASE_CONTENT_MARKERS = [
  "mismatchFields",
  "teachingPoint",
  "SIM-014",
  "SIM-037",
  "Training Medicine",
  "caseSnapshot",
];

it("the case module and database are not servable as static assets", async () => {
  for (const path of ["/src/cases.mjs", "/cases.mjs", "/data/dev.db", "/data/app.db"]) {
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
