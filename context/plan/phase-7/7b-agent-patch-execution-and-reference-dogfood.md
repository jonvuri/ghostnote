---
title: Phase 7b — Agent patch execution and reference dogfood
kind: plan
state: planned
updated: 2026-09-13
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
2. Compile regions, patterns, and relative requests into explicit note edits.
3. Show the exact planned before and after state and declared invariants before
   the write.
4. Refuse stale identities, ambiguous regions, lossy defaults, collisions, and
   impossible ranges.
5. Apply accepted edits only through the existing recorded workspace seam.
6. Verify complete host-normalized readback and retain exact reversal data.
7. Run one reference-conditioned dogfood task under the 6g provenance and copy-
   overlap rules.

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

## Retrospective target

Record whether the patch language reduced full-score regeneration and repair.
