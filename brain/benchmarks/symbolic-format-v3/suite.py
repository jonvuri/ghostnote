#!/usr/bin/env python3
"""Define the repaired, reusable full symbolic-music task suite."""

from __future__ import annotations

import importlib.util
import itertools
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent
V19_SUITE_PATH = BENCHMARKS_ROOT / "compact-format-v19" / "suite.py"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


v19 = load_module("ghostnote_symbolic_format_v3_v19_suite", V19_SUITE_PATH)
core = v19.core
symbolic = v19.symbolic
symbolic_scoring = v19.symbolic_scoring

SCHEMA = "ghostnote-symbolic-format-full-suite-v3"
CORPUS_SCHEMA = "ghostnote-symbolic-format-full-suite-corpus-v3"
DEFAULT_COHORT = "extensible-matrix-r1"
DEFAULT_SEED = 103103
DEFAULT_VARIANT_OFFSET = 1200
DECISION_FAMILIES = v19.DECISION_FAMILIES
GUARD_FAMILIES = v19.GUARD_FAMILIES
FAMILIES = v19.FAMILIES
UNIQUE_COUNTS = v19.UNIQUE_COUNTS
SENTINEL_FAMILIES = v19.SENTINEL_FAMILIES
FULL_SUITE = v19.FULL_SUITE
CONTROL = v19.CONTROL


def refresh_task(task: dict[str, Any]) -> dict[str, Any]:
    return v19.refresh_task(task)


def analysis_task(
    index: int, cohort: str, seed: int, variant_offset: int
) -> dict[str, Any]:
    """Return an analysis task whose key moves with its musical content."""

    task = v19.analysis_task(index, cohort, seed, variant_offset)
    shift = 1 + ((seed + index * 5) % 11)
    task["contract"]["key_tonic_pc"] = (
        task["contract"]["key_tonic_pc"] + shift
    ) % 12
    task["case_semantic_sha256"] = v19.analysis_case_hashes(task)
    return refresh_task(task)


def revoice_expected(value: dict[str, Any]) -> list[dict[str, Any]]:
    """Apply the frozen revoice rule with an explicit nearest tie break."""

    groups = symbolic_scoring.notes_by_start(value["source"])
    result = []
    previous: list[int] | None = None
    for chord_index, (start, rows) in enumerate(groups.items()):
        pitches = sorted(row["pitch"] for row in rows)
        if value["operation"] == "drop-2":
            pitches[-2] -= 12
            pitches.sort()
        elif value["operation"] == "first-inversion":
            pitches = sorted(pitches[1:] + [pitches[0] + 12])
        elif previous is not None:
            candidates = []
            for shifts in itertools.product((-12, 0, 12), repeat=len(pitches)):
                candidate = sorted(
                    pitch + shift for pitch, shift in zip(pitches, shifts)
                )
                if value["range"][0] <= candidate[0] and candidate[-1] <= value["range"][1]:
                    movement = sum(
                        abs(before - after)
                        for before, after in zip(previous, candidate)
                    )
                    candidates.append((movement, tuple(candidate)))
            if not candidates:
                raise ValueError("The nearest revoice operation has no valid candidate")
            pitches = list(min(candidates)[1])
        previous = pitches
        for position, pitch in enumerate(pitches, start=1):
            result.append(
                core.note(
                    f"rv-out-{chord_index + 1}-{position}",
                    "keys",
                    start,
                    1,
                    pitch,
                    78,
                )
            )
    return core.sort_notes(result)


def legacy_task(
    family: str, index: int, cohort: str, seed: int, variant_offset: int
) -> dict[str, Any]:
    task = v19.legacy_task(family, index, cohort, seed, variant_offset)
    if family == "transformation-revoice":
        task["expected"] = revoice_expected(task["source"])
        task = refresh_task(task)
    elif family == "transformation-rhythm":
        extra_shift = 4 + ((seed + index) % 5)
        v19.transpose_notes(task["source"]["source"], extra_shift)
        task["expected"] = symbolic.rhythm_expected(task["source"])
        task = refresh_task(task)
    return task


