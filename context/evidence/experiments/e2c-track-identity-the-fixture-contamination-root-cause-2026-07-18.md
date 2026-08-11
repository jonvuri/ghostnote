---
id: E2c
kind: evidence
state: active
source: FINDINGS.md
---

# E2c — Track identity: the fixture-contamination root cause (2026-07-18)

> **Amended by E2f:** the "no stable track addressing" conclusion is too
> strong — `channelId()` (UUID) IS stable. This section's brittleness
> findings apply to **bank index and name specifically**, which remain the
> wrong things to address by. Read with E2f.

**Verdict: ● the cross-session anomalies were OUR bug — addressing tracks
by (bank index | name) is unsound. Three API facts, all confirmed by
controlled trials (`e02c`):**

1. **The flat TrackBank includes the FX section and the MASTER track**
   after the regular tracks. `trackType()` distinguishes them
   (Instrument/Audio/Effect/Master/Hybrid/Group). daw-mcp-derived code
   treated bank size as "number of regular tracks" — wrong.
2. **`Application.createInstrumentTrack(position)` does not honor bank
   positions:** requesting the end (9) landed at index 7 (end of the
   *regular* section, before FX/Master); requesting 0 landed at index 1.
   The position argument cannot be trusted; the only safe procedure is
   create → diff the bank → locate the new row empirically.
3. **Default track names auto-renumber** ("Inst 2", "Audio 3" are
   positional auto-names, not stable identities). Name-based identity is
   meaningless for unnamed tracks, and `setName(bankIndex)` renames
   whatever currently sits at that index.

**Combined effect on E1/E2 sessions:** every `ensureFixtureTracks` run
created a track that landed *not* at the assumed index, then renamed the
wrong row — accumulating orphaned "Inst N" tracks and, at least once,
sticking the fixture name onto the tail of the bank (the row typed
Master now carries the name "gn-A"). Cross-session name lookups then
found the wrong tracks, explaining the E2 phase D/E anomalies and the
user's "gn-A wasn't there" observation. In-session fingerprint-verified
results (all of E1's core verdicts, E2's mechanics) are self-consistent
and stand.

**Resolution (same day):** user visually confirmed (screenshots): the
Master row was named "gn-A", fixture clips lived on the FX/Master rows,
and the default template was Inst+Audio+FX+Master — every extra
Instrument row was a ghostnote orphan. Cleanup probe (`e02d`) removed
our clips from FX/Master, restored the Master name, and deleted the five
verified-empty orphans; fixture code (`lib.ensureFixtureTracks`) now
matches by name+type, locates created tracks as last-Instrument-row, and
poll-verifies renames. E1a and E2 both re-ran green on the clean fixture.

**Decision impact (batch executor / contract):**
- Track creation in the contract must return the *located* new track
  (create → diff → verify), never assume the requested position.
- All track addressing must be type-aware; Effect/Master rows are never
  fixture/rename/delete targets by index.
- Rename operations must poll-verify the rename landed where intended.
- This is the strongest argument yet for §8e verification semantics:
  every structural op needs its own readback, not just note writes.

---
