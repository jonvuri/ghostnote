#!/usr/bin/env python3
"""Verify and summarize the Phase 8c2.3 repair calibration."""

from __future__ import annotations

import argparse
import inspect
import json
from collections import Counter
from copy import deepcopy
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
RUNS_ROOT = PACKAGE_ROOT / "runs"

import sys

sys.path.insert(0, str(PACKAGE_ROOT))
import calibration_r2 as r2  # type: ignore  # noqa: E402
import core  # type: ignore  # noqa: E402
sys.path.pop(0)


SCHEMA = "ghostnote-compact-json-calibration-r2-report-v1"
RUN_PATHS = {
    provider: RUNS_ROOT / f"2026-09-27-calibration-r2-{provider}.json"
    for provider in ("openai", "gemini")
}
SUMMARY_PATH = RUNS_ROOT / "2026-09-27-calibration-r2-cheap-summary.json"
APPROVAL_PATH = RUNS_ROOT / "calibration-r2-approval.json"


def load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def without_hash(value: dict[str, Any], field: str) -> dict[str, Any]:
    result = deepcopy(value)
    result.pop(field, None)
    return result


def arm_results(run: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for family in r2.FAMILIES:
        for arm in r2.ARMS:
            rows = [
                row
                for row in run["results"]
                if row["family"] == family and row["arm"] == arm
            ]
            failed_checks: Counter[str] = Counter()
            errors: Counter[str] = Counter()
            for row in rows:
                validation = row["validation"]
                failed_checks.update(
                    name for name, passed in validation.get("checks", {}).items() if not passed
                )
                if validation.get("error"):
                    errors[validation["error"]] += 1
            result.append(
                {
                    "arm": arm,
                    "family": family,
                    "successes": sum(row["validation"]["primary_pass"] for row in rows),
                    "trials": len(rows),
                    "syntax_failures": sum(not row["validation"]["syntax_pass"] for row in rows),
                    "failed_checks": dict(sorted(failed_checks.items())),
                    "errors": dict(sorted(errors.items())),
                }
            )
    return result


def verify_run(provider: str, run: dict[str, Any], approval: dict[str, Any]) -> int:
    checks = 0
    protocol = r2.protocol_manifest()
    jobs = {
        (job["arm"], job["family"], job["variant"], 0): job
        for job in r2.jobs()
    }
    assert run["provider"] == provider
    checks += 1
    assert run["run_id"] == r2.RUN_ID and run["protocol_sha256"] == protocol["sha256"]
    checks += 1
    assert run["requested_model"] == r2.MODELS[provider]
    assert {row["returned_model"] for row in run["results"]} == {r2.MODELS[provider]}
    checks += 1
    assert run["approval"] == approval
    checks += 1
    assert run["complete"] and len(run["results"]) == 30
    assert all("transport_error" not in row for row in run["results"])
    checks += 1
    assert run["raw_run_sha256"] == core.digest(
        [row["raw_response_sha256"] for row in run["results"]]
    )
    checks += 1
    assert run["manifest_sha256"] == core.digest(without_hash(run, "manifest_sha256"))
    checks += 1
    assert run["actual_cost_usd"] == round(
        sum(row["cost_usd"]["total"] for row in run["results"]), 6
    )
    checks += 1
    assert {
        (row["arm"], row["family"], row["variant"], row["repeat"])
        for row in run["results"]
    } == set(jobs)
    checks += 1
    for row in run["results"]:
        key = (row["arm"], row["family"], row["variant"], row["repeat"])
        job = jobs[key]
        prompt_key = ":".join(map(str, key))
        assert row["task_sha256"] == job["task"]["sha256"]
        assert row["semantic_sha256"] == job["task"]["semantic_sha256"]
        assert row["prompt_sha256"] == protocol["prompt_sha256"][prompt_key]
        assert row["response_payload_sha256"] == core.sha256_text(row["response_payload"])
        assert row["validation"] == r2.score_response(
            row["arm"], job["task"], row["response_payload"]
        )
    checks += 1
    return checks


def settings_audit(runs: dict[str, dict[str, Any]]) -> dict[str, Any]:
    transport = {
        "openai": {"reasoning_effort": "low", "max_completion_tokens": 3000},
        "gemini": {"thinking_level": "low", "max_output_tokens": 3000},
        "claude": {"effort": "low", "max_tokens": 3000},
        "temperature": "provider default",
    }
    declared = r2.SETTINGS
    limit_fields = {
        "openai": "max_completion_tokens",
        "gemini": "max_output_tokens",
        "claude": "max_tokens",
    }
    mismatches = []
    for provider, field in limit_fields.items():
        if declared[provider][field] != transport[provider][field]:
            mismatches.append(
                {
                    "provider": provider,
                    "field": field,
                    "declared": declared[provider][field],
                    "transport": transport[provider][field],
                }
            )
    limited = []
    for provider, run in runs.items():
        field = limit_fields[provider]
        limit = transport[provider][field]
        for row in run["results"]:
            if row["usage"]["output_tokens"] >= limit or str(row.get("stop_reason", "")).lower() in {
                "length",
                "max_tokens",
            }:
                limited.append(
                    {
                        "provider": provider,
                        "arm": row["arm"],
                        "family": row["family"],
                        "variant": row["variant"],
                        "output_tokens": row["usage"]["output_tokens"],
                        "stop_reason": row.get("stop_reason"),
                    }
                )
    source = inspect.getsource(r2.core.v3.v2.model_call)
    assert '"max_completion_tokens": 3000' in source
    assert '"maxOutputTokens": 3000' in source
    assert '"max_tokens": 3000' in source
    return {
        "declared": declared,
        "transport": transport,
        "exact_match": not mismatches,
        "mismatches": mismatches,
        "transport_model_call_sha256": core.sha256_text(source),
        "limit_affected_results": limited,
    }


def build_report() -> tuple[dict[str, Any], int]:
    approval = load(APPROVAL_PATH)
    runs = {provider: load(path) for provider, path in RUN_PATHS.items()}
    summary = load(SUMMARY_PATH)
    checks = 0

    assert approval["status"] == "approved" and approval["operator_statement"]
    assert approval["run_plan_sha256"] == r2.run_plan()["sha256"]
    assert approval["repair_protocol_sha256"] == r2.protocol_manifest()["sha256"]
    checks += 3
    for provider, run in runs.items():
        checks += verify_run(provider, run, approval)
    assert summary == r2.summarize_runs(list(runs.values()))
    assert summary["sha256"] == core.digest(without_hash(summary, "sha256"))
    checks += 2

    audit = settings_audit(runs)
    assert not audit["exact_match"]
    assert len(audit["mismatches"]) == 3
    assert len(audit["limit_affected_results"]) == 2
    checks += 3

    all_rows = [row for run in runs.values() for row in run["results"]]
    exact_metadata_failures = sum(
        row["validation"].get("checks", {}).get("exact_metadata") is False
        for row in all_rows
    )
    canonical_order_failures = sum(
        "canonical order" in str(row["validation"].get("error", ""))
        for row in all_rows
    )
    assert exact_metadata_failures == 0
    assert canonical_order_failures == 1
    checks += 2
    assert summary["decision"] == "repair-measurement"
    assert any(row["eligible_providers"] == 0 for row in summary["eligibility"])
    checks += 2

    report = {
        "schema": SCHEMA,
        "run_id": r2.RUN_ID,
        "decision": summary["decision"],
        "claude_allowed": False,
        "actual_cost_usd": summary["actual_cost_usd"],
        "summary_sha256": summary["sha256"],
        "providers": {
            provider: {
                "requested_model": run["requested_model"],
                "calls": len(run["results"]),
                "complete": run["complete"],
                "actual_cost_usd": run["actual_cost_usd"],
                "raw_run_sha256": run["raw_run_sha256"],
                "manifest_sha256": run["manifest_sha256"],
                "arm_results": arm_results(run),
            }
            for provider, run in runs.items()
        },
        "eligibility": summary["eligibility"],
        "prompt_contract_repair": {
            "exact_metadata_failures": exact_metadata_failures,
            "canonical_order_failures": canonical_order_failures,
        },
        "settings_audit": audit,
        "diagnosis": {
            "continuation_roles": "Demote this family because both controls passed 6/6 on both providers.",
            "generation_progression": "Retain this family. OpenAI was eligible at 4/6 and Gemini was below the band at 1/6.",
            "transport": "The provider helper used a 3,000-token limit while the frozen r2 plan declared 4,000 tokens.",
        },
        "allowed_follow_up": "Repair the transport offline and freeze a new progression-only calibration. Do not run another provider or start development without explicit approval.",
    }
    report["sha256"] = core.digest(report)
    return report, checks


def write(value: dict[str, Any], output: Path | None) -> None:
    rendered = json.dumps(value, indent=2, sort_keys=True) + "\n"
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered)
    else:
        print(rendered, end="")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report, checks = build_report()
    if args.self_test:
        value = {
            "schema": SCHEMA,
            "pass": True,
            "checks": checks,
            "report_sha256": report["sha256"],
        }
    else:
        value = report
    write(value, args.output)


if __name__ == "__main__":
    main()
