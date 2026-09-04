---
title: E97 — bounded settlement and nested ColourCopy reliability
kind: evidence
state: active
updated: 2026-09-03
parent: ../../plan/phase-5/5u-settlement-budget-and-nested-remote-reliability.md
---

# E97 — bounded settlement and nested ColourCopy reliability

## Verdict

One shared workflow policy now bounds equivalent parameter and remote observer
waits. Nested ColourCopy remote pages settle with exact generation and device
identity. Two free-running routes pass together on cold and warm wrapper runs.

## Cause

Four independent defects formed the timeout:

1. A nested remote callback required sibling equality at the callback instant.
   Bitwig can report this equality late even after the adapter confirms the full
   route. The extension now uses the confirmed final route index in this narrow
   state.
2. ColourCopy exposes one existing remote slot with an empty name. All other
   fields are valid. The adapter excluded this slot as a target but also treated
   the complete page as partial. It now accepts the page and still excludes the
   unnamed slot from public lookup.
3. Page and behavior witnesses repeated the same complete device inventory.
   Behavior witnesses now share one direct inventory, one supplementary remote
   inventory, and one read per sample round. Page witnesses share one inventory
   for each device.
4. A new controller instance could start with every remote observer on page 0.
   Bitwig did not apply several page selections sent in one bridge frame. The
   adapter now prepares each page in a separate frame before it reads the bank.

## Policy inventory

The effective limit includes the live adapter's inner acquisition when the
workflow calls `read()`. The adapter keeps its target-specific limit. The shared
workflow deadline bounds repeated complete reads and reports its own attempts.
It rejects observations that finish after the deadline. It does not interrupt
an in-flight adapter read.

| Path | Before | After | Cancellation and multiplication |
|---|---|---|---|
| Named write budgets | 24-4,000 ms from `SETTLE_MS` | Unchanged | These measured write delays have no general readback signal. |
| Device cursor target | 8 polls at 25 ms for each detour, descent, and pin | Unchanged | Each check has exact track, name, nesting, and index evidence. |
| DirectParameter acquisition | 3 generations; each waits 194 ms, then polls up to 80 times at 25 ms | Unchanged inside the adapter | One acquisition is target-specific. Workflow retries are now bounded below. |
| Remote-page acquisition | 3 generations; each waits 194 ms, then polls up to 8 times at 25 ms | Same limit, with separate page-prepare frames and the identity and unnamed-slot repairs | Each acquisition rejects stale generation, track, name, index, page, and bank state. |
| `verifyModulation()` | 3 reads at 200 ms for each witness | Shared 12,000 ms deadline, 250 ms retry, maximum 3 observations | Cancellation and elapsed time are checked before and after reads and waits. |
| Same-device behavior witnesses | Full inventory and eight samples for each witness | One direct inventory, one remote inventory, and one read per sample round | The wrapper no longer multiplies the inventory loop by its route count. |
| Same-device page witnesses | 3 reads at 200 ms for each witness | One shared-policy inventory per unique device | The wrapper no longer repeats identical page reads. |
| Wrapper parameter fingerprints | One adapter read | Shared 12,000/250/3 policy | Failure reports elapsed time, attempts, cause, and last progress. |
| General composition fingerprints | 40 reads at 250 ms; reversal used 80 | Shared 12,000/250/3 policy | The separate 10- and 20-second loops are removed. |
| General active verification | 3 outer retries around a 40-read inventory loop | One shared 12,000/250/3 verification | The 120-read worst case is removed. |
| Complete top-level device order | 20 reads at 200 ms | Unchanged | This is a structural bank read, not an observer generation. |
| Relocation and reorder readback | 8,000 ms deadline at 100 ms | Unchanged | These paths compare complete structural before-and-after state. |
| Chain activation and rename | 4,000 ms deadline at 100 ms | Unchanged | These paths verify chain identity and state, not parameter observers. |
| Selection restoration | 4,000 ms deadline at 25 ms | Unchanged | A miss does not hide a completed content write. Session 5w owns selection work. |

## Measurements and limit

The live Bitwig Studio 6.0.6 probe measured these complete ColourCopy reads:

| Case | Elapsed |
|---|---:|
| Cold top-level remote inventory | 1,092 ms |
| Warm top-level remote inventory | 968 ms |
| One forced stale generation, then fresh | 2,111 ms |
| Cold nested wrapper inventory | 1,098 ms |
| Warm nested wrapper inventory | 1,102 ms |

The 12-second deadline is 5.7 times the largest valid measurement. It also
allows three complete outer observations when one inner adapter read uses its
full target-specific acquisition budget. The three-attempt cap stops a
fast-failing observer before the deadline. A cancellation and deadline check
runs at every outer boundary. An advancing observer reports `attempt-limit` at
the cap. Only repeated identical progress reports `no-progress`.

## Live wrapper proof

The cold and warm runs each wrapped the same existing ColourCopy at top-level
position 2. The wrapper moved it to `FX Layer > Layer 1` and verified these
free-running routes together:

- LFO to `Frequency`: maximum divergence `0.1428101509809494` cold and
  `0.1499725878238678` warm.
- Classic LFO to `Stereo Phase`: maximum divergence `0.23464170098304749` cold
  and `0.24953317642211914` warm.

Both parameter bases had zero spread and no automation. All five ColourCopy
remote pages reported the fresh generation and nested device index 0. Each
wrapper returned `complete: true` only after both behaviors and both exact page
witnesses passed. The complete cold and warm wrapper calls took 50,677 ms and
50,409 ms. Their shared behavior-sampling windows took 9,230 ms and 9,257 ms.

Both reversals restored `Serato Sample | PITCHMAP | ColourCopy`, including the
enabled states. Cleanup also restored the exact seven-track entry list.

## Deterministic failure proof

Virtual-clock tests cover delayed success, stale-generation rejection, a late
completion, a never-complete deadline, a no-progress attempt cap, an advancing
attempt limit, and cancellation. Wrapper tests cover delayed initial inventory.
Batch tests keep settlement reports scoped to their witnesses. An incomplete
report contains elapsed time, attempt count, stop cause, and last progress. No
settlement test uses real-time sleeping.

## Verification

- `npm run probe:phase5u-settlement`: all live cases and exact cleanup pass.
- `npm run check`: 1,011 tests and type checking pass.
- `./gradlew test`: extension tests and assembly pass.
- `npm run probe:hello`: the running controller starts after the deployed JAR.

## Retrospective

A larger retry count would not repair a permanently unnamed remote slot.
Record completeness and identity separately. Share one observation across
same-device witnesses before increasing a deadline. A controller power toggle
can restart a cached extension class. Remove and add the controller, or expose a
build identity, before a live run claims that new JAR code is loaded. Check the
deadline after an awaited observation, and keep batch reports scoped to their
witnesses.
