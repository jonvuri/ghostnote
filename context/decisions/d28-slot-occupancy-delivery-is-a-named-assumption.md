---
id: D28
kind: decision
state: active
source: e222-slot-delivery
---

# D28 — Complete slot-occupancy delivery is a named assumption **[SETTLED 2026-10-03]**

The user accepts a third named API assumption for shadow continuity:

> A subscribed `hasContent` observer receives at least one callback for each
> slot whose delivered occupancy changes inside its coverage. This includes a
> project switch, a scene or track change, and an edit. A change that returns to
> equal occupancy inside one host update may deliver no callback. Equal
> occupancy is never a clip identity witness.

[E222](../evidence/experiments/e222-slot-delivery-and-occupancy-window.md)
supports it. It found zero missed deliveries in 153 recorder runs and 14
native or API controls. It also found zero foreign slots in 50 cache detours.
E222 does not prove the assumption.

## Consequence

With [D27](d27-later-callback-ordering-is-a-named-assumption.md), a confirmed
slot-delta window closes the occupancy continuity predicate for covered slots.
8g5 can evaluate live slot inventory as passed inside the measured coverage:
16 flat tracks, 128 scenes, and the `ALL_CHANNELS` flat bank. Group tracks'
own slots are not clips.

## What this decision does not accept

- Clip identity. E222 measured silent delete and recreate, and silent project
  switches with equal occupancy. Each rebuild mints new references. Equal
  occupancy cannot preserve or admit a reference.
- Coverage beyond the measured scope, and other host versions.
- Slot reads without a confirmed window. Any slot or structure callback in the
  window refuses.
- No cache result becomes eligible. The 8g5 gate still applies.

Revoke this decision if a measurement shows an occupancy change without a
callback, or a published list with a foreign slot while its window confirms.
