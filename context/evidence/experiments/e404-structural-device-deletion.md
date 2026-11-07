---
title: E404 — Device deletion avoids unusable parameter captures
kind: evidence
updated: 2026-10-29
owner: P01
---

# E404 — Device deletion avoids unusable parameter captures

**The deletion-only executor path now captures structure instead of parameters.**
On the focused Bitwig 6.1.4 fixture, the public `delete_device` call used zero
parameter-inventory calls instead of eight and 61 wire calls instead of 84.
Both read shapes removed the requested FX Layer, reported its removed layer,
and independently confirmed that the following Tool shifted to position zero.
Both scratch tracks were removed; original inventories and selection matched.

## Change and retained obligations

Only a nonempty batch consisting entirely of `device.delete` receives
`ReadOptions.structure: true` for its executor stash and final snapshot,
including the partial-rejection path. Mixed batches retain full captures for
their scalar writes and reversal evidence. The public removal summary was
already structural. No adapter call or independent read is removed here;
this is a payload/cursor reduction, not completion of the broader D65 read
consolidation.

This narrows the device-deletion capture obligation under D54/D15: the claim
is guarded deletion and independently observed remaining order. Complete
names/enabled-order guards, target resolution, selection protection, partial
results and final public device-bank readback remain. Full parameter state
cannot recreate a deleted plug-in/preset, and `restore: none` already described
that fact. The same unrecreated-device result remains on reversal; no inverse
or exact-state promise has been removed. Parameter inventories remain for
mixed batches that need them. Public schemas/descriptions are unchanged
(46 tools, description version 57); D44 limits are unchanged.

## Live comparison

The session used the accepted E403 v2 probe controller: `phase-8-probe-v1`,
122 methods / `d7fb35cd5e6566ba`, initialized
`2026-10-29T19:14:50.094Z`. Its normal product deletion route is unchanged by
the probe additions. The [driver](../../../brain/src/probes/p01-delete-live.ts)
ran one foreground writer, checked project/selection/ownership/clients before
writes, and used only owned `gn-p01-delete` tracks in `gn-scale-test`.
The other connected client was this session's idle MCP server, PID 58395.
No playback launch or project save ran.

Both arms created the same two-device shape: the existing empty FX Layer seed
at zero, followed by Tool. Both called `delete_device` for zero. The comparison
arm restores only the executor's two device reads to their prior full shape;
the public summary stays structural in both arms. It uses the same current
code/build, not an older archive. Retained read-shape records verify
`[structure, full, full]` versus `[structure, structure, structure]`.

| Diagnostic sample | Wire calls | Parameter-inventory calls | Reply bytes | Tool ms |
|---|---:|---:|---:|---:|
| Prior full-capture shape | 84 | 8 | 56,795 | 3,004 |
| Structural-only shape | 61 | 0 | 44,418 | 1,849 |

Parameter-inventory calls count `directparam.*` and `param.list`. Timed spans
exclude the driver's preflight, fixture creation and cleanup. These are one
sample per arm, full-capture first, while the offline full regression suite
also ran. Treat time as diagnostic under concurrent CPU load, not a stable
speedup or budget. The exact removed calls and payloads are the useful cost
result. No additional scope scroll occurred in either arm.

Raw exchanges, read shapes, public receipts and comparisons are retained in
[attempt 1](../data/p01-delete-live/attempt-1/). The
[final result](../data/p01-delete-live/attempt-1/055-result.json) contains the
table's measurements and preservation checks; no separate derived summary is
needed. Re-run only on fresh owned scratch with a current handshake and
inspected idle-client allowance:

```sh
node --import tsx src/probes/p01-delete-live.ts --out NEW_DIRECTORY --operator-file FILE --idle-client INSPECTED_PID
```

The retained driver expects the E403 probe profile; its profile gate must be
deliberately updated for a later normal-build reproduction.

## Preservation and tests

The full-capture scratch track was
`9c3ac7b5-1cf9-45ee-ac1e-f154a9e6cda0`; the structural scratch track was
`3f95cfba-9b20-4a08-9f6f-d8fce3ceeffc`. Both were deleted. All eleven original
track records and each track's public device structure matched the baseline.
Mixer selection remained `gn-sel`, index 8,
`6fb96670-abde-4958-9147-f573a4b43918`, with no selected Launcher slot.
Exit scopes were closed, with 146 aims, zero refusals and no write block.
These are observed inventory/selection claims, not exact saved-file or
unobserved parameter-state comparisons.

The 81 focused executor/call-budget tests and typecheck pass. New regressions
show that a device whose parameters are unsettled can be deleted without
parameter acquisition, reversal still reports the loss, and a mixed
delete/parameter batch retains its original scalar capture and verification.
The public call-budget test requires all three device snapshots to remain
structural without changing its adapter-call count.

The full brain suite passed 2,608 of 2,609 tests. The unrelated 16,384-note
planner timing test measured 4,162 ms against a 4,000 ms bound under concurrent
load; its entire three-test file passed when rerun alone. No timing bound was
changed. E403 retains the preceding extension verification. A running brain
server must load this worktree's updated code to use the new executor path.
