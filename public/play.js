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

function otherSeat(seat) {
  return seat === "A" ? "B" : "A";
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

// Sign-off strip, join variant (brief UI reference State 2): "Joined" / "Not
// joined yet", no checkmark or sealed note.
function joinSignoffHtml(snapshot) {
  const { seats, viewer } = snapshot;
  const cardFor = (seat) => {
    const joined = seats[seat].joined;
    const you = viewer?.seat === seat ? " (you)" : "";
    return `<div class="sig${joined ? " is-signed" : ""}"><span class="sig-role">Checker ${seat}${you}</span><span class="sig-line">${joined ? "Joined" : "Not joined yet"}</span></div>`;
  };
  return `<div class="signoff" aria-label="Checkers">${cardFor("A")}${cardFor("B")}</div>`;
}

// Sign-off strip, checking/signed variant (brief UI reference States 4-5):
// "Awaiting signature" / "✓ Signed", with a sealed note on whichever side is
// signed, worded from the viewer's point of view.
function checkSignoffHtml(snapshot, current) {
  const viewerSeat = snapshot.viewer?.seat;
  const cardFor = (seat) => {
    const signed = seat === viewerSeat ? current.mine.submitted : current.partner.submitted;
    const you = seat === viewerSeat ? " (you)" : "";
    if (!signed) {
      return `<div class="sig"><span class="sig-role">Checker ${seat}${you}</span><span class="sig-line">Awaiting signature</span></div>`;
    }
    const note = seat === viewerSeat ? "Sealed until both sign" : "Sealed until you sign";
    return `<div class="sig is-signed"><span class="sig-role">Checker ${seat}${you}</span><span class="sig-line"><span aria-hidden="true">✓</span> Signed</span><span class="sig-note">${note}</span></div>`;
  };
  return `<div class="signoff" aria-label="Sign-off">${cardFor("A")}${cardFor("B")}</div>`;
}

// Progress strip (brief UI reference State 4, six steps fixed per brief §3).
function progressHtml(caseCount, currentIndex, allDone) {
  const ariaLabel = allDone ? "Progress, all six cases done" : `Progress, case ${currentIndex} of ${caseCount}`;
  const items = [];
  for (let i = 1; i <= caseCount; i++) {
    if (allDone || i < currentIndex) {
      items.push(`<li class="is-done"><span class="sr-only">Case </span>${i}<span class="sr-only">, done</span></li>`);
    } else if (i === currentIndex) {
      items.push(`<li class="is-current" aria-current="step"><span class="sr-only">Case </span>${i}<span class="sr-only">, current</span></li>`);
    } else {
      items.push(`<li><span class="sr-only">Case </span>${i}</li>`);
    }
  }
  return `<ol class="progress" aria-label="${ariaLabel}">${items.join("")}</ol>`;
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
    nextMode = "signed";
  } else {
    nextMode = "checking";
  }

  const sameRound = nextMode === mode && current.id === roundId;
  const revealedCount = snapshot.rounds.filter((r) => r.revealed).length;

  if (sameRound && (nextMode === "checking" || nextMode === "signed")) {
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
  else if (mode === "signed") renderSigned(snapshot, current);
  else if (mode === "revealed") renderRevealed(snapshot, current);
  else if (mode === "review") renderReview(snapshot);
}

function maybeAnnounce(snapshot, current, revealedCount) {
  if (snapshot.seats.A.joined && snapshot.seats.B.joined && !lastSeatsJoined.B) {
    announce("Your partner joined.");
  }
  if (current.partner.submitted && !lastPartnerSubmitted) {
    announce("Your partner signed their check.");
  }
  if (revealedCount > lastRevealedCount) {
    announce("Results revealed.");
  }
  lastSeatsJoined = { A: snapshot.seats.A.joined, B: snapshot.seats.B.joined };
  lastPartnerSubmitted = current.partner.submitted;
  lastRevealedCount = revealedCount;
}

function updateStatusBits(snapshot, current) {
  const signoffEl = root.querySelector(".signoff");
  if (signoffEl) {
    signoffEl.outerHTML = checkSignoffHtml(snapshot, current);
  }
  maybeAnnounce(snapshot, current, snapshot.rounds.filter((r) => r.revealed).length);
}

function renderWaiting(snapshot) {
  const inviteUrl = `${window.location.origin}/join/${tableId}`;
  root.innerHTML = `
    ${tableMetaHtml(snapshot)}
    ${joinSignoffHtml(snapshot)}
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

function recordCard(idPrefix, heading, kind, order, values, isLabel) {
  return `
    <section class="record${isLabel ? " record-label" : ""}" aria-labelledby="${idPrefix}-h">
      <div class="record-head"><h2 id="${idPrefix}-h">${heading}</h2><span class="kind">${kind}</span></div>
      <dl>${recordRow(order, values)}</dl>
      ${isLabel ? '<div class="label-foot" aria-hidden="true"><span class="barcode"></span><span class="code">TRAINING LABEL · NOT FOR USE</span></div>' : ""}
    </section>
  `;
}

function recordsHtml(snapshot, current) {
  const { order, prepared } = snapshot.fieldOrder;
  return `
    <div class="records">
      ${recordCard("order", "Order", "Medication chart", order, current.case.order, false)}
      ${recordCard("prep", "Prepared record", "Pharmacy label ℞", prepared, current.case.prepared, true)}
    </div>
  `;
}

function fieldset(key, legend, checked) {
  return `
    <fieldset class="field"><legend>${legend}</legend>
      <div class="choices">
        <label class="choice"><input type="radio" name="${key}" value="match"${checked[key] === "match" ? " checked" : ""}> Matches</label>
        <label class="choice"><input type="radio" name="${key}" value="mismatch"${checked[key] === "mismatch" ? " checked" : ""}> Does not match</label>
      </div>
    </fieldset>
  `;
}

function renderChecking(snapshot, current) {
  const { order, labels } = snapshot.fieldOrder;
  const seat = snapshot.viewer?.seat;
  root.innerHTML = `
    ${tableMetaHtml(snapshot, `<span>Case <strong>${current.index}</strong> of ${snapshot.caseCount}</span>`)}
    ${progressHtml(snapshot.caseCount, current.index, false)}
    ${checkSignoffHtml(snapshot, current)}
    <h1>${current.case.id}</h1>
    <p class="muted">Compare the order with the prepared record. Your partner cannot see your answers until you have both signed.</p>
    ${recordsHtml(snapshot, current)}
    <form class="check" aria-labelledby="check-h" id="check-form">
      <div class="check-head">
        <h2 id="check-h">Independent double check</h2>
        <p>Checker ${seat} · choose one answer for every line, then sign.</p>
      </div>
      <div class="check-body">
        ${order.map((key) => fieldset(key, labels[key], draft)).join("")}
        <fieldset class="field overall"><legend>Overall</legend>
          <div class="choices">
            <label class="choice"><input type="radio" name="overall" value="match"${draft.overall === "match" ? " checked" : ""}> Records match</label>
            <label class="choice"><input type="radio" name="overall" value="discrepancy"${draft.overall === "discrepancy" ? " checked" : ""}> Discrepancy found</label>
          </div>
        </fieldset>
        <div class="form-error" role="alert" id="form-error" hidden></div>
        <div class="sign">
          <button class="btn" type="submit">Sign and submit</button>
          <span class="sign-label">Signing seals your check. You can't change it afterwards, and your partner sees it only once they have signed too.</span>
        </div>
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
      errorEl.textContent = `Choose an answer for every line before signing. Missing: ${missingKeys
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

function renderSigned(snapshot, current) {
  const { order, labels } = snapshot.fieldOrder;
  const seat = snapshot.viewer?.seat;
  const partnerSeat = otherSeat(seat);
  const mineAnswer = draft;
  root.innerHTML = `
    ${tableMetaHtml(snapshot, `<span>Case <strong>${current.index}</strong> of ${snapshot.caseCount}</span>`)}
    ${progressHtml(snapshot.caseCount, current.index, false)}
    ${checkSignoffHtml(snapshot, current)}
    <div class="notice" role="status"><strong>Signed.</strong> Your check is sealed. Both checks open together when Checker ${partnerSeat} signs. If they closed their browser, they can come back to this table from the same browser.</div>
    ${recordsHtml(snapshot, current)}
    <form class="check" aria-label="Your check (sealed)">
      <div class="check-head"><h2>Independent double check</h2><p>Checker ${seat} · sealed</p></div>
      <div class="check-body">
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
      </div>
    </form>
  `;
}

// Per-field outcome for each seat, derived only from the already-revealed
// reveal.fields (expected + each seat's answer and correctness) -- never
// from case-module internals, since those are server-only (brief §5).
function fieldOutcomes(fields) {
  const outcomes = { A: { missed: [], flagged: [] }, B: { missed: [], flagged: [] } };
  for (const key of FIELD_KEYS) {
    const f = fields[key];
    if (!f.aCorrect) (f.expected === "mismatch" ? outcomes.A.missed : outcomes.A.flagged).push(key);
    if (!f.bCorrect) (f.expected === "mismatch" ? outcomes.B.missed : outcomes.B.flagged).push(key);
  }
  return outcomes;
}

function resultCellHtml(fullyCorrect, outcome) {
  if (fullyCorrect) {
    return '<span class="res res-ok" style="margin:0"><span aria-hidden="true">✓</span> Correct</span>';
  }
  const parts = [];
  if (outcome.missed.length) parts.push(`Missed ${outcome.missed.join(", ")}`);
  if (outcome.flagged.length) parts.push(`Flagged ${outcome.flagged.join(", ")}`);
  return `<span class="res res-bad" style="margin:0"><span aria-hidden="true">✗</span> ${escapeHtml(parts.join("; "))}</span>`;
}

function revealTable(current, viewerSeat) {
  const { fields } = current.reveal;
  const order = ["patient", "medicine", "dose", "route", "time", "overall"];
  const labels = { patient: "Patient", medicine: "Medicine", dose: "Dose", route: "Route", time: "Scheduled time", overall: "Overall" };
  const colHeading = (seat) => `Checker ${seat}${seat === viewerSeat ? " (you)" : ""}`;
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
          <td data-label="${colHeading("A")}">${cell(f.aCorrect, f.a)}</td>
          <td data-label="${colHeading("B")}">${cell(f.bCorrect, f.b)}</td>
        </tr>
      `;
    })
    .join("");
  return `
    <table class="reveal">
      <caption>Line by line</caption>
      <thead><tr><th scope="col">Field</th><th scope="col">Records</th><th scope="col">${colHeading("A")}</th><th scope="col">${colHeading("B")}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function pairReviewHtml(pair) {
  return `
    <section class="pair" aria-labelledby="pair-h">
      <span class="eyebrow" id="pair-h">Pair review</span>
      <p>${escapeHtml(pair.text)}</p>
      ${pair.detail ? `<p class="detail">${escapeHtml(pair.detail)}</p>` : ""}
    </section>
  `;
}

function renderRevealed(snapshot, current) {
  const { reveal } = current;
  const viewerSeat = snapshot.viewer?.seat;
  const summaryTag = reveal.sameAnswer
    ? '<li class="tag tag-neutral">You gave the same answer</li>'
    : '<li class="tag tag-neutral">You gave different answers</li>';
  const aTag = `<li class="tag ${reveal.aFullyCorrect ? "tag-ok" : "tag-bad"}">Checker A: ${reveal.aFullyCorrect ? "fully correct" : "not fully correct"}</li>`;
  const bTag = `<li class="tag ${reveal.bFullyCorrect ? "tag-ok" : "tag-bad"}">Checker B: ${reveal.bFullyCorrect ? "fully correct" : "not fully correct"}</li>`;

  const agreedWrong = reveal.sameAnswer && !reveal.aFullyCorrect && !reveal.bFullyCorrect;
  const isLast = current.index === snapshot.caseCount;

  root.innerHTML = `
    ${tableMetaHtml(snapshot, `<span>Case <strong>${current.index}</strong> of ${snapshot.caseCount}</span>`)}
    ${progressHtml(snapshot.caseCount, current.index, false)}
    <span class="eyebrow">Both checks opened</span>
    <h1>${current.case.id} · Results</h1>
    <ul class="summary" aria-label="Summary">${summaryTag}${aTag}${bTag}</ul>
    ${agreedWrong ? '<div class="notice notice-agreed-wrong"><strong>You agreed, but the records show a different result.</strong> Agreement is not the same as accuracy: two checks can miss the same thing.</div>' : ""}
    ${pairReviewHtml(reveal.pair)}
    ${revealTable(current, viewerSeat)}
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
  const viewerSeat = snapshot.viewer?.seat;
  const partnerSeat = otherSeat(viewerSeat);
  const revealedRounds = snapshot.rounds.filter((r) => r.revealed);
  const aCorrect = revealedRounds.filter((r) => r.reveal.aFullyCorrect).length;
  const bCorrect = revealedRounds.filter((r) => r.reveal.bFullyCorrect).length;
  const bothMissed = revealedRounds.filter((r) => !r.reveal.aFullyCorrect && !r.reveal.bFullyCorrect).length;

  const youHeading = `You (${viewerSeat})`;
  const partnerHeading = `Partner (${partnerSeat})`;

  const rows = revealedRounds
    .map((r) => {
      const outcomes = fieldOutcomes(r.reveal.fields);
      const yourFullyCorrect = viewerSeat === "A" ? r.reveal.aFullyCorrect : r.reveal.bFullyCorrect;
      const partnerFullyCorrect = viewerSeat === "A" ? r.reveal.bFullyCorrect : r.reveal.aFullyCorrect;
      const yourOutcome = viewerSeat === "A" ? outcomes.A : outcomes.B;
      const partnerOutcome = viewerSeat === "A" ? outcomes.B : outcomes.A;
      return `
        <tr>
          <th scope="row"><a href="#review-${r.index}">${r.case.id}</a></th>
          <td data-label="${youHeading}">${resultCellHtml(yourFullyCorrect, yourOutcome)}</td>
          <td data-label="${partnerHeading}">${resultCellHtml(partnerFullyCorrect, partnerOutcome)}</td>
          <td data-label="Same answer">${r.reveal.sameAnswer ? "Yes" : "No"}</td>
          <td data-label="Teaching point">${escapeHtml(r.reveal.teachingPoint)}</td>
        </tr>
      `;
    })
    .join("");

  const details = revealedRounds
    .map(
      (r) => `
      <section id="review-${r.index}" class="explain">
        <h3>${r.case.id}</h3>
        ${pairReviewHtml(r.reveal.pair)}
        ${revealTable(r, viewerSeat)}
        <p>${escapeHtml(r.reveal.teachingPoint)}</p>
      </section>
    `,
    )
    .join("");

  root.innerHTML = `
    ${progressHtml(snapshot.caseCount, snapshot.caseCount, true)}
    <span class="eyebrow">Check complete</span>
    <h1>All six cases checked</h1>
    <p class="lead">Here is how your two independent checks compared.</p>
    <ul class="stats">
      <li class="stat"><span class="num">${revealedRounds.length}/${snapshot.caseCount}</span><span class="lbl">Cases completed</span></li>
      <li class="stat"><span class="num">${aCorrect}/${snapshot.caseCount}</span><span class="lbl">Checker A${viewerSeat === "A" ? " (you)" : ""}: fully correct</span></li>
      <li class="stat"><span class="num">${bCorrect}/${snapshot.caseCount}</span><span class="lbl">Checker B${viewerSeat === "B" ? " (you)" : ""}: fully correct</span></li>
      <li class="stat"><span class="num">${bothMissed}</span><span class="lbl">Case${bothMissed === 1 ? "" : "s"} you both missed</span></li>
    </ul>
    <table class="reveal">
      <caption>Case by case</caption>
      <thead><tr><th scope="col">Case</th><th scope="col">${youHeading}</th><th scope="col">${partnerHeading}</th><th scope="col">Same answer</th><th scope="col">Teaching point</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
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
