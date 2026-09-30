#!/usr/bin/env python3
"""Resume Claude with bounded retries for transient endpoint failures."""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
import time
import urllib.error
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
R7_PATH = PACKAGE_ROOT / "continuation_r7.py"
RUNS_ROOT = PACKAGE_ROOT / "runs"
SOURCE_PATH = RUNS_ROOT / "2026-09-30-claude-haiku-continuation-r7.json"
APPROVAL_PATH = RUNS_ROOT / "full-matrix-continuation-r8-approval.json"
SCHEMA = "ghostnote-symbolic-format-v5-continuation-v8"
RUN_ID = "phase8c4f-eight-arm-full-matrix-continuation-r8"
PROVIDER = "claude-haiku"
ESTIMATE = Decimal("3.300000")
LIMIT = Decimal("4.475808")
RETAINED_GEMINI_COST = Decimal("0.1151175")
RETAINED_CLAUDE_COST = Decimal("3.499348")
CONTINUATION_TOTAL_LIMIT = Decimal("8.200000")
MAXIMUM_TRANSIENT_RETRIES = 2


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


r7 = load_module("ghostnote_symbolic_format_v5_continuation_r8_r7", R7_PATH)
r5 = r7.r5
m = r7.m
R7_PROTOCOL_MANIFEST = r7.protocol_manifest


@lru_cache(maxsize=None)
def pending_jobs(provider: str) -> tuple[dict[str, Any], ...]:
    if provider != PROVIDER:
        raise ValueError(f"Unknown continuation provider: {provider}")
    source = r5.r4.source_run()
    by_sequence = {
        row["planned_sequence"]: row for row in source["results"]
    }
    return tuple(
        job
        for job in m.jobs(provider)
        if job["planned_sequence"] in by_sequence
        and by_sequence[job["planned_sequence"]]["initial"]["kind"]
        in {"failed", "not-attempted"}
    )


def configure_source() -> None:
    r5.SOURCE_PATH = SOURCE_PATH
    r5.APPROVAL_PATH = APPROVAL_PATH
    r5.SCHEMA = SCHEMA
    r5.RUN_ID = RUN_ID
    r5.configure_source()
    r5.r4.pending_jobs = pending_jobs
    r5.r4.ESTIMATE = {PROVIDER: ESTIMATE}
    r5.r4.LIMITS = {PROVIDER: LIMIT}
    r5.r4.MAXIMUM_TOTAL_COST = LIMIT
    r5.r4.RETAINED_GEMINI_COST = RETAINED_GEMINI_COST
    r5.r4.RETAINED_CLAUDE_COST = RETAINED_CLAUDE_COST
    r5.r4.CONTINUATION_TOTAL_LIMIT = CONTINUATION_TOTAL_LIMIT


configure_source()


def protocol_manifest() -> dict[str, Any]:
    value = R7_PROTOCOL_MANIFEST()
    value["package_files"]["continuation_r8.py"] = m.base.file_sha256(
        Path(__file__)
    )
    value["explicit_repeat"] = {
        "original_planned_sequence": 341,
        "source_reason": "TimeoutError: The read operation timed out",
    }
    value["stopping_rule"] = {
        "transport_failure": (
            "Stop on the third transient failure for one endpoint request or "
            "on the first other transport failure."
        ),
        "transient_retries_per_request": MAXIMUM_TRANSIENT_RETRIES,
        "transient_failures": ["HTTP 503", "TimeoutError"],
        "retry_delays_seconds": [2, 4],
        "budget_stop": 1,
        "unavailable_response": "retain and continue",
        "repairs": 0,
    }
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
    pending = pending_jobs(PROVIDER)
    selected = {job["planned_sequence"] for job in pending}
    checks = {
        "source-manifest": source["manifest_sha256"]
        == "b7a28f1dfb9e884f5dd6eedbcab4dcee24b96e22bf647e5defbfd44244405eea",
        "source-plan": source["run_plan_sha256"]
        == "181bbe82face0c45a4c3b5258a6a5758ff910edd35343c15862d59ab16fbdacb",
        "source-progress": source["progress"]
        == {
            "planned": 253,
            "attempted": 1,
            "provider_completed": 1,
            "available": 1,
            "scored": 1,
            "failed": 1,
            "unavailable": 0,
            "budget_stopped": 0,
        },
        "pending-count": len(pending) == 252,
        "failed-timeout-selected": 341 in selected,
        "scored-rows-excluded": all(
            row["planned_sequence"] not in selected
            for row in source["results"]
            if row["initial"]["kind"] == "initial"
        ),
        "original-sequence-order": [
            job["planned_sequence"] for job in pending
        ]
        == list(range(341, 593)),
        "claude-output-limit": r5.r4.SETTINGS[PROVIDER]["max_tokens"]
        == 24000,
        "claude-thinking-target": r5.r4.SETTINGS[PROVIDER]["thinking"]
        == {"type": "enabled", "budget_tokens": 1024},
        "retry-bound": MAXIMUM_TRANSIENT_RETRIES == 2,
        "cost-headroom": ESTIMATE + r5.r4.maximum_call_cost() <= LIMIT,
        "cumulative-cost-bound": (
            RETAINED_GEMINI_COST + RETAINED_CLAUDE_COST + LIMIT
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
        raise ValueError("Approval does not match the r8 continuation plan")
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


def run_provider(env_file: Path, approval_file: Path) -> dict[str, Any]:
    configure_runtime()
    retry_events: list[dict[str, Any]] = []
    logical_requests = {"token-count": 0, "message": 0}
    original = m.v14.transport.post_json

    def post_json(url: str, headers: dict[str, str], payload: dict[str, Any]) -> Any:
        endpoint = "token-count" if url.endswith("/count_tokens") else "message"
        logical_requests[endpoint] += 1
        logical_index = logical_requests[endpoint]
        for retry in range(MAXIMUM_TRANSIENT_RETRIES + 1):
            try:
                return original(url, headers, payload)
            except (TimeoutError, urllib.error.HTTPError) as error:
                is_transient = isinstance(error, TimeoutError) or error.code == 503
                if not is_transient or retry == MAXIMUM_TRANSIENT_RETRIES:
                    raise
                delay = 2 ** (retry + 1)
                retry_events.append(
                    {
                        "endpoint": endpoint,
                        "logical_request": logical_index,
                        "retry": retry + 1,
                        "delay_seconds": delay,
                        "reason": type(error).__name__,
                        "status": getattr(error, "code", None),
                    }
                )
                time.sleep(delay)
        raise AssertionError("The bounded retry loop did not return or raise")

    m.v14.transport.post_json = post_json
    try:
        value = r5.r4.r3.run_provider(PROVIDER, env_file, approval_file)
    finally:
        m.v14.transport.post_json = original
    by_index: dict[int, dict[str, int]] = {}
    for event in retry_events:
        current = by_index.setdefault(
            event["logical_request"], {"token-count": 0, "message": 0}
        )
        current[event["endpoint"]] += 1
    for index, retries in by_index.items():
        if index <= len(value["results"]):
            value["results"][index - 1]["transient_retries"] = retries
    value["transport_retry_events"] = retry_events
    value["manifest_sha256"] = m.core.digest(
        {name: item for name, item in value.items() if name != "manifest_sha256"}
    )
    return value


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
            run_provider(args.env_file, args.approval_file), args.output
        )
        return
    raise SystemExit("Select --self-test, --print-plan, or --run")


if __name__ == "__main__":
    main()
