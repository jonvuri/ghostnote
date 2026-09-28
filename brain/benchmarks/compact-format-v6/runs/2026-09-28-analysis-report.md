# Phase 8c4b analysis-repair calibration r3 report

## Verdict

Return `repair-measurement`. Gemini is informative on the easy tier, but
Claude remains at a ceiling on the same tier. The frozen rule requires both
providers to score from 0.20 through 0.80.

Do not run the medium or hard tier. Gemini reached the eligibility band, so
the frozen ladder stopped. Claude used its one conditional run. This result
does not select a format or permit Phase 8c4c.

## Frozen run

- Run ID: `phase8c4b-analysis-repair-calibration-r3`
- Protocol SHA-256:
  `469fa3bf8c0d9c2b66c2fb8132b3bc942b90a4e39b84c2bd784a9395495e0f2c`
- Run-plan SHA-256:
  `e0a97521b4b8790c1b1432adf99f4cd79d315b931db0897a017f5b1941bf890a`
- Easy-tier corpus SHA-256:
  `edd1f29d71d049d3f9bfda1915a62879d23143abc596053070441015a2607374`
- Summary SHA-256:
  `73f343eb9bb675d688f2fffe118cf795f598b33130df0aab697d75c7372a9c72`

The operator approved at most 48 calls and USD 1.137431. The requested and
returned model names matched. No transport retry occurred.

## Initial result

Only the five unique initial tasks enter the gate.

| Provider | Passed | Rate | Complete | Eligible | Result |
|---|---:|---:|---:|---:|---|
| Gemini | 3/5 | 0.60 | yes | yes | informative |
| Claude | 5/5 | 1.00 | yes | no | ceiling |

All initial responses parsed. No result was unavailable or failed.

## Component resolution

Counts show passing unique initial tasks out of five.

| Component | Gemini | Claude |
|---|---:|---:|
| Chord identity | 5 | 5 |
| Root pitch class | 3 | 5 |
| Bass pitch class | 5 | 5 |
| Chord quality | 3 | 5 |
| Inversion number | 3 | 5 |
| Chord function | 3 | 5 |
| Motif relation | 5 | 5 |
| Rhythm class | 5 | 5 |

Gemini's two unique failures were confined to linked chord interpretation.
Every motif and rhythm result passed. Claude passed every component on every
unique task.

## Sentinel and repair

Gemini's repeated easy task produced a different initial answer from its
unique copy. Both initial answers failed, but on different chord analyses. The
sentinel repair passed. The two unique-task repairs did not pass. Repairs stay
outside the initial numerator and denominator.

Claude returned the same passing payload for the unique task and its repeated
sentinel. Claude needed no repair.

## Usage

| Provider | Calls | Input tokens | Output tokens | Mean latency | Cost |
|---|---:|---:|---:|---:|---:|
| Gemini | 9 | 12,425 | 2,673 | 2.305 s | USD 0.019342 |
| Claude | 6 | 12,715 | 7,260 | 14.081 s | USD 0.147045 |
| Total | 15 | 25,140 | 9,933 | - | USD 0.166387 |

The run used 15 of 48 approved calls and USD 0.166387 of the USD 1.137431
limit. Manifest usage and cost line items reconcile with the retained API
responses. The operator owns the separate dashboard comparison.

## Retained hashes

| Provider | Manifest SHA-256 | Raw-run SHA-256 |
|---|---|---|
| Gemini | `4931455793fa10ff25c7e541354328bbff342003d6fe51d99752e175bc663ef7` | `b4cf34804b322f7c6c1bbb508e357b291a100850e88797f6eda0761df6a96d4a` |
| Claude | `b7aed802738307a51668923a93f3d9c115af6311977b1506c2184c7e097adab4` | `81aaf76e074fae27bc5b16418cd16fdc89248e6baa0c86c0d4372d2ebab73333` |

## Interpretation

The batch design moved Gemini away from its r2 ceiling at the cheapest tier.
It did not move Claude. Running a harder tier now would change the frozen
stopping rule after seeing the result. Any Claude-specific repair needs a new
package, cohort, protocol, run plan, and approval.
