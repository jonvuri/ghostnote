#!/usr/bin/env python3
"""Prepare and run the Phase 8c4c Gemini local-label diagnostic."""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import platform
import re
import sys
import time
from copy import deepcopy
from decimal import Decimal
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


v12 = load_module(
    "ghostnote_compact_format_v13_v12",
    BENCHMARKS_ROOT / "compact-format-v12" / "compare.py",
)
base = v12.base
core = v12.core
transport = v12.transport

SCHEMA = "ghostnote-compact-format-local-label-v13"
RUN_ID = "phase8c4c-local-label-gemini-r1"
PROVIDER = "gemini"
MODEL = v12.MODELS[PROVIDER]
SETTINGS = {**v12.SETTINGS[PROVIDER], "temperature": "provider default"}
KEY = v12.KEYS[PROVIDER]
ARMS = ("compact-bar-fields", "compact-bar-local-labels")
REPEATS = (1, 2, 3, 4)
CASES = (
    ("comprehension-analysis", 95),
    ("comprehension-analysis", 97),
    ("generation-progression", 92),
    ("generation-progression", 96),
)
MAXIMUM_CALLS = len(ARMS) * len(REPEATS) * len(CASES)
PROVIDER_COST_LIMIT = Decimal("0.15")
RECENT_COST_ESTIMATE = Decimal("0.065")
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "local-label-r1-approval.json"
DEPENDENCIES = (
    BENCHMARKS_ROOT / "compact-format-v6" / "core.py",
    BENCHMARKS_ROOT / "compact-format-v10" / "benchmark.py",
    BENCHMARKS_ROOT / "compact-format-v11" / "screen.py",
    BENCHMARKS_ROOT / "compact-format-v12" / "compare.py",
    BENCHMARKS_ROOT
    / "compact-format-v12"
    / "runs"
    / "2026-09-28-full-family-gemini.json",
)
LOCAL_NOTE_PATTERN = re.compile(
    r"N id=(\S+) voice=(\S+) start=(\S+) duration=(\S+) "
    r"pitch=(\d+) velocity=(\d+)"
)


class CostBudgetExceeded(RuntimeError):
    """Stop before the approved Gemini budget can be exceeded."""


class CostGuard:
    def __init__(self) -> None:
        self.message_attempts = 0
        self.settled_cost = Decimal(0)
        self.committed_cost = Decimal(0)
        self.failed_reservations = 0

    def check_capacity(self, payload_bytes: int) -> None:
        if payload_bytes > base.REQUEST_BYTE_CEILING:
            raise RuntimeError("The request-byte ceiling is exceeded")
        if self.message_attempts >= MAXIMUM_CALLS:
            raise RuntimeError("The message-call limit is exhausted")
        if (
            self.committed_cost + base.maximum_call_cost(PROVIDER)
            > PROVIDER_COST_LIMIT
        ):
            raise CostBudgetExceeded("The approved cost ceiling would be exceeded")

    def authorize(self, payload_bytes: int) -> Decimal:
        self.check_capacity(payload_bytes)
        reservation = base.maximum_call_cost(PROVIDER)
        self.message_attempts += 1
        self.committed_cost += reservation
        return reservation

    def settle(
        self, reservation: Decimal, measured: dict[str, int], actual: Decimal
    ) -> None:
        if measured["input_tokens"] > base.INPUT_TOKEN_CEILING:
            raise RuntimeError("Measured input tokens exceed the cost bound")
        if measured["output_tokens"] > base.output_token_limit(PROVIDER):
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
            "settled_cost_usd": base.rounded_usd(self.settled_cost),
            "settled_exact_usd": base.exact_usd(self.settled_cost),
            "committed_cost_usd": base.rounded_usd(self.committed_cost),
            "committed_exact_usd": base.exact_usd(self.committed_cost),
            "failed_reservations": self.failed_reservations,
            "maximum_cost_usd": base.rounded_usd(PROVIDER_COST_LIMIT),
        }


