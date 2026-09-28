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

The current entries cover E137 through E177 and every symbolic benchmark
package from compact-bar v0 through compact-format v13. V14 closes the current
open repair set. Historical packages stay immutable.

E138 and E139 concern cache lifecycle and scale. They add no symbolic
benchmark-design finding.

## Status terms

- `open`: the next benchmark package needs a repair or explicit decision.
- `resolved-regression`: a later package fixed the issue; keep a test for it.
- `design-choice`: the behavior can be valid, but the protocol must state its
  meaning and limits.
- `historical-limit`: preserve the result, but do not extend its authority.

## Prompt and contract alignment

| ID | Status | Finding | Required treatment | Evidence |
|---|---|---|---|---|
| P1 | resolved-regression | The scorer required exact `BASE` and `SOURCE` values that the source-free task prompt did not state. | Test prompt-to-scorer visibility for every required value. | E157-E159 |
| P2 | resolved-regression | The phrase `FIELDS ... velocity line` caused models to treat `line` as a seventh field. | Keep the exact declaration on its own row. State the row arity separately. | E170-E172 |
| P3 | resolved-regression | Input delimiters resembled output grammar and leaked into answers. | Use delimiters that cannot be valid output rows. | E171-E172 |
| P4 | resolved-regression | The literal `BASE none` was ambiguous and could become a blank value. | State literal header values explicitly and test them. | E171-E172 |
| P5 | resolved-regression | The analysis prompt mixed the input-arm label with a different output grammar. A required `ANALYSIS` prefix created false failures. | Name input and output representations separately. Ignore the optional legacy prefix during semantic scoring. | E171-E174 |
| P6 | resolved-regression | Rational spelling is underspecified. Exact JSON lost one valid musical answer because it used a mixed fraction such as `32 5/8`. | V14 requires integers or reduced improper `a/b` fractions. It separates structurally valid noncanonical text and rejects mixed fractions. | E175; v14 mutation screen |
| P7 | resolved-regression | The task does not always state that note IDs must be globally unique. | V14 states the rule in every document-output prompt and rejects duplicate-ID mutations. | E175; v14 visibility and mutation screens |
| P8 | resolved-regression | The motif formula permits a parenthesis error. | V14 uses `2*axis-source_pitch+semitones` and tests formula visibility. | E175; v14 visibility screen |
| P9 | design-choice | Only the `FIELDS` candidate receives explicit six-value row-arity prose. This is valid for a deployable candidate but does not isolate the declaration alone. | State whether a run compares complete prompt packages or one syntax feature. Give controls equal non-feature guidance for a causal feature test. | E175 |

## Task calibration and validity

| ID | Status | Finding | Required treatment | Evidence |
|---|---|---|---|---|
| T1 | resolved-regression | Motif reached a ceiling and progression reached a floor in the first focused calibration. | A V14 decision family needs exact JSON from 75 percent inclusive to 95 percent exclusive and one compact arm strictly between 25 and 87.5 percent. | E157-E159; v14 aggregation screen |
| T2 | resolved-regression | Analysis reached a ceiling on stronger providers. A model-tier mismatch made the cross-provider gate uninformative and expensive. | Require at least one informative decision family for each provider. Treat other families as guards. | E159-E165; v14 decision rule |
| T3 | resolved-regression | Current progression is at a reasoning floor. It has no input document and does not isolate input-format effects. | V14 removes progression from decision work. It uses input-bearing affine continuation and a separate serialization guard. | E174-E175; v14 protocol |
| T4 | resolved-regression | Dense analysis batches have different case counts, but each batch has equal headline weight. | V14 uses four cases in every analysis batch. It reports strict batch and component denominators separately. | E175; v14 aggregation screen |
| T5 | design-choice | A strict whole-task pass is useful for product conformance but hides one-value near misses during format development. | Keep strict pass. Add diagnostic severity, failed-value counts, and per-note or per-case results. | E171, E175 |
| T6 | resolved-regression | Earlier format cycles used floors, ceilings, guard families, repairs, and changing task contracts. Their retained decision authority needs one consolidated audit. | The package audit below covers E137-E177 and every package through v13. | E137-E177; v14 hardening audit |

## Parsing and scoring

