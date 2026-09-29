#!/usr/bin/env python3
"""Apply the component-focused v19 product assessment."""

from __future__ import annotations

import argparse
import importlib.util
import json
from functools import lru_cache
from fractions import Fraction
from copy import deepcopy
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARK_PATH = PACKAGE_ROOT / "benchmark.py"
CONTINUATION_PATH = PACKAGE_ROOT / "claude_continuation.py"
POLICY_PATH = PACKAGE_ROOT / "runs" / "full-benchmark-r1-adaptive-policy.json"
ARMS = ("compact-bar-fields", "compact-bar-local-labels")
REVOICE_FIELDS = ("voice", "start", "duration", "pitch", "velocity")
REVOICE_MATCH_FIELDS = ("voice", "duration", "pitch", "velocity")


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


m = load_module("ghostnote_compact_format_v19_adaptive", BENCHMARK_PATH)
continuation = load_module(
    "ghostnote_compact_format_v19_adaptive_continuation", CONTINUATION_PATH
)


def unsigned_digest(value: dict[str, Any], field: str) -> str:
    unsigned = deepcopy(value)
    unsigned.pop(field, None)
    return m.core.digest(unsigned)


def analysis_score(row: dict[str, Any]) -> dict[str, Any] | None:
    """Score visible analysis components and omit the invalid function field."""

    score = m.v14.row_score(row)
    if score is None:
        return None
    cases = score.get("cases", [])
    correct = sum(
        passed
        for case in cases
        for name, passed in case.get("components", {}).items()
        if name != "functions"
    )
    planned = sum(
        1
        for case in cases
        for name in case.get("components", {})
        if name != "functions"
    )
    return {
        "component": {"correct": correct, "planned": planned},
        "structural_parse_pass": score["structural_parse_pass"],
        "canonical_form_pass": score["canonical_form_pass"],
    }


def onset_alignment_score(
    expected: list[dict[str, Any]], actual: list[dict[str, Any]]
) -> int:
    """Return the best non-cascading field score within one onset."""

    @lru_cache(maxsize=None)
    def best(expected_index: int, used_actual: int) -> int:
        if expected_index == len(expected):
            return 0
        result = best(expected_index + 1, used_actual)
        for actual_index, actual_note in enumerate(actual):
            bit = 1 << actual_index
            if used_actual & bit:
                continue
            matches = 1 + sum(
                actual_note.get(field) == expected[expected_index][field]
                for field in REVOICE_MATCH_FIELDS
            )
            result = max(
                result,
                matches + best(expected_index + 1, used_actual | bit),
            )
        return result

    return best(0, 0)


def scorer_checks() -> dict[str, bool]:
    """Check that revoice matching isolates one wrong field."""

    expected = [
        {
            "voice": "keys",
            "start": "0",
            "duration": "1",
            "pitch": 60,
            "velocity": 78,
        },
        {
            "voice": "keys",
            "start": "0",
            "duration": "1",
            "pitch": 64,
            "velocity": 78,
        },
    ]
    actual = deepcopy(expected)
    actual[0]["voice"] = "lead"
    return {
        "one_field_error_loses_one_component": onset_alignment_score(
            expected, actual
        )
        == 9,
        "extra_note_fails_count": len([*actual, deepcopy(actual[0])])
        != len(expected),
    }


