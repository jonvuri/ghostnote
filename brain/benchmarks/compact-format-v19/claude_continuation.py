#!/usr/bin/env python3
"""Continue the v19 Claude run without repeating scored calls."""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from copy import deepcopy
from decimal import Decimal
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARK_PATH = PACKAGE_ROOT / "benchmark.py"
PROVIDER = "claude-haiku"
MAXIMUM_CUMULATIVE_ATTEMPTS = 137
MAXIMUM_CUMULATIVE_COST = Decimal("4.000000")
UNRETAINED_ATTEMPTS = 2
UNRETAINED_RESERVATION = Decimal("0.264000")
EXCLUDED_FAMILY = "comprehension-analysis"
RECOVERY_SETTINGS = {
    "thinking": {"type": "enabled", "budget_tokens": 1024},
    "max_tokens": 12000,
    "temperature": "provider default; omitted from request",
}


def load_benchmark() -> Any:
    spec = importlib.util.spec_from_file_location(
        "ghostnote_compact_format_v19_claude_continuation", BENCHMARK_PATH
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {BENCHMARK_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


m = load_benchmark()


def unsigned_digest(value: dict[str, Any], field: str) -> str:
    unsigned = deepcopy(value)
    unsigned.pop(field, None)
    return m.core.digest(unsigned)


def validate_supplement(
    path: Path, partial: dict[str, Any], partial_path: Path
) -> dict[str, Any]:
    value = json.loads(path.read_text())
    expected = {
        "schema": "ghostnote-compact-format-v19-claude-continuation-v1",
        "run_id": m.RUN_ID,
        "provider": PROVIDER,
        "source_manifest_sha256": partial["manifest_sha256"],
        "source_file_sha256": m.base.file_sha256(partial_path),
        "continuation_code_sha256": m.base.file_sha256(Path(__file__)),
        "retained_planned_sequences": [3, 4],
        "excluded_family": EXCLUDED_FAMILY,
        "unretained_recovery_attempts": UNRETAINED_ATTEMPTS,
        "unretained_recovery_reservation_usd": float(UNRETAINED_RESERVATION),
        "recovery_settings": RECOVERY_SETTINGS,
        "maximum_cumulative_message_attempts": MAXIMUM_CUMULATIVE_ATTEMPTS,
        "maximum_cumulative_cost_usd": float(MAXIMUM_CUMULATIVE_COST),
        "status": "approved",
    }
    if value.get("sha256") != unsigned_digest(value, "sha256"):
        raise ValueError("The Claude continuation supplement hash is invalid")
    if any(value.get(name) != item for name, item in expected.items()):
        raise ValueError("The Claude continuation supplement does not match")
    if not isinstance(value.get("operator_statement"), str) or not value[
        "operator_statement"
    ].strip():
        raise ValueError("The Claude continuation needs an operator statement")
    return value


def configure_recovery() -> None:
    for module in (m, m.v18, m.v15, m.v14):
        module.SETTINGS[PROVIDER] = deepcopy(RECOVERY_SETTINGS)
        module.MAXIMUM_CALLS = MAXIMUM_CUMULATIVE_ATTEMPTS
        module.MAXIMUM_TOKEN_COUNT_REQUESTS = MAXIMUM_CUMULATIVE_ATTEMPTS
        module.PROVIDER_COST_LIMITS[PROVIDER] = MAXIMUM_CUMULATIVE_COST
    m.base.SETTINGS[PROVIDER] = {
        "thinking": deepcopy(RECOVERY_SETTINGS["thinking"]),
        "max_tokens": RECOVERY_SETTINGS["max_tokens"],
    }


def restore_guard(partial: dict[str, Any]) -> Any:
    source = partial["cost_guard"]
    guard = m.v14.CostGuard(PROVIDER)
    guard.message_attempts = source["message_attempts"]
    guard.token_count_attempts = source["token_count_attempts"]
    guard.settled_cost = Decimal(str(source["settled_exact_usd"]))
    guard.committed_cost = (
        Decimal(str(source["committed_exact_usd"])) + UNRETAINED_RESERVATION
    )
    guard.failed_reservations = source["failed_reservations"] + UNRETAINED_ATTEMPTS
    guard.message_attempts += UNRETAINED_ATTEMPTS
    guard.token_count_attempts += UNRETAINED_ATTEMPTS
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
) -> dict[str, Any]:
    return {
        "planned_sequence": job["planned_sequence"],
        "started_sequence": started_sequence if attempted else None,
        "completed_sequence": completed_sequence if provider_completed else None,
        "arm": job["arm"],
        "candidate_sha256": m.candidate_hashes()[job["arm"]],
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
        "repair": None,
        "repair_call": None,
    }


def continue_rows(
    partial: dict[str, Any], key: str
) -> tuple[list[dict[str, Any]], Any, list[dict[str, Any]]]:
    schedule = m.jobs(PROVIDER)
    prior = {row["planned_sequence"]: row for row in partial["results"]}
    retained = {3, 4}
    if any(not prior[sequence]["initial"]["scored"] for sequence in retained):
        raise ValueError("A retained Claude row is not scored")
    rows = []
    new_calls = []
    guard = restore_guard(partial)
    started_sequence = partial["progress"]["attempted"]
    completed_sequence = partial["progress"]["provider_completed"]
    unavailable = 0
    stop_reason = None
    for job in schedule:
        sequence = job["planned_sequence"]
        if job["family"] == EXCLUDED_FAMILY:
            if prior[sequence].get("attempted"):
                rows.append(deepcopy(prior[sequence]))
            else:
                row = m.v14.not_attempted_row(job, "analysis-output-limit-excluded")
                row["difficulty"] = m.task_difficulty(job["task"])
                rows.append(row)
            continue
        if sequence in retained:
            rows.append(deepcopy(prior[sequence]))
            continue
        if stop_reason is not None:
            row = m.v14.not_attempted_row(job, stop_reason)
            row["difficulty"] = m.task_difficulty(job["task"])
            rows.append(row)
            continue
        before_attempts = guard.message_attempts
        before_token_counts = guard.token_count_attempts
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
        if call is not None:
            new_calls.append(call)
        unavailable += int(initial["kind"] == "unavailable")
        if unavailable >= 3:
            stop_reason = "unavailable-stop"
        rows.append(
            result_row(
                job,
                initial,
                call,
                attempted,
                provider_completed,
                budget_stopped,
                started_sequence,
                completed_sequence,
            )
        )
        counters = progress(rows)
        print(
            f"{PROVIDER}: planned={len(schedule)} "
            f"attempted={counters['attempted']} "
            f"provider-completed={counters['provider_completed']} "
            f"failed={counters['failed']} unavailable={counters['unavailable']} "
            f"budget-stopped={counters['budget_stopped']}",
            file=sys.stderr,
            flush=True,
        )
    return rows, guard, new_calls


def call_cost(calls: list[dict[str, Any]]) -> Decimal:
    return sum(
        (
            Decimal(str(call["cost_usd"]["total"]))
            for call in calls
            if call.get("cost_usd") is not None
        ),
        Decimal(0),
    )


def validate_completed(
    value: dict[str, Any], partial: dict[str, Any], supplement: dict[str, Any]
) -> dict[str, Any]:
    if value.get("manifest_sha256") != unsigned_digest(value, "manifest_sha256"):
        raise ValueError("The completed Claude manifest hash is invalid")
    if value.get("continued_from_manifest_sha256") != partial["manifest_sha256"]:
        raise ValueError("The completed Claude manifest has the wrong source")
    if value.get("continuation_supplement") != supplement:
        raise ValueError("The completed Claude manifest has the wrong supplement")
    rows = value.get("results", [])
    schedule = m.jobs(PROVIDER)
    expected_identity = [
        (
            job["planned_sequence"],
            job["arm"],
            job["family"],
            job["variant"],
            job["repeat"],
            job["task"]["sha256"],
        )
        for job in schedule
    ]
    actual_identity = [
        (
            row.get("planned_sequence"),
            row.get("arm"),
            row.get("family"),
            row.get("variant"),
            row.get("repeat"),
            row.get("task_sha256"),
        )
        for row in rows
    ]
    if actual_identity != expected_identity:
        raise ValueError("The completed Claude manifest changed the schedule")
    for sequence in (3, 4):
        if rows[sequence - 1] != partial["results"][sequence - 1]:
            raise ValueError("A scored Claude result changed")
    if value.get("progress") != progress(rows):
        raise ValueError("The completed Claude progress does not reconcile")
    guard = value.get("cost_guard", {})
    if (
        Decimal(str(value.get("actual_cost_exact_usd")))
        != Decimal(str(guard.get("settled_exact_usd")))
        or Decimal(str(guard.get("committed_exact_usd")))
        > MAXIMUM_CUMULATIVE_COST
        or guard.get("message_attempts") > MAXIMUM_CUMULATIVE_ATTEMPTS
    ):
        raise ValueError("The completed Claude cost does not reconcile")
    tasks = {
        (task["family"], task["variant"]): task
        for family_tasks in m.make_corpus()["fixtures"].values()
        for task in family_tasks
    }
    for row in rows:
        score = m.v14.row_score(row)
        if score is None:
            continue
        call = row.get("initial_call") or {}
        payload = call.get("response_payload")
        if not isinstance(payload, str):
            raise ValueError("A scored Claude row has no payload")
        task = tasks[(row["family"], row["variant"])]
        expected_score = (
            m.score_response(row["arm"], task, payload)
            if call.get("outer_schema_valid")
            else m.parse_failure_for_task(task, "The response envelope is invalid")
        )
        if score != expected_score:
            raise ValueError("A retained Claude score does not reproduce")
    return value


def run(partial_path: Path, supplement_path: Path, env_path: Path) -> dict[str, Any]:
    partial = m.v15.load_manifest(partial_path)
    supplement = validate_supplement(supplement_path, partial, partial_path)
    environment = m.transport.load_env(env_path)
    key = environment.get(m.KEYS[PROVIDER])
    if not key:
        raise ValueError("The Claude credential preflight failed")
    network = m.v14.network_preflight(PROVIDER)
    configure_recovery()
    rows, guard, new_calls = continue_rows(partial, key)
    prior_calls = [
        row["initial_call"]
        for row in partial["results"]
        if row.get("initial_call") is not None
    ]
    exact_cost = call_cost(prior_calls) + call_cost(new_calls)
    counters = progress(rows)
    value = deepcopy(partial)
    value.update(
        {
            "continued_from_manifest_sha256": partial["manifest_sha256"],
            "continuation_network_preflight": network,
            "continuation_supplement": supplement,
            "recovery_effective_request_settings": {
                "thinking": RECOVERY_SETTINGS["thinking"],
                "max_tokens": RECOVERY_SETTINGS["max_tokens"],
            },
            "prior_attempts": [
                row for row in partial["results"] if row.get("attempted")
            ],
            "results": rows,
            "progress": counters,
            "actual_cost_usd": m.base.rounded_usd(exact_cost),
            "actual_cost_exact_usd": m.base.exact_usd(exact_cost),
            "cost_guard": guard.snapshot(),
            "complete": counters["scored"] == len(rows)
            and counters["failed"] == 0
            and counters["unavailable"] == 0
            and counters["budget_stopped"] == 0,
            "raw_run_sha256": m.core.digest(
                [call["raw_response_sha256"] for call in prior_calls + new_calls]
            ),
            "unretained_recovery": {
                "attempts": UNRETAINED_ATTEMPTS,
                "maximum_reserved_cost_usd": float(UNRETAINED_RESERVATION),
                "reason": "One 24,000-token output-limit response and one interrupted request were not written to a manifest.",
            },
        }
    )
    value["manifest_sha256"] = unsigned_digest(value, "manifest_sha256")
    return validate_completed(value, partial, supplement)


def self_test(partial_path: Path, supplement_path: Path) -> dict[str, Any]:
    partial = m.v15.load_manifest(partial_path)
    supplement = validate_supplement(supplement_path, partial, partial_path)
    checks = {
        "source_is_partial": not partial["complete"],
        "three_output_limits_are_retained": partial["progress"]["unavailable"] == 3,
        "two_scored_rows_are_retained": partial["progress"]["scored"] == 2,
        "same_prompts": supplement["source_manifest_sha256"]
        == partial["manifest_sha256"],
        "original_settings_are_reused": supplement["recovery_settings"]
        == RECOVERY_SETTINGS,
        "analysis_is_excluded": supplement["excluded_family"] == EXCLUDED_FAMILY,
        "unretained_cost_is_reserved": supplement[
            "unretained_recovery_reservation_usd"
        ]
        == float(UNRETAINED_RESERVATION),
        "cost_limit_is_unchanged": supplement["maximum_cumulative_cost_usd"]
        == float(MAXIMUM_CUMULATIVE_COST),
    }
    return {"checks": checks, "all_pass": all(checks.values())}


def write_new(value: dict[str, Any], output: Path) -> None:
    if output.exists():
        raise FileExistsError(f"Refusing to replace: {output}")
    output.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--partial", type=Path, required=True)
    parser.add_argument("--supplement", type=Path, required=True)
    parser.add_argument("--env-file", type=Path, default=PACKAGE_ROOT.parents[2] / ".env")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--check-completed", type=Path)
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
    if args.check_completed:
        partial = m.v15.load_manifest(args.partial)
        supplement = validate_supplement(args.supplement, partial, args.partial)
        configure_recovery()
        value = validate_completed(
            json.loads(args.check_completed.read_text()), partial, supplement
        )
        print(json.dumps({"pass": True, "manifest_sha256": value["manifest_sha256"]}))
        return
    raise SystemExit("Select --self-test, --resume, or --check-completed")


if __name__ == "__main__":
    main()
