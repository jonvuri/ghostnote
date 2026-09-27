#!/usr/bin/env python3
"""Build the corrected Phase 8c2 initial development analysis."""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PACKAGE_ROOT))
import benchmark as base  # type: ignore  # noqa: E402
sys.path.pop(0)


SCHEMA = "ghostnote-compact-format-initial-analysis-v2"
INITIAL_PROTOCOL_SHA256 = "b29699fc48f002fd7130cacf543405cbc768feb79f7a9f1d29cf2e6b59643a2d"
CANDIDATES = ("label-only-compact", "full-v0-style-compact")


def load_runs(paths: list[Path]) -> list[dict[str, Any]]:
    runs = [json.loads(path.read_text()) for path in paths]
    if {run["provider"] for run in runs} != set(base.PROVIDERS):
        raise ValueError("Analysis needs one run from each provider")
    for run in runs:
        if run["protocol_sha256"] != INITIAL_PROTOCOL_SHA256:
            raise ValueError("Provider run has a different initial protocol")
        if not run["complete"] or len(run["results"]) != 108:
            raise ValueError("Provider run is incomplete")
        if any(row.get("returned_model") != run["requested_model"] for row in run["results"]):
            raise ValueError("Provider returned a different model")
    return runs


def rate(rows: list[dict[str, Any]]) -> float:
    return sum(row["validation"]["musical_pass"] for row in rows) / len(rows) if rows else 0.0


def arm_summary(run: dict[str, Any], arm: str) -> dict[str, Any]:
    rows = [row for row in run["results"] if row["arm"] == arm]
    families = []
    for family in base.TASK_FAMILIES:
        selected = [row for row in rows if row["family"] == family]
        families.append({
            "family": family,
            "successes": sum(row["validation"]["musical_pass"] for row in selected),
            "trials": len(selected),
            "rate": round(rate(selected), 6),
        })
    hard = {row["family"]: row["rate"] for row in families if row["family"] in base.HARD_FAMILIES}
    guards = {row["family"]: row["rate"] for row in families if row["family"] in base.GUARD_FAMILIES}
    return {
        "arm": arm,
        "hard_macro": round(sum(hard.values()) / len(hard), 6),
        "guard_macro": round(sum(guards.values()) / len(guards), 6),
        "syntax_passes": sum(row["validation"]["syntax_pass"] for row in rows),
        "trials": len(rows),
        "input_tokens": sum(row["usage"]["input_tokens"] for row in rows),
        "output_tokens": sum(row["usage"]["output_tokens"] for row in rows),
        "output_bytes": sum(row.get("response_payload_bytes", 0) for row in rows),
        "families": families,
    }


