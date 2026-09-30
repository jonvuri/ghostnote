#!/usr/bin/env python3
"""Resume the v5 Claude continuation after the provider outage."""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
R5_PATH = PACKAGE_ROOT / "continuation_r5.py"
RUNS_ROOT = PACKAGE_ROOT / "runs"
SOURCE_PATH = RUNS_ROOT / "2026-09-29-claude-haiku-continuation-r5b.json"
APPROVAL_PATH = RUNS_ROOT / "full-matrix-continuation-r6-approval.json"
SCHEMA = "ghostnote-symbolic-format-v5-continuation-v6"
RUN_ID = "phase8c4f-eight-arm-full-matrix-continuation-r6"
PROVIDER = "claude-haiku"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


r5 = load_module("ghostnote_symbolic_format_v5_continuation_r6_r5", R5_PATH)
m = r5.m
R5_PROTOCOL_MANIFEST = r5.protocol_manifest


def configure_source() -> None:
    r5.SOURCE_PATH = SOURCE_PATH
    r5.APPROVAL_PATH = APPROVAL_PATH
    r5.SCHEMA = SCHEMA
    r5.RUN_ID = RUN_ID
    r5.configure_source()


configure_source()


def protocol_manifest() -> dict[str, Any]:
    value = R5_PROTOCOL_MANIFEST()
    value["package_files"]["continuation_r6.py"] = m.base.file_sha256(
        Path(__file__)
    )
    value.pop("sha256", None)
    value["sha256"] = m.core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    value = {
        name: protocol[name]
        for name in (
            "schema",
            "run_id",
            "source_manifest_sha256",
            "source_assessment_sha256",
            "providers",
            "models",
            "effective_request_settings",
            "pending",
            "explicit_repeat",
            "stopping_rule",
            "cost_guard",
            "approval",
        )
    }
    value["run_kind"] = "eight-arm-full-matrix-continuation-plan"
    value["protocol_sha256"] = protocol["sha256"]
    value["sha256"] = m.core.digest(value)
    return value


def deterministic_screen() -> dict[str, Any]:
    source = r5.r4.source_run()
    pending = r5.r4.pending_jobs(PROVIDER)
    selected = {job["planned_sequence"] for job in pending}
    checks = {
        "source-manifest": source["manifest_sha256"]
        == "8b46882127a50de6f8bc949954f57f1dd2f31efe4fb404d33fa5a6c10a71a1b6",
        "source-plan": source["run_plan_sha256"]
        == "8225bcc76095cdf3b46a9149a6fd41523d1c98db7b4b491476002eeb4427f989",
        "source-progress": source["progress"]
        == {
            "planned": 398,
            "attempted": 0,
            "provider_completed": 0,
            "available": 0,
            "scored": 0,
            "failed": 1,
            "unavailable": 0,
            "budget_stopped": 0,
        },
        "pending-count": len(pending) == 398,
        "failed-503-selected": 195 in selected,
        "only-expected-states": all(
            row["initial"]["kind"] in {"failed", "not-attempted"}
            for row in source["results"]
            if row["planned_sequence"] in selected
        ),
        "original-sequence-order": [
            job["planned_sequence"] for job in pending
        ]
        == list(range(195, 593)),
        "claude-output-limit": r5.r4.SETTINGS[PROVIDER]["max_tokens"]
        == 24000,
        "claude-thinking-target": r5.r4.SETTINGS[PROVIDER]["thinking"]
        == {"type": "enabled", "budget_tokens": 1024},
        "retry-bound": r5.MAXIMUM_503_RETRIES == 2,
        "cost-headroom": r5.r4.ESTIMATE[PROVIDER]
        + r5.r4.maximum_call_cost()
        <= r5.r4.LIMITS[PROVIDER],
        "cumulative-cost-bound": (
            r5.r4.RETAINED_GEMINI_COST
            + r5.r4.RETAINED_CLAUDE_COST
            + r5.r4.LIMITS[PROVIDER]
            <= r5.r4.CONTINUATION_TOTAL_LIMIT
        ),
    }
    value = {"checks": checks, "all_checks_pass": all(checks.values())}
    value["sha256"] = m.core.digest(value)
    return value


def deterministic_manifest() -> dict[str, Any]:
    plan = run_plan()
    screen = deterministic_screen()
    value = {
        "schema": SCHEMA,
        "screen_sha256": screen["sha256"],
        "protocol_sha256": plan["protocol_sha256"],
        "run_plan_sha256": plan["sha256"],
        "source_manifest_sha256": plan["source_manifest_sha256"],
        "source_assessment_sha256": plan["source_assessment_sha256"],
        "pending_calls": {PROVIDER: len(r5.r4.pending_jobs(PROVIDER))},
        "all_checks_pass": screen["all_checks_pass"],
    }
    value["sha256"] = m.core.digest(value)
    return value


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    expected = {
        "run_id": RUN_ID,
        "protocol_sha256": plan["protocol_sha256"],
        "run_plan_sha256": plan["sha256"],
        "source_manifest_sha256": plan["source_manifest_sha256"],
        "source_assessment_sha256": plan["source_assessment_sha256"],
        "maximum_total_cost_usd": plan["cost_guard"][
            "maximum_total_cost_usd"
        ],
    }
    if any(value.get(name) != item for name, item in expected.items()):
        raise ValueError("Approval does not match the r6 continuation plan")
    if value.get("status") != "approved" or not value.get(
        "operator_statement", ""
    ).strip():
        raise ValueError("Approval needs an explicit operator statement")
    return value


def configure_runtime() -> None:
    configure_source()
    r5.protocol_manifest = protocol_manifest
    r5.run_plan = run_plan
    r5.deterministic_screen = deterministic_screen
    r5.deterministic_manifest = deterministic_manifest
    r5.validate_approval = validate_approval
    r5.configure_runtime()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--print-plan", action="store_true")
    parser.add_argument("--run", action="store_true")
    parser.add_argument(
        "--env-file", type=Path, default=PACKAGE_ROOT.parents[2] / ".env"
    )
    parser.add_argument("--approval-file", type=Path, default=APPROVAL_PATH)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    configure_runtime()
    if args.self_test:
        screen = deterministic_screen()
        if not screen["all_checks_pass"]:
            raise SystemExit(json.dumps(screen, indent=2, sort_keys=True))
        print(json.dumps(deterministic_manifest(), indent=2, sort_keys=True))
        return
    if args.print_plan:
        r5.r4.r3.write_new(run_plan(), args.output)
        return
    if args.run:
        r5.r4.r3.write_new(
            r5.run_provider(args.env_file, args.approval_file), args.output
        )
        return
    raise SystemExit("Select --self-test, --print-plan, or --run")


if __name__ == "__main__":
    main()
