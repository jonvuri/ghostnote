---
title: E401 — P01 capability filtering and scope reuse in Bitwig
kind: evidence
updated: 2026-10-29
owner: P01
---

# E401 — P01 capability filtering and scope reuse in Bitwig

The P01 scope-read policy passed on Bitwig 6.1.4 / API 25 in `gn-scale-test`.
Complete structure matched with capability filtering enabled and suppressed.
All original track/device inventories and selected identities matched after
scratch cleanup. This proves the read policy and retained two-scope transfer;
it does not prove direct layer insertion or change the D44 composition budget.

## Deployment and admission

The operator's actual reply was “Controller replaced”, retained in the
[operator record](../data/p01-scope-policy-live/operator.json).
The [normal archive deployment](../data/p01-scope-policy-live/deployment.json)
has SHA-256 `43510221958623967cf287fd4e2baffbcc109bb3a2a7d761bee494d4de6433ab`.
The [handshake](../data/p01-scope-policy-live/hello.log) passed with fresh
initialization `2026-10-29T18:34:24.924Z`, `normal-v1`, 93 methods,
`d6decf985f6b1f36`, and policy marker `container-scope-lru-v1`. B17's paged
read, control, move and mutation markers also matched.

The driver checked project, selection, owned target and competing clients
before writes. The only other connected brain was this session's idle MCP
server, PID 58395; no competing probe driver ran. It created only the owned
`gn-p01-scopes` track, ID `21b44090-b088-4b77-9e32-aca85def5372`. No playback
launch or project save ran.

## Measurements

Both arms use the same new LRU extension. The suppressed arm strips only
`hasLayers` from `device.list` replies before the adapter consumes them; the
retained raw wire replies are unchanged. This measures capability-based
acquisition against the legacy fallback, **not an old-build LRU comparison**.
Each arm starts with scopes displaced to 0/1/2, then makes one cold and four
warm `read_devices` calls. Suppressed runs precede modern runs; order was not
randomized. Times include the public tool call. Turns and reply bytes exclude
driver preflight and scope displacement. Fixtures and timings are specific to
this session, not general latency bounds.

| Fixture | Cold ms, suppressed → modern | Warm median ms | Turns per call | Warm scope scrolls | Warm median reply bytes |
|---|---:|---:|---:|---:|---:|
| Three plain devices | 568 → 308 | 579 → 313 | 20 → 8 | 0 → 0 | 10,374.5 → 2,658 |
| Six devices; layer containers at 3/5 | 993 → 667 | 1,056 → 621 | 29 → 17 | 6 → 0 | 14,840.5 → 10,591 |
| Eight devices; containers at 3/5/7 | 1,205 → 811 | 1,293 → 733 | 35 → 20 | 8 → 0 | 17,456.5 → 12,154 |
| Eighteen devices; containers at 3/5/7/17 | 2,426 → 1,141 | 2,484 → 1,154 | 65 → 23 | 18 → 4 | 29,495.5 → 14,689 |

The three scopes retain three far containers. Four far containers still
require four scrolls per repeat pass; this is the measured capacity limit.
No scope count/width increase was made. Modern acquisition visits only layer
positions; suppressed acquisition visits every top-level position. Both return
identical complete public structures on every trial.

## Correctness and preservation

Independent `chain.observe` reads agreed with every top-level device's
`hasLayers`, name and index. Ring-Mod and Delay+ are named-slot devices with
`hasLayers: false`; capability filtering did not classify them as layer
containers. The fixtures included empty FX Layer seeds at 7 and 17.
All chain/device windows returned to zero. Retargeting a shorter different
track and then reacquiring the overflow fixture passed.

A cross-container move transferred EQ-5 from A at position 3 to C at 5.
Independent readback showed A empty and C containing Tool, EQ-5 in that order.
This exercises two retained endpoints under the changed reuse policy.

The scratch track was removed. The original eleven track records and each
track's complete public device structure matched the baseline. Mixer selection
remained `gn-sel`, index 8, ID `6fb96670-abde-4958-9147-f573a4b43918`; no
Launcher slot was selected. The
[final result](../data/p01-scope-policy-live/attempt-1/107-result.json) records
closed scopes, 364 aims, zero refusals and no write block. These preservation
claims concern the observed inventories and selection, not an exact saved-file
comparison or unobserved parameter state.

## Reproduction

The [driver](../../../brain/src/probes/p01-scope-policy-live.ts) and all
[raw exchanges and checks](../data/p01-scope-policy-live/attempt-1/) are retained.
After a fresh normal deployment, operator replacement and `probe:hello`, run
from `brain/` with a new output directory and a newly recorded operator file:

```sh
node --import tsx src/probes/p01-scope-policy-live.ts --out NEW_DIRECTORY --operator-file FILE --idle-client INSPECTED_PID
```

Reproduce the [summary](../data/p01-scope-policy-live/summary.json) offline:

```sh
python3 context/evidence/data/p01-scope-policy-live/summarize.py
```

Offline checks cover legacy/missing/incomplete capability fallbacks, LRU
rotation and held endpoints, clamped scopes and device-window settlement.
Live filtering does not replace those fallback tests.
