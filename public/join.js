import { renderShell, appRoot, apiFetch } from "./shell.js";

renderShell(null);

const tableId = window.location.pathname.split("/").pop();
const root = appRoot();
root.innerHTML = `<p class="muted">Loading…</p>`;

// GET never claims a seat (brief §4 step 3) -- this only checks joinability.
const { ok, status, body } = await apiFetch(`/api/tables/${tableId}`);

if (!ok && status === 404) {
  root.innerHTML = `<h1>Table not found</h1><p>This invite link doesn't match a table.</p><a class="btn" href="/">Start a new table</a>`;
} else if (ok && body.joinable === false) {
  root.innerHTML = `
    <h1>You're invited to check records</h1>
    <div class="notice"><strong>This table already has two checkers.</strong> Each table holds exactly two people. You can start a new table and invite someone.</div>
    <a class="btn" href="/">Start a new table</a>
  `;
} else if (ok) {
  const code = body.table?.code ?? body.table?.id?.slice(0, 4).toUpperCase() ?? "";
  root.innerHTML = `
    <h1>You're invited to check records</h1>
    <p>Checker A has started table <strong>${code}</strong>. Join as Checker B to practise together. Neither of you sees the other's answers until you have both signed.</p>
    <div class="actions">
      <button class="btn" type="button" id="join">Join as Checker B</button>
      <a class="btn btn-secondary" href="/">Start my own table instead</a>
    </div>
    <div class="form-error" role="alert" id="error" hidden></div>
  `;
  document.getElementById("join").addEventListener("click", async () => {
    const button = document.getElementById("join");
    button.disabled = true;
    const result = await apiFetch(`/api/tables/${tableId}/join`, { method: "POST" });
    if (!result.ok) {
      const error = document.getElementById("error");
      error.hidden = false;
      error.textContent =
        result.status === 409
          ? "This table already has two checkers."
          : "Couldn't reach the server. Try again.";
      button.disabled = false;
      return;
    }
    window.location.href = `/play/${tableId}`;
  });
} else {
  root.innerHTML = `<h1>Something went wrong</h1><p>Couldn't reach the server. <a href="/">Start over</a></p>`;
}
