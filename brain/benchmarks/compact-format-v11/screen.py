#!/usr/bin/env python3
"""Run the small Phase 8c4c prompt-repair adjudication screen."""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import platform
import random
import sys
import time
from collections import Counter
from copy import deepcopy
from decimal import Decimal
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
V10_ROOT = PACKAGE_ROOT.parent / "compact-format-v10"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


base = load_module("ghostnote_compact_format_v11_base", V10_ROOT / "benchmark.py")
core = base.core
transport = base.transport

SCHEMA = "ghostnote-compact-format-prompt-screen-v11"
RUN_ID = "phase8c4c-compact-bar-prompt-screen-r1"
PROVIDERS = base.PROVIDERS
MODELS = base.MODELS
KEYS = base.KEYS
SETTINGS = base.SETTINGS
ARMS = core.ARMS
REPEATS = (1, 2)
CASES = (
    ("input-comprehension", "comprehension-analysis", 27),
    ("input-comprehension", "comprehension-analysis", 29),
    ("output-serialization", "generation-progression", 27),
    ("output-serialization", "continuation-roles", 27),
)
MAXIMUM_CALLS = len(ARMS) * len(REPEATS) * len(CASES)
MAXIMUM_TOKEN_COUNT_REQUESTS = MAXIMUM_CALLS
PROVIDER_COST_LIMITS = {
    "openai": Decimal("0.30"),
    "gemini": Decimal("0.20"),
    "claude-haiku": Decimal("0.75"),
}
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "screen-r1-approval.json"
DEPENDENCIES = (
    V10_ROOT / "benchmark.py",
    V10_ROOT / "runs" / "2026-09-28-development-summary.json",
    PACKAGE_ROOT.parent / "compact-format-v6" / "core.py",
)
RECOVERY_RULES = (
    "remove-invented-line-column",
    "remove-copied-end-marker",
    "restore-literal-none-base",
    "restore-analysis-prefix",
)


def task_index() -> dict[tuple[str, int], dict[str, Any]]:
    corpus = base.make_corpus("development-r1")
    return {
        (family, task["variant"]): task
        for family, tasks in corpus["fixtures"].items()
        for task in tasks
    }


def jobs() -> list[dict[str, Any]]:
    tasks = task_index()
    return [
        {
            "mode": mode,
            "family": family,
            "variant": variant,
            "arm": arm,
            "repeat": repeat,
            "task": tasks[(family, variant)],
        }
        for mode, family, variant in CASES
        for arm in ARMS
        for repeat in REPEATS
    ]


def output_grammar(arm: str, family: str) -> str:
    if family == "comprehension-analysis":
        return core.output_grammar(arm, family)
    if arm != "compact-bar-fields":
        return core.output_grammar(arm, family)
    return (
        "Return BASE, SOURCE, and the fixed OMITS header. Then return optional "
        "overlay rows and one N row per note. Overlays only refer to event IDs "
        "and never repeat note values. Include this exact row verbatim:\n"
        "FIELDS id voice start duration pitch velocity\n"
        "Each N row has exactly six values after N: id, voice, start, duration, "
        "pitch, and velocity. Do not add an index or line-number column."
    )


def output_context_instruction(arm: str, task: dict[str, Any]) -> str:
    base_value, source_id = core.expected_output_context(task)
    if arm == "exact-object-json":
        return (
            f'Use the exact string value "{base_value}" for base_sha256 and '
            f'the exact string value "{source_id}" for source_id. Return the '
            "fixed omissions and empty overlays."
        )
    return (
        "Use these exact header rows:\n"
        f"BASE {base_value}\n"
        f"SOURCE {source_id}\n"
        "OMITS channel mute release_velocity articulation expression\n"
        "The word after BASE is a literal value. Do not leave it blank. Return "
        "empty overlays."
    )


