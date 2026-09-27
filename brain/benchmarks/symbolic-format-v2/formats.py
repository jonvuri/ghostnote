#!/usr/bin/env python3
"""Expose the Phase 8c1 controls and frozen Phase 8c2.3 JSON arms."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
BENCHMARKS_ROOT = PACKAGE_ROOT.parent
V1_ROOT = BENCHMARKS_ROOT / "symbolic-format-v1"
COMPACT_JSON_ROOT = BENCHMARKS_ROOT / "compact-json-v1"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


v1 = load_module("ghostnote_symbolic_format_v1_formats_for_v2", V1_ROOT / "formats.py")
compact_json = load_module(
    "ghostnote_compact_json_v1_core_for_symbolic_v2", COMPACT_JSON_ROOT / "core.py"
)

for exported_name in dir(v1):
    if not exported_name.startswith("_"):
        globals()[exported_name] = getattr(v1, exported_name)

FROZEN_JSON_ARMS = ("exact-object-json-midi", "tuple-json-midi")
ARMS = (
    "exact-json",
    *FROZEN_JSON_ARMS,
    *(arm for arm in v1.ARMS if arm != "exact-json"),
)
NATIVE_ARMS = v1.NATIVE_ARMS
COMPOSITE_ARMS = v1.COMPOSITE_ARMS
IDENTITY_ARMS = (*v1.IDENTITY_ARMS, *FROZEN_JSON_ARMS)
VELOCITY_ARMS = (*v1.VELOCITY_ARMS, *FROZEN_JSON_ARMS)
PAIR_FAMILIES = v1.PAIR_FAMILIES
FIELDS = v1.FIELDS
MUSICAL_FIELDS = v1.MUSICAL_FIELDS


class ParseFailure(ValueError):
    """Keep a composite failure class through the shared scorer."""

    def __init__(self, failure_class: str, message: str):
        super().__init__(f"{failure_class}: {message}")
        self.failure_class = failure_class


def eligibility_manifest() -> dict[str, Any]:
    value = v1.eligibility_manifest()
    for arm in FROZEN_JSON_ARMS:
        value["profiles"][arm] = {
            "condition": "frozen-full-document-control" if arm == FROZEN_JSON_ARMS[0] else "selected-candidate",
            "represented_fields": [
                "score",
                "bars",
                "tracks",
                "regions",
                *FIELDS,
            ],
            "timing_resolution": "exact rational",
            "native_defaults_and_loss": [],
            "output_mode": "sparse local patch; full document otherwise",
            "identity_scored": True,
            "preservation_scored": True,
            "parser_assumption": "Frozen compact-json-v1 parser and schema.",
            "eligible_tasks": list(v1.eligibility_manifest()["profiles"]["exact-json"]["eligible_tasks"]),
        }
    return value


def is_eligible(arm: str, family: str) -> bool:
    return family in eligibility_manifest()["profiles"][arm]["eligible_tasks"]


def frozen_item_id(metadata: dict[str, Any]) -> str:
    return str(metadata.get("id") or metadata.get("sha256") or "phase8c3-score")


def render_events(
    arm: str,
    notes: list[dict[str, Any]],
    metadata: dict[str, Any] | None = None,
) -> str:
    if arm in FROZEN_JSON_ARMS:
        source = metadata or {}
        return compact_json.render_events(arm, notes, source, frozen_item_id(source))
    return v1.render_events(arm, notes, metadata)


def parse_events(arm: str, text: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if arm in FROZEN_JSON_ARMS:
        return compact_json.parse_events(arm, text), {"checked": False, "pass": None}
    if arm not in COMPOSITE_ARMS:
        try:
            return v1.parse_events(arm, text)
        except (KeyError, TypeError, ValueError) as error:
            raise ParseFailure("other-output-or-patch-parse-failure", str(error)) from error
    base = arm.removesuffix("-composite")
    score_text, marker, ledger_text = text.partition("--- GN SIDE LEDGER ---")
    parser = {
        "abc-2.1": v1.parse_abc,
        "alda": v1.parse_alda,
        "midi-like": v1.parse_midi_like,
        "remi-plus": v1.parse_remi,
        "octuple-midi": v1.parse_octuple,
    }[base]
    try:
        score_notes = parser(score_text)
    except (KeyError, TypeError, ValueError) as error:
        raise ParseFailure("native-score-parse-failure", str(error)) from error
    if not marker:
        raise ParseFailure("missing-or-invalid-side-ledger", "Composite marker is missing")
    try:
        ledger = v1.parse_ledger(ledger_text)
    except (KeyError, TypeError, ValueError) as error:
        raise ParseFailure("missing-or-invalid-side-ledger", str(error)) from error
    if v1.projected(score_notes, MUSICAL_FIELDS) != v1.projected(ledger, MUSICAL_FIELDS):
        raise ParseFailure(
            "explicit-score-ledger-disagreement", "Native score and side ledger disagree"
        )
    normalized, _ = v1.parse_events(arm, text)
    return normalized, {"checked": True, "pass": True}


def render_patch(
    arm: str, base_sha256: str, operations: list[dict[str, Any]]
) -> str:
    if arm not in FROZEN_JSON_ARMS:
        return v1.render_patch(arm, base_sha256, operations)
    converted = []
    for operation in operations:
        if operation.get("op") != "set":
            raise ValueError("The frozen compact JSON patch supports set-note only")
        changes = {
            name: value
            for name, value in operation.items()
            if name not in {"op", "id"}
        }
        converted.append(
            {"op": "set-note", "id": operation["id"], "changes": changes}
        )
    return compact_json.render_patch(arm, base_sha256, converted)


def parse_patch(arm: str, text: str) -> dict[str, Any]:
    try:
        if arm in FROZEN_JSON_ARMS:
            return compact_json.parse_patch(arm, text)
        return v1.parse_patch(arm, text)
    except (KeyError, TypeError, ValueError) as error:
        raise ParseFailure("other-output-or-patch-parse-failure", str(error)) from error


def compile_patch(
    patch: dict[str, Any], source: list[dict[str, Any]], base_sha256: str
) -> list[dict[str, Any]]:
    if patch.get("ops") and patch["ops"][0].get("op") == "set-note":
        return compact_json.compile_patch(patch, source, base_sha256)
    return v1.compile_patch(patch, source, base_sha256)


def output_grammar(arm: str, family: str) -> str:
    if family == "comprehension-analysis":
        return v1.output_grammar(arm if arm not in FROZEN_JSON_ARMS else "exact-json", family)
    if arm in FROZEN_JSON_ARMS:
        return compact_json.output_grammar(arm, family)
    return v1.output_grammar(arm, family)


def output_example(arm: str, family: str) -> str:
    if arm in FROZEN_JSON_ARMS:
        return compact_json.output_example(arm, family)
    raise ValueError(f"The arm uses the Phase 8c1 example table: {arm}")
