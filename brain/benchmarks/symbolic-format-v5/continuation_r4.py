#!/usr/bin/env python3
"""Resume the v5 Claude continuation after its transient HTTP 503."""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from copy import deepcopy
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
R3_PATH = PACKAGE_ROOT / "continuation.py"
RUNS_ROOT = PACKAGE_ROOT / "runs"
SOURCE_PATH = RUNS_ROOT / "2026-09-29-claude-haiku-continuation-r3.json"
APPROVAL_PATH = RUNS_ROOT / "full-matrix-continuation-r4-approval.json"
SCHEMA = "ghostnote-symbolic-format-v5-continuation-v4"
RUN_ID = "phase8c4f-eight-arm-full-matrix-continuation-r4"
PROVIDER = "claude-haiku"
PROVIDERS = (PROVIDER,)
SETTINGS = {
    PROVIDER: {
        "thinking": {"type": "enabled", "budget_tokens": 1024},
        "max_tokens": 24000,
    }
}
ESTIMATE = {PROVIDER: Decimal("5.100000")}
LIMITS = {PROVIDER: Decimal("6.800000")}
MAXIMUM_TOTAL_COST = Decimal("6.800000")
RETAINED_GEMINI_COST = Decimal("0.1151175")
RETAINED_CLAUDE_COST = Decimal("1.175156")
CONTINUATION_TOTAL_LIMIT = Decimal("8.200000")


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


r3 = load_module("ghostnote_symbolic_format_v5_continuation_r4_r3", R3_PATH)
m = r3.m


@lru_cache(maxsize=1)
def source_run() -> dict[str, Any]:
    value = json.loads(SOURCE_PATH.read_text())
    unsigned = deepcopy(value)
    claimed = unsigned.pop("manifest_sha256", None)
    if claimed != m.core.digest(unsigned):
        raise ValueError("The r3 source manifest hash is invalid")
    return value


@lru_cache(maxsize=None)
def pending_jobs(provider: str) -> tuple[dict[str, Any], ...]:
    if provider != PROVIDER:
        raise ValueError(f"Unknown continuation provider: {provider}")
    source = source_run()
    by_sequence = {
        row["planned_sequence"]: row for row in source["results"]
    }
    selected = []
    for job in m.jobs(provider):
        row = by_sequence.get(job["planned_sequence"])
        if row is None:
            continue
        kind = row["initial"]["kind"]
        if kind == "not-attempted" or (
            job["planned_sequence"] == 195 and kind == "failed"
        ):
            selected.append(job)
    return tuple(selected)


def maximum_call_cost() -> Decimal:
    prices = m.base.PRICES_USD_PER_MILLION[PROVIDER]
    return (
        Decimal(m.base.INPUT_TOKEN_CEILING)
        * m.base.decimal_rate(prices["input"])
        + Decimal(SETTINGS[PROVIDER]["max_tokens"])
        * m.base.decimal_rate(prices["output"])
    )


