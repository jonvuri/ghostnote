---
title: Phase 8h4b2 — Document read compactness and gain correctness
kind: plan
state: planned
status: Planned. Fixes the E235 format findings before 8h4c writes documents.
updated: 2026-10-07
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h4b-document-read-and-identity-registry.md
next: 8h4c-document-edit-limb.md
evidence: E15, E24, E121, E235; D23, D25
---

# Phase 8h4b2 — Document read compactness and gain correctness

## Why

[E235](../../evidence/experiments/e235-document-read-and-identity-registry.md)
found that a live `read_launcher_clip` document has about 310 bytes per note.
It is only 13 percent smaller than its JSON. A Bitwig-default note differs
from the portable defaults in eight fields, so each note carries a `WITH`
object of about 260 bytes. One of those fields can also be wrong: a new host
note reads gain 0, and the binding states portable gain 0 (silence).

The goal is a document that is compact and has few distractions around the
core musical tasks. Each finding is a separate defect. Fix each one; a ratio
that passes is not enough.

## Decisions taken in planning (operator, 2026-10-07)

- **Gain.** Fix the gain mapping from live evidence.
- **Neutral enable flags.** An enabled control that has no effect is the
  portable default: chance enabled at value 1, occurrence enabled with
  `ALWAYS`, and recurrence enabled with length 1 and mask 1. The raw flag
  stays in the fresh raw state. A write builds its candidate from fresh raw
  state (HOST-BINDING), so an untouched note keeps its host flag.
- **Release velocity.** Use a lightweight rule. Release velocity is seldom
  used. A hardcoded host default of 100/127 is acceptable if the host default
  is stable. Do not add a general per-clip defaults mechanism for this alone.
- **Byte target.** Measure FIELDS against the equivalent exact JSON: the same
  notes and the same represented fields, not the larger 8c fixture with bars,
  regions, and tracks.

## Entry

Read E235, E15 (gain default), E24 (gain inverse), E121 (explicit insertion
defaults), the [host binding](../../../spec/ghostnote-document-v1/HOST-BINDING.md)
field table and "Defaults and proposed changes", the
[spec](../../../spec/ghostnote-document-v1/SPEC.md) R04 defaults,
`bindings/launcher-clip-document.ts`, `bindings/ghostnote-document.ts`
(`projectRawClip`, `d9MappedFields`), and the binding corpus B04–B05.

## Work, in order

### 1. Gain meaning (live probe first)

- With an owned project, ask the operator to set note gain in the Bitwig note
  inspector to known values (for example −inf, −6 dB, 0 dB, and +6 dB) on
  separate notes, and to draw one new note with no change. Read each raw
  `gain` with `clip.read`. Record the display and raw pairs.
- Derive the mapping from raw gain to the portable amplitude ratio (portable
  1 is unity). Apply it in the projection and its exact inverse in
  `d9MappedFields`, together with the E24 setter inverse. Update the host
  binding table, the binding corpus (B04–B05), and the gain refusal range.
- If the meaning cannot be established, mark gain uncovered rather than
  publish a wrong value.

### 2. Neutral enable flags

- In the projection, map an enabled control with a neutral value to the
  portable default. A disabled control with a non-neutral value stays as it
  is (preserve disabled nondefault values).
- State the rule in the host binding. State that the raw flag is host-private
  and that a write preserves it from fresh raw state.
- Event identity and D32 verdicts do not change: the source digest still
  covers every raw field.

### 3. Release velocity

- Verify the host default: the operator draws a note in the editor; read its
  raw `releaseVelocity`. E235 saw exactly 100/127 on notes written through the
  API.
- Choose the lightest rule that keeps exact values. Candidates, in order of
  preference: a binding-level host default (100/127) that the projection omits
  and the writer restores, stated in the host binding and in the read
  coverage; or a portable default change, which needs a spec, FIELDS, model
  reference, and identity-file update (D25). Record the choice as a decision
  only if it changes an active rule.
- A non-default release velocity stays explicit and exact.

### 4. Other distractions

Measure each candidate on a live typical read and the 8c corpus. Keep a
change only if it loses no meaning:

- the read wrapper (the `source` block, the coverage block and its reasons, the
  loss facts) for a result that has no loss and no warning;
- the COVERAGE record (the field list);
- the event ID width and other per-row costs.

### 5. Measurement and description

- Replace the 8h4b byte pins with the equivalent exact JSON comparison. Report
  the live typical read (bytes per note, FIELDS against JSON) beside E235.
- Record tokens for each evaluated model if a tokenizer or key is available;
  otherwise state the gap again.
- Update the `read_launcher_clip` description if the defaults or coverage
  text changes, and bump the description version.

## Acceptance criteria

- Gain: each probed inspector value reads as its portable amplitude, and a
  new note reads as portable gain 1, or gain is uncovered with a stated reason.
- A Bitwig-default note has no `WITH` object, unless an independent raw read
  shows a value that is not a host default.
- Neutral flags and the release velocity rule have unit tests and binding
  corpus cases. The independent raw-read agreement check of the 8h4b driver
  uses the new rules and passes live.
- FIELDS is at most 40 percent of the equivalent exact JSON on the 8c corpus
  and on the live typical clip. Record each removed distraction and its bytes.
- `stable-v1` registration is unchanged. Brain check, binding corpus,
  document conformance, context check, and `git diff --check` pass. Record
  the evidence as E245.

## Out of scope

- Writes (8h4c). 8h4c must use the same default rules in its writer.
- A general per-clip defaults mechanism.
