---
title: Current state
kind: status
state: active
updated: 2026-10-08
phase: phase-8-agent-native-live-engine
session: 8h4e-next
---

# Now

8h4a through 8h4e0 are complete
([E234](evidence/experiments/e234-write-boundary-and-reader-hardening.md),
[E240](evidence/experiments/e240-collapsed-child-reader-routes.md)–[E243](evidence/experiments/e243-collapsed-cursor-and-parameter-settle.md),
[E235](evidence/experiments/e235-document-read-and-identity-registry.md),
[E245](evidence/experiments/e245-document-read-compactness-and-gain.md),
[E236](evidence/experiments/e236-document-edit-limb.md),
[E246](evidence/experiments/e246-edit-cost-and-reader-heap.md),
[E237](evidence/experiments/e237-musical-and-clip-surface-migration.md),
[E244](evidence/experiments/e244-direct-parameter-display-observer.md)).
`agent-native-v1` lists 46 tools: it reads, checks, edits, adds, copies,
moves, and deletes Launcher clips, sets their launch settings and properties,
shows them, and launches them. Long edits can run in the background (D39). The
old musical tools and the observation workflow are retired from it;
`stable-v1` is unchanged. The next session is
[8h4e](plan/phase-8/8h4e-device-structure-migration.md).

## Sessions

1. [8h4a](plan/phase-8/8h4a-write-boundary-and-reader-hardening.md) and
   8h4a2–8h4a5: complete (E234, E240–E243; D33, D34).
2. [8h4b](plan/phase-8/8h4b-document-read-and-identity-registry.md) and
   [8h4b2](plan/phase-8/8h4b2-document-read-compactness-and-gain.md):
   complete (E235, E245; D35).
3. [8h4c](plan/phase-8/8h4c-document-edit-limb.md) and
   [8h4c2](plan/phase-8/8h4c2-edit-cost-and-reader-heap.md): complete (E236,
   E246; D36–D38).
4. [8h4d](plan/phase-8/8h4d-musical-and-clip-surface-migration.md): complete
   (E237, D39).
5. [8h4e0](plan/phase-8/8h4e0-direct-parameter-display-probe.md): complete
   (E244).
6. [8h4e](plan/phase-8/8h4e-device-structure-migration.md): next. Device
   structure; its parameter section now states the display rule (E244).
7. [8h4f](plan/phase-8/8h4f-tracks-profile-cut-and-closeout.md): track-kind
   arms, the default profile cut, and measurements.
8. [8h4g](plan/phase-8/8h4g-performance-review-and-closeout.md): performance
   review of every path, then the 8h closeout.

## What 8h4e0 gives 8h4e

- `Rig.directParamDisplayObserver` is the observer object; normal builds set
  no ID on it. Set the listed IDs after each new-target settle: text for each
  ID arrives one turn later, for any count. A switch sends no text; a write
  sends the text of the written ID in the same turn.
- CLAP callbacks use `CONTENTS/ROOT_GENERIC_MODULE/<id>`, not the listed ID.
  A CLAP write lands but its completion never matches (product effect
  inferred). 8h4e maps the form and verifies a CLAP write live.
- With the audio engine off, a CLAP plug-in lists no IDs. Bitwig allows the
  engine for one project at a time; the operator must turn it on in the
  owned project for CLAP work.
- `directparam.set` reads `value` as a step of `resolution - 1`; the handler
  default is 128. Probe drivers must send `resolution: 1`, as the product
  encoder does.
- Probe methods `directparam.observeDisplay` and `directparam.log` (probe
  profile, 105 methods, `513b2d6b4647bbbe`); driver
  `brain/src/probes/phase8h4e0-display.ts`.

## What 8h4d gives the next sessions

- The profile is composed in `brain/src/surface/tools.ts`:
  `AGENT_NATIVE_TOOLS` drops the names in `AGENT_NATIVE_RETIRED` (each with a
  migration contract row, "Tool migration") and replaces `launch_clip`,
  `add_scenes`, and `delete_scene` in place. The clip tools and the operation
  handle are in `brain/src/surface/agent-native-clips.ts`. 8h4e removes the
  device tools the same way.
- `agent-native-v1` captures no observation (`executeTool` records only on
  `stable-v1`); the device-alternate outcome still gates the product status.
- New pieces: failure code `occupied`; `ReadOptions.occupancy` (one
  `slot.status` for a `clip` address); `Workspace.launch` (a launch with no
  change record, D19); `completeClipProperties`, the one `clip.update` writer;
  `background` on a tool spec (D39).
- A plain read of an occupied `clip` address costs a `clip.read` capture and a
  selection borrow in the live adapter. Use the occupancy option for an
  occupancy check.
- The 7b profile is retired; its tools are in
  `brain/src/probes/phase7b-profile.ts` for the historical probes.
- Tool descriptions are at v30 (`TOOL_DESCRIPTION_V30_SHA256`); v25 still
  reproduces from the stable tools; v26–v29 are frozen fingerprints.
- The next free evidence number is E248 (E238–E239 stay reserved for 8h4e and
  8h4f, E247 for 8h4g). The next decision is D40.
- Cost rules (AGENTS.md): read the
  [performance ledger](contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md), keep the
  call-budget tests current, and remeasure a changed live path.

## Live baseline

Normal `ghostnote` is loaded (archive SHA-256
`fb8d797c199b35f4bc8a51eb92b50b2e773f3e810902cd4db50d20ba60f92cf4`, the
8h4e0 build; the normal method set did not change); initialization
`2026-10-08T00:11:05.547Z`. Fresh hello passes `normal-v1`, 88 methods,
`68d457c4c4d1d7b3`. The 8h4e0 owned project was closed without saving. The
audio engine is on for `gn-scale-test`. The active anchor is
`gn-scale-test` with its 11 tracks
([baseline-final.json](evidence/data/phase8h4a5-cursor/baseline-final.json)).
Rig config SHA-256:
`256bbf07094cd654c372d0e5e050e494ef7783c9a0001a0a2a688331bcf643b0`.

## Facts and retrospective

Add the index row in the same session as a new E or D record. Start a live edit
matrix from a rewritten clip with a palette colour. Report note channels
1-based to the operator. `context/check.rb` needs `LANG=en_US.UTF-8`. Bitwig
cannot insert a scene above row 0. The first write after an operator scene
change can refuse in the cursor preflight (E3); retry once. Probe
`WireTransport` throws plain `Error`, not `BridgeError`. The fine writer
cursor window is 2,048 steps; page it with `cursor.scrollToStep`. Bitwig
reports note pressure as 0 (D37). The normal profile has no `transport.stop`;
a live launch leaves the transport playing for the operator to stop.
`check-publication-candidates.py --write` after a reviewed spec change.

Each wire call costs one control-surface turn (about 24 ms); count turns
when you estimate a live cost. `phase8h4c-edit.ts cost` prints executor
phases and wire calls. `phase8h4d-workflow.ts workflow` compares the two
profiles on one workflow. The Ghostnote revision does not count a person's
note edit (8h4a): it cannot guard a read that the executor reuses.

8h4e0 retrospective: the plan named no audio-engine precondition, and the
first CLAP run read an empty ID list. A plan with plug-in work states that
the operator turns the engine on in the owned project. The driver also sent
the handler default resolution; probe writes copy the encoder parameters.

8h4d retrospective: the cost model counted an occupancy read as one turn, but
the live adapter reads an occupied `clip` address with its length (a
`clip.read` capture); `launch_clip` was 55 percent slower until a wire trace
found it. Trace one call of each new live path before the cost model is
final. The plan named no cost model; write it at the start of the session.
