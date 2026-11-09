---
id: D75
kind: decision
state: active
updated: 2026-11-09
source: B19 session 4
---

# D75 — A new clip can be derived from a source clip, keeping its event IDs

Real use restated 114–126 notes to make light variations of a clip and wrote
long REMOVE lists to split clips
([E392](../evidence/experiments/e392-r01-real-usage-by-capability-cell.md),
[E393](../evidence/experiments/e393-r01-round3-real-use-followups.md)
proposal 5). The operator accepted this design on 2026-11-09.

1. **Tool grain.** `add_launcher_clip` takes an optional `source`: a clip
   (track and row), a beat range `[from, to)` and a `shift`. There is no new
   tool: the object boundary is still one new clip
   ([D21](d21-musical-patch-and-public-tool-grain.md)), and the operation is
   a read and an add in one call, not a transform in the format
   ([D51](d51-document-file-paths.md)). Slice is a range; split is one call
   per part, and the source stays; duplicate-and-vary is the whole clip with
   a patch.
2. **Range edges.** A note belongs to the range when its onset is in
   `[from, to)`. A note that ends after `to` is shortened to end at `to`, and
   the result lists its ID (`derived.shortened`). A note that starts before
   `from` is left out. Every note moves by `shift - from`. Bounds are exact
   nonnegative beat text on the 1/512-beat plane, and `to` cannot pass the
   source length.
3. **ID lineage.** Every kept note keeps its source event ID; event IDs are
   unique within a document, and the add path already keeps document IDs. The
   new clip gets its own clip ID at the write. No ID map or lineage record is
   stored.
4. **Length and loop.** The new clip is `shift + (to - from)` beats long. It
   loops over its length when the source loops; the play range is not
   carried. A patch `CLIP_UPDATE` can change the name, length or loop.
5. **Patch.** With `source`, the document input is an optional patch. Its
   BASE is the sha256 and ref of a read of the source, which must still be
   current (otherwise code `stale`, with the new base). Its records name
   source IDs and the source clip ID, and its beats are beats of the new
   clip. It applies to the derived notes before the write.
6. **Provenance.** The new clip keeps the source name, provenance, META and
   EXTENSIONS. A provenance source range that spans exactly the source clip
   length narrows to the slice; any other source stays unchanged, because its
   beats do not map onto clip beats. No source-clip pointer is added: clip
   IDs do not survive a save-as or a person's edit, and R33 stays a list of
   files.

Cost: one more clip read and one or two more deltas than an add of the same
document (`call-budget.test.ts`; ledger).
