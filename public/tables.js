import { renderShell, appRoot, apiFetch } from "./shell.js";

renderShell("/tables");

const root = appRoot();
root.innerHTML = `<p class="muted">Loading…</p>`;

const STAGE_LABEL = {
  waiting_for_partner: "Waiting for partner",
  training: "In progress",
  training_summary: "Training summary",
  transfer: "New situations",
  completed: "Completed",
};

const { ok, body } = await apiFetch("/api/me/tables");

if (!ok) {
  root.innerHTML = `<h1>My tables</h1><p>Couldn't reach the server. <a href="/">Start over</a></p>`;
} else if (body.tables.length === 0) {
  root.innerHTML = `
    <h1>My tables</h1>
    <p class="muted">Tables this browser has joined. The app recognises you by this browser's cookie, so these tables open only here.</p>
    <p class="muted">No tables in this browser yet. <a href="/">Create a table</a></p>
  `;
} else {
  const items = body.tables
    .map((t) => {
      const action = t.stage === "completed" ? "Review" : "Open";
      return `<li><span><strong>Table ${t.tableId.slice(0, 4).toUpperCase()}</strong> · Checker ${t.seat} · ${STAGE_LABEL[t.stage] ?? t.stage}</span><a href="/play/${t.tableId}">${action}</a></li>`;
    })
    .join("");
  root.innerHTML = `
    <h1>My tables</h1>
    <p class="muted">Tables this browser has joined. The app recognises you by this browser's cookie, so these tables open only here.</p>
    <ul class="item-list">${items}</ul>
  `;
}
