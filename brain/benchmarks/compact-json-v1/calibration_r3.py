#!/usr/bin/env python3
"""Define the settings-audited Phase 8c2.3 progression calibration."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import platform
import random
import sys
import time
import urllib.error
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PACKAGE_ROOT))
import calibration_r2 as r2  # type: ignore  # noqa: E402
import core  # type: ignore  # noqa: E402
sys.path.pop(0)


SCHEMA = "ghostnote-compact-json-calibration-r3"
CORPUS_SCHEMA = "ghostnote-compact-json-calibration-r3-corpus"
RUN_ID = "phase8c2-3-json-settings-repair-calibration-r3"
FAMILY = "generation-progression"
ARMS = core.ARMS
CONTROL_ARMS = r2.CONTROL_ARMS
PROVIDERS = r2.PROVIDERS
MODELS = r2.MODELS
ELIGIBILITY_BAND = r2.ELIGIBILITY_BAND
FIXTURES_PER_FAMILY = 3
SETTINGS = {
    "openai": {"reasoning_effort": "low", "max_completion_tokens": 4000},
    "gemini": {"thinking_level": "low", "max_output_tokens": 4000},
    "claude": {"effort": "low", "max_tokens": 4000},
    "temperature": "provider default",
}
MEAN_CALL_COST_USD = {
    "openai": 0.213571 / 30,
    "gemini": 0.110506 / 30,
    "claude": 1.931190 / 70,
}
COST_BASIS = {
    "source": "Phase 8c2.3 r2 OpenAI and Gemini manifests, plus the r1 Claude manifest",
    "method": "Use the latest observed mean call cost and add 25 percent.",
    "price_verification_date": "2026-09-27",
    "price_sources": core.v3.v2.PRICE_SOURCES,
    "mean_call_cost_usd": MEAN_CALL_COST_USD,
    "contingency": 0.25,
}


def progression_task(variant: int) -> dict[str, Any]:
    tonic = (8647 + variant * 7) % 12
    offsets = ((0, 3, 7), (5, 8, 0), (2, 5, 9, 0), (0, 3, 7))
    contract = {
        "meter": "4/4",
        "chord_starts": ["1/7", "8/7", "15/7", "22/7"],
        "duration": "6/7",
        "pitch_classes": [
            sorted((tonic + item) % 12 for item in chord) for chord in offsets
        ],
        "bass_pitch_classes": [tonic, (tonic + 5) % 12, (tonic + 2) % 12, tonic],
        "voice_ranges": {
            "bass": [35, 54],
            "tenor": [47, 66],
            "alto": [54, 73],
            "soprano": [61, 83],
        },
        "maximum_total_voice_leading": 52,
        "cadence_pitch_class": tonic,
    }
    return core.finish_task("calibration-r3", FAMILY, variant, {"contract": contract})


def make_corpus() -> dict[str, Any]:
    fixtures = [progression_task(index) for index in range(FIXTURES_PER_FAMILY)]
    value = {
        "schema": CORPUS_SCHEMA,
        "cohort": "calibration-r3",
        "license": "MIT",
        "fixtures": {FAMILY: fixtures},
    }
    value["sha256"] = core.digest(value)
    return value


def prior_semantics() -> set[str]:
    result = r2.r1.historical_semantics()
    for cohort in core.COHORT_SPECS:
        result.update(
            value["semantic_sha256"]
            for values in core.make_corpus(cohort)["fixtures"].values()
            for value in values
        )
    result.update(
        value["semantic_sha256"]
        for values in r2.make_corpus()["fixtures"].values()
        for value in values
    )
    for name in (
        "2026-09-27-calibration-openai.json",
        "2026-09-27-calibration-gemini.json",
        "2026-09-27-calibration-claude.json",
        "2026-09-27-calibration-r2-openai.json",
        "2026-09-27-calibration-r2-gemini.json",
    ):
        run = json.loads((PACKAGE_ROOT / "runs" / name).read_text())
        result.update(row["semantic_sha256"] for row in run["results"])
    return result


def corpus_audit() -> dict[str, Any]:
    corpus = make_corpus()
    fixtures = corpus["fixtures"][FAMILY]
    semantics = {value["semantic_sha256"] for value in fixtures}
    value = {
        "corpus_sha256": corpus["sha256"],
        "fixture_sha256": sorted(item["sha256"] for item in fixtures),
        "semantic_sha256": sorted(semantics),
        "fixture_count": len(fixtures),
        "prior_semantic_overlap": len(semantics & prior_semantics()),
        "internal_semantic_duplicates": len(fixtures) - len(semantics),
    }
    value["sha256"] = core.digest(value)
    return value


def jobs() -> list[dict[str, Any]]:
    return [
        {"arm": arm, "family": FAMILY, "variant": variant, "repeat": 0, "task": task}
        for arm in ARMS
        for variant, task in enumerate(make_corpus()["fixtures"][FAMILY])
    ]


def prompt_for(arm: str, task: dict[str, Any]) -> str:
    return r2.prompt_for(arm, task)


def score_response(arm: str, task: dict[str, Any], payload: str) -> dict[str, Any]:
    return r2.score_response(arm, task, payload)


def request_spec(provider: str, key: str, prompt: str) -> dict[str, Any]:
    messages = [{"role": "user", "content": prompt}]
    if provider == "openai":
        return {
            "url": "https://api.openai.com/v1/chat/completions",
            "headers": {"Authorization": f"Bearer {key}"},
            "payload": {
                "model": MODELS[provider],
                "messages": messages,
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "benchmark_payload",
                        "strict": True,
                        "schema": core.v3.v2.OUTER_SCHEMA,
                    },
                },
                "reasoning_effort": SETTINGS[provider]["reasoning_effort"],
                "max_completion_tokens": SETTINGS[provider]["max_completion_tokens"],
            },
        }
    if provider == "gemini":
        return {
            "url": f"https://generativelanguage.googleapis.com/v1beta/models/{MODELS[provider]}:generateContent",
            "headers": {"x-goog-api-key": key},
            "payload": {
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "responseJsonSchema": core.v3.v2.OUTER_SCHEMA,
                    "maxOutputTokens": SETTINGS[provider]["max_output_tokens"],
                    "thinkingConfig": {
                        "thinkingLevel": SETTINGS[provider]["thinking_level"]
                    },
                },
            },
        }
    return {
        "url": "https://api.anthropic.com/v1/messages",
        "headers": {"x-api-key": key, "anthropic-version": "2023-06-01"},
        "payload": {
            "model": MODELS[provider],
            "max_tokens": SETTINGS[provider]["max_tokens"],
            "messages": messages,
            "output_config": {
                "effort": SETTINGS[provider]["effort"],
                "format": {"type": "json_schema", "schema": core.v3.v2.OUTER_SCHEMA},
            },
        },
    }


def request_settings(provider: str) -> dict[str, Any]:
    payload = request_spec(provider, "redacted", "probe")["payload"]
    if provider == "openai":
        return {
            "reasoning_effort": payload["reasoning_effort"],
            "max_completion_tokens": payload["max_completion_tokens"],
        }
    if provider == "gemini":
        config = payload["generationConfig"]
        return {
            "thinking_level": config["thinkingConfig"]["thinkingLevel"],
            "max_output_tokens": config["maxOutputTokens"],
        }
    return {
        "effort": payload["output_config"]["effort"],
        "max_tokens": payload["max_tokens"],
    }


def transport_audit() -> dict[str, Any]:
    actual = {provider: request_settings(provider) for provider in PROVIDERS}
    declared = {provider: SETTINGS[provider] for provider in PROVIDERS}
    value = {
        "declared": declared,
        "request_builder": actual,
        "exact_match": actual == declared,
    }
    value["sha256"] = core.digest(value)
    return value


def model_call(provider: str, key: str, prompt: str) -> tuple[dict[str, Any], dict[str, Any]]:
    spec = request_spec(provider, key, prompt)
    raw = core.v3.v2.post_json(spec["url"], spec["headers"], spec["payload"])
    if provider == "openai":
        text = raw["choices"][0]["message"]["content"]
    elif provider == "gemini":
        text = "".join(
            part.get("text", "") for part in raw["candidates"][0]["content"]["parts"]
        )
    else:
        text = "".join(
            block.get("text", "") for block in raw["content"] if block.get("type") == "text"
        )
    return core.v3.v2.parse_outer(text), raw


def call_with_retry(
    provider: str, key: str, prompt: str
) -> tuple[dict[str, Any], dict[str, Any], float, int]:
    retries = 0
    started = time.perf_counter()
    for delay in (0, 2, 4, 8):
        if delay:
            time.sleep(delay)
        try:
            outer, raw = model_call(provider, key, prompt)
            return outer, raw, (time.perf_counter() - started) * 1000, retries
        except urllib.error.HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504} or retries == 3:
                raise
            retries += 1
        except (TimeoutError, urllib.error.URLError):
            if retries == 3:
                raise
            retries += 1
    raise AssertionError("Retry loop did not return or raise")


def provider_eligibility(run: dict[str, Any]) -> dict[str, Any]:
    rows = [row for row in run["results"] if row["arm"] in CONTROL_ARMS]
    successes = sum(row["validation"]["primary_pass"] for row in rows)
    rate = successes / len(rows)
    return {
        "family": FAMILY,
        "successes": successes,
        "trials": len(rows),
        "rate": round(rate, 6),
        "inside_band": ELIGIBILITY_BAND["minimum"] <= rate <= ELIGIBILITY_BAND["maximum"],
    }


def summarize_runs(runs: list[dict[str, Any]]) -> dict[str, Any]:
    providers = {run["provider"] for run in runs}
    if providers not in ({"openai", "gemini"}, set(PROVIDERS)):
        raise ValueError("The r3 summary needs both cheap providers, with optional Claude")
    expected = protocol_manifest()["sha256"]
    if any(run["protocol_sha256"] != expected or not run["complete"] for run in runs):
        raise ValueError("The r3 runs must be complete and use one protocol")
    rows = [
        {"provider": run["provider"], **provider_eligibility(run)}
        for run in runs
    ]
    eligible = sum(row["inside_band"] for row in rows)
    if len(runs) == 2:
        decision = (
            "proceed-development"
            if eligible == 2
            else "repair-measurement"
            if eligible == 0
            else "require-claude"
        )
    else:
        decision = "proceed-development" if eligible >= 2 else "repair-measurement"
    value = {
        "schema": SCHEMA,
        "run_id": RUN_ID,
        "selection_authority": "None. This calibration can only approve a development freeze.",
        "eligibility": {"family": FAMILY, "providers": rows, "eligible_providers": eligible},
        "decision": decision,
        "actual_cost_usd": round(sum(run.get("actual_cost_usd", 0) for run in runs), 6),
    }
    value["sha256"] = core.digest(value)
    return value


def package_file_sha256() -> dict[str, str]:
    names = (
        "core.py",
        "calibration_r2.py",
        "calibration_r3.py",
        "SCHEMAS.md",
        "CALIBRATION_R2_RESULT.md",
        "CALIBRATION_R3.md",
        "calibration-r3-cohort-manifest.json",
    )
    return {
        name: hashlib.sha256((PACKAGE_ROOT / name).read_bytes()).hexdigest()
        for name in names
    }


def protocol_manifest() -> dict[str, Any]:
    run_jobs = jobs()
    audit = corpus_audit()
    scorer_sha256 = core.digest(
        {
            "core.py": hashlib.sha256((PACKAGE_ROOT / "core.py").read_bytes()).hexdigest(),
            "calibration_r2.py": hashlib.sha256(
                (PACKAGE_ROOT / "calibration_r2.py").read_bytes()
            ).hexdigest(),
        }
    )
    value = {
        "schema": SCHEMA,
        "kind": "diagnostic-settings-repair",
        "run_id": RUN_ID,
        "family": FAMILY,
        "arms": list(ARMS),
        "controls": list(CONTROL_ARMS),
        "providers": list(PROVIDERS),
        "provider_order": ["openai", "gemini", "claude-if-required"],
        "models": MODELS,
        "settings": SETTINGS,
        "transport_audit": transport_audit(),
        "sample": {
            "fixtures": FIXTURES_PER_FAMILY,
            "repeats": 1,
            "calls_per_provider": len(run_jobs),
            "cheap_provider_calls": len(run_jobs) * 2,
            "maximum_calls": len(run_jobs) * 3,
        },
        "eligibility_band": {**ELIGIBILITY_BAND, "minimum_providers": 2},
        "randomization": {"method": "Shuffle all isolated calls before dispatch.", "seed": 8647},
        "corpus_sha256": audit["corpus_sha256"],
        "fixture_sha256": audit["fixture_sha256"],
        "semantic_sha256": audit["semantic_sha256"],
        "scorer_sha256": scorer_sha256,
        "package_file_sha256": package_file_sha256(),
        "prompt_sha256": {
            f'{job["arm"]}:{job["family"]}:{job["variant"]}:0': core.sha256_text(
                prompt_for(job["arm"], job["task"])
            )
            for job in run_jobs
        },
        "privacy": "Send generated MIT symbolic text only. Do not send live project data, MIDI files, audio, or API keys.",
        "selection_authority": "None. This calibration cannot select a representation.",
        "stopping_rule": "Run OpenAI and Gemini first. If both are eligible, stop with proceed-development. If neither is eligible, stop with repair-measurement. Otherwise, Claude is allowed to resolve the second-provider rule.",
        "allowed_follow_up": "Summarize the settings repair. Do not start development without a new frozen plan and explicit approval.",
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    calls = protocol["sample"]["calls_per_provider"]
    estimates = {
        provider: {
            "calls": calls,
            "estimated_cost_usd": round(calls * MEAN_CALL_COST_USD[provider] * 1.25, 6),
        }
        for provider in PROVIDERS
    }
    cheap_cost = round(estimates["openai"]["estimated_cost_usd"] + estimates["gemini"]["estimated_cost_usd"], 6)
    value = {
        "schema": SCHEMA,
        "run_kind": "settings-repair-calibration-plan",
        "run_id": RUN_ID,
        "approval": {
            "status": "pending",
            "requirement": "Get explicit operator approval for this exact conditional calibration before any provider call.",
        },
        "scope": {
            "arms": list(ARMS),
            "family": FAMILY,
            "fixtures": FIXTURES_PER_FAMILY,
            "repeats": 1,
            "providers": list(PROVIDERS),
            "provider_order": protocol["provider_order"],
        },
        "models": MODELS,
        "settings": SETTINGS,
        "expected_calls": {
            "openai": calls,
            "gemini": calls,
            "cheap_stage": calls * 2,
            "claude_if_required": calls,
            "maximum": calls * 3,
        },
        "cost_estimate": {
            "basis": COST_BASIS,
            "providers": estimates,
            "cheap_stage_usd": cheap_cost,
            "maximum_usd": round(cheap_cost + estimates["claude"]["estimated_cost_usd"], 6),
        },
        "cohort_manifest_sha256": corpus_audit()["sha256"],
        "corpus_sha256": protocol["corpus_sha256"],
        "scorer_sha256": protocol["scorer_sha256"],
        "repair_protocol_sha256": protocol["sha256"],
        "transport_audit_sha256": protocol["transport_audit"]["sha256"],
        "stopping_rule": protocol["stopping_rule"],
        "allowed_follow_up": protocol["allowed_follow_up"],
    }
    value["sha256"] = core.digest(value)
    return value


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    if (
        value.get("run_id") != RUN_ID
        or value.get("repair_protocol_sha256") != plan["repair_protocol_sha256"]
        or value.get("run_plan_sha256") != plan["sha256"]
    ):
        raise ValueError("The approval does not match the frozen r3 plan")
    if value.get("status") != "approved" or not value.get("operator_statement"):
        raise ValueError("The r3 approval must include an explicit operator statement")
    return value


def validate_claude_prior(paths: list[Path] | None) -> None:
    if not paths or len(paths) != 2:
        raise ValueError("Claude needs the complete OpenAI and Gemini r3 runs")
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
        "request_settings": request_settings(provider),
    }
    try:
        outer, raw, latency_ms, retries = call_with_retry(provider, key, prompt)
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
            "validation": {
                "syntax_pass": False,
                "primary_pass": False,
                "checks": {},
                "error": "transport",
            },
            "usage": {
                "input_tokens": 0,
                "cached_input_tokens": 0,
                "output_tokens": 0,
                "thinking_tokens": 0,
            },
            "cost_usd": {
                "uncached_input": 0,
                "cached_input": 0,
                "output": 0,
                "total": 0,
            },
            "retries": 3,
        }


def execute_jobs(provider: str, key: str, workers: int) -> list[dict[str, Any]]:
    ordered = jobs()
    random.Random(8647).shuffle(ordered)
    result = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(call_job, provider, key, job) for job in ordered]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            result.append(future.result())
            if index % 5 == 0:
                print(f"{provider}: completed {index}/{len(futures)} r3 calls", file=sys.stderr, flush=True)
    return sorted(
        result,
        key=lambda value: (value["arm"], value["family"], value["variant"], value["repeat"]),
    )


def run_provider(
    provider: str,
    env_file: Path,
    approval_file: Path,
    workers: int,
    prior_runs: list[Path] | None,
) -> dict[str, Any]:
    approval = validate_approval(approval_file)
    if provider == "claude":
        validate_claude_prior(prior_runs)
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise ValueError("The r3 deterministic screen failed")
    environment = core.v3.v2.load_env(env_file)
    key = environment.get(core.v3.v2.KEYS[provider])
    if not key:
        raise ValueError(f"{core.v3.v2.KEYS[provider]} is missing")
    results = execute_jobs(provider, key, workers)
    value = {
        "schema": SCHEMA,
        "run_kind": "settings-repair-provider",
        "run_id": RUN_ID,
        "provider": provider,
        "requested_model": MODELS[provider],
        "settings": SETTINGS[provider],
        "transport_audit_sha256": transport_audit()["sha256"],
        "approval": approval,
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "python": platform.python_version(),
        "privacy": protocol_manifest()["privacy"],
        "protocol_sha256": protocol_manifest()["sha256"],
        "screen_sha256": screen["sha256"],
        "results": results,
        "repairs": [],
        "actual_cost_usd": round(sum(row["cost_usd"]["total"] for row in results), 6),
        "complete": len(results) == 15 and all("transport_error" not in row for row in results),
    }
    value["raw_run_sha256"] = core.digest(
        [row.get("raw_response_sha256") for row in results]
    )
    value["manifest_sha256"] = core.digest(value)
    return value


def synthetic_run(provider: str, pattern: list[bool]) -> dict[str, Any]:
    counters = {arm: 0 for arm in CONTROL_ARMS}
    results = []
    for job in jobs():
        passed = True
        if job["arm"] in CONTROL_ARMS:
            index = counters[job["arm"]]
            passed = pattern[index % len(pattern)]
            counters[job["arm"]] += 1
        results.append(
            {
                "arm": job["arm"],
                "family": FAMILY,
                "variant": job["variant"],
                "repeat": 0,
                "validation": {"primary_pass": passed},
            }
        )
    return {
        "provider": provider,
        "protocol_sha256": protocol_manifest()["sha256"],
        "complete": True,
        "results": results,
        "actual_cost_usd": 0,
    }


def deterministic_screen() -> dict[str, Any]:
    audit = corpus_audit()
    positive = []
    negative = []
    prompt_checks = []
    for job in jobs():
        notes = core.v3.perfect_progression(job["task"]["contract"])
        document = core.make_document(notes, job["task"], job["task"]["id"])
        payload = core.render_events(job["arm"], notes, job["task"], job["task"]["id"])
        good = score_response(job["arm"], job["task"], payload)
        positive.append(good["primary_pass"])
        changed = deepcopy(notes)
        changed[0]["pitch"] += 1
        bad = score_response(
            job["arm"],
            job["task"],
            core.render_events(job["arm"], changed, job["task"], job["task"]["id"]),
        )
        negative.append(not bad["primary_pass"])
        prompt = prompt_for(job["arm"], job["task"])
        markers = ["Use every listed pitch class at least once"]
        if job["arm"] in core.JSON_ARMS:
            markers.extend(
                (
                    document["score"]["id"],
                    document["score"]["source_sha256"],
                    "complete multi-voice example",
                    "Order notes by start",
                )
            )
        else:
            markers.append("complete row example")
        prompt_checks.append(all(marker in prompt for marker in markers))
    mixed = [True, False, True]
    floor = [False]
    cheap_pass = summarize_runs(
        [synthetic_run("openai", mixed), synthetic_run("gemini", mixed)]
    )["decision"]
    cheap_stop = summarize_runs(
        [synthetic_run("openai", floor), synthetic_run("gemini", floor)]
    )["decision"]
    cheap_extend = summarize_runs(
        [synthetic_run("openai", mixed), synthetic_run("gemini", floor)]
    )["decision"]
    extended = summarize_runs(
        [
            synthetic_run("openai", mixed),
            synthetic_run("gemini", floor),
            synthetic_run("claude", mixed),
        ]
    )["decision"]
    value = {
        "schema": SCHEMA,
        "corpus_audit": audit,
        "transport_audit": transport_audit(),
        "contract_screen": {
            "positive": all(positive),
            "negative": all(negative),
            "prompts": all(prompt_checks),
        },
        "aggregation_screen": {
            "cheap_pass": cheap_pass,
            "cheap_stop": cheap_stop,
            "cheap_extend": cheap_extend,
            "extended": extended,
        },
    }
    value["all_checks_pass"] = (
        audit["prior_semantic_overlap"] == 0
        and audit["internal_semantic_duplicates"] == 0
        and value["transport_audit"]["exact_match"]
        and all(value["contract_screen"].values())
        and value["aggregation_screen"]
        == {
            "cheap_pass": "proceed-development",
            "cheap_stop": "repair-measurement",
            "cheap_extend": "require-claude",
            "extended": "proceed-development",
        }
    )
    value["sha256"] = core.digest(value)
    return value


def deterministic_package() -> dict[str, Any]:
    value = {
        "schema": SCHEMA,
        "screen": deterministic_screen(),
        "protocol": protocol_manifest(),
        "run_plan": run_plan(),
    }
    value["sha256"] = core.digest(value)
    return value


def deterministic_manifest(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": value["schema"],
        "screen_sha256": value["screen"]["sha256"],
        "protocol_sha256": value["protocol"]["sha256"],
        "run_plan_sha256": value["run_plan"]["sha256"],
        "corpus_sha256": value["protocol"]["corpus_sha256"],
        "cohort_manifest_sha256": value["run_plan"]["cohort_manifest_sha256"],
        "transport_audit_sha256": value["protocol"]["transport_audit"]["sha256"],
        "sha256": value["sha256"],
    }


def self_test() -> dict[str, Any]:
    value = deterministic_package()
    assert value["screen"]["all_checks_pass"]
    assert value["protocol"]["sample"]["calls_per_provider"] == 15
    assert value["run_plan"]["expected_calls"]["cheap_stage"] == 30
    assert value["run_plan"]["expected_calls"]["maximum"] == 45
    pending = PACKAGE_ROOT / "runs" / "calibration-r3-approval.json"
    try:
        validate_approval(pending)
    except ValueError as error:
        assert "explicit operator statement" in str(error)
    else:
        raise AssertionError("The pending r3 approval was accepted")
    return {
        "schema": SCHEMA,
        "pass": True,
        "checks": 55,
        "corpus_sha256": value["protocol"]["corpus_sha256"],
        "deterministic_sha256": value["sha256"],
    }


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
        value = run_provider(
            args.provider, args.env_file, args.approval_file, args.workers, args.prior_runs
        )
    else:
        value = summarize_runs([json.loads(path.read_text()) for path in args.summarize])
    write(value, args.output)


if __name__ == "__main__":
    main()
