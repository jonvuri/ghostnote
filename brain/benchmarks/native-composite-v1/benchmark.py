#!/usr/bin/env python3
"""Freeze and run the separate native versus composite diagnostic."""

from __future__ import annotations

import argparse
import json
import random
from datetime import date
from collections import defaultdict
from copy import deepcopy
from decimal import Decimal
from functools import lru_cache
from pathlib import Path

import formats
import suite


ROOT = Path(__file__).resolve().parent
prior = formats.load("ghostnote_native_composite_benchmark_prior", ROOT.parent / "symbolic-format-v5/benchmark.py")
repair = formats.load("ghostnote_native_composite_score_repair", ROOT.parent / "symbolic-format-v5/corrected_assessment.py")
core, base = prior.core, prior.base
ARMS, FAMILIES = formats.ARMS, suite.FAMILIES
PROVIDERS, MODELS, SETTINGS = prior.PROVIDERS, prior.MODELS, prior.SETTINGS
RUN_ID = "phase8c4f-native-composite-diagnostic-r1"
SCHEMA = "ghostnote-native-composite-benchmark-v1"
CALLS = (suite.COUNT + 1) * len(FAMILIES) * len(ARMS)
APPROVAL_PATH = ROOT / "runs/diagnostic-r1-approval.json"
BASELINE_PATH = ROOT.parent / "symbolic-format-v5/runs/2026-09-30-corrected-assessment.json"
BASELINE_HASH = "b2bcacdb567e0575f2983aea3e7d3ed914163a6115235f1c6e9c21761493ecad"
LIMITS = {"openai": Decimal("2.75"), "gemini": Decimal("1.00"), "claude-haiku": Decimal("7.00")}
TOTAL_LIMIT = sum(LIMITS.values())
LOCAL_FILES = ("benchmark.py", "formats.py", "suite.py", "report.py", "test_diagnostic.py", "README.md", "PROTOCOL.md")


def signed(value):
    value["sha256"] = core.digest(value)
    return value


@lru_cache(maxsize=1)
def corpus():
    return suite.make_corpus()


def candidate_hashes():
    return {arm: core.digest(formats.descriptor(arm)) for arm in ARMS}


def jobs(provider):
    index = PROVIDERS.index(provider)
    groups = [{"family": family, "variant": task["variant"], "repeat": 1, "task": task} for family, tasks in corpus()["fixtures"].items() for task in tasks]
    groups += [{"family": family, "variant": tasks[0]["variant"], "repeat": 2, "task": tasks[0]} for family, tasks in corpus()["fixtures"].items()]
    random.Random(suite.SEED + index).shuffle(groups)
    rows = []
    for group_index, group in enumerate(groups):
        rotation = (group_index + index) % len(ARMS)
        order = ARMS[rotation:] + ARMS[:rotation]
        rows.extend({**group, "arm": arm} for arm in order)
    return [{**row, "planned_sequence": index} for index, row in enumerate(rows, 1)]


def perfect_payload(arm, task):
    if task["family"] == "comprehension-analysis":
        return core.render_analysis(task["expected"]).removeprefix("ANALYSIS ")
    return formats.render(arm, suite.expected_notes(task))


def prompt_for(job):
    arm, task = job["arm"], job["task"]
    descriptor = formats.descriptor(arm)
    analysis = task["family"] == "comprehension-analysis"
    parts = [
        "Complete one symbolic-music task.",
        "Return one JSON object with exactly one string field named payload. Put the requested output in that string. Do not add prose.",
        "The shared musical fields are voice, start in quarter-note beats, duration in beats, and MIDI pitch. All outputs are full note sets. Stable note identity and attack velocity are outside this task.",
        f"Representation: {arm}.",
        descriptor["grammar"],
    ]
    if analysis:
        parts += ["Use this shared analysis output grammar: " + prior.v14.analysis_grammar(), "Analysis output example:\n" + prior.v14.example_for("compact-bar-fields", "comprehension-analysis")]
    else:
        parts += ["Complete output example; use the task values:\n" + descriptor["example"]]
    parts.append(suite.instruction(task))
    if task["source"]:
        parts += ["<input_document>", formats.render(arm, task["source"]), "</input_document>"]
    return "\n\n".join(parts)


