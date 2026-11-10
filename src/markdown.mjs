// Minimal Markdown -> HTML for README.md only (headings, paragraphs, lists,
// links, inline code, code fences, blockquotes, tables, bold/italic). The UI
// reference's /readme/ state (docs/reference/ui-reference.html, State 10)
// renders semantic HTML inside `.prose`, not raw text, so this produces real
// <h1>/<h2>/<p>/<ul>/<a>/<code> elements for that CSS to target. No
// dependency pulled in for this; README.md's markdown is simple enough that
// a small hand-written renderer is less than the brief's "no frontend
// framework, ORM or build pipeline" guards against.

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderInline(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

export function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // closing fence
      html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      html.push(`<blockquote><p>${renderInline(quote.join(" "))}</p></blockquote>`);
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const headerCells = line
        .trim()
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(
          lines[i]
            .trim()
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim()),
        );
        i++;
      }
      const thead = `<thead><tr>${headerCells.map((c) => `<th>${renderInline(c)}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${renderInline(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
      html.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[2]);
      const tag = ordered ? "ol" : "ul";
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (!m) break;
        items.push(`<li>${renderInline(m[3].trim())}</li>`);
        i++;
      }
      html.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6})\s+/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\d+\.\s+/.test(lines[i]) && !/^```/.test(lines[i]) && !/^\s*>/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    html.push(`<p>${renderInline(para.join(" ").trim())}</p>`);
  }

  return html.join("\n");
}
