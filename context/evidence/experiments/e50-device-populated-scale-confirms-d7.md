---
id: E50
kind: evidence
state: active
source: phase-4-session-4a
---

# E50 — Device-populated scale confirms D7 [K] (2026-08-20)

**Verdict: D7 holds on a 48-track, 384-device native fixture. Device density
adds cursor-sweep operation cost, but it does not add observer warm-up cost or
control-thread latency. The selected `256/128/8/16/64` scaffold is now the
repository default.**

## Method

The scratch project contained 48 created instrument tracks beside the four
default project rows. Each created row received zero, one, four, then eight
top-level native devices. Polysynth and Polymer alternated by row and device
position. Every created track was identified by `channelId` set difference.

Each device sweep pointed one cursor track at all 48 created identities. A row
was accepted only after its reply named the expected `channelId` and repeated
unchanged twice. Each reply reported the device-bank `itemCount`, visible count,
bank size, and attempt count. The maximum sweep accounted for all 384 devices.
No row was unstable or outside the device window.

All project measurements used a full track window. The `small-full-window`
control kept the former `3/8/16` cursor, device-bank, and parameter resources,
but used 64 tracks because the exact former 16-track window cannot observe a
52-row project. Separate controls changed only cursor pool, device bank, or
parameter handles. A combined 64-by-16 control isolated the larger track and
scene banks from the other D7 resources. The final control disabled direct
parameter observers at the full D7 candidate.

## Selected-candidate results

All times are milliseconds. Sweep time includes all 48 stable device-chain
reads. Project size is the saved `.bwproject` byte count.

| Devices per created track | Total devices | Construct | Init | Warm-up | Sweep | Ping p50/p95/max | Project bytes |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 0 | 73.4 | 85.7 | 124 | 3,495 | 23.75 / 24.89 / 25.28 | 134,221 |
| 1 | 48 | 154.0 | 171.3 | 107 | 4,424 | 23.85 / 25.33 / 29.60 | 696,974 |
| 4 | 192 | 81.7 | 96.2 | 119 | 4,550 | 23.71 / 25.08 / 25.16 | 2,382,422 |
| 8 | 384 | 129.7 | 159.7 | 123 | 4,559 | 23.67 / 24.90 / 25.21 | 4,629,686 |

Project density did not move warm-up or ping latency. It increased the complete
cursor sweep from about 3.5 seconds to 4.6 seconds. This is an operation cost:
48 sequential cursor-bound reads each wait for E22 stabilization. It is not an
init or continuous observer cost.

## Scaffold and observer controls

- Increasing only the cursor pool, device bank, or typed parameter handles did
  not produce a latency trend. The complete selected scaffold allocates 24
  device banks, 192 visible device slots, 64 typed parameter handles, eight
  remote parameter handles, and four direct-parameter observers.
- Moving from the combined 64-by-16 control to 256-by-128 raised the observed
  maximum init to 171.3 ms. Warm-up stayed between 107 and 124 ms. Ping p95
  stayed near the 24 ms control-surface tick floor.
- Disabling the four direct-parameter observers did not improve sweep or ping
  results consistently. At four devices, its p95 was 26.87 ms. At eight devices,
  it was 24.70 ms. Direct observers are not the load-bearing cost.
- Whole-JVM heap values varied with Bitwig and GC. They remain trend data only.

## Saved open and cold start

The selected maximum project reopened from disk with its 52 rows populated
below the recorder's sampling resolution. Maximum ping was 24 ms. No sample
exceeded 100 ms.

One cold start reported 339.1 ms of rig construction and 20 ms of post-init
bank settlement. The saved 52-row project then populated below sampling
resolution. Maximum ping was 24 ms, with zero stalls. The bridge outage was
66.2 seconds, but it includes an intentionally delayed second launch request.
It is reported as outage time and not as Bitwig application-start time.

## Harness findings

An in-place extension rewrite can expose a dying bridge that answers one ping,
then times out the next request. The probe now confirms four reads from one init
epoch and retries point and device reads by bounded attempts. These lifecycle
timeouts were reported. They were not scored as device instability.

The execution environment also stopped long foreground commands. Population
therefore became resumable and bounded by track. One pending insert landed after
a command stop and caused a duplicate Polysynth. The probe removed only that
surplus device by expected name, index, and track `channelId`, then continued.

## Cleanup and decision impact

Cleanup removed all 48 recorded tracks from high position to low. All four
scratch baseline identities remained. The original 42-byte `rig.json` was
restored with SHA-256
`5904a5eab06e6747b952f3504c178240ccff0833eef577d53bd89dfd27e3d704`.

The final Phase 2 baseline found that its earlier accepted live changes had not
been saved. After operator-authorized reconstruction and Save, the complete
7-track by 8-row baseline passed with all 14 clips and both accepted observation
links. This persistence repair did not change the scale result.

D7 is confirmed. `RigConfig`, the fake track, scene, and device windows, the E5
restoration probes, D7, and the bank capability page now agree on
`256/128/8/16/64`.

## Retrospective

Separate population from measurement and checkpoint population by durable row.
An asynchronous insert can outlive a process even after the bridge request
returns.
