---
title: E117 — Extracted structure is the reference default
kind: evidence
state: active
updated: 2026-09-20
parent: ../../plan/phase-6/6g-reference-conditioned-continuation-and-structural-transfer.md
---

# E117 — Extracted structure is the reference default

## Verdict

Use extracted musical structure as the default reference form. Add a short raw
excerpt only when the task needs a specific motif, rhythm, or voicing detail.
Keep seed-only context as a valid creative arm. Raw excerpts are not a default.

Extracted structure was the only agent arm that produced six valid first-round
patches without correction on both tested models. Mixed context won or tied
several operator choices, but it was less reliable and copied more exact source
events. Seed-only context won the focused motif task. Reference context does not
give a universal quality improvement.

Reject Notochord as a continuation or transfer specialist for this direction.
It was deterministic under the fixed controls, but none of its six outputs met
the exact task contracts. This rejection is about task fit and output validity.
It is not a license rejection.

## Cohort and provenance

The main cohort used three independent seed and reference pairs. It covered
continuation, motif variation, groove transfer, voice leading, arrangement
roles, and combined transfer. The deterministic cohort hash was
`25a9dff3b0530d24aa39d9bf825a8f90eefdf36277673566ab83c44746c60c53`.

All executable seed and reference notes were generated for this probe under the
project MIT license. No Lakh MIDI file or third-party note sequence was used in
an agent arm. Each context declared its exact coverage, permission, and hash.

| Reference | Complete coverage | SHA-256 |
|---|---:|---|
| motif | 16 beats | `76dfc6b23cfe76c9b33e81f4c513254b50cfd0238b59f7afcee2f0c2a2828f86` |
| groove | 8 beats | `e469e05bb04f5f5b1a6d6fcff828244059af2264460a9f9ff5a4abd95b26aeed` |
| arrangement roles | 16 beats | `5a807cb6220becac6670498ab87c08ff6c149b2f0af1777c8381b9fd203e6f1b` |
| texture | 16 beats | `0e66b22dc1713bc51ac53eb27f600e3926bd03d8a463dbbb5d5799d98edc34db` |

Raw arms received complete compact-bar references. Extracted arms received
facts from the same complete coverage. Mixed arms received the extracted facts
and the first half of each raw reference. Seed-only and Notochord arms received
no reference content.

The focused follow-up used separate eight-bar seeds and references. It added
fixed accompaniment and four-bar target material for motif, groove, and voice-
leading tasks. Its cohort hash was
`8486a2254b7dc5b36fba0c576192b03952bc71b42d0862b946c53be8de091bf4`.

## Main agent results

GPT-5.4 Mini and Gemini 3.8 Flash received the same task contracts within each
arm. The compiler checked source hashes, exact time strings, target windows,
roles, ranges, note counts, collisions, and monophonic overlap. Invalid output
did not reach a live project.

| Model and arm | Valid tasks | Trait checks | Correction turns | Initial input | Initial output | Initial latency |
|---|---:|---:|---:|---:|---:|---:|
| GPT, seed-only | 5/6 | 5/13 | 1 | 2,126 | 5,769 | 25,861 ms |
| GPT, raw reference | 6/6 | 8/14 | 1 | 5,568 | 4,956 | 21,478 ms |
| GPT, extracted structure | 6/6 | 6/14 | 0 | 3,682 | 8,330 | 28,916 ms |
| GPT, mixed | 4/6 | 3/12 | 1 | 5,023 | 7,016 | 21,265 ms |
| Gemini, seed-only | 6/6 | 5/14 | 0 | 2,432 | 8,397 | 18,136 ms |
| Gemini, raw reference | 5/6 | 6/12 | 1 | 6,446 | 4,896 | 13,647 ms |
| Gemini, extracted structure | 6/6 | 6/14 | 0 | 4,230 | 7,242 | 14,767 ms |
| Gemini, mixed | 6/6 | 7/14 | 1 | 5,772 | 7,045 | 14,703 ms |

The deterministic baseline produced 6 of 6 valid patches and passed 14 of 14
declared trait checks. It is a contract control, not an aesthetic baseline.

The raw run hashes were
`edaa8e0133039bf94667eefc6f61a6cf7df8dadcdb8663beb6476d43631138a9`
for GPT and
`0e7dcb644ba647ee1759c27e8f46c481f2532a5306db37e727753db3001ef9e8`
for Gemini.

The remote client process added about 4.9 to 5.1 MB to its resident high-water
mark during the first arm. Later arms reported no added high-water mark. This
measurement does not include provider memory.

## Copying and structural similarity

The probe measured requested traits separately from exact event, note-sequence,
rhythm-sequence, pitch, contour, harmony, density, and role similarity. Exact
event matches across the six main tasks were:

| Model | Seed-only | Raw reference | Extracted structure | Mixed |
|---|---:|---:|---:|---:|
| GPT | 2 | 69 | 2 | 15 |
| Gemini | 6 | 7 | 14 | 37 |

