#!/usr/bin/env python3
"""Measure whether routed sensory packets improve bounded agent decisions."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import platform
import random
import re
import resource
import subprocess
import tempfile
import time
import wave
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
from typing import Any

import numpy as np


PROBE_DIR = Path(__file__).parent


def load_probe(name: str, filename: str) -> Any:
    path = PROBE_DIR / filename
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


symbolic = load_probe("phase6f_base", "phase6f-symbolic-representation.py")
reference = load_probe("phase6g_base", "phase6g-reference-transfer.py")
audio_base = load_probe("phase6c_base", "phase6c-audio-analysis.py")

SCHEMA = "ghostnote-sensory-packet-eval-v0"
RESPONSE_SCHEMA = "ghostnote-sensory-response-v0"
PACKET_SCHEMA = "ghostnote-sensory-packet-v0"
PATCH_SCHEMA = symbolic.PATCH_SCHEMA
ARMS = ("raw-identity", "raw-facts", "task-routed")
PROVIDERS = ("openai", "gemini")
SAMPLE_RATE = 44_100
PERMISSION = "MIT generated project fixture"
MIDI_PROVIDER = {"name": "Ghostnote exact-note probe", "version": "phase6h-v0"}
FFMPEG = audio_base.FFMPEG
FFPROBE = audio_base.FFPROBE

CASE_EXPECTED: dict[str, set[str]] = {
    "midi_voice_leading": {"B"},
    "midi_syncopation": {"B"},
    "midi_no_change": {"no_change"},
    "midi_compelling": {"insufficient"},
    "audio_brightness": {"B"},
    "audio_loudness": {"B"},
    "audio_no_change": {"no_change"},
    "audio_silence": {"insufficient", "no_change"},
    "audio_presence": {"insufficient"},
}
CONTROL_CASES = {
    "midi_no_change", "midi_compelling", "audio_no_change",
    "audio_silence", "audio_presence",
}


def canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def max_rss_bytes() -> int:
    value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return int(value if platform.system() == "Darwin" else value * 1024)


def fraction_text(value: Fraction | int | str) -> str:
    result = Fraction(str(value))
    return str(result.numerator) if result.denominator == 1 else f"{result.numerator}/{result.denominator}"


def clip(name: str, pitches: list[int], starts: list[Fraction | int], velocities: list[int] | None = None) -> dict[str, Any]:
    if velocities is None:
        velocities = [84] * len(pitches)
    notes = [
        symbolic.note(
            f"{name}-n{index + 1}", "lead", fraction_text(start), "1/4",
            pitch, velocities[index], channel=0,
        )
        for index, (start, pitch) in enumerate(zip(starts, pitches))
    ]
    value = {
        "id": name,
        "meter": "4/4",
        "length_beats": 8,
        "tracks": [{"id": "lead", "role": "lead", "channel": 0}],
        "coverage": {
            "start_beats": "0", "end_beats": "8",
            "tracks_complete": True, "notes_complete": True,
        },
        "permission": PERMISSION,
        "notes": notes,
    }
    value["sha256"] = digest(value)
    return value


def make_midi_sources() -> dict[str, dict[str, Any]]:
    starts = list(range(8))
    sources = {
        "voice-A": clip("voice-A", [60, 72, 59, 71, 58, 70, 57, 69], starts),
        "voice-B": clip("voice-B", [60, 62, 64, 65, 67, 65, 64, 62], starts),
        "sync-A": clip("sync-A", [60, 62, 64, 65, 67, 69, 71, 72], starts),
        "sync-B": clip("sync-B", [60, 62, 64, 65, 67, 69, 71, 72], [
            Fraction(0), Fraction(3, 2), Fraction(2), Fraction(7, 2),
            Fraction(4), Fraction(11, 2), Fraction(6), Fraction(15, 2),
        ]),
        "same-A": clip("same-A", [64, 67, 69, 67, 64, 62, 60, 62], starts),
        "same-B": clip("same-B", [64, 67, 69, 67, 64, 62, 60, 62], starts),
        "compelling-A": clip("compelling-A", [48, 50, 52, 53, 55, 53, 52, 50], starts),
        "compelling-B": clip("compelling-B", [72, 60, 73, 61, 74, 62, 75, 63], [
            Fraction(0), Fraction(1, 2), Fraction(2), Fraction(5, 2),
            Fraction(4), Fraction(9, 2), Fraction(6), Fraction(13, 2),
        ]),
        "edit-base": clip("edit-base", [60, 62, 64, 65, 67, 65, 64, 62], starts, [
            92, 74, 88, 72, 94, 76, 86, 70,
        ]),
    }
    return sources


def midi_values(source: dict[str, Any]) -> dict[str, float | int]:
    ordered = sorted(source["notes"], key=lambda row: Fraction(row["start"]))
    pitches = [row["pitch"] for row in ordered]
    starts = [Fraction(row["start"]) for row in ordered]
    motion = [abs(second - first) for first, second in zip(pitches, pitches[1:])]
    weak = [start for start in starts if start.denominator == 2]
    middle = sorted(pitches)
    median = (middle[(len(middle) - 1) // 2] + middle[len(middle) // 2]) / 2
    return {
        "note_count": len(pitches),
        "register_median_midi": median,
        "register_span_semitones": max(pitches) - min(pitches),
        "mean_adjacent_motion_semitones": sum(motion) / max(1, len(motion)),
        "weak_eighth_onset_ratio": len(weak) / max(1, len(starts)),
        "onset_density_per_beat": len(starts) / source["length_beats"],
    }


def midi_fact_records(source: dict[str, Any]) -> list[dict[str, Any]]:
    values = midi_values(source)
    units = {
        "note_count": "count",
        "register_median_midi": "MIDI note number",
        "register_span_semitones": "semitones",
        "mean_adjacent_motion_semitones": "semitones",
        "weak_eighth_onset_ratio": "ratio",
        "onset_density_per_beat": "notes per beat",
    }
    purposes = {
        "note_count": "Check note-count preservation.",
        "register_median_midi": "Compare register and check register preservation.",
        "register_span_semitones": "Compare pitch span.",
        "mean_adjacent_motion_semitones": "Compare adjacent melodic movement.",
        "weak_eighth_onset_ratio": "Compare the declared syncopation proxy.",
        "onset_density_per_beat": "Compare onset density.",
    }
    return [
        {
            "field_id": f"midi.{source['id']}.{name}",
            "value": value,
            "unit": units[name],
            "kind": "deterministic derived metric",
            "provider": MIDI_PROVIDER,
            "source_identity": {"id": source["id"], "sha256": source["sha256"]},
            "coverage": source["coverage"],
            "uncertainty_rule": "Exact for the complete supplied note list under the declared formula.",
            "decision_purpose": purposes[name],
        }
        for name, value in values.items()
    ]


def integrated_lufs(path: Path) -> float | None:
    run = subprocess.run([
        str(FFMPEG), "-hide_banner", "-nostats", "-i", str(path),
        "-filter_complex", "ebur128=peak=true", "-f", "null", "-",
    ], check=True, text=True, capture_output=True)
    matches = re.findall(r"I:\s+(-?inf|-?[0-9.]+) LUFS", run.stderr)
    if not matches or matches[-1] == "-inf":
        return None
    return float(matches[-1])


def level_match(path: Path, audio: np.ndarray, target_lufs: float = -24.0) -> np.ndarray:
    audio_base.write_pcm24(path, audio)
    measured = integrated_lufs(path)
    if measured is None:
        return audio
    adjusted = audio * (10 ** ((target_lufs - measured) / 20))
    audio_base.write_pcm24(path, adjusted)
    return adjusted


def make_audio_sources(work_dir: Path) -> dict[str, dict[str, Any]]:
    work_dir.mkdir(parents=True, exist_ok=True)
    time_axis = np.arange(4 * SAMPLE_RATE, dtype=np.float64) / SAMPLE_RATE
    fade = np.minimum(1.0, np.minimum(time_axis * 20, (4 - time_axis) * 20))
    low = 0.16 * np.sin(2 * np.pi * 220 * time_axis) + 0.015 * np.sin(2 * np.pi * 440 * time_axis)
    bright = 0.14 * np.sin(2 * np.pi * 220 * time_axis) + 0.055 * np.sin(2 * np.pi * 4_000 * time_axis)
    steady = np.sin(2 * np.pi * 440 * time_axis) * fade
    unchanged = (0.13 * steady + 0.02 * np.sin(2 * np.pi * 1_320 * time_axis))
    silence = np.zeros_like(time_axis)
    transient = np.zeros_like(time_axis)
    burst_time = np.arange(SAMPLE_RATE // 12) / SAMPLE_RATE
    burst = np.sin(2 * np.pi * 500 * burst_time) * np.hanning(burst_time.size)
    for second in (0.25, 1.25, 2.25, 3.25):
        start = int(second * SAMPLE_RATE)
        transient[start:start + burst.size] += 0.7 * burst
    dense_bright = 0.12 * np.sin(2 * np.pi * 500 * time_axis) + 0.045 * np.sin(2 * np.pi * 5_000 * time_axis)

    definitions: dict[str, tuple[np.ndarray, bool, str]] = {
        "brightness-A": (low * fade, True, "audio_brightness"),
        "brightness-B": (bright * fade, True, "audio_brightness"),
        "loudness-A": (0.05 * steady, False, "audio_loudness"),
        "loudness-B": (0.20 * steady, False, "audio_loudness"),
        "audio-same-A": (unchanged * fade, True, "audio_no_change"),
        "audio-same-B": (unchanged * fade, True, "audio_no_change"),
        "silence-A": (silence, False, "audio_silence"),
        "silence-B": (silence, False, "audio_silence"),
        "presence-A": (transient, True, "audio_presence"),
        "presence-B": (dense_bright * fade, True, "audio_presence"),
    }
    sources: dict[str, dict[str, Any]] = {}
    for source_id, (mono, match_level, case_id) in definitions.items():
        path = work_dir / f"{source_id}.wav"
        stereo = np.column_stack((mono, mono))
        if match_level and np.max(np.abs(stereo)) > 0:
            stereo = level_match(path, stereo)
        else:
            audio_base.write_pcm24(path, stereo)
        sources[source_id] = {
            "id": source_id,
            "path": str(path),
            "sha256": sha256(path),
            "permission": PERMISSION,
            "ownership_basis": "Generated by the phase 6h probe. It contains no third-party audio.",
            "case_id": case_id,
            "level_match_required": match_level,
            "format": {
                "codec": "PCM S24LE", "sample_rate_hz": SAMPLE_RATE,
                "channels": 2, "duration_s": 4.0,
            },
        }
    return sources


def finite_db(value: str) -> float | None:
    return None if value == "-inf" else float(value)


def ffmpeg_version() -> str:
    return subprocess.run(
        [str(FFMPEG), "-version"], check=True, text=True, capture_output=True,
    ).stdout.splitlines()[0].split()[2]


def audio_fact_records(source: dict[str, Any], version: str) -> list[dict[str, Any]]:
    path = Path(source["path"])
    probe = json.loads(subprocess.run([
        str(FFPROBE), "-v", "error", "-select_streams", "a:0",
        "-show_entries", "stream=sample_rate,channels,duration_ts,time_base",
        "-of", "json", str(path),
    ], check=True, text=True, capture_output=True).stdout)["streams"][0]
    sample_count = int(probe["duration_ts"])
    astats = audio_base.ffmpeg_metadata(
        path,
        "astats=metadata=1:reset=0:measure_perchannel=Peak_level+RMS_level:measure_overall=none",
    )[-1]
    peaks = [finite_db(astats[f"lavfi.astats.{channel}.Peak_level"]) for channel in (1, 2)]
    rms = [finite_db(astats[f"lavfi.astats.{channel}.RMS_level"]) for channel in (1, 2)]
    peak = max((value for value in peaks if value is not None), default=None)
    mean_rms = max((value for value in rms if value is not None), default=None)
    crest = None if peak is None or mean_rms is None else peak - mean_rms
    lufs = integrated_lufs(path)
    if peak is None:
        lufs = None
    spectral = audio_base.ffmpeg_metadata(
        path, "aspectralstats=win_size=8192:win_func=hann:overlap=0:measure=rolloff",
    )
    rolloff_values = [
        float(frame[f"lavfi.aspectralstats.{channel}.rolloff"])
        for frame in spectral for channel in (1, 2)
        if f"lavfi.aspectralstats.{channel}.rolloff" in frame
    ]
    rolloff = None if peak is None or not rolloff_values else float(np.median(rolloff_values))
    silence_run = subprocess.run([
        str(FFMPEG), "-hide_banner", "-nostats", "-i", str(path),
        "-af", "silencedetect=noise=-90dB:duration=0.05", "-f", "null", "-",
    ], check=True, text=True, capture_output=True)
    silence_starts = re.findall(r"silence_start: ([0-9.]+)", silence_run.stderr)
    silence_ends = re.findall(r"silence_end: ([0-9.]+)", silence_run.stderr)
    silence_duration = sum(float(end) - float(start) for start, end in zip(silence_starts, silence_ends))
    coverage = {
        "samples": f"0..{sample_count - 1}", "channels": "both",
        "complete_stream": True,
    }
    provider = {"name": "FFmpeg", "version": version}
    definitions = {
        "integrated_lufs": (
            lufs, "LUFS", "estimate",
            "Compare integrated loudness. Refuse a direction when the source is silent.",
            "EBU R128 integrated measurement. Null means the silence gate refused the estimate.",
        ),
        "sample_peak_dbfs": (
            peak, "dBFS", "deterministic decoded aggregate",
            "Detect clipping risk and describe level only when level is relevant.",
            "Null means all decoded samples are zero.",
        ),
        "crest_db": (
            crest, "dB", "deterministic derived metric",
            "Compare peak-to-RMS dynamic behavior.",
            "Derived from complete-stream FFmpeg peak and RMS aggregates. Null on silence.",
        ),
        "spectral_rolloff_hz": (
            rolloff, "Hz", "estimate",
            "Compare the declared brightness proxy after level matching.",
            "Median of complete 8,192-sample Hann frames. Null on silence.",
        ),
        "silence_duration_s": (
            silence_duration, "s", "thresholded fact",
            "Refuse pitch, spectrum, or timbre directions on silence.",
            "Threshold is -90 dBFS for at least 0.05 s.",
        ),
    }
    return [
        {
            "field_id": f"audio.{source['id']}.{name}",
            "value": value,
            "unit": unit,
            "kind": kind,
            "provider": provider,
            "source_identity": {"id": source["id"], "sha256": source["sha256"]},
            "coverage": coverage,
            "uncertainty_rule": uncertainty,
            "decision_purpose": purpose,
        }
        for name, (value, unit, kind, purpose, uncertainty) in definitions.items()
    ]


def pair_map() -> dict[str, tuple[str, str]]:
    return {
        "midi_voice_leading": ("voice-A", "voice-B"),
        "midi_syncopation": ("sync-A", "sync-B"),
        "midi_no_change": ("same-A", "same-B"),
        "midi_compelling": ("compelling-A", "compelling-B"),
        "audio_brightness": ("brightness-A", "brightness-B"),
        "audio_loudness": ("loudness-A", "loudness-B"),
        "audio_no_change": ("audio-same-A", "audio-same-B"),
        "audio_silence": ("silence-A", "silence-B"),
        "audio_presence": ("presence-A", "presence-B"),
    }


def task_contract(midi_sources: dict[str, Any]) -> dict[str, Any]:
    base = midi_sources["edit-base"]
    return {
        "case_questions": {
            "midi_voice_leading": "Which version has lower mean adjacent pitch movement?",
            "midi_syncopation": "Which version has the higher weak-eighth onset ratio?",
            "midi_no_change": "Which version has a higher median register?",
            "midi_compelling": "Which version is more compelling?",
            "audio_brightness": "After level matching, which version has higher spectral rolloff?",
            "audio_loudness": "Which version has higher integrated loudness? Loudness is the target.",
            "audio_no_change": "Which version has higher crest factor?",
            "audio_silence": "Which version is brighter?",
            "audio_presence": "Which version has more presence? No operational definition is supplied.",
        },
        "decisions": ["A", "B", "no_change", "insufficient"],
        "edit_selection": {
            "task": "Increase the weak-eighth onset ratio. Preserve pitch, velocity, duration, note count, and register.",
            "source_id": base["id"],
            "base_sha256": base["sha256"],
            "candidates": [
                {
                    "candidate_id": "raise-octave",
                    "summary": "Transpose all notes up 12 semitones.",
                },
                {
                    "candidate_id": "move-four-offbeats",
                    "summary": "Move notes 2, 4, 6, and 8 from integer beats to the following half beat.",
                },
                {
                    "candidate_id": "delete-alternates",
                    "summary": "Delete notes 2, 4, 6, and 8.",
                },
            ],
        },
        "midi_patch": {
            "task": "Propose a bounded patch that increases the weak-eighth onset ratio. Preserve pitch, velocity, duration, note count, register, track, and all host-only fields.",
            "source_id": base["id"],
            "base_sha256": base["sha256"],
            "allowed_operation": "move",
            "minimum_weak_eighth_onsets": 4,
            "literal_shape": {
                "schema": PATCH_SCHEMA,
                "base_sha256": base["sha256"],
                "ops": [{"op": "move", "note_id": f"{base['id']}-n2", "start": "3/2"}],
            },
        },
        "material_prediction_values": [
            "likely_audible_or_material", "unlikely_audible_or_material", "unknown",
        ],
    }


def prepare(work_dir: Path) -> dict[str, Any]:
    midi_sources = make_midi_sources()
    audio_sources = make_audio_sources(work_dir / "audio")
    version = ffmpeg_version()
    midi_facts = {
        source_id: midi_fact_records(source) for source_id, source in midi_sources.items()
    }
    audio_facts = {
        source_id: audio_fact_records(source, version) for source_id, source in audio_sources.items()
    }
    manifest = {
        "schema": SCHEMA,
        "permission": PERMISSION,
        "midi_sources": midi_sources,
        "audio_sources": audio_sources,
        "midi_facts": midi_facts,
        "audio_facts": audio_facts,
        "pairs": pair_map(),
        "tasks": task_contract(midi_sources),
        "providers": {"midi": MIDI_PROVIDER, "audio": {"name": "FFmpeg", "version": version}},
    }
    manifest["cohort_sha256"] = digest({
        "midi": {key: value["sha256"] for key, value in midi_sources.items()},
        "audio": {key: value["sha256"] for key, value in audio_sources.items()},
        "pairs": manifest["pairs"], "tasks": manifest["tasks"],
    })
    (work_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    return manifest


def fact_by_name(manifest: dict[str, Any], source_id: str, name: str) -> dict[str, Any]:
    group = manifest["midi_facts"] if source_id in manifest["midi_facts"] else manifest["audio_facts"]
    suffix = f".{name}"
    return next(row for row in group[source_id] if row["field_id"].endswith(suffix))


def routed_field(
    manifest: dict[str, Any], case_id: str, fact_name: str, purpose: str,
) -> dict[str, Any]:
    source_a, source_b = manifest["pairs"][case_id]
    first = fact_by_name(manifest, source_a, fact_name)
    second = fact_by_name(manifest, source_b, fact_name)
    first_value, second_value = first["value"], second["value"]
    delta = None if first_value is None or second_value is None else second_value - first_value
    return {
        "field_id": f"route.{case_id}.{fact_name}.B_minus_A",
        "A": first_value,
        "B": second_value,
        "delta_B_minus_A": delta,
        "unit": first["unit"],
        "kind": first["kind"],
        "providers": [first["provider"], second["provider"]],
        "source_identity": [first["source_identity"], second["source_identity"]],
        "coverage": [first["coverage"], second["coverage"]],
        "uncertainty_rule": first["uncertainty_rule"],
        "decision_purpose": purpose,
    }


def identity_view(manifest: dict[str, Any]) -> dict[str, Any]:
    midi_ids = {source_id for pair in manifest["pairs"].values() for source_id in pair if source_id in manifest["midi_sources"]}
    audio_ids = {source_id for pair in manifest["pairs"].values() for source_id in pair if source_id in manifest["audio_sources"]}
    return {
        "kind": "raw exact identity and notes",
        "midi": [
            {
                "field_id": f"raw.{source_id}.notes",
                "source_identity": {"id": source_id, "sha256": manifest["midi_sources"][source_id]["sha256"]},
                "coverage": manifest["midi_sources"][source_id]["coverage"],
                "notes": manifest["midi_sources"][source_id]["notes"],
            }
            for source_id in sorted(midi_ids)
        ],
        "audio": [
            {
                "field_id": f"identity.{source_id}.sha256",
                "source_identity": {"id": source_id, "sha256": manifest["audio_sources"][source_id]["sha256"]},
                "format": manifest["audio_sources"][source_id]["format"],
            }
            for source_id in sorted(audio_ids)
        ],
        "limits": "Audio identity does not describe sound. Abstain when the task needs audio content.",
    }


def raw_facts_view(manifest: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": "raw deterministic facts and bounded estimates",
        "midi": [row for source_id in sorted(manifest["midi_facts"]) for row in manifest["midi_facts"][source_id]],
        "audio": [row for source_id in sorted(manifest["audio_facts"]) for row in manifest["audio_facts"][source_id]],
        "limits": [
            "Each field is independent. Derive paired direction before deciding.",
            "A metric is not an aesthetic or perceptual verdict.",
            "Do not map undefined presence or compelling requests to a convenient metric.",
        ],
    }


def routed_view(manifest: dict[str, Any]) -> dict[str, Any]:
    routes: dict[str, dict[str, Any]] = {
        "midi_voice_leading": {
            "fields": [routed_field(manifest, "midi_voice_leading", "mean_adjacent_motion_semitones", "Choose the lower adjacent movement.")],
            "limit": "This metric does not prove aesthetic smoothness.",
        },
        "midi_syncopation": {
            "fields": [routed_field(manifest, "midi_syncopation", "weak_eighth_onset_ratio", "Choose the higher declared syncopation proxy.")],
            "limit": "This proxy covers onset placement only.",
        },
        "midi_no_change": {
            "fields": [routed_field(manifest, "midi_no_change", "register_median_midi", "Detect a register change or no change.")],
            "limit": "Equal values require no_change.",
        },
        "midi_compelling": {
            "fields": [
                routed_field(manifest, "midi_compelling", "register_median_midi", "Report register only."),
                routed_field(manifest, "midi_compelling", "mean_adjacent_motion_semitones", "Report movement only."),
                routed_field(manifest, "midi_compelling", "weak_eighth_onset_ratio", "Report onset placement only."),
            ],
            "limit": "No supplied field defines compelling. Return insufficient.",
        },
        "audio_brightness": {
            "fields": [
                routed_field(manifest, "audio_brightness", "spectral_rolloff_hz", "Choose the higher rolloff as the declared brightness proxy."),
                routed_field(manifest, "audio_brightness", "integrated_lufs", "Confirm level matching before using rolloff."),
            ],
            "limit": "Use rolloff only because the task declares it. The files must be within 0.2 LUFS.",
        },
        "audio_loudness": {
            "fields": [routed_field(manifest, "audio_loudness", "integrated_lufs", "Choose higher integrated loudness.")],
            "limit": "Loudness is the target, so level matching does not apply.",
        },
        "audio_no_change": {
            "fields": [routed_field(manifest, "audio_no_change", "crest_db", "Detect a crest-factor change or no change.")],
            "limit": "Equal values require no_change.",
        },
        "audio_silence": {
            "fields": [
                routed_field(manifest, "audio_silence", "silence_duration_s", "Apply the silence refusal."),
                routed_field(manifest, "audio_silence", "spectral_rolloff_hz", "Refuse a brightness direction when rolloff is null."),
            ],
            "limit": "Both sources are silent. Return insufficient or no_change without a directional claim.",
        },
        "audio_presence": {
            "fields": [
                routed_field(manifest, "audio_presence", "spectral_rolloff_hz", "Report spectral balance only."),
                routed_field(manifest, "audio_presence", "crest_db", "Report dynamic behavior only."),
                routed_field(manifest, "audio_presence", "integrated_lufs", "Confirm level matching."),
            ],
            "limit": "No supplied field defines presence, and rolloff and crest point to different versions. Return insufficient.",
        },
    }
    base = manifest["midi_sources"]["edit-base"]
    return {
        "schema": PACKET_SCHEMA,
        "kind": "task-routed paired evidence",
        "routes": routes,
        "edit_route": {
            "fields": [
                *midi_fact_records(base),
                {
                    "field_id": "route.edit.move-four-offbeats.expected_weak_eighth_ratio",
                    "value": 0.5, "unit": "ratio", "kind": "deterministic candidate delta",
                    "provider": MIDI_PROVIDER,
                    "source_identity": {"id": base["id"], "sha256": base["sha256"]},
                    "coverage": base["coverage"],
                    "uncertainty_rule": "Exact under the declared candidate operation.",
                    "decision_purpose": "Select the candidate that raises weak-eighth onsets and preserves the invariants.",
                },
            ],
            "limit": "Only onset moves can meet all declared invariants.",
        },
        "limits": "Packets support bounded decisions. They do not supply an aesthetic verdict.",
    }


def arm_view(arm: str, manifest: dict[str, Any]) -> dict[str, Any]:
    views = {
        "raw-identity": identity_view,
        "raw-facts": raw_facts_view,
        "task-routed": routed_view,
    }
    result = views[arm](manifest)
    base = manifest["midi_sources"]["edit-base"]
    result["shared_patch_source"] = {
        "field_id": "raw.edit-base.notes",
        "source_identity": {"id": base["id"], "sha256": base["sha256"]},
        "coverage": base["coverage"],
        "notes": base["notes"],
    }
    return result


def evidence_ids(value: Any) -> set[str]:
    found: set[str] = set()
    if isinstance(value, dict):
        if isinstance(value.get("field_id"), str):
            found.add(value["field_id"])
        for child in value.values():
            found.update(evidence_ids(child))
    elif isinstance(value, list):
        for child in value:
            found.update(evidence_ids(child))
    return found


def prompt(arm: str, manifest: dict[str, Any]) -> str:
    tasks = manifest["tasks"]
    example = {
        "schema": RESPONSE_SCHEMA,
        "arm": arm,
        "case_answers": [
            {
                "case_id": case_id,
                "decision": "insufficient",
                "confidence": "low",
                "evidence_used": [],
                "interpretation": "One short agent interpretation.",
                "insufficient_facts": ["One short gap, or an empty list."],
                "material_prediction": "unknown",
            }
            for case_id in tasks["case_questions"]
        ],
        "edit_selection": {
            "candidate_id": "move-four-offbeats",
            "evidence_used": [],
            "interpretation": "One short agent interpretation.",
            "material_prediction": "likely_audible_or_material",
        },
        "midi_patch": {
            "patch": tasks["midi_patch"]["literal_shape"],
            "evidence_used": [],
            "interpretation": "One short agent interpretation.",
            "material_prediction": "likely_audible_or_material",
        },
    }
    return f"""Use only the supplied evidence to make bounded music-workstation decisions.
