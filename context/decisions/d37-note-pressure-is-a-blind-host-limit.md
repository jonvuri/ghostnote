---
id: D37
kind: decision
state: active
updated: 2026-10-07
source: phase-8h4c
---

# D37 — Note pressure is a blind host limit **[SETTLED 2026-10-07]**

Bitwig reports note pressure as 0 through every API route, also when a person
set it in the inspector ([E236](../evidence/experiments/e236-document-edit-limb.md)).
E15-E showed that the API cannot write it. Ghostnote can therefore neither see
nor protect pressure.

## Rule

- A read states pressure 0. The `read_launcher_clip` description says so.
  `expression` stays covered; the gain -inf case is the same kind of named
  ambiguity.
- Writes are not blocked. A targeted edit leaves untouched notes, and their
  pressure, intact. A whole-clip rewrite loses pressure that a person set; its
  result has warning `pressure-unobservable`.
- A document that sets a nonzero pressure still refuses: the host cannot write
  it.
- The pressure refusals of the planner and the D16c strip-and-report path stay
  as defensive checks. A live read does not reach them.

## Why

The operator chose this default: pressure is uncommon, and a whole-clip loss
is acceptable when the result names it. Marking `expression` uncovered would
hide gain, pan, timbre, and transpose, which the host reports exactly.

## Consequences

- This amends D16c: "readback captures it" is false for human pressure. The
  stable `erase_notes` description claims a pressure refusal that cannot
  trigger; 8h4d retires that tool from `agent-native-v1`, and `stable-v1` keeps
  its frozen wording.
- HOST-BINDING, the edit description (v28), and E15 record the limit.
