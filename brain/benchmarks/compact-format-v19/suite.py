#!/usr/bin/env python3
"""Define the fresh Phase 8c4e full compact-format task suite."""

from __future__ import annotations

import importlib.util
import random
import sys
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent
V18_SUITE_PATH = BENCHMARKS_ROOT / "compact-format-v18" / "suite.py"
SYMBOLIC_V1_ROOT = BENCHMARKS_ROOT / "symbolic-format-v1"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


v18 = load_module("ghostnote_compact_format_v19_v18_suite", V18_SUITE_PATH)
v15 = v18.v15
v14 = v18.v14
base = v18.base
core = v18.core


def load_symbolic_modules() -> tuple[Any, Any]:
    """Load frozen theory helpers without keeping generic module bindings."""

    saved = {name: sys.modules.get(name) for name in ("corpus", "formats")}
    try:
        corpus = load_module(
            "ghostnote_compact_format_v19_symbolic_corpus",
            SYMBOLIC_V1_ROOT / "corpus.py",
        )
        sys.modules["corpus"] = corpus
        formats = load_module(
            "ghostnote_compact_format_v19_symbolic_formats",
            SYMBOLIC_V1_ROOT / "formats.py",
        )
        sys.modules["formats"] = formats
        scoring = load_module(
            "ghostnote_compact_format_v19_symbolic_scoring",
            SYMBOLIC_V1_ROOT / "scoring.py",
        )
        return corpus, scoring
    finally:
        for name, value in saved.items():
            if value is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = value


symbolic, symbolic_scoring = load_symbolic_modules()

SCHEMA = "ghostnote-compact-format-full-suite-v19"
CORPUS_SCHEMA = "ghostnote-compact-format-full-suite-corpus-v19"
DEFAULT_COHORT = "full-benchmark-r1"
DEFAULT_SEED = 91093
DEFAULT_VARIANT_OFFSET = 900
ARMS = ("compact-bar-fields", "compact-bar-local-labels")
DECISION_FAMILIES = tuple(symbolic.TASK_FAMILIES)
GUARD_FAMILIES = ("document-serialization",)
FAMILIES = (*DECISION_FAMILIES, *GUARD_FAMILIES)
UNIQUE_COUNTS = {family: 7 for family in DECISION_FAMILIES} | {
    "document-serialization": 2
}
SENTINEL_FAMILIES = DECISION_FAMILIES
FULL_SUITE = "full-suite"
CONTROL = "literal-serialization-control"


def fraction_text(value: Fraction | str | int) -> str:
    return core.fraction_text(value)


def stripped_content(value: Any) -> Any:
    """Remove synthetic identity while keeping musical values and rules."""

    ignored = {
        "schema",
        "id",
        "ids",
        "note_id",
        "note_ids",
        "output_ids",
        "source_id",
        "cohort",
        "variant",
        "origin",
        "license",
        "sha256",
        "semantic_sha256",
        "content_sha256",
        "case_semantic_sha256",
    }
    if isinstance(value, dict):
        return {
            name: stripped_content(item)
            for name, item in value.items()
            if name not in ignored and not name.endswith("_sha256")
        }
    if isinstance(value, list):
        return [stripped_content(item) for item in value]
    return value


def content_sha256(task: dict[str, Any]) -> str:
    return core.digest(stripped_content(task))


def refresh_task(task: dict[str, Any]) -> dict[str, Any]:
    value = deepcopy(task)
    for name in ("sha256", "semantic_sha256", "content_sha256"):
        value.pop(name, None)
    value["content_sha256"] = content_sha256(value)
    value["semantic_sha256"] = value["content_sha256"]
    value["sha256"] = core.digest(value)
    return value


def analysis_case_hashes(task: dict[str, Any]) -> list[str]:
    """Hash each analysis case without note or group IDs."""

    by_id = {row["id"]: row for row in task["source"]}
    result = []
    for index, group in enumerate(task["contract"]["chord_groups"]):
        rows = [by_id[note_id] for note_id in group["note_ids"]]
        result.append(
            core.digest(
                {
                    "notes": [stripped_content(row) for row in rows],
                    "motif_pair": task["contract"]["motif_pairs"][index],
                    "answer": {
                        name: task["expected"][name][index]
                        for name in core.ANALYSIS_FIELDS
                    },
                }
            )
        )
    return result