def paired_comparison(run: dict[str, Any], candidate: str, summaries: dict[str, dict[str, Any]]) -> dict[str, Any]:
    candidate_rows = {(row["family"], row["variant"], row["repeat"]): row for row in run["results"] if row["arm"] == candidate}
    baseline_rows = {(row["family"], row["variant"], row["repeat"]): row for row in run["results"] if row["arm"] == "compact-bar-v1"}
    keys = sorted(candidate_rows.keys() & baseline_rows.keys())
    paired = [(candidate_rows[key]["validation"]["musical_pass"], baseline_rows[key]["validation"]["musical_pass"], key) for key in keys]
    losses = defaultdict(int)
    for candidate_pass, baseline_pass, key in paired:
        if baseline_pass and not candidate_pass:
            losses[key[0]] += 1
    candidate_summary = summaries[candidate]
    baseline_summary = summaries["compact-bar-v1"]
    exact_summary = summaries["exact-json"]
    result = {
        "provider": run["provider"],
        "candidate": candidate,
        "paired_denominator": len(paired),
        "candidate_only_wins": sum(candidate_pass and not baseline_pass for candidate_pass, baseline_pass, _ in paired),
        "candidate_only_losses": sum(baseline_pass and not candidate_pass for candidate_pass, baseline_pass, _ in paired),
        "candidate_only_losses_by_family": dict(sorted(losses.items())),
        "both_pass": sum(candidate_pass and baseline_pass for candidate_pass, baseline_pass, _ in paired),
        "both_fail": sum(not candidate_pass and not baseline_pass for candidate_pass, baseline_pass, _ in paired),
        "hard_macro_delta": round(candidate_summary["hard_macro"] - baseline_summary["hard_macro"], 6),
        "guard_macro_delta": round(candidate_summary["guard_macro"] - baseline_summary["guard_macro"], 6),
        "input_token_ratio_to_exact": round(candidate_summary["input_tokens"] / exact_summary["input_tokens"], 6),
        "output_byte_ratio_to_exact": round(candidate_summary["output_bytes"] / exact_summary["output_bytes"], 6),
    }
    gate = base.DEVELOPMENT_GATE
    result["provider_gate"] = {
        "hard_improvement": result["hard_macro_delta"] >= gate["hard_family_macro_improvement"],
        "guard_regression": result["guard_macro_delta"] >= -gate["maximum_guard_macro_regression"],
        "candidate_only_losses": all(value <= gate["maximum_candidate_only_losses_per_provider_family"] for value in losses.values()),
        "input_size": result["input_token_ratio_to_exact"] <= gate["maximum_input_token_ratio_to_exact_json"],
        "output_size": result["output_byte_ratio_to_exact"] <= gate["maximum_output_byte_ratio_to_exact_json"],
    }
    result["provider_gate"]["pass"] = all(result["provider_gate"].values())
    return result


def failure_report(run: dict[str, Any]) -> dict[str, Any]:
    composite = [row for row in run["results"] if row["arm"] == "midi-like-composite"]
    composite_events = [row for row in composite if row["family"] != "transformation-local"]
    aligned_eligible = [row for row in composite_events if row["validation"].get("parse_stages", {}).get("native_score") and row["validation"].get("parse_stages", {}).get("side_ledger")]
    classes = [
        {
            "class": "explicit-score-ledger-disagreement",
            "numerator": sum(row["validation"].get("failure_class") == "explicit-score-ledger-disagreement" for row in aligned_eligible),
            "eligible_denominator": len(aligned_eligible),
        },
        {
            "class": "missing-or-invalid-side-ledger",
            "numerator": sum(row["validation"].get("failure_class") == "missing-or-invalid-side-ledger" for row in composite_events),
            "eligible_denominator": len(composite_events),
        },
        {
            "class": "native-score-parse-failure",
            "numerator": sum(row["validation"].get("failure_class") == "native-score-parse-failure" for row in composite_events),
            "eligible_denominator": len(composite_events),
        },
        {
            "class": "other-output-or-patch-parse-failure",
            "numerator": sum(row["validation"].get("failure_class") == "other-output-or-patch-parse-failure" for row in composite),
            "eligible_denominator": len(composite),
        },
    ]
    other_by_arm = []
    for arm in base.ARMS:
        rows = [row for row in run["results"] if row["arm"] == arm]
        other_by_arm.append({
            "arm": arm,
            "numerator": sum(row["validation"].get("failure_class") == "other-output-or-patch-parse-failure" for row in rows),
            "eligible_denominator": len(rows),
        })
    return {"composite_classes": classes, "other_parse_failures_by_arm": other_by_arm}


def semantic_sentinel(run: dict[str, Any]) -> list[dict[str, Any]]:
    expected = base.make_corpus()["fixtures"][base.SENTINEL_FAMILY][0]["expected"]
    result = []
    for arm in base.ARMS:
        outcomes = []
        for row in sorted((value for value in run["results"] if value["arm"] == arm and value["sentinel"]), key=lambda value: value["repeat"]):
            try:
                notes, _ = base.parse_events(arm, row["response_payload"])
                outcomes.append(base.projected(notes, base.MUSICAL_FIELDS) == base.projected(expected, base.MUSICAL_FIELDS))
            except (KeyError, TypeError, ValueError):
                outcomes.append(False)
        result.append({"arm": arm, "outcomes": outcomes, "varied": len(set(outcomes)) > 1})
    return result


