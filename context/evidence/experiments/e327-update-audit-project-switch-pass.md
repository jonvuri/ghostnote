---
title: E327 — Project switch and fresh return write pass
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E327 — Project switch and fresh return write pass

## Result

The normal product passes the project-switch check on Bitwig 6.1.4.
The separate `gn-upgrade-audit-switch` project shows only its four default
tracks and no audit tracks. The away check sends no write batch. After the
operator returns to `gn-upgrade-audit`, complete content and both selections
match the checkpoint. Only then does the driver reacquire owned target IDs.
A fresh four-field mixer write and supported reversal pass independent
readback. The final complete fixture matches the pre-switch baseline.

The [result summary](../data/bitwig-upgrade-audit/continuation-4-614/switch-result-summary.json)
retains all four snapshots, write verdicts, and costs. The
[away checkpoint](../data/bitwig-upgrade-audit/continuation-4-614/switch-away.json)
and [return checkpoint](../data/bitwig-upgrade-audit/continuation-4-614/switch-back.json)
retain the original command records. Return command
`11ffd0c3-a0e6-4305-855e-869322a3a889` checks version, profile, initialization,
project, stopped transport, selection, ownership, and competing clients.
No prior session change ID is used.

The operator asked whether to move the exclusive audio engine back to the
audit project. This checkpoint requires stopped-state reads and mixer
writes, so no engine change was requested or sent. Exclusive engine
ownership was not independently measured. The result does not prove audio
playback. The later listening check must use the audit project's engine.

## Verification and cost

The four-field write takes 266.076 ms, 15 logical calls, and 10 wire turns.
Reversal takes 361.299 ms, 22 logical calls, and 14 wire turns. E325's same
operations took 264.815 ms and 363.644 ms with the same call counts. The
changes are +0.5% and -0.6%. No timing-only repeat was made. The existing
performance model applies.

The complete fixture comparison and all inherited proof hashes pass.
Context links and staged diffs are checked. No implementation changed, so
E326's 28 focused tests and typecheck remain applicable to the driver.
E321's 2,450-test gate covers the unchanged product implementation.
Public descriptions remain v52.

## Current state and next step

The project-switch case is complete. Continuation 4 has no active driver,
lock, pause, failure, or uncertain write. Both selections are `Inst 1`,
Launcher row 0. The six owned audit tracks remain muted at -18 dB, with
one original Sampler on each sample track and an empty device test track.
The operator-created group is absent. Transport is stopped.

The operator must inspect the retained Attack mapping and loaded resources
in both original Samplers before save/reopen. This observation is separate
from the earlier edited-preset exports. Restore both selections before the
next driver command. Then run `checkpoint save` and follow the save/reopen
steps in the [driver guide](../../plan/phase-9/9b-update-audit-driver.md).
Listening, cleanup, section 3 acceptance, and the separate 9b.6 doctor remain
pending.
