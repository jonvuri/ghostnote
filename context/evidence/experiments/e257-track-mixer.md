---
title: E257 — Track mixer controls
kind: evidence
state: done
updated: 2026-10-09
owner: phase-8i7
---

# E257 — Track mixer controls

## Status

[8i7](../../plan/phase-8/8i7-track-mixer.md) is complete. The feasibility
gate passed: the host raw volume has an exact, proved dB conversion, and
the automation flag is observable on arranger and launcher-clip automation.
`agent-native-v1` has `read_track_mixer` and `set_track_mixer` (volume in
dB, pan, mute, nonexclusive solo) on durable trackIds, with field-level
guarded reversal
([D48](../../decisions/d48-track-mixer-writes-host-raw-values.md)).
Descriptions `ghostnote-description-v43`, 42 tools. The normal extension
has two new methods (91, `64d13fa7b66ad7f9`) and seven mixer values for
each track. The agent set -18 dB and -12 dB through Ghostnote, and the
operator confirmed the values in the Bitwig UI.

## Feasibility gate

| Need | Reused | Missing product guard | Observer cost | Proof |
|---|---|---|---|---|
| Exact dB | `BranchHandlers` volume read (normalized, display); `setImmediately` | A unit: the normalized curve is not dB, and the API raw range is "undefined" (E98) | Volume value and display | Live sweep below |
| Write that lands | `setImmediately` (E16) | None for normalized; `setRaw` unmeasured | — | `setRaw` lands exactly in one turn; plain `set` does not (E16 again) |
| Durable identity | `branch.mixer` takes a bank index only | channelId check at execution | — | `track.setMixer` checks it beside the setter |
| Automation | Device-parameter `hasAutomation` (E98) | A track-field flag and a refusal | 2 flags | Live: arranger and clip automation both report true |
| Field reversal | Executor stash, guarded boundary check | One durable address for each field | — | Fake and live: a changed field stays, the others return |

Gate driver: `phase8i7-mixer-gate.ts` on the probe profile, project
"New 3", one created instrument track
([gate-units.json](../data/phase8i7-mixer/gate-units.json)).

- **Volume.** Raw = normalized × 2^(1/3) to 1e-15 at 15 normalized points.
  The display equals `60 * log10(raw)` dB, rounded to 0.1 dB, at all 25
  points (for example raw 0.5012 shows -18.0 dB; raw 1 shows 0.0 dB; raw
  0.01 shows -120 dB). So the linear gain is raw³. Raw 0 is -Inf dB. The
  maximum is raw 2^(1/3) = +6.02 dB; a larger `setRaw` clamps there; a
  negative one clamps to 0. Below about -150 dB the display shows -Inf.
- **Write.** `setRaw` landed exactly (the readback double equals the sent
  double) in 64–75 ms with the poll, 0 extra polls. Plain `set` did not land
  (5.8 s timeout), as in E16.
- **Pan.** Raw -1..1, linear: normalized 0, 0.5, 1 are raw -1, 0, 1; the
  display is -100 % to 100 %.
- **Automation.** The operator drew arranger volume automation on FX 1 and
  launcher-clip volume automation on Inst 1 (clip not launched).
  `hasAutomation` was true on both and false on Audio 2. With the transport
  stopped, a raw write landed and stayed for 1 s on all three. The product
  therefore refuses an automated field: automation playback would override
  it, and the flag does not tell whether playback will start.

The conversion is a host property of the raw value, checked against the
host's own display at every point; nothing parses the display text.

## Implementation

- Extension: `MixerHandlers` adds `track.mixer` (read: every field of each
  named bank row in one turn; a row with another channelId reports
  `matches: false`) and `track.setMixer` (one track; channelId, Master kind,
  range, and automation checks, then `setRaw`, `setRaw`, `mute().set`,
  `solo().set`). Build marker `rig.info.trackMixer`
  `track-mixer-raw-v1`. The normal profile marks 7 values for each track:
  volume value, volume display, volume and pan automation, pan value, mute,
  and solo. No send, input, or VU observer. The probe gate fields stay in
  `branch.mixer` and `branch.setMixer`.
- Contract: `MixerAddress` (track + field, durable), `StateValue` `mixer`,
  op `mixer.set` (instant: one stage for all fields), the dB conversion in
  `contract/mixer.ts`. Executor readback compares the raw value within 1e-9.
  Reversal replays the prior raw value of each field.
