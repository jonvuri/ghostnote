#!/usr/bin/env python3
"""Build the wave-4 report from the retained baseline and scope overlay."""

import argparse
import hashlib
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "a" and "href" in attrs:
            self.links.append(attrs["href"])


def build():
    source_bytes = (ROOT.parent / "wave-3/data/records.json").read_bytes()
    source = json.loads(source_bytes)
    overlay = json.loads((ROOT / "scope.json").read_text())
    source_records = {r["id"]: r for r in source["workRecords"]}
    records = overlay["records"]
    assert len(records) == len(source_records) == 58
    assert {r["id"] for r in records} == set(source_records)
    assert len({r["id"] for r in records}) == len(records)
    rows = []
    for item in records:
        record = source_records[item["id"]]
        proof = record["proof"]["level"]
        if record["proof"]["build"]:
            proof += " " + record["proof"]["build"]
        assert item["disposition"] and item["reason"]
        rows.append(
            '<tr data-disposition="{}"><td><a href="../wave-3/report.html#work-{}">{} · {}</a>'
            '<br><span class="note">{}</span></td><td>{}<br>{}<br><span class="note">{}</span></td><td>{}</td><td>{}</td></tr>'.format(
                escape(item["disposition"], quote=True), escape(item["id"]),
                escape(item["id"]), escape(record["title"]), escape(record["owner"]),
                escape(record["status"]), escape(proof), escape(record["qualifier"]), escape(item["disposition"]),
                escape(item["reason"])))
    options = "".join('<option>{}</option>'.format(escape(d)) for d in sorted({r["disposition"] for r in records}))
    sequence = json.loads((ROOT / "sequence.json").read_text())["variations"]
    sequence_ids = {v["id"] for v in sequence}
    assert len(sequence_ids) == len(sequence) == 13
    sequence_rows = []
    prior = set()
    for variation in sequence:
        assert variation["workflow"] in {"song", "sound", "mix"}
        assert set(variation["dependencies"]) <= prior
        assert set(variation["work"]) <= set(source_records)
        assert set(variation["research"]) <= {"R01", "R02", "R03", "R04", "R05"}
        assert all(variation[k] for k in ["title", "task", "acceptance", "limit"])
        links = " · ".join('<a href="../wave-3/report.html#work-{}">{}</a>'.format(escape(k), escape(k))
                           for k in variation["work"])
        sequence_rows.append(
            '<tr data-sequence-workflow="{}"><th scope="row"><span class="tag">{} · {}</span>'
            '<h3>{}</h3><span class="note">{}</span></th><td>{}</td><td>{}</td>'
            '<td>{}<p class="note">Requires: {}. Research: {}.</p>{}</td></tr>'.format(
                escape(variation["workflow"]), escape(variation["id"]), escape(variation["workflow"]),
                escape(variation["title"]), "Working case", escape(variation["task"]),
                escape(variation["acceptance"]), escape(variation["limit"]),
                escape(", ".join(variation["dependencies"]) or "existing baseline"),
                escape(", ".join(variation["research"]) or "existing owner / case brief"), links))
        prior.add(variation["id"])
    coverage = json.loads((ROOT / "coverage.json").read_text())
    row_groups = {}
    for group in coverage["groups"]:
        assert group["case"] and group["limit"] and group["treatment"]
        assert group["priority"] and set(group["variations"]) <= sequence_ids
        assert set(group["workflows"]) <= {"song", "sound", "mix"}
        for key in group["rows"]:
            assert key not in row_groups, f"Duplicate coverage row: {key}"
            row_groups[key] = group
    assert set(row_groups) == {r["key"] for r in source["rows"]}
    assert len(row_groups) == 76
    coverage_rows = []
    for row in source["rows"]:
        group = row_groups[row["key"]]
        evidence = []
        for cell in source["cells"]:
            if cell["row"] != row["key"]:
                continue
            proof = cell["proof"]["level"]
            if cell["proof"]["build"]:
                proof += " " + cell["proof"]["build"]
            evidence.append('<a href="../wave-3/report.html#gn-{}-{}">{}: {} / {}</a>'.format(
                escape(row["key"]), escape(cell["verb"]), escape(cell["verb"]),
                escape(cell["status"]), escape(proof)))
        for cell in source["externalCells"]:
            if cell["row"] == row["key"]:
                evidence.append('<a href="../wave-3/report.html#ext-{}-{}-{}">{} {}: {}</a>'.format(
                    escape(cell["project"]), escape(row["key"]), escape(cell["verb"]),
                    escape(cell["project"]), escape(cell["verb"]), escape(cell["proof"]["level"])))
        coverage_rows.append(
            '<tr data-treatment="{}"><td><strong>{}: {}</strong><br><code>{}</code></td>'
            '<td>{}<br><span class="note">{}</span></td><td>{}<br><span class="note">{}</span></td>'
            '<td>{}</td></tr>'.format(
                escape(group["treatment"], quote=True), escape(row["object"]), escape(row["aspect"]),
                escape(row["key"]), escape(group["treatment"]),
                escape(", ".join(group["workflows"]) or "Outside the three host workflows"),
                escape(group["priority"] + " · " + (", ".join(group["variations"]) or "No main-path case") + ". " + group["case"]),
                escape(group["limit"]), "<br>".join(evidence)))
    coverage_options = "".join('<option>{}</option>'.format(escape(d)) for d in sorted(
        {g["treatment"] for g in coverage["groups"]}))
    output = (ROOT / "report-template.html").read_text()
    for key, value in {"ROWS": "\n".join(rows), "OPTIONS": options,
                       "SEQUENCE": "\n".join(sequence_rows),
                       "COVERAGEROWS": "\n".join(coverage_rows), "COVERAGEOPTIONS": coverage_options,
                       "DIGEST": hashlib.sha256(source_bytes).hexdigest()}.items():
        assert output.count("{{" + key + "}}") == 1
        output = output.replace("{{" + key + "}}", value)
    assert not re.search(r"\{\{[A-Z]+\}\}", output)
    parsed = Links()
    parsed.feed(output)
    assert len(parsed.ids) == len(set(parsed.ids)), "Duplicate report IDs"
    targets = {ROOT / "report.html": parsed}
    for link in parsed.links:
        url = urlsplit(link)
        if url.scheme:
            continue
        path = (ROOT / unquote(url.path)).resolve() if url.path else ROOT / "report.html"
        assert path.exists() or path == ROOT / "report.html", f"Missing link: {link}"
        if url.fragment and path.suffix == ".html":
            if path not in targets:
                target = Links()
                target.feed(path.read_text())
                targets[path] = target
            assert unquote(url.fragment) in targets[path].ids, f"Missing anchor: {link}"
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    output = build()
    path = ROOT / "report.html"
    if args.check:
        assert path.read_text() == output, "Report is stale; run build.py"
        print("Wave-4 report: 13 variations, 58 work records, 76 coverage rows, dependencies, baseline joins, links, anchors, and generated bytes pass.")
    else:
        path.write_text(output)
        print("Built wave-4 report.html")


if __name__ == "__main__":
    main()
