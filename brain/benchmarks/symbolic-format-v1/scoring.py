#!/usr/bin/env python3
"""Score deterministic musical tasks for the symbolic-format v1 benchmark."""

from __future__ import annotations

import itertools
import re
from collections import defaultdict
from copy import deepcopy
from fractions import Fraction
from typing import Any

from corpus import fraction, fraction_text, note, sort_notes
from formats import (
    FIELDS,
    IDENTITY_ARMS,
    MUSICAL_FIELDS,
    VELOCITY_ARMS,
    compile_patch,
    parse_events,
    parse_patch,
    projected,
    render_events,
    render_patch,
)


VOICE_ORDER = ("bass", "tenor", "alto", "soprano")


def source_notes(task: dict[str, Any]) -> list[dict[str, Any]]:
    source = task.get("source", {})
    if "notes" in source:
        return source["notes"]
    if "source" in source and "notes" in source["source"]:
        return source["source"]["notes"]
    if "seed" in source:
        return source["seed"]
    return source.get("source", [])


def metadata(task: dict[str, Any]) -> dict[str, Any]:
    source = task.get("source", {})
    if "source" in source:
        source = source["source"]
    return source if isinstance(source, dict) else {}


def analysis_payload(value: dict[str, Any]) -> str:
    order = ("root_pc", "bass_pc", "quality", "inversion", "function", "motif_relation", "rhythm")
    return "ANALYSIS " + " ".join(f"{name}={value[name]}" for name in order)


def parse_analysis(payload: str) -> dict[str, Any]:
    if not payload.strip().startswith("ANALYSIS "):
        raise ValueError("Analysis payload needs ANALYSIS")
    fields = {}
    for token in payload.strip().split()[1:]:
        name, value = token.split("=", 1)
        fields[name] = int(value) if name in {"root_pc", "bass_pc", "inversion"} else value
    required = {"root_pc", "bass_pc", "quality", "inversion", "function", "motif_relation", "rhythm"}
    if set(fields) != required:
        raise ValueError("Analysis payload has incorrect fields")
    return fields


def notes_by_start(notes: list[dict[str, Any]]) -> dict[Fraction, list[dict[str, Any]]]:
    result: dict[Fraction, list[dict[str, Any]]] = defaultdict(list)
    for value in notes:
        result[fraction(value["start"])].append(value)
    return dict(sorted(result.items()))


def progression_candidates(contract: dict[str, Any], index: int) -> list[tuple[int, int, int, int]]:
    pitch_classes = contract["pitch_classes"][index]
    bass_pc = contract["bass_pitch_classes"][index]
    choices = []
    for voice in VOICE_ORDER:
        low, high = contract["voice_ranges"][voice]
        allowed = [value for value in range(low, high + 1) if value % 12 in pitch_classes]
        if voice == "bass":
            allowed = [value for value in allowed if value % 12 == bass_pc]
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
    selected: list[tuple[int, int, int, int]] = []
    for index in range(4):
        candidates = progression_candidates(contract, index)
        if not candidates:
            raise ValueError("Progression contract has no voicing")
        if not selected:
            choice = min(candidates, key=lambda value: sum(value))
        else:
            choice = min(candidates, key=lambda value: sum(abs(a - b) for a, b in zip(value, selected[-1])))
        selected.append(choice)
    notes = []
    for chord_index, pitches in enumerate(selected):
        for voice, pitch in zip(VOICE_ORDER, pitches):
            notes.append(note(f"g{chord_index + 1}-{voice}", voice, chord_index, 1, pitch, 82))
    return sort_notes(notes)


def score_progression(notes: list[dict[str, Any]], contract: dict[str, Any]) -> dict[str, bool]:
    groups = notes_by_start(notes)
    starts = [fraction(value) for value in contract["chord_starts"]]
    checks: dict[str, bool] = {
        "four_chords": list(groups) == starts,
        "four_named_voices": all({value["voice"] for value in groups.get(start, [])} == set(VOICE_ORDER) for start in starts),
    }
    ordered = []
    harmony = True
    inversions = True
    ranges = True
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
    cost = sum(sum(abs(a - b) for a, b in zip(previous, current)) for previous, current in zip(ordered, ordered[1:]))
    checks.update(
        {
            "harmony": harmony and len(ordered) == 4,
            "inversions": inversions and len(ordered) == 4,
            "ranges": ranges and len(ordered) == 4,
            "no_voice_crossing": not crossing and len(ordered) == 4,
            "voice_leading": len(ordered) == 4 and cost <= contract["maximum_total_voice_leading"],
            "authentic_cadence": len(ordered) == 4 and {pitch % 12 for pitch in ordered[-1]} >= set(contract["pitch_classes"][-1]) and ordered[-1][0] % 12 == contract["key_tonic_pc"],
        }
    )
    return checks


