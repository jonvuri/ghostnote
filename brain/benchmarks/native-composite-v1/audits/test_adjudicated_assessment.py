#!/usr/bin/env python3
"""Check adjudicated coverage, channel choice, and invalid-document credit."""

import json
from pathlib import Path
import tempfile
import unittest

import adjudicated_assessment as a


class AdjudicatedAssessmentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.policy, cls.assessment = a.build()
        cls.records = {(r["provider"], r["planned_sequence"]): r for r in cls.assessment["records"]}

    def test_exact_coverage_analysis_preservation_and_sentinel_exclusion(self):
        records = list(self.records.values())
        self.assertEqual(len(records), 288)
        self.assertTrue(all(record["repeat"] == 1 for record in records))
        self.assertEqual(sum(record["score_input"] == "audited-notation" for record in records), 240)
        analysis = [record for record in records if record["score_input"] == "unchanged-analysis"]
        self.assertEqual(len(analysis), 48)
        for record in analysis:
            self.assertIsNone(record["audit"])
            self.assertEqual(a.m.core.digest(record["adjudicated_score"]), record["frozen_score_sha256"])
        for provider in self.assessment["providers"].values():
            self.assertEqual(provider["excluded_sentinel_outputs"], 48)
            self.assertEqual(sum(cell["complete_pairs"] for cells in provider["pairs"].values() for cell in cells.values()), 72)

    def test_profile_recovery_and_ledger_cannot_replace_bad_notation(self):
        recovered = self.records[("openai", 83)]
        self.assertEqual(recovered["frozen_primary_component"]["correct"], 0)
        self.assertFalse(recovered["frozen_profile"]["structural_pass"])
        self.assertEqual(recovered["adjudicated_score"]["component"]["correct"], 9)
        self.assertNotIn("canonical_form_pass", recovered["adjudicated_score"])
        self.assertNotIn("syntax_pass", recovered["adjudicated_score"])
        misleading_ledger = self.records[("openai", 45)]
        self.assertEqual(misleading_ledger["ledger_component"]["correct"], 7)
        self.assertEqual(misleading_ledger["adjudicated_score"]["component"]["correct"], 6)
        self.assertFalse(misleading_ledger["notation_ledger_agreement"])

    def test_invalid_document_does_not_gain_credit_from_known_fragments(self):
        task = a.m.corpus()["fixtures"]["continuation-roles"][0]
        case = {"independently_decoded_notes": a.m.suite.expected_notes(task), "complete_note_decode": False,
                "full_grammar_components": a.m.score_notes(task, [])["component"]}
        notes, complete, score = a.score_adjudication(task, case)
        self.assertEqual(notes, [])
        self.assertFalse(complete)
        self.assertEqual(score["component"]["correct"], 0)
        case["complete_note_decode"] = True
        with self.assertRaisesRegex(ValueError, "do not reproduce"):
            a.score_adjudication(task, case)

    def test_modified_signed_policy_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "policy.json"
            value = a.m.signed({"primary": "notation"})
            path.write_text(json.dumps(value))
            self.assertEqual(a.signed_read(path), value)
            value["primary"] = "ledger"
            path.write_text(json.dumps(value))
            with self.assertRaisesRegex(ValueError, "Invalid artifact hash"):
                a.signed_read(path)

    def test_exact_paired_tie_is_not_a_roundoff_win(self):
        cell = self.assessment["providers"]["openai"]["pairs"]["lilypond-2.24.4"]["continuation-motif"]
        self.assertEqual(cell["native"]["component_correct"], cell["composite"]["component_correct"])
        self.assertEqual(cell["native_minus_composite_mean_prompt_accuracy"], 0)
        self.assertEqual(self.assessment["cell_directions"], {"native_higher": 21, "composite_higher": 18, "tied": 9})


if __name__ == "__main__":
    unittest.main()
