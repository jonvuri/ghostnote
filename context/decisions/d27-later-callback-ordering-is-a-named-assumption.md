---
id: D27
kind: decision
state: active
source: e217-later-callback-ordering
---

# D27 — Later-callback ordering is a named assumption **[SETTLED 2026-10-03]**

The user accepts a second named API assumption for shadow continuity:

> A zero-delay task that a controller callback schedules with
> `host.scheduleTask` runs after the remainder of the delivery batch that
> contains that callback.

[E217](../evidence/experiments/e217-later-callback-ordering-rule.md) supports
it: 94 of 94 mid-batch confirmations ran after their batch, including 16 that
bridge RPC callbacks scheduled. E217 does not prove it. The host does not
expose batch boundaries; E217 infers them from time gaps.

This decision and [D26](d26-step-data-delivery-is-a-named-assumption.md) are
the two assumptions for the
[8g2b step-delta window](../plan/phase-8/8g2b-step-delta-read-window.md).
[E218](../evidence/experiments/e218-step-delta-read-window-live-acceptance.md)
found no violation in 147 live trials.

## What this decision does not accept

- Native input and other host versions are not covered. E217 used
  controller-issued project actions.
- A confirmation that runs before its batch ends is not covered. A guard must
  still refuse on any changed step count.
- Slot inventory, group topology, and other value observers are not covered.
  Each needs its own measured rule.
- No cache result becomes eligible. The 8g5 gate still applies.

## Consequence

With D26, a confirmed step-delta window closes the covered step-content
continuity predicate. 8g5 can evaluate that predicate as passed for covered
clip content. It cannot use this decision for slot occupancy or topology.

Revoke this decision if a confirmation runs before the last step callback of
its batch, or if a published read contains foreign content while the window
confirms.
