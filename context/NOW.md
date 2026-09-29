---
title: Current state
kind: status
state: active
updated: 2026-09-29
phase: phase-8-agent-native-live-engine
session: phase8c4d-v18-sampled-audit-complete
---

# Now

[The v18 low-effort rehearsal](plan/phase-8/8c4d-follow-up-v18-low-effort-rehearsal.md)
is complete.
[E192](evidence/experiments/e192-v18-low-effort-rehearsal-is-operationally-complete.md)
records the run and its bounded interpretation.
[E193](evidence/experiments/e193-v18-sampled-audit-validates-run-and-finds-transfer-flaw.md)
records three independent end-to-end sample audits.

V18 keeps the v15 formats and component scorer. It separates five elemental
format-isolation fixtures from five real-use stress fixtures in each decision
family. It also has two literal serialization controls. OpenAI completed all
66 messages with no failed, unavailable, or budget-stopped row. The run cost
USD 0.261846 against the USD 0.650000 hard limit.

`suite.py` owns the v18 tasks and assertions. Phase 8c4e can reuse its task
schemas, scorers, and applicable assertions. It must fork the stress-affine
generator and freshness logic. Reports keep elemental and stress results
separate. The prompt is the experimental unit. Cases and components are
outcomes within a prompt. Stress analysis reached 90 percent median component
accuracy. Stress affine reached 99.5349 percent and remained above the ceiling.

The frozen summary contains `decision: invalid` because the protocol encoded
90 percent as a minimum validity threshold. The operator clarified that 90
percent was a maximum task-performance target and lower performance was
acceptable. The omitted field is a measured model outcome. V18 is
operationally valid development evidence. Keep the frozen artifact unchanged.

The sampled audits found no prompt, reference, scorer, parser, aggregation,
provider, schedule, or cost flaw. They found one transfer issue: stress-affine
musical content does not depend on the cohort seed or variant offset, and the
semantic hash includes synthetic IDs. Do not reuse `suite.py` unchanged for
8c4e.

[E190](evidence/experiments/e190-v17-analysis-composition-correction.md)
corrects the v17 analysis description. V17 intended hard seventh and
diminished chords, but its seed offset produced 18 major, 4 minor, 5
half-diminished-seventh, and 3 major-seventh cases. The frozen package and run
artifacts remain unchanged.

## Immediate work

1. Begin 8c4e preparation only after repairing affine seed dependence and
   adding an ID-free content freshness hash.
2. Treat structural and canonical failures as benchmark outcomes, not
   experiment-invalidating events.
3. Use 90 percent as a maximum calibration target. Lower performance is valid.
4. Keep elemental affine labeled as lower-complexity work. Literal
   serialization is the pure format control.
5. Do not run a provider until the new 8c4e package and cost have explicit
   approval.
6. Do not change the cache, `normal-v1`, or a live Bitwig project.

Phase 8c4e remains blocked pending the affine freshness repair and a frozen run
plan. Phase 8f remains blocked pending the 8c4e result.

## Retrospective

Freshness hashes must exclude synthetic IDs and include the actual musical
content. A new cohort name is not evidence of a new task.
