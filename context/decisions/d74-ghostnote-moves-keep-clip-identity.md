---
id: D74
kind: decision
state: active
updated: 2026-11-08
source: B19 session 3
---

# D74 — Ghostnote's own clip moves keep clip identity; copies carry provenance

The B19 session 3 live check (brief) found that `move_launcher_clips` and
`copy_launcher_clips` lost the clip provenance that Ghostnote holds
([D73](d73-overlays-removed-for-clip-provenance-and-column-defaults.md)): the
destination read minted a new clip ID with no stored envelope. A moved clip
also lost its event IDs, so a script's IDs no longer matched. The operator
chose on 2026-11-08 that a move keeps the clip and event IDs and a copy
carries only provenance.

1. A verified copy or move leaves a carry at each destination: the newest
   registry entry of the source. It costs no host call. A move carries the
   clip ID, the event IDs, and the stored envelope; a copy carries a nonempty
   envelope only. Every ref at a destination retires (`identity-changed`), and
   a moved source retires (`absent`).
2. The first acquisition at the destination with no live prior uses the carry
   when the project, extension generation, and scene layout are unchanged,
   the acquired cells are the source entry's cells, and the document
   projected with the source IDs and envelope has the source entry's content
   hash. A move then reports identity `moved` with every ID retained; a copy
   mints new IDs and takes the envelope. Otherwise the carry is dropped and
   the read mints as before. An empty read, a write at the destination, or a
   sweep to another domain also drops it.
3. This amends the identity rule that a moved clip always gets a new ID. The
   binding's own verified move is the move proof that D32 lacks, and exact
   document equality with the last read of the source is not similarity
   matching. A person's move, duplication, or replacement still mints new
   IDs. A source that changed after its last read does not match, and the
   agent re-attaches provenance with `clipUpdate`.
4. A project save-as is a project change and still retires every ref and its
   envelope.

Copies keep no event lineage here: lineage for derived clips belongs to the
B19 session 4 clip operations.
