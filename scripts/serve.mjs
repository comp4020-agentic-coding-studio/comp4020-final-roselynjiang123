import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

// Serves the static build Astro produced in dist/. build.format "preserve" in
// astro.config.ts already lays out dist/ the way the app is requested
// (dist/index.html for /, dist/readme/index.html for /readme/), so this only
// needs to map a request path to a file, falling back to index.html for a
// directory and reporting anything else missing as a 404.

const DIST = new URL("../dist/", import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 8080);

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

async function resolve(pathname) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  let path = join(DIST, safe);
  let info = await stat(path).catch(() => null);
  if (info?.isDirectory()) {
    path = join(path, "index.html");
    info = await stat(path).catch(() => null);
  }
  return info?.isFile() ? path : null;
}

createServer(async (req, res) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  const file = await resolve(pathname);
  if (!file) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
    return;
  }
  const body = await readFile(file);
  res.writeHead(200, { "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(body);
}).listen(PORT, "0.0.0.0", () => {
  console.log(`serving dist/ on 0.0.0.0:${PORT}`);
});
