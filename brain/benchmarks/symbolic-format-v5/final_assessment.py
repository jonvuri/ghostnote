#!/usr/bin/env python3
"""Assess the v5 matrix after all approved continuation supplements."""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from collections import defaultdict
from copy import deepcopy
from decimal import Decimal
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
ASSESSMENT_PATH = PACKAGE_ROOT / "assessment.py"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


a = load_module(
    "ghostnote_symbolic_format_v5_final_assessment", ASSESSMENT_PATH
)
m = a.m


def load_manifest(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    unsigned = deepcopy(value)
    claimed = unsigned.pop("manifest_sha256", None)
    if claimed != m.core.digest(unsigned):
        raise ValueError(f"Manifest hash mismatch: {path}")
    return value


def merge_rows(
    base: dict[str, Any], supplements: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], dict[int, str]]:
    rows = {row["planned_sequence"]: row for row in base["results"]}
    provenance = {
        row["planned_sequence"]: base["manifest_sha256"]
        for row in base["results"]
    }
    for supplement in supplements:
        for row in supplement["results"]:
            if row["initial"]["kind"] == "not-attempted":
                continue
            sequence = row["planned_sequence"]
            prior = rows[sequence]
            if prior["initial"]["kind"] == "initial":
                raise ValueError("A supplement selects an available source row")
            rows[sequence] = row
            provenance[sequence] = supplement["manifest_sha256"]
    return [rows[index] for index in sorted(rows)], provenance


def progress(rows: list[dict[str, Any]]) -> dict[str, int]:
    return {
        "planned": len(rows),
        "available": sum(row["initial"]["kind"] == "initial" for row in rows),
        "scored": sum(row["initial"].get("score") is not None for row in rows),
        "failed": sum(row["initial"]["kind"] == "failed" for row in rows),
        "unavailable": sum(
            row["initial"]["kind"] == "unavailable" for row in rows
        ),
        "not_attempted": sum(
            row["initial"]["kind"] == "not-attempted" for row in rows
        ),
    }


def assess(
    openai_path: Path,
    gemini_path: Path,
    gemini_continuation_path: Path,
    claude_path: Path,
    claude_supplement_paths: list[Path],
) -> dict[str, Any]:
    openai = load_manifest(openai_path)
    gemini = load_manifest(gemini_path)
    gemini_continuation = load_manifest(gemini_continuation_path)
    claude = load_manifest(claude_path)
    claude_supplements = [
        load_manifest(path) for path in claude_supplement_paths
    ]
    merged = {
        "openai": (openai["results"], {}),
        "gemini": merge_rows(gemini, [gemini_continuation]),
        "claude-haiku": merge_rows(claude, claude_supplements),
    }
    jobs = {
        provider: {
            job["planned_sequence"]: job for job in m.jobs(provider)
        }
        for provider in m.PROVIDERS
    }
    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    checks = {
        "prompt-identity": True,
        "task-identity": True,
        "candidate-identity": True,
        "scores-reproduce": True,
        "openai-complete": False,
        "gemini-complete": False,
        "claude-complete-outcomes": False,
    }
    progress_by_provider = {}
    for provider, (rows, _provenance) in merged.items():
        progress_by_provider[provider] = progress(rows)
        for row in rows:
            score = row["initial"].get("score")
            if score is None:
                continue
            job = jobs[provider][row["planned_sequence"]]
            call = row["initial_call"]
            prompt = m.engine.prompt_for(job)
            checks["prompt-identity"] &= (
                call["prompt_sha256"] == m.core.sha256_text(prompt)
                and call["prompt_bytes"] == len(prompt.encode())
            )
            checks["task-identity"] &= row["task_sha256"] == job["task"][
                "sha256"
            ]
            checks["candidate-identity"] &= row[
                "candidate_sha256"
            ] == m.engine.candidate_hashes()[row["arm"]]
            checks["scores-reproduce"] &= score == m.engine.score_response(
                row["arm"], job["task"], call["response_payload"]
            )
            groups[(provider, "ALL")].append(score)
            groups[(provider, row["arm"])].append(score)
    complete = {
        "planned": 592,
        "available": 592,
        "scored": 592,
        "failed": 0,
        "unavailable": 0,
        "not_attempted": 0,
    }
    checks["openai-complete"] = progress_by_provider["openai"] == complete
    checks["gemini-complete"] = progress_by_provider["gemini"] == complete
    checks["claude-complete-outcomes"] = progress_by_provider[
        "claude-haiku"
    ] == {
        "planned": 592,
        "available": 589,
        "scored": 589,
        "failed": 0,
        "unavailable": 3,
        "not_attempted": 0,
    }
    aggregates = {
        provider: {
            "ALL": a.metric_summary(groups[(provider, "ALL")]),
            "arms": {
                arm: a.metric_summary(groups[(provider, arm)])
                for arm in m.ARMS
            },
        }
        for provider in m.PROVIDERS
    }
    cost_manifests = [
        openai,
        gemini,
        gemini_continuation,
        claude,
        *claude_supplements,
    ]
    exact_cost = sum(
        Decimal(str(run["actual_cost_exact_usd"]))
        for run in cost_manifests
    )
    value = {
        "schema": "ghostnote-symbolic-format-v5-final-assessment-v1",
        "run_id": m.RUN_ID,
        "source_manifest_sha256": {
            "openai": [openai["manifest_sha256"]],
            "gemini": [
                gemini["manifest_sha256"],
                gemini_continuation["manifest_sha256"],
            ],
            "claude-haiku": [
                claude["manifest_sha256"],
                *[run["manifest_sha256"] for run in claude_supplements],
            ],
        },
        "progress": progress_by_provider,
        "actual_cost_exact_usd": m.base.exact_usd(exact_cost),
        "aggregates": aggregates,
        "checks": checks,
        "all_retained_rows_valid": all(checks.values()),
        "interpretation": (
            "All providers have complete scheduled outcomes. Claude has 589 "
            "scored rows and three unavailable model outcomes. All retained "
            "identities and scores reproduce."
        ),
    }
    unsigned = deepcopy(value)
    value["sha256"] = m.core.digest(unsigned)
    return value


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--openai", type=Path, required=True)
    parser.add_argument("--gemini", type=Path, required=True)
    parser.add_argument("--gemini-continuation", type=Path, required=True)
    parser.add_argument("--claude", type=Path, required=True)
    parser.add_argument(
        "--claude-supplement", type=Path, action="append", default=[]
    )
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    value = assess(
        args.openai,
        args.gemini,
        args.gemini_continuation,
        args.claude,
        args.claude_supplement,
    )
    if not value["all_retained_rows_valid"]:
        raise SystemExit(json.dumps(value, indent=2, sort_keys=True))
    text = json.dumps(value, indent=2, sort_keys=True) + "\n"
    if args.output is None:
        print(text, end="")
    elif args.output.exists():
        raise FileExistsError(f"Refusing to replace: {args.output}")
    else:
        args.output.write_text(text)


if __name__ == "__main__":
    main()
