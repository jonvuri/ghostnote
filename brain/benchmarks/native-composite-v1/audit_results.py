#!/usr/bin/env python3
"""Build review packets without changing the frozen run or score policy."""

import argparse
from collections import Counter
from decimal import Decimal
from fractions import Fraction
from pathlib import Path

import report


m = report.m


def verify_accounting(run):
    """Verify identity and costs for scored and unavailable calls."""
    provider, plan = run["provider"], m.run_plan()
    expected = {
        "protocol_sha256": m.protocol_manifest()["sha256"],
        "screen_sha256": m.deterministic_manifest()["screen_sha256"],
        "cohort_sha256": m.corpus()["sha256"],
        "candidate_sha256": m.candidate_hashes(),
        "schedule_sha256": plan["schedule_sha256"][provider],
        "requested_model": m.MODELS[provider],
        "declared_settings": m.SETTINGS[provider],
        "effective_request_settings": m.prior.effective_request_settings(provider),
        "approval": m.validate_approval(m.APPROVAL_PATH),
    }
    if any(run.get(key) != value for key, value in expected.items()):
        raise ValueError("The retained run identity changed")
    rows = run["results"]
    runner = m.configure_runner()
    denominators = runner.denominator_summary(rows)
    if any(run["progress"][key] != denominators[key] for key in run["progress"]):
        raise ValueError("The progress counts do not reconcile")
    for field in ("started_sequence", "completed_sequence"):
        values = [row[field] for row in rows if row[field] is not None]
        if values != list(range(1, len(values) + 1)):
            raise ValueError("The realized call sequence is invalid")
    calls = []
    for row, job in zip(rows, m.jobs(provider)):
        if row["candidate_sha256"] != m.candidate_hashes()[row["arm"]]:
            raise ValueError("The row candidate changed")
        call = row.get("initial_call")
        if call is None:
            continue
        calls.append(call)
        if (call["prompt_sha256"] != m.core.sha256_text(m.prompt_for(job))
                or call["returned_model"] != m.MODELS[provider]
                or call["effective_request_settings"] != expected["effective_request_settings"]
                or call["retries"] != 0):
            raise ValueError("A retained call does not match the approved request")
        if row["initial"]["kind"] == "unavailable" and call["stop_reason"] not in ("max_tokens", "length", "MAX_TOKENS"):
            raise ValueError("An unavailable output has an unknown stop reason")
    total = sum((Decimal(str(call["cost_usd"]["total"])) for call in calls), Decimal(0))
    guard = run["cost_guard"]
    if (total != Decimal(str(run["actual_cost_exact_usd"]))
            or m.base.rounded_usd(total) != guard["settled_cost_usd"]
            or total != Decimal(str(guard["settled_exact_usd"]))
            or Decimal(str(guard["committed_cost_usd"])) > Decimal(str(m.LIMITS[provider]))
            or guard["message_attempts"] != run["progress"]["attempted"]
            or guard["token_count_attempts"] != (len(calls) if provider == "claude-haiku" else 0)
            or run["raw_run_sha256"] != m.core.digest([call["raw_response_sha256"] for call in calls])):
        raise ValueError("The retained usage or cost does not reconcile")
    return {"provider": provider, "manifest_sha256": run["manifest_sha256"], "identity_and_accounting_pass": True, "cost_exact_usd": str(total)}


def exact_tuple(note):
    return note["voice"], Fraction(note["start"]), Fraction(note["duration"]), note["pitch"]


def independent_checks(task, notes):
    """Check the task directly without the frozen component scorer."""
    family, contract = task["family"], task.get("contract", {})
    if family in {"comprehension-structure", "continuation-motif"}:
        expected = task["source"]
        if family == "continuation-motif":
            expected = []
            for note in task["source"]:
                rule = contract["voice_rules"][note["voice"]]
                first = min(Fraction(n["start"]) for n in task["source"] if n["voice"] == note["voice"])
                factor = Fraction(rule["rhythmic_factor"])
                expected.append({**note, "pitch": 2 * rule["axis"] - note["pitch"] + rule["semitones"], "start": str(Fraction(rule["output_start"]) + (Fraction(note["start"]) - first) * factor), "duration": str(Fraction(note["duration"]) * factor)})
        return {"exact_note_multiset": Counter(map(exact_tuple, notes)) == Counter(map(exact_tuple, expected))}
    if family == "generation-melody":
        ordered = sorted(notes, key=lambda note: Fraction(note["start"]))
        pitches = [n["pitch"] for n in ordered]
        return {
            "count_and_voice": len(notes) == 8 and all(n["voice"] == "lead" for n in notes),
            "rhythm": [(n["start"], n["duration"]) for n in ordered] == list(zip(contract["starts"], contract["durations"])),
            "range": bool(notes) and all(contract["range"][0] <= p <= contract["range"][1] for p in pitches),
            "scale": bool(notes) and all(p % 12 in contract["scale_pitch_classes"] for p in pitches),
            "motif": len(pitches) == 8 and all(pitches[i + 4] - pitches[i] == contract["motif_transposition"] for i in range(4)),
            "cadence": bool(pitches) and pitches[-1] % 12 == contract["cadence_pitch_class"],
        }
    key = "chord_starts" if family == "generation-progression" else "starts"
    starts = contract[key]
    voices = ("bass", "tenor", "alto", "soprano") if family == "generation-progression" else ("bass", "lead")
    groups = [[n for n in notes if n["start"] == start] for start in starts]
    density = len(notes) == len(starts) * len(voices) and all(len(group) == len(voices) and {n["voice"] for n in group} == set(voices) for group in groups)
    ranges = contract["voice_ranges"] if family == "generation-progression" else contract["ranges"]
    checks = {
        "density_and_starts": density,
        "duration": bool(notes) and all(n["duration"] == contract["duration"] for n in notes),
        "ranges": bool(notes) and all(n["voice"] in ranges and ranges[n["voice"]][0] <= n["pitch"] <= ranges[n["voice"]][1] for n in notes),
    }
    if not density:
        checks["complete_role_contract"] = False
        return checks
    pitches = [[next(n["pitch"] for n in group if n["voice"] == voice) for voice in voices] for group in groups]
    if family == "generation-progression":
        classes = contract["pitch_classes"]
        checks.update({
            "harmony": all({p % 12 for p in chord} == set(classes[i]) for i, chord in enumerate(pitches)),
            "bass_inversions": all(chord[0] % 12 == contract["bass_pitch_classes"][i] for i, chord in enumerate(pitches)),
            "strict_voice_order": all(all(a < b for a, b in zip(chord, chord[1:])) for chord in pitches),
            "movement": sum(abs(a - b) for old, new in zip(pitches, pitches[1:]) for a, b in zip(old, new)) <= contract["maximum_total_voice_leading"],
            "cadence": pitches[-1][0] % 12 == contract["key_tonic_pc"] and set(classes[-1]).issubset({p % 12 for p in pitches[-1]}),
        })
    else:
        checks.update({
            "harmony": all(all(p % 12 in contract["harmony_pitch_classes"][i] for p in chord) for i, chord in enumerate(pitches)),
            "role_leaps": all(abs(a - b) <= contract["maximum_role_leap"] for old, new in zip(pitches, pitches[1:]) for a, b in zip(old, new)),
            "collisions": all(len(set(chord)) == len(chord) for chord in pitches),
            "cadence": pitches[-1][1] % 12 == contract["cadence_pitch_class"],
        })
    return checks


