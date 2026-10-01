---
title: Compact-bar limitations and publication gaps
kind: reference
state: active
updated: 2026-10-01
parent: COMPACT_BAR_RATIONALE.md
---

# Compact-bar limitations and publication gaps

[D25](../../decisions/d25-fields-json-document-format-and-publication.md)
selects FIELDS and JSON and opens the version 1.0 work in
[Phase 8f](../../plan/phase-8/8f-consolidated-compact-bar-and-cache-contracts.md).
The historical exact-JSON complete-state claims below concern earlier arms.
The fresh matrix JSON arm omits the same five fields as compact. Phase 8f1
will settle the product coverage.

The
[symbolic benchmark design backlog](SYMBOLIC_BENCHMARK_DESIGN_BACKLOG.md)
tracks measurement and experiment-design limits separately from product-format
limits.

## Identity

Opaque event IDs are Ghostnote edit handles. They are not ABC, Alda, MIDI, or
Bitwig note identities. The current benchmark gives IDs to every finite-edit
arm. ABC and Alda receive them in counted side ledgers. The model-token arms
receive them as task extensions.

Bitwig does not supply durable note identity. A future public format must state
when Ghostnote retains, remints, or invalidates an event ID after a human edit,
clip move, project restart, or ambiguous match.

## Timing

The benchmark uses exact rational times. This tests reading and patch behavior.
It does not select the future live acquisition boundary.
[D23](../../decisions/d23-normalized-clip-acquisition-uses-one-1-512-view.md)
accepts one `1/512`-beat identity plane for the consolidated live route. The
public contract must state its rounding and multiplicity loss.

ABC and Alda can express rich musical rhythm. Their benchmark score views do
not carry every performed time in the fixture. The exact side ledger supplies
that task data. The model-token profiles also use exact rational extensions
instead of their original quantized vocabularies.

## Fields and defaults

The compact profile represents ID, track, rational start and duration, pitch,
velocity, meter, harmony, role, and region. It omits channel, mute, release
velocity, articulation, and note expression. Exact JSON retains them.

The patch compiler preserves omitted fields on existing notes. It uses the
named `track-neutral-v0` policy for insertions. A later public format must not
inherit these benchmark defaults without a separate contract decision.

Pressure is observable but is not writable through the measured host path.
Played-range incompatibility also stays a host boundary. Text syntax cannot
make an inaccessible live coordinate writable.

## Pattern semantics

Strudel and Tidal patterns can be cyclic, nested, probabilistic, and
transformational. A finite note list with stable edit IDs has different
semantics. The benchmark therefore gives Strudel a native expansion task and no
Ghostnote round-trip score.

Adding an exact event ledger to the Strudel task would duplicate the finite
score. It would test the ledger, not the pattern language.

## Token cost

Bytes are deterministic. Tokens depend on the provider tokenizer and the whole
prompt. Phase 8c counts representation text, grammar, patch examples, task
text, and exact side ledgers. It does not claim one token count for all models.

The current compact prompt is 56.0% smaller than exact JSON on GPT input tokens
and 52.8% smaller on Gemini input tokens. This result applies only to the fixed
cohort and prompt.

In the expanded v1 run, compact used 21% to 26% fewer paired input tokens than
exact JSON and about 70% fewer output bytes. The v1 compact arm used an
unlabeled shorthand instead of the v0 labeled events and structural headers.
Recheck these results for each candidate that reaches the fresh full matrix.

## Expanded task result

Compact v1 stayed inside the 12.5 percentage-point paired rate margin for every
eligible comparator. It still failed the separate repeated-loss rule. OpenAI,
Gemini, and Claude each had at least one task family with repeated
compact-only losses.

This does not show a general parser failure. Compact syntax passed every
retained OpenAI and Claude call and 41 of 43 retained Gemini calls. The failed
rows were musical constraints. [E140](../experiments/e140-expanded-symbolic-format-comparison-requires-revision.md)
separates these failures from syntax, native identity limits, side-ledger
alignment, and provider variation.

## Round-trip editing

The finite arms round-trip only their declared represented core. Exact JSON is
the only complete-state arm. A valid model patch is not direct authority to
write a live project. The compiler and fresh live guards remain separate.

The benchmark compiler accepted all 14 initial patch constraints for each
provider across compact-bar and every finite prior-art arm. Every one of the 14
repair calls also produced the exact requested move. These results validate the
patch boundary, not full-format interchange.

## Required changes before a public specification

The operator has reviewed the completed benchmark sequence and selected the
direction in D25. Phase 8f must complete this list through its specification,
codec, and host-binding sessions:

1. Define one model with a FIELDS grammar, JSON schema, and canonical serializers.
2. Apply the D23 `1/512` identity and loss rules to live normalized state.
3. Define complete-document and sparse-patch forms in one language.
4. Define every field, unit, default, omission, and preservation rule.
5. Define clip and event identity across edits, moves, compaction, and restart.
6. Define conflict handling against fresh live state.
7. Define parser limits, error locality, and invalid examples.
8. Add a conformance corpus for every normative rule.
9. Recheck byte and provider-token targets on the selected syntax.
10. Keep the internal project cache outside the public music document.

[Phase 9b](../../plan/phase-9/9b-compact-bar-publication-review.md) reviews
sources, fixture rights, versioning, compatibility, and the complete public
package after 8i accepts its live use. Phase 8 prepares artifacts for that review.
