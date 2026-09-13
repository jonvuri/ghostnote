---
title: Phase 6 — Music workstation direction exploration
kind: plan
state: active
status: Sessions 6a through 6f and 6d2 are complete. Symbolic follow-up starts at 6f1.
updated: 2026-09-13
parent: ../ROADMAP.md
prev: ../phase-5/README.md
next: ../phase-7/README.md
---

# Phase 6 — Music workstation direction exploration

## Purpose

Explore Ghostnote as a modular music MCP workstation. The Bitwig information,
operation, and feedback surfaces become one Bitwig adapter. Other modules can
provide documentation retrieval, music analysis and transformation, audio
capture, and perceptual feedback.

This phase tests the direction before it expands the product contract. Each
session must produce evidence, a bounded prototype, or a clear negative result.

## Working model

Ghostnote should provide capabilities that agents do not perform quickly or
reliably on their own:

1. Deterministic, reliable, and fast operations.
2. Reliable feedback loops over project, musical, and audio state.

The programming analogy is deliberate:

- Operations act like codemods. They apply exact structural changes in bulk or
  complete one operation faster and more reliably than computer use.
- Symbolic context acts like static typing. It reports exact structure,
  invariants, incompatibilities, and before-and-after differences. The host
  agent supplies open-ended musical reasoning.
- Audio observation acts like testing. It measures the produced signal and
  supplies bounded facts and estimates. The host agent can interpret this
  evidence, but the operator owns the verdict.
- Computer use acts like the interactive editor. It owns open-ended visual work,
  plug-in user interfaces, and workflows that have no useful programmatic path.

The workstation and computer use should work together. Ghostnote-only operation
also remains a supported constrained mode. A missing computer-use capability
must produce an explicit boundary instead of a guessed substitute.

## Design principles

### Prefer high-leverage operations

Prioritize bulk work and single operations with a material speed or reliability
advantage. Do not reproduce each Bitwig user-interface gesture as a tool. Prefer
semantic operations that reduce many slow agent steps to one checked request.

### Build independent modules

Each module must have a small, versioned interface. It must work independently
and compose through explicit artifacts and results. Avoid hidden shared state.
Use hashes, provenance, capability metadata, and declared observation coverage
at module boundaries.

Candidate modules are:

- a Bitwig adapter for project information and operations;
- an offline Bitwig documentation provider;
- an agent-facing symbolic context and exact patch compiler;
- replaceable theory, voicing, and measurement providers;
- an audio capture provider;
- deterministic audio analysis providers; and
- optional perceptual-model providers after a new provider passes its gate.

An external provider must be replaceable. One provider failure must not disable
unrelated workstation capabilities.

### Keep open-ended reasoning in the host agent

Do not add a specialist model only because a task requires musical reasoning.
First test whether the host agent can do the work when Ghostnote supplies better
musical context, deterministic measurements, constrained edit primitives, and
exact verification.

Keep complete project state outside model-generated output. Let an agent propose
a bounded edit against stable identities or musical regions. Compile and verify
that proposal before a risk-bearing write.

Reference-conditioned work needs exact reference provenance and separate
measurements for useful structural similarity and direct copying. A similarity
metric is not an aesthetic or legal verdict.

### Prefer established tools

Evaluate mature existing tools before custom implementation. Prefer tools that
are free to use, lightweight, fast, reliable, and actively maintained. Prefer a
direct TypeScript library or a fast native library with a stable binding. A
small Rust component or a stable executable adapter is acceptable when it gives
a measured benefit.

Record license, release activity, supported platforms, startup cost, steady-state
latency, memory cost, determinism, output stability, and integration complexity.
Do not select a tool from feature lists alone.

### Keep aesthetic authority with the operator

Audio and musical analysis can classify, compare, and guide construction.
Aesthetic acceptance stays with the operator. Descriptors such as dark, brittle,
wide, intimate, or aggressive are valid construction inputs and analysis search
terms. They are not automatic acceptance criteria.

## Verification and performance policy

Audit the cost of the current verification system during every exploration.
Measure the latency and host work for target acquisition, guards, settlement,
readback, reversal preparation, and full-state scans separately.

Do not remove a proved safety check only because it is expensive. Select the
smallest verification level that matches the operation risk:

- A risk-bearing structural write keeps exact target guards and independent
  post-write evidence.
- A bounded scalar or idempotent write should avoid unrelated full-chain reads
  when a narrow target-bound postcondition is sufficient.
- A read-only analyzer needs source identity, version, and coverage. It does not
  need mutation ceremony.
- A computer-use step can verify visible UI state. The Bitwig adapter should
  verify only the semantic state it can observe. Neither route can claim the
  other's evidence.
- An external UI mutation is not automatically a Ghostnote-owned reversible
  change.

Prefer fast failure over retries when the target, coverage, or recovery boundary
is unknown. Treat historical probe instrumentation and product verification as
separate costs.

## Local starting facts

Bitwig Studio 6.0.6 includes useful offline sources:

- Controller API HTML under
  `/Applications/Bitwig Studio.app/Contents/Resources/Documentation/control-surface/api`;
- native device, parameter, modulator, and Grid module descriptions under
  `Contents/Resources/localization`; and
- device defaults, presets, and remote maps under `Contents/Resources/Library`.

No complete local user-guide PDF or HTML was found in the application or user
support directories. Phase 6 must test whether the exact-version guides have a
stable official download route. Query installed files in place. Do not bundle
copyrighted documentation without a redistribution decision.

