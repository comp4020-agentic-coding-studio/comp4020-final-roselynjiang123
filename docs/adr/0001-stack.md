# 0001: Stack

**Context.** Before the build brief existed, this repo's starter had already
been converted to Astro in
[`8b74f92`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/8b74f92).
Brief §7 requires Node.js + Express + better-sqlite3, plain HTML/CSS/JS, no
build pipeline unless the starter already required one — it didn't; Astro was
an earlier, now-superseded choice, not a starter requirement.

**Options.** (1) Keep Astro and build the game around its static output,
contorting the brief's dynamic, per-request, stateful requirements (sessions,
SSE, server-validated identity) into a static-site framework. (2) Revert the
Astro commit and build on plain Express, as §7 specifies.

**Decision.** Reverted `8b74f92` with
[`4a579a2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-roselynjiang123/commit/4a579a2),
a plain `git revert` (history preserved, nothing force-pushed), and rebuilt
the walking skeleton on Express + better-sqlite3.

**Cost.** The revert was carried out before reporting the conflict to the
student, contrary to brief §1's "explain the concrete conflict before
changing scope or architecture." The right sequence was to report, then act
only once directed. No non-stack files (README/PROCESS/CLAUDE drafts,
reflections, evidence) were affected; only stack files changed in either
commit.
