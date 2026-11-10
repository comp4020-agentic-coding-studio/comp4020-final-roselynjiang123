import { marked } from "marked";

// README.md -> HTML for /readme/ (brief §9 item 11). marked produces real
// <h1>-<h6>/<p>/<ul>/<ol>/<a>/<code>/<table> elements, which is what the UI
// reference's /readme/ state (docs/reference/ui-reference.html, State 10)
// targets with `.prose` CSS -- not raw text. Replaces a Round 2 hand-written
// renderer (docs/evidence-log.md) with the pinned package brief §9's "or
// the starter's required test setup" allows alongside hand-rolled code; a
// maintained renderer handles markdown edge cases a bespoke one would keep
// missing one at a time.
// marked.parse()'s return type is `string | Promise<string>` because of its
// async option; this call always takes the sync path, so the return is
// always a string. The JSDoc cast documents that for spec/markdown.test.ts's
// `tsc --noEmit`, which infers types from .mjs files without checking them
// (tsconfig.json's allowJs, no checkJs).
/** @returns {string} */
export function renderMarkdown(md) {
  return /** @type {string} */ (marked.parse(md));
}
