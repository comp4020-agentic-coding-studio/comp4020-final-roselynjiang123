# Second Pair of Eyes v2 · 给 Sonnet 5 的分轮 prompt

2026-11-11。按顺序用：第 0 步你手动做，然后 Round A–D 交给 Sonnet，中间是你的验证窗口，最后 Round E。每轮都**新开会话**，先粘启动语，再粘本轮 prompt。每轮结束只看“你检查”清单：全 ✓ 直接进下一轮；有 ✗ 把 Sonnet 的汇报和 ✗ 的编号发给我。

**启动语（每轮开头都粘）**

```
Read CLAUDE.md, docs/build-brief.md, docs/evidence-log.md and `git log --oneline -20`. Then do the round below.
```

> Round A 的第 2 步才会把新 brief 改名成 `docs/build-brief.md`；所以 Round A 那一次，启动语后面的 prompt 会让它再读 `docs/build-brief-v2.md`。

---

## 第 0 步：你手动准备（约 20 分钟）

1. 在仓库根目录解压 `second-pair-v2-repo-files.zip`。`git status` 应该看到新增的 `content/`、`docs/build-brief-v2.md`、`docs/content/`、`docs/reference/ui-reference-v2.html`、`docs/reference/shots/`、`docs/planning/` 里的两个新文件。
2. 把你手上的两份旧方案放进 `docs/planning/`，用原文件名：我的 v2.0（`Second_Pair_Project_Baseline_v2_ZH.md`）和外部规格（`Second_Pair_Teaching_Upgrade_v2.md`）。
3. 用浏览器打开 `docs/reference/ui-reference-v2.html`，点顶部黑条切换 9 个状态看一遍。**这是最终界面**；想改颜色或文案，现在告诉我，开工后不再改。
4. 打开 `docs/content/review-pack.md`，先把 ⚠ 项过一遍。不用等改完才开工：Sonnet 用 draft 内容开发，界面上会显示 “Draft”。
5. 把审阅包（review-pack.md 导出成 PDF 即可）发给审阅者，越早越好。
6. Claude Code 里 `/model` 切到 Sonnet 5；Shift+Tab 开自动接受编辑。部署和推送命令它仍会问你，点同意即可。

---

## Round A：对照现状、改合同、先写测试、做纯函数

**粘贴给 Sonnet：**

```
Round A of E — map, harness, contracts. Read spec/README.md, package.json, the server code, database migrations, existing tests and front-end files. Then read docs/build-brief-v2.md in full, content/case-bank.v2.json, docs/content/scoring-fixtures.json, and skim docs/reference/ui-reference-v2.html and docs/reference/shots/.

This upgrade is authorised by me. Where it conflicts with the v1.1 brief or the current CLAUDE.md (for example: real medicine names, five fields + next step + evidence instead of "Overall", a transfer stage, summaries, the new UI and CSS), v2 wins. It does not authorise anything listed in brief v2 §2.

1. Map first, no code: write docs/process/v2-implementation-map.md (max 60 lines): what exists today (engine pieces, routes, tables, tests, stylesheet), what v2 changes, what stays, and every conflict between the old CLAUDE.md/brief and v2 with its resolution. Say plainly whether the two-player engine in brief v2 §4 already works.
2. Adopt the new contract: `git mv docs/build-brief.md docs/planning/build-brief-v1.1.md` (if it exists), `git mv docs/build-brief-v2.md docs/build-brief.md`; if docs/reference/ui-reference.html exists, `git mv` it to docs/planning/ui-reference-v1.1.html; then `git mv docs/reference/ui-reference-v2.html docs/reference/ui-reference.html`. Fix references to the old paths. Commit "Adopt build brief v2 and UI reference v2.1".
3. Update CLAUDE.md (max 100 lines) to the v2 rules: brief §4 invariants, §6.3 review-status rule, §7 validation, §8 pure scoring tested against the fixtures, §10.1 copy-the-CSS rule, §14 never-do list, and "clinical content lives only in content/case-bank.v2.json and only the student edits clinical wording, answers and reviewStatus". Remove rules v2 replaces and log each removal in docs/evidence-log.md. Write docs/adr/0006-v2-teaching-upgrade.md: context; options (keep v1 / v2 with runtime AI / v2 with rule-based feedback); decision; consequences — facts only, and leave an empty "Student's judgement" heading. Commit.
4. Only if the engine in §4 does not work yet: build it now with v2's submission shape, in coherent commits with real-HTTP tests, before step 5.
5. Spec first: write T04, T06, T07, T08, T11 and T12 against modules that don't exist yet (bank loader/validator, submission validator, scoring and summary module, debrief composer). Run them and save the full failing output to docs/process/spec-first-run-v2.txt. Then implement those modules — no UI changes — until they pass. Never commit red: commit tests together with the code that makes them pass. `pnpm check` green before every commit.
6. If the bank fails validation, do not edit clinical content: list each failure.

Stop and report briefly: 5-line summary of the map; conflicts and how you resolved them; commit hashes; test counts before and after; bank validation failures (if any).
```

