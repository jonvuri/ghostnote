---
title: Current state
kind: status
state: active
updated: 2026-10-07
phase: phase-8-agent-native-live-engine
session: 8h4d-next
---

# Now

8h4a through 8h4c2 are complete
([E234](evidence/experiments/e234-write-boundary-and-reader-hardening.md),
[E240](evidence/experiments/e240-collapsed-child-reader-routes.md)–[E243](evidence/experiments/e243-collapsed-cursor-and-parameter-settle.md),
[E235](evidence/experiments/e235-document-read-and-identity-registry.md),
[E245](evidence/experiments/e245-document-read-compactness-and-gain.md),
[E236](evidence/experiments/e236-document-edit-limb.md),
[E246](evidence/experiments/e246-edit-cost-and-reader-heap.md)).
`agent-native-v1` reads a Launcher clip (`read_launcher_clip`), checks base
refs (`check_launcher_clips`), and edits it (`edit_launcher_clip`) with a
sparse patch, a guarded desired document, or an unguarded replacement. One
read and a 16-note insertion take 1,892 ms.
The next session is
[8h4d](plan/phase-8/8h4d-musical-and-clip-surface-migration.md).

## Sessions

1. [8h4a](plan/phase-8/8h4a-write-boundary-and-reader-hardening.md) and
   8h4a2–8h4a5: complete (E234, E240–E243; D33, D34).
2. [8h4b](plan/phase-8/8h4b-document-read-and-identity-registry.md) and
   [8h4b2](plan/phase-8/8h4b2-document-read-compactness-and-gain.md):
   complete (E235, E245; D35).
3. [8h4c](plan/phase-8/8h4c-document-edit-limb.md): complete (E236; D36,
   D37).
   - [8h4c2](plan/phase-8/8h4c2-edit-cost-and-reader-heap.md): complete
     (E246, D38).
4. [8h4d](plan/phase-8/8h4d-musical-and-clip-surface-migration.md): next.
   Observation retirement, old musical tools retired, Launcher clip names.
5. [8h4e0](plan/phase-8/8h4e0-direct-parameter-display-probe.md): probe of
   the DirectParameter display observer (E244).
6. [8h4e](plan/phase-8/8h4e-device-structure-migration.md): device structure.
7. [8h4f](plan/phase-8/8h4f-tracks-profile-cut-and-closeout.md): track-kind
   arms, the default profile cut, and measurements.
8. [8h4g](plan/phase-8/8h4g-performance-review-and-closeout.md): performance
   review of every path (waste, scaling, wall clock against probes; brain
   planning time), then the 8h closeout.

## What 8h4c and 8h4c2 give 8h4d

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
- 8h4c2 (E246): a new note leaves default fields to the host insertion value
  (no property stage). The executor verify read is the tool readback; on the
  targeted route the tool read is also the stash read (D38, the only shared
  read). The adapter's note-step wake is off (`noteWake` option), a mark sends
  `revision.get` and `track.list` together, and a `ContentDelta` carries its
  closing `mark`.
- The cold reader refuses above 2,097,152 sounding cells
  (`sounding-cell-limit`, `ClipReadLimitError`, tool code `outside-limit`).
  The guard counts after the host replay, so it protects up to the size the
  replay survives (4.2 million cells reached the 3 GiB heap maximum; 8.4
  million failed in E236).
- Worst case at the limit: whole-clip 16,384 notes 48.0 s (E236: 73.0 s),
  under the 60 s client timeout; plan time is 12.0 s. 8h4d keeps an
  asynchronous route. A fixture write above 2,048 steps per channel needs
  `cursor.scrollToStep` (E236).
- Tool descriptions are at v29 (`TOOL_DESCRIPTION_V29_SHA256`); v25 still
  reproduces from the stable tools; v26–v28 are frozen fingerprints.
- The next free evidence number is E248 (E237–E239 stay reserved for
  8h4d–8h4f, E247 for 8h4g). The next decision is D39.
- Cost rules (AGENTS.md): a session that changes a live path reads the
  [performance ledger](contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md), writes a
  cost model if the plan has none, keeps the call-budget tests
  (`brain/src/surface/call-budget.test.ts`, the live adapter frame test)
  current, and remeasures.

## Live baseline

Normal `ghostnote` is loaded (archive SHA-256
`34491a92d80ae2a037d274166fdda92717af5333c7cc8fb08f5e017fa82208f6`, the
8h4c2 build); initialization `2026-10-07T14:49:01.524Z`. The active anchor is
`gn-scale-test` with its 11 tracks: the ten E231 IDs and `gn-E16` (`hidden`)
inside the collapsed `Group 5`
([baseline-final.json](evidence/data/phase8h4a5-cursor/baseline-final.json)).
Fresh hello passes `normal-v1`, 88 methods, `68d457c4c4d1d7b3`, and the 8h4a
to 8h4c2 build markers (`limitRule: sounding-cell-limit-v1`). The 8h4c2
project `New 2` was closed without saving. Rig config SHA-256:
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

Each wire call costs one control-surface turn (about 24 ms); count turns
when you estimate a live cost. `phase8h4c-edit.ts cost` prints executor
phases and wire calls. `GN_8H4C_UNATTENDED=1` runs the E236 accept matrix
without operator steps. The Ghostnote revision does not count a person's
note edit (8h4a): it cannot guard a read that the executor reuses.

8h4c2 retrospective: the plan named its cost causes from stage and read counts;
a per-call wire trace found the larger remainder (round trips). Profile the
wire calls before a cost plan names causes. The shared-read step assumed that
the revision guard sees a person's edit; that rule lived only in executor
comments, so the plan's entry list did not reach it.
