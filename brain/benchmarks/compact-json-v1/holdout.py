#!/usr/bin/env python3
"""Define the frozen Phase 8c2.3 compact JSON targeted holdout."""

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
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
RUNS_ROOT = PACKAGE_ROOT / "runs"
sys.path.insert(0, str(PACKAGE_ROOT))
import core  # type: ignore  # noqa: E402
import development as dev  # type: ignore  # noqa: E402
sys.path.pop(0)


SCHEMA = "ghostnote-compact-json-holdout-v1"
RUN_ID = "phase8c2-3-compact-json-holdout-r1"
SEED = 8923
FAMILY = dev.FAMILY
CONTROL = "exact-object-json-midi"
PITCH_CANDIDATE = "exact-object-json-pc-register"
TUPLE_CANDIDATE = "tuple-json-midi"
ARMS = (CONTROL, PITCH_CANDIDATE, TUPLE_CANDIDATE)
PROVIDERS = dev.PROVIDERS
MODELS = dev.MODELS
FIXTURES = dev.FIXTURES_PER_COHORT
DECISION_MARGIN = dev.DECISION_MARGIN
PITCH_IMPROVEMENT = dev.PITCH_IMPROVEMENT
MINIMUM_SUPPORTING_PROVIDERS = 2
DEVELOPMENT_SUMMARY_SHA256 = "ffdfa0b21a87aee2465b6d0ff8c4473de59a861662a818d456eaa65b7c65f559"
DEVELOPMENT_REPORT_SHA256 = "f16e67ea80070140431e6225211fe8cd4672b117bc0dc9af7f017e69cdf49866"
SETTINGS = {
    "openai": {"reasoning_effort": "low", "max_completion_tokens": 5000},
    "gemini": {"thinking_level": "low", "max_output_tokens": 5000},
    "claude": {"effort": "low", "max_tokens": 7000},
    "temperature": "provider default",
}
DEVELOPMENT_MEAN_CALL_COST_USD = {
    "openai": 0.837567 / 100,
    "gemini": 0.441198 / 100,
    "claude": 4.674081 / 100,
}
COST_BASIS = {
    "source": "Phase 8c2.3 development r1 provider manifests",
    "method": "Use the observed development mean call cost and add 25 percent.",
    "price_verification_date": "2026-09-27",
    "price_sources": core.v3.v2.PRICE_SOURCES,
    "mean_call_cost_usd": DEVELOPMENT_MEAN_CALL_COST_USD,
    "contingency": 0.25,
    "claude_limit_note": "The estimate includes contingency for the higher 7,000-token holdout limit.",
}


def load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def development_authority() -> dict[str, Any]:
    summary = load(RUNS_ROOT / "2026-09-27-development-summary.json")
    report = load(RUNS_ROOT / "2026-09-27-development-report.json")
    summary_payload = deepcopy(summary)
    summary_payload.pop("sha256", None)
    if (
        summary.get("sha256") != DEVELOPMENT_SUMMARY_SHA256
        or core.digest(summary_payload) != DEVELOPMENT_SUMMARY_SHA256
    ):
        raise ValueError("The development summary does not match the frozen holdout input")
    report_payload = deepcopy(report)
    report_payload.pop("sha256", None)
    if (
        report.get("sha256") != DEVELOPMENT_REPORT_SHA256
        or core.digest(report_payload) != DEVELOPMENT_REPORT_SHA256
    ):
        raise ValueError("The development report does not match the frozen holdout input")
    if summary.get("decision") != "freeze-holdout":
        raise ValueError("Development did not permit a holdout")
    if summary.get("json_candidates") != list(ARMS):
        raise ValueError("Development selected different holdout cells")
    if summary.get("native_limited_candidate") is not False:
        raise ValueError("Development selected a native holdout candidate")
    return {
        "summary_sha256": summary["sha256"],
        "report_sha256": report["sha256"],
        "candidates": summary["json_candidates"],
        "native_limited_candidate": summary["native_limited_candidate"],
    }


def jobs() -> list[dict[str, Any]]:
    tasks = dev.make_corpus("holdout-r1")["fixtures"][FAMILY]
    return [
        {
            "arm": arm,
            "family": FAMILY,
            "variant": task["variant"],
            "repeat": 0,
            "task": task,
        }
        for arm in ARMS
        for task in tasks
    ]


def prompt_for(arm: str, task: dict[str, Any]) -> str:
    return dev.prompt_for(arm, task)


def score_response(arm: str, task: dict[str, Any], payload: str) -> dict[str, Any]:
    return dev.score_response(arm, task, payload)


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
    value = {"declared": declared, "request_builder": actual, "exact_match": actual == declared}
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