| ID | Status | Finding | Required treatment | Evidence |
|---|---|---|---|---|
| S1 | resolved-regression | A wrong calculated time can change note order and become a generic canonical-syntax failure. This hides the underlying arithmetic or musical cause. | V14 reports structural parse, canonical form, field checks, and semantic pass separately. Its mutation suite checks a wrong time and noncanonical equivalent. | E174-E175; v14 mutation screen |
| S2 | resolved-regression | Unavailable, output-limit, transport-failed, initial, and repaired results were previously easy to mix. | Keep each state explicit. Do not put unavailable results in scored denominators. | E157-E165 |
| S3 | design-choice | Planned-denominator conformance and scored-denominator model accuracy answer different questions. | Report both with explicit names. Never turn an unavailable result into a musical failure silently. | E163-E175 |
| S4 | resolved-regression | Repair output could obscure the primary initial result. | Keep repair recovery diagnostic. Never replace the initial primary score. | E157-E170 |
| S5 | resolved-regression | Parser strictness and canonical normalization changed across benchmark versions. | The package audit below records the changes. V14 freezes a two-phase parser and focused mutations. | E137-E177; v14 mutation screen |

## Sampling and causal attribution

| ID | Status | Finding | Required treatment | Evidence |
|---|---|---|---|---|
| C1 | resolved-regression | One provider-default sample per arm is too unstable for small differences. Identical progression prompts reversed exact and `FIELDS` outcomes. | V14 predeclares two repeats for every decision fixture and a 12.5-point smallest useful effect. | E171, E174-E175; v14 protocol |
| C2 | resolved-regression | Historical schedules did not retain auditable realized order. V12 shuffled jobs but sorted results, so evidence cannot resolve the reported block-order claim. | V14 freezes balanced provider schedules and retains planned, start, and completion ordinals. | E151, E175; v14 schedule and manifest checks |
| C3 | resolved-regression | One repeated first-fixture sentinel per arm and family detects variation but cannot estimate it well. | V14 removes sentinels. Every decision fixture receives two predeclared repeats. | E163, E171, E174-E175; v14 protocol |
| C4 | design-choice | Provider-specific results can disagree materially. A pooled tie can hide opposite effects. | Keep provider and family results primary. Pool only for a stated secondary summary. | E167, E174 |
| C5 | design-choice | The current sample resolution and strict gates can create long cycles without changing a product decision. | V14 freezes the smallest useful effect, noninferiority margin, repeated-loss rule, and value-of-information stop. | E168-E175; v14 decision and stopping rules |

## Representation comparison

| ID | Status | Finding | Required treatment | Evidence |
|---|---|---|---|---|
| R1 | resolved-regression | Positional v1 lets models shift values, add columns, or reuse IDs. `FIELDS` prevents most of these errors. | Keep positional v1 as historical evidence and an offline regression source. Do not use it in new provider calls. | E171-E175, D24 |
| R2 | design-choice | The v13 Gemini stress diagnostic found a repeated local-label benefit, but its post-hoc cases do not estimate a fresh family effect. | Retain both `FIELDS` and local labels. Compare quality and token size on fresh paired fixtures. | E175-E177, D24 |
| R3 | design-choice | Exact JSON is a structured task control and complete-state fallback. It is not automatically the product format. | Keep capability, accuracy, compactness, and product-choice claims separate. | E137-E175 |
| R4 | design-choice | Format effects, task-reasoning effects, and prompt-package effects are not always isolated. | V14 declares complete-prompt-package estimands. It identifies input-only, combined input-output, and output-only families. | E171-E175; v14 protocol |

## Provider settings and completion

| ID | Status | Finding | Required treatment | Evidence |
|---|---|---|---|---|
| V1 | resolved-regression | A total output limit was treated like a thinking budget. Hidden reasoning exhausted Haiku's response before an answer. | Freeze thinking and total-output controls separately. Test their effective provider request. | E163-E165 |
| V2 | resolved-regression | Provider credentials and settings were not always checked before the run. | Validate all required credential names and effective settings before the first paid call. | E157-E165 |
| V3 | design-choice | Provider-specific cohorts or settings repairs can be valid but do not form one paired three-provider cohort. | State retained providers, cohort differences, and comparison limits. | E162-E167 |
| V4 | design-choice | Provider-default temperature and unsupported seeds differ by provider. | V14 records declared and effective request settings. Provider and family results stay primary. | E166-E175; v14 protocol |

## Execution, cost, and auditability

