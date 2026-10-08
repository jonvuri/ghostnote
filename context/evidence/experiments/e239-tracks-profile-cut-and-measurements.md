---
title: E239 — Track kinds, profile cut, and measurements
kind: evidence
state: done
updated: 2026-10-08
owner: phase-8h4f
---

# E239 — Track kinds, profile cut, and measurements

## Status

[8h4f](../../plan/phase-8/8h4f-tracks-profile-cut-and-closeout.md) is complete.
`agent-native-v1` is the default server profile (D40). `stable-v1` stays
selectable with `GHOSTNOTE_TOOL_PROFILE=stable-v1`. Its registration hash, its
53 tools, and its server instructions do not change.

- The live track-kind arms pass for audio-track creation and for Audio and
  Hybrid duplication, 2 runs each. The track tools are `add_tracks`
  (instrument and audio) and `duplicate_track` (Instrument, Audio, Hybrid).
- `check_connection` is `check_bitwig_connection`.
- Every retained tool uses the shared result module. A schema test over all
  41 tools checks one address, health, result, and error vocabulary.
- `agent-native-v1` lists 41 tools (target: at most 42). Its `tools/list` is
  99,062 bytes; `stable-v1` is 159,738 bytes by the same method (38 percent
  smaller).
- Tool descriptions are at v32 (`TOOL_DESCRIPTION_V32_SHA256`). The cohort is
  the complete default list. v31 is frozen.

## Track-kind arms (`phase8h4f-tracks.ts arms`)

The driver runs on the probe profile (107 methods, `a4c9dcd1499f498a`) in an
owned unsaved project ("New 6"). The fixture is one Audio track with an audio
clip in row 0, one Hybrid track, and one FX track. Each write goes through the
product executor path (`track.create`, `track.duplicate`). The probe reads the
mixer, sends, input kind, and VU of each track. These values are marked in the
probe profile only (`Rig`, `hasProbeResources`). `branch.vu` moves from
historical to active probe for this oracle.

| Arm | Identity | Type | Content | Routing | Mixer | Audible | Write |
|---|---|---|---|---|---|---|---:|
| Control: duplicate an Instrument track (Polysynth, note clip) | Fresh, adjacent | Instrument | Clip slots, devices, note events equal | Sends (value, pre/post, mode), note input equal | Volume, pan, mute, colour equal | Yes | 817–832 ms, 31 calls |
| Create an audio track (`kind: audio`) | Fresh | Audio | Empty: no clip, no device | Audio input; send off | Default: pan 0.5, unmuted, active | Silent with no content (VU 0) | 799–801 ms, 31 calls |
| Duplicate the Audio track (audio clip, Peak Limiter) | Fresh, adjacent | Audio | Clip slots and devices equal | Sends and audio input equal | Equal | Yes | 799–831 ms, 31 calls |
| Duplicate the Hybrid track (Polysynth, note clip) | Fresh, adjacent | Hybrid | Clip slots, devices, note events equal | Sends and note input equal | Equal | Yes | 817–827 ms, 31 calls |

- The source gets a non-default strip first (volume 0.62, pan 0.35, a colour,
  send 0.42 in PRE mode), so a copy cannot match by fresh-track defaults
  (E16 row B5).
- Audibility oracle: stop every clip and the transport, wait until the VU of
  both tracks is 0, mute the other track, reset the VU, and launch row 0. The
  launched track and the Master read signal (68–105 and 70–109); the muted,
  stopped track reads 0. The copy and the source pass in both directions.
- The scene count does not change, and the source keeps its identity.
- Each copy arrives unmuted and active: it is audible at once (E16 row E5).
- Bounded readback: each mint appeared inside the 8 s poll in the same stage.
- No residue: the driver deletes each created track.

Three oracle defects of the first runs were in the driver, not in the host.
The track VU reads before the mute. "Stop Transport" alone lets an earlier
clip resume at the next launch. A release tail stays on the VU after the stop.
The final oracle above removes all three.

Not proved: an audio clip on a Hybrid track, and the copy of Group, Effect,
and Master tracks. `duplicate_track` refuses those kinds before a write (code
`unsupported`). The Bitwig API has no route that makes a Hybrid, Group, or
Effect track (`Application` has `createInstrumentTrack`, `createAudioTrack`,
and `createEffectTrack`; the effect route is not measured). The plan names a
failed arm a proof gap; no arm failed.

