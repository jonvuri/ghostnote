---
title: E319 — Update audit 6.1.4 first entry
kind: evidence
state: active
updated: 2026-10-21
owner: phase-9b
---

# E319 — Update audit 6.1.4 first entry

## Result

The operator confirmed controller replacement. The normal hello and first
preflight pass on 6.1.4. Setup stops after its first clip because the audit
expected an absent entry slot selection to be restored. The product reports
the documented E258 warning. This is a driver precondition defect, not
evidence of a new host regression. The live matrix is not accepted.

The failure and inspection are retained. No write was repeated. No uncertain
write remains. Six identified scratch tracks and one verified sentinel clip
remain in the stopped `gn-upgrade-audit` project. The operator must select
the first empty Launcher slot on `Inst 1` before the prepared recovery.
Recovery has not run. No save, launch, engine, or Grid command was sent.

## Startup and independent evidence

- [Hello](../data/bitwig-upgrade-audit/live-614/hello.txt): all checks pass;
  normal-v1, 92 methods, hash `8be1975eaa99d78f`, API 25, current markers,
  and initialization `2026-10-21T13:31:16.452Z` after deployment.
- [Replacement record](../data/bitwig-upgrade-audit/live-614/replacement.json):
  operator confirmation and the lower time bound from before the request.
  E318 retains the jar and archive fingerprints. PID 69259 remains the
  bridge owner. No competing connection was present at command entry.
- [Entry](../data/bitwig-upgrade-audit/preparation/entry.json): four empty
  tracks (`Inst 1`, `Audio 2`, `FX 1`, `Master`), eight scenes, stopped.
  Mixer selection is `Inst 1`; no Launcher slot is selected.
- [Failure](../data/bitwig-upgrade-audit/preparation/9766c81e-efe4-4b5a-a971-88158208f66c-failure.json):
  all six track creations pass. The sentinel clip creation and content
  readback pass. The product returns `slot-selection-moved` because no
  prior slot exists. The driver then stops on its selection comparison.
- [Independent inspection](../data/bitwig-upgrade-audit/preparation/d78c7146-583c-4a21-b43f-136fcaf63d66-inspection.json):
  the original tracks, mixer values, devices, and scene occupancy match
  entry. Mixer selection stays on `Inst 1`; slot selection is now sentinel
  row 0. The six scratch tracks have no devices. Only sentinel row 0 has
  content. The other scratch tracks are empty.
- [Offline comparison of the inspection](../data/bitwig-upgrade-audit/live-614/first-attempt-analysis.json):
  all four sentinel notes match the desired fixture, including both MIDI
  channels, timing, and expression. All unowned content matches entry.

The prefix is `gn-ua-62178847-`. Ownership, the first failure, and the
inspection remain in [state.json](../data/bitwig-upgrade-audit/preparation/state.json).
The [wire log](../data/bitwig-upgrade-audit/preparation/wire.jsonl) and
[tool log](../data/bitwig-upgrade-audit/preparation/tools.jsonl) retain every
call. The inspection uses normal readers. Their internal selection scopes
restore the observed slot; inspection sends no product content write.

## Correction and recovery boundary

[E258](e258-selection-effects-and-unavailable-readback.md) already states
that a clip creation cannot restore an absent prior slot selection. Its
driver requires a selected Launcher slot before writes. The new audit
preflight now also requires an empty selected slot on a preserved track and
a preserved mixer selection. This check precedes fixture creation.

The [driver guide](../../plan/phase-9/9b-update-audit-driver.md#inspect-cleanup-and-failure)
defines `recover-empty-selection`. It accepts only the observed first-setup
failure, six owned track identities, six track writes, and one verified clip
write with the known warning. An uncertain write or earlier recovery blocks
it. It requires content equal to inspection and an unchanged unowned baseline.
The operator must first select row 0 on the original mixer track. Recovery
deletes only the owned tracks, reads their absence, and compares the complete
final content with entry while retaining that selected empty slot.

The original failure is never cleared. Recovery cannot resume or run twice.
After successful cleanup, create a new attempt directory and repeat preflight
with the selected empty slot. Do not rerun setup in the failed record.
No claim is made that cleanup restores the original absence of a slot selection.

[Focused tests](../data/bitwig-upgrade-audit/live-614/recovery-tests.txt) pass
all 22 cases. The new tests cover the entry precondition, refusal for changed
content, absent warning, unexpected writes, uncertainty, and repeated recovery.
The simulated cleanup deletes only the six owned identities and keeps the
first failure. [Typecheck](../data/bitwig-upgrade-audit/live-614/typecheck.txt)
passes. Product code, extension archive, and public descriptions stay unchanged.

## Cost and limits

The analysis records 59 preflight calls (1,374.781 ms summed wire time),
435 setup calls (10,516.001 ms), and 188 inspection calls (4,555.872 ms).
These exclude the separate hello. Each one-track add uses 40 calls and
902.128–924.069 ms elapsed. E258 measured 41 calls and 889–935 ms for this
operation. The present samples stay within that time range. They do not
establish a full upgrade performance verdict.

The four-note mixed-channel clip add uses 74 calls and 2,391.151 ms. E258's
typical clip differs in content and entry selection, so it is not a matched
regression comparison. No timing repeat was run. Full per-call comparison
remains section 3 work after the matrix completes.

Recovery uses the existing bounded snapshot and delete paths, at most six
track deletions, and the same per-write guards. It reads at most 2 MiB of
the tool log to validate the exact failed sequence. It adds no new product operation,
retry, or poll. Product budgets remain unchanged. Sampler and the remaining
matrix cases have not run.

## Lesson

An audit that requires selection equality must start with a selection the
product can restore. The guide, preflight guard, and regression test now
retain E258's entry requirement. No new repository rule is needed.
