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

import { STEP_SIZES, stepSizeFor, type NoteRecord } from '../contract/index.js';
import { musicalRandom, musicalSeedScope } from './patch.js';
import type {
  MaterializedMusicalTarget, MusicalLoss, MusicalOperation, MusicalPatch,
  MusicalSelection, MusicalTarget,
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
  | 'missing-seed'
  | 'grid-refused'
  | 'unsupported-operation'
  | 'unwritable-expression'
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

export interface HarmonicMaterializedTarget extends GeneratedMusicalTarget {
  readonly loss: readonly MusicalLoss[];
  readonly effectiveSeed?: string;
  readonly seedScopes: readonly { readonly operationIndex: number; readonly scope: string }[];
}

export type MusicalMaterializedTarget = HarmonicMaterializedTarget;

/** One note group. Grouping stays separate from operations on the group. */
export interface MusicalNoteGroup {
  readonly startBeats: number;
  readonly sourceIndexes: readonly number[];
  readonly notes: readonly CanonicalMusicalNote[];
}

export interface NoteSelectionResult {
  readonly selectedIndexes: ReadonlySet<number>;
  readonly selected: readonly CanonicalMusicalNote[];
  readonly unselected: readonly CanonicalMusicalNote[];
}

/** One half-open harmony region. Later resolvers can return key-local regions. */
export interface HarmonyRegion {
  readonly fromBeats: number;
  readonly toBeats: number;
  readonly label: string;
  readonly pitchClasses: readonly string[];
}

export type HarmonyPlan =
  | { readonly kind: 'intervals'; readonly intervals: readonly IntervalFact[] }
  | { readonly kind: 'regions'; readonly regions: readonly HarmonyRegion[] };

export type MusicalNoteGrouping = (
  notes: readonly CanonicalMusicalNote[],
  sourceIndexes?: readonly number[],
) => readonly MusicalNoteGroup[];

export type HarmonyPlanResolver = (
  harmony: HarmonizeOperation['harmony'],
  selected: readonly CanonicalMusicalNote[],
) => TheoryResult<HarmonyPlan>;

export interface HarmonicTransformOptions {
  readonly groupNotes?: MusicalNoteGrouping;
  readonly resolveHarmony?: HarmonyPlanResolver;
  readonly seed?: string;
}

export type MusicalTransformOptions = HarmonicTransformOptions;

type GenerateOperation = Extract<MusicalOperation, { readonly op: 'generate' }>;
type HarmonicOperation = Extract<
  MusicalOperation,
  { readonly op: 'transpose' | 'harmonize' | 'arpeggiate' | 'revoice' }
>;
type RhythmOperation = Extract<
  MusicalOperation,
  { readonly op: 'quantize' | 'humanize' | 'thin' | 'densify' }
>;
type HarmonizeOperation = Extract<HarmonicOperation, { readonly op: 'harmonize' }>;

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

function plainNote(note: CanonicalMusicalNote): NoteRecord {
  const { channel: _channel, provenance: _provenance, ...value } = note;
  return value;
}

function noteValueKey(note: NoteRecord): string {
  return JSON.stringify(Object.fromEntries(
    Object.entries(note).sort(([left], [right]) => left.localeCompare(right)),
  ));
}

function operationProvenance(
  provenance: MusicalProvenance,
  operationIndex: number,
): MusicalProvenance {
  return { ...provenance, operationIndex };
}

function selectedBy(note: NoteRecord, selection?: MusicalSelection): boolean {
  if (selection?.beatRange !== undefined
      && (note.startBeats < selection.beatRange.fromBeats
        || note.startBeats >= selection.beatRange.toBeats)) return false;
  if (selection?.pitchRange !== undefined
      && (note.pitch < selection.pitchRange.min || note.pitch > selection.pitchRange.max)) return false;
  return true;
}

/** Select by half-open beat range and inclusive pitch range. Array order stays intact. */
export function selectCanonicalNotes(
  notes: readonly CanonicalMusicalNote[],
  selection?: MusicalSelection,
): NoteSelectionResult {
  const selectedIndexes = new Set<number>();
  const selected: CanonicalMusicalNote[] = [];
  const unselected: CanonicalMusicalNote[] = [];
  notes.forEach((note, index) => {
    if (selectedBy(note, selection)) {
      selectedIndexes.add(index);
      selected.push(note);
    } else {
      unselected.push(note);
    }
  });
  return { selectedIndexes, selected, unselected };
}

/** Group exact simultaneous onsets without changing note order within a group. */
export function groupNotesByExactOnset(
  notes: readonly CanonicalMusicalNote[],
  sourceIndexes: readonly number[] = notes.map((_note, index) => index),
): readonly MusicalNoteGroup[] {
  if (sourceIndexes.length !== notes.length) {
    throw new Error('note grouping needs one source index for every note');
  }
  const groups = new Map<number, { sourceIndexes: number[]; notes: CanonicalMusicalNote[] }>();
  notes.forEach((note, index) => {
    const group = groups.get(note.startBeats) ?? { sourceIndexes: [], notes: [] };
    group.sourceIndexes.push(sourceIndexes[index]!);
    group.notes.push(note);
    groups.set(note.startBeats, group);
  });
  return [...groups].map(([startBeats, group]) => ({ startBeats, ...group }));
}

function fullHarmonyRegion(label: string, pitchClasses: readonly string[]): HarmonyRegion {
  return { fromBeats: Number.NEGATIVE_INFINITY, toBeats: Number.POSITIVE_INFINITY, label, pitchClasses };
}

/** Resolve harmony separately from grouping so later resolvers can return local regions. */
export function resolveHarmonyPlan(
  harmony: HarmonizeOperation['harmony'],
  selected: readonly CanonicalMusicalNote[],
): TheoryResult<HarmonyPlan> {
  if (harmony.kind === 'intervals') {
    const intervals: IntervalFact[] = [];
    for (const name of harmony.intervals) {
      const interval = intervalFact(name);
      if (!interval.ok) return interval;
      intervals.push(interval.value);
    }
    return accept({ kind: 'intervals', intervals });
  }

  if (harmony.kind === 'chord') {
    const chord = chordFact(harmony.symbol);
    if (!chord.ok) return chord;
    return accept({
      kind: 'regions', regions: [fullHarmonyRegion(chord.value.symbol, chord.value.pitchClasses)],
    });
  }

  if (harmony.kind === 'scale') {
    const scale = scaleFact(harmony.tonic, harmony.name);
    if (!scale.ok) return scale;
    return accept({
      kind: 'regions', regions: [fullHarmonyRegion(scale.value.name, scale.value.pitchClasses)],
    });
  }

  if (selected.length === 0) {
    return refuse('empty-result', 'harmony detection needs at least one selected note');
  }
  const detected = detectHarmony(selected.map((note) => Note.fromMidi(note.pitch)));
  if (!detected.ok) return detected;
  if (harmony.as === 'chord') {
    const symbol = detected.value.chords[0];
    if (symbol === undefined) {
      return refuse('empty-result', `no chord matches selected pitches ${detected.value.pitchClasses.join(', ')}`);
    }
    const chord = chordFact(symbol);
    if (!chord.ok) return chord;
    return accept({
      kind: 'regions', regions: [fullHarmonyRegion(chord.value.symbol, chord.value.pitchClasses)],
    });
  }
  const name = detected.value.scales[0];
  if (name === undefined) {
    return refuse('empty-result', `no exact scale matches selected pitches ${detected.value.pitchClasses.join(', ')}`);
  }
  const [tonic, type] = Scale.tokenize(name);
  const scale = scaleFact(tonic, type);
  if (!scale.ok) return scale;
  return accept({
    kind: 'regions', regions: [fullHarmonyRegion(scale.value.name, scale.value.pitchClasses)],
  });
}

function validateTransformNotes(
  notes: readonly CanonicalMusicalNote[],
  operationIndex: number,
  allowEmpty = false,
): TheoryResult<readonly CanonicalMusicalNote[]> {
  if (notes.length === 0 && !allowEmpty) {
    return refuse('empty-result', `operation ${operationIndex} produced no notes`);
  }
  const identities = new Set<string>();
  for (const note of notes) {
    if (!Number.isInteger(note.pitch) || note.pitch < 0 || note.pitch > 127) {
      return refuse(
        'midi-range',
        `operation ${operationIndex} resolves to MIDI pitch ${note.pitch}, outside 0-127; change the operation or selection`,
      );
    }
    if (note.pressure !== undefined) {
      return refuse(
        'unwritable-expression',
        `operation ${operationIndex} would write pressure on channel ${note.channel}; pressure is not writable and cannot be dropped`,
      );
    }
    if (!Number.isFinite(note.startBeats) || note.startBeats < 0
        || !Number.isFinite(note.durationBeats) || note.durationBeats <= 0) {
      return refuse(
        'grid-refused',
        `operation ${operationIndex} produced invalid timing at beat ${note.startBeats} `
          + `with duration ${note.durationBeats}`,
      );
    }
    const identity = noteIdentity(note, note.channel);
    if (identities.has(identity)) {
      return refuse(
        'duplicate-note',
        `operation ${operationIndex} produced duplicate note identity on channel ${note.channel}: `
          + `pitch ${note.pitch} at beat ${note.startBeats}; duplicate collapse is refused`,
      );
    }
    identities.add(identity);
  }
  return accept(notes);
}

function transformedSelection(
  notes: readonly CanonicalMusicalNote[],
  selection: NoteSelectionResult,
  replacements: ReadonlyMap<number, readonly CanonicalMusicalNote[]>,
): readonly CanonicalMusicalNote[] {
  const firstIndexes = new Map<number, readonly CanonicalMusicalNote[]>();
  for (const [sourceIndex, group] of replacements) firstIndexes.set(sourceIndex, group);
  const output: CanonicalMusicalNote[] = [];
  notes.forEach((note, index) => {
    const replacement = firstIndexes.get(index);
    if (replacement !== undefined) output.push(...replacement);
    if (!selection.selectedIndexes.has(index)) output.push(note);
  });
  return output;
}

function setGroupReplacements(
  replacements: Map<number, readonly CanonicalMusicalNote[]>,
  group: MusicalNoteGroup,
  output: readonly CanonicalMusicalNote[],
): void {
  const sourceIndexes = [...group.sourceIndexes].sort((left, right) => left - right);
  sourceIndexes.forEach((sourceIndex, index) => {
    replacements.set(sourceIndex, output[index] === undefined ? [] : [output[index]]);
  });
  const lastSourceIndex = sourceIndexes.at(-1);
  if (lastSourceIndex !== undefined && output.length > sourceIndexes.length) {
    replacements.set(lastSourceIndex, [
      ...(replacements.get(lastSourceIndex) ?? []),
      ...output.slice(sourceIndexes.length),
    ]);
  }
}

function groupedSelection(
  notes: readonly CanonicalMusicalNote[],
  selection?: MusicalSelection,
  groupNotes: MusicalNoteGrouping = groupNotesByExactOnset,
): { readonly selection: NoteSelectionResult; readonly groups: readonly MusicalNoteGroup[] } {
  const result = selectCanonicalNotes(notes, selection);
  return {
    selection: result,
    groups: groupNotes(result.selected, [...result.selectedIndexes]),
  };
}

function lossItem(
  code: MusicalLoss['code'],
  before: CanonicalMusicalNote | undefined,
  after: CanonicalMusicalNote | undefined,
  provenance: MusicalProvenance,
  message: string,
): MusicalLoss {
  return {
    code,
    targetIndex: provenance.targetIndex,
    variationIndex: provenance.variationIndex,
    operationIndex: provenance.operationIndex,
    ...(before === undefined ? {} : { before: plainNote(before) }),
    ...(after === undefined ? {} : { after: plainNote(after) }),
    message,
  };
}

function midiCandidates(pitchClass: string, minPitch: number, maxPitch: number): readonly number[] {
  const chroma = Note.chroma(pitchClass);
  const first = minPitch + ((chroma - minPitch % 12) + 12) % 12;
  const values: number[] = [];
  for (let pitch = first; pitch <= maxPitch; pitch += 12) values.push(pitch);
  return values;
}

function nearestPitch(pitchClass: string, anchor: number): number {
  return [...midiCandidates(pitchClass, 0, 127)].sort((left, right) =>
    Math.abs(left - anchor) - Math.abs(right - anchor) || left - right)[0]!;
}

function harmonizeGroup(
  group: MusicalNoteGroup,
  plan: HarmonyPlan,
  provenance: MusicalProvenance,
): TheoryResult<{ readonly notes: readonly CanonicalMusicalNote[]; readonly loss: readonly MusicalLoss[] }> {
  const additions: CanonicalMusicalNote[] = [];
  if (plan.kind === 'intervals') {
    for (const note of group.notes) {
      for (const interval of plan.intervals) {
        const pitch = note.pitch + interval.semitones;
        const checked = checkedMidi(pitch, `interval ${interval.name} from MIDI pitch ${note.pitch}`);
        if (!checked.ok) return checked;
        additions.push({ ...note, pitch: checked.value, provenance });
      }
    }
  } else {
    const region = plan.regions.find((candidate) =>
      group.startBeats >= candidate.fromBeats && group.startBeats < candidate.toBeats);
    if (region === undefined) {
      return refuse('empty-result', `no harmony region covers beat ${group.startBeats}`);
    }
    const present = new Set(group.notes.map((note) => note.pitch % 12));
    const anchor = Math.min(...group.notes.map((note) => note.pitch));
    const template = group.notes[0]!;
    for (const pitchClass of region.pitchClasses) {
      const chroma = Note.chroma(pitchClass);
      if (present.has(chroma)) continue;
      additions.push({ ...template, pitch: nearestPitch(pitchClass, anchor), provenance });
      present.add(chroma);
    }
  }
  const loss = additions.map((note) => lossItem(
    'note-added', undefined, note, provenance,
    `added harmony pitch ${note.pitch} at beat ${note.startBeats}`,
  ));
  return accept({ notes: [...group.notes, ...additions], loss });
}

function harmonizeNotes(
  notes: readonly CanonicalMusicalNote[],
  operation: HarmonizeOperation,
  provenance: MusicalProvenance,
  options: HarmonicTransformOptions,
): TheoryResult<{ readonly notes: readonly CanonicalMusicalNote[]; readonly loss: readonly MusicalLoss[] }> {
  const grouped = groupedSelection(notes, operation.selection, options.groupNotes);
  if (grouped.groups.length === 0) return refuse('empty-result', 'harmonize needs at least one selected note');
  const plan = (options.resolveHarmony ?? resolveHarmonyPlan)(operation.harmony, grouped.selection.selected);
  if (!plan.ok) return plan;
  const replacements = new Map<number, readonly CanonicalMusicalNote[]>();
  const loss: MusicalLoss[] = [];
  for (const group of grouped.groups) {
    const transformed = harmonizeGroup(group, plan.value, provenance);
    if (!transformed.ok) return transformed;
    setGroupReplacements(replacements, group, transformed.value.notes);
    loss.push(...transformed.value.loss);
  }
  return accept({ notes: transformedSelection(notes, grouped.selection, replacements), loss });
}

function arpeggioOrder(
  notes: readonly CanonicalMusicalNote[],
  pattern: Extract<HarmonicOperation, { readonly op: 'arpeggiate' }>['pattern'],
): readonly CanonicalMusicalNote[] {
  if (pattern === 'as-played') return [...notes];
  const ascending = [...notes].sort((left, right) => left.pitch - right.pitch);
  if (pattern === 'up') return ascending;
  if (pattern === 'down') return ascending.reverse();
  return ascending.length < 3
    ? ascending
    : [...ascending, ...ascending.slice(1, -1).reverse()];
}

function arpeggiateNotes(
  notes: readonly CanonicalMusicalNote[],
  operation: Extract<HarmonicOperation, { readonly op: 'arpeggiate' }>,
  provenance: MusicalProvenance,
  options: HarmonicTransformOptions,
): TheoryResult<{ readonly notes: readonly CanonicalMusicalNote[]; readonly loss: readonly MusicalLoss[] }> {
  const grouped = groupedSelection(notes, operation.selection, options.groupNotes);
  if (grouped.groups.length === 0) return refuse('empty-result', 'arpeggiate needs at least one selected note');
  const replacements = new Map<number, readonly CanonicalMusicalNote[]>();
  const loss: MusicalLoss[] = [];
  for (const group of grouped.groups) {
    const ordered = arpeggioOrder(group.notes, operation.pattern);
    const output = ordered.map((before, index): CanonicalMusicalNote => ({
      ...before,
      startBeats: group.startBeats + index * operation.stepBeats,
      durationBeats: operation.durationBeats,
      provenance,
    }));
    output.forEach((after, index) => {
      const before = ordered[index]!;
      if (after.startBeats !== before.startBeats) {
        loss.push(lossItem(
          'timing-moved', before, after, provenance,
          `moved pitch ${before.pitch} from beat ${before.startBeats} to ${after.startBeats}`,
        ));
      }
      if (after.durationBeats < before.durationBeats) {
        loss.push(lossItem(
          'note-shortened', before, after, provenance,
          `shortened pitch ${before.pitch} at beat ${after.startBeats} to ${after.durationBeats} beats`,
        ));
      }
      if (index >= group.notes.length) {
        loss.push(lossItem(
          'note-added', undefined, after, provenance,
          `added return pitch ${after.pitch} at beat ${after.startBeats} for the up-down pattern`,
        ));
      }
    });
    setGroupReplacements(replacements, group, output);
  }
  return accept({ notes: transformedSelection(notes, grouped.selection, replacements), loss });
}

function closestVoicing(
  notes: readonly CanonicalMusicalNote[],
  minPitch: number,
  maxPitch: number,
): TheoryResult<readonly { readonly before: CanonicalMusicalNote; readonly after: CanonicalMusicalNote }[]> {
  const used = new Set<number>();
  const output: { before: CanonicalMusicalNote; after: CanonicalMusicalNote }[] = [];
  for (const note of notes) {
    const candidates = [...midiCandidates(pitchClassFromChroma(note.pitch % 12), minPitch, maxPitch)]
      .filter((pitch) => !used.has(pitch))
      .sort((left, right) => Math.abs(left - note.pitch) - Math.abs(right - note.pitch) || left - right);
    const pitch = candidates[0];
    if (pitch === undefined) {
      return refuse(
        'midi-range',
        `cannot place every pitch class without duplicates in MIDI range ${minPitch}-${maxPitch}; widen the range`,
      );
    }
    used.add(pitch);
    output.push({ before: note, after: { ...note, pitch } });
  }
  return accept(output);
}

function ascendingVoicing(
  notes: readonly CanonicalMusicalNote[],
  minPitch: number,
  maxPitch: number,
): TheoryResult<readonly { readonly before: CanonicalMusicalNote; readonly after: CanonicalMusicalNote }[]> {
  const ordered = [...notes].sort((left, right) => left.pitch - right.pitch);
  const output: { before: CanonicalMusicalNote; after: CanonicalMusicalNote }[] = [];
  let previous = minPitch - 1;
  for (const note of ordered) {
    const pitch = midiCandidates(pitchClassFromChroma(note.pitch % 12), minPitch, maxPitch)
      .find((candidate) => candidate > previous);
    if (pitch === undefined) {
      return refuse('midi-range', `cannot build an ascending voicing in MIDI range ${minPitch}-${maxPitch}; widen the range`);
    }
    output.push({ before: note, after: { ...note, pitch } });
    previous = pitch;
  }
  return accept(output);
}

function revoiceGroup(
  notes: readonly CanonicalMusicalNote[],
  operation: Extract<HarmonicOperation, { readonly op: 'revoice' }>,
): TheoryResult<readonly { readonly before: CanonicalMusicalNote; readonly after: CanonicalMusicalNote }[]> {
  if (operation.strategy === 'ascending') {
    return ascendingVoicing(notes, operation.minPitch, operation.maxPitch);
  }
  const closest = closestVoicing(notes, operation.minPitch, operation.maxPitch);
  if (!closest.ok || operation.strategy === 'closest' || closest.value.length < 2) return closest;
  const dropped = [...closest.value].sort((left, right) => left.after.pitch - right.after.pitch);
  const dropIndex = dropped.length - 2;
  const voice = dropped[dropIndex]!;
  const pitch = voice.after.pitch - 12;
  if (pitch < operation.minPitch) {
    return refuse(
      'midi-range',
      `drop-2 moves MIDI pitch ${voice.after.pitch} below range ${operation.minPitch}-${operation.maxPitch}; widen the range`,
    );
  }
  dropped[dropIndex] = { ...voice, after: { ...voice.after, pitch } };
  return accept(dropped.sort((left, right) => left.after.pitch - right.after.pitch));
}

function revoiceNotes(
  notes: readonly CanonicalMusicalNote[],
  operation: Extract<HarmonicOperation, { readonly op: 'revoice' }>,
  provenance: MusicalProvenance,
  options: HarmonicTransformOptions,
): TheoryResult<{ readonly notes: readonly CanonicalMusicalNote[]; readonly loss: readonly MusicalLoss[] }> {
  const grouped = groupedSelection(notes, operation.selection, options.groupNotes);
  if (grouped.groups.length === 0) return refuse('empty-result', 'revoice needs at least one selected note');
  const replacements = new Map<number, readonly CanonicalMusicalNote[]>();
  const loss: MusicalLoss[] = [];
  for (const group of grouped.groups) {
    const voiced = revoiceGroup(group.notes, operation);
    if (!voiced.ok) return voiced;
    const output = voiced.value.map(({ after }) => ({ ...after, provenance }));
    voiced.value.forEach(({ before, after }, index) => {
      if (before.pitch !== after.pitch) {
        loss.push(lossItem(
          'octave-displaced', before, output[index]!, provenance,
          `moved pitch ${before.pitch} to ${after.pitch} by ${Math.abs(after.pitch - before.pitch) / 12} octave(s)`,
        ));
      }
    });
    setGroupReplacements(replacements, group, output);
  }
  return accept({ notes: transformedSelection(notes, grouped.selection, replacements), loss });
}

const TIMING_EPSILON = 1e-9;

function cleanBeat(value: number): number {
  return Math.abs(value) < TIMING_EPSILON ? 0 : value;
}

function timingLoss(
  before: CanonicalMusicalNote,
  after: CanonicalMusicalNote,
  provenance: MusicalProvenance,
  requestedStartBeats: number,
  message: string,
): MusicalLoss {
  return {
    ...lossItem('timing-moved', before, after, provenance, message),
    requestedStartBeats,
    realizedStartBeats: after.startBeats,
  };
}

function truncateSamePitchOverlaps(
  notes: readonly CanonicalMusicalNote[],
  provenance: MusicalProvenance,
): { readonly notes: readonly CanonicalMusicalNote[]; readonly loss: readonly MusicalLoss[] } {
  const output = [...notes];
  const ordered = notes.map((note, index) => ({ note, index })).sort((left, right) =>
    left.note.pitch - right.note.pitch || left.note.startBeats - right.note.startBeats);
  const loss: MusicalLoss[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]!;
    const next = ordered[index]!;
    if (previous.note.pitch !== next.note.pitch) continue;
    const durationBeats = cleanBeat(next.note.startBeats - previous.note.startBeats);
    if (previous.note.durationBeats <= durationBeats + TIMING_EPSILON) continue;
    const after = { ...previous.note, durationBeats };
    output[previous.index] = after;
    loss.push(lossItem(
      'note-shortened', previous.note, after, provenance,
      `shortened pitch ${previous.note.pitch} at beat ${previous.note.startBeats} from `
        + `${previous.note.durationBeats} to ${durationBeats} beats before the next same-pitch note`,
    ));
  }
  return { notes: output, loss };
}