- Tools: `read_track_mixer`, `set_track_mixer`
  (`surface/agent-native-mixer.ts`). The write reads the prior fields once;
  that read is the executor stash (`parameterPreflight`), so no second
  resolve or stash read. A field that already holds the value is not
  written. 8-track limit (`trackMixerTracks`).
- Descriptions v43 also carry the two 8i6 items: the document inputs state
  "pitch is a MIDI note number; Bitwig shows 60 as C3", and
  `read_preset_modulation` and `reverse_existing_device_modulation_wrap`
  have `agent-native-v1` text. `revert_change` names the mixer fields.

## Cost model and result

| Path | Plan | Measured (live, "New 3") |
|---|---|---|
| Read, 1 track | 4 turns, 96 ms | 2 turns, 46 ms |
| Read, 8 tracks | 28 turns, 672 ms | 2 turns, 51 ms |
| Write, 1 field on 1 track | 6–10 turns, 144–240 ms | 10 turns, 268 ms |
| Write, 4 fields on 8 tracks | 54 turns, 1,296 ms | 10 turns, 272 ms |
| Reversal, 1 field; 32 fields | 6–10; 54 turns | 14 turns, 369 ms; 14 turns, 364 ms |
| No-op write; automation refusal | — | 2 turns, 47 ms; 2 turns, 48–50 ms |
| Observers | ≤ 5 for each track (1,280) | 7 for each track (1,792) |

The plan assumed a mixer read for each track; `track.mixer` reads every
named track in one turn, so 8 tracks cost the same as 1. The write is 10
turns: the tool read (mark, `track.mixer`), the selection save
(`selection.status`, `slot.status`), the apply mark, one `batch.run`, the
post-apply mark, the 25 ms `noteWrite` settle, the verify mark and
`track.mixer`, and the launcher delta. 268 ms is 28 ms over the plan's
upper bound: the settle and the selection save were not in the plan. The
reversal is the generic revert path (resolve, stash, apply, verify, two
deltas). The observer count is two over the plan: the two automation flags
are the refusal guard and have no cheaper source.

Initialization on the normal build: 110 ms, Rig construction 79 ms
(`rig.stats`). The probe build on the same project, which marks a superset
of these values plus the sends, input kinds, and VU meters: 102 ms and
86 ms. There is no earlier normal-build sample on this project, so the
incremental cost is bounded by that noise, not measured. JVM heap (shared
with Bitwig) was 872 MiB after the controller start and 1,102 MiB after
the driver run, which created and deleted 8 tracks (deleted tracks stay in
the undo history).

## Live verification

Driver `phase8i7-mixer.ts measure` (normal profile, "New 3": Inst 1,
Audio 2, Hybrid 3, Group 4 collapsed with its child Audio 1, FX 1,
Master; [mixer.json](../data/phase8i7-mixer/mixer.json)). An independent
raw `track.mixer` call checks each value outside the tools and the
executor.

- **Values.** On 8 created tracks in one call: `-inf`, -120, -18, -12, 0,
  +6.0206, -6, -3 dB showed -Inf, -120, -18.0, -12.0, 0.0, +6.0, -6.0,
  -3.0 dB; each raw value equals `10^(dB/60)` within 1e-9 (the maximum is
  raw 2^(1/3)); pan -1, 1, ±0.5, ±0.25, ±0.1; mute and solo on. One
  reversal restored all 32 fields.
- **Kinds.** Instrument, Audio, Hybrid, Group, a child of a collapsed group,
  and Effect: read, write (pan), and reversal pass on each. The volume of
  FX 1 and of Inst 1 refused with `unsupported`, `detail.reason`
  `automation`, and nothing changed; their pan stayed writable.
- **Guarded reversal.** After a write of volume and pan, a direct host
  write moved the pan (no change record knows it). `check_revert` and
  `revert_change` restored the volume and reported the pan in
  `notRestored`; the edited pan stayed.
- **Unchanged.** The selection counters and the track order, names, kinds,
  and folding were equal before and after the mixer calls. Every created
  track was deleted; every operator field was restored.
- **UI.** `phase8i7-mixer.ts hold` set a track to -18 dB, pan -0.5, mute.
  The operator confirmed -18.0 dB, -50 %, and mute in the Bitwig UI; the
  other tracks looked unchanged.

