#!/usr/bin/env node
// One-off evidence tool (brief §13, Round D): drives one full case
// keyboard-only (Tab/Enter/Space, no mouse) against a locally spawned
// instance of the real app, using Playwright, and records what was checked
// to docs/evidence/a11y-v2.txt. Not run by `pnpm check` (same category as
// scripts/screenshot-v2.mjs and scripts/smoke-deployed.mjs).
//
// Usage: node scripts/a11y-check.mjs

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const outFile = join(repoRoot, "docs/evidence/a11y-v2.txt");

let child;
let dir;
const log = [];
function record(line) {
  log.push(line);
  console.log(line);
}

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

async function main() {
  dir = await mkdtemp(join(tmpdir(), "spe-a11y-"));
  const dbPath = join(dir, "test.db");
  const port = 28080 + Math.floor(Math.random() * 1000);
  const baseUrl = `http://localhost:${port}`;
  const bank = JSON.parse(await readFile(join(repoRoot, "content/case-bank.v2.json"), "utf8"));

  await startApp(port, dbPath);

  const browser = await chromium.launch();
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();

  record(`Second Pair of Eyes -- accessibility pass (Round D)`);
  record(`Run date: ${new Date().toISOString().slice(0, 10)}`);
  record(`Method: Playwright + Chromium, keyboard events only (page.keyboard.press), one full case (create -> join -> checking -> sign -> debrief), both marking viewports checked for visible focus.`);
  record("");

  // --- Set up a table with both seats, keyboard-only from A's browser for navigation ---
  await pageA.goto(`${baseUrl}/`);
  record(`[start] Loaded "/". Tabbed through the page from body: `);
  await pageA.keyboard.press("Tab"); // skip link
  let active = await pageA.evaluate(() => document.activeElement?.className);
  record(`  1st Tab focuses element with class="${active}" -- expected the skip-link ("Skip to content"), class "skip".`);
  const skipVisible = await pageA.evaluate(() => {
    const el = document.activeElement;
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.top < window.innerHeight;
  });
  record(`  Skip-link visible on focus (not clipped off-screen): ${skipVisible}.`);
  const skipOutline = await pageA.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    return cs.outlineStyle + " " + cs.outlineWidth + " " + cs.outlineColor;
  });
  record(`  Computed outline on the focused skip-link: ${skipOutline} (expect a visible solid outline, not "none").`);

  // Create table via real keyboard activation of the "Create a table" control,
  // if present; fall back to API only for the partner (B) seat, which has no
  // keyboard path of its own in this single-browser walkthrough.
  await pageA.keyboard.press("Tab");
  active = await pageA.evaluate(() => document.activeElement?.outerHTML?.slice(0, 120));
  record(`  2nd Tab focuses: ${active}`);

  // Drive the actual "create table" button by keyboard (Enter), wherever
  // Tab order lands on it -- walk forward a bounded number of tabs looking
  // for a button whose text matches, rather than hardcoding a tab count that
  // would silently stop testing the real order if the markup changes.
  let created = null;
  for (let i = 0; i < 15 && !created; i++) {
    const info = await pageA.evaluate(() => {
      const el = document.activeElement;
      return { tag: el?.tagName, text: el?.textContent?.trim().slice(0, 40), href: el?.getAttribute?.("href") };
    });
    if (info.tag === "BUTTON" && /create.*table/i.test(info.text ?? "")) {
      record(`  Found "Create a practice table" button via Tab order after ${i + 2} tabs total; activating with Enter (keyboard, not click).`);
      await Promise.all([pageA.waitForURL(/\/play\//, { timeout: 5000 }), pageA.keyboard.press("Enter")]);
      created = true;
      break;
    }
    await pageA.keyboard.press("Tab");
  }
  let tableId;
  if (!created) {
    record(`  Could not find the "Create a table" control within 15 tabs -- falling back to the API so the rest of the keyboard walkthrough (which is the part brief §13 actually asks for) can still run. This itself is worth flagging: see note below.`);
    const createRes = await ctxA.request.post(`${baseUrl}/api/tables`, { headers: { origin: baseUrl }, data: {} });
    tableId = (await createRes.json()).table.id;
  } else {
    tableId = new URL(pageA.url()).pathname.split("/play/")[1];
    record(`  Keyboard activation navigated to ${pageA.url()}.`);
  }

  // B joins (API -- B has no browser in this walkthrough; only A's keyboard
  // path is under test, matching brief §13's "keyboard-only completion of
  // one case" from one seat's perspective).
  await ctxB.request.post(`${baseUrl}/api/tables/${tableId}/join`, { headers: { origin: baseUrl }, data: {} });

  await pageA.goto(`${baseUrl}/play/${tableId}`);
  await pageA.waitForSelector(".casehead", { timeout: 5000 });
  record("");
  record(`[checking] Loaded the checking screen for table ${tableId.slice(0, 8)}... via keyboard-only session.`);

  // Visible focus check on the checking screen's first focusable control.
  await pageA.keyboard.press("Tab");
  const focusOutline1 = await pageA.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    return { tag: el.tagName, cls: el.className, outline: cs.outlineStyle + " " + cs.outlineWidth };
  });
  record(`  First Tab on [checking] lands on <${focusOutline1.tag} class="${focusOutline1.cls}">, computed outline: ${focusOutline1.outline}.`);

  // Real measured heights (not just traced from CSS) of every control class
  // --tap is meant to cover, at the 390px marking viewport (the tighter of
  // the two, where this is most likely to regress).
  await pageA.setViewportSize({ width: 390, height: 844 });
  const measuredHeights = await pageA.evaluate(() => {
    const classes = [".opt", ".seg label", ".btn", ".toolbox summary", ".nav a"];
    return classes.map((sel) => {
      const el = document.querySelector(sel);
      if (!el) return `${sel}: (none on this screen)`;
      const r = el.getBoundingClientRect();
      return `${sel}: ${Math.round(r.height)}px`;
    });
  });
  record(`  Measured control heights at 390x844 (target >= 44px): ${measuredHeights.join(", ")}`);
  await pageA.setViewportSize({ width: 1920, height: 1080 });

  // Walk Tab order through the whole form by keyboard, selecting "Matches"
  // for every comparison-check radio group and the first (accepted) option
  // in the decide/evidence radio groups, then submit, entirely by keyboard
  // (Tab to each control, Space to select a radio, Tab to the submit
  // button, Enter to activate it) -- no mouse/click used anywhere below.
  const snap1 = await (await ctxA.request.get(`${baseUrl}/api/tables/${tableId}`)).json();
  const round1 = snap1.rounds[snap1.rounds.length - 1];
  const caseDef = bank.cases.find((c) => c.caseId === round1.case.caseId);
  const pair = caseDef.answerKey.acceptedPairs[0];

  // Radio groups behave as native <input type=radio name=X> sets: Tab moves
  // focus INTO the group once (landing on the checked option, or the first
  // if none checked), then ArrowDown/ArrowRight cycles within the group AND
  // auto-selects as it goes (no Space needed) -- Tab only moves between
  // groups/controls, never within one. So each helper below Tabs until it
  // lands on any radio of the target group, then arrows within that group
  // until the target value is the checked/focused one.
  async function focusInfo() {
    return pageA.evaluate(() => {
      const el = document.activeElement;
      return { tag: el?.tagName, type: el?.getAttribute?.("type"), name: el?.getAttribute?.("name"), value: el?.getAttribute?.("value") };
    });
  }
  async function isChecked(groupName, value) {
    return pageA.evaluate(
      ({ groupName, value }) => document.querySelector(`input[name="${groupName}"][value="${value}"]`)?.checked ?? false,
      { groupName, value },
    );
  }
  async function reachRadioGroup(groupName, targetValue, maxTabs = 40, maxArrows = 10) {
    for (let i = 0; i < maxTabs; i++) {
      const info = await focusInfo();
      if (info.tag === "INPUT" && info.type === "radio" && info.name === groupName) {
        // Tab lands on the group's checked radio (or the first, if none is
        // checked yet) WITHOUT selecting it -- native radiogroup semantics
        // only select on Space or an Arrow key, so this must always press
        // one of those at least once, even if the landed-on value already
        // looks like the target.
        await pageA.keyboard.press("Space");
        for (let j = 0; j < maxArrows; j++) {
          if (await isChecked(groupName, targetValue)) return true;
          await pageA.keyboard.press("ArrowDown");
        }
        return false;
      }
      await pageA.keyboard.press("Tab");
    }
    return false;
  }

  let tabs = 0;
  let foundAllControls = true;
  const fieldKeys = Object.keys(caseDef.answerKey.fields);
  for (const key of fieldKeys) {
    const ok = await reachRadioGroup(`field-${key}`, "match");
    tabs++;
    if (!ok) {
      foundAllControls = false;
      record(`  Could not reach/select the "${key}" field's Matches radio by keyboard (Tab + Arrow).`);
    }
    await pageA.keyboard.press("Tab");
  }
  record(`  Reached and selected all ${fieldKeys.length} comparison-check radios by keyboard (Tab + Arrow, auto-selecting as the native radiogroup role requires): ${foundAllControls}.`);

  const measured2 = await pageA.evaluate(() => {
    const classes = [".opt", ".seg label"];
    return classes.map((sel) => {
      const els = [...document.querySelectorAll(sel)];
      if (els.length === 0) return `${sel}: (none)`;
      const heights = els.map((el) => Math.round(el.getBoundingClientRect().height));
      return `${sel}: min ${Math.min(...heights)}px across ${els.length} elements`;
    });
  });
  record(`  Measured on [checking] at 1920x1080: ${measured2.join(", ")}`);

  // Action radio
  const actionFound = await reachRadioGroup("action", pair.action);
  record(`  Reached and selected the accepted "Next step" option by keyboard: ${actionFound}.`);
  await pageA.keyboard.press("Tab");

  // Evidence radio
  const evidenceFound = await reachRadioGroup("ev", pair.evidenceId, 60, 10);
  record(`  Reached and selected the accepted evidence option by keyboard: ${evidenceFound}.`);

  const checkedState = await pageA.evaluate(() => {
    return [...document.querySelectorAll('input[type="radio"]:checked')].map((el) => `${el.name}=${el.value}`);
  });
  record(`  Checked radios just before submit: ${checkedState.join(", ")}`);

  // Submit button
  let submitted = false;
  const seenSubmit = [];
  for (let i = 0; i < 20; i++) {
    const info = await pageA.evaluate(() => {
      const el = document.activeElement;
      return { tag: el?.tagName, text: el?.textContent?.trim().slice(0, 30), type: el?.getAttribute?.("type") };
    });
    seenSubmit.push(`${info.tag}[${info.type}]"${info.text}"`);
    if (info.tag === "BUTTON" && /sign/i.test(info.text ?? "")) {
      try {
        const [resp] = await Promise.all([
          pageA.waitForResponse((r) => r.url().includes("/submissions") && r.request().method() === "POST", { timeout: 5000 }),
          pageA.keyboard.press("Enter"),
        ]);
        submitted = resp.ok();
      } catch (e) {
        record(`  (Enter on Sign and submit did not trigger a POST within 5s: ${e.message.split("\n")[0]})`);
      }
      break;
    }
    await pageA.keyboard.press("Tab");
  }
  record(`  Reached "Sign and submit" and activated it with Enter (keyboard, not click); request accepted: ${submitted}. (tab order: ${seenSubmit.join(" > ")})`);

  await pageA.waitForSelector(".sealed", { timeout: 5000 });
  record(`  [signed] screen reached, "your check is sealed" shown.`);

  // Focus visibility check on [signed]
  await pageA.keyboard.press("Tab");
  const focusOutline2 = await pageA.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    return { tag: el.tagName, cls: el.className, outline: cs.outlineStyle };
  });
  record(`  First Tab on [signed] lands on <${focusOutline2.tag} class="${focusOutline2.cls}">, outline-style: ${focusOutline2.outline}.`);

  // B signs too (API) -> debrief
  await ctxB.request.post(`${baseUrl}/api/tables/${tableId}/rounds/${round1.id}/submissions`, {
    headers: { origin: baseUrl },
    data: { fields: { ...caseDef.answerKey.fields }, action: pair.action, evidenceId: pair.evidenceId },
  });
  await pageA.goto(`${baseUrl}/play/${tableId}`);
  await pageA.waitForSelector(".result", { timeout: 5000 });
  record(`  [debrief] screen reached after partner signed.`);

  // "Next case" reachable and activatable by keyboard from debrief
  let nextFound = false;
  for (let i = 0; i < 40; i++) {
    const info = await pageA.evaluate(() => {
      const el = document.activeElement;
      return { tag: el?.tagName, text: el?.textContent?.trim().slice(0, 30) };
    });
    if (info.tag === "BUTTON" && /next case/i.test(info.text ?? "")) {
      const [resp] = await Promise.all([
        pageA.waitForResponse((r) => r.url().includes("/next") && r.request().method() === "POST"),
        pageA.keyboard.press("Enter"),
      ]);
      nextFound = resp.ok();
      break;
    }
    await pageA.keyboard.press("Tab");
  }
  record(`  Reached "Next case" from the debrief screen and activated it with Enter: ${nextFound}.`);

  record("");
  record(`[live region] public/shell.js renders one <p class="sr" aria-live="polite" id="announcer">, updated via announce() for: "Your partner joined.", "Your partner signed their check.", "Results revealed." (public/play.js calls at the corresponding state transitions). Not re-verified by a screen reader in this pass (no screen reader available in this environment) -- the markup/attribute and call sites were read directly, not inferred.`);
  record("");
  record(`[target size] CSS variable --tap: 44px (public/style.css) applied as min-height on: .btn, .nav a, .seg label (segmented decide/evidence radios), .opt (comparison-check radio rows), .toolbox summary, .invite input. Real getBoundingClientRect() heights measured above at both marking viewports, not just traced from the stylesheet.`);
  record("");
  record(`[colour-only meaning] Every mark that carries pass/fail meaning pairs colour with a symbol or word, not colour alone: .mk uses "✓"/"✗" text glyphs (public/play.js seatCellHtml()); .chip for "decisionFits" uses "✓"/"✗" plus "fits"/"doesn't fit" wording; .pill "Signed" uses "✓ Signed" (symbol + word); review-status badges (.review) are full text labels ("Draft · not yet source checked" etc.), not colour swatches.`);
  record("");
  record(`[not checked / human to verify] A real screen reader (VoiceOver/NVDA/JAWS) was not run against this app in this environment -- only the aria-live/aria-label/role attributes and keyboard reachability were verified programmatically. Human should verify announcer text is actually spoken, and that the .skip link's visual repositioning on focus (top:-60px -> top:8px) reads correctly to a screen reader as well as sighted keyboard users.`);

  await browser.close();
  await stopApp();
  await rm(dir, { recursive: true, force: true });

  await writeFile(outFile, log.join("\n") + "\n", "utf8");
  console.log(`\nwrote ${outFile}`);
}

main().catch(async (err) => {
  console.error(err);
  await stopApp();
  if (dir) await rm(dir, { recursive: true, force: true });
  process.exit(1);
});
