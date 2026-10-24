---
title: Clip and arrangement inputs
kind: note
state: active
updated: 2026-10-24
---

# Clip and arrangement inputs

User outcomes include editing a musical phrase, organizing Launcher material,
importing notes, and constructing a complete song timeline.

## Current boundary

Launcher reads return Ghostnote Document 1.0 with a base reference. Edits use
a patch or desired document. References bind changes to observed state.
The surface also creates, copies, moves, deletes, launches, and changes clip
properties. It supports all 16 MIDI channels within the observed timing plane.
MIDI import and export are offline file tools.

Sources: [v53 descriptions](../../../evidence/data/phase9b-doctor/9b7-tool/descriptions-v53.json),
[host binding](../../../../spec/ghostnote-document-v1/HOST-BINDING.md),
[conversion contract](../../../contracts/MIDI_FILE_CONVERSION.md), and
[E269](../../../evidence/experiments/e269-document-file-paths.md).

Reads observe a `1/512`-beat cell plane. The reader limit is 16,384 notes,
8,192 beats, and 2,097,152 sounding cells. These are different limits.
Live writes refuse same-channel, same-pitch overlaps, even when the document
or a MIDI file can represent them. Pressure is not observable; a full rewrite
can lose pressure set by a person. Repeat and articulation have no measured
host mapping. Sparse edits and whole-clip rewrites have different costs and
preservation properties. Document file paths reduce conversation payload;
they do not add musical understanding.

## Work records

| ID | Capability | Status | Qualifier | Cells | Source route | Required proof or decision |
|---|---|---|---|---|---|---|
| CA-1 | Extend note expression and timing fidelity | Candidate | — | `clip.expression-fidelity` read, `clip.expression-fidelity` write | Existing document binding; DrivenByMoss CursorClipImpl; API evidence | Split pressure, repeat, articulation, play range, finer timing, and overlaps. Prove each host field independently. Do not promise full MPE from channel support alone. |
| CA-2 | Offline .bwclip import | Candidate | heuristic extraction only | `bwclip.file` read | acidcat extraction and conversion; bwpreset codec as a structural reader candidate | Compare multichannel, loop-offset, expression, empty, audio, and embedded-content fixtures with live reads. Reject ambiguous byte signatures and declare unsupported fields. |
| CA-3 | Exact Arranger clip and note reads | Candidate | — | `arranger.clip-notes` read | openwig descriptor bridge and note reader; Ghostnote internal-access work | Establish stable target identity, exact bounds, coverage, and missing-field reports on the current build. Start with read-only fixtures. |
| CA-4 | Direct Arranger MIDI creation and editing | Candidate | — | `arranger.clip-notes` write, `arranger.clip-notes` create | openwig _insertClip and _clipCreateAndFill | Requires CA-3-quality identity and verification. Prove insertion, content, thread completion, persistence, partial failure, and scoped recovery. |
| CA-5 | Direct Arranger audio insertion and editing | Candidate | — | `arranger.audio-clip` create, `arranger.audio-clip` write | openwig _insertAudioClip | Needs exact file identity, clip placement, source range, and saved and reloaded content. Stretch, warp, and destructive audio edits remain separate questions. |
| CA-6 | Automation read and point/curve editing | Candidate | — | `automation` read, `automation` write, `automation` create | openwig _insertAutomationPoints and graph readers | Identify the owning parameter and time domain. Prove lane coverage, curve and hold interpolation, preservation, concurrent edits, and recovery. A scalar parameter setter is not automation authoring. |
| CA-7 | Record Launcher playback into the Arranger | Candidate | — | `arranger.record` create | Control Deck active recording dispatch (handleRecordLauncherArrangement, 666 BPM) | Decide whether performance recording is wanted as its own feature. Verify the resulting clips and timing. It does not replace CA-3 through CA-6. |
| CA-8 | Launcher audio clip reads | Unresolved | no audio-clip content reader found in the pinned clones | `launcher.audio-clip` read | None found. MA-2 covers insertion of a sample into an audio slot; this record covers reading an existing audio clip's file, range, and properties. | Survey the API for audio clip properties on the current build. Decide whether file identity and range are observable at all through the controller API before planning a reader. |

Status, qualifier, and cell values come from [`data/records.json`](data/records.json); `data/check_records.py` verifies that this table agrees with it. IDs are navigation keys, not priorities. External implementations on these rows, with pinned paths, predicates, and counterexamples, are in the [external register](external-register.md#clips-and-arrangement).

## Direct source locations and counterexamples

- openwig [bridge](../../../../reference/openwig/src/openwig/controller/openwig_bridge.control.js)
  contains document-thread scheduling, descriptor reads, clip insertion, and
  automation insertion. Its [notes reader](../../../../reference/openwig/src/openwig/read/notes.py)
  interprets selected graph fields. The pinned upstream environment was
  Windows/Bitwig 6.0.6. This is source evidence, not current local live proof.
- Its [project reader](../../../../reference/openwig/src/openwig/read/project.py)
  can create a temporary baseline track for parameter comparison. A new
  read-only tool must not silently adopt that mutation.
- Control Deck [controller](../../../../reference/bitwig-control-deck/controller/ControlDeck.control.js)
  dispatches `arrange_launcher_clips` to `handleRecordLauncherArrangement`.
  It records at 666 BPM. The requested intervals and transport completion do
  not prove the final Arranger clip boundaries. An older reconstruction
  function in the same file is not the active dispatch.
- acidcat [format reader](../../../../reference/acidcat/src/acidcat/core/formats/bitwig.py)
  and [conversion command](../../../../reference/acidcat/src/acidcat/commands/convert.py)
  are field leads. Their byte searches are not a complete `.bwclip` grammar.
- DrivenByMoss [CursorClipImpl](../../../../reference/DrivenByMoss/src/main/java/de/mossgrabers/bitwig/framework/daw/CursorClipImpl.java)
  is a mature controller reference, not proof that unobservable fields can
  be recovered. Pins and terms are in [sources](sources.md).
- No pinned clone reads an existing Launcher audio clip's file, range, or
  properties (CA-8). Control Deck inserts a sample file; that is MA-2.

## Planning inputs

Exact Arranger work has a new live content model, new identities, and internal
host dependencies. It deserves a bounded research plan before product work.
The recursive preset codec can help CA-2 research, but its preset success
does not establish clip syntax or semantics.

[Phase 10](../../phase-10/README.md) contains Arranger and MPE candidates.
[8i17](../../phase-8/8i17-midi-musical-navigation-survey.md) concerns locating
musical passages; it does not implement an Arranger editor. Keep navigation,
content editing, and playback recording separate in the later report.
