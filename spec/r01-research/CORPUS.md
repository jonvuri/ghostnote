# R01 Ghostworks development corpus

The Ghostworks shards are a useful source of irregular performed-note examples.
This round reads four existing MIDI assets and retains 128 exact notes from
three works. It uses `get_status` and `list_shard_assets` for read-only discovery,
then reads the selected files locally. It does not prepare project sources,
run inference, change the library, read audio, or contact a DAW.

## Inventory and development selection

The 2026-10-25 inventory contains 383 assets, including 303 MIDI files across
14 work/shard titles. An additional shard contains only audio. Metadata labels
242 MIDI files as mapped timing and 57 as baked timing; four have legacy or
unresolved timing metadata. One legacy file has `tempoIsPlaceholder`; the 57
baked files have implicit tempo. Available PPQ values are 512, 1000, and 9600.
Every MIDI record reports velocity 64; 187 explicitly flag placeholder velocity.
These are metadata counts, not a file-by-file transcription-quality audit.

The [manifest](../../context/evidence/data/r01-candidates/corpus-manifest.json)
pins the inventory identities, source hashes, source relationships, selected
paths, full source tempo/meter maps, timing resolutions, model/run identifiers,
and extraction rule. The [excerpts](../../context/evidence/data/r01-candidates/corpus-excerpts.json)
retain exact note data and source event coordinates. No media copies are added.

| Development excerpt | Notes | Timing and meter | Coverage |
|---|---:|---|---|
| Engram drums | 17 | Mapped, variable tempo; 5/4 to 4/4 inside excerpt | Four pitches, irregular performed spacing, MIDI channel 10 |
| Engram bass | 7 | Mapped, variable tempo; 4/4 | Five pitches, sparse and uneven note lengths |
| Via Purifico piano | 94 | Mapped constant tempo; 4/4 | 26 pitches, dense polyphony, two full tails beyond window |
| Air Loom guitar | 10 | Baked at implicit 120 BPM; musical pulse/meter unresolved | Seven pitches, irregular timing, one full tail beyond window |

The instrument names are transcription metadata. They do not verify instrument
identity, intentional syncopation, harmonic meaning, or playing technique.
Engram and Via Purifico were already used in Ghostnote development. Air Loom
adds an explicit unresolved-clock case. The first onset window is used for each
selected asset; no passage search was optimized against candidate outcomes.

There are 121 off-grid onsets and 128 off-grid durations at the 1/512-quarter
boundary, before the declared realization step. These excerpts have no duplicate
normalized pitch/channel/onset addresses and no minimum-duration promotions.
Those absences are observations, not dataset guarantees. Synthetic cases must
cover collisions, exact tuplets, short notes, strums with known authored order,
humanized dynamics, expression, and explicit intent. The fixed source velocity
cannot establish whether a representation preserves the original performance's
dynamics.

## Extraction and timing contract

Each selection includes every note whose onset lies in the half-open interval
from that asset's first note onset through 16 encoded quarter beats later. The
origin is shifted by the explicitly recorded integer `startTick`. At PPQ 9600,
`at = (sourceStartTick - startTick) / 9600` and
`duration = (sourceEndTick - sourceStartTick) / 9600`, reduced as exact rational
strings. Pitch, channel, velocity, multiplicity, and full duration are retained.
Notes beginning at the right boundary are excluded; selected notes may extend
beyond it. First-onset selection has no earlier carry-in note. No note is
silently shortened, normalized, repaired, deduplicated, or fitted to a chord.
Source note-off status/velocity stay in `sourceEventDetails`, separate from
the comparison's note fields and Ghostnote expression defaults.

The shared pure [SMF parser](../../brain/src/midi/smf.ts) supplies bounded framing.
The research extractor pairs repeated same-key note-ons FIFO and reports their
count, refusing unpaired events, zero-duration notes, unclosed notes, conflicting
maps, changed hashes, metadata discrepancies, or excerpts exceeding 128 notes.
All four selected files pass hash, PPQ, count, end tick, tempo-map, meter-map, and
implicit-tempo checks against the pinned metadata. A normalization collision
would remain in the representation fixture and explicitly refuse host admission.
It would not be repaired by dropping a note.

