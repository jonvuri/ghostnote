# Task-to-scorer contracts

This table is the contract audit for every retained Phase 8c2.2 task family.
The deterministic suite rejects a reference answer when any listed primary
check fails. It also sends an invalid negative answer through every arm.

## Decision families

| Family | Instruction requirement | Scorer check | Focused mutation |
|---|---|---|---|
| Progression | Use every stated chord start and duration. Use bass, tenor, alto, and soprano once. | `chord_starts_and_named_voices` | Remove one note. Only this component fails. |
| Progression | Cover the chord pitch classes and put the stated class in bass. | `harmony_and_bass_inversion` | Change the first bass pitch class. Only this component fails. |
| Progression | Keep each voice in range and do not cross voices. | `voice_ranges_and_crossing` | Move one voice down one octave outside its range. Only this component fails. |
| Progression | Keep total same-voice movement at or below the stated limit. | `total_voice_leading` | Set the limit below the reference movement. Only this component fails. |
| Progression | End with the stated bass cadence class. | `cadence` | Change the required cadence class. Only this component fails. |
| Role continuation | Use every start and the stated bass and lead density. | `starts`, `role_density` | Shift one start or remove one note. Each mutation fails only its related check. |
| Role continuation | Use the stated duration. | `duration` | Change one duration. Only this check fails. |
| Role continuation | Keep roles in range and in the stated harmony. | `ranges`, `harmony` | Change one octave or one pitch class. Each mutation fails only its related check. |
| Role continuation | Keep leaps within the limit and avoid pitch collisions. | `voice_leading`, `no_collisions` | Tighten the leap limit or merge two pitches. Each mutation fails only its related check. |
| Role continuation | End the lead on the stated cadence class. | `cadence` | Change the cadence class. Only this check fails. |
| Revoice | Keep note count and chord starts. | `note_count_and_chord_starts` | Remove one note. Only this check fails. |
| Revoice | Keep IDs when the arm represents IDs. | `stable_identity` | Change one ID. Only this check fails. |
| Revoice | Preserve duration. | `preserved_duration` | Change one duration. Only this check fails. |
| Revoice | Preserve voice. | `preserved_voice` | Change one voice label. Only this check fails. |
| Revoice | Preserve velocity. | `preserved_velocity` | Change one velocity. Only this check fails. |
| Revoice | Preserve each chord's pitch-class multiset. | `chord_pitch_classes` | Change one pitch by one semitone. Only this check fails. |
| Revoice | Apply the exact named operation. | `operation` | Move one pitch by one octave. Only this check fails. |
| Revoice | Keep the global and per-voice range limits. | `range_limits` | Move one pitch three octaves up. Only this check fails. |
| Revoice | Keep strict bass-to-soprano pitch order. | `voice_order` | Move the bass up one octave across the tenor. Only this check fails. |

The `nearest` operation keeps the first chord unchanged. Each later chord uses
octave placements that minimize total same-voice movement from the prior output
chord. The scorer accepts every tied minimum. A deterministic case supplies
two tied valid realizations and requires both to pass.

The `drop-2` operation lowers the second-highest source pitch by one octave. It
sorts the four result pitches and assigns them to bass, tenor, alto, and
soprano. The `first-inversion` operation raises the lowest source pitch by one
octave. It then uses the same sorted voice assignment.

## Regression and guard families

| Family | Instruction requirement | Scorer check |
|---|---|---|
| Melody generation | Use the stated count, starts, and durations. | `note_count`, `rhythm` | Remove one note or change one duration. Each mutation fails only its related check. |
| Melody generation | Use the stated range and pitch collection. | `range`, `pitch_collection` | Move one pitch by an octave or semitone. Each mutation fails only its related check. |
| Melody generation | Meet strong-beat, motif, and cadence rules. | `strong_beat_harmony`, `motif`, `cadence` | Change one matching contract value. Each mutation fails only its related check. |
| Structure | Reconstruct every represented value. | `exact_relation` | Change one velocity. The check fails. |
| Local transformation | Apply one stated change to the stated base hash. | `canonical_result`, `sparse_change` | Change the result or add one operation. Each mutation fails only its related check. |
| Local transformation | Keep IDs and every unrelated value. | `stable_identity`, `exact_preservation` | Change one ID or unrelated pitch. Each mutation fails only its related check. |
| Rhythm transformation | Change only the stated odd-indexed starts. | `exact_relation` | Change one velocity. The check fails. |
| Fixed-ID motif | Use the stated new IDs and offsets. Preserve duration, voice, and velocity. | `exact_relation` | Change one velocity. The check fails. |

The native MIDI-Like arm has no IDs. Its exact-relation checks omit identity.
All other arms include identity when the task has note output.

## Aggregation contract

The calibration summary needs one complete run from each named provider and one
shared protocol hash. It pools exact JSON and native MIDI-Like within each
provider and family. The offline aggregation test uses one informative control
case and one revoice-floor case. It requires `proceed-development` for the
informative case and `repair-measurement` for the floor case.
