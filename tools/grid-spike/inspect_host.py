#!/usr/bin/env python3
"""Record the 9a host pin and inspect the fixed reader and command symbol set."""
import argparse
import hashlib
import json
import pathlib
import platform
import plistlib
import subprocess

JAR_SHA256 = "382c655d0b9e8db6bd433dc6100ef3a4ee23abf6a6615f79c40f0c2645792c93"
CLASSES = [
    "com.bitwig.flt.document.core.master.device.had",
    "com.bitwig.flt.document.core.master.device.DtR",
    "com.bitwig.flt.document.core.master.device.QHo",
    "com.bitwig.flt.document.core.master.device.NHx",
    "com.bitwig.flt.document.core.master.device.l2U",
    "com.bitwig.flt.document.core.master.device.sIm",
    "com.bitwig.flt.document.core.master.device.NDn",
    "com.bitwig.flt.document.core.master.device.Wxc",
    "com.bitwig.flt.document.core.master.device.mhb",
    "com.bitwig.flt.document.core.master.device.gJ",
    "com.bitwig.flt.document.core.master.device.rmP",
    "com.bitwig.flt.document.core.master.Svr",
    "com.bitwig.flt.document.core.master.iWC",
    "llL", "com.bitwig.flt.document.core.master.oaA",
    "com.bitwig.base.async.AsyncUtilities",
    "com.bitwig.base.async.ITE",
    "com.bitwig.ramona.core.ytV", "com.bitwig.ramona.core.toM",
    "xQx", "Lqu", "JtC", "CRd", "iYc", "DHY", "rpR", "zrk",
    "com.bitwig.ramona.core.Buu", "com.bitwig.ramona.core.WAr",
    "com.bitwig.ramona.core.oQq", "com.bitwig.ramona.core.hOP",
    "com.bitwig.flt.document.core.master.device.Ymq",
    "com.bitwig.flt.document.core.master.device.hwy",
    "com.bitwig.flt.document.core.master.device.vWM",
    "com.bitwig.flt.document.core.master.device.WTi",
    "com.bitwig.flt.document.core.master.device.pyQ",
    "com.bitwig.flt.document.core.master.device.WAr",
    "com.bitwig.flt.document.core.master.device.yWH",
    "a",
    "com.bitwig.flt.document.core.master.device.mvZ",
    "com.bitwig.flt.document.core.master.device.ziZ",
    "com.bitwig.flt.document.core.master.device.xts",
    "com.bitwig.flt.document.core.master.device.UL",
    "tqm",
    "ipr",
    "bcf",
    "TXU",
    "Qtf",
    "vST",
    "IXs",
    "MmR",
    "Hjt",
    "ccA",
    "g2m",
    "com.bitwig.ramona.core.ikl",
    "com.bitwig.flt.control_surface.proxy.ParameterImpl",
    "com.bitwig.flt.control_surface.proxy.ValueAtomProxy",
    "com.bitwig.flt.control_surface.values.ParameterProxy",
    "com.bitwig.flt.control_surface.values.RangedValueProxy",
    "com.bitwig.flt.control_surface.values.ValueAtomParameterTarget",
    "com.bitwig.flt.control_surface.values.DecimalValueAtomParameterTarget",
    "com.bitwig.flt.control_surface.values.DecimalValueAtomValueTarget",
    "com.bitwig.flt.control_surface.values.ParameterValueTarget",
    "com.bitwig.flt.document.core.master.device.esS",
    "com.bitwig.flt.document.core.master.device.S1R",
    "com.bitwig.flt.document.core.master.device.Jym",
    "com.bitwig.flt.document.core.master.device.YAD",
    "com.bitwig.flt.document.core.master.device.zXf",
    "com.bitwig.flt.document.core.master.device.Grz",
    "com.bitwig.flt.document.core.master.device.gOr",
    "com.bitwig.flt.document.core.master.device.xWk",
    "com.bitwig.flt.document.core.master.device.cbl",
    "com.bitwig.flt.document.core.master.device.DbL",
    "com.bitwig.flt.document.core.master.device.WZo",
    "com.bitwig.flt.document.core.master.device.GCp",
    "com.bitwig.flt.document.core.master.device.HVJ",
    "com.bitwig.flt.document.core.master.device.YYz",
    "com.bitwig.flt.document.core.master.device.S2E",
    "com.bitwig.flt.document.core.master.device.Kdw",
    "com.bitwig.flt.document.core.master.device.UZp",
    "com.bitwig.flt.document.core.master.device.Ibf",
    "com.bitwig.flt.document.core.master.device.ar",
    "com.bitwig.flt.document.core.master.device.OEf",
    "com.bitwig.flt.document.core.master.device.ilU",
    "com.bitwig.flt.control_surface.proxy.ControlSurfaceObject",
    "com.bitwig.flt.control_surface.proxy.ControlSurfaceProxy",
    "com.bitwig.flt.control_surface.proxy.ControlSurfaceDocumentObjectProxy",
    "com.bitwig.flt.control_surface.proxy.DeviceProxy",
    "com.bitwig.ramona.core.HEV", "cXZ", "cXV", "cYx", "cYs", "cYF", "cYH", "cYy", "cYz",
    "com.bitwig.ramona.serial.vWM", "com.bitwig.ramona.serial.ytV",
    "com.bitwig.ramona.serial.WAr", "com.bitwig.ramona.serial.bnu",
]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--app", type=pathlib.Path, default=pathlib.Path("/Applications/Bitwig Studio.app"))
parser.add_argument("--reference", type=pathlib.Path,
                    default=pathlib.Path("/Users/jonvuri/Development/ghostnote/reference"))
parser.add_argument("--bytecode-dir", type=pathlib.Path,
                    help="Optional new local directory for javap output. Do not commit vendor bytecode.")
args = parser.parse_args()
jar = args.app / "Contents/Java/bitwig.jar"
digest = hashlib.sha256(jar.read_bytes()).hexdigest()
if digest != JAR_SHA256:
    raise SystemExit("Unsupported host jar: " + digest)
plist = plistlib.loads((args.app / "Contents/Info.plist").read_bytes())
if args.bytecode_dir:
    args.bytecode_dir.mkdir()
symbols = []
for name in CLASSES:
    text = subprocess.check_output(["javap", "-p", "-c", "-classpath", str(jar), name],
                                   text=True, timeout=60)
    if args.bytecode_dir:
        (args.bytecode_dir / (name + ".txt")).write_text(text)
    symbols.append({"class": name, "javapSha256": hashlib.sha256(text.encode()).hexdigest()})
clones = []
for name in ["openwig", "bwpreset", "bitwig-control-deck"]:
    path = args.reference / name
    clones.append({"name": name, "path": str(path),
                   "head": subprocess.check_output(["git", "-C", str(path), "rev-parse", "HEAD"], text=True).strip(),
                   "changes": subprocess.check_output(["git", "-C", str(path), "status", "--short"], text=True)})
print(json.dumps({"jar": str(jar), "jarSha256": digest, "os": platform.platform(),
                  "bundleVersion": plist["CFBundleVersion"], "clones": clones,
                  "javapVersion": subprocess.check_output(["javap", "-version"], text=True).strip(),
                  "bytecodeInspections": symbols}, indent=2))
