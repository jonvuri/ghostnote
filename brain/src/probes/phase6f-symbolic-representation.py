#!/usr/bin/env python3
"""Compare agent-facing symbolic music representations and exact patches."""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import time
import urllib.request
from collections import defaultdict
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
from typing import Any


SCHEMA = "ghostnote-symbolic-representation-eval-v0"
PATCH_SCHEMA = "ghostnote-note-patch-v0"
OPENAI_MODEL = "gpt-5.4-mini-2026-03-17"
GEMINI_MODEL = "gemini-3.8-flash"
ARMS = ("exact-json", "bar-events", "abc-2.1", "pattern-dsl")
EXACT_FIELDS = (
    "id", "track", "start", "duration", "pitch", "velocity", "channel",
    "muted", "release_velocity", "expression",
)
INSERT_CORE_FIELDS = ("id", "track", "start", "duration", "pitch", "velocity")


def canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def frac(value: str | int | Fraction) -> Fraction:
    return value if isinstance(value, Fraction) else Fraction(str(value))


def ftext(value: Fraction | str | int) -> str:
    result = frac(value)
    return str(result.numerator) if result.denominator == 1 else f"{result.numerator}/{result.denominator}"


def note(
    note_id: str, track: str, start: str | int, duration: str | int,
    pitch: int, velocity: int, channel: int = 0, muted: bool = False,
    release_velocity: int = 64, pressure: str = "0", timbre: str = "0",
    pan: str = "0", gain: str = "1",
) -> dict[str, Any]:
    return {
        "id": note_id, "track": track, "start": ftext(start),
        "duration": ftext(duration), "pitch": pitch, "velocity": velocity,
        "channel": channel, "muted": muted,
        "release_velocity": release_velocity,
        "expression": {
            "pressure": ftext(pressure), "timbre": ftext(timbre),
            "pan": ftext(pan), "gain": ftext(gain),
        },
    }


