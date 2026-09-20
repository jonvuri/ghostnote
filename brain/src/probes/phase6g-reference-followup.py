#!/usr/bin/env python3
"""Run the focused phase 6g operator follow-up."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import platform
import random
import time
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
from typing import Any


MAIN_PATH = Path(__file__).with_name("phase6g-reference-transfer.py")
MAIN_SPEC = importlib.util.spec_from_file_location("phase6g_main", MAIN_PATH)
if MAIN_SPEC is None or MAIN_SPEC.loader is None:
    raise RuntimeError(f"Cannot load {MAIN_PATH}")
main = importlib.util.module_from_spec(MAIN_SPEC)
MAIN_SPEC.loader.exec_module(main)

SCHEMA = "ghostnote-reference-followup-v0"
TASKS = ("motif_with_backing", "groove_into_chords", "voice_leading_over_chords")
ARMS = main.ARMS
PROVIDERS = main.PROVIDERS


def digest(value: Any) -> str:
    return hashlib.sha256(main.canonical(value).encode()).hexdigest()


def extend_clip(source: dict[str, Any], clip_id: str, repeats: int) -> dict[str, Any]:
    length = source["length_beats"]
    notes = []
    for repeat in range(repeats):
        for row in source["notes"]:
            copied = deepcopy(row)
            copied["id"] = f"x{repeat + 1}-{row['id']}"
            copied["start"] = main.ftext(main.frac(row["start"]) + repeat * length)
            notes.append(copied)
    harmony = [
        {**row, "start": main.ftext(main.frac(row["start"]) + repeat * length)}
        for repeat in range(repeats) for row in source["harmony"]
    ]
    return main.clip(clip_id, length * repeats, deepcopy(source["tracks"]), notes, harmony)


def make_cohort() -> dict[str, Any]:
    source = main.make_cohort()
    motif_seed = extend_clip(source["seeds"]["seed-motif-v0"], "follow-seed-motif-v0", 4)
    motif_reference = extend_clip(source["references"]["reference-motif-v0"], "follow-reference-motif-v0", 2)
    groove_seed = extend_clip(source["seeds"]["seed-groove-v0"], "follow-seed-groove-v0", 4)
    groove_seed["tracks"].extend((
        {"id": "groove-lead", "role": "lead", "voice": "monophonic"},
        {"id": "groove-drums", "role": "drums", "voice": "polyphonic"},
    ))
    for bar in range(8):
        beat = bar * 4
        groove_seed["notes"].extend((
            main.note(f"fg-l-{bar}-1", "groove-lead", beat, 1, 72 + bar % 3, 86, channel=3),
            main.note(f"fg-l-{bar}-2", "groove-lead", beat + 2, 1, 74 + bar % 3, 82, channel=3),
            main.note(f"fg-d-{bar}-1", "groove-drums", beat, "1/8", 36, 104, channel=9),
            main.note(f"fg-d-{bar}-2", "groove-drums", beat + 1, "1/8", 38, 98, channel=9),
            main.note(f"fg-d-{bar}-3", "groove-drums", beat + 2, "1/8", 36, 100, channel=9),
            main.note(f"fg-d-{bar}-4", "groove-drums", beat + 3, "1/8", 38, 96, channel=9),
        ))
    groove_seed["notes"] = sorted(groove_seed["notes"], key=lambda row: (main.frac(row["start"]), row["track"], row["pitch"], row["id"]))
    groove_seed["sha256"] = digest({key: value for key, value in groove_seed.items() if key != "sha256"})
    groove_reference = extend_clip(source["references"]["reference-groove-v0"], "follow-reference-groove-v0", 4)
    result = {
        "seeds": {motif_seed["id"]: motif_seed, groove_seed["id"]: groove_seed},
        "references": {motif_reference["id"]: motif_reference, groove_reference["id"]: groove_reference},
        "task_sources": {
            "motif_with_backing": {"seed": motif_seed["id"], "reference": motif_reference["id"]},
            "groove_into_chords": {"seed": groove_seed["id"], "reference": groove_reference["id"]},
            "voice_leading_over_chords": {"seed": groove_seed["id"], "reference": groove_reference["id"]},
        },
    }
    result["sha256"] = digest(result)
    return result


LIMITS = {
    "motif_with_backing": {"start": "32", "end": "48", "track": "motif-lead", "count": [12, 24], "pitch": [55, 84]},
    "groove_into_chords": {"start": "32", "end": "48", "track": "groove-keys", "count": [24, 48], "pitch": [48, 84]},
    "voice_leading_over_chords": {"start": "32", "end": "48", "track": "groove-lead", "count": [8, 16], "pitch": [60, 84]},
}


GUIDANCE = {
    "motif_with_backing": "Judge whether the lead remains recognizable but develops across four bars. The bass is fixed and equal in all candidates.",
    "groove_into_chords": "Judge timing and accents, not chord choice. Each candidate uses the same four target harmonies over the same fixed drums and bass.",
    "voice_leading_over_chords": "Judge melodic direction, connection between chords, and arrival points. The target chords, drums, and bass are fixed.",
}


TARGET_HARMONY = (
    (32, {2, 4, 5, 9, 0}),
    (36, {7, 9, 11, 2, 5}),
    (40, {0, 2, 4, 7, 11}),
    (44, {9, 1, 4, 7, 10}),
)


def backing(task: str) -> list[dict[str, Any]]:
    rows = []
    if task == "motif_with_backing":
        for index, beat in enumerate(range(32, 48, 2)):
            rows.append(main.note(f"fixed-mb-{index}", "motif-bass", beat, "3/2", (36, 41, 38, 43)[index % 4], 82, channel=1))
        return rows
    for bar, (beat, pitch_classes) in enumerate(TARGET_HARMONY):
        root = (38, 43, 36, 45)[bar]
        rows.extend((
            main.note(f"fixed-b-{bar}-1", "groove-bass", beat, "3/2", root, 86, channel=1),
            main.note(f"fixed-b-{bar}-2", "groove-bass", beat + 2, "3/2", root + 7, 80, channel=1),
        ))
        for step in range(8):
            rows.append(main.note(f"fixed-d-{bar}-{step}", "groove-drums", Fraction(beat) + Fraction(step, 2), "1/8", (36, 42, 38, 42)[step % 4], (108, 62, 98, 68)[step % 4], channel=9))
        if task == "voice_leading_over_chords":
            pitches = sorted(value for value in range(48, 73) if value % 12 in pitch_classes)[:4]
            rows.extend(main.note(f"fixed-c-{bar}-{index}", "groove-keys", beat, "7/2", pitch, 68 - index * 2, channel=0) for index, pitch in enumerate(pitches))
    return rows


def coverage(arm: str, cohort: dict[str, Any]) -> dict[str, Any]:
    result = {}
    for reference_id, item in cohort["references"].items():
        if arm == "seed-only":
            form, excerpt = "none", None
        elif arm == "raw-reference":
            form, excerpt = "raw compact bars", item["coverage"]
        elif arm == "extracted-structure":
            form, excerpt = "extracted structure", item["coverage"]
        else:
            form, excerpt = "extracted structure plus two-bar excerpt", {"structure": item["coverage"], "excerpt": {"start_beats": "0", "end_beats": "8"}}
        result[reference_id] = {"form": form, "coverage": excerpt, "sha256": item["sha256"], "permission": item["permission"]}
    return result


def context(arm: str, cohort: dict[str, Any]) -> str:
    blocks = ["EIGHT-BAR SEEDS"]
    blocks.extend(main.render_bar(item) for item in cohort["seeds"].values())
    blocks.append("EIGHT-BAR REFERENCES")
    if arm == "seed-only":
        blocks.append("No reference content is available.")
    elif arm == "raw-reference":
        blocks.extend(main.render_bar(item) for item in cohort["references"].values())
    elif arm == "extracted-structure":
        blocks.extend(main.canonical(main.structure(item)) for item in cohort["references"].values())
    else:
        for item in cohort["references"].values():
            blocks.append(main.canonical(main.structure(item)))
            blocks.append(main.render_bar(item, Fraction(8)))
    return "\n\n".join(blocks)


def prompt(arm: str, cohort: dict[str, Any]) -> str:
    bases = {task: cohort["seeds"][source["seed"]]["sha256"] for task, source in cohort["task_sources"].items()}
    return f"""Return one JSON object only for a controlled symbolic music follow-up.
