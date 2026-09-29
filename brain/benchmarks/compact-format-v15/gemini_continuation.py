#!/usr/bin/env python3
"""Continue the approved v15 Gemini run without repeating completed calls."""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import sys
from copy import deepcopy
from decimal import Decimal
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARK_PATH = PACKAGE_ROOT / "benchmark.py"
PROVIDER = "gemini"


def load_benchmark() -> Any:
    spec = importlib.util.spec_from_file_location(
        "ghostnote_compact_format_v15_continuation", BENCHMARK_PATH
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


def validate_amendment(
    path: Path, partial: dict[str, Any], partial_path: Path
) -> dict[str, Any]:
    value = json.loads(path.read_text())
    if value.get("sha256") != unsigned_digest(value, "sha256"):
        raise ValueError("The continuation amendment hash is invalid")
    expected = {
        "schema": "ghostnote-compact-format-validity-cost-amendment-v1",
        "run_id": m.RUN_ID,
        "provider": PROVIDER,
        "protocol_sha256": partial["protocol_sha256"],
        "run_plan_sha256": partial["run_plan_sha256"],
        "cohort_sha256": partial["cohort_sha256"],
        "candidate_sha256": partial["candidate_sha256"],
        "partial_manifest_sha256": partial["manifest_sha256"],
        "partial_file_sha256": m.base.file_sha256(partial_path),
        "previous_provider_cost_limit_usd": 0.55,
        "amended_cumulative_provider_cost_limit_usd": 1.0,
        "maximum_total_cost_usd": 6.35,
        "remaining_sequence_start": 70,
        "remaining_sequence_end": 108,
        "remaining_call_count": 39,
        "status": "approved",
    }
    if any(value.get(name) != item for name, item in expected.items()):
        raise ValueError("The continuation amendment does not match the partial run")
    if not isinstance(value.get("operator_statement"), str) or not value[
        "operator_statement"
    ].strip():
        raise ValueError("The continuation amendment needs an operator statement")
    return value


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


def restore_guard(partial: dict[str, Any]) -> Any:
    source = partial["cost_guard"]
    guard = m.v14.CostGuard(PROVIDER)
    guard.message_attempts = source["message_attempts"]
    guard.token_count_attempts = source["token_count_attempts"]
    guard.settled_cost = Decimal(str(source["settled_exact_usd"]))
    guard.committed_cost = Decimal(str(source["committed_exact_usd"]))
    guard.failed_reservations = source["failed_reservations"]
    return guard


def continue_rows(
    partial: dict[str, Any], key: str
) -> tuple[list[dict[str, Any]], Any]:
    schedule = m.v14.jobs(PROVIDER)
    if any(not row["provider_completed"] for row in partial["results"][:69]):
        raise ValueError("A retained Gemini row is not provider-complete")
    rows = deepcopy(partial["results"][:69])
    guard = restore_guard(partial)
    started_sequence = 69
    completed_sequence = 69
    stop_reason = None
    unavailable = 0
    for job in schedule[69:]:
        if stop_reason is not None:
            row = m.v14.not_attempted_row(job, stop_reason)
            row["difficulty"] = m.task_difficulty(job["task"])
            rows.append(row)
            continue
        before_attempts = guard.message_attempts
        before_token_counts = guard.token_count_attempts
        try:
            initial, call = m.one_call(PROVIDER, key, job, guard)
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
            f"{PROVIDER}: planned={m.MAXIMUM_CALLS} "
            f"attempted={counters['attempted']} "
            f"provider-completed={counters['provider_completed']} "
            f"failed={counters['failed']} unavailable={counters['unavailable']} "
            f"budget-stopped={counters['budget_stopped']}",
            file=sys.stderr,
            flush=True,
        )
    return rows, guard