function validateRhythmGrid(
  notes: readonly CanonicalMusicalNote[],
  provenance: MusicalProvenance,
): TheoryResult<number> {
  const stepSize = stepSizeFor(notes);
  if (stepSize === undefined) {
    return refuse(
      'grid-refused',
      `operation ${provenance.operationIndex} produced timing that no exact straight or triplet grid can represent; `
        + 'change the grid, strength, or timing range',
    );
  }
  const identities = new Set<string>();
  for (const note of notes) {
    const step = Math.round(note.startBeats / stepSize);
    const identity = `${note.channel}:${note.pitch}:${step}`;
    if (identities.has(identity)) {
      return refuse(
        'duplicate-note',
        `operation ${provenance.operationIndex} would encode duplicate note identity on channel `
          + `${note.channel}: pitch ${note.pitch} at grid step ${step} on the ${stepSize}-beat grid`,
      );
    }
    identities.add(identity);
  }
  return accept(stepSize);
}

function validateRhythmResult(
  notes: readonly CanonicalMusicalNote[],
  provenance: MusicalProvenance,
): TheoryResult<{ readonly notes: readonly CanonicalMusicalNote[]; readonly loss: readonly MusicalLoss[] }> {
  const valid = validateTransformNotes(notes, provenance.operationIndex, true);
  if (!valid.ok) return valid;
  const inputGrid = validateRhythmGrid(valid.value, provenance);
  if (!inputGrid.ok) return inputGrid;
  const normalized = truncateSamePitchOverlaps(valid.value, provenance);
  const normalizedNotes = validateTransformNotes(normalized.notes, provenance.operationIndex, true);
  if (!normalizedNotes.ok) return normalizedNotes;
  const outputGrid = validateRhythmGrid(normalizedNotes.value, provenance);
  if (!outputGrid.ok) return outputGrid;
  return accept({ notes: normalizedNotes.value, loss: normalized.loss });
}

