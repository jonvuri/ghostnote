---
title: Phase 9b — Compact-bar publication review
kind: plan
state: planned
status: Gated by Phase 8i acceptance. Prepare a public specification package without publishing it automatically.
updated: 2026-09-25
parent: README.md
evidence: E114-E121, E129-E134; D23
---

# Phase 9b — Compact-bar publication review

## Purpose

Prepare the Phase 8 compact-bar specification, rationale, benchmark, and
conformance corpus for external use. Review every claim, dependency, fixture,
license, and compatibility boundary before publication.

Do not start until Phase 8i accepts the format's live use and hands this session
an explicit publication candidate.

## Scope

1. Review the specification, grammar, canonical rendering, examples, loss
   model, defaults, identity rules, patch semantics, and compatibility policy.
2. Review the prior-art comparison for fair descriptions and direct sources.
3. Separate deterministic conformance from provider-dependent benchmark
   results.
4. Verify the origin, license, and redistribution status of every fixture,
   prompt, response excerpt, diagram, and generated artifact.
5. Package a small reference parser, renderer, or validator only if Phase 8
   accepts it as part of the public contract.
6. Provide a reproducibility guide for fixed fixtures, scoring, model settings,
   run manifests, and known provider drift.
7. State Bitwig-specific assumptions without presenting compact-bar as a full
   interchange replacement for ABC, LilyPond, Tidal, MIDI, or another format.
8. Define versioning, extension, deprecation, and support policies.
9. Inspect the complete publication package in a clean temporary consumer.

## Acceptance criteria

- Every normative rule has a conformance fixture.
- Canonical examples parse, render, and round-trip under the declared loss.
- Comparative claims link to the fixed benchmark and name their tested models,
  dates, prompts, and limits.
- The documentation gives established formats their native goals and does not
  imply private model-training knowledge.
- The package contains only reviewed code, text, and permissibly distributed
  fixtures.
- Bitwig, cache, and Ghostnote implementation details are clearly normative,
  informative, or out of scope.
- Installation and standalone checks pass in a clean consumer.
- No registry publication, website update, announcement, or external release
  occurs without explicit user approval.

## Out of scope

- Reopening the Phase 8 language design without new failure evidence.
- Publishing the Ghostnote cache or extension as part of the format package.
- Promising model performance across untested providers or future versions.

## Retrospective target

Record which parts of compact-bar are generally useful and which remain
Ghostnote- or Bitwig-specific. Keep the public scope no larger than the proved
portable contract.
