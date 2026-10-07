---
title: E236 — Document edit limb
kind: evidence
state: done
updated: 2026-10-07
owner: phase-8h4c
---

# E236 — Document edit limb

## Status

[8h4c](../../plan/phase-8/8h4c-document-edit-limb.md) is complete with two
named limits. `edit_launcher_clip` in `agent-native-v1` applies a sparse
patch, a guarded desired document, or an unguarded replacement to one
Launcher clip. Every live edit read back `verified` with zero discrepancies,
every refusal wrote nothing, and both reversal routes restored the clip
exactly. One read and one 16-note insertion take 7,176 ms (E121 apply:
16,044 ms; target 8,000 ms).

Two findings change the plan:

1. **Bitwig does not report note pressure.** A note with inspector Pressure
   51.0 percent reads pressure 0 through the cold reader and through
   `cursor.getNotesVerbose`. This closes the E15 open question. Pressure is now
   a named blind limit: the host cannot write it (E15-E) or read it.
2. **The worst case is far above the client timeout.** A whole-clip
   replacement of 16,384 notes takes 73.0 s. At 65,536 notes the extension ran
   out of Java heap in the fixture read, before the edit ran.

The extension and the wire did not change (88 methods, `68d457c4c4d1d7b3`).
Tool descriptions are at v28. [D36](../../decisions/d36-the-live-writer-replays-raw-repeat-controls.md)
records the raw repeat replay rule and
[D37](../../decisions/d37-note-pressure-is-a-blind-host-limit.md) the
pressure limit.

## Implementation

- `bindings/launcher-clip-edit.ts`: the pure planner. It re-projects the fresh
  snapshot with the base IDs and checks the R27 guard, resolves the partial
  base (articulation and repeat declared at their defaults), runs the binding
  assessment with `rawReplay`, builds the raw candidate, selects the route,
  and lowers to executor operations. `compareReadback` compares every raw
  field on all 16 channels.
- `surface/agent-native-edit.ts`: the tool. Codec parse, base-ref resolution,
  fresh read, D32 verdict (`stale` returns the new document), plan, `dryRun`,
  `Workspace.apply` with `ifSnapshot` and `ifRevision`, independent readback,
  and `IdentityRegistry.recordWrite` with the candidate ID map.
- `bindings/overlay-carry.ts` and the registry: each entry stores the
  overlays, META, and EXTENSIONS of its document. A kept clip ID carries them;
  a changed dependency makes a claim stale; an unresolved reference removes it
  and its dependents. The read reports both in `authority.overlays`.
- Result module: failure code `unsupported` (with `detail.reason`) and stage
  `plan`. HOST-BINDING has the "Edit limb" and "Edit refusals" sections.
- Routes: targeted (`note.remove`, then `note.insert`) when every changed note
  changes its cell and no inserted cell was removed; otherwise whole-clip
  (`note.clear`, `note.write`). A whole-clip result has warning
  `pressure-unobservable`.
- Deviation from the plan: an empty slot refuses with `absent`. The metadata
  table gives no container permission to an edit; 8h4d `add_launcher_clip`
  owns creation.

Offline: 18 edit-path tests on the fake adapter, including the codec corpus
(`complete` and `patch` examples through the edit path with field preservation
and overlay staleness), and binding case B18.

## Live acceptance

Driver `brain/src/probes/phase8h4c-edit.ts`. Owned unsaved project `New 2`;
normal profile; track `gn-8h4c-edit`. Each matrix starts from a rewritten
typical clip (256 notes, 16 channels, 64 beats) with a palette colour. Every
result is compared with an independent raw `clip.read`. Artifact
[accept.json.gz](../data/phase8h4c-edit/accept.json.gz); `verify-offline`
passes with no issue.

| Step | Route | Wall ms | Write ms |
|---|---|---:|---:|
| A1 add | targeted | 3,337 | 2,137 |
| A2 remove | targeted | 3,167 | 1,957 |
| A3 velocity | whole-clip | 6,574 | 5,361 |
| A4 pitch | targeted | 3,591 | 2,379 |
| A5 1/512 nudge | targeted | 4,179 | 2,979 |
| A6 expression member | whole-clip | 16,213 | 14,968 |
| A6 gain 0, 0.5, 8 | whole-clip | 16,293 | 15,034 |
| A7 name, length, loop | `clip.update` only | 2,692 | 1,390 |
| B desired document (255 removed, 16 added) | targeted | 9,860 | 8,720 |
| D targeted (remove, move, add) | targeted | 4,212 | 2,999 |
| D whole-clip (velocity) | whole-clip | 6,531 | 5,323 |

