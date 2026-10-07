---
title: Current state
kind: status
state: active
updated: 2026-10-07
phase: phase-8-agent-native-live-engine
session: 8h4c2-next
---

# Now

8h4a through 8h4c are complete
([E234](evidence/experiments/e234-write-boundary-and-reader-hardening.md),
[E240](evidence/experiments/e240-collapsed-child-reader-routes.md)–[E243](evidence/experiments/e243-collapsed-cursor-and-parameter-settle.md),
[E235](evidence/experiments/e235-document-read-and-identity-registry.md),
[E245](evidence/experiments/e245-document-read-compactness-and-gain.md),
[E236](evidence/experiments/e236-document-edit-limb.md)).
`agent-native-v1` reads a Launcher clip (`read_launcher_clip`), checks base
refs (`check_launcher_clips`), and edits it (`edit_launcher_clip`) with a
sparse patch, a guarded desired document, or an unguarded replacement.
The next session is
[8h4c2](plan/phase-8/8h4c2-edit-cost-and-reader-heap.md): edit cost and a
reader heap guard. Then [8h4d](plan/phase-8/8h4d-musical-and-clip-surface-migration.md).

## Sessions

1. [8h4a](plan/phase-8/8h4a-write-boundary-and-reader-hardening.md) and
   8h4a2–8h4a5: complete (E234, E240–E243; D33, D34).
2. [8h4b](plan/phase-8/8h4b-document-read-and-identity-registry.md) and
   [8h4b2](plan/phase-8/8h4b2-document-read-compactness-and-gain.md):
   complete (E235, E245; D35).
3. [8h4c](plan/phase-8/8h4c-document-edit-limb.md): complete (E236; D36,
   D37).
   - [8h4c2](plan/phase-8/8h4c2-edit-cost-and-reader-heap.md): next. A
     16-note insertion takes 7.2 s because new notes write every portable
     default (32 stages instead of 1) and each edit makes four cold reads. The
     cold reader has no sounding-cell guard: 8.4 million cells exhausted the
     extension heap.
4. [8h4d](plan/phase-8/8h4d-musical-and-clip-surface-migration.md): after 8h4c2.
   Observation retirement, old musical tools retired, Launcher clip names.
5. [8h4e0](plan/phase-8/8h4e0-direct-parameter-display-probe.md): probe of
   the DirectParameter display observer (E244).
6. [8h4e](plan/phase-8/8h4e-device-structure-migration.md): device structure.
7. [8h4f](plan/phase-8/8h4f-tracks-profile-cut-and-closeout.md): track-kind
   arms, the default profile cut, measurements, and the 8h closeout.

## What 8h4c gives 8h4c2 and 8h4d

- `edit_launcher_clip` (`brain/src/surface/agent-native-edit.ts`) over the pure
  planner `planLauncherClipEdit` (`brain/src/bindings/launcher-clip-edit.ts`).
  `add_launcher_clip` lowers its content through the same planner. The edit
  limb refuses an empty slot (`absent`); creation is 8h4d work.
- Routes: targeted (`note.remove`, `note.insert`) when every changed note
  changes its cell; otherwise whole-clip. HOST-BINDING "Edit limb" and "Edit
  refusals" list the rules and the `unsupported` reasons.
- The registry stores overlays, META, and EXTENSIONS per base ref
  (`overlay-carry.ts`); `recordWrite` binds a verified write with the candidate
  IDs. A check of a pre-edit ref is `stale` and names the written base.
- Worst case (E236): whole-clip 4,096 notes 20.1 s, 16,384 notes 73.0 s. This
  is over the 60 s client timeout, so 8h4d keeps an asynchronous route. A
  65,536-note fixture read exhausted the extension Java heap; a 131,072-note
  fixture write hit the 2,048-step writer window, and Bitwig crashed. The
  heap cost scales with sounding cells, not notes (E227); 8h4c2 adds the guard.
- Tool descriptions are at v28 (`TOOL_DESCRIPTION_V28_SHA256`); v25 still
  reproduces from the stable tools; v26 and v27 are frozen fingerprints.
- The next free evidence number is E246 (8h4c2 uses it; E237–E239 stay
  reserved for 8h4d–8h4f). The next decision is D38.

## Live baseline

Normal `ghostnote` is loaded (archive SHA-256
`46cde14347a24b6efc7999251fb798665fd4cad9d00d0f50293e45859354bce7`,
unchanged). The operator restarted the controller after the heap failure;
initialization `2026-10-07T13:53:09.054Z`. The active anchor is
`gn-scale-test` with its 11 tracks: the ten E231 IDs and `gn-E16` (`hidden`)
inside the collapsed `Group 5`
([baseline-final.json](evidence/data/phase8h4a5-cursor/baseline-final.json)).
Fresh hello passes `normal-v1`, 88 methods, `68d457c4c4d1d7b3`, and the 8h4a
to 8h4a5 build markers. The 8h4c projects `New 1` and `New 2` were closed
without saving. Rig config SHA-256:
`256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0`.

## Facts and retrospective

Add the index row in the same session as a new E or D record. Start a live edit
matrix from a rewritten clip with a palette colour. Report note channels
1-based to the operator. `context/check.rb` needs `LANG=en_US.UTF-8`. Bitwig
cannot insert a scene above row 0. The first write after an operator scene
change can refuse in the cursor preflight (E3); retry once. Probe
`WireTransport` throws plain `Error`, not `BridgeError`. The fine writer
cursor window is 2,048 steps; page it with `cursor.scrollToStep`.
`write_notes` adds notes; restore with `erase_notes`. Bitwig reports note
pressure as 0 (D37): an operator step that changes only pressure cannot be
detected by polling a read; use a flag file and a visual check.
`check-publication-candidates.py --write` after a reviewed spec change.

8h4c retrospective: the plan relied on pressure being observable because D16
and the binding said so, but E15 had left it open since Phase 0. A plan that
uses a host value for a protection rule should cite evidence that the value
is readable. The worst-case size came from the reader configuration, not a
measured fixture; a staged size ladder found the limit, and two crashes cost
little because each stage ran in an owned unsaved project.
