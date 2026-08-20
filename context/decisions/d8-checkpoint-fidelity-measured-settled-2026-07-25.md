---
id: D8
kind: decision
state: active
source: DECISIONS.md
---

# D8 — Checkpoint fidelity, measured **[SETTLED 2026-07-25, AMENDED 2026-08-19]**

Replaces the ◐/guess columns of INITIAL_PROMPT §4/§5/§6. **A take stores what
readback REPORTED, never what was requested** (D5).

| object | fidelity | evidence |
|---|---|---|
| clip notes — identity (start, pitch, velocity, duration) | **exact when the writable grid represents the captured timing** | E2 and E46; `setStep`→`getStep` round-trips, and the floor refuses other captured timing |
| note properties, 20 of 21 | **exact** | E15-E and E24; apply, independent read, and revert |
| note `gain` | **exact** — write requested / 2 | E24; nine-value curve, repeated independent reads, and revert |
| note `pressure` | **UNWRITABLE — refused** | E15-E |
| scalar device params | exact | E4/E4b |
| launcher-clip metadata | **exact** | E43; independent reads of name, colour, play start, and loop fields |
| launcher-clip delete/recreate | **lossy** | E43; exact metadata, launch settings and notes restore; play stop and automation do not |
| track / scene / device create-delete | **low / none** | E3 — no readback that could recreate them |
| anything via a named action | **none** | E6 — and banned outright (D13) |

⚠ **Two traps make readback ≠ request even for notes.** Consecutive same-pitch
notes truncate each other, so a written duration may not survive (E8-E). And a
note's properties cannot ride the request that creates it — they are silently
discarded (E15-B).

E24 retires the former lossy gain label. Bitwig still reports twice the setter
input. The shared property encoder applies the measured inverse once. Snapshots
store the corrected readback and replays restore it exactly.

E43 retires the former loss for shipped launcher-clip metadata. A clip reversal
restores exact metadata, launch settings, and all note channels. The recreated
clip remains `lossy` because the play-stop setter is inert and automation lanes
have no complete readback.

E46 qualifies the note-identity row. Host readback can return a duration that no
writable grid represents. Such a captured state is lossy and now fails the
fidelity floor before mutation. A successful write therefore does not promise a
reversal that its encoder cannot perform.
