# R05 — Browser and catalog name resolution

Research complete with a positive route verdict. [E347](../evidence/experiments/e347-filter-driven-native-browser-discovery.md)
verified filter-driven API discovery; [E348](../evidence/experiments/e348-browser-native-result-identities.md)
verified sampled native, VST3, CLAP, and Bitwig-preset identities using read-only
internal metadata and independent local sources. The public catalog/explicit-ID
fallback remains current because this research does not implement a resolver.

The operator approved the progression with “Ok, then I agree with this
progression. proceed” and confirmed each required probe replacement. The
native registry alternative is unnecessary for the positive route verdict;
its caches served as independent checks. No result commit or insertion ran.

Implementation is now assigned to [V14](v14-add-devices-by-name.md), next in
the backlog. It uses the R06 preferences/index route for ordinary discovery
and requires separate native, VST3, CLAP, and custom-location preset insertion
checks. The contract below is the research proposal V14 will refine.

## Proposed minimal resolver contract

`resolve_device_name` is a proposal, not an advertised tool. Its input is an
exact display `name`, optional `sourceKind` (`native`, `vst3`, `clap`, or
`bitwig-preset`), and optional exact library/root location. It does not
silently case-fold, strip architecture suffixes, prefer one format, or load
vendor preset formats. A generic name that matches multiple supported formats
returns ambiguity; unsupported matches remain visible as exclusions.

Each candidate supplies `name`, `sourceKind`, `identity`, `location`, and
available vendor/architecture information. Identities use existing insertion
input forms:

| Kind | Exact identity | Location |
|---|---|---|
| native | `{ uuid }` | Host device-library source |
| vst3 | `{ vst3Id }` (32 hexadecimal characters) | Installed bundle/root |
| clap | `{ clapId }` | Installed bundle/root |
| bitwig-preset | `{ path }` (absolute `.bwpreset` file) | Library root and relative path |

A preset's contained-device UUID is descriptive metadata, not its identity.
Multiple paths or installations are retained explicitly even when their
underlying device ID is shared.

The response includes `status` (`resolved`, `ambiguous`, `not-found`,
`incomplete`, or `unsupported`), all observed exact candidates, exclusions, and
coverage: search scope, insertion context, result count, scanned count,
metadata coverage, and host version/jar fingerprint. `resolved` requires one
supported candidate with verified identity and complete coverage of the
requested scope. Zero complete matches yields `not-found`; two or more
verified matches establishes ambiguity even if enumeration is incomplete.
With fewer than two verified candidates, any unresolved candidate, unsupported
result class, changed snapshot, or truncated coverage prevents a unique or
absence claim. Report the concrete limitation and observed candidates.

Public implementation must still establish complete typed enumeration,
location identity across configured/custom roots, source/architecture duplicate
handling, and a browser lifecycle that protects the user's current popup,
project, and selection. The research's concrete observed location indices are
not persistent IDs. Its Instrument selection is not a proven semantic filter;
classify actual results from native metadata. The 6.1.4 field mapping is pinned
to one jar and requires an explicit unsupported-build response elsewhere.

The resolver would perform discovery only and cancel its owned popup. Its
result can feed existing guarded insertion tools; resolution itself does not
insert or prove a new insertion route. [D22](../decisions/d22-non-native-plugin-preset-loading-is-out-of-scope.md)
continues to exclude vendor-preset loading. This proposal satisfies R05's
contract output without adding a public tool or changing descriptions v53.

## Verification and handoff

The v4 handshake and both metadata passes succeeded after “Controller
replaced”. E348 retains the exact initialization, artifacts, semantic mapping,
and identity checks. All 60 sampled supported identities agree with independent
sources. Scratch cleanup and preserved inventories pass for both attempts.
The targeted VST3/CLAP follow-up used a two-page observed location prefix and
complete result-name scans (49 and 12); metadata covered 16 and 12 respectively.

