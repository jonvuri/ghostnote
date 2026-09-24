---
title: Consolidated compact-bar direction
kind: design exploration
state: active
updated: 2026-09-24
scope: one normalized agent-facing clip representation for analysis, reads, and writes
evidence: E16s, E19, E24, E51-E54, E114-E116, E119-E121, E128-E133; D23
---

# Consolidated compact-bar direction

## Status

This document records the current design direction. It is not an implemented
contract. Details can change as practical host work supplies new evidence.

The main direction is selected:

- Use one compact clip representation for theory, clip reads, and clip writes.
- Normalize realized note timing to a `1/512`-beat lattice.
- Express triplet and higher-cardinality rhythmic meaning as overlays on that
  lattice. Do not use a second host-read grid to recover those divisions.
- Support both complete desired clips and sparse patches in the same musical
  language.
- Track clip identity on a best-effort basis inside the live project. Use fresh
  content guards before a write.

Do not preserve an old schema split only because the current implementation has
one. The project is still work in progress. Existing names and fingerprints are
reproducibility records, not product constraints.

## Goal

Give an agent one small musical object that it can:

1. read as the current clip;
2. analyze with theory or pattern tools;
3. return as a complete desired clip;
4. patch with local additions, removals, and changes; and
5. combine with optional harmony, role, region, articulation, and groove facts.

The agent must not need to translate between a theory notation, an exact clip
JSON object, and a separate write language for ordinary work.

Ghostnote can retain raw host observations and write records internally. These
are implementation evidence, not a second agent-facing music format.

## Normalized timing plane

Use `1/512` beat as the realized-time lattice for agent clip state. Assign an
observed onset to the `1/512` cell that the host reports. Normalize durations
to the same lattice under the selected duration rule. The interface can
document this once at a high level. Each event does not need a normalization
warning.

At 120 BPM, `1/512` beat is approximately 0.977 ms. A host view rounds an
off-grid onset down, so its displacement is less than one cell. This is the
accepted timing boundary for this interface.

Triplet, quintuplet, septuplet, swing, phase, and local timing intent do not
require separate storage grids. They are musical descriptions linked to events
on the realized lattice. For example, an overlay can say that one normalized
event realizes the second point of a triplet or carries one component of a swing
template.

This changes the agent-facing timing and acquisition requirement. D23 selects
one `1/512` host view. One acquired identity is one MIDI channel, pitch, and
cell. Different pitches and channels remain separate. Multiple same-channel
and same-pitch onsets inside one cell can collapse. This loss is accepted below
the selected resolution. Do not describe this route as source-lossless or exact
below one cell.

The current E131 reader still scans `1/512` and `1/768` and reconciles them.
That implementation remains available as a diagnostic control. Its exact
triplet differences are not failures for the normalized D23 contract.

Open timing details:

- Confirm the duration normalization rule against the host's measured
  `2^-20`-beat duration values.
- Define duration behavior for a value outside the accepted lattice rule.
- Confirm same-pitch adjacency and overlap behavior after normalization.
- Decide whether a task can request a coarser displayed rhythmic spelling while
  the underlying realized lattice stays unchanged.

## One compact clip document

The core document should contain enough state to recreate the supported clip
without a hidden agent-facing exact object. Keep uncommon fields sparse.

The likely core is:

- a logical clip reference;
- the last confirmed live address;
- a base content digest for an existing clip;
- clip length, loop, play range, name, and other writable metadata;
- complete note coverage across all MIDI channels;
- one logical event ID per note;
- normalized start, duration, pitch, velocity, and mute;
- MIDI channel and non-default performance properties only when needed; and
- an explicit coverage and writability statement.

A possible shape is:

```text
CLIP gnclip-42 BASE 9f27... LENGTH 16 LOOP 0..16
NOTE n1 AT 0 DUR 1/2 PITCH 60 VELOCITY 96
NOTE n2 AT 1/2 DUR 1/2 PITCH 64 VELOCITY 90 CH 9 PAN -0.2 TIMBRE 0.4
```

This is an illustration, not selected syntax.

