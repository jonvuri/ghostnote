#!/usr/bin/env python3
"""Run the approval-gated Phase 8c3 full symbolic-format matrix."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import platform
import re
import sys
from collections import defaultdict
from copy import deepcopy
from pathlib import Path
from typing import Any

from corpus import TASK_FAMILIES, canonical, corpus_manifest, digest, make_corpus, v1 as symbolic_v1_corpus
from formats import (
    ARMS,
    COMPOSITE_ARMS,
    FIELDS,
    FROZEN_JSON_ARMS,
    IDENTITY_ARMS,
    MUSICAL_FIELDS,
    PAIR_FAMILIES,
    compact_json,
    eligibility_manifest,
    is_eligible,
    output_example as frozen_output_example,
    output_grammar,
    parse_events,
    projected,
    render_events,
)
from scoring import perfect_notes, perfect_payload, required_document, score_response, source_notes


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent
V1_ROOT = BENCHMARKS_ROOT / "symbolic-format-v1"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


v1 = load_module("ghostnote_symbolic_format_v1_benchmark_for_v2", V1_ROOT / "benchmark.py")
V1_USAGE = v1.usage

SCHEMA = "ghostnote-symbolic-format-benchmark-v2"
RUN_ID = "phase8c3-full-symbolic-format-matrix-r1"
SEED = 8303
PROVIDERS = ("openai", "gemini", "claude")
MODELS = {
    "openai": "gpt-5.4-mini-2026-03-17",
    "gemini": "gemini-3.8-flash",
    "claude": "claude-sonnet-5",
}
KEYS = v1.KEYS
PRICES = {
    "openai": {"input": 0.75, "cached_input": 0.075, "output": 4.50},
    "gemini": {"input": 0.75, "cached_input": 0.075, "output": 3.75},
    "claude": {"input": 3.00, "cached_input": 0.30, "output": 15.00},
}
PRICE_SOURCES = {
    "openai": "https://developers.openai.com/api/docs/models/gpt-5.4-mini",
    "gemini": "https://ai.google.dev/gemini-api/docs/pricing",
    "claude": "https://platform.claude.com/docs/en/about-claude/pricing",
}
SETTINGS = {
    "openai": {"reasoning_effort": "low", "max_completion_tokens": 7000},
    "gemini": {"thinking_level": "low", "max_output_tokens": 7000},
    "claude": {"effort": "low", "max_tokens": 7000},
    "temperature": "provider default",
}
OUTER_SCHEMA = v1.OUTER_SCHEMA
SENTINEL_ARMS = (
    "compact-bar",
    "abc-2.1-native",
    "abc-2.1-composite",
    *FROZEN_JSON_ARMS,
)
PRIMARY_ARM = "tuple-json-midi"
FALLBACK_ARM = "exact-object-json-midi"
RATE_MARGIN = 0.125
SYNTAX_MARGIN = 0.05
REPEATED_LOSS_LIMIT = 2
EXPECTED_CALLS = {"openai": 657, "gemini": 605, "claude": 641}
EXPECTED_COST_USD = {"openai": 3.815104, "gemini": 2.452507, "claude": 15.960244}
MAXIMUM_COST_USD = {"openai": 5.524091, "gemini": 3.872716, "claude": 23.608929}
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "full-matrix-r1-approval.json"


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def semantic_body(value: dict[str, Any]) -> dict[str, Any]:
    ignored = {
        "schema",
        "id",
        "cohort",
        "variant",
        "origin",
        "license",
        "sha256",
        "semantic_sha256",
    }
    return {name: field for name, field in value.items() if name not in ignored}


def collect_semantic_hashes(value: Any, result: set[str]) -> None:
    if isinstance(value, dict):
        semantic = value.get("semantic_sha256")
        if isinstance(semantic, str) and re.fullmatch(r"[0-9a-f]{64}", semantic):
            result.add(semantic)
        for item in value.values():
            collect_semantic_hashes(item, result)
    elif isinstance(value, list):
        for item in value:
            collect_semantic_hashes(item, result)


def historical_semantics() -> set[str]:
    result: set[str] = set()
    old_corpus = symbolic_v1_corpus.make_corpus()
    for group in ("development", "retained"):
        for values in old_corpus[group].values():
            for value in values:
                result.add(digest({"family": value["family"], **semantic_body(value)}))
    for package in BENCHMARKS_ROOT.iterdir():
        if not package.is_dir() or package == PACKAGE_ROOT:
            continue
        for path in package.rglob("*.json"):
            try:
                collect_semantic_hashes(json.loads(path.read_text()), result)
            except json.JSONDecodeError:
                continue
    return result


def cohort_audit() -> dict[str, Any]:
    corpus = make_corpus()
    tasks = [value for values in corpus["retained"].values() for value in values]
    semantics = {value["semantic_sha256"] for value in tasks}
    hashes = {value["sha256"] for value in tasks}
    historical = historical_semantics()
    value = {
        "corpus_sha256": corpus["sha256"],
        "fixture_count": len(tasks),
        "fixture_sha256": sorted(hashes),
        "semantic_sha256": sorted(semantics),
        "historical_semantic_count": len(historical),
        "historical_semantic_overlap": len(semantics & historical),
        "internal_fixture_duplicates": len(tasks) - len(hashes),
        "internal_semantic_duplicates": len(tasks) - len(semantics),
    }
    value["sha256"] = digest(value)
    return value


def represented_source(arm: str, task: dict[str, Any]) -> str | None:
    notes = source_notes(task)
    if not notes:
        return None
    source = task.get("source", {})
    if "source" in source and isinstance(source["source"], dict):
        source = source["source"]
    metadata = deepcopy(source) if isinstance(source, dict) else {}
    if arm in FROZEN_JSON_ARMS:
        metadata["id"] = task["id"] + "-source"
    return render_events(arm, notes, metadata)


def task_instruction(task: dict[str, Any]) -> str:
    return v1.task_instruction(task)


def output_example(arm: str, family: str) -> str:
    if arm in FROZEN_JSON_ARMS:
        return frozen_output_example(arm, family)
    return v1.output_example(arm, family)


def frozen_order_rule() -> str:
    return (
        "Use canonical rational strings in lowest terms. Order bars by start then ID. "
        "Order tracks by ID. Order regions by track_id then ID. Order notes by start, "
        "then voice rank bass, tenor, alto, soprano, then other voice names, then pitch and ID."
    )


def frozen_multi_voice_example(arm: str) -> str:
    notes = [
        compact_json.note("ex-bass", "bass", "0", "1", 48, 80),
        compact_json.note("ex-lead", "lead", "0", "1", 67, 84),
    ]
    metadata = {
        "sha256": "example",
        "source": {"tempo": 120, "meters": ["4/4"], "harmonies": ["C"]},
    }
    return compact_json.render_document(arm, notes, metadata, "example-score")


def frozen_metadata_template(arm: str, task: dict[str, Any]) -> str:
    external = compact_json.encode_document(arm, required_document(arm, task))
    external["notes"] = []
    return compact_json.canonical(external)


def prompt_for(arm: str, task: dict[str, Any]) -> str:
    sections = [
        "Complete one deterministic symbolic-music task.",
        "Return one JSON object with exactly one string field named payload. Put the requested representation in that string. Do not add prose.",
        f"Representation arm: {arm}.",
        output_grammar(arm, task["family"]),
    ]
    if arm in FROZEN_JSON_ARMS and task["family"] not in {
        "comprehension-analysis",
        "transformation-local",
    }:
        sections.extend(
            (
                frozen_order_rule(),
                "This complete multi-voice example shows every collection and its order:\n"
                + frozen_multi_voice_example(arm),
                "Copy schema, score, bars, tracks, and regions from this task template exactly. Replace the empty notes collection with the answer. Do not add, remove, or change metadata:\n"
                + frozen_metadata_template(arm, task),
            )
        )
    sections.extend(
        (
            "Follow this output example exactly, but use the task values:\n"
            + output_example(arm, task["family"]),
            task_instruction(task),
        )
    )
    source = represented_source(arm, task)
    if source is not None:
        sections.extend(("SOURCE", source, "END SOURCE"))
    return "\n\n".join(sections)


def candidate_capability_screen() -> dict[str, Any]:
    task = make_corpus()["retained"]["comprehension-structure"][0]
    notes = task["expected"]
    result: dict[str, Any] = {}
    for arm in FROZEN_JSON_ARMS:
        rendered = render_events(arm, notes, task["source"])
        document = compact_json.parse_document(arm, rendered)
        parsed = compact_json.document_notes(document)
        operation = {
            "op": "set-note",
            "id": notes[0]["id"],
            "changes": {"velocity": notes[0]["velocity"] + 1},
        }
        patch_text = compact_json.render_patch(
            arm, task["source"]["sha256"], [operation]
        )
        patch = compact_json.parse_patch(arm, patch_text)
        compiled = compact_json.compile_patch(
            patch, notes, task["source"]["sha256"]
        )
        stale_rejected = False
        unknown_rejected = False
        try:
            compact_json.compile_patch(patch, notes, "stale")
        except ValueError:
            stale_rejected = True
        unknown = deepcopy(patch)
        unknown["ops"][0]["id"] = "missing"
        try:
            compact_json.compile_patch(unknown, notes, task["source"]["sha256"])
        except ValueError:
            unknown_rejected = True
        unchanged = all(
            before == after
            for before, after in zip(notes[1:], compiled[1:], strict=True)
        )
        result[arm] = {
            "round_trip": projected(parsed, FIELDS) == projected(notes, FIELDS),
            "metadata": all(document[name] for name in ("score", "bars", "tracks", "regions")),
            "stable_identity": {value["id"] for value in compiled}
            == {value["id"] for value in notes},
            "exact_omitted_field_preservation": unchanged,
            "sparse_patch": len(patch["ops"]) == 1,
            "stale_base_rejected": stale_rejected,
            "unknown_id_rejected": unknown_rejected,
            "one_pitch_encoding": all(
                isinstance(
                    value["pitch"] if isinstance(value, dict) else value[-2], int
                )
                for value in json.loads(rendered)["notes"]
            ),
        }
        result[arm]["pass"] = all(result[arm].values())
    return result


def mutation_payload(arm: str, task: dict[str, Any]) -> str:
    family = task["family"]
    if family == "comprehension-analysis":
        payload = perfect_payload(arm, task)
        root = task["expected"]["root_pc"]
        return payload.replace(f"root_pc={root}", f"root_pc={(root + 1) % 12}", 1)
    if family == "transformation-local":
        return "INVALID"
    notes = deepcopy(perfect_notes(task))
    notes[0]["pitch"] = (
        127
        if family
        in {
            "generation-progression",
            "generation-melody",
            "continuation-roles",
            "transformation-revoice",
        }
        else notes[0]["pitch"] + 1
    )
    if arm in FROZEN_JSON_ARMS:
        return compact_json.render_document(arm, notes, task, task["id"])
    source = task.get("source", {})
    if "source" in source and isinstance(source["source"], dict):
        source = source["source"]
    return render_events(arm, notes, source if isinstance(source, dict) else {})


def deterministic_screen() -> dict[str, Any]:
    corpus = make_corpus()
    audit = cohort_audit()
    round_trips = []
    task = corpus["retained"]["comprehension-structure"][0]
    for arm in ARMS:
        text = render_events(arm, task["expected"], task["source"])
        parsed, alignment = parse_events(arm, text)
        round_trips.append(
            {
                "arm": arm,
                "pass": projected(parsed, MUSICAL_FIELDS)
                == projected(task["expected"], MUSICAL_FIELDS),
                "alignment": alignment,
                "bytes": len(text.encode()),
                "sha256": sha256_text(text),
            }
        )
    perfect_checks = []
    mutation_checks = []
    prompt_checks = []
    for arm in ARMS:
        for family in TASK_FAMILIES:
            if not is_eligible(arm, family):
                continue
            for task in corpus["retained"][family]:
                score = score_response(arm, task, perfect_payload(arm, task))
                perfect_checks.append(
                    {"arm": arm, "task": task["id"], "pass": score["musical_pass"]}
                )
            prompt = prompt_for(arm, corpus["retained"][family][0])
            mutation_task = corpus["retained"][family][0]
            mutation_score = score_response(
                arm, mutation_task, mutation_payload(arm, mutation_task)
            )
            mutation_checks.append(
                {
                    "arm": arm,
                    "task": mutation_task["id"],
                    "pass": not mutation_score["musical_pass"],
                }
            )
            prompt_checks.append(
                {
                    "arm": arm,
                    "family": family,
                    "grammar": output_grammar(arm, family) in prompt,
                    "example": output_example(arm, family) in prompt,
                    "instruction": task_instruction(corpus["retained"][family][0]) in prompt,
                }
            )
    capabilities = candidate_capability_screen()
    value = {
        "schema": SCHEMA,
        "corpus": corpus_manifest(corpus),
        "cohort_audit": audit,
        "eligibility": eligibility_manifest(),
        "round_trips": round_trips,
        "perfect_response_checks": perfect_checks,
        "mutation_checks": mutation_checks,
        "prompt_checks": prompt_checks,
        "candidate_capabilities": capabilities,
        "all_checks_pass": (
            audit["historical_semantic_overlap"] == 0
            and audit["internal_fixture_duplicates"] == 0
            and audit["internal_semantic_duplicates"] == 0
            and all(
                value["pass"]
                for value in round_trips + perfect_checks + mutation_checks
            )
            and all(all(item[name] for name in ("grammar", "example", "instruction")) for item in prompt_checks)
            and all(value["pass"] for value in capabilities.values())
        ),
    }
    value["sha256"] = digest(value)
    return value


def package_hashes() -> dict[str, str]:
    names = (
        "benchmark.py",
        "corpus.py",
        "formats.py",
        "scoring.py",
        "report.py",
        "theory_verifiers.py",
        "tonal-verifier.mjs",
        "requirements-verifiers.txt",
    )
    return {
        name: hashlib.sha256((PACKAGE_ROOT / name).read_bytes()).hexdigest()
        for name in names
    }


def frozen_dependency_hashes() -> dict[str, str]:
    paths = {
        "symbolic-format-v1/benchmark.py": V1_ROOT / "benchmark.py",
        "symbolic-format-v1/corpus.py": V1_ROOT / "corpus.py",
        "symbolic-format-v1/formats.py": V1_ROOT / "formats.py",
        "symbolic-format-v1/scoring.py": V1_ROOT / "scoring.py",
        "compact-json-v1/core.py": BENCHMARKS_ROOT / "compact-json-v1" / "core.py",
    }
    return {
        name: hashlib.sha256(path.read_bytes()).hexdigest()
        for name, path in paths.items()
    }


def protocol_manifest() -> dict[str, Any]:
    corpus = make_corpus()
    prompts = {}
    grammars = {}
    for arm in ARMS:
        for family in TASK_FAMILIES:
            if not is_eligible(arm, family):
                continue
            task = corpus["retained"][family][0]
            prompts[f"{arm}/{family}"] = sha256_text(prompt_for(arm, task))
            grammars[f"{arm}/{family}"] = sha256_text(output_grammar(arm, family))
    value = {
        "schema": SCHEMA,
        "run_id": RUN_ID,
        "arms": list(ARMS),
        "full_capability_arms": list(FROZEN_JSON_ARMS),
        "candidate_roles": {
            PRIMARY_ARM: "selected complete representation",
            FALLBACK_ARM: "full-capability fallback and paired control",
        },
        "task_families": list(TASK_FAMILIES),
        "models": MODELS,
        "settings": SETTINGS,
        "prices_usd_per_million_tokens": PRICES,
        "price_sources": PRICE_SOURCES,
        "seeded_interleave": SEED,
        "retry": {"http_status": [429, 500, 502, 503, 504], "delays_seconds": [2, 4, 8]},
        "sample_rule": {
            "initial_variants": [1, 2, 3],
            "mixed_add": [4, 5],
            "still_mixed_add": [6, 7],
            "sentinel_arms": list(SENTINEL_ARMS),
            "sentinel_repeat_variant": 1,
        },
        "decision_rule": {
            "paired_rate_margin": RATE_MARGIN,
            "paired_syntax_margin": SYNTAX_MARGIN,
            "repeated_candidate_only_losses_per_provider_family": REPEATED_LOSS_LIMIT,
            "provider_rule": "A full-capability arm must pass every eligible paired comparator on every provider.",
            "preference": [PRIMARY_ARM, FALLBACK_ARM],
            "population_equivalence": "not claimed",
        },
        "failure_classes": [
            "explicit-score-ledger-disagreement",
            "missing-or-invalid-side-ledger",
            "native-score-parse-failure",
            "other-output-or-patch-parse-failure",
        ],
        "corpus": corpus_manifest(corpus),
        "cohort_audit_sha256": cohort_audit()["sha256"],
        "package_file_sha256": package_hashes(),
        "frozen_dependency_sha256": frozen_dependency_hashes(),
        "prompt_sha256": prompts,
        "grammar_sha256": grammars,
        "privacy": "Generated MIT symbolic notes only. Do not send live project data, audio, MIDI files, repository source, or API keys.",
    }
    value["sha256"] = digest(value)
    return value


def call_counts() -> dict[str, int]:
    cells = sum(
        is_eligible(arm, family) for arm in ARMS for family in TASK_FAMILIES
    )
    sentinels = sum(
        is_eligible(arm, family)
        for arm in SENTINEL_ARMS
        for family in TASK_FAMILIES
    )
    secondary = 6
    return {
        "eligible_cells": cells,
        "initial_core": cells * 3,
        "sentinels": sentinels,
        "secondary_and_repair": secondary,
        "minimum_per_provider": cells * 3 + sentinels + secondary,
        "maximum_per_provider": cells * 7 + sentinels + secondary,
    }


def run_plan() -> dict[str, Any]:
    counts = call_counts()
    value = {
        "schema": SCHEMA,
        "run_id": RUN_ID,
        "run_kind": "retained-full-matrix",
        "protocol_sha256": protocol_manifest()["sha256"],
        "screen_sha256": deterministic_screen()["sha256"],
        "cohort_audit_sha256": cohort_audit()["sha256"],
        "providers": list(PROVIDERS),
        "models": MODELS,
        "settings": SETTINGS,
        "scope": counts,
        "expected_calls": EXPECTED_CALLS,
        "maximum_calls": {provider: counts["maximum_per_provider"] for provider in PROVIDERS},
        "expected_total_calls": sum(EXPECTED_CALLS.values()),
        "maximum_total_calls": counts["maximum_per_provider"] * len(PROVIDERS),
        "cost_estimate_usd": {
            "by_provider": EXPECTED_COST_USD,
            "total": round(sum(EXPECTED_COST_USD.values()), 6),
            "maximum_by_provider": MAXIMUM_COST_USD,
            "maximum_total": round(sum(MAXIMUM_COST_USD.values()), 6),
        },
        "cost_basis": {
            "source": "Phase 8c1 retained manifests and Phase 8c2.3 targeted holdout manifests",
            "method": "Apply the observed provider extension rate and the larger frozen-JSON arm mean call cost. Reprice Claude at the current rate and add 25 percent.",
            "repriced_phase8c1_cost_and_calls": {
                "openai": {"cost_usd": 2.083530, "calls": 553},
                "gemini": {"cost_usd": 1.476243, "calls": 509},
                "claude": {"cost_usd": 7.139355, "calls": 541},
            },
            "larger_frozen_json_mean_call_cost_usd": {
                "openai": 0.0093130125,
                "gemini": 0.005060025,
                "claude": 0.0562884,
            },
            "contingency": 0.25,
            "price_verification_date": "2026-09-27",
            "price_sources": PRICE_SOURCES,
        },
        "stopping_rule": "Start every eligible cell at three. Extend mixed cells to five, then to seven when still mixed. Do not make an unplanned follow-up call.",
        "approval_boundary": "No provider call is permitted without explicit approval for this exact run-plan hash.",
    }
    value["sha256"] = digest(value)
    return value


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    if value.get("run_id") != RUN_ID or value.get("run_plan_sha256") != plan["sha256"]:
        raise ValueError("Approval does not match the frozen Phase 8c3 run plan")
    statement = value.get("operator_statement")
    if value.get("approved") is not True or not isinstance(statement, str) or not statement.strip():
        raise ValueError("Approval needs an explicit operator statement")
    return value


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
                    "json_schema": {"name": "benchmark_payload", "strict": True, "schema": OUTER_SCHEMA},
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
                    "responseJsonSchema": OUTER_SCHEMA,
                    "maxOutputTokens": SETTINGS[provider]["max_output_tokens"],
                    "thinkingConfig": {"thinkingLevel": SETTINGS[provider]["thinking_level"]},
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
                "format": {"type": "json_schema", "schema": OUTER_SCHEMA},
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
    value["sha256"] = digest(value)
    return value


def model_call(provider: str, key: str, prompt: str) -> tuple[dict[str, Any], dict[str, Any]]:
    spec = request_spec(provider, key, prompt)
    raw = v1.post_json(spec["url"], spec["headers"], spec["payload"])
    if provider == "openai":
        text = raw["choices"][0]["message"]["content"]
    elif provider == "gemini":
        text = "".join(part.get("text", "") for part in raw["candidates"][0]["content"]["parts"])
    else:
        text = "".join(block.get("text", "") for block in raw["content"] if block.get("type") == "text")
    return v1.parse_outer(text), raw


def usage(provider: str, raw: dict[str, Any]) -> dict[str, int]:
    return V1_USAGE(provider, raw)


def cost_usd(provider: str, measured: dict[str, int]) -> dict[str, float]:
    rates = PRICES[provider]
    cached = measured["cached_input_tokens"]
    uncached = max(0, measured["input_tokens"] - cached)
    parts = {
        "uncached_input": uncached * rates["input"] / 1_000_000,
        "cached_input": cached * rates["cached_input"] / 1_000_000,
        "output": measured["output_tokens"] * rates["output"] / 1_000_000,
    }
    parts["total"] = sum(parts.values())
    return {name: round(value, 8) for name, value in parts.items()}


def bind_provider_helpers() -> None:
    v1.SCHEMA = SCHEMA
    v1.SEED = SEED
    v1.ARMS = ARMS
    v1.SENTINEL_ARMS = SENTINEL_ARMS
    v1.PROVIDERS = PROVIDERS
    v1.MODELS = MODELS
    v1.PRICES = PRICES
    v1.prompt_for = prompt_for
    v1.model_call = model_call
    v1.usage = usage
    v1.cost_usd = cost_usd


def output_limit_stop(provider: str, reason: str | None) -> bool:
    return reason in ({"length"} if provider == "openai" else {"MAX_TOKENS"} if provider == "gemini" else {"max_tokens"})


def run_provider(provider: str, env_file: Path, approval_file: Path, workers: int) -> dict[str, Any]:
    approval = validate_approval(approval_file)
    screen = deterministic_screen()
    if not screen["all_checks_pass"] or not transport_audit()["exact_match"]:
        raise ValueError("The deterministic or transport screen failed")
    environment = v1.load_env(env_file)
    key = environment.get(KEYS[provider])
    if not key:
        raise ValueError(f"{KEYS[provider]} is missing")
    bind_provider_helpers()
    results = v1.execute_jobs(provider, key, v1.core_jobs("retained", [1, 2, 3]), workers)
    first_mixed = v1.mixed_cells(results, {1, 2, 3})
    if first_mixed:
        jobs = [
            job for job in v1.core_jobs("retained", [4, 5])
            if (job["arm"], job["family"]) in first_mixed
        ]
        results.extend(v1.execute_jobs(provider, key, jobs, workers))
    second_mixed = v1.mixed_cells(results, {1, 2, 3, 4, 5}) & first_mixed
    if second_mixed:
        jobs = [
            job for job in v1.core_jobs("retained", [6, 7])
            if (job["arm"], job["family"]) in second_mixed
        ]
        results.extend(v1.execute_jobs(provider, key, jobs, workers))
    corpus = make_corpus()
    sentinels = [
        {
            "kind": "retained",
            "arm": arm,
            "family": family,
            "variant": 1,
            "task": corpus["retained"][family][0],
            "sentinel": True,
        }
        for arm in SENTINEL_ARMS
        for family in TASK_FAMILIES
        if is_eligible(arm, family)
    ]
    results.extend(v1.execute_jobs(provider, key, sentinels, workers))
    secondary = v1.execute_secondary(provider, key)
    core_cost = sum(row["cost_usd"]["total"] for row in results)
    secondary_cost = sum(
        row["cost_usd"]["total"]
        + row.get("repair", {}).get("cost_usd", {}).get("total", 0)
        for row in secondary
    )
    value = {
        "schema": SCHEMA,
        "run_kind": "retained-provider",
        "run_id": RUN_ID,
        "provider": provider,
        "requested_model": MODELS[provider],
        "settings": SETTINGS[provider],
        "client": "Python urllib.request direct HTTPS",
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "python": platform.python_version(),
        "privacy": protocol_manifest()["privacy"],
        "protocol_sha256": protocol_manifest()["sha256"],
        "screen_sha256": screen["sha256"],
        "run_plan_sha256": run_plan()["sha256"],
        "approval": approval,
        "stopping": {
            "mixed_after_three": sorted([list(value) for value in first_mixed]),
            "mixed_after_five": sorted([list(value) for value in second_mixed]),
        },
        "results": sorted(results, key=lambda row: (row["arm"], row["family"], row["variant"], row["sentinel"])),
        "secondary": secondary,
        "actual_cost_usd": round(core_cost + secondary_cost, 6),
        "complete": (
            all("transport_error" not in row for row in results)
            and all(not output_limit_stop(provider, row.get("stop_reason")) for row in results)
        ),
    }
    value["raw_run_sha256"] = digest(
        [row.get("raw_response_sha256") for row in results]
        + [row["raw_response_sha256"] for row in secondary]
    )
    value["manifest_sha256"] = digest(value)
    return value


def paired_comparison(
    provider: str,
    by_arm: dict[str, list[dict[str, Any]]],
    candidate: str,
    comparator: str,
) -> dict[str, Any]:
    left = {(row["family"], row["variant"]): row for row in by_arm[candidate]}
    right = {(row["family"], row["variant"]): row for row in by_arm[comparator]}
    common = sorted(left.keys() & right.keys())
    candidate_success = sum(left[key]["validation"]["musical_pass"] for key in common)
    comparator_success = sum(right[key]["validation"]["musical_pass"] for key in common)
    candidate_syntax = sum(left[key]["validation"]["syntax_pass"] for key in common)
    comparator_syntax = sum(right[key]["validation"]["syntax_pass"] for key in common)
    losses: dict[str, int] = defaultdict(int)
    for key in common:
        if not left[key]["validation"]["musical_pass"] and right[key]["validation"]["musical_pass"]:
            losses[key[0]] += 1
    repeated = sorted(name for name, count in losses.items() if count >= REPEATED_LOSS_LIMIT)
    denominator = len(common)
    rate_delta = (candidate_success - comparator_success) / denominator
    syntax_delta = (candidate_syntax - comparator_syntax) / denominator
    return {
        "provider": provider,
        "candidate": candidate,
        "comparator": comparator,
        "paired_trials": denominator,
        "candidate_successes": candidate_success,
        "comparator_successes": comparator_success,
        "rate_delta": round(rate_delta, 6),
        "candidate_syntax_successes": candidate_syntax,
        "comparator_syntax_successes": comparator_syntax,
        "syntax_delta": round(syntax_delta, 6),
        "candidate_only_loss_by_family": dict(sorted(losses.items())),
        "repeated_candidate_only_loss_families": repeated,
        "passes": rate_delta >= -RATE_MARGIN and syntax_delta >= -SYNTAX_MARGIN and not repeated,
    }


def failure_class(error: str | None) -> str | None:
    if not error:
        return None
    for name in protocol_manifest()["failure_classes"]:
        if error.startswith(name + ":"):
            return name
    return "other-output-or-patch-parse-failure"


def summarize(paths: list[Path]) -> dict[str, Any]:
    runs = [json.loads(path.read_text()) for path in paths]
    if {run["provider"] for run in runs} != set(PROVIDERS):
        raise ValueError("Summary needs one retained run for every provider")
    if any(run.get("run_plan_sha256") != run_plan()["sha256"] for run in runs):
        raise ValueError("A provider run does not match the frozen run plan")
    comparisons = []
    side_ledger = []
    providers = []
    arm_pass: dict[str, bool] = {arm: True for arm in FROZEN_JSON_ARMS}
    for run in runs:
        regular = [row for row in run["results"] if not row["sentinel"]]
        by_arm: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for row in regular:
            by_arm[row["arm"]].append(row)
        arm_rows = []
        for arm in ARMS:
            rows = by_arm[arm]
            arm_rows.append(
                {
                    "arm": arm,
                    "successes": sum(row["validation"]["musical_pass"] for row in rows),
                    "trials": len(rows),
                    "syntax_successes": sum(row["validation"]["syntax_pass"] for row in rows),
                    "input_tokens": sum(row["usage"]["input_tokens"] for row in rows),
                    "output_tokens": sum(row["usage"]["output_tokens"] for row in rows),
                    "output_bytes": sum(row.get("response_payload_bytes", 0) for row in rows),
                    "latency_ms": round(sum(row.get("latency_ms", 0) for row in rows), 3),
                    "cost_usd": round(sum(row["cost_usd"]["total"] for row in rows), 6),
                }
            )
        for candidate in FROZEN_JSON_ARMS:
            for comparator in ARMS:
                if comparator == candidate or comparator in FROZEN_JSON_ARMS and candidate == FALLBACK_ARM:
                    continue
                if not by_arm[candidate] or not by_arm[comparator]:
                    continue
                comparison = paired_comparison(run["provider"], by_arm, candidate, comparator)
                comparisons.append(comparison)
                arm_pass[candidate] &= comparison["passes"]
        for family in PAIR_FAMILIES:
            native_arm = f"{family}-native"
            composite_arm = f"{family}-composite"
            native = {
                (row["family"], row["variant"]): row
                for row in by_arm[native_arm]
            }
            composite = {
                (row["family"], row["variant"]): row
                for row in by_arm[composite_arm]
            }
            common = sorted(native.keys() & composite.keys())
            denominator = len(common)
            side_ledger.append(
                {
                    "provider": run["provider"],
                    "family": family,
                    "paired_trials": denominator,
                    "musical_success_delta": round(
                        (
                            sum(
                                composite[key]["validation"]["musical_pass"]
                                for key in common
                            )
                            - sum(
                                native[key]["validation"]["musical_pass"]
                                for key in common
                            )
                        )
                        / denominator,
                        6,
                    ),
                    "input_token_overhead": sum(
                        composite[key]["usage"]["input_tokens"]
                        - native[key]["usage"]["input_tokens"]
                        for key in common
                    ),
                    "output_byte_overhead": sum(
                        composite[key].get("response_payload_bytes", 0)
                        - native[key].get("response_payload_bytes", 0)
                        for key in common
                    ),
                }
            )
        sentinel_groups: dict[tuple[str, str], list[bool]] = defaultdict(list)
        for row in run["results"]:
            if row["arm"] in SENTINEL_ARMS and row["variant"] == 1:
                sentinel_groups[(row["arm"], row["family"])].append(row["validation"]["musical_pass"])
        composite_rows = [row for row in regular if row["arm"] in COMPOSITE_ARMS]
        event_rows = [
            row
            for row in composite_rows
            if row["family"]
            not in {"comprehension-analysis", "transformation-local"}
        ]
        failure_counts: dict[str, int] = defaultdict(int)
        for row in composite_rows:
            category = failure_class(row["validation"].get("error"))
            if category:
                failure_counts[category] += 1
        providers.append(
            {
                "provider": run["provider"],
                "requested_model": run["requested_model"],
                "returned_models": sorted({row.get("returned_model") for row in run["results"] if row.get("returned_model")}),
                "arms": arm_rows,
                "sentinel_variation": [list(cell) for cell, values in sentinel_groups.items() if len(set(values)) > 1],
                "composite_failure_summary": {
                    "event_output_calls": len(event_rows),
                    "all_composite_calls": len(composite_rows),
                    "classes": dict(sorted(failure_counts.items())),
                },
                "secondary_initial_passes": sum(row["initial_pass"] for row in run["secondary"]),
                "secondary_initial_total": len(run["secondary"]),
                "repair_pass": run["secondary"][0].get("repair", {}).get("pass"),
                "actual_cost_usd": run["actual_cost_usd"],
                "stopping": run["stopping"],
            }
        )
    complete = all(run["complete"] for run in runs)
    capabilities = deterministic_screen()["candidate_capabilities"]
    selected = next(
        (
            arm for arm in (PRIMARY_ARM, FALLBACK_ARM)
            if arm_pass[arm] and capabilities[arm]["pass"]
        ),
        None,
    )
    failed_gates = {
        arm: sum(not row["passes"] for row in comparisons if row["candidate"] == arm)
        for arm in FROZEN_JSON_ARMS
    }
    if not complete:
        decision = "block"
    elif selected:
        decision = "proceed"
    elif min(failed_gates.values()) <= 3:
        decision = "revise"
    else:
        decision = "block"
    value = {
        "schema": SCHEMA,
        "run_kind": "retained-summary",
        "run_id": RUN_ID,
        "decision": decision,
        "selected_full_capability_arm": selected,
        "population_equivalence": "not claimed",
        "frozen_gates": protocol_manifest()["decision_rule"],
        "failed_comparison_gates": failed_gates,
        "providers": providers,
        "comparisons": comparisons,
        "side_ledger": side_ledger,
        "candidate_capabilities": capabilities,
        "actual_cost_usd": {
            "by_provider": {run["provider"]: run["actual_cost_usd"] for run in runs},
            "total": round(sum(run["actual_cost_usd"] for run in runs), 6),
        },
        "raw_run_sha256": {run["provider"]: run["raw_run_sha256"] for run in runs},
    }
    value["sha256"] = digest(value)
    return value


def deterministic_package() -> dict[str, Any]:
    value = {
        "schema": SCHEMA,
        "run_kind": "deterministic",
        "screen": deterministic_screen(),
        "transport": transport_audit(),
        "protocol": protocol_manifest(),
        "run_plan": run_plan(),
    }
    value["sha256"] = digest(value)
    return value


def deterministic_manifest(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": value["schema"],
        "screen_sha256": value["screen"]["sha256"],
        "transport_sha256": value["transport"]["sha256"],
        "protocol_sha256": value["protocol"]["sha256"],
        "run_plan_sha256": value["run_plan"]["sha256"],
        "corpus_sha256": value["screen"]["corpus"]["sha256"],
        "cohort_audit_sha256": value["screen"]["cohort_audit"]["sha256"],
        "sha256": value["sha256"],
    }


def self_test() -> dict[str, Any]:
    value = deterministic_package()
    assert value["screen"]["all_checks_pass"]
    assert value["transport"]["exact_match"]
    assert call_counts() == {
        "eligible_cells": 130,
        "initial_core": 390,
        "sentinels": 45,
        "secondary_and_repair": 6,
        "minimum_per_provider": 441,
        "maximum_per_provider": 961,
    }
    try:
        validate_approval(APPROVAL_PATH)
    except ValueError as error:
        assert "explicit operator statement" in str(error)
    else:
        raise AssertionError("The pending approval record was accepted")
    synthetic = {
        arm: [
            {"family": "x", "variant": index, "validation": {"musical_pass": True, "syntax_pass": True}}
            for index in range(3)
        ]
        for arm in (PRIMARY_ARM, FALLBACK_ARM)
    }
    assert paired_comparison("test", synthetic, PRIMARY_ARM, FALLBACK_ARM)["passes"]
    bind_provider_helpers()
    assert v1.usage(
        "openai",
        {
            "usage": {
                "prompt_tokens": 11,
                "prompt_tokens_details": {"cached_tokens": 3},
                "completion_tokens": 5,
                "completion_tokens_details": {"reasoning_tokens": 2},
            }
        },
    ) == {
        "input_tokens": 11,
        "cached_input_tokens": 3,
        "output_tokens": 5,
        "thinking_tokens": 2,
    }
    return {
        "schema": SCHEMA,
        "passed": 35,
        "corpus_sha256": value["screen"]["corpus"]["sha256"],
        "deterministic_sha256": value["sha256"],
    }


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
    actions.add_argument("--check", type=Path)
    actions.add_argument("--provider", choices=PROVIDERS)
    actions.add_argument("--summarize", nargs=3, type=Path)
    parser.add_argument("--env-file", type=Path, default=Path("../.env"))
    parser.add_argument("--approval-file", type=Path, default=APPROVAL_PATH)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.self_test:
        value = self_test()
    elif args.deterministic:
        value = deterministic_package()
    elif args.check:
        expected = json.loads(args.check.read_text())
        actual = deterministic_package()
        if deterministic_manifest(actual) != expected:
            print(
                canonical(
                    {
                        "expected_sha256": expected.get("sha256"),
                        "actual_sha256": actual.get("sha256"),
                    }
                ),
                file=sys.stderr,
            )
            raise SystemExit(1)
        value = {"schema": SCHEMA, "check": "pass", "sha256": actual["sha256"]}
    elif args.provider:
        value = run_provider(args.provider, args.env_file, args.approval_file, args.workers)
    else:
        value = summarize(args.summarize)
    write_result(value, args.output)


if __name__ == "__main__":
    main()
