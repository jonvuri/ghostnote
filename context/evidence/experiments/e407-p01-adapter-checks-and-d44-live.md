---
title: E407 — P01 adapter check reductions and the D44 composition measurement, live
kind: evidence
updated: 2026-11-07
owner: P01
---

# E407 — P01 adapter check reductions and the D44 composition measurement, live

**Positive.** With the adapter's per-operation checks reduced, staged
`compose_devices` of six one-device chains at position 18 took 8.8 s / 105
wire turns, against [E406](e406-d65-direct-composition-live.md)'s 13.7 s / 133.
Above the six-unit limit, device units no longer drive the cost: 4×4 native,
16 plug-in units and 4 modulated devices took 3.5–6.6 s. Layer chains beyond
the five-chain seed and existing sources do: 16 one-device chains at
position 18 took 38.1 s, and 8 existing sources into 8 chains at position 18
took 25.6 s. At 8 chains and 16 units the worst new-source shape took
13.7 s. [D67](../../decisions/d67-composition-limits-follow-chains-and-existing-sources.md)
sets the limits from these measurements. A second change then removed the
redundant top-level reads around guarded device insertions: `add_devices`
of 16 native devices fell from 18.7–19.0 s to 9.1 s, and six chains at
position 18 to 7.8 s. All compositions read back independently, reverted to
the exact prior structure, and were cleaned up.

## Change under test

The brain changes (the extension is unchanged):

- **Renames.** `planStages` puts consecutive `chain.rename` ops in one stage
  unless one renames a name that an earlier rename in the stage produced. The
  live adapter resolves each chain's identity from one container reading (the
  batch preflight reading for the first stage), sends every rename in one
  `batch.run`, and then waits once until every new name resolves to its
  identity. Previously each rename was its own stage with a reading before it
  and a proof after it.
- **Growth.** The composition engine grows all chains beyond the seed in one
  apply, each copied from the one before it. The adapter reuses the preflight
  reading for the first copy, the settle poll's reading for the mint diff, and
  each copy's post-rename reading as the next copy's "before" reading.
- **Insertion.** A `chain.insert` stage no longer advances the structural
  revision, and a successful one records cursor 0's track hold (the extension
  confirmed the track identity), so consecutive insertions do not re-point the
  cursor.
- **Guarded insertions (runs 6–8).** A `device.insert` with `expectedChain`
  and `expectedEnabledChain` reads nothing before its write: the extension
  pages the complete live chain and refuses the insertion unless the track,
  names and enabled flags match, so the stated chain is the mint diff's
  "before". Previously the adapter read the chain twice for stability and
  once more for the stage. The mint check reuses the second of the settle
  poll's two equal readings instead of reading again, and a refused guarded
  insertion skips the settle poll. `add_devices` states the projected chain
  (the old chain plus the inserted name, enabled) for the next native device
  instead of reading the bank; after a plug-in or preset it still reads.
  Every product caller of `device.insert` passes both guards.
- **Measurement option.** `composeDevices` takes a benchmark-only
  `measurementLimits`; no tool input reaches it. The D44 driver uses it to
  admit shapes above the limit.

Offline: typecheck and all brain tests pass (2,624 after the second change),
including new adapter tests for one rename turn, reused create readings, one
cursor point across insertions, a guarded insertion with no pre-write read
and a refused one with no settle poll, a six-chain call budget (one growth
apply) and a three-device `add_devices` budget (two bank reads, was four).

The writer-clip releases after each structural stage stay: about 70 ms per
stage (eight releases in one turn, a 25 ms settle and a track scan). The
adapter does not track which physical writer clips are pinned across calls,
and a pinned clip ignores later selection changes (E2, E3).

## Session and build

Bitwig 6.1.4 / API 25, project `gn-scale-test`. No controller replacement was
needed: `probe:hello` showed this worktree's normal build already loaded
(`normal-v1`, 94 methods, `526cd7e3760580cc`, fresh initialization), and
only brain code changed ([operator record](../data/p01-adapter-checks-live/operator.json)).
Each driver required the `chain-insert-v1` marker and no write block, and
refused any other probe driver or bridge client before every write. Each run
owned one scratch track, deleted it, and checked that every original track's
complete `read_devices` structure, the track list and the selection matched
the baseline.

## Results

[Run 1](../data/p01-adapter-checks-live/attempt-1/) reran the E406 driver
([p01-compose-live.ts](../../../brain/src/probes/p01-compose-live.ts)):

| Case | Compose ms / turns | E406 | Revert ms / turns |
|---|---:|---:|---:|
| 1×1 native | 2,360 / 80 | 2,601 / 81 | 1,471 / 53 |
| 3×2 native | 3,181 / 82 | 4,294 / 93 | 1,575 / 53 |
| Mixed: Tool, TX16Wx VST3, TX16Wx CLAP, FX Layer preset | 2,503 / 80 | 2,753 / 81 | 1,510 / 53 |
| Polysynth with one outer LFO route | 3,639 / 109 | 3,915 / 110 | 1,526 / 53 |
| Existing move + copy at position 0 | 5,038 / 166 | 5,625 / 169 | 2,382 / 82 |
| Six chains at position 18 | 8,755 / 105 | 13,742 / 133 | 2,650 / 53 |

