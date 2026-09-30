#!/usr/bin/env python3
"""Rescore retained v5 responses without changing the frozen run."""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from collections import defaultdict
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
RUNS = ROOT / "runs"
MUSICAL_FIELDS = ("voice", "start", "duration", "pitch", "velocity")
EXACT_FAMILIES = {
    "comprehension-structure",
    "continuation-motif",
    "transformation-local",
    "transformation-rhythm",
    "document-serialization",
}
CONSTRAINT_FAMILIES = {
    "generation-progression",
    "generation-melody",
    "continuation-roles",
}
CHAIN_NAMES = {
    "openai": ("2026-09-29-openai.json",),
    "gemini": (
        "2026-09-29-gemini.json",
        "2026-09-29-gemini-continuation-r3.json",
    ),
    "claude-haiku": (
        "2026-09-29-claude-haiku.json",
        "2026-09-29-claude-haiku-continuation-r3.json",
        "2026-09-29-claude-haiku-continuation-r4.json",
        "2026-09-29-claude-haiku-continuation-r5.json",
        "2026-09-29-claude-haiku-continuation-r5b.json",
        "2026-09-30-claude-haiku-continuation-r6.json",
        "2026-09-30-claude-haiku-continuation-r7.json",
        "2026-09-30-claude-haiku-continuation-r8.json",
        "2026-09-30-claude-haiku-continuation-r9.json",
        "2026-09-30-claude-haiku-continuation-r10.json",
    ),
}


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


frozen = load_module("ghostnote_v5_corrected_frozen", ROOT / "final_assessment.py")
m = frozen.m


def retained_rows(provider: str) -> tuple[list[dict[str, Any]], list[str]]:
    runs = [frozen.load_manifest(RUNS / name) for name in CHAIN_NAMES[provider]]
    rows = (
        runs[0]["results"]
        if len(runs) == 1
        else frozen.merge_rows(runs[0], runs[1:])[0]
    )
    return rows, [run["manifest_sha256"] for run in runs]


def recover_compact_rows(arm: str, payload: str) -> list[dict[str, Any]]:
    """Read complete six-field rows when only compact metadata failed."""

    if arm not in {"compact-bar-fields", "compact-bar-local-labels"}:
        return []
    fields = re.compile(r"N (\S+) (\S+) (\S+) (\S+) (\d+) (\d+)")
    labels = re.compile(
        r"N id=(\S+) voice=(\S+) start=(\S+) duration=(\S+) "
        r"pitch=(\d+) velocity=(\d+)"
    )
    pattern = fields if arm == "compact-bar-fields" else labels
    rows = []
    for line in (value.strip() for value in payload.splitlines()):
        if not line:
            continue
        if line.startswith("N "):
            match = pattern.fullmatch(line)
            if match is None:
                return []
            rows.append(dict(zip(m.formats.v4.v3.ALL_FIELDS, match.groups())))
        elif not line.startswith(("BASE", "SOURCE", "OMITS ", "FIELDS ")):
            return []
    if not rows:
        return []
    try:
        return m.formats.v4.v3.normalized_notes(rows)
    except (TypeError, ValueError):
        return []


def parsed_response(arm: str, payload: str) -> tuple[Any, bool]:
    parsed = m.formats.get(arm).parse_payload(payload)
    if parsed.notes:
        return parsed, False
    recovered = recover_compact_rows(arm, payload)
    if not recovered:
        return parsed, False
    # The adapter's structural and canonical judgments still apply.
    return m.formats.ParseResult(
        recovered, parsed.structural, parsed.canonical, parsed.alignment, parsed.error
    ), True


def musical_tuple(note: dict[str, Any]) -> tuple[Any, ...]:
    return tuple(note[field] for field in MUSICAL_FIELDS)


