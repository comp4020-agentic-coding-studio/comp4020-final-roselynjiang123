import { randomBytes, randomUUID } from "node:crypto";

// High-entropy opaque tokens (brief §4 step 2, §6 session token, §4 step 3
// invitation URL/table id). Base64url, no padding.
export function randomToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

export function uuid() {
  return randomUUID();
}

// Display-only 4-character table code (brief UI reference State 2 note):
// never a second identifier, just the first 4 characters of the table id,
// uppercased.
export function tableCode(tableId) {
  return tableId.slice(0, 4).toUpperCase();
}
