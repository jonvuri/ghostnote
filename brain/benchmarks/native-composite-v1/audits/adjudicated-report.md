# Native versus composite: adjudicated assessment

This assessment integrates the retained full grammar audit into notation scoring.
On note tasks, both conditions use notation as the primary musical score. Composite ledger
scores and original profile compliance remain separate. Original results remain
unchanged. This is a post hoc adjudicated assessment, with no new provider call.

## Coverage and judgment limits

All 240 unique note outputs have retained audit decisions. Complete decodes retain
independent note values. Detailed manual reviews were targeted. Decoding used tools: the
pinned Strudel 1.2 runtime and MusicXML 4.0 XSD. ABC and LilyPond judgments have
no compiler certificate. Agent judgment can be wrong. The deterministic musical
rubric scores these retained values; it does not establish their grammar correctness.

The 48 unique analysis answers keep their original deterministic scores. The 96
second sentinel observations are excluded. Their original report remains available.
The assessment has 144 complete unique pairs across 48 provider/family/format cells.

Invalid or incomplete complete-document decodes receive zero credit. Known fragments
and repairs receive no credit. The role rubric still has its documented empty-onset
harmony caveat. Profile requirements remain visible even when wider grammar recovers music.

## Aggregates

Component ratios weight components. Prompt means weight each prompt equally.
Analysis answers and notation tasks have different observation surfaces.

| Scope | Native components | Composite components | Native prompt mean | Composite prompt mean | Native strict | Composite strict |
|---|---:|---:|---:|---:|---:|---:|
| Five note-output families | 2039/2664 (76.54%) | 1901/2664 (71.36%) | 70.15% | 64.96% | 31/120 | 25/120 |
| Unchanged analysis | 344/504 (68.25%) | 415/504 (82.34%) | 68.25% | 82.34% | 0/24 | 8/24 |
| All six families | 2383/3168 (75.22%) | 2316/3168 (73.11%) | 69.83% | 67.86% | 31/144 | 33/144 |

Across all 48 cells, native scores higher in 21, composite in 18, and 9 tie.
The analysis advantage in several composite cells remains. Those judgments were
not part of the notation audit. The five-family audit result is not the six-family result.

## Paired cells

Differences are native minus composite prompt means. Each cell has three task
pairs. The bootstrap interval uses the frozen method and conditions on the audit
judgments. It does not quantify adjudication error. Coarse or zero-width intervals
do not establish equivalence.

### gemini

