#!/usr/bin/env node
// Manual smoke test against a deployed instance (brief §9 item 12), not run
// by `pnpm check`. Two independent cookie jars create and join a table, both
// submit case 1 with a matching Origin, and this measures milliseconds from
// the second submission's POST response to the first client's SSE reveal
// snapshot. Ten runs; prints median and max.
//
// Usage: node scripts/smoke-deployed.mjs <url>

const url = process.argv[2];
if (!url) {
  console.error("usage: node scripts/smoke-deployed.mjs <url>");
  process.exit(1);
}

const CORRECT = { patient: "match", medicine: "match", dose: "match", route: "match", time: "match", overall: "match" };

function createClient(baseUrl) {
  const client = { cookie: null };
  const update = (res) => {
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) client.cookie = setCookie.split(";")[0];
  };
  client.get = async (path) => {
    const res = await fetch(new URL(path, baseUrl), {
      headers: client.cookie ? { cookie: client.cookie } : {},
    });
    update(res);
    return res;
  };
  client.post = async (path, body) => {
    const res = await fetch(new URL(path, baseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseUrl,
        ...(client.cookie ? { cookie: client.cookie } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
    update(res);
    return res;
  };
  return client;
}

async function waitForReveal(res, timeoutMs = 10000) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const deadline = Date.now() + timeoutMs;
  try {
    while (true) {
      if (Date.now() > deadline) throw new Error("timed out waiting for reveal SSE event");
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const dataLines = chunk.split("\n").filter((l) => l.startsWith("data:"));
        if (dataLines.length === 0) continue;
        const snapshot = JSON.parse(dataLines.map((l) => l.slice(5).trim()).join(""));
        const round = snapshot.rounds[snapshot.rounds.length - 1];
        if (round.revealed) return Date.now();
      }
    }
    throw new Error("SSE stream ended before a reveal event arrived");
  } finally {
    await reader.cancel().catch(() => {});
  }
}

async function oneRun() {
  const a = createClient(url);
  const b = createClient(url);

  const createRes = await a.post("/api/tables", {});
  const created = await createRes.json();
  const tableId = created.table.id;
  await b.post(`/api/tables/${tableId}/join`, {});

  const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
  const roundId = snapshot.rounds[0].id;

  const sseRes = await a.get(`/api/tables/${tableId}/events`);
  const revealPromise = waitForReveal(sseRes);

  await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, { answer: CORRECT });
  const secondSubmitResponseTime = Date.now();
  await b.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, { answer: CORRECT });
  const afterSecondSubmit = Date.now();

  const revealTime = await revealPromise;
  return revealTime - afterSecondSubmit;
}

const RUNS = 10;
const samples = [];
for (let i = 0; i < RUNS; i++) {
  const ms = await oneRun();
  samples.push(ms);
  console.log(`run ${i + 1}: ${ms}ms`);
}

samples.sort((a, b) => a - b);
const median = samples[Math.floor(samples.length / 2)];
const max = samples[samples.length - 1];
console.log(`\nmedian: ${median}ms`);
console.log(`max: ${max}ms`);
