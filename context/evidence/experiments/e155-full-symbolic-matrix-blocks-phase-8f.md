---
title: E155 — Full symbolic matrix blocks Phase 8f
kind: evidence
state: active
updated: 2026-09-27
parent: ../../plan/phase-8/8c3-full-symbolic-format-matrix.md
---

# E155 — Full symbolic matrix blocks Phase 8f

## Verdict

The Phase 8c3 decision is `block`. Do not select tuple JSON or exact-object
JSON as the public musical document. Keep Phase 8f blocked.

Both candidates pass every deterministic capability check. Neither candidate
passes the frozen provider comparison gates. Exact-object JSON fails 16 paired
gates. Tuple JSON fails 30 paired gates. If Gemini is excluded, exact-object
JSON still fails 14 gates and tuple JSON still fails 28 gates. The decision
does not depend on Gemini's incomplete evidence.

Do not revise a format against this retained cohort.

## Provider runs

The corrected run made 1,907 calls and reports USD 15.061248. This total does
not include the 435 OpenAI calls from the stopped attempt in [E154](e154-provider-run-stops-at-usage-accounting-regression.md).
The stopped attempt did not retain token use or cost. Confirm its cost in the
OpenAI dashboard.

| Provider | Calls | Complete | API-reported cost | Raw response SHA-256 | Manifest SHA-256 |
|---|---:|---|---:|---|---|
| OpenAI | 681 | yes | USD 2.677458 | `34f188bd0e838fe0667ba31dd702474bfe692b4cff0b3bf2693639eab79ebff8` | `c3209454055dedda136775a18872573dbef6c0d15a7c09de197decc17628fb29` |
| Gemini | 573 | no | USD 1.998213 | `d97b0fd3cba6d26f543acc9b731ffc570ed646b1a02fc5cdf9decac0283886eb` | `18a77abd6ad0b6cd8031cc495b4159078add354f2866d6909e8a80cc5d3d9409` |
| Claude | 653 | yes | USD 10.385577 | `36a29bab499dd291690fe7851c93be4bd9b15ed23a01e871409957005a035ee2` | `9761aac1f2930574a1bd450e9610bbf13c0f00b717e8347db1cf0e363b3461ff` |

Gemini reached its 7,000-token output limit on continuation-motif variant 2
for both full-capability candidates. The protocol marks these two results
unavailable and the Gemini run incomplete. It does not permit a retry.

## Candidate result

| Candidate | OpenAI failed gates | Gemini failed gates | Claude failed gates | Total |
|---|---:|---:|---:|---:|
| Exact-object JSON with MIDI integers | 8 | 2 | 6 | 16 |
| Tuple JSON with MIDI integers | 14 | 2 | 14 | 30 |

The failures are not limited to one provider. OpenAI and Claude each reject
both candidates under the frozen gate. Tuple JSON has repeated losses in
structure comprehension and other families. Exact-object JSON has fewer
failures, but it still does not meet the all-comparators, all-providers rule.

The summary SHA-256 is
`a70d7f6159e5edf79227aac5d859bdce899170bc4ed4f2349a8d7fb270cabdd1`.
The report does not claim population equivalence.

## Reporting limit

The frozen summary correctly returns `block` when one provider is incomplete.
Its descriptive Gemini arm totals and affected paired rows count the two
output-limit results as failures. Do not use those two rows as zero scores.
Use the run manifest to identify them as unavailable. This reporting limit
does not change the decision because OpenAI and Claude independently fail many
candidate gates.

## Side-ledger result

Composite side ledgers add input tokens and output bytes in every measured
provider and notation pair. Their musical delta varies by provider and format.
It ranges from -8.57 to +14.29 percentage points. This result does not support
a general side-ledger accuracy claim.

The corrected failure classes remain separate. The retained runs report 90
explicit score-ledger disagreements, 42 native score parse failures, and one
other output or patch parse failure across the composite arms. They do not
relabel broad output failures as ledger disagreements.

## Retained artifacts

- `brain/benchmarks/symbolic-format-v2/runs/2026-09-27-openai.json`
- `brain/benchmarks/symbolic-format-v2/runs/2026-09-27-gemini.json`
- `brain/benchmarks/symbolic-format-v2/runs/2026-09-27-claude.json`
- `brain/benchmarks/symbolic-format-v2/runs/2026-09-27-summary.json`
- `brain/benchmarks/symbolic-format-v2/runs/2026-09-27-report.md`
- `brain/benchmarks/symbolic-format-v2/runs/2026-09-27-compact-summary.md`

## Retrospective

Test helper binding before paid calls. Also test that every incomplete result
stays outside scored denominators. The first check is now in the harness. The
second remains a reporting limitation on this frozen result.
