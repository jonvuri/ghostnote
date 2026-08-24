---
id: E81
kind: evidence
state: active
source: dogfooding-d02-session-6
---

# E81 — Exact-name native insertion is live [K] (2026-08-23)

**Verdict: one public exact-name call now appends `Polysynth` and `Delay+` as
two top-level native devices. Both devices read back exactly and reverse under
complete top-level guards.**

## Public path

`add_native_devices` accepts one durable track ID and one through 16 ordered
native-device catalog names. It exposes no UUID, preset, file, asset, Layer, or
selection control. The runner resolves all requested names before the first
write. It then reads the complete top-level names and enabled states before each
append.

Each insertion carries the resolved UUID and expected catalog name through the
typed `device.insert` path. Independent complete readback must prove the exact
name, position, order, and enabled state. The result returns one receipt and one
position per device. Reversal removes devices in reverse order and checks the
complete last-proved top-level fingerprint. A changed chain blocks removal.

Exact-name resolution now returns every absent or non-unique caller input in
`failedDeviceNames`. Drum Machine composition uses the same resolver and
diagnostic.

## Correctness repairs

Explicit `add_device` Bitwig IDs must now use the lowercase canonical UUID form.
The public schema and source conversion reject another string before the
adapter. The live encoder repeats the check before it emits a frame.

`add_device` now derives `partialSuccess` only from an insertion that returned
one proved position. A failed first stage with no minted device returns
`applied: false`, `partialSuccess: false`, and `added: []`.

## Offline proof

Catalog, schema, fake, live-adapter, encoder, public-surface,
failure-classification, and guarded-reversal regressions pass. The complete
brain check passes 867/867. Extension tests pass.

The public description cohort is `ghostnote-description-v11`. It contains 47
tools. The exact-name schema uses only `trackId` and `deviceNames`.

## Live proof

The focused MCP proof ran against Bitwig Studio 6.0.6 and host API 25 in project
`New 3`. Its entry mark was project revision 146 and content epoch 32774. It
created one owned empty track and called `add_native_devices` once. Complete
readback returned this top-level chain:

1. `Polysynth`, enabled, position 0.
2. `Delay+`, enabled, position 1.

Both insertions returned exact positions and separate change IDs. Reversal
removed `Delay+` first and `Polysynth` second with no failure, omitted state, or
positional caveat. Final readback proved the owned track empty. Cleanup removed
the track and restored the exact five-track entry list.

MCP `tools/list` returned 47 tools and the compatible exact-name schema. The
fresh handshake passed with 148 methods and hash `eb3391803ef4eea4`. Deploy
freshness passed.

## Retrospective

Carry the resolved catalog name with the typed insertion. The name lets the fake
and live adapter prove completion and lets reversal build the complete guard.
