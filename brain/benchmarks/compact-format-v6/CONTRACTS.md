# Targeted analysis task-to-scorer contracts

This table maps each provider-task requirement to one scorer check and one
focused mutation. The deterministic suite also retains the complete v5 format,
motif, progression, guard, and output-state checks.

## Analysis batch

Each output field is a comma-separated list. All lists have the stated case
count and use chord-group and motif-pair order.

| Instruction requirement | Scorer check | Focused mutation |
|---|---|---|
| Return every stated chord ID in order. | `chord_identity` | Change one chord ID. |
| Derive each root pitch class from the named chord notes. | `root_pitch_class` | Change one root class. |
| Derive each lowest MIDI pitch class. | `bass_pitch_class` | Change one bass class. |
| Apply the exact interval formula for each chord quality. | `chord_quality` | Change one quality. |
| Use 0 for root, 1 for third, 2 for fifth, and 3 for seventh in the bass. | `inversion_number` | Change one inversion. |
| Apply the stated tonic-relative quality and inversion mapping. | `chord_function` | Change one function. |
| Apply the exact pitch and rhythm definition to each motif pair. | `motif_relation` | Change one relation. |
| Distinguish sustained, shared-onset, and arpeggiated chord notes. | `rhythm_class` | Change one rhythm class. |

The parser rejects a missing field, extra field, empty list item, non-integer
numeric item, or unequal list length. A perfect output must pass all eight
independent component checks.

## Difficulty tiers

The five tasks in each tier use these case counts:

| Tier | Ordered case counts |
|---|---|
| Easy | 1, 2, 2, 3, 3 |
| Medium | 2, 3, 4, 5, 6 |
| Hard | 4, 6, 8, 10, 12 |

Every tier uses new task hashes and new individual case hashes. Later tiers do
not repeat cases from earlier tiers.

## Output states

| State | Scored | Initial denominator |
|---|---:|---:|
| `initial` | yes | yes |
| `repaired` | yes | no |
| `unavailable` | no | no |
| `failed` | no | no |

An output-limit stop is `unavailable`. A transport failure is `failed`. A
repair never enters the initial numerator or denominator.

## Sequential gate

Only complete unique initial results determine the rate. A rate from 0.20
through 0.80 is eligible. A later Gemini tier requires complete ceiling
manifests for all earlier tiers. Claude requires the eligible Gemini manifest
for the same tier.