**你检查（5 分钟）**
- [ ] `docs/process/v2-implementation-map.md` 存在，冲突一栏不是空的就要有处理办法
- [ ] `docs/build-brief.md` 现在是 v2（第一行是 “Build Brief v2”）
- [ ] `docs/process/spec-first-run-v2.txt` 存在，里面是失败记录
- [ ] 汇报里 T06、T07 通过（说明计分规则和我的金标准一致）
- [ ] `git status` 干净；`mise.local.toml` 没被提交

---

## Round B：数据迁移和教学流程

```
Round B of E — data and teaching flow. Re-read docs/build-brief.md §5–§7, §9 and §10, and docs/reference/ui-reference.html.

1. Incremental migration — never drop or recreate tables: tables.stage, bank_major_version, bank_version; rounds.phase, full frozen case snapshot (§6.1) and case_version; submissions.action and evidence_id (nullable for old rows). Old rows stay readable and show "Not collected in this version".
2. Stages and rounds as in §5; POST /next accepts fromRoundId or fromStage and advances exactly once under concurrency.
3. Submission API v2 (§7) through the single allowlist serializer; public vs secret projection (§6.2). Write T01, T02, T03, T05, T09 and T10 over real HTTP with two cookies and a temporary database.
4. Screens using the reference's class names and copy now (the stylesheet itself comes in Round D): start, waiting (invite link, Lee's prebrief, Before you start), checking (patient strip, order and prepared records side by side, part 1 compare, part 2 decide, toolbox), signed, debrief (composer output, evidence highlights via data-evidence). SSE updates must not steal focus or clear unsent choices.
5. Existing engine tests still pass. Every mistake a test or review catches that shows a missing rule: fix it, add a regression test or a CLAUDE.md line, and log one line in docs/evidence-log.md.

Stop and report: hashes; test count; which acceptance IDs (T01–T17) pass; screens still missing.
```

**你检查（15 分钟，两个 Chrome 普通 profile）**
- [ ] A 建桌 → B 用邀请链接，只出现 Join，点了才加入；A 不刷新就看到 B
- [ ] Case 1 的病人、腕带、药单、备药都显示出来；医嘱和备药左右并排
- [ ] 五个字段都选 Matches，再选 “Stop and re-prepare” 可以提交；把一个字段选 Doesn't match 再选 “Continue…” 会被拒绝，提示文字不透露答案
- [ ] A 提交后，B 只看到 “Signed”，看不到 A 的选择
- [ ] 两人都提交后同时出现复盘：对比表、四块文字、讨论题、来源和 Draft 标记
- [ ] 刷新页面后，已提交的答案还在

---

## Round C：总结、迁移题、结束回顾、页面和评估工具