def score_notes(task, notes, structural=True, canonical=True, alignment=None, error=None):
    """Score the common fields without note ID or velocity credit."""
    if task["family"] in {"generation-progression", "generation-melody", "continuation-roles"}:
        cases = [prior.engine.case_record("requirements", suite.constraint_checks(task, notes))]
    else:
        expected = suite.expected_notes(task)
        cases = exact_cases(expected, notes)
        cases.append(prior.engine.case_record("note-set", {"exact_note_count": len(notes) == len(expected)}))
    value = prior.v15.score_value(structural, canonical, cases, {}, {"error": error} if error else None)
    value["notation_ledger_alignment"] = alignment
    return value


def exact_cases(expected, actual):
    """Match exact tuples first, then maximize field agreement in bounded time."""
    assignment, remaining = {}, set(range(len(actual)))
    for index, note in enumerate(expected):
        choices = [position for position in sorted(remaining) if all(actual[position][field] == note[field] for field in formats.FIELDS)]
        if choices:
            assignment[index] = choices[0]
            remaining.remove(choices[0])
    pending, candidates = [index for index in range(len(expected)) if index not in assignment], sorted(remaining)
    if pending:
        # Dummy columns allow an expected note to have no matching actual note.
        costs = [[-sum(actual[position][field] == expected[index][field] for field in formats.FIELDS) for position in candidates] + [0] * len(pending) for index in pending]
        row_count, column_count = len(costs), len(costs[0])
        u, v, matched, previous = [0] * (row_count + 1), [0] * (column_count + 1), [0] * (column_count + 1), [0] * (column_count + 1)
        for row in range(1, row_count + 1):
            matched[0], column = row, 0
            minimum, used = [float("inf")] * (column_count + 1), [False] * (column_count + 1)
            while True:
                used[column] = True
                current, delta, next_column = matched[column], float("inf"), 0
                for target in range(1, column_count + 1):
                    if used[target]:
                        continue
                    reduced = costs[current - 1][target - 1] - u[current] - v[target]
                    if reduced < minimum[target]:
                        minimum[target], previous[target] = reduced, column
                    if minimum[target] < delta:
                        delta, next_column = minimum[target], target
                for target in range(column_count + 1):
                    if used[target]:
                        u[matched[target]] += delta
                        v[target] -= delta
                    else:
                        minimum[target] -= delta
                column = next_column
                if matched[column] == 0:
                    break
            while column:
                matched[column] = matched[previous[column]]
                column = previous[column]
        for column in range(1, column_count + 1):
            if matched[column] and column <= len(candidates):
                assignment[pending[matched[column] - 1]] = candidates[column - 1]
    return [prior.engine.case_record(note["id"], {field: actual[assignment[index]][field] == note[field] if index in assignment else False for field in formats.FIELDS}) for index, note in enumerate(expected)]


def score_response(arm, task, payload):
    if task["family"] == "comprehension-analysis":
        old = prior.v15.analysis_score(task, payload)
        cases = [prior.engine.case_record(case["case_id"], {name: passed for name, passed in case["components"].items() if name != "chord_ids"}) for case in old["cases"]]
        return prior.v15.score_value(old["structural_parse_pass"], old["canonical_form_pass"], cases, {}, old["diagnostic"])
    parsed = formats.parse(arm, payload)
    value = score_notes(task, parsed.notes, parsed.structural, parsed.canonical, parsed.alignment, parsed.error)
    if arm.endswith("composite"):
        try:
            notation = payload.split(formats.SEPARATOR, 1)[0]
            notes = formats.PARSERS[arm.rsplit("-", 1)[0]](notation)
        except (formats.ET.ParseError, KeyError, TypeError, ValueError, ZeroDivisionError):
            notes = []
        value["notation_musical_component"] = score_notes(task, notes)["component"]
    return value


