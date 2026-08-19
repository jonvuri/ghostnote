---
title: Phase 2, session 2e — clip lifecycle
kind: outcome
state: complete
updated: 2026-08-18
parent: ../../plan/phase-2/README.md
prev: PHASE-2-SESSION-2D-GRID-PRECISION.md
next: ../../plan/phase-2/2f-application-planner.md
scope: Phase 2 launcher-clip lifecycle
evidence: E43 · D8, D15, D16, D18–D20
---

# Phase 2, session 2e — clip lifecycle

Session 2e is complete. Launcher clips now have typed metadata read and write
operations. The existing next-row copy remains the only product duplication
route.

## Measured contract

E43 proves independent read-after-write behavior for name, 8-bit colour, loop
length and end, play start, loop enabled state, and loop start. The typed state
keeps the exact fields needed to handle the raw loop-start side effect. The
play-stop setter accepted values below and above the loop end but ignored both,
so that marker is not a shipped metadata field.

The complete writer validates marker order and colour bytes. It writes markers
in a safe order, then restores values affected by host side effects. Metadata
readback is exact on both adapters.

## Duplication decision

`duplicateObject` and `duplicateClip` have the same measured next-row behavior.
Both copy metadata, notes, and launch settings. Both can silently overwrite an
occupied row, and no clip identity signal distinguishes their copies.

`Clip.duplicateContent` changes the source content in place and creates no
destination clip. It is not an object-copy route.

The product keeps `duplicateClip` for one purpose: mint the next take in a clip
block. The contract requires a same-track, next-row destination and proves that
row empty before the call. Rejected routes stay probe-only.

## Restoration and reporting

`clip.delete` now protects clip existence, exact metadata, launch settings, and all
16 note channels. Reversal recreates the clip before it restores the other
state. Reports name the play-stop marker and automation lanes as the remaining
loss. No shipped metadata is reported as lost.

The fake models both raw marker traps. Shared conformance covers exact metadata,
invalid-state refusal, and complete duplication. Create, edit, duplicate, and
delete also pass through the typed live adapter with cursor `1` as the witness.
The review follow-up compares each final surviving metadata request with the
executor's post-write readback. Changed or missing metadata is now a reported
mismatch instead of silent success.

## Verification

Focused lifecycle tests pass 206/206. The full offline suite passes 602/602,
including typecheck. Extension tests and deployment, the 26-check live 2e
probe, the context check, and `git diff --check` pass. Live cleanup
restored the exact 10-track, 10-scene, 22-cell baseline, selection at track 0 row
1, stopped transport, empty observation record, and unpinned cursor homes.

The extension wire now has 138 methods with hash `87619942d7eac74d`. Only the
two metadata methods are product-reachable.

## Retrospective

The plan correctly required raw measurement before product work. The probe
found coupled and inert marker behaviors that a field-by-field writer would miss. A
future lifecycle plan must require complete-state writes when host properties
can affect each other. No repository instruction change is needed.
