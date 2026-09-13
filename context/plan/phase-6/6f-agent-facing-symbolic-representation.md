---
title: Phase 6f — Agent-facing symbolic representation
kind: plan
state: complete
status: Complete. E114 selects bar context and guarded JSON patches.
updated: 2026-09-13
parent: README.md
prev: 6d2-perceptual-listener-agreement-evaluation.md
next: 6f1-established-symbolic-representations-and-model-familiarity.md
---

# Phase 6f — Agent-facing symbolic representation

## Purpose

Determine how a frontier text agent should read and edit time-precise symbolic
music. Keep exact project state outside the reasoning model. Let the agent work
through compact musical views and checked edit proposals.

This session tests representation and round-trip behavior. It does not select a
music-generation model or judge musical quality.

## Starting facts

- [E109](../../evidence/experiments/e109-exact-note-structure-is-the-semantic-boundary.md)
  gave one text agent exact note objects for a closed-label analysis task. It did
  not test continuation, generation, or alternative representations.
- E109 also proves that a write must start from complete host-normalized note
  state and end with exact readback.
- [E110](../../evidence/experiments/e110-wider-symbolic-provider-survey-selects-music21-and-musicpy.md)
  selects theory and voicing helpers. It does not select a creative reasoner.
- [ChatMusician](https://arxiv.org/abs/2402.16153) and
  [MuPT](https://arxiv.org/abs/2404.06393) show that ABC-derived text can support
  music-specific language models. MuPT adds synchronized multi-track ABC to keep
  measures aligned across tracks.
- [ABC-Eval](https://arxiv.org/abs/2509.23350) and
  [LilyBench](https://arxiv.org/abs/2606.08722) show that valid symbolic output
  does not by itself prove structural understanding.

## Hypothesis

A two-plane contract will outperform full-score rewriting:

1. A context plane shows bars, voices, roles, motifs, harmony, repetition, and
   relative musical relationships.
2. An exact plane keeps note identities, complete timing, velocity, expression,
   source identity, and host-normalized state.
3. The agent emits a small patch against note identities or musical regions.
4. A deterministic compiler expands the request and rejects invalid or lossy
   edits before any Bitwig write.

## Representation arms

Compare these arms on the same source material and tasks:

1. Canonical Ghostnote note objects as the exact control.
2. A compact bar-synchronized event form with rational beat positions.
3. ABC 2.1 or a bounded synchronized multi-track ABC profile.
4. A code-like pattern and patch language with explicit regions, identities,
   constraints, and preservation rules.

Use MusicXML or LilyPond only as one bounded negative or code-oriented control
when it answers a question the four primary arms do not. Do not widen the
session into a notation-format survey.

## Cohort

Use controlled, generated, or operator-owned clips. Include:

- monophonic and polyphonic material;
- aligned multi-track parts;
- binary and triplet positions;
- off-grid timing and overlapping notes;
- repeated motifs and section boundaries;
- velocity, channel, mute, release, and note-expression fields; and
- short, medium, and long token contexts.

Each fixture needs a canonical exact-note identity and declared coverage. Do
not place unlicensed third-party compositions in the repository.

## Tasks

1. Parse the representation and answer exact structural questions.
2. Reconstruct the represented notes without a musical change.
3. Apply local edits such as transpose, repeat, delete, insert, and move.
4. Apply semantic edits such as preserve rhythm while changing harmony, reuse a
   motif in another register, or reduce density in one region.
5. Generate a bounded continuation from a short seed.
6. Repair one deliberately invalid response after receiving exact validation
   errors.

Run the same prompts and declared model settings across all arms. Use fresh host
agent sessions for the host-agent proof. Keep any direct API repeat as a
separate control. Screen all arms with the primary host model. Confirm the
finalists with a second available frontier text model when access permits. If no
second model is available, record that the result is model-specific. Record the
exact client, model, reasoning effort, prompt, token use, latency, and output.

## Measurements

- parse and schema-validation rate;
- exact no-change round-trip rate;
- preserved note and region identities;
- timing, polyphony, and expression loss;
- constraint satisfaction before and after deterministic compilation;
- prompt and response tokens per represented note and bar;
- repair turns and total tool calls;
- latency and failure behavior; and
- behavior as note count, track count, and musical length increase.

## Acceptance criteria

- All representation arms use the same canonical source states and task set.
- Exact reconstruction failures identify the lost or changed fields.
- A semantic edit never claims to preserve a field that the representation
  omitted.
- The result selects one agent context form and one exact patch form, or records
  a precise blocker.
- The selection is confirmed across two frontier text models, or its
  model-specific limit is explicit.
- The selected design keeps complete exact state outside the agent response and
  supports deterministic validation before a write.
- The result states where quantization, pattern expansion, or defaulting occurs.
- No model output becomes a live Bitwig write in this session.
- Generated files, model caches, and test artifacts are removed after the run.

## Out of scope

- Selecting Notochord or another generation model.
- A public symbolic-analysis or generation tool.
- Aesthetic ranking of continuations.
- Training or fine-tuning a model.
- Replacing exact note readback with a notation parser.

## Retrospective target

Record which separation between musical context and exact state prevented the
most round-trip loss.

## Result

[E114](../../evidence/experiments/e114-bar-context-and-guarded-note-patches-pass-two-models.md)
selects compact bar-synchronized events for musical context. It selects
`ghostnote-note-patch-v0` for guarded edit requests. The host keeps complete
exact state and expands each request before an adapter write.

The selected arm passed all 20 compiler constraints across GPT-5.4 Mini and
Gemini 3.8 Flash. It used 51% to 56% fewer input tokens than exact JSON. ABC
could not ground edits against opaque note identities. The pattern arm failed
one strict default-policy check. All eight invalid patches were repaired in one
turn after exact validation errors.

The direct API result is cross-model, but it is not a fresh host-agent session
proof. Phase 7 must test the contract through the real host surface. No output
was written to Bitwig.
