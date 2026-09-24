---
title: E128 — Targeted note insertion reversal is live
kind: evidence
state: active
updated: 2026-09-24
parent: ../../plan/phase-7/7b-agent-patch-execution-and-reference-dogfood.md
---

# E128 — Targeted note insertion reversal is live [K]

## Verdict

An insertion-only agent note proposal can now write into a clip that contains
off-grid source durations. Its recorded reversal removes only the inserted note
cells. It does not clear or reconstruct the source clip.

The compiler emits `note.insert` for a pure insertion. Mixed and non-insert
edits still use the conservative clip reconstruction path. The paired
`note.remove` operation uses the existing `cursor.clearNote` host method. No
extension change or deployment was necessary.

## Exact boundary

`note.insert` requires each target channel, start and pitch cell to be empty in
the fresh pre-write snapshot. `note.remove` requires the complete expected note
state to match. Both checks occur before the revision-guarded write.

The write set labels these operations as targeted inverses. Existing notes in
the same channel remain boundary evidence, but they are not replay material.
Reversal uses the exact post-write readback to build `note.remove`. A removal
reverses to `note.insert`, so undoing a reversal keeps the same exact path.

If a batch also uses `note.write`, `note.clear`, or `note.props` on the same
address, the target returns to whole-clip replay. This preserves the prior
safety rule for replacements, moves, and expression edits.

The reversal fingerprint remains channel-wide. An unrelated later edit in the
same MIDI channel blocks reversal. This is conservative and explicit.

## Live proof

The proof used Bitwig Studio 6.0.6, Controller API 25, extension 0.0.1, contract
`ghostnote/0`, and method hash `78368fe47ea0e814`. The project was
`26.36-4 orangebeat`.

The source was row 0 of the first track named `Filterbowl`, channel ID
`679a945d-9fa0-45b5-bc54-35d602bea00d`. It contained 14 notes. All 14 had
timing that the full writable-grid check could not represent.

The proof duplicated the source into the verified empty row 1. It then inserted
one bounded verification note and reversed it.

| Action | Change ID | Result |
|---|---|---|
| Temporary duplicate | `d1c13803-2129-4e96-aafd-d8d04ffcf958` | Row 1 contained the real source state |
| Targeted insertion | `39e78c06-8d85-44d4-83ec-8c3652e43593` | Exact fidelity; no disagreement |
| Targeted reversal | `6cbbbeb7-439f-4f02-a4d4-f64da24827e0` | One `note.remove`; complete source state matched |
| Temporary cleanup | `6be08ff7-5083-48c2-8860-daefe54749ff` | Row 1 read back empty |

The exit mark was revision 20, scene epoch 2, content epoch 32861, and generation
`2941dc9e-bde5-4bc5-8e47-7923663b1316`. The proof did not start transport or
change the retained row 0 clip.

## Verification

The complete brain check passed 1,161 tests. Focused compiler, adapter,
contract, engine, and stash tests cover:

- pure insertion and mixed-edit compilation;
- start-only removal grids and writer paging;
- exact fake and live adapter behavior;
- empty-cell, same-pitch overlap, and complete-note preconditions;
- targeted reversal with off-grid unrelated source notes;
- changed post-state refusal, slicing, and undoing the reversal;
- fallback to whole-clip replay for mixed writes.

`git diff --check` and TypeScript type checking passed.

## Retrospective

The host primitive already existed. The missing part was a product-level
ownership type. Treating every note write as a replacement hid this safe,
smaller inverse.

The earlier played-range issue is separate. Symbolic context still does not
normalize a clip whose played material starts outside its declared local range.
Its refusal should name consolidation as the supported remediation. Do not
silently reinterpret or trim that material.
