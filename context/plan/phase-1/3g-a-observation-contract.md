---
title: Phase 1, session 3g-a — observation contract and capture protocol
kind: plan
state: complete
status: COMPLETE 2026-08-15. The versioned record, canonical codec, capture
        transitions, strict validation and failure report are implemented and
        verified offline. Next is 3g-b persistence.
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

## Contract settled 2026-08-15

Schema v1 is the strict `ghostnote-observation-record` JSON envelope. It has a
schema version and one ordered entry list. Every entry has a stable entry id, a
correlation id, a millisecond timestamp, and a tool-description version. Entry
ids and result execution ids are unique within one record. They do not depend on
array position.

The entry union is:

| entry | exact meaning |
|---|---|
| `instruction-observation` | Caller-supplied raw instruction or structured write scope, requested-scope label, optional rationale, explicit operator response, and independent result entry references. |
| `managed-event` / `device-alternate` | One independently confirmed successful `create_device_alternates` execution, with track id, observed container position, and alternate names. |
| `managed-event` / `clip-block` | One independently confirmed successful `copy_clip_down` execution, with track id and source and copied launcher rows. |
| `ordinary-use` / `copy-track` | One independently confirmed successful `copy_track` execution, with source and fresh durable copied-track ids. It has no managed-event semantics. |

No `none` row exists. An instruction with no result references represents no
managed structure or ordinary track copy. A veto uses the same form and needs no
fake result. A mixed instruction can refer to both managed structures, but the
events keep different entry, execution, and result identities. Their shared
correlation id records provenance only. It does not create a common lifecycle,
atomic switch, or combined alternate.

### Capture protocol for 3g-d

1. Create an instruction observation from explicit caller input when that input
   is available. Preserve `rawScope` as JSON data. Assign its requested-scope
   label explicitly. Start `operatorResponse` as `silent` and `resultIds` as
   empty.
2. Give each relevant tool execution its own stable execution id. Do not add a
   result entry for a refusal, thrown error, or unconfirmed write.
3. After independent project readback confirms a successful creation, append
   exactly one matching managed event. Only `create_device_alternates` can append
   a device event. Only `copy_clip_down` can append a clip event. The other
   lifecycle tools cannot append managed events.
4. After independent readback confirms `copy_track`, append one ordinary-use
   entry with the fresh durable copied-track id. Do not convert it to a managed
   event.
5. Enrich the instruction observation with the independent result entry ids.
   Every reference must have the same correlation id. Do not merge their result
   identities. The observation can also be created after the work and enriched
   against result entries already present.
6. Record rationale, `accepted`, or `vetoed` only from explicit observation
   input. Never infer them from tool success, host permission, silence, or result
   text. `silent` remains unchanged when no explicit response arrives.
7. Stamp every entry with the one description version supplied by the future
   production wrapper. Normal lifecycle input schemas do not carry correlation,
   rationale, response, or description-version fields.

Decode refuses invalid JSON, unknown fields, broken references, duplicate entry
or execution ids, malformed identities, and unsupported schema versions. Encode
sorts object keys. A capacity check evaluates the complete canonical value and
refuses before replacement; it never slices, evicts, or truncates data.

The persistence boundary must report unavailable storage separately. If a
Bitwig write succeeds and a later record update fails, the public result is a
partial success: `projectWrite.succeeded` stays `true`, while
`observationUpdate.succeeded` is `false` with a typed record error. The result
must not recast or retry the confirmed project write as a failed write.

Implementation lives in `brain/src/observation/record.ts`. Focused tests cover
the three entry types, three operator responses, raw-scope and rationale round
trips, independent mixed correlation, creator restrictions, unique execution
results, malformed and unsupported records, exact capacity refusal, and the
post-write failure report. Enrichment also refuses to replace an explicit
rationale or operator response with different data.
