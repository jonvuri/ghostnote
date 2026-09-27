---
title: Current state
kind: status
state: active
updated: 2026-09-27
phase: phase-8-agent-native-live-engine
session: phase8c3-full-symbolic-format-matrix
---

# Now

Continue
[Phase 8c3](plan/phase-8/8c3-full-symbolic-format-matrix.md). Phase 8c2.3 is
complete. No Phase 8c3 provider run is planned or approved.

## Starting point

[E152](evidence/experiments/e152-tuple-json-midi-passes-targeted-holdout.md)
records the completed 180-call targeted holdout. It returned
`select-for-phase8c3`. The recorded cost is USD 4.173729, which is USD
0.290905 below the estimate. No call had a transport error, retry, or
output-limit stop.

Tuple JSON with MIDI integers passed on OpenAI and Claude. Exact-object
pitch-class/register passed only on Gemini and is rejected. Exact-object MIDI
remains the full-capability fallback. Native MIDI-like did not enter holdout.

The selected tuple representation keeps full document fidelity, stable
identity, exact omitted-field preservation, sparse patches, base conflict
checks, and one canonical MIDI pitch encoding. Do not revise it from holdout
responses.

## Immediate work

1. Build a fresh Phase 8c3 retained cohort with no overlap with prior
   provider-bearing fixtures.
2. Add unchanged tuple JSON with MIDI integers to the full comparison matrix.
3. Freeze the sample rule, paired decision rule, syntax and capability gates,
   provider scope, settings, cost estimate, and stopping rule.
4. Run all deterministic checks before requesting provider approval.
5. Make no provider call until the exact Phase 8c3 plan is approved.

Phase 8f remains blocked. Do not change the cache, the stable `normal-v1`
runtime, or a live Bitwig project.

## Retrospective

The two-provider gate rejected a strong pitch result that appeared only on
Gemini. The higher Claude token limit removed the development truncations.
