---
title: E241 — Expand-parent acceptance
kind: evidence
state: done
updated: 2026-10-06
owner: phase-8h4a3
---

# E241 — Expand-parent acceptance

## Status

[8h4a3](../../plan/phase-8/8h4a3-expand-parent-acceptance.md) is complete.
The product reader now expands each collapsed group above the target (up to
three levels), reads, and collapses the groups again
([D34](../../decisions/d34-the-reader-expands-collapsed-parent-groups.md)).
Every row of a track inside collapsed groups reads with the correct notes,
in both profiles, also in nested groups and from the person's own selection
path. The build marker is `groupRule: expand-collapsed-parent-v1`.

The session found and fixed five defects of the first promotion build. Each
failed closed (a refusal, not wrong notes):

1. A collapse moved a restored mixer selection to the group track (E240).
2. The parent handle of a group track repeats the group, so nested groups
   did not expand.
3. The parent of a top-level track is the project proxy. It reports the
   master track ID and `isGroup` true. The first build tried to expand it, and
   every top-level read hit its deadline.
4. A slot selection inside a collapsed group does not take. When the person's
   entry slot was inside the group, the restore did not take.
5. A reply placed the `collapsed` flag on the wrong `parents` entry (report
   only).

## Final route

The open task points finder 0, a cursor that follows no selection, at the
target. At park, its parent handle is level 0. If level 0 is a group, finder 1
goes to level 0 and calls `selectParent()`. A move lands at the first poll
(about 23 ms, 36 of 36). A finder that does not move within three polls is at
a top-level group. Each collapsed level is expanded. The bind waits until the
host reports each expansion (bounded; the bound-target guard refuses a wrong
row).

The close task restores the entry selection while the groups are expanded.
After the release, the reader waits until the host reports the restored slot
selection, collapses the groups, waits for the collapse, and selects the entry
mixer track again. The write gate stays closed until the reply. A refused read
takes the same path.

A parent counts as a group only when it exists, reports `isGroup`, has a
channel ID, does not repeat the level below it, and is not the master track
(`ClipReadRoute.isParentGroup`, unit-tested). The probe route `no-expand` is
the 8h4a2 route; `no-reselect` skips the mixer reselect.

## Final results

The final source built the probe archive `932613a5…dd01` and the normal
archive `3ed03556…ce00`. Owned project `New 11`: G1 holds children a and b;
child n is in G2 inside G3. Fixtures are the E232 rows 0, 1, and 63, with row
2 empty.

| Case | Profile | Passed |
|---|---|---:|
| Matrix, G1 collapsed (6 orders × 3 entries × 2 children) | normal | 108 / 108 |
| Matrix, G1 collapsed | probe | 107 / 108 |
| Matrix, G1 expanded | normal | 108 / 108 |
| Nested: G3 and G2 collapsed | normal, probe | 18 / 18, 18 / 18 |
| Nested: G3 expanded, G2 collapsed | normal | 18 / 18 |
| Nested: G3 collapsed, G2 expanded | normal | 18 / 18 |
| Reads after a refusal (deadlines 10–200 ms, `duplicate-cell`, `step-delta`) | probe | 22 / 22 |
| Entry mixer track: another child of the collapsed group | probe | 6 / 6 |
| Entry mixer track: the master track | probe | 6 / 6 (also 6 / 6 with `no-reselect`) |
| Top-level track (no group) | normal, probe | 20 / 20, 20 / 20 |
| Brain reader path (`adapter.read`), rows 0, 1, 63 of a and n | normal | 6 / 6, one `clip.read` each |
| `no-expand` rows 1 and 63 | probe | refuse `bound-target-mismatch` |

The one probe miss was the first read of the session. It lost the lease, and
the slot selection stayed on the target (`restored: false`). This matches the
E232 open observation: one first read of a session that did not restore its
slot selection. It also occurred once in the first build (run A). The cause is
not known. The notes were correct.

