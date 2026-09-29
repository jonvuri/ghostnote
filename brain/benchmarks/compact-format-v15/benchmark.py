#!/usr/bin/env python3
"""Freeze and run the Phase 8c4d v15 validity ladder."""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import platform
import re
import sys
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


v14 = load_module(
    "ghostnote_compact_format_v15_v14",
    BENCHMARKS_ROOT / "compact-format-v14" / "benchmark.py",
)
base = v14.base
core = v14.core
transport = v14.transport

SCHEMA = "ghostnote-compact-format-validity-v15"
CORPUS_SCHEMA = "ghostnote-compact-format-validity-corpus-v15"
RUN_ID = "phase8c4d-validity-ladder-r1"
COHORT = "validity-ladder-r1"
SEED = 51047
VARIANT_OFFSET = 180
ARMS = v14.ARMS
COMPACT_ARMS = v14.COMPACT_ARMS
DECISION_FAMILIES = v14.DECISION_FAMILIES
GUARD_FAMILIES = v14.GUARD_FAMILIES
FAMILIES = v14.FAMILIES
UNIQUE_COUNTS = deepcopy(v14.UNIQUE_COUNTS)
REPEATS = deepcopy(v14.REPEATS)
PROVIDERS = v14.PROVIDERS
MODELS = v14.MODELS
KEYS = v14.KEYS
SETTINGS = {
    "openai": {
        "reasoning_effort": "medium",
        "max_completion_tokens": 12000,
        "temperature": "provider default; omitted from request",
    },
    "gemini": {
        "thinking_level": "medium",
        "max_output_tokens": 12000,
        "temperature": "provider default; omitted from request",
    },
    "claude-haiku": {
        "thinking": {"type": "enabled", "budget_tokens": 4096},
        "max_tokens": 24000,
        "temperature": "provider default; omitted from request",
    },
}
MAXIMUM_CALLS = v14.MAXIMUM_CALLS
MAXIMUM_TOKEN_COUNT_REQUESTS = MAXIMUM_CALLS
RECENT_COST_ESTIMATE = {
    "openai": Decimal("0.900000"),
    "gemini": Decimal("0.350000"),
    "claude-haiku": Decimal("3.500000"),
}
PROVIDER_COST_LIMITS = {
    "openai": Decimal("1.200000"),
    "gemini": Decimal("0.550000"),
    "claude-haiku": Decimal("4.600000"),
}
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "validity-ladder-r1-approval.json"
HISTORICAL_PACKAGES = (*v14.HISTORICAL_PACKAGES, "compact-format-v14")
DEPENDENCIES = (
    BENCHMARKS_ROOT / "compact-format-v14" / "benchmark.py",
    *v14.DEPENDENCIES,
)
POSITIONAL_ARM = v14.POSITIONAL_ARM
RUN_KIND_PROVIDER = "validity-ladder-provider"
RUN_KIND_SUMMARY = "validity-ladder-summary"


def configure_inherited_runner() -> None:
    values = {
        "PACKAGE_ROOT": PACKAGE_ROOT,
        "SCHEMA": SCHEMA,
        "CORPUS_SCHEMA": CORPUS_SCHEMA,
        "RUN_ID": RUN_ID,
        "COHORT": COHORT,
        "SEED": SEED,
        "VARIANT_OFFSET": VARIANT_OFFSET,
        "SETTINGS": SETTINGS,
        "MAXIMUM_CALLS": MAXIMUM_CALLS,
        "MAXIMUM_TOKEN_COUNT_REQUESTS": MAXIMUM_TOKEN_COUNT_REQUESTS,
        "RECENT_COST_ESTIMATE": RECENT_COST_ESTIMATE,
        "PROVIDER_COST_LIMITS": PROVIDER_COST_LIMITS,
        "APPROVAL_PATH": APPROVAL_PATH,
        "HISTORICAL_PACKAGES": HISTORICAL_PACKAGES,
        "DEPENDENCIES": DEPENDENCIES,
    }
    for name, value in values.items():
        setattr(v14, name, value)
    base.SETTINGS = {
        provider: {
            key: value
            for key, value in SETTINGS[provider].items()
            if key != "temperature"
        }
        for provider in PROVIDERS
    }


configure_inherited_runner()
_inherited_stopping_rule = v14.stopping_rule
_inherited_candidate_definitions = v14.candidate_definitions


def refresh_task(value: dict[str, Any]) -> dict[str, Any]:
    return v14.refresh_task(value)


def candidate_definitions() -> dict[str, dict[str, Any]]:
    value = deepcopy(_inherited_candidate_definitions())
    for definition in value.values():
        definition["parser"] = "v15-strict-conformance-plus-case-components"
    return value


def candidate_hashes() -> dict[str, str]:
    return {
        arm: core.digest(definition)
        for arm, definition in candidate_definitions().items()
    }


def task_difficulty(task: dict[str, Any]) -> str:
    if task["family"] == "document-serialization":
        return "positive-control"
    if task["family"] == "continuation-affine":
        return "moderate"
    count = task["contract"]["case_count"]
    return {1: "light", 2: "moderate", 4: "stress"}[count]


