---
id: D23
kind: decision
state: active
source: phase-7-follow-up
---

# D23 — Normalized clip acquisition uses one `1/512` view **[SETTLED 2026-09-24]**

The consolidated clip contract uses one `1/512`-beat host view for note
discovery and realized timing. It does not use a second `1/768` acquisition
view.

One acquired note identity is one `(MIDI channel, pitch, 1/512 cell)` tuple.
The host can expose at most one `NoteStep` at that address. Different pitches
remain separate. Different channels remain separate after targeted reads of all
16 channels.

Two stored onsets with the same channel and pitch can collapse when both map to
one `1/512` cell. This multiplicity loss is inside the selected fidelity
boundary. Do not call the normalized route source-lossless or exact below one
cell. The contract does not select which source onset survives that collision.
A complete result means complete under this cell identity contract.

Rounding an isolated off-grid onset down to its occupied `1/512` cell is
accepted. Triplet, quintuplet, septuplet, swing, phase, and local timing intent
can remain musical overlays on the normalized event. Acquisition does not need
an exact host lattice for each rhythmic description.

A finer finite grid only narrows the same collision window. It does not remove
the underlying `NoteStep` cell boundary. The accepted `1/512` resolution does
not justify the extra observer, callback, page, reconciliation, and memory cost
of a second grid.

D9 still defines the measured grids that low-level note operations can write.
D23 changes normalized clip acquisition, not the existing low-level encoder or
the current E131 dual-grid implementation. D8 checkpoint fidelity also remains
unchanged until a later implementation session explicitly adopts this boundary
for mutation and reversal.

The project-wide observer scale sweep must use one fixed `1/512` observer per
clip. Its authority is a settled complete `1/512` scan projected to the same
cell contract. The existing dual-grid reader can remain a diagnostic control,
but exact sub-cell differences are not failures under D23.