def make_packets(run):
    jobs = {job["planned_sequence"]: job for job in m.jobs(run["provider"])}
    result = []
    for family in m.FAMILIES:
        for name in m.formats.FORMATS:
            pairs = []
            for task in m.corpus()["fixtures"][family]:
                rows = [row for row in run["results"] if row["repeat"] == 1 and row["task_sha256"] == task["sha256"] and row["arm"].startswith(name + "-")]
                if len(rows) != 2 or any(row["initial"].get("score") is None for row in rows):
                    continue
                rows.sort(key=lambda row: row["arm"].endswith("composite"))
                rates = [row["initial"]["score"]["component"]["case_correct"] / row["initial"]["score"]["component"]["case_planned"] for row in rows]
                pairs.append((abs(rates[0] - rates[1]), -min(rates), -task["variant"], rows))
            if not pairs:
                result.append({"provider": run["provider"], "family": family, "format": name, "available": False})
                continue
            rows = max(pairs, key=lambda pair: pair[:3])[-1]
            task = jobs[rows[0]["planned_sequence"]]["task"]
            packet = {"provider": run["provider"], "family": family, "format": name, "available": True, "variant": task["variant"], "task_sha256": task["sha256"], "task": task, "conditions": {}}
            for row in rows:
                condition = row["arm"].rsplit("-", 1)[1]
                payload, score = row["initial_call"]["response_payload"], row["initial"]["score"]
                item = {"sequence": row["planned_sequence"], "response_payload_sha256": row["initial_call"]["response_payload_sha256"], "payload": payload, "score": score}
                if family == "comprehension-analysis":
                    actual = m.prior.v15.loose_analysis(payload)
                    checks = {field: actual.get(field) == expected for field, expected in task["expected"].items() if field != "chord_ids"}
                    item.update({"actual_analysis": actual, "independent_checks": checks})
                else:
                    parsed = m.formats.parse(row["arm"], payload)
                    checks = independent_checks(task, parsed.notes)
                    item.update({"parsed_notes": parsed.notes, "parse_error": parsed.error, "independent_checks": checks})
                    if condition == "composite":
                        try:
                            notation_notes = m.formats.PARSERS[name](payload.split(m.formats.SEPARATOR, 1)[0])
                            item["notation_checks"] = independent_checks(task, notation_notes)
                        except (m.formats.ET.ParseError, KeyError, TypeError, ValueError, ZeroDivisionError) as error:
                            item["notation_error"] = str(error)
                perfect = score["component"]["case_correct"] == score["component"]["case_planned"]
                item["independent_full_pass_agrees"] = perfect == all(checks.values())
                packet["conditions"][condition] = item
            result.append(packet)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifests", nargs="+", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    runs = [report.load_manifest(path) for path in args.manifests]
    verification = [verify_accounting(run) for run in runs]
    packets = [packet for run in runs for packet in make_packets(run)]
    value = m.signed({"schema": "ghostnote-native-composite-audit-packets-v1", "source_manifest_sha256": [run["manifest_sha256"] for run in runs], "verification": verification, "selection": "Choose the largest absolute paired prompt difference in each provider/family/format cell. Break ties by lowest accuracy, then earliest variant. This is a defect audit, not a random performance sample.", "packets": packets, "independent_full_pass_disagreements": sum(not item["independent_full_pass_agrees"] for packet in packets for item in packet.get("conditions", {}).values()), "manual_review": "Pending. Independent checks do not replace manual review."})
    m.write_new(value, args.output)
    print(f"Audit packets: {len(packets)}; full-pass disagreements: {value['independent_full_pass_disagreements']}")


if __name__ == "__main__":
    main()
