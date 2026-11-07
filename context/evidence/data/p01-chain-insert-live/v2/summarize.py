"""Reproduce E373 insertion receipt and separate readback measurements."""
import gzip
import json
from pathlib import Path

root = Path(__file__).parent / "attempt-1"
rows = []
for path in sorted(root.glob("*-attempt.json.gz")):
    attempt = json.loads(gzip.decompress(path.read_bytes()))
    label = path.name[4:].removesuffix("-attempt.json.gz")
    readback = json.loads(gzip.decompress(next(root.glob(f"*-{label}-readback.json.gz")).read_bytes()))
    call = next(call for call in attempt["calls"] if call["method"] == "probe.chainInsert")
    chain = call["params"]["chainIndex"]
    rows.append({
        "case": label, "chainIndex": chain,
        "sourceCount": len(call["params"]["sources"]),
        "initialDeviceCount": call["params"]["expectedDeviceCount"],
        "receiptMs": call["received"] - call["sent"],
        "dependencyPolls": attempt["receipt"]["dependencyPolls"],
        "readbackMs": readback["ms"], "readbackTurns": readback["turns"],
        "observedDevices": [device["name"] for device in
            readback["result"]["data"]["devices"][17]["container"]["layerChains"][chain]["devices"]],
    })
print(json.dumps(rows, indent=2))
