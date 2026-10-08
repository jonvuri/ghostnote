---
title: E244 — DirectParameter display observer
kind: evidence
state: done
updated: 2026-10-08
owner: phase-8h4e0
---

# E244 — DirectParameter display observer

## Status

[8h4e0](../../plan/phase-8/8h4e0-direct-parameter-display-probe.md) is
complete. The E4b gap had a Ghostnote cause. `Rig` discarded the object that
`addDirectParameterValueDisplayObserver` returns, so the observer watched no
ID. With the IDs set on that object, each observed ID reports its display text
one control-surface turn later. This is true for Bitwig devices and for CLAP
plug-ins. The parameter page has no effect (Q6 was not necessary).

The probe also found a defect in the CLAP write path (see "CLAP callback ID
form"). Its effect on the product tools is inferred, not measured.

## Method

Probe profile `phase-8-probe-v1`, 105 methods, `513b2d6b4647bbbe`. Two new
probe methods:

- `directparam.observeDisplay {ids, page?}` sets the observed IDs (null stops)
  and restarts the callback log.
- `directparam.log {mark?, restart?}` returns the ID, name, value, and display
  callbacks in arrival order, with the microseconds since the restart
  (`DirectParameterProbeLog`, probe profile only).

Owned unsaved project. Tracks: two Polysynth (55 IDs), two Phase-4 (103 IDs),
Stochas (CLAP, 55 IDs), and u-he Diva (CLAP, 281 IDs). Driver:
`brain/src/probes/phase8h4e0-display.ts`. Writes use resolution 1, as the
product encoder does.

## Answers

| Question | Answer |
|---|---|
| Q1, cause | Yes. After the set, each observed ID reports one display callback, and no other ID does. The full set arrives 22.6–25.4 ms after the set (one turn): Polysynth 55 of 55, Phase-4 103 of 103, Stochas 55 of 55, Diva 281 of 281. The Polysynth text agrees with the typed `displayedValue()` on 62 of 64 typed rows. The two exceptions are `OSC1_UNISON_VOICES` and `OSC2_UNISON_VOICES`: typed "1", direct "1v". Examples: `F1FREQ` "2.59 kHz", `AEG_DECAY` "2.72 s", Diva `PID0` "74.00". |
| Q2, timing | All the text arrives in one burst, one turn after the set. A second set of the same IDs on the same target sends all the text again. A set of 8 IDs sends 8 callbacks only. A device switch sends no text (Q3), so the text comes only after a set: after the name and value callbacks of the switch (these arrive 96–100 ms after the point). |
| Q3, target changes | The observer keeps its ID set across a switch, but a switch sends **no** display callback. This is true for a switch to the same type (equal and unequal values) and to another type (Polysynth, Phase-4, Stochas, 8 switches). After a switch, a write on the new device reports the text of the new device ("30.0 %") with no new set. A new set after the switch sends the text of the new device for each ID. Thus text that is kept from before a switch is stale: the rig map clears it only because `begin` and the switch settle clear all maps. |
| Q4, writes | On Bitwig devices, the display callback follows the value callback in the same turn: 0.013–0.084 ms later, 45–72 ms after `directparam.set` (12 writes, Polysynth and Phase-4). Each write reports exactly one text, for the written ID. |
| Q5, cost | The switch settle does not depend on the observed count: 165–174 ms with 0, 8, 55 (Polysynth), or 103 (Phase-4) IDs observed (4 switches each). A switch sends no display callbacks, so the observed set adds no switch traffic. A set gives the text one turn later for each count, also for all 281 Diva IDs (22.6–25.4 ms). The turn time after a set stays at 22.5–24.7 ms (`ping` median). The Javadoc warning does not show at this scale. A full-inventory set is acceptable. |
| Q6, pages | Not needed: Q1 is positive with no page change. |

### Audio engine

With the audio engine off, both CLAP plug-ins list no IDs: the ID observer
reports an empty list, and the device has no remote pages
(`probes-engine-off.json.gz`). The Bitwig devices are not affected. A
DirectParameter read of a CLAP plug-in with an empty list must not be reported
as "this plug-in has no parameters".

### CLAP callback ID form

On a CLAP plug-in, the ID observer lists `CONTENTS/PID0`, but after a write
the value and display callbacks use `CONTENTS/ROOT_GENERIC_MODULE/PID0`
(Stochas and Diva, `clap-ids.json.gz`):

- The write takes: the callback reports the requested value.
- The completion for the listed ID is never observed.
- The listed value in the rig map stays at the earlier value.
- A display callback after a write arrives only when the callback form is also
  observed ("1/8", "124.00").

E4b recorded that "Stochas's own params didn't move on write". The cause was
probably this ID form, not the plug-in. Inferred, not measured: a product
`set_parameter` on a CLAP device waits for a completion that never matches.
Its inventory fallback then reads the stale listed value, and the write
reports "the target-bound parameter write callback did not settle", although
the plug-in changed.

### Resolution

The first run used the handler default resolution 128. Bitwig reads the value
as a step of `resolution - 1`: 0.3 became 0.3/127 (`probes-first.json.gz`).
The product encoder sends resolution 1, so this does not affect the product.

## Recommendation for 8h4e

`read_device_controls` reports DirectParameter display text for the full
inventory:

1. Set the IDs on the display observer after each settle of a new target (the
   ID list, a `switch`, or a `target`). A switch does not refresh the text.
2. Settle rule: the text is part of the settle. Wait for one display callback
   for each listed ID under the current target stamp, and clear the text at
   each target change, as for the names and values. The expected cost is one
   turn (about 24 ms) for each new target. If the text does not arrive within
   a short budget (for example 4 turns), report the parameter with no `display`
   and mark the read as incomplete. Do not report text that has no callback
   under the current stamp.
3. Keep the IDs set while the target stays the same. A write then refreshes
   the text of the written ID in the same turn, so a write readback can
   report its text.
4. Map the CLAP callback form `CONTENTS/ROOT_GENERIC_MODULE/<id>` to the
   listed ID in `Rig` (values, text, and the write completion). Observe the
   two forms for a CLAP plug-in. Verify a product CLAP write live.
5. Report an empty CLAP ID list as "parameters unavailable (audio engine off
   or plug-in not loaded)".

## Artifacts and verification

Data is in [phase8h4e0-display](../data/phase8h4e0-display/):
`probes.json.gz` (engine on), `diva.json.gz`, `clap-ids.json.gz`,
`probes-engine-off.json.gz`, `probes-first.json.gz` (resolution 128), the
hello logs, and the cleanup reports.
`brain/src/probes/phase8h4e0-display.ts verify-offline <dir>` checks every
claim above; `phase8h4e0-display.test.ts` runs it.

## Restoration

The driver deleted the owned tracks, and the operator closed the project
without saving. The anchor `gn-scale-test` matches `baseline-final.json`
(11 tracks; read only). Normal `ghostnote` is loaded: archive SHA-256
`fb8d797c199b35f4bc8a51eb92b50b2e773f3e810902cd4db50d20ba60f92cf4`
(the `Rig` change keeps the observer object; the normal method set is the
same), initialization `2026-10-08T00:11:05.547Z`. Fresh hello passes
`normal-v1`, 88 methods, `68d457c4c4d1d7b3`. The audio engine is on for
`gn-scale-test`.
