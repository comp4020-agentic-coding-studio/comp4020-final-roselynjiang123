// Debrief composer (brief §8.2): composeDebrief(snapshot, result, viewerSeat)
// returns ordered blocks built only from bank text and templates -- no
// generated wording, so every sentence in a debrief traces to a specific
// bank field (docs/adr/0006's "auditable" property). `snapshot` is
// `{ caseDef, bank }`: the frozen per-round case content plus the bank-wide
// lookup tables (field/action/evidence labels, templates, sources) needed
// to render them. `result` is a roundResult() output (src/resultsAndSummary.mjs).
//
// No acceptance test in spec/ names this module directly yet (T01-T17 cover
// the engine, scoring and summaries; nothing in brief §12 pins an exact
// debrief rendering the way scoring-fixtures.json pins round results and
// session summaries) -- built to §8.2's rules from the bank's own data, and
// worth a fixture-style test once the UI consumes it and a canonical
// rendering exists to test against.

// Result strip headline: the first rule that applies (brief §8.2 step 1).
function resultHeadline(result, templates) {
  const { pair } = result;
  if (pair.identicalButNotReference) return templates.identicalButNotReference;
  if (pair.sharedMisses.length > 0) {
    return fillTemplate(templates.sharedMiss, { field: pair.sharedMisses[0] });
  }
  if (pair.complementary.length > 0) {
    return fillTemplate(templates.onlyOne, { field: pair.complementary[0], seat: coverageSeat(pair, pair.complementary[0]) });
  }
  if (pair.decisionCoverage === "onlyA" || pair.decisionCoverage === "onlyB") {
    return fillTemplate(templates.decisionOnlyOne, { seat: pair.decisionCoverage === "onlyA" ? "A" : "B" });
  }
  if (pair.decisionNeitherAccepted) return templates.decisionNeither;
  if (result.A.fullyCorrect && result.B.fullyCorrect) return templates.bothFullyCorrect;
  if (pair.decisionCoverage === "both" && !pair.identical) return templates.decisionSplit;
  if (pair.identical) return templates.identical;
  return templates.noMismatches;
}

function coverageSeat(pair, field) {
  return pair.coverage[field] === "onlyA" ? "A" : "B";
}

