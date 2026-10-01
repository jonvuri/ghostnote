#!/usr/bin/env python3
"""Define paired notation subsets with four common musical fields."""

from __future__ import annotations

import importlib.util
import math
import re
import sys
import xml.etree.ElementTree as ET
from fractions import Fraction
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


prior = load("ghostnote_native_composite_formats_prior", ROOT.parent / "symbolic-format-v4/formats.py")
v3 = prior.v3
core = prior.core
FIELDS = ("voice", "start", "duration", "pitch")
SEPARATOR = prior.SEPARATOR
FORMATS = ("abc-2.1", "strudel-v1.2", "lilypond-2.24.4", "musicxml-4.0")
ARMS = tuple(f"{name}-{condition}" for name in FORMATS for condition in ("native", "composite"))


def project(notes):
    return sorted(
        [tuple(note[field] for field in FIELDS) for note in notes],
        key=lambda row: (row[0], Fraction(row[1]), Fraction(row[2]), row[3]),
    )


def normalize(notes):
    """Discard fields outside the paired musical contract."""
    result = []
    for index, note in enumerate(notes, 1):
        if not re.fullmatch(r"[a-z]+", note["voice"]):
            raise ValueError("Use a lowercase musical voice name")
        start, duration = Fraction(note["start"]), Fraction(note["duration"])
        if start < 0 or duration <= 0 or not 0 <= note["pitch"] <= 127:
            raise ValueError("A note is outside the musical bounds")
        result.append({
            "id": f"event-{index}", "velocity": 84,
            "voice": note["voice"], "pitch": note["pitch"],
            "start": core.fraction_text(start), "duration": core.fraction_text(duration),
        })
    return core.sort_notes(result)


def render_abc(notes):
    text = v3.render_abc_exact(normalize(notes), None)
    # Explicit accidentals prevent carry from a preceding note in the measure.
    lines = []
    for line in text.splitlines():
        if line.endswith(" |"):
            line = " ".join("=" + token if re.match(r"[A-Ga-g]", token) else token for token in line.split())
        lines.append(line)
    return "\n".join(lines)


def parse_abc(text):
    lines = text.strip().splitlines()
    headers = ["%abc-2.1", "X:1", "T:Ghostnote generated benchmark", "L:1/48", "M:4/4", "K:C"]
    if lines[:6] != headers or len(lines[6:]) % 2:
        raise ValueError("Use the fixed ABC header and paired voice/body lines")
    lanes = []
    for index in range(6, len(lines), 2):
        lane = re.fullmatch(r"V:([a-z]+\.\d+)", lines[index])
        if not lane or lane[1] in lanes:
            raise ValueError("Use a unique ABC voice lane")
        lanes.append(lane[1])
        if not re.fullmatch(r"(?:[=_^][A-Ga-g][,']*\d+(?:/\d+)? |z\d+(?:/\d+)? )+\|", lines[index + 1]):
            raise ValueError("Use explicit accidentals, lengths, and rests")
        for token in lines[index + 1].split()[:-1]:
            duration = re.search(r"\d+(?:/\d+)?$", token)[0]
            if Fraction(duration) <= 0:
                raise ValueError("ABC lengths must be positive")
    return normalize(prior.legacy.parse_abc(text))


PITCH_NAMES = ("c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b")


