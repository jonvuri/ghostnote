#!/usr/bin/env python3
"""Render a concise Markdown report from Phase 8c3 retained manifests."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def load(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    if not isinstance(value, dict):
        raise ValueError(f"Expected an object in {path}")
    return value


def table(headers: list[str], rows: list[list[Any]]) -> list[str]:
    result = [
        "| " + " | ".join(headers) + " |",
        "|" + "|".join("---" for _ in headers) + "|",
    ]
    result.extend(
        "| "
        + " | ".join(str(value).replace("|", "\\|").replace("\n", "<br>") for value in row)
        + " |"
        for row in rows
    )
    return result


def rate(numerator: int, denominator: int) -> str:
    return f"{numerator}/{denominator} ({numerator / denominator * 100:.1f}%)"


def render(summary_path: Path, run_paths: list[Path]) -> str:
    summary = load(summary_path)
    runs = {value["provider"]: value for value in (load(path) for path in run_paths)}
    if set(runs) != {value["provider"] for value in summary["providers"]}:
        raise ValueError("Summary and provider manifests differ")
    for provider, run in runs.items():
        if summary["raw_run_sha256"][provider] != run["raw_run_sha256"]:
            raise ValueError(f"Raw-run identity differs for {provider}")
    lines = [
        "# Phase 8c3 full symbolic-format matrix",
        "",
        f"Decision: `{summary['decision']}`.",
        f"Selected full-capability arm: `{summary['selected_full_capability_arm'] or 'none'}`.",
        "Population equivalence is not claimed.",
        "",
        "## Provider totals",
        "",
    ]
    provider_rows = []
    for value in summary["providers"]:
        provider = value["provider"]
        run = runs[provider]
        repair_calls = sum("repair" in item for item in run["secondary"])
        provider_rows.append(
            [
                provider,
                run["requested_model"],
                ", ".join(value["returned_models"]),
                len(run["results"]) + len(run["secondary"]) + repair_calls,
                f"{run['actual_cost_usd']:.6f}",
                run["raw_run_sha256"],
                run["manifest_sha256"],
            ]
        )
    lines.extend(
        table(
            ["Provider", "Requested", "Returned", "Calls", "USD", "Raw SHA-256", "Manifest SHA-256"],
            provider_rows,
        )
    )
    lines.extend(["", "## Arm totals", ""])
    arm_rows = []
    for provider in summary["providers"]:
        for arm in provider["arms"]:
            arm_rows.append(
                [
                    provider["provider"],
                    arm["arm"],
                    rate(arm["successes"], arm["trials"]),
                    rate(arm["syntax_successes"], arm["trials"]),
                    arm["input_tokens"],
                    arm["output_tokens"],
                    arm["output_bytes"],
                    arm["latency_ms"],
                    f"{arm['cost_usd']:.6f}",
                ]
            )
    lines.extend(
        table(
            ["Provider", "Arm", "Musical", "Syntax", "Input", "Output", "Bytes", "Latency ms", "USD"],
            arm_rows,
        )
    )
    lines.extend(["", "## Paired full-capability comparisons", ""])
    comparison_rows = []
    for value in summary["comparisons"]:
        comparison_rows.append(
            [
                value["provider"],
                value["candidate"],
                value["comparator"],
                value["paired_trials"],
                f"{value['rate_delta'] * 100:+.2f} pp",
                f"{value['syntax_delta'] * 100:+.2f} pp",
                "PASS" if value["passes"] else "FAIL",
                ", ".join(value["repeated_candidate_only_loss_families"]) or "—",
            ]
        )
    lines.extend(
        table(
            ["Provider", "Candidate", "Comparator", "Paired", "Musical delta", "Syntax delta", "Gate", "Repeated-loss families"],
            comparison_rows,
        )
    )
    lines.extend(["", "## Native versus composite side ledger", ""])
    lines.extend(
        table(
            ["Provider", "Format", "Paired", "Musical delta", "Input-token overhead", "Output-byte overhead"],
            [
                [
                    value["provider"],
                    value["family"],
                    value["paired_trials"],
                    f"{value['musical_success_delta'] * 100:+.2f} pp",
                    value["input_token_overhead"],
                    value["output_byte_overhead"],
                ]
                for value in summary["side_ledger"]
            ],
        )
    )
    lines.extend(["", "## Composite failure classes", ""])
    failure_rows = []
    for value in summary["providers"]:
        failure = value["composite_failure_summary"]
        for name, count in failure["classes"].items():
            denominator = (
                failure["event_output_calls"]
                if name != "other-output-or-patch-parse-failure"
                else failure["all_composite_calls"]
            )
            failure_rows.append([value["provider"], name, count, denominator])
    lines.extend(table(["Provider", "Failure class", "Count", "Denominator"], failure_rows))
    lines.extend(
        [
            "",
            "Initial secondary responses and repaired responses remain separate in the provider manifests.",
            "Use those manifests for individual checks, prompts, responses, latency, usage, and stop reasons.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--summary", required=True, type=Path)
    parser.add_argument("--runs", required=True, nargs=3, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.write_text(render(args.summary, args.runs))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
