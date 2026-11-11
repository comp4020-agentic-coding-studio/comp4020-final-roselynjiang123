import { tableCode } from "./ids.mjs";

// Server-side action log (crit-10 requirement, brief §4 item 11): one line
// per accepted, state-changing action, written to stdout. Fields: ISO time,
// table code, seat, action, round number -- pipe-delimited for easy
// grepping. v2 stage actions: "summary" (round 6 -> training_summary),
// "transfer" (training_summary -> round 7) and "complete" (round 9 ->
// completed), alongside the original create/join/sign/reveal/next.
// Rejected requests are never logged (brief §4 item 11): every call site
// in src/server.mjs sits after its route's success check.
//
// Safe by construction, not by redaction: this function's signature has no
// parameter for identity, cookie, session token, answer value or evidence
// choice, so there is no code path through which any of those could end up
// in a log line. `tableId` itself is deliberately not logged -- it doubles
// as the invitation token (src/db.mjs), so it's as sensitive as a
// credential; only its display-only 4-character code (the same thing the
// UI shows as "Table NGWJ") is logged.
const VALID_ACTIONS = new Set(["create", "join", "sign", "reveal", "next", "summary", "transfer", "complete"]);

export function logAction({ tableId, seat, action, round }) {
  if (!VALID_ACTIONS.has(action)) {
    throw new RangeError(`logAction: unknown action "${action}"`);
  }
  if (seat !== "A" && seat !== "B") {
    throw new RangeError(`logAction: seat must be "A" or "B", got "${seat}"`);
  }
  // 0 is valid only for "create": v2 creates a table with no round yet
  // (brief §5 -- round 1 is created when B joins), so a create log line has
  // no round number to report yet.
  const minRound = action === "create" ? 0 : 1;
  if (!Number.isInteger(round) || round < minRound) {
    throw new RangeError(`logAction: round must be an integer >= ${minRound} for action "${action}", got ${round}`);
  }
  console.log(`${new Date().toISOString()} | ${tableCode(tableId)} | ${seat} | ${action} | ${round}`);
}
