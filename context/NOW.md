---
title: Current state
kind: status
state: active
updated: 2026-10-04
phase: phase-8-agent-native-live-engine
session: 8g5-complete
---

# Now

[8g5](plan/phase-8/8g5-final-shadow-acceptance.md) is complete. 8g is complete.
[E224](evidence/experiments/e224-final-shadow-acceptance.md) passes the 8g gate
inside its supported-state matrix, under D26, D27, and D28. No host input
fence and no host clip identity are proved. A clip reference is an address
token in one identity domain, not a clip identity witness. All live cache results keep `complete:false` and
`eligible:false`. E131 keeps stable authority.

Next: a later session can select
[8h](plan/phase-8/8h-cache-promotion-and-interface-simplification.md). Before
stage 1, check its entry conditions and define promoted eligibility as
address- and domain-scoped. 8h must fix or refuse the legacy E131 reconstruct loss: a stable
transpose enabled disabled chance, occurrence, recurrence, and repeat controls
on notes that it did not mention, and it reset disabled recurrence values.
The shadow agreed with authority in that case.

Consumer results on the final build: six shadow matches against a declared
oracle and raw reads, one exact fallback, four refusals, nine pure decision
controls, and a refused stale proposal. Every live decision took exact
fallback. In the final-build detour rerun, 62 trials gave 0 foreign or differing
outputs. One consumer verifier diagnostic, one stable writer diagnostic, and
one detour oracle-budget diagnostic are retained separately. The largest shadow
cost is the 4,194,304-read authority scan, about 2.5 s for each comparison.
The most common fallback cause is the closed eligibility gate.

Only protected `New 3` remains open. Never save or close it. Its
[final check](evidence/data/phase8g5-final/new3-final-baseline.json) matches the
[adopted baseline](evidence/data/phase8g5a-group/new3-baseline.json). The
operator closed New 9 and New 10 without saving. The exact original config
SHA-256 is `256bbf07…43b0`. The research archive is removed. Normal hello passes
with 85 methods, hash `bba7383dce25c0f0`, and fresh initialization
`2026-10-04T05:30:31.485Z`.

Brain typecheck and all 1,812 tests pass. Extension `check`, all four archive
registrations, every artifact verifier including the new 11-file 8g5 verifier,
active wire goldens, context, and diff checks pass. Entry HEAD is `249fa93`.
Session changes are staged for review. No commit is made.

## Retrospective

Compare metadata objects by value, not serialized key order. Declare legacy
stable writer effects in fixture oracles before a public write case runs. Run
`check.rb` with a UTF-8 locale.
