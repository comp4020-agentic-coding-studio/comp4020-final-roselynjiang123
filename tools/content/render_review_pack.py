#!/usr/bin/env python3
"""Renders the reviewer pack (markdown) from content/case-bank.v2.json."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parents[2]
b = json.loads((root / "content" / "case-bank.v2.json").read_text())
src = {s["id"]: s for s in b["sources"]}
act = {a["id"]: a["label"] for a in b["actions"]}
ev = {e["id"]: e["label"] for e in b["evidenceOptions"]}
fl = {k: v["label"] for k, v in b["fields"].items()}
L = []
w = L.append
w(f"# Second Pair of Eyes — content review pack ({b['bankVersion']})\n")
w("Generated from `content/case-bank.v2.json`. Edit the JSON, not this file, then regenerate.\n")
w(f"> {b['notice']}\n")
w("## For reviewers\n")
w("Setting: " + b["setting"]["description"] + ". " + b["setting"]["pairNote"] + "\n")
w("Learners first compare the order with the prepared medicine on five checks (match / does not match), then choose a next step and the single piece of evidence that decided it.\n")
w("Please fill in, for every case:\n")
w("1. Clinically accurate? Accurate / Needs change / Inaccurate (explain)\n2. Realistic for an Australian adult ward? 1–4\n3. Can the reference answer be worked out from what is on the page? Yes / No / Depends\n4. Is the feedback accurate and useful for first-year students? Yes / Needs change\n5. Anything a first-year might misunderstand?\n")
w("At the end: Would you use this with first-years? How? What is missing? Your role (e.g. RN, clinical facilitator, pharmacist) — no name needed.\n")
w("## Learning objectives\n")
for lo in b["learningObjectives"]: w(f"- **{lo['id']}** {lo['text']}")
w("\n## The five checks, next steps and evidence options\n")
for k in b["fieldKeys"]: w(f"- **{fl[k]}** — {b['fields'][k]['question']}")
w(f"\n_{b['fieldNote']}_\n")
w("Next steps: " + "; ".join(f"**{a['label']}** ({a['help']})" for a in b["actions"]) + "\n")
w("Evidence options (the same list in every case): " + "; ".join(e["label"] for e in b["evidenceOptions"]) + "\n")
w("## Before-you-start card\n")
for s in b["knowledgeCard"]["sections"]: w(f"- **{s['heading']}**: {s['body']}")
w("\n## Medicine cards\n")
for m in b["medicineCards"]:
    w(f"### {m['name']}  `{m['id']}` · {m['reviewStatus']}")
    w(f"- What it is: {m['whatItIs']}\n- What to watch: {m['whatToWatch']}")
    if m["category"]: w(f"- Category: {m['category']}")
    w("- Sources: " + ", ".join(f"{s} ({src[s]['title']})" for s in m["sourceIds"]))
    for q in m["openQuestions"]: w(f"- ⚠ {q}")
    w("")
for c in b["cases"]:
    p, ch, pr, fb = c["patient"], c["chart"], c["prepared"], c["feedback"]
    o = ch["order"]
    w(f"## {c['caseId']} · {c['title']}  ({c['phase']}, v{c['caseVersion']}, {c['reviewStatus']})\n")
    w(f"Ward time {c['simulationDateTime'].replace('T',' ')} · LOs {', '.join(c['learningObjectiveIds'])} · tag `{c['decisionTag']}`" + (f" · {c['secondCheckNote']}" if c["secondCheckNote"] else "") + "\n")
    w(f"**Patient** {p['familyName']}, {p['givenName']} · {p['sex']} · {p['age']} · DOB {p['dob']} · MRN {p['mrn']} · Bed {p['bed']} · {p['band']} band  ")
    w(f"{p['reason']}  ")
    w(f"Says: “{p['quote']}”\n")
    w(f"**Chart** Allergies: {ch['allergies']['text']} ({ch['allergies']['checkedBy']})  ")
    times = (" · times " + ", ".join(o["times"])) if o["times"] else ""
    mx = (f" · max PRN/24 h {o['prnMax24h']}") if o["prnMax24h"] else ""
    w(f"Order ({o['type']}): {o['medicine']} · {o['route']} · {o['dose']} · {o['frequency']}{times}{mx} · {o['indication']} · {o['prescriber']} · from {o['startDate']}  ")
    if ch["administrationRecord"]:
        w("Administration record: " + "; ".join(f"{r['date']} {r['time']} {r['dose']} {r['route']} {r['givenBy']}" + (f"/{r['witness']}" if r['witness'] else "") for r in ch["administrationRecord"]) + "\n")
    else:
        w("Administration record: none\n")
    pp = pr["product"]
    w(f"**Prepared** {pp['name']} {pp['strength']} {pp['form']}" + (f" ({pp['schedule']})" if pp.get('schedule') else "") + f" · {pr['quantity']} · {pr['device']} · for {pr['preparedFor']['name']}, DOB {pr['preparedFor']['dob']}, MRN {pr['preparedFor']['mrn']}, Bed {pr['preparedFor']['bed']} · {pr['forTime']}\n")
    ak = c["answerKey"]
    w("**Reference answer** " + ", ".join(f"{fl[k]}: {v}" for k, v in ak["fields"].items()) + "  ")
    w("Accepted next step + evidence: " + " OR ".join(f"{act[x['action']]} + {ev[x['evidenceId']]}" for x in ak["acceptedPairs"]) + "\n")
    w(f"**Debrief** \n- Finding: {fb['finding']}\n- Evidence: {fb['evidence']}\n- Why it matters: {fb['why']}\n- Next step: {fb['nextStep']}\n- Discussion: {fb['discussion']}")
    if fb["realWorld"]: w(f"- Real world: {fb['realWorld']}")
    w("\n**Claims and sources**")
    for cl in c["claims"]:
        w(f"- {cl['text']} — " + ", ".join(f"{s} ({src[s]['org']}; {src[s]['verification']})" for s in cl["sourceIds"]))
    for q in c["openQuestions"]: w(f"- ⚠ {q}")
    w("\n**Reviewer:** accurate ☐ needs change ☐ inaccurate ☐ · realism 1 2 3 4 · answer derivable Y / N / depends · feedback OK ☐ needs change ☐  \nComments:\n\n---\n")
w("## Sources\n")
for s in b["sources"]:
    w(f"- **{s['id']}** {s['org']}. {s['title']}. {s['url']} — supports: {s['supports']}. Limits: {s['limits'] or '—'}. [{s['verification']}]")
(root / "docs" / "content" / "review-pack.md").write_text("\n".join(L) + "\n")
print("ok", len(L), "lines")
