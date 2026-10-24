#!/usr/bin/env python3
"""Validate wave-3 records.json and its agreement with the markdown documents.

Run from the repository root: python3 -I context/plan/overlap/wave-3/data/check_records.py
Standard library only. Exit code 1 on any failure.
"""
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
WAVE3 = HERE.parent
DATA = HERE / "records.json"

AREA_DOCS = {
    "session-and-mixing": "session-and-mixing.md",
    "clips-and-arrangement": "clips-and-arrangement.md",
    "devices-and-parameters": "devices-and-parameters.md",
    "modulation-and-presets": "modulation-and-presets.md",
    "grid-and-internal-access": "grid-and-internal-access.md",
    "media-and-analysis": "media-and-analysis.md",
    "delivery": "delivery.md",
}
CLAIM_STATUSES = {"Product", "Component", "Research"}
ID_RE = re.compile(r"\b(SM|CA|DP|MP|GI|MA|DL)-(\d+)\b")


def main():
    errors = []
    data = json.loads(DATA.read_text())
    verbs = set(data["verbs"])
    statuses = set(data["statuses"])
    levels = set(data["proofLevels"])
    drivers = set(data["effortDrivers"])
    areas = set(AREA_DOCS) | {"cross-cutting"}

    rows = {}
    for r in data["rows"]:
        if r["key"] in rows:
            errors.append(f"duplicate row key {r['key']}")
        rows[r["key"]] = r
        if r["area"] not in areas:
            errors.append(f"row {r['key']}: unknown area {r['area']}")

    cells = {}
    for c in data["cells"]:
        key = (c["row"], c["verb"])
        if key in cells:
            errors.append(f"duplicate cell {key}")
        cells[key] = c
        if c["row"] not in rows:
            errors.append(f"cell {key}: unknown row")
        if c["verb"] not in verbs:
            errors.append(f"cell {key}: unknown verb")
        if c["status"] not in statuses:
            errors.append(f"cell {key}: unknown status {c['status']}")
        check_proof(c.get("proof"), f"cell {key}", levels, errors)
        if c["status"] in CLAIM_STATUSES:
            for field in ("path", "predicate", "counterexample"):
                if not c.get(field):
                    errors.append(f"cell {key}: claim without {field}")

    records = {}
    for w in data["workRecords"]:
        if w["id"] in records:
            errors.append(f"duplicate record id {w['id']}")
        records[w["id"]] = w
    for w in data["workRecords"]:
        tag = f"record {w['id']}"
        if w["status"] not in statuses:
            errors.append(f"{tag}: unknown status {w['status']}")
        if w["kind"] not in ("capability", "delivery"):
            errors.append(f"{tag}: unknown kind {w['kind']}")
        if w["area"] not in areas:
            errors.append(f"{tag}: unknown area {w['area']}")
        if w["effortDriver"] not in drivers:
            errors.append(f"{tag}: unknown effort driver {w['effortDriver']}")
        check_proof(w.get("proof"), tag, levels, errors)
        if w["kind"] == "capability" and not w["cells"]:
            errors.append(f"{tag}: capability record without cells")
        if w["kind"] == "delivery" and w["cells"]:
            errors.append(f"{tag}: delivery record with cells")
        for ref in w["cells"]:
            key = (ref["row"], ref["verb"])
            cell = cells.get(key)
            if cell is None:
                errors.append(f"{tag}: cell reference {key} does not resolve")
            elif cell["status"] != w["status"]:
                errors.append(f"{tag}: cell {key} has status {cell['status']}, record has {w['status']}")
        for field in ("prerequisites", "enabling"):
            for other in w[field]:
                if other not in records:
                    errors.append(f"{tag}: {field} id {other} does not resolve")
                if other == w["id"]:
                    errors.append(f"{tag}: {field} names itself")

    # External cells: one per project, row, and verb; the matrix rule applies to every one.
    projects = set(data.get("projects", {}))
    external = {}
    for e in data.get("externalCells", []):
        key = (e["project"], e["row"], e["verb"])
        tag = f"external {key}"
        if key in external:
            errors.append(f"duplicate external cell {key}")
        external[key] = e
        if e["project"] not in projects:
            errors.append(f"{tag}: unknown project")
        if e["row"] not in rows:
            errors.append(f"{tag}: unknown row")
        if e["verb"] not in verbs:
            errors.append(f"{tag}: unknown verb")
        if "status" in e:
            errors.append(f"{tag}: external cells carry no Ghostnote status")
        proof = e.get("proof") or {}
        if proof.get("level") not in levels:
            errors.append(f"{tag}: unknown proof level {proof.get('level')}")
        if proof.get("level") == "Live" and not proof.get("build"):
            errors.append(f"{tag}: Live proof without build")
        if proof.get("level") != "Live" and proof.get("build"):
            errors.append(f"{tag}: non-Live proof with build")
        for field in ("path", "predicate", "counterexample", "evidenceNote"):
            if not e.get(field):
                errors.append(f"{tag}: missing {field}")
        if proof.get("level") == "Not found" and not e.get("evidenceNote"):
            errors.append(f"{tag}: Not found without an evidence note")

    # The register names every external cell exactly as `project` / `row` / verb, and no others.
    register = (WAVE3 / "external-register.md").read_text()
    named = set(re.findall(r"^\| `([^`]+)` \| `([^`]+)` \| ([a-z-]+) \|", register, re.M))
    for key in external:
        if key not in named:
            errors.append(f"external-register.md: cell {key} is missing from the detail tables")
    for key in named:
        if key not in external:
            errors.append(f"external-register.md: names cell {key}, which the JSON lacks")

    # Markdown agreement: each area document names its records with their statuses.
    for area, name in AREA_DOCS.items():
        text = (WAVE3 / name).read_text()
        expected = {w["id"]: w["status"] for w in data["workRecords"] if w["area"] == area}
        found = set(m.group(0) for m in ID_RE.finditer(text))
        for rid, status in expected.items():
            if rid not in found:
                errors.append(f"{name}: record {rid} is missing")
                continue
            pattern = re.compile(r"^\|\s*" + re.escape(rid) + r"\s*\|[^\n]*?\|\s*" + re.escape(status) + r"\s*\|", re.M)
            if not pattern.search(text):
                errors.append(f"{name}: record {rid} row does not show status {status}")
        for rid in found:
            if rid not in records:
                errors.append(f"{name}: names {rid}, which the JSON lacks")

    # Every record ID named anywhere in wave-3 must exist.
    for md in WAVE3.glob("*.md"):
        for m in ID_RE.finditer(md.read_text()):
            if m.group(0) not in records:
                errors.append(f"{md.name}: names {m.group(0)}, which the JSON lacks")

    counts = {
        "rows": len(rows),
        "cells": len(cells),
        "workRecords": len(records),
        "externalCells": len(external),
        "externalByProject": {p: sum(1 for e in external.values() if e["project"] == p) for p in sorted(projects)},
        "byStatus": {s: sum(1 for w in records.values() if w["status"] == s) for s in sorted(statuses)},
        "byArea": {a: sum(1 for w in records.values() if w["area"] == a) for a in sorted(AREA_DOCS)},
    }
    print(json.dumps(counts, indent=2))
    if errors:
        print(f"{len(errors)} error(s):")
        for e in errors:
            print(" -", e)
        sys.exit(1)
    print("ok")


def check_proof(proof, tag, levels, errors):
    if not isinstance(proof, dict):
        errors.append(f"{tag}: missing proof")
        return
    level = proof.get("level")
    if level not in levels:
        errors.append(f"{tag}: unknown proof level {level}")
    build = proof.get("build")
    if level == "Live" and not build:
        errors.append(f"{tag}: Live proof without build")
    if level != "Live" and build:
        errors.append(f"{tag}: non-Live proof with build {build}")
    if not isinstance(proof.get("evidence"), list):
        errors.append(f"{tag}: proof.evidence must be a list")


if __name__ == "__main__":
    main()
