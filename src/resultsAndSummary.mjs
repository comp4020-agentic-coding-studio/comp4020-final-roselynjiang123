// Pure round-result scoring and session summaries (brief §8.1, §8.3). No
// I/O: every function here takes already-loaded bank data and submissions
// and returns a plain object. Ported line-for-line from
// tools/content/reference_scoring.py (the script that produced
// docs/content/scoring-fixtures.json), since that script's output is the
// normative target (brief §8: "The definitions in the fixture file's
// `rules` are normative").

function outcome(actual, given) {
  if (actual === "mismatch") return given === "mismatch" ? "TP" : "FN";
  return given === "mismatch" ? "FP" : "TN";
}

// Per-seat result for one case: field outcomes, decision acceptance,
// fullyCorrect (brief §8.1).
export function scoreSeat(caseDef, submission) {
  const answerKey = caseDef.answerKey;
  const fieldKeys = Object.keys(answerKey.fields);
  const fields = {};
  for (const key of fieldKeys) {
    const actual = answerKey.fields[key];
    const given = submission.fields[key];
    fields[key] = { given, actual, outcome: outcome(actual, given) };
  }
  const pairs = answerKey.acceptedPairs;
  const accepted = pairs.some((p) => p.action === submission.action && p.evidenceId === submission.evidenceId);
  const actionOk = pairs.some((p) => p.action === submission.action);
  const evidenceOk = pairs.some((p) => p.evidenceId === submission.evidenceId);
  const fieldsOk = Object.values(fields).every((f) => f.outcome === "TP" || f.outcome === "TN");
  return {
    fields,
    decision: { action: submission.action, evidenceId: submission.evidenceId, accepted, actionOk, evidenceOk },
    fullyCorrect: fieldsOk && accepted,
  };
}

// Round result for a pair (brief §8.1): per-mismatch-field coverage,
// sharedMisses, complementary, identical/identicalButNotReference,
// fieldAgreement, decision coverage.
export function roundResult(caseDef, subA, subB) {
  const fieldKeys = Object.keys(caseDef.answerKey.fields);
  const a = scoreSeat(caseDef, subA);
  const b = scoreSeat(caseDef, subB);

  const coverage = {};
  for (const key of fieldKeys) {
    if (caseDef.answerKey.fields[key] === "mismatch") {
      const foundA = a.fields[key].outcome === "TP";
      const foundB = b.fields[key].outcome === "TP";
      coverage[key] = foundA && foundB ? "both" : foundA ? "onlyA" : foundB ? "onlyB" : "neither";
    }
  }
  const identical =
    fieldKeys.every((k) => subA.fields[k] === subB.fields[k]) &&
    subA.action === subB.action &&
    subA.evidenceId === subB.evidenceId;
  const fieldAgreementCount = fieldKeys.filter((k) => subA.fields[k] === subB.fields[k]).length;

  return {
    caseId: caseDef.caseId,
    A: a,
    B: b,
    pair: {
      coverage,
      sharedMisses: Object.keys(coverage).filter((k) => coverage[k] === "neither"),
      complementary: Object.keys(coverage).filter((k) => coverage[k] === "onlyA" || coverage[k] === "onlyB"),
      identical,
      identicalButNotReference: identical && !a.fullyCorrect,
      fieldAgreement: [fieldAgreementCount, fieldKeys.length],
      decisionBothAccepted: a.decision.accepted && b.decision.accepted,
      decisionNeitherAccepted: !a.decision.accepted && !b.decision.accepted,
      decisionCoverage: a.decision.accepted && b.decision.accepted
        ? "both"
        : a.decision.accepted
          ? "onlyA"
          : b.decision.accepted
            ? "onlyB"
            : "neither",
    },
  };
}

