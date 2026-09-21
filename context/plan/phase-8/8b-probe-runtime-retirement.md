---
title: Phase 8b — probe runtime retirement
kind: plan
state: planned
updated: 2026-09-20
parent: README.md
---

# Phase 8b — probe runtime retirement

## Purpose

Reduce the product extension to the wire methods and preallocated Bitwig
objects that the product needs. Preserve experimental evidence without keeping
all historical probe apparatus active at runtime.

## Scope

Use the [6i probe disposition](../../evidence/format/WORKSTATION_INTERFACES.md)
as the Phase 6 starting inventory. Extraction and retained regression status do
not require the complete probe runtime in a normal product build. Recheck the
product wire map after Phase 7 adds any typed capture route.

1. Inventory every registered extension method against `WIRE_METHODS_USED`.
2. Classify each unused method as an active regression instrument, historical
   evidence, or a hazardous banned route.
3. Remove historical methods and their unused preallocated Bitwig objects from
   the product extension.
4. Move any necessary live regression surface into an explicit probe build or
   another opt-in boundary.
5. Keep source probes and evidence when they still explain a product rule.
   Archive or remove scripts that no longer have a runnable wire dependency.
6. Review D13 before changing the six methods that it requires to stay
   registered. Keep `WIRE_METHODS_FORBIDDEN` absent in every build.
7. Make the wire golden describe the product extension clearly. Keep historical
   method lists separate from the active registry.

## Acceptance criteria

- Every active extension method has a product or current regression owner.
- The normal extension does not allocate objects only for retired probes.
- No public tool or product behavior changes.
- Brain checks, extension tests, wire checks, and a live handshake pass.
- Initialization time and observer load do not regress.
- Historical evidence remains navigable after any source move or deletion.

## Out of scope

- Re-running closed capability spikes.
- Adding new Bitwig capabilities.
- Changing public tool schemas.
- Removing a hazardous route without first updating its owning decision.