All notes are generated MIT project fixtures. One beat is one quarter note. All starts are absolute.
Return schema={SCHEMA}, arm={arm}, reference_coverage copied exactly, and results with exactly {','.join(TASKS)}.
Each result has patch and explanation. Each patch uses schema={main.PATCH_SCHEMA}, its exact base_sha256, and one operation with op=insert, default_policy=track-neutral-v0, and notes. Each note has id, track, start, duration, pitch, and velocity only.

BASE HASHES
{main.canonical(bases)}

LIMITS
{main.canonical(LIMITS)}

TASKS
- motif_with_backing: Write only the lead. Keep the seed interval identity +2,+3,-2, then develop it across four bars. A bass continuation is fixed outside your patch.
- groove_into_chords: Write polyphonic chord hits only. Use Dm9, G13, Cmaj9, and A7alt in consecutive four-beat bars. Make the transferred swing, displacement, and accent hierarchy audible. Fixed drums and bass play under every result.
- voice_leading_over_chords: Write only a new lead over Dm9, G13, Cmaj9, and A7alt. Prefer stepwise connections, clear contour, and chord-tone arrivals on beats 32,36,40,44. Fixed chords, drums, and bass play under every result.

REFERENCE COVERAGE
{main.canonical(coverage(arm, cohort))}

