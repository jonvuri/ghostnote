---
title: Phase 1, session 3g — observation, tool descriptions, and the v1 freeze
kind: plan
state: active
status: READY 2026-08-15. `copy_track` and 3f-i lifecycle closeout are complete
        and verified live. The old three-way dispatch classifier is retired.
        This session records independent managed alternate events and observes
        whether naming and descriptions lead agents toward correctly scoped
        operations.
updated: 2026-08-15
parent: README.md
prev: 3f-fork-chain.md
next: 4-control-layer.md
scope: revised D18
evidence: E20c/d; E22; D18–D20
---

# Phase 1, session 3g — observation, tool descriptions, and the v1 freeze

> **Purpose.** Make tool-choice behavior measurable without reinstating a policy
> engine. Freeze a light v1 description cohort, record what agents actually do,
> and preserve enough raw context to revise the instrument later.

## Prerequisites

- clip-block production mechanics from 3e;
- `copy_track` as ordinary CRUD from step 5 of 3f;
- autonomous layer addressing, creation, filling, switching, winner collapse and
  selective reduction through 3f-i;
- all descriptions mechanically accurate before a version is frozen.

3f-i hands this session six stable device-lifecycle tool identities:
`inspect_device_alternates`, `create_device_alternates`,
`fill_device_alternate`, `switch_device_alternate`,
`keep_device_alternate`, and `remove_device_alternate`. Their privilege classes,
input identities and emitted contract operations are enumerated and guarded in
[3f](3f-fork-chain.md#session-3f-i--complete-2026-08-15-verified-live).

For observation, one successful `create_device_alternates` call is one managed
device-alternate event. Inspect, fill, switch and either reduction operation act
on that event rather than minting another row. `copy_track` remains an ordinary
change outside managed-event bookkeeping. This event boundary and the six tool
identities are inherited mechanics; the description wording and its v1 version
are this session's work.

## Scope

1. A per-project observation record in the document setting already hidden at
   `init()` and proven by E20d.
2. One row per **independent managed alternate event**, not necessarily one row
   per turn. Events share a turn/instruction correlation id when appropriate.
3. A versioned, light tool-description artifact covering layer takes, clip takes,
   track copying, and their correctness preconditions.
4. ⚠⚠ **The cohort-wide `naming.ts` review.** Each 3f production slice owns the
   minimum deliberate exemption or rewritten reason required by the tool it
   ships; this session reviews those accumulated choices as one description
   cohort and declares the version. The guard still asserts tool names, the JSON
   schema an agent receives, and every word the surface emits. `layer` and
   `chain` are candidates to reopen only where the shipped vocabulary requires
   them; `duplicate` was reviewed and kept banned in 3f step 5; `fork`, `branch`
   and `lineage` remain permanent. No entry is silently deleted.
5. Tests proving description version and raw scope survive recording and that
   accepted, vetoed, and silent operator responses remain distinct.
6. Reporting stratified by requested scope and actual structure.

Out of scope:

- a dispatch classifier or automatic choice;
- linking a device alternate and clip alternate into a compound take;
- treating `copy_track` as a branch event;
- reacting to one ordinary anecdote with permanent prescription;
- record retention policy, which remains operator-owned.

## Record shape

Each managed alternate event stores:

| field | purpose |
|---|---|
| turn/instruction id | correlates independent events without linking their lifecycle |
| raw requested/write-set scope | device-only, launcher-clip-only, mixed, or unsupported (arrangement clips, per-alternate sends or track-mixer state, routing, cross-track and project-level state — revised D18b); retain raw data for later analysis |
| actual structure | layer chain, clip block, both as separate rows, track copy, or none |
| result identity | the created project structure by observable identity |
| agent rationale | perishable context, when available |
| operator response | accepted, vetoed, or silent |
| tool-description version | distinguishes behavior changes from wording changes |

Ordinary session change reporting separately records track copies and lets the
experiment correlate their use when they compete with scoped operations. It does
not promote them into managed alternate events.

## Description strategy

Start light, as already planned. Names and descriptions should state scope,
preconditions, costs, destructive seams, and required procedures. They should make
the two managed representations understandable and identify `copy_track` as coarse
track CRUD. Avoid elaborate heuristics until sessions reveal a real failure mode.

The initial review should explicitly watch for, but not limit itself to:

- device-only work copied as a whole track;
- clip-only work attempted in a layer;
- mixed instructions incorrectly represented as one linked take;
- track copying omitted from ordinary change reporting;
- layer collapse attempted through a focus-dependent action;
- names/descriptions causing the right tool to be overlooked.

Revise descriptions when a failure pattern recurs across distinct sessions. Stay
adaptable: the important failure may not be in this list. Safety and correctness
remain different from preference—a single strong controlled result can justify an
immediate ban or containment.

## Exit criteria

1. Device and clip alternate creation each record independent rows, including two
   correlated rows for one mixed instruction.
2. Track copy remains outside managed take bookkeeping while its ordinary change
   and experimental usage are observable.
3. The hidden document setting round-trips the record and survives restart without
   appearing in or degrading the settings pane.
4. v1 descriptions are versioned and the version is stamped into every row.
5. The surface contains no stale grouped-fork or three-way-classifier language, and
   every ban-list entry reopened for v1 carries a rewritten reason rather than a
   deletion.
6. Offline and live end-to-end checks pass with no fixtures left behind.
