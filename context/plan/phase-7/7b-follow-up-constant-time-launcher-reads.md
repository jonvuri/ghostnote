---
title: Phase 7b follow-up — Constant-time launcher-clip read search
kind: plan
state: complete
status: Complete. E130 selects step-data replay plus targeted channel reads for the next proof.
updated: 2026-09-24
parent: 7b-agent-patch-execution-and-reference-dogfood.md
prev: 7b-follow-up-played-range-consolidation.md
next: 7b-follow-up-consolidated-clip-acquisition.md
evidence: E2, E19, E24, E45, E51-E54, E116, E119-E121, E129-E130
---

# Phase 7b follow-up — Constant-time launcher-clip read search

## Purpose

Search the complete available Bitwig extension surface for a reliable, very
fast way to read launcher-clip MIDI state. Do not assume that the existing
`Clip.getStep` scan is the only route because earlier work used it.

The ideal result is a fresh clip read whose host work does not scale with clip
extent, grid resolution, or empty cells. A near-constant warm read with explicit
cache invalidation is also useful. Preserve complete musical and writable note
state where the host exposes it.

This is an investigation session. Do not implement the consolidated compact-bar
interface or replace the product reader before the capability result is clear.

## Design context

Read the
[consolidated compact-bar direction](../../evidence/format/CONSOLIDATED_COMPACT_BAR.md)
first. Its working direction uses one `1/512`-beat realized-time lattice. Triplet
and higher-cardinality divisions become overlays. This removes the current need
for a second triplet scan, but it does not by itself make a long clip read
constant-time.

The current reader:

- points and pins a dedicated launcher cursor;
- reads clip metadata;
- scans `1/512` and `1/768` grids;
- pages through the clip extent;
- calls the extension's all-channel bulk method once per page; and
- reconciles the two grids.

The extension bulk method still loops through every time, pitch, and channel
cell with `Clip.getStep`. E51 proves that fewer bridge requests help but do not
remove host scan and settlement cost. E52 proves that a wider cursor removes
page transitions without a measured initialization penalty at 2,048 steps.
E53 proves that current cost is driven more by extent, pages, grids, and stages
than by the number of notes.

The public `Clip` interface in the installed Controller API 25 artifact exposes
`getStep`, step observers, grid changes, scrolling, and note mutations. The
initial inspection found no direct note-enumeration method. Treat this only as a
starting fact. Search the full API and indirect host facilities before accepting
it as the final boundary.

## Investigation work

### 1. Build a complete available-method inventory

Generate a repeatable inventory from the exact Controller API artifact used by
the extension. Include inherited public methods and callback interfaces. Record
the Bitwig version, API version, artifact path or coordinate, and artifact hash.

Search all relevant interface families, not only `Clip`:

- clips, cursor clips, launcher slots, arranger clips, and clip browsing;
- tracks, note inputs and outputs, transport, selection, and object proxies;
- document, application, project, browser, drag-and-drop, and clipboard routes;
- MIDI import, export, conversion, bounce, save, and content-provider routes;
- step-data, note-step, content, selection, and project observers;
- controller-host services, actions, commands, and extension state; and
- any API type whose name, parameter, return type, or callback suggests notes,
  MIDI, events, data, content, serialization, or transfer.

Search the installed API classes, available source or generated documentation,
the current extension, repository evidence, and the running host's concrete
proxy classes when safe. A read-only reflection inventory can inspect concrete
public methods. Do not invoke unknown methods merely because reflection finds
them.

Check whether another API artifact installed with this Bitwig version exposes a
newer or different route than the Gradle compile artifact. Keep private or
undocumented runtime methods separate from supported public methods.

Commit or retain a compact generated inventory or script if it will make the
negative result reproducible. Do not paste an unbounded class dump into an
evidence document.

### 2. Evaluate indirect read routes

For each plausible method family, answer whether it can return complete note
data for one identified launcher clip without a physical MIDI file export.
Consider at least:

- direct note or event enumeration;
- a host serialization, transfer, drag payload, or in-memory MIDI object;
- selected-note or clipboard data that can be read without a focus-dependent
  destructive action;
- a clip-to-MIDI conversion or export that can target memory or a stream;
- monitoring clip output during bounded playback;
- initial or replayable observer delivery after pointing a cursor;
- a persistent extension-side mirror maintained from host callbacks;
- a project or document data channel that contains live clip events; and
- a safe supported route through another public API object.

For each route, record:

