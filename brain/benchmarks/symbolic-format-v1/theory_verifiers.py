#!/usr/bin/env python3
"""Bounded Music21 and Musicpy adapters for the v1 benchmark."""

from __future__ import annotations

import importlib.metadata
import os
from typing import Any


PITCH_NAMES = ("C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B")


def pitch_name(value: int) -> str:
    return f"{PITCH_NAMES[value % 12]}{value // 12 - 1}"


def music21_chord_analysis(pitches: list[int], tonic: str = "C") -> dict[str, Any]:
    from music21 import chord, key, roman

    value = chord.Chord([pitch_name(pitch) for pitch in pitches])
    quality = {
        "major triad": "major",
        "minor triad": "minor",
        "dominant seventh chord": "dominant-seventh",
        "major seventh chord": "major-seventh",
    }.get(value.commonName, value.commonName)
    numeral = roman.romanNumeralFromChord(value, key.Key(tonic))
    return {
        "root_pc": value.root().pitchClass,
        "bass_pc": value.bass().pitchClass,
        "quality": quality,
        "inversion": value.inversion(),
        "roman": numeral.figure,
    }


def music21_cadence(chords: list[list[int]], tonic: str = "C") -> bool:
    if len(chords) < 2:
        return False
    penultimate = music21_chord_analysis(chords[-2], tonic)
    final = music21_chord_analysis(chords[-1], tonic)
    return penultimate["roman"].startswith("V") and final["roman"].startswith("I")


def musicpy_voicing(
    pitches: list[int], operation: str, target: list[int] | None = None
) -> list[int]:
    os.environ["PYGAME_HIDE_SUPPORT_PROMPT"] = "1"
    import musicpy

    value = musicpy.chord(",".join(pitch_name(pitch) for pitch in pitches))
    if operation == "drop-2":
        result = value.drops(2)
    elif operation == "first-inversion":
        result = value.inversion(1)
    elif operation == "nearest":
        if target is None:
            raise ValueError("Nearest voicing needs a target")
        reference = musicpy.chord(",".join(pitch_name(pitch) for pitch in target))
        result = value.near_voicing(reference, keep_root=False)
    else:
        raise ValueError(f"Unknown Musicpy operation: {operation}")
    return sorted(note.degree for note in result.notes)


def verifier_versions() -> dict[str, str]:
    return {
        "music21": importlib.metadata.version("music21"),
        "musicpy": importlib.metadata.version("musicpy"),
    }


def self_test() -> dict[str, Any]:
    pass_major = music21_chord_analysis([48, 52, 55])
    near_miss = music21_chord_analysis([52, 55, 60])
    fail_minor = music21_chord_analysis([48, 51, 55])
    drop_two = musicpy_voicing([60, 64, 67, 71], "drop-2")
    nearest = musicpy_voicing([55, 59, 62, 65], "nearest", [60, 64, 67, 71])
    checks = {
        "music21_known_pass": pass_major["root_pc"] == 0 and pass_major["inversion"] == 0,
        "music21_near_miss_detected": near_miss["inversion"] == 1,
        "music21_known_fail_detected": fail_minor["quality"] == "minor",
        "music21_cadence_pass": music21_cadence([[55, 59, 62, 65], [60, 64, 67]], "C"),
        "music21_cadence_fail": not music21_cadence([[53, 57, 60], [60, 64, 67]], "C"),
        "musicpy_drop_two": drop_two == [55, 60, 64, 71],
        "musicpy_nearest": nearest == [62, 65, 67, 71],
    }
    return {"versions": verifier_versions(), "checks": checks, "pass": all(checks.values())}


if __name__ == "__main__":
    import json

    print(json.dumps(self_test(), indent=2, sort_keys=True))
