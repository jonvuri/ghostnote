#!/usr/bin/env python3
"""Run the fixed compact-bar v0 comparison benchmark."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import re
import sys
import time
import urllib.error
import urllib.request
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
from typing import Any, Callable

from corpus import (
    CORE_FIELDS,
    canonical,
    core_note,
    corpus_manifest,
    digest,
    fraction,
    fraction_text,
    make_corpus,
    note_sort_key,
)


BENCHMARK_SCHEMA = "ghostnote-compact-bar-benchmark-v0"
PATCH_SCHEMA = "ghostnote-note-patch-v0"
OPENAI_MODEL = "gpt-5.4-mini-2026-03-17"
GEMINI_MODEL = "gemini-3.8-flash"
FORMAT_ORDER = (
    "exact-json",
    "compact-bar",
    "abc-2.1-side-ledger",
    "alda-side-ledger",
    "midi-like-task-profile",
    "remi-plus-task-profile",
    "octuple-midi-task-profile",
    "strudel-mini-notation",
)
ROUND_TRIP_FORMATS = FORMAT_ORDER[:-1]
INSERT_FIELDS = ("id", "track", "start", "duration", "pitch", "velocity")
FULL_NOTE_FIELDS = (
    "id",
    "track",
    "start",
    "duration",
    "pitch",
    "velocity",
    "channel",
    "muted",
    "release_velocity",
    "articulation",
    "expression",
)


FORMAT_PROFILES: dict[str, dict[str, Any]] = {
    "exact-json": {
        "family": "complete control",
        "native_purpose": "Exact object exchange and reconstruction.",
        "represented_fields": list(FULL_NOTE_FIELDS),
        "defaults": [],
        "side_planes": [],
        "loss": [],
        "ghostnote_round_trip": True,
    },
    "compact-bar": {
        "family": "Ghostnote task view",
        "native_purpose": "Compact agent reading and identity-grounded note edits.",
        "represented_fields": list(CORE_FIELDS) + ["meter", "harmony", "role", "region"],
        "defaults": [],
        "side_planes": [],
        "loss": ["channel", "mute", "release velocity", "articulation", "note expression"],
        "ghostnote_round_trip": True,
    },
    "abc-2.1-side-ledger": {
        "family": "score notation",
        "native_purpose": "Portable human-readable notation and tune exchange.",
        "represented_fields": list(CORE_FIELDS) + ["meter", "harmony", "role"],
        "defaults": [],
        "side_planes": ["% GN exact identity and performance ledger"],
        "loss": ["host-only fields", "sub-1/192 timing in the ABC score view"],
        "ghostnote_round_trip": True,
    },
    "alda-side-ledger": {
        "family": "textual sequencer",
        "native_purpose": "Text-based composition, playback, and interactive sequencing.",
        "represented_fields": list(CORE_FIELDS) + ["role"],
        "defaults": [],
        "side_planes": ["# GN exact identity and performance ledger"],
        "loss": ["host-only fields", "performed timing and polyphony in the Alda pitch sketch"],
        "ghostnote_round_trip": True,
    },
    "midi-like-task-profile": {
        "family": "model token stream",
        "native_purpose": "Autoregressive event modeling with note-on, note-off, and time shifts.",
        "represented_fields": list(CORE_FIELDS) + ["meter", "harmony", "role"],
        "defaults": [],
        "side_planes": ["task extensions for opaque IDs and musical metadata"],
        "loss": ["host-only fields"],
        "ghostnote_round_trip": True,
    },
    "remi-plus-task-profile": {
        "family": "model token stream",
        "native_purpose": "Bar-aware symbolic modeling and generation.",
        "represented_fields": list(CORE_FIELDS) + ["meter", "harmony", "role"],
        "defaults": [],
        "side_planes": ["task extensions for opaque IDs and roles"],
        "loss": ["host-only fields"],
        "ghostnote_round_trip": True,
    },
    "octuple-midi-task-profile": {
        "family": "model token stream",
        "native_purpose": "Compound-event symbolic pretraining and understanding.",
        "represented_fields": list(CORE_FIELDS) + ["meter", "role"],
        "defaults": [],
        "side_planes": ["task extensions for opaque IDs, harmony, and exact rational time"],
        "loss": ["host-only fields"],
        "ghostnote_round_trip": True,
    },
    "strudel-mini-notation": {
        "family": "pattern language",
        "native_purpose": "Terse live pattern construction and transformation.",
        "represented_fields": ["cyclic event value", "relative onset", "relative span"],
        "defaults": ["one cycle of coverage for the fixed native task"],
        "side_planes": [],
        "loss": ["finite note identity", "independent performed duration", "host performance fields"],
        "ghostnote_round_trip": False,
    },
}


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def render_exact(item: dict[str, Any]) -> str:
    return canonical(item)


def render_compact(item: dict[str, Any]) -> str:
    lines = [
        f"SCORE {item['id']} HASH {item['sha256']} TEMPO {item['tempo_bpm']}",
        "FIELDS id track position duration pitch velocity",
        "OMITS channel mute release_velocity articulation expression",
    ]
    lines.extend(
        f"BAR {bar['number']} START {bar['start']} LENGTH {bar['length']} "
        f"METER {bar['meter']} HARMONY {bar['harmony']}"
        for bar in item["bars"]
    )
    lines.extend(
        f"TRACK {track['id']} ROLE {track['role']} VOICE {track['voice']}"
        for track in item["tracks"]
    )
    lines.extend(
        f"REGION {region['id']} START {region['start']} END {region['end']}"
        for region in item["regions"]
    )
    lines.extend(
        f"NOTE {value['id']} TRACK {value['track']} POSITION {value['start']} "
        f"DURATION {value['duration']} PITCH {value['pitch']} VELOCITY {value['velocity']}"
        for value in item["notes"]
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
    lines = [
        "%abc-2.1",
        f"X:{item['id']}",
        f"T:Ghostnote generated {item['id']} fixture",
        "L:1/192",
        f"Q:1/4={item['tempo_bpm']}",
        "M:4/4",
        "K:C",
    ]
    lines.extend(f"V:{track['id']} name=\"{track['role']}\"" for track in item["tracks"])
    lines.extend(
        f"% BAR {bar['number']} START={bar['start']} METER={bar['meter']} HARMONY={bar['harmony']}"
        for bar in item["bars"]
    )
    for value in item["notes"]:
        rounded_units = max(1, round(float(fraction(value["duration"])) * 48))
        lines.append(
            f"% GN ID={value['id']} TRACK={value['track']} START={value['start']} "
            f"DURATION={value['duration']} VELOCITY={value['velocity']} PITCH={value['pitch']} "
            f"ABC={abc_pitch(value['pitch'])}{rounded_units}"
        )
    return "\n".join(lines)


def render_alda(item: dict[str, Any]) -> str:
    lines = [
        f"# Ghostnote generated {item['id']} score",
        f"# HASH {item['sha256']} TEMPO {item['tempo_bpm']}",
    ]
    lines.extend(
        f"# BAR {bar['number']} START={bar['start']} METER={bar['meter']} HARMONY={bar['harmony']}"
        for bar in item["bars"]
    )
    for track in item["tracks"]:
        lines.append(f"# PART {track['id']} ROLE={track['role']} VOICE={track['voice']}")
        lines.append("piano:")
        track_notes = [value for value in item["notes"] if value["track"] == track["id"]]
        lines.append("  " + " ".join(alda_pitch(value["pitch"]) for value in track_notes))
    for value in item["notes"]:
        lines.append(
            f"# GN ID={value['id']} TRACK={value['track']} START={value['start']} "
            f"DURATION={value['duration']} VELOCITY={value['velocity']} PITCH={value['pitch']}"
        )
    return "\n".join(lines)


ALDA_NAMES = ("c", "c+", "d", "d+", "e", "f", "f+", "g", "g+", "a", "a+", "b")


def alda_pitch(pitch: int) -> str:
    return f"o{pitch // 12 - 1} {ALDA_NAMES[pitch % 12]}4"


def render_midi_like(item: dict[str, Any]) -> str:
    lines = [f"SCORE_{item['id']} HASH_{item['sha256']} TEMPO_{item['tempo_bpm']}"]
    lines.extend(
        f"BAR_{bar['number']} ABS_BEAT_{bar['start']} TIME_SIGNATURE_{bar['meter']} HARMONY_{bar['harmony']}"
        for bar in item["bars"]
    )
    for track in item["tracks"]:
        lines.append(f"TRACK_{track['id']} ROLE_{track['role']} VOICE_{track['voice']}")
        events = []
        for value in item["notes"]:
            if value["track"] != track["id"]:
                continue
            events.append((fraction(value["start"]), 1, value))
            events.append((fraction(value["start"]) + fraction(value["duration"]), 0, value))
        cursor = Fraction(0)
        for position, is_on, value in sorted(
            events, key=lambda row: (row[0], row[1], row[2]["pitch"], row[2]["id"])
        ):
            shift = fraction_text(position - cursor)
            if is_on:
                lines.append(
                    f"TIME_SHIFT_{shift} NOTE_ID_{value['id']} VELOCITY_{value['velocity']} "
                    f"NOTE_ON_{value['pitch']}"
                )
            else:
                lines.append(f"TIME_SHIFT_{shift} NOTE_ID_{value['id']} NOTE_OFF_{value['pitch']}")
            cursor = position
    return "\n".join(lines)


def bar_for(item: dict[str, Any], start: str) -> tuple[dict[str, Any], str]:
    position = fraction(start)
    for bar in reversed(item["bars"]):
        if position >= fraction(bar["start"]):
            return bar, fraction_text(position - fraction(bar["start"]))
    raise ValueError(f"No bar contains beat {start}")


def render_remi(item: dict[str, Any]) -> str:
    lines = [f"<Score={item['id']}> <Hash={item['sha256']}> <Tempo={item['tempo_bpm']}>"]
    lines.extend(
        f"<Bar={bar['number']}> <Start={bar['start']}> <TimeSig={bar['meter']}> <Chord={bar['harmony']}>"
        for bar in item["bars"]
    )
    lines.extend(
        f"<Track={track['id']}> <Role={track['role']}> <Voice={track['voice']}>"
        for track in item["tracks"]
    )
    for value in item["notes"]:
        bar, position = bar_for(item, value["start"])
        lines.append(
            f"<Bar={bar['number']}> <Position={position}> <Track={value['track']}> "
            f"<NoteID={value['id']}> <Pitch={value['pitch']}> <Velocity={value['velocity']}> "
            f"<Duration={value['duration']}>"
        )
    return "\n".join(lines)


def render_octuple(item: dict[str, Any]) -> str:
    lines = [f"SCORE {item['id']} HASH {item['sha256']}"]
    lines.extend(
        f"BAR_META(BAR={bar['number']},START={bar['start']},METER={bar['meter']},"
        f"TEMPO={item['tempo_bpm']},HARMONY={bar['harmony']})"
        for bar in item["bars"]
    )
    lines.extend(
        f"TRACK_META(TRACK={track['id']},ROLE={track['role']},VOICE={track['voice']})"
        for track in item["tracks"]
    )
    for value in item["notes"]:
        bar, position = bar_for(item, value["start"])
        lines.append(
            f"NOTE(BAR={bar['number']},POSITION={position},TRACK={value['track']},ID={value['id']},"
            f"PITCH={value['pitch']},DURATION={value['duration']},VELOCITY={value['velocity']},"
            f"TIMESIG={bar['meter']},TEMPO={item['tempo_bpm']})"
        )
    return "\n".join(lines)


RENDERERS: dict[str, Callable[[dict[str, Any]], str]] = {
    "exact-json": render_exact,
    "compact-bar": render_compact,
    "abc-2.1-side-ledger": render_abc,
    "alda-side-ledger": render_alda,
    "midi-like-task-profile": render_midi_like,
    "remi-plus-task-profile": render_remi,
    "octuple-midi-task-profile": render_octuple,
}


def render_corpus(corpus: dict[str, dict[str, Any]]) -> dict[str, dict[str, str]]:
    return {
        format_id: {name: renderer(item) for name, item in corpus.items()}
        for format_id, renderer in RENDERERS.items()
    }


def parse_side_ledger(text: str) -> list[dict[str, Any]]:
    pattern = re.compile(
        r"^[%#] GN ID=(\S+) TRACK=(\S+) START=(\S+) DURATION=(\S+) VELOCITY=(\d+) PITCH=(\d+)"
    )
    values = []
    for line in text.splitlines():
        if match := pattern.match(line):
            values.append(
                {
                    "id": match[1],
                    "track": match[2],
                    "start": match[3],
                    "duration": match[4],
                    "pitch": int(match[6]),
                    "velocity": int(match[5]),
                }
            )
    return sorted(values, key=note_sort_key)


def parse_core(format_id: str, text: str, item: dict[str, Any]) -> list[dict[str, Any]]:
    values: list[dict[str, Any]] = []
    if format_id == "exact-json":
        loaded = json.loads(text)
        values = [core_note(value) for value in loaded["notes"]]
    elif format_id == "compact-bar":
        pattern = re.compile(
            r"^NOTE (\S+) TRACK (\S+) POSITION (\S+) DURATION (\S+) PITCH (\d+) VELOCITY (\d+)$"
        )
        for line in text.splitlines():
            if match := pattern.match(line):
                values.append(
                    dict(
                        zip(
                            CORE_FIELDS,
                            (match[1], match[2], match[3], match[4], int(match[5]), int(match[6])),
                        )
                    )
                )
    elif format_id in {"abc-2.1-side-ledger", "alda-side-ledger"}:
        values = parse_side_ledger(text)
    elif format_id == "midi-like-task-profile":
        track = ""
        cursor = Fraction(0)
        starts: dict[str, tuple[str, Fraction, int]] = {}
        velocities: dict[str, int] = {}
        for line in text.splitlines():
            if line.startswith("TRACK_"):
                track = line.split()[0].removeprefix("TRACK_")
                cursor = Fraction(0)
            elif line.startswith("TIME_SHIFT_"):
                parts = line.split()
                cursor += fraction(parts[0].removeprefix("TIME_SHIFT_"))
                note_id = parts[1].removeprefix("NOTE_ID_")
                if "NOTE_ON_" in line:
                    starts[note_id] = (track, cursor, int(parts[3].removeprefix("NOTE_ON_")))
                    velocities[note_id] = int(parts[2].removeprefix("VELOCITY_"))
                else:
                    source_track, start, pitch = starts.pop(note_id)
                    values.append(
                        {
                            "id": note_id,
                            "track": source_track,
                            "start": fraction_text(start),
                            "duration": fraction_text(cursor - start),
                            "pitch": pitch,
                            "velocity": velocities[note_id],
                        }
                    )
    elif format_id == "remi-plus-task-profile":
        pattern = re.compile(
            r"^<Bar=(\d+)> <Position=([^>]+)> <Track=([^>]+)> <NoteID=([^>]+)> "
            r"<Pitch=(\d+)> <Velocity=(\d+)> <Duration=([^>]+)>$"
        )
        source_bars = {str(bar["number"]): bar for bar in item["bars"]}
        for line in text.splitlines():
            if match := pattern.match(line):
                values.append(
                    {
                        "id": match[4],
                        "track": match[3],
                        "start": fraction_text(
                            fraction(source_bars[match[1]]["start"]) + fraction(match[2])
                        ),
                        "duration": match[7],
                        "pitch": int(match[5]),
                        "velocity": int(match[6]),
                    }
                )
    elif format_id == "octuple-midi-task-profile":
        pattern = re.compile(
            r"^NOTE\(BAR=(\d+),POSITION=([^,]+),TRACK=([^,]+),ID=([^,]+),PITCH=(\d+),"
            r"DURATION=([^,]+),VELOCITY=(\d+),TIMESIG=[^,]+,TEMPO=\d+\)$"
        )
        source_bars = {str(bar["number"]): bar for bar in item["bars"]}
        for line in text.splitlines():
            if match := pattern.match(line):
                values.append(
                    {
                        "id": match[4],
                        "track": match[3],
                        "start": fraction_text(
                            fraction(source_bars[match[1]]["start"]) + fraction(match[2])
                        ),
                        "duration": match[6],
                        "pitch": int(match[5]),
                        "velocity": int(match[7]),
                    }
                )
    else:
        raise ValueError(f"No finite round-trip parser for {format_id}")
    return sorted(values, key=note_sort_key)


def expand_strudel_control() -> list[dict[str, str]]:
    return [
        {"value": "bd", "start": "0", "end": "1/2"},
        {"value": "hh", "start": "0", "end": "1/4"},
        {"value": "hh", "start": "1/4", "end": "1/2"},
        {"value": "sd", "start": "1/2", "end": "1"},
        {"value": "hh", "start": "1/2", "end": "3/4"},
        {"value": "hh", "start": "3/4", "end": "1"},
    ]


def deterministic_screen() -> dict[str, Any]:
    corpus = make_corpus()
    views = render_corpus(corpus)
    rows = []
    for format_id in ROUND_TRIP_FORMATS:
        for name, item in corpus.items():
            text = views[format_id][name]
            parsed = parse_core(format_id, text, item)
            expected = [core_note(value) for value in item["notes"]]
            rows.append(
                {
                    "format": format_id,
                    "fixture": name,
                    "exact_represented_core_round_trip": parsed == expected,
                    "notes": len(parsed),
                    "bytes": len(text.encode()),
                    "lexemes": len(text.split()),
                    "text_sha256": sha256_text(text),
                    "parsed_sha256": digest(parsed),
                }
            )
    native_pattern = expand_strudel_control()
    rejected = [
        {
            "format": "lilypond",
            "stage": "deterministic capability screen",
            "reason": "The repository does not pin or package a LilyPond compiler for this cohort.",
        }
    ]
    return {
        "schema": BENCHMARK_SCHEMA,
        "corpus": corpus_manifest(corpus),
        "format_profiles": FORMAT_PROFILES,
        "round_trip_rows": rows,
        "native_rows": [
            {
                "format": "strudel-mini-notation",
                "source": "[bd sd, hh*4]",
                "coverage_cycles": 1,
                "events": native_pattern,
                "events_sha256": digest(native_pattern),
                "pass": True,
            }
        ],
        "rejected_before_model_calls": rejected,
        "all_retained_screens_pass": all(
            row["exact_represented_core_round_trip"] for row in rows
        ),
    }


NATIVE_TASKS: dict[str, dict[str, Any]] = {
    "exact-json": {
        "instruction": (
            "Use the exact object. Return note_id, start, and articulation for the lead note "
            "with the non-grid start 1001/960."
        ),
        "source": "Use the supplied MEDIUM object.",
        "shape": {"note_id": "string", "start": "rational string", "articulation": "string"},
        "expected": {"note_id": "l-02", "start": "1001/960", "articulation": "legato"},
    },
    "compact-bar": {
        "instruction": (
            "Use the compact event view. Return note_id, track, and start for the event at "
            "1001/960 beat."
        ),
        "source": "Use the supplied MEDIUM view.",
        "shape": {"note_id": "string", "track": "string", "start": "rational string"},
        "expected": {"note_id": "l-02", "track": "lead", "start": "1001/960"},
    },
    "abc-2.1-side-ledger": {
        "instruction": "Read this ABC fragment. Return triplet_midi and chord_midi in written order.",
        "source": "X:1\nL:1/8\nM:4/4\nK:C\n(3CDE [CEG]2 |",
        "shape": {"triplet_midi": ["integer"], "chord_midi": ["integer"]},
        "expected": {"triplet_midi": [60, 62, 64], "chord_midi": [60, 64, 67]},
    },
    "alda-side-ledger": {
        "instruction": "Read this Alda phrase. Return its four MIDI pitches in written order.",
        "source": "piano: o4 c8 e g > c4",
        "shape": {"midi": ["integer"]},
        "expected": {"midi": [60, 64, 67, 72]},
    },
    "midi-like-task-profile": {
        "instruction": "Decode this native event fragment into note_id, start, duration, pitch, and velocity.",
        "source": (
            "TIME_SHIFT_1/3 NOTE_ID_x VELOCITY_80 NOTE_ON_60\n"
            "TIME_SHIFT_2/3 NOTE_ID_x NOTE_OFF_60"
        ),
        "shape": {
            "note_id": "string",
            "start": "rational string",
            "duration": "rational string",
            "pitch": "integer",
            "velocity": "integer",
        },
        "expected": {
            "note_id": "x",
            "start": "1/3",
            "duration": "2/3",
            "pitch": 60,
            "velocity": 80,
        },
    },
    "remi-plus-task-profile": {
        "instruction": "Decode this native compound event into note_id, start, duration, pitch, and velocity.",
        "source": (
            "<Bar=1> <Position=1/3> <Track=lead> <NoteID=x> "
            "<Pitch=60> <Velocity=80> <Duration=2/3>"
        ),
        "shape": {
            "note_id": "string",
            "start": "rational string",
            "duration": "rational string",
            "pitch": "integer",
            "velocity": "integer",
        },
        "expected": {
            "note_id": "x",
            "start": "1/3",
            "duration": "2/3",
            "pitch": 60,
            "velocity": 80,
        },
    },
    "octuple-midi-task-profile": {
        "instruction": "Decode this native compound event into note_id, start, duration, pitch, and velocity.",
        "source": (
            "NOTE(BAR=1,POSITION=1/3,TRACK=lead,ID=x,PITCH=60,DURATION=2/3,"
            "VELOCITY=80,TIMESIG=4/4,TEMPO=120)"
        ),
        "shape": {
            "note_id": "string",
            "start": "rational string",
            "duration": "rational string",
            "pitch": "integer",
            "velocity": "integer",
        },
        "expected": {
            "note_id": "x",
            "start": "1/3",
            "duration": "2/3",
            "pitch": 60,
            "velocity": 80,
        },
    },
    "strudel-mini-notation": {
        "instruction": (
            "Expand one cycle of the Strudel mini-notation. Return counts by value and exact "
            "onsets by value as rational strings."
        ),
        "source": "[bd sd, hh*4]",
        "shape": {
            "counts": {"bd": "integer", "sd": "integer", "hh": "integer"},
            "onsets": {
                "bd": ["rational string"],
                "sd": ["rational string"],
                "hh": ["rational string"],
            },
        },
        "expected": {
            "counts": {"bd": 1, "sd": 1, "hh": 4},
            "onsets": {"bd": ["0"], "sd": ["1/2"], "hh": ["0", "1/4", "1/2", "3/4"]},
        },
    },
}


def grammar_text(format_id: str) -> str:
    return {
        "exact-json": (
            "The JSON object is exact. Each note record includes all observed benchmark fields."
        ),
        "compact-bar": (
            "BAR gives absolute start, length, meter, and harmony. TRACK gives role and voice. "
            "NOTE gives opaque ID, track, exact rational position and duration, MIDI pitch, and velocity."
        ),
        "abc-2.1-side-ledger": (
            "The ABC score view uses ABC 2.1 labels. Each % GN line is a counted side ledger with "
            "opaque ID and exact task fields."
        ),
        "alda-side-ledger": (
            "The Alda score view groups notes by part. Each # GN line is a counted side ledger with "
            "opaque ID and exact task fields."
        ),
        "midi-like-task-profile": (
            "TIME_SHIFT advances the current track cursor. NOTE_ON and NOTE_OFF share NOTE_ID. "
            "Task extensions give bars, harmony, roles, and opaque IDs."
        ),
        "remi-plus-task-profile": (
            "Each compound note gives bar-relative position, track, opaque ID, pitch, velocity, "
            "and duration. Bar records give absolute starts."
        ),
        "octuple-midi-task-profile": (
            "Each compound note gives bar, rational position, track, opaque ID, pitch, duration, "
            "velocity, meter, and tempo. Bar records give absolute starts."
        ),
    }[format_id]


def invalid_patch(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": PATCH_SCHEMA,
        "base_sha256": "stale",
        "ops": [
            {"op": "move", "note_id": "not-a-note", "start": "1/3"},
            {"op": "move", "note_id": "l-05", "start": "-1"},
        ],
    }


def expected_structure() -> dict[str, Any]:
    return {
        "meter_sequence": ["4/4", "4/4", "3/4", "5/4"],
        "harmony_sequence": ["Cmaj9#11", "E7alt", "Am11", "D-quartal"],
        "bar2_keys_pitches": [52, 56, 62, 65, 70],
        "descending_bar2_lead_ids": ["l-05", "l-06", "l-07", "l-08"],
        "performed_offsets": {"l-02": "1001/960", "d-02": "49/24"},
    }


def task_prompt(
    format_id: str,
    rendered: dict[str, str],
    corpus: dict[str, dict[str, Any]],
) -> str:
    medium = corpus["medium"]
    native = NATIVE_TASKS[format_id]
    profile = FORMAT_PROFILES[format_id]
    return f"""You evaluate one symbolic music representation. Use only the supplied text.
