import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openDatabase, resolveDatabasePath } from "./db.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

export function createApp(db) {
  const app = express();
  // Behind Fly's proxy (brief §7a).
  app.set("trust proxy", 1);

  app.get("/", (_req, res) => {
    res.sendFile(join(repoRoot, "placeholder", "index.html"));
  });

  app.get("/readme/", (_req, res) => {
    const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
    const escaped = readme.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const template = readFileSync(join(repoRoot, "placeholder", "readme.html"), "utf8");
    res.type("html").send(template.replace("@README@", escaped));
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

  return app;
}

export function start() {
  const port = Number(process.env.PORT ?? 8080);
  const db = openDatabase(resolveDatabasePath());
  const app = createApp(db);

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
