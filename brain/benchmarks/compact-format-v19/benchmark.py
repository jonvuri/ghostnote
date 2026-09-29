#!/usr/bin/env python3
"""Freeze and run the Phase 8c4e full compact-candidate benchmark."""

from __future__ import annotations

import argparse
import importlib.util
import json
import random
from copy import deepcopy
from decimal import Decimal
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent
SUITE_PATH = PACKAGE_ROOT / "suite.py"
V18_BENCHMARK_PATH = BENCHMARKS_ROOT / "compact-format-v18" / "benchmark.py"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


suite = load_module("ghostnote_compact_format_v19_suite", SUITE_PATH)
v18 = load_module("ghostnote_compact_format_v19_v18_benchmark", V18_BENCHMARK_PATH)
v15 = v18.v15
v14 = v18.v14
base = v18.base
core = v18.core
transport = v18.transport
_V15_CANDIDATE_HASHES = v15.candidate_hashes
_V15_PARSE_FAILURE = v15.parse_failure_for_task
_V14_COHORT_AUDIT = v14.cohort_audit

SCHEMA = "ghostnote-compact-format-full-benchmark-v19"
CORPUS_SCHEMA = suite.CORPUS_SCHEMA
RUN_ID = "phase8c4e-full-compact-benchmark-r1"
COHORT = suite.DEFAULT_COHORT
SEED = suite.DEFAULT_SEED
VARIANT_OFFSET = suite.DEFAULT_VARIANT_OFFSET
ARMS = suite.ARMS
COMPACT_ARMS = ARMS
DECISION_FAMILIES = suite.DECISION_FAMILIES
GUARD_FAMILIES = suite.GUARD_FAMILIES
FAMILIES = suite.FAMILIES
UNIQUE_COUNTS = suite.UNIQUE_COUNTS
PROVIDERS = ("openai", "gemini", "claude-haiku")
MODELS = {
    "openai": "gpt-5.4-mini-2026-03-17",
    "gemini": "gemini-3.8-flash",
    "claude-haiku": "claude-haiku-4-5-20251001",
}
KEYS = {
    "openai": "OPENAI_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "claude-haiku": "ANTHROPIC_API_KEY",
}
SETTINGS = {
    "openai": {
        "reasoning_effort": "low",
        "max_completion_tokens": 12000,
        "temperature": "provider default; omitted from request",
    },
    "gemini": {
        "thinking_level": "low",
        "max_output_tokens": 12000,
        "temperature": "provider default; omitted from request",
    },
    "claude-haiku": {
        "thinking": {"type": "enabled", "budget_tokens": 1024},
        "max_tokens": 12000,
        "temperature": "provider default; omitted from request",
    },
}
BASE_JOBS = sum(UNIQUE_COUNTS.values())
SENTINEL_JOBS = len(suite.SENTINEL_FAMILIES)
MAXIMUM_CALLS = (BASE_JOBS + SENTINEL_JOBS) * len(ARMS)
MAXIMUM_TOKEN_COUNT_REQUESTS = MAXIMUM_CALLS
RECENT_COST_ESTIMATE = {
    "openai": Decimal("0.750000"),
    "gemini": Decimal("0.420000"),
    "claude-haiku": Decimal("3.100000"),
}
PROVIDER_COST_LIMITS = {
    "openai": Decimal("0.950000"),
    "gemini": Decimal("0.600000"),
    "claude-haiku": Decimal("4.000000"),
}
MAXIMUM_TOTAL_COST = Decimal("5.550000")
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "full-benchmark-r1-approval.json"
HISTORICAL_PACKAGES = (
    *v18.HISTORICAL_PACKAGES,
    "compact-format-v18",
)
DEPENDENCIES = (
    SUITE_PATH,
    suite.V18_SUITE_PATH,
    V18_BENCHMARK_PATH,
    suite.SYMBOLIC_V1_ROOT / "corpus.py",
    suite.SYMBOLIC_V1_ROOT / "scoring.py",
    *v18.DEPENDENCIES,
)
RUN_KIND_PROVIDER = "full-compact-benchmark-provider"
RUN_KIND_SUMMARY = "full-compact-benchmark-summary"

_CANDIDATE_HASHES = {
    "compact-bar-fields": "5125c847ad08dc795a82c235b3fcdf42dede5392805db36a3df2a0941c11a30a",
    "compact-bar-local-labels": "3fcb182bfa6cfa4935a8e4b5c6ef876407fcd27e5bb2e6ac7df3177b2789c349",
}


