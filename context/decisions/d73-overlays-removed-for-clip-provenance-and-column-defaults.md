---
id: D73
kind: decision
state: active
updated: 2026-11-08
source: B19 session 3
---

# D73 — Overlays are removed; clips carry provenance and column defaults

Document 1.0 drops overlays (R12–R24). A clip instead carries an optional
provenance pointer, and a FIELDS clip can state uniform column values once.
The format stays version 1.0; it is still not an external release (D25, D35).
Analysis that overlays were meant to hold moves to stateless tools (B19
session 5).

## Why

Real use wrote only timing overlays, never read them, and lost them on every
save, rename, copy, move and new thread
([E393](../evidence/experiments/e393-r01-round3-real-use-followups.md)
section 2). They made up 91–96% of document bytes. Every inferred value was a
deterministic function of the written notes, and harmony, role, motif and
region were never used. The timing questions users asked concerned fidelity to
a source or alignment between parts. A script answered each one by comparing
the clip with the source MIDI.

The only information the notes cannot give is the link to the outside world:
which file, which hash, which bars and which conversion. A declared pocket or
a transform is recoverable by analysis, either from the notes or by comparison
with the named source, so it is not persisted. Provenance is therefore a
pointer, not an annotation, and it never goes stale: "these notes came from
bars 64–96 of piano.mid" stays true after edits. Ghostnote keeps no store
(D17's take store was retired by D18), so the pointer lives in the document
and, for a host clip, in the session binding.

Repeated uniform columns were the other measured cost. A Feeding Time read
repeated `1 false WITH {"releaseVelocity": 0}` on all 781 rows. D35 set the
release-velocity default to 100/127, Bitwig's value for drawn and API-written
notes, but imports and keyboards give uniform 0 or 64 (B19 brief, release
velocity). A clip-level statement removes the repetition while every value
stays exact, so D15 readback still compares equal state. The operator chose
this over a partial measure such as normalizing only MIDI import.

## Rules

1. **Overlays are removed.** Documents have no `overlays` array and no
   `OVERLAY` records; patches have no `overlayPut` or `overlayRemove`. A
   reader refuses them with a message that names this decision. The removed
   rules R12–R24 keep their numbers as retired entries. Claims stored in a
   server session are not migrated; a restart already discarded them.
2. **Clip provenance.** A clip has an optional `provenance` object with
   `sources` (1–64 entries) and an optional `generator`; at least one is
   present. A source has `path` and optional `sha256`, `range` (`from` <
   `to`, nonnegative source beats), `read` (inert JSON describing the
   conversion, such as `{"conversion":"midi-document-v3","track":1}`) and
   `refs` (string values, for example Ghostworks IDs). A generator has `path`
   and optional `sha256`. Provenance is clip metadata: content identity
   includes it, `clipUpdate` can set or clear it, and it has no musical
   effect. It holds no tempo, pocket, intent or other analysis.
3. **Session binding.** Bitwig cannot store provenance. A clip writer binds
   the written clip's provenance to the clip ID in the identity registry, the
   slot where stored overlays were kept. Later reads return it while the
   clip ID is kept (`current`, `stale` or a verified write), and edits carry
   it forward. A write result reports `readback.held: ["provenance"]`: the
   readback verified the notes and host fields, and Ghostnote supplied the
   provenance (D15). The agent re-attaches provenance from its document
   with a `clipUpdate` when the binding is gone.
4. **Clip column defaults.** A clip in either encoding can state `defaults`,
   a map from optional event fields to values. In that clip, an event that
   omits the field takes the clip's value; an explicit value wins. A default
   must be a covered field. Defaults are layout, like the FIELDS binding:
   parsing expands them into the events, so the semantic document and its
   R27 hash do not contain them.
5. **Canonical FIELDS output.** For each clip and optional field, the writer
   states a clip default when every event of the clip has the same value and
   that value is not the portable default. The binding is
   `id clip at duration pitch velocity` followed, in field-reference order,
   by each optional field that some row cannot omit. A row writes `_` where
   its value equals its clip default, or the portable default when the clip
   states none; otherwise it writes the value. Canonical output has no
   `WITH`. Canonical JSON stays expanded and states no defaults.
6. **Patches.** An added event that omits an optional field takes the base
   clip's canonical default (rule 5) when there is one, else the portable
   default. A patch keeps explicit values in its adds, including a portable
   default value. A `null` in `set` still resets to the portable default.
7. **MIDI files.** `read_midi_file` puts no overlays in the document. Each
   clip gets provenance naming the file, its sha256 and the conversion
   (`midi-document-v3`, track, timing mode). The report lists the meter
   points and, for a map of at most 16 points, the tempo points in document
   beats; `sourceTempo` keeps the summary. `write_midi_file` writes 120 BPM,
   or `bpm`, or copies the tempo and meter map of the MIDI file named by
   `tempoFrom`; `meter` sets a constant time signature.

R04's portable defaults and D35's release-velocity value are unchanged; rule
4 adds a clip-level value in front of them.
