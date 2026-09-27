#!/usr/bin/env python3
"""Verify and report the Phase 8c2.3 compact JSON development run."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from copy import deepcopy
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
RUNS_ROOT = PACKAGE_ROOT / "runs"
sys.path.insert(0, str(PACKAGE_ROOT))
import core  # type: ignore  # noqa: E402
import development as dev  # type: ignore  # noqa: E402
sys.path.pop(0)


SCHEMA = "ghostnote-compact-json-development-report-v1"
PROVIDERS = ("openai", "gemini", "claude")
RUN_PATHS = {
    provider: RUNS_ROOT / f"2026-09-27-development-{provider}.json"
    for provider in PROVIDERS
}
CHEAP_SUMMARY_PATH = RUNS_ROOT / "2026-09-27-development-cheap-summary.json"
SUMMARY_PATH = RUNS_ROOT / "2026-09-27-development-summary.json"
APPROVAL_PATH = RUNS_ROOT / "development-r1-approval.json"


def load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def without_hash(value: dict[str, Any], field: str) -> dict[str, Any]:
    result = deepcopy(value)
    result.pop(field, None)
    return result


def arm_results(run: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for arm in dev.ARMS:
        rows = [row for row in run["results"] if row["arm"] == arm]
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
    protocol = dev.protocol_manifest()
    screen = dev.deterministic_screen()
    jobs = {
        (job["arm"], job["family"], job["variant"], job["repeat"]): job
        for job in dev.jobs()
    }
    assert run["provider"] == provider
    checks += 1
    assert run["run_id"] == dev.RUN_ID and run["protocol_sha256"] == protocol["sha256"]
    checks += 1
    assert run["requested_model"] == dev.MODELS[provider]
    assert {row["returned_model"] for row in run["results"]} == {dev.MODELS[provider]}
    checks += 1
    assert run["settings"] == dev.SETTINGS[provider]
    assert run["transport_audit_sha256"] == dev.transport_audit()["sha256"]
    assert all(row["request_settings"] == dev.SETTINGS[provider] for row in run["results"])
    checks += 1
    assert run["approval"] == approval
    checks += 1
    assert run["screen_sha256"] == screen["sha256"]
    assert run["complete"] and len(run["results"]) == 100
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
        assert row["validation"] == dev.score_response(
            row["arm"], job["task"], row["response_payload"]
        )
    checks += 1
    return checks


def limited_results(runs: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for provider, run in runs.items():
        for row in run["results"]:
            if str(row.get("stop_reason", "")).lower() in {"length", "max_tokens"}:
                result.append(
                    {
                        "provider": provider,
                        "arm": row["arm"],
                        "variant": row["variant"],
                        "output_tokens": row["usage"]["output_tokens"],
                        "thinking_tokens": row["usage"]["thinking_tokens"],
                        "stop_reason": row["stop_reason"],
                    }
                )
    return result


def build_report() -> tuple[dict[str, Any], int]:
    approval = load(APPROVAL_PATH)
    runs = {provider: load(path) for provider, path in RUN_PATHS.items()}
    cheap_summary = load(CHEAP_SUMMARY_PATH)
    summary = load(SUMMARY_PATH)
    plan = dev.run_plan()
    checks = 0

    assert approval["status"] == "approved" and approval["operator_statement"]
    assert approval["run_plan_sha256"] == plan["sha256"]
    assert approval["protocol_sha256"] == dev.protocol_manifest()["sha256"]
    checks += 3
    for provider, run in runs.items():
        checks += verify_run(provider, run, approval)

    cheap_runs = [runs["openai"], runs["gemini"]]
    assert cheap_summary == dev.summarize_runs(cheap_runs)
    assert cheap_summary["decision"] == "require-claude"
    checks += 2
    assert summary == dev.summarize_runs(list(runs.values()))
    assert summary["sha256"] == core.digest(without_hash(summary, "sha256"))
    assert summary["decision"] == "freeze-holdout"
    checks += 3
    assert summary["json_candidates"] == [
        "exact-object-json-midi",
        "exact-object-json-pc-register",
        "tuple-json-midi",
    ]
    assert summary["native_limited_candidate"] is False
    checks += 2

    limited = limited_results(runs)
    assert len(limited) == 6
    assert {row["provider"] for row in limited} == {"claude"}
    assert all(row["output_tokens"] == 5000 for row in limited)
    checks += 3

    estimate = plan["cost_estimate"]
    actual = summary["actual_cost_usd"]
    report = {
        "schema": SCHEMA,
        "run_id": dev.RUN_ID,
        "decision": summary["decision"],
        "approval_statement": approval["operator_statement"],
        "actual_cost_usd": actual,
        "cost_estimate_usd": {
            "cheap_stage": estimate["cheap_stage_usd"],
            "maximum": estimate["maximum_usd"],
        },
        "cost_variance_usd": {
            "cheap_stage": round(
                cheap_summary["actual_cost_usd"]["total"] - estimate["cheap_stage_usd"], 6
            ),
            "maximum": round(actual["total"] - estimate["maximum_usd"], 6),
        },
        "cheap_stage": {
            "decision": cheap_summary["decision"],
            "summary_sha256": cheap_summary["sha256"],
        },
        "providers": {
            provider: {
                "requested_model": run["requested_model"],
                "calls": len(run["results"]),
                "complete": run["complete"],
                "retries": sum(row["retries"] for row in run["results"]),
                "actual_cost_usd": run["actual_cost_usd"],
                "raw_run_sha256": run["raw_run_sha256"],
                "manifest_sha256": run["manifest_sha256"],
                "arm_results": arm_results(run),
            }
            for provider, run in runs.items()
        },
        "selection": {
            "json_candidates": summary["json_candidates"],
            "full_capability_fallback": summary["full_capability_fallback"],
            "native_limited_candidate": summary["native_limited_candidate"],
            "supporting_providers": summary["supporting_providers"],
            "shape": summary["shape"],
        },
        "settings_audit": {
            "declared_and_sent_match": True,
            "transport_audit_sha256": dev.transport_audit()["sha256"],
            "limit_affected_results": limited,
        },
        "development_summary_sha256": summary["sha256"],
        "allowed_follow_up": (
            "Freeze a separate holdout plan. Do not make a holdout provider call "
            "without explicit approval."
        ),
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
    value = (
        {
            "schema": SCHEMA,
            "pass": True,
            "checks": checks,
            "report_sha256": report["sha256"],
        }
        if args.self_test
        else report
    )
    write(value, args.output)


if __name__ == "__main__":
    main()
