#!/usr/bin/env python3
"""Retry approved Haiku rows that failed before the message request."""

from __future__ import annotations

import argparse
import importlib.util
import json
from copy import deepcopy
from decimal import Decimal
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent


def load_benchmark() -> Any:
    path = PACKAGE_ROOT / "benchmark.py"
    spec = importlib.util.spec_from_file_location("compact_format_v10", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load benchmark: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


b = load_benchmark()
NETWORK_FAILURE_PREFIXES = (
    "URLError: <urlopen error [Errno 60] Operation timed out>",
    "URLError: <urlopen error [Errno 8] nodename nor servname provided, or not known>",
)
BASE_TOKEN_COUNT_ATTEMPTS = 189


def row_key(row: dict[str, Any]) -> tuple[str, str, int, bool]:
    return row["arm"], row["family"], row["variant"], row["sentinel"]


def target_key(row: dict[str, Any]) -> tuple[str, str, int, bool]:
    return row["arm"], row["family"], row["variant"], row["sentinel"]


def load_approval(path: Path, source: dict[str, Any]) -> dict[str, Any]:
    value = json.loads(path.read_text())
    expected_targets = [
        {
            "arm": row["arm"],
            "family": row["family"],
            "variant": row["variant"],
            "sentinel": row["sentinel"],
        }
        for row in source["results"]
        if row["initial"]["kind"] == "failed"
        and str(row["initial"].get("reason", "")).startswith(NETWORK_FAILURE_PREFIXES)
    ]
    if (
        value.get("status") != "approved"
        or not str(value.get("operator_statement", "")).strip()
        or value.get("run_id") != b.RUN_ID
        or value.get("protocol_sha256") != source["protocol_sha256"]
        or value.get("provider") != "claude-haiku"
        or value.get("source_manifest_sha256") != source["manifest_sha256"]
        or value.get("targets") != expected_targets
        or value.get("maximum_message_requests") != len(expected_targets)
        or value.get("maximum_token_count_requests") != len(expected_targets)
        or Decimal(str(value.get("incremental_cost_limit_usd")))
        != Decimal(len(expected_targets)) * b.maximum_call_cost("claude-haiku")
    ):
        raise ValueError("The network-retry approval does not match the source failures")
    return value


def seed_guard(source: dict[str, Any]) -> Any:
    guard = b.CostGuard("claude-haiku")
    guard.message_attempts = source["actual_calls"]
    guard.token_count_requests = BASE_TOKEN_COUNT_ATTEMPTS
    guard.settled_cost = Decimal(str(source["cost_guard"]["settled_exact_usd"]))
    guard.committed_cost = Decimal(str(source["cost_guard"]["committed_exact_usd"]))
    guard.failed_reservations = source["cost_guard"]["failed_reservations"]
    return guard


def retry(
    source_path: Path,
    approval_path: Path,
    env_path: Path,
) -> tuple[dict[str, Any], dict[str, Any]]:
    source = b.load_manifest(source_path)
    approval = load_approval(approval_path, source)
    environment = b.transport.load_env(env_path)
    missing = [name for name in b.KEYS.values() if not environment.get(name)]
    if missing:
        raise ValueError(f"Provider credential preflight failed: {','.join(missing)}")
    jobs = {row_key(job): job for job in b.jobs()}
    source_rows = {row_key(row): row for row in source["results"]}
    guard = seed_guard(source)
    original_token_limit = b.MAXIMUM_TOKEN_COUNT_REQUESTS
    b.MAXIMUM_TOKEN_COUNT_REQUESTS = (
        BASE_TOKEN_COUNT_ATTEMPTS + approval["maximum_token_count_requests"]
    )
    retry_rows = []
    try:
        for target in approval["targets"]:
            key = target_key(target)
            job = jobs[key]
            previous = source_rows[key]
            prompt = b.core.prompt_for(job["arm"], job["task"])
            try:
                state, call = b.one_call(
                    "claude-haiku",
                    environment[b.KEYS["claude-haiku"]],
                    prompt,
                    job["task"],
                    job["arm"],
                    "initial",
                    guard,
                )
            except Exception as error:
                state = b.core.result_state(
                    "failed", reason=f"{type(error).__name__}: {error}"
                )
                call = None
            retry_rows.append(
                {
                    **target,
                    "task_sha256": previous["task_sha256"],
                    "semantic_sha256": previous["semantic_sha256"],
                    "previous_reason": previous["initial"]["reason"],
                    "initial": state,
                    "initial_call": call,
                }
            )
    finally:
        b.MAXIMUM_TOKEN_COUNT_REQUESTS = original_token_limit
    retry_calls = [row["initial_call"] for row in retry_rows if row["initial_call"]]
    supplement = {
        "schema": b.SCHEMA,
        "run_kind": "paired-development-network-retry",
        "run_id": b.RUN_ID,
        "provider": "claude-haiku",
        "protocol_sha256": source["protocol_sha256"],
        "source_manifest_sha256": source["manifest_sha256"],
        "approval": approval,
        "results": retry_rows,
        "actual_message_requests": len(retry_calls),
        "actual_token_count_requests": len(approval["targets"]),
        "actual_cost_usd": b.rounded_usd(
            sum(
                (Decimal(str(call["cost_usd"]["total"])) for call in retry_calls),
                Decimal(0),
            )
        ),
        "complete": all(row["initial_call"] is not None for row in retry_rows),
    }
    supplement["manifest_sha256"] = b.core.digest(supplement)
    merged = deepcopy(source)
    merged_rows = {row_key(row): row for row in merged["results"]}
    for row in retry_rows:
        target = merged_rows[row_key(row)]
        target["initial"] = row["initial"]
        target["initial_call"] = row["initial_call"]
    calls = [
        call
        for row in merged["results"]
        for call in (row.get("initial_call"), row.get("repair_call"))
        if call is not None
    ]
    actual = sum(
        (Decimal(str(call["cost_usd"]["total"])) for call in calls), Decimal(0)
    )
    eligible_repairs = sum(b.repair_eligible(row) for row in merged["results"])
    attempted_repairs = sum(
        row.get("repair") is not None for row in merged["results"]
    )
    merged.update(
        {
            "source_manifest_sha256": source["manifest_sha256"],
            "network_retry_manifest_sha256": supplement["manifest_sha256"],
            "network_retry_approval": approval,
            "actual_calls": guard.message_attempts,
            "completed_calls": len(calls),
            "actual_cost_usd": b.rounded_usd(actual),
            "cost_guard": guard.snapshot(),
            "repair_accounting": {
                "eligible": eligible_repairs,
                "attempted": attempted_repairs,
                "skipped_by_cap": eligible_repairs - attempted_repairs,
            },
            "complete": source["complete"] and supplement["complete"],
        }
    )
    merged["raw_run_sha256"] = b.core.digest(
        [call["raw_response_sha256"] for call in calls]
    )
    merged.pop("manifest_sha256", None)
    merged["manifest_sha256"] = b.core.digest(merged)
    return supplement, merged


def write_new(path: Path, value: dict[str, Any]) -> None:
    if path.exists():
        raise FileExistsError(f"Refusing to replace: {path}")
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--approval", type=Path, required=True)
    parser.add_argument("--env-file", type=Path, default=PACKAGE_ROOT.parents[2] / ".env")
    parser.add_argument("--supplement-output", type=Path, required=True)
    parser.add_argument("--merged-output", type=Path, required=True)
    args = parser.parse_args()
    supplement, merged = retry(args.source, args.approval, args.env_file)
    write_new(args.supplement_output, supplement)
    write_new(args.merged_output, merged)


if __name__ == "__main__":
    main()
