---
title: Phase 6b — Exact-version offline documentation retrieval
kind: plan
state: complete
status: Complete. E104 selects exact-source routing and SQLite FTS5 retrieval.
updated: 2026-09-12
parent: README.md
prev: 6a-audio-capture-feasibility.md
next: 6c-deterministic-audio-analysis-tool-survey.md
---

# Phase 6b — Exact-version offline documentation retrieval

## Purpose

Determine how Ghostnote can retrieve exact-version Bitwig documentation without
depending on live web search. Compare small lexical and semantic retrieval
routes over the available sources.

## Work

1. Identify stable official download URLs for the Bitwig Studio 6.0.6 guide and
   record their version behavior.
2. Inventory the installed API HTML, localization text, device descriptions,
   presets, and remote maps. Record coverage and license boundaries.
3. Build one bounded version-aware download and cache probe. Keep downloaded
   material outside the repository unless redistribution is approved.
4. Build a small lexical index over a representative source cohort.
5. Compare lexical results with one local semantic retrieval method on exact
   API, workflow, and device questions.
6. Measure index time, query time, memory, disk size, determinism, and failure
   behavior.
7. Remove downloaded and generated probe artifacts after the proof, unless one
   cache location is explicitly retained.

## Acceptance criteria

- The result distinguishes installed exact-version sources from current online
  documentation.
- Every download has an official source URL, version rule, content hash, and
  cache rule.
- The inventory states what each source can and cannot answer.
- Lexical and semantic retrieval use the same question cohort and have explicit
  expected evidence.
- The result records latency, footprint, determinism, and offline behavior.
- The repository includes no copyrighted Bitwig documentation copy.
- The result selects a provider boundary or records a precise blocker.

## Out of scope

- General web research.
- Redistribution of Bitwig documentation.
- A public documentation tool before the retrieval boundary passes.
- Audio analysis or perceptual judgment.

## Retrospective target

Record which source or version check prevented the most false retrieval claims.

## Result

[E104](../../evidence/experiments/e104-exact-version-document-cache-and-routed-lexical-retrieval-pass.md)
proves a version-aware private cache and offline retrieval route. The exact
6.0.6 release archive redirects to a signed official document. No 6.0.6 user
guide exists. The 5.3 guide remains a general-workflow fallback and cannot
support version 6 claims.

The routed FTS5 index found all nine expected API, workflow, and device evidence
items in its top five. Local LSA found four. Select FTS5 with an explicit source
family. Keep source bytes and generated indexes outside the repository.

Session 6c is next.
