---
title: Current state
kind: status
state: active
updated: 2026-08-29
phase: phase-5
session: 5o-late-bound-container-modulation
---

# Now

Phases 1, 2, and 4 are complete. Phase 3 remains deferred. Phase 5 is open for
the public modulation generalization selected by ColourCopy dogfood. The open
dogfood loop stays active until the operator explicitly closes it. Session 6a
remains selected after Phase 5 and the loop close.

## Stable baseline

The first Phase 5 closeout remains valid. Public named modulation edits, native
Instrument Layer composition, four-entry live behavior, exact reversal, and
remote CI passed. [E73](evidence/experiments/e73-four-entry-composition-dogfood-passes-live.md)
and the [Phase 5 outcome](archive/outcomes/PHASE-5.md) record that baseline.

D02 is complete. Its nine sessions resolved Drum Machine composition, nested
parameter guards, cohort writes, public descriptions, native insertion,
parameter domains and integrity, clip colors, and partial observation verdicts.
The [dogfood plan](plan/dogfooding/d02-drum-machine-and-surface-hardening.md)
and [run ledger](plan/dogfooding/runs.md) hold the full history. DF-001 remains
watching. DF-002 marks one invented operator verdict as invalid evidence.

The accepted live project baseline remains `New 3`: five tracks, eight launcher
rows, the accepted six-pad Drum Machine, and the accepted Instrument Layer with
nested Polysynth. No engineering scratch content remains.

## Phase 5 continuation

Session 5j is complete. Public modulation targets use exact DirectParameter ids
and names for native, VST3, and CLAP hosts. Raw routes remain internal. Native
and VST3 behavior passed live with exact cleanup. [E85](evidence/experiments/e85-general-directparameter-modulation-targets-are-live.md)
records the result.

Session 5k is complete. Public `inspect_preset_modulation` reads one explicit
human-saved preset and returns its SHA-256 fingerprint, host tier and format,
ordered entries and devices, semantic modulator locations, and public modulator
inventories. Each internal list must map exactly once. An ambiguous or
incomplete mapping is unsupported.

The required native, container, VST3, CLAP, sample-less Sampler, and sampled
Sampler fixture matrix passes. Repeated names remain distinct by ordered path.
Known targets use the 5j DirectParameter identity. Unknown targets are explicit.
Results expose no raw route or binary selector. The operation makes no Bitwig or
preset-file change. The full brain check passes 906/906. [E86](evidence/experiments/e86-semantic-preset-modulation-inspection-is-complete.md)
records the implementation and qualifications.

Session 5l is complete. One exact 5k semantic location now selects one internal
list for add, replace, retarget, amount, or delete. The write requires the exact
inspected fingerprint. Its result returns the selected semantic location and
public before and after inventories without a list selector.

Container object edits rebuild the ordered unique GUID reference set across all
lists. Sibling semantic inventories stay unchanged. Sampled edits relocate all
four tested reference stubs by exact measured deltas or refuse before apply.
Outer and nested Instrument Layer cases passed live with exact page witnesses,
reversal, and track-list cleanup. [E87](evidence/experiments/e87-list-scoped-topology-is-complete.md)
records the result. The full brain check passes 912/912.

Session 5m is complete. The operator-authored `gn-preset-zoo` fixture contains
all 43 Bitwig 6.0.6 factory modulator types. The complete fixture and 42
isolated donor objects pass live loads with exact cleanup. Wavetable LFO is the
one explicit exclusion because it needs linked companion state outside its
modulator object.

The manifest drives runtime donor selection, both public type vocabularies,
asset generation, and `list_modulator_types`. It exposes 42 public add and
replace types. LFO, Random, Vibrato, and Classic LFO support sampled presets;
the other new donors are Tier 1 only. Multi-output donors keep one active public
route. The list-local identity gate is the `0x1a1a`/`0x1a1b` pair. [E88](evidence/experiments/e88-general-donor-catalog-is-manifest-driven.md)
records the result. The full brain check passes 919/919. Extension tests and the
Bitwig 6.0.6 deployment-freshness probe pass.

Session 5n is complete. `inspect_preset_modulation` supplies the fingerprint
and semantic location required by the public `author_modulators` workflow. The
write accepts general DirectParameter targets, all five editors, and all 42
supported manifest types at their recorded tier. Requested, decoded, edited,
observed, and verified facts stay separate. Binary controls remain private.

The Bitwig 6.0.6 matrix passes for native instrument, native FX, VST3, CLAP,
sample-less Sampler, sampled Sampler, and one selected container entry. VST3
and the container entry prove active modulation. Other hosts use exact
structural and available page witnesses at their measured controller-API
boundary. Every insertion reverses. Cleanup restores the exact five-track
entry state of the disposable project. [E89](evidence/experiments/e89-general-public-preset-authoring-is-live.md)
records the result. The full brain check passes 925/925. Extension tests,
deployment freshness, description cohort v17, and fresh Codex exposure pass.
The review repair adds an explicit inserted-host check for every editor and
keeps internal validation warnings out of the public result.

## Next action

Implement [Session 5o](plan/phase-5/5o-late-bound-container-modulation.md).
Prove that an owned container route can bind to a native device and a plug-in
that move into it after load. Do not begin Phase 6a until Phase 5 and the open
dogfood loop close.

## Retrospective

Measure cold plug-in settlement through the first complete chain readback.
Use the current DirectParameter name from live inspection in every witness.
Map every engine diagnostic to public terms before returning it.