def exact_cases(
    expected: list[dict[str, Any]], actual: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], bool]:
    """Assign notes by musical fields, then report ID preservation."""

    assignment = [-1] * len(expected)
    remaining = set(range(len(actual)))
    # Exact musical matches are certain. Prefer matching IDs only as a tie break.
    for index, note in enumerate(expected):
        choices = [
            position
            for position in remaining
            if musical_tuple(actual[position]) == musical_tuple(note)
        ]
        if choices:
            chosen = min(
                choices,
                key=lambda position: (actual[position]["id"] != note["id"], position),
            )
            assignment[index] = chosen
            remaining.remove(chosen)

    pending = [index for index, position in enumerate(assignment) if position < 0]
    candidates = sorted(remaining)

    @lru_cache(maxsize=None)
    def best(index: int, used: int) -> tuple[int, int, tuple[int, ...]]:
        if index == len(pending):
            return 0, 0, ()
        later = best(index + 1, used)
        selected = (later[0], later[1], (-1, *later[2]))
        expected_note = expected[pending[index]]
        for candidate_index, actual_index in enumerate(candidates):
            bit = 1 << candidate_index
            if used & bit:
                continue
            actual_note = actual[actual_index]
            matches = sum(
                actual_note[field] == expected_note[field]
                for field in MUSICAL_FIELDS
            )
            id_match = int(actual_note["id"] == expected_note["id"])
            later = best(index + 1, used | bit)
            proposal = (
                matches + later[0],
                id_match + later[1],
                (actual_index, *later[2]),
            )
            if proposal[:2] > selected[:2] or (
                proposal[:2] == selected[:2]
                and tuple(len(actual) if item < 0 else item for item in proposal[2])
                < tuple(len(actual) if item < 0 else item for item in selected[2])
            ):
                selected = proposal
        return selected

    if pending:
        for index, actual_index in zip(pending, best(0, 0)[2]):
            assignment[index] = actual_index

    cases = []
    for note, actual_index in zip(expected, assignment):
        found = actual[actual_index] if actual_index >= 0 else {}
        cases.append(
            m.engine.case_record(
                note["id"],
                {field: found.get(field) == note[field] for field in MUSICAL_FIELDS},
            )
        )
    ids_preserved = len(actual) == len(expected) and all(
        actual[position]["id"] == note["id"]
        for note, position in zip(expected, assignment)
        if position >= 0
    ) and all(position >= 0 for position in assignment)
    return cases, ids_preserved


def corrected_row(job: dict[str, Any], row: dict[str, Any]) -> dict[str, Any]:
    old_score = row["initial"].get("score")
    if old_score is None:
        raise ValueError("Cannot score an unavailable response")
    task = job["task"]
    family = row["family"]
    parsed = None
    recovered = False
    legacy_harmony = None
    lead_voice = None
    ids_preserved = None
    if family == "comprehension-analysis":
        cases = old_score["cases"]
    else:
        parsed, recovered = parsed_response(
            row["arm"], row["initial_call"]["response_payload"]
        )
        if family in EXACT_FAMILIES:
            cases, ids_preserved = exact_cases(m.suite.expected_notes(task), parsed.notes)
        elif family == "transformation-revoice":
            cases = m.engine.revoice_score(task, parsed)["cases"]
        elif family in CONSTRAINT_FAMILIES:
            checks = m.suite.constraint_checks(task, parsed.notes)
            if family == "generation-melody":
                legacy_harmony = checks.pop("strong_beat_harmony")
                lead_voice = bool(parsed.notes) and all(
                    note["voice"] == "lead" for note in parsed.notes
                )
                checks["lead_voice"] = lead_voice
            if not parsed.notes:
                checks = {name: False for name in checks}
            cases = [m.engine.case_record("requirements", checks)]
        else:
            raise ValueError(f"Unknown family: {family}")

    return {
        "case_correct": sum(case["correct"] for case in cases),
        "case_planned": sum(case["planned"] for case in cases),
        "cases": cases,
        "response_correct": old_score["component"]["response_correct"],
        "response_planned": old_score["component"]["response_planned"],
        "structural": old_score["structural_parse_pass"],
        "canonical": old_score["canonical_form_pass"],
        "recovered_compact_rows": recovered,
        "empty_constraint_response": family in CONSTRAINT_FAMILIES and not parsed.notes,
        "expected_ids_preserved": ids_preserved,
        "lead_voice": lead_voice,
        "legacy_whole_number_harmony": legacy_harmony,
    }


def safe_rate(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator, 6) if denominator else None


def summary(scores: list[dict[str, Any]]) -> dict[str, Any]:
    case_correct = sum(score["case_correct"] for score in scores)
    case_planned = sum(score["case_planned"] for score in scores)
    response_correct = sum(score["response_correct"] for score in scores)
    response_planned = sum(score["response_planned"] for score in scores)
    id_rows = [score for score in scores if score["expected_ids_preserved"] is not None]
    melody = [score for score in scores if score["lead_voice"] is not None]
    return {
        "prompts": len(scores),
        "musical_component_correct": case_correct,
        "musical_component_planned": case_planned,
        "musical_component_accuracy": safe_rate(case_correct, case_planned),
        "mean_prompt_accuracy": round(
            sum(score["case_correct"] / score["case_planned"] for score in scores)
            / len(scores),
            6,
        ) if scores else None,
        "response_component_correct": response_correct,
        "response_component_planned": response_planned,
        "response_component_accuracy": safe_rate(response_correct, response_planned),
        "structural_passes": sum(score["structural"] for score in scores),
        "structural_rate": safe_rate(sum(score["structural"] for score in scores), len(scores)),
        "canonical_passes": sum(score["canonical"] for score in scores),
        "canonical_rate": safe_rate(sum(score["canonical"] for score in scores), len(scores)),
        "expected_id_preservation_passes": sum(
            score["expected_ids_preserved"] for score in id_rows
        ),
        "expected_id_preservation_prompts": len(id_rows),
        "expected_id_preservation_rate": safe_rate(
            sum(score["expected_ids_preserved"] for score in id_rows), len(id_rows)
        ),
        "recovered_compact_prompts": sum(score["recovered_compact_rows"] for score in scores),
        "empty_constraint_prompts": sum(score["empty_constraint_response"] for score in scores),
        "lead_voice_passes": sum(score["lead_voice"] for score in melody),
        "lead_voice_prompts": len(melody),
        "legacy_whole_number_harmony_passes": sum(
            score["legacy_whole_number_harmony"] for score in melody
        ),
    }


