---
title: E109 — Exact note structure is the semantic boundary
kind: evidence
state: active
updated: 2026-09-13
parent: ../../plan/phase-6/6e-semantic-music-analysis-and-manipulation.md
---

# E109 — Exact note structure is the semantic boundary

## Verdict

Select a private exact-note provider for structural facts and constrained note
transformations. It passed all five controlled checks. Its three results were
identical, and each six-clip run took from 0.25 to 0.34 ms.

This narrow comparison did not test enough chord and voicing operations to
select or reject a general theory library. [E110](e110-wider-symbolic-provider-survey-selects-music21-and-musicpy.md)
supersedes that provider conclusion. It selects Music21 for general analysis
and Musicpy as a voicing specialist candidate. The direct agent passed four of
five checks on each repeat and missed the repeated motif each time. Its
decisions changed between repeats.

Keep all musical labels private and provisional. The exact provider owns note
facts, declared derived metrics, and checked transformations. It does not own
an aesthetic verdict. No public theory tool was added.

## Exact cohort

The five controlled clips and one live clip each covered beats 0 through 4 on
channel 0. Each result included the exact clip hash, note indices, provider,
version, label type or unit, and confidence rule.

| Clip | Purpose | Notes | SHA-256 |
|---|---|---:|---|
| `major-cadence` | C major harmony | 12 | `c633fb51a5f7637dd4d87a70034f72ec88af7cc507ac5dc90bb365b139d3e0f3` |
| `minor-cadence` | A minor harmony | 12 | `ed5fdd0050786cca3b74988ae55df4907c07ad590cc4ee2721228feeee764703` |
| `syncopated-line` | Syncopation | 6 | `94ff3bac4394832141f795bca3745dfc77bbd5a91d2f15ec149a1f7cc42ec1a9` |
| `register-motif` | Register and repeated motif | 8 | `7489d6ea3d64f95f7ca535a5445b7f9dc301383599113c2ba8c31b9f24a60620` |
| `ambiguous-pentatonic` | C major or A minor ambiguity | 8 | `4e68864f201eeaaa69901c2e548a76b4e2a38c4b4d67f512844e684863816ebc` |
| `bounded-live-progression` | Live structural and transform loop | 17 | `880a0a2e9cb02a92a535c621914790ac97a8f476e9af40beddf0f6a4b65011b0` |

The live source was launcher row 0 on the owned
`gn-6e-semantic-live` track in disposable project `New 1`. Its track ID was
`be57dd9e-d8ce-47a0-a4da-42d4644ebdf6`.

## Typed result boundary

The retained probe uses `ghostnote-semantic-analysis-v0`.

| Result | Authority | Unit or type | Confidence rule |
|---|---|---|---|
| Pitch classes and onsets | Exact note fact | MIDI and beats | Exact over declared coverage |
| Register range | Exact derived metric | MIDI and semitones | Exact over declared coverage |
| Voice-leading movement | Deterministic derived metric | Semitones | Rank-paired voices; no claimed identity |
| Repeated motif | Deterministic derived metric | Beats and relative semitones | Two disjoint equal sequences of at least three notes |
| Syncopation | Inferred rule label | Weak-subdivision onset ratio | `syncopated` at 0.4 or more |
| Harmony | Inferred rule label | Closed key label | Select only at a fixed-score margin of 0.08 or more |
| Tension | Inferred proxy | Dissonant interval-class ratio | Structural proxy only; not aesthetic tension |
| Operator verdict | Operator judgment | Free text or null | Always null in this experiment |

Exact facts and inferred labels use separate objects. Each provider result sets
`operator_judgment` to null. No label replaces exact note data.

## Controlled results

| Provider | Major | Minor | Syncopation | Motif | Ambiguity | Agreement |
|---|---:|---:|---:|---:|---:|---|
| Exact-note probe | Pass | Pass | Pass | Pass | Pass, withheld | Identical, 3 of 3 |
| Music21 | Pass | Pass | Unsupported | Unsupported | Fail, selected C major | Identical, 3 of 3 |
| Tonal | Candidate only | Candidate only | Unsupported | Unsupported | Candidate only | Identical, 3 of 3 |
| Direct agent | Pass | Pass | Pass | Fail | Pass | Different hashes, 0 of 3 identical |

