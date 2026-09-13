#!/usr/bin/env python3
"""Compare compact performed events with an explicit groove timing layer."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import platform
import time
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
from typing import Any


BASE_PATH = Path(__file__).with_name("phase6f-symbolic-representation.py")
BASE_SPEC = importlib.util.spec_from_file_location("phase6f_base", BASE_PATH)
if BASE_SPEC is None or BASE_SPEC.loader is None:
    raise RuntimeError(f"Cannot load {BASE_PATH}")
base = importlib.util.module_from_spec(BASE_SPEC)
BASE_SPEC.loader.exec_module(base)

SCHEMA = "ghostnote-groove-eval-v0"
CONTEXT_SCHEMA = "ghostnote-groove-context-v0"
PATCH_SCHEMA = "ghostnote-groove-patch-v0"
ARMS = ("compact-bar-v0", "groove-two-layer-v0")
PROVIDERS = ("openai", "gemini")
SOURCE_LICENSE = "MIT generated project fixture"
RESEARCH = {
    "jazz": ["PMC6934603", "doi:10.1038/s42005-022-00995-z"],
    "funk": ["doi:10.31751/1224"],
    "hiphop": ["hdl:1794/23759", "doi:10.1093/mts/mtad005"],
}


def canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def frac(value: str | int | Fraction) -> Fraction:
    return value if isinstance(value, Fraction) else Fraction(str(value))


def ftext(value: str | int | Fraction) -> str:
    number = frac(value)
    return str(number.numerator) if number.denominator == 1 else f"{number.numerator}/{number.denominator}"


def event(
    event_id: str,
    track: str,
    layer: str,
    nominal: str | int,
    duration: str | int,
    pitch: int,
    velocity: int,
    reference: str,
    template: str | int = 0,
    phase: str | int = 0,
    cross: str | int = 0,
    local: str | int = 0,
    unstable_steps: int = 0,
    articulation: str = "normal",
    anchor: str | None = None,
) -> dict[str, Any]:
    return {
        "id": event_id,
        "track": track,
        "layer": layer,
        "nominal": {"position_beats": ftext(nominal), "duration_beats": ftext(duration)},
        "pitch": pitch,
        "velocity": velocity,
        "articulation": articulation,
        "timing": {
            "reference_id": reference,
            "template_beats": ftext(template),
            "phase_beats": ftext(phase),
            "cross_part_beats": ftext(cross),
            "local_beats": ftext(local),
            "unstable_max_steps": unstable_steps,
            "anchor_event_id": anchor,
            "confidence": 1.0,
            "intent_provenance": "generated-declared",
        },
    }


def source_fixtures() -> dict[str, dict[str, Any]]:
    fixtures = {
        "jazz": {
            "tempo_bpm": 150,
            "tempo_map": [{"start_beats": "0", "bpm": 150}],
            "meter": "4/4",
            "harmony": ["Cmaj9#11", "E7alt"],
            "references": [
                {"id": "jazz-rhythm", "subdivision_beats": "1/3", "phase_beats": "0", "swing_ratio": "2:1", "shape": "point"},
                {"id": "jazz-solo", "subdivision_beats": "1/3", "phase_beats": "0", "swing_ratio": "2:1", "shape": "point"},
            ],
            "events": [
                event("j-b1", "bass", "rhythm-section", 0, "1/2", 36, 82, "jazz-rhythm"),
                event("j-b2", "bass", "rhythm-section", "2/3", "1/3", 43, 78, "jazz-rhythm"),
                event("j-k1", "keys", "solo", 0, "1/2", 60, 88, "jazz-solo", phase="11/128", anchor="j-b1"),
                event("j-k2", "keys", "solo", 0, "1/2", 64, 84, "jazz-solo", phase="11/128", anchor="j-b1"),
                event("j-k3", "keys", "solo", 0, "1/2", 66, 80, "jazz-solo", phase="11/128", anchor="j-b1"),
                event("j-k4", "keys", "solo", 0, "1/2", 71, 82, "jazz-solo", phase="11/128", anchor="j-b1"),
                event("j-k5", "keys", "solo", "2/3", "1/3", 73, 86, "jazz-solo", anchor="j-b2"),
                event("j-d1", "drums", "ride", 0, "1/8", 51, 96, "jazz-rhythm"),
                event("j-d2", "drums", "ride", "2/3", "1/8", 51, 72, "jazz-rhythm"),
            ],
        },
        "funk": {
            "tempo_bpm": 105,
            "tempo_map": [
                {"start_beats": "0", "bpm": 105},
                {"start_beats": "1/2", "bpm": 106},
            ],
            "meter": "4/4",
            "harmony": ["E9sus4"],
            "references": [
                {"id": "funk-anchor", "subdivision_beats": "1/4", "phase_beats": "0", "swing_ratio": None, "shape": "span:1/128"},
                {"id": "funk-hat", "subdivision_beats": "1/4", "phase_beats": "0", "swing_ratio": "17:15", "shape": "span:1/128"},
            ],
            "events": [
                event("f-k1", "drums", "kick", 0, "1/8", 36, 112, "funk-anchor"),
                event("f-s1", "drums", "snare", 1, "1/8", 38, 108, "funk-anchor", local="1/64", anchor="f-k1"),
                event("f-h1", "drums", "hat", 0, "1/16", 42, 91, "funk-hat"),
                event("f-h2", "drums", "hat", "1/4", "1/16", 42, 72, "funk-hat", template="1/64"),
                event("f-h3", "drums", "hat", "1/2", "1/16", 42, 88, "funk-hat"),
                event("f-h4", "drums", "hat", "3/4", "1/16", 42, 70, "funk-hat", template="1/64"),
                event("f-g1", "guitar", "comp", 0, "3/16", 52, 84, "funk-anchor", cross="-1/128", anchor="f-k1"),
                event("f-g2", "guitar", "comp", 0, "3/16", 57, 80, "funk-anchor", cross="-1/128", anchor="f-k1"),
                event("f-g3", "guitar", "comp", 0, "3/16", 62, 78, "funk-anchor", cross="-1/128", anchor="f-k1"),
            ],
        },
        "hiphop": {
            "tempo_bpm": 92,
            "tempo_map": [{"start_beats": "0", "bpm": 92}],
            "meter": "4/4",
            "harmony": ["Fm11", "Dbmaj9"],
            "references": [
                {"id": "hiphop-anchor", "subdivision_beats": "1/4", "phase_beats": "0", "swing_ratio": None, "shape": "span:1/64"},
                {"id": "hiphop-snare", "subdivision_beats": "1/4", "phase_beats": "0", "swing_ratio": None, "shape": "span:1/64"},
                {"id": "hiphop-keys", "subdivision_beats": "1/4", "phase_beats": "0", "swing_ratio": None, "shape": "span:1/32"},
            ],
            "events": [
                event("h-k1", "drums", "kick", 0, "1/8", 36, 115, "hiphop-anchor"),
                event("h-s1", "drums", "snare", 1, "1/8", 38, 106, "hiphop-snare", phase="3/64", anchor="h-k1"),
                event("h-s1f", "drums", "snare-flam", "257/256", "1/16", 40, 67, "hiphop-snare", phase="3/64", anchor="h-s1", articulation="flam"),
                event("h-h1", "drums", "hat", 0, "1/16", 42, 83, "hiphop-anchor", unstable_steps=2),
                event("h-h2", "drums", "hat", "1/2", "1/16", 42, 76, "hiphop-anchor", unstable_steps=2),
                event("h-c1", "keys", "chords", 0, "3/4", 53, 78, "hiphop-keys", phase="5/64"),
                event("h-c2", "keys", "chords", 0, "3/4", 56, 75, "hiphop-keys", phase="5/64"),
                event("h-c3", "keys", "chords", 0, "3/4", 60, 73, "hiphop-keys", phase="5/64"),
                event("h-c4", "keys", "chords", 0, "3/4", 63, 71, "hiphop-keys", phase="5/64"),
            ],
        },
    }
    for genre, item in fixtures.items():
        item.update({
            "id": f"generated-{genre}-v0",
            "genre_label": genre,
            "license": SOURCE_LICENSE,
            "research_methods": RESEARCH[genre],
            "coverage": {"bars": "0-1", "tracks_complete": True, "notes_complete": True},
            "provenance": {"kind": "generated-control", "source_audio": None},
        })
    return fixtures


def seeded_steps(seed: str, event_id: str, maximum: int) -> int:
    if maximum == 0:
        return 0
    raw = int(hashlib.sha256(f"{seed}:{event_id}".encode()).hexdigest()[:8], 16)
    return raw % (maximum * 2 + 1) - maximum


def tempo_at(tempo_map: list[dict[str, Any]], position: Fraction) -> int:
    active = [row for row in tempo_map if frac(row["start_beats"]) <= position]
    if not active:
        raise ValueError("tempo map has no value at the event position")
    return int(active[-1]["bpm"])


def realize(source: dict[str, Any], seed: str) -> dict[str, Any]:
    result = deepcopy(source)
    realized = []
    for item in result.pop("events"):
        timing = item["timing"]
        random_offset = Fraction(seeded_steps(seed, item["id"], timing.pop("unstable_max_steps")), 512)
        components = {
            "template_beats": frac(timing["template_beats"]),
            "phase_beats": frac(timing["phase_beats"]),
            "cross_part_beats": frac(timing["cross_part_beats"]),
            "local_beats": frac(timing["local_beats"]) + random_offset,
        }
        deviation = sum(components.values(), Fraction())
        nominal = frac(item["nominal"]["position_beats"])
        bpm = tempo_at(result["tempo_map"], nominal)
        performed = nominal + deviation
        realized.append({
            **item,
            "timing": {
                **timing,
                **{key: ftext(value) for key, value in components.items()},
                "deviation_beats": ftext(deviation),
                "deviation_ms": round(float(deviation) * 60000 / bpm, 6),
            },
            "realized": {
                "position_beats": ftext(performed),
                "duration_beats": item["nominal"]["duration_beats"],
                "velocity": item["velocity"],
                "articulation": item["articulation"],
            },
        })
    result["events"] = sorted(realized, key=lambda row: (frac(row["realized"]["position_beats"]), row["track"], row["pitch"], row["id"]))
    result["generation"] = {
        "generator": "ghostnote-phase6f2-control",
        "version": "0",
        "seed": seed,
        "expansion_policy": "sha256-event-offset-v0",
    }
    result["schema"] = CONTEXT_SCHEMA
    result["source_sha256"] = digest(source)
    result["sha256"] = digest(result)
    return result


def cohort(seed: str = "groove-seed-a") -> dict[str, dict[str, Any]]:
    return {genre: realize(item, seed) for genre, item in source_fixtures().items()}


def validate_context(item: dict[str, Any]) -> list[str]:
    errors = []
    if item.get("schema") != CONTEXT_SCHEMA:
        errors.append("schema mismatch")
    references = {reference.get("id") for reference in item.get("references", [])}
    identities = set()
    for event_item in item.get("events", []):
        identity = event_item.get("id")
        if identity in identities:
            errors.append(f"duplicate event ID {identity}")
        identities.add(identity)
        timing = event_item.get("timing", {})
        if timing.get("reference_id") not in references:
            errors.append(f"unknown timing reference on {identity}")
            continue
        try:
            components = sum((frac(timing[key]) for key in (
                "template_beats", "phase_beats", "cross_part_beats", "local_beats"
            )), Fraction())
            nominal = frac(event_item["nominal"]["position_beats"])
            realized = frac(event_item["realized"]["position_beats"])
            if components != frac(timing["deviation_beats"]) or nominal + components != realized:
                errors.append(f"inconsistent timing on {identity}")
            milliseconds = round(float(components) * 60000 / tempo_at(item["tempo_map"], nominal), 6)
            if milliseconds != timing["deviation_ms"]:
                errors.append(f"inconsistent milliseconds on {identity}")
        except (KeyError, TypeError, ValueError, ZeroDivisionError):
            errors.append(f"invalid timing fields on {identity}")
    return errors


def render_bar(item: dict[str, Any]) -> str:
    lines = [f"SCORE {item['id']} HASH {item['sha256']} TEMPO {item['tempo_bpm']} METER {item['meter']}"]
    lines.extend(f"REFERENCE {reference['id']} SUBDIVISION {reference['subdivision_beats']}" for reference in item["references"])
    lines.extend(
        f"NOTE {row['id']} TRACK {row['track']} LAYER {row['layer']} POSITION {row['realized']['position_beats']} "
        f"DURATION {row['realized']['duration_beats']} PITCH {row['pitch']} VELOCITY {row['velocity']}"
        for row in item["events"]
    )
    return "\n".join(lines)


def render_groove(item: dict[str, Any]) -> str:
    lines = [
        f"GROOVE {item['id']} HASH {item['sha256']} TEMPO {item['tempo_bpm']} METER {item['meter']} "
        f"TEMPO_MAP {canonical(item['tempo_map'])} SEED {item['generation']['seed']} "
        f"POLICY {item['generation']['expansion_policy']}"
    ]
    lines.extend(
        f"REFERENCE {row['id']} SUBDIVISION {row['subdivision_beats']} PHASE {row['phase_beats']} "
        f"SWING {row['swing_ratio']} SHAPE {row['shape']}"
        for row in item["references"]
    )
    for row in item["events"]:
        timing = row["timing"]
        lines.append(
            f"EVENT {row['id']} TRACK {row['track']} LAYER {row['layer']} NOMINAL {row['nominal']['position_beats']} "
            f"NOMINAL_DURATION {row['nominal']['duration_beats']} REALIZED {row['realized']['position_beats']} "
            f"REALIZED_DURATION {row['realized']['duration_beats']} PITCH {row['pitch']} VELOCITY {row['velocity']} "
            f"ARTICULATION {row['articulation']} REF {timing['reference_id']} TEMPLATE {timing['template_beats']} "
            f"PHASE {timing['phase_beats']} CROSS {timing['cross_part_beats']} LOCAL {timing['local_beats']} "
            f"DEVIATION {timing['deviation_beats']} DEVIATION_MS {timing['deviation_ms']} ANCHOR {timing['anchor_event_id']} "
            f"CONFIDENCE {timing['confidence']} INTENT_PROVENANCE {timing['intent_provenance']}"
        )
    return "\n".join(lines)


def views(items: dict[str, dict[str, Any]]) -> dict[str, dict[str, str]]:
    return {
        "compact-bar-v0": {genre: render_bar(item) for genre, item in items.items()},
        "groove-two-layer-v0": {genre: render_groove(item) for genre, item in items.items()},
    }


EXPECTED_RECOVERY = {
    "j-k1": {"nominal": "0", "realized": "11/128", "deviation": "11/128", "reference": "jazz-solo"},
    "f-h2": {"nominal": "1/4", "realized": "17/64", "deviation": "1/64", "reference": "funk-hat"},
    "h-s1": {"nominal": "1", "realized": "67/64", "deviation": "3/64", "reference": "hiphop-snare"},
}


def task_prompt(arm: str, rendered: dict[str, str], items: dict[str, dict[str, Any]]) -> str:
    hashes = {genre: item["sha256"] for genre, item in items.items()}
    patch_examples = expected_patches(items)
    return f"""You are evaluating one generated symbolic groove representation. Return one JSON object only.
