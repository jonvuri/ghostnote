#!/usr/bin/env python3
"""Prepare and run the Phase 8c4c fresh full-family comparison."""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import platform
import random
import sys
import time
from copy import deepcopy
from decimal import Decimal
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


base = load_module(
    "ghostnote_compact_format_v12_base",
    BENCHMARKS_ROOT / "compact-format-v10" / "benchmark.py",
)
screen = load_module(
    "ghostnote_compact_format_v12_screen",
    BENCHMARKS_ROOT / "compact-format-v11" / "screen.py",
)
core = base.core
transport = base.transport
ORIGINAL_SCORE_RESPONSE = core.score_response

SCHEMA = "ghostnote-compact-format-full-family-v12"
CORPUS_SCHEMA = "ghostnote-compact-format-full-family-corpus-v12"
RUN_ID = "phase8c4c-compact-bar-full-family-r2"
COHORT = "development-r2"
PROVIDERS = base.PROVIDERS
MODELS = base.MODELS
SETTINGS = base.SETTINGS
KEYS = base.KEYS
ARMS = tuple(core.ARMS)
FAMILIES = tuple(core.DECISION_FAMILIES)
UNIQUE_PER_FAMILY = 8
SENTINELS_PER_ARM_FAMILY = 1
MAXIMUM_CALLS = len(ARMS) * len(FAMILIES) * (
    UNIQUE_PER_FAMILY + SENTINELS_PER_ARM_FAMILY
)
MAXIMUM_TOKEN_COUNT_REQUESTS = MAXIMUM_CALLS
PROVIDER_COST_LIMITS = {
    "openai": Decimal("0.65"),
    "gemini": Decimal("0.30"),
    "claude-haiku": Decimal("1.50"),
}
RECENT_COST_ESTIMATE = {
    "openai": Decimal("0.554243"),
    "gemini": Decimal("0.163238"),
    "claude-haiku": Decimal("1.318913"),
}
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "full-family-r2-approval.json"
DEPENDENCIES = (
    BENCHMARKS_ROOT / "compact-format-v6" / "core.py",
    BENCHMARKS_ROOT / "compact-format-v10" / "benchmark.py",
    BENCHMARKS_ROOT / "compact-format-v11" / "screen.py",
)
ANALYSIS_EXAMPLE = (
    "chord_ids=example-1,example-2 root_pcs=0,7 bass_pcs=4,7 "
    "qualities=major,dominant-seventh inversions=1,0 functions=I6,V7 "
    "motif_relations=transposition,inversion rhythms=sustained,shared-onset"
)


class CostBudgetExceeded(RuntimeError):
    """Stop before the approved provider budget can be exceeded."""


class CostGuard:
    def __init__(self, provider: str) -> None:
        self.provider = provider
        self.message_attempts = 0
        self.token_count_attempts = 0
        self.settled_cost = Decimal(0)
        self.committed_cost = Decimal(0)
        self.failed_reservations = 0

    def authorize_token_count(self) -> None:
        if self.provider != "claude-haiku":
            raise RuntimeError("Only Haiku uses token counting")
        if self.token_count_attempts >= MAXIMUM_TOKEN_COUNT_REQUESTS:
            raise RuntimeError("The token-count request limit is exhausted")
        self.token_count_attempts += 1

    def validate_token_count(self, input_tokens: int) -> None:
        if input_tokens + base.TOKEN_COUNT_MARGIN > base.INPUT_TOKEN_CEILING:
            raise RuntimeError("The input-token cost ceiling is exceeded")

    def check_message_capacity(self, payload_bytes: int) -> None:
        if payload_bytes > base.REQUEST_BYTE_CEILING:
            raise RuntimeError("The request-byte ceiling is exceeded")
        if self.message_attempts >= MAXIMUM_CALLS:
            raise RuntimeError("The message-call limit is exhausted")
        if (
            self.committed_cost + base.maximum_call_cost(self.provider)
            > PROVIDER_COST_LIMITS[self.provider]
        ):
            raise CostBudgetExceeded("The approved cost ceiling would be exceeded")

    def authorize_message(self, payload_bytes: int) -> Decimal:
        self.check_message_capacity(payload_bytes)
        reservation = base.maximum_call_cost(self.provider)
        self.message_attempts += 1
        self.committed_cost += reservation
        return reservation

    def settle(
        self, reservation: Decimal, measured: dict[str, int], actual: Decimal
    ) -> None:
        if measured["input_tokens"] > base.INPUT_TOKEN_CEILING:
            raise RuntimeError("Measured input tokens exceed the cost bound")
        if measured["output_tokens"] > base.output_token_limit(self.provider):
            raise RuntimeError("Measured output tokens exceed the request bound")
        if actual > reservation:
            raise RuntimeError("Measured call cost exceeds its reservation")
        self.settled_cost += actual
        self.committed_cost = self.committed_cost - reservation + actual

    def retain_failed_reservation(self) -> None:
        self.failed_reservations += 1

    def snapshot(self) -> dict[str, Any]:
        return {
            "message_attempts": self.message_attempts,
            "token_count_attempts": self.token_count_attempts,
            "settled_cost_usd": base.rounded_usd(self.settled_cost),
            "settled_exact_usd": base.exact_usd(self.settled_cost),
            "committed_cost_usd": base.rounded_usd(self.committed_cost),
            "committed_exact_usd": base.exact_usd(self.committed_cost),
            "failed_reservations": self.failed_reservations,
            "maximum_cost_usd": base.rounded_usd(
                PROVIDER_COST_LIMITS[self.provider]
            ),
        }


