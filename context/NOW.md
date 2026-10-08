---
title: Current state
kind: status
state: active
updated: 2026-10-08
phase: phase-8-agent-native-live-engine
session: 8h4g-next
---

# Now

8h4a through 8h4f are complete
([E234](evidence/experiments/e234-write-boundary-and-reader-hardening.md),
[E240](evidence/experiments/e240-collapsed-child-reader-routes.md)–[E243](evidence/experiments/e243-collapsed-cursor-and-parameter-settle.md),
[E235](evidence/experiments/e235-document-read-and-identity-registry.md),
[E245](evidence/experiments/e245-document-read-compactness-and-gain.md),
[E236](evidence/experiments/e236-document-edit-limb.md),
[E246](evidence/experiments/e246-edit-cost-and-reader-heap.md),
[E237](evidence/experiments/e237-musical-and-clip-surface-migration.md),
[E244](evidence/experiments/e244-direct-parameter-display-observer.md),
[E238](evidence/experiments/e238-device-structure-migration.md),
[E239](evidence/experiments/e239-tracks-profile-cut-and-measurements.md)).
`agent-native-v1` is the default server profile
([D40](decisions/d40-agent-native-v1-is-the-default-profile.md)), with 41
tools on one result vocabulary. `stable-v1` is the frozen rollback through
8i. The next session is
[8h4g](plan/phase-8/8h4g-performance-review-and-closeout.md): the performance
review of every path, then the 8h closeout.

## Sessions

1. 8h4a–8h4e and their follow-ups: complete (E234–E238, E240–E246; D33–D39).
2. [8h4f](plan/phase-8/8h4f-tracks-profile-cut-and-closeout.md): complete
   (E239, D40).
3. [8h4g](plan/phase-8/8h4g-performance-review-and-closeout.md): next.

## What 8h4f gives 8h4g

- `brain/src/surface/agent-native-retained.ts` holds the retained tools on the
  shared envelopes and the renamed tools: `check_bitwig_connection`,
  `add_tracks` (instrument, audio), and `duplicate_track` (Instrument, Audio,
  Hybrid). `measuredBody` wraps six tools that keep a measured body
  (device controls, preset modulation, modulation wrap and reversal).
- `agent-native-vocabulary.test.ts` gives each tool one case with a pinned
  failure code. A new tool needs a case there. The call-budget test has a
  retained-tools row.
- `classifyError` maps an unresolved track to `absent`. A refusal body keeps
  its error as a non-enumerable `cause` (`withCause`, `causeOf`).
- The server uses `DEFAULT_TOOL_PROFILE`. `callTool` and `toolsForProfile`
  still default to `stable-v1` for the historical probes; a new caller names
  its profile.
- `track.create` takes `kind` (`instrument`, `audio`); build marker
  `rig.info.trackCreateKinds`. Normal: 89 methods, `0ef817f4bac8a8a7`
  (unchanged). Probe: 107 methods, `a4c9dcd1499f498a` (mixer, send, input,
  and VU marks; `branch.vu` is active probe).
- Measurements for the review (the ledger has each row):
  - E45/E48 workflow: 7,411 ms (`stable-v1`: 12,860 ms).
  - A/B recipe: 21.9 s (`stable-v1`: 50.7 s).
  - A 27-control write takes 14.5 s and 282 wire calls on both profiles. It
    is the largest new item.
  - A structural track stage takes about 800 ms and 31 calls; the host makes
    the track visible in 117–190 ms.
- The open 8h4e items stay open: the 65 s staged 4-chain composition, the
  fixed 4,000 ms `deviceInsert` settle, about 100 calls for `delete_device`,
  and the 4 s read of a 281-ID plug-in.
- Tool descriptions are at v32 (`TOOL_DESCRIPTION_V32_SHA256`), the complete
  default list. v31 is frozen.
- The next free evidence number is E248 (E247 stays reserved for 8h4g). The
  next decision is D41.

## Live baseline

Normal `ghostnote` is loaded: archive SHA-256
`c5f103d48bee8c540678ba41851ecec50b1832047ae1c8ec446ac8b2d2d24f31` (the
8h4f build), initialized at `2026-10-08T03:10:20.654Z`. A fresh hello passes
`normal-v1`, 89 methods, `0ef817f4bac8a8a7`. The 8h4f owned project ("New 6")
holds only the operator fixture (Inst 1, Audio 2, a Hybrid track that Bitwig
renamed "Polysynth", FX 1). The operator stops the transport and closes the
project without saving. The active anchor is `gn-scale-test` with its 11
tracks ([baseline-final.json](evidence/data/phase8h4a5-cursor/baseline-final.json)).
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
For plug-in work, the operator turns the audio engine on in the owned project
(a CLAP plug-in lists no parameters with it off, E244). Adding a device to an
unnamed track makes Bitwig rename the track after the device.

Each wire call costs one control-surface turn (about 24 ms); count turns
when you estimate a live cost. `phase8h4c-edit.ts cost` prints executor
phases and wire calls. `phase8h4d-workflow.ts workflow` and
`phase8h4f-measure.ts controls|ab|retained` compare the two profiles. The
Ghostnote revision does not count a person's note edit (8h4a): it cannot
guard a read that the executor reuses.

VU audibility oracle (E239): the track VU reads before the mute, and "Stop
Transport" alone lets an earlier clip resume at the next launch. Stop every
clip and the transport, wait for VU 0, then launch one track and read the
Master VU as well.

8h4f retrospective: the first audibility runs failed on all arms, also on
the instrument control. A control arm made the oracle defect visible at
once. Keep a known-good control arm in each live matrix. The vocabulary test
found six tools that told a mistyped trackId to "retry once"; a test with one
case for each tool is the cheap way to find such drift.
