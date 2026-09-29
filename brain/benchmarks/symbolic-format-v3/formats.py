#!/usr/bin/env python3
"""Register format adapters for the extensible symbolic-format matrix."""

from __future__ import annotations

import importlib.util
import json
import re
import sys
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path
from typing import Any, Callable


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent
SYMBOLIC_V1_ROOT = BENCHMARKS_ROOT / "symbolic-format-v1"
ALL_FIELDS = ("id", "voice", "start", "duration", "pitch", "velocity")
MUSICAL_FIELDS = ("voice", "start", "duration", "pitch")
FULL_FAMILIES = (
    "comprehension-structure",
    "comprehension-analysis",
    "generation-progression",
    "generation-melody",
    "continuation-motif",
    "continuation-roles",
    "transformation-local",
    "transformation-revoice",
    "transformation-rhythm",
    "document-serialization",
)
SEPARATOR = "--- GN SIDE LEDGER ---"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_legacy() -> tuple[Any, Any]:
    saved = {name: sys.modules.get(name) for name in ("corpus", "formats")}
    try:
        corpus = load_module(
            "ghostnote_symbolic_format_v3_legacy_corpus",
            SYMBOLIC_V1_ROOT / "corpus.py",
        )
        sys.modules["corpus"] = corpus
        formats = load_module(
            "ghostnote_symbolic_format_v3_legacy_formats",
            SYMBOLIC_V1_ROOT / "formats.py",
        )
        return corpus, formats
    finally:
        for name, value in saved.items():
            if value is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = value


core, legacy = load_legacy()


@dataclass(frozen=True)
class ParseResult:
    notes: list[dict[str, Any]]
    structural: bool
    canonical: bool
    alignment: bool | None
    error: str | None = None


@dataclass(frozen=True)
class FormatAdapter:
    name: str
    label: str
    version: str
    condition: str
    represented_fields: tuple[str, ...]
    eligible_families: tuple[str, ...]
    grammar: str
    example: str
    render_notes: Callable[[list[dict[str, Any]], dict[str, Any] | None], str]
    parse_payload: Callable[[str], ParseResult]
    source: str
    notes: str = ""

    def descriptor(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "label": self.label,
            "version": self.version,
            "condition": self.condition,
            "represented_fields": list(self.represented_fields),
            "eligible_families": list(self.eligible_families),
            "grammar": self.grammar,
            "example": self.example,
            "source": self.source,
            "notes": self.notes,
        }


REGISTRY: dict[str, FormatAdapter] = {}


def register(adapter: FormatAdapter) -> None:
    """Add one adapter without changing suite or scoring code."""

    if adapter.name in REGISTRY:
        raise ValueError(f"Duplicate format adapter: {adapter.name}")
    if not adapter.represented_fields:
        raise ValueError("A format adapter must represent at least one field")
    REGISTRY[adapter.name] = adapter


def get(name: str) -> FormatAdapter:
    try:
        return REGISTRY[name]
    except KeyError as error:
        raise ValueError(f"Unknown format adapter: {name}") from error


def normalized_notes(values: Any) -> list[dict[str, Any]]:
    if not isinstance(values, list):
        raise ValueError("The document notes value is not a list")
    result = []
    for row in values:
        if not isinstance(row, dict) or set(row) != set(ALL_FIELDS):
            raise ValueError("A note does not have the six required fields")
        result.append(
            {
                "id": str(row["id"]),
                "voice": str(row["voice"]),
                "start": fraction_text(row["start"]),
                "duration": fraction_text(row["duration"]),
                "pitch": int(row["pitch"]),
                "velocity": int(row["velocity"]),
            }
        )
    return core.sort_notes(result)


