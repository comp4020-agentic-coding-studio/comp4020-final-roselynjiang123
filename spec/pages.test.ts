import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { expect, inject, it } from "vitest";

// T15 Pages: "/", "/readme/", "/guide/", "/sources/" return server-rendered
// HTML with their headings before JavaScript runs. "/" and "/readme/" are
// covered by spec/invariants.test.ts; this covers /guide/ and /sources/,
// built the same way: the served page's headings must include every ATX
// heading from the source file, in order, with no JS execution required to
// see them.
const baseUrl = inject("baseUrl");

const text = (html: string): string => new JSDOM(html).window.document.body.textContent ?? "";

const normalise = (s: string): string =>
  s
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/<[^>]+>/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

function headings(md: string): string[] {
  const found: string[] = [];
  let fenced = false;
  for (const line of md.split(/\r?\n/)) {
    if (/^ {0,3}(```|~~~)/.test(line)) fenced = !fenced;
    const heading = !fenced && line.match(/^ {0,3}#{1,6}\s+(.*?)(\s+#+)?\s*$/);
    if (heading) found.push(heading[1]);
  }
  return found;
}

it("publishes docs/guide.md at /guide/, server-rendered, headings in order", async () => {
  const expected = headings(readFileSync("docs/guide.md", "utf8"));
  expect(expected, "docs/guide.md has no headings to check /guide/ against").not.toEqual([]);

  const res = await fetch(new URL("/guide/", baseUrl));
  expect(res.status).toBe(200);
  const served = normalise(text(await res.text()));

  let from = 0;
  for (const heading of expected) {
    const at = served.indexOf(normalise(heading), from);
    expect(at, `/guide/ is missing the heading "${heading}" (or has it out of order)`).not.toBe(-1);
    from = at + normalise(heading).length;
  }
});

it("/sources/ returns server-rendered HTML with the scope and sources headings, grouped, before JS runs", async () => {
  const res = await fetch(new URL("/sources/", baseUrl));
  expect(res.status).toBe(200);
  const html = await res.text();
  const bodyText = text(html);

  for (const heading of [
    "Scope and limitations",
    "Content review",
    "References and affiliation",
    "Feedback and AI",
    "Learning records",
    "Sources",
  ]) {
    expect(bodyText).toContain(heading);
  }

  // Every group name in content/case-bank.v2.json's sources appears as its
  // own subheading (brief §9's "grouped sources from the bank").
  const bank = JSON.parse(readFileSync("content/case-bank.v2.json", "utf8"));
  const groups = [...new Set(bank.sources.map((s: any) => s.group))];
  for (const group of groups) {
    expect(bodyText).toContain(group);
  }

  // Every source id is a real anchor target (brief §9: "an anchor per
  // source id"), the same ids public/play.js links to as #<sourceId>.
  const dom = new JSDOM(html);
  for (const source of bank.sources) {
    const el = dom.window.document.getElementById(source.id);
    expect(el, `missing anchor #${source.id} on /sources/`).not.toBeNull();
  }

  // A source whose verification starts with "TO VERIFY" is labelled "Not
  // yet verified" (brief §9); one that doesn't is never mislabelled.
  for (const source of bank.sources) {
    const el = dom.window.document.getElementById(source.id);
    const labelled = el?.textContent?.includes("Not yet verified") ?? false;
    expect(labelled).toBe(Boolean(source.verification?.startsWith("TO VERIFY")));
  }
});
