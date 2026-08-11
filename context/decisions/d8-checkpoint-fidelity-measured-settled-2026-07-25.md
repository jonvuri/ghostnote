---
id: D8
kind: decision
state: active
source: DECISIONS.md
---

# D8 — Checkpoint fidelity, measured **[SETTLED 2026-07-25]**

Replaces the ◐/guess columns of INITIAL_PROMPT §4/§5/§6. **A take stores what
readback REPORTED, never what was requested** (D5).

| object | fidelity | evidence |
|---|---|---|
| clip notes — identity (start, pitch, velocity, duration) | **exact** | E2, and `setStep`→`getStep` round-trips |
| note expression, 16 of 18 properties | **exact** | E15-E swept them one at a time |
| note `gain` | **lossy** — reads back 2× written | E2; the inverse is unverified, so it is labelled, never corrected |
| note `pressure` | **UNWRITABLE — refused** | E15-E |
| scalar device params | exact | E4/E4b |
| clip / track / scene / device create-delete | **low / none** | E3 — no readback that could recreate them |
| anything via a named action | **none** | E6 — and banned outright (D13) |

⚠ **Two traps make readback ≠ request even for notes.** Consecutive same-pitch
notes truncate each other, so a written duration may not survive (E8-E). And a
note's properties cannot ride the request that creates it — they are silently
discarded (E15-B).
