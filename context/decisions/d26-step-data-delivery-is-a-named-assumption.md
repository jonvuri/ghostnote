---
id: D26
kind: decision
state: active
source: e216-delivery-coherence
---

# D26 — Complete step-data delivery is a named assumption **[SETTLED 2026-10-02]**

The user accepts one named API assumption for shadow continuity:

> A subscribed step-data observer receives at least one callback for each cell
> whose delivered state changes inside its coverage. This includes changes
> caused by a project switch, a target change, or an edit.

This is the same class of assumption as the accepted callback-completeness rule
for content invalidation. [E216](../evidence/experiments/e216-delivery-coalescing-and-callback-coherence.md)
supports it: step deltas arrived in 35 of 35 same-callback detours. E216 does
not prove it.

## What this decision does not accept

- Identity values are not a continuity witness. Value observers coalesced 21 of
  35 same-callback detours to equal values. Equal names, roots, chain IDs, and
  endpoints still cannot admit or preserve a reference.
- A read inside one callback cannot detect a change by itself. State is
  confined to the callback, and a callback can run in the middle of a delivery
  batch. A guard must confirm in a later callback.
- The decision does not assume an ordering rule for that later callback. A task
  scheduled from a mid-batch callback must run after the rest of the batch.
  [8g2b](../plan/phase-8/8g2b-step-delta-read-window.md) measures this rule
  before any guard depends on it.
- Native input, coordinates outside observer coverage, and other host versions
  are not covered.
- No cache result becomes eligible. 8g5 and 8h keep their gates.

## Consequence

A detour that changes visible content inside coverage produces step callbacks.
A guard that sees them refuses the read. A detour that produces no callback
leaves every covered cell unchanged, so a covered read stays correct. This
replaces the 8g2 requirement for an independent input window, but only for
covered step content under the 8g2b guard.

Revoke this decision if a measurement shows a covered cell change without a
callback, or a published foreign read with an unchanged step count.
