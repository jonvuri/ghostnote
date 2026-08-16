---
title: Phase 1, session 3g-a — observation contract and capture protocol
kind: plan
state: active
status: READY 2026-08-15. The 3f-i mechanical handoff is complete and verified
        live. This session defines the record before storage or tool behavior
        changes.
updated: 2026-08-15
parent: 3g-record.md
prev: 3f-fork-chain.md
next: 3g-b-persistence.md
scope: revised D18e/f
evidence: E20c/d; D18–D20
---

# Phase 1, session 3g-a — observation contract and capture protocol

> **Purpose.** Define exactly what the observation record means and how missing
> conversation context enters it. Do this before the project stores any
> production observation.

## Scope

1. Define a versioned JSON envelope and canonical codec for the observation
   record.
2. Define instruction-observation, managed-event, and ordinary-use entries as
   separate types.
3. Define stable identifiers and correlation rules. Correlation never links
   lifecycles or promises atomic switching.
4. Store both a requested-scope label and the caller-supplied raw request or
   write scope. The label is one of `device-only`, `launcher-clip-only`, `mixed`,
   or `unsupported`.
5. Restrict managed-event structure to `device-alternate` or `clip-block`.
   `copy-track` and `none` are observation outcomes, not managed structures.
6. Define operator response as `silent`, `accepted`, or `vetoed`. `silent` is the
   initial value. Only explicit record input can change it.
7. Define how an observation can be created before work and enriched after work
   with managed-event or ordinary-use identifiers.
8. Define malformed-record, unsupported-schema, unavailable-store, and
   capacity-exhaustion behavior. No path can discard or truncate data silently.
9. Define the failure report for the case where a Bitwig write succeeds but the
   following record update does not. The result must report both facts and must
   not claim that the project write failed.

## Out of scope

- extension wire methods or document-setting changes;
- production tool instrumentation;
- public description edits or version assignment;
- report aggregation;
- retention, compaction, deletion, or migration between released schemas.

## Required design properties

- A successful `create_device_alternates` call can produce exactly one managed
  event.
- A successful `copy_clip_down` call can produce exactly one managed event.
- Other lifecycle operations cannot produce a managed event.
- A mixed instruction can refer to two managed events through one instruction
  observation.
- A veto or no-action result is representable without a fake structure.
- A track copy is persistently observable without gaining managed lifecycle
  semantics.
- Every persisted entry has a tool-description version.
- The six stable device-tool input schemas remain unchanged.

## Exit criteria

1. Types, validation, canonical encoding, and decoding are implemented and
   covered by focused tests.
2. Tests distinguish all three entry types and all three operator responses.
3. Round-trip tests preserve raw scope and unknown free-form rationale text.
4. Tests prove that mixed correlation does not combine event identities.
5. Tests refuse malformed data, unsupported schema versions, and silent
   truncation.
6. The contract documents the exact capture protocol that 3g-d will implement.
7. Brain typecheck, focused offline tests, context check, and
   `git diff --check` pass. No live Bitwig run is required.
