#!/usr/bin/env python3
"""Run the frozen Phase 8c2.2 grouped-format development benchmark."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import platform
import random
import sys
from collections import Counter
from copy import deepcopy
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PACKAGE_ROOT))
import benchmark as calibration_r1  # type: ignore  # noqa: E402
import calibration_r2  # type: ignore  # noqa: E402
import core  # type: ignore  # noqa: E402
sys.path.pop(0)


SCHEMA = "ghostnote-compact-format-development-v3"
RUN_ID = "phase8c2-2-grouped-development-r1"
SEED = 8261
PROVIDERS = calibration_r1.PROVIDERS
MODELS = calibration_r1.MODELS
SETTINGS = calibration_r1.SETTINGS
COHORTS = ("development", "holdout")
DECISION_MARGIN = 0.05
MAXIMUM_CANDIDATE_ONLY_LOSSES = 1
INPUT_TOKEN_RATIO_LIMIT = 0.90
OUTPUT_BYTE_RATIO_LIMIT = 0.80
SOURCE_CALIBRATION_SUMMARY_SHA256 = "bc606011893faef8167d96711c4080e608d052595d298cb1d15a66f00203371f"
RECENT_MEAN_CALL_COST_USD = {
    "openai": 0.00531895,
    "gemini": 0.0035731,
    "claude": 0.0243153,
}
COST_BASIS = {
    "source": "Progression-repair calibration r2 provider manifests",
    "method": "Use the recorded mean call cost for each provider and add 25 percent.",
    "price_verification_date": "2026-09-27",
    "price_sources": core.v2.PRICE_SOURCES,
    "mean_call_cost_usd": RECENT_MEAN_CALL_COST_USD,
    "contingency": 0.25,
}


def repaired_progression_task(cohort: str, variant: int) -> dict[str, Any]:
    if cohort not in COHORTS:
        raise ValueError(f"Unknown cohort: {cohort}")
    seed = int(core.COHORT_SPECS[cohort]["seed"])
    tonic = (seed + variant * 5) % 12
    duration = {"development": "3/4", "holdout": "2/3"}[cohort]
    offsets = ((0, 4, 7), (5, 9, 0), (7, 11, 2), (0, 4, 7))
    contract = {
        "meter": "4/4",
        "chord_starts": ["0", "1", "2", "3"],
        "duration": duration,
        "pitch_classes": [sorted((tonic + value) % 12 for value in chord) for chord in offsets],
        "bass_pitch_classes": [tonic, (tonic + 5) % 12, (tonic + 7) % 12, tonic],
        "voice_ranges": {
            "bass": [36, 55],
            "tenor": [48, 67],
            "alto": [55, 74],
            "soprano": [62, 84],
        },
        "maximum_total_voice_leading": 54,
        "cadence_pitch_class": tonic,
    }
    return core.finish_task(cohort, "generation-progression", variant, {"contract": contract})


def repaired_melody_task(cohort: str, variant: int) -> dict[str, Any]:
    seed = int(core.COHORT_SPECS[cohort]["seed"])
    source = core.melody_task(cohort, variant, seed)
    contract = deepcopy(source["contract"])
    strong_indices = [
        index
        for index, start in enumerate(contract["starts"])
        if core.fraction(start).denominator == 1
    ]
    contract["strong_beat_pitch_classes"] = sorted(
        {contract["perfect_pitches"][index] % 12 for index in strong_indices}
    )
    return core.finish_task(cohort, "generation-melody", variant, {"contract": contract})


def make_corpus(cohort: str) -> dict[str, Any]:
    if cohort not in COHORTS:
        raise ValueError(f"Unknown cohort: {cohort}")
    value = deepcopy(core.make_corpus(cohort))
    count = int(core.COHORT_SPECS[cohort]["decision"])
    value["fixtures"]["generation-progression"] = [
        repaired_progression_task(cohort, variant) for variant in range(count)
    ]
    regression_count = int(core.COHORT_SPECS[cohort]["regression"])
    value["fixtures"]["generation-melody"] = [
        repaired_melody_task(cohort, variant) for variant in range(regression_count)
    ]
    value.pop("sha256", None)
    value["sha256"] = core.digest(value)
    return value


def progression_instruction(value: dict[str, Any]) -> str:
    return (
        "Realize the four-chord progression. At each start, use exactly four notes: "
        "one bass, one tenor, one alto, and one soprano. Use only the listed pitch "
        "classes. Use every listed pitch class at least once in each chord. After full "
        "coverage, double any listed pitch class. The bass must use the listed bass "
        f"pitch class. Satisfy every range, order, movement, duration, and cadence limit: {core.canonical(value['contract'])}"
    )


def prompt_for(arm: str, value: dict[str, Any]) -> str:
    if value["family"] != "generation-progression":
        return core.prompt_for(arm, value)
    return "\n\n".join(
        (
            "Complete one deterministic symbolic-music task.",
            "Return one JSON object with exactly one string field named payload. Put the requested representation in that string. Do not add prose.",
            f"Representation arm: {arm}.",
            core.output_grammar(arm, value["family"]),
            "Follow this output example, but use the task values:\n" + core.output_example(arm, value["family"]),
            progression_instruction(value),
        )
    )


def jobs(cohort: str = "development") -> list[dict[str, Any]]:
    corpus = make_corpus(cohort)
    return [
        {"arm": arm, "family": family, "variant": task["variant"], "repeat": 0, "task": task}
        for arm in core.ARMS
        for family in core.TASK_FAMILIES
        for task in corpus["fixtures"][family]
    ]


def corpus_audit() -> dict[str, Any]:
    corpora = {cohort: make_corpus(cohort) for cohort in COHORTS}
    semantics = {
        cohort: {
            task["semantic_sha256"]
            for fixtures in corpus["fixtures"].values()
            for task in fixtures
        }
        for cohort, corpus in corpora.items()
    }
    fixture_hashes = {
        cohort: {
            task["sha256"]
            for fixtures in corpus["fixtures"].values()
            for task in fixtures
        }
        for cohort, corpus in corpora.items()
    }
    prior = calibration_r1.all_historical_semantics()
    prior.update(
        task["semantic_sha256"]
        for fixtures in core.make_corpus("calibration")["fixtures"].values()
        for task in fixtures
    )
    prior.update(task["semantic_sha256"] for task in calibration_r2.make_corpus()["fixtures"])
    original_progressions = {
        task["semantic_sha256"]
        for cohort in COHORTS
        for task in core.make_corpus(cohort)["fixtures"]["generation-progression"]
    }
    return {
        "cohorts": {
            cohort: {
                "corpus_sha256": corpus["sha256"],
                "fixture_count": sum(len(values) for values in corpus["fixtures"].values()),
                "fixture_sha256": sorted(fixture_hashes[cohort]),
                "semantic_sha256": sorted(semantics[cohort]),
                "prior_semantic_overlap": len(semantics[cohort] & prior),
                "replacement_progression_overlap": len(
                    {
                        task["semantic_sha256"]
                        for task in corpus["fixtures"]["generation-progression"]
                    }
                    & original_progressions
                ),
            }
            for cohort, corpus in corpora.items()
        },
        "pairwise": {
            "fixture_hash_overlap": len(fixture_hashes["development"] & fixture_hashes["holdout"]),
            "semantic_hash_overlap": len(semantics["development"] & semantics["holdout"]),
        },
    }


def cohort_manifest() -> dict[str, Any]:
    value = {"schema": SCHEMA, "run_kind": "repaired-cohort-manifest", **corpus_audit()}
    value["sha256"] = core.digest(value)
    return value


def paired_bootstrap_interval(differences: list[int]) -> list[float]:
    """Return an exact percentile interval for the empirical paired bootstrap."""
    counts = Counter(differences)
    denominator = len(differences)
    distribution = {0: 1.0}
    for _ in range(denominator):
        updated: dict[int, float] = {}
        for total, probability in distribution.items():
            for difference, count in counts.items():
                target = total + difference
                updated[target] = updated.get(target, 0.0) + probability * count / denominator
        distribution = updated
    ordered = sorted(distribution.items())

    def quantile(limit: float) -> float:
        cumulative = 0.0
        for total, probability in ordered:
            cumulative += probability
            if cumulative >= limit:
                return total / denominator
        return ordered[-1][0] / denominator

    return [round(quantile(0.025), 6), round(quantile(0.975), 6)]


def paired_stats(candidate: list[bool], baseline: list[bool]) -> dict[str, Any]:
    if len(candidate) != len(baseline) or not candidate:
        raise ValueError("Paired results need equal nonempty samples")
    differences = [int(left) - int(right) for left, right in zip(candidate, baseline)]
    wins = sum(value == 1 for value in differences)
    losses = sum(value == -1 for value in differences)
    return {
        "denominator": len(differences),
        "candidate_successes": sum(candidate),
        "baseline_successes": sum(baseline),
        "candidate_only_wins": wins,
        "candidate_only_losses": losses,
        "both_pass": sum(left and right for left, right in zip(candidate, baseline)),
        "both_fail": sum(not left and not right for left, right in zip(candidate, baseline)),
        "effect": round(sum(differences) / len(differences), 6),
        "paired_bootstrap_95_interval": paired_bootstrap_interval(differences),
    }


def indexed_results(run: dict[str, Any]) -> dict[tuple[str, str, int, int], dict[str, Any]]:
    result = {}
    for row in run["results"]:
        key = (row["arm"], row["family"], int(row["variant"]), int(row["repeat"]))
        if key in result:
            raise ValueError(f"Duplicate result: {key}")
        result[key] = row
    return result


def paired_rows(
    indexed: dict[tuple[str, str, int, int], dict[str, Any]],
    candidate_arm: str,
    baseline_arm: str,
    families: tuple[str, ...],
) -> tuple[list[bool], list[bool]]:
    candidate = []
    baseline = []
    for family in families:
        variants = len(make_corpus("development")["fixtures"][family])
        for variant in range(variants):
            candidate.append(bool(indexed[(candidate_arm, family, variant, 0)]["validation"]["primary_pass"]))
            baseline.append(bool(indexed[(baseline_arm, family, variant, 0)]["validation"]["primary_pass"]))
    return candidate, baseline


def integrity_check(run: dict[str, Any], protocol_sha256: str) -> None:
    provider = run.get("provider")
    if provider not in PROVIDERS or run.get("run_id") != RUN_ID:
        raise ValueError("The provider run has the wrong identity")
    if run.get("protocol_sha256") != protocol_sha256:
        raise ValueError("The provider run has the wrong protocol")
    if run.get("requested_model") != MODELS[provider]:
        raise ValueError("The provider run has the wrong requested model")
    if not run.get("complete") or len(run.get("results", [])) != len(jobs()):
        raise ValueError("The provider run is incomplete")
    if any("transport_error" in row for row in run["results"]):
        raise ValueError("The provider run has a transport error")
    if any(row.get("returned_model") != MODELS[provider] for row in run["results"]):
        raise ValueError("The provider returned an unexpected model")
    approval = run.get("approval", {})
    if approval.get("status") != "approved" or approval.get("protocol_sha256") != protocol_sha256:
        raise ValueError("The provider run has no matching approval")
    expected_raw = core.digest([row.get("raw_response_sha256") for row in run["results"]])
    if run.get("raw_run_sha256") != expected_raw:
        raise ValueError("The raw-run hash does not match")
    without_manifest = {key: value for key, value in run.items() if key != "manifest_sha256"}
    if run.get("manifest_sha256") != core.digest(without_manifest):
        raise ValueError("The provider manifest hash does not match")
    indexed_results(run)


def summarize_development(runs: list[dict[str, Any]], protocol_sha256: str | None = None) -> dict[str, Any]:
    if {run.get("provider") for run in runs} != set(PROVIDERS):
        raise ValueError("The summary needs one run from each provider")
    expected_protocol = protocol_sha256 or protocol_manifest()["sha256"]
    provider_rows = []
    improving_providers = 0
    all_provider_gates = True
    for run in sorted(runs, key=lambda value: PROVIDERS.index(value["provider"])):
        if protocol_sha256 is None:
            integrity_check(run, expected_protocol)
        indexed = indexed_results(run)
        family_rows = []
        family_loss_gate = True
        for family in core.TASK_FAMILIES:
            candidate, compact = paired_rows(indexed, "grouped-label-compact", "compact-bar-v1", (family,))
            _, label = paired_rows(indexed, "grouped-label-compact", "label-only-compact", (family,))
            compact_stats = paired_stats(candidate, compact)
            label_stats = paired_stats(candidate, label)
            loss_gate = compact_stats["candidate_only_losses"] <= MAXIMUM_CANDIDATE_ONLY_LOSSES
            family_loss_gate &= loss_gate
            family_rows.append(
                {
                    "family": family,
                    "grouped_vs_compact": compact_stats,
                    "grouped_vs_label": label_stats,
                    "candidate_only_loss_gate": loss_gate,
                }
            )
        candidate_hard, compact_hard = paired_rows(
            indexed, "grouped-label-compact", "compact-bar-v1", core.DECISION_FAMILIES
        )
        hard = paired_stats(candidate_hard, compact_hard)
        improves = hard["effect"] >= DECISION_MARGIN
        improving_providers += improves
        no_hard_regression = hard["effect"] >= -DECISION_MARGIN
        candidate_guard, compact_guard = paired_rows(
            indexed, "grouped-label-compact", "compact-bar-v1", core.GUARD_FAMILIES
        )
        _, label_guard = paired_rows(
            indexed, "grouped-label-compact", "label-only-compact", core.GUARD_FAMILIES
        )
        guard_compact = paired_stats(candidate_guard, compact_guard)
        guard_label = paired_stats(candidate_guard, label_guard)
        guard_gate = guard_compact["effect"] >= -DECISION_MARGIN and guard_label["effect"] >= -DECISION_MARGIN
        grouped_rows = [row for row in run["results"] if row["arm"] == "grouped-label-compact"]
        label_rows = [row for row in run["results"] if row["arm"] == "label-only-compact"]
        grouped_syntax = sum(row["validation"]["syntax_pass"] for row in grouped_rows) / len(grouped_rows)
        label_syntax = sum(row["validation"]["syntax_pass"] for row in label_rows) / len(label_rows)
        syntax_delta = grouped_syntax - label_syntax
        syntax_gate = syntax_delta >= -DECISION_MARGIN
        exact_rows = [row for row in run["results"] if row["arm"] == "exact-json"]
        input_ratio = sum(row["usage"]["input_tokens"] for row in grouped_rows) / sum(
            row["usage"]["input_tokens"] for row in exact_rows
        )
        output_ratio = sum(row["response_payload_bytes"] for row in grouped_rows) / sum(
            row["response_payload_bytes"] for row in exact_rows
        )
        efficiency_gate = input_ratio <= INPUT_TOKEN_RATIO_LIMIT and output_ratio <= OUTPUT_BYTE_RATIO_LIMIT
        provider_gate = no_hard_regression and family_loss_gate and guard_gate and syntax_gate and efficiency_gate
        all_provider_gates &= provider_gate
        provider_rows.append(
            {
                "provider": run["provider"],
                "decision_macro_grouped_vs_compact": hard,
                "improvement_gate": improves,
                "no_hard_regression_gate": no_hard_regression,
                "families": family_rows,
                "candidate_only_loss_gate": family_loss_gate,
                "guards": {
                    "grouped_vs_compact": guard_compact,
                    "grouped_vs_label": guard_label,
                    "gate": guard_gate,
                },
                "syntax": {
                    "grouped_rate": round(grouped_syntax, 6),
                    "label_rate": round(label_syntax, 6),
                    "effect": round(syntax_delta, 6),
                    "gate": syntax_gate,
                },
                "efficiency": {
                    "input_token_ratio_to_exact": round(input_ratio, 6),
                    "output_byte_ratio_to_exact": round(output_ratio, 6),
                    "gate": efficiency_gate,
                },
                "provider_gate": provider_gate,
                "actual_cost_usd": run["actual_cost_usd"],
            }
        )
    capability_gate = calibration_r1.grouped_capability_screen()
    deterministic_gate = all(
        capability_gate[name]
        for name in (
            "round_trip",
            "canonical_reorder_rejected",
            "mixed_duration_round_trip",
            "stable_identity",
            "exact_preservation",
            "sparse_patch",
        )
    )
    gate_pass = improving_providers >= 2 and all_provider_gates and deterministic_gate
    value = {
        "schema": SCHEMA,
        "run_kind": "development-summary",
        "run_id": RUN_ID,
        "decision": "freeze-holdout" if gate_pass else "stop-custom-compact",
        "gate": {
            "minimum_improving_providers": 2,
            "improving_providers": improving_providers,
            "decision_margin": DECISION_MARGIN,
            "maximum_candidate_only_losses_per_provider_family": MAXIMUM_CANDIDATE_ONLY_LOSSES,
            "input_token_ratio_limit": INPUT_TOKEN_RATIO_LIMIT,
            "output_byte_ratio_limit": OUTPUT_BYTE_RATIO_LIMIT,
            "deterministic_capabilities": deterministic_gate,
            "pass": gate_pass,
        },
        "providers": provider_rows,
        "actual_cost_usd": {
            **{run["provider"]: run["actual_cost_usd"] for run in runs},
            "total": round(sum(run["actual_cost_usd"] for run in runs), 6),
        },
        "protocol_sha256": expected_protocol,
    }
    value["sha256"] = core.digest(value)
    return value


def synthetic_results(passing: bool) -> list[dict[str, Any]]:
    result = []
    for job in jobs():
        validation = core.score_response(
            job["arm"], job["task"], core.perfect_payload(job["arm"], job["task"])
        )
        if job["family"] in core.DECISION_FAMILIES:
            if passing and job["arm"] == "compact-bar-v1" and job["variant"] < 2:
                validation["primary_pass"] = False
            if not passing and job["arm"] == "grouped-label-compact" and job["variant"] < 2:
                validation["primary_pass"] = False
        input_tokens = 80 if job["arm"] == "grouped-label-compact" else 100
        payload_bytes = 70 if job["arm"] == "grouped-label-compact" else 100
        result.append(
            {
                "arm": job["arm"],
                "family": job["family"],
                "variant": job["variant"],
                "repeat": 0,
                "validation": validation,
                "usage": {"input_tokens": input_tokens},
                "response_payload_bytes": payload_bytes,
            }
        )
    return result


def deterministic_screen() -> dict[str, Any]:
    audit = corpus_audit()
    perfect = []
    explicit_coverage = []
    for cohort in COHORTS:
        for arm in core.ARMS:
            for family in core.TASK_FAMILIES:
                for task in make_corpus(cohort)["fixtures"][family]:
                    score = core.score_response(arm, task, core.perfect_payload(arm, task))
                    perfect.append({"cohort": cohort, "arm": arm, "task": task["id"], "pass": score["primary_pass"]})
                    if family == "generation-progression":
                        explicit_coverage.append("Use every listed pitch class at least once" in prompt_for(arm, task))
    synthetic_protocol = "synthetic-development-protocol"
    passing_runs = [
        {
            "provider": provider,
            "protocol_sha256": synthetic_protocol,
            "results": synthetic_results(True),
            "actual_cost_usd": 0,
        }
        for provider in PROVIDERS
    ]
    failing_runs = [
        {
            "provider": provider,
            "protocol_sha256": synthetic_protocol,
            "results": synthetic_results(False),
            "actual_cost_usd": 0,
        }
        for provider in PROVIDERS
    ]
    passing = summarize_development(passing_runs, synthetic_protocol)
    failing = summarize_development(failing_runs, synthetic_protocol)
    all_checks = (
        all(row["pass"] for row in perfect)
        and all(explicit_coverage)
        and not audit["pairwise"]["fixture_hash_overlap"]
        and not audit["pairwise"]["semantic_hash_overlap"]
        and all(not row["prior_semantic_overlap"] for row in audit["cohorts"].values())
        and all(not row["replacement_progression_overlap"] for row in audit["cohorts"].values())
        and passing["decision"] == "freeze-holdout"
        and failing["decision"] == "stop-custom-compact"
    )
    value = {
        "schema": SCHEMA,
        "cohort_audit": audit,
        "perfect_response_checks": perfect,
        "explicit_coverage_prompt_checks": explicit_coverage,
        "aggregation": {
            "passing_decision": passing["decision"],
            "failing_decision": failing["decision"],
            "pass": passing["decision"] == "freeze-holdout" and failing["decision"] == "stop-custom-compact",
        },
        "resolution": {
            "decision_fixtures_per_family": 8,
            "decision_family_count": 3,
            "smallest_hard_macro_step": round(1 / 24, 6),
            "maximum_allowed_step": 0.05,
        },
        "all_checks_pass": all_checks,
    }
    value["sha256"] = core.digest(value)
    return value


def protocol_manifest() -> dict[str, Any]:
    run_jobs = jobs()
    package_files = ("development.py", "core.py", "benchmark.py", "calibration_r2.py")
    value = {
        "schema": SCHEMA,
        "run_id": RUN_ID,
        "kind": "paired-development",
        "hypothesis": "Onset groups with named slots improve vertical and role tasks without the full v0 hierarchy.",
        "candidate": "grouped-label-compact from calibration r1; unchanged",
        "arms": list(core.ARMS),
        "decision_families": list(core.DECISION_FAMILIES),
        "regression_families": list(core.REGRESSION_FAMILIES),
        "guard_families": list(core.GUARD_FAMILIES),
        "sample": {
            "decision_variants_per_family": 8,
            "regression_variants_per_family": 4,
            "guard_variants_per_family": 4,
            "calls_per_arm_provider": len(run_jobs) // len(core.ARMS),
            "calls_per_provider": len(run_jobs),
            "total_provider_calls": len(run_jobs) * len(PROVIDERS),
            "repeated_prompts": 0,
            "smallest_hard_macro_step": round(1 / 24, 6),
        },
        "providers": list(PROVIDERS),
        "models": MODELS,
        "settings": SETTINGS,
        "gate": {
            "decision": "Grouped-label compact must improve the paired decision macro over compact-bar v1 by at least 0.05 on at least two providers.",
            "hard_regression": "Its paired decision macro must not be below compact-bar v1 by more than 0.05 on any provider.",
            "candidate_only_losses": "It can have at most one loss against compact-bar v1 per provider and family.",
            "guards": "Its guard macro must not be below compact-bar v1 or label-only compact by more than 0.05 on any provider.",
            "syntax": "Its syntax rate must not be below label-only compact by more than 0.05 on any provider.",
            "efficiency": "Its input-token ratio to exact JSON must be at most 0.90 and its output-byte ratio must be at most 0.80 on every provider.",
            "capabilities": "Round trip, canonical order, identity, preservation, and sparse patch checks must pass.",
        },
        "terminal_decisions": {
            "pass": "freeze-holdout",
            "fail": "stop-custom-compact",
        },
        "allowed_follow_up": "Summarize this fixed development run. Do not start holdout without a new frozen plan and explicit approval.",
        "repair_policy": "Do not repair provider responses or change the candidate after calls.",
        "privacy": calibration_r1.protocol_manifest()["privacy"],
        "development_corpus_sha256": make_corpus("development")["sha256"],
        "reserved_holdout_corpus_sha256": make_corpus("holdout")["sha256"],
        "prompt_sha256": {
            f"{job['arm']}:{job['family']}:{job['variant']}:0": core.sha256_text(prompt_for(job["arm"], job["task"]))
            for job in run_jobs
        },
        "dependency_file_sha256": {
            name: hashlib.sha256((PACKAGE_ROOT / name).read_bytes()).hexdigest()
            for name in package_files
        },
        "source_calibration": {
            "run_id": calibration_r2.RUN_ID,
            "protocol_sha256": calibration_r2.protocol_manifest()["sha256"],
            "summary_sha256": SOURCE_CALIBRATION_SUMMARY_SHA256,
            "decision": "proceed-development",
        },
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    calls = protocol["sample"]["calls_per_provider"]
    estimates = {
        provider: {
            "calls": calls,
            "estimated_cost_usd": round(calls * RECENT_MEAN_CALL_COST_USD[provider] * 1.25, 6),
        }
        for provider in PROVIDERS
    }
    value = {
        "schema": SCHEMA,
        "run_kind": "development-run-plan",
        "run_id": RUN_ID,
        "approval": {
            "status": "pending",
            "requirement": "Get explicit operator approval for this exact development run before any provider call.",
        },
        "scope": {
            "arms": list(core.ARMS),
            "families": list(core.TASK_FAMILIES),
            "decision_variants": 8,
            "regression_variants": 4,
            "guard_variants": 4,
            "repeats": 1,
            "providers": list(PROVIDERS),
        },
        "expected_calls": {
            **{provider: calls for provider in PROVIDERS},
            "total": calls * len(PROVIDERS),
        },
        "models": MODELS,
        "settings": SETTINGS,
        "cost_estimate": {
            "providers": estimates,
            "total_usd": round(sum(row["estimated_cost_usd"] for row in estimates.values()), 6),
            "basis": COST_BASIS,
        },
        "corpus_sha256": make_corpus("development")["sha256"],
        "protocol_sha256": protocol["sha256"],
        "stopping_rule": protocol["terminal_decisions"],
        "allowed_follow_up": protocol["allowed_follow_up"],
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
        "development_corpus_sha256": value["protocol"]["development_corpus_sha256"],
        "holdout_corpus_sha256": value["protocol"]["reserved_holdout_corpus_sha256"],
        "run_plan_sha256": value["run_plan"]["sha256"],
    }


def self_test() -> dict[str, Any]:
    screen = deterministic_screen()
    run_jobs = jobs()
    assert screen["all_checks_pass"]
    assert len(run_jobs) == 220
    assert all(sum(job["arm"] == arm for job in run_jobs) == 44 for arm in core.ARMS)
    assert all(sum(job["family"] == family for job in run_jobs) == 40 for family in core.DECISION_FAMILIES)
    assert run_plan()["expected_calls"]["total"] == 660
    try:
        validate_approval_value({"status": "pending"})
    except ValueError:
        approval_gate = True
    else:
        approval_gate = False
    assert approval_gate
    return {
        "schema": SCHEMA,
        "pass": True,
        "checks": len(screen["perfect_response_checks"])
        + len(screen["explicit_coverage_prompt_checks"])
        + 12,
        "development_corpus_sha256": make_corpus("development")["sha256"],
        "holdout_corpus_sha256": make_corpus("holdout")["sha256"],
        "deterministic_sha256": deterministic_package()["sha256"],
    }


def validate_approval_value(value: dict[str, Any]) -> dict[str, Any]:
    plan = run_plan()
    if (
        value.get("run_id") != RUN_ID
        or value.get("protocol_sha256") != plan["protocol_sha256"]
        or value.get("run_plan_sha256") != plan["sha256"]
    ):
        raise ValueError("The approval does not match the frozen development plan")
    if value.get("status") != "approved" or not value.get("operator_statement"):
        raise ValueError("The approval must include an explicit operator statement")
    return value


def validate_approval(path: Path) -> dict[str, Any]:
    return validate_approval_value(json.loads(path.read_text()))


def call_job(provider: str, key: str, job: dict[str, Any]) -> dict[str, Any]:
    prompt = prompt_for(job["arm"], job["task"])
    common = {
        "arm": job["arm"],
        "family": job["family"],
        "variant": job["variant"],
        "repeat": 0,
        "task_sha256": job["task"]["sha256"],
        "semantic_sha256": job["task"]["semantic_sha256"],
        "prompt_sha256": core.sha256_text(prompt),
        "prompt_bytes": len(prompt.encode()),
    }
    try:
        outer, raw, latency_ms, retries = core.v2.call_with_retry(provider, key, prompt)
        measured = core.v2.usage(provider, raw)
        payload = outer["payload"]
        return {
            **common,
            "response_payload": payload,
            "response_payload_bytes": len(payload.encode()),
            "response_payload_sha256": core.sha256_text(payload),
            "outer_schema_valid": outer["outer_schema_valid"],
            "validation": core.score_response(job["arm"], job["task"], payload),
            "usage": measured,
            "cost_usd": core.v2.cost_usd(provider, measured),
            "latency_ms": round(latency_ms, 3),
            "retries": retries,
            "returned_model": core.v2.returned_model(provider, raw),
            "request_id": raw.get("id"),
            "stop_reason": core.v2.stop_reason(provider, raw),
            "raw_response_sha256": core.digest(raw),
        }
    except Exception as error:
        return {
            **common,
            "transport_error": f"{type(error).__name__}: {error}",
            "validation": {
                "syntax_pass": False,
                "primary_pass": False,
                "checks": {},
                "error": "transport",
            },
            "usage": {
                "input_tokens": 0,
                "cached_input_tokens": 0,
                "output_tokens": 0,
                "thinking_tokens": 0,
            },
            "cost_usd": {
                "uncached_input": 0,
                "cached_input": 0,
                "output": 0,
                "total": 0,
            },
            "retries": 3,
        }


def execute_jobs(provider: str, key: str, workers: int) -> list[dict[str, Any]]:
    ordered = jobs()
    random.Random(SEED).shuffle(ordered)
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(call_job, provider, key, job) for job in ordered]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            results.append(future.result())
            if index % 44 == 0:
                print(
                    f"{provider}: completed {index}/{len(futures)} development calls",
                    file=sys.stderr,
                    flush=True,
                )
    return sorted(
        results,
        key=lambda value: (value["arm"], value["family"], value["variant"], value["repeat"]),
    )


def run_provider(provider: str, env_file: Path, approval_file: Path, workers: int) -> dict[str, Any]:
    approval = validate_approval(approval_file)
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise ValueError("The deterministic screen failed")
    environment = core.v2.load_env(env_file)
    key = environment.get(core.v2.KEYS[provider])
    if not key:
        raise ValueError(f"{core.v2.KEYS[provider]} is missing")
    results = execute_jobs(provider, key, workers)
    value = {
        "schema": SCHEMA,
        "run_kind": "development-provider",
        "run_id": RUN_ID,
        "provider": provider,
        "requested_model": MODELS[provider],
        "client": "Python urllib.request direct HTTPS",
        "settings": SETTINGS[provider],
        "approval": approval,
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "python": platform.python_version(),
        "privacy": protocol_manifest()["privacy"],
        "protocol_sha256": protocol_manifest()["sha256"],
        "screen_sha256": screen["sha256"],
        "results": results,
        "repairs": [],
        "actual_cost_usd": round(sum(row["cost_usd"]["total"] for row in results), 6),
        "complete": len(results) == len(jobs()) and all("transport_error" not in row for row in results),
    }
    value["raw_run_sha256"] = core.digest([row.get("raw_response_sha256") for row in results])
    value["manifest_sha256"] = core.digest(value)
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
    actions.add_argument("--cohorts", action="store_true")
    actions.add_argument("--check", type=Path)
    actions.add_argument("--run-plan", action="store_true")
    actions.add_argument("--provider", choices=PROVIDERS)
    actions.add_argument("--summarize", nargs=3, type=Path)
    parser.add_argument("--env-file", type=Path, default=Path("../.env"))
    parser.add_argument("--approval-file", type=Path)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.self_test:
        value = self_test()
    elif args.deterministic:
        value = deterministic_package()
    elif args.cohorts:
        value = cohort_manifest()
    elif args.check:
        expected = json.loads(args.check.read_text())
        actual = deterministic_package()
        if deterministic_manifest(actual) != expected:
            raise SystemExit(1)
        value = {"schema": SCHEMA, "check": "pass", "sha256": actual["sha256"]}
    elif args.run_plan:
        value = run_plan()
    elif args.provider:
        if not args.approval_file:
            parser.error("--provider requires --approval-file")
        value = run_provider(args.provider, args.env_file, args.approval_file, args.workers)
    else:
        value = summarize_development([json.loads(path.read_text()) for path in args.summarize])
    write_result(value, args.output)


if __name__ == "__main__":
    main()
