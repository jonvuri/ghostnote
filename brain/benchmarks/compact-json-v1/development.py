#!/usr/bin/env python3
"""Define the frozen Phase 8c2.3 compact JSON development run."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import math
import platform
import random
import statistics
import sys
import time
import urllib.error
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
from typing import Any, Callable


PACKAGE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PACKAGE_ROOT))
import calibration_r2 as r2  # type: ignore  # noqa: E402
import calibration_r3 as r3  # type: ignore  # noqa: E402
import core  # type: ignore  # noqa: E402
sys.path.pop(0)


SCHEMA = "ghostnote-compact-json-development-v1"
CORPUS_SCHEMA = "ghostnote-compact-json-development-corpus-v1"
RUN_ID = "phase8c2-3-compact-json-development-r1"
FAMILY = "generation-progression"
COHORTS = ("development-r1", "holdout-r1")
FIXTURES_PER_COHORT = 20
ARMS = core.ARMS
JSON_ARMS = core.JSON_ARMS
PROVIDERS = r3.PROVIDERS
MODELS = r3.MODELS
SETTINGS = {
    "openai": {"reasoning_effort": "low", "max_completion_tokens": 5000},
    "gemini": {"thinking_level": "low", "max_output_tokens": 5000},
    "claude": {"effort": "low", "max_tokens": 5000},
    "temperature": "provider default",
}
DECISION_MARGIN = 0.05
PITCH_IMPROVEMENT = 0.05
MATERIAL_INTERACTION = 0.10
PROMPT_RATIO_LIMIT = 0.85
OUTPUT_RATIO_LIMIT = 0.65
NATIVE_ADVANTAGE = 0.05
PITCH_CRITICAL_CHECKS = (
    "harmony_and_bass_inversion",
    "voice_ranges_and_crossing",
    "total_voice_leading",
    "cadence",
)
MEAN_CALL_COST_USD = {
    "openai": 0.122108 / 15,
    "gemini": 0.076670 / 15,
    "claude": 1.931190 / 70,
}
COST_BASIS = {
    "source": "Phase 8c2.3 r3 OpenAI and Gemini manifests, plus the r1 Claude manifest",
    "method": "Use the latest observed mean call cost and add 25 percent.",
    "price_verification_date": "2026-09-27",
    "price_sources": core.v3.v2.PRICE_SOURCES,
    "mean_call_cost_usd": MEAN_CALL_COST_USD,
    "contingency": 0.25,
}


PROGRESSION_PATTERNS = (
    (((0, 4, 7), (5, 9, 0), (7, 11, 2), (0, 4, 7)), (0, 5, 7, 0)),
    (((0, 3, 7), (5, 8, 0), (2, 5, 9, 0), (0, 3, 7)), (0, 5, 2, 0)),
    (((0, 4, 7), (9, 0, 4), (5, 9, 0), (0, 4, 7)), (0, 9, 5, 0)),
    (((0, 3, 7), (8, 0, 3), (5, 8, 0), (0, 3, 7)), (0, 8, 5, 0)),
)


def progression_task(cohort: str, variant: int) -> dict[str, Any]:
    if cohort not in COHORTS:
        raise ValueError(f"Unknown cohort: {cohort}")
    seed = {"development-r1": 8779, "holdout-r1": 8923}[cohort]
    denominator = ({"development-r1": 5, "holdout-r1": 25}[cohort] + variant)
    tonic = (seed + variant * 5) % 12
    offsets, bass_offsets = PROGRESSION_PATTERNS[variant % len(PROGRESSION_PATTERNS)]
    contract = {
        "meter": "4/4",
        "chord_starts": [
            core.fraction_text(Fraction(index * denominator + 1, denominator))
            for index in range(4)
        ],
        "duration": core.fraction_text(Fraction(denominator - 1, denominator)),
        "pitch_classes": [
            sorted((tonic + item) % 12 for item in chord) for chord in offsets
        ],
        "bass_pitch_classes": [(tonic + item) % 12 for item in bass_offsets],
        "voice_ranges": {
            "bass": [35, 54],
            "tenor": [47, 66],
            "alto": [54, 73],
            "soprano": [61, 83],
        },
        "maximum_total_voice_leading": 53,
        "cadence_pitch_class": tonic,
    }
    return core.finish_task(cohort, FAMILY, variant, {"contract": contract})


def make_corpus(cohort: str) -> dict[str, Any]:
    fixtures = [progression_task(cohort, variant) for variant in range(FIXTURES_PER_COHORT)]
    value = {
        "schema": CORPUS_SCHEMA,
        "cohort": cohort,
        "license": "MIT",
        "fixtures": {FAMILY: fixtures},
    }
    value["sha256"] = core.digest(value)
    return value


def prior_semantics() -> set[str]:
    result = r2.r1.historical_semantics()
    for cohort in core.COHORT_SPECS:
        result.update(
            value["semantic_sha256"]
            for values in core.make_corpus(cohort)["fixtures"].values()
            for value in values
        )
    for corpus in (r2.make_corpus(), r3.make_corpus()):
        result.update(
            value["semantic_sha256"]
            for values in corpus["fixtures"].values()
            for value in values
        )
    for name in (
        "2026-09-27-calibration-openai.json",
        "2026-09-27-calibration-gemini.json",
        "2026-09-27-calibration-claude.json",
        "2026-09-27-calibration-r2-openai.json",
        "2026-09-27-calibration-r2-gemini.json",
        "2026-09-27-calibration-r3-openai.json",
        "2026-09-27-calibration-r3-gemini.json",
    ):
        run = json.loads((PACKAGE_ROOT / "runs" / name).read_text())
        result.update(row["semantic_sha256"] for row in run["results"])
    return result


def corpus_audit() -> dict[str, Any]:
    prior = prior_semantics()
    corpora = {cohort: make_corpus(cohort) for cohort in COHORTS}
    result: dict[str, Any] = {"cohorts": {}}
    hashes: dict[str, set[str]] = {}
    semantics: dict[str, set[str]] = {}
    for cohort, corpus in corpora.items():
        fixtures = corpus["fixtures"][FAMILY]
        hashes[cohort] = {value["sha256"] for value in fixtures}
        semantics[cohort] = {value["semantic_sha256"] for value in fixtures}
        result["cohorts"][cohort] = {
            "corpus_sha256": corpus["sha256"],
            "fixture_sha256": sorted(hashes[cohort]),
            "semantic_sha256": sorted(semantics[cohort]),
            "fixture_count": len(fixtures),
            "prior_semantic_overlap": len(semantics[cohort] & prior),
            "internal_semantic_duplicates": len(fixtures) - len(semantics[cohort]),
        }
    result["pairwise"] = {
        "fixture_hash_overlap": len(hashes[COHORTS[0]] & hashes[COHORTS[1]]),
        "semantic_hash_overlap": len(semantics[COHORTS[0]] & semantics[COHORTS[1]]),
    }
    result["sha256"] = core.digest(result)
    return result


def jobs(cohort: str = "development-r1") -> list[dict[str, Any]]:
    return [
        {"arm": arm, "family": FAMILY, "variant": task["variant"], "repeat": 0, "task": task}
        for arm in ARMS
        for task in make_corpus(cohort)["fixtures"][FAMILY]
    ]


def prompt_for(arm: str, task: dict[str, Any]) -> str:
    return r3.prompt_for(arm, task)


def score_response(arm: str, task: dict[str, Any], payload: str) -> dict[str, Any]:
    return r3.score_response(arm, task, payload)


def request_spec(provider: str, key: str, prompt: str) -> dict[str, Any]:
    messages = [{"role": "user", "content": prompt}]
    if provider == "openai":
        return {
            "url": "https://api.openai.com/v1/chat/completions",
            "headers": {"Authorization": f"Bearer {key}"},
            "payload": {
                "model": MODELS[provider],
                "messages": messages,
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "benchmark_payload",
                        "strict": True,
                        "schema": core.v3.v2.OUTER_SCHEMA,
                    },
                },
                "reasoning_effort": SETTINGS[provider]["reasoning_effort"],
                "max_completion_tokens": SETTINGS[provider]["max_completion_tokens"],
            },
        }
    if provider == "gemini":
        return {
            "url": f"https://generativelanguage.googleapis.com/v1beta/models/{MODELS[provider]}:generateContent",
            "headers": {"x-goog-api-key": key},
            "payload": {
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "responseJsonSchema": core.v3.v2.OUTER_SCHEMA,
                    "maxOutputTokens": SETTINGS[provider]["max_output_tokens"],
                    "thinkingConfig": {
                        "thinkingLevel": SETTINGS[provider]["thinking_level"]
                    },
                },
            },
        }
    return {
        "url": "https://api.anthropic.com/v1/messages",
        "headers": {"x-api-key": key, "anthropic-version": "2023-06-01"},
        "payload": {
            "model": MODELS[provider],
            "max_tokens": SETTINGS[provider]["max_tokens"],
            "messages": messages,
            "output_config": {
                "effort": SETTINGS[provider]["effort"],
                "format": {"type": "json_schema", "schema": core.v3.v2.OUTER_SCHEMA},
            },
        },
    }


def request_settings(provider: str) -> dict[str, Any]:
    payload = request_spec(provider, "redacted", "probe")["payload"]
    if provider == "openai":
        return {
            "reasoning_effort": payload["reasoning_effort"],
            "max_completion_tokens": payload["max_completion_tokens"],
        }
    if provider == "gemini":
        config = payload["generationConfig"]
        return {
            "thinking_level": config["thinkingConfig"]["thinkingLevel"],
            "max_output_tokens": config["maxOutputTokens"],
        }
    return {
        "effort": payload["output_config"]["effort"],
        "max_tokens": payload["max_tokens"],
    }


def transport_audit() -> dict[str, Any]:
    actual = {provider: request_settings(provider) for provider in PROVIDERS}
    declared = {provider: SETTINGS[provider] for provider in PROVIDERS}
    value = {"declared": declared, "request_builder": actual, "exact_match": actual == declared}
    value["sha256"] = core.digest(value)
    return value


def model_call(provider: str, key: str, prompt: str) -> tuple[dict[str, Any], dict[str, Any]]:
    spec = request_spec(provider, key, prompt)
    raw = core.v3.v2.post_json(spec["url"], spec["headers"], spec["payload"])
    if provider == "openai":
        text = raw["choices"][0]["message"]["content"]
    elif provider == "gemini":
        text = "".join(
            part.get("text", "") for part in raw["candidates"][0]["content"]["parts"]
        )
    else:
        text = "".join(
            block.get("text", "") for block in raw["content"] if block.get("type") == "text"
        )
    return core.v3.v2.parse_outer(text), raw


def call_with_retry(
    provider: str, key: str, prompt: str
) -> tuple[dict[str, Any], dict[str, Any], float, int]:
    retries = 0
    started = time.perf_counter()
    for delay in (0, 2, 4, 8):
        if delay:
            time.sleep(delay)
        try:
            outer, raw = model_call(provider, key, prompt)
            return outer, raw, (time.perf_counter() - started) * 1000, retries
        except urllib.error.HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504} or retries == 3:
                raise
            retries += 1
        except (TimeoutError, urllib.error.URLError):
            if retries == 3:
                raise
            retries += 1
    raise AssertionError("Retry loop did not return or raise")


def paired_stats(
    indexed: dict[tuple[str, int], dict[str, Any]],
    candidate: str,
    baseline: str,
    metric: Callable[[dict[str, Any]], bool],
) -> dict[str, Any]:
    candidate_values = [metric(indexed[(candidate, variant)]) for variant in range(FIXTURES_PER_COHORT)]
    baseline_values = [metric(indexed[(baseline, variant)]) for variant in range(FIXTURES_PER_COHORT)]
    diffs = [int(left) - int(right) for left, right in zip(candidate_values, baseline_values)]
    effect = sum(diffs) / len(diffs)
    variance = statistics.variance(diffs) if len(diffs) > 1 else 0
    half_width = 1.96 * math.sqrt(variance / len(diffs))
    return {
        "pairs": len(diffs),
        "candidate_successes": sum(candidate_values),
        "baseline_successes": sum(baseline_values),
        "candidate_only": sum(left and not right for left, right in zip(candidate_values, baseline_values)),
        "baseline_only": sum(right and not left for left, right in zip(candidate_values, baseline_values)),
        "ties": sum(left == right for left, right in zip(candidate_values, baseline_values)),
        "effect": round(effect, 6),
        "approximate_95_interval": [
            round(max(-1, effect - half_width), 6),
            round(min(1, effect + half_width), 6),
        ],
    }


def primary_metric(row: dict[str, Any]) -> bool:
    return bool(row["validation"]["primary_pass"])


def pitch_metric(row: dict[str, Any]) -> bool:
    checks = row["validation"].get("checks", {})
    return bool(row["validation"]["syntax_pass"] and all(checks.get(name, False) for name in PITCH_CRITICAL_CHECKS))


def provider_signal(run: dict[str, Any]) -> dict[str, Any]:
    indexed = {(row["arm"], row["variant"]): row for row in run["results"]}
    shape_midi = paired_stats(indexed, "tuple-json-midi", "exact-object-json-midi", primary_metric)
    shape_pc = paired_stats(indexed, "tuple-json-pc-register", "exact-object-json-pc-register", primary_metric)
    pitch_object_primary = paired_stats(indexed, "exact-object-json-pc-register", "exact-object-json-midi", primary_metric)
    pitch_object_critical = paired_stats(indexed, "exact-object-json-pc-register", "exact-object-json-midi", pitch_metric)
    pitch_tuple_primary = paired_stats(indexed, "tuple-json-pc-register", "tuple-json-midi", primary_metric)
    pitch_tuple_critical = paired_stats(indexed, "tuple-json-pc-register", "tuple-json-midi", pitch_metric)
    native = {
        arm: paired_stats(indexed, "midi-like-native", arm, primary_metric)
        for arm in JSON_ARMS
    }
    support = {
        "shape_midi": shape_midi["effect"] >= -DECISION_MARGIN,
        "shape_pc_register": shape_pc["effect"] >= -DECISION_MARGIN,
        "pitch_object": pitch_object_critical["effect"] >= PITCH_IMPROVEMENT
        and pitch_object_primary["effect"] >= -DECISION_MARGIN,
        "pitch_tuple": pitch_tuple_critical["effect"] >= PITCH_IMPROVEMENT
        and pitch_tuple_primary["effect"] >= -DECISION_MARGIN,
        **{
            f"native_vs_{arm}": value["effect"] >= NATIVE_ADVANTAGE
            for arm, value in native.items()
        },
    }
    efficiency = {}
    for arm in ARMS:
        rows = [row for row in run["results"] if row["arm"] == arm]
        efficiency[arm] = {
            "input_tokens": sum(row["usage"]["input_tokens"] for row in rows),
            "output_bytes": sum(row.get("response_payload_bytes", 0) for row in rows),
            "median_latency_ms": round(statistics.median(row["latency_ms"] for row in rows), 3),
        }
    return {
        "provider": run["provider"],
        "support": support,
        "contrasts": {
            "tuple_shape_at_midi": shape_midi,
            "tuple_shape_at_pc_register": shape_pc,
            "pitch_in_objects_primary": pitch_object_primary,
            "pitch_in_objects_critical": pitch_object_critical,
            "pitch_in_tuples_primary": pitch_tuple_primary,
            "pitch_in_tuples_critical": pitch_tuple_critical,
            "interaction": round(shape_pc["effect"] - shape_midi["effect"], 6),
            "native": native,
        },
        "efficiency": efficiency,
        "actual_cost_usd": run["actual_cost_usd"],
    }


def compactness_screen() -> dict[str, Any]:
    result = {}
    tasks = make_corpus("development-r1")["fixtures"][FAMILY]
    for pitch, object_arm, tuple_arm in (
        ("midi", "exact-object-json-midi", "tuple-json-midi"),
        ("pc-register", "exact-object-json-pc-register", "tuple-json-pc-register"),
    ):
        object_prompt = sum(len(prompt_for(object_arm, task).encode()) for task in tasks)
        tuple_prompt = sum(len(prompt_for(tuple_arm, task).encode()) for task in tasks)
        object_output = sum(len(r2.perfect_payload(object_arm, task).encode()) for task in tasks)
        tuple_output = sum(len(r2.perfect_payload(tuple_arm, task).encode()) for task in tasks)
        prompt_ratio = tuple_prompt / object_prompt
        output_ratio = tuple_output / object_output
        result[pitch] = {
            "prompt_byte_ratio": round(prompt_ratio, 6),
            "canonical_output_byte_ratio": round(output_ratio, 6),
            "gate": prompt_ratio <= PROMPT_RATIO_LIMIT and output_ratio <= OUTPUT_RATIO_LIMIT,
        }
    result["gate"] = all(value["gate"] for key, value in result.items() if key != "gate")
    return result


def capability_screen() -> dict[str, Any]:
    manifest = core.capability_manifest()
    fields = (
        "full_document_fidelity",
        "stable_identity",
        "exact_preservation",
        "sparse_patch",
        "one_canonical_pitch_encoding",
    )
    json_pass = all(manifest[arm][field] is True for arm in JSON_ARMS for field in fields)
    return {
        "json": {arm: manifest[arm] for arm in JSON_ARMS},
        "native": manifest["midi-like-native"],
        "json_gate": json_pass,
    }


def cheap_disagreement(signals: list[dict[str, Any]]) -> bool:
    if len(signals) != 2:
        return False
    keys = signals[0]["support"]
    return any(signals[0]["support"][key] != signals[1]["support"][key] for key in keys)


def aggregate_signals(signals: list[dict[str, Any]]) -> dict[str, Any]:
    support = {
        key: sum(signal["support"][key] for signal in signals)
        for key in signals[0]["support"]
    }
    compactness = compactness_screen()
    capabilities = capability_screen()
    shape_midi = support["shape_midi"] >= 2 and compactness["midi"]["gate"]
    shape_pc = support["shape_pc_register"] >= 2 and compactness["pc-register"]["gate"]
    material_interactions = sum(
        abs(signal["contrasts"]["interaction"]) >= MATERIAL_INTERACTION
        for signal in signals
    )
    ambiguous = material_interactions >= 2 and shape_midi != shape_pc
    tuple_gate = shape_midi and shape_pc and compactness["gate"] and capabilities["json_gate"]

    candidates: list[str]
    if ambiguous:
        candidates = ["exact-object-json-midi"]
        if support["pitch_object"] >= 2:
            candidates.append("exact-object-json-pc-register")
        if shape_midi:
            candidates.append("tuple-json-midi")
        if shape_pc:
            candidates.append("tuple-json-pc-register")
    else:
        shape = "tuple" if tuple_gate else "exact-object"
        pitch_key = "pitch_tuple" if shape == "tuple" else "pitch_object"
        pitch = "pc-register" if support[pitch_key] >= 2 else "midi"
        candidates = [f"{shape}-json-{pitch}"]

    tuple_candidates = [arm for arm in candidates if arm.startswith("tuple-")]
    decision = "freeze-holdout" if tuple_candidates else "stop-compact-json"
    native_support = min(
        support[f"native_vs_{arm}"] for arm in candidates
    )
    native_candidate = native_support >= 2
    return {
        "decision": decision,
        "json_candidates": candidates,
        "full_capability_fallback": next(
            (arm for arm in candidates if arm.startswith("exact-object-")),
            "exact-object-json-midi",
        ),
        "native_limited_candidate": native_candidate,
        "supporting_providers": support,
        "shape": {
            "midi_gate": shape_midi,
            "pc_register_gate": shape_pc,
            "tuple_gate": tuple_gate,
            "material_interaction_providers": material_interactions,
            "ambiguous": ambiguous,
        },
        "compactness": compactness,
        "capabilities": capabilities,
    }


def summarize_runs(runs: list[dict[str, Any]], protocol_sha256: str | None = None) -> dict[str, Any]:
    providers = {run["provider"] for run in runs}
    if providers not in ({"openai", "gemini"}, set(PROVIDERS)):
        raise ValueError("Development needs both cheap providers, with optional Claude")
    expected = protocol_sha256 or protocol_manifest()["sha256"]
    if any(run["protocol_sha256"] != expected or not run["complete"] for run in runs):
        raise ValueError("Development runs must be complete and use one protocol")
    signals = [provider_signal(run) for run in runs]
    if cheap_disagreement(signals):
        aggregate = {
            "decision": "require-claude",
            "json_candidates": [],
            "native_limited_candidate": False,
        }
    else:
        aggregate = aggregate_signals(signals)
    value = {
        "schema": SCHEMA,
        "run_id": RUN_ID,
        "selection_authority": "Development can only freeze candidates for holdout or stop compact JSON.",
        **aggregate,
        "providers": signals,
        "actual_cost_usd": {
            **{run["provider"]: run.get("actual_cost_usd", 0) for run in runs},
            "total": round(sum(run.get("actual_cost_usd", 0) for run in runs), 6),
        },
        "protocol_sha256": expected,
    }
    value["sha256"] = core.digest(value)
    return value


def package_file_sha256() -> dict[str, str]:
    names = (
        "core.py",
        "calibration_r2.py",
        "calibration_r3.py",
        "development.py",
        "SCHEMAS.md",
        "CALIBRATION_R3_RESULT.md",
        "DEVELOPMENT.md",
        "development-cohort-manifest.json",
    )
    return {
        name: hashlib.sha256((PACKAGE_ROOT / name).read_bytes()).hexdigest()
        for name in names
    }


def protocol_manifest() -> dict[str, Any]:
    run_jobs = jobs()
    audit = corpus_audit()
    value = {
        "schema": SCHEMA,
        "kind": "paired-factorial-development",
        "run_id": RUN_ID,
        "arms": list(ARMS),
        "json_factorial_arms": list(JSON_ARMS),
        "native_anchor": "midi-like-native",
        "decision_family": FAMILY,
        "providers": list(PROVIDERS),
        "provider_order": ["openai", "gemini", "claude-if-required"],
        "models": MODELS,
        "settings": SETTINGS,
        "transport_audit": transport_audit(),
        "sample": {
            "development_fixtures": FIXTURES_PER_COHORT,
            "reserved_holdout_fixtures": FIXTURES_PER_COHORT,
            "repeats": 1,
            "calls_per_provider": len(run_jobs),
            "cheap_provider_calls": len(run_jobs) * 2,
            "maximum_calls": len(run_jobs) * 3,
            "smallest_primary_macro_step": round(1 / FIXTURES_PER_COHORT, 6),
        },
        "gate": {
            "tuple_non_inferiority_margin": DECISION_MARGIN,
            "pitch_critical_improvement": PITCH_IMPROVEMENT,
            "maximum_other_regression": DECISION_MARGIN,
            "material_interaction": MATERIAL_INTERACTION,
            "prompt_byte_ratio_limit": PROMPT_RATIO_LIMIT,
            "canonical_output_byte_ratio_limit": OUTPUT_RATIO_LIMIT,
            "native_advantage": NATIVE_ADVANTAGE,
            "minimum_supporting_providers": 2,
            "provider_disagreement": "Run Claude when OpenAI and Gemini differ on any frozen decision signal.",
            "unattainable_resolution": "Twenty fixtures make every primary step exactly 0.05.",
        },
        "terminal_decisions": {
            "tuple_pass": "freeze-holdout",
            "tuple_fail": "stop-compact-json",
            "cheap_disagreement": "require-claude",
        },
        "development_corpus_sha256": make_corpus("development-r1")["sha256"],
        "reserved_holdout_corpus_sha256": make_corpus("holdout-r1")["sha256"],
        "cohort_audit_sha256": audit["sha256"],
        "scorer_sha256": r3.protocol_manifest()["scorer_sha256"],
        "package_file_sha256": package_file_sha256(),
        "prompt_sha256": {
            f'{job["arm"]}:{job["family"]}:{job["variant"]}:0': core.sha256_text(
                prompt_for(job["arm"], job["task"])
            )
            for job in run_jobs
        },
        "randomization": {"method": "Shuffle all isolated calls before dispatch.", "seed": 8779},
        "privacy": r3.protocol_manifest()["privacy"],
        "repair_policy": "Do not repair provider responses or change a candidate after development calls.",
        "allowed_follow_up": "Summarize this fixed development run. Do not start holdout without a new frozen plan and explicit approval.",
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    calls = protocol["sample"]["calls_per_provider"]
    estimates = {
        provider: {
            "calls": calls,
            "estimated_cost_usd": round(calls * MEAN_CALL_COST_USD[provider] * 1.25, 6),
        }
        for provider in PROVIDERS
    }
    cheap = round(estimates["openai"]["estimated_cost_usd"] + estimates["gemini"]["estimated_cost_usd"], 6)
    value = {
        "schema": SCHEMA,
        "run_kind": "paired-factorial-development-plan",
        "run_id": RUN_ID,
        "approval": {
            "status": "pending",
            "requirement": "Get explicit operator approval for this exact conditional development run before any provider call.",
        },
        "scope": {
            "arms": list(ARMS),
            "family": FAMILY,
            "fixtures": FIXTURES_PER_COHORT,
            "repeats": 1,
            "providers": list(PROVIDERS),
            "provider_order": protocol["provider_order"],
        },
        "models": MODELS,
        "settings": SETTINGS,
        "expected_calls": {
            "openai": calls,
            "gemini": calls,
            "cheap_stage": calls * 2,
            "claude_if_required": calls,
            "maximum": calls * 3,
        },
        "cost_estimate": {
            "basis": COST_BASIS,
            "providers": estimates,
            "cheap_stage_usd": cheap,
            "maximum_usd": round(cheap + estimates["claude"]["estimated_cost_usd"], 6),
        },
        "cohort_manifest_sha256": corpus_audit()["sha256"],
        "development_corpus_sha256": protocol["development_corpus_sha256"],
        "reserved_holdout_corpus_sha256": protocol["reserved_holdout_corpus_sha256"],
        "scorer_sha256": protocol["scorer_sha256"],
        "protocol_sha256": protocol["sha256"],
        "transport_audit_sha256": protocol["transport_audit"]["sha256"],
        "stopping_rule": "Run OpenAI and Gemini first. Run Claude only when their frozen decision signals disagree.",
        "allowed_follow_up": protocol["allowed_follow_up"],
    }
    value["sha256"] = core.digest(value)
    return value


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    if (
        value.get("run_id") != RUN_ID
        or value.get("protocol_sha256") != plan["protocol_sha256"]
        or value.get("run_plan_sha256") != plan["sha256"]
    ):
        raise ValueError("The approval does not match the frozen development plan")
    if value.get("status") != "approved" or not value.get("operator_statement"):
        raise ValueError("Development approval needs an explicit operator statement")
    return value


def validate_claude_prior(paths: list[Path] | None) -> None:
    if not paths or len(paths) != 2:
        raise ValueError("Claude needs the complete OpenAI and Gemini development runs")
    runs = [json.loads(path.read_text()) for path in paths]
    if summarize_runs(runs)["decision"] != "require-claude":
        raise ValueError("The cheap-provider result does not allow Claude")


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
        "request_settings": request_settings(provider),
    }
    try:
        outer, raw, latency_ms, retries = call_with_retry(provider, key, prompt)
        usage = core.v3.v2.usage(provider, raw)
        payload = outer["payload"]
        return {
            **common,
            "response_payload": payload,
            "response_payload_bytes": len(payload.encode()),
            "response_payload_sha256": core.sha256_text(payload),
            "outer_schema_valid": outer["outer_schema_valid"],
            "validation": score_response(job["arm"], job["task"], payload),
            "usage": usage,
            "cost_usd": core.v3.v2.cost_usd(provider, usage),
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
            "latency_ms": 0,
            "retries": 3,
        }


def execute_jobs(provider: str, key: str, workers: int) -> list[dict[str, Any]]:
    ordered = jobs()
    random.Random(8779).shuffle(ordered)
    result = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(call_job, provider, key, job) for job in ordered]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            result.append(future.result())
            if index % 10 == 0:
                print(f"{provider}: completed {index}/{len(futures)} development calls", file=sys.stderr, flush=True)
    return sorted(result, key=lambda value: (value["arm"], value["variant"], value["repeat"]))


def run_provider(
    provider: str,
    env_file: Path,
    approval_file: Path,
    workers: int,
    prior_runs: list[Path] | None,
) -> dict[str, Any]:
    approval = validate_approval(approval_file)
    if provider == "claude":
        validate_claude_prior(prior_runs)
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise ValueError("The development deterministic screen failed")
    environment = core.v3.v2.load_env(env_file)
    key = environment.get(core.v3.v2.KEYS[provider])
    if not key:
        raise ValueError(f"{core.v3.v2.KEYS[provider]} is missing")
    results = execute_jobs(provider, key, workers)
    value = {
        "schema": SCHEMA,
        "run_kind": "paired-factorial-development-provider",
        "run_id": RUN_ID,
        "provider": provider,
        "requested_model": MODELS[provider],
        "settings": SETTINGS[provider],
        "transport_audit_sha256": transport_audit()["sha256"],
        "approval": approval,
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "python": platform.python_version(),
        "privacy": protocol_manifest()["privacy"],
        "protocol_sha256": protocol_manifest()["sha256"],
        "screen_sha256": screen["sha256"],
        "results": results,
        "repairs": [],
        "actual_cost_usd": round(sum(row["cost_usd"]["total"] for row in results), 6),
        "complete": len(results) == 100 and all("transport_error" not in row for row in results),
    }
    value["raw_run_sha256"] = core.digest([row.get("raw_response_sha256") for row in results])
    value["manifest_sha256"] = core.digest(value)
    return value


def synthetic_signal(provider: str, passing: bool) -> dict[str, Any]:
    support = {
        "shape_midi": passing,
        "shape_pc_register": passing,
        "pitch_object": passing,
        "pitch_tuple": passing,
        **{f"native_vs_{arm}": passing for arm in JSON_ARMS},
    }
    return {
        "provider": provider,
        "support": support,
        "contrasts": {"interaction": 0},
    }


def deterministic_screen() -> dict[str, Any]:
    audit = corpus_audit()
    positives = []
    negatives = []
    prompts = []
    for cohort in COHORTS:
        for job in jobs(cohort):
            payload = r2.perfect_payload(job["arm"], job["task"])
            positives.append(score_response(job["arm"], job["task"], payload)["primary_pass"])
            notes = core.v3.perfect_progression(job["task"]["contract"])
            changed = deepcopy(notes)
            changed[0]["pitch"] += 1
            bad = core.render_events(job["arm"], changed, job["task"], job["task"]["id"])
            negatives.append(not score_response(job["arm"], job["task"], bad)["primary_pass"])
            prompt = prompt_for(job["arm"], job["task"])
            prompts.append(
                "Use every listed pitch class at least once" in prompt
                and (job["arm"] == "midi-like-native" or job["task"]["sha256"] in prompt)
            )
    passing = aggregate_signals([synthetic_signal(provider, True) for provider in PROVIDERS])
    failing = aggregate_signals([synthetic_signal(provider, False) for provider in PROVIDERS])
    disagreement = cheap_disagreement(
        [synthetic_signal("openai", True), synthetic_signal("gemini", False)]
    )
    value = {
        "schema": SCHEMA,
        "cohort_audit": audit,
        "transport_audit": transport_audit(),
        "contract_screen": {"positive": all(positives), "negative": all(negatives), "prompts": all(prompts)},
        "compactness_screen": compactness_screen(),
        "capability_screen": capability_screen(),
        "aggregation_screen": {
            "passing": passing["decision"],
            "failing": failing["decision"],
            "cheap_disagreement": disagreement,
        },
        "resolution": {
            "fixtures": FIXTURES_PER_COHORT,
            "smallest_primary_macro_step": round(1 / FIXTURES_PER_COHORT, 6),
            "maximum_allowed_step": 0.05,
        },
    }
    value["all_checks_pass"] = (
        all(row["prior_semantic_overlap"] == 0 and row["internal_semantic_duplicates"] == 0 for row in audit["cohorts"].values())
        and audit["pairwise"] == {"fixture_hash_overlap": 0, "semantic_hash_overlap": 0}
        and value["transport_audit"]["exact_match"]
        and all(value["contract_screen"].values())
        and value["compactness_screen"]["gate"]
        and value["capability_screen"]["json_gate"]
        and passing["decision"] == "freeze-holdout"
        and failing["decision"] == "stop-compact-json"
        and disagreement
        and value["resolution"]["smallest_primary_macro_step"] <= value["resolution"]["maximum_allowed_step"]
    )
    value["sha256"] = core.digest(value)
    return value


def deterministic_package() -> dict[str, Any]:
    value = {
        "schema": SCHEMA,
        "screen": deterministic_screen(),
        "protocol": protocol_manifest(),
        "run_plan": run_plan(),
    }
    value["sha256"] = core.digest(value)
    return value


def deterministic_manifest(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": value["schema"],
        "screen_sha256": value["screen"]["sha256"],
        "protocol_sha256": value["protocol"]["sha256"],
        "run_plan_sha256": value["run_plan"]["sha256"],
        "development_corpus_sha256": value["protocol"]["development_corpus_sha256"],
        "reserved_holdout_corpus_sha256": value["protocol"]["reserved_holdout_corpus_sha256"],
        "cohort_manifest_sha256": value["run_plan"]["cohort_manifest_sha256"],
        "transport_audit_sha256": value["protocol"]["transport_audit"]["sha256"],
        "sha256": value["sha256"],
    }


def self_test() -> dict[str, Any]:
    value = deterministic_package()
    assert value["screen"]["all_checks_pass"]
    assert value["protocol"]["sample"]["calls_per_provider"] == 100
    assert value["run_plan"]["expected_calls"]["cheap_stage"] == 200
    assert value["run_plan"]["expected_calls"]["maximum"] == 300
    pending = PACKAGE_ROOT / "runs" / "development-r1-approval.json"
    try:
        validate_approval(pending)
    except ValueError as error:
        assert "explicit operator statement" in str(error)
    else:
        raise AssertionError("The pending development approval was accepted")
    return {
        "schema": SCHEMA,
        "pass": True,
        "checks": FIXTURES_PER_COHORT * len(ARMS) * len(COHORTS) * 3 + 10,
        "development_corpus_sha256": value["protocol"]["development_corpus_sha256"],
        "deterministic_sha256": value["sha256"],
    }


def write(value: dict[str, Any], output: Path | None) -> None:
    rendered = json.dumps(value, indent=2, sort_keys=True) + "\n"
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
    actions.add_argument("--cohort", action="store_true")
    actions.add_argument("--check", type=Path)
    actions.add_argument("--run-plan", action="store_true")
    actions.add_argument("--provider", choices=PROVIDERS)
    actions.add_argument("--summarize", nargs="+", type=Path)
    parser.add_argument("--env-file", type=Path, default=Path("../.env"))
    parser.add_argument("--approval-file", type=Path)
    parser.add_argument("--prior-runs", nargs=2, type=Path)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.self_test:
        value = self_test()
    elif args.deterministic:
        value = deterministic_package()
    elif args.cohort:
        value = {"schema": CORPUS_SCHEMA, **corpus_audit()}
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
        value = run_provider(args.provider, args.env_file, args.approval_file, args.workers, args.prior_runs)
    else:
        value = summarize_runs([json.loads(path.read_text()) for path in args.summarize])
    write(value, args.output)


if __name__ == "__main__":
    main()
