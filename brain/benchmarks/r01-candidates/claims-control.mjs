// Current optional-claim baseline, limited to explicit synthetic declarations.
// This is not a conversion of every structured candidate field or lifecycle rule.
import * as gn from '../../src/document/index.ts';
import { document, add, mul, rational, spell } from './common.mjs';
const subtract = (a, b) => add(a, mul(b, '-1'));
export function claimedDocument(fixture, mode) {
  if (!['selective', 'timing-rich'].includes(mode)) throw new Error('unknown claims control');
  const doc = document(fixture), overlays = [];
  const provenance = { kind: 'declared', source: 'r01-synthetic-author', method: 'explicit-fixture' };
  for (const group of fixture.groups ?? []) overlays.push({ id: `group-${group.id}`, type: 'role', state: 'current', basis: '0'.repeat(64), provenance,
    depends: { events: group.members.map(id => ({ id, fields: ['clip', 'pitch', 'at', 'duration'] })),
      clips: [{ id: 'clip', fields: ['length'] }], overlays: [], membership: ['clip'] },
    data: { clip: 'clip', events: group.members, label: group.label ?? group.id } });
  if (mode === 'timing-rich') for (const note of fixture.notes) {
    const group = (fixture.groups ?? []).find(g => g.spread && Object.hasOwn(g.spread, note.id));
    const nominal = fixture.musical?.nominal?.[note.id] ?? (group ? { at: group.anchor, duration: note.duration } : null);
    if (!nominal) continue; // No inference of nominal timing from an irregular source.
    const event = doc.events.find(n => n.id === note.id), [, denominator] = rational(nominal.at);
    const depends = { events: [{ id: note.id, fields: ['clip', 'at', 'duration'] }], clips: [], overlays: [], membership: [] };
    const nominalId = `nom-${note.id}`, phase = group?.delay ?? '0';
    overlays.push({ id: nominalId, type: 'nominal', state: 'current', basis: '0'.repeat(64), provenance, depends,
      data: { event: note.id, at: nominal.at, duration: nominal.duration, division: spell(1n, denominator) } });
    overlays.push({ id: `groove-${note.id}`, type: 'groove', state: 'current', basis: '0'.repeat(64), provenance,
      depends: { ...depends, overlays: [nominalId] }, data: { event: note.id, nominal: nominalId, intent: 'resolved',
        phase, template: '0', cross: '0', local: subtract(subtract(note.at, nominal.at), phase), unassigned: '0',
        durationIntent: subtract(note.duration, nominal.duration), durationUnassigned: '0',
        sourceAt: note.at, sourceDuration: note.duration, atDelta: subtract(event.at, note.at), durationDelta: subtract(event.duration, note.duration) } });
  }
  return gn.sealOverlays({ ...doc, overlays });
}
