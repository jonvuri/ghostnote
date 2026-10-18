---
title: Open source candidates for Ghostnote capabilities
kind: note
state: active
updated: 2026-10-17
---

# Open source candidates for Ghostnote capabilities

The best immediate source is **bwpreset's object codec**. It passed a direct
check on Ghostnote's 24 preset files. Its definition reader, Grid authoring,
and routing extensions are promising but need different acceptance gates.
openwig supplies a more substantial Arranger/automation route than the first
overlap report identified. Its host and platform dependencies make it a larger
project.

This report is a candidate backlog, not a change to the active implementation
plan. It follows the [40-row source audit](OVERLAP_CAPABILITY_AUDIT.md).
The [source record](OVERLAP_AUDIT_SOURCES.md) contains pinned revisions and
reproduction steps. Previous scope exclusions do not apply to candidate
selection. Chord, rhythm, bassline, and other musical generation remain with
the driving agent.

## Ranked candidates

Effort describes integration into Ghostnote's contract, not the size of the
borrowed function. **Small** means a bounded extension to an existing path.
**Medium** means a new representation or workflow. **Large** means host
reflection, new target identity, or a new live content model. These are
estimates from source inspection, not measured schedules.

| Rank | Candidate session | Source | Confidence and effort | Recommendation |
| --- | --- | --- | --- | --- |
| 1 | O1 Recursive preset parser and serializer comparison | bwpreset `codec.py` | High offline transfer confidence; medium port | Start here. Keep the existing editor until edit equivalence is proved. |
| 2 | O2 Computed footprints and sampled-donor gate | bwpreset reader/object graph | Six measured counts agree; small to medium after O1 | Test counts in context, then revisit one refusal at a time. |
| 3 | O3 Route enabled state and modes | bwpreset `make_routing` | Implemented and tested offline; small to medium | Enabled first, then the seven modes. |
| 4 | O4 Cue-marker tools | Control Deck; Gig Maestro | Concrete public-API paths; small | Likely one of the lowest-cost new live features. |
| 5 | O5 Track sends | Gig Maestro; DrivenByMoss | Concrete public-API paths; small to medium | Extend the existing mixer contract. |
| 6 | O6 Sample search and explicit file insertion | acidcat; Control Deck | Developed index and insertion paths; medium | Split offline discovery from live insertion. |
| 7 | O7 App definitions and donor-free modulators | bwpreset `encoding.py`, `definitions.py` | Strong design; extractor fails locally; medium | Resolve host-version compatibility before expanding the catalog. |
| 8 | O8 Offline Grid authoring and remote pages | bwpreset builder, slots, assets | Extensive source/tests; partial upstream live proof; medium to large | Viable new capability, not excluded by prior scope. |
| 9 | O9 Descriptor-backed units and routing scale sources | bwpreset units and ownership checks | Useful mappings; medium | Restrict each exposed unit to an authoritative descriptor. |
| 10 | O10 Expose capture and analysis | Existing Ghostnote components; acidcat for optional analysis | Ghostnote has historical live proof; medium product work | Prefer existing capture over a foreign loopback implementation. |
| 11 | O11 Offline `.bwclip` import | acidcat extraction, bwpreset grammar | Heuristic source; medium proof effort | Use the field clues, not unchecked scan results. |
| 12 | O12 Descriptor reflection, Arranger, and automation | openwig | Substantial implementation; large integration | Start with read-only identity and schema evidence. |
| 13 | O13 Curve, wavetable, sample-player, and binding state | bwpreset assets/state/curves/bindings | Broad offline coverage; large live matrix | Follow O7/O8; split by payload family. |

## O1 Recursive preset parser and serializer comparison

**Gap:** `bwmod` cannot recursively interpret all current object forms. Its
signature-based edits require format-specific bounds and manually measured
footprints. **Source:** bwpreset `Reader`, `read_value`, `read_nested`,
`resolve_refs`, `Writer`, and `serialize`. [BP-codec]

**Evidence now:** All 23 vendored fixtures and the Instrument Layer seed parse
and serialize byte for byte. The set includes multisample Sampler, four-chain
Instrument Layer, the modulator zoo, and Zebra3 CLAP/VST3 attachments. All
46 detached donor objects consume their full byte range. This already closes
the original report's proposed grammar check for this checked file set.
It does not close a wider installed-library corpus gate. [Checks]

