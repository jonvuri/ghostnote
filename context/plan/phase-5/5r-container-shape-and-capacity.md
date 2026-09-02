---
title: Phase 5r — container shape and capacity
kind: plan
state: complete
status: Complete. Two layer shapes pass at bounded capacity. Chain remains unsupported.
updated: 2026-09-01
parent: README.md
evidence: D1, D7, D15, D16, E17, E18, E71-E73, E93
---

# Phase 5r — container shape and capacity

## Purpose

Remove the one-shape, four-entry, and first-two-container restrictions. Define
honest public limits from complete observer coverage.

## Scope

1. Support the proved Instrument Layer and FX Layer shapes through one public
   composition contract. Keep Chain and Drum Machine outside this contract.
2. Measure the extension resource cost for top-level container scopes, entries
   per layer, devices per entry, and nested route depth.
3. Select bounded capacities that keep every accepted result completely
   observable. Increase the current banks when the resource budget permits it.
4. Address a container at every supported top-level device position, not only
   positions 0 and 1.
5. Trim the five-entry seeds to the requested layer width. Refuse the next
   entry before it can leave the complete bank window.
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
- Instrument Layer and FX Layer each pass structure and active modulation
  witnesses.
- The Chain investigation records why the same lifecycle is not supported.
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

## Implementation status

The selected complete limits are three top-level container positions, five
layer entries, four devices per entry, and total parameter route depth two from
the track. The owned layer consumes one route step. A preset-local device can
consume one more. The public result and pre-write refusals report these exact
values.

Instrument Layer and FX Layer use human-saved five-entry empty seeds.
Composition trims a layer seed to the exact requested width, then renames each
observed entry through a unique temporary name. Exact item counts distinguish a
full bank from overflow. Checkpoint schema 5 covers early seed state, partial
renames, source insertions, container compaction, and interrupted reversal.
Requests with owned sources reserve one top-level scratch slot for reversal.

Chain does not share this lifecycle. An empty `CHAIN` slot cannot select its
first device through the Controller API. A populated human-saved control proved
that its outer route binds to the embedded target instance. The route became
inactive after the placeholders were removed, even when the caller device moved
to the same position. The public shape list therefore excludes Chain.

Exact manifests cover the two supported layer seeds. Brain verification passes
983/983. Extension tests and the 150-method table pass. The live probe passes
FX Layer at top-level position 2 with four devices and Instrument Layer with
five entries. It also passes a total depth-2 route to a Polysynth inside a
preset Instrument Layer. All three cases have active modulation and exact
reversal. All next-value boundaries refuse before a write. Cleanup restored
five tracks and eight launcher rows.
