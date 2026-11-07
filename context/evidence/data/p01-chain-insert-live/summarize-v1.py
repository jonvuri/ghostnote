"""Summarize retained P01 v1 insertion calls; receipts exclude independent readback."""
import gzip
import json
from pathlib import Path

root = Path(__file__).parent
rows = []
for directory in sorted(root.glob("attempt-[123]")):
    for path in sorted(directory.glob("*-attempt.json.gz")):
        attempt = json.loads(gzip.decompress(path.read_bytes()))
        calls = attempt["calls"]
        label = path.name[4:].removesuffix("-attempt.json.gz")
        readback_path = next(directory.glob(f"*-{label}-readback.json.gz"))
        readback = json.loads(gzip.decompress(readback_path.read_bytes()))
        frame = next(call for call in calls if call["method"] == "probe.chainInsert")
        chain = frame["params"]["chainIndex"]
        order_paths = list(directory.glob(f"*-{label}-order.json"))
        rows.append({
            "attempt": directory.name, "case": label, "chainIndex": chain,
            "submitted": frame["params"]["sources"],
            "receiptMs": frame["received"] - frame["sent"],
            "readbackMs": readback["ms"], "readbackTurns": readback["turns"],
            "observedDevices": [device["name"] for device in
                readback["result"]["data"]["devices"][17]["container"]["layerChains"][chain]["devices"]],
            "order": json.loads(order_paths[0].read_text()) if order_paths else None,
        })
print(json.dumps(rows, indent=2))
