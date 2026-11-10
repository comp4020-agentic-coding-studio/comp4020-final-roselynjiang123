import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { renderMarkdown } from "../src/markdown.mjs";

// src/server.mjs's GET /readme/ always renders the actual README.md (there is
// no fixture-swapping route), so this exercises renderMarkdown() directly --
// the same function that route calls -- rather than going through HTTP
// against a fixture file that route can't be pointed at. spec/invariants.test.ts
// already checks the real README.md renders at /readme/ over HTTP; this
// checks the element shapes marked.js (src/markdown.mjs) produces for the
// constructs README.md and PROCESS.md are expected to use.
describe("renderMarkdown (brief §9 item 11, /readme/'s rendering path)", () => {
  const FIXTURE = `# Title

## Section

### Subsection

A paragraph with a [link](https://example.com), **bold text** and \`inline code\`.

- bullet one
- bullet two

1. first
2. second

| Column A | Column B |
|---|---|
| a1 | b1 |
| a2 | b2 |
`;

  it("renders h1, h2 and h3", () => {
    const dom = new JSDOM(renderMarkdown(FIXTURE));
    expect(dom.window.document.querySelector("h1")?.textContent).toBe("Title");
    expect(dom.window.document.querySelector("h2")?.textContent).toBe("Section");
    expect(dom.window.document.querySelector("h3")?.textContent).toBe("Subsection");
  });

  it("renders a link, bold text and inline code", () => {
    const dom = new JSDOM(renderMarkdown(FIXTURE));
    const link = dom.window.document.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com");
    expect(link?.textContent).toBe("link");
    expect(dom.window.document.querySelector("strong")?.textContent).toBe("bold text");
    expect(dom.window.document.querySelector("code")?.textContent).toBe("inline code");
  });

  it("renders both an unordered and an ordered list", () => {
    const dom = new JSDOM(renderMarkdown(FIXTURE));
    const ul = dom.window.document.querySelector("ul");
    const ol = dom.window.document.querySelector("ol");
    expect(Array.from(ul?.querySelectorAll("li") ?? []).map((li) => li.textContent)).toEqual([
      "bullet one",
      "bullet two",
    ]);
    expect(Array.from(ol?.querySelectorAll("li") ?? []).map((li) => li.textContent)).toEqual(["first", "second"]);
  });

  it("renders a pipe table as table/thead/tbody", () => {
    const dom = new JSDOM(renderMarkdown(FIXTURE));
    const table = dom.window.document.querySelector("table");
    expect(table).not.toBeNull();
    const headers = Array.from(table?.querySelectorAll("thead th") ?? []).map((th) => th.textContent);
    expect(headers).toEqual(["Column A", "Column B"]);
    const rows = Array.from(table?.querySelectorAll("tbody tr") ?? []).map((tr) =>
      Array.from(tr.querySelectorAll("td")).map((td) => td.textContent),
    );
    expect(rows).toEqual([
      ["a1", "b1"],
      ["a2", "b2"],
    ]);
  });
});
