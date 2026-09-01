---
id: E92
kind: evidence
state: active
source: phase-5-session-5q-general-device-source-composition
---

# E92 — General device-source composition is live [K] (2026-08-31)

**Verdict: one public guarded workflow composes native, VST3, CLAP, preset,
existing-move, and existing-copy sources in unique named FX Layer entries. It
proves complete structure, state, and modulation witnesses. Its exact issued
checkpoint restores existing devices and removes only owned content.**

## Public lifecycle

`compose_device_sources` requires the complete top-level name and enabled-state
order. Each entry has one unique caller name, one explicit source kind, and
zero or more supported modulators. Native sources resolve by exact catalog
name. VST3 and CLAP sources use their exact public identifiers. Presets use an
absolute path. Preset-local authoring also requires the inspected fingerprint
and semantic modulator location.

The workflow records these guarded stages:

1. Author, insert, and position one owned FX Layer.
2. Give the seed entry an explicit name and create the remaining named entries.
3. Insert each new source at top level or identify one existing source.
4. Move or copy the source into its caller-named entry.
5. Prove the complete entry order, device order, enabled state, scalar
   fingerprint, modulator pages, and requested behavior.

The result keeps source identity separate from the observed device name. A
preset result reports both its metadata name and observed host name. It also
reports whether the names agree. Sampled preset state stays opaque. The result
reports adjusted sample references but does not claim byte-exact state
readback.

## Live source matrices

The final probe ran on Bitwig Studio 6.0.6 with extension API 25.

The four-entry new-source request preserved caller order:

- Zebra VST3 used class UID identity, reported 2,185 DirectParameter rows, and
  reached maximum Cutoff divergence `0.4954851269721985` from the outer LFO.
- Native Polysynth resolved by exact catalog name and reported 55 rows.
- Zebra3 CLAP resolved by exact CLAP id and reported 2,193 rows.
- The sampled Sampler preset reported 32 rows, four adjusted sample references,
  and one preset-local LFO page. Its metadata and observed names were both
  `Sampler`.

The existing-source request used two entries with the observed name `Delay+`:

- The copy was a new instance. It reported no state-identity claim. Its outer
  Blur route reached maximum divergence `0.4780701994895935`.
- The move preserved the same instance and the same 23-row scalar fingerprint,
  `e9f860bc65c90016511980af293a8ce9d6b5c0414c6b013a81a9b2c1741a70d9`.

Both matrices reported complete named entries and enabled state. Both
reversals ran in reverse stage order. The first removed all four owned sources.
The second removed the copy, restored the moved Delay+, and removed the empty
owned container. Cleanup restored exactly `gn-preset-zoo`, `Audio 2`, `Inst 3`,
`FX 1`, and `Master`.

## Host boundaries and failure recovery

The current complete chain window supports at most four entries. A fifth entry
refuses before a project write. The five source categories therefore cannot fit
in one current request. The new-source and existing-source matrices cover all
six source variants across separate requests. Session 5r owns a wider bank.

Outer FX Layer routes late-bind only to entry 0. In live exploration, routes to
future entries caused all outer modulator pages to disappear. Later entries can
use preset-local modulation or no modulation. Session 5r owns later-entry outer
routes with a wider pre-authored or measured shape.

A failed later source keeps each earlier receipt and the last exact checkpoint.
The checkpoint also records partial entry-name preparation and a source that
was inserted but not relocated. Reversal checks complete top-level and nested
state, fingerprints nested devices, restores moved existing devices, and uses
recorded own-change clearance for inserted and copied instances. A changed or
unissued checkpoint refuses before a write.

Review repairs close three interference gaps. Every checkpoint state now proves
that the owned container is empty before removal. Each extraction carries its
exact expected top-level order and revision into the next destructive stage.
The final witness compares every nested device count, position, name, and
enabled state with the completed checkpoint entries.

Large plug-in inventories use bounded settlement after structural changes.
Active witnesses retry only transient selector or sample loss. Identity,
automation, moving-base, and silent-route failures still stop immediately.

## Verification

- Focused general composition and description cohort: 35/35 pass.
- `npm run check`: 957/957 pass.
- `./gradlew test`: passes from `extension/`.
- `npm run probe:hello`: the fresh 149-method contract, Bitwig 6.0.6 API 25,
  and exact five-track baseline pass.
- `npm run probe:phase5q-composition`: both source matrices, both reversals, and
  exact cleanup pass.
- Description cohort `ghostnote-description-v19` is frozen at
  `b2c9a1c4f9e4dfd6e202821da94e5a25a4f4218fd46e3b4c0eef33c714a4fdd1`.
- Diff whitespace checks pass.

## Retrospective

Checkpoint each accepted structural name before the next write. Do not author
outer routes to entries that do not yet exist. Move a new device to its final
observable location before requiring its complete parameter inventory. Keep
one exact order and revision boundary between destructive reversal stages.