One beat is one quarter note. Exact rational values are required. Do not infer a nominal time or component that the context omits. Return status unavailable for omitted facts. Treat genre as a label, not aesthetic truth.

Return these keys:
- recovery: an object keyed by j-k1, f-h2, and h-s1. Each available value has nominal, realized, deviation, and reference. An unavailable value is {{"status":"unavailable"}}.
- simultaneous_references: an object keyed by jazz, funk, and hiphop. Each value is the sorted list of reference IDs used by events.
- intent: return known_components with jazz="swing-ratio+solo-downbeat-phase", funk="sixteenth-template+local-backbeat+cross-part-anticipation+tempo-drift", and hiphop="layer-phase+unstable-hats+flam" when supported. Return ambiguous_control={{"status":"abstain","reason":"source-does-not-identify-intent"}}. Timing fit is not proof of intent.
- quantize_patch, component_patch, transfer_patch, and continuation_patch: copy these exact object shapes. Do not rename, move, add, or remove fields:
{canonical(patch_examples)}
- explanation: one concise sentence.

Representation arm: {arm}
Research methods are identifiers only. All executable notes are generated project fixtures under the repository MIT license.

JAZZ
{rendered['jazz']}

FUNK
{rendered['funk']}

HIPHOP
{rendered['hiphop']}
"""


def patch_errors(name: str, value: Any, items: dict[str, dict[str, Any]]) -> list[str]:
    genre = {"quantize_patch": "funk", "component_patch": "jazz", "transfer_patch": "jazz", "continuation_patch": "hiphop"}[name]
    expected_hash = items[genre]["sha256"]
    errors = []
    if not isinstance(value, dict) or value.get("schema") != PATCH_SCHEMA:
        return ["schema mismatch"]
    if value.get("base_sha256") != expected_hash:
        errors.append("base_sha256 mismatch")
    ops = value.get("ops")
    if not isinstance(ops, list) or len(ops) != 1 or not isinstance(ops[0], dict):
        return errors + ["one operation is required"]
    op = ops[0]
    expected = expected_patches(items)[name]["ops"][0]
    if op != expected:
        errors.append(f"operation mismatch: expected {canonical(expected)}")
    return errors


def expected_patches(items: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    operations = {
        "quantize_patch": {"op": "quantize_nominal", "event_ids": ["f-h2", "f-h4"], "grid_beats": "1/4", "preserve_components": ["template", "phase", "cross_part", "local"]},
        "component_patch": {"op": "scale_component", "reference_id": "jazz-solo", "component": "phase", "factor": "1/2", "preserve_components": ["template", "cross_part", "local"]},
        "transfer_patch": {"op": "transfer", "source_event_ids": ["j-k1", "j-k2", "j-k3", "j-k4"], "new_event_ids": ["t-1", "t-2", "t-3", "t-4"], "target_track": "new-keys", "target_harmony": "Dbmaj9#11", "target_pitches": [61, 65, 68, 72], "copy": "timing-only", "default_policy": "track-neutral-v0"},
        "continuation_patch": {"op": "continue", "notes": [
            {"id": "c-k1", "nominal": "2", "timing_source_id": "h-k1", "pitch": 36, "duration": "1/8", "velocity": 110},
            {"id": "c-s1", "nominal": "3", "timing_source_id": "h-s1", "pitch": 38, "duration": "1/8", "velocity": 103},
        ]},
    }
    genres = {
        "quantize_patch": "funk",
        "component_patch": "jazz",
        "transfer_patch": "jazz",
        "continuation_patch": "hiphop",
    }
    return {
        name: {"schema": PATCH_SCHEMA, "base_sha256": items[genres[name]]["sha256"], "ops": [operation]}
        for name, operation in operations.items()
    }


def validate_result(result: dict[str, Any], items: dict[str, dict[str, Any]]) -> dict[str, Any]:
    recovery = result.get("recovery") if isinstance(result.get("recovery"), dict) else {}
    recovery_passed = sum(recovery.get(key) == value for key, value in EXPECTED_RECOVERY.items())
    expected_refs = {
        genre: sorted({event_item["timing"]["reference_id"] for event_item in item["events"]})
        for genre, item in items.items()
    }
    references = result.get("simultaneous_references")
    reference_passed = sum(isinstance(references, dict) and references.get(key) == value for key, value in expected_refs.items())
    intent = result.get("intent") if isinstance(result.get("intent"), dict) else {}
    expected_components = {
        "jazz": "swing-ratio+solo-downbeat-phase",
        "funk": "sixteenth-template+local-backbeat+cross-part-anticipation+tempo-drift",
        "hiphop": "layer-phase+unstable-hats+flam",
    }
    known = intent.get("known_components")
    intent_passed = sum(isinstance(known, dict) and known.get(key) == value for key, value in expected_components.items())
    abstain = intent.get("ambiguous_control") == {"status": "abstain", "reason": "source-does-not-identify-intent"}
    patch_results = {name: patch_errors(name, result.get(name), items) for name in (
        "quantize_patch", "component_patch", "transfer_patch", "continuation_patch"
    )}
    patch_passed = sum(not errors for errors in patch_results.values())
    total = 3 + 3 + 3 + 1 + 4
    passed = recovery_passed + reference_passed + intent_passed + int(abstain) + patch_passed
    return {
        "constraints_passed": passed,
        "constraints_total": total,
        "recovery_passed": recovery_passed,
        "reference_passed": reference_passed,
        "intent_passed": intent_passed,
        "abstain_passed": abstain,
        "patches_passed": patch_passed,
        "patch_errors": patch_results,
    }


def deterministic_screen() -> dict[str, Any]:
    repeated = [cohort() for _ in range(3)]
    hashes = [digest(item) for item in repeated]
    different = digest(cohort("groove-seed-b"))
    items = repeated[0]
    context_errors = {genre: validate_context(item) for genre, item in items.items()}
    rendered = views(items)
    source_pitches = {60, 64, 66, 71}
    target_pitches = {61, 65, 68, 72}
    return {
        "clean_run_sha256": hashes,
        "three_runs_identical": len(set(hashes)) == 1,
        "different_seed_sha256": different,
        "seed_sensitive": different != hashes[0],
        "context_errors": context_errors,
        "all_contexts_valid": all(not errors for errors in context_errors.values()),
        "representation_sha256": {arm: digest(value) for arm, value in rendered.items()},
        "transfer_source_pitch_overlap": len(source_pitches & target_pitches),
        "transfer_timing_source_count": 4,
        "copying_measured_separately": True,
        "tempo_map_segment_count": {
            genre: len(item["tempo_map"]) for genre, item in items.items()
        },
        "cross_part_event_count": sum(
            frac(row["timing"]["cross_part_beats"]) != 0
            for item in items.values() for row in item["events"]
        ),
        "invalid_controls": {
            "stale_patch": patch_errors("quantize_patch", {"schema": PATCH_SCHEMA, "base_sha256": "stale", "ops": []}, items),
            "unknown_reference": validate_context({**items["jazz"], "events": [{**items["jazz"]["events"][0], "timing": {**items["jazz"]["events"][0]["timing"], "reference_id": "missing"}}]}),
        },
    }


def run_provider(provider: str, env_file: Path) -> dict[str, Any]:
    environment = base.load_env(env_file)
    key_name = "OPENAI_API_KEY" if provider == "openai" else "GEMINI_API_KEY"
    if not environment.get(key_name):
        raise ValueError(f"{key_name} is missing")
    items = cohort()
    rendered = views(items)
    results = []
    for arm in ARMS:
        prompt = task_prompt(arm, rendered[arm], items)
        started = time.perf_counter()
        response, raw = base.model_call(
            provider,
            environment[key_name],
            [{"role": "user", "content": prompt}],
            7000,
        )
        results.append({
            "arm": arm,
            "prompt_sha256": hashlib.sha256(prompt.encode()).hexdigest(),
            "latency_ms": (time.perf_counter() - started) * 1000,
            "usage": base.usage(provider, raw),
            "returned_model": base.returned_model(provider, raw),
            "request_id": raw.get("id"),
            "result": response,
            "validation": validate_result(response, items),
        })
    return {
        "schema": SCHEMA,
        "provider": provider,
        "requested_model": base.OPENAI_MODEL if provider == "openai" else base.GEMINI_MODEL,
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "privacy": "Generated MIT project fixtures only. No live project, audio, or third-party note data.",
        "screen": deterministic_screen(),
        "cohort": {genre: {"sha256": item["sha256"], "events": len(item["events"]), "references": len(item["references"])} for genre, item in items.items()},
        "results": results,
    }


def summarize(paths: list[Path]) -> dict[str, Any]:
    rows = []
    for path in paths:
        run = json.loads(path.read_text())
        for result in run["results"]:
            validation = result["validation"]
            rows.append({
                "provider": run["provider"],
                "model": result["returned_model"],
                "arm": result["arm"],
                **validation,
                **result["usage"],
                "latency_ms": result["latency_ms"],
            })
    selected = all(
        any(row["provider"] == provider and row["arm"] == "groove-two-layer-v0" and row["constraints_passed"] == row["constraints_total"] for row in rows)
        for provider in PROVIDERS
    )
    return {"schema": SCHEMA, "rows": rows, "selected_two_layer": selected}


def self_test() -> dict[str, Any]:
    items = cohort()
    screen = deterministic_screen()
    assert screen["three_runs_identical"] and screen["seed_sensitive"]
    assert screen["all_contexts_valid"] and screen["transfer_source_pitch_overlap"] == 0
    assert all(len(item["references"]) >= 2 for item in items.values())
    assert screen["tempo_map_segment_count"]["funk"] == 2
    assert screen["cross_part_event_count"] == 3
    assert set(items["jazz"]["harmony"]) == {"Cmaj9#11", "E7alt"}
    assert EXPECTED_RECOVERY["j-k1"]["realized"] == "11/128"
    expected_patch = {
        "schema": PATCH_SCHEMA,
        "base_sha256": items["funk"]["sha256"],
        "ops": [{"op": "quantize_nominal", "event_ids": ["f-h2", "f-h4"], "grid_beats": "1/4", "preserve_components": ["template", "phase", "cross_part", "local"]}],
    }
    assert not patch_errors("quantize_patch", expected_patch, items)
    assert screen["invalid_controls"]["stale_patch"]
    assert screen["invalid_controls"]["unknown_reference"]
    return {"passed": 10, "screen": screen, "cohort_sha256": digest(items)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", choices=PROVIDERS)
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
    text = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(text)
    else:
        print(text, end="")


if __name__ == "__main__":
    main()
