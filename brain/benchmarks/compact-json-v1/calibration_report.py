#!/usr/bin/env python3
"""Verify and diagnose the Phase 8c2.3 calibration."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PACKAGE_ROOT))
import benchmark as r1  # type: ignore  # noqa: E402
import core  # type: ignore  # noqa: E402
sys.path.pop(0)

RUNS_ROOT = PACKAGE_ROOT / "runs"
RUN_PATHS = {
    provider: RUNS_ROOT / f"2026-09-27-calibration-{provider}.json"
    for provider in r1.PROVIDERS
}
SUMMARY_PATH = RUNS_ROOT / "2026-09-27-calibration-summary.json"


def verify_run(value: dict[str, Any], provider: str) -> dict[str, Any]:
    protocol = r1.protocol_manifest()
    approval = json.loads((RUNS_ROOT / "calibration-r1-approval.json").read_text())
    manifest = value["manifest_sha256"]
    unsigned = {name: field for name, field in value.items() if name != "manifest_sha256"}
    raw_hash = core.digest([row.get("raw_response_sha256") for row in value["results"]])
    prompts = {
        (job["arm"], job["family"], job["variant"], job["repeat"]): core.sha256_text(core.prompt_for(job["arm"], job["task"]))
        for job in core.jobs("calibration")
    }
    actual_prompts = {
        (row["arm"], row["family"], row["variant"], row["repeat"]): row["prompt_sha256"]
        for row in value["results"]
    }
    checks = {
        "provider": value["provider"] == provider,
        "run_id": value["run_id"] == r1.RUN_ID,
        "protocol": value["protocol_sha256"] == protocol["sha256"],
        "approval": value["approval"] == approval,
        "complete": value["complete"] is True,
        "call_count": len(value["results"]) == 70,
        "transport": all("transport_error" not in row for row in value["results"]),
        "requested_model": value["requested_model"] == r1.MODELS[provider],
        "returned_model": {row.get("returned_model") for row in value["results"]} == {r1.MODELS[provider]},
        "raw_run_sha256": value["raw_run_sha256"] == raw_hash,
        "manifest_sha256": manifest == core.digest(unsigned),
        "prompt_set": prompts == actual_prompts,
    }
    return {
        "provider": provider,
        "checks": checks,
        "pass": all(checks.values()),
        "calls": len(value["results"]),
        "actual_cost_usd": value["actual_cost_usd"],
        "raw_run_sha256": value["raw_run_sha256"],
        "manifest_sha256": manifest,
    }


def failure_table(run: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for family in core.DECISION_FAMILIES:
        for arm in core.ARMS:
            rows = [row for row in run["results"] if row["family"] == family and row["arm"] == arm]
            failures = Counter(
                name
                for row in rows
                for name, passed in row["validation"].get("checks", {}).items()
                if not passed
            )
            errors = Counter(
                row["validation"].get("error")
                for row in rows
                if row["validation"].get("error")
            )
            result.append(
                {
                    "family": family,
                    "arm": arm,
                    "primary_passes": sum(row["validation"]["primary_pass"] for row in rows),
                    "syntax_passes": sum(row["validation"]["syntax_pass"] for row in rows),
                    "trials": len(rows),
                    "failed_checks": dict(sorted(failures.items())),
                    "errors": dict(sorted(errors.items())),
                }
            )
    return result


def report() -> dict[str, Any]:
    runs = {provider: json.loads(path.read_text()) for provider, path in RUN_PATHS.items()}
    integrity = [verify_run(runs[provider], provider) for provider in r1.PROVIDERS]
    retained = json.loads(SUMMARY_PATH.read_text())
    calculated = r1.summarize_calibration(list(runs.values()))
    control_rows = {
        item["family"]: item
        for item in retained["eligibility"]
    }
    progression_json_syntax = sum(
        row["validation"]["syntax_pass"]
        for run in runs.values()
        for row in run["results"]
        if row["family"] == "generation-progression" and row["arm"] in core.JSON_ARMS
    )
    progression_json_trials = sum(
        1
        for run in runs.values()
        for row in run["results"]
        if row["family"] == "generation-progression" and row["arm"] in core.JSON_ARMS
    )
    role_json_syntax = sum(
        row["validation"]["syntax_pass"]
        for run in runs.values()
        for row in run["results"]
        if row["family"] == "continuation-roles" and row["arm"] in core.JSON_ARMS
    )
    role_json_trials = sum(
        1
        for run in runs.values()
        for row in run["results"]
        if row["family"] == "continuation-roles" and row["arm"] in core.JSON_ARMS
    )
    revoice_controls = [
        row
        for run in runs.values()
        for row in run["results"]
        if row["family"] == "transformation-revoice" and row["arm"] in r1.CONTROL_ARMS
    ]
    cost = {
        provider: runs[provider]["actual_cost_usd"]
        for provider in r1.PROVIDERS
    }
    value = {
        "schema": "ghostnote-compact-json-calibration-report-v1",
        "run_id": r1.RUN_ID,
        "integrity": integrity,
        "retained_summary_equal": calculated == retained,
        "retained_summary_sha256": retained["sha256"],
        "decision": retained["decision"],
        "eligibility": retained["eligibility"],
        "diagnosis": {
            "progression": {
                "control_result": control_rows["generation-progression"],
                "json_syntax_passes": progression_json_syntax,
                "json_trials": progression_json_trials,
                "finding": "The progression controls are at a floor. JSON outputs also expose an incomplete canonical-order and metadata prompt.",
            },
            "roles": {
                "control_result": control_rows["continuation-roles"],
                "json_syntax_passes": role_json_syntax,
                "json_trials": role_json_trials,
                "finding": "Role continuation is eligible, but JSON order failures make its format comparison invalid for reuse.",
            },
            "revoice": {
                "control_successes": sum(row["validation"]["primary_pass"] for row in revoice_controls),
                "control_trials": len(revoice_controls),
                "finding": "Revoicing is at a complete control ceiling. Demote it from the decision set.",
            },
            "prompt_defect": "The prompt did not give task-specific metadata or the exact multi-voice collection order. The one-note example could not show those rules.",
            "output_limit": "Three Claude exact-object progression responses ended as unterminated nested JSON. Use exact metadata and a larger output limit in a separately approved repair run.",
        },
        "failures": {
            provider: failure_table(run)
            for provider, run in runs.items()
        },
        "cost": {
            "providers": cost,
            "total_usd": round(sum(cost.values()), 6),
            "approved_estimate_usd": r1.run_plan()["cost_estimate"]["total_usd"],
            "dashboard_authority": "The operator provider dashboards are the external spend authority.",
        },
        "allowed_follow_up": "Repair the prompts offline. Use fresh progression and role fixtures. Get separate approval before any provider call.",
    }
    value["sha256"] = core.digest(value)
    return value


def self_test() -> dict[str, Any]:
    value = report()
    assert all(row["pass"] for row in value["integrity"])
    assert value["retained_summary_equal"]
    assert value["decision"] == "repair-measurement"
    assert value["diagnosis"]["revoice"]["control_successes"] == value["diagnosis"]["revoice"]["control_trials"] == 18
    assert value["diagnosis"]["progression"]["json_syntax_passes"] < value["diagnosis"]["progression"]["json_trials"]
    return {
        "schema": value["schema"],
        "pass": True,
        "checks": sum(len(row["checks"]) for row in value["integrity"]) + 5,
        "report_sha256": value["sha256"],
    }


def write(value: dict[str, Any], output: Path | None) -> None:
    rendered = json.dumps(value, indent=2, sort_keys=True) + "\n"
    if output:
        output.write_text(rendered)
    else:
        print(rendered, end="")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    write(self_test() if args.self_test else report(), args.output)


if __name__ == "__main__":
    main()
