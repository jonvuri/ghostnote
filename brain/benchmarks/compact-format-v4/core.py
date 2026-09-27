#!/usr/bin/env python3
"""Define the Phase 8c4 compact-bar formats, tasks, and scorers."""

from __future__ import annotations

import hashlib
import itertools
import json
import re
from collections import defaultdict
from copy import deepcopy
from fractions import Fraction
from typing import Any, Callable


SCHEMA = "ghostnote-compact-format-v4"
CORPUS_SCHEMA = "ghostnote-compact-format-corpus-v4"
ARMS = ("compact-bar-v1", "compact-bar-fields", "exact-object-json")
COMPACT_ARMS = ARMS[:2]
DECISION_FAMILIES = (
    "comprehension-analysis",
    "continuation-motif",
    "generation-progression",
)
GUARD_FAMILIES = (
    "comprehension-structure",
    "continuation-roles",
    "transformation-revoice",
    "transformation-local",
    "transformation-rhythm",
)
TASK_FAMILIES = (*DECISION_FAMILIES, *GUARD_FAMILIES)
VOICE_ORDER = ("bass", "tenor", "alto", "soprano")
FIELDS = ("id", "voice", "start", "duration", "pitch", "velocity")
PATCH_FIELDS = ("voice", "start", "duration", "pitch", "velocity")
OMISSIONS = ("channel", "mute", "release_velocity", "articulation", "expression")
OVERLAY_ORDER = ("bars", "tracks", "regions", "meters", "tempos", "harmonies", "grooves")
COHORT_SPECS = {
    "calibration": {"decision": 5, "guard": 1, "seed": 8401},
    "development": {"decision": 10, "guard": 4, "seed": 8443},
    "holdout": {"decision": 10, "guard": 4, "seed": 8525},
}
ANALYSIS_FIELDS = (
    "chord_id",
    "root_pc",
    "bass_pc",
    "quality",
    "inversion",
    "function",
    "motif_relation",
    "rhythm",
)


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
    **extra: Any,
) -> dict[str, Any]:
    return {
        "id": note_id,
        "voice": voice,
        "start": fraction_text(start),
        "duration": fraction_text(duration),
        "pitch": pitch,
        "velocity": velocity,
        **extra,
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


def require_token(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value or re.fullmatch(r"[A-Za-z0-9_.:-]+", value) is None:
        raise ValueError(f"{label} must be one nonempty token")
    return value


def require_fraction(value: Any, label: str, *, positive: bool = False) -> str:
    if not isinstance(value, (str, int)) or isinstance(value, bool):
        raise ValueError(f"{label} must be a rational string or integer")
    result = fraction(value)
    if result < 0 or (positive and result <= 0):
        raise ValueError(f"{label} is outside its range")
    return fraction_text(result)


def require_int(value: Any, label: str, minimum: int, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise ValueError(f"{label} must be an integer from {minimum} through {maximum}")
    return value


def normalize_note(value: Any, *, allow_extra: bool = False) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("A note must be an object")
    if not allow_extra and set(value) != set(FIELDS):
        raise ValueError("A note has incorrect fields")
    if not set(FIELDS).issubset(value):
        raise ValueError("A note is missing a represented field")
    result = {
        "id": require_token(value["id"], "note.id"),
        "voice": require_token(value["voice"], "note.voice"),
        "start": require_fraction(value["start"], "note.start"),
        "duration": require_fraction(value["duration"], "note.duration", positive=True),
        "pitch": require_int(value["pitch"], "note.pitch", 0, 127),
        "velocity": require_int(value["velocity"], "note.velocity", 1, 127),
    }
    if allow_extra:
        result.update({name: item for name, item in value.items() if name not in FIELDS})
    return result


def normalize_notes(values: Any, *, allow_extra: bool = False) -> list[dict[str, Any]]:
    if not isinstance(values, list) or not values:
        raise ValueError("A document must contain at least one note")
    result = [normalize_note(value, allow_extra=allow_extra) for value in values]
    identities = [value["id"] for value in result]
    if len(identities) != len(set(identities)):
        raise ValueError("A document has duplicate note IDs")
    return sort_notes(result)


def projected(values: list[dict[str, Any]], fields: tuple[str, ...] = FIELDS) -> list[dict[str, Any]]:
    return [{name: value[name] for name in fields} for value in sort_notes(values)]


def event_ids(notes: list[dict[str, Any]]) -> list[str]:
    return [value["id"] for value in sort_notes(notes)]


def empty_overlays() -> dict[str, list[dict[str, Any]]]:
    return {name: [] for name in OVERLAY_ORDER}


def sample_overlays(notes: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    ids = event_ids(notes)
    return {
        "bars": [{"id": "bar-1", "start": "0", "length": "4", "meter": "4/4", "event_ids": ids}],
        "tracks": [{"id": "track-1", "voice": "ensemble", "event_ids": ids}],
        "regions": [{"id": "region-1", "track_id": "track-1", "start": "0", "end": "4", "event_ids": ids}],
        "meters": [{"id": "meter-1", "start": "0", "value": "4/4", "event_ids": ids}],
        "tempos": [{"id": "tempo-1", "start": "0", "bpm": 112, "event_ids": ids}],
        "harmonies": [{"id": "harmony-1", "start": "0", "value": "C", "event_ids": ids}],
        "grooves": [{"id": "groove-1", "amount": "1/12", "event_ids": ids}],
    }


def normalize_overlay_row(kind: str, value: Any, valid_ids: set[str]) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{kind} overlay must be an object")
    fields = {
        "bars": ("id", "start", "length", "meter", "event_ids"),
        "tracks": ("id", "voice", "event_ids"),
        "regions": ("id", "track_id", "start", "end", "event_ids"),
        "meters": ("id", "start", "value", "event_ids"),
        "tempos": ("id", "start", "bpm", "event_ids"),
        "harmonies": ("id", "start", "value", "event_ids"),
        "grooves": ("id", "amount", "event_ids"),
    }[kind]
    if set(value) != set(fields):
        raise ValueError(f"{kind} overlay has incorrect fields")
    row = deepcopy(value)
    for name in fields:
        if name in {"event_ids", "bpm"}:
            continue
        if name in {"start", "length", "end", "amount"}:
            row[name] = require_fraction(row[name], f"{kind}.{name}", positive=name in {"length", "end"})
        elif name == "meter" or (kind == "meters" and name == "value"):
            if not isinstance(row[name], str):
                raise ValueError("A meter must be text")
        else:
            row[name] = require_token(row[name], f"{kind}.{name}")
    if kind in {"bars", "meters"} and re.fullmatch(r"[1-9][0-9]*/[1-9][0-9]*", row["meter" if kind == "bars" else "value"]) is None:
        raise ValueError("A meter must be a positive numerator and denominator")
    if kind == "tempos":
        row["bpm"] = require_int(row["bpm"], "tempos.bpm", 1, 999)
    refs = row["event_ids"]
    if not isinstance(refs, list) or not refs or any(not isinstance(item, str) for item in refs):
        raise ValueError(f"{kind}.event_ids must be a nonempty string list")
    if len(refs) != len(set(refs)) or not set(refs).issubset(valid_ids):
        raise ValueError(f"{kind} overlay has duplicate or unknown event IDs")
    row["event_ids"] = sorted(refs)
    return row


def normalize_overlays(value: Any, notes: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    if not isinstance(value, dict) or set(value) != set(OVERLAY_ORDER):
        raise ValueError("Overlays must contain the seven optional collections")
    valid_ids = set(event_ids(notes))
    result = {}
    for kind in OVERLAY_ORDER:
        rows = value[kind]
        if not isinstance(rows, list):
            raise ValueError(f"{kind} must be a list")
        normalized = [normalize_overlay_row(kind, row, valid_ids) for row in rows]
        result[kind] = sorted(normalized, key=lambda row: (fraction(row.get("start", "0")), row["id"]))
    return result


def make_document(
    notes: list[dict[str, Any]],
    base_sha256: str,
    source_id: str,
    overlays: dict[str, list[dict[str, Any]]] | None = None,
) -> dict[str, Any]:
    normalized = normalize_notes(notes)
    document = {
        "schema": SCHEMA,
        "base_sha256": require_token(base_sha256, "base_sha256"),
        "source_id": require_token(source_id, "source_id"),
        "omits": list(OMISSIONS),
        "overlays": deepcopy(overlays) if overlays is not None else empty_overlays(),
        "notes": normalized,
    }
    return validate_document(document)


def validate_document(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != {"schema", "base_sha256", "source_id", "omits", "overlays", "notes"}:
        raise ValueError("A document has incorrect fields")
    if value["schema"] != SCHEMA:
        raise ValueError("A document has the wrong schema")
    notes = normalize_notes(value["notes"])
    if value["notes"] != notes:
        raise ValueError("Notes are not in canonical order")
    if value["omits"] != list(OMISSIONS):
        raise ValueError("A document has the wrong omission declaration")
    result = {
        "schema": SCHEMA,
        "base_sha256": require_token(value["base_sha256"], "base_sha256"),
        "source_id": require_token(value["source_id"], "source_id"),
        "omits": list(OMISSIONS),
        "overlays": normalize_overlays(value["overlays"], notes),
        "notes": notes,
    }
    if value["overlays"] != result["overlays"]:
        raise ValueError("Overlays are not in canonical order")
    return result


def overlay_line(kind: str, row: dict[str, Any]) -> str:
    refs = ",".join(row["event_ids"])
    if kind == "bars":
        return f"BAR {row['id']} START {row['start']} LENGTH {row['length']} METER {row['meter']} EVENTS {refs}"
    if kind == "tracks":
        return f"TRACK {row['id']} VOICE {row['voice']} EVENTS {refs}"
    if kind == "regions":
        return f"REGION {row['id']} TRACK {row['track_id']} START {row['start']} END {row['end']} EVENTS {refs}"
    if kind == "meters":
        return f"METER {row['id']} START {row['start']} VALUE {row['value']} EVENTS {refs}"
    if kind == "tempos":
        return f"TEMPO {row['id']} START {row['start']} BPM {row['bpm']} EVENTS {refs}"
    if kind == "harmonies":
        return f"HARMONY {row['id']} START {row['start']} VALUE {row['value']} EVENTS {refs}"
    return f"GROOVE {row['id']} AMOUNT {row['amount']} EVENTS {refs}"


def render_document(arm: str, document: dict[str, Any]) -> str:
    value = validate_document(document)
    if arm == "exact-object-json":
        return canonical(value)
    if arm not in COMPACT_ARMS:
        raise ValueError(f"Unknown arm: {arm}")
    lines = [
        f"BASE {value['base_sha256']}",
        f"SOURCE {value['source_id']}",
        "OMITS " + " ".join(value["omits"]),
    ]
    if arm == "compact-bar-fields":
        lines.append("FIELDS " + " ".join(FIELDS))
    for kind in OVERLAY_ORDER:
        lines.extend(overlay_line(kind, row) for row in value["overlays"][kind])
    lines.extend(
        f"N {row['id']} {row['voice']} {row['start']} {row['duration']} {row['pitch']} {row['velocity']}"
        for row in value["notes"]
    )
    return "\n".join(lines)


def parse_overlay_line(line: str) -> tuple[str, dict[str, Any]] | None:
    specs = (
        ("bars", r"BAR (\S+) START (\S+) LENGTH (\S+) METER (\S+) EVENTS (\S+)", ("id", "start", "length", "meter", "event_ids")),
        ("tracks", r"TRACK (\S+) VOICE (\S+) EVENTS (\S+)", ("id", "voice", "event_ids")),
        ("regions", r"REGION (\S+) TRACK (\S+) START (\S+) END (\S+) EVENTS (\S+)", ("id", "track_id", "start", "end", "event_ids")),
        ("meters", r"METER (\S+) START (\S+) VALUE (\S+) EVENTS (\S+)", ("id", "start", "value", "event_ids")),
        ("tempos", r"TEMPO (\S+) START (\S+) BPM (\d+) EVENTS (\S+)", ("id", "start", "bpm", "event_ids")),
        ("harmonies", r"HARMONY (\S+) START (\S+) VALUE (\S+) EVENTS (\S+)", ("id", "start", "value", "event_ids")),
        ("grooves", r"GROOVE (\S+) AMOUNT (\S+) EVENTS (\S+)", ("id", "amount", "event_ids")),
    )
    for kind, pattern, names in specs:
        match = re.fullmatch(pattern, line)
        if match:
            row = dict(zip(names, match.groups()))
            row["event_ids"] = row["event_ids"].split(",")
            if kind == "tempos":
                row["bpm"] = int(row["bpm"])
            return kind, row
    return None


def parse_document(arm: str, text: str) -> dict[str, Any]:
    if arm == "exact-object-json":
        return validate_document(json.loads(text))
    if arm not in COMPACT_ARMS:
        raise ValueError(f"Unknown arm: {arm}")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    minimum = 5 if arm == "compact-bar-fields" else 4
    if len(lines) < minimum or not lines[0].startswith("BASE ") or not lines[1].startswith("SOURCE "):
        raise ValueError("A compact document is missing a fixed header")
    if lines[2] != "OMITS " + " ".join(OMISSIONS):
        raise ValueError("A compact document has the wrong OMITS header")
    index = 3
    if arm == "compact-bar-fields":
        if lines[index] != "FIELDS " + " ".join(FIELDS):
            raise ValueError("The FIELDS document needs its one fixed declaration")
        index += 1
    elif index < len(lines) and lines[index].startswith("FIELDS "):
        raise ValueError("The positional document cannot contain FIELDS")
    overlays = empty_overlays()
    notes = []
    note_pattern = re.compile(r"N (\S+) (\S+) (\S+) (\S+) (\d+) (\d+)")
    seen_note = False
    for line in lines[index:]:
        match = note_pattern.fullmatch(line)
        if match:
            seen_note = True
            notes.append(note(match[1], match[2], match[3], match[4], int(match[5]), int(match[6])))
            continue
        if seen_note:
            raise ValueError("An overlay cannot follow the note plane")
        parsed = parse_overlay_line(line)
        if parsed is None:
            raise ValueError(f"Invalid compact row: {line}")
        kind, row = parsed
        overlays[kind].append(row)
    value = make_document(notes, lines[0][5:], lines[1][7:], overlays)
    if render_document(arm, value) != "\n".join(lines):
        raise ValueError("The compact document is not canonical")
    return value


def normalize_changes(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or not value or any(name not in PATCH_FIELDS for name in value):
        raise ValueError("SET changes must contain represented mutable fields")
    probe = note("probe", value.get("voice", "lead"), value.get("start", "0"), value.get("duration", "1"), value.get("pitch", 60), value.get("velocity", 80))
    normalized = normalize_note(probe)
    return {name: normalized[name] for name in PATCH_FIELDS if name in value}


def validate_patch(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != {"base_sha256", "ops"}:
        raise ValueError("A patch has incorrect fields")
    base = require_token(value["base_sha256"], "base_sha256")
    if not isinstance(value["ops"], list) or not value["ops"]:
        raise ValueError("A patch needs at least one operation")
    result = []
    targets = []
    for operation in value["ops"]:
        if not isinstance(operation, dict) or operation.get("op") not in {"set", "insert", "delete"}:
            raise ValueError("A patch has an invalid operation")
        kind = operation["op"]
        if kind == "set" and set(operation) == {"op", "id", "changes"}:
            normalized = {"op": kind, "id": require_token(operation["id"], "set.id"), "changes": normalize_changes(operation["changes"])}
        elif kind == "insert" and set(operation) == {"op", "note"}:
            normalized = {"op": kind, "note": normalize_note(operation["note"])}
        elif kind == "delete" and set(operation) == {"op", "id"}:
            normalized = {"op": kind, "id": require_token(operation["id"], "delete.id")}
        else:
            raise ValueError("A patch operation has incorrect fields")
        target = normalized["note"]["id"] if kind == "insert" else normalized["id"]
        targets.append(target)
        result.append(normalized)
    if len(targets) != len(set(targets)):
        raise ValueError("A patch cannot target one ID twice")
    return {"base_sha256": base, "ops": result}


def render_patch(arm: str, patch: dict[str, Any]) -> str:
    value = validate_patch(patch)
    if arm == "exact-object-json":
        return canonical(value)
    if arm not in COMPACT_ARMS:
        raise ValueError(f"Unknown arm: {arm}")
    lines = [f"PATCH {value['base_sha256']}"]
    for operation in value["ops"]:
        if operation["op"] == "set":
            changes = " ".join(f"{name}={operation['changes'][name]}" for name in PATCH_FIELDS if name in operation["changes"])
            lines.append(f"SET {operation['id']} {changes}")
        elif operation["op"] == "insert":
            row = operation["note"]
            lines.append(f"INSERT {row['id']} {row['voice']} {row['start']} {row['duration']} {row['pitch']} {row['velocity']}")
        else:
            lines.append(f"DELETE {operation['id']}")
    return "\n".join(lines)


def parse_patch(arm: str, text: str) -> dict[str, Any]:
    if arm == "exact-object-json":
        return validate_patch(json.loads(text))
    if arm not in COMPACT_ARMS:
        raise ValueError(f"Unknown arm: {arm}")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) < 2 or not lines[0].startswith("PATCH "):
        raise ValueError("A compact patch needs PATCH and operation rows")
    operations = []
    for line in lines[1:]:
        if match := re.fullmatch(r"SET (\S+) (.+)", line):
            changes = {}
            for token in match[2].split():
                name, raw = token.split("=", 1)
                changes[name] = int(raw) if name in {"pitch", "velocity"} else raw
            operations.append({"op": "set", "id": match[1], "changes": changes})
        elif match := re.fullmatch(r"INSERT (\S+) (\S+) (\S+) (\S+) (\d+) (\d+)", line):
            operations.append({"op": "insert", "note": note(match[1], match[2], match[3], match[4], int(match[5]), int(match[6]))})
        elif match := re.fullmatch(r"DELETE (\S+)", line):
            operations.append({"op": "delete", "id": match[1]})
        else:
            raise ValueError(f"Invalid patch row: {line}")
    value = validate_patch({"base_sha256": lines[0][6:], "ops": operations})
    if render_patch(arm, value) != "\n".join(lines):
        raise ValueError("The compact patch is not canonical")
    return value


def compile_patch(patch: dict[str, Any], source: list[dict[str, Any]], base_sha256: str) -> list[dict[str, Any]]:
    value = validate_patch(patch)
    if value["base_sha256"] != base_sha256:
        raise ValueError("The patch base conflicts with the current document")
    result = {row["id"]: deepcopy(row) for row in normalize_notes(source, allow_extra=True)}
    for operation in value["ops"]:
        kind = operation["op"]
        target = operation["note"]["id"] if kind == "insert" else operation["id"]
        if kind == "insert":
            if target in result:
                raise ValueError("INSERT targets an existing ID")
            result[target] = deepcopy(operation["note"])
        elif target not in result:
            raise ValueError("A patch targets an unknown ID")
        elif kind == "delete":
            del result[target]
        else:
            result[target].update(operation["changes"])
            result[target] = normalize_note(result[target], allow_extra=True)
    if not result:
        raise ValueError("A patch cannot remove the complete note plane")
    return sort_notes(list(result.values()))


def finish_task(cohort: str, family: str, variant: int, body: dict[str, Any]) -> dict[str, Any]:
    value = {
        "schema": CORPUS_SCHEMA,
        "id": f"{cohort}-{family}-{variant + 1}",
        "cohort": cohort,
        "family": family,
        "variant": variant + 1,
        "origin": "Generated by Ghostnote for an MIT-licensed benchmark.",
        "license": "MIT",
        **body,
    }
    semantic = {name: item for name, item in value.items() if name not in {"schema", "id", "cohort", "variant", "origin", "license"}}
    value["semantic_sha256"] = digest(semantic)
    value["sha256"] = digest(value)
    return value


def analysis_task(cohort: str, variant: int, seed: int) -> dict[str, Any]:
    tonic = (seed + variant * 2) % 12
    cases = (
        ("major", (0, 4, 7), "I", 0),
        ("major", (0, 4, 7), "I6", 1),
        ("minor", (0, 3, 7), "i", 0),
        ("dominant-seventh", (0, 4, 7, 10), "V7", 0),
        ("dominant-seventh", (0, 4, 7, 10), "V7", 2),
    )
    quality, intervals, function, inversion = cases[variant % len(cases)]
    root_pc = tonic if function in {"I", "I6", "i"} else (tonic + 7) % 12
    root = 48 + root_pc
    chord = [root + interval for interval in intervals]
    chord = chord[inversion:] + [pitch + 12 for pitch in chord[:inversion]]
    relation = ("transposition", "inversion", "rhythmic-scale")[variant % 3]
    motif_a_pitches = [60 + (seed % 5), 62 + (seed % 5), 65 + (seed % 5)]
    motif_a_starts = ["0", "1", "2"]
    motif_a_durations = ["1/2", "1/2", "1"]
    if relation == "transposition":
        motif_b_pitches = [pitch + 3 + variant % 2 for pitch in motif_a_pitches]
        motif_b_starts = motif_a_starts
        motif_b_durations = motif_a_durations
    elif relation == "inversion":
        axis = motif_a_pitches[0]
        motif_b_pitches = [axis - (pitch - axis) for pitch in motif_a_pitches]
        motif_b_starts = motif_a_starts
        motif_b_durations = motif_a_durations
    else:
        motif_b_pitches = list(motif_a_pitches)
        motif_b_starts = [fraction_text(fraction(value) * 2) for value in motif_a_starts]
        motif_b_durations = [fraction_text(fraction(value) * 2) for value in motif_a_durations]
    source_notes = [note(f"an-{variant + 1}-{index + 1}", "keys", "0", "2", pitch, 74 + variant) for index, pitch in enumerate(chord)]
    expected = {
        "chord_id": f"chord-{variant + 1}",
        "root_pc": root_pc,
        "bass_pc": chord[0] % 12,
        "quality": quality,
        "inversion": inversion,
        "function": function,
        "motif_relation": relation,
        "rhythm": "sustained",
    }
    contract = {
        "chord_id": expected["chord_id"],
        "key_tonic_pc": tonic,
        "motif_a_pitches": motif_a_pitches,
        "motif_a_starts": motif_a_starts,
        "motif_a_durations": motif_a_durations,
        "motif_b_pitches": motif_b_pitches,
        "motif_b_starts": motif_b_starts,
        "motif_b_durations": motif_b_durations,
    }
    return finish_task(cohort, "comprehension-analysis", variant, {"source": source_notes, "contract": contract, "expected": expected})


def motif_expected(source: list[dict[str, Any]], contract: dict[str, Any]) -> list[dict[str, Any]]:
    first = fraction(source[0]["start"])
    result = []
    for index, row in enumerate(sort_notes(source)):
        pitch = row["pitch"]
        start = fraction(row["start"]) - first
        duration = fraction(row["duration"])
        if contract["operation"] == "transpose":
            pitch += contract["semitones"]
        elif contract["operation"] == "invert":
            pitch = contract["axis"] - (pitch - contract["axis"])
        else:
            start *= fraction(contract["factor"])
            duration *= fraction(contract["factor"])
        result.append(note(contract["output_ids"][index], row["voice"], fraction(contract["output_start"]) + start, duration, pitch, row["velocity"]))
    return sort_notes(result)


def motif_task(cohort: str, variant: int, seed: int) -> dict[str, Any]:
    operation = ("transpose", "invert", "rhythmic-scale")[variant % 3]
    base = 57 + (seed + variant) % 8
    source = [note(f"mt-src-{variant + 1}-{index + 1}", "lead", index, "1/2" if index < 3 else "1", base + offset, 81 + variant % 6) for index, offset in enumerate((0, 2, 5, 4))]
    contract: dict[str, Any] = {
        "operation": operation,
        "output_start": fraction_text(5 + variant % 3),
        "output_ids": [f"mt-out-{variant + 1}-{index + 1}" for index in range(4)],
    }
    if operation == "transpose":
        contract["semitones"] = 2 + variant % 5
    elif operation == "invert":
        contract["axis"] = source[0]["pitch"] + variant % 2
    else:
        contract["factor"] = ("2", "3/2")[variant % 2]
    expected = motif_expected(source, contract)
    return finish_task(cohort, "continuation-motif", variant, {"source": source, "contract": contract, "expected": expected})


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
        if all(left < right for left, right in zip(pitches, pitches[1:]))
        and set(contract["pitch_classes"][index]).issubset({pitch % 12 for pitch in pitches})
    ]


def select_progression(contract: dict[str, Any]) -> list[tuple[int, int, int, int]]:
    selected = []
    for index in range(len(contract["chord_starts"])):
        candidates = progression_candidates(contract, index)
        if not candidates:
            raise ValueError("A progression contract has no valid voicing")
        choice = min(candidates, key=lambda pitches: (sum(pitches), pitches) if not selected else (sum(abs(after - before) for before, after in zip(selected[-1], pitches)), pitches))
        selected.append(choice)
    return selected


def same_voice_movement(chords: list[tuple[int, int, int, int]]) -> int:
    return sum(abs(after - before) for before, after in zip(chords, chords[1:]) for before, after in zip(before, after))


def perfect_progression(contract: dict[str, Any]) -> list[dict[str, Any]]:
    return sort_notes([
        note(f"pg-{chord + 1}-{voice}", voice, contract["chord_starts"][chord], contract["duration"], pitch, contract["velocity"])
        for chord, pitches in enumerate(select_progression(contract))
        for voice, pitch in zip(VOICE_ORDER, pitches)
    ])


def progression_task(cohort: str, variant: int, seed: int) -> dict[str, Any]:
    tonic = (seed + variant * 5) % 12
    relative = ((0, 4, 7), (5, 9, 0), (7, 11, 2, 5), (0, 4, 7))
    pitch_classes = [sorted((tonic + value) % 12 for value in chord) for chord in relative]
    contract = {
        "chord_starts": ["0", "1", "2", "3"],
        "duration": "1",
        "velocity": 78 + variant % 8,
        "pitch_classes": pitch_classes,
        "bass_pitch_classes": [tonic, (tonic + 5) % 12, (tonic + 7) % 12, tonic],
        "voice_ranges": {"bass": [36, 59], "tenor": [48, 67], "alto": [55, 76], "soprano": [60, 84]},
        "strict_voice_order": list(VOICE_ORDER),
        "cadence": {"penultimate_bass_pc": (tonic + 7) % 12, "final_bass_pc": tonic, "final_pitch_classes": pitch_classes[-1]},
        "movement_formula": "sum(abs(current_pitch[voice]-previous_pitch[voice])) for each adjacent chord and bass,tenor,alto,soprano",
    }
    selected = select_progression({**contract, "maximum_same_voice_movement": 999})
    contract["maximum_same_voice_movement"] = same_voice_movement(selected) + variant % 3
    return finish_task(cohort, "generation-progression", variant, {"contract": contract})


def structure_notes(variant: int, seed: int) -> list[dict[str, Any]]:
    base = 45 + (seed + variant) % 8
    return sort_notes([
        note(f"st-{variant + 1}-1", "bass", "0", "1", base, 75 + variant),
        note(f"st-{variant + 1}-2", "lead", "0", "1/2", base + 19, 84 + variant),
        note(f"st-{variant + 1}-3", "lead", "3/4", "1/4", base + 22, 82 + variant),
    ])


def role_contract(variant: int, seed: int) -> dict[str, Any]:
    tonic = (seed + variant * 3) % 12
    return {
        "starts": ["4", "5", "6", "7"],
        "duration": "1",
        "harmony_pitch_classes": [sorted((tonic + value) % 12 for value in chord) for chord in ((0, 3, 7), (5, 8, 0), (7, 10, 2), (0, 3, 7))],
        "ranges": {"bass": [36, 55], "lead": [60, 81]},
        "maximum_role_leap": 9 + variant % 3,
        "cadence_pitch_class": tonic,
    }


def perfect_roles(contract: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    previous: dict[str, int | None] = {"bass": None, "lead": None}
    for index, start in enumerate(contract["starts"]):
        for voice in ("bass", "lead"):
            low, high = contract["ranges"][voice]
            candidates = [pitch for pitch in range(low, high + 1) if pitch % 12 in contract["harmony_pitch_classes"][index]]
            if index == len(contract["starts"]) - 1 and voice == "lead":
                candidates = [pitch for pitch in candidates if pitch % 12 == contract["cadence_pitch_class"]]
            pitch = candidates[0] if previous[voice] is None else min(candidates, key=lambda item: (abs(item - int(previous[voice])), item))
            previous[voice] = pitch
            result.append(note(f"rl-{voice}-{index + 1}", voice, start, contract["duration"], pitch, 78 if voice == "bass" else 88))
    return sort_notes(result)


def revoice_source(variant: int, seed: int) -> list[dict[str, Any]]:
    tonic = (seed + variant) % 5
    chords = ((48, 55, 64, 72), (50, 57, 65, 74))
    return sort_notes([
        note(f"rv-{chord + 1}-{voice}", voice, chord, "1", pitch + tonic, 80 + variant % 5)
        for chord, pitches in enumerate(chords)
        for voice, pitch in zip(VOICE_ORDER, pitches)
    ])


def target_revoice_pitches(source: list[int], operation: str) -> list[int]:
    pitches = sorted(source)
    if operation == "drop-2":
        pitches[-2] -= 12
        return sorted(pitches)
    if operation == "first-inversion":
        return sorted(pitches[1:] + [pitches[0] + 12])
    return pitches


def nearest_revoice_choices(source: list[int], previous: list[int], ranges: dict[str, list[int]]) -> list[list[int]]:
    candidates = []
    for shifts in itertools.product((-12, 0, 12), repeat=4):
        pitches = [pitch + shift for pitch, shift in zip(sorted(source), shifts)]
        if not all(left < right for left, right in zip(pitches, pitches[1:])):
            continue
        if all(ranges[voice][0] <= pitch <= ranges[voice][1] for voice, pitch in zip(VOICE_ORDER, pitches)):
            candidates.append(pitches)
    minimum = min(sum(abs(after - before) for before, after in zip(previous, pitches)) for pitches in candidates)
    return [pitches for pitches in candidates if sum(abs(after - before) for before, after in zip(previous, pitches)) == minimum]


def perfect_revoice(contract: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    previous = None
    for rows in notes_by_start(contract["source"]).values():
        source_pitches = [value["pitch"] for value in rows]
        pitches = nearest_revoice_choices(source_pitches, previous, contract["voice_ranges"])[0] if contract["operation"] == "nearest" and previous is not None else target_revoice_pitches(source_pitches, contract["operation"])
        previous = pitches
        for row, pitch in zip(rows, pitches):
            result.append({**row, "pitch": pitch})
    return sort_notes(result)


def guard_task(cohort: str, family: str, variant: int, seed: int) -> dict[str, Any]:
    if family == "comprehension-structure":
        source = structure_notes(variant, seed)
        return finish_task(cohort, family, variant, {"source": source, "expected": source})
    if family == "continuation-roles":
        contract = role_contract(variant, seed)
        return finish_task(cohort, family, variant, {"contract": contract, "expected": perfect_roles(contract)})
    if family == "transformation-revoice":
        source = revoice_source(variant, seed)
        operation = ("drop-2", "first-inversion", "nearest")[variant % 3]
        contract = {
            "source": source,
            "operation": operation,
            "voice_ranges": {"bass": [34, 60], "tenor": [43, 67], "alto": [50, 76], "soprano": [57, 86]},
            "strict_voice_order": list(VOICE_ORDER),
            "definitions": {
                "drop-2": "Lower the second-highest source pitch by 12, sort all pitches, and assign bass through soprano.",
                "first-inversion": "Raise the lowest source pitch by 12, sort all pitches, and assign bass through soprano.",
                "nearest": "Keep chord 1. For each later chord, minimize summed same-voice movement from the prior output chord. Accept tied minima.",
            },
        }
        return finish_task(cohort, family, variant, {"contract": contract, "expected": perfect_revoice(contract)})
    source = structure_notes(variant, seed)
    base = digest(projected(source))
    if family == "transformation-local":
        target = source[variant % len(source)]
        change = {"note_id": target["id"], "field": "velocity", "value": min(127, target["velocity"] + 3)}
        expected = deepcopy(source)
        next(row for row in expected if row["id"] == target["id"])["velocity"] = change["value"]
        return finish_task(cohort, family, variant, {"source": source, "base_sha256": base, "change": change, "expected": sort_notes(expected)})
    offset = fraction_text(Fraction(1 + variant % 3, 12))
    expected = deepcopy(source)
    for index, row in enumerate(expected):
        if index % 2 == 1:
            row["start"] = fraction_text(fraction(row["start"]) + fraction(offset))
    return finish_task(cohort, family, variant, {"source": source, "offset": offset, "expected": sort_notes(expected)})


def make_corpus(cohort: str) -> dict[str, Any]:
    if cohort not in COHORT_SPECS:
        raise ValueError(f"Unknown cohort: {cohort}")
    spec = COHORT_SPECS[cohort]
    seed = int(spec["seed"])
    fixtures = {
        "comprehension-analysis": [analysis_task(cohort, index, seed) for index in range(int(spec["decision"]))],
        "continuation-motif": [motif_task(cohort, index, seed) for index in range(int(spec["decision"]))],
        "generation-progression": [progression_task(cohort, index, seed) for index in range(int(spec["decision"]))],
    }
    for family in GUARD_FAMILIES:
        fixtures[family] = [guard_task(cohort, family, index, seed) for index in range(int(spec["guard"]))]
    value = {"schema": CORPUS_SCHEMA, "cohort": cohort, "license": "MIT", "fixtures": fixtures}
    value["sha256"] = digest(value)
    return value


def notes_by_start(values: list[dict[str, Any]]) -> dict[Fraction, list[dict[str, Any]]]:
    result: dict[Fraction, list[dict[str, Any]]] = defaultdict(list)
    for value in sort_notes(values):
        result[fraction(value["start"])].append(value)
    return dict(sorted(result.items()))


def render_analysis(value: dict[str, Any]) -> str:
    if set(value) != set(ANALYSIS_FIELDS):
        raise ValueError("Analysis has incorrect fields")
    return "ANALYSIS " + " ".join(f"{name}={value[name]}" for name in ANALYSIS_FIELDS)


def parse_analysis(text: str) -> dict[str, Any]:
    if not text.strip().startswith("ANALYSIS "):
        raise ValueError("Analysis output must start with ANALYSIS")
    fields = {}
    for token in text.strip().split()[1:]:
        name, raw = token.split("=", 1)
        if name in fields:
            raise ValueError("Analysis output repeats a field")
        fields[name] = int(raw) if name in {"root_pc", "bass_pc", "inversion"} else raw
    if set(fields) != set(ANALYSIS_FIELDS):
        raise ValueError("Analysis output has incorrect fields")
    return fields


def score_analysis(actual: dict[str, Any], expected: dict[str, Any]) -> dict[str, bool]:
    return {
        "chord_identity": actual["chord_id"] == expected["chord_id"],
        "root_pitch_class": actual["root_pc"] == expected["root_pc"],
        "bass_pitch_class": actual["bass_pc"] == expected["bass_pc"],
        "chord_quality": actual["quality"] == expected["quality"],
        "inversion_number": actual["inversion"] == expected["inversion"],
        "chord_function": actual["function"] == expected["function"],
        "motif_relation": actual["motif_relation"] == expected["motif_relation"],
        "rhythm_class": actual["rhythm"] == expected["rhythm"],
    }


def score_motif(notes: list[dict[str, Any]], task: dict[str, Any]) -> dict[str, bool]:
    expected = task["expected"]
    contract = task["contract"]
    by_id = {row["id"]: row for row in notes}
    structure = event_ids(notes) == event_ids(expected)
    operation_fields = {
        "transpose": set(contract) == {"operation", "output_start", "output_ids", "semitones"},
        "invert": set(contract) == {"operation", "output_start", "output_ids", "axis"},
        "rhythmic-scale": set(contract) == {"operation", "output_start", "output_ids", "factor"},
    }[contract["operation"]]
    operation = not structure or all(by_id[row["id"]]["pitch"] == row["pitch"] and by_id[row["id"]]["start"] == row["start"] for row in expected)
    preserved = not structure or all(by_id[row["id"]][name] == row[name] for row in expected for name in ("duration", "voice", "velocity"))
    if contract["operation"] == "rhythmic-scale":
        operation = not structure or all(by_id[row["id"]][name] == row[name] for row in expected for name in ("pitch", "start", "duration"))
        preserved = not structure or all(by_id[row["id"]][name] == row[name] for row in expected for name in ("voice", "velocity"))
    return {"operation_specific_fields": operation_fields, "output_identity": structure, "operation_formula": operation, "preserved_properties": preserved}


def score_progression(notes: list[dict[str, Any]], contract: dict[str, Any]) -> dict[str, bool]:
    groups = notes_by_start(notes)
    starts = [fraction(value) for value in contract["chord_starts"]]
    complete = list(groups) == starts
    chords = []
    exact_values = True
    for start in starts:
        rows = groups.get(start, [])
        by_voice = {row["voice"]: row for row in rows}
        if len(rows) != 4 or set(by_voice) != set(VOICE_ORDER):
            complete = False
            continue
        chords.append(tuple(by_voice[voice]["pitch"] for voice in VOICE_ORDER))
        exact_values &= all(row["duration"] == contract["duration"] and row["velocity"] == contract["velocity"] for row in rows)
    coverage = not complete or all(set(expected).issubset({pitch % 12 for pitch in chord}) for expected, chord in zip(contract["pitch_classes"], chords))
    inversions = not complete or all(chord[0] % 12 == expected for expected, chord in zip(contract["bass_pitch_classes"], chords))
    ranges = not complete or all(contract["voice_ranges"][voice][0] <= chord[index] <= contract["voice_ranges"][voice][1] for chord in chords for index, voice in enumerate(VOICE_ORDER))
    order = not complete or (contract["strict_voice_order"] == list(VOICE_ORDER) and all(all(left < right for left, right in zip(chord, chord[1:])) for chord in chords))
    movement = same_voice_movement(chords) if complete else 10**9
    cadence = not complete or (chords[-2][0] % 12 == contract["cadence"]["penultimate_bass_pc"] and chords[-1][0] % 12 == contract["cadence"]["final_bass_pc"] and set(contract["cadence"]["final_pitch_classes"]).issubset({pitch % 12 for pitch in chords[-1]}))
    return {
        "chord_starts_and_named_voices": complete,
        "duration_and_velocity": not complete or exact_values,
        "pitch_class_coverage": coverage,
        "bass_inversions": inversions,
        "voice_ranges": ranges,
        "strict_voice_order": order,
        "same_voice_movement": not complete or movement <= contract["maximum_same_voice_movement"],
        "cadence": cadence,
    }


def score_roles(notes: list[dict[str, Any]], contract: dict[str, Any]) -> dict[str, bool]:
    groups = notes_by_start(notes)
    starts = [fraction(value) for value in contract["starts"]]
    lanes = {voice: [row for row in sort_notes(notes) if row["voice"] == voice] for voice in ("bass", "lead")}
    complete = list(groups) == starts and len(notes) == len(starts) * 2 and all(len(rows) == len(starts) for rows in lanes.values())
    return {
        "starts_and_density": complete,
        "duration": not complete or all(row["duration"] == contract["duration"] for row in notes),
        "ranges": not complete or all(contract["ranges"][row["voice"]][0] <= row["pitch"] <= contract["ranges"][row["voice"]][1] for row in notes),
        "harmony": not complete or all(all(row["pitch"] % 12 in contract["harmony_pitch_classes"][index] for row in groups[start]) for index, start in enumerate(starts)),
        "voice_leading": not complete or all(all(abs(after["pitch"] - before["pitch"]) <= contract["maximum_role_leap"] for before, after in zip(rows, rows[1:])) for rows in lanes.values()),
        "no_collisions": not complete or all(len({row["pitch"] for row in groups[start]}) == 2 for start in starts),
        "cadence": not complete or lanes["lead"][-1]["pitch"] % 12 == contract["cadence_pitch_class"],
    }


def score_revoice(notes: list[dict[str, Any]], contract: dict[str, Any]) -> dict[str, bool]:
    source = sort_notes(contract["source"])
    actual = sort_notes(notes)
    source_groups = notes_by_start(source)
    actual_groups = notes_by_start(actual)
    structure = len(actual) == len(source) and list(actual_groups) == list(source_groups) and all(len(actual_groups[start]) == len(source_groups[start]) for start in source_groups)
    same_ids = not structure or set(event_ids(actual)) == set(event_ids(source))
    aligned = list(zip(source, actual))
    preserved = not structure or all(all(after[name] == before[name] for name in ("start", "duration", "voice", "velocity")) for before, after in aligned)
    pitch_classes = not structure or all(sorted(row["pitch"] % 12 for row in actual_groups[start]) == sorted(row["pitch"] % 12 for row in rows) for start, rows in source_groups.items())
    expected = perfect_revoice(contract)
    ranges = not structure or all(
        contract["voice_ranges"][row["voice"]][0] <= row["pitch"] <= contract["voice_ranges"][row["voice"]][1]
        for row in actual
    )
    voice_order = not structure or (
        contract["strict_voice_order"] == list(VOICE_ORDER)
        and all(all(left["pitch"] < right["pitch"] for left, right in zip(rows, rows[1:])) for rows in actual_groups.values())
    )
    operation_prerequisites = structure and same_ids and preserved and pitch_classes and ranges and voice_order
    expected_operation = [
        (row["start"], row["voice"], row["pitch"])
        for row in sort_notes(expected)
    ]
    actual_operation = [(row["start"], row["voice"], row["pitch"]) for row in actual]
    return {
        "note_count_and_starts": structure,
        "stable_identity": same_ids,
        "preserved_properties": preserved,
        "pitch_classes": pitch_classes,
        "operation": not operation_prerequisites or actual_operation == expected_operation,
        "range_limits": ranges,
        "voice_order": voice_order,
    }


def score_local_result(
    compiled: list[dict[str, Any]],
    patch: dict[str, Any],
    source: list[dict[str, Any]],
    expected: list[dict[str, Any]],
) -> dict[str, bool]:
    stable = set(event_ids(compiled)) == set(event_ids(source))
    sparse = len(patch["ops"]) == 1 and patch["ops"][0]["op"] == "set"
    exact = not stable or not sparse or sum(before == after for before, after in zip(source, compiled)) == len(source) - 1
    canonical_result = not stable or not sparse or not exact or projected(compiled) == projected(expected)
    return {
        "canonical_result": canonical_result,
        "stable_identity": stable,
        "exact_preservation": exact,
        "sparse_change": sparse,
    }


def expected_output_context(task: dict[str, Any]) -> tuple[str, str]:
    source = task.get("source")
    if isinstance(source, list):
        return digest(projected(source)), task["id"] + "-source"
    if task["family"] == "transformation-revoice":
        rows = task["contract"]["source"]
        return digest(projected(rows)), task["id"] + "-source"
    return "none", task["id"]


def score_response(arm: str, task: dict[str, Any], payload: str) -> dict[str, Any]:
    family = task["family"]
    try:
        if family == "comprehension-analysis":
            checks = score_analysis(parse_analysis(payload), task["expected"])
        elif family == "transformation-local":
            patch = parse_patch(arm, payload)
            compiled = compile_patch(patch, task["source"], task["base_sha256"])
            checks = score_local_result(compiled, patch, task["source"], task["expected"])
        else:
            document = parse_document(arm, payload)
            base, source_id = expected_output_context(task)
            header = document["base_sha256"] == base and document["source_id"] == source_id and document["overlays"] == empty_overlays()
            notes = document["notes"]
            if family == "continuation-motif":
                checks = score_motif(notes, task)
            elif family == "generation-progression":
                checks = score_progression(notes, task["contract"])
            elif family == "continuation-roles":
                checks = score_roles(notes, task["contract"])
            elif family == "transformation-revoice":
                checks = score_revoice(notes, task["contract"])
            else:
                checks = {"exact_relation": projected(notes) == projected(task["expected"])}
            checks = {"document_context": header, **checks}
        failed = sorted(name for name, passed in checks.items() if not passed)
        return {
            "syntax_pass": True,
            "musical_pass": not failed,
            "primary_pass": not failed,
            "checks": checks,
            "diagnostic": None if not failed else {"class": "musical-contract", "failed_checks": failed},
        }
    except (IndexError, KeyError, TypeError, ValueError, json.JSONDecodeError, ZeroDivisionError) as error:
        return {
            "syntax_pass": False,
            "musical_pass": False,
            "primary_pass": False,
            "checks": {},
            "diagnostic": {"class": "parse", "error_type": type(error).__name__, "message": str(error)},
        }


def perfect_notes(task: dict[str, Any]) -> list[dict[str, Any]]:
    family = task["family"]
    if family == "generation-progression":
        return perfect_progression(task["contract"])
    if family == "continuation-roles":
        return perfect_roles(task["contract"])
    if family == "transformation-revoice":
        return perfect_revoice(task["contract"])
    return task["expected"]


def perfect_payload(arm: str, task: dict[str, Any]) -> str:
    if task["family"] == "comprehension-analysis":
        return render_analysis(task["expected"])
    if task["family"] == "transformation-local":
        change = task["change"]
        return render_patch(arm, {"base_sha256": task["base_sha256"], "ops": [{"op": "set", "id": change["note_id"], "changes": {change["field"]: change["value"]}}]})
    base, source_id = expected_output_context(task)
    return render_document(arm, make_document(perfect_notes(task), base, source_id))


def source_notes(task: dict[str, Any]) -> list[dict[str, Any]]:
    if task["family"] == "transformation-revoice":
        return task["contract"]["source"]
    source = task.get("source")
    return source if isinstance(source, list) else []


def represented_source(arm: str, task: dict[str, Any]) -> str | None:
    rows = source_notes(task)
    if not rows:
        return None
    base = digest(projected(rows))
    return render_document(arm, make_document(rows, base, task["id"] + "-source"))


def document_example(arm: str) -> str:
    rows = [note("ex-bass", "bass", "0", "1", 48, 80), note("ex-lead", "lead", "0", "1/2", 67, 84)]
    return render_document(arm, make_document(rows, "example", "example-source"))


def patch_example(arm: str) -> str:
    patch = {
        "base_sha256": "example",
        "ops": [
            {"op": "set", "id": "n1", "changes": {"pitch": 62}},
            {"op": "set", "id": "n2", "changes": {"velocity": 87}},
        ],
    }
    return render_patch(arm, patch)


def output_grammar(arm: str, family: str) -> str:
    if family == "comprehension-analysis":
        return "Return one ANALYSIS row with exactly these fields: " + " ".join(ANALYSIS_FIELDS) + "."
    if family == "transformation-local":
        if arm == "exact-object-json":
            return "Return one exact-object patch with base_sha256 and ops. Each op is set, insert, or delete."
        return "Return PATCH <base> followed by one or more SET, INSERT, or DELETE rows."
    if arm == "exact-object-json":
        return "Return one exact object with schema, base_sha256, source_id, omits, overlays, and notes. Use MIDI integers. Keep every collection and note in canonical order."
    declaration = " Include exactly one FIELDS id voice start duration pitch velocity line." if arm == "compact-bar-fields" else " Do not include a FIELDS line."
    return "Return BASE, SOURCE, and the fixed OMITS header. Then return optional overlay rows and one N row per note. Overlays only refer to event IDs and never repeat note values." + declaration


def output_example(arm: str, family: str) -> str:
    if family == "comprehension-analysis":
        return "ANALYSIS chord_id=chord-1 root_pc=0 bass_pc=4 quality=major inversion=1 function=I6 motif_relation=transposition rhythm=sustained"
    if family == "transformation-local":
        return patch_example(arm)
    return document_example(arm)


def analysis_instruction(task: dict[str, Any]) -> str:
    return (
        "Analyze one chord and two motifs. Input note columns are id (opaque identity), voice (lane), start and duration (beats as rational values), pitch (MIDI 0 through 127), and velocity (MIDI attack velocity). "
        "Pitch class uses pitch modulo 12, with 0=C. root_pc is the chord root. bass_pc is the lowest MIDI pitch modulo 12. quality uses major=[0,4,7], minor=[0,3,7], or dominant-seventh=[0,4,7,10] from root_pc. "
        "inversion is 0 when the root is in the bass, 1 for the third, 2 for the fifth, and 3 for the seventh. function is I for a major tonic root, I6 for its first inversion, i for a minor tonic root, and V7 for a dominant-seventh root seven semitones above key_tonic_pc. "
        "motif_relation is transposition when corresponding pitch differences are one constant and rhythm is unchanged; inversion when intervals from the first pitch reverse sign and rhythm is unchanged; or rhythmic-scale when pitches are unchanged and every onset offset and duration uses one common factor. rhythm is sustained when all chord notes have one start and duration. "
        f"Independent motif and key columns: {canonical(task['contract'])}. Report every field independently."
    )


def task_instruction(task: dict[str, Any]) -> str:
    family = task["family"]
    if family == "comprehension-analysis":
        return analysis_instruction(task)
    if family == "continuation-motif":
        contract = task["contract"]
        common = f"Return only four continuation notes. Use output IDs {','.join(contract['output_ids'])}. The first output starts at {contract['output_start']}. "
        if contract["operation"] == "transpose":
            return common + f"For each source event, set pitch=source_pitch+{contract['semitones']} and start=output_start+(source_start-first_source_start). Preserve duration, voice, and velocity."
        if contract["operation"] == "invert":
            return common + f"For each source event, set pitch={contract['axis']}-(source_pitch-{contract['axis']}) and start=output_start+(source_start-first_source_start). Preserve duration, voice, and velocity."
        return common + f"Use rhythmic-scale factor {contract['factor']}. Set pitch=source_pitch, start=output_start+(source_start-first_source_start)*factor, and duration=source_duration*factor. Preserve voice and velocity."
    if family == "generation-progression":
        contract = task["contract"]
        return (
            "Realize the progression. At each start, use bass, tenor, alto, and soprano exactly once. Require bass < tenor < alto < soprano. Cover every stated pitch class and use the stated bass pitch class. Keep each voice in its inclusive MIDI range. "
            "Same-voice movement is the sum of abs(current pitch minus previous pitch) over each adjacent chord and the same named voice. Keep it at or below maximum_same_voice_movement. The penultimate and final chords must meet every cadence field. "
            f"Use the exact duration and velocity. Contract: {canonical(contract)}"
        )
    if family == "comprehension-structure":
        return "Reconstruct every represented note and value. Keep the output context headers from the source. Do not return structural overlays."
    if family == "continuation-roles":
        return f"Create one bass and one lead note at each start. Meet every range, harmony, leap, collision, duration, and cadence constraint: {canonical(task['contract'])}"
    if family == "transformation-revoice":
        return (
            f"Apply operation={task['contract']['operation']}. Preserve IDs, starts, durations, voices, velocities, and each chord pitch-class multiset. "
            f"Keep strict voice order {canonical(task['contract']['strict_voice_order'])} and inclusive ranges {canonical(task['contract']['voice_ranges'])}. "
            f"Definitions: {canonical(task['contract']['definitions'])}"
        )
    if family == "transformation-local":
        return f"Return one sparse SET operation for this change: {canonical(task['change'])}. Use base SHA-256 {task['base_sha256']}. Preserve all unrelated and omitted properties."
    return f"Add {task['offset']} beat to odd-indexed note starts only. Index the canonical source from zero. Preserve every other represented value."


def prompt_for(arm: str, task: dict[str, Any]) -> str:
    parts = [
        "Complete one deterministic symbolic-music task.",
        "Return one JSON object with exactly one string field named payload. Put the requested representation in that string. Do not add prose.",
        f"Representation arm: {arm}.",
        output_grammar(arm, task["family"]),
        "Follow this complete example, but use the task values:\n" + output_example(arm, task["family"]),
        task_instruction(task),
    ]
    source = represented_source(arm, task)
    if source is not None:
        parts.extend(("SOURCE", source, "END SOURCE"))
    return "\n\n".join(parts)


def jobs(cohort: str) -> list[dict[str, Any]]:
    corpus = make_corpus(cohort)
    jobs_value = [
        {"arm": arm, "family": family, "variant": task["variant"], "sentinel": False, "task": task}
        for arm in ARMS
        for family in TASK_FAMILIES
        for task in corpus["fixtures"][family]
    ]
    if cohort == "calibration":
        for arm in ARMS:
            for family in DECISION_FAMILIES:
                task = corpus["fixtures"][family][0]
                jobs_value.append({"arm": arm, "family": family, "variant": task["variant"], "sentinel": True, "task": task})
    return jobs_value


def result_state(kind: str, score: dict[str, Any] | None = None, reason: str | None = None) -> dict[str, Any]:
    if kind not in {"initial", "repaired", "unavailable", "failed"}:
        raise ValueError("Unknown result state")
    if kind in {"initial", "repaired"} and score is None:
        raise ValueError("A scored state needs a score")
    if kind in {"unavailable", "failed"} and (score is not None or not reason):
        raise ValueError("An unscored state needs only a reason")
    return {"kind": kind, "scored": kind in {"initial", "repaired"}, "score": score, "reason": reason}


def repair_prompt(prompt: str, diagnostic: dict[str, Any]) -> str:
    return prompt + "\n\nFEEDBACK\n" + canonical(diagnostic) + "\nReturn one corrected payload. This is the only repair turn."


def mutate_one(value: dict[str, Any], name: str, replacement: Any) -> dict[str, Any]:
    result = deepcopy(value)
    result[name] = replacement
    return result


def mutation_tests() -> list[dict[str, Any]]:
    corpus = make_corpus("calibration")
    results = []
    analysis = corpus["fixtures"]["comprehension-analysis"][0]
    analysis_map = {
        "chord_identity": ("chord_id", "wrong"),
        "root_pitch_class": ("root_pc", (analysis["expected"]["root_pc"] + 1) % 12),
        "bass_pitch_class": ("bass_pc", (analysis["expected"]["bass_pc"] + 1) % 12),
        "chord_quality": ("quality", "minor" if analysis["expected"]["quality"] != "minor" else "major"),
        "inversion_number": ("inversion", (analysis["expected"]["inversion"] + 1) % 4),
        "chord_function": ("function", "V7" if analysis["expected"]["function"] != "V7" else "I"),
        "motif_relation": ("motif_relation", "inversion" if analysis["expected"]["motif_relation"] != "inversion" else "transposition"),
        "rhythm_class": ("rhythm", "moving"),
    }
    for expected_check, (field, replacement) in analysis_map.items():
        checks = score_analysis(mutate_one(analysis["expected"], field, replacement), analysis["expected"])
        failures = sorted(name for name, passed in checks.items() if not passed)
        results.append({"family": analysis["family"], "check": expected_check, "failures": failures, "pass": failures == [expected_check]})

    motif = corpus["fixtures"]["continuation-motif"][0]
    perfect = deepcopy(motif["expected"])
    motif_cases: list[tuple[str, Callable[[list[dict[str, Any]], dict[str, Any]], None]]] = [
        ("output_identity", lambda rows, _: rows[0].__setitem__("id", "wrong")),
        ("operation_formula", lambda rows, _: rows[0].__setitem__("pitch", rows[0]["pitch"] + 1)),
        ("preserved_properties", lambda rows, _: rows[0].__setitem__("velocity", rows[0]["velocity"] + 1)),
        ("operation_specific_fields", lambda _rows, contract: contract.__setitem__("axis", 60)),
    ]
    for expected_check, change in motif_cases:
        rows, contract = deepcopy(perfect), deepcopy(motif["contract"])
        change(rows, contract)
        changed = {**motif, "contract": contract}
        checks = score_motif(rows, changed)
        failures = sorted(name for name, passed in checks.items() if not passed)
        results.append({"family": motif["family"], "check": expected_check, "failures": failures, "pass": failures == [expected_check]})

    progression = corpus["fixtures"]["generation-progression"][0]
    rows = perfect_progression(progression["contract"])
    cases: list[tuple[str, Callable[[list[dict[str, Any]], dict[str, Any]], None]]] = [
        ("chord_starts_and_named_voices", lambda values, _: values.pop()),
        ("duration_and_velocity", lambda values, _: values[0].__setitem__("velocity", values[0]["velocity"] + 1)),
        ("pitch_class_coverage", lambda _values, contract: contract["pitch_classes"][0].append((contract["pitch_classes"][0][0] + 1) % 12)),
        ("bass_inversions", lambda _values, contract: contract["bass_pitch_classes"].__setitem__(0, (contract["bass_pitch_classes"][0] + 1) % 12)),
        ("voice_ranges", lambda _values, contract: contract["voice_ranges"]["soprano"].__setitem__(1, 59)),
        ("strict_voice_order", lambda _values, contract: contract.__setitem__("strict_voice_order", ["soprano", "alto", "tenor", "bass"])),
        ("same_voice_movement", lambda _values, contract: contract.__setitem__("maximum_same_voice_movement", -1)),
        ("cadence", lambda _values, contract: contract["cadence"].__setitem__("final_bass_pc", (contract["cadence"]["final_bass_pc"] + 1) % 12)),
    ]
    for expected_check, change in cases:
        changed_rows, contract = deepcopy(rows), deepcopy(progression["contract"])
        change(changed_rows, contract)
        checks = score_progression(changed_rows, contract)
        failures = sorted(name for name, passed in checks.items() if not passed)
        results.append({"family": progression["family"], "check": expected_check, "failures": failures, "pass": failures == [expected_check]})

    role_task_value = corpus["fixtures"]["continuation-roles"][0]
    role_rows = perfect_roles(role_task_value["contract"])
    role_cases: list[tuple[str, list[dict[str, Any]], dict[str, Any]]] = []
    changed_rows = deepcopy(role_rows)
    changed_rows.pop()
    role_cases.append(("starts_and_density", changed_rows, deepcopy(role_task_value["contract"])))
    changed_rows = deepcopy(role_rows)
    changed_rows[0]["duration"] = "1/2"
    role_cases.append(("duration", changed_rows, deepcopy(role_task_value["contract"])))
    changed_contract = deepcopy(role_task_value["contract"])
    changed_contract["ranges"]["bass"][0] = role_rows[0]["pitch"] + 1
    role_cases.append(("ranges", deepcopy(role_rows), changed_contract))
    changed_contract = deepcopy(role_task_value["contract"])
    changed_contract["harmony_pitch_classes"][0] = [value for value in changed_contract["harmony_pitch_classes"][0] if value != role_rows[0]["pitch"] % 12]
    role_cases.append(("harmony", deepcopy(role_rows), changed_contract))
    changed_contract = deepcopy(role_task_value["contract"])
    changed_contract["maximum_role_leap"] = 0
    role_cases.append(("voice_leading", deepcopy(role_rows), changed_contract))
    collision_rows = deepcopy(role_rows)
    by_start = notes_by_start(collision_rows)
    for group in by_start.values():
        group[1]["pitch"] = group[0]["pitch"]
    changed_contract = deepcopy(role_task_value["contract"])
    changed_contract["ranges"] = {"bass": [24, 90], "lead": [24, 90]}
    changed_contract["maximum_role_leap"] = 24
    changed_contract["cadence_pitch_class"] = collision_rows[-2]["pitch"] % 12
    role_cases.append(("no_collisions", collision_rows, changed_contract))
    changed_contract = deepcopy(role_task_value["contract"])
    changed_contract["cadence_pitch_class"] = (changed_contract["cadence_pitch_class"] + 1) % 12
    role_cases.append(("cadence", deepcopy(role_rows), changed_contract))
    for expected_check, changed_rows, changed_contract in role_cases:
        checks = score_roles(changed_rows, changed_contract)
        failures = sorted(name for name, passed in checks.items() if not passed)
        results.append({"family": role_task_value["family"], "check": expected_check, "failures": failures, "pass": failures == [expected_check]})

    revoice_task_value = corpus["fixtures"]["transformation-revoice"][0]
    revoice_rows = perfect_revoice(revoice_task_value["contract"])
    revoice_cases: list[tuple[str, list[dict[str, Any]], dict[str, Any]]] = []
    changed_rows = deepcopy(revoice_rows)
    changed_rows.pop()
    revoice_cases.append(("note_count_and_starts", changed_rows, deepcopy(revoice_task_value["contract"])))
    changed_rows = deepcopy(revoice_rows)
    changed_rows[0]["id"] = "changed-id"
    revoice_cases.append(("stable_identity", changed_rows, deepcopy(revoice_task_value["contract"])))
    changed_rows = deepcopy(revoice_rows)
    changed_rows[0]["velocity"] += 1
    revoice_cases.append(("preserved_properties", changed_rows, deepcopy(revoice_task_value["contract"])))
    changed_rows = deepcopy(revoice_rows)
    changed_rows[-1]["pitch"] += 1
    revoice_cases.append(("pitch_classes", changed_rows, deepcopy(revoice_task_value["contract"])))
    changed_rows = deepcopy(revoice_rows)
    changed_rows[3]["pitch"] += 12
    revoice_cases.append(("operation", changed_rows, deepcopy(revoice_task_value["contract"])))
    changed_contract = deepcopy(revoice_task_value["contract"])
    changed_contract["voice_ranges"]["soprano"][1] = revoice_rows[-1]["pitch"] - 1
    revoice_cases.append(("range_limits", deepcopy(revoice_rows), changed_contract))
    changed_contract = deepcopy(revoice_task_value["contract"])
    changed_contract["strict_voice_order"] = ["soprano", "alto", "tenor", "bass"]
    revoice_cases.append(("voice_order", deepcopy(revoice_rows), changed_contract))
    for expected_check, changed_rows, changed_contract in revoice_cases:
        checks = score_revoice(changed_rows, changed_contract)
        failures = sorted(name for name, passed in checks.items() if not passed)
        results.append({"family": revoice_task_value["family"], "check": expected_check, "failures": failures, "pass": failures == [expected_check]})

    local = corpus["fixtures"]["transformation-local"][0]
    change = local["change"]
    patch = {"base_sha256": local["base_sha256"], "ops": [{"op": "set", "id": change["note_id"], "changes": {change["field"]: change["value"]}}]}
    compiled = compile_patch(patch, local["source"], local["base_sha256"])
    local_cases = []
    changed_rows = deepcopy(compiled)
    next(row for row in changed_rows if row["id"] == change["note_id"])["velocity"] += 1
    local_cases.append(("canonical_result", changed_rows, deepcopy(patch)))
    changed_rows = deepcopy(compiled)
    changed_rows[0]["id"] = "changed-id"
    local_cases.append(("stable_identity", changed_rows, deepcopy(patch)))
    changed_rows = deepcopy(compiled)
    unrelated = next(row for row in changed_rows if row["id"] != change["note_id"])
    unrelated["pitch"] += 1
    local_cases.append(("exact_preservation", changed_rows, deepcopy(patch)))
    dense_patch = deepcopy(patch)
    other = next(row for row in local["source"] if row["id"] != change["note_id"])
    dense_patch["ops"].append({"op": "set", "id": other["id"], "changes": {"pitch": other["pitch"]}})
    local_cases.append(("sparse_change", deepcopy(compiled), dense_patch))
    for expected_check, changed_rows, changed_patch in local_cases:
        checks = score_local_result(changed_rows, changed_patch, local["source"], local["expected"])
        failures = sorted(name for name, passed in checks.items() if not passed)
        results.append({"family": local["family"], "check": expected_check, "failures": failures, "pass": failures == [expected_check]})

    for family in ("comprehension-structure", "transformation-rhythm"):
        task = corpus["fixtures"][family][0]
        changed_rows = deepcopy(task["expected"])
        changed_rows[0]["velocity"] += 1
        checks = {"exact_relation": projected(changed_rows) == projected(task["expected"])}
        failures = sorted(name for name, passed in checks.items() if not passed)
        results.append({"family": family, "check": "exact_relation", "failures": failures, "pass": failures == ["exact_relation"]})

    structure = corpus["fixtures"]["comprehension-structure"][0]
    for arm in ARMS:
        base, source_id = expected_output_context(structure)
        payload = render_document(arm, make_document(structure["expected"], "wrong-base", source_id))
        scored = score_response(arm, structure, payload)
        failures = sorted(name for name, passed in scored["checks"].items() if not passed)
        results.append({"family": "document", "arm": arm, "check": "document_context", "failures": failures, "pass": failures == ["document_context"] and base != "wrong-base"})

    for family in GUARD_FAMILIES:
        task = corpus["fixtures"][family][0]
        score = score_response("exact-object-json", task, perfect_payload("exact-object-json", task))
        results.append({"family": family, "check": "positive", "failures": [], "pass": score["primary_pass"]})
        negative = score_response("exact-object-json", task, "INVALID")
        results.append({"family": family, "check": "negative", "failures": ["parse"], "pass": not negative["syntax_pass"]})
    return results


def capability_manifest() -> dict[str, Any]:
    return {
        arm: {
            "condition": "candidate" if arm == "compact-bar-fields" else "control",
            "stable_identity": True,
            "one_note_plane": True,
            "optional_overlays": True,
            "exact_preservation": True,
            "sparse_patch": True,
            "base_conflict": True,
            "omission_declaration": True,
            "fields_declaration": arm == "compact-bar-fields",
        }
        for arm in ARMS
    }
