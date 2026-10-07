---
id: D35
kind: decision
state: active
updated: 2026-10-07
source: phase-8h4b2
---

# D35 — Document gain range and release velocity default **[SETTLED 2026-10-07]**

Document 1.0 changes two field rules in [FIELDS.md](../../spec/ghostnote-document-v1/FIELDS.md):

- `expression.gain` is a linear amplitude ratio from 0 through 8, not 0
  through 4.
- The `releaseVelocity` default is `100/127` (`0.7874015748031497` in
  binary64), not 0.5.

The format stays version 1.0. D25 states that 1.0 is the target contract and
is not an external release. The Model format reference is revision 2.

## Why

[E245](../evidence/experiments/e245-document-read-compactness-and-gain.md)
measured the host gain. Raw gain `r` shows `60*log10(r)` dB, so the amplitude
ratio is `r^3`. The host maximum, raw 2, is +18.06 dB, or amplitude 8. The
operator chose to widen the portable range so that a host value above +12.04 dB
(amplitude 4) stays representable. The schema bound is the only change; no
1.0 example uses a gain above 4.

A drawn Bitwig note and a note written through the API have release velocity
exactly `100/127` (E235, E245). With the default 0.5, every host note carried
this value in a `WITH` object. The 8h4b2 plan preferred a binding-level host
default that the projection omits. That rule conflicts with R04: in a snapshot,
an omitted covered field means the portable default. The projection would then
state 0.5 for a note that has `100/127`. The plan's second candidate, a portable
default change, is the lightest rule that keeps exact values.

## Rules

- R04 still states one portable default for each field. A default can equal a
  measured host insertion value; it does not define a host insertion policy.
- A non-default release velocity, for example the MIDI 64 of the 8c corpus,
  stays explicit and exact.
- The authored 8f1 examples and their independent hashes do not change. They
  state release velocity 0.25 and gains of at most 1.

## Consequences

- The schema, its copy, FIELDS, the R04 text, the Model format reference, its
  identity file, the selected prompts, and the measurement JSON change.
- The `read_launcher_clip` description carries the Core section, so the tool
  description version is v27.
- 8h4c writes `cbrt(portable)` as raw gain through the E24 setter scale. The
  [host binding](../../spec/ghostnote-document-v1/HOST-BINDING.md) states the
  rules for raw 0 and portable 0.
