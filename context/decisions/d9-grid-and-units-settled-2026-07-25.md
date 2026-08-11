---
id: D9
kind: decision
state: active
source: DECISIONS.md
---

# D9 — Grid and units **[SETTLED 2026-07-25]**

**Beats-native everywhere; the step grid is a per-operation view, not global
state** (standing rule 12, correcting daw-mcp's design). The beats↔step conversion
happens in the live encoder and nowhere else.

- **Choose the COARSEST grid on which every start and duration is exact.** Not an
  optimization: E2 found off-grid notes are reported snapped DOWN (beat 0.09375
  scans as x=0 on a 0.25 grid), so a lossy grid choice corrupts a snapshot
  silently. Finer than the 1/64-beat floor is REFUSED.
- ⚠ **A grid change invalidates the cursor's step data for ~120ms**, and any
  `getStep` in that window returns something unusable — 0 of 3 properties landed
  at gaps of 0/24/48/72/96ms, 3 of 3 at 120/144/192/288ms (E15-D). Hence the
  `gridChange` budget of 144ms and `OP_SETTLE_BEFORE`.
- ⚠ **Two ops that must agree about the grid MUST hold the same note set.** A
  generated `note.props` carries its create's WHOLE note set for exactly this
  reason; filtering it made the props stage coarser and lost every property
  (E15-F). `stepSizeFor` therefore lives in the contract, not the encoder, so both
  adapters and the stage planner can ask the same question.
