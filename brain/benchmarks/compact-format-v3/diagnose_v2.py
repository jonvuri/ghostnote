#!/usr/bin/env python3
"""Re-score frozen Phase 8c2 outputs as a labeled diagnostic."""

from __future__ import annotations

import argparse
import itertools
import json
import sys
from collections import defaultdict
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PACKAGE_ROOT))
import benchmark  # type: ignore  # noqa: E402
import core  # type: ignore  # noqa: E402
sys.path.pop(0)


SCHEMA = "ghostnote-compact-format-v2-diagnostic-v3"
V2_RUNS = core.V2_ROOT / "runs"
INITIAL_PATHS = tuple(V2_RUNS / f"2026-09-27-{provider}.json" for provider in core.v2.PROVIDERS)
HOLDOUT_PATHS = tuple(V2_RUNS / f"2026-09-27-holdout-{provider}.json" for provider in core.v2.PROVIDERS)


def load_holdout() -> Any:
    return benchmark.load_old_holdout()


def pitch_groups(values: list[dict[str, Any]]) -> dict[Fraction, list[int]]:
    result: dict[Fraction, list[int]] = defaultdict(list)
    for value in values:
        result[core.fraction(value["start"])].append(int(value["pitch"]))
    return {start: sorted(pitches) for start, pitches in sorted(result.items())}


def old_nearest_choices(source: list[int], previous: list[int], low: int, high: int) -> list[list[int]]:
    choices = []
    for shifts in itertools.product((-12, 0, 12), repeat=len(source)):
        pitches = sorted(pitch + shift for pitch, shift in zip(sorted(source), shifts))
        if len(set(pitches)) != len(source) or pitches[0] < low or pitches[-1] > high:
            continue
        choices.append(pitches)
    if not choices:
        return []
    minimum = min(sum(abs(a - b) for a, b in zip(previous, item)) for item in choices)
    return [item for item in choices if sum(abs(a - b) for a, b in zip(previous, item)) == minimum]


def score_old_revoice(notes: list[dict[str, Any]], source: dict[str, Any]) -> dict[str, bool]:
    before = core.sort_notes(source["source"])
    source_groups = pitch_groups(before)
    actual_groups = pitch_groups(notes)
    starts = list(source_groups)
    structure = list(actual_groups) == starts and all(len(actual_groups[start]) == len(source_groups[start]) for start in starts)
    duration_groups = {
        start: sorted(core.fraction_text(value["duration"]) for value in values)
        for start, values in core.notes_by_start(notes).items()
    }
    source_duration_groups = {
        start: sorted(core.fraction_text(value["duration"]) for value in values)
        for start, values in core.notes_by_start(before).items()
    }
    duration = structure and duration_groups == source_duration_groups
    harmony = structure and all(
        sorted(pitch % 12 for pitch in actual_groups[start]) == sorted(pitch % 12 for pitch in source_groups[start])
        for start in starts
    )
    in_range = structure and all(source["range"][0] <= pitch <= source["range"][1] for pitches in actual_groups.values() for pitch in pitches)
    operation = structure
    previous = None
    if structure:
        for start in starts:
            source_pitches = source_groups[start]
            actual_pitches = actual_groups[start]
            if source["operation"] == "nearest" and previous is not None:
                valid = actual_pitches in old_nearest_choices(source_pitches, previous, *source["range"])
            else:
                valid = actual_pitches == core.revoice_target_pitches(source_pitches, source["operation"])
            operation &= valid
            previous = actual_pitches
    return {
        "note_count_and_chord_starts": structure,
        "preserved_duration": duration,
        "chord_pitch_classes": harmony,
        "operation_counterfactual": operation,
        "range_limits": in_range,
    }


def parse_old(arm: str, payload: str) -> list[dict[str, Any]]:
    notes, _ = core.v2.parse_events(arm, payload)
    return notes


def rescore_row(row: dict[str, Any], task: dict[str, Any]) -> dict[str, Any]:
    result = deepcopy(row)
    family = row["family"]
    if family not in {"generation-progression", "transformation-revoice"}:
        result["diagnostic_validation"] = {
            "syntax_pass": row["validation"]["syntax_pass"],
            "primary_pass": row["validation"]["musical_pass"],
            "checks": row["validation"]["checks"],
            "source": "frozen-v2-result",
        }
        return result
    try:
        notes = parse_old(row["arm"], row["response_payload"])
        checks = core.score_progression(notes, task["contract"]) if family == "generation-progression" else score_old_revoice(notes, task["source"])
        result["diagnostic_validation"] = {
            "syntax_pass": True,
            "primary_pass": all(checks.values()),
            "checks": checks,
            "source": "v3-repaired-diagnostic",
        }
    except (KeyError, TypeError, ValueError) as error:
        result["diagnostic_validation"] = {
            "syntax_pass": False,
            "primary_pass": False,
            "checks": {},
            "source": "v3-repaired-diagnostic",
            "error": f"{type(error).__name__}: {error}",
        }
    return result


def rescore_runs(paths: tuple[Path, ...], corpus: dict[str, Any]) -> list[dict[str, Any]]:
    task_map = {
        (family, value["variant"]): value
        for family, values in corpus["fixtures"].items()
        for value in values
    }
    runs = []
    for path in paths:
        run = json.loads(path.read_text())
        rows = [rescore_row(row, task_map[(row["family"], row["variant"])]) for row in run["results"]]
        runs.append({"provider": run["provider"], "complete": run["complete"], "results": rows})
    return runs


def rate(rows: list[dict[str, Any]]) -> float:
    return sum(row["diagnostic_validation"]["primary_pass"] for row in rows) / len(rows) if rows else 0.0


