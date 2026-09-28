# Phase 8c4b Haiku output-limit calibration r5 report

## Verdict

Return `analysis-repair-pass`. Haiku scored all five unique initial tasks and
passed one. Its 0.20 rate is the inclusive lower eligibility boundary. The
retained Gemini result remains complete and eligible at 3/5.

Combined with the retained r2 motif and progression gates, Phase 8c4b returns
`proceed-development`. This result does not select a format. Phase 8c4c can
start offline preparation, but it has no provider approval.

## Frozen run

- Run ID: `phase8c4b-analysis-haiku-calibration-r5`
- Protocol SHA-256:
  `eb547c673e5603f623c6962015dff3e78bebaabb0a505ca076ce55dd2fa395c9`
- Run-plan SHA-256:
  `01d95131dd2e22a45d815d42b6e64191eb085f99a90f82ebcb79822e0b5286ad`
- Fresh-cohort SHA-256:
  `1b056340b189b8a5fbef255bed783c1fe4dd706a266593abb12d9fbfdf7b599b`
- Summary SHA-256:
  `6849b0cb364fd596a3940ea107dbf54f282b2a1e22a4f138e5ec647b4ab55455`

The operator approved at most 12 Haiku message requests, 12 free token-count
requests, and USD 0.780000. The run made 10 message requests and 10 token-count
requests. It cost USD 0.158130. The requested and returned model names matched.
No transport retry occurred. No Gemini, OpenAI, or Sonnet call occurred.

## Initial result

Only the five unique initial tasks enter the gate.

| Provider | Passed | Scored | Complete | Eligible | Result |
|---|---:|---:|---:|---:|---|
| Gemini | 3 | 5/5 | yes | yes | informative |
| Haiku | 1 | 5/5 | yes | yes | informative |

Haiku variant 1 passed. Variant 2 parsed but failed root pitch class and rhythm
class. Variants 3, 4, and 5 omitted the required `ANALYSIS` row form and failed
syntax. No initial result was unavailable or failed.

## Component resolution

Counts show passing unique initial tasks out of five. A syntax failure passes
no component.

| Component | Haiku |
|---|---:|
| Chord identity | 2 |
| Root pitch class | 1 |
| Bass pitch class | 2 |
| Chord quality | 2 |
| Inversion number | 2 |
| Chord function | 2 |
| Motif relation | 2 |
| Rhythm class | 1 |

The four repairs passed chord identity, bass, motif relation, and rhythm on all
four tasks. Three passed root, quality, inversion, and function. Repairs stay
outside the initial numerator and denominator.

## Output-limit repair

All six initial responses and four repairs ended normally. No response reached
the 12,000-token output limit. The largest response used 5,013 output tokens,
just above the old 5,000-token limit.

The variant 1 unique task and named sentinel used the same prompt hash. Both
returned the same passing payload. Their thinking use differed by 13 tokens,
but the scored result was stable.

## Usage and cost guard

| Calls | Input tokens | Output tokens | Thinking tokens | Mean latency | Cost |
|---:|---:|---:|---:|---:|---:|
| 10 | 16,700 | 28,286 | 27,306 | 28.854 s | USD 0.158130 |

Reported thinking was 96.5 percent of output use. The largest measured input
and token-count estimate were both 1,940 tokens. The largest output was 5,013
tokens. Every request stayed below its USD 0.065 reservation.

The guard settled all 10 reservations to measured cost. It retained no failed
reservation. The run used 20.3 percent of the approved cost. The operator owns
the separate provider-dashboard comparison.

## Retained hashes

| Provider | Manifest SHA-256 | Raw-run SHA-256 |
|---|---|---|
| Gemini | `4931455793fa10ff25c7e541354328bbff342003d6fe51d99752e175bc663ef7` | `b4cf34804b322f7c6c1bbb508e357b291a100850e88797f6eda0761df6a96d4a` |
| Haiku | `7b2933d28a54d27635adc85b05839bb987460a46ae92e2dedd8805d26d63f1b1` | `d908d4ca992512ddff139dea179b8739b3572d1f14c6a7dc1fc19f08cda67af1` |

## Consolidated Phase 8c4b result

The retained r2 result makes motif informative on two providers and
progression informative on three. R5 makes the repaired analysis family
informative on Gemini and Haiku. Every decision family now meets the frozen
two-provider rule.

Return `proceed-development` for Phase 8c4b. Keep all calibration data outside
the Phase 8c4c development effect estimate.
