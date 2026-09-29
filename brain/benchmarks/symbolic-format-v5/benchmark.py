#!/usr/bin/env python3
"""Freeze and run the fresh eight-arm symbolic-format matrix."""

from __future__ import annotations

import argparse
import importlib.util
import json
import random
import sys
from copy import deepcopy
from decimal import Decimal
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent
V4_ROOT = BENCHMARKS_ROOT / "symbolic-format-v4"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


previous = load_module(
    "ghostnote_symbolic_format_v5_v4_benchmark", V4_ROOT / "benchmark.py"
)
suite = load_module("ghostnote_symbolic_format_v5_suite", PACKAGE_ROOT / "suite.py")
formats = load_module(
    "ghostnote_symbolic_format_v5_formats", PACKAGE_ROOT / "formats.py"
)
engine = previous.prior
base = previous.base
core = previous.core
v15 = previous.v15
v14 = previous.v14

SCHEMA = "ghostnote-symbolic-format-benchmark-v5"
RUN_ID = "phase8c4f-eight-arm-full-matrix-r1"
COHORT = suite.DEFAULT_COHORT
SEED = suite.DEFAULT_SEED
VARIANT_OFFSET = suite.DEFAULT_VARIANT_OFFSET
ARMS = (
    "compact-bar-fields",
    "compact-bar-local-labels",
    "exact-object-json",
    "abc-2.1-composite",
    "strudel-v1.2-composite",
    "lilypond-2.24.4-composite",
    "musicxml-4.0-composite",
    "midi-like-ghostnote-profile",
)
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
DECISION_FAMILIES = suite.DECISION_FAMILIES
GUARD_FAMILIES = suite.GUARD_FAMILIES
FAMILIES = suite.FAMILIES
UNIQUE_COUNTS = suite.UNIQUE_COUNTS
SENTINEL_JOBS = len(suite.SENTINEL_FAMILIES)
TASKS_PER_ARM = sum(UNIQUE_COUNTS.values()) + SENTINEL_JOBS
MAXIMUM_CALLS = TASKS_PER_ARM * len(ARMS)
MAXIMUM_TOKEN_COUNT_REQUESTS = MAXIMUM_CALLS
RECENT_COST_ESTIMATE = {
    "openai": Decimal("3.400000"),
    "gemini": Decimal("1.650000"),
    "claude-haiku": Decimal("10.500000"),
}
PROVIDER_COST_LIMITS = {
    "openai": Decimal("4.500000"),
    "gemini": Decimal("2.250000"),
    "claude-haiku": Decimal("13.500000"),
}
MAXIMUM_TOTAL_COST = Decimal("20.250000")
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "full-matrix-r1-approval.json"
RUN_KIND_PROVIDER = "eight-arm-full-matrix-provider"
RUN_KIND_SUMMARY = "eight-arm-full-matrix-summary"
DEPENDENCIES = tuple(
    dict.fromkeys(
        (
            V4_ROOT / "benchmark.py",
            V4_ROOT / "suite.py",
            V4_ROOT / "formats.py",
            *previous.DEPENDENCIES,
        )
    )
)


def make_corpus() -> dict[str, Any]:
    return suite.make_corpus(COHORT, SEED, VARIANT_OFFSET)


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
        {**job, "planned_sequence": index}
        for index, job in enumerate(result, start=1)
    ]


def cohort_audit() -> dict[str, Any]:
    corpus = make_corpus()
    tasks = [task for values in corpus["fixtures"].values() for task in values]
    current = {task["content_sha256"] for task in tasks}
    historical = set()
    for old_corpus in (
        suite.v19.make_corpus(),
        suite.v3.make_corpus(),
        suite.v4.make_corpus(),
    ):
        historical.update(
            suite.content_sha256(task)
            for values in old_corpus["fixtures"].values()
            for task in values
        )
    value = {
        "corpus_sha256": corpus["sha256"],
        "task_count": len(tasks),
        "content_hash_count": len(current),
        "internal_content_duplicates": len(tasks) - len(current),
        "historical_content_count": len(historical),
        "historical_content_overlap": len(current & historical),
        "historical_content_snapshot_sha256": core.digest(sorted(historical)),
        "content_hash_policy": "Exclude synthetic IDs and include musical values and rules.",
    }
    value["sha256"] = core.digest(value)
    return value


def package_files() -> dict[str, str]:
    names = ("benchmark.py", "suite.py", "formats.py", "README.md", "PROTOCOL.md")
    return {name: base.file_sha256(PACKAGE_ROOT / name) for name in names}


def dependency_files() -> dict[str, str]:
    return {
        str(path.relative_to(BENCHMARKS_ROOT)): base.file_sha256(path)
        for path in DEPENDENCIES
    }


