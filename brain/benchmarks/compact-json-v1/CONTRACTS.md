# Task-to-scorer contracts

This table maps each calibration instruction to a scorer check. The offline
suite runs a valid answer, an invalid answer, and one-property mutations.

## Decision families

| Family | Instruction requirement | Scorer check | Focused mutation |
|---|---|---|---|
| Progression | Use every chord start and named voice. | `chord_starts_and_named_voices` | Remove one note. |
| Progression | Use the harmony and bass inversion. | `harmony_and_bass_inversion` | Change one bass pitch class. |
| Progression | Keep voice ranges and avoid crossing. | `voice_ranges_and_crossing` | Move one voice outside its range. |
| Progression | Keep total voice leading within the limit. | `total_voice_leading` | Set the limit below the answer. |
| Progression | End with the stated cadence. | `cadence` | Change the cadence class. |
| Role continuation | Use every start and the stated role density. | `starts`, `role_density` | Shift one start or remove one note. |
| Role continuation | Use the stated duration. | `duration` | Change one duration. |
| Role continuation | Keep roles in range and harmony. | `ranges`, `harmony` | Change one octave or pitch class. |
| Role continuation | Keep the leap limit and avoid collisions. | `voice_leading`, `no_collisions` | Tighten the limit or merge two pitches. |
| Role continuation | End the lead on the cadence class. | `cadence` | Change the cadence class. |
| Revoice | Keep note count and chord starts. | `note_count_and_chord_starts` | Remove one note. |
| Revoice | Keep IDs in JSON arms. | `stable_identity` | Change one ID. |
| Revoice | Preserve duration, voice, and velocity. | `preserved_duration`, `preserved_voice`, `preserved_velocity` | Change one field. |
| Revoice | Preserve each chord's pitch classes. | `chord_pitch_classes` | Change one pitch by one semitone. |
| Revoice | Apply the named operation. | `operation` | Move one pitch by one octave. |
| Revoice | Keep global and per-voice ranges. | `range_limits` | Move one pitch three octaves. |
| Revoice | Keep strict voice order. | `voice_order` | Cross bass and tenor. |

`nearest` keeps the first chord. Each later chord uses the least total
same-voice movement from the prior output chord. The scorer accepts tied
minima. `drop-2` lowers the second-highest source pitch by one octave.
`first-inversion` raises the lowest source pitch by one octave. Both operations
sort the result and assign bass through soprano.

## Regression and guards

| Family | Instruction requirement | Scorer check | Focused mutation |
|---|---|---|---|
| Melody | Use the note count, rhythm, range, and pitch collection. | `note_count`, `rhythm`, `range`, `pitch_collection` | Change one related value. |
| Melody | Meet strong-beat, motif, and cadence rules. | `strong_beat_harmony`, `motif`, `cadence` | Change one contract value. |
| Structure | Reconstruct every represented value. | `exact_relation` | Change one velocity. |
| Local transformation | Apply one sparse change to the stated base. | `canonical_result`, `sparse_change` | Change the result or add one operation. |
| Local transformation | Keep IDs and unrelated values. | `stable_identity`, `exact_preservation` | Change one ID or pitch. |
| Rhythm transformation | Change only the stated starts. | `exact_relation` | Change one velocity. |
| Fixed-ID motif | Use the new IDs and offsets. Preserve other fields. | `exact_relation` | Change one velocity. |

Native MIDI-like omits identity checks. Its local transformation returns a
complete score because it has no sparse patch form.

## Prompt forms

The package permits nine grammar forms: one document and one patch form for
each JSON arm, plus one native document form. Each form has an exact template
and a complete parsing example. The deterministic suite parses every example.

## Calibration aggregation

Calibration pools `exact-object-json-midi` and `midi-like-native` as controls
for each provider and decision family. A family is eligible when its pooled
pass rate is from 0.20 through 0.90 on at least two providers. If progression,
role continuation, or revoicing is not eligible, return
`repair-measurement`. Otherwise, return `proceed-development`.

Calibration cannot select a representation. The factorial report contains
paired denominators, discordant pairs, effects, and uncertainty. Native
MIDI-like does not enter a factorial contrast.