def analysis_task(
    index: int, cohort: str, seed: int, variant_offset: int
) -> dict[str, Any]:
    """Return one seed-dependent three-case v18 analysis task."""

    source_index = 5 + index % 5
    task = v18.analysis_task(source_index, cohort, variant_offset + index * 13)
    shift = 1 + ((seed + index * 5) % 11)
    for row in task["source"]:
        row["pitch"] += shift
    for name in ("root_pcs", "bass_pcs"):
        task["expected"][name] = [
            (value + shift) % 12 for value in task["expected"][name]
        ]
    for pair in task["contract"]["motif_pairs"]:
        pair["a_pitches"] = [value + shift for value in pair["a_pitches"]]
        pair["b_pitches"] = [value + shift for value in pair["b_pitches"]]
    task["id"] = f"{cohort}-comprehension-analysis-v{variant_offset + index}"
    task["variant"] = variant_offset + index
    task["difficulty"] = FULL_SUITE
    task["case_semantic_sha256"] = analysis_case_hashes(task)
    return refresh_task(task)


def voice_affine_expected(
    source: list[dict[str, Any]], contract: dict[str, Any]
) -> list[dict[str, Any]]:
    return v18.voice_affine_expected(source, contract)


def affine_task(
    index: int, cohort: str, seed: int, variant_offset: int
) -> dict[str, Any]:
    """Return one seed-dependent voice-conditioned affine continuation."""

    rng = random.Random(seed * 1009 + index * 7919)
    variant = variant_offset + index
    voices = ["bass", "lead", "inner", "lead", "bass", "inner", "lead", "bass"]
    rng.shuffle(voices)
    starts = [Fraction(position, 2) for position in range(8)]
    durations = [Fraction(rng.choice((1, 2, 3, 4)), 4) for _ in starts]
    anchors = {"bass": 45, "inner": 57, "lead": 67}
    source = core.sort_notes(
        [
            core.note(
                f"af-src-{variant}-{position + 1}",
                voice,
                starts[position],
                durations[position],
                anchors[voice] + rng.randrange(0, 12),
                68 + rng.randrange(0, 25),
            )
            for position, voice in enumerate(voices)
        ]
    )
    factors = ("1/2", "3/4", "1", "5/4", "3/2")
    contract = {
        "operation": "voice-conditioned-affine",
        "output_ids": [
            f"af-out-{variant}-{position + 1}" for position in range(len(source))
        ],
        "voice_rules": {
            voice: {
                "axis": anchors[voice] + 6 + rng.randrange(-2, 4),
                "semitones": rng.choice((-5, -3, -2, 2, 3, 5)),
                "output_start": fraction_text(Fraction(rng.randrange(12, 25), 2)),
                "rhythmic_factor": rng.choice(factors),
            }
            for voice in ("bass", "inner", "lead")
        },
    }
    expected = voice_affine_expected(source, contract)
    if [row["id"] for row in expected] == contract["output_ids"]:
        rule = contract["voice_rules"]["lead"]
        rule["output_start"] = fraction_text(core.fraction(rule["output_start"]) + 4)
        expected = voice_affine_expected(source, contract)
    task = {
        "schema": core.SCHEMA,
        "id": f"{cohort}-continuation-motif-v{variant}",
        "cohort": cohort,
        "family": "continuation-motif",
        "difficulty": FULL_SUITE,
        "variant": variant,
        "origin": "Generated by Ghostnote for an MIT-licensed benchmark.",
        "license": "MIT",
        "source": source,
        "contract": contract,
        "expected": expected,
    }
    return refresh_task(task)


def transpose_notes(notes: list[dict[str, Any]], semitones: int) -> None:
    for row in notes:
        row["pitch"] += semitones
        if not 0 <= row["pitch"] <= 127:
            raise ValueError("A transposed pitch is outside the MIDI range")


def source_notes(task: dict[str, Any]) -> list[dict[str, Any]]:
    source = task.get("source")
    if isinstance(source, list):
        return source
    if not isinstance(source, dict):
        return []
    if isinstance(source.get("notes"), list):
        return source["notes"]
    nested = source.get("source")
    if isinstance(nested, dict) and isinstance(nested.get("notes"), list):
        return nested["notes"]
    if isinstance(nested, list):
        return nested
    if isinstance(source.get("seed"), list):
        return source["seed"]
    return []


