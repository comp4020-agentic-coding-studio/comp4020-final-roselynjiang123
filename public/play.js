import { renderShell, appRoot, announce, apiFetch, escapeHtml } from "./shell.js";

renderShell(null);

const tableId = window.location.pathname.split("/").pop();
const root = appRoot();
root.innerHTML = `<p class="muted">Loading…</p>`;

// view state not derivable from the server snapshot alone
let mode = null;
let roundId = null;
let draft = { fields: {}, action: null, evidenceId: null };
let submitting = false;
let lastSeatsJoined = { A: false, B: false };
let lastPartnerSubmitted = false;
let lastRevealedCount = 0;
// The most recent full snapshot, kept so a suggestion/case link (which opens
// a past round's debrief, brief §8.3: "Each suggestion links to its cases'
// debriefs") can return to wherever the live table actually stands, without
// re-fetching. Set at the top of every real render(); never read inside
// renderHistoryDebrief's own markup, only by its "Back" button.
let lastSnapshot = null;

// Summary caveat (brief §11 "Summary caveat", shown under every summary).
const SUMMARY_CAVEAT =
  "This summary describes the completed cases shown here. Small numbers, repeated cases and use of the same browser may affect interpretation. Results do not establish clinical competence or show that the exercise improves patient outcomes.";

// Event delegation (brief §8.3's debrief links): attached once to the
// persistent #app root, not re-attached per render, since innerHTML
// replacement only replaces root's children, never root itself.
root.addEventListener("click", (e) => {
  if (!(e.target instanceof Element)) return;
  const link = e.target.closest("[data-round-id]");
  if (!link) return;
  e.preventDefault();
  openCaseDebrief(link.getAttribute("data-round-id"));
});

function otherSeat(seat) {
  return seat === "A" ? "B" : "A";
}

function nameOf(patient) {
  return `${patient.givenName} ${patient.familyName}`;
}

// Pair note with its source link (brief §6.1: "appears on the waiting
// screen and in the Guide with links to its setting.pairNoteSourceIds;
// every source link points to /sources/#<sourceId>"). v2.1 reference copy:
// one link per source, "Source: {org}".
function pairNoteHtml(setting) {
  if (!setting) return "";
  const links = (setting.pairNoteSources ?? [])
    .map((s) => ` <a href="/sources/#${escapeHtml(s.id)}">Source: ${escapeHtml(s.org)}</a>`)
    .join("");
  return `${escapeHtml(setting.pairNote)}${links}`;
}

// Status strip (v2.1 reference, U02: table code, seat badges A/B with
// Signed/Checking, case n of 6 or new situation n of 3, connection). One
// polite live region (U15): SSE updates re-render this element's content
// via innerHTML replacement, never steal focus, since nothing here calls
// .focus() and no input exists inside it.
function statusStripHtml(snapshot, current, caseLabel) {
  const viewerSeat = snapshot.viewer?.seat;
  const seatPill = (seat) => {
    const signed = seat === viewerSeat ? current?.mine?.submitted : current?.partner?.submitted;
    if (!current) return "";
    return signed ? '<span class="pill ok">✓ Signed</span>' : '<span class="pill wait">Checking…</span>';
  };
  return `
    <div class="status" role="status" aria-live="polite">
      <span>Table <b class="mono">${snapshot.table.code}</b></span>
      <span class="seat"><span class="badge" aria-hidden="true">A</span>${viewerSeat === "A" ? "<b>You</b> (Checker A)" : "Checker A"} ${seatPill("A")}</span>
      <span class="seat"><span class="badge b" aria-hidden="true">B</span>${viewerSeat === "B" ? "<b>You</b> (Checker B)" : "Checker B"} ${snapshot.seats.B.joined ? seatPill("B") : '<span class="pill wait">Waiting to join</span>'}</span>
      ${caseLabel ? `<span>${caseLabel}</span>` : ""}
      <span class="conn" id="conn">Connected</span>
    </div>
  `;
}

function progressDotsHtml(index, total) {
  const dots = [];
  for (let i = 1; i <= total; i++) {
    dots.push(`<i class="${i < index ? "done" : i === index ? "now" : ""}"></i>`);
  }
  return `<span class="dots" aria-hidden="true">${dots.join("")}</span>`;
}

// Phase-relative position (U03: "Case n of 6 · {neutral title}"; brief §5's
// "new situation n of 3" for transfer): current.index is the round's global
// position across training+transfer (1..9), so this converts it to a 1..6
// or 1..3 position within its own phase for the status strip and progress
// dots -- using it unconverted during transfer would make every dot look
// "done" against a 6-dot total that no longer applies.
function phasePosition(snapshot, current) {
  const isTraining = current.case.phase === "training";
  const total = isTraining ? snapshot.trainingCaseCount : snapshot.transferCaseCount;
  const index = isTraining ? current.index : current.index - snapshot.trainingCaseCount;
  const label = isTraining ? `Case ${index} of ${total}` : `New situation ${index} of ${total}`;
  return { index, total, label };
}

