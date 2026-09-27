#!/usr/bin/env python3
"""Verify and report the Phase 8c2.2 calibration runs."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PACKAGE_ROOT))
import benchmark  # type: ignore  # noqa: E402
import core  # type: ignore  # noqa: E402
sys.path.pop(0)


SCHEMA = "ghostnote-compact-format-calibration-report-v3"


def load_runs(paths: list[Path]) -> list[dict[str, Any]]:
    runs = [json.loads(path.read_text()) for path in paths]
    if {run["provider"] for run in runs} != set(benchmark.PROVIDERS):
        raise ValueError("The report needs one run from each provider")
    plan = benchmark.run_plan()
    for run in runs:
        provider = run["provider"]
        manifest = run["manifest_sha256"]
        unsigned = dict(run)
        del unsigned["manifest_sha256"]
        if core.digest(unsigned) != manifest:
            raise ValueError(f"The {provider} manifest hash is invalid")
        if core.digest([row.get("raw_response_sha256") for row in run["results"]]) != run["raw_run_sha256"]:
            raise ValueError(f"The {provider} raw-run hash is invalid")
        if run["protocol_sha256"] != plan["protocol_sha256"]:
            raise ValueError(f"The {provider} protocol hash is invalid")
        if len(run["results"]) != plan["expected_calls"][provider] or not run["complete"]:
            raise ValueError(f"The {provider} run is incomplete")
        if any(row.get("returned_model") != benchmark.MODELS[provider] for row in run["results"]):
            raise ValueError(f"The {provider} returned model is invalid")
        approval = run["approval"]
        if (
            approval.get("status") != "approved"
            or not approval.get("operator_statement")
            or approval.get("run_id") != benchmark.RUN_ID
            or approval.get("protocol_sha256") != plan["protocol_sha256"]
            or approval.get("run_plan_sha256") != plan["sha256"]
        ):
            raise ValueError(f"The {provider} approval is invalid")
    return runs


def report(paths: list[Path]) -> dict[str, Any]:
    runs = load_runs(paths)
    summary = benchmark.summarize_calibration(runs)
    value = {
        "schema": SCHEMA,
        "run_id": benchmark.RUN_ID,
        "decision": summary["decision"],
        "summary_sha256": summary["sha256"],
        "protocol_sha256": summary["protocol_sha256"],
        "actual_cost_usd": summary["actual_cost_usd"],
        "family_eligibility": summary["family_eligibility"],
        "provider_manifest_sha256": {run["provider"]: run["manifest_sha256"] for run in runs},
        "provider_raw_run_sha256": {run["provider"]: run["raw_run_sha256"] for run in runs},
        "provider_results": summary["providers"],
    }
    value["sha256"] = core.digest(value)
    return value


def self_test(paths: list[Path]) -> dict[str, Any]:
    value = report(paths)
    assert value["decision"] == "repair-measurement"
    assert value["summary_sha256"] == "739b1a4fb2de14eb2e0272cd97f81e2d586c44c89fe0438a6fa104d80b5854c4"
    assert value["actual_cost_usd"]["total"] == 1.481306
    assert all(row["eligible"] for row in value["family_eligibility"] if row["family"] in {"continuation-roles", "transformation-revoice"})
    progression = next(row for row in value["family_eligibility"] if row["family"] == "generation-progression")
    assert progression["eligible_providers"] == 1 and not progression["eligible"]
    return {"schema": SCHEMA, "pass": True, "checks": 13, "report_sha256": value["sha256"]}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("runs", nargs=3, type=Path)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    value = self_test(args.runs) if args.self_test else report(args.runs)
    rendered = json.dumps(value, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered)
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
