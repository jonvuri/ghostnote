#!/usr/bin/env python3
"""Build the generated corpus for the symbolic-format v1 benchmark."""

from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from fractions import Fraction
from typing import Any


CORPUS_SCHEMA = "ghostnote-symbolic-format-corpus-v1"
LICENSE = "MIT"
TASK_FAMILIES = (
    "comprehension-structure",
    "comprehension-analysis",
    "generation-progression",
    "generation-melody",
    "continuation-motif",
    "continuation-roles",
    "transformation-local",
    "transformation-revoice",
    "transformation-rhythm",
)


def canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def fraction(value: str | int | Fraction) -> Fraction:
    return value if isinstance(value, Fraction) else Fraction(str(value))


def fraction_text(value: str | int | Fraction) -> str:
    result = fraction(value)
    return str(result.numerator) if result.denominator == 1 else f"{result.numerator}/{result.denominator}"


def note(
    note_id: str,
    voice: str,
    start: str | int,
    duration: str | int,
    pitch: int,
    velocity: int = 84,
) -> dict[str, Any]:
    return {
        "id": note_id,
        "voice": voice,
        "start": fraction_text(start),
        "duration": fraction_text(duration),
        "pitch": pitch,
        "velocity": velocity,
    }


def sort_notes(values: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        values,
        key=lambda value: (
            fraction(value["start"]),
            value["voice"],
            value["pitch"],
            value["id"],
        ),
    )


def source_fixture(index: int) -> dict[str, Any]:
    """Return a compact source with meter, chords, voices, and exact offsets."""

    roots = (60, 62, 65, 67, 57, 60, 63)
    root = roots[index % len(roots)]
    meters = (("4/4", "3/4"), ("3/4", "5/4"), ("5/4", "4/4"))
    meter_a, meter_b = meters[index % len(meters)]
    first_length = int(meter_a.split("/")[0])
    offsets = (("0", "2/3", "4/3", "2"), ("0", "1/3", "1", "5/3"), ("0", "3/4", "3/2", "9/4"))
    starts = offsets[index % len(offsets)]
    melody = [root + value for value in (0, 2, 4, 7)]
    lead_duration = ("1/3", "1/3", "1/2")[index % 3]
    notes = [
        note(f"s{index}-lead-{position}", "lead", start, lead_duration, pitch, 86 + position)
        for position, (start, pitch) in enumerate(zip(starts, melody), start=1)
    ]
    for chord_index, start in enumerate(("0", str(first_length))):
        chord_root = root + (5 if chord_index else 0)
        for position, interval in enumerate((0, 4, 7), start=1):
            notes.append(
                note(
                    f"s{index}-keys-{chord_index + 1}-{position}",
                    "keys",
                    start,
                    str(first_length),
                    chord_root + interval,
                    70 + position,
                )
            )
    notes.extend(
        [
            note(f"s{index}-bass-1", "bass", 0, first_length, root - 24, 78),
            note(f"s{index}-bass-2", "bass", first_length, first_length, root - 19, 80),
        ]
    )
    value = {
        "meter": [meter_a, meter_b],
        "bar_starts": ["0", str(first_length)],
        "tempo": 108 + index,
        "notes": sort_notes(notes),
    }
    value["sha256"] = digest(value)
    return value


def analysis_fixture(index: int) -> dict[str, Any]:
    roots = (60, 62, 65, 67, 57, 60, 63)
    root = roots[index % len(roots)]
    qualities = (
        ("major", (0, 4, 7), "I6", 1),
        ("minor", (0, 3, 7), "i", 0),
        ("dominant-seventh", (0, 4, 7, 10), "V7", 0),
    )
    quality, intervals, function, inversion = qualities[index % len(qualities)]
    ordered = list(intervals)
    if inversion:
        ordered = ordered[inversion:] + [value + 12 for value in ordered[:inversion]]
    notes = [note(f"a{index}-{position}", "keys", 0, 2, root + interval, 76) for position, interval in enumerate(ordered)]
    motif_relation = ("transposition", "inversion", "augmentation")[index % 3]
    motif_a = [60, 62, 65]
    if motif_relation == "transposition":
        motif_b = [62, 64, 67]
        motif_durations = ["1", "1", "1"]
    elif motif_relation == "inversion":
        motif_b = [60, 58, 55]
        motif_durations = ["1", "1", "1"]
    else:
        motif_b = list(motif_a)
        motif_durations = ["2", "2", "2"]
    value = {
        "meter": ["4/4"],
        "bar_starts": ["0"],
        "tempo": 112,
        "notes": sort_notes(notes),
        "analysis_evidence": {
            "key_tonic_pc": root % 12 if function != "V7" else (root - 7) % 12,
            "motif_a_pitches": motif_a,
            "motif_b_pitches": motif_b,
            "motif_a_durations": ["1", "1", "1"],
            "motif_b_durations": motif_durations,
            "rhythm_onsets": ["0"],
        },
        "expected": {
            "root_pc": root % 12,
            "bass_pc": (root + ordered[0]) % 12,
            "quality": quality,
            "inversion": inversion,
            "function": function,
            "motif_relation": motif_relation,
            "rhythm": "sustained",
        },
    }
    value["sha256"] = digest(value)
    return value


