---
title: Phase 8h4a3 — Expand-parent acceptance
kind: plan
state: done
status: Complete (E241, D34). The reader expands collapsed parent groups, up to three levels, for each read.
updated: 2026-10-06
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h4a2-collapsed-child-reader-routes.md
next: 8h4b-document-read-and-identity-registry.md
evidence: E221, E232, E234, E240, E241; D30, D33, D34
---

# Phase 8h4a3 — Expand-parent acceptance

**Result (E241, D34).** Every row of a track inside collapsed groups reads, in
both profiles, also in nested groups and from the person's own selection path.
The session fixed five fail-closed defects of the first build, among them the
project proxy of a top-level track and a slot restore inside a collapsed
group. Reads of grouped tracks cost about 260 ms (nested 380 ms); other reads
are unchanged.

## Why

In E240, `expand-parent` read every row of a collapsed child correctly. It
failed one case: the entry mixer track was another child of the collapsed
group, and after the read the mixer selection was on the group track. The
operator found that a person cannot make that entry state. To collapse a
group, the person clicks the group track, which selects it. Only the reader's
own `lease-lost` reads made the state in E240. The operator accepts visible
selection changes and a visible expand and collapse. To restore the expansion
is preferred, but a group that stays expanded is acceptable.

E240 did not test a refused read after the expansion, or nested groups.

## Work, in order

1. Make `expand-parent` the product open order for all targets. A target whose
   parent is not a collapsed group reads as before. Allocate the finder cursor
   and a short parent chain in every profile, at init (rule 13). Expand each
   collapsed ancestor in the chain; collapse each one that the read expanded,
   before the selection restore. Keep the 8h4a2 order as the probe route
   `no-expand`, and keep `legacy-open`. Add the build marker
   `groupRule: expand-collapsed-parent-v1`, checked by `probe:hello`.
2. Keep the brain `collapsed-group-row` refusal as the fallback for a target
   that the route cannot expand.
3. Live, in an owned unsaved project:
   - the E240 matrix with the product route: expanded, collapsed, and
     collapsed again after an expand-and-collapse;
   - refused reads after the expansion (short deadlines and the probe
     `duplicate-cell` and `step-delta` faults); the next read must find the
     group collapsed;
   - a child of a nested group, with the outer group collapsed and the inner
     group collapsed or expanded;
   - `no-expand` still refuses `collapsed-group-row` through the adapter;
   - the normal profile: the product matrix on a collapsed group, and fresh
     hello with the marker.
4. Record D34 (the acceptance rule for this route) and E241.

## Acceptance criteria

- Every row of a collapsed child reads with the declared notes in every entry
  that a person can make, collapsed and expanded, in both profiles.
- No read publishes notes from another row. Refusals stay fail-closed.
- After a refused read the group is collapsed again, or the record states
  where it stays expanded.
- Nested groups have a recorded result.
- Brain check, extension check, wire goldens, retained offline verifiers,
  context check, and `git diff --check` pass. The anchor matches its baseline;
  owned projects close without saving.
