---
title: Cache scale limits and degradation policy
kind: reference
state: active
updated: 2026-09-25
parent: ../../plan/phase-8/8e-cache-scale-limits-and-degradation.md
evidence: E131, E134, E138, E139; D23
---

# Cache scale limits and degradation policy

## Scope

These limits apply to the future internal persistent clip cache. They do not
limit exact reads. They do not define public compact-bar syntax. Phase 8g owns
the cache implementation.

The stable E131 reader remains the authority. A cache result is usable only
when its identity, coverage, replay, and dirty-work state are complete.

## Selected limits

| Resource | Product limit | Meaning and measured headroom |
|---|---:|---|
| Cached view width | 131,072 steps | 256 beats or 64 bars of 4/4 at the D23 `1/512` grid. Exact boundary reads passed through 1,048,576 steps, which gives 8x technical headroom. |
| Active clip observers | 512 | Pipelined replay took 8.813 seconds at 512 observers. The 768-observer arm stayed exact in 11.535 seconds and gives 1.5x count headroom. |
| Occupied coordinates per cached clip | 2,048 | The neighboring 2,000-coordinate arm reconciled two views in 31.7 ms. The 4,000-coordinate arm took 68.7 ms and crossed the 50 ms host-work budget. The 8,192-coordinate arm stayed exact. |
| Pending dirty coordinates | 2,048 total | A 1,024-coordinate mutation in two views produced 2,048 dirty coordinates and reconciled in 15.5 ms. The 4,096-coordinate arm produced 8,192 dirty coordinates and took 67.2 ms. |
| Sparse recorder storage | 16 MiB | One membership is estimated at 56 bytes. The storage limit is independent of the observer limit. It reduces the resident set when clips are dense. |
| Cache-bank construction | 50 ms | Construction took 38.949 ms at 512 observers and 59.057 ms at 768. The zero-observer base rig took 51.970 ms, so this budget does not include other extension construction. |
| One binding replay | 5 seconds | The extreme 8,192-coordinate clip completed callbacks in 2.32 seconds. |
| Working-set rebuild | 40 seconds | Pipelined 512-view replay took 8.813 seconds. The 768-view arm also passed in 11.535 seconds. |
| Bridge ping p95 | 50 ms | Measured steady p95 stayed between 24.8 and 28.1 ms in retained arms. |

The limits are budgets, not host maxima. A passing larger value does not widen
the product contract.

## Working-set policy

The cache can bind at most 512 clip observers. The project can contain more
clips and more addressable slots. The cache keeps a bounded resident set of
occupied clips. Empty slots do not consume a clip observer.

The value 512 is a product limit, not a host maximum. Replay and ping stayed
healthy at 768 observers. However, the 768-observer cache bank took 59.057 ms
to construct and exceeded the 50 ms budget. A later increase requires new
construction, exact replay, tail-latency, and dirty-work evidence.

A non-resident clip uses an exact authority read. It can enter the resident set
only after an old binding is invalidated, its callback generation is retired,
and the new binding completes replay. An eviction cannot make a clip appear
empty. It changes the read mode to `exact-fallback` until the new entry is
complete.

The final measured project had 1,024 addressable slots across 32 tracks and 32
scenes. It had 768 occupied clips and 256 empty slots. The selected 512-observer
working set stayed exact in this layout. The 16 MiB storage budget applies at
the same time. For example, 512 clips at the maximum 2,048-coordinate density
would need about 56 MiB, so that combination must use a smaller resident set.

## Health and read policy

| Health | Cache read | Required behavior |
|---|---|---|
| Complete | Allowed | Publish one immutable snapshot for the declared coverage. |
| Warming | Not allowed | Use an exact read. Keep replay state private. |
| Dirty | Not allowed for affected state | Use an exact read. Reconcile within budget or schedule a rebuild. |
| Rebuilding | Not allowed | Use an exact read. Publish only an atomic complete generation. |
| Invalid | Not allowed | Drop the entry or registry and use an exact read. |

If the exact authority is also unavailable, the read must refuse. It must name
`authority-unavailable`. It cannot return partial cache state.

## Overflow and backpressure

Each over-limit condition has one visible result:

| Condition | Health | Result |
|---|---|---|
| View exceeds 131,072 steps | Invalid for cached coverage | Exact read |
| More than 512 clips need residence | Non-resident for excess clips | Exact read for each excess clip |
| Clip exceeds 2,048 occupied coordinates | Invalid for that cached clip | Exact read |
| Estimated cache storage exceeds 16 MiB | Invalid | Drop cache state and use exact reads |
| Pending dirty work exceeds 2,048 coordinates | Dirty, then rebuilding | Stop accepting callbacks, retire their generation, and use exact reads |
| Replay exceeds 5 seconds | Warming | Use exact reads; retry or rebuild in the background |
| Rebuild exceeds 40 seconds | Rebuilding | Keep staging private and use exact reads |
| Ping p95 exceeds 50 ms | Invalid until rechecked | Shed cache load and use exact reads |
| Generation, identity, or authority check fails | Invalid | Use an exact read or refuse if authority is unavailable |

Load shedding does not drain old callbacks into a new entry. It increments the
binding or rebuild generation, rejects late callbacks, completes one fresh
authority rebuild, and publishes only after settlement. E139 rejected all 512
late callbacks in its shedding arm and rebuilt an exact 512-coordinate paired
state.

## Required status

A cache status must expose these fields to internal callers and diagnostics:

- health and read mode;
- reason code, measured value, and selected limit;
- project, structural, content, binding, and rebuild generations;
- declared width and normalized grid;
- active, resident, warming, dirty, and rejected-callback counts;
- occupied and pending coordinate counts;
- estimated extension-owned bytes;
- cache-bank construction, replay, rebuild, and ping-tail measurements; and
- exact-authority availability.

The public musical document must not expose observer handles, dirty queues, or
proxy indices. It needs only a complete coverage declaration or a refusal.

## Executable policy boundary

`brain/src/contract/cache-policy.ts` implements the admission decision. It
returns `cache`, `exact-fallback`, or `refuse` with a reason. It does not
implement or ship the cache. Phase 8g must use this policy at the shadow-cache
boundary and must compare every admitted result with E131.
