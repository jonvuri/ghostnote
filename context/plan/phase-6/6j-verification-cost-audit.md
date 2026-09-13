---
title: Phase 6j — Verification-cost audit
kind: plan
state: planned
status: Final Phase 6 session. Classify costs before Phase 7 implementation.
updated: 2026-09-13
parent: README.md
prev: 6i-workstation-contract-synthesis.md
next: ../phase-7/7a-symbolic-context-and-read-only-analysis.md
---

# Phase 6j — Verification-cost audit

## Purpose

Finish the verification-cost audit as an evidence and planning session. Identify
which current checks are essential, reducible, or historical before new modules
compose with the Bitwig adapter. Include the cost of validating and translating
the custom interface seams selected in 6i.

Do not combine this audit with provider implementation or an optimization.

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
