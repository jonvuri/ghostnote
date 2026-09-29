#!/usr/bin/env python3
"""Freeze the second medium-effort task-difficulty calibration."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
import urllib.error
from copy import deepcopy
from decimal import Decimal
from fractions import Fraction
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent
V16_PATH = BENCHMARKS_ROOT / "compact-format-v16" / "benchmark.py"


def load_v16() -> Any:
    spec = importlib.util.spec_from_file_location(
        "ghostnote_compact_format_v17_v16", V16_PATH
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {V16_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


m = load_v16()
v15 = m.v15
v14 = m.v14
base = m.base
core = m.core
transport = m.transport

SCHEMA = "ghostnote-compact-format-difficulty-v17"
CORPUS_SCHEMA = "ghostnote-compact-format-difficulty-corpus-v17"
RUN_ID = "phase8c4d-harder-medium-direction-r1"
COHORT = "harder-medium-direction-r1"
SEED = 71071
VARIANT_OFFSET = 300
ARMS = m.ARMS
COMPACT_ARMS = m.COMPACT_ARMS
DECISION_FAMILIES = m.DECISION_FAMILIES
GUARD_FAMILIES = m.GUARD_FAMILIES
FAMILIES = (*DECISION_FAMILIES, *GUARD_FAMILIES)
UNIQUE_COUNTS = {
    "comprehension-analysis": 10,
    "continuation-affine": 10,
    "document-serialization": 2,
}
REPEATS = {family: 1 for family in FAMILIES}
PROVIDERS = ("openai",)
MODELS = deepcopy(m.MODELS)
KEYS = deepcopy(m.KEYS)
SETTINGS = deepcopy(m.SETTINGS)
MAXIMUM_CALLS = sum(
    UNIQUE_COUNTS[family] * REPEATS[family] * len(ARMS)
    for family in FAMILIES
)
MAXIMUM_TOKEN_COUNT_REQUESTS = 0
RECENT_COST_ESTIMATE = {"openai": Decimal("0.450000")}
PROVIDER_COST_LIMITS = {"openai": Decimal("0.650000")}
MAXIMUM_TOTAL_COST = Decimal("0.650000")
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "direction-r1-approval.json"
HISTORICAL_PACKAGES = (*m.HISTORICAL_PACKAGES, "compact-format-v16")
DEPENDENCIES = (V16_PATH, *m.DEPENDENCIES)
RUN_KIND_PROVIDER = "harder-medium-direction-provider"
RUN_KIND_SUMMARY = "harder-medium-direction-summary"

_v15_protocol_manifest = m._v15_protocol_manifest
_v15_run_plan = m._v15_run_plan
_v16_deterministic_screen = m.deterministic_screen
_v16_task_instruction = m.task_instruction
_v15_scoring_screen = m._v15_scoring_screen
_v15_aggregation_screen = v15.aggregation_screen
_v16_summary_screen = m.summary_screen


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
    for module in (m, v15, v14):
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


def runner_sha256() -> str:
    return base.file_sha256(Path(__file__))


def fraction_text(value: Fraction | str | int) -> str:
    return core.fraction_text(value)


def hard_motif_pair(relation: str, index: int) -> dict[str, Any]:
    pitches = [57, 62, 60, 67, 65, 72, 68, 75]
    pitches = [pitch + index for pitch in pitches]
    starts = ["0", "5/12", "11/12", "19/12", "9/4", "35/12", "43/12", "53/12"]
    durations = ["5/12", "7/12", "1/2", "2/3", "3/4", "5/6", "11/12", "13/12"]
    after_pitches = list(pitches)
    after_starts = list(starts)
    after_durations = list(durations)
    if relation == "transposition":
        after_pitches = [pitch + 7 for pitch in pitches]
    elif relation == "inversion":
        axis = 67 + index
        after_pitches = [2 * axis - pitch for pitch in pitches]
    elif relation == "retrograde-transposition":
        after_pitches = [pitch + 4 for pitch in reversed(pitches)]
    elif relation == "rhythmic-scale":
        factor = Fraction(8, 5)
        after_starts = [fraction_text(core.fraction(value) * factor) for value in starts]
        after_durations = [
            fraction_text(core.fraction(value) * factor) for value in durations
        ]
    elif relation == "rotation":
        after_pitches = pitches[1:] + pitches[:1]
    else:
        after_pitches[1] += 1
        after_pitches[5] -= 2
        after_starts[6] = "15/4"
    return {
        "a_pitches": pitches,
        "a_starts": starts,
        "a_durations": durations,
        "b_pitches": after_pitches,
        "b_starts": after_starts,
        "b_durations": after_durations,
    }


def analysis_case_hashes(task: dict[str, Any]) -> list[str]:
    by_id = {row["id"]: row for row in task["source"]}
    hashes = []
    for index, group in enumerate(task["contract"]["chord_groups"]):
        rows = [by_id[note_id] for note_id in group["note_ids"]]
        base_start = Fraction(index * 4)
        hashes.append(
            core.digest(
                {
                    "chord_pitches": [row["pitch"] for row in rows],
                    "chord_starts": [
                        fraction_text(core.fraction(row["start"]) - base_start)
                        for row in rows
                    ],
                    "chord_durations": [row["duration"] for row in rows],
                    "motif_pair": task["contract"]["motif_pairs"][index],
                    "root_pc": task["expected"]["root_pcs"][index],
                    "bass_pc": task["expected"]["bass_pcs"][index],
                    "quality": task["expected"]["qualities"][index],
                    "inversion": task["expected"]["inversions"][index],
                    "function": task["expected"]["functions"][index],
                    "motif_relation": task["expected"]["motif_relations"][index],
                    "rhythm": task["expected"]["rhythms"][index],
                }
            )
        )
    return hashes


def analysis_task(index: int) -> dict[str, Any]:
    variant = VARIANT_OFFSET + index
    target_starts = (6, 9, 7, 9, 6, 8, 9, 7, 6, 9)
    target = target_starts[index]
    task_seed = 13000 + ((target - variant * 3) % 12)
    core.ANALYSIS_BATCH_COUNTS[COHORT] = (3,) * UNIQUE_COUNTS[
        "comprehension-analysis"
    ]
    task = core.analysis_task(COHORT, variant, task_seed)
    task["contract"]["motif_pairs"] = [
        hard_motif_pair(relation, index * 3 + case_index)
        for case_index, relation in enumerate(task["expected"]["motif_relations"])
    ]
    distractors = [
        core.note(
            f"an-{variant + 1}-x-{position + 1}",
            "pad" if position % 2 else "guide",
            Fraction(1, 6) + Fraction(position * 17, 12),
            Fraction(2 + position % 4, 3),
            45 + ((index * 7 + position * 11) % 35),
            58 + position,
        )
        for position in range(8)
    ]
    task["source"] = core.sort_notes([*task["source"], *distractors])
    task["case_semantic_sha256"] = analysis_case_hashes(task)
    return v15.refresh_task(task)


def voice_affine_expected(
    source: list[dict[str, Any]], contract: dict[str, Any]
) -> list[dict[str, Any]]:
    ordered = core.sort_notes(source)
    first_by_voice = {
        voice: min(
            core.fraction(row["start"])
            for row in ordered
            if row["voice"] == voice
        )
        for voice in contract["voice_rules"]
    }
    result = []
    for index, row in enumerate(ordered):
        rule = contract["voice_rules"][row["voice"]]
        pitch = 2 * rule["axis"] - row["pitch"] + rule["semitones"]
        relative = core.fraction(row["start"]) - first_by_voice[row["voice"]]
        start = core.fraction(rule["output_start"]) + relative * core.fraction(
            rule["rhythmic_factor"]
        )
        duration = core.fraction(row["duration"]) * core.fraction(
            rule["rhythmic_factor"]
        )
        result.append(
            core.note(
                contract["output_ids"][index],
                row["voice"],
                start,
                duration,
                pitch,
                row["velocity"],
            )
        )
    return core.sort_notes(result)


def affine_task(index: int) -> dict[str, Any]:
    variant = VARIANT_OFFSET + UNIQUE_COUNTS["comprehension-analysis"] + index
    starts = (
        Fraction(5, 12),
        Fraction(11, 12),
        Fraction(17, 12),
        Fraction(13, 6),
        Fraction(35, 12),
        Fraction(23, 6),
    )
    durations = (
        Fraction(5, 12),
        Fraction(7, 12),
        Fraction(11, 12),
        Fraction(2, 3),
        Fraction(5, 6),
        Fraction(13, 12),
    )
    voices = ("bass", "lead", "inner", "lead", "bass", "inner")
    offsets = (0, 13, 7, 17, 5, 11)
    base_pitch = 48 + index % 5
    source = core.sort_notes(
        [
            core.note(
                f"mt-src-{variant + 1}-{position + 1}",
                voices[position],
                starts[position],
                durations[position],
                base_pitch + offsets[position],
                70 + ((index * 3 + position * 5) % 25),
            )
            for position in range(6)
        ]
    )
    factors = ("7/5", "5/6", "9/7", "11/8", "8/5")
    semitones = {
        "bass": (-4, 3, -5, 2, -3)[index % 5],
        "inner": (5, -2, 4, -3, 6)[index % 5],
        "lead": (-1, 6, -4, 5, -2)[index % 5],
    }
    contract = {
        "operation": "voice-conditioned-affine",
        "output_ids": [
            f"mt-out-{variant + 1}-{position + 1}"
            for position in range(len(source))
        ],
        "voice_rules": {
            "bass": {
                "axis": 52 + index % 3,
                "semitones": semitones["bass"],
                "output_start": fraction_text(Fraction(97 + index, 12)),
                "rhythmic_factor": factors[index % len(factors)],
            },
            "inner": {
                "axis": 62 + index % 3,
                "semitones": semitones["inner"],
                "output_start": fraction_text(Fraction(85 + index, 12)),
                "rhythmic_factor": factors[(index + 1) % len(factors)],
            },
            "lead": {
                "axis": 71 + index % 3,
                "semitones": semitones["lead"],
                "output_start": fraction_text(Fraction(73 + index, 12)),
                "rhythmic_factor": factors[(index + 2) % len(factors)],
            },
        },
    }
    task = core.finish_task(
        COHORT,
        "continuation-motif",
        variant,
        {
            "source": source,
            "contract": contract,
            "expected": voice_affine_expected(source, contract),
        },
    )
    task["family"] = "continuation-affine"
    return v15.refresh_task(task)


def serialization_task(index: int) -> dict[str, Any]:
    source = affine_task(index)
    variant = VARIANT_OFFSET + 20 + index
    return v15.refresh_task(
        {
            "schema": core.SCHEMA,
            "id": f"{COHORT}-document-serialization-v{variant}",
            "cohort": COHORT,
            "family": "document-serialization",
            "variant": variant,
            "origin": "generated",
            "license": "MIT",
            "expected": deepcopy(source["expected"]),
            "target_notes": deepcopy(source["expected"]),
        }
    )


def make_corpus() -> dict[str, Any]:
    value = {
        "schema": CORPUS_SCHEMA,
        "cohort": COHORT,
        "license": "MIT",
        "fixtures": {
            "comprehension-analysis": [
                analysis_task(index)
                for index in range(UNIQUE_COUNTS["comprehension-analysis"])
            ],
            "continuation-affine": [
                affine_task(index)
                for index in range(UNIQUE_COUNTS["continuation-affine"])
            ],
            "document-serialization": [
                serialization_task(index)
                for index in range(UNIQUE_COUNTS["document-serialization"])
            ],
        },
    }
    value["sha256"] = core.digest(value)
    return value


def task_difficulty(task: dict[str, Any]) -> str:
    return (
        "positive-control"
        if task["family"] == "document-serialization"
        else "harder-medium-effort"
    )


def task_instruction(arm: str, task: dict[str, Any]) -> str:
    if task["family"] != "continuation-affine":
        return _v16_task_instruction(arm, task)
    contract = task["contract"]
    rules = []
    for voice in ("bass", "inner", "lead"):
        rule = contract["voice_rules"][voice]
        rules.append(
            f"{voice}(axis={rule['axis']},semitones={rule['semitones']},"
            f"output_start={rule['output_start']},"
            f"rhythmic_factor={rule['rhythmic_factor']})"
        )
    count = len(task["source"])
    return (
        f"Apply the voice-conditioned affine operation to all {count} source "
        "events in canonical source order. Assign output IDs "
        + ",".join(contract["output_ids"])
        + " in that order. Select the rule for the source voice. Calculate "
        "pitch=(2*axis)-source_pitch+semitones. First multiply axis by 2. "
        "Then subtract source_pitch. Then add semitones. For example, axis=60, "
        "source_pitch=64, and semitones=2 gives pitch=58. Calculate "
        "start=output_start+(source_start-first_voice_start)*rhythmic_factor, "
        "where first_voice_start is the earliest source start for that voice. "
        "Calculate duration=source_duration*rhythmic_factor. Rules: "
        + "; ".join(rules)
        + ". Preserve voice and velocity. Sort the output notes canonically "
        f"after all calculations. Return only the {count} output notes."
    )


def cost_guard_manifest() -> dict[str, Any]:
    return {
        "recent_cost_estimate_usd": {"openai": 0.45},
        "recent_cost_estimate_total_usd": 0.45,
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
    value = {
        "outcomes": [
            "expand-confirmation",
            "revise-harder",
            "revise-easier",
            "invalid",
        ],
        "primary_measure": "global component accuracy by family and arm",
        "target_accuracy": 0.90,
        "upper_directional_bound": 0.95,
        "floor_guard": 0.60,
        "minimum_provider_completion": 0.95,
        "minimum_scored_cell_coverage": 0.75,
        "musical_thresholds": None,
        "exact_json_role": "A valid format. It has no capability-control gate.",
        "operator_criterion": "Use the frozen directional rule only.",
        "directional_resolution": (
            "Ten unique prompts per arm and family give a 10-point prompt-level "
            "step. Case and component reports remain primary; this stage makes "
            "no population-effect claim."
        ),
        "expand_rule": (
            "Expand only when both decision families have median arm accuracy "
            "from 0.60 through 0.95, all arms remain structurally valid on at "
            "least 90 percent of scored rows, and no operational gate fails."
        ),
        "selection_authority": (
            "This calibration can tune task difficulty only. It cannot select "
            "a format or authorize Phase 8c4e."
        ),
    }
    value["cross_provider_gate"] = (
        "Run OpenAI only. A Haiku supplement is permitted only after "
        "expand-confirmation and needs a new frozen plan and explicit approval."
    )
    return value


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
            "Stop after OpenAI. Do not run Haiku when the decision is "
            "revise-harder, revise-easier, or invalid. A promising result still "
            "needs a separate Haiku plan and explicit approval."
        ),
    }


def protocol_manifest() -> dict[str, Any]:
    value = _v15_protocol_manifest()
    value["run_id"] = RUN_ID
    value["run_kind"] = "harder-medium-direction-protocol"
    value["difficulty_ladder"] = {
        "baseline": "V16 medium-effort directional stage.",
        "change_scope": (
            "Increase task content complexity only. Keep formats, component "
            "scoring, OpenAI settings, scheduling, and failure policy stable."
        ),
        "analysis": (
            "Three independent hard chord and eight-value motif cases per "
            "prompt. Source events and eight distractors are interleaved."
        ),
        "affine": (
            "Six interleaved multi-voice notes use explicit voice-conditioned "
            "pitch, start, and duration parameters, then canonical output sort."
        ),
        "serialization": "Literal serialization remains a positive control.",
    }
    value["stage"] = {
        "name": "OpenAI harder directional screen",
        "providers": ["openai"],
        "unique_prompts_per_arm_and_decision_family": 10,
        "repeats": 1,
        "maximum_messages": MAXIMUM_CALLS,
        "haiku": (
            "Excluded. A promising OpenAI result needs a new supplement and "
            "explicit approval."
        ),
        "confirmation": "Requires a new frozen cohort and explicit approval.",
    }
    value["models"] = {"openai": MODELS["openai"]}
    value["declared_settings"] = {"openai": SETTINGS["openai"]}
    value["effective_request_settings"] = {
        "openai": v15.effective_request_settings("openai")
    }
    value["calls"] = {
        "maximum_openai_messages": MAXIMUM_CALLS,
        "maximum_all_providers": MAXIMUM_CALLS,
        "automatic_retries": 0,
        "repairs": 0,
        "haiku_messages": 0,
    }
    value["cost_guard"] = cost_guard_manifest()
    value["decision_rule"] = decision_rule()
    value["stopping_rule"] = stopping_rule()
    value["runner_sha256"] = runner_sha256()
    value["sha256"] = core.digest(
        {name: item for name, item in value.items() if name != "sha256"}
    )
    return value


def run_plan() -> dict[str, Any]:
    value = _v15_run_plan()
    protocol = protocol_manifest()
    value["run_id"] = RUN_ID
    value["run_kind"] = "harder-medium-direction-plan"
    value["protocol_sha256"] = protocol["sha256"]
    for name in (
        "difficulty_ladder",
        "stage",
        "models",
        "declared_settings",
        "effective_request_settings",
        "calls",
        "cost_guard",
        "decision_rule",
        "stopping_rule",
        "runner_sha256",
    ):
        value[name] = protocol[name]
    value["schedule_sha256"] = {
        "openai": core.digest(protocol["prompts"]["openai"])
    }
    value["approval"] = "pending"
    value["sha256"] = core.digest(
        {name: item for name, item in value.items() if name != "sha256"}
    )
    return value


def prompt_visibility_screen() -> dict[str, Any]:
    rows = []
    corpus = make_corpus()
    for family in FAMILIES:
        task = corpus["fixtures"][family][0]
        for arm in ARMS:
            prompt = v15.prompt_for({"arm": arm, "family": family, "task": task})
            required = [f"Difficulty level: {task_difficulty(task)}."]
            if family == "comprehension-analysis":
                required.extend(
                    [
                        "Analyze 3 ordered chord groups",
                        "chord_groups",
                        "motif_pairs",
                    ]
                )
            elif family == "continuation-affine":
                required.extend(
                    [
                        "voice-conditioned affine operation",
                        "pitch=(2*axis)-source_pitch+semitones",
                        "axis=60, source_pitch=64, and semitones=2 gives pitch=58",
                        "first_voice_start",
                        "bass(axis=",
                        "inner(axis=",
                        "lead(axis=",
                        "Sort the output notes canonically",
                    ]
                )
            elif arm == "exact-object-json":
                required.extend(
                    [
                        'base_sha256 to the string "none"',
                        f'source_id to the exact string "{task["id"]}"',
                    ]
                )
            missing = [fragment for fragment in required if fragment not in prompt]
            rows.append({"family": family, "arm": arm, "missing": missing})
    return {
        "rows": rows,
        "all_visible": all(not row["missing"] for row in rows),
    }


def scoring_screen() -> dict[str, Any]:
    value = _v15_scoring_screen()
    value["checks"].pop("analysis-ladder-counts", None)
    corpus = make_corpus()
    analysis = corpus["fixtures"]["comprehension-analysis"]
    affine = corpus["fixtures"]["continuation-affine"]
    value["checks"].update(
        {
            "analysis-has-three-cases-per-prompt": all(
                task["contract"]["case_count"] == 3 for task in analysis
            ),
            "analysis-reference-contracts-pass": all(
                all(core.analysis_fixture_checks(task).values()) for task in analysis
            ),
            "analysis-motifs-have-eight-values": all(
                len(pair["a_pitches"]) == 8
                for task in analysis
                for pair in task["contract"]["motif_pairs"]
            ),
            "affine-voice-rules-cover-source": all(
                set(task["contract"]["voice_rules"])
                == {row["voice"] for row in task["source"]}
                for task in affine
            ),
            "affine-reference-formula-passes": all(
                task["expected"]
                == voice_affine_expected(task["source"], task["contract"])
                for task in affine
            ),
            "affine-output-requires-resort": all(
                [row["id"] for row in task["expected"]]
                != task["contract"]["output_ids"]
                for task in affine
            ),
        }
    )
    value["all_pass"] = all(value["checks"].values())
    return value


def aggregation_screen() -> dict[str, Any]:
    value = _v15_aggregation_screen()
    cases = make_corpus()["fixtures"]["comprehension-analysis"][0]["contract"][
        "case_count"
    ]
    metrics = value["values"]
    value["all_pass"] = (
        metrics["case_count"] == cases * 2
        and metrics["global_component_accuracy"] == 0.5
        and metrics["average_per_case_component_accuracy"] == 0.5
        and metrics["perfect_cases"] == cases
        and metrics["perfect_case_rate"] == 0.5
    )
    return value


def provider_accounting_screen() -> dict[str, Any]:
    raw = {
        "id": "synthetic-openai",
        "model": MODELS["openai"],
        "choices": [{"finish_reason": "stop", "message": {}}],
        "usage": {
            "prompt_tokens": 1,
            "completion_tokens": 0,
            "prompt_tokens_details": {"cached_tokens": 0},
            "completion_tokens_details": {"reasoning_tokens": 0},
        },
    }
    original = transport.post_json
    guard = v14.CostGuard("openai")
    captured = None
    try:
        transport.post_json = lambda *_args, **_kwargs: raw
        try:
            v15.one_call("openai", "synthetic-key", v14.jobs("openai")[0], guard)
        except v14.ProviderCompletedError as error:
            captured = error.call
    finally:
        transport.post_json = original
    checks = {
        "malformed-response-is-provider-completed": captured is not None,
        "raw-response-is-retained": captured is not None
        and captured.get("raw_response_sha256") == core.digest(raw),
        "usage-and-cost-are-retained": captured is not None
        and captured.get("usage", {}).get("input_tokens") == 1
        and captured.get("cost_usd") is not None,
        "settled-call-is-not-failed-reservation": guard.message_attempts == 1
        and guard.failed_reservations == 0
        and guard.settled_cost > 0,
    }
    return {"checks": checks, "all_pass": all(checks.values())}


def deterministic_screen() -> dict[str, Any]:
    value = _v16_deterministic_screen()
    value["historical_snapshot_excludes_current"] = (
        "compact-format-v17" not in HISTORICAL_PACKAGES
    )
    value["runner_sha256"] = runner_sha256()
    value["haiku_excluded"] = True
    value["all_checks_pass"] = all(
        (
            all(
                count == MAXIMUM_CALLS
                for count in value["job_count_per_provider"].values()
            ),
            value["cohort_audit"]["internal_full_duplicates"] == 0,
            value["cohort_audit"]["internal_semantic_duplicates"] == 0,
            value["cohort_audit"]["prior_full_overlap"] == 0,
            value["cohort_audit"]["prior_semantic_overlap"] == 0,
            value["cohort_audit"]["prior_analysis_case_overlap"] == 0,
            value["visibility"]["all_visible"],
            value["scoring"]["all_pass"],
            value["aggregation"]["all_pass"],
            value["summary"]["all_pass"],
            value["cost"]["all_pass"],
            value["preflight"]["all_pass"],
            value["provider_accounting"]["all_pass"],
            value["all_blocks_have_all_arms"],
            value["planned_sequences_are_contiguous"],
            value["all_requests_fit"],
            value["historical_snapshot_excludes_current"],
            value["retired_arms_absent"],
            value["haiku_excluded"],
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
        "candidate_sha256": v15.candidate_hashes(),
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
        raise ValueError("Approval does not match the frozen v17 plan")
    if (
        value.get("status") != "approved"
        or not isinstance(value.get("operator_statement"), str)
        or not value["operator_statement"].strip()
    ):
        raise ValueError("The v17 OpenAI run needs explicit approval")
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
        "decision_rule": decision_rule,
        "stopping_rule": stopping_rule,
        "protocol_manifest": protocol_manifest,
        "run_plan": run_plan,
        "prompt_visibility_screen": prompt_visibility_screen,
        "scoring_screen": scoring_screen,
        "aggregation_screen": aggregation_screen,
        "summary_screen": _v16_summary_screen,
        "provider_accounting_screen": provider_accounting_screen,
        "deterministic_screen": deterministic_screen,
        "deterministic_manifest": deterministic_manifest,
        "validate_approval": validate_approval,
    }
    for module in (m, v15, v14):
        for name, value in overrides.items():
            setattr(module, name, value)


install_overrides()


def run_provider(env_file: Path, approval_file: Path) -> dict[str, Any]:
    original = transport.post_json
    transport.post_json = post_json_with_error_evidence
    try:
        return m.run_provider("openai", env_file, approval_file)
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
        manifest = v15.load_manifest(args.summarize[0])
        write_new(m.summarize_runs([manifest]), args.output)
        return
    raise SystemExit("Select --self-test, --check, --print-plan, --provider, or --summarize")


if __name__ == "__main__":
    main()
