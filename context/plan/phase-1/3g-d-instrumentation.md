---
title: Phase 1, session 3g-d — production event instrumentation
kind: plan
state: active
status: READY 2026-08-15. The record, persistence transport, and exact
        ghostnote-description-v1 public cohort are complete.
updated: 2026-08-15
parent: 3g-record.md
prev: 3g-c-description-freeze.md
next: 3g-e-reporting.md
scope: revised D18e/f
evidence: E20c/d; D18–D20
---

# Phase 1, session 3g-d — production event instrumentation

> **Purpose.** Record successful alternate creation and ordinary track-copy use
> through one production execution path, while collecting unavailable
> conversation context explicitly.

## Scope

1. Give tool execution one shared wrapper used by direct offline calls and MCP
   registration. Instrumentation cannot exist on only one route.
2. Add declarative observation metadata to the relevant tool specifications.
   The shared wrapper uses that metadata instead of inferring success from
   arbitrary result text.
3. Record one managed event after independently confirmed
   `create_device_alternates` success.
4. Record one managed event after independently confirmed `copy_clip_down`
   success.
5. Return the managed-event id with each successful creation result.
6. Do not create rows for inspection, filling, switching, launch, movement,
   winner collapse, selective reduction, or failed creation.
7. Record successful `copy_track` use as an ordinary-use entry with its fresh
   durable track identity. Keep its normal session changes unchanged.
8. Add a non-destructive observation surface that creates or enriches an
   instruction observation with raw scope, rationale when supplied, operator
   response, and related managed-event or ordinary-use ids.
9. Let one instruction observation correlate any number of independent results.
   Do not add shared switching or lifecycle behavior.
10. Stamp every entry from the single 3g-c v1 source. Do not accept a caller-
    supplied description version.
11. Preserve the six device-lifecycle input schemas and their permission grain.
12. Surface record failures separately from project-write results. Never report
    a successful Bitwig write as though it did not happen.

## Out of scope

- aggregate reporting;
- automatic classification of raw instructions;
- operator-response inference from host prompts or tool success;
- record retention or deletion;
- description revision after v1.

## Exit criteria

1. Device and clip creation each add exactly one managed event on success and
   none on refusal or unconfirmed creation.
2. Other lifecycle calls do not add managed events.
3. One mixed instruction produces two correlated event entries with independent
   result identities.
4. Track copy produces an ordinary-use entry and no managed event.
5. Veto and no-action observations need no invented project structure.
6. Explicit enrichment preserves raw scope and all three operator responses.
7. Direct offline calls and MCP calls use the same instrumentation path.
8. Brain checks, extension tests when touched, context check,
   `git diff --check`, live conformance, and focused production MCP smoke pass.
9. Live cleanup returns the project to its documented baseline.