**Proposed session:** Port the grammar to TypeScript or use the Python codec as
an independent offline oracle first. Preserve object identity, unknown fields
with known encodings, metadata padding, string encodings, and attachments.
Bound input length, collection counts, object count, recursion, and references.
The upstream codec is not a ready-made hostile-input boundary.

**Acceptance:** Reproduce the 24 exact no-op round trips and all 46 donor parses.
Compare actual add/delete/replace/retarget results with Ghostnote's golden and
Python-oracle cases. Cover shared/cyclic references, bad indices, unknown
tags, truncation, and attachment offsets. Keep the existing live edit path
until the changed files pass selected live reload/save/reload cases.

## O2 Computed footprints and sampled-donor gate

**Gap:** Unknown footprints block otherwise useful sampled-preset edits.
**Source:** Count serialized object definitions while parsing a donor subtree,
or let a complete graph serializer regenerate reference indices. Counting
objects reachable from a detached subtree is not always the same as counting
new objects at an insertion boundary. External and shared references matter.
[BP-codec] [GN-stubs]

**Evidence now:** Counts match every non-null manifest footprint:
`lfo-sampler=16`, `random-sampler=13`, `random-poly=11`,
`classiclfo-poly=12`, `vibrato-poly=15`, and `classic-lfo-zoo=14`.
The old `expressions-poly` count is 8. E69's 10–57 bracket did not test it.
[Checks] [E69]

**Acceptance:** All known counts agree in the complete preset context. Every
multisample reference still points to the same intended object after add,
delete, and replacement. Test Expressions with delta 8 in an owned live
fixture, including save/reload and a relevant behavior witness. Do not remove
E96 refusals caused by missing pages, duplicate page families, trigger needs,
or external payloads merely because a count is available. [E96]

## O3 Route enabled state and modes

**Gap:** Ghostnote does not expose named editing of these route fields.
**Source:** `make_routing`, the constants in `model.py`, and core completion
tests. The seven mode values are not a contiguous range. [BP-route] [BP-model]
[BP-tests]

**Proposed session:** Add a boolean enabled edit first. Then add explicit mode
names. Preserve unrelated descriptors, targets, amounts, and instance identity.
Avoid editing a guessed byte occurrence when several routes exist.

**Acceptance:** Offline only the intended fields change. Live UI and sounding
behavior agree for enabled/disabled and each admitted mode, both top-level and
container-targeted. A wrong route or unsupported mode refuses before write.
Every accepted edit retains the normal checkpoint and guarded reversal. Update
the tool descriptions and description version in that implementation session.
Scale source follows O9 because it introduces another owned reference.

## O4 Cue-marker tools

**Gap:** No default named Ghostnote cue-marker tool.
**Sources:** Control Deck's `handleCueMarkers` tracks insertions by fingerprints,
sets name/position/color, verifies the set, and restores transport position.
Gig Maestro has explicit list/add/rename/position/duplicate/delete handlers.
This is a stronger small-feature candidate than accelerated Arranger recording.
[CD-cues] [GM-arranger]

**Acceptance:** List, add, rename, and reposition markers on an owned fixture.
Handle duplicate names, identical positions, bank overflow, insertion sorting,
and a person's concurrent marker edit. Never use name alone as identity.
Restore transport/selection or report the exact residual effect. Reversal must
check that the marker has not changed. Add deletion only with its own directed
permission and fidelity contract.

**Cost to establish:** Measure current marker-bank acquisition, mutation, and
verification turns against the roughly 24 ms host-turn baseline. Do not import
fixed sleeps as the final settlement model. [Ledger]

## O5 Track sends

**Gap:** The default mixer tool covers volume, pan, mute, and solo; it does not
give the complete send-level/mode/enabled workflow. **Sources:** Gig Maestro's
`SendHandler` and DrivenByMoss parameter abstractions. [GM-sends] [MOSS-layer]

**Acceptance:** Discover send identity and target; state normalized versus
physical units; read and set level, enabled state, and pre/post mode where
supported. Refuse stale send order or unavailable targets. Test two sends to
similarly named tracks, automation interaction, and guarded reversal. Follow
the measured Ghostnote raw-volume law only where it actually applies; a send
can need its own domain proof. [E257]

This is likely a smaller integration than a new document type. It still needs
observer-budget and largest-bank measurements before expanding the normal rig.

## O6 Sample search and explicit file insertion

