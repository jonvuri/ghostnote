---
id: E93
kind: evidence
state: accepted
source: phase-5-session-5r-container-shape-and-capacity
---

# E93 — Container shape and capacity [K] (2026-09-01)

**Verdict: one public contract models Instrument Layer and FX Layer at exact
bounded capacities. Both shapes support active outer modulation on caller
devices. Chain does not: its empty slot is not addressable, and its populated
outer route binds to the embedded device instance.**

## Selected capacities

The public result reports these exact limits:

- top-level container positions: 3, at positions 0 through 2;
- layer entries: 5;
- ordered devices per entry: 4;
- total parameter route depth from the track: 2.

The next value in each dimension refuses before a project write. Instrument
Layer and FX Layer use unique caller entry names.

The owned layer consumes the first parameter-route step. A preset-local device
can use one additional semantic entry step. Verification reads that selected
device, not the preset root. The checkpoint keeps the semantic location so
reversal verifies the same selected device.

## Observer and operation changes

The extension builds three top-level container scopes. Each scope holds a
five-entry layer bank with four nested device rows. Exact layer and device item
counts distinguish a full bank from overflow. A shared device cursor and
four-row sibling bank can inspect a populated named slot without fixed
named-slot banks.

`rig.info` reports all four selected limits. `rig.stats` reports 48 device banks
and 492 device slots. The 15 layer entry-device banks supply 60 nested slots.
Fixed named-slot bank and slot counts are zero.

The typed relocation operation accepts named layer entries and populated named
device slots. Its guards check the exact parent name, source device, top-level
order, bank width, and independent structure readback. An empty named slot stays
incomplete and refuses before a write.

## Public composition

The input accepts an explicit container position and one through four ordered
devices per entry. The result reports device positions and the exact capacity
object. Checkpoint schema 5 records the requested position, partial seed
renames, completed devices, early inserted sources, container compaction, and
the last proved reversal state. Owned sources reserve one top-level scratch
slot. An interrupted extraction or final removal returns an exact continuation
checkpoint and does not repeat an accepted write.

Layer containers start from human-saved five-entry empty seeds. Binary trimming
retains the exact requested suffix and its serialized chain names. Bitwig
normalizes retained route suffixes to `CHAIN0` through `CHAINn` when it loads the
preset. The workflow renames the observed live entries through unique temporary
names.

Both compressed seed constants reconstruct the exact human-saved preset bytes.
Their manifest records the SHA-256 hash, byte length, Bitwig metadata, container
GUID and offset, outer-list offset, chain spans, and sample-reference count.

## Measured Chain boundary

The empty `gn_empty_chain` preset reports the slot name `CHAIN`, but no
Controller API device cursor can enter it. The runtime cannot insert the first
caller device into that empty slot.

A second human-saved control contained Polysynth at position 0 and Delay+ at
position 1. Its outer LFO route to the embedded Polysynth was active. The probe
moved a caller Polysynth into the slot, removed both embedded devices, and
confirmed that the caller moved to position 0. The outer route then had zero
modulated-value divergence. The route stayed bound to the removed device
instance; it did not late-bind to the final position. Chain is not a supported
public composition shape.

## Verification

- `npm run check`: 983/983 pass.
- `./gradlew test`: passes.
- Fake composition passes FX Layer at top-level position 2 with four devices
  and Instrument Layer with five entries.
- Both cases reverse to their exact prior top-level device order.
- The sixth layer entry, fifth entry device, and top-level position 3 refuse
  before a write.
- Fake public composition completes and reverses a total depth-2 preset route.
  A total depth-3 route refuses before a write. Adapter tests cover the same
  accepted depth-2 DirectParameter route.
- Live public composition completes and reverses a total depth-2 route to a
  Polysynth inside a preset Instrument Layer. Its selected inventory, LFO page,
  and active Filter Frequency behavior pass.
- Shared fake/live conformance proves that an empty named slot refuses before a
  write. Adapter tests cover indexed reads in a populated four-row sibling bank.
- The 150-method golden table includes guarded indexed named-slot selection.
- `probe:hello` passes against Bitwig 6.0.6, API 25, method count 150, and hash
  `73677cd82e4c7cd2`.
- `probe:phase5r-capacity` passes FX Layer at position 2 with four ordered
  devices and active outer modulation.
- The same probe passes Instrument Layer with five entries and active outer
  modulation on entry 5.
- Both live reversals restore the exact prior top-level order.
- Live cleanup restores five tracks and eight launcher rows.

Live conformance exposed a separate stale shared-cursor anchor during nested
resolution. Proving the top-level device before moving the container cursor
fixed it. The focused live rerun passes.

## Retrospective

Preset inspection reports serialized entry names such as `CHAIN1`. Bitwig
loads the default live layer name from its first device, such as `Polysynth`.
Translate the semantic step to the live chain name before direct-parameter
verification, and keep the semantic location in the reversal checkpoint.
