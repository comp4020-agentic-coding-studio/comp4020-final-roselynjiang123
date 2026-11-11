import { renderShell, appRoot } from "./shell.js";
import { myTablesCardHtml } from "./my-tables.js";

renderShell("/tables");

const root = appRoot();
root.innerHTML = `<p class="fine">Loading…</p>`;

// Reference `#my-tables` card (state "start", docs/reference/ui-reference.html),
// reused as its own page: the reference embeds this card on the home screen
// (public/landing.js does the same), but the app's nav also links to it as
// a separate route (brief §9's GET /api/me/tables) -- same card/table
// markup via my-tables.js, composed as a full page since no second
// reference state exists for a standalone "My tables" route.
root.innerHTML = `
  <div class="card pad">
    <h1>My tables</h1>
    <p class="fine">Tables this browser has joined. The app recognises you by this browser's cookie, so these tables open only here.</p>
    <div id="my-tables-body"><p class="fine">Loading…</p></div>
  </div>
`;
document.getElementById("my-tables-body").innerHTML = await myTablesCardHtml();