```
Round C of E — summaries, transfer, end review, pages, evidence tooling. Re-read docs/build-brief.md §5, §8, §9 and §11.

1. training_summary and transfer stages: summary screen, transfer-intro banner, transfer rounds 7–9, end review with the earlier-practice table (§8.4) and print CSS. T07, T08 and T09 must also pass end-to-end over HTTP.
2. GET /api/me/history (owner only; extend T03).
3. /guide/: write docs/guide.md from brief §1 and §5 and the bank — goals, who it is for, a 20–25 minute plan, two-browser set-up, keeping independence until both have signed (sit apart or back to back), how to read the summary, the three new situations, not using results for competence decisions, content version and the real review status, and "Contact: TODO (student)". Facts only; I will edit it. Render it server-side. /sources/: the §11 copy plus the bank's sources grouped by `group`, showing "Not yet verified" for any source whose verification starts with "TO VERIFY". T15.
4. POST /api/tables/:id/log and `pnpm export:evaluation` (§9, T16). `pnpm content:review-pack` regenerates docs/content/review-pack.md; regenerate it and report whether it differs from the committed file.
5. T17: no outbound network calls while scoring or summarising.

Stop and report: hashes; tests; acceptance IDs passing; every place where a §11 sentence and the actual behaviour differ.
```

**你检查（15 分钟）**
- [ ] 两人走完 6 题 → 训练总结：分数是 “3 of 4” 这种分数，不是百分比；没出现的类别写 “No opportunity this time”
- [ ] 故意两人在 C6 都漏掉剂量：总结里 “Both missed” 有这一项，并写着 “Agreeing isn't the same as being right”
- [ ] 点 “Start the new situations” → 3 道新题 → 结束回顾；训练和迁移分开显示；能打印
- [ ] `/guide/` 和 `/sources/` 能打开，来源旁边有 “Not yet verified”
- [ ] 本机运行 `pnpm export:evaluation` 生成 CSV，里面没有 cookie 或 token

---

## Round D：视觉、无障碍、部署和证据

```
Round D of E — visual contract, accessibility, deploy, evidence.

1. Copy <style id="app-css"> from docs/reference/ui-reference.html verbatim into the app stylesheet, replacing the v1 styles. Apply the reference markup, class names and copy to all nine states. Sprites: copy the MAPS/BASE/sprite() code; patient colours come from the case's patient.sprite. Logo and favicon from the reference. Do not copy the mock-only style or the state switcher.
2. If a headless browser is available (try `pnpm dlx playwright install chromium`), screenshot every state at 1920×1080 and 390×844 into docs/evidence/screens-v2/ and compare with docs/reference/shots/; fix differences and report what remains. If you cannot run a browser, say so.
3. Accessibility pass: keyboard-only through one case; visible focus; polite live region; option targets at least 44px tall; no meaning by colour alone. Record what you checked in docs/evidence/a11y-v2.txt — do not write "WCAG compliant".
4. Audit every §11 sentence against actual behaviour; fix the code, or tell me which sentence must change.
5. `pnpm check` and `pnpm check:evidence` green. Deploy with the brief §3 command (every flyctl command through `mise exec --`; never open or print mise.local.toml). Run the deployed latency smoke test → docs/evidence/latency-v2.txt. Create a table with the smoke script's cookies and complete two rounds; restart the machine and fetch; redeploy and fetch; confirm table, rounds and submissions are unchanged → docs/evidence/persistence-v2.txt (no secrets).
6. Commit coherent steps. Do not write README or PROCESS content. Do not run /ship.

Stop and report: hashes; both check outputs; latency median and max; persistence before/after; screenshot differences left; the list of human checks I must do myself.
```

**你检查（20 分钟，线上网址，两个 profile；B 窗口开设备模式 390×844）**
- [ ] 和参考稿同宽对比：颜色、间距、字体、两张记录并排（宽屏）/上下排（手机），手机无横向滚动
- [ ] 带教 Lee 和病人的像素头像出现；每题病人头发/病号服颜色不同
- [ ] 只用键盘（Tab、空格、回车）完成一题，焦点框看得见
- [ ] B 的 DevTools → Network 选 Slow 3G 提交：按钮显示等待、不会重复提交、最后两边一致
- [ ] `docs/evidence/persistence-v2.txt` 写明重启和重新部署后数据没变
- [ ] 第二天打开 My tables，昨天的桌子和复盘都还在

