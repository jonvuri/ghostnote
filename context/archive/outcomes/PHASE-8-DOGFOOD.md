---
title: Phase 8 dogfood results and related sessions
kind: index
state: archived
updated: 2026-10-19
---

# Phase 8 dogfood results and related sessions

Phase 8 dogfooding is complete. Fresh agents used Ghostnote for musical work;
the trials also led to repairs in document discovery, timing claims, device
controls, and file workflows. E272 records the final verdict and its limits.
This index covers E249–E272 and the completed 8i sessions. Evidence, data, and
session paths stay unchanged so earlier links still work. Completed procedures
are historical; they do not authorize a new run or project change.

## Results and fixes

| Result | Evidence | Related sessions |
|---|---|---|
| Musical trials passed after revisions; clip metadata and device control defects were repaired. | [E249](../../evidence/experiments/e249-clip-metadata-and-colour-tolerance.md), [E254](../../evidence/experiments/e254-device-control-identity-and-route-claims.md) | [8i0](../../plan/phase-8/8i0-clip-metadata-and-colour-tolerance.md), [8i5](../../plan/phase-8/8i5-device-control-identity.md); [second trial review](../../plan/phase-8/8i-trial-2-interface-review.md) |
| Pinned cursors repaired saved-project reads; collapsed-group routes passed. | [E250](../../evidence/experiments/e250-reader-follow-mode-repair.md), [E251](../../evidence/experiments/e251-collapsed-group-live-verification.md) | 8i1 repair in E250; [8i2](../../plan/phase-8/8i2-collapsed-group-live-verification.md) |
| Long writes were optimized and bounded; mixer controls and selection/readback reports passed. | [E252](../../evidence/experiments/e252-long-device-write-profile.md), [E257](../../evidence/experiments/e257-track-mixer.md), [E258](../../evidence/experiments/e258-selection-effects-and-unavailable-readback.md) | [8i3](../../plan/phase-8/8i3-long-device-write-profile.md), [8i7](../../plan/phase-8/8i7-track-mixer.md), [8i8](../../plan/phase-8/8i8-selection-and-readback-results.md) |
| Overlay basis sealing and clip creation passed the operator groove and dependency trial. | [E253](../../evidence/experiments/e253-overlay-basis-sealing.md), [E256](../../evidence/experiments/e256-overlay-authoring-and-creation.md) | [8i4](../../plan/phase-8/8i4-overlay-basis-sealing.md), [8i9](../../plan/phase-8/8i9-overlay-authoring-and-creation.md) |
| Fresh agents used the document format; later timing trials used claims after description changes, and claim repairs reduced refusals. | [E255](../../evidence/experiments/e255-document-format-discovery.md), [E259](../../evidence/experiments/e259-unprompted-overlay-trials.md), [E260](../../evidence/experiments/e260-claim-replacement-repair.md) | [8i6](../../plan/phase-8/8i6-document-format-discovery.md), [8i10](../../plan/phase-8/8i10-unprompted-overlay-trials.md), [8i11](../../plan/phase-8/8i11-claim-replacement-repair.md) |
| The automated loop passed with Codex and Claude; all ten stretch runs met their task goals. | [E261](../../evidence/experiments/e261-automated-dogfood-process-proof.md), [E262](../../evidence/experiments/e262-automated-dogfood-stretch-set.md) | [8i12](../../plan/phase-8/8i12-automated-dogfood-process-proof.md), [8i13](../../plan/phase-8/8i13-automated-dogfood-stretch-set.md) |
| Clip copy reached any empty row; device-add reversal reports named removed objects. | [E263](../../evidence/experiments/e263-clip-copy-to-any-row.md), [E264](../../evidence/experiments/e264-device-add-revert-report.md) | [8i14](../../plan/phase-8/8i14-clip-copy-to-any-row.md), [8i15](../../plan/phase-8/8i15-device-add-revert-report.md) |
| MIDI conversion passed offline; an operator trial exposed the snapshot export refusal, then the fix passed. | [E265](../../evidence/experiments/e265-inline-midi-file-conversion.md), [E266](../../evidence/experiments/e266-inline-midi-operator-trial.md), [E267](../../evidence/experiments/e267-midi-snapshot-export.md) | [8i16](../../plan/phase-8/8i16-midi-file-conversion.md), [8i18](../../plan/phase-8/8i18-midi-snapshot-export.md) |
| The two-client chord trial exposed large inline documents; file routes passed and the trial was repeated. | [E268](../../evidence/experiments/e268-two-client-midi-chord-trial.md), [E269](../../evidence/experiments/e269-document-file-paths.md), [E270](../../evidence/experiments/e270-document-file-rerun.md) | [8i19](../../plan/phase-8/8i19-document-file-paths.md) |
| The tempo report became bounded; clip overlaps refused before a host call. No client trial used v52. | [E271](../../evidence/experiments/e271-midi-tempo-report-and-overlap-precheck.md) | [8i20](../../plan/phase-8/8i20-midi-tempo-report-and-overlap-precheck.md) |
| The Phase 8 gate closed; interface verdicts and publication limits were handed to Phase 10. | [E272](../../evidence/experiments/e272-8i-gate-close-out.md) | [8i charter and closeout](../../plan/phase-8/8i-agent-native-hybrid-dogfood.md#closeout-e272) |

## Transcripts and issue dispositions

- The [8i issue log](../../plan/phase-8/8i-dogfood-issues.md) records D1–D16,
  the operator's dispositions, and the fixes. These IDs are local to that log,
  not the design decision index. All rows are decided; the log is closed.
- The [second musical trial review](../../plan/phase-8/8i-trial-2-interface-review.md)
  identifies its source transcript. The [operator overlay trial](../../plan/phase-8/8i-agent-native-hybrid-dogfood.md#operator-overlay-trial)
  records the listening verdict and the hand-edit check.
- [Timing trial extracts](../../evidence/data/phase8i10-trials/),
  [automated process proof](../../evidence/data/phase8i12-dogfood/), and
  [stretch task records](../../evidence/data/phase8i13-dogfood/)
  retain prompts, client metadata, extracts, and state evidence.
- [MIDI operator trial](../../evidence/data/phase8i18-midi-snapshot/trial.json)
  and [document file trials](../../evidence/data/phase8i19-document-files/)
  identify the source sessions and later rerun. E records link the remaining
  driver outputs. Keep source file versions distinct in comparisons.

## Project tracking closed

On 2026-10-19, the operator ended Phase 8 dogfood project tracking. Night Glass
and ice jungle are no longer active dogfood projects. Work on `lie sword`
continues, but its saved project state and Ghostworks hold the needed record.
No project-specific retention list is needed in NOW. Earlier instructions to
preserve named trial clips are historical. This change neither deletes material
nor authorizes changes to those projects. The current Grid fixture is separate.

## Reuse and remaining work

The [automated runbook](../../plan/phase-8/8i-automated-dogfood-runbook.md) remains
a reference for a selected new trial. It explains how to check the fixture and
build before reusing the old drivers. The [earlier dogfood loop](../../plan/dogfooding/README.md)
holds pre-Phase-8 runs.

The [8i17 musical navigation survey](../../plan/phase-8/8i17-midi-musical-navigation-survey.md)
is still planned and independent. [Phase 10](../../plan/phase-10/README.md) owns
publication and release work. The v52 client-trial limit remains in E272; it
adds no required rerun. The normal 8i15 build identity is also in E272.
