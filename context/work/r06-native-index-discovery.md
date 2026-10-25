# R06 — Direct native-index discovery

Feasibility research complete for the bounded offline pass, requested after
[R05](r05-browser-name-resolution.md):
“Reading the indexes directly sounds promising. Let's look into that next.”

## Scope

Read Bitwig's existing disk indexes and plug-in metadata caches without opening
a browser or invoking the host. Determine whether names can be joined to native
UUIDs, VST3/CLAP IDs, and Bitwig preset paths. Trace installed 6.1.4 readers to
establish framing, identity fields, and freshness limits; do not infer records
from arbitrary string matches. Preserve source files and the normal controller.

Build bounded offline research readers where feasible, compare their results
with R05's independently captured browser samples, and measure local read/parse
and lookup costs. Record unsupported formats, duplicate identities, stale or
failed entries, and incomplete root coverage explicitly. This work does not add
a public resolver or claim that cached records equal the current host inventory.

## Completion criteria

- Concrete feasibility verdict for each source kind, with reproducible evidence.
- Timings separated from host/browser costs and qualified by cache conditions.
- Parser checks for malformed/truncated input where a reader is implemented.
- A recommended next implementation or research step and its remaining limits.

## Result and handoff

[E349](../evidence/experiments/e349-direct-plugin-index-discovery.md) proves a
popup-free VST3/CLAP route: 407 entries across four explicit scopes, all 28
previous plug-in identity samples matched, and both complete frozen instrument
name lists matched (49 VST3, 12 system CLAP). Read/parse/join plus bundle stats
measured 7.69 ms median and 8.35 ms p95 across 50 warm/unspecified-cache reads.
The research reader, audit, tests, hashes, and timings are retained with E349.

The verdict is partial by source kind: native-device and Bitwig-preset indexes
have an undecoded preamble; no identity claim is made for those files. At the
E349 closeout, configured root discovery and refresh behavior remained
unproved; the follow-up below resolves the sound-content configuration case.
Existing file timestamps match but do not establish complete current host coverage. E349 records the
specific follow-up and recommends direct indexes for supported scopes with the
R05 popup as fallback. At that closeout implementation was unscheduled. E349
added no resolver, insertion route, controller deployment, or live write.

Eleven focused offline tests and the independent audit pass. Documentation link
and diff checks pass. Public implementation is now assigned to
[V14](v14-add-devices-by-name.md), next in the backlog.

## Configured-root follow-up

[E350](../evidence/experiments/e350-library-roots-from-preferences.md) establishes
an independent preferences route for location discovery. The bounded reader
extracts My Library, package configuration, and sound-content/music/plug-in
lists. A temporary sound-content root was added and removed through Settings;
separate disk reads detected both changes while Bitwig stayed running, and all
extracted location settings and the project/selection context were restored.
Seven focused parser/configuration tests pass.

Use preferences plus the running application root to discover configured
sources. Refresh configuration and report incomplete or inaccessible scopes
explicitly so future additions do not silently disappear. Default/override
resolution, removed standard locations, version admission, and index freshness
still need implementation work. Custom library/package relocation was traced
statically, not live-cycled. This research added no public resolver;
[V14](v14-add-devices-by-name.md) now owns implementation and all four live
source-category insertion checks.
