---
id: E88
kind: evidence
state: active
source: phase-5-session-5m-general-donor-catalog
---

# E88 — General donor catalog is manifest-driven [K] (2026-08-28)

**Verdict: one manifest records the complete Bitwig 6.0.6 factory modulator
inventory. It retains 42 curated transplant donors. E96 narrows the supported
public catalog to the 12 types with exact relocated live witnesses.**

## Operator-authored cohort

The installed host contains 43 factory `.bwmodulator` files. The operator saved
`gn-preset-zoo.bwpreset` with all 43 types. Each type has at least one route.
The fixture SHA-256 is
`05ede862291810e2ca7925075f1acd318ccf438ff35bc10d2edbfe446fe7cb43`.

The complete zoo loads in Bitwig Studio 6.0.6. Forty-two extracted donor objects
also load alone after retargeting. Twelve types expose more than one output.
Public add and replace operations keep the first output active and set the other
donor route amounts to zero. The full isolated-donor run restores the exact
entry track list.

Wavetable LFO was the sole format exclusion in this experiment. Its saved preset contains one linked
reference inside the modulator object and companion state outside that object.
A raw `0x06c9` transplant is incomplete. Public add and replace refuse this type
until the companion-state boundary is implemented.

This experiment proved that 42 donors load alone. It did not prove that all 42
produce an exact page after relocation. E96 corrects that product claim.

## Corrected instance identity

The host-authored zoo repeats `0x1a1b` values `0`, `1`, and `2`. It also advances
`0x1a1a` for each group of three. All 43 combined pairs are unique, and the
preset loads. The earlier negative control repeats both values and still
rejects. The list-local load gate is therefore the `0x1a1a`/`0x1a1b` pair, not
`0x1a1b` alone.

E95 adds the UI meaning that this experiment did not test. `0x1a1a` is the
modulator-grid column and `0x1a1b` is its row. Pair uniqueness is sufficient to
load, but compact three-row allocation is required for usable tile placement.

## Sampled-preset standing

LFO, Random, Vibrato, and the newly routed Classic LFO have measured footprints.
Classic LFO loads only at `0x0e`; `0x0d` and `0x0f` reject. Expressions and the
other new types stay Tier 1 only. Expressions loads alone on Polysynth but
rejects on the sampled fixture at `0x12`, `0x13`, and `0x14`. A Tier-1-only type
refuses before a project write when the target preset has sample reference
stubs.

## Product path

`brain/assets/modulators/manifest.json` drives asset extraction, runtime donor
selection, both public write vocabularies, and `list_modulator_types`. The public
catalog reports 43 host types, 12 supported types, and 31 exclusions. It exposes
operations, tier standing, witness requirements, provenance, and refusal text.
It does not expose donor ids, routes, footprints, GUIDs, list indexes, or offsets.

## Verification

- `npm run build:donors`: 46 owned assets regenerate from their fixtures. The
  installed 43-type inventory matches.
- `npm run probe:phase5m-zoo`: the full zoo and 42 isolated donors load. Cleanup
  restores the exact entry track list.
- `npm run probe:phase5m-footprints`: Classic LFO triangulates at `0x0e`.
  Expressions keeps an explicit Tier-1-only standing. Cleanup is exact.
- `npm run check`: 919/919 pass.
- `./gradlew test`: passes from `extension/`.
- `npm run probe:hello`: Bitwig 6.0.6, API 25, deploy freshness, and the
  148-method contract pass.

## Qualification

The curated assets remain useful offline candidates. The public catalog exposes
only types that pass exact relocated page verification. Wavetable LFO needs a
new companion-state editor, not another donor preset.

## Retrospective

Test a host-authored dense list before treating one byte as the complete
instance identity. The adjacent `0x1a1a` field explained the apparent conflict.