def make_corpus() -> dict[str, Any]:
    seed = 23063
    offset = 90
    core.ANALYSIS_BATCH_COUNTS[COHORT] = base.ANALYSIS_BATCH_COUNTS
    fixtures = {
        "comprehension-analysis": [
            core.analysis_task(COHORT, offset + index, seed)
            for index in range(UNIQUE_PER_FAMILY)
        ],
        "continuation-motif": [
            core.motif_task(COHORT, offset + index, seed)
            for index in range(UNIQUE_PER_FAMILY)
        ],
        "generation-progression": [
            core.progression_task(COHORT, offset + index, seed)
            for index in range(UNIQUE_PER_FAMILY)
        ],
    }
    fixtures = {
        family: [base.transform_holdout(task, 24, 12) for task in tasks]
        for family, tasks in fixtures.items()
    }
    value = {
        "schema": CORPUS_SCHEMA,
        "cohort": COHORT,
        "license": "MIT",
        "fixtures": fixtures,
    }
    value["sha256"] = core.digest(value)
    return value


def jobs() -> list[dict[str, Any]]:
    corpus = make_corpus()
    unique = [
        {
            "arm": arm,
            "family": family,
            "variant": task["variant"],
            "sentinel": False,
            "task": task,
        }
        for arm in ARMS
        for family in FAMILIES
        for task in corpus["fixtures"][family]
    ]
    sentinels = [
        {
            "arm": arm,
            "family": family,
            "variant": corpus["fixtures"][family][0]["variant"],
            "sentinel": True,
            "task": corpus["fixtures"][family][0],
        }
        for arm in ARMS
        for family in FAMILIES
    ]
    return unique + sentinels


def analysis_grammar() -> str:
    return (
        "Return one line with exactly these key=value fields in this order: "
        + " ".join(core.ANALYSIS_FIELDS)
        + ". A leading ANALYSIS label is optional and ignored. Do not add any "
        "other label, row, or prose."
    )


def output_grammar(arm: str, family: str) -> str:
    if family == "comprehension-analysis":
        return analysis_grammar()
    return screen.output_grammar(arm, family)


def prompt_for(job: dict[str, Any]) -> str:
    arm = job["arm"]
    task = job["task"]
    family = job["family"]
    if family == "comprehension-analysis":
        representation = (
            f"Input representation: {arm}. This label describes only the input "
            "document. Use the shared analysis output grammar below."
        )
        example = ANALYSIS_EXAMPLE
    elif family == "continuation-motif":
        representation = f"Input and output representation: {arm}."
        example = core.output_example(arm, family)
    else:
        representation = f"Output representation: {arm}."
        example = core.output_example(arm, family)
    parts = [
        "Complete one deterministic symbolic-music task.",
        "Return one JSON object with exactly one string field named payload. "
        "Put the requested representation in that string. Do not add prose.",
        representation,
        output_grammar(arm, family),
        "Follow this complete output example, but use the task values:\n" + example,
        core.task_instruction(task),
    ]
    if family != "comprehension-analysis":
        parts.append(screen.output_context_instruction(arm, task))
    source = core.represented_source(arm, task)
    if source is not None:
        parts.extend(("<input_document>", source, "</input_document>"))
    return "\n\n".join(parts)


