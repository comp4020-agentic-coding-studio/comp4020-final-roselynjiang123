// Page shell shared by every page (brief §10.1/§10.2 U01/U13): header with
// the brand logo and ward subtitle, the one-line educational-simulation
// notice linking to /sources/, main, one polite aria-live region.
// v2.1 reference markup/copy (docs/reference/ui-reference.html): `.topbar`,
// `.brand`, `.ctx` (U01 subtitle), `.notice` (U13).
export function renderShell(activeNav) {
  const navItem = (href, label) =>
    `<a href="${href}"${href === activeNav ? ' aria-current="page"' : ""}>${label}</a>`;
  document.body.insertAdjacentHTML(
    "afterbegin",
    `
    <a class="skip" href="#main">Skip to content</a>
    <header class="topbar">
      <div class="wrap">
        <a class="brand" href="/">
          <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><rect x="12" y="2" width="17" height="22" rx="4" fill="#7fc4ba"/><path d="M22 6v7l2.5-1.7L27 13V6z" fill="#0f5257"/><rect x="3" y="8" width="18" height="22" rx="4" fill="#fff"/><rect x="4.5" y="9.5" width="15" height="19" rx="3" fill="#0f5257"/><path d="M7.5 19.5l3.2 3.2 6-7" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Second Pair of Eyes
        </a>
        <span class="ctx">Adult ward · Paired medication-check practice</span>
        <nav class="nav" aria-label="Main">
          ${navItem("/", "Play")}
          ${navItem("/tables", "My tables")}
          ${navItem("/guide/", "Guide")}
          ${navItem("/sources/", "Sources")}
          ${navItem("/readme/", "Readme")}
        </nav>
      </div>
    </header>
    <div class="notice"><div class="wrap">Educational simulation · Fictional patients · Not for clinical decision-making. <a href="/sources/">View scope and sources</a></div></div>
    <main id="main"><div class="wrap" id="app"></div></main>
    `,
  );
  document.body.insertAdjacentHTML(
    "beforeend",
    `<p class="sr-only" aria-live="polite" id="announcer"></p>`,
  );
}

export function announce(message) {
  const el = document.getElementById("announcer");
  if (el) el.textContent = message;
}

export function appRoot() {
  return document.getElementById("app");
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    // no body
  }
  return { ok: res.ok, status: res.status, body };
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