function quantizeNotes(
  notes: readonly CanonicalMusicalNote[],
  operation: Extract<RhythmOperation, { readonly op: 'quantize' }>,
  provenance: MusicalProvenance,
): TheoryResult<{ readonly notes: readonly CanonicalMusicalNote[]; readonly loss: readonly MusicalLoss[] }> {
  const selection = selectCanonicalNotes(notes, operation.selection);
  if (selection.selected.length === 0) return refuse('empty-result', 'quantize needs at least one selected note');
  const loss: MusicalLoss[] = [];
  const output = notes.map((before, index) => {
    if (!selection.selectedIndexes.has(index)) return before;
    const snapped = cleanBeat(Math.floor(before.startBeats / operation.gridBeats + 0.5) * operation.gridBeats);
    const realized = cleanBeat(before.startBeats + (snapped - before.startBeats) * operation.strength);
    const after = realized === before.startBeats ? before : { ...before, startBeats: realized, provenance };
    if (snapped !== before.startBeats) {
      loss.push(timingLoss(
        before, after, provenance, snapped,
        `quantize requested beat ${snapped} from beat ${before.startBeats}; strength `
          + `${operation.strength} realized beat ${realized}`,
      ));
    }
    return after;
  });
  const validated = validateRhythmResult(output, provenance);
  return validated.ok
    ? accept({ notes: validated.value.notes, loss: [...loss, ...validated.value.loss] })
    : validated;
}