The exact provider gave the ambiguous clip a top score margin of `0.01875` and
returned no key label. Music21 returned C major with correlation `0.872446`.
Tonal returned C-major scale candidates but did not select one. The direct agent
returned the closed ambiguity label on all three repeats.

The direct agent changed voice-leading, register, rhythm, motif, and tension
labels between repeats. One saved response returned `none` for a tension field
that allowed only `low`, `moderate`, `high`, or `ambiguous`. The retained
adapter validates the closed schema and records such errors.

## Performance and provider limits

| Provider | Version | Three six-clip runs | Peak local memory | Installed size | Boundary |
|---|---|---|---:|---:|---|
| Exact-note probe | `0.1-probe` | 0.33, 0.25, 0.29 ms | 28.0 MiB | Repository code only | Python standard library |
| Music21 | 10.5.0 | 71.75, 48.33, 48.17 ms | 83.8 MiB | 245.7 MiB | 271.08 ms import; Python dependency |
| Tonal | 4.10.0 | 64.92, 53.10, 52.47 ms | 27.9 MiB parent, 92.3 MiB child | 2.4 MiB | New Node process in each measured run |
| Direct agent | `gpt-5.4-mini-2026-03-17` | 6,086.60, 6,457.49, 5,869.16 ms | Not measured | Remote service | Network, credential, cost, and privacy boundary |

Music21 code uses the BSD license. Its included corpus can have separate use
limits. The measured release supports current Python versions on common desktop
platforms. Tonal uses the MIT license and runs in JavaScript environments.
The direct provider is an external proprietary service.

The direct run used 9,171 input tokens and 3,932 output tokens. Of the input,
6,912 tokens were cached. At the documented rates on the run date, the estimated
cost was `$0.01991`. This is an estimate, not a billing record. The synthetic
note cohort and the owned live fixture were in the request. No user project data
was present.

Primary provider sources:

- <https://github.com/cuthbertLab/music21/releases>
- <https://music21.org/music21docs/about/about.html>
- <https://music21.org/music21docs/usersGuide/usersGuide_09_chordify.html>
- <https://github.com/tonaljs/tonal>
- <https://developers.openai.com/api/docs/models/gpt-5.4-mini>

## Constrained live transformation

The exact provider normalized every pitch into MIDI 48 through 72 by octave.
It minimized total octave displacement at each onset and used the lower pitch
tuple to break ties. It refuses an invalid range, a missing in-range pitch
class, or a duplicate pitch at one onset.

The public clip surface erased and rewrote the owned 17-note clip. Exact
readback took 8,517 ms. The pitch range changed from MIDI 36–65 to MIDI 48–67.
The note count, pitch classes at each onset, and every non-pitch field stayed
equal. The transformed clip hash was
`1e4b347535980a872be3623554f93a04d28b02d883e1ca3deedd674d2fad5e55`.

The first live read expanded omitted note defaults. The cleanup guard correctly
refused because the full readback hash differed from the requested core notes.
The recovery path then adopted the complete host-normalized readback. This
confirmed that a semantic transform must use complete live state, as E100
requires.

## Selected boundary

Retain the exact-note probe as a private candidate for Phase 6f. It has three
replaceable parts:

1. An exact structural analyzer for note facts and declared metrics.
2. Provisional rule adapters for harmony, rhythm, motif, register,
   voice-leading, and non-aesthetic tension.
3. A constrained transform planner that emits exact before-and-after state and
   invariants before the Bitwig adapter writes anything.

E110 corrects the library boundary. Use the exact-note layer as a contract and
verification wrapper around replaceable theory providers. Do not use its small
rules as a replacement for a mature theory engine. Keep the direct agent outside
the provider boundary. It can reason from typed results, but it must not replace
them.

## Cleanup

The owned live track and clip were permanently deleted after exact readback.
The project returned to its exact four-track baseline: `Inst 1`, `Audio 2`,
`FX 1`, and `Master`. The generated results and isolated Music21 and Tonal
environments were removed after this evidence was recorded.

## Retrospective

The C-major-or-A-minor pentatonic control best exposed false precision.
Music21 selected C major, while the exact margin rule withheld the label. Keep
this control in future harmony-provider tests.
