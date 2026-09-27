# Task-to-scorer contracts

This table maps each task requirement to one scorer check and one focused
mutation. The deterministic suite also runs a valid and invalid response for
each arm and task.

## Decision families

| Family | Instruction requirement | Scorer check | Focused mutation |
|---|---|---|---|
| Analysis | Return the stated chord identity. | `chord_identity` | Change only `chord_id`. |
| Analysis | Derive the root pitch class from MIDI pitches. | `root_pitch_class` | Change only `root_pc`. |
| Analysis | Derive the lowest MIDI pitch class. | `bass_pitch_class` | Change only `bass_pc`. |
| Analysis | Use the stated interval formula for chord quality. | `chord_quality` | Change only `quality`. |
| Analysis | Use 0 for root, 1 for third, 2 for fifth, and 3 for seventh in the bass. | `inversion_number` | Change only `inversion`. |
| Analysis | Relate chord root and quality to `key_tonic_pc`. | `chord_function` | Change only `function`. |
| Analysis | Compare motif pitches, onset offsets, and durations with the stated relation formulas. | `motif_relation` | Change only `motif_relation`. |
| Analysis | Report `sustained` when all chord notes share one start and duration. | `rhythm_class` | Change only `rhythm`. |
| Motif | Include only fields that apply to the named operation. | `operation_specific_fields` | Add an irrelevant operation field. |
| Motif | Use the stated output IDs. | `output_identity` | Change one output ID. |
| Motif | Apply the exact transpose, invert, or rhythmic-scale formula. | `operation_formula` | Change one calculated pitch. |
| Motif | Preserve all properties named by the operation. | `preserved_properties` | Change one preserved velocity. |
| Progression | Use every chord start and all four named voices. | `chord_starts_and_named_voices` | Remove one note. |
| Progression | Use the exact duration and velocity. | `duration_and_velocity` | Change one velocity. |
| Progression | Cover all stated pitch classes. | `pitch_class_coverage` | Add one required class to the contract. |
| Progression | Use each stated bass pitch class. | `bass_inversions` | Change one required bass class. |
| Progression | Keep every voice in its inclusive MIDI range. | `voice_ranges` | Narrow one range below the answer. |
| Progression | Keep `bass < tenor < alto < soprano`. | `strict_voice_order` | Change only the declared voice order. |
| Progression | Keep the stated sum of absolute same-voice moves. | `same_voice_movement` | Set the maximum below the answer. |
| Progression | Meet the penultimate and final bass and final harmony rules. | `cadence` | Change only the final bass rule. |

The same-voice movement formula is:

```text
sum(abs(current_pitch[voice] - previous_pitch[voice]))
```

Apply it to each adjacent chord and to bass, tenor, alto, and soprano.

## Guard families

| Family | Instruction requirement | Scorer check | Focused mutation |
|---|---|---|---|
| Structure | Reconstruct every represented note and value. | `exact_relation` | Change one velocity. |
| Role continuation | Use each start with one bass and one lead note. | `starts_and_density` | Remove one note. |
| Role continuation | Use the stated duration. | `duration` | Change one duration. |
| Role continuation | Keep both roles in range. | `ranges` | Narrow one range. |
| Role continuation | Use the stated harmony at each start. | `harmony` | Remove one valid pitch class. |
| Role continuation | Keep each same-role leap within the limit. | `voice_leading` | Set the limit to zero. |
| Role continuation | Do not use the same pitch in both roles. | `no_collisions` | Merge one bass and lead pitch. |
| Role continuation | End the lead on the stated pitch class. | `cadence` | Change only the cadence class. |
| Revoice | Keep note count and chord starts. | `note_count_and_starts` | Remove one note. |
| Revoice | Preserve note IDs. | `stable_identity` | Change one ID. |
| Revoice | Preserve start, duration, voice, and velocity. | `preserved_properties` | Change one velocity. |
| Revoice | Preserve each chord pitch-class multiset. | `pitch_classes` | Change one pitch by one semitone. |
| Revoice | Apply the exact named operation. | `operation` | Change one pitch by one octave. |
| Revoice | Keep each voice in its stated range. | `range_limits` | Narrow one range. |
| Revoice | Keep strict bass-to-soprano order. | `voice_order` | Change only the declared order. |
| Local transformation | Compile to the stated note result. | `canonical_result` | Change the compiled target value. |
| Local transformation | Keep the source identity set. | `stable_identity` | Change one compiled ID. |
| Local transformation | Preserve every unrelated property. | `exact_preservation` | Change one unrelated pitch. |
| Local transformation | Use one `SET` operation. | `sparse_change` | Add one no-op `SET`. |
| Rhythm transformation | Change only the stated odd-indexed starts. | `exact_relation` | Change one velocity. |
| Document output | Keep the task base and source identity. Use no output overlays. | `document_context` | Change only `BASE`. |

## Output states

| State | Scored | Initial denominator |
|---|---:|---:|
| `initial` | yes | yes |
| `repaired` | yes | no |
| `unavailable` | no | no |
| `failed` | no | no |

An output-limit stop is `unavailable`. A transport failure is `failed`. The
suite tests both exclusions with a passing repair record in the same synthetic
summary. The repair does not enter the initial numerator or denominator.
