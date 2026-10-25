# V14 — Add devices and presets by name

## Result — 2026-10-25

Complete. [E351](../evidence/experiments/e351-device-name-resolution-live.md)
records the live pass: `resolve_device_name` resolved Polymer (stock UUID),
TX16Wx as VST3 and as CLAP (ambiguous until `sourceKind` chose one), and an
owned Instrument Layer preset in a sound-content location added through
Bitwig Settings during the session. Each identity inserted through the
unchanged `add_devices` route and read back independently; the plug-in host
loaded exactly the resolved bundles; the preset read back with its four named
layer chains. Removing the location dropped the root and the name on the
next call. The scratch track and temporary files were removed; the project
and the neighbouring track read back unchanged.

Implementation: `brain/src/discovery/` (binary readers, prefs locations,
VST3/CLAP indexes, host context from the Bitwig process, roots, source
scanners, resolver) and `brain/src/surface/device-discovery.ts` (the tool).
The tool reads only local files and `ps`/`plutil` output; it uses no
internal host symbol and makes no Bitwig call once a handshake is cached.
Admission pins the 6.1.4 jar fingerprint and validates any other build at run
time from the prefs decode, index state files, index decode, and stock-device
decode; a failed check yields `partial` or `unsupported` with the reason.
Descriptions are v54 with 46 tools; the ledger has a
[resolution section](../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#device-name-resolution-e351).

An independent review found four P2 issues, all fixed with tests: unindexed
bundles beside an indexed one in a vendor directory were hidden (full relative
paths are compared now); missing index state files did not constrain plug-in
scopes (they are `incomplete` now); one file under two overlapping content
roots was a false ambiguity (one candidate with `location.alsoUnder` now);
and the bounded bundle check needed explicit semantics (a plug-in claim is
about Bitwig's index; deeper directories are counted, not searched).

Limits and follow-ups: macOS only; VST2 and vendor presets are outside scope;
the bundle freshness check covers two directory levels; a layer container
inserted after position 2 must be moved before its chains can be read (the
existing `read_devices` bound); the result carries full per-root coverage and
is verbose for all-kind queries. No new D record was needed.

## Goal

Implement public name discovery and use its results to add a stock Bitwig
device, a VST3 plug-in, a CLAP plug-in, and a Bitwig preset from a custom
sound-content location. This is the next session in the [backlog](../BACKLOG.md),
a workflow follow-up to [V01](v01-engram-purifico.md), and owns the implementation
handoff from [R05](r05-browser-name-resolution.md) and
[R06](r06-native-index-discovery.md).

User direction (2026-10-25): “explicitly adding all of those categories and
doing both a VST3 and a CLAP plugin.” Planning only was requested in this
session; implementation and live verification begin in the next session.

V01 resolved two installed preset filenames and inserted them through the
existing file route. It did not implement general name discovery or exercise
adding a named plug-in. V14 must close that gap through public tools; a probe,
manual ID lookup, or fixture-specific filesystem search is insufficient.

## Required workflow

For each case, start with a name and source kind, resolve through the public
interface, feed the returned identity to the existing guarded insertion route,
and independently read the resulting device chain. The caller must not supply
an identity or preset file path obtained outside the resolver.

| Case | Discovery result | Required live outcome |
|---|---|---|
| Stock Bitwig device | Native UUID from the running installation | Add the named stock device and verify its identity and target chain |
| VST3 plug-in | VST3 ID, source location, available vendor/architecture | Add the VST3 version and independently verify both identity and format |
| CLAP plug-in | CLAP ID, source location, available vendor/architecture | Add the CLAP version and independently verify both identity and format |
| Bitwig preset in a custom sound-content location | Exact `.bwpreset` path with its configured root | Discover a preset under a newly added root, load it, and verify the resulting device chain and distinguishing preset state |

All four cases are mandatory and receive separate verdicts. A VST3 success
cannot stand in for CLAP, nor can a default-library preset stand in for the
custom-root case. Pick installed, loadable examples after admission; R05 found
Addictive Drums 2 as VST3 and Diva as CLAP. Prefer the same product in both
formats when available to exercise format disambiguation, but do not make that
a prerequisite. No new plug-in installation or purchase is required.

Use an owned copy of an existing self-contained Bitwig preset for the custom
root case, with known distinguishing parameters or chain structure. Verify
those properties independently after insertion; a matching device name alone
does not establish preset-state fidelity. State the verified scope without
claiming byte-for-byte preset equivalence.

## Implementation scope

**Discover roots from configuration.** Identify the running application,
active version, and effective settings directory. Read configured My Library,
package, sound-content, music, and plug-in locations; resolve defaults and
respect removed standard locations. Handle Bitwig's startup environment
override `BITWIG_USER_SETTINGS_DIR` using the host's effective context, not
Ghostnote's environment or the newest prefs file on disk. On macOS the override
selects a directory under `~/Library/Application Support/Bitwig/`. Custom
packages may require an `Installed Bitwig Packs` child. The internal effective
root getter is a candidate mechanism to validate, not an established live API.

**Use the fast discovery route.** Prefer installed native resources/catalogs,
the verified VST3/CLAP index readers, and recursive Bitwig-preset enumeration
with metadata reading under discovered roots. The native/preset index preamble
need not be decoded to meet this workflow. Normal discovery for the four live
cases must work without opening a browser popup. Retain R05's browser route as
a fallback candidate where useful; do not silently incur it or report an
unsupported scope as complete. If exposed, identify the fallback and its UI
and latency effects and protect any existing user browser session.

**Expose a truthful public contract.** Start from R05's proposed
`resolve_device_name` contract: exact name, optional source kind/root,
format-specific insertion identity, location, vendor/architecture when
available, and explicit coverage. Final tool naming and schema are implementation
choices. Preserve duplicate formats, installations, and preset paths; do not
silently prefer CLAP/VST3, normalize distinct names, or choose an arbitrary
candidate. Distinguish resolved, ambiguous, not found, incomplete, and unsupported
outcomes. A unique match or absence claim requires complete coverage of the
requested scope. Discovery does not mutate the project; insertion remains a
separate guarded action. Vendor-native preset formats remain outside scope
under [D22](../decisions/d22-non-native-plugin-preset-loading-is-out-of-scope.md).

**Refresh and compatibility belong to this implementation.** Refresh configured
roots and invalidate affected discovery results when preferences change.
Separate configuration freshness, filesystem availability, and index freshness.
Missing drives, permissions, failed scans, stale records, unsupported types,
and changes during reads must retain useful partial results with concrete
limits. Do not treat a matching bundle timestamp as proof of full inventory.
Use build fingerprints, minor-version regression fixtures, and runtime handling
for unknown builds. Provide an automatic resolution/validation path for the
prefs/index mappings where feasible, following the approach used for Grid;
an unsuccessful validation must yield a useful unsupported/incomplete result.
Do not claim automatic support merely because the version string is recognized.
Reuse suitable upgrade infrastructure without expanding V14 into unrelated
Grid work or requiring a new doctor run for each lookup.

Update the public schemas, descriptions, help, inventory, and relevant tests
together under [tool maintenance](../README.md#tool-maintenance). Register any
new internal-host dependencies and their refusal boundary. Choose the smallest
production integration that satisfies this workflow; the research Python
readers are evidence, not a prescribed production architecture.

## Verification and live bounds

Offline checks cover multiple/custom roots, defaults and overrides, explicit
removal of standard locations, spaces/Unicode, duplicate names across formats
and roots, absent names, malformed data, stale/inaccessible sources, and an
unknown-build validation success/failure path. Use relevant fixtures and
integration tests; do not infer untested platform support from the macOS pass.

Run the live work on owned scratch tracks in a freshly identified project.
Do not modify the accepted V01 musical arrangement. Follow repository admission,
project/selection/target guards, one-writer discipline, and independent readback.
If deployment is needed, deploy the intended product, have the operator replace
the controller, then verify the fresh handshake before live work. Prior session
handshakes and target claims do not carry forward.

Exercise configuration refresh in the same running Ghostnote session: establish
a baseline, add the owned preset directory through Bitwig Locations, resolve
and insert its preset without passing that directory as a manual discovery
configuration, then remove the location and confirm it leaves the configured
search scope. No Bitwig or Ghostnote restart should be needed. Use an exact root
filter when disambiguation requires it; that must filter discovered roots,
not bypass root discovery. Also demonstrate ambiguity for a deliberately
ambiguous name and successful explicit disambiguation without an unintended
insertion. Controlled fixtures may supply the duplicate if installed content
does not.

Remove owned scratch devices/tracks and temporary location entries, verify
relevant preserved state, and remove owned temporary files after they are no
longer configured or loaded. Inspect uncertain effects before further writes.
Retain correct effects and truthful partial results under D54; no blanket
full-project recovery capture is prescribed. No playback is required to prove
identity/insertion; operator audition is separate if useful.

Measure root discovery and lookup, initial and cached reads, and insertion/
readback separately. Record source sizes, cache conditions, host-call counts,
and whether any popup appeared. E349's 7.69 ms median is a local research
measurement, not a production budget. Avoid making the earlier 9–11 second
browser path the ordinary lookup cost. Update the relevant
[performance ledger](../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md) rows and
call-budget tests for changed public paths.

## Completion and handoff

V14 closes when the public implementation, relevant offline checks, all four
live insertion cases, configuration refresh/removal, ambiguity handling, and
cleanup pass. Record category-specific identities, independent readback,
performance, tested builds, and any remaining limitations. If a category fails,
keep its outcome explicit and the required workflow unfinished rather than
crediting research or another format as a substitute.

Use E records for durable live measurements and a D record if a durable design
choice needs one. Update NOW, backlog, capability facts, and public tool counts
as applicable; stage task changes without committing. R01, R02, and P01 follow
V14 in the work queue.

Sources: [E348 native identities](../evidence/experiments/e348-browser-native-result-identities.md),
[E349 direct indexes](../evidence/experiments/e349-direct-plugin-index-discovery.md),
[E350 configured roots](../evidence/experiments/e350-library-roots-from-preferences.md).
