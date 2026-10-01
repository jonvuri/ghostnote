#!/usr/bin/env python3
"""Create fresh tasks under the shared native field contract."""

from copy import deepcopy
from fractions import Fraction
from pathlib import Path

from formats import load, normalize, project


ROOT = Path(__file__).resolve().parent
prior = load("ghostnote_native_composite_suite_prior", ROOT.parent / "symbolic-format-v5/suite.py")
core = prior.core
FAMILIES = prior.DECISION_FAMILIES[:6]
COHORT = "native-composite-diagnostic-r1"
SEED = 401009
COUNT = 3


def shift_notes(notes, offset):
    for note in notes:
        note["start"] = core.fraction_text(Fraction(note["start"]) + offset)


def make_corpus():
    source = prior.make_corpus(COHORT, SEED, 6000)
    fixtures = {}
    for family in FAMILIES:
        fixtures[family] = []
        for index, source_task in enumerate(source["fixtures"][family][:COUNT]):
            task = deepcopy(source_task)
            offset = Fraction(index + 1, 7)
            notes = prior.source_notes(task)
            shift_notes(notes, offset)
            if family in {"comprehension-structure", "continuation-motif"}:
                shift_notes(task["expected"], offset)
            if family == "continuation-motif":
                task["contract"].pop("output_ids")
                for rule in task["contract"]["voice_rules"].values():
                    rule["output_start"] = core.fraction_text(Fraction(rule["output_start"]) + offset)
            elif family == "comprehension-analysis":
                groups = task["contract"]["chord_groups"]
                by_id = {note["id"]: note for note in notes}
                for case, group in enumerate(groups, 1):
                    selected = [by_id[note_id] for note_id in group["note_ids"]]
                    group.clear()
                    group.update({"case": case, "voice": "keys", "start_min": min((Fraction(n["start"]) for n in selected)), "start_max": max((Fraction(n["start"]) for n in selected))})
                    group["start_min"] = str(group["start_min"])
                    group["start_max"] = str(group["start_max"])
                task["expected"]["chord_ids"] = [f"case-{case}" for case in range(1, len(groups) + 1)]
            elif family in {"generation-progression", "generation-melody", "continuation-roles"}:
                contract = task["contract"]
                key = "chord_starts" if family == "generation-progression" else "starts"
                contract[key] = [str(Fraction(start) + offset) for start in contract[key]]
                if family != "generation-melody":
                    contract["duration"] = "1"
                else:
                    contract.pop("strong_beat_chord_pitch_classes")
            task["native_offset"] = str(offset)
            task["source"] = normalize(notes)
            if isinstance(task.get("expected"), list):
                task["expected"] = normalize(task["expected"])
            task = prior.v3.refresh_task(task)
            fixtures[family].append(task)
    value = {"schema": "ghostnote-native-composite-corpus-v1", "cohort": COHORT, "license": "MIT", "fixtures": fixtures}
    value["sha256"] = core.digest(value)
    return value


def expected_notes(task):
    if isinstance(task.get("expected"), list):
        return task["expected"]
    contract = deepcopy(task["contract"])
    if task["family"] == "generation-melody":
        contract["strong_beat_chord_pitch_classes"] = contract["scale_pitch_classes"]
    notes = prior.expected_notes({**task, "contract": contract})
    if task["family"] == "generation-progression":
        shift_notes(notes, Fraction(task["native_offset"]))
    return normalize(notes)


