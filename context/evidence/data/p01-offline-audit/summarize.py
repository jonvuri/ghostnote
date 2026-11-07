"""Reanalyse E357's retained exchanges offline; stdout is deterministic JSON."""
import gzip
import hashlib
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
SOURCES = [
    "context/evidence/data/b17-integrated-live/attempt-3/019-compose-five-devices.json.gz",
    "context/evidence/data/b17-integrated-live/attempt-3/025-compose-six-chains.json.gz",
]


def summarize(source):
    raw = (ROOT / source).read_bytes()
    data = json.loads(gzip.decompress(raw))
    calls = data["calls"]
    assert len(calls) == data["turns"]
    groups = defaultdict(list)
    for call in calls:
        assert call["received"] >= call["sent"]
        groups[call["method"]].append(call)
    # revision.get and track.list can overlap. Union their intervals, never subtract
    # summed request durations from wall time and call the difference a CPU cost.
    intervals = []
    for start, end in sorted((c["sent"], c["received"]) for c in calls):
        if intervals and start <= intervals[-1][1]:
            intervals[-1][1] = max(intervals[-1][1], end)
        else:
            intervals.append([start, end])
    in_flight = sum(end - start for start, end in intervals)
    return {
        "source": source,
        "sourceSha256": hashlib.sha256(raw).hexdigest(),
        "toolMs": round(data["ms"], 3),
        "wireCalls": len(calls),
        "replyBytes": sum(c["bytes"] for c in calls),
        "wireIntervalUnionMs": round(in_flight, 3),
        "outsideWireIntervalsMs": round(data["ms"] - in_flight, 3),
        "methods": {
            method: {
                "calls": len(rows),
                "summedRequestMs": round(sum(c["received"] - c["sent"] for c in rows), 3),
                "replyBytes": sum(c["bytes"] for c in rows),
                "errors": sum("error" in c["reply"] for c in rows),
            }
            for method, rows in sorted(groups.items())
        },
    }


if __name__ == "__main__":
    print(json.dumps([summarize(source) for source in SOURCES], indent=2))
