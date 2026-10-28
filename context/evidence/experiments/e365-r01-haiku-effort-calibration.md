---
title: E365 — R01 Haiku 5.5 effort calibration against Luna low
kind: evidence
state: done
updated: 2026-10-26
owner: R01
---

# E365 — R01 Haiku 5.5 effort calibration against Luna low

Date: 2026-10-26. Stage: development calibration.

## Result

Under [D57](../../../spec/r01-research/decisions/d57-r01-natural-token-use.md), the Haiku 5.5 cohort
uses **`--effort low`**. It is the lowest effort Claude Code 2.1.302 accepts
(`low`, `medium`, `high`, `xhigh`, `max`), and it already generates more than
the reference. On 38 matched development cells, Luna `low` generated a median of
**65.5** tokens, while Haiku `low` generated a median of **401.5**, or **6.1×**
Luna's median. The median of per-cell ratios is 6.3×. Luna reported **zero
reasoning tokens on all 38 cells**, while Haiku reasoned on 36. The answer
portions are close: excluding reasoning, the median paired Haiku/Luna ratio is
1.34×, consistent with tokenizer differences. The remaining gap is therefore
Haiku's adaptive thinking, which no supported effort setting removes. Higher
Haiku settings were not run, because they cannot narrow the gap. This
record reports the gap, as D57 requires; it does not claim equal compute.

## Method

The [calibration runner](../../../brain/benchmarks/r01-candidates/cli-effort-calibration.mjs)
selects one fixed cell set from the E358 development package and makes only
fresh initial submissions, with no corrections. The set contains every task
and every family, primary arms only. Each of the eight performed tasks with all
six arms alternates between the first and second halves of the sorted arm list.
Each other task uses every eligible primary arm. The result has 38 cells:
C3 and C4 FIELDS 10 each, Producer Pal bar|beat and MIDI JSON 5 each, and
Ghostnote FIELDS and JSON 4 each. Families are comprehension 8, individual edit
8, refusal 9, preservation 5, authoring 3, count change 3 and group transform 2.
Cells run in seeded order (`r01-effort-calibration-v1`), and each cell runs both
configurations back to back in seeded order. Each submission uses the normal
admitted invocation, passes the cohort's control audit before scoring, and has
a 120-second timeout. A control failure would halt the run.

Generated tokens are the reported `output_tokens`, which include reasoning for
both providers. Reasoning is also reported separately (Claude `thinking_tokens`,
Codex `reasoning_output_tokens`). Because Luna reported no reasoning, whether
Codex output includes reasoning does not affect this comparison. Correctness was
recorded but not used to choose the setting.

## Observations

All 76 submissions passed admission, with no retry, fallback or tool use.

| Measure (38 cells each) | Luna low | Haiku low |
|---|---:|---:|
| Generated tokens: median (p25–p75) | 65.5 (14–209) | 401.5 (148–754) |
| Generated tokens: min / max | 8 / 3,073 | 12 / 7,715 |
| Reasoning tokens: median; cells with any | 0; 0 | 149; 36 |
| Answer tokens (generated − reasoning): median | 65.5 | 81 |
| Total generated | 10,859 | 33,380 |
| Total input (uncached + cache) | 160,032 | 98,049 |
| Elapsed median | 3.8 s | 3.4 s |
| Passing answers (recorded only) | 32 | 36 |

Median generated tokens by family (Luna / Haiku):

| Family | Luna low | Haiku low |
|---|---:|---:|
| Refusal | 9 | 60 |
| Comprehension | 16 | 414.5 |
| Count change | 57 | 292 |
| Constrained authoring | 170 | 399 |
| Group transform | 204.5 | 1,231.5 |
| Individual edit | 258 | 621.5 |
| Preservation | 1,772 | 2,191 |

The ratio is largest where Luna answers directly and Haiku thinks first, such
as comprehension and refusals. It is smallest where answers are long, such as
preservation. Haiku's maximum is 7,715 tokens, of which 7,459 were reasoning,
on `edit-onset-drums` / Producer Pal bar|beat. Luna's input is larger because
its fixed client context includes four tool declarations; per D57, input is
not used for calibration. Pass counts come from one repetition and support no
model or format comparison.

## Verification and artifacts

**197 focused tests pass** ([output](../data/r01-effort-calibration/verification.txt)),
including five new calibration tests. They cover fixed cell coverage and arm
balance, a deterministic schedule matched across configurations, configurations
that differ only in effort, token extraction without double counting, and
summaries that exclude unadmitted submissions. The draft-2 pilot manifest was
regenerated with the chosen setting; E364's manifest retains the earlier hash.

The [manifest](../data/r01-effort-calibration/manifest.json) pins sources and
artifacts. The [plan, preflight and results](../data/r01-effort-calibration/phase-1/)
include each attempt's raw capture and audit. Raw captures contain account context.

```sh
node --import tsx benchmarks/r01-candidates/cli-effort-calibration.mjs PINNED_PP NEW_DIRECTORY codex-low,claude-low
```

## Limits

This is one repetition on development material. It calibrates resource use and
does not compare the models' capability. Any further reduction in Haiku's
generated tokens would require a change outside D57's effort-only procedure, such
as a different Luna effort or thinking control. Such a change would require an operator decision.
Freeze the setting before the rigorous stage and repeat the gap report there.
