#!/usr/bin/env python3
"""Render and parse the frozen symbolic-format v1 benchmark profiles."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from copy import deepcopy
from fractions import Fraction
from typing import Any

from corpus import canonical, fraction, fraction_text, sort_notes


ARMS = (
    "exact-json",
    "compact-bar",
    "abc-2.1-native",
    "abc-2.1-composite",
    "alda-native",
    "alda-composite",
    "midi-like-native",
    "midi-like-composite",
    "remi-plus-native",
    "remi-plus-composite",
    "octuple-midi-native",
    "octuple-midi-composite",
    "one-cycle-mini",
)
NATIVE_ARMS = tuple(value for value in ARMS if value.endswith("-native")) + ("one-cycle-mini",)
COMPOSITE_ARMS = tuple(value for value in ARMS if value.endswith("-composite"))
IDENTITY_ARMS = ("exact-json", "compact-bar", *COMPOSITE_ARMS)
PAIR_FAMILIES = ("abc-2.1", "alda", "midi-like", "remi-plus", "octuple-midi")
FIELDS = ("id", "voice", "start", "duration", "pitch", "velocity")
MUSICAL_FIELDS = ("voice", "start", "duration", "pitch")
VELOCITY_ARMS = (
    "exact-json",
    "compact-bar",
    "midi-like-native",
    "midi-like-composite",
    "remi-plus-native",
    "remi-plus-composite",
    "octuple-midi-native",
    "octuple-midi-composite",
)


def eligibility_manifest() -> dict[str, Any]:
    profiles: dict[str, dict[str, Any]] = {}
    for arm in ARMS:
        native = arm in NATIVE_ARMS
        composite = arm in COMPOSITE_ARMS
        profiles[arm] = {
            "condition": "native" if native else "composite" if composite else "control",
            "represented_fields": list(MUSICAL_FIELDS) + (["velocity"] if arm in VELOCITY_ARMS else []) + (["id"] if arm in IDENTITY_ARMS else []),
            "timing_resolution": "exact rational, denominators that divide 12 beats" if "abc" in arm or "alda" in arm else "exact rational",
            "native_defaults_and_loss": (
                ["velocity defaults to 84", "no stable note identity"]
                if native
                else []
            ),
            "output_mode": "sparse local patch; full score otherwise" if arm in IDENTITY_ARMS else "full replacement",
            "identity_scored": arm in IDENTITY_ARMS,
            "preservation_scored": arm in IDENTITY_ARMS,
            "parser_assumption": "Frozen local subset parser. It is not a general external-format conformance claim.",
            "eligible_tasks": [
                "comprehension-structure",
                "comprehension-analysis",
                "generation-progression",
                "generation-melody",
                "continuation-motif",
                "continuation-roles",
                "transformation-local",
                "transformation-revoice",
                "transformation-rhythm",
            ],
        }
    profiles["one-cycle-mini"].update(
        {
            "timing_resolution": "exact rational inside one declared 12-beat cycle",
            "native_defaults_and_loss": ["velocity defaults to 84", "no stable finite note identity", "no cross-cycle state"],
            "eligible_tasks": [
                "comprehension-structure",
                "generation-melody",
                "continuation-motif",
                "transformation-rhythm",
            ],
            "parser_assumption": "Frozen cycle(length){pitch@start:duration/voice} subset. No probability, alternation, or hidden unrolling.",
        }
    )
    return {
        "profiles": profiles,
        "pairs": {family: [f"{family}-native", f"{family}-composite"] for family in PAIR_FAMILIES},
    }


def is_eligible(arm: str, family: str) -> bool:
    return family in eligibility_manifest()["profiles"][arm]["eligible_tasks"]


ABC_NAMES = ("C", "^C", "D", "_E", "E", "F", "^F", "G", "_A", "A", "_B", "B")
ALDA_NAMES = ("c", "c+", "d", "e-", "e", "f", "f+", "g", "a-", "a", "b-", "b")


def abc_pitch(pitch: int) -> str:
    octave = pitch // 12 - 1
    name = ABC_NAMES[pitch % 12]
    if octave >= 5:
        return name.replace(name[-1], name[-1].lower()) + "'" * (octave - 5)
    if octave <= 3:
        return name + "," * (4 - octave)
    return name


def parse_abc_pitch(value: str) -> int:
    accidental = 1 if value.startswith("^") else -1 if value.startswith("_") else 0
    core = value.lstrip("^_=")
    letter = core[0]
    natural = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[letter.upper()]
    octave = 5 if letter.islower() else 4
    octave += core.count("'") - core.count(",")
    return (octave + 1) * 12 + natural + accidental


def grouped_events(notes: list[dict[str, Any]]) -> dict[str, list[tuple[Fraction, Fraction, list[dict[str, Any]]]]]:
    groups: dict[str, dict[tuple[Fraction, Fraction], list[dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))
    for value in notes:
        groups[value["voice"]][(fraction(value["start"]), fraction(value["duration"]))].append(value)
    return {
        voice: [(start, duration, sorted(values, key=lambda item: item["pitch"])) for (start, duration), values in sorted(rows.items())]
        for voice, rows in groups.items()
    }


def render_abc(notes: list[dict[str, Any]], metadata: dict[str, Any]) -> str:
    lines = ["%abc-2.1", "X:1", "T:Ghostnote generated benchmark", "L:1/48", f"M:{metadata.get('meter', ['4/4'])[0]}", "K:C"]
    for lane_name, values in voice_lanes(notes):
        cursor = Fraction(0)
        tokens = []
        for value in values:
            start = fraction(value["start"])
            duration = fraction(value["duration"])
            if start > cursor:
                tokens.append(f"z{int((start - cursor) * 12)}")
            tokens.append(f"{abc_pitch(value['pitch'])}{int(duration * 12)}")
            cursor = max(cursor, start + duration)
        lines.append(f"V:{lane_name}")
        lines.append(" ".join(tokens) + " |")
    return "\n".join(lines)


def parse_abc(text: str) -> list[dict[str, Any]]:
    voice = ""
    result: list[dict[str, Any]] = []
    cursor = Fraction(0)
    unit_beats = Fraction(1, 12)
    indexes: dict[str, int] = defaultdict(int)
    token_pattern = re.compile(r"(z|x|\[[^]]+\]|[_=^]?[A-Ga-g][,']*)(\d+(?:/\d+)?)?$")
    pitch_pattern = re.compile(r"[_=^]?[A-Ga-g][,']*")
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("L:"):
            unit_beats = fraction(stripped[2:].strip()) * 4
            continue
        if stripped.startswith("V:"):
            voice = stripped[2:].strip().split()[0].rsplit(".", 1)[0]
            cursor = Fraction(0)
            continue
        if not voice or not stripped or stripped.startswith(("%", "X:", "T:", "L:", "M:", "K:")):
            continue
        inline = re.match(r"^\[V:([^]]+)\]\s*(.*)$", stripped)
        if inline:
            voice = inline[1].strip().split()[0].rsplit(".", 1)[0]
            cursor = Fraction(0)
            stripped = inline[2]
        stripped = re.sub(r'"[^"]*"', "", stripped)
        for token in stripped.split():
            if token in {"|", "|]", "[|", ":|", "|:"}:
                continue
            inline_token = re.match(r"^\[V:([^]]+)\](.*)$", token)
            if inline_token:
                voice = inline_token[1].strip().split()[0].rsplit(".", 1)[0]
                cursor = Fraction(0)
                token = inline_token[2]
                if not token:
                    continue
            match = token_pattern.fullmatch(token)
            if not match:
                raise ValueError(f"Invalid ABC token: {token}")
            multiplier = fraction(match[2]) if match[2] else Fraction(1)
            duration = unit_beats * multiplier
            if match[1] in {"z", "x"}:
                cursor += duration
                continue
            pitches = pitch_pattern.findall(match[1].strip("[]"))
            for pitch in pitches:
                indexes[voice] += 1
                result.append(
                    {
                        "id": f"native-{voice}-{indexes[voice]}",
                        "voice": voice,
                        "start": fraction_text(cursor),
                        "duration": fraction_text(duration),
                        "pitch": parse_abc_pitch(pitch),
                        "velocity": 84,
                    }
                )
            cursor += duration
    if not result:
        raise ValueError("ABC payload has no notes")
    return sort_notes(result)


ALDA_DURATIONS = (
    (Fraction(4), "1"),
    (Fraction(2), "2"),
    (Fraction(1), "4"),
    (Fraction(2, 3), "6"),
    (Fraction(1, 2), "8"),
    (Fraction(1, 3), "12"),
    (Fraction(1, 4), "16"),
    (Fraction(1, 6), "24"),
    (Fraction(1, 12), "48"),
)


def duration_parts(value: Fraction) -> list[str]:
    result = []
    remaining = value
    for beats, token in ALDA_DURATIONS:
        while remaining >= beats:
            result.append(token)
            remaining -= beats
    if remaining:
        raise ValueError(f"Alda subset cannot represent {value}")
    return result


def voice_lanes(notes: list[dict[str, Any]]) -> list[tuple[str, list[dict[str, Any]]]]:
    by_voice: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for value in sort_notes(notes):
        by_voice[value["voice"]].append(value)
    result = []
    for voice, values in by_voice.items():
        lanes: list[list[dict[str, Any]]] = []
        for value in values:
            for lane in lanes:
                previous = lane[-1]
                if fraction(previous["start"]) + fraction(previous["duration"]) <= fraction(value["start"]):
                    lane.append(value)
                    break
            else:
                lanes.append([value])
        result.extend((f"{voice}.{index}", lane) for index, lane in enumerate(lanes, start=1))
    return result


def render_alda(notes: list[dict[str, Any]]) -> str:
    lines = ["# Ghostnote generated benchmark"]
    for lane_name, values in voice_lanes(notes):
        tokens = []
        cursor = Fraction(0)
        for value in values:
            start = fraction(value["start"])
            for part in duration_parts(start - cursor):
                tokens.append(f"r{part}")
            octave = value["pitch"] // 12 - 1
            name = ALDA_NAMES[value["pitch"] % 12]
            parts = duration_parts(fraction(value["duration"]))
            tokens.append(f"o{octave}")
            tokens.append("~".join(f"{name}{part}" for part in parts))
            cursor = start + fraction(value["duration"])
        lines.append(f'piano "{lane_name}": ' + " ".join(tokens))
    return "\n".join(lines)


def parse_alda(text: str) -> list[dict[str, Any]]:
    pattern = re.compile(r'^piano "([^"]+)":\s*(.*)$')
    pitch_pattern = re.compile(r"([a-g](?:[+-])?)(\d+)$")
    result = []
    for line in text.splitlines():
        match = pattern.match(line.strip())
        if not match:
            continue
        lane = match[1]
        voice = lane.rsplit(".", 1)[0]
        cursor = Fraction(0)
        octave = 4
        index = 0
        for token in match[2].split():
            if token.startswith("o") and token[1:].isdigit():
                octave = int(token[1:])
            elif token.startswith("r"):
                cursor += Fraction(4, int(token[1:]))
            else:
                pieces = token.split("~")
                parsed = [pitch_pattern.fullmatch(piece) for piece in pieces]
                if not all(parsed):
                    raise ValueError(f"Invalid Alda token: {token}")
                names = [item[1] for item in parsed if item]
                if len(set(names)) != 1:
                    raise ValueError("Alda tie changes pitch")
                duration = sum((Fraction(4, int(item[2])) for item in parsed if item), Fraction(0))
                pitch_class = ALDA_NAMES.index(names[0])
                index += 1
                result.append(
                    {
                        "id": f"native-{voice}-{index}",
                        "voice": voice,
                        "start": fraction_text(cursor),
                        "duration": fraction_text(duration),
                        "pitch": (octave + 1) * 12 + pitch_class,
                        "velocity": 84,
                    }
                )
                cursor += duration
    if not result:
        raise ValueError("Alda payload has no notes")
    return sort_notes(result)


def render_midi_like(notes: list[dict[str, Any]], include_ids: bool) -> str:
    lines = []
    for value in sort_notes(notes):
        identity = f" ID_{value['id']}" if include_ids else ""
        lines.append(
            f"TRACK_{value['voice']} TIME_{value['start']} NOTE_ON_{value['pitch']} "
            f"DURATION_{value['duration']} VELOCITY_{value['velocity']}{identity}"
        )
    return "\n".join(lines)


def parse_midi_like(text: str) -> list[dict[str, Any]]:
    pattern = re.compile(r"^TRACK_(\S+) TIME_(\S+) NOTE_ON_(\d+) DURATION_(\S+) VELOCITY_(\d+)(?: ID_(\S+))?$")
    result = []
    for index, line in enumerate(text.splitlines(), start=1):
        if match := pattern.match(line.strip()):
            result.append({"id": match[6] or f"native-{index}", "voice": match[1], "start": fraction_text(match[2]), "duration": fraction_text(match[4]), "pitch": int(match[3]), "velocity": int(match[5])})
    if not result:
        raise ValueError("MIDI-Like payload has no notes")
    return sort_notes(result)


def render_remi(notes: list[dict[str, Any]], include_ids: bool) -> str:
    lines = []
    for value in sort_notes(notes):
        identity = f" <ID={value['id']}>" if include_ids else ""
        lines.append(
            f"<Bar={int(fraction(value['start']) // 4) + 1}> <Position={fraction_text(fraction(value['start']) % 4)}> "
            f"<Track={value['voice']}> <Pitch={value['pitch']}> <Duration={value['duration']}> "
            f"<Velocity={value['velocity']}>{identity}"
        )
    return "\n".join(lines)


def parse_remi(text: str) -> list[dict[str, Any]]:
    pattern = re.compile(r"^<Bar=(\d+)> <Position=([^>]+)> <Track=([^>]+)> <Pitch=(\d+)> <Duration=([^>]+)> <Velocity=(\d+)>(?: <ID=([^>]+)>)?$")
    result = []
    for index, line in enumerate(text.splitlines(), start=1):
        if match := pattern.match(line.strip()):
            start = Fraction((int(match[1]) - 1) * 4) + fraction(match[2])
            result.append({"id": match[7] or f"native-{index}", "voice": match[3], "start": fraction_text(start), "duration": fraction_text(match[5]), "pitch": int(match[4]), "velocity": int(match[6])})
    if not result:
        raise ValueError("REMI+ payload has no notes")
    return sort_notes(result)


def render_octuple(notes: list[dict[str, Any]], include_ids: bool) -> str:
    lines = []
    for value in sort_notes(notes):
        fields = [str(int(fraction(value["start"]) // 4) + 1), fraction_text(fraction(value["start"]) % 4), value["voice"], str(value["pitch"]), value["duration"], str(value["velocity"]), "4/4", "120"]
        if include_ids:
            fields.append(value["id"])
        lines.append("(" + ",".join(fields) + ")")
    return "\n".join(lines)


def parse_octuple(text: str) -> list[dict[str, Any]]:
    result = []
    for index, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if not stripped.startswith("(") or not stripped.endswith(")"):
            continue
        fields = stripped[1:-1].split(",")
        if len(fields) not in {8, 9}:
            raise ValueError("OctupleMIDI row needs eight or nine fields")
        start = Fraction((int(fields[0]) - 1) * 4) + fraction(fields[1])
        result.append({"id": fields[8] if len(fields) == 9 else f"native-{index}", "voice": fields[2], "start": fraction_text(start), "duration": fraction_text(fields[4]), "pitch": int(fields[3]), "velocity": int(fields[5])})
    if not result:
        raise ValueError("OctupleMIDI payload has no notes")
    return sort_notes(result)


def render_mini(notes: list[dict[str, Any]]) -> str:
    end = max((fraction(value["start"]) + fraction(value["duration"]) for value in notes), default=Fraction(1))
    cycle = max(12, int(end) + (1 if end.denominator != 1 else 0))
    events = ",".join(f"{value['pitch']}@{value['start']}~{value['duration']}~{value['voice']}" for value in sort_notes(notes))
    return f"cycle({cycle}){{{events}}}"


def parse_mini(text: str) -> list[dict[str, Any]]:
    match = re.fullmatch(r"cycle\((\d+)\)\{(.*)\}", text.strip(), re.DOTALL)
    if not match:
        raise ValueError("Invalid one-cycle mini-notation")
    cycle = fraction(match[1])
    result = []
    pattern = re.compile(r"(\d+)@([^~]+)~([^~]+)~([^,}]+)")
    for index, token in enumerate(filter(None, (value.strip() for value in match[2].split(","))), start=1):
        event = pattern.fullmatch(token)
        if not event:
            raise ValueError(f"Invalid mini event: {token}")
        start, duration = fraction(event[2]), fraction(event[3])
        if start < 0 or start + duration > cycle:
            raise ValueError("Mini event exceeds its declared cycle")
        result.append({"id": f"native-{index}", "voice": event[4], "start": fraction_text(start), "duration": fraction_text(duration), "pitch": int(event[1]), "velocity": 84})
    if not result:
        raise ValueError("Mini payload has no notes")
    return sort_notes(result)


def ledger_text(notes: list[dict[str, Any]]) -> str:
    return "\n".join(
        f"GN {value['id']} {value['voice']} {value['start']} {value['duration']} {value['pitch']} {value['velocity']}"
        for value in sort_notes(notes)
    )


def parse_ledger(text: str) -> list[dict[str, Any]]:
    result = []
    pattern = re.compile(r"^GN (\S+) (\S+) (\S+) (\S+) (\d+) (\d+)$")
    for line in text.splitlines():
        if match := pattern.match(line.strip()):
            result.append(dict(zip(FIELDS, (match[1], match[2], fraction_text(match[3]), fraction_text(match[4]), int(match[5]), int(match[6])))))
    if not result:
        raise ValueError("Composite payload has no GN ledger")
    ids = [value["id"] for value in result]
    if len(set(ids)) != len(ids):
        raise ValueError("Composite ledger has duplicate IDs")
    return sort_notes(result)


def render_events(arm: str, notes: list[dict[str, Any]], metadata: dict[str, Any] | None = None) -> str:
    metadata = metadata or {}
    if arm == "exact-json":
        return canonical({"notes": sort_notes(notes)})
    if arm == "compact-bar":
        return "\n".join(f"N {value['id']} {value['voice']} {value['start']} {value['duration']} {value['pitch']} {value['velocity']}" for value in sort_notes(notes))
    composite = arm in COMPOSITE_ARMS
    base = arm.removesuffix("-composite").removesuffix("-native")
    if base == "abc-2.1":
        score = render_abc(notes, metadata)
    elif base == "alda":
        score = render_alda(notes)
    elif base == "midi-like":
        score = render_midi_like(notes, False)
    elif base == "remi-plus":
        score = render_remi(notes, False)
    elif base == "octuple-midi":
        score = render_octuple(notes, False)
    elif arm == "one-cycle-mini":
        return render_mini(notes)
    else:
        raise ValueError(f"Unknown arm: {arm}")
    return score + ("\n--- GN SIDE LEDGER ---\n" + ledger_text(notes) if composite else "")


def parse_compact(text: str) -> list[dict[str, Any]]:
    pattern = re.compile(r"^N (\S+) (\S+) (\S+) (\S+) (\d+) (\d+)$")
    result = []
    for line in text.splitlines():
        if match := pattern.match(line.strip()):
            result.append(dict(zip(FIELDS, (match[1], match[2], fraction_text(match[3]), fraction_text(match[4]), int(match[5]), int(match[6])))))
    if not result:
        raise ValueError("Compact-bar payload has no notes")
    return sort_notes(result)


def projected(notes: list[dict[str, Any]], fields: tuple[str, ...]) -> list[dict[str, Any]]:
    return [{field: value[field] for field in fields} for value in sort_notes(notes)]


def parse_events(arm: str, text: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    alignment = {"checked": False, "pass": None}
    if arm == "exact-json":
        loaded = json.loads(text)
        notes = loaded["notes"]
    elif arm == "compact-bar":
        notes = parse_compact(text)
    elif arm == "one-cycle-mini":
        notes = parse_mini(text)
    else:
        composite = arm in COMPOSITE_ARMS
        base = arm.removesuffix("-composite").removesuffix("-native")
        score_text = text.split("--- GN SIDE LEDGER ---", 1)[0]
        parser = {
            "abc-2.1": parse_abc,
            "alda": parse_alda,
            "midi-like": parse_midi_like,
            "remi-plus": parse_remi,
            "octuple-midi": parse_octuple,
        }[base]
        score_notes = parser(score_text)
        if composite:
            ledger = parse_ledger(text)
            alignment = {
                "checked": True,
                "pass": projected(score_notes, MUSICAL_FIELDS) == projected(ledger, MUSICAL_FIELDS),
            }
            if not alignment["pass"]:
                raise ValueError("Score and side ledger disagree")
            notes = ledger
        else:
            notes = score_notes
    normalized = []
    for value in notes:
        normalized.append(
            {
                "id": str(value["id"]),
                "voice": str(value["voice"]),
                "start": fraction_text(value["start"]),
                "duration": fraction_text(value["duration"]),
                "pitch": int(value["pitch"]),
                "velocity": int(value.get("velocity", 84)),
            }
        )
    return sort_notes(normalized), alignment


def render_patch(arm: str, base_sha256: str, operations: list[dict[str, Any]]) -> str:
    if arm == "exact-json":
        return canonical({"base_sha256": base_sha256, "ops": operations})
    lines = [f"PATCH {base_sha256}"]
    for operation in operations:
        if operation["op"] == "delete":
            lines.append(f"DELETE {operation['id']}")
        else:
            fields = " ".join(f"{name}={value}" for name, value in operation.items() if name not in {"op", "id"})
            lines.append(f"SET {operation['id']} {fields}")
    return "\n".join(lines)


def parse_patch(arm: str, text: str) -> dict[str, Any]:
    if arm == "exact-json":
        value = json.loads(text)
        return {"base_sha256": value["base_sha256"], "ops": value["ops"]}
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines or not lines[0].startswith("PATCH "):
        raise ValueError("Patch payload needs a PATCH header")
    operations = []
    for line in lines[1:]:
        parts = line.split()
        if parts[0] == "DELETE" and len(parts) == 2:
            operations.append({"op": "delete", "id": parts[1]})
        elif parts[0] == "SET" and len(parts) >= 3:
            operation: dict[str, Any] = {"op": "set", "id": parts[1]}
            for field in parts[2:]:
                name, value = field.split("=", 1)
                operation[name] = int(value) if name in {"pitch", "velocity"} else value
            operations.append(operation)
        else:
            raise ValueError(f"Invalid patch operation: {line}")
    return {"base_sha256": lines[0].split(maxsplit=1)[1], "ops": operations}


def compile_patch(patch: dict[str, Any], source: list[dict[str, Any]], base_sha256: str) -> list[dict[str, Any]]:
    if patch["base_sha256"] != base_sha256:
        raise ValueError("Patch base hash is stale")
    result = deepcopy(source)
    by_id = {value["id"]: value for value in result}
    seen = set()
    for operation in patch["ops"]:
        note_id = operation["id"]
        if note_id in seen:
            raise ValueError("Patch repeats an ID")
        seen.add(note_id)
        if note_id not in by_id:
            raise ValueError("Patch uses an unknown ID")
        if operation["op"] == "delete":
            result.remove(by_id[note_id])
            continue
        if operation["op"] != "set":
            raise ValueError("Patch operation is unsupported")
        for field, value in operation.items():
            if field not in {"op", "id"}:
                if field not in {"start", "duration", "pitch", "velocity", "voice"}:
                    raise ValueError(f"Patch field is unsupported: {field}")
                by_id[note_id][field] = fraction_text(value) if field in {"start", "duration"} else value
    return sort_notes(result)


def output_grammar(arm: str, family: str) -> str:
    if family == "comprehension-analysis":
        return "Return one line: ANALYSIS root_pc=<0-11> bass_pc=<0-11> quality=<text> inversion=<integer> function=<text> motif_relation=<text> rhythm=<text>"
    if family == "transformation-local" and arm in IDENTITY_ARMS:
        if arm == "exact-json":
            return "Return a sparse JSON patch: {\"base_sha256\":\"...\",\"ops\":[{\"op\":\"set\" or \"delete\",\"id\":\"...\",...}]}"
        return "Return a sparse text patch, not JSON: PATCH <base_sha256>, then exactly one SET <id> field=value or DELETE <id>."
    return {
        "exact-json": "Return exact JSON with one notes array. Each note has id, voice, start, duration, pitch, and velocity.",
        "compact-bar": "Return N <id> <voice> <start> <duration> <MIDI pitch> <velocity>, one note per line.",
        "abc-2.1-native": "Return the frozen ABC subset with X, L:1/48, M, K, V lines, rests, notes or chords, and integer unit lengths.",
        "abc-2.1-composite": "Return the ABC subset, then --- GN SIDE LEDGER --- and GN <id> <voice> <start> <duration> <pitch> <velocity> for every score note.",
        "alda-native": "Return Alda parts as piano \"voice.lane\": with rests, o<octave>, pitches, durations, and ties.",
        "alda-composite": "Return the Alda subset, then --- GN SIDE LEDGER --- and exact GN rows for every score note.",
        "midi-like-native": "Return TRACK_<voice> TIME_<start> NOTE_ON_<pitch> DURATION_<duration> VELOCITY_<velocity> rows without IDs.",
        "midi-like-composite": "Return native MIDI-Like rows, then --- GN SIDE LEDGER --- and exact GN rows.",
        "remi-plus-native": "Return <Bar=n> <Position=x> <Track=v> <Pitch=p> <Duration=d> <Velocity=v> rows without IDs.",
        "remi-plus-composite": "Return native REMI+ rows, then --- GN SIDE LEDGER --- and exact GN rows.",
        "octuple-midi-native": "Return (bar,position,track,pitch,duration,velocity,meter,tempo) rows without IDs.",
        "octuple-midi-composite": "Return native OctupleMIDI rows, then --- GN SIDE LEDGER --- and exact GN rows.",
        "one-cycle-mini": "Return cycle(length){pitch@start~duration~voice,...}. Use one bounded cycle only.",
    }[arm]
