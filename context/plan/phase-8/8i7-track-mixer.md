---
title: Phase 8i7 bounded track mixer controls
kind: plan
state: archived
status: Complete (E257, D48). The raw volume unit passed the gate; read_track_mixer and set_track_mixer ship in descriptions v43.
updated: 2026-10-19
parent: README.md
prev: 8i6-document-format-discovery.md
next: 8i8-selection-and-readback-results.md
---

# Phase 8i7 bounded track mixer controls

Historical Phase 8 record. Procedures and project retention instructions below
apply to the completed trials. Use the [dogfood archive](../../archive/outcomes/PHASE-8-DOGFOOD.md)
for results, related sessions, and the end of project tracking.

Investigate and, if the small route passes, add track mixer read and write
tools to `agent-native-v1`. The primary task is to read and set exact track
gain, such as pad at -18 dB and chords at -12 dB, without computer control.

## Evidence and scope

Source: `codex://threads/01a11ec6-934b-7202-86c1-88336643bd8b`.
The trial used computer control for mixer gain because no public tool
supports it. The first edits did not land. A later screenshot proves pad
at -18 dB; the pointer obscures the final chord value.

`BranchHandlers` already has probe methods `branch.mixer` and
`branch.setMixer`. Volume and pan use `setImmediately`; ordinary `set`
did not land in E16. The handlers use bank indices, not durable IDs. They
also expose sends, activation, colour, and group expansion. The normal
runtime omits their mixer, send, input, and VU subscriptions. This is
reusable host code, not a ready public permission and verification path.

## Entry reads

- [Performance ledger](../../contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md),
  [8h4f](8h4f-tracks-profile-cut-and-closeout.md), E16 and E239 evidence,
  and the current permission, migration, and verification contracts.
- `extension/` `handlers/BranchHandlers.java`, `handlers/TrackHandlers.java`,
  `Rig.java`, `RuntimeProfile.java`, `WriteGate.java`, `RigConfig.java`,
  active method goldens, and the local API 25 definitions for Parameter.
- `brain/src/probes/e16a-dup.ts`, `e16d-sends.ts`, and
  `phase8h4f-tracks.ts`; contract addresses, operations, and state;
  live adapter, wire map, executor, stash, and surface profile registration.
- Surface call budgets, live adapter frame tests, extension harness tests,
  naming, permission partitions, description cohorts, and result schemas.

## Feasibility gate

First write a small gap table: reusable primitive, missing product guard,
observer cost, and required proof. Check the API before designing the units.
Prove how an exact dB request maps to the host value, including silence and
the supported maximum. Prefer a host-supported unit setter if it exists.
Otherwise prove a conversion; do not infer one from display text or note
expression gain. Report normalized value and observed display separately.

Check whether automation, unknown observer state, or a changing project can
prevent a safe exact write. Define refusal behavior before implementation.
If exact units or guarded reversal require a broad new subsystem, finish
the investigation with a scoped follow-up and measured reasons. Do not
publish a normalized-only substitute as completion of the dB task.

## Work after the gate

1. Add `read_track_mixer` and `set_track_mixer` with explicit durable track
   IDs. Initial scope is volume, pan, mute, and nonexclusive solo. Read and
   write only the track kinds proved live. Refuse an unsupported kind before
   mutation. Bound each call to at most eight distinct tracks, pending the
   largest-case measurement. Keep selection and group folding unchanged.
2. Reuse the proved host accessors behind narrow product handlers. Resolve
   and check channel identity at execution, not only at the earlier scan.
   Do not promote the probe handler's send, activation, colour, or group
   fields wholesale. Register only the required normal/capture methods and
   subscriptions. Keep probe behavior available for its existing owners.
3. Extend the contract, adapter, and executor with field-specific mixer
   addresses and writes. Read the current values before mutation, preserve
   omitted fields, and independently verify changed fields. Group the four
   fields for one track in one write stage. Return no-op, partial completion,
   unavailable readback, and differing readback distinctly. A batch is not
   atomic; validate all inputs before the first write and record each effect.
4. Record prior and proved resulting values for guarded `revert_change`.
   An operator edit after the write must block reversal of that field.
   Reversal must preserve unrelated mixer fields, clips, devices, and
   selection. Define silence, unit ranges, tolerance, automation behavior,
   and immediate playback effects in the descriptions and results.