def configure_modules() -> None:
    values = {
        "PACKAGE_ROOT": PACKAGE_ROOT,
        "SCHEMA": SCHEMA,
        "CORPUS_SCHEMA": CORPUS_SCHEMA,
        "RUN_ID": RUN_ID,
        "COHORT": COHORT,
        "SEED": SEED,
        "VARIANT_OFFSET": VARIANT_OFFSET,
        "ARMS": ARMS,
        "COMPACT_ARMS": COMPACT_ARMS,
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
        "APPROVAL_PATH": APPROVAL_PATH,
        "HISTORICAL_PACKAGES": HISTORICAL_PACKAGES,
        "DEPENDENCIES": DEPENDENCIES,
        "RUN_KIND_PROVIDER": RUN_KIND_PROVIDER,
        "RUN_KIND_SUMMARY": RUN_KIND_SUMMARY,
    }
    for module in (v18, v15, v14):
        for name, value in values.items():
            setattr(module, name, value)
    base.SETTINGS = {
        provider: {
            name: value
            for name, value in SETTINGS[provider].items()
            if name != "temperature"
        }
        for provider in PROVIDERS
    }


configure_modules()


def make_corpus() -> dict[str, Any]:
    return suite.make_corpus(COHORT, SEED, VARIANT_OFFSET)


def task_difficulty(task: dict[str, Any]) -> str:
    return suite.task_difficulty(task)


def candidate_hashes() -> dict[str, str]:
    inherited = _V15_CANDIDATE_HASHES()
    selected = {arm: inherited[arm] for arm in ARMS}
    if selected != _CANDIDATE_HASHES:
        raise AssertionError("The targeted-holdout candidate identities changed")
    return selected


def base_jobs() -> list[dict[str, Any]]:
    corpus = make_corpus()
    rows = [
        {
            "family": family,
            "variant": task["variant"],
            "repeat": 1,
            "task": task,
        }
        for family in FAMILIES
        for task in corpus["fixtures"][family]
    ]
    rows.extend(
        {
            "family": family,
            "variant": corpus["fixtures"][family][0]["variant"],
            "repeat": 2,
            "task": corpus["fixtures"][family][0],
        }
        for family in suite.SENTINEL_FAMILIES
    )
    return rows


def jobs(provider: str) -> list[dict[str, Any]]:
    if provider not in PROVIDERS:
        raise ValueError(f"Unknown provider: {provider}")
    provider_index = PROVIDERS.index(provider)
    groups = base_jobs()
    random.Random(SEED + provider_index).shuffle(groups)
    result = []
    for group_index, group in enumerate(groups):
        rotation = (group_index + provider_index) % len(ARMS)
        order = ARMS[rotation:] + ARMS[:rotation]
        result.extend({**group, "arm": arm} for arm in order)
    return [
        {**job, "planned_sequence": sequence}
        for sequence, job in enumerate(result, start=1)
    ]


def source_notes(task: dict[str, Any]) -> list[dict[str, Any]]:
    return suite.source_notes(task)


def source_base(task: dict[str, Any]) -> str:
    notes = source_notes(task)
    return core.digest(core.projected(notes)) if notes else "none"


def represented_source(arm: str, task: dict[str, Any]) -> str | None:
    notes = source_notes(task)
    if not notes:
        return None
    document = core.make_document(notes, core.digest(core.projected(notes)), task["id"] + "-source")
    return v14.render_document(arm, document)


def perfect_document(task: dict[str, Any]) -> dict[str, Any]:
    return core.make_document(suite.expected_notes(task), source_base(task), task["id"])


def perfect_payload(arm: str, task: dict[str, Any]) -> str:
    if task["family"] == "comprehension-analysis":
        return core.render_analysis(task["expected"]).removeprefix("ANALYSIS ")
    return v14.render_document(arm, perfect_document(task))


def task_instruction(arm: str, task: dict[str, Any]) -> str:
    instruction = suite.task_instruction(task)
    if task["family"] == "comprehension-analysis":
        return instruction
    if arm == "compact-bar-fields":
        context = (
            f"Use exact headers BASE {source_base(task)} and SOURCE {task['id']}. "
            "Use the fixed OMITS and FIELDS declarations and empty overlays."
        )
    else:
        context = (
            f"Use exact headers BASE {source_base(task)} and SOURCE {task['id']}. "
            "Use the fixed OMITS declaration, no FIELDS declaration, and empty overlays."
        )
    return instruction + " " + context


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
        representation = f"Input and output representation: {arm}."
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
    source = represented_source(arm, task)
    if source is not None:
        parts.extend(("<input_document>", source, "</input_document>"))
    return "\n\n".join(parts)


