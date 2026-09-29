#!/usr/bin/env python3
"""Assess a retained external-format probe without changing its frozen scores."""

from __future__ import annotations

import argparse
import importlib.util
import json
from collections import defaultdict
from copy import deepcopy
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARK_PATH = PACKAGE_ROOT / "benchmark.py"


def load_benchmark() -> Any:
    spec = importlib.util.spec_from_file_location(
        "ghostnote_symbolic_format_v3_assessment", BENCHMARK_PATH
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load benchmark: {BENCHMARK_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


m = load_benchmark()


def safe_rate(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator, 6) if denominator else None


def recover_ledger(payload: str) -> list[dict[str, Any]]:
    """Read the side ledger without accepting or rejecting the public notation."""

    if m.formats.SEPARATOR not in payload:
        return []
    _score, ledger = payload.split(m.formats.SEPARATOR, 1)
    try:
        return m.formats.legacy.parse_ledger(ledger)
    except (KeyError, TypeError, ValueError):
        return []


def assessed_score(
    row: dict[str, Any], task: dict[str, Any]
) -> tuple[dict[str, Any], bool]:
    payload = row["initial_call"]["response_payload"]
    if row["family"] == "comprehension-analysis":
        return m.v15.analysis_score(task, payload), False
    frozen_parse = m.formats.get(row["arm"]).parse_payload(payload)
    notes = recover_ledger(payload)
    parsed = m.formats.ParseResult(
        notes=notes,
        structural=frozen_parse.structural,
        canonical=frozen_parse.canonical,
        alignment=frozen_parse.alignment,
        error=frozen_parse.error,
    )
    if row["family"] in {
        "generation-progression",
        "generation-melody",
        "continuation-roles",
    }:
        score = m.constraint_score(task, parsed)
    elif row["family"] == "transformation-revoice":
        score = m.revoice_score(task, parsed)
    else:
        score = m.exact_score(task, parsed)
    return score, bool(notes)


def metric_summary(scores: list[dict[str, Any]]) -> dict[str, Any]:
    case_correct = sum(score["component"]["case_correct"] for score in scores)
    case_planned = sum(score["component"]["case_planned"] for score in scores)
    response_correct = sum(
        score["component"]["response_correct"] for score in scores
    )
    response_planned = sum(
        score["component"]["response_planned"] for score in scores
    )
    cases = [case for score in scores for case in score["cases"]]
    return {
        "prompts": len(scores),
        "musical_component_correct": case_correct,
        "musical_component_planned": case_planned,
        "musical_component_accuracy": safe_rate(case_correct, case_planned),
        "response_component_correct": response_correct,
        "response_component_planned": response_planned,
        "response_component_accuracy": safe_rate(response_correct, response_planned),
        "combined_component_accuracy": safe_rate(
            case_correct + response_correct,
            case_planned + response_planned,
        ),
        "perfect_cases": sum(case["perfect"] for case in cases),
        "case_count": len(cases),
        "structural_passes": sum(
            score["structural_parse_pass"] for score in scores
        ),
        "structural_rate": safe_rate(
            sum(score["structural_parse_pass"] for score in scores), len(scores)
        ),
        "canonical_passes": sum(score["canonical_form_pass"] for score in scores),
        "canonical_rate": safe_rate(
            sum(score["canonical_form_pass"] for score in scores), len(scores)
        ),
    }


def sample_judgment(
    row: dict[str, Any], score: dict[str, Any], ledger_recovered: bool
) -> str:
    if row["family"] == "comprehension-analysis":
        return "valid shared-output case; retain measured analysis errors"
    if not ledger_recovered:
        return "invalid sample; side ledger was not recoverable"
    if score["structural_parse_pass"]:
        return "valid composite case; public notation and ledger passed the pinned parser"
    return (
        "valid musical case with a recovered ledger; retain public-notation "
        "parse or alignment failure as a diagnostic"
    )


def assess(path: Path) -> dict[str, Any]:
    run = m.v15.load_manifest(path)
    jobs = {job["planned_sequence"]: job for job in m.jobs(run["provider"])}
    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    samples = []
    seen: set[tuple[str, str]] = set()
    prompt_identity = True
    ledgers_recovered = 0
    non_analysis = 0
    changed_scores = 0
    for row in run["results"]:
        job = jobs[row["planned_sequence"]]
        prompt = m.prompt_for(job)
        call = row["initial_call"]
        prompt_identity &= (
            call["prompt_sha256"] == m.core.sha256_text(prompt)
            and call["prompt_bytes"] == len(prompt.encode())
        )
        score, ledger_recovered = assessed_score(row, job["task"])
        if row["family"] != "comprehension-analysis":
            non_analysis += 1
            ledgers_recovered += int(ledger_recovered)
        frozen_score = m.v14.row_score(row)
        changed_scores += int(score["component"] != frozen_score["component"])
        groups[(row["arm"], "ALL")].append(score)
        groups[(row["arm"], row["family"])].append(score)
        key = (row["arm"], row["family"])
        if key not in seen:
            seen.add(key)
            samples.append(
                {
                    "arm": row["arm"],
                    "family": row["family"],
                    "planned_sequence": row["planned_sequence"],
                    "variant": row["variant"],
                    "task_sha256": row["task_sha256"],
                    "prompt_sha256": call["prompt_sha256"],
                    "response_payload_sha256": call["response_payload_sha256"],
                    "ledger_recovered": ledger_recovered,
                    "frozen_component": frozen_score["component"],
                    "assessed_component": score["component"],
                    "structural_parse_pass": score["structural_parse_pass"],
                    "canonical_form_pass": score["canonical_form_pass"],
                    "judgment": sample_judgment(row, score, ledger_recovered),
                }
            )
    aggregates = {
        arm: {
            family: metric_summary(groups[(arm, family)])
            for family in ("ALL", *m.FAMILIES)
        }
        for arm in m.ARMS
    }
    checks = {
        "retained-manifest-valid": True,
        "run-complete": run["complete"],
        "all-prompt-hashes-and-bytes-match": prompt_identity,
        "all-non-analysis-ledgers-recovered": ledgers_recovered == non_analysis,
        "one-sample-per-family-format-cell": len(samples)
        == len(m.ARMS) * len(m.FAMILIES),
        "sample-judgments-have-no-invalid-case": all(
            not sample["judgment"].startswith("invalid") for sample in samples
        ),
    }
    value = {
        "schema": "ghostnote-symbolic-format-v3-assessment-v1",
        "run_id": run["run_id"],
        "provider": run["provider"],
        "run_manifest_sha256": run["manifest_sha256"],
        "raw_run_sha256": run["raw_run_sha256"],
        "actual_cost_usd": run["actual_cost_usd"],
        "progress": run["progress"],
        "policy": {
            "primary": "musical components from the shared output or side ledger",
            "public_notation_alignment": "response component and diagnostic",
            "structural_and_canonical": "diagnostics",
            "frozen_scores": "preserved in the provider manifest",
            "rerun": False,
        },
        "repair": {
            "reason": (
                "The frozen composite parser discarded a valid side ledger when "
                "the public notation failed its pinned parse or alignment check."
            ),
            "method": (
                "Recover the side ledger independently for musical scoring. Keep "
                "the frozen public-notation parse, alignment, and canonical outcomes."
            ),
            "rows_with_changed_component_counts": changed_scores,
        },
        "aggregates": aggregates,
        "manual_sample_audit": samples,
        "checks": checks,
        "all_checks_pass": all(checks.values()),
        "interpretation": (
            "Valid directional component probe. The sample is too small for format "
            "selection. Do not use the narrow syntax diagnostics as general public-"
            "format conformance rates."
        ),
    }
    unsigned = deepcopy(value)
    value["sha256"] = m.core.digest(unsigned)
    return value


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("run", type=Path)
    args = parser.parse_args()
    value = assess(args.run)
    if not value["all_checks_pass"]:
        raise SystemExit(json.dumps(value, indent=2, sort_keys=True))
    print(json.dumps(value, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
