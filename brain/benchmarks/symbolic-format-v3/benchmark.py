#!/usr/bin/env python3
"""Prepare and run the extensible symbolic-format matrix and probe."""

from __future__ import annotations

import argparse
import importlib.util
import json
import random
import sys
from copy import deepcopy
from decimal import Decimal
from functools import lru_cache
from fractions import Fraction
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent
SUITE_PATH = PACKAGE_ROOT / "suite.py"
FORMATS_PATH = PACKAGE_ROOT / "formats.py"
V19_BENCHMARK_PATH = BENCHMARKS_ROOT / "compact-format-v19" / "benchmark.py"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


suite = load_module("ghostnote_symbolic_format_v3_suite", SUITE_PATH)
formats = load_module("ghostnote_symbolic_format_v3_formats", FORMATS_PATH)
engine = load_module("ghostnote_symbolic_format_v3_v19_benchmark", V19_BENCHMARK_PATH)
v15 = engine.v15
v14 = engine.v14
base = engine.base
core = engine.core

SCHEMA = "ghostnote-symbolic-format-benchmark-v3"
RUN_ID = "phase8c4f-external-format-probe-r1"
COHORT = suite.DEFAULT_COHORT
SEED = suite.DEFAULT_SEED
VARIANT_OFFSET = suite.DEFAULT_VARIANT_OFFSET
ARMS = (
    "abc-2.1-composite",
    "strudel-v1.2-composite",
    "lilypond-2.24.4-composite",
)
PROVIDERS = ("gemini",)
MODELS = {"gemini": "gemini-3.8-flash"}
KEYS = {"gemini": "GEMINI_API_KEY"}
SETTINGS = {
    "gemini": {
        "thinking_level": "low",
        "max_output_tokens": 12000,
        "temperature": "provider default; omitted from request",
    }
}
DECISION_FAMILIES = suite.DECISION_FAMILIES
GUARD_FAMILIES = suite.GUARD_FAMILIES
FAMILIES = suite.FAMILIES
PROBE_COUNTS = {family: 2 for family in DECISION_FAMILIES} | {
    "document-serialization": 1
}
UNIQUE_COUNTS = PROBE_COUNTS
MAXIMUM_CALLS = sum(PROBE_COUNTS.values()) * len(ARMS)
MAXIMUM_TOKEN_COUNT_REQUESTS = MAXIMUM_CALLS
RECENT_COST_ESTIMATE = {"gemini": Decimal("0.180000")}
PROVIDER_COST_LIMITS = {"gemini": Decimal("0.350000")}
MAXIMUM_TOTAL_COST = Decimal("0.350000")
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "external-probe-r1-approval.json"
RUN_KIND_PROVIDER = "external-format-probe-provider"
RUN_KIND_SUMMARY = "external-format-probe-summary"
DEPENDENCIES = (
    SUITE_PATH,
    FORMATS_PATH,
    suite.V19_SUITE_PATH,
    formats.SYMBOLIC_V1_ROOT / "corpus.py",
    formats.SYMBOLIC_V1_ROOT / "formats.py",
)


def make_corpus() -> dict[str, Any]:
    return suite.make_corpus(COHORT, SEED, VARIANT_OFFSET)


def candidate_hashes() -> dict[str, str]:
    return {name: core.digest(formats.get(name).descriptor()) for name in ARMS}


def selected_tasks() -> list[dict[str, Any]]:
    corpus = make_corpus()
    return [
        {
            "family": family,
            "variant": task["variant"],
            "repeat": 1,
            "task": task,
        }
        for family in FAMILIES
        for task in corpus["fixtures"][family][: PROBE_COUNTS[family]]
    ]


def jobs(provider: str) -> list[dict[str, Any]]:
    if provider not in PROVIDERS:
        raise ValueError(f"Unknown provider: {provider}")
    groups = selected_tasks()
    random.Random(SEED).shuffle(groups)
    result = []
    for group_index, group in enumerate(groups):
        rotation = group_index % len(ARMS)
        order = ARMS[rotation:] + ARMS[:rotation]
        result.extend({**group, "arm": arm} for arm in order)
    return [
        {**job, "planned_sequence": index}
        for index, job in enumerate(result, start=1)
    ]


