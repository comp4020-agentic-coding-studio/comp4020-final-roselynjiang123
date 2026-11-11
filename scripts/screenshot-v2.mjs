#!/usr/bin/env node
// One-off evidence tool (brief §10.1/§13, Round D): screenshots every v2
// reference state at both marking viewports (1920x1080, 390x844) against a
// locally spawned instance of the real app, into docs/evidence/screens-v2/,
// for visual comparison against docs/reference/shots/. Not run by
// `pnpm check` (same category as scripts/smoke-deployed.mjs).
//
// Usage: node scripts/screenshot-v2.mjs

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const outDir = join(repoRoot, "docs/evidence/screens-v2");
const VIEWPORTS = [
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "390x844", width: 390, height: 844 },
];

let child;
let dir;

async function startApp(port, databasePath) {
  child = spawn(process.execPath, ["src/main.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(port), DATABASE_PATH: databasePath, NODE_ENV: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (let attempt = 0; ; attempt++) {
    try {
      await fetch(`http://localhost:${port}/healthz`);
      return;
    } catch {
      // not up yet
    }
    if (attempt >= 100) throw new Error(`app did not start on port ${port}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function stopApp() {
  if (!child) return;
  await new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill("SIGTERM");
  });
}

function correctAnswerFor(bank, caseId) {
  const caseDef = bank.cases.find((c) => c.caseId === caseId);
  const pair = caseDef.answerKey.acceptedPairs[0];
  return { fields: { ...caseDef.answerKey.fields }, action: pair.action, evidenceId: pair.evidenceId };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  dir = await mkdtemp(join(tmpdir(), "spe-screenshot-"));
  const dbPath = join(dir, "test.db");
  const port = 27080 + Math.floor(Math.random() * 1000);
  const baseUrl = `http://localhost:${port}`;
  const bank = JSON.parse(await readFile(join(repoRoot, "content/case-bank.v2.json"), "utf8"));

  await startApp(port, dbPath);

  const browser = await chromium.launch();
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  async function shoot(name, page) {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(150);
      await page.screenshot({ path: join(outDir, `${name}-${vp.name}.png`), fullPage: true });
    }
  }

  // start
  await pageA.goto(`${baseUrl}/`);
  await shoot("start", pageA);

  // create table as A
  const createRes = await ctxA.request.post(`${baseUrl}/api/tables`, {
    headers: { origin: baseUrl },
    data: {},
  });
  const created = await createRes.json();
  const tableId = created.table.id;

  // waiting (A alone)
  await pageA.goto(`${baseUrl}/play/${tableId}`);
  await pageA.waitForSelector(".invite", { timeout: 5000 });
  await shoot("waiting", pageA);

  // B joins -> checking (both)
  await ctxB.request.post(`${baseUrl}/api/tables/${tableId}/join`, {
    headers: { origin: baseUrl },
    data: {},
  });
  await pageA.goto(`${baseUrl}/play/${tableId}`);
  await pageA.waitForSelector(".casehead", { timeout: 5000 });
  await shoot("checking", pageA);

  // A signs -> signed (A's own view)
  const snapshot1 = await (await ctxA.request.get(`${baseUrl}/api/tables/${tableId}`)).json();
  const round1 = snapshot1.rounds[snapshot1.rounds.length - 1];
  await ctxA.request.post(`${baseUrl}/api/tables/${tableId}/rounds/${round1.id}/submissions`, {
    headers: { origin: baseUrl },
    data: correctAnswerFor(bank, round1.case.caseId),
  });
  await pageA.goto(`${baseUrl}/play/${tableId}`);
  await pageA.waitForSelector(".sealed", { timeout: 5000 });
  await shoot("signed", pageA);

  // B signs too -> debrief (both revealed)
  await ctxB.request.post(`${baseUrl}/api/tables/${tableId}/rounds/${round1.id}/submissions`, {
    headers: { origin: baseUrl },
    data: correctAnswerFor(bank, round1.case.caseId),
  });
  await pageA.goto(`${baseUrl}/play/${tableId}`);
  await pageA.waitForSelector(".result", { timeout: 5000 });
  await shoot("debrief", pageA);

  // advance through training rounds 1-6 -> training_summary
  for (;;) {
    const snap = await (await ctxA.request.get(`${baseUrl}/api/tables/${tableId}`)).json();
    if (snap.table.stage === "training_summary") break;
    const round = snap.rounds[snap.rounds.length - 1];
    if (!round.revealed) {
      if (!round.mine.submitted) {
        await ctxA.request.post(`${baseUrl}/api/tables/${tableId}/rounds/${round.id}/submissions`, {
          headers: { origin: baseUrl },
          data: correctAnswerFor(bank, round.case.caseId),
        });
      }
      if (!round.partner.submitted) {
        await ctxB.request.post(`${baseUrl}/api/tables/${tableId}/rounds/${round.id}/submissions`, {
          headers: { origin: baseUrl },
          data: correctAnswerFor(bank, round.case.caseId),
        });
      }
      continue;
    }
    await ctxA.request.post(`${baseUrl}/api/tables/${tableId}/next`, {
      headers: { origin: baseUrl },
      data: { fromRoundId: round.id },
    });
  }
  await pageA.goto(`${baseUrl}/play/${tableId}`);
  await pageA.waitForSelector(".sumhead", { timeout: 5000 });
  await shoot("summary", pageA);

  // start transfer -> round 7, transfer-intro banner + checking
  await ctxA.request.post(`${baseUrl}/api/tables/${tableId}/next`, {
    headers: { origin: baseUrl },
    data: { fromStage: "training_summary" },
  });
  await pageA.goto(`${baseUrl}/play/${tableId}`);
  await pageA.waitForSelector(".casehead", { timeout: 5000 });
  await shoot("transfer-intro", pageA);

  // advance through transfer rounds 7-9 -> completed
  for (;;) {
    const snap = await (await ctxA.request.get(`${baseUrl}/api/tables/${tableId}`)).json();
    if (snap.table.stage === "completed") break;
    const round = snap.rounds[snap.rounds.length - 1];
    if (!round.revealed) {
      if (!round.mine.submitted) {
        await ctxA.request.post(`${baseUrl}/api/tables/${tableId}/rounds/${round.id}/submissions`, {
          headers: { origin: baseUrl },
          data: correctAnswerFor(bank, round.case.caseId),
        });
      }
      if (!round.partner.submitted) {
        await ctxB.request.post(`${baseUrl}/api/tables/${tableId}/rounds/${round.id}/submissions`, {
          headers: { origin: baseUrl },
          data: correctAnswerFor(bank, round.case.caseId),
        });
      }
      continue;
    }
    await ctxA.request.post(`${baseUrl}/api/tables/${tableId}/next`, {
      headers: { origin: baseUrl },
      data: { fromRoundId: round.id },
    });
  }
  await pageA.goto(`${baseUrl}/play/${tableId}`);
  await pageA.waitForSelector(".sumhead", { timeout: 5000 });
  await shoot("end", pageA);

  // sources
  await pageA.goto(`${baseUrl}/sources/`);
  await shoot("sources", pageA);

  await browser.close();
  await stopApp();
  await rm(dir, { recursive: true, force: true });
  console.log(`wrote screenshots to ${outDir}`);
}

main().catch(async (err) => {
  console.error(err);
  await stopApp();
  if (dir) await rm(dir, { recursive: true, force: true });
  process.exit(1);
});