def protocol_manifest() -> dict[str, Any]:
    source = source_run()
    pending = pending_jobs(PROVIDER)
    value = {
        "schema": SCHEMA,
        "run_kind": "eight-arm-full-matrix-continuation-protocol",
        "run_id": RUN_ID,
        "package_files": {
            "continuation.py": m.base.file_sha256(R3_PATH),
            "continuation_r4.py": m.base.file_sha256(Path(__file__)),
            "assessment.py": m.base.file_sha256(PACKAGE_ROOT / "assessment.py"),
        },
        "source_manifest_sha256": {
            PROVIDER: source["manifest_sha256"]
        },
        "source_assessment_sha256": source["source_assessment_sha256"],
        "providers": [PROVIDER],
        "models": {PROVIDER: m.MODELS[PROVIDER]},
        "effective_request_settings": SETTINGS,
        "pending": {
            PROVIDER: {
                "calls": len(pending),
                "original_planned_sequence_range": [
                    pending[0]["planned_sequence"],
                    pending[-1]["planned_sequence"],
                ],
                "original_planned_sequences_sha256": m.core.digest(
                    [job["planned_sequence"] for job in pending]
                ),
                "schedule_sha256": m.core.digest(
                    [
                        {
                            "planned_sequence": job["planned_sequence"],
                            "arm": job["arm"],
                            "family": job["family"],
                            "variant": job["variant"],
                            "repeat": job["repeat"],
                            "task_sha256": job["task"]["sha256"],
                            "prompt_sha256": m.core.sha256_text(
                                m.engine.prompt_for(job)
                            ),
                        }
                        for job in pending
                    ]
                ),
            }
        },
        "explicit_repeat": {
            "original_planned_sequence": 195,
            "source_reason": "HTTPError: HTTP Error 503: Service Unavailable",
        },
        "stopping_rule": {
            "transport_failure": 1,
            "budget_stop": 1,
            "unavailable_response": "retain and continue",
            "automatic_retries": 0,
            "repairs": 0,
        },
        "cost_guard": {
            "estimate_usd": {PROVIDER: float(ESTIMATE[PROVIDER])},
            "estimate_total_usd": float(ESTIMATE[PROVIDER]),
            "maximum_call_cost_usd": {
                PROVIDER: m.base.exact_usd(maximum_call_cost())
            },
            "maximum_provider_cost_usd": {
                PROVIDER: float(LIMITS[PROVIDER])
            },
            "maximum_total_cost_usd": float(MAXIMUM_TOTAL_COST),
            "retained_continuation_cost_usd": {
                "gemini": float(RETAINED_GEMINI_COST),
                PROVIDER: float(RETAINED_CLAUDE_COST),
            },
            "cumulative_continuation_hard_limit_usd": float(
                CONTINUATION_TOTAL_LIMIT
            ),
        },
        "approval": "pending",
    }
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
    source = source_run()
    pending = pending_jobs(PROVIDER)
    selected = {job["planned_sequence"] for job in pending}
    checks = {
        "source-plan": source["run_plan_sha256"]
        == "716ed92d76f46683af1219baa4764e81f2383a62c428d05f8a7b9f5b91f0ea0f",
        "source-progress": source["progress"]
        == {
            "planned": 457,
            "attempted": 60,
            "provider_completed": 59,
            "available": 57,
            "scored": 57,
            "failed": 1,
            "unavailable": 2,
            "budget_stopped": 0,
        },
        "pending-count": len(pending) == 398,
        "failed-503-selected": 195 in selected,
        "retained-outcomes-excluded": all(
            row["planned_sequence"] not in selected
            for row in source["results"]
            if row["initial"]["kind"] in {"initial", "unavailable"}
        ),
        "only-expected-states": all(
            row["initial"]["kind"] in {"failed", "not-attempted"}
            for row in source["results"]
            if row["planned_sequence"] in selected
        ),
        "claude-output-limit": SETTINGS[PROVIDER]["max_tokens"] == 24000,
        "claude-thinking-target": SETTINGS[PROVIDER]["thinking"]
        == {"type": "enabled", "budget_tokens": 1024},
        "cost-headroom": ESTIMATE[PROVIDER] + maximum_call_cost()
        <= LIMITS[PROVIDER],
        "cumulative-cost-bound": (
            RETAINED_GEMINI_COST + RETAINED_CLAUDE_COST + LIMITS[PROVIDER]
            <= CONTINUATION_TOTAL_LIMIT
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
        "pending_calls": {PROVIDER: len(pending_jobs(PROVIDER))},
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
        raise ValueError("Approval does not match the r4 continuation plan")
    if value.get("status") != "approved" or not value.get(
        "operator_statement", ""
    ).strip():
        raise ValueError("Approval needs an explicit operator statement")
    return value


def configure_r3() -> None:
    r3.SCHEMA = SCHEMA
    r3.RUN_ID = RUN_ID
    r3.PROVIDERS = PROVIDERS
    r3.APPROVAL_PATH = APPROVAL_PATH
    r3.SETTINGS = SETTINGS
    r3.ESTIMATE = ESTIMATE
    r3.LIMITS = LIMITS
    r3.MAXIMUM_TOTAL_COST = MAXIMUM_TOTAL_COST
    r3.pending_jobs = pending_jobs
    r3.protocol_manifest = protocol_manifest
    r3.run_plan = run_plan
    r3.deterministic_screen = deterministic_screen
    r3.deterministic_manifest = deterministic_manifest
    r3.validate_approval = validate_approval


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
    configure_r3()
    if args.self_test:
        screen = deterministic_screen()
        if not screen["all_checks_pass"]:
            raise SystemExit(json.dumps(screen, indent=2, sort_keys=True))
        print(json.dumps(deterministic_manifest(), indent=2, sort_keys=True))
        return
    if args.print_plan:
        r3.write_new(run_plan(), args.output)
        return
    if args.run:
        r3.write_new(
            r3.run_provider(PROVIDER, args.env_file, args.approval_file),
            args.output,
        )
        return
    raise SystemExit("Select --self-test, --print-plan, or --run")


if __name__ == "__main__":
    main()
