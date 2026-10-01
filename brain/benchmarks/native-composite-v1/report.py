#!/usr/bin/env python3
"""Report paired results by provider, family, and notation."""

import argparse
import json
import random
from decimal import Decimal
from pathlib import Path

import benchmark as m


def summary(scores):
    correct = sum(score["component"]["case_correct"] for score in scores)
    planned = sum(score["component"]["case_planned"] for score in scores)
    return {
        "prompts": len(scores), "component_correct": correct, "component_planned": planned,
        "component_accuracy": correct / planned if planned else None,
        "mean_prompt_accuracy": sum(score["component"]["case_correct"] / score["component"]["case_planned"] for score in scores) / len(scores) if scores else None,
        "strict_musical_passes": sum(score["component"]["case_correct"] == score["component"]["case_planned"] for score in scores),
        "structural_passes": sum(score["structural_parse_pass"] for score in scores),
        "canonical_passes": sum(score["canonical_form_pass"] for score in scores),
        "notation_ledger_alignment_passes": sum(score.get("notation_ledger_alignment") is True for score in scores),
        "notation_ledger_alignment_prompts": sum(score.get("notation_ledger_alignment") is not None for score in scores),
        "notation_component_correct": sum(score.get("notation_musical_component", {}).get("case_correct", 0) for score in scores),
        "notation_component_planned": sum(score.get("notation_musical_component", {}).get("case_planned", 0) for score in scores),
    }


def call_summary(rows):
    calls = [row["initial_call"] for row in rows if row.get("initial_call") is not None]
    measured = [call for call in calls if call.get("usage")]
    return {
        "planned": len(rows), "attempted": sum(row.get("attempted", False) for row in rows),
        "scored": sum(row["initial"].get("score") is not None for row in rows),
        "unavailable": sum(row["initial"].get("kind") == "unavailable" for row in rows),
        "failed": sum(row["initial"].get("kind") == "failed" for row in rows),
        "input_tokens": sum(call["usage"]["input_tokens"] for call in measured),
        "output_tokens": sum(call["usage"]["output_tokens"] for call in measured),
        "measured_cost_usd": str(sum((Decimal(str(call["cost_usd"]["total"])) for call in measured), Decimal(0))),
        "mean_latency_ms": sum(call["latency_ms"] for call in calls) / len(calls) if calls else None,
        "response_bytes": sum(call.get("response_bytes", 0) for call in calls),
    }


def paired(rows, name, family):
    selected = [row for row in rows if row["repeat"] == 1 and row["family"] == family and row["arm"].startswith(name + "-")]
    indexed = {(row["task_sha256"], row["arm"]): row["initial"].get("score") for row in selected}
    native, composite, differences = [], [], []
    wins = losses = 0
    for task_hash in sorted({key[0] for key in indexed}):
        left, right = (indexed.get((task_hash, f"{name}-{condition}")) for condition in ("native", "composite"))
        if left is None or right is None:
            continue
        native.append(left)
        composite.append(right)
        rates = [score["component"]["case_correct"] / score["component"]["case_planned"] for score in (left, right)]
        differences.append(rates[0] - rates[1])
        passes = [score["component"]["case_correct"] == score["component"]["case_planned"] for score in (left, right)]
        wins += int(passes[0] and not passes[1])
        losses += int(passes[1] and not passes[0])
    rng = random.Random(8127)
    samples = sorted(sum(rng.choice(differences) for _ in differences) / len(differences) for _ in range(5000)) if differences else []
    return {"planned_unique_pairs": m.suite.COUNT, "complete_pairs": len(differences), "incomplete_pairs": m.suite.COUNT - len(differences), "native": summary(native), "composite": summary(composite), "call_outcomes": {condition: call_summary([row for row in selected if row["arm"] == f"{name}-{condition}"]) for condition in ("native", "composite")}, "native_minus_composite_mean_prompt_accuracy": sum(differences) / len(differences) if differences else None, "native_only_strict_wins": wins, "composite_only_strict_wins": losses, "paired_prompt_bootstrap_95_interval": [samples[125], samples[4874]] if samples else None, "uncertainty_warning": "Three unique prompts give coarse uncertainty. A zero-width interval does not establish equivalence."}


def load_manifest(path):
    value = json.loads(path.read_text())
    if value.get("manifest_sha256") != m.core.digest({k: v for k, v in value.items() if k != "manifest_sha256"}):
        raise ValueError("The provider manifest hash is invalid")
    provider, plan = value["provider"], m.run_plan()
    if provider not in m.PROVIDERS or value["run_id"] != m.RUN_ID or value["run_plan_sha256"] != plan["sha256"]:
        raise ValueError("The provider manifest does not match the diagnostic")
    schedule = m.jobs(provider)
    if len(value["results"]) != len(schedule):
        raise ValueError("The provider schedule is incomplete")
    for row, job in zip(value["results"], schedule):
        expected = {**{key: job[key] for key in ("planned_sequence", "arm", "family", "variant", "repeat")}, "task_sha256": job["task"]["sha256"]}
        if any(row.get(key) != item for key, item in expected.items()):
            raise ValueError("The provider row does not match its task")
        score = row["initial"].get("score")
        if score is not None:
            call = row["initial_call"]
            if call["prompt_sha256"] != m.core.sha256_text(m.prompt_for(job)):
                raise ValueError("The provider prompt changed")
            payload = call["response_payload"]
            if call["response_payload_sha256"] != m.core.sha256_text(payload):
                raise ValueError("The response payload hash is invalid")
            actual = m.score_response(job["arm"], job["task"], payload if call["outer_schema_valid"] else "")
            if actual != score:
                raise ValueError("The provider score does not reproduce")
    return value


def assess(runs):
    if len({run["provider"] for run in runs}) != len(runs):
        raise ValueError("Do not combine multiple runs from one provider")
    providers = {}
    for run in runs:
        rows = run["results"]
        sentinels = []
        for repeated in (row for row in rows if row["repeat"] == 2):
            first = next(row for row in rows if row["repeat"] == 1 and row["arm"] == repeated["arm"] and row["task_sha256"] == repeated["task_sha256"])
            a, b = first["initial"].get("score"), repeated["initial"].get("score")
            available = a is not None and b is not None
            sentinels.append({"arm": repeated["arm"], "family": repeated["family"], "complete_pair": available, "component_outcome_equal": a["cases"] == b["cases"] if available else None, "payload_equal": first["initial_call"].get("response_payload") == repeated["initial_call"].get("response_payload") if available else None})
        providers[run["provider"]] = {"progress": run["progress"], "cost_exact_usd": run["actual_cost_exact_usd"], "pairs": {name: {family: paired(rows, name, family) for family in m.FAMILIES} for name in m.formats.FORMATS}, "sentinels": sentinels}
    return m.signed({"schema": "ghostnote-native-composite-assessment-v1", "run_id": m.RUN_ID, "baseline_sha256": m.BASELINE_HASH, "source_manifest_sha256": [run["manifest_sha256"] for run in runs], "providers": providers, "measured_cost_exact_usd": str(sum(Decimal(str(run["actual_cost_exact_usd"])) for run in runs)), "interpretation": "Report each provider, family, and format pair. Sentinels are separate. Do not pool with v5 or infer full native-format capability or training familiarity. No product selection is automatic."})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifests", nargs="+", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    m.write_new(assess([load_manifest(path) for path in args.manifests]), args.output)


if __name__ == "__main__":
    main()
