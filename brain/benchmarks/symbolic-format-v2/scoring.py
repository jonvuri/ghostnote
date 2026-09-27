#!/usr/bin/env python3
"""Use the frozen Phase 8c1 task scorer with the Phase 8c3 parsers."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any

from formats import FROZEN_JSON_ARMS, compact_json


V1_ROOT = Path(__file__).resolve().parent.parent / "symbolic-format-v1"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


v1 = load_module("ghostnote_symbolic_format_v1_scoring_for_v2", V1_ROOT / "scoring.py")

for exported_name in dir(v1):
    if not exported_name.startswith("_"):
        globals()[exported_name] = getattr(v1, exported_name)


def perfect_notes(task: dict[str, Any]) -> list[dict[str, Any]]:
    family = task["family"]
    if family == "comprehension-structure":
        return task["expected"]
    if family == "generation-progression":
        return v1.perfect_progression(task["contract"])
    if family == "generation-melody":
        return v1.perfect_melody(task["contract"])
    if family == "continuation-motif":
        return task["expected"]
    if family == "continuation-roles":
        return v1.perfect_roles(task["contract"])
    if family == "transformation-revoice":
        return v1.revoice_expected(task["source"])
    if family == "transformation-rhythm":
        return task["expected"]
    raise ValueError(f"The task does not return a full document: {family}")


def required_document(arm: str, task: dict[str, Any]) -> dict[str, Any]:
    return compact_json.make_document(perfect_notes(task), task, task["id"])


def score_response(arm: str, task: dict[str, Any], payload: str) -> dict[str, Any]:
    result = v1.score_response(arm, task, payload)
    if (
        arm not in FROZEN_JSON_ARMS
        or task["family"] in {"comprehension-analysis", "transformation-local"}
        or not result["syntax_pass"]
    ):
        return result
    try:
        actual = compact_json.parse_document(arm, payload)
        expected = required_document(arm, task)
        metadata_pass = all(
            actual[name] == expected[name]
            for name in ("score", "bars", "tracks", "regions")
        )
        checks = {"exact_metadata": metadata_pass, **result["checks"]}
        return {**result, "musical_pass": all(checks.values()), "checks": checks}
    except (KeyError, TypeError, ValueError) as error:
        return {
            "syntax_pass": False,
            "musical_pass": False,
            "checks": {},
            "alignment": {"checked": False, "pass": None},
            "error": f"other-output-or-patch-parse-failure: {error}",
        }


def perfect_payload(arm: str, task: dict[str, Any]) -> str:
    if (
        arm not in FROZEN_JSON_ARMS
        or task["family"] in {"comprehension-analysis", "transformation-local"}
    ):
        return v1.perfect_payload(arm, task)
    return compact_json.render_document(
        arm, perfect_notes(task), task, task["id"]
    )