def progression_contract(index: int) -> dict[str, Any]:
    transposition = index % 3
    pitch_classes = [
        sorted((value + transposition) % 12 for value in chord)
        for chord in ((0, 4, 7), (2, 5, 9), (7, 11, 2, 5), (0, 4, 7))
    ]
    return {
        "meter": "4/4",
        "chord_starts": ["0", "1", "2", "3"],
        "pitch_classes": pitch_classes,
        "bass_pitch_classes": [pitch_classes[0][1], pitch_classes[1][0], pitch_classes[2][0], pitch_classes[3][0]],
        "voice_ranges": {"bass": [40, 59], "tenor": [48, 67], "alto": [55, 74], "soprano": [60, 81]},
        "maximum_total_voice_leading": 34,
        "cadence": "authentic",
        "key_tonic_pc": transposition,
    }


def melody_contract(index: int) -> dict[str, Any]:
    tonic = (0, 2, 5)[index % 3]
    starts = (["0", "1/2", "1", "3/2", "2", "5/2", "3", "7/2"], ["0", "2/3", "1", "5/3", "2", "8/3", "3", "11/3"], ["0", "1/3", "1", "4/3", "2", "7/3", "3", "10/3"])[index % 3]
    return {
        "meter": "4/4",
        "starts": starts,
        "durations": ["1/2"] * 8,
        "range": [60 + tonic, 79 + tonic],
        "scale_pitch_classes": sorted((tonic + value) % 12 for value in (0, 2, 3, 5, 7, 9, 10)),
        "strong_beat_chord_pitch_classes": sorted((tonic + value) % 12 for value in (0, 3, 7)),
        "motif_transposition": 5,
        "cadence_pitch_class": tonic,
        "note_count": 8,
    }


def motif_fixture(index: int) -> dict[str, Any]:
    seed = [60 + index, 62 + index, 65 + index, 64 + index]
    operations = ("transpose", "invert", "augment")
    operation = operations[index % len(operations)]
    value = {
        "seed": [note(f"m{index}-{position}", "lead", position, 1, pitch, 88) for position, pitch in enumerate(seed)],
        "operation": operation,
        "amount": 3 if operation == "transpose" else 2,
        "axis": seed[0],
    }
    return value