def baseline():
    value = json.loads(BASELINE_PATH.read_text())
    if value.get("sha256") != BASELINE_HASH or core.digest({k: v for k, v in value.items() if k != "sha256"}) != BASELINE_HASH:
        raise ValueError("The corrected baseline hash changed")
    return {"assessment_sha256": BASELINE_HASH, "scorer_sha256": value["scorer_sha256"], "metric_warning": "Historical five-field component results are context only. Do not subtract them from the fresh four-field paired results.", "providers": {provider: {arm: value["aggregates"][provider]["arms"][arm] for arm in prior.ARMS} for provider in PROVIDERS}}


@lru_cache(maxsize=1)
def cost_basis():
    cells = {}
    manifests = {}
    for provider in PROVIDERS:
        rows, hashes = repair.retained_rows(provider)
        manifests[provider] = hashes
        cells[provider] = {}
        for arm in (f"{name}-composite" for name in formats.FORMATS):
            cells[provider][arm] = {}
            for family in FAMILIES:
                calls = [row["initial_call"] for row in rows if row["arm"] == arm and row["family"] == family and row["initial_call"] and row["initial_call"].get("usage")]
                total = sum((base.cost_usd(provider, call["usage"])[1] for call in calls), Decimal(0))
                cells[provider][arm][family] = {"measured_calls": len(calls), "mean_exact_usd": str(total / len(calls))}
    return {"source_manifest_sha256": manifests, "cells": cells}


def cost_guard_manifest():
    basis = cost_basis()
    estimates = {}
    for provider in PROVIDERS:
        estimate = sum((Decimal(cell["mean_exact_usd"]) * (suite.COUNT + 1) * 2 for families in basis["cells"][provider].values() for cell in families.values()), Decimal(0))
        estimates[provider] = base.rounded_usd(estimate)
    return {
        "estimate_usd": estimates, "estimate_total_usd": base.rounded_usd(sum(Decimal(str(value)) for value in estimates.values())),
        "maximum_provider_cost_usd": {p: float(v) for p, v in LIMITS.items()}, "maximum_total_cost_usd": float(TOTAL_LIMIT),
        "maximum_call_cost_usd": {p: base.exact_usd(base.maximum_call_cost(p)) for p in PROVIDERS},
        "input_token_ceiling_per_call": base.INPUT_TOKEN_CEILING, "output_token_ceiling_per_call": {p: base.output_token_limit(p) for p in PROVIDERS},
        "request_byte_ceiling_per_call": base.REQUEST_BYTE_CEILING,
        "prices_usd_per_million": base.PRICES_USD_PER_MILLION,
        "price_sources": {**base.PRICE_SOURCES, "claude-haiku": "https://platform.claude.com/docs/en/about-claude/pricing"},
        "price_verification_date": "2026-09-30", "price_valid_through": "2026-12-31",
        "estimate_method": "Use each retained v5 provider/format/family mean token cost for four fresh calls in each condition. Assume no native cost reduction. The new prompt and output sizes can differ.",
        "basis": basis, "failed_reservation": "retained", "automatic_retries": 0, "repairs": 0,
    }


def eligibility_manifest():
    return {
        "fields": list(formats.FIELDS), "excluded_fields": ["id", "velocity", "document metadata"],
        "native_defaults": {"velocity": "Parser placeholder 84; never scored", "id": "Parser event index; never preserved or scored"},
        "timing": "Exact rational quarter-note beats; positive durations and nonnegative starts",
        "voice_names": "Native ABC voices, Strudel labels, LilyPond Voice names, or MusicXML part names. The lane suffix is a local convention, not note identity.",
        "output_mode": "Complete output note set; no sparse edit or stable identity claim",
        "task_cells": [{"task_sha256": task["sha256"], "family": family, "arm": arm, "input_eligible": True, "output_eligible": True, "common_fields": list(formats.FIELDS)} for family, tasks in corpus()["fixtures"].items() for task in tasks for arm in ARMS],
        "excluded_families": {"transformation-local": "Outside the planned diagnostic; identity and exact preservation are outside the shared contract", "transformation-revoice": "Outside the planned comprehension, generation, and continuation scope", "transformation-rhythm": "Outside the planned comprehension, generation, and continuation scope", "document-serialization": "Full metadata and identity are outside the native field contract"},
        "analysis_groups": "Select keys notes by inclusive start intervals. Case labels are response labels. No input note IDs select a group.",
        "analysis_motifs": "Retain the shared numeric motif-pair data. The notation condition changes only chord input.",
        "parsers": "Repository subset parsers. No external engine or full public-standard conformance claim.",
    }


