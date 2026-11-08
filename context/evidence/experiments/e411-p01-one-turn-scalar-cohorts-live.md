---
title: E411 — P01 one-turn scalar cohorts, live
kind: evidence
updated: 2026-11-07
owner: P01
---

# E411 — P01 one-turn scalar cohorts, live

**Positive.** `set_device_controls` now writes all settings of one device
route in one `batch.run` and proves them with the executor's single
readback. A native route takes 1.33–1.35 s and 34 wire turns for 1, 8 or 44
Polysynth controls; the same-session baseline took 2.2 / 3.4 / 9.4 s
(55 / 90 / 270 turns). Sixty-four remote controls took 1.24 s (4.66 s), and
eight controls of an EQ-5 inside a layer chain 1.44 s (3.57 s).
`set_track_mixer` lost its selection capture: 215–216 ms / 13 turns
(238 ms / 14). Every write read back independently through the read tool
with each requested value and every unrequested DirectParameter unchanged.
Reverts, cleanup and preservation passed.

## Change under test

Brain only; the extension and wire are unchanged.

- **One turn per route** (`LiveAdapter.applySuppliedParameterCohort`). A
  validated same-route cohort with a supplied preflight is sent as one
  `batch.run`; each op keeps its own receipt with the extension's own result
  for it. The per-write completion read, the cohort integrity polls and the
  adapter's settled inventory after the last write are gone for this path.
  The executor's verify read already compares the requested values and every
  unrequested DirectParameter of the device with the preflight.
- **No pre-write chain read.** Each scalar frame states the complete
  top-level chain (names and enabled states), the track, the route and the
  target name, and the extension refuses a write when any of them differs
  (`ParamHandlers.verifyParameterTarget`). The adapter's own `device.list`
  before the write repeated the surface's read and unpinned the device
  cursor, which forced a full re-point.
- **One selection scope for the tool call.** `setDeviceControls` runs the
  bank read, each preflight, each write and each readback in one scope, so
  the device cursor keeps the target that the preflight confirmed: the write
  and the readback each confirm it with one `devcursor.status`.
- **Mixer.** `Executor.run` takes no selection capture for a batch of only
  `mixer.set`: a mixer write points no cursor and moves no selection (E257).
- **Unchanged.** A scalar batch without a supplied preflight (the
  `revert_change` path, managed FX chains) keeps its per-stage proofs. Input
  validation, discrete-domain refusal, the target and chain guards, the
  revision and scene guards, and the per-scalar change records are unchanged.

A refused op no longer stops later ops of its route: the extension's
`batch.run` continues after a refused op, and each later frame carries its
own complete guard. The public description states this (descriptions v63).
An unrequested parameter change is still reported, unattributed, and stops
later routes.

## Session

Bitwig 6.1.4 / API 25, project `gn-scale-test`. `probe:hello` passed with the
normal build already loaded (`normal-v1`, 94 methods, `526cd7e3760580cc`,
fresh initialization, B18 marker), so no controller replacement was needed
([operator record](../data/p01-scalar-live/operator.json)).

The [driver](../../../brain/src/probes/p01-scalar-live.ts) refuses another
probe driver or bridge client and checks the project and scratch identity
before every write. It owns one scratch track, adds a Polysynth and an FX
Layer with one EQ-5, writes through MCP dispatch, reads every write back with
`read_device_controls` or `read_track_mixer`, reverts one control and the
mixer change, deletes the track, and compares the track list, every original
track's `read_devices` structure, the mixer of the first eight tracks and the
selection with the baseline. The baseline ran the same driver against the
HEAD brain (`191def2f`) in a temporary worktree, in the same session.

## Results

| Case | Baseline (HEAD) ms / turns | Change runs 1, 2 ms / turns |
|---|---:|---:|
| 1 Polysynth control | 2,212 / 55 | 1,349, 1,330 / 34 |
| Its `revert_change` | 2,763 / 61 | 2,746, 2,782 / 61 |
| 8 Polysynth controls | 3,379 / 90 | 1,342, 1,345 / 34 |
| 44 Polysynth controls (every continuous one) | 9,365 / 270 | 1,333, 1,341 / 34 |
| 64 remote controls | 4,655 / 105 | 1,238, 1,244 / 30 |
| 8 EQ-5 controls inside a layer chain | 3,566 / 94 | 1,439, 1,433 / 36 |
| `set_track_mixer`, 3 fields on 1 track | 238 / 14 | 216, 215 / 13 |
| Its `revert_change` | 334 / 21 | 311, 313 / 20 |

[Summary](../data/p01-scalar-live/summary.json) from
[summarize.py](../data/p01-scalar-live/summarize.py); every wire call of each
tool call is in the run directories.

In the 44-control call (change run 1) the surface bank read took 0.24 s,
the preflight inventory 0.55 s, the cohort preparation and the one
`batch.run` 0.1 s, and the executor readback 0.38 s, the last two inventory
reads each including Bitwig's parameter settle of about 0.2 s. The baseline
spent 88 `directparam.completion` and 95 `directparam.list` calls on the same
call; the change spends 0 and 6.

Baseline run 1 stopped in the nested case: the driver chose EQ-5's band type,
a switch without a reported discrete domain, and 0.75 never read back (the
same class as E252's Diva switches). All effects were on the scratch track;
the [cleanup](../data/p01-scalar-live/baseline-head-1/044-cleanup.json)
deleted it and matched the track list and selection with that run's
baseline. The driver then wrote only gain, frequency and Q controls.

## Interpretation and limits

- A native route is now flat in its setting count; the cost is three
  inventory reads (bank, preflight, readback). A plug-in route still grows
  with its DirectParameter count through the two inventory reads; Diva was
  not remeasured.
- D44's `set_device_controls` limits (64 settings, 4 routes) were set from
  per-setting costs that are gone. Re-deriving them needs a plug-in
  measurement (for example 4 Diva routes) and is not done here.
- The single-control `revert_change` is unchanged (2.7 s): it has no
  supplied preflight and keeps the per-stage path.
- Two change runs and one baseline run on one fixture; no wider distribution.
- Coupled parameters, where one write moves another requested parameter, now
  land in one host turn. The final readback reports such a difference; no
  coupled pair was in the fixture.

## Verification

Offline: typecheck and all 2,656 brain tests pass. Changed or new tests
cover one `batch.run` for a supplied direct cohort with no completion, poll,
chain read or cursor re-point inside one selection scope; four nested remote
controls in one turn; a refused remote write with its own receipt and later
writes kept; an unrequested delta reported by the executor readback; the
unsupplied path's polls and fallbacks; and the mixer write without a
selection capture. The adapter-level call budgets are unchanged
(`set-controls`: devices 1, read 2, apply 1, delta 1).
