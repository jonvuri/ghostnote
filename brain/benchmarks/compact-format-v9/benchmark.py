#!/usr/bin/env python3
"""Prepare and run the Phase 8c4b OpenAI analysis supplement."""

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
V8_ROOT = BENCHMARKS_ROOT / "compact-format-v8"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


base = load_module("ghostnote_compact_format_v9_base", V8_ROOT / "benchmark.py")
core = base.core
transport = base.transport

SCHEMA = "ghostnote-compact-format-openai-supplement-v9"
RUN_ID = "phase8c4b-analysis-openai-supplement-r6"
PROVIDER = "openai"
MODEL = "gpt-5.4-mini-2026-03-17"
KEY_NAME = "OPENAI_API_KEY"
SETTINGS = {
    "reasoning_effort": "low",
    "max_completion_tokens": 12000,
    "temperature": "provider default",
}
OUTER_SCHEMA = base.OUTER_SCHEMA
ELIGIBILITY_BAND = deepcopy(base.ELIGIBILITY_BAND)
REPAIR_POLICY = deepcopy(base.REPAIR_POLICY)
PRICES_USD_PER_MILLION = {
    "input": 0.75,
    "cached_input": 0.075,
    "output": 4.50,
}
INPUT_TOKEN_RESERVATION = 10000
REQUEST_BYTE_CEILING = 9000
MAXIMUM_CALLS = 12
MAXIMUM_CALL_COST_USD = round(
    INPUT_TOKEN_RESERVATION * PRICES_USD_PER_MILLION["input"] / 1_000_000
    + SETTINGS["max_completion_tokens"]
    * PRICES_USD_PER_MILLION["output"]
    / 1_000_000,
    6,
)
MAXIMUM_COST_USD = round(MAXIMUM_CALLS * MAXIMUM_CALL_COST_USD, 6)
COST_BOUND = {
    "input_token_reservation_per_call": INPUT_TOKEN_RESERVATION,
    "request_byte_ceiling_per_call": REQUEST_BYTE_CEILING,
    "output_token_ceiling_per_call": SETTINGS["max_completion_tokens"],
    "maximum_cost_per_call_usd": MAXIMUM_CALL_COST_USD,
    "maximum_calls": MAXIMUM_CALLS,
    "maximum_cost_usd": MAXIMUM_COST_USD,
    "token_count_requests": 0,
}
DEPENDENCY_FILES = {
    "compact-format-v6/core.py": "9150edfc2a2d0e873386508d406d9d92c29ca1fcf1ecd352f53fba3702d6280d",
    "compact-format-v6/runs/2026-09-28-analysis-gemini-easy.json": "3f406cd196dd9b8693ee15cd75dccd002a1e83db779021abd98cdf5912eee08b",
    "compact-format-v8/benchmark.py": "de8ab36c905fd699f70234f0ae3c399106ff4046ea8d46f1c150e6b31d43ad35",
    "compact-format-v8/cohort-manifest.json": "9929b4337aa6fa5c52ab7de58129b474b5afc71f6c2a159775d005554f93afc1",
    "compact-format-v8/expected-deterministic.json": "3085144b466cff0fd214baf825574630e14f385671e9f57eae4210094e384c7e",
    "compact-format-v8/runs/2026-09-28-analysis-haiku.json": "a8e375638c1ed1e86df74685a94a66dc89f457f0440c4957944a33dfee35d1b3",
    "compact-format-v8/runs/2026-09-28-analysis-summary.json": "ded617e6070675b0e789c08bbdea3701c1a03df7073dce1a607913892ff82050",
}
RETAINED = {
    "r5_cohort_manifest_sha256": "3ffcd022545ace31e6c47a766788ceb6e23b442354925eca111cd7d4461ccbd0",
    "r5_corpus_sha256": "1b056340b189b8a5fbef255bed783c1fe4dd706a266593abb12d9fbfdf7b599b",
    "r5_manifest_sha256": "7b2933d28a54d27635adc85b05839bb987460a46ae92e2dedd8805d26d63f1b1",
    "r5_raw_run_sha256": "d908d4ca992512ddff139dea179b8739b3572d1f14c6a7dc1fc19f08cda67af1",
    "r5_summary_sha256": "6849b0cb364fd596a3940ea107dbf54f282b2a1e22a4f138e5ec647b4ab55455",
    "gemini_manifest_sha256": "4931455793fa10ff25c7e541354328bbff342003d6fe51d99752e175bc663ef7",
    "gemini_raw_run_sha256": "b4cf34804b322f7c6c1bbb508e357b291a100850e88797f6eda0761df6a96d4a",
}
SOURCE_COHORT_PATH = V8_ROOT / "cohort-manifest.json"
R5_RUN_PATH = V8_ROOT / "runs" / "2026-09-28-analysis-haiku.json"
R5_SUMMARY_PATH = V8_ROOT / "runs" / "2026-09-28-analysis-summary.json"
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "calibration-r6-approval.json"


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def expect_rejected(action: Callable[[], Any]) -> bool:
    try:
        action()
    except (KeyError, RuntimeError, TypeError, ValueError, json.JSONDecodeError):
        return True
    return False


