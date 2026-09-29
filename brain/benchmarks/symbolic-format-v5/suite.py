#!/usr/bin/env python3
"""Provide the fresh eight-arm full-matrix cohort."""

from __future__ import annotations

import importlib.util
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
V4_SUITE_PATH = PACKAGE_ROOT.parent / "symbolic-format-v4" / "suite.py"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


v4 = load_module("ghostnote_symbolic_format_v5_v4_suite", V4_SUITE_PATH)
v3 = v4.v3
v19 = v4.v19
core = v4.core
symbolic = v4.symbolic
symbolic_scoring = v4.symbolic_scoring

SCHEMA = "ghostnote-symbolic-format-full-suite-v5"
CORPUS_SCHEMA = "ghostnote-symbolic-format-full-suite-corpus-v5"
DEFAULT_COHORT = "eight-arm-full-matrix-r1"
DEFAULT_SEED = 300007
DEFAULT_VARIANT_OFFSET = 4000
DECISION_FAMILIES = v4.DECISION_FAMILIES
GUARD_FAMILIES = v4.GUARD_FAMILIES
FAMILIES = v4.FAMILIES
UNIQUE_COUNTS = v4.UNIQUE_COUNTS
SENTINEL_FAMILIES = v4.SENTINEL_FAMILIES
FULL_SUITE = v4.FULL_SUITE
CONTROL = v4.CONTROL


def refresh(task: dict[str, Any]) -> None:
    value = v3.refresh_task(task)
    task.clear()
    task.update(value)


def transpose_generation_contract(task: dict[str, Any], shift: int) -> None:
    """Transpose one open-generation contract without changing its shape."""

    contract = task["contract"]
    family = task["family"]
    if family == "generation-progression":
        contract["pitch_classes"] = [
            sorted((pitch + shift) % 12 for pitch in chord)
            for chord in contract["pitch_classes"]
        ]
        contract["bass_pitch_classes"] = [
            (pitch + shift) % 12 for pitch in contract["bass_pitch_classes"]
        ]
        contract["key_tonic_pc"] = (contract["key_tonic_pc"] + shift) % 12
        contract["voice_ranges"] = {
            voice: [value + shift for value in limits]
            for voice, limits in contract["voice_ranges"].items()
        }
    elif family == "generation-melody":
        contract["scale_pitch_classes"] = sorted(
            (pitch + shift) % 12 for pitch in contract["scale_pitch_classes"]
        )
        contract["strong_beat_chord_pitch_classes"] = sorted(
            (pitch + shift) % 12
            for pitch in contract["strong_beat_chord_pitch_classes"]
        )
        contract["cadence_pitch_class"] = (
            contract["cadence_pitch_class"] + shift
        ) % 12
        contract["range"] = [value + shift for value in contract["range"]]
    elif family == "continuation-roles":
        contract["harmony_pitch_classes"] = [
            sorted((pitch + shift) % 12 for pitch in chord)
            for chord in contract["harmony_pitch_classes"]
        ]
        contract["cadence_pitch_class"] = (
            contract["cadence_pitch_class"] + shift
        ) % 12
        contract["ranges"] = {
            voice: [value + shift for value in limits]
            for voice, limits in contract["ranges"].items()
        }
    else:
        raise ValueError(f"The family has no generation transposition: {family}")
    refresh(task)


def make_corpus(
    cohort: str = DEFAULT_COHORT,
    seed: int = DEFAULT_SEED,
    variant_offset: int = DEFAULT_VARIANT_OFFSET,
) -> dict[str, Any]:
    value = v3.make_corpus(cohort, seed, variant_offset)
    for family in (
        "generation-progression",
        "generation-melody",
        "continuation-roles",
    ):
        for task in value["fixtures"][family]:
            transpose_generation_contract(task, 1)
    for task in value["fixtures"]["transformation-revoice"]:
        v19.transpose_notes(task["source"]["source"], 12)
        task["source"]["range"] = [
            item + 12 for item in task["source"]["range"]
        ]
        task["expected"] = v3.revoice_expected(task["source"])
        refresh(task)
    for task in value["fixtures"]["transformation-rhythm"]:
        v19.transpose_notes(task["source"]["source"], 24)
        task["expected"] = symbolic.rhythm_expected(task["source"])
        refresh(task)
    value["schema"] = CORPUS_SCHEMA
    unsigned = {name: item for name, item in value.items() if name != "sha256"}
    value["sha256"] = core.digest(unsigned)
    return value


source_notes = v4.source_notes
expected_notes = v4.expected_notes
constraint_checks = v4.constraint_checks
task_difficulty = v4.task_difficulty
task_instruction = v4.task_instruction
content_sha256 = v3.content_sha256


def suite_screen(corpus: dict[str, Any]) -> dict[str, Any]:
    inherited = v4.suite_screen(corpus)
    baseline = v3.make_corpus(
        DEFAULT_COHORT, DEFAULT_SEED, DEFAULT_VARIANT_OFFSET
    )
    expected_generation: dict[str, list[dict[str, Any]]] = {}
    for family in (
        "generation-progression",
        "generation-melody",
        "continuation-roles",
    ):
        expected_generation[family] = []
        for source_task in baseline["fixtures"][family]:
            expected_task = deepcopy(source_task)
            transpose_generation_contract(expected_task, 1)
            expected_generation[family].append(expected_task)

    checks = {
        **inherited["checks"],
        "generation-contracts-transposed-one-semitone": all(
            task["contract"] == expected["contract"]
            for family in expected_generation
            for task, expected in zip(
                corpus["fixtures"][family], expected_generation[family]
            )
        ),
        "generation-references-pass": all(
            all(constraint_checks(task, expected_notes(task)).values())
            for family in (
                "generation-progression",
                "generation-melody",
                "continuation-roles",
            )
            for task in corpus["fixtures"][family]
        ),
        "revoice-register-shift": all(
            task["source"]["range"]
            == [value + 12 for value in source_task["source"]["range"]]
            and source_notes(task)
            == [
                {**note, "pitch": note["pitch"] + 12}
                for note in source_notes(source_task)
            ]
            for task, source_task in zip(
                corpus["fixtures"]["transformation-revoice"],
                baseline["fixtures"]["transformation-revoice"],
            )
        ),
        "rhythm-register-shift": all(
            source_notes(task)
            == [
                {**note, "pitch": note["pitch"] + 24}
                for note in source_notes(source_task)
            ]
            for task, source_task in zip(
                corpus["fixtures"]["transformation-rhythm"],
                baseline["fixtures"]["transformation-rhythm"],
            )
        ),
    }
    return {"checks": checks, "all_pass": all(checks.values())}