def provider_signal(run: dict[str, Any]) -> dict[str, Any]:
    indexed = {(row["arm"], row["variant"]): row for row in run["results"]}
    tuple_primary = dev.paired_stats(
        indexed, TUPLE_CANDIDATE, CONTROL, dev.primary_metric
    )
    pitch_primary = dev.paired_stats(
        indexed, PITCH_CANDIDATE, CONTROL, dev.primary_metric
    )
    pitch_critical = dev.paired_stats(
        indexed, PITCH_CANDIDATE, CONTROL, dev.pitch_metric
    )
    support = {
        "tuple_midi": tuple_primary["effect"] >= -DECISION_MARGIN,
        "object_pc_register": (
            pitch_critical["effect"] >= PITCH_IMPROVEMENT
            and pitch_primary["effect"] >= -DECISION_MARGIN
        ),
    }
    efficiency = {}
    for arm in ARMS:
        rows = [row for row in run["results"] if row["arm"] == arm]
        efficiency[arm] = {
            "input_tokens": sum(row["usage"]["input_tokens"] for row in rows),
            "output_bytes": sum(row.get("response_payload_bytes", 0) for row in rows),
        }
    return {
        "provider": run["provider"],
        "support": support,
        "contrasts": {
            "tuple_midi_primary": tuple_primary,
            "object_pc_register_primary": pitch_primary,
            "object_pc_register_pitch_critical": pitch_critical,
        },
        "efficiency": efficiency,
        "actual_cost_usd": run["actual_cost_usd"],
    }


def aggregate_signals(signals: list[dict[str, Any]]) -> dict[str, Any]:
    supporting = {
        key: sum(signal["support"][key] for signal in signals)
        for key in signals[0]["support"]
    }
    compactness = dev.compactness_screen()
    capabilities = dev.capability_screen()
    tuple_pass = (
        supporting["tuple_midi"] >= MINIMUM_SUPPORTING_PROVIDERS
        and compactness["midi"]["gate"]
        and capabilities["json_gate"]
    )
    pitch_pass = (
        supporting["object_pc_register"] >= MINIMUM_SUPPORTING_PROVIDERS
        and capabilities["json_gate"]
    )
    selected = []
    if pitch_pass:
        selected.append(PITCH_CANDIDATE)
    if tuple_pass:
        selected.append(TUPLE_CANDIDATE)
    return {
        "decision": "select-for-phase8c3" if selected else "do-not-select",
        "selected_candidates": selected,
        "full_capability_fallback": CONTROL,
        "supporting_providers": supporting,
        "candidate_gates": {
            PITCH_CANDIDATE: pitch_pass,
            TUPLE_CANDIDATE: tuple_pass,
        },
        "compactness": compactness,
        "capabilities": capabilities,
    }


def summarize_runs(runs: list[dict[str, Any]]) -> dict[str, Any]:
    if {run["provider"] for run in runs} != set(PROVIDERS):
        raise ValueError("Holdout needs one complete run from each provider")
    expected = protocol_manifest()["sha256"]
    if any(run["protocol_sha256"] != expected or not run["complete"] for run in runs):
        raise ValueError("Holdout runs must be complete and use one protocol")
    signals = [provider_signal(run) for run in runs]
    value = {
        "schema": SCHEMA,
        "run_id": RUN_ID,
        "selection_authority": (
            "Holdout can select frozen experimental cells for Phase 8c3 or reject them."
        ),
        **aggregate_signals(signals),
        "providers": signals,
        "actual_cost_usd": {
            **{run["provider"]: run["actual_cost_usd"] for run in runs},
            "total": round(sum(run["actual_cost_usd"] for run in runs), 6),
        },
        "repairs": [],
        "protocol_sha256": expected,
    }
    value["sha256"] = core.digest(value)
    return value


def package_file_sha256() -> dict[str, str]:
    names = (
        "core.py",
        "calibration_r2.py",
        "calibration_r3.py",
        "development.py",
        "holdout.py",
        "SCHEMAS.md",
        "HOLDOUT.md",
        "development-cohort-manifest.json",
    )
    return {
        name: hashlib.sha256((PACKAGE_ROOT / name).read_bytes()).hexdigest()
        for name in names
    }


