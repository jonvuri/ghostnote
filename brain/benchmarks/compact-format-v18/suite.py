#!/usr/bin/env python3
"""Define the reusable v18 symbolic-music task suite."""

from __future__ import annotations

import importlib.util
from collections import Counter
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent
V15_PATH = BENCHMARKS_ROOT / "compact-format-v15" / "benchmark.py"


def load_v15() -> Any:
    spec = importlib.util.spec_from_file_location(
        "ghostnote_compact_format_v18_v15", V15_PATH
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {V15_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


v15 = load_v15()
v14 = v15.v14
base = v15.base
core = v15.core
_V15_TASK_INSTRUCTION = v15.task_instruction

SCHEMA = "ghostnote-compact-format-suite-v18"
CORPUS_SCHEMA = "ghostnote-compact-format-suite-corpus-v18"
DEFAULT_COHORT = "low-effort-rehearsal-r1"
DEFAULT_SEED = 81081
DEFAULT_VARIANT_OFFSET = 400
ARMS = v15.ARMS
DECISION_FAMILIES = v15.DECISION_FAMILIES
GUARD_FAMILIES = v15.GUARD_FAMILIES
FAMILIES = (*DECISION_FAMILIES, *GUARD_FAMILIES)
UNIQUE_COUNTS = {
    "comprehension-analysis": 10,
    "continuation-affine": 10,
    "document-serialization": 2,
}
REPEATS = {family: 1 for family in FAMILIES}

ELEMENTAL = "elemental-format-isolation"
STRESS = "real-use-stress"
CONTROL = "literal-serialization-control"


def fraction_text(value: Fraction | str | int) -> str:
    return core.fraction_text(value)


def analysis_case_hashes(task: dict[str, Any]) -> list[str]:
    by_id = {row["id"]: row for row in task["source"]}
    hashes = []
    for index, group in enumerate(task["contract"]["chord_groups"]):
        rows = [by_id[note_id] for note_id in group["note_ids"]]
        base_start = Fraction(index * 4)
        hashes.append(
            core.digest(
                {
                    "chord_pitches": [row["pitch"] for row in rows],
                    "chord_starts": [
                        fraction_text(core.fraction(row["start"]) - base_start)
                        for row in rows
                    ],
                    "chord_durations": [row["duration"] for row in rows],
                    "motif_pair": task["contract"]["motif_pairs"][index],
                    "root_pc": task["expected"]["root_pcs"][index],
                    "bass_pc": task["expected"]["bass_pcs"][index],
                    "quality": task["expected"]["qualities"][index],
                    "inversion": task["expected"]["inversions"][index],
                    "function": task["expected"]["functions"][index],
                    "motif_relation": task["expected"]["motif_relations"][index],
                    "rhythm": task["expected"]["rhythms"][index],
                }
            )
        )
    return hashes


def stress_motif_pair(relation: str, index: int) -> dict[str, Any]:
    pitches = [57, 62, 60, 67, 65, 72, 68, 74]
    pitches = [pitch + index % 4 for pitch in pitches]
    starts = ["0", "1/2", "1", "3/2", "2", "5/2", "3", "7/2"]
    durations = ["1/2", "1/4", "3/4", "1/2", "1", "1/2", "1/4", "3/4"]
    after_pitches = list(pitches)
    after_starts = list(starts)
    after_durations = list(durations)
    if relation == "transposition":
        after_pitches = [pitch + 5 for pitch in pitches]
    elif relation == "inversion":
        axis = 67 + index % 4
        after_pitches = [2 * axis - pitch for pitch in pitches]
    elif relation == "retrograde-transposition":
        after_pitches = [pitch + 3 for pitch in reversed(pitches)]
    elif relation == "rhythmic-scale":
        factor = Fraction(3, 2)
        after_starts = [fraction_text(core.fraction(value) * factor) for value in starts]
        after_durations = [
            fraction_text(core.fraction(value) * factor) for value in durations
        ]
    elif relation == "rotation":
        after_pitches = pitches[1:] + pitches[:1]
    else:
        after_pitches[1] += 1
        after_pitches[5] -= 2
        after_starts[6] = "13/4"
    return {
        "a_pitches": pitches,
        "a_starts": starts,
        "a_durations": durations,
        "b_pitches": after_pitches,
        "b_starts": after_starts,
        "b_durations": after_durations,
    }


def analysis_task(
    index: int, cohort: str, variant_offset: int
) -> dict[str, Any]:
    variant = variant_offset + index
    elemental_targets = (0, 1, 2, 3, 4)
    stress_targets = (6, 9, 3, 7, 10)
    elemental = index < 5
    target = elemental_targets[index] if elemental else stress_targets[index - 5]
    case_count = 1 if elemental else 3
    # A multiple-of-12 base makes target the first template index.
    task_seed = 14400 + ((target - variant * 3) % 12)
    core.ANALYSIS_BATCH_COUNTS[cohort] = (case_count,)
    task = core.analysis_task(cohort, variant, task_seed)
    task["difficulty"] = ELEMENTAL if elemental else STRESS
    if not elemental:
        task["contract"]["motif_pairs"] = [
            stress_motif_pair(relation, index * 3 + case_index)
            for case_index, relation in enumerate(task["expected"]["motif_relations"])
        ]
        distractors = [
            core.note(
                f"an-{variant + 1}-x-{position + 1}",
                "guide" if position % 2 == 0 else "pad",
                Fraction(1, 4) + Fraction(position * 7, 4),
                Fraction(1 + position % 3, 2),
                45 + ((index * 7 + position * 11) % 34),
                60 + position,
            )
            for position in range(4)
        ]
        task["source"] = core.sort_notes([*task["source"], *distractors])
    task["case_semantic_sha256"] = analysis_case_hashes(task)
    return v15.refresh_task(task)


def voice_affine_expected(
    source: list[dict[str, Any]], contract: dict[str, Any]
) -> list[dict[str, Any]]:
    ordered = core.sort_notes(source)
    first_by_voice = {
        voice: min(
            core.fraction(row["start"])
            for row in ordered
            if row["voice"] == voice
        )
        for voice in contract["voice_rules"]
    }
    result = []
    for index, row in enumerate(ordered):
        rule = contract["voice_rules"][row["voice"]]
        pitch = 2 * rule["axis"] - row["pitch"] + rule["semitones"]
        relative = core.fraction(row["start"]) - first_by_voice[row["voice"]]
        start = core.fraction(rule["output_start"]) + relative * core.fraction(
            rule["rhythmic_factor"]
        )
        duration = core.fraction(row["duration"]) * core.fraction(
            rule["rhythmic_factor"]
        )
        result.append(
            core.note(
                contract["output_ids"][index],
                row["voice"],
                start,
                duration,
                pitch,
                row["velocity"],
            )
        )
    return core.sort_notes(result)


def affine_task(
    index: int, cohort: str, seed: int, variant_offset: int
) -> dict[str, Any]:
    variant = variant_offset + UNIQUE_COUNTS["comprehension-analysis"] + index
    if index < 5:
        task = core.motif_task(cohort, variant, seed)
        task["family"] = "continuation-affine"
        task["difficulty"] = ELEMENTAL
        return v15.refresh_task(task)

    stress_index = index - 5
    starts = (Fraction(0), Fraction(1, 2), Fraction(1), Fraction(3, 2), Fraction(2), Fraction(5, 2))
    durations = (Fraction(1, 2), Fraction(1, 4), Fraction(3, 4), Fraction(1, 2), Fraction(1), Fraction(1, 2))
    voices = ("bass", "lead", "inner", "lead", "bass", "inner")
    offsets = (0, 13, 7, 17, 5, 11)
    base_pitch = 48 + stress_index
    source = core.sort_notes(
        [
            core.note(
                f"mt-src-{variant + 1}-{position + 1}",
                voices[position],
                starts[position],
                durations[position],
                base_pitch + offsets[position],
                72 + ((stress_index * 3 + position * 5) % 19),
            )
            for position in range(6)
        ]
    )
    factors = ("1", "3/2", "1/2")
    contract = {
        "operation": "voice-conditioned-affine",
        "output_ids": [
            f"mt-out-{variant + 1}-{position + 1}"
            for position in range(len(source))
        ],
        "voice_rules": {
            "bass": {
                "axis": 52 + stress_index % 3,
                "semitones": (-3, 2, -4, 3, -2)[stress_index],
                "output_start": fraction_text(Fraction(8 + stress_index, 1)),
                "rhythmic_factor": factors[stress_index % 3],
            },
            "inner": {
                "axis": 62 + stress_index % 3,
                "semitones": (4, -2, 3, -3, 5)[stress_index],
                "output_start": fraction_text(Fraction(6 + stress_index, 1)),
                "rhythmic_factor": factors[(stress_index + 1) % 3],
            },
            "lead": {
                "axis": 71 + stress_index % 3,
                "semitones": (-1, 5, -3, 4, -2)[stress_index],
                "output_start": fraction_text(Fraction(7 + stress_index, 1)),
                "rhythmic_factor": factors[(stress_index + 2) % 3],
            },
        },
    }
    task = core.finish_task(
        cohort,
        "continuation-motif",
        variant,
        {
            "source": source,
            "contract": contract,
            "expected": voice_affine_expected(source, contract),
        },
    )
    task["family"] = "continuation-affine"
    task["difficulty"] = STRESS
    return v15.refresh_task(task)


def serialization_task(
    index: int, cohort: str, seed: int, variant_offset: int
) -> dict[str, Any]:
    source = affine_task(5 + index, cohort, seed, variant_offset)
    variant = variant_offset + 20 + index
    return v15.refresh_task(
        {
            "schema": core.SCHEMA,
            "id": f"{cohort}-document-serialization-v{variant}",
            "cohort": cohort,
            "family": "document-serialization",
            "difficulty": CONTROL,
            "variant": variant,
            "origin": "Generated by Ghostnote for an MIT-licensed benchmark.",
            "license": "MIT",
            "expected": deepcopy(source["expected"]),
            "target_notes": deepcopy(source["expected"]),
        }
    )


def make_corpus(
    cohort: str = DEFAULT_COHORT,
    seed: int = DEFAULT_SEED,
    variant_offset: int = DEFAULT_VARIANT_OFFSET,
) -> dict[str, Any]:
    value = {
        "schema": CORPUS_SCHEMA,
        "cohort": cohort,
        "license": "MIT",
        "fixtures": {
            "comprehension-analysis": [
                analysis_task(index, cohort, variant_offset)
                for index in range(UNIQUE_COUNTS["comprehension-analysis"])
            ],
            "continuation-affine": [
                affine_task(index, cohort, seed, variant_offset)
                for index in range(UNIQUE_COUNTS["continuation-affine"])
            ],
            "document-serialization": [
                serialization_task(index, cohort, seed, variant_offset)
                for index in range(UNIQUE_COUNTS["document-serialization"])
            ],
        },
    }
    value["sha256"] = core.digest(value)
    return value


def task_difficulty(task: dict[str, Any]) -> str:
    return task["difficulty"]


def task_instruction(arm: str, task: dict[str, Any]) -> str:
    if task["family"] != "continuation-affine" or task_difficulty(task) == ELEMENTAL:
        return _V15_TASK_INSTRUCTION(arm, task)
    contract = task["contract"]
    rules = []
    for voice in ("bass", "inner", "lead"):
        rule = contract["voice_rules"][voice]
        rules.append(
            f"{voice}(axis={rule['axis']},semitones={rule['semitones']},"
            f"output_start={rule['output_start']},"
            f"rhythmic_factor={rule['rhythmic_factor']})"
        )
    count = len(task["source"])
    return (
        f"Apply the voice-conditioned affine operation to all {count} source "
        "events in canonical source order. Assign output IDs "
        + ",".join(contract["output_ids"])
        + " in that order. Select the rule for the source voice. Calculate "
        "pitch=(2*axis)-source_pitch+semitones. First multiply axis by 2. "
        "Then subtract source_pitch. Then add semitones. For example, axis=60, "
        "source_pitch=64, and semitones=2 gives pitch=58. Calculate "
        "start=output_start+(source_start-first_voice_start)*rhythmic_factor, "
        "where first_voice_start is the earliest source start for that voice. "
        "Calculate duration=source_duration*rhythmic_factor. Rules: "
        + "; ".join(rules)
        + ". Preserve voice and velocity. Sort the output notes canonically "
        f"after all calculations. Return only the {count} output notes."
    )


def analysis_quality_distribution(corpus: dict[str, Any]) -> dict[str, dict[str, int]]:
    result = {}
    for difficulty in (ELEMENTAL, STRESS):
        values = [
            quality
            for task in corpus["fixtures"]["comprehension-analysis"]
            if task_difficulty(task) == difficulty
            for quality in task["expected"]["qualities"]
        ]
        result[difficulty] = dict(sorted(Counter(values).items()))
    return result


def suite_screen(corpus: dict[str, Any]) -> dict[str, Any]:
    analysis = corpus["fixtures"]["comprehension-analysis"]
    affine = corpus["fixtures"]["continuation-affine"]
    elemental_analysis = [task for task in analysis if task_difficulty(task) == ELEMENTAL]
    stress_analysis = [task for task in analysis if task_difficulty(task) == STRESS]
    elemental_affine = [task for task in affine if task_difficulty(task) == ELEMENTAL]
    stress_affine = [task for task in affine if task_difficulty(task) == STRESS]
    checks = {
        "five-analysis-fixtures-per-stratum": len(elemental_analysis) == 5
        and len(stress_analysis) == 5,
        "five-affine-fixtures-per-stratum": len(elemental_affine) == 5
        and len(stress_affine) == 5,
        "elemental-analysis-has-one-case": all(
            task["contract"]["case_count"] == 1 for task in elemental_analysis
        ),
        "stress-analysis-has-three-cases": all(
            task["contract"]["case_count"] == 3 for task in stress_analysis
        ),
        "stress-analysis-reference-contracts-pass": all(
            all(core.analysis_fixture_checks(task).values()) for task in stress_analysis
        ),
        "stress-analysis-motifs-have-eight-values": all(
            len(pair["a_pitches"]) == 8
            for task in stress_analysis
            for pair in task["contract"]["motif_pairs"]
        ),
        "stress-analysis-has-four-distractors": all(
            len(task["source"])
            - sum(len(group["note_ids"]) for group in task["contract"]["chord_groups"])
            == 4
            for task in stress_analysis
        ),
        "elemental-quality-distribution-is-exact": analysis_quality_distribution(corpus)[ELEMENTAL]
        == {"major": 3, "minor": 2},
        "stress-quality-distribution-is-exact": analysis_quality_distribution(corpus)[STRESS]
        == {
            "diminished": 2,
            "dominant-seventh": 5,
            "half-diminished-seventh": 2,
            "major": 2,
            "major-seventh": 2,
            "minor": 2,
        },
        "elemental-affine-has-one-global-rule": all(
            task["contract"]["operation"] == "compound-affine"
            and "voice_rules" not in task["contract"]
            for task in elemental_affine
        ),
        "stress-affine-rules-cover-source": all(
            set(task["contract"]["voice_rules"])
            == {row["voice"] for row in task["source"]}
            for task in stress_affine
        ),
        "stress-affine-reference-formula-passes": all(
            task["expected"]
            == voice_affine_expected(task["source"], task["contract"])
            for task in stress_affine
        ),
        "stress-affine-output-requires-resort": all(
            [row["id"] for row in task["expected"]]
            != task["contract"]["output_ids"]
            for task in stress_affine
        ),
        "two-literal-controls": len(corpus["fixtures"]["document-serialization"])
        == 2,
    }
    return {
        "checks": checks,
        "analysis_quality_distribution": analysis_quality_distribution(corpus),
        "all_pass": all(checks.values()),
    }
