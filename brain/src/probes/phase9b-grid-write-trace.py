"""Check the pinned command trace without loading host classes."""
import hashlib
import json
from pathlib import Path
import subprocess
import time


ROOT = Path(__file__).resolve().parents[3]
MANIFEST = ROOT / "context/evidence/data/phase9b-writes/trace-manifest.json"


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main():
    manifest = json.loads(MANIFEST.read_text())
    jar = Path(manifest["jar"])
    if digest(jar) != manifest["jarSha256"]:
        raise ValueError("Host jar does not match the trace.")
    start = time.perf_counter()
    for row in manifest["classes"]:
        result = subprocess.run(
            ["javap", "-classpath", str(jar), "-p", "-c", row["class"]],
            check=True, capture_output=True,
        )
        if hashlib.sha256(result.stdout).hexdigest() != row["javapSha256"]:
            raise ValueError(f"Bytecode output changed: {row['class']}")
    print(json.dumps({
        "jarSha256": manifest["jarSha256"],
        "bytecodeInspections": len(manifest["classes"]),
        "elapsedMs": round((time.perf_counter() - start) * 1000, 3),
        "nativeCommands": 0,
        "result": "pass",
    }, indent=2))


if __name__ == "__main__":
    main()
