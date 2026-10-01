---
title: Ghostnote Document 1.0 paired examples
kind: reference
state: active
updated: 2026-10-01
---

# Paired examples

These are authored specification inputs. They contain generated fixture music
under the repository [MIT license](../../LICENSE). Their owner is 8f1.
8f2 must verify these inputs with its reference codec and regenerate canonical
outputs. JSON files use readable layout. FIELDS files use the canonical record
layout. [expected.json](examples/expected.json) records independently calculated
content hashes. A schema pass does not prove all semantic rules.

| Case | JSON | FIELDS | Purpose |
|---|---|---|---|
| Complete | [complete.json](examples/complete.json) | [complete.fields](examples/complete.fields) | One clip and event set, all event properties, every initial overlay type, known-source timing, and inert annotations |
| Patch | [patch.json](examples/patch.json) | [patch.fields](examples/patch.fields) | Guarded add/remove/update, expression reset, clip rename, overlay revision and removal |
| Result | [patch-result.json](examples/patch-result.json) | [patch-result.fields](examples/patch-result.fields) | Expected materialized result; role becomes stale, timing remains current |
| No-op | [no-op.json](examples/no-op.json) | [no-op.fields](examples/no-op.fields) | Empty sparse changes against the complete base |
| Empty document | [empty.json](examples/empty.json) | [empty.fields](examples/empty.fields) | No clips and no events |
| Empty clip | [empty-clip.json](examples/empty-clip.json) | [empty-clip.fields](examples/empty-clip.fields) | A zero-length clip with complete all-channel coverage |
| Partial observation | [partial.json](examples/partial.json) | [partial.fields](examples/partial.fields) | Selected event only; unknown properties and missing membership cannot mean empty state |
| Unknown source | [unknown-source.json](examples/unknown-source.json) | [unknown-source.fields](examples/unknown-source.fields) | Cell-only triplet observation with unresolved residuals, not invented groove causes |

## Complete state and sparse changes

`n1`, `n2`, and `n3` belong to clip `part`. `n1` demonstrates channel 2, mute,
release velocity, articulation, scalar expression including pressure, and all
playback controls. The document can represent pressure without promising a
live pressure write. `n2` demonstrates exact nominal triplet rhythm over a
normalized event. `n3` demonstrates channel 16.

The patch adds `n4`, removes `n3`, changes `n1` pitch, resets its expression,
and renames the clip. Resetting expression changes all its members to defaults;
it is an atomic field. The patch removes motif and region claims that refer to
the deleted event. It replaces harmony with a fresh basis and member group.
The role's explicit members remain `n1,n2`, but its pitch and membership
dependencies changed. Its state becomes stale and its old basis remains.
Nominal and groove depend on timing, which this patch preserves. Removing an
overlay does not remove a note. Host permission, pressure handling, and fresh
readback are separate 8f3 requirements.

## Acquisition and intent

For `n2`, exact source onset `1/3` floors to `85/256`. Exact source duration
`1/6` rounds to `85/512`. Onset displacement is `-1/768`; duration displacement
is `-1/1536`. Nominal values retain `1/3` and `1/6`. In the complete example,
measured groove provenance records those deltas with no assigned intentional
components. In unknown-source, the deltas are null and the same observed
differences are unresolved residuals. Neither example calls them swing.

`n1` has nominal onset `1/4` and template contribution `1/64`. Its source and
realized onset are `17/64`, with no acquisition displacement. The declared
template has weights `17:15`. This records the author's interpretation.

To move its nominal onset to `1/2` and keep swing, explicitly update the
nominal overlay, set source onset to `33/64`, retain template `1/64`, and write
the core onset as `33/64`. Supply fresh dependency bases for both overlays.
To transfer that phase/template to another part, refer to the target event's
own nominal overlay and write the target's normalized realized onset. Merely
copying the overlay does not edit a note. R14-R16 and C14-C16 govern this case.

## Limits of this verification

8f1 checks JSON structure, paired example agreement, hashes, timing equations,
and current dependency bases with independent local calculations. Full
grammar conformance, error locality, general patch application, normalization
APIs, and reference serializers remain 8f2 work. These checks need no Bitwig
project, cache, provider, or paid call.
