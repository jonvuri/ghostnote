---
title: Phase 6f2 — Groove intent and microtiming reproducibility
kind: plan
state: planned
status: Run after 6f1. Prove the timing floor, then select a groove representation.
updated: 2026-09-13
parent: README.md
prev: 6f1-established-symbolic-representations-and-model-familiarity.md
next: 6g-reference-conditioned-continuation-and-structural-transfer.md
---

# Phase 6f2 — Groove intent and microtiming reproducibility

## Purpose

Represent groove as musical intent plus exact performance. Prove that timing can
be captured, transformed, reproduced, and independently read back without
flattening swing, push and pull, cross-part asynchrony, or deliberate instability.

Start with a live Bitwig timing-resolution gate. Do not select a representation
whose required timing cannot be replayed through the adapter.

## Starting facts

- E114 bar events preserve rational performed positions, but they do not state a
  nominal grid, timing deviation, groove template, or performer intent.
- [D9](../../decisions/d9-grid-and-units-settled-2026-07-25.md) currently sets a
  product floor of `1/64` beat. This was a selected and tested family boundary,
  not a measured Bitwig maximum.
- One Ghostnote beat is one quarter note. Therefore, `1/64` beat equals a
  conventional 256th note and is about 7.8 ms at 120 BPM.
- E2 used a 512-step cursor at `1/32` beat and described it as a `1/128`-note
  scan. The 512 value was the cursor width, not the timing denominator.
- The archived E2 plan asked for `1/128`-beat testing, but the retained E2 probe
  stopped at `1/32` beat. No retained live evidence proves the finer value.
- E42 measured duration settlement on a `2^-20`-beat host quantum. That does not
  prove that finer start grids work.
- Installed API 25 documentation accepts a beat-time `double` for step size and
  gives no lower bound. The maximum reliable resolution is an empirical question.
- The current `humanize` transform is seeded and repeatable, but it snaps timing
  to the finest supported grid. There is no first-class swing operation.

## Timing-resolution gate

Use an owned disposable clip and independent writer and read cursors. Test
`1/64`, `1/128`, `1/256`, and `1/512` beat grids. Add matched triplet or rational
controls where the API accepts them.

For each grid:

1. Write isolated and mixed-grid starts and durations near page boundaries.
2. Read them twice through an independent cursor after settlement.
3. Change to a coarser grid and back to detect downward snapping or identity
   loss.
4. Test note-property writes after the required grid settlement.
5. Test same-pitch adjacency, overlaps, all channels, paging, and long clips.
6. Record raw host values, errors in beats and milliseconds, scan cost, cursor
   coverage, and stable readback hashes.
7. Remove the owned clip and prove the documented baseline is restored.

Select the finest reliable product grid from evidence. Amend D9, the capability
record, grid tests, and the shared grid family only when the live proof passes.
Refuse unsupported precision explicitly.

## Groove representation

Compare the 6f1 finalists with an explicit two-layer groove form. The form must
be able to state:

- nominal metrical position and duration;
- realized position, duration, velocity, and articulation;
- signed per-event deviation in beats and tempo-qualified milliseconds;
- the timing reference, subdivision, meter, tempo map, and phase;
- swing ratio or a multi-step timing and velocity template;
- instrument, voice, limb, or layer membership;
- cross-part anchors and intentional lead or lag relationships;
- local exceptions, confidence, provenance, and analysis coverage; and
- generator name, version, seed, and expansion policy for derived events.

Support simultaneous straight and swung layers. Do not force a J Dilla-style
relationship, jazz swing, and funk sixteenth-note swing into one scalar swing
amount.

## Study and data cohort

Use sources for methods and controlled data, subject to a separate license and
provenance check:

