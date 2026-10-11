---
title: E264 — Device-add revert report
kind: evidence
state: done
updated: 2026-10-11
owner: phase-8i15
---

# E264 — Device-add revert report

## Status

[8i15](../../plan/phase-8/8i15-device-add-revert-report.md) is complete. It
closes issue D8 of the
[issue log](../../plan/phase-8/8i-dogfood-issues.md).
`check_revert` and `revert_change` name each object that a revert removes,
and the fidelity of a revert states what the revert restored
([D49](../../decisions/d49-revert-fidelity-states-what-the-revert-restored.md)).
The normal profile no longer registers `slot.duplicateClip`.

Tool descriptions are `ghostnote-description-v48` (fingerprint
`1759a278fc4afa63210ab5f6d938b799d020a1f7924acde2f58718affec8b282`):
`check_revert` and `revert_change` changed. `stable-v1` descriptions are
not changed. The normal build has 92 methods, hash `8be1975eaa99d78f`.
The probe build keeps 111 methods, hash `9b339de4e9bb08da`.

Data: `context/evidence/data/phase8i15-revert/accept.json`. Driver:
`brain/src/probes/phase8i15-revert.ts accept <dir>`.

## Reproduction and survey (fake adapter)

`add_devices` (two devices), then `check_revert` and `revert_change` for
each change, gave the D8 result: `wouldWriteAnything: true`,
`fullyRestorable: true`, empty `wouldRestore`, `wouldNotRestore`,
`restored`, and `notRestored` lists, and an effect with `fidelity: none`.

The cause is as the plan inferred. A device add has no prior address, so
the reversal plan holds a `device.delete` op and no address. The effect
fidelity was the fidelity of the reversal change itself, and a
`device.delete` target has `restore: 'none'`.

| Tool | Reversal | Report before 8i15 |
|---|---|---|
| `add_devices` | Deletes the device | Empty lists, `fidelity: none` (D8) |
| `add_launcher_clip`, `copy_launcher_clips` | Deletes the clip | `restored` names the clip slot and its 16 note channels. `fidelity: lossy`: a clip delete cannot be reversed exactly |
| `add_tracks`, `duplicate_track` (the create change) | None: the track stays | `nothing-to-revert`; `notRestored` gives the reason |
| `add_tracks`, `duplicate_track` (the name change) | Restores the name | `restored` names the track, `fidelity: exact` |
| `add_scenes` | None: the scene stays | `nothing-to-revert`; `notRestored` gives the reason |
| `duplicate_layer_chain` | None: the layer chain stays | `nothing-to-revert`; `notRestored` gives the reason |

Only two reversals remove an object: the device add and the clip add or
copy. The other four tools do not remove; their reports were correct and
are not changed.

## Change

- `reversalReport` (`brain/src/surface/report.ts`) builds `wouldRemove`
  from the delete ops of the reversal plan (`removalsOf`): a device with
  track, position, and name, and a clip with track and row. It also gives
  the revert fidelity: the worst label of the restored places, at most
  `lossy` when a part is not restored, and `none` when the plan writes
  nothing.
- `check_revert` returns `data.wouldRemove` and `data.fidelity`.
  `revert_change` returns `readback.removed`. Its effect has `fidelity`
  (what the revert restored) and `redoFidelity` (the fidelity of the
  reversal as a change of its own). The stages of a composition reversal
  use the same two fields: `exact` for a stage with a verified readback.
- One form for both removal reversals: the removed object is in
  `removed`. A removed clip stays in `restored` too, because its empty
  slot is a place with a prior state. A removed device has no prior place.
- A removal that did not apply is not reported as removed
  (`unappliedOps`). See "Refusal in the wrong order".
- No host call is added. The call-budget tests pass unchanged.

## Refusal in the wrong order

The delete of an added device carries the complete device order that the
add left. With two added devices, a revert of the first add while the
second device is there does not match that order.

- Live adapter: the guard throws before the write (`InvalidOpError`).
  Before 8i15 the result was a failure with code `invalid-input` and the
  message "The host cannot represent the requested device.delete
  exactly". Nothing was removed.
- Fake adapter: the guard was a failed op in the receipt. The result was
  `applied: true` with readback `differs` and no reason, and the device
  stayed. This did not agree with the live adapter.

Now the fake adapter throws as the live adapter does, and `revert_change`
refuses with code `target-changed` at stage `guard`: the message tells
the agent to revert the later device changes first, `detail.notRemoved`
names the device, and `detail.hostError` has the host text. The
description states the order rule. `add_devices` already returns
`next.revert.changeIds` newest first.

## Live check

Normal profile (`normal-v1`, 92 methods, `8be1975eaa99d78f`),
`gn-scale-test`, one scratch Instrument track (`gn-8i15-a`). The driver
read the device list with `read_devices` after each step.