**Gap:** Convenient indexed sample/preset discovery and explicit sample loading
are broader in the other tools. **Sources:** acidcat's library registry,
metadata search, feature indexing, and similarity queries; Control Deck's
sample-browser and `insert_sample_file` handlers. [AC-mcp] [AC-analysis]
[CD-insert]

**Proposed sessions:** First expose a bounded read-only search adapter. Then
add explicit file-to-Sampler or file-to-audio-slot insertion, as separate
operations. Existing preset-path loading is not the same capability.

**Acceptance:** Search returns canonical paths and availability without
scanning an entire library on every call. Insertion checks source identity,
destination occupancy, actual inserted device/clip, and sample identity.
Changed files and duplicate names must not silently select another asset.
State any inability to verify the resolved audio bytes. Capture the effect and
its reversal before later verification can fail. Test WAV, AIFF, and FLAC
separately before advertising them.

**Borrowing choice:** A separate acidcat process or optional adapter can avoid
porting its whole index. The metadata writer is excluded from this reuse
recommendation because its offset failure was reproduced. [AC-write] [Checks]

## O7 App definitions and donor-free modulators

**Gap:** Donor assets constrain new types and special payloads.
**Source:** bwpreset's offline key reader, definition decoder, schema
discovery, and template builder. [BP-key] [BP-defs] [BP-schema]

**Present blocker:** The hardcoded `sYG.class` entry is absent in this installed
jar. Changing only a method name is not yet a verified fix. Discover the
correct class/method or use a tested version map. Keep extracted keys and
vendor definitions local.

**Acceptance:** Identify the exact host build, decode its shipped definitions,
compare known type IDs/names/defaults with the existing donor catalog, and make
one modulator without a saved donor. Prove exact instance/page identity,
target mapping, behavior, save/reload, and removal. Then widen the catalog by
trigger family. E96 shows why a file that loads is not sufficient proof for
every modulator type. [E96]

## O8 Offline Grid authoring and remote pages

**Gap:** Ghostnote has no general Grid builder or named offline remote-page
authoring feature. **Source:** bwpreset's `Patch`, typed ports, fragments,
slot insertion, and `page`/`remote` builders. Its core tests cover reference
ownership and edits after import. [BP-build] [BP-slots] [BP-tests]

**Proposed session:** A deterministic Poly Grid graph input that emits a preset
and reports its dependencies. The agent supplies notes, modules, cables, and
values. The tool validates and serializes them. This does not add built-in
musical generation.

**Acceptance:** Prove module/port names, cable targets, parameter values,
remote-page targets, audible output, save/reload, and a guarded live load.
Handle deleting or reindexing a module without leaving stale cable, remote,
or modulation paths. Keep FX Grid, Note Grid, feedback, and per-voice support
as separate gates: upstream lists those live checks as pending. [BP-live]

**Integration choice:** A Python subprocess is a useful first proof and adds
a runtime dependency. A TypeScript port gives one runtime but requires a
larger maintenance commitment. Select after O1 and O7; do not infer low effort
from the small public `Patch.add` API.

## O9 Descriptor-backed units and routing scale sources

**Gap:** General physical-unit writes and scale-source editing are absent.
**Source:** bwpreset `units.py`, descriptor selection, normalized depth
validation, foreign-port rejection, and reference rewriting. [BP-units]
[BP-route] [BP-tests]

**Acceptance for units:** Each supported parameter has an authoritative
descriptor and explicit timebase. Test forward and inverse conversion at
boundaries and discrete choices. A synced rate must state meter/timebase.
Compare with the actual host display and value on each admitted device.
Preset-native units do not establish the inverse of every live DirectParameter
normalized value. Preserve E98's refusal for all other parameters. [E98]

**Acceptance for scale sources:** Identify the source output and owner, reject
foreign/deleted sources, remap paths after import/reindex, and prove live scale
behavior and reversal. Do not copy only the `0x2d2c` string setter.

## O10 Capture and analysis as tools

**Gap:** The components exist, but users cannot call them through the default
profile. **Primary source:** Ghostnote's `audio-capture`, `audio-facts`, live
adapter, and E124/E125 probes. **Optional source:** acidcat's feature extractors
and search. [GN-audio] [E124] [E125] [AC-analysis]

**Acceptance:** Register separate capture and analysis contracts; keep recorder
ownership, saved-project association, stable-file checks, artifact hash, and
failure cleanup. Explicitly state master scope and lead/tail uncertainty.
Verify missing providers, an already-active recorder, a changed source file,
silent output, and cancellation. Retain a successful capture if analysis fails.
Update normal/probe exposure and description artifacts as required.

