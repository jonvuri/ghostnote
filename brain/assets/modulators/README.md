# Curated modulator donors

`manifest.json` is the single catalog source. Run `npm run build:donors` to
validate it and regenerate each `.bwmodobj`. Each object is the exact `0x06c9`
bytes lifted from the human-saved fixture named in its source. Bounds snap to
the list sentinel (E11h).

A donor is transplanted. It is never synthesized (BWMOD_DESIGN decision 3).
`route` records the donor's internal source route. Public results do not expose
it.

`footprint` is the donor subtree object count. A sampled preset needs it to
relocate count-list reference stubs (Tier 2, E12). The value cannot be computed
from the bytes. `footprintSource` records its measurement. A null value limits
the donor to Tier 1.

The manifest records the complete 43-type factory
inventory for Bitwig Studio 6.0.6. It maps public
types to owned donors. It records one proved refusal for each excluded host type.
Runtime catalogs and write-tool vocabularies read the same manifest.

| public type | name | operations | sampled preset | witness |
|---|---|---|---|---|
| `4-stage` | 4-Stage | add, replace | tier-1-only | note-driven |
| `adsr` | ADSR | add, replace | tier-1-only | note-driven |
| `ahd-on-release` | AHD on Release | add, replace | tier-1-only | note-driven |
| `ahdsr` | AHDSR | add, replace | tier-1-only | note-driven |
| `audio-rate` | Audio Rate | add, replace | tier-1-only | structural |
| `audio-sidechain` | Audio Sidechain | add, replace | tier-1-only | structural |
| `beat-lfo` | Beat LFO | add, replace | tier-1-only | free-running |
| `button` | Button | add, replace | tier-1-only | structural |
| `buttons` | Buttons | add, replace | tier-1-only | structural |
| `channel-16` | Channel-16 | add, replace | tier-1-only | note-driven |
| `classic-lfo` | Classic LFO | add, replace | supported | structural |
| `curves` | Curves | add, replace | tier-1-only | free-running |
| `envelope-follower` | Envelope Follower | add, replace | tier-1-only | structural |
| `expressions` | Expressions | add, replace | tier-1-only | note-driven |
| `globals` | Globals | add, replace | tier-1-only | structural |
| `hw-cv-in` | HW CV In | add, replace | tier-1-only | structural |
| `keytrack-plus` | Keytrack+ | add, replace | tier-1-only | note-driven |
| `lfo` | LFO | add, replace | supported | free-running |
| `macro-4` | Macro-4 | add, replace | tier-1-only | structural |
| `macro` | Macro | add, replace | tier-1-only | structural |
| `math` | Math | add, replace | tier-1-only | structural |
| `midi` | MIDI | add, replace | tier-1-only | note-driven |
| `mix` | Mix | add, replace | tier-1-only | structural |
| `note-counter` | Note Counter | add, replace | tier-1-only | note-driven |
| `note-sidechain` | Note Sidechain | add, replace | tier-1-only | note-driven |
| `parseq-8` | ParSeq-8 | add, replace | tier-1-only | note-driven |
| `pitch-12` | Pitch-12 | add, replace | tier-1-only | note-driven |
| `polynom` | Polynom | add, replace | tier-1-only | structural |
| `quantize` | Quantize | add, replace | tier-1-only | structural |
| `ramp` | Ramp | add, replace | tier-1-only | note-driven |
| `random` | Random | add, replace | supported | note-driven |
| `relative-keytrack` | Relative Keytrack | add, replace | tier-1-only | note-driven |
| `sample-and-hold` | Sample and Hold | add, replace | tier-1-only | structural |
| `segments` | Segments | add, replace | tier-1-only | note-driven |
| `select-4` | Select-4 | add, replace | tier-1-only | structural |
| `stack-spread` | Stack Spread | add, replace | tier-1-only | note-driven |
| `steps` | Steps | add, replace | tier-1-only | note-driven |
| `vector-4` | Vector-4 | add, replace | tier-1-only | structural |
| `vector-8` | Vector-8 | add, replace | tier-1-only | structural |
| `vibrato` | Vibrato | add, replace | supported | note-driven |
| `voice-control` | Voice Control | add, replace | tier-1-only | note-driven |
| `xy` | XY | add, replace | tier-1-only | structural |

