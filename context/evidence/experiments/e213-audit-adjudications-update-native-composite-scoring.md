---
title: Audit adjudications update native and composite scoring
kind: evidence
state: pending
updated: 2026-09-30
phase: phase-8-agent-native-live-engine
session: phase8c4f-adjudicated-score-integration
---

# E213: Audit adjudications update scoring

The operator requested integration of the
[E212 audit](e212-full-grammar-audit-measures-native-composite-asymmetries.md)
into scoring. The signed
[adjudicated assessment](../../../brain/benchmarks/native-composite-v1/audits/adjudicated-assessment.json)
and [report](../../../brain/benchmarks/native-composite-v1/audits/adjudicated-report.md)
now implement that request. This work made no provider call.

## Coverage and policy

The full grammar audit examined 240 unique note outputs. Detailed manual
contract reviews were targeted. The cohort also had tool-assisted decoding
and grammar checks. This does not mean that all 384 retained API calls had
the same deep manual review. Analysis answers and second sentinel observations
were outside that audit.

The new [policy](../../../brain/benchmarks/native-composite-v1/audits/adjudication-policy.json)
uses audited notation values as the primary musical input for both native
and composite note tasks. The deterministic musical rubric scores those
values. Composite ledger credit and original subset profile compliance remain
separate fields. This is a change to the score input, not a new public grammar
parser or a claim of automatic grammar validation.

The assessment has 288 unique outputs and 144 complete pairs:

- 240 note outputs use retained audit adjudications.
- 48 analysis answers retain their original deterministic scores.
- 96 second sentinel observations are excluded. The original repeat report
  remains available. No adjudicated repeat-stability result is inferred.

Invalid or incomplete complete-document decodes receive zero musical credit.
Known fragments and repairs receive no credit. The existing musical rubric,
including the role partial-credit caveat, remains unchanged. Bootstrap sampling
uses the frozen method. Exact fractions prevent roundoff from creating a false
win in a tied cell. The intervals condition on the adjudications; they do not
measure agent judgment error.

Strudel adjudications used the pinned official runtime. MusicXML used the
official XSD and independent event decoding. ABC and LilyPond use agent grammar
interpretation without compiler validation. These are retained-case judgments.
A later deterministic parser can check them without another provider run.

## Updated results

Component ratios weight components. Prompt means weight prompts equally.
Each condition has 120 note outputs and 24 analysis answers.

| Scope | Native components | Composite components | Native prompt mean | Composite prompt mean | Native strict | Composite strict |
|---|---:|---:|---:|---:|---:|---:|
| Five note-output families | 2039/2664 (76.54%) | 1901/2664 (71.36%) | 70.15% | 64.96% | 31/120 | 25/120 |
| Unchanged analysis | 344/504 (68.25%) | 415/504 (82.34%) | 68.25% | 82.34% | 0/24 | 8/24 |
| All six families | 2383/3168 (75.22%) | 2316/3168 (73.11%) | 69.83% | 67.86% | 31/144 | 33/144 |

All 48 provider/family/format paired cells were recomputed. Native scores higher
in 21 cells, composite in 18, and nine tie. The analysis advantage in several
composite cells remains. The full diagnostic result differs from the note-only
audit result. The report retains three-prompt paired intervals and strict wins.

Composite note ledgers retain 2433/2664 components (91.33%) and 50/120 strict
successes. Their notation has 25/120 strict successes and 38/120 exact ledger
agreements. Keep these channels separate in the product format decision.

## Provenance and verification

The assessment hash is
`bc4f59c80ce41c2aa25dc1901f009cea67b5e2a87a7b8e075731d1c6b8263b14`.
The policy hash is
`0343c517f5e4750eb6ac13f4689f05ef328c36544d0e88d36becdcf4563829cf`.
Each revised record retains the source manifest, task, prompt, payload, audit
artifact, and case identity. It includes recomputed component checks and the
original component score and profile flags.

The [generator](../../../brain/benchmarks/native-composite-v1/audits/adjudicated_assessment.py)
verifies audit signatures, exact coverage, original score reproduction, and
all eight audit totals. Its `--check` mode reproduces the policy, assessment,
and report. Five focused tests cover unchanged analysis, sentinel exclusion,
profile recovery, ledger isolation, invalid fragments, tampered policy hashes,
and exact tied-cell classification. Artifact reproduction, frozen package,
context link, and diff checks pass.

The original diagnostic assessment hash remains
`e473b5a556cbfab22a48ae3c2abb806cfdf28ee112f40411beb06ecae0b608ba`.
Signed audit records and frozen code, prompts, responses, and original scores
remain unchanged.
Expense accounting remains unchanged. The cache, `normal-v1`, and live projects
remain unchanged. No provider request is part of the revised assessment.

## Handoff and retrospective

Use the adjudicated report with its judgment limits for the product format
decision. Keep the original profile result and separate ledger result visible.
Phase 8f remains pending operator review.

Store adjudicated note values as score inputs. Version the revised policy and
assessment separately from frozen observations. This permits deterministic
grammar validation later, with no provider rerun.
