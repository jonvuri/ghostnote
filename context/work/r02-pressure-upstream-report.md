# R02 local report draft and filing outcome

**Filed by the user on 2026-11-07 with the clean minimal repro.** The
[closeout](r02-pressure-reproduction.md#closeout--2026-11-07) retains the user's
confirmation. No ticket reference, exact submitted text, minimal-run console
output or upstream response was supplied. This file is supporting local
material, not a copy of the confirmed submission. The agent sent nothing;
filing and any external follow-up belong to the user.

Research evidence remains in
[E370](../evidence/experiments/e370-pressure-getter-blindness-live.md).

## Subject

Controller API 25: NoteStep.pressure() returns 0 for nonzero inspector pressure
(Bitwig 6.1.4)

## Minimal reproduction used for the report

Use the standalone [Pressure Getter script](../../extension/repro/pressure-getter/PressureGetter.control.js)
and its [three-step instructions](../../extension/repro/pressure-getter/README.md).
It reads one manually authored note through one selected Launcher clip handle,
without note observers or writes. Expected state/velocity/pressure:
`NoteOn / 0.6 / 0.51`. The user confirmed filing with this repro; its actual
console output was not supplied in the conversation.

The earlier experiment below is retained as supporting investigation. It is
separate from the minimal reproduction the user reports filing.

## Earlier investigation

On macOS 15.8 (24H23), Bitwig Studio 6.1.4 / Controller API 25,
`NoteStep.pressure()` returns zero for a Launcher note whose inspector shows
nonzero pressure. This occurs for both manually edited pressure and an API
`setPressure(0.75)` write. Velocity works through the same handles and note
addresses. No physical MIDI controller is involved.

The reproduction uses two separately allocated
`CursorTrack.createLauncherCursorClip(16, 128)` handles on one pinned cursor
track. Both register `addNoteStepObserver` during initialization and use
`setStepSize(0.25)`. The read/write path calls the public API directly, without
note serialization or a planner. Note starts are allowed to settle before
property changes; each setter runs once.

1. On one temporary track, create two Launcher clips in different slots: a
   four-beat test clip and an empty parking clip. Add quarter-beat notes at beat offsets 0, 1, 2 and 3: pitches 60, 62,
   64 and 65. Use zero-based MIDI channel 1 for pitch 62 and channel 0 for the
   others. With the 0.25 grid, their x positions are 0, 4, 8 and 12.
2. Point both cursor clips at the test clip, pin them, and confirm each
   `getStep(channel, x, pitch).state()` is `NoteOn`.
3. In Bitwig's inspector, set the second note's pressure to 51% and velocity
   to 60%. Read `pressure()` and `velocity()` through both handles, and log
   the same fields in note-step callbacks.
4. Call `writer.getStep(0, 8, 64).setPressure(0.75)` once. Read both handles
   approximately immediately, 100 ms, 500 ms and 1500 ms later. Deselect and
   reselect that note in the inspector.
5. As a positive control, call
   `writer.getStep(0, 12, 65).setVelocity(0.5)` once and read both handles.
6. Retarget to the empty parking clip, confirm the four addresses are empty,
   then return to the test clip and confirm all four note starts. Reselect
   the pressure notes in the inspector. Both handles were observed on the
   parking clip and then back on the test clip. The driver first used
   `cursor.pointExpanded` (which selects the target slot and points the shared
   cursor track), then called `writer.selectClip(source)`. It did not sample
   between these operations, so the cause of the reader's movement was not
   isolated. This is not evidence that `selectClip` alone moves sibling
   handles or that distinct clip targets are impossible.

Expected: settled independent `pressure()` getters and observer values agree
with the inspector: 0.51 for the human edit and 0.75 for the API edit.

Actual:

| Observation | Writer | Separate reader | Inspector |
|---|---|---|---|
| Human pressure edit | 0 | 0 | 51% |
| Human velocity edit | 0.6 | 0.6 | 60% |
| API pressure write | 0.75 until retarget | 0 throughout | 75%, including after reselection |
| API velocity write | 0.5 | 0.5 by next sample (~120 ms) | 50% |
| Pressure after parking and returning | 0 for both pressure notes | 0 for both pressure notes | Still 51% and 75% |

The setter visibly affects the inspector. The reported defect is getter /
observer disagreement, not a claim that the setter is inert. No save/reopen,
pressure-envelope or playback-output test was performed. Is there a documented
additional condition for observing static note pressure, or is this a host API
defect?

## Local supporting material

The tested public-API core is
[PressureProbe.java](../../extension/src/main/java/com/ghostnote/extension/PressureProbe.java).
It accepts a CursorTrack and a session supplier; the surrounding project only
supplies fixture lifecycle, commands and logging. It is not presented as a
standalone installable extension. The
[driver](../../brain/src/probes/r02-pressure.ts) and
[raw records](../evidence/data/r02-pressure/live-01/) make the tested sequence
reproducible in this checkout. The
[compact summary](../evidence/data/r02-pressure/summary.json) retains all four
sample sets and controls. The
[inspector transcription](../evidence/data/r02-pressure/observations.json)
is separate from API data; original images are in the conversation.

For filing, the report body and relevant source excerpt suffice to describe
the defect. Full raw logs also contain unrelated project inventory and local
paths; they are local evidence, not a prepared public attachment. The agent has not uploaded an attachment.
