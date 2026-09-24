---
title: Phase 7b follow-up — Project-wide observer scale sweep
kind: plan
state: planned
status: Planned. Measure wide single-grid observer capacity before designing a persistent cache.
updated: 2026-09-24
parent: 7b-follow-up-consolidated-clip-acquisition.md
prev: 7b-follow-up-hybrid-observer-acquisition.md
next: 7b-follow-up-played-range-consolidation.md
evidence: E5, E21, E50-E53, E119, E130-E133; D23
---

# Phase 7b follow-up — Project-wide observer scale sweep

## Purpose

Measure whether fixed, persistent occupancy observers are practical for all
launcher clips in a large project. Test wide `1/512` views and hundreds of
observed clips before designing a product cache.

Use a settled complete `1/512` scan as truth under D23. Keep the complete E131
reader as an optional diagnostic control. Do not change the stable reader,
stable profile, or note-write path. Record the result as E134.

## Correctness standard

The current complete reader already uses a measured 144 ms view-settlement
delay. The Controller API does not provide a completion fence. Its correctness
claim is therefore empirical for the tested Bitwig and API versions.

Apply the same standard to the observer route. A measured 250 ms quiet period
can become an experimental policy if the controlled matrix passes. Do not call
it an API guarantee. The observer route must also prove two facts that a fresh
complete scan does not need:

- the initial callback replay supplied every occupied `1/512` cell;
- later edits and project changes invalidated that set correctly.

Use a settled complete `1/512` scan as the authority in every correctness
check. Compare one note per MIDI channel, pitch, and cell. Silence alone cannot
prove that an uninitialized view is empty.

Exact sub-cell timing and multiple same-channel, same-pitch onsets inside one
cell are outside this contract. Include that collapse as a declared boundary,
not as a promotion failure. Different pitches or channels in the same cell must
all survive.

## Candidate architecture

Give each observed clip one fixed `1/512` view. Keep target, grid, page, and
width unchanged after warm-up. Do not allocate a `1/768` view or reconcile a
second grid.

Store only sparse occupied coordinates and generation state. Do not allocate a
`width * 128` byte array for each observer. On a read, snapshot the coordinates,
call targeted `getStep` for all 16 channels, and return the D23 cell projection.
Fetch note fields on demand. Do not keep a full note object cache in this
experiment.

First prove the required cursor topology. Determine the smallest isolated
topology that can keep one pinned fixed view for each launcher clip. Record
cursor, clip-proxy, and observer counts.

No timed warm read can call `requestFlush()`, change target, change grid, or
change page. Wait at least 250 ms after the last view action and after the last
callback before it starts.

## Fresh project and fixture

Use a fresh scratch Bitwig project. Do not use the current musical project.
Create only owned tracks, scenes, clips, and notes. Record the exact empty
baseline before setup.

Grow the fixture in checkpoints. Keep low-density clips for handle-scale tests.
Use separate representative clips with 1, 16, 64, 256, and 1,000 occupied
coordinates for callback-density tests. Include all 16 MIDI channels in the
correctness fixture without multiplying the observer-count fixture
unnecessarily.

Ask the user to reload the controller when a fresh load is required. Do not use
computer control for controller reloads.

## Sweep A — View width

Use one fixed `1/512` observer and test widths progressively:

- 2,048 as the measured baseline;
- 4,096, 8,192, 16,384, and 32,768;
- 65,536 and 131,072 only if the prior width remains healthy.

These widths cover 4, 8, 16, 32, 64, 128, and 256 beats. Record accepted
construction, effective coverage, initial replay, read latency, memory trend,
and controller responsiveness. Do not infer an upper bound from the Java `int`
parameter.

Select the widest healthy value that covers a useful clip range. If a width
fails, bracket the boundary only when the failure is safe and repeatable. Do
not run a blind search near a failure.

## Sweep B — Observer count

At the selected width, test 1, 16, 64, 128, and 256 observed clips. Each clip
has one observer. Treat 128 clips as the required large-project target and 256
as a stretch target.

Measure low-density handle scale first. Then apply the callback-density fixture
to a representative subset. Run a combined high-density case only after the
separate handle and callback tests are healthy.

Do not run the full width-by-count Cartesian product. Recheck the baseline and
one intermediate width at the largest accepted count to detect an interaction.

## Measurements

For every step, record:

- extension construction, initialization, and controller-reload time;
- observer callback count, first callback, last callback, drain time, unique
  coordinates, duplicates, and callbacks later than 250 ms;
