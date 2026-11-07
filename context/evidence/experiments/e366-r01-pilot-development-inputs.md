---
title: E366 — R01 pilot development inputs: works A–C, synthetic seed and p01–p12 package
kind: evidence
state: done
updated: 2026-10-26
owner: R01
---

# E366 — R01 pilot development inputs: works A–C, synthetic seed and p01–p12 package

Date: 2026-10-26. Stage: **development**. No model call, Bitwig contact or
library write occurred.

## Result

The pilot draft 2 inputs are materialized as development material. A fresh
read-only Ghostworks inventory matches the retained 2026-10-25 manifest: 383
assets, 303 MIDI, 15 shards, with no asset added, removed or changed. The split
validator passes. No two shards share a signal ID, asset ID or content hash,
so the selected works are independent of each other as well as of the
development works. All 11 reserved MIDI works are eligible.

Seeded selection (`r01-pilot-selection-v1`) chose the first window of the first
seeded asset in each of the first three works. All three were accepted, with no
refusal, so only these three MIDI files were opened:

| Work | Asset | Timing | Window start (quarters) | Notes | Off-grid onsets / durations at 1/512 |
|---|---|---|---|---:|---|
| A — Re:turning | `000-acoustic-piano.mid` | baked, implicit 120 BPM | 18/5 | 38 | 36 / 38 |
| B — Our Taproot | `033-electric-bass.mid` | mapped, ≈93.0 BPM | 19193/4800 | 24 | 23 / 24 |
| C — Good Lies | `033-electric-bass.mid` | mapped, ≈126.0 BPM | 154121/9600 | 24 | 23 / 24 |

The other eight works keep their seeded order for the rigorous stage. In order,
they are Trailing, The Gapra Whitewood, Open Spaces, Losing You, Feeding Time,
Katadoru Sunaba, Namisora and Steady Hands. None of their note files was opened.

The [pilot package](../data/r01-pilot-inputs/package/manifest.json)
(`r01-pilot-package-v1`, stage `development`) has 12 tasks, 84 scheduled cells,
67 eligible cells (56 primary, 11 diagnostic) and 17 explicit exclusions.
These counts match pilot draft 2 cell for cell. The offline rehearsal accepts
all 67 golden responses, rejects all 67 deliberate wrong results and rejects
all 61 gratuitous refusals; the six refusal-task cells are exempt from the last
check. Delivered prompts range from 713 to 2,040 `o200k_base` tokens. With
three repeats, the runner plans 201 initial attempts per cohort, with at most
1,206 submissions across both cohorts.

## Method

- **Inventory.** [`pilot-inventory.mjs`](../../../brain/benchmarks/r01-candidates/pilot-inventory.mjs)
  calls Ghostworks `list_shard_assets` over stdio through the operator's MCP
  launcher (Ghostworks checkout `2797714`, working tree modified). The raw reply
  (SHA-256 `b8fe8dd9…f6c1`, 3.1 MB) stayed in ignored `.tmp/`. The retained
  [reduced inventory](../data/r01-pilot-inputs/inventory.json) keeps identity,
  lineage and timing fields.
- **Lineage review.** Shard groups are rebuilt from the assets plus their
  `derivedFrom` references and compared with the retained manifest's identity
  fields. Two apparent differences were representation only. The retained
  manifest writes absent signal IDs as `null` (three Good Lies drum assets), and
  Psychomania Splices carries extra audit fields (`extractionSourceRefs` and
  `ancestorContentHashes`) that discovery metadata cannot derive. These fields
  are carried into the split validator and the cross-shard check.
- **Selection and extraction.** Eligible reserved shard IDs are sorted and
  shuffled with the planner's SHA-256 rejection-sampling shuffle. Each work's
  pool consists of `transcript-muscriptor-large/` assets with program below
  128 that are not drums; its asset IDs are shuffled with the same seed and the
  work ID. A window starts at the asset's first onset and spans 16 encoded
  quarters, half-open, with complete durations. Notes are normalized once at
  1/512. The pilot draft's refusals, next-window rule (at most eight windows
  per asset), asset-level timing and decode refusals, and work exhaustion are
  implemented and offline-tested; none occurred.
- **Tasks.** [`pilot-tasks.mjs`](../../../brain/benchmarks/r01-candidates/pilot-tasks.mjs)
  implements the fixed rules (`r01-pilot-task-rules-v1`). For an edit target,
  sort by onset, pitch and ID, then take the first note from index ⌊n/2⌋ onward
  whose address is unique and whose edited result neither collides with
  another note nor leaves the MIDI range. `p08` uses the first of [4,6),
  [6,8), [8,10) and [10,12) that has at least two onsets and no collision after
  shifting; it selected [6,8). Synthetic tasks use seed `r01-pilot-synthetic-v1`.
  Group onsets satisfy anchor + delay + spread, and `p07` spreads use even
  1/512 cells. The `p10` selector has two pitch-64 matches at distinct onsets in
  [2,3). `p12` combines non-grid spellings, wider note fields and an opaque
  annotation. `p05` and `p09` apply the same target rule to work B and select
  the same note.
- **Package.** [`pilot-package.mjs`](../../../brain/benchmarks/r01-candidates/pilot-package.mjs)
  reuses the E358 builder, cards, shared instructions and response contracts.
  The builder now accepts tasks, a header and limits; rebuilding E358 with it
  reproduces its pairs, oracles and rehearsal byte for byte. The detached-FIELDS
  control is now also eligible when a write creates groups from an empty input
  (`p04`), as the draft counted; no E358 task is affected. The runner loads the
  package as `pilot-development`; its loader checks artifact and prompt hashes
  and regenerates the tasks to compare them with the retained private oracles.

## Observations for tuning

- The windows are small. `p05` was intended as a velocity edit in a window of
  up to 128 notes, but work B's window has 24 notes; the largest window, A, has
  38. The first-window rule favours sparse openings. Development may revise the
  window rule with a version change.
- Velocity is the placeholder 64 throughout the real windows, so `p05` always
  sets 91. Reserved-source dynamics remain uninformative (E354).
- Work A has baked timing; B and C are mapped. Report the two separately.

## Artifacts and reproduction

- [Windows record](../data/r01-pilot-inputs/windows.json) (SHA-256
  `59448ec7…7105`): rules, inventory hashes, lineage outcome, full work order,
  every extraction attempt, and each window's normalized notes, exact source
  values and source ticks.
- [Pilot package](../data/r01-pilot-inputs/package/) (manifest SHA-256
  `4e4f0980…f8a3`): cards, pairs, private oracles and rehearsal.
- From `brain/`:
  `node benchmarks/r01-candidates/pilot-inventory.mjs ~/.claude/mcp-bin/ghostworks.sh RAW.json`,
  then `node --import tsx benchmarks/r01-candidates/pilot-inputs.mjs RAW.json LIBRARY_ROOT NEW_DIR/windows.json`
  and `node --import tsx benchmarks/r01-candidates/pilot-package.mjs PINNED_PP TOOLING NEW_DIR/package`.
  Both regenerated byte-identically from the same raw inventory.
- 217 focused tests pass (10 new in `pilot-inputs.test.mjs`).

## Limits

This record covers development material only. Results from these inputs cannot
support candidate comparison. The rigorous stage takes the next unused works and
a new synthetic seed. No pilot submission was made. The pinned execution
manifest and the extended offline rehearsal are the next step.
