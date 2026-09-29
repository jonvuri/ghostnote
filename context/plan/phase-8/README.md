---
title: Phase 8 — Agent-native live engine
kind: plan
state: active
status: Phase 8c4e is matrix-plausible under component-focused product gates.
updated: 2026-09-29
parent: ../ROADMAP.md
prev: ../phase-7/README.md
next: ../phase-9/README.md
---

# Phase 8 — Agent-native live engine

## Purpose

Recast Ghostnote as a fast set of specialized sensors and limbs for a frontier
agent working in Bitwig. Use structured tools where they improve on visual
inspection, clicking, and typing. Let agent reasoning and computer use handle
open-ended work that does not need a dedicated typed operation.

Reduce verification, output, and rollback ceremony when it does not prevent a
measured failure. Keep stronger safeguards for destructive, ambiguous, or
hard-to-observe changes. Prefer a small coherent surface, low latency, and low
token use over a self-contained workstation abstraction.

Build one normalized musical document and a fast project-wide clip cache. Keep
their boundaries separate: the cache is internal observed state; the selected
document is the agent-facing musical language.

## Entry condition

First complete the independent
[played-range consolidation live trial](../phase-7/7b-follow-up-played-range-consolidation.md).
That trial is a small example of the intended hybrid posture. Ghostnote detects
a semantic boundary, computer use performs the UI-only operation, and
Ghostnote reacquires structured state.

Use the trial's latency, tool calls, ceremony, and failure handling as input to
8a. Keep the current E131 reader and experimental note-patch profile unchanged
until the new cache reaches its promotion gate.

## Product direction

Phase 8 uses these working principles. The completed 8a audit refines them and
owns the migration details.

- Ghostnote supplies fast structured observation where generic vision is weak.
- Ghostnote supplies precise bounded actions where generic clicking is slow or
  unreliable.
- Computer use owns visual discovery, focus-dependent actions, and ordinary UI
  work when a typed route adds little value.
- Verification cost is proportional to risk and observability.
- A tool returns the smallest result that lets an agent continue safely.
- Experimental machinery does not stay in the normal runtime without a current
  product or regression owner.
- Layer chains are ordinary device structure. A/B audition is a recipe over
  generic layer-chain limbs, not a separate managed-alternate lifecycle.
- One public device composer can select a private offline fast path or a staged
  general path.
- Public names use Bitwig object nouns and state a narrower proved scope. A
  Launcher-only or instrument-only operation does not claim a general clip or
  track capability.
- Internal cache records do not become a public music format by accident.
- The stable reader remains a comparison authority until promotion evidence is
  complete.

## Session order

1. [8a — Agent-native product posture and interface audit](8a-agent-native-product-and-interface-audit.md).
   Complete. The
   [audit](../../evidence/format/AGENT_NATIVE_INTERFACE_AUDIT.md) selects the
   target architecture, risk tiers, and migration order. [E135](../../evidence/experiments/e135-agent-native-product-and-interface-audit.md)
   records the independent comparison and settled follow-up decisions.
2. [8b — Runtime and surface cleanup foundation](8b-runtime-and-surface-cleanup.md).
   Complete. [E136](../../evidence/experiments/e136-runtime-and-surface-cleanup.md)
   records the normal, capture, and probe identities and the lean runtime
   baseline.
3. [8c — Compact-bar prior art and reproducible benchmark](8c-compact-bar-prior-art-and-benchmark.md).
   Complete. [E137](../../evidence/experiments/e137-compact-bar-prior-art-and-benchmark.md)
   records the fixed comparison package, deterministic gate, and two-provider
   run.
4. [8d — Cache identity and lifecycle](8d-cache-identity-and-lifecycle.md).
   Complete. [E138](../../evidence/experiments/e138-cache-identity-and-lifecycle.md)
   resolves stale addresses, structural compaction, project changes, restart,
   replacement, ambiguity, and observer recovery.
5. [8e — Cache scale limits and degradation policy](8e-cache-scale-limits-and-degradation.md).
   Complete. [E139](../../evidence/experiments/e139-cache-scale-limits-and-degradation.md)
   selects product limits, budgets, and explicit exact-read degradation.