Return one JSON object and no markdown. Keep host-only fields outside each patch.

Representation: {format_id}
Family: {profile['family']}
Native purpose: {profile['native_purpose']}
Grammar: {grammar_text(format_id)}
Exact rational times use beats. One beat is one quarter note.
Use MEDIUM for structural fields and patches. Use SHORT for reconstruction.
Use LONG only to inspect repeated material. Return descending_bar2_lead_ids in
performed-time order.

Return these keys:
- structural: meter_sequence, harmony_sequence, bar2_keys_pitches,
  descending_bar2_lead_ids, and performed_offsets. performed_offsets maps l-02
  and d-02 to exact rational starts.
- reconstruction: reconstruct every SHORT note with id, track, start, duration,
  pitch, and velocity. Do not add fields.
- transform_patch: transpose only l-05, l-06, l-07, and l-08 up one semitone.
- transfer_patch: copy the exact starts and durations of those four lead notes
  to four new bass notes. Use IDs new-r1 through new-r4 and E7alt pitches 44,
  46, 50, and 56 in that order. Use velocity 82 for all four.
- continuation_patch: continue the lead with four notes. Use IDs new-c1 through
  new-c4, starts 16, 50/3, 17, and 53/3, durations 2/3, 1/3, 2/3, and 1/3,
  velocities 88, 84, 90, and 86, and pitches selected from G13alt
  {{55, 59, 62, 65, 68}}. End on pitch 55.
