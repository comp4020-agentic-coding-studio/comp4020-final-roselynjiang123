import express from "express";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openDatabase, resolveDatabasePath } from "./db.mjs";
import { createRepo } from "./repo.mjs";
import { createSseHub } from "./sse.mjs";
import { sessionMiddleware, requireSameOrigin } from "./session.mjs";
import { serializeSnapshot } from "./serializer.mjs";
import { validateSubmissionV2 } from "./submissionValidator.mjs";
import { randomToken } from "./ids.mjs";
import { renderMarkdown } from "./markdown.mjs";
import { logAction } from "./actionlog.mjs";
import { loadBank } from "./bank.mjs";
import { sourcesPageHtml } from "./pages.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const OUTCOME_STATUS = {
  not_found: 404,
  forbidden: 403,
  full: 409,
  stale: 409,
};

export function createApp(db, bank) {
  const repo = createRepo(db, bank);
  const sse = createSseHub();
  const app = express();
  // Behind Fly's proxy (brief §3).
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "16kb" }));
  app.use(sessionMiddleware(repo));

  const publicDir = join(repoRoot, "public");
  if (existsSync(publicDir)) {
    // Static assets only: never the bank file, fixtures, test files, or any
    // repository file outside public/ (brief §4 item 10).
    app.use(express.static(publicDir));
  }

  app.get("/", (_req, res) => {
    res.sendFile(join(repoRoot, "public", "index.html"));
  });

  app.get("/tables", (_req, res) => {
    res.sendFile(join(repoRoot, "public", "tables.html"));
  });

  app.get("/join/:tableId", (_req, res) => {
    res.sendFile(join(repoRoot, "public", "join.html"));
  });

  app.get("/play/:tableId", (_req, res) => {
    res.sendFile(join(repoRoot, "public", "play.html"));
  });

  app.get("/readme/", (_req, res) => {
    const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
    const rendered = renderMarkdown(readme);
    const template = readFileSync(join(repoRoot, "public", "readme.html"), "utf8");
    res.type("html").send(template.replace("@README@", rendered));
  });

  // /guide/ (brief §9: "teacher guide"): facts-only markdown the student
  // edits directly, same server-side-markdown pattern as /readme/.
  app.get("/guide/", (_req, res) => {
    const guide = readFileSync(join(repoRoot, "docs", "guide.md"), "utf8");
    const rendered = renderMarkdown(guide);
    const template = readFileSync(join(repoRoot, "public", "guide.html"), "utf8");
    res.type("html").send(template.replace("@GUIDE@", rendered));
  });

  // /sources/ (brief §9: "scope, review legend, grouped sources from the
  // bank"): rendered from the live bank, not a frozen snapshot -- sources
  // are public, non-clinical, bank-wide metadata (not per-round secret
  // content), so there is nothing to freeze per round here.
  app.get("/sources/", (_req, res) => {
    res.type("html").send(sourcesPageHtml(bank));
  });

  // Reveals no paths or data; just proves the DB opens and a trivial query
  // succeeds (brief §9, endpoint list).
  app.get("/healthz", (_req, res) => {
    try {
      db.prepare("SELECT 1").get();
      res.status(200).end();
    } catch {
      res.status(500).end();
    }
  });

  app.get("/api/me/tables", (req, res) => {
    res.set("Cache-Control", "no-store");
    const rows = repo.listTablesForIdentity(req.identity);
    res.json({
      tables: rows.map((r) => ({ tableId: r.table_id, status: r.status, stage: r.stage, seat: r.seat })),
    });
  });

  // §8.4 "earlier practice in this browser": owner-only (scoped entirely by
  // req.identity, the server-validated session -- never a client-supplied
  // id, brief §4 item 1), up to 3 previous COMPLETED tables, newest first,
  // excluding ?exclude=<tableId> (the end-review/My-tables screen's own
  // table, so it never lists itself). Built from the one allowlist
  // serializer (serializeSnapshot), not a second read path, so this can
  // never expose anything that path withholds.
  app.get("/api/me/history", (req, res) => {
    res.set("Cache-Control", "no-store");
    const excludeTableId = typeof req.query.exclude === "string" ? req.query.exclude : "";
    const rows = repo.listCompletedTablesForIdentity(req.identity, excludeTableId).slice(0, 3);
    const history = rows.map((row) => {
      const snapshot = repo.getSnapshot(row.table_id, req.identity);
      const full = serializeSnapshot(snapshot, bank);
      const viewerSeat = full.viewer?.seat;
      const training = full.trainingSummary?.[viewerSeat];
      const transfer = full.transferSummary?.[viewerSeat];
      return {
        tableId: full.table.id,
        code: full.table.code,
        completedAt: row.completed_at,
        bankMajorVersion: full.table.bankMajorVersion,
        bankVersion: full.table.bankVersion,
        trainingMismatchesFound: training?.mismatchesFound ?? null,
        trainingFalseMarks: training?.matchingMarkedMismatch ?? null,
        trainingDecisionsAccepted: training?.decisions.accepted ?? null,
        transferDecisionsAccepted: transfer?.decisions.accepted ?? null,
      };
    });
    res.json({ history });
  });

  app.post("/api/tables", requireSameOrigin, (req, res) => {
    res.set("Cache-Control", "no-store");
    const tableId = randomToken();
    const { seat, roundIndex, snapshot } = repo.createTable(tableId, req.identity);
    logAction({ tableId, seat, action: "create", round: roundIndex });
    res.status(201).json(serializeSnapshot(snapshot, bank));
  });

  // GET must not consume a seat (brief §4 item 2): this route only reports
  // whether the table is joinable, never full table state for a non-member.
  app.get("/api/tables/:id", (req, res) => {
    res.set("Cache-Control", "no-store");
    const { id } = req.params;
    const snapshot = repo.getSnapshot(id, req.identity);
    if (!snapshot) {
      res.status(404).json({ error: "no such table" });
      return;
    }
    if (!repo.isMember(id, req.identity)) {
      const full = snapshot.members.length >= 2;
      res.json({
        table: { id, code: snapshot.table.id.slice(0, 4).toUpperCase() },
        joinable: !full,
      });
      return;
    }
    res.json(serializeSnapshot(snapshot, bank));
  });

  app.post("/api/tables/:id/join", requireSameOrigin, (req, res) => {
    res.set("Cache-Control", "no-store");
    const result = repo.joinTable(req.params.id, req.identity);
    if (result.outcome !== "ok") {
      res.status(OUTCOME_STATUS[result.outcome] ?? 400).json({ error: result.outcome });
      return;
    }
    logAction({ tableId: req.params.id, seat: result.seat, action: "join", round: result.roundIndex });
    sse.notify(req.params.id);
    res.json(serializeSnapshot(result.snapshot, bank));
  });

  app.post("/api/tables/:id/rounds/:roundId/submissions", requireSameOrigin, (req, res) => {
    res.set("Cache-Control", "no-store");
    const { id, roundId } = req.params;
    if (!repo.isMember(id, req.identity)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    // Validated against the round's own frozen option lists (field keys,
    // actions, evidence options), not the live bank -- so a bank edit
    // between round creation and submission can never change what counts
    // as a valid answer for an in-flight round (brief §6.1).
    const roundSnapshot = repo.getSnapshot(id, req.identity)?.rounds.find((r) => r.id === roundId);
    if (!roundSnapshot) {
      res.status(404).json({ error: "no such round" });
      return;
    }
    const error = validateSubmissionV2(req.body, roundSnapshot.case);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const result = repo.submitAnswer(id, roundId, req.identity, req.body);
    if (result.outcome !== "ok") {
      res.status(OUTCOME_STATUS[result.outcome] ?? 400).json({ error: result.outcome });
      return;
    }
    // Never pass req.body, or anything derived from it, to logAction: its
    // signature has no parameter for answer content (src/actionlog.mjs).
    logAction({ tableId: id, seat: result.seat, action: "sign", round: result.roundIndex });
    if (result.revealed) {
      logAction({ tableId: id, seat: result.seat, action: "reveal", round: result.roundIndex });
    }
    // "complete" action (brief §4 item 11): round 9's reveal moves the
    // table to "completed" (repo.submitAnswer()'s `completed` flag), unlike
    // round 6's equivalent transition which happens via /next instead.
    if (result.completed) {
      logAction({ tableId: id, seat: result.seat, action: "complete", round: result.roundIndex });
    }
    sse.notify(id);
    res.json(serializeSnapshot(result.snapshot, bank));
  });

  app.post("/api/tables/:id/next", requireSameOrigin, (req, res) => {
    res.set("Cache-Control", "no-store");
    const { id } = req.params;
    const fromRoundId = req.body?.fromRoundId;
    const fromStage = req.body?.fromStage;
    const hasRoundId = typeof fromRoundId === "string" && fromRoundId.length > 0;
    const hasStage = typeof fromStage === "string" && fromStage.length > 0;
    if (hasRoundId === hasStage) {
      // Exactly one of the two is required (brief §4 item 7): neither, or
      // both, is a malformed request.
      res.status(400).json({ error: "exactly one of fromRoundId or fromStage is required" });
      return;
    }
    const result = repo.advance(id, req.identity, { fromRoundId, fromStage });
    if (result.outcome !== "ok") {
      res.status(OUTCOME_STATUS[result.outcome] ?? 400).json({ error: result.outcome });
      return;
    }
    // Only a call that actually mutated something logs a line (brief §4
    // item 11: one line per accepted action, not per request -- an
    // idempotent replay, including round 9's "already completed" case,
    // sets neither `applied` nor `stageAction`, see src/repo.mjs). Among
    // applied calls: `stageAction` names a stage transition ("summary"
    // round 6 -> training_summary, "transfer" training_summary -> round 7,
    // or null for round 9's stage_only -> completed, already logged as
    // "complete" by the submissions route); anything else applied is a
    // plain round-to-round advance, logged as "next".
    if (result.applied && result.stageAction) {
      logAction({ tableId: id, seat: result.seat, action: result.stageAction, round: result.roundIndex ?? 0 });
    } else if (result.applied) {
      logAction({ tableId: id, seat: result.seat, action: "next", round: result.roundIndex });
    }
    sse.notify(id);
    res.json(serializeSnapshot(result.snapshot, bank));
  });

  // Usage event (brief §9): "reference_opened" with a medicine-card id or
  // "knowledge:<sectionHeading>" ref, allowlisted against the bank by
  // repo.logUsageEvent. Not used for scoring (brief's own words); never
  // broadcast over SSE or returned in any snapshot -- it has no reader
  // besides pnpm export:evaluation. T16: unknown type/ref is REJECTED
  // (400), not silently dropped; only the per-member rate limit (>60/min)
  // is silently ignored (brief §9's own distinction -- "allowlisted types
  // and refs" vs. "silently ignore more than 60 events").
  app.post("/api/tables/:id/log", requireSameOrigin, (req, res) => {
    res.set("Cache-Control", "no-store");
    const { id } = req.params;
    const type = req.body?.type;
    const ref = req.body?.ref;
    if (typeof type !== "string" || typeof ref !== "string") {
      res.status(400).json({ error: "type and ref are required strings" });
      return;
    }
    const result = repo.logUsageEvent(id, req.identity, type, ref);
    if (result.outcome === "forbidden") {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    if (result.outcome === "not_found") {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (result.outcome === "invalid") {
      res.status(400).json({ error: "unknown type or ref" });
      return;
    }
    // "ok" and "rate_limited" both succeed from the client's point of view
    // (brief: "silently ignore" the rate-limited case) -- the caller never
    // needs to distinguish a logged event from a capped one.
    res.status(204).end();
  });

  // SSE: authorise membership, then send a fresh database-derived snapshot
  // on connect and on every subsequent notify() for this table (brief §4
  // item 3).
  app.get("/api/tables/:id/events", (req, res) => {
    const { id } = req.params;
    if (!repo.isMember(id, req.identity)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    res.write("retry: 2000\n\n");

    const send = () => {
      const snapshot = repo.getSnapshot(id, req.identity);
      if (!snapshot) return;
      res.write(`data: ${JSON.stringify(serializeSnapshot(snapshot, bank))}\n\n`);
    };
    send();

    const unsubscribe = sse.subscribe(id, send);
    const keepalive = setInterval(() => res.write(": keepalive\n\n"), 20000);

    req.on("close", () => {
      clearInterval(keepalive);
      unsubscribe();
    });
  });

  return { app, repo, sse };
}

export function start() {
  const port = Number(process.env.PORT ?? 8080);
  const db = openDatabase(resolveDatabasePath());
  // BANK_PATH lets T10 (spec/snapshots.test.ts) point a second process at an
  // edited copy of the bank against the same database file, to prove a
  // round's frozen snapshot doesn't change when the bank does. Production
  // and normal local runs never set it, so they always load the real file.
  const bankPath = process.env.BANK_PATH ?? join(repoRoot, "content", "case-bank.v2.json");
  const bank = loadBank(bankPath);
  const { app } = createApp(db, bank);

  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`listening on 0.0.0.0:${port}`);
  });

  // Fly stops idle machines; close the database cleanly (brief §3).
  const shutdown = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return { app, db, server };
}