Raw and mixed context sometimes increased trait transfer. They also increased
exact copying. The effect was not stable across models. This is why raw content
needs a task reason, bounded coverage, and copy evidence.

The focused follow-up had almost no exact event copying. Only the extracted
voice-leading output matched one exact event. All other valid outputs matched
zero exact events. Longer structural similarities remained separate metrics.

## Focused follow-up

The focused ballot fixed the accompaniment and gave task-specific listening
guidance. A fresh Gemini run was required after the operating system removed
the temporary first ballot. Every initial fresh response used `operations`
instead of the required `ops` field. The compiler refused all 12 task patches.
One exact-shape correction made all tasks valid.

| Arm | Valid after correction | Trait checks | Total input tokens | Total output tokens | Total latency |
|---|---:|---:|---:|---:|---:|
| Seed-only | 3/3 | 7/8 | 11,905 | 6,497 | 18,260 ms |
| Raw reference | 3/3 | 6/8 | 20,682 | 7,600 | 22,405 ms |
| Extracted structure | 3/3 | 7/8 | 14,290 | 5,842 | 16,711 ms |
| Mixed | 3/3 | 7/8 | 16,979 | 8,019 | 21,056 ms |

The final fresh run hash was
`6d9b45198eef67336d2e776514200dc2ea95fd2ce50ea9a72c7145e794bad85a`.
The initial rejected run hash was
`23aa4977fb2abaaffd8d2fbfafb98a4f9dc7e3aae83afd1c8bc77c6629deb4c2`.

## Operator verdicts

The first blind ballot exposed an evaluation defect. Its short examples lacked
enough musical context and accompaniment. The operator could still rank four
tasks: mixed then raw for continuation, extracted then mixed for arrangement,
and mixed tied with extracted for combined transfer. Raw tied with mixed for
motif variation, but the missing bass made that vote weak. Groove and voice-
leading results were ambiguous.

The focused ballot used longer material and fixed backing. The operator chose:

- seed-only for motif development because it was more interesting and returned
  to a lower register;
- mixed for groove, then extracted structure; and
- extracted structure for voice leading, then seed-only.

The mixed groove winner was the only fresh candidate that passed the probe's
non-straight-timing check. The operator still judged it mainly by sound quality
because the transfer goal was not clear. Record this as a preference, not proof
of perceived groove transfer.

The combined ballots do not select one aesthetic winner. They support extracted
structure as the reliable reference default. Mixed context remains a bounded
task option. Seed-only remains necessary as a control and can be preferred.

## Notochord gate

The bounded run used Notochord 0.8.0 and PyTorch 2.10.0. The installed temporary
environment used 542,838,177 bytes. Startup took 188 ms. The measured inference
pass took 3,187 ms and added 264,028,160 resident bytes.

The [package code](https://github.com/Intelligent-Instruments-Lab/notochord) is
MIT licensed. The tested `notochord_lakh_50G_deep.pt` checkpoint from the
[project release](https://github.com/Intelligent-Instruments-Lab/iil-python-tools/releases/tag/notochord-v0.4.0)
was 213,035,415 bytes. Its SHA-256 was
`3959a4ce6a7f47038e98f1d2a6653a4c23b817f69cec407cb78c1f9ccde16c85`.
The release did not state separate checkpoint terms. The operator confirmed
that the [Lakh MIDI Dataset](https://colinraffel.com/projects/lmd/) license was
sufficient for this experiment and directed the test to continue. Code,
checkpoint, and training-data provenance remain separate records.

The implementation exposes ProgramChange, NoteOn, and NoteOff events. It does
not cover Ghostnote note expression. Fixed application and PyTorch seeds made
all 6 repeated tasks deterministic. None of the six outputs met the exact patch
contracts. The continuation had monophonic overlap. Other tasks usually missed
minimum density or note-count requirements.

The Notochord run hash was
`6faaac16548b08b3aafbb4d60cbbb4a542cfd2cbdd93a80ad835ab9295bbcf0a`.
Do not add Notochord to the product dependency graph. It can remain an external
event-generation comparison if a later task needs that narrower baseline.

## Refusal and cleanup

The exact compiler refused unsupported timing, a stale source hash, and a note
collision before any write. No probe wrote to Bitwig or changed a live project.

Temporary provider responses, rendered ballot audio, the Notochord environment,
the checkpoint, package caches, and Python bytecode were removed after their
hashes and results were recorded. No third-party MIDI, model, audio, or live
project artifact remains.

## Retrospective

Raw excerpts did not supply the most reliable signal. Extracted structure did.
Short solo examples made task intent hard to hear. Future creative evaluations
must use longer material, fixed backing, and one direct listening instruction.
Give model writers a literal patch example before the first call. A prose-only
schema description caused a full correction turn in the focused rerun.