- invalid_patch_echo: copy the supplied invalid patch without repair.
- label_control: return status unavailable. The masked control has labels but no
  musical values.
- native_answer: {native['instruction']}
  Use this exact object shape: {canonical(native['shape'])}
- explanation: one concise sentence about the representation.

Each patch uses schema {PATCH_SCHEMA}, base_sha256 {medium['sha256']}, and ops.
Use transpose, move, or insert only. A transpose op has note_ids and semitones.
An insert op has notes and default_policy track-neutral-v0. Inserted notes contain
only id, track, start, duration, pitch, and velocity. The compiler supplies
channel, mute, release velocity, articulation, and expression. Existing-note
operations preserve every unnamed field.

Each named patch must be a complete patch object. Follow this literal shape:
{canonical({'schema': PATCH_SCHEMA, 'base_sha256': medium['sha256'], 'ops': [{'op': 'move', 'note_id': 'l-05', 'start': '4'}]})}
For transpose, use one operation with note_ids as a list:
{canonical({'schema': PATCH_SCHEMA, 'base_sha256': medium['sha256'], 'ops': [{'op': 'transpose', 'note_ids': ['l-05'], 'semitones': 1}]})}
For insert, use one operation with notes as a list:
{canonical({'schema': PATCH_SCHEMA, 'base_sha256': medium['sha256'], 'ops': [{'op': 'insert', 'default_policy': 'track-neutral-v0', 'notes': [{'id': 'example-only', 'track': 'lead', 'start': '16', 'duration': '1', 'pitch': 60, 'velocity': 80}]}]})}

