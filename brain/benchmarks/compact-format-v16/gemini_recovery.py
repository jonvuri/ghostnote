#!/usr/bin/env python3
"""Recover the stopped v16 Gemini run under an approved supplement."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
import sys
import time
import urllib.error
from copy import deepcopy
from decimal import Decimal
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARK_PATH = PACKAGE_ROOT / "benchmark.py"
PROVIDER = "gemini"
ADDED_ATTEMPTS = 1
CUMULATIVE_ATTEMPTS = 67


def load_benchmark() -> Any:
    spec = importlib.util.spec_from_file_location(
        "ghostnote_compact_format_v16_recovery", BENCHMARK_PATH
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {BENCHMARK_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


m = load_benchmark()


class ProviderHttpError(RuntimeError):
    """Retain safe provider HTTP error evidence."""

    def __init__(self, evidence: dict[str, Any]) -> None:
        super().__init__(m.core.canonical(evidence))
        self.evidence = evidence


def unsigned_digest(value: dict[str, Any], field: str) -> str:
    unsigned = deepcopy(value)
    unsigned.pop(field, None)
    return m.core.digest(unsigned)


def safe_http_evidence(
    status_code: int,
    body: bytes,
    headers: dict[str, str],
) -> dict[str, Any]:
    body_sha256 = hashlib.sha256(body).hexdigest()
    provider_status = None
    provider_reason = None
    message = None
    try:
        parsed = json.loads(body)
        error = parsed.get("error", {}) if isinstance(parsed, dict) else {}
        if isinstance(error, dict):
            provider_status = error.get("status")
            message = error.get("message")
            details = error.get("details", [])
            if isinstance(details, list):
                provider_reason = next(
                    (
                        detail.get("reason")
                        for detail in details
                        if isinstance(detail, dict)
                        and isinstance(detail.get("reason"), str)
                    ),
                    None,
                )
    except (json.JSONDecodeError, UnicodeDecodeError):
        pass
    if isinstance(message, str):
        for value in headers.values():
            if value:
                message = message.replace(value, "[REDACTED]")
        message = re.sub(r"AIza[0-9A-Za-z_-]+", "[REDACTED]", message)
        message = message[:500]
    return {
        "http_status": status_code,
        "provider_status": provider_status,
        "provider_reason": provider_reason,
        "message": message,
        "body_bytes": len(body),
        "body_sha256": body_sha256,
    }


def post_json_with_error_evidence(
    url: str, headers: dict[str, str], payload: dict[str, Any]
) -> dict[str, Any]:
    try:
        return ORIGINAL_POST_JSON(url, headers, payload)
    except urllib.error.HTTPError as error:
        body = error.read(65_536)
        raise ProviderHttpError(
            safe_http_evidence(error.code, body, headers)
        ) from error


ORIGINAL_POST_JSON = m.transport.post_json


def validate_supplement(
    path: Path,
    partial: dict[str, Any],
    partial_path: Path,
    require_approved: bool,
) -> dict[str, Any]:
    value = json.loads(path.read_text())
    first = partial["results"][0]
    expected = {
        "schema": "ghostnote-compact-format-v16-recovery-supplement-v1",
        "run_id": m.RUN_ID,
        "provider": PROVIDER,
        "protocol_sha256": partial["protocol_sha256"],
        "run_plan_sha256": partial["run_plan_sha256"],
        "cohort_sha256": partial["cohort_sha256"],
        "candidate_sha256": partial["candidate_sha256"],
        "source_manifest_sha256": partial["manifest_sha256"],
        "source_file_sha256": m.base.file_sha256(partial_path),
        "recovery_code_sha256": m.base.file_sha256(Path(__file__)),
        "repeated_planned_sequence": 1,
        "repeated_task_sha256": first["task_sha256"],
        "repeated_candidate_sha256": first["candidate_sha256"],
        "maximum_added_message_attempts": ADDED_ATTEMPTS,
        "maximum_cumulative_message_attempts": CUMULATIVE_ATTEMPTS,
        "carried_failed_reservation_usd": 0.054,
        "maximum_cumulative_cost_usd": 0.65,
    }
    if value.get("sha256") != unsigned_digest(value, "sha256"):
        raise ValueError("The recovery supplement hash is invalid")
    if any(value.get(name) != item for name, item in expected.items()):
        raise ValueError("The recovery supplement does not match the stopped run")
    if require_approved and (
        value.get("status") != "approved"
        or not isinstance(value.get("operator_statement"), str)
        or not value["operator_statement"].strip()
    ):
        raise ValueError("The recovery supplement needs explicit approval")
    return value


def restore_guard(partial: dict[str, Any]) -> Any:
    source = partial["cost_guard"]
    guard = m.v14.CostGuard(PROVIDER)
    guard.message_attempts = source["message_attempts"]
    guard.token_count_attempts = source["token_count_attempts"]
    guard.settled_cost = Decimal(str(source["settled_exact_usd"]))
    guard.committed_cost = Decimal(str(source["committed_exact_usd"]))
    guard.failed_reservations = source["failed_reservations"]
    return guard


def progress(rows: list[dict[str, Any]]) -> dict[str, int]:
    values = m.v14.denominator_summary(rows)
    return {
        name: values[name]
        for name in (
            "planned",
            "attempted",
            "provider_completed",
            "available",
            "scored",
            "failed",
            "unavailable",
            "budget_stopped",
        )
    }


def result_row(
    job: dict[str, Any],
    initial: dict[str, Any],
    call: dict[str, Any] | None,
    attempted: bool,
    provider_completed: bool,
    budget_stopped: bool,
    started_sequence: int,
    completed_sequence: int,
    transport_error: dict[str, Any] | None,
) -> dict[str, Any]:
    return {
        "planned_sequence": job["planned_sequence"],
        "started_sequence": started_sequence if attempted else None,
        "completed_sequence": completed_sequence if provider_completed else None,
        "arm": job["arm"],
        "candidate_sha256": m.v15.candidate_hashes()[job["arm"]],
        "family": job["family"],
        "difficulty": m.task_difficulty(job["task"]),
        "variant": job["variant"],
        "repeat": job["repeat"],
        "task_sha256": job["task"]["sha256"],
        "semantic_sha256": job["task"]["semantic_sha256"],
        "attempted": attempted,
        "provider_completed": provider_completed,
        "budget_stopped": budget_stopped,
        "initial": initial,
        "initial_call": call,
        "transport_error": transport_error,
        "repair": None,
        "repair_call": None,
    }


def execute_recovery(
    key: str, partial: dict[str, Any]
) -> tuple[list[dict[str, Any]], Any]:
    schedule = m.v14.jobs(PROVIDER)
    guard = restore_guard(partial)
    results = []
    stop_reason = None
    started_sequence = 0
    completed_sequence = 0
    unavailable = 0
    for job in schedule:
        if stop_reason is not None:
            row = m.v14.not_attempted_row(job, stop_reason)
            row["difficulty"] = m.task_difficulty(job["task"])
            row["transport_error"] = None
            results.append(row)
            continue
        before_attempts = guard.message_attempts
        before_token_counts = guard.token_count_attempts
        transport_error = None
        try:
            initial, call = m.v15.one_call(PROVIDER, key, job, guard)
            attempted = guard.message_attempts > before_attempts
            started_sequence += int(attempted)
            completed_sequence += 1
            provider_completed = True
            budget_stopped = False
        except Exception as error:
            attempted = guard.message_attempts > before_attempts
            started_sequence += int(attempted)
            provider_completed = isinstance(error, m.v14.ProviderCompletedError)
            completed_sequence += int(provider_completed)
            budget_stopped = isinstance(error, m.v14.CostBudgetExceeded)
            transport_error = (
                error.evidence if isinstance(error, ProviderHttpError) else None
            )
            initial = m.core.result_state(
                "failed", reason=f"{type(error).__name__}: {error}"
            )
            call = error.call if provider_completed else None
            if budget_stopped:
                stop_reason = "budget-stop"
            elif provider_completed:
                stop_reason = "provider-completed-validation-failure"
            elif guard.token_count_attempts > before_token_counts and not attempted:
                stop_reason = "token-count-failure"
            else:
                stop_reason = "transport-failure"
        unavailable += int(initial["kind"] == "unavailable")
        if unavailable >= 3:
            stop_reason = "unavailable-stop"
        results.append(
            result_row(
                job,
                initial,
                call,
                attempted,
                provider_completed,
                budget_stopped,
                started_sequence,
                completed_sequence,
                transport_error,
            )
        )
        counters = progress(results)
        print(
            f"{PROVIDER}: planned={m.MAXIMUM_CALLS} "
            f"attempted={counters['attempted']} "
            f"provider-completed={counters['provider_completed']} "
            f"failed={counters['failed']} unavailable={counters['unavailable']} "
            f"budget-stopped={counters['budget_stopped']}",
            file=sys.stderr,
            flush=True,
        )
    return results, guard


def calls_for(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [row["initial_call"] for row in rows if row.get("initial_call")]


def validate_recovered(
    value: dict[str, Any],
    partial: dict[str, Any],
    supplement: dict[str, Any],
) -> dict[str, Any]:
    if value.get("manifest_sha256") != unsigned_digest(value, "manifest_sha256"):
        raise ValueError("The recovered manifest hash is invalid")
    immutable = (
        "schema",
        "run_kind",
        "run_id",
        "provider",
        "cohort",
        "cohort_sha256",
        "candidate_sha256",
        "requested_model",
        "declared_settings",
        "effective_request_settings",
        "protocol_sha256",
        "screen_sha256",
        "run_plan_sha256",
        "schedule_sha256",
        "approval",
    )
    if any(value.get(name) != partial.get(name) for name in immutable):
        raise ValueError("The recovered manifest changed a frozen identity")
    if value.get("recovered_from_manifest_sha256") != partial["manifest_sha256"]:
        raise ValueError("The recovered manifest has the wrong source")
    if value.get("recovery_supplement") != supplement:
        raise ValueError("The recovered manifest has the wrong supplement")
    rows = value.get("results", [])
    expected = m.v14.jobs(PROVIDER)
    actual_identity = [
        (
            row.get("planned_sequence"),
            row.get("arm"),
            row.get("family"),
            row.get("variant"),
            row.get("repeat"),
            row.get("task_sha256"),
            row.get("difficulty"),
        )
        for row in rows
    ]
    expected_identity = [
        (
            job["planned_sequence"],
            job["arm"],
            job["family"],
            job["variant"],
            job["repeat"],
            job["task"]["sha256"],
            m.task_difficulty(job["task"]),
        )
        for job in expected
    ]
    if actual_identity != expected_identity:
        raise ValueError("The recovered manifest does not match the frozen schedule")
    denominators = progress(rows)
    if value.get("progress") != denominators:
        raise ValueError("The recovered progress counters do not reconcile")
    calls = calls_for(rows)
    exact_cost = sum(
        (
            Decimal(str(call["cost_usd"]["total"]))
            for call in calls
            if call.get("cost_usd") is not None
        ),
        Decimal(0),
    )
    guard = value.get("cost_guard", {})
    if (
        m.base.rounded_usd(exact_cost) != value.get("actual_cost_usd")
        or m.base.exact_usd(exact_cost) != value.get("actual_cost_exact_usd")
        or m.base.rounded_usd(exact_cost) != guard.get("settled_cost_usd")
        or guard.get("maximum_cost_usd") != 0.65
        or guard.get("committed_cost_usd", 1) > 0.65
        or guard.get("message_attempts") != denominators["attempted"] + 1
        or guard.get("failed_reservations", 0) < 1
        or value.get("raw_run_sha256")
        != m.core.digest([call["raw_response_sha256"] for call in calls])
    ):
        raise ValueError("The recovered cost accounting does not reconcile")
    return value


def run(
    partial_path: Path, supplement_path: Path, env_path: Path
) -> dict[str, Any]:
    partial = m.v15.load_manifest(partial_path)
    supplement = validate_supplement(
        supplement_path, partial, partial_path, require_approved=True
    )
    environment = m.transport.load_env(env_path)
    key = environment.get(m.KEYS[PROVIDER])
    if not key:
        raise ValueError("The Gemini credential preflight failed")
    network = m.v14.network_preflight(PROVIDER)
    for module in (m, m.v15, m.v14):
        module.MAXIMUM_CALLS = CUMULATIVE_ATTEMPTS
    m.transport.post_json = post_json_with_error_evidence
    try:
        rows, guard = execute_recovery(key, partial)
    finally:
        m.transport.post_json = ORIGINAL_POST_JSON
    counters = progress(rows)
    calls = calls_for(rows)
    exact_cost = sum(
        (
            Decimal(str(call["cost_usd"]["total"]))
            for call in calls
            if call.get("cost_usd") is not None
        ),
        Decimal(0),
    )
    value = deepcopy(partial)
    value.update(
        {
            "recovery_network_preflight": network,
            "recovered_from_manifest_sha256": partial["manifest_sha256"],
            "recovery_supplement": supplement,
            "prior_failed_attempt": partial["results"][0],
            "results": rows,
            "progress": counters,
            "actual_cost_usd": m.base.rounded_usd(exact_cost),
            "actual_cost_exact_usd": m.base.exact_usd(exact_cost),
            "cost_guard": guard.snapshot(),
            "complete": counters["provider_completed"] == m.MAXIMUM_CALLS - 1
            and counters["failed"] == 0
            and counters["unavailable"] == 0
            and counters["budget_stopped"] == 0,
            "raw_run_sha256": m.core.digest(
                [call["raw_response_sha256"] for call in calls]
            ),
        }
    )
    value["manifest_sha256"] = unsigned_digest(value, "manifest_sha256")
    return validate_recovered(value, partial, supplement)


def self_test(partial_path: Path, supplement_path: Path) -> dict[str, Any]:
    partial = m.v15.load_manifest(partial_path)
    supplement = validate_supplement(
        supplement_path, partial, partial_path, require_approved=False
    )
    synthetic_key = "AIza" + "x" * 35
    synthetic_body = json.dumps(
        {
            "error": {
                "status": "INVALID_ARGUMENT",
                "message": f"Rejected {synthetic_key}",
                "details": [{"reason": "SYNTHETIC_REASON"}],
            }
        }
    ).encode()
    evidence = safe_http_evidence(
        400, synthetic_body, {"x-goog-api-key": synthetic_key}
    )
    guard = restore_guard(partial).snapshot()
    checks = {
        "source_is_incomplete": not partial["complete"],
        "source_stopped_after_one_attempt": partial["progress"]["attempted"] == 1,
        "source_has_no_provider_completion": partial["progress"]["provider_completed"]
        == 0,
        "source_cost_is_zero": partial["actual_cost_usd"] == 0,
        "failed_reservation_is_carried": guard["committed_cost_usd"] == 0.054,
        "one_added_attempt_is_authorized": supplement[
            "maximum_added_message_attempts"
        ]
        == 1,
        "cost_limit_is_unchanged": supplement["maximum_cumulative_cost_usd"]
        == 0.65,
        "http_status_is_retained": evidence["http_status"] == 400,
        "provider_reason_is_retained": evidence["provider_reason"]
        == "SYNTHETIC_REASON",
        "credential_is_redacted": synthetic_key not in (evidence["message"] or ""),
    }
    value = {
        "schema": "ghostnote-compact-format-v16-recovery-screen-v1",
        "checks": checks,
        "all_pass": all(checks.values()),
        "source_manifest_sha256": partial["manifest_sha256"],
        "supplement_sha256": supplement["sha256"],
        "recovery_code_sha256": m.base.file_sha256(Path(__file__)),
    }
    value["sha256"] = m.core.digest(value)
    return value


def write_new(value: dict[str, Any], output: Path) -> None:
    if output.exists():
        raise FileExistsError(f"Refusing to replace: {output}")
    output.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--partial", type=Path, required=True)
    parser.add_argument("--supplement", type=Path, required=True)
    parser.add_argument(
        "--env-file", type=Path, default=PACKAGE_ROOT.parents[2] / ".env"
    )
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--check-recovered", type=Path)
    args = parser.parse_args()
    if args.self_test:
        value = self_test(args.partial, args.supplement)
        if not value["all_pass"]:
            raise SystemExit(json.dumps(value, indent=2, sort_keys=True))
        print(json.dumps(value, indent=2, sort_keys=True))
        return
    if args.resume:
        if args.output is None:
            raise SystemExit("--resume requires --output")
        write_new(run(args.partial, args.supplement, args.env_file), args.output)
        return
    if args.check_recovered:
        partial = m.v15.load_manifest(args.partial)
        supplement = validate_supplement(
            args.supplement, partial, args.partial, require_approved=True
        )
        value = validate_recovered(
            json.loads(args.check_recovered.read_text()), partial, supplement
        )
        print(json.dumps({"pass": True, "manifest_sha256": value["manifest_sha256"]}))
        return
    raise SystemExit("Select --self-test, --resume, or --check-recovered")


if __name__ == "__main__":
    main()