function render(snapshot) {
  lastSnapshot = snapshot;
  const current = snapshot.rounds[snapshot.rounds.length - 1];
  const seatsBothJoined = snapshot.seats.A.joined && snapshot.seats.B.joined;

  let nextMode;
  if (!seatsBothJoined) {
    nextMode = "waiting";
  } else if (snapshot.table.stage === "training_summary") {
    nextMode = "summary";
  } else if (snapshot.table.stage === "completed") {
    nextMode = "end";
  } else if (current.revealed) {
    nextMode = "debrief";
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
  draft = { fields: {}, action: null, evidenceId: null };
  lastSeatsJoined = { A: snapshot.seats.A.joined, B: snapshot.seats.B.joined };
  lastPartnerSubmitted = current.partner.submitted;
  lastRevealedCount = revealedCount;

  if (mode === "waiting") renderWaiting(snapshot);
  else if (mode === "checking") renderChecking(snapshot, current);
  else if (mode === "signed") renderSigned(snapshot, current);
  else if (mode === "debrief") renderDebrief(snapshot, current);
  else if (mode === "summary") renderSummary(snapshot);
  else if (mode === "end") renderEnd(snapshot);
}

// Transfer-intro banner (reference state "transfer-intro", brief §5's
// "transfer-intro banner + checking/signed/debrief" row): shown once, above
// the first new-situation round only (brief: "These three are counted
// separately from training, so you can see whether the method carries over
// to something you haven't seen"), never repeated for T2/T3.
function transferIntroHtml(snapshot, current) {
  const isFirstTransferRound = current.case.phase === "transfer" && current.index === snapshot.trainingCaseCount + 1;
  if (!isFirstTransferRound) return "";
  return `
    <div class="card pad" style="border-left:5px solid var(--primary-2)">
      <p class="kicker">New situations · transfer</p>
      <h2>New patients and different numbers. Check exactly as before.</h2>
      <p>These three are counted separately from training, so you can see whether the method carries over to something you haven't seen.</p>
    </div>
  `;
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

// Status strip refresh on an SSE push without a full re-render (U15:
// "SSE updates never steal focus or clear unsent choices"): only the
// status strip's own markup is replaced, leaving the check form and its
// unsent radio selections alone.
function updateStatusBits(snapshot, current) {
  const statusEl = root.querySelector(".status");
  if (statusEl) {
    const pos = phasePosition(snapshot, current);
    statusEl.outerHTML = statusStripHtml(snapshot, current, `${pos.label} ${progressDotsHtml(pos.index, pos.total)}`);
  }
  maybeAnnounce(snapshot, current, snapshot.rounds.filter((r) => r.revealed).length);
}

function renderWaiting(snapshot) {
  const inviteUrl = `${window.location.origin}/join/${tableId}`;
  root.innerHTML = `
    ${statusStripHtml(snapshot, null, null)}
    <div class="two" style="margin-top:0">
      <div class="card pad">
        <h1>Waiting for your partner</h1>
        <p>Send this link to your partner. They open it in their own browser and click <b>Join</b>.</p>
        <div class="invite"><label class="sr" for="inv">Invite link</label><input id="inv" readonly value="${escapeHtml(inviteUrl)}"><button class="btn" type="button" id="copy">Copy link</button></div>
        <p class="fine">The link admits one second browser. It doesn't check who is using it.</p>
        <div class="coach mt" style="border-top:1px dashed var(--line, #ccc);padding-top:14px">
          <span class="ava" data-sprite="lee" data-scale="2.4"></span>
          <div><b>Lee · clinical facilitator</b><br>Morning. Six patients, six medicines. Check each one on your own — don't tell your partner what you find until you've both signed. Mistakes here are how we learn; nothing you choose reaches a real patient.</div>
        </div>
        <p class="note">${pairNoteHtml(snapshot.setting)}</p>
      </div>
      <div class="card pad">
        <h2>Before you start</h2>
        <ul class="know" id="before-you-start-list"></ul>
        <p class="fine">Draft · not yet source checked · <a href="/sources/">sources</a></p>
      </div>
    </div>
  `;
  const list = document.getElementById("before-you-start-list");
  if (snapshot.knowledgeCard) {
    list.innerHTML = snapshot.knowledgeCard.sections
      .map((s) => `<li><b>${escapeHtml(s.heading)}.</b> ${escapeHtml(s.body)}</li>`)
      .join("");
  }
  document.getElementById("copy").addEventListener("click", async () => {
    const button = document.getElementById("copy");
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      // clipboard may be unavailable; the input is still selectable by hand
    }
    button.textContent = "Copied";
    setTimeout(() => {
      button.textContent = "Copy link";
    }, 2000);
  });
}

// Patient strip (U03/U04): sprite, name, age, bed, reason, quote, ID band,
// ward date/time (never the device clock -- caseDef.simulationDateTime),
// optional second-check note. The quote carries data-evidence="patient_words"
// (U09/data-evidence wiring, brief §8.2's materials highlight): it's the one
// evidence option about something the patient said, not a chart field.
function patientStripHtml(caseDef) {
  const p = caseDef.patient;
  const bandClass = p.band === "red" ? "band red" : "band";
  return `
    <section class="card bed" aria-label="Patient">
      <div class="portrait" data-sprite="patient" data-hair="${p.sprite.hair}" data-skin="${p.sprite.skin}" data-gown="${p.sprite.gown}" data-scale="4.5"></div>
      <div>
        <p class="kicker">Bed ${escapeHtml(p.bed)} · ${escapeHtml(caseDef.simulationDateTime ? "" : "")}</p>
        <h2>${escapeHtml(nameOf(p))}</h2>
        <div class="meta">${p.age} years · ${escapeHtml(p.reason)}</div>
        <div class="bubble"><span class="ev" data-evidence="patient_words">“${escapeHtml(p.quote)}”</span></div>
        <div class="bandrow"><span class="kicker" style="margin:0">ID band</span>
          <div class="${bandClass}"><div class="panel"><div><div class="who"><span class="ev" data-evidence="identifiers">${escapeHtml(p.familyName)}, ${escapeHtml(p.givenName)}</span></div><div class="ids"><span class="ev" data-evidence="identifiers">DOB ${escapeHtml(p.dob)} · ${escapeHtml(p.sex)}<br>MRN ${escapeHtml(p.mrn)}</span></div></div><div class="barcode" aria-hidden="true"></div></div></div>
        </div>
      </div>
      <div class="clock">
        <div><div class="d">${escapeHtml(caseDef.simulationDateTime ?? "")}</div><div class="d">Ward time</div></div>
      </div>
      ${caseDef.secondCheckNote ? `<div class="tag">⚑ ${escapeHtml(caseDef.secondCheckNote)}</div>` : ""}
    </section>
  `;
}

// Order and Prepared records side by side (U05/U06): medication chart with
// allergy box, order grid and administration record; the pharmacy label.
// data-evidence tags (U09 materials highlight) map each element to the
// evidence option it actually represents: total_amount on dose/strength/
// quantity, identifiers on patient/MRN fields, admin_record on the
// administration record and frequency, allergy_record on the allergy box,
// route_form on route/form; always present in markup, lit up post-reveal by
// .reveal .ev (applied as a class on #recgrid, see renderDebrief).
function recordsHtml(caseDef) {
  const chart = caseDef.chart;
  const prepared = caseDef.prepared;
  const order = chart.order;
  const adminRows = chart.administrationRecord
    .map(
      (r) => `<tr><td>${escapeHtml(r.date)}</td><td><span class="ev" data-evidence="admin_record">${escapeHtml(r.time)}</span></td><td>${escapeHtml(r.dose)}</td><td>${escapeHtml(r.route)}</td><td>${escapeHtml(r.givenBy)}</td><td>${escapeHtml(r.witness ?? "—")}</td></tr>`,
    )
    .join("");
  return `
    <div class="records" id="recgrid">
      <section class="card" aria-label="Order: medication chart">
        <div class="rec-h"><div class="ttl">Order · medication chart</div><div class="idbox"><span class="ev" data-evidence="identifiers">MRN ${escapeHtml(caseDef.patient.mrn)}<br>${escapeHtml(caseDef.patient.familyName)}, ${escapeHtml(caseDef.patient.givenName)}<br>DOB ${escapeHtml(caseDef.patient.dob)}</span></div></div>
        <div class="adr"><span class="k">Allergies &amp; adverse reactions</span><span class="ev" data-evidence="allergy_record"><b>${escapeHtml(chart.allergies.text)}</b> · checked ${escapeHtml(chart.allergies.checkedBy)}</span></div>
        <div class="grid4">
          <div class="wide"><span class="k">Medicine (generic name)</span><span class="v">${escapeHtml(order.medicine)}</span></div>
          <div><span class="k">Route</span><span class="v"><span class="ev" data-evidence="route_form">${escapeHtml(order.route)}</span></span></div>
          <div><span class="k">Dose</span><span class="v"><span class="ev" data-evidence="total_amount">${escapeHtml(order.dose)}</span></span></div>
          <div><span class="k">Frequency</span><span class="v"><span class="ev" data-evidence="admin_record">${escapeHtml(order.frequency)}</span></span></div>
          <div><span class="k">Max PRN / 24 h</span><span class="v">${escapeHtml(order.prnMax24h ?? "—")}</span></div>
          <div><span class="k">Indication</span><span class="v">${escapeHtml(order.indication)}</span></div>
          <div><span class="k">Prescriber</span><span class="sig">${escapeHtml(order.prescriber)}</span></div>
        </div>
        <table class="admin">
          <caption>Administration record</caption>
          <thead><tr><th>Date</th><th>Time</th><th>Dose</th><th>Route</th><th>Given</th><th>Witness</th></tr></thead>
          <tbody>${adminRows}</tbody>
        </table>
      </section>
      <section class="card" aria-label="Prepared medicine">
        <div class="rec-h prep"><div class="ttl">Prepared medicine</div><small>Prepared by ${escapeHtml(prepared.preparedBy)}</small></div>
        <div class="prep-body">
          <div class="label"><div class="stripe"></div><div class="in">
            <div class="gen">${escapeHtml(prepared.product.name)}</div>
            <div class="form"><span class="ev" data-evidence="route_form">${escapeHtml(prepared.product.form)}</span></div>
            <div class="str"><span class="ev" data-evidence="total_amount">${escapeHtml(prepared.product.strength)}</span></div>
            <div class="row"><span class="train">TRAINING LABEL</span></div>
          </div></div>
          <div class="qty"><span class="k">Quantity prepared</span><span class="vol"><span class="ev" data-evidence="total_amount">${escapeHtml(prepared.quantity)}</span></span></div>
          <div class="forbox"><span class="k">Prepared for</span><span class="ev" data-evidence="identifiers">${escapeHtml(prepared.preparedFor.name)} · DOB ${escapeHtml(prepared.preparedFor.dob)}<br>MRN ${escapeHtml(prepared.preparedFor.mrn)} · Bed ${escapeHtml(prepared.preparedFor.bed)}</span><br><span class="k" style="margin-top:4px">For</span>${escapeHtml(prepared.forTime)}</div>
        </div>
      </section>
    </div>
  `;
}

// Toolbox (U08): Before you start + the medicine card(s) for this case,
// collapsible via native <details>, keyboard operable with no extra JS.
// Opening an item posts a usage event via POST /api/tables/:id/log (brief
// §9), matching src/repo.mjs's allowlist: a medicine card's own id, or
// "knowledge:<sectionHeading>" for a knowledge-card section.
function toolboxHtml(caseDef) {
  const cards = caseDef.medicineCards
    .map(
      (m) => `
      <details data-log-ref="${escapeHtml(m.id)}">
        <summary>Medicine card: ${escapeHtml(m.name)}</summary>
        <dl>
          <dt>What it is</dt><dd>${escapeHtml(m.whatItIs)}</dd>
          <dt>What to watch</dt><dd>${escapeHtml(m.whatToWatch)}</dd>
          <dt>Sources</dt><dd><span class="review">Draft · not yet source checked</span></dd>
        </dl>
      </details>
    `,
    )
    .join("");
  const knowledgeSections = (caseDef.knowledgeCard?.sections ?? [])
    .map(
      (s) => `<li data-log-ref="knowledge:${escapeHtml(s.heading)}"><b>${escapeHtml(s.heading)}.</b> ${escapeHtml(s.body)}</li>`,
    )
    .join("");
  return `
    <section class="card toolbox" aria-label="Toolbox">
      <h2>Toolbox <span class="fine">· general notes, the same in every case</span></h2>
      ${cards}
      <details>
        <summary>Before you start: units, total amount, PRN, reading the chart</summary>
        <ul class="know">${knowledgeSections}</ul>
      </details>
    </section>
  `;
}

// Opening a toolbox item posts a usage event (U08, brief §9's /log route).
// A medicine card's own <details> carries data-log-ref directly; the
// "Before you start" <details> wraps several knowledge-card sections at
// once (reference markup: one collapsible for all of them), so opening IT
// logs one event per section heading it reveals, rather than inventing a
// single ref that doesn't match any real section.
function wireToolboxLogging(container, tableId) {
  container.querySelectorAll(".toolbox > details").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      const ownRef = details.dataset.logRef;
      const refs = ownRef ? [ownRef] : [...details.querySelectorAll("[data-log-ref]")].map((el) => el.dataset.logRef);
      for (const ref of refs) {
        apiFetch(`/api/tables/${tableId}/log`, {
          method: "POST",
          body: JSON.stringify({ type: "reference_opened", ref }),
        }).catch(() => {
          // Best-effort (brief §9: not used for scoring); a lost usage ping
          // never blocks or errors the check itself.
        });
      }
    });
  });
}

