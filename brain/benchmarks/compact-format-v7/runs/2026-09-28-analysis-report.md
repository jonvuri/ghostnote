# Phase 8c4b Haiku substitution calibration r4 report

## Verdict

Return `repair-measurement`. Haiku produced scored initial results for only two
of five unique tasks. Neither scored result passed. Three other unique tasks
stopped at the 5,000-token output limit without an answer.

The retained Gemini result remains complete and eligible at 3/5. Haiku is
incomplete, so the two-provider analysis gate does not pass. Do not select a
format or start Phase 8c4c.

## Frozen run

- Run ID: `phase8c4b-analysis-haiku-calibration-r4`
- Protocol SHA-256:
  `5d481e5be3975f023c6284bfc76ac31ca88f266c4845e2294d9b42787348a211`
- Run-plan SHA-256:
  `ab4410d6330f15cf6237467b3f70325bebbc559e1481ff3df54a00bf20ecbcc5`
- Easy-tier corpus SHA-256:
  `edd1f29d71d049d3f9bfda1915a62879d23143abc596053070441015a2607374`
- Summary SHA-256:
  `179ce1c88360939c4f015edca634e4a945189701595d5864bf12d17126b45315`

The operator approved at most 12 calls and USD 0.188385. The run made eight
calls and cost USD 0.148805. The requested and returned model names matched.
No transport retry occurred. No Gemini, OpenAI, or Sonnet call occurred.

## Initial result

Only the five unique initial tasks enter the gate.

| Provider | Passed | Scored | Complete | Eligible | Result |
|---|---:|---:|---:|---:|---|
| Gemini | 3 | 5/5 | yes | yes | informative |
| Haiku | 0 | 2/5 | no | no | incomplete |

Haiku variant 2 failed syntax because it omitted the required `ANALYSIS`
prefix. Variant 4 parsed but failed the rhythm check. Variants 1, 3, and 5
stopped at the output limit and stayed outside the denominator.

## Sentinel and repair

The variant 1 unique call and sentinel used the same prompt hash. The unique
call used 5,000 reported thinking tokens and returned no answer. The sentinel
used 1,194 reported thinking tokens and passed every check. This repeated
prompt is not stable under the approved setting.

Two failed initial responses received repairs. The variant 2 repair parsed but
failed chord function and inversion. The variant 4 repair omitted the
`ANALYSIS` prefix and failed syntax. Repairs do not replace initial results or
enter the gate.

## Usage

| Calls | Input tokens | Output tokens | Reported thinking tokens | Mean latency | Cost |
|---:|---:|---:|---:|---:|---:|
| 8 | 13,300 | 27,101 | 26,624 | 42.221 s | USD 0.148805 |

Reported thinking used 98.2 percent of all output tokens. Three calls reached
the 5,000-token limit entirely in reported thinking. The run used 8 of 12
approved calls and 79.0 percent of the approved cost.

The operator owns the separate provider-dashboard comparison.

## Retained hashes

| Provider | Manifest SHA-256 | Raw-run SHA-256 |
|---|---|---|
| Gemini | `4931455793fa10ff25c7e541354328bbff342003d6fe51d99752e175bc663ef7` | `b4cf34804b322f7c6c1bbb508e357b291a100850e88797f6eda0761df6a96d4a` |
| Haiku | `27d3741d079cdaaca792f69d06fa5cd3765c6313445cff74c451192cf01ffb2d` | `c6566aa177c4df12adc78e88a7bc8ba488a22a30d3168702a79b95cbb45aa316` |

## Interpretation

This result does not show that Haiku is at a floor. It shows that the approved
manual-thinking setting did not produce a complete sample. The same prompt
both reached the output limit and passed in separate calls.

Any further provider work needs a new package, cohort, protocol, run plan, and
approval. It must pre-register a changed Anthropic generation setting and add
a live cost guard.

## Cost-control finding

The frozen plan estimated its cost from the largest observed r3 Sonnet call
repriced at Haiku rates. It did not price every call at the approved 5,000-token
limit. The harness also checked the approval record but did not stop on an
accumulated cost boundary.

Actual r4 spend stayed below the approved limit. A future run must use a
conservative maximum-token estimate and enforce the approved cost before each
conditional call.
