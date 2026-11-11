import { tableCode } from "./ids.mjs";

// Server-side action log (crit-10 requirement): one line per accepted,
// state-changing action, written to stdout. Fields: ISO time, table code,
// seat, action, round number -- pipe-delimited for easy grepping.
//
// Safe by construction, not by redaction: this function's signature has no
// parameter for identity, cookie, session token or answer content, so there
// is no code path through which any of those could end up in a log line.
// `tableId` itself is deliberately not logged -- it doubles as the
// invitation token (src/db.mjs), so it's as sensitive as a credential; only
// its display-only 4-character code (the same thing the UI shows as
// "Table NGWJ") is logged.
const VALID_ACTIONS = new Set(["create", "join", "sign", "reveal", "next"]);

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