def parse_document(arm: str, payload: str) -> tuple[dict[str, Any], bool, bool, str | None]:
    strict_error = None
    try:
        document = v14.strict_document(arm, payload)
        return document, True, True, None
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        strict_error = str(error)
    try:
        document = v15.loose_document(arm, payload)
        return document, bool(document["notes"]), False, strict_error
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        return {"notes": []}, False, False, str(error)


def constraint_score(arm: str, task: dict[str, Any], payload: str) -> dict[str, Any]:
    document, structural, canonical, error = parse_document(arm, payload)
    checks = suite.constraint_checks(task, document.get("notes", []))
    case = v15.case_record("requirements", checks)
    expected = perfect_document(task)
    actual_notes = document.get("notes", [])
    response_components = {
        "schema": document.get("schema") == expected["schema"],
        "base_sha256": document.get("base_sha256") == expected["base_sha256"],
        "source_id": document.get("source_id") == expected["source_id"],
        "omits": document.get("omits") == expected["omits"],
        "overlays": document.get("overlays") == expected["overlays"],
        "globally_unique_ids": len({row["id"] for row in actual_notes})
        == len(actual_notes),
    }
    return v15.score_value(
        structural,
        canonical,
        [case],
        response_components,
        None
        if structural and canonical and all(checks.values()) and all(response_components.values())
        else {
            "class": "component-or-conformance",
            "canonical_error": error,
            "failed_components": [name for name, passed in checks.items() if not passed]
            + [name for name, passed in response_components.items() if not passed],
        },
    )


def score_response(arm: str, task: dict[str, Any], payload: str) -> dict[str, Any]:
    if task["family"] == "comprehension-analysis":
        return v15.analysis_score(task, payload)
    if task["family"] in {
        "generation-progression",
        "generation-melody",
        "continuation-roles",
    }:
        return constraint_score(arm, task, payload)
    return v15.document_score(arm, task, payload)


def parse_failure_for_task(task: dict[str, Any], message: str) -> dict[str, Any]:
    if task["family"] in {
        "generation-progression",
        "generation-melody",
        "continuation-roles",
    }:
        checks = suite.constraint_checks(task, [])
        return v15.score_value(
            False,
            False,
            [v15.case_record("requirements", {name: False for name in checks})],
            {
                name: False
                for name in (
                    "schema",
                    "base_sha256",
                    "source_id",
                    "omits",
                    "overlays",
                    "globally_unique_ids",
                )
            },
            {"class": "structural-parse", "message": message},
        )
    return _V15_PARSE_FAILURE(task, message)


def runner_sha256() -> str:
    return base.file_sha256(Path(__file__))


def package_files() -> dict[str, str]:
    return {
        name: base.file_sha256(PACKAGE_ROOT / name)
        for name in ("benchmark.py", "suite.py", "README.md", "PROTOCOL.md")
    }


def dependency_files() -> dict[str, str]:
    return {
        str(path.relative_to(BENCHMARKS_ROOT)): base.file_sha256(path)
        for path in dict.fromkeys(DEPENDENCIES)
    }


def effective_request_settings(provider: str) -> dict[str, Any]:
    value = deepcopy(SETTINGS[provider])
    value.pop("temperature")
    return value


def historical_content_hashes() -> set[str]:
    result: set[str] = set()
    for name in HISTORICAL_PACKAGES:
        root = BENCHMARKS_ROOT / name
        for path in sorted(root.rglob("*.json")):
            try:
                value = json.loads(path.read_text())
            except json.JSONDecodeError:
                continue

            def collect(item: Any) -> None:
                if isinstance(item, dict):
                    content_hash = item.get("content_sha256")
                    if isinstance(content_hash, str):
                        result.add(content_hash)
                    for child in item.values():
                        collect(child)
                elif isinstance(item, list):
                    for child in item:
                        collect(child)

            collect(value)
    old = suite.v18.make_corpus()
    for values in old["fixtures"].values():
        for task in values:
            result.add(suite.content_sha256(task))
    return result


def cohort_audit() -> dict[str, Any]:
    value = _V14_COHORT_AUDIT()
    tasks = [task for values in make_corpus()["fixtures"].values() for task in values]
    content = {task["content_sha256"] for task in tasks}
    historical = historical_content_hashes()
    value.update(
        {
            "content_hash_count": len(content),
            "internal_content_duplicates": len(tasks) - len(content),
            "prior_content_overlap": len(content & historical),
            "historical_content_count": len(historical),
            "historical_content_snapshot_sha256": core.digest(sorted(historical)),
        }
    )
    value["sha256"] = core.digest(
        {name: item for name, item in value.items() if name != "sha256"}
    )
    return value


