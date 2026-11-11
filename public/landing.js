import { renderShell, appRoot, apiFetch, escapeHtml, WHY_CHECK_ALONE } from "./shell.js";
import { myTablesCardHtml } from "./my-tables.js";

renderShell("/");

// v2.1 reference markup/copy, `start` state (docs/reference/ui-reference.html).
appRoot().innerHTML = `
  <div class="card hero">
    <div>
      <p class="kicker">Paired medication-check practice</p>
      <h1>Check on your own. Compare together.</h1>
      <p>You and a partner are nursing students on a simulated adult ward at the 08:00 medicine round. For six patients, compare the order with what was prepared, decide what happens next, then see what each of you found.</p>
      <p class="note"><b>Why check on your own first?</b> ${escapeHtml(WHY_CHECK_ALONE)}</p>
      <h2 class="mt">What you'll practise</h2>
      <ol class="goals">
        <li>Checking the <b>total amount</b>: units, strength and quantity.</li>
        <li>Using the <b>records and the patient's words</b> — the administration record and the allergy box — even when the order and the medicine match.</li>
        <li>Choosing a <b>next step with evidence</b>, and telling agreement apart from being right.</li>
      </ol>
      <div class="btns mt"><button class="btn" type="button" id="create">Create a practice table</button><a class="btn ghost" href="#my-tables">My tables</a></div>
      <p class="fine mt">About 20–25 minutes · two people, two browsers · fictional patients · content status: draft (<a href="/sources/">see Sources</a>)</p>
      <div class="err" role="alert" id="error" hidden></div>
    </div>
    <div>
      <h2>How it works</h2>
      <ol class="steps">
        <li><span>Create a table and send the invite link to your partner. Use two normal browser windows or devices.</span></li>
        <li><span>For each case, check on your own and sign. Your partner can't see your answers until you've both signed.</span></li>
        <li><span>See both answers, the reference answer and the debrief together. Talk it through.</span></li>
        <li><span>A summary, three new situations, then an end review you can print.</span></li>
      </ol>
      <p class="note">A private window loses your place when it closes. Your records stay in this browser only.</p>
    </div>
  </div>
  <div class="card pad mt" id="my-tables">
    <h2>My tables</h2>
    <p class="fine">Tables this browser has joined. The app recognises you by this browser's cookie, so these tables open only here.</p>
    <div id="my-tables-body"><p class="fine">Loading…</p></div>
  </div>
`;

document.getElementById("my-tables-body").innerHTML = await myTablesCardHtml();

document.getElementById("create").addEventListener("click", async () => {
  const button = document.getElementById("create");
  button.disabled = true;
  const { ok, body } = await apiFetch("/api/tables", { method: "POST" });
  if (!ok) {
    const error = document.getElementById("error");
    error.hidden = false;
    error.textContent = "Couldn't reach the server. Try again.";
    button.disabled = false;
    return;
  }
  window.location.href = `/play/${body.table.id}`;
});
