---
title: E116 — Fine timing and the two-layer groove contract pass
kind: evidence
state: active
updated: 2026-09-13
parent: ../../plan/phase-6/6f2-groove-intent-and-microtiming-reproducibility.md
---

# E116 — Fine timing and the two-layer groove contract pass

## Verdict

Extend the writable binary grid through `1/512` beat. This equals a
conventional 2048th note. Extend the matched triplet family through `1/768`
beat. This equals `1/3072` of a whole note and is the triplet match for the
binary floor.

Use `ghostnote-groove-context-v0` for groove-sensitive context in 6g. Keep the
E114 compact bar view for ordinary performed events. Add the groove view only
when the task needs nominal time, timing intent, or timing-reference relations.
Keep `ghostnote-groove-patch-v0` behind an exact compiler. The model does not
own live state or direct writes.

The groove context passed 14 of 14 checks on GPT-5.4 Mini and Gemini 3.8 Flash.
The compact performed-event control passed 14 on GPT and 8 on Gemini in the
final run. An earlier identical-prompt GPT run scored 11. The explicit groove
view was stable across both runs and models.

## Live timing gate

The raw probe used one owned 16-beat clip, a 512-step writer, and an independent
2,048-step witness. It tested binary grids at `1/64`, `1/128`, `1/256`, and
`1/512` beat. It tested matched triplet grids at `1/96`, `1/192`, `1/384`, and
`1/768` beat.

Each grid passed isolated and mixed starts, durations, page boundaries, a note
near beat 15, all 16 MIDI channels, same-pitch adjacency, property writes, two
independent reads, and a coarse-grid change and return. The witness saw 25
stable notes in each case. A coarse view saw 24, but the fine view recovered
the same 25-note hash.

Binary starts and durations were exact. At 120 BPM, `1/512` beat is
0.9765625 ms. Triplet starts were exact. Triplet durations used the existing
`2^-20`-beat host rule. Their largest error was
`3.178914388026616e-7` beat, or 0.000158946 ms at 120 BPM. A `1/768`-beat step
is 0.651041667 ms at 120 BPM.

| Grid, beats | Whole-note equivalent | Stable SHA-256 |
|---:|---:|---|
| 1/64 | 1/256 | `1eade26ff6c3a61bb77f038e51f01056ea5a5c9dc1cb61e40d08e02ee1e6a214` |
| 1/128 | 1/512 | `6e394a976198e165b3d3c9088af567e3caa70a0ca06877dd2a1d55a99f908075` |
| 1/256 | 1/1024 | `b852755aae6b1f54100efc84ce65ba192cb004592dc102260c365a42fae9b909` |
| 1/512 | 1/2048 | `0416a4696c80688118b6044cf871bf08e76a39a06efc6a253c23b5f8c4d14680` |
| 1/96 | 1/384 | `d551d6a4d70861e83e1f57e3342ae5b2494644bc130c34ab139c15dedcbebc22` |
| 1/192 | 1/768 | `196b0a5892fe8e7f3519336bbad35760665b66f2315880aff89ec0b297594844` |
| 1/384 | 1/1536 | `735e92586c77ad331ca6a2543b1ab46e3beb8e295f47c9376ce4be28a994ac92` |
| 1/768 | 1/3072 | `a3debf65dad96c41d5ca951f5b9e476b0f25cb520266d3244766822a19e071fc` |

One bounded page scan took 73,494 to 470,067 microseconds in this run. Fine
grids need more pages. A 32-beat exact read now needs 32 binary pages and 48
triplet pages with the fixed cursor windows. Session 6j must include this cost
in the verification audit.

The raw host accepted two overlapping same-pitch notes and exposed three
onsets. The product compiler already shortens such overlaps. It must keep that
policy and refuse any shape that cannot produce one exact identity set.

## Public replay and refusal

The public surface wrote a four-note `Cmaj9#11` chord at `1/512` beat and a
five-note `E7alt` chord at `1/768` beat. Two exact reads preserved starts,
host-normalized durations, pitch, velocity, release velocity, pan, timbre, and
gain. The binary read hash was
`f93d58a98a87d7f466ebeb07ef16179e6d8ce7f68e48ffa60cef6e42a2c12bf6`.
The triplet read hash was
`f996e0656b42d637ab2f288f7762d55ae8174b392330c11186e469de184dc93d`.

A `1/1024`-beat start refused before mutation. The before and after hashes were
both the binary hash. The probe removed both tracks and restored the exact
four-track, stopped project baseline. The raw timing probe also restored its
entry selection, transport state, and four-track baseline.

## Groove contract

