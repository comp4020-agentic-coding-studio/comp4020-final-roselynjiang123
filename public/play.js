import { renderShell, appRoot, announce, apiFetch, escapeHtml } from "./shell.js";

renderShell(null);

const tableId = window.location.pathname.split("/").pop();
const root = appRoot();
root.innerHTML = `<p class="muted">Loading…</p>`;

const GLOSSARY = [
  ["Patient", "The simulated patient's identifier."],
  ["Medicine", "The medicine's name as written. All names are training placeholders."],
  ["Dose", "The amount, in fictional training units."],
  ["Route", "How the medicine is given."],
  ["Scheduled time", "The time written on the record, on a 24-hour clock."],
  ["Oral", "By mouth."],
  ["Intravenous", "Into a vein."],
];

const FIELD_KEYS = ["patient", "medicine", "dose", "route", "time"];

// view state not derivable from the server snapshot alone
let mode = null;
let roundId = null;
let draft = {};
let submitting = false;
let reviewing = false;
let lastSeatsJoined = { A: false, B: false };
let lastPartnerSubmitted = false;
let lastRevealedCount = 0;

function recordRow(labelOrder, values) {
  return labelOrder
    .map((key) => `<dt>${FIELD_LABEL(key)}</dt><dd>${escapeHtml(values[key])}</dd>`)
    .join("");
}

function FIELD_LABEL(key) {
  return { patient: "Patient", medicine: "Medicine", dose: "Dose", route: "Route", time: "Scheduled time" }[key];
}

function glossaryHtml() {
  return `
    <details class="glossary">
      <summary>Field guide</summary>
      <dl>
        ${GLOSSARY.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join("")}
      </dl>
    </details>
  `;
}

function seatsHtml(snapshot, labelFn) {
  const { seats } = snapshot;
  const aDone = labelFn("A", seats);
  const bDone = labelFn("B", seats);
  return `
    <ul class="seats" aria-label="Submission status">
      <li class="seat${aDone.done ? " is-done" : ""}"><span class="dot" aria-hidden="true"></span>Checker A${
        snapshot.viewer?.seat === "A" ? " (you)" : ""
      } <span class="state">${aDone.label}</span></li>
      <li class="seat${bDone.done ? " is-done" : ""}"><span class="dot" aria-hidden="true"></span>Checker B${
        snapshot.viewer?.seat === "B" ? " (you)" : ""
      } <span class="state">${bDone.label}</span></li>
    </ul>
  `;
}

function tableMetaHtml(snapshot, extra) {
  const seat = snapshot.viewer?.seat ? `Checker ${snapshot.viewer.seat}` : "—";
  return `
    <div class="table-meta">
      <span>Table <strong>${snapshot.table.code}</strong></span>
      <span>You are <strong>${seat}</strong></span>
      ${extra ?? ""}
      <span class="conn" id="conn">Connected</span>
    </div>
  `;
}

function render(snapshot) {
  const current = snapshot.rounds[snapshot.rounds.length - 1];
  const seatsBothJoined = snapshot.seats.A.joined && snapshot.seats.B.joined;

  let nextMode;
  if (!seatsBothJoined) {
    nextMode = "waiting";
  } else if (reviewing) {
    nextMode = "review";
  } else if (current.revealed) {
    nextMode = "revealed";
  } else if (current.mine.submitted) {
    nextMode = "submitted";
  } else {
    nextMode = "checking";
  }

  const sameRound = nextMode === mode && current.id === roundId;
  const revealedCount = snapshot.rounds.filter((r) => r.revealed).length;

  if (sameRound && (nextMode === "checking" || nextMode === "submitted")) {
    updateStatusBits(snapshot, current);
    maybeAnnounce(snapshot, current, revealedCount);
    return;
  }

  mode = nextMode;
  roundId = current.id;
  draft = {};
  lastSeatsJoined = { A: snapshot.seats.A.joined, B: snapshot.seats.B.joined };
  lastPartnerSubmitted = current.partner.submitted;
  lastRevealedCount = revealedCount;

  if (mode === "waiting") renderWaiting(snapshot);
  else if (mode === "checking") renderChecking(snapshot, current);
  else if (mode === "submitted") renderSubmitted(snapshot, current);
  else if (mode === "revealed") renderRevealed(snapshot, current);
  else if (mode === "review") renderReview(snapshot);
}