Invalid patch fixture:
{canonical(invalid_patch(medium))}

Masked label control:
BAR MASK METER MASK HARMONY MASK NOTE MASK POSITION MASK DURATION MASK PITCH MASK VELOCITY MASK

Native task source:
{native['source']}

SHORT
{rendered['short']}

MEDIUM
{rendered['medium']}

LONG
{rendered['long']}
"""


def strudel_prompt() -> str:
    native = NATIVE_TASKS["strudel-mini-notation"]
    return f"""You evaluate one Strudel mini-notation pattern.
Return one JSON object and no markdown. Use one cycle from 0 inclusive to 1 exclusive.
Mini-notation grammar for this task: comma superposes patterns; space sequences
equal spans; *4 repeats a value four times inside its span.

Return exactly one top-level key named native_answer. Its value must use this
object shape: {canonical(native['shape'])}
Task: {native['instruction']}
Source: {native['source']}
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
            copied["start"] = fraction_text(copied["start"])
            copied["duration"] = fraction_text(copied["duration"])
        except (TypeError, ValueError, ZeroDivisionError):
            continue
        result.append(copied)
    return sorted(result, key=note_sort_key)


def patch_errors(patch: Any, base: dict[str, Any]) -> list[str]:
    errors = []
    if not isinstance(patch, dict):
        return ["patch is not an object"]
    if patch.get("schema") != PATCH_SCHEMA:
        errors.append(f"schema must be {PATCH_SCHEMA}")
    if patch.get("base_sha256") != base["sha256"]:
        errors.append(f"base_sha256 must be {base['sha256']}")
    source_notes = {value["id"]: value for value in base["notes"]}
    known_ids = set(source_notes)
    operations = patch.get("ops")
    if not isinstance(operations, list):
        errors.append("ops must be a list")
        return errors
    for index, operation in enumerate(operations):
        if not isinstance(operation, dict):
            errors.append(f"op {index} is not an object")
            continue
        name = operation.get("op")
        if name == "transpose":
            note_ids = operation.get("note_ids")
            if not isinstance(note_ids, list) or not note_ids:
                errors.append(f"op {index} note_ids must be a non-empty list")
                continue
            for note_id in note_ids:
                if note_id not in source_notes:
                    errors.append(f"op {index} unknown note ID {note_id}")
            if not isinstance(operation.get("semitones"), int):
                errors.append(f"op {index} semitones must be an integer")
        elif name == "move":
            note_id = operation.get("note_id")
            if note_id not in source_notes:
                errors.append(f"op {index} unknown note ID {note_id}")
            try:
                if fraction(operation.get("start")) < 0:
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
                missing = [field for field in INSERT_FIELDS if field not in value]
                if missing:
                    errors.append(f"op {index} inserted note misses {','.join(missing)}")
                    continue
                forbidden = [field for field in FULL_NOTE_FIELDS[6:] if field in value]
                if forbidden:
                    errors.append(f"op {index} must omit host-only fields {','.join(forbidden)}")
                if value["id"] in known_ids:
                    errors.append(f"op {index} duplicate note ID {value['id']}")
                known_ids.add(value["id"])
                if value["track"] not in {row["id"] for row in base["tracks"]}:
                    errors.append(f"op {index} inserted note has unknown track {value['track']}")
                if not isinstance(value["pitch"], int) or not 0 <= value["pitch"] <= 127:
                    errors.append(f"op {index} inserted pitch is outside MIDI range")
                if not isinstance(value["velocity"], int) or not 1 <= value["velocity"] <= 127:
                    errors.append(f"op {index} inserted velocity is outside MIDI range")
                try:
                    if fraction(value["start"]) < 0 or fraction(value["duration"]) <= 0:
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
        elif operation["op"] == "move":
            notes[operation["note_id"]]["start"] = fraction_text(operation["start"])
        else:
            for value in operation["notes"]:
                normalized = deepcopy(value)
                normalized["start"] = fraction_text(normalized["start"])
                normalized["duration"] = fraction_text(normalized["duration"])
                channels = {
                    row["channel"] for row in base["notes"] if row["track"] == normalized["track"]
                }
                if len(channels) != 1:
                    raise ValueError("track-neutral-v0 needs one source channel")
                normalized.update(
                    {
                        "channel": channels.pop(),
                        "muted": False,
                        "release_velocity": 64,
                        "articulation": "normal",
                        "expression": {"pressure": "0", "timbre": "0", "pan": "0", "gain": "1"},
                    }
                )
                notes[normalized["id"]] = normalized
    result = sorted(notes.values(), key=note_sort_key)
    for index, first in enumerate(result):
        for second in result[index + 1 :]:
            if first["track"] != second["track"] or first["pitch"] != second["pitch"]:
                continue
            if (
                fraction(first["start"]) < fraction(second["start"]) + fraction(second["duration"])
                and fraction(second["start"]) < fraction(first["start"]) + fraction(first["duration"])
            ):
                raise ValueError(f"notes {first['id']} and {second['id']} collide")
    return result