def cohort_report(name: str, runs: list[dict[str, Any]], arms: tuple[str, ...]) -> dict[str, Any]:
    family_counts = []
    component_counts: dict[str, dict[str, int]] = defaultdict(lambda: {"passes": 0, "trials": 0})
    comparisons = []
    for family in core.v2.HARD_FAMILIES:
        rows = [row for run in runs for row in run["results"] if row["family"] == family]
        family_counts.append(
            {
                "family": family,
                "passes": sum(row["diagnostic_validation"]["primary_pass"] for row in rows),
                "trials": len(rows),
            }
        )
        components = sorted(
            {
                component
                for row in rows
                for component in row["diagnostic_validation"]["checks"]
            }
        )
        for row in rows:
            for component in components:
                passed = row["diagnostic_validation"]["checks"].get(component, False)
                key = f"{family}:{component}"
                component_counts[key]["passes"] += bool(passed)
                component_counts[key]["trials"] += 1
    for run in runs:
        summaries = {}
        for arm in arms:
            rows = [row for row in run["results"] if row["arm"] == arm]
            hard_rates = [rate([row for row in rows if row["family"] == family]) for family in core.v2.HARD_FAMILIES]
            guard_rates = [rate([row for row in rows if row["family"] == family]) for family in core.v2.GUARD_FAMILIES]
            summaries[arm] = {
                "hard_macro": sum(hard_rates) / len(hard_rates),
                "guard_macro": sum(guard_rates) / len(guard_rates),
                "input_tokens": sum(row["usage"]["input_tokens"] for row in rows),
                "output_bytes": sum(row.get("response_payload_bytes", 0) for row in rows),
            }
        baseline = summaries["compact-bar-v1"]
        candidate = summaries["label-only-compact"]
        exact = summaries["exact-json"]
        candidate_map = {(row["family"], row["variant"], row["repeat"]): row for row in run["results"] if row["arm"] == "label-only-compact"}
        baseline_map = {(row["family"], row["variant"], row["repeat"]): row for row in run["results"] if row["arm"] == "compact-bar-v1"}
        pairs = [(candidate_map[key], baseline_map[key], key) for key in sorted(candidate_map.keys() & baseline_map.keys())]
        losses = defaultdict(int)
        for candidate_row, baseline_row, key in pairs:
            if baseline_row["diagnostic_validation"]["primary_pass"] and not candidate_row["diagnostic_validation"]["primary_pass"]:
                losses[key[0]] += 1
        comparison = {
            "provider": run["provider"],
            "hard_macro_delta": round(candidate["hard_macro"] - baseline["hard_macro"], 6),
            "guard_macro_delta": round(candidate["guard_macro"] - baseline["guard_macro"], 6),
            "paired_denominator": len(pairs),
            "candidate_only_wins": sum(a["diagnostic_validation"]["primary_pass"] and not b["diagnostic_validation"]["primary_pass"] for a, b, _ in pairs),
            "candidate_only_losses": sum(b["diagnostic_validation"]["primary_pass"] and not a["diagnostic_validation"]["primary_pass"] for a, b, _ in pairs),
            "candidate_only_losses_by_family": dict(sorted(losses.items())),
            "input_token_ratio_to_exact": round(candidate["input_tokens"] / exact["input_tokens"], 6),
            "output_byte_ratio_to_exact": round(candidate["output_bytes"] / exact["output_bytes"], 6),
        }
        gate = core.v2.DEVELOPMENT_GATE
        comparison["provider_gate"] = {
            "hard_improvement": comparison["hard_macro_delta"] >= gate["hard_family_macro_improvement"],
            "guard_regression": comparison["guard_macro_delta"] >= -gate["maximum_guard_macro_regression"],
            "candidate_only_losses": all(value <= gate["maximum_candidate_only_losses_per_provider_family"] for value in losses.values()),
            "input_size": comparison["input_token_ratio_to_exact"] <= gate["maximum_input_token_ratio_to_exact_json"],
            "output_size": comparison["output_byte_ratio_to_exact"] <= gate["maximum_output_byte_ratio_to_exact_json"],
        }
        comparison["provider_gate"]["pass"] = all(comparison["provider_gate"].values())
        comparisons.append(comparison)
    provider_passes = sum(value["provider_gate"]["pass"] for value in comparisons)
    selected = provider_passes >= 2 and all(value["hard_macro_delta"] >= -0.05 for value in comparisons)
    return {
        "cohort": name,
        "family_counts": family_counts,
        "component_counts": [{"component": name, **counts} for name, counts in sorted(component_counts.items())],
        "candidate_comparisons": comparisons,
        "counterfactual_gate": "pass" if selected else "fail",
        "provider_passes": provider_passes,
    }


def diagnostic_report() -> dict[str, Any]:
    holdout = load_holdout()
    initial_runs = rescore_runs(INITIAL_PATHS, core.v2.make_corpus())
    holdout_runs = rescore_runs(HOLDOUT_PATHS, holdout.make_corpus())
    initial = cohort_report("phase8c2-development", initial_runs, core.v2.ARMS)
    held = cohort_report("phase8c2-holdout", holdout_runs, holdout.ARMS)
    value = {
        "schema": SCHEMA,
        "kind": "post-run-diagnostic",
        "authority": "This report does not change the frozen Phase 8c2 decision, responses, or hashes.",
        "method_limit": "The old revoice prompt did not define its named operations. The operation result is a counterfactual that uses the Phase 8c2.2 definitions. Identity, voice, and velocity are not in the old revoice primary result because the old prompt did not require them.",
        "frozen_holdout_decision": "do-not-select",
        "development": initial,
        "holdout": held,
        "old_holdout_gate_would_change": held["counterfactual_gate"] == "pass",
    }
    value["sha256"] = core.digest(value)
    return value


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    rendered = json.dumps(diagnostic_report(), indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered)
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
