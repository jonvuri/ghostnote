---
title: Phase 8h4e0 — DirectParameter display probe
kind: plan
state: done
status: Complete (E244). With the IDs set, the display observer reports text for each ID in one turn; a switch sends no text; CLAP callbacks use another ID form.
updated: 2026-10-08
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h4d-musical-and-clip-surface-migration.md
next: 8h4e-device-structure-migration.md
evidence: E4, E4b, E98, E243; D20
---

# Phase 8h4e0 — DirectParameter display probe

## Why

A DirectParameter inventory reports normalized values only. The display
observer has never sent text (E4b, and every E243 probe run). Remote controls
and typed `Parameter` handles report display text (5v, E98), but a device that
has only DirectParameter access, for example a CLAP plug-in, does not.

Semantic writes fail closed: API 25 cannot convert a value with a unit to a
normalized value (E98). Display text is therefore the only readback that an
agent can read in the units of the device ("2.59 kHz", "-6.02 dB").

The likely cause is in Ghostnote, not in Bitwig. The API 25 Javadoc of
`addDirectParameterValueDisplayObserver` says that it returns an observer
object, and that by default no parameters are observed. `Rig` discards that
object, so it observes no ID. E4b guessed a page-scoped channel; nobody tested
either cause.

8h4e renames `inspect_device_parameters` to `read_device_controls`. This
session gives it the facts, so that 8h4e can decide whether DirectParameter
reads report display text.

## Read first

- [E4b](../../evidence/experiments/e4b-clap-params-via-the-directparameter-api-2026-07-19.md),
  the open detail about the display observer.
- [E98](../../evidence/experiments/e98-parameter-units-and-semantic-writes-fail-closed.md)
  and [5v](../phase-5/5v-semantic-parameter-units-and-fail-closed-guidance.md),
  the display and semantic contract.
- [E243](../../evidence/experiments/e243-collapsed-cursor-and-parameter-settle.md),
  the DirectParameter settle (`settledBy`, `DirectParameterSwitch`) and its
  probe driver `brain/src/probes/phase8h4a5-collapsed-cursor.ts` (P4).
- `Rig.java` at the DirectParameter observers, and
  `DirectParameterValueDisplayObserver` in the API 25 sources
  (`./gradlew bitwigApiSourcePath`).
- `parameterInventoryAttempt` in `adapter.ts`, and the display fields of
  `inspect_device_parameters` in `surface/tools.ts`.

## Work, in order

### 1. Probes (probe profile, owned unsaved project)

Fixture: a Polysynth (55 IDs), a Phase-4 (103 IDs), and one CLAP plug-in, if
one is installed, on separate tracks. Keep the display observer object, and
add a probe method that sets its observed IDs. Record each answer in E244, with
the data in an artifact.

- **Q1, cause.** With the IDs of the settled target set on the observer, do
  display callbacks arrive? For which IDs, and with which text? Compare with
  `displayedValue()` of the same Polysynth parameters through the typed view.
- **Q2, timing.** How long after the ID set do the callbacks arrive for all
  IDs? Do they arrive before, with, or after the name and value callbacks of a
  device switch?
- **Q3, target changes.** After a move to another device of the same type
  (the E243 `switch` case) and of another type, does the observer keep its ID
  set? Do new display callbacks arrive without a new set? Does a stale text
  from the earlier device remain?
- **Q4, writes.** After `directparam.set`, does a display callback for that
  ID follow? How long after the value callback?
- **Q5, cost.** The Javadoc warns against observing all parameters. Measure
  the callback count and the time of a settle with 0, 8, all 55, and all 103
  IDs observed. Is the cost acceptable for a full inventory, or only for the
  IDs that one request names?
- **Q6, pages.** If Q1 is negative: does the text arrive after the parameter
  page changes (`setParameterPage`, E4b hypothesis)?

### 2. Records

E244 records the answers and a recommendation for 8h4e: full inventory,
named IDs only, or no display text. It names the settle rule that a product
change needs (wait for display text, or report it as optional), so that a slow
callback cannot make a read unstable. Do not change the product profile or the
tool descriptions in this session. A probe method moves only the probe hash.

## Acceptance criteria

- Q1–Q5 have measured answers in E244, and Q6 when Q1 is negative. The
  artifacts support each claim, and a retained offline verifier checks them.
- The normal profile and its method hash do not change. The probe golden is
  updated for any new probe method.
- Extension check, brain check, wire goldens, context check, and
  `git diff --check` pass. Owned projects close without saving; the anchor is
  not touched. Normal `ghostnote` is loaded again at the end.
- The 8h4e plan states what `read_device_controls` reports for
  DirectParameter display text, based on E244.
