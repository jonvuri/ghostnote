#!/usr/bin/env python3
"""Run the Phase 8c2 fresh targeted holdout."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import platform
import random
import sys
import time
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PACKAGE_ROOT))
import benchmark as base  # type: ignore  # noqa: E402
sys.path.pop(0)


SCHEMA = "ghostnote-compact-format-targeted-holdout-v2"
CORPUS_SCHEMA = "ghostnote-compact-format-holdout-corpus-v2"
RUN_ID = "phase8c2-targeted-holdout-r1"
INITIAL_ANALYSIS_SHA256 = "6befaa14cb3d5fd51223934557413fc711ad093ea33d37da01cdbb18ad483266"
SEED = 8217
ARMS = ("compact-bar-v1", "label-only-compact", "exact-json", "midi-like-native")
CANDIDATE = "label-only-compact"
EMPIRICAL_COST_BASIS = {
    "source": "Phase 8c2 initial run and symbolic-format v1 Gemini result",
    "method": "Use the larger recent observed mean call cost for each provider and add 25 percent.",
    "price_verification_date": "2026-09-27",
    "price_sources": base.PRICE_SOURCES,
    "mean_call_cost_usd": {
        "openai": 0.004619055555555556,
        "gemini": 0.002934876739562624,
        "claude": 0.01633838888888889,
    },
    "contingency": 0.25,
}


def finish_task(family: str, variant: int, body: dict[str, Any]) -> dict[str, Any]:
    value = {
        "schema": CORPUS_SCHEMA,
        "id": f"holdout-{family}-v{variant}",
        "cohort": "targeted-holdout-r1",
        "family": family,
        "variant": variant,
        "origin": "generated for Ghostnote under the repository MIT license",
        "license": "MIT",
        **body,
    }
    value["sha256"] = base.digest(value)
    return value


def progression_task(variant: int) -> dict[str, Any]:
    tonic = (3, 8, 0)[variant]
    chord_offsets = ((0, 4, 7), (9, 0, 4), (5, 9, 0), (2, 5, 9), (7, 11, 2, 5), (0, 4, 7))
    pitch_classes = [sorted((tonic + offset) % 12 for offset in chord) for chord in chord_offsets]
    contract = {
        "meter": "6/4",
        "chord_starts": ["0", "1", "2", "3", "4", "5"],
        "duration": "1",
        "pitch_classes": pitch_classes,
        "bass_pitch_classes": [tonic, (tonic + 9) % 12, (tonic + 5) % 12, (tonic + 2) % 12, (tonic + 7) % 12, tonic],
        "voice_ranges": {"bass": [36, 55], "tenor": [48, 67], "alto": [56, 75], "soprano": [64, 86]},
        "maximum_total_voice_leading": 60,
        "cadence_pitch_class": tonic,
    }
    return finish_task("generation-progression", variant, {"contract": contract})


def melody_task(variant: int) -> dict[str, Any]:
    tonic = (3, 8, 0)[variant]
    first_starts = ["0", "2/3", "4/3", "2", "8/3", "10/3"]
    starts = first_starts + [base.fraction_text(base.fraction(value) + 6) for value in first_starts]
    transposition = (4, -3, 5)[variant]
    seed = [63 + tonic + offset for offset in (0, 2, 5, 7, 4, 9)]
    pitches = seed + [pitch + transposition for pitch in seed]
    contract = {
        "meter": "6/4",
        "starts": starts,
        "durations": ["1/3", "2/3", "1/3", "2/3", "1/3", "2/3"] * 2,
        "range": [min(pitches) - 1, max(pitches) + 1],
        "allowed_pitch_classes": sorted({pitch % 12 for pitch in pitches}),
        "strong_beat_pitch_classes": sorted({pitches[index] % 12 for index, start in enumerate(starts) if base.fraction(start).denominator == 1}),
        "motif_transposition": transposition,
        "cadence_pitch_class": pitches[-1] % 12,
        "note_count": 12,
        "perfect_pitches": pitches,
    }
    return finish_task("generation-melody", variant, {"contract": contract})


def role_task(variant: int) -> dict[str, Any]:
    tonic = (3, 8, 0)[variant]
    chords = ((0, 4, 7), (9, 0, 4), (5, 9, 0), (2, 5, 9), (7, 11, 2), (0, 4, 7))
    contract = {
        "starts": ["6", "7", "8", "9", "10", "11"],
        "harmony_pitch_classes": [sorted((tonic + offset) % 12 for offset in chord) for chord in chords],
        "ranges": {"bass": [34, 55], "lead": [62, 84]},
        "cadence_pitch_class": tonic,
        "maximum_role_leap": 9,
        "duration": "1",
    }
    return finish_task("continuation-roles", variant, {"contract": contract})


def revoice_task(variant: int) -> dict[str, Any]:
    root = (46, 51, 54)[variant]
    notes = []
    for chord, start in enumerate(("0", "5/4", "5/2", "15/4")):
        for position, interval in enumerate((0, 3, 7, 11), start=1):
            notes.append(base.note(f"ho-rv{variant}-{chord + 1}-{position}", "keys", start, "5/4", root + chord * 2 + interval, 74 + position))
    source = {"source": base.sort_notes(notes), "operation": ("nearest", "drop-2", "first-inversion")[variant], "range": [39, 83]}
    return finish_task("transformation-revoice", variant, {"source": source})


def structure_source(variant: int) -> dict[str, Any]:
    root = 55 + variant * 3
    notes = []
    for index, start in enumerate(("0", "1/3", "1", "5/3", "7/3", "3", "11/3"), start=1):
        notes.append(base.note(f"ho-st{variant}-lead-{index}", "lead", start, "1/3", root + (index * 5) % 12, 80 + index))
    for index, start in enumerate(("0", "3", "13/3"), start=1):
        notes.append(base.note(f"ho-st{variant}-pad-{index}", "pad", start, "4/3", root - 12 + (index - 1) * 4, 70 + index))
    notes.extend((base.note(f"ho-st{variant}-bass-1", "bass", 0, 3, root - 24, 75), base.note(f"ho-st{variant}-bass-2", "bass", 3, "7/3", root - 19, 77)))
    return {"notes": base.sort_notes(notes), "tempo": 101 + variant, "meters": ["6/8", "7/8"], "harmonies": ["G-dorian", "C-mixolydian"]}


def motif_task(variant: int) -> dict[str, Any]:
    seed_pitches = [69, 64, 67, 62, 66]
    seed = [base.note(f"ho-mo{variant}-{index}", "lead", Fraction(index * 2, 3), "1/3", pitch + variant, 86) for index, pitch in enumerate(seed_pitches, start=1)]
    pitch_offset = 2 + variant
    expected_ids = [f"ho-mo-out-{index}" for index in range(1, 6)]
    expected = [base.note(expected_ids[index - 1], "lead", base.fraction(value["start"]) + 7, value["duration"], value["pitch"] + pitch_offset, value["velocity"]) for index, value in enumerate(seed, start=1)]
    source = {"source": base.sort_notes(seed), "operation": "sequence-transpose", "start_offset": "7", "pitch_offset": pitch_offset, "expected_ids": expected_ids, "expected": base.sort_notes(expected)}
    return finish_task(base.SENTINEL_FAMILY, variant, {"source": source, "expected": source["expected"]})


def local_task(variant: int) -> dict[str, Any]:
    source = structure_source(variant)
    source["sha256"] = base.digest(source)
    target = source["notes"][6]
    change = {"operation": "set", "note_id": target["id"], "field": "pitch", "value": target["pitch"] - 3}
    expected = deepcopy(source["notes"])
    for value in expected:
        if value["id"] == target["id"]:
            value["pitch"] = change["value"]
    return finish_task("transformation-local", variant, {"source": {"source": source, "change": change, "expected": base.sort_notes(expected)}, "expected": base.sort_notes(expected)})


def rhythm_task(variant: int) -> dict[str, Any]:
    source = [base.note(f"ho-ry{variant}-{index}", "perc", Fraction(index * 2, 5), "1/5", 50 + index % 5, 78 + index) for index in range(10)]
    expected = deepcopy(source)
    offset = Fraction(1, 10)
    for index, value in enumerate(expected):
        if index % 2:
            value["start"] = base.fraction_text(base.fraction(value["start"]) + offset)
    value = {"source": base.sort_notes(source), "operation": "late-offbeats", "odd_offset": base.fraction_text(offset), "expected": base.sort_notes(expected)}
    return finish_task("transformation-rhythm", variant, {"source": value, "expected": value["expected"]})


def make_corpus() -> dict[str, Any]:
    fixtures = {
        "generation-progression": [progression_task(index) for index in range(3)],
        "generation-melody": [melody_task(index) for index in range(3)],
        "continuation-roles": [role_task(index) for index in range(3)],
        "transformation-revoice": [revoice_task(index) for index in range(3)],
        base.SENTINEL_FAMILY: [motif_task(0)],
        "comprehension-structure": [finish_task("comprehension-structure", 0, {"source": structure_source(0), "expected": structure_source(0)["notes"]})],
        "transformation-local": [local_task(0)],
        "transformation-rhythm": [rhythm_task(0)],
    }
    value = {"schema": CORPUS_SCHEMA, "license": "MIT", "fixtures": fixtures}
    value["sha256"] = base.digest(value)
    return value


def task_instruction(value: dict[str, Any]) -> str:
    family = value["family"]
    if family == "generation-progression":
        return f"Realize the six-chord progression. Use bass, tenor, alto, and soprano once at each start. Satisfy this contract: {base.canonical(value['contract'])}"
    if family == "generation-melody":
        return f"Create one lead melody. Satisfy every rhythm, range, pitch, motif, strong-beat, and cadence constraint: {base.canonical(value['contract'])}"
    if family == "continuation-roles":
        return f"Continue with exactly six bass notes and six lead notes. Satisfy this role and harmony contract: {base.canonical(value['contract'])}"
    if family == "transformation-revoice":
        source = value["source"]
        return f"Revoice each four-note chord with operation={source['operation']}. Keep each start, duration, chord pitch classes, and range {source['range']}."
    if family == base.SENTINEL_FAMILY:
        source = value["source"]
        return f"Return only five continuation notes. Use these IDs in order: {','.join(source['expected_ids'])}. Add {source['start_offset']} to each start and {source['pitch_offset']} to each pitch. Keep duration, voice, and velocity."
    if family == "comprehension-structure":
        return "Reconstruct every represented note. Keep exact onsets, durations, voices, polyphony, velocity, and identity when the arm represents it."
    if family == "transformation-local":
        return f"Apply only this local change. Preserve all unrelated represented notes: {base.canonical(value['source']['change'])}. Base SHA-256 is {value['source']['source']['sha256']}."
    if family == "transformation-rhythm":
        return f"Add {value['source']['odd_offset']} beat to each odd-indexed note start. Keep even starts, durations, pitches, voices, and velocities."
    raise ValueError(f"Unknown family: {family}")


def prompt_for(arm: str, value: dict[str, Any]) -> str:
    sections = [
        "Complete one deterministic symbolic-music task.",
        "Return one JSON object with exactly one string field named payload. Put the requested representation in that string. Do not add prose.",
        f"Representation arm: {arm}.",
        base.output_grammar(arm, value["family"]),
        "Follow this output example exactly, but use the task values:\n" + base.output_example(arm, value["family"]),
        task_instruction(value),
    ]
    source = base.represented_source(arm, value)
    if source is not None:
        sections.extend(("SOURCE", source, "END SOURCE"))
    return "\n\n".join(sections)


def jobs() -> list[dict[str, Any]]:
    corpus = make_corpus()
    result = []
    for arm in ARMS:
        for family in base.HARD_FAMILIES:
            for value in corpus["fixtures"][family]:
                result.append({"arm": arm, "family": family, "variant": value["variant"], "repeat": 0, "sentinel": False, "task": value})
        for family in base.GUARD_FAMILIES:
            value = corpus["fixtures"][family][0]
            result.append({"arm": arm, "family": family, "variant": 0, "repeat": 0, "sentinel": False, "task": value})
        value = corpus["fixtures"][base.SENTINEL_FAMILY][0]
        for repeat in range(3):
            result.append({"arm": arm, "family": base.SENTINEL_FAMILY, "variant": 0, "repeat": repeat, "sentinel": True, "task": value})
    return result


def protocol_manifest() -> dict[str, Any]:
    run_jobs = jobs()
    analysis_path = PACKAGE_ROOT / "runs" / "2026-09-27-analysis.json"
    analysis = json.loads(analysis_path.read_text())
    if analysis["sha256"] != INITIAL_ANALYSIS_SHA256 or analysis["selected_candidates"] != [CANDIDATE]:
        raise ValueError("Initial analysis does not select this holdout candidate")
    value = {
        "schema": SCHEMA,
        "run_id": RUN_ID,
        "kind": "fresh-targeted-holdout",
        "candidate": CANDIDATE,
        "controls": [arm for arm in ARMS if arm != CANDIDATE],
        "arms": list(ARMS),
        "hard_families": list(base.HARD_FAMILIES),
        "guard_families": list(base.GUARD_FAMILIES),
        "sentinel": {"family": base.SENTINEL_FAMILY, "same_prompt_repetitions_per_arm": 3, "new_note_ids": "explicit in the task contract"},
        "sample": {"hard_variants_per_family": 3, "guard_variants_per_family": 1, "calls_per_arm_provider": 18, "calls_per_provider": len(run_jobs), "total_provider_calls": len(run_jobs) * len(base.PROVIDERS)},
        "providers": list(base.PROVIDERS),
        "models": base.MODELS,
        "settings": {"openai": {"reasoning_effort": "low", "max_completion_tokens": 3000}, "gemini": {"thinking_level": "low", "max_output_tokens": 3000}, "claude": {"effort": "low", "max_tokens": 3000}, "temperature": "provider default"},
        "holdout_gate": base.DEVELOPMENT_GATE,
        "provider_rule": base.DEVELOPMENT_GATE["provider_rule"],
        "stopping_rule": "Run the fixed 72 calls per provider. Do not revise a candidate from this result.",
        "repair_policy": "No repair calls. Initial responses stay separate from any later repair cohort.",
        "freshness": "All holdout fixtures have distinct structures and hashes from the initial development and retained v1 fixtures.",
        "privacy": base.protocol_manifest()["privacy"],
        "initial_analysis_sha256": INITIAL_ANALYSIS_SHA256,
        "prompt_sha256": {f"{job['arm']}:{job['family']}:{job['variant']}:{job['repeat']}": base.sha256_text(prompt_for(job["arm"], job["task"])) for job in run_jobs},
        "package_file_sha256": {name: base.sha256_text((PACKAGE_ROOT / name).read_text()) for name in ("holdout.py", "HOLDOUT.md") if (PACKAGE_ROOT / name).exists()},
    }
    value["sha256"] = base.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    calls = protocol["sample"]["calls_per_provider"]
    estimates = {provider: {"calls": calls, "estimated_cost_usd": round(calls * EMPIRICAL_COST_BASIS["mean_call_cost_usd"][provider] * 1.25, 6)} for provider in base.PROVIDERS}
    value = {
        "schema": SCHEMA,
        "run_kind": "holdout-run-plan",
        "run_id": RUN_ID,
        "approval": {"status": "pending", "requirement": "Get separate explicit operator approval for this exact holdout before any provider call."},
        "scope": {"candidate": CANDIDATE, "controls": [arm for arm in ARMS if arm != CANDIDATE], "families": list(base.TASK_FAMILIES), "hard_variants": 3, "guard_variants": 1, "motif_repetitions": 3, "providers": list(base.PROVIDERS)},
        "expected_calls": {**{provider: calls for provider in base.PROVIDERS}, "total": calls * len(base.PROVIDERS)},
        "models": base.MODELS,
        "settings": protocol["settings"],
        "cost_estimate": {"providers": estimates, "total_usd": round(sum(row["estimated_cost_usd"] for row in estimates.values()), 6), "basis": EMPIRICAL_COST_BASIS},
        "protocol_sha256": protocol["sha256"],
    }
    value["sha256"] = base.digest(value)
    return value


def deterministic_screen() -> dict[str, Any]:
    corpus = make_corpus()
    perfect = []
    for arm in ARMS:
        for values in corpus["fixtures"].values():
            for value in values:
                scored = base.score_response(arm, value, base.perfect_payload(arm, value))
                perfect.append({"arm": arm, "task": value["id"], "pass": scored["musical_pass"]})
    initial = base.make_corpus()
    initial_hashes = {value["sha256"] for values in initial["fixtures"].values() for value in values}
    holdout_hashes = {value["sha256"] for values in corpus["fixtures"].values() for value in values}
    v1_hashes = {value["sha256"] for values in base.v1_corpus.make_corpus()["retained"].values() for value in values}
    result = {
        "schema": SCHEMA,
        "corpus": {"schema": CORPUS_SCHEMA, "sha256": corpus["sha256"], "fixture_count": sum(len(values) for values in corpus["fixtures"].values()), "initial_hash_overlap": len(initial_hashes & holdout_hashes), "retained_v1_hash_overlap": len(v1_hashes & holdout_hashes)},
        "perfect_response_checks": perfect,
        "call_count": len(jobs()),
        "all_checks_pass": all(row["pass"] for row in perfect) and not (initial_hashes & holdout_hashes) and not (v1_hashes & holdout_hashes) and len(jobs()) == 72,
    }
    result["sha256"] = base.digest(result)
    return result


def deterministic_package() -> dict[str, Any]:
    value = {"schema": SCHEMA, "run_kind": "deterministic", "screen": deterministic_screen(), "protocol": protocol_manifest(), "run_plan": run_plan()}
    value["sha256"] = base.digest(value)
    return value


def deterministic_manifest(value: dict[str, Any]) -> dict[str, Any]:
    return {"schema": value["schema"], "sha256": value["sha256"], "screen_sha256": value["screen"]["sha256"], "protocol_sha256": value["protocol"]["sha256"], "corpus_sha256": value["screen"]["corpus"]["sha256"], "run_plan_sha256": value["run_plan"]["sha256"]}


def self_test() -> dict[str, Any]:
    screen = deterministic_screen()
    assert screen["all_checks_pass"]
    assert len(jobs()) == 72
    assert all(sum(job["arm"] == arm for job in jobs()) == 18 for arm in ARMS)
    assert all(sum(job["sentinel"] and job["arm"] == arm for job in jobs()) == 3 for arm in ARMS)
    assert run_plan()["expected_calls"]["total"] == 216
    assert run_plan()["cost_estimate"]["total_usd"] == 2.150309
    return {"schema": SCHEMA, "pass": True, "checks": len(screen["perfect_response_checks"]) + 6, "corpus_sha256": screen["corpus"]["sha256"], "deterministic_sha256": deterministic_package()["sha256"]}


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    if value.get("run_id") != RUN_ID or value.get("protocol_sha256") != plan["protocol_sha256"] or value.get("run_plan_sha256") != plan["sha256"]:
        raise ValueError("Approval does not match the frozen holdout plan")
    if value.get("status") != "approved" or not value.get("operator_statement"):
        raise ValueError("Holdout approval must record an explicit operator statement")
    return value


def call_job(provider: str, key: str, job: dict[str, Any]) -> dict[str, Any]:
    prompt = prompt_for(job["arm"], job["task"])
    common = {"arm": job["arm"], "family": job["family"], "variant": job["variant"], "repeat": job["repeat"], "sentinel": job["sentinel"], "task_sha256": job["task"]["sha256"], "prompt_sha256": base.sha256_text(prompt), "prompt_bytes": len(prompt.encode())}
    try:
        outer, raw, latency_ms, retries = base.call_with_retry(provider, key, prompt)
        measured = base.usage(provider, raw)
        payload = outer["payload"]
        return {**common, "response_payload": payload, "response_payload_bytes": len(payload.encode()), "response_payload_sha256": base.sha256_text(payload), "outer_schema_valid": outer["outer_schema_valid"], "validation": base.score_response(job["arm"], job["task"], payload), "usage": measured, "cost_usd": base.cost_usd(provider, measured), "latency_ms": round(latency_ms, 3), "retries": retries, "returned_model": base.returned_model(provider, raw), "request_id": raw.get("id"), "stop_reason": base.stop_reason(provider, raw), "raw_response_sha256": base.digest(raw)}
    except Exception as error:
        return {**common, "transport_error": f"{type(error).__name__}: {error}", "validation": {"syntax_pass": False, "musical_pass": False, "checks": {}, "failure_class": None}, "usage": {"input_tokens": 0, "cached_input_tokens": 0, "output_tokens": 0, "thinking_tokens": 0}, "cost_usd": {"uncached_input": 0, "cached_input": 0, "output": 0, "total": 0}, "retries": 3}


def execute_jobs(provider: str, key: str, run_jobs: list[dict[str, Any]], workers: int) -> list[dict[str, Any]]:
    ordered = list(run_jobs)
    random.Random(SEED).shuffle(ordered)
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(call_job, provider, key, job) for job in ordered]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            results.append(future.result())
            if index % 18 == 0:
                print(f"{provider}: completed {index}/{len(futures)} holdout calls", file=sys.stderr, flush=True)
    return sorted(results, key=lambda value: (value["arm"], value["family"], value["variant"], value["repeat"]))


def run_provider(provider: str, env_file: Path, approval_file: Path, workers: int) -> dict[str, Any]:
    approval = validate_approval(approval_file)
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise ValueError("Holdout deterministic screen failed")
    environment = base.load_env(env_file)
    key = environment.get(base.KEYS[provider])
    if not key:
        raise ValueError(f"{base.KEYS[provider]} is missing")
    results = execute_jobs(provider, key, jobs(), workers)
    value = {
        "schema": SCHEMA,
        "run_kind": "targeted-holdout-provider",
        "run_id": RUN_ID,
        "provider": provider,
        "requested_model": base.MODELS[provider],
        "client": "Python urllib.request direct HTTPS",
        "settings": protocol_manifest()["settings"][provider],
        "approval": approval,
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "python": platform.python_version(),
        "privacy": protocol_manifest()["privacy"],
        "protocol_sha256": protocol_manifest()["sha256"],
        "screen_sha256": screen["sha256"],
        "results": results,
        "repairs": [],
        "actual_cost_usd": round(sum(row["cost_usd"]["total"] for row in results), 6),
        "complete": len(results) == 72 and all("transport_error" not in row for row in results),
    }
    value["raw_run_sha256"] = base.digest([row.get("raw_response_sha256") for row in results])
    value["manifest_sha256"] = base.digest(value)
    return value


def rate(rows: list[dict[str, Any]]) -> float:
    return sum(row["validation"]["musical_pass"] for row in rows) / len(rows) if rows else 0.0


def summarize(paths: list[Path]) -> dict[str, Any]:
    runs = [json.loads(path.read_text()) for path in paths]
    if {run["provider"] for run in runs} != set(base.PROVIDERS):
        raise ValueError("Holdout summary needs one run from each provider")
    protocol_sha = protocol_manifest()["sha256"]
    if any(run["protocol_sha256"] != protocol_sha for run in runs):
        raise ValueError("Holdout runs do not match this protocol")
    providers = []
    comparisons = []
    for run in runs:
        arm_rows = {}
        for arm in ARMS:
            rows = [row for row in run["results"] if row["arm"] == arm]
            hard_rates = [rate([row for row in rows if row["family"] == family]) for family in base.HARD_FAMILIES]
            guard_rates = [rate([row for row in rows if row["family"] == family]) for family in base.GUARD_FAMILIES]
            arm_rows[arm] = {"arm": arm, "hard_macro": round(sum(hard_rates) / len(hard_rates), 6), "guard_macro": round(sum(guard_rates) / len(guard_rates), 6), "syntax_passes": sum(row["validation"]["syntax_pass"] for row in rows), "trials": len(rows), "input_tokens": sum(row["usage"]["input_tokens"] for row in rows), "output_tokens": sum(row["usage"]["output_tokens"] for row in rows), "output_bytes": sum(row.get("response_payload_bytes", 0) for row in rows), "sentinel_outcomes": [row["validation"]["musical_pass"] for row in rows if row["sentinel"]]}
        candidate_map = {(row["family"], row["variant"], row["repeat"]): row for row in run["results"] if row["arm"] == CANDIDATE}
        baseline_map = {(row["family"], row["variant"], row["repeat"]): row for row in run["results"] if row["arm"] == "compact-bar-v1"}
        keys = sorted(candidate_map.keys() & baseline_map.keys())
        paired = [(candidate_map[key]["validation"]["musical_pass"], baseline_map[key]["validation"]["musical_pass"], key) for key in keys]
        losses = defaultdict(int)
        for candidate_pass, baseline_pass, key in paired:
            if baseline_pass and not candidate_pass:
                losses[key[0]] += 1
        candidate = arm_rows[CANDIDATE]
        baseline = arm_rows["compact-bar-v1"]
        exact = arm_rows["exact-json"]
        comparison = {"provider": run["provider"], "candidate": CANDIDATE, "paired_denominator": len(paired), "candidate_only_wins": sum(a and not b for a, b, _ in paired), "candidate_only_losses": sum(b and not a for a, b, _ in paired), "candidate_only_losses_by_family": dict(sorted(losses.items())), "both_pass": sum(a and b for a, b, _ in paired), "both_fail": sum(not a and not b for a, b, _ in paired), "hard_macro_delta": round(candidate["hard_macro"] - baseline["hard_macro"], 6), "guard_macro_delta": round(candidate["guard_macro"] - baseline["guard_macro"], 6), "input_token_ratio_to_exact": round(candidate["input_tokens"] / exact["input_tokens"], 6), "output_byte_ratio_to_exact": round(candidate["output_bytes"] / exact["output_bytes"], 6)}
        gate = base.DEVELOPMENT_GATE
        comparison["provider_gate"] = {"hard_improvement": comparison["hard_macro_delta"] >= gate["hard_family_macro_improvement"], "guard_regression": comparison["guard_macro_delta"] >= -gate["maximum_guard_macro_regression"], "candidate_only_losses": all(value <= gate["maximum_candidate_only_losses_per_provider_family"] for value in losses.values()), "input_size": comparison["input_token_ratio_to_exact"] <= gate["maximum_input_token_ratio_to_exact_json"], "output_size": comparison["output_byte_ratio_to_exact"] <= gate["maximum_output_byte_ratio_to_exact_json"]}
        comparison["provider_gate"]["pass"] = all(comparison["provider_gate"].values())
        comparisons.append(comparison)
        providers.append({"provider": run["provider"], "requested_model": run["requested_model"], "returned_models": sorted({row.get("returned_model") for row in run["results"] if row.get("returned_model")}), "actual_cost_usd": run["actual_cost_usd"], "arms": [arm_rows[arm] for arm in ARMS], "complete": run["complete"], "manifest_sha256": run["manifest_sha256"]})
    provider_passes = sum(row["provider_gate"]["pass"] for row in comparisons)
    selected = provider_passes >= 2 and all(row["hard_macro_delta"] >= -0.05 for row in comparisons) and all(run["complete"] for run in runs)
    value = {"schema": SCHEMA, "run_kind": "targeted-holdout-summary", "run_id": RUN_ID, "decision": "select-for-phase8c3" if selected else "do-not-select", "selected_candidates": [CANDIDATE] if selected else [], "holdout_gate": base.DEVELOPMENT_GATE, "provider_passes": provider_passes, "providers": providers, "candidate_comparisons": comparisons, "actual_cost_usd": {**{run["provider"]: run["actual_cost_usd"] for run in runs}, "total": round(sum(run["actual_cost_usd"] for run in runs), 6)}, "repairs": [], "protocol_sha256": protocol_sha}
    value["sha256"] = base.digest(value)
    return value


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
    actions.add_argument("--run-plan", action="store_true")
    actions.add_argument("--provider", choices=base.PROVIDERS)
    actions.add_argument("--summarize", nargs=3, type=Path)
    parser.add_argument("--env-file", type=Path, default=Path("../.env"))
    parser.add_argument("--approval-file", type=Path)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.self_test:
        value = self_test()
    elif args.deterministic:
        value = deterministic_package()
    elif args.check:
        expected = json.loads(args.check.read_text())
        actual = deterministic_package()
        if deterministic_manifest(actual) != expected:
            print(base.canonical({"expected_sha256": expected.get("sha256"), "actual_sha256": actual.get("sha256")}), file=sys.stderr)
            raise SystemExit(1)
        value = {"schema": SCHEMA, "check": "pass", "sha256": actual["sha256"]}
    elif args.run_plan:
        value = run_plan()
    elif args.provider:
        if not args.approval_file:
            parser.error("--provider requires --approval-file")
        value = run_provider(args.provider, args.env_file, args.approval_file, args.workers)
    else:
        value = summarize(args.summarize)
    write_result(value, args.output)


if __name__ == "__main__":
    main()
