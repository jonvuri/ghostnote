#!/usr/bin/env python3
"""Check native timing, shared scoring, pairing, and the approval boundary."""

import json
import tempfile
import unittest
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
from unittest.mock import patch

import benchmark as m
import report


class DiagnosticTests(unittest.TestCase):
    def test_all_references_and_sources(self):
        screen = m.deterministic_screen()
        self.assertTrue(screen["all_checks_pass"], {k: v for k, v in screen["checks"].items() if not v})

    def test_exact_fields_and_extra_missing_notes(self):
        task = m.corpus()["fixtures"]["continuation-motif"][0]
        reference = m.suite.expected_notes(task)
        perfect = m.score_notes(task, reference)["component"]
        for field in m.formats.FIELDS:
            notes = deepcopy(reference)
            notes[0][field] = {"voice": "other", "start": "99", "duration": "99", "pitch": 127}[field]
            score = m.score_notes(task, notes)["component"]
            self.assertEqual(score["case_planned"], perfect["case_planned"])
            self.assertEqual(score["case_correct"], perfect["case_correct"] - 1)
        extra = m.score_notes(task, reference + [reference[0]])
        self.assertFalse(extra["cases"][-1]["components"]["exact_note_count"])
        self.assertLess(m.score_notes(task, reference[:-1])["component"]["case_correct"], perfect["case_correct"])
        renamed = [{**n, "id": "renamed", "velocity": 1} for n in reference]
        self.assertEqual(m.score_notes(task, renamed)["component"], perfect)

    def test_many_wrong_notes_and_global_assignment(self):
        task = m.corpus()["fixtures"]["comprehension-structure"][0]
        wrong = [{"id": f"wrong-{index}", "voice": "other", "start": "99", "duration": "99", "pitch": 127, "velocity": 1} for index in range(80)]
        score = m.score_notes(task, wrong)
        self.assertEqual(score["component"]["case_correct"], 0)
        expected = [{"id": "a", "voice": "lead", "start": "0", "duration": "1", "pitch": 60}, {"id": "b", "voice": "bass", "start": "0", "duration": "1", "pitch": 62}]
        actual = [{**expected[0], "pitch": 62}, {**expected[0], "duration": "2"}]
        cases = m.exact_cases(expected, actual)
        self.assertEqual(sum(case["correct"] for case in cases), 6)

    def test_empty_constraints_and_prompt_contract_mutations(self):
        for family in ("generation-progression", "generation-melody", "continuation-roles"):
            task = m.corpus()["fixtures"][family][0]
            self.assertFalse(any(m.suite.constraint_checks(task, []).values()))
            notes = m.suite.expected_notes(task)
            self.assertTrue(all(m.suite.constraint_checks(task, notes).values()))
            notes[0]["pitch"] = 127
            self.assertFalse(all(m.suite.constraint_checks(task, notes).values()))
            notes = m.suite.expected_notes(task)
            notes[0]["duration"] = "99"
            self.assertFalse(all(m.suite.constraint_checks(task, notes).values()))
            notes = m.suite.expected_notes(task)
            notes[0]["voice"] = "other"
            self.assertFalse(all(m.suite.constraint_checks(task, notes).values()))

    def test_strudel_weights_and_slow_are_native_time(self):
        text = 'setcpm(60)\nlead_1: note("~@1 c4@2 d4@1").slow(3/2).sound("piano")'
        notes = m.formats.parse_strudel(text)
        self.assertEqual([(n["start"], n["duration"]) for n in notes], [("3/2", "3"), ("9/2", "3/2")])
        notes = m.formats.parse_strudel(text.replace("slow(3/2)", "slow(3)"))
        self.assertEqual(notes[0]["start"], "3")
        self.assertEqual(notes[0]["duration"], "6")
        with self.assertRaises(ValueError):
            m.formats.parse_strudel(text + '\nlead_1: note("c4@1").slow(1).sound("piano")')

    def test_native_rejects_ledger_and_composite_recovers_music(self):
        task = m.corpus()["fixtures"]["continuation-motif"][0]
        for name in m.formats.FORMATS:
            payload = m.perfect_payload(name + "-composite", task)
            self.assertFalse(m.formats.parse(name + "-native", payload).structural)
            notation, ledger = payload.split(m.formats.SEPARATOR)
            parsed = m.formats.parse(name + "-composite", "invalid\n" + m.formats.SEPARATOR + ledger)
            self.assertFalse(parsed.structural)
            self.assertEqual(m.formats.project(parsed.notes), m.formats.project(m.suite.expected_notes(task)))
            score = m.score_response(name + "-composite", task, "invalid\n" + m.formats.SEPARATOR + ledger)
            self.assertEqual(score["component"]["correct"], score["component"]["planned"])

    def test_abc_natural_after_accidental(self):
        notes = [{"voice": "lead", "start": "0", "duration": "1", "pitch": 61}, {"voice": "lead", "start": "1", "duration": "1", "pitch": 60}]
        text = m.formats.render_abc(notes)
        self.assertIn("^C12 =C12", text)
        self.assertEqual(m.formats.project(m.formats.parse_abc(text)), m.formats.project(notes))

    def test_analysis_group_selection_and_no_identity_score(self):
        for task in m.corpus()["fixtures"]["comprehension-analysis"]:
            for group in task["contract"]["chord_groups"]:
                selected = [n for n in task["source"] if n["voice"] == group["voice"] and Fraction(group["start_min"]) <= Fraction(n["start"]) <= Fraction(group["start_max"])]
                self.assertIn(len(selected), (3, 4))
            self.assertNotIn("note_ids", m.suite.instruction(task))
            score = m.score_response("abc-2.1-native", task, m.perfect_payload("abc-2.1-native", task))
            self.assertTrue(all("chord_ids" not in case["components"] for case in score["cases"]))

    def test_affine_reference_follows_native_source_rules(self):
        for task in m.corpus()["fixtures"]["continuation-motif"]:
            expected = []
            for note in task["source"]:
                rule = task["contract"]["voice_rules"][note["voice"]]
                first = min(Fraction(n["start"]) for n in task["source"] if n["voice"] == note["voice"])
                factor = Fraction(rule["rhythmic_factor"])
                expected.append({**note, "pitch": 2 * rule["axis"] - note["pitch"] + rule["semitones"], "start": str(Fraction(rule["output_start"]) + (Fraction(note["start"]) - first) * factor), "duration": str(Fraction(note["duration"]) * factor)})
            self.assertEqual(m.formats.project(expected), m.formats.project(m.suite.expected_notes(task)))

    def test_negative_rest_and_zero_denominator_are_rejected(self):
        notes = [{"voice": "lead", "start": "1", "duration": "1", "pitch": 60}]
        lily = m.formats.render_lilypond(notes).replace("r4*1", "r4*-1")
        self.assertFalse(m.formats.parse("lilypond-2.24.4-native", lily).structural)
        for name in ("abc-2.1", "lilypond-2.24.4", "strudel-v1.2"):
            payload = m.formats.render(name + "-composite", notes)
            broken = payload.replace("z12", "z12/0").replace("r4*1", "r4*1/0").replace("slow(1/2)", "slow(1/0)")
            parsed = m.formats.parse(name + "-composite", broken)
            self.assertFalse(parsed.structural)
            self.assertEqual(m.formats.project(parsed.notes), m.formats.project(notes))

    def test_pairing_excludes_missing_and_sentinels(self):
        family, name = "continuation-motif", "abc-2.1"
        rows = []
        for job in m.jobs("openai"):
            if job["family"] != family or not job["arm"].startswith(name):
                continue
            score = m.score_response(job["arm"], job["task"], m.perfect_payload(job["arm"], job["task"]))
            rows.append({**job, "task_sha256": job["task"]["sha256"], "initial": {"score": score}})
        self.assertEqual(report.paired(rows, name, family)["complete_pairs"], 3)
        next(row for row in rows if row["repeat"] == 1)["initial"] = {"kind": "unavailable"}
        result = report.paired(rows, name, family)
        self.assertEqual(result["complete_pairs"], 2)
        self.assertEqual(result["incomplete_pairs"], 1)
        self.assertEqual(result["native_minus_composite_mean_prompt_accuracy"], 0)

    def test_approval_blocks_before_environment_and_network(self):
        runner = m.configure_runner()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "approval.json"
            path.write_text('{}')
            with patch.object(runner.transport, "load_env", side_effect=AssertionError("Environment accessed")), patch.object(runner, "network_preflight", side_effect=AssertionError("Network accessed")):
                with self.assertRaisesRegex(ValueError, "Approval"):
                    runner.run_provider("openai", Path(directory) / "missing.env", path)

    def test_approval_requires_exact_hashes_and_operator_statement(self):
        plan = m.run_plan()
        approved = {"run_id": m.RUN_ID, "protocol_sha256": plan["protocol_sha256"], "run_plan_sha256": plan["sha256"], "cohort_sha256": plan["cohort_sha256"], "candidate_sha256": plan["candidate_sha256"], "schedule_sha256": plan["schedule_sha256"], "maximum_total_cost_usd": float(m.TOTAL_LIMIT), "status": "approved", "operator_statement": "Synthetic test only"}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "approval.json"
            path.write_text(json.dumps(approved))
            self.assertEqual(m.validate_approval(path), approved)
            for field in approved:
                invalid = {**approved, field: None}
                path.write_text(json.dumps(invalid))
                with self.assertRaises(ValueError):
                    m.validate_approval(path)

    def test_cost_and_model_guard_with_mock_transport(self):
        runner = m.prior.v14
        guard = runner.CostGuard("openai")
        reservation = guard.authorize_message(100)
        guard.retain_failed_reservation()
        self.assertEqual(guard.committed_cost, reservation)
        guard.committed_cost = m.LIMITS["openai"]
        with self.assertRaises(runner.CostBudgetExceeded):
            guard.authorize_message(100)
        job = m.jobs("openai")[0]
        raw = {"id": "mock", "model": "wrong-model", "choices": [{"finish_reason": "stop", "message": {"content": json.dumps({"payload": m.perfect_payload(job['arm'], job['task'])})}}], "usage": {"prompt_tokens": 1, "completion_tokens": 1}}
        with patch.object(runner.transport, "post_json", return_value=raw):
            with self.assertRaisesRegex(runner.ProviderCompletedError, "model"):
                runner.one_call("openai", "mock", job, runner.CostGuard("openai"))
        raw["model"] = m.MODELS["openai"]
        raw["choices"][0]["message"]["content"] = json.dumps({"payload": m.perfect_payload(job['arm'], job['task']), "extra": "invalid"})
        with patch.object(runner.transport, "post_json", return_value=raw):
            state, call = runner.one_call("openai", "mock", job, runner.CostGuard("openai"))
        expected = m.score_response(job["arm"], job["task"], "")["component"]
        self.assertEqual(state["score"]["component"], expected)
        self.assertFalse(call["outer_schema_valid"])


if __name__ == "__main__":
    unittest.main()
