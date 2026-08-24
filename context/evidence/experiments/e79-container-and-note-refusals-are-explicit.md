---
id: E79
kind: evidence
state: active
source: dogfooding-d02-session-4
---

# E79 — Container and note refusals are explicit [K] (2026-08-23)

**Verdict: the public surface now names each container kind and its MIDI-routing
semantics. An off-grid note write names note timing as the cause and gives the
1/64-beat writable grid floor.**

## Container semantics

`compose_device_structure` now states that it creates an Instrument Layer. Its
entries run in parallel and receive the same MIDI input. It does not create Drum
Machine pads or route MIDI notes to separate entries.

Instrument `create_device_alternates` also creates an Instrument Layer, not an
Instrument Selector. Exclusive solo auditions one entry. It does not map MIDI
notes. Effect alternates create an FX Layer.

`compose_drum_machine` states that it provides per-MIDI-note routing. MIDI notes
36 through 51 map to pad channels 0 through 15. One note reaches one separate
pad device.

Successful structure results include the observed `containerKind` and a direct
`routing` statement. Drum Machine results keep the exact MIDI-note, pad-channel,
and nested-device witnesses.

## Note refusal

Note-grid validation now runs in the shared contract before either adapter. A
note start or duration that does not fit a supported grid returns a structured
timing refusal. The public result states that note timing caused the refusal,
names `startBeats` and `durationBeats`, and gives 0.015625 beat (1/64 beat) as the
finest supported grid. No adapter write starts.

## Exposure and verification

The registered stdio MCP server returned 46 tools. The three container
descriptions retained their distinct execution and routing statements on the
wire.

Fresh Codex session `01a03121-6f22-7461-b357-18053b3d272a` used capability
discovery only. It reported all 46 Ghostnote tools and correctly distinguished
the three container tools from their descriptions. Its event stream contains no
Ghostnote operation, shell, file, or Bitwig call. No Bitwig content changed.

The focused surface, composition, cohort, and encoder tests pass 156/156. The
full brain check passes 859/859. Type-checking and `git diff --check` pass.

## Retrospective

Allow built-in capability discovery in an exposure-only prompt. A prompt that
forbids all discovery cannot see a deferred tool catalog.