| id | device | footprint | source |
|---|---|---|---|
| `lfo-sampler` | LFO | 0x10 | `Sampler/gn_sampler_one_lfo.bwpreset#0` |
| `random-sampler` | Random | 0xd | `Sampler/gn_sampler_one_random.bwpreset#0` |
| `random-poly` | Random | 0xb | `Polysynth/mp_one_random.bwpreset#0` |
| `lfo-poly` | LFO | — | `Polysynth/mp_one_lfo.bwpreset#0` |
| `classiclfo-poly` | Classic LFO | 0xc | `Polysynth/modzoo.bwpreset#0` |
| `vibrato-poly` | Vibrato | 0xf | `Polysynth/modtest.bwpreset#0` |
| `expressions-poly` | Expressions | — | `Polysynth/modtest.bwpreset#1` |
| `4-stage-zoo` | 4-Stage | — | `Polysynth/gn-preset-zoo.bwpreset#0` |
| `adsr-zoo` | ADSR | — | `Polysynth/gn-preset-zoo.bwpreset#1` |
| `ahd-on-release-zoo` | AHD on Release | — | `Polysynth/gn-preset-zoo.bwpreset#2` |
| `ahdsr-zoo` | AHDSR | — | `Polysynth/gn-preset-zoo.bwpreset#3` |
| `audio-rate-zoo` | Audio Rate | — | `Polysynth/gn-preset-zoo.bwpreset#4` |
| `audio-sidechain-zoo` | Audio Sidechain | — | `Polysynth/gn-preset-zoo.bwpreset#5` |
| `beat-lfo-zoo` | Beat LFO | — | `Polysynth/gn-preset-zoo.bwpreset#6` |
| `button-zoo` | Button | — | `Polysynth/gn-preset-zoo.bwpreset#7` |
| `buttons-zoo` | Buttons | — | `Polysynth/gn-preset-zoo.bwpreset#8` |
| `channel-16-zoo` | Channel-16 | — | `Polysynth/gn-preset-zoo.bwpreset#9` |
| `classic-lfo-zoo` | Classic LFO | 0xe | `Polysynth/gn-preset-zoo.bwpreset#10` |
| `curves-zoo` | Curves | — | `Polysynth/gn-preset-zoo.bwpreset#11` |
| `envelope-follower-zoo` | Envelope Follower | — | `Polysynth/gn-preset-zoo.bwpreset#12` |
| `expressions-zoo` | Expressions | — | `Polysynth/gn-preset-zoo.bwpreset#13` |
| `globals-zoo` | Globals | — | `Polysynth/gn-preset-zoo.bwpreset#14` |
| `hw-cv-in-zoo` | HW CV In | — | `Polysynth/gn-preset-zoo.bwpreset#15` |
| `keytrack-plus-zoo` | Keytrack+ | — | `Polysynth/gn-preset-zoo.bwpreset#16` |
| `macro-4-zoo` | Macro-4 | — | `Polysynth/gn-preset-zoo.bwpreset#18` |
| `macro-zoo` | Macro | — | `Polysynth/gn-preset-zoo.bwpreset#19` |
| `math-zoo` | Math | — | `Polysynth/gn-preset-zoo.bwpreset#20` |
| `midi-zoo` | MIDI | — | `Polysynth/gn-preset-zoo.bwpreset#21` |
| `mix-zoo` | Mix | — | `Polysynth/gn-preset-zoo.bwpreset#22` |
| `note-counter-zoo` | Note Counter | — | `Polysynth/gn-preset-zoo.bwpreset#23` |
| `note-sidechain-zoo` | Note Sidechain | — | `Polysynth/gn-preset-zoo.bwpreset#24` |
| `parseq-8-zoo` | ParSeq-8 | — | `Polysynth/gn-preset-zoo.bwpreset#25` |
| `pitch-12-zoo` | Pitch-12 | — | `Polysynth/gn-preset-zoo.bwpreset#26` |
| `polynom-zoo` | Polynom | — | `Polysynth/gn-preset-zoo.bwpreset#27` |
| `quantize-zoo` | Quantize | — | `Polysynth/gn-preset-zoo.bwpreset#28` |
| `ramp-zoo` | Ramp | — | `Polysynth/gn-preset-zoo.bwpreset#29` |
| `relative-keytrack-zoo` | Relative Keytrack | — | `Polysynth/gn-preset-zoo.bwpreset#31` |
| `sample-and-hold-zoo` | Sample and Hold | — | `Polysynth/gn-preset-zoo.bwpreset#32` |
| `segments-zoo` | Segments | — | `Polysynth/gn-preset-zoo.bwpreset#33` |
| `select-4-zoo` | Select-4 | — | `Polysynth/gn-preset-zoo.bwpreset#34` |
| `stack-spread-zoo` | Stack Spread | — | `Polysynth/gn-preset-zoo.bwpreset#35` |
| `steps-zoo` | Steps | — | `Polysynth/gn-preset-zoo.bwpreset#36` |
| `vector-4-zoo` | Vector-4 | — | `Polysynth/gn-preset-zoo.bwpreset#37` |
| `vector-8-zoo` | Vector-8 | — | `Polysynth/gn-preset-zoo.bwpreset#38` |
| `voice-control-zoo` | Voice Control | — | `Polysynth/gn-preset-zoo.bwpreset#40` |
| `xy-zoo` | XY | — | `Polysynth/gn-preset-zoo.bwpreset#42` |
