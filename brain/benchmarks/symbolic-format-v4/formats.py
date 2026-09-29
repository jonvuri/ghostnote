#!/usr/bin/env python3
"""Register the eight final-matrix format adapters."""

from __future__ import annotations

import importlib.util
import math
import sys
import xml.etree.ElementTree as ET
from fractions import Fraction
from pathlib import Path
from typing import Any, Callable


PACKAGE_ROOT = Path(__file__).resolve().parent
V3_FORMATS_PATH = PACKAGE_ROOT.parent / "symbolic-format-v3" / "formats.py"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


v3 = load_module("ghostnote_symbolic_format_v4_v3_formats", V3_FORMATS_PATH)
core = v3.core
legacy = v3.legacy
FormatAdapter = v3.FormatAdapter
ParseResult = v3.ParseResult
ALL_FIELDS = v3.ALL_FIELDS
FULL_FAMILIES = v3.FULL_FAMILIES
SEPARATOR = v3.SEPARATOR
LEDGER_RULE = v3.LEDGER_RULE

REGISTRY: dict[str, FormatAdapter] = {}


def register(adapter: FormatAdapter) -> None:
    if adapter.name in REGISTRY:
        raise ValueError(f"Duplicate format adapter: {adapter.name}")
    REGISTRY[adapter.name] = adapter


def get(name: str) -> FormatAdapter:
    try:
        return REGISTRY[name]
    except KeyError as error:
        raise ValueError(f"Unknown format adapter: {name}") from error


def independent_composite_result(
    payload: str,
    score_parser: Callable[[str], list[dict[str, Any]]],
    renderer: Callable[[list[dict[str, Any]], dict[str, Any] | None], str],
) -> ParseResult:
    """Parse the notation and ledger without coupling their outcomes."""

    score_notes: list[dict[str, Any]] = []
    ledger_notes: list[dict[str, Any]] = []
    score_error: str | None = None
    ledger_error: str | None = None
    if SEPARATOR not in payload:
        return ParseResult([], False, False, False, "The side-ledger separator is missing")
    score_text, ledger_text = payload.split(SEPARATOR, 1)
    try:
        score_notes = score_parser(score_text.strip())
    except (ET.ParseError, KeyError, TypeError, ValueError) as error:
        score_error = str(error)
    try:
        ledger_notes = legacy.parse_ledger(ledger_text)
    except (KeyError, TypeError, ValueError) as error:
        ledger_error = str(error)
    structural = bool(score_notes)
    alignment = (
        structural
        and bool(ledger_notes)
        and v3.projected(score_notes) == v3.projected(ledger_notes)
    )
    canonical = (
        structural
        and alignment
        and payload.strip() == renderer(ledger_notes, None).strip()
    )
    errors = [value for value in (score_error, ledger_error) if value]
    if structural and ledger_notes and not alignment:
        errors.append("The notation and side ledger disagree")
    return ParseResult(
        ledger_notes,
        structural,
        canonical,
        alignment,
        "; ".join(errors) or None,
    )


def repaired_adapter(
    source: FormatAdapter,
    score_parser: Callable[[str], list[dict[str, Any]]],
) -> FormatAdapter:
    def parse(payload: str) -> ParseResult:
        return independent_composite_result(payload, score_parser, source.render_notes)

    return FormatAdapter(
        name=source.name,
        label=source.label,
        version=source.version,
        condition=source.condition,
        represented_fields=source.represented_fields,
        eligible_families=source.eligible_families,
        grammar=source.grammar,
        example=source.example,
        render_notes=source.render_notes,
        parse_payload=parse,
        source=source.source,
        notes=(source.notes + " The notation and ledger are parsed independently.").strip(),
    )


PITCH_STEPS = ("C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B")
PITCH_ALTERS = (0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0)


