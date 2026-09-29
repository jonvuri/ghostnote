#!/usr/bin/env python3
"""Assess the retained MusicXML and MIDI-like probe."""

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
        "ghostnote_symbolic_format_v4_assessment", BENCHMARK_PATH
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load benchmark: {BENCHMARK_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


m = load_benchmark()


def safe_rate(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator, 6) if denominator else None


def metric_summary(scores: list[dict[str, Any]]) -> dict[str, Any]:
    case_correct = sum(score["component"]["case_correct"] for score in scores)
    case_planned = sum(score["component"]["case_planned"] for score in scores)
    response_correct = sum(
        score["component"]["response_correct"] for score in scores
    )
    response_planned = sum(
        score["component"]["response_planned"] for score in scores
    )
    return {
        "prompts": len(scores),
        "musical_component_correct": case_correct,
        "musical_component_planned": case_planned,
        "musical_component_accuracy": safe_rate(case_correct, case_planned),
        "response_component_correct": response_correct,
        "response_component_planned": response_planned,
        "response_component_accuracy": safe_rate(response_correct, response_planned),
        "structural_passes": sum(score["structural_parse_pass"] for score in scores),
        "structural_rate": safe_rate(
            sum(score["structural_parse_pass"] for score in scores), len(scores)
        ),
        "canonical_passes": sum(score["canonical_form_pass"] for score in scores),
        "canonical_rate": safe_rate(
            sum(score["canonical_form_pass"] for score in scores), len(scores)
        ),
    }


def assess(path: Path) -> dict[str, Any]:
    run = m.v15.load_manifest(path)
    jobs = {job["planned_sequence"]: job for job in m.prior.jobs(run["provider"])}
    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    samples = []
    seen: set[tuple[str, str]] = set()
    prompt_identity = True
    task_identity = True
    candidate_identity = True
    scores_reproduce = True
    ledgers_recovered = 0
    non_analysis = 0
    for row in run["results"]:
        job = jobs[row["planned_sequence"]]
        call = row["initial_call"]
        prompt = m.prior.prompt_for(job)
        prompt_identity &= (
            call["prompt_sha256"] == m.core.sha256_text(prompt)
            and call["prompt_bytes"] == len(prompt.encode())
        )
        task_identity &= row["task_sha256"] == job["task"]["sha256"]
        candidate_identity &= (
            row["candidate_sha256"] == m.prior.candidate_hashes()[row["arm"]]
        )
        score = row["initial"]["score"]
        reproduced = m.prior.score_response(
            row["arm"], job["task"], call["response_payload"]
        )
        scores_reproduce &= reproduced == score
        groups[(row["arm"], "ALL")].append(score)
        groups[(row["arm"], row["family"])].append(score)
        ledger_recovered = True
        alignment = None
        if row["family"] != "comprehension-analysis":
            non_analysis += 1
            parsed = m.formats.get(row["arm"]).parse_payload(
                call["response_payload"]
            )
            ledger_recovered = bool(parsed.notes)
            alignment = parsed.alignment
            ledgers_recovered += int(ledger_recovered)
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
                    "notation_ledger_alignment": alignment,
                    "component": score["component"],
                    "structural_parse_pass": score["structural_parse_pass"],
                    "canonical_form_pass": score["canonical_form_pass"],
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
        "all-task-hashes-match": task_identity,
        "all-candidate-hashes-match": candidate_identity,
        "all-scores-reproduce": scores_reproduce,
        "all-non-analysis-ledgers-recovered": ledgers_recovered == non_analysis,
        "one-sample-per-family-format-cell": len(samples)
        == len(m.ARMS) * len(m.FAMILIES),
    }
    value = {
        "schema": "ghostnote-symbolic-format-v4-assessment-v1",
        "run_id": run["run_id"],
        "provider": run["provider"],
        "run_manifest_sha256": run["manifest_sha256"],
        "raw_run_sha256": run["raw_run_sha256"],
        "actual_cost_usd": run["actual_cost_usd"],
        "progress": run["progress"],
        "policy": {
            "primary": "musical components from shared output or side ledger",
            "public_notation_alignment": "response component and diagnostic",
            "structural_and_canonical": "diagnostics",
            "rerun": False,
        },
        "aggregates": aggregates,
        "sample_manifest": samples,
        "checks": checks,
        "all_checks_pass": all(checks.values()),
        "interpretation": (
            "Valid directional component probe. Use it to admit both adapters to "
            "the fresh full-matrix plan. Do not use two prompts per cell to select "
            "a format."
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
