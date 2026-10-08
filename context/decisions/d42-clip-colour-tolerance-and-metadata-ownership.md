---
id: D42
kind: decision
state: active
updated: 2026-10-08
source: phase-8i0
---

# D42 — A clip property write owns only its changed fields, and a written colour is verified within one byte **[SETTLED 2026-10-08]**

The E83 palette rule made each clip property change depend on the clip
colour, because the writer sent the complete metadata. In the first 8i
dogfood trial, a length change of a copied clip refused for its colour.
[E249](../evidence/experiments/e249-clip-metadata-and-colour-tolerance.md)
measured the replacement.

## Rule

- A `clip.update` names the fields that it writes. The planner gives the
  changed fields and their marker dependencies: a length or loop-start change
  also owns loop end and play start, and a loop-start change also writes the
  length (E43). A name, colour, or loop-state change owns no marker. The
  setters go in one frame.
- Only the owned fields are verified, recorded for reversal, compared at the
  reversal boundary, and restored. A later change to an unowned field stays.
  A later change to an owned field blocks the reversal, as before.
- A complete write (no field list) owns every field. Restoring a deleted clip
  and `stable-v1` use it.
- Any integer RGB triple in 0..255 is accepted. A table colour sends its
  measured E83 wire bytes; any other colour sends its own bytes, once. The
  write is verified when each component is within one byte. A larger
  difference is a readback difference. It is not retried.
- The tolerance belongs only to the verification of a colour write. The
  stored state, snapshot hashes, identity, and boundary checks use the
  observed bytes exactly. A person's one-byte change is not hidden. The one
  exception: a boundary accepts a colour when the latest later change of ours
  that wrote the colour restored exactly the colour this change left, the
  host stored it within one byte, and the colour now equals that readback.
  The other owned fields must equal this change's readback; unowned fields
  are not compared.
- Several entries for one clip in one call apply in order as one write, and
  are verified as one result.
- Bitwig makes a colour below about CIE L* 33 lighter (E249: black reads
  back `[81,81,81]`). Such a request is applied and reported as a
  difference.

## Consequences

- No musical edit depends on palette membership. The palette table remains
  as an encoding of known colours and for the frozen `stable-v1` tools.
- A colour restore can land one byte off its recorded value. A reversal
  writes the recorded prior value, so the error does not accumulate in one
  chain of reversals.
- The E83 exact-palette rule is retired for `agent-native-v1`; E83 keeps its
  measurements.
