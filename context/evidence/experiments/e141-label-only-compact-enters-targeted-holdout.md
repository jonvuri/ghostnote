---
title: E141 — Label-only compact enters the targeted holdout
kind: evidence
state: active
updated: 2026-09-27
parent: ../../plan/phase-8/8c2-compact-grammar-correction.md
---

# E141 — Label-only compact enters the targeted holdout

## Verdict

Freeze a fresh targeted holdout for label-only compact. Do not carry full
v0-style compact into that holdout.

[E142](e142-label-only-compact-fails-targeted-holdout.md) records the later
holdout result. It supersedes this document only for the final selection.

Label-only compact passed every frozen development gate on OpenAI, Gemini, and
Claude. It improved the hard-family macro over compact-bar v1, had no guard
regression, had no candidate-only paired loss, and kept the required input-token
and output-byte advantage over exact JSON.

Full v0-style compact did not pass one provider gate. Its complete hierarchy
did not give a repeatable advantage that justified its size. Do not infer that
hierarchy has no musical value. This result only rejects this full representation
for the targeted holdout.

The completed initial run does not select a public format. A passing holdout can
select label-only compact for the Phase 8c3 full matrix. Only Phase 8c3 can
unblock Phase 8f.

## Fixed initial run

The run ID was `phase8c2-initial-six-arm-r1`. The protocol SHA-256 was
`b29699fc48f002fd7130cacf543405cbc768feb79f7a9f1d29cf2e6b59643a2d`.
The operator approved the exact 324-call scope before provider calls.

Each provider ran 18 calls on each of six arms. The suite used three fresh
fixtures for each hard family, one fixture for each guard, and three repeats of
one motif prompt for each arm. All 324 calls returned successfully. Each
provider returned the requested model.

The corrected
[analysis](../../../brain/benchmarks/compact-format-v2/runs/2026-09-27-analysis.json)
has SHA-256
`6befaa14cb3d5fd51223934557413fc711ad093ea33d37da01cdbb18ad483266`.
The fixed initial corpus has SHA-256
`cec705be9d1d5514f10171e7ae6f1c6aaeb588dba95638aae37ebe1d84a648dd`.
It has no retained symbolic-format v1 hash overlap.

## Candidate result

| Provider | Candidate | Hard macro delta | Guard delta | Candidate-only losses | Input ratio to exact | Output ratio to exact | Gate |
|---|---|---:|---:|---:|---:|---:|---|
| OpenAI | Label-only | +25.00 points | 0.00 | 0/18 | 0.719 | 0.643 | pass |
| Gemini | Label-only | +8.33 points | 0.00 | 0/18 | 0.684 | 0.536 | pass |
| Claude | Label-only | +8.33 points | 0.00 | 0/18 | 0.754 | 0.692 | pass |
| OpenAI | Full v0-style | +8.33 points | -33.33 points | 3/18 | 0.925 | 0.812 | fail |
| Gemini | Full v0-style | 0.00 points | 0.00 | 0/18 | 0.929 | 0.775 | fail |
| Claude | Full v0-style | +16.67 points | 0.00 | 0/18 | 1.005 | 0.989 | fail |

The frozen hard improvement was 5 points. The maximum guard regression was 5
points. The maximum input ratio was 0.90. The maximum output ratio was 0.80.
At least two providers had to pass, and another provider could not lose more
than 5 hard-macro points.

Label-only compact improved progression generation by one of three fixtures on
OpenAI and Gemini. It improved role continuation by one of three fixtures on
OpenAI and Claude. It did not improve chord revoicing. Every arm scored 0/3 on
chord revoicing for every provider. The holdout must keep that family.

## Cost

| Provider | Approved estimate | Recorded cost | Calls |
|---|---:|---:|---:|
| OpenAI | USD 0.527150 | USD 0.498858 | 108 |
| Gemini | USD 0.396208 | USD 0.296907 | 108 |
| Claude | USD 1.920090 | USD 1.764546 | 108 |
| Total | USD 2.843448 | USD 2.560311 | 324 |