def instruction(task):
    family, contract = task["family"], task.get("contract", {})
    if family == "comprehension-structure":
        return "Reconstruct every source note. Preserve voice, start, duration, and pitch. Return exactly the source note count."
    if family == "continuation-motif":
        return (
            "Apply the voice rules to every source note. For each voice, first_voice_start is its earliest source start. "
            "Calculate pitch=2*axis-source_pitch+semitones, start=output_start+(source_start-first_voice_start)*rhythmic_factor, "
            "and duration=source_duration*rhythmic_factor. Preserve voice. Return only the calculated notes, with exactly the source note count. "
            f"Rules: {core.canonical(contract['voice_rules'])}"
        )
    if family == "comprehension-analysis":
        text = core.analysis_instruction(task)
        text = text.replace("Input note columns are id (opaque identity), voice (lane), start and duration (beats as rational values), pitch (MIDI 0 through 127), and velocity (MIDI attack velocity). Use chord_groups to select the notes for each chord.", "Use native named voices and exact beat positions. Select each chord group by its voice and inclusive start_min/start_max interval. Report case-1, case-2, and case-3 in chord_ids. These are answer case labels.")
        return text
    if family == "generation-progression":
        return "Create exactly 16 notes: one bass, tenor, alto, and soprano at each chord start. Use only the listed pitch classes and cover every listed class. Keep bass < tenor < alto < soprano. Use the stated bass pitch class, ranges, duration, and total same-voice movement limit. Multiple valid voicings are allowed. Contract: " + core.canonical(contract)
    if family == "generation-melody":
        return "Create exactly eight lead notes. Use the exact starts and durations. Meet the range, scale, cadence, and motif requirements. The last four pitches equal the first four plus motif_transposition. Contract: " + core.canonical(contract)
    return "Continue with exactly four bass and four lead notes. Use one note per role at each start and the exact duration. Meet all harmony, range, leap, collision, and lead cadence requirements. Return only the continuation. Contract: " + core.canonical(contract)


def constraint_checks(task, notes):
    family, contract = task["family"], task["contract"]
    adapted = deepcopy(contract)
    if family == "generation-melody":
        adapted["strong_beat_chord_pitch_classes"] = contract["scale_pitch_classes"]
    checks = prior.constraint_checks({**task, "contract": adapted}, notes)
    if family == "generation-melody":
        checks.pop("strong_beat_harmony")
        checks["lead_voice"] = bool(notes) and all(n["voice"] == "lead" for n in notes)
    else:
        checks["exact_note_count"] = len(notes) == (16 if family == "generation-progression" else 8)
        checks["duration"] = bool(notes) and all(n["duration"] == contract["duration"] for n in notes)
    if family == "generation-progression":
        starts = contract["chord_starts"]
        checks["listed_pitch_classes_only"] = all(n["start"] in starts and n["pitch"] % 12 in contract["pitch_classes"][starts.index(n["start"])] for n in notes)
        checks["strict_voice_order"] = all(
            len(rows := [n for n in notes if n["start"] == start]) == 4
            and len(set(n["pitch"] for n in rows)) == 4
            for start in starts
        )
    if family == "continuation-roles":
        checks["exact_role_rhythm"] = all(sorted(n["start"] for n in notes if n["voice"] == voice) == sorted(contract["starts"]) for voice in ("bass", "lead"))
    return checks if notes else {name: False for name in checks}


def musical_content(task):
    """Hash actual musical values instead of synthetic fixture metadata."""
    contract = deepcopy(task.get("contract", {}))
    for name in ("output_ids", "chord_groups"):
        contract.pop(name, None)
    contract.pop("strong_beat_chord_pitch_classes", None)
    contract.pop("duration", None)
    return core.digest({"family": task["family"], "source": project(prior.source_notes(task)), "contract": contract})


def freshness(corpus):
    current = [musical_content(task) for values in corpus["fixtures"].values() for task in values]
    histories = {"compact-format-v19": prior.v19.make_corpus(), "symbolic-format-v3": prior.v3.make_corpus(), "symbolic-format-v4": prior.v4.make_corpus(), "symbolic-format-v5": prior.make_corpus()}
    historical = {musical_content(task) for old in histories.values() for family, values in old["fixtures"].items() if family in FAMILIES for task in values}
    return {"unique_tasks": len(set(current)), "internal_duplicates": len(current) - len(set(current)), "historical_overlap": len(set(current) & historical), "historical_packages": list(histories), "historical_musical_sha256": core.digest(sorted(historical)), "current_musical_sha256": core.digest(sorted(current))}
