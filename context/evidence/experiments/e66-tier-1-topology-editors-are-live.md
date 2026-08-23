---
id: E66
kind: evidence
state: active
source: phase-5-session-5b-tier-1-topology-editors
---

# E66 — Tier-1 topology editors are live [K] (2026-08-23)

**Verdict: replace, retarget, and delete now run through one checkpointed
executor path, prove their live result through exact remote readback, and reverse
without residue.**

## Product path

`authorModulatorEdit()` accepts a replace, retarget, or delete operation. It
reads one absolute template, applies the matching `bwmod` editor, and runs
`validate()` before `apply()`. It loads the edited preset through
`device.insert`, returns the take and minted address, and removes the temporary
preset after the apply call.

The result reports the complete before and after modulator inventory. Page
witnesses prove exact page counts. Behavior witnesses name an exact page and
control and require either active or inactive modulation. Both behaviors require
an observed false automation state, a stable base, and a positive divergence
threshold.

Replace and delete keep the sampled-preset footprint refusal. An unknown
removed or inserted footprint refuses before the executor.

## Live proof

The focused probe created one owned instrument track and used the human-saved
Polysynth `modtest` template.

| Edit | Live result |
|---|---|
| Replace | Slot 0 `Vibrato` became `Classic LFO`; the `Classic LFO` page count was 1 and the `Vibrato` page count was 0. |
| Retarget | Slot 2 moved from `CONTENTS/F1FREQ` to `CONTENTS/F1RESO`; `FILTER/Filt Freq` had 0 divergence and `FILTER/Reso` reached 0.6052380952380951. |
| Delete | Slot 2 `LFO` was absent; the `LFO` page count was 0, `Vibrato` remained at 1, and `FILTER/Filt Freq` had 0 divergence. |
| Reversal | Every take deleted its observed insertion and reported no unrestored state. |
| Cleanup | The owned track was removed and the exact seven-track entry list was restored. |

Every behavior witness sampled 10 times at 80 ms intervals. Each sample reported
`hasAutomation: false`, and each base spread was 0.

## Observer repair

The first live run exposed a fail-closed observer gap. The reply handler read
remote `hasAutomation`, but the remote-control construction did not mark the
property interested. The running controller therefore omitted the field. The
extension now subscribes to the property, and an offline source assertion keeps
the subscription in place.

The method-table handshake could not detect this change because no method name
changed. The deploy-freshness probe correctly detected that Bitwig still ran an
older controller after deployment. The final proof ran only after the controller
reloaded and the freshness check passed.

## Verification

- `npm run check`: 777/777 pass.
- Focused authoring and wire tests: 49/49 pass.
- `./gradlew test`: passes.
- `npm run probe:hello`: all handshake and deploy-freshness checks pass.
- `npm run probe:phase5b-authoring`: all replace, retarget, delete, reversal,
  and cleanup checks pass.

## Qualification

This result proves all four topology editors on unsampled Tier-1 Polysynth
templates when combined with E65. It does not yet prove the checkpointed path on
a sampled preset, a container, or a cross-device route. It does not add a public
tool.

## Retrospective

Run deploy freshness before each live proof. A method-name hash cannot detect a
new field or observer subscription on an existing reply.