## Changes

1. **Extension.** `track.create` takes an optional `kind`: `instrument`
   (default) or `audio`. An unknown kind refuses before a host call.
   `rig.info.trackCreateKinds` is the build marker. The normal method set and
   hash do not change (89, `0ef817f4bac8a8a7`). The probe profile adds the
   mixer, send, input, and VU marks and `branch.vu` (107,
   `a4c9dcd1499f498a`; historical 54).
2. **Contract.** `CREATABLE_TRACK_KINDS` and `Op['track.create'].kind`. The
   encoder sends `kind` only for an audio track, so an instrument frame is
   unchanged.
3. **Surface** (`brain/src/surface/agent-native-retained.ts`).
   - New envelopes: `check_bitwig_connection`, `list_tracks`, `list_changes`,
     `check_revert`, `revert_change`, `rename_track`, `list_modulator_types`,
     `set_device_enabled`, `delete_track`, `add_tracks`, and
     `duplicate_track`.
   - A place uses the nouns `track`, `scene`, `launcher_clip`, `device`, and
     `device_control`, with 1-based note channels.
   - The composition reversal of 8h4e moves into `revert_change` and
     `check_revert` here.
4. **Measured bodies.** Six tools keep the body that E126 and 8h4e measured:
   `read_device_controls`, `set_device_controls`, `read_preset_modulation`,
   `edit_preset_modulation`, `wrap_existing_device_modulation`, and
   `reverse_existing_device_modulation_wrap`. They add `schema` and, on a
   refusal, a standing that is not stable, or a partial write, the shared
   `failure` object (D40).
   - Review fixes: a throw after a recorded write returns code `partial` with
     each recorded change in `failure.effects` (`edit_preset_modulation`
     rethrows when verification fails after the insertion). An incomplete
     wrap or reversal with no applied stage returns `target-changed` when the
     revision guard rejected the stage, otherwise `authority-unavailable`.
     Two tests reproduce both cases and failed before the fix.
5. **Error vocabulary.**
   - `classifyError` maps an unresolved track address to `absent`. Before
     this, a mistyped trackId gave `authority-unavailable`, "retry once", on
     six tools.
   - A missing file maps to `absent`. A missing change, an empty scope, a
     value outside a domain, an unprotected write, and an invalid op have
     codes.
   - Refusal bodies keep their error as a non-enumerable `cause`
     (`withCause`), so the serialized `stable-v1` bytes do not change.
6. **Addresses.** `delete_device` and the `move_devices` top-level
   destination use `devicePosition`, not `position`. `read_devices` and
   `add_devices` report `devicePosition` for a device.
7. **Server.** `DEFAULT_TOOL_PROFILE` is `agent-native-v1`. The server
   instructions follow the profile; the `stable-v1` text is frozen. The
   library helpers (`callTool`, `toolsForProfile`) keep `stable-v1` as their
   default: the historical probes and the frozen stable tests use it.
8. **Tests.**
   - `agent-native-vocabulary.test.ts` gives each of the 41 tools one case.
     A missing target must fail with its pinned code, and a read without a
     target must return its schema.
   - The test bans project indexes and implementation names in inputs. A
     device address must use `devicePosition`.
   - New call budgets cover the retained tools. The server tests cover the
     default and the rollback.

E234 input: D34 (8h4a3) made the reader expand collapsed parent groups, so
the `bound-target-mismatch` case does not reach an agent. `collapsed-group-row`
already says to expand the group (`retryWhen`).

## Measurements (normal profile, "New 6")

Totals leave out the setup and cleanup calls. Each comparison runs 2 times;
the runs agree within 1 percent.

