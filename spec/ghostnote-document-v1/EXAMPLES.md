---
title: Ghostnote Document 1.0 paired examples
kind: reference
state: active
updated: 2026-11-08
---

# Paired examples

These are authored specification inputs. They contain generated fixture music
under the repository [MIT license](../../LICENSE). Their owner is 8f1.
8f2 verifies these inputs with the [reference codec](CODEC.md). It writes
canonical outputs to the [versioned corpus](conformance/v1/canonical/). JSON files use readable layout. FIELDS files use the canonical record
layout. [expected.json](examples/expected.json) records independently calculated
content hashes. A schema pass does not prove all semantic rules.

| Case | JSON | FIELDS | Purpose |
|---|---|---|---|
| Complete | [complete.json](examples/complete.json) | [complete.fields](examples/complete.fields) | One clip and event set, all event properties, clip provenance with a source and a generator, and inert annotations |
| Patch | [patch.json](examples/patch.json) | [patch.fields](examples/patch.fields) | Guarded add/remove/update, expression reset, clip rename, and provenance cleared with null |
| Result | [patch-result.json](examples/patch-result.json) | [patch-result.fields](examples/patch-result.fields) | Expected materialized result of the patch |
| No-op | [no-op.json](examples/no-op.json) | [no-op.fields](examples/no-op.fields) | Empty sparse changes against the complete base |
| Empty document | [empty.json](examples/empty.json) | [empty.fields](examples/empty.fields) | No clips and no events |
| Empty clip | [empty-clip.json](examples/empty-clip.json) | [empty-clip.fields](examples/empty-clip.fields) | A zero-length clip with complete all-channel coverage |
| Partial observation | [partial.json](examples/partial.json) | [partial.fields](examples/partial.fields) | Selected event only; unknown properties and missing membership cannot mean empty state |
| Clip defaults | [clip-defaults.json](examples/clip-defaults.json) | [clip-defaults.fields](examples/clip-defaults.fields) | A drum clip whose notes share channel 10 and release velocity 0: the CLIP states them once, and only the mute column remains |

## Complete state and sparse changes

`n1`, `n2`, and `n3` belong to clip `part`. `n1` demonstrates channel 2, mute,
release velocity, articulation, scalar expression including pressure, and all
playback controls. The document can represent pressure without promising a
live pressure write. `n2` sits at `85/256` with duration `85/512`, the
normalized cells of a source triplet (R07). `n3` demonstrates channel 16.
Because only `n1` sets most optional fields, the canonical FIELDS binding
names them all and the other rows write `_`.

The clip provenance names a source file, its sha256, the source bar range,
the conversion settings, a Ghostworks reference, and a generator script
([R33](SPEC.md#r33--clip-provenance)). It is a pointer and makes no claim
about the notes.

The patch adds `n4`, removes `n3`, changes `n1` pitch, resets its expression,
renames the clip, and clears its provenance with null. Resetting expression
changes all its members to defaults; it is an atomic field. `n4` omits every
optional field; the base clip states no default, so it takes the portable
defaults. Host permission, pressure handling, and fresh readback are separate
8f3 requirements.

## Clip defaults

In clip-defaults, `k1`, `h1`, and `s1` all have channel 10 and release
velocity 0. Canonical FIELDS states them once as
`"defaults":{"channel":10,"releaseVelocity":0}` on the CLIP record and binds
only `mute`, the one optional field whose values differ; `k1` and `s1` write
`_` there. The JSON file states the same defaults; canonical JSON expands them
into the events. Both encodings have one content hash
([R34](SPEC.md#r34--clip-column-defaults)).

## Limits of this verification

8f1 checks JSON structure, paired example agreement, and hashes with
independent local calculations. The [8f2 conformance corpus](conformance/v1/README.md) checks grammar, error
locations, patch application, normalization APIs, and reference serializers. These checks need no Bitwig
project, cache, provider, or paid call.