function maybeAnnounce(snapshot, current, revealedCount) {
  if (snapshot.seats.A.joined && snapshot.seats.B.joined && !lastSeatsJoined.B) {
    announce("Your partner joined.");
  }
  if (current.partner.submitted && !lastPartnerSubmitted) {
    announce("Your partner submitted their check.");
  }
  if (revealedCount > lastRevealedCount) {
    announce("Results revealed.");
  }
  lastSeatsJoined = { A: snapshot.seats.A.joined, B: snapshot.seats.B.joined };
  lastPartnerSubmitted = current.partner.submitted;
  lastRevealedCount = revealedCount;
}

function updateStatusBits(snapshot, current) {
  const seatsEl = root.querySelector(".seats");
  if (seatsEl) {
    seatsEl.outerHTML = seatsHtml(snapshot, (seat) => {
      const submitted = seat === snapshot.viewer?.seat ? current.mine.submitted : current.partner.submitted;
      return { done: submitted, label: submitted ? "Submitted" : "Not submitted" };
    });
  }
  maybeAnnounce(snapshot, current, snapshot.rounds.filter((r) => r.revealed).length);
}

function renderWaiting(snapshot) {
  const inviteUrl = `${window.location.origin}/join/${tableId}`;
  root.innerHTML = `
    ${tableMetaHtml(snapshot)}
    ${seatsHtml(snapshot, (seat) => ({ done: snapshot.seats[seat].joined, label: snapshot.seats[seat].joined ? "Joined" : "Not joined yet" }))}
    <h1>Waiting for your partner</h1>
    <p>This table has two seats. Send the invite link to one other person; the first case starts when they join.</p>
    <div class="panel">
      <label class="small muted" for="invite-url">Invite link for Checker B</label>
      <div class="invite">
        <input id="invite-url" type="text" readonly value="${escapeHtml(inviteUrl)}">
        <button class="btn" type="button" id="copy">Copy invite link</button>
      </div>
      <p class="hint">Testing on your own? Open the link in a second Chrome profile. Tabs in the same browser count as the same person.</p>
    </div>
  `;
  document.getElementById("copy").addEventListener("click", async () => {
    const button = document.getElementById("copy");
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      // clipboard may be unavailable; the input is still selectable by hand
    }
    button.textContent = "Copied";
    setTimeout(() => {
      button.textContent = "Copy invite link";
    }, 2000);
  });
}

function fieldset(key, legend, checked) {
  return `
    <fieldset class="field" data-field="${key}"><legend>${legend}</legend>
      <div class="choices">
        <label class="choice"><input type="radio" name="${key}" value="match"${checked[key] === "match" ? " checked" : ""}> Matches</label>
        <label class="choice"><input type="radio" name="${key}" value="mismatch"${checked[key] === "mismatch" ? " checked" : ""}> Does not match</label>
      </div>
    </fieldset>
  `;
}

