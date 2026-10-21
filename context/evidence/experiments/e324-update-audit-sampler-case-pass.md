---
title: E324 — Single and multi Sampler case passes
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E324 — Single and multi Sampler case passes

## Result

Both corrected Sampler edit/export/reversal checks pass. The multi host
export preserves both attack routes and both packaged sample references.
The operator confirms loaded waveforms without warnings for both zones.
The supported in-session reversal removes only the inserted multi Sampler.
The complete final fixture, original controls, copied donors, and both
selection states match the case baseline.

The Sampler driver exited successfully. The next read-only selection
checkpoint also passed and exited. It now waits for the operator to select
the sentinel mixer track. No driver, live client, or evidence lock remains.
General acceptance still requires the remaining operator, persistence,
listening, and cleanup checks.

## Multi export and observations

The [copy record](../data/bitwig-upgrade-audit/continuation-3-614/multi-export-copy.json)
retains the library and working paths. The fresh file was copied without
overwriting a destination, and the bytes match. The host export contains
13,409 bytes, SHA-256
`7a74aaf75e2cb5181ab2b1c6a013ee74965fd20d87b3960b4dc44b6f2c824e99`.
The [evidence copy](../data/bitwig-upgrade-audit/continuation-3-614/sampler-multi-host-export.bwpreset)
and [full result](../data/bitwig-upgrade-audit/continuation-3-614/sampler-multi-edit.json)
retain the bytes, route inventory, metadata, control reads, and operator
observations. The working path is
`/Users/jonvuri/Bitwig Upgrade Work/2026-10-21/gn-ua-0b6c3297-multi-edited.bwpreset`.

The operator's two screenshots show All Zones with two named samples. The
[observation record](../data/bitwig-upgrade-audit/continuation-3-614/multi-operator-observations.json)
retains the facts:

| Sample | Key range | Root | Other observed values |
| --- | --- | --- | --- |
| ASM Chord C7.wav | C−2 through B2 | C7 | Loaded waveform; no warning; gain 0 dB; play range 0 ms–2.00 s |
| ASM Chord C9.wav | C3 through G8 | G8 | Loaded waveform; no warning; gain 0 dB; play range 0 ms–2.00 s |

Both show velocity 1–127 and Select 0–127. These are current 6.1.4 zone
observations, not an independent comparison with the old host's zone UI.
The operator restored the `Inst 1` track header and first empty Launcher
cell. Mixer settings were not changed; the tracks remained muted at their
audit values. Fresh driver guards confirmed stopped transport before writes.

The operator clarified the earlier playback report: signal was observed on
the post-device dB meter while muted. This does not establish audible output.
It supersedes the earlier interpretation in the copy and guidance notes.
The required listening check remains pending.

## Reversal and complete comparison

The existing terminal session `88497` resumed with only the confirmed
observations. The driver checked the fresh host file, original route
retention, one new attack route at amount 0.3, and equal packaged references
for `ASM Chord C7.wav` and `ASM Chord C9.wav`. It kept the current server
session through the supported reversal. Independent readback confirms
removal of only multi device position 1. A separate bank read leaves one
Sampler, original base controls match, and the copied donor fingerprint is
unchanged.

The [case snapshot](../data/bitwig-upgrade-audit/continuation-3-614/sampler.json)
records `passed: true` and complete before/after equality. The
[case summary](../data/bitwig-upgrade-audit/continuation-3-614/sampler-case-summary.json)
retains both exports, both edit verdicts, both reversals, and costs. The
final selection is mixer `Inst 1`, Launcher track `Inst 1`, row 0. Six owned
fixture tracks remain, with one original Sampler on each sample track.
The device test track is empty. The original four tracks remain preserved.
The active Sampler case and operator pause are cleared, with no failure or
pending uncertain write. No project save, launch, engine, or Grid command
was sent by the agent.

## Next checkpoint and verification

The [selection-before record](../data/bitwig-upgrade-audit/continuation-3-614/selection-before.json)
and [command output](../data/bitwig-upgrade-audit/continuation-3-614/selection-before.txt)
prove the complete entry fixture before the next operator action. The
request is to select only the `gn-ua-0b6c3297-sentinel` track header and keep
transport stopped. A Launcher-cell change is not needed. After confirmation,
run `checkpoint selection-after`. It checks preserved content, then runs
the guarded mixer write/reversal while preserving the changed selection.
The later `selection-restored` checkpoint requires both original selections.
Continue with the group and remaining steps in the
[driver guide](../../plan/phase-9/9b-update-audit-driver.md).

The multi reversal takes 1,402.881 ms, 50 logical calls, 35 wire turns, and
823 ms summed wire time. The single reversal took 1,396.586 ms with the same
calls and turns. The resource workloads differ; these are local samples,
not a capacity result. Operator pauses are excluded. No timing-only repeat
was made. Existing ledger models apply and no implementation changed.
E321's full 2,450-test gate remains applicable. All inherited source hashes
match. Context links and staged diffs were checked.
