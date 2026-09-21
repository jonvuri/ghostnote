---
title: Phase 7a — Symbolic context and read-only analysis
kind: plan
state: planned
updated: 2026-09-21
parent: README.md
prev: ../phase-6/6j-verification-cost-audit.md
next: 7b-agent-patch-execution-and-reference-dogfood.md
---

# Phase 7a — Symbolic context and read-only analysis

## Purpose

Implement the selected agent-facing symbolic context as an independent,
read-only experimental module. Prove it in one real analysis and revision task
without writing the proposed revision.

## Starting facts

- The experimental
  [agent musical language reference](../../evidence/format/AGENT_MUSICAL_LANGUAGE.md)
  defines compact and groove modes, authority, versioning, and dogfood gates.
- `brain/src/musical/agent-context.ts` is a pure draft parser and renderer. Its
  golden corpus fixes modal isolation, identity links, exact rational timing,
  tempo-qualified deviations, and refusal behavior.
- The module has no Bitwig dependency and is not a public tool. This session
  must connect it to complete exact clip reads and test its usefulness.

## Work

1. Map the exact-note boundary selected by E109 into the draft context module.
2. Render the selected context mode from complete exact clip state.
3. Add only the measurement fields required by the selected task. Enable
   Music21 only when the task needs qualified theory evidence.
4. Report exact facts, derived measurements, and alternatives separately.
5. Make missing optional providers reduce declared capabilities without
   disabling exact context rendering or the Bitwig adapter.
6. Run one module-only dogfood task from the priority menu.

## Selected implementation boundary

Use [symbolic-context-v0](../../evidence/format/WORKSTATION_CONTRACTS.md) and
close [S03–S05 and S17](../../evidence/format/WORKSTATION_SEAMS.md). S05 applies
only if theory is enabled. Add S10 only for a declared paired MIDI decision.
The first run renders compact context from one bounded complete clip read and
returns an unapplied revision. It needs no Python provider.

Implement `ghostnote-exact-note-source-v0` and its canonical serializer, source-
scoped event map, and valid track aliases. Retain `ghostnote-agent-context-v0`
and `compact-bar-v0`; keep shared provider and annotation authority metadata
outside the strict v0 object. Groove mode remains optional and must not infer
intent from performed time. Preserve all observed host properties in exact state.

Keep module discovery and local context rendering independent of
`Session.ready()`. Test missing Bitwig with supplied exact state, missing optional
Python, incomplete channel coverage, empty context refusal, and stale generation.
No provider installation is required unless the selected task needs it.

## Verification cost

Use the [6j operation and timing rules](../../evidence/format/WORKSTATION_VERIFICATION.md)
for this session. Measure implemented seam costs separately from host/provider
work. Keep unknown costs explicit. Any proposed reuse must pass its
[equivalent-evidence brief](VERIFICATION_REDUCTIONS.md).

## Acceptance criteria

- Each result declares source identity, exact note coverage, schema version,
  provider versions, capabilities, and missing capabilities.
- Ambiguous theory results expose alternatives and do not become exact facts.
- The selected representation preserves the fields promised by session 6f.
- The module works without a capture, audio-analysis, or documentation module.
- No project write occurs.
- Focused tests, the full brain check, context check, and `git diff --check`
  pass.

## Out of scope

- Applying an agent proposal.
- Audio analysis.
- A stable public contract.
- Broad theory fields not selected by a dogfood task.

## Retrospective target

Record which context field the agent used and which field it ignored.
