#!/usr/bin/env python3
"""Run the Phase 8c4b targeted analysis-repair calibration."""

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
    "ghostnote_compact_format_v6_transport",
    BENCHMARKS_ROOT / "compact-format-v2" / "benchmark.py",
)

SCHEMA = "ghostnote-compact-format-calibration-v6"
RUN_ID = "phase8c4b-analysis-repair-calibration-r3"
PROVIDERS = ("gemini", "claude")
TIERS = ("calibration-easy", "calibration-medium", "calibration-hard")
MODELS = {
    "gemini": "gemini-3.8-flash",
    "claude": "claude-sonnet-5",
}
KEYS = {
    "gemini": "GEMINI_API_KEY",
    "claude": "ANTHROPIC_API_KEY",
}
SETTINGS = {
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
    "source": "The maximum observed call cost from Phase 8c4b calibration r2.",
    "method": "Multiply the maximum observed call cost by the gated call limit and add 25 percent.",
    "price_verification_date": "2026-09-28",
    "maximum_observed_call_cost_usd": {
        "gemini": 0.00599025,
        "claude": 0.057858,
    },
    "contingency": 0.25,
}
HISTORICAL_PACKAGES = (
    "symbolic-format-v1",
    "compact-format-v2",
    "compact-format-v3",
    "compact-format-v4",
    "compact-format-v5",
    "compact-json-v1",
    "symbolic-format-v2",
)
APPROVAL_PATH = PACKAGE_ROOT / "runs" / "calibration-r3-approval.json"


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
    corpora = {name: core.make_corpus(name) for name in TIERS}
    full = {
        name: {task["sha256"] for values in corpus["fixtures"].values() for task in values}
        for name, corpus in corpora.items()
    }
    semantic = {
        name: {task["semantic_sha256"] for values in corpus["fixtures"].values() for task in values}
        for name, corpus in corpora.items()
    }
    analysis_cases = {
        name: {
            case_hash
            for task in corpus["fixtures"]["comprehension-analysis"]
            for case_hash in task["case_semantic_sha256"]
        }
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
                    "analysis_case_hash_overlap": len(analysis_cases[left] & analysis_cases[right]),
                }
            )
    return {
        "cohorts": {
            name: {
                "corpus_sha256": corpus["sha256"],
                "fixture_count": sum(len(values) for values in corpus["fixtures"].values()),
                "fixture_sha256": sorted(full[name]),
                "semantic_sha256": sorted(semantic[name]),
                "analysis_case_sha256": sorted(analysis_cases[name]),
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
    structure_task = core.make_corpus("validation")["fixtures"]["comprehension-structure"][0]
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
    corpus = core.make_corpus("validation")
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
        "analysis_inversion_numbering_defined": "inversions use 0" in core.analysis_instruction(corpus["fixtures"]["comprehension-analysis"][0]),
        "analysis_batch_fields": all(
            set(task["expected"]) == set(core.ANALYSIS_FIELDS)
            and all(len(task["expected"][name]) == task["contract"]["case_count"] for name in core.ANALYSIS_FIELDS)
            for task in corpus["fixtures"]["comprehension-analysis"]
        ),
        "analysis_fixture_formulas": all(
            all(core.analysis_fixture_checks(task).values())
            for tier in TIERS
            for task in core.make_corpus(tier)["fixtures"]["comprehension-analysis"]
        ),
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
    eligible = complete and rate is not None and ELIGIBILITY_BAND["minimum"] <= rate <= ELIGIBILITY_BAND["maximum"]
    return {
        "tier": run.get("tier"),
        "passed": passed,
        "denominator": len(scored),
        "rate": rate,
        "complete": complete,
        "eligible": eligible,
        "ceiling": complete and rate is not None and rate > ELIGIBILITY_BAND["maximum"],
        "floor": complete and rate is not None and rate < ELIGIBILITY_BAND["minimum"],
    }


def validate_gemini_sequence_values(tier: str, prior: list[dict[str, Any]]) -> list[dict[str, Any]]:
    expected_tiers = list(TIERS[: TIERS.index(tier)])
    if [value.get("tier") for value in prior] != expected_tiers or any(value.get("provider") != "gemini" for value in prior):
        raise ValueError("Gemini prior manifests do not match the required tier order")
    if any(not analysis_gate(value)["ceiling"] for value in prior):
        raise ValueError("A later Gemini tier requires a complete ceiling on every earlier tier")
    return prior


def validate_claude_gate_value(tier: str, value: dict[str, Any]) -> dict[str, Any]:
    if value.get("provider") != "gemini" or value.get("tier") != tier or not analysis_gate(value)["eligible"]:
        raise ValueError("Claude requires an eligible Gemini result on the same tier")
    return value


def summarize_calibration(runs: list[dict[str, Any]], protocol_sha256: str | None = None) -> dict[str, Any]:
    if {run.get("provider") for run in runs} != set(PROVIDERS):
        raise ValueError("Analysis repair needs one Gemini run and one Claude run")
    expected_protocol = protocol_sha256 or protocol_manifest()["sha256"]
    if any(run.get("protocol_sha256") != expected_protocol for run in runs):
        raise ValueError("Analysis-repair runs do not share the frozen protocol")
    tiers = {run.get("tier") for run in runs}
    if len(tiers) != 1 or next(iter(tiers)) not in TIERS:
        raise ValueError("Analysis-repair runs need one frozen tier")
    gates = {run["provider"]: analysis_gate(run) for run in runs}
    if not gates["gemini"]["eligible"]:
        raise ValueError("Claude cannot enter a summary when Gemini missed the tier gate")
    decision = "analysis-repair-pass" if gates["claude"]["eligible"] else "repair-measurement"
    return {
        "schema": SCHEMA,
        "run_kind": "analysis-repair-summary",
        "run_id": RUN_ID,
        "decision": decision,
        "format_selection": None,
        "tier": next(iter(tiers)),
        "provider_gates": gates,
        "eligibility_band": ELIGIBILITY_BAND,
        "repair_policy": REPAIR_POLICY,
        "r2_dependency": "Use the retained r2 motif and progression eligibility only when analysis-repair-pass.",
    }


def synthetic_run(provider: str, passed: int, tier: str = "calibration-medium", unavailable: int = 0) -> dict[str, Any]:
    base_results = []
    unique_index = 0
    for job in core.jobs(tier):
        passing = unique_index < passed
        score = {"syntax_pass": True, "primary_pass": passing, "musical_pass": passing, "checks": {}, "diagnostic": None if passing else {"class": "musical-contract", "failed_checks": ["synthetic"]}}
        state = core.result_state("initial", score)
        if not job["sentinel"] and unique_index >= 5 - unavailable:
            state = core.result_state("unavailable", reason="output-limit")
        base_results.append({**{name: job[name] for name in ("arm", "family", "variant", "sentinel")}, "initial": state, "repair": None})
        unique_index += not job["sentinel"]
    return {"provider": provider, "tier": tier, "protocol_sha256": "synthetic-protocol", "results": base_results}


def aggregation_screen() -> dict[str, Any]:
    gemini = synthetic_run("gemini", 2)
    claude = synthetic_run("claude", 4)
    passing = summarize_calibration([gemini, claude], "synthetic-protocol")
    easy_ceiling = synthetic_run("gemini", 5, "calibration-easy")
    medium_ceiling = synthetic_run("gemini", 5, "calibration-medium")
    ceiling = analysis_gate(easy_ceiling)
    floor = analysis_gate(synthetic_run("gemini", 0))
    incomplete = analysis_gate(synthetic_run("gemini", 2, unavailable=1))
    sequence = {
        "easy_without_prior": validate_gemini_sequence_values("calibration-easy", []) == [],
        "medium_after_easy_ceiling": validate_gemini_sequence_values("calibration-medium", [easy_ceiling]) == [easy_ceiling],
        "hard_after_two_ceilings": validate_gemini_sequence_values("calibration-hard", [easy_ceiling, medium_ceiling]) == [easy_ceiling, medium_ceiling],
        "medium_without_easy_rejected": expect_rejected(lambda: validate_gemini_sequence_values("calibration-medium", [])),
        "later_tier_after_eligible_rejected": expect_rejected(
            lambda: validate_gemini_sequence_values("calibration-medium", [synthetic_run("gemini", 2, "calibration-easy")])
        ),
        "claude_after_eligible_gemini": validate_claude_gate_value("calibration-medium", gemini) == gemini,
        "claude_after_ceiling_rejected": expect_rejected(
            lambda: validate_claude_gate_value("calibration-easy", easy_ceiling)
        ),
        "claude_on_other_tier_rejected": expect_rejected(
            lambda: validate_claude_gate_value("calibration-easy", gemini)
        ),
    }
    return {
        "passing_decision": passing["decision"],
        "gemini_ceiling_detected": ceiling["ceiling"] and not ceiling["eligible"],
        "gemini_floor_detected": floor["floor"] and not floor["eligible"],
        "incomplete_detected": not incomplete["complete"] and not incomplete["eligible"],
        "sequential_gate": sequence,
        "pass": passing["decision"] == "analysis-repair-pass" and ceiling["ceiling"] and floor["floor"] and not incomplete["complete"] and all(sequence.values()),
    }


def deterministic_screen() -> dict[str, Any]:
    formats = format_screen()
    contracts = contract_screen()
    states = state_screen()
    cohorts = cohort_audit()
    aggregation = aggregation_screen()
    request_settings = transport_audit()
    format_bools = [value for name, value in formats.items() if isinstance(value, bool) and name not in {"size_gates_pass"}]
    cohort_pass = all(
        row["fixture_hash_overlap"] == 0
        and row["semantic_hash_overlap"] == 0
        and row["analysis_case_hash_overlap"] == 0
        for row in cohorts["pairwise"]
    ) and all(value["historical_semantic_overlap"] == 0 for value in cohorts["cohorts"].values())
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
    tier_corpora = {tier: core.make_corpus(tier) for tier in TIERS}
    jobs_value = core.jobs(TIERS[0])
    unique = sum(not job["sentinel"] for job in jobs_value)
    sentinels = sum(job["sentinel"] for job in jobs_value)
    tier_hashes = {tier: corpus["sha256"] for tier, corpus in tier_corpora.items()}
    value = {
        "schema": SCHEMA,
        "run_id": RUN_ID,
        "arms": ["exact-object-json"],
        "decision_families": ["comprehension-analysis"],
        "models": MODELS,
        "settings": SETTINGS,
        "temperature": "Provider default. The request does not set temperature.",
        "calibration_corpus_sha256": core.digest(tier_hashes),
        "tier_corpus_sha256": tier_hashes,
        "cohort_manifest_sha256": cohort_manifest()["sha256"],
        "implementation_sha256": source_hashes(),
        "calls": {
            "unique_initial_per_run": unique,
            "named_sentinel_initial_per_run": sentinels,
            "initial_per_run": len(jobs_value),
            "maximum_repair_per_run": len(jobs_value),
            "maximum_total_per_run": len(jobs_value) * 2,
            "maximum_gemini_tiers": len(TIERS),
            "maximum_gemini_calls": len(jobs_value) * 2 * len(TIERS),
            "maximum_claude_runs": 1,
            "maximum_claude_calls": len(jobs_value) * 2,
            "maximum_total_calls": len(jobs_value) * 2 * (len(TIERS) + 1),
        },
        "eligibility_band": ELIGIBILITY_BAND,
        "tier_order": list(TIERS),
        "sequential_gate": "Run Gemini easy first. Run the next Gemini tier only after a complete ceiling above 0.80. Stop after a Gemini floor, incomplete result, or eligible tier. Run Claude only once, on the first Gemini tier inside 0.20 through 0.80.",
        "stopping_rule": "Return analysis-repair-pass only when Gemini and Claude are both complete and inside 0.20 through 0.80 on the same first eligible Gemini tier. Otherwise return repair-measurement. This targeted run cannot select a format.",
        "repair_policy": REPAIR_POLICY,
        "size_gates": SIZE_GATES,
        "result_states": ["initial", "repaired", "unavailable", "failed"],
        "privacy": "Generated MIT symbolic text only. Do not send live project, audio, or MIDI data.",
        "provider_retry": "Retry only rate-limit, transport, and provider-server failures. Do not replace a valid low-scoring response.",
        "credential_preflight": "Require every provider key before the first provider call.",
        "r2_dependency": {
            "summary_sha256": "e2b293e9e05c62d58e9c22748d5cdad0d38bfcd5ec456347c7a0f01a3a030017",
            "retained_eligibility": {"continuation-motif": 2, "generation-progression": 3},
            "rule": "Preserve the frozen r2 motif and progression evidence. Replace only analysis calibration evidence.",
        },
        "approval_boundary": "No provider call is approved until the operator approves the exact run-plan hash.",
    }
    value["sha256"] = core.digest(value)
    return value


def run_plan() -> dict[str, Any]:
    protocol = protocol_manifest()
    call_limits = {
        "gemini": protocol["calls"]["maximum_gemini_calls"],
        "claude": protocol["calls"]["maximum_claude_calls"],
    }
    costs = {
        provider: round(call_limits[provider] * EMPIRICAL_COST_BASIS["maximum_observed_call_cost_usd"][provider] * (1 + EMPIRICAL_COST_BASIS["contingency"]), 6)
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
        "maximum_calls_all_providers": protocol["calls"]["maximum_total_calls"],
        "estimated_maximum_cost_usd": {**costs, "total": round(sum(costs.values()), 6)},
        "cost_basis": EMPIRICAL_COST_BASIS,
        "eligibility_band": ELIGIBILITY_BAND,
        "stopping_rule": protocol["stopping_rule"],
        "sequential_gate": protocol["sequential_gate"],
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
    assert screen["all_checks_pass"]
    assert all(len(core.jobs(tier)) == 6 for tier in TIERS)
    assert all(sum(job["sentinel"] for job in core.jobs(tier)) == 1 for tier in TIERS)
    assert run_plan()["maximum_calls_all_providers"] == 48
    return {
        "schema": SCHEMA,
        "pass": True,
        "checks": len(screen["contract_screen"]["positive"])
        + len(screen["contract_screen"]["negative"])
        + len(screen["contract_screen"]["mutations"])
        + len(screen["contract_screen"]["grammar_forms"])
        + 32,
        "calibration_corpus_sha256": protocol_manifest()["calibration_corpus_sha256"],
        "deterministic_sha256": deterministic_package()["sha256"],
    }


def request_spec(provider: str, key: str, prompt: str) -> dict[str, Any]:
    messages = [{"role": "user", "content": prompt}]
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
        if provider == "gemini":
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
    if provider == "gemini":
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
    return reason in ({"MAX_TOKENS"} if provider == "gemini" else {"max_tokens"})


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


def execute_jobs(provider: str, key: str, tier: str, workers: int) -> list[dict[str, Any]]:
    ordered = core.jobs(tier)
    random.Random(8603 + TIERS.index(tier)).shuffle(ordered)
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(call_job, provider, key, job) for job in ordered]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            results.append(future.result())
            if index == len(futures):
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


def load_provider_manifest(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    claimed = value.get("manifest_sha256")
    unsigned = deepcopy(value)
    unsigned.pop("manifest_sha256", None)
    if not isinstance(claimed, str) or core.digest(unsigned) != claimed:
        raise ValueError(f"Provider manifest hash mismatch: {path}")
    if value.get("run_id") != RUN_ID or value.get("protocol_sha256") != protocol_manifest()["sha256"]:
        raise ValueError(f"Provider manifest protocol mismatch: {path}")
    return value


def validate_gemini_sequence(tier: str, prior_paths: list[Path]) -> list[dict[str, Any]]:
    prior = [load_provider_manifest(path) for path in prior_paths]
    return validate_gemini_sequence_values(tier, prior)


def validate_claude_gate(tier: str, path: Path | None) -> dict[str, Any]:
    if path is None:
        raise ValueError("Claude requires the eligible Gemini manifest for the same tier")
    value = load_provider_manifest(path)
    return validate_claude_gate_value(tier, value)


def run_provider(
    provider: str,
    tier: str,
    env_file: Path,
    approval_file: Path,
    workers: int,
    prior_gemini: list[Path],
    gemini_gate: Path | None,
) -> dict[str, Any]:
    approval = validate_approval(approval_file)
    screen = deterministic_screen()
    if not screen["all_checks_pass"]:
        raise ValueError("The deterministic screen failed")
    gate_evidence = (
        {"prior_gemini": [value["manifest_sha256"] for value in validate_gemini_sequence(tier, prior_gemini)]}
        if provider == "gemini"
        else {"gemini_gate": validate_claude_gate(tier, gemini_gate)["manifest_sha256"]}
    )
    environment = transport.load_env(env_file)
    missing = [name for name in KEYS.values() if not environment.get(name)]
    if missing:
        raise ValueError("Provider credential preflight failed: " + ", ".join(missing))
    key = environment.get(KEYS[provider])
    results = execute_jobs(provider, key, tier, workers)
    calls = [row.get("initial_call") for row in results] + [row.get("repair_call") for row in results]
    actual_calls = [value for value in calls if value is not None]
    value = {
        "schema": SCHEMA,
        "run_kind": "analysis-repair-provider",
        "run_id": RUN_ID,
        "provider": provider,
        "tier": tier,
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
        "gate_evidence": gate_evidence,
        "results": results,
        "actual_calls": len(actual_calls),
        "actual_cost_usd": round(sum(item["cost_usd"]["total"] for item in actual_calls), 6),
        "complete": len(results) == 6,
    }
    value["analysis_gate"] = analysis_gate(value)
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
    actions.add_argument("--summarize", nargs=2, type=Path)
    parser.add_argument("--tier", choices=TIERS)
    parser.add_argument("--prior-gemini", nargs="*", type=Path, default=[])
    parser.add_argument("--gemini-gate", type=Path)
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
        if arguments.tier is None:
            raise SystemExit("A provider run needs --tier")
        write_result(
            run_provider(
                arguments.provider,
                arguments.tier,
                arguments.env_file,
                arguments.approval_file,
                arguments.workers,
                arguments.prior_gemini,
                arguments.gemini_gate,
            ),
            arguments.output,
        )
    else:
        runs = [json.loads(path.read_text()) for path in arguments.summarize]
        value = summarize_calibration(runs)
        value["sha256"] = core.digest(value)
        write_result(value, arguments.output)


if __name__ == "__main__":
    main()
