# Phase 8c4b calibration r2 report

## Decision

Return `repair-measurement`. Do not select a format and do not start Phase
8c4c.

The r2 repair made motif informative on two providers and progression
informative on all three providers. It also removed the hidden output-context
failure. Every parsed progression result passes `document_context`.

Analysis is now at an exact-object ceiling on Gemini and Claude. OpenAI is
inside the eligibility band at 1/5. Analysis therefore has only one eligible
provider instead of the required two.

The summary SHA-256 is
`e2b293e9e05c62d58e9c22748d5cdad0d38bfcd5ec456347c7a0f01a3a030017`.
The report does not select between the two compact arms.

## Frozen run

The run ID is `phase8c4b-focused-compact-calibration-r2`. The protocol
SHA-256 is
`7e0d81e85b2b1caafda9fe7921ab7aefa0e3cd8e679775a136e912caa2dfe143`.
The run-plan SHA-256 is
`3d1abc5800507163f34ec64fc9039ddec95ef55adc7429fb8f2940e0f430b89f`.

| Provider | Model | Calls | API-recorded cost | Raw-run SHA-256 | Manifest SHA-256 |
|---|---|---:|---:|---|---|
| OpenAI | `gpt-5.4-mini-2026-03-17` | 106 | USD 0.500027 | `8065998a5383b8f16b509c4255d406f14e17f0face5f6f6b38fafb402f76db12` | `39313703a388e43dd8e7412746696351545ce38dd710b4426ce53d5db4e49449` |
| Gemini | `gemini-3.8-flash` | 81 | USD 0.175443 | `f80ae183e7a89dfd623469bf790755d710ba2acba47987b5f7a3bbbf6b9f4e60` | `e3150ccbc952aec79580f98837c9f219e34be0d8d92f63e4dd58a1e499a447b7` |
| Claude | `claude-sonnet-5` | 81 | USD 1.396248 | `2d1cb2b27269b02dd5445effdc12005cb22b19eeeb69d02c9f1d1c7150cd9437` | `24e8e68285b723221a304c4f24b60d08ea71139d921de84449ebd58d10bbbee1` |
| Total | — | 268 | USD 2.071718 | — | — |

The run used 146 fewer calls and USD 3.023917 less than the approved maxima.
The manifests use provider-reported token usage and the frozen cost
calculation. The operator owns the separate provider-dashboard comparison.

## Initial and repaired results

This table includes the 60 unique jobs and nine sentinels per provider.
Musical means `primary_pass`. A repaired pass does not replace its initial
result.

| Provider | Initial scored | Initial syntax | Initial musical | Initial unavailable | Repair attempts | Repairs scored | Repair syntax | Musical recoveries | Repair unavailable |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| OpenAI | 69/69 | 53/69 | 32/69 | 0 | 37 | 37/37 | 27/37 | 11/37 | 0 |
| Gemini | 69/69 | 69/69 | 57/69 | 0 | 12 | 12/12 | 11/12 | 6/12 | 0 |
| Claude | 69/69 | 68/69 | 57/69 | 0 | 12 | 12/12 | 12/12 | 7/12 | 0 |

No result is unavailable or failed. No transport retry occurred. Every unique
initial result has a scored state, so the evidence is complete under the
frozen rule.

## Family eligibility

Eligibility uses only the five unique exact-object initial results for each
provider and family. The inclusive band is 0.20 through 0.80. A family needs
two eligible providers.

| Family | OpenAI | Gemini | Claude | Eligible providers | Result |
|---|---:|---:|---:|---:|---|
| Analysis | 1/5, 0.20 | 5/5, 1.00 | 5/5, 1.00 | 1 | ceiling on two providers |
| Motif | 4/5, 0.80 | 5/5, 1.00 | 4/5, 0.80 | 2 | eligible |
| Progression | 1/5, 0.20 | 1/5, 0.20 | 4/5, 0.80 | 3 | eligible |

The motif and progression repairs reached their target bands. Analysis makes
development ineligible.

## Decision-family rates by arm

| Provider | Family | Positional | `FIELDS` | Exact object |
|---|---|---:|---:|---:|
| OpenAI | Analysis | 2/5 | 1/5 | 1/5 |
| OpenAI | Motif | 3/5 | 2/5 | 4/5 |
| OpenAI | Progression | 2/5 | 0/5 | 1/5 |
| Gemini | Analysis | 5/5 | 5/5 | 5/5 |
| Gemini | Motif | 4/5 | 5/5 | 5/5 |
| Gemini | Progression | 1/5 | 2/5 | 1/5 |
| Claude | Analysis | 5/5 | 5/5 | 5/5 |
| Claude | Motif | 3/5 | 5/5 | 4/5 |
| Claude | Progression | 3/5 | 2/5 | 4/5 |

These calibration rates are diagnostic. They have no format-selection
authority.

## Component resolution

The component denominators contain unique initial outputs that passed syntax.
The all-arm column pools the three arms and providers. The exact column is the
control only.

### Analysis

| Component | All arms | Exact object |
|---|---:|---:|
| Bass pitch class | 45/45 | 15/15 |
| Chord function | 42/45 | 14/15 |
| Chord identity | 41/45 | 14/15 |
| Chord quality | 42/45 | 14/15 |
| Inversion number | 41/45 | 14/15 |
| Motif relation | 34/45 | 11/15 |
| Rhythm class | 45/45 | 15/15 |
| Root pitch class | 42/45 | 14/15 |

