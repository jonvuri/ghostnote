---
title: Phase 1, session 3g-d — production event instrumentation
kind: plan
state: complete
status: COMPLETE 2026-08-16. Shared instrumentation, explicit context capture,
        live conformance, production MCP proof, and exact cleanup pass.
updated: 2026-08-16
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

## Completion — 2026-08-16

One shared executor now serves direct calls and MCP registration. Tool metadata
declares the only three recorded outcomes. The wrapper appends rows only from
explicit confirmation fields and returns the new result id. If persistence fails
after a confirmed project write, the response reports both facts as partial
success.

The new `record_observation` surface begins and enriches explicit instruction
context. An active instruction links any confirmed results in one record
replacement. Device and clip results retain separate entry and execution ids.
Rationale and accepted or vetoed responses come only from explicit input. Every
entry uses the frozen v1 constant.

Offline tests cover mixed correlation, ordinary track copy, refusals,
unconfirmed creation, veto and no-action context, partial success, and matching
direct and MCP execution. Brain typecheck and **486/486** tests pass. The focused
surface suite passes **49/49**. Context check and `git diff --check` pass.

Live conformance passes **18/0/1**. The preserving production MCP smoke passes
**14/14, P0-P13**. It verifies two correlated managed events with independent
entry and execution ids, one separate ordinary-use row, explicit enrichment,
refusal behavior, and the frozen v1 stamp on every entry.

The first smoke run showed that conformance fixtures must be removed before a
device-instrumentation smoke. An immediate post-cleanup retry also met a stale
track observation. After cleanup and settling, the complete smoke passed. Every
attempt restored the prior empty record and removed any identified disposable
tracks. Final conformance cleanup removed `gn-conf-A` and `gn-conf-B`. The project
is at the documented 10-track baseline with Master visible and no probe residue.
