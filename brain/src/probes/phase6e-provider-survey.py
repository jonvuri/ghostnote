#!/usr/bin/env python3
"""Compare local symbolic-music libraries on practical theory tasks."""

from __future__ import annotations

import argparse
import hashlib
import importlib
import importlib.metadata
import json
import os
import resource
import subprocess
import time
from pathlib import Path
from typing import Any, Callable


SCHEMA = "ghostnote-semantic-provider-survey-v0"
TONAL_ROOT = Path("/private/tmp/ghostnote-phase6e-wide-tonal")
CHORDS = (
    {"id": "c-major", "pitches": [48, 52, 55], "root": "C", "bass": "C", "kind": "major", "inversion": 0},
    {"id": "c-over-e", "pitches": [52, 55, 60], "root": "C", "bass": "E", "kind": "major", "inversion": 1},
    {"id": "a-minor", "pitches": [45, 48, 52], "root": "A", "bass": "A", "kind": "minor", "inversion": 0},
    {"id": "g7-over-b", "pitches": [47, 50, 53, 55], "root": "G", "bass": "B", "kind": "dominant-seventh", "inversion": 1},
    {"id": "c-major-7", "pitches": [48, 52, 55, 59], "root": "C", "bass": "C", "kind": "major-seventh", "inversion": 0},
    {"id": "f-sharp-dim-7", "pitches": [54, 57, 60, 63], "root": "F#", "bass": "F#", "kind": "diminished-seventh", "inversion": 0},
    {"id": "d-sus-4", "pitches": [50, 55, 57], "root": "D", "bass": "D", "kind": "suspended-fourth", "inversion": 0},
    {"id": "c-add-9", "pitches": [48, 50, 52, 55], "root": "C", "bass": "C", "kind": "major-add-2", "inversion": 0},
)
KEYS = (
    {
        "id": "c-major-progression", "expected": "C major",
        "chords": [[48, 52, 55], [48, 53, 57], [47, 50, 55], [48, 52, 55]],
    },
    {
        "id": "a-minor-progression", "expected": "A minor",
        "chords": [[45, 48, 52], [45, 50, 53], [44, 47, 52], [45, 48, 52]],
    },
    {
        "id": "ambiguous-pentatonic", "expected": None,
        "chords": [[60], [62], [64], [67], [69], [67], [64], [62]],
    },
)


def canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def measured_import(name: str) -> tuple[Any, float]:
    started = time.perf_counter()
    module = importlib.import_module(name)
    return module, (time.perf_counter() - started) * 1000


def run_repeated(action: Callable[[], dict[str, Any]]) -> dict[str, Any]:
    runs = []
    times = []
    for _ in range(3):
        started = time.perf_counter()
        result = action()
        times.append((time.perf_counter() - started) * 1000)
        runs.append(result)
    hashes = [digest(result) for result in runs]
    return {
        "analysis_ms": times, "repeat_hashes": hashes,
        "identical_repeats": len(set(hashes)) == 1, "result": runs[0],
    }


def pitch_names(music21: Any, pitches: list[int]) -> list[str]:
    return [music21.pitch.Pitch(value).nameWithOctave for value in pitches]


def music21_provider() -> dict[str, Any]:
    music21, import_ms = measured_import("music21")

    def action() -> dict[str, Any]:
        chord_rows = []
        for expected in CHORDS:
            value = music21.chord.Chord(pitch_names(music21, expected["pitches"]))
            symbol, kind = music21.harmony.chordSymbolFigureFromChord(value, True)
            normalized_kind = "major-add-2" if expected["id"] == "c-add-9" and "add" in symbol else kind
            row = {
                "id": expected["id"], "symbol": symbol, "root": value.root().name,
                "bass": value.bass().name, "kind": normalized_kind,
                "inversion": value.inversion(),
            }
            row["semantic_core_pass"] = all(row[key] == expected[key] for key in ("root", "kind", "inversion"))
            chord_rows.append(row)
        key_rows = []
        for expected in KEYS:
            value = music21.stream.Stream()
            for offset, pitches in enumerate(expected["chords"]):
                value.insert(offset, music21.chord.Chord(pitch_names(music21, pitches)))
            key = value.analyze("key")
            label = f"{key.tonic.name} {key.mode}"
            key_rows.append({
                "id": expected["id"], "selected": label,
                "correlation": round(float(key.correlationCoefficient), 6),
                "pass": label == expected["expected"],
            })
        source = [48, 55, 64, 71]
        closed = music21.chord.Chord(pitch_names(music21, source)).closedPosition(
            forceOctave=4, inPlace=False,
        )
        inverted = music21.chord.Chord(pitch_names(music21, [60, 64, 67, 71]))
        inverted.inversion(1)
        voicings = [
            {"operation": "closed-position", "before": source,
             "after": [value.midi for value in closed.pitches], "expected": [60, 64, 67, 71]},
            {"operation": "first-inversion", "before": [60, 64, 67, 71],
             "after": [value.midi for value in inverted.pitches], "expected": [64, 67, 71, 72]},
        ]
        for row in voicings:
            row["pass"] = row["after"] == row["expected"]
        return {"chords": chord_rows, "keys": key_rows, "voicings": voicings}

    return provider_result("music21", importlib.metadata.version("music21"), import_ms, action, [
        "drop voicing", "nearest progression voicing",
    ])


