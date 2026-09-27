#!/usr/bin/env python3
"""Build the fresh Phase 8c3 symbolic-format cohort."""

from __future__ import annotations

import importlib.util
from copy import deepcopy
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
V1_ROOT = PACKAGE_ROOT.parent / "symbolic-format-v1"


def load_module(name: str, path: Path) -> Any:
    """Load one frozen module without changing it."""

    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


v1 = load_module("ghostnote_symbolic_format_v1_corpus_for_v2", V1_ROOT / "corpus.py")

CORPUS_SCHEMA = "ghostnote-symbolic-format-corpus-v2"
LICENSE = v1.LICENSE
TASK_FAMILIES = v1.TASK_FAMILIES
canonical = v1.canonical
digest = v1.digest
fraction = v1.fraction
fraction_text = v1.fraction_text
note = v1.note
sort_notes = v1.sort_notes


def transpose_notes(values: list[dict[str, Any]], semitones: int) -> list[dict[str, Any]]:
    """Transpose notes while keeping all non-pitch fields unchanged."""

    result = deepcopy(values)
    for value in result:
        value["pitch"] += semitones
        if not 0 <= value["pitch"] <= 127:
            raise ValueError("A transposed pitch is outside the MIDI range")
    return sort_notes(result)


def transpose_pitch_classes(values: list[list[int]], semitones: int) -> list[list[int]]:
    return [sorted((pitch + semitones) % 12 for pitch in chord) for chord in values]


def fresh_body(family: str, source_index: int) -> dict[str, Any]:
    """Return one meaningful variant that is disjoint from earlier cohorts."""

    base = v1.task(family, source_index, "source")
    if family == "comprehension-structure":
        source = deepcopy(base["source"])
        source["notes"] = transpose_notes(source["notes"], 1)
        source["tempo"] += 17
        source["sha256"] = digest({name: value for name, value in source.items() if name != "sha256"})
        return {"source": source, "expected": source["notes"]}
    if family == "comprehension-analysis":
        source = deepcopy(base["source"])
        source["notes"] = transpose_notes(source["notes"], 1)
        evidence = source["analysis_evidence"]
        evidence["key_tonic_pc"] = (evidence["key_tonic_pc"] + 1) % 12
        evidence["motif_a_pitches"] = [value + 1 for value in evidence["motif_a_pitches"]]
        evidence["motif_b_pitches"] = [value + 1 for value in evidence["motif_b_pitches"]]
        source["expected"]["root_pc"] = (source["expected"]["root_pc"] + 1) % 12
        source["expected"]["bass_pc"] = (source["expected"]["bass_pc"] + 1) % 12
        source["sha256"] = digest({name: value for name, value in source.items() if name != "sha256"})
        return {"source": source, "expected": source["expected"]}
    if family == "generation-progression":
        contract = deepcopy(base["contract"])
        contract["pitch_classes"] = transpose_pitch_classes(contract["pitch_classes"], 5)
        contract["bass_pitch_classes"] = [(value + 5) % 12 for value in contract["bass_pitch_classes"]]
        contract["key_tonic_pc"] = (contract["key_tonic_pc"] + 5) % 12
        contract["maximum_total_voice_leading"] += source_index % 4
        return {"contract": contract}
    if family == "generation-melody":
        contract = deepcopy(base["contract"])
        contract["range"] = [
            contract["range"][0] - (source_index - 20),
            contract["range"][1] + 1,
        ]
        contract["scale_pitch_classes"] = [(value + 1) % 12 for value in contract["scale_pitch_classes"]]
        contract["scale_pitch_classes"].sort()
        contract["strong_beat_chord_pitch_classes"] = [
            (value + 1) % 12 for value in contract["strong_beat_chord_pitch_classes"]
        ]
        contract["strong_beat_chord_pitch_classes"].sort()
        contract["cadence_pitch_class"] = (contract["cadence_pitch_class"] + 1) % 12
        return {"contract": contract}
    if family == "continuation-motif":
        source = deepcopy(base["source"])
        source["seed"] = transpose_notes(source["seed"], 4)
        source["axis"] += 4
        return {"source": source, "expected": transpose_notes(v1.motif_expected(source), 0)}
    if family == "continuation-roles":
        contract = deepcopy(base["contract"])
        contract["harmony_pitch_classes"] = transpose_pitch_classes(
            contract["harmony_pitch_classes"], 1
        )
        contract["ranges"] = {
            name: [value + 1 for value in limits]
            for name, limits in contract["ranges"].items()
        }
        contract["cadence_pitch_class"] = (contract["cadence_pitch_class"] + 1) % 12
        contract["maximum_role_leap"] += source_index - 20
        return {"contract": contract}
    if family == "transformation-local":
        original = deepcopy(base["source"]["source"])
        original["notes"] = transpose_notes(original["notes"], 2)
        original["tempo"] += 19
        original["sha256"] = digest(
            {name: value for name, value in original.items() if name != "sha256"}
        )
        target = original["notes"][source_index % len(original["notes"])]
        change = {
            "operation": "pitch",
            "note_id": target["id"],
            "pitch": target["pitch"] + 1,
        }
        wrapped = {"source": original, "change": change}
        return {"source": wrapped, "expected": v1.local_expected(wrapped)}
    if family == "transformation-revoice":
        source = deepcopy(base["source"])
        source["source"] = transpose_notes(source["source"], 2)
        source["range"] = [value + 2 for value in source["range"]]
        return {"source": source}
    if family == "transformation-rhythm":
        source = deepcopy(base["source"])
        source["source"] = transpose_notes(source["source"], 6)
        source["odd_offset"] = "1/12"
        return {"source": source, "expected": v1.rhythm_expected(source)}
    raise ValueError(f"Unknown family: {family}")


def task(family: str, variant: int, cohort: str, source_index: int) -> dict[str, Any]:
    body = fresh_body(family, source_index)
    value = {
        "schema": CORPUS_SCHEMA,
        "id": f"{cohort}-{family}-v{variant}",
        "cohort": cohort,
        "family": family,
        "variant": variant,
        "origin": "generated for Ghostnote under the repository MIT license",
        "license": LICENSE,
        **body,
    }
    value["semantic_sha256"] = digest({"family": family, **body})
    value["sha256"] = digest(value)
    return value


def make_corpus() -> dict[str, Any]:
    screen = {
        family: [task(family, 0, "screen", 20)] for family in TASK_FAMILIES
    }
    retained = {
        family: [task(family, variant, "retained", 20 + variant) for variant in range(1, 8)]
        for family in TASK_FAMILIES
    }
    secondary = [
        {"id": "malformed-repair", "kind": "malformed", "expected": "repair"},
        {"id": "masked-refusal", "kind": "masked", "expected": "refuse"},
        {"id": "ledger-disagreement", "kind": "ledger", "expected": "reject"},
        {"id": "duplicate-id", "kind": "identity", "expected": "reject"},
        {"id": "unsupported-native", "kind": "unsupported", "expected": "unsupported"},
    ]
    value = {
        "schema": CORPUS_SCHEMA,
        "license": LICENSE,
        "screen": screen,
        "retained": retained,
        "secondary": secondary,
    }
    value["sha256"] = digest(value)
    return value


def corpus_manifest(corpus: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": CORPUS_SCHEMA,
        "license": LICENSE,
        "screen_fixtures": sum(len(values) for values in corpus["screen"].values()),
        "retained_fixtures": sum(len(values) for values in corpus["retained"].values()),
        "retained_variants_per_family": 7,
        "secondary_fixtures": len(corpus["secondary"]),
        "sha256": corpus["sha256"],
    }
