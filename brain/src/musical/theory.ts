/** Pure music theory and note generation behind the local Tonal boundary. */
import * as Chord from '@tonaljs/chord';
import * as Interval from '@tonaljs/interval';
import * as Key from '@tonaljs/key';
import * as Mode from '@tonaljs/mode';
import * as Note from '@tonaljs/note';
import * as Pcset from '@tonaljs/pcset';
import * as Progression from '@tonaljs/progression';
import * as RomanNumeral from '@tonaljs/roman-numeral';
import * as Scale from '@tonaljs/scale';

import type { NoteRecord } from '../contract/index.js';
import type {
  MaterializedMusicalTarget, MusicalOperation, MusicalPatch, MusicalTarget,
} from './patch.js';

export type TheoryRefusalCode =
  | 'duplicate-note'
  | 'empty-result'
  | 'invalid-interval'
  | 'invalid-key'
  | 'invalid-note'
  | 'invalid-pitch-class'
  | 'invalid-progression'
  | 'midi-range'
  | 'unknown-chord'
  | 'unknown-mode'
  | 'unknown-scale';

export type TheoryResult<T> =
  | { readonly ok: true; readonly value: T; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly code: TheoryRefusalCode; readonly reason: string };

export interface NoteFact {
  readonly name: string;
  readonly pitchClass: string;
  readonly chroma: number;
  readonly octave?: number;
  readonly midi?: number;
}

export interface IntervalFact {
  readonly name: string;
  readonly semitones: number;
  readonly direction: 1 | -1;
}

export interface ChordFact {
  readonly symbol: string;
  readonly name: string;
  readonly tonic: string;
  readonly bass?: string;
  readonly intervals: readonly string[];
  readonly pitchClasses: readonly string[];
  readonly chroma: string;
}

export interface ScaleFact {
  readonly name: string;
  readonly tonic: string;
  readonly type: string;
  readonly intervals: readonly string[];
  readonly pitchClasses: readonly string[];
  readonly chroma: string;
}

export interface ModeFact {
  readonly name: string;
  readonly intervals: readonly string[];
  readonly chroma: string;
  readonly tonic?: string;
  readonly pitchClasses: readonly string[];
}

export interface KeyFact {
  readonly name: string;
  readonly tonic: string;
  readonly type: 'major' | 'minor';
  readonly keySignature: string;
  readonly pitchClasses: readonly string[];
  readonly triads: readonly string[];
  readonly chords: readonly string[];
}

export interface HarmonyDetection {
  readonly pitchClasses: readonly string[];
  readonly chords: readonly string[];
  readonly scales: readonly string[];
}

export interface PitchClassSetFact {
  readonly pitchClasses: readonly string[];
  readonly chroma: string;
  readonly setNumber: number;
}

export interface ProgressionFact {
  readonly key: KeyFact;
  readonly degrees: readonly string[];
  readonly chordSymbols: readonly string[];
  readonly romanNumerals: readonly string[];
}

export interface MusicalProvenance {
  readonly targetIndex: number;
  readonly variationIndex: number;
  readonly operationIndex: number;
}

/** A generated note carries its channel and the loss-report source coordinates. */
export interface CanonicalMusicalNote extends NoteRecord {
  readonly channel: number;
  readonly provenance: MusicalProvenance;
}

export interface GeneratedMusicalTarget extends MusicalProvenance {
  readonly channel: number;
  readonly write: MusicalTarget['write'];
  readonly notes: readonly CanonicalMusicalNote[];
}

type GenerateOperation = Extract<MusicalOperation, { readonly op: 'generate' }>;

interface PitchMaterial {
  readonly groups: readonly (readonly number[])[];
  readonly warnings: readonly string[];
}

const refuse = <T>(code: TheoryRefusalCode, reason: string): TheoryResult<T> =>
  ({ ok: false, code, reason });

const accept = <T>(value: T, warnings: readonly string[] = []): TheoryResult<T> =>
  ({ ok: true, value, warnings });

function pitchClassFromChroma(chroma: number): string {
  return Note.fromMidi(60 + chroma).replace(/-?\d+$/, '');
}

function canonicalPitchClass(input: string): string | undefined {
  const parsed = Note.get(input);
  if (parsed.empty || parsed.oct !== undefined) return undefined;
  return pitchClassFromChroma(parsed.chroma);
}