| Workflow | `stable-v1` | `agent-native-v1` | Source |
|---|---|---|---|
| Compact read, typical clip (256 notes, 16 channels) | `read_clip` (one channel): 642 ms, 3,963 bytes | `read_launcher_clip` (16 channels): 424 ms, 10,956 bytes | `workflow.json` |
| 16-note insertion | `write_notes`: 1,148 ms | `read_launcher_clip` + `edit_launcher_clip`: 443 + 1,457 ms | `workflow.json` |
| E45/E48-style workflow (read, copy, insert, launch, show, two reverts) | 7 calls, 12,860 ms, 15,123 bytes | 8 calls, 7,411 ms, 28,364 bytes | `workflow.json` |
| 27-control write on Polysynth | 2 calls, 15,268–15,309 ms, 15,009 bytes, 305 wire calls | 2 calls, 15,289–15,351 ms, 15,114 bytes, 305 wire calls | `controls.json` |
| A/B audition and winner collapse (2 chains, B wins) | 9 calls, 50,693–50,706 ms, 6,810–6,819 bytes, 763 wire calls | 8 calls, 21,877–21,903 ms, 6,492–6,520 bytes, 497 wire calls | `ab.json` |

- The E45/E48 workflow is 42 percent faster than on `stable-v1` (E237: 41
  percent), with one more call: the edit needs the read for its base. Its
  bytes are larger because the read returns all 16 channels.
- The 27-control write is the same path on both profiles. It takes 14.5 s and
  282 wire calls for the write (about 10 calls and 535 ms for each control).
  The success result is 4,278 bytes on `stable-v1` and 4,321 bytes on
  `agent-native-v1`: the `schema` field adds 43 bytes. Live parameter IDs are
  longer than in E126, so both are above the 3,181-byte E126 figure; the
  offline 27-control test stays below it.
- A/B: the stable route makes an empty container, inserts two devices, fills
  each alternate (6 s each), and keeps one (10.5 s). `compose_devices` makes
  the complete structure in one insertion (7.7 s). The collapse is
  `move_devices` (6.4 s) and `delete_device` (3.7 s).

Removed guards and verification steps: none. The envelopes map the same
reads and writes. Three counts move against `stable-v1` (call-budget test):

- `add_tracks` reads the bank once for the kind readback, where `add_track`
  read the minted addresses. The count is the same.
- `duplicate_track` reads the bank where `copy_track` took a mark. The count
  is the same; the adapter's `assertTrackRoom` still refuses a copy past the
  window.
- `rename_track` reads the bank once more (+1 call, about 24 ms). The executor
  records a rename of a missing track as a failed op, not a refusal, so the
  tool checks the trackId first.

## Cost against the plan model (`retained.json`, one live call each)

| Path | Model | Measured | Difference |
|---|---:|---:|---|
| `add_tracks`, 2 tracks (audio, instrument) | 0.8–1.2 s for one track | 1,935 ms, 67 wire calls | Two mint polls in one create stage, then one rename stage |
| `duplicate_track`, Audio and Hybrid | 1.0–1.5 s | 1,178–1,197 ms, 48 wire calls | As the model |
| `check_bitwig_connection` | One turn | 21 ms, 2 wire calls | `revision.get` and `track.list` go out together (E246) |
| `list_tracks` | Two turns | 43 ms, 3 wire calls | As the model |
| `rename_track` | One stage | 386 ms, 16 wire calls | The extra bank read is one call |
| `set_device_enabled`, its revert | — | 770 ms; 665 ms | Same path as `stable-v1` |
| `delete_track`, 4 tracks | — | 2,517 ms, 87 wire calls | Four structural stages |

The arms' structural stage takes about 800 ms and 31 wire calls for each kind.
The model counted the E16 visibility time (117–190 ms); the stage also
releases the writer cursors and rescans the bank. An audio kind adds no call.

## Artifacts

- [arms-run1.json](../data/phase8h4f-tracks/arms-run1.json),
  [arms-run2.json](../data/phase8h4f-tracks/arms-run2.json):
  `phase8h4f-tracks.ts verify-offline` recomputes each verdict.
- [controls.json](../data/phase8h4f-measure/controls.json),
  [ab.json](../data/phase8h4f-measure/ab.json),
  [retained.json](../data/phase8h4f-measure/retained.json):
  `phase8h4f-measure.ts verify-offline` recomputes the totals.
- [workflow.json](../data/phase8h4f-workflow/workflow.json):
  `phase8h4d-workflow.ts verify-offline` reports no issue; each baseline
  ends at the raw source.

## Verification

- Brain check: typecheck and 2,075 tests pass.
- Extension tests and the wire goldens pass (normal 89 unchanged; probe 107).
- Context check and `git diff --check` pass.
- Live: two hellos (probe, then normal) pass with fresh initialization and
  the `trackCreateKinds` marker.
