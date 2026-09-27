---
title: Current state
kind: status
state: active
updated: 2026-09-27
phase: phase-8-agent-native-live-engine
session: phase8c2-3-compact-json-factorial-and-native-decision
---

# Now

Continue
[Phase 8c2.3](plan/phase-8/8c2-3-compact-json-factorial-and-native-decision.md).
Prototype the five arms offline. No provider run is approved.

## Starting point

[Phase 8c2.2](plan/phase-8/8c2-2-measurement-repair-and-grouped-compact-iteration.md)
is complete. [E146](evidence/experiments/e146-grouped-development-stops-before-claude.md)
records the accepted `stop-custom-compact` closeout. OpenAI and Gemini made
the frozen improvement gate unreachable. Claude did not run, the approval
record is closed, and the incomplete run has no formal three-provider summary.
Do not repair or resume it.

This closes incremental compact-bar text development. It does not prove that
all representations more compact than exact JSON must fail. [E142](evidence/experiments/e142-label-only-compact-fails-targeted-holdout.md)
and all frozen v0 through v3 artifacts remain unchanged.

## Settled comparison

Use one fresh cohort for five isolated arms:

1. `exact-object-json-midi`;
2. `exact-object-json-pc-register`;
3. `tuple-json-midi`;
4. `tuple-json-pc-register`; and
5. `midi-like-native`.

The first four arms form a 2×2 JSON factorial. Use named collections of fixed
tuples, not one heterogeneous tagged array. Each arm has one pitch value only.
Pitch-class/register uses `[pitch_class, octave]` and
`midi = 12 * (octave + 1) + pitch_class`.

Run native MIDI-like concurrently to keep fixtures, providers, and time paired.
Keep it outside the factorial. Compare it with JSON only on common musical,
size, token, and latency metrics. Report identity, exact preservation, sparse
editing, and conflict handling in a separate capability table.

## Experimental boundary

Create fresh and disjoint calibration, development, and holdout cohorts. Do
not reuse a Phase 8c1, 8c2, or 8c2.2 provider fixture. Calibration is diagnostic
and cannot select a format. Recheck progression and revoicing for floor and
ceiling effects before development.

Before each provider-bearing run, freeze the arms, fixtures, prompts, scorers,
models, settings, call counts, cost estimates, hashes, and stopping rule. Get
explicit operator approval for that exact run. Approval for one run does not
approve the next run.

Phase 8c3 and Phase 8f remain blocked. Do not change the cache, the stable
`normal-v1` runtime, or a live Bitwig project.

## Immediate work

1. Create a new versioned benchmark package beside `compact-format-v3`.
2. Implement the four JSON renderers, parsers, schemas, and patch forms. Add
   the native comparison adapter.
3. Test MIDI bounds, pitch-class/register conversion, round trips, identity,
   preservation, sparse patches, invalid tuples, metadata, and every prompt
   grammar form.
4. Create fresh cohort manifests and prove that they do not overlap prior or
   current cohorts. Calibrate task difficulty offline where possible.
5. Freeze one named calibration plan with exact call and cost estimates. Stop
   and request approval before its provider calls.

## Retrospective

One concurrent native anchor improves pairing and avoids a second provider
run. Keeping it outside the factorial prevents unlike capability sets from
distorting the JSON effects. Require one explicit prompt template and example
for every permitted grammar form.
