/** Representative requests that fix the Phase 2 musical contract before algorithms. */
import { createHash } from 'node:crypto';

import {
  describeMusicalPatch, encodeMusicalPatch, encodeMusicalReport, parseMusicalPatch,
  type MusicalPatch, type MusicalToolBoundary,
} from './patch.js';

export type MusicalCorpusCase = {
  readonly id: string;
  readonly request: string;
  readonly tool: MusicalToolBoundary;
  readonly outcome:
    | { readonly kind: 'patch'; readonly patch: MusicalPatch }
    | { readonly kind: 'refusal'; readonly reason: string };
};

const accepted = (
  id: string,
  request: string,
  tool: MusicalToolBoundary,
  input: unknown,
): MusicalCorpusCase => ({ id, request, tool, outcome: { kind: 'patch', patch: parseMusicalPatch(input) } });

const refused = (
  id: string,
  request: string,
  tool: MusicalToolBoundary,
  reason: string,
): MusicalCorpusCase => ({ id, request, tool, outcome: { kind: 'refusal', reason } });

export const MUSICAL_REQUEST_CORPUS: readonly MusicalCorpusCase[] = [
  accepted(
    'generation-progression',
    'Add a four-chord progression in C minor to this clip.',
    'generation',
    {
      schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
      targets: [{
        clip: { trackId: 'track-main', row: 1 }, channel: 0, write: 'merge',
        operations: [{
          op: 'generate',
          source: { kind: 'progression', key: 'C minor', degrees: ['i', 'VI', 'III', 'VII'], octave: 3 },
          placement: { kind: 'sequence', startBeats: 0, stepBeats: 1, durationBeats: 1 },
          velocity: 92,
        }],
      }],
    },
  ),
  accepted(
    'replace-mode-arpeggio',
    'Replace channel 2 with two octaves of D Dorian, arpeggiated as eighth notes.',
    'generation',
    {
      schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
      targets: [{
        clip: { trackId: 'track-main', row: 2 }, channel: 2, write: 'replace',
        operations: [
          {
            op: 'generate', source: { kind: 'scale', tonic: 'D', name: 'dorian', octave: 3, octaves: 2 },
            placement: { kind: 'stack', startBeats: 0, durationBeats: 4 }, velocity: 88,
          },
          { op: 'arpeggiate', pattern: 'up', stepBeats: 0.5, durationBeats: 0.45 },
        ],
      }],
    },
  ),
  accepted(
    'transform-detected-harmony',
    'Move the existing phrase up a perfect fifth, detect its chord, and add close harmony.',
    'transformation',
    {
      schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
      targets: [{
        clip: { trackId: 'track-main', row: 3 }, channel: 0, write: 'replace',
        operations: [
          { op: 'transpose', semitones: 7 },
          { op: 'harmonize', harmony: { kind: 'detect', as: 'chord' } },
          { op: 'revoice', minPitch: 48, maxPitch: 84, strategy: 'closest' },
        ],
      }],
    },
  ),
  accepted(
    'literal-expression-merge',
    'Merge these expressive notes without changing the notes already here.',
    'generation',
    {
      schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
      targets: [{
        clip: { trackId: 'track-expression', row: 0 }, channel: 4, write: 'merge',
        operations: [{
          op: 'generate', source: { kind: 'notes', notes: [
            {
              startBeats: 0, pitch: 60, velocity: 96, durationBeats: 0.5,
              gain: 0.7, pan: -0.2, timbre: 0.4, releaseVelocity: 0.5,
              chance: 0.9, isChanceEnabled: true,
            },
            {
              startBeats: 0.5, pitch: 64, velocity: 91, durationBeats: 0.5,
              velocitySpread: 0.1, transpose: 0, isMuted: false,
              isRepeatEnabled: true, repeatCount: 2,
            },
          ] },
        }],
      }],
    },
  ),
  accepted(
    'several-clips-theory-forms',
    'Put an F minor chord in one clip and a major-third interval pattern in the next clip.',
    'generation',
    {
      schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
      targets: [
        {
          clip: { trackId: 'track-layer', row: 4 }, channel: 0, write: 'replace',
          operations: [{
            op: 'generate', source: { kind: 'chord', symbol: 'Fm', octave: 3 },
            placement: { kind: 'stack', startBeats: 0, durationBeats: 4 }, velocity: 84,
          }],
        },
        {
          clip: { trackId: 'track-layer', row: 5 }, channel: 0, write: 'replace',
          operations: [{
            op: 'generate', source: { kind: 'intervals', root: 'F3', intervals: ['1P', '3M', '5P'] },
            placement: { kind: 'sequence', startBeats: 0, stepBeats: 1, durationBeats: 0.75 },
            velocity: 84,
          }],
        },
      ],
    },
  ),
  accepted(
    'several-midi-channels',
    'Replace channels 1 and 9 in this clip with the same whole-tone pitch-class set.',
    'generation',
    {
      schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
      targets: [1, 9].map((channel) => ({
        clip: { trackId: 'track-multichannel', row: 0 }, channel, write: 'replace',
        operations: [{
          op: 'generate',
          source: {
            kind: 'pitch-class-set', pitchClasses: ['C', 'D', 'E', 'F#', 'G#', 'A#'],
            octave: 3, octaves: 1,
          },
          placement: { kind: 'sequence', startBeats: 0, stepBeats: 0.5, durationBeats: 0.5 },
          velocity: 80,
        }],
      })),
    },
  ),
  accepted(
    'triplet-quantize',
    'Quantize the existing phrase halfway toward eighth-note triplets.',
    'transformation',
    {
      schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
      targets: [{
        clip: { trackId: 'track-rhythm', row: 6 }, channel: 0, write: 'replace',
        operations: [{ op: 'quantize', gridBeats: 1 / 3, strength: 0.5 }],
      }],
    },
  ),
  accepted(
    'expression-preserving-humanize',
    'Humanize the selected notes, but preserve their pitch, duration, channel, and expression.',
    'transformation',
    {
      schema: 'ghostnote-musical-patch', version: 1, seed: 'humanize-session-a',
      protection: { kind: 'direct' },
      targets: [{
        clip: { trackId: 'track-expression', row: 2 }, channel: 7, write: 'replace',
        operations: [{
          op: 'humanize', maxTimingBeats: 0.03125, maxVelocity: 4,
          selection: { beatRange: { fromBeats: 0, toBeats: 4 }, pitchRange: { min: 48, max: 84 } },
        }],
      }],
    },
  ),
  accepted(
    'requested-variations',
    'Make four deterministic rhythmic variations of this clip.',
    'transformation',
    {
      schema: 'ghostnote-musical-patch', version: 1, seed: 'four-rhythm-variations',
      protection: { kind: 'clip-block', reason: 'requested-variations', takes: 4 },
      targets: [{
        clip: { trackId: 'track-variation', row: 1 }, channel: 0, write: 'replace',
        operations: [
          { op: 'thin', probability: 0.15 },
          { op: 'densify', gridBeats: 0.25, probability: 0.2 },
          { op: 'humanize', maxTimingBeats: 0.015625, maxVelocity: 3 },
        ],
      }],
    },
  ),
  refused(
    'pressure-refusal',
    'Set polyphonic pressure on every note in this clip.',
    'generation',
    'Pressure is not writable through the host API. Refuse before mutation; do not drop it.',
  ),
  refused(
    'midi-range-refusal',
    'Transpose this top note above MIDI note 127 and keep going.',
    'transformation',
    'The resulting pitch is outside MIDI 0-127. Refuse it; do not clamp, fold, or wrap it.',
  ),
] as const;

/** The complete stable corpus artifact: requests, patches or refusals, and report shapes. */
export function musicalCorpusArtifact(): unknown {
  return MUSICAL_REQUEST_CORPUS.map((entry) => ({
    id: entry.id,
    request: entry.request,
    tool: entry.tool,
    outcome: entry.outcome.kind === 'refusal'
      ? entry.outcome
      : {
          kind: 'patch',
          patch: JSON.parse(encodeMusicalPatch(entry.outcome.patch)) as unknown,
          report: JSON.parse(encodeMusicalReport(describeMusicalPatch(entry.outcome.patch))) as unknown,
        },
  }));
}

export const encodeMusicalCorpus = (): string => JSON.stringify(musicalCorpusArtifact());

export const fingerprintMusicalCorpus = (): string =>
  createHash('sha256').update(encodeMusicalCorpus(), 'utf8').digest('hex');

/** Changing the corpus, patch shape, or report shape requires an explicit contract review. */
export const MUSICAL_CORPUS_V1_SHA256 =
  'a9d4fd5a5074788fba330d8230a7c6bd8b80909d74d40fa649ca581dc7c8e635';
