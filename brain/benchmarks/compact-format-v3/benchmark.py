#!/usr/bin/env python3
"""Run the Phase 8c2.2 calibration benchmark."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import platform
import random
import sys
from collections import defaultdict
from copy import deepcopy
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PACKAGE_ROOT))
import core  # type: ignore  # noqa: E402
sys.path.pop(0)


SCHEMA = "ghostnote-compact-format-calibration-v3"
RUN_ID = "phase8c2-2-calibration-r1"
PROVIDERS = core.v2.PROVIDERS
MODELS = core.v2.MODELS
SETTINGS = {
    "openai": {"reasoning_effort": "low", "max_completion_tokens": 3000},
    "gemini": {"thinking_level": "low", "max_output_tokens": 3000},
    "claude": {"effort": "low", "max_tokens": 3000},
    "temperature": "provider default",
}
ELIGIBILITY_BAND = {"minimum": 0.20, "maximum": 0.90, "minimum_providers": 2}
EXPECTED_V2_TREE_SHA256 = "57d854205d62f97e1fd79614b6d723cbbb9d79ce59fd581103bbfd16d193235a"
EMPIRICAL_COST_BASIS = {
    "source": "Phase 8c2 development and holdout provider manifests",
    "method": "Use the larger recent observed mean call cost for each provider and add 25 percent.",
    "price_verification_date": "2026-09-27",
    "price_sources": core.v2.PRICE_SOURCES,
    "mean_call_cost_usd": {
        "openai": 0.004619055555555556,
        "gemini": 0.002934876739562624,
        "claude": 0.01633838888888889,
    },
    "contingency": 0.25,
}


def tree_sha256(root: Path) -> str:
    value = hashlib.sha256()
    for path in sorted(item for item in root.rglob("*") if item.is_file() and "__pycache__" not in item.parts and item.suffix != ".pyc"):
        value.update(path.relative_to(root).as_posix().encode())
        value.update(b"\0")
        value.update(hashlib.sha256(path.read_bytes()).digest())
    return value.hexdigest()


def semantic_body(value: dict[str, Any]) -> dict[str, Any]:
    ignored = {"schema", "id", "cohort", "variant", "origin", "license", "sha256", "semantic_sha256"}
    return {name: field for name, field in value.items() if name not in ignored}


def load_old_holdout() -> Any:
    previous = sys.modules.pop("benchmark", None)
    sys.path.insert(0, str(core.V2_ROOT))
    try:
        module = core.load_module("ghostnote_compact_format_v2_holdout", core.V2_ROOT / "holdout.py")
    finally:
        sys.path.pop(0)
        if previous is not None:
            sys.modules["benchmark"] = previous
        else:
            sys.modules.pop("benchmark", None)
    return module


def all_historical_semantics() -> set[str]:
    old_holdout = load_old_holdout()
    tasks = []
    tasks.extend(value for values in core.v2.make_corpus()["fixtures"].values() for value in values)
    tasks.extend(value for values in old_holdout.make_corpus()["fixtures"].values() for value in values)
    tasks.extend(value for values in core.v2.v1_corpus.make_corpus()["retained"].values() for value in values)
    return {core.digest(semantic_body(value)) for value in tasks}


def cohort_audit() -> dict[str, Any]:
    corpora = {name: core.make_corpus(name) for name in core.COHORT_SPECS}
    hashes = {
        name: {value["sha256"] for values in corpus["fixtures"].values() for value in values}
        for name, corpus in corpora.items()
    }
    semantics = {
        name: {value["semantic_sha256"] for values in corpus["fixtures"].values() for value in values}
        for name, corpus in corpora.items()
    }
    pairwise = []
    names = list(corpora)
    for index, left in enumerate(names):
        for right in names[index + 1 :]:
            pairwise.append(
                {
                    "left": left,
                    "right": right,
                    "fixture_hash_overlap": len(hashes[left] & hashes[right]),
                    "semantic_hash_overlap": len(semantics[left] & semantics[right]),
                }
            )
    historical = all_historical_semantics()
    return {
        "cohorts": {
            name: {
                "corpus_sha256": corpus["sha256"],
                "fixture_count": sum(len(values) for values in corpus["fixtures"].values()),
                "fixture_sha256": sorted(hashes[name]),
                "semantic_sha256": sorted(semantics[name]),
                "historical_semantic_overlap": len(semantics[name] & historical),
            }
            for name, corpus in corpora.items()
        },
        "pairwise": pairwise,
    }


def cohort_manifest() -> dict[str, Any]:
    value = {"schema": core.CORPUS_SCHEMA, "kind": "cohort-manifest", **cohort_audit()}
    value["sha256"] = core.digest(value)
    return value


def grouped_capability_screen() -> dict[str, Any]:
    corpus = core.make_corpus("calibration")
    source_task = corpus["fixtures"]["comprehension-structure"][0]
    notes = source_task["expected"]
    rendered = core.render_grouped(notes)
    parsed = core.parse_grouped(rendered)
    mixed = [
        core.note("m1", "bass", "0", "1", 48, 80),
        core.note("m2", "lead", "0", "1/2", 67, 84),
        core.note("m3", "lead", "1", "1/2", 69, 84),
    ]
    mixed_text = core.render_grouped(mixed)
    exact_text = core.render_events("exact-json", notes, source_task, source_task["id"])
    grouped_prompt = core.prompt_for("grouped-label-compact", source_task)
    exact_prompt = core.prompt_for("exact-json", source_task)
    bad_order = "\n".join(reversed(rendered.splitlines()))
    rejected = False
    try:
        core.parse_grouped(bad_order)
    except ValueError:
        rejected = True
    return {
        "round_trip": core.projected(parsed, core.FIELDS) == core.projected(notes, core.FIELDS),
        "canonical_reorder_rejected": rejected,
        "mixed_duration_round_trip": core.projected(core.parse_grouped(mixed_text), core.FIELDS) == core.projected(mixed, core.FIELDS),
        "stable_identity": [value["id"] for value in parsed] == [value["id"] for value in core.sort_notes(notes)],
        "exact_preservation": core.projected(parsed, core.FIELDS) == core.projected(notes, core.FIELDS),
        "sparse_patch": core.parse_patch("grouped-label-compact", core.render_patch("grouped-label-compact", "abc", {"op": "set", "id": "m1", "velocity": 81})) == {"base_sha256": "abc", "ops": [{"op": "set", "id": "m1", "velocity": 81}]},
        "grouped_bytes": len(rendered.encode()),
        "exact_json_bytes": len(exact_text.encode()),
        "output_byte_ratio_to_exact": round(len(rendered.encode()) / len(exact_text.encode()), 6),
        "grouped_prompt_token_estimate": (len(grouped_prompt.encode()) + 3) // 4,
        "exact_prompt_token_estimate": (len(exact_prompt.encode()) + 3) // 4,
        "input_token_estimate_ratio_to_exact": round(len(grouped_prompt.encode()) / len(exact_prompt.encode()), 6),
        "render_sha256": core.sha256_text(rendered),
    }


def contract_screen() -> dict[str, Any]:
    corpus = core.make_corpus("calibration")
    positive = []
    negative = []
    for arm in core.ARMS:
        for family in core.TASK_FAMILIES:
            for task in corpus["fixtures"][family]:
                result = core.score_response(arm, task, core.perfect_payload(arm, task))
                positive.append({"arm": arm, "task": task["id"], "pass": result["primary_pass"]})
                bad = core.score_response(arm, task, "INVALID")
                negative.append({"arm": arm, "task": task["id"], "pass": not bad["primary_pass"]})
    revoice_mutations = core.revoice_mutation_tests()
    progression_mutations = core.progression_mutation_tests()
    retained_mutations = core.retained_family_mutation_tests()
    tied_source = []
    for chord, (start, pitches) in enumerate((("0", (45, 46, 47, 54)), ("1", (45, 46, 47, 48))), start=1):
        for voice, pitch in zip(core.VOICE_ORDER, pitches):
            tied_source.append(core.note(f"tie-{chord}-{voice}", voice, start, "1", pitch, 80))
    tied_contract = {
        "source": core.sort_notes(tied_source),
        "operation": "nearest",
        "range": [34, 86],
        "voice_ranges": {voice: [34, 86] for voice in core.VOICE_ORDER},
    }
    tied_first = core.perfect_revoice(tied_contract)
    tied_second = deepcopy(tied_first)
    tied_second[-1]["pitch"] = 60
    tie_checks = [
        core.score_revoice(tied_first, tied_contract, True),
        core.score_revoice(tied_second, tied_contract, True),
    ]
    return {
        "positive": positive,
        "negative": negative,
        "revoice_mutations": revoice_mutations,
        "progression_mutations": progression_mutations,
        "retained_family_mutations": retained_mutations,
        "revoice_tie_realizations": {
            "candidate_count": len(core.nearest_choices([45, 46, 47, 48], [45, 46, 47, 54], tied_contract)),
            "passes": [all(checks.values()) for checks in tie_checks],
        },
        "reference_instruction_agreement": all(value["pass"] for value in positive),
    }


def synthetic_results(pattern: dict[str, list[bool]] | None = None) -> list[dict[str, Any]]:
    results = []
    counters: dict[tuple[str, str], int] = defaultdict(int)
    for job in core.jobs("calibration"):
        scored = core.score_response(job["arm"], job["task"], core.perfect_payload(job["arm"], job["task"]))
        if pattern and job["arm"] in {"exact-json", "midi-like-native"} and job["family"] in pattern:
            key = (job["arm"], job["family"])
            choices = pattern[job["family"]]
            scored["primary_pass"] = choices[counters[key] % len(choices)]
            counters[key] += 1
        results.append(
            {
                "arm": job["arm"],
                "family": job["family"],
                "variant": job["variant"],
                "repeat": job["repeat"],
                "response_payload_bytes": 100,
                "usage": {"input_tokens": 100, "cached_input_tokens": 0, "output_tokens": 50, "thinking_tokens": 0},
                "validation": scored,
            }
        )
    return results


def summarize_calibration(runs: list[dict[str, Any]], protocol_sha256: str | None = None) -> dict[str, Any]:
    if {run["provider"] for run in runs} != set(PROVIDERS):
        raise ValueError("The summary needs one run from each provider")
    expected_protocol = protocol_sha256 or protocol_manifest()["sha256"]
    if any(run["protocol_sha256"] != expected_protocol for run in runs):
        raise ValueError("The provider runs do not use the same protocol")
    providers = []
    eligibility_counts = defaultdict(int)
    for run in runs:
        family_rows = []
        for family in core.TASK_FAMILIES:
            arm_rows = []
            for arm in core.ARMS:
                selected = [row for row in run["results"] if row["family"] == family and row["arm"] == arm]
                arm_rows.append(
                    {
                        "arm": arm,
                        "successes": sum(row["validation"]["primary_pass"] for row in selected),
                        "trials": len(selected),
                        "rate": round(sum(row["validation"]["primary_pass"] for row in selected) / len(selected), 6),
                    }
                )
            controls = [row for row in arm_rows if row["arm"] in {"exact-json", "midi-like-native"}]
            successes = sum(row["successes"] for row in controls)
            trials = sum(row["trials"] for row in controls)
            rate = successes / trials
            eligible = ELIGIBILITY_BAND["minimum"] <= rate <= ELIGIBILITY_BAND["maximum"]
            eligibility_counts[family] += eligible
            family_rows.append(
                {
                    "family": family,
                    "arms": arm_rows,
                    "control_pool": {"successes": successes, "trials": trials, "rate": round(rate, 6), "eligible": eligible},
                }
            )
        providers.append(
            {
                "provider": run["provider"],
                "families": family_rows,
                "actual_cost_usd": run["actual_cost_usd"],
                "complete": run["complete"],
            }
        )
    family_eligibility = [
        {
            "family": family,
            "eligible_providers": eligibility_counts[family],
            "eligible": eligibility_counts[family] >= ELIGIBILITY_BAND["minimum_providers"],
            "role": "decision-critical" if family in core.DECISION_FAMILIES else "regression-or-guard",
        }
        for family in core.TASK_FAMILIES
    ]
    decision_ready = all(row["eligible"] for row in family_eligibility if row["family"] in core.DECISION_FAMILIES)
    complete = all(run["complete"] for run in runs)
    value = {
        "schema": SCHEMA,
        "run_kind": "calibration-summary",
        "run_id": RUN_ID,
        "decision": "proceed-development" if complete and decision_ready else "repair-measurement",
        "eligibility_band": ELIGIBILITY_BAND,
        "family_eligibility": family_eligibility,
        "providers": providers,
        "actual_cost_usd": {
            **{run["provider"]: run["actual_cost_usd"] for run in runs},
            "total": round(sum(run["actual_cost_usd"] for run in runs), 6),
        },
        "protocol_sha256": expected_protocol,
    }
    value["sha256"] = core.digest(value)
    return value


def aggregation_screen() -> dict[str, Any]:
    protocol_sha = "synthetic-protocol"
    informative = {family: [True, False, True] for family in core.DECISION_FAMILIES}
    informative["generation-melody"] = [True]
    good_runs = [
        {
            "provider": provider,
            "protocol_sha256": protocol_sha,
            "results": synthetic_results(informative),
            "actual_cost_usd": 0,
            "complete": True,
        }
        for provider in PROVIDERS
    ]
    floor_pattern = deepcopy(informative)
    floor_pattern["transformation-revoice"] = [False]
    floor_runs = [
        {
            "provider": provider,
            "protocol_sha256": protocol_sha,
            "results": synthetic_results(floor_pattern),
            "actual_cost_usd": 0,
            "complete": True,
        }
        for provider in PROVIDERS
    ]
    proceed = summarize_calibration(good_runs, protocol_sha)
    repair = summarize_calibration(floor_runs, protocol_sha)
    return {
        "informative_decision": proceed["decision"],
        "floor_decision": repair["decision"],
        "pass": proceed["decision"] == "proceed-development" and repair["decision"] == "repair-measurement",
        "informative_sha256": proceed["sha256"],
        "floor_sha256": repair["sha256"],
    }


def deterministic_screen() -> dict[str, Any]:
    cohorts = cohort_audit()
    capabilities = grouped_capability_screen()
    contracts = contract_screen()
    aggregation = aggregation_screen()
    v2_tree = tree_sha256(core.V2_ROOT)
    pairwise_clean = all(not row["fixture_hash_overlap"] and not row["semantic_hash_overlap"] for row in cohorts["pairwise"])
    historical_clean = all(not row["historical_semantic_overlap"] for row in cohorts["cohorts"].values())
    mutation_pass = all(row["pass"] for row in contracts["revoice_mutations"])
    progression_mutation_pass = all(row["pass"] for row in contracts["progression_mutations"])
    retained_mutation_pass = all(row["pass"] for row in contracts["retained_family_mutations"])
    capability_pass = all(
        capabilities[name]
        for name in ("round_trip", "canonical_reorder_rejected", "mixed_duration_round_trip", "stable_identity", "exact_preservation", "sparse_patch")
    )
    value = {
        "schema": SCHEMA,
        "cohort_audit": cohorts,
        "grouped_capabilities": capabilities,
        "contract_screen": contracts,
        "aggregation_screen": aggregation,
        "frozen_v2": {"expected": EXPECTED_V2_TREE_SHA256, "actual": v2_tree, "pass": v2_tree == EXPECTED_V2_TREE_SHA256},
        "resolution": {
            "development_decision_fixtures_per_family": core.COHORT_SPECS["development"]["decision"],
            "decision_family_count": len(core.DECISION_FAMILIES),
            "smallest_hard_macro_step": round(1 / (int(core.COHORT_SPECS["development"]["decision"]) * len(core.DECISION_FAMILIES)), 6),
            "maximum_allowed_step": 0.05,
        },
        "all_checks_pass": pairwise_clean
        and historical_clean
        and capability_pass
        and contracts["reference_instruction_agreement"]
        and all(row["pass"] for row in contracts["negative"])
        and mutation_pass
        and progression_mutation_pass
        and retained_mutation_pass
        and contracts["revoice_tie_realizations"]["candidate_count"] == 2
        and all(contracts["revoice_tie_realizations"]["passes"])
        and aggregation["pass"]
        and v2_tree == EXPECTED_V2_TREE_SHA256
        and 1 / (int(core.COHORT_SPECS["development"]["decision"]) * len(core.DECISION_FAMILIES)) <= 0.05,
    }
    value["sha256"] = core.digest(value)
    return value


def protocol_manifest() -> dict[str, Any]:
    run_jobs = core.jobs("calibration")
    package_files = ("benchmark.py", "core.py", "README.md", "CONTRACTS.md", "cohort-manifest.json")
    value = {
        "schema": SCHEMA,
        "run_id": RUN_ID,
        "kind": "diagnostic-calibration",
        "selection_authority": "None. Calibration cannot select a format.",
        "hypothesis": "Onset groups with named slots improve vertical and role tasks without the full v0 hierarchy.",
        "arms": list(core.ARMS),
        "decision_families": list(core.DECISION_FAMILIES),
        "regression_families": list(core.REGRESSION_FAMILIES),
        "guard_families": list(core.GUARD_FAMILIES),
        "sample": {
            "decision_variants_per_family": core.COHORT_SPECS["calibration"]["decision"],
            "regression_variants_per_family": core.COHORT_SPECS["calibration"]["regression"],
            "guard_variants_per_family": core.COHORT_SPECS["calibration"]["guard"],
            "calls_per_arm_provider": len(run_jobs) // len(core.ARMS),
            "calls_per_provider": len(run_jobs),
            "total_provider_calls": len(run_jobs) * len(PROVIDERS),
            "repeated_prompts": 0,
        },
        "providers": list(PROVIDERS),
        "models": MODELS,
        "settings": SETTINGS,
        "eligibility_band": ELIGIBILITY_BAND,
        "capabilities": core.capability_manifest(),
        "stopping_rule": "If any decision-critical family is outside the eligibility band on two or more providers, return repair-measurement and stop provider work. Otherwise, freeze the development protocol.",
        "allowed_follow_up": "Summarize the fixed calibration. Do not start development without a new frozen plan and explicit approval.",
        "repair_policy": "Do not repair provider responses. Keep calibration, development, and holdout responses separate.",
        "privacy": "Send generated MIT symbolic text only. Do not send live project data, MIDI files, audio, or API keys.",
        "corpus_sha256": core.make_corpus("calibration")["sha256"],
        "prompt_sha256": {
            f"{job['arm']}:{job['family']}:{job['variant']}:0": core.sha256_text(core.prompt_for(job["arm"], job["task"]))
            for job in run_jobs
        },
        "package_file_sha256": {
            name: hashlib.sha256((PACKAGE_ROOT / name).read_bytes()).hexdigest()
            for name in package_files
            if (PACKAGE_ROOT / name).exists()
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
            "estimated_cost_usd": round(calls * EMPIRICAL_COST_BASIS["mean_call_cost_usd"][provider] * 1.25, 6),
        }
        for provider in PROVIDERS
    }
    value = {
        "schema": SCHEMA,
        "run_kind": "calibration-run-plan",
        "run_id": RUN_ID,
        "approval": {"status": "pending", "requirement": "Get explicit operator approval for this exact calibration before any provider call."},
        "scope": {
            "arms": list(core.ARMS),
            "families": list(core.TASK_FAMILIES),
            "decision_variants": core.COHORT_SPECS["calibration"]["decision"],
            "regression_variants": core.COHORT_SPECS["calibration"]["regression"],
            "guard_variants": core.COHORT_SPECS["calibration"]["guard"],
            "repeats": 1,
            "providers": list(PROVIDERS),
        },
        "expected_calls": {**{provider: calls for provider in PROVIDERS}, "total": calls * len(PROVIDERS)},
        "models": MODELS,
        "settings": SETTINGS,
        "cost_estimate": {
            "providers": estimates,
            "total_usd": round(sum(row["estimated_cost_usd"] for row in estimates.values()), 6),
            "basis": EMPIRICAL_COST_BASIS,
        },
        "corpus_sha256": core.make_corpus("calibration")["sha256"],
        "protocol_sha256": protocol["sha256"],
        "stopping_rule": protocol["stopping_rule"],
        "allowed_follow_up": protocol["allowed_follow_up"],
    }
    value["sha256"] = core.digest(value)
    return value


def deterministic_package() -> dict[str, Any]:
    value = {"schema": SCHEMA, "run_kind": "deterministic", "screen": deterministic_screen(), "protocol": protocol_manifest(), "run_plan": run_plan()}
    value["sha256"] = core.digest(value)
    return value


def deterministic_manifest(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": value["schema"],
        "sha256": value["sha256"],
        "screen_sha256": value["screen"]["sha256"],
        "protocol_sha256": value["protocol"]["sha256"],
        "corpus_sha256": value["protocol"]["corpus_sha256"],
        "run_plan_sha256": value["run_plan"]["sha256"],
    }


def self_test() -> dict[str, Any]:
    screen = deterministic_screen()
    run_jobs = core.jobs("calibration")
    assert screen["all_checks_pass"]
    assert len(run_jobs) == 70
    assert all(sum(job["arm"] == arm for job in run_jobs) == 14 for arm in core.ARMS)
    assert all(sum(job["family"] == family for job in run_jobs) == 15 for family in core.DECISION_FAMILIES)
    assert run_plan()["expected_calls"]["total"] == 210
    return {
        "schema": SCHEMA,
        "pass": True,
        "checks": len(screen["contract_screen"]["positive"])
        + len(screen["contract_screen"]["negative"])
        + len(screen["contract_screen"]["revoice_mutations"])
        + len(screen["contract_screen"]["progression_mutations"])
        + len(screen["contract_screen"]["retained_family_mutations"])
        + 10,
        "calibration_corpus_sha256": core.make_corpus("calibration")["sha256"],
        "deterministic_sha256": deterministic_package()["sha256"],
    }


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    if value.get("run_id") != RUN_ID or value.get("protocol_sha256") != plan["protocol_sha256"] or value.get("run_plan_sha256") != plan["sha256"]:
        raise ValueError("The approval does not match the frozen calibration plan")
    if value.get("status") != "approved" or not value.get("operator_statement"):
        raise ValueError("The approval must include an explicit operator statement")
    return value


def call_job(provider: str, key: str, job: dict[str, Any]) -> dict[str, Any]:
    prompt = core.prompt_for(job["arm"], job["task"])
    common = {
        "arm": job["arm"],
        "family": job["family"],
        "variant": job["variant"],
        "repeat": job["repeat"],
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
            "validation": {"syntax_pass": False, "primary_pass": False, "checks": {}, "error": "transport"},
            "usage": {"input_tokens": 0, "cached_input_tokens": 0, "output_tokens": 0, "thinking_tokens": 0},
            "cost_usd": {"uncached_input": 0, "cached_input": 0, "output": 0, "total": 0},
            "retries": 3,
        }


def execute_jobs(provider: str, key: str, workers: int) -> list[dict[str, Any]]:
    ordered = core.jobs("calibration")
    random.Random(8221).shuffle(ordered)
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(call_job, provider, key, job) for job in ordered]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            results.append(future.result())
            if index % 14 == 0:
                print(f"{provider}: completed {index}/{len(futures)} calibration calls", file=sys.stderr, flush=True)
    return sorted(results, key=lambda value: (value["arm"], value["family"], value["variant"], value["repeat"]))


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
        "run_kind": "calibration-provider",
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
        "complete": len(results) == 70 and all("transport_error" not in row for row in results),
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
            print(core.canonical({"expected_sha256": expected.get("sha256"), "actual_sha256": actual.get("sha256")}), file=sys.stderr)
            raise SystemExit(1)
        value = {"schema": SCHEMA, "check": "pass", "sha256": actual["sha256"]}
    elif args.run_plan:
        value = run_plan()
    elif args.provider:
        if not args.approval_file:
            parser.error("--provider requires --approval-file")
        value = run_provider(args.provider, args.env_file, args.approval_file, args.workers)
    else:
        value = summarize_calibration([json.loads(path.read_text()) for path in args.summarize])
    write_result(value, args.output)


if __name__ == "__main__":
    main()