def legacy_task(
    family: str, index: int, cohort: str, seed: int, variant_offset: int
) -> dict[str, Any]:
    """Create a fresh full-suite task from the frozen Phase 8c3 theory model."""

    source_index = 40 + ((seed * 17 + index * 29) % 83)
    variant = variant_offset + index
    task = symbolic.task(family, source_index, cohort)
    task["id"] = f"{cohort}-{family}-v{variant}"
    task["variant"] = variant
    task["difficulty"] = FULL_SUITE
    rng = random.Random(seed * 3571 + index * 101 + sum(map(ord, family)))
    shift = rng.randrange(-3, 4)
    if family == "comprehension-structure":
        transpose_notes(task["source"]["notes"], shift)
        task["source"]["tempo"] = 92 + rng.randrange(0, 49)
        task["source"]["sha256"] = core.digest(
            {name: value for name, value in task["source"].items() if name != "sha256"}
        )
        task["expected"] = deepcopy(task["source"]["notes"])
    elif family == "generation-progression":
        contract = task["contract"]
        transpose = rng.randrange(0, 12)
        contract["pitch_classes"] = [
            sorted((pitch + transpose) % 12 for pitch in chord)
            for chord in contract["pitch_classes"]
        ]
        contract["bass_pitch_classes"] = [
            (pitch + transpose) % 12 for pitch in contract["bass_pitch_classes"]
        ]
        contract["key_tonic_pc"] = (contract["key_tonic_pc"] + transpose) % 12
        contract["maximum_total_voice_leading"] = 32 + index
    elif family == "generation-melody":
        contract = task["contract"]
        contract["durations"][index % len(contract["durations"])] = fraction_text(
            Fraction(index + 2, 8)
        )
    elif family == "continuation-roles":
        contract = task["contract"]
        contract["maximum_role_leap"] = 7 + index
    elif family == "transformation-local":
        nested = task["source"]["source"]
        transpose_notes(nested["notes"], shift)
        nested["tempo"] = 96 + rng.randrange(0, 37)
        nested["sha256"] = core.digest(
            {name: value for name, value in nested.items() if name != "sha256"}
        )
        change = task["source"]["change"]
        if change["operation"] == "pitch":
            target = next(row for row in nested["notes"] if row["id"] == change["note_id"])
            change["pitch"] = target["pitch"] + 2
        task["expected"] = symbolic.local_expected(task["source"])
    elif family == "transformation-revoice":
        transpose_notes(task["source"]["source"], shift)
        task["source"]["range"] = [value + shift for value in task["source"]["range"]]
        task["expected"] = symbolic_scoring.revoice_expected(task["source"])
    elif family == "transformation-rhythm":
        transpose = rng.randrange(-5, 6)
        transpose_notes(task["source"]["source"], transpose)
        if task["source"]["operation"] == "groove":
            task["source"]["odd_offset"] = fraction_text(Fraction(1 + index % 3, 12))
        task["expected"] = symbolic.rhythm_expected(task["source"])
    else:
        raise ValueError(f"The family needs a dedicated generator: {family}")
    return refresh_task(task)


def expected_notes(task: dict[str, Any]) -> list[dict[str, Any]]:
    family = task["family"]
    if isinstance(task.get("expected"), list):
        return task["expected"]
    if family == "generation-progression":
        return symbolic_scoring.perfect_progression(task["contract"])
    if family == "generation-melody":
        return symbolic_scoring.perfect_melody(task["contract"])
    if family == "continuation-roles":
        return symbolic_scoring.perfect_roles(task["contract"])
    raise ValueError(f"The task has no document answer: {family}")


