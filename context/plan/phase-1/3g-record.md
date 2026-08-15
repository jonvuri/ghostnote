---
title: Phase 1, session 3g — observation, tool descriptions, and the v1 freeze
kind: plan
state: planned
status: REVISED 2026-08-14. Runs after `copy_track` and the layer-chain lifecycle.
        The old three-way dispatch classifier is retired. This session records
        independent managed alternate events and observes whether naming and
        descriptions lead agents toward correctly scoped operations.
updated: 2026-08-14
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
- autonomous layer addressing, creation, switching, and directed lifecycle from
  step 6 of 3f;
- all descriptions mechanically accurate before a version is frozen.

## Scope

1. A per-project observation record in the document setting already hidden at
   `init()` and proven by E20d.
2. One row per **independent managed alternate event**, not necessarily one row
   per turn. Events share a turn/instruction correlation id when appropriate.
3. A versioned, light tool-description artifact covering layer takes, clip takes,
   track copying, and their correctness preconditions.
4. ⚠⚠ **The `naming.ts` ban-list review.** The vocabulary this session freezes
   already exists — 3d wrote `brain/src/surface/` under the ban list and the guard
   asserts it against tool names, the JSON schema an agent receives, and every
   word the surface emits. That list is where the mechanisms are banned BY NAME,
   and revised D18e changed what may be said: `layer`, `chain` and `duplicate` are
   marked relaxation candidates there, while `fork`, `branch` and `lineage` are
   permanent. Reopen entries **deliberately and one at a time**, with the reason
   rewritten in place — the guard is what makes that a reviewable act instead of a
   sentence nobody noticed. This session amends the naming pass and declares the
   version; it does not start one.
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