The selected context contains these planes:

- exact nominal and realized positions and durations;
- signed template, phase, cross-part, and local deviations;
- tempo-qualified deviation milliseconds and a beat-based tempo map;
- named timing references with subdivision, phase, ratio, or tolerance shape;
- layer, anchor, articulation, confidence, provenance, and coverage;
- exact source and context hashes; and
- generator name, version, seed, and expansion policy.

The generated MIT fixtures contain 27 events and seven references across jazz,
funk, and hip-hop labels. They include straight and swung layers, a two-segment
tempo map, three nonzero cross-part anticipations, a local backbeat delay,
layer phase, unstable hats, a flam, and duration and velocity differences.
Pitched material includes `Cmaj9#11`, `E7alt`, `Fm11`, and `Dbmaj9`.

The source methods were checked against the linked publications. The Groove
MIDI Dataset page states CC BY 4.0 and includes jazz, funk, and hip-hop labels.
It was a cohort design reference only. The executable fixtures do not contain
its notes or audio. The jazz tasks use the timing distinctions from
[Does It Swing?](https://pmc.ncbi.nlm.nih.gov/articles/PMC6934603/) and the
[downbeat-delay study](https://doi.org/10.1038/s42005-022-00995-z). The funk
task uses the measurement categories from
[Microtiming in Early Funk](https://doi.org/10.31751/1224). The hip-hop task
uses relationship and tolerance concepts from
[Something Real](https://hdl.handle.net/1794/23759) and
[Bins, Spans, and Tolerance](https://doi.org/10.1093/mts/mtad005). No source
audio, transcription, or third-party note data was retained.

## Deterministic and model results

Three clean realizations produced the same cohort hash:
`e2cbfd0fd9eb54968001bda22cc692bf9639afdc5a4045e1f05f5445ab25ecc5`.
A different seed produced
`abec9a07aa56e56ef6d7ff6519ee570d34bf9034f50dcc0ca2d048892c067178`.
The bar-view hash was
`dc5c145f0c2e3f7f50c6be3b96af6c8b58df4169b2714dc3d769d1b6c86b74d1`.
The groove-view hash was
`8021ef3aa67191db39a002322be6e175ea87c927eb0cf1d1efb1b69280de9919`.

Each model recovered three nominal, realized, deviation, and reference tuples.
It identified the three simultaneous-reference sets, classified three declared
component groups, abstained on unidentified intent, and returned four exact
patches. The patches quantized only nominal time, scaled one phase, transferred
timing to `Dbmaj9#11`, and continued the hip-hop control. Transfer used four
timing sources and had zero source-pitch overlap. This keeps groove transfer
and copying as separate measurements.

| Model and arm | Score | Input tokens | Output tokens | Latency |
|---|---:|---:|---:|---:|
| GPT-5.4 Mini, compact bar | 14/14 | 1,843 | 1,833 | 10,724 ms |
| GPT-5.4 Mini, groove context | 14/14 | 3,953 | 860 | 4,914 ms |
| Gemini 3.8 Flash, compact bar | 8/14 | 2,157 | 1,188 | 4,036 ms |
| Gemini 3.8 Flash, groove context | 14/14 | 4,548 | 1,356 | 3,426 ms |

The final OpenAI raw run hash was
`38bcc4a2d41a293eb4a5b0f2ce1ddc9bf5dddc266f2cad30d708bc80bb3b82a7`.
The final Gemini raw run hash was
`9bc326633c568f127c38809bfb033d587d9adeecb63893f981aee2d79d24fd6b`.
An earlier identical-prompt run kept the groove arm at 14 for both models. Its
OpenAI compact arm scored 11. Its raw hashes were
`baf791834dc47bd3449aa4e41fcdcdb0a2df21fec32840d295471eb6b1bd7aab`
and `39f5c3c45cd2cc526856d8be646f09eced9be0b3e4c8f4562f7a171b6678b1ac`.

## Operator boundary and cleanup

No blind operator judgment was collected. Preference and cannot-decide rate
are unavailable. This result selects a data and realization contract from
objective recovery, transformation, and reproducibility checks. It makes no
claim that one generated performance feels better. Session 6g must keep
operator judgments separate when it ranks continuation or transfer output.

Temporary model responses and Python bytecode were removed after their hashes
were recorded. No generated MIDI or audio file remains. Both live probes
restored the documented project baseline.

## Retrospective

The timing-reference distinction prevented the largest error. A performed
offset alone could not show whether the cause was template swing, layer phase,
cross-part relation, or a local exception. Exact patch examples also prevented
schema grouping errors from being counted as musical errors.