def serialization_task(
    index: int, cohort: str, seed: int, variant_offset: int
) -> dict[str, Any]:
    source = affine_task(index, cohort, seed, variant_offset + 70)
    variant = variant_offset + 80 + index
    return refresh_task(
        {
            "schema": core.SCHEMA,
            "id": f"{cohort}-document-serialization-v{variant}",
            "cohort": cohort,
            "family": "document-serialization",
            "difficulty": CONTROL,
            "variant": variant,
            "origin": "Generated by Ghostnote for an MIT-licensed benchmark.",
            "license": "MIT",
            "expected": deepcopy(source["expected"]),
            "target_notes": deepcopy(source["expected"]),
        }
    )


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
                affine_task(index, cohort, seed, variant_offset + 20)
                for index in range(UNIQUE_COUNTS[family])
            ]
        else:
            values = [
                legacy_task(family, index, cohort, seed, variant_offset)
                for index in range(UNIQUE_COUNTS[family])
            ]
        fixtures[family] = values
    fixtures["document-serialization"] = [
        serialization_task(index, cohort, seed, variant_offset)
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


def task_difficulty(task: dict[str, Any]) -> str:
    return task["difficulty"]


def constraint_checks(task: dict[str, Any], notes: list[dict[str, Any]]) -> dict[str, bool]:
    family = task["family"]
    if family == "generation-progression":
        return symbolic_scoring.score_progression(notes, task["contract"])
    if family == "generation-melody":
        return symbolic_scoring.score_melody(notes, task["contract"])
    if family == "continuation-roles":
        return symbolic_scoring.score_roles(notes, task["contract"])
    raise ValueError(f"The task does not use constraint scoring: {family}")


def task_instruction(task: dict[str, Any]) -> str:
    family = task["family"]
    if family == "comprehension-structure":
        return (
            "Reconstruct every source note. Preserve all six represented fields "
            "and canonical order."
        )
    if family == "comprehension-analysis":
        return core.analysis_instruction(task)
    if family == "generation-progression":
        return (
            "Realize this four-voice progression. Use bass, tenor, alto, and "
            "soprano once at each chord start. Multiple valid voicings are allowed. "
            f"Contract: {core.canonical(task['contract'])}"
        )
    if family == "generation-melody":
        return (
            "Create one lead melody that satisfies every contract component. "
            "The last four pitches transpose the first four. "
            f"Contract: {core.canonical(task['contract'])}"
        )
    if family == "continuation-motif":
        contract = task["contract"]
        rules = "; ".join(
            f"{voice}(axis={rule['axis']},semitones={rule['semitones']},"
            f"output_start={rule['output_start']},rhythmic_factor={rule['rhythmic_factor']})"
            for voice, rule in sorted(contract["voice_rules"].items())
        )
        return (
            f"Apply the voice-conditioned affine operation to all {len(task['source'])} "
            "source notes in canonical source order. Assign output IDs "
            + ",".join(contract["output_ids"])
            + " in that order. Calculate pitch=(2*axis)-source_pitch+semitones. "
            "Calculate start=output_start+(source_start-first_voice_start)*"
            "rhythmic_factor. Calculate duration=source_duration*rhythmic_factor. "
            "Preserve voice and velocity. Sort after all calculations. Rules: "
            + rules
        )
    if family == "continuation-roles":
        return (
            "Continue with exactly four bass notes and four lead notes. Satisfy "
            f"this fixed-harmony contract: {core.canonical(task['contract'])}"
        )
    if family == "transformation-local":
        return (
            "Apply only this local change. Preserve all unrelated notes exactly. "
            f"Change: {core.canonical(task['source']['change'])}"
        )
    if family == "transformation-revoice":
        source = task["source"]
        return (
            f"Revoice each chord with operation={source['operation']}. Preserve "
            f"pitch classes, starts, durations, and range {source['range']}."
        )
    if family == "transformation-rhythm":
        source = task["source"]
        if source["operation"] == "groove":
            rule = (
                f"add {source['odd_offset']} beat to each odd-indexed start and "
                "preserve durations"
            )
        else:
            rule = f"multiply every start and duration by {source['factor']}"
        return f"Apply only this rhythm transform: {rule}. Preserve pitch and voice."
    if family == "document-serialization":
        return (
            "Serialize exactly these target notes. Do not calculate or change a "
            f"value. Target notes: {core.canonical(task['target_notes'])}"
        )
    raise ValueError(f"Unknown family: {family}")


def suite_screen(corpus: dict[str, Any]) -> dict[str, Any]:
    tasks = [task for values in corpus["fixtures"].values() for task in values]
    affine = corpus["fixtures"]["continuation-motif"]
    controls = corpus["fixtures"]["document-serialization"]
    checks = {
        "nine-decision-families": set(DECISION_FAMILIES)
        == set(symbolic.TASK_FAMILIES),
        "seven-fixtures-per-decision-family": all(
            len(corpus["fixtures"][family]) == 7 for family in DECISION_FAMILIES
        ),
        "two-literal-controls": len(controls) == 2,
        "full-hashes-are-unique": len({task["sha256"] for task in tasks}) == len(tasks),
        "content-hashes-are-unique": len({task["content_sha256"] for task in tasks})
        == len(tasks),
        "analysis-cases-are-unique": len(
            {
                value
                for task in corpus["fixtures"]["comprehension-analysis"]
                for value in task["case_semantic_sha256"]
            }
        )
        == 21,
        "analysis-has-three-cases": all(
            task["contract"]["case_count"] == 3
            for task in corpus["fixtures"]["comprehension-analysis"]
        ),
        "affine-rules-cover-source": all(
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
    return {"checks": checks, "all_pass": all(checks.values())}
