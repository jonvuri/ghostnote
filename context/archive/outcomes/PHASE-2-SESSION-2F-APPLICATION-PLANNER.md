---
title: Phase 2, session 2f — musical application planner
kind: outcome
state: complete
updated: 2026-08-18
parent: ../../plan/phase-2/README.md
prev: PHASE-2-SESSION-2E-CLIP-LIFECYCLE.md
next: PHASE-2-SESSION-2G-MCP-SURFACE.md
scope: Phase 2 patch materialization and protection
evidence: E24, E32–E39 · D8–D10, D15, D16, D18–D21
---

# Phase 2, session 2f — musical application planner

Session 2f is complete. One planner now joins the pure musical contract to the
existing workspace and executor. `Workspace.apply` remains the only project
write seam.

## Application path

The planner validates the patch and tool boundary, groups targets by clip, and
reads every required clip channel before it materializes the ordered pipelines.
It compiles complete, explicit-channel operations against one snapshot revision.
It validates target tracks, rows, clip occupancy, all 16 MIDI channels, output
grids, block overlap, and protection before it calls the workspace.
The review follow-up validates the final requested block row before it allocates
row arrays. An oversized take count is a bounded musical refusal.

One application creates one stash-backed changeset. The result returns the
materialized notes, material differences, warnings, block rows, changeset id,
readback disagreements, unverified and concurrent state, and reversal fidelity.
A stale revision rejects the complete batch.

## Direct and protected work

Direct work creates no alternate and receives no fidelity clearance. The
executor refuses it when its prior state cannot be restored exactly.

Requested variations reserve empty adjacent rows, duplicate the source down
before any note write, and write each deterministic result into its own take.
They never copy a track. The complete block and all musical writes share one
changeset.

Fidelity-required protection writes one working clip. Its `takes` value counts
adjacent existing protected takes. At least one must match the working clip's
complete 16-channel note state. The planner does not rewrite those protected
takes. This makes one protected take sufficient and keeps the prior musical
state intact.

## Executor and reversal repairs

The executor now recognizes a preceding verified clip duplicate as establishing
its destination for later note operations in the same batch. A later duplicate
cannot excuse an earlier note write.

The stash now counts a verified duplicate's destination fill as an event caused
by its own changeset. The positional boundary no longer misclassifies a planner-
minted take as an external move. Directed reversal restores the source clip and
removes only the planner-minted rows. Fidelity qualifications continue through
the existing unrestored path.
A revision-rejected change reports exact reversal fidelity with no unrestored
state because the rejected batch changed nothing.

## Verification

Focused planner, executor, and stash tests pass 72/72. They cover generation,
transformation, ordered pipelines, several clips, several channels, triplets,
expression, requested variations, fidelity protection, failed preflight, stale
revision refusal, and directed reversal. The full offline check passes 612/612,
including typecheck. The context check covers 171 active documents with intact
links. `git diff --check` passes.

## Retrospective

The existing same-batch empty-slot guard and launcher event accounting both knew
about clip creation but not verified duplication. The planner exposed both gaps.
Future operation guards must classify every operation that establishes or changes
the same object state. Validate caller-sized capacity before allocation, and keep
derived reports aligned with rejected-change semantics. No repository instruction
change is needed.
