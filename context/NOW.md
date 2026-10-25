---
title: Current state
kind: status
state: active
updated: 2026-10-24
phase: overlap-planning
session: wave-4-selected-cleanup-and-recovery-floor
---

## Next session

**Continue [W4-D](plan/overlap/wave-4/sessions.md#w4-d--select-the-matrix-and-implementation-roadmap)
to map the workflow templates to capability requirements and a roadmap.**
The user selected [P01](plan/overlap/wave-4/work-sessions.md#p01--edit-path-performance-and-recovery-cost) performance work
on repeated parameter inventories, full clip captures, and useful D19
simplification. Expanded R01 combines Producer Pal formats, dense claims,
and naming. C01 confirms and removes obsolete stable-v1 machinery. I01
records per-tool internal dependencies and refusal behavior. Full retention
research stays deferred unless evidence shows a concrete cost.

The staged review of 2026-10-24 found the set coherent and closed its gaps
([W4-024, W4-025](plan/overlap/wave-4/decisions.md)). Phase 11 Grid writes
record no inverse and have no revert path; the plan and ledger are updated.
Host undo stays operator-only; the research-profile `app.undo` method is not
exposed. V12 adds Effect-track creation (measure `createEffectTrack` and
correct `add_tracks`) and track state. V03 adds optional cue markers. V01
adds name resolution with [R05](plan/overlap/wave-4/workflow-sequence.md#r05--browser-and-catalog-name-resolution),
a bounded re-probe of popup-browser discovery; E101's failure stands until
that probe runs. The coverage map has 25 groups; W4-A to W4-C are complete.

[D54](decisions/d54-recovery-is-not-a-prerequisite-for-requested-edits.md)
supersedes D19's blanket agent-reversal requirement. New capabilities need no
bespoke inverse solely for D19. Simplify working machinery when maintenance
or performance warrants it. Expected effects of the stated tool are acceptable;
unintended changes are not. D15 result checks, D49 truthful retained reverts,
and D52 admission remain. No runtime behavior changed in this planning turn.

V01–13 are [working templates](plan/overlap/wave-4/workflow-sequence.md).
The user supplies current Ghostworks material at execution. Initial sample
scope is CRUD/retrieval for Samplers on drum pads using externally sliced
hits. Readback is post-device/pre-fader from an existing clip, full span or
a measure/two, preferably quick and inaudible. Keep FIELDS/JSON by default.
Track each tool's internal dependency; unavailable required internals cause
whole-tool refusal before mutation. Report partial effects if failure occurs
later. See [case-specific examples](plan/overlap/wave-4/remaining-decisions.md).

Prepare lightweight release readiness after a few useful cases: clean docs,
simple versions, and tested Bitwig versions only, with no guarantee outside
that list; likely GitHub release assets. TCP/JSON-RPC stays; future HTTP is
logged intent with no backlog item. File routes stay when capability or speed
justifies them. Broad analysis/library work remains external.

Wave 3 stays the evidence baseline. Baseline: 45 normal tools, descriptions
v53, last installed-host record 6.1.4. No host request ran. See
[checks](plan/overlap/wave-4/verification.md). W4-D maps the templates to explicit
row/verb requirements and sessions; concrete acceptance questions belong at
implementation, not another broad vision questionnaire.

Phase 9 is complete. [11a](plan/phase-11/README.md#11a--product-grid-read-and-catalog)
remains the next already-planned Grid implementation. Keep Phase 11 scope and
[cost model](contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#phase-11-grid-authoring--model-before-implementation):
76 admitted roles, existing positions, and mapping amount via remove/re-add.
Before live work, deploy the matching archive, obtain operator controller
replacement, and run `npm run probe:hello`. 11a makes no Grid write.

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

- Wave 3 and earlier overlap work were committed before entry at `cbe99349`.
  The worktree was clean. The previous staged-state note was stale. The
  staged set includes the wave-4 kickoff and later decision, priority, and sequence updates;
  no commit is made. Wave-3 files and raw evidence are unchanged.
- SM-7 still records the unmeasured Effect and Group creation routes and the
  overstatement in `add_tracks`; V12 owns the measurement and correction.
  No tool description changed. DP-6's prose now
  agrees with its Candidate record: Control Deck has an action-based export
  route, without saved-file or reload proof.
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