Return one JSON object and no markdown. Keep facts, estimates, your interpretations, and operator verdicts separate. Do not provide an operator verdict. Cite evidence only by an exact field_id that appears in the sensory input. A hash proves identity, not sound. A deterministic metric is not an aesthetic judgment. Return insufficient when the evidence does not define or support the requested property.

Use this literal output shape. Replace values but do not rename keys or omit case rows:
{json.dumps(example, indent=2, sort_keys=True)}

Case decision values: A, B, no_change, insufficient.
Confidence values: low, medium, high.
Material prediction values: likely_audible_or_material, unlikely_audible_or_material, unknown.
For silence or insufficient evidence, do not make a confident directional or audibility claim.
The MIDI patch must use only move operations. It must meet all patch invariants. Exact state stays outside your output.

TASK CONTRACT
{json.dumps(tasks, indent=2, sort_keys=True)}

SOURCE PAIRS
{json.dumps(manifest['pairs'], indent=2, sort_keys=True)}

SENSORY INPUT ARM: {arm}
{json.dumps(arm_view(arm, manifest), indent=2, sort_keys=True)}
"""


def patch_validation(patch: Any, base_source: dict[str, Any]) -> dict[str, Any]:
    errors = symbolic.patch_errors(patch, base_source)
    if isinstance(patch, dict) and isinstance(patch.get("ops"), list):
        for index, operation in enumerate(patch["ops"]):
            if not isinstance(operation, dict) or operation.get("op") != "move":
                errors.append(f"op {index} must be move")
    if errors:
        return {"valid": False, "errors": errors, "compiled_notes": None, "compiled_sha256": None}
    try:
        compiled = symbolic.compile_patch(patch, base_source)
    except ValueError as error:
        return {"valid": False, "errors": [str(error)], "compiled_notes": None, "compiled_sha256": None}
    original = {row["id"]: row for row in base_source["notes"]}
    candidate = {row["id"]: row for row in compiled}
    invariant_fields = (
        "pitch", "velocity", "duration", "track", "channel", "muted",
        "release_velocity", "expression",
    )
    invariants = {
        "note_count": len(original) == len(candidate),
        "note_ids": set(original) == set(candidate),
        "unmoved_fields": all(
            all(original[note_id][field] == candidate[note_id][field] for field in invariant_fields)
            for note_id in original.keys() & candidate.keys()
        ),
        "register": midi_values({**base_source, "notes": compiled})["register_median_midi"]
        == midi_values(base_source)["register_median_midi"],
    }
    weak_ratio = midi_values({**base_source, "notes": compiled})["weak_eighth_onset_ratio"]
    property_check = weak_ratio >= 0.5 and weak_ratio > midi_values(base_source)["weak_eighth_onset_ratio"]
    if not all(invariants.values()):
        errors.append("one or more declared invariants failed")
    if not property_check:
        errors.append("weak-eighth onset ratio did not reach 0.5")
    return {
        "valid": not errors,
        "errors": errors,
        "invariants": invariants,
        "weak_eighth_onset_ratio": weak_ratio,
        "compiled_notes": compiled,
        "compiled_sha256": digest(compiled),
    }


def validate_response(value: dict[str, Any], arm: str, manifest: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    if value.get("schema") != RESPONSE_SCHEMA:
        errors.append(f"schema must be {RESPONSE_SCHEMA}")
    if value.get("arm") != arm:
        errors.append(f"arm must be {arm}")
    rows = value.get("case_answers")
    if not isinstance(rows, list):
        rows = []
        errors.append("case_answers must be a list")
    by_id = {
        row.get("case_id"): row for row in rows
        if isinstance(row, dict) and isinstance(row.get("case_id"), str)
    }
    if set(by_id) != set(CASE_EXPECTED):
        errors.append("case_answers must contain each exact case_id once")
    allowed_evidence = evidence_ids(arm_view(arm, manifest))
    decisions = []
    unsupported_claims = []
    fields_used: set[str] = set()
    for case_id, expected in CASE_EXPECTED.items():
        row = by_id.get(case_id, {})
        decision = row.get("decision")
        confidence = row.get("confidence")
        cited = row.get("evidence_used") if isinstance(row.get("evidence_used"), list) else []
        fields_used.update(value for value in cited if isinstance(value, str))
        unknown = sorted(value for value in cited if value not in allowed_evidence)
        if unknown:
            errors.append(f"{case_id} cites unavailable evidence: {unknown}")
        if decision not in {"A", "B", "no_change", "insufficient"}:
            errors.append(f"{case_id} has an invalid decision")
        if confidence not in {"low", "medium", "high"}:
            errors.append(f"{case_id} has invalid confidence")
        material = row.get("material_prediction")
        if material not in manifest["tasks"]["material_prediction_values"]:
            errors.append(f"{case_id} has invalid material_prediction")
        if case_id in {"midi_compelling", "audio_silence", "audio_presence"} and material != "unknown":
            unsupported_claims.append({"case_id": case_id, "kind": "material prediction without supporting evidence"})
        if case_id in CONTROL_CASES and decision in {"A", "B"} and confidence in {"medium", "high"}:
            unsupported_claims.append({"case_id": case_id, "kind": "confident directional control claim"})
        decisions.append({
            "case_id": case_id,
            "decision": decision,
            "expected": sorted(expected),
            "correct": decision in expected,
            "confidence": confidence,
        })
    selection = value.get("edit_selection") if isinstance(value.get("edit_selection"), dict) else {}
    selection_evidence = selection.get("evidence_used") if isinstance(selection.get("evidence_used"), list) else []
    fields_used.update(item for item in selection_evidence if isinstance(item, str))
    unknown_selection = sorted(item for item in selection_evidence if item not in allowed_evidence)
    if unknown_selection:
        errors.append(f"edit_selection cites unavailable evidence: {unknown_selection}")
    selection_correct = selection.get("candidate_id") == "move-four-offbeats"
    patch_row = value.get("midi_patch") if isinstance(value.get("midi_patch"), dict) else {}
    patch_evidence = patch_row.get("evidence_used") if isinstance(patch_row.get("evidence_used"), list) else []
    fields_used.update(item for item in patch_evidence if isinstance(item, str))
    unknown_patch = sorted(item for item in patch_evidence if item not in allowed_evidence)
    if unknown_patch:
        errors.append(f"midi_patch cites unavailable evidence: {unknown_patch}")
    patch = patch_validation(patch_row.get("patch"), manifest["midi_sources"]["edit-base"])
    return {
        "schema_valid": not errors,
        "errors": errors,
        "decisions": decisions,
        "correct_decisions": sum(row["correct"] for row in decisions),
        "decision_total": len(CASE_EXPECTED),
        "control_safe": sum(
            row["correct"] for row in decisions if row["case_id"] in CONTROL_CASES
        ),
        "control_total": len(CONTROL_CASES),
        "edit_selection_correct": selection_correct,
        "patch": patch,
        "unsupported_claims": unsupported_claims,
        "fields_used": sorted(fields_used),
    }


def repair_prompt(validation: dict[str, Any], arm: str, manifest: dict[str, Any]) -> str:
    base = manifest["midi_sources"]["edit-base"]
    return f"""Repair the response and return the complete JSON object again.
