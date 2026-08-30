---
title: Phase 5o — late-bound container modulation
kind: plan
state: complete
status: Complete. FX Layer late-binds native and VST3 devices; other tested shapes are unsupported.
updated: 2026-08-29
parent: README.md
evidence: D1, D3, E11e, E17, E18e, E68, E90
---

# Phase 5o — late-bound container modulation

## Result

Session 5o is complete. The human-authored FX Layer seed supports an initially
empty target at device position 0. Existing Polysynth and Zebra3 VST3 instances
keep their observed state and receive active modulation after relocation.

Chain cannot address its empty named slot. Instrument Layer cannot address an
empty entry, and its placeholder route stays bound to the placeholder instance.
[E90](../../evidence/experiments/e90-fx-layer-late-binding-is-live.md) records
the complete matrix, asset manifest, and exact cleanup.

## Purpose

Find and prove the host recipe that lets Ghostnote create a modulated container
before it moves an existing device into that container. This is the gate for
preserving the existing ColourCopy instance and its state.

## Scope

1. Test an owned container preset whose outer modulator targets the first
   device position in an initially empty entry.
2. Load the container, move one native device into the target entry, and prove
   that the route becomes active without reloading the container.
3. Repeat with one VST3 or CLAP plug-in and a general DirectParameter target.
4. If an empty late-bound target is discarded, test one bounded fallback: an
   owned placeholder at the same target position followed by a guarded device
   relocation that preserves the requested instance.
5. Prove the passing recipe on Chain, Instrument Layer, and FX Layer when the
   host supports that shape.
6. Promote only passing, human-authored seeds. Record a manifest, SHA-256,
   source Bitwig version, semantic target slot, and external-reference status.
7. Remove every scratch object and restore the exact project entry state.

## Acceptance criteria

- At least the FX Layer path passes with an existing plug-in instance before
  Session 5p can start.
- The moved device keeps its observed name, enabled state, complete
  DirectParameter ids, and base-value fingerprint.
- The outer modulator page is present before the move and the target changes
  from inactive to active after the move.
- No automation is used as a substitute for modulation.
- A route to the wrong device position remains inactive as a negative control.
- A failed strategy leaves a recorded result and no project residue.
- Every shipped seed is owned, measured, and covered by integrity tests.
- The full brain check, extension tests, deploy freshness, and focused live
  matrix pass.

## Out of scope

- A public write tool.
- Multi-device composition.
- Automatic reversal of a completed wrap.
- Raw route input from callers.

## Handoff

Session 5p turns the proved FX path into one guarded existing-device lifecycle.
If no FX path passes, stop and record the host blocker instead of simulating the
requested capability.
