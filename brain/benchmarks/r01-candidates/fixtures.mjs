// Authored ground truth for tasks that transcriptions cannot label reliably.
import { add, spell } from './common.mjs';
const n = (id, pitch, at, duration = '1/4', velocity = 90, extra = {}) => ({ id, pitch, at, duration, velocity, ...extra });
export const fixtures = [
  { id: 'synthetic-drums', family: 'humanized drums', meter: { numerator: 4, denominator: 4 },
    notes: [n('kick', 36, '3/512', '1/4', 110), n('hat1', 42, '3/512', '1/8', 69),
      n('hat2', 42, '171/512', '1/8', 76), n('push', 38, '501/512', '1/8', 102),
      n('flam1', 38, '1017/512', '1/16', 48), n('flam2', 38, '1027/512', '1/8', 112),
      n('fill', 45, '1543/512', '59/512', 87)],
    groups: [{ id: 'backbeat', members: ['push', 'flam1', 'flam2'], label: 'intentional push and flam',
      prose: 'Keep the push and flam spacing when moving the phrase.', provenance: { kind: 'declared', source: 'synthetic-author' } }] },
  { id: 'synthetic-bass', family: 'syncopated bass', meter: { numerator: 6, denominator: 8 },
    notes: [n('b1', 36, '0', '7/24', 94), n('b2', 39, '1/3', '5/24', 81),
      n('b3', 43, add('2/3', '-3/512'), '11/24', 101), n('b4', 34, '1499/512', '5/4', 88)],
    groups: [{ id: 'triplet', members: ['b1', 'b2', 'b3'], label: 'triplet with anticipated third',
      provenance: { kind: 'declared', source: 'synthetic-author' } }],
    musical: { nominal: { b1: { at: '0', duration: '1/3' }, b2: { at: '1/3', duration: '1/3' }, b3: { at: '2/3', duration: '1/3' } } } },
  { id: 'synthetic-harmony', family: 'dense strummed harmony', meter: { numerator: 5, denominator: 4 },
    notes: [n('a', 60, '4099/512', '2', 90), n('b', 64, '4105/512', '7/4', 84),
      n('c', 67, '257/32', '3/2', 82), n('d', 71, '515/64', '1', 78)],
    groups: [{ id: 'c7', members: ['a', 'b', 'c', 'd'], label: 'C major seventh',
      provenance: { kind: 'declared', source: 'synthetic-author' }, anchor: '8', delay: '3/512',
      spread: { a: '0', b: '6/512', c: '13/512', d: '21/512' }, performanceOrder: ['a', 'b', 'c', 'd'],
      presentationOrder: ['d', 'c', 'b', 'a'] },
    { id: 'inner', members: ['b', 'c'], label: 'inner voices', provenance: { kind: 'declared', source: 'synthetic-author' } }] },
  { id: 'synthetic-irregular', family: 'unknown intent and wider state', meter: { numerator: 4, denominator: 4 },
    notes: [n('u3', 61, '887/512', '149/512', 83), n('u1', 61, '29/512', '1007/512', 93,
      { channel: 2, mute: false, releaseVelocity: 0.4, chance: { enabled: true, value: 0.7 },
        expression: { velocitySpread: 0, gain: 1, pan: -0.2, pressure: 0.4, timbre: 0.3, transpose: 0.5 } }),
    n('u2', 61, '29/512', '233/512', 72, { channel: 3 })] },
];
export const stressFixtures = [
  { id: 'negative-pickup', notes: [n('p', 60, '-1/2')] },
  { id: 'normalized-collision', notes: [n('x', 60, '0'), n('y', 60, '1/1024')] },
  { id: 'duplicate-multiplicity', notes: [n('x', 60, '0'), n('y', 60, '0')] },
  { id: 'large-local-edit', notes: Array.from({ length: 1024 }, (_, i) => n(`n${i}`, 60, spell(BigInt(i), 4n))) },
];
