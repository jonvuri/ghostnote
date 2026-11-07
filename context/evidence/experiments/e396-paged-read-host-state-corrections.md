---
title: E396 — Paged reads encounter nonlocal layer indices and stale non-layer bank counts
kind: evidence
state: active
updated: 2026-10-27
owner: B17
---

# E396 — Paged reads encounter nonlocal layer indices and stale non-layer bank counts

B17 session 2 is **not yet accepted live**. The corrected `paged-windows-v2`
build reads the original four-chain fixture completely, but a scratch track
exposed another host-state assumption: a scope aimed at a non-layer Tool
retains the preceding FX Layer's `itemCount` of five. The v3 correction skips
layer paging when the settled device explicitly reports `hasLayers=false`.
It is deployed and passes offline checks; replacement and live verification
remain pending. No overflow latency or complete 17/6/5 read is claimed here.

## Running build and baseline

The operator's second reply was **“Controller replaced”**. The
[handshake](../data/b17-paged-reads/attempt-2/hello.log) passed: normal profile,
API 25, 93 methods, hash `d6decf985f6b1f36`, marker `paged-windows-v2`, fresh
initialization `2026-10-27T12:14:28.957Z`, no write block. Archive SHA-256:
`c8cddb6907d8020263194a7fb1e6ff4692db91f777119ab80ca868d5fbc6e603`.
Bitwig was 6.1.4, project `gn-scale-test`, eleven tracks and ten scenes.
One pre-existing MCP client (PID 46491) was left alone; no competing
foreground probe was present. Fresh local drivers used the current brain.

The [baseline](../data/b17-paged-reads/attempt-2/baseline.json) reads `gn-lay4`
through `LiveAdapter.read(..., {structure:true})` and then raw
`chain.inventory`. Phase-4, Polysynth, Organ, and Sampler are complete;
selection is unchanged and the refusal latch is clear. Their raw
`reportedChannelIndex` values are **50, 51, 52, 53**, not 0–3. This directly
supports removing v1's local-index predicate. It does not establish that
these values were identical in the earlier controller instance. The
[first attempt artifacts](../data/b17-paged-reads/attempt-1/) retain the v1
track-arrival refusal and false restoration latch; the brief records those
corrections.

## Scratch fixture and stale count

The [fixture action results](../data/b17-paged-reads/attempt-2/fixture-actions.json)
record a new `gn-b17r` track, ID
`9e4acdaf-a7bf-48b6-85e0-b5747a6ffaa8`. Product tools composed one FX Layer,
duplicated A into E/D/C/B, copied B's Tool into A three times, and appended
fifteen top-level Tools. The resulting shape was sixteen top-level devices,
container at position zero, five chains, four devices in A, one in each
other chain. All applied writes had independent product readback. Two
requests refused at input with no effects: copying into the source chain
and moving a top-level device to track-end. Neither was repeated.

A preparatory `read_devices` before a supported reorder then became slow.
[Concurrent read-only diagnostics](../data/b17-paged-reads/attempt-2/stale-layer-count.json)
show scope 2 settled at position 9, `deviceName=Tool`, `hasLayers=false`, no
visible chains, but `chainCount=5`. Scope 1 shows the same inconsistency.
The pager was waiting for five existing layer handles despite the settled
parent having no layers. The owned driver was cancelled during that first
read, before any reorder call. The host task subsequently released its
lease; [settled diagnostics](../data/b17-paged-reads/attempt-2/settled-after-cancel.json)
show zero leases and waiters, no open scope, no write block, and all raw
layer and nested device windows at zero. No UI edit or overflow write ran.

The v3 change returns an empty, complete layer inventory with zero pages
for an explicit Boolean `hasLayers=false`. It retains the settled device
identity and named-slot completeness; real layer containers and unknown
capabilities still take the guarded paging route. `ContainerPagingTest`
covers the captured stale-count shape, named slots, and unknown types.
`./gradlew check` passes, including this regression and the pager harness.
The normal profile's methods and hash are unchanged. `copyExtension`
deployed v3 around `2026-10-27T12:27Z`, archive SHA-256
`081cdbb46b410bb651f3f01cb3af436b32fb75d1285c3fcff5f03db0624813f7`.

## Cleanup and next check

The owned scratch track was deleted through `delete_track` and independently
confirmed absent. [After cleanup](../data/b17-paged-reads/attempt-2/after-cleanup.json),
the eleven original tracks and complete `gn-lay4` entries match the baseline.
[Preservation comparison](../data/b17-paged-reads/attempt-2/preservation.json)
confirms mixer selection remains on `gn-sel` at index 8, no Launcher slot is
selected, and project identity is unchanged. The selection revision advanced
from 1 to 3 during fixture creation/restoration; this is not an exact revision
preservation claim. There is no remaining scratch object or write block.
No saved-file preservation claim is made.

After normal **ghostnote** replacement, run `npm run probe:hello`, require
`paged-windows-v3`, and repeat a container-to-non-layer read before the
17-device / six-chain / five-device acceptance case. Build fifteen Tools
before the container so no top-level reorder is needed. Ordinary Bitwig
edits can create the three overflow boundaries while product write caps
remain in place; the acceptance driver itself remains read-only. Remove
owned scratch objects after the check. Session 3 remains deferred.
