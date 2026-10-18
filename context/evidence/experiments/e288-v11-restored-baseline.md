---
title: E288 — V11 restored baseline
kind: evidence
state: active
updated: 2026-10-19
owner: phase-9a
---

# E288 — V11 restored baseline

The operator inspected the E287 insertion, closed the fixture without saving,
reopened its baseline, and replaced the controller. The supplied screenshot
shows the new Amplify at 100% and the original modules and cables. The operator
selected the new module for inspection. This does not change E287's earlier
empty-selection witness.

The [V11 hello](../data/phase9a-grid-attachment/hello-v11-summary.json) passes:
`phase-8-probe-v1`, 117 methods, hash `b899e5d3d75a791d`, marker
`9a-grid-attachment-v11`, initialization `2026-10-18T18:13:18.006Z`.
The [full output](../data/phase9a-grid-attachment/hello-v11.txt) retains all checks.
No competing Phase 8 or Phase 9 driver was found.

`live-93-v11-baseline` in the [attachment data](../data/phase9a-grid-attachment/)
has two equal 53-node graphs and native witnesses. Derived semantics match
the saved preset. The four module UUIDs were reacquired after reopening.
Rectangles match the baseline; parent checks pass, edit state is idle, and
Grid selection is empty. Public selection is unchanged. The epoch is released.
The read workflow uses 15 calls, 429.571 ms summed wire, and 150 ms settlement.
Individual captures take 49.185/46.764 ms wire. No write path changed or ran.

The [entry record](../data/phase9a-grid-attachment/entry-v11-live.json) proves
that the saved project and backup remain byte-identical, SHA-256
`af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f`.
The preset hash remains unchanged. No project save or file replacement ran.

The first UI check shows that reopening activated the audio engine. Transport
is stopped at 1.1.1.00. Track `grid-probe` is muted at -10 dB and armed. The
Grid editor is closed; MW and Expressions remain visible in the device panel.
Both project tabs have their existing unsaved markers. Several UI clicks to
open the File menu had no visible effect. No factory request ran on V11.
The inactive-engine admission requirement remains unsatisfied.

Next: the operator deactivates the fixture's engine and opens the Grid editor.
Verify the UI, create a fresh entry witness, then follow the
[attachment run sequence](../../plan/phase-9/9a-native-attachment-design.md#attachment-run-sequence).
No new archive or controller replacement is needed. Keep 9a active. Both V11
factory attempts remain unused. The full attachment gate remains unproved.
Public descriptions remain v52, 44 tools. No code or tool description changed.

Verification: passing hello, paired graph/witness equality, preset semantics,
project/backup hashes, and context/whitespace checks. Existing E287 offline
checks still apply; no implementation changed.

Retrospective: state the visual inspection criteria when requesting operator
inspection. Recheck engine state after every project reopen; it can reactivate.
