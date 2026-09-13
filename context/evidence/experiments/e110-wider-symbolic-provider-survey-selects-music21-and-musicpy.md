---
title: E110 — Wider symbolic provider survey selects Music21 and Musicpy
kind: evidence
state: active
updated: 2026-09-13
parent: ../../plan/phase-6/6e-semantic-music-analysis-and-manipulation.md
---

# E110 — Wider symbolic provider survey selects Music21 and Musicpy

## Verdict

Use Music21 as the primary private semantic-analysis provider. Use Musicpy as a
replaceable voicing specialist candidate. Keep the exact-note layer from E109
as the input contract, constraint checker, and exact readback verifier. Do not
reimplement broad music theory in that layer.

Music21 recognized the root, inversion, and chord family in all eight controls.
The ordered MIDI input supplied the exact bass. Music21 also passed both basic
voicing operations and identified the two
clear keys. It still selected a key for the ambiguous control, so the adapter
must expose alternatives and withhold a result below a tested score margin.

Musicpy recognized the root, inversion, and chord family in all eight controls.
It passed first-inversion, drop-2,
degree-order, and nearest-progression voicing transforms exactly. Its key API
returned useful candidate lists but no calibrated confidence. Keep it behind a
small adapter and an exact invariant check. Its LGPL license, alpha classifier,
and single-maintainer boundary need review before product distribution.

Tonal 6.4.3 remains the TypeScript-only fallback for chord candidates and
theory primitives. It found the expected chord in all eight controls, but put
the correct C-over-E interpretation second. It does not provide the required
global key selection or octave-aware voicing operations.

## Survey scope

The survey screened 12 off-the-shelf projects across Python, TypeScript, Rust,
and Java. Five candidates ran against the controlled cohort. Three additional
candidates reached an install or dependency check. Four were removed from the
executable shortlist from their documented scope.

| Candidate | Language | Useful scope | Result |
|---|---|---|---|
| Music21 10.5.0 | Python | Chords, keys, Roman numerals, score analysis, basic voicing | Select for private analysis prototype |
| Musicpy 7.15 | Python | Chord detection, inversions, drop voicings, nearest voicings, MIDI | Select as voicing specialist candidate |
| Partitura 1.9.0 | Python | Exact symbolic data, key estimation, voice separation, tonal tension | Retain as a future voice-analysis candidate |
| Tonal 6.4.3 | TypeScript | Chord candidates, keys as definitions, intervals, transposition | Retain as the TypeScript-only fallback |
| Mingus 0.6.1 | Python | Chord candidates and theory primitives | Reject; old GPL release and missing octave voicing |
| Kord 0.8.1 | Rust and WASM | Chord guesser and theory primitives | Blocked on stable Rust |
| MusicLang 0.26.0 | Python | Tonal representation, chord analysis, counterpoint transforms | Blocked by old pinned dependencies |
| Musicaiz 0.1.2 | Python | Chord and key prediction, harmonic transposition | Reject; install blocker and AGPL boundary |
| MusPy | Python | Symbolic data, generation metrics, MIDI interchange | Reject for this task; no chord or voicing engine |
| jSymbolic 2.3 | Java | Large symbolic feature set | Reject for this task; feature extraction, not editing |
| musif | Python | Score and corpus feature extraction | Reject for this task; feature extraction, not editing |
| rust-music-theory 0.5 | Rust | Chord and scale construction | Reject for this task; no chord-from-notes or inversion API |

The direct agent and the custom exact-note probe are comparison controls. They
are not off-the-shelf theory providers and are not part of the count of 12.

## Controlled cohort

The chord cohort SHA-256 was
`1bf287418b98cf7b8d06da0bea1595491da9f121bb196cbbcefcaae474aaf64b`.
Each chord result used the exact ordered MIDI pitches shown here.

| Control | MIDI pitches | Required semantic core |
|---|---|---|
| C major | 48, 52, 55 | C major, root position |
| C/E | 52, 55, 60 | C major, E bass, first inversion |
| A minor | 45, 48, 52 | A minor, root position |
| G7/B | 47, 50, 53, 55 | G dominant seventh, B bass |
| Cmaj7 | 48, 52, 55, 59 | C major seventh |
| F-sharp diminished seventh | 54, 57, 60, 63 | F-sharp diminished seventh |
| Dsus4 | 50, 55, 57 | D suspended fourth |
| Cadd9 | 48, 50, 52, 55 | C major with added second or ninth |

The key cohort SHA-256 was
`a83cc7d7f93229cc6aee87fb1279d13b90a2ba0599b2299efdc8444b17654513`.
It contained the clear C-major and A-minor progressions from E109 and its
ambiguous pentatonic control.

## Executable results

Every executed provider returned the same serialized result on three repeats.
The timed operation covered all tasks supported by that provider.

