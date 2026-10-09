---
title: E254 — Device control identity and route claims
kind: evidence
state: done
updated: 2026-10-09
owner: phase-8i5
---

# E254 — Device control identity and route claims

## Status

[8i5](../../plan/phase-8/8i5-device-control-identity.md) is complete. A
returned sparse remote selector writes the exact control. The three
modulation writers of `agent-native-v1` run no behavior witness
([D46](../../decisions/d46-modulation-writers-claim-the-route-not-the-sound.md)):
the Sampler wrap that failed on 2026-10-09 completes, and the wrapper,
preset edit, and composition with modulators are 31 to 71 percent faster.
A live conformance suite keeps the route proof. First-read Patch help
removed the repeat reads in a fresh agent trial. No extension change. Tool
descriptions are `ghostnote-description-v40` (v39 in the trial; v40 adds the
identity check below).

## Causes (2026-10-09 trial)

1. Blur `Common` lists controls at host positions 0, 1, 2, 3, and 7.
   `set_device_controls` indexed the compact control array by the host
   position, so `Common/7/Mix` from a fresh read refused with `internal`.
   Four fake-adapter lookups had the same error; the live adapter
   `remoteState` and the read view were correct.
2. The Sampler ADSR wrap of `CONTENTS/FILT_FREQ` (`Filter Frequency`)
   completed every structural stage, then its behavior witness had nothing
   to observe. API 25 DirectParameter observers give no modulated value, a
   `RemoteControl` has no ID, and Sampler has no typed handle. The fallback
   looked for a remote control with the same name; Sampler labels it
   `Filt Freq`. The result reported a failed post-move witness, and the agent
   sampled the remote control six times by hand.

Bitwig ships `Default.bwremotecontrols` for each native device. Sampler's
file maps its `Overview` slots to `CONTENTS/FILT_FREQ` and other IDs. That
is an ID mapping for default pages only; a preset can replace the pages.
It is a later candidate, not used here.

## Change

- `resolveRemoteSelector` (`contract/state.ts`) finds a page and control by
  host index, then checks both names and uniqueness. `set_device_controls`,
  the live adapter, and the fake adapter use it. A selector that is absent,
  changed, or ambiguous refuses before the first write with
  `RemoteSelectorError`: code `absent` or `target-changed`, reason
  `remote-selector-*`, and the selector in the refusal. A fake page can now
  give a control its host `index`.
- D46: the wrapper, `edit_preset_modulation`, and `compose_devices` in
  `agent-native-v1` pass `behaviorWitness: 'skip'` (wrapper and offline
  template) or make every modulator `page-only` (staged composition).
  `behaviorCheck` and `behaviorChecks` left their schemas. Each refuses an
  unproved route form before any read or write (`unprovedRouteTargets`,
  reason `unproved-route-form`). Results carry
  `modulation: { behaviorWitness: 'not-run', claim }`. Result schemas:
  `ghostnote-device-modulation-wrap/2`, `ghostnote-preset-modulation-edit/2`,
  `ghostnote-device-compose/2`. `stable-v1` keeps the witness.
- A failed post-move check names each cause in `why` (fingerprint, pages,
  behavior) and keeps the location and the reversal checkpoint.
- `read_launcher_clip` states that `reference` comes with the document and
  `authority.base` in one result, and asks for Patch on the first fresh read
  before a patch edit. The read payload did not change.
- `npm run probe:modulation-routes` runs the 5j, 5p, and 5q route probes in
  sequence and stops at the first failure.

## Review fix: target identity

An independent review found that skipping the witness also skipped its first
step, the exact ID and name check in the inventory of the new device.
`edit_preset_modulation` and staged `compose_devices` returned verified with
`CONTENTS/DOES_NOT_EXIST` and with a wrong name for `CONTENTS/F1FREQ`, after
recorded writes. Reproduced offline; the compose test fails with the earlier
`page-only` mapping.

Fix: `verifyModulations` has an `identity` expectation. It reads the stable
inventory and checks the ID and name, then takes no remote fallback and no
samples. Agent-native authoring (add and retarget), staged composition, and
the offline template use it. A failed check is a post-write failure: the
change stays recorded for `revert_change`, and `edit_preset_modulation`
returns `failure.code: unavailable`, stage `readback` (before, a failed
`verified.passed` had no top-level failure). The public behavior row is
marked `check: identity`. The wrapper checks its targets before the first
write and compares the fingerprint after the move.

## Offline results

All 2,148 brain tests pass (`npm run check`); extension tests pass.

| Test | Result |
|---|---|
| Resolver: Blur shape, array position, stale control and page name, missing page, duplicate index | host index found; `absent`, `changed`, `changed`, `absent`, `ambiguous` |
| `set_device_controls` on fake Blur: `Common/7/Mix` and `Tone/5/High Cut` | verified; Damping at array index 3 unchanged; both revert |
| Same, with array position 4, stale names, duplicate index | `absent` or `target-changed` with the reason; no change recorded |
| A direct write, then a stale remote selector | `partial`, one effect |
| Wrap of a target with no modulated value | `stable-v1` partial with `1 behavior witness(es) failed` and a checkpoint; `agent-native-v1` complete, no samples, reverses |
| Wrap, authoring, composition with `CONTENTS/OSC1/PITCH` | `unsupported`, `unproved-route-form`, nothing written |
| Base value changed during the move | `partial`; `why` names the fingerprint, not behavior |
| `edit_preset_modulation` with `behaviorChecks` | schema rejection naming D46 |
| Authoring and staged composition with a missing ID or a wrong name | not verified; `failure` with the recorded effects |