def cost_guard_manifest() -> dict[str, Any]:
    return {
        "recent_cost_estimate_usd": {
            provider: float(value) for provider, value in RECENT_COST_ESTIMATE.items()
        },
        "recent_cost_estimate_total_usd": float(sum(RECENT_COST_ESTIMATE.values())),
        "maximum_provider_cost_usd": {
            provider: float(value) for provider, value in PROVIDER_COST_LIMITS.items()
        },
        "maximum_total_cost_usd": float(MAXIMUM_TOTAL_COST),
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
    }


def decision_rule() -> dict[str, Any]:
    return {
        "outcomes": ["matrix-plausible", "revise", "stop"],
        "experimental_unit": "prompt",
        "cases_and_components": "outcomes within a prompt; not independent trials",
        "minimum_provider_completion": 0.95,
        "minimum_scored_cell_coverage": 0.80,
        "minimum_component_accuracy_per_provider_family_candidate": 0.70,
        "minimum_average_case_accuracy_per_provider_family_candidate": 0.70,
        "minimum_structural_rate_per_provider_family_candidate": 0.80,
        "minimum_canonical_rate_per_provider_family_candidate": 0.70,
        "serialization_minimum_component_accuracy": 0.90,
        "serialization_minimum_conformance_rate": 0.90,
        "maximum_failed_cells_for_revise": 3,
        "maximum_providers_with_same_failed_family_for_revise": 1,
        "recurring_defect": (
            "Both repeats of a sentinel score below 50 percent components or "
            "both fail structural parsing for one provider, family, and candidate."
        ),
        "maximum_recurring_defects_for_matrix_plausible": 0,
        "calibration_basis": (
            "The 70 percent component floor follows the Phase 8c3 compact "
            "diagnostic. The 80 percent structural floor follows the hardened "
            "holdout syntax gate at seven-prompt resolution. Ninety percent is "
            "a maximum calibration target, not a minimum validity threshold."
        ),
        "selection_authority": (
            "This run decides whether a fresh full matrix is plausible. It does "
            "not select a public format or authorize matrix calls."
        ),
    }