def protocol_manifest() -> dict[str, Any]:
    run_jobs = jobs()
    authority = development_authority()
    value = {
        "schema": SCHEMA,
        "kind": "fresh-targeted-holdout",
        "run_id": RUN_ID,
        "arms": list(ARMS),
        "control": CONTROL,
        "experimental_candidates": [PITCH_CANDIDATE, TUPLE_CANDIDATE],
        "native_candidate": None,
        "family": FAMILY,
        "providers": list(PROVIDERS),
        "models": MODELS,
        "settings": SETTINGS,
        "transport_audit": transport_audit(),
        "sample": {
            "fixtures": FIXTURES,
            "repeats": 1,
            "calls_per_arm_provider": FIXTURES,
            "calls_per_provider": len(run_jobs),
            "total_calls": len(run_jobs) * len(PROVIDERS),
            "smallest_primary_step": round(1 / FIXTURES, 6),
        },
        "gate": {
            "tuple_non_inferiority_margin": DECISION_MARGIN,
            "pitch_critical_improvement": PITCH_IMPROVEMENT,
            "maximum_primary_regression": DECISION_MARGIN,
            "minimum_supporting_providers": MINIMUM_SUPPORTING_PROVIDERS,
            "control_cannot_select_by_itself": True,
        },
        "terminal_decisions": {
            "experimental_candidate_pass": "select-for-phase8c3",
            "all_experimental_candidates_fail": "do-not-select",
        },
        "development_authority": authority,
        "holdout_corpus_sha256": dev.make_corpus("holdout-r1")["sha256"],
        "cohort_audit_sha256": dev.corpus_audit()["sha256"],
        "scorer_sha256": dev.protocol_manifest()["scorer_sha256"],
        "package_file_sha256": package_file_sha256(),
        "prompt_sha256": {
            f'{job["arm"]}:{job["family"]}:{job["variant"]}:0': core.sha256_text(
                prompt_for(job["arm"], job["task"])
            )
            for job in run_jobs
        },
        "randomization": {
            "method": "Shuffle all isolated calls before dispatch.",
            "seed": SEED,
        },
        "privacy": dev.protocol_manifest()["privacy"],
        "repair_policy": "Do not repair responses or revise a candidate after holdout calls.",
        "allowed_follow_up": (
            "Summarize this fixed holdout. Do not rerun or revise a candidate from its result."
        ),
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    calls = protocol["sample"]["calls_per_provider"]
    estimates = {
        provider: {
            "calls": calls,
            "estimated_cost_usd": round(
                calls * DEVELOPMENT_MEAN_CALL_COST_USD[provider] * 1.25, 6
            ),
        }
        for provider in PROVIDERS
    }
    value = {
        "schema": SCHEMA,
        "run_kind": "targeted-holdout-plan",
        "run_id": RUN_ID,
        "approval": {
            "status": "pending",
            "requirement": (
                "Get separate explicit operator approval for this exact holdout before any provider call."
            ),
        },
        "scope": {
            "arms": list(ARMS),
            "family": FAMILY,
            "fixtures": FIXTURES,
            "repeats": 1,
            "providers": list(PROVIDERS),
        },
        "models": MODELS,
        "settings": SETTINGS,
        "expected_calls": {
            **{provider: calls for provider in PROVIDERS},
            "total": calls * len(PROVIDERS),
        },
        "cost_estimate": {
            "basis": COST_BASIS,
            "providers": estimates,
            "total_usd": round(
                sum(value["estimated_cost_usd"] for value in estimates.values()), 6
            ),
        },
        "development_summary_sha256": DEVELOPMENT_SUMMARY_SHA256,
        "development_report_sha256": DEVELOPMENT_REPORT_SHA256,
        "holdout_corpus_sha256": protocol["holdout_corpus_sha256"],
        "cohort_audit_sha256": protocol["cohort_audit_sha256"],
        "scorer_sha256": protocol["scorer_sha256"],
        "protocol_sha256": protocol["sha256"],
        "transport_audit_sha256": protocol["transport_audit"]["sha256"],
        "stopping_rule": (
            "Run the fixed 60 calls on each provider. Do not revise a candidate from the result."
        ),
        "allowed_follow_up": protocol["allowed_follow_up"],
    }
    value["sha256"] = core.digest(value)
    return value


def validate_approval(path: Path) -> dict[str, Any]:
    value = load(path)
    plan = run_plan()
    if (
        value.get("run_id") != RUN_ID
        or value.get("protocol_sha256") != plan["protocol_sha256"]
        or value.get("run_plan_sha256") != plan["sha256"]
    ):
        raise ValueError("The approval does not match the frozen holdout plan")
    if value.get("status") != "approved" or not value.get("operator_statement"):
        raise ValueError("Holdout approval needs an explicit operator statement")
    return value


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
            "latency_ms": 0,
            "retries": 3,
        }


def execute_jobs(provider: str, key: str, workers: int) -> list[dict[str, Any]]:
    ordered = jobs()
    random.Random(SEED).shuffle(ordered)
    result = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(call_job, provider, key, job) for job in ordered]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            result.append(future.result())
            if index % 10 == 0:
                print(
                    f"{provider}: completed {index}/{len(futures)} holdout calls",
                    file=sys.stderr,
                    flush=True,
                )
    return sorted(result, key=lambda value: (value["arm"], value["variant"]))


