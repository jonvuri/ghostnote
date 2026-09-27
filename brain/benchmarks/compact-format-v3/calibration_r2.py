#!/usr/bin/env python3
"""Run the Phase 8c2.2 progression-repair calibration."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import platform
import random
import sys
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PACKAGE_ROOT))
import benchmark as r1  # type: ignore  # noqa: E402
import core  # type: ignore  # noqa: E402
sys.path.pop(0)


SCHEMA = "ghostnote-compact-format-progression-repair-calibration-v3"
CORPUS_SCHEMA = "ghostnote-compact-format-progression-repair-corpus-v3"
RUN_ID = "phase8c2-2-progression-repair-calibration-r2"
SEED = 8251
FIXTURE_COUNT = 4
PROVIDERS = r1.PROVIDERS
MODELS = r1.MODELS
SETTINGS = r1.SETTINGS
ELIGIBILITY_BAND = r1.ELIGIBILITY_BAND
EMPIRICAL_COST_BASIS = r1.EMPIRICAL_COST_BASIS


def progression_task(variant: int) -> dict[str, Any]:
    tonic = (SEED + variant * 5) % 12
    offsets = ((0, 4, 7), (5, 9, 0), (7, 11, 2), (0, 4, 7))
    contract = {
        "meter": "5/4",
        "chord_starts": ["0", "5/4", "5/2", "15/4"],
        "duration": "5/4",
        "pitch_classes": [sorted((tonic + value) % 12 for value in chord) for chord in offsets],
        "bass_pitch_classes": [tonic, (tonic + 5) % 12, (tonic + 7) % 12, tonic],
        "voice_ranges": {
            "bass": [36, 55],
            "tenor": [48, 67],
            "alto": [55, 74],
            "soprano": [62, 84],
        },
        "maximum_total_voice_leading": 54,
        "cadence_pitch_class": tonic,
    }
    body = {"contract": contract}
    value = {
        "schema": CORPUS_SCHEMA,
        "id": f"calibration-r2-generation-progression-v{variant}",
        "cohort": "calibration-r2",
        "family": "generation-progression",
        "variant": variant,
        "origin": "generated for Ghostnote under the repository MIT license",
        "license": "MIT",
        **body,
        "semantic_sha256": core.digest({"family": "generation-progression", **body}),
    }
    value["sha256"] = core.digest(value)
    return value


def make_corpus() -> dict[str, Any]:
    fixtures = [progression_task(index) for index in range(FIXTURE_COUNT)]
    value = {"schema": CORPUS_SCHEMA, "cohort": "calibration-r2", "license": "MIT", "fixtures": fixtures}
    value["sha256"] = core.digest(value)
    return value


def task_instruction(value: dict[str, Any]) -> str:
    return (
        "Realize the four-chord progression. At each start, use exactly four notes: "
        "one bass, one tenor, one alto, and one soprano. Use only the listed pitch "
        "classes. Use every listed pitch class at least once in each chord. After full "
        "coverage, double any listed pitch class. The bass must use the listed bass "
        f"pitch class. Satisfy every range, order, movement, duration, and cadence limit: {core.canonical(value['contract'])}"
    )


def prompt_for(arm: str, value: dict[str, Any]) -> str:
    return "\n\n".join(
        (
            "Complete one deterministic symbolic-music task.",
            "Return one JSON object with exactly one string field named payload. Put the requested representation in that string. Do not add prose.",
            f"Representation arm: {arm}.",
            core.output_grammar(arm, value["family"]),
            "Follow this output example, but use the task values:\n" + core.output_example(arm, value["family"]),
            task_instruction(value),
        )
    )


def jobs() -> list[dict[str, Any]]:
    return [
        {"arm": arm, "family": "generation-progression", "variant": task["variant"], "repeat": 0, "task": task}
        for arm in core.ARMS
        for task in make_corpus()["fixtures"]
    ]


def historical_semantics() -> set[str]:
    old = r1.all_historical_semantics()
    for cohort in core.COHORT_SPECS:
        old.update(value["semantic_sha256"] for values in core.make_corpus(cohort)["fixtures"].values() for value in values)
    return old


def synthetic_results(pattern: list[bool]) -> list[dict[str, Any]]:
    counters = {"exact-json": 0, "midi-like-native": 0}
    results = []
    for job in jobs():
        validation = core.score_response(job["arm"], job["task"], core.perfect_payload(job["arm"], job["task"]))
        if job["arm"] in counters:
            validation["primary_pass"] = pattern[counters[job["arm"]] % len(pattern)]
            counters[job["arm"]] += 1
        results.append({"arm": job["arm"], "family": job["family"], "variant": job["variant"], "repeat": 0, "validation": validation})
    return results


def summarize_runs(runs: list[dict[str, Any]], protocol_sha256: str | None = None) -> dict[str, Any]:
    if {run["provider"] for run in runs} != set(PROVIDERS):
        raise ValueError("The summary needs one run from each provider")
    expected_protocol = protocol_sha256 or protocol_manifest()["sha256"]
    if any(run["protocol_sha256"] != expected_protocol for run in runs):
        raise ValueError("The provider runs do not use the same protocol")
    providers = []
    eligible_providers = 0
    for run in runs:
        arms = []
        for arm in core.ARMS:
            rows = [row for row in run["results"] if row["arm"] == arm]
            successes = sum(row["validation"]["primary_pass"] for row in rows)
            arms.append({"arm": arm, "successes": successes, "trials": len(rows), "rate": round(successes / len(rows), 6)})
        control_rows = [row for row in run["results"] if row["arm"] in {"exact-json", "midi-like-native"}]
        successes = sum(row["validation"]["primary_pass"] for row in control_rows)
        rate = successes / len(control_rows)
        eligible = ELIGIBILITY_BAND["minimum"] <= rate <= ELIGIBILITY_BAND["maximum"]
        eligible_providers += eligible
        providers.append(
            {
                "provider": run["provider"],
                "arms": arms,
                "control_pool": {"successes": successes, "trials": len(control_rows), "rate": round(rate, 6), "eligible": eligible},
                "actual_cost_usd": run["actual_cost_usd"],
                "complete": run["complete"],
            }
        )
    complete = all(run["complete"] for run in runs)
    value = {
        "schema": SCHEMA,
        "run_kind": "progression-repair-calibration-summary",
        "run_id": RUN_ID,
        "decision": "proceed-development" if complete and eligible_providers >= ELIGIBILITY_BAND["minimum_providers"] else "repair-measurement",
        "eligibility_band": ELIGIBILITY_BAND,
        "eligible_providers": eligible_providers,
        "providers": providers,
        "actual_cost_usd": {
            **{run["provider"]: run["actual_cost_usd"] for run in runs},
            "total": round(sum(run["actual_cost_usd"] for run in runs), 6),
        },
        "protocol_sha256": expected_protocol,
    }
    value["sha256"] = core.digest(value)
    return value


def deterministic_screen() -> dict[str, Any]:
    corpus = make_corpus()
    fixtures = corpus["fixtures"]
    perfect = []
    for arm in core.ARMS:
        for task in fixtures:
            result = core.score_response(arm, task, core.perfect_payload(arm, task))
            perfect.append({"arm": arm, "task": task["id"], "pass": result["primary_pass"]})
    semantics = {value["semantic_sha256"] for value in fixtures}
    prompt_checks = [
        "Use every listed pitch class at least once" in prompt_for(arm, task)
        for arm in core.ARMS
        for task in fixtures
    ]
    protocol = "synthetic-protocol"
    informative_runs = [
        {"provider": provider, "protocol_sha256": protocol, "results": synthetic_results([True, False, True, False]), "actual_cost_usd": 0, "complete": True}
        for provider in PROVIDERS
    ]
    floor_runs = [
        {"provider": provider, "protocol_sha256": protocol, "results": synthetic_results([False]), "actual_cost_usd": 0, "complete": True}
        for provider in PROVIDERS
    ]
    informative = summarize_runs(informative_runs, protocol)
    floor = summarize_runs(floor_runs, protocol)
    value = {
        "schema": SCHEMA,
        "corpus": {
            "sha256": corpus["sha256"],
            "fixture_count": len(fixtures),
            "fixture_sha256": [value["sha256"] for value in fixtures],
            "semantic_sha256": sorted(semantics),
            "historical_semantic_overlap": len(semantics & historical_semantics()),
        },
        "perfect_response_checks": perfect,
        "explicit_coverage_prompt_checks": prompt_checks,
        "aggregation": {
            "informative_decision": informative["decision"],
            "floor_decision": floor["decision"],
            "pass": informative["decision"] == "proceed-development" and floor["decision"] == "repair-measurement",
        },
        "r1_protocol_sha256": r1.protocol_manifest()["sha256"],
        "all_checks_pass": all(row["pass"] for row in perfect)
        and all(prompt_checks)
        and not (semantics & historical_semantics())
        and informative["decision"] == "proceed-development"
        and floor["decision"] == "repair-measurement",
    }
    value["sha256"] = core.digest(value)
    return value


def protocol_manifest() -> dict[str, Any]:
    run_jobs = jobs()
    value = {
        "schema": SCHEMA,
        "run_id": RUN_ID,
        "kind": "progression-measurement-repair-calibration",
        "selection_authority": "None. This repair calibration cannot select a format.",
        "repair": "Use triads only and state full pitch-class coverage explicitly.",
        "unchanged_candidate": "Use the exact grouped-label renderer and parser from calibration r1.",
        "arms": list(core.ARMS),
        "family": "generation-progression",
        "sample": {"unique_fixtures": FIXTURE_COUNT, "calls_per_arm_provider": FIXTURE_COUNT, "calls_per_provider": len(run_jobs), "total_provider_calls": len(run_jobs) * len(PROVIDERS), "repeated_prompts": 0},
        "providers": list(PROVIDERS),
        "models": MODELS,
        "settings": SETTINGS,
        "eligibility_band": ELIGIBILITY_BAND,
        "stopping_rule": "Pool exact JSON and native MIDI-Like per provider. Proceed only when progression is from 0.20 through 0.90 on at least two providers. Otherwise return repair-measurement.",
        "allowed_follow_up": "Summarize this fixed repair calibration. Do not start development without a new frozen plan and explicit approval.",
        "privacy": r1.protocol_manifest()["privacy"],
        "corpus_sha256": make_corpus()["sha256"],
        "prompt_sha256": {f"{job['arm']}:generation-progression:{job['variant']}:0": core.sha256_text(prompt_for(job["arm"], job["task"])) for job in run_jobs},
        "dependency_file_sha256": {
            name: hashlib.sha256((PACKAGE_ROOT / name).read_bytes()).hexdigest()
            for name in ("calibration_r2.py", "core.py")
        },
        "source_calibration": {
            "run_id": r1.RUN_ID,
            "protocol_sha256": r1.protocol_manifest()["sha256"],
            "summary_sha256": "739b1a4fb2de14eb2e0272cd97f81e2d586c44c89fe0438a6fa104d80b5854c4",
            "decision": "repair-measurement",
        },
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    calls = protocol["sample"]["calls_per_provider"]
    estimates = {
        provider: {"calls": calls, "estimated_cost_usd": round(calls * EMPIRICAL_COST_BASIS["mean_call_cost_usd"][provider] * 1.25, 6)}
        for provider in PROVIDERS
    }
    value = {
        "schema": SCHEMA,
        "run_kind": "progression-repair-calibration-run-plan",
        "run_id": RUN_ID,
        "approval": {"status": "pending", "requirement": "Get explicit operator approval for this exact repair calibration before any provider call."},
        "scope": {"arms": list(core.ARMS), "family": "generation-progression", "unique_fixtures": FIXTURE_COUNT, "repeats": 1, "providers": list(PROVIDERS)},
        "expected_calls": {**{provider: calls for provider in PROVIDERS}, "total": calls * len(PROVIDERS)},
        "models": MODELS,
        "settings": SETTINGS,
        "cost_estimate": {"providers": estimates, "total_usd": round(sum(row["estimated_cost_usd"] for row in estimates.values()), 6), "basis": EMPIRICAL_COST_BASIS},
        "corpus_sha256": make_corpus()["sha256"],
        "protocol_sha256": protocol["sha256"],
        "stopping_rule": protocol["stopping_rule"],
        "allowed_follow_up": protocol["allowed_follow_up"],
    }
    value["sha256"] = core.digest(value)
    return value


def deterministic_package() -> dict[str, Any]:
    value = {"schema": SCHEMA, "run_kind": "deterministic", "screen": deterministic_screen(), "protocol": protocol_manifest(), "run_plan": run_plan()}
    value["sha256"] = core.digest(value)
    return value


def deterministic_manifest(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": value["schema"],
        "sha256": value["sha256"],
        "screen_sha256": value["screen"]["sha256"],
        "protocol_sha256": value["protocol"]["sha256"],
        "corpus_sha256": value["protocol"]["corpus_sha256"],
        "run_plan_sha256": value["run_plan"]["sha256"],
    }


def self_test() -> dict[str, Any]:
    screen = deterministic_screen()
    assert screen["all_checks_pass"]
    assert len(jobs()) == 20
    assert all(sum(job["arm"] == arm for job in jobs()) == 4 for arm in core.ARMS)
    assert run_plan()["expected_calls"]["total"] == 60
    return {"schema": SCHEMA, "pass": True, "checks": len(screen["perfect_response_checks"]) + len(screen["explicit_coverage_prompt_checks"]) + 8, "corpus_sha256": make_corpus()["sha256"], "deterministic_sha256": deterministic_package()["sha256"]}


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    if value.get("run_id") != RUN_ID or value.get("protocol_sha256") != plan["protocol_sha256"] or value.get("run_plan_sha256") != plan["sha256"]:
        raise ValueError("The approval does not match the frozen repair calibration plan")
    if value.get("status") != "approved" or not value.get("operator_statement"):
        raise ValueError("The approval must include an explicit operator statement")
    return value


def call_job(provider: str, key: str, job: dict[str, Any]) -> dict[str, Any]:
    prompt = prompt_for(job["arm"], job["task"])
    common = {"arm": job["arm"], "family": job["family"], "variant": job["variant"], "repeat": 0, "task_sha256": job["task"]["sha256"], "semantic_sha256": job["task"]["semantic_sha256"], "prompt_sha256": core.sha256_text(prompt), "prompt_bytes": len(prompt.encode())}
    try:
        outer, raw, latency_ms, retries = core.v2.call_with_retry(provider, key, prompt)
        measured = core.v2.usage(provider, raw)
        payload = outer["payload"]
        return {**common, "response_payload": payload, "response_payload_bytes": len(payload.encode()), "response_payload_sha256": core.sha256_text(payload), "outer_schema_valid": outer["outer_schema_valid"], "validation": core.score_response(job["arm"], job["task"], payload), "usage": measured, "cost_usd": core.v2.cost_usd(provider, measured), "latency_ms": round(latency_ms, 3), "retries": retries, "returned_model": core.v2.returned_model(provider, raw), "request_id": raw.get("id"), "stop_reason": core.v2.stop_reason(provider, raw), "raw_response_sha256": core.digest(raw)}
    except Exception as error:
        return {**common, "transport_error": f"{type(error).__name__}: {error}", "validation": {"syntax_pass": False, "primary_pass": False, "checks": {}, "error": "transport"}, "usage": {"input_tokens": 0, "cached_input_tokens": 0, "output_tokens": 0, "thinking_tokens": 0}, "cost_usd": {"uncached_input": 0, "cached_input": 0, "output": 0, "total": 0}, "retries": 3}


def execute_jobs(provider: str, key: str, workers: int) -> list[dict[str, Any]]:
    ordered = jobs()
    random.Random(SEED).shuffle(ordered)
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(call_job, provider, key, job) for job in ordered]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            results.append(future.result())
            if index % 4 == 0:
                print(f"{provider}: completed {index}/{len(futures)} progression-repair calls", file=sys.stderr, flush=True)
    return sorted(results, key=lambda value: (value["arm"], value["variant"]))


def run_provider(provider: str, env_file: Path, approval_file: Path, workers: int) -> dict[str, Any]:
    approval = validate_approval(approval_file)
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise ValueError("The deterministic screen failed")
    environment = core.v2.load_env(env_file)
    key = environment.get(core.v2.KEYS[provider])
    if not key:
        raise ValueError(f"{core.v2.KEYS[provider]} is missing")
    results = execute_jobs(provider, key, workers)
    value = {
        "schema": SCHEMA,
        "run_kind": "progression-repair-calibration-provider",
        "run_id": RUN_ID,
        "provider": provider,
        "requested_model": MODELS[provider],
        "client": "Python urllib.request direct HTTPS",
        "settings": SETTINGS[provider],
        "approval": approval,
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "python": platform.python_version(),
        "privacy": protocol_manifest()["privacy"],
        "protocol_sha256": protocol_manifest()["sha256"],
        "screen_sha256": screen["sha256"],
        "results": results,
        "repairs": [],
        "actual_cost_usd": round(sum(row["cost_usd"]["total"] for row in results), 6),
        "complete": len(results) == 20 and all("transport_error" not in row for row in results),
    }
    value["raw_run_sha256"] = core.digest([row.get("raw_response_sha256") for row in results])
    value["manifest_sha256"] = core.digest(value)
    return value


def write_result(value: dict[str, Any], output: Path | None) -> None:
    rendered = json.dumps(value, indent=2, sort_keys=True) + "\n"
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
    actions.add_argument("--provider", choices=PROVIDERS)
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
            raise SystemExit(1)
        value = {"schema": SCHEMA, "check": "pass", "sha256": actual["sha256"]}
    elif args.run_plan:
        value = run_plan()
    elif args.provider:
        if not args.approval_file:
            parser.error("--provider requires --approval-file")
        value = run_provider(args.provider, args.env_file, args.approval_file, args.workers)
    else:
        value = summarize_runs([json.loads(path.read_text()) for path in args.summarize])
    write_result(value, args.output)


if __name__ == "__main__":
    main()
