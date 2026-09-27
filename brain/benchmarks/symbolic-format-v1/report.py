#!/usr/bin/env python3
"""Render a complete Markdown report from retained v1 manifests."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any


FAMILIES = [
    ("comprehension-structure", "CS"),
    ("comprehension-analysis", "CA"),
    ("generation-progression", "GP"),
    ("generation-melody", "GM"),
    ("continuation-motif", "CM"),
    ("continuation-roles", "CR"),
    ("transformation-local", "TL"),
    ("transformation-revoice", "TV"),
    ("transformation-rhythm", "TR"),
]

PROVIDER_NAMES = {
    "openai": "OpenAI",
    "gemini": "Gemini",
    "claude": "Claude",
}


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"Expected an object in {path}")
    return value


def md_text(value: Any) -> str:
    return str(value).replace("|", "\\|").replace("\n", "<br>")


def status(value: bool | None) -> str:
    if value is True:
        return "PASS"
    if value is False:
        return "FAIL"
    return "—"


def money(value: float) -> str:
    return f"{value:.6f}"


def points(value: float) -> str:
    return f"{value * 100:+.2f} pp"


def fraction(numerator: int, denominator: int) -> str:
    return f"{numerator}/{denominator} ({numerator / denominator * 100:.1f}%)"


def provider_name(value: str) -> str:
    return PROVIDER_NAMES.get(value, value)


def table(headers: list[str], rows: list[list[Any]]) -> list[str]:
    output = [
        "| " + " | ".join(headers) + " |",
        "|" + "|".join("---" for _ in headers) + "|",
    ]
    output.extend(
        "| " + " | ".join(md_text(cell) for cell in row) + " |"
        for row in rows
    )
    return output


def family_cell(results: list[dict[str, Any]]) -> str:
    if not results:
        return "—"
    trials = len(results)
    musical = sum(item["validation"]["musical_pass"] is True for item in results)
    syntax = sum(item["validation"]["syntax_pass"] is True for item in results)
    checked = [
        item["validation"]["alignment"]
        for item in results
        if item["validation"]["alignment"]["checked"]
    ]
    cell = f"{musical}/{trials} · s{syntax}"
    if checked:
        failures = sum(item["pass"] is False for item in checked)
        cell += f" · c{failures}"
    return cell


def render_report(
    summary_path: Path,
    run_paths: list[Path],
) -> str:
    summary = load_json(summary_path)
    runs = [load_json(path) for path in run_paths]
    run_by_provider = {run["provider"]: run for run in runs}
    path_by_provider = {
        run["provider"]: path for run, path in zip(runs, run_paths, strict=True)
    }
    providers = [item["provider"] for item in summary["providers"]]
    if set(providers) != set(run_by_provider):
        raise ValueError("Summary and run providers differ")
    for provider in providers:
        run = run_by_provider[provider]
        if summary["raw_run_sha256"][provider] != run["raw_run_sha256"]:
            raise ValueError(f"Raw-run identity differs for {provider}")

    lines = [
        "# Symbolic-format v1 complete retained results",
        "",
        "This report renders every retained core cell in the Phase 8c1 run.",
        "It keeps repeated-prompt sentinels and secondary cases separate. The",
        "adaptive rule makes the matrix sparse: eligible cells contain three,",
        "five, or seven trials, and an em dash marks an ineligible cell.",
        "",
        "The v1 compact arm used the unlabeled development shorthand",
        "`N id voice start duration pitch velocity`. It did not use the labeled",
        "compact-bar v0 event spelling. Interpret these results as evidence for",
        "this fixed v1 arm. Do not use them to freeze the public syntax.",
        "",
        "Decision: `revise`. The mechanical claim label is `material observed",
        "deficit`, and population equivalence is not claimed. No paired rate",
        "crossed the negative 12.5 percentage-point margin. The separate",
        "provider-specific repeated-loss rule caused the decision.",
        "",
        "## Sources and run totals",
        "",
        f"Summary: [{summary_path.name}]({summary_path.name})",
        "",
    ]

    source_rows: list[list[Any]] = []
    identity_rows: list[list[Any]] = []
    for provider in providers:
        run = run_by_provider[provider]
        core = [item for item in run["results"] if not item["sentinel"]]
        sentinels = [item for item in run["results"] if item["sentinel"]]
        repair_calls = sum(item.get("repair") is not None for item in run["secondary"])
        total_calls = len(run["results"]) + len(run["secondary"]) + repair_calls
        returned_models = sorted({item["returned_model"] for item in run["results"]})
        source_rows.append(
            [
                provider_name(provider),
                run["requested_model"],
                ", ".join(returned_models),
                len(core),
                len(sentinels),
                len(run["secondary"]) + repair_calls,
                total_calls,
                money(run["actual_cost_usd"]),
                f"[{path_by_provider[provider].name}]({path_by_provider[provider].name})",
            ]
        )
        identity_rows.append(
            [provider_name(provider), run["raw_run_sha256"], run["manifest_sha256"]]
        )
    lines.extend(
        table(
            [
                "Provider",
                "Requested model",
                "Returned model",
                "Core",
                "Sentinel",
                "Secondary",
                "Calls",
                "USD",
                "Manifest",
            ],
            source_rows,
        )
    )
    lines.extend(["", "### Run identities", ""])
    lines.extend(table(["Provider", "Raw-run SHA-256", "Manifest SHA-256"], identity_rows))
    lines.extend(["", "### Provider settings", ""])
    setting_rows: list[list[Any]] = []
    for provider in providers:
        settings = run_by_provider[provider]["settings"]
        setting_rows.append(
            [
                provider_name(provider),
                settings["reasoning_or_effort"],
                settings["max_output_tokens"],
                settings["seeded_interleave"],
                settings["temperature"],
                ", ".join(str(value) for value in settings["retry_delays_seconds"]),
                ", ".join(str(value) for value in settings["retry_http_status"]),
            ]
        )
    lines.extend(
        table(
            [
                "Provider",
                "Reasoning/effort",
                "Max output",
                "Interleave seed",
                "Sampling",
                "Retry delays (s)",
                "Retry HTTP",
            ],
            setting_rows,
        )
    )
    lines.extend(
        [
            "",
            "Costs in this report cover the retained run only. E140 records the",
            "separate development-pilot totals and their accounting limits.",
        ]
    )

    lines.extend(
        [
            "",
            "## Cell notation",
            "",
            "A task cell uses `musical passes/trials · s<syntax passes>`. Composite",
            "cells also use `c<broad composite failures>`. For example,",
            "`2/5 · s4 · c1` means two musical passes, four syntax passes, and",
            "one broad composite failure in five trials. This broad counter",
            "includes explicit score-ledger disagreement and other parse errors.",
            "Aggregate musical and syntax totals include their success",
            "percentages.",
            "",
            "Family codes: CS = structure comprehension; CA = analysis",
            "comprehension; GP = progression generation; GM = melody generation;",
            "CM = motif continuation; CR = role continuation; TL = local",
            "transformation; TV = chord revoicing; TR = rhythm transformation.",
        ]
    )

    provider_summary = {item["provider"]: item for item in summary["providers"]}
    arm_order = [item["arm"] for item in summary["providers"][0]["arms"]]
    for provider in providers:
        run = run_by_provider[provider]
        grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
        for result in run["results"]:
            if not result["sentinel"]:
                grouped[(result["arm"], result["family"])].append(result)
        totals = {
            item["arm"]: item for item in provider_summary[provider]["arms"]
        }
        matrix_rows: list[list[Any]] = []
        for arm in arm_order:
            arm_results = [
                item
                for family, _ in FAMILIES
                for item in grouped[(arm, family)]
            ]
            cells = [family_cell(grouped[(arm, family)]) for family, _ in FAMILIES]
            total = totals[arm]
            alignment_failures = sum(
                item["validation"]["alignment"]["checked"]
                and item["validation"]["alignment"]["pass"] is False
                for item in arm_results
            )
            observed = (
                len(arm_results),
                sum(item["validation"]["musical_pass"] is True for item in arm_results),
                sum(item["validation"]["syntax_pass"] is True for item in arm_results),
                alignment_failures,
            )
            expected = (
                total["trials"],
                total["successes"],
                total["syntax_successes"],
                total["alignment_failures"],
            )
            if observed != expected:
                raise ValueError(
                    f"Arm total differs for {provider}/{arm}: {observed} != {expected}"
                )
            total_cell = (
                f"{fraction(total['successes'], total['trials'])} · "
                f"s{fraction(total['syntax_successes'], total['trials'])}"
            )
            if arm.endswith("-composite"):
                total_cell += f" · c{total['alignment_failures']}"
            matrix_rows.append([arm, *cells, total_cell])
        lines.extend(["", f"## {provider_name(provider)} task matrix", ""])
        lines.extend(
            table(
                ["Arm", *[code for _, code in FAMILIES], "Total"],
                matrix_rows,
            )
        )

    lines.extend(["", "## Arm totals and resource use", ""])
    arm_rows: list[list[Any]] = []
    for provider in providers:
        for arm in provider_summary[provider]["arms"]:
            arm_rows.append(
                [
                    provider_name(provider),
                    arm["arm"],
                    fraction(arm["successes"], arm["trials"]),
                    fraction(arm["syntax_successes"], arm["trials"]),
                    arm["alignment_failures"],
                    arm["input_tokens"],
                    arm["output_tokens"],
                    arm["output_bytes"],
                    money(arm["cost_usd"]),
                ]
            )
    lines.extend(
        table(
            [
                "Provider",
                "Arm",
                "Musical",
                "Syntax",
                "Composite fail",
                "Input tok",
                "Output tok",
                "Output bytes",
                "USD",
            ],
            arm_rows,
        )
    )

    lines.extend(["", "## Paired compact comparisons", ""])
    comparison_rows = [
        [
            provider_name(item["provider"]),
            item["comparison"],
            item["paired_trials"],
            fraction(item["compact_successes"], item["paired_trials"]),
            fraction(item["comparator_successes"], item["paired_trials"]),
            points(item["delta"]),
            status(item["passes"]),
            ", ".join(item["repeated_compact_only_failure_families"]) or "—",
        ]
        for item in summary["comparisons"]
    ]
    lines.extend(
        table(
            [
                "Provider",
                "Comparison",
                "Paired",
                "Compact",
                "Other",
                "Delta",
                "Gate",
                "Repeated compact-only failure families",
            ],
            comparison_rows,
        )
    )
    lines.extend(
        [
            "",
            f"Frozen margin: {summary['frozen_margin'] * 100:.1f} percentage points.",
            "The gate also fails when one provider has at least two compact-only",
            "losses in one task family. No comparison crossed the negative rate",
            "margin, but the repeated-loss rule produced the `revise` decision.",
        ]
    )

    lines.extend(["", "## Native versus composite side ledger", ""])
    ledger_rows = [
        [
            provider_name(item["provider"]),
            item["family"],
            points(item["success_delta"]),
            item["input_token_overhead"],
            item["output_byte_overhead"],
            item["alignment_failures"],
        ]
        for item in summary["side_ledger"]
    ]
    lines.extend(
        table(
            [
                "Provider",
                "Format family",
                "Composite success delta",
                "Input-token overhead",
                "Output-byte overhead",
                "Broad composite failures",
            ],
            ledger_rows,
        )
    )
    lines.extend(
        [
            "",
            "The broad composite counter comes from the retained scorer's generic",
            "exception path. It includes explicit disagreement, score parsing,",
            "ledger parsing, and patch parsing. It is not an exact count of",
            "score-ledger disagreements.",
            "",
            "### Explicit score-ledger disagreements",
            "",
        ]
    )
    mismatch_rows: list[list[Any]] = []
    total_eligible = 0
    total_disagreements = 0
    total_other_errors = 0
    for provider in providers:
        event_results = [
            item
            for item in run_by_provider[provider]["results"]
            if not item["sentinel"]
            and item["arm"].endswith("-composite")
            and item["family"]
            not in {"comprehension-analysis", "transformation-local"}
        ]
        disagreements = sum(
            item["validation"].get("error")
            == "Score and side ledger disagree"
            for item in event_results
        )
        other_errors = sum(
            item["validation"].get("error") is not None
            and item["validation"].get("error")
            != "Score and side ledger disagree"
            for item in event_results
        )
        eligible = len(event_results)
        total_eligible += eligible
        total_disagreements += disagreements
        total_other_errors += other_errors
        mismatch_rows.append(
            [
                provider_name(provider),
                eligible,
                fraction(disagreements, eligible),
                fraction(other_errors, eligible),
            ]
        )
    mismatch_rows.append(
        [
            "Total",
            total_eligible,
            fraction(total_disagreements, total_eligible),
            fraction(total_other_errors, total_eligible),
        ]
    )
    lines.extend(
        table(
            [
                "Provider",
                "Ledger-eligible event calls",
                "Explicit disagreements",
                "Other parse errors",
            ],
            mismatch_rows,
        )
    )

    lines.extend(["", "## Repeated-prompt sentinels", ""])
    for provider in providers:
        run = run_by_provider[provider]
        base_index = {
            (item["arm"], item["family"], item["variant"]): item
            for item in run["results"]
            if not item["sentinel"]
        }
        sentinel_rows: list[list[Any]] = []
        for item in run["results"]:
            if not item["sentinel"]:
                continue
            key = (item["arm"], item["family"], item["variant"])
            if key not in base_index:
                raise ValueError(f"Missing sentinel base for {provider}: {key}")
            base = base_index[key]
            base_pass = base["validation"]["musical_pass"]
            repeat_pass = item["validation"]["musical_pass"]
            sentinel_rows.append(
                [
                    item["arm"],
                    item["family"],
                    item["variant"],
                    status(base_pass),
                    status(repeat_pass),
                    "YES" if base_pass != repeat_pass else "no",
                ]
            )
        lines.extend(["", f"### {provider_name(provider)}", ""])
        lines.extend(
            table(
                ["Arm", "Family", "Variant", "Base", "Repeat", "Changed"],
                sentinel_rows,
            )
        )

    lines.extend(["", "## Adaptive stopping", ""])
    stopping_rows: list[list[Any]] = []
    for provider in providers:
        run = run_by_provider[provider]
        groups: dict[tuple[str, str], int] = defaultdict(int)
        sentinels = 0
        for item in run["results"]:
            if item["sentinel"]:
                sentinels += 1
            else:
                groups[(item["arm"], item["family"])] += 1
        size_counts = {size: sum(value == size for value in groups.values()) for size in (3, 5, 7)}
        repair_calls = sum(item.get("repair") is not None for item in run["secondary"])
        secondary_calls = len(run["secondary"]) + repair_calls
        actual = len(run["results"]) + secondary_calls
        maximum = len(groups) * 7 + sentinels + secondary_calls
        stopping_rows.append(
            [
                provider_name(provider),
                len(groups),
                size_counts[3],
                size_counts[5],
                size_counts[7],
                sum(groups.values()),
                sentinels,
                secondary_calls,
                actual,
                maximum,
                maximum - actual,
            ]
        )
    lines.extend(
        table(
            [
                "Provider",
                "Cells",
                "At 3",
                "At 5",
                "At 7",
                "Core calls",
                "Sentinel",
                "Secondary",
                "Actual",
                "Maximum",
                "Saved",
            ],
            stopping_rows,
        )
    )

    lines.extend(["", "## Secondary cases", ""])
    secondary_rows: list[list[Any]] = []
    for provider in providers:
        for item in run_by_provider[provider]["secondary"]:
            repair = item.get("repair")
            secondary_rows.append(
                [
                    provider_name(provider),
                    item["id"],
                    item["arm"],
                    status(item["initial_pass"]),
                    item["initial_response"],
                    status(repair["pass"]) if repair else "—",
                    repair["response"] if repair else "—",
                ]
            )
    lines.extend(
        table(
            [
                "Provider",
                "Case",
                "Arm",
                "Initial",
                "Initial response",
                "Repair",
                "Repair response",
            ],
            secondary_rows,
        )
    )

    lines.extend(
        [
            "",
            "## Interpretation boundary",
            "",
            "The matrix reports deterministic constraint satisfaction. It does",
            "not rank musical quality. Native arms do not gain stable Ghostnote",
            "identity, omitted-field preservation, sparse edits, or merge safety",
            "from a musical pass. Composite arms add those task fields through a",
            "side ledger. Explicit alignment and other parse failures remain",
            "separate result classes.",
            "",
            "The retained decision is `revise`. Use the linked raw manifests for",
            "individual responses, per-check validation, latency, token usage,",
            "cost, stop reason, and response hashes.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--summary", required=True, type=Path)
    parser.add_argument("--runs", required=True, nargs="+", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    report = render_report(args.summary, args.runs)
    args.output.write_text(report, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
