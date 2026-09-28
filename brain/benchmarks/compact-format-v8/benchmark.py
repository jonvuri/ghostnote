#!/usr/bin/env python3
"""Prepare and run the Phase 8c4b Haiku output-limit repair."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import platform
import random
import sys
import time
from copy import deepcopy
from pathlib import Path
from typing import Any, Callable


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent
V5_ROOT = BENCHMARKS_ROOT / "compact-format-v5"
V6_ROOT = BENCHMARKS_ROOT / "compact-format-v6"
V7_ROOT = BENCHMARKS_ROOT / "compact-format-v7"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


core = load_module("ghostnote_compact_format_v8_core", V6_ROOT / "core.py")
transport = load_module(
    "ghostnote_compact_format_v8_transport",
    BENCHMARKS_ROOT / "compact-format-v2" / "benchmark.py",
)

SCHEMA = "ghostnote-compact-format-haiku-output-repair-v8"
RUN_ID = "phase8c4b-analysis-haiku-calibration-r5"
COHORT = "calibration-haiku-r5"
COHORT_SEED = 12000
BATCH_COUNTS = (1, 2, 2, 3, 3)
PROVIDER = "claude-haiku"
MODEL = "claude-haiku-4-5-20251001"
KEY_NAME = "ANTHROPIC_API_KEY"
SETTINGS = {
    "thinking": {"type": "enabled", "budget_tokens": 1024},
    "max_tokens": 12000,
    "temperature": "provider default",
}
OUTER_SCHEMA = {
    "type": "object",
    "properties": {"payload": {"type": "string"}},
    "required": ["payload"],
    "additionalProperties": False,
}
ELIGIBILITY_BAND = {"minimum": 0.20, "maximum": 0.80, "minimum_providers": 2}
REPAIR_POLICY = {
    "maximum_turns": 1,
    "eligible": "Every available initial parse or musical-contract failure, including the named sentinel.",
    "feedback": "Return only the structured parse or failed-check diagnostic.",
    "primary_result": "Initial musical success only. A repair never replaces an initial result.",
    "unavailable_or_failed": "Do not repair and do not add to a scored denominator.",
}
PRICES_USD_PER_MILLION = {"input": 1.00, "cached_input": 0.10, "output": 5.00}
INPUT_TOKEN_CEILING = 5000
TOKEN_COUNT_MARGIN = 128
MAXIMUM_CALLS = 12
MAXIMUM_TOKEN_COUNT_REQUESTS = 12
MAXIMUM_CALL_COST_USD = round(
    INPUT_TOKEN_CEILING * PRICES_USD_PER_MILLION["input"] / 1_000_000
    + SETTINGS["max_tokens"] * PRICES_USD_PER_MILLION["output"] / 1_000_000,
    6,
)
MAXIMUM_COST_USD = round(MAXIMUM_CALLS * MAXIMUM_CALL_COST_USD, 6)
COST_BOUND = {
    "input_token_ceiling_per_call": INPUT_TOKEN_CEILING,
    "output_token_ceiling_per_call": SETTINGS["max_tokens"],
    "maximum_cost_per_call_usd": MAXIMUM_CALL_COST_USD,
    "maximum_calls": MAXIMUM_CALLS,
    "maximum_cost_usd": MAXIMUM_COST_USD,
    "token_count_margin": TOKEN_COUNT_MARGIN,
    "token_count_endpoint": "https://api.anthropic.com/v1/messages/count_tokens",
    "token_count_price_usd": 0,
}
DEPENDENCY_FILES = {
    "compact-format-v5/cohort-manifest.json": "d960ec4e9abca4ea2c95fa306cbc5e3914dea70a45857914a1101f1c2855f60b",
    "compact-format-v6/core.py": "9150edfc2a2d0e873386508d406d9d92c29ca1fcf1ecd352f53fba3702d6280d",
    "compact-format-v6/runs/2026-09-28-analysis-gemini-easy.json": "3f406cd196dd9b8693ee15cd75dccd002a1e83db779021abd98cdf5912eee08b",
    "compact-format-v6/runs/2026-09-28-analysis-summary.json": "3eaf6f7926a8b73c1585ce2ad15a4d22e12434855817764161bdd7506b352f5f",
    "compact-format-v7/runs/2026-09-28-analysis-haiku.json": "c92ff1fa31be9f844c472c474bcbab767ea4c9aaad597c8c99b161816e4bae35",
    "compact-format-v7/runs/2026-09-28-analysis-summary.json": "dd949f45e6a7b86c08e4b4563a5a58bdaae80c900cc3c916f89b2e3ac7f54d12",
}
RETAINED = {
    "v6_protocol_sha256": "469fa3bf8c0d9c2b66c2fb8132b3bc942b90a4e39b84c2bd784a9395495e0f2c",
    "gemini_manifest_sha256": "4931455793fa10ff25c7e541354328bbff342003d6fe51d99752e175bc663ef7",
    "gemini_raw_run_sha256": "b4cf34804b322f7c6c1bbb508e357b291a100850e88797f6eda0761df6a96d4a",
    "r3_summary_sha256": "73f343eb9bb675d688f2fffe118cf795f598b33130df0aab697d75c7372a9c72",
    "r2_summary_sha256": "e2b293e9e05c62d58e9c22748d5cdad0d38bfcd5ec456347c7a0f01a3a030017",
    "r4_manifest_sha256": "27d3741d079cdaaca792f69d06fa5cd3765c6313445cff74c451192cf01ffb2d",
    "r4_raw_run_sha256": "c6566aa177c4df12adc78e88a7bc8ba488a22a30d3168702a79b95cbb45aa316",
    "r4_summary_sha256": "179ce1c88360939c4f015edca634e4a945189701595d5864bf12d17126b45315",
}
GEMINI_PATH = V6_ROOT / "runs" / "2026-09-28-analysis-gemini-easy.json"
R4_PATH = V7_ROOT / "runs" / "2026-09-28-analysis-haiku.json"
R4_SUMMARY_PATH = V7_ROOT / "runs" / "2026-09-28-analysis-summary.json"
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "calibration-r5-approval.json"

core.ANALYSIS_BATCH_COUNTS[COHORT] = BATCH_COUNTS


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def expect_rejected(action: Callable[[], Any]) -> bool:
    try:
        action()
    except (KeyError, RuntimeError, TypeError, ValueError, json.JSONDecodeError):
        return True
    return False


def make_corpus() -> dict[str, Any]:
    fixtures = {
        "comprehension-analysis": [
            core.analysis_task(COHORT, index, COHORT_SEED)
            for index in range(5)
        ]
    }
    value = {
        "schema": "ghostnote-compact-format-corpus-v8",
        "cohort": COHORT,
        "license": "MIT",
        "fixtures": fixtures,
    }
    value["sha256"] = core.digest(value)
    return value


def jobs() -> list[dict[str, Any]]:
    tasks = make_corpus()["fixtures"]["comprehension-analysis"]
    return [
        {
            "arm": "exact-object-json",
            "family": "comprehension-analysis",
            "variant": task["variant"],
            "sentinel": False,
            "task": task,
        }
        for task in tasks
    ] + [
        {
            "arm": "exact-object-json",
            "family": "comprehension-analysis",
            "variant": tasks[0]["variant"],
            "sentinel": True,
            "task": tasks[0],
        }
    ]


def analysis_rows(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        row
        for row in results
        if row["arm"] == "exact-object-json"
        and row["family"] == "comprehension-analysis"
        and not row["sentinel"]
    ]


def analysis_gate(run: dict[str, Any]) -> dict[str, Any]:
    rows = analysis_rows(run["results"])
    scored = [
        row
        for row in rows
        if row["initial"]["kind"] == "initial" and row["initial"]["scored"]
    ]
    passed = sum(bool(row["initial"]["score"]["primary_pass"]) for row in scored)
    complete = len(rows) == 5 and len(scored) == 5
    rate = passed / len(scored) if scored else None
    return {
        "passed": passed,
        "denominator": len(scored),
        "rate": rate,
        "complete": complete,
        "eligible": complete
        and rate is not None
        and ELIGIBILITY_BAND["minimum"] <= rate <= ELIGIBILITY_BAND["maximum"],
        "ceiling": complete and rate is not None and rate > ELIGIBILITY_BAND["maximum"],
        "floor": complete and rate is not None and rate < ELIGIBILITY_BAND["minimum"],
    }


def retained_gemini() -> dict[str, Any]:
    value = json.loads(GEMINI_PATH.read_text())
    unsigned = deepcopy(value)
    claimed = unsigned.pop("manifest_sha256", None)
    if claimed != RETAINED["gemini_manifest_sha256"] or core.digest(unsigned) != claimed:
        raise ValueError("The retained Gemini manifest hash changed")
    if value.get("run_id") != "phase8c4b-analysis-repair-calibration-r3":
        raise ValueError("The retained Gemini run ID changed")
    if value.get("protocol_sha256") != RETAINED["v6_protocol_sha256"]:
        raise ValueError("The retained Gemini protocol changed")
    if value.get("provider") != "gemini" or value.get("tier") != "calibration-easy":
        raise ValueError("The retained Gemini provider or tier changed")
    if value.get("raw_run_sha256") != RETAINED["gemini_raw_run_sha256"]:
        raise ValueError("The retained Gemini raw-run hash changed")
    expected = {
        "passed": 3,
        "denominator": 5,
        "rate": 0.6,
        "complete": True,
        "eligible": True,
        "ceiling": False,
        "floor": False,
    }
    if analysis_gate(value) != expected:
        raise ValueError("The retained Gemini gate changed")
    return value


def retained_r4() -> tuple[dict[str, Any], dict[str, Any]]:
    run = json.loads(R4_PATH.read_text())
    unsigned = deepcopy(run)
    claimed = unsigned.pop("manifest_sha256", None)
    if claimed != RETAINED["r4_manifest_sha256"] or core.digest(unsigned) != claimed:
        raise ValueError("The retained r4 manifest changed")
    if run.get("raw_run_sha256") != RETAINED["r4_raw_run_sha256"]:
        raise ValueError("The retained r4 raw-run hash changed")
    summary = json.loads(R4_SUMMARY_PATH.read_text())
    unsigned_summary = deepcopy(summary)
    summary_sha = unsigned_summary.pop("sha256", None)
    if summary_sha != RETAINED["r4_summary_sha256"] or core.digest(unsigned_summary) != summary_sha:
        raise ValueError("The retained r4 summary changed")
    return run, summary


def prior_analysis_hashes() -> tuple[set[str], set[str]]:
    task_hashes: set[str] = set()
    case_hashes: set[str] = set()
    for cohort in (
        "calibration-easy",
        "calibration-medium",
        "calibration-hard",
        "validation",
    ):
        tasks = core.make_corpus(cohort)["fixtures"]["comprehension-analysis"]
        task_hashes.update(task["semantic_sha256"] for task in tasks)
        case_hashes.update(
            case_hash
            for task in tasks
            for case_hash in task["case_semantic_sha256"]
        )
    historical = json.loads((V5_ROOT / "cohort-manifest.json").read_text())
    task_hashes.update(
        semantic_hash
        for cohort in historical["cohorts"].values()
        for semantic_hash in cohort["semantic_sha256"]
    )
    return task_hashes, case_hashes


def cohort_manifest() -> dict[str, Any]:
    corpus = make_corpus()
    tasks = corpus["fixtures"]["comprehension-analysis"]
    prior_tasks, prior_cases = prior_analysis_hashes()
    semantic_hashes = [task["semantic_sha256"] for task in tasks]
    case_hashes = [
        case_hash
        for task in tasks
        for case_hash in task["case_semantic_sha256"]
    ]
    prompt_hashes = [
        {
            "variant": job["variant"],
            "sentinel": job["sentinel"],
            "sha256": core.sha256_text(core.prompt_for(job["arm"], job["task"])),
        }
        for job in jobs()
    ]
    value = {
        "schema": SCHEMA,
        "kind": "fresh-cohort-manifest",
        "cohort": COHORT,
        "seed": COHORT_SEED,
        "batch_counts": list(BATCH_COUNTS),
        "corpus_sha256": corpus["sha256"],
        "fixture_sha256": [task["sha256"] for task in tasks],
        "semantic_sha256": semantic_hashes,
        "case_semantic_sha256": case_hashes,
        "prior_task_semantic_overlap": sorted(set(semantic_hashes) & prior_tasks),
        "prior_case_semantic_overlap": sorted(set(case_hashes) & prior_cases),
        "prompt_sha256": prompt_hashes,
    }
    value["sha256"] = core.digest(value)
    return value


def dependency_manifest() -> dict[str, Any]:
    actual_files = {
        name: file_sha256(BENCHMARKS_ROOT / name)
        for name in DEPENDENCY_FILES
    }
    gemini = retained_gemini()
    r4, r4_summary = retained_r4()
    cohort = cohort_manifest()
    tasks = make_corpus()["fixtures"]["comprehension-analysis"]
    value = {
        "schema": SCHEMA,
        "kind": "frozen-dependency-manifest",
        "files": actual_files,
        "files_match": actual_files == DEPENDENCY_FILES,
        "cohort_manifest_sha256": cohort["sha256"],
        "fresh_task_semantics": not cohort["prior_task_semantic_overlap"],
        "fresh_case_semantics": not cohort["prior_case_semantic_overlap"],
        "fixture_formulas_pass": all(
            all(core.analysis_fixture_checks(task).values())
            for task in tasks
        ),
        "gemini_manifest_sha256": gemini["manifest_sha256"],
        "gemini_gate": analysis_gate(gemini),
        "r4_manifest_sha256": r4["manifest_sha256"],
        "r4_gate": r4["analysis_gate"],
        "r4_decision": r4_summary["decision"],
        "reuse_rule": "Retain Gemini's eligible r3 gate. Run only Haiku on the fresh matched-difficulty r5 cohort.",
    }
    value["sha256"] = core.digest(value)
    return value


def request_payload(prompt: str) -> dict[str, Any]:
    return {
        "model": MODEL,
        "max_tokens": SETTINGS["max_tokens"],
        "thinking": SETTINGS["thinking"],
        "messages": [{"role": "user", "content": prompt}],
        "output_config": {
            "format": {"type": "json_schema", "schema": OUTER_SCHEMA}
        },
    }


def request_spec(key: str, prompt: str) -> dict[str, Any]:
    return {
        "url": "https://api.anthropic.com/v1/messages",
        "headers": {"x-api-key": key, "anthropic-version": "2023-06-01"},
        "payload": request_payload(prompt),
    }


def count_spec(key: str, prompt: str) -> dict[str, Any]:
    payload = request_payload(prompt)
    payload.pop("max_tokens")
    return {
        "url": COST_BOUND["token_count_endpoint"],
        "headers": {"x-api-key": key, "anthropic-version": "2023-06-01"},
        "payload": payload,
    }


def transport_screen() -> dict[str, Any]:
    payload = request_payload("probe")
    count_payload = count_spec("redacted", "probe")["payload"]
    actual = {
        "model": payload["model"],
        "max_tokens": payload["max_tokens"],
        "thinking": payload["thinking"],
        "structured_output": payload["output_config"]["format"],
        "effort_absent": "effort" not in payload["output_config"],
        "temperature_absent": "temperature" not in payload,
        "count_omits_max_tokens": "max_tokens" not in count_payload,
        "count_matches_request": all(
            count_payload[name] == payload[name]
            for name in ("model", "thinking", "messages", "output_config")
        ),
    }
    expected = {
        "model": MODEL,
        "max_tokens": 12000,
        "thinking": {"type": "enabled", "budget_tokens": 1024},
        "structured_output": {"type": "json_schema", "schema": OUTER_SCHEMA},
        "effort_absent": True,
        "temperature_absent": True,
        "count_omits_max_tokens": True,
        "count_matches_request": True,
    }
    return {"actual": actual, "expected": expected, "pass": actual == expected}


def contract_screen() -> dict[str, Any]:
    job_values = jobs()
    positive = [
        core.score_response(
            job["arm"],
            job["task"],
            core.perfect_payload(job["arm"], job["task"]),
        )["primary_pass"]
        for job in job_values
    ]
    negative = [
        not core.score_response(job["arm"], job["task"], "INVALID")["syntax_pass"]
        for job in job_values
    ]
    mutations = core.mutation_tests()
    return {
        "job_count": len(job_values),
        "unique_count": sum(not job["sentinel"] for job in job_values),
        "sentinel_count": sum(job["sentinel"] for job in job_values),
        "perfect_outputs_pass": all(positive),
        "invalid_outputs_rejected": all(negative),
        "focused_mutations_pass": all(row["pass"] for row in mutations),
        "focused_mutation_count": len(mutations),
    }


def synthetic_run(passed: int, unavailable: int = 0) -> dict[str, Any]:
    results = []
    unique_index = 0
    for job in jobs():
        passing = unique_index < passed
        score = {
            "syntax_pass": True,
            "primary_pass": passing,
            "musical_pass": passing,
            "checks": {},
            "diagnostic": None
            if passing
            else {"class": "musical-contract", "failed_checks": ["synthetic"]},
        }
        state = core.result_state("initial", score)
        if not job["sentinel"] and unique_index >= 5 - unavailable:
            state = core.result_state("unavailable", reason="output-limit")
        results.append(
            {
                **{
                    name: job[name]
                    for name in ("arm", "family", "variant", "sentinel")
                },
                "initial": state,
                "repair": None,
            }
        )
        unique_index += not job["sentinel"]
    return {"provider": PROVIDER, "results": results}


def aggregation_screen() -> dict[str, Any]:
    eligible_low = analysis_gate(synthetic_run(1))
    eligible_high = analysis_gate(synthetic_run(4))
    floor = analysis_gate(synthetic_run(0))
    ceiling = analysis_gate(synthetic_run(5))
    incomplete = analysis_gate(synthetic_run(2, unavailable=1))
    return {
        "eligible_lower_boundary": eligible_low["eligible"],
        "eligible_upper_boundary": eligible_high["eligible"],
        "floor_detected": floor["floor"] and not floor["eligible"],
        "ceiling_detected": ceiling["ceiling"] and not ceiling["eligible"],
        "incomplete_rejected": not incomplete["complete"]
        and not incomplete["eligible"],
    }


class CostGuard:
    def __init__(self) -> None:
        self.message_attempts = 0
        self.token_count_requests = 0
        self.settled_cost_usd = 0.0
        self.committed_cost_usd = 0.0
        self.failed_reservations = 0

    def record_token_count(self, input_tokens: int) -> None:
        self.token_count_requests += 1
        if self.token_count_requests > MAXIMUM_TOKEN_COUNT_REQUESTS:
            raise RuntimeError("The token-count request limit is exhausted")
        if input_tokens + TOKEN_COUNT_MARGIN > INPUT_TOKEN_CEILING:
            raise RuntimeError("The input-token cost ceiling is exceeded")

    def authorize_message(self) -> float:
        if self.message_attempts >= MAXIMUM_CALLS:
            raise RuntimeError("The message-call limit is exhausted")
        projected = round(self.committed_cost_usd + MAXIMUM_CALL_COST_USD, 6)
        if projected > MAXIMUM_COST_USD:
            raise RuntimeError("The approved cost ceiling would be exceeded")
        self.message_attempts += 1
        self.committed_cost_usd = projected
        return MAXIMUM_CALL_COST_USD

    def settle(self, reservation: float, measured: dict[str, int], actual_cost: float) -> None:
        if measured["input_tokens"] > INPUT_TOKEN_CEILING:
            raise RuntimeError("Measured input tokens exceed the cost bound")
        if measured["output_tokens"] > SETTINGS["max_tokens"]:
            raise RuntimeError("Measured output tokens exceed the request bound")
        if actual_cost > reservation:
            raise RuntimeError("Measured call cost exceeds its reservation")
        self.settled_cost_usd = round(self.settled_cost_usd + actual_cost, 6)
        self.committed_cost_usd = round(
            self.committed_cost_usd - reservation + actual_cost,
            6,
        )

    def retain_failed_reservation(self) -> None:
        self.failed_reservations += 1

    def snapshot(self) -> dict[str, Any]:
        return {
            "message_attempts": self.message_attempts,
            "token_count_requests": self.token_count_requests,
            "settled_cost_usd": self.settled_cost_usd,
            "committed_cost_usd": self.committed_cost_usd,
            "failed_reservations": self.failed_reservations,
            "maximum_cost_usd": MAXIMUM_COST_USD,
        }


def cost_guard_screen() -> dict[str, Any]:
    full = CostGuard()
    for _ in range(MAXIMUM_CALLS):
        full.record_token_count(INPUT_TOKEN_CEILING - TOKEN_COUNT_MARGIN)
        full.authorize_message()
    return {
        "maximum_call_cost_exact": MAXIMUM_CALL_COST_USD == 0.065,
        "maximum_total_cost_exact": MAXIMUM_COST_USD == 0.78,
        "twelve_calls_fit": full.committed_cost_usd == MAXIMUM_COST_USD,
        "thirteenth_call_rejected": expect_rejected(full.authorize_message),
        "oversized_input_rejected": expect_rejected(
            lambda: CostGuard().record_token_count(INPUT_TOKEN_CEILING)
        ),
        "settlement_releases_reserve": _settlement_screen(),
    }


def _settlement_screen() -> bool:
    guard = CostGuard()
    guard.record_token_count(1000)
    reservation = guard.authorize_message()
    guard.settle(
        reservation,
        {
            "input_tokens": 1000,
            "cached_input_tokens": 0,
            "output_tokens": 1000,
            "thinking_tokens": 900,
        },
        0.006,
    )
    return guard.snapshot() == {
        "message_attempts": 1,
        "token_count_requests": 1,
        "settled_cost_usd": 0.006,
        "committed_cost_usd": 0.006,
        "failed_reservations": 0,
        "maximum_cost_usd": 0.78,
    }


def deterministic_screen() -> dict[str, Any]:
    dependencies = dependency_manifest()
    contracts = contract_screen()
    request = transport_screen()
    aggregation = aggregation_screen()
    cost_guard = cost_guard_screen()
    value = {
        "dependencies": dependencies,
        "contracts": contracts,
        "request": request,
        "aggregation": aggregation,
        "cost_guard": cost_guard,
        "all_checks_pass": dependencies["files_match"]
        and dependencies["fresh_task_semantics"]
        and dependencies["fresh_case_semantics"]
        and dependencies["fixture_formulas_pass"]
        and contracts["job_count"] == 6
        and contracts["unique_count"] == 5
        and contracts["sentinel_count"] == 1
        and contracts["perfect_outputs_pass"]
        and contracts["invalid_outputs_rejected"]
        and contracts["focused_mutations_pass"]
        and request["pass"]
        and all(aggregation.values())
        and all(cost_guard.values()),
    }
    value["sha256"] = core.digest(value)
    return value


def source_hashes() -> dict[str, str]:
    return {"benchmark.py": file_sha256(PACKAGE_ROOT / "benchmark.py")}


def protocol_manifest() -> dict[str, Any]:
    job_values = jobs()
    dependency = dependency_manifest()
    cohort = cohort_manifest()
    value = {
        "schema": SCHEMA,
        "run_id": RUN_ID,
        "kind": "haiku-output-limit-repair-protocol",
        "provider": PROVIDER,
        "model": MODEL,
        "settings": SETTINGS,
        "temperature": "Provider default. The request does not set temperature.",
        "arm": "exact-object-json",
        "decision_family": "comprehension-analysis",
        "cohort": COHORT,
        "cohort_sha256": make_corpus()["sha256"],
        "cohort_manifest_sha256": cohort["sha256"],
        "dependency_manifest_sha256": dependency["sha256"],
        "implementation_sha256": source_hashes(),
        "retained_gemini": {
            "manifest_sha256": RETAINED["gemini_manifest_sha256"],
            "raw_run_sha256": RETAINED["gemini_raw_run_sha256"],
            "gate": dependency["gemini_gate"],
            "new_calls": 0,
        },
        "retained_r4": {
            "manifest_sha256": RETAINED["r4_manifest_sha256"],
            "raw_run_sha256": RETAINED["r4_raw_run_sha256"],
            "summary_sha256": RETAINED["r4_summary_sha256"],
            "gate": dependency["r4_gate"],
            "decision": dependency["r4_decision"],
        },
        "calls": {
            "unique_initial": sum(not job["sentinel"] for job in job_values),
            "named_sentinel_initial": sum(job["sentinel"] for job in job_values),
            "initial": len(job_values),
            "maximum_repair": len(job_values),
            "maximum_total": MAXIMUM_CALLS,
            "maximum_free_token_count_requests": MAXIMUM_TOKEN_COUNT_REQUESTS,
            "new_gemini": 0,
            "new_sonnet": 0,
            "new_openai": 0,
        },
        "cost_bound": COST_BOUND,
        "eligibility_band": ELIGIBILITY_BAND,
        "stopping_rule": "Return analysis-repair-pass only when all five fresh Haiku initial results are scored and the pass rate is 0.20 through 0.80. Otherwise return repair-measurement. Retain the frozen eligible Gemini r3 result as the second provider gate.",
        "repair_policy": REPAIR_POLICY,
        "freshness_rule": "Use fresh Haiku task and case semantics with the unchanged easy-tier batch-count schedule. Do not rerun another provider.",
        "comparison_limit": "R5 is a provider-specific settings repair. Gemini and Haiku use matched difficulty schedules, not identical fixtures.",
        "r2_dependency": {
            "summary_sha256": RETAINED["r2_summary_sha256"],
            "retained_eligibility": {
                "continuation-motif": 2,
                "generation-progression": 3,
            },
            "rule": "Use the retained r2 motif and progression evidence only after analysis-repair-pass.",
        },
        "privacy": "Generated MIT symbolic text only. Do not send live project, audio, or MIDI data.",
        "provider_retry": "Do not retry a message request. A failed attempt keeps its full cost reservation.",
        "cost_preflight": "Use the free Anthropic token-count endpoint before every message request. Reject a prompt above the input ceiling and reserve the maximum call cost before inference.",
        "credential_preflight": "Require only ANTHROPIC_API_KEY after approval and deterministic validation.",
        "approval_boundary": "No Haiku message or token-count request is approved until the operator approves the exact run-plan hash.",
        "format_selection": None,
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    value = {
        "schema": SCHEMA,
        "run_kind": "haiku-output-limit-repair-plan",
        "run_id": RUN_ID,
        "protocol_sha256": protocol["sha256"],
        "dependency_manifest_sha256": protocol["dependency_manifest_sha256"],
        "cohort_manifest_sha256": protocol["cohort_manifest_sha256"],
        "provider": PROVIDER,
        "model": MODEL,
        "settings": SETTINGS,
        "calls": protocol["calls"],
        "maximum_calls": MAXIMUM_CALLS,
        "maximum_cost_usd": MAXIMUM_COST_USD,
        "cost_bound": COST_BOUND,
        "eligibility_band": ELIGIBILITY_BAND,
        "stopping_rule": protocol["stopping_rule"],
        "repair_policy": REPAIR_POLICY,
        "approval": "pending",
    }
    value["sha256"] = core.digest(value)
    return value


def deterministic_package() -> dict[str, Any]:
    value = {
        "schema": SCHEMA,
        "run_kind": "deterministic",
        "screen": deterministic_screen(),
        "protocol": protocol_manifest(),
        "run_plan": run_plan(),
    }
    value["sha256"] = core.digest(value)
    return value


def deterministic_manifest(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": value["schema"],
        "sha256": value["sha256"],
        "screen_sha256": value["screen"]["sha256"],
        "protocol_sha256": value["protocol"]["sha256"],
        "cohort_sha256": value["protocol"]["cohort_sha256"],
        "cohort_manifest_sha256": value["protocol"]["cohort_manifest_sha256"],
        "dependency_manifest_sha256": value["protocol"]["dependency_manifest_sha256"],
        "run_plan_sha256": value["run_plan"]["sha256"],
    }


def self_test() -> dict[str, Any]:
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise AssertionError("The deterministic screen failed")
    if run_plan()["maximum_calls"] != 12 or run_plan()["maximum_cost_usd"] != 0.78:
        raise AssertionError("The cost or call limit changed")
    return {
        "schema": SCHEMA,
        "pass": True,
        "checks": screen["contracts"]["focused_mutation_count"] + 36,
        "cohort_sha256": make_corpus()["sha256"],
        "deterministic_sha256": deterministic_package()["sha256"],
    }


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    if (
        value.get("run_id") != RUN_ID
        or value.get("protocol_sha256") != plan["protocol_sha256"]
        or value.get("run_plan_sha256") != plan["sha256"]
    ):
        raise ValueError("Approval does not match the frozen Phase 8c4b r5 plan")
    if (
        value.get("status") != "approved"
        or not isinstance(value.get("operator_statement"), str)
        or not value["operator_statement"].strip()
    ):
        raise ValueError("Approval needs an explicit operator statement")
    return value


def cost_usd(measured: dict[str, int]) -> dict[str, float]:
    cached = measured["cached_input_tokens"]
    parts = {
        "uncached_input": max(0, measured["input_tokens"] - cached)
        * PRICES_USD_PER_MILLION["input"]
        / 1_000_000,
        "cached_input": cached
        * PRICES_USD_PER_MILLION["cached_input"]
        / 1_000_000,
        "output": measured["output_tokens"]
        * PRICES_USD_PER_MILLION["output"]
        / 1_000_000,
    }
    parts["total"] = sum(parts.values())
    return {name: round(value, 8) for name, value in parts.items()}


def count_input_tokens(key: str, prompt: str, guard: CostGuard) -> int:
    spec = count_spec(key, prompt)
    raw = transport.post_json(spec["url"], spec["headers"], spec["payload"])
    input_tokens = raw.get("input_tokens")
    if not isinstance(input_tokens, int) or input_tokens < 0:
        raise ValueError("The token-count response is invalid")
    guard.record_token_count(input_tokens)
    return input_tokens


def model_call(key: str, prompt: str) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    spec = request_spec(key, prompt)
    raw = transport.post_json(spec["url"], spec["headers"], spec["payload"])
    if transport.stop_reason("claude", raw) == "max_tokens":
        return None, raw
    text = "".join(
        block.get("text", "")
        for block in raw["content"]
        if block.get("type") == "text"
    )
    return transport.parse_outer(text), raw


def one_call(
    key: str,
    prompt: str,
    task: dict[str, Any],
    arm: str,
    kind: str,
    guard: CostGuard,
) -> tuple[dict[str, Any], dict[str, Any]]:
    input_token_estimate = count_input_tokens(key, prompt, guard)
    reservation = guard.authorize_message()
    started = time.perf_counter()
    try:
        outer, raw = model_call(key, prompt)
    except Exception:
        guard.retain_failed_reservation()
        raise
    latency_ms = (time.perf_counter() - started) * 1000
    measured = transport.usage("claude", raw)
    cost = cost_usd(measured)
    guard.settle(reservation, measured, cost["total"])
    reason = transport.stop_reason("claude", raw)
    call = {
        "prompt_sha256": core.sha256_text(prompt),
        "prompt_bytes": len(prompt.encode()),
        "input_token_estimate": input_token_estimate,
        "input_token_margin": TOKEN_COUNT_MARGIN,
        "cost_reservation_usd": reservation,
        "usage": measured,
        "cost_usd": cost,
        "latency_ms": round(latency_ms, 3),
        "retries": 0,
        "returned_model": transport.returned_model("claude", raw),
        "request_id": raw.get("id"),
        "stop_reason": reason,
        "raw_response_sha256": core.digest(raw),
    }
    if reason == "max_tokens":
        return core.result_state("unavailable", reason="output-limit"), call
    if outer is None:
        raise AssertionError("A complete response has no parsed envelope")
    payload = outer["payload"]
    call.update(
        {
            "response_payload": payload,
            "response_payload_bytes": len(payload.encode()),
            "response_payload_sha256": core.sha256_text(payload),
            "outer_schema_valid": outer["outer_schema_valid"],
        }
    )
    score = core.score_response(arm, task, payload)
    if not outer["outer_schema_valid"]:
        score = {
            "syntax_pass": False,
            "musical_pass": False,
            "primary_pass": False,
            "checks": {},
            "diagnostic": {
                "class": "parse",
                "error_type": "OuterSchema",
                "message": "The response envelope is invalid.",
            },
        }
    return core.result_state(kind, score), call


def initial_result(key: str, job: dict[str, Any], guard: CostGuard) -> dict[str, Any]:
    prompt = core.prompt_for(job["arm"], job["task"])
    common = {
        "arm": job["arm"],
        "family": job["family"],
        "variant": job["variant"],
        "sentinel": job["sentinel"],
        "task_sha256": job["task"]["sha256"],
        "semantic_sha256": job["task"]["semantic_sha256"],
    }
    try:
        initial, initial_call = one_call(
            key,
            prompt,
            job["task"],
            job["arm"],
            "initial",
            guard,
        )
    except Exception as error:
        initial = core.result_state(
            "failed",
            reason=f"{type(error).__name__}: {error}",
        )
        initial_call = None
    return {
        **common,
        "prompt": prompt,
        "task": job["task"],
        "initial": initial,
        "initial_call": initial_call,
        "repair": None,
        "repair_call": None,
    }


def add_repair(key: str, row: dict[str, Any], guard: CostGuard) -> None:
    initial = row["initial"]
    if initial["kind"] != "initial" or initial["score"]["primary_pass"]:
        return
    prompt = core.repair_prompt(row["prompt"], initial["score"]["diagnostic"])
    try:
        row["repair"], row["repair_call"] = one_call(
            key,
            prompt,
            row["task"],
            row["arm"],
            "repaired",
            guard,
        )
    except Exception as error:
        row["repair"] = core.result_state(
            "failed",
            reason=f"{type(error).__name__}: {error}",
        )


def execute_jobs(key: str) -> tuple[list[dict[str, Any]], CostGuard]:
    ordered = jobs()
    random.Random(8604).shuffle(ordered)
    guard = CostGuard()
    results = []
    for index, job in enumerate(ordered, start=1):
        results.append(initial_result(key, job, guard))
        print(
            f"haiku: completed {index}/{len(ordered)} initial jobs",
            file=sys.stderr,
            flush=True,
        )
    for row in results:
        add_repair(key, row, guard)
    for row in results:
        row.pop("prompt")
        row.pop("task")
    return (
        sorted(
            results,
            key=lambda row: (
                row["arm"],
                row["family"],
                row["variant"],
                row["sentinel"],
            ),
        ),
        guard,
    )


def run_provider(env_file: Path, approval_file: Path) -> dict[str, Any]:
    approval = validate_approval(approval_file)
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise ValueError("The deterministic screen failed")
    gemini = retained_gemini()
    environment = transport.load_env(env_file)
    if not environment.get(KEY_NAME):
        raise ValueError(f"Provider credential preflight failed: {KEY_NAME}")
    results, guard = execute_jobs(environment[KEY_NAME])
    calls = [row.get("initial_call") for row in results] + [
        row.get("repair_call") for row in results
    ]
    completed_calls = [value for value in calls if value is not None]
    value = {
        "schema": SCHEMA,
        "run_kind": "haiku-output-limit-repair-provider",
        "run_id": RUN_ID,
        "provider": PROVIDER,
        "cohort": COHORT,
        "cohort_sha256": make_corpus()["sha256"],
        "requested_model": MODEL,
        "settings": SETTINGS,
        "client": "Python urllib.request direct HTTPS",
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "python": platform.python_version(),
        "privacy": protocol_manifest()["privacy"],
        "protocol_sha256": protocol_manifest()["sha256"],
        "screen_sha256": screen["sha256"],
        "run_plan_sha256": run_plan()["sha256"],
        "approval": approval,
        "retained_gemini_manifest_sha256": gemini["manifest_sha256"],
        "results": results,
        "actual_calls": guard.message_attempts,
        "completed_calls": len(completed_calls),
        "actual_cost_usd": round(
            sum(item["cost_usd"]["total"] for item in completed_calls),
            6,
        ),
        "cost_guard": guard.snapshot(),
        "complete": len(results) == 6,
    }
    value["analysis_gate"] = analysis_gate(value)
    value["raw_run_sha256"] = core.digest(
        [item["raw_response_sha256"] for item in completed_calls]
    )
    value["manifest_sha256"] = core.digest(value)
    return value


def load_haiku_manifest(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    claimed = value.get("manifest_sha256")
    unsigned = deepcopy(value)
    unsigned.pop("manifest_sha256", None)
    if not isinstance(claimed, str) or core.digest(unsigned) != claimed:
        raise ValueError("The Haiku manifest hash is invalid")
    if value.get("run_id") != RUN_ID or value.get("protocol_sha256") != protocol_manifest()["sha256"]:
        raise ValueError("The Haiku manifest does not use the frozen protocol")
    if value.get("provider") != PROVIDER or value.get("requested_model") != MODEL:
        raise ValueError("The Haiku manifest has the wrong provider or model")
    if value.get("actual_calls", MAXIMUM_CALLS + 1) > MAXIMUM_CALLS:
        raise ValueError("The Haiku manifest exceeds the call limit")
    if value.get("cost_guard", {}).get("committed_cost_usd", MAXIMUM_COST_USD + 1) > MAXIMUM_COST_USD:
        raise ValueError("The Haiku manifest exceeds the cost limit")
    return value


def summarize(path: Path) -> dict[str, Any]:
    haiku = load_haiku_manifest(path)
    gemini = retained_gemini()
    haiku_gate = analysis_gate(haiku)
    decision = "analysis-repair-pass" if haiku_gate["eligible"] else "repair-measurement"
    value = {
        "schema": SCHEMA,
        "run_kind": "haiku-output-limit-repair-summary",
        "run_id": RUN_ID,
        "decision": decision,
        "format_selection": None,
        "cohort": COHORT,
        "provider_gates": {
            "gemini": analysis_gate(gemini),
            PROVIDER: haiku_gate,
        },
        "comparison_limit": "Gemini and Haiku use matched difficulty schedules, not identical fixtures.",
        "eligibility_band": ELIGIBILITY_BAND,
        "retained": RETAINED,
        "r2_dependency": "Use the retained r2 motif and progression eligibility only when analysis-repair-pass.",
    }
    value["sha256"] = core.digest(value)
    return value


def write_result(value: dict[str, Any], output: Path | None) -> None:
    rendered = json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered)
    else:
        print(rendered, end="")


def main() -> None:
    parser = argparse.ArgumentParser()
    actions = parser.add_mutually_exclusive_group(required=True)
    actions.add_argument("--self-test", action="store_true")
    actions.add_argument("--deterministic", action="store_true")
    actions.add_argument("--dependencies", action="store_true")
    actions.add_argument("--cohort", action="store_true")
    actions.add_argument("--run-plan", action="store_true")
    actions.add_argument("--check", type=Path)
    actions.add_argument("--provider", choices=("haiku",))
    actions.add_argument("--summarize", type=Path)
    parser.add_argument("--env-file", type=Path, default=Path("../.env"))
    parser.add_argument("--approval-file", type=Path, default=APPROVAL_PATH)
    parser.add_argument("--output", type=Path)
    arguments = parser.parse_args()
    if arguments.self_test:
        write_result(self_test(), arguments.output)
    elif arguments.deterministic:
        write_result(deterministic_package(), arguments.output)
    elif arguments.dependencies:
        write_result(dependency_manifest(), arguments.output)
    elif arguments.cohort:
        write_result(cohort_manifest(), arguments.output)
    elif arguments.run_plan:
        write_result(run_plan(), arguments.output)
    elif arguments.check:
        expected = json.loads(arguments.check.read_text())
        actual = deterministic_manifest(deterministic_package())
        if actual != expected:
            raise SystemExit("The deterministic package does not match the frozen manifest")
        print(json.dumps(actual, indent=2, sort_keys=True))
    elif arguments.provider:
        write_result(
            run_provider(arguments.env_file, arguments.approval_file),
            arguments.output,
        )
    else:
        write_result(summarize(arguments.summarize), arguments.output)


if __name__ == "__main__":
    main()
