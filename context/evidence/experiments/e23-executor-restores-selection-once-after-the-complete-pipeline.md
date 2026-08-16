---
id: E23
kind: evidence
state: active
source: phase-1-session-5-b4
---

# E23 — The executor restores clip selection once after the complete pipeline [K] (2026-08-16)

**Verdict: the executor can preserve the user's clip selection across the full
resolve, stash, apply, verify, and report pipeline. The live path produces one
selection change when it borrows the target and one change when it restores the
prior clip.**

Session 3 left three selection capture and restore pairs in one executor run.
Each adapter call knew only its own boundary. The executor knew the complete
pipeline but did not expose that boundary to the adapter.

Session 5 B4 adds `BitwigAdapter.preserveSelection`. The fake runs the callback
without a UI effect. The live adapter captures lazily before the first call that
can point a clip cursor. Nested and overlapping pipelines reuse the same scope.
Direct adapter calls keep their existing local preservation.

## Live result

`npm run probe:5-selection` used the documented `gn-A` and `gn-B` identities. It
claimed one verified-empty fixture slot, wrote one owned clip, and put the user
selection on `gn-B` row 0 before the executor ran.

The first measured run found a defect in the new scope:

- the write applied and verified with no disagreement;
- the selection counter moved once;
- the executor returned while the UI selection still named the borrowed row.

The restore command had returned before Bitwig's selection observer changed. The
fix polls `selection.status` after the restore command. A timeout does not throw,
because the content write can already have landed and its receipt must not be
lost for a UI-only failure.

The corrected run passed **8/8**:

- the two destructive fixture identities matched the documented baseline;
- the claimed slot was empty before mutation;
- the executor write applied and verified;
- the selection counter moved by exactly two: one borrow and one restore;
- the final selection returned to `gn-B` row 0;
- reversal restored the owned clip's readback exactly;
- cleanup removed the probe clip;
- cleanup restored the selection that existed before the probe.

Two earlier apparatus attempts stopped before mutation because the assumed
`gn-A` rows were occupied. The final probe scans only documented fixture tracks
and claims a row only after a live empty read.

## Standing regression

Offline tests assert four boundaries:

1. the executor opens one scope around resolve, both reads, and apply;
2. repeated live-adapter reads capture once and restore once, including failure;
3. a scope that never points does not read or change selection;
4. overlapping pipelines share one capture and restore after both finish.

The full offline gate passes **527/527**. The extension and wire method set did
not change. The live probe removed all content it created.