function finestExactGrid(notes: readonly CanonicalMusicalNote[]): number | undefined {
  const values = notes.flatMap((note) => [note.startBeats, note.durationBeats]);
  return [...STEP_SIZES].reverse().find((size) =>
    values.every((value) => Math.abs(value / size - Math.round(value / size)) < TIMING_EPSILON));
}

function humanizeNotes(
  notes: readonly CanonicalMusicalNote[],
  operation: Extract<RhythmOperation, { readonly op: 'humanize' }>,
  provenance: MusicalProvenance,
  seedScope: string,
): TheoryResult<{ readonly notes: readonly CanonicalMusicalNote[]; readonly loss: readonly MusicalLoss[] }> {
  const selection = selectCanonicalNotes(notes, operation.selection);
  if (selection.selected.length === 0) return refuse('empty-result', 'humanize needs at least one selected note');
  const exactGrid = finestExactGrid(notes);
  if (exactGrid === undefined) {
    return refuse('grid-refused', 'humanize input has no exact straight or triplet host grid');
  }
  const maxTimingSteps = Math.floor((operation.maxTimingBeats + TIMING_EPSILON) / exactGrid);
  const loss: MusicalLoss[] = [];
  let drawIndex = 0;
  const output = notes.map((before, index) => {
    if (!selection.selectedIndexes.has(index)) return before;
    const timingDraw = musicalRandom(seedScope, drawIndex++);
    const velocityDraw = musicalRandom(seedScope, drawIndex++);
    const requestedStart = cleanBeat(
      before.startBeats + (timingDraw * 2 - 1) * operation.maxTimingBeats,
    );
    const requestedSteps = Math.round((requestedStart - before.startBeats) / exactGrid);
    const boundedSteps = Math.max(-maxTimingSteps, Math.min(maxTimingSteps, requestedSteps));
    const realizedStart = cleanBeat(Math.max(0, before.startBeats + boundedSteps * exactGrid));
    const requestedVelocity = before.velocity + (velocityDraw * 2 - 1) * operation.maxVelocity;
    const realizedVelocity = Math.round(Math.max(0, Math.min(127, requestedVelocity)));
    const after = realizedStart === before.startBeats && realizedVelocity === before.velocity
      ? before
      : { ...before, startBeats: realizedStart, velocity: realizedVelocity, provenance };
    if (requestedStart !== before.startBeats || realizedStart !== before.startBeats) {
      loss.push(timingLoss(
        before, after, provenance, requestedStart,
        `humanize requested beat ${requestedStart} from beat ${before.startBeats}; exact-grid `
          + `snap and range clipping realized beat ${realizedStart}`,
      ));
    }
    if (realizedVelocity !== before.velocity) {
      loss.push(lossItem(
        'velocity-changed', before, after, provenance,
        `humanize requested velocity ${requestedVelocity}; integer snap and range clipping realized ${realizedVelocity}`,
      ));
    }
    return after;
  });
  const validated = validateRhythmResult(output, provenance);
  return validated.ok
    ? accept({ notes: validated.value.notes, loss: [...loss, ...validated.value.loss] })
    : validated;
}

