#!/usr/bin/env python3
"""Freeze the first medium-effort task-difficulty calibration."""

from __future__ import annotations

import argparse
import importlib.util
import json
import random
from copy import deepcopy
from decimal import Decimal
from fractions import Fraction
from pathlib import Path
from statistics import median
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


v15 = load_module(
    "ghostnote_compact_format_v16_v15",
    BENCHMARKS_ROOT / "compact-format-v15" / "benchmark.py",
)
v14 = v15.v14
base = v15.base
core = v15.core
transport = v15.transport

SCHEMA = "ghostnote-compact-format-difficulty-v16"
CORPUS_SCHEMA = "ghostnote-compact-format-difficulty-corpus-v16"
RUN_ID = "phase8c4d-medium-difficulty-direction-r1"
COHORT = "medium-difficulty-direction-r1"
SEED = 61051
VARIANT_OFFSET = 240
ARMS = v15.ARMS
COMPACT_ARMS = v15.COMPACT_ARMS
DECISION_FAMILIES = v15.DECISION_FAMILIES
GUARD_FAMILIES = v15.GUARD_FAMILIES
FAMILIES = (*DECISION_FAMILIES, *GUARD_FAMILIES)
UNIQUE_COUNTS = {
    "comprehension-analysis": 10,
    "continuation-affine": 10,
    "document-serialization": 2,
}
REPEATS = {family: 1 for family in FAMILIES}
PROVIDERS = ("gemini",)
MODELS = deepcopy(v15.MODELS)
KEYS = deepcopy(v15.KEYS)
SETTINGS = deepcopy(v15.SETTINGS)
MAXIMUM_CALLS = sum(
    UNIQUE_COUNTS[family] * REPEATS[family] * len(ARMS)
    for family in FAMILIES
)
MAXIMUM_TOKEN_COUNT_REQUESTS = 0
RECENT_COST_ESTIMATE = {
    **deepcopy(v15.RECENT_COST_ESTIMATE),
    "gemini": Decimal("0.500000"),
}
PROVIDER_COST_LIMITS = {
    **deepcopy(v15.PROVIDER_COST_LIMITS),
    "gemini": Decimal("0.650000"),
}
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "direction-r1-approval.json"
HISTORICAL_PACKAGES = (*v15.HISTORICAL_PACKAGES, "compact-format-v15")
DEPENDENCIES = (
    BENCHMARKS_ROOT / "compact-format-v15" / "benchmark.py",
    *v15.DEPENDENCIES,
)
RUN_KIND_PROVIDER = "medium-difficulty-direction-provider"
RUN_KIND_SUMMARY = "medium-difficulty-direction-summary"

_v15_protocol_manifest = v15.protocol_manifest
_v15_run_plan = v15.run_plan
_v15_deterministic_screen = v15.deterministic_screen
_v15_deterministic_manifest = v15.deterministic_manifest
_v15_summarize_runs = v15.summarize_runs
_v15_task_instruction = v15.task_instruction
_v15_scoring_screen = v15.scoring_screen


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
        provider: {
            name: value
            for name, value in SETTINGS[provider].items()
            if name != "temperature"
        }
        for provider in SETTINGS
    }


configure_modules()


def fraction_text(value: Fraction | str | int) -> str:
    return core.fraction_text(value)


def hard_motif_pair(relation: str, index: int) -> dict[str, Any]:
    pitches = [58, 63, 61, 68, 64, 71, 66, 73]
    pitches = [pitch + index % 3 for pitch in pitches]
    starts = ["0", "1/3", "5/6", "17/12", "2", "31/12", "10/3", "47/12"]
    durations = ["1/3", "1/2", "5/12", "7/12", "2/3", "3/4", "5/6", "11/12"]
    after_pitches = list(pitches)
    after_starts = list(starts)
    after_durations = list(durations)
    if relation == "transposition":
        after_pitches = [pitch + 5 for pitch in pitches]
    elif relation == "inversion":
        axis = 67 + index % 2
        after_pitches = [2 * axis - pitch for pitch in pitches]
    elif relation == "retrograde-transposition":
        after_pitches = [pitch + 3 for pitch in reversed(pitches)]
    elif relation == "rhythmic-scale":
        factor = Fraction(7, 5)
        after_starts = [fraction_text(core.fraction(value) * factor) for value in starts]
        after_durations = [
            fraction_text(core.fraction(value) * factor) for value in durations
        ]
    elif relation == "rotation":
        after_pitches = pitches[1:] + pitches[:1]
    else:
        after_pitches[2] += 1
        after_pitches[6] -= 2
        after_starts[4] = "25/12"
    return {
        "a_pitches": pitches,
        "a_starts": starts,
        "a_durations": durations,
        "b_pitches": after_pitches,
        "b_starts": after_starts,
        "b_durations": after_durations,
    }


