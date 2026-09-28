#!/usr/bin/env python3
"""Prepare and run the Phase 8c4c paired development benchmark."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import platform
import random
import statistics
import sys
import time
from copy import deepcopy
from decimal import Decimal, ROUND_HALF_UP
from fractions import Fraction
from pathlib import Path
from typing import Any, Callable


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent
V6_ROOT = BENCHMARKS_ROOT / "compact-format-v6"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


core = load_module("ghostnote_compact_format_v10_core", V6_ROOT / "core.py")
base = load_module("ghostnote_compact_format_v10_base", V6_ROOT / "benchmark.py")
transport = load_module(
    "ghostnote_compact_format_v10_transport",
    BENCHMARKS_ROOT / "compact-format-v2" / "benchmark.py",
)

SCHEMA = "ghostnote-compact-format-paired-development-v10"
CORPUS_SCHEMA = "ghostnote-compact-format-paired-corpus-v10"
RUN_ID = "phase8c4c-compact-bar-paired-development-r1"
COHORTS = ("development-r1", "holdout-r1")
PROVIDERS = ("openai", "gemini", "claude-haiku")
MODELS = {
    "openai": "gpt-5.4-mini-2026-03-17",
    "gemini": "gemini-3.8-flash",
    "claude-haiku": "claude-haiku-4-5-20251001",
}
KEYS = {
    "openai": "OPENAI_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "claude-haiku": "ANTHROPIC_API_KEY",
}
SETTINGS = {
    "openai": {"reasoning_effort": "low", "max_completion_tokens": 12000},
    "gemini": {"thinking_level": "low", "max_output_tokens": 12000},
    "claude-haiku": {
        "thinking": {"type": "enabled", "budget_tokens": 1024},
        "max_tokens": 12000,
    },
    "temperature": "provider default",
}
OUTER_SCHEMA = base.OUTER_SCHEMA
DECISION_COUNT = 8
GUARD_COUNT = 4
ANALYSIS_BATCH_COUNTS = (1, 2, 2, 3, 3, 4, 4, 5)
COHORT_SPECS = {
    "development-r1": {"seed": 13033, "variant_offset": 26, "time_shift": 0, "motif_shift": 0},
    "holdout-r1": {"seed": 13009, "variant_offset": 50, "time_shift": 8, "motif_shift": 12},
}
PAIRED_MUSICAL_MARGIN = Decimal("0.05")
GUARD_MARGIN = Decimal("0.25")
ABSOLUTE_DECISION_MINIMUM = Decimal("0.50")
INITIAL_SYNTAX_MINIMUM = Decimal("0.875")
INITIAL_COMPLETION_MINIMUM = Decimal("0.875")
MAXIMUM_REPEATED_LOSSES = 1
FIELDS_BENEFIT_MINIMUM = Decimal("0.05")
FIELDS_FAMILY_BENEFIT_MINIMUM = Decimal("0.125")
SIZE_GATES = deepcopy(base.SIZE_GATES)
REPAIR_POLICY = {
    "maximum_turns": 1,
    "eligible": (
        "At most the first 48 available initial parse or musical-contract "
        "failures in the preregistered shuffled job order, including named sentinels."
    ),
    "feedback": "Return only the structured parse or failed-check diagnostic.",
    "primary_result": "Initial musical success only. A repair never replaces an initial result.",
    "unavailable_or_failed": "Do not repair and do not add to a scored denominator.",
    "overflow": "Report eligible failures beyond the 48-call repair cap. Do not repair them.",
}
PRICES_USD_PER_MILLION = {
    "openai": {"input": "0.75", "cached_input": "0.075", "output": "4.50"},
    "gemini": {"input": "0.75", "cached_input": "0.075", "output": "3.75"},
    "claude-haiku": {"input": "1.00", "cached_input": "0.10", "output": "5.00"},
}
PRICE_SOURCES = {
    "openai": "https://developers.openai.com/api/docs/models/gpt-5.4-mini",
    "gemini": "https://ai.google.dev/gemini-api/docs/pricing",
    "claude-haiku": "https://platform.claude.com/docs/en/models/overview",
}
PRICE_VERIFICATION_DATE = "2026-09-28"
INPUT_TOKEN_CEILING = 12000
REQUEST_BYTE_CEILING = 10000
TOKEN_COUNT_MARGIN = 128
MAXIMUM_INITIAL_CALLS = 141
MAXIMUM_REPAIR_CALLS = 48
MAXIMUM_CALLS = MAXIMUM_INITIAL_CALLS + MAXIMUM_REPAIR_CALLS
MAXIMUM_TOKEN_COUNT_REQUESTS = MAXIMUM_CALLS
PROVIDER_COST_LIMITS = {
    "openai": Decimal("1.50"),
    "gemini": Decimal("0.75"),
    "claude-haiku": Decimal("2.75"),
}
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "development-r1-approval.json"
DEPENDENCY_FILES = {
    "compact-format-v6/core.py": "9150edfc2a2d0e873386508d406d9d92c29ca1fcf1ecd352f53fba3702d6280d",
    "compact-format-v6/expected-deterministic.json": "de97aebbfd1d8d74126cb8c607f4617d104f468a9a6c57416f240e6a222d0549",
    "compact-format-v5/runs/2026-09-28-calibration-summary.json": "611ee9bbe017af7e52af70a9b4016d3ca9a50794a200dee5a54a7a9003c4c0d4",
    "compact-format-v6/runs/2026-09-28-analysis-gemini-easy.json": "3f406cd196dd9b8693ee15cd75dccd002a1e83db779021abd98cdf5912eee08b",
    "compact-format-v6/runs/2026-09-28-analysis-summary.json": "3eaf6f7926a8b73c1585ce2ad15a4d22e12434855817764161bdd7506b352f5f",
    "compact-format-v8/runs/2026-09-28-analysis-haiku.json": "a8e375638c1ed1e86df74685a94a66dc89f457f0440c4957944a33dfee35d1b3",
    "compact-format-v8/runs/2026-09-28-analysis-summary.json": "ded617e6070675b0e789c08bbdea3701c1a03df7073dce1a607913892ff82050",
    "compact-format-v9/runs/2026-09-28-analysis-openai.json": "0077124cf26373812cd4a3ece55b2546f36824fb2c074b0fe991a23cd96f76c4",
    "compact-format-v9/runs/2026-09-28-analysis-summary.json": "80775b52a90588134dc5ffe7767b774bea7362eb99440662852e803e6817f078",
}
HISTORICAL_PACKAGES = (
    "symbolic-format-v1",
    "compact-format-v2",
    "compact-format-v3",
    "compact-format-v4",
    "compact-format-v5",
    "compact-format-v6",
    "compact-format-v7",
    "compact-format-v8",
    "compact-format-v9",
    "compact-json-v1",
    "symbolic-format-v2",
)


def decimal_rate(value: str) -> Decimal:
    return Decimal(value) / Decimal(1_000_000)


def rounded_usd(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP))


def exact_usd(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.000000001"), rounding=ROUND_HALF_UP))


def maximum_call_cost(provider: str) -> Decimal:
    prices = PRICES_USD_PER_MILLION[provider]
    output_limit = output_token_limit(provider)
    return (
        Decimal(INPUT_TOKEN_CEILING) * decimal_rate(prices["input"])
        + Decimal(output_limit) * decimal_rate(prices["output"])
    )


def maximum_provider_cost(provider: str) -> Decimal:
    return PROVIDER_COST_LIMITS[provider]


def output_token_limit(provider: str) -> int:
    setting = SETTINGS[provider]
    return int(
        setting.get("max_completion_tokens")
        or setting.get("max_output_tokens")
        or setting.get("max_tokens")
    )


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def expect_rejected(action: Callable[[], Any]) -> bool:
    try:
        action()
    except (KeyError, RuntimeError, TypeError, ValueError, json.JSONDecodeError):
        return True
    return False


def shifted_fraction(value: str | int, amount: int) -> str:
    return core.fraction_text(core.fraction(value) + Fraction(amount))


def shift_notes(values: list[dict[str, Any]], amount: int) -> list[dict[str, Any]]:
    result = deepcopy(values)
    for row in result:
        row["start"] = shifted_fraction(row["start"], amount)
    return core.sort_notes(result)


def refresh_task(task: dict[str, Any]) -> dict[str, Any]:
    value = deepcopy(task)
    value.pop("semantic_sha256", None)
    value.pop("sha256", None)
    semantic = {
        name: item
        for name, item in value.items()
        if name not in {"schema", "id", "cohort", "variant", "origin", "license"}
    }
    value["semantic_sha256"] = core.digest(semantic)
    value["sha256"] = core.digest(value)
    return value


def analysis_case_hashes(task: dict[str, Any]) -> list[str]:
    result = []
    by_id = {row["id"]: row for row in task["source"]}
    for index, group in enumerate(task["contract"]["chord_groups"]):
        rows = [by_id[note_id] for note_id in group["note_ids"]]
        first = min(core.fraction(row["start"]) for row in rows)
        expected = task["expected"]
        result.append(
            core.digest(
                {
                    "chord_pitches": [row["pitch"] for row in rows],
                    "chord_starts": [
                        core.fraction_text(core.fraction(row["start"]) - first)
                        for row in rows
                    ],
                    "chord_durations": [row["duration"] for row in rows],
                    "motif_pair": task["contract"]["motif_pairs"][index],
                    "root_pc": expected["root_pcs"][index],
                    "bass_pc": expected["bass_pcs"][index],
                    "quality": expected["qualities"][index],
                    "inversion": expected["inversions"][index],
                    "function": expected["functions"][index],
                    "motif_relation": expected["motif_relations"][index],
                    "rhythm": expected["rhythms"][index],
                }
            )
        )
    return result


def transform_holdout(task: dict[str, Any], time_shift: int, motif_shift: int) -> dict[str, Any]:
    value = deepcopy(task)
    family = value["family"]
    if family == "comprehension-analysis":
        value["source"] = shift_notes(value["source"], time_shift)
        for pair in value["contract"]["motif_pairs"]:
            pair["a_pitches"] = [pitch + motif_shift for pitch in pair["a_pitches"]]
            pair["b_pitches"] = [pitch + motif_shift for pitch in pair["b_pitches"]]
        value["case_semantic_sha256"] = analysis_case_hashes(value)
    elif family == "continuation-motif":
        value["source"] = shift_notes(value["source"], time_shift)
        value["contract"]["output_start"] = shifted_fraction(
            value["contract"]["output_start"], time_shift
        )
        value["expected"] = core.motif_expected(value["source"], value["contract"])
    elif family == "generation-progression":
        value["contract"]["chord_starts"] = [
            shifted_fraction(start, time_shift)
            for start in value["contract"]["chord_starts"]
        ]
    elif family == "comprehension-structure":
        value["source"] = shift_notes(value["source"], time_shift)
        value["expected"] = deepcopy(value["source"])
    elif family == "continuation-roles":
        value["contract"]["starts"] = [
            shifted_fraction(start, time_shift) for start in value["contract"]["starts"]
        ]
        value["expected"] = core.perfect_roles(value["contract"])
    elif family == "transformation-revoice":
        value["contract"]["source"] = shift_notes(
            value["contract"]["source"], time_shift
        )
        value["expected"] = core.perfect_revoice(value["contract"])
    else:
        value["source"] = shift_notes(value["source"], time_shift)
        value["base_sha256"] = core.digest(core.projected(value["source"]))
        if family == "transformation-local":
            value["expected"] = deepcopy(value["source"])
            target = next(
                row for row in value["expected"] if row["id"] == value["change"]["note_id"]
            )
            target[value["change"]["field"]] = value["change"]["value"]
            value["expected"] = core.sort_notes(value["expected"])
        else:
            value["expected"] = deepcopy(value["source"])
            for index, row in enumerate(value["expected"]):
                if index % 2 == 1:
                    row["start"] = core.fraction_text(
                        core.fraction(row["start"]) + core.fraction(value["offset"])
                    )
            value["expected"] = core.sort_notes(value["expected"])
    return refresh_task(value)


def make_corpus(cohort: str) -> dict[str, Any]:
    if cohort not in COHORT_SPECS:
        raise ValueError(f"Unknown cohort: {cohort}")
    spec = COHORT_SPECS[cohort]
    seed = int(spec["seed"])
    offset = int(spec["variant_offset"])
    core.ANALYSIS_BATCH_COUNTS[cohort] = ANALYSIS_BATCH_COUNTS
    fixtures = {
        "comprehension-analysis": [
            core.analysis_task(cohort, offset + index, seed)
            for index in range(DECISION_COUNT)
        ],
        "continuation-motif": [
            core.motif_task(cohort, offset + index, seed)
            for index in range(DECISION_COUNT)
        ],
        "generation-progression": [
            core.progression_task(cohort, offset + index, seed)
            for index in range(DECISION_COUNT)
        ],
    }
    for family in core.GUARD_FAMILIES:
        fixtures[family] = [
            core.guard_task(cohort, family, offset + index, seed)
            for index in range(GUARD_COUNT)
        ]
    if spec["time_shift"] or spec["motif_shift"]:
        fixtures = {
            family: [
                transform_holdout(
                    task,
                    int(spec["time_shift"]),
                    int(spec["motif_shift"]),
                )
                for task in tasks
            ]
            for family, tasks in fixtures.items()
        }
    value = {
        "schema": CORPUS_SCHEMA,
        "cohort": cohort,
        "license": "MIT",
        "fixtures": fixtures,
    }
    value["sha256"] = core.digest(value)
    return value


def jobs(cohort: str = "development-r1") -> list[dict[str, Any]]:
    corpus = make_corpus(cohort)
    unique = [
        {
            "arm": arm,
            "family": family,
            "variant": task["variant"],
            "sentinel": False,
            "task": task,
        }
        for arm in core.ARMS
        for family in core.TASK_FAMILIES
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
        for arm in core.ARMS
        for family in core.DECISION_FAMILIES
    ]
    return unique + sentinels


def collect_hashes(value: Any, semantic: set[str], cases: set[str]) -> None:
    if isinstance(value, dict):
        for name, item in value.items():
            values = item if isinstance(item, list) else [item]
            if name == "semantic_sha256":
                semantic.update(entry for entry in values if isinstance(entry, str))
            if name in {"case_semantic_sha256", "analysis_case_sha256"}:
                cases.update(entry for entry in values if isinstance(entry, str))
            collect_hashes(item, semantic, cases)
    elif isinstance(value, list):
        for item in value:
            collect_hashes(item, semantic, cases)


def historical_hashes() -> tuple[set[str], set[str]]:
    semantic: set[str] = set()
    cases: set[str] = set()
    for package in HISTORICAL_PACKAGES:
        for path in (BENCHMARKS_ROOT / package).rglob("*.json"):
            try:
                collect_hashes(json.loads(path.read_text()), semantic, cases)
            except json.JSONDecodeError:
                continue
    return semantic, cases


def cohort_audit() -> dict[str, Any]:
    corpora = {name: make_corpus(name) for name in COHORTS}
    historical_semantic, historical_cases = historical_hashes()
    full: dict[str, set[str]] = {}
    semantic: dict[str, set[str]] = {}
    cases: dict[str, set[str]] = {}
    cohorts = {}
    for name, corpus in corpora.items():
        tasks = [task for values in corpus["fixtures"].values() for task in values]
        full[name] = {task["sha256"] for task in tasks}
        semantic[name] = {task["semantic_sha256"] for task in tasks}
        cases[name] = {
            case
            for task in corpus["fixtures"]["comprehension-analysis"]
            for case in task["case_semantic_sha256"]
        }
        cohorts[name] = {
            "corpus_sha256": corpus["sha256"],
            "fixture_count": len(tasks),
            "fixture_sha256": sorted(full[name]),
            "semantic_sha256": sorted(semantic[name]),
            "analysis_case_sha256": sorted(cases[name]),
            "historical_semantic_overlap": len(semantic[name] & historical_semantic),
            "historical_analysis_case_overlap": len(cases[name] & historical_cases),
            "internal_semantic_duplicates": len(tasks) - len(semantic[name]),
        }
    pairwise = {
        "fixture_hash_overlap": len(full[COHORTS[0]] & full[COHORTS[1]]),
        "semantic_hash_overlap": len(semantic[COHORTS[0]] & semantic[COHORTS[1]]),
        "analysis_case_hash_overlap": len(cases[COHORTS[0]] & cases[COHORTS[1]]),
    }
    return {
        "cohorts": cohorts,
        "historical_semantic_count": len(historical_semantic),
        "historical_analysis_case_count": len(historical_cases),
        "pairwise": pairwise,
    }


def cohort_manifest() -> dict[str, Any]:
    value = {"schema": CORPUS_SCHEMA, "kind": "cohort-manifest", **cohort_audit()}
    value["sha256"] = core.digest(value)
    return value


def dependency_manifest() -> dict[str, Any]:
    actual = {
        name: file_sha256(BENCHMARKS_ROOT / name) for name in DEPENDENCY_FILES
    }
    value = {
        "schema": SCHEMA,
        "kind": "frozen-dependency-manifest",
        "files": actual,
        "files_match": actual == DEPENDENCY_FILES,
        "repaired_contract_core_sha256": actual["compact-format-v6/core.py"],
        "calibration_result": "proceed-development",
        "eligible_analysis_providers": {
            "openai": "1/5",
            "gemini": "3/5",
            "claude-haiku": "1/5",
        },
        "retained_r2_family_providers": {
            "continuation-motif": 2,
            "generation-progression": 3,
        },
        "reuse_rule": "Reuse the repaired contracts and scorers. Do not reuse a calibration fixture in development or holdout.",
    }
    value["sha256"] = core.digest(value)
    return value


def package_files() -> dict[str, str]:
    return {
        name: file_sha256(PACKAGE_ROOT / name)
        for name in ("benchmark.py", "README.md", "PROTOCOL.md")
    }


def resolution_screen() -> dict[str, Any]:
    required = math.ceil(1 / (len(core.DECISION_FAMILIES) * 0.05))
    selected = max(8, required)
    return {
        "decision_families": len(core.DECISION_FAMILIES),
        "maximum_macro_step": 0.05,
        "minimum_from_resolution": required,
        "allowed_range": [8, 12],
        "selected_per_family": selected,
        "decision_macro_rows": selected * len(core.DECISION_FAMILIES),
        "decision_macro_step": round(1 / (selected * len(core.DECISION_FAMILIES)), 6),
        "pass": selected == DECISION_COUNT,
    }


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
                        "schema": OUTER_SCHEMA,
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
                    "responseJsonSchema": OUTER_SCHEMA,
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
            "thinking": SETTINGS[provider]["thinking"],
            "messages": messages,
            "output_config": {
                "format": {"type": "json_schema", "schema": OUTER_SCHEMA}
            },
        },
    }


def count_spec(key: str, prompt: str) -> dict[str, Any]:
    message = request_spec("claude-haiku", key, prompt)
    payload = deepcopy(message["payload"])
    payload.pop("max_tokens")
    return {
        "url": "https://api.anthropic.com/v1/messages/count_tokens",
        "headers": message["headers"],
        "payload": payload,
    }


def request_bytes(provider: str, prompt: str) -> int:
    spec = request_spec(provider, "redacted", prompt)
    return len(core.canonical(spec["payload"]).encode())


def request_screen() -> dict[str, Any]:
    initial = [core.prompt_for(job["arm"], job["task"]) for job in jobs()]
    diagnostic = {
        "class": "musical-contract",
        "failed_checks": [
            "document_context",
            "operation_formula",
            "maximum_same_voice_movement",
        ],
    }
    repair = [core.repair_prompt(prompt, diagnostic) for prompt in initial]
    largest = {
        provider: max(request_bytes(provider, prompt) for prompt in initial + repair)
        for provider in PROVIDERS
    }
    return {
        "largest_request_bytes": largest,
        "request_byte_ceiling": REQUEST_BYTE_CEILING,
        "all_fit": all(value <= REQUEST_BYTE_CEILING for value in largest.values()),
        "haiku_count_payload_omits_output_limit": "max_tokens"
        not in count_spec("redacted", "probe")["payload"],
    }


def paired_stats(
    indexed: dict[tuple[str, str, int], dict[str, Any]],
    candidate: str,
    baseline_arm: str,
    families: tuple[str, ...],
    metric: Callable[[dict[str, Any]], bool],
) -> dict[str, Any]:
    differences = []
    candidate_successes = 0
    baseline_successes = 0
    candidate_only_wins = 0
    candidate_only_losses = 0
    candidate_only_win_rows = []
    candidate_only_loss_rows = []
    expected = 0
    for family in families:
        variants = sorted(
            variant
            for arm, row_family, variant in indexed
            if arm == candidate and row_family == family
        )
        for variant in variants:
            expected += 1
            left = indexed[(candidate, family, variant)]
            right = indexed[(baseline_arm, family, variant)]
            if not initial_scored(left) or not initial_scored(right):
                continue
            left_value = metric(left)
            right_value = metric(right)
            candidate_successes += int(left_value)
            baseline_successes += int(right_value)
            candidate_only_wins += int(left_value and not right_value)
            candidate_only_losses += int(right_value and not left_value)
            if left_value and not right_value:
                candidate_only_win_rows.append({"family": family, "variant": variant})
            if right_value and not left_value:
                candidate_only_loss_rows.append({"family": family, "variant": variant})
            differences.append(int(left_value) - int(right_value))
    effect = sum(differences) / len(differences) if differences else None
    variance = statistics.variance(differences) if len(differences) > 1 else 0
    half_width = 1.96 * math.sqrt(variance / len(differences)) if differences else 0
    return {
        "expected_pairs": expected,
        "paired_denominator": len(differences),
        "candidate_successes": candidate_successes,
        "baseline_successes": baseline_successes,
        "candidate_only_wins": candidate_only_wins,
        "candidate_only_losses": candidate_only_losses,
        "candidate_only_win_rows": candidate_only_win_rows,
        "candidate_only_loss_rows": candidate_only_loss_rows,
        "ties": len(differences) - candidate_only_wins - candidate_only_losses,
        "effect": round(effect, 6) if effect is not None else None,
        "approximate_95_interval": (
            [round(max(-1, effect - half_width), 6), round(min(1, effect + half_width), 6)]
            if effect is not None
            else None
        ),
    }


def initial_scored(row: dict[str, Any]) -> bool:
    return row["initial"]["kind"] == "initial" and bool(row["initial"]["scored"])


def musical_metric(row: dict[str, Any]) -> bool:
    return bool(row["initial"]["score"]["primary_pass"])


def syntax_metric(row: dict[str, Any]) -> bool:
    return bool(row["initial"]["score"]["syntax_pass"])


def rate(rows: list[dict[str, Any]], metric: Callable[[dict[str, Any]], bool]) -> dict[str, Any]:
    scored = [row for row in rows if initial_scored(row)]
    passed = sum(metric(row) for row in scored)
    return {
        "passed": passed,
        "denominator": len(scored),
        "expected": len(rows),
        "rate": round(passed / len(scored), 6) if scored else None,
    }


def usage_stats(calls: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "calls": len(calls),
        "input_tokens": sum(call["usage"]["input_tokens"] for call in calls),
        "output_tokens": sum(call["usage"]["output_tokens"] for call in calls),
        "response_bytes": sum(call.get("response_payload_bytes", 0) for call in calls),
        "median_latency_ms": (
            round(statistics.median(call["latency_ms"] for call in calls), 3)
            if calls
            else None
        ),
    }


def repair_eligible(row: dict[str, Any]) -> bool:
    return (
        row["initial"]["kind"] == "initial"
        and not row["initial"]["score"]["primary_pass"]
    )


def select_repair_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [row for row in rows if repair_eligible(row)][:MAXIMUM_REPAIR_CALLS]


def family_stats(run: dict[str, Any], arm: str, family: str) -> dict[str, Any]:
    rows = [
        row
        for row in run["results"]
        if row["arm"] == arm and row["family"] == family and not row["sentinel"]
    ]
    repairs = [row["repair"] for row in rows if row.get("repair") is not None]
    eligible_repairs = [row for row in rows if repair_eligible(row)]
    initial_calls = [row["initial_call"] for row in rows if row.get("initial_call")]
    repair_calls = [row["repair_call"] for row in rows if row.get("repair_call")]
    scored = [row for row in rows if initial_scored(row)]
    repaired_scored = [row for row in repairs if row["kind"] == "repaired" and row["scored"]]
    return {
        "initial_completion": {
            "passed": len(scored),
            "denominator": len(rows),
            "expected": len(rows),
            "rate": round(len(scored) / len(rows), 6) if rows else None,
        },
        "initial_syntax": rate(rows, syntax_metric),
        "initial_musical": rate(rows, musical_metric),
        "repair_eligible": len(eligible_repairs),
        "repair_attempts": len(repairs),
        "repair_skipped_by_cap": len(eligible_repairs) - len(repairs),
        "repair_scored": len(repaired_scored),
        "repair_syntax": sum(row["score"]["syntax_pass"] for row in repaired_scored),
        "repair_musical": sum(row["score"]["primary_pass"] for row in repaired_scored),
        "initial_usage": usage_stats(initial_calls),
        "repair_usage": usage_stats(repair_calls),
    }


def candidate_gates(run: dict[str, Any], candidate: str) -> dict[str, Any]:
    indexed = {
        (row["arm"], row["family"], row["variant"]): row
        for row in run["results"]
        if not row["sentinel"]
    }
    decision_exact = paired_stats(
        indexed,
        candidate,
        "exact-object-json",
        tuple(core.DECISION_FAMILIES),
        musical_metric,
    )
    decision_v1 = (
        paired_stats(
            indexed,
            candidate,
            "compact-bar-v1",
            tuple(core.DECISION_FAMILIES),
            musical_metric,
        )
        if candidate == "compact-bar-fields"
        else None
    )
    family_exact = {
        family: paired_stats(
            indexed,
            candidate,
            "exact-object-json",
            (family,),
            musical_metric,
        )
        for family in core.TASK_FAMILIES
    }
    family_v1 = (
        {
            family: paired_stats(
                indexed,
                candidate,
                "compact-bar-v1",
                (family,),
                musical_metric,
            )
            for family in core.TASK_FAMILIES
        }
        if candidate == "compact-bar-fields"
        else {}
    )
    stats = {
        family: family_stats(run, candidate, family) for family in core.TASK_FAMILIES
    }
    decision_rows = [
        row
        for row in run["results"]
        if row["arm"] == candidate
        and row["family"] in core.DECISION_FAMILIES
        and not row["sentinel"]
    ]
    decision_rate = rate(decision_rows, musical_metric)
    complete = all(
        value["initial_completion"]["rate"] is not None
        and Decimal(str(value["initial_completion"]["rate"])) >= INITIAL_COMPLETION_MINIMUM
        for value in stats.values()
    )
    syntax = all(
        value["initial_syntax"]["rate"] is not None
        and Decimal(str(value["initial_syntax"]["rate"])) >= INITIAL_SYNTAX_MINIMUM
        for value in stats.values()
    )
    repeated = all(
        contrast["candidate_only_losses"] <= MAXIMUM_REPEATED_LOSSES
        for contrast in family_exact.values()
    ) and all(
        contrast["candidate_only_losses"] <= MAXIMUM_REPEATED_LOSSES
        for contrast in family_v1.values()
    )
    guard = all(
        contrast["effect"] is not None
        and Decimal(str(contrast["effect"])) >= -GUARD_MARGIN
        for family, contrast in family_exact.items()
        if family in core.GUARD_FAMILIES
    ) and all(
        contrast["effect"] is not None
        and Decimal(str(contrast["effect"])) >= -GUARD_MARGIN
        for family, contrast in family_v1.items()
        if family in core.GUARD_FAMILIES
    )
    exact_margin = decision_exact["effect"] is not None and Decimal(
        str(decision_exact["effect"])
    ) >= -PAIRED_MUSICAL_MARGIN
    v1_margin = decision_v1 is None or (
        decision_v1["effect"] is not None
        and Decimal(str(decision_v1["effect"])) >= -PAIRED_MUSICAL_MARGIN
    )
    absolute = decision_rate["rate"] is not None and Decimal(
        str(decision_rate["rate"])
    ) >= ABSOLUTE_DECISION_MINIMUM
    return {
        "candidate": candidate,
        "pass": all((complete, syntax, repeated, guard, exact_margin, v1_margin, absolute)),
        "checks": {
            "completion": complete,
            "initial_syntax": syntax,
            "no_repeated_candidate_only_loss": repeated,
            "guard_margin": guard,
            "exact_object_margin": exact_margin,
            "positional_v1_margin": v1_margin,
            "absolute_decision_minimum": absolute,
        },
        "decision_rate": decision_rate,
        "decision_vs_exact": decision_exact,
        "decision_vs_v1": decision_v1,
        "family_vs_exact": family_exact,
        "family_vs_v1": family_v1,
        "family_stats": stats,
    }


def fields_benefit(run: dict[str, Any]) -> dict[str, Any]:
    indexed = {
        (row["arm"], row["family"], row["variant"]): row
        for row in run["results"]
        if not row["sentinel"]
    }
    macro = paired_stats(
        indexed,
        "compact-bar-fields",
        "compact-bar-v1",
        tuple(core.DECISION_FAMILIES),
        musical_metric,
    )
    analysis = paired_stats(
        indexed,
        "compact-bar-fields",
        "compact-bar-v1",
        ("comprehension-analysis",),
        musical_metric,
    )
    syntax = paired_stats(
        indexed,
        "compact-bar-fields",
        "compact-bar-v1",
        tuple(core.DECISION_FAMILIES),
        syntax_metric,
    )
    fields_losses = paired_stats(
        indexed,
        "compact-bar-fields",
        "exact-object-json",
        tuple(core.DECISION_FAMILIES),
        musical_metric,
    )["candidate_only_losses"]
    v1_losses = paired_stats(
        indexed,
        "compact-bar-v1",
        "exact-object-json",
        tuple(core.DECISION_FAMILIES),
        musical_metric,
    )["candidate_only_losses"]
    return {
        "provider": run["provider"],
        "decision_macro": macro,
        "analysis_family": analysis,
        "initial_syntax": syntax,
        "exact_control_losses": {"fields": fields_losses, "v1": v1_losses},
        "signals": {
            "decision_macro": macro["effect"] is not None
            and Decimal(str(macro["effect"])) >= FIELDS_BENEFIT_MINIMUM,
            "analysis_family": analysis["effect"] is not None
            and Decimal(str(analysis["effect"])) >= FIELDS_FAMILY_BENEFIT_MINIMUM,
            "framing": syntax["candidate_only_wins"] > syntax["candidate_only_losses"],
            "fewer_exact_control_losses": fields_losses < v1_losses,
        },
    }


def exact_control_valid(run: dict[str, Any]) -> bool:
    rows = [
        row
        for row in run["results"]
        if row["arm"] == "exact-object-json"
        and row["family"] in core.DECISION_FAMILIES
        and not row["sentinel"]
    ]
    summary = rate(rows, musical_metric)
    families_complete = all(
        family_stats(run, "exact-object-json", family)["initial_completion"]["rate"]
        == 1.0
        for family in core.DECISION_FAMILIES
    )
    return (
        families_complete
        and summary["rate"] is not None
        and Decimal(str(summary["rate"])) >= ABSOLUTE_DECISION_MINIMUM
    )


def summarize_runs(runs: list[dict[str, Any]], protocol_sha256: str | None = None) -> dict[str, Any]:
    by_provider = {run["provider"]: run for run in runs}
    if set(by_provider) != set(PROVIDERS):
        raise ValueError("The summary needs all three provider manifests")
    expected_protocol = protocol_sha256 or protocol_manifest()["sha256"]
    if any(run.get("protocol_sha256") != expected_protocol for run in runs):
        raise ValueError("A provider manifest uses a different protocol")
    provider_rows = []
    fields_support = []
    for provider in PROVIDERS:
        run = by_provider[provider]
        fields = candidate_gates(run, "compact-bar-fields")
        positional = candidate_gates(run, "compact-bar-v1")
        benefit = fields_benefit(run)
        fields_support.append(benefit)
        provider_rows.append(
            {
                "provider": provider,
                "exact_control_valid": exact_control_valid(run),
                "fields": fields,
                "positional_v1": positional,
                "fields_benefit": benefit,
                "sentinels": sentinel_stats(run),
                "actual_calls": run.get("actual_calls", 0),
                "actual_cost_usd": run.get("actual_cost_usd", 0),
            }
        )
    all_controls = all(row["exact_control_valid"] for row in provider_rows)
    fields_qualify = all(row["fields"]["pass"] for row in provider_rows)
    v1_qualify = all(row["positional_v1"]["pass"] for row in provider_rows)
    repeated_benefit = any(
        sum(item["signals"][signal] for item in fields_support) >= 2
        for signal in (
            "decision_macro",
            "analysis_family",
            "framing",
            "fewer_exact_control_losses",
        )
    )
    no_material_fields_regression = all(
        item["decision_macro"]["effect"] is not None
        and Decimal(str(item["decision_macro"]["effect"])) >= -PAIRED_MUSICAL_MARGIN
        for item in fields_support
    )
    if not all_controls:
        decision = "revise"
        selected = None
    elif fields_qualify and repeated_benefit and no_material_fields_regression:
        decision = "freeze-fields-holdout"
        selected = "compact-bar-fields"
    elif v1_qualify:
        decision = "freeze-v1-holdout"
        selected = "compact-bar-v1"
    else:
        decision = "stop"
        selected = None
    costs = exact_aggregate_costs(runs)
    value = {
        "schema": SCHEMA,
        "run_kind": "paired-development-summary",
        "run_id": RUN_ID,
        "decision": decision,
        "selected_candidate": selected,
        "selection_authority": "Development can freeze one compact arm for holdout. It cannot select a public format.",
        "providers": provider_rows,
        "fields_benefit_repeats": repeated_benefit,
        "actual_cost_usd": costs,
        "initial_and_repaired_separate": True,
        "protocol_sha256": expected_protocol,
    }
    value["sha256"] = core.digest(value)
    return value


def sentinel_stats(run: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for arm in core.ARMS:
        for family in core.DECISION_FAMILIES:
            rows = [
                row
                for row in run["results"]
                if row["arm"] == arm and row["family"] == family
            ]
            unique = next(row for row in rows if not row["sentinel"])
            sentinel = next(row for row in rows if row["sentinel"])
            result.append(
                {
                    "arm": arm,
                    "family": family,
                    "same_initial_state": unique["initial"] == sentinel["initial"],
                    "same_payload": (
                        (unique.get("initial_call") or {}).get("response_payload_sha256")
                        == (sentinel.get("initial_call") or {}).get("response_payload_sha256")
                    ),
                }
            )
    return result


def exact_aggregate_costs(runs: list[dict[str, Any]]) -> dict[str, float]:
    providers = {}
    exact_totals = {}
    for run in runs:
        lines = [
            call["cost_usd"]["total"]
            for row in run["results"]
            for call in (row.get("initial_call"), row.get("repair_call"))
            if call is not None
        ]
        total = sum((Decimal(str(value)) for value in lines), Decimal(0))
        exact_totals[run["provider"]] = total
        providers[run["provider"]] = rounded_usd(total)
        if rounded_usd(total) != run.get("actual_cost_usd"):
            raise ValueError("A provider cost does not match its exact line-item sum")
        if rounded_usd(total) != run.get("cost_guard", {}).get("settled_cost_usd"):
            raise ValueError("A provider cost does not match its settled guard total")
    aggregate = sum(exact_totals.values(), Decimal(0))
    return {**providers, "total": rounded_usd(aggregate)}


def synthetic_run(provider: str, mode: str) -> dict[str, Any]:
    results = []
    for job in jobs():
        family = job["family"]
        local_index = job["variant"] - COHORT_SPECS["development-r1"]["variant_offset"]
        passed = True
        scored = True
        syntax = True
        if mode == "fields" and job["arm"] == "compact-bar-v1" and family in core.DECISION_FAMILIES:
            passed = local_index != 1
        elif mode == "fallback" and job["arm"] == "compact-bar-fields" and family == "comprehension-analysis":
            passed = local_index != 1
        elif mode == "revise" and job["arm"] == "exact-object-json" and family == "comprehension-analysis" and local_index == 1:
            scored = False
            passed = False
            syntax = False
        elif mode == "stop" and job["arm"] != "exact-object-json" and family in core.DECISION_FAMILIES:
            passed = local_index >= 3
        state = (
            core.result_state(
                "initial",
                {
                    "syntax_pass": syntax,
                    "musical_pass": passed,
                    "primary_pass": passed,
                    "checks": {},
                    "diagnostic": None if passed else {"class": "musical-contract", "failed_checks": ["synthetic"]},
                },
            )
            if scored
            else core.result_state("unavailable", reason="synthetic")
        )
        results.append(
            {
                "arm": job["arm"],
                "family": family,
                "variant": job["variant"],
                "sentinel": job["sentinel"],
                "initial": state,
                "initial_call": None,
                "repair": None,
                "repair_call": None,
            }
        )
    return {
        "provider": provider,
        "protocol_sha256": "synthetic",
        "results": results,
        "actual_calls": 0,
        "actual_cost_usd": 0.0,
        "cost_guard": {"settled_cost_usd": 0.0},
    }


def aggregation_screen() -> dict[str, Any]:
    def decision(mode: str) -> str:
        return summarize_runs(
            [synthetic_run(provider, mode) for provider in PROVIDERS],
            "synthetic",
        )["decision"]

    return {
        "fields_selected": decision("fields") == "freeze-fields-holdout",
        "v1_fallback_selected": decision("fallback") == "freeze-v1-holdout",
        "incomplete_control_revises": decision("revise") == "revise",
        "repeated_losses_stop": decision("stop") == "stop",
    }


class CostBudgetExceeded(RuntimeError):
    """Stop provider work before the approved budget can be exceeded."""


class CostGuard:
    def __init__(self, provider: str) -> None:
        self.provider = provider
        self.message_attempts = 0
        self.token_count_requests = 0
        self.settled_cost = Decimal(0)
        self.committed_cost = Decimal(0)
        self.failed_reservations = 0

    def record_token_count(self, input_tokens: int) -> None:
        self.token_count_requests += 1
        if self.provider != "claude-haiku":
            raise RuntimeError("Only Haiku uses the token-count endpoint")
        if self.token_count_requests > MAXIMUM_TOKEN_COUNT_REQUESTS:
            raise RuntimeError("The token-count request limit is exhausted")
        if input_tokens + TOKEN_COUNT_MARGIN > INPUT_TOKEN_CEILING:
            raise RuntimeError("The input-token cost ceiling is exceeded")

    def check_message_capacity(self, payload_bytes: int) -> None:
        if payload_bytes > REQUEST_BYTE_CEILING:
            raise RuntimeError("The request-byte ceiling is exceeded")
        if self.message_attempts >= MAXIMUM_CALLS:
            raise RuntimeError("The message-call limit is exhausted")
        reservation = maximum_call_cost(self.provider)
        projected = self.committed_cost + reservation
        if projected > maximum_provider_cost(self.provider):
            raise CostBudgetExceeded("The approved cost ceiling would be exceeded")

    def authorize_message(self, payload_bytes: int) -> Decimal:
        self.check_message_capacity(payload_bytes)
        reservation = maximum_call_cost(self.provider)
        projected = self.committed_cost + reservation
        self.message_attempts += 1
        self.committed_cost = projected
        return reservation

    def settle(self, reservation: Decimal, measured: dict[str, int], actual: Decimal) -> None:
        if measured["input_tokens"] > INPUT_TOKEN_CEILING:
            raise RuntimeError("Measured input tokens exceed the cost bound")
        if measured["output_tokens"] > output_token_limit(self.provider):
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
            "token_count_requests": self.token_count_requests,
            "settled_cost_usd": rounded_usd(self.settled_cost),
            "settled_exact_usd": exact_usd(self.settled_cost),
            "committed_cost_usd": rounded_usd(self.committed_cost),
            "committed_exact_usd": exact_usd(self.committed_cost),
            "failed_reservations": self.failed_reservations,
            "maximum_cost_usd": rounded_usd(maximum_provider_cost(self.provider)),
        }


def cost_guard_screen() -> dict[str, Any]:
    maximum_calls = {}
    budget_stops = {}
    for provider in PROVIDERS:
        guard = CostGuard(provider)
        for _ in range(MAXIMUM_CALLS):
            reservation = guard.authorize_message(REQUEST_BYTE_CEILING)
            guard.settle(
                reservation,
                {
                    "input_tokens": 0,
                    "cached_input_tokens": 0,
                    "output_tokens": 0,
                    "thinking_tokens": 0,
                },
                Decimal(0),
            )
        maximum_calls[provider] = (
            guard.message_attempts == MAXIMUM_CALLS
            and expect_rejected(lambda guard=guard: guard.authorize_message(1))
        )
        guard = CostGuard(provider)
        while True:
            try:
                guard.authorize_message(REQUEST_BYTE_CEILING)
            except RuntimeError:
                break
        budget_stops[provider] = (
            guard.committed_cost <= maximum_provider_cost(provider)
            and guard.message_attempts < MAXIMUM_CALLS
            and expect_rejected(lambda guard=guard: guard.authorize_message(1))
        )
    exact_lines = [Decimal("0.0000004"), Decimal("0.0000004")]
    exact_total = sum(exact_lines, Decimal(0))
    iterative_total = sum((value.quantize(Decimal("0.000001")) for value in exact_lines), Decimal(0))
    return {
        "all_zero_cost_maximum_call_paths_fit": all(maximum_calls.values()),
        "all_full_reservation_paths_stop_at_budget": all(budget_stops.values()),
        "oversized_request_rejected": expect_rejected(
            lambda: CostGuard("openai").authorize_message(REQUEST_BYTE_CEILING + 1)
        ),
        "exact_aggregate_precedes_rounding": rounded_usd(exact_total) == 0.000001
        and rounded_usd(iterative_total) == 0.0,
    }


def repair_cap_screen() -> dict[str, Any]:
    failed = core.result_state(
        "initial",
        {
            "syntax_pass": True,
            "musical_pass": False,
            "primary_pass": False,
            "checks": {},
            "diagnostic": {
                "class": "musical-contract",
                "failed_checks": ["synthetic"],
            },
        },
    )
    rows = [{"index": index, "initial": failed} for index in range(60)]
    selected = select_repair_rows(rows)
    return {
        "selected_count": len(selected),
        "maximum": MAXIMUM_REPAIR_CALLS,
        "preserves_preregistered_order": [row["index"] for row in selected]
        == list(range(MAXIMUM_REPAIR_CALLS)),
        "pass": len(selected) == MAXIMUM_REPAIR_CALLS,
    }


def deterministic_screen() -> dict[str, Any]:
    audit = cohort_audit()
    cohorts_pass = all(
        value["historical_semantic_overlap"] == 0
        and value["historical_analysis_case_overlap"] == 0
        and value["internal_semantic_duplicates"] == 0
        and value["fixture_count"] == 44
        for value in audit["cohorts"].values()
    ) and all(value == 0 for value in audit["pairwise"].values())
    base_screen = base.deterministic_screen()
    requests = request_screen()
    aggregation = aggregation_screen()
    guard = cost_guard_screen()
    repair_cap = repair_cap_screen()
    resolution = resolution_screen()
    dependencies = dependency_manifest()
    value = {
        "schema": SCHEMA,
        "base_capabilities_pass": base_screen["all_checks_pass"],
        "base_capability_sha256": base_screen["sha256"],
        "size_gates": base_screen["format_screen"]["size_gates"],
        "size_gates_pass": base_screen["format_screen"]["size_gates_pass"],
        "one_note_plane": base_screen["format_screen"]["one_note_plane"],
        "stable_identity": base_screen["format_screen"]["stable_identity"],
        "cohort_audit": audit,
        "cohorts_pass": cohorts_pass,
        "resolution": resolution,
        "requests": requests,
        "aggregation": aggregation,
        "cost_guard": guard,
        "repair_cap": repair_cap,
        "dependencies": dependencies,
        "job_counts": {
            "unique_initial": sum(not job["sentinel"] for job in jobs()),
            "named_sentinel_initial": sum(job["sentinel"] for job in jobs()),
            "initial": len(jobs()),
            "maximum_repair": MAXIMUM_REPAIR_CALLS,
            "maximum_per_provider": MAXIMUM_CALLS,
            "maximum_all_providers": MAXIMUM_CALLS * len(PROVIDERS),
        },
    }
    value["all_checks_pass"] = all(
        (
            value["base_capabilities_pass"],
            value["size_gates_pass"],
            value["one_note_plane"],
            value["stable_identity"],
            value["cohorts_pass"],
            value["resolution"]["pass"],
            value["requests"]["all_fit"],
            value["requests"]["haiku_count_payload_omits_output_limit"],
            all(value["aggregation"].values()),
            all(value["cost_guard"].values()),
            value["repair_cap"]["pass"],
            value["dependencies"]["files_match"],
            value["job_counts"]["initial"] == MAXIMUM_INITIAL_CALLS,
        )
    )
    value["sha256"] = core.digest(value)
    return value


def protocol_manifest() -> dict[str, Any]:
    screen = deterministic_screen()
    cohort = cohort_manifest()
    dependency = dependency_manifest()
    cost_limits = {
        provider: rounded_usd(maximum_provider_cost(provider)) for provider in PROVIDERS
    }
    value = {
        "schema": SCHEMA,
        "run_kind": "paired-development-protocol",
        "run_id": RUN_ID,
        "development_corpus_sha256": make_corpus("development-r1")["sha256"],
        "reserved_holdout_corpus_sha256": make_corpus("holdout-r1")["sha256"],
        "cohort_manifest_sha256": cohort["sha256"],
        "dependency_manifest_sha256": dependency["sha256"],
        "deterministic_screen_sha256": screen["sha256"],
        "package_files": package_files(),
        "arms": list(core.ARMS),
        "decision_families": list(core.DECISION_FAMILIES),
        "guard_families": list(core.GUARD_FAMILIES),
        "fixture_counts": {
            "decision_per_family": DECISION_COUNT,
            "guard_per_family": GUARD_COUNT,
            "unique_per_arm": 44,
        },
        "resolution": resolution_screen(),
        "models": MODELS,
        "settings": SETTINGS,
        "calls": screen["job_counts"],
        "cost_guard": {
            "input_token_ceiling_per_call": INPUT_TOKEN_CEILING,
            "request_byte_ceiling_per_call": REQUEST_BYTE_CEILING,
            "output_token_ceiling_per_call": 12000,
            "maximum_call_cost_usd": {
                provider: rounded_usd(maximum_call_cost(provider)) for provider in PROVIDERS
            },
            "maximum_provider_cost_usd": cost_limits,
            "maximum_total_cost_usd": rounded_usd(
                sum((maximum_provider_cost(provider) for provider in PROVIDERS), Decimal(0))
            ),
            "maximum_haiku_token_count_requests": MAXIMUM_TOKEN_COUNT_REQUESTS,
            "budget_rule": "Before each request, reserve its full token-bound cost against the cumulative provider budget. Refuse the request when the reservation does not fit. Settle successful requests to exact measured cost.",
            "aggregate_rule": "Sum exact cost line items. Round only the final provider and all-provider totals.",
            "prices_usd_per_million": PRICES_USD_PER_MILLION,
            "price_sources": PRICE_SOURCES,
            "price_verification_date": PRICE_VERIFICATION_DATE,
        },
        "gates": {
            "paired_musical_margin": float(PAIRED_MUSICAL_MARGIN),
            "guard_margin": float(GUARD_MARGIN),
            "absolute_decision_minimum": float(ABSOLUTE_DECISION_MINIMUM),
            "initial_syntax_minimum": float(INITIAL_SYNTAX_MINIMUM),
            "initial_completion_minimum": float(INITIAL_COMPLETION_MINIMUM),
            "maximum_candidate_only_losses_per_provider_family": MAXIMUM_REPEATED_LOSSES,
            "fields_decision_benefit_minimum": float(FIELDS_BENEFIT_MINIMUM),
            "fields_analysis_benefit_minimum": float(FIELDS_FAMILY_BENEFIT_MINIMUM),
            "fields_benefit_minimum_providers": 2,
            "size": SIZE_GATES,
            "deterministic_capabilities": "All document and patch capability checks must pass.",
        },
        "stopping_rule": "Return freeze-fields-holdout only when FIELDS passes every provider gate and one benefit repeats on at least two providers. Otherwise return freeze-v1-holdout when positional v1 passes. Return revise when an exact-object control is invalid. Return stop when valid controls reject both compact arms.",
        "repair_policy": REPAIR_POLICY,
        "freshness_rule": "Development and reserved holdout must have no task or analysis-case overlap with calibration, earlier packages, or each other.",
        "privacy": "Generated MIT symbolic text only. Do not send live project, audio, or MIDI data.",
        "provider_retry": "Do not retry a message request. A failed attempt keeps its full cost reservation.",
        "credential_preflight": "Require all three provider credentials before the first provider request.",
        "approval_boundary": "No token-count or provider request is approved until the operator approves the exact run-plan hash.",
        "selection_authority": "Development can freeze one candidate for holdout. It cannot select a public format or unblock Phase 8f.",
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    value = {
        "schema": SCHEMA,
        "run_kind": "paired-development-plan",
        "run_id": RUN_ID,
        "protocol_sha256": protocol["sha256"],
        "development_corpus_sha256": protocol["development_corpus_sha256"],
        "reserved_holdout_corpus_sha256": protocol["reserved_holdout_corpus_sha256"],
        "cohort_manifest_sha256": protocol["cohort_manifest_sha256"],
        "dependency_manifest_sha256": protocol["dependency_manifest_sha256"],
        "models": MODELS,
        "settings": SETTINGS,
        "calls": protocol["calls"],
        "maximum_calls_per_provider": MAXIMUM_CALLS,
        "maximum_calls_all_providers": MAXIMUM_CALLS * len(PROVIDERS),
        "maximum_cost_usd": protocol["cost_guard"]["maximum_total_cost_usd"],
        "cost_guard": protocol["cost_guard"],
        "gates": protocol["gates"],
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
        "development_corpus_sha256": value["protocol"]["development_corpus_sha256"],
        "reserved_holdout_corpus_sha256": value["protocol"]["reserved_holdout_corpus_sha256"],
        "cohort_manifest_sha256": value["protocol"]["cohort_manifest_sha256"],
        "dependency_manifest_sha256": value["protocol"]["dependency_manifest_sha256"],
        "run_plan_sha256": value["run_plan"]["sha256"],
    }


def self_test() -> dict[str, Any]:
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise AssertionError("The deterministic screen failed")
    plan = run_plan()
    if plan["maximum_calls_all_providers"] != 567:
        raise AssertionError("The maximum call count changed")
    if plan["maximum_cost_usd"] != 5.0:
        raise AssertionError("The maximum cost changed")
    return {
        "schema": SCHEMA,
        "pass": True,
        "checks": 66,
        "development_corpus_sha256": make_corpus("development-r1")["sha256"],
        "reserved_holdout_corpus_sha256": make_corpus("holdout-r1")["sha256"],
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
        raise ValueError("Approval does not match the frozen Phase 8c4c plan")
    if (
        value.get("status") != "approved"
        or not isinstance(value.get("operator_statement"), str)
        or not value["operator_statement"].strip()
    ):
        raise ValueError("Approval needs an explicit operator statement")
    return value


def cost_usd(provider: str, measured: dict[str, int]) -> tuple[dict[str, float], Decimal]:
    prices = PRICES_USD_PER_MILLION[provider]
    cached = measured["cached_input_tokens"]
    parts = {
        "uncached_input": Decimal(max(0, measured["input_tokens"] - cached))
        * decimal_rate(prices["input"]),
        "cached_input": Decimal(cached) * decimal_rate(prices["cached_input"]),
        "output": Decimal(measured["output_tokens"]) * decimal_rate(prices["output"]),
    }
    total = sum(parts.values(), Decimal(0))
    return (
        {**{name: exact_usd(value) for name, value in parts.items()}, "total": exact_usd(total)},
        total,
    )


def count_input_tokens(key: str, prompt: str, guard: CostGuard) -> int:
    spec = count_spec(key, prompt)
    raw = transport.post_json(spec["url"], spec["headers"], spec["payload"])
    input_tokens = raw.get("input_tokens")
    if not isinstance(input_tokens, int) or input_tokens < 0:
        raise ValueError("The token-count response is invalid")
    guard.record_token_count(input_tokens)
    return input_tokens


def model_call(provider: str, key: str, prompt: str) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    spec = request_spec(provider, key, prompt)
    raw = transport.post_json(spec["url"], spec["headers"], spec["payload"])
    transport_name = "claude" if provider == "claude-haiku" else provider
    reason = transport.stop_reason(transport_name, raw)
    if reason in ({"length"} if provider == "openai" else {"MAX_TOKENS"} if provider == "gemini" else {"max_tokens"}):
        return None, raw
    if provider == "openai":
        text = raw["choices"][0]["message"].get("content")
    elif provider == "gemini":
        text = "".join(
            part.get("text", "") for part in raw["candidates"][0]["content"]["parts"]
        )
    else:
        text = "".join(
            block.get("text", "") for block in raw["content"] if block.get("type") == "text"
        )
    if not isinstance(text, str) or not text:
        raise ValueError("The provider response has no text content")
    return transport.parse_outer(text), raw


def one_call(
    provider: str,
    key: str,
    prompt: str,
    task: dict[str, Any],
    arm: str,
    kind: str,
    guard: CostGuard,
) -> tuple[dict[str, Any], dict[str, Any]]:
    payload_bytes = request_bytes(provider, prompt)
    guard.check_message_capacity(payload_bytes)
    input_estimate = (
        count_input_tokens(key, prompt, guard) if provider == "claude-haiku" else None
    )
    reservation = guard.authorize_message(payload_bytes)
    started = time.perf_counter()
    try:
        outer, raw = model_call(provider, key, prompt)
    except Exception:
        guard.retain_failed_reservation()
        raise
    latency_ms = (time.perf_counter() - started) * 1000
    transport_name = "claude" if provider == "claude-haiku" else provider
    measured = transport.usage(transport_name, raw)
    cost, exact_cost = cost_usd(provider, measured)
    guard.settle(reservation, measured, exact_cost)
    reason = transport.stop_reason(transport_name, raw)
    call = {
        "prompt_sha256": core.sha256_text(prompt),
        "prompt_bytes": len(prompt.encode()),
        "request_bytes": payload_bytes,
        "input_token_estimate": input_estimate,
        "input_token_ceiling": INPUT_TOKEN_CEILING,
        "cost_reservation_usd": exact_usd(reservation),
        "usage": measured,
        "cost_usd": cost,
        "latency_ms": round(latency_ms, 3),
        "retries": 0,
        "returned_model": transport.returned_model(transport_name, raw),
        "request_id": raw.get("id"),
        "stop_reason": reason,
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


def initial_result(provider: str, key: str, job: dict[str, Any], guard: CostGuard) -> dict[str, Any]:
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
            provider, key, prompt, job["task"], job["arm"], "initial", guard
        )
    except Exception as error:
        initial = core.result_state("failed", reason=f"{type(error).__name__}: {error}")
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


def add_repair(provider: str, key: str, row: dict[str, Any], guard: CostGuard) -> None:
    initial = row["initial"]
    if initial["kind"] != "initial" or initial["score"]["primary_pass"]:
        return
    prompt = core.repair_prompt(row["prompt"], initial["score"]["diagnostic"])
    try:
        row["repair"], row["repair_call"] = one_call(
            provider, key, prompt, row["task"], row["arm"], "repaired", guard
        )
    except Exception as error:
        row["repair"] = core.result_state("failed", reason=f"{type(error).__name__}: {error}")


def execute_jobs(
    provider: str, key: str
) -> tuple[list[dict[str, Any]], CostGuard, dict[str, int]]:
    ordered = jobs()
    random.Random(13771).shuffle(ordered)
    guard = CostGuard(provider)
    results = []
    for index, job in enumerate(ordered, start=1):
        results.append(initial_result(provider, key, job, guard))
        print(
            f"{provider}: completed {index}/{len(ordered)} initial jobs",
            file=sys.stderr,
            flush=True,
        )
    eligible_repairs = [row for row in results if repair_eligible(row)]
    repair_rows = select_repair_rows(results)
    for row in repair_rows:
        add_repair(provider, key, row, guard)
    for row in results:
        row.pop("prompt")
        row.pop("task")
    return (
        sorted(
            results,
            key=lambda row: (row["arm"], row["family"], row["variant"], row["sentinel"]),
        ),
        guard,
        {
            "eligible": len(eligible_repairs),
            "attempted": len(repair_rows),
            "skipped_by_cap": len(eligible_repairs) - len(repair_rows),
        },
    )


def run_provider(provider: str, env_file: Path, approval_file: Path) -> dict[str, Any]:
    approval = validate_approval(approval_file)
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise ValueError("The deterministic screen failed")
    environment = transport.load_env(env_file)
    missing = [name for name in KEYS.values() if not environment.get(name)]
    if missing:
        raise ValueError(f"Provider credential preflight failed: {','.join(missing)}")
    results, guard, repair_accounting = execute_jobs(
        provider, environment[KEYS[provider]]
    )
    calls = [
        call
        for row in results
        for call in (row.get("initial_call"), row.get("repair_call"))
        if call is not None
    ]
    actual = sum((Decimal(str(call["cost_usd"]["total"])) for call in calls), Decimal(0))
    snapshot = guard.snapshot()
    if rounded_usd(actual) != snapshot["settled_cost_usd"]:
        raise AssertionError("The exact call sum and settled guard total differ")
    budget_stops = sum(
        state is not None
        and state["kind"] == "failed"
        and str(state.get("reason", "")).startswith("CostBudgetExceeded:")
        for row in results
        for state in (row.get("initial"), row.get("repair"))
    )
    value = {
        "schema": SCHEMA,
        "run_kind": "paired-development-provider",
        "run_id": RUN_ID,
        "provider": provider,
        "cohort": "development-r1",
        "cohort_sha256": make_corpus("development-r1")["sha256"],
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
        "results": results,
        "repair_accounting": repair_accounting,
        "actual_calls": guard.message_attempts,
        "completed_calls": len(calls),
        "actual_cost_usd": rounded_usd(actual),
        "cost_guard": snapshot,
        "budget_stops": budget_stops,
        "complete": len(results) == MAXIMUM_INITIAL_CALLS and budget_stops == 0,
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
    if (
        provider not in PROVIDERS
        or value.get("run_id") != RUN_ID
        or value.get("run_kind") != "paired-development-provider"
        or value.get("protocol_sha256") != protocol_manifest()["sha256"]
        or value.get("run_plan_sha256") != run_plan()["sha256"]
        or value.get("cohort_sha256") != make_corpus("development-r1")["sha256"]
        or value.get("requested_model") != MODELS[provider]
        or value.get("settings") != SETTINGS[provider]
        or value.get("complete") is not True
        or value.get("budget_stops") != 0
        or len(value.get("results", [])) != MAXIMUM_INITIAL_CALLS
        or value.get("actual_calls", MAXIMUM_CALLS + 1) > MAXIMUM_CALLS
        or value.get("cost_guard", {}).get("committed_cost_usd", math.inf)
        > rounded_usd(maximum_provider_cost(provider))
    ):
        raise ValueError(f"Manifest does not match the frozen protocol: {path}")
    expected_rows = {
        (job["arm"], job["family"], job["variant"], job["sentinel"])
        for job in jobs()
    }
    actual_rows = {
        (row["arm"], row["family"], row["variant"], row["sentinel"])
        for row in value["results"]
    }
    calls = [
        call
        for row in value["results"]
        for call in (row.get("initial_call"), row.get("repair_call"))
        if call is not None
    ]
    if expected_rows != actual_rows:
        raise ValueError(f"Manifest rows do not match the frozen jobs: {path}")
    if any(call.get("returned_model") != MODELS[provider] for call in calls):
        raise ValueError(f"Manifest contains a different returned model: {path}")
    if (
        value.get("completed_calls") != len(calls)
        or value.get("actual_calls")
        != value.get("cost_guard", {}).get("message_attempts")
    ):
        raise ValueError(f"Manifest call accounting does not reconcile: {path}")
    eligible_repairs = sum(repair_eligible(row) for row in value["results"])
    attempted_repairs = sum(
        row.get("repair") is not None for row in value["results"]
    )
    expected_repair_accounting = {
        "eligible": eligible_repairs,
        "attempted": attempted_repairs,
        "skipped_by_cap": eligible_repairs - attempted_repairs,
    }
    if (
        value.get("repair_accounting") != expected_repair_accounting
        or attempted_repairs > MAXIMUM_REPAIR_CALLS
    ):
        raise ValueError(f"Manifest repair accounting does not reconcile: {path}")
    exact_aggregate_costs([value])
    return value


def write(value: dict[str, Any], output: Path | None) -> None:
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
    parser.add_argument("--provider", choices=PROVIDERS)
    parser.add_argument("--env-file", type=Path, default=PACKAGE_ROOT.parents[2] / ".env")
    parser.add_argument("--approval-file", type=Path, default=APPROVAL_PATH)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--summarize", nargs=3, type=Path, metavar=("OPENAI", "GEMINI", "HAIKU"))
    args = parser.parse_args()
    if args.self_test:
        print(json.dumps(self_test(), indent=2, sort_keys=True))
        return
    if args.check:
        actual = deterministic_manifest(deterministic_package())
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
    if args.provider:
        write(run_provider(args.provider, args.env_file, args.approval_file), args.output)
        return
    if args.summarize:
        write(summarize_runs([load_manifest(path) for path in args.summarize]), args.output)
        return
    write(deterministic_package(), args.output)


if __name__ == "__main__":
    main()