openwig's Windows loopback capture is an alternative implementation reference,
not an obvious upgrade for this macOS application recorder. No inspected source
establishes an easy stem-separation or audio-to-MIDI port. [OW-render]

## O11 Offline bwclip import

**Gap:** Direct file import of `.bwclip` notes and useful metadata.
**Sources:** acidcat's field clues and conversion path; bwpreset's recursive
grammar as a possible structural reader. [AC-format] [AC-convert] [BP-codec]

**Acceptance:** Build a file corpus with multiple channels, loop offsets,
nondefault expression, empty/audio clips, long notes, and embedded content.
Compare extracted notes with a live Ghostnote read. Preserve or declare loss
for every unsupported field. Reject ambiguous signature matches. Use the
existing MIDI/document normalization and output contracts rather than inventing
a second timing system. A heuristic reader is a research aid, not evidence
that all `.bwclip` files can be imported exactly.

## O12 Descriptor reflection, Arranger, and automation

**Gap:** Arranger content and automation exceed the current default surface.
**Source:** openwig's descriptor walker, structural resolver, command discovery,
document-thread operations, note reader, and automation insertion. [OW-bridge]
[OW-notes] [OW-tests]

**Proposed sequence:**

1. A read-only descriptor probe on a known scratch object, with explicit
   truncation and identity checks. Confirm whether property names are available
   in addition to numeric IDs and class names.
2. Exact Arranger note/clip reads, with complete coverage and stable identity.
3. One deterministic note-clip insertion, then audio insertion.
4. One automation lane with a known parameter, then curve/hold interpolation.

**Acceptance:** A resolver must refuse an unvalidated host build. Do not accept
a matching reflection shape as sufficient authority to write. Verify exact
target, document-thread completion, resulting content, save/reload, and a
scoped recovery path. Test repeated names, reordered tracks, concurrent human
edits, timeout after partial application, and project changes. The existing
`read_project` parameter comparison can create a temporary track; an adopted
read-only API must not inherit that effect silently. [OW-project]

Control Deck's accelerated recording is a separate possible recording tool.
It is not a substitute for exact direct Arranger editing. Run it only in an
owned fixture if selected later; this audit did not invoke it. [CD-arranger]

## O13 Curves, wavetables, sample-player state, and bindings

**Gap:** A much wider range of authored preset state than target/amount edits.
**Source:** bwpreset's asset, curve, state, and binding modules. Tests cover
sample resource state, multisample zones, unknown fields, wavetable payloads,
selector kinds, and attachment collisions. [BP-assets] [BP-status]

**Acceptance:** Split by payload family. For each, verify dependency metadata,
opaque-state preservation, path resolution, live signal behavior, and
save/reload. For bindings, detect unavailable tracks/hardware instead of
silently binding another source. Upstream's pending asset/binding live checks
are part of the work, not a reason to claim the feature is complete.
[BP-live]

## Sources not recommended for a direct port

| Source or path | Reason |
| --- | --- |
| Control Deck's direct-parameter setter | It offers real ID-based control, but its coarse resolution and broad tolerance do not improve Ghostnote's current contract. |
| WigAI/bitwig_agent remote setters as “deep parameters” | They operate on remote controls, not the complete DirectParameter inventory. |
| acidcat's `edit_bitwig` metadata splicer | A length-changing edit kept the old body offset and failed the independent parser check. |
| Gig Maestro `undoAll` or openwig `undo` as change reversal | The source does not establish named-effect ownership or one-operation/one-undo equivalence. |
| Superpowers | Public downloads and release claims do not supply implementation source for a port. |
| Nitro modified DSP deployment | Parsing/decompilation is implemented; modified-image loader acceptance is still unproved upstream. |
| Generation modules | Explicitly left to the driving agent. |

## Reuse terms and delivery discipline

The checked trees declare MIT for bwpreset, Control Deck, acidcat, daw-mcp,
bitwig_agent, and Nitro tools. WigAI and Gig Maestro say MIT in their READMEs,
but no license file was found in these checkouts. openwig declares
GPL-3.0-or-later; DrivenByMoss supplies LGPLv3 terms. BitX has no identified
license file. These observations are a source inventory, not a license
compatibility determination. Resolve applicable terms before copying; a
`NOTICE` entry alone is not a universal reuse procedure.