function thinNotes(
  notes: readonly CanonicalMusicalNote[],
  operation: Extract<RhythmOperation, { readonly op: 'thin' }>,
  provenance: MusicalProvenance,
  seedScope: string,
): TheoryResult<{ readonly notes: readonly CanonicalMusicalNote[]; readonly loss: readonly MusicalLoss[] }> {
  const selection = selectCanonicalNotes(notes, operation.selection);
  if (selection.selected.length === 0) return refuse('empty-result', 'thin needs at least one selected note');
  const output: CanonicalMusicalNote[] = [];
  const loss: MusicalLoss[] = [];
  let drawIndex = 0;
  notes.forEach((note, index) => {
    if (!selection.selectedIndexes.has(index) || musicalRandom(seedScope, drawIndex++) >= operation.probability) {
      output.push(note);
      return;
    }
    loss.push(lossItem(
      'note-removed', note, undefined, provenance,
      `removed pitch ${note.pitch} at beat ${note.startBeats} with probability ${operation.probability}`,
    ));
  });
  return accept({ notes: output, loss });
}

function densifyNotes(
  notes: readonly CanonicalMusicalNote[],
  operation: Extract<RhythmOperation, { readonly op: 'densify' }>,
  provenance: MusicalProvenance,
  seedScope: string,
  groupNotes: MusicalNoteGrouping,
): TheoryResult<{ readonly notes: readonly CanonicalMusicalNote[]; readonly loss: readonly MusicalLoss[] }> {
  const selected = selectCanonicalNotes(notes, operation.selection);
  if (selected.selected.length === 0) return refuse('empty-result', 'densify needs at least one selected note');
  const groups = [...groupNotes(selected.selected, [...selected.selectedIndexes])]
    .sort((left, right) => left.startBeats - right.startBeats);
  const additions: CanonicalMusicalNote[] = [];
  const loss: MusicalLoss[] = [];
  let drawIndex = 0;
  for (let groupIndex = 0; groupIndex + 1 < groups.length; groupIndex += 1) {
    const group = groups[groupIndex]!;
    const next = groups[groupIndex + 1]!;
    let startBeats = cleanBeat(
      (Math.floor(group.startBeats / operation.gridBeats + TIMING_EPSILON) + 1) * operation.gridBeats,
    );
    while (startBeats < next.startBeats - TIMING_EPSILON) {
      for (const source of group.notes) {
        if (musicalRandom(seedScope, drawIndex++) < operation.probability) {
          const added = { ...source, startBeats, provenance };
          additions.push(added);
          loss.push(lossItem(
            'note-added', undefined, added, provenance,
            `added pitch ${added.pitch} at grid beat ${startBeats} from the preceding onset group`,
          ));
        }
      }
      startBeats = cleanBeat(startBeats + operation.gridBeats);
    }
  }
  const validated = validateRhythmResult([...notes, ...additions], provenance);
  return validated.ok
    ? accept({ notes: validated.value.notes, loss: [...loss, ...validated.value.loss] })
    : validated;
}