function canonicalNoteNames(inputs: readonly string[]): TheoryResult<readonly string[]> {
  if (inputs.length === 0) {
    return refuse('empty-result', 'note detection needs at least one note');
  }
  const chromas = new Set<number>();
  for (const input of inputs) {
    const parsed = Note.get(input);
    if (parsed.empty) {
      return refuse('invalid-note', `invalid note name "${input}"; use a name such as C, Db, or F#4`);
    }
    chromas.add(parsed.chroma);
  }
  return accept([...chromas].sort((left, right) => left - right).map(pitchClassFromChroma));
}

/** Return stable local note data. Enharmonic inputs use the flat MIDI spelling. */
export function noteFact(input: string): TheoryResult<NoteFact> {
  const parsed = Note.get(input);
  if (parsed.empty) {
    return refuse('invalid-note', `invalid note name "${input}"; use a name such as C, Db, or F#4`);
  }
  const pitchClass = pitchClassFromChroma(parsed.chroma);
  if (parsed.midi === null) {
    if (parsed.oct !== undefined) {
      return refuse(
        'midi-range',
        `note "${input}" resolves to MIDI pitch ${parsed.height}, outside 0-127; choose another octave or source`,
      );
    }
    return accept({ name: pitchClass, pitchClass, chroma: parsed.chroma });
  }
  return accept({
    name: Note.fromMidi(parsed.midi), pitchClass, chroma: parsed.chroma,
    octave: parsed.oct, midi: parsed.midi,
  });
}

/** Return stable local interval data. Both P5 and 5P normalize to 5P. */
export function intervalFact(input: string): TheoryResult<IntervalFact> {
  const parsed = Interval.get(input);
  if (parsed.empty) {
    return refuse('invalid-interval', `invalid interval "${input}"; use Tonal interval form such as 3M or 5P`);
  }
  return accept({
    name: parsed.name, semitones: parsed.semitones, direction: parsed.dir < 0 ? -1 : 1,
  });
}

/** Return stable local chord data without exposing a Tonal chord object. */
export function chordFact(symbol: string): TheoryResult<ChordFact> {
  const parsed = Chord.get(symbol);
  if (parsed.empty || parsed.tonic === null) {
    return refuse('unknown-chord', `unknown chord "${symbol}"; use a chord symbol such as Fm or Cmaj7`);
  }
  const tonic = canonicalPitchClass(parsed.tonic)!;
  const bass = parsed.bass === '' ? undefined : canonicalPitchClass(parsed.bass);
  const canonical = Chord.getChord(parsed.type, tonic, bass);
  const pitchClasses = canonical.intervals.map((interval) => {
    const semitones = Interval.semitones(interval);
    return pitchClassFromChroma((Note.chroma(tonic) + semitones + 120) % 12);
  });
  return accept({
    symbol: canonical.symbol, name: canonical.name, tonic, bass,
    intervals: [...canonical.intervals], pitchClasses, chroma: Pcset.chroma(pitchClasses),
  });
}

/** Return stable local scale data. */
export function scaleFact(tonicInput: string, nameInput: string): TheoryResult<ScaleFact> {
  const tonic = canonicalPitchClass(tonicInput);
  if (tonic === undefined) {
    return refuse('invalid-note', `invalid scale tonic "${tonicInput}"; use a pitch class such as C or Db`);
  }
  const parsed = Scale.get(`${tonic} ${nameInput}`);
  if (parsed.empty || parsed.tonic === null) {
    return refuse('unknown-scale', `unknown scale "${tonicInput} ${nameInput}"; use a known scale or mode name`);
  }
  const pitchClasses = parsed.notes.map((note) => canonicalPitchClass(note)!);
  return accept({
    name: `${tonic} ${parsed.type}`, tonic, type: parsed.type,
    intervals: [...parsed.intervals], pitchClasses, chroma: Pcset.chroma(pitchClasses),
  });
}