def diff_notes(expected: list[dict[str, Any]], actual: list[dict[str, Any]]) -> list[dict[str, Any]]:
    expected_by_id = {value["id"]: value for value in expected}
    actual_by_id = {value["id"]: value for value in actual}
    differences = []
    for note_id in sorted(expected_by_id.keys() | actual_by_id.keys()):
        if note_id not in actual_by_id:
            differences.append({"note_id": note_id, "kind": "missing-note"})
        elif note_id not in expected_by_id:
            differences.append({"note_id": note_id, "kind": "extra-note"})
        else:
            for field in FULL_NOTE_FIELDS:
                if actual_by_id[note_id].get(field) != expected_by_id[note_id].get(field):
                    differences.append(
                        {
                            "note_id": note_id,
                            "field": field,
                            "expected": expected_by_id[note_id].get(field),
                            "actual": actual_by_id[note_id].get(field),
                        }
                    )
    return differences


def expected_transformed(item: dict[str, Any]) -> list[dict[str, Any]]:
    result = deepcopy(item["notes"])
    for value in result:
        if value["id"] in {"l-05", "l-06", "l-07", "l-08"}:
            value["pitch"] += 1
    return result


def score_patch(name: str, patch: Any, item: dict[str, Any]) -> dict[str, Any]:
    totals = {"transform_patch": 1, "transfer_patch": 6, "continuation_patch": 7}
    errors = patch_errors(patch, item)
    if errors:
        return {
            "valid": False,
            "constraints_passed": 0,
            "constraints_total": totals[name],
            "errors": errors,
        }
    try:
        compiled = compile_patch(patch, item)
    except ValueError as error:
        return {
            "valid": False,
            "constraints_passed": 0,
            "constraints_total": totals[name],
            "errors": [str(error)],
        }
    before = {value["id"]: value for value in item["notes"]}
    after = {value["id"]: value for value in compiled}
    if name == "transform_patch":
        checks = [not diff_notes(expected_transformed(item), compiled)]
    elif name == "transfer_patch":
        inserted = [after.get(f"new-r{index}") for index in range(1, 5)]
        expected = [
            ("4", "1", 44, 82),
            ("5", "1", 46, 82),
            ("6", "1", 50, 82),
            ("7", "1", 56, 82),
        ]
        checks = [
            all(inserted),
            all(value and value["track"] == "bass" for value in inserted),
            all(
                value
                and (
                    value["start"],
                    value["duration"],
                    value["pitch"],
                    value["velocity"],
                )
                == target
                for value, target in zip(inserted, expected)
            ),
            all(value and value["channel"] == 1 and value["muted"] is False for value in inserted),
            all(value and value["release_velocity"] == 64 for value in inserted),
            all(after[note_id] == value for note_id, value in before.items()),
        ]
    else:
        inserted = [after.get(f"new-c{index}") for index in range(1, 5)]
        expected_times = [("16", "2/3"), ("50/3", "1/3"), ("17", "2/3"), ("53/3", "1/3")]
        allowed = {55, 59, 62, 65, 68}
        checks = [
            all(inserted),
            all(value and value["track"] == "lead" for value in inserted),
            all(
                value and (value["start"], value["duration"]) == target
                for value, target in zip(inserted, expected_times)
            ),
            all(value and value["pitch"] in allowed for value in inserted),
            bool(inserted[-1]) and inserted[-1]["pitch"] == 55,
            [value["velocity"] for value in inserted if value] == [88, 84, 90, 86],
            all(after[note_id] == value for note_id, value in before.items()),
        ]
    return {
        "valid": True,
        "constraints_passed": sum(bool(value) for value in checks),
        "constraints_total": len(checks),
        "checks": checks,
    }