The scalar `meter` is a display context for candidate surfaces. Actual source
meter and tempo changes are retained separately, shifted to excerpt coordinates
with their original source ticks. The excerpt origin is generally not a source
bar boundary. Engram drums therefore must not be scored as a complete constant
5/4 musical-clock round trip merely because its initial scalar meter is 5/4.
Air Loom uses an explicitly synthetic 4/4 display coordinate. Its quarter beats
encode seconds at default 120 BPM and do not claim a recovered musical pulse.
Changing playback tempo scales those seconds. Mapped exports depend on their
tempo maps to preserve elapsed timing; a note-only codec trial does not prove
preservation of those maps or audio-relative timing.

Timing provenance includes `timeOrigin`, source seconds at MIDI tick zero,
requested/resolved timing and alignment, and fallback reasons. Negative source
seconds at tick zero in mapped Engram are retained as provenance. Excerpt note
times themselves begin at zero. Earlier export clipping/dropping, where reported,
is retained in the manifest; these fixtures reproduce the selected MIDI bytes,
not the original acoustic performance. Transcription errors and unknown intent
remain valid irregular-note inputs, without becoming musical ground truth.

## Reserved works and contamination boundary

All sibling assets of each development work remain in development. The other
11 MIDI work families are reserved for a future holdout: Feeding Time, Good Lies,
Katadoru Sunaba, Losing You, Namisora, Open Spaces, Our Taproot, Re:turning,
Steady Hands, The Gapra Whitewood, and Trailing. The audio-only Psychomania Splices
shard is also reserved but supplies no current MIDI holdout. No reserved MIDI
file was opened or parsed in this round. Discovery metadata, including whole-file
counts and timing metadata, was inspected; this is a reservation for this round,
not a claim that those works were never seen in earlier projects or model training.

The split validator checks shared signal IDs, source asset IDs, and content
hashes across groups, in addition to keeping each shard intact. No cross-split
lineage overlap was found in the retained metadata. Stem variants, medium/large
transcriptions, mapped/baked exports, registrations, and excerpts from one
lineage are not independent works. New registrations require another lineage
audit; unknown or missing provenance cannot establish independence. Do not
inspect heldout note passages to choose examples or tune candidates before the
trial protocol and selection rule are frozen.

Under the pilot's [development stage](PILOT-DRAFT.md#trial-stages), the seeded
selection opened works A–C, Re:turning, Our Taproot and Good Lies, one MIDI
file each; input v2 scanned all seven of their pitched pool files
([E367](../../context/evidence/experiments/e367-r01-pilot-inputs-v2-dense-windows-velocities.md)). These works are now development material. The rigorous stage opened works
4–6 (*trailing*, *the gapra whitewood*, *open spaces*;
[E378](../../context/evidence/experiments/e378-r01-rigorous-inputs-and-execution-manifest.md)).
Works 7–11 remain unopened in their seeded order
([E366](../../context/evidence/experiments/e366-r01-pilot-development-inputs.md)).

## Reproduction

Run from `brain/`; the library root comes from read-only Ghostworks `get_status`:

```sh
node --import tsx --test benchmarks/r01-candidates/corpus.test.mjs
node --import tsx benchmarks/r01-candidates/corpus.mjs --check '/Users/jonvuri/Dropbox/ghostworks'
```

The tests run from retained artifacts without library access. `--check` reads
only the four pinned development MIDI files and compares exact regenerated
output. `--write` regenerates only the repository excerpt artifact after the
same source and split checks; it never writes to the library. A changed source
hash is a refusal requiring deliberate manifest review. The four hash-verified
sources regenerated identically; all five corpus tests passed. Candidate token
counts should include task-relevant timing context explicitly and exclude the
research provenance envelope unless the task actually requires it.