5. Test IDs through rename, reorder, deletion, replacement, and collapsed
   groups; stale project/identity; no-op and omitted fields; numeric limits;
   automation; partial writes; readback failure; and guarded reversal after
   an operator edit. Update profile goldens and budget tests deliberately.
6. Deploy from `extension/` with `./gradlew copyExtension`. Ask the operator
   for full controller removal and replacement with the final matching
   product in the complete list. A toggle, earlier duplicate, or orange
   add button is not a reload. Wait for confirmation. Run
   `npm run probe:hello` in `brain/` and check profile, method count/hash,
   fresh initialization, and deliberate build markers before live work.
7. Use an owned fixture. Measure read, write, and reversal for one track
   and eight tracks; all admitted fields; supported kinds; collapsed groups;
   silence, unity, maximum, -18 dB, and -12 dB. Confirm values through an
   independent host read and UI inspection. Restore the fixture in finally.
   Then run a fresh-agent mixing task without a skill or tool coaching.

## Description items from 8i6

This session bumps the description version, so it also carries two small
description changes (E255):

- State the pitch-name convention in `add_launcher_clip` and
  `edit_launcher_clip`: pitch is a MIDI number, and Bitwig shows 60 as C3.
  A person who names a note from the Bitwig piano roll otherwise gets an
  agent that can be one octave off.
- Replace the `stable-v1` wording in
  `reverse_existing_device_modulation_wrap` and `read_preset_modulation`
  with `agent-native-v1` wording.

If the feasibility gate stops the session before a description change, move
these items to 8i8.

## Provisional cost model

One wire turn is about 24 ms in the ledger. The probe handlers have no
current end-to-end latency row; measure their read/write primitives first.
Do not treat a probe acknowledgement as verified product latency.

For a one-track read, budget a shared mark/scan, identity resolution,
mixer read, and final guard: about four sequential turns (96 ms), zero
clip captures, and zero writes. For one-track write or reversal, budget
six to ten turns (144 to 240 ms), including prior state, guarded write,
settlement, and independent readback. These are targets, not measurements.

For eight tracks, share marks and scans. Budget at most four shared turns
plus three turns per track for a read (28 turns, 672 ms), or six shared
turns plus six per track for a write/reversal (54 turns, 1,296 ms), before
bounded settlement retries. Each track has one write stage and one proved
receipt; no clip cold read or note writer is needed. Record the actual
sequence and settlement bound. Reduce the eight-track limit if needed.

Observer cost grows with addressable tracks, not with each call. Budget at
most five value subscriptions per track for volume, display, pan, mute,
and solo: 1,280 at the normal 256-track window. Count subscriptions already
present, then measure incremental initialization and heap in a typical
project and at the largest configured window. Add no send, input, or VU
observers. Receipts grow with at most eight tracks per call under the
existing stash bound. Explain the difference from the broader probe rig.

## Acceptance criteria

- The feasibility result states what was reused and what required new work.
  Exact gain units and safety under automation have live proof or a clear
  blocking result. No unproved conversion enters the public path.
- If promoted, the agent reads and sets -18 dB and -12 dB through Ghostnote.
  All admitted fields, kinds, limits, failures, and reversal pass the tests
  above. Selection, unrelated fields, and fixture content stay unchanged.
- Typical and largest read/write/revert costs, host frames, settlement,
  subscriptions, and heap are recorded in the ledger and E record. Explain
  any regression above 20 percent on an existing path affected by the change.
- `npm run check`, extension checks, wire goldens, frame/call budgets,
  `LANG=en_US.UTF-8 ruby context/check.rb`, and `git diff --check` pass.
  Run each affected existing live measurement after the normal rig changes.
- Bump `TOOL_DESCRIPTION_VERSION` and its public artifact when tools change.
  Keep `stable-v1` frozen. Update permissions and migration documentation,
  E/D index rows, the charter, and NOW. Stage only session changes; do not
  commit. Report the version, verification, and suggested commit message.

## Retrospective

Record which probe assumptions failed at the product boundary. Keep a direct
reference from each new primitive to its unit, identity, and readback proof.

## Out of scope

Sends, routing, automation authoring, exclusive track solo, group creation
or folding, meters/VU, layer-chain mixing, transport, and project saving.
