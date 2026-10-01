---
title: Current state
kind: status
state: active
updated: 2026-09-30
phase: phase-8-agent-native-live-engine
session: phase8c4f-adjudicated-score-integration
---

# Now

[The adjudicated assessment](evidence/experiments/e213-audit-adjudications-update-native-composite-scoring.md)
is complete. It integrates the 240 unique note-output adjudications into
notation scores for both conditions. It keeps 48 unique analysis scores
unchanged and excludes 96 sentinel repeats. All 48 paired cells were recomputed.
Across all six families, component accuracy is 75.22 percent native and 73.11
percent composite. Prompt means are 69.83 and 67.86 percent. Strict successes
are 31/144 and 33/144. The new assessment hash is
`bc4f59c80ce41c2aa25dc1901f009cea67b5e2a87a7b8e075731d1c6b8263b14`.

[The full grammar audit](evidence/experiments/e212-full-grammar-audit-measures-native-composite-asymmetries.md)
remains the judgment source. Detailed manual reviews were targeted; cohort
decoding also used tools. It excludes analysis and sentinel repeats. Its
note-only ratios are 76.54 percent native and 71.36 percent composite notation.
Composite ledgers give 91.33 percent. Only 38/120 notation bodies agree with
their ledgers. Agent grammar judgments are score inputs, not a new full parser.

[The diagnostic](plan/phase-8/8c4f-native-versus-composite-diagnostic.md)
remains complete with OpenAI and Gemini. Each has 192 scored calls. Claude
results were removed by operator decision. No recovery is planned.
[E211](evidence/experiments/e211-native-composite-diagnostic-closes-with-two-providers.md)
retains the frozen assessment and expense accounting. Its assessment hash
remains `e473b5a556cbfab22a48ae3c2abb806cfdf28ee112f40411beb06ecae0b608ba`.
Retained results cost USD 2.52608325. Total incurred cost is USD 2.87742225,
including the discarded Claude attempt. The audit made no provider call.

[The corrected eight-arm matrix](evidence/experiments/e209-offline-score-repair-updates-eight-arm-matrix.md)
remains baseline context. Do not pool its different component denominators
with the diagnostic or the manual audit.

## Immediate work

1. Review the matrix, adjudicated report, and original profile results. Make
   the product format decision. Keep judgment limits visible. Report notation
   accuracy, ledger accuracy, profile compliance, and agreement separately.
2. Use that decision to prepare Phase 8f contracts and acceptance criteria.
3. Keep the cache, `normal-v1`, and live Bitwig projects unchanged.

The product format choice and Phase 8f remain pending operator review.

## Retrospective

Store adjudicated note values as score inputs. Version the revised policy
and assessment separately from frozen observations. A later parser can check
the judgments without another provider run.
