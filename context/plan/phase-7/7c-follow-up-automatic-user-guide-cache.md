---
title: Phase 7c follow-up — Automatic user-guide cache
kind: plan
state: complete
status: Complete. E123 adds the cold-to-warm automatic guide cache.
updated: 2026-09-23
parent: README.md
prev: 7c-documentation-provider.md
next: 7d-audio-facts-and-sensory-packets.md
---

# Phase 7c follow-up — Automatic user-guide cache

## Purpose

Make the documentation provider self-managing on first workflow use. Download
the approved Bitwig user guide when its verified local cache entry is missing.
Reuse a valid cached copy indefinitely for that installed product version.

## Decisions

- Use the existing official Bitwig 5.3 English guide request and manifest v1.
- Keep the guide classified as `general-workflow-only` for later Bitwig
  versions.
- Download only when the guide manifest or content file is missing.
- Do not replace a corrupt, stale, incompatible, or unsafe cache entry
  automatically. Fail closed and identify the repair action.
- Cache by installed Bitwig product version and source ID. Use no TTL,
  conditional refresh, or automatic garbage collection.
- Keep an explicit offline mode. Normal configured workflow use downloads a
  missing guide; offline mode reports it as unavailable without network access.
- Give the cold download a 90-second deadline. Limit one downloaded source and
  the complete opened source family to 128 MiB.
- Keep all downloaded bytes and indexes outside the repository.

## Work

1. Reuse `cacheOfficialDocument()` for the existing `generalGuide53()` request.
   Do not add URL discovery or a second downloader.
2. Add one source-open policy with `automatic` and `offline` modes. Make the
   normal documentation configuration use `automatic`.
3. On a missing guide cache entry, run one keyed in-process download for the
   cache root, product version, and source ID. Concurrent callers must share
   that work.
4. After download, reopen the result through `readCachedDocument()`. Extraction
   must consume only the bytes that pass that gate.
5. Do not download the guide for API or device requests. Do not broaden this
   session to automatic release-note download.
6. If download fails, keep other source families and valid workflow sources
   available. Report the guide as unavailable. A later request can retry.
7. Let the existing source and extractor identity create a new FTS5 index when
   required. Keep valid warm indexes unchanged.

## Verification

Add offline fixtures for these cases:

- an empty cache downloads once, validates the result, and returns a cited
  guide page;
- a warm cache performs no download and returns the same source identity;
- concurrent cold opens perform one download;
- separate product versions use separate cache entries;
- explicit offline mode performs no download;
- a network or media-type failure leaves other valid sources available;
- a stalled download stops at its deadline and permits a later retry;
- an oversized response stops before it is buffered or cached;
- a corrupt or incompatible cache fails closed without a download; and
- API and device requests perform no guide download or PDF startup.

Run one bounded integration task with an empty external cache and the complete
official guide. Repeat it in offline mode. The second run must use the same
source hash and return the same top result without network access. Record cold
download, extraction, index-build, warm-open, and query times separately. Do
not retain the downloaded guide or extracted text in the repository.

## Acceptance criteria

- The first normal workflow request can search the guide without a manual
  cache-bootstrap command.
- A valid cached guide is reused indefinitely for that installed product
  version.
- Offline mode never performs network access.
- Corrupt, stale, incompatible, and unsafe cache entries still fail closed.
- The 5.3 guide cannot support an exact Bitwig 6 behavior claim.
- Download failure does not disable installed API or device documentation.
- The automatic download has a 90-second deadline and a 128 MiB byte limit.
- No cache TTL, background updater, garbage collector, or general web client is
  added.
- Focused tests, the full brain check, context check, and `git diff --check`
  pass.

## Out of scope

- Automatic release-note download.
- Periodic or conditional refresh.
- Cache-size limits or garbage collection.
- Guide-version discovery or scraping.
- A stable public documentation surface.

## Retrospective target

Record whether the shared cold-download path stayed smaller than a separate
bootstrap service and whether the explicit offline mode prevented test or
operator surprises.

## Outcome

[E123](../../evidence/experiments/e123-automatic-user-guide-cache-is-cold-to-warm.md)
implements the default automatic and explicit offline source-open modes. The
provider shares concurrent cold downloads, reopens all downloaded bytes through
the retained cache gate, and keeps invalid entries fail-closed. A review
follow-up adds a 90-second deadline and enforces the 128 MiB source limit during
streaming. The full guide task returned page 426 first from cold and offline
warm runs with the same source hash. Session 7d is next.