Sparse fields need deterministic meanings. An absent property can mean either a
canonical default or preservation from the base. The final design must select
one meaning for each complete and patch form. It must not infer defaults from
model behavior.

Pressure remains observable but unwritable through the measured host API. The
document can retain it as read-only state. A change that requires pressure
reconstruction must refuse or preserve the live note through a targeted edit.

Played-range incompatibility also remains a host-access boundary. E129 refuses
offset stored note coordinates and asks for visible consolidation. A compact
document cannot make inaccessible coordinates writable by changing their
spelling.

## Analysis overlays

Theory and performance facts attach to the same clip and event IDs. They do not
create a second note list.

Possible overlays include:

- meter, tempo, harmony, key alternatives, and regions;
- role, layer, voice, articulation, and motif membership;
- nominal rhythmic division and phase;
- swing or groove reference and component deviations; and
- provider, confidence, provenance, and coverage.

The core event owns realized musical state. An overlay owns interpretations and
relationships. Removing an overlay must not remove or change a note.

This keeps the useful distinction from the current groove work: a realized
position does not by itself prove why the event is late or early. The difference
is that the overlay no longer needs an independent triplet acquisition grid.

## Complete clips and patches

Support two ways to express the desired result inside one language.

### Complete desired clip

A complete form states the desired final clip. For an existing clip, it names
the base clip reference and source digest. For a new clip, it has no live base.

Ghostnote compares the desired document with fresh live state and selects the
smallest reliable host operations. It does not need to clear and replay a clip
when targeted add, remove, move, or property operations are sufficient.

### Sparse patch

A patch names an earlier complete document and changes only selected events or
fields. It can add new event IDs, remove existing IDs, or revise fields on an
existing ID. Unnamed state stays unchanged.

Both forms compile through the same path:

```text
base document + agent result + fresh live state
                         -> complete desired state
                         -> guarded host difference
                         -> independent normalized readback
```

The three-way comparison must handle concurrent edits:

- Apply when live state still matches the base.
- Preserve an unrelated live change when the merge is unambiguous.
- Refuse when the agent and live project changed the same event or field.
- Reacquire when the logical clip reference cannot be resolved with confidence.

Patch behavior needs more agent trials. E114 and E121 show that small guarded
note patches fit current agent behavior and preserve unnamed fields. They do not
yet prove the consolidated full-document and patch design.

## Best-effort clip and event identity

Bitwig supplies durable track identity but no durable clip identity. A live
Ghostnote clip reference can combine:

- a session-local logical ID;
- the durable track channel ID;
- the current launcher row and scene epoch;
- the last observed project generation and content epoch; and
- the last normalized content digest.

Launcher-content observers can follow a move while Ghostnote is running. A
fresh read confirms the new address and content before mutation. After restart,
the last address and content fingerprint can help recover the reference. Two
identical candidates remain ambiguous and must not be guessed.

Event IDs are logical edit handles. They can remain stable while Ghostnote
tracks its own accepted changes. A human edit can make an event mapping
ambiguous. The next read can retain unambiguous IDs, mint new IDs, and invalidate
ambiguous patch bases.

This is sufficient for interactive work. It does not claim permanent host
identity.

## Read and write performance implications

The current local representation work is small. E119 measured approximately
4.4 ms for parse, render, and fingerprint work on 1,024 compact events. Host
acquisition dominates.

The existing public API exposes a step window. Ghostnote's extension already
returns all 16 channels in one bounded reply, but it still calls `getStep` for
each visible time, pitch, and channel cell. Current cost therefore scales mainly
with clip extent, timing resolution, grids, and page transitions. E53 found
similar workflow cost for 1, 16, and 64 basic notes.

If one `1/512` host scan proves complete, it removes the current triplet scan
and reconciliation. For a 32-beat clip with the 2,048-step reader, the known
work changes from 20 pages and two resets to eight pages and one reset.
Scheduled 144 ms settlement waits change from 3,168 ms to 1,296 ms. A four-beat
clip changes from four scheduled waits to one. These are code-derived work
counts, not new live measurements or a completeness proof.

