#!/usr/bin/env python3
"""Reuse the frozen eight-arm adapter registry."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Any


PACKAGE_ROOT = Path(__file__).resolve().parent
V4_FORMATS_PATH = PACKAGE_ROOT.parent / "symbolic-format-v4" / "formats.py"


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


v4 = load_module("ghostnote_symbolic_format_v5_v4_formats", V4_FORMATS_PATH)

REGISTRY = v4.REGISTRY
get = v4.get
FormatAdapter = v4.FormatAdapter
ParseResult = v4.ParseResult
SEPARATOR = v4.SEPARATOR