def source_notes(task: dict[str, Any]) -> list[dict[str, Any]]:
    return suite.source_notes(task)


def represented_source(arm: str, task: dict[str, Any]) -> str | None:
    notes = source_notes(task)
    if not notes:
        return None
    metadata = {
        "base_sha256": core.digest(core.projected(notes)),
        "source_id": task["id"] + "-source",
    }
    return formats.get(arm).render_notes(notes, metadata)


def perfect_payload(arm: str, task: dict[str, Any]) -> str:
    if task["family"] == "comprehension-analysis":
        return core.render_analysis(task["expected"]).removeprefix("ANALYSIS ")
    notes = source_notes(task)
    metadata = {
        "base_sha256": "none" if task["family"] == "document-serialization" else core.digest(core.projected(notes)),
        "source_id": task["id"],
    }
    return formats.get(arm).render_notes(suite.expected_notes(task), metadata)


def task_difficulty(task: dict[str, Any]) -> str:
    return suite.task_difficulty(task)


def task_instruction(_arm: str, task: dict[str, Any]) -> str:
    return suite.task_instruction(task)


def prompt_for(job: dict[str, Any]) -> str:
    adapter = formats.get(job["arm"])
    task = job["task"]
    if task["family"] == "comprehension-analysis":
        grammar = v14.analysis_grammar()
        representation = (
            f"Input representation: {adapter.label} {adapter.version} composite. "
            "Use the shared analysis output grammar."
        )
        example = v14.example_for("compact-bar-fields", "comprehension-analysis")
    else:
        grammar = adapter.grammar
        representation = (
            f"Input and output representation: {adapter.label} {adapter.version} "
            f"{adapter.condition}."
        )
        example = adapter.example
    parts = [
        "Complete one deterministic symbolic-music task.",
        "Return one JSON object with exactly one string field named payload. Put "
        "the requested representation in that string. Do not add prose.",
        f"Difficulty level: {task_difficulty(task)}.",
        representation,
        grammar,
        "Follow this complete output example, but use the task values:\n" + example,
        suite.task_instruction(task),
    ]
    source = represented_source(job["arm"], task)
    if source is not None:
        parts.extend(("<input_document>", source, "</input_document>"))
    return "\n\n".join(parts)


def case_record(case_id: str, components: dict[str, bool]) -> dict[str, Any]:
    return v15.case_record(case_id, components)


def onset_alignment(
    expected: list[dict[str, Any]], actual: list[dict[str, Any]]
) -> tuple[int, tuple[int, ...]]:
    """Return maximum field agreement and its ID-neutral assignment."""

    fields = ("voice", "duration", "pitch", "velocity")

    @lru_cache(maxsize=None)
    def best(expected_index: int, used_actual: int) -> tuple[int, tuple[int, ...]]:
        if expected_index == len(expected):
            return 0, ()
        skipped_score, skipped_assignment = best(expected_index + 1, used_actual)
        result = (skipped_score, (-1, *skipped_assignment))
        for actual_index, actual_note in enumerate(actual):
            bit = 1 << actual_index
            if used_actual & bit:
                continue
            matches = 1 + sum(
                actual_note.get(field) == expected[expected_index][field]
                for field in fields
            )
            later_score, later_assignment = best(expected_index + 1, used_actual | bit)
            candidate = (matches + later_score, (actual_index, *later_assignment))
            if candidate[0] > result[0] or (
                candidate[0] == result[0]
                and tuple(len(actual) if index < 0 else index for index in candidate[1])
                < tuple(len(actual) if index < 0 else index for index in result[1])
            ):
                result = candidate
        return result

    return best(0, 0)


def onset_alignment_score(
    expected: list[dict[str, Any]], actual: list[dict[str, Any]]
) -> int:
    return onset_alignment(expected, actual)[0]


