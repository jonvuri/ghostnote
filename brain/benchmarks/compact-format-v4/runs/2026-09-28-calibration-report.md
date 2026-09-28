# Phase 8c4b calibration report

## Decision

Return `repair-measurement`. Do not select a format and do not start Phase
8c4c.

The exact-object control puts motif at a ceiling on all three providers. It
puts progression at a floor on all scored results. Two OpenAI progression
results are unavailable because they reached the output limit. The summary
keeps them outside the scored denominator and marks the evidence incomplete.

The progression prompt also has a contract defect. The scorer requires
`BASE none` and a fixture-specific `SOURCE` value for source-free generation.
The prompt does not state these values. All 33 parsed unique progression
outputs fail `document_context`. The source-free role-continuation guard has
the same defect.

The summary SHA-256 is
`d865a214dacd681018d8819bbd964bfddcf4e915bab27831484a1e2a50adefb1`.
The report does not select between the two compact arms.

## Frozen run

The run ID is `phase8c4b-focused-compact-calibration-r1`. The protocol
SHA-256 is
`468f734100ccccc2333d022cde2c509279c244d5eb9331c25ed696ba01604ae6`.
The run-plan SHA-256 is
`9d4506a390eb67b9c98884c31a432b73ffac0c5a7925eaa81b894fd301e2b4f3`.

| Provider | Model | Calls | API-recorded cost | Raw-run SHA-256 | Manifest SHA-256 |
|---|---|---:|---:|---|---|
| OpenAI | `gpt-5.4-mini-2026-03-17` | 112 | USD 0.819922 | `6b120937884aea7d9c786d6d75cbfe07e197b2a914fedc258b7078e215daa2fe` | `ada9d65c0ffd3e13a5b63e3e3e3f916c3ed0914ccd7b2f42de4e4e840cfccc50` |
| Gemini | `gemini-3.8-flash` | 93 | USD 0.180168 | `edc2b631c027d75dcf131606572994e09b64b9d732535a638f69a36dc0f47d3f` | `bdc4a69a022ce88d13effcec2a71107bba1965d8756a19f708bc661edfdfc542` |
| Claude | `claude-sonnet-5` | 93 | USD 1.742067 | `859535fc7703b3c2dd446d9d783c91951561435102310b208c90094b8cc4232d` | `7e0b3e69e5e58e2be70d801ea5973fb45f6a1ccf275fbc86be2deb99960a68d1` |
| Total | — | 298 | USD 2.742157 | — | — |

The run used 116 fewer calls and USD 1.474558 less than the approved maxima.
The manifests use provider-reported token usage and the frozen price
calculation. The operator owns the separate provider-dashboard comparison.

## Initial and repaired results

This table includes the 60 unique jobs and nine sentinels per provider.
Musical means `primary_pass`. A repaired pass does not replace its initial
result.

| Provider | Initial scored | Initial syntax | Initial musical | Initial unavailable | Repair attempts | Repairs scored | Repair syntax | Musical recoveries | Repair unavailable |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| OpenAI | 67/69 | 48/67 | 24/67 | 2 | 43 | 41/43 | 26/41 | 7/41 | 2 |
| Gemini | 69/69 | 69/69 | 45/69 | 0 | 24 | 22/24 | 22/22 | 2/22 | 2 |
| Claude | 69/69 | 66/69 | 45/69 | 0 | 24 | 24/24 | 21/24 | 3/24 | 0 |

No transport retry occurred. OpenAI has two unavailable initial results and
two unavailable repairs. Gemini has two unavailable repairs. Unavailable
results do not enter a scored denominator.

## Family eligibility

Eligibility uses only the five unique exact-object initial results for each
provider and family. The inclusive band is 0.20 through 0.80. A family needs
two eligible providers.

| Family | OpenAI | Gemini | Claude | Eligible providers | Result |
|---|---:|---:|---:|---:|---|
| Analysis | 0/5, 0.00 | 4/5, 0.80 | 3/5, 0.60 | 2 | eligible |
| Motif | 5/5, 1.00 | 5/5, 1.00 | 5/5, 1.00 | 0 | ceiling |
| Progression | 0/3, 0.00; 2 unavailable | 0/5, 0.00 | 0/5, 0.00 | 0 | floor and incomplete |

Analysis is informative on Gemini and Claude. The OpenAI exact-object control
is below the band. Motif and progression make development ineligible.

## Decision-family rates by arm

| Provider | Family | Positional | `FIELDS` | Exact object |
|---|---|---:|---:|---:|
| OpenAI | Analysis | 2/5 | 0/5 | 0/5 |
| OpenAI | Motif | 2/5 | 3/5 | 5/5 |
| OpenAI | Progression | 0/5 | 0/5 | 0/3; 2 unavailable |
| Gemini | Analysis | 4/5 | 4/5 | 4/5 |
| Gemini | Motif | 5/5 | 5/5 | 5/5 |
| Gemini | Progression | 0/5 | 0/5 | 0/5 |
| Claude | Analysis | 4/5 | 5/5 | 3/5 |
| Claude | Motif | 5/5 | 5/5 | 5/5 |
| Claude | Progression | 0/5 | 0/5 | 0/5 |

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
| Chord function | 36/45 | 10/15 |
| Chord identity | 42/45 | 14/15 |
| Chord quality | 39/45 | 12/15 |
| Inversion number | 35/45 | 11/15 |
| Motif relation | 34/45 | 11/15 |
| Rhythm class | 45/45 | 15/15 |
| Root pitch class | 43/45 | 14/15 |

