#!/usr/bin/env python3
"""Run the Phase 8c2 compact-format development benchmark."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import itertools
import json
import os
import platform
import random
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent
V0_ROOT = BENCHMARKS_ROOT / "compact-bar-v0"
V1_ROOT = BENCHMARKS_ROOT / "symbolic-format-v1"

# Reuse the fixed v1 native MIDI-Like subset. Do not change the v1 package.
sys.path.insert(0, str(V1_ROOT))
import corpus as v1_corpus  # type: ignore  # noqa: E402
import formats as v1_formats  # type: ignore  # noqa: E402
sys.path.pop(0)


SCHEMA = "ghostnote-compact-format-development-v2"
CORPUS_SCHEMA = "ghostnote-compact-format-development-corpus-v2"
RUN_ID = "phase8c2-initial-six-arm-r1"
SEED = 8202
OPENAI_MODEL = "gpt-5.4-mini-2026-03-17"
GEMINI_MODEL = "gemini-3.8-flash"
CLAUDE_MODEL = "claude-sonnet-5"
PROVIDERS = ("openai", "gemini", "claude")
MODELS = {"openai": OPENAI_MODEL, "gemini": GEMINI_MODEL, "claude": CLAUDE_MODEL}
KEYS = {"openai": "OPENAI_API_KEY", "gemini": "GEMINI_API_KEY", "claude": "CLAUDE_API_KEY"}
PRICES = {
    "openai": {"input": 0.75, "cached_input": 0.075, "output": 4.50},
    "gemini": {"input": 0.75, "cached_input": 0.075, "output": 3.75},
    "claude": {"input": 3.00, "cached_input": 0.30, "output": 15.00},
}
PRICE_SOURCES = {
    "openai": "https://developers.openai.com/api/docs/models/gpt-5.4-mini",
    "gemini": "https://ai.google.dev/gemini-api/docs/pricing",
    "claude": "https://platform.claude.com/docs/en/about-claude/pricing",
}
ARMS = (
    "compact-bar-v1",
    "label-only-compact",
    "full-v0-style-compact",
    "exact-json",
    "midi-like-native",
    "midi-like-composite",
)
COMPACT_ARMS = ARMS[:3]
IDENTITY_ARMS = (*COMPACT_ARMS, "exact-json", "midi-like-composite")
HARD_FAMILIES = (
    "generation-progression",
    "generation-melody",
    "continuation-roles",
    "transformation-revoice",
)
GUARD_FAMILIES = (
    "comprehension-structure",
    "transformation-local",
    "transformation-rhythm",
)
SENTINEL_FAMILY = "continuation-motif"
TASK_FAMILIES = (*HARD_FAMILIES, SENTINEL_FAMILY, *GUARD_FAMILIES)
FIELDS = ("id", "voice", "start", "duration", "pitch", "velocity")
MUSICAL_FIELDS = ("voice", "start", "duration", "pitch", "velocity")
VOICE_ORDER = ("bass", "tenor", "alto", "soprano")
LEDGER_MARKER = "--- GN SIDE LEDGER ---"
FAILURE_CLASSES = (
    "explicit-score-ledger-disagreement",
    "missing-or-invalid-side-ledger",
    "native-score-parse-failure",
    "other-output-or-patch-parse-failure",
)
OUTER_SCHEMA = {
    "type": "object",
    "properties": {"payload": {"type": "string"}},
    "required": ["payload"],
    "additionalProperties": False,
}
DEVELOPMENT_GATE = {
    "hard_family_macro_improvement": 0.05,
    "maximum_guard_macro_regression": 0.05,
    "maximum_candidate_only_losses_per_provider_family": 1,
    "maximum_input_token_ratio_to_exact_json": 0.90,
    "maximum_output_byte_ratio_to_exact_json": 0.80,
    "provider_rule": "Pass the hard and guard gates on at least two providers. Do not lose the hard macro by more than 0.05 on another provider.",
    "claim": "Development selection only. This is not population equivalence.",
}
EMPIRICAL_COST_BASIS = {
    "source": "symbolic-format-v1 dated pilot and retained manifests",
    "method": "Use the larger observed mean call cost for each provider, reprice Claude usage at the September 2026 rate, and add 25 percent.",
    "price_verification_date": "2026-09-27",
    "price_sources": PRICE_SOURCES,
    "mean_call_cost_usd": {
        "openai": 0.0039048148148148145,
        "gemini": 0.002934876739562624,
        "claude": 0.01422288888888889,
    },
    "contingency": 0.25,
}
FROZEN_PACKAGE_SHA256 = {
    "compact-bar-v0": "837b4f4a50891e9abee665c06d2e0fd559313320f79c9f9f3672bfd64bab9fbd",
    "symbolic-format-v1": "1018c31c5cc2f2777794d6ab9db5d89f475f421b8b34de9ddbec888337a662a0",
}


class ParseFailure(ValueError):
    """Keep one parse failure class and its completed stages."""

    def __init__(self, failure_class: str, message: str, stages: dict[str, bool] | None = None):
        super().__init__(message)
        self.failure_class = failure_class
        self.stages = stages or {}


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


def note(note_id: str, voice: str, start: str | int | Fraction, duration: str | int | Fraction, pitch: int, velocity: int = 84) -> dict[str, Any]:
    return {
        "id": note_id,
        "voice": voice,
        "start": fraction_text(start),
        "duration": fraction_text(duration),
        "pitch": pitch,
        "velocity": velocity,
    }


def sort_notes(values: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(values, key=lambda value: (fraction(value["start"]), value["voice"], value["pitch"], value["id"]))


def projected(notes: list[dict[str, Any]], fields: tuple[str, ...]) -> list[dict[str, Any]]:
    return [{field: value[field] for field in fields} for value in sort_notes(notes)]


def notes_by_start(notes: list[dict[str, Any]]) -> dict[Fraction, list[dict[str, Any]]]:
    result: dict[Fraction, list[dict[str, Any]]] = defaultdict(list)
    for value in notes:
        result[fraction(value["start"])].append(value)
    return dict(sorted(result.items()))


def structure_fixture(variant: int) -> dict[str, Any]:
    root = (58, 61, 66)[variant % 3]
    starts = ("0", "3/4", "7/4", "5/2", "13/4", "9/2")
    notes = [
        note(f"st{variant}-lead-{index}", "lead", start, "1/2", root + interval, 79 + index)
        for index, (start, interval) in enumerate(zip(starts, (0, 5, 2, 9, 7, 3)), start=1)
    ]
    for chord, start in enumerate(("0", "5/2", "9/2"), start=1):
        for position, interval in enumerate((0, 3, 7), start=1):
            notes.append(note(f"st{variant}-pad-{chord}-{position}", "pad", start, "5/2", root - 12 + interval + chord, 68 + position))
    notes.extend((note(f"st{variant}-bass-1", "bass", 0, "5/2", root - 24, 76), note(f"st{variant}-bass-2", "bass", "5/2", 2, root - 19, 78)))
    return {"notes": sort_notes(notes), "tempo": 97 + variant, "meters": ["5/4", "4/4"], "harmonies": ["Bb-minor", "Eb-dorian"]}


def progression_contract(variant: int) -> dict[str, Any]:
    tonic = (1, 6, 10)[variant % 3]
    source = ((0, 3, 7), (5, 8, 0), (2, 5, 9), (7, 10, 2, 5), (0, 3, 7))
    pitch_classes = [sorted((tonic + value) % 12 for value in chord) for chord in source]
    return {
        "meter": "5/4",
        "chord_starts": ["0", "1", "2", "3", "4"],
        "duration": "1",
        "pitch_classes": pitch_classes,
        "bass_pitch_classes": [tonic, (tonic + 5) % 12, (tonic + 2) % 12, (tonic + 7) % 12, tonic],
        "voice_ranges": {"bass": [36, 55], "tenor": [48, 67], "alto": [55, 74], "soprano": [63, 84]},
        "maximum_total_voice_leading": 46,
        "cadence_pitch_class": tonic,
    }


def melody_contract(variant: int) -> dict[str, Any]:
    tonic = (1, 6, 10)[variant % 3]
    starts = ["0", "1/2", "5/4", "2", "11/4", "4", "9/2", "21/4", "6", "27/4"]
    seed_offsets = (0, 2, 5, 7, 9)
    transposition = 3
    seed = [61 + tonic + value for value in seed_offsets]
    pitches = seed + [value + transposition for value in seed]
    return {
        "meter": "7/4",
        "starts": starts,
        "durations": ["1/2", "1/2", "3/4", "1/2", "3/4"] * 2,
        "range": [min(pitches) - 1, max(pitches) + 1],
        "allowed_pitch_classes": sorted({value % 12 for value in pitches}),
        "strong_beat_pitch_classes": sorted({pitches[index] % 12 for index, start in enumerate(starts) if fraction(start).denominator == 1}),
        "motif_transposition": transposition,
        "cadence_pitch_class": pitches[-1] % 12,
        "note_count": 10,
        "perfect_pitches": pitches,
    }


def role_contract(variant: int) -> dict[str, Any]:
    tonic = (1, 6, 10)[variant % 3]
    chords = ((0, 3, 7), (5, 8, 0), (3, 7, 10), (7, 10, 2), (0, 3, 7))
    return {
        "starts": ["5", "6", "7", "8", "9"],
        "harmony_pitch_classes": [sorted((tonic + value) % 12 for value in chord) for chord in chords],
        "ranges": {"bass": [35, 55], "lead": [61, 82]},
        "cadence_pitch_class": tonic,
        "maximum_role_leap": 8,
        "duration": "1",
    }


def motif_fixture(variant: int) -> dict[str, Any]:
    pitches = [65, 62, 68, 67, 70]
    seed = [note(f"mo{variant}-{index}", "lead", Fraction(index * 3, 4), "1/2", pitch + variant, 87) for index, pitch in enumerate(pitches, start=1)]
    amount = -4 + variant
    expected = [note(f"mo-out-{index}", "lead", fraction(value["start"]) + 5, value["duration"], value["pitch"] + amount, value["velocity"]) for index, value in enumerate(seed, start=1)]
    return {"source": sort_notes(seed), "operation": "sequence-transpose", "start_offset": "5", "pitch_offset": amount, "expected": sort_notes(expected)}


def local_fixture(variant: int) -> dict[str, Any]:
    source = structure_fixture(variant)
    target = deepcopy(source["notes"][4])
    change = {"operation": "set", "note_id": target["id"], "field": "velocity", "value": target["velocity"] + 7}
    expected = deepcopy(source["notes"])
    for value in expected:
        if value["id"] == target["id"]:
            value["velocity"] = change["value"]
    source["sha256"] = digest(source)
    return {"source": source, "change": change, "expected": sort_notes(expected)}


def revoice_fixture(variant: int) -> dict[str, Any]:
    root = (47, 52, 56)[variant % 3]
    notes = []
    for chord, start in enumerate(("0", "3/2", "3")):
        for position, interval in enumerate((0, 4, 7, 10), start=1):
            notes.append(note(f"rv{variant}-{chord + 1}-{position}", "keys", start, "3/2", root + chord * 3 + interval, 75 + position))
    return {"source": sort_notes(notes), "operation": ("drop-2", "first-inversion", "nearest")[variant % 3], "range": [40, 82]}


def rhythm_fixture(variant: int) -> dict[str, Any]:
    source = [note(f"ry{variant}-{index}", "perc", Fraction(index * 3, 8), "1/4", 48 + (index % 4) * 2, 80 + index) for index in range(8)]
    offset = Fraction(1, 8)
    expected = deepcopy(source)
    for index, value in enumerate(expected):
        if index % 2:
            value["start"] = fraction_text(fraction(value["start"]) + offset)
    return {"source": sort_notes(source), "operation": "late-offbeats", "odd_offset": fraction_text(offset), "expected": sort_notes(expected)}


def task(family: str, variant: int) -> dict[str, Any]:
    if family == "generation-progression":
        body = {"contract": progression_contract(variant)}
    elif family == "generation-melody":
        body = {"contract": melody_contract(variant)}
    elif family == "continuation-roles":
        body = {"contract": role_contract(variant)}
    elif family == "transformation-revoice":
        body = {"source": revoice_fixture(variant)}
    elif family == SENTINEL_FAMILY:
        source = motif_fixture(variant)
        body = {"source": source, "expected": source["expected"]}
    elif family == "comprehension-structure":
        source = structure_fixture(variant)
        body = {"source": source, "expected": source["notes"]}
    elif family == "transformation-local":
        source = local_fixture(variant)
        body = {"source": source, "expected": source["expected"]}
    elif family == "transformation-rhythm":
        source = rhythm_fixture(variant)
        body = {"source": source, "expected": source["expected"]}
    else:
        raise ValueError(f"Unknown family: {family}")
    value = {
        "schema": CORPUS_SCHEMA,
        "id": f"development-{family}-v{variant}",
        "cohort": "initial-six-arm-r1",
        "family": family,
        "variant": variant,
        "origin": "generated for Ghostnote under the repository MIT license",
        "license": "MIT",
        **body,
    }
    value["sha256"] = digest(value)
    return value


def make_corpus() -> dict[str, Any]:
    fixtures = {family: [task(family, index) for index in range(3)] for family in HARD_FAMILIES}
    fixtures[SENTINEL_FAMILY] = [task(SENTINEL_FAMILY, 0)]
    fixtures.update({family: [task(family, 0)] for family in GUARD_FAMILIES})
    value = {"schema": CORPUS_SCHEMA, "license": "MIT", "fixtures": fixtures}
    value["sha256"] = digest(value)
    return value


def source_notes(value: dict[str, Any]) -> list[dict[str, Any]]:
    source = value.get("source", {})
    if "notes" in source:
        return source["notes"]
    if "source" in source and isinstance(source["source"], dict):
        return source["source"].get("notes", source["source"].get("source", []))
    return source.get("source", []) if isinstance(source, dict) else []


def score_item(notes: list[dict[str, Any]], value: dict[str, Any], item_id: str) -> dict[str, Any]:
    voices = sorted({note_value["voice"] for note_value in notes}) or ["music"]
    end = max((fraction(note_value["start"]) + fraction(note_value["duration"]) for note_value in notes), default=Fraction(1))
    source = value.get("source", {})
    if "source" in source and isinstance(source["source"], dict):
        source = source["source"]
    meters = source.get("meters", [value.get("contract", {}).get("meter", "4/4")]) if isinstance(source, dict) else ["4/4"]
    harmonies = source.get("harmonies", []) if isinstance(source, dict) else []
    tempo = source.get("tempo", 104) if isinstance(source, dict) else 104
    bars = []
    cursor = Fraction(0)
    for index, meter in enumerate(meters, start=1):
        length = Fraction(int(meter.split("/")[0]) * 4, int(meter.split("/")[1]))
        harmony = harmonies[index - 1] if index <= len(harmonies) else "task-contract"
        bars.append({"number": index, "start": fraction_text(cursor), "length": fraction_text(length), "meter": meter, "harmony": harmony})
        cursor += length
    if not bars or cursor < end:
        bars.append({"number": len(bars) + 1, "start": fraction_text(cursor), "length": fraction_text(max(Fraction(1), end - cursor)), "meter": meters[-1], "harmony": "task-contract"})
    return {
        "id": item_id,
        "sha256": value.get("sha256", digest(notes)),
        "tempo_bpm": tempo,
        "bars": bars,
        "tracks": [{"id": voice, "role": voice, "voice": f"{voice}.1"} for voice in voices],
        "regions": [{"id": "task-region", "start": "0", "end": fraction_text(end)}],
        "notes": [{**note_value, "track": note_value["voice"]} for note_value in sort_notes(notes)],
    }


def render_full_v0_item(item: dict[str, Any]) -> str:
    lines = [
        f"SCORE {item['id']} HASH {item['sha256']} TEMPO {item['tempo_bpm']}",
        "FIELDS id track position duration pitch velocity",
        "OMITS channel mute release_velocity articulation expression",
    ]
    lines.extend(f"BAR {bar['number']} START {bar['start']} LENGTH {bar['length']} METER {bar['meter']} HARMONY {bar['harmony']}" for bar in item["bars"])
    lines.extend(f"TRACK {track['id']} ROLE {track['role']} VOICE {track['voice']}" for track in item["tracks"])
    lines.extend(f"REGION {region['id']} START {region['start']} END {region['end']}" for region in item["regions"])
    lines.extend(f"NOTE {value['id']} TRACK {value['track']} POSITION {value['start']} DURATION {value['duration']} PITCH {value['pitch']} VELOCITY {value['velocity']}" for value in item["notes"])
    return "\n".join(lines)


def exact_object(notes: list[dict[str, Any]], metadata: dict[str, Any], item_id: str) -> dict[str, Any]:
    item = score_item(notes, metadata, item_id)
    return {
        "score": {"id": item["id"], "hash": item["sha256"], "tempo": item["tempo_bpm"], "fields": ["id", "voice", "start", "duration", "pitch", "velocity"], "omits": ["channel", "mute", "release_velocity", "articulation", "expression"]},
        "bars": item["bars"],
        "tracks": item["tracks"],
        "regions": item["regions"],
        "notes": sort_notes(notes),
    }


def ledger_text(notes: list[dict[str, Any]]) -> str:
    return "\n".join(f"GN {value['id']} {value['voice']} {value['start']} {value['duration']} {value['pitch']} {value['velocity']}" for value in sort_notes(notes))


def render_events(arm: str, notes: list[dict[str, Any]], metadata: dict[str, Any], item_id: str) -> str:
    if arm == "compact-bar-v1":
        return "\n".join(f"N {value['id']} {value['voice']} {value['start']} {value['duration']} {value['pitch']} {value['velocity']}" for value in sort_notes(notes))
    if arm == "label-only-compact":
        return "\n".join(f"N ID {value['id']} VOICE {value['voice']} START {value['start']} DURATION {value['duration']} PITCH {value['pitch']} VELOCITY {value['velocity']}" for value in sort_notes(notes))
    if arm == "full-v0-style-compact":
        return render_full_v0_item(score_item(notes, metadata, item_id))
    if arm == "exact-json":
        return canonical(exact_object(notes, metadata, item_id))
    score = v1_formats.render_midi_like(notes, False)
    return score if arm == "midi-like-native" else score + f"\n{LEDGER_MARKER}\n" + ledger_text(notes)


def normalize_notes(notes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for index, value in enumerate(notes, start=1):
        result.append({"id": str(value["id"] or f"native-{index}"), "voice": str(value["voice"]), "start": fraction_text(value["start"]), "duration": fraction_text(value["duration"]), "pitch": int(value["pitch"]), "velocity": int(value.get("velocity", 84))})
    identities = [value["id"] for value in result]
    if len(identities) != len(set(identities)):
        raise ValueError("Payload has duplicate IDs")
    return sort_notes(result)


def parse_rows(text: str, pattern: re.Pattern[str], builder: Any, label: str) -> list[dict[str, Any]]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    result = []
    for line in lines:
        match = pattern.fullmatch(line)
        if not match:
            raise ValueError(f"Invalid {label} row: {line}")
        result.append(builder(match))
    if not result:
        raise ValueError(f"{label} payload has no notes")
    return normalize_notes(result)


def parse_compact_v1(text: str) -> list[dict[str, Any]]:
    pattern = re.compile(r"N (\S+) (\S+) (\S+) (\S+) (\d+) (\d+)")
    return parse_rows(text, pattern, lambda match: dict(zip(FIELDS, (match[1], match[2], match[3], match[4], int(match[5]), int(match[6])))), "compact-bar v1")


def parse_label_only(text: str) -> list[dict[str, Any]]:
    pattern = re.compile(r"N ID (\S+) VOICE (\S+) START (\S+) DURATION (\S+) PITCH (\d+) VELOCITY (\d+)")
    return parse_rows(text, pattern, lambda match: dict(zip(FIELDS, (match[1], match[2], match[3], match[4], int(match[5]), int(match[6])))), "label-only compact")


def parse_full_v0(text: str) -> list[dict[str, Any]]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    required = {
        "score": any(line.startswith("SCORE ") for line in lines),
        "fields": "FIELDS id track position duration pitch velocity" in lines,
        "omits": any(line.startswith("OMITS ") for line in lines),
        "bar": any(line.startswith("BAR ") for line in lines),
        "track": any(line.startswith("TRACK ") for line in lines),
        "region": any(line.startswith("REGION ") for line in lines),
    }
    if not all(required.values()):
        missing = sorted(name for name, present in required.items() if not present)
        raise ValueError(f"Full v0-style compact payload lacks structure: {','.join(missing)}")
    allowed = ("SCORE ", "FIELDS ", "OMITS ", "BAR ", "TRACK ", "REGION ", "NOTE ")
    if any(not line.startswith(allowed) for line in lines):
        raise ValueError("Full v0-style compact payload has an unknown row")
    pattern = re.compile(r"NOTE (\S+) TRACK (\S+) POSITION (\S+) DURATION (\S+) PITCH (\d+) VELOCITY (\d+)")
    note_lines = [line for line in lines if line.startswith("NOTE ")]
    return parse_rows(note_lines and "\n".join(note_lines) or "", pattern, lambda match: dict(zip(FIELDS, (match[1], match[2], match[3], match[4], int(match[5]), int(match[6])))), "full v0-style compact")


def parse_exact(text: str) -> list[dict[str, Any]]:
    value = json.loads(text)
    if set(value) != {"score", "bars", "tracks", "regions", "notes"}:
        raise ValueError("Exact JSON has incorrect top-level fields")
    if not all(isinstance(value[name], list) and value[name] for name in ("bars", "tracks", "regions")):
        raise ValueError("Exact JSON lacks structural arrays")
    return normalize_notes(value["notes"])


def parse_midi_score(text: str) -> list[dict[str, Any]]:
    pattern = re.compile(r"TRACK_(\S+) TIME_(\S+) NOTE_ON_(\d+) DURATION_(\S+) VELOCITY_(\d+)")
    return parse_rows(text, pattern, lambda match: {"id": "", "voice": match[1], "start": match[2], "duration": match[4], "pitch": int(match[3]), "velocity": int(match[5])}, "native MIDI-Like")


def parse_ledger(text: str) -> list[dict[str, Any]]:
    pattern = re.compile(r"GN (\S+) (\S+) (\S+) (\S+) (\d+) (\d+)")
    return parse_rows(text, pattern, lambda match: dict(zip(FIELDS, (match[1], match[2], match[3], match[4], int(match[5]), int(match[6])))), "GN side ledger")


def parse_events(arm: str, text: str) -> tuple[list[dict[str, Any]], dict[str, bool]]:
    stages = {"native_score": False, "side_ledger": False, "alignment": False}
    try:
        if arm == "compact-bar-v1":
            return parse_compact_v1(text), stages
        if arm == "label-only-compact":
            return parse_label_only(text), stages
        if arm == "full-v0-style-compact":
            return parse_full_v0(text), stages
        if arm == "exact-json":
            return parse_exact(text), stages
        if arm == "midi-like-native":
            return parse_midi_score(text), {**stages, "native_score": True}
        if text.count(LEDGER_MARKER) != 1:
            raise ParseFailure("missing-or-invalid-side-ledger", "Composite output needs one side-ledger marker", stages)
        score_text, ledger_source = text.split(LEDGER_MARKER, 1)
        try:
            score_notes = parse_midi_score(score_text.strip())
            stages["native_score"] = True
        except (KeyError, TypeError, ValueError, re.error) as error:
            raise ParseFailure("native-score-parse-failure", str(error), stages) from error
        try:
            ledger = parse_ledger(ledger_source.strip())
            stages["side_ledger"] = True
        except (KeyError, TypeError, ValueError, re.error) as error:
            raise ParseFailure("missing-or-invalid-side-ledger", str(error), stages) from error
        if projected(score_notes, MUSICAL_FIELDS) != projected(ledger, MUSICAL_FIELDS):
            raise ParseFailure("explicit-score-ledger-disagreement", "Native score and side ledger disagree", stages)
        stages["alignment"] = True
        return ledger, stages
    except ParseFailure:
        raise
    except (KeyError, TypeError, ValueError, json.JSONDecodeError, re.error) as error:
        raise ParseFailure("other-output-or-patch-parse-failure", str(error), stages) from error


def render_patch(arm: str, base_sha256: str, operation: dict[str, Any]) -> str:
    if arm == "exact-json":
        return canonical({"base_sha256": base_sha256, "ops": [operation]})
    fields = " ".join(f"{name}={value}" for name, value in operation.items() if name not in {"op", "id"})
    return f"PATCH {base_sha256}\nSET {operation['id']} {fields}"


def parse_patch(arm: str, text: str) -> dict[str, Any]:
    try:
        if arm == "exact-json":
            value = json.loads(text)
            if set(value) != {"base_sha256", "ops"}:
                raise ValueError("Exact patch has incorrect fields")
            return value
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if len(lines) != 2 or not lines[0].startswith("PATCH "):
            raise ValueError("Text patch needs one PATCH header and one SET row")
        parts = lines[1].split()
        if len(parts) < 3 or parts[0] != "SET":
            raise ValueError("Text patch needs one SET row")
        operation: dict[str, Any] = {"op": "set", "id": parts[1]}
        for token in parts[2:]:
            name, raw = token.split("=", 1)
            operation[name] = int(raw) if name in {"pitch", "velocity"} else raw
        return {"base_sha256": lines[0].split(maxsplit=1)[1], "ops": [operation]}
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise ParseFailure("other-output-or-patch-parse-failure", str(error)) from error


def compile_patch(value: dict[str, Any], source: list[dict[str, Any]], base_sha256: str) -> list[dict[str, Any]]:
    if value.get("base_sha256") != base_sha256:
        raise ValueError("Patch base hash is stale")
    if len(value.get("ops", [])) != 1:
        raise ValueError("Patch must contain one operation")
    result = deepcopy(source)
    operation = value["ops"][0]
    target = next((item for item in result if item["id"] == operation.get("id")), None)
    if target is None or operation.get("op") != "set":
        raise ValueError("Patch target or operation is invalid")
    for name, field_value in operation.items():
        if name not in {"op", "id"}:
            if name not in {"voice", "start", "duration", "pitch", "velocity"}:
                raise ValueError(f"Patch field is unsupported: {name}")
            target[name] = fraction_text(field_value) if name in {"start", "duration"} else field_value
    return sort_notes(result)


def progression_candidates(contract: dict[str, Any], index: int) -> list[tuple[int, int, int, int]]:
    pitch_classes = contract["pitch_classes"][index]
    choices = []
    for voice in VOICE_ORDER:
        low, high = contract["voice_ranges"][voice]
        allowed = [pitch for pitch in range(low, high + 1) if pitch % 12 in pitch_classes]
        if voice == "bass":
            allowed = [pitch for pitch in allowed if pitch % 12 == contract["bass_pitch_classes"][index]]
        choices.append(allowed)
    result = []
    for pitches in itertools.product(*choices):
        if list(pitches) != sorted(pitches) or len(set(pitches)) != 4:
            continue
        if not set(pitch_classes).issubset({pitch % 12 for pitch in pitches}):
            continue
        result.append(pitches)
    return result


def perfect_progression(contract: dict[str, Any]) -> list[dict[str, Any]]:
    selected = []
    for index in range(len(contract["chord_starts"])):
        candidates = progression_candidates(contract, index)
        if not candidates:
            raise ValueError("Progression contract has no voicing")
        choice = min(candidates, key=lambda pitches: sum(pitches) if not selected else sum(abs(a - b) for a, b in zip(pitches, selected[-1])))
        selected.append(choice)
    return sort_notes([note(f"pg-{chord + 1}-{voice}", voice, contract["chord_starts"][chord], contract["duration"], pitch, 82) for chord, pitches in enumerate(selected) for voice, pitch in zip(VOICE_ORDER, pitches)])


def score_progression(notes: list[dict[str, Any]], contract: dict[str, Any]) -> dict[str, bool]:
    groups = notes_by_start(notes)
    starts = [fraction(value) for value in contract["chord_starts"]]
    ordered = []
    harmony = inversions = ranges = True
    crossing = False
    for index, start in enumerate(starts):
        by_voice = {value["voice"]: value["pitch"] for value in groups.get(start, [])}
        if set(by_voice) != set(VOICE_ORDER):
            continue
        pitches = tuple(by_voice[voice] for voice in VOICE_ORDER)
        ordered.append(pitches)
        harmony &= set(contract["pitch_classes"][index]).issubset({pitch % 12 for pitch in pitches})
        inversions &= pitches[0] % 12 == contract["bass_pitch_classes"][index]
        ranges &= all(contract["voice_ranges"][voice][0] <= by_voice[voice] <= contract["voice_ranges"][voice][1] for voice in VOICE_ORDER)
        crossing |= list(pitches) != sorted(pitches)
    movement = sum(sum(abs(a - b) for a, b in zip(previous, current)) for previous, current in zip(ordered, ordered[1:]))
    complete = len(ordered) == len(starts)
    return {
        "chord_starts": list(groups) == starts,
        "named_voices": complete,
        "harmony": complete and harmony,
        "inversions": complete and inversions,
        "ranges": complete and ranges,
        "no_voice_crossing": complete and not crossing,
        "voice_leading": complete and movement <= contract["maximum_total_voice_leading"],
        "cadence": complete and ordered[-1][0] % 12 == contract["cadence_pitch_class"],
    }


def perfect_melody(contract: dict[str, Any]) -> list[dict[str, Any]]:
    return [note(f"ml-{index + 1}", "lead", start, duration, pitch, 88) for index, (start, duration, pitch) in enumerate(zip(contract["starts"], contract["durations"], contract["perfect_pitches"]))]


def score_melody(notes: list[dict[str, Any]], contract: dict[str, Any]) -> dict[str, bool]:
    ordered = sort_notes(notes)
    pitches = [value["pitch"] for value in ordered]
    strong = [value for value in ordered if fraction(value["start"]).denominator == 1]
    half = contract["note_count"] // 2
    return {
        "note_count": len(ordered) == contract["note_count"],
        "rhythm": [value["start"] for value in ordered] == contract["starts"] and [value["duration"] for value in ordered] == contract["durations"],
        "range": all(contract["range"][0] <= pitch <= contract["range"][1] for pitch in pitches),
        "pitch_collection": all(pitch % 12 in contract["allowed_pitch_classes"] for pitch in pitches),
        "strong_beat_harmony": all(value["pitch"] % 12 in contract["strong_beat_pitch_classes"] for value in strong),
        "motif": len(pitches) == contract["note_count"] and all(pitches[index + half] - pitches[index] == contract["motif_transposition"] for index in range(half)),
        "cadence": bool(pitches) and pitches[-1] % 12 == contract["cadence_pitch_class"],
    }


def perfect_roles(contract: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    previous: dict[str, int | None] = {"bass": None, "lead": None}
    for index, (start, pitch_classes) in enumerate(zip(contract["starts"], contract["harmony_pitch_classes"])):
        for voice in ("bass", "lead"):
            low, high = contract["ranges"][voice]
            candidates = [pitch for pitch in range(low, high + 1) if pitch % 12 in pitch_classes]
            if index == len(contract["starts"]) - 1 and voice == "lead":
                candidates = [pitch for pitch in candidates if pitch % 12 == contract["cadence_pitch_class"]]
            pitch = candidates[0] if previous[voice] is None else min(candidates, key=lambda value: abs(value - int(previous[voice])))
            previous[voice] = pitch
            result.append(note(f"rl-{voice}-{index + 1}", voice, start, contract["duration"], pitch, 79 if voice == "bass" else 89))
    return sort_notes(result)


def score_roles(notes: list[dict[str, Any]], contract: dict[str, Any]) -> dict[str, bool]:
    groups = notes_by_start(notes)
    starts = [fraction(value) for value in contract["starts"]]
    lanes = {voice: sorted([value for value in notes if value["voice"] == voice], key=lambda value: fraction(value["start"])) for voice in ("bass", "lead")}
    return {
        "starts": list(groups) == starts,
        "role_density": all(len(values) == len(starts) for values in lanes.values()) and len(notes) == len(starts) * 2,
        "ranges": all(contract["ranges"][value["voice"]][0] <= value["pitch"] <= contract["ranges"][value["voice"]][1] for value in notes if value["voice"] in contract["ranges"]),
        "harmony": all(all(value["pitch"] % 12 in contract["harmony_pitch_classes"][index] for value in groups.get(start, [])) for index, start in enumerate(starts)),
        "voice_leading": all(all(abs(b["pitch"] - a["pitch"]) <= contract["maximum_role_leap"] for a, b in zip(values, values[1:])) for values in lanes.values()),
        "no_collisions": all(len({value["pitch"] for value in groups.get(start, [])}) == 2 for start in starts),
        "cadence": bool(lanes["lead"]) and lanes["lead"][-1]["pitch"] % 12 == contract["cadence_pitch_class"],
    }


def revoice_expected(value: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    previous: list[int] | None = None
    for chord, (start, rows) in enumerate(notes_by_start(value["source"]).items(), start=1):
        pitches = sorted(item["pitch"] for item in rows)
        if value["operation"] == "drop-2":
            pitches[-2] -= 12
            pitches.sort()
        elif value["operation"] == "first-inversion":
            pitches = sorted(pitches[1:] + [pitches[0] + 12])
        elif previous is not None:
            choices = [sorted(pitch + shift for pitch, shift in zip(pitches, shifts)) for shifts in itertools.product((-12, 0, 12), repeat=4)]
            choices = [choice for choice in choices if value["range"][0] <= choice[0] and choice[-1] <= value["range"][1]]
            pitches = min(choices, key=lambda choice: sum(abs(a - b) for a, b in zip(previous or choice, choice)))
        previous = pitches
        for position, pitch in enumerate(pitches, start=1):
            result.append(note(f"rv-out-{chord}-{position}", "keys", start, "3/2", pitch, 78))
    return sort_notes(result)


def event_failure_eligibility(arm: str, family: str, stages: dict[str, bool]) -> dict[str, bool]:
    composite_event = arm == "midi-like-composite" and family != "transformation-local"
    return {
        "explicit-score-ledger-disagreement": composite_event and stages.get("native_score", False) and stages.get("side_ledger", False),
        "missing-or-invalid-side-ledger": composite_event,
        "native-score-parse-failure": composite_event,
        "other-output-or-patch-parse-failure": True,
    }


def score_response(arm: str, value: dict[str, Any], payload: str) -> dict[str, Any]:
    family = value["family"]
    stages = {"native_score": False, "side_ledger": False, "alignment": False}
    try:
        if family == "transformation-local" and arm in IDENTITY_ARMS:
            source = value["source"]["source"]
            parsed_patch = parse_patch(arm, payload)
            compiled = compile_patch(parsed_patch, source["notes"], source["sha256"])
            checks = {
                "canonical_result": projected(compiled, FIELDS) == projected(value["expected"], FIELDS),
                "stable_identity": {item["id"] for item in compiled}.issubset({item["id"] for item in source["notes"]}),
                "exact_preservation": sum(before == after for before, after in zip(source["notes"], compiled)) >= len(source["notes"]) - 1,
                "sparse_change": len(parsed_patch["ops"]) == 1,
            }
        else:
            notes, stages = parse_events(arm, payload)
            if family == "generation-progression":
                checks = score_progression(notes, value["contract"])
            elif family == "generation-melody":
                checks = score_melody(notes, value["contract"])
            elif family == "continuation-roles":
                checks = score_roles(notes, value["contract"])
            elif family == "transformation-revoice":
                expected = revoice_expected(value["source"])
                checks = {
                    "named_voicing": projected(notes, MUSICAL_FIELDS) == projected(expected, MUSICAL_FIELDS),
                    "harmony_preserved": [sorted(item["pitch"] % 12 for item in rows) for rows in notes_by_start(notes).values()] == [sorted(item["pitch"] % 12 for item in rows) for rows in notes_by_start(value["source"]["source"]).values()],
                    "range": all(value["source"]["range"][0] <= item["pitch"] <= value["source"]["range"][1] for item in notes),
                }
            else:
                expected = value["expected"]
                fields = FIELDS if arm in IDENTITY_ARMS else MUSICAL_FIELDS
                checks = {"exact_relation": projected(notes, fields) == projected(expected, fields)}
        return {
            "syntax_pass": True,
            "musical_pass": all(checks.values()),
            "checks": checks,
            "failure_class": None,
            "failure_eligibility": event_failure_eligibility(arm, family, stages),
            "parse_stages": stages,
        }
    except ParseFailure as error:
        stages = error.stages
        return {
            "syntax_pass": False,
            "musical_pass": False,
            "checks": {},
            "failure_class": error.failure_class,
            "failure_eligibility": event_failure_eligibility(arm, family, stages),
            "parse_stages": stages,
            "error": str(error),
        }
    except (KeyError, TypeError, ValueError, re.error) as error:
        return {
            "syntax_pass": False,
            "musical_pass": False,
            "checks": {},
            "failure_class": "other-output-or-patch-parse-failure",
            "failure_eligibility": event_failure_eligibility(arm, family, stages),
            "parse_stages": stages,
            "error": str(error),
        }


def perfect_payload(arm: str, value: dict[str, Any]) -> str:
    family = value["family"]
    if family == "generation-progression":
        notes = perfect_progression(value["contract"])
    elif family == "generation-melody":
        notes = perfect_melody(value["contract"])
    elif family == "continuation-roles":
        notes = perfect_roles(value["contract"])
    elif family == "transformation-revoice":
        notes = revoice_expected(value["source"])
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
        if arm == "exact-json":
            return "Return one sparse JSON patch with base_sha256 and one SET operation in ops."
        return "Return PATCH <base_sha256> and exactly one SET <id> field=value row."
    return {
        "compact-bar-v1": "Return N <id> <voice> <start> <duration> <pitch> <velocity>, one note per row.",
        "label-only-compact": "Return N ID <id> VOICE <voice> START <start> DURATION <duration> PITCH <pitch> VELOCITY <velocity>, one note per row.",
        "full-v0-style-compact": "Return SCORE, FIELDS, OMITS, BAR, TRACK, REGION, and labeled NOTE rows. Keep every structural row type.",
        "exact-json": "Return exact JSON with score, bars, tracks, regions, and notes. Each note has id, voice, start, duration, pitch, and velocity.",
        "midi-like-native": "Return TRACK_<voice> TIME_<start> NOTE_ON_<pitch> DURATION_<duration> VELOCITY_<velocity> rows without IDs.",
        "midi-like-composite": f"Return native MIDI-Like rows, then {LEDGER_MARKER} and GN <id> <voice> <start> <duration> <pitch> <velocity> for every score note.",
    }[arm]


def output_example(arm: str, family: str) -> str:
    if family == "transformation-local" and arm in IDENTITY_ARMS:
        return '{"base_sha256":"abc","ops":[{"op":"set","id":"n1","velocity":87}]}' if arm == "exact-json" else "PATCH abc\nSET n1 velocity=87"
    return {
        "compact-bar-v1": "N n1 lead 0 1/2 60 80",
        "label-only-compact": "N ID n1 VOICE lead START 0 DURATION 1/2 PITCH 60 VELOCITY 80",
        "full-v0-style-compact": "SCORE s1 HASH abc TEMPO 120\nFIELDS id track position duration pitch velocity\nOMITS channel mute release_velocity articulation expression\nBAR 1 START 0 LENGTH 4 METER 4/4 HARMONY C\nTRACK lead ROLE lead VOICE lead.1\nREGION r1 START 0 END 4\nNOTE n1 TRACK lead POSITION 0 DURATION 1/2 PITCH 60 VELOCITY 80",
        "exact-json": '{"score":{"id":"s1","hash":"abc","tempo":120,"fields":["id","voice","start","duration","pitch","velocity"],"omits":["channel"]},"bars":[{"number":1}],"tracks":[{"id":"lead"}],"regions":[{"id":"r1"}],"notes":[{"id":"n1","voice":"lead","start":"0","duration":"1/2","pitch":60,"velocity":80}]}',
        "midi-like-native": "TRACK_lead TIME_0 NOTE_ON_60 DURATION_1/2 VELOCITY_80",
        "midi-like-composite": f"TRACK_lead TIME_0 NOTE_ON_60 DURATION_1/2 VELOCITY_80\n{LEDGER_MARKER}\nGN n1 lead 0 1/2 60 80",
    }[arm]


def task_instruction(value: dict[str, Any]) -> str:
    family = value["family"]
    if family == "generation-progression":
        return f"Realize the five-chord progression. Use bass, tenor, alto, and soprano once at each start. Satisfy this contract: {canonical(value['contract'])}"
    if family == "generation-melody":
        return f"Create one lead melody. Satisfy every rhythm, range, pitch, motif, strong-beat, and cadence constraint: {canonical(value['contract'])}"
    if family == "continuation-roles":
        return f"Continue with exactly five bass notes and five lead notes. Satisfy the role and harmony contract: {canonical(value['contract'])}"
    if family == "transformation-revoice":
        source = value["source"]
        return f"Revoice each four-note chord with operation={source['operation']}. Keep each start, duration, chord pitch classes, and range {source['range']}."
    if family == SENTINEL_FAMILY:
        source = value["source"]
        return f"Return only five continuation notes. Add {source['start_offset']} to each start and {source['pitch_offset']} to each pitch. Keep durations, voice, and velocity."
    if family == "comprehension-structure":
        return "Reconstruct every represented note. Keep exact onsets, durations, voices, polyphony, velocity, and identity when the arm represents it."
    if family == "transformation-local":
        return f"Apply only this local change. Preserve all unrelated represented notes: {canonical(value['source']['change'])}. Base SHA-256 is {value['source']['source']['sha256']}."
    if family == "transformation-rhythm":
        return f"Add {value['source']['odd_offset']} beat to each odd-indexed note start. Keep even starts, durations, pitches, voices, and velocities."
    raise ValueError(f"Unknown family: {family}")


def prompt_for(arm: str, value: dict[str, Any]) -> str:
    sections = [
        "Complete one deterministic symbolic-music task.",
        "Return one JSON object with exactly one string field named payload. Put the requested representation in that string. Do not add prose.",
        f"Representation arm: {arm}.",
        output_grammar(arm, value["family"]),
        "Follow this output example exactly, but use the task values:\n" + output_example(arm, value["family"]),
        task_instruction(value),
    ]
    source = represented_source(arm, value)
    if source is not None:
        sections.extend(("SOURCE", source, "END SOURCE"))
    return "\n\n".join(sections)


def development_jobs() -> list[dict[str, Any]]:
    corpus = make_corpus()
    jobs = []
    for arm in ARMS:
        for family in HARD_FAMILIES:
            for value in corpus["fixtures"][family]:
                jobs.append({"arm": arm, "family": family, "variant": value["variant"], "repeat": 0, "sentinel": False, "task": value})
        for family in GUARD_FAMILIES:
            value = corpus["fixtures"][family][0]
            jobs.append({"arm": arm, "family": family, "variant": 0, "repeat": 0, "sentinel": False, "task": value})
        value = corpus["fixtures"][SENTINEL_FAMILY][0]
        for repeat in range(3):
            jobs.append({"arm": arm, "family": SENTINEL_FAMILY, "variant": 0, "repeat": repeat, "sentinel": True, "task": value})
    return jobs


def capability_manifest() -> dict[str, Any]:
    result = {}
    for arm in ARMS:
        has_identity = arm in IDENTITY_ARMS
        result[arm] = {
            "condition": "compact-candidate" if arm in {"label-only-compact", "full-v0-style-compact"} else "development-baseline" if arm == "compact-bar-v1" else "structured-control" if arm == "exact-json" else "native-control" if arm == "midi-like-native" else "side-ledger-diagnostic",
            "one_canonical_musical_representation": arm != "midi-like-composite",
            "stable_identity": has_identity,
            "exact_omitted_note_preservation": has_identity,
            "sparse_local_patch": has_identity,
            "native_musical_score": arm in {"midi-like-native", "midi-like-composite"},
            "proposed_product_format": arm in {"label-only-compact", "full-v0-style-compact"},
        }
    return result


def fixed_v0_renders() -> dict[str, Any]:
    script = "import json; from corpus import make_corpus; from benchmark import render_compact; c=make_corpus(); print(json.dumps({'items': c, 'renders': {k: render_compact(v) for k, v in c.items()}}, sort_keys=True))"
    process = subprocess.run([sys.executable, "-c", script], cwd=V0_ROOT, check=True, capture_output=True, text=True)
    return json.loads(process.stdout)


def frozen_package_check(root: Path, expected: str) -> dict[str, Any]:
    process = subprocess.run([sys.executable, "benchmark.py", "--deterministic"], cwd=root, check=True, capture_output=True, text=True)
    actual = json.loads(process.stdout)["sha256"]
    return {"expected": expected, "actual": actual, "pass": actual == expected}


def deterministic_screen() -> dict[str, Any]:
    corpus = make_corpus()
    structure = corpus["fixtures"]["comprehension-structure"][0]
    round_trips = []
    for arm in ARMS:
        rendered = render_events(arm, structure["expected"], structure, structure["id"])
        parsed, stages = parse_events(arm, rendered)
        fields = FIELDS if arm in IDENTITY_ARMS else MUSICAL_FIELDS
        round_trips.append({"arm": arm, "pass": projected(parsed, fields) == projected(structure["expected"], fields), "bytes": len(rendered.encode()), "sha256": sha256_text(rendered), "parse_stages": stages})
    perfect_checks = []
    for arm in ARMS:
        for family, values in corpus["fixtures"].items():
            for value in values:
                scored = score_response(arm, value, perfect_payload(arm, value))
                perfect_checks.append({"arm": arm, "task": value["id"], "pass": scored["musical_pass"]})
    fixed = fixed_v0_renders()
    parity = [{"fixture": name, "pass": render_full_v0_item(item) == fixed["renders"][name], "sha256": sha256_text(fixed["renders"][name])} for name, item in fixed["items"].items()]
    v0_sample = render_full_v0_item(next(iter(fixed["items"].values())))
    parity_guards = {
        "required_structure": all(token in v0_sample for token in ("SCORE ", "FIELDS ", "OMITS ", "BAR ", "TRACK ", "ROLE ", "VOICE ", "REGION ", "NOTE ", "POSITION ")),
        "rejects_v1_shorthand": not score_response("full-v0-style-compact", structure, render_events("compact-bar-v1", structure["expected"], structure, structure["id"]))["syntax_pass"],
        "label_only_has_no_full_headers": not any(line.startswith(("SCORE ", "BAR ", "TRACK ", "REGION ")) for line in render_events("label-only-compact", structure["expected"], structure, structure["id"]).splitlines()),
    }
    failure_controls = []
    composite = perfect_payload("midi-like-composite", structure)
    score_text, ledger = composite.split(LEDGER_MARKER, 1)
    cases = {
        "explicit-score-ledger-disagreement": score_text + LEDGER_MARKER + ledger.replace(" 58 ", " 59 ", 1),
        "missing-or-invalid-side-ledger": score_text,
        "native-score-parse-failure": "BAD SCORE\n" + LEDGER_MARKER + ledger,
    }
    for expected_class, payload in cases.items():
        scored = score_response("midi-like-composite", structure, payload)
        failure_controls.append({"expected": expected_class, "actual": scored["failure_class"], "pass": scored["failure_class"] == expected_class})
    local = corpus["fixtures"]["transformation-local"][0]
    other = score_response("full-v0-style-compact", local, "BAD PATCH")
    failure_controls.append({"expected": "other-output-or-patch-parse-failure", "actual": other["failure_class"], "pass": other["failure_class"] == "other-output-or-patch-parse-failure"})
    v1_hashes = {value["sha256"] for values in v1_corpus.make_corpus()["retained"].values() for value in values}
    fresh_hashes = {value["sha256"] for values in corpus["fixtures"].values() for value in values}
    frozen = {
        "compact-bar-v0": frozen_package_check(V0_ROOT, FROZEN_PACKAGE_SHA256["compact-bar-v0"]),
        "symbolic-format-v1": frozen_package_check(V1_ROOT, FROZEN_PACKAGE_SHA256["symbolic-format-v1"]),
    }
    all_checks = round_trips + perfect_checks + parity + failure_controls
    result = {
        "schema": SCHEMA,
        "corpus": {"schema": CORPUS_SCHEMA, "sha256": corpus["sha256"], "fixture_count": sum(len(values) for values in corpus["fixtures"].values()), "retained_v1_hash_overlap": len(v1_hashes & fresh_hashes)},
        "round_trips": round_trips,
        "perfect_response_checks": perfect_checks,
        "renderer_parity": parity,
        "renderer_parity_guards": parity_guards,
        "composite_failure_controls": failure_controls,
        "frozen_packages": frozen,
        "all_checks_pass": all(value["pass"] for value in all_checks) and all(parity_guards.values()) and not (v1_hashes & fresh_hashes) and all(value["pass"] for value in frozen.values()),
    }
    result["sha256"] = digest(result)
    return result


def protocol_manifest() -> dict[str, Any]:
    jobs = development_jobs()
    prompts = {f"{job['arm']}:{job['family']}:{job['variant']}:{job['repeat']}": sha256_text(prompt_for(job["arm"], job["task"])) for job in jobs}
    package_files = ("benchmark.py", "README.md")
    value = {
        "schema": SCHEMA,
        "run_id": RUN_ID,
        "hypothesis": "Explicit event labels or the complete v0 hierarchy improve hard-family results over positional compact-bar v1.",
        "bounded_syntax_delta": "Compare label-only rows and the unchanged v0 structural grammar. Do not add another canonical score.",
        "arms": list(ARMS),
        "hard_families": list(HARD_FAMILIES),
        "guard_families": list(GUARD_FAMILIES),
        "sentinel": {"family": SENTINEL_FAMILY, "same_prompt_repetitions_per_arm": 3},
        "sample": {"hard_variants_per_family": 3, "guard_variants_per_family": 1, "calls_per_arm_provider": 18, "calls_per_provider": len(jobs), "total_provider_calls": len(jobs) * len(PROVIDERS)},
        "providers": list(PROVIDERS),
        "models": MODELS,
        "settings": {"openai": {"reasoning_effort": "low", "max_completion_tokens": 3000}, "gemini": {"thinking_level": "low", "max_output_tokens": 3000}, "claude": {"effort": "low", "max_tokens": 3000}, "temperature": "provider default"},
        "failure_classes": list(FAILURE_CLASSES),
        "failure_denominators": {
            "explicit-score-ledger-disagreement": "Composite event responses where both the native score and side ledger parsed.",
            "missing-or-invalid-side-ledger": "All composite event responses that require a side ledger.",
            "native-score-parse-failure": "All composite event responses that require a native score.",
            "other-output-or-patch-parse-failure": "All initial responses, including sparse patch responses.",
        },
        "capabilities": capability_manifest(),
        "development_gate": DEVELOPMENT_GATE,
        "repair_policy": "No repair calls. Initial results and any later repair cohort must stay separate.",
        "stopping_rule": "Run the fixed 108 calls per provider. Do not adapt this initial scope after calls start.",
        "privacy": "Send generated MIT symbolic text only. Do not send live project data, MIDI files, audio, or API keys.",
        "prompt_sha256": prompts,
        "package_file_sha256": {name: sha256_text((PACKAGE_ROOT / name).read_text()) for name in package_files if (PACKAGE_ROOT / name).exists()},
    }
    value["sha256"] = digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    calls = protocol["sample"]["calls_per_provider"]
    estimates = {}
    for provider in PROVIDERS:
        mean = EMPIRICAL_COST_BASIS["mean_call_cost_usd"][provider]
        estimates[provider] = {"calls": calls, "estimated_cost_usd": round(calls * mean * (1 + EMPIRICAL_COST_BASIS["contingency"]), 6)}
    value = {
        "schema": SCHEMA,
        "run_kind": "provider-run-plan",
        "run_id": RUN_ID,
        "approval": {"status": "pending", "requirement": "Get explicit operator approval for this exact run ID, scope, settings, and estimate before any provider call."},
        "scope": {"arms": list(ARMS), "families": list(TASK_FAMILIES), "hard_variants": 3, "guard_variants": 1, "motif_repetitions": 3, "providers": list(PROVIDERS)},
        "expected_calls": {**{provider: calls for provider in PROVIDERS}, "total": calls * len(PROVIDERS)},
        "models": MODELS,
        "settings": protocol["settings"],
        "cost_estimate": {"providers": estimates, "total_usd": round(sum(value["estimated_cost_usd"] for value in estimates.values()), 6), "basis": EMPIRICAL_COST_BASIS},
        "protocol_sha256": protocol["sha256"],
    }
    value["sha256"] = digest(value)
    return value


def deterministic_package() -> dict[str, Any]:
    value = {"schema": SCHEMA, "run_kind": "deterministic", "screen": deterministic_screen(), "protocol": protocol_manifest(), "run_plan": run_plan()}
    value["sha256"] = digest(value)
    return value


def deterministic_manifest(value: dict[str, Any]) -> dict[str, Any]:
    return {"schema": value["schema"], "sha256": value["sha256"], "screen_sha256": value["screen"]["sha256"], "protocol_sha256": value["protocol"]["sha256"], "corpus_sha256": value["screen"]["corpus"]["sha256"], "run_plan_sha256": value["run_plan"]["sha256"]}


def self_test() -> dict[str, Any]:
    screen = deterministic_screen()
    jobs = development_jobs()
    assert screen["all_checks_pass"]
    assert len(jobs) == 108
    assert all(sum(job["arm"] == arm for job in jobs) == 18 for arm in ARMS)
    assert all(sum(job["family"] == family and job["arm"] == arm for job in jobs) == 3 for family in HARD_FAMILIES for arm in ARMS)
    assert all(sum(job["sentinel"] and job["arm"] == arm for job in jobs) == 3 for arm in ARMS)
    assert run_plan()["expected_calls"]["total"] == 324
    synthetic_results = []
    for job in jobs:
        payload = perfect_payload(job["arm"], job["task"])
        synthetic_results.append({
            "arm": job["arm"],
            "family": job["family"],
            "variant": job["variant"],
            "repeat": job["repeat"],
            "sentinel": job["sentinel"],
            "response_payload_bytes": len(payload.encode()),
            "returned_model": "synthetic",
            "usage": {"input_tokens": 100, "cached_input_tokens": 0, "output_tokens": 50, "thinking_tokens": 0},
            "validation": score_response(job["arm"], job["task"], payload),
        })
    synthetic_runs = [{"provider": provider, "requested_model": MODELS[provider], "protocol_sha256": protocol_manifest()["sha256"], "results": deepcopy(synthetic_results), "actual_cost_usd": 0, "complete": True} for provider in PROVIDERS]
    synthetic_summary = summarize_runs(synthetic_runs)
    assert all(row["paired_denominator"] == 18 for row in synthetic_summary["candidate_comparisons"])
    assert all(failure["numerator"] == 0 for provider in synthetic_summary["providers"] for failure in provider["composite_failures"])
    assert all({failure["class"]: failure["eligible_denominator"] for failure in provider["composite_failures"]} == {"explicit-score-ledger-disagreement": 17, "missing-or-invalid-side-ledger": 17, "native-score-parse-failure": 17, "other-output-or-patch-parse-failure": 108} for provider in synthetic_summary["providers"])
    return {"schema": SCHEMA, "passed": len(screen["round_trips"]) + len(screen["perfect_response_checks"]) + len(screen["renderer_parity"]) + len(screen["composite_failure_controls"]) + 10, "corpus_sha256": screen["corpus"]["sha256"], "deterministic_sha256": deterministic_package()["sha256"]}


def load_env(path: Path) -> dict[str, str]:
    result = dict(os.environ)
    if not path.exists():
        return result
    for line in path.read_text().splitlines():
        if line.strip() and not line.lstrip().startswith("#") and "=" in line:
            name, value = line.split("=", 1)
            result.setdefault(name.strip(), value.strip().strip("'\""))
    return result


def post_json(url: str, headers: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
    request = urllib.request.Request(url, data=canonical(payload).encode(), method="POST", headers={"Content-Type": "application/json", **headers})
    with urllib.request.urlopen(request, timeout=240) as response:
        return json.load(response)


def parse_outer(text: str) -> dict[str, Any]:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        if stripped.startswith("json"):
            stripped = stripped[4:]
    start, end = stripped.find("{"), stripped.rfind("}")
    if start < 0 or end < start:
        return {"payload": stripped, "outer_schema_valid": False}
    try:
        value = json.loads(stripped[start : end + 1])
    except json.JSONDecodeError:
        return {"payload": stripped, "outer_schema_valid": False}
    valid = isinstance(value, dict) and set(value) == {"payload"} and isinstance(value.get("payload"), str)
    return {"payload": value.get("payload", stripped) if isinstance(value, dict) else stripped, "outer_schema_valid": valid}


def model_call(provider: str, key: str, prompt: str) -> tuple[dict[str, Any], dict[str, Any]]:
    messages = [{"role": "user", "content": prompt}]
    if provider == "openai":
        raw = post_json("https://api.openai.com/v1/chat/completions", {"Authorization": f"Bearer {key}"}, {"model": OPENAI_MODEL, "messages": messages, "response_format": {"type": "json_schema", "json_schema": {"name": "benchmark_payload", "strict": True, "schema": OUTER_SCHEMA}}, "reasoning_effort": "low", "max_completion_tokens": 3000})
        text = raw["choices"][0]["message"]["content"]
    elif provider == "gemini":
        raw = post_json(f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent", {"x-goog-api-key": key}, {"contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": {"responseMimeType": "application/json", "responseJsonSchema": OUTER_SCHEMA, "maxOutputTokens": 3000, "thinkingConfig": {"thinkingLevel": "low"}}})
        text = "".join(part.get("text", "") for part in raw["candidates"][0]["content"]["parts"])
    else:
        raw = post_json("https://api.anthropic.com/v1/messages", {"x-api-key": key, "anthropic-version": "2023-06-01"}, {"model": CLAUDE_MODEL, "max_tokens": 3000, "messages": messages, "output_config": {"effort": "low", "format": {"type": "json_schema", "schema": OUTER_SCHEMA}}})
        text = "".join(block.get("text", "") for block in raw["content"] if block.get("type") == "text")
    return parse_outer(text), raw


def usage(provider: str, raw: dict[str, Any]) -> dict[str, int]:
    if provider == "openai":
        value = raw.get("usage", {})
        return {"input_tokens": value.get("prompt_tokens", 0), "cached_input_tokens": value.get("prompt_tokens_details", {}).get("cached_tokens", 0), "output_tokens": value.get("completion_tokens", 0), "thinking_tokens": value.get("completion_tokens_details", {}).get("reasoning_tokens", 0)}
    if provider == "gemini":
        value = raw.get("usageMetadata", {})
        return {"input_tokens": value.get("promptTokenCount", 0), "cached_input_tokens": value.get("cachedContentTokenCount", 0), "output_tokens": value.get("candidatesTokenCount", 0) + value.get("thoughtsTokenCount", 0), "thinking_tokens": value.get("thoughtsTokenCount", 0)}
    value = raw.get("usage", {})
    return {"input_tokens": value.get("input_tokens", 0) + value.get("cache_creation_input_tokens", 0) + value.get("cache_read_input_tokens", 0), "cached_input_tokens": value.get("cache_read_input_tokens", 0), "output_tokens": value.get("output_tokens", 0), "thinking_tokens": value.get("output_tokens_details", {}).get("thinking_tokens", 0)}


def cost_usd(provider: str, measured: dict[str, int]) -> dict[str, float]:
    rates = PRICES[provider]
    cached = measured["cached_input_tokens"]
    parts = {"uncached_input": max(0, measured["input_tokens"] - cached) * rates["input"] / 1_000_000, "cached_input": cached * rates["cached_input"] / 1_000_000, "output": measured["output_tokens"] * rates["output"] / 1_000_000}
    parts["total"] = sum(parts.values())
    return {name: round(value, 8) for name, value in parts.items()}


def returned_model(provider: str, raw: dict[str, Any]) -> str | None:
    return raw.get("modelVersion") if provider == "gemini" else raw.get("model")


def stop_reason(provider: str, raw: dict[str, Any]) -> str | None:
    if provider == "openai":
        return raw.get("choices", [{}])[0].get("finish_reason")
    if provider == "gemini":
        return raw.get("candidates", [{}])[0].get("finishReason")
    return raw.get("stop_reason")


def call_with_retry(provider: str, key: str, prompt: str) -> tuple[dict[str, Any], dict[str, Any], float, int]:
    retries = 0
    started = time.perf_counter()
    for delay in (0, 2, 4, 8):
        if delay:
            time.sleep(delay)
        try:
            outer, raw = model_call(provider, key, prompt)
            return outer, raw, (time.perf_counter() - started) * 1000, retries
        except urllib.error.HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504} or retries == 3:
                raise
            retries += 1
        except (TimeoutError, urllib.error.URLError):
            if retries == 3:
                raise
            retries += 1
    raise AssertionError("Retry loop did not return or raise")


def call_job(provider: str, key: str, job: dict[str, Any]) -> dict[str, Any]:
    prompt = prompt_for(job["arm"], job["task"])
    common = {"arm": job["arm"], "family": job["family"], "variant": job["variant"], "repeat": job["repeat"], "sentinel": job["sentinel"], "task_sha256": job["task"]["sha256"], "prompt_sha256": sha256_text(prompt), "prompt_bytes": len(prompt.encode())}
    try:
        outer, raw, latency_ms, retries = call_with_retry(provider, key, prompt)
        measured = usage(provider, raw)
        payload = outer["payload"]
        return {**common, "response_payload": payload, "response_payload_bytes": len(payload.encode()), "response_payload_sha256": sha256_text(payload), "outer_schema_valid": outer["outer_schema_valid"], "validation": score_response(job["arm"], job["task"], payload), "usage": measured, "cost_usd": cost_usd(provider, measured), "latency_ms": round(latency_ms, 3), "retries": retries, "returned_model": returned_model(provider, raw), "request_id": raw.get("id"), "stop_reason": stop_reason(provider, raw), "raw_response_sha256": digest(raw)}
    except Exception as error:
        return {**common, "transport_error": f"{type(error).__name__}: {error}", "validation": {"syntax_pass": False, "musical_pass": False, "checks": {}, "failure_class": None, "failure_eligibility": {name: False for name in FAILURE_CLASSES}}, "usage": {"input_tokens": 0, "cached_input_tokens": 0, "output_tokens": 0, "thinking_tokens": 0}, "cost_usd": {"uncached_input": 0, "cached_input": 0, "output": 0, "total": 0}, "retries": 3}


def execute_jobs(provider: str, key: str, jobs: list[dict[str, Any]], workers: int) -> list[dict[str, Any]]:
    ordered = list(jobs)
    random.Random(SEED).shuffle(ordered)
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(call_job, provider, key, job) for job in ordered]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            results.append(future.result())
            if index % 18 == 0:
                print(f"{provider}: completed {index}/{len(futures)} calls", file=sys.stderr, flush=True)
    return sorted(results, key=lambda value: (value["arm"], value["family"], value["variant"], value["repeat"]))


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    if value.get("run_id") != RUN_ID or value.get("protocol_sha256") != plan["protocol_sha256"] or value.get("run_plan_sha256") != plan["sha256"]:
        raise ValueError("Approval does not match the frozen run plan")
    if value.get("status") != "approved" or not value.get("operator_statement"):
        raise ValueError("Approval must record an explicit operator statement")
    return value


def run_provider(provider: str, env_file: Path, approval_file: Path, workers: int) -> dict[str, Any]:
    approval = validate_approval(approval_file)
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise ValueError("Deterministic screen failed")
    environment = load_env(env_file)
    key = environment.get(KEYS[provider])
    if not key:
        raise ValueError(f"{KEYS[provider]} is missing")
    results = execute_jobs(provider, key, development_jobs(), workers)
    value = {
        "schema": SCHEMA,
        "run_kind": "initial-six-arm-provider",
        "run_id": RUN_ID,
        "provider": provider,
        "requested_model": MODELS[provider],
        "client": "Python urllib.request direct HTTPS",
        "settings": protocol_manifest()["settings"][provider],
        "approval": approval,
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "python": platform.python_version(),
        "privacy": protocol_manifest()["privacy"],
        "protocol_sha256": protocol_manifest()["sha256"],
        "screen_sha256": screen["sha256"],
        "results": results,
        "repairs": [],
        "actual_cost_usd": round(sum(row["cost_usd"]["total"] for row in results), 6),
        "complete": len(results) == 108 and all("transport_error" not in row for row in results),
    }
    value["raw_run_sha256"] = digest([row.get("raw_response_sha256") for row in results])
    value["manifest_sha256"] = digest(value)
    return value


def rate(rows: list[dict[str, Any]]) -> float:
    return sum(row["validation"]["musical_pass"] for row in rows) / len(rows) if rows else 0.0


def summarize_runs(runs: list[dict[str, Any]]) -> dict[str, Any]:
    if {run["provider"] for run in runs} != set(PROVIDERS):
        raise ValueError("Summary needs one run from each provider")
    protocol_sha = protocol_manifest()["sha256"]
    if any(run["protocol_sha256"] != protocol_sha for run in runs):
        raise ValueError("Provider runs do not match this protocol")
    provider_rows = []
    for run in runs:
        arm_rows = []
        for arm in ARMS:
            rows = [row for row in run["results"] if row["arm"] == arm]
            family_rows = []
            for family in TASK_FAMILIES:
                selected = [row for row in rows if row["family"] == family]
                family_rows.append({"family": family, "successes": sum(row["validation"]["musical_pass"] for row in selected), "trials": len(selected), "rate": round(rate(selected), 6)})
            hard = [row for row in rows if row["family"] in HARD_FAMILIES]
            guards = [row for row in rows if row["family"] in GUARD_FAMILIES]
            sentinel = [row["validation"]["musical_pass"] for row in rows if row["sentinel"]]
            arm_rows.append({"arm": arm, "capabilities": capability_manifest()[arm], "hard_macro": round(sum(rate([row for row in hard if row["family"] == family]) for family in HARD_FAMILIES) / len(HARD_FAMILIES), 6), "guard_macro": round(sum(rate([row for row in guards if row["family"] == family]) for family in GUARD_FAMILIES) / len(GUARD_FAMILIES), 6), "sentinel_outcomes": sentinel, "sentinel_varied": len(set(sentinel)) > 1, "input_tokens": sum(row["usage"]["input_tokens"] for row in rows), "output_tokens": sum(row["usage"]["output_tokens"] for row in rows), "output_bytes": sum(row.get("response_payload_bytes", 0) for row in rows), "families": family_rows})
        failures = []
        for failure_class in FAILURE_CLASSES:
            eligible = [row for row in run["results"] if row["validation"].get("failure_eligibility", {}).get(failure_class)]
            failures.append({"class": failure_class, "numerator": sum(row["validation"].get("failure_class") == failure_class for row in eligible), "eligible_denominator": len(eligible)})
        provider_rows.append({"provider": run["provider"], "requested_model": run["requested_model"], "returned_models": sorted({row.get("returned_model") for row in run["results"] if row.get("returned_model")}), "arms": arm_rows, "composite_failures": failures, "actual_cost_usd": run["actual_cost_usd"], "complete": run["complete"]})
    comparisons = []
    for provider in provider_rows:
        by_arm = {row["arm"]: row for row in provider["arms"]}
        baseline = by_arm["compact-bar-v1"]
        exact = by_arm["exact-json"]
        for arm in ("label-only-compact", "full-v0-style-compact"):
            candidate = by_arm[arm]
            raw_run = next(run for run in runs if run["provider"] == provider["provider"])
            candidate_map = {(row["family"], row["variant"], row["repeat"]): row for row in raw_run["results"] if row["arm"] == arm}
            baseline_map = {(row["family"], row["variant"], row["repeat"]): row for row in raw_run["results"] if row["arm"] == "compact-bar-v1"}
            paired_keys = sorted(candidate_map.keys() & baseline_map.keys())
            paired = [(candidate_map[key]["validation"]["musical_pass"], baseline_map[key]["validation"]["musical_pass"], key) for key in paired_keys]
            candidate_only_losses = defaultdict(int)
            for candidate_pass, baseline_pass, key in paired:
                if baseline_pass and not candidate_pass:
                    candidate_only_losses[key[0]] += 1
            comparisons.append({
                "provider": provider["provider"],
                "candidate": arm,
                "paired_denominator": len(paired),
                "candidate_only_wins": sum(candidate_pass and not baseline_pass for candidate_pass, baseline_pass, _ in paired),
                "candidate_only_losses": sum(baseline_pass and not candidate_pass for candidate_pass, baseline_pass, _ in paired),
                "both_pass": sum(candidate_pass and baseline_pass for candidate_pass, baseline_pass, _ in paired),
                "both_fail": sum(not candidate_pass and not baseline_pass for candidate_pass, baseline_pass, _ in paired),
                "candidate_only_losses_by_family": dict(sorted(candidate_only_losses.items())),
                "hard_macro_delta": round(candidate["hard_macro"] - baseline["hard_macro"], 6),
                "guard_macro_delta": round(candidate["guard_macro"] - baseline["guard_macro"], 6),
                "input_token_ratio_to_exact": round(candidate["input_tokens"] / exact["input_tokens"], 6) if exact["input_tokens"] else None,
                "output_byte_ratio_to_exact": round(candidate["output_bytes"] / exact["output_bytes"], 6) if exact["output_bytes"] else None,
            })
    decision = "incomplete" if not all(provider["complete"] for provider in provider_rows) else "classify-before-iteration"
    value = {"schema": SCHEMA, "run_kind": "initial-six-arm-summary", "run_id": RUN_ID, "decision": decision, "development_gate": DEVELOPMENT_GATE, "providers": provider_rows, "candidate_comparisons": comparisons, "actual_cost_usd": {**{run["provider"]: run["actual_cost_usd"] for run in runs}, "total": round(sum(run["actual_cost_usd"] for run in runs), 6)}, "repairs": [], "protocol_sha256": protocol_sha}
    value["sha256"] = digest(value)
    return value


def summarize(paths: list[Path]) -> dict[str, Any]:
    return summarize_runs([json.loads(path.read_text()) for path in paths])


def write_result(value: dict[str, Any], output: Path | None) -> None:
    rendered = json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered)
    else:
        print(rendered, end="")


def main() -> None:
    parser = argparse.ArgumentParser()
    actions = parser.add_mutually_exclusive_group(required=True)
    actions.add_argument("--self-test", action="store_true")
    actions.add_argument("--deterministic", action="store_true")
    actions.add_argument("--check", type=Path)
    actions.add_argument("--run-plan", action="store_true")
    actions.add_argument("--provider", choices=PROVIDERS)
    actions.add_argument("--summarize", nargs=3, type=Path)
    parser.add_argument("--env-file", type=Path, default=Path("../.env"))
    parser.add_argument("--approval-file", type=Path)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.self_test:
        value = self_test()
    elif args.deterministic:
        value = deterministic_package()
    elif args.check:
        expected = json.loads(args.check.read_text())
        actual = deterministic_package()
        if deterministic_manifest(actual) != expected:
            print(canonical({"expected_sha256": expected.get("sha256"), "actual_sha256": actual.get("sha256")}), file=sys.stderr)
            raise SystemExit(1)
        value = {"schema": SCHEMA, "check": "pass", "sha256": actual["sha256"]}
    elif args.run_plan:
        value = run_plan()
    elif args.provider:
        if not args.approval_file:
            parser.error("--provider requires --approval-file")
        value = run_provider(args.provider, args.env_file, args.approval_file, args.workers)
    else:
        value = summarize(args.summarize)
    write_result(value, args.output)


if __name__ == "__main__":
    main()