def revoice_score(row: dict[str, Any], task: dict[str, Any]) -> dict[str, Any] | None:
    call = row.get("initial_call") or {}
    payload = call.get("response_payload")
    if not isinstance(payload, str):
        return None
    document, structural, canonical, _ = m.parse_document(row["arm"], payload)
    actual = document.get("notes", [])
    expected = task["expected"]

    expected_by_start: dict[Fraction, list[dict[str, Any]]] = {}
    actual_by_start: dict[Fraction, list[dict[str, Any]]] = {}
    for note in expected:
        expected_by_start.setdefault(m.core.fraction(note["start"]), []).append(note)
    for note in actual:
        actual_by_start.setdefault(m.core.fraction(note["start"]), []).append(note)
    case_correct = sum(
        onset_alignment_score(expected_notes, actual_by_start.get(start, []))
        for start, expected_notes in expected_by_start.items()
    )
    case_planned = len(expected) * len(REVOICE_FIELDS)
    perfect = m.perfect_document(task)
    response_checks = (
        document.get("schema") == perfect["schema"],
        document.get("base_sha256") == perfect["base_sha256"],
        document.get("source_id") == perfect["source_id"],
        document.get("omits") == perfect["omits"],
        document.get("overlays") == perfect["overlays"],
        len({note["id"] for note in actual}) == len(actual),
        len(actual) == len(expected),
    )
    return {
        "component": {
            "correct": case_correct + sum(response_checks),
            "planned": case_planned + len(response_checks),
        },
        "structural_parse_pass": structural,
        "canonical_form_pass": canonical,
    }


def score_row(
    row: dict[str, Any], tasks: dict[tuple[str, int], dict[str, Any]]
) -> dict[str, Any] | None:
    if row["family"] == "comprehension-analysis":
        return analysis_score(row)
    if row["family"] == "transformation-revoice":
        return revoice_score(row, tasks[(row["family"], row["variant"])])
    return m.v14.row_score(row)


def cell_summaries(run: dict[str, Any]) -> list[dict[str, Any]]:
    tasks = {
        (task["family"], task["variant"]): task
        for family_tasks in m.make_corpus()["fixtures"].values()
        for task in family_tasks
    }
    result = []
    for family in m.FAMILIES:
        for arm in ARMS:
            rows = [
                row
                for row in run["results"]
                if row["family"] == family and row["arm"] == arm
            ]
            scores = [score_row(row, tasks) for row in rows]
            scored = [score for score in scores if score is not None]
            correct = sum(score["component"]["correct"] for score in scored)
            planned_components = sum(
                score["component"]["planned"] for score in scored
            )
            coverage = len(scored) / len(rows) if rows else 0.0
            accuracy = correct / planned_components if planned_components else None
            threshold = 0.9 if family == "document-serialization" else 0.7
            status = (
                "unavailable"
                if coverage < 0.8
                else "pass"
                if accuracy is not None and accuracy >= threshold
                else "fail"
            )
            result.append(
                {
                    "family": family,
                    "arm": arm,
                    "planned_prompts": len(rows),
                    "scored_prompts": len(scored),
                    "coverage": round(coverage, 6),
                    "component_correct": correct,
                    "component_planned": planned_components,
                    "component_accuracy": None
                    if accuracy is None
                    else round(accuracy, 6),
                    "component_threshold": threshold,
                    "status": status,
                    "structural_parse_rate": None
                    if not scored
                    else round(
                        sum(score["structural_parse_pass"] for score in scored)
                        / len(scored),
                        6,
                    ),
                    "canonical_form_rate": None
                    if not scored
                    else round(
                        sum(score["canonical_form_pass"] for score in scored)
                        / len(scored),
                        6,
                    ),
                }
            )
    return result


