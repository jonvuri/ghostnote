---
title: E123 — Automatic user-guide cache is cold-to-warm
kind: evidence
state: active
updated: 2026-09-23
parent: ../../plan/phase-7/7c-follow-up-automatic-user-guide-cache.md
---

# E123 — Automatic user-guide cache is cold-to-warm [K]

## Verdict

The documentation provider now downloads the approved Bitwig Studio 5.3 English
guide on the first normal workflow request. It reopens the downloaded entry
through the retained manifest v1 and byte gate. A valid cache has no expiry and
is separate for each installed product version.

The explicit offline mode never downloads. A missing guide or failed download
leaves valid workflow sources available. An invalid guide entry fails the
workflow source open, but it does not affect separate installed API or device
opens. Only a missing guide manifest or content file starts a download. Release
notes remain cache-only.

## Implemented boundary

The source-open policy is `automatic` by default and also accepts `offline`.
Automatic workflow opens share one in-process download for the resolved cache
root, product version, and source ID. The shared entry is removed after success
or failure, so a later request can retry. API and device opens do not enter this
path or start the PDF extractor.

The cold download has a 90-second deadline. It aborts the fetch on expiry. The
downloader checks the response length and streamed byte count against the 128
MiB source limit before it writes the cache entry.

Download failure reports the guide source as unavailable when another workflow
source is valid. A corrupt, stale, incompatible, or unsafe existing entry still
fails closed and is not replaced. The provider adds no TTL, updater, garbage
collector, URL discovery, or general web client.

`documentation-v0` now reports download and source-validation time separately.
The source digest excludes timing, so automatic and offline opens of the same
verified bytes have the same identity.

## Conformance fixtures

Synthetic offline fixtures cover:

- one cold download followed by an offline warm open with the same source and
  top result;
- one shared download for concurrent cold opens;
- separate cache entries for separate installed product versions;
- no download in offline mode;
- media-type failure isolation and a later successful retry;
- deadline expiry with abort and a later successful retry;
- response-size refusal before buffering or caching;
- incompatible cache refusal without download; and
- no guide download or extractor startup for API and device requests.

The retained 7c fixtures continue to cover corrupt bytes, stale indexes, unsafe
cache roots, source compatibility, checked-byte extraction, and missing PDF
extraction.

## Full-guide task

The module-only task started with empty external cache and index roots. It asked
where audio from master capture can be found. The automatic open downloaded and
verified the complete 62,269,304-byte guide. Its SHA-256 was
`c2eaa918938805d7715f74b17b0322935f954fbdd097a28e9ee04f178849609a`.

The source-set hash was
`c22ba3a42a85374c4b1cae7a78c53355260a74e79c67ebfb65916d228d55ea5e`.
Guide page 426 ranked first. The cold index contained 695 page records. Release
notes were absent and were reported as unavailable.

The second run used explicit offline mode. It performed no download. It returned
the same source-set hash and the same page-426 top result. The task had no Bitwig
connection and no project effects.

## Timing and cleanup

The run used Node 24.11.1, SQLite 3.50.4, and `pdftotext` 26.06.0.

| Boundary | Elapsed time |
|---|---:|
| Cold guide download and cache validation | 14,035.587 ms |
| Cold source validation outside download | 42.647 ms |
| Cold extraction | 1,455.579 ms |
| Cold index build | 36.406 ms |
| Cold index validation | 17.044 ms |
| Cold query | 0.503 ms |
| Cold module request, inclusive | 1,735.795 ms |
| Automatic-run warm index validation | 18.815 ms |
| Automatic-run warm query | 0.485 ms |
| Automatic-run warm request, inclusive | 106.426 ms |
| Offline warm source open | 43.358 ms |
| Offline warm download | 0 ms |
| Offline warm index validation | 20.203 ms |
| Offline warm query | 0.495 ms |
| Offline warm request, inclusive | 98.665 ms |

The disposable cache and index used 62 MiB. Both were removed after the run. No
downloaded guide, extracted text, or generated index remains in the repository.

## Verification

The focused cache and documentation suite passes 23 tests. The full brain check,
context check, and whitespace check pass.

## Retrospective

The shared cold path stayed inside the existing source opener and cache helper.
A separate bootstrap service was not necessary. The explicit offline mode made
network use testable and kept the warm repeat independent of network access. A
review found that promoting a manual cache helper into an automatic path also
requires explicit network deadlines and streaming limits.
