---
title: E193 — V18 sampled audit validates the run and finds a transfer flaw
kind: evidence
state: active
updated: 2026-09-29
parent: ../../plan/phase-8/8c4d-follow-up-v18-low-effort-rehearsal.md
---

# E193 — V18 sampled audit validates the run and finds a transfer flaw

## Verdict

Three independent read-only audits inspected complete v18 tasks, prompts,
references, provider responses, parsed scores, and aggregates. They found no
defect in the completed experiment. The run is operationally valid development
evidence.

The frozen summary contains `decision: invalid` because the protocol encoded
90 percent structural validity as a minimum. The operator clarified that 90
percent was a maximum task-performance target and lower performance was
acceptable. A completed malformed answer is a measured model outcome. It does
not make the experiment invalid.

Keep the frozen summary unchanged for auditability. Do not use its automated
decision field as the scientific verdict.

## Sampled analysis review

The audit inspected seven complete analysis responses across both strata and
all three formats.

| Sample | Review result |
|---|---|
| Elemental v402, all formats | The chord is unambiguous. Scores ranged from 4/8 through 8/8 because of model variation. |
| Stress v409, `FIELDS` and JSON | The same valid task scored 24/24 and 13/24. The gap matches response errors. |
| Stress v410, `FIELDS` | The response omitted `motif_relations`. The scorer retained all 24 components and marked the missing values incorrect. |
| Stress v410, local labels | All fields were present, but two were out of canonical order. Structural and canonical scores stayed separate. |

The audit found no prompt ambiguity, leaked answer, bad reference, bad chord
key, parser defect, or component-accounting error. Analysis prompts use common
JSON for motif arrays and chord-group IDs in every arm. The format contrast
therefore comes mainly from reading the note document. Treat motif differences
as task reasoning, not a clean input-format effect.

## Sampled affine review

The audit inspected nine complete affine responses across both strata and all
three formats. It also recomputed all 30 affine references with exact fraction
arithmetic and rescored all 30 retained payloads. Every reference and score
matched.

The sampled errors were genuine model outcomes:

- correct notes in a noncanonical rational-start order;
- output IDs attached after sorting instead of in canonical source order;
- wrong affine start or duration arithmetic; and
- copying the input source ID instead of the required output source ID.

The prompts state the formula, source-bound ID rule, per-voice anchor rule, and
canonical sort. No formula, reference, parser, or scorer flaw was found.

## Transfer flaw

The five stress-affine fixtures are distinct within v18. Their musical values
and voice rules depend only on the local fixture index. They do not depend on
the cohort seed or variant offset. The two serialization controls inherit this
content.

Changing cohort and IDs can therefore reproduce the same tasks in 8c4e. The
current semantic hash includes synthetic source and output IDs, so new IDs can
hide this content reuse from the freshness audit.

The audit generated two comparison cohorts. A new seed with the same offset
overlapped 5/10 official affine semantic hashes. A new seed and offset had zero
official overlap but still overlapped 5/10 ID-free affine content hashes. Those
five overlaps were all stress fixtures. Serialization had zero official
overlap after the offset change but overlapped 2/2 ID-free content hashes.
Elemental affine content changed with the seed and did not have this defect.

This flaw does not invalidate the v18 run. It blocks unchanged reuse of the
v18 suite for a fresh confirmatory cohort.

Before 8c4e freezes its cohort:

1. Make affine musical values and rules depend on the new seed.
2. Add an ID-free content hash for affine and serialization tasks.
3. Check internal and historical overlap with that hash.
4. Keep the frozen v18 package unchanged.

## Other limits

Elemental affine tasks have one global rule, but some inherited rhythmic
factors produce denominators as high as 16. Call them lower-complexity affine
tasks, not pure format isolation. Literal serialization is the pure format
control.

Five prompts and one sample per cell provide calibration signals only. They do
not support a causal format ranking.

## Recommendation

Close v18 as valid development evidence. Stress analysis is calibrated at the
90 percent maximum target. Stress affine remains above that target for both
compact formats, but its canonical failures still provide conformance signal.

Do not rerun v18. Repair affine freshness and decision semantics while building
the fresh 8c4e package.
