---
title: Phase 8b — Runtime and surface cleanup foundation
kind: plan
state: complete
status: The lean normal, capture, and probe runtime profiles are live and measured.
updated: 2026-09-25
parent: README.md
prev: 8a-agent-native-product-and-interface-audit.md
next: 8c-compact-bar-prior-art-and-benchmark.md
evidence: E7, E119, E126, E127, E134, E136; agent-native interface audit; D13
---

# Phase 8b — Runtime and surface cleanup foundation

## Purpose

Establish a lean product and measurement baseline before cache scale work.
Reduce the normal extension to the wire methods and preallocated Bitwig objects
that the product needs. Preserve active experiments behind an explicit probe
boundary.

Apply only the surface reductions that 8a identifies as clear prerequisites.
Keep the broader interface migration for 8h, after the replacement cache and
compact document exist.

## Scope

Use the [6i probe disposition](../../evidence/format/WORKSTATION_INTERFACES.md)
as the starting inventory. Apply the
[8a disposition](../../evidence/format/AGENT_NATIVE_INTERFACE_AUDIT.md) and
reconcile it with all Phase 7 methods. Extraction and retained regression status
do not require the complete probe runtime in a normal product build.

1. Inventory every registered extension method against `WIRE_METHODS_USED`.
2. Map every preallocated cursor, bank, observer, and proxy to its registered
   methods and current owner.
3. Classify each non-product method as an active regression instrument,
   Phase 8 experiment dependency, historical evidence, or hazardous banned
   route.
4. Define explicit normal and probe extension builds or an equivalent opt-in
   boundary. The normal build must not allocate probe-only host objects.
5. Remove historical methods and their unused preallocated objects from the
   normal build.
6. Keep source probes and evidence when they still explain a product rule.
   Archive or remove scripts that no longer have a runnable wire dependency.
7. Review D13 before changing the six methods that it requires to stay
   registered. Keep `WIRE_METHODS_FORBIDDEN` absent in every build.
8. Make the normal wire golden describe the product extension clearly. Give an
   active probe build its own explicit method identity when needed. Keep historical
   method lists separate from the active registry.
9. Apply only 8a-selected result or discovery reductions that do not require
   the replacement cache or compact-bar contract. Correct the stale
   `delete_clip` reversal description.
10. Keep `observation.read` and `observation.replace` until the five automatic
    capture users and stored-record compatibility have an explicit migration.
11. Record normal and probe construction time, initialization time, host-object
    counts, memory trend, method count, and live handshake identity.

## Acceptance criteria

- Every active extension method has a product or current regression owner.
- Every active probe method has a named Phase 8 experiment or regression owner.
- The normal extension does not register methods or allocate objects only for
  probes.
- The product and probe builds cannot be confused at handshake time.
- Stable public behavior changes only where the 8a disposition explicitly
  authorizes a compatible reduction.
- Brain checks, extension tests, both applicable wire checks, and live
  handshakes pass.
- Initialization time, memory, and observer load improve or do not materially
  regress from the measured baseline.
- Historical evidence remains navigable after any source move or deletion.
- The resulting normal build is the baseline for 8d and 8e product limits.

## Out of scope

- Re-running closed capability spikes.
- Adding new Bitwig capabilities.
- Implementing the project cache.
- Performing the full public-tool redesign selected by 8a.
- Removing a hazardous route without first updating its owning decision.

## Result

[E136](../../evidence/experiments/e136-runtime-and-surface-cleanup.md) records
the completed partition. Normal has 85 methods, capture has 90, and probe has
95. The 157-method source inventory remains available as historical evidence.
Normal removes 57 historical methods, five capture methods, ten probe methods,
3,672 explicit host proxies, and 265 observer callbacks from the old shared
runtime.

The three archives embed distinct handshake identities. D13's six methods and
the four Phase 8 methods exist only in the probe runtime. The capture runtime
alone owns MasterRecorder. The normal runtime is the baseline for 8d and 8e.

The stable public behavior changed only in the approved result cleanup. The
`delete_clip` description now states the exact reversal boundary. Observation
compatibility remains.

## Verification

Extension builds, the full brain suite, all three wire goldens, normal and probe
live handshakes, the read-only probe-boundary check, the context checker, and
the diff check pass. The live project remained at its entry track and scene
counts.

## Retrospective

The first alternate archive changed only its manifest. Bitwig restarted the
configured normal definition and did not select the probe profile. Each archive
now embeds its identity, and the configured definition reads it. Test the live
identity before an alternate-profile probe.
