---
title: Media and analysis inputs
kind: note
state: active
updated: 2026-10-24
---

# Media and analysis inputs

User outcomes include finding a sound, placing a sample, capturing a result,
measuring audio, and locating a useful musical passage. These needs do not
all require live host access.

## Current boundary

The normal tools load explicit presets and convert MIDI files. They do not
expose indexed sample search, audio capture, audio analysis, or a general
musical-navigation provider. The repository does contain separate capture,
analysis, and musical-context components.

[E125](../../../evidence/experiments/e125-audio-capture-composes-with-verified-file-analysis.md)
captured a guarded Launcher loop through Bitwig MasterRecorder on 6.0.6.
The output is the project master, not an isolated track stem. The historical
scope is 2–32 beats from beat zero on a quarter-beat observation grid.
Capture lead and tail are reported; sample-exact musical alignment is unproved.

[E124](../../../evidence/experiments/e124-audio-facts-and-sensory-packets-connect-verified-files.md)
analyzes verified files without a Bitwig connection. Its proved input is
stereo 24-bit PCM WAVE at 44.1 kHz, at most 16 MiB, with a selected range
of 0.05–60 seconds. It measures integrated loudness, spectral rolloff, crest,
and silence. Source bytes, range, and channels are part of the result.
Those historical format and provider limits are not general audio support.

## Work records

| ID | Capability | Status | Qualifier | Cells | Source route | Required proof or decision |
|---|---|---|---|---|---|---|
| MA-1 | Indexed sample and preset discovery | Candidate | — | `library.search` read | acidcat library registry, search, metadata, and similarity | Bounded search, canonical path, freshness, file identity, and missing-file reports. Avoid a full library scan on every call. Decide optional service versus local integration. |
| MA-2 | Explicit sample insertion into Sampler or an audio slot | Candidate | — | `sample.insertion` create | Control Deck insert_sample_file (handleInsertSampleFile); existing device guards | Separate destinations. Check occupancy, source bytes, inserted device or clip, and sample identity. Test WAV, AIFF, and FLAC independently. Record effects before later verification can fail. |
| MA-3 | Normal capture tool | Component | historical live proof on 6.0.6; project master only | `audio.capture` create | Ghostnote audio-capture module and E125 | Preserve recorder ownership, saved-project association, stable output identity, cleanup, cancellation, and scope. Prove the selected path on the current host. |
| MA-4 | Normal audio-facts tool | Component | offline provider proof | `audio.facts` read | Ghostnote audio-facts module and E124 | Preserve byte, range, and channel identity and provider failure isolation. Decide whether to retain or expand input formats. Analysis failure must not discard a successful capture. |
| MA-5 | Optional sample features, BPM/key, and similarity analysis | Candidate | — | `audio.features` read | acidcat analysis | Compare precise outputs, units, uncertainty, and provider cost. These features do not replace the existing loudness, crest, and silence contract. |
| MA-6 | Harmonic, rhythmic, repeated-section, and arrangement navigation | Planned | 8i17 survey; no provider selected | `musical.navigation` read | 8i17; Music21, Partitura, midi-miner, jSymbolic, musif, Tonal leads | Freeze real passage-finding tasks. Compare full notes, simple summaries, and musical analysis. Measure accuracy, ambiguity, tokens, calls, latency, and recovery. |
| MA-7 | Stem separation and audio-to-MIDI transcription | Unresolved | no audited implementation donor in the pinned set | `audio.transform` create | None audited; Superpowers release claims only | A separate provider survey is needed if selected. These are analysis and transformation tasks, not automatically excluded as musical generation. |
| MA-8 | Documentation and reference retrieval | Candidate | deferred provider candidate | `docs.retrieval` read | Workstation interface audit and Phase 10 | Exact-version sources, verified cache, provider isolation, and a demonstrated task need. Keep it separate from the normal host runtime. |

Status, qualifier, and cell values come from [`data/records.json`](data/records.json); `data/check_records.py` verifies that this table agrees with it. IDs are navigation keys, not priorities. External implementations on these rows, with pinned paths, predicates, and counterexamples, are in the [external register](external-register.md#media-and-analysis).

## Direct source locations

- Ghostnote [audio modules](../../../../brain/src/audio/) and
  [workstation contracts](../../../evidence/format/WORKSTATION_CONTRACTS.md)
  define existing module inputs, effects, and isolation.
- acidcat [MCP schema](../../../../reference/acidcat/src/acidcat/mcp_server/schema.py),
  [handlers](../../../../reference/acidcat/src/acidcat/mcp_server/handlers.py), and
  [feature analysis](../../../../reference/acidcat/src/acidcat/core/analysis/features.py)
  register and implement sample search/analysis. Inspect indexing and invalidation
  before choosing an adapter.
- Control Deck [controller](../../../../reference/bitwig-control-deck/controller/ControlDeck.control.js):
  `insert_sample_file` dispatches `handleInsertSampleFile`. Explicit sample
  insertion is distinct from loading a `.bwpreset` path.
- openwig [render module](../../../../reference/openwig/src/openwig/wire/render.py)
  uses Windows loopback. It is not an established improvement over the macOS
  application recorder.
- [8i17](../../phase-8/8i17-midi-musical-navigation-survey.md) contains the
  navigation task design and provider history. [E110](../../../evidence/experiments/e110-wider-symbolic-provider-survey-selects-music21-and-musicpy.md)
  has narrow executed theory tests; [E112](../../../evidence/experiments/e112-independent-survey-adds-probe-psychoacoustic-and-symbolic-perceptual-routes.md)
  supplies further leads. Neither proves whole-song passage finding.
- [Interface audit](../../../evidence/format/AGENT_NATIVE_INTERFACE_AUDIT.md)
  and [workstation inventory](../../../evidence/format/WORKSTATION_INTERFACES.md)
  record optional documentation and analysis boundaries.

## Planning inputs

MA-1 can start read-only. MA-2 needs live insertion proof. MA-3 and MA-4 can
be exposed separately because their artifact hash links them. MA-6 already
has a plan; do not create a competing generic-summary project.

The later user discussion should distinguish finding assets, measuring a
rendered result, understanding a reference, and extracting reusable musical
material. A generic audio-analysis checkbox hides these different outcomes.