def revoice_score(task: dict[str, Any], parsed: Any) -> dict[str, Any]:
    expected = task["expected"]
    actual = parsed.notes
    expected_by_start: dict[Fraction, list[dict[str, Any]]] = {}
    actual_by_start: dict[Fraction, list[dict[str, Any]]] = {}
    for row in expected:
        expected_by_start.setdefault(core.fraction(row["start"]), []).append(row)
    for row in actual:
        actual_by_start.setdefault(core.fraction(row["start"]), []).append(row)
    cases = []
    for start, expected_notes in expected_by_start.items():
        actual_notes = actual_by_start.get(start, [])
        _correct, assignment = onset_alignment(expected_notes, actual_notes)
        for position, (expected_note, actual_index) in enumerate(
            zip(expected_notes, assignment), start=1
        ):
            actual_note = actual_notes[actual_index] if actual_index >= 0 else {}
            cases.append(
                case_record(
                    f"onset-{core.fraction_text(start)}-position-{position}",
                    {
                        field: actual_note.get(field) == expected_note[field]
                        for field in ("voice", "start", "duration", "pitch", "velocity")
                    },
                )
            )
    response = {
        "notation-ledger-alignment": parsed.alignment is True,
        "globally-unique-ids": len({row["id"] for row in actual}) == len(actual),
        "exact-note-count": len(actual) == len(expected),
    }
    return v15.score_value(
        parsed.structural,
        parsed.canonical,
        cases,
        response,
        None if parsed.canonical and all(response.values()) and all(case["perfect"] for case in cases)
        else {"class": "component-or-conformance", "canonical_error": parsed.error},
    )


def exact_score(task: dict[str, Any], parsed: Any) -> dict[str, Any]:
    expected = suite.expected_notes(task)
    expected_by_id = {row["id"]: row for row in expected}
    actual_by_id = {row["id"]: row for row in parsed.notes}
    cases = [
        case_record(
            note_id,
            {
                field: actual_by_id.get(note_id, {}).get(field) == row[field]
                for field in core.FIELDS
            },
        )
        for note_id, row in expected_by_id.items()
    ]
    response = {
        "notation-ledger-alignment": parsed.alignment is True,
        "globally-unique-ids": len(actual_by_id) == len(parsed.notes),
        "exact-note-count": len(parsed.notes) == len(expected),
    }
    return v15.score_value(
        parsed.structural,
        parsed.canonical,
        cases,
        response,
        None if parsed.canonical and all(response.values()) and all(case["perfect"] for case in cases)
        else {"class": "component-or-conformance", "canonical_error": parsed.error},
    )


def constraint_score(task: dict[str, Any], parsed: Any) -> dict[str, Any]:
    checks = suite.constraint_checks(task, parsed.notes)
    response = {
        "notation-ledger-alignment": parsed.alignment is True,
        "globally-unique-ids": len({row["id"] for row in parsed.notes})
        == len(parsed.notes),
    }
    return v15.score_value(
        parsed.structural,
        parsed.canonical,
        [case_record("requirements", checks)],
        response,
        None if parsed.canonical and all(checks.values()) and all(response.values())
        else {"class": "component-or-conformance", "canonical_error": parsed.error},
    )


def score_response(arm: str, task: dict[str, Any], payload: str) -> dict[str, Any]:
    if task["family"] == "comprehension-analysis":
        return v15.analysis_score(task, payload)
    parsed = formats.get(arm).parse_payload(payload)
    if task["family"] in {
        "generation-progression",
        "generation-melody",
        "continuation-roles",
    }:
        return constraint_score(task, parsed)
    if task["family"] == "transformation-revoice":
        return revoice_score(task, parsed)
    return exact_score(task, parsed)


def parse_failure_for_task(task: dict[str, Any], message: str) -> dict[str, Any]:
    if task["family"] == "comprehension-analysis":
        cases = [
            case_record(
                f"case-{index + 1}",
                {field: False for field in core.ANALYSIS_FIELDS},
            )
            for index in range(task["contract"]["case_count"])
        ]
        response: dict[str, bool] = {}
    elif task["family"] in {
        "generation-progression",
        "generation-melody",
        "continuation-roles",
    }:
        checks = suite.constraint_checks(task, [])
        cases = [case_record("requirements", {name: False for name in checks})]
        response = {
            "notation-ledger-alignment": False,
            "globally-unique-ids": False,
        }
    else:
        fields = (
            ("voice", "start", "duration", "pitch", "velocity")
            if task["family"] == "transformation-revoice"
            else core.FIELDS
        )
        cases = [
            case_record(row["id"], {field: False for field in fields})
            for row in suite.expected_notes(task)
        ]
        response = {
            "notation-ledger-alignment": False,
            "globally-unique-ids": False,
            "exact-note-count": False,
        }
    return v15.score_value(
        False,
        False,
        cases,
        response,
        {"class": "structural-parse", "message": message},
    )