def make_corpus() -> dict[str, Any]:
    # Variants 180 through 187 map to 1, 1, 1, 2, 2, 2, 4, and 4 cases.
    core.ANALYSIS_BATCH_COUNTS[COHORT] = (2, 2, 4, 4, 1, 1, 1, 2)
    analysis = []
    for index in range(UNIQUE_COUNTS["comprehension-analysis"]):
        task = base.transform_holdout(
            core.analysis_task(COHORT, VARIANT_OFFSET + index, SEED), 44, 19
        )
        task["difficulty"] = task_difficulty(task)
        analysis.append(refresh_task(task))
    continuation = []
    for index in range(UNIQUE_COUNTS["continuation-affine"]):
        task = core.motif_task(COHORT, VARIANT_OFFSET + 8 + index, SEED)
        task["family"] = "continuation-affine"
        task["difficulty"] = "moderate"
        continuation.append(refresh_task(task))
    serialization = []
    for index in range(UNIQUE_COUNTS["document-serialization"]):
        variant = VARIANT_OFFSET + 16 + index
        source = core.motif_task(COHORT, variant, SEED)
        notes = deepcopy(source["expected"])
        serialization.append(
            refresh_task(
                {
                    "schema": core.SCHEMA,
                    "id": f"{COHORT}-document-serialization-v{variant}",
                    "cohort": COHORT,
                    "family": "document-serialization",
                    "difficulty": "positive-control",
                    "variant": variant,
                    "origin": "generated",
                    "license": "MIT",
                    "expected": notes,
                    "target_notes": notes,
                }
            )
        )
    value = {
        "schema": CORPUS_SCHEMA,
        "cohort": COHORT,
        "license": "MIT",
        "fixtures": {
            "comprehension-analysis": analysis,
            "continuation-affine": continuation,
            "document-serialization": serialization,
        },
    }
    value["sha256"] = core.digest(value)
    return value


def represented_source(arm: str, task: dict[str, Any]) -> str | None:
    return v14.represented_source(arm, task)


def perfect_document(task: dict[str, Any]) -> dict[str, Any]:
    return v14.perfect_document(task)


def perfect_payload(arm: str, task: dict[str, Any]) -> str:
    return v14.perfect_payload(arm, task)


def task_instruction(arm: str, task: dict[str, Any]) -> str:
    family = task["family"]
    if family == "comprehension-analysis":
        return core.analysis_instruction(task)
    if family == "continuation-affine":
        contract = task["contract"]
        return (
            "Apply one compound-affine operation to all six source events in "
            "canonical order. Use output IDs "
            + ",".join(contract["output_ids"])
            + " in the same order. Calculate pitch=(2*axis)-source_pitch+semitones. "
            "First multiply axis by 2. Then subtract source_pitch. Then add semitones. "
            "For example, axis=60, source_pitch=64, and semitones=2 gives pitch=58. "
            f"For this task, axis={contract['axis']} and semitones={contract['semitones']}. "
            f"Set start={contract['output_start']}+(source_start-first_source_start)*"
            f"{contract['rhythmic_factor']} and duration=source_duration*"
            f"{contract['rhythmic_factor']}. Preserve voice and velocity. Return "
            "only the six output notes."
        )
    if arm == "exact-object-json":
        context = (
            f"Set base_sha256 to the string \"none\". Set source_id to the exact "
            f"string \"{task['id']}\". Set omits to the fixed omission array and "
            "set every overlay array to empty."
        )
    else:
        context = (
            f"Use the exact header BASE none. Use the exact header SOURCE {task['id']}. "
            "Use the fixed OMITS declaration and empty overlays."
        )
    return (
        "Serialize exactly these target notes. Do not calculate or change a value. "
        + context
        + " Target notes: "
        + core.canonical(task["target_notes"])
    )


def prompt_for(job: dict[str, Any]) -> str:
    arm = job["arm"]
    task = job["task"]
    family = job["family"]
    if family == "comprehension-analysis":
        representation = (
            f"Input representation: {arm}. This name describes only the input. "
            "Use the shared analysis output grammar."
        )
        grammar = v14.analysis_grammar()
    else:
        representation = (
            f"Input and output representation: {arm}."
            if family == "continuation-affine"
            else f"Output representation: {arm}."
        )
        grammar = v14.document_grammar(arm)
    parts = [
        "Complete one deterministic symbolic-music task.",
        "Return one JSON object with exactly one string field named payload. Put "
        "the requested representation in that string. Do not add prose.",
        f"Difficulty level: {task_difficulty(task)}.",
        representation,
        grammar,
        "Follow this complete output example, but use the task values:\n"
        + v14.example_for(arm, family),
        task_instruction(arm, task),
    ]
    if family == "continuation-affine":
        if arm == "exact-object-json":
            parts.append(
                f"Set base_sha256 to \"{core.digest(core.projected(task['source']))}\" "
                f"and source_id to \"{task['id']}\". Use the fixed omission array "
                "and empty overlay arrays."
            )
        else:
            parts.append(
                f"Use exact output headers BASE {core.digest(core.projected(task['source']))} "
                f"and SOURCE {task['id']}. Use the fixed OMITS declaration and empty overlays."
            )
    source = represented_source(arm, task)
    if source is not None:
        parts.extend(("<input_document>", source, "</input_document>"))
    return "\n\n".join(parts)


def case_record(case_id: str, components: dict[str, bool]) -> dict[str, Any]:
    correct = sum(components.values())
    planned = len(components)
    return {
        "case_id": case_id,
        "components": components,
        "correct": correct,
        "planned": planned,
        "accuracy": round(correct / planned, 6),
        "perfect": correct == planned,
    }


def score_value(
    structural: bool,
    canonical: bool,
    cases: list[dict[str, Any]],
    response_components: dict[str, bool],
    diagnostic: dict[str, Any] | None,
) -> dict[str, Any]:
    case_correct = sum(case["correct"] for case in cases)
    case_planned = sum(case["planned"] for case in cases)
    response_correct = sum(response_components.values())
    response_planned = len(response_components)
    return {
        "structural_parse_pass": structural,
        "canonical_form_pass": canonical,
        "syntax_pass": canonical,
        "cases": cases,
        "response_components": response_components,
        "component": {
            "correct": case_correct + response_correct,
            "planned": case_planned + response_planned,
            "case_correct": case_correct,
            "case_planned": case_planned,
            "response_correct": response_correct,
            "response_planned": response_planned,
        },
        "diagnostic": diagnostic,
    }


