import { renderShell, appRoot, apiFetch } from "./shell.js";

renderShell(null);

const tableId = window.location.pathname.split("/").pop();
const root = appRoot();
root.innerHTML = `<p class="fine">Loading…</p>`;

// GET never claims a seat (brief §4 step 3) -- this only checks joinability.
const { ok, status, body } = await apiFetch(`/api/tables/${tableId}`);

// Not one of the nine reference states (brief §10.1): composed from the
// reference's own `.card`/`.pad`/`.btn`/`.err` classes, reported here rather
// than guessed at in new markup.
if (!ok && status === 404) {
  root.innerHTML = `
    <div class="card pad">
      <h1>Table not found</h1>
      <p>This invite link doesn't match a table.</p>
      <div class="btns mt"><a class="btn" href="/">Start a new table</a></div>
    </div>
  `;
} else if (ok && body.joinable === false) {
  root.innerHTML = `
    <div class="card pad">
      <h1>You're invited to check records</h1>
      <p><b>This table already has two checkers.</b> Each table holds exactly two people. You can start a new table and invite someone.</p>
      <div class="btns mt"><a class="btn" href="/">Start a new table</a></div>
    </div>
  `;
} else if (ok) {
  const code = body.table?.code ?? body.table?.id?.slice(0, 4).toUpperCase() ?? "";
  root.innerHTML = `
    <div class="card pad">
      <h1>You're invited to check records</h1>
      <p>Checker A has started table <b class="mono">${code}</b>. Join as Checker B to practise together. Neither of you sees the other's answers until you have both signed.</p>
      <div class="btns mt">
        <button class="btn" type="button" id="join">Join as Checker B</button>
        <a class="btn ghost" href="/">Start my own table instead</a>
      </div>
      <div class="err" role="alert" id="error" hidden></div>
    </div>
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
  root.innerHTML = `
    <div class="card pad">
      <h1>Something went wrong</h1>
      <p>Couldn't reach the server. <a href="/">Start over</a></p>
    </div>
  `;
}