def make_corpus() -> dict[str, Any]:
    """Return the exact r5 corpus without regeneration changes."""
    return deepcopy(base.make_corpus())


def jobs() -> list[dict[str, Any]]:
    """Return the exact r5 unique tasks and named sentinel."""
    return deepcopy(base.jobs())


def analysis_gate(run: dict[str, Any]) -> dict[str, Any]:
    return base.analysis_gate(run)


def load_signed(path: Path, signature_name: str) -> dict[str, Any]:
    value = json.loads(path.read_text())
    unsigned = deepcopy(value)
    claimed = unsigned.pop(signature_name, None)
    if not isinstance(claimed, str) or core.digest(unsigned) != claimed:
        raise ValueError(f"The signed artifact is invalid: {path}")
    return value


def retained_evidence() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    haiku = load_signed(R5_RUN_PATH, "manifest_sha256")
    if (
        haiku["manifest_sha256"] != RETAINED["r5_manifest_sha256"]
        or haiku.get("raw_run_sha256") != RETAINED["r5_raw_run_sha256"]
        or haiku.get("cohort_sha256") != RETAINED["r5_corpus_sha256"]
        or analysis_gate(haiku)
        != {
            "passed": 1,
            "denominator": 5,
            "rate": 0.2,
            "complete": True,
            "eligible": True,
            "ceiling": False,
            "floor": False,
        }
    ):
        raise ValueError("The retained Haiku r5 evidence changed")

    summary = load_signed(R5_SUMMARY_PATH, "sha256")
    if (
        summary["sha256"] != RETAINED["r5_summary_sha256"]
        or summary.get("decision") != "analysis-repair-pass"
        or not summary.get("provider_gates", {}).get("gemini", {}).get("eligible")
        or not summary.get("provider_gates", {}).get("claude-haiku", {}).get("eligible")
    ):
        raise ValueError("The retained r5 summary changed")

    gemini = base.retained_gemini()
    if (
        gemini.get("manifest_sha256") != RETAINED["gemini_manifest_sha256"]
        or gemini.get("raw_run_sha256") != RETAINED["gemini_raw_run_sha256"]
        or not analysis_gate(gemini)["eligible"]
    ):
        raise ValueError("The retained Gemini evidence changed")
    return gemini, haiku, summary


def cohort_manifest() -> dict[str, Any]:
    source = json.loads(SOURCE_COHORT_PATH.read_text())
    generated = base.cohort_manifest()
    if source != generated or source.get("sha256") != RETAINED["r5_cohort_manifest_sha256"]:
        raise ValueError("The frozen r5 cohort changed")
    value = {
        "schema": SCHEMA,
        "kind": "reused-unseen-provider-cohort-manifest",
        "cohort": source["cohort"],
        "seed": source["seed"],
        "batch_counts": source["batch_counts"],
        "corpus_sha256": source["corpus_sha256"],
        "fixture_sha256": source["fixture_sha256"],
        "semantic_sha256": source["semantic_sha256"],
        "case_semantic_sha256": source["case_semantic_sha256"],
        "prompt_sha256": source["prompt_sha256"],
        "source_manifest_sha256": source["sha256"],
        "provider_exposure": {
            "haiku": "seen in r5",
            "openai": "unseen before r6",
        },
        "reuse_rule": "Use the exact r5 corpus for the previously unseen OpenAI provider. Do not treat r6 as a fresh cohort or change the completed r5 decision.",
    }
    value["sha256"] = core.digest(value)
    return value


