#!/usr/bin/env python3
"""Prepare and run the MusicXML and MIDI-like follow-up probe."""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from copy import deepcopy
from decimal import Decimal
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent
V3_ROOT = BENCHMARKS_ROOT / "symbolic-format-v3"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


prior = load_module("ghostnote_symbolic_format_v4_v3_benchmark", V3_ROOT / "benchmark.py")
suite = load_module("ghostnote_symbolic_format_v4_suite", PACKAGE_ROOT / "suite.py")
formats = load_module("ghostnote_symbolic_format_v4_formats", PACKAGE_ROOT / "formats.py")
base = prior.base
core = prior.core
v15 = prior.v15
v14 = prior.v14

SCHEMA = "ghostnote-symbolic-format-benchmark-v4"
RUN_ID = "phase8c4f-musicxml-midi-probe-r1"
COHORT = suite.DEFAULT_COHORT
SEED = suite.DEFAULT_SEED
VARIANT_OFFSET = suite.DEFAULT_VARIANT_OFFSET
ARMS = ("musicxml-4.0-composite", "midi-like-ghostnote-profile")
MATRIX_ARMS = tuple(formats.REGISTRY)
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
RECENT_COST_ESTIMATE = {"gemini": Decimal("0.090000")}
PROVIDER_COST_LIMITS = {"gemini": Decimal("0.200000")}
MAXIMUM_TOTAL_COST = Decimal("0.200000")
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "musicxml-midi-probe-r1-approval.json"
RUN_KIND_PROVIDER = "musicxml-midi-probe-provider"
RUN_KIND_SUMMARY = "musicxml-midi-probe-summary"
DEPENDENCIES = tuple(
    dict.fromkeys(
        (
            V3_ROOT / "benchmark.py",
            V3_ROOT / "suite.py",
            V3_ROOT / "formats.py",
            *prior.DEPENDENCIES,
        )
    )
)


def selected_probe_tasks(corpus: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        task
        for family in FAMILIES
        for task in corpus["fixtures"][family][: PROBE_COUNTS[family]]
    ]


def cohort_audit() -> dict[str, Any]:
    corpus = suite.make_corpus(COHORT, SEED, VARIANT_OFFSET)
    tasks = selected_probe_tasks(corpus)
    current = {task["content_sha256"] for task in tasks}
    historical = set()
    for old_corpus in (suite.v19.make_corpus(), suite.v3.make_corpus()):
        historical.update(
            suite.v3.content_sha256(task)
            for values in old_corpus["fixtures"].values()
            for task in values
        )
    value = {
        "corpus_sha256": corpus["sha256"],
        "selected_task_count": len(tasks),
        "selected_content_hash_count": len(current),
        "selected_internal_content_duplicates": len(tasks) - len(current),
        "historical_content_overlap": len(current & historical),
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
        "recent_cost_estimate_usd": {"gemini": 0.09},
        "recent_cost_estimate_total_usd": 0.09,
        "maximum_provider_cost_usd": {"gemini": 0.2},
        "maximum_total_cost_usd": 0.2,
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


base_protocol_manifest = prior.protocol_manifest


def protocol_manifest() -> dict[str, Any]:
    value = base_protocol_manifest()
    value["run_kind"] = "musicxml-midi-probe-protocol"
    value["measurement"]["public_notation"] = (
        "Parse notation and side ledger independently. Keep notation structure, "
        "alignment, and canonical form as diagnostics."
    )
    value["approval_boundary"] = (
        "No provider request is approved until the operator approves this exact "
        "plan, schedule, model, settings, and USD 0.200000 hard limit."
    )
    value.pop("sha256", None)
    value["sha256"] = core.digest(value)
    return value


base_run_plan = prior.run_plan


def run_plan() -> dict[str, Any]:
    return base_run_plan()


def deterministic_screen() -> dict[str, Any]:
    corpus = prior.make_corpus()
    suite_result = suite.suite_screen(corpus)
    scoring = prior.scoring_screen()
    adapters = prior.adapter_screen()
    prompts = prior.prompt_manifest()
    freshness = cohort_audit()
    layer_checks: dict[str, bool] = {}
    exact_task = corpus["fixtures"]["comprehension-structure"][0]
    for arm in ARMS:
        payload = prior.perfect_payload(arm, exact_task)
        _surface, ledger = payload.split(formats.SEPARATOR, 1)
        parsed = formats.get(arm).parse_payload(
            "BROKEN NOTATION\n" + formats.SEPARATOR + ledger
        )
        score = prior.exact_score(exact_task, parsed)
        layer_checks[f"{arm}:broken-surface-retains-ledger"] = bool(parsed.notes)
        layer_checks[f"{arm}:broken-surface-fails-structure"] = not parsed.structural
        layer_checks[f"{arm}:broken-surface-fails-alignment"] = parsed.alignment is False
        layer_checks[f"{arm}:broken-surface-retains-musical-score"] = (
            score["component"]["case_correct"]
            == score["component"]["case_planned"]
        )
    checks = {
        "suite": suite_result["all_pass"],
        "scoring": scoring["all_pass"],
        "adapters": adapters["all_pass"],
        "fresh-selected-content": freshness["historical_content_overlap"] == 0,
        "no-selected-content-duplicates": freshness[
            "selected_internal_content_duplicates"
        ]
        == 0,
        "job-count": all(len(rows) == MAXIMUM_CALLS for rows in prompts.values()),
        "request-bytes": all(
            row["prompt_bytes"] <= base.REQUEST_BYTE_CEILING
            for rows in prompts.values()
            for row in rows
        ),
        "matrix-arm-scope": MATRIX_ARMS
        == (
            "compact-bar-fields",
            "compact-bar-local-labels",
            "exact-object-json",
            "abc-2.1-composite",
            "strudel-v1.2-composite",
            "lilypond-2.24.4-composite",
            "musicxml-4.0-composite",
            "midi-like-ghostnote-profile",
        ),
        "independent-notation-and-ledger": all(layer_checks.values()),
    }
    value = {
        "checks": checks,
        "suite": suite_result,
        "scoring": scoring,
        "adapters": adapters,
        "freshness": freshness,
        "independent_layer_checks": layer_checks,
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
        "candidate_sha256": prior.candidate_hashes(),
        "job_count_per_provider": MAXIMUM_CALLS,
        "all_checks_pass": screen["all_checks_pass"],
    }
    value["sha256"] = core.digest(value)
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
        "PROBE_COUNTS": PROBE_COUNTS,
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
        "cohort_audit": cohort_audit,
        "package_files": package_files,
        "dependency_files": dependency_files,
        "cost_guard_manifest": cost_guard_manifest,
        "protocol_manifest": protocol_manifest,
        "run_plan": run_plan,
        "deterministic_screen": deterministic_screen,
        "deterministic_manifest": deterministic_manifest,
    }
    for name, value in values.items():
        setattr(prior, name, value)
    for name, value in functions.items():
        setattr(prior, name, value)
    prior.configure_engine()


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
    parser.add_argument("--print-matrix-template", action="store_true")
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
        write_new(prior.matrix_template(MATRIX_ARMS), args.output)
        return
    if args.provider:
        write_new(
            v15.run_provider(args.provider, args.env_file, args.approval_file),
            args.output,
        )
        return
    raise SystemExit(
        "Select --self-test, --check, --print-plan, --print-matrix-template, or --provider"
    )


if __name__ == "__main__":
    main()