/** Return one named mode, with optional tonic pitch classes. */
export function modeFact(nameInput: string, tonicInput?: string): TheoryResult<ModeFact> {
  const parsed = Mode.get(nameInput);
  if (parsed.empty) {
    return refuse('unknown-mode', `unknown mode "${nameInput}"; use a name such as ionian or dorian`);
  }
  if (tonicInput === undefined) {
    return accept({
      name: parsed.name, intervals: [...parsed.intervals], chroma: parsed.chroma,
      pitchClasses: [],
    });
  }
  const tonic = canonicalPitchClass(tonicInput);
  if (tonic === undefined) {
    return refuse('invalid-note', `invalid mode tonic "${tonicInput}"; use a pitch class such as C or Db`);
  }
  const pitchClasses = Mode.notes(parsed.name, tonic).map((note) => canonicalPitchClass(note)!);
  return accept({
    name: parsed.name, intervals: [...parsed.intervals], chroma: parsed.chroma,
    tonic, pitchClasses,
  });
}

/** Return major or natural-minor key facts. */
export function keyFact(input: string): TheoryResult<KeyFact> {
  const [tonicInput, typeInput] = Scale.tokenize(input);
  const tonic = canonicalPitchClass(tonicInput);
  const type = typeInput.toLowerCase();
  if (tonic === undefined || (type !== 'major' && type !== 'minor')) {
    return refuse('invalid-key', `invalid key "${input}"; use a major or minor key such as C major or Eb minor`);
  }
  if (type === 'major') {
    const key = Key.majorKey(tonic);
    return accept({
      name: `${tonic} major`, tonic, type, keySignature: key.keySignature,
      pitchClasses: key.scale.map((note) => canonicalPitchClass(note)!),
      triads: [...key.triads], chords: [...key.chords],
    });
  }
  const key = Key.minorKey(tonic);
  return accept({
    name: `${tonic} minor`, tonic, type, keySignature: key.keySignature,
    pitchClasses: key.natural.scale.map((note) => canonicalPitchClass(note)!),
    triads: [...key.natural.triads], chords: [...key.natural.chords],
  });
}

/** Detect chords and scales from a canonical pitch-class set. */
export function detectHarmony(inputs: readonly string[]): TheoryResult<HarmonyDetection> {
  const notes = canonicalNoteNames(inputs);
  if (!notes.ok) return notes;
  const chords = [...new Set(Chord.detect([...notes.value]))].sort((left, right) => left.localeCompare(right));
  const scales = [...new Set(Scale.detect([...notes.value], { match: 'exact' }))]
    .sort((left, right) => left.localeCompare(right));
  if (chords.length === 0 && scales.length === 0) {
    return refuse('empty-result', `no chord or exact scale matches pitch classes ${notes.value.join(', ')}`);
  }
  return accept({ pitchClasses: notes.value, chords, scales });
}

/** Normalize one pitch-class set by chroma, independent of input order. */
export function pitchClassSetFact(inputs: readonly string[]): TheoryResult<PitchClassSetFact> {
  if (inputs.length === 0) {
    return refuse('empty-result', 'a pitch-class set needs at least one pitch class');
  }
  const chromas = new Set<number>();
  const warnings: string[] = [];
  for (const input of inputs) {
    const pitchClass = canonicalPitchClass(input);
    if (pitchClass === undefined) {
      return refuse(
        'invalid-pitch-class',
        `invalid pitch class "${input}"; omit the octave and use a name such as C, Db, or F#`,
      );
    }
    const chroma = Note.chroma(pitchClass);
    if (chromas.has(chroma)) warnings.push(`removed duplicate pitch class ${pitchClass}`);
    chromas.add(chroma);
  }
  const pitchClasses = [...chromas].sort((left, right) => left - right).map(pitchClassFromChroma);
  const set = Pcset.get(pitchClasses);
  return accept({ pitchClasses, chroma: set.chroma, setNumber: set.setNum }, warnings);
}

function progressionChordSymbol(
  key: KeyFact,
  degree: string,
): TheoryResult<string> {
  const numeral = RomanNumeral.get(degree);
  if (numeral.empty || numeral.step < 0 || numeral.step >= key.pitchClasses.length) {
    return refuse(
      'invalid-progression',
      `invalid progression degree "${degree}"; use a Roman numeral such as i, IV, or bVII7`,
    );
  }
  const base = key.pitchClasses[numeral.step]!;
  const baseMidi = 60 + Note.chroma(base) + numeral.alt;
  const root = pitchClassFromChroma((baseMidi + 120) % 12);
  const suffix = numeral.chordType === '' ? numeral.major ? '' : 'm' : numeral.chordType;
  const chord = Chord.get(`${root}${suffix}`);
  if (chord.empty) {
    return refuse('unknown-chord', `progression degree "${degree}" resolves to unknown chord "${root}${suffix}"`);
  }
  return accept(chord.symbol);
}