function applyRhythmOperation(
  notes: readonly CanonicalMusicalNote[],
  operation: RhythmOperation,
  provenance: MusicalProvenance,
  options: HarmonicTransformOptions,
  seedScope?: string,
): TheoryResult<{ readonly notes: readonly CanonicalMusicalNote[]; readonly loss: readonly MusicalLoss[] }> {
  if (operation.op === 'quantize') return quantizeNotes(notes, operation, provenance);
  if (seedScope === undefined) {
    return refuse('missing-seed', `operation ${provenance.operationIndex} (${operation.op}) needs an explicit seed`);
  }
  if (operation.op === 'humanize') return humanizeNotes(notes, operation, provenance, seedScope);
  if (operation.op === 'thin') return thinNotes(notes, operation, provenance, seedScope);
  return densifyNotes(
    notes, operation, provenance, seedScope, options.groupNotes ?? groupNotesByExactOnset,
  );
}

function applyHarmonicOperation(
  notes: readonly CanonicalMusicalNote[],
  operation: HarmonicOperation,
  provenance: MusicalProvenance,
  options: HarmonicTransformOptions,
): TheoryResult<{ readonly notes: readonly CanonicalMusicalNote[]; readonly loss: readonly MusicalLoss[] }> {
  let transformed: TheoryResult<{
    readonly notes: readonly CanonicalMusicalNote[];
    readonly loss: readonly MusicalLoss[];
  }>;
  if (operation.op === 'transpose') {
    const selection = selectCanonicalNotes(notes, operation.selection);
    if (selection.selected.length === 0) return refuse('empty-result', 'transpose needs at least one selected note');
    const output: CanonicalMusicalNote[] = [];
    for (let index = 0; index < notes.length; index += 1) {
      const note = notes[index]!;
      if (!selection.selectedIndexes.has(index)) {
        output.push(note);
        continue;
      }
      const pitch = checkedMidi(note.pitch + operation.semitones, `transpose from MIDI pitch ${note.pitch}`);
      if (!pitch.ok) return pitch;
      output.push({ ...note, pitch: pitch.value, provenance });
    }
    transformed = accept({ notes: output, loss: [] });
  } else if (operation.op === 'harmonize') {
    transformed = harmonizeNotes(notes, operation, provenance, options);
  } else if (operation.op === 'arpeggiate') {
    transformed = arpeggiateNotes(notes, operation, provenance, options);
  } else {
    transformed = revoiceNotes(notes, operation, provenance, options);
  }
  if (!transformed.ok) return transformed;
  const validated = validateTransformNotes(transformed.value.notes, provenance.operationIndex);
  return validated.ok ? accept({ notes: validated.value, loss: transformed.value.loss }) : validated;
}