The manifests use API-reported token usage and the provider prices verified on
2026-09-27. The operator dashboards remain the external spend authority.

## Composite failure correction

The per-response scorer classified composite failures separately before the
provider run. The frozen mechanical summarizer then gave the other-parse class
an incorrect all-arm denominator of 108. The corrected analysis uses the 18
eligible composite responses. It reports non-composite parse failures by arm.
Do not use the discarded mechanical summary.

| Provider | Explicit disagreement | Missing or invalid ledger | Native-score parse | Other output or patch parse |
|---|---:|---:|---:|---:|
| OpenAI | 0/16 | 1/17 | 0/17 | 0/18 |
| Gemini | 0/17 | 0/17 | 0/17 | 0/18 |
| Claude | 0/15 | 1/17 | 1/17 | 0/18 |

The explicit-disagreement denominator contains only calls where both native
score and side ledger parsed. The missing-ledger and native-score denominators
contain all 17 composite event responses. The other-parse denominator contains
all 18 composite responses, including the sparse local patch.

The initial reporter self-test now fixes these denominators. The targeted
holdout has no composite arm.

## Sentinel limit

The primary motif scorer required exact IDs for newly generated continuation
notes. The initial prompt did not state those IDs. Therefore, do not use the
primary identity-arm sentinel outcomes as a provider-variation result.

A post-run semantic diagnostic ignored new-note IDs. It found stable 3/3
label-only success on all three providers. Compact-bar v1 varied on OpenAI and
Claude. This diagnostic is not a replacement primary score. The targeted
holdout corrects the contract before calls by giving the exact new-note IDs.

## Run identities

| Provider | Raw-run SHA-256 | Manifest SHA-256 |
|---|---|---|
| OpenAI | `01c4ce52e080794d88aac9d666bcc6c08c8f1a47effb0f8f31ecbf0136634cb6` | `2344e0346b3f4a93296c6a78f8de1fe6fb3cfdffb5a3c4262e042f2541531453` |
| Gemini | `0d83936cb80733d9f8ce99bbc3ac064ce3eaab7aabd9eb52035c3efe4342f372` | `6065629ad2c4f8279c3f6a67605c5b8c95811632637865cbbd282413a5c7797c` |
| Claude | `cf99e2d7ae03adee3d21c7ba2d4937c71bf9c15bc21543a070a0fc4c9e4aca31` | `123cd035f65a6f6256bc0bf1b60cecd4b29f9701876844ba229e63ced5fdf10e` |

## Targeted holdout

The frozen holdout run ID is `phase8c2-targeted-holdout-r1`. Its protocol
SHA-256 is
`1d3787c4230d8c50f2f261a6c9a975bc03e9d79b574c2ca735dab3eb5ca615b5`.
Its fresh corpus SHA-256 is
`c85e511dbcc05aad7f5cd70c64447aa44e9948dd9372f9dbf741fbde52b82b76`.
It has no initial-development or retained-v1 fixture-hash overlap.

The arms are label-only compact, compact-bar v1, exact JSON, and native
MIDI-Like. The scope is 72 calls per provider and 216 calls in total. The
estimated costs are USD 0.415715 for OpenAI, USD 0.264139 for Gemini, USD
1.470455 for Claude, and USD 2.150309 in total. This holdout required separate
operator approval. E142 records that approval and the completed result.

## Verification

The initial analysis self-test passes 8 checks. The holdout self-test passes 70
checks. The holdout deterministic package SHA-256 is
`273b3cbc1099abc2fbf15f2fa5a7854a78a12916ebbea94177bd55f4616f1225`.
No live Bitwig project or cache changed.

## Retrospective

State new-note IDs when a primary continuation score compares identity. Keep a
test for every reported numerator and eligible denominator.