Gain reads back raw `1e-323`, `cbrt(0.5)`, and 2, and portable 0, 0.5, and 8.
Moved notes keep their IDs at the new cell; every unnamed note keeps its ID.
A whole-clip rewrite costs about 2.5 times a targeted edit on this clip; it
costs about 2.3 times more again when the rewritten notes carry nondefault
expression values (A6), because each such note needs a property stage.

**Desired document and pressure (B).** The operator set inspector Pressure
51.0 percent on the first note. A desired document kept that note's ID and
replaced the other 255 notes with 16 new notes on all 16 channels. The route
was targeted, the readback verified, and every raw field of the kept note was
unchanged. The operator then read Pressure 51.0 percent on the note again
([operator-B-check.txt](../data/phase8h4c-edit/operator-B-check.txt)).

**Refusals (C).** Each wrote nothing (equal raw reads before and after) and
recorded no change: a document pressure value (`unsupported`, `pressure`),
a repeat change (`repeat`), a same-pitch overlap (`overlap`), a note past the
clip end (`range`), a stale base after an operator velocity edit (`stale`,
with the new document), a scene append (`identity-changed`), and a project
switch (`incomparable`, at `resolve`). A refusal takes about 560 ms.

**Reversal (D).** `revert_change` restored the targeted and the whole-clip
edits to equal raw reads. A concurrent note written outside Ghostnote in the
same channel blocked the reversal of a targeted edit; nothing was written.

**Cost.** One read (566 ms) and one 16-note insertion on the targeted route
(6,610 ms): 7,176 ms in total, against the E121 16,044 ms apply and the
8,000 ms target.

## Pressure is not observable

`phase8h4c-edit.ts pressure` read the note with inspector Pressure 51.0
percent three times through each route
([pressure.json](../data/phase8h4c-edit/pressure.json)): the cold
`clip.read` capture and `cursor.getNotesVerbose` on a pinned cursor. All six
reads report 0. Both routes read `NoteStep.pressure()`, the only per-note
pressure surface in the installed API documentation. The same routes saw the
operator's inspector gain edits in E245, so they do see inspector edits.

Consequences: a read always states pressure 0; the D16c "pressure stripped
and reported" path and the `erase_notes` claim that it refuses human pressure
cannot trigger; a whole-clip rewrite and `erase_notes` lose human pressure
silently. The operator chose a named blind limit: writes are not blocked, and
the whole-clip warning names the loss. A targeted edit leaves untouched notes
and their pressure intact (B). The planner keeps its pressure refusals as a
defensive check; a live read never reaches them.

## Worst case

`phase8h4c-edit.ts worst` writes a fixture with the fine cursor (window 2,048
steps, paged with `cursor.scrollToStep`) in an owned project, then changes the
velocity of every note in one desired document (whole-clip route).

| Notes | Beats | Read ms | Edit ms | Plan ms | Write ms | Readback |
|---:|---:|---:|---:|---:|---:|---|
| 4,096 | 256 | 1,385 | 20,061 | 2,143 | 15,805 | verified |
| 16,384 | 1,024 | 4,275 | 73,040 | 9,903 | 57,083 | verified |
| 65,536 | 4,096 | — | — | — | — | not reached |

Artifacts: [worst-4096](../data/phase8h4c-edit/worst-4096.json.gz),
[worst-16384](../data/phase8h4c-edit/worst-16384.json.gz). At 65,536 notes
the independent raw `clip.read` of the fixture missed its 2 s close deadline,
and the extension then stopped with "Java heap space" (operator screenshot;
Restart recovered it). The first attempt at 131,072 notes wrote one page and
failed on step 2,048 (the writer window); Bitwig then crashed. Both failures
happened before `edit_launcher_clip` ran. A clip at the configured reader
page of 131,072 notes was not reached on this host.

A whole-clip edit crosses the E45 60 s client timeout between 4,096 and
16,384 notes, at about 3.5–4.5 ms per note. 8h4d keeps an asynchronous
operation route.

## Retrospective

The plan assumed that pressure is observable, because D16 and the binding
said so; E15 had left the question open since Phase 0. A plan that relies on a
host value for a protection rule should cite the evidence that the value is
readable, not only that it is unwritable. The worst-case size came from the
reader configuration, not from a measured fixture; a staged size ladder
found the heap limit without a lost edit result.