def task_index() -> dict[tuple[str, int], dict[str, Any]]:
    corpus = v12.make_corpus()
    return {
        (family, task["variant"]): task
        for family, tasks in corpus["fixtures"].items()
        for task in tasks
    }


def selected_tasks() -> list[dict[str, Any]]:
    indexed = task_index()
    return [indexed[key] for key in CASES]


def jobs() -> list[dict[str, Any]]:
    indexed = task_index()
    result = []
    for repeat in REPEATS:
        for case_index, (family, variant) in enumerate(CASES):
            order = ARMS if (repeat + case_index) % 2 else tuple(reversed(ARMS))
            for arm in order:
                result.append(
                    {
                        "arm": arm,
                        "family": family,
                        "variant": variant,
                        "repeat": repeat,
                        "task": indexed[(family, variant)],
                    }
                )
    return result


def render_local_document(document: dict[str, Any]) -> str:
    value = core.validate_document(document)
    lines = [
        f"BASE {value['base_sha256']}",
        f"SOURCE {value['source_id']}",
        "OMITS " + " ".join(value["omits"]),
    ]
    for kind in core.OVERLAY_ORDER:
        lines.extend(core.overlay_line(kind, row) for row in value["overlays"][kind])
    lines.extend(
        "N "
        + " ".join(
            (
                f"id={row['id']}",
                f"voice={row['voice']}",
                f"start={row['start']}",
                f"duration={row['duration']}",
                f"pitch={row['pitch']}",
                f"velocity={row['velocity']}",
            )
        )
        for row in value["notes"]
    )
    return "\n".join(lines)


def local_to_fields(text: str) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) < 4:
        raise ValueError("A local-label document is missing a fixed header")
    if not lines[0].startswith("BASE ") or not lines[1].startswith("SOURCE "):
        raise ValueError("A local-label document is missing a fixed header")
    if lines[2] != "OMITS " + " ".join(core.OMISSIONS):
        raise ValueError("A local-label document has the wrong OMITS header")
    converted = [*lines[:3], "FIELDS " + " ".join(core.FIELDS)]
    seen_note = False
    for line in lines[3:]:
        match = LOCAL_NOTE_PATTERN.fullmatch(line)
        if match:
            seen_note = True
            converted.append("N " + " ".join(match.groups()))
            continue
        if seen_note:
            raise ValueError("An overlay cannot follow the note plane")
        if core.parse_overlay_line(line) is None:
            raise ValueError(f"Invalid local-label row: {line}")
        converted.append(line)
    if not seen_note:
        raise ValueError("A local-label document needs at least one note")
    canonical = core.parse_document("compact-bar-fields", "\n".join(converted))
    if render_local_document(canonical) != "\n".join(lines):
        raise ValueError("The local-label document is not canonical")
    return "\n".join(converted)


def represented_source(arm: str, task: dict[str, Any]) -> str | None:
    if arm == "compact-bar-fields":
        return core.represented_source(arm, task)
    rows = core.source_notes(task)
    if not rows:
        return None
    document = core.make_document(
        rows,
        core.digest(core.projected(rows)),
        task["id"] + "-source",
    )
    return render_local_document(document)


def document_example(arm: str) -> str:
    if arm == "compact-bar-fields":
        return core.document_example(arm)
    rows = [
        core.note("ex-bass", "bass", "0", "1", 48, 80),
        core.note("ex-lead", "lead", "0", "1/2", 67, 84),
    ]
    return render_local_document(core.make_document(rows, "example", "example-source"))


def output_grammar(arm: str, family: str) -> str:
    if family == "comprehension-analysis":
        return v12.analysis_grammar()
    if arm == "compact-bar-fields":
        return v12.screen.output_grammar(arm, family)
    return (
        "Return BASE, SOURCE, and the fixed OMITS header. Then return optional "
        "overlay rows and one N row per note. Overlays only refer to event IDs "
        "and never repeat note values. Do not include a FIELDS row. Each note "
        "row must use this exact label order: N id=<id> voice=<voice> "
        "start=<start> duration=<duration> pitch=<pitch> velocity=<velocity>. "
        "Repeat every label on every note row."
    )