| Provider | Chord result | Key result | Voicing result | Warm task latency | Import or process cost |
|---|---|---|---|---:|---:|
| Music21 10.5.0 | 8/8 semantic cores | 2/3; false C major on ambiguity | 2/2 | 19.77–29.41 ms | 274.16 ms import |
| Musicpy 7.15 | 8/8 semantic cores | Expected key in 3/3 candidate lists; no selection | 4/4 | 15.75–16.96 ms | 97.28 ms import |
| Partitura 1.9.0 | Unsupported | 2/3; false G major on ambiguity | Voice assignment only | 1.08–1.84 ms | 968.20 ms import |
| Mingus 0.6.1 | 7/8 candidate sets | Unsupported | Pitch-class reorder only | 0.08–0.13 ms | 0.47 ms import |
| Tonal 6.4.3 | 8/8 candidate sets; 7/8 first | Unsupported | Unsupported | 54.59–67.61 ms | Node startup included |

Music21 used 84.3 MiB peak resident memory. Musicpy used 40.6 MiB. Partitura
used 179.5 MiB. Mingus used 24.6 MiB. The Tonal controller used 23.2 MiB, and
its Node child used 91.1 MiB. The measurements include the probe process.

The measured core package sizes were 113.1 MiB for Music21, 1.4 MiB for
Musicpy, 3.2 MiB for Partitura, 0.9 MiB for Mingus, and 0.6 MiB for Tonal.
These values exclude shared dependencies. The combined Python test environment
was 429.3 MiB. This is not the size of a selected production worker.

## Voicing proof

Musicpy produced these exact C-major-seventh and G-dominant outputs:

| Operation | Result MIDI pitches |
|---|---|
| First inversion | 64, 67, 71, 72 |
| Drop-2 | 55, 60, 64, 71 |
| Degree order 1, 5, 3, 7 | 60, 67, 76, 83 |
| G7 nearest to Cmaj7 | 62, 65, 67, 71 |

Music21 produced exact closed-position and first-inversion outputs. It did not
provide a direct drop-voicing or nearest-progression operation. Musicpy covers
the requested “shift a chord to a different voicing” use case with less custom
logic.

This benchmark did not write to Bitwig. E109 already proves that the wrapper can
apply a planned octave transform, read the complete result, verify invariants,
and restore the owned fixture.

## Install and maintenance boundaries

- Music21 10.5.0 and Musicpy 7.15 installed and ran on Python 3.14. Music21 is
  BSD-3-Clause. Musicpy is LGPL-2.1-or-later and has a PyPI alpha classifier.
- Partitura 1.9.0 installed and ran on Python 3.14. It is Apache-2.0 and has an
  active release line.
- Tonal 6.4.3 installed without an audit finding. It is MIT and supports Node
  and browsers. E109 tested the obsolete `@tonaljs/tonal` 4.10.0 package. The
  wider survey corrected the package route.
- Kord 0.8.1 is MIT and current. Its minimal CLI build failed on stable Rust
  because it enables three nightly language features. Its locked graph also
  warned about a yanked `spin` 0.10.0 package. No binary was installed.
- MusicLang 0.26.0 is BSD-licensed, but its resolver pins Music21 8.1.0, Mido
  1.2.10, and pandas 1.5.3. The pandas build failed on Python 3.14.
- Musicaiz 0.1.2 pins Torch 1.11.0, which has no compatible Python 3.14 build.
  Its runtime graph also includes test, type-check, plotting, and web UI tools.
  It uses AGPL-3.0.
- Mingus 0.6.1 ran on Python 3.14, but its last PyPI release was in 2020. It
  uses GPL-3.0.

Primary sources:

- <https://github.com/cuthbertLab/music21/releases>
- <https://github.com/cuthbertLab/music21/blob/master/music21/harmony.py>
- <https://pypi.org/project/musicpy/>
- <https://github.com/Rainbow-Dreamer/musicpy/wiki/Basic-syntax-of-chord-type>
- <https://pypi.org/project/partitura/>
- <https://partitura.readthedocs.io/en/v1.2.0/modules/partitura.html>
- <https://www.npmjs.com/package/tonal>
- <https://github.com/twitchax/kord>
- <https://pypi.org/project/musiclang/>
- <https://github.com/carlosholivan/musicaiz>
- <https://muspy.readthedocs.io/en/latest/>
- <https://github.com/DDMAL/jSymbolic2>
- <https://github.com/DIDONEproject/musif>
- <https://github.com/ozankasikci/rust-music-theory>
- <https://pypi.org/project/mingus/>

## Selected boundary

Use three explicit layers:

1. The exact-note wrapper owns source identity, note coverage, complete input,
   constraints, invariants, and exact before-and-after readback.
2. Music21 owns broad semantic analysis behind a versioned provider adapter.
   Its key result must include alternatives and a tested ambiguity rule.
3. Musicpy can own named voicing plans behind a separate adapter. The wrapper
   must verify pitch classes, note ownership, ranges, and collision rules before
   and after every write.

Keep Tonal as a small TypeScript fallback when chord candidates are sufficient.
Do not add any provider to the public tool surface until Phase 7 proves real
tasks and failure handling. Do not add these packages to the product dependency
graph in this survey.

## Cleanup

The survey used no live project and created no remote artifact. Its isolated
Python, Node, and failed Rust install directories and generated JSON were
removed after the evidence was recorded.

## Retrospective

The first survey treated one ambiguous key result as a reason to reject a broad
library. A task-specific matrix exposed that error. Future provider surveys must
test required operations before they make a general provider verdict.
