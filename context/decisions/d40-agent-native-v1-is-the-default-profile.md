---
id: D40
kind: decision
state: active
updated: 2026-10-08
source: phase-8h4f
---

# D40 — `agent-native-v1` is the default profile, with one result vocabulary **[SETTLED 2026-10-08]**

8h4b–8h4e built `agent-native-v1` beside the frozen `stable-v1`. 8h4f
(E239) moves the remaining retained tools onto the shared result module,
proves the track kinds that the track tool names state, and measures the
representative workflows on both profiles.

## Rule

- The server registers `agent-native-v1` when `GHOSTNOTE_TOOL_PROFILE` is not
  set (`DEFAULT_TOOL_PROFILE`). `stable-v1` stays selectable, unchanged, as
  the rollback through 8i. Its tools, registration hash, and server
  instructions are frozen. The removal of `stable-v1` is after 8i.
- Each `agent-native-v1` result has `schema`. A read uses the read envelope,
  and a write uses the write envelope with one effect for each recorded
  change. A failure uses the failure envelope with a stable `failure.code`;
  agents do not parse text.
- Six tools keep the result body that a session measured: the device control
  read and write (E126, 8h4e), the preset modulation read and edit, and the
  existing-device modulation wrap and its reversal. They add `schema` and, on
  a refusal, a standing that is not stable, or a partial write, the shared
  `failure` object. Their bodies stay until a measurement shows that an
  envelope adds no cost to the E126 result.
- Track tools name only proved kinds: `add_tracks` makes instrument and audio
  tracks; `duplicate_track` copies Instrument, Audio, and Hybrid tracks and
  refuses other kinds before a write (`unsupported`).
- A public input addresses a track by `trackId`, a Launcher slot by `row`, and
  a project device by `devicePosition`. The schema test over the complete list
  enforces it.

## Why

The live E45/E48-style workflow is 42 percent faster on `agent-native-v1`,
and the A/B recipe is 57 percent faster (E239). The list is 41 tools and
99,062 bytes against 53 tools and 159,738 bytes. A missing target now gives
the same code (`absent`) on every tool. A rollback profile keeps a client
that depends on the old shapes working through the dogfood.

## Consequences

- The library helpers (`callTool`, `toolsForProfile`) keep `stable-v1` as
  their default for the historical probes and the frozen stable tests. A new
  caller names its profile.
- 8h4g reviews the cost of every path. The 27-control write (14.5 s, 282 wire
  calls) is the same on both profiles and is the largest new item.
