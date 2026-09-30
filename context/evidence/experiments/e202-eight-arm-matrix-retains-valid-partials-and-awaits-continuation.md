---
title: Eight-arm matrix retains valid partials and awaits continuation
kind: evidence
state: pending
updated: 2026-09-29
phase: phase-8-agent-native-live-engine
session: phase8c4f-eight-arm-matrix-continuation-awaits-approval
---

# E202: Eight-arm matrix retains valid partials and awaits continuation

OpenAI completed all 592 planned calls with no failed, unavailable, or budget-
stopped row. Its exact cost is USD 3.888345.

Gemini stopped correctly on one HTTP 503 at original sequence 564. It retained
563 scored rows. Twenty-eight later rows were not attempted. Its exact cost is
USD 1.47489675.

Claude Haiku stopped at original sequence 138 after its third output-limit
response. It retained 135 scored rows. Its exact cost is USD 1.725122. The stop
exposed one plan defect: the inherited runner's three-unavailable stop was not
present in the v5 written stopping rule.

Total exact cost is USD 7.08836375. No retry or repair call occurred.

The retained assessment reproduces all prompt, task, candidate, and score
identities. It finds 1,138 recoverable ledgers in 1,146 available non-analysis
responses. The eight misses are model outcomes. A 24-case audit covers every
provider, format, and family. It found no prompt, reference, adapter, parser,
scorer, aggregation, provider-identity, schedule, or cost flaw in a retained
row.

OpenAI musical component accuracy ranges from 90.055 percent for MusicXML to
97.977 percent for exact object JSON. `FIELDS` reaches 97.085 percent. Gemini's
late partial ranges from 96.492 percent for local labels to 98.630 percent for
exact object JSON. Claude's early partial does not cover melody generation or
literal serialization. Do not treat its format totals as full-matrix results.

The assessment hash is
`2566c09c9025c953921286789303fc9cc70e67d9b8c22df2aefb548c4ee74095`.

The bounded continuation selects 28 unattempted Gemini rows and 454 unattempted
Claude rows. It never selects an attempted row. It does not retry the Gemini
failure or Claude unavailable rows. Unavailable responses do not stop the
continuation.

The continuation estimate is USD 5.775000. Its hard limit is USD 8.200000. The
protocol hash is
`4be54341adecc7fa320aadf1e3432ceca231ba332f73fa24846b6c4ee7a68a50`.
The run-plan hash is
`729fa5c764a203155e5cdc8500633198a5e6c236ef1e862db4a34343e6c086d9`.

No continuation call is approved. The pending approval file blocks execution.
