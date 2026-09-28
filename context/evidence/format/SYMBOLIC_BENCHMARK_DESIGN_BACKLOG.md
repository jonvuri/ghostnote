---
title: Symbolic benchmark design backlog
kind: reference
state: active
updated: 2026-09-28
scope: Cross-version experiment-design findings and repair requirements
parent: COMPACT_BAR_BENCHMARK_PROTOCOL.md
---

# Symbolic benchmark design backlog

## Purpose

This is the durable issue register for symbolic-format benchmark design. Add a
finding here when it can affect causal attribution, measurement accuracy,
provider comparability, execution integrity, or cost authority.

Historical run artifacts and decisions remain immutable. A resolved issue
becomes a regression requirement for the next benchmark package. Do not erase
it from this register.

The current entries consolidate the findings still present in direct context,
principally from E157 through E177. They retain earlier authority where the
recent evidence links to it. The focused hardening session must audit E137
through E156 and every benchmark package from compact-bar v0 through
compact-format v13 for additional entries.

## Status terms

- `open`: the next benchmark package needs a repair or explicit decision.
- `resolved-regression`: a later package fixed the issue; keep a test for it.
- `design-choice`: the behavior can be valid, but the protocol must state its
  meaning and limits.
- `audit-needed`: the historical scope is not yet fully checked.

## Prompt and contract alignment

| ID | Status | Finding | Required treatment | Evidence |
|---|---|---|---|---|
| P1 | resolved-regression | The scorer required exact `BASE` and `SOURCE` values that the source-free task prompt did not state. | Test prompt-to-scorer visibility for every required value. | E157-E159 |
| P2 | resolved-regression | The phrase `FIELDS ... velocity line` caused models to treat `line` as a seventh field. | Keep the exact declaration on its own row. State the row arity separately. | E170-E172 |
| P3 | resolved-regression | Input delimiters resembled output grammar and leaked into answers. | Use delimiters that cannot be valid output rows. | E171-E172 |
| P4 | resolved-regression | The literal `BASE none` was ambiguous and could become a blank value. | State literal header values explicitly and test them. | E171-E172 |
| P5 | resolved-regression | The analysis prompt mixed the input-arm label with a different output grammar. A required `ANALYSIS` prefix created false failures. | Name input and output representations separately. Ignore the optional legacy prefix during semantic scoring. | E171-E174 |
| P6 | open | Rational spelling is underspecified. Exact JSON lost one valid musical answer because it used a mixed fraction such as `32 5/8`. | Require integers or reduced improper `a/b` fractions, or normalize equivalent rational text before conformance scoring. | E175 |
| P7 | open | The task does not always state that note IDs must be globally unique. | Put the uniqueness rule in every document-output prompt and deterministic prompt test. | E175 |
| P8 | open | The motif formula permits a parenthesis error. | Use the equivalent `2*axis-source_pitch+semitones` form and test formula visibility. | E175 |
| P9 | design-choice | Only the `FIELDS` candidate receives explicit six-value row-arity prose. This is valid for a deployable candidate but does not isolate the declaration alone. | State whether a run compares complete prompt packages or one syntax feature. Give controls equal non-feature guidance for a causal feature test. | E175 |

## Task calibration and validity

| ID | Status | Finding | Required treatment | Evidence |
|---|---|---|---|---|
| T1 | resolved-regression | Motif reached a ceiling and progression reached a floor in the first focused calibration. | Require an informative exact-control band before a family can decide a format. | E157-E159 |
| T2 | resolved-regression | Analysis reached a ceiling on stronger providers. A model-tier mismatch made the cross-provider gate uninformative and expensive. | Calibrate difficulty and provider capability tiers before development. | E159-E165 |
| T3 | open | Current progression is at a reasoning floor. It has no input document and does not isolate input-format effects. | Repair or replace it before it can decide a format. Keep serialization and planning results separate. | E174-E175 |
| T4 | open | Dense analysis batches have different case counts, but each batch has equal headline weight. | Report per-case and per-component accuracy beside strict batch conformance. Balance workloads or weight them explicitly. | E175 |
| T5 | design-choice | A strict whole-task pass is useful for product conformance but hides one-value near misses during format development. | Keep strict pass. Add diagnostic severity, failed-value counts, and per-note or per-case results. | E171, E175 |
| T6 | audit-needed | Earlier format cycles used floors, ceilings, guard families, repairs, and changing task contracts. Their retained decision authority needs one consolidated audit. | Trace E137-E156 and packages v0-v9. Record which historical results remain comparable. | Phase 8c4c follow-up |

## Parsing and scoring

| ID | Status | Finding | Required treatment | Evidence |
|---|---|---|---|---|
| S1 | open | A wrong calculated time can change note order and become a generic canonical-syntax failure. This hides the underlying arithmetic or musical cause. | Report structural parse, canonical form, and musical checks separately when safe normalization permits it. | E174-E175 |
| S2 | resolved-regression | Unavailable, output-limit, transport-failed, initial, and repaired results were previously easy to mix. | Keep each state explicit. Do not put unavailable results in scored denominators. | E157-E165 |
| S3 | design-choice | Planned-denominator conformance and scored-denominator model accuracy answer different questions. | Report both with explicit names. Never turn an unavailable result into a musical failure silently. | E163-E175 |
| S4 | resolved-regression | Repair output could obscure the primary initial result. | Keep repair recovery diagnostic. Never replace the initial primary score. | E157-E170 |
| S5 | audit-needed | Parser strictness and canonical normalization changed across benchmark versions. | Build a cross-version task-to-parser-to-scorer map and mutation suite. | Phase 8c4c follow-up |