After each refusal, the next read found G1 collapsed again and read its row.

### The anchor

In `gn-scale-test`, read only, normal profile, with `Group 5` collapsed:

- 72 of 72 reads of `gn-E16` rows 0, 1, and 2, in all orders, from four
  entries (`gn-A` row 4, the target slot, another row, the master mixer
  track). Each returned the notes of a read made while the group was expanded.
- The person's path: the operator expanded `Group 5`, selected a `gn-E16`
  slot, and collapsed the group by its header. Six reads from that entry
  restored it exactly (6 of 6). With the restore and collapse in one task,
  0 of 6 restored the slot.
- 20 of 20 reads of `gn-A` (top level), with the selection unchanged.

### Cost

| Target | Median read |
|---|---:|
| No group | 167 ms |
| In one group (collapsed or expanded) | 262 ms |
| In nested groups | 378 ms |

Before 8h4a3, a read of a grouped track took 167 ms. Most of the added time is
the climb and the top-level wait.

## Measurements on the way

In order. The artifact suffix names each step.

| Step | Change | Finding |
|---|---|---|
| `before-reselect` | Collapse in the close task, before the restore | Matrix A 107, B 108; the hidden-child mixer entry ends on G1 (0 of 6). |
| `one-level` | Mixer reselect after the collapse | Master and hidden-child entries 6 of 6 (0 of 6 with `no-reselect`). The parent handle of the level-0 handle repeats G2. |
| `parent-handle` | A second finder at level 0, with its parent handle | The same repeat (`isGroup` false); with G3 collapsed, 5 of 18. |
| `climb-wait-defect` | The finder climbs with `selectParent` | A wait defect in the climb: 18 deadlines (fail-closed). |
| `root-wait-10` | The wait defect fixed | 18 of 18 in each nested state; the top-level wait costs 233 ms. |
| `timing-nested` | Move timing | Every move lands at the first poll; the wait becomes three polls. |
| `project-proxy-defect`, `proxy-defect-build` | Three-poll wait | Every top-level read hits its deadline (the project proxy). |
| `collapse-in-close` | The master-ID rule | All cases pass, except two reads after a 150 ms deadline refusal, and the first read after a controller load (no mixer selection observed yet). |
| `anchor-group-expanded`, `anchor-collapse-first` | The `collapsed` flag fix | The anchor reads pass; the person's hidden entry slot does not restore. |
| `same-task` | Restore, then collapse, in the close task | 72 of 72 anchor matrix; the person's path 0 of 6. |
| final | Collapse after the host reports the restored slot | All cases above. |

In the `proxy-defect-build` and `collapse-in-close` steps, a refusal between
bind and close lost its lease and left the slot selection on the target (the
two reads after a 150 ms deadline). The final order removed this: 22 of 22.

The final order also makes the mixer reselect unnecessary in the measured
cases. The reselect stays as a guard.

## Not tested

- More than three nested levels. Such a read refuses `collapsed-group-row`.
- An extension restart during a read. The group can stay expanded; the
  operator accepts this.
- A person who changes the selection or the expansion during a read.

## Artifacts and verification

Data is in [phase8h4a3-expand](../data/phase8h4a3-expand/). Suffixes name the
earlier builds. `brain/src/probes/phase8h4a3-expand.ts verify-offline <dir>`
checks every claim above from the retained artifacts.
`phase8h4a3-expand.test.ts` runs it. `ClipReaderTest` checks the route order
and `isParentGroup`.

## Restoration

The drivers deleted all owned tracks in `New 10` and `New 11`. The operator
closed both without saving. The anchor `gn-scale-test` matches the E234
baseline. `Group 5` is collapsed; the operator had expanded it during the
session. Fresh normal hello passes `normal-v1`, 87 methods,
`ca139a3e62a55e68`, and `groupRule` `expand-collapsed-parent-v1`. The rig
config is unchanged.
