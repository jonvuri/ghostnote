---
title: E347 — Filter-driven native browser discovery works
kind: evidence
state: active
updated: 2026-10-25
---

# E347 — Filter-driven native browser discovery works

## Result

On Bitwig 6.1.4, the public Controller API can select observed location-filter
rows and enumerate results without the disconnected content-type controls
identified in [E346](e346-browser-proxy-bindings-and-open-discovery-routes.md).
No mouse/keyboard automation, result selection, commit, or native-host call
was used. The operator approved this progression and confirmed the v3
controller replacement with “Controller replaced”.

| Observed location row | Result count | Scanned | Finding |
|---|---:|---:|---|
| `Devices`, index 14 | 46 | 46, complete | One exact `Polysynth` match at result index 11 |
| `Plug-ins`, index 117 | 92,018 | 4,096, incomplete | `Addictive Drums 2` at index 0; no global uniqueness claim |
| `My Library`, index 1 | 40 | 40, complete | User-library names include `gn-grid-spike-baseline` and `gn-preset-zoo` |

The location bank contains 1,466 entries. Each location was selected by its
exact observed first-page index and name under a full snapshot guard. Names
were unique on that 128-entry page; this is not a global location-name resolver
or a proof that the same label cannot occur elsewhere in the hierarchy.

Resetting existing filters independently read back their wildcard selections.
Each location selection reduced the 95,764-result reset view to the count
above. The complete four-entry device-type bank contained one `Instrument`
entry at index 2; selecting it read back as selected with its wildcard cleared.
That selection did not further change these result counts, so no additional
narrowing effect is claimed for it.

The plug-in branch includes device names followed by preset names. Discovery
therefore needs identity/type metadata before it can support a device resolver.
The public result interface still supplies no persistent IDs or preset paths.
The My Library names are not yet verified `.bwpreset` identities. Existing
catalog/explicit-ID/path tools remain the product fallback.

## Admission and attempts

- Probe archive SHA-256 `dfd99f19788fcb33d392179377a9d57b88028bb687b7bb40ab369e09a3b0c49e`,
  deployed `2026-10-25T16:29:55.290Z`.
- `npm run probe:hello` passed: API 25, `phase-8-probe-v1`, 119 methods,
  `9e75b9a8b3938491`, browser marker `r05-browser-discovery-v3`, Grid marker
  `9b-grid-doctor-v21`, initialization `2026-10-25T16:30:46.562Z`.
- Project `gn-scale-test`, generation `16733d0d-f226-4d96-980c-36c9a72d6319`,
  stopped transport and initial mixer selection `gn-sel`.
- No competing probe driver was observed. The existing connected MCP client
  (PID 84650) was left alone. One foreground driver ran each attempt.

Attempt 3 stopped after successful reset: the location bank's `itemCount`
was 1,466, exceeding the driver's preliminary 1,024-entry enumeration bound.
The column's `entryCount` was zero despite a populated bank. The popup was
canceled and scratch `4c363bc5-e125-4357-8221-be42968356d2` removed; preserved
inventories matched. No filter row was selected in that attempt.

After inspecting that result and cleanup, attempt 4 used concrete observed
first-page rows instead of requiring global location-name uniqueness. It used
the same deployed v3 handler, with a revised driver and a new owned scratch
`582ad63f-b5b4-427e-aa4a-59c119cd2ab0`. It produced the table above and canceled.
This was a revised condition after a known bound refusal, not a retry of an
uncertain selection or commit. Frozen sources preserve both conditions.

Open/reset waits were 1,000 ms; other updates used 180 ms plus 80 ms between
independent reads. These remain research waits, not measured latency promises.

## Preservation and artifacts

Both attempts verified scratch removal, closed/unowned popup, stopped
transport, restored mixer selection, and equal before/after inventories:
11 original track rows, 10 scenes, 110 slot occupancy reads (25 filled),
16 top-level devices, and mixer fields. No full note-content, device-state,
or saved-file equality claim is made.

- Attempt 3: [events](../data/r05-browser/attempt-3/events.jsonl),
  [result](../data/r05-browser/attempt-3/result.json),
  [before](../data/r05-browser/attempt-3/before.json),
  [after](../data/r05-browser/attempt-3/after.json),
  frozen [session](../data/r05-browser/attempt-3/session.mjs) and
  [sequence](../data/r05-browser/attempt-3/discovery-driver.ts).
- Attempt 4: [events](../data/r05-browser/attempt-4/events.jsonl),
  [result](../data/r05-browser/attempt-4/result.json),
  [before](../data/r05-browser/attempt-4/before.json),
  [after](../data/r05-browser/attempt-4/after.json),
  frozen [session](../data/r05-browser/attempt-4/session.mjs) and
  [sequence](../data/r05-browser/attempt-4/discovery-driver.ts).

Commands from `brain/`, in order (each output directory must be new):

```sh
node --import tsx ../context/evidence/data/r05-browser/session.mjs gn-scale-test 16733d0d-f226-4d96-980c-36c9a72d6319 ../context/evidence/data/r05-browser/attempt-3
node --import tsx ../context/evidence/data/r05-browser/session.mjs gn-scale-test 16733d0d-f226-4d96-980c-36c9a72d6319 ../context/evidence/data/r05-browser/attempt-4
```

Use frozen sources for those exact conditions; the current driver may advance
to metadata research. Fresh admission and current target/selection checks are
required for future runs. No device insertion route is accepted by this record.