## Sampling and causal attribution

| ID | Status | Finding | Required treatment | Evidence |
|---|---|---|---|---|
| C1 | open | One provider-default sample per arm is too unstable for small differences. Identical progression prompts reversed exact and `FIELDS` outcomes. | Freeze deterministic settings when supported. Otherwise use enough predeclared repeats to estimate variation. | E171, E174-E175 |
| C2 | open | V12 ran arms in blocks instead of randomized or interleaved order, although an earlier plan required randomized arm order. | Randomize or balance order within provider and fixture. Record the realized order. | E151, E175 |
| C3 | open | One repeated first-fixture sentinel per arm and family detects some variation but cannot estimate it well. | Define the sentinel purpose, count, placement, and decision use before calls. | E163, E171, E174-E175 |
| C4 | design-choice | Provider-specific results can disagree materially. A pooled tie can hide opposite effects. | Keep provider and family results primary. Pool only for a stated secondary summary. | E167, E174 |
| C5 | open | The current sample resolution and strict gates can create long cycles without changing a product decision. | Use an explicit smallest useful effect, uncertainty rule, and value-of-information stop. | E168-E175 |

## Representation comparison

| ID | Status | Finding | Required treatment | Evidence |
|---|---|---|---|---|
| R1 | resolved-regression | Positional v1 lets models shift values, add columns, or reuse IDs. `FIELDS` prevents most of these errors. | Keep positional v1 as historical evidence and an offline regression source. Do not use it in new provider calls. | E171-E175, D24 |
| R2 | design-choice | The v13 Gemini stress diagnostic found a repeated local-label benefit, but its post-hoc cases do not estimate a fresh family effect. | Retain both `FIELDS` and local labels. Compare quality and token size on fresh paired fixtures. | E175-E177, D24 |
| R3 | design-choice | Exact JSON is a structured task control and complete-state fallback. It is not automatically the product format. | Keep capability, accuracy, compactness, and product-choice claims separate. | E137-E175 |
| R4 | open | Format effects, task-reasoning effects, and prompt-package effects are not always isolated. | Declare the estimand for every run and change only the factors needed to measure it. | E171-E175 |

## Provider settings and completion

| ID | Status | Finding | Required treatment | Evidence |
|---|---|---|---|---|
| V1 | resolved-regression | A total output limit was treated like a thinking budget. Hidden reasoning exhausted Haiku's response before an answer. | Freeze thinking and total-output controls separately. Test their effective provider request. | E163-E165 |
| V2 | resolved-regression | Provider credentials and settings were not always checked before the run. | Validate all required credential names and effective settings before the first paid call. | E157-E165 |
| V3 | design-choice | Provider-specific cohorts or settings repairs can be valid but do not form one paired three-provider cohort. | State retained providers, cohort differences, and comparison limits. | E162-E167 |
| V4 | open | Provider-default temperature and unsupported seeds differ by provider. | Record the effective sampling controls and define how cross-provider claims handle them. | E166-E175 |

## Execution, cost, and auditability

| ID | Status | Finding | Required treatment | Evidence |
|---|---|---|---|---|
| X1 | resolved-regression | Maximum-token multiplication produced an implausible cost estimate. | Use recent measured cost for planning and a separate token-bound hard guard. | E168-E169 |
| X2 | resolved-regression | Hidden reasoning and failed requests can consume the approved budget. | Reserve the full next-call bound before the request, settle measured cost, and retain failed reservations. | E163-E170 |
| X3 | resolved-regression | Aggregate rounding and retry supplements can make reported cost diverge. | Sum exact provider line items, round once, and reconcile every supplement. | E167-E170 |
| X4 | open | A sandbox-blocked run printed processed failures as completed work. | Add a network preflight. Distinguish attempted, processed, provider-completed, failed, and budget-stopped jobs in progress output. | E174 |
| X5 | design-choice | Network retries change the approved request set. | Make no automatic retry. Record and approve any recovery supplement separately. | E170, E173-E174 |
| X6 | resolved-regression | Old results could be mistaken for a new run without exact run identity and immutable outputs. | Bind approval, manifests, and summaries to run, protocol, plan, cohort, prompt, and raw-response hashes. Refuse output overwrite. | E158-E174 |

## Required hardening audit

The focused hardening session must:

1. inspect E137 through E175 and all format benchmark packages;
2. add missing issues and mark every issue with its affected versions;
3. define one current estimand for format selection;
4. build prompt-to-scorer visibility and mutation tests;
5. separate conformance, semantic quality, availability, repair, and variation;
6. repair sampling order, repeat policy, task calibration, cost guards, network
   preflight, and progress reporting;
7. decide whether the old reserved holdout is still valid;
8. create a new versioned package when any frozen behavior changes; and
9. freeze the corrected benchmark before a targeted holdout call.

Do not rerun historical provider cohorts. Use their outputs as adversarial
regression fixtures where licensing and retained payloads permit it.
