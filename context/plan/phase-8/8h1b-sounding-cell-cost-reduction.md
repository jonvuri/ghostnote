---
title: Phase 8h1b — Sounding-cell cost reduction
kind: plan
state: planned
status: Planned. Reduce the host cost of each sounding cell with fewer bound proxies and a coarse change sentinel.
updated: 2026-10-05
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h1a-cache-limit-knee-sweep.md
next: 8h2-exact-reader-consolidation.md
evidence: E131, E139, E224, E225; D26, D27, D29
---

# Phase 8h1b — Sounding-cell cost reduction

## Why

[E225](../../evidence/experiments/e225-cache-limit-knee-sweep.md) found that
Bitwig keeps one `NoteStep` of about 350 bytes for each sounding 1/512 cell,
for each cursor clip proxy bound to the clip. A sounding cell is a note start or
a sustained cell. Long held notes are therefore expensive, and the clip-length
limit is a sounding-cell budget. The API has no onset-only or note-list read.
It controls only grid size, step size, scroll position, and subscription.

Run this session after the 8h1a continuation and before 8h1 promotion.

The 8h1a combined row also adds about 264 MiB of retained read data at 131,072
notes. Complete research reconcile calls reach 210 ms while they build full
diagnostics. Include that retained-data term in the memory measurements. Remove
or budget repeated census and historical payload construction before promotion.
The 512-track, 128-scene project reaches 2,013 MiB and takes 10 s on its first
switch to the anchor. Keep the scene count and project model in each heap sample.


## Experiments, in order

### 1. Release of a bound proxy

Bind one proxy to a sustained fixture of about 1 million cells. Measure the
`NoteStep` count and live heap with `jcmd <pid> GC.class_histogram` after each
of these: unsubscribe, unpin, point to an empty slot, point to another track,
and subscribe again. Record which action releases the grid and how long a
rebind takes to replay it.

### 2. One proxy for each resident clip

List every cursor that can hold a resident clip: shadow view, authority,
fixture, E131 fine cursor, and pool cursors. Measure the heap when each one
moves off a clip after use. Specify the release rule for 8h1.

### 3. Sounding-cell admission

Specify admission and eviction by resident sounding cells, not by clip count.
Use the release result from experiment 1. Measure eviction and readmission of a
dense clip under a small research budget.

### 4. Coarse sentinel detection matrix

Bind one sentinel proxy at a coarse step: 1/16 beat first, then 1/4 and 1
beat if 1/16 passes. Hold exact values in the cache. For each edit type, record
whether the sentinel delivers a callback for the changed coarse cell:

- a 1/512 nudge that stays inside one coarse cell;
- a nudge across a coarse cell boundary;
- a field-only change: velocity, gain, chance, mute, and a disabled control;
- a duration change that does not change the coarse footprint;
- delete and re-add at the same position inside one host update;
- same-pitch and same-channel notes inside one coarse cell;
- an edit on each of the 16 channels;
- the final cell of the clip, and a clip loop or length change.

Compare with a 1/512 recorder. A miss in any row refuses the design for that
step size. A pass supports a named delivery assumption for the coarse grid,
like D26; it does not prove one.

### 5. Batched fine acquisition and re-read

Use a temporary full-width fine proxy at 1/512 for cold acquisition and for
re-reads of dirty coarse cells. Read occupied or dirty cells in batches inside
the existing 40 ms batch budget. Do not read one cell at a time and do not page.
Release the proxy after use, using the rule from experiment 1.

Do not acquire the complete project at once. Limit the concurrent fine
acquisitions by their total sounding cells, up to a reasonable research limit.
Measure cold acquisition time, peak heap, re-read time for a local edit, and the
warm read from cached values for clips of 4,096 to 131,072 notes. Compare with
E225's live-value warm reads and with E131.

## Acceptance criteria

- Experiments 1 and 2 record a release rule and its heap effect.
- Experiment 3 records an admission rule with a measured eviction cycle.
- Experiment 4 records every listed edit type at each tested step size.
- If a step size passes, experiment 5 records cold acquisition, peak heap, local
  re-read, and warm-read times; if none passes, it is not run.
- Each research result keeps `complete:false` and `eligible:false`.
- Owned projects are closed without saving; the normal extension is restored
  with a fresh normal hello.
- Brain check, extension check, wire goldens, context check, and
  `git diff --check` pass.

## Out of scope

- Promotion and live eligibility (8h1).
- Exact reader changes (8h2).