def analysis_task(index: int) -> dict[str, Any]:
    variant = VARIANT_OFFSET + index
    target_templates = (6, 7, 8, 9, 10, 11, 7, 8, 9, 11)
    target = target_templates[index]
    task_seed = 12000 + ((target - variant * 3) % 12)
    core.ANALYSIS_BATCH_COUNTS[COHORT] = (1,) * UNIQUE_COUNTS[
        "comprehension-analysis"
    ]
    task = core.analysis_task(COHORT, variant, task_seed)
    relation = task["expected"]["motif_relations"][0]
    task["contract"]["motif_pairs"] = [hard_motif_pair(relation, index)]
    distractors = [
        core.note(
            f"an-{variant + 1}-x-{position + 1}",
            "pad" if position % 2 else "guide",
            Fraction(position, 3) + Fraction(1, 6),
            Fraction(2 + position % 3, 3),
            47 + ((index * 5 + position * 7) % 31),
            60 + position,
        )
        for position in range(8)
    ]
    task["source"] = core.sort_notes([*task["source"], *distractors])
    task["case_semantic_sha256"] = [
        core.digest(
            {
                "source": task["source"],
                "contract": task["contract"],
                "expected": task["expected"],
            }
        )
    ]
    return v15.refresh_task(task)


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
                71 + ((index * 3 + position * 5) % 24),
            )
            for position in range(6)
        ]
    )
    factors = ("7/5", "5/6", "9/7", "11/8", "8/5")
    contract = {
        "operation": "compound-affine",
        "output_start": fraction_text(Fraction(73 + index, 12)),
        "output_ids": [
            f"mt-out-{variant + 1}-{position + 1}"
            for position in range(len(source))
        ],
        "axis": 63 + index % 4,
        "semitones": (-5, 7, -4, 6, -3)[index % 5],
        "rhythmic_factor": factors[index % len(factors)],
    }
    task = core.finish_task(
        COHORT,
        "continuation-motif",
        variant,
        {
            "source": source,
            "contract": contract,
            "expected": core.motif_expected(source, contract),
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
        else "tuned-medium-effort"
    )


def task_instruction(arm: str, task: dict[str, Any]) -> str:
    if task["family"] != "continuation-affine":
        return _v15_task_instruction(arm, task)
    contract = task["contract"]
    count = len(task["source"])
    return (
        f"Apply one compound-affine operation to all {count} source events in "
        "canonical order. Use output IDs "
        + ",".join(contract["output_ids"])
        + " in the same order. Calculate pitch=(2*axis)-source_pitch+semitones. "
        "First multiply axis by 2. Then subtract source_pitch. Then add semitones. "
        "For example, axis=60, source_pitch=64, and semitones=2 gives pitch=58. "
        f"For this task, axis={contract['axis']} and "
        f"semitones={contract['semitones']}. Set start={contract['output_start']}+"
        "(source_start-first_source_start)*"
        f"{contract['rhythmic_factor']} and duration=source_duration*"
        f"{contract['rhythmic_factor']}. Preserve voice and velocity. Return "
        f"only the {count} output notes."
    )


def decision_rule() -> dict[str, Any]:
    return {
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
            "This calibration can tune task difficulty only. It cannot select a "
            "format or authorize Phase 8c4e."
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
        "after_directional_stage": (
            "Do not run another provider or a confirmation cohort automatically."
        ),
    }


def protocol_manifest() -> dict[str, Any]:
    value = _v15_protocol_manifest()
    value["run_kind"] = "medium-difficulty-direction-protocol"
    value["difficulty_ladder"] = {
        "baseline": "V15 medium-effort validity ladder.",
        "change_scope": (
            "Increase semantic and arithmetic task complexity only. Keep formats, "
            "scoring, provider setting, schedules, and failure policy stable."
        ),
        "analysis": (
            "One hard chord and eight-value motif case per prompt, with eight "
            "represented distractor notes."
        ),
        "affine": (
            "Six interleaved multi-voice notes with nontrivial rational timing. "
            "The repaired affine formula is unchanged."
        ),
        "serialization": "Literal serialization remains a positive control.",
    }
    value["stage"] = {
        "name": "Gemini directional screen",
        "providers": list(PROVIDERS),
        "unique_prompts_per_arm_and_decision_family": 10,
        "repeats": 1,
        "maximum_messages": MAXIMUM_CALLS,
        "confirmation": "Requires a new frozen cohort and explicit approval.",
    }
    value["models"] = {provider: MODELS[provider] for provider in PROVIDERS}
    value["declared_settings"] = {
        provider: SETTINGS[provider] for provider in PROVIDERS
    }
    value["effective_request_settings"] = {
        provider: v15.effective_request_settings(provider) for provider in PROVIDERS
    }
    value["cost_guard"]["recent_cost_estimate_usd"] = {"gemini": 0.5}
    value["cost_guard"]["recent_cost_estimate_total_usd"] = 0.5
    value["cost_guard"]["maximum_provider_cost_usd"] = {"gemini": 0.65}
    value["cost_guard"]["maximum_total_cost_usd"] = 0.65
    value["cost_guard"]["maximum_call_cost_usd"] = {
        "gemini": base.rounded_usd(base.maximum_call_cost("gemini"))
    }
    value["decision_rule"] = decision_rule()
    value["stopping_rule"] = stopping_rule()
    value["sha256"] = core.digest(
        {name: item for name, item in value.items() if name != "sha256"}
    )
    return value


def run_plan() -> dict[str, Any]:
    value = _v15_run_plan()
    value["run_kind"] = "medium-difficulty-direction-plan"
    value["difficulty_ladder"] = protocol_manifest()["difficulty_ladder"]
    value["stage"] = protocol_manifest()["stage"]
    value["models"] = {provider: MODELS[provider] for provider in PROVIDERS}
    value["declared_settings"] = {
        provider: SETTINGS[provider] for provider in PROVIDERS
    }
    value["effective_request_settings"] = {
        provider: v15.effective_request_settings(provider) for provider in PROVIDERS
    }
    value["decision_rule"] = decision_rule()
    value["stopping_rule"] = stopping_rule()
    value["approval"] = "pending"
    value["sha256"] = core.digest(
        {name: item for name, item in value.items() if name != "sha256"}
    )
    return value


def directional_decision(summary: dict[str, Any]) -> dict[str, Any]:
    provider = summary["providers"][0]
    rows = []
    for family in DECISION_FAMILIES:
        cells = [
            cell
            for cell in provider["by_family_difficulty_arm"]
            if cell["family"] == family
        ]
        accuracies = [cell["global_component_accuracy"] for cell in cells]
        structural = [cell["structural_parse_rate_scored"] for cell in cells]
        rows.append(
            {
                "family": family,
                "arm_accuracy": {
                    cell["arm"]: cell["global_component_accuracy"] for cell in cells
                },
                "median_arm_accuracy": round(median(accuracies), 6),
                "minimum_structural_rate": min(structural),
            }
        )
    if not provider["completion_pass"] or not provider["cell_coverage_pass"]:
        decision = "invalid"
    elif any(row["minimum_structural_rate"] < 0.90 for row in rows):
        decision = "invalid"
    elif any(row["median_arm_accuracy"] > 0.95 for row in rows):
        decision = "revise-harder"
    elif any(row["median_arm_accuracy"] < 0.60 for row in rows):
        decision = "revise-easier"
    else:
        decision = "expand-confirmation"
    return {"decision": decision, "family_diagnostics": rows}


def summarize_runs(runs: list[dict[str, Any]]) -> dict[str, Any]:
    value = _v15_summarize_runs(runs)
    tuning = directional_decision(value)
    value["decision"] = tuning["decision"]
    value["difficulty_tuning"] = tuning
    value["selection_authority"] = decision_rule()["selection_authority"]
    value["sha256"] = core.digest(
        {name: item for name, item in value.items() if name != "sha256"}
    )
    return value


def deterministic_screen() -> dict[str, Any]:
    value = _v15_deterministic_screen()
    value["historical_snapshot_excludes_current"] = (
        "compact-format-v16" not in HISTORICAL_PACKAGES
    )
    audit = value["cohort_audit"]
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
    value["all_checks_pass"] = all(
        (
            all(count == MAXIMUM_CALLS for count in value["job_count_per_provider"].values()),
            freshness,
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
        )
    )
    value["sha256"] = core.digest(
        {name: item for name, item in value.items() if name != "sha256"}
    )
    return value


def scoring_screen() -> dict[str, Any]:
    value = _v15_scoring_screen()
    value["checks"].pop("analysis-ladder-counts", None)
    corpus = make_corpus()
    value["checks"]["analysis-has-one-case-per-prompt"] = all(
        task["contract"]["case_count"] == 1
        for task in corpus["fixtures"]["comprehension-analysis"]
    )
    value["checks"]["analysis-reference-contracts-pass"] = all(
        all(core.analysis_fixture_checks(task).values())
        for task in corpus["fixtures"]["comprehension-analysis"]
    )
    value["checks"]["analysis-motifs-have-eight-values"] = all(
        len(task["contract"]["motif_pairs"][0]["a_pitches"]) == 8
        for task in corpus["fixtures"]["comprehension-analysis"]
    )
    value["checks"]["affine-formula-is-unchanged"] = all(
        task["expected"] == core.motif_expected(task["source"], task["contract"])
        for task in corpus["fixtures"]["continuation-affine"]
    )
    value["all_pass"] = all(value["checks"].values())
    return value


def summary_screen() -> dict[str, Any]:
    runs = []
    for provider in PROVIDERS:
        rows = []
        for job in v14.jobs(provider):
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
        runs.append(
            {
                "provider": provider,
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
        )
    summary = _v15_summarize_runs(runs)
    cells = [
        cell
        for provider in summary["providers"]
        for cell in provider["by_family_difficulty_arm"]
    ]
    required = {
        "global_component_accuracy",
        "average_per_case_component_accuracy",
        "perfect_cases",
        "perfect_case_rate",
    }
    checks = {
        "perfect-reference-summary-is-valid": summary["decision"] == "operator-review",
        "all_primary_cells_present": len(cells) == len(PROVIDERS) * 9,
        "all_component_reports_present": all(required <= set(cell) for cell in cells),
        "all_perfect_references_score_one": all(
            cell["global_component_accuracy"] == 1.0 for cell in cells
        ),
    }
    return {"checks": checks, "all_pass": all(checks.values())}


def deterministic_manifest() -> dict[str, Any]:
    value = _v15_deterministic_manifest()
    value["sha256"] = core.digest(
        {name: item for name, item in value.items() if name != "sha256"}
    )
    return value


def provider_accounting_screen() -> dict[str, Any]:
    raw = {
        "modelVersion": MODELS["gemini"],
        "candidates": [{"finishReason": "STOP", "content": {"parts": []}}],
        "usageMetadata": {
            "promptTokenCount": 1,
            "candidatesTokenCount": 0,
            "thoughtsTokenCount": 0,
        },
    }
    original = transport.post_json
    guard = v14.CostGuard("gemini")
    captured = None
    try:
        transport.post_json = lambda *_args, **_kwargs: raw
        try:
            v15.one_call("gemini", "synthetic-key", v14.jobs("gemini")[0], guard)
        except v14.ProviderCompletedError as error:
            captured = error.call
    finally:
        transport.post_json = original
    checks = {
        "malformed_response_is_provider_completed": captured is not None,
        "raw_response_is_retained": captured is not None
        and captured.get("raw_response_sha256") == core.digest(raw),
        "usage_and_cost_are_retained": captured is not None
        and captured.get("usage", {}).get("input_tokens") == 1
        and captured.get("cost_usd") is not None,
        "settled_call_is_not_failed_reservation": guard.message_attempts == 1
        and guard.failed_reservations == 0
        and guard.settled_cost > 0,
    }
    return {"checks": checks, "all_pass": all(checks.values())}


def install_overrides() -> None:
    overrides = {
        "make_corpus": make_corpus,
        "task_difficulty": task_difficulty,
        "task_instruction": task_instruction,
        "decision_rule": decision_rule,
        "stopping_rule": stopping_rule,
        "protocol_manifest": protocol_manifest,
        "run_plan": run_plan,
        "summarize_runs": summarize_runs,
        "deterministic_screen": deterministic_screen,
        "deterministic_manifest": deterministic_manifest,
        "provider_accounting_screen": provider_accounting_screen,
        "scoring_screen": scoring_screen,
        "summary_screen": summary_screen,
    }
    for module in (v15, v14):
        for name, value in overrides.items():
            setattr(module, name, value)


install_overrides()


def write_new(value: dict[str, Any], output: Path | None) -> None:
    text = json.dumps(value, indent=2, sort_keys=True) + "\n"
    if output is None:
        print(text, end="")
        return
    if output.exists():
        raise FileExistsError(f"Refusing to replace: {output}")
    output.write_text(text)


def run_provider(provider: str, env_file: Path, approval_file: Path) -> dict[str, Any]:
    inherited_keys = v14.KEYS
    v14.KEYS = {provider: KEYS[provider]}
    try:
        return v15.run_provider(provider, env_file, approval_file)
    finally:
        v14.KEYS = inherited_keys


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
    parser.add_argument("--summarize", nargs=1, type=Path, metavar=("GEMINI",))
    args = parser.parse_args()
    if args.self_test:
        screen = deterministic_screen()
        if not screen["all_checks_pass"]:
            raise SystemExit(json.dumps(screen, indent=2, sort_keys=True))
        print(json.dumps({"pass": True, **deterministic_manifest()}, indent=2, sort_keys=True))
        return
    if args.check:
        actual = deterministic_manifest()
        expected = json.loads(args.check.read_text())
        if actual != expected:
            raise SystemExit("Deterministic mismatch")
        print(json.dumps({"pass": True, **actual}, indent=2, sort_keys=True))
        return
    if args.print_plan:
        print(json.dumps(run_plan(), indent=2, sort_keys=True))
        return
    if args.provider:
        write_new(
            run_provider(args.provider, args.env_file, args.approval_file),
            args.output,
        )
        return
    if args.summarize:
        write_new(summarize_runs([v15.load_manifest(args.summarize[0])]), args.output)
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
