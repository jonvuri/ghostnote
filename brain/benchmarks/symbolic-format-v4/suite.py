#!/usr/bin/env python3
"""Provide a fresh cohort for the MusicXML and MIDI-like probe."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
V3_SUITE_PATH = PACKAGE_ROOT.parent / "symbolic-format-v3" / "suite.py"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


v3 = load_module("ghostnote_symbolic_format_v4_v3_suite", V3_SUITE_PATH)
core = v3.core
v19 = v3.v19
symbolic = v3.symbolic
symbolic_scoring = v3.symbolic_scoring

SCHEMA = "ghostnote-symbolic-format-full-suite-v4"
CORPUS_SCHEMA = "ghostnote-symbolic-format-full-suite-corpus-v4"
DEFAULT_COHORT = "musicxml-midi-probe-r1"
DEFAULT_SEED = 200007
DEFAULT_VARIANT_OFFSET = 2504
DECISION_FAMILIES = v3.DECISION_FAMILIES
GUARD_FAMILIES = v3.GUARD_FAMILIES
FAMILIES = v3.FAMILIES
UNIQUE_COUNTS = v3.UNIQUE_COUNTS
SENTINEL_FAMILIES = v3.SENTINEL_FAMILIES
FULL_SUITE = v3.FULL_SUITE
CONTROL = v3.CONTROL


def make_corpus(
    cohort: str = DEFAULT_COHORT,
    seed: int = DEFAULT_SEED,
    variant_offset: int = DEFAULT_VARIANT_OFFSET,
) -> dict[str, Any]:
    value = v3.make_corpus(cohort, seed, variant_offset)
    value["schema"] = CORPUS_SCHEMA
    unsigned = {key: item for key, item in value.items() if key != "sha256"}
    value["sha256"] = core.digest(unsigned)
    return value


source_notes = v3.source_notes
expected_notes = v3.expected_notes
constraint_checks = v3.constraint_checks
task_difficulty = v3.task_difficulty
task_instruction = v3.task_instruction
suite_screen = v3.suite_screen
