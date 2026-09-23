---
title: Phase 7c — Documentation provider
kind: plan
state: complete
status: Complete. E122 implements S14 and the documentation part of S17.
updated: 2026-09-23
parent: README.md
prev: 7b-agent-patch-execution-and-reference-dogfood.md
next: 7c-follow-up-automatic-user-guide-cache.md
---

# Phase 7c — Documentation provider

## Purpose

Extract the E104 cache and source-routed FTS5 boundary into one independent,
read-only experimental module. Prove it in a documentation-guided task.

## Work

1. Read the installed Bitwig version before selecting sources.
2. Index installed API and localization sources in place.
3. Cache permitted downloaded sources outside the repository with version,
   compatibility, URL, hash, media type, and byte-count metadata.
4. Require an explicit API, workflow, or device source family.
5. Return bounded evidence with exact source provenance and compatibility.
6. Fail closed on missing, stale, corrupt, ambiguous, or incompatible material.
7. Run one documentation-guided construction task without web search.

## Selected implementation boundary

Implement [documentation-v0](../../evidence/format/WORKSTATION_CONTRACTS.md)
and close [S14 and the documentation part of S17](../../evidence/format/WORKSTATION_SEAMS.md).
Retain the downloaded cache manifest v1. Feed fully validated sources to the
extractor; the Python probe's hash-only cache loader is not a sufficient gate.

Each hit needs source/manifest identity, product and document versions,
compatibility, exact locator, excerpt coverage, provider/extractor/index version,
and retrieval rank. Tie the disposable FTS5 index to these versions and hashes.
Keep source families independently available. Missing PDF extraction must not
disable installed API lookup. Do not include the rejected LSA/NumPy dependency.

## Verification cost

Use the [6j operation and timing rules](../../evidence/format/WORKSTATION_VERIFICATION.md)
for this session. Measure implemented seam costs separately from host/provider
work. Keep unknown costs explicit. Any proposed reuse must pass its
[equivalent-evidence brief](VERIFICATION_REDUCTIONS.md).

## Acceptance criteria

- Exact installed sources and older workflow fallbacks remain distinct.
- The 5.3 guide cannot support a Bitwig 6 behavior claim by itself.
- Missing documentation capability does not disable other modules.
- No copyrighted Bitwig document is added to the repository.
- Offline retrieval and corrupt-cache refusals pass.
- Focused tests, the full brain check, context check, and `git diff --check`
  pass.

## Out of scope

- General web search.
- Semantic retrieval without a measured task advantage.
- A stable public contract.

## Retrospective target

Record which provenance field prevented the broadest unsupported answer.

## Result

[E122](../../evidence/experiments/e122-documentation-provider-connects-verified-offline-sources.md)
implements the strong TypeScript source gate, source-routed FTS5 index, bounded
`documentation-v0` result, and isolated module boundary. The retained offline
task used the exact installed API to construct a future master-recorder control
outline. The compatibility field blocked the 5.3 guide from supporting a 6.0.6
behavior claim. The automatic user-guide cache follow-up is next.
