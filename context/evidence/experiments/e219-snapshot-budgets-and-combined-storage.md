---
title: E219 — Snapshot budget equality, excess, and combined storage
kind: evidence
state: active
updated: 2026-10-03
parent: ../../plan/phase-8/8g3-snapshot-and-global-budgets.md
---

# E219 — Snapshot budget equality, excess, and combined storage

## Result

The selected 16 MiB snapshot estimate passes live equality and excess. At
exactly 16,777,216 estimated bytes, a clip with 8,128 notes publishes a match
with independent settled authority. One note changed by two estimated bytes
refuses with `snapshot-memory-budget`. No earlier limit fires. Excess retains no
candidate and no current snapshot. A separate TypeScript oracle computes the
same estimate from the authority notes and metadata in every comparison.

Two residents share one snapshot domain. Each overlap refuses, and an eviction
followed by an explicit new attempt recovers. Retirement during enrichment
releases the partial candidate, and explicit recovery matches. Bridge ping p95
under this workload is 25.06 ms. All results stay `complete:false` and
`eligible:false`. Heap and host memory are not measured.

| Arm | Step | Outcome | Estimate (bytes) |
|---|---|---|---|
| Boundary | Equality | match | 16,777,216 |
| Boundary | Excess | `snapshot-memory-budget` | 16,777,218 by oracle |
| Boundary | Equality restored | match | 16,777,216 |
| Combined | Second clip with first retained | `snapshot-memory-budget` | 16,777,216 retained |
| Combined | Second clip after eviction | match | 134,014 |
| Combined | First clip with second retained | `snapshot-memory-budget` | peak 16,643,056 + 134,014 retained |
| Combined | First clip after eviction | match | 16,777,216 |
| Interrupted | Retirement during enrichment | `window-changed`, candidate released | partial 2,114,560 |
| Interrupted | Explicit recovery | match | 16,777,216 |

## Implementation under test

Build marker `8g3-shadow-budgets-v2`, definition version `e219-2`. The
[core](../../../extension/src/main/java/com/ghostnote/extension/ShadowProjectCache.java)
acquires a snapshot through a private candidate. Each enrichment batch reads at
least one coordinate and stops at its budget (40 ms in the adapter, 50 ms hard
limit). The candidate deadline is the selected 5 s replay limit. Each batch and
the final publication check the binding token, invalidation sequence, zero
dirty work, eligibility, deadline, and snapshot budget. A callback, eviction,
project change, rebuild, ping excess, supersession, or explicit cancellation
retires the candidate at once and releases its estimate. A new candidate first
drops the entry's retained snapshot. A replaced snapshot with other coverage
advances the content generation conservatively.

The [adapter](../../../extension/src/main/java/com/ghostnote/extension/ShadowCacheProbe.java)
runs one enrichment batch per poll inside the confirmed result window. It
reports phase start times, host work, the candidate status, and one resource
ledger (`resourceAccounting`). A research control caps coordinates per
enrichment batch so that a test can stop partial work. The cap never widens a
limit.

## Accounting boundary

One ledger reports every cache-owned estimate. Each domain has its selected
limit; equality passes. No combined limit is selected.

| Domain | Parts | Limit |
|---|---|---|
| Recorder | Resident recorders, rebuild staging recorders, physical hint queues (56 bytes per hint) | 16 MiB |
| Snapshot | Retained snapshots and the private candidate | 16 MiB |
| Authority | Comparison oracle staging or exact-fallback buffer; only one is active | 16 MiB |
| Registry | Current inventory attempt bookkeeping | 16 MiB |
| Identity | Identity and witness text for all entries, including staging | Reported only |

The old retained snapshot, staging, authority, recorder, and candidate are
summed at the same time. Estimates cover cache-owned records and canonical text.
They exclude JVM object overhead, transient copies, host objects, and JSON
output. Serialized response bytes are output measurements only.

## Selected limits

| Limit | Selected | Measurement and domain | Equality and excess | Evidence |
|---|---|---|---|---|
| View width | 131,072 steps | Request width, per request | Passes; `view-width-limit` | Model; live width 2,048 only |
| Active observers | 512 | All experimental StepData observers | Passes; `combined-observer-budget` | Model and Rig admission test; live 7 |
| Occupied per clip | 2,048 coordinates | Sparse occupied set | Passes; `clip-density-limit` | E214 live 2,048 match and 2,049 overflow |
| Pending dirty | 2,048 coordinates | Cache dirty plus physical hints | Passes; backpressure, then rebuild | Model; live boundary unverified |
| Recorder storage | 16 MiB estimate | Recorder domain | Passes; `memory-budget`, shed residence | Model equality and excess with hint queues; live 28,704 bytes |
| Snapshot storage | 16 MiB estimate | Snapshot domain | Passes; `snapshot-memory-budget`, nothing retained | Model and live equality and excess (this record) |
| Authority staging | 16 MiB estimate | Authority domain | Passes; `authority-staging-memory-budget` | Model; live boundary unverified |
| Construction | 50 ms | Shadow bank construction | Passes; `cache-construction-budget` | Live 1.43 ms |
| Host-work batch | 50 ms | One reconciliation, authority, or enrichment batch | Passes; budget refusal | Model; live enrichment batches ≤ 40 ms |
| Binding replay | 5 s | Binding, replay, and candidate deadline | Passes; budget or `enrichment-deadline` | Model; live replay 1.51 s |
| Scan and rebuild | 40 s | Comparison, exact scan, rebuild | Passes; budget refusal | Model; live comparisons 2.3–3.0 s |
| Ping p95 | 50 ms | Client bridge ping p95 | Passes; `tail-latency-budget` | Live 25.06 ms under load |

