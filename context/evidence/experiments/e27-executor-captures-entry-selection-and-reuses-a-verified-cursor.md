---
id: E27
kind: evidence
state: active
source: phase-1-session-5d-repair-concurrent-selection
---

# E27 — The executor captures entry selection and reuses a verified cursor [K] (2026-08-16)

**Verdict: the 5d selection defects are repaired. Independent control and
interference reads did not reproduce a pan-write defect.**

## Selection repair

`preserveSelection` now starts and awaits its selection read before it runs any
pipeline work. A selection change before the first cursor borrow cannot replace
the pipeline-entry value.

The live adapter records a held clip only after `cursor.status` confirms its
track position and scene row. Note stages omit track and slot point frames while
that non-following cursor still owns the requested clip. A device point, cursor
eviction, or structural stage clears the applicable hold. Structural operations
still invalidate the complete cursor pool.

Offline regressions cover eager capture, a selection change before the first
borrow, repeated selection changes between note stages, one final confirmed
restore, and structural invalidation. The common stash, write, property, verify
pipeline now sends one target point instead of one point per stage.

## Property diagnosis

`probe:5d-repair` used cursor 0 for the production executor and cursor 1 for
independent readback. Each arm wrote 40 notes with only non-zero pan values.
The interference arm made 24 selection changes across three occupied tracks.

Two complete runs found all 80 control pans and all 80 interference pans through
the independent cursor. Each run reverted the target to an empty clip, removed
the owned clip, restored the pre-run selection, and preserved the exact empty
schema-v1 observation record. No property-write repair was justified.

The first run had one transient same-cursor verify read on a stale grid. It
decoded non-zero starts incorrectly, while immediate repeated writer readback
and independent readback both found all 40 notes and pans. The second complete
run had no executor disagreement. The standing probe keeps the repeated writer
read visible, but the independent handle remains the property verdict under D15.

## Verification

- Focused adapter, encoder, and executor tests: 99/99.
- Full offline check: 532/532, with typecheck green.
- Live repair probe: final run 14/14; exact cleanup.
- Wire unchanged: 134 methods / `c2aa57be11e1f47e`.

## Decision impact

D6 now permits reuse only after live cursor readback confirms the held target.
The standing structural invalidation rule is unchanged. Session 5d can be run
again; this repair does not claim its human concurrent-editing proof.

## Retrospective

Model the physical cursor hold separately from the allocator assignment. The
allocator says which cursor should own a target; readback says whether it does.
No repository instruction change is needed.
