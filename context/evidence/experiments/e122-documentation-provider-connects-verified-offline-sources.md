---
title: E122 — Documentation provider connects verified offline sources
kind: evidence
state: active
updated: 2026-09-23
parent: ../../plan/phase-7/7c-documentation-provider.md
---

# E122 — Documentation provider connects verified offline sources [K]

## Verdict

The experimental `documentation-v0` module connects verified installed and
cached sources to bounded, source-routed SQLite FTS5 results. S14 and the
documentation part of S17 are implemented. The stable public surface is
unchanged.

The module reads the installed Bitwig version before source selection. It keeps
`api`, `workflow`, and `device` families separate. It uses the retained
downloaded manifest v1 and consumes the exact bytes that pass the TypeScript
gate. It does not import the Phase 6b Python loader, LSA, or NumPy.

## Implemented boundary

`ghostnote-documentation-source-v0` wraps one opened source family. Installed
trees use sorted relative paths, file hashes, byte counts, product version, and
a tree-manifest hash. Cached sources retain product and document versions,
compatibility, stable and resolved URLs, media type, byte count, manifest hash,
and content hash. A source-set digest binds the module request and response.

`ghostnote-documentation-request-v0` requires the product version, source
family, compatibility requirement, query, and result limit. The limit is 1–5
and the query is at most 512 characters. Source files, total bytes, record
counts, and record size also have finite limits.

`documentation-v0` returns source, provider, coverage, authority, warnings,
timings, and ranked hits. Each hit includes source and manifest identity,
product and document versions, compatibility, a file, section, property-key, or
page locator, excerpt coverage, provider and extractor identity, index identity
and settings, and retrieval rank. A no-match result is a successful empty read.

The disposable `ghostnote-documentation-index-v0` stays outside the repository.
Its identity binds the source hashes, extractor versions, provider version,
SQLite version, tokenizer, and weights. Metadata also hashes the stored source
records and normalized search rows. A mismatch refuses as stale or corrupt.

The module uses Node's SQLite FTS5 in process. PDF extraction starts only for a
general workflow request that includes the guide. It sends the verified PDF
bytes to `pdftotext` through standard input. Missing PDF extraction does not
affect installed API or device lookup.

## Conformance fixtures

Synthetic fixtures contain no Bitwig documentation. They cover:

- installed API, device-property, release-section, and guide-page extraction;
- exact family routing, deterministic ranking, warm index reuse, and no match;
- full hit provenance, exact locators, excerpt coverage, and request correlation;
- malformed or corrupt cache manifests and bytes, and offline marker checks;
- a cache path changed after validation, with extraction from the checked bytes;
- an unavailable family, a stale index, and an index content digest;
- refusal when a 5.3-only guide is the only source for a 6.0.6 exact claim;
- missing PDF extraction with continued installed API lookup;
- corrupt and timed-out guide extraction classified separately from a missing
  extractor; and
- refusal when cache or index roots are inside the repository.

## Documentation-guided construction task

The retained run used module-only mode, no web search, and no Bitwig project
connection. It opened the installed Bitwig Studio 6.0.6 Controller API 25 tree.
The selected tree had 306 HTML files and 5,890,486 bytes. Its tree-manifest hash
was `9bb1e36681cbc59ac6c566a3b3fe1b25a66cd5fffb70005af0ee04fe11787262`.
The source-set hash was
`69d73eaa74c672ce77ee616781057f286dd2eab8c555281a2db76dd447809a7e`.

The request asked which object starts and stops master recording, reports active
state, and gives duration in milliseconds. `MasterRecorder.html` ranked first.
The exact locator was
`extension/controller/api/MasterRecorder.html`. The record-source hash was
`c4e4417eb23d8dd0d4c7ca8a40dfb9b1196d44c11c25c5ffa808b08a41c7b881`.

The agent used that result to construct a future capture-adapter outline:
acquire `MasterRecorder`, observe `isActive()`, call `start()`, read `duration()`
in milliseconds while active, call `stop()`, and observe inactive state. The
outline is documentation-guided design. It is not an implemented recorder
route and does not claim file attribution or stop settlement.

## Timing and integration finding

The table reports one cold and one warm query over the same opened installed
API source. Source open is separate from the module request. Child spans are
inside the cold or warm request and must not be added to those totals.

| Boundary | Elapsed time |
|---|---:|
| Installed source open, validation, and hash | 66.687 ms |
| Cold extraction | 16.535 ms |
| Cold index build | 28.145 ms |
| Cold index validation | 10.006 ms |
| Cold FTS5 query | 0.478 ms |
| Cold module request, inclusive | 61.184 ms |
| Warm index validation | 8.449 ms |
| Warm FTS5 query | 0.444 ms |
| Warm module request, inclusive | 15.542 ms |

The run used Node 24.11.1 and SQLite 3.50.4. Node reported its SQLite API as
experimental. The index contained 306 records and returned five bounded hits.

The first hardened cold run found an index-integrity implementation defect. The
builder hashed its in-memory locale order, while validation hashed SQLite's
binary row order. The fresh index refused before retrieval. The builder now
hashes the rows after insertion in SQLite order. Focused fixtures and the
retained cold and warm run pass this path.

## Cleanup and repository boundary

The run had no Bitwig connection and no project effects. Its cache and index
directories were declared temporary and removed after the run. No downloaded,
installed, extracted, or indexed Bitwig document is in the repository.

## Verification

The focused cache and documentation suite passes 14 tests. The full brain check
passes 1,081 tests. The context check passes 327 active documents with intact
links. The whitespace check passes.

## Retrospective

The compatibility field prevented the broadest unsupported answer. The
document version alone identifies the 5.3 guide, but compatibility makes the
refusal rule explicit: that guide cannot establish a Bitwig 6 behavior claim.
