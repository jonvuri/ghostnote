# Phase 8c4b OpenAI analysis supplement r6 report

## Verdict

Return `add-openai-third-provider`. OpenAI scored all five unique initial tasks
and passed one. Its 0.20 rate is the inclusive lower eligibility boundary.

Gemini, Haiku, and OpenAI are now eligible on the repaired analysis
measurement. R6 does not change the completed Phase 8c4b
`proceed-development` decision and does not select a format. Phase 8c4c can
resume offline preparation for these three provider tiers.

## Frozen run

- Run ID: `phase8c4b-analysis-openai-supplement-r6`
- Protocol SHA-256:
  `f00d4f61275d3832887fc0e9574d4eff2f18092412602780a103fbc0a57e9903`
- Run-plan SHA-256:
  `ca7a9510f6e4172137f039a4031b6f07e7dff460c5a07a9a8127ab52635c4ca1`
- Reused r5 corpus SHA-256:
  `1b056340b189b8a5fbef255bed783c1fe4dd706a266593abb12d9fbfdf7b599b`
- Summary SHA-256:
  `86a23a942b0c943c2308e9c0035be88f85113c7c235c0370a074e0deab6fb0f2`

The operator approved at most 12 OpenAI requests and USD 0.738000. The run
made 11 requests and cost USD 0.047251 from API-reported token use. The
requested and returned model was `gpt-5.4-mini-2026-03-17`. No transport retry
occurred. No Gemini, Haiku, or Sonnet call occurred.

## Initial result

Only the five unique initial tasks enter the gate.

| Provider | Passed | Scored | Complete | Eligible | Result |
|---|---:|---:|---:|---:|---|
| OpenAI | 1 | 5/5 | yes | yes | informative |
| Gemini | 3 | 5/5 | yes | yes | retained |
| Haiku | 1 | 5/5 | yes | yes | retained |

OpenAI variant 2 passed. Variant 1 failed motif relation. Variant 3 failed
rhythm class. Variant 4 failed chord function, chord quality, and rhythm
class. Variant 5 failed rhythm class. All initial responses parsed. No result
was unavailable or failed.

## Component resolution

Counts show passing OpenAI unique initial tasks out of five.

| Component | Passed |
|---|---:|
| Chord identity | 5 |
| Root pitch class | 5 |
| Bass pitch class | 5 |
| Chord quality | 4 |
| Inversion number | 5 |
| Chord function | 4 |
| Motif relation | 4 |
| Rhythm class | 2 |

Five initial failures received one repair. The unique variant 1 repair passed.
The other four repairs remained musical-contract failures. Repairs stay
outside the initial numerator and denominator.

## Sentinel

The variant 1 unique task and named sentinel used the same prompt hash. Both
returned the exact same initial payload and failed only motif relation. The
repeated-prompt result was stable.

## Usage and cost guard

| Calls | Input tokens | Cached input | Output tokens | Reasoning tokens | Mean latency | Cost |
|---:|---:|---:|---:|---:|---:|---:|
| 11 | 14,611 | 2,560 | 8,449 | 7,459 | 7.923 s | USD 0.047251 |

The largest request used 5,909 serialized bytes, 1,632 input tokens, and 1,760
output tokens. Every response stopped normally. The run used 6.4 percent of
the approved cost ceiling.

The unrounded sum of the per-call API records is USD 0.04725075. The manifest
rounds this to USD 0.047251, and the guard's committed total matches. Its
separately rounded settled counter is USD 0.047249, a USD 0.000002 iterative
rounding difference. This does not affect request authorization, the retained
API records, or the gate. A later harness must aggregate exact line items once
instead of rounding the running settled total.

The operator owns the separate provider-dashboard comparison.

## Retained hashes

| Provider | Manifest SHA-256 | Raw-run SHA-256 |
|---|---|---|
| OpenAI | `1ef50f195f33bcd87349cf68cd03ead2cf82134a7271db7a5b914df37207cf57` | `564a99683a03ebf0156d9e3bf6a1d7b4a9411e5bbb0388feb12f7324deeb1784` |
| Gemini | `4931455793fa10ff25c7e541354328bbff342003d6fe51d99752e175bc663ef7` | `b4cf34804b322f7c6c1bbb508e357b291a100850e88797f6eda0761df6a96d4a` |
| Haiku | `7b2933d28a54d27635adc85b05839bb987460a46ae92e2dedd8805d26d63f1b1` | `d908d4ca992512ddff139dea179b8739b3572d1f14c6a7dc1fc19f08cda67af1` |

OpenAI and Haiku use identical fixtures. Gemini uses the matched-difficulty r3
cohort. Do not pool the three scores as one identical-fixture estimate.

## Consequence

Record OpenAI as the third eligible analysis provider. Phase 8c4c can prepare
a fresh paired development package for OpenAI, Gemini, and Haiku. Calibration
fixtures remain excluded from the development effect estimate. No Phase 8c4c
provider request is approved.
