#!/usr/bin/env python3
"""Compare established symbolic music forms with renamed controls."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import platform
import re
import time
import urllib.error
from copy import deepcopy
from pathlib import Path
from typing import Any, Callable


BASE_PATH = Path(__file__).with_name("phase6f-symbolic-representation.py")
BASE_SPEC = importlib.util.spec_from_file_location("phase6f_base", BASE_PATH)
if BASE_SPEC is None or BASE_SPEC.loader is None:
    raise RuntimeError(f"Cannot load {BASE_PATH}")
base = importlib.util.module_from_spec(BASE_SPEC)
BASE_SPEC.loader.exec_module(base)

SCHEMA = "ghostnote-symbolic-familiarity-eval-v0"
ARMS = ("bar-events", "midi-like", "remi-plus", "octuple-midi", "synchronized-abc")
SYNTAXES = ("published", "renamed")
INSTRUCTION_LEVELS = ("zero-shot", "grammar")
CORE_FIELDS = ("id", "track", "start", "duration", "pitch", "velocity")
TASK_PATCHES = ("transform_patch", "transfer_patch", "continuation_patch")

TOKEN_MAPS = {
    "bar-events": {
        "SCORE": "KAV", "HASH": "KAZ", "TEMPO": "KUV", "BAR": "KEX", "START": "KIP", "LENGTH": "KOF",
        "METER": "KUG", "HARMONY": "KYB", "TRACK": "KAD", "ROLE": "KEF",
        "VOICE": "KIG", "NOTE": "KOL", "POSITION": "KUM", "DURATION": "KYN",
        "PITCH": "KAP", "VELOCITY": "KER",
    },
    "midi-like": {
        "SCORE": "JAV", "HASH": "JAZ", "TEMPO": "JUV", "BAR": "JEX", "ABS_BEAT": "JIP", "TIME_SIGNATURE": "JOF",
        "HARMONY": "JUG", "TRACK": "JYB", "ROLE": "JAD", "VOICE": "JEF",
        "TIME_SHIFT": "JIG", "NOTE_ID": "JOL", "VELOCITY": "JUM",
        "NOTE_ON": "JYN", "NOTE_OFF": "JAP",
    },
    "remi-plus": {
        "SCORE": "RAV", "HASH": "RAZ", "TEMPO": "RUV", "Bar": "REX", "Start": "RIP", "TimeSig": "ROF",
        "Chord": "RUG", "Track": "RYB", "Role": "RAD", "Voice": "REF",
        "Position": "RIG", "NoteID": "ROL", "Pitch": "RUM", "Velocity": "RYN",
        "Duration": "RAP",
    },
    "octuple-midi": {
        "SCORE": "OAV", "HASH": "OAZ", "BAR_META": "OEX", "START": "OIP", "METER": "OOF",
        "TEMPO": "OUG", "HARMONY": "OYB", "TRACK_META": "OAD", "ROLE": "OEF",
        "VOICE": "OIG", "NOTE": "OOL", "BAR": "OUM", "POSITION": "OYN",
        "TRACK": "OAP", "ID": "OER", "PITCH": "OIT", "DURATION": "OOV",
        "VELOCITY": "OUX", "TIMESIG": "OYZ",
    },
    "synchronized-abc": {
        "X": "AAV", "T": "AEX", "L": "AIP", "Q": "AOF", "M": "AUG",
        "K": "AYB", "V": "AAD", "NAME": "AEF", "VOICE": "AIG",
        "BAR": "AOL", "START": "AUM", "METER": "AYN", "HARMONY": "AAP",
        "GN": "AER", "ID": "AIT", "TRACK": "AOV", "DURATION": "AUX",
        "VELOCITY": "AYZ", "PITCH": "ABR", "ABC": "ACD",
    },
}


def canonical(value: Any) -> str:
    return base.canonical(value)


def digest(value: Any) -> str:
    return base.digest(value)


def make_note(
    note_id: str, track: str, start: str | int, duration: str | int,
    pitch: int, velocity: int, channel: int,
) -> dict[str, Any]:
    return base.note(note_id, track, start, duration, pitch, velocity, channel=channel)


def medium_notes() -> list[dict[str, Any]]:
    notes = [
        make_note("l-01", "lead", 0, 1, 67, 92, 0),
        make_note("l-02", "lead", "49/48", "47/48", 71, 86, 0),
        make_note("l-03", "lead", 2, "2/3", 74, 90, 0),
        make_note("l-04", "lead", "8/3", "1/3", 76, 94, 0),
        make_note("l-05", "lead", 4, 1, 71, 91, 0),
        make_note("l-06", "lead", 5, 1, 70, 88, 0),
        make_note("l-07", "lead", 6, 1, 68, 90, 0),
        make_note("l-08", "lead", 7, 1, 67, 87, 0),
        make_note("l-09", "lead", 8, 1, 69, 89, 0),
        make_note("l-10", "lead", 9, 1, 72, 86, 0),
        make_note("l-11", "lead", 10, 1, 76, 91, 0),
        make_note("l-12", "lead", 11, "5/4", 74, 90, 0),
        make_note("l-13", "lead", "49/4", "3/4", 72, 87, 0),
        make_note("l-14", "lead", 13, 1, 67, 89, 0),
        make_note("l-15", "lead", 14, 2, 65, 84, 0),
        make_note("b-01", "bass", 0, 4, 36, 82, 1),
        make_note("b-02", "bass", 4, 4, 40, 84, 1),
        make_note("b-03", "bass", 8, 3, 45, 80, 1),
        make_note("b-04", "bass", 11, 5, 38, 83, 1),
    ]
    chords = (
        (0, 4, (48, 55, 59, 62, 66), "k1"),
        (4, 4, (52, 56, 62, 65, 70), "k2"),
        (8, 3, (45, 52, 55, 59, 62), "k3"),
        (11, 5, (50, 55, 60, 65, 70), "k4"),
    )
    for start, duration, pitches, prefix in chords:
        notes.extend(
            make_note(f"{prefix}-{index + 1}", "keys", start, duration, pitch, 68 + index, 2)
            for index, pitch in enumerate(pitches)
        )
    notes.extend([
        make_note("d-01", "drums", 0, "1/8", 36, 108, 9),
        make_note("d-02", "drums", "49/24", "1/8", 38, 102, 9),
        make_note("d-03", "drums", 4, "1/8", 36, 106, 9),
        make_note("d-04", "drums", "145/24", "1/8", 38, 100, 9),
        make_note("d-05", "drums", 8, "1/8", 36, 104, 9),
        make_note("d-06", "drums", "217/24", "1/8", 38, 99, 9),
        make_note("d-07", "drums", 11, "1/8", 36, 107, 9),
        make_note("d-08", "drums", "313/24", "1/8", 38, 101, 9),
    ])
    return sorted(notes, key=lambda row: (base.frac(row["start"]), row["track"], row["pitch"], row["id"]))


def make_score(name: str, repeats: int) -> dict[str, Any]:
    source_notes = medium_notes()
    bars = [
        {"number": 1, "start": "0", "length": "4", "meter": "4/4", "harmony": "Cmaj9#11"},
        {"number": 2, "start": "4", "length": "4", "meter": "4/4", "harmony": "E7alt"},
        {"number": 3, "start": "8", "length": "3", "meter": "3/4", "harmony": "Am11"},
        {"number": 4, "start": "11", "length": "5", "meter": "5/4", "harmony": "D-quartal"},
    ]
    if name == "short":
        selected_bars = bars[:1]
        notes = [deepcopy(note) for note in source_notes if base.frac(note["start"]) < 4]
    else:
        selected_bars = []
        notes = []
        for repeat in range(repeats):
            for bar in bars:
                copied_bar = deepcopy(bar)
                copied_bar["number"] += repeat * 4
                copied_bar["start"] = base.ftext(base.frac(bar["start"]) + repeat * 16)
                selected_bars.append(copied_bar)
            for note in source_notes:
                copied_note = deepcopy(note)
                if repeat:
                    copied_note["id"] = f"r{repeat + 1}-{note['id']}"
                copied_note["start"] = base.ftext(base.frac(note["start"]) + repeat * 16)
                notes.append(copied_note)
    value = {
        "id": name,
        "tempo_bpm": 120,
        "length_beats": base.ftext(4 if name == "short" else repeats * 16),
        "tracks": [
            {"id": "lead", "role": "lead", "voice": "monophonic"},
            {"id": "bass", "role": "bass", "voice": "monophonic"},
            {"id": "keys", "role": "harmony", "voice": "polyphonic"},
            {"id": "drums", "role": "rhythm", "voice": "polyphonic"},
        ],
        "bars": selected_bars,
        "notes": sorted(notes, key=lambda row: (base.frac(row["start"]), row["track"], row["pitch"], row["id"])),
    }
    value["sha256"] = digest(value)
    return value


def make_cohort() -> dict[str, dict[str, Any]]:
    return {
        "short": make_score("short", 1),
        "medium": make_score("medium", 1),
        "long": make_score("long", 2),
    }


def core_note(note: dict[str, Any]) -> dict[str, Any]:
    return {field: note[field] for field in CORE_FIELDS}


def score_header(item: dict[str, Any]) -> list[str]:
    return [f"SCORE {item['id']} HASH {item['sha256']} TEMPO {item['tempo_bpm']}"]


def render_bar(item: dict[str, Any]) -> str:
    lines = score_header(item)
    lines.extend(
        f"BAR {bar['number']} START {bar['start']} LENGTH {bar['length']} METER {bar['meter']} HARMONY {bar['harmony']}"
        for bar in item["bars"]
    )
    lines.extend(
        f"TRACK {track['id']} ROLE {track['role']} VOICE {track['voice']}"
        for track in item["tracks"]
    )
    lines.extend(
        f"NOTE {note['id']} TRACK {note['track']} POSITION {note['start']} DURATION {note['duration']} "
        f"PITCH {note['pitch']} VELOCITY {note['velocity']}"
        for note in item["notes"]
    )
    return "\n".join(lines)


def render_midi(item: dict[str, Any]) -> str:
    lines = score_header(item)
    lines.extend(
        f"BAR_{bar['number']} ABS_BEAT_{bar['start']} TIME_SIGNATURE_{bar['meter']} HARMONY_{bar['harmony']}"
        for bar in item["bars"]
    )
    for track in item["tracks"]:
        lines.append(f"TRACK_{track['id']} ROLE_{track['role']} VOICE_{track['voice']}")
        events = []
        for note in item["notes"]:
            if note["track"] != track["id"]:
                continue
            events.append((base.frac(note["start"]), 1, note))
            events.append((base.frac(note["start"]) + base.frac(note["duration"]), 0, note))
        cursor = base.frac(0)
        for position, is_on, note in sorted(events, key=lambda row: (row[0], row[1], row[2]["pitch"], row[2]["id"])):
            shift = base.ftext(position - cursor)
            if is_on:
                lines.append(
                    f"TIME_SHIFT_{shift} NOTE_ID_{note['id']} VELOCITY_{note['velocity']} NOTE_ON_{note['pitch']}"
                )
            else:
                lines.append(f"TIME_SHIFT_{shift} NOTE_ID_{note['id']} NOTE_OFF_{note['pitch']}")
            cursor = position
    return "\n".join(lines)


def bar_for(item: dict[str, Any], start: str) -> tuple[dict[str, Any], str]:
    position = base.frac(start)
    for bar in reversed(item["bars"]):
        if position >= base.frac(bar["start"]):
            return bar, base.ftext(position - base.frac(bar["start"]))
    raise ValueError(f"No bar contains {start}")


def render_remi(item: dict[str, Any]) -> str:
    lines = score_header(item)
    lines.extend(
        f"<Bar={bar['number']}> <Start={bar['start']}> <TimeSig={bar['meter']}> <Chord={bar['harmony']}>"
        for bar in item["bars"]
    )
    lines.extend(
        f"<Track={track['id']}> <Role={track['role']}> <Voice={track['voice']}>"
        for track in item["tracks"]
    )
    for note in item["notes"]:
        bar, position = bar_for(item, note["start"])
        lines.append(
            f"<Bar={bar['number']}> <Position={position}> <Track={note['track']}> <NoteID={note['id']}> "
            f"<Pitch={note['pitch']}> <Velocity={note['velocity']}> <Duration={note['duration']}>"
        )
    return "\n".join(lines)


def render_octuple(item: dict[str, Any]) -> str:
    lines = score_header(item)
    lines.extend(
        f"BAR_META(BAR={bar['number']},START={bar['start']},METER={bar['meter']},TEMPO={item['tempo_bpm']},HARMONY={bar['harmony']})"
        for bar in item["bars"]
    )
    lines.extend(
        f"TRACK_META(TRACK={track['id']},ROLE={track['role']},VOICE={track['voice']})"
        for track in item["tracks"]
    )
    for note in item["notes"]:
        bar, position = bar_for(item, note["start"])
        lines.append(
            f"NOTE(BAR={bar['number']},POSITION={position},TRACK={note['track']},ID={note['id']},"
            f"PITCH={note['pitch']},DURATION={note['duration']},VELOCITY={note['velocity']},"
            f"TIMESIG={bar['meter']},TEMPO={item['tempo_bpm']})"
        )
    return "\n".join(lines)


ABC_NAMES = ("C", "^C", "D", "_E", "E", "F", "^F", "G", "_A", "A", "_B", "B")


def abc_pitch(pitch: int) -> str:
    octave = pitch // 12 - 1
    value = ABC_NAMES[pitch % 12]
    if octave >= 5:
        return value.lower() + "'" * (octave - 5)
    if octave < 4:
        return value + "," * (4 - octave)
    return value


def render_abc(item: dict[str, Any]) -> str:
    lines = [f"X:{item['id']}", f"T:{item['id']} synchronized score", "L:1/192", "Q:1/4=120", "K:C"]
    lines.extend(f"V:{track['id']} NAME={track['role']} VOICE={track['voice']}" for track in item["tracks"])
    lines.extend(
        f"% BAR {bar['number']} START={bar['start']} METER={bar['meter']} HARMONY={bar['harmony']}"
        for bar in item["bars"]
    )
    for note in item["notes"]:
        units = int(base.frac(note["duration"]) * 48)
        lines.append(
            f"% GN ID={note['id']} TRACK={note['track']} START={note['start']} DURATION={note['duration']} "
            f"VELOCITY={note['velocity']} PITCH={note['pitch']} ABC={abc_pitch(note['pitch'])}{units}"
        )
    return "\n".join(lines)


RENDERERS: dict[str, Callable[[dict[str, Any]], str]] = {
    "bar-events": render_bar,
    "midi-like": render_midi,
    "remi-plus": render_remi,
    "octuple-midi": render_octuple,
    "synchronized-abc": render_abc,
}


def rename_tokens(arm: str, text: str) -> str:
    result = text
    for source, target in sorted(TOKEN_MAPS[arm].items(), key=lambda row: -len(row[0])):
        result = re.sub(rf"(?<![A-Za-z]){re.escape(source)}(?![A-Za-z])", target, result)
    return result


def representations(cohort: dict[str, dict[str, Any]]) -> dict[str, dict[str, dict[str, str]]]:
    result = {}
    for arm, renderer in RENDERERS.items():
        published = {name: renderer(item) for name, item in cohort.items()}
        result[arm] = {
            "published": published,
            "renamed": {name: rename_tokens(arm, text) for name, text in published.items()},
        }
    return result


def parse_core(arm: str, syntax: str, text: str, item: dict[str, Any]) -> list[dict[str, Any]]:
    if syntax == "renamed":
        reverse = {value: key for key, value in TOKEN_MAPS[arm].items()}
        for source, target in sorted(reverse.items(), key=lambda row: -len(row[0])):
            text = re.sub(rf"(?<![A-Za-z]){re.escape(source)}(?![A-Za-z])", target, text)
    values = []
    if arm == "bar-events":
        pattern = re.compile(r"^NOTE (\S+) TRACK (\S+) POSITION (\S+) DURATION (\S+) PITCH (\d+) VELOCITY (\d+)$")
        for line in text.splitlines():
            if match := pattern.match(line):
                values.append(dict(zip(CORE_FIELDS, (match[1], match[2], match[3], match[4], int(match[5]), int(match[6])))))
    elif arm == "midi-like":
        track = ""
        cursor = base.frac(0)
        starts = {}
        velocities = {}
        for line in text.splitlines():
            if line.startswith("TRACK_"):
                track = line.split()[0].removeprefix("TRACK_")
                cursor = base.frac(0)
            elif line.startswith("TIME_SHIFT_"):
                parts = line.split()
                cursor += base.frac(parts[0].removeprefix("TIME_SHIFT_"))
                note_id = parts[1].removeprefix("NOTE_ID_")
                if "NOTE_ON_" in line:
                    starts[note_id] = (track, cursor, int(parts[3].removeprefix("NOTE_ON_")))
                    velocities[note_id] = int(parts[2].removeprefix("VELOCITY_"))
                else:
                    source_track, start, pitch = starts.pop(note_id)
                    values.append({
                        "id": note_id, "track": source_track, "start": base.ftext(start),
                        "duration": base.ftext(cursor - start), "pitch": pitch, "velocity": velocities[note_id],
                    })
    elif arm == "remi-plus":
        pattern = re.compile(
            r"^<Bar=(\d+)> <Position=([^>]+)> <Track=([^>]+)> <NoteID=([^>]+)> "
            r"<Pitch=(\d+)> <Velocity=(\d+)> <Duration=([^>]+)>$"
        )
        bars = {str(bar["number"]): bar for bar in item["bars"]}
        for line in text.splitlines():
            if match := pattern.match(line):
                start = base.ftext(base.frac(bars[match[1]]["start"]) + base.frac(match[2]))
                values.append({"id": match[4], "track": match[3], "start": start, "duration": match[7], "pitch": int(match[5]), "velocity": int(match[6])})
    elif arm == "octuple-midi":
        pattern = re.compile(
            r"^NOTE\(BAR=(\d+),POSITION=([^,]+),TRACK=([^,]+),ID=([^,]+),PITCH=(\d+),"
            r"DURATION=([^,]+),VELOCITY=(\d+),TIMESIG=[^,]+,TEMPO=\d+\)$"
        )
        bars = {str(bar["number"]): bar for bar in item["bars"]}
        for line in text.splitlines():
            if match := pattern.match(line):
                start = base.ftext(base.frac(bars[match[1]]["start"]) + base.frac(match[2]))
                values.append({"id": match[4], "track": match[3], "start": start, "duration": match[6], "pitch": int(match[5]), "velocity": int(match[7])})
    else:
        pattern = re.compile(r"^% GN ID=(\S+) TRACK=(\S+) START=(\S+) DURATION=(\S+) VELOCITY=(\d+) PITCH=(\d+) ABC=")
        for line in text.splitlines():
            if match := pattern.match(line):
                values.append({"id": match[1], "track": match[2], "start": match[3], "duration": match[4], "pitch": int(match[6]), "velocity": int(match[5])})
    return sorted(values, key=lambda row: (base.frac(row["start"]), row["track"], row["pitch"], row["id"]))


def screen(cohort: dict[str, dict[str, Any]], views: dict[str, dict[str, dict[str, str]]]) -> dict[str, Any]:
    rows = []
    for arm in ARMS:
        for syntax in SYNTAXES:
            for name, item in cohort.items():
                parsed = parse_core(arm, syntax, views[arm][syntax][name], item)
                expected = [core_note(note) for note in item["notes"]]
                rows.append({
                    "arm": arm, "syntax": syntax, "fixture": name,
                    "exact": parsed == expected, "note_count": len(parsed), "sha256": digest(parsed),
                })
    return {
        "retained": list(ARMS),
        "rejected": [{
            "arm": "tidal-mini-notation",
            "reason": (
                "The bounded mini-notation pattern does not carry stable finite note identities and independent performed durations. "
                "An exact side ledger would duplicate the tested score."
            ),
        }],
        "roundtrips": rows,
        "all_retained_exact": all(row["exact"] for row in rows),
    }


def grammar_text(arm: str, syntax: str, with_examples: bool) -> str:
    mapping = TOKEN_MAPS[arm]
    if syntax == "published":
        token_note = "Use the published token names shown in the score."
    else:
        token_note = "The score uses neutral tokens. " + ", ".join(f"{value}={key}" for key, value in mapping.items()) + "."
    common = (
        f"{token_note} Starts and durations are exact rational beat values. One beat is one quarter note. "
        "Bars give absolute starts, meters, and harmony. Track records give roles. Note records give opaque ID, track, start, duration, MIDI pitch, and velocity."
    )
    if not with_examples:
        return common
    examples = {
        "bar-events": "Example: NOTE ex TRACK lead POSITION 1/3 DURATION 2/3 PITCH 60 VELOCITY 80.",
        "midi-like": "Example: TIME_SHIFT_1/3 NOTE_ID_ex VELOCITY_80 NOTE_ON_60, then TIME_SHIFT_2/3 NOTE_ID_ex NOTE_OFF_60.",
        "remi-plus": "Example: <Bar=1> <Position=1/3> <Track=lead> <NoteID=ex> <Pitch=60> <Velocity=80> <Duration=2/3>.",
        "octuple-midi": "Example: NOTE(BAR=1,POSITION=1/3,TRACK=lead,ID=ex,PITCH=60,DURATION=2/3,VELOCITY=80,TIMESIG=4/4,TEMPO=120).",
        "synchronized-abc": "Example: % GN ID=ex TRACK=lead START=1/3 DURATION=2/3 VELOCITY=80 PITCH=60 ABC=C32.",
    }
    example = examples[arm]
    if syntax == "renamed":
        example = rename_tokens(arm, example)
    return common + " " + example


def invalid_patch(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": base.PATCH_SCHEMA,
        "base_sha256": "stale",
        "ops": [
            {"op": "move", "note_id": "not-a-note", "start": "1/3"},
            {"op": "move", "note_id": "l-05", "start": "-1"},
        ],
    }


def task_prompt(
    arm: str, syntax: str, instruction: str, rendered: dict[str, str], cohort: dict[str, dict[str, Any]],
) -> str:
    medium = cohort["medium"]
    grammar = grammar_text(arm, syntax, instruction == "grammar")
    masked = "BAR MASK METER MASK HARMONY MASK NOTE MASK POSITION MASK DURATION MASK PITCH MASK VELOCITY MASK"
    if syntax == "renamed":
        masked = rename_tokens(arm, masked)
    representation_name = arm if syntax == "published" else "neutral-control"
    return f"""You evaluate one symbolic music representation. Use only the supplied scores.
