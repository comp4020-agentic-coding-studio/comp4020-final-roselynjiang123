#!/usr/bin/env node
// Manual smoke test against a deployed instance (brief §9 item 12), not run
// by `pnpm check`. Two independent cookie jars create and join a table, both
// submit case 1 with a matching Origin, and this measures milliseconds from
// just before the second submission's POST is sent to the first client's SSE
// reveal snapshot arriving. Ten runs; prints median and max.
//
// This is the second version of this script. The first started its timer
// after awaiting the second POST's response -- i.e. after that request's own
// round trip had already completed -- then measured to the SSE reveal. The
// server calls sse.notify() before sending the second submitter's HTTP
// response (src/server.mjs), so that timer's start point and the SSE push
// left the server in the same tick and raced back over two independent TCP
// connections; whichever happened to arrive first made the measured gap
// near-zero or negative. That measured which of two already-in-flight
// responses won a race, not how long an update takes to become visible.
// Starting the timer before the second POST is sent measures the thing
// brief §7 actually asks about: elapsed time from submitting to seeing the
// update, over the full round trip.
//
// Usage: node scripts/smoke-deployed.mjs <url>

const url = process.argv[2];
if (!url) {
  console.error("usage: node scripts/smoke-deployed.mjs <url>");
  process.exit(1);
}

// v2 submission shape (brief §7): five fields + exactly one action + one
// evidenceId, read from the live case bank's own case 1 (C1) accepted
// answer, not hand-written -- so this script tracks the bank's actual
// field keys and an actually-accepted pair instead of a stale, separately
// maintained v1 constant (the v1 `{ ..., overall: "match" }` shape this
// script used to post is rejected outright by the v2 validator).
const { readFile } = await import("node:fs/promises");
const bank = JSON.parse(await readFile(new URL("../content/case-bank.v2.json", import.meta.url), "utf8"));
const c1 = bank.cases.find((c) => c.caseId === "C1");
const acceptedPair = c1.answerKey.acceptedPairs[0];
const CORRECT = { fields: { ...c1.answerKey.fields }, action: acceptedPair.action, evidenceId: acceptedPair.evidenceId };

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

  await a.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, CORRECT);

  const beforeSecondSubmit = Date.now();
  await b.post(`/api/tables/${tableId}/rounds/${roundId}/submissions`, CORRECT);

  const revealTime = await revealPromise;
  return revealTime - beforeSecondSubmit;
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
