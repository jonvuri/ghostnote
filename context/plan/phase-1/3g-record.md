---
title: Phase 1, session 3g — observation and v1 description program
kind: plan
state: planned
status: IN PROGRESS 2026-08-15. Session 3g-a completed the schema-v1 record and
        capture contract. Session 3g-b persistence is next.
updated: 2026-08-15
parent: README.md
prev: 3f-fork-chain.md
next: 3g-a-observation-contract.md
scope: revised D18
evidence: E20c/d; E22; D18–D20
---

# Phase 1, session 3g — observation and v1 description program

> **Purpose.** Make tool-choice behavior measurable without reinstating a policy
> engine. Freeze a light v1 description cohort, record what agents do, and keep
> enough raw context to revise the instrument later.

## Prerequisites and inherited boundaries

- Clip-block production mechanics are complete through 3e.
- `copy_track` is ordinary CRUD and not a managed alternate.
- The device-alternate lifecycle is complete through 3f-i.
- The six device-lifecycle tool names, privilege classes, input identities, and
  emitted contract operations are stable.

One successful `create_device_alternates` call creates one managed
device-alternate event. One successful `copy_clip_down` call creates one managed
clip-alternate event. Inspection, filling, switching, movement, and reduction
act on existing events. They do not create new event rows.

Device and clip events from one instruction can share a correlation id. They
remain independent structures. Their correlation is not a compound alternate,
an atomic project state, or a shared switch.

## Record model

The record uses three related entry types. This separation resolves the old
conflict between successful managed events and observations whose result is a
track copy, a veto, or no action.

| entry | purpose |
|---|---|
| instruction observation | Stores the raw request or write scope, requested-scope label, agent rationale when available, operator response, correlation id, and description version. It can refer to zero or more result entries. |
| managed event | Stores one successful device-alternate or clip-alternate creation, its observable result identity, correlation, and description version. |
| ordinary use | Stores experimental use of `copy_track`, its durable result identity, correlation, and description version. It does not receive managed lifecycle semantics. |

The operator response is `silent` until an explicit observation records
`accepted` or `vetoed`. Tool success and host permission behavior do not imply
acceptance. A veto or no-action outcome belongs to an instruction observation,
not to a managed event.

Raw requested data is caller-supplied. The MCP server does not receive the user
instruction or an agent rationale through a normal tool call. The recording
surface must collect that context explicitly and must not change the stable
input schemas of the six device-lifecycle tools.

## Program order

1. [3g-a — observation contract and capture protocol](3g-a-observation-contract.md)
2. [3g-b — per-project persistence transport](3g-b-persistence.md)
3. [3g-c — v1 description cohort freeze](3g-c-description-freeze.md)
4. [3g-d — production event instrumentation](3g-d-instrumentation.md)
5. [3g-e — reporting and live closure](3g-e-reporting.md)

Sessions 3g-b and 3g-c are mechanically independent after 3g-a, but the listed
order keeps the handoff linear. Production event recording starts only after
both are complete.

## Program-wide constraints

- Do not add a dispatch classifier or automatic tool choice.
- Do not link device and clip alternates into one lifecycle.
- Do not treat `copy_track` as a managed event.
- Do not infer instruction text, rationale, or operator response.
- Do not evict, truncate, or rewrite raw observations silently.
- Keep record retention operator-owned.
- Keep the document setting hidden at `init()`.
- Keep wording light and factual. State scope, preconditions, costs,
  destructive seams, and required procedures.
- Do not change a frozen cohort without assigning a new description version.

## Program exit

1. Device and clip alternate creation each record one independent event,
   including two correlated events for one mixed instruction.
2. Track copy remains outside managed-event bookkeeping while its ordinary
   change and experimental use remain observable.
3. Raw scope, rationale when supplied, operator response, result identity, and
   description version survive project restart.
4. The hidden setting remains absent from the settings pane and does not degrade
   it.
5. v1 maps to one exact public description cohort. The surface contains no stale
   grouped-fork or three-way-classifier language.
6. Reporting stratifies requested scope and actual structure without prescribing
   a choice.
7. Offline and live end-to-end checks pass with no fixture residue.
