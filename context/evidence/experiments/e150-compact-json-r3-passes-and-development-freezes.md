---
title: E150 — Compact JSON r3 passes and development freezes
kind: evidence
state: active
updated: 2026-09-27
parent: ../../plan/phase-8/8c2-3-compact-json-factorial-and-native-decision.md
---

# E150 — Compact JSON r3 passes and development freezes

## Verdict

Return `proceed-development`. OpenAI and Gemini are both inside the frozen
progression eligibility band. The result does not permit or need a Claude
calibration run.

Do not start development. A fresh conditional development plan is frozen and
awaits separate approval.

## Completed run

The operator approved r3 with the statement, "Yes, I approve this R3.
Proceed." Each provider completed 15/15 calls with the requested model and no
transport error.

| Provider | Model | Estimate | Recorded cost |
|---|---|---:|---:|
| OpenAI | `gpt-5.4-mini-2026-03-17` | USD 0.133482 | USD 0.122108 |
| Gemini | `gemini-3.8-flash` | USD 0.069066 | USD 0.076670 |
| Total | — | USD 0.202548 | USD 0.198778 |

The operator should compare these records with the provider dashboards.

| Provider | Raw-run SHA-256 | Manifest SHA-256 |
|---|---|---|
| OpenAI | `4adb93d638b43822eee8a362a6549a5b3506fd46069bba36c770537c7eaf94e1` | `1ec43b12dfa30ba34c6779955991ac96c976b8f7f85ec3015159542729989172` |
| Gemini | `d0c30eacb0e32c6600ac77bad6086ede6c04d8ce3773fb6bc17b0cd827d7cd98` | `85946293767dad77ddd975dcf65a0ba80ba02586e98fc6845a549f9bd7c98d9b` |

The retained summary SHA-256 is
`ba10560f428549468b9e9d9403766e287eb9075e1a02c47f76e6f5eaca82f1c4`.
The integrity report SHA-256 is
`b400c4157649b676b34cab1ecdaa59bfd8649d580949a084de6a139ec796edf9`.
The reporter passes 30 checks.

## Eligibility result

Calibration pooled exact-object MIDI and native MIDI-like controls.

| Provider | Control successes | Rate | Result |
|---|---:|---:|---|
| OpenAI | 3/6 | 0.500000 | Eligible |
| Gemini | 2/6 | 0.333333 | Eligible |

All arm results are descriptive. Calibration cannot select a format.

| Provider | Object MIDI | Object PC/register | Tuple MIDI | Tuple PC/register | Native |
|---|---:|---:|---:|---:|---:|
| OpenAI | 1/3 | 2/3 | 1/3 | 0/3 | 2/3 |
| Gemini | 0/3 | 2/3 | 1/3 | 3/3 | 2/3 |

The declared and sent request settings match. One Gemini exact-object MIDI
response stopped at the 4,000-token limit. Its usage included 3,358 thinking
tokens. The development plan uses 5,000 output tokens and repeats the exact
request-payload audit.

## Frozen development run

The development run ID is
`phase8c2-3-compact-json-development-r1`. It uses 20 fresh progression
fixtures across all five arms. Each provider has 100 calls. A different set
of 20 progression fixtures is reserved for holdout.

Run OpenAI and Gemini first. Their 200-call estimate is USD 1.656484. Run 100
Claude calls only if the two providers disagree on a frozen decision signal.
The maximum 300-call estimate is USD 5.105038.

| Provider | Calls | Estimated cost |
|---|---:|---:|
| OpenAI | 100 | USD 1.017567 |
| Gemini | 100 | USD 0.638917 |
| Claude, if required | 100 | USD 3.448554 |

| Identity | SHA-256 |
|---|---|
| Development corpus | `31659363fa0b4789fbbf87da0be60961c08b0e17569d8c4e83cf3299aae41236` |
| Reserved holdout corpus | `80cdabe1dfb08767e9f68acf0999be85b35c42660a6d5380246eee4b6cf4d1a8` |
| Cohort manifest | `1447fd269fcd9a725531cadb8c90075521b61d961f2254b52e3449e43b9c7e56` |
| Scorer | `2d6ea56cd427b1539e0451641028630987967b34216d33b9b9a1226556b147d3` |
| Transport audit | `29dd0213652ba3b69898c4388dd2d15ca52cf3423c96941a81e858e7899322fa` |
| Development protocol | `b5bb279574d958ccaa3abab49f636087bdde4b1b068567e18307024641216d7f` |
| Development run plan | `f856b4ad48abfc9928a364d87b2b510e5bac6ebafee61356f986a111773bdfd4` |
| Deterministic package | `987aaa1b0f95cf230acce149300a14199434fd8f3cfb6c9de912e29bafcffa54` |

The deterministic development screen passes 610 checks. Tuple prompt bytes
are at most 0.81 of object prompt bytes. Tuple canonical output bytes are at
most 0.54 of object output bytes. The pending approval record has no operator
statement, so the harness rejects it.

## Frozen decision rule

Tuple must stay within a 5 percentage-point paired non-inferiority margin at
both pitch encodings. Its prompt-byte ratio must be at most 0.85, and its
canonical output-byte ratio must be at most 0.65.

Pitch-class/register must improve pitch-critical accuracy by at least 5
percentage points on two providers. It cannot reduce the primary rate by more
than 5 percentage points. A material interaction can freeze more than one
eligible JSON cell for holdout.

Native MIDI-like remains outside the factorial. It needs a 5 percentage-point
common-metric advantage on two providers to enter holdout as a limited
interface. It cannot satisfy the full-capability representation gate.

## Retrospective

An output-token limit is a shared reasoning and answer budget. Record thinking
use when a response stops at the limit.