def prompt_for(job: dict[str, Any]) -> str:
    arm = job["arm"]
    task = job["task"]
    family = job["family"]
    if job["mode"] == "input-comprehension":
        representation = (
            f"Input representation: {arm}. This label describes only the input "
            "document. The required output is the ANALYSIS row below, not an "
            f"output document in the {arm} format."
        )
    else:
        representation = f"Output representation: {arm}."
    parts = [
        "Complete one deterministic symbolic-music task.",
        "Return one JSON object with exactly one string field named payload. "
        "Put the requested representation in that string. Do not add prose.",
        representation,
        output_grammar(arm, family),
        "Follow this complete output example, but use the task values:\n"
        + core.output_example(arm, family),
        core.task_instruction(task),
    ]
    if job["mode"] == "output-serialization":
        parts.append(output_context_instruction(arm, task))
    else:
        source = core.represented_source(arm, task)
        if source is None:
            raise ValueError("An input-comprehension task needs a source document")
        parts.extend(("<input_document>", source, "</input_document>"))
    return "\n\n".join(parts)


def recover_payload(
    arm: str, task: dict[str, Any], payload: str
) -> tuple[str, list[str]]:
    """Apply only the predeclared mechanical diagnostic recoveries."""
    lines = payload.splitlines()
    rules: list[str] = []
    if arm == "compact-bar-fields" and any(
        line.strip() == "FIELDS id voice start duration pitch velocity line"
        for line in lines
    ):
        candidate = []
        changed = False
        for line in lines:
            stripped = line.strip()
            if stripped == "FIELDS id voice start duration pitch velocity line":
                candidate.append("FIELDS id voice start duration pitch velocity")
                changed = True
            elif stripped.startswith("N ") and len(stripped.split()) == 8:
                candidate.append(" ".join(stripped.split()[:-1]))
                changed = True
            else:
                candidate.append(line)
        if changed:
            lines = candidate
            rules.append("remove-invented-line-column")
    if lines and lines[-1].strip() in {"END", "END SOURCE", "</input_document>"}:
        lines = lines[:-1]
        rules.append("remove-copied-end-marker")
    expected_base, _ = core.expected_output_context(task)
    if expected_base == "none" and any(line.strip() == "BASE" for line in lines):
        lines = ["BASE none" if line.strip() == "BASE" else line for line in lines]
        rules.append("restore-literal-none-base")
    recovered = "\n".join(lines).strip()
    if task["family"] == "comprehension-analysis" and recovered.startswith(
        "chord_ids="
    ):
        recovered = "ANALYSIS " + recovered
        rules.append("restore-analysis-prefix")
    return recovered, rules


def diagnostic_recovery(
    arm: str, task: dict[str, Any], payload: str, strict: dict[str, Any]
) -> dict[str, Any]:
    recovered, rules = recover_payload(arm, task, payload)
    if not rules:
        return {
            "applied": [],
            "payload_changed": False,
            "score": strict,
        }
    return {
        "applied": rules,
        "payload_changed": recovered != payload,
        "score": core.score_response(arm, task, recovered),
        "recovered_payload_sha256": core.sha256_text(recovered),
    }


class CostBudgetExceeded(RuntimeError):
    """Stop before the approved provider budget can be exceeded."""