| ID | Status | Finding | Required treatment | Evidence |
|---|---|---|---|---|
| X1 | resolved-regression | Maximum-token multiplication produced an implausible cost estimate. | Use recent measured cost for planning and a separate token-bound hard guard. | E168-E169 |
| X2 | resolved-regression | Hidden reasoning and failed requests can consume the approved budget. | Reserve the full next-call bound before the request, settle measured cost, and retain failed reservations. | E163-E170 |
| X3 | resolved-regression | Aggregate rounding and retry supplements can make reported cost diverge. | Sum exact provider line items, round once, and reconcile every supplement. | E167-E170 |
| X4 | resolved-regression | A sandbox-blocked run printed processed failures as completed work. | V14 performs credential and network preflight. It reports planned, attempted, provider-completed, available, scored, failed, unavailable, and budget-stopped counts. A received malformed response retains its raw hash, usage, and cost. | E174; v14 preflight, provider-accounting, and aggregation screens |
| X5 | design-choice | Network retries change the approved request set. | Make no automatic retry. Record and approve any recovery supplement separately. | E170, E173-E174 |
| X6 | resolved-regression | Old results could be mistaken for a new run without exact run identity and immutable outputs. | Bind approval, manifests, and summaries to run, protocol, plan, cohort, prompt, and raw-response hashes. Refuse output overwrite. | E158-E174 |

## Additional historical regressions

| ID | Status | Affected packages | Finding | V14 closure or retained limit |
|---|---|---|---|---|
| H1 | historical-limit | compact-bar v0, symbolic v1 | Positional v1 removed v0 labels and structural headers. The two results are not a direct grammar replication. | Preserve both packages. Positional v1 is an offline regression source only. |
| H2 | resolved-regression | symbolic v1, compact v2 | Broad composite failure classes and an all-arm denominator hid eligibility differences. | V14 uses one capability set, explicit states, and planned and scored denominators. |
| H3 | resolved-regression | compact v2 | Motif identity scoring required output IDs that the prompt did not state. | V14 makes every output ID visible and tests visibility. |
| H4 | resolved-regression | compact v2 | Revoice prompt, duration rule, and canonical answer disagreed. The scorer accepted only one valid realization. | The family is retired from paid v14 work. Historical failures stay mutation fixtures. |
| H5 | resolved-regression | compact v3 | Progression omitted plain-text full pitch-class coverage and reached a floor. | V14 progression is not a decision family. |
| H6 | historical-limit | compact v3 | A reserved melody cohort named strong beats incorrectly. | V14 executes all fresh reference answers offline and does not reuse that cohort. |
| H7 | resolved-regression | compact v3 | Grouped single-note output omitted exact field order and an example. | Every v14 row form has an exact template and complete example. |
| H8 | resolved-regression | compact-json v1 | The first JSON grammar omitted collection order, exact metadata, and a useful multi-voice example. | V14 freezes exact-object fields, metadata, canonical order, and a multi-voice example. |
| H9 | resolved-regression | compact-json v1 r2 | The manifest declared 4,000 output tokens while the request sent 3,000. | V14 tests declared settings against the effective serialized request settings. |
| H10 | historical-limit | symbolic v2 | A recursive usage wrapper lost 435 paid calls and their usage artifacts. | Preserve E154 as a cost-unknown stop. V14 uses direct call accounting, raw hashes, and exact line-item reconciliation. |
| H11 | resolved-regression | symbolic v2, compact v12 | Freshness scans included later packages. Later artifacts changed earlier deterministic identity. | V14 freezes the exact historical package source list and snapshot hash. Future packages cannot enter its scan. |
| H12 | historical-limit | symbolic v1, compact v2-v6, compact-json v1, symbolic v2, compact v10-v12 | Threaded or shuffled runs later sorted their retained rows. Scheduled, started, and completed order is not recoverable. | V14 runs a frozen balanced sequence and retains all three ordinals. |
| H13 | historical-limit | compact-bar v0 through compact v7; selected later recovery supplements | Automatic retry, overwrite, soft cost notices, or missing failed reservations changed or weakened execution authority. | V14 has no retry or repair, refuses overwrite, reserves before calls, and needs a new supplement for recovery. |

## Affected-version index

This index gives every current issue an explicit package scope.