def cost_guard_manifest() -> dict[str, Any]:
    return {
        "estimate_usd": {
            provider: float(value) for provider, value in RECENT_COST_ESTIMATE.items()
        },
        "estimate_total_usd": float(sum(RECENT_COST_ESTIMATE.values())),
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
        "basis": {
            "method": (
                "Scale retained v19 full-suite costs by arm count and adjust with "
                "the measured Gemini format-cost ratios from symbolic v3 and v4."
            ),
            "retained_openai_cost_usd": 0.713277,
            "retained_gemini_compact_cost_usd": 0.34372725,
            "retained_gemini_external_cost_usd": 0.1164435,
            "retained_gemini_musicxml_midi_cost_usd": 0.13523475,
            "retained_claude_cost_usd": 1.781972,
            "price_verification_date": "2026-09-29",
            "uncertainty": (
                "Claude has the widest interval because its retained full run had "
                "unavailable analysis rows and high output-token variance."
            ),
        },
    }


def effective_request_settings(provider: str) -> dict[str, Any]:
    value = deepcopy(SETTINGS[provider])
    value.pop("temperature")
    return value


def prompt_manifest() -> dict[str, list[dict[str, Any]]]:
    hashes = engine.candidate_hashes()
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
                "prompt_sha256": core.sha256_text(engine.prompt_for(job)),
                "prompt_bytes": len(engine.prompt_for(job).encode()),
            }
            for job in jobs(provider)
        ]
        for provider in PROVIDERS
    }