function renderChecking(snapshot, current) {
  const { order, prepared, labels } = snapshot.fieldOrder;
  root.innerHTML = `
    ${tableMetaHtml(snapshot, `<span>Case <strong>${current.index}</strong> of ${snapshot.caseCount}</span>`)}
    ${seatsHtml(snapshot, (seat) => {
      const submitted = seat === snapshot.viewer?.seat ? current.mine.submitted : current.partner.submitted;
      return { done: submitted, label: submitted ? "Submitted" : "Not submitted" };
    })}
    <h1>${current.case.id}</h1>
    <p class="muted">Compare the two records. Your partner cannot see your answers until you have both submitted.</p>
    <div class="records">
      <section class="record" aria-labelledby="order-h">
        <h2 id="order-h">Order</h2>
        <dl>${recordRow(order, current.case.order)}</dl>
      </section>
      <section class="record record-label" aria-labelledby="prep-h">
        <h2 id="prep-h">Prepared record</h2>
        <dl>${recordRow(prepared, current.case.prepared)}</dl>
      </section>
    </div>
    <form class="check" aria-labelledby="check-h" id="check-form">
      <h2 id="check-h">Your check</h2>
      <p class="hint" style="margin:0 0 12px">Choose one answer for every field.</p>
      ${order.map((key) => fieldset(key, labels[key], draft)).join("")}
      <fieldset class="field overall" data-field="overall"><legend>Overall</legend>
        <div class="choices">
          <label class="choice"><input type="radio" name="overall" value="match"${draft.overall === "match" ? " checked" : ""}> Records match</label>
          <label class="choice"><input type="radio" name="overall" value="discrepancy"${draft.overall === "discrepancy" ? " checked" : ""}> Discrepancy found</label>
        </div>
      </fieldset>
      <div class="form-error" role="alert" id="form-error" hidden></div>
      <div class="actions">
        <button class="btn" type="submit">Submit my check</button>
        <span class="small muted">You can't change your answers after submitting.</span>
      </div>
    </form>
    ${glossaryHtml()}
  `;

  const form = document.getElementById("check-form");
  form.addEventListener("change", (e) => {
    if (e.target instanceof HTMLInputElement) draft[e.target.name] = e.target.value;
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitting) return;
    const answer = {};
    for (const key of [...FIELD_KEYS, "overall"]) {
      const checked = form.querySelector(`input[name="${key}"]:checked`);
      if (checked) answer[key] = checked.value;
    }
    const missingKeys = [...FIELD_KEYS, "overall"].filter((k) => !(k in answer));
    if (missingKeys.length > 0) {
      const errorEl = document.getElementById("form-error");
      errorEl.hidden = false;
      errorEl.textContent = `Choose an answer for every field before submitting. Missing: ${missingKeys
        .map((k) => (k === "overall" ? "Overall" : labels[k]))
        .join(", ")}.`;
      return;
    }
    submitting = true;
    const result = await apiFetch(`/api/tables/${tableId}/rounds/${current.id}/submissions`, {
      method: "POST",
      body: JSON.stringify({ answer }),
    });
    submitting = false;
    if (!result.ok) {
      const errorEl = document.getElementById("form-error");
      errorEl.hidden = false;
      errorEl.textContent =
        result.status === 400
          ? result.body?.error ?? "That answer was rejected."
          : "Couldn't reach the server. Your choices are kept; try again.";
      return;
    }
    render(result.body);
  });
}

function renderSubmitted(snapshot, current) {
  const { order, labels } = snapshot.fieldOrder;
  const mineAnswer = draft;
  root.innerHTML = `
    ${tableMetaHtml(snapshot, `<span>Case <strong>${current.index}</strong> of ${snapshot.caseCount}</span>`)}
    ${seatsHtml(snapshot, (seat) => {
      const submitted = seat === snapshot.viewer?.seat ? current.mine.submitted : current.partner.submitted;
      return { done: submitted, label: submitted ? "Submitted" : "Not submitted" };
    })}
    <div class="notice" role="status"><strong>Submitted.</strong> Your answers are locked. Both answers appear together when your partner submits. If they closed their browser, they can come back to this table from the same browser.</div>
    <form class="check" aria-label="Your check (locked)">
      <h2>Your check</h2>
      ${order
        .map(
          (key) => `
        <fieldset class="field" disabled><legend>${labels[key]}</legend>
          <div class="choices">
            <label class="choice"><input type="radio" value="match"${mineAnswer[key] === "match" ? " checked" : ""} disabled> Matches</label>
            <label class="choice"><input type="radio" value="mismatch"${mineAnswer[key] === "mismatch" ? " checked" : ""} disabled> Does not match</label>
          </div>
        </fieldset>
      `,
        )
        .join("")}
      <fieldset class="field overall" disabled><legend>Overall</legend>
        <div class="choices">
          <label class="choice"><input type="radio" value="match"${mineAnswer.overall === "match" ? " checked" : ""} disabled> Records match</label>
          <label class="choice"><input type="radio" value="discrepancy"${mineAnswer.overall === "discrepancy" ? " checked" : ""} disabled> Discrepancy found</label>
        </div>
      </fieldset>
    </form>
  `;
}