def mapping_differences(expected: dict[str, Any], actual: Any) -> list[dict[str, Any]]:
    if not isinstance(actual, dict):
        return [{"kind": "not-object"}]
    return [
        {"field": field, "expected": value, "actual": actual.get(field)}
        for field, value in expected.items()
        if actual.get(field) != value
    ]


def validate_initial(
    format_id: str,
    result: dict[str, Any],
    corpus: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    required = {
        "structural",
        "reconstruction",
        "transform_patch",
        "transfer_patch",
        "continuation_patch",
        "invalid_patch_echo",
        "label_control",
        "native_answer",
        "explanation",
    }
    structure_differences = mapping_differences(expected_structure(), result.get("structural"))
    expected_reconstruction = [core_note(value) for value in corpus["short"]["notes"]]
    reconstruction = normalized_core(result.get("reconstruction"))
    patch_scores = {
        name: score_patch(name, result.get(name), corpus["medium"])
        for name in ("transform_patch", "transfer_patch", "continuation_patch")
    }
    echo_errors = patch_errors(result.get("invalid_patch_echo"), corpus["medium"])
    label_control = result.get("label_control")
    label_pass = label_control == "unavailable" or (
        isinstance(label_control, dict) and label_control.get("status") == "unavailable"
    )
    native_differences = mapping_differences(
        NATIVE_TASKS[format_id]["expected"], result.get("native_answer")
    )
    objective_passed = (
        len(expected_structure())
        - len(structure_differences)
        + int(reconstruction == expected_reconstruction)
        + sum(score["constraints_passed"] for score in patch_scores.values())
        + int(label_pass)
        + int(not native_differences)
    )
    objective_total = (
        len(expected_structure())
        + 1
        + sum(score["constraints_total"] for score in patch_scores.values())
        + 1
        + 1
    )
    return {
        "schema_valid": not (required - result.keys()),
        "missing_keys": sorted(required - result.keys()),
        "structure": {
            "correct": len(expected_structure()) - len(structure_differences),
            "total": len(expected_structure()),
            "differences": structure_differences,
        },
        "reconstruction": {
            "exact": reconstruction == expected_reconstruction,
            "expected_count": len(expected_reconstruction),
            "actual_count": len(reconstruction),
            "sha256": digest(reconstruction),
        },
        "patches": patch_scores,
        "invalid_patch_errors": echo_errors,
        "invalid_patch_exposed_all_errors": (
            any("base_sha256" in error for error in echo_errors)
            and any("unknown note ID" in error for error in echo_errors)
            and any("below 0" in error for error in echo_errors)
        ),
        "label_control_pass": label_pass,
        "native": {"correct": not native_differences, "differences": native_differences},
        "objective_passed": objective_passed,
        "objective_total": objective_total,
    }


def validate_strudel(result: dict[str, Any]) -> dict[str, Any]:
    differences = mapping_differences(
        NATIVE_TASKS["strudel-mini-notation"]["expected"], result.get("native_answer")
    )
    return {
        "schema_valid": set(result) == {"native_answer"},
        "native": {"correct": not differences, "differences": differences},
        "objective_passed": int(not differences),
        "objective_total": 1,
    }


def repair_prompt(errors: list[str], item: dict[str, Any]) -> str:
    return (
        "The deterministic compiler rejected the invalid patch. Repair the intended operation. "
        "Move existing note l-05 to beat 13/3. Return only one JSON patch. Preserve every other "
        f"note and field. Use schema {PATCH_SCHEMA} and base_sha256 {item['sha256']}. "
        f"Compiler errors: {canonical(errors)}"
    )


def validate_repair(patch: Any, item: dict[str, Any]) -> dict[str, Any]:
    errors = patch_errors(patch, item)
    if errors:
        return {"valid": False, "correct": False, "errors": errors}
    try:
        compiled = compile_patch(patch, item)
    except ValueError as error:
        return {"valid": False, "correct": False, "errors": [str(error)]}
    expected = deepcopy(item["notes"])
    for value in expected:
        if value["id"] == "l-05":
            value["start"] = "13/3"
    differences = diff_notes(expected, compiled)
    return {"valid": True, "correct": not differences, "errors": [], "differences": differences}


def perfect_response(format_id: str, corpus: dict[str, dict[str, Any]]) -> dict[str, Any]:
    medium = corpus["medium"]
    return {
        "structural": expected_structure(),
        "reconstruction": [core_note(value) for value in corpus["short"]["notes"]],
        "transform_patch": {
            "schema": PATCH_SCHEMA,
            "base_sha256": medium["sha256"],
            "ops": [
                {
                    "op": "transpose",
                    "note_ids": ["l-05", "l-06", "l-07", "l-08"],
                    "semitones": 1,
                }
            ],
        },
        "transfer_patch": {
            "schema": PATCH_SCHEMA,
            "base_sha256": medium["sha256"],
            "ops": [
                {
                    "op": "insert",
                    "default_policy": "track-neutral-v0",
                    "notes": [
                        {
                            "id": f"new-r{index}",
                            "track": "bass",
                            "start": str(3 + index),
                            "duration": "1",
                            "pitch": pitch,
                            "velocity": 82,
                        }
                        for index, pitch in enumerate((44, 46, 50, 56), start=1)
                    ],
                }
            ],
        },
        "continuation_patch": {
            "schema": PATCH_SCHEMA,
            "base_sha256": medium["sha256"],
            "ops": [
                {
                    "op": "insert",
                    "default_policy": "track-neutral-v0",
                    "notes": [
                        {
                            "id": f"new-c{index}",
                            "track": "lead",
                            "start": start,
                            "duration": duration,
                            "pitch": pitch,
                            "velocity": velocity,
                        }
                        for index, (start, duration, pitch, velocity) in enumerate(
                            (
                                ("16", "2/3", 59, 88),
                                ("50/3", "1/3", 62, 84),
                                ("17", "2/3", 68, 90),
                                ("53/3", "1/3", 55, 86),
                            ),
                            start=1,
                        )
                    ],
                }
            ],
        },
        "invalid_patch_echo": invalid_patch(medium),
        "label_control": {"status": "unavailable"},
        "native_answer": NATIVE_TASKS[format_id]["expected"],
        "explanation": "The response uses only represented fields.",
    }


def task_manifest() -> dict[str, Any]:
    corpus = make_corpus()
    views = render_corpus(corpus)
    prompts = {
        format_id: task_prompt(format_id, views[format_id], corpus)
        for format_id in ROUND_TRIP_FORMATS
    }
    prompts["strudel-mini-notation"] = strudel_prompt()
    return {
        "schema": BENCHMARK_SCHEMA,
        "tasks": [
            "format-native",
            "structural questions",
            "represented-core reconstruction",
            "local transformation",
            "structural transfer",
            "continuation",
            "repair",
            "sparse identity edit",
            "masked-value refusal",
        ],
        "native_tasks": NATIVE_TASKS,
        "prompt_sha256": {name: sha256_text(value) for name, value in prompts.items()},
        "sha256": digest({name: sha256_text(value) for name, value in prompts.items()}),
    }


def parse_json_text(text: str) -> dict[str, Any]:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        if stripped.startswith("json"):
            stripped = stripped[4:]
    start, end = stripped.find("{"), stripped.rfind("}")
    if start < 0 or end < start:
        raise ValueError("response did not contain a JSON object")
    value = json.loads(stripped[start : end + 1])
    if not isinstance(value, dict):
        raise ValueError("response was not a JSON object")
    return value


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
    request = urllib.request.Request(
        url,
        data=canonical(payload).encode(),
        method="POST",
        headers={"Content-Type": "application/json", **headers},
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.load(response)


def model_call(
    provider: str,
    key: str,
    messages: list[dict[str, str]],
    max_tokens: int,
) -> tuple[dict[str, Any], dict[str, Any]]:
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
                "temperature": 0,
                "responseMimeType": "application/json",
                "maxOutputTokens": max_tokens,
                "thinkingConfig": {"thinkingLevel": "low"},
            },
        },
    )
    response_text = "".join(
        part.get("text", "") for part in raw["candidates"][0]["content"]["parts"]
    )
    return parse_json_text(response_text), raw