E130 searched the complete public Controller API 25 surface, installed API
documentation, legacy helpers, and ten concrete runtime proxy families. It
found no supported direct note enumeration, serialization, clipboard,
in-memory MIDI, project-state, or playback route that returns complete live
content for one identified launcher clip. `Clip.getStep` remains the supported
source of complete note fields.

The E130 follow-up proves that `addStepDataObserver` replays sparse occupied
cells after target, grid, and page changes. The callback has no channel, note
fields, or completion signal. The selected candidate enriches each settled
`NoteOn` coordinate with targeted `getStep` calls across all 16 channels. It
can avoid empty-cell scans, but it remains page-bounded.

E131 proves that a `1/512` and `1/768` sparse union matches the exact complete
reader on short and long, sparse and dense fixtures. A single `1/512` view does
not match that exact result. Conservative settlement makes the sparse route
slower end to end:
approximately 1.65 seconds instead of 0.78 to 0.82 seconds for short fixtures,
and 2.55 seconds instead of 1.82 to 1.93 seconds for long fixtures. Keep sparse
enrichment as a probe. No cache is justified by this result.

The current experimental acquisition boundary still uses the existing complete
reader. It resolves a durable track ID and launcher row, reads all 16 channels,
normalizes timing to `1/512` ticks, detects identity collisions, and returns the
fresh exact source plus project and content guards. D23 changes the next design
and scale experiment. It does not change this implementation or the stable
profile.

E133 rejects the requested dirty-and-quiet hybrid. Each eligible candidate rule
and request pattern completed early five times in 44 shadow trials during the
same grid race. An unchanged 48 ms confirmation and a second requested quiet
flush did not identify the requested grid. The complete reader remains the
experimental acquisition authority.

The remaining reductions are cache and write-path optimizations:

- maintain a warm observer-backed clip cache with explicit invalidation;
- share a fresh acquisition with the write stash when equivalent freshness is
  proved; and
- use targeted differences instead of full reconstruction.

The next session measures one fixed, persistent `1/512` observer per clip at
large view widths and across at least 128 observed clips. A settled complete
`1/512` scan is truth. The session does not implement a cache. The independent
played-range consolidation trial follows that measurement.

## Evidence carried forward

- E114 and E115 select compact bar events and guarded patches over exact JSON
  and established notation controls for the tested agent tasks.
- E116 proves fine binary and triplet host timing and records the dual-grid
  design that this direction simplifies.
- E119 measures page work and shows that local compact-format cost is small.
- E120 connects complete live state to compact agent context.
- E121 proves one guarded agent patch through a real write and independent
  readback.
- E51 and E52 show that all-channel replies and wider read cursors reduce cost,
  but page settlement remains material.
- E53 shows that note count is not the main current cost and that note observers
  are incomplete wake hints.
- E54 and E128 show the value of grouped writes and targeted note ownership.
- E16s and E19 show that launcher-content observers can detect clip moves.
- E24 records the writable note-property boundary.
- E129 records the played-range boundary and the missing agent acquisition
  interface.
- E130 records the API inventory, proves sparse step-data occupancy replay, and
  selects targeted channel enrichment for the next proof.
- E131 rejects one-grid discovery and sparse promotion. It adds a guarded
  experimental acquisition boundary over the complete dual-grid reader.
- E133 rejects requested quiet observer acquisition. It leaves the E131 route
  unchanged.
- D23 later accepts `1/512` cell identity for consolidated acquisition. It
  removes the second grid from the planned scale experiment without rewriting
  E131's exact historical result.

## Unsettled questions

- The final text or object syntax.
- The exact sparse-default and preservation rules.
- The complete patch vocabulary and conflict report.
- Event identity behavior after human note edits.
- Clip-reference recovery after a host restart.
- Whether normalized full documents can preserve every supported expression
  field without becoming too large.
- Whether independent readback returns the same compact document or a separate
  internal observation that is projected into it.
- Whether a fully invalidated warm cache can improve repeated acquisition.
- The amount of verification needed after targeted and complete writes.

Resolve these through focused practical sessions. Do not create new public
contracts only to answer them on paper.
