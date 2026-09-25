"""Fixed generated music corpus for the compact-bar v0 benchmark."""

from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from fractions import Fraction
from typing import Any


CORPUS_SCHEMA = "ghostnote-compact-bar-corpus-v0"
LICENSE = "MIT"
CORE_FIELDS = ("id", "track", "start", "duration", "pitch", "velocity")


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
    track: str,
    start: str | int,
    duration: str | int,
    pitch: int,
    velocity: int,
    channel: int,
    *,
    muted: bool = False,
    release_velocity: int = 64,
    articulation: str = "normal",
    pressure: str = "0",
    timbre: str = "0",
    pan: str = "0",
    gain: str = "1",
) -> dict[str, Any]:
    return {
        "id": note_id,
        "track": track,
        "start": fraction_text(start),
        "duration": fraction_text(duration),
        "pitch": pitch,
        "velocity": velocity,
        "channel": channel,
        "muted": muted,
        "release_velocity": release_velocity,
        "articulation": articulation,
        "expression": {
            "pressure": fraction_text(pressure),
            "timbre": fraction_text(timbre),
            "pan": fraction_text(pan),
            "gain": fraction_text(gain),
        },
    }


def medium_notes() -> list[dict[str, Any]]:
    notes = [
        note("l-01", "lead", 0, 1, 67, 92, 0, pressure="1/8"),
        note("l-02", "lead", "1001/960", "919/960", 71, 86, 0, articulation="legato"),
        note("l-03", "lead", 2, "2/3", 74, 90, 0),
        note("l-04", "lead", "8/3", "1/3", 76, 94, 0, articulation="staccato"),
        note("l-05", "lead", 4, 1, 71, 91, 0),
        note("l-06", "lead", 5, 1, 70, 88, 0),
        note("l-07", "lead", 6, 1, 68, 90, 0, timbre="1/6"),
        note("l-08", "lead", 7, 1, 67, 87, 0),
        note("l-09", "lead", 8, 1, 69, 89, 0),
        note("l-10", "lead", 9, 1, 72, 86, 0),
        note("l-11", "lead", 10, 1, 76, 91, 0),
        note("l-12", "lead", 11, "5/4", 74, 90, 0),
        note("l-13", "lead", "49/4", "3/4", 72, 87, 0),
        note("l-14", "lead", 13, 1, 67, 89, 0, pan="-1/10"),
        note("l-15", "lead", 14, 2, 65, 84, 0),
        note("b-01", "bass", 0, 4, 36, 82, 1),
        note("b-02", "bass", 4, 4, 40, 84, 1),
        note("b-03", "bass", 8, 3, 45, 80, 1),
        note("b-04", "bass", 11, 5, 38, 83, 1, release_velocity=70),
    ]
    chords = (
        (0, 4, (48, 55, 59, 62, 66), "k1"),
        (4, 4, (52, 56, 62, 65, 70), "k2"),
        (8, 3, (45, 52, 55, 59, 62), "k3"),
        (11, 5, (50, 55, 60, 65, 70), "k4"),
    )
    for start, duration, pitches, prefix in chords:
        notes.extend(
            note(
                f"{prefix}-{index + 1}",
                "keys",
                start,
                duration,
                pitch,
                68 + index,
                2,
                gain="9/10" if index == 2 else "1",
            )
            for index, pitch in enumerate(pitches)
        )
    notes.extend(
        [
            note("d-01", "drums", 0, "1/8", 36, 108, 9),
            note("d-02", "drums", "49/24", "1/8", 38, 102, 9),
            note("d-03", "drums", 4, "1/8", 36, 106, 9),
            note("d-04", "drums", "145/24", "1/8", 38, 100, 9),
            note("d-05", "drums", 8, "1/8", 36, 104, 9),
            note("d-06", "drums", "217/24", "1/8", 38, 99, 9),
            note("d-07", "drums", 11, "1/8", 36, 107, 9),
            note("d-08", "drums", "313/24", "1/8", 38, 101, 9, muted=True),
        ]
    )
    return sorted(notes, key=note_sort_key)


def note_sort_key(value: dict[str, Any]) -> tuple[Any, ...]:
    return (fraction(value["start"]), value["track"], value["pitch"], value["id"])


def bars(repeats: int) -> list[dict[str, Any]]:
    template = (
        (1, 0, 4, "4/4", "Cmaj9#11"),
        (2, 4, 4, "4/4", "E7alt"),
        (3, 8, 3, "3/4", "Am11"),
        (4, 11, 5, "5/4", "D-quartal"),
    )
    result = []
    for repeat in range(repeats):
        for number, start, length, meter, harmony in template:
            result.append(
                {
                    "number": number + repeat * 4,
                    "start": fraction_text(start + repeat * 16),
                    "length": fraction_text(length),
                    "meter": meter,
                    "harmony": harmony,
                }
            )
    return result


def make_fixture(name: str, repeats: int, short: bool = False) -> dict[str, Any]:
    source_notes = medium_notes()
    if short:
        fixture_notes = [deepcopy(value) for value in source_notes if fraction(value["start"]) < 4]
        fixture_bars = bars(1)[:1]
        length = 4
    else:
        fixture_notes = []
        for repeat in range(repeats):
            for source in source_notes:
                copied = deepcopy(source)
                if repeat:
                    copied["id"] = f"r{repeat + 1}-{source['id']}"
                copied["start"] = fraction_text(fraction(source["start"]) + repeat * 16)
                fixture_notes.append(copied)
        fixture_bars = bars(repeats)
        length = repeats * 16
    value = {
        "schema": CORPUS_SCHEMA,
        "id": name,
        "origin": "generated for Ghostnote under the repository MIT license",
        "license": LICENSE,
        "tempo_bpm": 120,
        "length_beats": fraction_text(length),
        "tracks": [
            {"id": "lead", "role": "lead", "voice": "monophonic"},
            {"id": "bass", "role": "bass", "voice": "monophonic"},
            {"id": "keys", "role": "harmony", "voice": "polyphonic"},
            {"id": "drums", "role": "rhythm", "voice": "polyphonic"},
        ],
        "regions": [
            {"id": f"{name}-a", "start": "0", "end": fraction_text(length // 2)},
            {"id": f"{name}-b", "start": fraction_text(length // 2), "end": fraction_text(length)},
        ],
        "bars": fixture_bars,
        "notes": sorted(fixture_notes, key=note_sort_key),
    }
    value["sha256"] = digest(value)
    return value


def make_corpus() -> dict[str, dict[str, Any]]:
    """Return fresh fixture objects. Renderers must not mutate these values."""

    return {
        "short": make_fixture("short", 1, short=True),
        "medium": make_fixture("medium", 1),
        "long": make_fixture("long", 2),
    }


def core_note(value: dict[str, Any]) -> dict[str, Any]:
    return {field: value[field] for field in CORE_FIELDS}


def corpus_manifest(corpus: dict[str, dict[str, Any]]) -> dict[str, Any]:
    return {
        "schema": CORPUS_SCHEMA,
        "license": LICENSE,
        "fixtures": {
            name: {
                "sha256": value["sha256"],
                "notes": len(value["notes"]),
                "bars": len(value["bars"]),
                "bytes": len(canonical(value).encode()),
            }
            for name, value in corpus.items()
        },
        "sha256": digest({name: value["sha256"] for name, value in corpus.items()}),
    }
