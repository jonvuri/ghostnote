---
title: E104 — Exact-version document cache and routed lexical retrieval pass
kind: evidence
state: active
updated: 2026-09-12
parent: ../../plan/phase-6/6b-exact-version-offline-documentation-retrieval.md
---

# E104 — Exact-version document cache and routed lexical retrieval pass [K]

## Verdict

The provider boundary passes with a limitation. Bitwig Studio 6.0.6 has no
exact-version user guide. It has exact installed API and semantic resources and
an exact patch release-notes route. The Bitwig Studio 5.3 guide is a declared
fallback for general workflows only.

A source-routed SQLite FTS5 index found all nine expected evidence items in its
top five. A local 64-dimension latent semantic analysis (LSA) index found four.
Select routed FTS5 as the primary retrieval method. Do not add LSA to the
provider from this result.

## Official downloads and version behavior

The [official release archive](https://www.bitwig.com/previous_releases/) lists
6.0.6 and links to this stable source URL:

`https://www.bitwig.com/dl/Bitwig%20Studio/6.0.6/release_notes/`

The stable URL returned HTTP 302 to an expiring, signed
`downloads-secure.bitwig.com` URL. The signed query was valid for three hours.
The final response was HTTP 200 `text/html`. The cache records the stable URL
and the final URL without its query. It never stores or reuses the token.

The official support page states that the version 6 user guide is still being
rewritten. The current [online guide](https://www.bitwig.com/userguide/) and its
PDF identify themselves as version 5.3. The tested exact-version 6.0.6 guide URL
returned HTTP 404:

`https://downloads.bitwig.com/documentation/6.0.6/Bitwig%20Studio%20User%20Guide%20English.pdf`

The stable version 5.3 PDF URL remains available. It must not supply version 6
feature or patch claims.

| Document | Version rule | Bytes | SHA-256 | Cache rule |
|---|---|---:|---|---|
| [6.0.6 release notes](https://www.bitwig.com/dl/Bitwig%20Studio/6.0.6/release_notes/) | Exact product patch | 111,446 | `db6a7a3bc1deccaad114d16a545a5d7c0f20d38aad663d44a883f2a9d318f9ab` | Store under product `6.0.6`, require the exact heading, media type, official final host, and content hash |
| [5.3 English user guide](https://downloads.bitwig.com/documentation/5.3/Bitwig%20Studio%20User%20Guide%20English.pdf) | Fixed older guide; general workflows only | 62,269,304 | `c2eaa918938805d7715f74b17b0322935f954fbdd097a28e9ee04f178849609a` | Store under product `6.0.6` with document version `5.3` and compatibility `general-workflow-only` |

The exact 6.0 major PDF URL also returned HTTP 200, but the probe did not
download it. The cumulative exact 6.0.6 HTML contains the 6.0 features and the
6.0.1 through 6.0.6 changes. One exact source is sufficient.

## Installed 6.0.6 inventory

The application property list reports Bitwig Studio 6.0.6. Installed sources
are queried in place. Tree hashes include each relative path and file hash.

| Source | Files | Bytes | Tree SHA-256 | Can answer | Cannot answer |
|---|---:|---:|---|---|---|
| Controller API HTML | 318 | 8,142,763 | `81b506efca758897b935e28800f676c0af403820951afd2fc3b56af3c15f7fa5` | API 25 types, methods, signatures, `Since` versions, and contracts | User workflows, host implementation, and undocumented behavior |
| Base English localization | 49 | 619,374 | `56581e51d1d00005152b1276937df9af93fd8c36b22d6f6f1e13a2b76145cc4a` | Exact installed labels, actions, enums, and short descriptions | Complete procedures and behavioral guarantees |
| Device, modulator, and module descriptions | 3 | 77,676 | `eb9b675ea805a4de40cbf10a53b85e1c75ee40dd8945a022525e24d334334202` | 151 device, 43 modulator, and 249 module description records and keywords | Complete parameter domains, routing state, and workflow steps |
| Native device definitions | 151 | 4,847,040 | `0b8b5a4e406d60d1e333f3624568698ded59c3fd15035cb725c17e84ee4e38ce` | Installed identity and binary artifact presence | Searchable behavior without a format parser |
| Presets | 154 | 1,111,755 | `bece9101941c2d2ba7426a7162f792537061c4f14fe0aae63fbb7bf85b17644b` | Exact installed default and file presence | General semantics without the existing guarded preset parsers |
| Remote maps | 235 | 2,014,120 | `1bfcb10adb8d08cee828e9e920880a0973ef504181336fc403e2cf9ec61bab8e` | Exact installed map presence | Searchable page semantics without a format parser or host readback |
| Grid module definitions | 232 | 3,246,791 | `6b2a0a31d7ef6da13bc9c3edb0794e673ca362f7379d85045f6051e91d76d1db` | Exact installed binary artifact presence | Searchable behavior without localization or a format parser |
| Modulator definitions | 43 | 985,643 | `fc1d071e1fa10ddff971f4728a8634a9c2934831cd307a7205879bd51b474e87` | Exact installed binary artifact presence | Searchable behavior without localization or a format parser |

The API HTML is exact for the installed application because it is inside the
6.0.6 application bundle and identifies itself as API 25. This does not mean
that each API type was introduced in 6.0.6. Use each type's `Since` field.

## Retrieval cohort

The probe built 1,480 documents from the same source cohort for both methods:

- 306 installed API pages;
- 443 installed description records;
- 36 exact 6.0.6 release-note sections; and
- 695 pages from the general-only 5.3 guide.

The request must select `api`, `workflow`, or `device` before ranking. This
route prevents a broad guide page from outranking an exact API page or an
installed device record.

| Area and question | Expected evidence | FTS5 rank | LSA rank |
|---|---|---:|---:|
| API: Which controller object starts and stops recording the master output? | `MasterRecorder.html` | 1 | 2 |
| API: How can an extension observe whether master capture is active? | `MasterRecorder.html` | 2 | 1 |
| API: Which API value reports a duration in milliseconds? | `MasterRecorder.html` | 1 | miss |
| Workflow: Where can I find audio made by master capture? | Guide 5.3 page 426 | 1 | miss |
| Workflow: How can copies of a clip share edits to their musical content? | 6.0.6 `Alias Clips` section | 1 | miss |
| Workflow: How do I define the project tonic and scale? | 6.0.6 `Key Signature Support` section | 1 | miss |
| Device: Which effect reduces harsh ess sounds in a vocal? | `device.de-esser` | 1 | 1 |
| Device: Which device combines compression and expansion with a sidechain? | `device.dynamics` | 4 | 3 |
| Device: Which module moves a signal to the nearest pitch in the project key? | `module.by_scale` | 3 | miss |

`miss` means that the expected evidence was outside the top five. Before source
routing, FTS5 found seven of nine and LSA found three of nine. After routing,
FTS5 found nine and LSA found four. The same questions and expected evidence
were used in each run.

## Performance, footprint, and determinism

Two complete builds produced identical corpus, FTS5, and LSA file hashes and
identical rankings. Each query also repeated 20 times with no ranking change.

| Measurement | Run 1 | Run 2 |
|---|---:|---:|
| Corpus extraction | 1,515.1 ms | 1,439.5 ms |
| FTS5 build | 97.7 ms | 90.6 ms |
| FTS5 median query | 0.439 ms | 0.404 ms |
| LSA build | 344.0 ms | 317.6 ms |
| LSA median query | 0.139 ms | 0.137 ms |
| Peak resident memory | 276,447,232 bytes | 281,985,024 bytes |

The corpus JSON was 2,218,518 bytes. FTS5 was 2,785,280 bytes. The compressed
LSA index was 1,761,809 bytes. The complete generated retrieval directory used
7,536 KiB, including extracted guide text.

The run used Python 3.14.6, SQLite 3.53.2, and NumPy 2.4.6. SQLite is in the
public domain. NumPy uses the BSD-3-Clause license. The selected FTS5 provider
does not need NumPy. NumPy remains a probe-only dependency for the rejected LSA
comparison.

The first downloads took 1,144.0 ms for release notes and 1,954.7 ms for the
guide. Three later offline reads took 0.5 to 0.9 ms for release notes and 27.8
to 32.5 ms for the guide. Each read recalculated the content hash. The complete
temporary document cache used 60,932 KiB.

The cache tests refuse a mismatched request manifest, a non-official source or
final host, a wrong media type, a short document, a missing exact-version text
marker, an invalid PDF prefix, and a content hash mismatch. A missing cache
fails immediately. It does not attempt a network fallback in offline mode.

## License and repository boundary

The 5.3 guide says that no part of the publication can be copied or reproduced
without prior written permission. No redistribution grant was found for the
localization or library resources. The API tree contains GPLv2 and Classpath
Exception files, but the generated Javadoc has no clear per-page redistribution
grant. Treat all copied Bitwig source material as non-redistributable until a
legal review says otherwise.

The repository retains only probe code, hashes, measurements, source IDs, and
short factual identifiers. It contains no Bitwig documentation or extracted
corpus. The temporary cache and all generated indexes were removed after the
proof.

## Provider boundary

1. Read the installed application version before source selection.
2. Use installed API and localization in place for exact API and device facts.
3. Download exact patch release notes through the official release-archive URL.
4. Store bytes outside the repository under
   `<cache>/bitwig/<product-version>/<source-id>/<sha256>.<extension>`.
5. Store a manifest with product version, document version, compatibility,
   stable source URL, safe resolved URL, media type, byte count, and hash.
6. Require an explicit `api`, `workflow`, or `device` source family. Use FTS5
   BM25 within that family and return source provenance with each result.
7. Let the 5.3 guide answer general workflows only. Refuse a version 6 claim
   that depends only on that guide.
8. Verify the manifest and bytes on each offline open. Fail closed on missing,
   stale, corrupt, ambiguous, or incompatible material.

This is a private local provider boundary. It is not yet a public documentation
tool.

## Retrospective

The explicit document-version compatibility check prevented the broadest false
claim: the available 5.3 guide is not a 6.0.6 guide. Source-family routing then
prevented broad workflow pages from outranking exact installed evidence.