def run_provider(
    provider: str, env_file: Path, approval_file: Path, workers: int
) -> dict[str, Any]:
    approval = validate_approval(approval_file)
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise ValueError("The holdout deterministic screen failed")
    environment = core.v3.v2.load_env(env_file)
    key = environment.get(core.v3.v2.KEYS[provider])
    if not key:
        raise ValueError(f"{core.v3.v2.KEYS[provider]} is missing")
    results = execute_jobs(provider, key, workers)
    value = {
        "schema": SCHEMA,
        "run_kind": "targeted-holdout-provider",
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
        "complete": len(results) == 60 and all(
            "transport_error" not in row for row in results
        ),
    }
    value["raw_run_sha256"] = core.digest(
        [row.get("raw_response_sha256") for row in results]
    )
    value["manifest_sha256"] = core.digest(value)
    return value


def synthetic_signal(provider: str, passing: bool) -> dict[str, Any]:
    return {
        "provider": provider,
        "support": {
            "tuple_midi": passing,
            "object_pc_register": passing,
        },
    }


def deterministic_screen() -> dict[str, Any]:
    authority = development_authority()
    audit = dev.corpus_audit()
    positives = []
    negatives = []
    prompts = []
    for job in jobs():
        payload = dev.r2.perfect_payload(job["arm"], job["task"])
        positives.append(score_response(job["arm"], job["task"], payload)["primary_pass"])
        notes = core.v3.perfect_progression(job["task"]["contract"])
        changed = deepcopy(notes)
        changed[0]["pitch"] += 1
        bad = core.render_events(job["arm"], changed, job["task"], job["task"]["id"])
        negatives.append(not score_response(job["arm"], job["task"], bad)["primary_pass"])
        prompts.append(job["task"]["sha256"] in prompt_for(job["arm"], job["task"]))
    passing = aggregate_signals(
        [synthetic_signal(provider, True) for provider in PROVIDERS]
    )
    failing = aggregate_signals(
        [synthetic_signal(provider, False) for provider in PROVIDERS]
    )
    mixed = aggregate_signals(
        [
            synthetic_signal("openai", True),
            synthetic_signal("gemini", True),
            synthetic_signal("claude", False),
        ]
    )
    value = {
        "schema": SCHEMA,
        "development_authority": authority,
        "cohort_audit": audit,
        "transport_audit": transport_audit(),
        "contract_screen": {
            "positive": all(positives),
            "negative": all(negatives),
            "prompts": all(prompts),
        },
        "aggregation_screen": {
            "passing": passing["decision"],
            "failing": failing["decision"],
            "two_provider_support": mixed["decision"],
        },
        "resolution": {
            "fixtures": FIXTURES,
            "smallest_primary_step": round(1 / FIXTURES, 6),
            "maximum_allowed_step": 0.05,
        },
        "call_count": len(jobs()),
    }
    holdout = audit["cohorts"]["holdout-r1"]
    value["all_checks_pass"] = (
        authority["candidates"] == list(ARMS)
        and holdout["prior_semantic_overlap"] == 0
        and holdout["internal_semantic_duplicates"] == 0
        and audit["pairwise"]
        == {"fixture_hash_overlap": 0, "semantic_hash_overlap": 0}
        and value["transport_audit"]["exact_match"]
        and all(value["contract_screen"].values())
        and passing["decision"] == "select-for-phase8c3"
        and failing["decision"] == "do-not-select"
        and mixed["decision"] == "select-for-phase8c3"
        and value["resolution"]["smallest_primary_step"]
        <= value["resolution"]["maximum_allowed_step"]
        and len(jobs()) == 60
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
        "holdout_corpus_sha256": value["protocol"]["holdout_corpus_sha256"],
        "cohort_audit_sha256": value["protocol"]["cohort_audit_sha256"],
        "transport_audit_sha256": value["protocol"]["transport_audit"]["sha256"],
        "sha256": value["sha256"],
    }


def self_test() -> dict[str, Any]:
    value = deterministic_package()
    assert value["screen"]["all_checks_pass"]
    assert value["protocol"]["sample"]["calls_per_provider"] == 60
    assert value["run_plan"]["expected_calls"]["total"] == 180
    assert value["run_plan"]["cost_estimate"]["total_usd"] == 4.464634
    pending = RUNS_ROOT / "holdout-r1-approval.json"
    try:
        validate_approval(pending)
    except ValueError as error:
        assert "explicit operator statement" in str(error)
    else:
        raise AssertionError("The pending holdout approval was accepted")
    return {
        "schema": SCHEMA,
        "pass": True,
        "checks": FIXTURES * len(ARMS) * 3 + 12,
        "holdout_corpus_sha256": value["protocol"]["holdout_corpus_sha256"],
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
        expected = load(args.check)
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
        value = summarize_runs([load(path) for path in args.summarize])
    write(value, args.output)


if __name__ == "__main__":
    main()
