---
title: Phase 6j — Verification-cost audit
kind: plan
state: complete
status: Complete. Costs classified; reductions deferred; Phase 7a is next.
updated: 2026-09-21
parent: ../../plan/phase-6/README.md
prev: ../../plan/phase-6/6i-workstation-contract-synthesis.md
next: ../../plan/phase-7/7a-symbolic-context-and-read-only-analysis.md
---

# Phase 6j — Verification-cost audit

## Purpose

Finish the verification-cost audit as an evidence and planning session. Identify
which current checks are essential, reducible, or historical before new modules
compose with the Bitwig adapter. Include the cost of validating and translating
the custom interface seams selected in 6i.

Do not combine this audit with provider implementation or an optimization.

## Starting artifacts

Read the [6i contracts](../../evidence/format/WORKSTATION_CONTRACTS.md),
[inventory](../../evidence/format/WORKSTATION_INTERFACES.md), and
[S01–S17 seam ledger](../../evidence/format/WORKSTATION_SEAMS.md).
The ledger distinguishes tested components from unbuilt connections. Bound or
mark costs unknown for unbuilt seams; do not treat their absence as zero cost.
Keep exact-source hashing, context projection, candidate validation, and
independent live readback as separate costs.

## Work

1. Consolidate existing measurements for target acquisition, pre-write guards,
   planned settlement, exact readback, recovery, reversal preparation, and
   full-state scans.
2. Map each cost to the operation risk and the defect or boundary that justifies
   it.
3. Account for parsing, validation, canonicalization, fingerprinting,
   projection, and translation at custom format boundaries.
4. Separate product verification from historical probe instrumentation.
5. Identify repeated reads and repeated format validation that already have
   equivalent target-bound evidence.
6. Identify missing measurements. Run only focused, non-mutating or disposable
   live checks needed to close those gaps.
7. Classify each cost as essential, reducible, historical, or unknown.
8. Write a focused successor brief for each worthwhile reduction. Do not make
   the reduction in this session.
9. Give Phase 7 per-operation verification and timing rules for read-only
   providers, agent patches, capture, and composed workflows.

## Acceptance criteria

- The audit accounts for target guards, settlement, readback, recovery,
  reversal preparation, and full-state scans.
- Every essential cost cites the evidence or invariant that requires it.
- Every reducible cost states the equivalent evidence that must remain.
- Historical instrumentation is not mistaken for product runtime cost.
- Each retained custom seam has a measured or bounded validation and translation
  cost. A proposed reduction keeps its required compatibility evidence.
- Read-only modules do not inherit mutation ceremony.
- Agent-proposed writes keep exact validation, target guards, and independent
  readback.
- Any live measurement restores the documented project baseline and selection.
- The context check and `git diff --check` pass.

## Out of scope

- Removing a proved safety check.
- Implementing a proposed optimization.
- Productizing a Phase 6 probe.
- Running the Phase 7 dogfood loop.

## Retrospective target

Record which cost category was previously ambiguous and which evidence resolved
it.

## Result

The [verification reference](../../evidence/format/WORKSTATION_VERIFICATION.md)
classifies the host, provider and format costs. Its S01–S17 table separates
validation, canonicalization, hashing, projection and translation. Each unbuilt
connection keeps an explicit unknown cost and an implementation owner.

[E119](../../evidence/experiments/e119-offline-verification-cost-audit.md) adds
local context measurements and an offline exact-reader count proof. The selected
2,048-step reader uses 20 pages and two resets for 32 beats, with 3,168 ms of
scheduled waits. The 80-page count in the E116 handoff applies to a 512-step
reader. The active clip reference now states both widths. E116 stays frozen.
The old 1.6–1.8 second exact-read medians are not current fine-grid latency claims.

Four [successor briefs](../../plan/phase-7/VERIFICATION_REDUCTIONS.md) specify
possible preflight, context render, verified document byte and task-fact reuse.
Each requires equivalent evidence and focused controls before a reduction.
Existing scalar-cohort and modulation-witness sharing is already implemented.
No saving from that completed work is counted as a new proposal.

The Phase 7 briefs now link per-operation verification and timing rules.
Read-only providers need no stash or reversal. Agent writes keep complete
candidate checks, target guards, independent readback and partial-effect records.
Capture keeps its lifecycle and artifact checks separate from audio analysis.

## Acceptance record

| Criterion | Result |
|---|---|
| Target guards, settlement, readback, recovery, reversal and full-state scans | Covered by the host ledger, source code and evidence links. |
| Essential costs cite an invariant or defect | D5/D6/D8/D9/D10/D15, E38/E51–E54/E61/E78/E97/E99 and source/coverage rules are explicit. |
| Reducible costs keep equivalent evidence | R1–R4 name retained evidence, invalidation and proof gates. No reduction implemented. |
| Historical work stays separate | Benchmark arms, fixture setup, broad regressions and optional traces are separate. Still-allocated probe objects have unknown runtime cost for 8b. |
| Custom seam costs | S01–S17 each account for V/C/H/P/T. Existing fixtures have measured costs or explicit scope bounds; unbuilt connections remain unknown as the starting-artifact rule requires. |
| Read-only and agent-write rules | Separate operation rows and Phase 7 links preserve the required boundary. |
| Live baseline and selection | No live call or mutation. No new baseline claim; no live residue. |
| Verification | Typecheck, 174 focused offline tests, context check and diff check pass. |

## Changes and verification

Production code and runtime dependencies are unchanged. The only executable
additions are an offline measurement probe and an adapter work-count test.
Run from `brain`:

```sh
npm run typecheck
node --import tsx --test src/adapters/live/adapter.test.ts src/engine/executor.test.ts src/engine/settlement.test.ts src/musical/agent-context.test.ts
node --import tsx src/probes/phase6j-verification-cost.ts
```

The benchmark uses the existing parser/renderer, checks unchanged input and
matching fingerprints, and reports inclusive costs explicitly. The first `tsx`
CLI attempt could not open its sandbox IPC socket. `node --import tsx` ran the
same local code without that CLI socket. No permission change was needed.

The root checks are `ruby context/check.rb` and `git diff --check`. A separate
changed-document link check includes this archive because the context checker
excludes archives. Temporary logs and benchmark output were removed after the
measurements were recorded. No fixture files or user project files were created.

## Handoff and retrospective

Phase 6 is complete. Start [7a](../../plan/phase-7/7a-symbolic-context-and-read-only-analysis.md)
with complete exact state and compact context. The first run needs no optional
theory package. Measure actual module boundaries when they exist; do not import
a probe to make a blocked seam appear complete.

The ambiguous cost was the fine-grid page count. Record the advertised reader
width beside every count. Keep inclusive render/fingerprint timings labelled.
Use the seam and cost ledgers together to avoid searching all historical probes.
