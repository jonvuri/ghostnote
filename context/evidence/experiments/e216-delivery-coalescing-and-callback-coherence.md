---
title: E216 — Delivery coalescing and callback coherence across project detours
kind: evidence
state: active
updated: 2026-10-02
parent: ../../plan/phase-8/8g-shadow-project-cache.md
---

# E216 — Delivery coalescing and callback coherence across project detours

## Scope and result

This experiment measures two questions from the 8g2 stalemate. First, can a
completed P→Q→P project detour occur with no delivered change? Second, does
one controller callback read a coherent delivered state? The experiment is
research only. It grants no cache eligibility and proves no host input fence.
It does not change the [8g2 refusal](../format/PHASE8G_PROJECT_CONTINUITY.md).
[D26](../../decisions/d26-step-data-delivery-is-a-named-assumption.md)
records the user decision: complete step-data delivery is a named assumption.

| Question | Result | Scope |
|---|---|---|
| Separate-callback detour | 50/50 seen. Dwells 0–500 ms each deliver one Q project name. | Controller-issued actions only |
| Same-callback detour | 21/35 unseen by value observers. The endpoint is P. | Both commands in one callback |
| Command order | 3/3 `next, prev, next` runs end on Q and deliver one value. | Each command applies in order |
| Step-data channel | 35/35 same-callback detours deliver Q witness NoteOn steps. | One selected witness clip per project |
| Foreign content | 12/21 unseen detours have a tick with P identity and Q notes. | Zero in seen detours |
| Hold inside one callback | 4/4 holds of 400 ms: 0.6–1.3 M reads, zero changes, zero events. | Delivered state is confined to callbacks |
| Value toggles | Two toggles in one callback: 0 of 14 runs deliver a change. Separate callbacks: 25/25 deliver both. | Mute and one scratch step |

Unseen A–B–A is therefore real for the delivered value observers. Equal
identity before and after a read is not sufficient. A read can also see the
other project's notes while every identity value stays equal. This result
supports the 8g2 refusal of identity-only admission.

The step-data observer did not lose any detour in this fixture. It delivered
the change from P content to Q content and back. Its deltas were present even
when every value observer coalesced. This is an observation for one witness
clip. It is not proof of complete step delivery.

## Method

The `ghostnote 8g controls` build adds `DeliveryCoherenceProbe` with marker
`e216-delivery-coherence-v1`. The `deliveryResearch` config flag allocates it
only in the probe profile. It has one selection-following cursor track and one
launcher cursor clip at 1/16, keys 60–75, steps 0–15. Value observers record
project name, engine, root channel, cursor channel, cursor name, mute, and clip
existence. A step-data observer records every callback.

A ticker reschedules itself with a zero delay. Each tick reads one signature
twice in the same callback. The signature has project name, root channel,
cursor channel, clip existence, P and Q witness cells, mute, and a scratch
cell. The host loop runs this ticker at about 30–35 Hz. Scripted steps invoke
named actions, hold one callback, or toggle guarded values. A negative delay
runs a step in the same callback as the previous step. Command records and
observer records share one sequence. Both come from the controller process.

Fixtures are two new unsaved projects. P is `New 6` and Q is `New 7`. The
original `New 1` is the first tab and is not modified. Each fixture has one
clip on its first track. P has NoteOn steps at key 60, steps 0–3. Q has NoteOn
steps at key 72, steps 8–11. The detour actions are `Select Next Project` and
`Select Previous Project`. They do not activate the engine. If the first
command drops, the second command selects `New 1`. That endpoint stops the
run. No run reached that state.

## Detour timing

Trial 2 runs three single-switch control pairs, three composition oracles, five
interleaved repetitions of each dwell, four callback holds, and toggles. Each
single switch delivers one project name 22.8–25.2 ms after the invoke. The
project name, root, and cursor channel arrive in one batch. A dwell of 0 ms
schedules the second command in a later callback. All such detours are seen.

| Dwell | Trials | Seen | Unseen with P endpoint | Foreign-content ticks |
|---|---|---|---|---|
| Same callback, trial 2 | 5 | 3 | 2 | 1 |
| Same callback, focused run | 30 | 11 | 19 | 11 |
| 0, 1, 2, 5, 10, 20, 50, 100, 250, 500 ms | 5 each | 5 each | 0 | 0 |

In an unseen detour, the step channel delivers P cells off, Q cells on, Q cells
off, and P cells on. Value observers deliver nothing. A seen detour delivers
the same content changes in two batches, about 23 ms apart, with Q values first.
In 12 unseen detours, one tick runs between step callbacks of one apparent batch.
That tick reads P identity and Q notes. Thus a host batch is not atomic with
respect to controller callbacks.

## Callback holds and toggles

Each hold reads the full signature in a busy loop for 400 ms. The holds run in
the invoking callback and in the next callback. No value changes, and no
observer runs during a hold. Each switch lands after the hold returns.

Two mute or step toggles in one callback deliver zero changes and restore the
endpoint. Separate callbacks, even with a 0 ms delay, deliver both changes.
In trial 2, a step toggle with a 0 ms delay read its delivered state before the
previous write arrived. It set the cell twice and did not restore it. The run
stopped as designed. This is a driver defect, not a host result. The cell was
cleared after the run. The focused run uses a 100 ms delay for separate step
toggles and restores every endpoint.

## Interpretation for 8g2

- Identity values coalesce to the latest value at delivery. A completed detour
  inside one host update can leave every identity value equal.
- Controller callbacks see a confined delivered state. Delivery batches can
  still interleave with controller callbacks, so a mixed read is possible.
- Step-data deltas arrived for every measured detour. Each foreign tick read
  inside one batch: eight step callbacks before it and eight 19–76 µs after it.
  A start/end check inside that callback sees no change. A check in a later
  callback saw the full batch in all 12 cases. That later-callback order is
  not yet a measured rule.
- An unseen detour without any step delta can only expose equal content in the
  observed window. This argument depends on complete step delivery. That is the
  same class of assumption as the accepted callback-completeness assumption.
- Native UI commands were not measured. Separate controller callbacks were
  always seen. Whether one native gesture can produce two commands in one host
  update remains unknown.

## Limits

The command log is separate from observer records, but it is not external to
the controller process. A P endpoint after two commands does not prove that Q
became current in the host model. The composition oracle shows that each
command applies in order. One witness clip per project is measured. Empty Q
clips, unselected clips, other observers, native input, and other host versions
are not measured. Callback holds show confinement for these signals only.

## Artifacts and checks

[Retained reports](../data/e216-delivery-coherence/) include the fixture state,
trial 2, the focused run, and trial 1. Trial 1 stopped before any detour because
the analyzer used the wrong command name. It is an analyzer diagnostic only.
Its six control legs are not counted. The driver is
[`e216-delivery-coherence.ts`](../../../brain/src/probes/e216-delivery-coherence.ts);
its `verify` mode recomputes the retained summaries. Brain tests check both
retained reports and the pure analyzer.

| File | SHA-256 |
|---|---|
| `fixture-state.json` | `fe72bf3b8be0374c4dc3dd9755be6d912bde246a7295fb7002851ed225575d46` |
| `trial-1-analyzer-diagnostic.json` | `98c564adb4346176590793ebed778536d2793e3bc369a27d8700226fb9e45831` |
| `trial-2.json` | `4b9bc47be6b963c55cd87edc82093422d109d28a2e5d8024694eac0ee830e7c5` |
| `focused-1.json` | `a386fc810834c8bae2aeedbe8b188e8978691577458ecb456a42daf71203feef` |