def analyze(paths: list[Path]) -> dict[str, Any]:
    runs = load_runs(paths)
    providers = []
    comparisons = []
    for run in runs:
        summaries = {arm: arm_summary(run, arm) for arm in base.ARMS}
        comparisons.extend(paired_comparison(run, candidate, summaries) for candidate in CANDIDATES)
        providers.append({
            "provider": run["provider"],
            "requested_model": run["requested_model"],
            "returned_models": sorted({row["returned_model"] for row in run["results"]}),
            "actual_cost_usd": run["actual_cost_usd"],
            "arms": [summaries[arm] for arm in base.ARMS],
            "failures": failure_report(run),
            "semantic_sentinel_diagnostic": semantic_sentinel(run),
            "manifest_sha256": run["manifest_sha256"],
        })
    candidate_gates = []
    for candidate in CANDIDATES:
        rows = [row for row in comparisons if row["candidate"] == candidate]
        provider_passes = sum(row["provider_gate"]["pass"] for row in rows)
        overall = provider_passes >= 2 and all(row["hard_macro_delta"] >= -0.05 for row in rows)
        candidate_gates.append({"candidate": candidate, "provider_passes": provider_passes, "providers": len(rows), "eligible_for_holdout": overall})
    selected = [row["candidate"] for row in candidate_gates if row["eligible_for_holdout"]]
    value = {
        "schema": SCHEMA,
        "run_id": base.RUN_ID,
        "decision": "freeze-targeted-holdout" if selected else "new-development-iteration",
        "selected_candidates": selected,
        "development_gate": base.DEVELOPMENT_GATE,
        "candidate_gates": candidate_gates,
        "candidate_comparisons": comparisons,
        "providers": providers,
        "actual_cost_usd": {**{run["provider"]: run["actual_cost_usd"] for run in runs}, "total": round(sum(run["actual_cost_usd"] for run in runs), 6)},
        "primary_sentinel_limit": "The primary motif score required exact new-note IDs that the prompt did not specify. Do not use its identity-arm outcomes as a variation result.",
        "semantic_sentinel_limit": "The semantic sentinel diagnostic is post-run and ignores new-note IDs. It classifies variation only; it does not replace a primary score.",
        "reporting_correction": "The frozen summary made the other-parse denominator all 108 responses. This analysis uses all 18 composite responses and reports non-composite parse failures by arm.",
        "initial_protocol_sha256": INITIAL_PROTOCOL_SHA256,
    }
    value["sha256"] = base.digest(value)
    return value


def self_test(paths: list[Path]) -> dict[str, Any]:
    value = analyze(paths)
    gates = {row["candidate"]: row for row in value["candidate_gates"]}
    assert gates["label-only-compact"] == {"candidate": "label-only-compact", "provider_passes": 3, "providers": 3, "eligible_for_holdout": True}
    assert not gates["full-v0-style-compact"]["eligible_for_holdout"]
    assert value["actual_cost_usd"]["total"] == 2.560311
    expected_denominators = {
        "openai": [16, 17, 17, 18],
        "gemini": [17, 17, 17, 18],
        "claude": [15, 17, 17, 18],
    }
    for provider in value["providers"]:
        actual = [row["eligible_denominator"] for row in provider["failures"]["composite_classes"]]
        assert actual == expected_denominators[provider["provider"]]
    return {"schema": SCHEMA, "pass": True, "analysis_sha256": value["sha256"], "checks": 8}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("runs", nargs=3, type=Path)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    value = self_test(args.runs) if args.self_test else analyze(args.runs)
    rendered = json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    if args.output:
        args.output.write_text(rendered)
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
