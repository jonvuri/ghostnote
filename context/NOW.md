---
title: Current state
kind: status
state: active
updated: 2026-10-24
---

## Now

Work is pulled from the [backlog](BACKLOG.md). The next item is
[DIET](work/instruction-diet.md): cut the instruction and artifact load,
then hand the result to another agent for review. After it, V01, R05, R01,
R02, and the P01 offline audit are the P0 items.

The phase model is retired. Phases 10 and 11 are dissolved into REL and
V10/V11; the Phase 11 design detail is in the [V10 brief](work/v10-grid-instrument.md).
Wave 4 is complete: 25 decisions, D54, and the 13-case working sequence are
the source material the backlog links to. No runtime code changed in wave 4.

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
