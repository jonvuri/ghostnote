---
title: E328 — Saved project and fresh reopen write pass
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E328 — Saved project and fresh reopen write pass

## Result

The saved working project reopens on Bitwig 6.1.4 with complete fixture
and selection equality. The saved file is unchanged. After the comparison,
the driver reacquires owned target IDs and performs a fresh four-field mixer
write and supported reversal. Independent readback verifies both operations.
The final complete fixture matches the state before saving.

The [result summary](../data/bitwig-upgrade-audit/continuation-4-614/reopen-result-summary.json)
retains the before-save snapshot, reopened snapshot, final readback, file
identity, and per-call results. The
[persistence record](../data/bitwig-upgrade-audit/continuation-4-614/persistence.json)
and [reopen checkpoint](../data/bitwig-upgrade-audit/continuation-4-614/reopen.json)
retain the driver evidence. Command `d8263d59-57c1-4081-ae6a-1de4b9f3f49f`
checks the normal profile, version, initialization, project, stopped transport,
selection, ownership, and competing clients before the write.

The operator saved and reopened only the working project at
`/Users/jonvuri/Bitwig Upgrade Work/2026-10-21/gn-upgrade-audit/gn-upgrade-audit.bwproject`.
The [saved evidence copy](../data/bitwig-upgrade-audit/continuation-4-614/saved-project.bwproject)
is 72,901 bytes. Its SHA-256 is
`b01ba21f2f2a6d790fddbc9663a278721d23d14935a4dc067f76e4bdf809970b`.
The source file and evidence copy match before and after reopen. No agent
save, engine, transport, or controller command was sent.

## Verification and cost

The mixer write takes 261.630 ms, 15 logical calls, and 10 wire turns.
Reversal takes 359.557 ms, 22 logical calls, and 14 wire turns. E327's same
operations took 266.076 ms and 361.299 ms with equal call counts. The changes
are -1.7% and -0.5%. No timing-only repeat was made. The existing performance
model applies; no implementation or description changed.

Complete fixture equality, saved-file identity, and all inherited proof
hashes pass. Context links and staged diffs are checked. E326's 28 focused
tests and typecheck remain applicable to the unchanged driver. E321's
2,450-test gate covers the unchanged product implementation. Descriptions
remain v52.

## Limits and next step

Normal readers do not expose all sample-zone state or modulation amounts.
The [before-save operator report](../data/bitwig-upgrade-audit/continuation-4-614/sampler-before-save-operator.json)
confirms the original LFO-to-Attack mappings and healthy waveforms in both
Samplers. The equivalent after-reopen inspection is pending. Audible
listening is also pending. Exclusive engine ownership was not measured.
These limits prevent a complete Sampler persistence or playback verdict.

Continuation 4 has no pause, active driver, lock, failure, or uncertain write.
Both selections are `Inst 1`, Launcher row 0. Six owned tracks remain muted
at -18 dB, with the original fixture content. Each sample track has one
original Sampler; the device test track is empty. The group is absent and
transport is stopped.

Obtain the after-reopen Sampler observations, then perform the short operator
listening check. Restore mixer values and both selections before the next
driver command. Complete the Sampler observation checkpoint, cleanup, and
section 3 through the [driver guide](../../plan/phase-9/9b-update-audit-driver.md).
General acceptance still gates the separate 9b.6 doctor.