In the six-chain case, the six renames went out as one `batch.run` (1.0 s)
with one container reading before it and one after it (about 1.9 s for the
stage, against 4.8 s). The six insertions took 2.1 s with no cursor
re-point between them. The one growth copy took about 1.6 s; its first mint
poll did not yet show the copy.

The [D44 driver](../../../brain/src/probes/p01-d44-live.ts) measured
candidate shapes ([run 2](../data/p01-adapter-checks-live/d44-attempt-1/),
`--set candidates`), the worst new-source shapes at the proposed limits
([run 3](../data/p01-adapter-checks-live/d44-attempt-2/), `--set limit`)
and existing sources ([run 4](../data/p01-adapter-checks-live/d44-attempt-3/),
`--set existing`):

| Case | Units (D67 weights) | Compose ms / turns | Revert ms / turns |
|---|---:|---:|---:|
| 4×3 native at the end | 12 | 3,659 / 83 | 1,627 / 53 |
| 4×4 native at the end | 16 | 3,839 / 83 | 1,669 / 53 |
| 4 chains of TX16Wx VST3 + CLAP at the end | 16 | 3,452 / 83 | 1,611 / 53 |
| 4 Polysynths, one outer LFO each (4 modulators) | 12 | 6,646 / 163 | 1,689 / 53 |
| 16 one-device chains at position 18 | 16 | 38,068 / 165 | 3,376 / 53 |
| 8 chains of Tool + EQ-5 at position 18 | 16 | 13,724 / 117 | 2,763 / 53 |
| 8 chains of one TX16Wx VST3 at position 18 | 16 | 13,333 / 117 | 2,829 / 53 |
| 8 existing sources (4 moves, 4 copies) into 8 chains at position 18 | 16 | 25,627 / 331 | 13,669 / 273 |

The 16-chain case spent about 20.4 s on its 11 growth copies (about 1.85 s
each, rising as container readings lengthen from 0.16 s to 0.6 s), 4.6 s on
16 renames in one turn, and 7.6 s on 16 insertions. The eight-existing case
spent 11.0 s in 36 container readings, mostly each relocation's own
preflight and proof readings, and 2.5 s in the eight moves and copies.

The shared rename and growth paths were also checked through their own tools
([run 5](../data/p01-adapter-checks-live/layer-tools-attempt-1/),
`--set layer-tools`): on a composed one-chain FX Layer,
`duplicate_layer_chain` took 1,443 ms / 32 turns with 6 container readings,
and `rename_layer_chain` 970 ms / 28 turns with 4 (before: 5). Both tool
readbacks were `verified`, and an independent `read_devices` showed `One`
and `Renamed`, each holding `Tool`.

After the guarded-insertion change, [run 6](../data/p01-adapter-checks-live/attempt-2/)
reran the E406 driver, [run 7](../data/p01-adapter-checks-live/d44-attempt-4/)
the limit set, and [run 8](../data/p01-adapter-checks-live/add-devices-attempt-1/)
`add_devices` of Tool, EQ-5, TX16Wx VST3 and Gate (`--set add-devices`):

| Case | Run 1–3 | After (runs 6–8) |
|---|---:|---:|
| 1×1 compose | 2,360 ms / 80 | 2,082 / 75 |
| 3×2 compose | 3,181 / 82 | 2,822 / 77 |
| Mixed compose | 2,503 / 80 | 2,225 / 75 |
| One outer LFO compose | 3,639 / 109 | 3,280 / 104 |
| Existing move + copy compose | 5,038 / 166 | 4,532 / 160 |
| Six chains at 18 compose | 8,755 / 105 | 7,811 / 99 |
| 8×2 native at 18 compose | 13,724 / 117 | 13,203 / 111 |
| 8 VST3 chains at 18 compose | 13,333 / 117 | 12,750 / 111 |
| `add_devices`, 2 native on an empty track | 2,652 / 84, 20 `device.list` | 1,605 / 66, 8 |
| `add_devices`, 16 native on an empty track | 18,741–19,035 / 615–616, 145–146 (four runs) | 9,087 / 416, 36 |
| `add_devices`, 2 native on 16 | 3,872–3,942 / 84, 20 (four runs) | 2,296 / 66, 8 |
| `add_devices`, Tool, EQ-5, TX16Wx VST3, Gate | — | 3,153 / 124, 14; `verified` |

Reverts were unchanged (1,486–2,925 ms). Each run passed its cleanup and
preservation checks.

Times are single samples on one fixture, not stable bounds.

## Preservation

Each run deleted its scratch track; all eleven original tracks and their
complete device structures matched the baseline, and the selection was
restored. No playback ran and no project was saved.

Reproduce the tables and the method attribution offline:

```sh
python3 context/evidence/data/p01-adapter-checks-live/summarize.py
```