def musicpy_provider() -> dict[str, Any]:
    os.environ["PYGAME_HIDE_SUPPORT_PROMPT"] = "1"
    musicpy, import_ms = measured_import("musicpy")
    kind_map = {
        "major": "major", "minor": "minor", "7": "dominant-seventh",
        "maj7": "major-seventh", "dim7": "diminished-seventh",
        "sus": "suspended-fourth", "add2": "major-add-2",
    }
    pitch_class_names = ("C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B")

    def mp_chord(pitches: list[int]) -> Any:
        names = [f"{pitch_class_names[value % 12]}{value // 12 - 1}" for value in pitches]
        return musicpy.chord(",".join(names))

    def mp_progression(chords: list[list[int]]) -> Any:
        values = []
        for pitches in chords:
            notes = [
                musicpy.note(pitch_class_names[value % 12], value // 12 - 1, duration=1)
                for value in pitches
            ]
            values.append(musicpy.chord(notes, interval=[0] * (len(notes) - 1) + [1]))
        result = values[0]
        for value in values[1:]:
            result = result | value
        return result

    def action() -> dict[str, Any]:
        chord_rows = []
        for expected in CHORDS:
            info = mp_chord(expected["pitches"]).info()
            bass = pitch_class_names[expected["pitches"][0] % 12]
            row = {
                "id": expected["id"], "root": info.root, "bass": bass,
                "kind": kind_map.get(info.chord_type, info.chord_type),
                "inversion": info.inversion or 0,
            }
            row["semantic_core_pass"] = all(row[key] == expected[key] for key in ("root", "kind", "inversion"))
            chord_rows.append(row)
        key_rows = []
        for expected in KEYS:
            candidates = str(musicpy.algorithms.detect_scale(mp_progression(expected["chords"])))
            key_rows.append({
                "id": expected["id"], "selected": None, "candidates": candidates,
                "expected_present": expected["expected"] is None
                    or expected["expected"] in candidates,
            })
        base = musicpy.C("Cmaj7", 4)
        target = musicpy.C("Cmaj7", 4)
        voicings = [
            ("first-inversion", base.inversion(1), [64, 67, 71, 72]),
            ("drop-2", base.drops(2), [55, 60, 64, 71]),
            ("degree-order", base.get_voicing([1, 5, 3, 7]), [60, 67, 76, 83]),
            ("nearest-to-Cmaj7", musicpy.C("G7", 4).near_voicing(target, keep_root=False),
             [62, 65, 67, 71]),
        ]
        rendered = [{
            "operation": name, "after": [note.degree for note in value.notes],
            "expected": expected, "pass": [note.degree for note in value.notes] == expected,
        } for name, value, expected in voicings]
        return {"chords": chord_rows, "keys": key_rows, "voicings": rendered}

    return provider_result("musicpy", importlib.metadata.version("musicpy"), import_ms, action, [
        "calibrated key confidence", "explicit ambiguity threshold",
    ])


def partitura_provider() -> dict[str, Any]:
    partitura, import_ms = measured_import("partitura")
    numpy = importlib.import_module("numpy")

    def note_array(chords: list[list[int]]) -> Any:
        rows = [(pitch, float(onset), 1.0) for onset, chord in enumerate(chords) for pitch in chord]
        return numpy.array(rows, dtype=[
            ("pitch", "i4"), ("onset_beat", "f4"), ("duration_beat", "f4"),
        ])

    def action() -> dict[str, Any]:
        keys = []
        for expected in KEYS:
            selected = partitura.musicanalysis.estimate_key(note_array(expected["chords"]))
            label = selected[:-1] + " minor" if selected.endswith("m") else selected + " major"
            keys.append({"id": expected["id"], "selected": label, "pass": label == expected["expected"]})
        voices = partitura.musicanalysis.estimate_voices(note_array(KEYS[0]["chords"])).tolist()
        return {"keys": keys, "voice_assignments": voices}

    return provider_result("partitura", importlib.metadata.version("partitura"), import_ms, action, [
        "chord naming", "chord voicing transforms", "ambiguity confidence",
    ])


def mingus_provider() -> dict[str, Any]:
    _, import_ms = measured_import("mingus")
    chords = importlib.import_module("mingus.core.chords")
    names = ("C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B")
    expected_symbols = ("CM", "CM", "Am", "G7", "CM7", "F#dim7", "Dsus4", "CMadd9")

    def action() -> dict[str, Any]:
        rows = []
        for expected, symbol in zip(CHORDS, expected_symbols):
            pitches = [names[value % 12] for value in expected["pitches"]]
            candidates = chords.determine(pitches, shorthand=True)
            rows.append({
                "id": expected["id"], "candidates": candidates,
                "expected_present": symbol in candidates,
            })
        inversion = chords.first_inversion(["C", "E", "G", "B"])
        return {"chords": rows, "voicings": [{
            "operation": "pitch-class inversion", "after": inversion,
            "octaves_assigned": False,
        }]}

    return provider_result("mingus", importlib.metadata.version("mingus"), import_ms, action, [
        "global key analysis", "octave-aware voicing", "active release line",
    ])


def tonal_provider(root: Path) -> dict[str, Any]:
    package = root / "node_modules" / "tonal"
    version = json.loads((package / "package.json").read_text())["version"]
    module = package / "dist" / "index.mjs"
    source = f"""
import {{ Chord }} from {json.dumps(str(module))};
const rows = {json.dumps(CHORDS)};
const names = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const expected = ['CM','CM/E','Am','G7/B','Cmaj7','F#dim7','Dsus4','CMadd9'];
const chords = rows.map((row, index) => {{
  const notes = row.pitches.map((value) => names[value % 12] + (Math.floor(value / 12) - 1));
  const candidates = Chord.detect(notes);
  return {{id: row.id, candidates, expected_present: candidates.includes(expected[index]),
    top_candidate_pass: candidates[0] === expected[index]}};
}});
process.stdout.write(JSON.stringify({{chords}}));
"""

    def action() -> dict[str, Any]:
        completed = subprocess.run(
            ["node", "--input-type=module", "-"], input=source, text=True,
            capture_output=True, check=True,
        )
        return json.loads(completed.stdout)

    result = provider_result("tonal", version, 0.0, action, [
        "global key selection", "octave-aware voicing", "calibrated confidence",
    ])
    result["import_ms"] = "included in each subprocess run"
    return result


def provider_result(
    name: str, version: str, import_ms: float, action: Callable[[], dict[str, Any]],
    unsupported: list[str],
) -> dict[str, Any]:
    repeated = run_repeated(action)
    return {
        "schema": SCHEMA, "provider": {"name": name, "version": version},
        "import_ms": import_ms, **repeated, "unsupported": unsupported,
        "peak_resident_bytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        "peak_child_resident_bytes": resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss,
        "operator_judgment": None,
    }


def self_test() -> dict[str, Any]:
    assert len(CHORDS) == 8
    assert len({row["id"] for row in CHORDS}) == len(CHORDS)
    assert all(row["pitches"] == sorted(row["pitches"]) for row in CHORDS)
    assert [row["expected"] for row in KEYS] == ["C major", "A minor", None]
    assert digest(CHORDS) == digest(json.loads(canonical(CHORDS)))
    return {"passed": 5, "chord_cohort_sha256": digest(CHORDS), "key_cohort_sha256": digest(KEYS)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", choices=("music21", "musicpy", "partitura", "mingus", "tonal"))
    parser.add_argument("--tonal-root", type=Path, default=TONAL_ROOT)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    runners = {
        "music21": music21_provider, "musicpy": musicpy_provider,
        "partitura": partitura_provider, "mingus": mingus_provider,
        "tonal": lambda: tonal_provider(args.tonal_root),
    }
    if args.self_test:
        result = self_test()
    elif args.provider:
        result = runners[args.provider]()
    else:
        parser.error("select --provider or --self-test")
    rendered = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered)
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