- idle, cold-replay, project-open, and mutation-burst ping median, p95, and
  maximum;
- extension-owned sparse entries and estimated bytes;
- available process or JVM memory trends, clearly labeled as noisy host-level
  evidence;
- targeted enrichment, bridge, normalization, and total warm-read latency;
- matched complete-`1/512`-scan latency and result digest; and
- cursor, clip-proxy, observer, track, scene, and clip counts.

Take matched measurements without the observer fixture when practical. Keep
fixture construction time separate from extension initialization and replay.

## Correctness matrix

Initialize each tested view from an authoritative complete `1/512` scan. After
the fixed warm-up and quiet period, compare the observer result with a new
settled complete `1/512` scan.

Cover these cases across at least three controller loads:

- empty, sparse, dense, binary, and triplet clips;
- note add, remove, and move on a fixed view;
- same-coordinate channel add and remove;
- different pitches and all 16 channels in one cell;
- adjacent triplet and arbitrary onsets that project to different `1/512`
  cells;
- multiple same-channel and same-pitch onsets inside one cell as the declared
  collapse boundary;
- field-only edits that preserve occupancy;
- external edits while the controller remains loaded;
- clip, scene, and track removal or compaction; and
- project save, close, and reopen.

For each mutation, wait 250 ms after both the action and the last callback.
Require exact D23 cell coordinates, channels, and fields. Do not require exact
sub-cell timing. Record any callback that arrives after the read begins. Do not
reuse E133 dirty-and-quiet results as proof for this fixed-view route.

Create the sub-cell boundary fixture through a temporary independent fine-grid
writer or visible UI edit. Do not add a persistent second observer. Record the
known source count, the projected cell count, and the exact identities that the
contract collapses.

## Gates and stopping rules

The route is viable for a project-wide design only if:

- 128 single-grid observed clips initialize and remain responsive;
- every in-contract comparison matches the complete `1/512` scan;
- no accepted read begins before the required action and callback quiet period;
- ping p95 grows by no more than 15 percent from its matched baseline and
  ordinary ping maxima remain below 100 ms;
- warm populated-read median improves by at least 50 percent over the matched
  complete-`1/512`-scan control; and
- extension-owned storage remains proportional to occupied coordinates, not
  view width times pitch count.

Report 256-clip capacity separately. Do not reject a 128-clip design only
because the stretch target fails.

Stop before the next scale step after a controller crash, initialization
failure, repeated ping at or above 100 ms, callbacks that do not drain, clear
memory pressure, Bitwig warnings, or uncertain fixture ownership. Preserve the
last healthy measurement. Restore the shipped extension before cleanup if the
probe prevents normal operation.

One mismatch rejects the tested warm-read rule. Keep the capacity measurements
but do not promote the route. A revised correctness rule starts a new evidence
count.

## Outcome

E134 must report the practical width, observed-clip capacity, callback-density
limit, latency, memory evidence, correctness result, and one verdict:

- design a project-wide persistent occupancy cache;
- limit the design to a measured working set; or
- reject observer caching and keep complete scans.

If a cache design is justified, plan it in a later session. Do not implement it
inside the scale probe. Then resume the independent
[played-range consolidation trial](7b-follow-up-played-range-consolidation.md)
in a fresh chat.

## Acceptance criteria

- Width and observer count are measured independently and progressively.
- The selected width covers a stated musical range at `1/512`.
- The test reaches 128 single-grid observed clips or records the exact earlier
  boundary.
- Sparse recorder cost, host-level memory trend, callback drain, ping, and warm
  read latency are reported.
- Fixed-view initialization and invalidation match a complete `1/512` scan in
  the full correctness matrix.
- Different pitches and channels in one cell survive. Same-channel and
  same-pitch multiplicity inside one cell is recorded as accepted loss.
- The evidence distinguishes an empirical 250 ms policy from an API guarantee.
- The stable reader, stable profile, and write path do not change.
- All owned fixtures are removed. The scratch project returns to its exact
  baseline or is closed without saving.
- Focused tests, the complete brain check, extension tests, `context/check.rb`,
  the wire-golden check, live hello, and `git diff --check` pass.
- Session changes are staged for review and not committed.

## Retrospective target

Record the first real constraint: cursor topology, observer handles, callback
drain, memory, controller responsiveness, correctness, or warm-read cost. Use
that constraint to narrow the next design.