| IDs | Affected packages |
|---|---|
| P1 | compact v4 |
| P2-P5 | compact v10; repaired in v11-v12 |
| P6-P8 | compact v12-v13 and earlier document prompts where applicable |
| P9 | compact v11-v14 |
| T1 | compact v4-v5 |
| T2 | compact v5-v9 |
| T3 | compact v2-v5, compact-json v1, compact v10-v13 |
| T4 | compact v6-v13 |
| T5 | compact v10-v14 |
| T6 | compact-bar v0, symbolic v1-v2, compact v2-v13, compact-json v1 |
| S1 | compact v12-v13 and every canonical document scorer |
| S2-S4 | symbolic v2, compact v4-v14 |
| S5 | compact-bar v0, symbolic v1-v2, compact v2-v14, compact-json v1 |
| C1 | symbolic v1-v2, compact v2-v12, compact-json v1 |
| C2 | symbolic v1-v2, compact v2-v6, compact-json v1, compact v10-v12 |
| C3 | symbolic v1, compact v4-v12 |
| C4 | all three-provider packages |
| C5 | compact v2-v13, compact-json v1, symbolic v1-v2 |
| R1 | symbolic v1, compact v4-v12 |
| R2 | compact v12-v14 |
| R3 | compact-bar v0 through compact v14, compact-json v1, symbolic v1-v2 |
| R4 | compact-bar v0 through compact v13, compact-json v1, symbolic v1-v2 |
| V1-V3 | compact-json v1, symbolic v2, compact v4-v9 |
| V4 | all provider-bearing packages |
| X1 | compact v10 draft |
| X2 | compact-json v1, compact v7-v14 |
| X3 | compact v9-v14 |
| X4 | compact v12 |
| X5 | compact-bar v0, symbolic v1-v2, compact v2-v6, compact v10 recovery |
| X6 | symbolic v2, compact v4-v14, compact-json v1 |

## Package audit and remaining authority

| Package | Classification | Remaining authority and comparability limit |
|---|---|---|
| compact-bar v0 | historical-limit | Fixed-corpus capability, compact size, opaque IDs, and compiler-backed edit evidence. It does not isolate syntax or select a public format. |
| symbolic-format v1 | historical-limit | Exact v1 shorthand and paired provider deficits only. It is not a v0 replication. Spend is a lower bound. |
| compact-format v2 | historical-limit | Its frozen `do-not-select` applies to its flawed protocol. Repaired post-hoc scores cannot reverse it. |
| compact-format v3 | historical-limit | Repaired measurement and the operational stop are valid. The incomplete run has no three-provider format authority. |
| compact-json v1 | historical-limit | Tuple MIDI won its own frozen holdout. The later full matrix supersedes it for product selection. |
| symbolic-format v2 | historical-limit | Its public-format result remains `block`. The stopped-run cost and two unavailable Gemini rows limit totals. Its current freshness self-test is time-variant. |
| compact-format v4 | historical-limit | Contract-repair calibration only. Hidden output context invalidates its provider comparison. |
| compact-format v5 | historical-limit | Output context repair and task eligibility only. Analysis stayed at a provider ceiling. |
| compact-format v6 | historical-limit | Gemini analysis difficulty evidence only. Sonnet stayed at a ceiling. |
| compact-format v7 | historical-limit | Declared Haiku substitution only. Output-limit failures make the run incomplete. |
| compact-format v8 | design-choice | Valid fresh Haiku repair. It is not one paired three-provider cohort. |
| compact-format v9 | design-choice | Valid OpenAI supplement. It cannot reopen the completed calibration decision. |
| compact-format v10 | historical-limit | Cost, state, and paired-run machinery remain useful. Prompt defects and unstable samples make format evidence inconclusive. Its reserved holdout is retired. |
| compact-format v11 | historical-limit | Reused-case prompt diagnostic only. It validates repairs but is not a fresh effect estimate. |
| compact-format v12 | historical-limit | Supports `FIELDS` over positional v1 and reliable serialization. It does not prove exact parity. Progression is not a discriminator. Its freshness self-test now includes v13 descendants. |
| compact-format v13 | historical-limit | Strong repeated local-binding evidence on four post-hoc Gemini cases. It is not cross-provider or fresh-family evidence. |
| compact-format v14 | design-choice | Frozen corrected package and fresh holdout plan. It has no provider result until separately approved and run. |

## Completed hardening audit

The hardening session completed these actions:

1. audited E137 through E177 and all packages through v13;
2. added affected versions, closure rules, and historical limits;
3. froze three explicit complete-prompt-package and size estimands;
4. added visibility, mutation, aggregation, cost, preflight, and state tests;
5. separated structural parse, canonical form, semantics, components, state,
   variation, and denominators;
6. froze balanced schedules, two repeats, effective settings, exact cost, and
   accurate progress fields;
7. retired and replaced the old reserved holdout;
8. created compact-format v14; and
9. froze the corrected package before any provider approval or call.

Do not rerun historical provider cohorts. Use their outputs as adversarial
regression fixtures where licensing and retained payloads permit it.
