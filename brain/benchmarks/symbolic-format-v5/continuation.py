#!/usr/bin/env python3
"""Continue pending rows and repeat explicit unavailable provider outcomes."""

from __future__ import annotations

import argparse
import importlib.util
import json
import platform
import sys
from copy import deepcopy
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARK_PATH = PACKAGE_ROOT / "benchmark.py"
RUNS_ROOT = PACKAGE_ROOT / "runs"


def load_benchmark() -> Any:
    spec = importlib.util.spec_from_file_location(
        "ghostnote_symbolic_format_v5_continuation", BENCHMARK_PATH
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load benchmark: {BENCHMARK_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


m = load_benchmark()

SCHEMA = "ghostnote-symbolic-format-v5-continuation-v3"
RUN_ID = "phase8c4f-eight-arm-full-matrix-continuation-r3"
PROVIDERS = ("gemini", "claude-haiku")
SOURCE_PATHS = {
    "gemini": RUNS_ROOT / "2026-09-29-gemini.json",
    "claude-haiku": RUNS_ROOT / "2026-09-29-claude-haiku.json",
}
ASSESSMENT_PATH = RUNS_ROOT / "2026-09-29-assessment.json"
APPROVAL_PATH = RUNS_ROOT / "full-matrix-continuation-r3-approval.json"
SETTINGS = {
    "gemini": m.effective_request_settings("gemini"),
    "claude-haiku": {
        "thinking": {"type": "enabled", "budget_tokens": 1024},
        "max_tokens": 24000,
    },
}
ESTIMATE = {
    "gemini": Decimal("0.080000"),
    "claude-haiku": Decimal("6.100000"),
}
LIMITS = {
    "gemini": Decimal("0.200000"),
    "claude-haiku": Decimal("8.000000"),
}
MAXIMUM_TOTAL_COST = Decimal("8.200000")


def maximum_call_cost(provider: str) -> Decimal:
    setting = SETTINGS[provider]
    output_limit = int(
        setting.get("max_output_tokens") or setting.get("max_tokens")
    )
    prices = m.base.PRICES_USD_PER_MILLION[provider]
    return (
        Decimal(m.base.INPUT_TOKEN_CEILING)
        * m.base.decimal_rate(prices["input"])
        + Decimal(output_limit) * m.base.decimal_rate(prices["output"])
    )


@lru_cache(maxsize=1)
def source_runs() -> dict[str, dict[str, Any]]:
    return {
        provider: m.v15.load_manifest(SOURCE_PATHS[provider])
        for provider in PROVIDERS
    }


@lru_cache(maxsize=None)
def pending_jobs(provider: str) -> tuple[dict[str, Any], ...]:
    if provider not in PROVIDERS:
        raise ValueError(f"Unknown continuation provider: {provider}")
    source = source_runs()[provider]
    by_sequence = {
        row["planned_sequence"]: row for row in source["results"]
    }
    pending = []
    for job in m.jobs(provider):
        row = by_sequence[job["planned_sequence"]]
        kind = row["initial"]["kind"]
        selected = (
            not row["attempted"]
            or (provider == "gemini" and job["planned_sequence"] == 564)
            or (provider == "claude-haiku" and kind == "unavailable")
        )
        if not selected:
            continue
        if not row["attempted"] and kind != "not-attempted":
            raise ValueError("An unattempted row has an unexpected state")
        if row["attempted"] and kind not in {"failed", "unavailable"}:
            raise ValueError("A selected repeat is not failed or unavailable")
        pending.append(job)
    return tuple(pending)


@lru_cache(maxsize=1)
def assessment_manifest() -> dict[str, Any]:
    value = json.loads(ASSESSMENT_PATH.read_text())
    unsigned = deepcopy(value)
    claimed = unsigned.pop("sha256", None)
    if claimed != m.core.digest(unsigned):
        raise ValueError("Assessment hash mismatch")
    return value


def protocol_manifest() -> dict[str, Any]:
    sources = source_runs()
    assessment = assessment_manifest()
    value = {
        "schema": SCHEMA,
        "run_kind": "eight-arm-full-matrix-continuation-protocol",
        "run_id": RUN_ID,
        "package_files": {
            "continuation.py": m.base.file_sha256(Path(__file__)),
            "assessment.py": m.base.file_sha256(PACKAGE_ROOT / "assessment.py"),
        },
        "original_protocol_sha256": sources["gemini"]["protocol_sha256"],
        "original_run_plan_sha256": sources["gemini"]["run_plan_sha256"],
        "source_manifest_sha256": {
            provider: sources[provider]["manifest_sha256"]
            for provider in PROVIDERS
        },
        "source_assessment_sha256": assessment["sha256"],
        "providers": list(PROVIDERS),
        "models": {provider: m.MODELS[provider] for provider in PROVIDERS},
        "effective_request_settings": {
            provider: SETTINGS[provider] for provider in PROVIDERS
        },
        "pending": {
            provider: {
                "calls": len(pending_jobs(provider)),
                "original_planned_sequence_range": [
                    pending_jobs(provider)[0]["planned_sequence"],
                    pending_jobs(provider)[-1]["planned_sequence"],
                ],
                "original_planned_sequences_sha256": m.core.digest(
                    [job["planned_sequence"] for job in pending_jobs(provider)]
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
                        for job in pending_jobs(provider)
                    ]
                ),
            }
            for provider in PROVIDERS
        },
        "exclusions": {
            "scored_rows": "never call again",
            "other_attempted_rows": "never call again",
        },
        "explicit_repeats": {
            "gemini_failed_sequence_564": "repeat once after source HTTP 503",
            "claude_unavailable_sequences": [67, 137, 138],
            "replacement_policy": (
                "Retain source evidence. Use a complete continuation result in "
                "the matrix assessment only for its matching failed or "
                "unavailable source row."
            ),
        },
        "stopping_rule": {
            "transport_failure": 1,
            "budget_stop": 1,
            "unavailable_response": "retain and continue",
            "automatic_retries": 0,
            "repairs": 0,
        },
        "cost_guard": {
            "estimate_usd": {
                provider: float(ESTIMATE[provider]) for provider in PROVIDERS
            },
            "estimate_total_usd": float(sum(ESTIMATE.values())),
            "maximum_provider_cost_usd": {
                provider: float(LIMITS[provider]) for provider in PROVIDERS
            },
            "maximum_call_cost_usd": {
                provider: m.base.exact_usd(maximum_call_cost(provider))
                for provider in PROVIDERS
            },
            "maximum_total_cost_usd": float(MAXIMUM_TOTAL_COST),
        },
        "approval": "pending",
    }
    value["sha256"] = m.core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    value = {
        "schema": SCHEMA,
        "run_kind": "eight-arm-full-matrix-continuation-plan",
        "run_id": RUN_ID,
        "protocol_sha256": protocol["sha256"],
        "original_protocol_sha256": protocol["original_protocol_sha256"],
        "original_run_plan_sha256": protocol["original_run_plan_sha256"],
        "source_manifest_sha256": protocol["source_manifest_sha256"],
        "source_assessment_sha256": protocol["source_assessment_sha256"],
        "providers": protocol["providers"],
        "models": protocol["models"],
        "effective_request_settings": protocol["effective_request_settings"],
        "pending": protocol["pending"],
        "exclusions": protocol["exclusions"],
        "explicit_repeats": protocol["explicit_repeats"],
        "stopping_rule": protocol["stopping_rule"],
        "cost_guard": protocol["cost_guard"],
        "approval": "pending",
    }
    value["sha256"] = m.core.digest(value)
    return value


def deterministic_screen() -> dict[str, Any]:
    sources = source_runs()
    pending = {provider: pending_jobs(provider) for provider in PROVIDERS}
    source_attempted = {
        provider: {
            row["planned_sequence"]
            for row in sources[provider]["results"]
            if row["attempted"]
        }
        for provider in PROVIDERS
    }
    checks = {
        "original-v5-screen-passes": m.deterministic_screen()[
            "all_checks_pass"
        ],
        "assessment-valid": assessment_manifest()["all_retained_rows_valid"],
        "gemini-pending-count": len(pending["gemini"]) == 29,
        "claude-pending-count": len(pending["claude-haiku"]) == 457,
        "only-explicit-attempted-rows-selected": all(
            job["planned_sequence"] not in source_attempted[provider]
            or (
                provider == "gemini"
                and job["planned_sequence"] == 564
            )
            or (
                provider == "claude-haiku"
                and job["planned_sequence"] in {67, 137, 138}
            )
            for provider in PROVIDERS for job in pending[provider]
        ),
        "original-sequence-order": all(
            [job["planned_sequence"] for job in pending[provider]]
            == sorted(job["planned_sequence"] for job in pending[provider])
            for provider in PROVIDERS
        ),
        "prompt-size": all(
            len(m.engine.prompt_for(job).encode()) <= m.base.REQUEST_BYTE_CEILING
            for provider in PROVIDERS
            for job in pending[provider]
        ),
        "claude-output-limit": SETTINGS["claude-haiku"]["max_tokens"]
        == 24000,
        "claude-thinking-target": SETTINGS["claude-haiku"]["thinking"]
        == {"type": "enabled", "budget_tokens": 1024},
        "source-protocols-match": sources["gemini"]["protocol_sha256"]
        == sources["claude-haiku"]["protocol_sha256"],
        "source-plans-match": sources["gemini"]["run_plan_sha256"]
        == sources["claude-haiku"]["run_plan_sha256"],
        "cost-headroom": all(
            ESTIMATE[provider] + maximum_call_cost(provider)
            <= LIMITS[provider]
            for provider in PROVIDERS
        ),
        "call-total": sum(len(rows) for rows in pending.values()) == 486,
    }
    value = {"checks": checks, "all_checks_pass": all(checks.values())}
    value["sha256"] = m.core.digest(value)
    return value


def deterministic_manifest() -> dict[str, Any]:
    screen = deterministic_screen()
    plan = run_plan()
    value = {
        "schema": SCHEMA,
        "screen_sha256": screen["sha256"],
        "protocol_sha256": plan["protocol_sha256"],
        "run_plan_sha256": plan["sha256"],
        "source_manifest_sha256": plan["source_manifest_sha256"],
        "source_assessment_sha256": plan["source_assessment_sha256"],
        "pending_calls": {
            provider: plan["pending"][provider]["calls"]
            for provider in PROVIDERS
        },
        "all_checks_pass": screen["all_checks_pass"],
    }
    value["sha256"] = m.core.digest(value)
    return value


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    if (
        value.get("run_id") != RUN_ID
        or value.get("protocol_sha256") != plan["protocol_sha256"]
        or value.get("run_plan_sha256") != plan["sha256"]
        or value.get("source_manifest_sha256")
        != plan["source_manifest_sha256"]
        or value.get("source_assessment_sha256")
        != plan["source_assessment_sha256"]
        or value.get("maximum_total_cost_usd")
        != plan["cost_guard"]["maximum_total_cost_usd"]
    ):
        raise ValueError("Approval does not match the continuation plan")
    if (
        value.get("status") != "approved"
        or not isinstance(value.get("operator_statement"), str)
        or not value["operator_statement"].strip()
    ):
        raise ValueError("Approval needs an explicit operator statement")
    return value


def execute_jobs(
    provider: str, key: str
) -> tuple[list[dict[str, Any]], Any, dict[str, int]]:
    schedule = pending_jobs(provider)
    m.v14.SETTINGS[provider] = {
        **deepcopy(SETTINGS[provider]),
        "temperature": "provider default; omitted from request",
    }
    m.base.SETTINGS[provider] = deepcopy(SETTINGS[provider])
    m.v14.MAXIMUM_CALLS = len(schedule)
    m.v14.MAXIMUM_TOKEN_COUNT_REQUESTS = len(schedule)
    m.v14.PROVIDER_COST_LIMITS = {
        **m.PROVIDER_COST_LIMITS,
        provider: LIMITS[provider],
    }
    guard = m.v14.CostGuard(provider)
    counters = {
        "planned": len(schedule),
        "attempted": 0,
        "provider_completed": 0,
        "available": 0,
        "scored": 0,
        "failed": 0,
        "unavailable": 0,
        "budget_stopped": 0,
    }
    results = []
    stop_reason = None
    started_sequence = 0
    completed_sequence = 0
    for continuation_sequence, job in enumerate(schedule, start=1):
        if stop_reason is not None:
            row = m.v14.not_attempted_row(job, stop_reason)
            row["continuation_sequence"] = continuation_sequence
            results.append(row)
            continue
        before_attempts = guard.message_attempts
        before_token_counts = guard.token_count_attempts
        try:
            initial, call = m.v14.one_call(provider, key, job, guard)
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
            call = (
                error.call
                if isinstance(error, m.v14.ProviderCompletedError)
                else None
            )
            if budget_stopped:
                stop_reason = "budget-stop"
            elif isinstance(error, m.v14.ProviderCompletedError):
                stop_reason = "provider-completed-validation-failure"
            elif guard.token_count_attempts > before_token_counts and not attempted:
                stop_reason = "token-count-failure"
            else:
                stop_reason = "transport-failure"
        kind = initial["kind"]
        counters["attempted"] += int(attempted)
        counters["provider_completed"] += int(provider_completed)
        counters["available"] += int(kind == "initial")
        counters["scored"] += int(initial.get("score") is not None)
        counters["failed"] += int(kind == "failed")
        counters["unavailable"] += int(kind == "unavailable")
        counters["budget_stopped"] += int(budget_stopped)
        results.append(
            {
                "continuation_sequence": continuation_sequence,
                "planned_sequence": job["planned_sequence"],
                "started_sequence": started_sequence if attempted else None,
                "completed_sequence": (
                    completed_sequence if provider_completed else None
                ),
                "arm": job["arm"],
                "candidate_sha256": m.engine.candidate_hashes()[job["arm"]],
                "family": job["family"],
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
        )
        print(
            f"{provider}: continuation planned={counters['planned']} "
            f"attempted={counters['attempted']} "
            f"provider-completed={counters['provider_completed']} "
            f"failed={counters['failed']} unavailable={counters['unavailable']} "
            f"budget-stopped={counters['budget_stopped']}",
            file=sys.stderr,
            flush=True,
        )
    return results, guard, counters


def run_provider(provider: str, env_file: Path, approval_file: Path) -> dict[str, Any]:
    approval = validate_approval(approval_file)
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise ValueError("The continuation deterministic screen failed")
    environment = m.v14.transport.load_env(env_file)
    if not environment.get(m.KEYS[provider]):
        raise ValueError(f"Provider credential preflight failed: {m.KEYS[provider]}")
    preflight = m.v14.network_preflight(provider)
    results, guard, counters = execute_jobs(
        provider, environment[m.KEYS[provider]]
    )
    calls = [row["initial_call"] for row in results if row["initial_call"]]
    exact_cost = sum(
        (
            Decimal(str(call["cost_usd"]["total"]))
            for call in calls
            if call.get("cost_usd") is not None
        ),
        Decimal(0),
    )
    snapshot = guard.snapshot()
    if m.base.rounded_usd(exact_cost) != snapshot["settled_cost_usd"]:
        raise AssertionError("The exact call sum and cost guard differ")
    plan = run_plan()
    value = {
        "schema": SCHEMA,
        "run_kind": "eight-arm-full-matrix-continuation-provider",
        "run_id": RUN_ID,
        "provider": provider,
        "original_run_id": m.RUN_ID,
        "source_manifest_sha256": plan["source_manifest_sha256"][provider],
        "source_assessment_sha256": plan["source_assessment_sha256"],
        "cohort": m.COHORT,
        "cohort_sha256": m.make_corpus()["sha256"],
        "candidate_sha256": m.engine.candidate_hashes(),
        "requested_model": m.MODELS[provider],
        "effective_request_settings": SETTINGS[provider],
        "client": "Python urllib.request direct HTTPS",
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "python": platform.python_version(),
        "protocol_sha256": plan["protocol_sha256"],
        "screen_sha256": screen["sha256"],
        "run_plan_sha256": plan["sha256"],
        "schedule_sha256": plan["pending"][provider]["schedule_sha256"],
        "approval": approval,
        "network_preflight": preflight,
        "results": results,
        "progress": counters,
        "actual_cost_usd": m.base.rounded_usd(exact_cost),
        "actual_cost_exact_usd": m.base.exact_usd(exact_cost),
        "cost_guard": snapshot,
        "schedule_complete": (
            counters["provider_completed"] == len(pending_jobs(provider))
            and counters["failed"] == 0
            and counters["budget_stopped"] == 0
        ),
        "all_available": counters["unavailable"] == 0,
    }
    value["raw_run_sha256"] = m.core.digest(
        [call["raw_response_sha256"] for call in calls]
    )
    value["manifest_sha256"] = m.core.digest(value)
    return value


def write_new(value: dict[str, Any], output: Path | None) -> None:
    text = json.dumps(value, indent=2, sort_keys=True) + "\n"
    if output is None:
        print(text, end="")
        return
    if output.exists():
        raise FileExistsError(f"Refusing to replace: {output}")
    output.write_text(text)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--print-plan", action="store_true")
    parser.add_argument("--provider", choices=PROVIDERS)
    parser.add_argument(
        "--env-file", type=Path, default=PACKAGE_ROOT.parents[2] / ".env"
    )
    parser.add_argument("--approval-file", type=Path, default=APPROVAL_PATH)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.self_test:
        screen = deterministic_screen()
        if not screen["all_checks_pass"]:
            raise SystemExit(json.dumps(screen, indent=2, sort_keys=True))
        print(json.dumps(deterministic_manifest(), indent=2, sort_keys=True))
        return
    if args.print_plan:
        write_new(run_plan(), args.output)
        return
    if args.provider:
        write_new(
            run_provider(args.provider, args.env_file, args.approval_file),
            args.output,
        )
        return
    raise SystemExit("Select --self-test, --print-plan, or --provider")


if __name__ == "__main__":
    main()
