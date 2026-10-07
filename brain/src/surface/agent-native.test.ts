import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { z } from 'zod';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { control } from '../adapters/fake/control.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { LauncherClipReadError, launcherClipCells } from '../bindings/launcher-clip-document.js';
import {
  CollapsedGroupRowError, GroupSlotError, StaleAddressError, addressKey, clip, notes, scene, slot, track,
  type ClipSnapshot, type NoteRecord,
} from '../contract/index.js';
import { contentHash, convert, parse, type StateDocument } from '../document/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { CORE_REFERENCE, MODEL_REFERENCE } from './agent-native.js';
import {
  FAILURE_CODES, REFUSAL_CODES, VERDICT_CODES, classifyError,
} from './agent-native-result.js';
import {
  AGENT_NATIVE_TOOL_PROFILE, ANNOTATIONS, STABLE_TOOL_PROFILE, TOOLS, callTool, toolsForProfile,
} from './tools.js';
import { workspaceOf } from './workspace.js';

/**
 * A note as the cold reader reports a new host note (E245): release velocity 100/127 and the enable flags are
 * always present, and the flags are on.
 */
const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, releaseVelocity: 100 / 127,
  isChanceEnabled: true, isOccurrenceEnabled: true, isRecurrenceEnabled: true, isRepeatEnabled: true,
  ...over,
});

