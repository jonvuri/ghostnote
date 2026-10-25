---
title: Current state
kind: status
updated: 2026-10-25
---

## Now

The next item in the [backlog](BACKLOG.md) is V01: build a useful MIDI
sketch with supplied material and existing tools. R05, R01, R02, and the
P01 offline audit follow in P0.

[DIET](work/instruction-diet.md) is complete and independently reviewed.
Use the shorter [context guide](README.md) for relevant reading. D54 governs
inherited prescriptions; P01 examines runtime checks and recovery costs.
The [V10 brief](work/v10-grid-instrument.md) retains the Grid design and
identifies proposed mechanisms for assessment during implementation.

## Live state

- Bitwig **6.1.4**, API 25, `/Applications/Bitwig Studio.app`. Jar SHA-256
  `5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`,
  35,778,607 bytes, mtime `1790948299000000000`.
- The last deployed archive is the 9b.6j probe build (`e9a31bb8…`,
  `ghostnote probe`). Redeploy `copyExtension` and ask for controller
  replacement before normal product work; then run `npm run probe:hello`.
- Last independent read (E342): `gn-grid-spike`, only `grid-probe`, `FX 1`,
  and `Master`; control muted at -10 dB. No scratch, claim, lock, or
  uncertainty remains. Baseline: 45 normal tools, descriptions v53.
- `.local/grid-doctor/` holds the accepted 6.0.6 and 6.1.4 records and all
  attempt records; `check_grid_support` admits the 6.1.4 jar from it.

## Preserve

- The 6.0.6 install, backups, and donors under
  `/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/`: the baseline
  jar for the upgrade tool.
- Evidence data under `evidence/data/phase9b-doctor/` and the E records it
  belongs to. Nineteen older `/tmp/gn-*` entries from 9b.5 and 9b.6i remain
  and are not named by any plan.
- Timing increases in E342 are research limits; no stable latency claim or
  timing retry is authorized.
