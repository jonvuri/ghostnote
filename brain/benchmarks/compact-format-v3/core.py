#!/usr/bin/env python3
"""Define the Phase 8c2.2 formats, tasks, and scorers."""

from __future__ import annotations

import hashlib
import importlib.util
import itertools
import json
import re
from collections import defaultdict
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
from typing import Any, Callable


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent
V2_ROOT = BENCHMARKS_ROOT / "compact-format-v2"


def load_module(name: str, path: Path) -> Any:
    """Load one frozen module without changing its package."""
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


v2 = load_module("ghostnote_compact_format_v2", V2_ROOT / "benchmark.py")

SCHEMA = "ghostnote-compact-format-v3"
CORPUS_SCHEMA = "ghostnote-compact-format-corpus-v3"
ARMS = (
    "compact-bar-v1",
    "label-only-compact",
    "grouped-label-compact",
    "exact-json",
    "midi-like-native",
)
IDENTITY_ARMS = ARMS[:-1]
DECISION_FAMILIES = (
    "generation-progression",
    "continuation-roles",
    "transformation-revoice",
)
REGRESSION_FAMILIES = ("generation-melody",)
GUARD_FAMILIES = (
    "comprehension-structure",
    "transformation-local",
    "transformation-rhythm",
    "continuation-motif",
)
TASK_FAMILIES = (*DECISION_FAMILIES, *REGRESSION_FAMILIES, *GUARD_FAMILIES)
VOICE_ORDER = ("bass", "tenor", "alto", "soprano")
FIELDS = ("id", "voice", "start", "duration", "pitch", "velocity")
MUSICAL_FIELDS = ("voice", "start", "duration", "pitch", "velocity")
COHORT_SPECS = {
    "calibration": {"decision": 3, "regression": 1, "guard": 1, "seed": 8221},
    "development": {"decision": 8, "regression": 4, "guard": 4, "seed": 8231},
    "holdout": {"decision": 8, "regression": 4, "guard": 4, "seed": 8241},
}


def canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def fraction(value: str | int | Fraction) -> Fraction:
    return value if isinstance(value, Fraction) else Fraction(str(value))


def fraction_text(value: str | int | Fraction) -> str:
    result = fraction(value)
    return str(result.numerator) if result.denominator == 1 else f"{result.numerator}/{result.denominator}"