def loose_analysis(payload: str) -> dict[str, list[str]]:
    text = payload.strip().removeprefix("ANALYSIS ")
    result: dict[str, list[str]] = {}
    for token in text.split():
        if "=" not in token:
            continue
        name, raw = token.split("=", 1)
        if name in core.ANALYSIS_FIELDS:
            values = raw.split(",") if raw else []
            if name in core.ANALYSIS_INTEGER_FIELDS:
                converted = []
                for value in values:
                    try:
                        converted.append(int(value))
                    except ValueError:
                        converted.append(value)
                result[name] = converted
            else:
                result[name] = values
    return result


def analysis_score(task: dict[str, Any], payload: str) -> dict[str, Any]:
    actual = loose_analysis(payload)
    count = task["contract"]["case_count"]
    structural = set(actual) == set(core.ANALYSIS_FIELDS) and all(
        len(actual[field]) == count for field in core.ANALYSIS_FIELDS
    )
    canonical = structural and payload == core.render_analysis(actual).removeprefix(
        "ANALYSIS "
    )
    cases = []
    for index in range(count):
        components = {
            field: index < len(actual.get(field, []))
            and actual[field][index] == task["expected"][field][index]
            for field in core.ANALYSIS_FIELDS
        }
        cases.append(case_record(f"case-{index + 1}", components))
    failed = [
        f"{case['case_id']}.{name}"
        for case in cases
        for name, passed in case["components"].items()
        if not passed
    ]
    return score_value(
        structural,
        canonical,
        cases,
        {},
        None
        if structural and canonical and not failed
        else {
            "class": "component-or-conformance",
            "failed_components": failed,
        },
    )


def loose_document(arm: str, payload: str) -> dict[str, Any]:
    if arm == "exact-object-json":
        value = json.loads(payload)
        if not isinstance(value, dict):
            raise ValueError("The payload is not a JSON object")
        notes = []
        for row in value.get("notes", []) if isinstance(value.get("notes"), list) else []:
            try:
                notes.append(core.normalize_note(row))
            except (KeyError, TypeError, ValueError):
                continue
        return {
            "schema": value.get("schema"),
            "base_sha256": value.get("base_sha256"),
            "source_id": value.get("source_id"),
            "omits": value.get("omits"),
            "overlays": value.get("overlays"),
            "notes": notes,
        }
    lines = [line.strip() for line in payload.splitlines() if line.strip()]
    base_value = next((line[5:] for line in lines if line.startswith("BASE ")), None)
    source_id = next((line[7:] for line in lines if line.startswith("SOURCE ")), None)
    omits = next((line[6:].split() for line in lines if line.startswith("OMITS ")), None)
    pattern = (
        re.compile(r"N (\S+) (\S+) (\S+) (\S+) (\d+) (\d+)")
        if arm == "compact-bar-fields"
        else v14.LOCAL_NOTE_PATTERN
    )
    notes = []
    unexpected_rows = []
    for line in lines:
        match = pattern.fullmatch(line)
        if match is None:
            if not (
                line.startswith("BASE ")
                or line.startswith("SOURCE ")
                or line.startswith("OMITS ")
                or line.startswith("FIELDS ")
            ):
                unexpected_rows.append(line)
            continue
        values = match.groups()
        try:
            notes.append(
                core.note(
                    values[0], values[1], values[2], values[3],
                    int(values[4]), int(values[5]),
                )
            )
        except (TypeError, ValueError):
            continue
    return {
        "schema": core.SCHEMA,
        "base_sha256": base_value,
        "source_id": source_id,
        "omits": omits,
        "overlays": core.empty_overlays() if not unexpected_rows else None,
        "notes": notes,
    }


def document_score(arm: str, task: dict[str, Any], payload: str) -> dict[str, Any]:
    strict_error = None
    try:
        document = v14.strict_document(arm, payload)
        structural = True
        canonical = True
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        strict_error = str(error)
        canonical = False
        try:
            document = loose_document(arm, payload)
            structural = bool(document["notes"])
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as loose_error:
            document = {"notes": []}
            structural = False
            strict_error = str(loose_error)
    expected = perfect_document(task)
    expected_by_id = {row["id"]: row for row in expected["notes"]}
    actual_notes = document.get("notes", [])
    actual_by_id = {row["id"]: row for row in actual_notes}
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
    response_components = {
        "schema": document.get("schema") == expected["schema"],
        "base_sha256": document.get("base_sha256") == expected["base_sha256"],
        "source_id": document.get("source_id") == expected["source_id"],
        "omits": document.get("omits") == expected["omits"],
        "overlays": document.get("overlays") == expected["overlays"],
        "globally_unique_ids": len(actual_by_id) == len(actual_notes),
        "note_set": set(actual_by_id) == set(expected_by_id),
    }
    failed = [
        f"{case['case_id']}.{name}"
        for case in cases
        for name, passed in case["components"].items()
        if not passed
    ] + [name for name, passed in response_components.items() if not passed]
    return score_value(
        structural,
        canonical,
        cases,
        response_components,
        None
        if canonical and not failed
        else {
            "class": "component-or-conformance",
            "canonical_error": strict_error,
            "failed_components": failed,
        },
    )


def score_response(arm: str, task: dict[str, Any], payload: str) -> dict[str, Any]:
    if task["family"] == "comprehension-analysis":
        return analysis_score(task, payload)
    return document_score(arm, task, payload)


def parse_failure_for_task(task: dict[str, Any], message: str) -> dict[str, Any]:
    if task["family"] == "comprehension-analysis":
        cases = [
            case_record(
                f"case-{index + 1}",
                {field: False for field in core.ANALYSIS_FIELDS},
            )
            for index in range(task["contract"]["case_count"])
        ]
        response_components: dict[str, bool] = {}
    else:
        cases = [
            case_record(row["id"], {field: False for field in core.FIELDS})
            for row in task["expected"]
        ]
        response_components = {
            name: False
            for name in (
                "schema", "base_sha256", "source_id", "omits", "overlays",
                "globally_unique_ids", "note_set",
            )
        }
    return score_value(
        False,
        False,
        cases,
        response_components,
        {"class": "structural-parse", "message": message},
    )


