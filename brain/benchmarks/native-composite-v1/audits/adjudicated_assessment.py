#!/usr/bin/env python3
"""Build a separate assessment from retained notation adjudications."""

import argparse
from collections import Counter
from copy import deepcopy
from fractions import Fraction
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
import verify

m = verify.benchmark
report = verify.observer.report
ROOT = Path(__file__).resolve().parent
POLICY_PATH = ROOT / "adjudication-policy.json"
ASSESSMENT_PATH = ROOT / "adjudicated-assessment.json"
REPORT_PATH = ROOT / "adjudicated-report.md"
NOTE_FIELDS = ("independently_decoded_notes", "decoded_notes", "full_grammar_notation_notes", "full_grammar_decoded_notes", "independently_decoded_notation_notes", "decoded_notation_notes")
COMPONENT_FIELDS = ("counterfactual_components", "full_grammar_counterfactual_component", "full_grammar_notation_component", "full_grammar_component", "full_grammar_notation_credit", "full_grammar_components")
METHODS = {
    "abc-2.1": "Agent interpretation of public grammar; no compiler.",
    "lilypond-2.24.4": "Agent interpretation of public grammar and source rules; no compiler.",
    "musicxml-4.0": "Official 4.0 XSD validation and independent event decoding, with agent review.",
    "strudel-v1.2": "Official pinned 1.2 runtime event decoding, with agent review.",
}


def signed_read(path, field="sha256"):
    value = json.loads(path.read_text())
    if value.get(field) != m.core.digest({k: v for k, v in value.items() if k != field}):
        raise ValueError(f"Invalid artifact hash: {path.name}")
    return value


def score_adjudication(task, case):
    raw_notes = verify.first(case, NOTE_FIELDS)
    complete = raw_notes is not None and case.get("full_grammar_complete_decode") is not False and case.get("complete_note_decode") is not False
    notes = [{"id": f"audit-{index}", "velocity": 84, **note} for index, note in enumerate(raw_notes or [], 1)] if complete else []
    score = m.score_notes(task, notes, structural=complete, canonical=False,
                          error=None if complete else "The audit has no complete valid-document decode.")
    expected = verify.first(case, COMPONENT_FIELDS)
    if score["component"] != expected:
        raise ValueError("The audited musical components do not reproduce")
    return notes, complete, score


def musical_summary(scores):
    correct = sum(score["component"]["case_correct"] for score in scores)
    planned = sum(score["component"]["case_planned"] for score in scores)
    return {"prompts": len(scores), "component_correct": correct, "component_planned": planned,
            "component_accuracy": correct / planned if planned else None,
            "mean_prompt_accuracy": float(sum(Fraction(score["component"]["case_correct"], score["component"]["case_planned"]) for score in scores) / len(scores)) if scores else None,
            "strict_musical_passes": sum(score["component"]["case_correct"] == score["component"]["case_planned"] for score in scores)}


def paired_view(rows, name, family):
    value = report.paired(rows, name, family)
    indexed = {(row["task_sha256"], row["arm"]): row["initial"].get("score") for row in rows if row["repeat"] == 1 and row["family"] == family and row["arm"].startswith(name + "-")}
    differences = []
    for task_hash in sorted({key[0] for key in indexed}):
        left, right = (indexed.get((task_hash, name + "-" + condition)) for condition in ("native", "composite"))
        if left is not None and right is not None:
            differences.append(Fraction(left["component"]["case_correct"], left["component"]["case_planned"]) - Fraction(right["component"]["case_correct"], right["component"]["case_planned"]))
    rng = report.random.Random(8127)
    samples = sorted(sum(rng.choice(differences) for _ in differences) / len(differences) for _ in range(5000)) if differences else []
    value["native_minus_composite_mean_prompt_accuracy"] = float(sum(differences) / len(differences)) if differences else None
    value["paired_prompt_bootstrap_95_interval"] = [float(samples[125]), float(samples[4874])] if samples else None
    for condition in ("native", "composite"):
        value[condition] = {key: value[condition][key] for key in ("prompts", "component_correct", "component_planned", "component_accuracy", "mean_prompt_accuracy", "strict_musical_passes")}
    value["score_input"] = "Unchanged deterministic analysis answer" if family == "comprehension-analysis" else "Audited notation values in both conditions"
    value["uncertainty_warning"] += " This interval conditions on the audit judgments. It does not measure adjudication error."
    return value


