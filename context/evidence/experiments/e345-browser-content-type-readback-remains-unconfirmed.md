---
title: E345 — Delayed browser content-type readback remains unconfirmed
kind: evidence
state: active
updated: 2026-10-25
---

# E345 — Delayed browser content-type readback remains unconfirmed

## Verdict

R05's revised, bounded API 25 probe on Bitwig 6.1.4 could disable audition
after opening, but could not confirm the requested `Devices` content type
through independent delayed readback. The selected index was `0`, its name
was empty, and the result count remained 95,764. The driver canceled before
filter reset or result selection.

The supported discovery route therefore remains **unconfirmed under the
content-type guard**. R05 closes with the existing offline catalog and
explicit-ID/path fallback. No `resolve_device_name` tool or broader browser
support is warranted by this evidence.

This does not prove that setting index `0` was ignored: `Devices` was already
at index `0` in the reported list, and the selected index was `0` before the
write. The missing selected-name readback is the decisive guard failure.
No nonzero index write, filter reset, plug-in scan, custom-library preset
scan, or commit was attempted in this pass. Those branches remain unproved;
the result does not claim that manual browsing or all API browser operations
are impossible. [E101](e101-plugin-preset-files-have-two-direct-routes.md)
retains the older nonzero-index evidence, and
[E344](e344-browser-open-resets-audition-and-populates-late.md) records the
first R05 initialization attempt.

## Environment and admission

- Operator reply: “Controller replaced”.
- `npm run probe:hello`: all pass, `phase-8-probe-v1`, API 25, 119 methods,
  hash `9e75b9a8b3938491`; direct browser marker `r05-browser-discovery-v2`
  and Grid marker `9b-grid-doctor-v21`.
- Initialization `2026-10-25T16:05:32.474Z`, after deployment at
  `2026-10-25T16:03:46.833Z`. Archive SHA-256:
  `7a1bdc9ea4e7becb79e672b995979ad59428364cf22318349987739785f17ebe`.
- Project `gn-scale-test`, generation
  `ada07be9-04be-47c7-a05a-0f7f779e8890`; transport stopped.
- Scratch track `gn-r05-browser`, channel ID
  `094143b4-b34f-45bc-b6ae-0dd3e2d2aaca`, independently confirmed empty.
- No competing probe driver was observed. The existing MCP bridge client
  (PID 84650) was left alone. One foreground client ran the experiment.

## Sequence and observations

The prescribed waits were 1,000 ms after opening, 180 ms after each later
operation, and 80 ms between paired status reads. Each pair had equal guards.
Observed elapsed times below include host scheduling and round-trip overhead
and are relative to the corresponding operation receipt.

| Operation | First / second read | Index / selected name | Result count | Audition |
|---|---:|---|---:|---|
| Open | 1,020.721 / 1,114.678 ms | 0 / empty | 95,764 | true |
| Disable audition after open | 189.128 / 283.275 ms | 0 / empty | 95,764 | false |
| Select `Devices` (index 0) | 189.303 / 280.115 ms | 0 / empty | 95,764 | false |
| Cancel | 188.100 / 283.271 ms | 0 / empty | 0 | false |

Cancellation read back `exists=false` and `owned=false` twice. The recorded
driver verdict is `content-type-unavailable`, with no completed scan
conditions and `identity=unproved`. Here “unavailable” means the required
confirmation was unavailable, not a universal capability verdict. There was
one content-type write and no retry or commit.

These are single-attempt observations, not stable latency measurements.

## Preservation and fallback

The scratch was removed. Before/after snapshots compare equal for 11 original
track rows, 10 scenes, 110 slot occupancy reads (25 filled), 16 top-level
devices, and recorded mixer fields. Mixer selection returned to `gn-sel`
(`6fb96670-abde-4958-9147-f573a4b43918`), and transport remained stopped.
These checks do not assert full note-content, device-state, or saved-file
equality. No note, parameter, or saved-file write was issued.

Use the existing sources:

- Exact stock-device names resolve through
  [the native catalog resolver](../../../brain/src/native-catalog/catalog.ts).
  Missing or duplicate names produce explicit failures rather than a guessed
  match. The checked-in catalog identifies its source build as 6.0.6; it does
  not claim exhaustive 6.1.4 coverage.
- VST3 and CLAP insertion requires explicit IDs.
- Bitwig presets use known `.bwpreset` paths. This result adds no host library
  search or custom-location name resolution. D22's vendor-preset exclusion
  remains unchanged.

The existing native-catalog tests pass, including exact-name ambiguity and
absence checks. Public tool count and descriptions remain 45 / v53.

## Reproduction and artifacts

- [Handshake transcript](../data/r05-browser/attempt-2/hello.log)
- [Ordered request/readback log](../data/r05-browser/attempt-2/events.jsonl)
- [Before](../data/r05-browser/attempt-2/before.json),
  [after](../data/r05-browser/attempt-2/after.json), and
  [result](../data/r05-browser/attempt-2/result.json)
- Frozen [session](../data/r05-browser/attempt-2/session.mjs) and
  [discovery sequence](../data/r05-browser/attempt-2/discovery-driver.ts)
- [Native-catalog test output](../data/r05-browser/attempt-2/catalog-tests.log)

Original invocation, from `brain/`:

```sh
node --import tsx ../context/evidence/data/r05-browser/session.mjs gn-scale-test ada07be9-04be-47c7-a05a-0f7f779e8890 ../context/evidence/data/r05-browser/attempt-2
```

A deliberate reproduction requires fresh admission and project/selection
checks, a newly observed generation, and a new output directory. Use the
frozen session path to retain this exact sequence. R05 does not request a
further live attempt.
