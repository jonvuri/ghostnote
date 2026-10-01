#!/usr/bin/env python3
"""Check audit provenance and score the retained independent note values."""

from pathlib import Path
from collections import Counter
import json
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
FORMATS = {"abc": "abc-2.1", "lilypond": "lilypond-2.24.4", "musicxml": "musicxml-4.0", "strudel": "strudel-v1.2"}
sys.path.insert(0, str(ROOT.parent))
import benchmark as benchmark
import audit_results as observer


def first(value, names):
    for name in names:
        if name in value:
            return value[name]
    raise ValueError(f"Missing one of {names}")


def verify():
    manifests = {
        provider: json.loads((ROOT.parent / "runs" / f"{provider}.json").read_text())
        for provider in ("openai", "gemini")
    }
    for manifest in manifests.values():
        assert manifest["manifest_sha256"] == benchmark.core.digest({k: v for k, v in manifest.items() if k != "manifest_sha256"})
        observer.verify_accounting(manifest)
    tasks = {
        (task["family"], task["variant"]): task
        for values in benchmark.corpus()["fixtures"].values()
        for task in values
    }
    checked = []
    for path in sorted(ROOT.glob("*-full-grammar.json")) + sorted(ROOT.glob("*-ledger-credit.json")):
        audit = json.loads(path.read_text())
        signature = "audit_sha256" if "audit_sha256" in audit else "sha256"
        assert benchmark.core.digest({k: v for k, v in audit.items() if k != signature}) == audit[signature], path
        for name in ("source_manifest_sha256", "source_manifests"):
            if name in audit:
                assert audit[name] == {p: m["manifest_sha256"] for p, m in manifests.items()}, path
        rows = first(audit, ("inventory", "cases"))
        assert len(rows) == 30, path
        condition = "native" if "-native-" in path.name else "composite"
        expected_arm = FORMATS[path.name.split("-", 1)[0]] + "-" + condition
        seen, totals = set(), {}
        for case in rows:
            provider, sequence = case["provider"], case["planned_sequence"]
            identity = (provider, sequence)
            assert identity not in seen, (path, identity)
            seen.add(identity)
            manifest = manifests[provider]
            if "manifest_sha256" in case:
                assert case["manifest_sha256"] == manifest["manifest_sha256"], (path, identity)
            retained = next(row for row in manifest["results"] if row["planned_sequence"] == sequence)
            assert retained["repeat"] == 1 and retained["arm"] == expected_arm, (path, identity)
            assert retained["family"] != "comprehension-analysis", (path, identity)
            task = tasks[(retained["family"], retained["variant"])]
            assert case["task_sha256"] == retained["task_sha256"] == task["sha256"], (path, identity)
            assert task["sha256"] == benchmark.core.digest({k: v for k, v in task.items() if k != "sha256"}), (path, identity)
            payload_hash = first(case, ("response_payload_sha256", "payload_sha256"))
            assert payload_hash == retained["initial_call"]["response_payload_sha256"], (path, identity)
            assert benchmark.core.sha256_text(retained["initial_call"]["response_payload"]) == payload_hash, (path, identity)
            if "prompt_sha256" in case:
                assert case["prompt_sha256"] == retained["initial_call"]["prompt_sha256"], (path, identity)
            for name in ("full_payload", "response_payload"):
                if name in case:
                    assert case[name] == retained["initial_call"]["response_payload"], (path, identity)
            if "task" in case:
                assert case["task"] == task, (path, identity)
            notes = first(case, ("independently_decoded_notes", "decoded_notes", "full_grammar_notation_notes", "full_grammar_decoded_notes", "independently_decoded_notation_notes", "decoded_notation_notes"))
            component = first(case, ("counterfactual_components", "full_grammar_counterfactual_component", "full_grammar_notation_component", "full_grammar_component", "full_grammar_notation_credit", "full_grammar_components"))
            complete_decode = notes is not None and case.get("full_grammar_complete_decode") is not False and case.get("complete_note_decode") is not False
            if not complete_decode:
                notes = []
            if notes is None:
                assert component["correct"] == 0, (path, identity)
                notes = []
            notes = [{"id": f"audit-{index}", "velocity": 84, **note} for index, note in enumerate(notes, 1)]
            reproduced = benchmark.score_notes(task, notes)["component"]
            assert reproduced["correct"] == component["correct"] and reproduced["planned"] == component["planned"], (path, identity)
            checks = observer.independent_checks(task, notes)
            full_pass = component["correct"] == component["planned"]
            assert full_pass == all(checks.values()), (path, identity)
            value = totals.setdefault(provider, {"cases": 0, "correct": 0, "planned": 0, "full_passes": 0, "prompt_accuracy_sum": 0, "frozen_correct": 0})
            value["cases"] += 1
            value["correct"] += component["correct"]
            value["planned"] += component["planned"]
            value["full_passes"] += full_pass
            value["prompt_accuracy_sum"] += component["correct"] / component["planned"]
            original = retained["initial"]["score"]
            value["frozen_correct"] += original["component" if condition == "native" else "notation_musical_component"]["correct"]
            value["incomplete_or_invalid_decodes"] = value.get("incomplete_or_invalid_decodes", 0) + (not complete_decode)
            if condition == "native" and not original["structural_parse_pass"]:
                value["profile_rejections"] = value.get("profile_rejections", 0) + 1
                value["rejected_complete_decodes"] = value.get("rejected_complete_decodes", 0) + complete_decode
                value["rejected_full_passes"] = value.get("rejected_full_passes", 0) + full_pass
            if condition == "composite":
                ledger = benchmark.formats.prior.legacy.parse_ledger(retained["initial_call"]["response_payload"].split(benchmark.formats.SEPARATOR, 1)[1])
                alignment = complete_decode and Counter(map(observer.exact_tuple, notes)) == Counter(map(observer.exact_tuple, ledger))
                for name in ("full_grammar_alignment", "full_grammar_notation_ledger_agreement", "full_grammar_notation_ledger_alignment"):
                    if name in case:
                        assert case[name] == alignment, (path, identity)
                ledger_perfect = original["component"]["correct"] == original["component"]["planned"]
                value["aligned"] = value.get("aligned", 0) + alignment
                value["coherent_full_passes"] = value.get("coherent_full_passes", 0) + (alignment and full_pass)
                value["ledger_perfect_notation_fails"] = value.get("ledger_perfect_notation_fails", 0) + (ledger_perfect and not full_pass)
                value["notation_perfect_ledger_fails"] = value.get("notation_perfect_ledger_fails", 0) + (full_pass and not ledger_perfect)
                value["ledger_correct"] = value.get("ledger_correct", 0) + original["component"]["correct"]
                value["ledger_full_passes"] = value.get("ledger_full_passes", 0) + ledger_perfect
        assert all(value["cases"] == 15 and value["planned"] == 333 for value in totals.values()), path
        for case in audit.get("detailed_cases", []):
            retained = next(row for row in manifests[case["provider"]]["results"] if row["planned_sequence"] == case["planned_sequence"])
            payload = first(case, ("full_payload", "response_payload"))
            assert payload == retained["initial_call"]["response_payload"], path
            assert case["task"] == tasks[(retained["family"], retained["variant"])], path
            if "prompt_sha256" in case:
                assert case["prompt_sha256"] == retained["initial_call"]["prompt_sha256"], path
        for value in totals.values():
            value["prompt_mean"] = value.pop("prompt_accuracy_sum") / value["cases"]
        checked.append({"artifact": path.name, "sha256": audit[signature], "condition": condition, "format": expected_arm.removesuffix("-" + condition), "totals": totals})
    assert len(checked) == 8 and {(item["format"], item["condition"]) for item in checked} == {(name, condition) for name in FORMATS.values() for condition in ("native", "composite")}
    return {"audit_artifacts": len(checked), "cases": sum(sum(v["cases"] for v in item["totals"].values()) for item in checked), "checks": checked,
            "limit": "These checks verify provenance and component arithmetic. They do not prove the manual grammar judgments."}


if __name__ == "__main__":
    print(json.dumps(verify(), indent=2))