def compact_adapter(name: str) -> FormatAdapter:
    omits = ["channel", "mute", "release_velocity", "articulation", "expression"]
    overlays = {
        key: []
        for key in ("bars", "grooves", "harmonies", "meters", "regions", "tempos", "tracks")
    }

    def render(notes: list[dict[str, Any]], metadata: dict[str, Any] | None) -> str:
        metadata = metadata or {}
        base = metadata.get("base_sha256", "none")
        source = metadata.get("source_id", "source")
        ordered = core.sort_notes(notes)
        if name == "exact-object-json":
            return json.dumps(
                {
                    "base_sha256": base,
                    "notes": ordered,
                    "omits": omits,
                    "overlays": overlays,
                    "schema": "ghostnote-compact-format-v6",
                    "source_id": source,
                },
                sort_keys=True,
                separators=(",", ":"),
            )
        lines = [
            f"BASE {base}",
            f"SOURCE {source}",
            "OMITS " + " ".join(omits),
        ]
        if name == "compact-bar-fields":
            lines.append("FIELDS id voice start duration pitch velocity")
            lines.extend(
                f"N {row['id']} {row['voice']} {row['start']} {row['duration']} {row['pitch']} {row['velocity']}"
                for row in ordered
            )
        else:
            lines.extend(
                f"N id={row['id']} voice={row['voice']} start={row['start']} "
                f"duration={row['duration']} pitch={row['pitch']} velocity={row['velocity']}"
                for row in ordered
            )
        return "\n".join(lines)

    def parse(payload: str) -> ParseResult:
        try:
            if name == "exact-object-json":
                value = json.loads(payload)
                notes = normalized_notes(value["notes"])
                metadata = {
                    "base_sha256": value["base_sha256"],
                    "source_id": value["source_id"],
                }
                structural = (
                    value.get("schema") == "ghostnote-compact-format-v6"
                    and value.get("omits") == omits
                    and value.get("overlays") == overlays
                )
            else:
                lines = [line.strip() for line in payload.splitlines() if line.strip()]
                base = next(line[5:] for line in lines if line.startswith("BASE "))
                source = next(line[7:] for line in lines if line.startswith("SOURCE "))
                metadata = {"base_sha256": base, "source_id": source}
                if name == "compact-bar-fields":
                    pattern = re.compile(r"N (\S+) (\S+) (\S+) (\S+) (\d+) (\d+)")
                else:
                    pattern = re.compile(
                        r"N id=(\S+) voice=(\S+) start=(\S+) duration=(\S+) pitch=(\d+) velocity=(\d+)"
                    )
                rows = []
                for line in lines:
                    match = pattern.fullmatch(line)
                    if match:
                        rows.append(dict(zip(ALL_FIELDS, match.groups())))
                notes = normalized_notes(rows)
                structural = bool(notes)
            canonical = structural and payload.strip() == render(notes, metadata)
            return ParseResult(notes, structural, canonical, True)
        except (KeyError, StopIteration, TypeError, ValueError, json.JSONDecodeError) as error:
            return ParseResult([], False, False, True, str(error))

    if name == "exact-object-json":
        grammar = "Return one canonical JSON object with document metadata and six-field notes."
        example = render(
            [{"id": "n1", "voice": "lead", "start": "0", "duration": "1", "pitch": 60, "velocity": 84}],
            {"base_sha256": "example", "source_id": "example-source"},
        )
        label = "Exact object JSON"
    elif name == "compact-bar-fields":
        grammar = "Return BASE, SOURCE, OMITS, FIELDS, and canonical six-value N rows."
        example = render(
            [{"id": "n1", "voice": "lead", "start": "0", "duration": "1", "pitch": 60, "velocity": 84}],
            {"base_sha256": "example", "source_id": "example-source"},
        )
        label = "Compact bar FIELDS"
    else:
        grammar = "Return BASE, SOURCE, OMITS, and canonical locally labeled N rows."
        example = render(
            [{"id": "n1", "voice": "lead", "start": "0", "duration": "1", "pitch": 60, "velocity": 84}],
            {"base_sha256": "example", "source_id": "example-source"},
        )
        label = "Compact bar local labels"
    return FormatAdapter(
        name=name,
        label=label,
        version="v19 contract",
        condition="candidate" if name != "exact-object-json" else "control",
        represented_fields=ALL_FIELDS,
        eligible_families=FULL_FAMILIES,
        grammar=grammar,
        example=example,
        render_notes=render,
        parse_payload=parse,
        source=str(BENCHMARKS_ROOT / "compact-format-v19"),
    )


def projected(
    notes: list[dict[str, Any]], fields: tuple[str, ...] = MUSICAL_FIELDS
) -> list[dict[str, Any]]:
    return [
        {field: row[field] for field in fields}
        for row in core.sort_notes(notes)
    ]


def composite_payload(score: str, notes: list[dict[str, Any]]) -> str:
    return score + f"\n{SEPARATOR}\n" + legacy.ledger_text(notes)


def composite_result(
    payload: str,
    score_parser: Callable[[str], list[dict[str, Any]]],
    renderer: Callable[[list[dict[str, Any]], dict[str, Any] | None], str],
) -> ParseResult:
    try:
        score_text, ledger_text = payload.split(SEPARATOR, 1)
        score_notes = score_parser(score_text.strip())
        notes = legacy.parse_ledger(ledger_text)
        alignment = projected(score_notes) == projected(notes)
        if not alignment:
            raise ValueError("The external notation and side ledger disagree")
        canonical = payload.strip() == renderer(notes, None).strip()
        return ParseResult(notes, True, canonical, True)
    except (KeyError, TypeError, ValueError) as error:
        return ParseResult([], False, False, False, str(error))


