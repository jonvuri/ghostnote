---
id: D38
kind: decision
state: active
updated: 2026-10-07
source: phase-8h4c2
---

# D38 — A shared preflight read is the stash only on the targeted route **[SETTLED 2026-10-07]**

8h4c2 lets the executor use a caller's fresh read as its stash read
(`snapshotPreflight`). The executor judges the D32 reference on that read again
with a new content delta and mark. This check cannot see a note edit by a
person after the read: such an edit changes neither the Ghostnote revision nor
the launcher events ([E246](../evidence/experiments/e246-edit-cost-and-reader-heap.md)).

## Rule

- `edit_launcher_clip` supplies its fresh read as the stash read only on the
  targeted route without a clip property change. The targeted route writes
  only the named cells, and the independent readback compares every other note
  on all 16 channels. An edit made after the read therefore stays, and the
  readback reports it as `differs`.
- The whole-clip route and a clip property change keep the executor stash
  read. These writes would overwrite a person's edit made after the tool read,
  and the stash would record a "before" without it.
- A supplied read must cover every write-set address and the source of each
  reference. The revision guard (`ifRevision`) and the scene guard still apply.
- The executor verify read covers the complete clip and is the readback in
  both cases. It is a new `clip.read` capture, not the writer echo (D15).

## Why

The 8h4c2 plan asked to share the read on every route. The revision counts only
Ghostnote writes (8h4a), so the plan's guard does not cover a person's edit.
The planning time between the tool read and the write is 0.1 s on the typical
clip and up to 12 s at the sounding-cell limit. On the targeted route the gap
has no silent loss beyond the cells that the edit names. The 2,000 ms target
needs the shared read only on the targeted route.

## Consequences

- A targeted edit reads the clip twice; every other edit three times.
- The edge case that remains: a person edits a cell that the targeted edit
  removes or moves, after the tool read. The edit replaces that note. The
  same gap existed between the stash read and the write before 8h4c2, but it
  was shorter.
