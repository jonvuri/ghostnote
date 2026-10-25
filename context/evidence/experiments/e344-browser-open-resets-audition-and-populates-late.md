---
title: E344 — Browser open resets audition and populates after the first read
kind: evidence
state: active
updated: 2026-10-25
---

# E344 — Browser open resets audition and populates after the first read

## Verdict

The first R05 browser attempt on Bitwig 6.1.4 / API 25 did not reach a
content-type write. The initial results changed between two delayed reads,
so the bounded driver canceled. Both reads also reported audition enabled
even though the handler had disabled it immediately before opening.

This is an initialization finding, **not** confirmation or disproof of
[E101's content-type limitation](e101-plugin-preset-files-have-two-direct-routes.md).
No filter was reset, no result was selected, and no device was committed.
The probe removed its scratch track and independently verified the preserved
inventories and entry mixer selection.

## Environment and admission

- Operator reply: “Controller loaded”. `npm run probe:hello` passed on
  `phase-8-probe-v1`, 119 methods, hash `9e75b9a8b3938491`, API 25.
- Initialization: `2026-10-25T15:56:56.844Z`, after deployment at
  `2026-10-25T15:55:46.321Z`. Archive SHA-256:
  `a2cff156f2e7a0b380234882f77f4d95e9a6d9f0bc8048cea5392faad97730f9`.
- Direct markers: browser `r05-browser-discovery-v1`, Grid
  `9b-grid-doctor-v21`. Host: Bitwig Studio 6.1.4, Java 25.0.4.1.
- Actual foreground project: `gn-scale-test`, generation
  `6f9b15b5-8b5f-4edd-b325-ed2be341b20c`; transport stopped. The V01 music
  project was not the foreground target.
- No competing probe driver was observed. The existing MCP bridge client
  (PID 84650) was left alone. All experiment requests used one foreground
  client chain.
- Owned scratch: `gn-r05-browser`, channel ID
  `5f7d48b7-a3cd-475c-977d-a9e93e6a3907`. Its chain and Launcher slots were
  empty before browser work and before deletion.

## Observations

The driver prescribed a 280 ms opening wait, then an 80 ms interval between
status reads. Host scheduling and request overhead add to those intervals.
Times below are elapsed from the successful `open` request receipt, not from
the host's internal browser creation.

| Read | Elapsed | Exists / owned | Content index / name | Result count | Audition |
|---|---:|---|---|---:|---|
| First opening read | 304.684 ms | true / true | 0 / empty | 0 | true |
| Second opening read | 402.237 ms | true / true | 0 / empty | 95,764 | true |

The result bank changed from zero visible rows to 128. Its first two names
were `Chain` and `Drum Machine`. The guard changed only because the result
count and rows changed; target, project, selection, and filters matched.
The driver stopped with `open: browser did not settle within the bounded wait`.
The two empty content names precede any content-type write and cannot be
treated as a failed setter measurement.

The handler called `shouldAudition().set(false)` before `browse()`. Both open
readbacks reported true. Cancellation independently read back closed,
unowned, audition false, and zero results on two reads. No uncertain write
was repeated.

This single attempt establishes neither a stable population latency nor a
minimum sufficient delay. The next apparatus revision uses a separately
bounded 1,000 ms opening wait and an explicit, guarded **post-open** audition
disable with independent readback before any content-type write. That revised
condition still needs live validation.

## Cleanup and retained scope

The before/after snapshots compare equal: 11 original track rows, 10 scenes,
110 slot occupancy reads (25 filled), 16 top-level devices across the original
tracks, and all recorded mixer fields. The scratch track is absent. Mixer
selection is again `gn-sel`, channel ID
`6fb96670-abde-4958-9147-f573a4b43918`; transport remains stopped.

These are inventory and mixer preservation checks, not full note-content,
device-state, or saved-file equality claims. No note, parameter, or file write
was issued. No owned scratch object remains.

## Reproduction and artifacts

- [Ordered request/readback log](../data/r05-browser/attempt-1/events.jsonl)
- [Before snapshot](../data/r05-browser/attempt-1/before.json),
  [after snapshot](../data/r05-browser/attempt-1/after.json), and
  [attempt result](../data/r05-browser/attempt-1/result.json)
- Frozen [session driver](../data/r05-browser/attempt-1/session.mjs) and
  [v1 discovery sequence](../data/r05-browser/attempt-1/discovery-driver.ts).
  The retained session uses the frozen sequence; its bridge-client import is
  adjusted for the artifact directory.

The original invocation, from `brain/`, used the foreground session driver:

```sh
node --import tsx ../context/evidence/data/r05-browser/session.mjs gn-scale-test 6f9b15b5-8b5f-4edd-b325-ed2be341b20c ../context/evidence/data/r05-browser/attempt-1
```

For a reproduction, use the frozen driver path, a fresh output directory,
and a newly observed project/generation after matching build admission. The
archived v1 driver requires the v1 marker. Running the current driver uses
the revised v2 condition described in the [R05 brief](../../work/r05-browser-name-resolution.md).