def parse_failure(message: str) -> dict[str, Any]:
    return {
        "syntax_pass": False,
        "musical_pass": False,
        "primary_pass": False,
        "checks": {},
        "diagnostic": {
            "class": "parse",
            "error_type": "ValueError",
            "message": message,
        },
    }


def score_response(arm: str, task: dict[str, Any], payload: str) -> dict[str, Any]:
    if task["family"] != "comprehension-analysis":
        return ORIGINAL_SCORE_RESPONSE(arm, task, payload)
    text = payload.strip()
    if not text or "\n" in text:
        return parse_failure("Analysis output must contain exactly one line")
    normalized = text if text.startswith("ANALYSIS ") else "ANALYSIS " + text
    return ORIGINAL_SCORE_RESPONSE(arm, task, normalized)


def collect_prior_hashes() -> tuple[set[str], set[str]]:
    semantic: set[str] = set()
    cases: set[str] = set()
    for package in BENCHMARKS_ROOT.iterdir():
        if not package.is_dir() or package == PACKAGE_ROOT:
            continue
        for path in package.rglob("*.json"):
            try:
                base.collect_hashes(json.loads(path.read_text()), semantic, cases)
            except json.JSONDecodeError:
                continue
    return semantic, cases


def cohort_audit() -> dict[str, Any]:
    corpus = make_corpus()
    tasks = [task for values in corpus["fixtures"].values() for task in values]
    task_semantic = {task["semantic_sha256"] for task in tasks}
    analysis_cases = {
        value
        for task in corpus["fixtures"]["comprehension-analysis"]
        for value in task["case_semantic_sha256"]
    }
    prior_semantic, prior_cases = collect_prior_hashes()
    return {
        "corpus_sha256": corpus["sha256"],
        "fixture_count": len(tasks),
        "semantic_hash_count": len(task_semantic),
        "analysis_case_hash_count": len(analysis_cases),
        "internal_semantic_duplicates": len(tasks) - len(task_semantic),
        "prior_semantic_overlap": len(task_semantic & prior_semantic),
        "prior_analysis_case_overlap": len(analysis_cases & prior_cases),
    }


def package_files() -> dict[str, str]:
    return {
        name: base.file_sha256(PACKAGE_ROOT / name)
        for name in ("compare.py", "README.md", "PROTOCOL.md")
    }


def dependency_files() -> dict[str, str]:
    return {
        str(path.relative_to(BENCHMARKS_ROOT)): base.file_sha256(path)
        for path in DEPENDENCIES
    }


def prompt_manifest() -> list[dict[str, Any]]:
    return [
        {
            "arm": job["arm"],
            "family": job["family"],
            "variant": job["variant"],
            "sentinel": job["sentinel"],
            "task_sha256": job["task"]["sha256"],
            "prompt_sha256": core.sha256_text(prompt_for(job)),
        }
        for job in jobs()
    ]


