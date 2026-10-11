---
id: D49
kind: decision
state: active
updated: 2026-10-11
source: phase-8i15
---

# D49 — The fidelity of a revert states what the revert restored **[SETTLED 2026-10-11]**

`revert_change` of an `add_devices` change deleted the device, and the
independent read confirmed it. The effect said `fidelity: none`, and the
`restored` list was empty (issue D8,
[E262](../evidence/experiments/e262-automated-dogfood-stretch-set.md)). The
value was the fidelity of the reversal as a change of its own: a device
delete has no reversal. An agent reads the value as "the revert restored
nothing".

## Rule

1. **`fidelity` on the effect of a revert states how completely the
   revert restored the state before the reverted change.** `exact`: every
   part is back. `lossy`: a part is not restored; `readback.notRestored`
   and `readback.caveats` name it. `none`: nothing is restored.
   `check_revert` reports the same value in `data.fidelity`.
2. **`redoFidelity` states how completely a revert of the revert can
   bring the reverted work back.** It is the fidelity of the reversal as a
   change of its own. Only the effect of a revert has this field. It is
   `none` for a removed device: the agent adds the device again.
3. **`fidelity` on every other effect keeps its meaning**: how completely
   `revert_change` can restore the state before that change.
4. **A reversal names each object that it deletes.**
   `check_revert` lists them in `data.wouldRemove`, and `revert_change`
   lists them in `readback.removed`: a device that the change added
   (track, position, and name), and a clip that the change put in an empty
   slot. A removed clip is also in `restored`, because its empty slot is a
   place with a prior state. A removed device has no prior place and is
   only in `removed`.
5. **A removal that its guard refuses is not reported as removed.** When
   no op of the reversal applied, the call refuses with code
   `target-changed` at stage `guard` and names the object in
   `detail.notRemoved`. When a part applied, the object that stays is in
   `notRestored`, and an `exact` fidelity becomes `lossy`.

## Consequences

- Descriptions v48 state the two fields and the two lists
  ([E264](../evidence/experiments/e264-device-add-revert-report.md)).
- The value comes from the reversal plan and the receipt. No host call is
  added.
- The stable profile (`stable-v1`) gets `wouldRemove`, `fidelity`, and
  `removed` in its results; its descriptions do not change.
