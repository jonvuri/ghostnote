---
title: E144 — Calibration rejects the progression floor
kind: evidence
state: active
updated: 2026-09-27
parent: ../../plan/phase-8/8c2-2-measurement-repair-and-grouped-compact-iteration.md
---

# E144 — Calibration rejects the progression floor

## Verdict

Return `repair-measurement` and stop provider work. Progression generation is
below the frozen eligibility band on OpenAI and Gemini. Role continuation and
revoicing are informative on two providers. Do not start development.

The repair is bounded. Replace the one four-class chord with a triad and state
full pitch-class coverage explicitly. Keep the exact grouped-label candidate,
renderer, parser, scorer, providers, models, settings, and eligibility band.
Use a fresh four-fixture progression cohort. A new provider run needs separate
approval.

## Completed calibration

The completed run ID is `phase8c2-2-calibration-r1`. All three providers
completed 70/70 calls with no transport errors. Every response reports the
requested model. The calibration summary SHA-256 is
`739b1a4fb2de14eb2e0272cd97f81e2d586c44c89fe0438a6fa104d80b5854c4`.
The verified report SHA-256 is
`5a33ee1f7824a7c05a10418d962103e91e0dbc9c0076f9c07aac9b3a282ef909`.

The frozen rule pools exact JSON and native MIDI-Like within each provider and
family. A decision family must score from 0.20 through 0.90 on at least two
providers.

| Family | OpenAI controls | Gemini controls | Claude controls | Eligible providers | Result |
|---|---:|---:|---:|---:|---|
| Progression | 1/6, 0.167 | 1/6, 0.167 | 4/6, 0.667 | 1 | reject |
| Role continuation | 6/6, 1.000 | 5/6, 0.833 | 5/6, 0.833 | 2 | eligible |
| Revoice | 5/6, 0.833 | 6/6, 1.000 | 5/6, 0.833 | 2 | eligible |

Melody scored 2/2 on each provider control pool. It stays a regression family
because the ceiling remains.

## Progression diagnosis

The progression parser and structural scorer are not at a floor. All six
OpenAI and all six Gemini control responses passed chord starts, named voices,
cadence, and total voice leading. Only 1/6 on each provider passed harmony and
bass inversion.

The task used three triads and one four-class chord. It supplied four SATB
voices. OpenAI and Gemini usually kept the correct bass and used allowed pitch
classes, but they often omitted one required class from the four-class chord.
The prompt serialized `pitch_classes` in the contract but did not state in
plain text that every listed class needed coverage. The scorer required full
coverage. Calibration therefore found a task difficulty and wording defect
before development.

## Cost

| Provider | Approved estimate | Recorded cost | Calls |
|---|---:|---:|---:|
| OpenAI | USD 0.404167 | USD 0.251653 | 70 |
| Gemini | USD 0.256802 | USD 0.152980 | 70 |
| Claude | USD 1.429609 | USD 1.076673 | 70 |
| Total | USD 2.090578 | USD 1.481306 | 210 |

The operator should compare these values with the provider dashboards.

## Run identities

| Provider | Raw-run SHA-256 | Manifest SHA-256 |
|---|---|---|
| OpenAI | `bc5ed7c04606aa9e4282a5879d37d7b59ffbee689f1f55b388712fa015e8ef9e` | `b77a5b8218e74ae1161e9da355194bbac600603e0b2eae3e1b708be97c8cecc9` |
| Gemini | `178137b2c5e6d83ad466a1ada42036355b974632e12291d18b4a3b67d7792954` | `011f62da0035730c144d87f3f191701109b35b5f25dd5636dc73926aaf06ce5e` |
| Claude | `41cf6c2ac4087f060c04ef00d549e5a91d35cec8d240d315483defcfbaabea66` | `d6d83f12f0138da71b4f7143d782d2e1492b589e8dc83fd285f02cc8714cb05c` |

## Frozen repair calibration

The repair run ID is
`phase8c2-2-progression-repair-calibration-r2`. It changes only the
progression measurement:

- every chord is a triad;
- the prompt requires every listed pitch class at least once;
- the fourth voice can double a listed class; and
- four fresh semantic fixtures replace the rejected calibration fixtures.

The five arms and three providers stay unchanged. Each provider gets 20 calls,
for 60 calls total. The exact JSON and native MIDI-Like controls remain the
eligibility pool.

| Provider | Model | Settings | Calls | Estimated cost |
|---|---|---|---:|---:|
| OpenAI | `gpt-5.4-mini-2026-03-17` | low reasoning, 3,000 maximum completion tokens | 20 | USD 0.115476 |
| Gemini | `gemini-3.8-flash` | low thinking, 3,000 maximum output tokens | 20 | USD 0.073372 |
| Claude | `claude-sonnet-5` | low effort, 3,000 maximum tokens | 20 | USD 0.408460 |
| Total | — | provider default temperature | 60 | USD 0.597308 |

The repair corpus SHA-256 is
`0515ade7051a8fe82d72bd1425983877c5777e95d1b982a3843e65836269e38c`.
The protocol SHA-256 is
`31693cf6c5f4b5d2141bbe22796886be7c036c3461ee4be6a62c2332a83e2327`.
The run-plan SHA-256 is
`4b96befe3dfd8111aef5d05ec705200284d85a5385551f1f73de00b1c285e6c3`.
The deterministic package passes 48 checks with SHA-256
`1012e7fd61a33a28707e066d18868f2a2cc22baaff3e14cefafa878d5ad61333`.

The operator later approved this exact repair calibration.
[E145](e145-progression-repair-passes-and-development-freezes.md) records its
completed result and the separate development freeze.

## Retrospective

The calibration stopping rule worked. It stopped development after one family
showed a provider floor. Add plain-text coverage requirements when a compact
contract array means full set coverage. Deterministic reference and mutation
tests prove scorer consistency, but they do not prove suitable provider task
difficulty.
