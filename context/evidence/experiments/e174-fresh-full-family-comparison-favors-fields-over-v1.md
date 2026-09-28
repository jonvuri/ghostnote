---
title: E174 — Fresh full-family comparison favors FIELDS over v1
kind: evidence
state: active
updated: 2026-09-28
parent: ../../plan/phase-8/8c4c-compact-bar-paired-development.md
---

# E174 — Fresh full-family comparison favors FIELDS over v1

## Verdict

The fresh full-family comparison is complete. `FIELDS` is the stronger compact
arm. It beat positional v1 on every provider and had near-perfect syntax.

The result does not establish parity with exact-object JSON. Exact JSON won on
OpenAI and Gemini, while `FIELDS` won on Haiku. Do not start holdout from this
comparison alone.

## Result by provider

Each full-pass cell uses 24 planned unique results. Each syntax cell uses the
same denominator.

| Provider | Measure | Exact JSON | Positional v1 | `FIELDS` |
|---|---|---:|---:|---:|
| OpenAI | Strict full pass | 9 | 5 | 8 |
| OpenAI | Strict syntax | 21 | 19 | 23 |
| Gemini | Strict full pass | 14 | 7 | 8 |
| Gemini | Strict syntax | 23 | 24 | 24 |
| Haiku | Strict full pass | 8 | 8 | 15 |
| Haiku | Strict syntax | 17 | 14 | 24 |
| **Total** | **Strict full pass** | **31/72** | **20/72** | **31/72** |
| **Total** | **Strict syntax** | **61/72** | **57/72** | **71/72** |

One Haiku analysis result was unavailable for exact JSON and one was
unavailable for positional v1. They remain failures in the planned-denominator
totals.

## Result by family

Each cell uses 24 planned unique results across the three providers.

| Family | Measure | Exact JSON | Positional v1 | `FIELDS` |
|---|---|---:|---:|---:|
| Analysis | Strict full pass | 10 | 7 | 10 |
| Analysis | Strict syntax | 22 | 23 | 24 |
| Motif | Strict full pass | 15 | 11 | 18 |
| Motif | Strict syntax | 19 | 17 | 23 |
| Progression | Strict full pass | 6 | 2 | 3 |
| Progression | Strict syntax | 20 | 17 | 24 |

The known prompt defects did not recur. No `line`, delimiter, `BASE none`, or
legacy `ANALYSIS` label failure affected `FIELDS`. Its only syntax failure was
one noncanonical OpenAI motif ordering.

Analysis improved from positional v1 in aggregate, but the effect varied by
provider. Motif gave the cleanest positive result: `FIELDS` matched or beat v1
on every provider and led the pooled count.

Progression remained at a floor. `FIELDS` had perfect progression syntax but
passed only 3/24 musical checks. Exact JSON passed only 6/24. The dominant
failures were coverage, voice-range, cadence, and voice-movement checks. This
family mainly measures constraint reasoning at the current difficulty. It is
not a useful format discriminator without a task change.

## Repeat behavior

Strict pass state repeated on 7/9 `FIELDS` sentinels, 9/9 positional-v1
sentinels, and 5/9 exact-JSON sentinels. The two `FIELDS` changes were Gemini
and Haiku progression cases. This supports the conclusion that progression is
noisy at its current floor.

## Calls and cost

| Provider | Message requests | Token-count requests | Cost |
|---|---:|---:|---:|
| OpenAI | 81 | 0 | USD 0.460206 |
| Gemini | 81 | 0 | USD 0.179820 |
| Haiku | 81 | 81 | USD 1.343300 |
| **Total** | **243** | **81** | **USD 1.983326** |

All 243 provider requests completed. No provider transport failure, automatic
retry, repair call, or budget stop occurred in the valid run. The cost stayed
below the USD 2.450000 hard limit.

The provider manifest SHA-256 values are:

- OpenAI:
  `ffaa4200b8a1f14a8863128fadf11a8cc8e16e3738ba9b39b4be44e939bc82d8`;
- Gemini:
  `07b24a6283161ef876c5358a7aa023799787a9a9af589aa278ce2288ec4a4557`;
  and
- Haiku:
  `4f77c8a40dacd12a5d81c99c863e5287a6b17b92e20c62b937531355940ac4ba`.

The summary SHA-256 is
`8eb0ae634c09b968c554f3608893f7b7c63f71389c5639a019d274f7ec5a5e4f`.

## Sandbox incident

The first launch ran without external network access. Its local loop processed
DNS failures and printed them as completed work. No provider request completed
and its recorded cost was zero. The operator identified the implausibly fast
finish.

The approved frozen jobs were then launched with external network access. The
valid manifests above contain only those fresh results. The failed local
manifests remain as `*-sandbox-blocked.json` for audit. They did not enter the
summary.

## Consequence

[E175](e175-fresh-failure-audit-finds-fields-good-enough.md) audits 25 fresh
fixtures and all 75 paired arm outputs. It finds no remaining simple `FIELDS`
defect and identifies one optional local-label hypothesis.

Retire positional v1 as the active compact candidate. Keep `FIELDS` as the
only compact candidate worth further consideration. This comparison supports
`FIELDS` over v1, but it does not select `FIELDS` over exact JSON.

Do not buy another provider run now. First decide whether compactness justifies
the provider-specific loss against exact JSON. If a formal selection test is
still necessary, repair or replace the progression family before freezing it.

Phase 8c4c remains active. Phase 8c4d and Phase 8f remain blocked.

## Retrospective

Make progress output distinguish processed, completed, and failed jobs. Add a
network preflight before a paid-provider loop.