def perfect_melody(contract: dict[str, Any]) -> list[dict[str, Any]]:
    tonic = contract["cadence_pitch_class"]
    base = [67 + tonic, 60 + tonic, 67 + tonic, 67 + tonic]
    pitches = base + [value + contract["motif_transposition"] for value in base]
    return [note(f"mel-{index + 1}", "lead", start, duration, pitch, 88) for index, (start, duration, pitch) in enumerate(zip(contract["starts"], contract["durations"], pitches))]


def score_melody(notes: list[dict[str, Any]], contract: dict[str, Any]) -> dict[str, bool]:
    ordered = sort_notes(notes)
    starts = [value["start"] for value in ordered]
    pitches = [value["pitch"] for value in ordered]
    strong = [value for value in ordered if fraction(value["start"]).denominator == 1]
    return {
        "note_count": len(ordered) == contract["note_count"],
        "rhythm": starts == contract["starts"] and [value["duration"] for value in ordered] == contract["durations"],
        "range": all(contract["range"][0] <= value <= contract["range"][1] for value in pitches),
        "mode": all(value % 12 in contract["scale_pitch_classes"] for value in pitches),
        "strong_beat_harmony": all(value["pitch"] % 12 in contract["strong_beat_chord_pitch_classes"] for value in strong),
        "motif": len(pitches) == 8 and all(pitches[index + 4] - pitches[index] == contract["motif_transposition"] for index in range(4)),
        "cadence": bool(pitches) and pitches[-1] % 12 == contract["cadence_pitch_class"],
    }