Offline: `agent-native-mixer.test.ts` covers units, the maximum round trip,
no-op fields, limits, ranges, automation, Master, rename and deletion,
guarded reversal (a person's edit and new automation), a refusal at
execution (partial), and a failed verify read (unavailable). The call
budget and live-adapter frame tests pin the counts above.

## Review fixes

An independent review found two defects; both reproduced offline and are
fixed with regression tests in `agent-native-mixer.test.ts`.

- **A refused setter owned its field.** The take gave reversal ownership to
  every requested field. When a setter refused at execution and a person
  then moved that field before the readback, `revert_change` wrote the
  prior value over the person's edit. Now a mixer field is owned only when
  the readback holds the requested value (`stash.ts`, `ownsMixerField`).
- **The prior read was not bound to its project.** The write reuses the
  tool read as its stash, and the revision does not change on a project
  switch. A switch to a saved copy with the same trackIds wrote and
  reported `verified`. Now every mixer batch carries the scene guard of
  its stash mark (generation, project, scene epoch); the extension checks
  it before the first setter, and a mismatch refuses with `stale-address`.
  The live frame test pins the guard fields. A scene insert or delete
  between the read and the write also refuses; retry.

Both fixes add no host call. The live rerun on the same build matched:
read 48–49 ms, write 261–271 ms, reversal 361–366 ms (2, 10, 14 turns);
every case passed.

## Rerun of an affected path

The normal rig now marks the mixer values, so `phase8h4c-edit.ts cost`
(one read and one 16-note insert) ran on the 8i7 build: 1,789–1,812 ms,
54–56 wire calls, against 1,723–1,832 ms in E248 and E250. No regression.
The current drivers accept the 8i7 build (`NORMAL_8I7`) beside the 8h4f
pin.

## Fresh agent trial

Codex CLI 0.159.2, `codex exec` from an empty temporary directory, default
model, read-only shell sandbox, the ghostnote MCP server from this tree
(v43). No skill, no repository instructions, no tool names in the prompt:
"In the open Bitwig project, set the Pad track to -18 dB and the Chords
track to -12 dB, and pan Chords a little to the right." The owned tracks Pad
and Chords started at -10 dB, centre; they were deleted after the trial.
Transcripts: [trial.jsonl](../data/phase8i7-mixer/trial.jsonl) and
[trial-blocked-approval.jsonl](../data/phase8i7-mixer/trial-blocked-approval.jsonl).

- Ghostnote calls: `list_tracks`, `read_track_mixer` (both tracks),
  `set_track_mixer` (Pad -18; Chords -12 and pan 0.15). No refusal, no
  retry; 42 s. The agent reported "Pad is at -18 dB, Chords is at -12 dB,
  and Chords is panned 15% right. All changes verified."
- Independent host read: Pad raw 0.50119 (-18.0 dB), Chords raw 0.63096
  (-12.0 dB), pan 0.15.
- Before Ghostnote, the agent called the Codex computer-use plugin
  (`cua_repl`, `getApp("Bitwig Studio")`) once. The host refused it ("not
  approved"), so no UI action happened. The same first call came in both
  runs. It is a client habit that the descriptions do not cause; the
  operator's client approval controls it.
- The first run stopped at `set_track_mixer` because the operator's Codex
  configuration approves each Ghostnote write tool by name and has no entry
  for the new tool. The rerun passed the approval for this tool with `-c`,
  as the configuration does for the other write tools.

## Limits

- Automation is refused, not handled: a field with automation is not
  writable through Ghostnote. The flag covers arranger and launcher-clip
  automation; it does not say whether playback is running.
- Solo is the track solo button (nonexclusive). Sends, routing, meters,
  layer-chain mixing, and the Master track are out of scope (8i7 plan).
- A batch is not atomic: a refusal at execution after another field landed
  is `partial`, with the change in `failure.effects`.
- The write takes 10 turns; 4 of them (selection save, post-apply mark,
  delta) are generic executor costs that every write pays.
- A scene insert or delete between the tool read and the write refuses the
  write (`stale-address`, nothing written); call again.
- A Codex client that approves write tools by name needs an entry for
  `set_track_mixer` (operator configuration).

## Retrospective

The first trial run lost one round to the client approval list; a trial
that adds a write tool states the approval it needs. The probe assumption
that failed at the product boundary was the unit:
the probe handlers wrote normalized values, and the normalized curve is
not dB. The raw value, which E98 had set aside as "undefined", is the exact
unit. The probe `branch.mixer` also read the probe-only observers; the
product needed its own subscriptions. Each new primitive names its proof:
`MixerHandlers` and `contract/mixer.ts` cite this record for the unit, the
identity check, and the readback.