def note(
    note_id: str,
    voice: str,
    start: str | int | Fraction,
    duration: str | int | Fraction,
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


def voice_key(value: str) -> tuple[int, str]:
    return (VOICE_ORDER.index(value), value) if value in VOICE_ORDER else (len(VOICE_ORDER), value)


def sort_notes(values: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        values,
        key=lambda value: (
            fraction(value["start"]),
            voice_key(str(value["voice"])),
            int(value["pitch"]),
            str(value["id"]),
        ),
    )


def normalize_notes(values: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for index, value in enumerate(values, start=1):
        result.append(
            {
                "id": str(value.get("id") or f"native-{index}"),
                "voice": str(value["voice"]),
                "start": fraction_text(value["start"]),
                "duration": fraction_text(value["duration"]),
                "pitch": int(value["pitch"]),
                "velocity": int(value.get("velocity", 84)),
            }
        )
    identities = [value["id"] for value in result]
    if len(identities) != len(set(identities)):
        raise ValueError("The payload has duplicate IDs")
    return sort_notes(result)


def projected(values: list[dict[str, Any]], fields: tuple[str, ...]) -> list[dict[str, Any]]:
    return [{field: value[field] for field in fields} for value in sort_notes(values)]


def notes_by_start(values: list[dict[str, Any]]) -> dict[Fraction, list[dict[str, Any]]]:
    result: dict[Fraction, list[dict[str, Any]]] = defaultdict(list)
    for value in values:
        result[fraction(value["start"])].append(value)
    return {start: sort_notes(notes) for start, notes in sorted(result.items())}


def render_grouped(notes: list[dict[str, Any]]) -> str:
    """Render one canonical grouped-label score."""
    lines = []
    for start, group in notes_by_start(notes).items():
        if len(group) == 1:
            value = group[0]
            lines.append(
                f"N ID {value['id']} VOICE {value['voice']} START {value['start']} "
                f"DURATION {value['duration']} PITCH {value['pitch']} VELOCITY {value['velocity']}"
            )
            continue
        durations = {value["duration"] for value in group}
        shared = len(durations) == 1
        header = f"G START {fraction_text(start)}"
        if shared:
            header += f" DURATION {group[0]['duration']}"
        lines.append(header)
        for value in group:
            duration = "" if shared else f" DURATION {value['duration']}"
            lines.append(
                f"SLOT {value['voice']} ID {value['id']}{duration} "
                f"PITCH {value['pitch']} VELOCITY {value['velocity']}"
            )
        lines.append("END")
    return "\n".join(lines)


def parse_grouped(text: str) -> list[dict[str, Any]]:
    """Parse grouped blocks and labeled event rows."""
    event_pattern = re.compile(
        r"N ID (\S+) VOICE (\S+) START (\S+) DURATION (\S+) PITCH (\d+) VELOCITY (\d+)"
    )
    group_pattern = re.compile(r"G START (\S+)(?: DURATION (\S+))?")
    slot_pattern = re.compile(
        r"SLOT (\S+) ID (\S+)(?: DURATION (\S+))? PITCH (\d+) VELOCITY (\d+)"
    )
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    result = []
    index = 0
    while index < len(lines):
        event_match = event_pattern.fullmatch(lines[index])
        if event_match:
            result.append(
                note(
                    event_match[1],
                    event_match[2],
                    event_match[3],
                    event_match[4],
                    int(event_match[5]),
                    int(event_match[6]),
                )
            )
            index += 1
            continue
        group_match = group_pattern.fullmatch(lines[index])
        if not group_match:
            raise ValueError(f"Invalid grouped-label row: {lines[index]}")
        start, shared_duration = group_match[1], group_match[2]
        index += 1
        slot_count = 0
        while index < len(lines) and lines[index] != "END":
            slot_match = slot_pattern.fullmatch(lines[index])
            if not slot_match:
                raise ValueError(f"Invalid grouped-label slot: {lines[index]}")
            duration = shared_duration or slot_match[3]
            if duration is None or (shared_duration is not None and slot_match[3] is not None):
                raise ValueError("A slot must use exactly one duration source")
            result.append(
                note(
                    slot_match[2],
                    slot_match[1],
                    start,
                    duration,
                    int(slot_match[4]),
                    int(slot_match[5]),
                )
            )
            slot_count += 1
            index += 1
        if index >= len(lines) or lines[index] != "END" or slot_count < 2:
            raise ValueError("A grouped block needs at least two slots and one END row")
        index += 1
    if not result:
        raise ValueError("The grouped-label payload has no notes")
    normalized = normalize_notes(result)
    if render_grouped(normalized) != "\n".join(lines):
        raise ValueError("The grouped-label payload is not in canonical order")
    return normalized


def render_events(arm: str, notes: list[dict[str, Any]], metadata: dict[str, Any], item_id: str) -> str:
    if arm == "grouped-label-compact":
        return render_grouped(notes)
    return v2.render_events(arm, notes, metadata, item_id)


def parse_events(arm: str, text: str) -> list[dict[str, Any]]:
    if arm == "grouped-label-compact":
        return parse_grouped(text)
    notes, _ = v2.parse_events(arm, text)
    return notes


def render_patch(arm: str, base_sha256: str, operation: dict[str, Any]) -> str:
    return v2.render_patch(arm, base_sha256, operation)


def parse_patch(arm: str, text: str) -> dict[str, Any]:
    return v2.parse_patch(arm, text)


def compile_patch(value: dict[str, Any], source: list[dict[str, Any]], base_sha256: str) -> list[dict[str, Any]]:
    return v2.compile_patch(value, source, base_sha256)


def finish_task(cohort: str, family: str, variant: int, body: dict[str, Any]) -> dict[str, Any]:
    semantic = {"family": family, **body}
    value = {
        "schema": CORPUS_SCHEMA,
        "id": f"{cohort}-{family}-v{variant}",
        "cohort": cohort,
        "family": family,
        "variant": variant,
        "origin": "generated for Ghostnote under the repository MIT license",
        "license": "MIT",
        **body,
        "semantic_sha256": digest(semantic),
    }
    value["sha256"] = digest(value)
    return value


def progression_task(cohort: str, variant: int, seed: int) -> dict[str, Any]:
    tonic = (seed + variant * 5) % 12
    duration = {"calibration": "1", "development": "3/4", "holdout": "2/3"}[cohort]
    offsets = ((0, 4, 7), (5, 9, 0), (7, 11, 2, 5), (0, 4, 7))
    contract = {
        "meter": "4/4",
        "chord_starts": ["0", "1", "2", "3"],
        "duration": duration,
        "pitch_classes": [sorted((tonic + value) % 12 for value in chord) for chord in offsets],
        "bass_pitch_classes": [tonic, (tonic + 5) % 12, (tonic + 7) % 12, tonic],
        "voice_ranges": {
            "bass": [36, 55],
            "tenor": [48, 67],
            "alto": [55, 74],
            "soprano": [62, 84],
        },
        "maximum_total_voice_leading": 54,
        "cadence_pitch_class": tonic,
    }
    return finish_task(cohort, "generation-progression", variant, {"contract": contract})


def role_task(cohort: str, variant: int, seed: int) -> dict[str, Any]:
    tonic = (seed + variant * 5) % 12
    start_base = {"calibration": 4, "development": 12, "holdout": 20}[cohort]
    offsets = ((0, 4, 7), (5, 9, 0), (2, 5, 9), (7, 11, 2), (0, 4, 7))
    contract = {
        "starts": [str(start_base + index) for index in range(5)],
        "harmony_pitch_classes": [sorted((tonic + value) % 12 for value in chord) for chord in offsets],
        "ranges": {"bass": [36, 55], "lead": [60, 84]},
        "cadence_pitch_class": tonic,
        "maximum_role_leap": 10,
        "duration": "1",
    }
    return finish_task(cohort, "continuation-roles", variant, {"contract": contract})


def revoice_task(cohort: str, variant: int, seed: int) -> dict[str, Any]:
    operation = ("nearest", "drop-2", "first-inversion")[variant % 3]
    root = 47 + ((seed + variant * 2) % 4)
    notes = []
    for chord, start in enumerate(("0", "1", "2")):
        chord_root = root + chord * 2
        for voice, interval, velocity in zip(VOICE_ORDER, (0, 4, 7, 11), (76, 78, 80, 82)):
            notes.append(note(f"{cohort[:3]}-rv{variant}-{chord + 1}-{voice}", voice, start, "1", chord_root + interval, velocity))
    contract = {
        "source": sort_notes(notes),
        "operation": operation,
        "range": [34, 86],
        "voice_ranges": {
            "bass": [34, 58],
            "tenor": [43, 69],
            "alto": [50, 78],
            "soprano": [57, 86],
        },
        "definitions": {
            "nearest": "Keep the first chord unchanged. For each later chord, select octave placements with the least total same-voice movement from the prior output chord. Accept every tied minimum.",
            "drop-2": "Lower the second-highest source pitch by one octave. Sort the four result pitches and assign them to bass, tenor, alto, and soprano.",
            "first-inversion": "Raise the lowest source pitch by one octave. Sort the four result pitches and assign them to bass, tenor, alto, and soprano.",
        },
    }
    return finish_task(cohort, "transformation-revoice", variant, {"contract": contract})


def melody_task(cohort: str, variant: int, seed: int) -> dict[str, Any]:
    tonic = (seed + variant * 5) % 12
    step = {"calibration": Fraction(1, 2), "development": Fraction(2, 5), "holdout": Fraction(1, 3)}[cohort]
    starts = [fraction_text(index * step) for index in range(8)]
    first = [60 + tonic + value for value in (0, 2, 4, 7)]
    transposition = 3
    pitches = first + [value + transposition for value in first]
    contract = {
        "meter": "4/4",
        "starts": starts,
        "durations": [fraction_text(step)] * 8,
        "range": [min(pitches) - 1, max(pitches) + 1],
        "allowed_pitch_classes": sorted({value % 12 for value in pitches}),
        "strong_beat_pitch_classes": sorted({pitches[index] % 12 for index in (0, 2, 4, 6)}),
        "motif_transposition": transposition,
        "cadence_pitch_class": pitches[-1] % 12,
        "note_count": 8,
        "perfect_pitches": pitches,
    }
    return finish_task(cohort, "generation-melody", variant, {"contract": contract})


def structure_source(cohort: str, variant: int, seed: int) -> dict[str, Any]:
    root = 52 + ((seed + variant * 3) % 7)
    notes = [
        note(f"{cohort[:3]}-st{variant}-lead-{index}", "lead", Fraction(index - 1, 2), "1/2", root + offset, 78 + index)
        for index, offset in enumerate((0, 5, 2, 7, 4, 9), start=1)
    ]
    for chord, start in enumerate(("0", "3/2"), start=1):
        for position, interval in enumerate((0, 4, 7), start=1):
            notes.append(note(f"{cohort[:3]}-st{variant}-pad-{chord}-{position}", "pad", start, "3/2", root - 12 + interval, 68 + position))
    notes.extend(
        (
            note(f"{cohort[:3]}-st{variant}-bass-1", "bass", "0", "3/2", root - 24, 74),
            note(f"{cohort[:3]}-st{variant}-bass-2", "bass", "3/2", "3/2", root - 19, 76),
        )
    )
    return {"notes": sort_notes(notes), "tempo": 96 + variant, "meters": ["3/4"], "harmonies": ["task-source"]}


def guard_task(cohort: str, family: str, variant: int, seed: int) -> dict[str, Any]:
    if family == "comprehension-structure":
        source = structure_source(cohort, variant, seed)
        return finish_task(cohort, family, variant, {"source": source, "expected": source["notes"]})
    if family == "transformation-local":
        source = structure_source(cohort, variant, seed)
        source["sha256"] = digest(source)
        target = source["notes"][3]
        change = {"operation": "set", "note_id": target["id"], "field": "velocity", "value": target["velocity"] + 5}
        expected = deepcopy(source["notes"])
        next(value for value in expected if value["id"] == target["id"])["velocity"] = change["value"]
        return finish_task(cohort, family, variant, {"source": {"source": source, "change": change}, "expected": sort_notes(expected)})
    if family == "transformation-rhythm":
        source = [note(f"{cohort[:3]}-ry{variant}-{index}", "perc", Fraction(index, 2), "1/4", 48 + index % 4, 80 + index) for index in range(8)]
        expected = deepcopy(source)
        for index, value in enumerate(expected):
            if index % 2:
                value["start"] = fraction_text(fraction(value["start"]) + Fraction(1, 4))
        return finish_task(cohort, family, variant, {"source": {"source": sort_notes(source), "odd_offset": "1/4"}, "expected": sort_notes(expected)})
    seed_notes = [note(f"{cohort[:3]}-mo{variant}-{index}", "lead", Fraction(index - 1, 2), "1/2", 60 + variant + offset, 86) for index, offset in enumerate((0, 3, 5, 2), start=1)]
    expected_ids = [f"{cohort[:3]}-mo-out-{variant}-{index}" for index in range(1, 5)]
    expected = [note(expected_ids[index], "lead", fraction(value["start"]) + 4, value["duration"], value["pitch"] + 2, value["velocity"]) for index, value in enumerate(seed_notes)]
    return finish_task(cohort, family, variant, {"source": {"source": sort_notes(seed_notes), "start_offset": "4", "pitch_offset": 2, "expected_ids": expected_ids}, "expected": sort_notes(expected)})


def make_corpus(cohort: str) -> dict[str, Any]:
    if cohort not in COHORT_SPECS:
        raise ValueError(f"Unknown cohort: {cohort}")
    spec = COHORT_SPECS[cohort]
    seed = int(spec["seed"])
    fixtures = {
        "generation-progression": [progression_task(cohort, index, seed) for index in range(int(spec["decision"]))],
        "continuation-roles": [role_task(cohort, index, seed) for index in range(int(spec["decision"]))],
        "transformation-revoice": [revoice_task(cohort, index, seed) for index in range(int(spec["decision"]))],
        "generation-melody": [melody_task(cohort, index, seed) for index in range(int(spec["regression"]))],
    }
    fixtures.update(
        {
            family: [guard_task(cohort, family, index, seed) for index in range(int(spec["guard"]))]
            for family in GUARD_FAMILIES
        }
    )
    value = {"schema": CORPUS_SCHEMA, "cohort": cohort, "license": "MIT", "fixtures": fixtures}
    value["sha256"] = digest(value)
    return value


def source_notes(value: dict[str, Any]) -> list[dict[str, Any]]:
    if value["family"] == "transformation-revoice":
        return value["contract"]["source"]
    source = value.get("source", {})
    nested = source.get("source", source) if isinstance(source, dict) else {}
    if isinstance(nested, list):
        return nested
    return nested.get("notes", []) if isinstance(nested, dict) else []


def progression_candidates(contract: dict[str, Any], index: int) -> list[tuple[int, int, int, int]]:
    choices = []
    for voice in VOICE_ORDER:
        low, high = contract["voice_ranges"][voice]
        values = [pitch for pitch in range(low, high + 1) if pitch % 12 in contract["pitch_classes"][index]]
        if voice == "bass":
            values = [pitch for pitch in values if pitch % 12 == contract["bass_pitch_classes"][index]]
        choices.append(values)
    return [
        pitches
        for pitches in itertools.product(*choices)
        if list(pitches) == sorted(pitches)
        and len(set(pitches)) == 4
        and set(contract["pitch_classes"][index]).issubset({pitch % 12 for pitch in pitches})
    ]


def perfect_progression(contract: dict[str, Any]) -> list[dict[str, Any]]:
    selected = []
    for index, start in enumerate(contract["chord_starts"]):
        choices = progression_candidates(contract, index)
        if not choices:
            raise ValueError("The progression contract has no valid voicing")
        pitches = min(choices, key=lambda item: sum(item) if not selected else sum(abs(a - b) for a, b in zip(selected[-1], item)))
        selected.append(pitches)
    return sort_notes(
        [
            note(f"pg-{chord + 1}-{voice}", voice, contract["chord_starts"][chord], contract["duration"], pitch, 82)
            for chord, pitches in enumerate(selected)
            for voice, pitch in zip(VOICE_ORDER, pitches)
        ]
    )


def score_progression(notes: list[dict[str, Any]], contract: dict[str, Any]) -> dict[str, bool]:
    groups = notes_by_start(notes)
    starts = [fraction(value) for value in contract["chord_starts"]]
    ordered = []
    complete = list(groups) == starts
    for start in starts:
        group = groups.get(start, [])
        by_voice = {value["voice"]: value["pitch"] for value in group}
        if set(by_voice) != set(VOICE_ORDER) or len(group) != 4 or any(value["duration"] != contract["duration"] for value in group):
            complete = False
            continue
        ordered.append(tuple(by_voice[voice] for voice in VOICE_ORDER))
    harmony = not complete or all(
        set(contract["pitch_classes"][index]).issubset({pitch % 12 for pitch in pitches})
        and pitches[0] % 12 == contract["bass_pitch_classes"][index]
        for index, pitches in enumerate(ordered)
    )
    ranges = not complete or all(
        contract["voice_ranges"][voice][0] <= pitches[index] <= contract["voice_ranges"][voice][1]
        for pitches in ordered
        for index, voice in enumerate(VOICE_ORDER)
    )
    no_crossing = not complete or all(list(pitches) == sorted(pitches) and len(set(pitches)) == 4 for pitches in ordered)
    movement = sum(sum(abs(a - b) for a, b in zip(previous, current)) for previous, current in zip(ordered, ordered[1:]))
    return {
        "chord_starts_and_named_voices": complete,
        "harmony_and_bass_inversion": harmony,
        "voice_ranges_and_crossing": ranges and no_crossing,
        "total_voice_leading": not complete or movement <= contract["maximum_total_voice_leading"],
        "cadence": not complete or ordered[-1][0] % 12 == contract["cadence_pitch_class"],
    }


def perfect_roles(contract: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    previous: dict[str, int | None] = {"bass": None, "lead": None}
    for index, start in enumerate(contract["starts"]):
        for voice in ("bass", "lead"):
            low, high = contract["ranges"][voice]
            choices = [pitch for pitch in range(low, high + 1) if pitch % 12 in contract["harmony_pitch_classes"][index]]
            if index == len(contract["starts"]) - 1 and voice == "lead":
                choices = [pitch for pitch in choices if pitch % 12 == contract["cadence_pitch_class"]]
            pitch = choices[0] if previous[voice] is None else min(choices, key=lambda item: abs(item - int(previous[voice])))
            previous[voice] = pitch
            result.append(note(f"rl-{voice}-{index + 1}", voice, start, contract["duration"], pitch, 79 if voice == "bass" else 89))
    return sort_notes(result)


def score_roles(notes: list[dict[str, Any]], contract: dict[str, Any]) -> dict[str, bool]:
    groups = notes_by_start(notes)
    starts = [fraction(value) for value in contract["starts"]]
    lanes = {
        voice: sorted([value for value in notes if value["voice"] == voice], key=lambda value: fraction(value["start"]))
        for voice in ("bass", "lead")
    }
    starts_pass = list(groups) == starts
    density = all(len(values) == len(starts) for values in lanes.values()) and len(notes) == len(starts) * 2
    ranges = all(
        value["voice"] in contract["ranges"]
        and contract["ranges"][value["voice"]][0] <= value["pitch"] <= contract["ranges"][value["voice"]][1]
        for value in notes
    )
    harmony = not starts_pass or all(
        all(value["pitch"] % 12 in contract["harmony_pitch_classes"][index] for value in groups.get(start, []))
        for index, start in enumerate(starts)
    )
    voice_leading = not density or not ranges or all(
        all(abs(after["pitch"] - before["pitch"]) <= contract["maximum_role_leap"] for before, after in zip(values, values[1:]))
        for values in lanes.values()
    )
    collisions = not starts_pass or not density or not ranges or all(
        len({value["pitch"] for value in groups.get(start, [])}) == 2 for start in starts
    )
    return {
        "starts": starts_pass,
        "role_density": density,
        "duration": all(value["duration"] == contract["duration"] for value in notes),
        "ranges": ranges,
        "harmony": harmony,
        "voice_leading": voice_leading,
        "no_collisions": collisions,
        "cadence": not density or (bool(lanes["lead"]) and lanes["lead"][-1]["pitch"] % 12 == contract["cadence_pitch_class"]),
    }


def perfect_melody(contract: dict[str, Any]) -> list[dict[str, Any]]:
    return [note(f"ml-{index + 1}", "lead", start, duration, pitch, 88) for index, (start, duration, pitch) in enumerate(zip(contract["starts"], contract["durations"], contract["perfect_pitches"]))]


def score_melody(notes: list[dict[str, Any]], contract: dict[str, Any]) -> dict[str, bool]:
    ordered = sort_notes(notes)
    pitches = [value["pitch"] for value in ordered]
    count = len(ordered) == contract["note_count"]
    rhythm = not count or (
        [value["start"] for value in ordered] == contract["starts"]
        and [value["duration"] for value in ordered] == contract["durations"]
    )
    in_range = not count or all(contract["range"][0] <= pitch <= contract["range"][1] for pitch in pitches)
    collection = not count or all(pitch % 12 in contract["allowed_pitch_classes"] for pitch in pitches)
    strong = [value for value in ordered if fraction(value["start"]).denominator == 1]
    strong_harmony = not count or all(value["pitch"] % 12 in contract["strong_beat_pitch_classes"] for value in strong)
    half = contract["note_count"] // 2
    motif = not count or not in_range or not collection or all(
        pitches[index + half] - pitches[index] == contract["motif_transposition"] for index in range(half)
    )
    return {
        "note_count": count,
        "rhythm": rhythm,
        "range": in_range,
        "pitch_collection": collection,
        "strong_beat_harmony": strong_harmony,
        "motif": motif,
        "cadence": not count or pitches[-1] % 12 == contract["cadence_pitch_class"],
    }


def score_local_result(
    compiled: list[dict[str, Any]],
    patch: dict[str, Any],
    source: list[dict[str, Any]],
    expected: list[dict[str, Any]],
) -> dict[str, bool]:
    stable = {item["id"] for item in compiled} == {item["id"] for item in source}
    sparse = len(patch.get("ops", [])) == 1
    exact = not stable or not sparse or sum(before == after for before, after in zip(source, compiled)) == len(source) - 1
    canonical_result = not stable or not sparse or not exact or projected(compiled, FIELDS) == projected(expected, FIELDS)
    return {
        "canonical_result": canonical_result,
        "stable_identity": stable,
        "exact_preservation": exact,
        "sparse_change": sparse,
    }


def revoice_target_pitches(source: list[int], operation: str) -> list[int]:
    ordered = sorted(source)
    if operation == "drop-2":
        ordered[-2] -= 12
        return sorted(ordered)
    if operation == "first-inversion":
        return sorted(ordered[1:] + [ordered[0] + 12])
    return ordered


def nearest_choices(source: list[int], previous: list[int], contract: dict[str, Any]) -> list[list[int]]:
    result = []
    for shifts in itertools.product((-12, 0, 12), repeat=4):
        pitches = [pitch + shift for pitch, shift in zip(sorted(source), shifts)]
        if pitches != sorted(pitches) or len(set(pitches)) != 4:
            continue
        if not all(contract["voice_ranges"][voice][0] <= pitch <= contract["voice_ranges"][voice][1] for voice, pitch in zip(VOICE_ORDER, pitches)):
            continue
        result.append(pitches)
    if not result:
        return []
    minimum = min(sum(abs(a - b) for a, b in zip(previous, item)) for item in result)
    return [item for item in result if sum(abs(a - b) for a, b in zip(previous, item)) == minimum]


def perfect_revoice(contract: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    previous: list[int] | None = None
    for chord, (start, source_group) in enumerate(notes_by_start(contract["source"]).items(), start=1):
        source_pitches = [value["pitch"] for value in source_group]
        if contract["operation"] == "nearest" and previous is not None:
            pitches = nearest_choices(source_pitches, previous, contract)[0]
        else:
            pitches = revoice_target_pitches(source_pitches, contract["operation"])
        previous = pitches
        for source_value, pitch in zip(source_group, pitches):
            result.append({**source_value, "pitch": pitch})
    return sort_notes(result)


def score_revoice(notes: list[dict[str, Any]], contract: dict[str, Any], identity_required: bool) -> dict[str, bool]:
    source = sort_notes(contract["source"])
    actual = sort_notes(notes)
    source_groups = notes_by_start(source)
    actual_groups = notes_by_start(actual)
    source_starts = list(source_groups)
    actual_starts = list(actual_groups)
    structure = len(actual) == len(source) and actual_starts == source_starts and all(len(actual_groups[start]) == len(source_groups[start]) for start in source_starts)
    source_by_id = {value["id"]: value for value in source}
    actual_ids = {value["id"] for value in actual}
    if actual_ids.issubset(source_by_id):
        pairs = [(source_by_id[value["id"]], value) for value in actual]
    else:
        pairs = list(zip(source, actual))
    identity = not identity_required or actual_ids.issubset(source_by_id)
    durations = all(before["duration"] == after["duration"] for before, after in pairs)
    voices = all(before["voice"] == after["voice"] for before, after in pairs)
    velocities = all(before["velocity"] == after["velocity"] for before, after in pairs)
    pitch_classes = not structure or all(
        sorted(value["pitch"] % 12 for value in actual_groups[start]) == sorted(value["pitch"] % 12 for value in source_groups[start])
        for start in source_starts
    )
    in_range = not structure or all(
        contract["range"][0] <= after["pitch"] <= contract["range"][1]
        and contract["voice_ranges"][before["voice"]][0] <= after["pitch"] <= contract["voice_ranges"][before["voice"]][1]
        for before, after in pairs
    )
    aligned_groups: dict[Fraction, list[tuple[tuple[int, str], int]]] = defaultdict(list)
    for before, after in pairs:
        aligned_groups[fraction(before["start"])].append((voice_key(before["voice"]), after["pitch"]))
    voice_order = not structure or all(
        len(aligned_groups[start]) == 4
        and [pitch for _, pitch in sorted(aligned_groups[start])] == sorted(pitch for _, pitch in aligned_groups[start])
        and len({pitch for _, pitch in aligned_groups[start]}) == 4
        for start in source_starts
    )
    prerequisites = structure and pitch_classes and in_range and voice_order and durations and voices and velocities and identity
    operation = True
    if prerequisites:
        previous = None
        for start in source_starts:
            source_pitches = [value["pitch"] for value in source_groups[start]]
            actual_pitches = [value["pitch"] for value in actual_groups[start]]
            if contract["operation"] == "nearest" and previous is not None:
                valid = actual_pitches in nearest_choices(source_pitches, previous, contract)
            else:
                valid = actual_pitches == revoice_target_pitches(source_pitches, contract["operation"])
            operation &= valid
            previous = actual_pitches
    return {
        "note_count_and_chord_starts": structure,
        "stable_identity": identity,
        "preserved_duration": durations,
        "preserved_voice": voices,
        "preserved_velocity": velocities,
        "chord_pitch_classes": pitch_classes,
        "operation": operation,
        "range_limits": in_range,
        "voice_order": voice_order,
    }


def score_response(arm: str, value: dict[str, Any], payload: str) -> dict[str, Any]:
    family = value["family"]
    try:
        if family == "transformation-local" and arm in IDENTITY_ARMS:
            source = value["source"]["source"]
            patch = parse_patch(arm, payload)
            compiled = compile_patch(patch, source["notes"], source["sha256"])
            checks = score_local_result(compiled, patch, source["notes"], value["expected"])
        else:
            notes = parse_events(arm, payload)
            if family == "generation-progression":
                checks = score_progression(notes, value["contract"])
            elif family == "continuation-roles":
                checks = score_roles(notes, value["contract"])
            elif family == "transformation-revoice":
                checks = score_revoice(notes, value["contract"], arm in IDENTITY_ARMS)
            elif family == "generation-melody":
                checks = score_melody(notes, value["contract"])
            else:
                fields = FIELDS if arm in IDENTITY_ARMS else MUSICAL_FIELDS
                checks = {"exact_relation": projected(notes, fields) == projected(value["expected"], fields)}
        return {"syntax_pass": True, "primary_pass": all(checks.values()), "checks": checks, "error": None}
    except (KeyError, TypeError, ValueError, json.JSONDecodeError, re.error) as error:
        return {"syntax_pass": False, "primary_pass": False, "checks": {}, "error": f"{type(error).__name__}: {error}"}


def perfect_payload(arm: str, value: dict[str, Any]) -> str:
    family = value["family"]
    if family == "generation-progression":
        notes = perfect_progression(value["contract"])
    elif family == "continuation-roles":
        notes = perfect_roles(value["contract"])
    elif family == "transformation-revoice":
        notes = perfect_revoice(value["contract"])
    elif family == "generation-melody":
        notes = perfect_melody(value["contract"])
    elif family == "transformation-local" and arm in IDENTITY_ARMS:
        change = value["source"]["change"]
        operation = {"op": "set", "id": change["note_id"], change["field"]: change["value"]}
        return render_patch(arm, value["source"]["source"]["sha256"], operation)
    else:
        notes = value["expected"]
    return render_events(arm, notes, value, value["id"])


def represented_source(arm: str, value: dict[str, Any]) -> str | None:
    notes = source_notes(value)
    return render_events(arm, notes, value, value["id"] + "-source") if notes else None


def output_grammar(arm: str, family: str) -> str:
    if family == "transformation-local" and arm in IDENTITY_ARMS:
        return v2.output_grammar(arm if arm != "grouped-label-compact" else "label-only-compact", family)
    if arm == "grouped-label-compact":
        return "Use one G START block for each onset with two or more notes. Put a shared DURATION on G when all slots share it. Use SLOT <voice> ID <id> [DURATION <duration>] PITCH <pitch> VELOCITY <velocity>. End each block with END. Use labeled N rows for single notes."
    return v2.output_grammar(arm, family)


def output_example(arm: str, family: str) -> str:
    if family == "transformation-local" and arm == "grouped-label-compact":
        return "PATCH abc\nSET n1 velocity=87"
    if arm == "grouped-label-compact":
        return "G START 0 DURATION 1\nSLOT bass ID n1 PITCH 48 VELOCITY 80\nSLOT lead ID n2 PITCH 67 VELOCITY 84\nEND"
    return v2.output_example(arm, family)


def task_instruction(value: dict[str, Any]) -> str:
    family = value["family"]
    if family == "generation-progression":
        return f"Realize the four-chord progression. Use bass, tenor, alto, and soprano once at each start. Satisfy this contract: {canonical(value['contract'])}"
    if family == "continuation-roles":
        return f"Continue with exactly five bass notes and five lead notes. Satisfy this contract: {canonical(value['contract'])}"
    if family == "transformation-revoice":
        contract = value["contract"]
        return f"Revoice every chord with operation={contract['operation']}. Preserve note count, chord starts, duration, voice, velocity, chord pitch classes, and IDs when the representation has IDs. Keep strict bass-to-soprano order. Use the stated ranges. Operation definitions and limits: {canonical({key: contract[key] for key in ('range', 'voice_ranges', 'definitions')})}"
    if family == "generation-melody":
        return f"Create one lead melody. Satisfy every stated constraint: {canonical(value['contract'])}"
    if family == "comprehension-structure":
        return "Reconstruct every represented note. Preserve each represented value."
    if family == "transformation-local":
        return f"Apply only this change: {canonical(value['source']['change'])}. Preserve all other represented values. Base SHA-256 is {value['source']['source']['sha256']}."
    if family == "transformation-rhythm":
        return f"Add {value['source']['odd_offset']} beat to each odd-indexed note start. Preserve every other represented value."
    source = value["source"]
    return f"Return four continuation notes with these IDs in order: {','.join(source['expected_ids'])}. Add {source['start_offset']} to each start and {source['pitch_offset']} to each pitch. Preserve duration, voice, and velocity."


def prompt_for(arm: str, value: dict[str, Any]) -> str:
    parts = [
        "Complete one deterministic symbolic-music task.",
        "Return one JSON object with exactly one string field named payload. Put the requested representation in that string. Do not add prose.",
        f"Representation arm: {arm}.",
        output_grammar(arm, value["family"]),
        "Follow this output example, but use the task values:\n" + output_example(arm, value["family"]),
        task_instruction(value),
    ]
    source = represented_source(arm, value)
    if source is not None:
        parts.extend(("SOURCE", source, "END SOURCE"))
    return "\n\n".join(parts)


def jobs(cohort: str) -> list[dict[str, Any]]:
    corpus = make_corpus(cohort)
    return [
        {"arm": arm, "family": family, "variant": value["variant"], "repeat": 0, "task": value}
        for arm in ARMS
        for family in TASK_FAMILIES
        for value in corpus["fixtures"][family]
    ]


def capability_manifest() -> dict[str, Any]:
    result = {}
    for arm in ARMS:
        identity = arm in IDENTITY_ARMS
        result[arm] = {
            "condition": "candidate" if arm == "grouped-label-compact" else "baseline-or-control",
            "one_canonical_score": True,
            "stable_identity": identity,
            "exact_preservation": identity,
            "sparse_patch": identity,
            "vertical_groups": arm == "grouped-label-compact",
            "native_score": arm == "midi-like-native",
        }
    return result


def mutate_one(value: dict[str, Any], path: tuple[str | int, ...], replacement: Any) -> dict[str, Any]:
    result = deepcopy(value)
    target: Any = result
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = replacement
    return result


def revoice_mutation_tests() -> list[dict[str, Any]]:
    task = revoice_task("calibration", 1, int(COHORT_SPECS["calibration"]["seed"]))
    contract = task["contract"]
    perfect = perfect_revoice(contract)
    cases: list[tuple[str, Callable[[list[dict[str, Any]]], None]]] = []

    def add(name: str, change: Callable[[list[dict[str, Any]]], None]) -> None:
        cases.append((name, change))

    add("stable_identity", lambda rows: rows[0].__setitem__("id", "changed-id"))
    add("preserved_duration", lambda rows: rows[0].__setitem__("duration", "1/2"))
    add("preserved_voice", lambda rows: rows[0].__setitem__("voice", "changed-voice"))
    add("preserved_velocity", lambda rows: rows[0].__setitem__("velocity", rows[0]["velocity"] + 1))
    add("chord_pitch_classes", lambda rows: rows[-1].__setitem__("pitch", rows[-1]["pitch"] + 1))
    add("operation", lambda rows: rows[-1].__setitem__("pitch", rows[-1]["pitch"] + 12))
    add("range_limits", lambda rows: rows[-1].__setitem__("pitch", rows[-1]["pitch"] + 36))
    add("voice_order", lambda rows: rows[0].__setitem__("pitch", rows[0]["pitch"] + 12))
    add("note_count_and_chord_starts", lambda rows: rows.pop())
    results = []
    for expected, change in cases:
        mutated = deepcopy(perfect)
        change(mutated)
        checks = score_revoice(mutated, contract, True)
        failures = sorted(name for name, passed in checks.items() if not passed)
        results.append({"property": expected, "failures": failures, "pass": failures == [expected]})
    return results


def progression_mutation_tests() -> list[dict[str, Any]]:
    task = progression_task("calibration", 0, int(COHORT_SPECS["calibration"]["seed"]))
    contract = task["contract"]
    perfect = perfect_progression(contract)
    cases = []
    mutations = {
        "chord_starts_and_named_voices": (lambda rows, _: rows.pop()),
        "harmony_and_bass_inversion": (lambda rows, _: rows[0].__setitem__("pitch", rows[0]["pitch"] + 1)),
        "voice_ranges_and_crossing": (lambda rows, _: rows[1].__setitem__("pitch", rows[1]["pitch"] - 12)),
        "total_voice_leading": (lambda rows, changed: changed.__setitem__("maximum_total_voice_leading", 0)),
        "cadence": (lambda rows, changed: changed.__setitem__("cadence_pitch_class", (changed["cadence_pitch_class"] + 1) % 12)),
    }
    for expected, change in mutations.items():
        rows = deepcopy(perfect)
        changed_contract = deepcopy(contract)
        change(rows, changed_contract)
        checks = score_progression(rows, changed_contract)
        failures = sorted(name for name, passed in checks.items() if not passed)
        cases.append({"property": expected, "failures": failures, "pass": failures == [expected]})
    return cases


def retained_family_mutation_tests() -> list[dict[str, Any]]:
    seed = int(COHORT_SPECS["calibration"]["seed"])
    results = []

    role = role_task("calibration", 0, seed)["contract"]
    role_rows = perfect_roles(role)
    role_cases: list[tuple[str, list[dict[str, Any]], dict[str, Any]]] = []
    rows = deepcopy(role_rows)
    rows[0]["start"] = "17/4"
    role_cases.append(("starts", rows, deepcopy(role)))
    rows = deepcopy(role_rows)
    rows.pop()
    role_cases.append(("role_density", rows, deepcopy(role)))
    rows = deepcopy(role_rows)
    rows[0]["duration"] = "1/2"
    role_cases.append(("duration", rows, deepcopy(role)))
    rows = deepcopy(role_rows)
    rows[0]["pitch"] -= 12
    role_cases.append(("ranges", rows, deepcopy(role)))
    rows = deepcopy(role_rows)
    rows[0]["pitch"] += 1
    role_cases.append(("harmony", rows, deepcopy(role)))
    changed = deepcopy(role)
    changed["maximum_role_leap"] = 0
    role_cases.append(("voice_leading", deepcopy(role_rows), changed))
    overlap = deepcopy(role)
    overlap["ranges"] = {"bass": [24, 72], "lead": [24, 84]}
    overlap["maximum_role_leap"] = 24
    overlap_rows = []
    for index, start in enumerate(overlap["starts"]):
        bass_choices = [pitch for pitch in range(42, 54) if pitch % 12 in overlap["harmony_pitch_classes"][index]]
        if index == len(overlap["starts"]) - 1:
            bass_choices = [pitch for pitch in bass_choices if pitch % 12 == overlap["cadence_pitch_class"]]
        bass = bass_choices[0]
        lead = bass + 12
        overlap_rows.extend((note(f"oc-b-{index}", "bass", start, overlap["duration"], bass), note(f"oc-l-{index}", "lead", start, overlap["duration"], lead)))
    overlap_rows = sort_notes(overlap_rows)
    overlap_rows[1]["pitch"] = overlap_rows[0]["pitch"]
    role_cases.append(("no_collisions", overlap_rows, overlap))
    changed = deepcopy(role)
    changed["cadence_pitch_class"] = (changed["cadence_pitch_class"] + 1) % 12
    role_cases.append(("cadence", deepcopy(role_rows), changed))
    for expected, rows, contract in role_cases:
        checks = score_roles(rows, contract)
        failures = sorted(name for name, passed in checks.items() if not passed)
        results.append({"family": "continuation-roles", "property": expected, "failures": failures, "pass": failures == [expected]})

    melody = melody_task("calibration", 0, seed)["contract"]
    melody_rows = perfect_melody(melody)
    melody_cases: list[tuple[str, list[dict[str, Any]], dict[str, Any]]] = []
    rows = deepcopy(melody_rows)
    rows.pop()
    melody_cases.append(("note_count", rows, deepcopy(melody)))
    rows = deepcopy(melody_rows)
    rows[1]["duration"] = "1/4"
    melody_cases.append(("rhythm", rows, deepcopy(melody)))
    rows = deepcopy(melody_rows)
    rows[1]["pitch"] += 12
    melody_cases.append(("range", rows, deepcopy(melody)))
    rows = deepcopy(melody_rows)
    rows[1]["pitch"] = next(
        pitch
        for pitch in range(melody["range"][0], melody["range"][1] + 1)
        if pitch % 12 not in melody["allowed_pitch_classes"]
    )
    melody_cases.append(("pitch_collection", rows, deepcopy(melody)))
    changed = deepcopy(melody)
    changed["strong_beat_pitch_classes"] = [value for value in changed["strong_beat_pitch_classes"] if value != melody_rows[0]["pitch"] % 12]
    melody_cases.append(("strong_beat_harmony", deepcopy(melody_rows), changed))
    changed = deepcopy(melody)
    changed["motif_transposition"] += 1
    melody_cases.append(("motif", deepcopy(melody_rows), changed))
    changed = deepcopy(melody)
    changed["cadence_pitch_class"] = (changed["cadence_pitch_class"] + 1) % 12
    melody_cases.append(("cadence", deepcopy(melody_rows), changed))
    for expected, rows, contract in melody_cases:
        checks = score_melody(rows, contract)
        failures = sorted(name for name, passed in checks.items() if not passed)
        results.append({"family": "generation-melody", "property": expected, "failures": failures, "pass": failures == [expected]})

    local = guard_task("calibration", "transformation-local", 0, seed)
    source = local["source"]["source"]["notes"]
    patch = {"base_sha256": local["source"]["source"]["sha256"], "ops": [{"op": "set", "id": local["source"]["change"]["note_id"], "velocity": local["source"]["change"]["value"]}]}
    compiled = compile_patch(patch, source, local["source"]["source"]["sha256"])
    local_cases = []
    wrong = deepcopy(compiled)
    next(value for value in wrong if value["id"] == local["source"]["change"]["note_id"])["velocity"] += 1
    local_cases.append(("canonical_result", wrong, deepcopy(patch)))
    wrong = deepcopy(compiled)
    wrong[0]["id"] = "changed-id"
    local_cases.append(("stable_identity", wrong, deepcopy(patch)))
    wrong = deepcopy(compiled)
    wrong[0]["pitch"] += 1
    local_cases.append(("exact_preservation", wrong, deepcopy(patch)))
    dense_patch = deepcopy(patch)
    dense_patch["ops"].append({"op": "set", "id": source[0]["id"], "pitch": source[0]["pitch"]})
    local_cases.append(("sparse_change", deepcopy(compiled), dense_patch))
    for expected, rows, case_patch in local_cases:
        checks = score_local_result(rows, case_patch, source, local["expected"])
        failures = sorted(name for name, passed in checks.items() if not passed)
        results.append({"family": "transformation-local", "property": expected, "failures": failures, "pass": failures == [expected]})

    for family in ("comprehension-structure", "transformation-rhythm", "continuation-motif"):
        task_value = guard_task("calibration", family, 0, seed)
        wrong = deepcopy(task_value["expected"])
        wrong[0]["velocity"] += 1
        passed = projected(wrong, FIELDS) != projected(task_value["expected"], FIELDS)
        results.append({"family": family, "property": "exact_relation", "failures": ["exact_relation"] if passed else [], "pass": passed})
    return results
