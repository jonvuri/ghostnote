---
title: Current state
kind: status
updated: 2026-10-25
---

## Now

[V14 — Add devices and presets by name](work/v14-add-devices-by-name.md) is
next for implementation and live verification: stock Bitwig device, VST3, CLAP,
and a Bitwig preset from a newly added sound-content location. It owns public
resolution, configured-root refresh, ambiguity handling, and build compatibility.
The brief is prepared; implementation has not begun.

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
These results remain research; V14 now owns public resolver implementation.

The [backlog](BACKLOG.md) now orders V14, R01, R02, then the P01 offline audit.
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
- The normal `ghostnote` archive was restored with `copyExtension` at
  `2026-10-25T16:50:22.916Z` (SHA-256
  `1024978cd6c65ad93519675191b14fdcd900845d62afc3a098f6d125ca9e0214`).
  The operator confirmed replacement with “Controller replaced”.
  `npm run probe:hello` passed: `normal-v1`, API 25, 92 methods,
  hash `8be1975eaa99d78f`, expected normal build markers, and fresh initialization
  at `2026-10-25T16:53:58.441Z`. The R05 operational handoff is complete.
- Current foreground project: `gn-scale-test`, 11 tracks and 10 scenes.
  E348 verified the original track rows, 110 slot occupancy reads (25 filled),
  16 top-level devices, and mixer fields after scratch cleanup. Transport was
  stopped; the mixer selection was restored to `gn-sel`. No R05 scratch track
  or popup remains. Re-read project, target, and selection before more writes.
- Preserved V01 project: `engram purifico`, saved under the Ghostworks construct
  of the same name. It contains Addictive Drums 2 (operator set GM mapping),
  Engram Bass, Purifico Stabs, FX 1, and Master. The first two Launcher scenes
  hold six verified clips, accepted after operator audition. Playback state
  has not been re-read since that audition. The last mixer read showed the
  three musical tracks at -10 dB, centered, unmuted, and unsoloed.
  Source contributions are confirmed; the saved-project path and verification
  summary are in the V01 brief. Its temporary working files were removed.
  Re-read project, target, and selection before further writes.
  Baseline: 45 normal tools, descriptions v53.
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