def dependency_manifest() -> dict[str, Any]:
    actual_files = {
        name: file_sha256(BENCHMARKS_ROOT / name)
        for name in DEPENDENCY_FILES
    }
    gemini, haiku, summary = retained_evidence()
    cohort = cohort_manifest()
    value = {
        "schema": SCHEMA,
        "kind": "frozen-dependency-manifest",
        "files": actual_files,
        "files_match": actual_files == DEPENDENCY_FILES,
        "source_cohort_manifest_sha256": cohort["source_manifest_sha256"],
        "corpus_sha256": make_corpus()["sha256"],
        "exact_r5_fixture_reuse": make_corpus()["sha256"] == RETAINED["r5_corpus_sha256"],
        "fixture_formulas_pass": all(
            all(core.analysis_fixture_checks(task).values())
            for task in make_corpus()["fixtures"]["comprehension-analysis"]
        ),
        "gemini_manifest_sha256": gemini["manifest_sha256"],
        "gemini_gate": analysis_gate(gemini),
        "haiku_manifest_sha256": haiku["manifest_sha256"],
        "haiku_gate": analysis_gate(haiku),
        "r5_summary_sha256": summary["sha256"],
        "r5_decision": summary["decision"],
        "reuse_rule": "Run only OpenAI on the exact r5 corpus. Retain Gemini and Haiku without new calls.",
    }
    value["sha256"] = core.digest(value)
    return value


def request_payload(prompt: str) -> dict[str, Any]:
    return {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "benchmark_payload",
                "strict": True,
                "schema": OUTER_SCHEMA,
            },
        },
        "reasoning_effort": SETTINGS["reasoning_effort"],
        "max_completion_tokens": SETTINGS["max_completion_tokens"],
    }


def request_spec(key: str, prompt: str) -> dict[str, Any]:
    return {
        "url": "https://api.openai.com/v1/chat/completions",
        "headers": {"Authorization": f"Bearer {key}"},
        "payload": request_payload(prompt),
    }


