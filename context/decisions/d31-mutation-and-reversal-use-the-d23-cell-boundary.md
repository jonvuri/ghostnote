---
id: D31
kind: decision
state: active
updated: 2026-10-05
source: phase-8h3c
---

# D31 — Mutation and reversal use the D23 cell boundary

8h3c adopts [D23](d23-normalized-clip-acquisition-uses-one-1-512-view.md)
for product reads, mutation preflight, verification, and reversal. One note
identity is `(channel, pitch, occupied 1/512 cell)`. The reader reports the
cell start. Reconstruction and reversal restore that start. A stored onset
can move down by less than `1/512` beat. Same-cell multiplicity is outside
this boundary. Complete means complete inside this boundary.

[D9](d9-grid-and-units-settled-2026-07-25.md) still
controls writes. New notes can use its triplet grids. Verification compares
onset cells. A normalized onset can use `1/512` with a duration from another
D9 lattice. The host setter takes duration in beats. Unsupported durations
still refuse. This does not permit arbitrary duration rounding.

The fake adapter projects read onsets to the same cell start. It keeps the
stored write onset until reconstruction or reversal. Targeted removal looks
up the occupied cell. This permits the same onset checks in conformance tests.

Product reads require `hello()` and a compatible `rig.clipReader`: width
4,194,304, grid `1/512`, format `notes-v1`. An absent configuration refuses.
There is no product E131 or pool-scan fallback.

The capture retains every NoteStep field, including disabled raw controls.
Release velocity and the four control enable flags are explicit in contract
notes. Raw recurrence is retained when enabled or different from `[1,1]`.
Control values are written before their enable flags.

Contract velocity is MIDI `0..127`, as before 8h3c. The reader rounds raw
host velocity to the nearest MIDI value. A reconstruction writes that value,
so a raw velocity between two MIDI values is normalized. This limit is part
of the boundary.

A removal must match the complete note. An absent field has its host default
for a new note. Thus a note in minimal form matches a complete read that
reports the same values explicitly.
[E230](../evidence/experiments/e230-cold-reader-promotion.md) proves raw
disabled-control preservation in the owned reconstruction case. It also
verifies reconstruction at cell 85 with a supported 1/3-beat duration.

This amends [D8](d8-checkpoint-fidelity-measured-settled-2026-07-25.md). A checkpoint stores the
reported cell start. Its fidelity does not include the prior sub-cell onset.
Pressure and the other measured restoration limits remain in force.
