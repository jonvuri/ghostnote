import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { contentHash, EVENT_DEFAULTS, ImportCollisionError, validate,
  type Event, type Patch, type StateDocument } from '../document/index.js';
import { BindingRefusal, assessBindingProposal, checkLegacyReplay, d9MappedFields,
  SILENT_RAW_GAIN, guardAuthority, hostGain, hostOccurrence, portableGain, portableOccurrence, projectRawClip, recoverEventIds,
  resolvePartialProposal, type Authority, type FreshAuthority, type RawNote } from './ghostnote-document.js';
import { addressKey, clipMetadata, notes as notesAt, snapshotClip, CONTRACT_TAG,
  type ContentDelta, type RevisionMark, type StateEntry } from '../contract/index.js';

const fixture = JSON.parse(readFileSync(new URL('../../../spec/ghostnote-document-v1/bindings/v1/fixtures.json', import.meta.url), 'utf8')) as {
  clip: StateDocument['clips'][number]; rawNotes: RawNote[]; authority: Authority;
  cases: { id: string; claim: string }[];
};
const authority = fixture.authority;
/** A fresh read of the authority address. By default it is current. */
function freshOf(over: { mark?: Partial<RevisionMark>; sha256?: string; exists?: boolean;
  delta?: Partial<ContentDelta> } = {}): FreshAuthority {
  const ref = authority.snapshot;
  const at = { ...ref.mark, revision: ref.mark.revision + 1, ...over.mark };
  const clip = snapshotClip(ref, at.sceneEpoch);
  const entries: Record<string, StateEntry> = {
    [addressKey(clip)]: { address: clip, fidelity: 'lossy', value: { of: 'clip', exists: over.exists ?? true, lengthBeats: 4 } },
    [addressKey(clipMetadata(clip))]: { address: clipMetadata(clip), fidelity: 'exact', value: { of: 'clipMetadata', metadata: {
      name: 'Binding fixture', color: { red: 1, green: 2, blue: 3 }, lengthBeats: 4, playStartBeats: 0,
      loopEnabled: true, loopStartBeats: 0, loopEndBeats: 4 } } },
  };
  for (let channel = 0; channel < 16; channel += 1) {
    const address = notesAt(clip, channel);
    entries[addressKey(address)] = { address, fidelity: 'exact', value: { of: 'notes', notes: [] } };
  }
  return {
    read: { contract: CONTRACT_TAG, at, entries, missing: [], unreachable: [], unstable: [],
      sources: { [addressKey(clip)]: { domain: ref.source.domain, sha256: over.sha256 ?? ref.source.sha256 } } },
    delta: { since: ref.mark.contentEpoch, now: at.contentEpoch, events: [], truncated: false,
      discontinuous: false, uncovered: false, ...over.delta },
  };
}
const current = freshOf();
const seen = new Set<string>();
function bindingCase(id: string, body: () => void) {
  const item = fixture.cases.find(c => c.id === id)!;
  assert.ok(item, `Missing corpus case ${id}`);
  seen.add(id);
  test(`${id} ${item.claim}`, body);
}
function base(overrides: Partial<Event> = {}): StateDocument {
  return validate({
    format: 'ghostnote-document', version: '1.0', kind: 'snapshot',
    clips: [fixture.clip], coverage: [{ clip: fixture.clip.id, from: '0', to: '4',
      channels: Array.from({ length: 16 }, (_, i) => i + 1), fields: 'all', status: 'complete' }],
    events: [{ id: 'event1', clip: fixture.clip.id, at: '0', duration: '1', pitch: 60, velocity: 90, ...overrides }], overlays: [],
  }) as StateDocument;
}
function patch(b: StateDocument, set: Patch['update'][number]['set']): Patch {
  return { format: 'ghostnote-document', version: '1.0', kind: 'patch',
    base: { sha256: contentHash(b), ref: 'retained1' }, add: [], remove: [],
    update: [{ id: 'event1', set }], clipUpdate: [], overlayPut: [], overlayRemove: [] };
}
function refusal(code: string, body: () => unknown) {
  assert.throws(body, (e: unknown) => e instanceof BindingRefusal && e.code === code);
}
function assess(b: StateDocument, p: Patch | StateDocument) {
  return assessBindingProposal(b, p, authority, current);
}
bindingCase('B01', () => {
  const { document, report } = projectRawClip(fixture.clip, fixture.rawNotes);
  assert.deepEqual(document.events.map(e => e.channel ?? 1), [1, 16]);
  const normalized = report.notes.find(n => n.id === 'event2')!;
  assert.equal(normalized.at, '341/256');
  assert.equal(normalized.duration, '171/512');
  assert.equal(normalized.atDelta, '-1/768');
  assert.equal(normalized.durationDelta, '1/1536');
  assert.equal(report.codecLoss, 0);
  for (const channel of [-1, 16, 0.5]) refusal('channel', () => projectRawClip(fixture.clip, [{ ...fixture.rawNotes[0], channel }]));
});
bindingCase('B02', () => {
  const { document } = projectRawClip(fixture.clip, fixture.rawNotes);
  const e = document.events.find(n => n.id === 'event1')!;
  assert.deepEqual({ ...e.chance }, { enabled: false, value: 0.25 });
  assert.deepEqual({ ...e.occurrence }, { enabled: false, condition: 'bitwig:FIRST' });
  assert.deepEqual({ ...e.recurrence }, { enabled: false, length: 8, mask: 129 });
  assert.equal(e.expression?.timbre ?? EVENT_DEFAULTS.expression.timbre, 0.5);
  const signed = projectRawClip(fixture.clip, [{ ...fixture.rawNotes[0], expression: { ...fixture.rawNotes[0].expression, timbre: -0.5 } }]);
  assert.equal(signed.document.events[0].expression?.timbre, 0.25);
});
bindingCase('B03', () => {
  const { document } = projectRawClip(fixture.clip, fixture.rawNotes);
  const fields = document.coverage[0].fields;
  assert.notEqual(fields, 'all');
  assert.ok(Array.isArray(fields) && !fields.includes('articulation') && !fields.includes('repeat'));
  assert.ok(document.events.every(e => !Object.hasOwn(e, 'articulation') && !Object.hasOwn(e, 'repeat')));
});
bindingCase('B04', () => {
  const mapped = d9MappedFields(base().events[0]);
  assert.equal(mapped.channel, 0);
  assert.equal(mapped.note.releaseVelocity, 100 / 127);
  assert.equal(mapped.note.timbre, 0);
  assert.equal(mapped.note.gain, 1);
  assert.equal(d9MappedFields(base({ expression: { ...EVENT_DEFAULTS.expression, gain: 8 } }).events[0]).note.gain, 2);
  assert.equal(d9MappedFields(base({ expression: { ...EVENT_DEFAULTS.expression, gain: 0 } }).events[0]).note.gain, SILENT_RAW_GAIN);
  assert.equal(mapped.note.isChanceEnabled, false);
  assert.equal(mapped.note.isOccurrenceEnabled, false);
  assert.equal(mapped.note.isRecurrenceEnabled, false);
  assert.deepEqual(mapped.note.recurrence, [1, 1]);
  assert.deepEqual(mapped.props.find(([key]) => key === 'gain'), ['gain', 0.5]);
  assert.ok(!mapped.props.some(([key]) => key === 'pressure'));
  assert.ok(!Object.hasOwn(mapped.note, 'repeatCount'));
  assert.throws(() => d9MappedFields({ ...base().events[0], velocity: 128 }));
  assert.throws(() => d9MappedFields({ ...base().events[0], duration: '1/1024' }));
});
test('8h4g: d9MappedFields of a validated document event equals the mapping through a new validation', () => {
  const variants: Partial<Event>[] = [{}, { expression: { ...EVENT_DEFAULTS.expression, gain: 8, timbre: 0.25, transpose: -12 } },
    { mute: true, releaseVelocity: 0.25 }, { chance: { enabled: true, value: 0.5 } },
    { occurrence: { enabled: true, condition: portableOccurrence('FIRST') } }, { recurrence: { enabled: true, length: 4, mask: 5 } },
    { at: '3/2', duration: '1/512', channel: 16, pitch: 0, velocity: 1 }];
  for (const overrides of variants) {
    const documents = [base(overrides), projectRawClip(fixture.clip, fixture.rawNotes).document];
    for (const event of documents.flatMap((document) => document.events)) {
      const outcome = (validated: boolean) => {
        try { return d9MappedFields(event, { validated }); } catch (error) { return (error as BindingRefusal).code; }
      };
      assert.deepEqual(outcome(true), outcome(false), JSON.stringify(overrides));
    }
  }
});
bindingCase('B05', () => {
  const b = base();
  refusal('pressure', () => assess(b, patch(b, { expression: { ...EVENT_DEFAULTS.expression, pressure: 0.2 } })));
  refusal('occurrence', () => assess(b, patch(b, { occurrence: { enabled: true, condition: 'author:some-condition' } })));
  refusal('recurrence', () => assess(b, patch(b, { recurrence: { enabled: false, length: 9, mask: 1 } })));
  refusal('repeat', () => assess(b, patch(b, { repeat: { ...EVENT_DEFAULTS.repeat, count: 2 } })));
  refusal('articulation', () => assess(b, patch(b, { articulation: 'staccato' })));
  // The host range is the portable range (raw 2 is portable 8); the codec refuses a larger value.
  assert.doesNotThrow(() => assess(b, patch(b, { expression: { ...EVENT_DEFAULTS.expression, gain: 8 } })));
  assert.throws(() => assess(b, patch(b, { expression: { ...EVENT_DEFAULTS.expression, gain: 8.5 } })));
  refusal('transpose', () => assess(b, patch(b, { expression: { ...EVENT_DEFAULTS.expression, transpose: 97 } })));
  assert.equal(d9MappedFields(base({ expression: { ...EVENT_DEFAULTS.expression, timbre: 0.25 } }).events[0]).note.timbre, -0.5);
  for (const host of ['ALWAYS', 'FIRST', 'NOT_PREV_KEY', 'FILL']) assert.equal(hostOccurrence(portableOccurrence(host)), host);
  refusal('occurrence', () => portableOccurrence('UNRECOGNIZED'));
  refusal('occurrence', () => hostOccurrence('bitwig:ALWAYS'));
  refusal('repeat', () => assess(b, patch(b, { at: '2' })));
  const range = patch(b, {}); range.update = []; range.clipUpdate = [{ id: fixture.clip.id, set: { playRange: { from: '0', to: '3' } } }];
  refusal('play-range', () => assess(b, range));
  const containers = structuredClone(b); containers.kind = 'desired'; containers.base = { sha256: contentHash(b) };
  containers.clips = []; containers.coverage = []; containers.events = [];
  refusal('clip-inventory', () => assess(b, containers));
});
bindingCase('B06', () => {
  const b = base({ releaseVelocity: 0.7, expression: { ...EVENT_DEFAULTS.expression, pan: 0.3 }, chance: { enabled: false, value: 0.2 } });
  const sparse = assess(b, patch(b, { velocity: 91 })).document.events[0];
  assert.equal(sparse.releaseVelocity, 0.7);
  assert.equal(sparse.expression?.pan, 0.3);
  assert.equal(sparse.chance?.value, 0.2);
  const desired = base();
  desired.kind = 'desired'; desired.base = { sha256: contentHash(b) };
  const complete = assess(b, desired).document.events[0];
  assert.equal(complete.releaseVelocity ?? EVENT_DEFAULTS.releaseVelocity, 100 / 127);
  assert.equal(complete.expression?.pan ?? 0, 0);
  assert.equal(complete.chance?.value ?? 1, 1);
  const reset = assess(b, patch(b, { releaseVelocity: null })).document.events[0];
  assert.equal(reset.releaseVelocity ?? EVENT_DEFAULTS.releaseVelocity, 100 / 127);
});
bindingCase('B07', () => {
  const b = base(); b.events.push({ ...b.events[0], id: 'event2', at: '1' });
  assert.doesNotThrow(() => assess(b, patch(b, { velocity: 91 })));
  refusal('overlap', () => assess(b, patch(b, { duration: '513/512' })));
  const otherChannel = structuredClone(b); otherChannel.events[1].channel = 2;
  assert.doesNotThrow(() => assess(otherChannel, patch(otherChannel, { duration: '2' })));
});
bindingCase('B08', () => {
  const a = fixture.rawNotes[0];
  assert.throws(() => projectRawClip(fixture.clip, [a, { ...a, id: 'event2', at: '1/1024' }]), ImportCollisionError);
});
bindingCase('B09', () => {
  const { document } = projectRawClip(fixture.clip, fixture.rawNotes);
  assert.throws(() => assess(document, patch(document, { velocity: 91 })), /pure application requires full coverage/);
});
bindingCase('B10', () => {
  const original = projectRawClip(fixture.clip, fixture.rawNotes).document;
  const full = structuredClone(original);
  full.coverage[0].fields = 'all';
  // The caller supplies these declarations. The resolver does not infer them.
  for (const e of full.events) { e.articulation = 'normal'; e.repeat = { ...EVENT_DEFAULTS.repeat }; }
  const input = { original, freshProjection: structuredClone(original), full,
    proposal: patch(original, { velocity: 91 }), expected: authority, fresh: current,
    resolution: { ref: 'retained1', declaredFields: full.events.map(e => ({ event: e.id,
      fields: ['articulation', 'repeat'] as ('articulation' | 'repeat')[] })), hostPreservationProved: true } };
  const result = resolvePartialProposal(input);
  assert.equal(result.document.events.find(e => e.id === 'event1')!.velocity, 91);
  assert.equal(result.guard.originalHash, contentHash(original));
  assert.equal(result.guard.fullHash, contentHash(full));
  assert.equal(input.proposal.base.sha256, contentHash(original));
  const noProof = structuredClone(input); noProof.resolution.hostPreservationProved = false;
  refusal('resolution', () => resolvePartialProposal(noProof));
  const noDeclaration = structuredClone(input); noDeclaration.resolution.declaredFields = [];
  refusal('resolution', () => resolvePartialProposal(noDeclaration));
  const changedFresh = structuredClone(input); changedFresh.freshProjection.events[0].velocity = 92;
  refusal('base', () => resolvePartialProposal(changedFresh));
  const changedFull = structuredClone(input); changedFull.full.events[0].velocity = 92;
  refusal('base', () => resolvePartialProposal(changedFull));
  const extraEvent = structuredClone(input); extraEvent.full.events.push({ ...extraEvent.full.events[0], id: 'extra', at: '3' });
  extraEvent.resolution.declaredFields.push({ event: 'extra', fields: ['articulation', 'repeat'] });
  refusal('base', () => resolvePartialProposal(extraEvent));
  const partialRange = structuredClone(input); partialRange.original.coverage[0].to = '2';
  refusal('resolution', () => resolvePartialProposal(partialRange));
  const partialChannels = structuredClone(input); partialChannels.original.coverage[0].channels = [1];
  refusal('resolution', () => resolvePartialProposal(partialChannels));
  const incomplete = structuredClone(input); incomplete.full.coverage[0].fields = original.coverage[0].fields;
  incomplete.full.events.forEach(e => { delete e.articulation; delete e.repeat; });
  assert.throws(() => resolvePartialProposal(incomplete), /pure application requires full coverage/);
});
bindingCase('B11', () => {
  const b = base(), p = patch(b, { velocity: 91 });
  const mark = authority.snapshot.mark;
  const slotEvent = { seq: mark.contentEpoch + 1, channelId: 'track1', trackIndex: 0, slotIndex: 0, filled: true };
  const cases: [string, FreshAuthority][] = [
    ['incomparable', freshOf({ mark: { generation: 'generation2' } })],
    ['incomparable', freshOf({ mark: { project: 'project2' } })],
    ['uncovered', freshOf({ mark: { window: { ...mark.window, scenes: { count: 200, bankSize: 128 } } } })],
    ['identity-changed', freshOf({ mark: { sceneEpoch: 2 } })],
    ['identity-changed', freshOf({ mark: { contentEpoch: mark.contentEpoch + 1 },
      delta: { now: mark.contentEpoch + 1, events: [slotEvent] } })],
    ['identity-changed', freshOf({ delta: { truncated: true } })],
    ['identity-changed', { ...freshOf(), after: { ...mark, revision: mark.revision + 1, sceneEpoch: mark.sceneEpoch + 1 } }],
    ['absent', freshOf({ exists: false })],
    ['stale', freshOf({ sha256: 'f'.repeat(64) })],
  ];
  for (const [verdict, fresh] of cases) {
    assert.throws(() => assessBindingProposal(b, p, authority, fresh),
      (e: unknown) => e instanceof BindingRefusal && e.code === 'authority' && e.message.endsWith(verdict));
  }
  const freshBase = structuredClone(b); freshBase.events[0].velocity = 92;
  refusal('base', () => assessBindingProposal(freshBase, p, authority, current));
  assert.equal(guardAuthority(authority, current).verdict, 'current');
  const invalidRow = { snapshot: { ...authority.snapshot, row: 0.5 } };
  refusal('authority', () => guardAuthority(invalidRow, current));
  const invalidSource = { snapshot: { ...authority.snapshot, source: { ...authority.snapshot.source, sha256: 'raw-source1' } } };
  refusal('authority', () => guardAuthority(invalidSource, current));
  refusal('authority', () => guardAuthority({} as Authority, current));
  const noSource = freshOf(); delete (noSource.read as { sources?: unknown }).sources;
  refusal('authority', () => guardAuthority(authority, noSource));
});
bindingCase('B12', () => {
  assert.throws(() => checkLegacyReplay([{ startBeats: 0, durationBeats: 0.0003, pitch: 60, velocity: 90 }]), /grid|timing/i);
  assert.doesNotThrow(() => d9MappedFields(base({ duration: '1/512' }).events[0]));
  refusal('timing', () => d9MappedFields({ ...base().events[0], at: '9007199254740993' }));
});
bindingCase('B13', () => {
  assert.deepEqual(recoverEventIds([{ oldId: 'a', candidates: ['x'] }], true), { reused: { a: 'x' }, remint: [] });
  assert.deepEqual(recoverEventIds([{ oldId: 'a', candidates: ['x'] }], false), { reused: {}, remint: ['a'] });
  assert.deepEqual(recoverEventIds([{ oldId: 'a', candidates: ['x', 'y'] }], true), { reused: {}, remint: ['a'] });
  assert.deepEqual(recoverEventIds([{ oldId: 'a', candidates: ['x'] }, { oldId: 'b', candidates: ['x'] }], true), { reused: {}, remint: ['a', 'b'] });
  refusal('identity', () => recoverEventIds([{ oldId: 'a', candidates: ['x'] }, { oldId: 'a', candidates: ['y'] }], true));
  const special = recoverEventIds([{ oldId: 'constructor', candidates: ['x'] }, { oldId: '__proto__', candidates: ['y'] }], true);
  assert.equal(Object.getPrototypeOf(special.reused), Object.prototype);
  assert.equal(Object.getOwnPropertyDescriptor(special.reused, '__proto__')?.value, 'y');
  assert.equal(special.reused.constructor, 'x');
});
bindingCase('B14', () => {
  const b = base({ expression: { ...EVENT_DEFAULTS.expression, pressure: 0.2 } });
  const result = assess(b, patch(b, { velocity: 91 }));
  assert.equal(result.document.events[0].expression?.pressure, 0.2);
  assert.doesNotThrow(() => assess(b, patch(b, { expression: { ...EVENT_DEFAULTS.expression, pressure: 0.2, pan: 0.3 } })));
  refusal('pressure', () => assess(b, patch(b, { expression: null })));
  refusal('pressure', () => assess(b, patch(b, { at: '2' })));
  const remove = patch(b, {}); remove.update = []; remove.remove = ['event1'];
  refusal('pressure', () => assess(b, remove));
});
bindingCase('B15', () => {
  // E245: raw r shows 60*log10(r) dB. The live pairs: -6 dB, 0 dB, +6 dB, -120 dB, and the raw maximum.
  for (const [raw, portable] of [[0.7943282347242815, 0.5011872336272722], [1, 1], [1.2589254117941673, 1.99526231496888],
    [0.009999999999999997, 9.99999999999999e-7], [2, 8], [0.5, 0.125]] as const) {
    assert.equal(portableGain(raw), portable);
    assert.equal(hostGain(portable), raw);
  }
  // The shortest portable value with the same cube root: a written value with six decimals reads back unchanged.
  for (let thousandths = 1; thousandths <= 8000; thousandths += 1) {
    const portable = thousandths / 1000;
    assert.equal(portableGain(hostGain(portable)), portable);
  }
  for (let raw = 0.01; raw <= 2; raw += 0.000917) assert.equal(hostGain(portableGain(raw)), raw);
  assert.equal(portableGain(0), 1, 'raw 0 is a new note at 0 dB');
  assert.equal(portableGain(SILENT_RAW_GAIN), 0, 'the silent write reads back as portable 0');
  assert.equal(hostGain(0), SILENT_RAW_GAIN);
  const raw = { ...fixture.rawNotes[0], expression: { ...fixture.rawNotes[0].expression, gain: 0 } };
  assert.equal(projectRawClip(fixture.clip, [raw]).document.events[0].expression, undefined);
});
bindingCase('B16', () => {
  const event2 = projectRawClip(fixture.clip, fixture.rawNotes).document.events.find(e => e.id === 'event2')!;
  assert.equal(event2.chance, undefined, 'enabled chance at value 1 is the default');
  assert.equal(event2.occurrence, undefined, 'enabled ALWAYS is the default');
  assert.deepEqual({ ...event2.recurrence }, { enabled: true, length: 4, mask: 5 });
  const host = { ...fixture.rawNotes[0], chance: { enabled: true, value: 1 }, occurrence: { enabled: true, condition: 'ALWAYS' },
    recurrence: { enabled: true, length: 1, mask: 1 } };
  const e = projectRawClip(fixture.clip, [host]).document.events[0];
  assert.deepEqual([e.chance, e.occurrence, e.recurrence], [undefined, undefined, undefined]);
  const active = projectRawClip(fixture.clip, [{ ...host, chance: { enabled: true, value: 0.5 },
    recurrence: { enabled: true, length: 1, mask: 0 } }]).document.events[0];
  assert.deepEqual({ ...active.chance }, { enabled: true, value: 0.5 });
  assert.deepEqual({ ...active.recurrence }, { enabled: true, length: 1, mask: 0 });
  const disabled = projectRawClip(fixture.clip, [fixture.rawNotes[0]]).document.events[0];
  assert.deepEqual({ ...disabled.chance }, { enabled: false, value: 0.25 }, 'a disabled nondefault value stays');
});
bindingCase('B17', () => {
  // A drawn Bitwig note (E245): release 100/127, gain 0, timbre 0, and the three flags enabled. It has no WITH values.
  const drawn: RawNote = { id: 'drawn', channel: 0, at: '0', duration: '1/4', pitch: 60, velocity: 100, mute: false,
    releaseVelocity: 0.7874015748031497,
    expression: { velocitySpread: 0, gain: 0, pan: 0, pressure: 0, timbre: 0, transpose: 0 },
    chance: { enabled: true, value: 1 }, occurrence: { enabled: true, condition: 'ALWAYS' },
    recurrence: { enabled: true, length: 1, mask: 1 } };
  const { document } = projectRawClip(fixture.clip, [drawn]);
  assert.deepEqual(Object.keys(document.events[0]).sort(), ['at', 'clip', 'duration', 'id', 'pitch', 'velocity']);
  assert.equal(EVENT_DEFAULTS.releaseVelocity, 0.7874015748031497);
  const other = projectRawClip(fixture.clip, [{ ...drawn, releaseVelocity: 64 / 127 }]).document.events[0];
  assert.equal(other.releaseVelocity, 64 / 127, 'a nondefault release velocity stays explicit and exact');
});
bindingCase('B18', () => {
  const b = base();
  const moved = patch(b, { pitch: 62, at: '2' });
  const remove = patch(b, {}); remove.update = []; remove.remove = ['event1'];
  // A pure fixture has no raw state: reconstruction and removal refuse for repeat.
  refusal('repeat', () => assess(b, moved));
  refusal('repeat', () => assess(b, remove));
  // The live writer carries the raw controls (D36): both apply.
  const raw = { rawReplay: true };
  assert.equal(assessBindingProposal(b, moved, authority, current, raw).document.events[0]!.pitch, 62);
  assert.deepEqual(assessBindingProposal(b, remove, authority, current, raw).report.removed, ['event1']);
  // A portable repeat change and pressure still refuse.
  refusal('repeat', () => assessBindingProposal(b, patch(b, { repeat: { ...EVENT_DEFAULTS.repeat, count: 2 } }),
    authority, current, raw));
  const pressed = base({ expression: { ...EVENT_DEFAULTS.expression, pressure: 0.2 } });
  refusal('pressure', () => assessBindingProposal(pressed, patch(pressed, { at: '2' }), authority, current, raw));
  const pressedRemove = patch(pressed, {}); pressedRemove.update = []; pressedRemove.remove = ['event1'];
  refusal('pressure', () => assessBindingProposal(pressed, pressedRemove, authority, current, raw));
});
test('The corpus case inventory is complete', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../../spec/ghostnote-document-v1/bindings/v1/manifest.json', import.meta.url), 'utf8'));
  const bytes = readFileSync(new URL('../../../spec/ghostnote-document-v1/bindings/v1/fixtures.json', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256);
  assert.deepEqual(manifest.cases, fixture.cases.map(c => c.id));
  assert.equal(seen.size, fixture.cases.length);
  assert.deepEqual([...seen], fixture.cases.map(c => c.id));
});
