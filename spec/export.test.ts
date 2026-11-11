import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createClient } from "./support/client.ts";

// T16 Logging and export (the export half): "stored rows contain no token;
// export CSV contains no token or cookie value." spec/usage-log.test.ts
// already covers the /log route and its stored rows; this is the one
// automated check of `pnpm export:evaluation` itself (previously only
// checked by hand each round, docs/process/round-c-export-check.md,
// because the script reads DATABASE_PATH directly rather than the shared
// APP_URL instance's database). Spawns its own app process against a
// private temp SQLite file (same pattern as spec/restart.test.ts), so the
// export script's own DATABASE_PATH can point at exactly the database this
// test just wrote to.
let child: ChildProcess | undefined;
let dir: string | undefined;

afterEach(async () => {
  if (child && !child.killed) child.kill("SIGKILL");
  child = undefined;
  if (dir) {
    await rm(dir, { recursive: true, force: true });
    dir = undefined;
  }
});

async function startApp(port: number, databasePath: string): Promise<void> {
  child = spawn(process.execPath, ["src/main.mjs"], {
    cwd: new URL("..", import.meta.url).pathname,
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

async function stopApp(): Promise<void> {
  if (!child) return;
  const exited = new Promise<void>((resolve) => child!.once("exit", () => resolve()));
  child.kill("SIGTERM");
  await exited;
}

function runExport(databasePath: string, outDir: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ["scripts/export-evaluation.ts"], {
      cwd: new URL("..", import.meta.url).pathname,
      env: { ...process.env, DATABASE_PATH: databasePath, EXPORT_OUT_DIR: outDir, NODE_ENV: "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("error", reject);
    proc.on("exit", (code) => resolve({ code, stdout, stderr }));
  });
}

async function correctAnswerForC1() {
  const bankPath = new URL("../content/case-bank.v2.json", import.meta.url).pathname;
  const bank = JSON.parse(await readFile(bankPath, "utf8"));
  const c1 = bank.cases.find((c: any) => c.caseId === "C1");
  const pair = c1.answerKey.acceptedPairs[0];
  const medicineCardId = bank.medicineCards[0].id;
  return { answer: { fields: { ...c1.answerKey.fields }, action: pair.action, evidenceId: pair.evidenceId }, medicineCardId };
}

describe("pnpm export:evaluation (T16)", { timeout: 20000 }, () => {
  it("the exported CSV carries no session cookie token, for either member", async () => {
    dir = await mkdtemp(join(tmpdir(), "spe-export-"));
    const dbPath = join(dir, "test.db");
    const outDir = join(dir, "export-out");
    const port = 23080 + Math.floor(Math.random() * 1000);
    const baseUrl = `http://localhost:${port}`;

    await startApp(port, dbPath);

    const a = createClient(baseUrl);
    const createRes = await a.post("/api/tables", {});
    expect(createRes.status, "table creation should succeed").toBe(201);
    const created = await createRes.json();
    const tableId = created.table.id;

    const b = createClient(baseUrl);
    const joinRes = await b.post(`/api/tables/${tableId}/join`, {});
    expect(joinRes.status, "join should succeed").toBe(200);

    const { answer, medicineCardId } = await correctAnswerForC1();
    const snapshot = await (await a.get(`/api/tables/${tableId}`)).json();
    const round1 = snapshot.rounds[0];

    const logRes = await a.post(`/api/tables/${tableId}/log`, { type: "reference_opened", ref: medicineCardId });
    expect(logRes.status, "usage log should succeed").toBe(204);

    const submitA = await a.post(`/api/tables/${tableId}/rounds/${round1.id}/submissions`, answer);
    expect(submitA.status, "A's submission should succeed").toBe(200);
    const submitB = await b.post(`/api/tables/${tableId}/rounds/${round1.id}/submissions`, answer);
    expect(submitB.status, "B's submission should succeed").toBe(200);

    // Both clients' real session-cookie tokens (not table/round ids): the
    // actual secret the CSV must never contain (brief §4 item 9, T16).
    expect(a.cookie, "test setup should have captured A's session cookie").toBeTruthy();
    expect(b.cookie, "test setup should have captured B's session cookie").toBeTruthy();
    const tokenA = a.cookie!.split("=")[1];
    const tokenB = b.cookie!.split("=")[1];
    expect(tokenA.length).toBeGreaterThan(10);
    expect(tokenB.length).toBeGreaterThan(10);
    expect(tokenA).not.toBe(tokenB);

    await stopApp();

    const result = await runExport(dbPath, outDir);
    expect(result.code, `export script should exit 0 (stderr: ${result.stderr})`).toBe(0);

    const date = new Date().toISOString().slice(0, 10);
    const csv = await readFile(join(outDir, `export-${date}.csv`), "utf8");

    expect(csv).not.toContain(tokenA);
    expect(csv).not.toContain(tokenB);
    expect(csv).not.toContain(a.cookie);
    expect(csv).not.toContain(b.cookie);
    // The table code (display-only, brief §9) is fine to appear; the full
    // unguessable table/invite id is not (it doubles as the invite secret,
    // src/ids.mjs) -- same secrecy class as a cookie token here.
    expect(csv).not.toContain(tableId);

    // Sanity: the export did capture this round's real, non-secret content,
    // so an empty or wrongly-scoped CSV can't pass the no-token checks above
    // vacuously.
    expect(csv).toContain("C1");
    expect(csv).toContain(created.table.code);
  });
});
