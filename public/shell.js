// Page shell shared by every page (brief §8, UI reference State 0): header,
// disclaimer, main, footer, skip link, one polite aria-live region.
export function renderShell(activeNav) {
  const navItem = (href, label) =>
    `<a href="${href}"${href === activeNav ? ' aria-current="page"' : ""}>${label}</a>`;
  document.body.insertAdjacentHTML(
    "afterbegin",
    `
    <a class="skip" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="wrap">
        <a class="brand" href="/">
          <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="5" width="17" height="22" rx="3" fill="#e7eff6" stroke="#1e5a85" stroke-width="2"/><rect x="12" y="5" width="17" height="22" rx="3" fill="#ffffff" stroke="#1e5a85" stroke-width="2"/><path d="M16 16l3 3 6-7" fill="none" stroke="#1e5a85" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Second Pair of Eyes
        </a>
        <nav class="nav" aria-label="Main">
          ${navItem("/", "Play")}
          ${navItem("/tables", "My tables")}
          ${navItem("/readme/", "Readme")}
        </nav>
      </div>
    </header>
    <div class="disclaimer"><div class="wrap">Educational simulation. All records are fictional. Compare the supplied records; do not use this game to make clinical decisions.</div></div>
    <main id="main"><div class="wrap" id="app"></div></main>
    <footer class="site-footer"><div class="wrap">Two checkers, one record, answers revealed together. <a href="/readme/">Why it works this way</a></div></footer>
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
