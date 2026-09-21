---
title: Phase 7b — Agent patch execution and reference dogfood
kind: plan
state: planned
updated: 2026-09-20
parent: README.md
prev: 7a-symbolic-context-and-read-only-analysis.md
next: 7c-documentation-provider.md
---

# Phase 7b — Agent patch execution and reference dogfood

## Purpose

Implement the selected patch compiler and connect it to the existing guarded
Bitwig write seam. Prove one reference-conditioned revision with exact readback
and an operator verdict.

## Work

1. Parse and validate the 6f patch form against the exact source identity.
2. Compile the selected `transpose`, `delete`, `move`, and `insert` operations
   into complete candidate state and explicit typed note operations.
3. Show the exact planned before and after state and declared invariants before
   the write.
4. Refuse stale identities, sequential operation conflicts, lossy defaults,
   collisions, unsupported host properties, and impossible ranges.
5. Apply accepted edits only through the existing recorded workspace seam.
6. Verify complete host-normalized readback and retain exact reversal data.
7. Run one reference-conditioned dogfood task under the 6g provenance and copy-
   overlap rules.

## Selected implementation boundary

Implement [note-compiler-v0 and reference-context-v0](../../evidence/format/WORKSTATION_CONTRACTS.md).
Close [S06, S07 and S09](../../evidence/format/WORKSTATION_SEAMS.md). Accept the
frozen `ghostnote-note-patch-v0` body with the exact source wrapper from 7a and
explicit invariants. Keep preview read-only. Extend `transform_clip_music` with
a discriminated proposal input only in the frozen experimental tool profile.
The stable deterministic v1 input and tool grain stay intact.

Translate complete candidates into the existing `Workspace.apply` path. Keep
all-channel reconstruction, fidelity protection, exact guards, change records,
and independent complete readback. Prove neutral insertion defaults without an
unsupported pressure write. Do not apply overlap shortening without permitted
and reported loss.

Use extracted reference structure by default. Add a bounded raw v0 context only
for a named task detail. Measure copying against the complete reference, not
only the excerpt shown to the agent. Keep reference and seed IDs separate.
Use longer audition material, fixed backing, and a direct listening instruction.
Musicpy is optional; the first run does not require it.

## Acceptance criteria

- The host agent selects the musical edit. The module compiles and verifies it.
- Each write has exact target guards and independent complete readback.
- Required fields not named in the patch remain exact.
- Reference identity, permission, coverage, and overlap measures are present.
- Musicpy or another helper is optional and cannot bypass the exact wrapper.
- The operator accepts or rejects the auditioned result explicitly.
- Rejected owned work reverses only when the recorded boundary proves it safe.
- Focused tests, the full brain check, required live checks, context check, and
  `git diff --check` pass.

## Out of scope

- An unbounded prompt-to-song tool.
- Automatic aesthetic acceptance.
- Making Notochord a product dependency.
- A stable public contract.
- General pattern expansion, relative groove requests, or direct acceptance of
  `ghostnote-groove-patch-v0`; S08 requires a later task and compiler revision.

## Retrospective target

Record whether the patch language reduced full-score regeneration and repair.
