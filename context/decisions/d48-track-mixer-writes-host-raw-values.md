---
id: D48
kind: decision
state: active
updated: 2026-10-09
source: phase-8i7
---

# D48 — The track mixer writes host raw values **[SETTLED 2026-10-09]**

An agent asked for "pad at -18 dB and chords at -12 dB" had no public tool
and used computer control; the first edits did not land (8i7 source). The
API has no unit setter: `Parameter` gives a normalized value, a display
string, and a raw value whose range "is undefined" (E98). A dB write needs
a proved conversion, not a parse of the display text.

## Rule

1. **The unit is the host raw value.** The 8i7 gate
   ([E257](../evidence/experiments/e257-track-mixer.md)) measured the raw
   track volume on the live host: the display is `60 * log10(raw)` dB at
   all 25 points, the normalized value is `raw / 2^(1/3)`, raw 0 is silence
   (-Inf dB), and raw `2^(1/3)` is the maximum (+6.02 dB). `setRaw` stores
   the requested double exactly in one turn; a plain `set` does not land
   (E16). The raw pan is -1 to 1. The contract carries raw values. The
   brain converts dB in one module (`contract/mixer.ts`); the display text
   is reported beside the value as a host check and is never parsed.
2. **One durable address for each field.** A mixer address is a track
   channelId and one field (volume, pan, mute, solo). A later edit of one
   field blocks the reversal of that field only; the other fields of the
   same change are restored. A change owns a field only when its readback
   holds the requested value: a refused setter owns nothing.
3. **Automation refuses.** Automation playback owns an automated field, so
   a write there does not stay. The tool refuses a requested volume or pan
   field that has automation before any write. The extension checks the
   automation flag again at execution, beside the channelId check, before
   the first setter. The write reuses the tool's prior read as its stash,
   so every mixer batch also carries the scene guard of that read
   (generation, project, scene epoch).
4. **Narrow scope.** Volume, pan, mute, and nonexclusive solo on
   Instrument, Audio, Hybrid, Effect, and Group tracks, including a child of
   a collapsed group. The Master track refuses. No sends, routing, meters,
   automation authoring, or exclusive solo. At most 8 tracks in one call.

## Consequences

- `read_track_mixer` and `set_track_mixer` (descriptions v43) read and set
  exact dB values: -18 dB reads back as raw `10^(-18/60)` and shows
  -18.0 dB.
- The normal profile subscribes 7 values for each track (1,792 at the
  256-track window). The write and its reversal are one stage; the
  costs are in the performance ledger.
- A request at the display precision (0.1 dB) is exact in the host; a
  read reports dB to 0.0001.