def protocol_manifest() -> dict[str, Any]:
    audit = cohort_audit()
    value = {
        "schema": SCHEMA,
        "run_kind": "fresh-full-family-protocol",
        "run_id": RUN_ID,
        "package_files": package_files(),
        "dependency_files": dependency_files(),
        "cohort": COHORT,
        "cohort_audit": audit,
        "arms": list(ARMS),
        "families": list(FAMILIES),
        "unique_per_family": UNIQUE_PER_FAMILY,
        "sentinels_per_arm_family": SENTINELS_PER_ARM_FAMILY,
        "prompts": prompt_manifest(),
        "models": MODELS,
        "settings": SETTINGS,
        "calls": {
            "maximum_per_provider": MAXIMUM_CALLS,
            "maximum_all_providers": MAXIMUM_CALLS * len(PROVIDERS),
            "repairs": 0,
            "maximum_haiku_token_count_requests": MAXIMUM_TOKEN_COUNT_REQUESTS,
        },
        "cost_guard": {
            "recent_cost_estimate_usd": {
                provider: base.rounded_usd(cost)
                for provider, cost in RECENT_COST_ESTIMATE.items()
            },
            "recent_cost_estimate_total_usd": base.rounded_usd(
                sum(RECENT_COST_ESTIMATE.values(), Decimal(0))
            ),
            "maximum_provider_cost_usd": {
                provider: base.rounded_usd(PROVIDER_COST_LIMITS[provider])
                for provider in PROVIDERS
            },
            "maximum_total_cost_usd": base.rounded_usd(
                sum(PROVIDER_COST_LIMITS.values(), Decimal(0))
            ),
            "maximum_call_cost_usd": {
                provider: base.rounded_usd(base.maximum_call_cost(provider))
                for provider in PROVIDERS
            },
            "input_token_ceiling_per_call": base.INPUT_TOKEN_CEILING,
            "output_token_ceiling_per_call": 12000,
            "request_byte_ceiling_per_call": base.REQUEST_BYTE_CEILING,
        },
        "analysis_output_contract": (
            "Score the eight field assignments. Ignore one optional leading "
            "ANALYSIS label for every arm."
        ),
        "reporting": (
            "Report each provider and family separately, including strict "
            "syntax, strict full pass, paired discordance, and sentinel stability."
        ),
        "interpretation": (
            "This fresh comparison informs the next format decision. It cannot "
            "select a public format or enter holdout by itself."
        ),
        "provider_retry": "Do not retry a token-count or message request.",
        "privacy": "Generated MIT symbolic text only.",
        "approval_boundary": (
            "No token-count or provider request is approved until the operator "
            "approves the exact run-plan hash."
        ),
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    value = {
        "schema": SCHEMA,
        "run_kind": "fresh-full-family-plan",
        "run_id": RUN_ID,
        "protocol_sha256": protocol["sha256"],
        "cohort_sha256": protocol["cohort_audit"]["corpus_sha256"],
        "arms": protocol["arms"],
        "families": protocol["families"],
        "models": MODELS,
        "settings": SETTINGS,
        "calls": protocol["calls"],
        "cost_guard": protocol["cost_guard"],
        "analysis_output_contract": protocol["analysis_output_contract"],
        "interpretation": protocol["interpretation"],
        "approval": "pending",
    }
    value["sha256"] = core.digest(value)
    return value


def deterministic_screen() -> dict[str, Any]:
    corpus = make_corpus()
    audit = cohort_audit()
    analysis = corpus["fixtures"]["comprehension-analysis"][0]
    analysis_scores = {}
    for arm in ARMS:
        canonical = core.perfect_payload(arm, analysis)
        without_label = canonical.removeprefix("ANALYSIS ")
        with_label_score = score_response(arm, analysis, canonical)
        without_label_score = score_response(arm, analysis, without_label)
        analysis_scores[arm] = {
            "with_label_passes": with_label_score["primary_pass"],
            "without_label_passes": without_label_score["primary_pass"],
            "scores_match": with_label_score == without_label_score,
            "missing_field_fails": not score_response(
                arm,
                analysis,
                without_label.rsplit(" ", 1)[0],
            )["syntax_pass"],
        }
    prompts = [prompt_for(job) for job in jobs()]
    fields_prompts = [
        prompt_for(job) for job in jobs() if job["arm"] == "compact-bar-fields"
    ]
    guard = CostGuard("claude-haiku")
    guard.authorize_token_count()
    value = {
        "schema": SCHEMA,
        "job_count": len(jobs()),
        "expected_job_count": MAXIMUM_CALLS,
        "unique_fixture_count": sum(
            len(values) for values in corpus["fixtures"].values()
        ),
        "cohort_audit": audit,
        "analysis_scores": analysis_scores,
        "analysis_prompt_is_shared": len(
            {
                output_grammar(arm, "comprehension-analysis")
                for arm in ARMS
            }
        )
        == 1,
        "ambiguous_fields_phrase_absent": all(
            "FIELDS id voice start duration pitch velocity line" not in prompt
            for prompt in fields_prompts
        ),
        "old_source_delimiter_absent": all(
            "END SOURCE" not in prompt for prompt in prompts
        ),
        "all_requests_fit": all(
            base.request_bytes(provider, prompt) <= base.REQUEST_BYTE_CEILING
            for provider in PROVIDERS
            for prompt in prompts
        ),
        "failed_token_count_attempt_is_recorded": guard.token_count_attempts == 1,
        "estimated_run_fits_with_one_reservation": all(
            RECENT_COST_ESTIMATE[provider] + base.maximum_call_cost(provider)
            <= PROVIDER_COST_LIMITS[provider]
            for provider in PROVIDERS
        ),
    }
    value["all_checks_pass"] = all(
        (
            value["job_count"] == value["expected_job_count"],
            value["unique_fixture_count"] == UNIQUE_PER_FAMILY * len(FAMILIES),
            audit["internal_semantic_duplicates"] == 0,
            audit["prior_semantic_overlap"] == 0,
            audit["prior_analysis_case_overlap"] == 0,
            all(
                all(checks.values()) for checks in analysis_scores.values()
            ),
            value["analysis_prompt_is_shared"],
            value["ambiguous_fields_phrase_absent"],
            value["old_source_delimiter_absent"],
            value["all_requests_fit"],
            value["failed_token_count_attempt_is_recorded"],
            value["estimated_run_fits_with_one_reservation"],
        )
    )
    value["sha256"] = core.digest(value)
    return value


def deterministic_manifest() -> dict[str, Any]:
    screen_value = deterministic_screen()
    protocol = protocol_manifest()
    plan = run_plan()
    return {
        "schema": SCHEMA,
        "screen_sha256": screen_value["sha256"],
        "protocol_sha256": protocol["sha256"],
        "run_plan_sha256": plan["sha256"],
        "cohort_sha256": protocol["cohort_audit"]["corpus_sha256"],
        "job_count": screen_value["job_count"],
        "all_checks_pass": screen_value["all_checks_pass"],
        "sha256": core.digest(
            {
                "screen": screen_value["sha256"],
                "protocol": protocol["sha256"],
                "plan": plan["sha256"],
            }
        ),
    }


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    if (
        value.get("run_id") != RUN_ID
        or value.get("protocol_sha256") != plan["protocol_sha256"]
        or value.get("run_plan_sha256") != plan["sha256"]
    ):
        raise ValueError("Approval does not match the frozen v12 plan")
    if (
        value.get("status") != "approved"
        or not isinstance(value.get("operator_statement"), str)
        or not value["operator_statement"].strip()
    ):
        raise ValueError("Approval needs an explicit operator statement")
    return value


def count_input_tokens(key: str, prompt: str, guard: CostGuard) -> int:
    guard.authorize_token_count()
    spec = base.count_spec(key, prompt)
    raw = transport.post_json(spec["url"], spec["headers"], spec["payload"])
    input_tokens = raw.get("input_tokens")
    if not isinstance(input_tokens, int) or input_tokens < 0:
        raise ValueError("The token-count response is invalid")
    guard.validate_token_count(input_tokens)
    return input_tokens


def one_call(
    provider: str, key: str, job: dict[str, Any], guard: CostGuard
) -> tuple[dict[str, Any], dict[str, Any]]:
    prompt = prompt_for(job)
    payload_bytes = base.request_bytes(provider, prompt)
    guard.check_message_capacity(payload_bytes)
    input_estimate = (
        count_input_tokens(key, prompt, guard) if provider == "claude-haiku" else None
    )
    reservation = guard.authorize_message(payload_bytes)
    started = time.perf_counter()
    try:
        outer, raw = base.model_call(provider, key, prompt)
    except Exception:
        guard.retain_failed_reservation()
        raise
    latency_ms = (time.perf_counter() - started) * 1000
    transport_name = "claude" if provider == "claude-haiku" else provider
    measured = transport.usage(transport_name, raw)
    cost, exact_cost = base.cost_usd(provider, measured)
    guard.settle(reservation, measured, exact_cost)
    call = {
        "prompt_sha256": core.sha256_text(prompt),
        "prompt_bytes": len(prompt.encode()),
        "request_bytes": payload_bytes,
        "input_token_estimate": input_estimate,
        "input_token_ceiling": base.INPUT_TOKEN_CEILING,
        "cost_reservation_usd": base.exact_usd(reservation),
        "usage": measured,
        "cost_usd": cost,
        "latency_ms": round(latency_ms, 3),
        "retries": 0,
        "returned_model": transport.returned_model(transport_name, raw),
        "request_id": raw.get("id"),
        "stop_reason": transport.stop_reason(transport_name, raw),
        "raw_response_sha256": core.digest(raw),
    }
    if outer is None:
        return core.result_state("unavailable", reason="output-limit"), call
    payload = outer["payload"]
    call.update(
        {
            "response_payload": payload,
            "response_payload_bytes": len(payload.encode()),
            "response_payload_sha256": core.sha256_text(payload),
            "outer_schema_valid": outer["outer_schema_valid"],
        }
    )
    score = score_response(job["arm"], job["task"], payload)
    if not outer["outer_schema_valid"]:
        score = parse_failure("The response envelope is invalid")
    return core.result_state("initial", score), call


def result_for_job(
    provider: str, key: str, job: dict[str, Any], guard: CostGuard
) -> dict[str, Any]:
    common = {
        "arm": job["arm"],
        "family": job["family"],
        "variant": job["variant"],
        "sentinel": job["sentinel"],
        "task_sha256": job["task"]["sha256"],
        "semantic_sha256": job["task"]["semantic_sha256"],
    }
    try:
        initial, call = one_call(provider, key, job, guard)
    except Exception as error:
        initial = core.result_state("failed", reason=f"{type(error).__name__}: {error}")
        call = None
    return {**common, "initial": initial, "initial_call": call}


def execute_jobs(
    provider: str, key: str
) -> tuple[list[dict[str, Any]], CostGuard]:
    ordered = jobs()
    random.Random(23071).shuffle(ordered)
    guard = CostGuard(provider)
    results = []
    for index, job in enumerate(ordered, start=1):
        results.append(result_for_job(provider, key, job, guard))
        print(
            f"{provider}: completed {index}/{len(ordered)} jobs",
            file=sys.stderr,
            flush=True,
        )
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


def run_provider(provider: str, env_file: Path, approval_file: Path) -> dict[str, Any]:
    approval = validate_approval(approval_file)
    check = deterministic_screen()
    if not check["all_checks_pass"]:
        raise ValueError("The deterministic screen failed")
    environment = transport.load_env(env_file)
    missing = [name for name in KEYS.values() if not environment.get(name)]
    if missing:
        raise ValueError(f"Provider credential preflight failed: {','.join(missing)}")
    results, guard = execute_jobs(provider, environment[KEYS[provider]])
    calls = [row["initial_call"] for row in results if row["initial_call"]]
    actual = sum(
        (Decimal(str(call["cost_usd"]["total"])) for call in calls), Decimal(0)
    )
    snapshot = guard.snapshot()
    if base.rounded_usd(actual) != snapshot["settled_cost_usd"]:
        raise AssertionError("The exact call sum and settled guard total differ")
    budget_stops = sum(
        row["initial"]["kind"] == "failed"
        and str(row["initial"].get("reason", "")).startswith("CostBudgetExceeded:")
        for row in results
    )
    transport_failures = sum(row["initial"]["kind"] == "failed" for row in results)
    value = {
        "schema": SCHEMA,
        "run_kind": "fresh-full-family-provider",
        "run_id": RUN_ID,
        "provider": provider,
        "cohort": COHORT,
        "cohort_sha256": make_corpus()["sha256"],
        "requested_model": MODELS[provider],
        "settings": SETTINGS[provider],
        "client": "Python urllib.request direct HTTPS",
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "python": platform.python_version(),
        "protocol_sha256": protocol_manifest()["sha256"],
        "screen_sha256": check["sha256"],
        "run_plan_sha256": run_plan()["sha256"],
        "approval": approval,
        "results": results,
        "actual_calls": guard.message_attempts,
        "completed_calls": len(calls),
        "actual_cost_usd": base.rounded_usd(actual),
        "cost_guard": snapshot,
        "budget_stops": budget_stops,
        "transport_failures": transport_failures,
        "complete": len(results) == MAXIMUM_CALLS
        and budget_stops == 0
        and transport_failures == 0,
    }
    value["raw_run_sha256"] = core.digest(
        [call["raw_response_sha256"] for call in calls]
    )
    value["manifest_sha256"] = core.digest(value)
    return value


def load_manifest(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    unsigned = deepcopy(value)
    claimed = unsigned.pop("manifest_sha256", None)
    if claimed != core.digest(unsigned):
        raise ValueError(f"Manifest hash mismatch: {path}")
    provider = value.get("provider")
    expected_rows = {
        (job["arm"], job["family"], job["variant"], job["sentinel"])
        for job in jobs()
    }
    actual_rows = {
        (row["arm"], row["family"], row["variant"], row["sentinel"])
        for row in value.get("results", [])
    }
    calls = [
        row["initial_call"]
        for row in value.get("results", [])
        if row.get("initial_call") is not None
    ]
    if (
        provider not in PROVIDERS
        or value.get("run_id") != RUN_ID
        or value.get("run_kind") != "fresh-full-family-provider"
        or value.get("protocol_sha256") != protocol_manifest()["sha256"]
        or value.get("run_plan_sha256") != run_plan()["sha256"]
        or value.get("cohort_sha256") != make_corpus()["sha256"]
        or value.get("requested_model") != MODELS[provider]
        or value.get("settings") != SETTINGS[provider]
        or value.get("complete") is not True
        or value.get("budget_stops") != 0
        or value.get("transport_failures") != 0
        or len(value.get("results", [])) != MAXIMUM_CALLS
        or expected_rows != actual_rows
        or value.get("actual_calls", MAXIMUM_CALLS + 1) > MAXIMUM_CALLS
        or value.get("cost_guard", {}).get("token_count_attempts", 0)
        > MAXIMUM_TOKEN_COUNT_REQUESTS
        or value.get("cost_guard", {}).get("committed_cost_usd", math.inf)
        > base.rounded_usd(PROVIDER_COST_LIMITS[provider])
    ):
        raise ValueError(f"Manifest does not match the frozen comparison: {path}")
    if any(call.get("returned_model") != MODELS[provider] for call in calls):
        raise ValueError(f"Manifest contains a different returned model: {path}")
    expected_token_counts = MAXIMUM_CALLS if provider == "claude-haiku" else 0
    if (
        value.get("completed_calls") != len(calls)
        or value.get("actual_calls") != len(calls)
        or value.get("actual_calls")
        != value.get("cost_guard", {}).get("message_attempts")
        or value.get("cost_guard", {}).get("token_count_attempts")
        != expected_token_counts
    ):
        raise ValueError(f"Manifest call accounting does not reconcile: {path}")
    exact_cost = sum(
        (Decimal(str(call["cost_usd"]["total"])) for call in calls), Decimal(0)
    )
    if (
        base.rounded_usd(exact_cost) != value.get("actual_cost_usd")
        or base.rounded_usd(exact_cost)
        != value.get("cost_guard", {}).get("settled_cost_usd")
        or value.get("raw_run_sha256")
        != core.digest([call["raw_response_sha256"] for call in calls])
    ):
        raise ValueError(f"Manifest cost or raw-run accounting does not reconcile: {path}")
    return value


def row_pass(row: dict[str, Any]) -> bool:
    score = row["initial"].get("score")
    return bool(score and score.get("primary_pass"))


def row_syntax(row: dict[str, Any]) -> bool:
    score = row["initial"].get("score")
    return bool(score and score.get("syntax_pass"))


def family_arm_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    unique = [row for row in rows if not row["sentinel"]]
    return {
        "rows": len(unique),
        "scored": sum(row["initial"].get("score") is not None for row in unique),
        "strict_syntax_passes": sum(row_syntax(row) for row in unique),
        "strict_full_passes": sum(row_pass(row) for row in unique),
    }


def paired_summary(
    rows: list[dict[str, Any]], candidate: str, baseline: str, family: str
) -> dict[str, Any]:
    indexed = {
        (row["arm"], row["variant"]): row
        for row in rows
        if row["family"] == family and not row["sentinel"]
    }
    pairs = [
        (indexed[(candidate, variant)], indexed[(baseline, variant)])
        for variant in sorted(
            row["variant"]
            for row in rows
            if row["family"] == family
            and row["arm"] == candidate
            and not row["sentinel"]
        )
    ]
    return {
        "pairs": len(pairs),
        "candidate_passes": sum(row_pass(left) for left, _ in pairs),
        "baseline_passes": sum(row_pass(right) for _, right in pairs),
        "candidate_only_wins": sum(
            row_pass(left) and not row_pass(right) for left, right in pairs
        ),
        "candidate_only_losses": sum(
            row_pass(right) and not row_pass(left) for left, right in pairs
        ),
    }


def sentinel_summary(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for arm in ARMS:
        for family in FAMILIES:
            pair = [
                row
                for row in rows
                if row["arm"] == arm
                and row["family"] == family
                and row["variant"]
                == min(
                    item["variant"]
                    for item in rows
                    if item["arm"] == arm and item["family"] == family
                )
            ]
            unique = next(row for row in pair if not row["sentinel"])
            repeat = next(row for row in pair if row["sentinel"])
            result.append(
                {
                    "arm": arm,
                    "family": family,
                    "same_strict_pass": row_pass(unique) == row_pass(repeat),
                    "same_syntax_pass": row_syntax(unique) == row_syntax(repeat),
                    "same_payload": (
                        unique.get("initial_call") or {}
                    ).get("response_payload_sha256")
                    == (repeat.get("initial_call") or {}).get(
                        "response_payload_sha256"
                    ),
                }
            )
    return result


def summarize_runs(runs: list[dict[str, Any]]) -> dict[str, Any]:
    by_provider = {run["provider"]: run for run in runs}
    if set(by_provider) != set(PROVIDERS):
        raise ValueError("The summary needs all three provider manifests")
    providers = []
    total_cost = Decimal(0)
    for provider in PROVIDERS:
        run = by_provider[provider]
        rows = run["results"]
        families = {
            family: {
                arm: family_arm_summary(
                    [
                        row
                        for row in rows
                        if row["family"] == family and row["arm"] == arm
                    ]
                )
                for arm in ARMS
            }
            for family in FAMILIES
        }
        paired = {
            family: {
                "fields_vs_v1": paired_summary(
                    rows, "compact-bar-fields", "compact-bar-v1", family
                ),
                "fields_vs_exact": paired_summary(
                    rows, "compact-bar-fields", "exact-object-json", family
                ),
            }
            for family in FAMILIES
        }
        providers.append(
            {
                "provider": provider,
                "complete": run["complete"],
                "actual_calls": run["actual_calls"],
                "actual_cost_usd": run["actual_cost_usd"],
                "families": families,
                "paired": paired,
                "sentinels": sentinel_summary(rows),
            }
        )
        total_cost += Decimal(str(run["actual_cost_usd"]))
    value = {
        "schema": SCHEMA,
        "run_kind": "fresh-full-family-summary",
        "run_id": RUN_ID,
        "protocol_sha256": protocol_manifest()["sha256"],
        "providers": providers,
        "actual_cost_usd": {
            **{run["provider"]: run["actual_cost_usd"] for run in runs},
            "total": base.rounded_usd(total_cost),
        },
        "decision": "manual-adjudication",
        "selection_authority": (
            "This comparison cannot select a public format or enter holdout."
        ),
    }
    value["sha256"] = core.digest(value)
    return value


def write_new(value: dict[str, Any], output: Path | None) -> None:
    text = json.dumps(value, indent=2, sort_keys=True) + "\n"
    if output is None:
        print(text, end="")
    else:
        if output.exists():
            raise FileExistsError(f"Refusing to replace: {output}")
        output.write_text(text)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--check", type=Path)
    parser.add_argument("--print-plan", action="store_true")
    parser.add_argument("--provider", choices=PROVIDERS)
    parser.add_argument(
        "--env-file", type=Path, default=PACKAGE_ROOT.parents[2] / ".env"
    )
    parser.add_argument("--approval-file", type=Path, default=APPROVAL_PATH)
    parser.add_argument("--output", type=Path)
    parser.add_argument(
        "--summarize",
        nargs=3,
        type=Path,
        metavar=("OPENAI", "GEMINI", "HAIKU"),
    )
    args = parser.parse_args()
    if args.self_test:
        check = deterministic_screen()
        if not check["all_checks_pass"]:
            raise SystemExit(json.dumps(check, indent=2, sort_keys=True))
        print(json.dumps({"pass": True, **deterministic_manifest()}, indent=2, sort_keys=True))
        return
    if args.check:
        actual = deterministic_manifest()
        expected = json.loads(args.check.read_text())
        if actual != expected:
            raise SystemExit(
                "Deterministic mismatch\nexpected="
                + json.dumps(expected, sort_keys=True)
                + "\nactual="
                + json.dumps(actual, sort_keys=True)
            )
        print(json.dumps({"pass": True, **actual}, indent=2, sort_keys=True))
        return
    if args.print_plan:
        print(json.dumps(run_plan(), indent=2, sort_keys=True))
        return
    if args.provider:
        write_new(run_provider(args.provider, args.env_file, args.approval_file), args.output)
        return
    if args.summarize:
        write_new(
            summarize_runs([load_manifest(path) for path in args.summarize]),
            args.output,
        )
        return
    print(
        json.dumps(
            {
                "screen": deterministic_screen(),
                "protocol": protocol_manifest(),
                "plan": run_plan(),
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