def build():
    current = verify.verify()
    verification = signed_read(ROOT / "verification.json")
    if any(verification.get(key) != value for key, value in current.items()):
        raise ValueError("The original audit verification changed")
    if verification["verifier_sha256"] != m.base.file_sha256(ROOT / "verify.py"):
        raise ValueError("The original verifier changed")
    original = signed_read(ROOT.parent / "runs/2026-09-30-assessment.json")
    loaded = {p: report.load_manifest(ROOT.parent / "runs" / f"{p}.json") for p in ("openai", "gemini")}
    by_hash = {run["manifest_sha256"]: run for run in loaded.values()}
    runs = [by_hash[digest] for digest in original["source_manifest_sha256"]]
    if report.assess(runs) != original:
        raise ValueError("The original assessment does not reproduce")
    tasks = {task["sha256"]: task for values in m.corpus()["fixtures"].values() for task in values}
    decisions = {}
    for item in current["checks"]:
        audit = json.loads((ROOT / item["artifact"]).read_text())
        for case in verify.first(audit, ("inventory", "cases")):
            key = (case["provider"], case["planned_sequence"])
            if key in decisions:
                raise ValueError("Duplicate audit decision")
            decisions[key] = (case, item)
    policy = m.signed({
        "schema": "ghostnote-native-composite-adjudication-policy-v1",
        "run_id": m.RUN_ID, "source_assessment_sha256": original["sha256"],
        "audit_verification_sha256": verification["sha256"],
        "implementation_sha256": m.base.file_sha256(Path(__file__)),
        "coverage": {"audited_unique_note_outputs": 240, "unchanged_unique_analysis_answers": 48, "excluded_sentinel_outputs": 96},
        "primary_note_score": "Score native and composite notation from the retained independent decoded notes. Report the composite ledger separately.",
        "musical_rubric": "Keep the frozen four-field matcher and task requirements, including the role partial-credit caveat. No response repair or new task requirement.",
        "invalid_or_incomplete_decode": "Use an empty note set and zero musical credit for the complete document. Known fragments remain only in the source audit.",
        "profile_compliance": "Retain the original subset structural and canonical results as separate fields. A public-grammar adjudication does not override the prompt contract.",
        "analysis": "Reuse the original deterministic score. Analysis answers were not part of the full grammar audit.",
        "sentinels": "Exclude second observations from this assessment. The original sentinel report remains available; no adjudicated repeat-stability claim.",
        "aggregation": "Recompute all 48 provider/family/format paired cells. Use exact rational prompt differences with the frozen bootstrap sampling method. Keep note-only and six-family aggregates separate.",
        "grammar_methods": METHODS,
        "limits": "Post hoc agent adjudication is evidence for these retained responses. It is not a full grammar parser for new outputs. Bootstrap intervals do not include judgment error."
    })
    records, providers, used = [], {}, set()
    for run in runs:
        provider, revised = run["provider"], []
        original_rows = [row for row in run["results"] if row["repeat"] == 1]
        for source in original_rows:
            row = deepcopy(source)
            frozen = source["initial"]["score"]
            task = tasks[source["task_sha256"]]
            record = {"provider": provider, "planned_sequence": source["planned_sequence"], "arm": source["arm"], "family": source["family"], "variant": source["variant"], "repeat": 1,
                      "task_sha256": source["task_sha256"], "prompt_sha256": source["initial_call"]["prompt_sha256"], "payload_sha256": source["initial_call"]["response_payload_sha256"],
                      "source_manifest_sha256": run["manifest_sha256"], "frozen_score_sha256": m.core.digest(frozen), "frozen_primary_component": frozen["component"],
                      "frozen_profile": {"structural_pass": frozen["structural_parse_pass"], "canonical_pass": frozen["canonical_form_pass"]}}
            if source["family"] == "comprehension-analysis":
                record.update({"score_input": "unchanged-analysis", "adjudicated_score": frozen, "audit": None})
            else:
                key = (provider, source["planned_sequence"])
                if key not in decisions:
                    raise ValueError(f"Missing notation adjudication: {key}")
                case, item = decisions[key]
                used.add(key)
                notes, complete, score = score_adjudication(task, case)
                record.update({"score_input": "audited-notation", "decoded_notes": notes, "complete_document_decode": complete,
                               "grammar_method": METHODS[item["format"]], "audit": {"artifact": item["artifact"], "sha256": item["sha256"], "case": {"provider": provider, "planned_sequence": source["planned_sequence"]}},
                               "adjudicated_score": score})
                if source["arm"].endswith("-composite"):
                    ledger = m.formats.prior.legacy.parse_ledger(source["initial_call"]["response_payload"].split(m.formats.SEPARATOR, 1)[1])
                    agreement = complete and Counter(map(verify.observer.exact_tuple, notes)) == Counter(map(verify.observer.exact_tuple, ledger))
                    score["notation_ledger_alignment"] = agreement
                    record.update({"ledger_component": frozen["component"], "notation_ledger_agreement": agreement, "frozen_notation_component": frozen["notation_musical_component"]})
                record["adjudicated_score"] = {key: value for key, value in score.items() if key not in ("canonical_form_pass", "syntax_pass")}
                row["initial"]["score"] = score
            revised.append(row)
            records.append(record)
        pairs = {name: {family: paired_view(revised, name, family) for family in m.FAMILIES} for name in m.formats.FORMATS}
        aggregates = {}
        for condition in ("native", "composite"):
            selected = [row for row in revised if row["arm"].endswith("-" + condition)]
            aggregates[condition] = {scope: musical_summary([row["initial"]["score"] for row in selected if scope == "all_unique_tasks" or (row["family"] == "comprehension-analysis") == (scope == "analysis_answers")])
                                     for scope in ("note_outputs", "analysis_answers", "all_unique_tasks")}
        ledger_scores = [row["initial"]["score"] for row in original_rows if row["arm"].endswith("-composite") and row["family"] != "comprehension-analysis"]
        aggregates["composite_ledger_note_outputs"] = musical_summary(ledger_scores)
        providers[provider] = {"pairs": pairs, "aggregates": aggregates,
                               "source_cost_exact_usd": run["actual_cost_exact_usd"],
                               "primary_outputs": len(revised), "excluded_sentinel_outputs": len(run["results"]) - len(revised)}
    if used != set(decisions) or len(records) != 288:
        raise ValueError("The assessment does not have exact audit and analysis coverage")
    for item in current["checks"]:
        for provider, expected in item["totals"].items():
            selected = [record["adjudicated_score"] for record in records if record["provider"] == provider and record["arm"] == item["format"] + "-" + item["condition"] and record["score_input"] == "audited-notation"]
            actual = musical_summary(selected)
            if (actual["component_correct"], actual["component_planned"], actual["strict_musical_passes"]) != (expected["correct"], expected["planned"], expected["full_passes"]):
                raise ValueError("The integrated assessment disagrees with the full grammar audit")
    pooled = {condition: {scope: musical_summary([r["adjudicated_score"] for r in records if r["arm"].endswith("-" + condition) and (scope == "all_unique_tasks" or (r["family"] == "comprehension-analysis") == (scope == "analysis_answers"))]) for scope in ("note_outputs", "analysis_answers", "all_unique_tasks")} for condition in ("native", "composite")}
    cell_directions = {"native_higher": 0, "composite_higher": 0, "tied": 0}
    for provider in providers.values():
        for families in provider["pairs"].values():
            for cell in families.values():
                delta = cell["native_minus_composite_mean_prompt_accuracy"]
                cell_directions["native_higher" if delta > 0 else "composite_higher" if delta < 0 else "tied"] += 1
    assessment = m.signed({"schema": "ghostnote-native-composite-adjudicated-assessment-v1", "run_id": m.RUN_ID,
                           "policy_sha256": policy["sha256"], "source_assessment_sha256": original["sha256"],
                           "source_manifest_sha256": original["source_manifest_sha256"], "audit_verification_sha256": verification["sha256"],
                           "audit_artifacts": [{"artifact": item["artifact"], "sha256": item["sha256"]} for item in current["checks"]],
                           "providers": providers, "pooled": pooled, "cell_directions": cell_directions, "records": records,
                           "new_provider_calls": 0, "source_measured_cost_exact_usd": original["measured_cost_exact_usd"],
                           "interpretation": policy["limits"]})
    return policy, assessment