def candidate_summaries(cells: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for arm in ARMS:
        selected = [
            cell
            for cell in cells
            if cell["arm"] == arm and cell["component_planned"]
        ]
        correct = sum(cell["component_correct"] for cell in selected)
        planned = sum(cell["component_planned"] for cell in selected)
        result.append(
            {
                "arm": arm,
                "component_correct": correct,
                "component_planned": planned,
                "component_accuracy": round(correct / planned, 6),
                "passed_cells": sum(cell["status"] == "pass" for cell in selected),
                "failed_cells": sum(cell["status"] == "fail" for cell in selected),
                "unavailable_cells": sum(
                    cell["status"] == "unavailable"
                    for cell in cells
                    if cell["arm"] == arm
                ),
            }
        )
    return result


def assess(
    openai_path: Path,
    gemini_path: Path,
    claude_path: Path,
    claude_partial_path: Path,
    supplement_path: Path,
) -> dict[str, Any]:
    checks = scorer_checks()
    if not all(checks.values()):
        raise ValueError("The adaptive scorer self-check failed")
    openai = m.v15.load_manifest(openai_path)
    gemini = m.v15.load_manifest(gemini_path)
    partial = continuation.m.v15.load_manifest(claude_partial_path)
    supplement = continuation.validate_supplement(
        supplement_path, partial, claude_partial_path
    )
    continuation.configure_recovery()
    claude = continuation.validate_completed(
        json.loads(claude_path.read_text()), partial, supplement
    )
    runs = {"openai": openai, "gemini": gemini, "claude-haiku": claude}
    providers = []
    for provider, run in runs.items():
        cells = cell_summaries(run)
        providers.append(
            {
                "provider": provider,
                "manifest_sha256": run["manifest_sha256"],
                "progress": run["progress"],
                "known_cost_usd": run["actual_cost_exact_usd"],
                "cells": cells,
                "candidates": candidate_summaries(cells),
                "passed_cells": sum(cell["status"] == "pass" for cell in cells),
                "failed_cells": sum(cell["status"] == "fail" for cell in cells),
                "unavailable_cells": sum(
                    cell["status"] == "unavailable" for cell in cells
                ),
            }
        )
    for provider in providers:
        for cell in provider["cells"]:
            if (
                provider["provider"] != "claude-haiku"
                and cell["family"] == "comprehension-analysis"
                and cell["component_planned"] != 168
            ):
                raise ValueError("The analysis function exclusion did not apply")
    failed = [
        [provider["provider"], cell["family"], cell["arm"]]
        for provider in providers
        for cell in provider["cells"]
        if cell["status"] == "fail"
    ]
    unavailable = [
        [provider["provider"], cell["family"], cell["arm"]]
        for provider in providers
        for cell in provider["cells"]
        if cell["status"] == "unavailable"
    ]
    known_cost = sum(float(run["actual_cost_exact_usd"]) for run in runs.values())
    unretained_reservation = supplement["unretained_recovery_reservation_usd"]
    value = {
        "schema": "ghostnote-compact-format-adaptive-assessment-v1",
        "run_id": m.RUN_ID,
        "policy_file_sha256": m.base.file_sha256(POLICY_PATH),
        "providers": providers,
        "decision": "matrix-plausible" if not failed else "revise",
        "decision_basis": (
            "Every measured provider-family-candidate cell passes its component "
            "gate after exclusion of the invalid analysis function component. "
            "Claude analysis is unavailable and remains an explicit gap."
            if not failed
            else "One or more measured cells miss a component gate."
        ),
        "failed_cells": failed,
        "unavailable_cells": unavailable,
        "known_cost_usd": round(known_cost, 9),
        "unretained_cost_reservation_usd": unretained_reservation,
        "maximum_cost_exposure_usd": round(
            known_cost + unretained_reservation, 9
        ),
        "measurement_repairs": {
            "analysis_functions_excluded": True,
            "revoice_exact_note_count_required": True,
            "revoice_field_alignment": "maximum agreement within exact onset",
            "scorer_checks": checks,
        },
        "revoice_rule": (
            "Align within each onset without coupling field errors. Score voice, "
            "start, duration, pitch, velocity, exact note count, and six response "
            "components. Ignore undisclosed IDs."
        ),
    }
    value["sha256"] = unsigned_digest(value, "sha256")
    return value


def write_new(value: dict[str, Any], output: Path) -> None:
    if output.exists():
        raise FileExistsError(f"Refusing to replace: {output}")
    output.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--openai", type=Path, required=True)
    parser.add_argument("--gemini", type=Path, required=True)
    parser.add_argument("--claude", type=Path, required=True)
    parser.add_argument("--claude-partial", type=Path, required=True)
    parser.add_argument("--supplement", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--check", type=Path)
    args = parser.parse_args()
    value = assess(
        args.openai,
        args.gemini,
        args.claude,
        args.claude_partial,
        args.supplement,
    )
    if args.check:
        if json.loads(args.check.read_text()) != value:
            raise SystemExit("The adaptive assessment does not reproduce")
        print(json.dumps({"pass": True, "sha256": value["sha256"]}))
        return
    write_new(value, args.output)


if __name__ == "__main__":
    main()
