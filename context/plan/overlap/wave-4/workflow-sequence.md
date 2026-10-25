---
title: Working workflow variations in priority order
kind: plan
state: active
updated: 2026-10-24
---

# Working workflow variations in priority order

The priorities in [W4-004 through W4-011](decisions.md) are accepted. This
sequence is the accepted working direction under W4-012. It is not an
implementation authorization or a fixed schedule. Field bounds and briefs
remain to be selected. [sequence.json](sequence.json) holds the concrete tasks, acceptance
results, evidence limits, and minimum dependencies. The
[visual sequence](report.html#sequence) presents all 13 variations.

## Template inputs and acceptance

Each variation is a template, not a fixed fixture or source project. The user
supplies current drum, bass, melodic, harmonic, or other material when the
session runs. Select target objects, useful output, and practical bounds then.
Ask only the capability-specific questions that materially change acceptance.
[W4-018](decisions.md) settles this method; do not request all inputs now.

[Selected work sessions](work-sessions.md) add P01 performance and recovery,
expand R01 for claims and naming, and schedule C01 legacy-profile removal.
T5 retention research is deferred unless evidence shows a concrete cost.

## Main path

| Order | Variation | Useful result and matrix focus |
|---|---|---|
| V01 | Build a useful MIDI sketch | Two sections from existing drum/bass material. Read, edit, and create notes; use existing devices and MIDI/document tools. Resolve one device or preset by name. CA-1, DP-5; R05. |
| V02 | Edit difficult MIDI without hidden loss | Field-by-field coverage for expression, channels, timing, pickups, overlaps, and clip ranges. Pressure gets a fresh verdict. CA-1. |
| V03 | Arrange and revise song sections | Read the Arranger, place and move MIDI sections, and preserve offsets and neighboring clips. CA-3/4; required tempo/meter from SM-4; cue markers (SM-5) optional. |
| V04 | Shape the arrangement with automation | Read and edit points/curves, then move a passage with its required automation. CA-6. |
| V05 | Edit existing audio as song material | Identify sources/ranges; create, read, update, and delete required audio clips. CA-5/8 and MA-2. |
| V06 | Put externally sliced hits into a drum instrument | Assign, read/retrieve, replace, and clear samples in Samplers on pads. Slicing stays external. MA-2, required MP-9/DP-4 subsets. |
| V07 | Read back one track for external analysis | Quick, inaudible, post-device/pre-fader audio from an existing clip, full span or a measure/two, with a trustworthy file/time handoff. New scope related to MA-3, not covered by its old master proof. |
| V08 | Make the song sound playable | Useful controls, ranges, and live remote mappings for the sound. DP-2; DP-1 only where needed. |
| V09 | Author and revise live modulation | A useful modulator and mappings; independent verdicts for required amount, enable, mode, source, and curve edits. MP-3/4/5/7/8/10. |
| V10 | Construct a useful Grid instrument | Phase 11 read/catalog first, then useful Poly Grid modules, values, cables, and mappings. GI-1. |
| V11 | Extend Grid where it changes the instrument | Selected indexed values, relocation, FX/Note variants, or stateful attachment. GI-2, within proved bounds. |
| V12 | Balance the completed arrangement | Levels, pan, the Effect track a send needs, a useful send, needed track state, Master controls, and processing. SM-1/2/3, SM-7 Effect subset; SM-10 only where necessary. |
| V13 | Polish and compare a mix revision | Change mix/master processing. Compare a track artifact or operator export through external analysis. Reuse V07 where applicable. |

The full cases and limits are in the report and JSON. Existing product
capabilities are exercised and credited; they do not need to be rebuilt.
Each case adds only the missing behavior needed for its useful result.

## How to use the order

1. Start R01, R02, and R05 with the first MIDI work. R01/R02 outputs guide
   V02. None blocks a useful V01 through existing tools; R05 only decides how
   V01 resolves a name.
2. V03 and V04 are the core song path. V05 and V06 can proceed independently
   if an Arranger or automation route is blocked. Begin R03 when V05 starts,
   before assuming a bounce implementation for V07.
3. V08 and V09 turn a song sound into an instrument. R04 tests the live
   setters. V10 can proceed through Phase 11 while an outer-modulator route
   is unresolved. There is no dependency from Grid to remote-page success.
4. V11 has high sound-design interest but is bounded. A failed wider Grid
   route must not postpone V12 indefinitely. Keep its exact limit and next
   useful research question.
5. V12 and V13 come last as full outcomes. Required mixer, sample, tempo,
   or readback operations can appear earlier as dependencies.

This is a priority order, not a rule to finish every field before moving on.
"All feasible" means systematic field coverage with explicit limits. For
an unresolved route, finish a bounded source audit and focused probe, record
the result, and continue independent work. Do not treat one failed route as
proof that a capability is impossible.

## R01 — Producer Pal notation comparison

**Default:** keep current FIELDS/JSON. The expanded
[R01 session](work-sessions.md#r01--formats-claims-and-public-naming) includes
dense claims/overlays, maintenance and planning cost, and format naming.
Do not treat syntax replacement as the expected outcome.

**Purpose:** improve agent authoring and reading without losing required
musical data or Ghostnote's edit identity and preservation rules.

The [official notation page](https://producer-pal.org/features/midi-notation),
read on 2026-10-24, describes bar|beat, MIDI JSON, Stark, and transforms.
It presents bar|beat as compact and stateful, MIDI JSON as explicit note data
with fractional times, and Stark as drum/chord-friendly with lossy dynamics.
Transforms form a separate edit language. These are documentation claims,
not measured results in Ghostnote. The page's exclusivity claims about
probability also need checking against its MIDI JSON fields.

**Offline investigation:**

- Pin the documentation and parser/serializer/test source revisions. Include
  the actual agent instructions and read/update semantics for each notation.
  Reconcile documentation with source before deriving a feature verdict.
- Compare each notation and the transform language with Ghostnote FIELDS and
  JSON. Use the [prior format selection](../../../archive/outcomes/PHASE-8C4F-FORMAT-SELECTION.md),
  [D25](../../../decisions/d25-fields-json-document-format-and-publication.md),
  and current document codec/binding as the baseline.
- Separate syntax, semantic model, editing language, and host binding. Test
  pitch/octave conventions, meter/time units, exact fractions, channels,
  expression, probability, overlaps, loops, and unsupported fields. Check
  stable identity, merge keys, deletion, partial edits, and preservation.
- Check actual JSON interchange. A permissive notation with bare keys or
  fraction expressions is not necessarily valid JSON for a standard parser.
- Consider an optional authoring front end or selected syntax ideas before
  replacing the canonical document. A concise composer syntax need not be
  the lossless snapshot format. Do not put harmonic analysis into Ghostnote
  merely because a notation offers chord shorthand.

**Prepare tests if promising:** share a fixture corpus across candidates:
straight and odd meters, tuplets, dense drums, chords with distinct note
lengths, pickups, multichannel/expressive notes, same-pitch overlaps, and
small edits in a large clip. Measure semantic round-trip loss, parse/error
behavior, token size including instructions, edit locality, and adapter cost.
If agent trials are useful, hold task/model conditions constant and count
corrections and functional success. Do not infer better composition from a
shorter string. No host is needed for the initial comparison.

**Output:** a capability/loss matrix for all four surfaces, examples, and a
retain/adapt/test verdict per surface. Promising candidates receive an
offline test brief before any adoption decision. New host fidelity claims
require their own binding proof. Format choice does not block V01.

## R02 — Pressure reproduction and upstream evidence

**Purpose:** distinguish a missing condition in Ghostnote from a Bitwig API
defect. Do not assume that identical external setters are independent proof.

**Read first:** [E15](../../../evidence/experiments/e15-phase-0-findings-bank-window-and-same-request-write-semantics.md),
[E236](../../../evidence/experiments/e236-document-edit-limb.md), its raw
pressure records, [D37](../../../decisions/d37-note-pressure-is-a-blind-host-limit.md),
and the pinned [clip references](../wave-3/clips-and-arrangement.md).
E236 found inspector pressure at 51 percent but zero from both cold and
verbose reads. Separate that read result from the earlier write result.

**Offline audit:** compare Ghostnote with DrivenByMoss, openwig, and the
other pressure handlers in the external register. Inspect API version,
getter/setter contracts, subscriptions, initialization, cursor target,
channel, step size, note addressing, flush/update timing, and cached versus
observed values. Check static note pressure versus pressure envelopes or
live channel pressure; do not conflate them. Look for actual upstream tests
and issue reports rather than inferring testing from a handler's existence.

**Proposed live reproduction:** use the current admitted host build and a
small owned fixture with distinct notes and zero/nonzero pressure controls.
Use a minimal public-API extension path independent of Ghostnote's codec
and planner. Establish note identity and inspector state first. Bound
observer waits and repeat reads; use velocity or another known observable
field as a positive control. Test human-set pressure reads separately from
setter writes, then verify through an independent reader and the inspector.
Reopening is a separate test if needed to distinguish persistence from
observer state. Do not repeat an uncertain write. Preserve the exact build,
API, extension source, timings, values, and operator observations.

**Output:** either a corrected route with regression coverage and revised
limits, or a minimal reproduction and upstream bug draft with expected/actual
results, build details, steps, and raw evidence. The user requested upstream
filing if the defect is confirmed. Finish this concrete evidence package
before that filing step; record the destination and result in the later
session. If the reproduction is inconclusive, retain that limit and name the
next missing condition; do not file an unconfirmed defect as established.
Existing pressure refusals and warnings remain until the evidence
supports a change. Waiting for an upstream response does not block other
variations. This planning session makes no host request or submission.

## R03 — Inaudible track readback feasibility

**Purpose:** identify a useful audio readback route, not a general recorder.
Use one existing clip, post-device and pre-fader, over its full span or a
bounded measure/two. This signal scope is selected, not an open choice. First inspect controller
and internal bounce/render routes and external source leads. Do not assume
that a trigger action returns a file, completion signal, or safe target.

Prove the selected post-device/pre-fader scope. Resolve and test sends/returns,
sidechains, tails, range origin, completion, file identity, and cleanup.
"Inaudible" requires no monitored output; a muted render that contains silence
does not satisfy readback. "Quick" needs measured end-to-end latency at a
named range and project size. No latency target is selected yet.

An offline render may still require host scheduling and may differ from
real-time behavior for some devices. Prove the requested signal and timing
before offering it to analysis. Existing master recording is only a possible
later fallback. If a usable track bounce route is not found, report the
exact missing predicate and compare an operator bounce with a bounded
real-time capture. Do not silently substitute either for the desired path.
The remaining output/routing choice belongs to the later scope pass.

**Output:** one route verdict, a minimal artifact/metadata contract, and a
bounded implementation or investigation brief. Keep content interpretation
external. V05 and V06 do not depend on a successful render route.

## R04 — Live mappings and modulation setters

**Purpose:** revisit live controls using the external references while
keeping separate verdicts for remote pages, outer modulators, and Grid.

Start with one useful mapping from V08 or V09. Compare the pinned handlers,
current public API, and admitted internal paths. For each operation, list
whether the route can create, read, edit, and remove the object. A browser
open, cached value, or writer echo does not prove a setter. Check destination
identity, amount range, enable/mode/source fields, curves, and preservation.

Then plan a bounded probe on one owned device and mapping. State host work,
memory, cost, independent readback, recovery, and stop conditions. Extend to
another type only after the first useful route has a verdict. Keep current
file behavior available until a replacement meets the task. Broader
modulator catalogs, resource formats, nested devices, and arbitrary plugin
state are not automatic prerequisites.

**Output:** a per-setter route table and the first useful live implementation
brief, or an explicit limit with the best remaining lead. This is research
selection, not proof that every desired live setter exists.

## R05 — Browser and catalog name resolution

**Purpose:** let an agent name a device, plug-in, or Bitwig preset and get one
exact identity, including items in custom user-library locations. The offline
native catalog covers stock devices only; VST3 and CLAP sources need explicit
IDs today.

**Current evidence:** E101 (API 25, 2026-09) opened the popup browser from an
insertion point and tried `selectedContentTypeIndex().set()` before open,
after open, and as a relative increment. None took effect. The view stayed
at 95,756 mixed results with no device filter, and nothing was committed.
D22 removed the probe handlers. D22 excludes vendor preset formats; it does
not exclude device or Bitwig-preset discovery.

**External leads (Source only):** Control Deck opens the browser from an
insertion point, waits 280 ms, sets the content-type index, waits 180 ms,
resets all eight filter columns to their wildcard item, selects filter values
through banks, scans the result bank in pages of 128 for an exact name, then
commits. It never reads the index back. Gig Maestro has two completed browser
phases with filter cursors and a result bank and an online smoke test; no
captured result is in the clone. E101 read the index with no wait, so timing
is the most likely missed condition.

**Bounded probe:** one owned scratch track on the admitted build. Open from
its insertion point, set the content type, wait one callback cycle, read the
index and name back, reset filters, select a device-type filter, and scan the
result bank for one known stock device and one known plug-in by exact name.
Cancel on any mismatch or stale guard; commit only when exactly one exact
match exists and the readback confirms the content type. Record the wait,
result count, and timing. One attempt per condition; no retry after an
uncertain commit.

**Output:** a route verdict and, if positive, a minimal `resolve_device_name`
contract: exact identity, source kind, location, and ambiguity report. If the
index write still fails, V01 resolves names from the offline catalog and
explicit IDs, and the limit is recorded. No host request runs in planning.

## Coverage and acceptance

The [76-row coverage map](report.html#coverage-detail) links cases to baseline
proof. Each credited cell needs a concrete verb, object type, field coverage,
and scale. Use the [functional acceptance rule](coverage.md#proposed-functional-acceptance-rule).
Use D54 optional recovery, D15 independent verification, D49 truthful results
for retained reversal tools, and D52 native admission. Reuse existing cost models; model and measure changed live paths.
Required controller deployment/replacement and session admission still precede
live work. This proposal performs none of those actions.

The sequence includes new requirements that wave 3 does not fully represent:
track-scoped bounce, full audio CRUD, audio-in-device reads/edits, and the
notation comparison. W4-D must add explicit row/verb entries for selected
results. MA-2 insertion and MA-3 capture cannot absorb all of them by label.

## Next planning and implementation briefs

The working path and broad boundaries are selected. Use the
[remaining concrete examples](remaining-decisions.md) only when a capability
needs a decision. P01, expanded R01, and C01 have explicit
[research/cleanup briefs](work-sessions.md). I01 records internal-host
requirements as W4-D maps tools and routes. Full history-retention research
stays deferred. No file-authoring removal or format migration is assumed.

W4-D maps template cases to selected row/verb requirements and implementation
sessions. The user supplies real material at execution. Lightweight release
readiness follows a few useful cases; publish only tested Bitwig versions
with no guarantee outside the list. Keep existing Phase 11 ownership.
