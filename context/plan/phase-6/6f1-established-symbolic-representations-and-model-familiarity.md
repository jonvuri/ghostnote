---
title: Phase 6f1 — Established symbolic representations and model familiarity
kind: plan
state: planned
status: Run after 6f. Select representation finalists before the groove study.
updated: 2026-09-13
parent: README.md
prev: 6f-agent-facing-symbolic-representation.md
next: 6f2-groove-intent-and-microtiming-reproducibility.md
---

# Phase 6f1 — Established symbolic representations and model familiarity

## Purpose

Test whether established symbolic music representations give frontier text
models a measurable advantage over the custom E114 bar form. Separate prior
format familiarity from grammar quality. Keep exact host state and guarded
patch compilation outside the model.

The result must also preserve musical usefulness. Test complex harmony,
performance timing, transformation of existing material, and continuation. Do
not select a representation only because it parses well or uses few tokens.

## Starting facts

- [E114](../../evidence/experiments/e114-bar-context-and-guarded-note-patches-pass-two-models.md)
  selects custom rational bar events as the current baseline. It did not isolate
  model familiarity with established formats.
- E114 tested a custom pattern language. It did not test TidalCycles.
- [REMI](https://arxiv.org/abs/2002.00212) adds explicit bar, position, tempo,
  chord, duration, pitch, and velocity events to a MIDI-derived token stream.
- [MusicBERT](https://arxiv.org/abs/2106.05630) uses OctupleMIDI compound events
  with time signature, tempo, bar, position, instrument, pitch, duration, and
  velocity attributes.
- [Compound Word Transformer](https://arxiv.org/abs/2101.02402) groups related
  musical attributes to reduce sequence length.
- [MuPT](https://arxiv.org/abs/2404.06393) uses synchronized multi-track ABC.
  This is evidence for music-specific training, not proof of frontier-model
  training data.
- [TidalCycles](https://tidalcycles.org/docs/reference/mini_notation/) provides
  a compact pattern language for subdivision, layering, repetition, polymeter,
  and Euclidean rhythm. Its evaluated pattern is not a finite exact note ledger.

Provider documentation does not disclose enough corpus detail to rank these
formats by training frequency. Treat familiarity as a behavioral hypothesis.
Do not claim that a result proves that a format was in a model's training data.

## Representation arms

Use the E114 bar form as the baseline. Screen these established families with
deterministic converters before model calls:

1. MIDI-Like note-on, note-off, velocity, and time-shift events.
2. REMI or REMI+ bar and position events.
3. One compound event form: CP or OctupleMIDI.
4. TidalCycles mini-notation with a bounded, deterministic subset.
5. Synchronized multi-track ABC as the notation control.

Do not widen the retained model cohort without a measured reason. Reject an arm
before model calls when it cannot represent identities, exact rational timing,
polyphony, meter, roles, or the required harmonic fields without an explicit
side plane.

## Familiarity controls

For each retained arm, compare:

- the published syntax with only task-specific field definitions;
- an isomorphic syntax with neutral renamed tokens;
- both forms with the same bounded grammar and examples; and
- a no-music control that checks whether labels alone drive the answer.

Use identical canonical source states and semantic tasks. Record tokenizer
fragmentation, prompt tokens, parse failures, repair turns, and exact errors.
Call an advantage prior-familiarity-consistent only when the published syntax
beats its isomorphic control before examples and the gap narrows after equal
grammar instruction.

## Musical cohort and tasks

Use generated, operator-owned, public-domain, or permissively licensed
material. Include:

- multi-track monophony and polyphony;
- binary, triplet, swung, and offset timing;
- meter changes and aligned parts;
- extended and altered harmony, chromatic voice leading, modulation, and
  non-tertian voicings;
- repeated motifs, sections, articulation, velocity, and overlaps; and
- short, medium, and long contexts.

Ask each arm to:

1. Answer exact structural, harmonic, and rhythmic questions.
2. Reconstruct all represented fields without a musical change.
3. Transform existing notes while preserving named timing, identity, harmony,
   and voice-leading constraints.
4. Transfer one rhythm or harmonic structure into new material.
5. Continue a multi-track seed under explicit harmonic and groove constraints.
6. Repair one invalid proposal after exact compiler feedback.

Use the same guarded JSON patch boundary for every arm. A representation can
propose a better context plane without becoming the write format.

## Measurements

- zero-shot and grammar-supplied task accuracy;
- published-versus-renamed syntax delta;
- exact field and note-identity preservation;
- harmonic, rhythmic, polyphonic, and metrical constraint satisfaction;
- continuation validity and blind operator preference;
- token fragmentation and tokens per note and bar;
- parser, patch, compiler, and repair success;
- latency, tool calls, and failure behavior; and
- deterministic conversion and reconstruction hashes.

Keep objective results, model explanations, and operator judgments separate.

## Acceptance criteria

- All retained arms use the same canonical states, tasks, model settings, and
  patch compiler.
- Familiarity claims use published-versus-isomorphic controls. They do not infer
  private training corpus membership.
- At least one task requires harmonic complexity, one requires transformation
  of existing input, and one requires continuation.
- Groove-related inputs keep exact performed timing. No context renderer silently
  quantizes them.
- Every lost or defaulted field is explicit.
- The result selects one or two context finalists for 6f2 and 6g, or records a
  precise blocker.
- The guarded exact patch and host-state boundaries remain unless evidence
  disproves them.
- The result is confirmed across two frontier text models, or the model-specific
  limit is explicit.
- No model output becomes a live Bitwig write.
- No retained third-party composition, model cache, or generated test artifact
  remains.

## Out of scope

- Proving private model-training corpus contents.
- Training or fine-tuning a music model.
- Selecting a production generation model.
- Replacing exact host readback with a token parser.
- A complete aesthetic ranking of groove. Session 6f2 owns that work.

## Retrospective target

Record which control best separates a useful musical grammar from apparent
model familiarity.
