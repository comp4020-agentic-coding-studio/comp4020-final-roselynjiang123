import { randomToken } from "./ids.mjs";

const COOKIE_NAME = "spe_session";

// Parses the raw Cookie header without a dependency; Express's req.cookies
// needs cookie-parser, which this app doesn't otherwise need.
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

// Server-generated session token, validated against persistent storage
// (brief §7: "never accept a client-supplied participant ID as authority").
// A cookie value is only ever treated as identity if repo.sessionExists()
// confirms the server issued it; otherwise a fresh one is minted and the
// client gets a new cookie, instead of trusting whatever was presented.
export function sessionMiddleware(repo) {
  return (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    const presented = cookies[COOKIE_NAME];
    const valid = presented && repo.sessionExists(presented);

    const token = valid ? presented : randomToken();
    if (!valid) {
      repo.ensureSession(token);
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 365,
        path: "/",
      });
    }
    req.identity = token;
    next();
  };
}

// Same-origin write check (brief §7a): compares the Origin header's host
// (falling back to Referer) against the request's own host. Applied only to
// state-changing routes, not GET.
export function requireSameOrigin(req, res, next) {
  const origin = req.headers.origin ?? req.headers.referer;
  if (!origin) {
    res.status(403).json({ error: "missing Origin" });
    return;
  }
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    res.status(403).json({ error: "invalid Origin" });
    return;
  }
  if (originHost !== req.headers.host) {
    res.status(403).json({ error: "cross-origin write rejected" });
    return;
  }
  next();
}
