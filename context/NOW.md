---
title: Current state
kind: status
updated: 2026-10-26
---

## Now

[B17](work/b17-extension-owned-window-scrolling.md) session 1 is complete and
verified live.
[E354](evidence/experiments/e354-extension-owned-container-scopes-live.md)
records the extension owning the container scopes: `chain.observe` and
self-settling chain writes replace `chain.scroll` and the brain's scope state,
the E353 shape repeats with the same results at positions 3 and 5, an
isolated far container read costs 6 turns and about 140 ms (was 11 turns,
305 ms), and `batch.run` continues across a deferred op (the first attempt
found the executor refusing one). The normal profile is 93 methods, hash
`d6decf985f6b1f36`, marker `extension-owned-scopes-v1`; descriptions stay
v55. Session 2 (paged reads of the chain, device, and 16-wide top-level
windows inside `chain.observe`) and session 3 (writes past the first page,
cap retirement) follow the interface decisions recorded in the brief.

[B08](work/b08-scrollable-container-scopes.md) is complete and verified live.
[E353](evidence/experiments/e353-scrollable-container-scopes-product-live.md)
records the product build composing FX Layers at top-level positions 3 and 5,
`read_devices` listing their chains, the five chain tools and a move between
the two far containers applying and reading back, the solo read back through
the cursor route and a second scope, cleanup, and one defect fixed in the
session (a scope scrolled on a track with fewer devices clamps and stays; the
adapter now re-issues the scroll). The normal profile is 93 methods, hash
`a44ce79ed75df81b`, with `chain.scroll`; descriptions are v55 (46 tools).
The `containerScope` ledger row has a far-position variant (about 305 ms, 11
turns). [D55](decisions/d55-proved-routes-run-with-one-readback.md) sets the new
runtime posture: routes proved in tests and E records are trusted at
runtime, a tool call makes one independent readback at the end, and
concurrent operator edits are not a design case.
P01 then takes the container-scope read policy (now `ContainerScopes.choose`
in the extension: skip non-containers, rotate the far scope, scope count and
width) and rebuilds staged `compose_devices` under D55 (direct chain
insertion in one batch, one readback, re-derived D44 weights), then applies
the rule to the other staged paths.
The running Ghostnote MCP server keeps the brain it started with; restart it
to serve the B17 wire (the B08 brain sends `chain.scroll`, which the running
extension no longer has). R01 and R02 follow in the [backlog](BACKLOG.md).

[V14 — Add devices and presets by name](work/v14-add-devices-by-name.md) is
complete. `resolve_device_name` (46 tools, descriptions v54 then) resolves an exact
stock-device, VST3, CLAP, or Bitwig-preset name from the running host's
installation, preferences, indexes, and content locations with no Bitwig call.
[E351](evidence/experiments/e351-device-name-resolution-live.md) records all
four live insertions, configuration refresh and removal in one session,
ambiguity with explicit disambiguation, and cleanup.

V01's [Engram / Via Purifico sketch](work/v01-engram-purifico.md) is complete:
two saved eight-bar Launcher sections at 130 BPM, independently verified and
accepted after operator audition. No blocking V01 implementation defect was
observed. [R05](work/r05-browser-name-resolution.md) research is complete
with a positive native-discovery route. [E348](evidence/experiments/e348-browser-native-result-identities.md)
records 60 sampled native/VST3/CLAP/preset identities checked against independent
sources, successful cleanup, and the limits of coverage. The brief proposes a
minimal resolver contract; no public resolver or new insertion route was added.
Normal controller restoration and its fresh handshake are complete. Existing
catalog/explicit-ID/path tools remain the product interface.

[R06](work/r06-native-index-discovery.md) establishes a fast offline plug-in
route: 407 VST3/CLAP entries, 28 identity checks, and complete prior instrument
name lists match. [E349](evidence/experiments/e349-direct-plugin-index-discovery.md)
records 7.69 ms median local read/parse/check cost, an undecoded native/preset
preamble, and remaining index-refresh limits.
[E350](evidence/experiments/e350-library-roots-from-preferences.md) adds a
preferences-based root-discovery route: a temporary sound-content location was
detected on disk after addition and removal while Bitwig remained running.
Original location settings and project/selection context were verified afterward.
V14 turned these results into the public resolver.