{context(arm, cohort)}
"""


def compile_patch(task: str, patch: Any, cohort: dict[str, Any]) -> tuple[list[dict[str, Any]] | None, list[str]]:
    limits = LIMITS[task]
    seed_id = cohort["task_sources"][task]["seed"]
    seed = cohort["seeds"][seed_id]
    errors = main.base.patch_errors(patch, seed)
    if errors:
        return None, errors
    ops = patch.get("ops", [])
    if len(ops) != 1 or ops[0].get("op") != "insert":
        return None, ["one insert operation is required"]
    notes = ops[0].get("notes", [])
    if not limits["count"][0] <= len(notes) <= limits["count"][1]:
        errors.append(f"note count must be {limits['count'][0]} through {limits['count'][1]}")
    for row in notes:
        if row.get("track") != limits["track"]:
            errors.append(f"note {row.get('id')} has the wrong track")
        if not isinstance(row.get("pitch"), int) or not limits["pitch"][0] <= row["pitch"] <= limits["pitch"][1]:
            errors.append(f"note {row.get('id')} has a pitch outside the task range")
        if not main.supported_time(row.get("start")) or not main.supported_time(row.get("duration")):
            errors.append(f"note {row.get('id')} uses unsupported timing")
            continue
        start, end = main.frac(row["start"]), main.frac(row["start"]) + main.frac(row["duration"])
        if start < main.frac(limits["start"]) or start >= main.frac(limits["end"]) or end > main.frac(limits["end"]):
            errors.append(f"note {row.get('id')} is outside the target window")
    if errors:
        return None, errors
    try:
        candidate = main.base.compile_patch(patch, seed)
    except ValueError as error:
        return None, [str(error)]
    ids = {row["id"] for row in notes}
    output = [row for row in candidate if row["id"] in ids]
    if task != "groove_into_chords":
        ordered = sorted(output, key=lambda row: main.frac(row["start"]))
        for first, second in zip(ordered, ordered[1:]):
            if main.frac(first["start"]) + main.frac(first["duration"]) > main.frac(second["start"]):
                errors.append(f"monophonic notes {first['id']} and {second['id']} overlap")
    return (None, errors) if errors else (output, [])


def trait(task: str, notes: list[dict[str, Any]]) -> dict[str, Any]:
    ordered = sorted(notes, key=lambda row: (main.frac(row["start"]), row["pitch"]))
    if task == "motif_with_backing":
        pitches = [row["pitch"] for row in ordered]
        identity = main.longest_common(main.signs(pitches), [1, 1, -1]) >= 3
        four_bars = {int((main.frac(row["start"]) - 32) // 4) for row in notes} == {0, 1, 2, 3}
        return {"passed": int(identity) + int(four_bars), "total": 2, "motif_identity": identity, "four_bars": four_bars}
    if task == "groove_into_chords":
        onsets = sorted({main.frac(row["start"]) for row in notes})
        swung = any((onset % 1) not in {Fraction(0), Fraction(1, 2)} for onset in onsets)
        polyphonic = sum(len(rows) >= 3 for rows in main._group(notes, lambda row: row["start"]).values()) >= 6
        accents = len({row["velocity"] for row in notes}) >= 3
        return {"passed": sum((swung, polyphonic, accents)), "total": 3, "audible_nonstraight_timing": swung, "polyphonic_hits": polyphonic, "accent_levels": accents}
    arrival_beats = (32, 36, 40, 44)
    arrival_pitches = []
    for beat in arrival_beats:
        pitches = [row["pitch"] for row in notes if main.frac(row["start"]) == beat]
        if pitches:
            arrival_pitches.append(max(pitches))
    arrivals = len(arrival_pitches) == 4 and all(pitch % 12 in TARGET_HARMONY[index][1] for index, pitch in enumerate(arrival_pitches))
    melodic = [row["pitch"] for row in ordered]
    stepwise = bool(melodic) and sum(abs(second - first) <= 5 for first, second in zip(melodic, melodic[1:])) / max(1, len(melodic) - 1) >= 0.75
    contour = len(set(main.signs(melodic))) >= 2
    return {"passed": sum((arrivals, stepwise, contour)), "total": 3, "chord_tone_arrivals": arrivals, "stepwise": stepwise, "contour": contour}


def validate(value: dict[str, Any], arm: str, cohort: dict[str, Any]) -> dict[str, Any]:
    results = value.get("results") if isinstance(value.get("results"), dict) else {}
    rows = {}
    for task in TASKS:
        task_value = results.get(task) if isinstance(results.get(task), dict) else {}
        notes, errors = compile_patch(task, task_value.get("patch"), cohort)
        if notes is None:
            rows[task] = {"valid": False, "errors": errors, "trait": {"passed": 0, "total": {"motif_with_backing": 2, "groove_into_chords": 3, "voice_leading_over_chords": 3}[task]}}
            continue
        source = cohort["task_sources"][task]
        reference = cohort["references"][source["reference"]]
        seed = cohort["seeds"][source["seed"]]
        rows[task] = {
            "valid": True, "errors": [], "trait": trait(task, notes),
            "direct_copy": main.direct_copy(notes, reference, seed),
            "similarity": main.similarity(notes, reference, seed),
            "compiled_notes": notes, "compiled_sha256": digest(notes),
        }
    return {
        "schema_valid": value.get("schema") == SCHEMA and value.get("arm") == arm,
        "coverage_valid": value.get("reference_coverage") == coverage(arm, cohort),
        "valid_tasks": sum(row["valid"] for row in rows.values()),
        "trait_passed": sum(row["trait"]["passed"] for row in rows.values()),
        "trait_total": sum(row["trait"]["total"] for row in rows.values()),
        "tasks": rows,
    }


def deterministic(cohort: dict[str, Any]) -> dict[str, Any]:
    def patch(task: str, notes: list[dict[str, Any]]) -> dict[str, Any]:
        seed = cohort["seeds"][cohort["task_sources"][task]["seed"]]
        core = [{key: row[key] for key in main.base.INSERT_CORE_FIELDS} for row in notes]
        return {"schema": main.PATCH_SCHEMA, "base_sha256": seed["sha256"], "ops": [{"op": "insert", "default_policy": "track-neutral-v0", "notes": core}]}
    motif = []
    for bar, root in zip((32, 36, 40, 44), (65, 67, 64, 69)):
        motif.extend(main.note(f"follow-m-{bar}-{index}", "motif-lead", Fraction(bar) + offset, duration, root + pitch, velocity, channel=0) for index, (offset, duration, pitch, velocity) in enumerate(((0, "1/2", 0, 94), (Fraction(3, 4), "1/2", 2, 74), (Fraction(3, 2), "1/2", 5, 88), (3, 1, 3, 70))))
    groove = []
    chord_pitches = ((62, 65, 69), (55, 59, 65), (60, 64, 71), (57, 61, 67))
    for bar, (beat, unused_pcs) in enumerate(TARGET_HARMONY):
        for hit, offset in enumerate((Fraction(0), Fraction(2, 3), Fraction(2), Fraction(8, 3))):
            for pitch_index, pitch in enumerate(chord_pitches[bar]):
                groove.append(main.note(f"follow-g-{bar}-{hit}-{pitch_index}", "groove-keys", Fraction(beat) + offset, "1/3", pitch, (104, 70, 94, 66)[hit], channel=0))
    voice_pitches = (65, 67, 69, 71, 71, 72, 74, 72, 72, 69, 67, 64)
    voice = [main.note(f"follow-v-{index}", "groove-lead", 32 + Fraction(index * 4, 3), 1, pitch, 86 - index % 3 * 4, channel=3) for index, pitch in enumerate(voice_pitches)]
    results = {"motif_with_backing": patch("motif_with_backing", motif), "groove_into_chords": patch("groove_into_chords", groove), "voice_leading_over_chords": patch("voice_leading_over_chords", voice)}
    return {"schema": SCHEMA, "arm": "deterministic", "reference_coverage": coverage("extracted-structure", cohort), "results": {task: {"patch": value, "explanation": "A deterministic rule applies the requested structure."} for task, value in results.items()}}


def run_provider(provider: str, env_file: Path) -> dict[str, Any]:
    environment = main.base.load_env(env_file)
    key_name = "OPENAI_API_KEY" if provider == "openai" else "GEMINI_API_KEY"
    cohort = make_cohort()
    results = []
    for arm in ARMS:
        task_text = prompt(arm, cohort)
        started = time.perf_counter()
        value, raw = main.base.model_call(provider, environment[key_name], [{"role": "user", "content": task_text}], 14000)
        validation = validate(value, arm, cohort)
        results.append({
            "arm": arm, "prompt_sha256": hashlib.sha256(task_text.encode()).hexdigest(),
            "latency_ms": (time.perf_counter() - started) * 1000, "usage": main.base.usage(provider, raw),
            "returned_model": main.base.returned_model(provider, raw), "request_id": raw.get("id"),
            "result": value, "validation": validation,
        })
    return {
        "schema": SCHEMA, "provider": provider,
        "requested_model": main.base.OPENAI_MODEL if provider == "openai" else main.base.GEMINI_MODEL,
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "cohort_sha256": cohort["sha256"], "results": results,
    }


def repair_run(path: Path, env_file: Path) -> dict[str, Any]:
    run = json.loads(path.read_text())
    provider = run["provider"]
    environment = main.base.load_env(env_file)
    key_name = "OPENAI_API_KEY" if provider == "openai" else "GEMINI_API_KEY"
    cohort = make_cohort()
    results = []
    for item in run["results"]:
        arm = item["arm"]
        task_text = prompt(arm, cohort)
        initial_value = item["result"]
        initial_validation = item["validation"]
        errors = {task: row["errors"] for task, row in initial_validation["tasks"].items() if not row["valid"]}
        if not errors:
            results.append(item)
            continue
        bases = {task: cohort["seeds"][source["seed"]]["sha256"] for task, source in cohort["task_sources"].items()}
        repair_text = f"""Repair the schema errors and return the complete result object again.
