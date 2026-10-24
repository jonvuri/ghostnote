---
title: Current state
kind: status
state: active
updated: 2026-10-24
phase: overlap-planning
session: wave-3-vision-selection
---

## Next session

**Run [vision selection](plan/overlap/wave-3/vision-selection.md).** The
[static synthesis report](plan/overlap/wave-3/report.html) is complete. It
covers all 76 capability rows, 137 Ghostnote cells, 129 external cells, and
58 work records. Its matrices, filters, source details, and possible sequences
use the checked wave-3 data. The compact external matrix sorts projects by
recorded capability density after Ghostnote. No new feature order or implementation brief is
selected. Review the outcomes and D15/D49 context with the user, then plan
only the work they select.

Baseline confirmed offline: 45 normal tools, descriptions v53, installed
Bitwig 6.1.4. No host request ran. DL-6's current format-reference and parser
comment corrections are complete; runtime logic and historical E/D records
are unchanged. The report build and record checks pass. The context check
still reports 18 pre-existing missing-frontmatter errors; no new link error
remains. See [build and verification](plan/overlap/wave-3/report/README.md).

The user's provisional preference favours capabilities, speed, and functional
equivalence over perfect restoration. It is not an accepted contract change.
The [report](plan/overlap/wave-3/report.html#vision) presents the choices;
[dependencies](plan/overlap/wave-3/dependencies.md#provisional-user-statement-2026-10-24)
retains the original statement. D15 and D49 remain in force.

Phase 9 is complete. The next already-planned Grid implementation is
[11a — Product Grid read and catalog](plan/phase-11/README.md#11a--product-grid-read-and-catalog).
Keep the [Phase 11 scope](plan/phase-11/README.md) and
[cost model](contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md#phase-11-grid-authoring--model-before-implementation).
Wave one uses only 76 admitted roles. Placement must preserve existing module
positions. Mapping amount changes use remove and re-add. Before 11a live
work, deploy the normal archive, get operator controller replacement, then
run `npm run probe:hello`. 11a makes no Grid write.

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

- The earlier overlap reorganization, review, wave-3 records, and external
  register remain staged, not committed. This session adds the static report,
  its source template and builder, the next decision-session plan, and current
  reference corrections. The staged set includes prior sessions. Phase 11
  was already committed at entry. Raw evidence and source records are preserved.
- SM-7 still records the unmeasured Effect and Group creation routes and the
  overstatement in `add_tracks`. No tool description changed. DP-6's prose now
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