Gemini and Claude pass all five exact-object analysis tasks. Four of the five
OpenAI exact-object failures include `motif_relation`. The analysis task does
not provide enough difficulty for two providers.

### Motif

| Component | All arms | Exact object |
|---|---:|---:|
| Document context | 40/40 | 14/14 |
| Operation-specific fields | 40/40 | 14/14 |
| Output identity | 40/40 | 14/14 |
| Pitch formula | 38/40 | 13/14 |
| Preserved properties | 40/40 | 14/14 |
| Timing formula | 37/40 | 14/14 |

The compound operation moved motif away from its all-provider ceiling. The
available failures isolate pitch and timing calculations.

### Progression

| Component | All arms | Exact object |
|---|---:|---:|
| Bass inversions | 39/40 | 14/15 |
| Cadence | 35/40 | 13/15 |
| Chord starts and named voices | 40/40 | 15/15 |
| Document context | 40/40 | 15/15 |
| Duration and velocity | 40/40 | 15/15 |
| Pitch-class coverage | 28/40 | 9/15 |
| Same-voice movement | 33/40 | 14/15 |
| Strict voice order | 40/40 | 15/15 |
| Voice ranges | 28/40 | 10/15 |

The exact output-context wording repaired the hidden failure. The remaining
failures occur in musical constraints and produce an informative exact-object
rate on every provider.

## Guard results

Each cell pools one unique fixture from each provider. It reports primary
passes from three scored results.

| Guard family | Positional | `FIELDS` | Exact object |
|---|---:|---:|---:|
| Structure | 3/3 | 3/3 | 3/3 |
| Role continuation | 3/3 | 1/3 | 2/3 |
| Revoice | 3/3 | 2/3 | 3/3 |
| Local transformation | 3/3 | 3/3 | 2/3 |
| Rhythm transformation | 3/3 | 2/3 | 2/3 |

Role continuation is no longer at a universal floor. Calibration cannot use
the guard rows to select a compact arm.

## Provider measurements

Latency is per actual provider call. Payload bytes cover calls with an
available payload.

| Provider | Median latency | P95 latency | Input tokens | Output tokens | Thinking tokens | Payload bytes | Payload calls |
|---|---:|---:|---:|---:|---:|---:|---:|
| OpenAI | 5.142 s | 11.983 s | 63,079 | 100,604 | 75,271 | 55,565 | 106/106 |
| Gemini | 2.958 s | 5.377 s | 50,009 | 36,783 | 13,854 | 46,762 | 81/81 |
| Claude | 7.553 s | 20.474 s | 84,921 | 76,099 | 44,531 | 44,762 | 81/81 |
| Total | — | — | 198,009 | 213,486 | 133,656 | 147,089 | 268/268 |

Cached input was zero for every call. The maximum observed latencies were
24.389 seconds for OpenAI, 6.809 seconds for Gemini, and 30.207 seconds for
Claude.

## Initial size and syntax by arm

This table uses the 20 unique initial jobs per provider and arm. Mean payload
bytes exclude unavailable payloads.

| Provider | Arm | Scored | Syntax | Musical | Mean input tokens | Mean payload bytes |
|---|---|---:|---:|---:|---:|---:|
| OpenAI | Positional | 20/20 | 19/20 | 12/20 | 530.4 | 315.7 |
| OpenAI | `FIELDS` | 20/20 | 9/20 | 5/20 | 544.1 | 360.1 |
| OpenAI | Exact object | 20/20 | 18/20 | 10/20 | 658.0 | 851.2 |
| Gemini | Positional | 20/20 | 20/20 | 15/20 | 563.3 | 316.5 |
| Gemini | `FIELDS` | 20/20 | 20/20 | 17/20 | 577.0 | 351.7 |
| Gemini | Exact object | 20/20 | 20/20 | 16/20 | 699.6 | 868.2 |
| Claude | Positional | 20/20 | 20/20 | 16/20 | 950.8 | 339.0 |
| Claude | `FIELDS` | 20/20 | 20/20 | 16/20 | 985.1 | 371.3 |
| Claude | Exact object | 20/20 | 19/20 | 16/20 | 1,188.2 | 861.4 |

The compact arms keep their measured size advantage. Calibration cannot use
these rows to select one compact arm.

## Nondeterminism sentinels

Each provider has nine repeated-prompt pairs. Exact payload means that the
payload SHA-256 is unchanged.

| Provider | State changes | Syntax changes | Primary changes | Check-vector changes | Exact payloads |
|---|---:|---:|---:|---:|---:|
| OpenAI | 0/9 | 1/9 | 2/9 | 2/9 | 5/9 |
| Gemini | 0/9 | 0/9 | 2/9 | 2/9 | 6/9 |
| Claude | 0/9 | 0/9 | 1/9 | 1/9 | 6/9 |

No repeated prompt changes result state.

## Repair boundary

Stop provider work. Keep the v5 package, cohort, protocol, plan, approval, and
all retained responses unchanged.

The next session must repair analysis measurement offline while preserving the
informative motif and progression contracts. It must use a new versioned
package and a fresh calibration cohort. A new provider run needs a new
protocol, run plan, cost estimate, and explicit approval.

## Retrospective

The prompt-to-scorer visibility test prevented the r1 hidden-context defect.
The motif and progression difficulty repairs also reached their target bands.
The fresh cohort exposed an analysis ceiling on two providers. Add harder
analysis cases without weakening independent component scoring or pushing
OpenAI below the current lower boundary.
