---
title: Phase 8h4c — Document edit limb
kind: plan
state: planned
status: Planned. Adds edit_launcher_clip for desired documents and sparse patches through the host binding, guarded by the D32 reference.
updated: 2026-10-06
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h4b2-document-read-compactness-and-gain.md
next: 8h4d-musical-and-clip-surface-migration.md
evidence: E8, E15, E24, E43, E121, E128, E129, E230, E233; D8, D9, D16, D21, D23, D31, D32
---

# Phase 8h4c — Document edit limb

## Why

D21 selects one guarded document edit limb. It takes a complete desired
document or a sparse patch in the same model. The binding has pure checks
(`assessBindingProposal`, `resolvePartialProposal`, `d9MappedFields`). No
live path connects them to the executor.

## Decisions taken in planning

- **Name.** `edit_launcher_clip`, in `agent-native-v1`.
- **Preview.** No mandatory preview for a clear, lossless edit (8a goal 2).
  A `dryRun` flag returns the plan, effects, and loss with no host call
  after the fresh read.

## Entry

Read the host binding sections "Defaults and proposed changes", "Base
resolution and conflicts", and "D9 writes, loss, and readback"; the
migration contract T3 rows; D8, D9, D16, D31; and the 8h4b registry.

## Work, in order

### 1. Request and plan

- Input: the base ref from `read_launcher_clip` and either a `desired`
  document or a sparse `patch`, in FIELDS or JSON. A request without a base
  ref is valid only for an empty slot or with an explicit `replace` intent on
  an occupied clip, and it still needs the fresh target guard.
- Follow the host binding base-resolution steps 1–6 in order: codec
  validation, registry resolution, the D32 verdict (`current` only),
  re-projection against the original R27 guard, partial-base resolution, and
  capability, collision, geometry, and protection checks.
- Build the candidate from fresh raw state. Preserve raw finer timing and raw
  unrepresented controls on untouched notes. Refuse a reconstruction that
  needs unproved pressure or repeat replay. Refuse same-channel, same-pitch
  overlap. Do not use the D21 shortening rule.

### 2. Lowering and write route

- Lower to executor operations through `d9MappedFields` and the existing D9
  encoder. Set every mapped default explicitly for new notes; do not use
  `track-neutral-v0`.
- Select the route: E128 targeted insertion and removal when the plan proves
  cell ownership and has no same-pitch collateral; otherwise whole-clip
  replacement with complete all-channel protection (D16).
- Pass the D32 reference as `ifSnapshot` and the 8h4a scene guard. Any
  non-`current` verdict refuses before a host mutation, and `stale` returns the
  new document.
- Clip properties (name, loop, length, play range) use the E43 writer order
  and refusals in the binding metadata table.

### 3. Readback and result

- Read back through an independent fresh read. Project with the confirmed
  candidate ID map. Compare the affected scope; whole-clip routes compare all
  16 channels.
- Return the write envelope: the change ID, effects, compact readback (the new
  base ref and a summary, not the full document unless requested), loss, and
  discrepancies. A partial or failed write returns all known effects and does
  not retry.
- The change ID reverts through the existing `revert_change` boundary. Add
  reversal cases for the targeted and the whole-clip routes.

## Live acceptance

Owned unsaved project, normal archive, `agent-native-v1`. Start each matrix
from a rewritten clip with a palette colour.

1. Sparse patch: add, remove, velocity, pitch, `1/512` nudge, expression
   member, and a property change. Each applies and verifies. IDs follow the
   identity table.
2. Desired document: replace a typical clip completely. All 16 channels match
   the independent read. Pressure on an untouched note survives.
3. Refusals before any mutation: stale base (operator edit), scene insert,
   project switch, a pressure reconstruction, a repeat reconstruction, a
   same-pitch overlap, notes past the loop. A raw read before and after shows
   no change.
4. Reversal of one targeted and one whole-clip edit. A concurrent edit after
   the write blocks the reversal with a reason.
5. Cost: one read and one edit call for a 16-note insertion. Record wall time
   against the E121 16,044 ms apply and the 8,000 ms target.
6. Worst case: time one `edit_launcher_clip` call end to end, with
   verification, for a whole-clip replacement at the reader limits (4,194,304
   steps or one full 131,072-note page, whichever the fixture writer reaches
   first). If one request accepts more than one clip, also time the largest
   such request. 8h4d
   compares these times with the 60 s client timeout that E45 measured, to
   decide whether the asynchronous operation tools stay.

## Acceptance criteria

- Complete documents, patches, and overlays pass the codec corpus through the
  edit path on the fake adapter, with field preservation and overlay
  invalidation tests.
- Every refusal in the live list writes nothing.
- Timing stays rational at the document boundary. Conversion adds no
  normalization loss.
- The 8a goals 2 and 3 are measured and stated. The worst-case edit times
  are recorded.
- Brain check, binding corpus, extension check, context check, and
  `git diff --check` pass. Record the evidence as E236.

## Out of scope

- Retirement of `generate_clip_music`, `transform_clip_music`, `write_notes`,
  and `erase_notes` (8h4d).
- Groove patches. An overlay edit must state realized event updates.
