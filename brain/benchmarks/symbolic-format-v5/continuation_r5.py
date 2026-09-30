#!/usr/bin/env python3
"""Resume the v5 Claude continuation with bounded HTTP 503 retries."""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
import time
import urllib.error
from copy import deepcopy
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
R4_PATH = PACKAGE_ROOT / "continuation_r4.py"
RUNS_ROOT = PACKAGE_ROOT / "runs"
SOURCE_PATH = RUNS_ROOT / "2026-09-29-claude-haiku-continuation-r4.json"
APPROVAL_PATH = RUNS_ROOT / "full-matrix-continuation-r5-approval.json"
SCHEMA = "ghostnote-symbolic-format-v5-continuation-v5"
RUN_ID = "phase8c4f-eight-arm-full-matrix-continuation-r5"
PROVIDER = "claude-haiku"
MAXIMUM_503_RETRIES = 2


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


r4 = load_module("ghostnote_symbolic_format_v5_continuation_r5_r4", R4_PATH)
m = r4.m
R4_PROTOCOL_MANIFEST = r4.protocol_manifest


def configure_source() -> None:
    r4.SOURCE_PATH = SOURCE_PATH
    r4.APPROVAL_PATH = APPROVAL_PATH
    r4.SCHEMA = SCHEMA
    r4.RUN_ID = RUN_ID
    r4.source_run.cache_clear()
    r4.pending_jobs.cache_clear()


configure_source()


def protocol_manifest() -> dict[str, Any]:
    value = R4_PROTOCOL_MANIFEST()
    value["package_files"]["continuation_r5.py"] = m.base.file_sha256(
        Path(__file__)
    )
    value["stopping_rule"] = {
        "transport_failure": (
            "Stop on a non-503 error or the third HTTP 503 for one request."
        ),
        "http_503_retries_per_request": MAXIMUM_503_RETRIES,
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
    source = r4.source_run()
    pending = r4.pending_jobs(PROVIDER)
    selected = {job["planned_sequence"] for job in pending}
    checks = {
        "source-plan": source["run_plan_sha256"]
        == "5fe41940c5a76d42cc1de74c2892c19062fe2e434d070fcb7fb68bc41a6c55ca",
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
        "claude-output-limit": r4.SETTINGS[PROVIDER]["max_tokens"]
        == 24000,
        "claude-thinking-target": r4.SETTINGS[PROVIDER]["thinking"]
        == {"type": "enabled", "budget_tokens": 1024},
        "retry-bound": MAXIMUM_503_RETRIES == 2,
        "cost-headroom": r4.ESTIMATE[PROVIDER] + r4.maximum_call_cost()
        <= r4.LIMITS[PROVIDER],
        "cumulative-cost-bound": (
            r4.RETAINED_GEMINI_COST
            + r4.RETAINED_CLAUDE_COST
            + r4.LIMITS[PROVIDER]
            <= r4.CONTINUATION_TOTAL_LIMIT
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
        "pending_calls": {PROVIDER: len(r4.pending_jobs(PROVIDER))},
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
        raise ValueError("Approval does not match the r5 continuation plan")
    if value.get("status") != "approved" or not value.get(
        "operator_statement", ""
    ).strip():
        raise ValueError("Approval needs an explicit operator statement")
    return value


def configure_runtime() -> None:
    configure_source()
    r4.protocol_manifest = protocol_manifest
    r4.run_plan = run_plan
    r4.deterministic_screen = deterministic_screen
    r4.deterministic_manifest = deterministic_manifest
    r4.validate_approval = validate_approval
    r4.configure_r3()


def run_provider(env_file: Path, approval_file: Path) -> dict[str, Any]:
    configure_runtime()
    retry_events: list[dict[str, Any]] = []
    logical_requests = {"token-count": 0, "message": 0}
    original = m.v14.transport.post_json

    def post_json(url: str, headers: dict[str, str], payload: dict[str, Any]) -> Any:
        endpoint = "token-count" if url.endswith("/count_tokens") else "message"
        logical_requests[endpoint] += 1
        logical_index = logical_requests[endpoint]
        for retry in range(MAXIMUM_503_RETRIES + 1):
            try:
                return original(url, headers, payload)
            except urllib.error.HTTPError as error:
                if error.code != 503 or retry == MAXIMUM_503_RETRIES:
                    raise
                delay = 2 ** (retry + 1)
                retry_events.append(
                    {
                        "endpoint": endpoint,
                        "logical_request": logical_index,
                        "retry": retry + 1,
                        "delay_seconds": delay,
                        "status": 503,
                    }
                )
                time.sleep(delay)
        raise AssertionError("The bounded retry loop did not return or raise")

    m.v14.transport.post_json = post_json
    try:
        value = r4.r3.run_provider(PROVIDER, env_file, approval_file)
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
            value["results"][index - 1]["http_503_retries"] = retries
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
        r4.r3.write_new(run_plan(), args.output)
        return
    if args.run:
        r4.r3.write_new(
            run_provider(args.env_file, args.approval_file), args.output
        )
        return
    raise SystemExit("Select --self-test, --print-plan, or --run")


if __name__ == "__main__":
    main()
