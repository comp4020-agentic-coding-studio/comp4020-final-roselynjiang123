#!/usr/bin/env node
// One-off evidence tool (brief §13, Round D): drives the real deployed app
// over HTTP to create a table and complete two rounds (same cookie-jar
// pattern as scripts/smoke-deployed.mjs), then fetches the table's current
// state and prints a compact fingerprint (table id, stage, each round's id/
// revealed/result fields) so it can be diffed by eye before/after a machine
// restart and a redeploy, per brief §13's persistence check.
//
// Usage:
//   node scripts/persistence-check.mjs create <url>     # creates table, completes 2 rounds, prints fingerprint
//   node scripts/persistence-check.mjs fetch <url> <tableId> <cookieA> <cookieB>   # re-fetches and prints fingerprint

const [, , mode, url, ...rest] = process.argv;

function createClient(baseUrl, cookie = null) {
  const client = { cookie };
  const update = (res) => {
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) client.cookie = setCookie.split(";")[0];
  };
  client.get = async (path) => {
    const res = await fetch(new URL(path, baseUrl), { headers: client.cookie ? { cookie: client.cookie } : {} });
    update(res);
    return res;
  };
  client.post = async (path, body) => {
    const res = await fetch(new URL(path, baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, ...(client.cookie ? { cookie: client.cookie } : {}) },
      body: JSON.stringify(body ?? {}),
    });
    update(res);
    return res;
  };
  return client;
}

async function fingerprint(snapshot) {
  return {
    tableId: snapshot.table.id,
    tableCode: snapshot.table.code,
    stage: snapshot.table.stage,
    status: snapshot.table.status,
    rounds: snapshot.rounds.map((r) => ({
      index: r.index,
      caseId: r.case.caseId,
      revealed: r.revealed,
      mineSubmitted: r.mine.submitted,
      partnerSubmitted: r.partner.submitted,
      resultDecisionTag: r.result?.decisionTag ?? null,
      pairIdentical: r.result?.pair?.identical ?? null,
    })),
  };
}

async function main() {
  const { readFile } = await import("node:fs/promises");
  const bank = JSON.parse(await readFile(new URL("../content/case-bank.v2.json", import.meta.url), "utf8"));
  const answerFor = (caseId) => {
    const c = bank.cases.find((c) => c.caseId === caseId);
    const pair = c.answerKey.acceptedPairs[0];
    return { fields: { ...c.answerKey.fields }, action: pair.action, evidenceId: pair.evidenceId };
  };

  if (mode === "create") {
    const a = createClient(url);
    const b = createClient(url);
    const createRes = await a.post("/api/tables", {});
    const created = await createRes.json();
    const tableId = created.table.id;
    await b.post(`/api/tables/${tableId}/join`, {});

    for (let i = 0; i < 2; i++) {
      const snap = await (await a.get(`/api/tables/${tableId}`)).json();
      const round = snap.rounds[snap.rounds.length - 1];
      const answer = answerFor(round.case.caseId);
      await a.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer);
      await b.post(`/api/tables/${tableId}/rounds/${round.id}/submissions`, answer);
      const revealedSnap = await (await a.get(`/api/tables/${tableId}`)).json();
      const revealedRound = revealedSnap.rounds[revealedSnap.rounds.length - 1];
      if (i < 1) {
        await a.post(`/api/tables/${tableId}/next`, { fromRoundId: revealedRound.id });
      }
    }

    const finalSnap = await (await a.get(`/api/tables/${tableId}`)).json();
    console.log(JSON.stringify({ tableId, cookieA: a.cookie, cookieB: b.cookie, fingerprint: await fingerprint(finalSnap) }, null, 2));
  } else if (mode === "fetch") {
    const [tableId, cookieA] = rest;
    const a = createClient(url, cookieA);
    const res = await a.get(`/api/tables/${tableId}`);
    if (!res.ok) {
      console.error(`fetch failed: ${res.status}`);
      process.exit(1);
    }
    const snap = await res.json();
    console.log(JSON.stringify({ tableId, fingerprint: await fingerprint(snap) }, null, 2));
  } else {
    console.error("usage: node scripts/persistence-check.mjs create <url> | fetch <url> <tableId> <cookieA>");
    process.exit(1);
  }
}

main();
