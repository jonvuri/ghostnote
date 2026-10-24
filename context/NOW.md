---
title: Current state
kind: status
state: active
updated: 2026-10-23
phase: phase-9-overlap-investigation
session: 9b-step-3-build-out-planning
---

## Next session

**Start [9b step 3 — Build-out planning](plan/phase-9/9b-grid-breadth-discovery-and-build-out.md#step-3--build-out-planning).**
[E343](evidence/experiments/e343-grid-admission-gate-and-upgrade-tool.md)
completes 9b.7. Steps 1 and 2 are closed: E310 for breadth, E316 and E342
for the two-build doctor, E343 for the product gate and the upgrade tool.
Step 3 plans the build-out without implementation: verbs, module families,
Grid flavours, layout and overlap policy, consumer cleanup on delete, the
cost model from the survey, failure handling, and the tool surface. The
output is an implementation plan as a new phase or 9c with a ledger cost
model. Each planned Grid write tool calls `requireGridWriteAdmission`
before its first host call. Read E310, E316, E342, E343,
[D52](decisions/d52-grid-upgrade-admission-policy.md),
[D53](decisions/d53-ordinary-operator-consent.md), the
[9a close-out](evidence/experiments/e299-grid-spike-close-out.md), and the
[performance ledger](contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md).

The independent [8i17 survey](plan/phase-8/8i17-midi-musical-navigation-survey.md)
and Phase 10 remain on the [roadmap](plan/ROADMAP.md).

## Live state

- Bitwig **6.1.4**, API 25, `/Applications/Bitwig Studio.app`. Jar SHA-256
  `5c2b1895bbb9e7d08d9216de421985bb1f24b2ee62762c9451b4fe847df2469f`,
  35,778,607 bytes, mtime `1790948299000000000`.
- The last deployed archive is the 9b.6j probe build
  (`e9a31bb8…`, `ghostnote probe`). Redeploy `copyExtension` and ask for
  controller replacement before normal product work. 9b.7 changed no
  extension code; no deployment or replacement happened in 9b.7.
- Last independent read (E342): `gn-grid-spike`, only `grid-probe`, `FX 1`,
  and `Master`; control muted at -10 dB. No scratch, claim, lock, or
  uncertainty remains. 9b.7 sent no host request.
- The local cache `.local/grid-doctor/` holds the accepted 6.0.6 and 6.1.4
  records and all attempt records, unchanged. `check_grid_support` admits
  the 6.1.4 jar from it. Claims and native IDs do not survive a new session.

## Material to preserve

- E343 and [`9b7-tool/`](evidence/data/phase9b-doctor/9b7-tool/): the
  rehearsal baseline, both check reports and logs, the continuation
  comparison, `descriptions-v53.json`, the cleanup inventory and script,
  `tmp-preserved.zip`, and the test outputs. Session changes are staged for
  review, not committed.
- E342 and `614-third-pass/`, E341 and `614-census/`, E340 and
  `614-second-pass/`, E339 and `614-guarded/`, E338 and checkpoints 1–17,
  E331–E337, E316 and `live-v20/`, E330, and E310. Keep all attempt records
  and caches unchanged.
- The 6.0.6 install, backups, and donors under
  `/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1/` are unchanged
  and are the baseline jar for the upgrade tool.
- The session-owned `/tmp/gn-9b6g-*`, `gn-9b6h-*`, `gn-9b6j-*`, `gn-614-*`,
  and `gn-9b3-*` files are removed. Nineteen older `/tmp/gn-*` entries from
  9b.5 and 9b.6i remain; they are not named by any plan.

Timing increases of E342 remain research limits. No stable latency claim or
timing retry is authorized. The upgrade rehearsal is not a blind test; the
next minor version is the stronger test of reuse.