| Format | Family | Native % | Composite % | Difference pp | Bootstrap 95% pp | Native strict | Composite strict |
|---|---|---:|---:|---:|---|---:|---:|
| abc-2.1 | comprehension-analysis | 73.02 | 88.89 | -15.87 | -23.81 to -4.76 | 0/3 | 1/3 |
| abc-2.1 | comprehension-structure | 100.00 | 100.00 | +0.00 | +0.00 to +0.00 | 3/3 | 3/3 |
| abc-2.1 | continuation-motif | 43.43 | 29.29 | +14.14 | -24.24 to +48.48 | 0/3 | 0/3 |
| abc-2.1 | continuation-roles | 63.33 | 66.67 | -3.33 | -10.00 to +10.00 | 0/3 | 0/3 |
| abc-2.1 | generation-melody | 80.95 | 76.19 | +4.76 | -14.29 to +28.57 | 0/3 | 0/3 |
| abc-2.1 | generation-progression | 8.33 | 5.56 | +2.78 | +0.00 to +8.33 | 0/3 | 0/3 |
| lilypond-2.24.4 | comprehension-analysis | 88.89 | 98.41 | -9.52 | -19.05 to -4.76 | 0/3 | 2/3 |
| lilypond-2.24.4 | comprehension-structure | 100.00 | 100.00 | +0.00 | +0.00 to +0.00 | 3/3 | 3/3 |
| lilypond-2.24.4 | continuation-motif | 68.69 | 76.77 | -8.08 | -30.30 to +9.09 | 0/3 | 0/3 |
| lilypond-2.24.4 | continuation-roles | 86.67 | 93.33 | -6.67 | -20.00 to +0.00 | 0/3 | 1/3 |
| lilypond-2.24.4 | generation-melody | 71.43 | 76.19 | -4.76 | -14.29 to +0.00 | 0/3 | 0/3 |
| lilypond-2.24.4 | generation-progression | 75.00 | 52.78 | +22.22 | -8.33 to +66.67 | 0/3 | 0/3 |
| musicxml-4.0 | comprehension-analysis | 92.06 | 100.00 | -7.94 | -14.29 to -4.76 | 0/3 | 3/3 |
| musicxml-4.0 | comprehension-structure | 100.00 | 100.00 | +0.00 | +0.00 to +0.00 | 3/3 | 3/3 |
| musicxml-4.0 | continuation-motif | 71.72 | 71.72 | +0.00 | -15.15 to +15.15 | 0/3 | 0/3 |
| musicxml-4.0 | continuation-roles | 93.33 | 96.67 | -3.33 | -10.00 to +0.00 | 2/3 | 2/3 |
| musicxml-4.0 | generation-melody | 76.19 | 61.90 | +14.29 | +14.29 to +14.29 | 0/3 | 0/3 |
| musicxml-4.0 | generation-progression | 88.89 | 77.78 | +11.11 | +0.00 to +16.67 | 1/3 | 0/3 |
| strudel-v1.2 | comprehension-analysis | 76.19 | 95.24 | -19.05 | -28.57 to -9.52 | 0/3 | 2/3 |
| strudel-v1.2 | comprehension-structure | 100.00 | 100.00 | +0.00 | +0.00 to +0.00 | 3/3 | 3/3 |
| strudel-v1.2 | continuation-motif | 33.33 | 39.39 | -6.06 | -15.15 to +3.03 | 0/3 | 0/3 |
| strudel-v1.2 | continuation-roles | 70.00 | 66.67 | +3.33 | -10.00 to +20.00 | 0/3 | 0/3 |
| strudel-v1.2 | generation-melody | 52.38 | 66.67 | -14.29 | -28.57 to +0.00 | 0/3 | 0/3 |
| strudel-v1.2 | generation-progression | 33.33 | 8.33 | +25.00 | +0.00 to +75.00 | 0/3 | 0/3 |

### openai

