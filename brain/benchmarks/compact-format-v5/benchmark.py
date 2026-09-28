#!/usr/bin/env python3
"""Run the Phase 8c4b compact-bar measurement-repair calibration."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import importlib.util
import json
import os
import platform
import random
import sys
import time
import urllib.error
from collections import defaultdict
from copy import deepcopy
from pathlib import Path
from typing import Any, Callable


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent
sys.path.insert(0, str(PACKAGE_ROOT))
import core  # type: ignore  # noqa: E402
sys.path.pop(0)


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


transport = load_module(
    "ghostnote_compact_format_v5_transport",
    BENCHMARKS_ROOT / "compact-format-v2" / "benchmark.py",
)

SCHEMA = "ghostnote-compact-format-calibration-v5"
RUN_ID = "phase8c4b-focused-compact-calibration-r2"
PROVIDERS = ("openai", "gemini", "claude")
MODELS = {
    "openai": "gpt-5.4-mini-2026-03-17",
    "gemini": "gemini-3.8-flash",
    "claude": "claude-sonnet-5",
}
KEYS = {
    "openai": "OPENAI_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "claude": "ANTHROPIC_API_KEY",
}
SETTINGS = {
    "openai": {"reasoning_effort": "low", "max_completion_tokens": 5000},
    "gemini": {"thinking_level": "low", "max_output_tokens": 5000},
    "claude": {"effort": "low", "max_tokens": 5000},
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
    "eligible": "Every available initial parse or musical-contract failure, including a named sentinel.",
    "feedback": "Return only the structured parse or failed-check diagnostic.",
    "primary_result": "Initial musical success only. A repair never replaces an initial result.",
    "unavailable_or_failed": "Do not repair and do not add to a scored denominator.",
}
SIZE_GATES = {
    "fields_to_positional_document_bytes_maximum": 1.30,
    "fields_to_positional_prompt_tokens_maximum": 1.15,
    "compact_to_exact_document_bytes_maximum": 0.75,
}
EMPIRICAL_COST_BASIS = {
    "source": "The larger recent mean call cost from Phase 8c4b calibration r1 or the prior retained basis.",
    "method": "Multiply the mean by the maximum call count and add 25 percent.",
    "price_verification_date": "2026-09-28",
    "mean_call_cost_usd": {
        "openai": 0.007320732142857144,
        "gemini": 0.003487282722513089,
        "claude": 0.01873190322580645,
    },
    "contingency": 0.25,
}
HISTORICAL_PACKAGES = (
    "symbolic-format-v1",
    "compact-format-v2",
    "compact-format-v3",
    "compact-format-v4",
    "compact-json-v1",
    "symbolic-format-v2",
)
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "calibration-r2-approval.json"


def expect_rejected(action: Callable[[], Any]) -> bool:
    try:
        action()
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return True
    return False


def collect_semantic_hashes(value: Any, result: set[str]) -> None:
    if isinstance(value, dict):
        for name, item in value.items():
            if name == "semantic_sha256":
                if isinstance(item, str):
                    result.add(item)
                elif isinstance(item, list):
                    result.update(entry for entry in item if isinstance(entry, str))
            else:
                collect_semantic_hashes(item, result)
    elif isinstance(value, list):
        for item in value:
            collect_semantic_hashes(item, result)


def historical_semantics() -> set[str]:
    result: set[str] = set()
    for package in HISTORICAL_PACKAGES:
        root = BENCHMARKS_ROOT / package
        for path in root.rglob("*.json"):
            if "__pycache__" in path.parts:
                continue
            try:
                collect_semantic_hashes(json.loads(path.read_text()), result)
            except json.JSONDecodeError:
                continue
    return result


def cohort_audit() -> dict[str, Any]:
    corpora = {name: core.make_corpus(name) for name in core.COHORT_SPECS}
    full = {
        name: {task["sha256"] for values in corpus["fixtures"].values() for task in values}
        for name, corpus in corpora.items()
    }
    semantic = {
        name: {task["semantic_sha256"] for values in corpus["fixtures"].values() for task in values}
        for name, corpus in corpora.items()
    }
    historical = historical_semantics()
    pairwise = []
    names = list(corpora)
    for index, left in enumerate(names):
        for right in names[index + 1 :]:
            pairwise.append(
                {
                    "left": left,
                    "right": right,
                    "fixture_hash_overlap": len(full[left] & full[right]),
                    "semantic_hash_overlap": len(semantic[left] & semantic[right]),
                }
            )
    return {
        "cohorts": {
            name: {
                "corpus_sha256": corpus["sha256"],
                "fixture_count": sum(len(values) for values in corpus["fixtures"].values()),
                "fixture_sha256": sorted(full[name]),
                "semantic_sha256": sorted(semantic[name]),
                "historical_semantic_overlap": len(semantic[name] & historical),
            }
            for name, corpus in corpora.items()
        },
        "historical_semantic_count": len(historical),
        "pairwise": pairwise,
    }


def cohort_manifest() -> dict[str, Any]:
    value = {"schema": core.CORPUS_SCHEMA, "kind": "cohort-manifest", **cohort_audit()}
    value["sha256"] = core.digest(value)
    return value


def format_screen() -> dict[str, Any]:
    notes = [
        core.note("cap-bass", "bass", "0", "1", 48, 80, channel=0, articulation="normal"),
        core.note("cap-lead", "lead", "0", "1/2", 67, 84, channel=1, expression=0.75),
        core.note("cap-tail", "lead", "3/4", "1/4", 69, 82, channel=1, mute=False),
    ]
    represented = [{name: row[name] for name in core.FIELDS} for row in notes]
    overlays = core.sample_overlays(represented)
    document = core.make_document(represented, "base-example", "source-example", overlays)
    minimal = core.make_document(represented, "base-example", "source-example")
    rendered = {arm: core.render_document(arm, document) for arm in core.ARMS}
    parsed = {arm: core.parse_document(arm, text) for arm, text in rendered.items()}
    minimal_rendered = {arm: core.render_document(arm, minimal) for arm in core.ARMS}
    positional_lines = rendered["compact-bar-v1"].splitlines()
    fields_lines = rendered["compact-bar-fields"].splitlines()

    patch = {
        "base_sha256": "base-example",
        "ops": [{"op": "set", "id": "cap-lead", "changes": {"pitch": 68}}],
    }
    patches = {arm: core.parse_patch(arm, core.render_patch(arm, patch)) for arm in core.ARMS}
    compiled = {arm: core.compile_patch(value, notes, "base-example") for arm, value in patches.items()}
    insert_delete = {
        "base_sha256": "base-example",
        "ops": [
            {"op": "delete", "id": "cap-tail"},
            {"op": "insert", "note": core.note("cap-new", "lead", "1", "1/2", 71, 86)},
        ],
    }
    insert_delete_pass = all(
        {row["id"] for row in core.compile_patch(core.parse_patch(arm, core.render_patch(arm, insert_delete)), notes, "base-example")}
        == {"cap-bass", "cap-lead", "cap-new"}
        for arm in core.ARMS
    )
    wrong_order = deepcopy(document)
    wrong_order["notes"] = list(reversed(wrong_order["notes"]))
    invalid_pitch = deepcopy(document)
    invalid_pitch["notes"][0]["pitch"] = 128
    invalid_velocity = deepcopy(document)
    invalid_velocity["notes"][0]["velocity"] = 0
    invalid_duration = deepcopy(document)
    invalid_duration["notes"][0]["duration"] = "0"
    duplicate = deepcopy(document)
    duplicate["notes"][1]["id"] = duplicate["notes"][0]["id"]
    unknown_overlay = deepcopy(document)
    unknown_overlay["overlays"]["bars"][0]["event_ids"].append("missing")
    wrong_omits = deepcopy(document)
    wrong_omits["omits"] = list(core.OMISSIONS[:-1])
    preservation = all(
        next(row for row in rows if row["id"] == "cap-lead")["channel"] == 1
        and next(row for row in rows if row["id"] == "cap-lead")["expression"] == 0.75
        and next(row for row in rows if row["id"] == "cap-bass")["pitch"] == 48
        for rows in compiled.values()
    )
    conflict = all(expect_rejected(lambda value=value: core.compile_patch(value, notes, "other-base")) for value in patches.values())
    unknown_id = all(
        expect_rejected(
            lambda arm=arm: core.compile_patch(
                core.parse_patch(arm, core.render_patch(arm, {"base_sha256": "base-example", "ops": [{"op": "delete", "id": "missing"}]})),
                notes,
                "base-example",
            )
        )
        for arm in core.ARMS
    )
    duplicate_target = all(
        expect_rejected(
            lambda arm=arm: core.render_patch(
                arm,
                {
                    "base_sha256": "base-example",
                    "ops": [
                        {"op": "set", "id": "cap-bass", "changes": {"pitch": 49}},
                        {"op": "delete", "id": "cap-bass"},
                    ],
                },
            )
        )
        for arm in core.ARMS
    )
    structure_task = core.make_corpus("calibration")["fixtures"]["comprehension-structure"][0]
    prompts = {arm: core.prompt_for(arm, structure_task) for arm in core.ARMS}
    bytes_value = {arm: len(text.encode()) for arm, text in minimal_rendered.items()}
    tokens = {arm: (len(text.encode()) + 3) // 4 for arm, text in prompts.items()}
    ratios = {
        "fields_to_positional_document_bytes": bytes_value["compact-bar-fields"] / bytes_value["compact-bar-v1"],
        "fields_to_positional_prompt_tokens": tokens["compact-bar-fields"] / tokens["compact-bar-v1"],
        "positional_to_exact_document_bytes": bytes_value["compact-bar-v1"] / bytes_value["exact-object-json"],
        "fields_to_exact_document_bytes": bytes_value["compact-bar-fields"] / bytes_value["exact-object-json"],
    }
    size_gates_pass = (
        ratios["fields_to_positional_document_bytes"] <= SIZE_GATES["fields_to_positional_document_bytes_maximum"]
        and ratios["fields_to_positional_prompt_tokens"] <= SIZE_GATES["fields_to_positional_prompt_tokens_maximum"]
        and max(ratios["positional_to_exact_document_bytes"], ratios["fields_to_exact_document_bytes"])
        <= SIZE_GATES["compact_to_exact_document_bytes_maximum"]
    )
    return {
        "round_trip": {arm: parsed[arm] == document for arm in core.ARMS},
        "minimal_overlay_absence": {arm: core.parse_document(arm, text)["overlays"] == core.empty_overlays() for arm, text in minimal_rendered.items()},
        "compact_single_feature_difference": fields_lines[:3] + fields_lines[4:] == positional_lines and fields_lines[3] == "FIELDS " + " ".join(core.FIELDS),
        "one_note_plane": all(sum(line.startswith("N ") for line in rendered[arm].splitlines()) == len(notes) for arm in core.COMPACT_ARMS),
        "overlay_identity_set": all(set(row["event_ids"]).issubset(set(core.event_ids(represented))) for rows in parsed["exact-object-json"]["overlays"].values() for row in rows),
        "stable_identity": all(core.event_ids(parsed[arm]["notes"]) == core.event_ids(represented) for arm in core.ARMS),
        "patch_parity": all(core.projected(rows) == core.projected(compiled["exact-object-json"]) for rows in compiled.values()),
        "exact_preservation": preservation,
        "insert_delete": insert_delete_pass,
        "base_conflict_rejected": conflict,
        "unknown_id_rejected": unknown_id,
        "duplicate_target_rejected": duplicate_target,
        "omission_rejected": expect_rejected(lambda: core.validate_document(wrong_omits)),
        "canonical_order_rejected": expect_rejected(lambda: core.validate_document(wrong_order)),
        "invalid_pitch_rejected": expect_rejected(lambda: core.validate_document(invalid_pitch)),
        "invalid_velocity_rejected": expect_rejected(lambda: core.validate_document(invalid_velocity)),
        "invalid_duration_rejected": expect_rejected(lambda: core.validate_document(invalid_duration)),
        "duplicate_identity_rejected": expect_rejected(lambda: core.validate_document(duplicate)),
        "unknown_overlay_identity_rejected": expect_rejected(lambda: core.validate_document(unknown_overlay)),
        "document_bytes": bytes_value,
        "prompt_token_estimates": tokens,
        "ratios": {name: round(value, 6) for name, value in ratios.items()},
        "size_gates": SIZE_GATES,
        "size_gates_pass": size_gates_pass,
        "render_sha256": {arm: core.sha256_text(text) for arm, text in rendered.items()},
    }


def grammar_screen() -> list[dict[str, Any]]:
    results = []
    for arm in core.ARMS:
        document = core.output_example(arm, "comprehension-structure")
        parsed_document = core.parse_document(arm, document)
        note_rows = len(parsed_document["notes"])
        results.append(
            {
                "arm": arm,
                "form": "document",
                "rows": note_rows,
                "two_row_example": note_rows == 2,
                "pass": note_rows == 2,
            }
        )
        patch = core.output_example(arm, "transformation-local")
        parsed_patch = core.parse_patch(arm, patch)
        operation_rows = len(parsed_patch["ops"])
        results.append(
            {
                "arm": arm,
                "form": "patch",
                "rows": operation_rows,
                "two_row_example": operation_rows == 2,
                "pass": operation_rows == 2,
            }
        )
        analysis = core.output_example(arm, "comprehension-analysis")
        results.append(
            {
                "arm": arm,
                "form": "analysis",
                "rows": 1,
                "two_row_example": None,
                "pass": set(core.parse_analysis(analysis)) == set(core.ANALYSIS_FIELDS),
            }
        )
    return results


def contract_screen() -> dict[str, Any]:
    corpus = core.make_corpus("calibration")
    positive = []
    negative = []
    for arm in core.ARMS:
        for family in core.TASK_FAMILIES:
            for task in corpus["fixtures"][family]:
                scored = core.score_response(arm, task, core.perfect_payload(arm, task))
                positive.append({"arm": arm, "task": task["id"], "pass": scored["primary_pass"]})
                invalid = core.score_response(arm, task, "INVALID")
                negative.append({"arm": arm, "task": task["id"], "pass": not invalid["syntax_pass"]})
    mutations = core.mutation_tests()
    grammars = grammar_screen()
    document_tasks = [
        task
        for family in core.TASK_FAMILIES
        if family not in {"comprehension-analysis", "transformation-local"}
        for task in corpus["fixtures"][family]
    ]
    instructions = {
        "analysis_columns_defined": all(term in core.analysis_instruction(corpus["fixtures"]["comprehension-analysis"][0]) for term in core.FIELDS),
        "analysis_inversion_numbering_defined": "inversion is 0" in core.analysis_instruction(corpus["fixtures"]["comprehension-analysis"][0]),
        "motif_operation_specific": all(
            set(task["contract"])
            == {"operation", "output_start", "output_ids", "axis", "semitones", "rhythmic_factor"}
            and task["contract"]["operation"] == "compound-affine"
            for task in corpus["fixtures"]["continuation-motif"]
        ),
        "motif_formulas_explicit": all(
            all(term in core.task_instruction(task) for term in ("source_pitch", "source_start", "source_duration"))
            for task in corpus["fixtures"]["continuation-motif"]
        ),
        "progression_formula_exact": all(task["contract"]["movement_formula"].startswith("sum(abs(") for task in corpus["fixtures"]["generation-progression"]),
        "progression_triad_only": all(all(len(chord) == 3 for chord in task["contract"]["pitch_classes"]) for task in corpus["fixtures"]["generation-progression"]),
        "output_context_prompt_visible": all(
            core.output_context_instruction(task) in core.prompt_for(arm, task)
            for task in document_tasks
            for arm in core.ARMS
        ),
    }
    return {
        "positive": positive,
        "negative": negative,
        "mutations": mutations,
        "grammar_forms": grammars,
        "instruction_contract": instructions,
        "all_pass": all(item["pass"] for item in positive + negative + mutations + grammars) and all(instructions.values()),
    }


def state_screen() -> dict[str, Any]:
    score = {"primary_pass": True}
    states = {
        "initial": core.result_state("initial", score),
        "repaired": core.result_state("repaired", score),
        "unavailable": core.result_state("unavailable", reason="output-limit"),
        "failed": core.result_state("failed", reason="transport"),
    }
    invalid = {
        "scored_unavailable": expect_rejected(lambda: core.result_state("unavailable", score, "output-limit")),
        "unscored_initial": expect_rejected(lambda: core.result_state("initial")),
        "reasonless_failed": expect_rejected(lambda: core.result_state("failed")),
        "second_repair_not_permitted": REPAIR_POLICY["maximum_turns"] == 1,
    }
    return {
        "states": states,
        "distinct": len({value["kind"] for value in states.values()}) == 4,
        "invalid_rejected": invalid,
        "repair_prompt_has_structured_diagnostic": '"class":"parse"' in core.repair_prompt("prompt", {"class": "parse", "message": "bad"}),
    }


def denominator_rows(results: list[dict[str, Any]], arm: str, family: str) -> list[dict[str, Any]]:
    return [
        row
        for row in results
        if row["arm"] == arm
        and row["family"] == family
        and not row["sentinel"]
        and row["initial"]["kind"] == "initial"
        and row["initial"]["scored"]
    ]


def summarize_calibration(runs: list[dict[str, Any]], protocol_sha256: str | None = None) -> dict[str, Any]:
    if {run.get("provider") for run in runs} != set(PROVIDERS):
        raise ValueError("Calibration needs one run from every provider")
    expected_protocol = protocol_sha256 or protocol_manifest()["sha256"]
    if any(run.get("protocol_sha256") != expected_protocol for run in runs):
        raise ValueError("Calibration runs do not share the frozen protocol")
    provider_rows = []
    eligible_counts = {family: 0 for family in core.DECISION_FAMILIES}
    incomplete = False
    for run in sorted(runs, key=lambda value: value["provider"]):
        rates = []
        for family in core.TASK_FAMILIES:
            for arm in core.ARMS:
                rows = denominator_rows(run["results"], arm, family)
                passed = sum(bool(row["initial"]["score"]["primary_pass"]) for row in rows)
                rates.append({"family": family, "arm": arm, "passed": passed, "denominator": len(rows), "rate": passed / len(rows) if rows else None})
                expected = len(core.make_corpus("calibration")["fixtures"][family])
                incomplete |= len(rows) != expected
                if arm == "exact-object-json" and family in core.DECISION_FAMILIES and len(rows) == expected:
                    rate = passed / len(rows)
                    if ELIGIBILITY_BAND["minimum"] <= rate <= ELIGIBILITY_BAND["maximum"]:
                        eligible_counts[family] += 1
        repairs = [row["repair"] for row in run["results"] if row.get("repair") is not None]
        provider_rows.append(
            {
                "provider": run["provider"],
                "rates": rates,
                "initial_unavailable": sum(row["initial"]["kind"] == "unavailable" for row in run["results"]),
                "initial_failed": sum(row["initial"]["kind"] == "failed" for row in run["results"]),
                "repair_scored": sum(row["kind"] == "repaired" for row in repairs),
                "repair_recovered": sum(row["kind"] == "repaired" and row["score"]["primary_pass"] for row in repairs),
            }
        )
    family_eligibility = [
        {
            "family": family,
            "eligible_providers": eligible_counts[family],
            "eligible": eligible_counts[family] >= ELIGIBILITY_BAND["minimum_providers"],
        }
        for family in core.DECISION_FAMILIES
    ]
    decision = "proceed-development" if not incomplete and all(row["eligible"] for row in family_eligibility) else "repair-measurement"
    return {
        "schema": SCHEMA,
        "run_kind": "calibration-summary",
        "run_id": RUN_ID,
        "decision": decision,
        "format_selection": None,
        "providers": provider_rows,
        "family_eligibility": family_eligibility,
        "eligibility_band": ELIGIBILITY_BAND,
        "incomplete_initial_evidence": incomplete,
        "repair_policy": REPAIR_POLICY,
    }


def synthetic_runs(pattern: str) -> list[dict[str, Any]]:
    base_results = []
    counters: dict[tuple[str, str], int] = defaultdict(int)
    for job in core.jobs("calibration"):
        key = (job["arm"], job["family"])
        index = counters[key]
        counters[key] += 1
        passing = True
        if not job["sentinel"] and job["arm"] == "exact-object-json" and job["family"] in core.DECISION_FAMILIES:
            passing = index < (2 if pattern == "informative" else 5)
        score = {"syntax_pass": True, "primary_pass": passing, "musical_pass": passing, "checks": {}, "diagnostic": None if passing else {"class": "musical-contract", "failed_checks": ["synthetic"]}}
        base_results.append({**{name: job[name] for name in ("arm", "family", "variant", "sentinel")}, "initial": core.result_state("initial", score), "repair": None})
    protocol = "synthetic-protocol"
    return [{"provider": provider, "protocol_sha256": protocol, "results": deepcopy(base_results)} for provider in PROVIDERS]


def aggregation_screen() -> dict[str, Any]:
    informative = synthetic_runs("informative")
    floor = synthetic_runs("floor")
    informative_summary = summarize_calibration(informative, "synthetic-protocol")
    floor_summary = summarize_calibration(floor, "synthetic-protocol")
    state_case = synthetic_runs("informative")
    target = next(row for row in state_case[0]["results"] if row["arm"] == "compact-bar-v1" and row["family"] == "comprehension-analysis" and not row["sentinel"])
    target["initial"] = core.result_state("unavailable", reason="output-limit")
    target["repair"] = core.result_state("repaired", {"primary_pass": True})
    state_summary = summarize_calibration(state_case, "synthetic-protocol")
    openai = next(row for row in state_summary["providers"] if row["provider"] == "openai")
    rate = next(row for row in openai["rates"] if row["arm"] == "compact-bar-v1" and row["family"] == "comprehension-analysis")
    return {
        "informative_decision": informative_summary["decision"],
        "floor_decision": floor_summary["decision"],
        "unavailable_excluded": rate["denominator"] == 4,
        "repaired_excluded_from_initial": rate["passed"] == 4,
        "incomplete_detected": state_summary["incomplete_initial_evidence"],
        "pass": informative_summary["decision"] == "proceed-development" and floor_summary["decision"] == "repair-measurement" and rate["denominator"] == 4 and rate["passed"] == 4 and state_summary["decision"] == "repair-measurement",
    }


def deterministic_screen() -> dict[str, Any]:
    formats = format_screen()
    contracts = contract_screen()
    states = state_screen()
    cohorts = cohort_audit()
    aggregation = aggregation_screen()
    request_settings = transport_audit()
    format_bools = [value for name, value in formats.items() if isinstance(value, bool) and name not in {"size_gates_pass"}]
    cohort_pass = all(row["fixture_hash_overlap"] == 0 and row["semantic_hash_overlap"] == 0 for row in cohorts["pairwise"]) and all(value["historical_semantic_overlap"] == 0 for value in cohorts["cohorts"].values())
    state_pass = states["distinct"] and all(states["invalid_rejected"].values()) and states["repair_prompt_has_structured_diagnostic"]
    value = {
        "format_screen": formats,
        "contract_screen": contracts,
        "state_screen": states,
        "cohort_audit": cohorts,
        "aggregation_screen": aggregation,
        "transport_audit": request_settings,
        "all_checks_pass": all(format_bools) and formats["size_gates_pass"] and all(formats["round_trip"].values()) and all(formats["minimal_overlay_absence"].values()) and contracts["all_pass"] and state_pass and cohort_pass and aggregation["pass"] and request_settings["exact_match"],
    }
    value["sha256"] = core.digest(value)
    return value


def source_hashes() -> dict[str, str]:
    return {
        name: hashlib.sha256((PACKAGE_ROOT / name).read_bytes()).hexdigest()
        for name in ("core.py", "benchmark.py")
    }


def protocol_manifest() -> dict[str, Any]:
    corpus = core.make_corpus("calibration")
    jobs_value = core.jobs("calibration")
    unique = sum(not job["sentinel"] for job in jobs_value)
    sentinels = sum(job["sentinel"] for job in jobs_value)
    value = {
        "schema": SCHEMA,
        "run_id": RUN_ID,
        "arms": list(core.ARMS),
        "decision_families": list(core.DECISION_FAMILIES),
        "guard_families": list(core.GUARD_FAMILIES),
        "models": MODELS,
        "settings": SETTINGS,
        "temperature": "Provider default. The request does not set temperature.",
        "calibration_corpus_sha256": corpus["sha256"],
        "cohort_manifest_sha256": cohort_manifest()["sha256"],
        "implementation_sha256": source_hashes(),
        "calls": {
            "unique_initial_per_provider": unique,
            "named_sentinel_initial_per_provider": sentinels,
            "initial_per_provider": len(jobs_value),
            "maximum_repair_per_provider": len(jobs_value),
            "maximum_total_per_provider": len(jobs_value) * 2,
        },
        "eligibility_band": ELIGIBILITY_BAND,
        "stopping_rule": "Return proceed-development only when every decision family is inside the exact-object band on at least two providers and every unique initial result is scored. Otherwise return repair-measurement. Calibration cannot select a format.",
        "repair_policy": REPAIR_POLICY,
        "size_gates": SIZE_GATES,
        "result_states": ["initial", "repaired", "unavailable", "failed"],
        "privacy": "Generated MIT symbolic text only. Do not send live project, audio, or MIDI data.",
        "provider_retry": "Retry only rate-limit, transport, and provider-server failures. Do not replace a valid low-scoring response.",
        "credential_preflight": "Require every provider key before the first provider call.",
        "approval_boundary": "No provider call is approved until the operator approves the exact run-plan hash.",
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    per_provider = protocol["calls"]["maximum_total_per_provider"]
    costs = {
        provider: round(per_provider * EMPIRICAL_COST_BASIS["mean_call_cost_usd"][provider] * (1 + EMPIRICAL_COST_BASIS["contingency"]), 6)
        for provider in PROVIDERS
    }
    value = {
        "schema": SCHEMA,
        "run_kind": "calibration-plan",
        "run_id": RUN_ID,
        "protocol_sha256": protocol["sha256"],
        "cohort_manifest_sha256": protocol["cohort_manifest_sha256"],
        "models": MODELS,
        "settings": SETTINGS,
        "calls": protocol["calls"],
        "maximum_calls_all_providers": per_provider * len(PROVIDERS),
        "estimated_maximum_cost_usd": {**costs, "total": round(sum(costs.values()), 6)},
        "cost_basis": EMPIRICAL_COST_BASIS,
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
        "calibration_corpus_sha256": value["protocol"]["calibration_corpus_sha256"],
        "cohort_manifest_sha256": value["protocol"]["cohort_manifest_sha256"],
        "run_plan_sha256": value["run_plan"]["sha256"],
    }


def self_test() -> dict[str, Any]:
    screen = deterministic_screen()
    jobs_value = core.jobs("calibration")
    assert screen["all_checks_pass"]
    assert len(jobs_value) == 69
    assert sum(job["sentinel"] for job in jobs_value) == 9
    assert run_plan()["maximum_calls_all_providers"] == 414
    return {
        "schema": SCHEMA,
        "pass": True,
        "checks": len(screen["contract_screen"]["positive"])
        + len(screen["contract_screen"]["negative"])
        + len(screen["contract_screen"]["mutations"])
        + len(screen["contract_screen"]["grammar_forms"])
        + 32,
        "calibration_corpus_sha256": core.make_corpus("calibration")["sha256"],
        "deterministic_sha256": deterministic_package()["sha256"],
    }


def request_spec(provider: str, key: str, prompt: str) -> dict[str, Any]:
    messages = [{"role": "user", "content": prompt}]
    if provider == "openai":
        return {
            "url": "https://api.openai.com/v1/chat/completions",
            "headers": {"Authorization": f"Bearer {key}"},
            "payload": {
                "model": MODELS[provider],
                "messages": messages,
                "response_format": {"type": "json_schema", "json_schema": {"name": "benchmark_payload", "strict": True, "schema": OUTER_SCHEMA}},
                **SETTINGS[provider],
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
                    "responseJsonSchema": OUTER_SCHEMA,
                    "maxOutputTokens": SETTINGS[provider]["max_output_tokens"],
                    "thinkingConfig": {"thinkingLevel": SETTINGS[provider]["thinking_level"]},
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
            "output_config": {"effort": SETTINGS[provider]["effort"], "format": {"type": "json_schema", "schema": OUTER_SCHEMA}},
        },
    }


def transport_audit() -> dict[str, Any]:
    actual = {}
    for provider in PROVIDERS:
        payload = request_spec(provider, "redacted", "probe")["payload"]
        if provider == "openai":
            actual[provider] = {
                "reasoning_effort": payload["reasoning_effort"],
                "max_completion_tokens": payload["max_completion_tokens"],
            }
        elif provider == "gemini":
            config = payload["generationConfig"]
            actual[provider] = {
                "thinking_level": config["thinkingConfig"]["thinkingLevel"],
                "max_output_tokens": config["maxOutputTokens"],
            }
        else:
            actual[provider] = {
                "effort": payload["output_config"]["effort"],
                "max_tokens": payload["max_tokens"],
            }
    declared = {provider: SETTINGS[provider] for provider in PROVIDERS}
    return {"declared": declared, "request_builder": actual, "exact_match": actual == declared}


def model_call(provider: str, key: str, prompt: str) -> tuple[dict[str, Any], dict[str, Any]]:
    spec = request_spec(provider, key, prompt)
    raw = transport.post_json(spec["url"], spec["headers"], spec["payload"])
    if provider == "openai":
        text = raw["choices"][0]["message"]["content"]
    elif provider == "gemini":
        text = "".join(part.get("text", "") for part in raw["candidates"][0]["content"]["parts"])
    else:
        text = "".join(block.get("text", "") for block in raw["content"] if block.get("type") == "text")
    return transport.parse_outer(text), raw


def call_with_retry(provider: str, key: str, prompt: str) -> tuple[dict[str, Any], dict[str, Any], float, int]:
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


def output_limit_stop(provider: str, reason: str | None) -> bool:
    return reason in ({"length"} if provider == "openai" else {"MAX_TOKENS"} if provider == "gemini" else {"max_tokens"})


def one_call(provider: str, key: str, prompt: str, task: dict[str, Any], arm: str, kind: str) -> tuple[dict[str, Any], dict[str, Any]]:
    outer, raw, latency_ms, retries = call_with_retry(provider, key, prompt)
    measured = transport.usage(provider, raw)
    reason = transport.stop_reason(provider, raw)
    call = {
        "prompt_sha256": core.sha256_text(prompt),
        "prompt_bytes": len(prompt.encode()),
        "usage": measured,
        "cost_usd": transport.cost_usd(provider, measured),
        "latency_ms": round(latency_ms, 3),
        "retries": retries,
        "returned_model": transport.returned_model(provider, raw),
        "request_id": raw.get("id"),
        "stop_reason": reason,
        "raw_response_sha256": core.digest(raw),
    }
    if output_limit_stop(provider, reason):
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


def call_job(provider: str, key: str, job: dict[str, Any]) -> dict[str, Any]:
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
        initial, initial_call = one_call(provider, key, prompt, job["task"], job["arm"], "initial")
    except Exception as error:
        return {**common, "initial": core.result_state("failed", reason=f"{type(error).__name__}: {error}"), "initial_call": None, "repair": None, "repair_call": None}
    repair = None
    repair_call = None
    if initial["kind"] == "initial" and not initial["score"]["primary_pass"]:
        diagnostic = initial["score"]["diagnostic"]
        try:
            repair, repair_call = one_call(provider, key, core.repair_prompt(prompt, diagnostic), job["task"], job["arm"], "repaired")
        except Exception as error:
            repair = core.result_state("failed", reason=f"{type(error).__name__}: {error}")
    return {**common, "initial": initial, "initial_call": initial_call, "repair": repair, "repair_call": repair_call}


def execute_jobs(provider: str, key: str, workers: int) -> list[dict[str, Any]]:
    ordered = core.jobs("calibration")
    random.Random(8401).shuffle(ordered)
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(call_job, provider, key, job) for job in ordered]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            results.append(future.result())
            if index % 12 == 0:
                print(f"{provider}: completed {index}/{len(futures)} initial jobs", file=sys.stderr, flush=True)
    return sorted(results, key=lambda row: (row["arm"], row["family"], row["variant"], row["sentinel"]))


def validate_approval(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    plan = run_plan()
    if value.get("run_id") != RUN_ID or value.get("protocol_sha256") != plan["protocol_sha256"] or value.get("run_plan_sha256") != plan["sha256"]:
        raise ValueError("Approval does not match the frozen Phase 8c4b plan")
    if value.get("status") != "approved" or not isinstance(value.get("operator_statement"), str) or not value["operator_statement"].strip():
        raise ValueError("Approval needs an explicit operator statement")
    return value


def run_provider(provider: str, env_file: Path, approval_file: Path, workers: int) -> dict[str, Any]:
    approval = validate_approval(approval_file)
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise ValueError("The deterministic screen failed")
    environment = transport.load_env(env_file)
    missing = [name for name in KEYS.values() if not environment.get(name)]
    if missing:
        raise ValueError("Provider credential preflight failed: " + ", ".join(missing))
    key = environment.get(KEYS[provider])
    results = execute_jobs(provider, key, workers)
    calls = [row.get("initial_call") for row in results] + [row.get("repair_call") for row in results]
    actual_calls = [value for value in calls if value is not None]
    value = {
        "schema": SCHEMA,
        "run_kind": "calibration-provider",
        "run_id": RUN_ID,
        "provider": provider,
        "requested_model": MODELS[provider],
        "settings": SETTINGS[provider],
        "client": "Python urllib.request direct HTTPS",
        "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        "python": platform.python_version(),
        "privacy": protocol_manifest()["privacy"],
        "protocol_sha256": protocol_manifest()["sha256"],
        "screen_sha256": screen["sha256"],
        "run_plan_sha256": run_plan()["sha256"],
        "approval": approval,
        "results": results,
        "actual_calls": len(actual_calls),
        "actual_cost_usd": round(sum(item["cost_usd"]["total"] for item in actual_calls), 6),
        "complete": len(results) == 69,
    }
    value["raw_run_sha256"] = core.digest([item["raw_response_sha256"] for item in actual_calls])
    value["manifest_sha256"] = core.digest(value)
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
    actions.add_argument("--cohorts", action="store_true")
    actions.add_argument("--check", type=Path)
    actions.add_argument("--run-plan", action="store_true")
    actions.add_argument("--provider", choices=PROVIDERS)
    actions.add_argument("--summarize", nargs=3, type=Path)
    parser.add_argument("--env-file", type=Path, default=Path("../.env"))
    parser.add_argument("--approval-file", type=Path, default=APPROVAL_PATH)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--output", type=Path)
    arguments = parser.parse_args()
    if arguments.self_test:
        write_result(self_test(), arguments.output)
    elif arguments.deterministic:
        write_result(deterministic_package(), arguments.output)
    elif arguments.cohorts:
        write_result(cohort_manifest(), arguments.output)
    elif arguments.run_plan:
        write_result(run_plan(), arguments.output)
    elif arguments.check:
        expected = json.loads(arguments.check.read_text())
        actual = deterministic_manifest(deterministic_package())
        if actual != expected:
            raise SystemExit("The deterministic package does not match the frozen manifest")
        print(json.dumps(actual, indent=2, sort_keys=True))
    elif arguments.provider:
        write_result(run_provider(arguments.provider, arguments.env_file, arguments.approval_file, arguments.workers), arguments.output)
    else:
        runs = [json.loads(path.read_text()) for path in arguments.summarize]
        value = summarize_calibration(runs)
        value["sha256"] = core.digest(value)
        write_result(value, arguments.output)


if __name__ == "__main__":
    main()