6. [8c1 — Expanded symbolic-format comparison](8c1-expanded-symbolic-format-comparison.md).
   Complete. [E140](../../evidence/experiments/e140-expanded-symbolic-format-comparison-requires-revision.md)
   records the fixed three-provider comparison. Its result is `revise` because
   the compact arm failed the repeated-loss rule and changed the v0 labeled
   grammar.
7. [8c2 — Compact-format development loop](8c2-compact-grammar-correction.md).
   Complete. [E142](../../evidence/experiments/e142-label-only-compact-fails-targeted-holdout.md)
   records `do-not-select` under the frozen gate and the measurement limits
   that prevent a broader equivalence claim.
8. [8c2.2 — Measurement repair and grouped compact iteration](8c2-2-measurement-repair-and-grouped-compact-iteration.md).
   Complete. [E143](../../evidence/experiments/e143-measurement-repair-and-grouped-calibration-freeze.md)
   records the offline measurement repair and first calibration freeze.
   [E144](../../evidence/experiments/e144-calibration-rejects-progression-floor.md)
   records `repair-measurement` and the frozen progression-repair calibration.
   [E145](../../evidence/experiments/e145-progression-repair-passes-and-development-freezes.md)
   records the passing repair and the pending development freeze.
   [E146](../../evidence/experiments/e146-grouped-development-stops-before-claude.md)
   records the stop before Claude and the unreachable development gate. The
   accepted result is `stop-custom-compact`.
9. [8c2.3 — Compact JSON factorial and native product decision](8c2-3-compact-json-factorial-and-native-decision.md).
   Complete. [E147](../../evidence/experiments/e147-compact-json-calibration-awaits-approval.md)
   records the offline prototype. [E148](../../evidence/experiments/e148-compact-json-calibration-requires-measurement-repair.md)
   records the r1 `repair-measurement` result. [E149](../../evidence/experiments/e149-compact-json-r2-stops-at-settings-repair.md)
   records the r2 stop. [E150](../../evidence/experiments/e150-compact-json-r3-passes-and-development-freezes.md)
   records the passing r3 calibration and frozen development plan.
   [E151](../../evidence/experiments/e151-compact-json-development-freezes-targeted-holdout.md)
   records the development `freeze-holdout` result. Native MIDI-like did not
   qualify. [E152](../../evidence/experiments/e152-tuple-json-midi-passes-targeted-holdout.md)
   records `select-for-phase8c3` for tuple JSON with MIDI integers.
10. [8c3 — Full symbolic-format matrix](8c3-full-symbolic-format-matrix.md).
   Complete. [E155](../../evidence/experiments/e155-full-symbolic-matrix-blocks-phase-8f.md)
   records `block`. Neither full-capability candidate passes the frozen gates.
   No candidate enters Phase 8f.
11. [8c4a — Benchmark contract repair](8c4a-benchmark-contract-repair.md).
   Complete. [E156](../../evidence/experiments/e156-compact-bar-contract-repair-freezes-calibration.md)
   records the repaired analysis, motif, progression, framing, and output-state
   contracts and the frozen calibration package.
12. [8c4b — Focused compact-bar calibration](8c4b-focused-compact-calibration.md).
   Complete. [E157](../../evidence/experiments/e157-focused-compact-calibration-requires-measurement-repair.md)
   records `repair-measurement` for calibration r1. Motif is at a ceiling, and
   progression is at a floor with an unstated output-context requirement.
   [E158](../../evidence/experiments/e158-compact-calibration-r2-awaits-approval.md)
   records the offline measurement repair and frozen calibration r2 package.
   [E159](../../evidence/experiments/e159-compact-calibration-r2-requires-analysis-repair.md)
   records `repair-measurement` for r2. Motif and progression are informative,
   but analysis is at a ceiling on two providers.
   [E160](../../evidence/experiments/e160-analysis-repair-r3-awaits-approval.md)
   records the frozen Gemini-first analysis repair. Claude is conditional on
   Gemini entering the eligibility band.
   [E161](../../evidence/experiments/e161-analysis-repair-r3-leaves-claude-at-ceiling.md)
   records `repair-measurement` for r3. Gemini is informative on the easy tier,
   but Claude remains at a ceiling.
   [E162](../../evidence/experiments/e162-haiku-substitution-awaits-approval.md)
   records the frozen Haiku substitution. It retains Gemini without a rerun.
   [E163](../../evidence/experiments/e163-haiku-r4-is-incomplete-under-extended-thinking.md)
   records `repair-measurement` for r4. Haiku is incomplete after three
   output-limit failures.
   [E164](../../evidence/experiments/e164-haiku-output-limit-repair-awaits-approval.md)
   records the frozen r5 repair. It raises the output limit, uses a fresh
   Haiku cohort, and adds a token-bound live cost guard.
   [E165](../../evidence/experiments/e165-haiku-r5-passes-and-opens-paired-development.md)
   records the passing r5 result and the consolidated `proceed-development`
   decision.
   [E166](../../evidence/experiments/e166-openai-analysis-supplement-awaits-approval.md)
   records an optional OpenAI-only supplement on the exact r5 measurement. It
   is frozen at the approval boundary and cannot change the r5 decision.
   [E167](../../evidence/experiments/e167-openai-r6-adds-the-third-analysis-provider.md)
   records the eligible OpenAI result. OpenAI, Gemini, and Haiku are eligible
   on the repaired analysis measurement.
