# 0003: Anonymous server-issued cookie identity

**Context.** Brief §2/§4 rule out accounts or nicknames, but the game still
needs to tell Checker A from Checker B across requests and reconnects,
resist seat hijacking, and never trust a client-supplied ID as authority
(brief §7).

**Options.** (1) A client-generated or client-supplied identity, trusting
the client to be honest. (2) A high-entropy, server-generated, HttpOnly
session token validated against persistent storage every request, honouring
a presented value only if the server recognises it.

**Decision.** Chose (2):
[`415e18d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/415e18d).
`src/session.mjs`'s `sessionMiddleware` checks any presented `spe_session`
cookie against `repo.sessionExists()`; only a token the server itself issued
is honoured, otherwise a fresh one is minted. `req.identity` -- never
anything from the request body -- is what every route and the allowlist
serializer treat as the caller. Cookie is HttpOnly, SameSite=Lax, Secure in
production.

**Cost.** No real-person verification exists or is claimed: an invitation
admits a second *browser identity*, not a second human. Clearing cookies
loses that identity with no recovery path; `/readme/` must disclose this.
spec/sse.test.ts's "forged identity in the request body does not bypass
session identity" guards against a regression that started trusting a
body-supplied identity.
