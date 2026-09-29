---
title: Current state
kind: status
state: active
updated: 2026-09-29
phase: phase-8-agent-native-live-engine
session: phase8c4e-v19-adaptive-complete
---

# Now

[The Phase 8c4e full benchmark](plan/phase-8/8c4e-compact-only-full-benchmark.md)
is complete.
[E196](evidence/experiments/e196-v19-adaptive-component-assessment-is-matrix-plausible.md)
records the component-focused `matrix-plausible` result.

OpenAI and Gemini completed 148/148 messages each. Claude scored 130 messages
across eight families. Its analysis prompts exhausted their response limits,
and two melody responses were unavailable. Every measured cell passes its
component gate. Claude analysis remains an explicit gap.

A sampled audit found that analysis chord content was transposed without its
key. The corrected assessment excludes the invalid function component and
retains the other seven analysis components. It also aligns revoice notes
within each onset, avoids coupled field errors, requires the expected note
count, and ignores undisclosed output IDs. No provider rerun was necessary.

Updated component accuracy is 97.4128 and 94.9158 percent for OpenAI, 98.2551
and 98.3454 percent for Gemini, and 97.7728 and 96.0229 percent for Claude.
Each pair lists `FIELDS` first and local labels second. Canonical form,
structural parse, and case accuracy remain diagnostics, not separate gates.

Known cost is USD 2.838976250. Maximum exposure is USD 3.102976250 after a
conservative reservation for two unretained Claude recovery requests.

## Immediate work

1. Use the corrected adaptive assessment as the Phase 8c4e product result.
2. Do not rerun v19 or recover Claude analysis on this cohort.
3. In Phase 8c4f, decide whether to run a fresh matrix or select a direction
   from the current evidence limit.
4. Keep `FIELDS` as the leading compact candidate. It is smaller and at least
   as accurate in aggregate.
5. Do not change the cache, `normal-v1`, or a live Bitwig project.

Phase 8f remains blocked pending the completed Phase 8c4e result and the Phase
8c4f operator decision.

## Retrospective

Keep fixtures, responses, scoring, diagnostics, and policy modular. Replace
only the invalid layer. Refresh parameters and prompts only for new provider
work that needs fresh tasks.

Restore the analysis reference-contract assertion in the next generator. A
freshness transform must update each dependent musical field.
