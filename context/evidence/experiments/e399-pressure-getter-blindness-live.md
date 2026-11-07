---
title: E399 — Pressure setter reaches the inspector; API readback stays zero
kind: evidence
state: active
updated: 2026-10-29
owner: R02
---

# E399 — Pressure setter reaches the inspector; API readback stays zero

## Result

On Bitwig 6.1.4 / Controller API 25, `NoteStep.pressure()` reported zero for
both human-authored pressure and a public-API setter value visible in the
inspector. `setPressure(0.75)` changed the inspector to 75%; that value remained
after deselection/reselection and cursor retargeting. The writing cursor's
0.75 echo disappeared after retargeting while the inspector still showed 75%.
Velocity changes from both the human and API controls read back correctly.

This confirms pressure **readback blindness** on the tested Launcher route.
It contradicts the inference in E15-E and D37 that an absent independent API
value proves the setter never reaches the clip. It does not prove saved-file
persistence, playback pressure output, every possible API route, or the defect's
internal cause. Earlier records remain unchanged; [D66](../../decisions/d66-pressure-refusal-is-a-verification-limit.md)
corrects the rationale while retaining product pressure refusal.

## Build and method

- macOS 15.8 (24H23), Bitwig 6.1.4, API 25; embedded Java 25.0.4.1, Azul.
- Bitwig jar SHA-256 `5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`.
- Probe archive SHA-256 `2ef9ea73e1db5bed0f088ee3a268b5d96bf7c0f48704910e34a402cb39b79cdd`.
  Profile `phase-8-probe-v1`, 122 methods, hash `a8455ecb24cf6f8c`, marker
  `r02-pressure-v1`; fresh initialization `2026-10-29T13:49:14.427Z`.
- [Deployment](../data/r02-pressure/deployment-01.json),
  [operator checkpoint](../data/r02-pressure/checkpoint-01.json), and
  [handshake](../data/r02-pressure/hello-02.txt) retain identifiers and source hashes.
- [PressureProbe.java](../../../extension/src/main/java/com/ghostnote/extension/PressureProbe.java)
  uses only public API note calls, bypassing the document codec, planner and
  `NoteHandlers`. Two separately allocated Launcher cursor clips on one pinned
  cursor track have distinct NoteStep caches and init-time observers. The grid
  is 0.25 beats, 16 steps × 128 keys. Writes require settled NoteOn identities,
  exact scratch names/ID and session; each setter case can run only once.
- The [foreground driver](../../../brain/src/probes/r02-pressure.ts) logs raw
  exchanges and four samples at approximately 0/100/500/1500 ms, with disk
  attempt markers before setter dispatch. Product tools only create/remove
  the fixture. No competing bridge client was connected before live writes;
  unrelated idle editor processes were left alone.

Project `gn-scale-test` held an owned track `gn-r02-pressure`, ID
`d9ca38aa-221e-4ae1-b02f-f14fa3a9e644`, containing `gn-r02-notes` and an empty
`gn-r02-park`. Four quarter-beat notes at beat offsets 0, 1, 2 and 3 used
pitches 60, 62, 64 and 65. The second note used API channel 1 (UI channel 2);
the others used API channel 0 (UI channel 1).

## Observations

| Case | Inspector | Writing cursor | Separate reader |
|---|---|---|---|
| Human edit: D3 / UI channel 2 / beat 1 | Pressure 51%, velocity 60% | Pressure 0, velocity 0.6 | Pressure 0, velocity 0.6 |
| One API pressure write: E3 / channel 1 / beat 2 | Pressure 75%, including after reselection | Pressure 0.75 through all four samples | Pressure 0 throughout |
| One API velocity write: F3 / channel 1 / beat 3 | Velocity 50% | Velocity 0.5 immediately | Initial prior value, then 0.5 by the next sample (~120 ms) |
| Away to empty clip, then back | Reselected E3 still 75%; D3 still 51% | Pressure 0; human/API velocities retained | Pressure 0; human/API velocities retained |

The pressure setter ran at `2026-10-29T13:57:29.255Z`; its independent reader
remained zero through `13:57:30.786Z`. The return sample at
`14:01:07.841Z` showed all four correct NoteOn addresses in both handles, with
pressure zero and velocities approximately 0.7874, 0.6, 0.6299 and 0.5.
Callbacks independently reflected the human velocity change while reporting
pressure zero. The initial writer echo is diagnostic, not post-write proof.

The retarget request was named `writerOnly`, but the source cursor shares the
same CursorTrack: **both handles moved** to the empty parking clip and back.
Thus this run proves refreshed caches disagree with the inspector; it does
not prove a stationary reader remained on the test clip during retargeting.
Separate cache behavior before retargeting is directly evidenced by the
writer 0.75 / reader 0 split. No new extension deployment was made mid-run.

The operator's actual reply was “Done:” with an image showing D3/channel 2,
start 1.2.1.00, length 0.0.1.00, velocity 60.0%, and pressure 51.0%.
Subsequent inspector values were observed through CUA screenshots, with
single-note reselection. [Observations](../data/r02-pressure/observations.json)
transcribe these images; image bytes remain in the conversation and are not
archived in the repository. Do not describe the transcriptions as API output.

## Attempts, cleanup and limits

Setup created the intended fixture but failed an overly strict selection
comparison: a previously empty Launcher selection became the owned clip.
The original mixer selection remained intact. Inspection established fixture
readiness; creation was not repeated. The driver now reports that setup effect.

Deletion of the owned track succeeded, and an independent later read confirmed
all eleven original track IDs/names in their baseline order. Mixer selection
remained `gn-sel`, ID `6fb96670-abde-4958-9147-f573a4b43918`. The cleanup command
failed its final selection assertion: `selection.status` retained track index
9 / slot 0 after deletion, now the index of FX 1. The UI showed no item selected
and an empty clip editor. This discrepancy was inspected and retained; no
second deletion or speculative selection write ran. **Exact Launcher API
selection restoration is not claimed.** No playback or project save ran;
original clip/device contents were not written or exhaustively compared.

The [summary](../data/r02-pressure/summary.json) contains compact samples and
preservation comparisons. Full exchanges, failed verdicts, callback logs and
attempt markers remain in the [raw directory](../data/r02-pressure/live-01/).
The normal archive was subsequently deployed; its
[restoration record](../data/r02-pressure/normal-restoration.json) distinguishes
deployment from the still-unconfirmed operator replacement and fresh handshake.

R02's source audit and verification details are in the
[brief](../../work/r02-pressure-reproduction.md). The
[local upstream draft](../../work/r02-pressure-upstream-report.md) is for the
user to file. The planning session incorrectly recorded agent filing authority;
the user clarified that filing is theirs. No report was submitted or sent.
