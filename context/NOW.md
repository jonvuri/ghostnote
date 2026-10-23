---
title: Current state
kind: status
state: active
updated: 2026-10-23
phase: phase-9-overlap-investigation
session: 9b6i-recovered-baseline-and-second-guarded-pass
---

## Next session

**Start [9b.6i: recovered baseline and second guarded pass](plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6i--recovered-baseline-and-second-guarded-pass).**
[E339](evidence/experiments/e339-grid-doctor-614-guarded-attempt.md)
completes the 9b.6h preparation under [D52](decisions/d52-grid-upgrade-admission-policy.md):
body-change report, changed-body decisions, runtime entry guards, the V21
driver, and the V21 probe. The live result is incomplete: the boolean case
passes with the guards; the mapping removal ran once as an uncertain write
and refused on the paired readback in the last build-pinned fixture rule;
the core case did not run. That rule is fixed, tested, and built but not
deployed. No 6.1.4 cache exists.

Read E339, the [driver instructions](../brain/src/probes/grid_doctor/README.md),
the 9b.6i plan, D52, E316, and the performance ledger. Before any consent,
rehearse every read-only path on the installed build: the control read and
a survey read of each fixture preset. Then deploy the built probe
(`/tmp/gn-9b6h-probe-built-5.bwextension` equals the current `extension/`
build, SHA-256 `c08544cd…bcf8`), ask for full controller replacement, run
hello, and obtain fresh consent with a new consent string and a separate
attempt-file policy. The driver refuses a seventh attempt on the six
existing records; keep every record unchanged. Compare per-call timing with
E316 and E339. Never repeat an uncertain command. 9b.7 keeps product cache
enforcement, the toolkit consolidation, the `/tmp` cleanup, and public
descriptions. Do not repeat the accepted 6.0.6 doctor or the 9a audio flow.

## Deployment and live state

Last verified in E339's recovery check (read-only, 35 calls).

- App: `/Applications/Bitwig Studio.app`, **6.1.4**, API 25. Jar SHA-256
  `5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`,
  35,778,607 bytes, mtime `1790948299000000000`.
- Deployed **probe** profile `phase-8-probe-v1`, 118 methods, hash
  `2e939035ea90b8b0`, marker `9b-grid-doctor-v21`; initialization
  `2026-10-23T04:09:14.066Z` after the operator's restart. Bridge PID 99464.
  Archive SHA-256 `4c2e738166473f15310fbf62e0e024e9f6f602bfad2d25733e3b16d7ea05d98a`
  (858,389 bytes). This archive lacks the final `compareFixture` fix. The
  normal archive from E330 is replaced; redeploy `copyExtension` for product
  work.
- Active project: saved `gn-grid-spike` reopened after restart. Only
  `grid-probe` (muted), `FX 1`, and `Master`. Mixer channel
  `c784d25c-b753-47ca-af8d-c83d11cfd990`; Launcher selection is unset
  (trackIndex -1). One control pair matches normalized E276: four modules
  and two cables. Transport reported stopped. Saved-file identity not
  tested.
- No scratch track, claim, lock, failure, or uncertain state remains after
  the restart. The six attempt records for fingerprint key `d0d92c1e…c101`
  under `.local/grid-doctor/` are retained; the sixth records the uncertain
  mapping removal. The three 6.0.6 records are byte-equal to their copies.
- The 6.0.6 install, backups, and donor sources are unchanged:
  `/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/`. The
  working folder `/Users/jonvuri/Bitwig Upgrade Work/2026-10-21/` keeps the
  clean `gn-upgrade-audit` file (SHA-256 `573084e2…4398f`).

## Material to preserve

- [E339](evidence/experiments/e339-grid-doctor-614-guarded-attempt.md) and
  [`614-guarded/`](evidence/data/phase9b-doctor/614-guarded/): guard plan,
  candidate, selectors, guards, body-change report, decisions, six attempt
  directories, preflight and recovery checks, deployment and test logs, and
  the [preservation check](evidence/data/phase9b-doctor/614-guarded/preservation.json)
  (223 of 224 entry files unchanged; the deployed archive changed on purpose).
- All six attempt records under `.local/grid-doctor/` and the three 6.0.6
  records. Do not remove or edit any to enable a run.
- [E338](evidence/experiments/e338-grid-doctor-614-offline-closeout.md),
  checkpoints 1–17, the handoff supplement, and the immutable
  [entry inventory](evidence/data/phase9b-doctor/614-resolution/entry-inventory.json).
  Do not regenerate the entry inventory.
- E331–E337 evidence, original selectors, the V20 driver and its
  `v20-preparation` resources, [E316](evidence/experiments/e316-grid-doctor-606-acceptance.md)
  with its accepted 6.0.6 research cache, [E330](evidence/experiments/e330-update-audit-614-acceptance.md)
  with its saved-project copy (72,901 bytes, SHA-256 `b01ba21f…9970b`),
  and [E310](evidence/experiments/e310-grid-factory-acceptance-and-breadth-close.md)
  with `gn-grid-spike-baseline.bwpreset`. Per-call timing limits remain.

Historical Grid control: `gn-grid-spike` with only `grid-probe`, `FX 1`,
and `Master`; `grid-probe` muted. The E339 recovery pair matches normalized
E276. Old claims and native IDs do not transfer to another session. See the
[roadmap](plan/ROADMAP.md) for the independent 8i17 survey and Phase 10.