Return one JSON object and no markdown. Keep exact host-only fields outside each patch.

Representation: {representation_name}. Syntax: {syntax}. Instruction level: {instruction}.
{grammar}

Return these keys:
- structural: meter_sequence, harmony_sequence, bar2_keys_pitches, descending_bar2_lead_ids, and performed_offsets. performed_offsets maps l-02 and d-02 to exact rational starts.
- reconstruction: reconstruct every SHORT note with id, track, start, duration, pitch, and velocity. Do not add fields.
- transform_patch: transpose only l-05, l-06, l-07, and l-08 up one semitone.
- transfer_patch: copy the exact starts and durations of those four lead notes to four new bass notes. Use IDs new-r1 through new-r4 and E7alt pitches 44, 46, 50, and 56 in that order. Use velocity 82 for all four.
- continuation_patch: continue the lead with four notes. Use IDs new-c1 through new-c4, starts 16, 50/3, 17, and 53/3, durations 2/3, 1/3, 2/3, and 1/3, velocities 88, 84, 90, and 86, and pitches selected from G13alt {{55, 59, 62, 65, 68}}. End on pitch 55.
- invalid_patch_echo: copy the supplied invalid patch without repair.
- label_control: return status unavailable. The masked control has labels but no musical values.
- explanation: one concise sentence about the representation.