Every selected live session needs a cost model before implementation: host
turns, cold reads, write stages, and heap for typical and maximum inputs.
Compare it with the performance ledger, update changed call budgets, and run
the matching live measurement. A convenient primitive does not justify
dropping Ghostnote's target, failure, and recovery checks. [Ledger]

Retrospective: a future overlap report should require a pinned dispatch path,
the actual verification predicate, and one limiting counterexample for every
check mark. That would have prevented the largest errors in the original
matrix. No repository instruction change is needed for this audit.

[AC-analysis]: https://github.com/hed0rah/acidcat/blob/2d0a0479bd4527b1ffcb8610b3568788198c749c/src/acidcat/core/analysis/features.py#L104
[AC-convert]: https://github.com/hed0rah/acidcat/blob/2d0a0479bd4527b1ffcb8610b3568788198c749c/src/acidcat/commands/convert.py#L1
[AC-format]: https://github.com/hed0rah/acidcat/blob/2d0a0479bd4527b1ffcb8610b3568788198c749c/src/acidcat/core/formats/bitwig.py#L208
[AC-mcp]: https://github.com/hed0rah/acidcat/blob/2d0a0479bd4527b1ffcb8610b3568788198c749c/src/acidcat/mcp_server/schema.py#L48
[AC-write]: https://github.com/hed0rah/acidcat/blob/2d0a0479bd4527b1ffcb8610b3568788198c749c/src/acidcat/core/write/edits.py#L167
[BP-assets]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/tests/test_assets.py#L42
[BP-build]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/build.py#L425
[BP-codec]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/codec.py#L66
[BP-defs]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/definitions.py#L12
[BP-key]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/encoding.py#L10
[BP-live]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/docs/verification.md#L1
[BP-model]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/model.py#L79
[BP-route]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/build.py#L342
[BP-schema]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/schema.py#L250
[BP-slots]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/slots.py#L1
[BP-status]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/docs/completion-status.md#L1
[BP-tests]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/tests/test_core_completion.py#L111
[BP-units]: https://github.com/jdormit/bwpreset/blob/202bf50c31ac551f1e5d345bab5a39c1bed32a12/bwpreset/units.py#L1
[CD-arranger]: https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L1755
[CD-cues]: https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L1088
[CD-insert]: https://github.com/remymazmanian/bitwig-control-deck/blob/45933855dcbfd1bd130beea18dd3f02bf794a838/controller/ControlDeck.control.js#L638
[Checks]: ../../context/evidence/OVERLAP_AUDIT_SOURCES.md
[E124]: experiments/e124-audio-facts-and-sensory-packets-connect-verified-files.md
[E125]: experiments/e125-audio-capture-composes-with-verified-file-analysis.md
[E257]: experiments/e257-track-mixer.md
[E69]: experiments/e69-donor-scope-and-footprints-are-complete.md
[E96]: experiments/e96-grid-generalization-and-catalog-boundary.md
[E98]: experiments/e98-parameter-units-and-semantic-writes-fail-closed.md
[GM-arranger]: https://github.com/gregrossdev/bitwig-extensions/blob/de79a747a62b50e1488cc9ef49617d129804e3ff/gig-maestro/src/main/java/dev/gregross/gig/handlers/ArrangerHandler.java#L136
[GM-sends]: https://github.com/gregrossdev/bitwig-extensions/blob/de79a747a62b50e1488cc9ef49617d129804e3ff/gig-maestro/src/main/java/dev/gregross/gig/handlers/SendHandler.java#L20
[GN-audio]: ../../brain/src/audio/index.ts
[GN-stubs]: ../../brain/src/bwmod/stubs.ts
[Ledger]: ../../context/contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md
[MOSS-layer]: https://github.com/git-moss/DrivenByMoss/blob/836117be7c17318a0f93cb414e333516a91a5436/src/main/java/de/mossgrabers/bitwig/framework/daw/data/LayerImpl.java#L1
[OW-bridge]: https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/src/openwig/controller/openwig_bridge.control.js#L490
[OW-notes]: https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/src/openwig/read/notes.py#L1
[OW-project]: https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/src/openwig/read/project.py#L66
[OW-render]: https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/src/openwig/wire/render.py#L1
[OW-tests]: https://github.com/Axyom/openwig/blob/d9ffed4cd3ea7ad7f2f94dee5992545e8e54db2d/tests/test_autoadapt_live.py#L1
