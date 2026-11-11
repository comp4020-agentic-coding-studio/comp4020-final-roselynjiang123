// "My tables" card markup (reference's `start` state, `#my-tables`):
// shared between the landing page (embedded under the hero, matching the
// reference exactly) and /tables (its own full page, since the brief's nav
// links to "My tables" as a separate route rather than an anchor -- no
// second reference state exists for that route, so it reuses this same
// card/table markup instead of inventing new classes).
import { apiFetch, escapeHtml } from "./shell.js";

const STAGE_LABEL = {
  waiting_for_partner: "Waiting for partner",
  training: "In progress",
  training_summary: "Training summary",
  transfer: "New situations",
  completed: "Completed",
};

export async function myTablesCardHtml() {
  const { ok, body } = await apiFetch("/api/me/tables");
  if (!ok) {
    return `<p>Couldn't reach the server. <a href="/">Start over</a></p>`;
  }
  if (body.tables.length === 0) {
    return `<p class="fine">No tables in this browser yet. <a href="/">Create a table</a></p>`;
  }
  const rows = body.tables
    .map((t) => {
      const action = t.stage === "completed" ? "View" : "Continue";
      return `<tr><td>${escapeHtml(t.tableId.slice(0, 4).toUpperCase())}</td><td data-l="Seat">Checker ${escapeHtml(t.seat)}</td><td data-l="Progress">${escapeHtml(STAGE_LABEL[t.stage] ?? t.stage)}</td><td data-l=""><a href="/play/${escapeHtml(t.tableId)}">${action}</a></td></tr>`;
    })
    .join("");
  return `
    <table class="tbl mt">
      <thead><tr><th>Table</th><th>Seat</th><th>Progress</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}