function fillTemplate(template, vars) {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${key}}`, String(value));
  }
  return out;
}

// Chips (brief §8.2 step 1): decision fit, agreement, mismatch count found.
function resultChips(caseDef, result, viewerSeat) {
  const fieldKeys = Object.keys(caseDef.answerKey.fields);
  const mismatchCount = fieldKeys.filter((k) => caseDef.answerKey.fields[k] === "mismatch").length;
  const foundCount = Object.values(result.pair.coverage).filter((v) => v !== "neither").length;
  const viewerDecisionOk = result[viewerSeat].decision.accepted;
  return {
    decisionFits: viewerDecisionOk,
    agreement: result.pair.identical,
    mismatchLine:
      mismatchCount === 0 ? "No mismatches on this tray" : `Mismatches on this tray: ${mismatchCount} · found between you: ${foundCount} of ${mismatchCount}`,
  };
}

// Comparison table (brief §8.2 step 2): rows = five fields + Next step +
// Evidence; columns Checker A, You, Reference, Between you.
function comparisonTable(caseDef, bank, result, viewerSeat) {
  const fieldKeys = Object.keys(caseDef.answerKey.fields);
  const rows = fieldKeys.map((key) => ({
    row: bank.fields[key].label,
    checkerA: result.A.fields[key].given,
    you: result[viewerSeat].fields[key].given,
    reference: result.A.fields[key].actual,
    betweenYou: result.pair.coverage[key] ?? null,
  }));
  rows.push({
    row: "Next step",
    checkerA: result.A.decision.action,
    you: result[viewerSeat].decision.action,
    reference: null,
    betweenYou: null,
  });
  rows.push({
    row: "Evidence",
    checkerA: result.A.decision.evidenceId,
    you: result[viewerSeat].decision.evidenceId,
    reference: null,
    betweenYou: null,
  });
  return rows;
}

// Four feedback blocks (brief §8.2 step 3), straight from the case's
// authored feedback -- no synthesis.
function feedbackBlocks(caseDef) {
  const fb = caseDef.feedback;
  return { finding: fb.finding, evidence: fb.evidence, why: fb.why, nextStep: fb.nextStep };
}

// Personal and pair template lines (brief §8.2 step 4). Each template fires
// on its exact condition; stoppedAfterOne fires when a case has >=2
// mismatches and the viewer found >=1 but not all of them.
function personalLines(caseDef, bank, result, viewerSeat) {
  const templates = bank.templates.personal;
  const seatResult = result[viewerSeat];
  const lines = [];

  const fieldKeys = Object.keys(caseDef.answerKey.fields);
  const allFieldsOk = fieldKeys.every((k) => {
    const o = seatResult.fields[k].outcome;
    return o === "TP" || o === "TN";
  });
  if (allFieldsOk) {
    lines.push(templates.fieldsAllCorrect);
  } else {
    for (const key of fieldKeys) {
      const outcomeForField = seatResult.fields[key].outcome;
      const label = bank.fields[key].label;
      if (outcomeForField === "TP") lines.push(fillTemplate(templates.foundMismatch, { field: label }));
      if (outcomeForField === "FN") lines.push(fillTemplate(templates.missedMismatch, { field: label }));
      if (outcomeForField === "FP") lines.push(fillTemplate(templates.falseMismatch, { field: label }));
    }
  }

  const decision = seatResult.decision;
  if (decision.accepted) lines.push(templates.decisionAccepted);
  else if (decision.actionOk) lines.push(templates.decisionActionOnly);
  else if (decision.evidenceOk) lines.push(templates.decisionEvidenceOnly);
  else lines.push(templates.decisionNeither);

  const mismatchFieldKeys = fieldKeys.filter((k) => caseDef.answerKey.fields[k] === "mismatch");
  const foundByViewer = mismatchFieldKeys.filter((k) => seatResult.fields[k].outcome === "TP").length;
  if (mismatchFieldKeys.length >= 2 && foundByViewer >= 1 && foundByViewer < mismatchFieldKeys.length) {
    lines.push(fillTemplate(templates.stoppedAfterOne, { total: mismatchFieldKeys.length, found: foundByViewer }));
  }

  return lines;
}

function pairLines(bank, result) {
  return [resultHeadline(result, bank.templates.pair)];
}

// Sources for this case: claims -> source titles with links (brief §8.2
// step 7), plus case version and review badge text (brief §6.3).
function sourcesBlock(caseDef, bank) {
  const sourcesById = new Map(bank.sources.map((s) => [s.id, s]));
  const claims = (caseDef.claims ?? []).map((claim) => ({
    text: claim.text,
    sources: claim.sourceIds.map((sid) => sourcesById.get(sid)).filter(Boolean),
  }));
  return { claims, caseVersion: caseDef.caseVersion, reviewBadge: reviewBadgeText(caseDef) };
}

// Review badges (brief §6.3), exact copy from the brief.
export function reviewBadgeText(item) {
  switch (item.reviewStatus) {
    case "draft":
      return "Draft · not yet source checked";
    case "source_checked":
      return "Sources checked · not yet reviewed by a nursing educator or pharmacist";
    case "educator_reviewed":
      return `Reviewed by ${item.reviewerRole}, ${item.reviewedAt}`;
    case "withdrawn":
      return "This case version has been withdrawn";
    default:
      return "Draft · not yet source checked";
  }
}

export function composeDebrief(snapshot, result, viewerSeat) {
  const { caseDef, bank } = snapshot;
  return {
    resultStrip: { headline: resultHeadline(result, bank.templates.pair), chips: resultChips(caseDef, result, viewerSeat) },
    comparisonTable: comparisonTable(caseDef, bank, result, viewerSeat),
    feedback: feedbackBlocks(caseDef),
    lines: { personal: personalLines(caseDef, bank, result, viewerSeat), pair: pairLines(bank, result) },
    realWorld: caseDef.feedback.realWorld ?? null,
    discussion: caseDef.feedback.discussion,
    sources: sourcesBlock(caseDef, bank),
    evidenceHighlightIds: caseDef.answerKey.acceptedPairs.map((p) => p.evidenceId),
  };
}
