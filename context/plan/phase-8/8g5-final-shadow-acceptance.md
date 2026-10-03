---
title: Phase 8g5 — Final shadow acceptance and consumer workflows
kind: plan
state: active
status: Pending. Run after 8g5a–8g5c. Decide the 8g gate without starting 8h.
updated: 2026-10-03
parent: 8g-shadow-project-cache.md
prev: 8g5c-combined-storage-limit.md
next: 8h-cache-promotion-and-interface-simplification.md
---

# Phase 8g5 — Final shadow acceptance and consumer workflows

## Gate scope and prerequisites

The 8g5 planning pass on 2026-10-03 selected project-wide occupancy as the gate
scope. Covered clip content alone is not sufficient. The pass found three open
required predicates and moved them to focused sessions:

1. [8g5a — Group topology support](8g5a-group-topology-support.md): E221
   proves the bounded group route. Collapsed child canary rebinding
   still refuses; state that limit in the supported-state matrix.
2. [8g5b — Slot inventory delivery](8g5b-slot-inventory-delivery.md): E222
   passes covered occupancy under D28. Equal occupancy is never an identity
   witness; state that limit in the supported-state matrix.
3. [8g5c — Combined storage limit](8g5c-combined-storage-limit.md): no total
   limit is selected, and heap memory is not measured. It must also measure
   topology allocation and implement support for at least 256 instrument/audio
   tracks plus group, FX, and Master capacity. The 16-track research limit does
   not satisfy this gate.

[D27](../../decisions/d27-later-callback-ordering-is-a-named-assumption.md)
accepts the E217 ordering rule. With D26, it closes covered step-content
continuity. Start 8g5 only after all three sessions pass or record a hold.

## Entry and scope

Review the [ledger](../../evidence/format/PHASE8G_INTERMEDIATE_REVIEW.md) and
individual outcomes from 8g1–8g4. Required continuity, acquisition, resource, and
topology predicates must pass for every intended supported cache path. An
unproved required predicate blocks final acceptance. Unsupported states must
have explicit conservative fallback/refusal; they cannot weaken completeness.
This session decides the 8h entry gate. It does not implement or enter 8h.

## Owned files and interfaces

- Pure comparison, consumer, and admission library/tests.
- Cache-acceptance and shadow workflow drivers, with focused regression tests.
- Artifact verifiers and final baseline/reload checks affected by prior changes.
- Runtime/profile/rig/hello/wire checks for final experimental isolation.
- E214/E215 continuation evidence, ledger, 8g parent plan, Phase 8 index, and NOW.

No stable writer migration, document authority migration, benchmark rerun, or
publication candidate change belongs here. E131 remains the stable authority.

## Work and independent oracles

1. Convert the parent acceptance criteria into a final supported-state matrix.
   Reuse immutable accepted evidence where the final code retains its dependency
   behavior. Repeat only the controls affected by a concrete regression risk.
2. Exercise read-only, sparse-patch preparation, field-only, stale interpretation,
   computer-use change and reacquisition, unhealthy fallback, unavailable
   authority, and stale-base consumers through the selected shadow protocol.
   Separate pure decision controls from actual public tool workflows.
3. Read actual authority independently of cache and proposal values. Compare all
   acquired fields and metadata against fixture oracles. Keep D23 unknown loss
   separate from wrong normalized values.
4. Verify final health, coverage, identity, zero dirty work, replay, and budgets
   together. No individual passing budget can substitute for those predicates.
5. Report cold/warm phase latency, avoided host reads, hit/miss/fallback causes,
   mismatch causes, tool calls, response bytes, and agent-visible delay. Preserve
   failed and diagnostic trials; do not form a combined acceptance denominator.

## Acceptance criteria

- Every in-contract shadow result matches independently acquired normalized
  authority. There is no unexplained mismatch, silent overflow, unbounded rebuild,
  or unresolved project-generation race on a supported path.
- Partial, warming, rebuilding, invalid, ambiguous, dirty, and overflow states
  expose no complete current cache result. Missing authority refuses explicitly.
- Old tokens/callbacks cannot affect current output; structures follow the 8d
  repair/rebuild rules and selected resources follow 8e.
- Current consumer dependencies are checked. Stale overlays cannot supply a
  current claim or write instruction; stale proposals need a new observation.
- R1 and R2 regression checks pass. Every retained claim has independent meaning
  checks as well as exact raw/compressed integrity where declared.
- Stable normal authority and its 85 methods/hash remain unchanged. Experimental
  cache observations and preparation still grant no stable write authority.
- Every temporary fixture is removed and the exact stated baseline is restored.
- Full checks and fresh marker/normal hello pass. The ledger lists any remaining
  unverified predicate; required open gates prevent a completed 8g claim.

## Checks, live cleanup, and stopping rule

Run brain and extension `check`, all five artifact verifiers plus new retained
roles, active wire check, context check, and staged/unstaged diff checks. Verify
all four archive registrations. Deploy the required archive, then defer
controller replacement to the operator under `AGENTS.md`. Wait for confirmation
and verify the fresh runtime and marker before live controls. Finish with an
operator replacement of the normal controller and fresh normal hello.

Restore original ordered tracks, eight scenes, all empty baseline slots,
selection, cursors, pins, config bytes, and engine/transport state. Close only
owned tabs and remove only proven owned package files. Never save or close
protected `New 3`, whose adopted baseline is in E221. State the viewport restoration scope separately.

Persist a terminal mismatch/refusal before an oracle assertion. Stop acceptance
on a required open predicate or in-contract discrepancy, restore safely, and
return the smallest fix to its owning follow-up. Do not widen budgets, invent
coverage, relabel diagnostics, or ask the vendor without authorization.

## Exit

Record pass/hold for each parent criterion and the explicit 8h entry decision.
8h can be selected only by a later implementation session after its entry gate
passes. Stage this session's changes without a commit. Record the largest shadow
cost and most common fallback cause with their workload scopes.
Suggested commit message: `test: complete guarded shadow cache acceptance`.
