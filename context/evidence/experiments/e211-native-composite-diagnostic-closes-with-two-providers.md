---
title: Native versus composite diagnostic closes with two providers
kind: evidence
state: pending
updated: 2026-09-30
phase: phase-8-agent-native-live-engine
session: phase8c4f-native-composite-closeout
---

# E211: Native versus composite diagnostic closes with two providers

The operator approved the exact [E210 package](e210-native-composite-diagnostic-awaits-approval.md),
then chose to skip Claude and remove its diagnostic results. This decision
closes the diagnostic with OpenAI and Gemini. No Claude recovery is planned.
No retry, repair, or continuation call was made.

The original [approval](../../../brain/benchmarks/native-composite-v1/runs/diagnostic-r1-approval.json),
frozen plan, and provider attempt records remain historical controls. The
approved code, prompts, task cohort, and score policy remain unchanged.
Claude's new response manifest and mixed-provider intermediate audits were
removed at the operator's request. Prior matrix artifacts remain unchanged.

## Retained outcomes and cost

| Provider | Scored calls | Complete unique pairs | Exact USD |
|---|---:|---:|---:|
| OpenAI | 192 | 72 | 2.09721000 |
| Gemini | 192 | 72 | 0.42887325 |
| Retained total | 384 | 144 | 2.52608325 |

Both providers have complete outcomes, with no failed or unavailable calls.
Claude's discarded attempt incurred USD 0.35133900. Total incurred cost is
USD 2.87742225. The separate
[cost record](../../../brain/benchmarks/native-composite-v1/runs/2026-09-30-cost-accounting.json)
retains that expense and the exclusion decision. No failed cost reservation
remains. No additional provider call is authorized.

## Assessment

The [paired report](../../../brain/benchmarks/native-composite-v1/runs/2026-09-30-report.md)
contains all 48 retained provider, family, and format cells. The
[assessment](../../../brain/benchmarks/native-composite-v1/runs/2026-09-30-assessment.json)
hash is `e473b5a556cbfab22a48ae3c2abb806cfdf28ee112f40411beb06ecae0b608ba`.
Second sentinel observations do not enter the primary paired estimates.

Composite ledgers score higher in 38 cells. Native outputs score higher in
two cells; eight cells tie. The ledger advantage does not establish correct
notation. Across 60 unique composite note outputs per provider, notation
and ledger agree in 14 OpenAI outputs and 22 Gemini outputs. Native losses
include wrong musical values and syntax outside the pinned subsets.

Gemini native MusicXML progression scores 88.89 percent, versus 77.78 percent
for composite. OpenAI native MusicXML analysis scores 60.32 percent, versus
57.14 percent for composite. Each cell has three unique tasks. The report
retains the coarse paired bootstrap intervals and strict musical outcomes.

Each provider has 48 complete sentinel comparisons. OpenAI has 12 equal
component outcomes and five identical payloads. Gemini has 23 equal component
outcomes and 16 identical payloads. The
[usage record](../../../brain/benchmarks/native-composite-v1/runs/2026-09-30-usage.json)
reports tokens, costs, latency, and payload bytes by provider and condition.

The corrected matrix hash remains
`b2bcacdb567e0575f2983aea3e7d3ed914163a6115235f1c6e9c21761493ecad`.
Its provider and family cells remain baseline context. Do not pool the two
runs or subtract their different component ratios. This diagnostic does not
establish full native-format capability or provider training familiarity.
The operator accepted two-provider coverage. Product format choice and
Phase 8f remain subject to operator review.

## Audit and verification

The [audit packets](../../../brain/benchmarks/native-composite-v1/runs/2026-09-30-audit-packets.json)
select one complete pair in each retained provider, family, and format cell.
They select the largest accuracy difference, then the lower accuracy and
earliest variant. This is a defect sample, not an error-rate estimate.

The [manual record](../../../brain/benchmarks/native-composite-v1/runs/2026-09-30-manual-audit.json)
covers all 48 cells. Direct checks confirm representative timing, pitch,
chord, range, and syntax errors. No scorer defect was found in this sample.
Independent full-pass checks agree with the frozen scorer in all 96 selected
outputs. The [offline observer](../../../brain/benchmarks/native-composite-v1/audit_results.py)
verifies both retained manifests, request identity, progress, and exact cost
sums. Its direct contract checks pass on all 15 reference note tasks.

This audit used the frozen notation profiles. The later
[full grammar audit](e212-full-grammar-audit-measures-native-composite-asymmetries.md)
reads public syntax and quantifies both scoring asymmetries. It retains its
manual sensitivity results separately from this assessment.

Fourteen focused tests pass. The complete brain check passes typecheck and
all 1,206 tests. Frozen package, context, artifact hash, and diff checks pass.
The cache, `normal-v1`, and live Bitwig projects remain unchanged.

## Retrospective

Keep provider exclusion separate from expense accounting. Remove discarded
response copies from intermediate audits as well as the primary manifest.