The current computer-use interface observes accessibility state and screenshots.
It does not capture audio. GPT-5.6 Sol accepts text and images but not audio.
OpenAI supplies separate audio-capable models, but their music and sound-design
judgment is unproved for this product.

Bitwig Controller API 25 includes `MasterRecorder`. It can start and stop master
recording and report duration. It does not expose audio bytes or a file path.
Session 6a must determine what artifact it creates before any loopback design is
considered.

## Exploration order

1. [6a — audio capture feasibility](6a-audio-capture-feasibility.md). Complete.
   E103 proves three exact project-local MasterRecorder WAV files.
2. [6b — exact-version offline documentation retrieval](6b-exact-version-offline-documentation-retrieval.md).
   Complete. Find stable official
   user-guide downloads, test version-aware automatic download and caching,
   inventory installed semantic sources, and compare a small lexical index with
   local semantic retrieval.
3. [6c — deterministic audio-analysis tool survey](6c-deterministic-audio-analysis-tool-survey.md).
   Complete. E105 selects FFmpeg and a long-lived librosa worker for typed,
   deterministic facts and bounded estimates.
4. [6d — perceptual audio-model evaluation](6d-perceptual-audio-model-evaluation.md).
   Complete. E106 rejects two local CLAP checkpoints. E107 rejects GPT-Audio
   and records repeated Gemini service unavailability. E108 rejects Gemini
   after a paid retry completes the blind cohort.
5. [6e — semantic music analysis and manipulation](6e-semantic-music-analysis-and-manipulation.md).
   Complete. E109 selects the exact contract and checked transformations. E110
   selects Music21 for analysis and Musicpy as a voicing specialist candidate.
6. [6d2 — perceptual listener-agreement evaluation](6d2-perceptual-listener-agreement-evaluation.md).
   Complete. E111 replaces the factual selection gate with a
   listener-agreement gate. E113 rejects provider selection because the public
   reference and control coverage are not sufficient.
7. [6f — agent-facing symbolic representation](6f-agent-facing-symbolic-representation.md).
   Complete. E114 selects compact bar context and guarded JSON patches. It
   confirms the result across GPT-5.4 Mini and Gemini 3.8 Flash.
8. [6f1 — established symbolic representations and model familiarity](6f1-established-symbolic-representations-and-model-familiarity.md).
   Compare established MIDI-token and pattern formats with isomorphic controls.
   Keep harmonic, transformation, continuation, and groove tasks in scope.
9. [6f2 — groove intent and microtiming reproducibility](6f2-groove-intent-and-microtiming-reproducibility.md).
   Prove finer Bitwig timing first. Then test explicit nominal, realized, and
   multi-reference groove forms across jazz, funk, and hip-hop material.
10. [6g — reference-conditioned continuation and structural transfer](6g-reference-conditioned-continuation-and-structural-transfer.md).
   Test seed continuation, variation, and structural borrowing. Use Notochord
   as a bounded specialized baseline, not a product commitment.
11. [6h — agent sensory-packet utility](6h-agent-sensory-packet-utility.md).
   Test whether routed MIDI and audio facts improve host-agent decisions over
   raw exact state.
12. [6i — workstation contract synthesis](6i-workstation-contract-synthesis.md).
    Define shared contracts, isolated module failure, probe disposition, and the
    experimental Phase 7 surface. Do not implement providers.
13. [6j — verification-cost audit](6j-verification-cost-audit.md).
    Classify target, guard, settlement, readback, recovery, reversal, and scan
    costs before Phase 7 implementation.

Sessions 6c and 6d require a successful or otherwise usable 6a capture route.
If 6a fails, record the gate and revise the audio direction before continuing.

## Exit criteria

- Audio capture has a proved route or a precise blocking boundary.
- Exact-version Bitwig documentation acquisition and local search have measured
  coverage and update rules.
- Audio-analysis candidates have license, performance, reliability, and output
  comparisons on representative snippets.
- Perceptual models have controlled results for useful sound-design comparisons.
- Music analysis has a typed semantic contract and at least one useful
  before-and-after transformation loop.
- Agent-facing symbolic input and patch output have a measured representation
  boundary for time-precise, multi-track work.
- Established symbolic formats have controlled model-familiarity results that
  do not claim private training-data knowledge.
- Groove has a measured live timing floor, an explicit intent and performance
  representation, and a reproducible realization contract.
- Reference-conditioned continuation and structural transfer have controlled
  comparison results, copy-overlap measurements, and operator verdicts.
- MIDI and audio sensory packets have measured utility or a precise blocker.
- The workstation modules have independent planned interfaces and an explicit
  composition contract with no hidden global runtime.
- The verification audit identifies which costs are essential, reducible, or
  historical. Any reduction keeps a proved safety basis.
- Phase 7 has an experimental dogfood menu and explicit hybrid, solo,
  provenance, and operator-verdict rules.

## Out of scope

- A second production DAW adapter during this exploration.
- A custom general chat harness.
- Replacing computer use with a mirror of the Bitwig interface.
- Treating model output as an operator audition verdict.
- Installing a proprietary loopback dependency as the default capture route.
- Relaxing named-action or destructive-operation safety decisions without new
  controlled evidence.

## Handoff

Start session 6f1. Compare established symbolic representations with controlled
model-familiarity tests and complete musical tasks.
