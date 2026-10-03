---
title: Phase 8g5a — Group topology support
kind: plan
state: active
status: Pending. Run first. Projects with group tracks must be supported before the 8g gate.
updated: 2026-10-03
parent: 8g-shadow-project-cache.md
prev: 8g4-native-topology-and-ordering.md
next: 8g5b-slot-inventory-delivery.md
---

# Phase 8g5a — Group topology support

## Why

The 8g gate scope is project-wide occupancy (decided in 8g5 planning,
2026-10-03). A cache that refuses every project with a group track is not
acceptable. In [E220](../../evidence/experiments/e220-native-topology-and-ordering.md),
the direct child bank of a native group returned both children and the group
track itself. The graph check refused with `topology-child-address`, and every
acquisition in that project stopped. This session finds a proved topology read
for groups, or records the exact host limit.

## Entry and scope

Read E220, `ShadowTopologyControl.java`, `ShadowGroupControl.java`, the 8g4
plan, and the cache contract rebuild rules. Keep D26 and D27 scopes unchanged.
Do not enter 8h. All results stay `complete:false` and `eligible:false`.

## Candidate routes

Measure each route against an independent oracle. Do not remove the self entry
from the graph only to make a check pass.

1. **Self entry as host rule.** Measure where the group's own entry appears in
   its child bank: position, UUID, `isGroup`, and name. Repeat for expanded,
   collapsed, nested, empty, and one-child groups. Accept a rule only if the
   self entry is identified by UUID equality, not by position alone.
2. **Parent per track.** In one flat `ALL_CHANNELS` bank, read
   `createParentTrack(0, 0)` for each item. Derive the tree from parent UUIDs.
   Check that root tracks report no parent and that the result has no cycle.
3. **Flat order plus group flags.** Use flat order, `isGroup`, and
   `isGroupExpanded` only as a consistency check. Flat order alone cannot prove
   nesting.

Prefer the route with the smallest handle cost that two independent reads
agree on. Record the handle and bank cost in the 8g3 resource ledger.

## Work and independent oracles

1. Probe all three routes on one owned unsaved fixture with a known tree:
   two roots, one group with two children, one nested group, one empty group.
   The fixture definition is the oracle. Each read must reproduce it exactly.
2. Change the tree natively: group, ungroup, expand, collapse, move a track into
   and out of a group, and reorder children. After each change, membership
   callbacks retire cache state. A fresh topology read must equal the new
   fixture oracle before reacquisition.
3. Acquire and compare clip content on a child track and a nested child track.
   Content must match independent settled `1/512` authority on all channels.
4. Add rehashed retained-report mutants for a dropped self-entry rule, a wrong
   parent, a cycle, and stale topology after a change.

## Acceptance criteria

- One route reproduces every fixture tree, or the session records why no route
  can. A partial route keeps the refusal for unsupported shapes.
- Group changes retire affected identities. No old topology reaches current
  output.
- Content in grouped and nested tracks matches independent authority.
- Handle and bank cost is in the resource ledger with its selected limit.
- Live baseline restoration, config bytes, normal reload, and hello follow
  `AGENTS.md` and the 8g4 cleanup rules. Original `New 1` is not saved or closed.
- Full brain and extension checks, artifact verifiers, wire, context, and diff
  checks pass.

## Stopping rule

If no route is proved, keep group refusal, record the measured host behavior,
and hold the 8g gate. Do not widen the topology check.
