---
title: Offline score repair updates the eight-arm matrix
kind: evidence
state: pending
updated: 2026-09-30
phase: phase-8-agent-native-live-engine
session: phase8c4f-corrected-matrix-assessment
---

# E209: Offline score repair updates the eight-arm matrix

The [sample audit](e208-complete-matrix-audit-finds-reusable-measurement-repairs.md)
found primary measurement defects. The new
[`corrected_assessment.py`](../../../brain/benchmarks/symbolic-format-v5/corrected_assessment.py)
rescores the retained responses. The original provider manifests, frozen
scorer, and frozen aggregate remain unchanged.

The corrected assessment retains 592 OpenAI scores, 592 Gemini scores, and 589
Claude scores. Claude's three output-limit outcomes remain outside musical
denominators. Exact measured cost remains USD 15.72944325.
It recovers nine compact responses. Three unrecovered zero-note constraint
responses receive no musical credit. The required lead voice passes in 169 of
189 scored melody responses.

## Score policy

- Match each expected note to at most one actual note by voice, start,
  duration, pitch, and velocity. Pair exact musical tuples first. Resolve
  remaining pairs by maximum field agreement. Use ID only to break ties.
- Score those five fields as primary musical components. Report whether the
  expected IDs stayed bound to their notes as a separate diagnostic.
- Recover complete six-field compact `N` rows when metadata prevents the
  adapter from returning notes. Keep the frozen structure and canonical
  judgments. Do not infer undeclared bar-relative coordinates.
- Give no constraint credit when no notes are recovered.
- Score the requested `lead` voice in melody tasks. Keep the previous
  whole-number-onset harmony check as a diagnostic because `strong beat` was
  not defined precisely in the prompt.
- Keep the frozen response, structure, and canonical diagnostics. For public
  formats, structure means conformance to the pinned interchange subset.

## Updated musical component accuracy

| Format | OpenAI | Gemini | Claude | Pooled |
|---|---:|---:|---:|---:|
| Compact `FIELDS` | 97.31% | 98.27% | 97.84% | 97.81% |
| Compact local labels | 97.61% | 96.42% | 97.65% | 97.23% |
| Exact JSON | 97.96% | 98.85% | 97.77% | 98.19% |
| ABC composite | 95.46% | 97.73% | 92.59% | 95.26% |
| Strudel composite | 95.07% | 97.42% | 97.58% | 96.69% |
| LilyPond composite | 94.11% | 98.11% | 97.14% | 96.46% |
| MusicXML composite | 92.99% | 97.27% | 94.52% | 94.93% |
| MIDI-like profile | 97.58% | 98.58% | 98.15% | 98.10% |
| **All formats** | **96.01%** | **97.83%** | **96.66%** | **96.83%** |

The pooled primary order starts with exact JSON and MIDI-like. Compact
`FIELDS` follows. These are close component ratios on the current task suite.
The public-format arms are composite, and their lower subset-conformance
rates remain relevant to a product choice. Report provider and family cells
before treating a pooled difference as a general format effect.

The assessment JSON contains provider, format, and family aggregates, prompt
mean accuracy, response diagnostics, ID preservation, lead voice, recovered
row counts, and legacy onset harmony. Its hash is
`b2bcacdb567e0575f2983aea3e7d3ed914163a6115235f1c6e9c21761493ecad`.
The frozen assessment hash remains
`afcff5eca3d1938c2e34c2a5b5a5d79bb18390b284d44b9fe0f970a7a7ce1d5e`.

## Verification

The corrected assessment recomputes and compares the full frozen assessment
before scoring. It verifies every source manifest hash and scheduled task
identity. Six focused tests cover renamed IDs, a partial note error, exact
compact-row recovery, zero-note constraints, lead voice, and preservation of
all frozen diagnostics across the 1,773 scored rows.

The following checks pass from `brain/`:

```sh
npm run benchmark:symbolic-format-v5
npm run benchmark:symbolic-format-v5-corrected-test
npm run benchmark:symbolic-format-v5-corrected
```

No provider call was made. The incomplete r9 read can still add an unknown
provider-side charge outside measured usage.

## Retrospective

The repaired assessment leaves the frozen observations intact. This makes a
score policy change reviewable without another run. Keep this pattern for later
benchmark measurement repairs.
