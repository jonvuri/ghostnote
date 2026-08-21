---
title: Phase 4, session 4a — device-side scale and scaffold baseline
kind: plan
state: complete
status: Complete 2026-08-21. E50 confirms D7, cleanup, and the final baseline.
updated: 2026-08-21
parent: README.md
prev: ../phase-2/2k-closeout.md
next: 4b-clip-operation-latency.md
scope: Device-populated project scale and D7 scaffold alignment
evidence: E5, E22, E50 · D6, D7, D15
---

# Phase 4, session 4a — device-side scale and scaffold baseline

> **Purpose.** Measure device-populated project scale on the current rig, then
> make the configured scaffold baseline match the evidence and D7.

## Carry-in

E5 measured up to 54 tracks and 387 clips. It found no allocation or latency
knee, but every added track had an empty device chain. E5 therefore left device
load as an explicit caveat.

The context and implementation also disagree about the current baseline. D7 and
the [bank capability page](../../evidence/capability/banks.md) name
`256/128/8/16/64` for tracks, scenes, cursor pool, device bank, and parameter
handles. [`RigConfig`](../../../extension/src/main/java/com/ghostnote/extension/RigConfig.java)
still defaults to `16/16/3/8/16`. The E5 probes restore the smaller values.
Do not call either set shipped until this session resolves the difference.

The current device banks follow the cursor pool. They do not subscribe to every
project chain at once. Device-populated project cost and cursor-sweep read cost
are therefore separate measurements.

## Execution order

1. Record the entry project, exact `rig.json` bytes or absence, deployed
   extension identity, host version, rig statistics, and complete bank-window
   state. Refuse the run if the project does not fit the measurement window.
2. Make `rig.stats` report the device and parameter resources that the current
   rig allocates. Keep measurement-only detail off the product tool surface.
3. Add a stable device-chain sweep. Each row must report its track `channelId`,
   device `itemCount`, visible count, and stabilization attempts. Accept a row
   only after two equal consecutive reads, as required by E22.
4. In a scratch project with stopped transport, build an ascending native-device
   load beside an empty-chain control. Use 48 created tracks with one, four, and
   eight top-level devices per track. Alternate the already proven Polysynth and
   Polymer UUIDs. Identify every created track by `channelId` set difference.
5. Measure each load at a full track window. Record rig construction and init,
   observer warm-up, device-sweep time, ping p50/p95/max, unstable rows, and
   project save size. Compare the current small scaffold, the D7 candidate, and
   a `directObservers=false` control one factor at a time.
6. Save and reopen the maximum load. Record project-open settlement and one cold
   Bitwig start with the E5c outage-tolerant recorder. Separate Bitwig project
   load time from extension init and observer cost.
7. Resolve D7 from the result. If the candidate holds, make it the actual
   `RigConfig` default and align the fake model, probes, comments, and context.
   If it does not hold, amend D7 with the measured replacement. Do not preserve
   a decision that the implementation does not use.
8. Delete only the tracks recorded by the probe, restore the entry `rig.json`
   byte for byte or restore its absence, reload that exact configuration, and
   confirm the accepted Phase 2 project with the read-only 2k baseline probe.

## Required boundaries

- Use native devices for the scale fixture. VST3 and CLAP behavior remains an
  exit criterion for later Phase 4 parameter work and is machine-specific.
- Do not use the accepted musical project as the load fixture.
- Do not infer extension observer cost from total project-open time. Keep the
  direct-observer control and report both values.
- Do not score a cursor-bound device read until it names the expected track and
  stabilizes twice. Bound retries by attempts.
- Treat whole-JVM heap values as trend data only, as E5 did.
- Stop without changing D7 if cleanup or configuration restoration is not
  independently confirmed.

## Exit criteria

1. A no-device control and the one-, four-, and eight-device loads have
   comparable measurements on the same machine, host, project shape, and full
   bank window.
2. The maximum fixture contains 48 created tracks and 384 native devices, and a
   complete stable sweep accounts for every device without a blind row.
3. The result separates project density, scaffold size, direct observers, and
   cursor-sweep operation cost. Raw counts and latency distributions are kept in
   a new evidence record.
4. Saved-project open and one cold start are measured at the selected candidate.
   Bridge outages and control-thread stalls are reported, not discarded.
5. The selected defaults are identical in `RigConfig`, the fake model, tests,
   probes, D7, and the bank capability page. If no candidate is accepted, all of
   those sources state the unresolved result instead.
6. The original rig configuration is restored exactly. No created track or
   device remains. The read-only Phase 2 accepted-project baseline passes.
7. Focused tests, the full offline check, extension tests, context check, and
   `git diff --check` pass.

## Retrospective target

Record whether the scale harness cleanly separated host project load from
extension observer cost. Note any measurement that should become a standing
Phase 4 check.

## Result

E50 measured the zero-, one-, four-, and eight-device loads across seven
controlled scaffold configurations. The maximum fixture contained 48 created
tracks and 384 alternating native devices. Every stable sweep accounted for all
devices with no blind row.

Project density did not move warm-up or ping latency. It raised the complete
48-row cursor sweep to about 4.6 seconds. Direct observers did not produce a
consistent cost. Saved-project open and cold-start settlement had zero
control-thread stalls.

D7 holds. `RigConfig`, the fake, E5 restoration probes, D7, and the bank
capability page now use `256/128/8/16/64`. Cleanup removed all recorded tracks
and restored the exact entry `rig.json` bytes.

The harness separated host project load from extension observer cost, but its
population stage needed a repair. A pending native-device insert can outlive the
probe process. Keep bounded, durable-row population as a standing Phase 4 rule.

The final 2k check found that the earlier accepted Phase 2 changes had not been
saved. The operator authorized reconstruction. The E45 and E48 probes recreated
the exact accepted clips and observation links. Bitwig saved the project, and
the complete read-only baseline passed after the save.
