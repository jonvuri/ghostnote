# Pressure getter reproduction

One standalone Controller API 25 script, one Launcher clip, one note.
The user confirmed filing upstream with this repro on 2026-11-07. The
minimal-run console output was not supplied; the recorded earlier R02
measurements used note observers. See the
[closeout](../../../context/work/r02-pressure-reproduction.md#closeout--2026-11-07).

## Run

1. Put [PressureGetter.control.js](PressureGetter.control.js) in Bitwig's
   `Controller Scripts` folder and load **Repro → Pressure Getter**.
2. Create one Launcher clip containing one note: MIDI pitch **60** (C3 with
   Bitwig's default octave naming), channel **1**, starting at the clip's
   beginning. Set its inspector **Velocity to 60%** and **Pressure to 51%**.
   Select this Launcher clip.
3. Click **Read** in the controller's **Pressure → Read note** setting.
   Read the printed line in Bitwig's controller script console.

Expected: `state=NoteOn, velocity=0.6, pressure=0.51` (allow ordinary decimal
rounding). If state and velocity match but pressure is `0`, the discrepancy
is reproduced. If state or velocity does not match, this run has not yet
established that the getter sees the intended note.

The script creates one selection-following Launcher clip handle and reads
three fields on demand. It registers no note observer. `addSignalObserver`
is only the Read button's callback. There are no note writes, cursor-track
objects, pinning, retargeting, delays, polling, or grid changes. At the first
step, the grid's step size does not affect the note address.

This script is independent of Ghostnote and has no bridge handshake or build
dependency. Loading the controller and its `Pressure Getter 1.0` output identify
this version. The script sends nothing externally.