def request_bytes(prompt: str) -> int:
    payload = json.dumps(
        request_payload(prompt),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return len(payload.encode())


def transport_screen() -> dict[str, Any]:
    payload = request_payload("probe")
    actual = {
        "model": payload["model"],
        "reasoning_effort": payload["reasoning_effort"],
        "max_completion_tokens": payload["max_completion_tokens"],
        "structured_output": payload["response_format"],
        "temperature_absent": "temperature" not in payload,
    }
    expected = {
        "model": MODEL,
        "reasoning_effort": "low",
        "max_completion_tokens": 12000,
        "structured_output": {
            "type": "json_schema",
            "json_schema": {
                "name": "benchmark_payload",
                "strict": True,
                "schema": OUTER_SCHEMA,
            },
        },
        "temperature_absent": True,
    }
    return {"actual": actual, "expected": expected, "pass": actual == expected}


def contract_screen() -> dict[str, Any]:
    job_values = jobs()
    mutations = core.mutation_tests()
    return {
        "job_count": len(job_values),
        "unique_count": sum(not job["sentinel"] for job in job_values),
        "sentinel_count": sum(job["sentinel"] for job in job_values),
        "perfect_outputs_pass": all(
            core.score_response(
                job["arm"],
                job["task"],
                core.perfect_payload(job["arm"], job["task"]),
            )["primary_pass"]
            for job in job_values
        ),
        "invalid_outputs_rejected": all(
            not core.score_response(job["arm"], job["task"], "INVALID")["syntax_pass"]
            for job in job_values
        ),
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
                "arm": job["arm"],
                "family": job["family"],
                "variant": job["variant"],
                "sentinel": job["sentinel"],
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


def request_size_screen() -> dict[str, Any]:
    initial_prompts = [core.prompt_for(job["arm"], job["task"]) for job in jobs()]
    repair_prompts = [
        core.repair_prompt(
            prompt,
            {
                "class": "musical-contract",
                "failed_checks": [
                    "chord_identity",
                    "root_pitch_class",
                    "bass_pitch_class",
                    "chord_quality",
                    "inversion_number",
                    "chord_function",
                    "motif_relation",
                    "rhythm_class",
                ],
            },
        )
        for prompt in initial_prompts
    ]
    sizes = [request_bytes(prompt) for prompt in initial_prompts + repair_prompts]
    return {
        "largest_screened_request_bytes": max(sizes),
        "request_byte_ceiling": REQUEST_BYTE_CEILING,
        "screened_requests_fit": max(sizes) <= REQUEST_BYTE_CEILING,
    }


class CostGuard:
    def __init__(self) -> None:
        self.message_attempts = 0
        self.settled_cost_usd = 0.0
        self.committed_cost_usd = 0.0
        self.failed_reservations = 0

    def authorize_message(self, payload_bytes: int) -> float:
        if payload_bytes > REQUEST_BYTE_CEILING:
            raise RuntimeError("The request-byte ceiling is exceeded")
        if self.message_attempts >= MAXIMUM_CALLS:
            raise RuntimeError("The message-call limit is exhausted")
        projected = round(self.committed_cost_usd + MAXIMUM_CALL_COST_USD, 6)
        if projected > MAXIMUM_COST_USD:
            raise RuntimeError("The approved cost ceiling would be exceeded")
        self.message_attempts += 1
        self.committed_cost_usd = projected
        return MAXIMUM_CALL_COST_USD

    def settle(self, reservation: float, measured: dict[str, int], actual_cost: float) -> None:
        if measured["input_tokens"] > INPUT_TOKEN_RESERVATION:
            raise RuntimeError("Measured input tokens exceed the reservation")
        if measured["output_tokens"] > SETTINGS["max_completion_tokens"]:
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
            "settled_cost_usd": self.settled_cost_usd,
            "committed_cost_usd": self.committed_cost_usd,
            "failed_reservations": self.failed_reservations,
            "maximum_cost_usd": MAXIMUM_COST_USD,
        }


def cost_guard_screen() -> dict[str, Any]:
    full = CostGuard()
    for _ in range(MAXIMUM_CALLS):
        full.authorize_message(REQUEST_BYTE_CEILING)
    return {
        "maximum_call_cost_exact": MAXIMUM_CALL_COST_USD == 0.0615,
        "maximum_total_cost_exact": MAXIMUM_COST_USD == 0.738,
        "twelve_calls_fit": full.committed_cost_usd == MAXIMUM_COST_USD,
        "thirteenth_call_rejected": expect_rejected(
            lambda: full.authorize_message(REQUEST_BYTE_CEILING)
        ),
        "oversized_request_rejected": expect_rejected(
            lambda: CostGuard().authorize_message(REQUEST_BYTE_CEILING + 1)
        ),
        "settlement_releases_reserve": _settlement_screen(),
    }


def _settlement_screen() -> bool:
    guard = CostGuard()
    reservation = guard.authorize_message(5000)
    guard.settle(
        reservation,
        {
            "input_tokens": 2000,
            "cached_input_tokens": 0,
            "output_tokens": 1000,
            "thinking_tokens": 500,
        },
        0.006,
    )
    return guard.snapshot() == {
        "message_attempts": 1,
        "settled_cost_usd": 0.006,
        "committed_cost_usd": 0.006,
        "failed_reservations": 0,
        "maximum_cost_usd": 0.738,
    }


def deterministic_screen() -> dict[str, Any]:
    dependencies = dependency_manifest()
    contracts = contract_screen()
    request = transport_screen()
    aggregation = aggregation_screen()
    request_size = request_size_screen()
    cost_guard = cost_guard_screen()
    value = {
        "dependencies": dependencies,
        "contracts": contracts,
        "request": request,
        "aggregation": aggregation,
        "request_size": request_size,
        "cost_guard": cost_guard,
        "all_checks_pass": dependencies["files_match"]
        and dependencies["exact_r5_fixture_reuse"]
        and dependencies["fixture_formulas_pass"]
        and contracts["job_count"] == 6
        and contracts["unique_count"] == 5
        and contracts["sentinel_count"] == 1
        and contracts["perfect_outputs_pass"]
        and contracts["invalid_outputs_rejected"]
        and contracts["focused_mutations_pass"]
        and request["pass"]
        and all(aggregation.values())
        and request_size["screened_requests_fit"]
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
        "kind": "openai-analysis-supplement-protocol",
        "provider": PROVIDER,
        "model": MODEL,
        "settings": SETTINGS,
        "temperature": "Provider default. The request does not set temperature.",
        "arm": "exact-object-json",
        "decision_family": "comprehension-analysis",
        "cohort": make_corpus()["cohort"],
        "cohort_sha256": make_corpus()["sha256"],
        "cohort_manifest_sha256": cohort["sha256"],
        "source_cohort_manifest_sha256": cohort["source_manifest_sha256"],
        "dependency_manifest_sha256": dependency["sha256"],
        "implementation_sha256": source_hashes(),
        "retained_providers": {
            "gemini": {
                "manifest_sha256": RETAINED["gemini_manifest_sha256"],
                "gate": dependency["gemini_gate"],
                "new_calls": 0,
            },
            "claude-haiku": {
                "manifest_sha256": RETAINED["r5_manifest_sha256"],
                "gate": dependency["haiku_gate"],
                "new_calls": 0,
            },
        },
        "calls": {
            "unique_initial": sum(not job["sentinel"] for job in job_values),
            "named_sentinel_initial": sum(job["sentinel"] for job in job_values),
            "initial": len(job_values),
            "maximum_repair": len(job_values),
            "maximum_total": MAXIMUM_CALLS,
            "new_openai": MAXIMUM_CALLS,
            "new_gemini": 0,
            "new_haiku": 0,
            "new_sonnet": 0,
            "token_count_requests": 0,
        },
        "cost_bound": COST_BOUND,
        "eligibility_band": ELIGIBILITY_BAND,
        "stopping_rule": "Record OpenAI as a third eligible analysis provider only when all five unique initial results are scored and the pass rate is 0.20 through 0.80. Otherwise retain the completed two-provider r5 decision without adding OpenAI.",
        "repair_policy": REPAIR_POLICY,
        "cohort_reuse_rule": "Use the exact r5 tasks because OpenAI has not seen them. R6 is supplemental and cannot change the completed r5 decision.",
        "comparison_limit": "OpenAI and Haiku use identical fixtures. Gemini uses the matched-difficulty r3 cohort.",
        "privacy": "Generated MIT symbolic text only. Do not send live project, audio, or MIDI data.",
        "provider_retry": "Do not retry a message request. A failed attempt keeps its full cost reservation.",
        "cost_preflight": "Reject a serialized request above 9,000 bytes. Reserve 10,000 input tokens and 12,000 output tokens before each message request.",
        "credential_preflight": "Require only OPENAI_API_KEY after approval and deterministic validation.",
        "approval_boundary": "No OpenAI request is approved until the operator approves the exact protocol and run-plan hashes.",
        "format_selection": None,
        "phase8c4b_decision_change": None,
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    value = {
        "schema": SCHEMA,
        "run_kind": "openai-analysis-supplement-plan",
        "run_id": RUN_ID,
        "protocol_sha256": protocol["sha256"],
        "dependency_manifest_sha256": protocol["dependency_manifest_sha256"],
        "cohort_manifest_sha256": protocol["cohort_manifest_sha256"],
        "source_cohort_manifest_sha256": protocol["source_cohort_manifest_sha256"],
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
    if run_plan()["maximum_calls"] != 12 or run_plan()["maximum_cost_usd"] != 0.738:
        raise AssertionError("The cost or call limit changed")
    return {
        "schema": SCHEMA,
        "pass": True,
        "checks": screen["contracts"]["focused_mutation_count"] + 38,
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
        raise ValueError("Approval does not match the frozen Phase 8c4b r6 plan")
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


def model_call(key: str, prompt: str) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    spec = request_spec(key, prompt)
    raw = transport.post_json(spec["url"], spec["headers"], spec["payload"])
    if transport.stop_reason("openai", raw) == "length":
        return None, raw
    text = raw["choices"][0]["message"].get("content")
    if not isinstance(text, str):
        raise ValueError("The OpenAI response has no text content")
    return transport.parse_outer(text), raw


def one_call(
    key: str,
    prompt: str,
    task: dict[str, Any],
    arm: str,
    kind: str,
    guard: CostGuard,
) -> tuple[dict[str, Any], dict[str, Any]]:
    payload_bytes = request_bytes(prompt)
    reservation = guard.authorize_message(payload_bytes)
    started = time.perf_counter()
    try:
        outer, raw = model_call(key, prompt)
    except Exception:
        guard.retain_failed_reservation()
        raise
    latency_ms = (time.perf_counter() - started) * 1000
    measured = transport.usage("openai", raw)
    cost = cost_usd(measured)
    guard.settle(reservation, measured, cost["total"])
    reason = transport.stop_reason("openai", raw)
    call = {
        "prompt_sha256": core.sha256_text(prompt),
        "prompt_bytes": len(prompt.encode()),
        "request_bytes": payload_bytes,
        "input_token_reservation": INPUT_TOKEN_RESERVATION,
        "cost_reservation_usd": reservation,
        "usage": measured,
        "cost_usd": cost,
        "latency_ms": round(latency_ms, 3),
        "retries": 0,
        "returned_model": transport.returned_model("openai", raw),
        "request_id": raw.get("id"),
        "stop_reason": reason,
        "raw_response_sha256": core.digest(raw),
    }
    if reason == "length":
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
            f"openai: completed {index}/{len(ordered)} initial jobs",
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
        "run_kind": "openai-analysis-supplement-provider",
        "run_id": RUN_ID,
        "provider": PROVIDER,
        "cohort": make_corpus()["cohort"],
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


def load_openai_manifest(path: Path) -> dict[str, Any]:
    value = load_signed(path, "manifest_sha256")
    if (
        value.get("run_id") != RUN_ID
        or value.get("protocol_sha256") != protocol_manifest()["sha256"]
        or value.get("provider") != PROVIDER
        or value.get("requested_model") != MODEL
    ):
        raise ValueError("The OpenAI manifest does not use the frozen protocol")
    if value.get("actual_calls", MAXIMUM_CALLS + 1) > MAXIMUM_CALLS:
        raise ValueError("The OpenAI manifest exceeds the call limit")
    if (
        value.get("cost_guard", {}).get(
            "committed_cost_usd",
            MAXIMUM_COST_USD + 1,
        )
        > MAXIMUM_COST_USD
    ):
        raise ValueError("The OpenAI manifest exceeds the cost limit")
    return value


def summarize(path: Path) -> dict[str, Any]:
    openai = load_openai_manifest(path)
    gemini, haiku, _ = retained_evidence()
    openai_gate = analysis_gate(openai)
    decision = (
        "add-openai-third-provider"
        if openai_gate["eligible"]
        else "retain-two-provider-calibration"
    )
    value = {
        "schema": SCHEMA,
        "run_kind": "openai-analysis-supplement-summary",
        "run_id": RUN_ID,
        "decision": decision,
        "phase8c4b_decision": "proceed-development",
        "format_selection": None,
        "cohort": make_corpus()["cohort"],
        "provider_gates": {
            "openai": openai_gate,
            "gemini": analysis_gate(gemini),
            "claude-haiku": analysis_gate(haiku),
        },
        "comparison_limit": "OpenAI and Haiku use identical fixtures. Gemini uses the matched-difficulty r3 cohort.",
        "eligibility_band": ELIGIBILITY_BAND,
        "retained": RETAINED,
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
    actions.add_argument("--provider", choices=("openai",))
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
            raise SystemExit(
                "The deterministic package does not match the frozen manifest"
            )
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
