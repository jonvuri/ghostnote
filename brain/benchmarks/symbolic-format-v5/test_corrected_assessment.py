#!/usr/bin/env python3
"""Check the v5 offline score repair against known response failures."""

from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location(
    "ghostnote_v5_corrected_assessment_test", ROOT / "corrected_assessment.py"
)
if spec is None or spec.loader is None:
    raise RuntimeError("Cannot load the corrected assessment")
corrected = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = corrected
spec.loader.exec_module(corrected)


class CorrectedAssessmentTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.rows = {}
        cls.jobs = {}
        for provider in corrected.m.PROVIDERS:
            rows, _ = corrected.retained_rows(provider)
            cls.rows[provider] = {row["planned_sequence"]: row for row in rows}
            cls.jobs[provider] = {
                job["planned_sequence"]: job for job in corrected.m.jobs(provider)
            }

    def score(self, provider: str, sequence: int) -> dict:
        return corrected.corrected_row(
            self.jobs[provider][sequence], self.rows[provider][sequence]
        )

    def test_musical_match_does_not_depend_on_id(self) -> None:
        expected = [
            {"id": "source-a", "voice": "lead", "start": "0", "duration": "1", "pitch": 60, "velocity": 84},
            {"id": "source-b", "voice": "lead", "start": "1", "duration": "1", "pitch": 62, "velocity": 84},
        ]
        actual = [{**row, "id": f"n{index}"} for index, row in enumerate(expected, 1)]
        cases, ids_preserved = corrected.exact_cases(expected, actual)
        self.assertEqual(sum(case["correct"] for case in cases), 10)
        self.assertFalse(ids_preserved)

    def test_partial_musical_error_keeps_other_fields(self) -> None:
        expected = [
            {"id": "source-a", "voice": "lead", "start": "0", "duration": "1", "pitch": 60, "velocity": 84}
        ]
        actual = [{**expected[0], "id": "n1", "pitch": 61}]
        cases, ids_preserved = corrected.exact_cases(expected, actual)
        self.assertEqual(cases[0]["correct"], 4)
        self.assertFalse(ids_preserved)

    def test_recovery_requires_exact_six_field_rows(self) -> None:
        payload = (
            "BASE\nSOURCE\nOMITS channel mute release_velocity articulation expression\n"
            "N id=n1 voice=lead start=0 duration=1 pitch=60 velocity=84"
        )
        notes = corrected.recover_compact_rows("compact-bar-local-labels", payload)
        self.assertEqual(len(notes), 1)
        self.assertEqual(notes[0]["pitch"], 60)
        self.assertEqual(
            corrected.recover_compact_rows(
                "compact-bar-local-labels", payload.replace("start=0", "bar=1 start_bar=0")
            ),
            [],
        )

    def test_frozen_id_and_metadata_examples(self) -> None:
        claude = self.score("claude-haiku", 120)
        self.assertEqual((claude["case_correct"], claude["case_planned"]), (60, 60))
        self.assertFalse(claude["expected_ids_preserved"])
        openai = self.score("openai", 521)
        self.assertEqual((openai["case_correct"], openai["case_planned"]), (40, 40))
        self.assertTrue(openai["recovered_compact_rows"])
        self.assertFalse(openai["structural"])
        self.assertFalse(openai["canonical"])

    def test_empty_constraint_and_lead_voice(self) -> None:
        empty = self.score("openai", 405)
        self.assertEqual((empty["case_correct"], empty["case_planned"]), (0, 7))
        self.assertTrue(empty["empty_constraint_response"])
        self.assertFalse(empty["lead_voice"])
        self.assertTrue(empty["structural"])
        ambiguous = self.score("gemini", 129)
        self.assertFalse(ambiguous["recovered_compact_rows"])
        self.assertEqual(ambiguous["case_correct"], 0)
        nonlead = self.score("openai", 125)
        self.assertFalse(nonlead["lead_voice"])

    def test_frozen_measurements_stay_diagnostic(self) -> None:
        for provider in corrected.m.PROVIDERS:
            for sequence, row in self.rows[provider].items():
                old = row["initial"].get("score")
                if old is None:
                    continue
                score = self.score(provider, sequence)
                self.assertEqual(score["structural"], old["structural_parse_pass"])
                self.assertEqual(score["canonical"], old["canonical_form_pass"])
                self.assertEqual(
                    (score["response_correct"], score["response_planned"]),
                    (
                        old["component"]["response_correct"],
                        old["component"]["response_planned"],
                    ),
                )
                if row["family"] in corrected.EXACT_FAMILIES:
                    previous_musical = sum(
                        passed
                        for case in old["cases"]
                        for field, passed in case["components"].items()
                        if field != "id"
                    )
                    self.assertGreaterEqual(score["case_correct"], previous_musical)
                    if (
                        score["expected_ids_preserved"]
                        and not score["recovered_compact_rows"]
                    ):
                        self.assertEqual(score["case_correct"], previous_musical)


if __name__ == "__main__":
    unittest.main()
