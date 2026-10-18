#!/usr/bin/env python3
"""Read a saved Grid fixture with the pinned external bwpreset parser."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("preset", type=Path)
parser.add_argument("--reference", type=Path,
                    default=Path("/Users/jonvuri/Development/ghostnote/reference/bwpreset"))
args = parser.parse_args()
sys.dont_write_bytecode = True
sys.path.insert(0, str(args.reference))
from bwpreset.codec import parse, serialize, walk
from bwpreset import model as m

if not args.preset.is_file() or args.preset.stat().st_size > 32 * 1024 * 1024:
    raise SystemExit("Use a regular preset file of at most 32 MiB")
data = args.preset.read_bytes()
preset = parse(data)
modules, cables = [], []
for obj in walk(preset.body):
    if obj.cls != m.MODULE:
        continue
    module = {"index": m.get(obj, m.F_NAME), "name": m.get(obj, m.F_TITLE),
              "typeUuid": str(m.get(obj, m.F_TYPE)),
              "x": m.get(obj, m.F_X), "y": m.get(obj, m.F_Y), "parameters": []}
    for parameter in m.params(obj):
        name = m.get(parameter, m.F_NAME)
        value = m.param_value(parameter)
        if isinstance(value, bytes):
            value = {"bytes": len(value), "sha256": hashlib.sha256(value).hexdigest()}
        module["parameters"].append({"name": name, "classId": parameter.cls,
                                     "domain": "stored; display conversion unclassified", "value": value})
        if parameter.cls == m.P_INPUT:
            source = m.get(parameter, m.F_SOURCE)
            if source:
                match = re.fullmatch(r"CONTENTS/MODULES/([^/]+)/CONTENTS/(.+)", source)
                if not match:
                    raise SystemExit("Unclassified input source: " + source)
                cables.append({"sourceModule": match[1], "sourcePort": match[2],
                               "destinationModule": module["index"], "destinationPort": name,
                               "storedSource": source})
    modules.append(module)
print(json.dumps({"path": str(args.preset.resolve()), "bytes": len(data),
                  "sha256": hashlib.sha256(data).hexdigest(),
                  "byteRoundTrip": serialize(preset) == data,
                  "scope": "saved preset; no live graph claim", "modules": modules,
                  "cables": cables}, indent=2))