def append_note(parent: ET.Element, duration: int, pitch: int | None) -> None:
    note = ET.SubElement(parent, "note")
    if pitch is None:
        ET.SubElement(note, "rest")
    else:
        pitch_node = ET.SubElement(note, "pitch")
        pitch_class = pitch % 12
        ET.SubElement(pitch_node, "step").text = PITCH_STEPS[pitch_class]
        if PITCH_ALTERS[pitch_class]:
            ET.SubElement(pitch_node, "alter").text = str(PITCH_ALTERS[pitch_class])
        ET.SubElement(pitch_node, "octave").text = str(pitch // 12 - 1)
    ET.SubElement(note, "duration").text = str(duration)
    ET.SubElement(note, "voice").text = "1"


def render_musicxml_score(notes: list[dict[str, Any]]) -> str:
    values = core.sort_notes(notes)
    denominators = [
        v3.fraction(value[field]).denominator
        for value in values
        for field in ("start", "duration")
    ]
    divisions = math.lcm(*denominators) if denominators else 1
    root = ET.Element("score-partwise", {"version": "4.0"})
    part_list = ET.SubElement(root, "part-list")
    lanes = legacy.voice_lanes(values)
    for index, (lane_name, _lane) in enumerate(lanes, start=1):
        score_part = ET.SubElement(part_list, "score-part", {"id": f"P{index}"})
        ET.SubElement(score_part, "part-name").text = lane_name
    for index, (_lane_name, lane) in enumerate(lanes, start=1):
        part = ET.SubElement(root, "part", {"id": f"P{index}"})
        measure = ET.SubElement(part, "measure", {"number": "1", "implicit": "yes"})
        attributes = ET.SubElement(measure, "attributes")
        ET.SubElement(attributes, "divisions").text = str(divisions)
        cursor = v3.fraction(0)
        for value in lane:
            start = v3.fraction(value["start"])
            duration = v3.fraction(value["duration"])
            if start > cursor:
                append_note(measure, int((start - cursor) * divisions), None)
            append_note(measure, int(duration * divisions), value["pitch"])
            cursor = start + duration
    return ET.tostring(root, encoding="unicode", short_empty_elements=True)


def parse_musicxml_score(text: str) -> list[dict[str, Any]]:
    root = ET.fromstring(text)
    if root.tag != "score-partwise" or root.get("version") != "4.0":
        raise ValueError("The MusicXML root must be score-partwise version 4.0")
    names = {
        item.get("id"): item.findtext("part-name")
        for item in root.findall("./part-list/score-part")
    }
    if not names or any(not key or not value for key, value in names.items()):
        raise ValueError("The MusicXML part list is incomplete")
    result = []
    indexes: dict[str, int] = {}
    for part in root.findall("part"):
        part_id = part.get("id")
        lane_name = names.get(part_id)
        if lane_name is None:
            raise ValueError("A MusicXML part has no matching score-part")
        voice = lane_name.rsplit(".", 1)[0]
        indexes.setdefault(voice, 0)
        cursor = v3.fraction(0)
        divisions: int | None = None
        for measure in part.findall("measure"):
            declared = measure.findtext("./attributes/divisions")
            if declared is not None:
                divisions = int(declared)
            if not divisions or divisions <= 0:
                raise ValueError("MusicXML needs positive divisions")
            for note in measure.findall("note"):
                duration_text = note.findtext("duration")
                if duration_text is None:
                    raise ValueError("A MusicXML note has no duration")
                duration = Fraction(int(duration_text), divisions)
                if note.find("rest") is not None:
                    cursor += duration
                    continue
                pitch_node = note.find("pitch")
                if pitch_node is None:
                    raise ValueError("A MusicXML note has no pitch or rest")
                step = pitch_node.findtext("step")
                octave = pitch_node.findtext("octave")
                if step not in {"A", "B", "C", "D", "E", "F", "G"} or octave is None:
                    raise ValueError("A MusicXML pitch is incomplete")
                natural = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[step]
                alter = int(pitch_node.findtext("alter", "0"))
                pitch = (int(octave) + 1) * 12 + natural + alter
                indexes[voice] += 1
                result.append(
                    {
                        "id": f"native-{voice}-{indexes[voice]}",
                        "voice": voice,
                        "start": v3.fraction_text(cursor),
                        "duration": v3.fraction_text(duration),
                        "pitch": pitch,
                        "velocity": 84,
                    }
                )
                cursor += duration
    if not result:
        raise ValueError("The MusicXML payload has no notes")
    return core.sort_notes(result)


def musicxml_adapter() -> FormatAdapter:
    def render(notes: list[dict[str, Any]], _metadata: dict[str, Any] | None) -> str:
        return v3.composite_payload(render_musicxml_score(notes), notes)

    def parse(payload: str) -> ParseResult:
        return independent_composite_result(payload, parse_musicxml_score, render)

    example_notes = [
        {"id": "n1", "voice": "lead", "start": "0", "duration": "1", "pitch": 60, "velocity": 84}
    ]
    return FormatAdapter(
        name="musicxml-4.0-composite",
        label="MusicXML",
        version="4.0",
        condition="composite",
        represented_fields=ALL_FIELDS,
        eligible_families=FULL_FAMILIES,
        grammar=(
            "Use MusicXML 4.0 score-partwise XML. Use one score-part and part for "
            "each overlap-safe voice lane. Use one implicit measure per part. "
            "Declare exact divisions per quarter note. Represent gaps as rests. "
            + LEDGER_RULE
        ),
        example=render(example_notes, None),
        render_notes=render,
        parse_payload=parse,
        source="https://www.w3.org/2021/06/musicxml40/",
        notes="The pinned subset uses semantic duration elements. It omits display-only note types.",
    )


for name in ("compact-bar-fields", "compact-bar-local-labels", "exact-object-json"):
    register(v3.get(name))

register(repaired_adapter(v3.get("abc-2.1-composite"), legacy.parse_abc))
register(repaired_adapter(v3.get("strudel-v1.2-composite"), v3.parse_strudel_score))
register(repaired_adapter(v3.get("lilypond-2.24.4-composite"), v3.parse_lilypond_score))
register(musicxml_adapter())
register(
    repaired_adapter(
        v3.get("midi-like-ghostnote-profile"),
        legacy.parse_midi_like,
    )
)
