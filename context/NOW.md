---
title: Current state
kind: status
state: active
updated: 2026-10-23
phase: phase-9-overlap-investigation
session: 9b6j-owned-tree-census-and-third-guarded-pass
---

## Next session

**Start [9b.6j: owned-tree census and third guarded pass](plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#session-9b6j--owned-tree-census-and-third-guarded-pass).**
[E340](evidence/experiments/e340-grid-doctor-614-second-guarded-pass.md)
records the 9b.6i second pass under [D52](decisions/d52-grid-upgrade-admission-policy.md):
the boolean and mapping cases pass on 6.1.4 with the entry guards and
paired readback; the core case passes 5 of 12 commands; the disposal entry
guard refuses before the native disposal because the fresh Amplify's
77-object owned tree holds one `wKx` object that the pinned 33-class set
lacks. No disposal ran. No 6.1.4 cache exists. The operator recovered by
restart.

Read E340, the [driver instructions](../brain/src/probes/grid_doctor/README.md),
the 9b.6j plan, D52, E339, E316, and the performance ledger. First derive
the complete owned-tree class set offline: follow ancestor init methods and
static factories (`rce.bl_()` creates `wKx`; `BVs.Txc()` casts to it),
compare with the 6.0.6 tree, and trace the disposal body of each missing
class. Then produce a new `guards.json` and harness check, build, and add a
third-pass policy with a new consent string and attempt file. The driver
refuses a retry and a second second-pass on the seven records; keep every
record unchanged. Before any consent, run the read-only baseline check and
ask for full controller replacement. Compare timing with E316, E339, and
E340. Never repeat an uncertain command. Send operator questions one per
turn. 9b.7 keeps product cache enforcement, the toolkit consolidation, the
`/tmp` cleanup, and public descriptions.

## Deployment and live state

Last verified in E340's recovery check (read-only, 39 calls, after the
operator's restart).

- App: `/Applications/Bitwig Studio.app`, **6.1.4**, API 25. Jar SHA-256
  `5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`,
  35,778,607 bytes, mtime `1790948299000000000`.
- Deployed **probe** profile `phase-8-probe-v1`, 118 methods, hash
  `2e939035ea90b8b0`, marker `9b-grid-doctor-v21`; initialization
  `2026-10-23T13:54:52.195Z` after the restart. Archive SHA-256
  `c08544cd3486543aeb17735cc48423104ff2740321070c7283f8f500b303bcf8`
  (858,498 bytes), the complete `GridBreadthRules.Runtime` fix; a clean
  rebuild reproduces it. The normal archive from E330 is replaced; redeploy
  `copyExtension` for product work.
- Active project: saved `gn-grid-spike` reopened after the restart without
  saving. Only `grid-probe` (muted), `FX 1`, and `Master`. Mixer channel
  `c784d25c-b753-47ca-af8d-c83d11cfd990`; Launcher selection is unset
  (trackIndex -1). One control pair matches normalized E276: four modules
  and two cables. Saved-file identity not tested.
- No scratch track, claim, lock, failure, or uncertain state remains after
  the restart. The attempt directory `.local/grid-doctor/` holds seven
  6.1.4 records for key `d0d92c1e…c101` (six 9b.6h records and the 9b.6i
  `second-pass` record) and the three 6.0.6 records; all are byte-equal to
  their committed copies.
- The 6.0.6 install, backups, and donor sources are unchanged:
  `/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/`. The
  working folder `/Users/jonvuri/Bitwig Upgrade Work/2026-10-21/` keeps the
  clean `gn-upgrade-audit` file (SHA-256 `573084e2…4398f`).

## Material to preserve

- [E340](evidence/experiments/e340-grid-doctor-614-second-guarded-pass.md) and
  [`614-second-pass/`](evidence/data/phase9b-doctor/614-second-pass/):
  the committed copies of the six 9b.6h records, the second-pass record
  copy, baseline checks, rehearsal, deployment, hello, preflight, the
  live pass with its timing comparison and inspection, recovery, and
  [`preservation.json`](evidence/data/phase9b-doctor/614-second-pass/preservation.json)
  (223 of 224 entry files unchanged; the deployed archive changed on purpose).
- All seven 6.1.4 attempt records and the three 6.0.6 records under
  `.local/grid-doctor/`. Do not remove or edit any to enable a run.
- [E339](evidence/experiments/e339-grid-doctor-614-guarded-attempt.md) and
  `614-guarded/` (guard plan, candidate, selectors, `guards.json`, decisions,
  six attempt directories), [E338](evidence/experiments/e338-grid-doctor-614-offline-closeout.md),
  checkpoints 1–17, and the immutable
  [entry inventory](evidence/data/phase9b-doctor/614-resolution/entry-inventory.json).
  Do not regenerate the entry inventory or the 9b.6h guard resources; a
  corrected set is a new resource with a new hash.
- E331–E337 evidence, the V20 driver and its `v20-preparation` resources,
  [E316](evidence/experiments/e316-grid-doctor-606-acceptance.md) with its
  accepted 6.0.6 research cache, [E330](evidence/experiments/e330-update-audit-614-acceptance.md)
  with its saved-project copy, and [E310](evidence/experiments/e310-grid-factory-acceptance-and-breadth-close.md)
  with `gn-grid-spike-baseline.bwpreset`. Per-call timing limits remain.
- `/tmp/gn-9b6h-probe-built-5.bwextension` equals the deployed archive;
  its removal belongs to the 9b.7 `/tmp` cleanup.

Historical Grid control: `gn-grid-spike` with only `grid-probe`, `FX 1`,
and `Master`; `grid-probe` muted. The E340 recovery pair matches normalized
E276. Old claims and native IDs do not transfer to another session. See the
[roadmap](plan/ROADMAP.md) for the independent 8i17 survey and Phase 10.
