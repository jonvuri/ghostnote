---
title: Phase 8c — Compact-bar prior art and reproducible benchmark
kind: plan
state: planned
status: Review existing evidence and build the durable comparison package before the consolidated contract is frozen.
updated: 2026-09-25
parent: README.md
prev: 8b-runtime-and-surface-cleanup.md
next: 8d-cache-identity-and-lifecycle.md
evidence: E109, E114-E121, E129; D21, D23
---

# Phase 8c — Compact-bar prior art and reproducible benchmark

## Purpose

Prepare compact-bar for a later public specification. Turn the E114 and E115
comparison into durable rationale, fair prior-art documentation, and a roughly
reproducible task suite.

Do not select a format only because a model might have seen it during training.
Measure task fit, represented meaning, agent performance, token cost, and edit
behavior. Do not claim knowledge of private training corpora.

## Comparison families

Review a bounded representative set:

- compact-bar as the project baseline;
- exact JSON or event lists as the complete control;
- ABC and, if the deterministic screen passes, LilyPond as score notation;
- Tidal or Strudel mini-notation as a pattern language;
- Alda or one documented MML family as textual sequencing;
- MIDI-Like, REMI+, and OctupleMIDI as model-token baselines.

Do not force every family into one purpose. Test a pattern language on native
pattern tasks and separately record whether it can support finite round-trip
note editing. An exact identity side ledger must be counted as part of the
representation when a task requires it.

## Durable task corpus

Use generated, public-domain, or permissively licensed fixtures. Cover:

- monophony, polyphony, synchronized parts, and several meters;
- rational binary, triplet, swung, and arbitrary performed timing;
- extended harmony, chromatic voice leading, and non-tertian material;
- roles, regions, repetition, articulation, velocity, and expression limits;
- short, medium, and long contexts;
- structural questions, reconstruction, local transformation, transfer,
  continuation, repair, and sparse editing; and
- at least one task that is native to each retained format family.

Keep the semantic fixture independent of every renderer. Each converter must
declare represented fields, defaults, side planes, and loss.

## Measurements

- Deterministic parse, render, and round-trip behavior.
- Exact field, identity, timing, and polyphony coverage.
- Agent task accuracy and compiler acceptance.
- Repair turns and error locality.
- Patch locality and preservation of unnamed state.
- Bytes, tokens, tokenizer fragmentation, and tokens per note and bar.
- Prompt, model, settings, latency, and raw-run identity.
- Human readability and format-native strengths as qualitative notes, not
  objective scores.

Keep fixed fixtures, task text, scoring code, and expected deterministic
results in the repository. Remote model results are repeatable experiments,
not permanent conformance tests.

## Documentation outputs

1. A compact-bar rationale that states its goals and non-goals.
2. A comparison matrix that gives each established format its native purpose.
3. One limitations document covering identity, timing, fields, pattern
   semantics, token cost, and round-trip editing.
4. A benchmark protocol with fixtures, prompts, scoring, versions, and run
   manifests.
5. A reproducible-results guide that distinguishes deterministic checks from
   provider-dependent model runs.
6. A list of changes required before compact-bar can be a public specification.

## Acceptance criteria

- The original E114 and E115 claims are traceable to retained fixtures and
  scoring rules.
- Current live evidence from E120, E121, and the played-range trial is included
  separately from direct provider comparisons.
- Every retained format passes a deterministic capability screen before model
  calls.
- Native-purpose and Ghostnote round-trip tasks are reported separately.
- Side ledgers, examples, and grammar instructions count toward token cost.
- The comparison does not call Tidal, ABC, or another format inferior for a
  task it does not claim to own.
- At least two current frontier model families run the controlled cohort when
  access is available. Missing access remains an explicit limit.
- The current compact-bar form is evaluated without freezing the future
  consolidated syntax.
- No live Bitwig write or external publication occurs.
- Focused checks, `context/check.rb`, and `git diff --check` pass.

## Retrospective target

Record whether compact-bar wins because of its syntax, its explicit task
fields, its edit identities, or the compiler outside the model. Do not combine
those causes into one score.
