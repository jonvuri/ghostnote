---
title: E152 — Tuple JSON with MIDI integers passes targeted holdout
kind: evidence
state: active
updated: 2026-09-27
parent: ../../plan/phase-8/8c2-3-compact-json-factorial-and-native-decision.md
---

# E152 — Tuple JSON with MIDI integers passes targeted holdout

## Verdict

Return `select-for-phase8c3`. Select `tuple-json-midi` as the complete JSON
representation for the fresh Phase 8c3 matrix. Keep `exact-object-json-midi`
as the full-capability fallback. Reject `exact-object-json-pc-register`.

Do not revise the selected representation from holdout responses. Do not
start Phase 8c3 provider work without a new frozen plan and approval.

## Completed run

The operator approved targeted holdout r1 with the statement, "Yes, I approve
that targeted holdout R1. Proceed." Each provider completed 60/60 calls with
the requested model. No call had a transport error, retry, or output-limit
stop.

| Provider | Model | Estimate | Recorded cost |
|---|---|---:|---:|
| OpenAI | `gpt-5.4-mini-2026-03-17` | USD 0.628175 | USD 0.542147 |
| Gemini | `gemini-3.8-flash` | USD 0.330898 | USD 0.278308 |
| Claude | `claude-sonnet-5` | USD 3.505561 | USD 3.353274 |
| Total | — | USD 4.464634 | USD 4.173729 |

The total is USD 0.290905 below the estimate. The operator should compare
these records with the provider dashboards.

| Provider | Raw-run SHA-256 | Manifest SHA-256 |
|---|---|---|
| OpenAI | `4a3aac32711e3121bc34932f7c803021c11512eef8319e622d7f73ffb3518fe9` | `e7fd63559efe9bfa77a53ccf243ca3d5343a822380407083e3903f950db53f63` |
| Gemini | `7e6099af003a0216116d16bf7cb90ebe40dc426ccda34e98ac921d6fbba868de` | `c1fee31a99ed2d508862678bee73096a8b949e2f1092701482dc0751daf42798` |
| Claude | `7a1b61e7c4068542645b95062219a32d31d18a5fb724c9368b9b5038510398c3` | `ac1e678cab9bf7441a6d5426f1072a2720c470b9cb3070f5b804d30d2397d2aa` |

The holdout summary SHA-256 is
`cda478c9339c9af95e9bb8b08a101bbf73198777558671e44b1f69f4f823ba79`.
The integrity report SHA-256 is
`0adcdb86256a65158af0baf68c185d86d93fa6d96dc52f065fe851ce591f1712`.
The reporter passes 43 checks.

## Paired result

Each comparison uses 20 paired fixtures. Tuple MIDI passes when it is no more
than 5 percentage points below the exact-object MIDI control. Exact-object
pitch-class/register needs a 5 percentage-point pitch-critical improvement
without a larger primary regression.

| Provider | Object MIDI | Object PC/register | PC effect | Tuple MIDI | Tuple effect |
|---|---:|---:|---:|---:|---:|
| OpenAI | 6/20 | 4/20 | -0.10 | 10/20 | +0.20 |
| Gemini | 9/20 | 15/20 | +0.30 | 6/20 | -0.15 |
| Claude | 8/20 | 8/20 | 0.00 | 12/20 | +0.20 |

Tuple MIDI passes on OpenAI and Claude. Exact-object pitch-class/register
passes only on Gemini. The frozen two-provider rule selects tuple MIDI and
rejects pitch-class/register.

Tuple MIDI retains full document fidelity, stable identity, exact omitted
field preservation, sparse patches, base conflict checks, and one canonical
pitch encoding. It therefore satisfies the product capability gate for the
Phase 8c3 comparison.

## Phase 8c3 handoff

Phase 8c3 must use tuple JSON with MIDI integers without revision. It must use
a new retained cohort that does not overlap any Phase 8c2.3 fixture. Freeze
the complete matrix, paired decision rule, exact provider scope, settings,
and cost estimate before provider calls.

## Retrospective

The two-provider gate rejected a strong pitch result that appeared only on
Gemini. The higher Claude token limit removed the development truncations.
