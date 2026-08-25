---
title: Phase 5r — container shape and capacity
kind: plan
state: planned
status: Planned after 5q. Generalize supported shapes and all observable capacity dimensions.
updated: 2026-08-25
parent: README.md
evidence: D1, D7, D15, D16, E17, E18, E71-E73
---

# Phase 5r — container shape and capacity

## Purpose

Remove the one-shape, four-entry, and first-two-container restrictions. Define
honest public limits from complete observer coverage.

## Scope

1. Support the proved Chain, Instrument Layer, and FX Layer shapes through one
   public composition contract. Keep Drum Machine in its separate per-note
   contract.
2. Measure the extension resource cost for top-level container scopes, entries
   per layer, devices per entry, and nested route depth.
3. Select bounded capacities that keep every accepted result completely
   observable. Increase the current banks when the resource budget permits it.
4. Address a container at every supported top-level device position, not only
   positions 0 and 1.
5. Grow layer entries through the proved typed duplication path. Refuse the
   next entry before it can leave the complete bank window.
6. Support the measured number of ordered devices per entry and report that
   limit in inspection and refusal results.
7. Keep repeated names addressable through ordered semantic paths and unique
   entry names.

## Acceptance criteria

- The public result reports exact capacities for top-level positions, entries,
  devices per entry, and route depth.
- At least one layer case exceeds the former four-entry limit and remains
  completely observable.
- A container after top-level position 1 is composed, inspected, targeted, and
  reversed successfully.
- Chain, Instrument Layer, and FX Layer each pass structure and active
  modulation witnesses.
- Boundary tests accept the last safe value and refuse the next value before a
  write.
- Extension resource accounting, method-table checks, fake/live conformance,
  the full brain check, and cleanup pass.

## Out of scope

- Unbounded structure. The Controller API requires fixed observer banks.
- Grid devices and Grid patch synthesis.
- Folding Drum Machine pad routing into layer composition.
- New parameter-write grammar.

## Handoff

Session 5s runs the real ColourCopy request and audits the complete generalized
surface.
