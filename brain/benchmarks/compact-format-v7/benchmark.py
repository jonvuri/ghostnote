#!/usr/bin/env python3
"""Run the Phase 8c4b Haiku provider substitution."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import importlib.util
import json
import platform
import random
import sys
import time
import urllib.error
from copy import deepcopy
from pathlib import Path
from typing import Any, Callable


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent
V6_ROOT = BENCHMARKS_ROOT / "compact-format-v6"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


core = load_module("ghostnote_compact_format_v7_core", V6_ROOT / "core.py")
transport = load_module(
    "ghostnote_compact_format_v7_transport",
    BENCHMARKS_ROOT / "compact-format-v2" / "benchmark.py",
)

SCHEMA = "ghostnote-compact-format-haiku-substitution-v7"
RUN_ID = "phase8c4b-analysis-haiku-calibration-r4"
COHORT = "calibration-easy"
PROVIDER = "claude-haiku"
MODEL = "claude-haiku-4-5-20251001"
KEY_NAME = "ANTHROPIC_API_KEY"
SETTINGS = {
    "thinking": {"type": "enabled", "budget_tokens": 1024},
    "max_tokens": 5000,
    "temperature": "provider default",
}
OUTER_SCHEMA = {
    "type": "object",
    "properties": {"payload": {"type": "string"}},
    "required": ["payload"],
    "additionalProperties": False,
}
ELIGIBILITY_BAND = {"minimum": 0.20, "maximum": 0.80, "minimum_providers": 2}
REPAIR_POLICY = {
    "maximum_turns": 1,
    "eligible": "Every available initial parse or musical-contract failure, including the named sentinel.",
    "feedback": "Return only the structured parse or failed-check diagnostic.",
    "primary_result": "Initial musical success only. A repair never replaces an initial result.",
    "unavailable_or_failed": "Do not repair and do not add to a scored denominator.",
}
PRICES_USD_PER_MILLION = {"input": 1.00, "cached_input": 0.10, "output": 5.00}
COST_BASIS = {
    "source": "Reprice the maximum observed Phase 8c4b r3 Sonnet easy-tier call at Haiku 4.5 rates.",
    "maximum_observed_repriced_call_usd": 0.012559,
    "contingency": 0.25,
    "price_verification_date": "2026-09-28",
    "price_source": "https://platform.claude.com/docs/en/about-claude/models/overview",
}
DEPENDENCY_FILES = {
    "compact-format-v6/core.py": "9150edfc2a2d0e873386508d406d9d92c29ca1fcf1ecd352f53fba3702d6280d",
    "compact-format-v6/cohort-manifest.json": "1c927d2957f9ca3249146d729debf69ff46d00e6a507b23c94063028ca3c9427",
    "compact-format-v6/expected-deterministic.json": "de97aebbfd1d8d74126cb8c607f4617d104f468a9a6c57416f240e6a222d0549",
    "compact-format-v6/runs/2026-09-28-analysis-gemini-easy.json": "3f406cd196dd9b8693ee15cd75dccd002a1e83db779021abd98cdf5912eee08b",
    "compact-format-v6/runs/2026-09-28-analysis-summary.json": "3eaf6f7926a8b73c1585ce2ad15a4d22e12434855817764161bdd7506b352f5f",
}
RETAINED = {
    "v6_protocol_sha256": "469fa3bf8c0d9c2b66c2fb8132b3bc942b90a4e39b84c2bd784a9395495e0f2c",
    "easy_corpus_sha256": "edd1f29d71d049d3f9bfda1915a62879d23143abc596053070441015a2607374",
    "gemini_manifest_sha256": "4931455793fa10ff25c7e541354328bbff342003d6fe51d99752e175bc663ef7",
    "gemini_raw_run_sha256": "b4cf34804b322f7c6c1bbb508e357b291a100850e88797f6eda0761df6a96d4a",
    "r3_summary_sha256": "73f343eb9bb675d688f2fffe118cf795f598b33130df0aab697d75c7372a9c72",
    "r2_summary_sha256": "e2b293e9e05c62d58e9c22748d5cdad0d38bfcd5ec456347c7a0f01a3a030017",
}
GEMINI_PATH = V6_ROOT / "runs" / "2026-09-28-analysis-gemini-easy.json"
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "calibration-r4-approval.json"


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def expect_rejected(action: Callable[[], Any]) -> bool:
    try:
        action()
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return True
    return False


def analysis_rows(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        row
        for row in results
        if row["arm"] == "exact-object-json"
        and row["family"] == "comprehension-analysis"
        and not row["sentinel"]
    ]


def analysis_gate(run: dict[str, Any]) -> dict[str, Any]:
    rows = analysis_rows(run["results"])
    scored = [row for row in rows if row["initial"]["kind"] == "initial" and row["initial"]["scored"]]
    passed = sum(bool(row["initial"]["score"]["primary_pass"]) for row in scored)
    complete = len(rows) == 5 and len(scored) == 5
    rate = passed / len(scored) if scored else None
    return {
        "passed": passed,
        "denominator": len(scored),
        "rate": rate,
        "complete": complete,
        "eligible": complete and rate is not None and ELIGIBILITY_BAND["minimum"] <= rate <= ELIGIBILITY_BAND["maximum"],
        "ceiling": complete and rate is not None and rate > ELIGIBILITY_BAND["maximum"],
        "floor": complete and rate is not None and rate < ELIGIBILITY_BAND["minimum"],
    }


def retained_gemini() -> dict[str, Any]:
    value = json.loads(GEMINI_PATH.read_text())
    unsigned = deepcopy(value)
    claimed = unsigned.pop("manifest_sha256", None)
    if claimed != RETAINED["gemini_manifest_sha256"] or core.digest(unsigned) != claimed:
        raise ValueError("The retained Gemini manifest hash changed")
    if value.get("run_id") != "phase8c4b-analysis-repair-calibration-r3":
        raise ValueError("The retained Gemini run ID changed")
    if value.get("protocol_sha256") != RETAINED["v6_protocol_sha256"]:
        raise ValueError("The retained Gemini protocol changed")
    if value.get("provider") != "gemini" or value.get("tier") != COHORT:
        raise ValueError("The retained Gemini provider or tier changed")
    if value.get("raw_run_sha256") != RETAINED["gemini_raw_run_sha256"]:
        raise ValueError("The retained Gemini raw-run hash changed")
    gate = analysis_gate(value)
    if gate != {
        "passed": 3,
        "denominator": 5,
        "rate": 0.6,
        "complete": True,
        "eligible": True,
        "ceiling": False,
        "floor": False,
    }:
        raise ValueError("The retained Gemini gate changed")
    return value


def dependency_manifest() -> dict[str, Any]:
    actual_files = {
        name: file_sha256(BENCHMARKS_ROOT / name)
        for name in DEPENDENCY_FILES
    }
    corpus = core.make_corpus(COHORT)
    gemini = retained_gemini()
    jobs = core.jobs(COHORT)
    prompt_hashes = {
        (row["variant"], row["sentinel"]): row["initial_call"]["prompt_sha256"]
        for row in gemini["results"]
    }
    value = {
        "schema": SCHEMA,
        "kind": "frozen-dependency-manifest",
        "files": actual_files,
        "files_match": actual_files == DEPENDENCY_FILES,
        "easy_corpus_sha256": corpus["sha256"],
        "easy_corpus_match": corpus["sha256"] == RETAINED["easy_corpus_sha256"],
        "gemini_manifest_sha256": gemini["manifest_sha256"],
        "gemini_gate": analysis_gate(gemini),
        "prompt_hashes_match": all(
            core.sha256_text(core.prompt_for(job["arm"], job["task"]))
            == prompt_hashes[(job["variant"], job["sentinel"])]
            for job in jobs
        ),
        "fixture_formulas_pass": all(
            all(core.analysis_fixture_checks(task).values())
            for task in corpus["fixtures"]["comprehension-analysis"]
        ),
        "reuse_rule": "Reuse the unchanged easy cohort only for a new model that has not received it. Do not rerun Gemini or Sonnet.",
    }
    value["sha256"] = core.digest(value)
    return value


def request_spec(key: str, prompt: str) -> dict[str, Any]:
    return {
        "url": "https://api.anthropic.com/v1/messages",
        "headers": {"x-api-key": key, "anthropic-version": "2023-06-01"},
        "payload": {
            "model": MODEL,
            "max_tokens": SETTINGS["max_tokens"],
            "thinking": SETTINGS["thinking"],
            "messages": [{"role": "user", "content": prompt}],
            "output_config": {"format": {"type": "json_schema", "schema": OUTER_SCHEMA}},
        },
    }


def transport_screen() -> dict[str, Any]:
    payload = request_spec("redacted", "probe")["payload"]
    actual = {
        "model": payload["model"],
        "max_tokens": payload["max_tokens"],
        "thinking": payload["thinking"],
        "structured_output": payload["output_config"]["format"],
        "effort_absent": "effort" not in payload["output_config"],
        "temperature_absent": "temperature" not in payload,
    }
    expected = {
        "model": MODEL,
        "max_tokens": 5000,
        "thinking": {"type": "enabled", "budget_tokens": 1024},
        "structured_output": {"type": "json_schema", "schema": OUTER_SCHEMA},
        "effort_absent": True,
        "temperature_absent": True,
    }
    return {"actual": actual, "expected": expected, "pass": actual == expected}


def contract_screen() -> dict[str, Any]:
    jobs = core.jobs(COHORT)
    positive = [
        core.score_response(job["arm"], job["task"], core.perfect_payload(job["arm"], job["task"]))["primary_pass"]
        for job in jobs
    ]
    negative = [
        not core.score_response(job["arm"], job["task"], "INVALID")["syntax_pass"]
        for job in jobs
    ]
    mutations = core.mutation_tests()
    return {
        "job_count": len(jobs),
        "unique_count": sum(not job["sentinel"] for job in jobs),
        "sentinel_count": sum(job["sentinel"] for job in jobs),
        "perfect_outputs_pass": all(positive),
        "invalid_outputs_rejected": all(negative),
        "focused_mutations_pass": all(row["pass"] for row in mutations),
        "focused_mutation_count": len(mutations),
    }


def synthetic_run(passed: int, unavailable: int = 0) -> dict[str, Any]:
    results = []
    unique_index = 0
    for job in core.jobs(COHORT):
        passing = unique_index < passed
        score = {
            "syntax_pass": True,
            "primary_pass": passing,
            "musical_pass": passing,
            "checks": {},
            "diagnostic": None if passing else {"class": "musical-contract", "failed_checks": ["synthetic"]},
        }
        state = core.result_state("initial", score)
        if not job["sentinel"] and unique_index >= 5 - unavailable:
            state = core.result_state("unavailable", reason="output-limit")
        results.append(
            {
                **{name: job[name] for name in ("arm", "family", "variant", "sentinel")},
                "initial": state,
                "repair": None,
            }
        )
        unique_index += not job["sentinel"]
    return {"provider": PROVIDER, "results": results}


def aggregation_screen() -> dict[str, Any]:
    eligible_low = analysis_gate(synthetic_run(1))
    eligible_high = analysis_gate(synthetic_run(4))
    floor = analysis_gate(synthetic_run(0))
    ceiling = analysis_gate(synthetic_run(5))
    incomplete = analysis_gate(synthetic_run(2, unavailable=1))
    return {
        "eligible_lower_boundary": eligible_low["eligible"],
        "eligible_upper_boundary": eligible_high["eligible"],
        "floor_detected": floor["floor"] and not floor["eligible"],
        "ceiling_detected": ceiling["ceiling"] and not ceiling["eligible"],
        "incomplete_rejected": not incomplete["complete"] and not incomplete["eligible"],
    }


def deterministic_screen() -> dict[str, Any]:
    dependencies = dependency_manifest()
    contracts = contract_screen()
    request = transport_screen()
    aggregation = aggregation_screen()
    value = {
        "dependencies": dependencies,
        "contracts": contracts,
        "request": request,
        "aggregation": aggregation,
        "all_checks_pass": dependencies["files_match"]
        and dependencies["easy_corpus_match"]
        and dependencies["prompt_hashes_match"]
        and dependencies["fixture_formulas_pass"]
        and contracts["job_count"] == 6
        and contracts["unique_count"] == 5
        and contracts["sentinel_count"] == 1
        and contracts["perfect_outputs_pass"]
        and contracts["invalid_outputs_rejected"]
        and contracts["focused_mutations_pass"]
        and request["pass"]
        and all(aggregation.values()),
    }
    value["sha256"] = core.digest(value)
    return value


def source_hashes() -> dict[str, str]:
    return {"benchmark.py": file_sha256(PACKAGE_ROOT / "benchmark.py")}


def protocol_manifest() -> dict[str, Any]:
    jobs = core.jobs(COHORT)
    dependency = dependency_manifest()
    value = {
        "schema": SCHEMA,
        "run_id": RUN_ID,
        "kind": "provider-substitution-protocol",
        "provider": PROVIDER,
        "model": MODEL,
        "settings": SETTINGS,
        "temperature": "Provider default. The request does not set temperature.",
        "arm": "exact-object-json",
        "decision_family": "comprehension-analysis",
        "cohort": COHORT,
        "cohort_sha256": RETAINED["easy_corpus_sha256"],
        "dependency_manifest_sha256": dependency["sha256"],
        "implementation_sha256": source_hashes(),
        "retained_gemini": {
            "manifest_sha256": RETAINED["gemini_manifest_sha256"],
            "raw_run_sha256": RETAINED["gemini_raw_run_sha256"],
            "gate": dependency["gemini_gate"],
            "new_calls": 0,
        },
        "calls": {
            "unique_initial": sum(not job["sentinel"] for job in jobs),
            "named_sentinel_initial": sum(job["sentinel"] for job in jobs),
            "initial": len(jobs),
            "maximum_repair": len(jobs),
            "maximum_total": len(jobs) * 2,
            "new_gemini": 0,
            "new_sonnet": 0,
            "new_openai": 0,
        },
        "eligibility_band": ELIGIBILITY_BAND,
        "stopping_rule": "Return analysis-repair-pass only when all five unique Haiku initial results are scored and the pass rate is 0.20 through 0.80. Otherwise return repair-measurement. Retain the frozen eligible Gemini r3 result.",
        "repair_policy": REPAIR_POLICY,
        "reuse_rule": dependency["reuse_rule"],
        "r2_dependency": {
            "summary_sha256": RETAINED["r2_summary_sha256"],
            "retained_eligibility": {"continuation-motif": 2, "generation-progression": 3},
            "rule": "Use the retained r2 motif and progression evidence only after analysis-repair-pass.",
        },
        "privacy": "Generated MIT symbolic text only. Do not send live project, audio, or MIDI data.",
        "provider_retry": "Retry only rate-limit, transport, and provider-server failures. Do not replace a valid low-scoring response.",
        "credential_preflight": "Require only ANTHROPIC_API_KEY after approval and dependency validation.",
        "approval_boundary": "No Haiku call is approved until the operator approves the exact run-plan hash.",
        "format_selection": None,
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    maximum_cost = round(
        protocol["calls"]["maximum_total"]
        * COST_BASIS["maximum_observed_repriced_call_usd"]
        * (1 + COST_BASIS["contingency"]),
        6,
    )
    value = {
        "schema": SCHEMA,
        "run_kind": "provider-substitution-plan",
        "run_id": RUN_ID,
        "protocol_sha256": protocol["sha256"],
        "dependency_manifest_sha256": protocol["dependency_manifest_sha256"],
        "provider": PROVIDER,
        "model": MODEL,
        "settings": SETTINGS,
        "calls": protocol["calls"],
        "maximum_calls": protocol["calls"]["maximum_total"],
        "estimated_maximum_cost_usd": maximum_cost,
        "cost_basis": COST_BASIS,
        "eligibility_band": ELIGIBILITY_BAND,
        "stopping_rule": protocol["stopping_rule"],
        "repair_policy": REPAIR_POLICY,
        "approval": "pending",
    }
    value["sha256"] = core.digest(value)
    return value


def deterministic_package() -> dict[str, Any]:
    value = {
        "schema": SCHEMA,
        "run_kind": "deterministic",
        "screen": deterministic_screen(),
        "protocol": protocol_manifest(),
        "run_plan": run_plan(),
    }
    value["sha256"] = core.digest(value)
    return value


def deterministic_manifest(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": value["schema"],
        "sha256": value["sha256"],
        "screen_sha256": value["screen"]["sha256"],
        "protocol_sha256": value["protocol"]["sha256"],
        "cohort_sha256": value["protocol"]["cohort_sha256"],
        "dependency_manifest_sha256": value["protocol"]["dependency_manifest_sha256"],
        "run_plan_sha256": value["run_plan"]["sha256"],
    }


def self_test() -> dict[str, Any]:
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise AssertionError("The deterministic screen failed")
    if run_plan()["maximum_calls"] != 12:
        raise AssertionError("The call limit changed")
    return {
        "schema": SCHEMA,
        "pass": True,
        "checks": screen["contracts"]["focused_mutation_count"] + 24,
        "cohort_sha256": RETAINED["easy_corpus_sha256"],
        "deterministic_sha256": deterministic_package()["sha256"],
    }


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    if value.get("run_id") != RUN_ID or value.get("protocol_sha256") != plan["protocol_sha256"] or value.get("run_plan_sha256") != plan["sha256"]:
        raise ValueError("Approval does not match the frozen Phase 8c4b Haiku plan")
    if value.get("status") != "approved" or not isinstance(value.get("operator_statement"), str) or not value["operator_statement"].strip():
        raise ValueError("Approval needs an explicit operator statement")
    return value


def cost_usd(measured: dict[str, int]) -> dict[str, float]:
    cached = measured["cached_input_tokens"]
    parts = {
        "uncached_input": max(0, measured["input_tokens"] - cached) * PRICES_USD_PER_MILLION["input"] / 1_000_000,
        "cached_input": cached * PRICES_USD_PER_MILLION["cached_input"] / 1_000_000,
        "output": measured["output_tokens"] * PRICES_USD_PER_MILLION["output"] / 1_000_000,
    }
    parts["total"] = sum(parts.values())
    return {name: round(value, 8) for name, value in parts.items()}


def model_call(key: str, prompt: str) -> tuple[dict[str, Any], dict[str, Any]]:
    spec = request_spec(key, prompt)
    raw = transport.post_json(spec["url"], spec["headers"], spec["payload"])
    text = "".join(block.get("text", "") for block in raw["content"] if block.get("type") == "text")
    return transport.parse_outer(text), raw


def call_with_retry(key: str, prompt: str) -> tuple[dict[str, Any], dict[str, Any], float, int]:
    retries = 0
    started = time.perf_counter()
    for delay in (0, 2, 4, 8):
        if delay:
            time.sleep(delay)
        try:
            outer, raw = model_call(key, prompt)
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


def one_call(key: str, prompt: str, task: dict[str, Any], arm: str, kind: str) -> tuple[dict[str, Any], dict[str, Any]]:
    outer, raw, latency_ms, retries = call_with_retry(key, prompt)
    measured = transport.usage("claude", raw)
    reason = transport.stop_reason("claude", raw)
    call = {
        "prompt_sha256": core.sha256_text(prompt),
        "prompt_bytes": len(prompt.encode()),
        "usage": measured,
        "cost_usd": cost_usd(measured),
        "latency_ms": round(latency_ms, 3),
        "retries": retries,
        "returned_model": transport.returned_model("claude", raw),
        "request_id": raw.get("id"),
        "stop_reason": reason,
        "raw_response_sha256": core.digest(raw),
    }
    if reason == "max_tokens":
        return core.result_state("unavailable", reason="output-limit"), call
    payload = outer["payload"]
    call.update(
        {
            "response_payload": payload,
            "response_payload_bytes": len(payload.encode()),
            "response_payload_sha256": core.sha256_text(payload),
            "outer_schema_valid": outer["outer_schema_valid"],
        }
    )
    score = core.score_response(arm, task, payload)
    if not outer["outer_schema_valid"]:
        score = {
            "syntax_pass": False,
            "musical_pass": False,
            "primary_pass": False,
            "checks": {},
            "diagnostic": {"class": "parse", "error_type": "OuterSchema", "message": "The response envelope is invalid."},
        }
    return core.result_state(kind, score), call


def call_job(key: str, job: dict[str, Any]) -> dict[str, Any]:
    prompt = core.prompt_for(job["arm"], job["task"])
    common = {
        "arm": job["arm"],
        "family": job["family"],
        "variant": job["variant"],
        "sentinel": job["sentinel"],
        "task_sha256": job["task"]["sha256"],
        "semantic_sha256": job["task"]["semantic_sha256"],
    }
    try:
        initial, initial_call = one_call(key, prompt, job["task"], job["arm"], "initial")
    except Exception as error:
        return {
            **common,
            "initial": core.result_state("failed", reason=f"{type(error).__name__}: {error}"),
            "initial_call": None,
            "repair": None,
            "repair_call": None,
        }
    repair = None
    repair_call = None
    if initial["kind"] == "initial" and not initial["score"]["primary_pass"]:
        try:
            repair, repair_call = one_call(
                key,
                core.repair_prompt(prompt, initial["score"]["diagnostic"]),
                job["task"],
                job["arm"],
                "repaired",
            )
        except Exception as error:
            repair = core.result_state("failed", reason=f"{type(error).__name__}: {error}")
    return {**common, "initial": initial, "initial_call": initial_call, "repair": repair, "repair_call": repair_call}


def execute_jobs(key: str, workers: int) -> list[dict[str, Any]]:
    jobs = core.jobs(COHORT)
    random.Random(8603).shuffle(jobs)
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(call_job, key, job) for job in jobs]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            results.append(future.result())
            if index == len(futures):
                print(f"haiku: completed {index}/{len(futures)} initial jobs", file=sys.stderr, flush=True)
    return sorted(results, key=lambda row: (row["arm"], row["family"], row["variant"], row["sentinel"]))


def run_provider(env_file: Path, approval_file: Path, workers: int) -> dict[str, Any]:
    approval = validate_approval(approval_file)
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise ValueError("The deterministic screen failed")
    gemini = retained_gemini()
    environment = transport.load_env(env_file)
    if not environment.get(KEY_NAME):
        raise ValueError(f"Provider credential preflight failed: {KEY_NAME}")
    results = execute_jobs(environment[KEY_NAME], workers)
    calls = [row.get("initial_call") for row in results] + [row.get("repair_call") for row in results]
    actual_calls = [value for value in calls if value is not None]
    value = {
        "schema": SCHEMA,
        "run_kind": "haiku-substitution-provider",
        "run_id": RUN_ID,
        "provider": PROVIDER,
        "cohort": COHORT,
        "requested_model": MODEL,
        "settings": SETTINGS,
        "client": "Python urllib.request direct HTTPS",
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "python": platform.python_version(),
        "privacy": protocol_manifest()["privacy"],
        "protocol_sha256": protocol_manifest()["sha256"],
        "screen_sha256": screen["sha256"],
        "run_plan_sha256": run_plan()["sha256"],
        "approval": approval,
        "retained_gemini_manifest_sha256": gemini["manifest_sha256"],
        "results": results,
        "actual_calls": len(actual_calls),
        "actual_cost_usd": round(sum(item["cost_usd"]["total"] for item in actual_calls), 6),
        "complete": len(results) == 6,
    }
    value["analysis_gate"] = analysis_gate(value)
    value["raw_run_sha256"] = core.digest([item["raw_response_sha256"] for item in actual_calls])
    value["manifest_sha256"] = core.digest(value)
    return value


def load_haiku_manifest(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    claimed = value.get("manifest_sha256")
    unsigned = deepcopy(value)
    unsigned.pop("manifest_sha256", None)
    if not isinstance(claimed, str) or core.digest(unsigned) != claimed:
        raise ValueError("The Haiku manifest hash is invalid")
    if value.get("run_id") != RUN_ID or value.get("protocol_sha256") != protocol_manifest()["sha256"]:
        raise ValueError("The Haiku manifest does not use the frozen protocol")
    if value.get("provider") != PROVIDER or value.get("requested_model") != MODEL:
        raise ValueError("The Haiku manifest has the wrong provider or model")
    return value


def summarize(path: Path) -> dict[str, Any]:
    haiku = load_haiku_manifest(path)
    gemini = retained_gemini()
    haiku_gate = analysis_gate(haiku)
    decision = "analysis-repair-pass" if haiku_gate["eligible"] else "repair-measurement"
    value = {
        "schema": SCHEMA,
        "run_kind": "haiku-substitution-summary",
        "run_id": RUN_ID,
        "decision": decision,
        "format_selection": None,
        "cohort": COHORT,
        "provider_gates": {"gemini": analysis_gate(gemini), PROVIDER: haiku_gate},
        "eligibility_band": ELIGIBILITY_BAND,
        "retained": RETAINED,
        "r2_dependency": "Use the retained r2 motif and progression eligibility only when analysis-repair-pass.",
    }
    value["sha256"] = core.digest(value)
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
    actions.add_argument("--dependencies", action="store_true")
    actions.add_argument("--run-plan", action="store_true")
    actions.add_argument("--check", type=Path)
    actions.add_argument("--provider", choices=("haiku",))
    actions.add_argument("--summarize", type=Path)
    parser.add_argument("--env-file", type=Path, default=Path("../.env"))
    parser.add_argument("--approval-file", type=Path, default=APPROVAL_PATH)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--output", type=Path)
    arguments = parser.parse_args()
    if arguments.self_test:
        write_result(self_test(), arguments.output)
    elif arguments.deterministic:
        write_result(deterministic_package(), arguments.output)
    elif arguments.dependencies:
        write_result(dependency_manifest(), arguments.output)
    elif arguments.run_plan:
        write_result(run_plan(), arguments.output)
    elif arguments.check:
        expected = json.loads(arguments.check.read_text())
        actual = deterministic_manifest(deterministic_package())
        if actual != expected:
            raise SystemExit("The deterministic package does not match the frozen manifest")
        print(json.dumps(actual, indent=2, sort_keys=True))
    elif arguments.provider:
        write_result(run_provider(arguments.env_file, arguments.approval_file, arguments.workers), arguments.output)
    else:
        write_result(summarize(arguments.summarize), arguments.output)


if __name__ == "__main__":
    main()