async function fixture(options: { registry?: IdentityRegistry; scenes?: number } = {}) {
  const fake = new FakeAdapter({ tracks: ['gn-agent', 'gn-other'], scenes: options.scenes ?? 4 });
  const [trackState, other] = await fake.tracks();
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter: fake,
    executor: new Executor(fake, { newId: () => `agent-native-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }),
    observationStore: new FakeObservationStore(),
    ...(options.registry === undefined ? {} : { documents: options.registry }),
  });
  const target = async (row: number) => clip(slot(track(trackState!.channelId), scene(row, (await fake.revision()).sceneEpoch)));
  /** Create a clip, then put raw host notes into the fake project, as an operator edit would. */
  const write = async (row: number, notesByChannel: Record<number, NoteRecord[]>, lengthBeats = 4) => {
    const address = await target(row);
    await workspace.apply([{ op: 'clip.create', slot: address.slot, lengthBeats }]);
    edit(row, notesByChannel);
    return address;
  };
  const edit = (row: number, notesByChannel: Record<number, NoteRecord[]>) => {
    const fakeSlot = fake.model.visibleTracks()[0]!.slots[row]!;
    fakeSlot.notes.clear();
    for (const [channel, notes] of Object.entries(notesByChannel)) {
      for (const item of notes) fakeSlot.notes.set(`${channel}:${item.pitch}:${item.startBeats}`, item);
    }
    fake.model.revision += 1;
  };
  const read = (args: Record<string, unknown>) =>
    callTool(workspace, 'read_launcher_clip', { trackId: trackState!.channelId, row: 0, ...args },
      AGENT_NATIVE_TOOL_PROFILE) as Promise<Read>;
  const check = (refs: string[], format?: 'fields' | 'json') =>
    callTool(workspace, 'check_launcher_clips', { refs, ...(format === undefined ? {} : { format }) },
      AGENT_NATIVE_TOOL_PROFILE) as Promise<Check>;
  return { fake, workspace, trackState: trackState!, other: other!, target, write, edit, read, check };
}

interface Read {
  schema: string;
  target: { trackId: string; row: number; trackName?: string };
  coverage: Record<string, unknown>;
  authority: { base: { sha256: string; ref: string } | null; identity?: string; retainedIds?: number;
    mintedIds?: number; retiredRefs?: { ref: string; reason: string }[] };
  data: { occupancy: string; format?: string; document?: unknown; loss?: Record<string, unknown> };
  warnings: { code: string }[];
  reference?: string;
  diagnostic?: Record<string, unknown>;
  failure?: { code: string; stage: string; effects: unknown[] };
  message?: string;
  retryWhen?: string;
  detail?: Record<string, unknown>;
}
interface CheckItem {
  ref: string; verdict?: string; code?: string; retired?: boolean;
  base?: { ref: string; sha256: string }; document?: unknown; retainedIds?: number; mintedIds?: number;
}
interface Check { data: { results: CheckItem[] }; failure?: unknown }

/** The 1/512-beat cell of an exact rational onset. */
const cellOf = (at: string): number => {
  const [n, d = '1'] = at.split('/');
  return Number(BigInt(n!) * 512n / BigInt(d));
};
const plain = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

function documentOf(result: Read): StateDocument {
  assert.equal(result.failure, undefined, JSON.stringify(result));
  return parse(result.data.document as string, 'fields') as StateDocument;
}

/** Codec corpus checks: FIELDS and JSON parse, convert, and hash to the base. */
async function assertCodec(fx: Awaited<ReturnType<typeof fixture>>, result: Read) {
  const fields = result.data.document as string;
  const document = documentOf(result);
  assert.equal(contentHash(document), result.authority.base!.sha256);
  const json = await fx.read({ format: 'json' });
  assert.equal(json.data.format, 'json');
  assert.equal(json.authority.base!.ref, result.authority.base!.ref, 'a JSON read of the same clip keeps the ref');
  assert.equal(convert(fields, 'fields', 'json'), JSON.stringify(json.data.document));
  assert.equal(convert(JSON.stringify(json.data.document), 'json', 'fields'), fields);
  return document;
}

/** An independent raw read of all 16 channels, outside the tool. */
async function independentRaw(fx: Awaited<ReturnType<typeof fixture>>, row = 0): Promise<Record<number, NoteRecord[]>> {
  const address = await fx.target(row);
  const read = await fx.fake.read(Array.from({ length: 16 }, (_, channel) => notes(address, channel)));
  return Object.fromEntries(Array.from({ length: 16 }, (_, channel) => {
    const value = read.entries[addressKey(notes(address, channel))]!.value;
    return [channel, value.of === 'notes' ? [...value.notes] : []];
  }).filter(([, items]) => (items as NoteRecord[]).length > 0));
}

/** Independent agreement: each event equals the independently read host note at its cell. */
async function assertAgrees(fx: Awaited<ReturnType<typeof fixture>>, document: StateDocument) {
  const raw = await independentRaw(fx);
  const expected = Object.entries(raw).flatMap(([channel, notes]) => notes.map((item) => ({ channel: Number(channel), item })));
  assert.equal(document.events.length, expected.length);
  for (const { channel, item } of expected) {
    const cell = Math.floor(item.startBeats * 512);
    const event = document.events.find((e) => (e.channel ?? 1) === channel + 1 && e.pitch === item.pitch
      && cellOf(e.at) === cell);
    assert.ok(event !== undefined, `no event for channel ${channel} pitch ${item.pitch} cell ${cell}`);
    assert.equal(event.velocity, item.velocity);
    assert.equal(event.mute ?? false, item.isMuted === true);
    assert.equal(event.releaseVelocity ?? 100 / 127, item.releaseVelocity);
    assert.equal(event.expression?.pressure ?? 0, item.pressure ?? 0);
    // E245: raw 0 is unity; otherwise the cube root of the portable gain is the raw gain.
    const gain = event.expression?.gain ?? 1;
    assert.ok((item.gain ?? 0) === 0 ? gain === 1 : Math.cbrt(gain) === item.gain, `gain ${gain} for raw ${item.gain}`);
    assert.equal(event.expression?.pan ?? 0, item.pan ?? 0);
    assert.equal(event.expression?.timbre ?? 0.5, ((item.timbre ?? 0) + 1) / 2);
    // An enabled control with a neutral value is the portable default.
    assert.deepEqual(plain(event.chance ?? { enabled: false, value: 1 }),
      { enabled: item.isChanceEnabled === true && (item.chance ?? 1) !== 1, value: item.chance ?? 1 });
    assert.deepEqual(plain(event.occurrence ?? { enabled: false, condition: 'always' }), {
      enabled: item.isOccurrenceEnabled === true && (item.occurrence ?? 'ALWAYS') !== 'ALWAYS',
      condition: (item.occurrence ?? 'ALWAYS') === 'ALWAYS' ? 'always' : `bitwig:${item.occurrence}` });
    const [length, mask] = item.recurrence ?? [1, 1];
    assert.deepEqual(plain(event.recurrence ?? { enabled: false, length: 1, mask: 1 }),
      { enabled: item.isRecurrenceEnabled === true && !(length === 1 && mask === 1), length, mask });
  }
}

// --- profile -------------------------------------------------------------------

test('8h4b profile: stable-v1 registration is byte-equal; agent-native-v1 adds three tools after it', () => {
  const stable = toolsForProfile(STABLE_TOOL_PROFILE);
  assert.equal(stable, TOOLS);
  const registration = stable.map((spec) => ({
    name: spec.name, title: spec.title, description: spec.description,
    inputSchema: z.toJSONSchema(spec.inputValidator ?? z.object(spec.inputSchema), { target: 'draft-7', io: 'input' }),
    annotations: ANNOTATIONS[spec.kind],
  }));
  assert.equal(registration.length, 53);
  assert.equal(createHash('sha256').update(JSON.stringify(registration)).digest('hex'),
    'c16f2a9bb40cc7c8c207505320295d196a1cdbc10703b0bd1cb9ad79ba971d5f', 'stable-v1 registration changed');
  const native = toolsForProfile(AGENT_NATIVE_TOOL_PROFILE);
  assert.deepEqual(native.slice(0, TOOLS.length), [...TOOLS]);
  assert.deepEqual(native.slice(TOOLS.length).map((spec) => [spec.name, spec.kind]),
    [['read_launcher_clip', 'read'], ['check_launcher_clips', 'read'], ['edit_launcher_clip', 'write']]);
  for (const spec of native.slice(TOOLS.length)) {
    assert.deepEqual(spec.emits, spec.kind === 'read' ? []
      : ['clip.update', 'note.remove', 'note.insert', 'note.clear', 'note.write']);
    assert.doesNotMatch(spec.description, /cursor|observer|stash|take\b|compiler|module/i);
  }
});

test('8h4b reference: the read description carries the Core section of the identified model reference', () => {
  const spec = new URL('../../../spec/ghostnote-document-v1/', import.meta.url);
  const identity = JSON.parse(readFileSync(new URL('MODEL-REFERENCE.identity.json', spec), 'utf8'));
  const source = readFileSync(new URL('MODEL-REFERENCE.md', spec), 'utf8');
  assert.equal(MODEL_REFERENCE.revision, identity.referenceRevision);
  assert.equal(MODEL_REFERENCE.sha256, identity.sha256);
  assert.equal(createHash('sha256').update(source).digest('hex'), identity.sha256);
  const read = toolsForProfile(AGENT_NATIVE_TOOL_PROFILE).find((item) => item.name === 'read_launcher_clip')!;
  assert.ok(source.includes(CORE_REFERENCE));
  assert.ok(read.description.endsWith(CORE_REFERENCE));
  assert.match(read.description, new RegExp(`revision ${identity.referenceRevision} \\(sha256 ${identity.sha256.slice(0, 12)}\\)`));
});

// --- result vocabulary -----------------------------------------------------------

test('8h4b vocabulary: each D32 verdict and each 8h4a refusal maps to one stable code', () => {
  assert.equal(new Set(FAILURE_CODES).size, FAILURE_CODES.length);
  for (const code of ['empty', 'current'] as const) assert.ok(!(FAILURE_CODES as readonly string[]).includes(code));
  for (const code of ['absent', 'unavailable', 'partial', 'unhealthy', 'outside-limit']) {
    assert.ok((FAILURE_CODES as readonly string[]).includes(code), code);
  }
  assert.deepEqual(VERDICT_CODES, {
    stale: 'stale', 'identity-changed': 'identity-changed', absent: 'absent',
    incomparable: 'incomparable', uncovered: 'outside-limit',
  });
  assert.deepEqual(REFUSAL_CODES, { 'group-slot': 'group-slot', 'collapsed-group-row': 'collapsed-group-row' });
  const address = clip(slot(track('t'), scene(1, 0)));
  assert.equal(classifyError(new GroupSlotError(address, { channelId: 't' })).code, 'group-slot');
  assert.equal(classifyError(new CollapsedGroupRowError(address, 0)).code, 'collapsed-group-row');
  assert.equal(classifyError(new StaleAddressError(address, 0, 1)).code, 'stale-address');
  assert.equal(classifyError(new Error('anything')).code, 'internal');
  assert.doesNotMatch(classifyError(new GroupSlotError(address, { channelId: 't' })).message, /mirror the clips of its child tracks and are not/);
});

// --- read fixtures -----------------------------------------------------------------

test('8h4b read: an empty slot is empty occupancy, not an empty clip', async () => {
  const fx = await fixture();
  const result = await fx.read({ row: 1 });
  assert.equal(result.failure, undefined);
  assert.equal(result.data.occupancy, 'empty');
  assert.equal(result.data.document, undefined);
  assert.equal(result.authority.base, null);
  assert.equal(result.target.trackName, 'gn-agent');
});

test('8h4b read: a typical clip passes the codec corpus and agrees with the raw notes', async () => {
  const fx = await fixture();
  const raw = { 0: Array.from({ length: 16 }, (_, index) => note({
    startBeats: index / 4, pitch: 48 + (index % 12), velocity: 60 + index, durationBeats: 1 / 4,
  })) };
  await fx.write(0, raw);
  const result = await fx.read({});
  assert.equal(result.schema, 'ghostnote-launcher-clip-read/1');
  assert.equal(result.data.occupancy, 'occupied');
  assert.equal(result.authority.identity, 'new');
  assert.equal(result.authority.mintedIds, 16);
  // 8h4b2: the wrapper has only the status; the document COVERAGE record and the description state the rest.
  assert.deepEqual(result.coverage, { status: 'complete' });
  assert.equal(result.data.loss, undefined, 'a read that moved no timing has no loss block');
  const description = toolsForProfile(AGENT_NATIVE_TOOL_PROFILE).find((spec) => spec.name === 'read_launcher_clip')!.description;
  assert.match(description, /articulation and repeat are not covered/);
  assert.match(description, /playRange is not covered/);
  const document = await assertCodec(fx, result);
  await assertAgrees(fx, document);
  assert.equal(document.clips[0]!.length, '4');
  assert.equal(document.coverage[0]!.status, 'complete');
  assert.deepEqual(result.warnings, []);
  assert.equal(result.diagnostic, undefined);
  assert.ok(!(result.data.document as string).includes(' WITH '), 'a host-default note has no WITH object');
});

test('8h4b read: all 16 channels, disabled controls, and pressure stay in the document', async () => {
  const fx = await fixture();
  const raw: Record<number, NoteRecord[]> = Object.fromEntries(Array.from({ length: 16 }, (_, channel) =>
    [channel, [note({ startBeats: channel / 8, pitch: 40 + channel })]]));
  raw[3] = [note({ startBeats: 3 / 8, pitch: 43, chance: 0.25, isChanceEnabled: false, occurrence: 'FILL',
    isOccurrenceEnabled: false, recurrence: [3, 5], isRecurrenceEnabled: false, isMuted: true })];
  // The fake stores the setter value of gain; the host reports twice that value (E24).
  raw[7] = [note({ startBeats: 7 / 8, pitch: 47, pressure: 0.4, timbre: -0.5, gain: 0.7, pan: -0.25 })];
  await fx.write(0, raw);
  const result = await fx.read({});
  const document = await assertCodec(fx, result);
  await assertAgrees(fx, document);
  assert.deepEqual([...new Set(document.events.map((item) => item.channel ?? 1))].sort((a, b) => a! - b!),
    Array.from({ length: 16 }, (_, index) => index + 1));
  const disabled = document.events.find((item) => item.pitch === 43)!;
  assert.deepEqual(plain(disabled.chance), { enabled: false, value: 0.25 });
  assert.deepEqual(plain(disabled.occurrence), { enabled: false, condition: 'bitwig:FILL' });
  assert.deepEqual(plain(disabled.recurrence), { enabled: false, length: 3, mask: 5 });
  assert.equal(disabled.mute, true);
  const pressed = document.events.find((item) => item.pitch === 47)!;
  const { gain, ...expression } = plain(pressed.expression) as Record<string, number>;
  assert.deepEqual(expression, { velocitySpread: 0, pan: -0.25, pressure: 0.4, timbre: 0.25, transpose: 0 });
  assert.equal(Math.cbrt(gain!), 1.4, 'raw gain 1.4 projects to its cube');
});

test('8h4b read: finer-than-cell onsets floor to the cell plane and report D23 loss', async () => {
  const fx = await fixture();
  const raw = { 2: [note({ startBeats: 1 / 768, pitch: 60, durationBeats: 1 / 3 }), note({ startBeats: 1, pitch: 62 })] };
  await fx.write(0, raw);
  const result = await fx.read({});
  const document = await assertCodec(fx, result);
  assert.deepEqual(document.events.map((item) => [item.at, item.duration]), [['0', '171/512'], ['1', '1']]);
  // The reader reports the cell; displacement before the read is not observable (D23).
  assert.equal(result.data.loss!['onsetsMoved'], 0);
  assert.equal(result.data.loss!['sourceOnsets'], 'cell-observed');
  assert.equal(result.data.loss!['durationsRounded'], 1);
  assert.equal(result.data.loss!['collisionCount'], 'unknown');
  assert.deepEqual(result.warnings.map((item) => item.code), ['normalized-timing']);
});

test('8h4b read: two source notes in one cell read as one event with an unknown collision count', async () => {
  const fx = await fixture();
  await fx.write(0, { 4: [note({ startBeats: 1 / 768, pitch: 70 }), note({ startBeats: 1 / 1024, pitch: 70, velocity: 20 })] });
  const result = await fx.read({});
  const document = await assertCodec(fx, result);
  assert.equal(document.events.length, 1);
  // The read cannot see a collision, so it moved no timing; the description states that the count is unknown.
  assert.equal(result.data.loss, undefined);
  assert.match(toolsForProfile(AGENT_NATIVE_TOOL_PROFILE).find((spec) => spec.name === 'read_launcher_clip')!.description, /cannot see\s+two source notes in one cell/);
});

test('8h4b projection: a snapshot with two notes in one cell refuses with collision', () => {
  const snapshot = {
    ref: {} as ClipSnapshot['ref'],
    metadata: { name: '', color: { red: 0, green: 0, blue: 0 }, lengthBeats: 4, playStartBeats: 0,
      loopEnabled: true, loopStartBeats: 0, loopEndBeats: 4 } as unknown as ClipSnapshot['metadata'],
    channels: Array.from({ length: 16 }, (_, channel) => channel === 4
      ? [note({ startBeats: 0, pitch: 70 }), note({ startBeats: 1 / 1024, pitch: 70 })] : []),
  } as ClipSnapshot;
  assert.throws(() => launcherClipCells(snapshot), (error: unknown) => error instanceof LauncherClipReadError
    && error.code === 'collision'
    && JSON.stringify(error.detail) === JSON.stringify({ collisions: [{ channel: 5, pitch: 70, at: '0/512' }] }));
});

test('8h4b read: notes past the loop, a group slot, and a missing target refuse with codes', async () => {
  const fx = await fixture();

  await fx.write(1, { 0: [note({ startBeats: 6, pitch: 60 })] }, 4);
  const past = await fx.read({ row: 1 });
  assert.equal(past.failure?.code, 'range');
  assert.equal(past.failure?.stage, 'project');
  assert.deepEqual(past.failure?.effects, []);
  assert.match(past.message!, /use Consolidate/);
  assert.equal(past.retryWhen, 'after the clip is consolidated in Bitwig');
  assert.deepEqual((past.detail?.['range'] as Record<string, unknown>)['noteContentRange'], { fromBeats: 6, toBeats: 7 });

  await fx.write(2, { 0: [note({ startBeats: 3, pitch: 60, durationBeats: 4 })] }, 4);
  const overEnd = await fx.read({ row: 2 });
  assert.equal(overEnd.failure, undefined);
  assert.deepEqual(overEnd.warnings.map((item) => item.code), ['notes-past-length']);

  const [group] = fx.fake.model.visibleTracks();
  group!.type = 'Group';
  const grouped = await fx.read({ row: 3 });
  assert.equal(grouped.failure?.code, 'group-slot');
  assert.equal(grouped.diagnostic, undefined, 'a typed refusal has no exception text');

  const missing = await callTool(fx.workspace, 'read_launcher_clip', { trackId: 'missing', row: 0 }, AGENT_NATIVE_TOOL_PROFILE) as Read;
  assert.equal(missing.failure?.code, 'absent');
  const outside = await callTool(fx.workspace, 'read_launcher_clip', { trackId: fx.other.channelId, row: 9 }, AGENT_NATIVE_TOOL_PROFILE) as Read;
  assert.equal(outside.failure?.code, 'absent');
});

test('8h4b read: a partial note refuses; the diagnostic and reference sections are on request', async () => {
  const fx = await fixture();
  await fx.write(0, { 0: [{ startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1 }] });
  const partial = await fx.read({});
  assert.equal(partial.failure?.code, 'partial');
  await fx.write(1, { 0: [note()] });
  const detailed = await fx.read({ row: 1, diagnostic: true, reference: ['Patch', 'Groups'] });
  assert.deepEqual(Object.keys(detailed.diagnostic!), ['source', 'mark', 'metadata', 'channels']);
  assert.match(detailed.reference!, /^## Patch\n/);
  assert.match(detailed.reference!, /\n## Groups\n/);
  assert.doesNotMatch(detailed.reference!, /## Core/);
});

// --- identity --------------------------------------------------------------------

test('8h4b identity: a repeated read of an unchanged clip returns the same ref and IDs', async () => {
  const fx = await fixture();
  await fx.write(0, { 0: [note({ pitch: 60 }), note({ pitch: 64, startBeats: 1 })] });
  const first = await fx.read({});
  const second = await fx.read({});
  assert.equal(second.authority.identity, 'current');
  assert.equal(second.authority.base!.ref, first.authority.base!.ref);
  assert.equal(second.data.document, first.data.document);
  const checked = await fx.check([first.authority.base!.ref]);
  assert.deepEqual(checked.data.results.map((item) => item.verdict), ['current']);
});

test('8h4b identity: a velocity edit is stale with the same IDs; a pitch edit gives the edited note a new ID', async () => {
  const fx = await fixture();
  await fx.write(0, { 0: [note({ pitch: 60 }), note({ pitch: 64, startBeats: 1 })] });
  const first = await fx.read({});
  const firstIds = documentOf(first).events.map((item) => item.id);
  // An operator velocity edit, outside Ghostnote.
  fx.edit(0, { 0: [note({ pitch: 60 }), note({ pitch: 64, startBeats: 1, velocity: 50 })] });
  const stale = await fx.check([first.authority.base!.ref]);
  const item = stale.data.results[0]!;
  assert.equal(item.verdict, 'stale');
  assert.notEqual(item.base!.ref, first.authority.base!.ref);
  assert.equal(item.retainedIds, 2);
  const staleDocument = parse(item.document as string, 'fields') as StateDocument;
  assert.deepEqual(staleDocument.events.map((event) => event.id), firstIds);
  assert.equal(staleDocument.clips[0]!.id, documentOf(first).clips[0]!.id);
  assert.equal(staleDocument.events.find((event) => event.pitch === 64)!.velocity, 50);
  // The new ref is current; the old ref stays stale.
  assert.deepEqual((await fx.check([item.base!.ref, first.authority.base!.ref])).data.results.map((r) => r.verdict),
    ['current', 'stale']);
  // An operator pitch edit: the edited note gets a new ID, the other keeps its ID.
  fx.edit(0, { 0: [note({ pitch: 60 }), note({ pitch: 65, startBeats: 1, velocity: 50 })] });
  const pitched = await fx.read({});
  assert.equal(pitched.authority.identity, 'stale');
  const events = documentOf(pitched).events;
  assert.equal(events.find((event) => event.pitch === 60)!.id, firstIds[0]);
  assert.ok(!firstIds.includes(events.find((event) => event.pitch === 65)!.id));
  assert.equal(pitched.authority.retainedIds, 1);
  assert.equal(pitched.authority.mintedIds, 1);
});

test('8h4b identity: a scene insert retires the ref; the next read mints new IDs', async () => {
  const fx = await fixture();
  await fx.write(0, { 0: [note()] });
  const first = await fx.read({});
  await fx.fake.apply({ ops: [{ op: 'scene.create', count: 1 }] });
  await fx.fake.settle('tick');
  const checked = await fx.check([first.authority.base!.ref]);
  assert.deepEqual(checked.data.results.map((item) => [item.verdict, item.retired, item.code]),
    [['identity-changed', true, 'identity-changed']]);
  const again = await fx.read({});
  assert.equal(again.authority.identity, 'new');
  assert.notEqual(documentOf(again).events[0]!.id, documentOf(first).events[0]!.id);
  assert.notEqual(documentOf(again).clips[0]!.id, documentOf(first).clips[0]!.id);
});

test('8h4b identity: a project change, a deleted clip, and an evicted ref each retire with their own result', async () => {
  const registry = new IdentityRegistry(2);
  const fx = await fixture({ registry });
  await fx.write(0, { 0: [note()] });
  await fx.write(1, { 0: [note()] });
  await fx.write(2, { 0: [note()] });
  const zero = await fx.read({ row: 0 });
  const one = await fx.read({ row: 1 });
  const two = await fx.read({ row: 2 });
  const evicted = await fx.check([zero.authority.base!.ref, 'gnb1.not-from-this-process', 'not-a-ref']);
  assert.deepEqual(evicted.data.results.map((item) => item.code), ['expired-ref', 'expired-ref', 'invalid-ref']);

  await fx.fake.apply({ ops: [{ op: 'clip.delete', slot: (await fx.target(1)).slot }] });
  await fx.fake.settle('trackStruct');
  const deleted = await fx.check([one.authority.base!.ref]);
  assert.equal(deleted.data.results[0]!.retired, true);
  assert.ok(['absent', 'identity-changed'].includes(deleted.data.results[0]!.verdict!));
  assert.equal((await fx.read({ row: 1 })).data.occupancy, 'empty');

  control(fx.fake).loadProject('fake-project-Q');
  const moved = await fx.check([two.authority.base!.ref]);
  assert.deepEqual(moved.data.results.map((item) => [item.verdict, item.retired]), [['incomparable', true]]);
});
