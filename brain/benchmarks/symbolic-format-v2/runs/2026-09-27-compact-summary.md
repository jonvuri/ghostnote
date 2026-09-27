# Phase 8c3 compact result summary

## Bottom line

No format won every dimension.

- `compact-bar` had the best observed musical rate and the best broad balance
  of accuracy, syntax, and size. It does not have the complete document and
  patch capabilities needed for Phase 8f.
- `exact-object-json-midi` was the strongest full-capability candidate. It was
  more musically reliable than tuple JSON, but it still failed 16 paired gates.
- `tuple-json-midi` was the smaller full-capability candidate. It used fewer
  tokens and bytes than exact-object JSON, but it failed 30 paired gates.
- `midi-like-composite`, `exact-json`, and `midi-like-native` were useful
  controls. Each was competitive on some measures, but none was eligible as
  the selected full musical document.

## Broad observed standing

These totals pool the available provider results. They are descriptive only.
The adaptive rule gave formats different trial counts, so the frozen paired
gates remain the decision authority.

| Format | Role | Musical | Syntax | Input tokens | Output bytes | Cost | Main strength |
|---|---|---:|---:|---:|---:|---:|---|
| `compact-bar` | Compact control | 85/117, 72.6% | 116/117, 99.1% | 47,076 | 26,465 | USD 0.538313 | Best broad accuracy and efficiency balance |
| `midi-like-composite` | Native-like control with ledger | 84/121, 69.4% | 120/121, 99.2% | 76,660 | 75,343 | USD 0.942060 | Strong structured notation result |
| `exact-object-json-midi` | Full-capability fallback | 88/128, 68.8% | 126/128, 98.4% | 186,586 | 189,401 | USD 1.806531 | Best complete candidate |
| `exact-json` | Phase 8c1 JSON control | 85/125, 68.0% | 125/125, 100.0% | 66,059 | 86,737 | USD 0.940756 | Best syntax reliability |
| `midi-like-native` | Native-like control | 93/137, 67.9% | 132/137, 96.4% | 65,332 | 67,637 | USD 0.825259 | Good accuracy with moderate size |
| `one-cycle-mini` | Narrow specialist | 38/56, 67.9% | 51/56, 91.1% | 17,882 | 5,642 | USD 0.282579 | Smallest output, but limited task coverage |
| `tuple-json-midi` | Preferred full-capability candidate | 81/128, 63.3% | 127/128, 99.2% | 139,934 | 98,542 | USD 1.253899 | Smaller complete representation |

The full-capability rates exclude the two Gemini output-limit rows. Resource
totals retain those calls because the provider reported their usage. Costs
cover the corrected retained run only. Other rows match the retained report.

## Best by provider

- OpenAI: `compact-bar` had the highest observed musical rate at 72.1%.
- Gemini: `exact-json` led at 77.4%. Exact-object JSON and
  `midi-like-composite` followed at about 74%.
- Claude: `one-cycle-mini` reached 80.0% on its narrow task set. `compact-bar`
  was the strongest broad format at 77.1%. Exact-object JSON reached 74.5%.

This variation is why one pooled average was not enough for promotion.

## The full-capability tradeoff

Exact-object JSON was the better complete format in this run. Compared with
it, tuple JSON used about 25% fewer input tokens, 48% fewer output bytes, and
31% less cost. The savings came with a lower observed musical rate and almost
twice as many failed paired gates.

| Candidate | Musical | Syntax | Failed paired gates | Result |
|---|---:|---:|---:|---|
| `exact-object-json-midi` | 68.8% | 98.4% | 16 | Not eligible |
| `tuple-json-midi` | 63.3% | 99.2% | 30 | Not eligible |

The rule allowed at most three failed gates for a `revise` result. Exact-object
JSON was the closest candidate, but 16 failures were not close to that limit.

## What `block` means

`Block` is a release-gate result. It does not mean that every tested format is
bad or unusable. It means the evidence does not support freezing any tested
format as Ghostnote's public musical document.

Phase 8f must not start because:

1. neither full-capability candidate passed every required paired comparison;
2. both candidates failed on both complete providers, OpenAI and Claude; and
3. Gemini had two unavailable output-limit results, so its provider run was
   incomplete.

The decision is final for this retained cohort. Do not tune a format against
these fixtures and rerun them as if they were fresh evidence. Further work
needs a new bounded hypothesis, a new protocol, a new cohort, and new cost
approval.

The full detail is in `2026-09-27-report.md`. The retained summary SHA-256 is
`a70d7f6159e5edf79227aac5d859bdce899170bc4ed4f2349a8d7fb270cabdd1`.
