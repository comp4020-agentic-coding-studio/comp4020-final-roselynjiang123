import { readFileSync } from "node:fs";

// Loads and validates content/case-bank.v2.json (brief §6.1). Fails loudly
// (throws) rather than booting with bad content: every rule below is a
// start-up guard, not a warning, because a silently-invalid bank could ship
// an unanswerable case or a falsely "reviewed" badge. Validation errors are
// collected, not thrown on the first one, so a bad bank can be fixed in one
// pass instead of one error at a time.
export function loadBank(path) {
  const raw = readFileSync(path, "utf8");
  const bank = JSON.parse(raw);
  const errors = validateBank(bank);
  if (errors.length > 0) {
    throw new Error(`content/case-bank.v2.json failed validation:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }
  return bank;
}

// Pure: takes the already-parsed bank object, returns a list of error
// strings (empty = valid). Exported separately from loadBank() so tests can
// validate a bank value without a file on disk (brief §9 item 12 wants
// "list each failure" for an invalid bank, which this makes possible without
// writing a temp file per case).
export function validateBank(bank) {
  const errors = [];
  const fieldKeys = new Set(bank.fieldKeys ?? []);
  const actionIds = new Set((bank.actions ?? []).map((a) => a.id));
  const evidenceIds = new Set((bank.evidenceOptions ?? []).map((e) => e.id));
  const sourceIds = new Set((bank.sources ?? []).map((s) => s.id));
  const cardIds = new Set((bank.medicineCards ?? []).map((m) => m.id));

  const checkReviewStatus = (label, item) => {
    const status = item.reviewStatus;
    if (status === "educator_reviewed") {
      if (!item.reviewerRole || !item.reviewedAt) {
        errors.push(`${label}: reviewStatus is "educator_reviewed" but reviewerRole/reviewedAt is empty`);
      }
    }
    if (status === "source_checked") {
      // "every claim has at least one source whose verification does not
      // start with TO VERIFY" -- a claim with zero sources, or whose only
      // sources are all "TO VERIFY", fails; a claim with one checked source
      // among several unverified ones passes.
      const sourcesById = new Map((bank.sources ?? []).map((s) => [s.id, s]));
      for (const claim of item.claims ?? []) {
        const checked = (claim.sourceIds ?? []).some((sid) => {
          const source = sourcesById.get(sid);
          return source && !source.verification.startsWith("TO VERIFY");
        });
        if (!checked) {
          errors.push(
            `${label}: reviewStatus is "source_checked" but claim "${claim.id}" has no source whose verification is not "TO VERIFY"`,
          );
        }
      }
    }
  };

  for (const sid of bank.setting?.pairNoteSourceIds ?? []) {
    if (!sourceIds.has(sid)) errors.push(`setting.pairNoteSourceIds: unknown source "${sid}"`);
  }

  for (const card of bank.medicineCards ?? []) {
    for (const sid of card.sourceIds ?? []) {
      if (!sourceIds.has(sid)) errors.push(`medicineCard "${card.id}": unknown sourceIds entry "${sid}"`);
    }
    checkReviewStatus(`medicineCard "${card.id}"`, card);
  }

  if (bank.knowledgeCard) {
    for (const sid of bank.knowledgeCard.sourceIds ?? []) {
      if (!sourceIds.has(sid)) errors.push(`knowledgeCard: unknown sourceIds entry "${sid}"`);
    }
    checkReviewStatus("knowledgeCard", bank.knowledgeCard);
  }

  for (const c of bank.cases ?? []) {
    const cid = c.caseId;
    const ak = c.answerKey ?? {};
    const akFields = ak.fields ?? {};
    const akFieldKeys = new Set(Object.keys(akFields));
    if (akFieldKeys.size !== fieldKeys.size || [...fieldKeys].some((k) => !akFieldKeys.has(k))) {
      errors.push(`case "${cid}": answerKey.fields keys do not match bank.fieldKeys`);
    }

    const hasMismatch = Object.values(akFields).some((v) => v === "mismatch");
    for (const pair of ak.acceptedPairs ?? []) {
      if (!actionIds.has(pair.action)) errors.push(`case "${cid}": accepted pair has unknown action "${pair.action}"`);
      if (!evidenceIds.has(pair.evidenceId)) {
        errors.push(`case "${cid}": accepted pair has unknown evidenceId "${pair.evidenceId}"`);
      }
      if (hasMismatch && pair.action === "continue_checks") {
        errors.push(`case "${cid}": accepted pair uses "continue_checks" but this case has a mismatch`);
      }
    }

    for (const claim of c.claims ?? []) {
      for (const sid of claim.sourceIds ?? []) {
        if (!sourceIds.has(sid)) errors.push(`case "${cid}": claim "${claim.id}" references unknown source "${sid}"`);
      }
    }

    for (const mcid of c.medicineCardIds ?? []) {
      if (!cardIds.has(mcid)) errors.push(`case "${cid}": unknown medicineCardIds entry "${mcid}"`);
    }

    checkReviewStatus(`case "${cid}"`, c);
  }

  return errors;
}
