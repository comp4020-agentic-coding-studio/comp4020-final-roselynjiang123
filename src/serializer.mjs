import { tableCode } from "./ids.mjs";

// The one explicit allowlist-based serializer (brief §7): every GET and POST
// response is built by this function, from a repo snapshot, so there is no
// second code path that could leak a field this one withholds. Extended in
// later commits as rounds/submissions/reveal are added.
export function serializeSnapshot(snapshot) {
  const { table, members, viewerIdentity } = snapshot;
  const viewerMember = members.find((m) => m.identity === viewerIdentity);

  return {
    table: {
      id: table.id,
      code: tableCode(table.id),
      status: table.status,
      version: table.version,
    },
    viewer: viewerMember ? { seat: viewerMember.seat } : null,
    seats: {
      A: { joined: members.some((m) => m.seat === "A") },
      B: { joined: members.some((m) => m.seat === "B") },
    },
  };
}