The [backlog](BACKLOG.md) now orders B08, R01, R02, then the P01 offline audit.
R01 also assesses the first-save annotation-continuity limitation
recorded in the V01 closeout.

[DIET](work/instruction-diet.md) is complete and independently reviewed.
Use the shorter [context guide](README.md) for relevant reading. D54 governs
inherited prescriptions; P01 examines runtime checks and recovery costs.
The [V10 brief](work/v10-grid-instrument.md) retains the Grid design and
identifies proposed mechanisms for assessment during implementation.

## Live state

- Bitwig **6.1.4**, API 25, `/Applications/Bitwig Studio.app`. Jar SHA-256
  `5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`,
  35,778,607 bytes, mtime `1790948299000000000`.
- The normal `ghostnote` archive carries the B17 session-1 build with the
  review fix (SHA-256
  `de1ace51bcd018c7d00e74ff67799327a5ab71127d9f3a21415d7577b15d9def`; it
  refuses `clip.read` and `cursor.pointExpanded` inside a batch). The
  operator confirmed replacement; `npm run probe:hello` passed: `normal-v1`,
  API 25, 93 methods, hash `d6decf985f6b1f36`, the
  `extension-owned-scopes-v1` marker, fresh initialization at
  `2026-10-27T03:49:38.533Z` (UTC). E354 ran on the previous archive of this
  build (`f286e47e…cbc7`, same methods and hash, without the batch refusal).
  The B17 archive `e877ccb6…e5438` before it lacked the `batch.run`
  continuation and was replaced within the session. A running Ghostnote MCP
  server started before this session carries the B08 brain and must restart
  before it can read or write layer chains against this extension.
- Current foreground project: `gn-scale-test`, 11 tracks and 10 scenes.
  E354 deleted its scratch track `gn-b17s`; `list_tracks` then listed the
  original 11 tracks, the four-chain `gn-lay4` structure read back unchanged,
  and the mixer selection stayed on `gn-sel`. The container scopes rested at
  positions 0, 1, and 5 of the deleted track; the extension re-aims them on
  the next operation. No scratch track, solo flag, or popup remains. Re-read
  project, target, and selection before more writes.
- Preserved V01 project: `engram purifico`, saved under the Ghostworks construct
  of the same name. It contains Addictive Drums 2 (operator set GM mapping),
  Engram Bass, Purifico Stabs, FX 1, and Master. The first two Launcher scenes
  hold six verified clips, accepted after operator audition. Playback state
  has not been re-read since that audition. The last mixer read showed the
  three musical tracks at -10 dB, centered, unmuted, and unsoloed.
  Source contributions are confirmed; the saved-project path and verification
  summary are in the V01 brief. Its temporary working files were removed.
  Re-read project, target, and selection before further writes.
  Baseline: 46 normal tools, descriptions v55.
- `.tmp/grid-doctor/` holds the local accepted 6.0.6 and 6.1.4 records and
  attempt records; the admission reader and doctor drivers now use this path.
  The whole `.tmp/` directory is ignored. Experimental evidence remains under
  `context/evidence/`; historical records retain their original `.local/` paths.
  A running brain process must restart to pick up the changed default path.
  [V10](work/v10-grid-instrument.md#operational-doctor-storage) will replace
  this development path with durable per-user application-data storage.

## Preserve

- The 6.0.6 install, backups, and donors under
  `/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/`: the baseline
  jar for the upgrade tool.
- Evidence data under `evidence/data/phase9b-doctor/` and the E records it
  belongs to. Nineteen older `/tmp/gn-*` entries from 9b.5 and 9b.6i remain
  and are not named by any plan.
- Timing increases in E342 are research limits; no stable latency claim or
  timing retry is authorized.
