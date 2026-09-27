#!/usr/bin/env python3
"""Define the repaired Phase 8c2.3 calibration."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import platform
import random
import sys
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PACKAGE_ROOT))
import benchmark as r1  # type: ignore  # noqa: E402
import core  # type: ignore  # noqa: E402
sys.path.pop(0)


SCHEMA = "ghostnote-compact-json-calibration-r2"
CORPUS_SCHEMA = "ghostnote-compact-json-calibration-r2-corpus"
RUN_ID = "phase8c2-3-json-grammar-repair-calibration-r2"
ARMS = core.ARMS
JSON_ARMS = core.JSON_ARMS
FAMILIES = ("generation-progression", "continuation-roles")
FIXTURES_PER_FAMILY = 3
PROVIDERS = r1.PROVIDERS
MODELS = r1.MODELS
CONTROL_ARMS = r1.CONTROL_ARMS
ELIGIBILITY_BAND = r1.ELIGIBILITY_BAND
SETTINGS = {
    "openai": {"reasoning_effort": "low", "max_completion_tokens": 4000},
    "gemini": {"thinking_level": "low", "max_output_tokens": 4000},
    "claude": {"effort": "low", "max_tokens": 4000},
    "temperature": "provider default",
}
R1_ACTUAL_COST_USD = {"openai": 0.416980, "gemini": 0.215447, "claude": 1.931190}
COST_BASIS = {
    "source": "Phase 8c2.3 calibration r1 manifests",
    "method": "Use the observed mean call cost and add 25 percent.",
    "price_verification_date": "2026-09-27",
    "price_sources": core.v3.v2.PRICE_SOURCES,
    "mean_call_cost_usd": {
        provider: cost / 70
        for provider, cost in R1_ACTUAL_COST_USD.items()
    },
    "contingency": 0.25,
}


def progression_task(variant: int) -> dict[str, Any]:
    tonic = (8353 + variant * 7) % 12
    offsets = ((0, 3, 7), (5, 8, 0), (2, 5, 9, 0), (0, 3, 7))
    contract = {
        "meter": "4/4",
        "chord_starts": ["1/5", "6/5", "11/5", "16/5"],
        "duration": "4/5",
        "pitch_classes": [sorted((tonic + item) % 12 for item in chord) for chord in offsets],
        "bass_pitch_classes": [tonic, (tonic + 5) % 12, (tonic + 2) % 12, tonic],
        "voice_ranges": {"bass": [35, 54], "tenor": [47, 66], "alto": [54, 73], "soprano": [61, 83]},
        "maximum_total_voice_leading": 52,
        "cadence_pitch_class": tonic,
    }
    return core.finish_task("calibration-r2", "generation-progression", variant, {"contract": contract})


def role_task(variant: int) -> dict[str, Any]:
    tonic = (8353 + variant * 7) % 12
    offsets = ((0, 3, 7), (5, 8, 0), (2, 5, 9), (7, 10, 2), (0, 3, 7))
    starts = [core.fraction_text(Fraction(35, 6) + index * Fraction(5, 6)) for index in range(5)]
    contract = {
        "starts": starts,
        "harmony_pitch_classes": [sorted((tonic + item) % 12 for item in chord) for chord in offsets],
        "ranges": {"bass": [35, 54], "lead": [59, 83]},
        "cadence_pitch_class": tonic,
        "maximum_role_leap": 9,
        "duration": "5/6",
    }
    return core.finish_task("calibration-r2", "continuation-roles", variant, {"contract": contract})


def make_corpus() -> dict[str, Any]:
    fixtures = {
        "generation-progression": [progression_task(index) for index in range(FIXTURES_PER_FAMILY)],
        "continuation-roles": [role_task(index) for index in range(FIXTURES_PER_FAMILY)],
    }
    value = {"schema": CORPUS_SCHEMA, "cohort": "calibration-r2", "license": "MIT", "fixtures": fixtures}
    value["sha256"] = core.digest(value)
    return value


def corpus_audit() -> dict[str, Any]:
    corpus = make_corpus()
    fixtures = [value for family in FAMILIES for value in corpus["fixtures"][family]]
    semantics = {value["semantic_sha256"] for value in fixtures}
    prior = r1.historical_semantics()
    for cohort in core.COHORT_SPECS:
        prior.update(
            value["semantic_sha256"]
            for values in core.make_corpus(cohort)["fixtures"].values()
            for value in values
        )
    for path in (
        PACKAGE_ROOT / "runs" / "2026-09-27-calibration-openai.json",
        PACKAGE_ROOT / "runs" / "2026-09-27-calibration-gemini.json",
        PACKAGE_ROOT / "runs" / "2026-09-27-calibration-claude.json",
    ):
        run = json.loads(path.read_text())
        prior.update(row["semantic_sha256"] for row in run["results"])
    value = {
        "corpus_sha256": corpus["sha256"],
        "fixture_sha256": sorted(item["sha256"] for item in fixtures),
        "semantic_sha256": sorted(semantics),
        "fixture_count": len(fixtures),
        "prior_semantic_overlap": len(semantics & prior),
        "internal_semantic_duplicates": len(fixtures) - len(semantics),
    }
    value["sha256"] = core.digest(value)
    return value


def perfect_notes(value: dict[str, Any]) -> list[dict[str, Any]]:
    if value["family"] == "generation-progression":
        return core.v3.perfect_progression(value["contract"])
    return core.v3.perfect_roles(value["contract"])


def required_document(value: dict[str, Any]) -> dict[str, Any]:
    return core.make_document(perfect_notes(value), value, value["id"])


def metadata_template(arm: str, value: dict[str, Any]) -> str:
    external = core.encode_document(arm, required_document(value))
    external["notes"] = []
    return core.canonical(external)


def multi_voice_example(arm: str) -> str:
    notes = [
        core.note("ex-bass", "bass", "0", "1", 48, 80),
        core.note("ex-lead", "lead", "0", "1", 67, 84),
    ]
    metadata = {"sha256": "example", "source": {"tempo": 120, "meters": ["4/4"], "harmonies": ["C"]}}
    return core.render_document(arm, notes, metadata, "example-score")


def order_rule() -> str:
    return (
        "Use canonical rational strings in lowest terms. Order bars by start then ID. "
        "Order tracks by ID. Order regions by track_id then ID. Order notes by start, "
        "then voice rank bass, tenor, alto, soprano, then other voice names, then pitch and ID."
    )


def progression_instruction(value: dict[str, Any]) -> str:
    return (
        "Realize the four-chord progression. At each start, use exactly four notes: "
        "one bass, one tenor, one alto, and one soprano. Use only the listed pitch "
        "classes. Use every listed pitch class at least once in each chord. After full "
        "coverage, double any listed pitch class. The bass must use the listed bass "
        "pitch class. Satisfy every range, order, movement, duration, and cadence limit: "
        + core.canonical(value["contract"])
    )


def role_instruction(value: dict[str, Any]) -> str:
    return (
        "At each listed start, return exactly one bass note and one lead note. Each note "
        "must use the stated duration. Each pitch must use one listed harmony pitch class "
        "and stay in its role range. Keep each same-role leap within the limit. Do not use "
        "the same pitch for both roles. End the lead on the cadence pitch class: "
        + core.canonical(value["contract"])
    )


def prompt_for(arm: str, value: dict[str, Any]) -> str:
    parts = [
        "Complete one deterministic symbolic-music task.",
        "Return one JSON object with exactly one string field named payload. Put the requested representation in that string. Do not add prose.",
        f"Representation arm: {arm}.",
        core.output_grammar(arm, value["family"]),
    ]
    if arm in JSON_ARMS:
        parts.extend(
            (
                order_rule(),
                "This complete multi-voice example shows every collection and its order:\n" + multi_voice_example(arm),
                "Copy schema, score, bars, tracks, and regions from this task template exactly. Replace the empty notes collection with the answer. Do not add, remove, or change metadata:\n"
                + metadata_template(arm, value),
            )
        )
    else:
        parts.append("Use this complete row example:\n" + core.output_example(arm, value["family"]))
    parts.append(progression_instruction(value) if value["family"] == "generation-progression" else role_instruction(value))
    return "\n\n".join(parts)


def score_response(arm: str, value: dict[str, Any], payload: str) -> dict[str, Any]:
    try:
        if arm in JSON_ARMS:
            document = core.parse_document(arm, payload)
            notes = core.document_notes(document)
            expected = required_document(value)
            metadata = all(document[name] == expected[name] for name in ("score", "bars", "tracks", "regions"))
        else:
            notes = core.parse_native(payload)
            metadata = True
        if value["family"] == "generation-progression":
            checks = core.v3.score_progression(notes, value["contract"])
        else:
            checks = core.v3.score_roles(notes, value["contract"])
        if arm in JSON_ARMS:
            checks = {"exact_metadata": metadata, **checks}
        return {"syntax_pass": True, "primary_pass": all(checks.values()), "checks": checks, "error": None}
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        return {"syntax_pass": False, "primary_pass": False, "checks": {}, "error": f"{type(error).__name__}: {error}"}


def perfect_payload(arm: str, value: dict[str, Any]) -> str:
    notes = perfect_notes(value)
    return core.render_events(arm, notes, value, value["id"])


def jobs() -> list[dict[str, Any]]:
    corpus = make_corpus()
    return [
        {"arm": arm, "family": family, "variant": task["variant"], "repeat": 0, "task": task}
        for arm in ARMS
        for family in FAMILIES
        for task in corpus["fixtures"][family]
    ]


def contract_screen() -> dict[str, Any]:
    positive = []
    negative = []
    grammar = []
    corpus = make_corpus()
    for arm in ARMS:
        for family in FAMILIES:
            for task in corpus["fixtures"][family]:
                positive.append({"arm": arm, "task": task["id"], "pass": score_response(arm, task, perfect_payload(arm, task))["primary_pass"]})
                negative.append({"arm": arm, "task": task["id"], "pass": not score_response(arm, task, "INVALID")["primary_pass"]})
            task = corpus["fixtures"][family][0]
            prompt = prompt_for(arm, task)
            grammar.append(
                {
                    "arm": arm,
                    "family": family,
                    "exact_order": arm not in JSON_ARMS or order_rule() in prompt,
                    "task_metadata": arm not in JSON_ARMS or metadata_template(arm, task) in prompt,
                    "multi_voice_example": arm not in JSON_ARMS or multi_voice_example(arm) in prompt,
                    "explicit_instruction": "Use every listed pitch class" in prompt if family == "generation-progression" else "exactly one bass note and one lead note" in prompt,
                }
            )
    task = corpus["fixtures"]["generation-progression"][0]
    arm = "exact-object-json-midi"
    document = json.loads(perfect_payload(arm, task))
    document["score"]["tempo_bpm"] += 1
    mutation = score_response(arm, task, core.canonical(document))
    return {
        "positive": positive,
        "negative": negative,
        "grammar": grammar,
        "metadata_mutation": {
            "failures": sorted(name for name, passed in mutation["checks"].items() if not passed),
            "pass": sorted(name for name, passed in mutation["checks"].items() if not passed) == ["exact_metadata"],
        },
    }


def synthetic_results(patterns: dict[str, list[bool]]) -> list[dict[str, Any]]:
    counters: dict[tuple[str, str], int] = {}
    result = []
    for job in jobs():
        validation = score_response(job["arm"], job["task"], perfect_payload(job["arm"], job["task"]))
        if job["arm"] in CONTROL_ARMS:
            key = (job["arm"], job["family"])
            index = counters.get(key, 0)
            choices = patterns[job["family"]]
            validation["primary_pass"] = choices[index % len(choices)]
            counters[key] = index + 1
        result.append({"arm": job["arm"], "family": job["family"], "variant": job["variant"], "repeat": 0, "validation": validation})
    return result


def provider_eligibility(run: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for family in FAMILIES:
        rows = [row for row in run["results"] if row["family"] == family and row["arm"] in CONTROL_ARMS]
        successes = sum(row["validation"]["primary_pass"] for row in rows)
        rate = successes / len(rows)
        result.append(
            {
                "family": family,
                "successes": successes,
                "trials": len(rows),
                "rate": round(rate, 6),
                "inside_band": ELIGIBILITY_BAND["minimum"] <= rate <= ELIGIBILITY_BAND["maximum"],
            }
        )
    return result


def summarize_runs(runs: list[dict[str, Any]], protocol_sha256: str | None = None) -> dict[str, Any]:
    providers = {run["provider"] for run in runs}
    if providers not in ({"openai", "gemini"}, set(PROVIDERS)):
        raise ValueError("The repair summary needs both cheap providers, with optional Claude")
    expected_protocol = protocol_sha256 or protocol_manifest()["sha256"]
    if any(run["protocol_sha256"] != expected_protocol or not run["complete"] for run in runs):
        raise ValueError("Repair runs must be complete and use one protocol")
    by_provider = {run["provider"]: provider_eligibility(run) for run in runs}
    families = []
    for family in FAMILIES:
        rows = [
            {"provider": provider, **next(item for item in values if item["family"] == family)}
            for provider, values in by_provider.items()
        ]
        count = sum(row["inside_band"] for row in rows)
        families.append({"family": family, "providers": rows, "eligible_providers": count})
    if len(runs) == 2:
        if all(row["eligible_providers"] == 2 for row in families):
            decision = "proceed-development"
        elif any(row["eligible_providers"] == 0 for row in families):
            decision = "repair-measurement"
        else:
            decision = "require-claude"
    else:
        decision = "proceed-development" if all(row["eligible_providers"] >= 2 for row in families) else "repair-measurement"
    value = {
        "schema": SCHEMA,
        "run_id": RUN_ID,
        "selection_authority": "None. This calibration can only approve a development freeze.",
        "eligibility": families,
        "decision": decision,
        "actual_cost_usd": round(sum(run.get("actual_cost_usd", 0) for run in runs), 6),
    }
    value["sha256"] = core.digest(value)
    return value


def aggregation_screen() -> dict[str, Any]:
    mixed = {family: [True, False] for family in FAMILIES}
    floor = {family: [False] for family in FAMILIES}
    high = {family: [True, False, True, False, True, False] for family in FAMILIES}
    protocol = "synthetic"

    def run(provider: str, pattern: dict[str, list[bool]]) -> dict[str, Any]:
        return {"provider": provider, "protocol_sha256": protocol, "complete": True, "results": synthetic_results(pattern), "actual_cost_usd": 0}

    cheap_pass = summarize_runs([run("openai", mixed), run("gemini", mixed)], protocol)["decision"]
    cheap_stop = summarize_runs([run("openai", floor), run("gemini", floor)], protocol)["decision"]
    cheap_extend = summarize_runs([run("openai", floor), run("gemini", high)], protocol)["decision"]
    extended = summarize_runs([run("openai", floor), run("gemini", high), run("claude", mixed)], protocol)["decision"]
    return {
        "cheap_pass": cheap_pass,
        "cheap_stop": cheap_stop,
        "cheap_extend": cheap_extend,
        "extended": extended,
        "pass": cheap_pass == "proceed-development" and cheap_stop == "repair-measurement" and cheap_extend == "require-claude" and extended == "proceed-development",
    }


def deterministic_screen() -> dict[str, Any]:
    audit = corpus_audit()
    contracts = contract_screen()
    aggregation = aggregation_screen()
    frozen = {
        "r1_protocol_sha256": r1.protocol_manifest()["sha256"],
        "r1_run_plan_sha256": r1.run_plan()["sha256"],
        "r1_report_sha256": json.loads((PACKAGE_ROOT / "runs" / "2026-09-27-calibration-report.json").read_text())["sha256"],
    }
    grammar_pass = all(all(value for name, value in row.items() if name not in {"arm", "family"}) for row in contracts["grammar"])
    value = {
        "schema": SCHEMA,
        "corpus_audit": audit,
        "contract_screen": contracts,
        "aggregation_screen": aggregation,
        "frozen_r1": frozen,
        "revoice_disposition": "Demote to a regression and component diagnostic because all 18 r1 control trials passed.",
        "development_resolution": {"decision_families": 2, "fixtures_per_family": 10, "smallest_macro_step": 0.05},
        "all_checks_pass": audit["prior_semantic_overlap"] == 0
        and audit["internal_semantic_duplicates"] == 0
        and all(row["pass"] for row in contracts["positive"])
        and all(row["pass"] for row in contracts["negative"])
        and contracts["metadata_mutation"]["pass"]
        and grammar_pass
        and aggregation["pass"],
    }
    value["sha256"] = core.digest(value)
    return value


def protocol_manifest() -> dict[str, Any]:
    run_jobs = jobs()
    files = ("core.py", "calibration_r2.py", "SCHEMAS.md", "CALIBRATION_R1.md", "CALIBRATION_R2.md", "calibration-r2-cohort-manifest.json")
    value = {
        "schema": SCHEMA,
        "run_id": RUN_ID,
        "kind": "diagnostic-measurement-repair",
        "selection_authority": "None. This calibration cannot select a representation.",
        "arms": list(ARMS),
        "families": list(FAMILIES),
        "demoted_family": "transformation-revoice",
        "sample": {
            "fixtures_per_family": FIXTURES_PER_FAMILY,
            "calls_per_arm_provider": len(run_jobs) // len(ARMS),
            "calls_per_provider": len(run_jobs),
            "cheap_provider_calls": len(run_jobs) * 2,
            "maximum_calls": len(run_jobs) * 3,
            "repeats": 1,
        },
        "providers": list(PROVIDERS),
        "provider_order": ["openai", "gemini", "claude-if-required"],
        "models": MODELS,
        "settings": SETTINGS,
        "eligibility_band": ELIGIBILITY_BAND,
        "controls": list(CONTROL_ARMS),
        "randomization": {"method": "Shuffle all isolated calls before dispatch.", "seed": 8353},
        "stopping_rule": "Run OpenAI and Gemini first. If both pass both families, stop with proceed-development. If both fail either family, stop with repair-measurement. Otherwise, Claude is allowed to resolve the second-provider rule.",
        "allowed_follow_up": "Summarize the fixed repair calibration. Do not start development without a new plan and explicit approval.",
        "privacy": "Send generated MIT symbolic text only. Do not send live project data, MIDI files, audio, or API keys.",
        "corpus_sha256": make_corpus()["sha256"],
        "fixture_sha256": corpus_audit()["fixture_sha256"],
        "semantic_sha256": corpus_audit()["semantic_sha256"],
        "prompt_sha256": {
            f"{job['arm']}:{job['family']}:{job['variant']}:0": core.sha256_text(prompt_for(job["arm"], job["task"]))
            for job in run_jobs
        },
        "package_file_sha256": {
            name: hashlib.sha256((PACKAGE_ROOT / name).read_bytes()).hexdigest()
            for name in files
            if (PACKAGE_ROOT / name).exists()
        },
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    calls = protocol["sample"]["calls_per_provider"]
    estimates = {
        provider: {
            "calls": calls,
            "estimated_cost_usd": round(calls * COST_BASIS["mean_call_cost_usd"][provider] * 1.25, 6),
        }
        for provider in PROVIDERS
    }
    value = {
        "schema": SCHEMA,
        "run_kind": "measurement-repair-calibration-plan",
        "run_id": RUN_ID,
        "approval": {"status": "pending", "requirement": "Get explicit operator approval for this exact conditional calibration before any provider call."},
        "scope": {
            "arms": list(ARMS),
            "families": list(FAMILIES),
            "fixtures_per_family": FIXTURES_PER_FAMILY,
            "repeats": 1,
            "providers": list(PROVIDERS),
            "provider_order": protocol["provider_order"],
        },
        "expected_calls": {"openai": calls, "gemini": calls, "claude_if_required": calls, "cheap_stage": calls * 2, "maximum": calls * 3},
        "models": MODELS,
        "settings": SETTINGS,
        "cost_estimate": {
            "providers": estimates,
            "cheap_stage_usd": round(estimates["openai"]["estimated_cost_usd"] + estimates["gemini"]["estimated_cost_usd"], 6),
            "maximum_usd": round(sum(row["estimated_cost_usd"] for row in estimates.values()), 6),
            "basis": COST_BASIS,
        },
        "corpus_sha256": make_corpus()["sha256"],
        "cohort_manifest_sha256": corpus_audit()["sha256"],
        "scorer_sha256": hashlib.sha256((PACKAGE_ROOT / "core.py").read_bytes()).hexdigest(),
        "repair_protocol_sha256": protocol["sha256"],
        "stopping_rule": protocol["stopping_rule"],
        "allowed_follow_up": protocol["allowed_follow_up"],
    }
    value["sha256"] = core.digest(value)
    return value


def deterministic_package() -> dict[str, Any]:
    value = {"schema": SCHEMA, "screen": deterministic_screen(), "protocol": protocol_manifest(), "run_plan": run_plan()}
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
    value = deterministic_package()
    assert value["screen"]["all_checks_pass"]
    assert len(jobs()) == 30
    assert run_plan()["expected_calls"]["cheap_stage"] == 60
    assert run_plan()["expected_calls"]["maximum"] == 90
    return {"schema": SCHEMA, "pass": True, "checks": 75, "corpus_sha256": make_corpus()["sha256"], "deterministic_sha256": value["sha256"]}


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    if value.get("run_id") != RUN_ID or value.get("repair_protocol_sha256") != plan["repair_protocol_sha256"] or value.get("run_plan_sha256") != plan["sha256"]:
        raise ValueError("The approval does not match the frozen repair plan")
    if value.get("status") != "approved" or not value.get("operator_statement"):
        raise ValueError("The repair approval must include an explicit operator statement")
    return value


def validate_claude_prior(paths: list[Path] | None) -> None:
    if not paths or len(paths) != 2:
        raise ValueError("Claude needs the complete OpenAI and Gemini repair runs")
    runs = [json.loads(path.read_text()) for path in paths]
    if summarize_runs(runs)["decision"] != "require-claude":
        raise ValueError("The cheap-provider result does not allow Claude")


def call_job(provider: str, key: str, job: dict[str, Any]) -> dict[str, Any]:
    prompt = prompt_for(job["arm"], job["task"])
    common = {
        "arm": job["arm"],
        "family": job["family"],
        "variant": job["variant"],
        "repeat": 0,
        "task_sha256": job["task"]["sha256"],
        "semantic_sha256": job["task"]["semantic_sha256"],
        "prompt_sha256": core.sha256_text(prompt),
        "prompt_bytes": len(prompt.encode()),
    }
    try:
        outer, raw, latency_ms, retries = core.v3.v2.call_with_retry(provider, key, prompt)
        usage = core.v3.v2.usage(provider, raw)
        payload = outer["payload"]
        return {
            **common,
            "response_payload": payload,
            "response_payload_bytes": len(payload.encode()),
            "response_payload_sha256": core.sha256_text(payload),
            "outer_schema_valid": outer["outer_schema_valid"],
            "validation": score_response(job["arm"], job["task"], payload),
            "usage": usage,
            "cost_usd": core.v3.v2.cost_usd(provider, usage),
            "latency_ms": round(latency_ms, 3),
            "retries": retries,
            "returned_model": core.v3.v2.returned_model(provider, raw),
            "request_id": raw.get("id"),
            "stop_reason": core.v3.v2.stop_reason(provider, raw),
            "raw_response_sha256": core.digest(raw),
        }
    except Exception as error:
        return {
            **common,
            "transport_error": f"{type(error).__name__}: {error}",
            "validation": {"syntax_pass": False, "primary_pass": False, "checks": {}, "error": "transport"},
            "usage": {"input_tokens": 0, "cached_input_tokens": 0, "output_tokens": 0, "thinking_tokens": 0},
            "cost_usd": {"uncached_input": 0, "cached_input": 0, "output": 0, "total": 0},
            "retries": 3,
        }


def execute_jobs(provider: str, key: str, workers: int) -> list[dict[str, Any]]:
    ordered = jobs()
    random.Random(8353).shuffle(ordered)
    result = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(call_job, provider, key, job) for job in ordered]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            result.append(future.result())
            if index % 10 == 0:
                print(f"{provider}: completed {index}/{len(futures)} repair calls", file=sys.stderr, flush=True)
    return sorted(result, key=lambda value: (value["arm"], value["family"], value["variant"], value["repeat"]))


def run_provider(provider: str, env_file: Path, approval_file: Path, workers: int, prior_runs: list[Path] | None) -> dict[str, Any]:
    approval = validate_approval(approval_file)
    if provider == "claude":
        validate_claude_prior(prior_runs)
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise ValueError("The repair deterministic screen failed")
    environment = core.v3.v2.load_env(env_file)
    key = environment.get(core.v3.v2.KEYS[provider])
    if not key:
        raise ValueError(f"{core.v3.v2.KEYS[provider]} is missing")
    results = execute_jobs(provider, key, workers)
    value = {
        "schema": SCHEMA,
        "run_kind": "measurement-repair-provider",
        "run_id": RUN_ID,
        "provider": provider,
        "requested_model": MODELS[provider],
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
        "complete": len(results) == 30 and all("transport_error" not in row for row in results),
    }
    value["raw_run_sha256"] = core.digest([row.get("raw_response_sha256") for row in results])
    value["manifest_sha256"] = core.digest(value)
    return value


def write(value: dict[str, Any], output: Path | None) -> None:
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
    actions.add_argument("--cohort", action="store_true")
    actions.add_argument("--check", type=Path)
    actions.add_argument("--run-plan", action="store_true")
    actions.add_argument("--provider", choices=PROVIDERS)
    actions.add_argument("--summarize", nargs="+", type=Path)
    parser.add_argument("--env-file", type=Path, default=Path("../.env"))
    parser.add_argument("--approval-file", type=Path)
    parser.add_argument("--prior-runs", nargs=2, type=Path)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.self_test:
        value = self_test()
    elif args.deterministic:
        value = deterministic_package()
    elif args.cohort:
        value = {"schema": CORPUS_SCHEMA, **corpus_audit()}
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
        value = run_provider(args.provider, args.env_file, args.approval_file, args.workers, args.prior_runs)
    else:
        value = summarize_runs([json.loads(path.read_text()) for path in args.summarize])
    write(value, args.output)


if __name__ == "__main__":
    main()