class CostGuard:
    def __init__(self, provider: str) -> None:
        self.provider = provider
        self.message_attempts = 0
        self.token_count_attempts = 0
        self.settled_cost = Decimal(0)
        self.committed_cost = Decimal(0)
        self.failed_reservations = 0

    def authorize_token_count(self) -> None:
        if self.provider != "claude-haiku":
            raise RuntimeError("Only Haiku uses token counting")
        if self.token_count_attempts >= MAXIMUM_TOKEN_COUNT_REQUESTS:
            raise RuntimeError("The token-count request limit is exhausted")
        self.token_count_attempts += 1

    def validate_token_count(self, input_tokens: int) -> None:
        if input_tokens + base.TOKEN_COUNT_MARGIN > base.INPUT_TOKEN_CEILING:
            raise RuntimeError("The input-token cost ceiling is exceeded")

    def check_message_capacity(self, payload_bytes: int) -> None:
        if payload_bytes > base.REQUEST_BYTE_CEILING:
            raise RuntimeError("The request-byte ceiling is exceeded")
        if self.message_attempts >= MAXIMUM_CALLS:
            raise RuntimeError("The message-call limit is exhausted")
        if (
            self.committed_cost + base.maximum_call_cost(self.provider)
            > PROVIDER_COST_LIMITS[self.provider]
        ):
            raise CostBudgetExceeded("The approved cost ceiling would be exceeded")

    def authorize_message(self, payload_bytes: int) -> Decimal:
        self.check_message_capacity(payload_bytes)
        reservation = base.maximum_call_cost(self.provider)
        self.message_attempts += 1
        self.committed_cost += reservation
        return reservation

    def settle(
        self, reservation: Decimal, measured: dict[str, int], actual: Decimal
    ) -> None:
        if measured["input_tokens"] > base.INPUT_TOKEN_CEILING:
            raise RuntimeError("Measured input tokens exceed the cost bound")
        if measured["output_tokens"] > base.output_token_limit(self.provider):
            raise RuntimeError("Measured output tokens exceed the request bound")
        if actual > reservation:
            raise RuntimeError("Measured call cost exceeds its reservation")
        self.settled_cost += actual
        self.committed_cost = self.committed_cost - reservation + actual

    def retain_failed_reservation(self) -> None:
        self.failed_reservations += 1

    def snapshot(self) -> dict[str, Any]:
        return {
            "message_attempts": self.message_attempts,
            "token_count_attempts": self.token_count_attempts,
            "settled_cost_usd": base.rounded_usd(self.settled_cost),
            "settled_exact_usd": base.exact_usd(self.settled_cost),
            "committed_cost_usd": base.rounded_usd(self.committed_cost),
            "committed_exact_usd": base.exact_usd(self.committed_cost),
            "failed_reservations": self.failed_reservations,
            "maximum_cost_usd": base.rounded_usd(
                PROVIDER_COST_LIMITS[self.provider]
            ),
        }


def count_input_tokens(key: str, prompt: str, guard: CostGuard) -> int:
    guard.authorize_token_count()
    spec = base.count_spec(key, prompt)
    raw = transport.post_json(spec["url"], spec["headers"], spec["payload"])
    input_tokens = raw.get("input_tokens")
    if not isinstance(input_tokens, int) or input_tokens < 0:
        raise ValueError("The token-count response is invalid")
    guard.validate_token_count(input_tokens)
    return input_tokens


