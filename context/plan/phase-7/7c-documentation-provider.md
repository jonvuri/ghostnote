---
title: Phase 7c — Documentation provider
kind: plan
state: planned
updated: 2026-09-13
parent: README.md
prev: 7b-agent-patch-execution-and-reference-dogfood.md
next: 7d-audio-facts-and-sensory-packets.md
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
