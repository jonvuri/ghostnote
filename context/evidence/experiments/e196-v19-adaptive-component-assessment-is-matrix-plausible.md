---
title: E196 — V19 adaptive component assessment is matrix-plausible
kind: evidence
state: active
updated: 2026-09-29
parent: ../../plan/phase-8/8c4e-compact-only-full-benchmark.md
---

# E196 — V19 adaptive component assessment is matrix-plausible

## Verdict

The Phase 8c4e result is `matrix-plausible` under the operator-approved product
interpretation. Every measured provider-family-candidate cell passes its
component gate. OpenAI and Gemini pass all 20 cells. Claude Haiku passes all 18
measured cells across eight families. Its two analysis cells remain explicitly
unavailable.

A three-provider sampled audit found one invalid analysis component. The v19
generator transposed chord content without transposing `key_tonic_pc`. All 21
stored function labels were therefore inconsistent with the prompts. The
corrected assessment excludes only `functions` and retains the other seven
independent analysis components. No provider rerun was necessary.

Canonical form, structural parse, and average case accuracy remain useful
diagnostics. They are not separate product gates. The product can normalize a
structurally parsed document with deterministic downstream logic.

This result makes a later matrix plausible. It does not authorize matrix calls
or select a public format.

## Component result

The adaptive assessment uses a 70 percent component floor for decision
families and a 90 percent floor for serialization. It requires 80 percent
scored coverage within a measured cell.

| Provider | Candidate | Components | Passed cells | Unavailable cells |
|---|---|---:|---:|---:|
| OpenAI | `FIELDS` | 97.4128% | 10/10 | 0 |
| OpenAI | Local labels | 94.9158% | 10/10 | 0 |
| Gemini | `FIELDS` | 98.2551% | 10/10 | 0 |
| Gemini | Local labels | 98.3454% | 10/10 | 0 |
| Claude Haiku | `FIELDS` | 97.7728% | 9/9 measured | 1 |
| Claude Haiku | Local labels | 96.0229% | 9/9 measured | 1 |

The lowest measured cells also pass:

- OpenAI `FIELDS` analysis: 84.5238 percent.
- OpenAI local-label affine: 79.7727 percent.
- Gemini `FIELDS` melody: 81.7308 percent.
- Gemini local-label melody: 84.6154 percent.
- Claude `FIELDS` progression: 82.1429 percent.
- Claude local-label progression: 84.8214 percent.

Claude melody scored 7/8 prompts in each candidate. Both cells exceed the 80
percent coverage requirement and pass their component gates.

## Analysis and revoice repairs

The corrected analysis scores are 84.5238 and 81.5476 percent for OpenAI
`FIELDS` and local labels. They are 83.9286 and 95.8333 percent for Gemini.
All four cells remain above the 70 percent gate.

The original revoice scorer aligned notes by undisclosed synthetic output IDs.
The first adaptive scorer could couple one field error to other fields and did
not reject extra notes. The corrected scorer finds the maximum field agreement
within each exact onset and requires the expected note count. It scores voice,
start, duration, pitch, velocity, and six response-level components. Output ID
behavior remains a diagnostic.

| Provider | `FIELDS` | Local labels |
|---|---:|---:|
| OpenAI | 97.4138% | 97.4138% |
| Gemini | 99.7126% | 97.4138% |
| Claude Haiku | 94.8276% | 91.6667% |

All six repaired cells pass. The scorer reuses retained responses. It makes no
provider call.

The audit also found two bounded prompt limits. The affine prompt does not
define `first_voice_start` explicitly. The revoice prompt does not fully define
the `nearest` tie-break, voice, or velocity behavior. These limits do not change
a cell gate. Keep exact revoice accuracy as an approximate product diagnostic.

## Claude continuation

Claude's first three analysis calls exhausted the 12,000-token response limit.
Two rhythm calls completed. A 24,000-token analysis recovery also exhausted its
limit, and the next request was interrupted. Those two recovery requests did
not produce a manifest. The continuation therefore reserves their full USD
0.264000 maximum cost.

The next continuation excluded Claude analysis, retained the two scored rhythm
calls, and completed the other eight families with the original settings. It
made 130 new calls. Two melody calls were unavailable. It had no transport or
budget failure.

| Provider | Planned | Scored | Unavailable | Known cost |
|---|---:|---:|---:|---:|
| OpenAI | 148 | 148 | 0 | USD 0.713277000 |
| Gemini | 148 | 148 | 0 | USD 0.343727250 |
| Claude Haiku | 148 | 130 | 5 | USD 1.781972000 |
| **Total** | **444** | **426** | **5** | **USD 2.838976250** |

The maximum cost exposure is USD 3.102976250 after the unretained USD 0.264000
reservation. This remains below the approved USD 5.550000 total limit.

## Size direction

Across the 213 scored responses per candidate, `FIELDS` averaged 470.7 response
bytes. Local labels averaged 815.3 bytes. `FIELDS` responses were 42.3 percent
smaller. Its prompts were 14.5 percent smaller.

`FIELDS` also had higher aggregate component accuracy on OpenAI and Claude.
Gemini local labels led by 0.0903 percentage point. Across the three providers,
`FIELDS` scored 97.8143 percent and local labels scored 96.4355 percent. These
are useful product signals, not a causal syntax claim.

## Artifacts

| Item | SHA-256 |
|---|---|
| Adaptive policy file | `84f5df0e07d56a040911f97bf245df37a83eb729ac8e9a3a3de4ce654990c511` |
| Adaptive assessment identity | `c47ba4d23822cdc25f913ff3993c4ac0dd5760b8722b271ef14eeffdee90628d` |
| Adaptive assessment file | `bf5e5a76b24b1869624db3038e76a74cd37145e9d8b0e409c6bd485f296e149b` |
| Gemini manifest identity | `a7fae1495802957b67bec03bae5ac51fa6f70b9721112d75a92e53f647988c42` |
| Gemini manifest file | `af6df711d5ae265d2242e547ed9dfd71ea3df800b9409e6723a72f72486d90e8` |
| Claude partial identity | `b26d7a99b48effe9178fb713beac6a20918ce2487ec3dc09f4dc7b006f751b4c` |
| Claude completed identity | `60d05d1b85492265e6f89d81eac253384b45b7cafb207a9479804d6ed7ed2e1e` |
| Claude completed file | `6fd68403cf27e752d5996923b9d4538f42d087f8a936678b69a75114d3443178` |

The adaptive assessment reproduces from the three retained provider artifacts.

## Retrospective

Keep fixtures, provider responses, scoring components, conformance diagnostics,
and decision policy as separate modules. Repair the smallest invalid layer and
reuse the others. Refresh fixture parameters and prompts only when new provider
work needs fresh tasks.

Restore the analysis reference-contract assertion in the next generator. A
freshness transform must update every dependent musical field.
