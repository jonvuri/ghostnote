---
title: E329 — Sampler listening and live cleanup pass
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E329 — Sampler listening and live cleanup pass

## Result

The operator heard both Samplers after reopening the working project.
The multi preset was a bit quiet, described as inherent and easily fixed;
no other audible problem was reported. The operator completed engine
activation, playback, stop, mixer restoration, and selection restoration.
The subsequent complete fixture comparison passes. No persistent gain or
other fixture change remains from the listening check.

The [listening report](../data/bitwig-upgrade-audit/continuation-4-614/sampler-listening-operator.json)
retains the operator's words and the limits. No loudness measurement or
comparison at equal level was made. This is an audible functional check,
not an audio-quality or latency benchmark. The earlier meter-only observation
is not used as listening evidence.

The [combined observation input](../data/bitwig-upgrade-audit/continuation-4-614/sampler-observation-input.json)
contains the confirmed resources, zones, Attack mappings before save and
after reopen, listening results, and three explicit removed-target results.
The [observation checkpoint](../data/bitwig-upgrade-audit/continuation-4-614/sampler-observation.json)
passes independent complete fixture equality. Keep both files: the checkpoint
file contains the live snapshot, while the input retains the operator facts.

## Sampler limits

The [removed-target evidence](../data/bitwig-upgrade-audit/continuation-4-614/removed-target-evidence.json)
records exact-name absence of Play Mode, Freeze Playhead, and Envelope Mode
from both preserved 53-parameter live direct-control reads. Complete donor
and independent 6.1.4 host-export route inventories contain only Attack
routes. Both host-export hashes are verified. These fixtures contain no
routes to the removed targets, so their migration or rejection is untested.
This evidence does not claim global host absence or successful preservation
of a removed target. E318 records the related host release-note limits.

The before-save and after-reopen operator inspections confirm the retained
LFO-to-Attack mappings and healthy waveforms for `7 Reso Chime.aiff` and both
`ASM Chord C7.wav` and `ASM Chord C9.wav`. Normal readers do not expose all
zone state or modulation amounts. Those claims use the separate operator
reports and earlier independent host exports.

## Cleanup and verification

A separate read-only inspection matches the verified fixture. Cleanup then
checks that inspection, current ownership, and the preserved baseline before
it removes the six owned tracks. Each deletion has an independent absence
check. The final complete readback matches the original preserved entry.
Only `Inst 1`, `Audio 2`, `FX 1`, and `Master` remain. Mixer and Launcher
selection are `Inst 1`, row 0. Transport is stopped.

The [cleanup record](../data/bitwig-upgrade-audit/continuation-4-614/cleanup.json)
and [result summary](../data/bitwig-upgrade-audit/continuation-4-614/cleanup-result-summary.json)
retain the full comparison and individual write results. Cleanup command
`3eb38e1d-42bc-4196-b221-c9c2b33d5c80` uses fresh normal-profile, version,
initialization, project, stopped-transport, selection, and client guards.
No unowned object is deleted. No agent engine, transport, or save command
is sent.

The six single-track deletions take 544.042–602.821 ms, with 28–29 logical
calls and 15–16 wire turns. The three 29-call, 16-turn samples take
584.303–602.821 ms. E258's same-count single-track deletion took 594 ms;
the current range is -1.6% to +1.5%. Contents and host sessions differ.
The other three calls use 28 calls and 15 turns and are not equal-count
comparisons. No timing-only repeat was made. The existing product model
applies.

All inherited proof hashes match. Context links and staged diffs are checked.
No implementation changed; the E326 driver checks and E321 product gate
remain applicable. Public descriptions stay v52.

## Next step

Continuation 4 is paused at `cleanup-save`, with no owned tracks, active
driver, lock, failure, or uncertain write. The saved working file still
contains the persistence fixture until the operator saves the clean project.
The preserved `saved-project.bwproject` evidence copy must remain unchanged.

The operator must save only the cleaned working `gn-upgrade-audit` project
and leave it open and stopped. After confirmation, run
`checkpoint cleanup-saved`, then `report`. Complete section 3's consolidated
matrix, performance comparison, limits, and upgrade verdict. General
acceptance still gates the separate 9b.6 doctor.
