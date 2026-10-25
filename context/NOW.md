---
title: Current state
kind: status
updated: 2026-10-25
---

## Now

V01's [Engram / Via Purifico sketch](work/v01-engram-purifico.md) is complete:
two saved eight-bar Launcher sections at 130 BPM, independently verified and
accepted after operator audition. No blocking V01 implementation defect was
observed. R05 is next in the [backlog](BACKLOG.md), followed by R01, R02, and
the P01 offline audit. R01 also assesses the first-save annotation-continuity
limitation recorded in the V01 closeout.

[DIET](work/instruction-diet.md) is complete and independently reviewed.
Use the shorter [context guide](README.md) for relevant reading. D54 governs
inherited prescriptions; P01 examines runtime checks and recovery costs.
The [V10 brief](work/v10-grid-instrument.md) retains the Grid design and
identifies proposed mechanisms for assessment during implementation.

## Live state

- Bitwig **6.1.4**, API 25, `/Applications/Bitwig Studio.app`. Jar SHA-256
  `5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`,
  35,778,607 bytes, mtime `1790948299000000000`.
- The normal `ghostnote` archive was deployed with `copyExtension` on
  2026-10-25 (SHA-256 `14fe6b8173715b68927c1ec49c70216da2de1b0e44f27eecd11c38af9c9d7fae`).
  Operator confirmed replacement with “Replaced”. `npm run probe:hello`
  passed: `normal-v1`, API 25, 92 methods, hash `8be1975eaa99d78f`,
  expected build markers, and fresh initialization at `2026-10-25T15:00:24.972Z`.
- Current project: `engram purifico`, saved under the Ghostworks construct
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
