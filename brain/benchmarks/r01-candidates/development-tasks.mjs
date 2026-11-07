// Development-only task definitions and independent gold outcomes; never read reserved sources.
import { readFileSync } from 'node:fs';
import { fixtures } from './fixtures.mjs';
import { normalize, add, cmp } from './common.mjs';
const clone = structuredClone;
const core = n => Object.fromEntries(['id', 'pitch', 'at', 'duration', 'velocity'].map(k => [k, n[k]]));
const corpus = JSON.parse(readFileSync(new URL('../../../context/evidence/data/r01-candidates/corpus-excerpts.json', import.meta.url)));
const real = id => ({ notes: corpus.excerpts.find(f => f.id === id).notes.map(n => core(normalize(n))) });
const source = f => Object.fromEntries(['notes', 'groups', 'musical'].filter(k => Object.hasOwn(f, k)).map(k => [k, clone(f[k])]));
export const scope = { displayMeter: [4, 4], clipLength: '64', channel: 1, timingUnit: 'quarter note' };
export const cohortScopes = { performed: scope, source: { displayMeter: [4, 4],
  timingUnit: 'quarter note', channelPolicy: 'preserve supplied per-note channels',
  timingPolicy: 'exact source values and spellings; no quantization' } };
const n = (id, pitch, at, duration, velocity) => ({ id, pitch, at, duration, velocity });

export function cardExample(cohort) {
  const notes = [n('exampleA', 62, '65/512', '3/4', 73), n('exampleB', 69, '705/512', '1/2', 85)];
  if (cohort === 'performed') return { notes };
  return { notes, groups: [{ id: 'exampleGroup', members: ['exampleA', 'exampleB'],
    label: 'authored pair', anchor: '1/8', delay: '1/512', spread: { exampleA: '0', exampleB: '5/4' },
    provenance: { kind: 'declared' } }], musical: { nominal: {
      exampleA: { at: '1/8' }, exampleB: { at: '11/8' },
    }, provenance: { kind: 'inferred', source: 'example-grid' } } };
}