Every patch must copy this exact outer shape. Replace BASE with the task base hash and fill notes. Do not rename ops or op:
{{"schema":"{main.PATCH_SCHEMA}","base_sha256":"BASE","ops":[{{"op":"insert","default_policy":"track-neutral-v0","notes":[]}}]}}
Base hashes: {main.canonical(bases)}
Validator errors: {main.canonical(errors)}
All note starts and durations must be one integer string such as "32" or one reduced fraction string such as "65/2". Expressions and mixed numbers are invalid. For example, convert "32+1/2" to "65/2", "33 1/2" to "67/2", and "33+17/32" to "1073/32".
"""
        started = time.perf_counter()
        value, raw = main.base.model_call(provider, environment[key_name], [
            {"role": "user", "content": task_text},
            {"role": "assistant", "content": main.canonical(initial_value)},
            {"role": "user", "content": repair_text},
        ], 14000)
        previous_correction = item.get("correction")
        previous_turns = previous_correction.get("turns", 0) if isinstance(previous_correction, dict) else 0
        results.append({
            **item,
            "initial": item.get("initial", {"result": initial_value, "validation": initial_validation, "usage": item["usage"], "latency_ms": item["latency_ms"], "request_id": item["request_id"]}),
            "correction": {
                "turns": previous_turns + 1,
                "previous": previous_correction,
                "latency_ms": (time.perf_counter() - started) * 1000,
                "usage": main.base.usage(provider, raw), "request_id": raw.get("id"),
            },
            "result": value,
            "validation": validate(value, arm, cohort),
        })
    return {**run, "results": results}


def make_ballot(path: Path, output: Path, key_output: Path, seed: str) -> dict[str, Any]:
    run = json.loads(path.read_text())
    cohort = make_cohort()
    candidates = {task: [] for task in TASKS}
    for item in run["results"]:
        for task, row in item["validation"]["tasks"].items():
            if row["valid"]:
                candidates[task].append({"source": f"{run['provider']}:{item['arm']}", "notes": row["compiled_notes"]})
    control = deterministic(cohort)
    control_validation = validate({**control, "arm": "extracted-structure"}, "extracted-structure", cohort)
    for task, row in control_validation["tasks"].items():
        if row["valid"]:
            candidates[task].append({"source": "deterministic", "notes": row["compiled_notes"]})
    audio_dir = output.parent / f"{output.stem}-audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    key = {"schema": "ghostnote-reference-followup-key-v0", "seed": seed, "tasks": {}}
    rng = random.Random(seed)
    lines = ["# Phase 6g focused blind follow-up", "", "Listen for the task-specific property. All candidates use the same seed and fixed backing. Choose a best candidate, or use `cannot-decide`.", ""]
    for task in TASKS:
        source = cohort["task_sources"][task]
        seed_clip = cohort["seeds"][source["seed"]]
        reference = cohort["references"][source["reference"]]
        seed_path = audio_dir / f"{task}-seed.wav"
        reference_path = audio_dir / f"{task}-reference.wav"
        main.render_audio(seed_clip["notes"], Fraction(), seed_path)
        main.render_audio(reference["notes"], Fraction(), reference_path)
        lines.extend((f"## {task}", "", GUIDANCE[task], "", f"Seed: [{seed_path.name}](<{seed_path}>)", "", f"Reference: [{reference_path.name}](<{reference_path}>)", ""))
        rng.shuffle(candidates[task])
        key["tasks"][task] = {}
        for index, candidate in enumerate(candidates[task]):
            alias = chr(ord("A") + index)
            key["tasks"][task][alias] = candidate["source"]
            audio_path = audio_dir / f"{task}-{alias}.wav"
            rendered = seed_clip["notes"] + backing(task) + candidate["notes"]
            main.render_audio(rendered, Fraction(), audio_path)
            lines.extend((f"### Candidate {alias}", "", f"Audio: [{audio_path.name}](<{audio_path}>)", ""))
        lines.extend(("Best candidate:", "", "Reason or cannot-decide note:", ""))
    output.write_text("\n".join(lines))
    key_output.write_text(json.dumps(key, indent=2, sort_keys=True) + "\n")
    return {"ballot": str(output), "key": str(key_output), "audio_dir": str(audio_dir), "candidates": {task: len(rows) for task, rows in candidates.items()}}


def self_test() -> dict[str, Any]:
    cohort = make_cohort()
    assert cohort["sha256"] == make_cohort()["sha256"]
    assert all(item["length_beats"] == 32 for item in cohort["seeds"].values())
    assert all(item["length_beats"] == 32 for item in cohort["references"].values())
    assert len(backing("motif_with_backing")) == 8
    assert len(backing("groove_into_chords")) == 40
    assert len(backing("voice_leading_over_chords")) == 56
    control = deterministic(cohort)
    validation = validate({**control, "arm": "extracted-structure"}, "extracted-structure", cohort)
    assert validation["valid_tasks"] == 3
    assert validation["trait_passed"] == validation["trait_total"]
    assert "eight-bar" not in prompt("seed-only", cohort).lower() or "EIGHT-BAR SEEDS" in prompt("seed-only", cohort)
    return {"passed": 8, "cohort_sha256": cohort["sha256"], "control": validation}


def main_entry() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--provider", choices=PROVIDERS)
    parser.add_argument("--repair-run", type=Path)
    parser.add_argument("--env-file", type=Path, default=Path(".env"))
    parser.add_argument("--ballot", type=Path)
    parser.add_argument("--ballot-key", type=Path)
    parser.add_argument("--ballot-seed", default="phase6g-followup-blind-v0")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.self_test:
        result = self_test()
    elif args.repair_run:
        result = repair_run(args.repair_run, args.env_file)
    elif args.provider:
        result = run_provider(args.provider, args.env_file)
    elif args.ballot:
        if args.output is None or args.ballot_key is None:
            parser.error("--ballot needs --output and --ballot-key")
        result = make_ballot(args.ballot, args.output, args.ballot_key, args.ballot_seed)
        print(json.dumps(result, indent=2, sort_keys=True))
        return
    else:
        parser.error("select --self-test, --provider, or --ballot")
    text = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(text)
    else:
        print(text, end="")


if __name__ == "__main__":
    main_entry()
