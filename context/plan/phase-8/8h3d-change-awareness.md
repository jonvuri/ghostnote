---
title: Phase 8h3d — Change awareness without a resident grid
kind: plan
state: complete
status: Complete. E231 selects pull only. It found a reader row defect; 8h3c2 fixes it before 8h3e.
updated: 2026-10-06
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h3c-cold-reader-promotion.md
next: 8h3c2-reader-row-binding.md
evidence: E224, E225, E226, E227, E231; D26, D27, D30
---

# Phase 8h3d — Change awareness without a resident grid

## Result

Complete in [E231](../../evidence/experiments/e231-change-awareness.md).
Pull detected every test edit. No clip, slot, or flat-bank value reported a
note edit. Watched clips detected every note edit in 24–66 ms, at about
300 bytes per sounding cell. They save only survey latency, about 200 ms per
typical clip, not agent work. **Selected design: pull only.** The record
states the snapshot lifetime and the stale verdict.

The product reader binds only the row that its cursor holds for a track.
[8h3c2](8h3c2-reader-row-binding.md) fixes this before 8h3e. The surveys and
watches used single-clip tracks at row 0.

## Why

The compact-bar format sends sparse patches against a snapshot. Before a patch
or a claim about the clip, the agent must know whether its snapshot is still
current. The shadow cache did this with resident grids: every bound clip
delivered step deltas (D26). After [8h3c](8h3c-cold-reader-promotion.md), a
cold read releases its grid, so no delta arrives for that clip.
[8h3e](8h3e-cache-machinery-trim.md) needs a selected design.

This session cannot stop the replacement. The pull baseline below needs no
resident state and uses only the 8h3c reader.

## Entry

8h3c is complete: the product replay reader serves every clip read. Read D26,
D27, D30, the [cache contract](../../contracts/GHOSTNOTE_CACHE_CONTRACT.md)
identity and generation rules, and the E226 release rule and sounding-cell
budget. Use an owned project, never `gn-scale-test` (D29).

## Candidates, in order

Use the same edits for each candidate: a note add, a delete, a velocity edit,
a 1/512 nudge, an edit by the user in the Bitwig editor, and an edit through
Ghostnote. Include an edit while no agent call is in progress.

### 1. Pull

At use time, read the clip again with the product reader and compare its
fingerprint with the snapshot. Measure:

- one clip at each E227 fixture size;
- a survey of 16 and 64 clips of typical density through one reader, as
  "which of my snapshots are stale"; and
- the agent cost: tool calls and result size for a stale and a current
  snapshot.

This is the baseline. It is correct by construction if the reader is correct.

### 2. Clip-level values

Bind no grid. Record which slot, clip, or flat-bank value observers report
each edit. Expect none for a note edit that does not change the clip length.
Record the result, so that later sessions do not test it again.

### 3. Watched clips

Keep step deltas (D26) subscribed only for clips with an open agent snapshot,
under the E226 sounding-cell budget. Release a watch when the snapshot closes
or the budget evicts it; the next use then falls back to pull. Measure:

- heap and controller cost for 1, 8, and 32 watched clips of typical density;
- detection of each edit, and the time from edit to stale mark; and
- the interaction with the 8h3c write queue and a read of a watched clip.

Do not test the coarse sentinel again. E226 found that it misses a 1/512 nudge
inside one coarse cell.

## Selection

Select one design for 8h3e: pull only, or pull with watched clips. Select
watched clips only if they save measurable agent work in a realistic workflow,
for example a project survey or repeated patches in one session. Record the
reason. State the snapshot lifetime and how an agent sees a stale snapshot.

## Acceptance criteria

- Pull is measured for one clip at each size and for 16- and 64-clip surveys,
  and it detects every test edit.
- The clip-level value result is recorded for each edit.
- Watched clips are measured at 1, 8, and 32 clips, or the record states why
  pull alone made the test unnecessary.
- One design is selected for 8h3e, with its reason.
- Owned projects are closed without saving. The normal archive is deployed,
  with a fresh normal hello.
- Brain check, extension check, context check, and `git diff --check` pass.

## Out of scope

- Promotion of the identity and generation machinery (8h3e).
- Interface simplification and public naming (8h4).
