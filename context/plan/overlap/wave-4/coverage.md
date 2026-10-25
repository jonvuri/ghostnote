---
title: Capability gaps after the three workflows
kind: note
state: active
updated: 2026-10-24
---

# Capability gaps after the three workflows

## Answer and assumptions

The three workflows can cover most ordinary Ghostnote host operations if
their variations deliberately exercise the matrix. They leave no obvious
fourth broad creative workflow. The main residual work is depth within
those workflows, platform support, and the file/analysis capabilities that
the user wants to defer or place elsewhere.

This is a conditional coverage assessment, not a claim that three example
projects prove all capabilities. The user selected the order and method in
[W4-002 and W4-003](decisions.md). The detailed variants below are proposals. The later priority choices in
W4-004 through W4-011 are applied in the [concrete sequence](workflow-sequence.md).

The comparison uses all 76 wave-3 rows, their 137 Ghostnote cells, and 129
external cells. [coverage.json](coverage.json) maps each row exactly once;
the [report](report.html#after-workflows) renders the map with the original
per-verb status and proof. Existing product capabilities count as part of
the union even when a new workflow does not need to rebuild them.

## What counts as proved potential

Keep two views of the comparison:

- **Demonstrated union:** current product behavior, scoped research results,
  and positive offline predicates. The best example of additional live
  capability is the Grid research behind Phase 11. Some offline codec
  predicates are also demonstrated.
- **Candidate envelope:** implemented external paths and named missing
  requirements. Source evidence can justify a focused investigation; it
  does not establish that the route works or meets Ghostnote's contract.

A Checked offline label can record a failure, a no-op round trip, or a
partial result. Count only its actual predicate. For example, the preset
codec has bounded no-op proof; the donor-free extractor is blocked. The
external pressure setters use the public API and do not establish a
workaround. See the [wave-3 proof discussion](../wave-3/report.html#proof)
and [E236](../../../evidence/experiments/e236-document-edit-limb.md).

The 76 rows are an inspected feature universe, not all of Bitwig. They do
not classify applicability for every verb. Do not multiply 76 by seven and
call the result a completion target. Nor can a whole-row label mean that
every field, object subtype, scale, inverse, and persistence case is covered.

## Main gaps and where to close them

This table describes breadth, not equal priority. The user prioritizes MIDI,
arrangement, automation, audio editing/readback, Grid, and modulation. Live
session control, broad structure/reuse, and platform expansion have lower
priority. Rare device state and nesting are bonuses. The row map now carries
these priorities and proposed V01–13 links. Existing proof is unchanged.
After the review (W4-025), tempo/meter, cue markers, track state, drum-pad
containers, and Effect-track creation have their own groups, so a row is
credited only to a variation that lists its work record.

| Gap after simple examples of all three workflows | Practical variation | Evidence and residual limit |
|---|---|---|
| **Grid construction and less common sound state** | In workflow 2, build a useful Poly Grid instrument; edit its graph and mappings; reopen it and exercise the result. Then select FX/Note Grid or relocation only when needed. | GI-1 has scoped live research on 6.1.4. GI-2 has mixed proof and new-setter gaps. Keep Phase 11 as owner. Basic device controls and macros do not cover it. |
| **Detailed MIDI and timeline semantics** | In workflow 1, use multichannel expressive material, pickups, loop offsets, note overlaps, long clips, and automation with curves. Check the fields used by the musical result and preserve unrelated content. | CA-1 is field-by-field work. Pressure, finer timing, and overlaps remain limits, not solved routes. CA-3/4/5/6 have source leads; exact Arranger writes and automation are not live-proved by the survey. |
| **Audio depth beyond insertion and a master recording** | In workflow 1 or 3, identify an existing audio clip's source/range, place or trim material, and produce the required isolated or bounded output. | MA-2 insertion and MA-3 capture do not cover CA-8 existing-clip reads. The latter has no route found. Warp/stretch needs a task-specific requirement. Recording inputs and final export are generally operator tasks. Quick inaudible track bounce is the preferred readback and needs route proof. They are not all in the demonstrated union. |
| **Live performance and session control** | In workflow 2, perform scene changes, start/stop clips, change launch settings, use cue markers and groove, and record the performance into the Arranger. | SM-4/5/6/8/9 and CA-7 have distinct scopes. A playable macro alone does not cover a session performance. Launcher recording is not exact timeline editing. |
| **Deep project structure, routing, and device reach** | Across workflows 1–3, use groups, returns, a hybrid track if needed, nested containers and devices beyond the current window; route audio and move/copy objects with their opaque state. | SM-7/10 and DP-3/4 retain source or unresolved boundaries. One flat project does not prove these cases. Large projects need explicit bounds and measured cost. |
| **Reusable outputs and project lifecycle** | In workflow 1, import material, save/reopen the project, export edited MIDI/audio, and reuse it. In workflow 2, export the sound and reload it in another project. | MIDI file tools exist. DP-6 preset export and SM-11 save are action-based source leads without full result proof. Create/open and resource portability need added requirements. Source history and registration stay with Ghostworks. |
| **Independent clients, upgrade fallback, and reference help** | Run selected operations through another API consumer; force optional internals unavailable; answer a device question from versioned docs. | Successful music workflows do not prove protocol compatibility, primary-only degradation, or documentation retrieval. HTTP is accepted future intent in W4-001, with no backlog item yet. |

These gaps can mostly become variations of the chosen workflows. They do
not need another broad creative phase. Platform cases remain separate
acceptance checks because a musical result cannot test them by itself.

## Residual work after deliberate workflow breadth

If the variations above are selected and pass, the main remaining categories
in the recorded matrix are:

1. **Offline authoring and exact file representation.** Recursive preset
   editing, computed footprints, donor-free construction, offline Grid
   generation, and optional `.bwclip` import. Live functional equivalence
   does not supply an offline artifact API. Most of this is intentionally
   deprioritized; `.bwclip` import remains an interchange choice.
2. **Analysis and library meaning.** Audio facts and features, musical
   navigation, transcription/separation, and cross-project search. These
   are external scope under the user's direction. They are not missing
   Ghostnote host features. Minimal interchange facts and Bitwig browser
   discovery stay on the host side.
3. **Support and delivery.** Documentation retrieval, client contracts,
   degradation, packaging, installation, publication, and compatibility
   checks. The musical workflows can exercise them but cannot establish
   broad support promises. Phase 10 retains its owners.
4. **Unproved or deliberately bounded depth.** Remaining expressive fields,
   unsupported media operations, wider Grid resource/array writes, patches
   above admitted bounds, and DSP-image changes. These stay named limits
   unless a practical task justifies a route investigation. Do not require
   them to call the selected workflows complete.

There is no justified completeness percentage at this point. The selected
variants and target verbs are not fixed, and the baseline combines product,
research, source leads, and unresolved requirements.

## Proposed functional acceptance rule

For each selected variation, state:

- The input, operation, and useful output. Example: move a chorus and its
  selected automation to a new song position, with the intended timing.
- The fields and neighboring state that must stay intact. Example: keep
  the unchanged notes and their expression; allow a new ID only if that
  does not break the required behavior or references.
- Independent evidence that the operation happened. Use host readback and,
  for sound behavior where needed, a bounded capture or operator audition.
  Do not substitute a writer echo or “sounds similar” for structural checks.
- A practical bound for size, latency, and operator work. Use the existing
  cost model when unchanged; measure a changed live path when implemented.
- Reuse or save/reopen checks only where the result requires them. State
  the available inverse and any loss. Exact byte restoration is required
  only when the selected contract promises it.

Track coverage by row and verb beside the case. One variation can cover
several cells. A passing case credits only its tested scope. This avoids
both a large artificial test project and an unsupported “all features” claim.

## Next decision

Assess the [proposed sequence](workflow-sequence.md) first. Then resolve its
remaining signal, data, and workflow boundaries. The outcome order and broad
priorities are settled. W4-D later converts selected cases into explicit
row/verb requirements and implementation sessions. Track readback and full
audio CRUD need more detail than the older insertion/capture rows supply.