Offline verification includes 76 focused driver/wire tests, TypeScript
checking, Java browser/metadata and runtime-profile harnesses, archive
verification, the independent identity audit, and link/diff checks. Normal
controller restoration is complete. V14 now precedes R01 in the backlog.
The normal archive was restored with `copyExtension` at
`2026-10-25T16:50:22.916Z`, SHA-256
`1024978cd6c65ad93519675191b14fdcd900845d62afc3a098f6d125ca9e0214`.
The operator replied “Controller replaced”. The
[restoration handshake](../evidence/data/r05-browser/normal-restoration-hello.log)
passed: `normal-v1`, API 25, 92 methods, `8be1975eaa99d78f`, expected normal
build markers, and fresh initialization at `2026-10-25T16:53:58.441Z`.
The operational handoff is complete; no additional live write ran.

## Implemented research apparatus — native result metadata

[E347](../evidence/experiments/e347-filter-driven-native-browser-discovery.md)
records the successful filter-driven public API pass and its limits. Both
scratch tracks were removed and preserved inventories matched. The v3
handshake passed after “Controller replaced”, with initialization at
`2026-10-25T16:30:46.562Z`.

Attempt 3 exposed a 1,466-entry location bank, exceeding the preliminary
1,024-entry complete-enumeration bound. After inspection and cleanup,
attempt 4 selected exact observed first-page rows under snapshot guards.
This is a deliberate test of those concrete rows, not global location-name
resolution. Each row must match its observed index/name; ambiguous matches on
the first page stop the condition. Device-type enumeration remains complete.
The frozen attempt drivers preserve both conditions.

V4 (`r05-browser-discovery-v4`) follows the authorized progression by sampling
native metadata for the first 16 visible results in each of the three proved
locations. It limits result enumeration to the first 128 rows per condition,
retaining explicit completeness, because the 4,096-row discovery pass already
established the mixed plug-in branch. It adds no result selection or commit.

The metadata reader pins the inspected 6.1.4 jar SHA-256, queues reads through
`ControlSurfaceObject.exec`, and verifies document-thread execution before
calling the proxy's `getTarget`. It reads shallow scalar fields from the
concrete result class through its `CN` base, plus the `CN.TtY` library root's
`EX.eLY` File field. Local bytecode inspection identified these exact fields;
`CN` also holds relative/name strings. It does not invoke native path/search
getters, traverse arbitrary references, or interpret raw fields as accepted
insertion IDs. Samples include declaring class, field name/type, native class,
observed public name/index, and library root. This supplies concrete live types
and values for the subsequent semantic assessment.

Limits are 16 result objects, 16 class levels, and 96 examined fields per
object. Static and non-scalar fields are skipped. A pending read blocks browser
paging/filter changes and reopening; cancellation remains available. Completion
is published as one immutable snapshot. The driver independently checks stable
public result/filter readback and matching sample indices/names before
retaining metadata. An unsupported jar, incomplete/error sample, changing
page, or pending read ends the pass and retains the failure through cleanup.

The public-browser sequence retains ownership, target/selection checks,
post-open audition disable, bound-column wildcard resets, and independent
readback. Open/reset waits are 1,000 ms; other updates use 180 ms plus 80 ms
between reads. These are research waits, not latency claims. Use one foreground
driver, an owned empty `gn-r05-*` track, fresh admission, and a new artifact
directory; cancel, remove the scratch, and verify preserved inventories.

The handler remains probe-only: 119 methods, `9e75b9a8b3938491`; normal remains
92 / `8be1975eaa99d78f`, with 45 public tools and descriptions v53. V4 passes 75 focused driver/wire tests, TypeScript checking, Java browser and
scalar-metadata harnesses, runtime-profile checks, archive verification, and
link/diff checks. It was deployed with `copyProbeExtension` at
`2026-10-25T16:41:43.469Z`, archive SHA-256
`6f345a38d7d733ea0386922c8624386341409ecc5a753660bb7a570a59c13a97`.
The operator subsequently replied “Controller replaced”; the v4 handshake
and live read succeeded as recorded in E348. This paragraph retains the v4
preparation record; the current handoff is normal controller restoration.

## Goal and scope