def legacy_composite(
    public_name: str,
    legacy_name: str,
    label: str,
    version: str,
    grammar: str,
    example: str,
    source: str,
    notes: str = "",
) -> FormatAdapter:
    def render(values: list[dict[str, Any]], metadata: dict[str, Any] | None) -> str:
        return legacy.render_events(legacy_name, values, metadata)

    def parse(payload: str) -> ParseResult:
        try:
            values, alignment = legacy.parse_events(legacy_name, payload)
            canonical = payload.strip() == render(values, None).strip()
            return ParseResult(
                values,
                True,
                canonical,
                alignment.get("pass"),
            )
        except (KeyError, TypeError, ValueError) as error:
            return ParseResult([], False, False, False, str(error))

    return FormatAdapter(
        name=public_name,
        label=label,
        version=version,
        condition="composite",
        represented_fields=ALL_FIELDS,
        eligible_families=FULL_FAMILIES,
        grammar=grammar,
        example=example,
        render_notes=render,
        parse_payload=parse,
        source=source,
        notes=notes,
    )


def render_abc_exact(notes: list[dict[str, Any]], metadata: dict[str, Any] | None) -> str:
    """Render the ABC 2.1 subset without truncating rational durations."""

    metadata = metadata or {}
    lines = [
        "%abc-2.1",
        "X:1",
        "T:Ghostnote generated benchmark",
        "L:1/48",
        f"M:{metadata.get('meter', ['4/4'])[0]}",
        "K:C",
    ]
    for lane_name, values in legacy.voice_lanes(notes):
        cursor = Fraction(0)
        tokens = []
        for row in values:
            start = fraction(row["start"])
            duration = fraction(row["duration"])
            if start > cursor:
                tokens.append(f"z{fraction_text((start - cursor) * 12)}")
            tokens.append(f"{legacy.abc_pitch(row['pitch'])}{fraction_text(duration * 12)}")
            cursor = start + duration
        lines.extend((f"V:{lane_name}", " ".join(tokens) + " |"))
    return "\n".join(lines)


def abc_adapter() -> FormatAdapter:
    def render(notes: list[dict[str, Any]], metadata: dict[str, Any] | None) -> str:
        return composite_payload(render_abc_exact(notes, metadata), notes)

    def parse(payload: str) -> ParseResult:
        return composite_result(payload, legacy.parse_abc, render)

    return FormatAdapter(
        name="abc-2.1-composite",
        label="ABC",
        version="2.1",
        condition="composite",
        represented_fields=ALL_FIELDS,
        eligible_families=FULL_FAMILIES,
        grammar="Use ABC 2.1 with L:1/48 and rational duration multipliers. Use one V: lane for each overlapping voice lane. " + LEDGER_RULE,
        example="%abc-2.1\nX:1\nT:Ghostnote generated benchmark\nL:1/48\nM:4/4\nK:C\nV:lead.1\nC12 |\n--- GN SIDE LEDGER ---\nGN n1 lead 0 1 60 84",
        render_notes=render,
        parse_payload=parse,
        source="https://abcnotation.com/wiki/abc:standard:v2.1",
    )


PITCH_NAMES = ("c", "cs", "d", "ds", "e", "f", "fs", "g", "gs", "a", "as", "b")


def pitch_name(pitch: int) -> str:
    return f"{PITCH_NAMES[pitch % 12]}{pitch // 12 - 1}"


def parse_pitch_name(value: str) -> int:
    match = re.fullmatch(r"(cs|ds|fs|gs|as|[a-g])(\d+)", value)
    if not match:
        raise ValueError(f"Invalid pitch name: {value}")
    return (int(match[2]) + 1) * 12 + PITCH_NAMES.index(match[1])


def fraction(value: str | int | Fraction) -> Fraction:
    return core.fraction(value)


def fraction_text(value: str | int | Fraction) -> str:
    return core.fraction_text(value)


