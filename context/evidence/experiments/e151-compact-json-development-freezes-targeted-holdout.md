---
title: E151 — Compact JSON development freezes a targeted holdout
kind: evidence
state: active
updated: 2026-09-27
parent: ../../plan/phase-8/8c2-3-compact-json-factorial-and-native-decision.md
---

# E151 — Compact JSON development freezes a targeted holdout

## Verdict

Return `freeze-holdout`. Freeze exact-object MIDI as the control and fallback.
Freeze exact-object pitch-class/register and tuple MIDI as the experimental
holdout cells. Native MIDI-like does not enter holdout.

Do not start holdout. Its separate plan is frozen and awaits explicit
operator approval.

## Completed run

The operator approved development r1 with the statement, "Yes, I approve
Development R1. Proceed." OpenAI and Gemini disagreed on frozen decision
signals, so the approved conditional Claude stage ran. Each provider
completed 100/100 calls. No call had a transport error or retry.

| Provider | Model | Estimate | Recorded cost |
|---|---|---:|---:|
| OpenAI | `gpt-5.4-mini-2026-03-17` | USD 1.017567 | USD 0.837567 |
| Gemini | `gemini-3.8-flash` | USD 0.638917 | USD 0.441198 |
| Claude | `claude-sonnet-5` | USD 3.448554 | USD 4.674081 |
| Total | — | USD 5.105038 | USD 5.952846 |

The cheap stage cost USD 1.278765. This is USD 0.377719 below its estimate.
The complete run cost USD 0.847808 more than its maximum estimate because the
Claude mean call cost was higher than the calibration basis. The operator
should compare these records with the provider dashboards.

| Provider | Raw-run SHA-256 | Manifest SHA-256 |
|---|---|---|
| OpenAI | `b6323131ac87b609d97ce313fdf872da10a81d6d62e5ee902fa778aed792eb49` | `0a472d2ab628eb69bc84293091759fc35586d06dc64415fb7bc0240aff188a9e` |
| Gemini | `f76c28705d48ea5dadc303de570abd49ab7a867c014dab713d72de6c2a704cde` | `3877b8e59b550d57eb8f0d7203d40927519ea4c95c67cb053984eb4c55e36f81` |
| Claude | `f6a0f19819b8b7073bc31f1d1a94e23955639d6c2394585c9362cb6daaa94334` | `fa129bfc42c869757e20c06d242cc664a674496acfa2f397590e90d84a8dbd31` |

The cheap summary SHA-256 is
`60dfe84b19b68c499d15871933abd886e73f9816d36df3974d4752aa4496f5cf`.
The final summary SHA-256 is
`ffdfa0b21a87aee2465b6d0ff8c4473de59a861662a818d456eaa65b7c65f559`.
The integrity report SHA-256 is
`f16e67ea80070140431e6225211fe8cd4672b117bc0dc9af7f017e69cdf49866`.
The reporter passes 46 checks.

## Arm results

The table reports primary successes from 20 paired fixtures per arm and
provider.

| Provider | Object MIDI | Object PC/register | Tuple MIDI | Tuple PC/register | Native |
|---|---:|---:|---:|---:|---:|
| OpenAI | 4 | 8 | 8 | 6 | 8 |
| Gemini | 8 | 17 | 3 | 15 | 12 |
| Claude | 7 | 6 | 10 | 10 | 5 |

Two providers supported tuple shape at MIDI. One provider supported tuple
shape at pitch-class/register. Two providers supported pitch-class/register
in objects. One provider supported it in tuples. Two providers showed a
material interaction, so the frozen rule keeps separate shape and pitch
candidates instead of choosing one combined cell.

Native beat exact-object MIDI on the common primary metric for two providers.
It did not beat every frozen JSON cell on two providers. It also lacks stable
identity, exact preservation, sparse patches, and conflict checks. The frozen
rule therefore excludes it from holdout.

## Output-limit result

The declared and sent request settings match. Six Claude responses stopped at
the 5,000-token limit. One was exact-object MIDI, and five were exact-object
pitch-class/register. Their thinking use ranged from 3,022 through 4,403
tokens. The retained responses stay unchanged.

The holdout plan raises only Claude's output limit to 7,000 tokens. It does
not change a representation, prompt, task, scorer, candidate, or gate.

## Frozen targeted holdout

The holdout run ID is `phase8c2-3-compact-json-holdout-r1`. It uses the 20
reserved progression fixtures and three arms. Each provider has 60 calls.
The total scope is 180 calls.

| Provider | Calls | Estimated cost |
|---|---:|---:|
| OpenAI | 60 | USD 0.628175 |
| Gemini | 60 | USD 0.330898 |
| Claude | 60 | USD 3.505561 |
| Total | 180 | USD 4.464634 |

The estimate uses each provider's development mean call cost and adds 25
percent. This basis replaces the calibration-derived development estimate.

| Identity | SHA-256 |
|---|---|
| Development summary | `ffdfa0b21a87aee2465b6d0ff8c4473de59a861662a818d456eaa65b7c65f559` |
| Development report | `f16e67ea80070140431e6225211fe8cd4672b117bc0dc9af7f017e69cdf49866` |
| Holdout corpus | `80cdabe1dfb08767e9f68acf0999be85b35c42660a6d5380246eee4b6cf4d1a8` |
| Cohort audit | `1447fd269fcd9a725531cadb8c90075521b61d961f2254b52e3449e43b9c7e56` |
| Scorer | `2d6ea56cd427b1539e0451641028630987967b34216d33b9b9a1226556b147d3` |
| Transport audit | `a1e6cd017e2ba6d093c7a00cd5326528c64aa95b9e5bf782e0dd5fd51642c8c3` |
| Holdout protocol | `c6811ab63021d0415c92533bb600c944da17db5056a498616109369d5d644b69` |
| Holdout run plan | `22a146acfca352da437825526592764f61216fb6a517ad385baeac7db43fdf9e` |
| Deterministic package | `a9b6d6c006d945fef1c18152c19cb342f2b1f65ad2b19b9684d46f3eb356e73c` |

The deterministic holdout screen passes 192 checks. The pending approval
record has no operator statement, so the harness rejects it.

## Frozen holdout rule

Tuple MIDI passes when its primary result is no more than 5 percentage points
below exact-object MIDI on at least two providers. Exact-object
pitch-class/register passes when it improves pitch-critical accuracy by at
least 5 percentage points on at least two providers. On the same providers,
its primary result cannot be more than 5 percentage points below exact-object
MIDI.

Return `select-for-phase8c3` when at least one experimental cell passes.
Otherwise, return `do-not-select`. The exact-object MIDI control cannot cause
a positive holdout decision by itself.

## Retrospective

Use the latest same-stage mean call cost for a later estimate. A calibration
mean did not predict Claude's development cost.