def measured_usage(provider: str, raw: dict[str, Any]) -> dict[str, int]:
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


def call_with_retry(
    provider: str,
    key: str,
    messages: list[dict[str, str]],
    max_tokens: int,
) -> tuple[dict[str, Any], dict[str, Any], float, int]:
    retries = 0
    started = time.perf_counter()
    for delay in (0, 2, 4, 8):
        if delay:
            time.sleep(delay)
        try:
            result, raw = model_call(provider, key, messages, max_tokens)
            return result, raw, (time.perf_counter() - started) * 1000, retries
        except (json.JSONDecodeError, ValueError):
            if retries == 3:
                raise
            retries += 1
        except urllib.error.HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504} or retries == 3:
                raise
            retries += 1
    raise AssertionError("retry loop did not return or raise")


def run_provider(provider: str, env_file: Path) -> dict[str, Any]:
    environment = load_env(env_file)
    key_name = "OPENAI_API_KEY" if provider == "openai" else "GEMINI_API_KEY"
    if not environment.get(key_name):
        raise ValueError(f"{key_name} is missing")
    screen = deterministic_screen()
    if not screen["all_retained_screens_pass"]:
        raise ValueError("A retained deterministic capability screen failed")
    corpus = make_corpus()
    views = render_corpus(corpus)
    rows = []
    raw_hashes = []
    note_count = sum(len(value["notes"]) for value in corpus.values())
    bar_count = sum(len(value["bars"]) for value in corpus.values())
    for format_id in FORMAT_ORDER:
        if format_id == "strudel-mini-notation":
            prompt = strudel_prompt()
        else:
            prompt = task_prompt(format_id, views[format_id], corpus)
        initial, raw, latency_ms, retries = call_with_retry(
            provider,
            environment[key_name],
            [{"role": "user", "content": prompt}],
            12_000,
        )
        raw_sha256 = digest(raw)
        raw_hashes.append(raw_sha256)
        validation = (
            validate_strudel(initial)
            if format_id == "strudel-mini-notation"
            else validate_initial(format_id, initial, corpus)
        )
        repair = None
        if format_id in ROUND_TRIP_FORMATS:
            repair_text = repair_prompt(validation["invalid_patch_errors"], corpus["medium"])
            repaired, repair_raw, repair_latency_ms, repair_retries = call_with_retry(
                provider,
                environment[key_name],
                [
                    {"role": "user", "content": prompt},
                    {"role": "assistant", "content": canonical(initial)},
                    {"role": "user", "content": repair_text},
                ],
                2_000,
            )
            repair_raw_sha256 = digest(repair_raw)
            raw_hashes.append(repair_raw_sha256)
            repair = {
                "prompt_sha256": sha256_text(repair_text),
                "latency_ms": repair_latency_ms,
                "retries": repair_retries,
                "usage": measured_usage(provider, repair_raw),
                "returned_model": returned_model(provider, repair_raw),
                "raw_response_sha256": repair_raw_sha256,
                "response": repaired,
                "validation": validate_repair(repaired, corpus["medium"]),
            }
        usage = measured_usage(provider, raw)
        prompt_lexemes = len(prompt.split())
        rows.append(
            {
                "format": format_id,
                "prompt_sha256": sha256_text(prompt),
                "prompt_bytes": len(prompt.encode()),
                "prompt_lexemes": prompt_lexemes,
                "input_tokens_per_lexeme": usage["input_tokens"] / prompt_lexemes,
                "input_tokens_per_note": (
                    usage["input_tokens"] / note_count
                    if format_id in ROUND_TRIP_FORMATS
                    else None
                ),
                "input_tokens_per_bar": (
                    usage["input_tokens"] / bar_count
                    if format_id in ROUND_TRIP_FORMATS
                    else None
                ),
                "latency_ms": latency_ms,
                "retries": retries,
                "usage": usage,
                "returned_model": returned_model(provider, raw),
                "request_id": raw.get("id"),
                "raw_response_sha256": raw_sha256,
                "response": initial,
                "validation": validation,
                "repair": repair,
            }
        )
    run = {
        "schema": BENCHMARK_SCHEMA,
        "run_kind": "provider-dependent",
        "provider": provider,
        "requested_model": OPENAI_MODEL if provider == "openai" else GEMINI_MODEL,
        "client": "Python urllib.request direct HTTPS",
        "settings": {
            "response": "JSON object",
            "reasoning_or_thinking": "low",
            "temperature": None if provider == "openai" else 0,
            "max_initial_output_tokens": 12_000,
            "max_repair_output_tokens": 2_000,
            "retry_delays_seconds": [2, 4, 8],
        },
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "python": platform.python_version(),
        "privacy": "Generated symbolic notes only. No live project, MIDI file, or audio was sent.",
        "corpus": corpus_manifest(corpus),
        "tasks": task_manifest(),
        "screen_sha256": digest(screen),
        "represented_notes_per_round_trip_prompt": note_count,
        "represented_bars_per_round_trip_prompt": bar_count,
        "results": rows,
        "raw_run_sha256": digest(raw_hashes),
    }
    run["manifest_sha256"] = digest(run)
    return run