def motif_expected(value: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for position, source in enumerate(value["seed"]):
        pitch = source["pitch"]
        duration = fraction(source["duration"])
        start = Fraction(4 + position)
        if value["operation"] == "transpose":
            pitch += value["amount"]
        elif value["operation"] == "invert":
            pitch = value["axis"] - (pitch - value["axis"])
        else:
            start = Fraction(4 + position * value["amount"])
            duration *= value["amount"]
        result.append(note(f"m{position + 1}", "lead", start, duration, pitch, 88))
    return sort_notes(result)


def role_contract(index: int) -> dict[str, Any]:
    tonic = (0, 2, 5)[index % 3]
    return {
        "starts": ["4", "5", "6", "7"],
        "harmony_pitch_classes": [
            sorted((tonic + value) % 12 for value in chord)
            for chord in ((0, 3, 7), (5, 9, 0), (7, 10, 2), (0, 3, 7))
        ],
        "ranges": {"bass": [36 + tonic, 55 + tonic], "lead": [60 + tonic, 79 + tonic]},
        "cadence_pitch_class": tonic,
        "maximum_role_leap": 7,
    }


def local_fixture(index: int) -> dict[str, Any]:
    source = source_fixture(index)
    target = deepcopy(source["notes"][index % len(source["notes"])])
    operations = ("pitch", "timing", "delete")
    operation = operations[index % len(operations)]
    change: dict[str, Any] = {"operation": operation, "note_id": target["id"]}
    if operation == "pitch":
        change["pitch"] = target["pitch"] + 2
    elif operation == "timing":
        change["start"] = fraction_text(fraction(target["start"]) + Fraction(1, 6))
    return {"source": source, "change": change}


def local_expected(value: dict[str, Any]) -> list[dict[str, Any]]:
    result = deepcopy(value["source"]["notes"])
    change = value["change"]
    if change["operation"] == "delete":
        result = [item for item in result if item["id"] != change["note_id"]]
    else:
        for item in result:
            if item["id"] == change["note_id"]:
                field = "start" if change["operation"] == "timing" else change["operation"]
                item[field] = change[field]
    return sort_notes(result)


def revoice_fixture(index: int) -> dict[str, Any]:
    roots = (48, 50, 53, 55, 45, 48, 51)
    root = roots[index % len(roots)]
    source = [
        note(f"rv{index}-{chord}-{position}", "keys", chord, 1, root + chord * 2 + interval, 78)
        for chord in range(4)
        for position, interval in enumerate((0, 4, 7, 11), start=1)
    ]
    operations = ("drop-2", "first-inversion", "nearest")
    return {
        "source": sort_notes(source),
        "operation": operations[index % len(operations)],
        "range": [43, 79],
    }


def rhythm_fixture(index: int) -> dict[str, Any]:
    source = [note(f"rh{index}-{position}", "lead", Fraction(position, 2), Fraction(1, 2), 60 + position, 82) for position in range(6)]
    operations = ("augment", "diminish", "groove")
    operation = operations[index % len(operations)]
    return {
        "source": sort_notes(source),
        "operation": operation,
        "factor": "2" if operation == "augment" else "1/2",
        "odd_offset": "1/6",
    }


def rhythm_expected(value: dict[str, Any]) -> list[dict[str, Any]]:
    result = deepcopy(value["source"])
    if value["operation"] in {"augment", "diminish"}:
        factor = fraction(value["factor"])
        for item in result:
            item["start"] = fraction_text(fraction(item["start"]) * factor)
            item["duration"] = fraction_text(fraction(item["duration"]) * factor)
    else:
        for position, item in enumerate(result):
            if position % 2:
                item["start"] = fraction_text(fraction(item["start"]) + fraction(value["odd_offset"]))
    return sort_notes(result)


def task(family: str, variant: int, cohort: str) -> dict[str, Any]:
    if family == "comprehension-structure":
        source = source_fixture(variant)
        body = {"source": source, "expected": source["notes"]}
    elif family == "comprehension-analysis":
        source = analysis_fixture(variant)
        body = {"source": source, "expected": source["expected"]}
    elif family == "generation-progression":
        body = {"contract": progression_contract(variant)}
    elif family == "generation-melody":
        body = {"contract": melody_contract(variant)}
    elif family == "continuation-motif":
        source = motif_fixture(variant)
        body = {"source": source, "expected": motif_expected(source)}
    elif family == "continuation-roles":
        body = {"contract": role_contract(variant)}
    elif family == "transformation-local":
        source = local_fixture(variant)
        body = {"source": source, "expected": local_expected(source)}
    elif family == "transformation-revoice":
        body = {"source": revoice_fixture(variant)}
    elif family == "transformation-rhythm":
        source = rhythm_fixture(variant)
        body = {"source": source, "expected": rhythm_expected(source)}
    else:
        raise ValueError(f"Unknown family: {family}")
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
    value["sha256"] = digest(value)
    return value


def make_corpus() -> dict[str, Any]:
    development = {family: [task(family, 0, "development")] for family in TASK_FAMILIES}
    retained = {family: [task(family, index, "retained") for index in range(1, 8)] for family in TASK_FAMILIES}
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
        "development": development,
        "retained": retained,
        "secondary": secondary,
    }
    value["sha256"] = digest(value)
    return value


def corpus_manifest(corpus: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": CORPUS_SCHEMA,
        "license": LICENSE,
        "development_fixtures": sum(len(values) for values in corpus["development"].values()),
        "retained_fixtures": sum(len(values) for values in corpus["retained"].values()),
        "retained_variants_per_family": 7,
        "secondary_fixtures": len(corpus["secondary"]),
        "sha256": corpus["sha256"],
    }
