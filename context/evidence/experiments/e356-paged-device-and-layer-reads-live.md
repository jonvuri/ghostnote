---
title: E356 — Complete paged reads of eighteen devices, six chains, and five nested devices
kind: evidence
state: active
updated: 2026-10-27
owner: B17
---

# E356 — Complete paged reads of eighteen devices, six chains, and five nested devices

## Result

**B17 session 2 is verified live.** On Bitwig 6.1.4 / API 25, the normal
`paged-windows-v3` build reads eighteen top-level devices, including an FX
Layer at position 17, all six layer chains, and all five devices in chain A.
Public `read_devices` reports complete coverage; a repeated read has identical
data. Raw reads show two top-level pages, two chain pages, and two device
pages for A (seven device pages across all six chains). The raw nested
windows return to zero, selection is preserved during acceptance, and no
refusal latch remains. The owned scratch track was removed and the original
track list and four-chain fixture match their baseline.

This is an eighteen-device live case, rather than the brief's proposed
seventeen-device fixture. Both cross the 16-wide boundary in two pages;
offline conformance and the pager harness retain the exact seventeen case.
Write paging and width-cap retirement remain B17 session 3.

## Build and entry checks

The operator replied **“Controller replaced”**. The retained
[handshake](../data/b17-paged-reads/attempt-3/hello.log) passes: `normal-v1`,
93 methods, hash `d6decf985f6b1f36`, marker `paged-windows-v3`, initialized
`2026-10-27T13:09:49.749Z`, after deployment. Archive SHA-256:
`081cdbb46b410bb651f3f01cb3af436b32fb75d1285c3fcff5f03db0624813f7`.
Resources still include 229 paging-marked values and no newly allocated banks.
One pre-existing MCP client (PID 46491) was left alone. Fresh local drivers
and UI actions ran sequentially; no competing foreground probe was present.

The [baseline](../data/b17-paged-reads/attempt-3/baseline.json) confirms
`gn-scale-test`, eleven tracks, ten scenes, mixer selection on `gn-sel`, no
Launcher slot, and the original `gn-lay4` chains. The E355 non-layer fix also
passes live: an explicit `chain.observe` of the scratch container at 15,
then Tool at 14, returned zero chains and zero pages in about 50 ms, instead
of waiting on the stale count. Its exchange is in the fixture action record.

## Fixture preparation and acceptance

[Product action results](../data/b17-paged-reads/attempt-3/fixture-actions.json)
identify the owned `gn-b17r` track as
`2c494622-de74-4d56-804e-7a40127afc47`. Product tools built sixteen top-level
devices, container at 15, five chains A/E/D/C/B, with four Tools in A and one
in each other chain. A composition attempt with fifteen preceding Tools
refused before writing because its existing reversal path needs another
scratch slot. Setup removed the last owned Tool, composed at 14, appended
one Tool, then moved that Tool before the container. No product admission
limit was changed.

Ordinary Bitwig UI edits crossed the remaining boundaries. A top-level
shortcut duplication added two Tools; independent readback established
eighteen devices and the container at 17. That valid overflow was retained.
A layer shortcut had no effect, confirmed by readback. The container's plus
control and native Tool browser then added the sixth chain (named `Tool`).
Chain A's inspector plus control inserted its fifth Tool. An intermediate
click changed invert-left on an owned scratch Tool after bridge navigation
changed the panel layout; it had no bearing on inventory, and the complete
scratch track was removed afterward. No uncertain action was blindly repeated.
The [UI readbacks](../data/b17-paged-reads/attempt-3/ui-readbacks.json) preserve
the intermediate top-level and six-chain inventories.

Mixer selection was restored to `gn-sel` before the read-only driver:

```sh
cd brain
node --import tsx src/probes/b17-paged-reads-live.ts --out NEW_DIRECTORY --devices 18
```

[Acceptance records](../data/b17-paged-reads/attempt-3/acceptance/) contain the
public result, isolated `chain.observe`, raw `chain.inventory`, repeated
public result, selection comparison, exit diagnostics, and passing result.
Chains are A [five Tools], E/D/C/B/Tool [one Tool each]; indices are contiguous
and complete. The container at 17 proves aiming beyond the reference bank.
Raw chain and child-device windows are zero after traversal. Top-level
restoration is enforced by the operation before its successful reply and
covered by the pager harness; no separate raw top-bank-position field is
exposed. This evidence does not claim an independent raw top-position read.

## Costs and reproduction

These are local observations, not latency guarantees. All page traversal and
restoration happen inside each deferred extension operation.

| Read | Wire turns | Measured time |
|---|---:|---:|
| Full public `read_devices`, eighteen devices / six chains / five in A | 65 each | 2,607 ms first, 2,576 ms repeat |
| Isolated `chain.observe`, scope already aimed at 17 | 1 | 383 ms, one sample |
| Isolated adapter structure read at 17, scope first moved to Tool at 14 | 6 each | median 505 ms; range 500–511 ms, five trials |
| One `device.list`, eighteen devices / two overlapping pages | 1 each | median 144 ms; range 141–145 ms, five trials |

[Timing records](../data/b17-paged-reads/attempt-3/timings/) retain raw results
and adapter wire exchanges. To repeat the adapter measurement, warm one
`LiveAdapter.read` of device 17 with `structure:true`; before each of five
trials, send `chain.observe {position:14, expectedTrackChannelId}`; time the
next adapter structure read of 17 and count its transport calls. Then time
five `device.list {cursor:0}` calls with that same track held. The setup
navigation is outside each timed interval. Session-1 E354 timings describe
a smaller single-page fixture and must not substitute for these costs.

## Cleanup, preservation, and verification

`delete_track` removed the owned scratch ID with independent readback.
[After-cleanup data](../data/b17-paged-reads/attempt-3/after-cleanup.json) and
[comparison](../data/b17-paged-reads/attempt-3/preservation.json) show the same
eleven tracks and complete `gn-lay4` entries as before setup. Mixer selection
is `gn-sel` at index 8; no Launcher slot is selected. The selection revision
advanced from 1 to 5 during setup/UI restoration, then stayed unchanged
through acceptance and cleanup. No open scope or write block remains. No
playback launch or project save was performed; saved-file equality and exact
UI-panel preservation are not claimed.

The prior implementation and corrections passed the full brain suite,
focused adapter/call-budget checks, extension checks, and paging regressions
as recorded in the brief and E355. This continuation changed only the
read-only driver's fixture-size option and exit assertions; brain typecheck
passes. The live checks above verify the deployed code without another build.
