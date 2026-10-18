"""Check the cloned codec against Ghostnote fixtures without a live host."""

import hashlib
import json
from pathlib import Path
import subprocess
import sys
from collections import Counter


ROOT = Path(__file__).resolve().parents[4]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / "reference/bwpreset"))
sys.path.insert(0, str(ROOT / "reference/acidcat/src"))
from bwpreset.codec import Reader, parse, read_object, serialize, walk
from bwpreset.encoding import installed_key
from acidcat.core.write.edits import edit_bitwig


def git(path, *args):
    return subprocess.check_output(["git", "-C", str(path), *args], text=True).strip()


def digest(data):
    return hashlib.sha256(data).hexdigest()


result = {
    "scope": "Offline source audit. No Bitwig load or live write.",
    "ghostnote_commit": git(ROOT, "rev-parse", "HEAD"),
    "original_report_sha256": digest((ROOT / "context/evidence/OVERLAP_REPORT.md").read_bytes()),
    "repositories": [],
    "presets": [],
    "donors": [],
}
for repo in sorted((ROOT / "reference").iterdir()):
    if (repo / ".git").exists():
        result["repositories"].append({
            "name": repo.name,
            "commit": git(repo, "rev-parse", "HEAD"),
            "commit_date": git(repo, "log", "-1", "--format=%cI"),
            "origin": git(repo, "remote", "get-url", "origin"),
            "status": git(repo, "status", "--porcelain"),
        })

types = Counter()
for path in sorted([*(ROOT / "brain/fixtures").rglob("*.bwpreset"),
                    *(ROOT / "brain/assets").rglob("*.bwpreset")]):
    data = path.read_bytes()
    row = {"path": str(path.relative_to(ROOT)), "sha256": digest(data)}
    try:
        preset = parse(data)
        encoded = serialize(preset)
        row.update(objects=len(list(walk(preset.body))), byte_exact=encoded == data,
                   stable=serialize(parse(encoded)) == encoded)
        types.update(t for _, t, _ in preset.meta)
        for obj in walk(preset.body):
            types.update(t for _, t, _ in obj.fields)
    except Exception as error:
        row["error"] = f"{type(error).__name__}: {error}"
    result["presets"].append(row)
result["resolved_field_types"] = {hex(t): n for t, n in sorted(types.items())}

asset_root = ROOT / "brain/assets/modulators"
manifest = json.loads((asset_root / "manifest.json").read_text())
for donor in manifest["donors"]:
    data = (asset_root / donor["file"]).read_bytes()
    row = {"id": donor["id"], "sha256": digest(data), "measured": donor["footprint"]}
    try:
        reader = Reader(data)
        read_object(reader)
        row.update(objects=len(reader.objects), complete=reader.pos == len(data))
    except Exception as error:
        row["error"] = f"{type(error).__name__}: {error}"
    result["donors"].append(row)

try:
    result["installed_key_check"] = {"extracted_bytes": len(installed_key())}
except Exception as error:
    result["installed_key_check"] = {"error": f"{type(error).__name__}: {error}"}

original = (ROOT / "brain/fixtures/Polysynth/mp_bare.bwpreset").read_bytes()
edited, _ = edit_bitwig(original, {"creator": "overlap-audit-author-longer-than-original"})
result["acidcat_metadata_check"] = {
    "file": "brain/fixtures/Polysynth/mp_bare.bwpreset",
    "byte_delta": len(edited) - len(original),
    "body_offset_unchanged": edited[16:24] == original[16:24],
    "scope": "In memory only; no fixture was changed.",
}
try:
    parse(edited)
    result["acidcat_metadata_check"]["parsed"] = True
except Exception as error:
    result["acidcat_metadata_check"]["error"] = f"{type(error).__name__}: {error}"

print(json.dumps(result, indent=2))
