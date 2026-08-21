---
title: Phase 4, session 4c — direct-parameter core
kind: plan
state: planned
status: Planned after 4b. Build safe top-level enumeration, read, write, and
        checkpoint replay.
updated: 2026-08-21
parent: README.md
prev: 4b-clip-operation-latency.md
next: 4d-native-device-catalog.md
scope: General top-level DirectParameter contract and live adapter
evidence: E4, E4b, E7, E18e · D5, D6, D8, D10
---

# Phase 4, session 4c — direct-parameter core

> **Purpose.** Make arbitrary top-level device parameters readable, writable,
> verified, and checkpointed through the general DirectParameter path.

## Carry-in

The contract already names a parameter and can encode a write. The live adapter
cannot read one, and its write route does not acquire or confirm the addressed
device. The extension surface is probe-oriented: it uses one cursor device,
retains observer maps across repoints, and exposes 16 repeated Polysynth handles
through a 64-handle scale allocation.

DirectParameter is the general path. It self-enumerates native, VST, and CLAP
parameters. Typed handles remain a supplementary deep path.

## Decisions

- A DirectParameter id is the primary general parameter key.
- A device remains a durable track id plus a positional chain path. Any chain
  edit invalidates the device position.
- General values are normalized from 0 through 1.
- A typed handle may add display, modulation, automation, origin, and discrete
  value information. Absence of those fields means not observed.
- The first product route is serialized through one confirmed device cursor.
  Add cursor-device concurrency only after session 4h measures a need.

## Scope

1. Define parameter inventory and state with id, name, normalized base value,
   and explicit observation availability. Keep the legacy numeric index only
   where a typed plugin view requires it.
2. Acquire the durable track, pin its cursor, select the top-level device by
   current position, and confirm the track and device before any read or write.
3. Give every repoint an observation generation. Clear prior ids and values,
   then accept an inventory only after the expected target and two equal
   consecutive observations agree within bounded attempts.
4. Read arbitrary DirectParameter ids through the live adapter. Report missing,
   unreachable, and unstable separately.
5. Write with `resolution=1`, then read independently. Report a silent no-op as
   a disagreement, never as success.
6. Snapshot the base value before mutation and replay it through `param.set`.
   Preserve `modulatedValue` and `hasAutomation` as warnings when a typed handle
   can observe them.
7. Make the fake model observer settlement, stale observer generations,
   non-taking writes, and device re-indexing.

## Required boundaries

- Top-level devices only. Session 4f owns nested traversal.
- Do not use remote-control pages as general enumeration.
- Do not claim that a missing display string means a missing parameter.
- Do not claim that a base-value write is the heard value when modulation or
  automation is present.
- Do not accept an inventory that belongs to the prior cursor target.
- Do not add a public MCP schema in this session.

## Exit criteria

1. A top-level native device exposes more than eight named parameters through
   the contract and both adapters.
2. A read identifies the expected track and device and returns a stable current
   DirectParameter inventory with no retained values from the prior target.
3. A normalized write lands, independent readback agrees, and exact reversal
   restores the captured base value.
4. A simulated or live non-taking write is reported as a disagreement.
5. Device deletion or reordering forces re-resolution before the next parameter
   operation.
6. Typed-only fields are optional and never invented for a direct-only device.
7. Focused tests, full conformance, the brain check, extension tests, context
   check, and `git diff --check` pass.

## Retrospective target

Record whether one serialized cursor is sufficient for real parameter batches.
Do not allocate a wider observer pool without a measured need.