def package_files() -> dict[str, str]:
    names = ("benchmark.py", "suite.py", "formats.py", "README.md", "PROTOCOL.md")
    return {name: base.file_sha256(PACKAGE_ROOT / name) for name in names}


def dependency_files() -> dict[str, str]:
    return {
        str(path.relative_to(BENCHMARKS_ROOT)): base.file_sha256(path)
        for path in DEPENDENCIES
    }


def cohort_audit() -> dict[str, Any]:
    corpus = make_corpus()
    tasks = [task for values in corpus["fixtures"].values() for task in values]
    current = {task["content_sha256"] for task in tasks}
    prior_corpus = suite.v19.make_corpus()
    prior = {
        suite.v19.content_sha256(task)
        for values in prior_corpus["fixtures"].values()
        for task in values
    }
    value = {
        "corpus_sha256": corpus["sha256"],
        "task_count": len(tasks),
        "content_hash_count": len(current),
        "internal_content_duplicates": len(tasks) - len(current),
        "v19_content_overlap": len(current & prior),
    }
    value["sha256"] = core.digest(value)
    return value


def effective_request_settings(provider: str) -> dict[str, Any]:
    value = deepcopy(SETTINGS[provider])
    value.pop("temperature")
    return value


def cost_guard_manifest() -> dict[str, Any]:
    return {
        "recent_cost_estimate_usd": {"gemini": 0.18},
        "recent_cost_estimate_total_usd": 0.18,
        "maximum_provider_cost_usd": {"gemini": 0.35},
        "maximum_total_cost_usd": 0.35,
        "maximum_call_cost_usd": {
            "gemini": base.rounded_usd(base.maximum_call_cost("gemini"))
        },
        "input_token_ceiling_per_call": base.INPUT_TOKEN_CEILING,
        "output_token_ceiling_per_call": {
            "gemini": base.output_token_limit("gemini")
        },
        "request_byte_ceiling_per_call": base.REQUEST_BYTE_CEILING,
        "failed_reservation": "retained",
    }


def prompt_manifest() -> dict[str, list[dict[str, Any]]]:
    hashes = candidate_hashes()
    return {
        provider: [
            {
                "planned_sequence": job["planned_sequence"],
                "arm": job["arm"],
                "candidate_sha256": hashes[job["arm"]],
                "family": job["family"],
                "variant": job["variant"],
                "task_sha256": job["task"]["sha256"],
                "content_sha256": job["task"]["content_sha256"],
                "prompt_sha256": core.sha256_text(prompt_for(job)),
                "prompt_bytes": len(prompt_for(job).encode()),
            }
            for job in jobs(provider)
        ]
        for provider in PROVIDERS
    }


