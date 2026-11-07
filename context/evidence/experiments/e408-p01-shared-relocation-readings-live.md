---
title: E408 — P01 shared relocation readings, live
kind: evidence
updated: 2026-11-07
owner: P01
---

# E408 — P01 shared relocation readings, live

**Positive.** With consecutive existing sources sent in one apply and each
relocation's readings reused by the next, staged `compose_devices` of 8
existing sources (4 moves, 4 copies) into 8 chains at position 18 took
17.0 s / 219 wire turns, against
[E407](e407-p01-adapter-checks-and-d44-live.md)'s 25.6 s / 331. Container
readings fell from 36 (11.0 s) to 24 (6.3 s). The composition read back
independently, `revert_change` restored the exact prior structure in 12.0 s
(E407: 13.7 s), and the scratch track was removed with every original track,
the track list and the selection preserved. The E406 driver's six cases
also passed, each within 0.15 s of E407's runs 6–7.

## Change under test

Brain only; the extension is unchanged.

- **Adapter readings.** A `chain.relocate` stage reads its source and
  destination before the write and polls both until the transfer is proved
  (`relocationReading`, `finishRelocation`). Each relocation previously took
  three readings of the top level and the container: the batch preflight,
  the stage's own "before" reading and the proof. Now the batch preflight's
  readings serve the first relocation stage, and the proving readings serve
  the next stage's "before" reading. Only an endpoint they lack is read; a
  reading without the named-slot descent does not serve a device-slot
  endpoint. Input validation and the encoder's source-name guard still run
  on the reused readings.
- **Stop after an unproved relocation.** Later relocations in the same batch
  were projected from the earlier ones, so a relocation that is refused or
  not proved ends the batch. This also applies to `move_devices` and
  `copy_devices` of several devices, which already send one batch.
- **Engine.** Consecutive existing sources share one apply, one
  `chain.relocate` stage each, projected from the stages before it. The first
  unproved stage ends the proved run, as for chain growth. A change of
  source kind ends the batch, so new sources still share one
  `chain.insert` batch.

Offline: typecheck and all 2,627 brain tests pass, including three new
tests. Three relocations in one batch take five container readings (two
preflight addresses and one proof each; previously eight); a refused first
relocation sends no further moves (previously all three); three consecutive
existing sources use the same number of applies as one (previously two
more), and their reversal restores the original order and enabled flags.
The first two tests fail on the previous adapter and the third on the
previous engine.

## Session and build

Bitwig 6.1.4 / API 25, project `gn-scale-test`. `probe:hello` passed with
this worktree's normal build (`normal-v1`, 94 methods, `526cd7e3760580cc`),
the same initialization as E407; only brain code changed, so no controller
replacement was needed ([operator record](../data/p01-relocation-live/operator.json)).
Each driver refused any other probe driver or bridge client before every
write, owned one scratch track and deleted it, and compared every original
track's complete `read_devices` structure, the track list and the selection
with the baseline.

## Results

[Run 1](../data/p01-relocation-live/existing-attempt-1/) reran the
[D44 driver](../../../brain/src/probes/p01-d44-live.ts) with
`--set existing`:

| Case | Compose ms / turns | E407 | Revert ms / turns | E407 |
|---|---:|---:|---:|---:|
| 8 existing sources (4 moves, 4 copies) into 8 chains at position 18 | 17,011 / 219 | 25,627 / 331 | 11,999 / 265 | 13,669 / 273 |

| Compose calls | E408 | E407 |
|---|---:|---:|
| `chain.observe` | 24 (6.3 s) | 36 (11.0 s) |
| `device.list` | 13 (1.4 s) | 36 (3.9 s) |
| `revision.get` + `track.list` | 54 (1.2 s) | 124 (2.6 s) |
| `batch.run` | 13 (4.6 s) | 13 (4.7 s) |

The eight transfers now cost one executor apply instead of eight. The
writer-clip releases after each structural stage remain (72 `cursor.pin`,
1.6 s). Reversal is unchanged code apart from the first stage's shared
reading; it still extracts and restores each moved device in its own apply.

[Run 2](../data/p01-relocation-live/compose-attempt-1/) of the
[E406 driver](../../../brain/src/probes/p01-compose-live.ts) stopped before
its first write: its client check matched the shell command that launched
it, because that command line contained the probe path and a pipe. The
retained track list shows the 11 original tracks and no scratch track.
[Run 3](../data/p01-relocation-live/compose-attempt-2/) launched the driver
without a pipe:

| Case | Compose ms / turns | E407 runs 6–7 | Revert ms / turns |
|---|---:|---:|---:|
| 1×1 native | 2,058 / 75 | 2,082 / 75 | 1,503 / 53 |
| 3×2 native | 2,840 / 77 | 2,822 / 77 | 1,629 / 53 |
| Mixed: Tool, TX16Wx VST3, TX16Wx CLAP, FX Layer preset | 2,176 / 75 | 2,225 / 75 | 1,551 / 53 |
| Polysynth with one outer LFO route | 3,324 / 104 | 3,280 / 104 | 1,522 / 53 |
| Existing move + copy at position 0 | 4,399 / 157 | 4,532 / 160 | 2,297 / 80 |
| Six chains at position 18 | 7,691 / 99 | 7,811 / 99 | 2,683 / 53 |

Every readback was `verified`, every revert restored the prior structure,
and cleanup and preservation passed in both completed runs.

## Interpretation and limits

- D67's limits are unchanged. Its worst measured case, 8 existing sources,
  fell from 25.6 s to 17.0 s. Weighting an existing source as one unit would
  admit 16 existing sources, which has not been measured.
- A thrown adapter error in the middle of a relocation batch now loses the
  attribution of the batch's earlier, completed transfers, as it already
  did for a batch of new sources. The final read still reports what landed,
  and a moved device it cannot attribute is not claimed, so reversal refuses
  instead of removing it.
- Single-run timings on one fixture; no repeat distribution was measured.