def prompt_manifest():
    return {provider: [{**{key: job[key] for key in ("planned_sequence", "arm", "family", "variant", "repeat")}, "task_sha256": job["task"]["sha256"], "prompt_sha256": core.sha256_text(prompt_for(job)), "prompt_bytes": len(prompt_for(job).encode())} for job in jobs(provider)] for provider in PROVIDERS}


def dependency_files():
    paths = {ROOT.parent / name for name in prior.dependency_files()}
    paths.update(ROOT.parent / "symbolic-format-v5" / name for name in ("benchmark.py", "suite.py", "formats.py", "corrected_assessment.py", "final_assessment.py", "assessment.py"))
    paths.add(BASELINE_PATH)
    for names in repair.CHAIN_NAMES.values():
        paths.update(repair.RUNS / name for name in names)
    return {str(path.relative_to(ROOT.parent)): base.file_sha256(path) for path in sorted(paths)}


def protocol_manifest():
    return signed({
        "schema": SCHEMA, "run_id": RUN_ID,
        "package_files": {name: base.file_sha256(ROOT / name) for name in LOCAL_FILES}, "dependency_files": dependency_files(),
        "cohort_sha256": corpus()["sha256"], "cohort_audit": suite.freshness(corpus()),
        "candidate_sha256": candidate_hashes(), "candidate_definitions": {arm: formats.descriptor(arm) for arm in ARMS},
        "eligibility": eligibility_manifest(), "prompts": prompt_manifest(),
        "models": MODELS, "declared_settings": SETTINGS,
        "effective_request_settings": {p: prior.effective_request_settings(p) for p in PROVIDERS},
        "calls": {"messages_per_arm_per_provider": CALLS // len(ARMS), "messages_per_provider": CALLS, "messages_total": CALLS * len(PROVIDERS), "claude_token_count_requests_maximum": CALLS, "unique_tasks": len(FAMILIES) * suite.COUNT, "sentinels_per_arm": len(FAMILIES), "automatic_retries": 0, "repairs": 0},
        "cost_guard": cost_guard_manifest(), "baseline": baseline(),
        "measurement": {"primary": "Common musical components by provider, family, and format", "contrast": "Native minus composite on complete pairs; prompt mean accuracy and strict musical success", "sentinels": "Report separately; exclude repeat=2 from primary estimates", "missing": "Exclude failed and unavailable outputs from musical denominators; exclude an incomplete pair from paired contrasts", "uncertainty": "Paired prompt bootstrap within provider/family/format; three unique prompts give coarse uncertainty", "notation": "Score the composite ledger as primary and its notation independently as a diagnostic", "selection": "Diagnostic only. No product selection or Phase 8f authorization."},
        "stopping_rule": "Stop on the first transport, budget, approval, model identity, freshness, or deterministic-screen failure. Stop after three unavailable outputs. No retry, repair, or continuation is authorized.",
        "approval_boundary": "Explicit operator approval must match all frozen plan hashes, models, settings, schedules, and cost limits before any provider or token-count request.",
    })


def run_plan():
    protocol = protocol_manifest()
    return signed({"schema": SCHEMA, "run_id": RUN_ID, "protocol_sha256": protocol["sha256"], "cohort_sha256": protocol["cohort_sha256"], "candidate_sha256": protocol["candidate_sha256"], "arms": list(ARMS), "families": list(FAMILIES), "models": MODELS, "declared_settings": SETTINGS, "effective_request_settings": protocol["effective_request_settings"], "calls": protocol["calls"], "cost_guard": protocol["cost_guard"], "measurement": protocol["measurement"], "schedule_sha256": {p: core.digest(protocol["prompts"][p]) for p in PROVIDERS}, "approval": "pending"})


def deterministic_screen():
    checks = {}
    freshness = suite.freshness(corpus())
    checks["fresh-musical-content"] = freshness["historical_overlap"] == 0 and freshness["internal_duplicates"] == 0 and freshness["unique_tasks"] == 18
    for family, tasks in corpus()["fixtures"].items():
        for index, task in enumerate(tasks):
            for arm in ARMS:
                score = score_response(arm, task, perfect_payload(arm, task))
                checks[f"{family}:{index}:{arm}:reference"] = score["component"]["correct"] == score["component"]["planned"] and score["structural_parse_pass"]
                source = task["source"]
                if source:
                    checks[f"{family}:{index}:{arm}:source"] = formats.project(formats.parse(arm, formats.render(arm, source)).notes) == formats.project(source)
                if arm.endswith("native"):
                    checks[f"{family}:{index}:{arm}:no-ledger"] = formats.SEPARATOR not in prompt_for({"arm": arm, "task": task}) and "GN voice=" not in prompt_for({"arm": arm, "task": task})
    for provider in PROVIDERS:
        schedule = jobs(provider)
        checks[f"{provider}:schedule"] = len(schedule) == CALLS and [j["planned_sequence"] for j in schedule] == list(range(1, CALLS + 1))
        checks[f"{provider}:request-bounds"] = all(base.request_bytes(provider, prompt_for(job)) <= base.REQUEST_BYTE_CEILING for job in schedule)
        for arm in ARMS:
            for family in FAMILIES:
                repeats = [j for j in schedule if j["arm"] == arm and j["family"] == family and j["variant"] == corpus()["fixtures"][family][0]["variant"]]
                checks[f"{provider}:{arm}:{family}:sentinel"] = len(repeats) == 2 and len(set(prompt_for(j) for j in repeats)) == 1
    checks["baseline-hash"] = baseline()["assessment_sha256"] == BASELINE_HASH
    costs = cost_guard_manifest()
    checks["cost-headroom"] = all(Decimal(str(costs["estimate_usd"][p])) + base.maximum_call_cost(p) < LIMITS[p] for p in PROVIDERS)
    value = {"checks": checks, "all_checks_pass": all(checks.values())}
    return signed(value)


def deterministic_manifest():
    screen, plan = deterministic_screen(), run_plan()
    return signed({"schema": SCHEMA, "screen_sha256": screen["sha256"], "protocol_sha256": plan["protocol_sha256"], "run_plan_sha256": plan["sha256"], "cohort_sha256": plan["cohort_sha256"], "candidate_sha256": candidate_hashes(), "all_checks_pass": screen["all_checks_pass"]})


def validate_approval(path):
    value, plan = json.loads(path.read_text()), run_plan()
    expected = {"run_id": RUN_ID, "protocol_sha256": plan["protocol_sha256"], "run_plan_sha256": plan["sha256"], "cohort_sha256": plan["cohort_sha256"], "candidate_sha256": plan["candidate_sha256"], "schedule_sha256": plan["schedule_sha256"], "maximum_total_cost_usd": float(TOTAL_LIMIT)}
    if any(value.get(key) != item for key, item in expected.items()):
        raise ValueError("Approval does not match the frozen diagnostic")
    if value.get("status") != "approved" or not isinstance(value.get("operator_statement"), str) or not value["operator_statement"].strip():
        raise ValueError("The diagnostic needs explicit operator approval")
    if date.today() > date(2026, 12, 31):
        raise ValueError("The frozen price period expired; freeze and approve a new plan")
    return value


def configure_runner():
    runner = prior.v14
    for name, value in {"SCHEMA": SCHEMA, "RUN_ID": RUN_ID, "COHORT": suite.COHORT, "ARMS": ARMS, "PROVIDERS": PROVIDERS, "KEYS": prior.KEYS, "MODELS": MODELS, "SETTINGS": SETTINGS, "MAXIMUM_CALLS": CALLS, "MAXIMUM_TOKEN_COUNT_REQUESTS": CALLS, "PROVIDER_COST_LIMITS": LIMITS}.items():
        setattr(runner, name, value)
    for name, function in {"make_corpus": corpus, "jobs": jobs, "candidate_hashes": candidate_hashes, "prompt_for": prompt_for, "score_response": score_response, "effective_request_settings": prior.effective_request_settings, "validate_approval": validate_approval, "deterministic_screen": deterministic_screen, "protocol_manifest": protocol_manifest, "run_plan": run_plan}.items():
        setattr(runner, name, function)
    runner.parse_failure = lambda message: {"syntax_pass": False, "structural_parse_pass": False, "canonical_form_pass": False, "component": {"correct": 0, "planned": 1, "case_correct": 0, "case_planned": 1}, "cases": [], "diagnostic": {"error": message}}
    original_call = runner.one_call

    def checked_call(provider, key, job, guard):
        state, call = original_call(provider, key, job, guard)
        if call.get("returned_model") != MODELS[provider]:
            raise runner.ProviderCompletedError("The returned model does not match the frozen model", call)
        if state.get("score") is not None and not call.get("outer_schema_valid", True):
            state = core.result_state("initial", score_response(job["arm"], job["task"], ""))
        return state, call

    runner.one_call = checked_call
    return runner


def write_new(value, path):
    with path.open("x") as output:
        json.dump(value, output, indent=2, sort_keys=True)
        output.write("\n")


def freeze(check_only=False):
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise ValueError(json.dumps({k: v for k, v in screen["checks"].items() if not v}))
    artifacts = {
        "cohort-manifest.json": corpus(), "eligibility-manifest.json": signed(eligibility_manifest()),
        "baseline.json": signed(baseline()), "protocol.json": protocol_manifest(),
        "runs/diagnostic-r1-plan.json": run_plan(), "expected-deterministic.json": deterministic_manifest(),
        "prompts.json": signed({"prompts": [{"arm": arm, "task_sha256": task["sha256"], "family": family, "prompt": prompt_for({"arm": arm, "task": task}), "reference_payload": perfect_payload(arm, task)} for family, tasks in corpus()["fixtures"].items() for task in tasks for arm in ARMS]}),
    }
    for name, value in artifacts.items():
        path = ROOT / name
        if path.exists():
            if json.loads(path.read_text()) != value:
                raise ValueError(f"Frozen artifact changed: {path}")
        else:
            if check_only:
                raise ValueError(f"Frozen artifact is missing: {path}")
            path.parent.mkdir(parents=True, exist_ok=True)
            write_new(value, path)
    print(json.dumps({"pass": True, "plan_sha256": artifacts["runs/diagnostic-r1-plan.json"]["sha256"], "cost": cost_guard_manifest()["estimate_usd"]}))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--freeze", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--provider", choices=PROVIDERS)
    parser.add_argument("--approval-file", type=Path, default=APPROVAL_PATH)
    parser.add_argument("--env-file", type=Path, default=ROOT.parents[2] / ".env")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.freeze or args.check:
        freeze(check_only=args.check)
    elif args.provider:
        if args.output is None or args.output.exists():
            raise ValueError("Use a new provider output path")
        freeze(check_only=True)
        approval = validate_approval(args.approval_file)
        attempt_path = ROOT / "runs" / f"{args.provider}-attempt.json"
        write_new({"run_id": RUN_ID, "provider": args.provider, "run_plan_sha256": run_plan()["sha256"], "approval": approval, "output_path": str(args.output.resolve())}, attempt_path)
        runner = configure_runner()
        value = runner.run_provider(args.provider, args.env_file, args.approval_file)
        value["run_kind"] = "native-composite-diagnostic-provider"
        value["manifest_sha256"] = core.digest({k: v for k, v in value.items() if k != "manifest_sha256"})
        write_new(value, args.output)
    else:
        parser.error("Select --freeze, --check, or --provider")


if __name__ == "__main__":
    main()
