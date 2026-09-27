#!/usr/bin/env python3
"""Build and verify the Phase 8c2 targeted holdout report."""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PACKAGE_ROOT))
import benchmark as base  # type: ignore  # noqa: E402
import holdout as protocol  # type: ignore  # noqa: E402
sys.path.pop(0)


SCHEMA = "ghostnote-compact-format-targeted-holdout-report-v2"


def load_runs(paths: list[Path]) -> list[dict[str, Any]]:
    runs = [json.loads(path.read_text()) for path in paths]
    if {run.get("provider") for run in runs} != set(base.PROVIDERS):
        raise ValueError("Report needs one run from each provider")
    expected_protocol = protocol.protocol_manifest()["sha256"]
    expected_plan = protocol.run_plan()["sha256"]
    for run in runs:
        if run.get("run_id") != protocol.RUN_ID:
            raise ValueError("Provider run has a different run ID")
        if run.get("protocol_sha256") != expected_protocol:
            raise ValueError("Provider run has a different holdout protocol")
        if not run.get("complete") or len(run.get("results", [])) != 72:
            raise ValueError("Provider run is incomplete")
        if any(row.get("transport_error") for row in run["results"]):
            raise ValueError("Provider run has a transport error")
        if any(row.get("returned_model") != run.get("requested_model") for row in run["results"]):
            raise ValueError("Provider returned a different model")
        approval = run.get("approval", {})
        if approval.get("run_plan_sha256") != expected_plan or approval.get("status") != "approved":
            raise ValueError("Provider run has a different approval")
        manifest = dict(run)
        recorded_manifest_sha = manifest.pop("manifest_sha256", None)
        if base.digest(manifest) != recorded_manifest_sha:
            raise ValueError("Provider manifest hash does not match")
        raw_sha = base.digest([row.get("raw_response_sha256") for row in run["results"]])
        if raw_sha != run.get("raw_run_sha256"):
            raise ValueError("Provider raw response hash does not match")
    return runs


def report(paths: list[Path]) -> dict[str, Any]:
    runs = load_runs(paths)
    # The frozen protocol omitted this import from its reporting-only path.
    protocol.defaultdict = defaultdict
    value = protocol.summarize(paths)
    value.pop("sha256", None)
    value["schema"] = SCHEMA
    value["reporting_correction"] = (
        "The frozen protocol omitted the collections.defaultdict import from its local summary path. "
        "This reporter supplies the import without changing the provider-bearing protocol."
    )
    value["sha256"] = base.digest(value)
    return value


def self_test(paths: list[Path]) -> dict[str, Any]:
    first = report(paths)
    second = report(paths)
    assert first == second
    assert len(first["providers"]) == 3
    assert len(first["candidate_comparisons"]) == 3
    assert all(row["paired_denominator"] == 18 for row in first["candidate_comparisons"])
    assert sum(row["actual_cost_usd"] for row in first["providers"]) == first["actual_cost_usd"]["total"]
    assert first["decision"] == "do-not-select"
    assert first["provider_passes"] == 1
    gates = {row["provider"]: row["provider_gate"]["pass"] for row in first["candidate_comparisons"]}
    assert gates == {"openai": False, "gemini": False, "claude": True}
    sentinel_results = [
        next(arm for arm in provider["arms"] if arm["arm"] == protocol.CANDIDATE)["sentinel_outcomes"]
        for provider in first["providers"]
    ]
    assert all(outcomes == [True, True, True] for outcomes in sentinel_results)
    return {"schema": SCHEMA, "pass": True, "checks": 9, "report_sha256": first["sha256"]}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("runs", nargs=3, type=Path)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    value = self_test(args.runs) if args.self_test else report(args.runs)
    rendered = json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    if args.output:
        args.output.write_text(rendered)
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
