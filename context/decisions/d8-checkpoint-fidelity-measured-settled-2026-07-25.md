---
id: D8
kind: decision
state: active
updated: 2026-10-05
source: DECISIONS.md
---

# D8 — Checkpoint fidelity, measured **[SETTLED 2026-07-25, AMENDED 2026-08-22]**

Replaces the ◐/guess columns of INITIAL_PROMPT §4/§5/§6. **A take stores what
readback REPORTED, never what was requested** (D5).

| object | fidelity | evidence |
|---|---|---|
| clip notes — identity (start, pitch, velocity, duration) | **exact when the writable grid represents the captured timing** | E2 and E46; `setStep`→`getStep` round-trips, and the floor refuses other captured timing |
| note properties, 20 of 21 | **exact** | E15-E and E24; apply, independent read, and revert |
| note `gain` | **exact** — write requested / 2 | E24; nine-value curve, repeated independent reads, and revert |
| note `pressure` | **UNWRITABLE — refused** | E15-E |
| scalar device params and enabled state | **exact after independent readback** | E4/E4b and E59 |
| agent-inserted device removal | **exact under the last accepted complete name-and-enabled chain** | E59; managed reversal uses the current observed owned position |
| existing-device delete | **none** | E3 and E59; opaque state cannot be recreated |
| launcher-clip metadata | **exact**; a written colour within one byte for each component (D42) | E43 and E249; independent reads of name, colour, play start, and loop fields |
| launcher-clip delete/recreate | **lossy** | E43; exact metadata, launch settings and notes restore; play stop and automation do not |
| track / scene create-delete | **low / none** | E3 — no readback that could recreate them |
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

E59 qualifies the generic inserted-device inverse. A minted position is exact
only until a later structure edit changes positions. The managed workflow keeps
mint provenance for ownership and derives the current address from each last
accepted complete name-and-enabled chain. It deletes owned devices from the
highest current position to the lowest. This is exact under that observable
boundary. It is not device identity. An existing-device delete remains `none`.

## Phase 8f3 normalized boundary amendment — 2026-10-01

The [Document 1.0 binding](../../spec/ghostnote-document-v1/HOST-BINDING.md) exposes
normalized D23 notes to the model. Complete means complete under the acquired
cell contract and stated field coverage. It does not mean source-lossless
below `1/512`, complete automation, or exact replay of the prior clip.

Exact checkpoint protection keeps the measured writable-grid and property
fidelity rules above. Unknown fields cannot become default values in a stash.
Pressure remains unwritable. A whole-clip replacement needs complete prior
state and the existing fidelity floor. A normalized cache alone cannot supply
that proof. [E128](../evidence/experiments/e128-targeted-note-inverse-is-live.md)
provides the narrower owned insertion/removal inverse without replay of
unrelated notes. D16 defines its boundary and concurrent-change refusal.

8g is shadow-only. 8h can promote cache evidence for eligible preflight or
preparation only after the [cache contract](../contracts/GHOSTNOTE_CACHE_CONTRACT.md)
and live verification gates pass. This amendment does not reduce recorded
reversal fidelity or change the current low-level encoder.

## Phase 8h3c cell boundary amendment — 2026-10-05

[D31](d31-mutation-and-reversal-use-the-d23-cell-boundary.md) adopts D23
for mutation and reversal. Checkpoints store the reported `1/512` cell start.
Reconstruction and reversal restore that start. Fidelity excludes the prior
sub-cell onset and same-cell source multiplicity. The onset can move down by
less than `1/512` beat. Durations and properties keep their measured fidelity
limits. A cell start can combine with a duration from another D9 lattice.
Unsupported durations still refuse before reconstruction.

The 8f3 amendment above describes the prior E131 implementation. Product
preflight now uses the complete cold reader, inside this stated cell boundary.
The raw disabled-control preservation gate still applies.

## 8h implemented surface — 2026-10-08 (8h4g closeout, E247)

`agent-native-v1` (the default profile, D40) implements this decision with
the 8f3 and 8h3c amendments:

- `edit_launcher_clip` protects the affected owned cells on the targeted
  route (E128) and all 16 channels on the whole-clip route and for a clip
  property change. `add_launcher_clip` records the creation and the content
  as two changes.
- Each durable write result names its fidelity. `check_revert` reports what
  a reversal restores and what it does not, before a write.
- Checkpoints store the reported `1/512` cell start (D31). Bitwig reports
  note pressure as 0, so a whole-clip replay loses human pressure and the
  result names it in a warning (D37).

The 8h4g performance work changed no stash, fidelity rule, or protection
boundary.