def make_corpus(
    cohort: str = DEFAULT_COHORT,
    seed: int = DEFAULT_SEED,
    variant_offset: int = DEFAULT_VARIANT_OFFSET,
) -> dict[str, Any]:
    fixtures: dict[str, list[dict[str, Any]]] = {}
    for family in DECISION_FAMILIES:
        if family == "comprehension-analysis":
            values = [
                analysis_task(index, cohort, seed, variant_offset)
                for index in range(UNIQUE_COUNTS[family])
            ]
        elif family == "continuation-motif":
            values = [
                v19.affine_task(index, cohort, seed, variant_offset + 20)
                for index in range(UNIQUE_COUNTS[family])
            ]
        else:
            values = [
                legacy_task(family, index, cohort, seed, variant_offset)
                for index in range(UNIQUE_COUNTS[family])
            ]
        fixtures[family] = values
    fixtures["document-serialization"] = [
        v19.serialization_task(index, cohort, seed, variant_offset)
        for index in range(UNIQUE_COUNTS["document-serialization"])
    ]
    value = {
        "schema": CORPUS_SCHEMA,
        "cohort": cohort,
        "license": "MIT",
        "fixtures": fixtures,
    }
    value["sha256"] = core.digest(value)
    return value


def source_notes(task: dict[str, Any]) -> list[dict[str, Any]]:
    return v19.source_notes(task)


def expected_notes(task: dict[str, Any]) -> list[dict[str, Any]]:
    return v19.expected_notes(task)


def constraint_checks(task: dict[str, Any], notes: list[dict[str, Any]]) -> dict[str, bool]:
    return v19.constraint_checks(task, notes)


def task_difficulty(task: dict[str, Any]) -> str:
    return v19.task_difficulty(task)


def task_instruction(task: dict[str, Any]) -> str:
    family = task["family"]
    if family == "continuation-motif":
        contract = task["contract"]
        rules = "; ".join(
            f"{voice}(axis={rule['axis']},semitones={rule['semitones']},"
            f"output_start={rule['output_start']},rhythmic_factor={rule['rhythmic_factor']})"
            for voice, rule in sorted(contract["voice_rules"].items())
        )
        return (
            f"Apply the voice-conditioned affine operation to all {len(task['source'])} "
            "source notes in canonical source order. For each voice, "
            "first_voice_start is the earliest source start in that voice. Assign "
            "output IDs " + ",".join(contract["output_ids"]) + " in source order. "
            "Calculate pitch=(2*axis)-source_pitch+semitones. Calculate "
            "start=output_start+(source_start-first_voice_start)*rhythmic_factor. "
            "Calculate duration=source_duration*rhythmic_factor. Preserve voice and "
            "velocity. Sort after all calculations. Rules: " + rules
        )
    if family == "transformation-revoice":
        source = task["source"]
        operation = source["operation"]
        if operation == "drop-2":
            rule = "Lower the second-highest pitch in each chord by 12 semitones."
        elif operation == "first-inversion":
            rule = "Raise the lowest pitch in each chord by 12 semitones."
        else:
            rule = (
                "Keep the first chord unchanged. For each later chord, try -12, 0, "
                "and +12 semitones independently for each source pitch. Sort each "
                "candidate and reject candidates outside the range. Minimize the sum "
                "of absolute pitch movement from the preceding output chord. If costs "
                "tie, select the lexicographically lowest sorted pitch tuple."
            )
        return (
            f"Revoice each chord with operation={operation}. {rule} Preserve each "
            "chord start. Set every duration to 1, every voice to keys, and every "
            "velocity to 78. Use IDs rv-out-<one-based chord>-<one-based sorted "
            f"position>. Keep every pitch in range {source['range']}. Output exactly "
            f"{len(source['source'])} notes."
        )
    return v19.task_instruction(task)


def suite_screen(corpus: dict[str, Any]) -> dict[str, Any]:
    inherited = v19.suite_screen(corpus)
    analysis = corpus["fixtures"]["comprehension-analysis"]
    revoice = corpus["fixtures"]["transformation-revoice"]
    checks = {
        **inherited["checks"],
        "analysis-reference-contract-passes": all(
            all(core.analysis_fixture_checks(task).values()) for task in analysis
        ),
        "revoice-reference-passes": all(
            task["expected"] == revoice_expected(task["source"])
            for task in revoice
        ),
        "affine-defines-first-voice-start": "earliest source start in that voice"
        in task_instruction(corpus["fixtures"]["continuation-motif"][0]),
        "revoice-specifies-exact-note-count": "Output exactly"
        in task_instruction(revoice[0]),
        "revoice-specifies-tie-break": all(
            task["source"]["operation"] != "nearest"
            or "lexicographically lowest" in task_instruction(task)
            for task in revoice
        ),
    }
    return {"checks": checks, "all_pass": all(checks.values())}


def content_sha256(task: dict[str, Any]) -> str:
    return v19.content_sha256(task)
