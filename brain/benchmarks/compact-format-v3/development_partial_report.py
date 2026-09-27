#!/usr/bin/env python3
"""Validate and report the conditionally stopped development run."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PACKAGE_ROOT))
import core  # type: ignore  # noqa: E402
import development  # type: ignore  # noqa: E402
sys.path.pop(0)


SCHEMA = "ghostnote-compact-format-development-partial-report-v3"
EXPECTED_PROVIDERS = ("openai", "gemini")


def family_stats(run: dict[str, Any], family: str) -> dict[str, Any]:
    indexed = development.indexed_results(run)
    grouped, compact = development.paired_rows(
        indexed,
        "grouped-label-compact",
        "compact-bar-v1",
        (family,),
    )
    controls = [
        row
        for row in run["results"]
        if row["family"] == family
        and row["arm"] in {"exact-json", "midi-like-native"}
    ]
    return {
        "family": family,
        "grouped_vs_compact": development.paired_stats(grouped, compact),
        "control_pool": {
            "successes": sum(row["validation"]["primary_pass"] for row in controls),
            "trials": len(controls),
        },
    }


def make_report(runs: list[dict[str, Any]]) -> dict[str, Any]:
    if {run.get("provider") for run in runs} != set(EXPECTED_PROVIDERS):
        raise ValueError("The partial report needs the OpenAI and Gemini runs")
    protocol_sha256 = development.protocol_manifest()["sha256"]
    provider_rows = []
    improving_providers = 0
    melody_syntax_failures = 0
    melody_trials = 0
    revoice_control_successes = 0
    revoice_control_trials = 0
    for run in sorted(runs, key=lambda value: EXPECTED_PROVIDERS.index(value["provider"])):
        development.integrity_check(run, protocol_sha256)
        indexed = development.indexed_results(run)
        grouped, compact = development.paired_rows(
            indexed,
            "grouped-label-compact",
            "compact-bar-v1",
            core.DECISION_FAMILIES,
        )
        hard = development.paired_stats(grouped, compact)
        improving_providers += hard["effect"] >= development.DECISION_MARGIN
        melody = [
            row
            for row in run["results"]
            if row["arm"] == "grouped-label-compact"
            and row["family"] == "generation-melody"
        ]
        melody_syntax_failures += sum(
            not row["validation"]["syntax_pass"] for row in melody
        )
        melody_trials += len(melody)
        revoice_controls = [
            row
            for row in run["results"]
            if row["family"] == "transformation-revoice"
            and row["arm"] in {"exact-json", "midi-like-native"}
        ]
        revoice_control_successes += sum(
            row["validation"]["primary_pass"] for row in revoice_controls
        )
        revoice_control_trials += len(revoice_controls)
        provider_rows.append(
            {
                "provider": run["provider"],
                "complete": run["complete"],
                "requested_model": run["requested_model"],
                "calls": len(run["results"]),
                "actual_cost_usd": run["actual_cost_usd"],
                "raw_run_sha256": run["raw_run_sha256"],
                "manifest_sha256": run["manifest_sha256"],
                "decision_macro_grouped_vs_compact": hard,
                "families": [
                    family_stats(run, family) for family in core.DECISION_FAMILIES
                ],
                "grouped_melody_syntax": {
                    "successes": sum(
                        row["validation"]["syntax_pass"] for row in melody
                    ),
                    "trials": len(melody),
                    "errors": sorted(
                        {row["validation"]["error"] for row in melody}
                    ),
                },
            }
        )
    remaining_provider_count = len(development.PROVIDERS) - len(runs)
    hard_gate_reachable = (
        improving_providers + remaining_provider_count
        >= 2
    )
    melody_task = development.make_corpus("development")["fixtures"][
        "generation-melody"
    ][0]
    grammar = core.output_grammar("grouped-label-compact", melody_task["family"])
    example = core.output_example("grouped-label-compact", melody_task["family"])
    exact_single_row_syntax_stated = (
        "N ID <id> VOICE <voice> START <start> DURATION <duration> "
        "PITCH <pitch> VELOCITY <velocity>"
    ) in grammar
    issues = []
    if melody_syntax_failures == melody_trials:
        issues.append("grouped-single-note-syntax-failure")
    if not exact_single_row_syntax_stated:
        issues.append("grouped-single-note-prompt-omission")
    if not hard_gate_reachable:
        issues.append("minimum-improving-provider-gate-unreachable")
    if revoice_control_successes == revoice_control_trials:
        issues.append("revoice-control-ceiling-on-observed-providers")
    value = {
        "schema": SCHEMA,
        "run_id": development.RUN_ID,
        "run_kind": "conditional-development-partial-report",
        "decision": "stop-before-claude" if issues else "proceed-claude",
        "formal_development_decision": None,
        "formal_decision_reason": "The frozen three-provider development run is incomplete.",
        "protocol_sha256": protocol_sha256,
        "providers": provider_rows,
        "observed_calls": sum(len(run["results"]) for run in runs),
        "actual_cost_usd": {
            **{run["provider"]: run["actual_cost_usd"] for run in runs},
            "total": round(sum(run["actual_cost_usd"] for run in runs), 6),
        },
        "conditional_review": {
            "issues": issues,
            "observed_improving_providers": improving_providers,
            "remaining_provider_count": remaining_provider_count,
            "minimum_improving_providers": 2,
            "hard_gate_reachable": hard_gate_reachable,
            "grouped_melody_syntax_failures": melody_syntax_failures,
            "grouped_melody_trials": melody_trials,
            "revoice_control_successes": revoice_control_successes,
            "revoice_control_trials": revoice_control_trials,
        },
        "grammar_audit": {
            "parser_requires": "N ID <id> VOICE <voice> START <start> DURATION <duration> PITCH <pitch> VELOCITY <velocity>",
            "prompt_grammar": grammar,
            "prompt_example": example,
            "exact_single_row_syntax_stated": exact_single_row_syntax_stated,
        },
        "allowed_follow_up": "Do not run Claude under the conditional approval. Do not repair or resume this frozen run.",
    }
    value["sha256"] = core.digest(value)
    return value


def self_test(value: dict[str, Any]) -> dict[str, Any]:
    assert value["decision"] == "stop-before-claude"
    assert value["observed_calls"] == 440
    assert value["conditional_review"]["grouped_melody_syntax_failures"] == 8
    assert not value["conditional_review"]["hard_gate_reachable"]
    assert not value["grammar_audit"]["exact_single_row_syntax_stated"]
    assert all(row["complete"] and row["calls"] == 220 for row in value["providers"])
    return {
        "schema": SCHEMA,
        "pass": True,
        "checks": 7,
        "report_sha256": value["sha256"],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("run_files", nargs=2, type=Path)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    runs = [json.loads(path.read_text()) for path in args.run_files]
    report = make_report(runs)
    value = self_test(report) if args.self_test else report
    rendered = json.dumps(value, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered)
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