def protocol_manifest() -> dict[str, Any]:
    value = {
        "schema": SCHEMA,
        "run_kind": "eight-arm-full-matrix-protocol",
        "run_id": RUN_ID,
        "package_files": package_files(),
        "dependency_files": dependency_files(),
        "cohort": COHORT,
        "cohort_audit": cohort_audit(),
        "candidate_definitions": {
            name: formats.get(name).descriptor() for name in ARMS
        },
        "candidate_sha256": engine.candidate_hashes(),
        "arms": list(ARMS),
        "families": {
            family: {
                "unique_fixtures": UNIQUE_COUNTS[family],
                "sentinel_repeat": family in suite.SENTINEL_FAMILIES,
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
            "messages_per_arm_per_provider": TASKS_PER_ARM,
            "messages_per_provider": MAXIMUM_CALLS,
            "messages_total": MAXIMUM_CALLS * len(PROVIDERS),
            "sentinel_repeats_per_arm": SENTINEL_JOBS,
            "automatic_retries": 0,
            "repairs": 0,
        },
        "cost_guard": cost_guard_manifest(),
        "measurement": {
            "primary": "musical component accuracy by provider, family, and format",
            "response_components": "separate secondary results",
            "structural_alignment_and_canonical": "diagnostics, not gates",
            "experimental_unit": "prompt",
            "cases_and_components": "outcomes within a prompt",
            "provider_pooling": "report providers separately before any aggregate",
            "revoice_identity": "synthetic IDs excluded from musical scoring",
            "exact_note_count": "required for reference-answer tasks",
            "sentinels": "exact prompt repeats for nondeterminism measurement",
        },
        "stopping_rule": (
            "Stop a provider on the first transport, budget, approval, identity, "
            "freshness, or deterministic-screen failure. Make no retry or repair call."
        ),
        "approval_boundary": (
            "No provider request is approved until the operator approves this exact "
            "plan, schedules, models, settings, and USD 20.250000 total hard limit."
        ),
        "privacy": "Generated MIT symbolic text only.",
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    value = {
        "schema": SCHEMA,
        "run_kind": "eight-arm-full-matrix-plan",
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


def full_scoring_screen() -> dict[str, Any]:
    checks: dict[str, bool] = {}
    corpus = make_corpus()
    for family in FAMILIES:
        for index, task in enumerate(corpus["fixtures"][family]):
            for arm in ARMS:
                score = engine.score_response(
                    arm, task, engine.perfect_payload(arm, task)
                )
                prefix = f"{family}:{index + 1}:{arm}"
                checks[f"{prefix}:perfect-components"] = (
                    score["component"]["correct"]
                    == score["component"]["planned"]
                )
                checks[f"{prefix}:structural"] = score["structural_parse_pass"]
                checks[f"{prefix}:canonical"] = score["canonical_form_pass"]
    return {"checks": checks, "all_pass": all(checks.values())}


def schedule_screen(prompts: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    checks: dict[str, bool] = {}
    expected_per_arm = TASKS_PER_ARM
    for provider, rows in prompts.items():
        checks[f"{provider}:sequence"] = [
            row["planned_sequence"] for row in rows
        ] == list(range(1, MAXIMUM_CALLS + 1))
        for arm in ARMS:
            arm_rows = [row for row in rows if row["arm"] == arm]
            checks[f"{provider}:{arm}:count"] = len(arm_rows) == expected_per_arm
            for family in suite.SENTINEL_FAMILIES:
                first_task = make_corpus()["fixtures"][family][0]
                repeats = [
                    row
                    for row in arm_rows
                    if row["family"] == family
                    and row["task_sha256"] == first_task["sha256"]
                ]
                checks[f"{provider}:{arm}:{family}:sentinel"] = (
                    len(repeats) == 2
                    and len({row["prompt_sha256"] for row in repeats}) == 1
                )
    checks["provider-schedules-differ"] = len(
        {core.digest(prompts[provider]) for provider in PROVIDERS}
    ) == len(PROVIDERS)
    return {"checks": checks, "all_pass": all(checks.values())}


def deterministic_screen() -> dict[str, Any]:
    corpus = make_corpus()
    suite_result = suite.suite_screen(corpus)
    scoring = full_scoring_screen()
    adapters = engine.adapter_screen()
    prompts = prompt_manifest()
    schedule = schedule_screen(prompts)
    freshness = cohort_audit()
    checks = {
        "suite": suite_result["all_pass"],
        "all-fixture-format-perfect-scores": scoring["all_pass"],
        "adapters": adapters["all_pass"],
        "schedule": schedule["all_pass"],
        "fresh-content": freshness["historical_content_overlap"] == 0,
        "no-internal-content-duplicates": freshness["internal_content_duplicates"]
        == 0,
        "job-count": all(len(rows) == MAXIMUM_CALLS for rows in prompts.values()),
        "request-bytes": all(
            row["prompt_bytes"] <= base.REQUEST_BYTE_CEILING
            for rows in prompts.values()
            for row in rows
        ),
        "arm-scope": tuple(formats.REGISTRY) == ARMS,
    }
    value = {
        "checks": checks,
        "suite": suite_result,
        "scoring": scoring,
        "adapters": adapters,
        "schedule": schedule,
        "freshness": freshness,
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
        "candidate_sha256": engine.candidate_hashes(),
        "job_count_per_provider": MAXIMUM_CALLS,
        "job_count_total": MAXIMUM_CALLS * len(PROVIDERS),
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
        raise ValueError("Approval does not match the frozen full matrix")
    if (
        value.get("status") != "approved"
        or not isinstance(value.get("operator_statement"), str)
        or not value["operator_statement"].strip()
    ):
        raise ValueError("Approval needs an explicit operator statement")
    return value


def configure() -> None:
    values = {
        "PACKAGE_ROOT": PACKAGE_ROOT,
        "BENCHMARKS_ROOT": BENCHMARKS_ROOT,
        "suite": suite,
        "formats": formats,
        "SCHEMA": SCHEMA,
        "RUN_ID": RUN_ID,
        "COHORT": COHORT,
        "SEED": SEED,
        "VARIANT_OFFSET": VARIANT_OFFSET,
        "ARMS": ARMS,
        "PROVIDERS": PROVIDERS,
        "MODELS": MODELS,
        "KEYS": KEYS,
        "SETTINGS": SETTINGS,
        "DECISION_FAMILIES": DECISION_FAMILIES,
        "GUARD_FAMILIES": GUARD_FAMILIES,
        "FAMILIES": FAMILIES,
        "UNIQUE_COUNTS": UNIQUE_COUNTS,
        "MAXIMUM_CALLS": MAXIMUM_CALLS,
        "MAXIMUM_TOKEN_COUNT_REQUESTS": MAXIMUM_TOKEN_COUNT_REQUESTS,
        "RECENT_COST_ESTIMATE": RECENT_COST_ESTIMATE,
        "PROVIDER_COST_LIMITS": PROVIDER_COST_LIMITS,
        "MAXIMUM_TOTAL_COST": MAXIMUM_TOTAL_COST,
        "APPROVAL_PATH": APPROVAL_PATH,
        "RUN_KIND_PROVIDER": RUN_KIND_PROVIDER,
        "RUN_KIND_SUMMARY": RUN_KIND_SUMMARY,
        "DEPENDENCIES": DEPENDENCIES,
    }
    functions = {
        "make_corpus": make_corpus,
        "jobs": jobs,
        "cohort_audit": cohort_audit,
        "package_files": package_files,
        "dependency_files": dependency_files,
        "cost_guard_manifest": cost_guard_manifest,
        "effective_request_settings": effective_request_settings,
        "prompt_manifest": prompt_manifest,
        "protocol_manifest": protocol_manifest,
        "run_plan": run_plan,
        "deterministic_screen": deterministic_screen,
        "deterministic_manifest": deterministic_manifest,
        "validate_approval": validate_approval,
    }
    for name, value in values.items():
        setattr(engine, name, value)
    for name, value in functions.items():
        setattr(engine, name, value)
    engine.configure_engine()
    base.SETTINGS = {
        provider: effective_request_settings(provider) for provider in PROVIDERS
    }


configure()


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
        write_new(
            v15.run_provider(args.provider, args.env_file, args.approval_file),
            args.output,
        )
        return
    raise SystemExit("Select --self-test, --check, --print-plan, or --provider")


if __name__ == "__main__":
    main()