def render_strudel(notes):
    values = normalize(notes)
    end = max(Fraction(n["start"]) + Fraction(n["duration"]) for n in values)
    lines = ["setcpm(60)"]
    for lane, rows in prior.legacy.voice_lanes(values):
        cursor, events = Fraction(0), []
        for note in rows:
            start, duration = Fraction(note["start"]), Fraction(note["duration"])
            if start > cursor:
                events.append(("~", start - cursor))
            events.append((PITCH_NAMES[note["pitch"] % 12] + str(note["pitch"] // 12 - 1), duration))
            cursor = start + duration
        if cursor < end:
            events.append(("~", end - cursor))
        multiplier = math.lcm(*(duration.denominator for _, duration in events))
        tokens = " ".join(f"{pitch}@{int(duration * multiplier)}" for pitch, duration in events)
        # Strudel labels are native JavaScript statements. Each label is unique.
        lines.append(f'{lane.replace(".", "_")}: note("{tokens}").slow({core.fraction_text(end / 4)}).sound("piano")')
    return "\n".join(lines)


def parse_strudel(text):
    lines = text.strip().splitlines()
    if not lines or lines[0] != "setcpm(60)":
        raise ValueError("Declare the fixed Strudel tempo")
    pattern = re.compile(r'([a-z]+)_([1-9]\d*): note\("([^"]+)"\)\.slow\((\d+(?:/\d+)?)\)\.sound\("piano"\)')
    labels, result = set(), []
    for line in lines[1:]:
        match = pattern.fullmatch(line.strip())
        if not match or (match[1], match[2]) in labels:
            raise ValueError("Use unique Strudel labels and the pinned chain")
        labels.add((match[1], match[2]))
        tokens = []
        for token in match[3].split():
            item = re.fullmatch(r"(~|[a-g]#?\d+)@([1-9]\d*)", token)
            if not item:
                raise ValueError("Use note or rest tokens with positive integer weights")
            tokens.append((item[1], int(item[2])))
        span = Fraction(match[4]) * 4
        if span <= 0:
            raise ValueError("The Strudel span must be positive")
        unit, cursor = span / sum(weight for _, weight in tokens), Fraction(0)
        for pitch, weight in tokens:
            duration = unit * weight
            if pitch != "~":
                value = re.fullmatch(r"([a-g]#?)(\d+)", pitch)
                midi = (int(value[2]) + 1) * 12 + PITCH_NAMES.index(value[1])
                result.append({"voice": match[1], "start": str(cursor), "duration": str(duration), "pitch": midi})
            cursor += duration
    return normalize(result)


def render_lilypond(notes):
    return v3.render_lilypond_score(normalize(notes))


def parse_lilypond(text):
    lines = [line.strip() for line in text.strip().splitlines()]
    if lines[:3] != ['\\version "2.24.4"', "\\score {", "<<"] or lines[-2:] != [">>", "}"]:
        raise ValueError("Use the fixed LilyPond score wrapper")
    lanes = set()
    for line in lines[3:-2]:
        match = re.fullmatch(r'\\new Voice = "([a-z]+\.[1-9]\d*)" \{ (.+) \}', line)
        if not match or match[1] in lanes:
            raise ValueError("Use a unique LilyPond Voice")
        lanes.add(match[1])
        for token in match[2].split():
            if "4*" not in token or Fraction(token.split("4*", 1)[1]) <= 0:
                raise ValueError("LilyPond durations must be positive")
    return normalize(v3.parse_lilypond_score(text))


def render_musicxml(notes):
    return prior.render_musicxml_score(normalize(notes))


def parse_musicxml(text):
    root = ET.fromstring(text)
    allowed = {"score-partwise", "part-list", "score-part", "part-name", "part", "measure", "attributes", "divisions", "note", "rest", "pitch", "step", "alter", "octave", "duration", "voice"}
    if any(item.tag not in allowed for item in root.iter()):
        raise ValueError("The MusicXML payload is outside the sequential subset")
    names = root.findall("./part-list/score-part")
    ids = [item.get("id") for item in names]
    parts = root.findall("part")
    if not ids or len(set(ids)) != len(ids) or [part.get("id") for part in parts] != ids:
        raise ValueError("The MusicXML part list must match the parts")
    lanes = [item.findtext("part-name") or "" for item in names]
    if len(set(lanes)) != len(lanes) or any(not re.fullmatch(r"[a-z]+\.[1-9]\d*", name) for name in lanes):
        raise ValueError("Use unique named MusicXML lanes")
    for part in parts:
        if len(part.findall("measure")) != 1:
            raise ValueError("Use one implicit measure per part")
        for note in part.findall("./measure/note"):
            if len(note.findall("duration")) != 1 or note.findtext("voice") != "1":
                raise ValueError("Each note needs one duration and voice 1")
            if int(note.findtext("duration")) <= 0:
                raise ValueError("MusicXML durations must be positive")
            if (note.find("pitch") is None) == (note.find("rest") is None):
                raise ValueError("Each MusicXML note needs either pitch or rest")
    return normalize(prior.parse_musicxml_score(text))


RENDERERS = dict(zip(FORMATS, (render_abc, render_strudel, render_lilypond, render_musicxml)))
PARSERS = dict(zip(FORMATS, (parse_abc, parse_strudel, parse_lilypond, parse_musicxml)))
GRAMMARS = {
    "abc-2.1": "Use the exact six-line ABC header in the example. Use V:<voice>.<lane> and one body line per lane. Use L:1/48. Write an explicit =, ^, or _ accidental on every pitched token. Write positive rational length multipliers. Use z for gaps. End each body with |.",
    "strudel-v1.2": "Use setcpm(60). Use one unique native label <voice>_<lane> per line. Use note(\"<pitch>@<positive integer weight> ...\").slow(<positive rational>).sound(\"piano\"). Use lowercase sharp note names such as c#4 and ~ for rests. All lanes start at zero. One base cycle is four beats. The line span is 4*slow. Divide that span in proportion to the weights. Include leading, internal, and trailing rests. Do not add comments.",
    "lilypond-2.24.4": "Use the exact version and score wrapper in the example. Use one \\new Voice = \"<voice>.<lane>\" per line. Use absolute lowercase sharp pitches with octave marks. Use 4*<positive rational> on every note and rest. Use r for gaps.",
    "musicxml-4.0": "Use MusicXML 4.0 score-partwise. Use one score-part and part per lane. Set part-name to <voice>.<lane>. Use one implicit measure per part. Declare positive divisions per quarter. Use sequential notes and rests, one positive duration, and voice 1. Use step, optional integer alter, and octave for pitches. Do not use chords, backup, forward, ties, or other elements.",
}
SOURCES = {
    "abc-2.1": "https://abcnotation.com/wiki/abc%3Astandard%3Av2.1",
    "strudel-v1.2": "https://strudel.cc/learn/mini-notation/",
    "lilypond-2.24.4": "https://lilypond.org/doc/v2.24/Documentation/notation/writing-rhythms",
    "musicxml-4.0": "https://www.w3.org/2021/06/musicxml40/",
}


def render(arm, notes):
    name, condition = arm.rsplit("-", 1)
    values = normalize(notes)
    score = RENDERERS[name](values)
    return score if condition == "native" else v3.composite_payload(score, values)


def parse(arm, payload):
    name, condition = arm.rsplit("-", 1)
    if condition == "composite":
        def safe_parser(text):
            try:
                return PARSERS[name](text)
            except ZeroDivisionError as error:
                raise ValueError("A notation denominator is zero") from error
        return prior.independent_composite_result(payload, safe_parser, lambda notes, _: render(arm, notes))
    try:
        if SEPARATOR in payload or "GN " in payload:
            raise ValueError("A native payload must not contain a side ledger")
        notes = PARSERS[name](payload)
        if not notes:
            raise ValueError("The native payload has no notes")
        return prior.ParseResult(notes, True, payload.strip() == render(arm, notes), None)
    except (ET.ParseError, KeyError, TypeError, ValueError, ZeroDivisionError) as error:
        return prior.ParseResult([], False, False, None, str(error))


def descriptor(arm):
    name, condition = arm.rsplit("-", 1)
    notes = [{"voice": "lead", "start": "1/2", "duration": "3/4", "pitch": 61}, {"voice": "bass", "start": "0", "duration": "1", "pitch": 48}]
    grammar = GRAMMARS[name]
    if condition == "composite":
        grammar += " " + v3.LEDGER_RULE + " Use arbitrary unique event IDs. Use velocity 84 in every ledger row."
    return {"name": arm, "condition": condition, "represented_fields": list(FIELDS), "grammar": grammar, "example": render(arm, notes), "source": SOURCES[name]}