def render_strudel_score(notes: list[dict[str, Any]]) -> str:
    end = max(
        (fraction(row["start"]) + fraction(row["duration"]) for row in notes),
        default=Fraction(4),
    )
    lines = ["// Strudel v1.2.0 deterministic mini-notation subset", "setcpm(60)"]
    for lane_name, values in legacy.voice_lanes(notes):
        cursor = Fraction(0)
        tokens = []
        for row in values:
            start = fraction(row["start"])
            if start > cursor:
                tokens.append(f"~@{fraction_text((start - cursor) * 12)}")
            tokens.append(
                f"{pitch_name(row['pitch'])}@{fraction_text(fraction(row['duration']) * 12)}"
            )
            cursor = start + fraction(row["duration"])
        if cursor < end:
            tokens.append(f"~@{fraction_text((end - cursor) * 12)}")
        voice = lane_name.rsplit(".", 1)[0]
        lines.append(
            f'$: note("{" ".join(tokens)}").slow({fraction_text(end / 4)})'
            f'.sound("piano") // GN voice={voice} lane={lane_name}'
        )
    return "\n".join(lines)


def parse_strudel_score(text: str) -> list[dict[str, Any]]:
    pattern = re.compile(
        r'^\$: note\("([^"]+)"\)\.slow\(([^)]+)\)\.sound\("piano"\) '
        r'// GN voice=(\S+) lane=(\S+)$'
    )
    result = []
    indexes: dict[str, int] = {}
    for line in text.splitlines():
        match = pattern.fullmatch(line.strip())
        if not match:
            continue
        voice = match[3]
        indexes.setdefault(voice, 0)
        cursor = Fraction(0)
        for token in match[1].split():
            item = re.fullmatch(r"([^@]+)@(.+)", token)
            if not item:
                raise ValueError(f"Invalid Strudel subset token: {token}")
            duration = fraction(item[2]) / 12
            if item[1] != "~":
                indexes[voice] += 1
                result.append(
                    {
                        "id": f"native-{voice}-{indexes[voice]}",
                        "voice": voice,
                        "start": fraction_text(cursor),
                        "duration": fraction_text(duration),
                        "pitch": parse_pitch_name(item[1]),
                        "velocity": 84,
                    }
                )
            cursor += duration
    if not result:
        raise ValueError("The Strudel payload has no notes")
    return core.sort_notes(result)


LILYPOND_NAMES = ("c", "cis", "d", "dis", "e", "f", "fis", "g", "gis", "a", "ais", "b")


def lily_pitch(pitch: int) -> str:
    octave = pitch // 12 - 1
    marks = "'" * max(0, octave - 3) + "," * max(0, 3 - octave)
    return LILYPOND_NAMES[pitch % 12] + marks


def parse_lily_pitch(value: str) -> int:
    match = re.fullmatch(r"(cis|dis|fis|gis|ais|[a-g])([',]*)", value)
    if not match:
        raise ValueError(f"Invalid LilyPond pitch: {value}")
    octave = 3 + match[2].count("'") - match[2].count(",")
    return (octave + 1) * 12 + LILYPOND_NAMES.index(match[1])


def render_lilypond_score(notes: list[dict[str, Any]]) -> str:
    lines = ['\\version "2.24.4"', "\\score {", "  <<"]
    for lane_name, values in legacy.voice_lanes(notes):
        cursor = Fraction(0)
        tokens = []
        for row in values:
            start = fraction(row["start"])
            if start > cursor:
                tokens.append(f"r4*{fraction_text(start - cursor)}")
            tokens.append(
                f"{lily_pitch(row['pitch'])}4*{fraction_text(row['duration'])}"
            )
            cursor = start + fraction(row["duration"])
        lines.append(f'    \\new Voice = "{lane_name}" {{ {" ".join(tokens)} }}')
    lines.extend(("  >>", "}"))
    return "\n".join(lines)


def parse_lilypond_score(text: str) -> list[dict[str, Any]]:
    lane_pattern = re.compile(r'^\\new Voice = "([^"]+)" \{ (.*) \}$')
    token_pattern = re.compile(r"(r|(?:cis|dis|fis|gis|ais|[a-g])[',]*)4\*([^\s]+)")
    result = []
    indexes: dict[str, int] = {}
    for line in text.splitlines():
        match = lane_pattern.fullmatch(line.strip())
        if not match:
            continue
        voice = match[1].rsplit(".", 1)[0]
        indexes.setdefault(voice, 0)
        cursor = Fraction(0)
        for token in match[2].split():
            item = token_pattern.fullmatch(token)
            if not item:
                raise ValueError(f"Invalid LilyPond subset token: {token}")
            duration = fraction(item[2])
            if item[1] != "r":
                indexes[voice] += 1
                result.append(
                    {
                        "id": f"native-{voice}-{indexes[voice]}",
                        "voice": voice,
                        "start": fraction_text(cursor),
                        "duration": fraction_text(duration),
                        "pitch": parse_lily_pitch(item[1]),
                        "velocity": 84,
                    }
                )
            cursor += duration
    if not result:
        raise ValueError("The LilyPond payload has no notes")
    return core.sort_notes(result)