def fixture(name: str, length: int, tracks: list[dict[str, Any]], notes: list[dict[str, Any]]) -> dict[str, Any]:
    value = {
        "id": name, "meter": "4/4", "length_beats": length,
        "tracks": tracks, "sections": [
            {"id": f"{name}-a", "start": "0", "end": ftext(length // 2)},
            {"id": f"{name}-b", "start": ftext(length // 2), "end": ftext(length)},
        ],
        "notes": sorted(notes, key=lambda row: (frac(row["start"]), row["track"], row["pitch"], row["id"])),
    }
    value["sha256"] = digest(value)
    return value


def make_cohort() -> dict[str, dict[str, Any]]:
    short_tracks = [
        {"id": "short-lead", "role": "lead", "voice": "monophonic"},
        {"id": "short-pad", "role": "harmony", "voice": "polyphonic"},
    ]
    short_notes = [
        note("s-l1", "short-lead", 0, "1/2", 60, 91, pressure="1/10"),
        note("s-l2", "short-lead", "1/2", "1/2", 62, 84, timbre="1/5"),
        note("s-l3", "short-lead", 1, "2/3", 64, 88, pan="-1/10"),
        note("s-l4", "short-lead", "5/3", "1/3", 67, 93, release_velocity=72),
        note("s-l5", "short-lead", "33/16", "15/16", 69, 79, muted=True),
        note("s-p1", "short-pad", 0, "5/2", 48, 70, channel=1),
        note("s-p2", "short-pad", 0, "5/2", 52, 72, channel=1, gain="9/10"),
        note("s-p3", "short-pad", 0, "5/2", 55, 74, channel=1, pan="1/8"),
    ]
    short = fixture("short", 4, short_tracks, short_notes)

    medium_tracks = [
        {"id": "medium-lead", "role": "lead", "voice": "monophonic"},
        {"id": "medium-bass", "role": "bass", "voice": "monophonic"},
        {"id": "medium-pad", "role": "harmony", "voice": "polyphonic"},
    ]
    medium_notes = [
        note("n-a71f", "medium-lead", 0, "1/2", 60, 94, pressure="1/8"),
        note("n-e204", "medium-lead", "1/2", "1/2", 62, 86),
        note("n-4b8d", "medium-lead", 1, "1/2", 64, 89, timbre="1/6"),
        note("n-c392", "medium-lead", "3/2", "1/2", 67, 96),
        note("n-91ab", "medium-lead", 4, "1/2", 72, 92, pressure="1/8"),
        note("n-0fce", "medium-lead", "9/2", "1/2", 74, 84),
        note("n-d663", "medium-lead", 5, "1/2", 76, 87, timbre="1/6"),
        note("n-2a57", "medium-lead", "11/2", "1/2", 79, 94),
        note("n-b80c", "medium-bass", 0, 2, 36, 88, channel=2),
        note("n-13de", "medium-bass", 2, "2/3", 41, 82, channel=2),
        note("n-77a1", "medium-bass", "8/3", "1/3", 43, 85, channel=2),
        note("n-f409", "medium-bass", 3, 1, 38, 90, channel=2),
        note("n-5cd2", "medium-bass", 4, 2, 36, 87, channel=2),
        note("n-aa36", "medium-bass", "97/16", "15/16", 43, 83, channel=2),
        note("n-6e90", "medium-bass", 7, 1, 38, 91, channel=2, release_velocity=70),
        note("n-305b", "medium-pad", 0, "9/2", 48, 68, channel=3),
        note("n-89d4", "medium-pad", 0, "9/2", 52, 70, channel=3, gain="9/10"),
        note("n-f72a", "medium-pad", 0, "9/2", 55, 72, channel=3, pan="1/10"),
        note("n-1cb9", "medium-pad", 4, 4, 50, 66, channel=3),
        note("n-64e3", "medium-pad", 4, 4, 53, 69, channel=3, pressure="1/12"),
        note("n-b517", "medium-pad", 4, 4, 57, 71, channel=3, pan="-1/10"),
    ]
    medium = fixture("medium", 8, medium_tracks, medium_notes)

    long_notes = []
    for repeat in range(4):
        for source in medium_notes:
            copied = deepcopy(source)
            copied["id"] = f"r{repeat + 1}-{source['id']}"
            copied["track"] = source["track"].replace("medium-", "long-")
            copied["start"] = ftext(frac(source["start"]) + repeat * 8)
            long_notes.append(copied)
    long_tracks = [{**row, "id": row["id"].replace("medium-", "long-")} for row in medium_tracks]
    long = fixture("long", 32, long_tracks, long_notes)
    return {row["id"]: row for row in (short, medium, long)}


def bar_position(start: str) -> tuple[int, str]:
    value = frac(start)
    return int(value // 4) + 1, ftext(value % 4)


def render_exact(item: dict[str, Any]) -> str:
    return canonical(item)


def render_bar(item: dict[str, Any]) -> str:
    lines = [
        f"score {item['id']} hash={item['sha256']} meter={item['meter']} length={item['length_beats']}b",
        "fields: id track bar+offset dur=duration pitch velocity mute",
        "absolute start = (bar - 1) * 4 + offset",
        "host-only channel, release velocity, and note expression are omitted",
    ]
    lines.extend(
        f"track {value['id']} role={value['role']} voice={value['voice']}"
        for value in item["tracks"]
    )
    lines.extend(
        f"region {value['id']} start={value['start']} end={value['end']}"
        for value in item["sections"]
    )
    for value in item["notes"]:
        bar, offset = bar_position(value["start"])
        lines.append(
            f"{value['id']} {value['track']} b{bar}+{offset} dur={value['duration']} "
            f"p{value['pitch']} v{value['velocity']} mute={str(value['muted']).lower()}"
        )
    return "\n".join(lines)


ABC_NAMES = ("C", "^C", "D", "_E", "E", "F", "^F", "G", "_A", "A", "_B", "B")


def abc_pitch(pitch: int) -> str:
    octave = pitch // 12 - 1
    name = ABC_NAMES[pitch % 12]
    if octave >= 5:
        name = name.lower() + "'" * (octave - 5)
    elif octave < 4:
        name += "," * (4 - octave)
    return name


def render_abc(item: dict[str, Any]) -> str:
    lines = [
        f"X:{item['id']}", f"T:Generated {item['id']} fixture", "M:4/4", "L:1/48", "K:C",
        "% Synchronized voices. Starts round to 1/12 beat. Durations round to 1/48 beat.",
        "% IDs, velocity, mute, release velocity, and note expression are omitted.",
    ]
    grouped: dict[str, dict[Fraction, list[dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))
    for value in item["notes"]:
        grouped[value["track"]][frac(value["start"])].append(value)
    for track in item["tracks"]:
        track_id = track["id"]
        lines.append(f"V:{track_id} name=\"{track['role']}\"")
        tokens = []
        cursor = Fraction(0)
        for start, values in sorted(grouped[track_id].items()):
            rounded = Fraction(round(float(start) * 12), 12)
            if rounded > cursor:
                tokens.append(f"z{int((rounded - cursor) * 48)}")
            pitches = "".join(abc_pitch(value["pitch"]) for value in values)
            pitch_token = pitches if len(values) == 1 else f"[{pitches}]"
            duration = min(frac(value["duration"]) for value in values)
            units = max(1, round(float(duration) * 48))
            tokens.append(f"{pitch_token}{units}")
            cursor = max(cursor, rounded + Fraction(units, 48))
            if cursor.denominator == 1 and cursor % 4 == 0:
                tokens.append("|")
        lines.append(f"[V:{track_id}] " + " ".join(tokens))
    return "\n".join(lines)


def render_pattern(item: dict[str, Any]) -> str:
    lines = [
        f"project {item['id']} hash {item['sha256']} meter {item['meter']} length {item['length_beats']}",
        "note(id,track,start,duration,pitch,velocity,muted)",
        "host-only channel, release velocity, and note expression are omitted",
    ]
    lines.extend(
        f"track {value['id']} role {value['role']} voice {value['voice']}"
        for value in item["tracks"]
    )
    lines.extend(
        f"region {value['id']} [{value['start']},{value['end']})"
        for value in item["sections"]
    )
    if item["id"] == "medium":
        lines.append(
            "motif lead-cell relative=[0:0:1/2,1/2:2:1/2,1:4:1/2,3/2:7:1/2] "
            "medium-occurrences=[n-a71f,n-e204,n-4b8d,n-c392],[n-91ab,n-0fce,n-d663,n-2a57] transpose=12"
        )
    if item["id"] == "long":
        base = make_cohort()["medium"]
        lines.append("pattern block =")
        for value in base["notes"]:
            lines.append("  " + canonical([
                value["id"], value["track"], value["start"], value["duration"], value["pitch"],
                value["velocity"], value["muted"],
            ]))
        for repeat in range(4):
            lines.append(
                f"use block at {repeat * 8} id-prefix=r{repeat + 1}- "
                "track-prefix medium->long"
            )
        return "\n".join(lines)
    for value in item["notes"]:
        lines.append("note" + canonical([
            value["id"], value["track"], value["start"], value["duration"], value["pitch"],
            value["velocity"], value["muted"],
        ]))
    return "\n".join(lines)


def representations(cohort: dict[str, dict[str, Any]]) -> dict[str, dict[str, str]]:
    renderers = {
        "exact-json": render_exact, "bar-events": render_bar,
        "abc-2.1": render_abc, "pattern-dsl": render_pattern,
    }
    return {arm: {name: renderer(item) for name, item in cohort.items()} for arm, renderer in renderers.items()}


def expected_structure(item: dict[str, Any]) -> dict[str, Any]:
    grouped: dict[Fraction, list[dict[str, Any]]] = defaultdict(list)
    for value in item["notes"]:
        grouped[frac(value["start"])].append(value)
    overlap = []
    notes = item["notes"]
    for index, first in enumerate(notes):
        for second in notes[index + 1:]:
            if first["track"] != second["track"]:
                continue
            if frac(first["start"]) < frac(second["start"]) + frac(second["duration"]) and frac(second["start"]) < frac(first["start"]) + frac(first["duration"]):
                overlap.append(sorted([first["id"], second["id"]]))
    return {
        "note_count": len(notes),
        "polyphonic_onset_count": sum(len(values) > 1 for values in grouped.values()),
        "triplet_note_ids": sorted(value["id"] for value in notes if frac(value["start"]).denominator == 3 or frac(value["duration"]).denominator == 3),
        "off_grid_note_ids": sorted(value["id"] for value in notes if (frac(value["start"]) * 12).denominator != 1),
        "repeated_motif_note_ids": [["n-a71f", "n-e204", "n-4b8d", "n-c392"], ["n-91ab", "n-0fce", "n-d663", "n-2a57"]],
        "overlap_pairs": sorted(overlap),
    }


def invalid_patch(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": PATCH_SCHEMA, "base_sha256": "stale",
        "ops": [
            {"op": "move", "note_id": "n-ffff", "start": "1/3"},
            {"op": "move", "note_id": "n-a71f", "start": "-1"},
        ],
    }


def task_prompt(arm: str, rendered: dict[str, str], cohort: dict[str, dict[str, Any]]) -> str:
    medium = cohort["medium"]
    return f"""You test the {arm} symbolic representation. Use only the supplied text.
Return one JSON object and no markdown. Do not call omitted data preserved. Exact host state stays outside your response.

Return these keys:
- structural: note_count, polyphonic_onset_count, triplet_note_ids, off_grid_note_ids, repeated_motif_note_ids, overlap_pairs for medium. A polyphonic onset has two or more notes at the same start on any track. A triplet note has a start or duration with denominator 3 after reduction. Off-grid means that start times 12 is not an integer; do not call triplets off-grid when they are on this 1/12-beat grid. A repeated motif has equal relative starts, durations, and pitch intervals under transposition. An overlap pair contains two notes on the same track whose half-open time ranges intersect, including notes with the same onset.
- reconstruction: status (exact or unavailable), notes, and omitted_fields. Reconstruct SHORT only. Each note needs id, track, start, duration, pitch, velocity, channel, muted, release_velocity, and expression with pressure, timbre, pan, and gain. If the representation omits any exact field, use unavailable, return no notes, and list the omitted fields.
- local_patch: use schema {PATCH_SCHEMA}, base_sha256, and ops. Transpose only the medium-lead notes in bar 2 up 12 semitones. Resolve their note IDs from the representation.
- semantic_patch: delete only the middle pitch of the medium-pad chord in bar 2. Keep the other notes and all their fields.
- continuation_patch: insert exactly four medium-bass notes at beats 8, 9, 10, and 11. Use IDs new-b1 through new-b4, durations of 1 beat, MIDI pitches 36 through 60, and velocity 1 through 127. The insert op must set default_policy to track-neutral-v0. Do not return channel, mute, release velocity, or expression. The compiler takes channel from the target track and sets mute false, release velocity 64, pressure 0, timbre 0, pan 0, and gain 1.
- invalid_patch_echo: copy the supplied invalid patch without repair. It is a validator fixture.
All valid patches must use base_sha256 {medium['sha256']}. Use only transpose, delete, insert, or move operations. A transpose op has note_ids and semitones. A delete op has note_ids. An insert op has default_policy and notes. A move op has note_id and start. Use rational strings for time. Existing-note operations preserve every field not named by the operation.

Invalid patch fixture:
{canonical(invalid_patch(medium))}

SHORT
{rendered['short']}

MEDIUM
{rendered['medium']}

LONG
{rendered['long']}
"""


def parse_json_text(text: str) -> dict[str, Any]:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        if stripped.startswith("json"):
            stripped = stripped[4:]
    start, end = stripped.find("{"), stripped.rfind("}")
    if start < 0 or end < start:
        raise ValueError("response did not contain a JSON object")
    value = json.loads(stripped[start:end + 1])
    if not isinstance(value, dict):
        raise ValueError("response was not a JSON object")
    return value


def patch_errors(patch: Any, base: dict[str, Any]) -> list[str]:
    errors = []
    if not isinstance(patch, dict):
        return ["patch is not an object"]
    if patch.get("schema") != PATCH_SCHEMA:
        errors.append(f"schema must be {PATCH_SCHEMA}")
    if patch.get("base_sha256") != base["sha256"]:
        errors.append(f"base_sha256 must be {base['sha256']}")
    notes = {value["id"]: value for value in base["notes"]}
    seen_insert_ids = set(notes)
    operations = patch.get("ops")
    if not isinstance(operations, list):
        errors.append("ops must be a list")
        return errors
    for index, operation in enumerate(operations):
        if not isinstance(operation, dict):
            errors.append(f"op {index} is not an object")
            continue
        name = operation.get("op")
        if name in {"transpose", "delete"}:
            ids = operation.get("note_ids")
            if not isinstance(ids, list) or not ids:
                errors.append(f"op {index} note_ids must be a non-empty list")
                continue
            for note_id in ids:
                if note_id not in notes:
                    errors.append(f"op {index} unknown note ID {note_id}")
            if name == "transpose" and not isinstance(operation.get("semitones"), int):
                errors.append(f"op {index} semitones must be an integer")
            elif name == "transpose":
                for note_id in ids:
                    if note_id in notes and not 0 <= notes[note_id]["pitch"] + operation["semitones"] <= 127:
                        errors.append(f"op {index} transposed pitch is outside MIDI range")
        elif name == "move":
            note_id = operation.get("note_id")
            if note_id not in notes:
                errors.append(f"op {index} unknown note ID {note_id}")
            try:
                start = frac(operation.get("start"))
                if start < 0:
                    errors.append(f"op {index} start is below 0")
            except (TypeError, ValueError, ZeroDivisionError):
                errors.append(f"op {index} start is not rational")
        elif name == "insert":
            values = operation.get("notes")
            if not isinstance(values, list) or not values:
                errors.append(f"op {index} notes must be a non-empty list")
                continue
            if operation.get("default_policy") != "track-neutral-v0":
                errors.append(f"op {index} must use default_policy track-neutral-v0")
            for value in values:
                if not isinstance(value, dict):
                    errors.append(f"op {index} inserted note is not an object")
                    continue
                missing = [field for field in INSERT_CORE_FIELDS if field not in value]
                if missing:
                    errors.append(f"op {index} inserted note misses {','.join(missing)}")
                    continue
                forbidden = [field for field in ("channel", "muted", "release_velocity", "expression") if field in value]
                if forbidden:
                    errors.append(f"op {index} must omit host-only fields {','.join(forbidden)}")
                if value["id"] in seen_insert_ids:
                    errors.append(f"op {index} duplicate note ID {value['id']}")
                seen_insert_ids.add(value["id"])
                if value["track"] not in {row["id"] for row in base["tracks"]}:
                    errors.append(f"op {index} inserted note has unknown track {value['track']}")
                if not isinstance(value["pitch"], int) or not 0 <= value["pitch"] <= 127:
                    errors.append(f"op {index} inserted pitch is outside MIDI range")
                if not isinstance(value["velocity"], int) or not 1 <= value["velocity"] <= 127:
                    errors.append(f"op {index} inserted velocity is outside MIDI range")
                try:
                    if frac(value["start"]) < 0 or frac(value["duration"]) <= 0:
                        errors.append(f"op {index} inserted note has invalid time")
                except (TypeError, ValueError, ZeroDivisionError):
                    errors.append(f"op {index} inserted note time is not rational")
        else:
            errors.append(f"op {index} has unsupported operation {name}")
    return errors


def compile_patch(patch: dict[str, Any], base: dict[str, Any]) -> list[dict[str, Any]]:
    errors = patch_errors(patch, base)
    if errors:
        raise ValueError("; ".join(errors))
    notes = {value["id"]: deepcopy(value) for value in base["notes"]}
    for operation in patch["ops"]:
        if operation["op"] == "transpose":
            for note_id in operation["note_ids"]:
                notes[note_id]["pitch"] += operation["semitones"]
        elif operation["op"] == "delete":
            for note_id in operation["note_ids"]:
                notes.pop(note_id)
        elif operation["op"] == "move":
            notes[operation["note_id"]]["start"] = ftext(operation["start"])
        elif operation["op"] == "insert":
            for value in operation["notes"]:
                normalized = deepcopy(value)
                normalized["start"] = ftext(normalized["start"])
                normalized["duration"] = ftext(normalized["duration"])
                if operation.get("default_policy") == "track-neutral-v0":
                    channels = {row["channel"] for row in base["notes"] if row["track"] == normalized["track"]}
                    if len(channels) != 1:
                        raise ValueError("track-neutral-v0 needs one source channel")
                    normalized.update({
                        "channel": channels.pop(), "muted": False, "release_velocity": 64,
                        "expression": {"pressure": "0", "timbre": "0", "pan": "0", "gain": "1"},
                    })
                else:
                    normalized["expression"] = {key: ftext(raw) for key, raw in normalized["expression"].items()}
                notes[normalized["id"]] = normalized
    result = sorted(notes.values(), key=lambda row: (frac(row["start"]), row["track"], row["pitch"], row["id"]))
    for index, first in enumerate(result):
        for second in result[index + 1:]:
            if first["track"] != second["track"] or first["pitch"] != second["pitch"]:
                continue
            if frac(first["start"]) < frac(second["start"]) + frac(second["duration"]) and frac(second["start"]) < frac(first["start"]) + frac(first["duration"]):
                raise ValueError(f"notes {first['id']} and {second['id']} collide")
    return result


def diff_notes(expected: list[dict[str, Any]], actual: Any) -> list[dict[str, Any]]:
    if not isinstance(actual, list):
        return [{"kind": "notes-not-list"}]
    expected_by_id = {row["id"]: row for row in expected}
    actual_by_id = {row.get("id"): row for row in actual if isinstance(row, dict) and row.get("id")}
    diffs = []
    for note_id in sorted(expected_by_id.keys() | actual_by_id.keys()):
        if note_id not in actual_by_id:
            diffs.append({"note_id": note_id, "kind": "missing-note"})
        elif note_id not in expected_by_id:
            diffs.append({"note_id": note_id, "kind": "extra-note"})
        else:
            for field in EXACT_FIELDS:
                if actual_by_id[note_id].get(field) != expected_by_id[note_id].get(field):
                    diffs.append({
                        "note_id": note_id, "field": field,
                        "expected": expected_by_id[note_id].get(field),
                        "actual": actual_by_id[note_id].get(field),
                    })
    return diffs


def score_structure(actual: Any, expected: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(actual, dict):
        return {"correct": 0, "total": len(expected), "differences": ["structural is not an object"]}
    differences = []
    for key, value in expected.items():
        observed = actual.get(key)
        if key in {"triplet_note_ids", "off_grid_note_ids"} and isinstance(observed, list):
            observed = sorted(observed)
        if key in {"repeated_motif_note_ids", "overlap_pairs"} and isinstance(observed, list):
            observed = sorted(sorted(group) for group in observed if isinstance(group, list))
            value = sorted(sorted(group) for group in value)
        if observed != value:
            differences.append({"field": key, "expected": value, "actual": observed})
    return {"correct": len(expected) - len(differences), "total": len(expected), "differences": differences}


def expected_local(base: dict[str, Any]) -> list[dict[str, Any]]:
    result = deepcopy(base["notes"])
    for value in result:
        if value["id"] in {"n-91ab", "n-0fce", "n-d663", "n-2a57"}:
            value["pitch"] += 12
    return result


def score_patch(name: str, patch: Any, base: dict[str, Any]) -> dict[str, Any]:
    errors = patch_errors(patch, base)
    if errors:
        return {"valid": False, "errors": errors, "constraints_passed": 0, "constraints_total": 1}
    try:
        compiled = compile_patch(patch, base)
    except ValueError as error:
        return {"valid": False, "errors": [str(error)], "constraints_passed": 0, "constraints_total": 1}
    if name == "local_patch":
        differences = diff_notes(expected_local(base), compiled)
        return {
            "valid": True, "errors": [], "constraints_passed": int(not differences),
            "constraints_total": 1, "differences": differences,
        }
    before = {row["id"]: row for row in base["notes"]}
    after = {row["id"]: row for row in compiled}
    if name == "semantic_patch":
        expected_ids = set(before) - {"n-64e3"}
        checks = [set(after) == expected_ids]
        differences = diff_notes([before[note_id] for note_id in sorted(expected_ids)], compiled)
        checks.append(not differences)
        return {
            "valid": True, "errors": [], "constraints_passed": sum(checks),
            "constraints_total": len(checks), "differences": differences,
        }
    inserted = [row for row in compiled if row["id"].startswith("new-")]
    checks = [
        {row["id"] for row in inserted} == {"new-b1", "new-b2", "new-b3", "new-b4"},
        sorted(frac(row["start"]) for row in inserted) == [Fraction(8), Fraction(9), Fraction(10), Fraction(11)],
        all(row["track"] == "medium-bass" and frac(row["duration"]) == 1 for row in inserted),
        all(36 <= row["pitch"] <= 60 and 1 <= row["velocity"] <= 127 for row in inserted),
        all(row["channel"] == 2 and row["muted"] is False and row["release_velocity"] == 64 for row in inserted),
        all(set(row["expression"]) == {"pressure", "timbre", "pan", "gain"} for row in inserted),
        all(after[note_id] == value for note_id, value in before.items()),
    ]
    return {
        "valid": True, "errors": [], "constraints_passed": sum(checks),
        "constraints_total": len(checks),
    }


def validate_initial(result: dict[str, Any], cohort: dict[str, dict[str, Any]]) -> dict[str, Any]:
    required = {"structural", "reconstruction", "local_patch", "semantic_patch", "continuation_patch", "invalid_patch_echo"}
    missing = sorted(required - result.keys())
    reconstruction = result.get("reconstruction", {})
    reconstruction_differences = diff_notes(cohort["short"]["notes"], reconstruction.get("notes"))
    echo_errors = patch_errors(result.get("invalid_patch_echo"), cohort["medium"])
    return {
        "schema_valid": not missing,
        "missing_keys": missing,
        "structure": score_structure(result.get("structural"), expected_structure(cohort["medium"])),
        "reconstruction": {
            "claimed_status": reconstruction.get("status"),
            "omitted_fields": reconstruction.get("omitted_fields"),
            "exact": not reconstruction_differences,
            "differences": reconstruction_differences,
        },
        "local_patch": score_patch("local_patch", result.get("local_patch"), cohort["medium"]),
        "semantic_patch": score_patch("semantic_patch", result.get("semantic_patch"), cohort["medium"]),
        "continuation_patch": score_patch("continuation_patch", result.get("continuation_patch"), cohort["medium"]),
        "invalid_patch_errors": echo_errors,
        "invalid_patch_exposed_all_errors": (
            any("base_sha256" in value for value in echo_errors)
            and any("unknown note ID" in value for value in echo_errors)
            and any("below 0" in value for value in echo_errors)
        ),
    }


def repair_prompt(errors: list[str], base: dict[str, Any]) -> str:
    return (
        "The deterministic validator rejected invalid_patch_echo. Repair its intended effect: "
        "move existing note n-a71f to beat 1/3. Return only one JSON patch with schema, "
        f"base_sha256, and ops. Preserve all other notes. Validator errors: {canonical(errors)}. "
        f"Required base_sha256: {base['sha256']}"
    )


def score_repair(patch: dict[str, Any], base: dict[str, Any]) -> dict[str, Any]:
    errors = patch_errors(patch, base)
    if errors:
        return {"valid": False, "correct": False, "errors": errors}
    try:
        compiled = compile_patch(patch, base)
    except ValueError as error:
        return {"valid": False, "correct": False, "errors": [str(error)]}
    expected = deepcopy(base["notes"])
    for value in expected:
        if value["id"] == "n-a71f":
            value["start"] = "1/3"
    differences = diff_notes(expected, compiled)
    return {"valid": True, "correct": not differences, "errors": [], "differences": differences}


def load_env(path: Path) -> dict[str, str]:
    result = {}
    for line in path.read_text().splitlines():
        if line.strip() and not line.lstrip().startswith("#") and "=" in line:
            name, value = line.split("=", 1)
            result[name.strip()] = value.strip().strip("'\"")
    return result


def post_json(url: str, headers: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
    request = urllib.request.Request(
        url, data=canonical(payload).encode(), method="POST",
        headers={"Content-Type": "application/json", **headers},
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.load(response)


def model_call(provider: str, key: str, messages: list[dict[str, str]], max_tokens: int) -> tuple[dict[str, Any], dict[str, Any]]:
    if provider == "openai":
        raw = post_json(
            "https://api.openai.com/v1/chat/completions",
            {"Authorization": f"Bearer {key}"},
            {
                "model": OPENAI_MODEL,
                "messages": messages,
                "response_format": {"type": "json_object"},
                "reasoning_effort": "low",
                "max_completion_tokens": max_tokens,
            },
        )
        return parse_json_text(raw["choices"][0]["message"]["content"]), raw
    contents = []
    for message in messages:
        role = "model" if message["role"] == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": message["content"]}]})
    raw = post_json(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
        {"x-goog-api-key": key},
        {
            "contents": contents,
            "generationConfig": {
                "temperature": 0, "responseMimeType": "application/json",
                "maxOutputTokens": max_tokens,
                "thinkingConfig": {"thinkingLevel": "low"},
            },
        },
    )
    text = "".join(part.get("text", "") for part in raw["candidates"][0]["content"]["parts"])
    return parse_json_text(text), raw


def usage(provider: str, raw: dict[str, Any]) -> dict[str, int]:
    if provider == "openai":
        source = raw.get("usage", {})
        return {
            "input_tokens": source.get("prompt_tokens", 0),
            "output_tokens": source.get("completion_tokens", 0),
            "cached_input_tokens": source.get("prompt_tokens_details", {}).get("cached_tokens", 0),
        }
    source = raw.get("usageMetadata", {})
    return {
        "input_tokens": source.get("promptTokenCount", 0),
        "output_tokens": source.get("candidatesTokenCount", 0) + source.get("thoughtsTokenCount", 0),
        "cached_input_tokens": source.get("cachedContentTokenCount", 0),
    }


def returned_model(provider: str, raw: dict[str, Any]) -> str | None:
    return raw.get("model") if provider == "openai" else raw.get("modelVersion")


def run_provider(provider: str, env_file: Path) -> dict[str, Any]:
    environment = load_env(env_file)
    key_name = "OPENAI_API_KEY" if provider == "openai" else "GEMINI_API_KEY"
    if not environment.get(key_name):
        raise ValueError(f"{key_name} is missing")
    cohort = make_cohort()
    views = representations(cohort)
    results = []
    for arm in ARMS:
        prompt = task_prompt(arm, views[arm], cohort)
        started = time.perf_counter()
        initial, raw_initial = model_call(provider, environment[key_name], [{"role": "user", "content": prompt}], 12000)
        initial_ms = (time.perf_counter() - started) * 1000
        validation = validate_initial(initial, cohort)
        repair_text = repair_prompt(validation["invalid_patch_errors"], cohort["medium"])
        started = time.perf_counter()
        repaired, raw_repair = model_call(provider, environment[key_name], [
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": canonical(initial)},
            {"role": "user", "content": repair_text},
        ], 2000)
        repair_ms = (time.perf_counter() - started) * 1000
        note_count = sum(len(item["notes"]) for item in cohort.values())
        bar_count = sum(item["length_beats"] // 4 for item in cohort.values())
        input_usage = usage(provider, raw_initial)
        repair_usage = usage(provider, raw_repair)
        results.append({
            "arm": arm,
            "representation": {
                name: {
                    "sha256": hashlib.sha256(text.encode()).hexdigest(),
                    "utf8_bytes": len(text.encode()), "characters": len(text),
                    "notes": len(cohort[name]["notes"]), "bars": cohort[name]["length_beats"] // 4,
                } for name, text in views[arm].items()
            },
            "initial": {
                "latency_ms": initial_ms, "usage": input_usage,
                "input_tokens_per_note": input_usage["input_tokens"] / note_count,
                "input_tokens_per_bar": input_usage["input_tokens"] / bar_count,
                "returned_model": returned_model(provider, raw_initial),
                "request_id": raw_initial.get("id"), "result": initial,
                "validation": validation,
            },
            "repair": {
                "turns": 1, "total_calls": 2, "latency_ms": repair_ms,
                "usage": repair_usage, "returned_model": returned_model(provider, raw_repair),
                "request_id": raw_repair.get("id"), "result": repaired,
                "validation": score_repair(repaired, cohort["medium"]),
            },
        })
    return {
        "schema": SCHEMA, "provider": provider,
        "requested_model": OPENAI_MODEL if provider == "openai" else GEMINI_MODEL,
        "client": "Python urllib.request direct HTTPS",
        "model_settings": {"reasoning_or_thinking": "low", "temperature": None if provider == "openai" else 0},
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "privacy": "Synthetic generated symbolic notes only. No Files API upload.",
        "cohort": {
            name: {"sha256": item["sha256"], "notes": len(item["notes"]), "bars": item["length_beats"] // 4}
            for name, item in cohort.items()
        },
        "results": results,
    }


def summarize(files: list[Path]) -> dict[str, Any]:
    runs = [json.loads(path.read_text()) for path in files]
    rows = []
    for run in runs:
        for item in run["results"]:
            validation = item["initial"]["validation"]
            patches = [validation[name] for name in ("local_patch", "semantic_patch", "continuation_patch")]
            rows.append({
                "provider": run["provider"], "model": item["initial"]["returned_model"], "arm": item["arm"],
                "schema_valid": validation["schema_valid"],
                "structure_correct": validation["structure"]["correct"],
                "structure_total": validation["structure"]["total"],
                "reconstruction_status": validation["reconstruction"]["claimed_status"],
                "reconstruction_exact": validation["reconstruction"]["exact"],
                "reconstruction_difference_count": len(validation["reconstruction"]["differences"]),
                "patches_schema_valid": sum(value["valid"] for value in patches),
                "patches_schema_total": len(patches),
                "constraints_passed": sum(value["constraints_passed"] for value in patches),
                "constraints_total": sum(value["constraints_total"] for value in patches),
                "invalid_errors_exposed": validation["invalid_patch_exposed_all_errors"],
                "repair_correct": item["repair"]["validation"]["correct"],
                "input_tokens": item["initial"]["usage"]["input_tokens"],
                "output_tokens": item["initial"]["usage"]["output_tokens"],
                "initial_latency_ms": item["initial"]["latency_ms"],
                "repair_latency_ms": item["repair"]["latency_ms"],
            })
    return {"schema": SCHEMA, "source_files": [str(path) for path in files], "rows": rows}


def self_test() -> dict[str, Any]:
    cohort = make_cohort()
    assert len(cohort["short"]["notes"]) == 8
    assert len(cohort["medium"]["notes"]) == 21
    assert len(cohort["long"]["notes"]) == 84
    assert len({item["sha256"] for item in cohort.values()}) == 3
    views = representations(cohort)
    assert set(views) == set(ARMS)
    assert "omitted" in views["abc-2.1"]["short"]
    valid = {
        "schema": PATCH_SCHEMA, "base_sha256": cohort["medium"]["sha256"],
        "ops": [{"op": "transpose", "note_ids": ["n-91ab", "n-0fce", "n-d663", "n-2a57"], "semitones": 12}],
    }
    assert not patch_errors(valid, cohort["medium"])
    assert not diff_notes(expected_local(cohort["medium"]), compile_patch(valid, cohort["medium"]))
    insertion = {
        "schema": PATCH_SCHEMA, "base_sha256": cohort["medium"]["sha256"],
        "ops": [{"op": "insert", "default_policy": "track-neutral-v0", "notes": [
            {"id": "new-test", "track": "medium-bass", "start": "8", "duration": "1", "pitch": 40, "velocity": 80},
        ]}],
    }
    assert not patch_errors(insertion, cohort["medium"])
    inserted = next(value for value in compile_patch(insertion, cohort["medium"]) if value["id"] == "new-test")
    assert inserted["channel"] == 2 and inserted["expression"]["gain"] == "1"
    assert patch_errors({"schema": PATCH_SCHEMA, "base_sha256": cohort["medium"]["sha256"], "ops": None}, cohort["medium"])[-1] == "ops must be a list"
    collision = deepcopy(insertion)
    collision["ops"][0]["notes"][0].update({"start": "0", "pitch": 36})
    try:
        compile_patch(collision, cohort["medium"])
    except ValueError as error:
        assert "collide" in str(error)
    else:
        raise AssertionError("same-pitch overlap did not refuse")
    out_of_range = deepcopy(insertion)
    out_of_range["ops"][0]["notes"][0]["pitch"] = 128
    assert any("outside MIDI range" in error for error in patch_errors(out_of_range, cohort["medium"]))
    no_policy = deepcopy(insertion)
    no_policy["ops"][0].pop("default_policy")
    assert any("default_policy" in error for error in patch_errors(no_policy, cohort["medium"]))
    errors = patch_errors(invalid_patch(cohort["medium"]), cohort["medium"])
    assert len(errors) == 3
    assert expected_structure(cohort["medium"])["off_grid_note_ids"] == ["n-aa36"]
    return {
        "passed": 16, "cohort_sha256": digest({name: item["sha256"] for name, item in cohort.items()}),
        "representation_sha256": digest({arm: {name: hashlib.sha256(text.encode()).hexdigest() for name, text in values.items()} for arm, values in views.items()}),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", choices=("openai", "gemini"))
    parser.add_argument("--env-file", type=Path, default=Path(".env"))
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--summarize", nargs="*", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.self_test:
        result = self_test()
    elif args.summarize:
        result = summarize(args.summarize)
    elif args.provider:
        result = run_provider(args.provider, args.env_file)
    else:
        parser.error("select --self-test, --provider, or --summarize")
    rendered = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(rendered)
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