function revealTable(current) {
  const { fields } = current.reveal;
  const order = ["patient", "medicine", "dose", "route", "time", "overall"];
  const labels = { patient: "Patient", medicine: "Medicine", dose: "Dose", route: "Route", time: "Scheduled time", overall: "Overall" };
  const rows = order
    .map((key) => {
      const f = fields[key];
      const isOverall = key === "overall";
      const recordsCell = isOverall
        ? `<strong>${f.expected === "match" ? "Records match" : "Discrepancy"}</strong>`
        : f.expected === "match"
          ? "Match"
          : `<strong>Do not match</strong>`;
      const cell = (correct, value) => {
        const text = isOverall
          ? value === "match"
            ? "Records match"
            : "Discrepancy found"
          : value === "match"
            ? "Matches"
            : "Does not match";
        const resClass = correct ? "res-ok" : "res-bad";
        const resText = correct ? "Correct" : "Incorrect";
        const icon = correct ? "✓" : "✗";
        return `${text}<span class="res ${resClass}"><span aria-hidden="true">${icon}</span> ${resText}</span>`;
      };
      return `
        <tr${isOverall ? ' class="overall-row"' : ""}>
          <th scope="row">${labels[key]}</th>
          <td data-label="Records">${recordsCell}</td>
          <td data-label="Checker A">${cell(f.aCorrect, f.a)}</td>
          <td data-label="Checker B">${cell(f.bCorrect, f.b)}</td>
        </tr>
      `;
    })
    .join("");
  return `
    <table class="reveal">
      <caption>Field by field</caption>
      <thead><tr><th scope="col">Field</th><th scope="col">Records</th><th scope="col">Checker A</th><th scope="col">Checker B</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderRevealed(snapshot, current) {
  const { reveal } = current;
  const summaryTag = reveal.sameAnswer
    ? '<li class="tag tag-neutral">You gave the same answer</li>'
    : '<li class="tag tag-neutral">You gave different answers</li>';
  const aTag = `<li class="tag ${reveal.aFullyCorrect ? "tag-ok" : "tag-bad"}">Checker A: ${reveal.aFullyCorrect ? "fully correct" : "not fully correct"}</li>`;
  const bTag = `<li class="tag ${reveal.bFullyCorrect ? "tag-ok" : "tag-bad"}">Checker B: ${reveal.bFullyCorrect ? "fully correct" : "not fully correct"}</li>`;

  const agreedWrong = reveal.sameAnswer && !reveal.aFullyCorrect && !reveal.bFullyCorrect;
  const isLast = current.index === snapshot.caseCount;

  root.innerHTML = `
    ${tableMetaHtml(snapshot, `<span>Case <strong>${current.index}</strong> of ${snapshot.caseCount}</span>`)}
    <h1>${current.case.id} · Results</h1>
    <ul class="summary" aria-label="Summary">${summaryTag}${aTag}${bTag}</ul>
    ${agreedWrong ? '<div class="notice notice-agreed-wrong"><strong>You agreed, but the records show a different result.</strong> Agreement is not the same as accuracy: two checks can miss the same thing.</div>' : ""}
    ${revealTable(current)}
    <section class="explain" aria-labelledby="explain-h">
      <h3 id="explain-h">What the records show</h3>
      <p>${escapeHtml(reveal.teachingPoint)}</p>
    </section>
    <div class="actions">
      <button class="btn" type="button" id="next">${isLast ? "See summary" : "Next case"}</button>
      <span class="small muted">Either checker can move you both on.</span>
    </div>
  `;

  document.getElementById("next").addEventListener("click", async () => {
    if (isLast) {
      reviewing = true;
      renderReview(snapshot);
      return;
    }
    const button = document.getElementById("next");
    button.disabled = true;
    const result = await apiFetch(`/api/tables/${tableId}/next`, {
      method: "POST",
      body: JSON.stringify({ fromRoundId: current.id }),
    });
    if (result.ok) render(result.body);
    else button.disabled = false;
  });
}

function renderReview(snapshot) {
  const revealedRounds = snapshot.rounds.filter((r) => r.revealed);
  const aCorrect = revealedRounds.filter((r) => r.reveal.aFullyCorrect).length;
  const bCorrect = revealedRounds.filter((r) => r.reveal.bFullyCorrect).length;
  const bothMissed = revealedRounds.filter((r) => !r.reveal.aFullyCorrect && !r.reveal.bFullyCorrect).length;

  const items = revealedRounds
    .map((r) => {
      const desc = r.reveal.sameAnswer ? "same answer" : "different answers";
      let outcome;
      if (r.reveal.aFullyCorrect && r.reveal.bFullyCorrect) outcome = "both correct";
      else if (!r.reveal.aFullyCorrect && !r.reveal.bFullyCorrect) outcome = "both missed";
      else outcome = r.reveal.aFullyCorrect ? "A correct" : "B correct";
      return `<li><span><strong>${r.case.id}</strong> · ${desc} · ${outcome}</span><a href="#review-${r.index}">Review</a></li>`;
    })
    .join("");

  const details = revealedRounds
    .map(
      (r) => `
      <section id="review-${r.index}" class="explain">
        <h3>${r.case.id}</h3>
        ${revealTable(r)}
        <p>${escapeHtml(r.reveal.teachingPoint)}</p>
      </section>
    `,
    )
    .join("");

  root.innerHTML = `
    <h1>All six cases checked</h1>
    <p class="lead">Here is how your two independent checks compared.</p>
    <ul class="stats">
      <li class="stat"><span class="num">${revealedRounds.length}/${snapshot.caseCount}</span><span class="lbl">Cases completed</span></li>
      <li class="stat"><span class="num">${aCorrect}/${snapshot.caseCount}</span><span class="lbl">Checker A: fully correct</span></li>
      <li class="stat"><span class="num">${bCorrect}/${snapshot.caseCount}</span><span class="lbl">Checker B: fully correct</span></li>
      <li class="stat"><span class="num">${bothMissed}</span><span class="lbl">Case${bothMissed === 1 ? "" : "s"} you both missed</span></li>
    </ul>
    <h2>Cases</h2>
    <ul class="item-list">${items}</ul>
    <p class="small muted">These counts describe this table only. They are not a measure of clinical competence.</p>
    <div class="actions">
      <a class="btn" href="/">Start a new table</a>
      <a class="btn btn-secondary" href="/tables">My tables</a>
    </div>
    ${details}
  `;
}

function connectSse() {
  const source = new EventSource(`/api/tables/${tableId}/events`);
  source.onopen = () => {
    const conn = document.getElementById("conn");
    if (conn) {
      conn.textContent = "Connected";
      conn.classList.remove("is-reconnecting");
    }
  };
  source.onerror = () => {
    const conn = document.getElementById("conn");
    if (conn) {
      conn.textContent = "Reconnecting…";
      conn.classList.add("is-reconnecting");
    }
  };
  source.onmessage = (event) => {
    render(JSON.parse(event.data));
  };
}

connectSse();