def summarize(paths: list[Path]) -> dict[str, Any]:
    runs = [json.loads(path.read_text()) for path in paths]
    rows = []
    for run in runs:
        for item in run["results"]:
            validation = item["validation"]
            patches = validation.get("patches", {})
            rows.append(
                {
                    "provider": run["provider"],
                    "model": item["returned_model"],
                    "format": item["format"],
                    "objective_passed": validation["objective_passed"],
                    "objective_total": validation["objective_total"],
                    "schema_valid": validation["schema_valid"],
                    "structure_correct": validation.get("structure", {}).get("correct"),
                    "reconstruction_exact": validation.get("reconstruction", {}).get("exact"),
                    "patches_valid": sum(score["valid"] for score in patches.values()),
                    "patches_total": len(patches),
                    "constraints_passed": sum(
                        score["constraints_passed"] for score in patches.values()
                    ),
                    "constraints_total": sum(
                        score["constraints_total"] for score in patches.values()
                    ),
                    "native_correct": validation["native"]["correct"],
                    "repair_correct": (
                        item["repair"]["validation"]["correct"] if item["repair"] else None
                    ),
                    "input_tokens": item["usage"]["input_tokens"],
                    "output_tokens": item["usage"]["output_tokens"],
                    "input_tokens_per_note": item["input_tokens_per_note"],
                    "input_tokens_per_bar": item["input_tokens_per_bar"],
                    "input_tokens_per_lexeme": item["input_tokens_per_lexeme"],
                    "latency_ms": item["latency_ms"],
                    "retries": item["retries"],
                }
            )
    result = {
        "schema": BENCHMARK_SCHEMA,
        "run_kind": "provider-summary",
        "source_files": [str(path) for path in paths],
        "rows": rows,
        "raw_run_sha256": {run["provider"]: run["raw_run_sha256"] for run in runs},
    }
    result["sha256"] = digest(result)
    return result


def deterministic_package() -> dict[str, Any]:
    value = {
        "schema": BENCHMARK_SCHEMA,
        "run_kind": "deterministic",
        "screen": deterministic_screen(),
        "tasks": task_manifest(),
    }
    value["sha256"] = digest(value)
    return value


def self_test() -> dict[str, Any]:
    corpus = make_corpus()
    screen = deterministic_screen()
    assert [len(corpus[name]["notes"]) for name in ("short", "medium", "long")] == [12, 47, 94]
    assert [len(corpus[name]["bars"]) for name in ("short", "medium", "long")] == [1, 4, 8]
    assert screen["all_retained_screens_pass"]
    assert len(screen["round_trip_rows"]) == len(ROUND_TRIP_FORMATS) * len(corpus)
    for format_id in ROUND_TRIP_FORMATS:
        validation = validate_initial(format_id, perfect_response(format_id, corpus), corpus)
        assert validation["schema_valid"]
        assert validation["objective_passed"] == validation["objective_total"] == 22
        assert validation["invalid_patch_exposed_all_errors"]
    repaired = {
        "schema": PATCH_SCHEMA,
        "base_sha256": corpus["medium"]["sha256"],
        "ops": [{"op": "move", "note_id": "l-05", "start": "13/3"}],
    }
    assert validate_repair(repaired, corpus["medium"])["correct"]
    assert validate_strudel(
        {"native_answer": NATIVE_TASKS["strudel-mini-notation"]["expected"]}
    )["objective_passed"] == 1
    result = {
        "schema": BENCHMARK_SCHEMA,
        "passed": 10 + len(ROUND_TRIP_FORMATS),
        "corpus_sha256": corpus_manifest(corpus)["sha256"],
        "deterministic_sha256": deterministic_package()["sha256"],
    }
    return result


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
    actions.add_argument("--provider", choices=("openai", "gemini"))
    actions.add_argument("--summarize", nargs="+", type=Path)
    parser.add_argument("--env-file", type=Path, default=Path(".env"))
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.self_test:
        value = self_test()
    elif args.deterministic:
        value = deterministic_package()
    elif args.check:
        expected = json.loads(args.check.read_text())
        actual = deterministic_package()
        if actual != expected:
            print(
                canonical(
                    {
                        "expected_sha256": expected.get("sha256"),
                        "actual_sha256": actual.get("sha256"),
                    }
                ),
                file=sys.stderr,
            )
            raise SystemExit(1)
        value = {"schema": BENCHMARK_SCHEMA, "check": "pass", "sha256": actual["sha256"]}
    elif args.provider:
        value = run_provider(args.provider, args.env_file)
    else:
        value = summarize(args.summarize)
    write_result(value, args.output)


if __name__ == "__main__":
    main()
