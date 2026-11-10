import express from "express";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openDatabase, resolveDatabasePath } from "./db.mjs";
import { createRepo } from "./repo.mjs";
import { createSseHub } from "./sse.mjs";
import { sessionMiddleware, requireSameOrigin } from "./session.mjs";
import { serializeSnapshot } from "./serializer.mjs";
import { validateAnswer } from "./scoring.mjs";
import { randomToken } from "./ids.mjs";
import { renderMarkdown } from "./markdown.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const OUTCOME_STATUS = {
  not_found: 404,
  forbidden: 403,
  full: 409,
  stale: 409,
};

export function createApp(db) {
  const repo = createRepo(db);
  const sse = createSseHub();
  const app = express();
  // Behind Fly's proxy (brief §7a).
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "16kb" }));
  app.use(sessionMiddleware(repo));

  const publicDir = join(repoRoot, "public");
  if (existsSync(publicDir)) {
    // Static assets only: never the case module, the database, test
    // fixtures, or any repository file outside public/ (brief §5, §9 #4).
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

  // Reveals no paths or data; just proves the DB opens and a trivial query
  // succeeds (brief §7, endpoint list).
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
      tables: rows.map((r) => ({ tableId: r.table_id, status: r.status, seat: r.seat })),
    });
  });

  app.post("/api/tables", requireSameOrigin, (req, res) => {
    res.set("Cache-Control", "no-store");
    const tableId = randomToken();
    const snapshot = repo.createTable(tableId, req.identity);
    res.status(201).json(serializeSnapshot(snapshot));
  });

  // GET must not consume a seat (brief §4 step 3): this route only reports
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
    res.json(serializeSnapshot(snapshot));
  });

  app.post("/api/tables/:id/join", requireSameOrigin, (req, res) => {
    res.set("Cache-Control", "no-store");
    const result = repo.joinTable(req.params.id, req.identity);
    if (result.outcome !== "ok") {
      res.status(OUTCOME_STATUS[result.outcome] ?? 400).json({ error: result.outcome });
      return;
    }
    sse.notify(req.params.id);
    res.json(serializeSnapshot(result.snapshot));
  });

  app.post("/api/tables/:id/rounds/:roundId/submissions", requireSameOrigin, (req, res) => {
    res.set("Cache-Control", "no-store");
    const { id, roundId } = req.params;
    if (!repo.isMember(id, req.identity)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const error = validateAnswer(req.body?.answer);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const result = repo.submitAnswer(id, roundId, req.identity, req.body.answer);
    if (result.outcome !== "ok") {
      res.status(OUTCOME_STATUS[result.outcome] ?? 400).json({ error: result.outcome });
      return;
    }
    sse.notify(id);
    res.json(serializeSnapshot(result.snapshot));
  });

  app.post("/api/tables/:id/next", requireSameOrigin, (req, res) => {
    res.set("Cache-Control", "no-store");
    const { id } = req.params;
    const fromRoundId = req.body?.fromRoundId;
    if (typeof fromRoundId !== "string" || fromRoundId.length === 0) {
      res.status(400).json({ error: "fromRoundId is required" });
      return;
    }
    const result = repo.advance(id, req.identity, fromRoundId);
    if (result.outcome !== "ok") {
      res.status(OUTCOME_STATUS[result.outcome] ?? 400).json({ error: result.outcome });
      return;
    }
    sse.notify(id);
    res.json(serializeSnapshot(result.snapshot));
  });

  // SSE: authorise membership, then send a fresh database-derived snapshot
  // on connect and on every subsequent notify() for this table (brief §7).
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
      res.write(`data: ${JSON.stringify(serializeSnapshot(snapshot))}\n\n`);
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
  const { app } = createApp(db);

  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`listening on 0.0.0.0:${port}`);
  });

  // Fly stops idle machines; close the database cleanly (brief §7a).
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