// Session summary for one seat, one phase (brief §8.3). `results` is a list
// of roundResult() outputs; `casesById` maps caseId -> case def (for
// decisionTag and phase). Counts are summed first, never averaged per case
// (brief §8.3's explicit rule), and every ratio is returned as [n, of] so
// the caller can render "No opportunity this time" on a zero denominator
// without this module making UI-copy decisions.
export function sessionSummary(results, seat, phase, casesById, bank) {
  const tagOfField = {};
  for (const tag of bank.capabilityTags) {
    for (const key of tag.fieldKeys) tagOfField[key] = tag.id;
  }
  const tagOrder = bank.capabilityTagOrder;

  const rs = results.filter((r) => casesById[r.caseId].phase === phase);
  const fieldKeys = bank.fieldKeys;
  const perField = {};
  for (const key of fieldKeys) perField[key] = { TP: 0, FN: 0, FP: 0, TN: 0 };

  const tagCases = new Map(); // tag -> Set<caseId>
  const tagErrors = new Map(); // tag -> count
  const bumpTag = (tag, caseId) => {
    if (!tagCases.has(tag)) tagCases.set(tag, new Set());
    tagCases.get(tag).add(caseId);
    tagErrors.set(tag, (tagErrors.get(tag) ?? 0) + 1);
  };

  let fully = 0;
  let decAccepted = 0;
  let decActionOk = 0;
  let decEvidenceOk = 0;
  let decOpportunities = 0;

  for (const r of rs) {
    const s = r[seat];
    const c = casesById[r.caseId];
    for (const key of fieldKeys) {
      const o = s.fields[key].outcome;
      perField[key][o] += 1;
      if (o === "FN" || o === "FP") bumpTag(tagOfField[key], r.caseId);
    }
    const d = s.decision;
    decOpportunities += 1;
    if (d.accepted) decAccepted += 1;
    if (d.actionOk) decActionOk += 1;
    if (d.evidenceOk) decEvidenceOk += 1;
    if (!d.accepted) bumpTag(c.decisionTag, r.caseId);
    if (s.fullyCorrect) fully += 1;
  }

  const tp = fieldKeys.reduce((sum, k) => sum + perField[k].TP, 0);
  const fn = fieldKeys.reduce((sum, k) => sum + perField[k].FN, 0);
  const fp = fieldKeys.reduce((sum, k) => sum + perField[k].FP, 0);
  const tn = fieldKeys.reduce((sum, k) => sum + perField[k].TN, 0);

  // Suggestions (brief §8.3): sort by distinct cases desc, then wrong items
  // desc, then capabilityTagOrder; cap at 3; "multi" at >=2 distinct cases,
  // else "one"; "none" if there are no wrong items anywhere.
  const ranked = [...tagCases.keys()].sort((ta, tb) => {
    const diffCases = tagCases.get(tb).size - tagCases.get(ta).size;
    if (diffCases !== 0) return diffCases;
    const diffErrors = tagErrors.get(tb) - tagErrors.get(ta);
    if (diffErrors !== 0) return diffErrors;
    return tagOrder.indexOf(ta) - tagOrder.indexOf(tb);
  });
  const top3 = ranked.slice(0, 3);
  const suggestions =
    top3.length > 0
      ? top3.map((tag) => ({
          tag,
          kind: tagCases.get(tag).size >= 2 ? "multi" : "one",
          distinctCases: [...tagCases.get(tag)].sort(),
          errors: tagErrors.get(tag),
        }))
      : [{ tag: null, kind: "none" }];

  let pairShared = 0;
  let pairComplementary = 0;
  let unionFound = 0;
  let agree = 0;
  let agreeDen = 0;
  const decisionsByCoverage = { both: [], onlyA: [], onlyB: [], neither: [] };
  for (const r of rs) {
    pairShared += r.pair.sharedMisses.length;
    pairComplementary += r.pair.complementary.length;
    unionFound += Object.values(r.pair.coverage).filter((v) => v !== "neither").length;
    agree += r.pair.fieldAgreement[0];
    agreeDen += r.pair.fieldAgreement[1];
    decisionsByCoverage[r.pair.decisionCoverage].push(r.caseId);
  }

  return {
    phase,
    casesCounted: rs.length,
    mismatchesFound: [tp, tp + fn],
    matchingMarkedMismatch: [fp, fp + tn],
    perField: Object.fromEntries(
      fieldKeys.map((k) => [
        k,
        { found: [perField[k].TP, perField[k].TP + perField[k].FN], falseMarks: [perField[k].FP, perField[k].FP + perField[k].TN] },
      ]),
    ),
    decisions: {
      accepted: [decAccepted, decOpportunities],
      actionOnly: [decActionOk, decOpportunities],
      evidenceOnly: [decEvidenceOk, decOpportunities],
    },
    fullyCorrectCases: [fully, rs.length],
    suggestions,
    pair: {
      foundTogether: [unionFound, tp + fn],
      sharedMisses: pairShared,
      complementary: pairComplementary,
      fieldAgreement: [agree, agreeDen],
      decisions: decisionsByCoverage,
    },
  };
}
