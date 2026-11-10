import { renderShell, appRoot, apiFetch } from "./shell.js";

renderShell("/");

appRoot().innerHTML = `
  <span class="eyebrow">Independent double check</span>
  <h1>Second Pair of Eyes</h1>
  <p class="lead">You and another learner are a checking pair for six fictional medication records. Each of you checks on your own; neither sees the other's answer until both have signed. Then you review together: did you agree, and were you right?</p>
  <div class="panel">
    <h2>How to play</h2>
    <ol class="steps">
      <li>Open this site in two Chrome profiles or two browsers. An incognito window works but forgets who you are when it closes.</li>
      <li>In the first, choose Create a table, then Copy invite link.</li>
      <li>Open the link in the second and choose Join. Check each case on your own; both answers appear once you have both signed.</li>
    </ol>
    <p class="small muted">Six short cases. No timer, no leaderboard.</p>
    <div class="actions">
      <button class="btn" type="button" id="create">Create a table</button>
      <a class="btn btn-secondary" href="/tables">My tables</a>
    </div>
    <div class="form-error" role="alert" id="error" hidden></div>
  </div>
`;

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
