#!/usr/bin/env python3
"""Print markdown tables from records.json for the wave-3 documents.

Usage, from the repository root:
  python3 -I context/plan/overlap/wave-3/data/render_tables.py product
  python3 -I context/plan/overlap/wave-3/data/render_tables.py claims
  python3 -I context/plan/overlap/wave-3/data/render_tables.py area <area-name>
  python3 -I context/plan/overlap/wave-3/data/render_tables.py dependencies
  python3 -I context/plan/overlap/wave-3/data/render_tables.py matrix
  python3 -I context/plan/overlap/wave-3/data/render_tables.py external-matrix
  python3 -I context/plan/overlap/wave-3/data/render_tables.py external <area-name|cross-cutting>
Standard library only. The output is pasted into the documents by hand.
"""
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
DATA = json.loads((HERE / "records.json").read_text())
VERBS = list(DATA["verbs"])
CLAIM = {"Product", "Component", "Research"}


def esc(text):
    return str(text).replace("|", "\\|")


def proof_text(proof):
    level = proof["level"]
    if level == "Live":
        return f"Live {proof['build']}"
    return level


def cell_text(cell):
    if cell is None:
        return ""
    return f"{cell['status']}; {proof_text(cell['proof'])}"


def matrix(rows_filter):
    cells = {(c["row"], c["verb"]): c for c in DATA["cells"]}
    out = ["| Row | " + " | ".join(VERBS) + " |", "|---|" + "---|" * len(VERBS)]
    for r in DATA["rows"]:
        if not rows_filter(r, cells):
            continue
        label = f"`{r['key']}` {esc(r['object'])}: {esc(r['aspect'])}"
        out.append("| " + label + " | " + " | ".join(cell_text(cells.get((r["key"], v))) for v in VERBS) + " |")
    return "\n".join(out)


def product():
    def has_claim(r, cells):
        return any(cells.get((r["key"], v), {}).get("status") in CLAIM for v in VERBS)
    return matrix(has_claim)


def full_matrix():
    return matrix(lambda r, cells: any((r["key"], v) in cells for v in VERBS))


def claims():
    out = ["| Row | Verb | Path | Predicate | Counterexample |", "|---|---|---|---|---|"]
    for c in DATA["cells"]:
        if c["status"] not in CLAIM:
            continue
        ev = ", ".join(e for e in c["proof"]["evidence"] if e.startswith("E"))
        out.append(f"| `{c['row']}` | {c['verb']} | `{esc(c['path'])}` ({ev}) | {esc(c['predicate'])} | {esc(c['counterexample'])} |")
    return "\n".join(out)


def area(name):
    out = ["| ID | Capability | Status | Qualifier | Cells | Source route | Required proof or decision |", "|---|---|---|---|---|---|---|"]
    for w in DATA["workRecords"]:
        if w["area"] != name:
            continue
        cells = ", ".join(f"`{c['row']}` {c['verb']}" for c in w["cells"]) or "none (delivery)"
        out.append(f"| {w['id']} | {esc(w['title'])} | {w['status']} | {esc(w['qualifier']) or '—'} | {cells} | {esc(w['sourceRoute'])} | {esc(w['requiredProof'])} |")
    return "\n".join(out)


def dependencies():
    out = ["| ID | Status | Proof | Prerequisites | Enabling | Effort driver | Owner |", "|---|---|---|---|---|---|---|"]
    for w in DATA["workRecords"]:
        pre = ", ".join(w["prerequisites"]) or "—"
        en = ", ".join(w["enabling"]) or "—"
        out.append(f"| {w['id']} | {w['status']} | {proof_text(w['proof'])} | {pre} | {en} | `{w['effortDriver']}` | {esc(w['owner'])} |")
    return "\n".join(out)


SHORT = {
    "Live": "Live", "Checked offline": "Checked", "Source": "Source", "Claim": "Claim", "Not found": "Not found",
}
PROJECT_ORDER = [
    "bitwig-control-deck", "bwpreset", "openwig", "bitwig-extensions", "WigAI", "daw-mcp", "bitwig_agent",
    "acidcat", "DrivenByMoss", "BitX", "bitwig-nitro-tools", "bitwig-device-hacks", "superpowers",
]


def external_proof(proof):
    level = proof["level"]
    if level == "Live":
        return f"Live {proof['build']}"
    return SHORT[level]


def external_matrix():
    """Rows by project. A cell lists the verbs with their proof level; the Ghostnote column lists its claim cells."""
    ext = DATA.get("externalCells", [])
    gn = {(c["row"], c["verb"]): c for c in DATA["cells"]}
    rows_with = {e["row"] for e in ext}
    projects = [p for p in PROJECT_ORDER if any(e["project"] == p for e in ext)]
    out = ["| Row | Ghostnote | " + " | ".join(projects) + " |", "|---|---|" + "---|" * len(projects)]
    for r in DATA["rows"]:
        if r["key"] not in rows_with:
            continue
        gcells = [f"{v} {gn[(r['key'], v)]['status']}" for v in VERBS if (r["key"], v) in gn and gn[(r["key"], v)]["status"] in CLAIM]
        line = [f"`{r['key']}`", "; ".join(gcells)]
        for p in projects:
            parts = [f"{e['verb']} {external_proof(e['proof'])}" for e in ext if e["project"] == p and e["row"] == r["key"]]
            line.append("; ".join(parts))
        out.append("| " + " | ".join(line) + " |")
    return "\n".join(out)


def external(area):
    ext = DATA.get("externalCells", [])
    area_rows = [r["key"] for r in DATA["rows"] if r["area"] == area]
    out = ["| Project | Row | Verb | Proof | Path | Predicate | Counterexample | Note |", "|---|---|---|---|---|---|---|---|"]
    for key in area_rows:
        for p in PROJECT_ORDER:
            for e in ext:
                if e["row"] != key or e["project"] != p:
                    continue
                out.append(f"| `{e['project']}` | `{e['row']}` | {e['verb']} | {external_proof(e['proof'])} | `{esc(e['path'])}` | {esc(e['predicate'])} | {esc(e['counterexample'])} | {esc(e['evidenceNote'])} |")
    return "\n".join(out)


def main(argv):
    if not argv:
        print(__doc__)
        return
    cmd = argv[0]
    if cmd == "product":
        print(product())
    elif cmd == "matrix":
        print(full_matrix())
    elif cmd == "claims":
        print(claims())
    elif cmd == "area":
        print(area(argv[1]))
    elif cmd == "dependencies":
        print(dependencies())
    elif cmd == "external-matrix":
        print(external_matrix())
    elif cmd == "external":
        print(external(argv[1]))
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
