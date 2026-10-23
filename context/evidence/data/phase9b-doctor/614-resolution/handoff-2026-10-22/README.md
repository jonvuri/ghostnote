# 9b.6g preservation supplement — 2026-10-22

The user paused the investigation and requested an agent handoff.
Read the [comprehensive handoff](../../../../../plan/phase-9/9b6g-agent-handoff-2026-10-22.md)
for current findings, remaining work, constraints, and artifact recovery.

This supplement preserves work after checkpoint 16. It does not add a test
result, admit a command, or mark the session complete. No live action or
implementation work occurred while preparing the handoff.

- `development.zip` contains 24 additional or changed temporary artifacts:
  5,257,047 raw bytes and 278,160 compressed bytes.
- `development-manifest.json` gives each member's size and SHA-256.
- `artifact-index.json` locates the latest preserved versions of 1,326
  artifacts across checkpoints 1–16 and this supplement. Archive paths are
  relative to the repository root. Members use the original basenames.
- `diagnostic-source.zip` and `source-inventory.json` preserve all 86 current
  Python source files under `brain/src/probes/grid_doctor/`.
- `hashmap-remove-model-2.json` records 5,293 inert cases. Its observed maxima
  are not analytical bounds. Its `boundedAdmission` value is false.
- `runtime-comparison-10.json` compares 35 bundled runtime classes. Both
  architecture pairs match. Only ReferenceQueue differs between builds.

The newest implementation change is the runtime dependency expansion.
The last full suite precedes it: 346 tests run, 316 pass, 30 skip. Focused
extraction and HashMap model checks passed after that source change.

Keep the original entry inventory and existing checkpoints unchanged.
Recover missing temporary files from the indexed archive and verify their
hashes. Do not overwrite a different current file or newer source snapshot.
The final preservation check remains due at the session outcome.