def calls_for(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [row["initial_call"] for row in rows if row.get("initial_call") is not None]


def validate_completed(
    value: dict[str, Any], partial: dict[str, Any], amendment: dict[str, Any]
) -> dict[str, Any]:
    if value.get("manifest_sha256") != unsigned_digest(value, "manifest_sha256"):
        raise ValueError("The completed Gemini manifest hash is invalid")
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
        raise ValueError("The completed manifest changed a frozen identity")
    if value.get("continued_from_manifest_sha256") != partial["manifest_sha256"]:
        raise ValueError("The completed manifest has the wrong continuation source")
    if value.get("cost_amendment") != amendment:
        raise ValueError("The completed manifest has the wrong cost amendment")
    rows = value.get("results", [])
    if rows[:69] != partial["results"][:69]:
        raise ValueError("A retained Gemini result changed")
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
        raise ValueError("The completed manifest does not match the frozen schedule")
    denominators = progress(rows)
    if value.get("progress") != denominators:
        raise ValueError("The completed progress counters do not reconcile")
    started = [row["started_sequence"] for row in rows if row.get("started_sequence")]
    completed = [
        row["completed_sequence"] for row in rows if row.get("completed_sequence")
    ]
    if started != list(range(1, len(started) + 1)) or completed != list(
        range(1, len(completed) + 1)
    ):
        raise ValueError("The completed manifest has invalid realized ordinals")
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
        or guard.get("maximum_cost_usd") != 1.0
        or guard.get("committed_cost_usd", math.inf) > 1.0
        or guard.get("message_attempts") != denominators["attempted"]
        or value.get("raw_run_sha256")
        != m.core.digest([call["raw_response_sha256"] for call in calls])
    ):
        raise ValueError("The completed cost accounting does not reconcile")
    tasks = {
        (task["family"], task["variant"]): task
        for family_tasks in m.make_corpus()["fixtures"].values()
        for task in family_tasks
    }
    for row in rows:
        score = m.v14.row_score(row)
        if score is None:
            continue
        task = tasks[(row["family"], row["variant"])]
        call = row.get("initial_call") or {}
        payload = call.get("response_payload")
        if not isinstance(payload, str):
            raise ValueError("A scored row has no retained payload")
        expected_score = (
            m.score_response(row["arm"], task, payload)
            if call.get("outer_schema_valid")
            else m.parse_failure_for_task(task, "The response envelope is invalid")
        )
        if score != expected_score:
            raise ValueError("A retained Gemini score does not reproduce")
    return value


def run(
    partial_path: Path, amendment_path: Path, env_path: Path
) -> dict[str, Any]:
    partial = m.load_manifest(partial_path)
    amendment = validate_amendment(amendment_path, partial, partial_path)
    environment = m.transport.load_env(env_path)
    key = environment.get(m.KEYS[PROVIDER])
    if not key:
        raise ValueError("The Gemini credential preflight failed")
    network = m.v14.network_preflight(PROVIDER)
    limit = Decimal(str(amendment["amended_cumulative_provider_cost_limit_usd"]))
    m.PROVIDER_COST_LIMITS[PROVIDER] = limit
    m.v14.PROVIDER_COST_LIMITS[PROVIDER] = limit
    rows, guard = continue_rows(partial, key)
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
            "continuation_network_preflight": network,
            "continued_from_manifest_sha256": partial["manifest_sha256"],
            "cost_amendment": amendment,
            "results": rows,
            "progress": counters,
            "actual_cost_usd": m.base.rounded_usd(exact_cost),
            "actual_cost_exact_usd": m.base.exact_usd(exact_cost),
            "cost_guard": guard.snapshot(),
            "complete": counters["provider_completed"] == m.MAXIMUM_CALLS
            and counters["failed"] == 0
            and counters["unavailable"] == 0
            and counters["budget_stopped"] == 0,
            "raw_run_sha256": m.core.digest(
                [call["raw_response_sha256"] for call in calls]
            ),
        }
    )
    value["manifest_sha256"] = unsigned_digest(value, "manifest_sha256")
    return validate_completed(value, partial, amendment)


def summarize(
    openai_path: Path,
    completed_path: Path,
    haiku_path: Path,
    partial_path: Path,
    amendment_path: Path,
) -> dict[str, Any]:
    partial = m.load_manifest(partial_path)
    amendment = validate_amendment(amendment_path, partial, partial_path)
    completed = validate_completed(
        json.loads(completed_path.read_text()), partial, amendment
    )
    value = m.summarize_runs(
        [m.load_manifest(openai_path), completed, m.load_manifest(haiku_path)]
    )
    value["gemini_continuation"] = {
        "continued_from_manifest_sha256": partial["manifest_sha256"],
        "completed_manifest_sha256": completed["manifest_sha256"],
        "cost_amendment_sha256": amendment["sha256"],
    }
    value["sha256"] = unsigned_digest(value, "sha256")
    return value


def write_new(value: dict[str, Any], output: Path) -> None:
    if output.exists():
        raise FileExistsError(f"Refusing to replace: {output}")
    output.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--partial", type=Path, required=True)
    parser.add_argument("--amendment", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--env-file", type=Path, default=PACKAGE_ROOT.parents[2] / ".env")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--check-completed", type=Path)
    parser.add_argument(
        "--summarize", nargs=3, type=Path, metavar=("OPENAI", "GEMINI", "HAIKU")
    )
    args = parser.parse_args()
    if args.resume:
        write_new(run(args.partial, args.amendment, args.env_file), args.output)
        return
    partial = m.load_manifest(args.partial)
    amendment = validate_amendment(args.amendment, partial, args.partial)
    if args.check_completed:
        value = validate_completed(
            json.loads(args.check_completed.read_text()), partial, amendment
        )
        print(json.dumps({"pass": True, "manifest_sha256": value["manifest_sha256"]}))
        return
    if args.summarize:
        write_new(
            summarize(*args.summarize, args.partial, args.amendment), args.output
        )
        return
    raise SystemExit("Select --resume, --check-completed, or --summarize")


if __name__ == "__main__":
    main()