def one_call(
    provider: str,
    key: str,
    job: dict[str, Any],
    guard: CostGuard,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    prompt = prompt_for(job)
    payload_bytes = base.request_bytes(provider, prompt)
    guard.check_message_capacity(payload_bytes)
    input_estimate = (
        count_input_tokens(key, prompt, guard) if provider == "claude-haiku" else None
    )
    reservation = guard.authorize_message(payload_bytes)
    started = time.perf_counter()
    try:
        outer, raw = base.model_call(provider, key, prompt)
    except Exception:
        guard.retain_failed_reservation()
        raise
    latency_ms = (time.perf_counter() - started) * 1000
    transport_name = "claude" if provider == "claude-haiku" else provider
    measured = transport.usage(transport_name, raw)
    cost, exact_cost = base.cost_usd(provider, measured)
    guard.settle(reservation, measured, exact_cost)
    call = {
        "prompt_sha256": core.sha256_text(prompt),
        "prompt_bytes": len(prompt.encode()),
        "request_bytes": payload_bytes,
        "input_token_estimate": input_estimate,
        "input_token_ceiling": base.INPUT_TOKEN_CEILING,
        "cost_reservation_usd": base.exact_usd(reservation),
        "usage": measured,
        "cost_usd": cost,
        "latency_ms": round(latency_ms, 3),
        "retries": 0,
        "returned_model": transport.returned_model(transport_name, raw),
        "request_id": raw.get("id"),
        "stop_reason": transport.stop_reason(transport_name, raw),
        "raw_response_sha256": core.digest(raw),
    }
    if outer is None:
        return (
            core.result_state("unavailable", reason="output-limit"),
            call,
            {"applied": [], "payload_changed": False, "score": None},
        )
    payload = outer["payload"]
    call.update(
        {
            "response_payload": payload,
            "response_payload_bytes": len(payload.encode()),
            "response_payload_sha256": core.sha256_text(payload),
            "outer_schema_valid": outer["outer_schema_valid"],
        }
    )
    strict = core.score_response(job["arm"], job["task"], payload)
    if not outer["outer_schema_valid"]:
        strict = {
            "syntax_pass": False,
            "musical_pass": False,
            "primary_pass": False,
            "checks": {},
            "diagnostic": {
                "class": "parse",
                "error_type": "OuterSchema",
                "message": "The response envelope is invalid.",
            },
        }
        recovery = {"applied": [], "payload_changed": False, "score": strict}
    else:
        recovery = diagnostic_recovery(job["arm"], job["task"], payload, strict)
    return core.result_state("initial", strict), call, recovery


def result_for_job(
    provider: str, key: str, job: dict[str, Any], guard: CostGuard
) -> dict[str, Any]:
    common = {
        "mode": job["mode"],
        "family": job["family"],
        "variant": job["variant"],
        "arm": job["arm"],
        "repeat": job["repeat"],
        "task_sha256": job["task"]["sha256"],
        "semantic_sha256": job["task"]["semantic_sha256"],
    }
    try:
        initial, call, recovery = one_call(provider, key, job, guard)
    except Exception as error:
        initial = core.result_state("failed", reason=f"{type(error).__name__}: {error}")
        call = None
        recovery = {"applied": [], "payload_changed": False, "score": None}
    return {**common, "initial": initial, "initial_call": call, "recovery": recovery}


def package_files() -> dict[str, str]:
    return {
        name: base.file_sha256(PACKAGE_ROOT / name)
        for name in ("screen.py", "README.md", "PROTOCOL.md")
    }


def dependency_files() -> dict[str, str]:
    return {str(path.relative_to(PACKAGE_ROOT.parent)): base.file_sha256(path) for path in DEPENDENCIES}


def prompt_manifest() -> list[dict[str, Any]]:
    return [
        {
            "mode": job["mode"],
            "family": job["family"],
            "variant": job["variant"],
            "arm": job["arm"],
            "repeat": job["repeat"],
            "task_sha256": job["task"]["sha256"],
            "prompt_sha256": core.sha256_text(prompt_for(job)),
        }
        for job in jobs()
    ]


def protocol_manifest() -> dict[str, Any]:
    value = {
        "schema": SCHEMA,
        "run_kind": "prompt-repair-screen-protocol",
        "run_id": RUN_ID,
        "source_protocol_sha256": base.protocol_manifest()["sha256"],
        "package_files": package_files(),
        "dependency_files": dependency_files(),
        "cases": [
            {"mode": mode, "family": family, "variant": variant}
            for mode, family, variant in CASES
        ],
        "arms": list(ARMS),
        "repeats": list(REPEATS),
        "prompts": prompt_manifest(),
        "models": MODELS,
        "settings": SETTINGS,
        "calls": {
            "maximum_per_provider": MAXIMUM_CALLS,
            "maximum_all_providers": MAXIMUM_CALLS * len(PROVIDERS),
            "repairs": 0,
            "maximum_haiku_token_count_requests": MAXIMUM_TOKEN_COUNT_REQUESTS,
        },
        "cost_guard": {
            "maximum_provider_cost_usd": {
                provider: base.rounded_usd(PROVIDER_COST_LIMITS[provider])
                for provider in PROVIDERS
            },
            "maximum_total_cost_usd": base.rounded_usd(
                sum(PROVIDER_COST_LIMITS.values(), Decimal(0))
            ),
            "maximum_call_cost_usd": {
                provider: base.rounded_usd(base.maximum_call_cost(provider))
                for provider in PROVIDERS
            },
            "input_token_ceiling_per_call": base.INPUT_TOKEN_CEILING,
            "output_token_ceiling_per_call": 12000,
            "request_byte_ceiling_per_call": base.REQUEST_BYTE_CEILING,
        },
        "recovery_rules": list(RECOVERY_RULES),
        "reporting": {
            "strict_result": "The exact public grammar result.",
            "recoverable_result": "A diagnostic score after only the predeclared mechanical recoveries.",
            "repeats": "Report both independent initial samples. Do not replace either result.",
        },
        "interpretation": (
            "This diagnostic screen cannot select a format or enter a holdout. "
            "Inspect strict syntax, strict full-pass, recoverable, and repeat "
            "results separately."
        ),
        "provider_retry": "Do not retry a token-count or message request.",
        "privacy": "Generated MIT symbolic text only. Do not send live project, audio, or MIDI data.",
        "approval_boundary": "No token-count or provider request is approved until the operator approves the exact run-plan hash.",
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    value = {
        "schema": SCHEMA,
        "run_kind": "prompt-repair-screen-plan",
        "run_id": RUN_ID,
        "protocol_sha256": protocol["sha256"],
        "models": MODELS,
        "settings": SETTINGS,
        "cases": protocol["cases"],
        "arms": protocol["arms"],
        "repeats": protocol["repeats"],
        "calls": protocol["calls"],
        "cost_guard": protocol["cost_guard"],
        "recovery_rules": protocol["recovery_rules"],
        "interpretation": protocol["interpretation"],
        "approval": "pending",
    }
    value["sha256"] = core.digest(value)
    return value


def deterministic_screen() -> dict[str, Any]:
    all_jobs = jobs()
    prompts = [prompt_for(job) for job in all_jobs]
    fields_prompts = [
        prompt_for(job) for job in all_jobs if job["arm"] == "compact-bar-fields"
    ]
    request_sizes = {
        provider: max(base.request_bytes(provider, prompt) for prompt in prompts)
        for provider in PROVIDERS
    }
    tasks = task_index()
    progression = tasks[("generation-progression", 27)]
    perfect_fields = core.perfect_payload("compact-bar-fields", progression)
    broken_lines = []
    for line in perfect_fields.splitlines():
        if line == "FIELDS id voice start duration pitch velocity":
            broken_lines.append(line + " line")
        elif line.startswith("N "):
            broken_lines.append(line + " 1")
        else:
            broken_lines.append(line)
    recovered_fields, fields_rules = recover_payload(
        "compact-bar-fields", progression, "\n".join(broken_lines)
    )
    analysis = tasks[("comprehension-analysis", 29)]
    perfect_analysis = core.perfect_payload("compact-bar-fields", analysis)
    recovered_analysis, analysis_rules = recover_payload(
        "compact-bar-fields",
        analysis,
        perfect_analysis.removeprefix("ANALYSIS "),
    )
    guard = CostGuard("claude-haiku")
    guard.authorize_token_count()
    value = {
        "schema": SCHEMA,
        "job_count": len(all_jobs),
        "expected_job_count": MAXIMUM_CALLS,
        "case_count": len(CASES),
        "input_comprehension_cases": sum(mode == "input-comprehension" for mode, _, _ in CASES),
        "output_serialization_cases": sum(mode == "output-serialization" for mode, _, _ in CASES),
        "ambiguous_fields_phrase_absent": all(
            "FIELDS id voice start duration pitch velocity line" not in prompt
            for prompt in fields_prompts
        ),
        "exact_fields_row_present": all(
            "FIELDS id voice start duration pitch velocity\n" in prompt
            for prompt in fields_prompts
            if "comprehension-analysis" not in prompt
        ),
        "old_source_delimiter_absent": all("END SOURCE" not in prompt for prompt in prompts),
        "largest_request_bytes": request_sizes,
        "all_requests_fit": all(
            size <= base.REQUEST_BYTE_CEILING for size in request_sizes.values()
        ),
        "recovery_checks": {
            "invented_line_column": fields_rules
            == ["remove-invented-line-column"]
            and core.score_response(
                "compact-bar-fields", progression, recovered_fields
            )["primary_pass"],
            "analysis_prefix": analysis_rules == ["restore-analysis-prefix"]
            and core.score_response(
                "compact-bar-fields", analysis, recovered_analysis
            )["primary_pass"],
        },
        "failed_token_count_attempt_is_recorded": guard.token_count_attempts == 1,
        "dependency_files": dependency_files(),
    }
    value["all_checks_pass"] = all(
        (
            value["job_count"] == value["expected_job_count"],
            value["case_count"] == 4,
            value["input_comprehension_cases"] == 2,
            value["output_serialization_cases"] == 2,
            value["ambiguous_fields_phrase_absent"],
            value["exact_fields_row_present"],
            value["old_source_delimiter_absent"],
            value["all_requests_fit"],
            all(value["recovery_checks"].values()),
            value["failed_token_count_attempt_is_recorded"],
        )
    )
    value["sha256"] = core.digest(value)
    return value


def deterministic_manifest() -> dict[str, Any]:
    screen = deterministic_screen()
    protocol = protocol_manifest()
    plan = run_plan()
    return {
        "schema": SCHEMA,
        "screen_sha256": screen["sha256"],
        "protocol_sha256": protocol["sha256"],
        "run_plan_sha256": plan["sha256"],
        "job_count": screen["job_count"],
        "all_checks_pass": screen["all_checks_pass"],
        "sha256": core.digest(
            {
                "screen": screen["sha256"],
                "protocol": protocol["sha256"],
                "plan": plan["sha256"],
            }
        ),
    }


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    if (
        value.get("run_id") != RUN_ID
        or value.get("protocol_sha256") != plan["protocol_sha256"]
        or value.get("run_plan_sha256") != plan["sha256"]
    ):
        raise ValueError("Approval does not match the frozen prompt screen")
    if (
        value.get("status") != "approved"
        or not isinstance(value.get("operator_statement"), str)
        or not value["operator_statement"].strip()
    ):
        raise ValueError("Approval needs an explicit operator statement")
    return value


def execute_jobs(provider: str, key: str) -> tuple[list[dict[str, Any]], CostGuard]:
    ordered = jobs()
    random.Random(17171).shuffle(ordered)
    guard = CostGuard(provider)
    results = []
    for index, job in enumerate(ordered, start=1):
        results.append(result_for_job(provider, key, job, guard))
        print(
            f"{provider}: completed {index}/{len(ordered)} screen jobs",
            file=sys.stderr,
            flush=True,
        )
    return (
        sorted(
            results,
            key=lambda row: (
                row["mode"],
                row["family"],
                row["variant"],
                row["arm"],
                row["repeat"],
            ),
        ),
        guard,
    )


def run_provider(provider: str, env_file: Path, approval_file: Path) -> dict[str, Any]:
    approval = validate_approval(approval_file)
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise ValueError("The deterministic screen failed")
    environment = transport.load_env(env_file)
    key = environment.get(KEYS[provider])
    if not key:
        raise ValueError(f"Provider credential preflight failed: {KEYS[provider]}")
    results, guard = execute_jobs(provider, key)
    calls = [row["initial_call"] for row in results if row["initial_call"]]
    actual = sum(
        (Decimal(str(call["cost_usd"]["total"])) for call in calls), Decimal(0)
    )
    snapshot = guard.snapshot()
    if base.rounded_usd(actual) != snapshot["settled_cost_usd"]:
        raise AssertionError("The exact call sum and settled guard total differ")
    budget_stops = sum(
        row["initial"]["kind"] == "failed"
        and str(row["initial"].get("reason", "")).startswith("CostBudgetExceeded:")
        for row in results
    )
    transport_failures = sum(row["initial"]["kind"] == "failed" for row in results)
    protocol = protocol_manifest()
    value = {
        "schema": SCHEMA,
        "run_kind": "prompt-repair-screen-provider",
        "run_id": RUN_ID,
        "provider": provider,
        "requested_model": MODELS[provider],
        "settings": SETTINGS[provider],
        "client": "Python urllib.request direct HTTPS",
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "python": platform.python_version(),
        "protocol_sha256": protocol["sha256"],
        "screen_sha256": screen["sha256"],
        "run_plan_sha256": run_plan()["sha256"],
        "approval": approval,
        "results": results,
        "actual_calls": guard.message_attempts,
        "completed_calls": len(calls),
        "actual_cost_usd": base.rounded_usd(actual),
        "cost_guard": snapshot,
        "budget_stops": budget_stops,
        "transport_failures": transport_failures,
        "complete": len(results) == MAXIMUM_CALLS
        and budget_stops == 0
        and transport_failures == 0,
    }
    value["raw_run_sha256"] = core.digest(
        [call["raw_response_sha256"] for call in calls]
    )
    value["manifest_sha256"] = core.digest(value)
    return value


def load_manifest(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    unsigned = deepcopy(value)
    claimed = unsigned.pop("manifest_sha256", None)
    if claimed != core.digest(unsigned):
        raise ValueError(f"Manifest hash mismatch: {path}")
    provider = value.get("provider")
    if (
        provider not in PROVIDERS
        or value.get("run_id") != RUN_ID
        or value.get("run_kind") != "prompt-repair-screen-provider"
        or value.get("protocol_sha256") != protocol_manifest()["sha256"]
        or value.get("screen_sha256") != deterministic_screen()["sha256"]
        or value.get("run_plan_sha256") != run_plan()["sha256"]
        or value.get("requested_model") != MODELS[provider]
        or value.get("settings") != SETTINGS[provider]
        or len(value.get("results", [])) != MAXIMUM_CALLS
        or value.get("actual_calls", MAXIMUM_CALLS + 1) > MAXIMUM_CALLS
        or value.get("cost_guard", {}).get("token_count_attempts", 0)
        > MAXIMUM_TOKEN_COUNT_REQUESTS
        or value.get("cost_guard", {}).get("committed_cost_usd", math.inf)
        > base.rounded_usd(PROVIDER_COST_LIMITS[provider])
    ):
        raise ValueError(f"Manifest does not match the frozen prompt screen: {path}")
    expected = {
        (job["mode"], job["family"], job["variant"], job["arm"], job["repeat"])
        for job in jobs()
    }
    actual = {
        (row["mode"], row["family"], row["variant"], row["arm"], row["repeat"])
        for row in value["results"]
    }
    if actual != expected:
        raise ValueError(f"Manifest rows do not match the prompt screen: {path}")
    calls = [row["initial_call"] for row in value["results"] if row["initial_call"]]
    if any(call.get("returned_model") != MODELS[provider] for call in calls):
        raise ValueError(f"Manifest contains a different returned model: {path}")
    if (
        value.get("completed_calls") != len(calls)
        or value.get("actual_calls")
        != value.get("cost_guard", {}).get("message_attempts")
    ):
        raise ValueError(f"Manifest call accounting does not reconcile: {path}")
    exact_cost = sum(
        (Decimal(str(call["cost_usd"]["total"])) for call in calls), Decimal(0)
    )
    if (
        base.rounded_usd(exact_cost) != value.get("actual_cost_usd")
        or base.rounded_usd(exact_cost)
        != value.get("cost_guard", {}).get("settled_cost_usd")
        or value.get("raw_run_sha256")
        != core.digest([call["raw_response_sha256"] for call in calls])
    ):
        raise ValueError(f"Manifest cost or raw-run accounting does not reconcile: {path}")
    return value


def row_pass(row: dict[str, Any], recovered: bool) -> bool:
    if recovered:
        score = row["recovery"].get("score")
    else:
        score = row["initial"].get("score")
    return bool(score and score.get("primary_pass"))


def arm_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    strict_scores = [row["initial"].get("score") for row in rows]
    recovery_counts = Counter(
        rule for row in rows for rule in row["recovery"].get("applied", [])
    )
    return {
        "rows": len(rows),
        "scored": sum(score is not None for score in strict_scores),
        "strict_syntax_passes": sum(
            bool(score and score.get("syntax_pass")) for score in strict_scores
        ),
        "strict_full_passes": sum(row_pass(row, False) for row in rows),
        "recoverable_syntax_passes": sum(
            bool(
                row["recovery"].get("score")
                and row["recovery"]["score"].get("syntax_pass")
            )
            for row in rows
        ),
        "recoverable_full_passes": sum(row_pass(row, True) for row in rows),
        "recovery_rule_counts": dict(sorted(recovery_counts.items())),
    }


def repeat_summary(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    keys = sorted(
        {(row["mode"], row["family"], row["variant"], row["arm"]) for row in rows}
    )
    for mode, family, variant, arm in keys:
        pair = sorted(
            [
                row
                for row in rows
                if (
                    row["mode"],
                    row["family"],
                    row["variant"],
                    row["arm"],
                )
                == (mode, family, variant, arm)
            ],
            key=lambda row: row["repeat"],
        )
        result.append(
            {
                "mode": mode,
                "family": family,
                "variant": variant,
                "arm": arm,
                "same_strict_pass": len(pair) == 2
                and row_pass(pair[0], False) == row_pass(pair[1], False),
                "same_recoverable_pass": len(pair) == 2
                and row_pass(pair[0], True) == row_pass(pair[1], True),
                "same_payload": len(pair) == 2
                and (pair[0].get("initial_call") or {}).get(
                    "response_payload_sha256"
                )
                == (pair[1].get("initial_call") or {}).get(
                    "response_payload_sha256"
                ),
            }
        )
    return result


def summarize_runs(runs: list[dict[str, Any]]) -> dict[str, Any]:
    by_provider = {run["provider"]: run for run in runs}
    if set(by_provider) != set(PROVIDERS):
        raise ValueError("The summary needs all three provider manifests")
    providers = []
    exact_costs: dict[str, Decimal] = {}
    for provider in PROVIDERS:
        run = by_provider[provider]
        rows = run["results"]
        modes = {}
        for mode, _, _ in CASES:
            modes[mode] = {
                arm: arm_summary(
                    [row for row in rows if row["mode"] == mode and row["arm"] == arm]
                )
                for arm in ARMS
            }
        providers.append(
            {
                "provider": provider,
                "complete": run["complete"],
                "modes": modes,
                "repeats": repeat_summary(rows),
                "actual_calls": run["actual_calls"],
                "actual_cost_usd": run["actual_cost_usd"],
            }
        )
        exact_costs[provider] = sum(
            (
                Decimal(str(row["initial_call"]["cost_usd"]["total"]))
                for row in rows
                if row["initial_call"]
            ),
            Decimal(0),
        )
    costs = {
        provider: base.rounded_usd(exact_costs[provider]) for provider in PROVIDERS
    }
    costs["total"] = base.rounded_usd(sum(exact_costs.values(), Decimal(0)))
    value = {
        "schema": SCHEMA,
        "run_kind": "prompt-repair-screen-summary",
        "run_id": RUN_ID,
        "decision": "manual-adjudication",
        "selection_authority": "This screen cannot select a format or enter holdout.",
        "providers": providers,
        "actual_cost_usd": costs,
        "protocol_sha256": protocol_manifest()["sha256"],
    }
    value["sha256"] = core.digest(value)
    return value


def write_new(value: dict[str, Any], output: Path | None) -> None:
    text = json.dumps(value, indent=2, sort_keys=True) + "\n"
    if output is None:
        print(text, end="")
    else:
        if output.exists():
            raise FileExistsError(f"Refusing to replace: {output}")
        output.write_text(text)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--check", type=Path)
    parser.add_argument("--print-plan", action="store_true")
    parser.add_argument("--provider", choices=PROVIDERS)
    parser.add_argument(
        "--env-file", type=Path, default=PACKAGE_ROOT.parents[2] / ".env"
    )
    parser.add_argument("--approval-file", type=Path, default=APPROVAL_PATH)
    parser.add_argument("--output", type=Path)
    parser.add_argument(
        "--summarize",
        nargs=3,
        type=Path,
        metavar=("OPENAI", "GEMINI", "HAIKU"),
    )
    args = parser.parse_args()
    if args.self_test:
        screen = deterministic_screen()
        if not screen["all_checks_pass"]:
            raise SystemExit(json.dumps(screen, indent=2, sort_keys=True))
        print(json.dumps({"pass": True, **deterministic_manifest()}, indent=2, sort_keys=True))
        return
    if args.check:
        actual = deterministic_manifest()
        expected = json.loads(args.check.read_text())
        if actual != expected:
            raise SystemExit(
                "Deterministic mismatch\nexpected="
                + json.dumps(expected, sort_keys=True)
                + "\nactual="
                + json.dumps(actual, sort_keys=True)
            )
        print(json.dumps({"pass": True, **actual}, indent=2, sort_keys=True))
        return
    if args.print_plan:
        print(json.dumps(run_plan(), indent=2, sort_keys=True))
        return
    if args.provider:
        write_new(run_provider(args.provider, args.env_file, args.approval_file), args.output)
        return
    if args.summarize:
        write_new(
            summarize_runs([load_manifest(path) for path in args.summarize]), args.output
        )
        return
    print(json.dumps({"screen": deterministic_screen(), "protocol": protocol_manifest(), "plan": run_plan()}, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