_active_task: dict[str, Any] | None = None
_inherited_one_call = v14.one_call


def one_call(
    provider: str, key: str, job: dict[str, Any], guard: Any
) -> tuple[dict[str, Any], dict[str, Any]]:
    global _active_task
    _active_task = job["task"]
    try:
        return _inherited_one_call(provider, key, job, guard)
    finally:
        _active_task = None


def active_parse_failure(message: str) -> dict[str, Any]:
    if _active_task is None:
        raise RuntimeError("A task is required for component denominators")
    return parse_failure_for_task(_active_task, message)


def package_files() -> dict[str, str]:
    return {
        name: base.file_sha256(PACKAGE_ROOT / name)
        for name in ("benchmark.py", "README.md", "PROTOCOL.md")
    }


def dependency_files() -> dict[str, str]:
    return {
        str(path.relative_to(BENCHMARKS_ROOT)): base.file_sha256(path)
        for path in DEPENDENCIES
    }


def decision_rule() -> dict[str, Any]:
    return {
        "outcomes": ["operator-review", "invalid"],
        "minimum_provider_completion": 0.95,
        "minimum_scored_cell_coverage": 0.75,
        "musical_thresholds": None,
        "exact_json_role": (
            "A valid serialization arm. It has no capability-control gate."
        ),
        "operator_criterion": (
            "The operator decides whether every format has decent but not flawless "
            "case-level performance and whether the benchmark is valid."
        ),
        "selection_authority": (
            "The summary reports validity and measurements. Only the operator can "
            "approve a full benchmark or change the retained formats."
        ),
    }


def stopping_rule() -> dict[str, Any]:
    value = _inherited_stopping_rule()
    value["value_of_information"] = (
        "Finish all providers unless a frozen operational stop applies. Then wait "
        "for the operator's benchmark decision."
    )
    return value


def effective_request_settings(provider: str) -> dict[str, Any]:
    value = deepcopy(SETTINGS[provider])
    value.pop("temperature")
    return value


def prompt_manifest() -> dict[str, list[dict[str, Any]]]:
    hashes = candidate_hashes()
    return {
        provider: [
            {
                "planned_sequence": job["planned_sequence"],
                "arm": job["arm"],
                "candidate_sha256": hashes[job["arm"]],
                "family": job["family"],
                "difficulty": task_difficulty(job["task"]),
                "variant": job["variant"],
                "repeat": job["repeat"],
                "task_sha256": job["task"]["sha256"],
                "prompt_sha256": core.sha256_text(prompt_for(job)),
                "prompt_bytes": len(prompt_for(job).encode()),
            }
            for job in v14.jobs(provider)
        ]
        for provider in PROVIDERS
    }


