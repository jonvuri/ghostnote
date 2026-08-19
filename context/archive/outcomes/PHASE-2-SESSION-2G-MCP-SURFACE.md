---
title: Phase 2, session 2g — MCP clip surface v1
kind: outcome
state: complete
updated: 2026-08-18
parent: ../../plan/phase-2/README.md
prev: PHASE-2-SESSION-2F-APPLICATION-PLANNER.md
next: ../../plan/phase-2/2h-conformance.md
scope: Phase 2 public tool surface
evidence: E20c, E22 · D18–D21
---

# Phase 2, session 2g — MCP clip surface v1

Session 2g is complete. The public surface now has one generation tool and one
existing-content transformation tool. Both use musical patch version 1 and call
the Phase 2 planner as their only write path.

## Public musical path

`generate_clip_music` requires every target to start with `generate`.
`transform_clip_music` requires every target to start from existing clip notes.
Both are ordinary non-destructive write tools. Their public schemas expose the
same strict patch grammar, including beats, MIDI channels, merge or replace
mode, clip protection, ordered operations, and caller seeds.

The tools do not remove clip containers. Each source clip must exist. Requested
variations can copy it into adjacent rows. Exact empty-container creation stays
on `add_clip`; `write_notes`, `erase_notes`, and `delete_clip` also stay separate.
Both musical tools call `applyMusicalPatch`. They have no second compiler,
executor, or project mutation path.

The versioned public result reports musical outputs, differences, warnings,
clip rows, readback, change identity, reversal quality, and reversal limits. It
also names the exact `read_clip`, `revert_change`, and `show_changed_clip`
procedures. Internal planner record terms do not cross the public result.

## Description and observation versions

The new `ghostnote-description-v2` cohort contains 28 tools. It keeps the frozen
15-tool v1 artifact byte-identical and adds the musical path, exact low-level
comparators, observation tools, and required result procedures. The v2 SHA-256
is `5842b7410066a3e89bb17dc51b4fb884052e9eec844c2c95c0834ca0675a57bc`.
The golden includes names, titles, descriptions, input schemas, privilege
annotations, and the musical result contract.

Observation schema v2 adds concise musical-use entries. Each entry keeps the
actual generation or transformation tool, description version, result and
change identity, application state, and output, difference, and warning counts.
The linked instruction keeps its raw caller text and explicit operator response.
Stored schema-v1 records validate and migrate exactly when read. Unknown schemas
still refuse.

## Verification

Focused tests cover corpus routing, schema and boundary refusals, the public
result, v1 record migration, observation linkage, privilege classes, lexical
rules, and a real SDK client. The client generates, transforms, reads, opens,
and reverts through an in-memory MCP transport.

The full offline suite passes 617/617. Typecheck passes. The live ordinary MCP
client passes 2g-L1 through 2g-L9 against `gn-scale-test`. It used a positively
empty slot on Instrument Layer row 0, then reversed the transformation,
generation, and clip creation. Final readback found 10 tracks, 22 occupied
cells, selection at track 0 row 1, stopped transport, and the exact prior
schema-v1 observation value. `Last change` was restored.

## Retrospective

The first live probe printed each complete musical JSON schema in one passing
check. The probe now reports only tool names and privilege annotations. Keep
large public artifacts in goldens and report concise live evidence. No repository
instruction change is needed.
