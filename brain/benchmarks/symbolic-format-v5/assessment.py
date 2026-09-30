#!/usr/bin/env python3
"""Assess retained eight-arm matrix runs without changing frozen scores."""

from __future__ import annotations

import argparse
import importlib.util
import json
from collections import defaultdict
from copy import deepcopy
from decimal import Decimal
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARK_PATH = PACKAGE_ROOT / "benchmark.py"


def load_benchmark() -> Any:
    spec = importlib.util.spec_from_file_location(
        "ghostnote_symbolic_format_v5_assessment", BENCHMARK_PATH
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
        "response_component_accuracy": safe_rate(
            response_correct, response_planned
        ),
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


def available_rows(run: dict[str, Any]) -> list[dict[str, Any]]:
    return [row for row in run["results"] if m.v14.row_score(row) is not None]


def select_samples(
    runs: list[dict[str, Any]], jobs_by_provider: dict[str, dict[int, dict[str, Any]]]
) -> list[dict[str, Any]]:
    samples = []
    for provider_index, run in enumerate(runs):
        rows = available_rows(run)
        for arm_index, arm in enumerate(m.ARMS):
            family_index = (provider_index * len(m.ARMS) + arm_index) % len(
                m.FAMILIES
            )
            family_order = m.FAMILIES[family_index:] + m.FAMILIES[:family_index]
            choices = [
                row
                for family in family_order
                for row in rows
                if row["arm"] == arm
                and row["family"] == family
                and row["repeat"] == 1
            ]
            if not choices:
                continue
            row = choices[0]
            job = jobs_by_provider[run["provider"]][row["planned_sequence"]]
            call = row["initial_call"]
            score = row["initial"]["score"]
            parsed = None
            if row["family"] != "comprehension-analysis":
                parsed = m.formats.get(row["arm"]).parse_payload(
                    call["response_payload"]
                )
            samples.append(
                {
                    "provider": run["provider"],
                    "arm": arm,
                    "family": row["family"],
                    "planned_sequence": row["planned_sequence"],
                    "variant": row["variant"],
                    "task_sha256": row["task_sha256"],
                    "prompt_sha256": call["prompt_sha256"],
                    "response_payload_sha256": call["response_payload_sha256"],
                    "ledger_recovered": None if parsed is None else bool(parsed.notes),
                    "notation_alignment": None if parsed is None else parsed.alignment,
                    "component": score["component"],
                    "structural_parse_pass": score["structural_parse_pass"],
                    "canonical_form_pass": score["canonical_form_pass"],
                }
            )
    return samples


def assess(paths: list[Path]) -> dict[str, Any]:
    runs = [m.v15.load_manifest(path) for path in paths]
    if {run["provider"] for run in runs} != set(m.PROVIDERS):
        raise ValueError("Assessment needs one retained run for each provider")
    runs.sort(key=lambda run: m.PROVIDERS.index(run["provider"]))
    jobs_by_provider = {
        provider: {
            job["planned_sequence"]: job for job in m.jobs(provider)
        }
        for provider in m.PROVIDERS
    }
    groups: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    prompt_identity = True
    task_identity = True
    candidate_identity = True
    scores_reproduce = True
    ledgers_recovered = 0
    non_analysis = 0
    sentinel_pairs = 0
    sentinel_component_matches = 0
    sentinel_payload_matches = 0

    for run in runs:
        provider = run["provider"]
        jobs = jobs_by_provider[provider]
        rows = available_rows(run)
        for row in rows:
            job = jobs[row["planned_sequence"]]
            call = row["initial_call"]
            prompt = m.engine.prompt_for(job)
            score = row["initial"]["score"]
            prompt_identity &= (
                call["prompt_sha256"] == m.core.sha256_text(prompt)
                and call["prompt_bytes"] == len(prompt.encode())
            )
            task_identity &= row["task_sha256"] == job["task"]["sha256"]
            candidate_identity &= (
                row["candidate_sha256"]
                == m.engine.candidate_hashes()[row["arm"]]
            )
            reproduced = m.engine.score_response(
                row["arm"], job["task"], call["response_payload"]
            )
            scores_reproduce &= reproduced == score
            repeat_group = "BASE" if row["repeat"] == 1 else "SENTINEL"
            for key in (
                (provider, "ALL", "ALL"),
                (provider, "ALL", repeat_group),
                (provider, row["arm"], "ALL"),
                (provider, row["arm"], repeat_group),
                (provider, row["arm"], row["family"]),
            ):
                groups[key].append(score)
            if row["family"] != "comprehension-analysis":
                non_analysis += 1
                parsed = m.formats.get(row["arm"]).parse_payload(
                    call["response_payload"]
                )
                ledgers_recovered += int(bool(parsed.notes))

        keyed: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
        for row in rows:
            keyed[(row["arm"], row["family"], row["task_sha256"])].append(row)
        for pair in keyed.values():
            if len(pair) != 2 or {row["repeat"] for row in pair} != {1, 2}:
                continue
            sentinel_pairs += 1
            pair.sort(key=lambda row: row["repeat"])
            sentinel_component_matches += int(
                pair[0]["initial"]["score"]["component"]
                == pair[1]["initial"]["score"]["component"]
            )
            sentinel_payload_matches += int(
                pair[0]["initial_call"]["response_payload_sha256"]
                == pair[1]["initial_call"]["response_payload_sha256"]
            )

    aggregates = {
        provider: {
            "ALL": metric_summary(groups[(provider, "ALL", "ALL")]),
            "base_tasks": metric_summary(groups[(provider, "ALL", "BASE")]),
            "sentinel_repeats": metric_summary(
                groups[(provider, "ALL", "SENTINEL")]
            ),
            "arms": {
                arm: {
                    "ALL": metric_summary(groups[(provider, arm, "ALL")]),
                    "base_tasks": metric_summary(
                        groups[(provider, arm, "BASE")]
                    ),
                    "sentinel_repeats": metric_summary(
                        groups[(provider, arm, "SENTINEL")]
                    ),
                    "families": {
                        family: metric_summary(groups[(provider, arm, family)])
                        for family in m.FAMILIES
                    },
                }
                for arm in m.ARMS
            },
        }
        for provider in m.PROVIDERS
    }
    samples = select_samples(runs, jobs_by_provider)
    checks = {
        "retained-manifests-valid": True,
        "all-prompt-hashes-and-bytes-match": prompt_identity,
        "all-task-hashes-match": task_identity,
        "all-candidate-hashes-match": candidate_identity,
        "all-frozen-scores-reproduce": scores_reproduce,
        "sample-covers-every-provider": {
            sample["provider"] for sample in samples
        }
        == set(m.PROVIDERS),
        "sample-covers-every-format": {sample["arm"] for sample in samples}
        == set(m.ARMS),
        "sample-covers-every-family": {
            sample["family"] for sample in samples
        }
        == set(m.FAMILIES),
    }
    actual_cost = sum(
        Decimal(str(run["actual_cost_exact_usd"])) for run in runs
    )
    value = {
        "schema": "ghostnote-symbolic-format-v5-assessment-v1",
        "run_id": m.RUN_ID,
        "protocol_sha256": m.protocol_manifest()["sha256"],
        "run_plan_sha256": m.run_plan()["sha256"],
        "run_manifest_sha256": {
            run["provider"]: run["manifest_sha256"] for run in runs
        },
        "progress": {run["provider"]: run["progress"] for run in runs},
        "complete": {run["provider"]: run["complete"] for run in runs},
        "actual_cost_exact_usd": float(actual_cost),
        "policy": {
            "primary": "musical component accuracy on available responses",
            "missing_rows": "exclude from musical denominators",
            "response_components": "secondary",
            "structural_alignment_and_canonical": "diagnostics",
            "provider_pooling": "do not pool before provider results",
            "rerun": False,
        },
        "stops": {
            "openai": None,
            "gemini": {
                "kind": "transport-failure",
                "planned_sequence": 564,
                "reason": "HTTP 503 Service Unavailable",
            },
            "claude-haiku": {
                "kind": "unavailable-stop",
                "planned_sequence": 138,
                "unavailable_responses": 3,
                "reason": "output-limit",
            },
        },
        "design_finding": (
            "The inherited runner stops after three unavailable responses. The "
            "v5 written stopping rule omitted this active rule. Retain available "
            "rows, do not treat missing rows as failures, and require a separate "
            "approved continuation before more calls."
        ),
        "aggregates": aggregates,
        "sentinels": {
            "available_pairs": sentinel_pairs,
            "component_matches": sentinel_component_matches,
            "component_match_rate": safe_rate(
                sentinel_component_matches, sentinel_pairs
            ),
            "exact_payload_matches": sentinel_payload_matches,
            "exact_payload_match_rate": safe_rate(
                sentinel_payload_matches, sentinel_pairs
            ),
        },
        "ledger_recovery": {
            "recovered": ledgers_recovered,
            "available_non_analysis": non_analysis,
            "rate": safe_rate(ledgers_recovered, non_analysis),
            "role": "model outcome, not an experiment-validity check",
        },
        "manual_sample": samples,
        "checks": checks,
        "all_retained_rows_valid": all(checks.values()),
        "interpretation": (
            "OpenAI is a complete balanced matrix. Gemini is a late balanced "
            "partial matrix. Claude is an early partial matrix. Keep provider "
            "coverage explicit in every comparison."
        ),
    }
    unsigned = deepcopy(value)
    value["sha256"] = m.core.digest(unsigned)
    return value


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("runs", nargs=3, type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    value = assess(args.runs)
    if not value["all_retained_rows_valid"]:
        raise SystemExit(json.dumps(value, indent=2, sort_keys=True))
    text = json.dumps(value, indent=2, sort_keys=True) + "\n"
    if args.output is None:
        print(text, end="")
        return
    if args.output.exists():
        raise FileExistsError(f"Refusing to replace: {args.output}")
    args.output.write_text(text)


if __name__ == "__main__":
    main()