/** Resolve Roman numerals against major or natural-minor scale degrees. */
export function progressionFact(keyInput: string, degrees: readonly string[]): TheoryResult<ProgressionFact> {
  if (degrees.length === 0) {
    return refuse('empty-result', 'a progression needs at least one Roman numeral degree');
  }
  const key = keyFact(keyInput);
  if (!key.ok) return key;
  const chordSymbols: string[] = [];
  for (const degree of degrees) {
    const chord = progressionChordSymbol(key.value, degree);
    if (!chord.ok) return chord;
    chordSymbols.push(chord.value);
  }
  const romanNumerals = Progression.toRomanNumerals(key.value.tonic, chordSymbols);
  return accept({ key: key.value, degrees: [...degrees], chordSymbols, romanNumerals });
}

function midiAt(pitchClass: string, octave: number): number {
  return (octave + 1) * 12 + Note.chroma(pitchClass);
}

function checkedMidi(value: number, label: string): TheoryResult<number> {
  if (!Number.isInteger(value) || value < 0 || value > 127) {
    return refuse(
      'midi-range',
      `${label} resolves to MIDI pitch ${value}, outside 0-127; choose another octave or source`,
    );
  }
  return accept(value);
}

function transposeMidi(root: number, interval: string, label: string): TheoryResult<number> {
  const fact = intervalFact(interval);
  if (!fact.ok) return fact;
  return checkedMidi(root + fact.value.semitones, label);
}

function theoryPitchMaterial(source: Exclude<GenerateOperation['source'], { kind: 'notes' }>): TheoryResult<PitchMaterial> {
  if (source.kind === 'intervals') {
    const root = noteFact(source.root);
    if (!root.ok) return root;
    if (root.value.midi === undefined) {
      return refuse('invalid-note', `interval root "${source.root}" needs an octave, such as ${source.root}3`);
    }
    const groups: number[][] = [];
    for (const interval of source.intervals) {
      const pitch = transposeMidi(root.value.midi, interval, `interval ${interval} from ${root.value.name}`);
      if (!pitch.ok) return pitch;
      groups.push([pitch.value]);
    }
    return accept({ groups, warnings: [] });
  }

  if (source.kind === 'chord') {
    const chord = chordFact(source.symbol);
    if (!chord.ok) return chord;
    const rootMidi = midiAt(chord.value.tonic, source.octave);
    const pitches: number[] = [];
    for (const interval of chord.value.intervals) {
      const pitch = transposeMidi(rootMidi, interval, `chord ${source.symbol} at octave ${source.octave}`);
      if (!pitch.ok) return pitch;
      pitches.push(pitch.value);
    }
    return accept({ groups: [pitches], warnings: [] });
  }

  if (source.kind === 'scale') {
    const scale = scaleFact(source.tonic, source.name);
    if (!scale.ok) return scale;
    const rootMidi = midiAt(scale.value.tonic, source.octave);
    const groups: number[][] = [];
    for (let octave = 0; octave < source.octaves; octave += 1) {
      for (const interval of scale.value.intervals) {
        const pitch = transposeMidi(
          rootMidi + octave * 12,
          interval,
          `scale ${scale.value.name} at octave ${source.octave + octave}`,
        );
        if (!pitch.ok) return pitch;
        groups.push([pitch.value]);
      }
    }
    return accept({ groups, warnings: [] });
  }

  if (source.kind === 'pitch-class-set') {
    const set = pitchClassSetFact(source.pitchClasses);
    if (!set.ok) return set;
    const groups: number[][] = [];
    for (let octave = 0; octave < source.octaves; octave += 1) {
      for (const pitchClass of set.value.pitchClasses) {
        const pitch = checkedMidi(
          midiAt(pitchClass, source.octave + octave),
          `pitch class ${pitchClass} at octave ${source.octave + octave}`,
        );
        if (!pitch.ok) return pitch;
        groups.push([pitch.value]);
      }
    }
    return accept({ groups, warnings: set.warnings });
  }

  const progression = progressionFact(source.key, source.degrees);
  if (!progression.ok) return progression;
  const groups: number[][] = [];
  for (const symbol of progression.value.chordSymbols) {
    const chord = chordFact(symbol);
    if (!chord.ok) return chord;
    const rootMidi = midiAt(chord.value.tonic, source.octave);
    const pitches: number[] = [];
    for (const interval of chord.value.intervals) {
      const pitch = transposeMidi(rootMidi, interval, `progression chord ${symbol} at octave ${source.octave}`);
      if (!pitch.ok) return pitch;
      pitches.push(pitch.value);
    }
    groups.push(pitches);
  }
  return accept({ groups, warnings: [] });
}

