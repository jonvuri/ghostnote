---
title: Phase 4, session 4c — direct-parameter core
kind: plan
state: complete
status: Complete. E55 proves safe top-level enumeration, read, write,
        independent readback, and exact checkpoint replay.
updated: 2026-08-22
parent: README.md
prev: 4b-clip-operation-latency.md
next: 4d-native-device-catalog.md
scope: General top-level DirectParameter contract and live adapter
evidence: E4, E4b, E7, E18e, E55 · D5, D6, D8, D10
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

## Result

E55 closes the session. DirectParameter IDs are the primary general keys. The
contract exposes normalized base values and explicit observation availability.
Typed indices remain optional. Snapshot reporting separates missing,
unreachable, and unstable parameter targets.

The live adapter uses one serialized device cursor. It forces an observer
transition, clears the generation, confirms the target device-bank reply, pins
the track and device, and requires two equal current-generation inventories.
Device and container state remain readable when only the parameter observer is
unstable.

Each write reacquires the parameter before mutation and again for independent
readback. Direct writes use `resolution=1`. A non-taking write fails its receipt
and appears as an executor disagreement. Exact replay uses the captured base
value. Typed modulation and automation state produce warnings when available.

The fake models settlement, stale generations, non-taking writes, and positional
device re-indexing. The full offline suite passed 679 tests. Full live
conformance passed 54 cases with six expected skips. Typecheck, extension tests,
the fresh handshake, the direct live probe, cleanup, and the accepted-project
baseline passed.

One serialized cursor is sufficient for correctness. This session did not
measure a need for more cursors. Session 4h owns that performance decision.

## Review follow-up

Review found that a numeric DirectParameter ID could share a canonical key with
the same typed parameter index. Direct IDs now use an escaped `direct:` key
namespace. Typed numeric keys keep their prior form. Address and write-set tests
prove that typed index `0` and DirectParameter ID `"0"` remain separate. The
full offline suite now passes 681 tests.
