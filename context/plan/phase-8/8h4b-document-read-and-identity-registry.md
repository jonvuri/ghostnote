---
title: Phase 8h4b — Document read and identity registry
kind: plan
state: planned
status: Planned. Adds the agent-native-v1 profile, the shared result vocabulary, read_launcher_clip on the D32 reference, and the clip and event ID registry.
updated: 2026-10-06
parent: 8h-cache-promotion-and-interface-simplification.md
prev: 8h4a-write-boundary-and-reader-hardening.md
next: 8h4c-document-edit-limb.md
evidence: E120, E131, E135, E230, E233; D23, D25, D32
---

# Phase 8h4b — Document read and identity registry

## Why

The 8f documents (FIELDS, JSON, the reference codec, and the host binding)
are offline. The D32 reference and `Authority` exist, but no tool reads a
Launcher clip as a Document 1.0 snapshot, and no registry holds document
clip and event IDs. This session adds the read half. 8h4c adds the edit limb.

## Decisions taken in planning

- **Profile.** New tools go into a new profile, `agent-native-v1`. It starts
  as a copy of the stable tool list. Each 8h4 session adds, replaces, or
  removes tools in it. 8h4f makes it the default. `stable-v1` stays frozen as
  the rollback through 8i. The 7b profile retires in 8h4d.
- **Read name.** `read_launcher_clip`, single clip (8f, D21).

## Entry

Read the [host binding](../../../spec/ghostnote-document-v1/HOST-BINDING.md)
read boundary, the [identity and overlay rules](../../../spec/ghostnote-document-v1/IDENTITY-AND-OVERLAYS.md),
the [model reference](../../../spec/ghostnote-document-v1/MODEL-REFERENCE.md),
the [interface audit](../../evidence/format/AGENT_NATIVE_INTERFACE_AUDIT.md)
target conventions, `bindings/ghostnote-document.ts`, `document/`, and
`contract/clip-snapshot.ts`.

## Work, in order

### 1. Profile and shared vocabulary

- Add `agent-native-v1` beside the two current profiles. Its name states its
  schema compatibility. Registration of `stable-v1` stays byte-equal; add a
  test.
- Add one result module for the new profile. It defines the read envelope
  (`schema`, `source`, `target`, `coverage`, `authority`, `data`, `warnings`,
  optional `timing`), the write envelope (`applied`, `effects`, `readback`,
  `next`), the failure envelope (`failure.code`, `failure.stage`,
  `failure.effects`, `message`, `retryWhen`), and the stable machine codes.
  Keep `empty`, `absent`, `unavailable`, `partial`, `unhealthy`, and
  `outside-limit` distinct. Keep adapter error text in diagnostic detail only.
- Map each D32 verdict and each 8h4a refusal to one machine code.
- Every later 8h4 session uses this module. Do not add a second envelope.

### 2. Identity registry

- Add a private, in-process registry. It binds an opaque base ref to one D32
  reference, the document clip ID, the R27 content hash, the coverage, the
  acquisition boundary, and the event map `(clip, host channel, pitch, cell)`
  to event ID.
- Apply the identity table: retain IDs on `current`, and on `stale` for
  unchanged cells; mint at changed cells; retire on `identity-changed`,
  `absent`, `incomparable`, and `uncovered`. Do not match by similarity.
- Bound the registry: a fixed entry count and retirement on generation or
  project change. State the bound. An expired ref refuses with its own code.
- The registry is not persisted. A restart retires every ref. State this in
  the identity rules.

### 3. `read_launcher_clip`

- Input: durable track ID, zero-based row, and optional `format` (`fields`
  by default, or `json`) and model-reference sections.
- One fresh cold read on all 16 channels with `sources` for the clip. Project
  through `projectRawClip` and the reference codec. Return the document, the
  base ref, coverage with reasons, loss facts (D23), and the 8h4a refusals.
  Exact-source detail is diagnostic, on request or on failure.
- An empty slot is `empty` occupancy, not an empty clip. A partial read or a
  read over the reader limits refuses. A notes-past-loop clip returns the
  range diagnostic and the Consolidate remediation.
- A repeated read of an unchanged clip returns the same IDs and the same
  base ref state (`current`).
- Include the model reference through the selected entry point (the tool
  description or one named skill resource). Its version matches the codec
  identity file. The agent must not need a repository tutorial.

### 4. Survey on the new vocabulary

Add `check_launcher_clips` to the new profile. It takes base refs from
`read_launcher_clip` and returns one verdict each, with a new document only
for `stale` clips. It uses the 8h3e survey function and the registry.

## Acceptance criteria

- `read_launcher_clip` passes the codec corpus on every fake fixture class:
  empty, typical density, all 16 channels, disabled controls, finer-than-cell
  onsets, collisions, pressure, notes past the loop, and a group slot.
- FIELDS output is at most 40 percent of the equivalent exact JSON bytes on the
  fixed 8c corpus. Record tokens for each evaluated model separately.
- Registry tests cover each identity table row and each retirement verdict.
- Live: an owned typical clip reads twice with equal IDs. After an operator
  velocity edit, the check returns `stale` with the same event IDs. After a
  pitch edit, the edited event has a new ID. After a scene insert, the ref
  retires. An independent raw read agrees with each projection.
- Record wall time and result bytes for one typical read against E230 and
  E233.
- `stable-v1` registration is unchanged. Brain check, binding corpus, context
  check, and `git diff --check` pass. Record the evidence as E235.

## Out of scope

- Writes, sparse patches, and desired documents (8h4c).
- Retirement of `read_clip`, `acquire_clip_note_source`, and
  `inspect_clip_block` (8h4d).
- Persistence of the registry across restarts.