13. [8c4c — Compact-bar paired development](8c4c-compact-bar-paired-development.md).
   [E168](../../evidence/experiments/e168-paired-development-awaits-approval.md)
   freezes the fresh paired package for OpenAI, Gemini, and Haiku.
   [E169](../../evidence/experiments/e169-paired-development-cost-budget-correction.md)
   corrects its hard ceiling to USD 5.000000.
   [E170](../../evidence/experiments/e170-paired-development-returns-revise.md)
   records the frozen `revise` result.
   [E171](../../evidence/experiments/e171-failure-audit-and-small-screen-awaits-approval.md)
   finds material prompt confounds and freezes a 72-call diagnostic screen.
   [E172](../../evidence/experiments/e172-prompt-screen-validates-fields-repair.md)
   validates the prompt repair. `FIELDS` leads output serialization but does
   not improve input comprehension.
   [E173](../../evidence/experiments/e173-fresh-full-family-comparison-awaits-approval.md)
   freezes a fresh analysis, motif, and progression comparison with a neutral
   analysis output contract.
   [E174](../../evidence/experiments/e174-fresh-full-family-comparison-favors-fields-over-v1.md)
   records the completed comparison. `FIELDS` beats positional v1 on every
   provider, but it does not establish parity with exact JSON. Progression
   remains at a reasoning floor.
   [E175](../../evidence/experiments/e175-fresh-failure-audit-finds-fields-good-enough.md)
   finds no remaining simple `FIELDS` defect. Accepting `FIELDS` is defensible.
   [E176](../../evidence/experiments/e176-gemini-local-label-diagnostic-awaits-approval.md)
   freezes the optional 32-call Gemini local-label diagnostic.
   [E177](../../evidence/experiments/e177-gemini-local-label-diagnostic-selects-local-labels.md)
   records 8/8 local-label analysis passes against 1/8 for `FIELDS`. All gates
   pass.
   [D24](../../decisions/d24-forward-compact-benchmarks-retain-fields-and-local-labels.md)
   keeps `FIELDS` and local labels for fresh quality and token-size comparison.
   All other compact variants are historical only.
   No compact arm advances to holdout yet.
14. [8c4c follow-up — Symbolic benchmark hardening](8c4c-follow-up-symbolic-benchmark-hardening.md).
   Complete. [E178](../../evidence/experiments/e178-symbolic-benchmark-hardening-freezes-v14.md)
   records the full audit and the passing v14 offline package. V14 freezes
   `FIELDS`, local labels, exact-object JSON, a fresh cohort, and the targeted-
   holdout plan. No provider call occurred.
15. [8c4d — Compact-bar targeted holdout](8c4d-compact-bar-targeted-holdout.md).
   Complete. [E179](../../evidence/experiments/e179-v14-targeted-holdout-stops.md)
   records `stop`. OpenAI and Gemini completed. Haiku stopped after three
   output-limit responses. The exact control and informativeness gates failed.
16. [8c4d follow-up — V15 validity ladder](8c4d-follow-up-v15-validity-ladder.md).
   [E180](../../evidence/experiments/e180-v15-validity-ladder-awaits-approval.md)
   records the passing offline package. V15 uses case and component musical
   scoring, a 1/2/4-case ladder, higher reasoning settings, and no exact-control
   musical gate. [E181](../../evidence/experiments/e181-v15-validity-ladder-is-incomplete.md)
   records the safe Gemini stop after 69/108 messages.
   [E182](../../evidence/experiments/e182-v15-validity-ladder-completes.md)
   records the approved continuation. All providers completed 108/108 with no
   failed or unavailable response. The result is `operator-review`.
