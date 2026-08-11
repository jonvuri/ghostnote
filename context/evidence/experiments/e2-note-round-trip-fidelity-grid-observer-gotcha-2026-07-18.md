---
id: E2
kind: evidence
state: active
source: FINDINGS.md
---

# E2 — Note round-trip fidelity, grid, observer gotcha (2026-07-18)

**Verdict: ● §5's "Exact" checkpoint-fidelity claim holds for the note
surface, with one asterisk (gain).** Probes: `e02` (full sweep, partially
contaminated by external project-state changes mid-run) + `e02b`
(clean re-characterization on known clips).

### Write/read mechanics

- **`setStep` is NOT visible in the same request** — immediate `getStep`
  after `setStep` in one handler returns `Empty`. It IS visible on the
  next request (~25ms incl. round-trip). ⇒ readback verification (§8c)
  must be a separate tick after the write batch, never inline.
- **`getStep` scan cost is trivial:** 512×128 grid = 65k steps scans in
  2–10ms; 64×128 in ~0.4–1ms. Full-clip snapshots are effectively free.
- **Observer gotcha, precisely characterized:** `getStep`/`NoteStep` needs
  NO subscription at all (works on a cursor with zero `markInterested`).
  Every `Value.get()` (exists, name, position…) throws
  `"Either call markInterested() or add at least one observer in init"`
  without a mark. ⇒ mark everything scalar; note data is implicit.
- **Muted notes remain visible** to the NoteOn scan with `isMuted=true` —
  snapshots see them.

### Expression property fidelity (21-property sweep; re-verified on clean fixture)

All setters accepted; round-trip exact (±2e-3) for: velocity,
releaseVelocity, velocitySpread, duration, pan, timbre (float noise only),
transpose (fractional ok), chance+enable, occurrence (enum)+enable,
recurrence (length+mask)+enable, repeat count/curve/velocityCurve/
velocityEnd+enable, isMuted. Two API quirks, both now precisely modeled:

- **`gain` reads back 2× the written value** (reproducible on clean
  state: set 0.7 → immediate read 0.7 [cached] → settled read 1.4; javadoc
  claims 0..1 both ways). Checkpoint restore mapping: write `read/2`.
  Verify the inverse mapping holds in Phase 1; likely a Bitwig doc/API bug.
- **`setGain` and `setTimbre` each RESET `pressure` to 0** (isolated in
  e02e; every other property is innocent; pressure re-set afterwards
  sticks). ⇒ property-write ordering rule: **pressure last** (or at least
  after gain/timbre) in any note-property batch — and §8c readback
  verification catches violations structurally.

### Grid

- **`setStepSize` works at runtime** (note at beat 1.0 re-indexed 4→8
  after 0.25→0.125 switch; needs a settle wait — not instant).
- **Triplet grids work** (stepSize 1/6 round-trips).
- **Off-grid notes are visible on coarser grids, snapped DOWN** (a note
  at beat 0.09375 scans as x=0 on the 0.25 grid) — coarse scans don't
  lose notes but misreport positions; snapshots should scan at the
  finest grid.
- ⇒ grid is a *view*; resolution is per-cursor and changeable. The
  contract can stay beats-native and quantize per operation to a chosen
  grid; no global init-time grid needed (daw-mcp's design was
  unnecessarily rigid).

### Addressing corollaries (feed the batch executor design)

- **Pointing at an EMPTY slot silently lands the cursor on the WRONG
  clip** — observed staying on the previous clip in one trial and
  attaching to a different clip on the target track (slot 0) in another;
  in both cases status looks healthy. ⇒ create-clip must precede
  pointing; the executor MUST verify the cursor's target (track position
  + scene index) before every write — a mis-point is undetectable
  afterwards from the cursor's own state.
- **No stale reads after clip deletion:** `ClipLauncherSlot.deleteObject()`
  (works, ~24ms) leaves the cursor with `exists=false`, scan returns 0
  notes. Cursor reads are trustworthy when `exists=true` + target
  verified.
- **The e02 cross-session anomalies are fully resolved by E2c** (track
  identity bug — see that section): the "fixture" was actually the FX and
  Master rows. Bonus discovery: `createNewLauncherClip` + full note
  editing WORKS on FX/Master launcher slots. After cleanup (E2d) the
  whole E1a + E2 suite re-ran green on a genuine instrument-track
  fixture.
- **Arranger cursor clip:** created fine; `exists=false` with no
  arrangement clip selected. Deeper arrangement probing stays out of
  scope (§9 lean).

### Decision impact

- Checkpoint design (§8b): full-fidelity note snapshots are cheap and
  exact (gain excepted) — snapshot = verbose scan of the write-set clips.
- Readback loop: write → next-tick verify → report; ~25ms per turn.
- Units (§7): contract in beats; extension quantizes via per-op stepSize.
- E3 signals banked: both Track and ClipLauncherSlot `deleteObject()`
  confirmed working.

---