def prompt_for(job: dict[str, Any]) -> str:
    arm = job["arm"]
    task = job["task"]
    family = job["family"]
    if family == "comprehension-analysis":
        representation = (
            f"Input representation: {arm}. This label describes only the input "
            "document. Use the shared analysis output grammar below."
        )
        example = v12.ANALYSIS_EXAMPLE
    else:
        representation = f"Output representation: {arm}."
        example = document_example(arm)
    parts = [
        "Complete one deterministic symbolic-music task.",
        "Return one JSON object with exactly one string field named payload. "
        "Put the requested representation in that string. Do not add prose.",
        representation,
        output_grammar(arm, family),
        "Follow this complete output example, but use the task values:\n" + example,
        core.task_instruction(task),
    ]
    if family == "generation-progression":
        parts.append(v12.screen.output_context_instruction("compact-bar-fields", task))
    source = represented_source(arm, task)
    if source is not None:
        parts.extend(("<input_document>", source, "</input_document>"))
    return "\n\n".join(parts)


def parse_failure(message: str) -> dict[str, Any]:
    return {
        "syntax_pass": False,
        "musical_pass": False,
        "primary_pass": False,
        "checks": {},
        "diagnostic": {
            "class": "parse",
            "error_type": "ValueError",
            "message": message,
        },
    }


def score_response(arm: str, task: dict[str, Any], payload: str) -> dict[str, Any]:
    if task["family"] == "comprehension-analysis":
        return v12.score_response("compact-bar-fields", task, payload)
    try:
        normalized = payload if arm == "compact-bar-fields" else local_to_fields(payload)
    except ValueError as error:
        return parse_failure(str(error))
    return v12.score_response("compact-bar-fields", task, normalized)


def perfect_payload(arm: str, task: dict[str, Any]) -> str:
    if task["family"] == "comprehension-analysis":
        return core.render_analysis(task["expected"])
    base_value, source_id = core.expected_output_context(task)
    document = core.make_document(core.perfect_notes(task), base_value, source_id)
    if arm == "compact-bar-fields":
        return core.render_document(arm, document)
    return render_local_document(document)


def package_files() -> dict[str, str]:
    return {
        name: base.file_sha256(PACKAGE_ROOT / name)
        for name in ("diagnostic.py", "README.md", "PROTOCOL.md")
    }


def dependency_files() -> dict[str, str]:
    return {
        str(path.relative_to(BENCHMARKS_ROOT)): base.file_sha256(path)
        for path in DEPENDENCIES
    }


def prompt_manifest() -> list[dict[str, Any]]:
    return [
        {
            "sequence": sequence,
            "arm": job["arm"],
            "family": job["family"],
            "variant": job["variant"],
            "repeat": job["repeat"],
            "task_sha256": job["task"]["sha256"],
            "prompt_sha256": core.sha256_text(prompt_for(job)),
            "prompt_bytes": len(prompt_for(job).encode()),
        }
        for sequence, job in enumerate(jobs(), start=1)
    ]


def size_report() -> dict[str, Any]:
    analysis_jobs = [
        job for job in jobs() if job["family"] == "comprehension-analysis"
    ]
    prompt_bytes = {
        arm: sum(len(prompt_for(job).encode()) for job in analysis_jobs if job["arm"] == arm)
        / sum(job["arm"] == arm for job in analysis_jobs)
        for arm in ARMS
    }
    progression = [
        task for task in selected_tasks() if task["family"] == "generation-progression"
    ]
    payload_bytes = {
        arm: sum(len(perfect_payload(arm, task).encode()) for task in progression)
        / len(progression)
        for arm in ARMS
    }
    return {
        "mean_analysis_prompt_bytes": {
            arm: round(value, 3) for arm, value in prompt_bytes.items()
        },
        "analysis_prompt_ratio": round(
            prompt_bytes["compact-bar-local-labels"]
            / prompt_bytes["compact-bar-fields"],
            6,
        ),
        "mean_perfect_progression_payload_bytes": {
            arm: round(value, 3) for arm, value in payload_bytes.items()
        },
        "progression_payload_ratio": round(
            payload_bytes["compact-bar-local-labels"]
            / payload_bytes["compact-bar-fields"],
            6,
        ),
    }


