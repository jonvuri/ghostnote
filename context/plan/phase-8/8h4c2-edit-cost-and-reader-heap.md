---
title: Phase 8h4c2 — Edit cost and reader heap guard
kind: plan
state: planned
status: Planned. Removes avoidable property stages and duplicate reads from edit_launcher_clip, and adds a sounding-cell guard to the cold reader.
updated: 2026-10-07
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h4c-document-edit-limb.md
next: 8h4d-musical-and-clip-surface-migration.md
evidence: E15, E121, E225, E227, E229, E230, E236, E245; D16, D31, D32, D35, D36, D37
---

# Phase 8h4c2 — Edit cost and reader heap guard

## Why

[E236](../../evidence/experiments/e236-document-edit-limb.md) measured
`edit_launcher_clip` live. One read and one 16-note insertion take 7,176 ms:
read 514, plan 126, write 5,363, readback 543. Two causes are in the 8h4c
implementation:

1. **Property stages.** `planLauncherClipEdit` lowers each new or changed note
   through `d9MappedFields`, which states every portable default as a raw
   value: disabled chance, occurrence, and recurrence flags, raw gain 1, and
   timbre 0. These differ from the host insertion values, so each channel's
   `note.insert` splits into a create stage and a `note.props` stage with a
   `gridChange` and a `noteWrite` settle. The 16-note insertion has 32 stages;
   without property writes it has 1 (offline `planStages` count). The host
   insertion values (enabled neutral flags, raw gain 0, release `100/127`,
   timbre 0) already project to the portable defaults (E245, D35;
   HOST-BINDING "Defaults and proposed changes"). A whole-clip rewrite pays the
   same cost for every note with a nondefault value (E236 A6: 16.2 s against
   A3: 6.6 s).
2. **Four cold reads.** The tool's preflight read, the executor stash read, the
   executor verify read, and the tool's independent readback each read all 16
   channels (about 500 ms each on the typical clip).

A third finding predates 8h4c. The cold reader holds one `NoteStep` for each
sounding cell, about 300 bytes (E227: 313 MiB for 1,048,513 cells). The E236
worst-case fixture (65,536 quarter-beat notes, about 8.4 million sounding
cells) exhausted the extension Java heap. The reader refuses on width and on
note pages, but has no sounding-cell limit, so an overload crashes the
extension instead of refusing.

## Entry

Read E236, E227 (sections 3 and 4), E229, HOST-BINDING "Defaults and proposed
changes" and "Edit limb", D16 (all-channel protection), D31, and D32. Read
`brain/src/bindings/launcher-clip-edit.ts`, `brain/src/surface/agent-native-edit.ts`,
`brain/src/engine/executor.ts` (stash read, `ifSnapshot`, verify), and
`brain/src/contract/stages.ts`.

## Work, in order

### 1. Lower against the host insertion values

- For a new note, write a raw property only when its portable value differs
  from the projection of the host insertion value. A portable default writes
  nothing; the host value projects to it. Keep `d9MappedFields` as the pure
  scalar map; add the host-insertion comparison in the planner.
- For a changed note on the whole-clip route, the raw candidate already holds
  raw values. Omit each raw field that equals the host insertion value, as
  `readerNote` does (D31), so a note with only host values needs no property
  stage.
- The readback compares the portable projection and the raw value of each
  written field. A field left at the host value compares by projection: raw
  gain 0 and raw gain 1 are both portable 1, but compare raw exactly where the
  document states a value.
- Update HOST-BINDING "Defaults and proposed changes" and the 8h4c plan text
  that asked for every default to be written.

### 2. Share the reads

- Pass the tool's fresh read to the executor as the stash read for the same
  revision (the migration contract allows one shared read inside one executor
  call). Keep the `ifSnapshot` verdict and the revision guard; a mismatch
  still refuses before any host call.
- Use one post-write read for the executor verification and the tool readback.
  It must stay independent of the writer echo (D15): a fresh `clip.read`
  capture, not the write receipt.
- Record which reads remain and why in the E-record.

### 3. Sounding-cell guard in the cold reader

- Measure live: a ladder of long-note fixtures at fixed note counts (for
  example 4,096 notes with 64, 512, and 2,048 cells each) with heap samples, in
  an owned unsaved project. Stop at the first failure. Record the extension
  heap configuration.
- Add a sounding-cell budget below the measured failure. Over the budget the
  read refuses with a reason before it binds the grid; the tool returns
  `outside-limit`. If the extension cannot count cells before binding, refuse
  on the first callback past the budget and release.
- State the limit in the pull snapshot contract "Limits" table and in the read
  description if the agent can reach it.

### 4. Measure again

- Rerun the E236 matrix A, the 16-note cost, and the reversal cases through
  `phase8h4c-edit.ts accept` (skip the operator steps with a flag if they add
  nothing new).
- Rerun the worst case at a fixed sounding-cell count that the guard admits,
  and at one count above it (expect a refusal, not a crash).

## Acceptance criteria

- One read and one 16-note insertion on the typical clip finish in at most
  2,000 ms end to end, with independent verification. A whole-clip velocity
  edit of the typical clip is at most 50 percent of E236 A3.
- Every E236 matrix A edit still reads back `verified`, and both reversal
  routes still restore exact raw state.
- A read over the sounding-cell budget refuses; the extension does not crash.
- Brain check, binding corpus, extension check, context check, and
  `git diff --check` pass. Record the evidence as E246. Bump the tool
  description version only if a description changes.

## Out of scope

- The asynchronous operation route and the retirement of old tools (8h4d).
- Pressure (D37).
