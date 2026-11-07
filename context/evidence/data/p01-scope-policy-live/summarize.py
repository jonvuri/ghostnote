"""Reproduce E371's first-read and warm medians from retained measurement rows."""
import json
import statistics
from pathlib import Path

root = Path(__file__).parent
result = {}
for path in sorted((root / "attempt-1").glob("*-measurements.json")):
    rows = json.loads(path.read_text())
    arms = {}
    for legacy in (True, False):
        runs = [row for row in rows if row["legacy"] == legacy]
        warm = runs[1:]
        arms["suppressed" if legacy else "modern"] = {
            "coldMs": runs[0]["ms"],
            "warmMedianMs": statistics.median(row["ms"] for row in warm),
            "turns": [row["turns"] for row in runs],
            "scrolls": [row["scrolls"] for row in runs],
            "warmMedianBytes": statistics.median(row["bytes"] for row in warm),
        }
    result[path.name] = arms
print(json.dumps(result, indent=2))