---

## 验证窗口（你，3–5 天，Sonnet 不参与）

1. 收审阅意见 → 你直接改 `content/case-bank.v2.json` 的临床文字；**审阅状态只按实际完成的情况改**（例如 `source_checked` 需要你逐条核对过来源；`educator_reviewed` 要填 reviewerRole 和 reviewedAt）。
2. 写 `docs/validation/plan.md`（通过标准，照抄基准方案第 4 节并调整），**在第一场试玩前 commit**。
3. 每场：先做纸质前测 3 题 → 两人分开坐玩完 → 5 分钟访谈。记 `docs/validation/sessions.md`（编号、背景、时长、签名前是否交谈、卡点、原话）。
4. 结束后跑 `pnpm export:evaluation`，写 `docs/validation/findings.md`：每条标准“达到 / 未达到 / 部分”，加一个 “Fix list”（只写界面和流程问题；内容问题你自己改 JSON）。
5. `docs/validation/content-review.md`：审阅者角色（不写名字）、每题评分、你做了哪些改动。

---

## Round E：按验证结果修改、README 呈现、ship

先写好 README.md 和 PROCESS.md（可以先发给我审）。

```
Round E of E — after validation. I have edited content/case-bank.v2.json after review (statuses set by me), written docs/validation/plan.md, sessions.md, findings.md and content-review.md, and written README.md and PROCESS.md. Do not change their wording or any clinical text.

1. Run bank validation and the full test suite. If my edits broke validation, tell me exactly which field and why; don't fix clinical content yourself.
2. Regenerate docs/content/review-pack.md. Apply each item under "Fix list" in docs/validation/findings.md: one commit each, with a regression test where testable and a docs/evidence-log.md line.
3. /readme/ renders README.md in full with its headings in the server HTML. Report word counts (README target 400–600, PROCESS 900–1100); do not edit to fit.
4. Write docs/claims.md: map every claim README makes to "enforced: <acceptance ID>" or "judged/validated: <evidence file>", plus the CLAUDE.md rule. List claims with neither; do not edit README.
5. Check every commit hash, file path and URL in README.md and PROCESS.md resolves; fix URLs only.
6. `pnpm check` and `pnpm check:evidence` pass. Commit, deploy, then run the course /ship skill.

Report: hashes; both check outputs; word counts; unmapped claims; live status of /, /readme/, /guide/, /sources/; CI result after ship.
```

**你检查**
- [ ] `docs/claims.md` 没有未对应的主张（有的话：改 README 措辞，或让它补测试）
- [ ] 线上 `/readme/` 是完整 README；`/sources/` 的审阅状态和你实际做的一致
- [ ] GitHub Actions 绿；ship 后两个 profile 从头快速玩一题

---

## 卡住时直接回 Sonnet 的话

| 情况 | 回复 |
|---|---|
| 问了 brief 里写明的事 | `Follow docs/build-brief.md; make the call, note it in your report, and continue.` |
| 想改测试或金标准让它通过 | `Stop. Do not change the test or docs/content/scoring-fixtures.json. Tell me which test, what it expects, what you get and why you think the expectation is wrong.` |
| 改了临床文字或审阅状态 | `Revert that. Clinical wording, answers and reviewStatus are mine (brief §6.3, §14). List the problem instead. Log it in docs/evidence-log.md.` |
| 加了范围外功能 | `Revert that change; it is out of scope per brief §2. Log it in docs/evidence-log.md.` |
| 界面和参考稿不一样 | `Compare your screen with docs/reference/shots/<state>-<viewport>.png. Use the reference's classes and copy exactly; list each difference you fix.` |
| 会话太长开始忘事 | 新开会话，粘启动语，再加 `Continue Round <X> from step <N>.` |
| pnpm install / better-sqlite3 报错 | `Follow the repo's existing native-dependency setup (pnpm build approval for better-sqlite3). If it still fails, show me the last 30 lines of the error and stop.` |

还不行就把三样东西发给我：哪一轮、Sonnet 的汇报原文、哪条 ✗。
