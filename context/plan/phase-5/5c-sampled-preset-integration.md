---
title: Phase 5c — sampled-preset integration
kind: plan
state: complete
status: Complete. E67 records passing multisample add, delete, and cleanup.
updated: 2026-08-23
parent: README.md
evidence: D2, D3, E12, E13, E65, E66, E67
---

# Phase 5c — sampled-preset integration

## Purpose

Prove the checkpointed topology path on presets that embed a multisample. Add
and delete one free-running LFO with a measured footprint. Report the complete
reference-stub relocation as structural evidence.

## Scope

1. Add the curated Sampler LFO donor to `gn_sampler_multi_bare`.
2. Delete the LFO from `gn_sampler_multi_one_lfo`.
3. Use the measured LFO footprint `0x10` for insertion and removal.
4. Validate all four reference stubs against the expected deltas `+0x10` and
   `-0x10` before any project write.
5. Report the before and after stub values, stub count, both footprints, and net
   delta with the checkpoint result.
6. Verify active Attack modulation after add. Verify the LFO page and Attack
   modulation are absent after delete.
7. Keep the loud refusal for an unknown inserted or removed footprint.
8. Reverse both takes and restore the exact entry track list.

## Acceptance criteria

- Offline tests prove four-stub relocation and the reported measured insertion
  and removal footprints.
- Validation uses the expected footprint delta. It does not infer correctness
  from the edited stub values.
- An unknown inserted or removed footprint refuses before `apply()`.
- The focused live proof verifies active Attack after add and inactive Attack
  after delete.
- Reversal and cleanup leave no track, device, or temporary-file residue.
- `npm run check` and the extension Gradle tests pass.

## Out of scope

- New footprint measurements or donor assets.
- Containers, list selection, and cross-device routes.
- Public MCP tools.

## Current verification

- `npm run check` passes 780/780.
- Focused authoring and `bwmod` tests pass 59/59.
- The extension Gradle tests pass.
- `npm run probe:hello` passes, including deploy freshness.
- `npm run probe:phase5c-authoring` passes add, delete, four-stub relocation,
  both reversals, and exact seven-track cleanup.
- [E67](../../evidence/experiments/e67-sampled-preset-authoring-is-live.md)
  records the implementation, proof, cleanup, and qualifications.

## Implementation finding

The expected relocation delta must come from the measured footprint inputs. It
must not be inferred from the edited stub values. A Random page can prove the
structural edit, but an empty-track Random witness does not prove live behavior.
Use a free-running source unless the proof also provides its trigger.
