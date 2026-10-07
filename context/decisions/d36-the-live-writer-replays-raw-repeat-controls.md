---
id: D36
kind: decision
state: active
updated: 2026-10-07
source: phase-8h4c
---

# D36 — The live writer replays raw repeat controls **[SETTLED 2026-10-07]**

The host binding said: refuse a full replay of a note until 8h has a repeat
converter. The 8f3 binding assessor therefore refused every reconstruction and
every removal for `repeat`. 8h4c narrows that rule for the live edit limb.

## Rule

- `edit_launcher_clip` builds each changed, moved, or removed note from its
  fresh raw host state. A reconstruction writes the raw repeat controls of the
  note exactly; a removal reverses by the same raw note. No portable repeat
  value is converted.
- A proposal that changes portable `repeat` still refuses (`unsupported`,
  reason `repeat`). Portable repeat stays uncovered on a read.
- Pressure refusals do not change here; [D37](d37-note-pressure-is-a-blind-host-limit.md)
  records that a live read never sees pressure.
- The pure assessor keeps the old refusal when it has no raw state. The live
  writer passes `rawReplay` (binding corpus case B18).

## Why

The raw repeat fields are `exact` in `NOTE_PROP_FIDELITY` (E2).
[E230](../evidence/experiments/e230-cold-reader-promotion.md) replayed disabled
repeat controls with count -2 and nondefault curves through a whole-clip
reconstruction, and an independent raw read matched every field. The refusal
protected against a portable-to-host conversion, which a raw replay does not
need. Without this rule, no pitch, channel, or onset edit and no removal could
apply, and the 8h4c acceptance matrix could not pass.

## Consequences

- HOST-BINDING "Neutral enable flags" and the repeat paragraph state the raw
  replay rule. The binding corpus README has B18.
- [E236](../evidence/experiments/e236-document-edit-limb.md) verifies moved
  and removed notes live. The fake-adapter tests cover a moved note with
  nondefault raw repeat controls.