def stopping_rule() -> dict[str, Any]:
    return {
        "before_calls": (
            "Stop on candidate identity, freshness, reference, mutation, "
            "credential, network, approval, or cost-screen failure."
        ),
        "during_provider": (
            "Stop one provider on the first transport or budget failure or after "
            "three unavailable responses. Make no retry or repair call."
        ),
        "between_providers": (
            "Do not infer a scientific decision until all approved provider runs "
            "finish or a frozen stop makes the final result irreversible."
        ),
        "after_run": (
            "Do not make fresh full-matrix calls in Phase 8c4e. A later matrix "
            "needs its own scope, cohort, cost, and approval."
        ),
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
                "repeat": job["repeat"],
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
    audit = cohort_audit()
    prompts = prompt_manifest()
    value = {
        "schema": SCHEMA,
        "run_kind": "full-compact-benchmark-protocol",
        "run_id": RUN_ID,
        "package_files": package_files(),
        "dependency_files": dependency_files(),
        "runner_sha256": runner_sha256(),
        "cohort": COHORT,
        "cohort_audit": audit,
        "candidate_sha256": candidate_hashes(),
        "targeted_holdout_candidate_sha256": _CANDIDATE_HASHES,
        "arms": list(ARMS),
        "families": {
            family: {
                "unique_fixtures": UNIQUE_COUNTS[family],
                "role": "decision" if family in DECISION_FAMILIES else "validity-guard",
                "sentinel_repeat": family in suite.SENTINEL_FAMILIES,
            }
            for family in FAMILIES
        },
        "models": MODELS,
        "declared_settings": SETTINGS,
        "effective_request_settings": {
            provider: effective_request_settings(provider) for provider in PROVIDERS
        },
        "prompts": prompts,
        "calls": {
            "messages_per_provider": MAXIMUM_CALLS,
            "messages_total": MAXIMUM_CALLS * len(PROVIDERS),
            "unique_prompts_per_provider": BASE_JOBS,
            "sentinel_repeats_per_provider": SENTINEL_JOBS,
            "automatic_retries": 0,
            "repairs": 0,
        },
        "cost_guard": cost_guard_manifest(),
        "measurement": {
            "experimental_unit": "prompt",
            "musical_units": ["case", "component"],
            "whole_response_musical_score": False,
            "structural_and_canonical_failures": "benchmark outcomes",
            "unavailable_and_output_limit": "excluded from scored musical denominators",
            "required": [
                "global component accuracy",
                "average per-case component accuracy",
                "perfect case count and rate",
                "structural and canonical conformance",
                "prompt and response bytes",
                "input and output tokens",
                "latency, nondeterminism, and cost",
            ],
            "repair_recovery": "disabled; report zero repair calls",
            "provider_pooling": False,
        },
        "decision_rule": decision_rule(),
        "stopping_rule": stopping_rule(),
        "historical_comparison": (
            "Phase 8c3 is directional context only. Fixtures, contracts, arms, "
            "and denominators differ."
        ),
        "approval_boundary": (
            "No provider request is approved until the operator approves the "
            "exact protocol, plan, cohort, candidates, runner, schedule, and cost."
        ),
        "privacy": "Generated MIT symbolic text only.",
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    value = {
        "schema": SCHEMA,
        "run_kind": "full-compact-benchmark-plan",
        "run_id": RUN_ID,
        "protocol_sha256": protocol["sha256"],
        "cohort_sha256": protocol["cohort_audit"]["corpus_sha256"],
        "cohort_audit_sha256": protocol["cohort_audit"]["sha256"],
        "historical_snapshot": protocol["cohort_audit"]["historical_snapshot"],
        "candidate_sha256": protocol["candidate_sha256"],
        "runner_sha256": protocol["runner_sha256"],
        "arms": protocol["arms"],
        "families": protocol["families"],
        "models": protocol["models"],
        "declared_settings": protocol["declared_settings"],
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
    for family, tasks in make_corpus()["fixtures"].items():
        task = tasks[0]
        for arm in ARMS:
            prompt = prompt_for({"arm": arm, "family": family, "task": task})
            required = [f"Difficulty level: {task_difficulty(task)}."]
            if family == "comprehension-analysis":
                required.extend(("chord_groups", "motif_pairs"))
            else:
                required.extend((f"BASE {source_base(task)}", f"SOURCE {task['id']}"))
            if family == "continuation-motif":
                required.extend(
                    (
                        "voice-conditioned affine operation",
                        "pitch=(2*axis)-source_pitch+semitones",
                        "first_voice_start",
                        "Sort after all calculations",
                    )
                )
            missing = [fragment for fragment in required if fragment not in prompt]
            rows.append({"family": family, "arm": arm, "missing": missing})
    return {"rows": rows, "all_visible": all(not row["missing"] for row in rows)}


def scoring_screen() -> dict[str, Any]:
    checks: dict[str, bool] = {}
    corpus = make_corpus()
    for family, tasks in corpus["fixtures"].items():
        for task in tasks:
            for arm in ARMS:
                perfect = score_response(arm, task, perfect_payload(arm, task))
                key = f"{family}:{task['variant']}:{arm}"
                checks[f"{key}:perfect"] = (
                    perfect["component"]["correct"]
                    == perfect["component"]["planned"]
                    and all(case["perfect"] for case in perfect["cases"])
                    and perfect["structural_parse_pass"]
                    and perfect["canonical_form_pass"]
                )
                failed = parse_failure_for_task(task, "synthetic")
                checks[f"{key}:failure-retains-denominator"] = (
                    failed["component"]["planned"]
                    == perfect["component"]["planned"]
                    and failed["component"]["correct"] == 0
                )
    analysis = corpus["fixtures"]["comprehension-analysis"][0]
    payload = perfect_payload("compact-bar-fields", analysis)
    changed = payload.replace("root_pcs=", "root_pcs=wrong,", 1)
    score = score_response("compact-bar-fields", analysis, changed)
    perfect = score_response(
        "compact-bar-fields", analysis, perfect_payload("compact-bar-fields", analysis)
    )
    checks["one-analysis-mutation-loses-one-component"] = (
        score["component"]["correct"] == perfect["component"]["planned"] - 1
    )
    document = corpus["fixtures"]["comprehension-structure"][0]
    payload = perfect_payload("compact-bar-fields", document)
    pitch = document["expected"][0]["pitch"]
    changed = payload.replace(f" {pitch} ", f" {pitch + 1} ", 1)
    score = score_response("compact-bar-fields", document, changed)
    perfect = score_response(
        "compact-bar-fields", document, perfect_payload("compact-bar-fields", document)
    )
    checks["one-document-mutation-loses-one-component"] = (
        score["component"]["correct"] == perfect["component"]["planned"] - 1
    )
    return {"checks": checks, "all_pass": all(checks.values())}


def seed_freshness_screen() -> dict[str, Any]:
    current = make_corpus()
    alternate = suite.make_corpus(COHORT + "-seed-check", SEED + 1, VARIANT_OFFSET)
    families = ("continuation-motif", "document-serialization")
    rows = {}
    for family in families:
        left = {
            task["content_sha256"] for task in current["fixtures"][family]
        }
        right = {
            task["content_sha256"] for task in alternate["fixtures"][family]
        }
        rows[family] = {
            "current": sorted(left),
            "alternate": sorted(right),
            "overlap": len(left & right),
        }
    return {
        "families": rows,
        "all_seed_dependent": all(row["overlap"] == 0 for row in rows.values()),
    }


def metric_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return v15.metric_summary(rows)


def cell_summaries(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cells = []
    for family in FAMILIES:
        for arm in ARMS:
            selected = [
                row for row in rows if row["family"] == family and row["arm"] == arm
            ]
            cells.append({"family": family, "arm": arm, **metric_summary(selected)})
    return cells


def sentinel_summary(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for family in suite.SENTINEL_FAMILIES:
        variant = make_corpus()["fixtures"][family][0]["variant"]
        for arm in ARMS:
            selected = sorted(
                [
                    row
                    for row in rows
                    if row["family"] == family
                    and row["arm"] == arm
                    and row["variant"] == variant
                ],
                key=lambda row: row["repeat"],
            )
            scores = [v14.row_score(row) for row in selected]
            accuracies = [
                score["component"]["correct"] / score["component"]["planned"]
                if score is not None and score["component"]["planned"]
                else None
                for score in scores
            ]
            recurring = len(scores) == 2 and all(
                score is not None for score in scores
            ) and (
                all(value is not None and value < 0.50 for value in accuracies)
                or all(not score["structural_parse_pass"] for score in scores if score)
            )
            hashes = [
                row.get("initial_call", {}).get("raw_response_sha256")
                if row.get("initial_call")
                else None
                for row in selected
            ]
            result.append(
                {
                    "family": family,
                    "arm": arm,
                    "variant": variant,
                    "scored_repeats": sum(score is not None for score in scores),
                    "component_accuracy": accuracies,
                    "response_hash_equal": len(hashes) == 2
                    and None not in hashes
                    and hashes[0] == hashes[1],
                    "recurring_defect": recurring,
                }
            )
    return result


def evaluate_provider(run: dict[str, Any]) -> dict[str, Any]:
    rule = decision_rule()
    cells = cell_summaries(run["results"])
    completion = v15.safe_rate(
        run["progress"]["provider_completed"], run["progress"]["planned"]
    )
    operational = completion is not None and completion >= rule["minimum_provider_completion"]
    operational &= all(
        cell["scored"] / cell["planned"] >= rule["minimum_scored_cell_coverage"]
        for cell in cells
        if cell["planned"]
    )
    evaluated = []
    for cell in cells:
        control = cell["family"] in GUARD_FAMILIES
        component_minimum = (
            rule["serialization_minimum_component_accuracy"]
            if control
            else rule["minimum_component_accuracy_per_provider_family_candidate"]
        )
        conformance_minimum = (
            rule["serialization_minimum_conformance_rate"]
            if control
            else None
        )
        checks = {
            "component": cell["global_component_accuracy"] is not None
            and cell["global_component_accuracy"] >= component_minimum,
            "average_case": cell["average_per_case_component_accuracy"] is not None
            and cell["average_per_case_component_accuracy"]
            >= rule["minimum_average_case_accuracy_per_provider_family_candidate"],
            "structural": cell["structural_parse_rate_scored"] is not None
            and cell["structural_parse_rate_scored"]
            >= (
                conformance_minimum
                if conformance_minimum is not None
                else rule["minimum_structural_rate_per_provider_family_candidate"]
            ),
            "canonical": cell["canonical_form_rate_scored"] is not None
            and cell["canonical_form_rate_scored"]
            >= (
                conformance_minimum
                if conformance_minimum is not None
                else rule["minimum_canonical_rate_per_provider_family_candidate"]
            ),
        }
        evaluated.append({**cell, "gate_checks": checks, "gate_pass": all(checks.values())})
    sentinels = sentinel_summary(run["results"])
    return {
        "completion_rate": completion,
        "operational_pass": operational,
        "cells": evaluated,
        "failed_cells": sum(not cell["gate_pass"] for cell in evaluated),
        "sentinels": sentinels,
        "recurring_defects": sum(row["recurring_defect"] for row in sentinels),
    }


def provider_summary(run: dict[str, Any]) -> dict[str, Any]:
    return {
        "provider": run["provider"],
        "progress": run["progress"],
        "evaluation": evaluate_provider(run),
        "overall": metric_summary(run["results"]),
        "size": v14.runtime_size_summary(run["results"]),
        "repair_calls": 0,
        "actual_cost_usd": run["actual_cost_usd"],
    }


def decision_for(providers: list[dict[str, Any]]) -> str:
    rule = decision_rule()
    if not all(provider["evaluation"]["operational_pass"] for provider in providers):
        return "stop"
    failed = [
        (provider["provider"], cell["family"], cell["arm"])
        for provider in providers
        for cell in provider["evaluation"]["cells"]
        if not cell["gate_pass"]
    ]
    recurring = sum(provider["evaluation"]["recurring_defects"] for provider in providers)
    if not failed and recurring <= rule["maximum_recurring_defects_for_matrix_plausible"]:
        return "matrix-plausible"
    family_provider_counts = {
        (family, arm): len({provider for provider, item, candidate in failed if item == family and candidate == arm})
        for _, family, arm in failed
    }
    bounded = (
        len(failed) <= rule["maximum_failed_cells_for_revise"]
        and all(
            count <= rule["maximum_providers_with_same_failed_family_for_revise"]
            for count in family_provider_counts.values()
        )
        and recurring == 0
    )
    return "revise" if bounded else "stop"


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
        "decision": decision_for(providers),
        "selection_authority": decision_rule()["selection_authority"],
    }
    value["sha256"] = core.digest(value)
    return value


def synthetic_run(provider: str, mode: str = "perfect") -> dict[str, Any]:
    rows = []
    for job in jobs(provider):
        score = score_response(
            job["arm"], job["task"], perfect_payload(job["arm"], job["task"])
        )
        if mode == "one-outcome" and not rows:
            score = parse_failure_for_task(job["task"], "synthetic model outcome")
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
    return {
        "provider": provider,
        "results": rows,
        "progress": {
            name: denominators[name]
            for name in (
                "planned",
                "attempted",
                "provider_completed",
                "available",
                "scored",
                "failed",
                "unavailable",
                "budget_stopped",
            )
        },
        "actual_cost_usd": 0.0,
    }


def summary_screen() -> dict[str, Any]:
    perfect = summarize_runs([synthetic_run(provider) for provider in PROVIDERS])
    outcome = summarize_runs(
        [
            synthetic_run(provider, "one-outcome" if provider == "openai" else "perfect")
            for provider in PROVIDERS
        ]
    )
    checks = {
        "perfect-is-matrix-plausible": perfect["decision"] == "matrix-plausible",
        "one-malformed-result-does-not-invalidate-run": outcome["decision"]
        in {"matrix-plausible", "revise"},
        "two-candidates-only": set(perfect["candidate_sha256"]) == set(ARMS),
        "all-provider-family-cells-present": all(
            len(provider["evaluation"]["cells"]) == len(FAMILIES) * len(ARMS)
            for provider in perfect["providers"]
        ),
    }
    return {"checks": checks, "all_pass": all(checks.values())}


def deterministic_screen() -> dict[str, Any]:
    audit = cohort_audit()
    corpus = make_corpus()
    suite_result = suite.suite_screen(corpus)
    freshness = seed_freshness_screen()
    visibility = prompt_visibility_screen()
    scoring = scoring_screen()
    summary = summary_screen()
    costs = v14.cost_screen()
    preflight = v14.preflight_screen()
    provider_accounting = v14.provider_accounting_screen()
    schedules = {provider: jobs(provider) for provider in PROVIDERS}
    prompts = [
        prompt_for(job) for provider in PROVIDERS for job in schedules[provider]
    ]
    blocks = {
        provider: [
            rows[index : index + len(ARMS)]
            for index in range(0, len(rows), len(ARMS))
        ]
        for provider, rows in schedules.items()
    }
    freshness_pass = all(
        audit[name] == 0
        for name in (
            "internal_full_duplicates",
            "internal_semantic_duplicates",
            "internal_content_duplicates",
            "prior_full_overlap",
            "prior_semantic_overlap",
            "prior_analysis_case_overlap",
            "prior_content_overlap",
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
        "suite": suite_result,
        "seed_freshness": freshness,
        "visibility": visibility,
        "scoring": scoring,
        "summary": summary,
        "cost": costs,
        "preflight": preflight,
        "provider_accounting": provider_accounting,
        "all_blocks_have_both_arms": all(
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
        "historical_snapshot_excludes_current": "compact-format-v19"
        not in HISTORICAL_PACKAGES,
        "only-selected-arms": ARMS
        == ("compact-bar-fields", "compact-bar-local-labels"),
        "nine-full-suite-families": len(DECISION_FAMILIES) == 9,
        "literal-controls-retained": GUARD_FAMILIES
        == ("document-serialization",),
        "no-retry-or-repair": protocol_manifest()["calls"]["automatic_retries"]
        == 0
        and protocol_manifest()["calls"]["repairs"] == 0,
    }
    value["all_checks_pass"] = all(
        (
            all(count == MAXIMUM_CALLS for count in value["job_count_per_provider"].values()),
            freshness_pass,
            suite_result["all_pass"],
            freshness["all_seed_dependent"],
            visibility["all_visible"],
            scoring["all_pass"],
            summary["all_pass"],
            costs["all_pass"],
            preflight["all_pass"],
            provider_accounting["all_pass"],
            value["all_blocks_have_both_arms"],
            value["planned_sequences_are_contiguous"],
            value["all_requests_fit"],
            value["historical_snapshot_excludes_current"],
            value["only-selected-arms"],
            value["nine-full-suite-families"],
            value["literal-controls-retained"],
            value["no-retry-or-repair"],
        )
    )
    value["sha256"] = core.digest(
        {name: item for name, item in value.items() if name != "sha256"}
    )
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
        "cohort_audit_sha256": protocol["cohort_audit"]["sha256"],
        "candidate_sha256": candidate_hashes(),
        "runner_sha256": runner_sha256(),
        "job_count_per_provider": MAXIMUM_CALLS,
        "providers": list(PROVIDERS),
        "all_checks_pass": screen["all_checks_pass"],
    }
    value["sha256"] = core.digest(value)
    return value


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    expected = {
        "run_id": RUN_ID,
        "protocol_sha256": plan["protocol_sha256"],
        "run_plan_sha256": plan["sha256"],
        "cohort_sha256": plan["cohort_sha256"],
        "candidate_sha256": plan["candidate_sha256"],
        "runner_sha256": runner_sha256(),
        "schedule_sha256": plan["schedule_sha256"],
        "maximum_provider_cost_usd": {
            provider: float(value) for provider, value in PROVIDER_COST_LIMITS.items()
        },
        "maximum_total_cost_usd": float(MAXIMUM_TOTAL_COST),
    }
    if any(value.get(name) != item for name, item in expected.items()):
        raise ValueError("Approval does not match the frozen v19 run plan")
    if (
        value.get("status") != "approved"
        or not isinstance(value.get("operator_statement"), str)
        or not value["operator_statement"].strip()
    ):
        raise ValueError("The v19 provider run needs explicit operator approval")
    return value


def install_overrides() -> None:
    overrides = {
        "make_corpus": make_corpus,
        "task_difficulty": task_difficulty,
        "candidate_hashes": candidate_hashes,
        "base_jobs": base_jobs,
        "jobs": jobs,
        "represented_source": represented_source,
        "perfect_document": perfect_document,
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
        "decision_rule": decision_rule,
        "stopping_rule": stopping_rule,
        "prompt_manifest": prompt_manifest,
        "protocol_manifest": protocol_manifest,
        "run_plan": run_plan,
        "prompt_visibility_screen": prompt_visibility_screen,
        "scoring_screen": scoring_screen,
        "summary_screen": summary_screen,
        "deterministic_screen": deterministic_screen,
        "deterministic_manifest": deterministic_manifest,
        "validate_approval": validate_approval,
        "summarize_runs": summarize_runs,
    }
    for module in (v18, v15, v14):
        for name, value in overrides.items():
            setattr(module, name, value)


install_overrides()


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
    parser.add_argument("--provider", choices=PROVIDERS)
    parser.add_argument(
        "--env-file", type=Path, default=PACKAGE_ROOT.parents[2] / ".env"
    )
    parser.add_argument("--approval-file", type=Path, default=APPROVAL_PATH)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--summarize", nargs=len(PROVIDERS), type=Path)
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
    if args.provider:
        write_new(run_provider(args.provider, args.env_file, args.approval_file), args.output)
        return
    if args.summarize:
        write_new(summarize_runs([v15.load_manifest(path) for path in args.summarize]), args.output)
        return
    raise SystemExit("Select --self-test, --check, --print-plan, --provider, or --summarize")


if __name__ == "__main__":
    main()
