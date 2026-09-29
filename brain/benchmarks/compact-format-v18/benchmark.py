#!/usr/bin/env python3
"""Freeze and run the v18 low-effort pre-8c4e rehearsal."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
import statistics
import urllib.error
from copy import deepcopy
from decimal import Decimal
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent
SUITE_PATH = PACKAGE_ROOT / "suite.py"


def load_suite() -> Any:
    spec = importlib.util.spec_from_file_location(
        "ghostnote_compact_format_v18_suite", SUITE_PATH
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {SUITE_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


suite = load_suite()
v15 = suite.v15
v14 = suite.v14
base = suite.base
core = suite.core
transport = v15.transport
_V15_CANDIDATE_HASHES = v15.candidate_hashes

SCHEMA = "ghostnote-compact-format-rehearsal-v18"
CORPUS_SCHEMA = suite.CORPUS_SCHEMA
RUN_ID = "phase8c4d-low-effort-rehearsal-r1"
COHORT = suite.DEFAULT_COHORT
SEED = suite.DEFAULT_SEED
VARIANT_OFFSET = suite.DEFAULT_VARIANT_OFFSET
ARMS = suite.ARMS
COMPACT_ARMS = v15.COMPACT_ARMS
DECISION_FAMILIES = suite.DECISION_FAMILIES
GUARD_FAMILIES = suite.GUARD_FAMILIES
FAMILIES = suite.FAMILIES
UNIQUE_COUNTS = suite.UNIQUE_COUNTS
REPEATS = suite.REPEATS
PROVIDERS = ("openai",)
MODELS = {"openai": v15.MODELS["openai"]}
KEYS = {"openai": v15.KEYS["openai"]}
SETTINGS = {
    "openai": {
        "reasoning_effort": "low",
        "max_completion_tokens": 12000,
        "temperature": "provider default; omitted from request",
    }
}
MAXIMUM_CALLS = sum(
    UNIQUE_COUNTS[family] * REPEATS[family] * len(ARMS)
    for family in FAMILIES
)
MAXIMUM_TOKEN_COUNT_REQUESTS = 0
RECENT_COST_ESTIMATE = {"openai": Decimal("0.400000")}
PROVIDER_COST_LIMITS = {"openai": Decimal("0.650000")}
MAXIMUM_TOTAL_COST = Decimal("0.650000")
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "low-effort-r1-approval.json"
HISTORICAL_PACKAGES = (*v15.HISTORICAL_PACKAGES, "compact-format-v15", "compact-format-v16", "compact-format-v17")
DEPENDENCIES = (SUITE_PATH, suite.V15_PATH, *v15.DEPENDENCIES)
RUN_KIND_PROVIDER = "low-effort-rehearsal-provider"
RUN_KIND_SUMMARY = "low-effort-rehearsal-summary"

_CANDIDATE_HASHES = {
    "compact-bar-fields": "5125c847ad08dc795a82c235b3fcdf42dede5392805db36a3df2a0941c11a30a",
    "compact-bar-local-labels": "3fcb182bfa6cfa4935a8e4b5c6ef876407fcd27e5bb2e6ac7df3177b2789c349",
    "exact-object-json": "facd901ef30d98dec39f6023a779ce8ee3b3d3cab35e156ba0d6dffc05a99833",
}


def configure_modules() -> None:
    values = {
        "PACKAGE_ROOT": PACKAGE_ROOT,
        "SCHEMA": SCHEMA,
        "CORPUS_SCHEMA": CORPUS_SCHEMA,
        "RUN_ID": RUN_ID,
        "COHORT": COHORT,
        "SEED": SEED,
        "VARIANT_OFFSET": VARIANT_OFFSET,
        "ARMS": ARMS,
        "COMPACT_ARMS": COMPACT_ARMS,
        "DECISION_FAMILIES": DECISION_FAMILIES,
        "GUARD_FAMILIES": GUARD_FAMILIES,
        "FAMILIES": FAMILIES,
        "UNIQUE_COUNTS": UNIQUE_COUNTS,
        "REPEATS": REPEATS,
        "PROVIDERS": PROVIDERS,
        "MODELS": MODELS,
        "KEYS": KEYS,
        "SETTINGS": SETTINGS,
        "MAXIMUM_CALLS": MAXIMUM_CALLS,
        "MAXIMUM_TOKEN_COUNT_REQUESTS": MAXIMUM_TOKEN_COUNT_REQUESTS,
        "RECENT_COST_ESTIMATE": RECENT_COST_ESTIMATE,
        "PROVIDER_COST_LIMITS": PROVIDER_COST_LIMITS,
        "APPROVAL_PATH": APPROVAL_PATH,
        "HISTORICAL_PACKAGES": HISTORICAL_PACKAGES,
        "DEPENDENCIES": DEPENDENCIES,
        "RUN_KIND_PROVIDER": RUN_KIND_PROVIDER,
        "RUN_KIND_SUMMARY": RUN_KIND_SUMMARY,
    }
    for module in (v15, v14):
        for name, value in values.items():
            setattr(module, name, value)
    base.SETTINGS = {
        "openai": {
            name: value
            for name, value in SETTINGS["openai"].items()
            if name != "temperature"
        }
    }


configure_modules()


def make_corpus() -> dict[str, Any]:
    return suite.make_corpus(COHORT, SEED, VARIANT_OFFSET)


def task_difficulty(task: dict[str, Any]) -> str:
    return suite.task_difficulty(task)


def task_instruction(arm: str, task: dict[str, Any]) -> str:
    return suite.task_instruction(arm, task)


def candidate_hashes() -> dict[str, str]:
    hashes = _V15_CANDIDATE_HASHES()
    if hashes != _CANDIDATE_HASHES:
        raise AssertionError("The v15 candidate identities changed")
    return hashes


def runner_sha256() -> str:
    return base.file_sha256(Path(__file__))


def package_files() -> dict[str, str]:
    return {
        name: base.file_sha256(PACKAGE_ROOT / name)
        for name in ("benchmark.py", "suite.py", "README.md", "PROTOCOL.md")
    }


def dependency_files() -> dict[str, str]:
    return {
        str(path.relative_to(BENCHMARKS_ROOT)): base.file_sha256(path)
        for path in DEPENDENCIES
    }


def effective_request_settings(provider: str) -> dict[str, Any]:
    value = deepcopy(SETTINGS[provider])
    value.pop("temperature")
    return value


def cost_guard_manifest() -> dict[str, Any]:
    return {
        "recent_cost_estimate_usd": {"openai": 0.4},
        "recent_cost_estimate_total_usd": 0.4,
        "maximum_provider_cost_usd": {"openai": 0.65},
        "maximum_total_cost_usd": 0.65,
        "maximum_call_cost_usd": {
            "openai": base.rounded_usd(base.maximum_call_cost("openai"))
        },
        "input_token_ceiling_per_call": base.INPUT_TOKEN_CEILING,
        "output_token_ceiling_per_call": {
            "openai": base.output_token_limit("openai")
        },
        "request_byte_ceiling_per_call": base.REQUEST_BYTE_CEILING,
        "failed_reservation": "retained",
    }


def decision_rule() -> dict[str, Any]:
    return {
        "outcomes": ["freeze-for-8c4e", "revise", "invalid"],
        "experimental_unit": "prompt",
        "cases_and_components": "outcomes within a prompt; not independent trials",
        "resolution": (
            "Five prompts per family and stratum give a 20-point prompt-level "
            "step. This rehearsal makes no effect-size claim."
        ),
        "minimum_provider_completion": 0.95,
        "minimum_scored_cell_coverage": 0.80,
        "minimum_structural_rate": 0.90,
        "elemental_minimum_component_accuracy_per_arm": 0.80,
        "stress_median_component_accuracy_range": [0.50, 0.95],
        "stress_minimum_component_accuracy_per_arm": 0.40,
        "serialization_minimum_component_accuracy_per_arm": 0.90,
        "exact_json_role": "A valid format. It has no capability-control gate.",
        "pooling": "Report elemental and stress strata separately.",
        "selection_authority": (
            "This rehearsal can freeze the task design for 8c4e. It cannot "
            "select a format or authorize live 8c4e calls."
        ),
    }


def stopping_rule() -> dict[str, Any]:
    return {
        "before_calls": (
            "Stop on identity, freshness, reference, mutation, credential, "
            "network, approval, or cost-screen failure."
        ),
        "during_provider": (
            "Stop on the first transport or budget failure or after three "
            "unavailable responses. Make no retry or repair call."
        ),
        "after_openai": (
            "Stop after OpenAI. Do not run Gemini, Haiku, medium effort, or "
            "Phase 8c4e under this approval."
        ),
    }


def prompt_manifest() -> dict[str, list[dict[str, Any]]]:
    hashes = candidate_hashes()
    return {
        "openai": [
            {
                "planned_sequence": job["planned_sequence"],
                "arm": job["arm"],
                "candidate_sha256": hashes[job["arm"]],
                "family": job["family"],
                "difficulty": task_difficulty(job["task"]),
                "variant": job["variant"],
                "repeat": job["repeat"],
                "task_sha256": job["task"]["sha256"],
                "prompt_sha256": core.sha256_text(v15.prompt_for(job)),
                "prompt_bytes": len(v15.prompt_for(job).encode()),
            }
            for job in v14.jobs("openai")
        ]
    }


def protocol_manifest() -> dict[str, Any]:
    audit = v14.cohort_audit()
    value = {
        "schema": SCHEMA,
        "run_kind": "low-effort-rehearsal-protocol",
        "run_id": RUN_ID,
        "package_files": package_files(),
        "dependency_files": dependency_files(),
        "runner_sha256": runner_sha256(),
        "cohort": COHORT,
        "cohort_audit": audit,
        "candidate_definitions": v15.candidate_definitions(),
        "candidate_sha256": candidate_hashes(),
        "arms": list(ARMS),
        "families": {
            family: {
                "unique_fixtures": UNIQUE_COUNTS[family],
                "repeats": REPEATS[family],
                "role": "measurement" if family in DECISION_FAMILIES else "validity-guard",
            }
            for family in FAMILIES
        },
        "strata": {
            suite.ELEMENTAL: {
                "analysis": "One chord and motif case with no distractor notes.",
                "affine": "Six notes use one global affine rule.",
                "fixtures_per_family": 5,
            },
            suite.STRESS: {
                "analysis": (
                    "Three interleaved chord and eight-value motif cases use "
                    "four distractor notes and a declared mixed chord distribution."
                ),
                "affine": (
                    "Six multi-voice notes use voice-conditioned rules, "
                    "source-bound output IDs, and canonical output sorting."
                ),
                "fixtures_per_family": 5,
            },
            suite.CONTROL: {
                "serialization": "Copy six target notes without calculation.",
                "fixtures": 2,
            },
        },
        "analysis_quality_distribution": suite.analysis_quality_distribution(make_corpus()),
        "models": MODELS,
        "declared_settings": SETTINGS,
        "effective_request_settings": {
            "openai": effective_request_settings("openai")
        },
        "prompts": prompt_manifest(),
        "calls": {
            "maximum_openai_messages": MAXIMUM_CALLS,
            "maximum_all_providers": MAXIMUM_CALLS,
            "automatic_retries": 0,
            "repairs": 0,
            "gemini_messages": 0,
            "haiku_messages": 0,
            "medium_effort_messages": 0,
        },
        "cost_guard": cost_guard_manifest(),
        "measurement": {
            "musical_unit": "case and component within prompt",
            "experimental_unit": "prompt",
            "whole_response_musical_score": False,
            "required_aggregates": [
                "global component accuracy",
                "average per-case component accuracy",
                "perfect case count and rate",
            ],
            "response_level_metrics": [
                "structural parse conformance",
                "canonical form conformance",
            ],
            "stratum_pooling": False,
            "provider_pooling": False,
        },
        "transfer_to_8c4e": {
            "reuse_unchanged": [
                "candidate definitions and hashes",
                "task schemas and generator logic",
                "parsers and component scorers",
                "report schema and offline assertions",
                "cost and approval guards",
            ],
            "must_be_fresh": [
                "fixture instances",
                "cohort seed and hashes",
                "provider schedule",
                "approval and cost limits",
                "provider responses",
            ],
        },
        "decision_rule": decision_rule(),
        "stopping_rule": stopping_rule(),
        "approval_boundary": (
            "No provider request is approved until the operator approves the "
            "exact protocol, plan, cohort, candidate, runner, and cost hashes."
        ),
        "privacy": "Generated MIT symbolic text only.",
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    value = {
        "schema": SCHEMA,
        "run_kind": "low-effort-rehearsal-plan",
        "run_id": RUN_ID,
        "protocol_sha256": protocol["sha256"],
        "cohort_sha256": protocol["cohort_audit"]["corpus_sha256"],
        "historical_snapshot": protocol["cohort_audit"]["historical_snapshot"],
        "candidate_sha256": protocol["candidate_sha256"],
        "runner_sha256": protocol["runner_sha256"],
        "arms": protocol["arms"],
        "families": protocol["families"],
        "strata": protocol["strata"],
        "analysis_quality_distribution": protocol["analysis_quality_distribution"],
        "models": protocol["models"],
        "declared_settings": protocol["declared_settings"],
        "effective_request_settings": protocol["effective_request_settings"],
        "calls": protocol["calls"],
        "cost_guard": protocol["cost_guard"],
        "measurement": protocol["measurement"],
        "transfer_to_8c4e": protocol["transfer_to_8c4e"],
        "decision_rule": protocol["decision_rule"],
        "stopping_rule": protocol["stopping_rule"],
        "schedule_sha256": {"openai": core.digest(protocol["prompts"]["openai"])},
        "approval": "pending",
    }
    value["sha256"] = core.digest(value)
    return value


def prompt_visibility_screen() -> dict[str, Any]:
    rows = []
    for family, tasks in make_corpus()["fixtures"].items():
        for difficulty in sorted({task_difficulty(task) for task in tasks}):
            task = next(item for item in tasks if task_difficulty(item) == difficulty)
            for arm in ARMS:
                prompt = v15.prompt_for({"arm": arm, "family": family, "task": task})
                required = [f"Difficulty level: {difficulty}."]
                if family == "comprehension-analysis":
                    required.extend(["chord_groups", "motif_pairs"])
                elif difficulty == suite.STRESS:
                    required.extend(
                        [
                            "voice-conditioned affine operation",
                            "pitch=(2*axis)-source_pitch+semitones",
                            "first_voice_start",
                            "Sort the output notes canonically",
                        ]
                    )
                elif family == "continuation-affine":
                    required.extend(
                        [
                            "pitch=(2*axis)-source_pitch+semitones",
                            "First multiply axis by 2",
                        ]
                    )
                if family == "document-serialization" and arm == "exact-object-json":
                    required.extend(
                        [
                            'base_sha256 to the string "none"',
                            f'source_id to the exact string "{task["id"]}"',
                        ]
                    )
                missing = [fragment for fragment in required if fragment not in prompt]
                rows.append(
                    {
                        "family": family,
                        "difficulty": difficulty,
                        "arm": arm,
                        "missing": missing,
                    }
                )
    return {"rows": rows, "all_visible": all(not row["missing"] for row in rows)}


def scoring_screen() -> dict[str, Any]:
    checks: dict[str, bool] = {}
    corpus = make_corpus()
    for family, tasks in corpus["fixtures"].items():
        for task in tasks:
            for arm in ARMS:
                perfect = v15.score_response(arm, task, v15.perfect_payload(arm, task))
                failed = v15.parse_failure_for_task(task, "synthetic")
                key = f"{family}:{task['variant']}:{arm}"
                checks[f"{key}:perfect"] = (
                    perfect["component"]["correct"] == perfect["component"]["planned"]
                    and all(case["perfect"] for case in perfect["cases"])
                )
                checks[f"{key}:failure-retains-denominator"] = (
                    failed["component"]["planned"] == perfect["component"]["planned"]
                    and failed["component"]["correct"] == 0
                )
    analysis = corpus["fixtures"]["comprehension-analysis"][0]
    payload = v15.perfect_payload("compact-bar-fields", analysis)
    changed = payload.replace("root_pcs=", "root_pcs=wrong,", 1)
    score = v15.analysis_score(analysis, changed)
    checks["one-analysis-mutation-loses-one-component"] = (
        score["component"]["correct"] == score["component"]["planned"] - 1
    )
    return {"checks": checks, "all_pass": all(checks.values())}


def aggregation_screen() -> dict[str, Any]:
    task = make_corpus()["fixtures"]["comprehension-analysis"][0]
    perfect = v15.score_response(
        "compact-bar-fields", task, v15.perfect_payload("compact-bar-fields", task)
    )
    failed = v15.parse_failure_for_task(task, "synthetic")
    rows = [
        {
            "initial": core.result_state("initial", score),
            "attempted": True,
            "provider_completed": True,
            "budget_stopped": False,
        }
        for score in (perfect, failed)
    ]
    metrics = v15.metric_summary(rows)
    return {
        "values": metrics,
        "all_pass": metrics["global_component_accuracy"] == 0.5
        and metrics["average_per_case_component_accuracy"] == 0.5
        and metrics["perfect_cases"] == 1
        and metrics["perfect_case_rate"] == 0.5,
    }


def cell_summaries(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return v15.cell_summaries(rows)


def median_accuracy(cells: list[dict[str, Any]]) -> float | None:
    values = [
        cell["global_component_accuracy"]
        for cell in cells
        if cell["global_component_accuracy"] is not None
    ]
    return round(statistics.median(values), 6) if values else None


def evaluate_cells(
    progress: dict[str, int], cells: list[dict[str, Any]]
) -> dict[str, Any]:
    rule = decision_rule()
    completion = v15.safe_rate(progress["provider_completed"], progress["planned"])
    operational = completion is not None and completion >= rule["minimum_provider_completion"]
    operational &= all(
        cell["scored"] / cell["planned"] >= rule["minimum_scored_cell_coverage"]
        for cell in cells
        if cell["planned"]
    )
    structural = all(
        cell["structural_parse_rate_scored"] is not None
        and cell["structural_parse_rate_scored"] >= rule["minimum_structural_rate"]
        for cell in cells
    )
    elemental = [cell for cell in cells if cell["difficulty"] == suite.ELEMENTAL]
    stress = [cell for cell in cells if cell["difficulty"] == suite.STRESS]
    controls = [cell for cell in cells if cell["difficulty"] == suite.CONTROL]
    elemental_pass = all(
        cell["global_component_accuracy"] is not None
        and cell["global_component_accuracy"]
        >= rule["elemental_minimum_component_accuracy_per_arm"]
        for cell in elemental
    )
    stress_medians = {
        family: median_accuracy([cell for cell in stress if cell["family"] == family])
        for family in DECISION_FAMILIES
    }
    low, high = rule["stress_median_component_accuracy_range"]
    stress_pass = all(
        value is not None and low <= value <= high
        for value in stress_medians.values()
    ) and all(
        cell["global_component_accuracy"] is not None
        and cell["global_component_accuracy"]
        >= rule["stress_minimum_component_accuracy_per_arm"]
        for cell in stress
    )
    controls_pass = all(
        cell["global_component_accuracy"] is not None
        and cell["global_component_accuracy"]
        >= rule["serialization_minimum_component_accuracy_per_arm"]
        for cell in controls
    )
    if not operational or not structural:
        decision = "invalid"
    elif elemental_pass and stress_pass and controls_pass:
        decision = "freeze-for-8c4e"
    else:
        decision = "revise"
    return {
        "decision": decision,
        "completion_rate": completion,
        "operational_pass": operational,
        "structural_pass": structural,
        "elemental_pass": elemental_pass,
        "stress_pass": stress_pass,
        "serialization_pass": controls_pass,
        "stress_median_component_accuracy_by_family": stress_medians,
    }


def provider_summary(run: dict[str, Any]) -> dict[str, Any]:
    cells = cell_summaries(run["results"])
    evaluation = evaluate_cells(run["progress"], cells)
    return {
        "provider": run["provider"],
        "progress": run["progress"],
        "evaluation": evaluation,
        "by_family_stratum_arm": cells,
        "pooled_musical_headline": None,
        "size": v14.runtime_size_summary(run["results"]),
        "actual_cost_usd": run["actual_cost_usd"],
    }


def summarize_runs(runs: list[dict[str, Any]]) -> dict[str, Any]:
    if len(runs) != 1 or runs[0].get("provider") != "openai":
        raise ValueError("The rehearsal summary needs one OpenAI manifest")
    provider = provider_summary(runs[0])
    value = {
        "schema": SCHEMA,
        "run_kind": RUN_KIND_SUMMARY,
        "run_id": RUN_ID,
        "protocol_sha256": protocol_manifest()["sha256"],
        "run_plan_sha256": run_plan()["sha256"],
        "candidate_sha256": candidate_hashes(),
        "provider": provider,
        "actual_cost_usd": runs[0]["actual_cost_usd"],
        "decision": provider["evaluation"]["decision"],
        "selection_authority": decision_rule()["selection_authority"],
    }
    value["sha256"] = core.digest(value)
    return value


def summary_screen() -> dict[str, Any]:
    rows = []
    for job in v14.jobs("openai"):
        score = v15.score_response(
            job["arm"], job["task"], v15.perfect_payload(job["arm"], job["task"])
        )
        rows.append(
            {
                "family": job["family"],
                "arm": job["arm"],
                "variant": job["variant"],
                "repeat": job["repeat"],
                "initial": core.result_state("initial", score),
                "initial_call": None,
                "attempted": True,
                "provider_completed": True,
                "budget_stopped": False,
            }
        )
    denominators = v14.denominator_summary(rows)
    run = {
        "provider": "openai",
        "results": rows,
        "progress": {
            name: denominators[name]
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
        },
        "actual_cost_usd": 0.0,
    }
    summary = summarize_runs([run])
    cells = summary["provider"]["by_family_stratum_arm"]
    required = {
        "global_component_accuracy",
        "average_per_case_component_accuracy",
        "perfect_cases",
        "perfect_case_rate",
    }
    checks = {
        "fifteen-separate-cells": len(cells) == 15,
        "component-reports-present": all(required <= set(cell) for cell in cells),
        "no-pooled-musical-headline": summary["provider"]["pooled_musical_headline"] is None,
        "ceiling-result-revises": summary["decision"] == "revise",
    }
    return {"checks": checks, "all_pass": all(checks.values())}


def deterministic_screen() -> dict[str, Any]:
    audit = v14.cohort_audit()
    jobs = v14.jobs("openai")
    corpus_screen = suite.suite_screen(make_corpus())
    visibility = prompt_visibility_screen()
    scoring = scoring_screen()
    aggregation = aggregation_screen()
    summary = summary_screen()
    costs = v14.cost_screen()
    preflight = v14.preflight_screen()
    provider_accounting = v14.provider_accounting_screen()
    prompts = [v15.prompt_for(job) for job in jobs]
    blocks = [jobs[index : index + len(ARMS)] for index in range(0, len(jobs), len(ARMS))]
    freshness = all(
        audit[name] == 0
        for name in (
            "internal_full_duplicates",
            "internal_semantic_duplicates",
            "prior_full_overlap",
            "prior_semantic_overlap",
            "prior_analysis_case_overlap",
        )
    )
    value = {
        "schema": SCHEMA,
        "job_count_per_provider": {"openai": len(jobs)},
        "expected_job_count_per_provider": MAXIMUM_CALLS,
        "candidate_sha256": candidate_hashes(),
        "cohort_audit": audit,
        "suite": corpus_screen,
        "visibility": visibility,
        "scoring": scoring,
        "aggregation": aggregation,
        "summary": summary,
        "cost": costs,
        "preflight": preflight,
        "provider_accounting": provider_accounting,
        "all_blocks_have_all_arms": all(
            set(row["arm"] for row in block) == set(ARMS) for block in blocks
        ),
        "planned_sequences_are_contiguous": [row["planned_sequence"] for row in jobs]
        == list(range(1, MAXIMUM_CALLS + 1)),
        "all_requests_fit": all(
            base.request_bytes("openai", prompt) <= base.REQUEST_BYTE_CEILING
            for prompt in prompts
        ),
        "historical_snapshot_excludes_current": "compact-format-v18"
        not in HISTORICAL_PACKAGES,
        "only_openai_low_effort": PROVIDERS == ("openai",)
        and SETTINGS["openai"]["reasoning_effort"] == "low",
    }
    value["all_checks_pass"] = all(
        (
            len(jobs) == MAXIMUM_CALLS,
            freshness,
            corpus_screen["all_pass"],
            visibility["all_visible"],
            scoring["all_pass"],
            aggregation["all_pass"],
            summary["all_pass"],
            costs["all_pass"],
            preflight["all_pass"],
            provider_accounting["all_pass"],
            value["all_blocks_have_all_arms"],
            value["planned_sequences_are_contiguous"],
            value["all_requests_fit"],
            value["historical_snapshot_excludes_current"],
            value["only_openai_low_effort"],
        )
    )
    value["sha256"] = core.digest(
        {name: item for name, item in value.items() if name != "sha256"}
    )
    return value


def deterministic_manifest() -> dict[str, Any]:
    screen = deterministic_screen()
    protocol = protocol_manifest()
    plan = run_plan()
    value = {
        "schema": SCHEMA,
        "screen_sha256": screen["sha256"],
        "protocol_sha256": protocol["sha256"],
        "run_plan_sha256": plan["sha256"],
        "cohort_sha256": protocol["cohort_audit"]["corpus_sha256"],
        "candidate_sha256": candidate_hashes(),
        "runner_sha256": runner_sha256(),
        "job_count_per_provider": MAXIMUM_CALLS,
        "providers": ["openai"],
        "all_checks_pass": screen["all_checks_pass"],
    }
    value["sha256"] = core.digest(value)
    return value


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    expected = {
        "run_id": RUN_ID,
        "protocol_sha256": plan["protocol_sha256"],
        "run_plan_sha256": plan["sha256"],
        "cohort_sha256": plan["cohort_sha256"],
        "candidate_sha256": plan["candidate_sha256"],
        "runner_sha256": runner_sha256(),
        "maximum_provider_cost_usd": {"openai": 0.65},
        "maximum_total_cost_usd": 0.65,
    }
    if any(value.get(name) != item for name, item in expected.items()):
        raise ValueError("Approval does not match the frozen v18 plan")
    if (
        value.get("status") != "approved"
        or not isinstance(value.get("operator_statement"), str)
        or not value["operator_statement"].strip()
    ):
        raise ValueError("The v18 OpenAI run needs explicit approval")
    return value


class ProviderHttpError(RuntimeError):
    """Retain safe provider HTTP error evidence."""


ORIGINAL_POST_JSON = transport.post_json


def safe_http_error(
    status_code: int, body: bytes, headers: dict[str, str]
) -> dict[str, Any]:
    provider_status = None
    provider_reason = None
    message = None
    try:
        parsed = json.loads(body)
        error = parsed.get("error", {}) if isinstance(parsed, dict) else {}
        if isinstance(error, dict):
            provider_status = error.get("status") or error.get("type")
            provider_reason = error.get("code")
            message = error.get("message")
    except (json.JSONDecodeError, UnicodeDecodeError):
        pass
    if isinstance(message, str):
        for secret in headers.values():
            if secret:
                message = message.replace(secret, "[REDACTED]")
        message = re.sub(r"(?:sk|AIza)[0-9A-Za-z_-]+", "[REDACTED]", message)[:500]
    return {
        "http_status": status_code,
        "provider_status": provider_status,
        "provider_reason": provider_reason,
        "message": message,
        "body_bytes": len(body),
        "body_sha256": hashlib.sha256(body).hexdigest(),
    }


def post_json_with_error_evidence(
    url: str, headers: dict[str, str], payload: dict[str, Any]
) -> dict[str, Any]:
    try:
        return ORIGINAL_POST_JSON(url, headers, payload)
    except urllib.error.HTTPError as error:
        evidence = safe_http_error(error.code, error.read(65_536), headers)
        raise ProviderHttpError(core.canonical(evidence)) from error


def install_overrides() -> None:
    overrides = {
        "make_corpus": make_corpus,
        "task_difficulty": task_difficulty,
        "task_instruction": task_instruction,
        "candidate_hashes": candidate_hashes,
        "package_files": package_files,
        "dependency_files": dependency_files,
        "effective_request_settings": effective_request_settings,
        "prompt_manifest": prompt_manifest,
        "decision_rule": decision_rule,
        "stopping_rule": stopping_rule,
        "protocol_manifest": protocol_manifest,
        "run_plan": run_plan,
        "prompt_visibility_screen": prompt_visibility_screen,
        "scoring_screen": scoring_screen,
        "aggregation_screen": aggregation_screen,
        "summary_screen": summary_screen,
        "deterministic_screen": deterministic_screen,
        "deterministic_manifest": deterministic_manifest,
        "validate_approval": validate_approval,
        "summarize_runs": summarize_runs,
    }
    for module in (v15, v14):
        for name, value in overrides.items():
            setattr(module, name, value)


install_overrides()


def run_provider(env_file: Path, approval_file: Path) -> dict[str, Any]:
    original = transport.post_json
    transport.post_json = post_json_with_error_evidence
    try:
        return v15.run_provider("openai", env_file, approval_file)
    finally:
        transport.post_json = original


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
    parser.add_argument("--check", type=Path)
    parser.add_argument("--print-plan", action="store_true")
    parser.add_argument("--provider", choices=PROVIDERS)
    parser.add_argument(
        "--env-file", type=Path, default=PACKAGE_ROOT.parents[2] / ".env"
    )
    parser.add_argument("--approval-file", type=Path, default=APPROVAL_PATH)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--summarize", nargs=1, type=Path, metavar=("OPENAI",))
    args = parser.parse_args()
    if args.self_test:
        screen = deterministic_screen()
        if not screen["all_checks_pass"]:
            raise SystemExit(json.dumps(screen, indent=2, sort_keys=True))
        print(json.dumps({"pass": True, **deterministic_manifest()}, indent=2, sort_keys=True))
        return
    if args.check:
        actual = deterministic_manifest()
        if actual != json.loads(args.check.read_text()):
            raise SystemExit("Deterministic mismatch")
        print(json.dumps({"pass": True, **actual}, indent=2, sort_keys=True))
        return
    if args.print_plan:
        write_new(run_plan(), args.output)
        return
    if args.provider:
        write_new(run_provider(args.env_file, args.approval_file), args.output)
        return
    if args.summarize:
        write_new(summarize_runs([v15.load_manifest(args.summarize[0])]), args.output)
        return
    raise SystemExit("Select --self-test, --check, --print-plan, --provider, or --summarize")


if __name__ == "__main__":
    main()