Keep schema={RESPONSE_SCHEMA} and arm={arm}. Return each case_id once.
Use only evidence field IDs that appear in the prior sensory input.
Every MIDI patch must copy this exact outer shape and can contain more move operations:
{json.dumps({'schema': PATCH_SCHEMA, 'base_sha256': base['sha256'], 'ops': [{'op': 'move', 'note_id': f"{base['id']}-n2", 'start': '3/2'}]}, sort_keys=True)}
Validator errors:
{json.dumps(validation['errors'] + validation['patch']['errors'], sort_keys=True)}
"""


def run_provider(provider: str, env_file: Path, work_dir: Path) -> dict[str, Any]:
    manifest_path = work_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.is_file() else prepare(work_dir)
    environment = symbolic.load_env(env_file)
    key_name = "OPENAI_API_KEY" if provider == "openai" else "GEMINI_API_KEY"
    if not environment.get(key_name):
        raise ValueError(f"{key_name} is missing")
    results = []
    for arm in ARMS:
        task_prompt = prompt(arm, manifest)
        before_rss = max_rss_bytes()
        started = time.perf_counter()
        value, raw = symbolic.model_call(
            provider, environment[key_name], [{"role": "user", "content": task_prompt}], 12_000,
        )
        latency_ms = (time.perf_counter() - started) * 1_000
        validation = validate_response(value, arm, manifest)
        initial_value = value
        initial_validation = validation
        correction = None
        if not validation["schema_valid"] or not validation["patch"]["valid"]:
            started = time.perf_counter()
            repaired, repair_raw = symbolic.model_call(provider, environment[key_name], [
                {"role": "user", "content": task_prompt},
                {"role": "assistant", "content": canonical(value)},
                {"role": "user", "content": repair_prompt(validation, arm, manifest)},
            ], 12_000)
            correction_validation = validate_response(repaired, arm, manifest)
            correction = {
                "turns": 1,
                "latency_ms": (time.perf_counter() - started) * 1_000,
                "usage": symbolic.usage(provider, repair_raw),
                "returned_model": symbolic.returned_model(provider, repair_raw),
                "request_id": repair_raw.get("id"),
                "result": repaired,
                "validation": correction_validation,
            }
            value, validation = repaired, correction_validation
        results.append({
            "arm": arm,
            "prompt_sha256": hashlib.sha256(task_prompt.encode()).hexdigest(),
            "prompt_utf8_bytes": len(task_prompt.encode()),
            "available_evidence_fields": sorted(evidence_ids(arm_view(arm, manifest))),
            "initial": {
                "latency_ms": latency_ms,
                "usage": symbolic.usage(provider, raw),
                "returned_model": symbolic.returned_model(provider, raw),
                "request_id": raw.get("id"),
                "result": initial_value,
                "validation": initial_validation,
            },
            "correction": correction,
            "result": value,
            "validation": validation,
            "peak_rss_delta_bytes": max(0, max_rss_bytes() - before_rss),
        })
    return {
        "schema": SCHEMA,
        "provider": provider,
        "requested_model": symbolic.OPENAI_MODEL if provider == "openai" else symbolic.GEMINI_MODEL,
        "client": "Python urllib.request direct HTTPS",
        "model_settings": {"reasoning_or_thinking": "low", "temperature": None if provider == "openai" else 0},
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "privacy": "Generated MIT MIDI and audio fixtures only. Audio was not uploaded.",
        "cohort_sha256": manifest["cohort_sha256"],
        "results": results,
    }


def summarize(paths: list[Path]) -> dict[str, Any]:
    runs = [json.loads(path.read_text()) for path in paths]
    rows = []
    for run in runs:
        for item in run["results"]:
            validation = item["validation"]
            initial_usage = item["initial"]["usage"]
            correction = item.get("correction")
            correction_usage = correction["usage"] if correction else {"input_tokens": 0, "output_tokens": 0}
            rows.append({
                "provider": run["provider"],
                "model": item["initial"]["returned_model"],
                "arm": item["arm"],
                "correct_decisions": validation["correct_decisions"],
                "decision_total": validation["decision_total"],
                "control_safe": validation["control_safe"],
                "control_total": validation["control_total"],
                "edit_selection_correct": validation["edit_selection_correct"],
                "patch_valid": validation["patch"]["valid"],
                "unsupported_claims": len(validation["unsupported_claims"]),
                "fields_used": validation["fields_used"],
                "input_tokens": initial_usage["input_tokens"] + correction_usage["input_tokens"],
                "output_tokens": initial_usage["output_tokens"] + correction_usage["output_tokens"],
                "calls": 1 + int(correction is not None),
                "retries": int(correction is not None),
                "latency_ms": item["initial"]["latency_ms"] + (correction["latency_ms"] if correction else 0),
                "peak_rss_delta_bytes": item["peak_rss_delta_bytes"],
            })
    return {
        "schema": SCHEMA,
        "source_sha256": {str(path): sha256(path) for path in paths},
        "rows": rows,
    }


def deterministic_patch(base: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": PATCH_SCHEMA,
        "base_sha256": base["sha256"],
        "ops": [
            {"op": "move", "note_id": f"{base['id']}-n{index}", "start": f"{index * 2 - 1}/2"}
            for index in (2, 4, 6, 8)
        ],
    }


def repeat_notes(notes: list[dict[str, Any]], repeats: int = 2) -> list[dict[str, Any]]:
    result = []
    for repeat in range(repeats):
        for row in notes:
            copied = deepcopy(row)
            copied["id"] = f"r{repeat + 1}-{row['id']}"
            copied["start"] = fraction_text(Fraction(row["start"]) + repeat * 8)
            result.append(copied)
    return result


def ballot_backing() -> list[dict[str, Any]]:
    rows = []
    roots = (48, 53, 55, 48)
    for bar, root in enumerate(roots):
        beat = bar * 4
        rows.append(symbolic.note(f"back-bass-{bar}", "backing-bass", beat, "7/2", root, 66, channel=1))
        for step in range(4):
            rows.append(symbolic.note(
                f"back-drum-{bar}-{step}", "backing-drums", beat + step, "1/8",
                36 if step % 2 == 0 else 42, 72 if step % 2 == 0 else 50, channel=9,
            ))
    return rows


def normalize_ballot_audio(raw_path: Path, output_path: Path) -> float | None:
    subprocess.run([
        str(FFMPEG), "-hide_banner", "-nostats", "-loglevel", "error", "-i", str(raw_path),
        "-af", "loudnorm=I=-20:TP=-2:LRA=7", "-ar", "22050", "-ac", "1",
        "-c:a", "pcm_s16le", "-y", str(output_path),
    ], check=True)
    raw_path.unlink()
    return integrated_lufs(output_path)


def make_ballot(paths: list[Path], work_dir: Path, output: Path, key_output: Path, seed: str) -> dict[str, Any]:
    manifest = json.loads((work_dir / "manifest.json").read_text())
    base = manifest["midi_sources"]["edit-base"]
    candidates: list[dict[str, Any]] = []
    for path in paths:
        run = json.loads(path.read_text())
        for item in run["results"]:
            patch = item["validation"]["patch"]
            if patch["valid"]:
                candidates.append({
                    "sources": [f"{run['provider']}:{item['arm']}"],
                    "compiled_notes": patch["compiled_notes"],
                    "compiled_sha256": patch["compiled_sha256"],
                })
    control = patch_validation(deterministic_patch(base), base)
    candidates.append({
        "sources": ["deterministic-control"],
        "compiled_notes": control["compiled_notes"],
        "compiled_sha256": control["compiled_sha256"],
    })
    candidates.append({
        "sources": ["no-change-control"],
        "compiled_notes": base["notes"],
        "compiled_sha256": digest(base["notes"]),
    })
    unique: dict[str, dict[str, Any]] = {}
    for candidate in candidates:
        existing = unique.get(candidate["compiled_sha256"])
        if existing:
            existing["sources"].extend(candidate["sources"])
        else:
            unique[candidate["compiled_sha256"]] = candidate
    candidates = list(unique.values())
    random.Random(seed).shuffle(candidates)
    audio_dir = output.parent / f"{output.stem}-audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    key = {
        "schema": "ghostnote-sensory-ballot-key-v0",
        "seed": seed,
        "level_target_lufs": -20,
        "candidates": {},
    }
    lines = [
        "# Phase 6h blind operator ballot", "",
        "Listen for one property: which candidate makes the offbeat pull clearest while it preserves the melody, density, and register? All candidates use the same fixed backing and loudness target.", "",
    ]
    for index, candidate in enumerate(candidates):
        alias = chr(ord("A") + index)
        raw_path = audio_dir / f"candidate-{alias}-raw.wav"
        audio_path = audio_dir / f"candidate-{alias}.wav"
        rendered = repeat_notes(candidate["compiled_notes"]) + ballot_backing()
        reference.render_audio(rendered, Fraction(), raw_path)
        measured_lufs = normalize_ballot_audio(raw_path, audio_path)
        key["candidates"][alias] = {
            "sources": sorted(candidate["sources"]),
            "compiled_sha256": candidate["compiled_sha256"],
            "audio_sha256": sha256(audio_path),
            "integrated_lufs": measured_lufs,
        }
        lines.extend((f"## Candidate {alias}", "", f"Audio: [{audio_path.name}](<{audio_path}>)", ""))
    lines.extend((
        "Best candidate, or `cannot-decide`:", "",
        "Reason:", "",
        "Was the change audible and musically material? `yes`, `no`, or `cannot-decide`:", "",
    ))
    output.write_text("\n".join(lines))
    key_output.write_text(json.dumps(key, indent=2, sort_keys=True) + "\n")
    return {
        "ballot": str(output), "key": str(key_output), "audio_dir": str(audio_dir),
        "unique_candidates": len(candidates),
        "candidate_lufs": {alias: row["integrated_lufs"] for alias, row in key["candidates"].items()},
    }


def self_test() -> dict[str, Any]:
    midi_sources = make_midi_sources()
    assert midi_values(midi_sources["voice-B"])["mean_adjacent_motion_semitones"] < midi_values(midi_sources["voice-A"])["mean_adjacent_motion_semitones"]
    assert midi_values(midi_sources["sync-B"])["weak_eighth_onset_ratio"] == 0.5
    assert midi_values(midi_sources["same-A"]) == midi_values(midi_sources["same-B"])
    patch = patch_validation(deterministic_patch(midi_sources["edit-base"]), midi_sources["edit-base"])
    assert patch["valid"] and all(patch["invariants"].values())
    stale = deterministic_patch(midi_sources["edit-base"])
    stale["base_sha256"] = "stale"
    assert not patch_validation(stale, midi_sources["edit-base"])["valid"]
    with tempfile.TemporaryDirectory(prefix="ghostnote-phase6h-") as directory:
        manifest = prepare(Path(directory))
        assert manifest["audio_sources"]["audio-same-A"]["sha256"] == manifest["audio_sources"]["audio-same-B"]["sha256"]
        bright_lufs = [fact_by_name(manifest, source, "integrated_lufs")["value"] for source in ("brightness-A", "brightness-B")]
        assert abs(bright_lufs[1] - bright_lufs[0]) <= 0.2
        assert fact_by_name(manifest, "brightness-B", "spectral_rolloff_hz")["value"] > fact_by_name(manifest, "brightness-A", "spectral_rolloff_hz")["value"]
        assert fact_by_name(manifest, "loudness-B", "integrated_lufs")["value"] > fact_by_name(manifest, "loudness-A", "integrated_lufs")["value"]
        assert fact_by_name(manifest, "silence-A", "spectral_rolloff_hz")["value"] is None
        assert fact_by_name(manifest, "presence-B", "spectral_rolloff_hz")["value"] > fact_by_name(manifest, "presence-A", "spectral_rolloff_hz")["value"]
        assert fact_by_name(manifest, "presence-A", "crest_db")["value"] > fact_by_name(manifest, "presence-B", "crest_db")["value"]
        assert abs(fact_by_name(manifest, "presence-A", "integrated_lufs")["value"] - fact_by_name(manifest, "presence-B", "integrated_lufs")["value"]) <= 0.2
        assert set(arm_view("task-routed", manifest)["routes"]) == set(CASE_EXPECTED)
        assert digest(manifest["pairs"]) == digest(pair_map())
        cohort_sha256 = manifest["cohort_sha256"]
    return {
        "passed": 15,
        "cohort_sha256": cohort_sha256,
        "deterministic_patch_sha256": patch["compiled_sha256"],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--provider", choices=PROVIDERS)
    parser.add_argument("--env-file", type=Path, default=Path(".env"))
    parser.add_argument("--work-dir", type=Path)
    parser.add_argument("--summarize", nargs="*", type=Path)
    parser.add_argument("--ballot", nargs="*", type=Path)
    parser.add_argument("--ballot-key", type=Path)
    parser.add_argument("--ballot-seed", default="phase6h-blind-v0")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.self_test:
        result = self_test()
    elif args.prepare:
        if args.work_dir is None:
            parser.error("--prepare needs --work-dir")
        result = prepare(args.work_dir)
    elif args.provider:
        if args.work_dir is None:
            parser.error("--provider needs --work-dir")
        result = run_provider(args.provider, args.env_file, args.work_dir)
    elif args.summarize:
        result = summarize(args.summarize)
    elif args.ballot:
        if args.work_dir is None or args.output is None or args.ballot_key is None:
            parser.error("--ballot needs --work-dir, --output, and --ballot-key")
        result = make_ballot(args.ballot, args.work_dir, args.output, args.ballot_key, args.ballot_seed)
        print(json.dumps(result, indent=2, sort_keys=True))
        return
    else:
        parser.error("select --self-test, --prepare, --provider, --summarize, or --ballot")
    text = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(text)
    else:
        print(text, end="")


if __name__ == "__main__":
    main()
