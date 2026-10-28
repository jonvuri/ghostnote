---
title: Current state
kind: status
updated: 2026-10-27
---

## Now

[B17 session 7](work/b17-extension-owned-window-scrolling.md#session-7-result)
is complete and verified live in
[E357](evidence/experiments/e357-integrated-paged-writes-live.md). The integrated
normal build composes five-device and six-chain shapes at positions 17 and 18,
duplicates and controls the sixth chain, transfers overflow devices between
chains, containers and the track, and inserts, disables, reorders and deletes
past the sixteen-device window. Width-derived admission caps are retired;
D44's six-unit budget, named-slot bounds and parameter restrictions remain.
Descriptions are v57 (46 tools); normal wire: 93 methods, hash
`d6decf985f6b1f36`.

Two live integration fixes are in the brain: a discarded population-changing
read retries once without replaying a write, and overflow deletion uses a
structural snapshot instead of an unsupported parameter cursor. An initial
composition failure now reports possible effects truthfully. All 2,601 brain
tests and extension checks pass. Both scratch fixtures were removed; original
track/device inventories and selection match the baseline. No controller
replacement is pending. No competing Ghostnote client was present.

E357's dense six-chain structure read costs six turns / median 862 ms.
Five-device composition took 26.3 s; six-chain composition took 44.4 s, close
to D44's exceptional 45 s ceiling. These are fixture-specific costs. P01 owns
the repeated proof work and the six-unit budget review; the backlog remains
ordered R01, R02, then P01. New clients load the current brain; an already
running MCP server must restart to pick up these fixes.

Earlier checkpoints remain in [E354](evidence/experiments/e354-extension-owned-container-scopes-live.md)
(session 1, extension-owned scopes) and
[E356](evidence/experiments/e356-paged-device-and-layer-reads-live.md)
(session 2, complete paged reads). Their smaller-fixture timings are historical.

[B08](work/b08-scrollable-container-scopes.md) is complete and verified live.
[E353](evidence/experiments/e353-scrollable-container-scopes-product-live.md)
records the product build composing FX Layers at top-level positions 3 and 5,
`read_devices` listing their chains, the five chain tools and a move between
the two far containers applying and reading back, the solo read back through
the cursor route and a second scope, cleanup, and one defect fixed in the
session (a scope scrolled on a track with fewer devices clamps and stays; the
adapter now re-issues the scroll). That build had 93 methods, hash
`a44ce79ed75df81b`, with `chain.scroll`; descriptions were v55 (46 tools).
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
- The integrated B17 normal `ghostnote` archive is deployed, SHA-256
  `ac17f782d2ac4252c8259c06aee242d08f2356ac48072853973ef499c6eee5d8`.
  The operator replied “Controller replaced”. Fresh handshake passed on
  initialization `2026-10-28T02:58:49.135Z`: `normal-v1`, API 25, 93 methods,
  hash `d6decf985f6b1f36`; markers `paged-windows-v3`,
  `paged-chain-controls-v1`, `paged-chain-moves-v2`, and
  `paged-device-mutations-v1`. No replacement is pending.
- Last verified foreground project: `gn-scale-test`, 11 tracks and 10 scenes.
  Both owned `gn-b17w` tracks were removed: first
  `f11d8e43-b4af-4f63-b94a-11f635dfcd38`, then
  `d5082b46-5af5-4672-81ba-3b14f59a42bb`. All original track/device inventories
  match their baseline. Mixer selection is `gn-sel` (index 8, channel
  `6fb96670-abde-4958-9147-f573a4b43918`); no Launcher slot is selected.
  Selection revision advanced 1 → 5 during the scratch lifecycles; selected
  identity is preserved. No playback launch or project save ran. Final scope
  status: closed, 435 aims, zero refusals; no write block. Owned drivers exited;
  unrelated editor processes were left alone. Re-check live claims, project,
  selection, clients and targets on resume. [E357](evidence/experiments/e357-integrated-paged-writes-live.md)
  retains attempts, corrections, timings and preservation comparisons.
- Preserved V01 project: `engram purifico`, saved under the Ghostworks construct
  of the same name. It contains Addictive Drums 2 (operator set GM mapping),
  Engram Bass, Purifico Stabs, FX 1, and Master. The first two Launcher scenes
  hold six verified clips, accepted after operator audition. Playback state
  has not been re-read since that audition. The last mixer read showed the
  three musical tracks at -10 dB, centered, unmuted, and unsoloed.
  Source contributions are confirmed; the saved-project path and verification
  summary are in the V01 brief. Its temporary working files were removed.
  Re-read project, target, and selection before further writes.
  Current source: 46 normal tools, descriptions v57; running server version unconfirmed.
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