def render(assessment, policy):
    lines = ["# Native versus composite: adjudicated assessment", "",
             "This assessment integrates the retained full grammar audit into notation scoring.",
             "On note tasks, both conditions use notation as the primary musical score. Composite ledger",
             "scores and original profile compliance remain separate. Original results remain",
             "unchanged. This is a post hoc adjudicated assessment, with no new provider call.", "",
             "## Coverage and judgment limits", "",
             "All 240 unique note outputs have retained audit decisions. Complete decodes retain",
             "independent note values. Detailed manual reviews were targeted. Decoding used tools: the",
             "pinned Strudel 1.2 runtime and MusicXML 4.0 XSD. ABC and LilyPond judgments have",
             "no compiler certificate. Agent judgment can be wrong. The deterministic musical",
             "rubric scores these retained values; it does not establish their grammar correctness.", "",
             "The 48 unique analysis answers keep their original deterministic scores. The 96",
             "second sentinel observations are excluded. Their original report remains available.",
             "The assessment has 144 complete unique pairs across 48 provider/family/format cells.", "",
             "Invalid or incomplete complete-document decodes receive zero credit. Known fragments",
             "and repairs receive no credit. The role rubric still has its documented empty-onset",
             "harmony caveat. Profile requirements remain visible even when wider grammar recovers music.", "",
             "## Aggregates", "",
             "Component ratios weight components. Prompt means weight each prompt equally.",
             "Analysis answers and notation tasks have different observation surfaces.", "",
             "| Scope | Native components | Composite components | Native prompt mean | Composite prompt mean | Native strict | Composite strict |",
             "|---|---:|---:|---:|---:|---:|---:|"]
    for scope, label in (("note_outputs", "Five note-output families"), ("analysis_answers", "Unchanged analysis"), ("all_unique_tasks", "All six families")):
        a, b = (assessment["pooled"][condition][scope] for condition in ("native", "composite"))
        lines.append(f"| {label} | {a['component_correct']}/{a['component_planned']} ({a['component_accuracy']:.2%}) | {b['component_correct']}/{b['component_planned']} ({b['component_accuracy']:.2%}) | {a['mean_prompt_accuracy']:.2%} | {b['mean_prompt_accuracy']:.2%} | {a['strict_musical_passes']}/{a['prompts']} | {b['strict_musical_passes']}/{b['prompts']} |")
    d = assessment["cell_directions"]
    lines += ["", f"Across all 48 cells, native scores higher in {d['native_higher']}, composite in {d['composite_higher']}, and {d['tied']} tie.",
              "The analysis advantage in several composite cells remains. Those judgments were",
              "not part of the notation audit. The five-family audit result is not the six-family result.", "",
              "## Paired cells", "",
              "Differences are native minus composite prompt means. Each cell has three task",
              "pairs. The bootstrap interval uses the frozen method and conditions on the audit",
              "judgments. It does not quantify adjudication error. Coarse or zero-width intervals",
              "do not establish equivalence.", ""]
    for provider, value in sorted(assessment["providers"].items()):
        lines += [f"### {provider}", "", "| Format | Family | Native % | Composite % | Difference pp | Bootstrap 95% pp | Native strict | Composite strict |", "|---|---|---:|---:|---:|---|---:|---:|"]
        for name, families in sorted(value["pairs"].items()):
            for family, cell in sorted(families.items()):
                a, b = cell["native"], cell["composite"]
                lo, hi = cell["paired_prompt_bootstrap_95_interval"]
                lines.append(f"| {name} | {family} | {100*a['mean_prompt_accuracy']:.2f} | {100*b['mean_prompt_accuracy']:.2f} | {100*cell['native_minus_composite_mean_prompt_accuracy']:+.2f} | {100*lo:+.2f} to {100*hi:+.2f} | {a['strict_musical_passes']}/{a['prompts']} | {b['strict_musical_passes']}/{b['prompts']} |")
        lines.append("")
    lines += ["## Ledger, profile, and provenance", "",
              "The composite note ledgers retain 2433/2664 components (91.33%) and 50/120",
              "strict musical successes. Audited composite notation has 25/120 strict successes.",
              "Exact notation/ledger agreement is 38/120. These are distinct measurements.", "",
              "Every assessment record links its source manifest, response payload, prompt, task,",
              "audit artifact and case ID. It retains the original component score and subset",
              "structural/canonical flags. The notation record includes adjudicated note values",
              "and recomputed component checks. Analysis records retain their original score.", "",
              "The generator checks audit signatures and original score reproduction. It enforces",
              "exact coverage and verifies all eight audit totals. No audit judgment is inferred",
              "for an unreviewed response. Runtime or compiler authority is stated per format.", "",
              f"Policy hash: `{policy['sha256']}`.",
              f"Assessment hash: `{assessment['sha256']}`.", "",
              "- [Policy](adjudication-policy.json)", "- [Assessment and per-response scores](adjudicated-assessment.json)",
              "- [Audit synthesis](synthesis.md)", "- [Original assessment](../runs/2026-09-30-assessment.json)",
              "- [Original report](../runs/2026-09-30-report.md)", "",
              "Run `python3 -B brain/benchmarks/native-composite-v1/audits/adjudicated_assessment.py --check`",
              "from the repository root. This reproduces the policy, assessment, and report.", "",
              "## Retrospective", "",
              "Store audit note values as score inputs. Keep the original measurement, revised",
              "policy, and revised assessment separate. This permits a later deterministic parser",
              "to check adjudications without another provider run.", ""]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--check", action="store_true")
    args = parser.parse_args()
    policy, assessment = build()
    prose = render(assessment, policy)
    if args.write:
        if any(path.exists() for path in (POLICY_PATH, ASSESSMENT_PATH, REPORT_PATH)):
            raise ValueError("Do not overwrite an existing adjudicated result")
        m.write_new(policy, POLICY_PATH)
        m.write_new(assessment, ASSESSMENT_PATH)
        with REPORT_PATH.open("x") as output:
            output.write(prose)
    elif args.check:
        if signed_read(POLICY_PATH) != policy or signed_read(ASSESSMENT_PATH) != assessment or REPORT_PATH.read_text() != prose:
            raise ValueError("The adjudicated artifacts do not reproduce")
    print(json.dumps({"pass": True, "assessment_sha256": assessment["sha256"], "coverage": policy["coverage"], "pooled": assessment["pooled"], "cell_directions": assessment["cell_directions"]}, indent=2))


if __name__ == "__main__":
    main()
