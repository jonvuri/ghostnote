---
id: D34
kind: decision
state: active
updated: 2026-10-06
source: phase-8h4a3
---

# D34 — The reader expands collapsed parent groups **[SETTLED 2026-10-06]**

A product clip read of a track inside a collapsed group expands each collapsed
group above the track, up to three levels, binds the row, and collapses those
groups again. A track in no group reads as before. The build marker is
`groupRule: expand-collapsed-parent-v1` in `rig.info` and in each reply.

## Why

The reader binds only row 0 of a track inside a collapsed group (E221). In
[E240](../evidence/experiments/e240-collapsed-child-reader-routes.md) the
expand route read every row correctly, but it failed one entry state of the
8h4a2 matrix, so the read kept its refusal. The operator then found that a
person cannot make that state: to collapse a group, a person clicks the group
track, which selects it. Only the reader's own `lease-lost` reads made it.

This changes the 8h4a2 rule that a route must pass the complete matrix. A
route is accepted when it passes every entry state that a person can make. The
operator accepts a visible expand and collapse during a read, like the
selection changes that a read already makes. To restore the expansion is
preferred; a group that stays expanded is acceptable.

[E241](../evidence/experiments/e241-expand-parent-acceptance.md) measured the
route: the matrix, nested groups, refusals, the anchor, and the person's own
path.

## Rules

- Find the parents with cursors that follow no selection. Level 0 is the
  parent handle of a finder at the target. Each higher level is a finder that
  climbs with `selectParent`. The parent handle of a group track repeats the
  group, and the parent of a top-level track is the project proxy, which
  reports the master track ID and `isGroup` true (E241).
- Restore the entry selection while the group is expanded. Collapse only after
  the host reports the restored slot selection, then select the entry mixer
  track again. Keep the write gate closed until then.
- A target that the reader cannot expand still refuses. The brain reports
  `collapsed-group-row` and says to expand the group.

## Consequences

- Every row of a track inside collapsed groups reads, in both profiles.
- A read of a track inside a group takes about 260 ms (nested: 380 ms), not
  167 ms. A track in no group has no extra cost.
- The group opens and closes in Bitwig during each such read.