Each patch uses schema {base.PATCH_SCHEMA}, base_sha256 {medium['sha256']}, and ops. Use transpose or insert only. Use one transpose op with note_ids as a list and semitones as an integer. Use one insert op with notes as a list and default_policy track-neutral-v0. Inserted notes contain only id, track, start, duration, pitch, and velocity. The compiler supplies channel, mute, release velocity, and expression. Existing-note operations preserve every unnamed field.

Invalid patch fixture:
{canonical(invalid_patch(medium))}

Masked label control:
{masked}

SHORT
{rendered['short']}

MEDIUM
{rendered['medium']}

LONG
{rendered['long']}
"""


def normalized_core(values: Any) -> list[dict[str, Any]]:
    if not isinstance(values, list):
        return []
    result = []
    for value in values:
        if not isinstance(value, dict) or any(field not in value for field in CORE_FIELDS):
            continue
        copied = {field: value[field] for field in CORE_FIELDS}
        try:
            copied["start"] = base.ftext(copied["start"])
            copied["duration"] = base.ftext(copied["duration"])
        except (TypeError, ValueError, ZeroDivisionError):
            continue
        result.append(copied)
    return sorted(result, key=lambda row: (base.frac(row["start"]), row["track"], row["pitch"], row["id"]))


def expected_structure() -> dict[str, Any]:
    return {
        "meter_sequence": ["4/4", "4/4", "3/4", "5/4"],
        "harmony_sequence": ["Cmaj9#11", "E7alt", "Am11", "D-quartal"],
        "bar2_keys_pitches": [52, 56, 62, 65, 70],
        "descending_bar2_lead_ids": ["l-05", "l-06", "l-07", "l-08"],
        "performed_offsets": {"l-02": "49/48", "d-02": "49/24"},
    }


def diff_mapping(expected: dict[str, Any], actual: Any) -> list[dict[str, Any]]:
    if not isinstance(actual, dict):
        return [{"kind": "not-object"}]
    return [
        {"field": key, "expected": value, "actual": actual.get(key)}
        for key, value in expected.items() if actual.get(key) != value
    ]


def expected_transformed(item: dict[str, Any]) -> list[dict[str, Any]]:
    result = deepcopy(item["notes"])
    for note in result:
        if note["id"] in {"l-05", "l-06", "l-07", "l-08"}:
            note["pitch"] += 1
    return result


def validate_patch(name: str, patch: Any, item: dict[str, Any]) -> dict[str, Any]:
    totals = {"transform_patch": 1, "transfer_patch": 6, "continuation_patch": 7}
    errors = base.patch_errors(patch, item)
    if errors:
        return {"valid": False, "constraints_passed": 0, "constraints_total": totals[name], "errors": errors}
    try:
        compiled = base.compile_patch(patch, item)
    except ValueError as error:
        return {"valid": False, "constraints_passed": 0, "constraints_total": totals[name], "errors": [str(error)]}
    before = {note["id"]: note for note in item["notes"]}
    after = {note["id"]: note for note in compiled}
    if name == "transform_patch":
        differences = base.diff_notes(expected_transformed(item), compiled)
        checks = [not differences]
    elif name == "transfer_patch":
        inserted = [after.get(f"new-r{index}") for index in range(1, 5)]
        expected = [
            ("4", "1", 44, 82), ("5", "1", 46, 82),
            ("6", "1", 50, 82), ("7", "1", 56, 82),
        ]
        checks = [
            all(inserted),
            all(note and note["track"] == "bass" for note in inserted),
            all(note and (note["start"], note["duration"], note["pitch"], note["velocity"]) == target for note, target in zip(inserted, expected)),
            all(note and note["channel"] == 1 and note["muted"] is False for note in inserted),
            all(note and note["release_velocity"] == 64 for note in inserted),
            all(after[note_id] == note for note_id, note in before.items()),
        ]
    else:
        inserted = [after.get(f"new-c{index}") for index in range(1, 5)]
        expected_times = [("16", "2/3"), ("50/3", "1/3"), ("17", "2/3"), ("53/3", "1/3")]
        allowed = {55, 59, 62, 65, 68}
        checks = [
            all(inserted),
            all(note and note["track"] == "lead" for note in inserted),
            all(note and (note["start"], note["duration"]) == target for note, target in zip(inserted, expected_times)),
            all(note and note["pitch"] in allowed for note in inserted),
            bool(inserted[-1]) and inserted[-1]["pitch"] == 55,
            [note["velocity"] for note in inserted if note] == [88, 84, 90, 86],
            all(after[note_id] == note for note_id, note in before.items()),
        ]
    return {
        "valid": True, "constraints_passed": sum(checks), "constraints_total": len(checks),
        "checks": checks,
    }


def validate_initial(result: dict[str, Any], cohort: dict[str, dict[str, Any]]) -> dict[str, Any]:
    required = {"structural", "reconstruction", *TASK_PATCHES, "invalid_patch_echo", "label_control", "explanation"}
    structure_differences = diff_mapping(expected_structure(), result.get("structural"))
    expected_reconstruction = [core_note(note) for note in cohort["short"]["notes"]]
    reconstruction = normalized_core(result.get("reconstruction"))
    patch_scores = {name: validate_patch(name, result.get(name), cohort["medium"]) for name in TASK_PATCHES}
    invalid_errors = base.patch_errors(result.get("invalid_patch_echo"), cohort["medium"])
    label_control = result.get("label_control")
    label_pass = (
        label_control == "unavailable"
        or (isinstance(label_control, dict) and label_control.get("status") == "unavailable")
    )
    objective_passed = (
        len(expected_structure()) - len(structure_differences)
        + int(reconstruction == expected_reconstruction)
        + sum(score["constraints_passed"] for score in patch_scores.values())
        + int(label_pass)
    )
    objective_total = (
        len(expected_structure()) + 1
        + sum(score["constraints_total"] for score in patch_scores.values())
        + 1
    )
    return {
        "schema_valid": not (required - result.keys()),
        "missing_keys": sorted(required - result.keys()),
        "structure": {"correct": len(expected_structure()) - len(structure_differences), "total": len(expected_structure()), "differences": structure_differences},
        "reconstruction": {"exact": reconstruction == expected_reconstruction, "expected_count": len(expected_reconstruction), "actual_count": len(reconstruction), "sha256": digest(reconstruction)},
        "patches": patch_scores,
        "invalid_patch_errors": invalid_errors,
        "invalid_patch_exposed_all_errors": (
            any("base_sha256" in error for error in invalid_errors)
            and any("unknown note ID" in error for error in invalid_errors)
            and any("below 0" in error for error in invalid_errors)
        ),
        "label_control_pass": label_pass,
        "objective_passed": objective_passed,
        "objective_total": objective_total,
    }


def repair_prompt(errors: list[str], item: dict[str, Any]) -> str:
    return (
        "The deterministic compiler rejected the invalid patch. Repair the intended operation. "
        "Move existing note l-05 to beat 13/3. Return only one JSON patch. Preserve every other note. "
        f"Use schema {base.PATCH_SCHEMA} and base_sha256 {item['sha256']}. Compiler errors: {canonical(errors)}"
    )


def validate_repair(patch: Any, item: dict[str, Any]) -> dict[str, Any]:
    errors = base.patch_errors(patch, item)
    if errors:
        return {"valid": False, "correct": False, "errors": errors}
    try:
        compiled = base.compile_patch(patch, item)
    except ValueError as error:
        return {"valid": False, "correct": False, "errors": [str(error)]}
    expected = deepcopy(item["notes"])
    for note in expected:
        if note["id"] == "l-05":
            note["start"] = "13/3"
    differences = base.diff_notes(expected, compiled)
    return {"valid": True, "correct": not differences, "errors": [], "differences": differences}


def model_call_with_retry(
    provider: str, key: str, messages: list[dict[str, str]], max_tokens: int,
) -> tuple[dict[str, Any], dict[str, Any], int]:
    retries = 0
    for delay in (0, 2, 4, 8):
        if delay:
            time.sleep(delay)
        try:
            result, raw = base.model_call(provider, key, messages, max_tokens)
            return result, raw, retries
        except json.JSONDecodeError:
            if retries == 3:
                raise
            retries += 1
        except ValueError:
            if retries == 3:
                raise
            retries += 1
        except urllib.error.HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504} or retries == 3:
                raise
            retries += 1
    raise AssertionError("The retry loop did not return or raise")


def call_model(provider: str, key: str, prompt: str, max_tokens: int) -> tuple[dict[str, Any], dict[str, Any], float, int]:
    started = time.perf_counter()
    result, raw, retries = model_call_with_retry(
        provider, key, [{"role": "user", "content": prompt}], max_tokens,
    )
    return result, raw, (time.perf_counter() - started) * 1000, retries


def run_provider(provider: str, env_file: Path) -> dict[str, Any]:
    environment = base.load_env(env_file)
    key_name = "OPENAI_API_KEY" if provider == "openai" else "GEMINI_API_KEY"
    if not environment.get(key_name):
        raise ValueError(f"{key_name} is missing")
    cohort = make_cohort()
    views = representations(cohort)
    deterministic_screen = screen(cohort, views)
    if not deterministic_screen["all_retained_exact"]:
        raise ValueError("A retained deterministic round-trip failed")
    rows = []
    for arm in ARMS:
        for syntax in SYNTAXES:
            for instruction in INSTRUCTION_LEVELS:
                prompt = task_prompt(arm, syntax, instruction, views[arm][syntax], cohort)
                initial, raw, latency, retries = call_model(provider, environment[key_name], prompt, 10000)
                validation = validate_initial(initial, cohort)
                repair = None
                if syntax == "published" and instruction == "grammar":
                    repair_text = repair_prompt(validation["invalid_patch_errors"], cohort["medium"])
                    messages = [
                        {"role": "user", "content": prompt},
                        {"role": "assistant", "content": canonical(initial)},
                        {"role": "user", "content": repair_text},
                    ]
                    started = time.perf_counter()
                    repaired, repair_raw, repair_retries = model_call_with_retry(
                        provider, environment[key_name], messages, 2000,
                    )
                    repair = {
                        "latency_ms": (time.perf_counter() - started) * 1000,
                        "retries": repair_retries,
                        "usage": base.usage(provider, repair_raw),
                        "returned_model": base.returned_model(provider, repair_raw),
                        "result": repaired,
                        "validation": validate_repair(repaired, cohort["medium"]),
                    }
                lexical_tokens = len(re.findall(r"\S+", prompt))
                measured_usage = base.usage(provider, raw)
                rows.append({
                    "arm": arm, "syntax": syntax, "instruction": instruction,
                    "prompt_sha256": hashlib.sha256(prompt.encode()).hexdigest(),
                    "prompt_lexemes": lexical_tokens,
                    "input_tokens_per_lexeme": measured_usage["input_tokens"] / lexical_tokens,
                    "latency_ms": latency,
                    "retries": retries,
                    "usage": measured_usage,
                    "returned_model": base.returned_model(provider, raw),
                    "request_id": raw.get("id"),
                    "result": initial,
                    "validation": validation,
                    "repair": repair,
                })
    represented_notes = sum(len(item["notes"]) for item in cohort.values())
    represented_bars = sum(len(item["bars"]) for item in cohort.values())
    return {
        "schema": SCHEMA,
        "provider": provider,
        "requested_model": base.OPENAI_MODEL if provider == "openai" else base.GEMINI_MODEL,
        "client": "Python urllib.request direct HTTPS",
        "model_settings": {"reasoning_or_thinking": "low", "temperature": None if provider == "openai" else 0},
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "privacy": "Generated symbolic notes only. No live project or file upload.",
        "cohort": {name: {"sha256": item["sha256"], "notes": len(item["notes"]), "bars": len(item["bars"])} for name, item in cohort.items()},
        "represented_notes_per_prompt": represented_notes,
        "represented_bars_per_prompt": represented_bars,
        "screen": deterministic_screen,
        "representation_sha256": digest({arm: {syntax: {name: hashlib.sha256(text.encode()).hexdigest() for name, text in values.items()} for syntax, values in variants.items()} for arm, variants in views.items()}),
        "results": rows,
    }


def summarize(paths: list[Path]) -> dict[str, Any]:
    runs = [json.loads(path.read_text()) for path in paths]
    cohort = make_cohort()
    rows = []
    for run in runs:
        note_count = run["represented_notes_per_prompt"]
        bar_count = run["represented_bars_per_prompt"]
        for item in run["results"]:
            validation = validate_initial(item["result"], cohort)
            rows.append({
                "provider": run["provider"], "model": item["returned_model"],
                "arm": item["arm"], "syntax": item["syntax"], "instruction": item["instruction"],
                "schema_valid": validation["schema_valid"],
                "structure_correct": validation["structure"]["correct"],
                "structure_total": validation["structure"]["total"],
                "reconstruction_exact": validation["reconstruction"]["exact"],
                "patches_valid": sum(score["valid"] for score in validation["patches"].values()),
                "patches_total": len(TASK_PATCHES),
                "constraints_passed": sum(score["constraints_passed"] for score in validation["patches"].values()),
                "constraints_total": sum(score["constraints_total"] for score in validation["patches"].values()),
                "label_control_pass": validation["label_control_pass"],
                "objective_passed": validation["objective_passed"],
                "objective_total": validation["objective_total"],
                "invalid_errors_exposed": validation["invalid_patch_exposed_all_errors"],
                "repair_correct": item["repair"]["validation"]["correct"] if item["repair"] else None,
                "input_tokens": item["usage"]["input_tokens"],
                "output_tokens": item["usage"]["output_tokens"],
                "input_tokens_per_note": item["usage"]["input_tokens"] / note_count,
                "input_tokens_per_bar": item["usage"]["input_tokens"] / bar_count,
                "input_tokens_per_lexeme": item["input_tokens_per_lexeme"],
                "latency_ms": item["latency_ms"],
                "retries": item.get("retries", 0),
            })
    familiarity = []
    for run in runs:
        for arm in ARMS:
            arm_rows = [row for row in rows if row["provider"] == run["provider"] and row["arm"] == arm]
            lookup = {(row["syntax"], row["instruction"]): row for row in arm_rows}
            zero_delta = lookup[("published", "zero-shot")]["objective_passed"] - lookup[("renamed", "zero-shot")]["objective_passed"]
            grammar_delta = lookup[("published", "grammar")]["objective_passed"] - lookup[("renamed", "grammar")]["objective_passed"]
            familiarity.append({
                "provider": run["provider"], "arm": arm,
                "zero_shot_published_minus_renamed": zero_delta,
                "grammar_published_minus_renamed": grammar_delta,
                "prior_familiarity_consistent": zero_delta > 0 and abs(grammar_delta) < abs(zero_delta),
            })
    return {"schema": SCHEMA, "source_files": [str(path) for path in paths], "rows": rows, "familiarity": familiarity}


def self_test() -> dict[str, Any]:
    cohort = make_cohort()
    assert [len(cohort[name]["bars"]) for name in ("short", "medium", "long")] == [1, 4, 8]
    assert len(cohort["short"]["notes"]) < len(cohort["medium"]["notes"]) < len(cohort["long"]["notes"])
    views = representations(cohort)
    result = screen(cohort, views)
    assert result["all_retained_exact"]
    assert len(result["roundtrips"]) == len(ARMS) * len(SYNTAXES) * len(cohort)
    assert result["rejected"][0]["arm"] == "tidal-mini-notation"
    medium = cohort["medium"]
    transform = {
        "schema": base.PATCH_SCHEMA, "base_sha256": medium["sha256"],
        "ops": [{"op": "transpose", "note_ids": ["l-05", "l-06", "l-07", "l-08"], "semitones": 1}],
    }
    assert validate_patch("transform_patch", transform, medium)["constraints_passed"] == 1
    invalid_errors = base.patch_errors(invalid_patch(medium), medium)
    assert len(invalid_errors) == 3
    assert expected_structure()["performed_offsets"]["l-02"] == "49/48"
    return {
        "passed": 8,
        "cohort_sha256": digest({name: item["sha256"] for name, item in cohort.items()}),
        "representation_sha256": digest({arm: {syntax: {name: hashlib.sha256(text.encode()).hexdigest() for name, text in values.items()} for syntax, values in variants.items()} for arm, variants in views.items()}),
        "screen": result,
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
        parser.error("Select --self-test, --provider, or --summarize")
    rendered = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(rendered)
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