- target and identity semantics;
- whether it is fresh or cached;
- completeness across time, pitch, and all 16 MIDI channels;
- available note and expression fields;
- timing precision and normalization;
- initialization, paging, playback, focus, and selection requirements;
- change and invalidation signals;
- live-project side effects; and
- expected complexity in clip extent, empty cells, and note count.

Reject a route explicitly when it is unavailable, incomplete, stale,
focus-dependent, file-backed, destructive, or unable to identify the requested
clip. Do not turn a named application action into a semantic read API.

### 3. Probe credible candidates

Build small read-only extension probes only for routes that survive the static
screen. Keep probe methods outside the stable public tool profile.

Compare a candidate with the current complete reader on controlled launcher
clips. The cohort should separate:

- short and long extent;
- sparse and dense notes;
- empty spans;
- all 16 MIDI channels;
- adjacent and overlapping same-pitch notes;
- normalized triplet and higher-cardinality positions; and
- optional note-expression fields.

Use existing owned fixtures when they provide the required state. If a new
temporary fixture is necessary, declare its exact ownership and cleanup before
creating it. Do not alter existing user material. Do not export a physical MIDI
file.

Measure cold and warm behavior separately. At minimum, record target
acquisition, initialization, host work, bridge work, local decoding, and total
wall time. Test enough clip extents and note densities to distinguish these
cost shapes:

- constant in extent and note count;
- proportional to returned notes;
- proportional to clip extent or cells; and
- a warm cache with a separate full initialization cost.

Compare normalized compact results, not raw callback order. A fast route must
not silently omit foreign notes, channels, expression, or late clip content.

### 4. Test the best fallback ideas only if needed

If no direct route exists, evaluate the smallest credible near-constant design:

1. one initial normalized `1/512` scan;
2. an extension-side clip mirror updated by observers;
3. explicit invalidation on target, project, scene, content, grid, or observer
   uncertainty; and
4. a full rescan when coverage cannot be proved.

E53 found that `addNoteStepObserver` sends no initial state and misses four
enable-field changes. Recheck other observer families before accepting this
limit. A cache can be selected only if every missed event has a reliable
invalidation path. Otherwise classify it as a best-effort fast path with an
authoritative rescan boundary.

Also test larger cursor widths only as a fallback optimization. Record
initialization, host scan, memory, callback load, interference, and page-count
effects. A wider brute-force window is not a constant-time result.

## Acceptance criteria

- The session inventories the full relevant method surface of the exact API
  available to the extension.
- It searches direct and indirect MIDI-content routes beyond `Clip.getStep`.
- Every credible route has a concise capability and failure assessment.
- Any selected candidate returns one identified launcher clip with declared
  timing, channel, field, and freshness coverage.
- Live timing separates initialization, host, bridge, and local work and tests
  scaling by both extent and note density.
- No result calls a page-bounded cell scan constant-time.
- No physical MIDI export, focus-dependent named action, or destructive user-
  project operation becomes the read path.
- Temporary probes and fixtures leave the documented live project baseline and
  selection clean.
- Record the result in E130. Update the consolidated compact-bar document with
  the acquired capability boundary and the next concrete implementation step.
- Update `context/NOW.md`, stage only session changes, and do not commit them.

## Verification

Run the smallest checks that match the work:

- an inventory-generation determinism check if a script is retained;
- extension tests and `./gradlew test` for extension probe changes;
- focused brain tests only if a client or decoder is added;
- `ruby context/check.rb`; and
- `git diff --check`.

Run a live extension handshake before any live probe. Record the deployed
method hash. Do not run a live probe for a route that the static inventory has
already disproved.

## Out of scope

- Final compact-bar syntax or contract versioning.
- Public registration of a new clip tool.
- Removal of current write guards or independent post-write readback.
- A physical MIDI-file export workflow.
- Project-file parsing presented as fresh live state.
- General verification reduction unrelated to clip acquisition.
- The pending E129 consolidation live trial.

## Completion and return route

E130 records the reproducible inventory and the step-data observer follow-up.
`addStepDataObserver` replays sparse page occupancy after target, grid, and page
changes. It supplies no channel, note fields, or completion signal.

Continue with the
[consolidated clip acquisition](7b-follow-up-consolidated-clip-acquisition.md).
Enrich settled `NoteOn` coordinates with targeted 16-channel `getStep` reads.
Compare the result with the current complete dual-grid reader before promotion.
Resume the E129 live trial only after a fresh agent can acquire its required
clip state through that route.

## Retrospective target

Static signatures did not show observer replay semantics. Live-test distinct
observer families before carrying one family's limits to another. Retain the
inventory method and focused probes for later API comparisons.
