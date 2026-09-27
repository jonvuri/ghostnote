---
title: E140 — Expanded symbolic-format comparison requires a compact grammar revision
kind: evidence
state: active
updated: 2026-09-27
parent: ../../plan/phase-8/8c1-expanded-symbolic-format-comparison.md
---

# E140 — Expanded symbolic-format comparison requires a compact grammar revision

## Verdict

Develop and hold out compact candidates in Phase 8c2. Then run a fresh full
matrix in Phase 8c3. Do not proceed to the public compact-bar contract before
that matrix gives a `proceed` decision.

Compact-bar stayed inside the frozen 12.5 percentage-point paired rate margin
against every eligible native and composite comparator. This is not an
equivalence result. It also does not pass the stricter decision rule. Each
provider had at least one task family with two or more compact-only losses
against a comparator.

The v1 compact arm used the development shorthand
`N id voice start duration pitch velocity`. It kept compact fields, rational
time, IDs, sparse local patches, and preservation checks. It did not keep the
labeled events and structural headers from compact-bar v0. The v0 text also
declares score fields and omissions and groups bars, tracks, roles, voices, and
regions. A label-only compact arm and a full v0-style arm must therefore remain
separate development hypotheses. Do not tune on the v1 retained outputs.

The result does not change the cache contract or a live Bitwig project. E138
and E139 remain the cache authorities.

## Fixed package

The reusable package is
[symbolic-format v1](../../../brain/benchmarks/symbolic-format-v1/README.md).
It contains generated MIT material only.

| Identity | SHA-256 |
|---|---|
| Corpus | `87b4d1b5b0fcb798058b482b583eaf98f08c97ef648bedaf779a5368c4d8a3be` |
| Deterministic package | `1018c31c5cc2f2777794d6ab9db5d89f475f421b8b34de9ddbec888337a662a0` |
| Protocol | `eae49b356692fc75f4c1733f9b3426ce60e0bdd8f3b0b62bdf6d374b3e4097c9` |
| Frozen pilot decision | `525a4a91be8616cd432d1e7867c68b4ec8970f1bba27a8f5244972e6ea1665d3` |
| Retained summary | `d29cf4f80c592908d532171a4620336b437548323fbcb4d525e4a1f402c54ddc` |

The package has 13 arms. It includes exact JSON, compact-bar, one-cycle
mini-notation, and native and composite pairs for ABC 2.1, Alda, MIDI-Like,
REMI+, and OctupleMIDI. The corpus has nine development fixtures, 63 retained
fixtures, and five secondary fixtures. Each core family has seven retained
variants. The first three are mandatory. Variants four through seven support
the frozen adaptive rule.

All 13 format round trips pass. All 784 eligible perfect-response task checks
pass. The one-cycle parser rejects events outside its declared cycle. Native
arms do not gain Ghostnote identity or preservation scores.

Music21 10.5.0, Musicpy 7.16, and the repository Tonal packages pass their
known-pass, near-miss, and known-fail controls. Musicpy 7.15 from E110 was no
longer available for this Python runtime. The v1 package pins 7.16 and records
the executed version.

## Provider protocol

The retained run used these requested and returned models:

| Provider | Requested and returned model | Setting |
|---|---|---|
| OpenAI | `gpt-5.4-mini-2026-03-17` | Low reasoning |
| Google | `gemini-3.8-flash` | Low thinking |
| Anthropic | `claude-sonnet-5` | `output_config.effort=low` |

Each call returned a common JSON envelope with one payload string. The format
parser validated the payload separately. No retry replaced a valid low-scoring
response. The retained manifests record latency, usage, cached usage, cost,
retries, stop reason, request identity, model identity, and raw-response hash.

The pilot froze a descriptive paired margin of 12.5 percentage points. It did
not claim population equivalence. A cell stopped at three when all outcomes
agreed. A mixed cell added variants four and five. A cell that stayed mixed
added variants six and seven.

## Retained result

Adaptive trial counts differ by arm. Do not rank arms from their unpaired raw
totals. Use the paired rows in the summary.

The
[complete retained result matrix](../../../brain/benchmarks/symbolic-format-v1/runs/2026-09-27-report.md)
includes every provider, task family, arm, paired comparison, sentinel,
stopping result, and secondary case. It links to the per-call manifests.