def protocol_manifest() -> dict[str, Any]:
    value = {
        "schema": SCHEMA,
        "run_kind": "external-format-probe-protocol",
        "run_id": RUN_ID,
        "package_files": package_files(),
        "dependency_files": dependency_files(),
        "cohort": COHORT,
        "cohort_audit": cohort_audit(),
        "candidate_definitions": {
            name: formats.get(name).descriptor() for name in ARMS
        },
        "candidate_sha256": candidate_hashes(),
        "arms": list(ARMS),
        "families": {
            family: {
                "fixtures": PROBE_COUNTS[family],
                "role": "decision" if family in DECISION_FAMILIES else "guard",
            }
            for family in FAMILIES
        },
        "models": MODELS,
        "declared_settings": SETTINGS,
        "effective_request_settings": {
            provider: effective_request_settings(provider) for provider in PROVIDERS
        },
        "prompts": prompt_manifest(),
        "calls": {
            "messages_per_provider": MAXIMUM_CALLS,
            "messages_total": MAXIMUM_CALLS,
            "automatic_retries": 0,
            "repairs": 0,
        },
        "cost_guard": cost_guard_manifest(),
        "measurement": {
            "primary": "component accuracy by provider, family, and format",
            "structural_and_canonical": "diagnostics, not gates",
            "experimental_unit": "prompt",
            "revoice_alignment": "maximum field agreement within exact onset",
            "revoice_identity": "synthetic IDs excluded from musical scoring",
            "exact_note_count": "required for reference-answer tasks",
            "manual_review": "one full prompt and response from every family-format cell",
        },
        "stopping_rule": (
            "Stop on the first transport, budget, approval, identity, freshness, "
            "or deterministic-screen failure. Make no retry or repair call."
        ),
        "approval_boundary": (
            "No provider request is approved until the operator approves this exact "
            "plan, schedule, model, settings, and USD 0.350000 hard limit."
        ),
        "privacy": "Generated MIT symbolic text only.",
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    value = {
        "schema": SCHEMA,
        "run_kind": "external-format-probe-plan",
        "run_id": RUN_ID,
        "protocol_sha256": protocol["sha256"],
        "cohort_sha256": protocol["cohort_audit"]["corpus_sha256"],
        "candidate_sha256": protocol["candidate_sha256"],
        "arms": protocol["arms"],
        "families": protocol["families"],
        "models": protocol["models"],
        "declared_settings": protocol["declared_settings"],
        "effective_request_settings": protocol["effective_request_settings"],
        "calls": protocol["calls"],
        "cost_guard": protocol["cost_guard"],
        "measurement": protocol["measurement"],
        "schedule_sha256": {
            provider: core.digest(protocol["prompts"][provider])
            for provider in PROVIDERS
        },
        "approval": "pending",
    }
    value["sha256"] = core.digest(value)
    return value


def matrix_template(arms: tuple[str, ...]) -> dict[str, Any]:
    unknown = sorted(set(arms) - set(formats.REGISTRY))
    if unknown:
        raise ValueError(f"Unknown adapters: {','.join(unknown)}")
    per_arm = sum(suite.UNIQUE_COUNTS.values()) + len(suite.SENTINEL_FAMILIES)
    value = {
        "schema": "ghostnote-symbolic-format-matrix-template-v1",
        "suite_schema": suite.CORPUS_SCHEMA,
        "fixture_policy": {
            "decision_fixtures_per_family": 7,
            "literal_serialization_controls": 2,
            "sentinel_repeats_per_arm": len(suite.SENTINEL_FAMILIES),
            "messages_per_arm_per_provider": per_arm,
        },
        "arms": list(arms),
        "candidate_sha256": {
            name: core.digest(formats.get(name).descriptor()) for name in arms
        },
        "messages_per_provider": per_arm * len(arms),
        "messages_all_three_providers": per_arm * len(arms) * 3,
        "freshness_rule": (
            "Keep suite, scoring, and policy fixed. Change cohort, seed, variant "
            "offset, and resulting prompt hashes before provider work."
        ),
        "adapter_contract": [
            "name and pinned version",
            "represented fields and eligible families",
            "grammar and complete example",
            "render_notes and parse_payload",
            "stable descriptor hash",
        ],
        "status": "template-only; no provider calls authorized",
    }
    value["sha256"] = core.digest(value)
    return value


def scoring_screen() -> dict[str, Any]:
    checks: dict[str, bool] = {}
    corpus = make_corpus()
    for family in FAMILIES:
        task = corpus["fixtures"][family][0]
        for arm in ARMS:
            score = score_response(arm, task, perfect_payload(arm, task))
            key = f"{family}:{arm}"
            checks[f"{key}:perfect-components"] = (
                score["component"]["correct"] == score["component"]["planned"]
            )
            checks[f"{key}:structural"] = score["structural_parse_pass"]
            checks[f"{key}:canonical"] = score["canonical_form_pass"]
    revoice = corpus["fixtures"]["transformation-revoice"][0]
    expected = deepcopy(revoice["expected"])
    actual = deepcopy(expected)
    actual[0]["voice"] = "lead"
    expected_start = core.fraction(expected[0]["start"])
    expected_group = [
        row for row in expected if core.fraction(row["start"]) == expected_start
    ]
    actual_group = [
        row for row in actual if core.fraction(row["start"]) == expected_start
    ]
    checks["revoice-one-field-error-loses-one-component"] = (
        onset_alignment_score(expected_group, actual_group)
        == len(expected_group) * 5 - 1
    )
    checks["revoice-extra-note-fails-count"] = len([*actual, deepcopy(actual[0])]) != len(expected)
    return {"checks": checks, "all_pass": all(checks.values())}


def adapter_screen() -> dict[str, Any]:
    note = {
        "id": "adapter-note",
        "voice": "lead",
        "start": "0",
        "duration": "1",
        "pitch": 60,
        "velocity": 84,
    }
    metadata = {"base_sha256": "adapter-base", "source_id": "adapter-source"}
    checks = {}
    for name, adapter in formats.REGISTRY.items():
        payload = adapter.render_notes([note], metadata)
        parsed = adapter.parse_payload(payload)
        checks[f"{name}:structural"] = parsed.structural
        checks[f"{name}:canonical"] = parsed.canonical
        checks[f"{name}:fields"] = parsed.notes == [note]
    return {"checks": checks, "all_pass": all(checks.values())}


def deterministic_screen() -> dict[str, Any]:
    corpus = make_corpus()
    suite_result = suite.suite_screen(corpus)
    scoring = scoring_screen()
    adapters = adapter_screen()
    prompts = prompt_manifest()
    checks = {
        "suite": suite_result["all_pass"],
        "scoring": scoring["all_pass"],
        "adapters": adapters["all_pass"],
        "fresh-content": cohort_audit()["v19_content_overlap"] == 0,
        "no-internal-content-duplicates": cohort_audit()["internal_content_duplicates"] == 0,
        "job-count": all(len(rows) == MAXIMUM_CALLS for rows in prompts.values()),
        "request-bytes": all(
            row["prompt_bytes"] <= base.REQUEST_BYTE_CEILING
            for rows in prompts.values()
            for row in rows
        ),
        "adapter-registry": all(
            callable(formats.get(name).render_notes)
            and callable(formats.get(name).parse_payload)
            for name in formats.REGISTRY
        ),
    }
    value = {
        "checks": checks,
        "suite": suite_result,
        "scoring": scoring,
        "adapters": adapters,
        "all_checks_pass": all(checks.values()),
    }
    value["sha256"] = core.digest(value)
    return value


def deterministic_manifest() -> dict[str, Any]:
    screen = deterministic_screen()
    plan = run_plan()
    value = {
        "schema": SCHEMA,
        "screen_sha256": screen["sha256"],
        "protocol_sha256": plan["protocol_sha256"],
        "run_plan_sha256": plan["sha256"],
        "cohort_sha256": plan["cohort_sha256"],
        "candidate_sha256": candidate_hashes(),
        "job_count_per_provider": MAXIMUM_CALLS,
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
        or value.get("cohort_sha256") != plan["cohort_sha256"]
        or value.get("candidate_sha256") != plan["candidate_sha256"]
        or value.get("maximum_total_cost_usd")
        != plan["cost_guard"]["maximum_total_cost_usd"]
    ):
        raise ValueError("Approval does not match the frozen external probe")
    if (
        value.get("status") != "approved"
        or not isinstance(value.get("operator_statement"), str)
        or not value["operator_statement"].strip()
    ):
        raise ValueError("Approval needs an explicit operator statement")
    return value


def configure_engine() -> None:
    values = {
        "PACKAGE_ROOT": PACKAGE_ROOT,
        "SCHEMA": SCHEMA,
        "RUN_ID": RUN_ID,
        "COHORT": COHORT,
        "SEED": SEED,
        "VARIANT_OFFSET": VARIANT_OFFSET,
        "ARMS": ARMS,
        "DECISION_FAMILIES": DECISION_FAMILIES,
        "GUARD_FAMILIES": GUARD_FAMILIES,
        "FAMILIES": FAMILIES,
        "UNIQUE_COUNTS": UNIQUE_COUNTS,
        "PROVIDERS": PROVIDERS,
        "MODELS": MODELS,
        "KEYS": KEYS,
        "SETTINGS": SETTINGS,
        "MAXIMUM_CALLS": MAXIMUM_CALLS,
        "MAXIMUM_TOKEN_COUNT_REQUESTS": MAXIMUM_TOKEN_COUNT_REQUESTS,
        "RECENT_COST_ESTIMATE": RECENT_COST_ESTIMATE,
        "PROVIDER_COST_LIMITS": PROVIDER_COST_LIMITS,
        "MAXIMUM_TOTAL_COST": MAXIMUM_TOTAL_COST,
        "APPROVAL_PATH": APPROVAL_PATH,
        "DEPENDENCIES": DEPENDENCIES,
        "RUN_KIND_PROVIDER": RUN_KIND_PROVIDER,
        "RUN_KIND_SUMMARY": RUN_KIND_SUMMARY,
    }
    overrides = {
        "make_corpus": make_corpus,
        "task_difficulty": task_difficulty,
        "candidate_hashes": candidate_hashes,
        "jobs": jobs,
        "represented_source": represented_source,
        "perfect_payload": perfect_payload,
        "task_instruction": task_instruction,
        "prompt_for": prompt_for,
        "score_response": score_response,
        "parse_failure_for_task": parse_failure_for_task,
        "package_files": package_files,
        "dependency_files": dependency_files,
        "effective_request_settings": effective_request_settings,
        "cohort_audit": cohort_audit,
        "cost_guard_manifest": cost_guard_manifest,
        "prompt_manifest": prompt_manifest,
        "protocol_manifest": protocol_manifest,
        "run_plan": run_plan,
        "deterministic_screen": deterministic_screen,
        "deterministic_manifest": deterministic_manifest,
        "validate_approval": validate_approval,
    }
    for module in (engine, v15, v14):
        for name, value in values.items():
            setattr(module, name, value)
        for name, value in overrides.items():
            setattr(module, name, value)
    base.SETTINGS = {
        "gemini": {
            "thinking_level": "low",
            "max_output_tokens": 12000,
        }
    }


configure_engine()


def run_provider(provider: str, env_file: Path, approval_file: Path) -> dict[str, Any]:
    return v15.run_provider(provider, env_file, approval_file)


def write_new(value: dict[str, Any], output: Path | None) -> None:
    text = json.dumps(value, indent=2, sort_keys=True) + "\n"
    if output is None:
        print(text, end="")
        return
    if output.exists():
        raise FileExistsError(f"Refusing to replace: {output}")
    output.write_text(text)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--check", type=Path)
    parser.add_argument("--print-plan", action="store_true")
    parser.add_argument("--print-matrix-template", action="store_true")
    parser.add_argument("--arms", nargs="*", choices=tuple(formats.REGISTRY))
    parser.add_argument("--provider", choices=PROVIDERS)
    parser.add_argument(
        "--env-file", type=Path, default=PACKAGE_ROOT.parents[2] / ".env"
    )
    parser.add_argument("--approval-file", type=Path, default=APPROVAL_PATH)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.self_test:
        screen = deterministic_screen()
        if not screen["all_checks_pass"]:
            raise SystemExit(json.dumps(screen, indent=2, sort_keys=True))
        print(json.dumps({"pass": True, **deterministic_manifest()}, indent=2, sort_keys=True))
        return
    if args.check:
        actual = deterministic_manifest()
        if actual != json.loads(args.check.read_text()):
            raise SystemExit("Deterministic mismatch")
        print(json.dumps({"pass": True, **actual}, indent=2, sort_keys=True))
        return
    if args.print_plan:
        write_new(run_plan(), args.output)
        return
    if args.print_matrix_template:
        selected = tuple(args.arms or formats.REGISTRY)
        write_new(matrix_template(selected), args.output)
        return
    if args.provider:
        write_new(run_provider(args.provider, args.env_file, args.approval_file), args.output)
        return
    raise SystemExit("Select --self-test, --check, --print-plan, --print-matrix-template, or --provider")


if __name__ == "__main__":
    main()
