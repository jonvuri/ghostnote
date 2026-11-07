---
id: D56
kind: decision
state: active
updated: 2026-10-29
source: R02
---

# D56 — Pressure refusal is a verification limit

[E370](../evidence/experiments/e370-pressure-getter-blindness-live.md) corrects
D37's premise that the pressure setter cannot affect the clip. On Bitwig 6.1.4,
the inspector shows the requested pressure after reselection and cursor
retargeting, while independent API reads return zero. A zero read does not
prove that pressure is absent or that a setter failed.

Retain D37's product behavior: reject requested nonzero pressure, report zero
on acquisition with the existing named ambiguity, preserve untouched notes
on targeted edits, and warn `pressure-unobservable` on whole-clip rewrites.
Ghostnote still has no independent API verification for pressure, as D15
requires. An inspector observation in research is not a runtime verification
route. D55's trusted-route rule does not turn a known-blind read into evidence.

The internal `unwritable` fidelity label means unavailable for Ghostnote writes,
not that the host setter is inert. Current explanations must state that
verification is unavailable. Keep historical E/D records, probe source and
frozen legacy descriptions as history. R02 changes the rationale and current
description wording, not write admission or recovery behavior. Saved-file
persistence and playback output remain untested in this reproduction.