| Provider | Compact paired delta range | Comparator gates passed | Repeated compact-only families that failed a gate |
|---|---:|---:|---|
| OpenAI | +6.98 to +51.85 points | 8/10 | Generation melody and progression |
| Gemini | +2.86 to +38.71 points | 2/10 | Chord revoicing |
| Claude | 0.00 to +44.44 points | 8/10 | Role continuation and progression generation |

No paired rate crossed the negative margin. The decision is still `revise`
because the frozen rule also rejects repeated compact-only failures. The
mechanical summary calls this a material observed deficit. More precisely, it
is a provider-specific task-family deficit, not a negative aggregate paired
rate.

Compact-bar passed exact represented reconstruction, harmonic analysis, local
transformation, and rhythmic transformation in all three providers. Its
syntax result was 43/43 for OpenAI, 41/43 for Gemini, and 35/35 for Claude.
This separates the failed musical constraints from general parser failure.

The exact JSON arm did not remove the hard-task variation. For example,
OpenAI scored compact progression at 1/7 and exact JSON at 2/7. Gemini scored
compact revoicing at 3/7 and exact JSON at 5/7. Claude scored compact role
continuation at 0/3 and exact JSON at 4/7. These are decision-critical
differences, but they do not show one general syntax winner.

## Compact size result

On paired compact and exact calls, compact kept its size advantage:

| Provider | Paired calls | Compact success | Exact success | Input-token change | Output-byte change |
|---|---:|---:|---:|---:|---:|
| OpenAI | 43 | 28 | 27 | -21.0% | -69.5% |
| Gemini | 31 | 23 | 23 | -23.6% | -70.7% |
| Claude | 35 | 25 | 23 | -26.3% | -69.8% |

This v1 token result is prompt-specific. It is smaller than exact JSON, but its
compact grammar differs from the v0 labeled events and structural headers.
Recheck size for each developed candidate.

## Native and composite boundary

Native arms used no Ghostnote IDs, duplicated exact events, or Ghostnote-only
labels. Native local transformations returned a complete score. The scorer
derived a canonical event diff. It did not claim stable identity or exact
preservation.

Composite arms added exact GN side ledgers. On common native and composite
trials, the ledgers had these observed costs:

| Provider | Paired native/composite calls | Mean input-token overhead | Mean output-byte overhead | Broad composite failures |
|---|---:|---:|---:|---:|
| OpenAI | 191 | 126.3 | 181.7 | 50 |
| Gemini | 175 | 146.9 | 199.6 | 48 |
| Claude | 179 | 175.9 | 135.0 | 49 |

The scorer's broad composite counter marks every composite exception as an
alignment failure. It therefore includes score parsing, ledger parsing, and
patch parsing in addition to an explicit disagreement. It is not an exact
score-ledger disagreement count.

Across retained non-sentinel composite event calls that required a score and
ledger, explicit disagreements occurred in 34 of 161 OpenAI calls (21.1%), 34
of 153 Gemini calls (22.2%), and 42 of 169 Claude calls (24.9%). Another 15,
18, and 19 calls, respectively, had a different parse error. Future reports
must keep these classes and their denominators separate.

The composite musical-success change was not consistent. It ranged from 0.0
to +9.68 points on OpenAI, -2.86 to +12.90 points on Gemini, and -11.43 to
+16.13 points on Claude. A side ledger can help with exact task fields. It can
also disagree with the score. Its identity capability does not make its
musical result a native-format result.

## Mini-notation boundary

The mini arm used one declared cycle and no hidden unrolling, probability,
alternation, cross-cycle state, or side ledger. It joined four eligible task
families. It stayed ineligible for stable finite identity and preservation.
Its result is a bounded native-pattern result, not a product-contract result.

## Nondeterminism and stopping

The repeated-prompt sentinels changed outcome in 5 of 27 OpenAI cells, 1 of 27
Gemini cells, and 4 of 27 Claude cells. Every cell that was mixed after three
trials stayed mixed after five. The run therefore extended those cells to
seven.

The adaptive rule still saved calls against the 817-call maximum:

| Provider | Retained calls | Maximum calls | Calls saved | Retained cost |
|---|---:|---:|---:|---:|
| OpenAI | 553 | 817 | 264 | USD 2.083530 |
| Gemini | 509 | 817 | 308 | USD 1.476243 |
| Claude | 541 | 817 | 276 | USD 4.759570 |

