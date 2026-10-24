---
title: Independent review of the overlap status summary
kind: note
state: active
updated: 2026-10-24
---

# Independent review of the overlap status summary

The [status summary](OVERLAP_STATUS_SUMMARY.md) adds a useful planning handoff.
Its overall direction is sound. Several claims need narrower wording.

## Confirmed additions

- The remaining candidates have no active implementation home. Only the
  historical 9a plan linked their source reports before this reorganization.
- Working references still contain contradicted statements. The format spec
  calls `0x02` retired. `brain/src/bwmod/stream.ts` says recursive parsing
  needs Ramona schema. The checks pass 24 byte-exact preset round trips,
  46 complete donor parses, six matching footprints, and four real `0x02`
  body fields. [Script](../../../evidence/data/overlap-audit/offline_checks.py).
- The [Control Deck reproduction](../../../evidence/data/overlap-audit/controller_noop_delete.mjs)
  confirms success on a no-op delete: both device counts remain one.
- The normal surface has 45 tools and descriptions v53
  ([E343](../../../evidence/experiments/e343-grid-admission-gate-and-upgrade-tool.md)).
  The installed host is 6.1.4. Its jar also lacks the hardcoded `sYG.class`
  member that bwpreset's extractor requires. No key extraction was needed
  to establish that specific failure.

## Qualifications

1. **Descriptor work went beyond finding packages.**
   [E276](../../../evidence/experiments/e276-grid-semantic-read-and-value-probe.md)
   and its saved captures contain field IDs and names, such as
   `6428 → auxiliary_devices`. This is scoped semantic access, not a complete
   field dictionary or Arranger implementation.
2. **Offline Grid work is not wholly superseded.** Phase 11 plans live native
   editing. Offline preset generation and remote-page authoring are distinct
   capabilities and remain unplanned.
3. **Computed counts do not yet replace fixed footprints.** Shared and
   external references need complete-preset tests, followed by live edit and
   persistence proof. Eight objects in Expressions does not prove it loads.
4. **Keep historical E records unchanged.** Correct current references and
   point to later evidence. Do not rewrite E4's earlier novelty claim. Include
   the stale parser comment in the documentation correction scope.
5. **Separate dependencies.** Routing scale sources need owned-reference
   rules. Physical units need authoritative descriptors. Neither is proved
   merely by adding route enabled state or modes.

## Planning consequence

Give each candidate a current disposition before choosing an order. Distinguish
available tools, internal modules, completed research, planned product work,
and new candidates. Phase 10 can hold independent breadth sessions. A larger
preset or Arranger program can have its own phase if the user selects it.

The review changed no implementation or live state. The later reorganization
is described in [the preparation report](WAVE_3_PREPARATION.md).
