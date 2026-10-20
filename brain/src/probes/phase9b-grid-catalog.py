"""Build the offline E300 catalog seed and survey candidate list."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "context/evidence/data/phase9b-survey"
PACKAGES = Path.home() / "Library/Application Support/Bitwig/Bitwig Studio/installed-packages/5.0/Bitwig"
MODULES = Path("/Applications/Bitwig Studio.app/Contents/Resources/Library/modules")
SEED = "context/evidence/data/phase9a-grid-read/live-23-semantic-baseline/semantic-0.json"


def save(name, value):
    with (OUT / name).open("x") as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False)
        stream.write("\n")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = sorted(path.name for path in MODULES.glob("*.bwmodule") if path.is_file())
    assert files
    source = json.loads((ROOT / SEED).read_text())
    pairs = sorted({(module["typeUuid"], module["name"]) for module in source["modules"]})
    names = {Path(name).stem for name in files}
    entries = [
        {"typeUuid": uuid, "name": name, "filenameMatch": f"{name}.bwmodule" if name in names else None,
         "evidence": "E276", "source": SEED}
        for uuid, name in pairs
    ]
    catalog = {
        "status": "offline seed only; no 9b preset capture",
        "moduleDirectory": str(MODULES), "moduleFiles": files,
        "moduleFileCount": len(files), "seenTypes": entries,
        "matchedNames": sorted({entry["name"] for entry in entries if entry["filenameMatch"]}),
        "unmatchedFilenames": [name for name in files if Path(name).stem not in {entry["name"] for entry in entries}],
        "coverageRule": "Exact filename stem match only; no module-file decoding or UUID proof from filenames.",
        "surveySeenTypes": [], "surveyCoverage": None,
    }
    selections = [
        ("Essentials/Presets/Poly Grid/Whispering Loops.bwpreset", "Poly Grid", "Possible sample or audio-file content"),
        ("Essentials/Presets/Poly Grid/WT Parkour.bwpreset", "Poly Grid", "Possible wavetable content"),
        ("Essentials/Presets/Poly Grid/SEMtex Motion Seq.bwpreset", "Poly Grid", "Possible Steps or sequencer content"),
        ("Essentials/Presets/Poly Grid/Benjolin.bwpreset", "Poly Grid", "Possible dense modulation"),
        ("Essentials/Presets/Poly Grid/Humongous FeedPad.bwpreset", "Poly Grid", "Possible large graph; 30 modules is unverified"),
        ("Audio FX - Space, Time, Color/Grid Repeater.bwpreset", "FX Grid", "Repeater; flavour inferred from package"),
        ("Essentials/Presets/FX Grid/Sequenced FX Trigger.bwpreset", "FX Grid", "Sequenced effect"),
        ("Essentials/Presets/FX Grid/Grid Multi FX.bwpreset", "FX Grid", "Multiple effects"),
        ("Essentials/Presets/FX Grid/Grid XComp Multiband.bwpreset", "FX Grid", "Multiband effect"),
        ("Notes in Motion/Note Grid/Auto Scaler-Arp.bwpreset", "Note Grid", "Possible scale and note-generation content"),
        ("Notes in Motion/Note Grid/Stutter Steps.bwpreset", "Note Grid", "Possible step content"),
        ("Notes in Motion/Note Grid/Poly Pitch Envelopes.bwpreset", "Note Grid", "Possible polyphonic modulation"),
    ]
    control = Path.home() / "Documents/Bitwig Studio/Library/Presets/Poly Grid/gn-grid-spike-baseline.bwpreset"
    assert control.is_file()
    candidates = [{"path": str(control), "flavour": "Poly Grid", "role": "9a baseline control", "loaded": False}]
    for relative, flavour, reason in selections:
        path = PACKAGES / relative
        assert path.is_file(), path
        candidates.append({"path": str(path), "flavour": flavour, "role": reason, "loaded": False})
    inventory = sorted(str(path.relative_to(PACKAGES)) for path in PACKAGES.rglob("*.bwpreset")
                       if "grid" in str(path).lower())
    save("catalog-seed.json", catalog)
    save("sample-plan.json", {
        "status": "candidates only; select replacements after reads if coverage is insufficient",
        "selectionBasis": "Filename and package category; contents and counts are unverified",
        "stockCandidates": len(selections), "candidates": candidates,
    })
    save("stock-preset-paths.json", {"root": str(PACKAGES), "count": len(inventory), "paths": inventory})
    print(json.dumps({"moduleFiles": len(files), "historicalTypes": len(entries),
                      "matchedNames": len(catalog["matchedNames"]), "stockPaths": len(inventory),
                      "candidatesIncludingControl": len(candidates)}))


if __name__ == "__main__":
    main()