def protocol_manifest() -> dict[str, Any]:
    audit = v14.cohort_audit()
    value = {
        "schema": SCHEMA,
        "run_kind": "validity-ladder-protocol",
        "run_id": RUN_ID,
        "package_files": package_files(),
        "dependency_files": dependency_files(),
        "cohort": COHORT,
        "cohort_audit": audit,
        "candidate_definitions": candidate_definitions(),
        "candidate_sha256": candidate_hashes(),
        "arms": list(ARMS),
        "families": {
            family: {
                "unique_fixtures": UNIQUE_COUNTS[family],
                "repeats": REPEATS[family],
                "role": "measurement" if family in DECISION_FAMILIES else "validity-guard",
            }
            for family in FAMILIES
        },
        "difficulty_ladder": {
            "positive-control": "Literal six-note serialization with no calculation.",
            "light": "One independent analysis case.",
            "moderate": "Two independent analysis cases or six-note affine work.",
            "stress": "Four independent analysis cases.",
            "analysis_fixture_counts": {"light": 3, "moderate": 3, "stress": 2},
            "interleaving": "Shuffle task groups, then run all three arms as one block.",
        },
        "models": MODELS,
        "declared_settings": SETTINGS,
        "effective_request_settings": {
            provider: effective_request_settings(provider) for provider in PROVIDERS
        },
        "prompts": prompt_manifest(),
        "calls": {
            "maximum_per_provider": MAXIMUM_CALLS,
            "maximum_all_providers": MAXIMUM_CALLS * len(PROVIDERS),
            "maximum_haiku_token_count_requests": MAXIMUM_TOKEN_COUNT_REQUESTS,
            "automatic_retries": 0,
            "repairs": 0,
        },
        "cost_guard": {
            "recent_cost_estimate_usd": {
                provider: base.rounded_usd(amount)
                for provider, amount in RECENT_COST_ESTIMATE.items()
            },
            "recent_cost_estimate_total_usd": base.rounded_usd(
                sum(RECENT_COST_ESTIMATE.values(), Decimal(0))
            ),
            "maximum_provider_cost_usd": {
                provider: base.rounded_usd(amount)
                for provider, amount in PROVIDER_COST_LIMITS.items()
            },
            "maximum_total_cost_usd": base.rounded_usd(
                sum(PROVIDER_COST_LIMITS.values(), Decimal(0))
            ),
            "maximum_call_cost_usd": {
                provider: base.rounded_usd(base.maximum_call_cost(provider))
                for provider in PROVIDERS
            },
            "input_token_ceiling_per_call": base.INPUT_TOKEN_CEILING,
            "output_token_ceiling_per_call": {
                provider: base.output_token_limit(provider) for provider in PROVIDERS
            },
            "request_byte_ceiling_per_call": base.REQUEST_BYTE_CEILING,
            "failed_reservation": "retained",
        },
        "measurement": {
            "musical_unit": "independent case",
            "whole_response_musical_score": False,
            "required_aggregates": [
                "global component accuracy",
                "average per-case component accuracy",
                "perfect case count and rate",
            ],
            "parse_failure_policy": (
                "Retain every planned case and component. Mark unavailable parsed "
                "components incorrect."
            ),
            "response_level_metrics": [
                "structural parse conformance",
                "canonical form conformance",
            ],
            "provider_pooling": False,
        },
        "decision_rule": decision_rule(),
        "stopping_rule": stopping_rule(),
        "approval_boundary": (
            "No token-count or provider request is approved until the operator "
            "approves the exact protocol and run-plan hashes and hard limit."
        ),
        "privacy": "Generated MIT symbolic text only.",
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    value = {
        "schema": SCHEMA,
        "run_kind": "validity-ladder-plan",
        "run_id": RUN_ID,
        "protocol_sha256": protocol["sha256"],
        "cohort_sha256": protocol["cohort_audit"]["corpus_sha256"],
        "historical_snapshot": protocol["cohort_audit"]["historical_snapshot"],
        "candidate_sha256": protocol["candidate_sha256"],
        "arms": protocol["arms"],
        "families": protocol["families"],
        "difficulty_ladder": protocol["difficulty_ladder"],
        "models": MODELS,
        "declared_settings": SETTINGS,
        "effective_request_settings": protocol["effective_request_settings"],
        "calls": protocol["calls"],
        "cost_guard": protocol["cost_guard"],
        "measurement": protocol["measurement"],
        "decision_rule": protocol["decision_rule"],
        "stopping_rule": protocol["stopping_rule"],
        "schedule_sha256": {
            provider: core.digest(protocol["prompts"][provider])
            for provider in PROVIDERS
        },
        "approval": "pending",
    }
    value["sha256"] = core.digest(value)
    return value


def prompt_visibility_screen() -> dict[str, Any]:
    rows = []
    for family in FAMILIES:
        task = make_corpus()["fixtures"][family][0]
        for arm in ARMS:
            prompt = prompt_for({"arm": arm, "family": family, "task": task})
            required = [f"Difficulty level: {task_difficulty(task)}."]
            if family == "continuation-affine":
                required.extend(
                    [
                        "pitch=(2*axis)-source_pitch+semitones",
                        "First multiply axis by 2",
                        "axis=60, source_pitch=64, and semitones=2 gives pitch=58",
                    ]
                )
            if family == "document-serialization" and arm == "exact-object-json":
                required.extend(
                    [
                        'base_sha256 to the string "none"',
                        f'source_id to the exact string "{task["id"]}"',
                    ]
                )
            missing = [fragment for fragment in required if fragment not in prompt]
            rows.append({"family": family, "arm": arm, "missing": missing})
    exact_prompt = prompt_for(
        {
            "arm": "exact-object-json",
            "family": "document-serialization",
            "task": make_corpus()["fixtures"]["document-serialization"][0],
        }
    )
    return {
        "rows": rows,
        "exact_json_compact_header_leak_absent": "Use literal BASE none" not in exact_prompt,
        "all_visible": all(not row["missing"] for row in rows)
        and "Use literal BASE none" not in exact_prompt,
    }


def metric_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    scores = [v14.row_score(row) for row in rows if v14.row_score(row) is not None]
    cases = [case for score in scores for case in score["cases"]]
    component_correct = sum(score["component"]["correct"] for score in scores)
    component_planned = sum(score["component"]["planned"] for score in scores)
    perfect = sum(case["perfect"] for case in cases)
    average = (
        round(sum(case["accuracy"] for case in cases) / len(cases), 6)
        if cases
        else None
    )
    denominators = v14.denominator_summary(rows)
    return {
        **{name: denominators[name] for name in (
            "planned", "attempted", "provider_completed", "available", "scored",
            "failed", "unavailable", "budget_stopped",
        )},
        "structural_parse_passes": sum(score["structural_parse_pass"] for score in scores),
        "structural_parse_rate_scored": safe_rate(
            sum(score["structural_parse_pass"] for score in scores), len(scores)
        ),
        "canonical_form_passes": sum(score["canonical_form_pass"] for score in scores),
        "canonical_form_rate_scored": safe_rate(
            sum(score["canonical_form_pass"] for score in scores), len(scores)
        ),
        "global_component_correct": component_correct,
        "global_component_planned": component_planned,
        "global_component_accuracy": safe_rate(component_correct, component_planned),
        "case_count": len(cases),
        "average_per_case_component_accuracy": average,
        "perfect_cases": perfect,
        "perfect_case_rate": safe_rate(perfect, len(cases)),
    }


def safe_rate(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator, 6) if denominator else None


def difficulty_for_row(row: dict[str, Any]) -> str:
    lookup = {
        (task["family"], task["variant"]): task_difficulty(task)
        for tasks in make_corpus()["fixtures"].values()
        for task in tasks
    }
    return lookup[(row["family"], row["variant"])]


def cell_summaries(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cells = []
    for family in FAMILIES:
        difficulties = sorted(
            {
                task_difficulty(task)
                for task in make_corpus()["fixtures"][family]
            }
        )
        for difficulty in difficulties:
            for arm in ARMS:
                selected = [
                    row
                    for row in rows
                    if row["family"] == family
                    and row["arm"] == arm
                    and difficulty_for_row(row) == difficulty
                ]
                cells.append(
                    {
                        "family": family,
                        "difficulty": difficulty,
                        "arm": arm,
                        **metric_summary(selected),
                    }
                )
    return cells


def provider_summary(run: dict[str, Any]) -> dict[str, Any]:
    rows = run["results"]
    cells = cell_summaries(rows)
    completion = safe_rate(run["progress"]["provider_completed"], run["progress"]["planned"])
    minimum_coverage = decision_rule()["minimum_scored_cell_coverage"]
    cell_coverage_pass = all(
        cell["scored"] / cell["planned"] >= minimum_coverage
        for cell in cells
        if cell["planned"]
    )
    return {
        "provider": run["provider"],
        "progress": run["progress"],
        "completion_rate": completion,
        "completion_pass": completion is not None
        and completion >= decision_rule()["minimum_provider_completion"],
        "cell_coverage_pass": cell_coverage_pass,
        "overall": metric_summary(rows),
        "by_family_difficulty_arm": cells,
        "size": v14.runtime_size_summary(rows),
        "actual_cost_usd": run["actual_cost_usd"],
    }


def summarize_runs(runs: list[dict[str, Any]]) -> dict[str, Any]:
    by_provider = {run["provider"]: run for run in runs}
    if set(by_provider) != set(PROVIDERS):
        raise ValueError("The summary needs all three provider manifests")
    providers = [provider_summary(by_provider[provider]) for provider in PROVIDERS]
    exact_totals = {
        provider: sum(
            (
                Decimal(str(call["cost_usd"]["total"]))
                for row in by_provider[provider]["results"]
                for call in (row.get("initial_call"),)
                if call is not None and call.get("cost_usd") is not None
            ),
            Decimal(0),
        )
        for provider in PROVIDERS
    }
    valid = all(
        provider["completion_pass"] and provider["cell_coverage_pass"]
        for provider in providers
    )
    value = {
        "schema": SCHEMA,
        "run_kind": RUN_KIND_SUMMARY,
        "run_id": RUN_ID,
        "protocol_sha256": protocol_manifest()["sha256"],
        "run_plan_sha256": run_plan()["sha256"],
        "candidate_sha256": candidate_hashes(),
        "providers": providers,
        "actual_cost_usd": {
            **{
                provider: base.rounded_usd(total)
                for provider, total in exact_totals.items()
            },
            "total": base.rounded_usd(sum(exact_totals.values(), Decimal(0))),
        },
        "decision": "operator-review" if valid else "invalid",
        "selection_authority": decision_rule()["selection_authority"],
    }
    value["sha256"] = core.digest(value)
    return value


def scoring_screen() -> dict[str, Any]:
    corpus = make_corpus()
    checks: dict[str, bool] = {}
    for family, tasks in corpus["fixtures"].items():
        task = tasks[0]
        for arm in ARMS:
            perfect = score_response(arm, task, perfect_payload(arm, task))
            checks[f"{family}:{arm}:perfect-cases"] = all(
                case["perfect"] for case in perfect["cases"]
            )
            checks[f"{family}:{arm}:perfect-components"] = (
                perfect["component"]["correct"] == perfect["component"]["planned"]
            )
            failed = parse_failure_for_task(task, "synthetic")
            checks[f"{family}:{arm}:failure-retains-components"] = (
                failed["component"]["planned"] == perfect["component"]["planned"]
                and failed["component"]["correct"] == 0
                and len(failed["cases"]) == len(perfect["cases"])
            )
    analysis = corpus["fixtures"]["comprehension-analysis"][0]
    payload = perfect_payload("compact-bar-fields", analysis)
    first_field = core.ANALYSIS_FIELDS[0]
    changed = re.sub(
        rf"({first_field}=)[^, ]+", rf"\g<1>wrong", payload, count=1
    )
    changed_score = analysis_score(analysis, changed)
    checks["single-component-loss-is-granular"] = (
        changed_score["component"]["correct"]
        == changed_score["component"]["planned"] - 1
    )
    checks["analysis-ladder-counts"] = sorted(
        task["contract"]["case_count"]
        for task in corpus["fixtures"]["comprehension-analysis"]
    ) == [1, 1, 1, 2, 2, 2, 4, 4]
    return {"checks": checks, "all_pass": all(checks.values())}


def aggregation_screen() -> dict[str, Any]:
    task = make_corpus()["fixtures"]["comprehension-analysis"][0]
    perfect = score_response(
        "compact-bar-fields", task, perfect_payload("compact-bar-fields", task)
    )
    failed = parse_failure_for_task(task, "synthetic")
    rows = []
    for score in (perfect, failed):
        rows.append(
            {
                "initial": core.result_state("initial", score),
                "attempted": True,
                "provider_completed": True,
                "budget_stopped": False,
            }
        )
    summary = metric_summary(rows)
    return {
        "values": summary,
        "all_pass": (
            summary["case_count"] == 2
            and summary["global_component_accuracy"] == 0.5
            and summary["average_per_case_component_accuracy"] == 0.5
            and summary["perfect_cases"] == 1
            and summary["perfect_case_rate"] == 0.5
        ),
    }


def summary_screen() -> dict[str, Any]:
    runs = []
    for provider in PROVIDERS:
        rows = []
        for job in v14.jobs(provider):
            score = (
                parse_failure_for_task(job["task"], "synthetic exact failure")
                if job["arm"] == "exact-object-json"
                else score_response(
                    job["arm"],
                    job["task"],
                    perfect_payload(job["arm"], job["task"]),
                )
            )
            rows.append(
                {
                    "family": job["family"],
                    "arm": job["arm"],
                    "variant": job["variant"],
                    "repeat": job["repeat"],
                    "initial": core.result_state("initial", score),
                    "initial_call": None,
                    "attempted": True,
                    "provider_completed": True,
                    "budget_stopped": False,
                }
            )
        denominators = v14.denominator_summary(rows)
        runs.append(
            {
                "provider": provider,
                "results": rows,
                "progress": {
                    name: denominators[name]
                    for name in (
                        "planned", "attempted", "provider_completed", "available",
                        "scored", "failed", "unavailable", "budget_stopped",
                    )
                },
                "actual_cost_usd": 0.0,
            }
        )
    summary = summarize_runs(runs)
    cells = [
        cell
        for provider in summary["providers"]
        for cell in provider["by_family_difficulty_arm"]
    ]
    required = {
        "global_component_accuracy",
        "average_per_case_component_accuracy",
        "perfect_cases",
        "perfect_case_rate",
    }
    checks = {
        "exact_has_no_musical_gate": summary["decision"] == "operator-review",
        "all_primary_cells_present": len(cells) == len(PROVIDERS) * 15,
        "all_component_reports_present": all(required <= set(cell) for cell in cells),
        "exact_failures_are_visible": all(
            cell["global_component_accuracy"] == 0.0
            for cell in cells
            if cell["arm"] == "exact-object-json"
        ),
    }
    return {"checks": checks, "all_pass": all(checks.values())}


def deterministic_screen() -> dict[str, Any]:
    audit = v14.cohort_audit()
    schedules = {provider: v14.jobs(provider) for provider in PROVIDERS}
    visibility = prompt_visibility_screen()
    scoring = scoring_screen()
    aggregation = aggregation_screen()
    summary = summary_screen()
    costs = v14.cost_screen()
    preflight = v14.preflight_screen()
    provider_accounting = v14.provider_accounting_screen()
    prompts = [prompt_for(job) for rows in schedules.values() for job in rows]
    blocks = {
        provider: [
            rows[index : index + len(ARMS)]
            for index in range(0, len(rows), len(ARMS))
        ]
        for provider, rows in schedules.items()
    }
    freshness = all(
        audit[name] == 0
        for name in (
            "internal_full_duplicates",
            "internal_semantic_duplicates",
            "prior_full_overlap",
            "prior_semantic_overlap",
            "prior_analysis_case_overlap",
        )
    )
    value = {
        "schema": SCHEMA,
        "job_count_per_provider": {
            provider: len(rows) for provider, rows in schedules.items()
        },
        "expected_job_count_per_provider": MAXIMUM_CALLS,
        "candidate_sha256": candidate_hashes(),
        "cohort_audit": audit,
        "visibility": visibility,
        "scoring": scoring,
        "aggregation": aggregation,
        "summary": summary,
        "cost": costs,
        "preflight": preflight,
        "provider_accounting": provider_accounting,
        "all_blocks_have_all_arms": all(
            set(row["arm"] for row in block) == set(ARMS)
            for provider_blocks in blocks.values()
            for block in provider_blocks
        ),
        "planned_sequences_are_contiguous": all(
            [row["planned_sequence"] for row in rows]
            == list(range(1, MAXIMUM_CALLS + 1))
            for rows in schedules.values()
        ),
        "all_requests_fit": all(
            base.request_bytes(provider, prompt) <= base.REQUEST_BYTE_CEILING
            for provider in PROVIDERS
            for prompt in prompts
        ),
        "historical_snapshot_excludes_current": "compact-format-v15"
        not in HISTORICAL_PACKAGES,
        "retired_arms_absent": POSITIONAL_ARM not in ARMS,
    }
    value["all_checks_pass"] = all(
        (
            all(count == MAXIMUM_CALLS for count in value["job_count_per_provider"].values()),
            freshness,
            visibility["all_visible"],
            scoring["all_pass"],
            aggregation["all_pass"],
            summary["all_pass"],
            costs["all_pass"],
            preflight["all_pass"],
            provider_accounting["all_pass"],
            value["all_blocks_have_all_arms"],
            value["planned_sequences_are_contiguous"],
            value["all_requests_fit"],
            value["historical_snapshot_excludes_current"],
            value["retired_arms_absent"],
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
        "cohort_sha256": protocol["cohort_audit"]["corpus_sha256"],
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
        raise ValueError("Approval does not match the frozen v15 plan")
    if (
        value.get("status") != "approved"
        or not isinstance(value.get("operator_statement"), str)
        or not value["operator_statement"].strip()
    ):
        raise ValueError("Approval needs an explicit operator statement")
    return value


def run_provider(provider: str, env_file: Path, approval_file: Path) -> dict[str, Any]:
    value = v14.run_provider(provider, env_file, approval_file)
    value["run_kind"] = RUN_KIND_PROVIDER
    for row in value["results"]:
        row["difficulty"] = difficulty_for_row(row)
    value["manifest_sha256"] = core.digest(
        {name: item for name, item in value.items() if name != "manifest_sha256"}
    )
    return value


def load_manifest(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    unsigned = deepcopy(value)
    claimed = unsigned.pop("manifest_sha256", None)
    if claimed != core.digest(unsigned):
        raise ValueError(f"Manifest hash mismatch: {path}")
    provider = value.get("provider")
    if provider not in PROVIDERS:
        raise ValueError(f"Manifest has an unknown provider: {path}")
    expected = v14.jobs(provider)
    rows = value.get("results", [])
    expected_identity = [
        (
            job["planned_sequence"], job["arm"], job["family"], job["variant"],
            job["repeat"], job["task"]["sha256"], task_difficulty(job["task"]),
        )
        for job in expected
    ]
    actual_identity = [
        (
            row.get("planned_sequence"), row.get("arm"), row.get("family"),
            row.get("variant"), row.get("repeat"), row.get("task_sha256"),
            row.get("difficulty"),
        )
        for row in rows
    ]
    if (
        value.get("run_id") != RUN_ID
        or value.get("run_kind") != RUN_KIND_PROVIDER
        or value.get("protocol_sha256") != protocol_manifest()["sha256"]
        or value.get("run_plan_sha256") != run_plan()["sha256"]
        or value.get("cohort_sha256") != make_corpus()["sha256"]
        or value.get("candidate_sha256") != candidate_hashes()
        or value.get("requested_model") != MODELS[provider]
        or value.get("declared_settings") != SETTINGS[provider]
        or value.get("effective_request_settings") != effective_request_settings(provider)
        or value.get("schedule_sha256") != run_plan()["schedule_sha256"][provider]
        or len(rows) != MAXIMUM_CALLS
        or actual_identity != expected_identity
    ):
        raise ValueError(f"Manifest does not match the frozen v15 run: {path}")
    approval = value.get("approval", {})
    plan = run_plan()
    if (
        approval.get("status") != "approved"
        or approval.get("run_id") != RUN_ID
        or approval.get("protocol_sha256") != plan["protocol_sha256"]
        or approval.get("run_plan_sha256") != plan["sha256"]
        or approval.get("cohort_sha256") != plan["cohort_sha256"]
        or approval.get("candidate_sha256") != plan["candidate_sha256"]
        or approval.get("maximum_total_cost_usd")
        != plan["cost_guard"]["maximum_total_cost_usd"]
        or not isinstance(approval.get("operator_statement"), str)
        or not approval["operator_statement"].strip()
        or value.get("screen_sha256") != deterministic_screen()["sha256"]
    ):
        raise ValueError(f"Manifest approval or screen identity is invalid: {path}")
    denominators = v14.denominator_summary(rows)
    if any(
        value.get("progress", {}).get(name) != denominators[name]
        for name in (
            "planned", "attempted", "provider_completed", "available", "scored",
            "failed", "unavailable", "budget_stopped",
        )
    ):
        raise ValueError(f"Manifest progress counters do not reconcile: {path}")
    if any(
        row.get("candidate_sha256") != candidate_hashes().get(row.get("arm"))
        for row in rows
    ):
        raise ValueError(f"Manifest has a candidate hash mismatch: {path}")
    started = [
        row["started_sequence"]
        for row in rows
        if row.get("started_sequence") is not None
    ]
    completed = [
        row["completed_sequence"]
        for row in rows
        if row.get("completed_sequence") is not None
    ]
    if started != list(range(1, len(started) + 1)) or completed != list(
        range(1, len(completed) + 1)
    ):
        raise ValueError(f"Manifest has invalid realized ordinals: {path}")
    calls = [row["initial_call"] for row in rows if row.get("initial_call") is not None]
    if any(
        call.get("returned_model") != MODELS[provider]
        for call in calls
        if call.get("returned_model") is not None
    ):
        raise ValueError(f"Manifest contains a different returned model: {path}")
    exact_cost = sum(
        (
            Decimal(str(call["cost_usd"]["total"]))
            for call in calls
            if call.get("cost_usd") is not None
        ),
        Decimal(0),
    )
    if (
        base.rounded_usd(exact_cost) != value.get("actual_cost_usd")
        or base.rounded_usd(exact_cost)
        != value.get("cost_guard", {}).get("settled_cost_usd")
        or value.get("raw_run_sha256")
        != core.digest([call["raw_response_sha256"] for call in calls])
        or value.get("cost_guard", {}).get("committed_cost_usd", math.inf)
        > base.rounded_usd(PROVIDER_COST_LIMITS[provider])
    ):
        raise ValueError(f"Manifest cost accounting does not reconcile: {path}")
    guard = value.get("cost_guard", {})
    if (
        guard.get("message_attempts") != denominators["attempted"]
        or guard.get("token_count_attempts", 0) > MAXIMUM_TOKEN_COUNT_REQUESTS
        or (
            provider == "claude-haiku"
            and guard.get("token_count_attempts", 0) < denominators["attempted"]
        )
        or (
            provider != "claude-haiku"
            and guard.get("token_count_attempts", 0) != 0
        )
    ):
        raise ValueError(f"Manifest request accounting does not reconcile: {path}")
    tasks = {
        (task["family"], task["variant"]): task
        for family_tasks in make_corpus()["fixtures"].values()
        for task in family_tasks
    }
    for row in rows:
        score = v14.row_score(row)
        if score is None:
            continue
        task = tasks[(row["family"], row["variant"])]
        call = row.get("initial_call") or {}
        payload = call.get("response_payload")
        if not isinstance(payload, str):
            raise ValueError(f"A scored row has no retained payload: {path}")
        expected_score = (
            score_response(row["arm"], task, payload)
            if call.get("outer_schema_valid")
            else parse_failure_for_task(task, "The response envelope is invalid")
        )
        if score != expected_score:
            raise ValueError(f"A retained score does not reproduce: {path}")
    return value


def write_new(value: dict[str, Any], output: Path | None) -> None:
    text = json.dumps(value, indent=2, sort_keys=True) + "\n"
    if output is None:
        print(text, end="")
    else:
        if output.exists():
            raise FileExistsError(f"Refusing to replace: {output}")
        output.write_text(text)


def install_overrides() -> None:
    overrides = {
        "candidate_definitions": candidate_definitions,
        "candidate_hashes": candidate_hashes,
        "make_corpus": make_corpus,
        "prompt_for": prompt_for,
        "score_response": score_response,
        "parse_failure": active_parse_failure,
        "one_call": one_call,
        "package_files": package_files,
        "dependency_files": dependency_files,
        "prompt_manifest": prompt_manifest,
        "decision_rule": decision_rule,
        "stopping_rule": stopping_rule,
        "effective_request_settings": effective_request_settings,
        "protocol_manifest": protocol_manifest,
        "run_plan": run_plan,
        "prompt_visibility_screen": prompt_visibility_screen,
        "aggregation_screen": aggregation_screen,
        "deterministic_screen": deterministic_screen,
        "deterministic_manifest": deterministic_manifest,
        "validate_approval": validate_approval,
        "summarize_runs": summarize_runs,
    }
    for name, value in overrides.items():
        setattr(v14, name, value)


install_overrides()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--check", type=Path)
    parser.add_argument("--print-plan", action="store_true")
    parser.add_argument("--provider", choices=PROVIDERS)
    parser.add_argument("--env-file", type=Path, default=PACKAGE_ROOT.parents[2] / ".env")
    parser.add_argument("--approval-file", type=Path, default=APPROVAL_PATH)
    parser.add_argument("--output", type=Path)
    parser.add_argument(
        "--summarize", nargs=3, type=Path, metavar=("OPENAI", "GEMINI", "HAIKU")
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
        write_new(summarize_runs([load_manifest(path) for path in args.summarize]), args.output)
        return
    print(
        json.dumps(
            {"screen": deterministic_screen(), "protocol": protocol_manifest(), "plan": run_plan()},
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
