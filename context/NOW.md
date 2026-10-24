---
title: Current state
kind: status
state: active
updated: 2026-10-24
phase: phase-11-grid-authoring
session: 11a-product-grid-read-and-catalog
---

## Next session

**Start [11a — Product Grid read and catalog](plan/phase-11/README.md#11a--product-grid-read-and-catalog).**
Phase 9 is complete. The 9b step 3 planning session produced the
[Phase 11 — Grid authoring plan](plan/phase-11/README.md) and its
[ledger cost model](contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#phase-11-grid-authoring--model-before-implementation).
Four settled points shape the phase: a new phase rather than 9c; wave one
uses only the 76 doctor roles and adds no obfuscated symbol; new modules
go to a free column or an explicit position and the write refuses when the
simulated layout pass would move a module, with relocation as the first
wave-two item; mapping add and remove are in wave one, with an amount
change as remove and re-add.

11a adds `grid.read` to the normal profile, the canonical module catalog,
`read_grid_modules`, and `list_grid_module_types`, with the subset test
against `DOCTOR_ROLES`. Read the plan's sources, E302 and E304 for the
read costs, `GridGraphRead`, and `GridBreadthRules` first. The live check
needs the normal archive: `./gradlew copyExtension`, then operator
controller replacement, then `npm run probe:hello`. 11a makes no Grid
write; the first write tool is 11b.

The independent [8i17 survey](plan/phase-8/8i17-midi-musical-navigation-survey.md)
and Phase 10 remain on the [roadmap](plan/ROADMAP.md).

## Live state

- Bitwig **6.1.4**, API 25, `/Applications/Bitwig Studio.app`. Jar SHA-256
  `5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`,
  35,778,607 bytes, mtime `1790948299000000000`.
- The last deployed archive is the 9b.6j probe build
  (`e9a31bb8…`, `ghostnote probe`). The planning session changed no code
  and sent no host request. Redeploy `copyExtension` and ask for controller
  replacement before normal product work.
- Last independent read (E342): `gn-grid-spike`, only `grid-probe`, `FX 1`,
  and `Master`; control muted at -10 dB. No scratch, claim, lock, or
  uncertainty remains.
- The local cache `.local/grid-doctor/` holds the accepted 6.0.6 and 6.1.4
  records and all attempt records, unchanged. `check_grid_support` admits
  the 6.1.4 jar from it. Claims and native IDs do not survive a new session.

## Material to preserve

- The Phase 11 plan, the ledger section, and the roadmap, Phase 9, and 9b
  updates are staged for review, not committed.
- E343 and [`9b7-tool/`](evidence/data/phase9b-doctor/9b7-tool/), E342 and
  `614-third-pass/`, E341 and `614-census/`, E340 and `614-second-pass/`,
  E339 and `614-guarded/`, E338 and checkpoints 1–17, E331–E337, E316 and
  `live-v20/`, E330, and E310. Keep all attempt records and caches unchanged.
- The 6.0.6 install, backups, and donors under
  `/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/` are unchanged
  and are the baseline jar for the upgrade tool.
- Nineteen older `/tmp/gn-*` entries from 9b.5 and 9b.6i remain; they are
  not named by any plan.

Timing increases of E342 remain research limits. No stable latency claim or
timing retry is authorized. The next minor Bitwig version is the stronger
test of the upgrade tool.