export function developmentTasks() {
  const tasks = [];
  const push = (id, family, cohort, input, request, result, extra = {}) => tasks.push({
    id, version: 1, family, cohort, input, request, ...result, ...extra,
  });
  const piano = real('via-purifico-piano'), bass = real('engram-bass');
  push('read-count-piano', 'comprehension', 'performed', piano,
    'Return JSON with exactly count (total notes, including multiplicity) and before4 (notes whose onset is strictly less than 4).',
    { response: 'answer', answer: { count: piano.notes.length, before4: piano.notes.filter(n => cmp(n.at, '4') < 0).length } },
    { source: 'via-purifico-piano' });
  const earliest = bass.notes.reduce((a, b) => cmp(a.at, b.at) <= 0 ? a : b);
  push('read-earliest-bass', 'comprehension', 'performed', bass,
    'Return JSON with exactly earliestAt (the earliest onset, as reduced rational text) and pitches (the MIDI pitches at that onset, ascending, including multiplicity).',
    { response: 'answer', answer: { earliestAt: earliest.at,
      pitches: bass.notes.filter(n => cmp(n.at, earliest.at) === 0).map(n => n.pitch).sort((a, b) => a - b) } },
    { source: 'engram-bass' });
  const guitar = real('air-loom-guitar'), velocityTarget = guitar.notes[3], velocityAfter = clone(guitar);
  velocityAfter.notes[3].velocity = 91;
  push('edit-velocity-guitar', 'individual-edit', 'performed', guitar,
    `Change only the velocity of the note at ${velocityTarget.at} with pitch ${velocityTarget.pitch} to 91. Preserve all other performed state.`,
    { response: 'surface', expected: velocityAfter }, { source: 'air-loom-guitar' });
  const drums = real('engram-drums'), moved = clone(drums), moveTarget = drums.notes[0];
  moved.notes[0].at = add(moveTarget.at, '5/512');
  push('edit-onset-drums', 'individual-edit', 'performed', drums,
    `Move the note at ${moveTarget.at} with pitch ${moveTarget.pitch} later by 5/512. Preserve its duration (not its old end time), velocity and pitch, and every other note.`,
    { response: 'surface', expected: moved }, { source: 'engram-drums' });
  const authored = { notes: [n('new1', 60, '0', '1/4', 96), n('new2', 63, '3/8', '1/8', 77),
    n('new3', 67, '5/8', '3/8', 88), n('new4', 58, '11/8', '5/8', 103)] };
  push('author-four-notes', 'constrained-authoring', 'performed', { notes: [] },
    'Create exactly four notes, as (pitch, onset, duration, velocity): (60,0,1/4,96), (63,3/8,1/8,77), (67,5/8,3/8,88), (58,11/8,5/8,103). No other notes. Use valid unique IDs if the format stores them.',
    { response: 'surface', expected: authored }, { source: 'synthetic-new-authoring' });
  const countInput = { notes: [n('countA', 60, '0', '3/8', 90), n('countB', 60, '5/8', '7/8', 83),
    n('countC', 64, '1', '1/4', 72), n('countD', 60, '13/8', '1/8', 101)] };
  push('delete-one-note', 'count-change', 'performed', countInput,
    'Delete only the note at 5/8 with pitch 60. Preserve every field of every other note.',
    { response: 'surface', expected: { notes: countInput.notes.filter(n => n.id !== 'countB') } },
    { source: 'synthetic-new-count-change' });
  push('preserve-piano', 'preservation', 'performed', piano,
    'Return the complete note state unchanged, preserving multiplicity, pitch, onset, duration and velocity.',
    { response: 'surface', expected: clone(piano) }, { source: 'via-purifico-piano' });

  // Even cell spreads keep the halved result on the same 1/512 grid.
  const harmony = source(fixtures[2]);
  harmony.groups[0].delay = '1/256';
  harmony.groups[0].spread = { a: '0', b: '1/128', c: '3/128', d: '5/128' };
  const initialOnsets = ['2049/256', '2051/256', '2055/256', '2059/256'];
  harmony.notes.forEach((note, i) => { note.at = initialOnsets[i]; });
  push('read-group-timing', 'comprehension', 'source', harmony,
    'For group c7 and its member b, return JSON with exactly delay (group common delay), spread (b residual), and at (b performed onset). Use reduced rational strings.',
    { response: 'answer', answer: { delay: '1/256', spread: '1/128', at: '2051/256' } },
    { source: 'synthetic-harmony-even-spreads', diagnostics: true });
  const half = clone(harmony);
  half.groups[0].spread = { a: '0', b: '1/256', c: '3/256', d: '5/256' };
  const finalOnsets = ['2049/256', '1025/128', '513/64', '1027/128'];
  half.notes.forEach((note, i) => { note.at = finalOnsets[i]; });
  push('halve-group-spread', 'group-transform', 'source', harmony,
    'Halve every spread in group c7. Preserve its anchor, common delay, note durations/pitches/velocities, membership, orders, labels and provenance. Keep the group equation and explicit or derived onsets consistent.',
    { response: 'surface', expected: half }, { source: 'synthetic-harmony-even-spreads', diagnostics: true });
  const wider = source(fixtures[3]);
  wider.notes[0].at = '887/513';
  wider.notes[0].annotation = { origin: 'unknown', confidence: null };
  push('preserve-exact-wider', 'preservation', 'source', wider,
    'Return the entire fixture unchanged, including exact rational spellings, original note order, all channels/expression/conditional state, and opaque annotations. Do not invent musical intent.',
    { response: 'surface', expected: clone(wider) }, { source: 'synthetic-irregular-exact', diagnostics: true });
  const nominal = source(fixtures[1]);
  nominal.musical.provenance = { kind: 'inferred', source: 'development-grid-fit' };
  const nominalAfter = clone(nominal);
  nominalAfter.notes.find(n => n.id === 'b2').at = '1027/3072';
  nominalAfter.musical.nominal.b2.state = 'stale';
  push('edit-inferred-nominal', 'individual-edit', 'source', nominal,
    'Move b2 later by 1/1024. Preserve its duration and every other note. Apply the stated interpretation-staleness rules; retain nominal values and authored labels.',
    { response: 'surface', expected: nominalAfter }, { source: 'synthetic-bass-nominal', diagnostics: true });
  const unknown = { notes: [n('unknownA', 60, '1/512', '1', 80), n('unknownB', 64, '9/512', '1', 85)],
    groups: [{ id: 'unknownGroup', members: ['unknownA', 'unknownB'], label: 'loose strum', prose: 'Expressive timing; no decomposition was supplied.' }] };
  push('refuse-missing-timing', 'refusal', 'source', unknown,
    'Halve the internal spread of unknownGroup while preserving its common delay. Do not infer a decomposition from its label or prose; if the required numeric decomposition is absent, return REFUSE missing-timing.',
    { response: 'refusal', refusal: 'missing-timing' }, { source: 'synthetic-unknown-decomposition', diagnostics: true });
  const ambiguous = { notes: [n('ambA', 60, '0', '1/4', 70), n('ambB', 60, '0', '1/2', 90)] };
  push('refuse-ambiguous-selector', 'refusal', 'performed', ambiguous,
    'Change the velocity to 100 using only the selector pitch=60 and onset=0. If that selector matches more than one note, return REFUSE ambiguous-selection; do not select by ID, duration or velocity.',
    { response: 'refusal', refusal: 'ambiguous-selection' }, { source: 'synthetic-ambiguous-address', baselineExclusion: 'normalized-address collision is outside current document admission' });
  push('refuse-stale-snapshot', 'refusal', 'performed', bass,
    'The supplied snapshot revision is dev-1; the current revision is dev-2. Set all note velocities to 90 only if the snapshot is current. Otherwise return REFUSE stale-snapshot.',
    { response: 'refusal', refusal: 'stale-snapshot' }, { source: 'engram-bass', guard: { snapshotRevision: 'dev-1', currentRevision: 'dev-2' } });
  return tasks;
}
