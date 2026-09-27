#!/usr/bin/env python3
"""Load the pinned Phase 8c1 Music21 and Musicpy controls."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any


SOURCE = Path(__file__).resolve().parent.parent / "symbolic-format-v1" / "theory_verifiers.py"
spec = importlib.util.spec_from_file_location("ghostnote_symbolic_v1_theory_for_v2", SOURCE)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Cannot load module: {SOURCE}")
v1 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v1)

for exported_name in dir(v1):
    if not exported_name.startswith("_"):
        globals()[exported_name] = getattr(v1, exported_name)


if __name__ == "__main__":
    import json

    print(json.dumps(self_test(), indent=2, sort_keys=True))
