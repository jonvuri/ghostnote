---
title: E381 — R01 round 2 offline implementation: windows, ladders, package and rehearsal
kind: evidence
state: done
updated: 2026-10-28
owner: R01
---

# E381 — R01 round 2 offline implementation: windows, ladders, package and rehearsal

Date: 2026-10-28. Stage: **development**, round 2
([brief](../../work/r01-round-2-difficulty-scaling.md) step 3). Offline
only: no model call, API billing or Bitwig contact. Design details are
[R01-D13](../../../spec/r01-research/decisions/r01-d13-round-2-admission-and-offline-design.md).
No round-2 submission has been made.

## Inventory and windows

A fresh read-only Ghostworks `list_shard_assets` capture (383 assets, 303 MIDI,
15 shards; raw file in ignored `.tmp/r01-round2/`) reduces byte for byte to
the retained [inventory](../data/r01-pilot-inputs/inventory.json), and the
lineage review passes. Only the pool assets of works 4–6 (seeded positions
4–6, the first rigorous round's works) were decoded: 17 assets, all with
valid timing. No other work was opened.

[`round2-inputs.mjs`](../../../brain/benchmarks/r01-candidates/round2-inputs.mjs)
selected 16 windows under `r01-round2-windows-v1`
([windows](../data/r01-round2/windows.json), SHA-256 `3abb5be7…`). No
candidate had a normalization collision or a target-rule refusal at any size.

| Size | Instances (work, asset) | Span of instance 1 (quarters) | Largest overlap with an earlier instance |
|---|---|---|---|
| 64 | trailing voice; gapra piano; open spaces cello; trailing piano | 250 | 0 |
| 128 | trailing piano; gapra piano; open spaces cello; trailing piano | 129 | 0 |
| 256 | trailing piano ×2; gapra piano ×2 | 263 | 48 |
| 512 | gapra piano ×4 | 227 | 428 |

Only *the gapra whitewood* piano (859 notes) holds 512 notes, and *open
spaces* has no 256-note asset (its cello holds 241). The 512-note instances
2–4 therefore share 174 to 428 notes with earlier instances. Nearly every
source onset lies off the 1/512 grid (507 of 512 in the first 512-note
window). Performed tasks use the normalized onsets; exact preservation keeps
the source ones.

## Ladders and package

[`round2-tasks.mjs`](../../../brain/benchmarks/r01-candidates/round2-tasks.mjs)
generates 116 tasks: 8 families, 29 levels and 4 instances per level.
[Package `round2-development-v1`](../data/r01-round2/package/manifest.json)
(manifest SHA-256 `866ba8cb…`) uses prompt revision 2, the revision-2 cards
and D59 scoring. It schedules 756 cells: 448 eligible, 304 source-arm
exclusions and 4 detached-layout exclusions (exact preservation has no
group).

| Family | Levels | Eligible cells (all / instance 1) | Instance-1 prompt tokens | Timeout per level (s) |
|---|---|---|---|---|
| derived-read | 1, 2, 4, 8 groups | 44 / 11 | 17,726 | 130 at every level |
| group-retime | 1, 2, 4, 8 groups | 44 / 11 | 17,262 | 140, 160, 170, 220 |
| regroup | 1, 2, 4, 6 groups | 44 / 11 | 16,985 | 150, 170, 190, 210 |
| member-move | 1, 2, 4, 6 moves | 44 / 11 | 16,970 | 150, 160, 170, 190 |
| range-edit | 64, 128, 256, 512 notes | 96 / 24 | 136,670 | 250, 380, 620, 1,120 |
| selective-delete | 1, 3, 6 near misses | 72 / 18 | 62,116 | 380, 380, 390 |
| preserve-performed | 128, 256, 512 notes | 72 / 18 | 123,396 | 380, 620, 1,120 |
| preserve-exact | 128, 256, 512 notes | 32 / 8 | 62,373 | 310, 700, 860 |

Timeouts follow `r01-round2-timeout-v1`. The largest golden response at a
level ranges from 12 local tokens (one-group read) to 16,518 (a 512-note
answer). The 256-note exact-preservation level carries the JSON diagnostics,
so its golden (9,657 tokens) and limit exceed what the FIELDS arms alone
would set. An earlier build in `/tmp` is byte-identical to the retained package, and the
runner's regeneration check passes.

## Rehearsal and execution manifest

The [rehearsal](../data/r01-round2/execution/rehearsal.json) accepts all 448
goldens and all 448 unreduced respellings. It rejects all 3,546 scored
task-specific wrong answers (948 variants) and all 448 gratuitous refusals.
No variant equals its oracle. 26 variant cells are unencodable in the current-document format, which
refuses duplicate addresses: the added duplicate (24 cells) and one
sixteenth-note quantization that creates a duplicate (2 cells). Each family reuses its round-1 task's variants where they apply and
adds level-aware ones that miss part of a multi-part request (for example,
the last change, move or created group; a near miss before the range; the
last note of the range).

The [execution manifest](../data/r01-round2/execution/manifest.json)
(SHA-256 `e51298ab…`) pins the full development pass: four cohorts, three
repeats, order seed `r01-round2-order-v1`, 1,344 initial runs per cohort
(5,376 in total, at most 16,128 submissions). It records each task's family,
level, instance and timeout and the round-2 context policies. A calibration
subset (`--instances 1 --repeats 1`) passes the start check against it.

## Calibration pass, ready but not run

`cli-pilot-runner.mjs start PINNED_PP TOOLING round2-development-v1 OUTPUT
--instances 1 --repeats 1` plans **112 initial runs per cohort** (98
primary, 14 diagnostic). Across four cohorts that is 448 runs and at most
1,344 submissions. The cohorts are Haiku 5.5 `low`, Luna `medium`, Haiku 4.5
(thinking 1,024, uncapped) and `gpt-5.6-terra` `low`. Per cohort, prompts
total about 453,500 local tokens, and first-attempt goldens total about
356,700 output tokens. The pinned limits sum to 12.8 hours per cohort, but
that is a bound. Actual duration is not measured; output rate and the
512-note answers will dominate it.

## Measures

[`round2-analysis.mjs`](../../../brain/benchmarks/r01-candidates/round2-analysis.mjs)
(`r01-round2-measures-v1`) reports the brief's measures per cohort × arm ×
family × level. It adds breaking points per cohort × arm × family and exact
McNemar tests for C3 versus C4 FIELDS per level. A smoke check on fabricated
golden and malformed results for a calibration-shaped plan produced 224 rows,
84 breaking-point series and 58 paired tests.

## Verification

From `brain/`: `node --import tsx --test benchmarks/r01-candidates/*.test.mjs`
passes **259** tests. Nine are new in
[`round2.test.mjs`](../../../brain/benchmarks/r01-candidates/round2.test.mjs):

- window rules and selection;
- retained windows;
- per-family axis and oracle checks, which recompute group equations,
  read windows, moves and planted near misses independently, and require
  note order to equal C4 traversal;
- target-rule refusals;
- timeouts;
- selection;
- the retained package and execution manifest;
- measures.

Round 1's packages, plans and execution manifests regenerate unchanged. Two
shared sources changed:

- The planner accepts optional per-task timeouts; without them its output is
  unchanged.
- The current-document clip grows in 64-quarter steps for windows longer
  than 64 quarters; round-1 windows keep 64.

Reproduction, from `brain/`:

1. `node benchmarks/r01-candidates/pilot-inventory.mjs ~/.claude/mcp-bin/ghostworks.sh RAW.json`
2. `node --import tsx benchmarks/r01-candidates/round2-inputs.mjs RAW.json /Users/jonvuri/Dropbox/ghostworks NEW/windows.json`
3. `round2-package.mjs PINNED_PP TOOLING NEW/package`
4. `pilot-execution.mjs PINNED_PP round2-development-v1 NEW/execution`

Tooling: Node v24.11.1, Producer Pal pin `52a4c219…` with the precision
patch, `js-tiktoken@1.0.21`.

## Limits

- The 512-note instances overlap heavily, and every one comes from one
  piano part. Instance-level variance at 512 is understated, and the
  material is not representative of other instruments.
- Selective-delete targets and near misses are planted, not found in the
  material.
- Levels are R01-D11's first guesses. Calibration may move them per cohort,
  which needs a new package version.
- The package directory is 18 MB, mostly prompts and oracles for the large
  windows.
