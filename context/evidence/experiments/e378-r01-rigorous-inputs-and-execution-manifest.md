---
title: E378 — R01 rigorous-stage inputs, package and execution manifest
kind: evidence
state: done
updated: 2026-10-28
owner: R01
---

# E378 — R01 rigorous-stage inputs, package and execution manifest

Date: 2026-10-28. Stage: **rigorous** (frozen by
[R01-D1](../../../spec/r01-research/decisions/r01-d1-rigorous-freeze-versions.md)
to [R01-D7](../../../spec/r01-research/decisions/r01-d7-rigorous-reporting.md)).
The operator approved extracting works 4–6. This record covers the offline
materialization only. No model call, API billing or Bitwig contact occurred,
and no rigorous submission has been made.

## Inventory and lineage

A fresh read-only Ghostworks `list_shard_assets` capture (raw SHA-256
`544e0002…0a537`, kept in ignored `.tmp/`) lists 383 assets, 303 MIDI assets
and 15 shards, as in E366. The reduced inventory matches the retained
[inventory](../data/r01-pilot-inputs/inventory.json) byte for byte. The
lineage review passes with no changed, removed or unreviewed shard and no
cross-shard shared token. The seeded work order is unchanged: positions 1–3
are the development works, and positions 4–6 are now used.

## Selection (rules `r01-pilot-selection-rules-v3`)

The development works were skipped without opening any file. Every pool asset
of works 4–6 decoded with valid timing; 17 assets were scanned.

| Role | Work (position) | Pool | Asset | Timing | Start quarter | Notes | Off-grid onsets / durations |
|---|---|---|---|---|---|---|---|
| A | *trailing* (4) | 7 | `000-acoustic-piano.mid` | baked | 13373/50 | 126 | 122 / 29 |
| B | *the gapra whitewood* (5) | 5 | `000-acoustic-piano.mid` | mapped | 713719/3200 | 128 | 121 / 128 |
| C | *open spaces* (6) | 5 | `048-string-ensemble.mid` | baked | 6179/50 | 62 | 59 / 62 |

One [R01-D3](../../../spec/r01-research/decisions/r01-d3-target-rule-window-refusal.md)
refusal occurred. *trailing*'s densest admissible window (128 notes, start
tick 2,496,192) had no eligible p08 shift/transpose range and was refused as
`no-task-target`. The next candidate, 126 notes from the same asset, was
accepted. No normalization collision, asset refusal or work exhaustion
occurred. The development windows held 103, 72 and 115 notes (E367). The
rigorous windows hold 126, 128 and 62.

Real-source targets (velocities from `r01-pilot-velocity-v2`):

- p01 (C): sounding count at quarter 2007/256.
- p05 (B): set the velocity of the note at onset 3839/512, pitch 55, to 91.
- p06 (C): transpose every note with pitch 74.
- p08 (A): onsets in [3087/256, 7751/512).
- p09 (B): pitch 38 in [8, 4609/512).

## Package and execution manifest

[Package `pilot-rigorous-v1`](../data/r01-pilot-inputs/rigorous/package/manifest.json)
(manifest SHA-256 `9bbe29dc…46aa8`) applies v5's task revision 5, prompt
revision 2 and cards to the rigorous windows with synthetic seed
`r01-pilot-synthetic-v2`. It has 120 scheduled cells, 87 eligible and 33
exclusions, as in v5. Prompts total 151,550 tokens per repeat (v5:
154,966). A second build regenerated the package byte for byte, and the
runner's task-regeneration check passes.

The [execution manifest](../data/r01-pilot-inputs/rigorous/execution/manifest.json)
(SHA-256 `f9e01750…a29dc`) is labeled `rigorous`, `pinned-not-submitted`. It
records the freeze decisions (D64, R01-D1–R01-D7), the windows hash
`87725a74…ae2bc` and both cohorts' materialized order: 261 runs each,
Haiku 5.5 at `low` and Luna at `medium`. A full plan has 522 initial attempts
and at most 1,566 submissions. A full-pass start check against the manifest
passes.

The rehearsal accepts all 87 goldens and all 81 unreduced respellings. It
rejects all 568 task-specific wrong answers and all 81 gratuitous refusals,
and every variant distinguishes. Two variants are listed as unencodable:
p11's added duplicate on the current-document FIELDS and JSON arms, which
those formats refuse as a duplicate address.

## Reproduction

From `brain/`:
`node benchmarks/r01-candidates/pilot-inventory.mjs ~/.claude/mcp-bin/ghostworks.sh RAW.json`;
`node --import tsx benchmarks/r01-candidates/pilot-inputs.mjs RAW.json /Users/jonvuri/Dropbox/ghostworks NEW/windows.json ../context/evidence/data/r01-pilot-inputs/inventory.json rigorous`;
`pilot-package.mjs PINNED_PP TOOLING NEW/package rigorous`;
`pilot-execution.mjs PINNED_PP pilot-rigorous-v1 NEW/execution`.
Tooling: Node v24.11.1, Producer Pal pin `52a4c219…` with the precision
patch, `js-tiktoken@1.0.21`. 246 focused tests pass. Running the extraction
exposed an import cycle between `pilot-inputs.mjs` and `pilot-tasks.mjs`,
which deadlocked before any file was read; `pilot-tasks.mjs` now defines the
data path itself.

## Limits

The densest-window rule picks each work's busiest admissible passage, not a
typical one. The densest admissible window of *open spaces* holds 62 notes,
so role C has about half the notes of A and B. Velocities are
seeded synthetic dynamics, not recovered performance dynamics. Works 7–11
remain unopened.