Claude's observed first-two-provider extension rate projected an overrun of
the USD 5 total-provider planning ceiling after development pilots. The
operator approved the overrun before retained Claude calls. Retained Claude
calls stayed below USD 5. Including observed development calls, the provider
totals were at least USD 2.422717 for OpenAI, USD 1.681469 for Gemini, and
USD 5.489682 for Claude.

One successful OpenAI diagnostic repeat discarded its usage record before the
manifest replacement call. The OpenAI total is therefore a lower bound by one
call. The matching retained call cost USD 0.007528. All retained calls, tasks,
formats, and provider costs remain explicit in the manifests.

The first integration pilot manifests were overwritten during adapter
development. Their console cost totals were USD 0.120007 for OpenAI,
USD 0.096470 for Gemini, and USD 0.194438 for Claude. The retained package keeps
the later `pilot-r1` and final pilot manifests. Do not use the missing first
pilot calls in a score comparison.

## Secondary result

Each provider passed all five initial secondary cases. These covered malformed
notation, a masked required value, score-ledger disagreement, a duplicate ID,
and an unsupported native identity request. Each exact-feedback repair also
passed. Initial and repaired results remain separate.

## Cause separation

- Compact syntax and parsing were reliable. The failed rows were musical
  constraint failures.
- The v1 shorthand changed the compact grammar. This is a grammar cause and
  needs a fresh-cohort correction.
- No-source generation and continuation tasks still changed with the output
  grammar. Missing input musical structure does not explain those cells.
- Side ledgers added exact fields and identity. Explicit score-ledger
  disagreements were a practical risk. Other composite parse failures were a
  separate risk.
- Native musical success did not add stable IDs, sparse edits, conflict checks,
  or omitted-field preservation.
- The compiler supplied identity validation and preservation. A notation win
  did not supply those product capabilities.
- Sentinel changes show provider variation. Do not pool away a provider-only
  failure.

## Decision and next change

Phase 8f remains blocked. Phase 8c2 now owns a focused development loop:

1. Start with compact-bar v1, label-only compact, full v0-style compact, exact
   JSON, MIDI-Like native, and MIDI-Like composite.
2. Use fresh stress fixtures for the hard task families and small easy-family
   guards on all three providers.
3. Test later bounded hypotheses when the prior iteration supports them.
4. Require a fresh targeted holdout to select one or more compact candidates.
5. Estimate every provider-bearing run and get explicit operator approval
   before making its calls. The former USD 5 soft ceiling does not apply.

Phase 8c3 then owns a new full retained matrix with the selected candidate or
candidates. Only its `proceed` decision can unblock Phase 8f.

Do not change cache contracts, stable identity rules, or compiler enforcement
to fix a provider musical-task result.

## Run identities

| Provider | Raw-run SHA-256 | Manifest SHA-256 |
|---|---|---|
| OpenAI | `ce4ab84e8f089dcdd131ca242aefb27ea0e8a4df17edcc696ae0ccb8ce1bbc6f` | `d96abb5d9f3f9a85e3befa312c7665e69cdc9404dc1090fe22b1c46a97df95d2` |
| Gemini | `7601c12dab106ac172b9f8f491faedfada552456d650c33f6cba824936a7950e` | `49236673a1a6858f8ba5c714c8df8d97c6c0ef2ad1314d103afdb0f1c44bd0a4` |
| Claude | `874e3fa27f846266c9babacb13865b56c59d589126f95bc87b7918026a28d3f6` | `2116fb202c4e1be2dbf159427569ed8d7c637112579efdf075e0bb70ac7f103f` |

## Verification and cleanup

The deterministic self-test passes 21 checks. The pinned deterministic check,
Music21 and Musicpy controls, and Tonal controls pass. The complete brain check
passes 1,206 tests. The context check passes 375 active documents with intact
links. A new summary from the three retained manifests and frozen pilot is
byte-for-byte equal to the retained summary. The v0 deterministic checks and
recorded file hashes are unchanged. The staged diff check is part of the
session handoff.

No API key, provider cache, third-party composition, live project data, audio,
or MIDI file is retained. No live Bitwig write or cache change occurred.

## Retrospective

A renderer-parity assertion against compact-bar v0 would have caught the
unlabeled v1 shorthand before provider calls. Add that assertion before the
first development run. Keep provider-protocol hashes separate from post-run
summary code so a report-label fix does not appear to change the frozen
provider protocol.