17. [8c4d follow-up — V16 medium-difficulty tuning](8c4d-follow-up-v16-medium-difficulty-tuning.md).
   [E183](../../evidence/experiments/e183-v16-medium-difficulty-direction-awaits-approval.md)
   freezes a 66-call Gemini directional screen. It preserves v15 and increases
   task complexity only.
   [E184](../../evidence/experiments/e184-v16-medium-difficulty-direction-stops.md)
   records an HTTP 400 stop on the first request. A one-attempt recovery
   supplement was approved.
   [E185](../../evidence/experiments/e185-v16-gemini-recovery-confirms-region-stop.md)
   records the repeated HTTP 400. Gemini reports that the execution location is
   unsupported. No scientific row completed.
   [E186](../../evidence/experiments/e186-v16-other-provider-direction-awaits-approval.md)
   freezes the same directional workload for OpenAI and Haiku.
   [E187](../../evidence/experiments/e187-v16-openai-direction-requires-harder-tasks.md)
   records `revise-harder` after OpenAI reached 99.6644 percent component
   accuracy. The approved early stop prevented a Haiku run.
18. [8c4d follow-up — V17 harder medium-difficulty tuning](8c4d-follow-up-v17-harder-medium-difficulty.md).
   [E188](../../evidence/experiments/e188-v17-harder-direction-awaits-approval.md)
   freezes an OpenAI-only 66-message screen. Analysis has three interleaved
   hard cases. Affine continuation uses voice-conditioned parameters. The
   offline package passed. [E189](../../evidence/experiments/e189-v17-openai-stops-at-budget-and-remains-too-easy.md)
   records the live cost stop after 58/66 completions. The formal result is
   `invalid`, but the complete analysis family remains above the frozen upper
   bound. Recovery cannot open expansion, and Haiku remains unrun.
   [E190](../../evidence/experiments/e190-v17-analysis-composition-correction.md)
   corrects the claimed chord composition without changing frozen artifacts.
19. [8c4d follow-up — V18 low-effort rehearsal](8c4d-follow-up-v18-low-effort-rehearsal.md).
   [E191](../../evidence/experiments/e191-v18-low-effort-rehearsal-awaits-approval.md)
   freezes a 66-message OpenAI-low rehearsal. It separates elemental format
   isolation from real-use stress and provides a reusable suite for 8c4e.
   [E192](../../evidence/experiments/e192-v18-low-effort-rehearsal-is-operationally-complete.md)
   records 66/66 completions at USD 0.261846. The frozen automated label is
   `invalid`, but the operator clarified that 90 percent was a maximum task
   target. The run is operationally valid. Stress analysis met its target, but
   stress affine remained too easy.
   [E193](../../evidence/experiments/e193-v18-sampled-audit-validates-run-and-finds-transfer-flaw.md)
   finds no run defect. It finds that affine freshness must ignore synthetic
   IDs and vary musical content across cohorts before 8c4e freezes.
20. [8c4e — Compact-candidate full benchmark](8c4e-compact-only-full-benchmark.md).
   [E194](../../evidence/experiments/e194-8c4e-full-benchmark-awaits-approval.md)
   freezes the repaired full-suite package, 444-call schedule, and USD 5.550000
   hard limit.
   [E195](../../evidence/experiments/e195-v19-openai-makes-stop-irreversible.md)
   records 148/148 OpenAI completions at USD 0.713277. Five valid failed cells
   make `stop` irreversible, so Gemini and Claude Haiku were not run. The audit
   also excludes defective revoice scores from candidate interpretation.
   The operator later replaced strict canonical gates with component-focused
   product gates. The completed OpenAI results remain in scope. Gemini and
   Claude Haiku continued on the unchanged fresh fixtures.
   [E196](../../evidence/experiments/e196-v19-adaptive-component-assessment-is-matrix-plausible.md)
   records `matrix-plausible`. All 58 measured cells pass. Claude analysis is
   unavailable. A sampled audit removed one invalid analysis component and
   hardened ID-neutral revoice alignment without new provider calls. `FIELDS`
   is smaller and more accurate across the combined provider aggregates.