- [Does It Swing?](https://pmc.ncbi.nlm.nih.gov/articles/PMC6934603/) supplies
  raw jazz-piano MIDI and controlled quantized, expanded, and inverted timing
  manipulations.
- [Downbeat delays are a key component of swing in jazz](https://doi.org/10.1038/s42005-022-00995-z)
  gives a tempo-dependent jazz timing model and a listener experiment.
- The [Groove MIDI Dataset](https://magenta.withgoogle.com/datasets/groove)
  contains aligned MIDI and audio performances labeled with jazz, funk, hip-hop,
  and related styles.
- [Microtiming in Early Funk](https://doi.org/10.31751/1224) reports more than
  one thousand measured deviations across fourteen early funk grooves.
- Sean Peterson's [Something Real](https://hdl.handle.net/1794/23759) provides
  waveform-based analyses of J Dilla and D'Angelo timing relationships.
- [Bins, Spans, and Tolerance](https://doi.org/10.1093/mts/mtad005) compares
  models in which timing references can have width and shape instead of being
  dimensionless grid points.

Published analyses of copyrighted recordings are method references. Do not
retain or redistribute their source audio, transcriptions, or derived note data
without a clear permission basis. Use licensed study MIDI, generated controls,
and operator-owned performances for executable fixtures.

The cohort must cover jazz swing at multiple tempos, funk sixteenth-note swing,
laid-back and anticipated backbeats, hip-hop layer displacement, stable and
unstable anchors, flams, velocity and duration interaction, and simultaneous
straight and swung layers. Include harmonically complex pitched material so the
study does not reduce groove to isolated drum loops.

## Tasks

1. Recover nominal and realized timing from a declared source.
2. Distinguish swing ratio, global phase, local microtiming, tempo drift, and
   cross-part displacement. Abstain when the source cannot identify intent.
3. Quantize only the nominal layer while preserving selected deviations.
4. Scale, invert, or replace one declared groove component without changing the
   others.
5. Transfer a groove to new harmony and pitches without copying source notes.
6. Transform and continue existing multi-track material while preserving its
   selected timing relationships.
7. Render the same seed, source hash, template, and policy repeatedly. Require
   byte-identical symbolic output and exact live readback within the measured
   host contract.
8. Compare valid variants in randomized blind operator trials.

## Measurements

- finest stable live timing grid and error in beats and milliseconds;
- nominal-position and deviation reconstruction error;
- preservation of cross-part timing, harmony, voice leading, and identities;
- template-transfer error and unintended copied material;
- exact symbolic and live-readback reproducibility hashes;
- seed sensitivity and repeatability;
- parser, compiler, and refusal behavior;
- token use and context growth; and
- blind operator preference and cannot-decide rate.

Keep measurements, inferred intent, agent explanations, and operator judgments
in separate fields. A close timing match does not prove the intended feel.

## Acceptance criteria

- Finer-than-`1/64`-beat support is selected only after independent live write
  and readback evidence across the required cases.
- Units always state beats and the conventional note-value equivalent.
- The selected representation separates nominal timing from realized timing and
  supports multiple simultaneous timing references.
- The same declared seed and inputs produce identical symbolic output across at
  least three clean runs.
- Live replay preserves all supported timing and unnamed note fields, or refuses
  before mutation.
- Jazz, funk, and hip-hop each have one licensed or operator-owned executable
  fixture and one research-grounded task.
- At least one pitched task tests extended harmony or chromatic voice leading.
- Groove transfer and melodic or rhythmic copying are measured separately.
- Results are confirmed across two frontier text models where model reasoning
  is part of the task.
- The result selects a groove context and deterministic realization contract for
  6g, or records a precise blocker.
- Every live project and generated fixture returns to its documented baseline.

## Out of scope

- Claiming one universal mathematical definition of groove.
- Treating genre labels or timing measurements as aesthetic truth.
- Redistributing copyrighted recordings or transcriptions.
- Training a groove-generation model.
- Publishing a public timing or generation tool.

## Retrospective target

Record which distinction between nominal time, realized time, and timing
reference prevented the most incorrect groove interpretation.