def make_composite_adapter(
    name: str,
    label: str,
    version: str,
    grammar: str,
    example: str,
    score_renderer: Callable[[list[dict[str, Any]]], str],
    score_parser: Callable[[str], list[dict[str, Any]]],
    source: str,
) -> FormatAdapter:
    def render(notes: list[dict[str, Any]], _metadata: dict[str, Any] | None) -> str:
        return composite_payload(score_renderer(notes), notes)

    def parse(payload: str) -> ParseResult:
        return composite_result(payload, score_parser, render)

    return FormatAdapter(
        name=name,
        label=label,
        version=version,
        condition="composite",
        represented_fields=ALL_FIELDS,
        eligible_families=FULL_FAMILIES,
        grammar=grammar,
        example=example,
        render_notes=render,
        parse_payload=parse,
        source=source,
    )


LEDGER_RULE = (
    "After the notation, write the exact separator --- GN SIDE LEDGER ---. "
    "Then write one row per note as GN id voice start duration pitch velocity. "
    "The notation and ledger must describe the same voice, start, duration, and pitch."
)


for compact_name in (
    "compact-bar-fields",
    "compact-bar-local-labels",
    "exact-object-json",
):
    register(compact_adapter(compact_name))


register(abc_adapter())
register(
    legacy_composite(
        "alda-2.4.7-composite",
        "alda-composite",
        "Alda",
        "2.4.7",
        "Use the pinned Alda subset with one named piano lane per overlapping voice lane. " + LEDGER_RULE,
        '# Ghostnote generated benchmark\npiano "lead.1": o4 c4\n--- GN SIDE LEDGER ---\nGN n1 lead 0 1 60 84',
        "https://github.com/alda-lang/alda/tree/2.4.7",
    )
)
register(
    make_composite_adapter(
        "strudel-v1.2-composite",
        "Strudel mini-notation",
        "1.2.0",
        "Use Strudel v1.2.0 code. Each stack line must use note(\"mini notation\"), "
        "@ weights, .slow(), piano, and the GN voice and lane comment. " + LEDGER_RULE,
        '// Strudel v1.2.0 deterministic mini-notation subset\nsetcpm(60)\n$: note("c4@12").slow(1/4).sound("piano") // GN voice=lead lane=lead.1\n--- GN SIDE LEDGER ---\nGN n1 lead 0 1 60 84',
        render_strudel_score,
        parse_strudel_score,
        "https://strudel.cc/learn/mini-notation/",
    )
)
register(
    make_composite_adapter(
        "lilypond-2.24.4-composite",
        "LilyPond",
        "2.24.4",
        "Use LilyPond 2.24.4. Use one Voice for each overlapping voice lane. "
        "Use quarter-note duration multipliers for exact beat values. " + LEDGER_RULE,
        '\\version "2.24.4"\n\\score {\n  <<\n    \\new Voice = "lead.1" { c\'4*1 }\n  >>\n}\n--- GN SIDE LEDGER ---\nGN n1 lead 0 1 60 84',
        render_lilypond_score,
        parse_lilypond_score,
        "https://lilypond.org/doc/v2.24/Documentation/notation/",
    )
)


def register_adapted_profiles() -> None:
    """Register old profiles with names that do not imply public standards."""

    profiles = (
        ("midi-like-ghostnote-profile", "midi-like-composite", "Ghostnote MIDI-like profile"),
        ("figaro-remi-plus-ghostnote-profile", "remi-plus-composite", "FIGARO REMI+ adapted profile"),
        ("musicbert-octuple-ghostnote-profile", "octuple-midi-composite", "MusicBERT OctupleMIDI adapted profile"),
    )
    for name, legacy_name, label in profiles:
        register(
            legacy_composite(
                name,
                legacy_name,
                label,
                "repository profile",
                "Use the frozen Ghostnote adapted profile. " + LEDGER_RULE,
                legacy.render_events(
                    legacy_name,
                    [{"id": "n1", "voice": "lead", "start": "0", "duration": "1", "pitch": 60, "velocity": 84}],
                ),
                str(SYMBOLIC_V1_ROOT / "formats.py"),
                "This is an adaptation. It is not a public-format conformance claim.",
            )
        )


register_adapted_profiles()