21. [8c4f — Full-matrix decision and optional rerun](8c4f-full-matrix-decision.md).
   Let the operator approve the fresh matrix, proceed with an explicit evidence
   limit, or stop.
22. [8c4f follow-up — Extensible matrix and external-format probe](8c4f-extensible-matrix-and-external-probe.md).
   [E197](../../evidence/experiments/e197-extensible-matrix-and-external-probe-await-approval.md)
   records the reusable adapter package, external-notation review, passing
   offline screen, and the pending 57-call Gemini probe.
   [E198](../../evidence/experiments/e198-external-format-probe-is-valid-directional-evidence.md)
   records 57/57 completions at USD 0.1164435. The corrected musical component
   rates are 96.800 percent for ABC, 97.200 percent for Strudel, and 97.067
   percent for LilyPond. The result is valid directional evidence, not a format
   selection.
23. [8c4f follow-up — MusicXML and MIDI-like probe](8c4f-follow-up-musicxml-midi-probe.md).
   [E199](../../evidence/experiments/e199-musicxml-midi-probe-awaits-approval.md)
   records the passing offline package and pending 38-call Gemini probe. The
   final matrix template has the eight selected arms.
   [E200](../../evidence/experiments/e200-musicxml-midi-probe-validates-final-matrix-arms.md)
   records 38/38 completions at USD 0.13523475. MusicXML reaches 97.487
   percent musical component accuracy. The MIDI-like profile reaches 98.942
   percent. Both arms advance to the fresh full-matrix plan.
24. [8c4f follow-up — Fresh eight-arm full matrix](8c4f-follow-up-eight-arm-full-matrix.md).
   [E201](../../evidence/experiments/e201-eight-arm-full-matrix-awaits-approval.md)
   records the passing offline package, 1,776-call plan, USD 20.250000 hard
   limit, and pending approval boundary.
25. [8f — Consolidated compact-bar and cache contracts](8f-consolidated-compact-bar-and-cache-contracts.md).
   Settle the public musical document and the separate internal cache boundary.
26. [8g — Shadow project cache](8g-shadow-project-cache.md).
   Implement the cache behind an experimental boundary while E131 remains
   authoritative.
27. [8h — Cache promotion and interface simplification](8h-cache-promotion-and-interface-simplification.md).
   Promote proved cache reads in stages and apply the selected tool and
   verification reductions.
28. [8i — Agent-native hybrid dogfood](8i-agent-native-hybrid-dogfood.md).
   Test ordinary work in fresh agent sessions and decide whether the engine,
   format, and surface are ready for Phase 9 publication review.

## Cross-session rules

- Preserve one stable comparison path until 8h explicitly retires or demotes
  it.
- Do not infer an upper limit from the largest passing E134 arm. Its 131,072
  steps, 256 observers, and 1,000 occupied coordinates are healthy lower
  bounds.
- Do not silently omit clips, notes, channels, or fields outside a cache limit.
- Keep normalized `1/512` loss explicit under D23.
- Label UI observations, structured observations, agent interpretations, and
  operator verdicts by their actual authority.
- Measure wall time, host work, tool calls, and result tokens before and after
  a material simplification.
- Use generated, public-domain, or permissively licensed music in publishable
  format fixtures.
- Do not publish a package, specification, asset, or release in Phase 8.

## Exit criteria

- The product posture names what Ghostnote owns and what computer use owns.
- Every retained normal-runtime method and public tool has a current purpose.
- Musical-representation comparisons include structured and native arms,
  three providers, deterministic musical tasks, repeated trials, and fixed
  scoring rules.
- Clip identity, invalidation, structural rebuild, project-change, and restart
  behavior are explicit.
- Product cache limits and degradation behavior are explicit and tested.
- The consolidated compact-bar contract has a versioned grammar, loss model,
  conformance corpus, and migration decision.
- The cache passes shadow comparison and is promoted only within proved health
  and coverage states.
- The simplified surface improves measured latency, calls, or tokens without
  hiding material effects or failures.
- Fresh hybrid dogfood confirms that an agent can use the surface without
  repository-specific coaching.
- Phase 9 receives explicit publication candidates and remaining limits.

## Phase 9 handoff

[Phase 9](../phase-9/README.md) owns breadth and external publication review.
The existing `bwmod` review moves there. A compact-bar publication review can
start only after 8i accepts the specification and conformance package.
