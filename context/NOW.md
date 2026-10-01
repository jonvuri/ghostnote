---
title: Current state
kind: status
state: active
updated: 2026-10-01
phase: phase-8-agent-native-live-engine
session: phase8f2-reference-codec-complete
---

# Now

[8f2 is complete](archive/outcomes/PHASE-8F2-REFERENCE-CODEC.md).
[Ghostnote Document 1.0](../spec/ghostnote-document-v1/SPEC.md) now has a pure
[reference codec and guide](../spec/ghostnote-document-v1/CODEC.md),
[versioned corpus](../spec/ghostnote-document-v1/conformance/v1/README.md),
canonical examples, and a tested [Model format reference](../spec/ghostnote-document-v1/MODEL-REFERENCE.md).
It is a target contract, not an external release. D25 remains the selection.

Start [8f3](plan/phase-8/8f3-ghostnote-bindings-and-cache-contracts.md) next.
Read the specification, field table, codec guide, corpus, and
[host handoff](../spec/ghostnote-document-v1/HOST-HANDOFF.md). Resolve field
mappings, partial bases, identity recovery, D9/D21 migration, and cache rules.
The pure materializer requires a complete base. Host integration is not built.

Codec conversion never quantizes. Exact import floors onsets to `1/512`, rounds
durations to nearest with ties up and a one-cell minimum, and reports both
deltas. Current overlays use dependency bases; edits can make them stale.
Both canonical encodings must fit within 8 MiB. Import pair analysis is bounded.
All golden hashes remain unchanged. Brain checks, 252 document tests,
artifact checks, and the standalone consumer pass.

Keep `normal-v1`, cache code, live projects, and frozen benchmark artifacts
unchanged until their integration sessions. Keep matrix and addendum denominators
separate. New provider token counts were not requested. 8g implements the shadow
cache; 8h integrates the format; 8i tests fresh agent use. 9b owns publication.

## Retrospective

Test byte limits on both canonical encodings. Use minimal fixtures for one
claim type when a paired example contains several claims. Keep primary format
artifacts in `spec/`; keep outcomes and handoffs in `context/`.