function fieldset(key, label, lookAt, checked) {
  return `
    <fieldset class="q"><legend>${escapeHtml(label)}</legend><div class="hint">${escapeHtml(lookAt)}</div>
      <div class="seg">
        <label><input type="radio" name="field-${key}" value="match"${checked[key] === "match" ? " checked" : ""}> ✓ Matches</label>
        <label class="no"><input type="radio" name="field-${key}" value="mismatch"${checked[key] === "mismatch" ? " checked" : ""}> ⚑ Doesn't match</label>
      </div>
    </fieldset>
  `;
}

function renderChecking(snapshot, current) {
  const caseDef = current.case;
  const pos = phasePosition(snapshot, current);

  root.innerHTML = `
    ${statusStripHtml(snapshot, current, `${pos.label} ${progressDotsHtml(pos.index, pos.total)}`)}
    ${transferIntroHtml(snapshot, current)}
    <div class="casehead"><p class="kicker" style="margin:0">${pos.label}</p><h1>${escapeHtml(caseDef.title)}</h1><span class="review">Draft · not yet source checked</span></div>
    ${patientStripHtml(caseDef)}
    ${recordsHtml(caseDef)}
    <form class="answer" id="check-form" aria-label="Your independent check">
      <section class="card pad part">
        <h2>1 · Compare the records</h2>
        <p class="sub">Does the prepared medicine match the order? Your partner can't see your answers until you've both signed.</p>
        ${caseDef.fieldKeys.map((key) => fieldset(key, caseDef.fields[key].label, caseDef.fields[key].lookAt, draft.fields)).join("")}
        <p class="note">${escapeHtml(caseDef.fieldNote ?? "These five checks compare the order with what was prepared.")}</p>
      </section>
      <section class="card pad part">
        <h2>2 · Decide</h2>
        <fieldset class="opts"><legend>Next step in this scenario</legend>
          ${caseDef.actions
            .map(
              (a) => `
            <label class="opt"><input type="radio" name="action" value="${a.id}"${draft.action === a.id ? " checked" : ""}><b>${escapeHtml(a.label)}</b><span>${escapeHtml(a.help)}</span></label>
          `,
            )
            .join("")}
        </fieldset>
        <fieldset class="opts evlist"><legend>Evidence: what decided it?</legend>
          ${caseDef.evidenceOptions
            .map(
              (e) => `
            <label class="opt"><input type="radio" name="ev" value="${e.id}"${draft.evidenceId === e.id ? " checked" : ""}>${escapeHtml(e.label)}</label>
          `,
            )
            .join("")}
        </fieldset>
        <div class="sign"><button class="btn" type="submit">Sign and submit</button><p>Signing seals your check. You can't change it afterwards.</p></div>
        <div class="err" role="alert" id="form-error" hidden></div>
      </section>
    </form>
    ${toolboxHtml(caseDef)}
  `;
  wireToolboxLogging(root, tableId);

  const form = document.getElementById("check-form");
  form.addEventListener("change", (e) => {
    if (!(e.target instanceof HTMLInputElement)) return;
    if (e.target.name.startsWith("field-")) draft.fields[e.target.name.slice("field-".length)] = e.target.value;
    else if (e.target.name === "action") draft.action = e.target.value;
    else if (e.target.name === "ev") draft.evidenceId = e.target.value;
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitting) return;
    const missingFields = caseDef.fieldKeys.filter((k) => !(k in draft.fields));
    const errorEl = document.getElementById("form-error");
    if (missingFields.length > 0 || !draft.action || !draft.evidenceId) {
      errorEl.hidden = false;
      errorEl.textContent = "Choose an answer for every line, a next step and the evidence, then sign.";
      return;
    }
    submitting = true;
    const result = await apiFetch(`/api/tables/${tableId}/rounds/${current.id}/submissions`, {
      method: "POST",
      body: JSON.stringify({ fields: draft.fields, action: draft.action, evidenceId: draft.evidenceId }),
    });
    submitting = false;
    if (!result.ok) {
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
  const caseDef = current.case;
  const pos = phasePosition(snapshot, current);
  const viewerSeat = snapshot.viewer?.seat;
  const partnerSeat = otherSeat(viewerSeat);
  const mine = current.mine;

  const sealedFieldRows = caseDef.fieldKeys
    .map((key) => `<li><span>${escapeHtml(caseDef.fields[key].label)}</span><span>${mine.fields[key] === "match" ? "Matches" : "Does not match"}</span></li>`)
    .join("");
  const actionLabel = caseDef.actions.find((a) => a.id === mine.action)?.label ?? mine.action;
  const evidenceLabel = caseDef.evidenceOptions.find((e) => e.id === mine.evidenceId)?.label ?? mine.evidenceId;

  root.innerHTML = `
    ${statusStripHtml(snapshot, current, `${pos.label} ${progressDotsHtml(pos.index, pos.total)}`)}
    ${transferIntroHtml(snapshot, current)}
    <div class="casehead"><p class="kicker" style="margin:0">${pos.label}</p><h1>${escapeHtml(caseDef.title)}</h1><span class="review">Draft · not yet source checked</span></div>
    ${patientStripHtml(caseDef)}
    ${recordsHtml(caseDef)}
    <div class="answer">
      <section class="card pad">
        <h2>✓ Signed · your check is sealed</h2>
        <ul class="sealed">
          ${sealedFieldRows}
          <li><span>Next step</span><span>${escapeHtml(actionLabel)}</span></li>
          <li><span>Evidence</span><span>${escapeHtml(evidenceLabel)}</span></li>
        </ul>
        <p class="fine">Signed means saved, not checked for correctness.</p>
      </section>
      <section class="card pad">
        <div class="coach"><span class="ava" data-sprite="lee" data-scale="2.4"></span><div><b>Lee</b><br>Checker ${partnerSeat} is still checking. The debrief opens on both screens as soon as they sign.</div></div>
        <p class="note">You don't need to refresh.</p>
      </section>
    </div>
    ${toolboxHtml(caseDef)}
  `;
  wireToolboxLogging(root, tableId);
}

function reviewBadgeHtml(round) {
  return round.reviewBadge ? `<span class="review">${escapeHtml(round.reviewBadge)}</span>` : "";
}

function comparisonTableHtml(debrief) {
  const rows = debrief.comparisonTable
    .map((row) => {
      const isDecisionRow = row.row === "Next step" || row.row === "Evidence";
      const cell = (value) => (value == null ? "—" : escapeHtml(String(value)));
      return `
        <tr${isDecisionRow ? ' class="hl"' : ""}>
          <td data-l="Check">${escapeHtml(row.row)}</td>
          <td data-l="Checker A">${cell(row.checkerA)}</td>
          <td data-l="You">${cell(row.you)}</td>
          <td data-l="Reference">${cell(row.reference)}</td>
          <td data-l="Between you">${cell(row.betweenYou)}</td>
        </tr>
      `;
    })
    .join("");
  return `
    <table class="cmp">
      <caption class="sr">Both answers and the reference answer</caption>
      <thead><tr><th scope="col">Check</th><th scope="col">Checker A</th><th scope="col">You</th><th scope="col">Reference</th><th scope="col">Between you</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// Debrief body (brief §8.2 steps 1-7), shared between the live post-reveal
// screen (renderDebrief, with a Next button) and a suggestion/case link's
// read-only history view (openCaseDebrief, with a Back link instead) -- one
// markup source so the two can never drift apart.
function debriefBodyHtml(current) {
  const caseDef = current.case;
  const debrief = current.debrief;
  return `
    <section class="card result" aria-labelledby="res-h">
      <p class="kicker">Both signed · ${escapeHtml(caseDef.title)} debrief</p>
      <h2 id="res-h">${escapeHtml(debrief.resultStrip.headline)}</h2>
      <div class="chips">
        <span class="chip${debrief.resultStrip.chips.decisionFits ? " ok" : " amb"}">${debrief.resultStrip.chips.decisionFits ? "✓" : "✗"} Your next step ${debrief.resultStrip.chips.decisionFits ? "fits" : "doesn't fit"} this scenario</span>
        <span class="chip">Agreement: ${debrief.resultStrip.chips.agreement ? "yes" : "no"}</span>
        <span class="chip">${escapeHtml(debrief.resultStrip.chips.mismatchLine)}</span>
      </div>
      ${comparisonTableHtml(debrief)}
    </section>
    ${recordsHtml(caseDef)}
    <section class="card pad" aria-labelledby="deb-h">
      <div class="lee"><span class="ava" data-sprite="lee" data-scale="2.4"></span><div><b id="deb-h">Lee · debrief</b><small>Built from what you each chose</small></div></div>
      <div class="blocks">
        <div class="blk"><h3>Finding</h3><p>${escapeHtml(debrief.feedback.finding)}</p></div>
        <div class="blk"><h3>Evidence</h3><p>${escapeHtml(debrief.feedback.evidence)}</p></div>
        <div class="blk"><h3>Why it matters</h3><p>${escapeHtml(debrief.feedback.why)}</p></div>
        <div class="blk"><h3>Next step</h3><p>${escapeHtml(debrief.feedback.nextStep)}</p></div>
      </div>
      <div class="lines">
        ${debrief.lines.personal.map((l) => `<p><span class="whotag">You</span>${escapeHtml(l)}</p>`).join("")}
        ${debrief.lines.pair.map((l) => `<p><span class="whotag">Between you</span>${escapeHtml(l)}</p>`).join("")}
      </div>
      ${debrief.realWorld ? `<div class="realw">${escapeHtml(debrief.realWorld)}</div>` : ""}
      <div class="talk"><h3>Talk it through · out loud</h3><p style="margin:4px 0 0">${escapeHtml(debrief.discussion)}</p></div>
      <p class="src">${escapeHtml(caseDef.title)} · v${escapeHtml(debrief.sources.caseVersion)} · ${reviewBadgeHtml(current)}<br>Sources: ${debrief.sources.claims
        .flatMap((c) => c.sources)
        .map((s) => `<a href="/sources/#${escapeHtml(s.id)}">${escapeHtml(s.org)} · ${escapeHtml(s.title)}</a>`)
        .join(" · ")}</p>
      ${current.withdrawnNotice ? `<div class="note" role="alert">This case version has been withdrawn. ${escapeHtml(current.withdrawnNotice)}</div>` : ""}
    </section>
  `;
}

// Evidence highlighting (U09, brief §8.2's "Materials show evidence
// highlights after reveal"): mark the page as revealed so CSS can target
// `.reveal .ev`, and add .ev-hit to exactly the elements whose data-evidence
// matches one of this case's accepted evidence ids.
function applyEvidenceHighlights(current) {
  root.classList.add("reveal");
  const hitIds = new Set(current.debrief.evidenceHighlightIds);
  root.querySelectorAll("[data-evidence]").forEach((el) => {
    if (hitIds.has(el.dataset.evidence)) el.classList.add("ev-hit");
  });
}

function renderDebrief(snapshot, current) {
  const caseDef = current.case;
  const pos = phasePosition(snapshot, current);
  const isLastInPhase = caseDef.phase === "training" ? current.index === snapshot.trainingCaseCount : current.index === snapshot.trainingCaseCount + snapshot.transferCaseCount;

  root.innerHTML = `
    ${statusStripHtml(snapshot, current, `${pos.label} ${progressDotsHtml(pos.index, pos.total)}`)}
    ${debriefBodyHtml(current)}
    <section class="card pad">
      <div class="sign" style="border-style:solid"><button class="btn" type="button" id="next">${isLastInPhase ? "See summary →" : "Next case →"}</button><p>Either of you can move on. The other screen follows.</p></div>
    </section>
  `;
  applyEvidenceHighlights(current);

  document.getElementById("next").addEventListener("click", async () => {
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

// Read-only history view of one already-revealed round's debrief, opened
// from a summary suggestion or case-by-case link (brief §8.3: "Each
// suggestion links to its cases' debriefs"). Reuses the live snapshot
// already held in lastSnapshot rather than a second fetch -- every revealed
// round's debrief is already present in it.
function openCaseDebrief(roundId) {
  const snapshot = lastSnapshot;
  const round = snapshot?.rounds.find((r) => r.id === roundId);
  if (!round || !round.revealed) return;
  root.innerHTML = `
    <p class="fine"><a href="#" id="back-to-summary">← Back to summary</a></p>
    ${debriefBodyHtml(round)}
  `;
  applyEvidenceHighlights(round);
  document.getElementById("back-to-summary").addEventListener("click", (e) => {
    e.preventDefault();
    mode = null;
    render(lastSnapshot);
  });
}

// U10 "fractions, simple bars and tables" (brief §8.3, §10.2): every ratio
// a sessionSummary() returns is [n, d]; this is the one place that turns a
// zero denominator into "No opportunity this time" rather than 0%, 100%,
// NaN or undefined (brief §8.3's explicit rule) -- resultsAndSummary.mjs
// stays pure and UI-copy-free, so the wording decision lives here instead.
function fractionHtml(pair) {
  if (!pair || pair[1] === 0) return '<span class="na">No opportunity this time</span>';
  return `${pair[0]} of ${pair[1]}`;
}

function barHtml(pair, amb) {
  const pct = pair && pair[1] > 0 ? (pair[0] / pair[1]) * 100 : 0;
  return `<div class="bar${amb ? " amb" : ""}"><i style="width:${pct}%"></i></div>`;
}

// "Both" / "Neither" / "Only you" / "Only Checker {X}", viewer-relative
// (reference's summary/end tables word coverage this way, not by raw seat
// letter) -- used for both per-case "found by"/"next step fit" cells and
// the pair decisions breakdown.
function coverageDescription(value, viewerSeat) {
  if (value === "both") return "Both";
  if (value === "neither") return "Neither";
  const onlySeat = value === "onlyA" ? "A" : "B";
  return onlySeat === viewerSeat ? "Only you" : `Only Checker ${onlySeat}`;
}

function caseLinkHtml(round, snapshot) {
  if (!round) return "";
  const label =
    round.case.phase === "training" ? `Case ${round.index}` : `Situation ${round.index - snapshot.trainingCaseCount}`;
  return `<a href="#" data-round-id="${escapeHtml(round.id)}">${escapeHtml(label)}</a>`;
}

function summaryTilesHtml(summary) {
  const tiles = [
    { n: summary.mismatchesFound, l: "mismatches you found", amb: false },
    { n: summary.matchingMarkedMismatch, l: "matching items you marked as mismatches", amb: true },
    { n: summary.decisions.accepted, l: "next steps and evidence that fit", amb: false },
    { n: summary.fullyCorrectCases, l: "cases fully in line with the reference", amb: false },
  ];
  return `<div class="tiles">${tiles
    .map((t) => `<div class="card tile"><div class="n">${fractionHtml(t.n)}</div><div class="l">${escapeHtml(t.l)}</div>${barHtml(t.n, t.amb)}</div>`)
    .join("")}</div>`;
}

function perFieldTableHtml(summary, fieldLabels) {
  const rows = Object.entries(summary.perField)
    .map(
      ([key, v]) =>
        `<tr><td>${escapeHtml(fieldLabels[key]?.label ?? key)}</td><td data-l="Mismatches found">${fractionHtml(v.found)}</td><td data-l="False marks">${fractionHtml(v.falseMarks)}</td></tr>`,
    )
    .join("");
  return `<table class="tbl"><caption>By check (you)</caption><thead><tr><th>Check</th><th>Mismatches found</th><th>Matching items marked as mismatches</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function decisionsFineHtml(summary, partnerSummary, partnerSeat) {
  const d = summary.decisions;
  const total = summary.casesCounted;
  const p = partnerSummary;
  return `<p class="fine">Next steps: ${d.accepted[0]} of ${total} fit · right next step alone ${d.actionOnly[0]} of ${total} · right evidence alone ${d.evidenceOnly[0]} of ${total}.<br>Checker ${partnerSeat}: ${p.mismatchesFound[0]} of ${p.mismatchesFound[1]} mismatches · ${p.matchingMarkedMismatch[0]} of ${p.matchingMarkedMismatch[1]} false marks · ${p.decisions.accepted[0]} of ${p.casesCounted} next steps · ${p.fullyCorrectCases[0]} of ${p.casesCounted} cases fully in line.</p>`;
}

function betweenYouHtml(summary, roundByCaseId, snapshot, viewerSeat, fieldLabels) {
  const partnerSeat = otherSeat(viewerSeat);
  const sharedMissItems = [];
  for (const round of Object.values(roundByCaseId)) {
    for (const key of round.result.pair.sharedMisses) sharedMissItems.push({ round, key });
  }
  const sharedMissDetail = sharedMissItems
    .map(({ round, key }) => `${caseLinkHtml(round, snapshot)} (${escapeHtml(fieldLabels[key]?.label ?? key)})`)
    .join(", ");

  const group = (coverageKey, label) => {
    const caseIds = summary.pair.decisions[coverageKey];
    if (!caseIds || caseIds.length === 0) return "";
    const links = caseIds.map((cid) => caseLinkHtml(roundByCaseId[cid], snapshot)).join(", ");
    return `${label}: ${links}`;
  };
  const onlyPartnerKey = viewerSeat === "A" ? "onlyB" : "onlyA";
  const onlyYouKey = viewerSeat === "A" ? "onlyA" : "onlyB";
  const decisionParts =
    [group("both", "Both"), group(onlyPartnerKey, `Only Checker ${partnerSeat}`), group(onlyYouKey, "Only you")]
      .filter(Boolean)
      .join(" · ") || "Neither of you";

  return `
    <h2>Between you</h2>
    <dl class="dl mt">
      <dt>Found together</dt><dd><b>${fractionHtml(summary.pair.foundTogether)}</b> mismatches</dd>
      <dt>Both missed</dt><dd>${summary.pair.sharedMisses === 0 ? "0 mismatches" : `${summary.pair.sharedMisses} — ${sharedMissDetail}`}</dd>
      <dt>Only one of you</dt><dd>${summary.pair.complementary} mismatches</dd>
      <dt>Next step fit</dt><dd>${decisionParts}</dd>
      <dt>Same answer</dt><dd>${fractionHtml(summary.pair.fieldAgreement)} checks. Agreeing isn't the same as being right.</dd>
    </dl>
  `;
}

// Suggestions (brief §8.3): text comes only from the bank's own
// `suggestions[tag]` templates (snapshot.suggestionsText, a plain pass-
// through of bank.suggestions), with {k} filled from the already-computed
// distinct-case count -- no wording invented here.
function suggestionsHtml(summary, snapshot, roundByCaseId) {
  const real = summary.suggestions.filter((s) => s.kind !== "none");
  if (real.length === 0) return `<li>${escapeHtml(snapshot.suggestionsText.none)}</li>`;
  return real
    .map((s) => {
      const template = s.kind === "multi" ? snapshot.suggestionsText[s.tag].multi : snapshot.suggestionsText[s.tag].one;
      const text = template.replace("{k}", String(s.distinctCases.length));
      const links = s.distinctCases.map((cid) => caseLinkHtml(roundByCaseId[cid], snapshot)).join(" · ");
      return `<li>${escapeHtml(text)} ${links}</li>`;
    })
    .join("");
}

function summaryCaveatHtml(snapshot) {
  return `<p class="caveat">${escapeHtml(snapshot.suggestionsText.limited)} ${escapeHtml(SUMMARY_CAVEAT)}</p>`;
}

function sameAnswerText(result, fieldLabels) {
  const allFieldsAgree = result.pair.fieldAgreement[0] === result.pair.fieldAgreement[1];
  const decisionSame = result.A.decision.action === result.B.decision.action && result.A.decision.evidenceId === result.B.decision.evidenceId;
  if (allFieldsAgree && decisionSame) {
    if (result.pair.sharedMisses.length > 0) {
      return `Yes — and you both missed ${fieldLabels[result.pair.sharedMisses[0]]?.label ?? result.pair.sharedMisses[0]}`;
    }
    return "Yes";
  }
  return allFieldsAgree ? "No (different next step)" : "No";
}

function caseByCaseTableHtml(phase, snapshot, fieldLabels, viewerSeat) {
  const rounds = snapshot.rounds.filter((r) => r.case.phase === phase && r.revealed);
  const rows = rounds
    .map((r) => {
      const result = r.result;
      const mismatchKeys = Object.keys(result.pair.coverage);
      const mismatchesText = mismatchKeys.length === 0 ? "none" : mismatchKeys.map((k) => fieldLabels[k]?.label ?? k).join(", ");
      const foundBy =
        mismatchKeys.length === 0
          ? "—"
          : mismatchKeys.length === 1
            ? coverageDescription(result.pair.coverage[mismatchKeys[0]], viewerSeat)
            : mismatchKeys
                .map((k) => `${fieldLabels[k]?.label ?? k}: ${coverageDescription(result.pair.coverage[k], viewerSeat).toLowerCase()}`)
                .join(", ");
      const nextStepFit = coverageDescription(result.pair.decisionCoverage, viewerSeat);
      const sameAnswer = sameAnswerText(result, fieldLabels);
      const label = phase === "training" ? r.index : r.index - snapshot.trainingCaseCount;
      return `<tr>
        <td>${label}</td>
        <td data-l="Patient">${escapeHtml(nameOf(r.case.patient))}</td>
        <td data-l="Mismatches">${escapeHtml(mismatchesText)}</td>
        <td data-l="Found by">${escapeHtml(foundBy)}</td>
        <td data-l="Next step fit">${escapeHtml(nextStepFit)}</td>
        <td data-l="Same answer?">${escapeHtml(sameAnswer)}</td>
      </tr>`;
    })
    .join("");
  return `<table class="tbl"><caption>Case by case</caption><thead><tr><th>Case</th><th>Patient</th><th>Mismatches</th><th>Found by</th><th>Next step fit</th><th>Same answer?</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// training_summary stage (reference state "summary", brief §5/§8.3/U10):
// full tiles + per-field table + between-you breakdown + suggestions +
// case-by-case table, all for the training phase only (the transfer phase
// has no mid-game summary screen -- brief §5's stage table shows no
// summary stop between rounds 7-9, only training_summary and the final
// end review).
function renderSummary(snapshot) {
  const viewerSeat = snapshot.viewer?.seat;
  const partnerSeat = otherSeat(viewerSeat);
  const summary = snapshot.trainingSummary[viewerSeat];
  const partnerSummary = snapshot.trainingSummary.partner;
  const fieldLabels = snapshot.rounds[0]?.case.fields ?? {};
  const roundByCaseId = Object.fromEntries(
    snapshot.rounds.filter((r) => r.case.phase === "training").map((r) => [r.case.caseId, r]),
  );

  root.innerHTML = `
    ${statusStripHtml(snapshot, null, `Training complete · ${snapshot.trainingSummary.completedCount} of ${snapshot.trainingSummary.totalCount}`)}
    <div class="card sumhead" style="margin-top:0">
      <span class="ava" data-sprite="lee" data-scale="2.8"></span>
      <div><p class="kicker">Training summary · You (Checker ${escapeHtml(viewerSeat)})</p><h1>What you found in six cases</h1><p>Mismatches, false alarms and next steps are counted separately, and agreeing is kept apart from being right.</p></div>
    </div>
    ${summaryTilesHtml(summary)}
    <div class="two">
      <div class="card pad">
        ${perFieldTableHtml(summary, fieldLabels)}
        ${decisionsFineHtml(summary, partnerSummary, partnerSeat)}
      </div>
      <div class="card pad">
        ${betweenYouHtml(summary, roundByCaseId, snapshot, viewerSeat, fieldLabels)}
      </div>
    </div>
    <div class="card pad mt">
      <h2>Worth practising next</h2>
      <ol class="sugg">${suggestionsHtml(summary, snapshot, roundByCaseId)}</ol>
      ${summaryCaveatHtml(snapshot)}
    </div>
    <div class="card pad mt">
      ${caseByCaseTableHtml("training", snapshot, fieldLabels, viewerSeat)}
    </div>
    <div class="card pad mt" style="margin-bottom:40px">
      <div class="btns"><button class="btn" type="button" id="start-transfer">Start the new situations →</button><span class="fine">Three new patients. Same rules: check on your own first. Your training results stay as they are.</span></div>
    </div>
  `;

  document.getElementById("start-transfer").addEventListener("click", async () => {
    const button = document.getElementById("start-transfer");
    button.disabled = true;
    const result = await apiFetch(`/api/tables/${tableId}/next`, {
      method: "POST",
      body: JSON.stringify({ fromStage: "training_summary" }),
    });
    if (result.ok) render(result.body);
    else button.disabled = false;
  });
}

function earlierPracticePlaceholderHtml() {
  return `
    <table class="tbl" id="earlier-practice">
      <caption>Earlier practice in this browser</caption>
      <thead><tr><th>Date</th><th>Table</th><th>Mismatches found</th><th>False marks</th><th>Next steps fit</th><th>New situations</th><th>Note</th></tr></thead>
      <tbody><tr><td colspan="7" class="muted">Loading…</td></tr></tbody>
    </table>
    <p class="fine">Practice records in this browser. They don't identify you or follow you across devices. Your partner can't see this history.</p>
    <p class="caveat">${escapeHtml(SUMMARY_CAVEAT)}</p>
  `;
}

// §8.4 "earlier practice in this browser": fetched separately from the main
// snapshot (it is per-identity history across OTHER tables, not this
// table's own state, so it has no place in the SSE-pushed snapshot and
// would otherwise leak into every table's payload for no reason).
async function loadEarlierPractice(currentTableId, bankMajorVersion, bankVersion) {
  const result = await apiFetch(`/api/me/history?exclude=${encodeURIComponent(currentTableId)}`);
  const tbody = document.querySelector("#earlier-practice tbody");
  if (!tbody) return; // navigated away before this resolved
  if (!result.ok || result.body.history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted">No earlier practice in this browser yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = result.body.history
    .map((h) => {
      const date = h.completedAt ? new Date(h.completedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";
      const sameCaseSet = h.bankVersion === bankVersion;
      const note = sameCaseSet
        ? "Same case set as before (memory may help)"
        : h.bankMajorVersion !== bankMajorVersion
          ? "Earlier version"
          : "";
      return `<tr>
        <td>${escapeHtml(date)}</td>
        <td data-l="Table">${escapeHtml(h.code)}</td>
        <td data-l="Mismatches found">${fractionHtml(h.trainingMismatchesFound)}</td>
        <td data-l="False marks">${fractionHtml(h.trainingFalseMarks)}</td>
        <td data-l="Next steps fit">${fractionHtml(h.trainingDecisionsAccepted)}</td>
        <td data-l="New situations">${fractionHtml(h.transferDecisionsAccepted)}</td>
        <td data-l="Note">${escapeHtml(note)}</td>
      </tr>`;
    })
    .join("");
}

// completed stage (reference state "end", brief §5/§8.4): training and
// transfer recapped separately, §8.4's earlier-practice table, and print.
// No fabricated "talk it through" discussion prompt here -- the reference
// mockup's end-screen discussion text isn't sourced from the bank for a
// whole-session topic (only per-case `feedback.discussion` exists, already
// shown on each case's own debrief), so inventing one would break the
// "never invent... motivations" rule; this is reported as a reference/
// behaviour difference rather than guessed at.
function renderEnd(snapshot) {
  const viewerSeat = snapshot.viewer?.seat;
  const partnerSeat = otherSeat(viewerSeat);
  const trainingSummary = snapshot.trainingSummary[viewerSeat];
  const trainingPartner = snapshot.trainingSummary.partner;
  const transferSummary = snapshot.transferSummary?.[viewerSeat];
  const transferPartner = snapshot.transferSummary?.partner;
  const transferRounds = snapshot.rounds.filter((r) => r.case.phase === "transfer");
  const lastRound = snapshot.rounds[snapshot.rounds.length - 1];
  const completedDate = lastRound?.revealedAt
    ? new Date(lastRound.revealedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
    : "";

  const transferRows = transferRounds
    .map((r) => {
      const tagLabel = snapshot.capabilityTags.find((t) => t.id === r.result.decisionTag)?.label ?? r.result.decisionTag;
      const applied = r.result[viewerSeat].fullyCorrect;
      const situationNum = r.index - snapshot.trainingCaseCount;
      const situationTitle = r.case.title.replace(/^New situation \d+ · /, "");
      return `<tr><td>${situationNum} · ${escapeHtml(situationTitle)}</td><td data-l="Practised">${escapeHtml(tagLabel)}</td><td data-l="Result">${applied ? '<span class="mk ok">✓ Applied it</span>' : '<span class="mk no">Still practising</span>'}</td></tr>`;
    })
    .join("");

  root.innerHTML = `
    ${statusStripHtml(snapshot, null, "End review")}
    <div class="card sumhead">
      <span class="ava" data-sprite="lee" data-scale="2.8"></span>
      <div><p class="kicker">Table ${escapeHtml(snapshot.table.code)} · practice complete${completedDate ? ` · ${escapeHtml(completedDate)}` : ""}</p><h1>End review</h1><p>Bring this to your debrief with your facilitator. Training and new situations are shown separately.</p></div>
    </div>
    <div class="two">
      <div class="card pad">
        <table class="tbl"><caption>Training · ${snapshot.trainingCaseCount} cases (you)</caption>
          <thead><tr><th>Measure</th><th>You</th><th>Checker ${escapeHtml(partnerSeat)}</th></tr></thead>
          <tbody>
            <tr><td>Mismatches found</td><td data-l="You">${fractionHtml(trainingSummary.mismatchesFound)}</td><td data-l="Checker">${fractionHtml(trainingPartner.mismatchesFound)}</td></tr>
            <tr><td>Matching items marked as mismatches</td><td data-l="You">${fractionHtml(trainingSummary.matchingMarkedMismatch)}</td><td data-l="Checker">${fractionHtml(trainingPartner.matchingMarkedMismatch)}</td></tr>
            <tr><td>Next steps and evidence that fit</td><td data-l="You">${fractionHtml(trainingSummary.decisions.accepted)}</td><td data-l="Checker">${fractionHtml(trainingPartner.decisions.accepted)}</td></tr>
            <tr><td>Found together</td><td data-l="You" colspan="2">${fractionHtml(trainingSummary.pair.foundTogether)}${trainingSummary.pair.sharedMisses > 0 ? ` · both missed ${trainingSummary.pair.sharedMisses}` : ""}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="card pad">
        <table class="tbl"><caption>New situations · ${snapshot.transferCaseCount} cases (you)</caption>
          <thead><tr><th>Situation</th><th>Practised</th><th>Result</th></tr></thead>
          <tbody>${transferRows}</tbody>
        </table>
        ${transferSummary ? `<p class="fine">Next steps and evidence that fit: you ${transferSummary.decisions.accepted[0]} of ${transferSummary.casesCounted} · Checker ${escapeHtml(partnerSeat)} ${transferPartner.decisions.accepted[0]} of ${transferPartner.casesCounted}.</p>` : ""}
      </div>
    </div>
    <div class="card pad mt">
      ${earlierPracticePlaceholderHtml()}
    </div>
    <div class="btns mt" style="margin-bottom:40px"><button class="btn" type="button" id="print-btn">Print or save as PDF</button><a class="btn ghost" href="/tables">My tables</a></div>
  `;

  document.getElementById("print-btn").addEventListener("click", () => window.print());
  loadEarlierPractice(snapshot.table.id, snapshot.table.bankMajorVersion, snapshot.table.bankVersion);
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