Recovery for every refusal is an explicit new attempt after the cause is
removed. A missing or invalid measurement refuses.

## Method

The [driver](../../../brain/src/probes/e219-snapshot-budgets.ts) uses one owned,
unsaved project, `New 10`, with clips on track 0: A in slot 0, the canary in
slot 1, and B in slot 2. Configuration: two shadow observers, 2,048-cell
coverage, lifecycle and delivery research. Each comparison reads all 4,194,304
authority coordinates and channels.

Calibration writes one note for each velocity 1–127. The
[oracle](../../../brain/src/probes/e219-snapshot-budgets-lib.ts) computes each
note cost from the authority values. A
[Java-built golden](../data/e219-snapshot-budgets/java-estimate-golden.json)
checks the oracle offline. Live calibration agrees with the Java estimate. The
solver picks velocity 1 (2,064 bytes) and velocity 5 (2,062 bytes): 7,553 plus
575 notes on a base of 2,174 bytes reach 16,777,216. The host stores velocity
1 as `0.007874015718698502`, not `1/127`; the oracle uses the acquired value.
Excess changes one velocity-5 note to velocity 1. The independent field oracle
checks each written note, velocity class, and full field set against authority.
Each match also compares snapshot notes with authority notes in TypeScript.

## Costs

| Quantity | Scope | Value |
|---|---|---|
| Comparison wall time | One comparison | 2.31–2.96 s |
| Phase start, authority reads | From scan start | 1.92–1.98 s |
| Phase start, enrichment | From scan start | 2.20–2.51 s |
| Authority host work | One comparison | 133–290 ms |
| Enrichment host work | One comparison | 0.1–69 ms in 1–2 batches |
| Bridge requests | One comparison, driver | 94–104 |
| Response bytes | One comparison, driver | 0.36–9.33 MB |
| Bridge requests and bytes | Whole run | 1,703; 50,989,382 |
| Ping | 724 samples under load | median 23.13 ms, p95 25.06 ms, max 25.99 ms |
| Public tool calls; agent delay | Driver only | 0; unmeasured |

No step-window change occurred during any comparison. Writes run between
comparisons, so the step-window effect of concurrent edits under load stays
unmeasured. Compared with E214 (12 s per comparison), this build is faster.
Both runs are bounded single-fixture measurements.

## Diagnostic run

[Run 1](../data/e219-snapshot-budgets/run-1-diagnostic.json.gz) used build
v1. Boundary and combined arms gave the same results. Enrichment finished in one
warm 36 ms batch, so the driver could not interrupt partial work. Build v2 adds
the batch cap; run 2 is the accepted run.

## Limits

The estimate is a source model; it is not heap. Only the snapshot domain reaches
its boundary live. Recorder, authority, pending, width, and observer boundaries
stay model-only or earlier evidence. The fixture has one owned project and two
residents. Inventory publication still refuses live. D26 and E217 remain named
assumptions. Nothing is eligible.

## Restoration

The driver cleared all owned notes and deleted the three owned clips. The user
closed `New 10` without saving. The rig config is restored to its exact entry
bytes (SHA-256 `256bbf07…43b0`). The normal controller is fresh: hello passes
with 85 methods, hash `bba7383dce25c0f0`, init `2026-10-03T02:23:49.735Z`. The
`New 1` API state equals the entry capture: tracks, scenes, scan, 32 empty
slots, selection, cursors, and the method table. The 8g controls archive is
removed by exact path. `New 1` stays open and unsaved.

## Artifacts

| File | SHA-256 |
|---|---|
| `config-research.json` | `26d4b7998ce51e9833501f0fd93950dff75aba5d9b602e217f7a5b035a33c152` |
| `entry-baseline.json` | `57e66f1863d42c372a51ad225563427384ae75e964351870e77bcf3bf8500ade` |
| `fixture-state.json` | `aa52cce50466f39fceff245aba64da671df81ee91d43eee49dd5299175cd3784` |
| `java-estimate-golden.json` | `d3aecfd594c3696745e6b83b2130b3f6594a955c31ea2bfb5791b336baeece42` |
| `run-1-diagnostic.json.gz` | `e25c38476dd1ad4530f0e19bf292600a6f47e4d59a66a19094ab9f8e701eb784` |
| `run-2.json.gz` | `ad1b13db4e6ede9c2e86e579874c69f11270f7a2d90ed02f2c4a079a12ffabe1` |

Brain tests verify run 2, eleven report mutants, and the run 1
diagnostic scope. Run `node --import tsx src/probes/e219-snapshot-budgets.ts
verify ../context/evidence/data/e219-snapshot-budgets/run-2.json.gz` from
`brain/`.
