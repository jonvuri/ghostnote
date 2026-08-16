---
title: Phase 1, session 3g-b — per-project persistence transport
kind: plan
state: complete
status: COMPLETE 2026-08-15. The review fixes pass offline and live. The legacy
        probe refuses safely, and the lossy project-name guard is explicit.
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
8. Report absent storage, downcast refusal, size overflow, stale readback, and a
   detected foreground-project name change as different failures. API 25 has no
   stable project id, so same-name tabs remain indistinguishable.
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
   value. The operation guard detects the switch when the project names differ.
5. An oversized record refuses before replacement. No value is truncated.
6. The record row is absent from the settings pane, and the pane remains
   responsive with a realistic payload.
7. Brain checks, extension Gradle tests, context check, `git diff --check`, and a
   focused live persistence smoke pass.

## Result

The extension creates one hidden 262144-character document setting during
`init()`. It keeps the pre-creation `Setting` check and has no runtime product
creation route. `observation.read` returns the exact opaque value and capacity.
`observation.replace` refuses overflow before it calls the setting. Generic
`ui.get` and `ui.set` remain probe-only.

The brain exposes a separate `Session.observations` boundary. It refuses local
overflow before a wire call, polls exact readback for at most 40 attempts, and
does not accept the write acknowledgement as proof. Storage absence, downcast
refusal, stale readback, capacity exhaustion, and detected project-name changes
have different errors. Bitwig API 25 exposes no stable project id. Same-name tab
switches remain indistinguishable, while `DocumentState` still scopes the value
per project. The fake store keeps the same capacity and per-project behavior for
offline tests. JSON decoding, schema validation, and canonical encoding remain
in the brain.

The retired E20d capacity probe refuses before it reads or writes the production
record. It directs operators to the preserving 3g persistence probe.

The live smoke passed exact empty, populated, and Unicode round trips. Overflow
left the prior value unchanged. A test marker survived project save, controller
reload, project switching, and a full Bitwig restart. Another project did not
reuse it. The marker was then removed exactly. The operator confirmed that the
record row was absent from the settings pane. The pane and Bitwig remained
responsive through the check.

Brain typecheck and **478/478** offline tests pass, including **18/18** focused
observation tests. Extension Gradle test, context check, and `git diff --check`
pass. The live 149-method table matches hash `bd01617c718f5c50`.

Review follow-up: the E20d probe refused live before record access. The reloaded
build passed hello and the preserving persistence smoke with the accurate
`projectName` reply. The original record was restored exactly.