| Step | Result | Time | Wire calls, turns |
|---|---|---|---|
| `add_devices`, Polysynth and Delay+ | Two effects, `fidelity: exact`; readback `verified` | 2,227 ms | 84, 60 |
| `check_revert`, each add | `wouldRemove` names the device (track, position, name); `fullyRestorable: true`; `fidelity: exact` | 52 ms; 45 ms | 4, 2 |
| `revert_change`, first add while the second device is there | Refused: `target-changed`, stage `guard`, no write; `detail.notRemoved` names Polysynth; both devices stay | 810 ms | 26, 21 |
| `revert_change`, second add | `removed` names Delay+ at position 1; `fidelity: exact`, `redoFidelity: none`; `verified`; the track holds Polysynth | 1,875 ms | 53, 38 |
| `revert_change`, first add | `removed` names Polysynth at position 0; `fidelity: exact`, `redoFidelity: none`; `verified`; the track holds no device | 1,527 ms | 53, 38 |
| `revert_change`, the content change of an added clip | `restored` names channel 1; `removed` is empty; `fidelity: exact`, `redoFidelity: exact` | 1,410 ms | 42, 33 |
| `check_revert`, the clip creation | `wouldRemove` names the clip (track, row) | 359 ms | 11, 9 |
| `revert_change`, the clip creation | `removed` names the clip; `fidelity: exact`, `redoFidelity: lossy`; `verified` | 1,122 ms | 42, 27 |

The track held the prior device list (no device) after the two reverts.

## Cost

The plan expected no added host call, and the result agrees. A device-add
revert takes 1,527 ms and 1,875 ms (53 wire calls, 38 turns, one write).
S2 (E262) measured 1.4 s to 2.3 s for each call with the client time
included, so no number regressed. The clip-creation revert (1,122 ms, 42
calls, 27 turns) equals the E263 copy revert (1,115–1,179 ms, 42 calls, 27
turns). The ledger has a new row for the device-add revert.

## Extension: `slot.duplicateClip`

The product does not send `slot.duplicateClip` after 8i14. The method is
now in the probe-only set (`ACTIVE_PROBE`, `RuntimeProfile.java`), and
`slotDuplicateClip` is removed from the wire map. The normal profile has
92 methods and the capture profile 97.

The plan named `HISTORICAL`. Five advertised probe commands send the method
as raw fixture setup (`phase8d-cache-lifecycle`, `phase8e-cache-scale`,
`phase8g-shadow-cache`, `phase8g-shadow-structure`, and `e20b-duplicate`,
which measures the method itself); `phase7b-stepdata-observer.ts` sends it
too. The wire map test refuses an advertised probe that names a
historical method. The probe-only set keeps these drivers valid, and the
probe profile keeps its method set and hash.

The operator replaced the controller. `probe:hello` passed: profile
`normal-v1`, 92 methods, `8be1975eaa99d78f`, a fresh initialization time,
`fineSteps` 4,194,304, and the build markers of 8i14 and earlier. The
deployed archive has SHA-256
`8f7f6c895cb7e11e4ea654b4fccbc8d52df439d3aadebae47b6174d3a91c6928`.

## Verification

- `npm run check` in `brain/`: typecheck and 2,323 tests pass.
- New tests: the device case with the refusal in the wrong order
  (`agent-native-devices.test.ts`), the clip copy case
  (`agent-native-clips.test.ts`), the description cohort v48, and the
  wire map tests for the profile. `readback-unavailable.test.ts` and
  `call-budget.test.ts` pass unchanged.
- The live check above.

## State after the session

`gn-scale-test` has its baseline tracks, 10 scenes, and mixer `gn-sel`
selected. `selection.status` reports a slot of the deleted scratch track
(track index 9, row 0; issue D11). The entry value after the controller
replacement was no slot. The transport was not started.

## Limits

- `check_revert` does not read the device order, so it reports
  `wouldRemove` for a device add that `revert_change` refuses in the
  wrong order.
- A device from a preset file has no recorded name: `removed` gives its
  track and position only, and its delete has no order guard (the result
  has a caveat).
- The live check did not run a partial removal (one op of a reversal
  applied, one refused). The unit tests cover the refusal of a whole
  reversal.
- The fake adapter throws only for the order guard of a `device.delete`
  stage. Its other guards stay failed ops in the receipt.
- No dogfood rerun of S2 was made with v48.

## Retrospective

The first live run failed its own assertion: the fake adapter and the
live adapter gave different results for a refused delete guard. A new
tool result that depends on a guard refusal needs one live run of the
refusal before the report form is fixed. NOW has this fact. The plan
named `HISTORICAL` for a method that advertised probes still send; a plan
that retires a wire method must first search `brain/src/probes` for it.