def decision_rule() -> dict[str, Any]:
    return {
        "default": "select-fields",
        "local_label_selection_gates": {
            "complete_calls": MAXIMUM_CALLS,
            "strict_syntax_per_arm": MAXIMUM_CALLS // len(ARMS),
            "analysis_minimum_local_passes_per_case": 3,
            "analysis_minimum_local_advantage_per_case": 2,
            "analysis_minimum_total_full_pass_advantage": 4,
            "analysis_minimum_total_check_advantage": 8,
            "maximum_analysis_prompt_ratio": 1.5,
            "maximum_progression_payload_ratio": 2.0,
            "progression_syntax_losses_allowed": 0,
        },
        "progression_musical_pass_use": "Report only. It cannot promote local labels.",
        "authority": (
            "The diagnostic can choose between the two compact candidates for "
            "benchmark hardening. It cannot select a public format or start holdout."
        ),
    }


def protocol_manifest() -> dict[str, Any]:
    value = {
        "schema": SCHEMA,
        "run_kind": "local-label-diagnostic-protocol",
        "run_id": RUN_ID,
        "package_files": package_files(),
        "dependency_files": dependency_files(),
        "provider": PROVIDER,
        "model": MODEL,
        "settings": SETTINGS,
        "arms": list(ARMS),
        "cases": [
            {
                "family": family,
                "variant": variant,
                "task_sha256": task_index()[(family, variant)]["sha256"],
                "selection": "v12 Gemini exact pass and FIELDS fail",
            }
            for family, variant in CASES
        ],
        "repeats_per_arm_case": len(REPEATS),
        "prompts": prompt_manifest(),
        "calls": {
            "maximum_messages": MAXIMUM_CALLS,
            "repairs": 0,
            "automatic_retries": 0,
            "token_count_requests": 0,
        },
        "cost_guard": {
            "recent_cost_estimate_usd": base.rounded_usd(RECENT_COST_ESTIMATE),
            "maximum_cost_usd": base.rounded_usd(PROVIDER_COST_LIMIT),
            "maximum_call_cost_usd": base.rounded_usd(
                base.maximum_call_cost(PROVIDER)
            ),
            "input_token_ceiling_per_call": base.INPUT_TOKEN_CEILING,
            "output_token_ceiling_per_call": base.output_token_limit(PROVIDER),
            "request_byte_ceiling_per_call": base.REQUEST_BYTE_CEILING,
        },
        "size_report": size_report(),
        "decision_rule": decision_rule(),
        "case_limit": (
            "Cases were selected after v12 results. This is a stress diagnostic, "
            "not a fresh family estimate."
        ),
        "provider_retry": "Do not retry a failed message request.",
        "privacy": "Generated MIT symbolic text only.",
        "approval_boundary": (
            "No provider request is approved until the operator approves the "
            "exact protocol and run-plan hashes."
        ),
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    value = {
        "schema": SCHEMA,
        "run_kind": "local-label-diagnostic-plan",
        "run_id": RUN_ID,
        "protocol_sha256": protocol["sha256"],
        "provider": PROVIDER,
        "model": MODEL,
        "settings": SETTINGS,
        "arms": protocol["arms"],
        "cases": protocol["cases"],
        "repeats_per_arm_case": protocol["repeats_per_arm_case"],
        "calls": protocol["calls"],
        "cost_guard": protocol["cost_guard"],
        "size_report": protocol["size_report"],
        "decision_rule": protocol["decision_rule"],
        "approval": "pending",
    }
    value["sha256"] = core.digest(value)
    return value


def deterministic_screen() -> dict[str, Any]:
    analysis = task_index()[("comprehension-analysis", 95)]
    progression = task_index()[("generation-progression", 92)]
    local = perfect_payload("compact-bar-local-labels", progression)
    fields = perfect_payload("compact-bar-fields", progression)
    missing_label = local.replace(" duration=", " ", 1)
    reordered = local.replace(
        " voice=bass start=", " start=0 voice=bass ignored=", 1
    )
    report = size_report()
    prompts = [prompt_for(job) for job in jobs()]
    pair_orders = [
        [jobs()[index]["arm"], jobs()[index + 1]["arm"]]
        for index in range(0, len(jobs()), 2)
    ]
    value = {
        "schema": SCHEMA,
        "job_count": len(jobs()),
        "expected_job_count": MAXIMUM_CALLS,
        "case_count": len(CASES),
        "repeat_count": len(REPEATS),
        "task_hashes": [task["sha256"] for task in selected_tasks()],
        "local_perfect_passes": score_response(
            "compact-bar-local-labels", progression, local
        )["primary_pass"],
        "fields_perfect_passes": score_response(
            "compact-bar-fields", progression, fields
        )["primary_pass"],
        "missing_local_label_fails": not score_response(
            "compact-bar-local-labels", progression, missing_label
        )["syntax_pass"],
        "reordered_local_labels_fail": not score_response(
            "compact-bar-local-labels", progression, reordered
        )["syntax_pass"],
        "fields_row_in_local_fails": not score_response(
            "compact-bar-local-labels",
            progression,
            local.replace("OMITS ", "FIELDS id voice start duration pitch velocity\nOMITS ", 1),
        )["syntax_pass"],
        "analysis_output_is_neutral": score_response(
            "compact-bar-fields", analysis, perfect_payload("compact-bar-fields", analysis)
        )
        == score_response(
            "compact-bar-local-labels",
            analysis,
            perfect_payload("compact-bar-local-labels", analysis),
        ),
        "all_requests_fit": all(
            base.request_bytes(PROVIDER, prompt) <= base.REQUEST_BYTE_CEILING
            for prompt in prompts
        ),
        "counterbalanced_pair_firsts": {
            arm: sum(pair[0] == arm for pair in pair_orders) for arm in ARMS
        },
        "all_pairs_contain_both_arms": all(set(pair) == set(ARMS) for pair in pair_orders),
        "estimated_run_fits_with_one_reservation": (
            RECENT_COST_ESTIMATE + base.maximum_call_cost(PROVIDER)
            <= PROVIDER_COST_LIMIT
        ),
        "size_report": report,
        "size_gates_fit": (
            report["analysis_prompt_ratio"]
            <= decision_rule()["local_label_selection_gates"][
                "maximum_analysis_prompt_ratio"
            ]
            and report["progression_payload_ratio"]
            <= decision_rule()["local_label_selection_gates"][
                "maximum_progression_payload_ratio"
            ]
        ),
    }
    value["all_checks_pass"] = all(
        (
            value["job_count"] == value["expected_job_count"],
            value["case_count"] == 4,
            value["repeat_count"] == 4,
            value["local_perfect_passes"],
            value["fields_perfect_passes"],
            value["missing_local_label_fails"],
            value["reordered_local_labels_fail"],
            value["fields_row_in_local_fails"],
            value["analysis_output_is_neutral"],
            value["all_requests_fit"],
            value["counterbalanced_pair_firsts"]
            == {arm: len(pair_orders) // 2 for arm in ARMS},
            value["all_pairs_contain_both_arms"],
            value["estimated_run_fits_with_one_reservation"],
            value["size_gates_fit"],
        )
    )
    value["sha256"] = core.digest(value)
    return value


def deterministic_manifest() -> dict[str, Any]:
    screen = deterministic_screen()
    protocol = protocol_manifest()
    plan = run_plan()
    value = {
        "schema": SCHEMA,
        "screen_sha256": screen["sha256"],
        "protocol_sha256": protocol["sha256"],
        "run_plan_sha256": plan["sha256"],
        "job_count": screen["job_count"],
        "all_checks_pass": screen["all_checks_pass"],
    }
    value["sha256"] = core.digest(value)
    return value


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    if (
        value.get("run_id") != RUN_ID
        or value.get("protocol_sha256") != plan["protocol_sha256"]
        or value.get("run_plan_sha256") != plan["sha256"]
    ):
        raise ValueError("Approval does not match the frozen v13 plan")
    if (
        value.get("status") != "approved"
        or not isinstance(value.get("operator_statement"), str)
        or not value["operator_statement"].strip()
    ):
        raise ValueError("Approval needs an explicit operator statement")
    return value


def one_call(
    key: str, job: dict[str, Any], guard: CostGuard
) -> tuple[dict[str, Any], dict[str, Any]]:
    prompt = prompt_for(job)
    payload_bytes = base.request_bytes(PROVIDER, prompt)
    reservation = guard.authorize(payload_bytes)
    started = time.perf_counter()
    try:
        outer, raw = base.model_call(PROVIDER, key, prompt)
    except Exception:
        guard.retain_failed_reservation()
        raise
    latency_ms = (time.perf_counter() - started) * 1000
    measured = transport.usage(PROVIDER, raw)
    cost, exact_cost = base.cost_usd(PROVIDER, measured)
    guard.settle(reservation, measured, exact_cost)
    call = {
        "prompt_sha256": core.sha256_text(prompt),
        "prompt_bytes": len(prompt.encode()),
        "request_bytes": payload_bytes,
        "input_token_ceiling": base.INPUT_TOKEN_CEILING,
        "cost_reservation_usd": base.exact_usd(reservation),
        "usage": measured,
        "cost_usd": cost,
        "latency_ms": round(latency_ms, 3),
        "retries": 0,
        "returned_model": transport.returned_model(PROVIDER, raw),
        "request_id": raw.get("id"),
        "stop_reason": transport.stop_reason(PROVIDER, raw),
        "raw_response_sha256": core.digest(raw),
    }
    if outer is None:
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
    score = score_response(job["arm"], job["task"], payload)
    if not outer["outer_schema_valid"]:
        score = parse_failure("The response envelope is invalid")
    return core.result_state("initial", score), call


def result_for_job(
    key: str, job: dict[str, Any], sequence: int, guard: CostGuard
) -> dict[str, Any]:
    common = {
        "sequence": sequence,
        "arm": job["arm"],
        "family": job["family"],
        "variant": job["variant"],
        "repeat": job["repeat"],
        "task_sha256": job["task"]["sha256"],
        "semantic_sha256": job["task"]["semantic_sha256"],
    }
    try:
        initial, call = one_call(key, job, guard)
    except Exception as error:
        initial = core.result_state("failed", reason=f"{type(error).__name__}: {error}")
        call = None
    return {**common, "initial": initial, "initial_call": call}


def run_provider(env_file: Path, approval_file: Path) -> dict[str, Any]:
    approval = validate_approval(approval_file)
    check = deterministic_screen()
    if not check["all_checks_pass"]:
        raise ValueError("The deterministic screen failed")
    environment = transport.load_env(env_file)
    if not environment.get(KEY):
        raise ValueError(f"Provider credential preflight failed: {KEY}")
    guard = CostGuard()
    results = []
    for sequence, job in enumerate(jobs(), start=1):
        results.append(result_for_job(environment[KEY], job, sequence, guard))
        print(
            f"{PROVIDER}: processed {sequence}/{MAXIMUM_CALLS} jobs",
            file=sys.stderr,
            flush=True,
        )
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
    value = {
        "schema": SCHEMA,
        "run_kind": "local-label-diagnostic-provider",
        "run_id": RUN_ID,
        "provider": PROVIDER,
        "requested_model": MODEL,
        "settings": SETTINGS,
        "client": "Python urllib.request direct HTTPS",
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "python": platform.python_version(),
        "protocol_sha256": protocol_manifest()["sha256"],
        "screen_sha256": check["sha256"],
        "run_plan_sha256": run_plan()["sha256"],
        "approval": approval,
        "results": results,
        "attempted_calls": len(results),
        "actual_calls": guard.message_attempts,
        "completed_calls": len(calls),
        "actual_cost_usd": base.rounded_usd(actual),
        "cost_guard": snapshot,
        "budget_stops": budget_stops,
        "transport_failures": transport_failures,
        "complete": len(results) == MAXIMUM_CALLS
        and len(calls) == MAXIMUM_CALLS
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
    expected_rows = {
        (sequence, job["arm"], job["family"], job["variant"], job["repeat"])
        for sequence, job in enumerate(jobs(), start=1)
    }
    actual_rows = {
        (
            row["sequence"],
            row["arm"],
            row["family"],
            row["variant"],
            row["repeat"],
        )
        for row in value.get("results", [])
    }
    calls = [
        row["initial_call"]
        for row in value.get("results", [])
        if row.get("initial_call") is not None
    ]
    if (
        value.get("run_id") != RUN_ID
        or value.get("run_kind") != "local-label-diagnostic-provider"
        or value.get("provider") != PROVIDER
        or value.get("protocol_sha256") != protocol_manifest()["sha256"]
        or value.get("run_plan_sha256") != run_plan()["sha256"]
        or value.get("requested_model") != MODEL
        or value.get("settings") != SETTINGS
        or value.get("complete") is not True
        or value.get("budget_stops") != 0
        or value.get("transport_failures") != 0
        or value.get("attempted_calls") != MAXIMUM_CALLS
        or value.get("actual_calls") != MAXIMUM_CALLS
        or value.get("completed_calls") != MAXIMUM_CALLS
        or len(value.get("results", [])) != MAXIMUM_CALLS
        or expected_rows != actual_rows
        or value.get("cost_guard", {}).get("message_attempts") != MAXIMUM_CALLS
        or value.get("cost_guard", {}).get("committed_cost_usd", math.inf)
        > base.rounded_usd(PROVIDER_COST_LIMIT)
    ):
        raise ValueError(f"Manifest does not match the frozen diagnostic: {path}")
    if any(call.get("returned_model") != MODEL for call in calls):
        raise ValueError(f"Manifest contains a different returned model: {path}")
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
        raise ValueError(f"Manifest accounting does not reconcile: {path}")
    return value


def row_score(row: dict[str, Any]) -> dict[str, Any] | None:
    return row["initial"].get("score")


def row_pass(row: dict[str, Any]) -> bool:
    score = row_score(row)
    return bool(score and score.get("primary_pass"))


def row_syntax(row: dict[str, Any]) -> bool:
    score = row_score(row)
    return bool(score and score.get("syntax_pass"))


def check_passes(row: dict[str, Any]) -> int:
    score = row_score(row)
    return sum(bool(value) for value in score.get("checks", {}).values()) if score else 0


def summarize(run: dict[str, Any]) -> dict[str, Any]:
    rows = run["results"]
    analysis_rows = [row for row in rows if row["family"] == "comprehension-analysis"]
    progression_rows = [row for row in rows if row["family"] == "generation-progression"]
    arm_summary = {
        arm: {
            "rows": sum(row["arm"] == arm for row in rows),
            "strict_syntax_passes": sum(
                row_syntax(row) for row in rows if row["arm"] == arm
            ),
            "strict_full_passes": sum(
                row_pass(row) for row in rows if row["arm"] == arm
            ),
        }
        for arm in ARMS
    }
    analysis_by_case = {
        str(variant): {
            arm: {
                "strict_full_passes": sum(
                    row_pass(row)
                    for row in analysis_rows
                    if row["variant"] == variant and row["arm"] == arm
                ),
                "correct_field_checks": sum(
                    check_passes(row)
                    for row in analysis_rows
                    if row["variant"] == variant and row["arm"] == arm
                ),
            }
            for arm in ARMS
        }
        for family, variant in CASES
        if family == "comprehension-analysis"
    }
    local = "compact-bar-local-labels"
    fields = "compact-bar-fields"
    local_analysis_passes = sum(
        value[local]["strict_full_passes"] for value in analysis_by_case.values()
    )
    fields_analysis_passes = sum(
        value[fields]["strict_full_passes"] for value in analysis_by_case.values()
    )
    local_checks = sum(
        value[local]["correct_field_checks"] for value in analysis_by_case.values()
    )
    fields_checks = sum(
        value[fields]["correct_field_checks"] for value in analysis_by_case.values()
    )
    gates = decision_rule()["local_label_selection_gates"]
    gate_results = {
        "complete_calls": run["complete"]
        and run["completed_calls"] == gates["complete_calls"],
        "strict_syntax": all(
            arm_summary[arm]["strict_syntax_passes"]
            == gates["strict_syntax_per_arm"]
            for arm in ARMS
        ),
        "analysis_repeats_by_case": all(
            value[local]["strict_full_passes"]
            >= gates["analysis_minimum_local_passes_per_case"]
            and value[local]["strict_full_passes"]
            - value[fields]["strict_full_passes"]
            >= gates["analysis_minimum_local_advantage_per_case"]
            for value in analysis_by_case.values()
        ),
        "analysis_total_full_pass_advantage": (
            local_analysis_passes - fields_analysis_passes
            >= gates["analysis_minimum_total_full_pass_advantage"]
        ),
        "analysis_total_check_advantage": (
            local_checks - fields_checks
            >= gates["analysis_minimum_total_check_advantage"]
        ),
        "analysis_prompt_size": (
            size_report()["analysis_prompt_ratio"]
            <= gates["maximum_analysis_prompt_ratio"]
        ),
        "progression_payload_size": (
            size_report()["progression_payload_ratio"]
            <= gates["maximum_progression_payload_ratio"]
        ),
        "progression_syntax": (
            sum(row_syntax(row) for row in progression_rows if row["arm"] == local)
            >= sum(row_syntax(row) for row in progression_rows if row["arm"] == fields)
        ),
    }
    selection = "select-local-labels" if all(gate_results.values()) else "select-fields"
    value = {
        "schema": SCHEMA,
        "run_kind": "local-label-diagnostic-summary",
        "run_id": RUN_ID,
        "protocol_sha256": protocol_manifest()["sha256"],
        "run_manifest_sha256": run["manifest_sha256"],
        "actual_cost_usd": run["actual_cost_usd"],
        "arms": arm_summary,
        "analysis_by_case": analysis_by_case,
        "analysis_totals": {
            "local_full_passes": local_analysis_passes,
            "fields_full_passes": fields_analysis_passes,
            "local_correct_field_checks": local_checks,
            "fields_correct_field_checks": fields_checks,
        },
        "progression": {
            arm: {
                "strict_syntax_passes": sum(
                    row_syntax(row) for row in progression_rows if row["arm"] == arm
                ),
                "diagnostic_full_passes": sum(
                    row_pass(row) for row in progression_rows if row["arm"] == arm
                ),
            }
            for arm in ARMS
        },
        "size_report": size_report(),
        "gate_results": gate_results,
        "selection": selection,
        "selection_authority": decision_rule()["authority"],
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
    parser.add_argument("--provider", choices=(PROVIDER,))
    parser.add_argument(
        "--env-file", type=Path, default=PACKAGE_ROOT.parents[2] / ".env"
    )
    parser.add_argument("--approval-file", type=Path, default=APPROVAL_PATH)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--summarize", type=Path)
    args = parser.parse_args()
    if args.self_test:
        check = deterministic_screen()
        if not check["all_checks_pass"]:
            raise SystemExit(json.dumps(check, indent=2, sort_keys=True))
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
        write_new(run_provider(args.env_file, args.approval_file), args.output)
        return
    if args.summarize:
        write_new(summarize(load_manifest(args.summarize)), args.output)
        return
    print(
        json.dumps(
            {
                "screen": deterministic_screen(),
                "protocol": protocol_manifest(),
                "plan": run_plan(),
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
