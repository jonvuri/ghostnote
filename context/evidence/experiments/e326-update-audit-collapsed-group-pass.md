---
title: E326 — Collapsed-group note checks pass after snapshot correction
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E326 — Collapsed-group note checks pass after snapshot correction

## Result

The normal product passes both note edits and their reversals through the
collapsed `gn-ua-0b6c3297-group` on Bitwig 6.1.4. An old document reference
refuses with `stale` and no effects. Independent complete readback proves
that content, mixer values, group folding, and both selections match the
grouped entry. The operator-created group contains only notes and spare.

The [result summary](../data/bitwig-upgrade-audit/continuation-4-614/group-result-summary.json)
retains the ungrouped checkpoint, grouped entry, final readback, individual
verdicts, and costs. Command `cf75c687-9c1f-451d-9c07-37412fc0ce4e` checks
the normal profile, project, initialization, owned targets, stopped transport,
selection, and competing clients before the case. The normal product and
public descriptions remain unchanged at v52.

## Pre-write refusal and correction

The first `group-after` command in continuation 3 stopped while it took its
entry snapshot. It tried to read the occupied group Launcher slot as a clip
document. The product correctly refused `group-slot` with no effects.
The [failure proof](../data/bitwig-upgrade-audit/group-snapshot-fix-614/prewrite-failure-proof.json)
records no pending write and zero `batch.run` calls. The failure is retained.

The driver now records group slots as aggregate occupancy. It reads child
clip documents through their track IDs. The existing limit of eight slot
reads per track stays in place. Local validation checks the exact group,
both hidden children, complete slot coverage, and all preserved content.

The bounded `recover-group-snapshot` command admits only this pre-write
failure. It checks at most 2 MiB of reader logs and takes one complete
snapshot. The [recovery](../data/bitwig-upgrade-audit/continuation-3-614/group-snapshot-recovery.json)
passes without a write batch. Continuation 4 keeps the original ungrouped
checkpoint and pins the parent state and prior evidence by hash. No failed
write was repeated. The corrected group case runs only after this inspection.

## Verification and cost

The [focused tests](../data/bitwig-upgrade-audit/group-snapshot-fix-614/tests.txt)
pass all 28 cases. They cover the actual snapshot boundary, child document
reads, refusal of unsafe recovery, and retention of the original checkpoint.
[Typecheck](../data/bitwig-upgrade-audit/group-snapshot-fix-614/typecheck.txt)
passes. E321's 2,450-test gate covers the unchanged product implementation;
it does not include this later driver correction. Context links and diffs
are checked for this record.

| Operation | Grouped time | Logical calls / wire turns | Earlier ungrouped time | Change |
| --- | ---: | ---: | ---: | ---: |
| First note edit | 2,457.785 ms | 50 / 38 | 2,025.299 ms | +21.4% |
| Stale refusal | 482.638 ms | 12 / 9 | 358.426 ms | +34.7% |
| First reversal | 2,496.825 ms | 42 / 33 | 2,059.183 ms | +21.3% |
| Second note edit | 2,429.237 ms | 50 / 38 | 1,987.778 ms | +22.2% |
| Second reversal | 2,492.378 ms | 42 / 33 | 2,059.203 ms | +21.0% |

These results exceed the 20% comparison threshold. The edit and reversal
samples use different host paths: the collapsed target uses
`cursor.pointExpanded`; the ungrouped case uses `cursor.pointTrack` with
pin and selection calls. The grouped operations use six fewer calls and
turns. The first edit's summed wire time rises from 1,466 to 1,951 ms, while
brain CPU time falls from 37.797 to 34.764 ms. The stale refusal has the
same call count but a different group state. These single samples do not
isolate a version regression or timing noise. No timing-only write repeat
was made. Section 3 must retain this comparison limit. The existing grouped
product model applies; the snapshot fix adds no host call or poll.

## Current state and next step

Continuation 4 is paused at `group-restore`, with no active driver, lock,
failure, or uncertain write. Mixer selection is the audit group; Launcher
selection is `Inst 1`, row 0. Both children remain hidden. Six audit tracks
remain muted at -18 dB. Each sample track has its original Sampler. The
complete fixture is preserved and transport is stopped.

The operator must ungroup only notes and spare, preserve both tracks, remove
the empty group, and restore the `Inst 1` mixer header and first Launcher
cell. After confirmation, run `checkpoint group-restored` in continuation 4.
Then continue project switch, persistence, listening, and cleanup through
the [driver guide](../../plan/phase-9/9b-update-audit-driver.md). General
acceptance and the separate 9b.6 doctor remain pending.

Lesson: snapshot tests must include group aggregate occupancy and real child
document routing. A case test with a prebuilt snapshot cannot detect this
boundary error. The new regression test covers that boundary.