| Format | Family | Native % | Composite % | Difference pp | Bootstrap 95% pp | Native strict | Composite strict |
|---|---|---:|---:|---:|---|---:|---:|
| abc-2.1 | comprehension-analysis | 36.51 | 80.95 | -44.44 | -52.38 to -28.57 | 0/3 | 0/3 |
| abc-2.1 | comprehension-structure | 100.00 | 99.32 | +0.68 | +0.00 to +2.04 | 3/3 | 2/3 |
| abc-2.1 | continuation-motif | 66.67 | 42.42 | +24.24 | -3.03 to +60.61 | 0/3 | 0/3 |
| abc-2.1 | continuation-roles | 40.00 | 40.00 | +0.00 | -70.00 to +50.00 | 0/3 | 0/3 |
| abc-2.1 | generation-melody | 47.62 | 71.43 | -23.81 | -57.14 to +28.57 | 0/3 | 0/3 |
| abc-2.1 | generation-progression | 8.33 | 8.33 | +0.00 | +0.00 to +0.00 | 0/3 | 0/3 |
| lilypond-2.24.4 | comprehension-analysis | 53.97 | 58.73 | -4.76 | -14.29 to +4.76 | 0/3 | 0/3 |
| lilypond-2.24.4 | comprehension-structure | 100.00 | 97.96 | +2.04 | +0.00 to +6.12 | 3/3 | 2/3 |
| lilypond-2.24.4 | continuation-motif | 60.61 | 60.61 | +0.00 | -12.12 to +9.09 | 0/3 | 0/3 |
| lilypond-2.24.4 | continuation-roles | 80.00 | 86.67 | -6.67 | -30.00 to +10.00 | 0/3 | 1/3 |
| lilypond-2.24.4 | generation-melody | 85.71 | 76.19 | +9.52 | -14.29 to +42.86 | 1/3 | 0/3 |
| lilypond-2.24.4 | generation-progression | 72.22 | 77.78 | -5.56 | -8.33 to +0.00 | 0/3 | 0/3 |
| musicxml-4.0 | comprehension-analysis | 60.32 | 57.14 | +3.17 | -9.52 to +19.05 | 0/3 | 0/3 |
| musicxml-4.0 | comprehension-structure | 66.67 | 33.33 | +33.33 | +0.00 to +100.00 | 2/3 | 1/3 |
| musicxml-4.0 | continuation-motif | 67.68 | 58.59 | +9.09 | -21.21 to +24.24 | 0/3 | 0/3 |
| musicxml-4.0 | continuation-roles | 90.00 | 60.00 | +30.00 | -20.00 to +100.00 | 2/3 | 0/3 |
| musicxml-4.0 | generation-melody | 57.14 | 38.10 | +19.05 | +0.00 to +42.86 | 0/3 | 0/3 |
| musicxml-4.0 | generation-progression | 63.89 | 27.78 | +36.11 | -83.33 to +100.00 | 1/3 | 0/3 |
| strudel-v1.2 | comprehension-analysis | 65.08 | 79.37 | -14.29 | -38.10 to +0.00 | 0/3 | 0/3 |
| strudel-v1.2 | comprehension-structure | 100.00 | 100.00 | +0.00 | +0.00 to +0.00 | 3/3 | 3/3 |
| strudel-v1.2 | continuation-motif | 56.57 | 50.51 | +6.06 | +0.00 to +15.15 | 0/3 | 0/3 |
| strudel-v1.2 | continuation-roles | 76.67 | 63.33 | +13.33 | -10.00 to +40.00 | 0/3 | 0/3 |
| strudel-v1.2 | generation-melody | 71.43 | 76.19 | -4.76 | -71.43 to +42.86 | 1/3 | 1/3 |
| strudel-v1.2 | generation-progression | 77.78 | 63.89 | +13.89 | -8.33 to +58.33 | 0/3 | 0/3 |

## Ledger, profile, and provenance

The composite note ledgers retain 2433/2664 components (91.33%) and 50/120
strict musical successes. Audited composite notation has 25/120 strict successes.
Exact notation/ledger agreement is 38/120. These are distinct measurements.

Every assessment record links its source manifest, response payload, prompt, task,
audit artifact and case ID. It retains the original component score and subset
structural/canonical flags. The notation record includes adjudicated note values
and recomputed component checks. Analysis records retain their original score.

The generator checks audit signatures and original score reproduction. It enforces
exact coverage and verifies all eight audit totals. No audit judgment is inferred
for an unreviewed response. Runtime or compiler authority is stated per format.

Policy hash: `0343c517f5e4750eb6ac13f4689f05ef328c36544d0e88d36becdcf4563829cf`.
Assessment hash: `bc4f59c80ce41c2aa25dc1901f009cea67b5e2a87a7b8e075731d1c6b8263b14`.

- [Policy](adjudication-policy.json)
- [Assessment and per-response scores](adjudicated-assessment.json)
- [Audit synthesis](synthesis.md)
- [Original assessment](../runs/2026-09-30-assessment.json)
- [Original report](../runs/2026-09-30-report.md)

Run `python3 -B brain/benchmarks/native-composite-v1/audits/adjudicated_assessment.py --check`
from the repository root. This reproduces the policy, assessment, and report.

## Retrospective

Store audit note values as score inputs. Keep the original measurement, revised
policy, and revised assessment separate. This permits a later deterministic parser
to check adjudications without another provider run.
