#!/usr/bin/env python3
"""Compare typed note analysis providers on a bounded music cohort."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import itertools
import json
import resource
import subprocess
import time
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


SCHEMA = "ghostnote-semantic-analysis-v0"
EXACT_PROVIDER = {"name": "ghostnote-exact-structure", "version": "0.1-probe"}
AGENT_MODEL = "gpt-5.4-mini-2026-03-17"
TONAL_ROOT = Path("/private/tmp/ghostnote-phase6e-tonal")
LABEL_FIELDS = (
    "harmony_label", "rhythm_label", "register_label", "repeated_motif",
    "voice_leading_label", "tension_label",
)


def canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def note(start: float, pitch: int, duration: float = 0.5, velocity: int = 88) -> dict[str, Any]:
    return {
        "startBeats": start, "pitch": pitch, "durationBeats": duration,
        "velocity": velocity,
    }


def chord(start: float, pitches: list[int], duration: float = 1.0) -> list[dict[str, Any]]:
    return [note(start, pitch, duration, 82) for pitch in pitches]


def clip(clip_id: str, length: float, notes: list[dict[str, Any]], expected: dict[str, Any]) -> dict[str, Any]:
    identity = {"lengthBeats": length, "channel": 0, "notes": notes}
    return {
        "clip_id": clip_id,
        "identity": {
            "kind": "controlled-note-fixture", "clip_sha256": digest(identity),
            "length_beats": length, "channel": 0,
        },
        "notes": notes,
        "expected": expected,
    }


def controlled_cohort() -> list[dict[str, Any]]:
    major = sum((chord(i, pitches) for i, pitches in enumerate((
        [60, 64, 67], [60, 65, 69], [59, 62, 67], [60, 64, 67],
    ))), [])
    minor = sum((chord(i, pitches) for i, pitches in enumerate((
        [57, 60, 64], [57, 62, 65], [56, 59, 64], [57, 60, 64],
    ))), [])
    syncopated = [
        note(0, 60, 0.5), note(0.75, 62, 0.5), note(1.5, 64, 0.5),
        note(2.25, 65, 0.5), note(3.0, 67, 0.5), note(3.75, 69, 0.25),
    ]
    motif = [
        note(0, 48), note(0.5, 50), note(1, 52), note(1.5, 55),
        note(2, 60), note(2.5, 62), note(3, 64), note(3.5, 67),
    ]
    ambiguous = [
        note(0, 60), note(0.5, 62), note(1, 64), note(1.5, 67),
        note(2, 69), note(2.5, 67), note(3, 64), note(3.5, 62),
    ]
    return [
        clip("major-cadence", 4, major, {"harmony_label": "C major"}),
        clip("minor-cadence", 4, minor, {"harmony_label": "A minor"}),
        clip("syncopated-line", 4, syncopated, {"rhythm_label": "syncopated"}),
        clip("register-motif", 4, motif, {"repeated_motif": True}),
        clip("ambiguous-pentatonic", 4, ambiguous, {
            "harmony_label": "ambiguous C major or A minor",
        }),
    ]


def coverage(item: dict[str, Any]) -> dict[str, Any]:
    count = len(item["notes"])
    return {
        "beats": {"unit": "beats", "start": 0, "end_exclusive": item["identity"]["length_beats"]},
        "note_indices": {"start": 0, "end_exclusive": count},
        "channels": [item["identity"]["channel"]], "note_count": count,
    }


def onset_groups(notes: list[dict[str, Any]]) -> list[tuple[float, list[int]]]:
    grouped: dict[float, list[int]] = defaultdict(list)
    for value in notes:
        grouped[value["startBeats"]].append(value["pitch"])
    return [(start, sorted(pitches)) for start, pitches in sorted(grouped.items())]


def key_candidates(notes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts = Counter(value["pitch"] % 12 for value in notes)
    total = sum(counts.values())
    first = notes[0]["pitch"] % 12 if notes else -1
    last = notes[-1]["pitch"] % 12 if notes else -1
    names = ("C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B")
    modes = (("major", (0, 2, 4, 5, 7, 9, 11)), ("minor", (0, 2, 3, 5, 7, 8, 10)))
    rows = []
    for tonic in range(12):
        for mode, degrees in modes:
            scale = {(tonic + degree) % 12 for degree in degrees}
            in_scale = sum(count for pc, count in counts.items() if pc in scale) / max(total, 1)
            tonic_weight = (counts[tonic] / max(total, 1)) * 0.15
            boundary = 0.075 * ((first == tonic) + (last == tonic))
            rows.append({"label": f"{names[tonic]} {mode}", "score": round(in_scale + tonic_weight + boundary, 6)})
    return sorted(rows, key=lambda row: (-row["score"], row["label"]))[:4]


def motif_occurrences(groups: list[tuple[float, list[int]]]) -> list[dict[str, Any]]:
    monophonic = [(start, pitches[0]) for start, pitches in groups if len(pitches) == 1]
    matches = []
    for size in range(min(4, len(monophonic) // 2), 2, -1):
        seen: dict[tuple[tuple[float, ...], tuple[int, ...]], list[int]] = defaultdict(list)
        for index in range(len(monophonic) - size + 1):
            window = monophonic[index:index + size]
            starts = tuple(round(row[0] - window[0][0], 9) for row in window)
            intervals = tuple(row[1] - window[0][1] for row in window)
            seen[(starts, intervals)].append(index)
        for (starts, intervals), indices in seen.items():
            disjoint = [indices[0]] if indices else []
            for index in indices[1:]:
                if index >= disjoint[-1] + size:
                    disjoint.append(index)
            if len(disjoint) > 1:
                matches.append({
                    "length_notes": size, "relative_starts_beats": starts,
                    "relative_semitones": intervals,
                    "occurrence_starts_beats": [monophonic[index][0] for index in disjoint],
                })
        if matches:
            break
    return matches


def exact_result(item: dict[str, Any]) -> dict[str, Any]:
    notes = item["notes"]
    groups = onset_groups(notes)
    pitches = sorted(value["pitch"] for value in notes)
    candidates = key_candidates(notes)
    margin = candidates[0]["score"] - candidates[1]["score"] if len(candidates) > 1 else 0
    key_label = candidates[0]["label"] if margin >= 0.08 else None
    weak = sum(abs(start * 2 - round(start * 2)) > 1e-8 for start, _ in groups)
    syncopation_score = weak / max(len(groups), 1)
    motifs = motif_occurrences(groups)
    voice = []
    for (left_start, left), (right_start, right) in zip(groups, groups[1:]):
        pairs = list(zip(left, right))
        distances = [abs(a - b) for a, b in pairs]
        voice.append({
            "from_beat": left_start, "to_beat": right_start,
            "paired_voice_count": len(pairs),
            "total_semitones": sum(distances), "max_semitones": max(distances, default=0),
            "unpaired_voice_count": abs(len(left) - len(right)),
        })
    dissonant = {1, 2, 6, 10, 11}
    intervals = []
    for _, values in groups:
        intervals.extend(min((b - a) % 12, (a - b) % 12) for a, b in itertools.combinations(values, 2))
    tension_score = sum(interval in dissonant for interval in intervals) / max(len(intervals), 1)
    register_median = (pitches[(len(pitches) - 1) // 2] + pitches[len(pitches) // 2]) / 2 if pitches else None
    return {
        "schema": SCHEMA, "provider": EXACT_PROVIDER, "clip_identity": item["identity"],
        "coverage": coverage(item),
        "facts": {
            "kind": "exact note fact or deterministic derived metric",
            "pitch_classes": sorted(set(value["pitch"] % 12 for value in notes)),
            "onsets": [{"beat": start, "pitches_midi": values} for start, values in groups],
            "register": {
                "unit": "MIDI note number", "minimum": min(pitches, default=None),
                "maximum": max(pitches, default=None), "median": register_median,
                "span_semitones": max(pitches, default=0) - min(pitches, default=0),
            },
            "voice_leading": {"unit": "semitones", "transitions": voice},
            "motifs": motifs,
        },
        "labels": {
            "kind": "inferred musical label",
            "harmony": {
                "label": key_label, "candidates": candidates,
                "confidence_rule": "Return one key only when the top fixed-score margin is at least 0.08.",
                "score_margin": round(margin, 6),
            },
            "rhythm": {
                "label": "syncopated" if syncopation_score >= 0.4 else "straight",
                "score": round(syncopation_score, 6), "unit": "weak-subdivision onset ratio",
                "confidence_rule": "Label syncopated at a ratio of 0.4 or more.",
            },
            "register": {
                "label": None if not pitches else ("low" if max(pitches) < 60 else "high" if min(pitches) >= 72 else "middle or wide"),
                "confidence_rule": "Low ends below MIDI 60. High starts at MIDI 72. Other spans stay plural.",
            },
            "motif": {
                "label": "repeated" if motifs else "none found",
                "confidence_rule": "Require two disjoint equal rhythm-and-interval sequences of at least three notes.",
            },
            "tension": {
                "label": "low" if tension_score < 0.2 else "moderate" if tension_score < 0.5 else "high",
                "score": round(tension_score, 6), "unit": "dissonant interval-class ratio",
                "confidence_rule": "This is a declared interval proxy. It is not aesthetic tension.",
            },
        },
        "operator_judgment": None,
    }


def run_exact(cohort: list[dict[str, Any]], repeats: int) -> dict[str, Any]:
    runs, timings = [], []
    for _ in range(repeats):
        started = time.perf_counter()
        runs.append([exact_result(item) for item in cohort])
        timings.append((time.perf_counter() - started) * 1_000)
    hashes = [digest(run) for run in runs]
    return {
        "provider": EXACT_PROVIDER, "analysis_ms": timings, "repeat_hashes": hashes,
        "identical_repeats": len(set(hashes)) == 1, "results": runs[0],
        "peak_resident_bytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
    }


def run_music21(cohort: list[dict[str, Any]], repeats: int) -> dict[str, Any]:
    imported = time.perf_counter()
    from music21 import chord as m21_chord
    from music21 import note as m21_note
    from music21 import stream
    import_ms = (time.perf_counter() - imported) * 1_000
    version = importlib.metadata.version("music21")

    def analyze(item: dict[str, Any]) -> dict[str, Any]:
        score = stream.Stream()
        for value in item["notes"]:
            event = m21_note.Note(value["pitch"], quarterLength=value["durationBeats"])
            score.insert(value["startBeats"], event)
        key = score.analyze("key")
        chord_labels = []
        for start, pitches in onset_groups(item["notes"]):
            value = m21_chord.Chord(pitches)
            chord_labels.append({"beat": start, "common_name": value.commonName})
        return {
            "schema": SCHEMA, "provider": {"name": "music21", "version": version},
            "clip_identity": item["identity"], "coverage": coverage(item),
            "labels": {
                "kind": "inferred musical label",
                "harmony": {
                    "label": f"{key.tonic.name.replace('-', 'b')} {key.mode}",
                    "correlation_coefficient": round(float(key.correlationCoefficient), 6),
                    "alternate": f"{key.alternateInterpretations[0].tonic.name.replace('-', 'b')} {key.alternateInterpretations[0].mode}",
                    "confidence_rule": "The coefficient is music21 Krumhansl-Schmuckler correlation, not a probability.",
                },
                "onset_chords": chord_labels,
            },
            "unsupported": ["syncopation label", "motif identity", "voice-leading assignment", "tension proxy"],
            "operator_judgment": None,
        }

    runs, timings = [], []
    for _ in range(repeats):
        started = time.perf_counter()
        runs.append([analyze(item) for item in cohort])
        timings.append((time.perf_counter() - started) * 1_000)
    hashes = [digest(run) for run in runs]
    return {
        "provider": {"name": "music21", "version": version}, "import_ms": import_ms,
        "analysis_ms": timings, "repeat_hashes": hashes,
        "identical_repeats": len(set(hashes)) == 1, "results": runs[0],
        "peak_resident_bytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
    }


TONAL_PROGRAM = r"""
import fs from 'node:fs';
import { createRequire } from 'node:module';
const root = process.argv[1];
const require = createRequire(root + '/package.json');
const tonal = await import(root + '/node_modules/@tonaljs/tonal/dist/index.mjs');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const names = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const results = input.map(item => {
  const pcs = [...new Set(item.notes.map(n => names[n.pitch % 12]))];
  const grouped = new Map();
  for (const n of item.notes) {
    if (!grouped.has(n.startBeats)) grouped.set(n.startBeats, []);
    grouped.get(n.startBeats).push(tonal.Note.fromMidi(n.pitch));
  }
  return {
    schema: 'ghostnote-semantic-analysis-v0',
    provider: {name: '@tonaljs/tonal', version: require('@tonaljs/tonal/package.json').version},
    clip_identity: item.identity,
    coverage: item.coverage,
    labels: {
      kind: 'candidate lookup, not a selected musical label',
      scale_candidates: tonal.Scale.detect(pcs),
      onset_chords: [...grouped].map(([beat, pitches]) => ({beat, candidates: tonal.Chord.detect(pitches)})),
      confidence_rule: 'Tonal returns ordered names without calibrated confidence. The adapter selects none.'
    },
    unsupported: ['key selection', 'syncopation label', 'motif identity', 'voice-leading assignment', 'tension proxy'],
    operator_judgment: null
  };
});
process.stdout.write(JSON.stringify(results));
"""


def run_tonal(cohort: list[dict[str, Any]], repeats: int, root: Path) -> dict[str, Any]:
    package = json.loads((root / "node_modules/@tonaljs/tonal/package.json").read_text())
    payload = [{**item, "coverage": coverage(item)} for item in cohort]
    runs, timings = [], []
    for _ in range(repeats):
        started = time.perf_counter()
        completed = subprocess.run(
            ["node", "--input-type=module", "--eval", TONAL_PROGRAM, str(root)],
            input=canonical(payload), text=True, capture_output=True, check=True,
        )
        runs.append(json.loads(completed.stdout))
        timings.append((time.perf_counter() - started) * 1_000)
    hashes = [digest(run) for run in runs]
    return {
        "provider": {"name": "@tonaljs/tonal", "version": package["version"]},
        "analysis_ms": timings, "repeat_hashes": hashes,
        "identical_repeats": len(set(hashes)) == 1, "results": runs[0],
        "peak_resident_bytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        "peak_child_resident_bytes": resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss,
    }


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
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.load(response)


def agent_prompt(cohort: list[dict[str, Any]]) -> str:
    inputs = [{
        "clip_id": item["clip_id"], "identity": item["identity"], "notes": item["notes"],
        "coverage": coverage(item),
    } for item in cohort]
    return (
        "Analyze each exact MIDI-note clip. Do not call an inferred label an exact fact. "
        "Use only these harmony labels: C major, A minor, ambiguous C major or A minor, none. "
        "Use rhythm labels straight, syncopated, or mixed; register labels low, middle, high, "
        "or wide; voice-leading labels smooth, leaping, or not_applicable; tension labels low, "
        "moderate, high, or ambiguous. Return repeated_motif as a boolean. For every field, "
        "return confidence from 0 to 1 and one short reason. Use ambiguous when evidence does "
        "not select one relative key. Output only JSON as {results:[{clip_id, harmony_label, "
        "rhythm_label, register_label, repeated_motif, voice_leading_label, tension_label, "
        "confidence:{harmony,rhythm,register,motif,voice_leading,tension}, reason:{harmony,"
        "rhythm,register,motif,voice_leading,tension}}]}. Inputs: " + canonical(inputs)
    )


def run_agent(cohort: list[dict[str, Any]], repeats: int, env_file: Path) -> dict[str, Any]:
    key = load_env(env_file).get("OPENAI_API_KEY")
    if not key:
        raise ValueError("OPENAI_API_KEY is missing")
    prompt = agent_prompt(cohort)
    runs, timings, request_ids, usage = [], [], [], []
    for _ in range(repeats):
        started = time.perf_counter()
        raw = post_json("https://api.openai.com/v1/chat/completions", {
            "Authorization": f"Bearer {key}",
        }, {
            "model": AGENT_MODEL, "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"}, "max_completion_tokens": 4000,
        })
        timings.append((time.perf_counter() - started) * 1_000)
        parsed = json.loads(raw["choices"][0]["message"]["content"])
        inputs = {item["clip_id"]: item for item in cohort}
        enriched = []
        for row in parsed.get("results", []):
            item = inputs.get(row.get("clip_id"))
            if item is None:
                raise ValueError(f"agent returned an unknown clip: {row.get('clip_id')!r}")
            enriched.append({
                **row, "schema": SCHEMA,
                "provider": {"name": "direct-agent", "model": AGENT_MODEL},
                "clip_identity": item["identity"], "coverage": coverage(item),
                "result_kind": "inferred musical labels",
                "label_types": {field: "closed categorical label" for field in LABEL_FIELDS},
                "confidence_rule": "Confidence is provider-reported and is not calibrated.",
                "operator_judgment": None,
            })
        runs.append({"results": enriched})
        request_ids.append(raw.get("id"))
        usage.append(raw.get("usage"))
    decisions = [[{field: row.get(field) for field in LABEL_FIELDS}
                  for row in run.get("results", [])] for run in runs]
    hashes = [digest(run) for run in decisions]
    allowed = {
        "harmony_label": {"C major", "A minor", "ambiguous C major or A minor", "none"},
        "rhythm_label": {"straight", "syncopated", "mixed"},
        "register_label": {"low", "middle", "high", "wide"},
        "repeated_motif": {True, False},
        "voice_leading_label": {"smooth", "leaping", "not_applicable"},
        "tension_label": {"low", "moderate", "high", "ambiguous"},
    }
    schema_errors = []
    expected_ids = {item["clip_id"] for item in cohort}
    for repeat, run in enumerate(runs, 1):
        rows = run.get("results", [])
        returned_ids = {row.get("clip_id") for row in rows}
        if returned_ids != expected_ids:
            schema_errors.append({
                "repeat": repeat, "field": "clip_id",
                "value": sorted(str(value) for value in returned_ids),
            })
        for row in rows:
            for field, values in allowed.items():
                if row.get(field) not in values:
                    schema_errors.append({
                        "repeat": repeat, "clip_id": row.get("clip_id"),
                        "field": field, "value": row.get(field),
                    })
    expected = {item["clip_id"]: item["expected"] for item in cohort}
    scored = []
    for run in runs:
        rows = {row.get("clip_id"): row for row in run.get("results", [])}
        checks = []
        for clip_id, fields in expected.items():
            for field, value in fields.items():
                checks.append(rows.get(clip_id, {}).get(field) == value)
        scored.append({"correct": sum(checks), "total": len(checks)})
    return {
        "provider": {"name": "direct-agent", "model": AGENT_MODEL},
        "analysis_ms": timings, "decision_hashes": hashes,
        "identical_decisions": len(set(hashes)) == 1, "accuracy": scored,
        "schema_valid": len(schema_errors) == 0, "schema_errors": schema_errors,
        "request_ids": request_ids, "usage": usage, "results": runs,
        "confidence_rule": "Confidence is provider-reported and is not calibrated.",
    }


def normalize_register(notes: list[dict[str, Any]], low: int, high: int) -> list[dict[str, Any]]:
    if low > high:
        raise ValueError("register lower bound exceeds upper bound")
    output = []
    by_onset: dict[float, list[dict[str, Any]]] = defaultdict(list)
    for value in notes:
        by_onset[value["startBeats"]].append(value)
    for _, values in sorted(by_onset.items()):
        candidates = []
        for value in values:
            choices = [pitch for pitch in range(low, high + 1) if pitch % 12 == value["pitch"] % 12]
            if not choices:
                raise ValueError(f"no in-range octave for MIDI {value['pitch']}")
            candidates.append(choices)
        assignments = [choice for choice in itertools.product(*candidates) if len(set(choice)) == len(choice)]
        if not assignments:
            raise ValueError("register normalization would create a duplicate pitch at one onset")
        selected = min(assignments, key=lambda row: (
            sum(abs(pitch - value["pitch"]) for pitch, value in zip(row, values)), row,
        ))
        output.extend([{**value, "pitch": pitch} for value, pitch in zip(values, selected)])
    return sorted(output, key=lambda value: (value["startBeats"], value["pitch"]))


def transform_live(state: dict[str, Any], low: int, high: int) -> dict[str, Any]:
    before = state["notes"]
    after = normalize_register(before, low, high)
    def without_octave(values: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return sorted(
            [{**value, "pitch": value["pitch"] % 12} for value in values],
            key=canonical,
        )
    return {
        "schema": "ghostnote-semantic-transform-v0",
        "provider": EXACT_PROVIDER,
        "source_identity": state["identity"],
        "coverage": coverage({"notes": before, "identity": state["identity"]}),
        "operation": {
            "name": "normalize-register-by-octave", "bounds": {"low_midi": low, "high_midi": high},
            "selection_rule": "Minimize total octave displacement per onset. Break ties by lower pitch tuple.",
            "failure_rule": "Refuse when a pitch class has no in-range octave or an onset would collide.",
        },
        "before": before, "after": after,
        "invariants": {
            "note_count_equal": len(before) == len(after),
            "pitch_classes_equal": sorted((value["startBeats"], value["pitch"] % 12) for value in before)
                == sorted((value["startBeats"], value["pitch"] % 12) for value in after),
            "unowned_fields_equal": without_octave(before) == without_octave(after),
            "all_pitches_in_range": all(low <= value["pitch"] <= high for value in after),
        },
        "operator_judgment": None,
    }


def self_test() -> dict[str, Any]:
    cohort = controlled_cohort()
    assert len({item["identity"]["clip_sha256"] for item in cohort}) == len(cohort)
    exact = run_exact(cohort, 3)
    assert exact["identical_repeats"]
    ambiguous = exact["results"][4]["labels"]["harmony"]
    assert ambiguous["label"] is None
    motif = exact["results"][3]["facts"]["motifs"]
    assert motif and motif[0]["occurrence_starts_beats"] == [0, 2]
    transformed = normalize_register([note(0, 36), note(0, 48)], 48, 72)
    assert [value["pitch"] for value in transformed] == [48, 60]
    try:
        normalize_register([note(0, 36), note(0, 48)], 48, 48)
    except ValueError:
        pass
    else:
        raise AssertionError("collision did not refuse")
    return {"passed": 6, "cohort_sha256": digest(cohort)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--work-dir", type=Path, required=True)
    parser.add_argument("--provider", choices=("exact", "music21", "tonal", "agent"))
    parser.add_argument("--env-file", type=Path, default=Path("../.env"))
    parser.add_argument("--tonal-root", type=Path, default=TONAL_ROOT)
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--live-state", type=Path)
    parser.add_argument("--transform-output", type=Path)
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    args.work_dir.mkdir(parents=True, exist_ok=True)
    if args.self_test:
        result = self_test()
    elif args.prepare:
        cohort = controlled_cohort()
        result = {"schema": "ghostnote-semantic-cohort-v0", "clips": cohort}
        result["cohort_sha256"] = digest(result)
        (args.work_dir / "manifest.json").write_text(json.dumps(result, indent=2) + "\n")
    elif args.live_state and args.transform_output:
        result = transform_live(json.loads(args.live_state.read_text()), 48, 72)
        args.transform_output.write_text(json.dumps(result, indent=2) + "\n")
    else:
        if not args.provider:
            parser.error("select --prepare, --self-test, a provider, or a live transform")
        manifest = json.loads((args.work_dir / "manifest.json").read_text())
        cohort = manifest["clips"]
        if args.live_state:
            live = json.loads(args.live_state.read_text())
            cohort = [*cohort, {**live, "expected": {}}]
        runners = {
            "exact": lambda: run_exact(cohort, args.repeats),
            "music21": lambda: run_music21(cohort, args.repeats),
            "tonal": lambda: run_tonal(cohort, args.repeats, args.tonal_root),
            "agent": lambda: run_agent(cohort, args.repeats, args.env_file),
        }
        result = runners[args.provider]()
    rendered = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(rendered)
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
