---
title: Phase 5p — existing-device modulation wrapper
kind: plan
state: planned
status: Next after 5o. Wrap one existing device with the proved FX Layer lifecycle.
updated: 2026-08-29
parent: README.md
evidence: D1, D7, D15, D16, E18c, E18e, E68, E90
---

# Phase 5p — existing-device modulation wrapper

## Purpose

Add one public workflow that places an existing project device inside an owned
modulated container, targets its observed parameters, and preserves the device
instance and state.

Use FX Layer only. E90 proves that Chain cannot select an empty named slot and
that Instrument Layer placeholder routes do not transfer to a replacement.

## Scope

1. Accept one current top-level device, a proved container kind, one entry name,
   and one or more manifest-backed modulator and general target requests.
2. Read the complete top-level device order and enabled state and the target's
   complete stable DirectParameter inventory before any write.
3. Author and insert the owned container from 5o. Then move the existing device
   into its target entry. Do not create a replacement plug-in instance.
4. Verify the complete parent-child edge, device name, enabled state, parameter
   ids and bases, modulator pages, and active target behavior.
5. Return one ordered workflow receipt with explicit insertion, relocation, and
   verification stages. Report partial completion after any completed stage.
6. Add guarded reversal that moves the same device back to its prior top-level
   order and removes only the now-empty owned container. Refuse cleanup after
   interference.
7. Keep direct destructive device deletion outside this workflow.

## Acceptance criteria

- Native FX and one plug-in wrap pass without changing their preflight
  parameter-base fingerprints.
- A stale device order, changed enabled state, unstable parameter inventory,
  occupied target entry, or missing target refuses before relocation.
- A failed post-move witness leaves the existing device reachable and reports
  the owned container and exact current location.
- Reversal restores the exact prior top-level order and removes only the empty
  owned container when every guard agrees.
- Interference causes a loud partial reversal. It never removes the container
  while the target device remains inside.
- Public results distinguish preserved opaque state from observed scalar
  fingerprints. They do not claim byte-exact plug-in-state readback.
- Surface tests, fake and live adapter tests, the full brain check, extension
  tests, and focused live cleanup pass.

## Out of scope

- Copying the device.
- More than one existing device.
- Building a new device from a catalog or preset source.
- Wider container capacity.

## Handoff

Session 5q reuses this guarded insertion and relocation pipeline for general
multi-device composition.