def assess() -> dict[str, Any]:
    manifests = {
        provider: [frozen.load_manifest(RUNS / name) for name in CHAIN_NAMES[provider]]
        for provider in m.PROVIDERS
    }
    original = frozen.assess(
        RUNS / CHAIN_NAMES["openai"][0],
        RUNS / CHAIN_NAMES["gemini"][0],
        RUNS / CHAIN_NAMES["gemini"][1],
        RUNS / CHAIN_NAMES["claude-haiku"][0],
        [RUNS / name for name in CHAIN_NAMES["claude-haiku"][1:]],
    )
    saved = json.loads((RUNS / "2026-09-30-complete-assessment.json").read_text())
    if original != saved or not original["all_retained_rows_valid"]:
        raise ValueError("The frozen assessment does not reproduce")

    groups: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    row_hashes = []
    unavailable = {}
    for provider in m.PROVIDERS:
        runs = manifests[provider]
        rows = (
            runs[0]["results"]
            if len(runs) == 1
            else frozen.merge_rows(runs[0], runs[1:])[0]
        )
        jobs = {job["planned_sequence"]: job for job in m.jobs(provider)}
        unavailable[provider] = [
            row["planned_sequence"] for row in rows
            if row["initial"]["kind"] == "unavailable"
        ]
        for row in rows:
            if row["initial"].get("score") is None:
                continue
            job = jobs[row["planned_sequence"]]
            if (
                row["task_sha256"] != job["task"]["sha256"]
                or row["arm"] != job["arm"]
                or row["family"] != job["family"]
            ):
                raise ValueError("The retained row does not match its scheduled task")
            score = corrected_row(job, row)
            row_hashes.append({
                "provider": provider,
                "sequence": row["planned_sequence"],
                "sha256": m.core.digest(score),
            })
            for key in (
                (provider, "ALL", "ALL"),
                (provider, row["arm"], "ALL"),
                (provider, row["arm"], row["family"]),
                ("POOLED", "ALL", "ALL"),
                ("POOLED", row["arm"], "ALL"),
                ("POOLED", row["arm"], row["family"]),
            ):
                groups[key].append(score)

    aggregates = {}
    for provider in (*m.PROVIDERS, "POOLED"):
        aggregates[provider] = {
            "ALL": summary(groups[(provider, "ALL", "ALL")]),
            "arms": {
                arm: {
                    "ALL": summary(groups[(provider, arm, "ALL")]),
                    "families": {
                        family: summary(groups[(provider, arm, family)])
                        for family in m.FAMILIES
                    },
                }
                for arm in m.ARMS
            },
        }
    value = {
        "schema": "ghostnote-symbolic-format-v5-corrected-assessment-v1",
        "run_id": m.RUN_ID,
        "frozen_assessment_sha256": saved["sha256"],
        "source_manifest_sha256": original["source_manifest_sha256"],
        "scorer_sha256": m.base.file_sha256(ROOT / "corrected_assessment.py"),
        "row_scores_sha256": m.core.digest(row_hashes),
        "scored_rows": len(row_hashes),
        "unavailable_sequences": unavailable,
        "actual_cost_exact_usd": original["actual_cost_exact_usd"],
        "aggregates": aggregates,
        "interpretation": (
            "Five musical note fields use one-to-one matching. Synthetic ID "
            "preservation is a separate diagnostic. Exact six-field compact "
            "rows can survive metadata failure. Empty note sets earn no "
            "constraint credit. Melody scores require lead voice. The legacy "
            "whole-number-onset harmony check remains diagnostic. Structural "
            "and canonical results retain the frozen subset judgments."
        ),
    }
    value["sha256"] = m.core.digest(value)
    return value


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    parser.add_argument("--check", type=Path)
    args = parser.parse_args()
    result = assess()
    if args.check is not None:
        if result != json.loads(args.check.read_text()):
            raise SystemExit("Corrected assessment does not reproduce")
        print(f"Corrected assessment reproduces: {result['sha256']}")
    elif args.output is not None:
        if args.output.exists():
            raise FileExistsError(f"Refusing to replace: {args.output}")
        args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    else:
        print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
