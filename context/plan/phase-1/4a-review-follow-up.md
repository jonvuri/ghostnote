---
title: Phase 1, session 4a review follow-up
kind: plan
state: complete
status: COMPLETE 2026-08-16. Cleanup and project-bound status checks pass.
updated: 2026-08-16
parent: 4-control-layer.md
prev: 4a-status-surface.md
next: 4b-change-navigation.md
---

# Phase 1, session 4a review follow-up

> **Purpose.** Close the two deferred session 4a review findings before clip
> navigation work starts.

## Scope

1. Arm live-probe cleanup before the marker replacement can be accepted. Restore
   the original observation record after a readback timeout or disconnect.
2. Bind each status publication to the project where its change ran. Do not send
   an old project's change id to the current project after a switch or reconnect.
3. Add focused failure and project-switch tests. Run all session 4a checks.

## Rationale

- **Probe cleanup.** The probe sets its cleanup guard only after replacement and
  readback both finish. If Bitwig accepts the marker but readback times out or
  disconnects, cleanup does not run. The marker can then replace the saved
  observation record permanently.
- **Project-bound status.** The status sink uses the shared bridge transport
  without a readiness or project-affinity check. If the foreground project
  changes after a tool writes but before status publication, the new project can
  receive a change id that belongs to the old project.

## Exit criteria

1. Every probe path that can replace the observation record attempts restoration
   with the saved original value.
2. A project switch or unchecked reconnect prevents status publication to the
   wrong project and reports the status failure with the tool result.
3. Brain typecheck and tests, extension tests, context check, and
   `git diff --check` pass.

## Out of scope

- changes to status wording or grouping;
- clip navigation from session 4b;
- automatic status updates or polling.

## Implementation record

The live probe now enters a restoration guard before it sends the temporary
record replacement. The guard restores the saved record after replacement
readback failure, disconnect, or a later probe failure.

Each status update carries the generation and project name from its write
receipt. The live sink runs session readiness before it sends the update. The
extension checks the same expected identity immediately before it updates the
project setting. An unknown identity, project switch, extension restart, or
switch during the wire call fails closed. The tool still returns its successful
project-write result with a separate status failure.

Verification passed: brain typecheck and **513/513** tests, extension Gradle
test, context check, and `git diff --check`. Focused tests cover readback failure,
disconnect, project switch, extension restart, a switch during the wire call,
cross-project grouping, and tool-result failure reporting.
