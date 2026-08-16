---
title: Phase 1, session 3g-b — per-project persistence transport
kind: plan
state: planned
status: not started; depends on the 3g-a record contract
updated: 2026-08-15
parent: 3g-record.md
prev: 3g-a-observation-contract.md
next: 3g-c-description-freeze.md
scope: revised D18f
evidence: E14-A3/A4; E20d; D18
needs: Bitwig running; human confirmation of the settings pane
---

# Phase 1, session 3g-b — per-project persistence transport

> **Purpose.** Turn the E20d storage scaffold into a dedicated product transport
> for one safe, hidden, per-project observation record.

## Scope

1. Add dedicated product wire methods for exact record read and replacement.
   Keep generic `ui.get` and `ui.set` on probe surface.
2. Productize the hidden document setting. It must be created and hidden during
   `init()`, with no runtime creation path.
3. Keep the pre-creation `Setting` downcast check. If the setting cannot be
   hidden, do not create it.
4. Replace the probe-only `recordChars = 0` production behavior with an explicit
   product allocation based on E20d's measured capacity. Keep capacity visible
   to the brain.
5. Treat the extension value as an opaque string. Put JSON schema and record
   validation in the brain.
6. Poll asynchronous setting writes until exact readback is observed or a bound
   expires. An acknowledgement is not proof that the value landed.
7. Add one observation-store interface to the live boundary. Keep it separate
   from musical operations and the session stash.
8. Report absent storage, downcast refusal, size overflow, stale readback, and
   project change as different failures.
9. Update extension method registration, the live wire map, the golden, and the
   fake needed for offline store tests.

## Out of scope

- managed-event or track-copy instrumentation;
- public MCP observation tools;
- description wording and v1 assignment;
- retention, eviction, compaction, or record deletion;
- control-layer UI work from session 4.

## Exit criteria

1. Empty and populated records round-trip byte for byte through the product
   methods.
2. A bounded poll proves each write landed. A stale prior value cannot pass.
3. The record survives controller reload, project save, and application restart.
4. Switching projects reads the new project's record and does not reuse the old
   value.
5. An oversized record refuses before replacement. No value is truncated.
6. The record row is absent from the settings pane, and the pane remains
   responsive with a realistic payload.
7. Brain checks, extension Gradle tests, context check, `git diff --check`, and a
   focused live persistence smoke pass.