Determine whether delayed popup-browser reads and filter resets overcome the
[E101](../evidence/experiments/e101-plugin-preset-files-have-two-direct-routes.md)
content-type limitation on Bitwig 6.1.4. The
[R05 source brief](../plan/overlap/wave-4/workflow-sequence.md#r05--browser-and-catalog-name-resolution)
defines the bounded experiment. [D22](../decisions/d22-non-native-plugin-preset-loading-is-out-of-scope.md)
continues to exclude vendor preset formats.

This first pass tests discovery and cancels the popup. It cannot select a
result or commit a device. A positive name scan alone does not establish a
reusable device ID, preset path, or safe commit route. The installed API 25
source exposes only existence, name, and selection on `BrowserResultsItem`;
the item interface supplies no persistent ID or path. If discovery works,
assess identity and ambiguity before proposing `resolve_device_name` or adding
a separate guarded commit experiment. Custom-library Bitwig preset discovery
remains part of that positive follow-up, not a claim of this first pass.

## Earlier implementation — content-type-guarded v1/v2

- Probe-only `probe.browserDiscovery`, marker `r05-browser-discovery-v2`.
  Browser resources are allocated only in `phase-8-probe-v1`; normal tools
  remain at 45, descriptions v53.
- An explicitly identified empty `gn-r05-*` scratch track through cursor 0.
  Every browser write checks an ownership token and the last snapshot guard.
  Project generation, name, track identity, track contents, and selection must
  remain equal to the opening context. Cancellation remains available after
  interference, but a foreign token cannot cancel an owned browser.
- The revised driver waits 1,000 ms after opening, 180 ms after subsequent operations,
  and another 80 ms between two independent status reads. These are prescribed
  waits, not observed host timings. A changing snapshot ends the attempt.
  An explicit post-open audition disable must read back before content-type
  writes. [E344](../evidence/experiments/e344-browser-open-resets-audition-and-populates-late.md)
  explains why the v1 opening sequence needed correction.
- Set `Devices`, verify both content index and name, reset all eight filters,
  select the unique observed `Instrument`/`Instruments` device-type entry,
  and scan for exact `Polysynth`. Repeat with `Plug-ins` and
  `Addictive Drums 2` only if the preceding condition succeeds. The result
  bank has 128 entries; a complete scan is capped at 4,096 results. Duplicate
  names retain their absolute indices. Missing filters, incomplete pages,
  changing counts, or content-type mismatches end the pass without a retry.
- Record every read and elapsed time in a new output directory; preserve the
  original error if cleanup also fails. Independently confirm cancellation.
  Scratch creation, deletion, and preserved-state checks belong to the single
  foreground session driver, outside this browser-only CLI.

The wire inventory check also uncovered an existing omission: its scraper
recognized `r.on*` but missed `registry.on*`, including `probe.gridEngine`.
Both variable names are now recognized, and the source inventory records that
existing method. Its active profile is unchanged. The probe profile now has
119 methods, hash `9e75b9a8b3938491`; normal remains 92 / `8be1975eaa99d78f`.

## Reproduction

The [E345 record](../evidence/experiments/e345-browser-content-type-readback-remains-unconfirmed.md)
contains the exact command, paired readbacks, and frozen drivers. The
[foreground session driver](../evidence/data/r05-browser/session.mjs) captures
inventories, creates one owned empty track, runs the discovery sequence,
cancels, removes the scratch, and verifies preserved inventories in one
client chain. Reproduction requires fresh build admission, current
project/target/selection checks, and a new output directory. The current
foreground driver runs v3; use the frozen attempt sources only when deliberately
reproducing the earlier condition.

## Preparation result — 2026-10-25

Offline preparation passes TypeScript typechecking, 62 focused driver/wire
tests, the Java browser ownership/stale-state harness, and extension archive
verification. The tests cover delayed content-type failure, bounded settling,
ambiguity across clamped pages, count drift, foreign browser ownership,
selection interference, and rejection of invalid page offsets and commit
requests. These initial checks did not execute the runtime classification
initializer; the first live load failed as recorded below.

Deployed with `copyProbeExtension` at `2026-10-25T15:49:54.989Z`; archive
SHA-256 `c8220a36c58834e81582185b2b961ff122bf5c5afc1c997dd8a440b15859f67a`.
No probe driver was running at the pre-deploy process check. One established
bridge client was the repository's `node --import tsx src/mcp-server.ts`
(PID 84650); other MCP processes were also present. None was interrupted.
Recheck these session facts before live writes. No scratch track has been
created before the first load, and no R05 browser request had run then.

## First-load failure and correction — 2026-10-25

The operator supplied a screenshot showing **ghostnote probe crashed** with
`invalid runtime wire classification`. `RuntimeProfile.MethodSets` still
expected 118 probe methods and 177 total classified methods after R05 raised
those counts to 119 and 178. Compilation, archive inspection, and the
TypeScript source checks did not execute that static initializer.

The new Java `runtimeProfileTest` reproduced the exact exception before the
fix. After updating the two counts, it initializes all three runtime profiles,
checks their actual method sets, counts, identities, and hashes against the
goldens, and verifies registration refusal and browser write classification.
It now runs under `check` and before all three deployment tasks. The full
`./gradlew check` passes, and the wire-golden checker reports no drift.

The corrected archive was deployed with `copyProbeExtension` at
`2026-10-25T15:55:46.321Z`, SHA-256
`a2cff156f2e7a0b380234882f77f4d95e9a6d9f0bc8048cea5392faad97730f9`.
The operator then replied “Controller loaded”. The handshake passed with
fresh initialization at `2026-10-25T15:56:56.844Z` and the expected markers.

## First live attempt and revised condition — 2026-10-25

[E344](../evidence/experiments/e344-browser-open-resets-audition-and-populates-late.md)
retains the measurements, raw readbacks, frozen v1 driver, and cleanup proof.
The experiment found `gn-scale-test` in the foreground, used one new scratch
track, and canceled during initial population before a content-type write.
The scratch was removed; original inventories and mixer selection were
independently verified. That attempt produced no route verdict.

V2 adds a guarded `auditionOff` operation after opening and refuses content
type writes while audition remains enabled. Its driver uses a 1,000 ms open
wait before the two stable reads; update and stability waits remain 180/80 ms.
This is a new bounded initialization condition after inspecting and cleaning
up the first attempt, not a repeated uncertain commit. There is still no
result-selection or commit operation.

Typechecking, 63 focused driver/wire tests, browser guard and runtime-profile
Java harnesses, archive verification, and documentation checks pass. V2 was
deployed with `copyProbeExtension` at `2026-10-25T16:03:46.833Z`, SHA-256
`7a1bdc9ea4e7becb79e672b995979ad59428364cf22318349987739785f17ebe`.
The operator replied “Controller replaced”. The v2 handshake and revised
condition then completed as recorded below.

## Research closeout and normal-profile handoff — 2026-10-25

[E345](../evidence/experiments/e345-browser-content-type-readback-remains-unconfirmed.md)
records the successful v2 handshake and bounded content-type result. The
post-open audition disable worked. After requesting `Devices`, independent
reads at 189 and 280 ms after the receipt still reported index 0, an empty
selected name, and 95,764 results. The driver canceled before filtering or
scanning. Since the initial index was also 0, this does not establish that
the setter was ignored; it establishes that the required type confirmation
was unavailable. R05 closes with the existing fallback, without a new
`resolve_device_name` contract or public tool.

The scratch was removed. Original track rows, scene count, slot occupancy,
top-level device inventories, and mixer fields compare equal; mixer selection
returned to `gn-sel`, and transport stayed stopped. No claim of full
note-content, device-state, or saved-file equality is added. Both live passes
and their source snapshots are retained under `context/evidence/data/r05-browser/`.

Verification: the focused v2 driver/wire tests (63), native-catalog tests (6),
TypeScript typecheck, Java browser guard and runtime-profile tests, archive
verification, live v2 handshake, cleanup comparisons, and documentation checks
pass. The actual browser outcome remains the explicit negative guard verdict,
not a successful discovery claim. Public tools/descriptions remain 45/v53.

The normal archive was restored with `copyExtension` at
`2026-10-25T16:08:27.003Z`, SHA-256
`454d33e7207ae2c56c47a47dbd296457ce75377728b482d45897242d1dec3a83`.
The operator must replace the controller with **ghostnote** (the normal
product), as required by [AGENTS.md](../../AGENTS.md). After confirmation,
run `npm run probe:hello`; require `normal-v1`, 92 methods,
`8be1975eaa99d78f`, expected normal markers, and fresh initialization.
That normal replacement was pending at closeout. The subsequent operator
authorization above reopens R05 and supersedes that handoff with a v3 probe
deployment; R01 follows this research.
