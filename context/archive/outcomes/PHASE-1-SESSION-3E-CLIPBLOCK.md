---
title: Phase 1, session 3e — the clip block
status: ● **DONE 2026-08-11.** Per-clip launch settings were measured before
        product design: autonomous 5/5 and human-click 5/5. Built copy, move,
        launch, launch-settings and playback-state variants through the contract,
        fake/live adapters, wire encoder, write-set, fidelity, reversal and MCP
        surface. Added five production tools, taking the surface from 18 to 23.
        Copy has a positively-empty next-row precondition; an occupied-row test
        proves zero write calls escape. Block geometry is inspectable, overlapping
        moves are safely ordered, and every move reports a tested reverse call.
        Next Actions remain explicitly human-owned and wire-invisible. Wire golden
        is 142 methods at `fa636974130033ba`; offline 348/348; Gradle green; live
        production MCP smoke 9/9 with every created clip removed and transport
        stopped.
updated: 2026-08-11
parent: PHASE-1-ENGINE.md
prev: PHASE-1-SESSION-3D-SURFACE.md
next: PHASE-1-SESSION-3F-FORKCHAIN.md
scope: PHASE-1-ENGINE.md §Re-plan session 3e
evidence: E3, E5c, E16l, E16m, E16s, E16w, E19, E20a, E20b · D6, D16e,
          D18, D19 · standing rules 1, 2, 5, 10, 13
---

# Phase 1, session 3e — the clip block

## Outcome

The clip block is now a production mechanism rather than probe surface. It can:

- copy a clip into its immediately following row only after that row is
  positively read as empty;
- configure the per-clip quantisation and launch mode honoured by a person's own
  click in Bitwig;
- switch on demand with per-call launch options and report queued/playing state,
  transport position and clip-local playing step;
- inspect contiguity and the empty slots bounding a block;
- move a whole block intact, including opaque metadata and automation, with safe
  ordering for overlapping moves and an explicit reverse call.

The mechanism does not claim unattended cycling. Next Actions are absent from the
controller API: they cannot be set, read or verified, and the system cannot tell
an armed block from an unarmed one. Every relevant tool description states that
a person must configure them in Bitwig's Inspector.

## Arm 1 — per-clip launch settings

Two new methods were added and then promoted to production `WIRE`:

- `cursor.launchSettings`
- `cursor.setLaunchSettings`

The autonomous arm passed 5/5:

- all three settings wrote and read back through a second independent cursor;
- a partial write preserved both untouched fields;
- invalid free-string enum input was refused before Bitwig saw it;
- the bridge survived the refusal;
- the original settings were restored.

The human-click arm passed 5/5:

- `from_start` control: outgoing step 25, incoming step 0;
- `continue_or_synced`: outgoing step 38, incoming step 39;
- one-bar per-clip quantisation visibly queued and landed at transport beat
  360.0128, 0.0128 beats from the bar;
- original settings were restored and transport was stopped.

The surface uses 0-based row addresses because the contract is positional. Every
relevant schema and result also reports Bitwig's displayed scene row, which is
one greater.

## Contract and adapters

New address/state kinds:

- `clipLaunch` — quantisation, mode and loop-start quantisation reference;
- `clipPlay` — content/playing/queued/stopped flags, transport position,
  clip-local playing step and extension-side sample time.

New ops:

- `clip.duplicate`
- `clip.move`
- `clip.launch`
- `clip.launchSettings`

The fake models all four and copies/moves the opaque launch state with the clip.
The live adapter promotes the measured slot and cursor methods, restores any UI
selection borrowed by cursor reads/writes, and invalidates cursor assignments
after structural clip operations.

`assertSlotsFree` projects occupancy in caller order. This preserves the hard
copy precondition while permitting an overlapping move ordered from its far edge
inward. `assertClipSources` projects the same sequence, which lets copied-clip
settings run in the later stage of the same batch without ever pointing at an
initially empty slot.

Copy has an exact inverse: its destination was absent, so reversal deletes the
new clip. Launch settings replay exactly. A clip move preserves its object, but
clips have no durable identity with which to prove a later reverse targets the
same object; automatic reversal therefore declines and reports why. The surface
returns the exact reverse `move_clip_block` call, guarded again by positive
source/destination reads.

## Production surface

Five tools joined the 3d surface:

| tool | class | operation |
|---|---|---|
| `inspect_clip_block` | read | contiguity, per-row occupancy and upper/lower boundary state |
| `copy_clip_down` | write | source launch settings → next-row copy → destination launch settings, staged and verified |
| `set_clip_launch` | write | reversible per-clip click behaviour |
| `launch_clip` | write | one quantised switch and playback readback |
| `move_clip_block` | write | intact relocation, safe overlap ordering and reported reverse call |

The D18 naming firewall remains green over names, schemas, descriptions,
refusals and everything emitted by the offline suite. D20's destructive seam did
not widen: cleanup still travels through the separately named `delete_clip` tool.

## Hard-precondition proof

`T-clip-block` creates different clips in adjacent rows, calls
`copy_clip_down`, and asserts all three facts:

1. the result is a refusal naming the silent overwrite;
2. the adapter spy received no additional op;
3. the destination's original note remains intact.

The companion case moves a two-clip block down by one overlapping row, verifies
both clips landed in order, invokes the exact reverse call returned by the tool,
and verifies both clips returned.

## Live production smoke

`probe:3e-production` spawns the real MCP server over stdio and calls only the
registered production tools. Its first run found every visible `gn-A` row
occupied and stopped before mutation, proving the precondition is real rather
than fixture theatre. The corrected apparatus searched visible instrument tracks
and selected a region only after reading five consecutive empty rows.

The final run passed 9/9:

1. visible instrument tracks resolved;
2. five consecutive empty rows were positively read;
3. a source clip was created through `add_clip`;
4. `copy_clip_down` landed and independently verified both click settings;
5. `inspect_clip_block` reported a contiguous, empty-bounded block;
6. both production launches applied and returned numeric playback state;
7. an overlapping move landed;
8. its returned reverse call restored the block;
9. `delete_clip` removed every clip created by the run.

Transport was stopped on every exit. The successful run used internal rows 6/7
(Bitwig rows 7/8) on a track whose five-row region had been read empty; both rows
were empty again at completion.

## Verification

- `npm run check`: 348/348, typecheck green.
- `./gradlew test`: build successful.
- live `probe:hello`: all pass, running extension fresh.
- wire golden/live: 142 methods, hash `fa636974130033ba`.
- launch-settings autonomous arm: 5/5.
- launch-settings human arm: 5/5.
- production MCP smoke: 9/9, cleanup green.

