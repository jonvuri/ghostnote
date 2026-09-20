---
title: Current state
kind: status
state: active
updated: 2026-09-20
phase: phase-6
session: 6i-workstation-contract-synthesis
---

# Now

Phases 1, 2, and 4 are complete. Phase 3 remains deferred. Phase 5 has an
accepted public result, but its generalized closeout remains. Phase 6 sessions
6a through 6h and 6d2 are complete. Contract synthesis is next. The verification
audit follows it. Phase 7 owns focused module implementation and the next
dogfood loop. Phase 8 owns breadth, release, and probe-runtime retirement.

## Next session

Run [Phase 6i: workstation contract synthesis](plan/phase-6/6i-workstation-contract-synthesis.md).
Inventory every custom interface used at a planned Phase 7 boundary. Define
owners, authority, compatibility, failure isolation, shared fields, and probe
disposition. Select the smallest experimental Phase 7 surface. Do not implement
providers.

Audit `ghostnote-sensory-packet-v0` with the agent context, patch, groove,
reference, audio-fact, and exact-state interfaces. Retain, merge, revise, or
retire each format. Session 6j then closes the verification-cost audit. Phase
7f repeats the interface check during composed dogfood.

## Sensory packets

[E118](evidence/experiments/e118-task-routed-sensory-packets-improve-bounded-decisions.md)
selects task-routed paired evidence. It reached 18 of 18 correct decisions and
10 of 10 safe controls across two models. Raw facts reached 15 of 18 decisions.
Raw identity reached 12 of 18. The routed prompts used less than half the input
tokens of raw facts.

Keep exact note identity for patch targets. Route only the movement, onset,
register, count, loudness, rolloff, crest, or silence field needed for the
declared decision. Include paired deltas and explicit limits. Refuse unmapped
terms such as `compelling` or `presence` unless the task defines them. The
packet schema is experimental and must pass the 6i interface audit.

All six arms produced the same valid patch. A level-matched blind ballot chose
it over the no-change control. The operator judged the difference audible and
musically material. This validates the patch, not an aesthetic difference
between packet arms.

## Reference-conditioned work

[E117](evidence/experiments/e117-extracted-structure-is-the-reference-default.md)
selects extracted musical structure as the default reference form. Add a short
raw excerpt only when the task needs a specific motif, rhythm, or voicing
detail. Keep seed-only context as a creative control. Mixed context won or tied
some operator choices, but it was less reliable and copied more exact events.

Keep exact reference identity, permission, hash, coverage, trait-transfer
scores, and copy measurements. Longer examples, fixed backing, and direct
listening guidance are required for blind creative evaluation. Give model
writers a literal patch shape before the first call.

Notochord 0.8.0 was deterministic under fixed controls, but zero of six outputs
met the exact task contracts. Reject it as a specialist for this direction. The
result is about task fit, not licensing. Do not add it as a product dependency.

## Symbolic representation

[E116](evidence/experiments/e116-fine-timing-and-two-layer-groove-contract-pass.md)
selects `ghostnote-groove-context-v0` for groove-sensitive tasks. It extends
binary timing through `1/512` beat and the matched triplet family through
`1/768` beat. Use the compact E114 bar view for ordinary performed events.

[E114](evidence/experiments/e114-bar-context-and-guarded-note-patches-pass-two-models.md)
selects compact bar context and `ghostnote-note-patch-v0`. The compiler owns
exact state, source and identity guards, pattern expansion, defaults, and
complete candidate-state validation. E115 found no stable cross-model advantage
for MIDI-Like, REMI+, OctupleMIDI, synchronized ABC, or Tidal mini-notation.

The [agent musical language reference](evidence/format/AGENT_MUSICAL_LANGUAGE.md)
defines the experimental mode registry and authority boundaries. These forms
are not public tools. Phase 7a must render context from real exact clip state.

## Provider boundaries

E110 selects Music21 as the primary private semantic-analysis provider and
Musicpy as a voicing specialist candidate. The E109 exact-note layer owns the
input contract, constraints, and exact readback.

No perceptual provider is selected. E113 found that integrated loudness
predicted the derived arousal directions, but the source controls and license
chain did not meet the product gate. E105 selects FFmpeg and a long-lived
librosa worker for typed audio facts and bounded estimates.

E104 selects source-routed SQLite FTS5 for local documentation. Installed API
and localization are exact for Bitwig 6.0.6. E103 proves the project-local
MasterRecorder route when the project directory is known.

## Workstation direction

Keep open-ended musical reasoning in the host agent. Give it compact context,
deterministic evidence, and constrained crafting tools. Keep complete exact
state outside agent output. Compile proposed patches, guard their targets, and
verify them through independent readback.

Build independent modules for deterministic operations and short feedback
loops. Every artifact needs explicit identity, provenance, coverage, and
provider version. Treat Bitwig as one adapter. Use computer use for complex
one-off interaction and recovery. Keep measurements, agent interpretations,
and operator verdicts separate.

## Existing boundaries

[D22](decisions/d22-non-native-plugin-preset-loading-is-out-of-scope.md) closes
non-native preset loading. The extension registers 153 methods, while the
product wire can emit 82. Phase 8b owns classification and retirement of the
remaining probe runtime. Do not remove older probe methods ad hoc.

## Retrospective

Raw fact inventories can make simple comparisons harder and more expensive.
Start from the decision, pair the relevant values, and state the refusal rule.
Do not include available metrics without a declared use.