## Live results

Normal extension unchanged (89 methods, `0ef817f4bac8a8a7`). "New 2", audio
engine on. Driver `phase8i3-long-writes.ts identity`; artifact
[`data/phase8i5-identity/identity.json`](../data/phase8i5-identity/identity.json).

| Step | Wall | Calls / turns | Before |
|---|---:|---|---|
| Blur `Common/7/Mix` write; revert | 1,561 ms; 2,503 ms | 42 / 37; 53 / 45 | refused `internal` |
| Same control by direct ID; revert | 2,196 ms; 2,723 ms | 57 / 52; 61 / 53 | E250 one control 2.4 s |
| Sampler ADSR wrap of `Filter Frequency`; reversal | 9,683 ms, complete; 5,291 ms | 296 / 228; 162 / 127 | partial (2026-10-09) |
| Wrap 1 and 15 LFOs on Polysynth | 9,669; 9,699 ms | 296 / 228 each | E252 13,557; 13,586 ms; E247 420 calls |
| Their reversals | 5,301; 5,262 ms | 162 / 127 | E252 5,260–5,511 ms |
| `edit_preset_modulation`, one LFO; revert | 1,510 ms; 1,318 ms | 50 / 37 | E252 7,092 ms; E247 179 calls |
| `compose_devices`, 2 Polysynths with 2 container LFOs each (6 units); revert | 10,921 ms; 9,972 ms | 386 / 296; 360 / 275 | E252 25.3 s; 10.6 s |

Rerun after the review fix
([`data/phase8i5-identity-review/identity.json`](../data/phase8i5-identity-review/identity.json)):
the preset edit 2,055 ms (67 calls, +17: one complete inventory of the new
device, about 0.5 s, so +36 percent); the composition 12,449 ms (446 calls,
+60: one inventory for each modulated device, +14 percent); the wrapper
9,306–9,455 ms and the Blur write 1,623 ms, unchanged. These are the current
values.

Blur exposed three pages: `Blur` (0–7), `Common` (0, 1, 2, 3, 7), and
`Envelope` (0–3). As in E252, the wrap time does not depend on the modulator
count. Heap 510 to 560 MiB over the
run. Every write was reversed and the owned track deleted; the track list
equals the baseline.

Cost model (plan): the selector repair adds no host turn; the D46 change
removes the behavior inventory and sample rounds. Measured: the remote write
has the same stages as a direct write and fewer turns. The wrapper saved 124 wire calls and 3.9 s; the preset edit
129 calls and 5.6 s; the composition 14.4 s. The reversals did not change.

## Route conformance suite

`npm run probe:modulation-routes`, same project, audio engine on
([`modulation-route-suite.log`](../data/phase8i5-identity/modulation-route-suite.log)):
18 of 18 checks pass in 160 s. 5j: native Polysynth `CONTENTS/F1FREQ` and
Zebra3 VST3 `CONTENTS/PID411` top-level routes are active and reverse. 5p:
Delay+ `CONTENTS/BLUR` and Zebra3 VST3 `PID411` inside an FX Layer entry
pass every live witness and reverse. 5q: the composed container route into
Zebra3 VST3 is active; the sampled preset-local route stays page-only. Each
probe restored the entry track list.

Gap: no ID-bound CLAP witness. Zebra3 and Repro-5 CLAP expose no remote
pages and have no typed handle; E97 proved nested ColourCopy routes through
equal-name remote controls.

## Fresh agent trial

Codex `codex://threads/01a11e9e-002d-7b13-b461-f43fefbfb486`, v39
descriptions, no repository tutorial. Task: on an owned 16-beat bass clip,
raise the four half-beat notes one octave and set their velocity to 60.

- The first fresh read requested `reference: ["Patch"]`. The agent stored
  that result and built the patch from its `authority.base` and IDs. No
  repeat read (the 2026-10-09 revision used three reads for one edit).
- Ghostnote calls: `list_tracks`, `read_launcher_clip`,
  `edit_launcher_clip`. Six model round trips, 24.3 s prompt to result.
  The edit verified with no discrepancies; eight notes unchanged.
- The operator could not have the agent confirm the description version:
  no tool returns it. Candidate: report `TOOL_DESCRIPTION_VERSION` in
  `check_bitwig_connection`.

The trial track was deleted after the run.

## Retrospective

Fixtures with dense pages and labels equal to DirectParameter names hid
both failures. Model host indices and real labels in fakes. A per-call
proof that needs the audio engine and sounding notes can cost more than
the risk it covers; move it to a conformance suite when the risk comes from
construction, not from the call.
