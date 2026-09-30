---
title: Claude retry recovers outage rows and stops at cost
kind: evidence
state: pending
updated: 2026-09-30
phase: phase-8-agent-native-live-engine
session: phase8c4f-eight-arm-matrix-claude-budget-stop
---

# E204: Claude retry recovers outage rows and stops at cost

The approved Claude retry recovered every row that had failed because of
provider availability. Sequence 195 completed in r6. Sequence 340 completed in
r7. Sequence 341 completed in r8. No scored source row was called again.

R6 completed 145 scored rows before the token-count endpoint timed out at
sequence 340. It cost USD 2.309832. R7 completed sequence 340 before the same
endpoint timed out at sequence 341. It cost USD 0.014360. R8 used bounded
retries for HTTP 503 and read timeouts. It needed no retry. It completed 216
provider responses and stopped before sequence 557 because the next reservation
would exceed its cost ceiling. R8 retained 215 scored rows and one output-limit
outcome. It cost USD 4.343955.

The merged Claude result has 553 scored rows, three unavailable rows, one
budget-stop row, and 35 unattempted rows. OpenAI and Gemini remain complete at
592 scored rows each. The exact cost for all retained matrix calls is USD
15.04678425.

All retained prompt, task, candidate, and score identities reproduce. The final
assessment hash is
`1fa6c4be231a170bc1e6d64d2e884d4ebec1714df9c6cf4779876e26bb78866d`.

Claude's scored musical component accuracy is 92.6653 percent. This value is
partial because the final 36 scheduled rows did not receive a scored outcome.
Do not pool it as a balanced complete-provider result.

No further provider call is approved. A final supplement would select sequence
557 and sequences 558 through 592. It must keep the three unavailable model
outcomes as measured results unless the operator separately approves their
repeat.