function noteIdentity(note: NoteRecord, channel: number): string {
  return `${channel}:${note.pitch}:${note.startBeats}`;
}

function finalizeNotes(notes: readonly CanonicalMusicalNote[]): TheoryResult<readonly CanonicalMusicalNote[]> {
  if (notes.length === 0) return refuse('empty-result', 'generation produced no notes');
  const identities = new Set<string>();
  for (const note of notes) {
    const identity = noteIdentity(note, note.channel);
    if (identities.has(identity)) {
      return refuse(
        'duplicate-note',
        `generation produced duplicate note identity on channel ${note.channel}: pitch ${note.pitch} at beat ${note.startBeats}`,
      );
    }
    identities.add(identity);
  }
  return accept([...notes]);
}

function generateNotes(
  operation: GenerateOperation,
  channel: number,
  provenance: MusicalProvenance,
): TheoryResult<readonly CanonicalMusicalNote[]> {
  if (operation.source.kind === 'notes') {
    return finalizeNotes(operation.source.notes.map((note) => ({ ...note, channel, provenance })));
  }
  if (!('placement' in operation)) {
    return refuse('empty-result', 'theory generation needs placement and velocity');
  }

  const material = theoryPitchMaterial(operation.source);
  if (!material.ok) return material;
  const placement = operation.placement;
  const notes: CanonicalMusicalNote[] = [];
  material.value.groups.forEach((group, groupIndex) => {
    const startBeats = placement.kind === 'stack'
      ? placement.startBeats
      : placement.startBeats + placement.stepBeats * groupIndex;
    for (const pitch of group) {
      notes.push({
        startBeats, pitch, velocity: operation.velocity,
        durationBeats: placement.durationBeats, ...operation.expression,
        channel, provenance,
      });
    }
  });
  const finalized = finalizeNotes(notes);
  return finalized.ok ? accept(finalized.value, material.value.warnings) : finalized;
}

/** Materialize the generation stage for every target and requested take. */
export function materializeGenerationPatch(
  patch: MusicalPatch,
): TheoryResult<readonly GeneratedMusicalTarget[]> {
  const takes = patch.protection.kind === 'direct' ? 1 : patch.protection.takes;
  const targets: GeneratedMusicalTarget[] = [];
  const warnings: string[] = [];
  for (let targetIndex = 0; targetIndex < patch.targets.length; targetIndex += 1) {
    const target = patch.targets[targetIndex]!;
    const operation = target.operations[0];
    if (operation?.op !== 'generate') {
      return refuse(
        'empty-result',
        `target ${targetIndex} does not start with generate; use the transformation boundary for existing notes`,
      );
    }
    for (let variationIndex = 0; variationIndex < takes; variationIndex += 1) {
      const provenance = { targetIndex, variationIndex, operationIndex: 0 } as const;
      const notes = generateNotes(operation, target.channel, provenance);
      if (!notes.ok) {
        return refuse(notes.code, `target ${targetIndex}, variation ${variationIndex}: ${notes.reason}`);
      }
      warnings.push(...notes.warnings.map((warning) =>
        `target ${targetIndex}, variation ${variationIndex}: ${warning}`));
      targets.push({
        channel: target.channel, write: target.write, notes: notes.value, ...provenance,
      });
    }
  }
  return accept(targets, warnings);
}

/** Remove boundary-only fields before compilation to Phase 1 note operations. */
export function toMaterializedMusicalTarget(
  generated: GeneratedMusicalTarget,
): MaterializedMusicalTarget {
  return {
    channel: generated.channel,
    write: generated.write,
    targetIndex: generated.targetIndex,
    variationIndex: generated.variationIndex,
    operationIndex: generated.operationIndex,
    notes: generated.notes.map(({ channel: _channel, provenance: _provenance, ...note }) => note),
  };
}