/** Materialize one ordered musical pipeline from generated or existing notes. */
export function materializeMusicalTarget(
  target: MusicalTarget,
  sourceNotes: readonly NoteRecord[],
  targetIndex = 0,
  variationIndex = 0,
  options: HarmonicTransformOptions = {},
): TheoryResult<HarmonicMaterializedTarget> {
  const first = target.operations[0];
  if (first === undefined) return refuse('empty-result', `target ${targetIndex} has no operations`);
  const warnings: string[] = [];
  let notes: readonly CanonicalMusicalNote[];
  let operationIndex = 0;
  if (first.op === 'generate') {
    const generated = generateNotes(first, target.channel, { targetIndex, variationIndex, operationIndex: 0 });
    if (!generated.ok) return generated;
    notes = generated.value;
    warnings.push(...generated.warnings);
    operationIndex = 1;
  } else {
    if (sourceNotes.length === 0) {
      return refuse('empty-result', `target ${targetIndex} needs existing notes for the transformation boundary`);
    }
    notes = sourceNotes.map((note) => ({
      ...note, channel: target.channel,
      provenance: { targetIndex, variationIndex, operationIndex: -1 },
    }));
  }

  const initial = validateTransformNotes(notes, Math.max(0, operationIndex - 1));
  if (!initial.ok) return initial;
  const loss: MusicalLoss[] = [];
  const seedScopes: { operationIndex: number; scope: string }[] = [];
  for (; operationIndex < target.operations.length; operationIndex += 1) {
    const operation = target.operations[operationIndex]!;
    if (operation.op === 'generate') {
      return refuse('unsupported-operation', `generate cannot occur at operation ${operationIndex}`);
    }
    const provenance = operationProvenance({ targetIndex, variationIndex, operationIndex }, operationIndex);
    if (operation.op === 'thin' && target.write === 'merge') {
      return refuse(
        'unsupported-operation',
        `target ${targetIndex}, variation ${variationIndex}, operation ${operationIndex}: `
          + 'thin requires replace mode because merge keeps every source note',
      );
    }
    const rhythmic = operation.op === 'quantize' || operation.op === 'humanize'
      || operation.op === 'thin' || operation.op === 'densify';
    const seedScope = rhythmic && operation.op !== 'quantize' && options.seed !== undefined
      ? musicalSeedScope(options.seed, targetIndex, variationIndex, operationIndex)
      : undefined;
    if (seedScope !== undefined) seedScopes.push({ operationIndex, scope: seedScope });
    const transformed = rhythmic
      ? applyRhythmOperation(notes, operation, provenance, options, seedScope)
      : applyHarmonicOperation(notes, operation, provenance, options);
    if (!transformed.ok) {
      return refuse(
        transformed.code,
        `target ${targetIndex}, variation ${variationIndex}, operation ${operationIndex}: ${transformed.reason}`,
      );
    }
    notes = transformed.value.notes;
    loss.push(...transformed.value.loss);
  }
  const sourceValues = new Set(sourceNotes.map(noteValueKey));
  const outputNotes = target.write === 'merge' && first.op !== 'generate'
    ? notes.filter((note) => note.provenance.operationIndex !== -1
      && !sourceValues.has(noteValueKey(plainNote(note))))
    : notes;
  return accept({
    channel: target.channel,
    write: target.write,
    notes: outputNotes,
    targetIndex,
    variationIndex,
    operationIndex: target.operations.length - 1,
    loss,
    ...(seedScopes.length === 0 ? {} : { effectiveSeed: options.seed }),
    seedScopes,
  }, warnings);
}

/** Compatibility name for callers built during the harmonic session. */
export const materializeHarmonicTarget = materializeMusicalTarget;

/** Rhythm-facing name for the same ordered transform pipeline. */
export const materializeRhythmTarget = materializeMusicalTarget;

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