### Motif

| Component | All arms | Exact object |
|---|---:|---:|
| Document context | 40/40 | 15/15 |
| Operation formula | 40/40 | 15/15 |
| Operation-specific fields | 40/40 | 15/15 |
| Output identity | 40/40 | 15/15 |
| Preserved properties | 40/40 | 15/15 |

All parsed motif outputs pass every component. The repaired contract is now
too easy for calibration.

### Progression

| Component | All arms | Exact object |
|---|---:|---:|
| Bass inversions | 32/33 | 11/11 |
| Cadence | 26/33 | 10/11 |
| Chord starts and named voices | 33/33 | 11/11 |
| Document context | 0/33 | 0/11 |
| Duration and velocity | 33/33 | 11/11 |
| Pitch-class coverage | 19/33 | 6/11 |
| Same-voice movement | 2/33 | 1/11 |
| Strict voice order | 33/33 | 11/11 |
| Voice ranges | 29/33 | 8/11 |

The parsed outputs prove that the progression parser and basic structure are
not at a floor. The hidden context requirement rejects every parsed output.
The tight movement bound and four-class chord also keep the musical task near
a floor.

## Guard results

Each cell pools one unique fixture from each provider. It reports primary
passes from three scored results.

| Guard family | Positional | `FIELDS` | Exact object |
|---|---:|---:|---:|
| Structure | 3/3 | 2/3 | 3/3 |
| Role continuation | 0/3 | 0/3 | 0/3 |
| Revoice | 3/3 | 2/3 | 3/3 |
| Local transformation | 3/3 | 3/3 | 3/3 |
| Rhythm transformation | 3/3 | 2/3 | 3/3 |

Role continuation is source-free generation and shares the unstated context
header defect. Do not treat its floor as a format result.

## Provider measurements

Latency is per actual provider call. Payload bytes cover calls with an
available payload.

| Provider | Median latency | P95 latency | Input tokens | Output tokens | Thinking tokens | Payload bytes | Payload calls |
|---|---:|---:|---:|---:|---:|---:|---:|
| OpenAI | 4.956 s | 31.051 s | 58,704 | 172,421 | 151,152 | 45,693 | 108/112 |
| Gemini | 2.431 s | 4.129 s | 49,339 | 38,177 | 15,166 | 48,183 | 91/93 |
| Claude | 7.701 s | 23.874 s | 88,704 | 98,397 | 61,882 | 51,794 | 93/93 |
| Total | — | — | 196,747 | 308,995 | 228,200 | 145,670 | 292/298 |

Cached input was zero for every call. The maximum observed latencies were
34.056 seconds for OpenAI, 18.366 seconds for Gemini, and 39.015 seconds for
Claude.

## Initial size and syntax by arm

This table uses the 20 unique initial jobs per provider and arm. Mean payload
bytes exclude unavailable payloads.

| Provider | Arm | Scored | Syntax | Musical | Mean input tokens | Mean payload bytes |
|---|---|---:|---:|---:|---:|---:|
| OpenAI | Positional | 20/20 | 12/20 | 8/20 | 456.8 | 279.4 |
| OpenAI | `FIELDS` | 20/20 | 10/20 | 4/20 | 470.5 | 320.4 |
| OpenAI | Exact object | 18/20 | 18/18 | 9/18 | 578.1 | 697.3 |
| Gemini | Positional | 20/20 | 20/20 | 13/20 | 475.2 | 296.4 |
| Gemini | `FIELDS` | 20/20 | 20/20 | 13/20 | 488.9 | 322.4 |
| Gemini | Exact object | 20/20 | 20/20 | 13/20 | 605.2 | 819.6 |
| Claude | Positional | 20/20 | 19/20 | 13/20 | 847.1 | 298.5 |
| Claude | `FIELDS` | 20/20 | 20/20 | 14/20 | 881.4 | 321.7 |
| Claude | Exact object | 20/20 | 18/20 | 12/20 | 1,071.3 | 808.4 |

The compact arms keep their measured size advantage. Calibration cannot use
these rows to select one compact arm.

## Nondeterminism sentinels

Each provider has nine repeated-prompt pairs. Exact payload means that the
payload SHA-256 is unchanged.

| Provider | State changes | Syntax changes | Primary changes | Check-vector changes | Exact payloads |
|---|---:|---:|---:|---:|---:|
| OpenAI | 1/9 | 4/9 | 3/9 | 7/9 | 2/9 |
| Gemini | 0/9 | 0/9 | 0/9 | 2/9 | 6/9 |
| Claude | 0/9 | 1/9 | 1/9 | 3/9 | 5/9 |

OpenAI has one state change because the unique exact-object progression call
reached the output limit and its repeated call returned a scored failure.

## Repair boundary

Stop provider work. Keep this package, cohort, protocol, plan, approval, and
all retained responses unchanged.

The next session must repair measurement offline. It must state exact context
header values in every source-free document prompt, add a prompt-visible
contract test, move motif away from its ceiling, and move progression away
from its floor. It must use a new cohort, protocol, run plan, cost estimate,
and approval before another provider call.

## Retrospective

The analysis repair produced an informative exact-object control on two
providers. The motif repair made every exact-object case trivial. The
progression repair kept useful component separation, but a hidden context
requirement and a tight musical bound prevented an informative primary result.

The output-state denominator tests worked. They excluded both unavailable
OpenAI results and forced the summary to report incomplete evidence. Add a
test that derives each required output header from text visible in the model
prompt. A renderer example alone does not define task-specific header values.
