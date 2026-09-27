#!/usr/bin/env python3
"""Run the Phase 8c2.3 compact JSON calibration benchmark."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import math
import os
import platform
import random
import re
import sys
from collections import defaultdict
from copy import deepcopy
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PACKAGE_ROOT))
import core  # type: ignore  # noqa: E402
sys.path.pop(0)


SCHEMA = "ghostnote-compact-json-calibration-v1"
RUN_ID = "phase8c2-3-compact-json-calibration-r1"
PROVIDERS = core.v3.v2.PROVIDERS
MODELS = core.v3.v2.MODELS
SETTINGS = {
    "openai": {"reasoning_effort": "low", "max_completion_tokens": 3000},
    "gemini": {"thinking_level": "low", "max_output_tokens": 3000},
    "claude": {"effort": "low", "max_tokens": 3000},
    "temperature": "provider default",
}
ELIGIBILITY_BAND = {"minimum": 0.20, "maximum": 0.90, "minimum_providers": 2}
CONTROL_ARMS = ("exact-object-json-midi", "midi-like-native")
FROZEN_PACKAGE_SHA256 = {
    "compact-bar-v0": "c09b5c19662f56ee9a8e96beb42b952db45d198592bdbce71666568d71786458",
    "symbolic-format-v1": "ba174bf3903c9966a979e55af96fe3754112530bacd83214117663bd81133397",
    "compact-format-v2": "57d854205d62f97e1fd79614b6d723cbbb9d79ce59fd581103bbfd16d193235a",
    "compact-format-v3": "ef64c8dd25e52b12da52e17c040d9d8c2c270692618213a2efde2893d0d6d7b8",
}
EMPIRICAL_COST_BASIS = {
    "source": "Phase 8c2 and Phase 8c2.2 provider manifests",
    "method": "Use the larger recent observed mean call cost for each provider and add 25 percent.",
    "price_verification_date": "2026-09-27",
    "price_sources": core.v3.v2.PRICE_SOURCES,
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


def values_in_corpus(corpus: dict[str, Any], groups: tuple[str, ...] = ("fixtures", "retained", "development", "secondary")) -> list[dict[str, Any]]:
    result = []
    for group in groups:
        collections = corpus.get(group, {})
        if isinstance(collections, dict):
            result.extend(value for values in collections.values() for value in values)
    return result


def load_v2_holdout() -> Any:
    previous = sys.modules.get("benchmark")
    sys.modules["benchmark"] = core.v3.v2
    try:
        return core.load_module("ghostnote_compact_format_v2_holdout_for_json", core.v3.V2_ROOT / "holdout.py")
    finally:
        if previous is None:
            sys.modules.pop("benchmark", None)
        else:
            sys.modules["benchmark"] = previous


def historical_semantics() -> set[str]:
    tasks = []
    tasks.extend(values_in_corpus(core.v3.v2.v1_corpus.make_corpus()))
    tasks.extend(values_in_corpus(core.v3.v2.make_corpus()))
    tasks.extend(values_in_corpus(load_v2_holdout().make_corpus()))
    for cohort in core.v3.COHORT_SPECS:
        tasks.extend(values_in_corpus(core.v3.make_corpus(cohort)))
    result = {core.digest({"family": value["family"], **semantic_body(value)}) for value in tasks}

    def collect(value: Any) -> None:
        if isinstance(value, dict):
            semantic = value.get("semantic_sha256")
            if isinstance(semantic, str) and re.fullmatch(r"[0-9a-f]{64}", semantic):
                result.add(semantic)
            for item in value.values():
                collect(item)
        elif isinstance(value, list):
            for item in value:
                collect(item)

    for package in FROZEN_PACKAGE_SHA256:
        for path in (core.BENCHMARKS_ROOT / package).rglob("*.json"):
            try:
                collect(json.loads(path.read_text()))
            except json.JSONDecodeError:
                continue
    return result


def cohort_audit() -> dict[str, Any]:
    corpora = {name: core.make_corpus(name) for name in core.COHORT_SPECS}
    hashes = {
        name: {value["sha256"] for value in values_in_corpus(corpus)}
        for name, corpus in corpora.items()
    }
    semantics = {
        name: {value["semantic_sha256"] for value in values_in_corpus(corpus)}
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
    historical = historical_semantics()
    return {
        "cohorts": {
            name: {
                "corpus_sha256": corpus["sha256"],
                "fixture_count": len(values_in_corpus(corpus)),
                "fixture_sha256": sorted(hashes[name]),
                "semantic_sha256": sorted(semantics[name]),
                "historical_semantic_overlap": len(semantics[name] & historical),
            }
            for name, corpus in corpora.items()
        },
        "historical_semantic_count": len(historical),
        "pairwise": pairwise,
    }


def cohort_manifest() -> dict[str, Any]:
    value = {"schema": core.CORPUS_SCHEMA, "kind": "cohort-manifest", **cohort_audit()}
    value["sha256"] = core.digest(value)
    return value


def expect_rejected(action: Any) -> bool:
    try:
        action()
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return True
    return False


def format_screen() -> dict[str, Any]:
    task = core.make_corpus("calibration")["fixtures"]["comprehension-structure"][0]
    notes = task["expected"]
    documents = {}
    semantic_documents = {}
    sizes = {}
    prompts = {}
    patches = {}
    for arm in core.JSON_ARMS:
        rendered = core.render_document(arm, notes, task, task["id"])
        parsed = core.parse_document(arm, rendered)
        documents[arm] = {
            "round_trip": core.document_notes(parsed) == core.normalize_notes(notes),
            "metadata": parsed == core.make_document(notes, task, task["id"]),
            "stable_identity": [value["id"] for value in core.document_notes(parsed)] == [value["id"] for value in core.normalize_notes(notes)],
            "canonical_render": core.render_document(arm, notes, task, task["id"]) == rendered,
        }
        semantic_documents[arm] = parsed
        sizes[arm] = {"document_bytes": len(rendered.encode())}
        prompt = core.prompt_for(arm, task)
        prompts[arm] = {"bytes": len(prompt.encode()), "token_estimate": (len(prompt.encode()) + 3) // 4}
        source = task["source"]
        target_id = source["notes"][0]["id"]
        operation = {"op": "set-note", "id": target_id, "changes": {"velocity": source["notes"][0]["velocity"] + 1}}
        patch_text = core.render_patch(arm, "base", [operation])
        parsed_patch = core.parse_patch(arm, patch_text)
        compiled = core.compile_patch(parsed_patch, source["notes"], "base")
        pitch_operation = {"op": "set-note", "id": target_id, "changes": {"pitch": source["notes"][0]["pitch"] + 1}}
        pitch_patch = core.parse_patch(arm, core.render_patch(arm, "base", [pitch_operation]))
        patches[arm] = {
            "round_trip": parsed_patch == {"base_sha256": "base", "ops": [operation]},
            "pitch_value_round_trip": pitch_patch == {"base_sha256": "base", "ops": [pitch_operation]},
            "sparse": list(parsed_patch["ops"][0]["changes"]) == ["velocity"],
            "identity": {value["id"] for value in compiled} == {value["id"] for value in source["notes"]},
            "preservation": sum(before != after for before, after in zip(core.normalize_notes(source["notes"]), compiled)) == 1,
            "bytes": len(patch_text.encode()),
        }
    comparable = [
        {
            "score": value["score"],
            "bars": value["bars"],
            "tracks": value["tracks"],
            "regions": value["regions"],
            "notes": value["notes"],
        }
        for value in semantic_documents.values()
    ]
    tuple_arm = "tuple-json-pc-register"
    invalid_tuple = json.loads(core.render_document(tuple_arm, notes, task, task["id"]))
    invalid_tuple["notes"][0].pop()
    invalid_pc = json.loads(core.render_document(tuple_arm, notes, task, task["id"]))
    invalid_pc["notes"][0][5] = [12, 4]
    invalid_midi = json.loads(core.render_document("tuple-json-midi", notes, task, task["id"]))
    invalid_midi["notes"][0][5] = 128
    bad_order = json.loads(core.render_document("exact-object-json-midi", notes, task, task["id"]))
    bad_order["notes"].reverse()
    duplicate_target = {
        "base_sha256": "base",
        "ops": [
            {"op": "set-note", "id": notes[0]["id"], "changes": {"velocity": 80}},
            {"op": "set-note", "id": notes[0]["id"], "changes": {"pitch": 60}},
        ],
    }
    conflict = {
        "invalid_tuple": expect_rejected(lambda: core.parse_document(tuple_arm, core.canonical(invalid_tuple))),
        "invalid_pitch_class": expect_rejected(lambda: core.parse_document(tuple_arm, core.canonical(invalid_pc))),
        "invalid_midi": expect_rejected(lambda: core.parse_document("tuple-json-midi", core.canonical(invalid_midi))),
        "noncanonical_order": expect_rejected(lambda: core.parse_document("exact-object-json-midi", core.canonical(bad_order))),
        "stale_base": expect_rejected(lambda: core.compile_patch({"base_sha256": "old", "ops": [{"op": "set-note", "id": notes[0]["id"], "changes": {"velocity": 80}}]}, notes, "new")),
        "unknown_id": expect_rejected(lambda: core.compile_patch({"base_sha256": "base", "ops": [{"op": "set-note", "id": "missing", "changes": {"velocity": 80}}]}, notes, "base")),
        "duplicate_target": expect_rejected(lambda: core.validate_patch(duplicate_target)),
    }
    pitch_round_trips = [core.pc_register_to_pitch(core.pitch_to_pc_register(value)) == value for value in range(128)]
    pitch_invalid = [
        expect_rejected(lambda value=value: core.pitch_to_pc_register(value)) for value in (-1, 128)
    ] + [
        expect_rejected(lambda value=value: core.pc_register_to_pitch(value))
        for value in ([12, 4], [8, 9], [-1, 4], [0], 60)
    ]
    native = core.render_native(notes)
    sizes["midi-like-native"] = {"document_bytes": len(native.encode())}
    native_prompt = core.prompt_for("midi-like-native", task)
    prompts["midi-like-native"] = {"bytes": len(native_prompt.encode()), "token_estimate": (len(native_prompt.encode()) + 3) // 4}
    return {
        "documents": documents,
        "equal_json_semantics": all(value == comparable[0] for value in comparable[1:]),
        "patches": patches,
        "pitch_bounds_and_round_trips": all(pitch_round_trips) and all(pitch_invalid),
        "invalid_and_conflict_cases": conflict,
        "sizes": sizes,
        "prompt_token_estimates": prompts,
        "schema_manifest": core.schema_manifest(),
        "native_round_trip": core.projected(core.parse_native(native), core.MUSICAL_FIELDS) == core.projected(notes, core.MUSICAL_FIELDS),
    }


def prompt_grammar_screen() -> list[dict[str, Any]]:
    corpus = core.make_corpus("calibration")
    cases = []
    seen = set()
    for arm in core.ARMS:
        for family in core.TASK_FAMILIES:
            form = core.output_form(arm, family)
            key = (arm, form)
            if key in seen:
                continue
            seen.add(key)
            task = corpus["fixtures"][family][0]
            example = core.output_example(arm, family)
            if form == "json-patch":
                parsed = core.parse_patch(arm, example)
                valid = bool(parsed["ops"])
            else:
                parsed_notes = core.parse_events(arm, example)
                valid = bool(parsed_notes)
            prompt = core.prompt_for(arm, task)
            cases.append(
                {
                    "arm": arm,
                    "form": form,
                    "template_present": bool(core.output_grammar(arm, family)),
                    "example_present": example in prompt,
                    "example_parses": valid,
                }
            )
    return cases


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
    return {
        "positive": positive,
        "negative": negative,
        "revoice_mutations": core.v3.revoice_mutation_tests(),
        "progression_mutations": core.v3.progression_mutation_tests(),
        "retained_family_mutations": core.v3.retained_family_mutation_tests(),
        "prompt_grammar_forms": prompt_grammar_screen(),
        "reference_instruction_agreement": all(value["pass"] for value in positive),
    }


def paired_contrast(rows: list[dict[str, Any]], candidate: str, baseline: str) -> dict[str, Any]:
    def keyed(arm: str) -> dict[tuple[str, int, int], bool]:
        return {
            (row["family"], row["variant"], row.get("repeat", 0)): bool(row["validation"]["primary_pass"])
            for row in rows
            if row["arm"] == arm
        }

    candidate_rows = keyed(candidate)
    baseline_rows = keyed(baseline)
    keys = sorted(candidate_rows.keys() & baseline_rows.keys())
    wins = sum(candidate_rows[key] and not baseline_rows[key] for key in keys)
    losses = sum(baseline_rows[key] and not candidate_rows[key] for key in keys)
    denominator = len(keys)
    effect = (wins - losses) / denominator if denominator else 0.0
    discordant = wins + losses
    standard_error = math.sqrt(max(discordant - (wins - losses) ** 2 / denominator, 0) / denominator**2) if denominator else 0.0
    return {
        "candidate": candidate,
        "baseline": baseline,
        "paired_denominator": denominator,
        "candidate_only_wins": wins,
        "candidate_only_losses": losses,
        "effect": round(effect, 6),
        "wald_95": [round(effect - 1.96 * standard_error, 6), round(effect + 1.96 * standard_error, 6)],
    }


def factorial_contrasts(rows: list[dict[str, Any]]) -> dict[str, Any]:
    tuple_midi = paired_contrast(rows, "tuple-json-midi", "exact-object-json-midi")
    tuple_pc = paired_contrast(rows, "tuple-json-pc-register", "exact-object-json-pc-register")
    object_pitch = paired_contrast(rows, "exact-object-json-pc-register", "exact-object-json-midi")
    tuple_pitch = paired_contrast(rows, "tuple-json-pc-register", "tuple-json-midi")
    return {
        "tuple_shape_at_midi": tuple_midi,
        "tuple_shape_at_pc_register": tuple_pc,
        "pitch_encoding_in_objects": object_pitch,
        "pitch_encoding_in_tuples": tuple_pitch,
        "interaction": round(tuple_pitch["effect"] - object_pitch["effect"], 6),
        "factorial_arms": list(core.JSON_ARMS),
        "excluded_arm": "midi-like-native",
    }


def factorial_report(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "overall": factorial_contrasts(rows),
        "by_family": {
            family: factorial_contrasts([row for row in rows if row["family"] == family])
            for family in core.TASK_FAMILIES
        },
    }


def common_arm_metrics(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for arm in core.ARMS:
        selected = [row for row in rows if row["arm"] == arm]
        result.append(
            {
                "arm": arm,
                "musical_successes": sum(row["validation"]["primary_pass"] for row in selected),
                "trials": len(selected),
                "input_tokens": sum(row.get("usage", {}).get("input_tokens", 0) for row in selected),
                "output_bytes": sum(row.get("response_payload_bytes", 0) for row in selected),
                "mean_latency_ms": round(sum(row.get("latency_ms", 0) for row in selected) / len(selected), 3) if selected else 0,
            }
        )
    return result


def synthetic_results(pattern: dict[str, list[bool]] | None = None) -> list[dict[str, Any]]:
    results = []
    counters: dict[tuple[str, str], int] = defaultdict(int)
    for job in core.jobs("calibration"):
        scored = core.score_response(job["arm"], job["task"], core.perfect_payload(job["arm"], job["task"]))
        if pattern and job["arm"] in CONTROL_ARMS and job["family"] in pattern:
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
                "validation": scored,
                "usage": {"input_tokens": 100, "output_tokens": 20},
                "response_payload_bytes": 80,
                "latency_ms": 100.0,
            }
        )
    return results


def summarize_calibration(runs: list[dict[str, Any]], protocol_sha256: str | None = None) -> dict[str, Any]:
    if {run["provider"] for run in runs} != set(PROVIDERS):
        raise ValueError("Calibration needs one run from each provider")
    expected_protocol = protocol_sha256 or protocol_manifest()["sha256"]
    if any(run["protocol_sha256"] != expected_protocol or not run["complete"] for run in runs):
        raise ValueError("Calibration runs must be complete and use one protocol")
    eligibility = []
    for family in core.DECISION_FAMILIES:
        provider_rows = []
        for run in runs:
            selected = [row for row in run["results"] if row["family"] == family and row["arm"] in CONTROL_ARMS]
            rate = sum(row["validation"]["primary_pass"] for row in selected) / len(selected)
            provider_rows.append(
                {
                    "provider": run["provider"],
                    "successes": sum(row["validation"]["primary_pass"] for row in selected),
                    "trials": len(selected),
                    "rate": round(rate, 6),
                    "inside_band": ELIGIBILITY_BAND["minimum"] <= rate <= ELIGIBILITY_BAND["maximum"],
                }
            )
        eligible_providers = sum(row["inside_band"] for row in provider_rows)
        eligibility.append(
            {
                "family": family,
                "providers": provider_rows,
                "eligible_providers": eligible_providers,
                "eligible": eligible_providers >= ELIGIBILITY_BAND["minimum_providers"],
            }
        )
    provider_reports = []
    for run in runs:
        provider_reports.append(
            {
                "provider": run["provider"],
                "factorial": factorial_report(run["results"]),
                "common_metrics": common_arm_metrics(run["results"]),
                "native_capabilities": core.capability_manifest()["midi-like-native"],
                "actual_cost_usd": run.get("actual_cost_usd", 0),
            }
        )
    value = {
        "schema": SCHEMA,
        "run_id": RUN_ID,
        "selection_authority": "None. Calibration can only detect measurement defects.",
        "eligibility": eligibility,
        "providers": provider_reports,
        "capability_table": core.capability_manifest(),
        "decision": "proceed-development" if all(row["eligible"] for row in eligibility) else "repair-measurement",
    }
    value["sha256"] = core.digest(value)
    return value


def aggregation_screen() -> dict[str, Any]:
    informative = {family: [True, False, True, False, True, False] for family in core.DECISION_FAMILIES}
    floor = deepcopy(informative)
    floor["transformation-revoice"] = [False]
    protocol_sha = "synthetic"
    runs = [
        {"provider": provider, "protocol_sha256": protocol_sha, "complete": True, "results": synthetic_results(informative), "actual_cost_usd": 0}
        for provider in PROVIDERS
    ]
    floor_runs = [
        {"provider": provider, "protocol_sha256": protocol_sha, "complete": True, "results": synthetic_results(floor), "actual_cost_usd": 0}
        for provider in PROVIDERS
    ]
    first = summarize_calibration(runs, protocol_sha)
    second = summarize_calibration(floor_runs, protocol_sha)
    contrasts = factorial_contrasts(runs[0]["results"])
    return {
        "informative_decision": first["decision"],
        "floor_decision": second["decision"],
        "native_excluded_from_factorial": contrasts["excluded_arm"] == "midi-like-native" and "midi-like-native" not in contrasts["factorial_arms"],
        "paired_denominators_present": all(value["paired_denominator"] > 0 for name, value in contrasts.items() if isinstance(value, dict) and name != "factorial_arms"),
        "pass": first["decision"] == "proceed-development" and second["decision"] == "repair-measurement",
    }


def deterministic_screen() -> dict[str, Any]:
    cohorts = cohort_audit()
    formats = format_screen()
    contracts = contract_screen()
    aggregation = aggregation_screen()
    frozen = {
        name: {
            "expected": expected,
            "actual": tree_sha256(core.BENCHMARKS_ROOT / name),
        }
        for name, expected in FROZEN_PACKAGE_SHA256.items()
    }
    pairwise_clean = all(not row["fixture_hash_overlap"] and not row["semantic_hash_overlap"] for row in cohorts["pairwise"])
    historical_clean = all(not row["historical_semantic_overlap"] for row in cohorts["cohorts"].values())
    document_pass = all(all(row.values()) for row in formats["documents"].values())
    patch_pass = all(all(value for name, value in row.items() if name != "bytes") for row in formats["patches"].values())
    mutation_pass = all(row["pass"] for name in ("revoice_mutations", "progression_mutations", "retained_family_mutations") for row in contracts[name])
    grammar_pass = all(row["template_present"] and row["example_present"] and row["example_parses"] for row in contracts["prompt_grammar_forms"])
    value = {
        "schema": SCHEMA,
        "cohort_audit": cohorts,
        "format_screen": formats,
        "contract_screen": contracts,
        "aggregation_screen": aggregation,
        "frozen_packages": frozen,
        "resolution": {
            "development_decision_fixtures_per_family": core.COHORT_SPECS["development"]["decision"],
            "decision_family_count": len(core.DECISION_FAMILIES),
            "smallest_hard_macro_step": round(1 / (int(core.COHORT_SPECS["development"]["decision"]) * len(core.DECISION_FAMILIES)), 6),
            "maximum_allowed_step": 0.05,
        },
        "all_checks_pass": pairwise_clean
        and historical_clean
        and document_pass
        and formats["equal_json_semantics"]
        and patch_pass
        and formats["pitch_bounds_and_round_trips"]
        and all(formats["invalid_and_conflict_cases"].values())
        and formats["native_round_trip"]
        and contracts["reference_instruction_agreement"]
        and all(row["pass"] for row in contracts["negative"])
        and mutation_pass
        and grammar_pass
        and aggregation["pass"]
        and aggregation["native_excluded_from_factorial"]
        and aggregation["paired_denominators_present"]
        and all(row["expected"] == row["actual"] for row in frozen.values())
        and 1 / (int(core.COHORT_SPECS["development"]["decision"]) * len(core.DECISION_FAMILIES)) <= 0.05,
    }
    value["sha256"] = core.digest(value)
    return value


def protocol_manifest() -> dict[str, Any]:
    run_jobs = core.jobs("calibration")
    package_files = ("benchmark.py", "core.py", "README.md", "CONTRACTS.md", "SCHEMAS.md", "cohort-manifest.json")
    value = {
        "schema": SCHEMA,
        "run_id": RUN_ID,
        "kind": "diagnostic-calibration",
        "selection_authority": "None. Calibration cannot select a representation.",
        "hypothesis": "Tuple shape and pitch-class/register values can change musical accuracy and compactness independently.",
        "arms": list(core.ARMS),
        "factorial_arms": list(core.JSON_ARMS),
        "native_anchor": "midi-like-native",
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
        "randomization": {"method": "Shuffle all isolated calls before dispatch.", "seed": 8323},
        "eligibility_band": ELIGIBILITY_BAND,
        "eligibility_controls": list(CONTROL_ARMS),
        "capabilities": core.capability_manifest(),
        "schema_manifest_sha256": core.schema_manifest()["sha256"],
        "stopping_rule": "If progression, role continuation, or revoicing is outside the 0.20 through 0.90 control pass-rate band on two or more providers, return repair-measurement and stop provider work. Otherwise, freeze a separate development plan.",
        "allowed_follow_up": "Summarize the fixed calibration. Do not start development without a new frozen plan and explicit approval.",
        "repair_policy": "Do not repair provider responses. Do not tune a format from calibration results.",
        "privacy": "Send generated MIT symbolic text only. Do not send live project data, MIDI files, audio, or API keys.",
        "corpus_sha256": core.make_corpus("calibration")["sha256"],
        "fixture_sha256": sorted(job["task"]["sha256"] for job in run_jobs if job["arm"] == core.ARMS[0]),
        "semantic_sha256": sorted(job["task"]["semantic_sha256"] for job in run_jobs if job["arm"] == core.ARMS[0]),
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
        "cohort_manifest_sha256": cohort_manifest()["sha256"],
        "schema_manifest_sha256": core.schema_manifest()["sha256"],
        "scorer_sha256": hashlib.sha256((PACKAGE_ROOT / "core.py").read_bytes()).hexdigest(),
        "protocol_sha256": protocol["sha256"],
        "stopping_rule": protocol["stopping_rule"],
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
    assert len(screen["contract_screen"]["prompt_grammar_forms"]) == 9
    assert run_plan()["expected_calls"]["total"] == 210
    return {
        "schema": SCHEMA,
        "pass": True,
        "checks": len(screen["contract_screen"]["positive"])
        + len(screen["contract_screen"]["negative"])
        + len(screen["contract_screen"]["revoice_mutations"])
        + len(screen["contract_screen"]["progression_mutations"])
        + len(screen["contract_screen"]["retained_family_mutations"])
        + len(screen["contract_screen"]["prompt_grammar_forms"])
        + 20,
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
        outer, raw, latency_ms, retries = core.v3.v2.call_with_retry(provider, key, prompt)
        measured = core.v3.v2.usage(provider, raw)
        payload = outer["payload"]
        return {
            **common,
            "response_payload": payload,
            "response_payload_bytes": len(payload.encode()),
            "response_payload_sha256": core.sha256_text(payload),
            "outer_schema_valid": outer["outer_schema_valid"],
            "validation": core.score_response(job["arm"], job["task"], payload),
            "usage": measured,
            "cost_usd": core.v3.v2.cost_usd(provider, measured),
            "latency_ms": round(latency_ms, 3),
            "retries": retries,
            "returned_model": core.v3.v2.returned_model(provider, raw),
            "request_id": raw.get("id"),
            "stop_reason": core.v3.v2.stop_reason(provider, raw),
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
    random.Random(8323).shuffle(ordered)
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
    environment = core.v3.v2.load_env(env_file)
    key = environment.get(core.v3.v2.KEYS[provider])
    if not key:
        raise ValueError(f"{core.v3.v2.KEYS[provider]} is missing")
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
    actions.add_argument("--schemas", action="store_true")
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
    elif args.schemas:
        value = core.schema_manifest()
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