def perfect_roles(contract: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    previous = {"bass": None, "lead": None}
    for index, (start, pitch_classes) in enumerate(zip(contract["starts"], contract["harmony_pitch_classes"])):
        for voice in ("bass", "lead"):
            low, high = contract["ranges"][voice]
            candidates = [value for value in range(low, high + 1) if value % 12 in pitch_classes]
            if index == len(contract["starts"]) - 1 and voice == "lead":
                candidates = [value for value in candidates if value % 12 == contract["cadence_pitch_class"]]
            pitch = min(candidates, key=lambda value: abs(value - previous[voice])) if previous[voice] is not None else candidates[0]
            previous[voice] = pitch
            result.append(note(f"role-{voice}-{index + 1}", voice, start, 1, pitch, 80 if voice == "bass" else 88))
    return sort_notes(result)


def score_roles(notes: list[dict[str, Any]], contract: dict[str, Any]) -> dict[str, bool]:
    groups = notes_by_start(notes)
    starts = [fraction(value) for value in contract["starts"]]
    role_rows = {voice: sorted([value for value in notes if value["voice"] == voice], key=lambda value: fraction(value["start"])) for voice in ("bass", "lead")}
    harmony = True
    for index, start in enumerate(starts):
        harmony &= all(value["pitch"] % 12 in contract["harmony_pitch_classes"][index] for value in groups.get(start, []))
    leaps = all(all(abs(b["pitch"] - a["pitch"]) <= contract["maximum_role_leap"] for a, b in zip(rows, rows[1:])) for rows in role_rows.values())
    return {
        "starts": list(groups) == starts,
        "role_density": all(len(rows) == 4 for rows in role_rows.values()) and len(notes) == 8,
        "ranges": all(contract["ranges"][value["voice"]][0] <= value["pitch"] <= contract["ranges"][value["voice"]][1] for value in notes if value["voice"] in contract["ranges"]),
        "strong_beat_harmony": harmony and len(notes) == 8,
        "voice_leading": leaps and len(notes) == 8,
        "no_collisions": all(len({value["pitch"] for value in groups.get(start, [])}) == len(groups.get(start, [])) for start in starts),
        "cadence": bool(role_rows["lead"]) and role_rows["lead"][-1]["pitch"] % 12 == contract["cadence_pitch_class"],
    }


def revoice_expected(value: dict[str, Any]) -> list[dict[str, Any]]:
    groups = notes_by_start(value["source"])
    result = []
    previous: list[int] | None = None
    for chord_index, (start, rows) in enumerate(groups.items()):
        pitches = sorted(item["pitch"] for item in rows)
        if value["operation"] == "drop-2":
            pitches[-2] -= 12
            pitches.sort()
        elif value["operation"] == "first-inversion":
            pitches = sorted(pitches[1:] + [pitches[0] + 12])
        else:
            if previous is not None:
                candidates = []
                for shifts in itertools.product((-12, 0, 12), repeat=len(pitches)):
                    candidate = sorted(pitch + shift for pitch, shift in zip(pitches, shifts))
                    if value["range"][0] <= candidate[0] and candidate[-1] <= value["range"][1]:
                        candidates.append(candidate)
                pitches = min(candidates, key=lambda candidate: sum(abs(a - b) for a, b in zip(previous, candidate)))
        previous = pitches
        for position, pitch in enumerate(pitches, start=1):
            result.append(note(f"rv-out-{chord_index + 1}-{position}", "keys", start, 1, pitch, 78))
    return sort_notes(result)


def expected_projection(arm: str, notes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    fields = MUSICAL_FIELDS + (("velocity",) if arm in VELOCITY_ARMS else ())
    return projected(notes, fields)


def score_response(arm: str, task: dict[str, Any], payload: str) -> dict[str, Any]:
    family = task["family"]
    try:
        if family == "comprehension-analysis":
            actual_analysis = parse_analysis(payload)
            alternatives = {
                "motif_relation": {"transposition": {"transposition", "transpose", "T2"}, "inversion": {"inversion", "invert"}, "augmentation": {"augmentation", "augment"}},
                "rhythm": {"sustained": {"sustained", "same", "uniform"}},
            }
            checks = {
                name: actual_analysis.get(name) in alternatives.get(name, {}).get(value, {value})
                for name, value in task["expected"].items()
            }
            return {"syntax_pass": True, "musical_pass": all(checks.values()), "checks": checks, "alignment": {"checked": False, "pass": None}}
        if family == "transformation-local" and arm in IDENTITY_ARMS:
            source = task["source"]["source"]
            compiled = compile_patch(parse_patch(arm, payload), source["notes"], source["sha256"])
            expected = task["expected"]
            before_by_id = {value["id"]: value for value in source["notes"]}
            after_by_id = {value["id"]: value for value in compiled}
            unchanged = sum(before_by_id[note_id] == after_by_id[note_id] for note_id in before_by_id.keys() & after_by_id.keys())
            checks = {
                "canonical_result": projected(compiled, tuple(FIELDS)) == projected(expected, tuple(FIELDS)),
                "stable_identity": {value["id"] for value in compiled}.issubset({value["id"] for value in source["notes"]}),
                "exact_preservation": unchanged >= len(source["notes"]) - 1,
                "sparse_change": len(parse_patch(arm, payload)["ops"]) == 1,
            }
            return {"syntax_pass": True, "musical_pass": all(checks.values()), "checks": checks, "alignment": {"checked": arm.endswith("-composite"), "pass": True if arm.endswith("-composite") else None}}
        notes, alignment = parse_events(arm, payload)
        if family == "comprehension-structure":
            checks = {"represented_reconstruction": expected_projection(arm, notes) == expected_projection(arm, task["expected"])}
        elif family == "generation-progression":
            checks = score_progression(notes, task["contract"])
        elif family == "generation-melody":
            checks = score_melody(notes, task["contract"])
        elif family == "continuation-motif":
            checks = {"exact_relation": expected_projection(arm, notes) == expected_projection(arm, task["expected"])}
        elif family == "continuation-roles":
            checks = score_roles(notes, task["contract"])
        elif family == "transformation-local":
            checks = {"canonical_result": expected_projection(arm, notes) == expected_projection(arm, task["expected"])}
        elif family == "transformation-revoice":
            expected = revoice_expected(task["source"])
            checks = {
                "named_voicing": projected(notes, MUSICAL_FIELDS) == projected(expected, MUSICAL_FIELDS),
                "harmony_preserved": [sorted(value["pitch"] % 12 for value in rows) for rows in notes_by_start(notes).values()] == [sorted(value["pitch"] % 12 for value in rows) for rows in notes_by_start(task["source"]["source"]).values()],
                "range": all(task["source"]["range"][0] <= value["pitch"] <= task["source"]["range"][1] for value in notes),
            }
        elif family == "transformation-rhythm":
            checks = {"exact_rhythm_relation": expected_projection(arm, notes) == expected_projection(arm, task["expected"])}
        else:
            raise ValueError(f"Unknown task family: {family}")
        return {"syntax_pass": True, "musical_pass": all(checks.values()), "checks": checks, "alignment": alignment}
    except (KeyError, TypeError, ValueError, re.error) as error:
        return {"syntax_pass": False, "musical_pass": False, "checks": {}, "alignment": {"checked": arm.endswith("-composite"), "pass": False if arm.endswith("-composite") else None}, "error": str(error)}


def perfect_payload(arm: str, task: dict[str, Any]) -> str:
    family = task["family"]
    if family == "comprehension-analysis":
        return analysis_payload(task["expected"])
    if family == "comprehension-structure":
        notes = task["expected"]
    elif family == "generation-progression":
        notes = perfect_progression(task["contract"])
    elif family == "generation-melody":
        notes = perfect_melody(task["contract"])
    elif family == "continuation-motif":
        notes = task["expected"]
    elif family == "continuation-roles":
        notes = perfect_roles(task["contract"])
    elif family == "transformation-local":
        if arm in IDENTITY_ARMS:
            change = task["source"]["change"]
            operation = {"op": "delete" if change["operation"] == "delete" else "set", "id": change["note_id"]}
            if operation["op"] == "set":
                field = "start" if change["operation"] == "timing" else change["operation"]
                operation[field] = change[field]
            return render_patch(arm, task["source"]["source"]["sha256"], [operation])
        notes = task["expected"]
    elif family == "transformation-revoice":
        notes = revoice_expected(task["source"])
    elif family == "transformation-rhythm":
        notes = task["expected"]
    else:
        raise ValueError(f"Unknown family: {family}")
    return render_events(arm, notes, metadata(task))
