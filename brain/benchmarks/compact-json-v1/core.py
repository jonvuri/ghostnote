#!/usr/bin/env python3
"""Define the Phase 8c2.3 formats, tasks, and scorers."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import re
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent
V3_ROOT = BENCHMARKS_ROOT / "compact-format-v3"


def load_module(name: str, path: Path) -> Any:
    """Load one frozen module without changing it."""
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


v3 = load_module("ghostnote_compact_format_v3_for_json", V3_ROOT / "core.py")

SCHEMA = "ghostnote-compact-json-v1"
CORPUS_SCHEMA = "ghostnote-compact-json-corpus-v1"
ARMS = (
    "exact-object-json-midi",
    "exact-object-json-pc-register",
    "tuple-json-midi",
    "tuple-json-pc-register",
    "midi-like-native",
)
JSON_ARMS = ARMS[:4]
OBJECT_ARMS = ARMS[:2]
TUPLE_ARMS = ARMS[2:4]
PC_REGISTER_ARMS = (ARMS[1], ARMS[3])
IDENTITY_ARMS = JSON_ARMS
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
FIELDS = ("id", "voice", "start", "duration", "pitch", "velocity")
MUSICAL_FIELDS = ("voice", "start", "duration", "pitch", "velocity")
PATCH_FIELDS = ("voice", "start", "duration", "pitch", "velocity")
COHORT_SPECS = {
    "calibration": {"decision": 3, "regression": 1, "guard": 1, "seed": 8323},
    "development": {"decision": 8, "regression": 4, "guard": 4, "seed": 8333},
    "holdout": {"decision": 8, "regression": 4, "guard": 4, "seed": 8343},
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
    return v3.voice_key(value)


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


def projected(values: list[dict[str, Any]], fields: tuple[str, ...]) -> list[dict[str, Any]]:
    return [{field: value[field] for field in fields} for value in sort_notes(values)]


def require_int(value: Any, label: str, minimum: int, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise ValueError(f"{label} must be an integer from {minimum} through {maximum}")
    return value


def require_fraction(value: Any, label: str, positive: bool = False) -> str:
    if not isinstance(value, str) or fraction_text(value) != value:
        raise ValueError(f"{label} must be a canonical rational string")
    if fraction(value) < 0 or (positive and fraction(value) == 0):
        raise ValueError(f"{label} is outside its range")
    return value


def normalize_notes(values: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for value in values:
        if set(value) != set(FIELDS):
            raise ValueError("A note has incorrect fields")
        if not isinstance(value["id"], str) or not value["id"]:
            raise ValueError("A note ID must be a nonempty string")
        if not isinstance(value["voice"], str) or not value["voice"]:
            raise ValueError("A note voice must be a nonempty string")
        result.append(
            note(
                value["id"],
                value["voice"],
                require_fraction(value["start"], "Note start"),
                require_fraction(value["duration"], "Note duration", True),
                require_int(value["pitch"], "MIDI pitch", 0, 127),
                require_int(value["velocity"], "Velocity", 0, 127),
            )
        )
    identities = [value["id"] for value in result]
    if not result or len(identities) != len(set(identities)):
        raise ValueError("Notes must contain unique IDs")
    return sort_notes(result)


def pitch_to_pc_register(value: int) -> list[int]:
    midi = require_int(value, "MIDI pitch", 0, 127)
    return [midi % 12, midi // 12 - 1]


def pc_register_to_pitch(value: Any) -> int:
    if not isinstance(value, list) or len(value) != 2:
        raise ValueError("Pitch-class/register pitch must be one pair")
    pitch_class = require_int(value[0], "Pitch class", 0, 11)
    octave = require_int(value[1], "Octave", -1, 9)
    midi = 12 * (octave + 1) + pitch_class
    return require_int(midi, "Converted MIDI pitch", 0, 127)


def encode_pitch(arm: str, value: int) -> int | list[int]:
    return pitch_to_pc_register(value) if arm in PC_REGISTER_ARMS else require_int(value, "MIDI pitch", 0, 127)


def decode_pitch(arm: str, value: Any) -> int:
    return pc_register_to_pitch(value) if arm in PC_REGISTER_ARMS else require_int(value, "MIDI pitch", 0, 127)


def document_schema(arm: str) -> str:
    if arm not in JSON_ARMS:
        raise ValueError(f"The arm has no JSON document schema: {arm}")
    return f"ghostnote-{arm}-document-v1"


def patch_schema(arm: str) -> str:
    if arm not in JSON_ARMS:
        raise ValueError(f"The arm has no JSON patch schema: {arm}")
    return f"ghostnote-{arm}-patch-v1"


def source_metadata(value: dict[str, Any]) -> dict[str, Any]:
    source = value.get("source", {})
    if isinstance(source, dict) and isinstance(source.get("source"), dict):
        source = source["source"]
    return source if isinstance(source, dict) else {}


def make_document(notes: list[dict[str, Any]], metadata: dict[str, Any], item_id: str) -> dict[str, Any]:
    values = normalize_notes(notes)
    source = source_metadata(metadata)
    tempo = require_int(source.get("tempo", 104), "Tempo", 20, 400)
    meter = source.get("meters", [metadata.get("contract", {}).get("meter", "4/4")])[0]
    if not isinstance(meter, str) or not re.fullmatch(r"[1-9]\d*/[12481632]", meter):
        raise ValueError("Meter must be one supported fraction")
    numerator, denominator = (int(part) for part in meter.split("/"))
    bar_duration = Fraction(numerator * 4, denominator)
    end = max(fraction(value["start"]) + fraction(value["duration"]) for value in values)
    bar_count = max(1, (end.numerator * bar_duration.denominator + end.denominator * bar_duration.numerator - 1) // (end.denominator * bar_duration.numerator))
    harmonies = source.get("harmonies", [])
    bars = [
        {
            "id": f"bar-{index + 1}",
            "number": index + 1,
            "start": fraction_text(index * bar_duration),
            "duration": fraction_text(bar_duration),
            "meter": meter,
            "harmony": harmonies[index] if index < len(harmonies) else "task-contract",
        }
        for index in range(bar_count)
    ]
    voices = sorted({value["voice"] for value in values})
    tracks = [
        {"id": f"track-{voice}", "name": voice, "role": voice, "midi_channel": index}
        for index, voice in enumerate(voices)
    ]
    regions = [
        {
            "id": f"region-{voice}",
            "track_id": f"track-{voice}",
            "start": "0",
            "duration": fraction_text(max(end, bar_duration)),
        }
        for voice in voices
    ]
    document_notes = [
        {**value, "region_id": f"region-{value['voice']}"}
        for value in values
    ]
    return {
        "score": {
            "id": item_id,
            "source_sha256": str(metadata.get("sha256", digest(values))),
            "tempo_bpm": tempo,
        },
        "bars": bars,
        "tracks": tracks,
        "regions": regions,
        "notes": document_notes,
    }


def encode_document(arm: str, document: dict[str, Any]) -> dict[str, Any]:
    if arm in OBJECT_ARMS:
        return {
            "schema": document_schema(arm),
            "score": deepcopy(document["score"]),
            "bars": deepcopy(document["bars"]),
            "tracks": deepcopy(document["tracks"]),
            "regions": deepcopy(document["regions"]),
            "notes": [
                {**value, "pitch": encode_pitch(arm, value["pitch"])}
                for value in document["notes"]
            ],
        }
    if arm in TUPLE_ARMS:
        score = document["score"]
        return {
            "schema": document_schema(arm),
            "score": [score["id"], score["source_sha256"], score["tempo_bpm"]],
            "bars": [
                [value[name] for name in ("id", "number", "start", "duration", "meter", "harmony")]
                for value in document["bars"]
            ],
            "tracks": [
                [value[name] for name in ("id", "name", "role", "midi_channel")]
                for value in document["tracks"]
            ],
            "regions": [
                [value[name] for name in ("id", "track_id", "start", "duration")]
                for value in document["regions"]
            ],
            "notes": [
                [
                    value["id"],
                    value["region_id"],
                    value["voice"],
                    value["start"],
                    value["duration"],
                    encode_pitch(arm, value["pitch"]),
                    value["velocity"],
                ]
                for value in document["notes"]
            ],
        }
    raise ValueError(f"Unknown JSON arm: {arm}")


def require_keys(value: Any, fields: tuple[str, ...], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != set(fields):
        raise ValueError(f"{label} has incorrect fields")
    return value


def require_tuple(value: Any, length: int, label: str) -> list[Any]:
    if not isinstance(value, list) or len(value) != length:
        raise ValueError(f"{label} has incorrect tuple length")
    return value


def decode_document(arm: str, value: Any) -> dict[str, Any]:
    top = require_keys(value, ("schema", "score", "bars", "tracks", "regions", "notes"), "Document")
    if top["schema"] != document_schema(arm):
        raise ValueError("Document schema is incorrect")
    if not all(isinstance(top[name], list) and top[name] for name in ("bars", "tracks", "regions", "notes")):
        raise ValueError("Document collections must be nonempty arrays")
    if arm in OBJECT_ARMS:
        score = require_keys(top["score"], ("id", "source_sha256", "tempo_bpm"), "Score")
        bars = [require_keys(item, ("id", "number", "start", "duration", "meter", "harmony"), "Bar") for item in top["bars"]]
        tracks = [require_keys(item, ("id", "name", "role", "midi_channel"), "Track") for item in top["tracks"]]
        regions = [require_keys(item, ("id", "track_id", "start", "duration"), "Region") for item in top["regions"]]
        notes = [require_keys(item, ("id", "region_id", "voice", "start", "duration", "pitch", "velocity"), "Note") for item in top["notes"]]
    else:
        raw_score = require_tuple(top["score"], 3, "Score")
        score = dict(zip(("id", "source_sha256", "tempo_bpm"), raw_score))
        bars = [dict(zip(("id", "number", "start", "duration", "meter", "harmony"), require_tuple(item, 6, "Bar"))) for item in top["bars"]]
        tracks = [dict(zip(("id", "name", "role", "midi_channel"), require_tuple(item, 4, "Track"))) for item in top["tracks"]]
        regions = [dict(zip(("id", "track_id", "start", "duration"), require_tuple(item, 4, "Region"))) for item in top["regions"]]
        notes = [dict(zip(("id", "region_id", "voice", "start", "duration", "pitch", "velocity"), require_tuple(item, 7, "Note"))) for item in top["notes"]]
    decoded_notes = [{**item, "pitch": decode_pitch(arm, item["pitch"])} for item in notes]
    document = {"score": score, "bars": bars, "tracks": tracks, "regions": regions, "notes": decoded_notes}
    validate_document(document)
    return document


def validate_identity_rows(values: list[dict[str, Any]], label: str) -> None:
    identities = [value.get("id") for value in values]
    if any(not isinstance(item, str) or not item for item in identities) or len(identities) != len(set(identities)):
        raise ValueError(f"{label} IDs must be unique nonempty strings")


def validate_document(document: dict[str, Any]) -> None:
    score = document["score"]
    if not isinstance(score["id"], str) or not score["id"] or not isinstance(score["source_sha256"], str) or not score["source_sha256"]:
        raise ValueError("Score identity fields must be nonempty strings")
    require_int(score["tempo_bpm"], "Tempo", 20, 400)
    bars = document["bars"]
    tracks = document["tracks"]
    regions = document["regions"]
    notes = document["notes"]
    validate_identity_rows(bars, "Bar")
    validate_identity_rows(tracks, "Track")
    validate_identity_rows(regions, "Region")
    validate_identity_rows(notes, "Note")
    for index, value in enumerate(bars, start=1):
        require_int(value["number"], "Bar number", 1, 100000)
        require_fraction(value["start"], "Bar start")
        require_fraction(value["duration"], "Bar duration", True)
        if value["number"] != index or not isinstance(value["meter"], str) or not isinstance(value["harmony"], str):
            raise ValueError("Bars must use canonical order and metadata")
    if bars != sorted(bars, key=lambda item: (fraction(item["start"]), item["id"])):
        raise ValueError("Bars are not in canonical order")
    for value in tracks:
        if any(not isinstance(value[name], str) or not value[name] for name in ("name", "role")):
            raise ValueError("Track metadata must use nonempty strings")
        require_int(value["midi_channel"], "MIDI channel", 0, 15)
    if tracks != sorted(tracks, key=lambda item: item["id"]):
        raise ValueError("Tracks are not in canonical order")
    track_ids = {value["id"] for value in tracks}
    for value in regions:
        if value["track_id"] not in track_ids:
            raise ValueError("A region refers to an unknown track")
        require_fraction(value["start"], "Region start")
        require_fraction(value["duration"], "Region duration", True)
    if regions != sorted(regions, key=lambda item: (item["track_id"], item["id"])):
        raise ValueError("Regions are not in canonical order")
    region_ids = {value["id"] for value in regions}
    normalized = []
    for value in notes:
        if value["region_id"] not in region_ids:
            raise ValueError("A note refers to an unknown region")
        normalized.append({name: value[name] for name in FIELDS})
    if normalize_notes(normalized) != normalized:
        raise ValueError("Notes are not in canonical order")


def render_document(arm: str, notes: list[dict[str, Any]], metadata: dict[str, Any], item_id: str) -> str:
    return canonical(encode_document(arm, make_document(notes, metadata, item_id)))


def parse_document(arm: str, text: str) -> dict[str, Any]:
    if arm not in JSON_ARMS:
        raise ValueError(f"The arm has no JSON document: {arm}")
    return decode_document(arm, json.loads(text))


def document_notes(document: dict[str, Any]) -> list[dict[str, Any]]:
    return [{name: value[name] for name in FIELDS} for value in document["notes"]]


def render_native(notes: list[dict[str, Any]]) -> str:
    return "\n".join(
        f"TRACK_{value['voice']} TIME_{value['start']} NOTE_ON_{value['pitch']} DURATION_{value['duration']} VELOCITY_{value['velocity']}"
        for value in normalize_notes(notes)
    )


def parse_native(text: str) -> list[dict[str, Any]]:
    pattern = re.compile(r"TRACK_(\S+) TIME_(\S+) NOTE_ON_(\d+) DURATION_(\S+) VELOCITY_(\d+)")
    result = []
    for index, line in enumerate((row.strip() for row in text.splitlines() if row.strip()), start=1):
        match = pattern.fullmatch(line)
        if not match:
            raise ValueError(f"Invalid native MIDI-like row: {line}")
        result.append(note(f"native-{index}", match[1], match[2], match[4], int(match[3]), int(match[5])))
    return normalize_notes(result)


def render_events(arm: str, notes: list[dict[str, Any]], metadata: dict[str, Any], item_id: str) -> str:
    return render_native(notes) if arm == "midi-like-native" else render_document(arm, notes, metadata, item_id)


def parse_events(arm: str, text: str) -> list[dict[str, Any]]:
    return parse_native(text) if arm == "midi-like-native" else document_notes(parse_document(arm, text))


def encode_changes(arm: str, changes: dict[str, Any]) -> dict[str, Any]:
    result = deepcopy(changes)
    if "pitch" in result:
        result["pitch"] = encode_pitch(arm, result["pitch"])
    return result


def decode_changes(arm: str, changes: Any) -> dict[str, Any]:
    if not isinstance(changes, dict) or not changes or any(name not in PATCH_FIELDS for name in changes):
        raise ValueError("Patch changes must contain supported note fields")
    result = deepcopy(changes)
    if "pitch" in result:
        result["pitch"] = decode_pitch(arm, result["pitch"])
    if "voice" in result and (not isinstance(result["voice"], str) or not result["voice"]):
        raise ValueError("Patched voice must be a nonempty string")
    if "start" in result:
        require_fraction(result["start"], "Patched start")
    if "duration" in result:
        require_fraction(result["duration"], "Patched duration", True)
    if "velocity" in result:
        require_int(result["velocity"], "Patched velocity", 0, 127)
    return result


def render_patch(arm: str, base_sha256: str, operations: list[dict[str, Any]]) -> str:
    if arm not in JSON_ARMS or not isinstance(base_sha256, str) or not base_sha256:
        raise ValueError("Patch arm and base hash are required")
    normalized = validate_patch({"base_sha256": base_sha256, "ops": operations})
    if arm in OBJECT_ARMS:
        ops: list[Any] = [
            {"op": "set-note", "id": value["id"], "changes": encode_changes(arm, value["changes"])}
            for value in normalized["ops"]
        ]
    else:
        ops = [
            ["set-note", value["id"], encode_changes(arm, value["changes"])]
            for value in normalized["ops"]
        ]
    return canonical({"schema": patch_schema(arm), "base_sha256": base_sha256, "ops": ops})


def parse_patch(arm: str, text: str) -> dict[str, Any]:
    if arm not in JSON_ARMS:
        raise ValueError("Native MIDI-like has no patch form")
    value = require_keys(json.loads(text), ("schema", "base_sha256", "ops"), "Patch")
    if value["schema"] != patch_schema(arm) or not isinstance(value["ops"], list):
        raise ValueError("Patch schema or operations are incorrect")
    operations = []
    for item in value["ops"]:
        if arm in OBJECT_ARMS:
            operation = require_keys(item, ("op", "id", "changes"), "Patch operation")
            raw_op, note_id, changes = operation["op"], operation["id"], operation["changes"]
        else:
            raw_op, note_id, changes = require_tuple(item, 3, "Patch operation")
        operations.append({"op": raw_op, "id": note_id, "changes": decode_changes(arm, changes)})
    return validate_patch({"base_sha256": value["base_sha256"], "ops": operations})


def validate_patch(value: dict[str, Any]) -> dict[str, Any]:
    if set(value) != {"base_sha256", "ops"} or not isinstance(value["base_sha256"], str) or not value["base_sha256"]:
        raise ValueError("Patch base hash is invalid")
    if not isinstance(value["ops"], list) or not value["ops"]:
        raise ValueError("Patch must contain operations")
    identities = []
    for item in value["ops"]:
        if set(item) != {"op", "id", "changes"} or item["op"] != "set-note":
            raise ValueError("Patch operation is invalid")
        if not isinstance(item["id"], str) or not item["id"]:
            raise ValueError("Patch target ID is invalid")
        decode_changes("exact-object-json-midi", item["changes"])
        identities.append(item["id"])
    if len(identities) != len(set(identities)):
        raise ValueError("A patch cannot target one note more than once")
    return deepcopy(value)


def compile_patch(value: dict[str, Any], source: list[dict[str, Any]], base_sha256: str) -> list[dict[str, Any]]:
    patch = validate_patch(value)
    if patch["base_sha256"] != base_sha256:
        raise ValueError("Patch base hash is stale")
    result = normalize_notes(source)
    by_id = {item["id"]: item for item in result}
    for operation in patch["ops"]:
        target = by_id.get(operation["id"])
        if target is None:
            raise ValueError("Patch target does not exist")
        target.update(operation["changes"])
    return normalize_notes(result)


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
    tonic = (seed + variant * 7) % 12
    starts = {
        "calibration": ["1/8", "9/8", "17/8", "25/8"],
        "development": ["1/6", "7/6", "13/6", "19/6"],
        "holdout": ["1/10", "11/10", "21/10", "31/10"],
    }[cohort]
    duration = {"calibration": "7/8", "development": "5/6", "holdout": "9/10"}[cohort]
    offsets = ((0, 3, 7), (5, 8, 0), (2, 5, 9, 0), (0, 3, 7))
    contract = {
        "meter": "4/4",
        "chord_starts": starts,
        "duration": duration,
        "pitch_classes": [sorted((tonic + item) % 12 for item in chord) for chord in offsets],
        "bass_pitch_classes": [tonic, (tonic + 5) % 12, (tonic + 2) % 12, tonic],
        "voice_ranges": {"bass": [35, 54], "tenor": [47, 66], "alto": [54, 73], "soprano": [61, 83]},
        "maximum_total_voice_leading": 52,
        "cadence_pitch_class": tonic,
    }
    return finish_task(cohort, "generation-progression", variant, {"contract": contract})


def role_task(cohort: str, variant: int, seed: int) -> dict[str, Any]:
    tonic = (seed + variant * 7) % 12
    base = {"calibration": Fraction(9, 2), "development": Fraction(49, 4), "holdout": Fraction(81, 4)}[cohort]
    step = {"calibration": Fraction(3, 4), "development": Fraction(5, 6), "holdout": Fraction(7, 8)}[cohort]
    offsets = ((0, 3, 7), (5, 8, 0), (2, 5, 9), (7, 10, 2), (0, 3, 7))
    contract = {
        "starts": [fraction_text(base + index * step) for index in range(5)],
        "harmony_pitch_classes": [sorted((tonic + item) % 12 for item in chord) for chord in offsets],
        "ranges": {"bass": [35, 54], "lead": [59, 83]},
        "cadence_pitch_class": tonic,
        "maximum_role_leap": 9,
        "duration": fraction_text(step),
    }
    return finish_task(cohort, "continuation-roles", variant, {"contract": contract})


def revoice_task(cohort: str, variant: int, seed: int) -> dict[str, Any]:
    operation = ("nearest", "drop-2", "first-inversion")[variant % 3]
    root = 46 + ((seed + variant * 3) % 5)
    start_step = {"calibration": Fraction(9, 8), "development": Fraction(7, 6), "holdout": Fraction(11, 10)}[cohort]
    duration = {"calibration": "7/8", "development": "5/6", "holdout": "9/10"}[cohort]
    notes = []
    for chord in range(3):
        chord_root = root + chord * 2
        for voice, interval, velocity in zip(v3.VOICE_ORDER, (0, 3, 7, 10), (75, 77, 79, 81)):
            notes.append(note(f"cj-{cohort[:3]}-rv{variant}-{chord + 1}-{voice}", voice, Fraction(1, 8) + chord * start_step, duration, chord_root + interval, velocity))
    contract = {
        "source": sort_notes(notes),
        "operation": operation,
        "range": [33, 85],
        "voice_ranges": {"bass": [33, 57], "tenor": [42, 68], "alto": [49, 77], "soprano": [56, 85]},
        "definitions": {
            "nearest": "Keep the first chord unchanged. For each later chord, select octave placements with the least total same-voice movement from the prior output chord. Accept every tied minimum.",
            "drop-2": "Lower the second-highest source pitch by one octave. Sort the four result pitches and assign them to bass, tenor, alto, and soprano.",
            "first-inversion": "Raise the lowest source pitch by one octave. Sort the four result pitches and assign them to bass, tenor, alto, and soprano.",
        },
    }
    return finish_task(cohort, "transformation-revoice", variant, {"contract": contract})


def melody_task(cohort: str, variant: int, seed: int) -> dict[str, Any]:
    tonic = (seed + variant * 7) % 12
    step = {"calibration": Fraction(3, 7), "development": Fraction(4, 9), "holdout": Fraction(5, 11)}[cohort]
    starts = [fraction_text(Fraction(1, 7) + index * step) for index in range(8)]
    first = [59 + tonic + value for value in (0, 2, 5, 7)]
    transposition = 4
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
    root = 51 + ((seed + variant * 4) % 7)
    step = {"calibration": Fraction(2, 3), "development": Fraction(3, 5), "holdout": Fraction(4, 7)}[cohort]
    notes = [
        note(f"cj-{cohort[:3]}-st{variant}-lead-{index}", "lead", Fraction(1, 9) + (index - 1) * step, step, root + offset, 77 + index)
        for index, offset in enumerate((0, 5, 2, 8, 4, 9), start=1)
    ]
    chord_duration = fraction_text(step * 3)
    for chord, start in enumerate((Fraction(1, 9), Fraction(1, 9) + step * 3), start=1):
        for position, interval in enumerate((0, 3, 7), start=1):
            notes.append(note(f"cj-{cohort[:3]}-st{variant}-pad-{chord}-{position}", "pad", start, chord_duration, root - 12 + interval, 67 + position))
    notes.extend(
        (
            note(f"cj-{cohort[:3]}-st{variant}-bass-1", "bass", "1/9", chord_duration, root - 24, 73),
            note(f"cj-{cohort[:3]}-st{variant}-bass-2", "bass", Fraction(1, 9) + step * 3, chord_duration, root - 19, 75),
        )
    )
    return {"notes": sort_notes(notes), "tempo": 101 + variant, "meters": ["4/4"], "harmonies": ["generated-source"]}


def guard_task(cohort: str, family: str, variant: int, seed: int) -> dict[str, Any]:
    if family == "comprehension-structure":
        source = structure_source(cohort, variant, seed)
        return finish_task(cohort, family, variant, {"source": source, "expected": source["notes"]})
    if family == "transformation-local":
        source = structure_source(cohort, variant, seed)
        source["sha256"] = digest(source)
        target = source["notes"][3]
        change = {"operation": "set", "note_id": target["id"], "field": "velocity", "value": target["velocity"] + 4}
        expected = deepcopy(source["notes"])
        next(value for value in expected if value["id"] == target["id"])["velocity"] = change["value"]
        return finish_task(cohort, family, variant, {"source": {"source": source, "change": change}, "expected": sort_notes(expected)})
    if family == "transformation-rhythm":
        source = [note(f"cj-{cohort[:3]}-ry{variant}-{index}", "perc", Fraction(1, 9) + Fraction(index, 3), "2/9", 47 + index % 5, 79 + index) for index in range(8)]
        expected = deepcopy(source)
        for index, value in enumerate(expected):
            if index % 2:
                value["start"] = fraction_text(fraction(value["start"]) + Fraction(1, 9))
        return finish_task(cohort, family, variant, {"source": {"source": sort_notes(source), "odd_offset": "1/9"}, "expected": sort_notes(expected)})
    seed_notes = [note(f"cj-{cohort[:3]}-mo{variant}-{index}", "lead", Fraction(1, 9) + Fraction(index - 1, 3), "1/3", 59 + variant + offset, 85) for index, offset in enumerate((0, 3, 6, 2), start=1)]
    expected_ids = [f"cj-{cohort[:3]}-mo-out-{variant}-{index}" for index in range(1, 5)]
    expected = [note(expected_ids[index], "lead", fraction(value["start"]) + Fraction(13, 3), value["duration"], value["pitch"] + 3, value["velocity"]) for index, value in enumerate(seed_notes)]
    return finish_task(cohort, family, variant, {"source": {"source": sort_notes(seed_notes), "start_offset": "13/3", "pitch_offset": 3, "expected_ids": expected_ids}, "expected": sort_notes(expected)})


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
    fixtures.update({family: [guard_task(cohort, family, index, seed) for index in range(int(spec["guard"]))] for family in GUARD_FAMILIES})
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


def score_response(arm: str, value: dict[str, Any], payload: str) -> dict[str, Any]:
    family = value["family"]
    try:
        if family == "transformation-local" and arm in JSON_ARMS:
            source = value["source"]["source"]
            patch = parse_patch(arm, payload)
            compiled = compile_patch(patch, source["notes"], source["sha256"])
            checks = v3.score_local_result(compiled, patch, source["notes"], value["expected"])
        else:
            notes = parse_events(arm, payload)
            if family == "generation-progression":
                checks = v3.score_progression(notes, value["contract"])
            elif family == "continuation-roles":
                checks = v3.score_roles(notes, value["contract"])
            elif family == "transformation-revoice":
                checks = v3.score_revoice(notes, value["contract"], arm in JSON_ARMS)
            elif family == "generation-melody":
                checks = v3.score_melody(notes, value["contract"])
            else:
                fields = FIELDS if arm in JSON_ARMS else MUSICAL_FIELDS
                checks = {"exact_relation": projected(notes, fields) == projected(value["expected"], fields)}
        return {"syntax_pass": True, "primary_pass": all(checks.values()), "checks": checks, "error": None}
    except (KeyError, TypeError, ValueError, json.JSONDecodeError, re.error) as error:
        return {"syntax_pass": False, "primary_pass": False, "checks": {}, "error": f"{type(error).__name__}: {error}"}


def perfect_notes(value: dict[str, Any]) -> list[dict[str, Any]]:
    family = value["family"]
    if family == "generation-progression":
        return v3.perfect_progression(value["contract"])
    if family == "continuation-roles":
        return v3.perfect_roles(value["contract"])
    if family == "transformation-revoice":
        return v3.perfect_revoice(value["contract"])
    if family == "generation-melody":
        return v3.perfect_melody(value["contract"])
    return value["expected"]


def perfect_payload(arm: str, value: dict[str, Any]) -> str:
    if value["family"] == "transformation-local" and arm in JSON_ARMS:
        change = value["source"]["change"]
        operation = {"op": "set-note", "id": change["note_id"], "changes": {change["field"]: change["value"]}}
        return render_patch(arm, value["source"]["source"]["sha256"], [operation])
    return render_events(arm, perfect_notes(value), value, value["id"])


def schema_manifest() -> dict[str, Any]:
    value = {
        "schema": SCHEMA,
        "arms": {
            arm: {
                "document_schema": document_schema(arm),
                "patch_schema": patch_schema(arm),
                "shape": "object" if arm in OBJECT_ARMS else "tuple",
                "pitch": "pc-register" if arm in PC_REGISTER_ARMS else "midi",
            }
            for arm in JSON_ARMS
        },
        "object_document": {
            "score_fields": ["id", "source_sha256", "tempo_bpm"],
            "bar_fields": ["id", "number", "start", "duration", "meter", "harmony"],
            "track_fields": ["id", "name", "role", "midi_channel"],
            "region_fields": ["id", "track_id", "start", "duration"],
            "note_fields": ["id", "region_id", "voice", "start", "duration", "pitch", "velocity"],
        },
        "tuple_document": {
            "score_positions": ["id", "source_sha256", "tempo_bpm"],
            "bar_positions": ["id", "number", "start", "duration", "meter", "harmony"],
            "track_positions": ["id", "name", "role", "midi_channel"],
            "region_positions": ["id", "track_id", "start", "duration"],
            "note_positions": ["id", "region_id", "voice", "start", "duration", "pitch", "velocity"],
        },
        "pitch": {
            "midi": "One integer from 0 through 127.",
            "pc_register": "One [pitch_class,octave] pair. MIDI is 12 * (octave + 1) + pitch_class and must be from 0 through 127.",
        },
        "patch": {
            "object_operation_fields": ["op", "id", "changes"],
            "tuple_operation_positions": ["op", "id", "changes"],
            "operation": "set-note",
            "change_fields": list(PATCH_FIELDS),
            "conflict_rule": "Reject a stale base, unknown ID, or repeated target ID.",
        },
    }
    value["sha256"] = digest(value)
    return value


def output_form(arm: str, family: str) -> str:
    return "json-patch" if family == "transformation-local" and arm in JSON_ARMS else "native-document" if arm == "midi-like-native" else "json-document"


def output_grammar(arm: str, family: str) -> str:
    form = output_form(arm, family)
    if form == "native-document":
        return "Use only TRACK_<voice> TIME_<start> NOTE_ON_<MIDI> DURATION_<duration> VELOCITY_<velocity> rows. Do not include IDs."
    shape = "named objects" if arm in OBJECT_ARMS else "fixed tuples in the named score, bars, tracks, regions, and notes collections"
    pitch = "one MIDI integer from 0 through 127" if arm not in PC_REGISTER_ARMS else "one [pitch_class,octave] pair, where MIDI = 12 * (octave + 1) + pitch_class"
    if form == "json-patch":
        operation = '{"op":"set-note","id":"<id>","changes":{"<field>":<value>}}' if arm in OBJECT_ARMS else '["set-note","<id>",{"<field>":<value>}]'
        return f"Return canonical JSON with schema, base_sha256, and ops. Use {operation}. Use {pitch} for a changed pitch. Return only changed fields."
    return f"Return canonical JSON with schema, score, bars, tracks, regions, and notes. Use {shape}. Use {pitch} for each pitch. Preserve every field and collection."


def example_notes() -> list[dict[str, Any]]:
    return [note("n1", "lead", "0", "1/2", 60, 80)]


def output_example(arm: str, family: str) -> str:
    if output_form(arm, family) == "json-patch":
        return render_patch(arm, "abc", [{"op": "set-note", "id": "n1", "changes": {"velocity": 87}}])
    if arm == "midi-like-native":
        return render_native(example_notes())
    metadata = {"sha256": "abc", "source": {"tempo": 120, "meters": ["4/4"], "harmonies": ["C"]}}
    return render_document(arm, example_notes(), metadata, "s1")


def task_instruction(value: dict[str, Any]) -> str:
    return v3.task_instruction(value)


def represented_source(arm: str, value: dict[str, Any]) -> str | None:
    values = source_notes(value)
    return render_events(arm, values, value, value["id"] + "-source") if values else None


def prompt_for(arm: str, value: dict[str, Any]) -> str:
    parts = [
        "Complete one deterministic symbolic-music task.",
        "Return one JSON object with exactly one string field named payload. Put the requested representation in that string. Do not add prose.",
        f"Representation arm: {arm}.",
        f"Output form: {output_form(arm, value['family'])}.",
        output_grammar(arm, value["family"]),
        "Follow this complete example, but use the task values:\n" + output_example(arm, value["family"]),
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
        full = arm in JSON_ARMS
        result[arm] = {
            "factorial_cell": full,
            "native_anchor": not full,
            "full_document_fidelity": full,
            "stable_identity": full,
            "exact_preservation": full,
            "sparse_patch": full,
            "conflict_handling": "base hash and target validation" if full else "not supplied",
            "one_canonical_pitch_encoding": True,
        }
    return result
