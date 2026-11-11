#!/usr/bin/env python3
"""Reference implementation of the v2 scoring/summary rules, used only to produce
docs/content/scoring-fixtures.json (golden examples for spec tests) and the mockup numbers.
The app must implement the rules from docs/build-brief.md; this file is not shipped."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parents[2]
bank = json.loads((root / "content" / "case-bank.v2.json").read_text())
CASES = {c["caseId"]: c for c in bank["cases"]}
FK = bank["fieldKeys"]
TAG_OF_FIELD = {k: t["id"] for t in bank["capabilityTags"] for k in t["fieldKeys"]}
TAG_ORDER = bank["capabilityTagOrder"]

def outcome(actual, given):
    if actual == "mismatch": return "TP" if given == "mismatch" else "FN"
    return "FP" if given == "mismatch" else "TN"

def score_seat(case, sub):
    ak = case["answerKey"]
    fields = {k: {"given": sub["fields"][k], "actual": ak["fields"][k], "outcome": outcome(ak["fields"][k], sub["fields"][k])} for k in FK}
    pairs = ak["acceptedPairs"]
    accepted = any(p["action"] == sub["action"] and p["evidenceId"] == sub["evidenceId"] for p in pairs)
    action_ok = any(p["action"] == sub["action"] for p in pairs)
    evidence_ok = any(p["evidenceId"] == sub["evidenceId"] for p in pairs)
    fields_ok = all(f["outcome"] in ("TP", "TN") for f in fields.values())
    return {"fields": fields, "decision": {"action": sub["action"], "evidenceId": sub["evidenceId"], "accepted": accepted, "actionOk": action_ok, "evidenceOk": evidence_ok},
            "fullyCorrect": fields_ok and accepted}

def round_result(case_id, subA, subB):
    case = CASES[case_id]
    a, b = score_seat(case, subA), score_seat(case, subB)
    coverage = {}
    for k in FK:
        if case["answerKey"]["fields"][k] == "mismatch":
            fa, fb = a["fields"][k]["outcome"] == "TP", b["fields"][k]["outcome"] == "TP"
            coverage[k] = "both" if fa and fb else "onlyA" if fa else "onlyB" if fb else "neither"
    identical = subA["fields"] == subB["fields"] and subA["action"] == subB["action"] and subA["evidenceId"] == subB["evidenceId"]
    field_agree = sum(subA["fields"][k] == subB["fields"][k] for k in FK)
    return {"caseId": case_id, "A": a, "B": b,
            "pair": {"coverage": coverage,
                     "sharedMisses": [k for k, v in coverage.items() if v == "neither"],
                     "complementary": [k for k, v in coverage.items() if v in ("onlyA", "onlyB")],
                     "identical": identical,
                     "identicalButNotReference": identical and not a["fullyCorrect"],
                     "fieldAgreement": [field_agree, len(FK)],
                     "decisionBothAccepted": a["decision"]["accepted"] and b["decision"]["accepted"],
                     "decisionNeitherAccepted": (not a["decision"]["accepted"]) and (not b["decision"]["accepted"]),
                     "decisionCoverage": ("both" if a["decision"]["accepted"] and b["decision"]["accepted"] else "onlyA" if a["decision"]["accepted"] else "onlyB" if b["decision"]["accepted"] else "neither")}}

def session_summary(results, seat, phase):
    rs = [r for r in results if CASES[r["caseId"]]["phase"] == phase]
    tp = fn = fp = tn = 0
    per_field = {k: {"TP": 0, "FN": 0, "FP": 0, "TN": 0} for k in FK}
    dec = {"accepted": 0, "actionOk": 0, "evidenceOk": 0, "opportunities": 0}
    tag_cases, tag_errors = {}, {}
    fully = 0
    for r in rs:
        s = r[seat]; c = CASES[r["caseId"]]
        for k in FK:
            o = s["fields"][k]["outcome"]; per_field[k][o] += 1
            if o in ("FN", "FP"):
                t = TAG_OF_FIELD[k]; tag_cases.setdefault(t, set()).add(r["caseId"]); tag_errors[t] = tag_errors.get(t, 0) + 1
        d = s["decision"]; dec["opportunities"] += 1
        for key in ("accepted", "actionOk", "evidenceOk"): dec[key] += 1 if d[key] else 0
        if not d["accepted"]:
            t = c["decisionTag"]; tag_cases.setdefault(t, set()).add(r["caseId"]); tag_errors[t] = tag_errors.get(t, 0) + 1
        fully += 1 if s["fullyCorrect"] else 0
    for k in FK:
        for o in ("TP", "FN", "FP", "TN"): pass
    tp = sum(v["TP"] for v in per_field.values()); fn = sum(v["FN"] for v in per_field.values())
    fp = sum(v["FP"] for v in per_field.values()); tn = sum(v["TN"] for v in per_field.values())
    ranked = sorted(tag_cases, key=lambda t: (-len(tag_cases[t]), -tag_errors[t], TAG_ORDER.index(t)))[:3]
    suggestions = [{"tag": t, "kind": "multi" if len(tag_cases[t]) >= 2 else "one", "distinctCases": sorted(tag_cases[t]), "errors": tag_errors[t]} for t in ranked]
    pair_shared = sum(len(r["pair"]["sharedMisses"]) for r in rs)
    pair_comp = sum(len(r["pair"]["complementary"]) for r in rs)
    union_found = sum(sum(1 for v in r["pair"]["coverage"].values() if v != "neither") for r in rs)
    agree = sum(r["pair"]["fieldAgreement"][0] for r in rs); agree_den = sum(r["pair"]["fieldAgreement"][1] for r in rs)
    return {"phase": phase, "casesCounted": len(rs),
            "mismatchesFound": [tp, tp + fn], "matchingMarkedMismatch": [fp, fp + tn],
            "perField": {k: {"found": [v["TP"], v["TP"] + v["FN"]], "falseMarks": [v["FP"], v["FP"] + v["TN"]]} for k, v in per_field.items()},
            "decisions": {"accepted": [dec["accepted"], dec["opportunities"]], "actionOnly": [dec["actionOk"], dec["opportunities"]], "evidenceOnly": [dec["evidenceOk"], dec["opportunities"]]},
            "fullyCorrectCases": [fully, len(rs)], "suggestions": suggestions if tag_cases else [{"tag": None, "kind": "none"}],
            "pair": {"foundTogether": [union_found, tp + fn], "sharedMisses": pair_shared, "complementary": pair_comp, "fieldAgreement": [agree, agree_den],
                     "decisions": {k: [r["caseId"] for r in rs if r["pair"]["decisionCoverage"] == k] for k in ("both", "onlyA", "onlyB", "neither")}}}

M = "match"; X = "mismatch"
def sub(p=M, m=M, d=M, r=M, t=M, action="continue_checks", ev="all_fields_match"):
    return {"fields": {"patient": p, "medicine": m, "dose": d, "route": r, "time": t}, "action": action, "evidenceId": ev}

# Mock session used by the UI reference (Checker A, Checker B = "You")
mock = {
 "C1": (sub(action="continue_checks", ev="total_amount"), sub(d=X, action="reprepare", ev="total_amount")),
 "C2": (sub(p=X, action="pause_clarify", ev="identifiers"), sub(p=X, action="reprepare", ev="identifiers")),
 "C3": (sub(d=X, action="reprepare", ev="total_amount"), sub(d=X, action="reprepare", ev="total_amount")),
 "C4": (sub(action="pause_clarify", ev="admin_record"), sub(action="continue_checks", ev="all_fields_match")),
 "C5": (sub(action="continue_checks", ev="all_fields_match"), sub(action="pause_clarify", ev="allergy_record")),
 "C6": (sub(r=X, action="reprepare", ev="route_form"), sub(r=X, action="reprepare", ev="route_form")),
 "T1": (sub(d=X, action="reprepare", ev="total_amount"), sub(d=X, action="reprepare", ev="total_amount")),
 "T2": (sub(action="continue_checks", ev="admin_record"), sub(action="pause_clarify", ev="admin_record")),
 "T3": (sub(action="pause_clarify", ev="allergy_record"), sub(action="pause_clarify", ev="allergy_record")),
}
results = [round_result(cid, a, b) for cid, (a, b) in mock.items()]

fixtures = {
 "_note": "Golden examples for spec tests. Inputs are deliberate test answers, never live player data. Generated by tools/reference_scoring.py from content/case-bank.v2.json.",
 "rules": {
   "outcome": "actual mismatch & given mismatch = TP; actual mismatch & given match = FN; actual match & given mismatch = FP; actual match & given match = TN",
   "accepted": "decision accepted iff (action, evidenceId) equals one acceptedPairs entry",
   "fullyCorrect": "all five fields TP/TN and decision accepted",
   "identical": "five fields, action and evidenceId all equal",
   "ratios": "always computed from summed counts; never average per-case percentages; denominator 0 => 'no opportunity this time'"
 },
 "examples": {
   "C6_partialFind_vs_fullFind": round_result("C6", sub(r=X, action="reprepare", ev="route_form"), sub(d=X, r=X, action="reprepare", ev="total_amount")),
   "C6_sharedMiss_agreed": round_result("C6", sub(r=X, action="reprepare", ev="route_form"), sub(r=X, action="reprepare", ev="route_form")),
   "C4_recordsMatch_decisionSplit": round_result("C4", sub(action="pause_clarify", ev="admin_record"), sub(action="continue_checks", ev="all_fields_match")),
   "C5_bothAccepted": round_result("C5", sub(action="pause_clarify", ev="allergy_record"), sub(action="pause_clarify", ev="allergy_record")),
   "C1_falseMismatch": round_result("C1", sub(), sub(d=X, action="reprepare", ev="total_amount")),
 },
 "mockSession": {"answers": {cid: {"A": a, "B": b} for cid, (a, b) in mock.items()},
                 "trainingSummary": {"A": session_summary(results, "A", "training"), "B": session_summary(results, "B", "training")},
                 "transferSummary": {"A": session_summary(results, "A", "transfer"), "B": session_summary(results, "B", "transfer")},
                 "incompleteExample": {"note": "Only C1–C4 revealed: summary counts 4 cases and is labelled '4 of 6 cases completed'; the table is not listed as a completed practice.",
                                       "B": session_summary(results[:4], "B", "training")}}
}
(root / "docs" / "content" / "scoring-fixtures.json").write_text(json.dumps(fixtures, indent=2) + "\n")
tb = fixtures["mockSession"]["trainingSummary"]
for s in ("A", "B"):
    x = tb[s]; print(s, "found", x["mismatchesFound"], "false", x["matchingMarkedMismatch"], "dec", x["decisions"], "fully", x["fullyCorrectCases"], "sugg", [(g["tag"], g["kind"], g["distinctCases"]) for g in x["suggestions"]])
print("pair", tb["B"]["pair"])
for s in ("A", "B"):
    x = fixtures["mockSession"]["transferSummary"][s]; print("transfer", s, x["decisions"], x["mismatchesFound"], x["matchingMarkedMismatch"])
print("incomplete", fixtures["mockSession"]["incompleteExample"]["B"]["casesCounted"], fixtures["mockSession"]["incompleteExample"]["B"]["mismatchesFound"])
