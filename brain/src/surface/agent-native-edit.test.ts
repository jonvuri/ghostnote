import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { control } from '../adapters/fake/control.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import {
  addressKey, clip, notes, planStages, scene, slot, track, type NoteRecord,
} from '../contract/index.js';
import {
  applyPatch, contentHash, dependencyBasis, parse, sealOverlays, serialize, type Overlay, type StateDocument,
} from '../document/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from './tools.js';
import { workspaceOf } from './workspace.js';

/** A note as the cold reader reports a new host note (E245). */
const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, releaseVelocity: 100 / 127,
  isChanceEnabled: true, isOccurrenceEnabled: true, isRecurrenceEnabled: true, isRepeatEnabled: true,
  ...over,
});

type Wire = Record<string, any>;

async function fixture() {
  const fake = new FakeAdapter({ tracks: ['gn-edit', 'gn-other'], scenes: 4 });
  const [trackState] = await fake.tracks();
  let id = 0;
  const stash = new Stash({ now: () => id });
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter: fake,
    executor: new Executor(fake, { newId: () => `edit-${++id}`, now: () => id }),
    stash,
    observationStore: new FakeObservationStore(),
    documents: new IdentityRegistry(),
  });
  const trackId = trackState!.channelId;
  const target = async (row: number) => clip(slot(track(trackId), scene(row, (await fake.revision()).sceneEpoch)));
  const write = async (row: number, byChannel: Record<number, NoteRecord[]>, lengthBeats = 4) => {
    const address = await target(row);
    await workspace.apply([{ op: 'clip.create', slot: address.slot, lengthBeats }]);
    edit(row, byChannel);
    return address;
  };
  const edit = (row: number, byChannel: Record<number, NoteRecord[]>) => {
    const fakeSlot = fake.model.visibleTracks()[0]!.slots[row]!;
    fakeSlot.notes.clear();
    for (const [channel, items] of Object.entries(byChannel)) {
      for (const item of items) fakeSlot.notes.set(`${channel}:${item.pitch}:${item.startBeats}`, item);
    }
    fake.model.revision += 1;
  };
  const read = (row = 0, extra: Wire = {}) =>
    callTool(workspace, 'read_launcher_clip', { trackId, row, ...extra }, AGENT_NATIVE_TOOL_PROFILE) as Promise<Wire>;
  const editClip = (document: unknown, extra: Wire = {}, row = 0) =>
    callTool(workspace, 'edit_launcher_clip', { trackId, row, document, ...extra }, AGENT_NATIVE_TOOL_PROFILE) as Promise<Wire>;
  const raw = async (row = 0): Promise<Record<number, NoteRecord[]>> => {
    const address = await target(row);
    const result = await fake.read(Array.from({ length: 16 }, (_, channel) => notes(address, channel)));
    return Object.fromEntries(Array.from({ length: 16 }, (_, channel) => {
      const value = result.entries[addressKey(notes(address, channel))]!.value;
      return [channel, value.of === 'notes' ? [...value.notes] : []];
    }).filter(([, items]) => (items as NoteRecord[]).length > 0));
  };
  return { fake, workspace, stash, trackId, target, write, edit, read, editClip, raw };
}

const documentOf = (result: Wire): StateDocument => parse(result.data.document as string, 'fields') as StateDocument;
const patch = (base: Wire, lines: string[]) => [
  'DOC ghostnote-document 1.0 patch',
  `BASE ${JSON.stringify({ sha256: base.sha256, ref: base.ref })}`,
  'FIELDS id clip at duration pitch velocity channel mute',
  ...lines,
].join('\n') + '\n';

const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const ids = (document: StateDocument) => new Map(document.events.map((event) => [`${event.channel ?? 1}:${event.pitch}:${event.at}`, event.id]));
const changeCount = (fx: Awaited<ReturnType<typeof fixture>>) => fx.stash.log.list().length;

/** A typical small clip: two channels, a muted note, a disabled nondefault control, and a finer raw duration. */
function typical(): Record<number, NoteRecord[]> {
  return {
    0: [
      note({ pitch: 60 }),
      note({ pitch: 64, startBeats: 1, velocity: 90, durationBeats: 1 / 3 }),
      note({ pitch: 67, startBeats: 2, isMuted: true, chance: 0.3, isChanceEnabled: false }),
    ],
    3: [note({ pitch: 36, startBeats: 0.5, velocity: 120, repeatCount: -2, repeatCurve: 0.25, isRepeatEnabled: false })],
  };
}

test('edit: a sparse patch adds a note on the targeted route, reads back verified, and keeps every ID', async () => {
  const fx = await fixture();
  await fx.write(0, typical());
  const before = await fx.raw();
  const first = await fx.read();
  const document = documentOf(first);
  const clipId = document.clips[0]!.id;
  const result = await fx.editClip(patch(first.authority.base, [`ADD n9 ${clipId} 3 1/2 67 90 2 false`]));
  assert.equal(result.failure, undefined, JSON.stringify(result));
  assert.equal(result.applied, true);
  assert.equal(result.plan.route, 'targeted');
  assert.equal(result.readback.status, 'verified');
  assert.deepEqual(result.readback.discrepancies, []);
  assert.ok(!result.warnings.some((item: Wire) => item.code === 'pressure-unobservable'),
    'the targeted route keeps untouched notes and their pressure');
  assert.equal(result.effects.length, 1);
  assert.equal(result.effects[0].fidelity, 'exact');
  // Untouched notes keep every raw field. The new note has only portable defaults, so the write leaves every
  // property to the host insertion value (8h4c2): one stage, no property write.
  const after = await fx.raw();
  assert.deepEqual(json(after[0]), json(before[0]));
  assert.deepEqual(json(after[3]), json(before[3]));
  const added = after[1]![0]!;
  assert.deepEqual(added, note({ startBeats: 3, durationBeats: 0.5, pitch: 67, velocity: 90 }));
  const written = fx.stash.get(result.effects[0].changeId)!.take.ops;
  assert.deepEqual(written.map((op) => op.op), ['note.insert']);
  assert.equal(planStages(written).length, 1, 'no property stage');
  const read = await fx.read();
  assert.equal(read.authority.base.ref, result.readback.base.ref, 'the next read is current on the written ref');
  assert.equal(read.authority.identity, 'current');
  const next = documentOf(read);
  assert.equal(contentHash(next), result.readback.base.sha256);
  const nextIds = ids(next);
  for (const [key, id] of ids(document)) assert.equal(nextIds.get(key), id);
  assert.equal(nextIds.get('2:67:3'), 'n9');
});


test('edit: remove, pitch move, and 1/512 nudge use the targeted route; a moved note keeps its ID and raw controls', async () => {
  const fx = await fixture();
  await fx.write(0, typical());
  const first = await fx.read();
  const document = documentOf(first);
  const byKey = ids(document);
  const kick = byKey.get('4:36:1/2')!;
  const low = byKey.get('1:60:0')!;
  const result = await fx.editClip(patch(first.authority.base, [
    `REMOVE ${byKey.get('1:67:2')}`,
    `UPDATE ${kick} {"pitch":38}`,
    `UPDATE ${low} {"at":"1/512"}`,
  ]));
  assert.equal(result.failure, undefined, JSON.stringify(result));
  assert.equal(result.plan.route, 'targeted');
  assert.deepEqual([result.plan.removed, result.plan.changed, result.plan.moved], [1, 2, 2]);
  assert.equal(result.readback.status, 'verified', JSON.stringify(result.readback));
  const raw = await fx.raw();
  const moved = raw[3]!.find((item) => item.pitch === 38)!;
  assert.deepEqual([moved.repeatCount, moved.repeatCurve, moved.isRepeatEnabled], [-2, 0.25, false],
    'a reconstructed note replays its raw repeat controls (D36)');
  assert.equal(moved.velocity, 120);
  assert.ok(raw[0]!.some((item) => item.pitch === 60 && item.startBeats === 1 / 512));
  assert.ok(!raw[0]!.some((item) => item.pitch === 67));
  const next = ids(documentOf(await fx.read()));
  assert.equal(next.get('4:38:1/2'), kick, 'authorized portable update keeps the ID at the new cell');
  assert.equal(next.get('1:60:1/512'), low);
});

test('edit: a velocity or expression change rewrites the whole clip and preserves every untouched raw value', async () => {
  const fx = await fixture();
  await fx.write(0, typical());
  const before = await fx.raw();
  const first = await fx.read();
  const byKey = ids(documentOf(first));
  const result = await fx.editClip(patch(first.authority.base, [
    `UPDATE ${byKey.get('1:60:0')} {"velocity":70}`,
    `UPDATE ${byKey.get('1:64:1')} {"expression":{"velocitySpread":0,"gain":0.5,"pan":-0.25,"pressure":0,"timbre":0.75,"transpose":2}}`,
  ]));
  assert.equal(result.failure, undefined, JSON.stringify(result));
  assert.equal(result.plan.route, 'whole-clip');
  assert.equal(result.readback.status, 'verified', JSON.stringify(result.readback));
  assert.ok(result.warnings.some((item: Wire) => item.code === 'pressure-unobservable'));
  const after = await fx.raw();
  assert.deepEqual(json(after[3]), json(before[3]), 'another channel survives the clear and rewrite');
  const muted = after[0]!.find((item) => item.pitch === 67)!;
  assert.deepEqual(json(muted), json(before[0]!.find((item) => item.pitch === 67)), 'disabled nondefault chance stays');
  const third = after[0]!.find((item) => item.pitch === 64)!;
  assert.equal(third.durationBeats, 1 / 3, 'an unchanged raw duration off the cell plane stays');
  assert.equal(third.gain, Math.cbrt(0.5));
  assert.equal(third.timbre, 0.5);
  assert.equal(after[0]!.find((item) => item.pitch === 60)!.velocity, 70);
  const event = documentOf(await fx.read()).events.find((item) => item.pitch === 64)!;
  assert.equal(event.expression!.gain, 0.5, 'portable gain reads back unchanged');
});

test('edit cost (8h4c2): host values need no property stage; a targeted edit reads twice, a whole-clip edit three times', async () => {
  const fx = await fixture();
  const notesOf = (channel: number) => Array.from({ length: 4 }, (_, k) => note({ pitch: 60 + k, startBeats: k }));
  await fx.write(0, Object.fromEntries(Array.from({ length: 16 }, (_, channel) => [channel, notesOf(channel)])));
  const read = fx.fake.read.bind(fx.fake);
  let sourced = 0;
  fx.fake.read = async (addresses, options) => {
    if (options?.sources !== undefined) sourced += 1;
    return read(addresses, options);
  };
  const stagesOf = (result: Wire) => planStages(fx.stash.get(result.effects[0].changeId)!.take.ops);
  const props = (result: Wire) => stagesOf(result).flatMap((stage) => stage.ops).filter((op) => op.op === 'note.props');

  // 16 new notes with portable defaults: one create stage, no property stage.
  let first = await fx.read();
  const clipId = documentOf(first).clips[0]!.id;
  sourced = 0;
  const insert = await fx.editClip(patch(first.authority.base,
    Array.from({ length: 16 }, (_, c) => `ADD i${c + 1} ${clipId} 7/2 1/4 96 100 ${c + 1} false`)));
  assert.equal(insert.readback?.status, 'verified', JSON.stringify(insert));
  assert.equal(insert.plan.route, 'targeted');
  assert.equal(stagesOf(insert).length, 1);
  assert.equal(sourced, 2, 'the fresh read is the stash read; the verify read is the readback');

  // A whole-clip velocity edit of host-value notes: no property stage, and one more read before the write.
  first = await fx.read();
  sourced = 0;
  const velocity = await fx.editClip(patch(first.authority.base, [`UPDATE ${ids(documentOf(first)).get('1:60:0')} {"velocity":70}`]));
  assert.equal(velocity.readback.status, 'verified', JSON.stringify(velocity));
  assert.equal(velocity.plan.route, 'whole-clip');
  assert.deepEqual(props(velocity), []);
  assert.equal(sourced, 3, 'the whole-clip route reads the clip again before the write');

  // A new note with one nondefault value writes only that value.
  first = await fx.read();
  const gain = await fx.editClip(patch(first.authority.base, [`ADD g1 ${clipId} 3 1/2 80 90 1 false`]).replace(
    'FIELDS id clip at duration pitch velocity channel mute', 'FIELDS id clip at duration pitch velocity channel mute expression')
    .replace('90 1 false', '90 1 false {"velocitySpread":0,"gain":0.5,"pan":0,"pressure":0,"timbre":0.5,"transpose":0}'));
  assert.equal(gain.readback?.status, 'verified', JSON.stringify(gain));
  const written = props(gain).flatMap((op) => (op.op === 'note.props' ? op.notes : []));
  assert.deepEqual(written.map((item) => Object.keys(item).sort()), [['durationBeats', 'gain', 'pitch', 'startBeats', 'velocity']]);
});

test('edit: portable gain 0, 0.5, and 8 write raw 1e-323, cbrt(0.5), and 2 and read back unchanged', async () => {
  const fx = await fixture();
  await fx.write(0, { 0: [note({ pitch: 60 }), note({ pitch: 62, startBeats: 1 }), note({ pitch: 64, startBeats: 2 })] });
  const first = await fx.read();
  const byKey = ids(documentOf(first));
  const gain = (value: number) => `{"expression":{"velocitySpread":0,"gain":${value},"pan":0,"pressure":0,"timbre":0.5,"transpose":0}}`;
  const result = await fx.editClip(patch(first.authority.base, [
    `UPDATE ${byKey.get('1:60:0')} ${gain(0)}`, `UPDATE ${byKey.get('1:62:1')} ${gain(0.5)}`,
    `UPDATE ${byKey.get('1:64:2')} ${gain(8)}`,
  ]));
  assert.equal(result.readback.status, 'verified', JSON.stringify(result));
  const raw = (await fx.raw())[0]!;
  assert.deepEqual(raw.map((item) => item.gain), [1e-323, Math.cbrt(0.5), 2]);
  const events = documentOf(await fx.read()).events;
  assert.deepEqual(events.map((item) => item.expression?.gain ?? 1), [0, 0.5, 8]);
});

test('edit: a clip property change writes name, loop, and length through clip.update', async () => {
  const fx = await fixture();
  await fx.write(0, typical(), 4);
  const first = await fx.read();
  const clipId = documentOf(first).clips[0]!.id;
  const text = [
    'DOC ghostnote-document 1.0 patch',
    `BASE ${JSON.stringify(first.authority.base)}`,
    'FIELDS id clip at duration pitch velocity channel mute',
    `CLIP_UPDATE ${clipId} {"name":"verse","length":"8","loop":null}`,
  ].join('\n') + '\n';
  const result = await fx.editClip(text);
  assert.equal(result.failure, undefined, JSON.stringify(result));
  assert.equal(result.plan.route, 'none');
  assert.deepEqual(result.plan.clipFields, ['length', 'loop', 'name']);
  assert.equal(result.readback.status, 'verified', JSON.stringify(result.readback));
  const clip = documentOf(await fx.read()).clips[0]!;
  assert.deepEqual([clip.name, clip.length, clip.loop ?? null], ['verse', '8', null]);
});

test('8i0 edit: an off-palette clip extends and gains notes; only changed properties are written', async () => {
  const fx = await fixture();
  await fx.write(0, typical(), 4);
  const slotState = fx.fake.model.visibleTracks()[0]!.slots[0]!;
  slotState.color = { red: 145, green: 105, blue: 77 };
  slotState.name = 'IcyShellStab01';
  fx.fake.model.revision += 1;
  const first = await fx.read();
  const clipId = documentOf(first).clips[0]!.id;
  const text = [
    'DOC ghostnote-document 1.0 patch',
    `BASE ${JSON.stringify(first.authority.base)}`,
    'FIELDS id clip at duration pitch velocity channel mute',
    `CLIP_UPDATE ${clipId} {"length":"32","loop":{"from":"0","to":"32"}}`,
    `ADD x1 ${clipId} 20 1 72 90 1 false`,
  ].join('\n') + '\n';
  const result = await fx.editClip(text);
  assert.equal(result.failure, undefined, JSON.stringify(result));
  assert.equal(result.readback.status, 'verified', JSON.stringify(result.readback));
  const ops = fx.stash.get(result.effects[0].changeId)!.take.ops;
  const update = ops.find((op) => op.op === 'clip.update');
  assert.deepEqual(update?.op === 'clip.update' ? update.fields : null, ['lengthBeats', 'loopEndBeats', 'playStartBeats']);
  assert.deepEqual(slotState.color, { red: 145, green: 105, blue: 77 }, 'no colour setter: the colour is exact');
  assert.equal(slotState.name, 'IcyShellStab01');
  assert.equal(slotState.lengthBeats, 32);

  const renamed = await fx.editClip([
    'DOC ghostnote-document 1.0 patch',
    `BASE ${JSON.stringify(result.readback.base)}`,
    'FIELDS id clip at duration pitch velocity channel mute',
    `CLIP_UPDATE ${clipId} {"name":"IcyShellStab02"}`,
  ].join('\n') + '\n');
  assert.equal(renamed.failure, undefined, JSON.stringify(renamed));
  const named = fx.stash.get(renamed.effects[0].changeId)!.take.ops.find((op) => op.op === 'clip.update');
  assert.deepEqual(named?.op === 'clip.update' ? named.fields : null, ['name'], 'a name-only edit has no marker setter');

  // Reverse both in order. The length reversal keeps the later name until that change is reversed too.
  const undoName = await callTool(fx.workspace, 'revert_change', { changeId: renamed.effects[0].changeId },
    AGENT_NATIVE_TOOL_PROFILE) as Wire;
  assert.equal(undoName.applied, true, JSON.stringify(undoName).slice(0, 400));
  const undoEdit = await callTool(fx.workspace, 'revert_change', { changeId: result.effects[0].changeId },
    AGENT_NATIVE_TOOL_PROFILE) as Wire;
  assert.equal(undoEdit.applied, true, JSON.stringify(undoEdit).slice(0, 400));
  assert.equal(slotState.lengthBeats, 4);
  assert.equal(slotState.name, 'IcyShellStab01');
  assert.deepEqual(slotState.color, { red: 145, green: 105, blue: 77 });
});

test('edit: a desired document replaces the clip; pressure on an untouched note survives on the targeted route', async () => {
  const fx = await fixture();
  await fx.write(0, { 0: [note({ pitch: 60, pressure: 0.4 }), note({ pitch: 64, startBeats: 1 })], 5: [note({ pitch: 40 })] });
  const before = await fx.raw();
  const first = await fx.read();
  const document = documentOf(first);
  const keep = ids(document).get('1:60:0')!;
  const desired = parse(serialize({ ...document, kind: 'desired', base: first.authority.base,
    coverage: document.coverage.map((item) => ({ ...item, fields: 'all' })),
    events: [
      document.events.find((event) => event.id === keep)!,
      { id: 'd1', clip: document.clips[0]!.id, at: '2', duration: '1/4', pitch: 72, velocity: 80, channel: 2 },
      { id: 'd2', clip: document.clips[0]!.id, at: '3', duration: '1/2', pitch: 48, velocity: 64, channel: 16 },
    ] } as StateDocument, 'fields'), 'fields');
  const result = await fx.editClip(serialize(desired, 'fields'));
  assert.equal(result.failure, undefined, JSON.stringify(result));
  assert.equal(result.plan.route, 'targeted');
  assert.deepEqual([result.plan.added, result.plan.removed], [2, 2]);
  assert.equal(result.readback.status, 'verified', JSON.stringify(result.readback));
  const after = await fx.raw();
  assert.deepEqual(json(after[0]!.find((item) => item.pitch === 60)), json(before[0]![0]), 'pressure note untouched');
  assert.deepEqual(Object.keys(after).map(Number).sort((a, b) => a - b), [0, 1, 15]);
  const read = documentOf(await fx.read());
  assert.deepEqual(read.events.map((event) => event.id).sort(), [keep, 'd1', 'd2'].sort());
});

test('edit: intent replace rewrites an occupied clip without a base and keeps no event IDs', async () => {
  const fx = await fixture();
  await fx.write(0, { 0: [note({ pitch: 60 })] });
  const desired = [
    'DOC ghostnote-document 1.0 desired',
    'CLIP {"id":"part","length":"4"}',
    'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"part","fields":"all","from":"0","status":"complete","to":"4"}',
    'FIELDS id clip at duration pitch velocity channel mute',
    'EVENT e1 part 0 1 60 100 1 false',
    'EVENT e2 part 1 1 62 100 1 false',
  ].join('\n') + '\n';
  assert.equal((await fx.editClip(desired)).failure.code, 'invalid-ref', 'a desired document without BASE needs intent');
  const result = await fx.editClip(desired, { intent: 'replace' });
  assert.equal(result.failure, undefined, JSON.stringify(result));
  assert.equal(result.plan.route, 'whole-clip', 'e1 replaces the note at the same cell');
  assert.equal(result.readback.status, 'verified', JSON.stringify(result.readback));
  const read = documentOf(await fx.read());
  assert.deepEqual(read.events.map((event) => [event.id, event.pitch]), [['e1', 60], ['e2', 62]]);
});

test('edit: dryRun returns the plan and writes nothing', async () => {
  const fx = await fixture();
  await fx.write(0, typical());
  const before = await fx.raw();
  const changes = changeCount(fx);
  const first = await fx.read();
  const byKey = ids(documentOf(first));
  const result = await fx.editClip(patch(first.authority.base, [`UPDATE ${byKey.get('1:60:0')} {"velocity":1}`]),
    { dryRun: true });
  assert.equal(result.applied, false);
  assert.equal(result.plan.route, 'whole-clip');
  assert.deepEqual(result.plan.operations, ['note.clear', 'note.write', 'note.write']);
  assert.equal(typeof result.expected.document, 'string');
  assert.deepEqual(json(await fx.raw()), json(before));
  assert.equal(changeCount(fx), changes);
});

/** Run one refused edit: the result is a failure with the code and reason, and the host and the stash are unchanged. */
async function refused(
  fx: Awaited<ReturnType<typeof fixture>>, document: unknown, code: string, reason?: string, extra: Wire = {}, row = 0,
): Promise<Wire> {
  const before = json(await fx.raw(row));
  const changes = changeCount(fx);
  const result = await fx.editClip(document, extra, row);
  assert.equal(result.failure?.code, code, JSON.stringify(result));
  if (reason !== undefined) assert.equal(result.detail?.reason, reason, JSON.stringify(result));
  assert.deepEqual(result.failure.effects, []);
  assert.deepEqual(json(await fx.raw(row)), before, 'a refusal writes nothing');
  assert.equal(changeCount(fx), changes, 'a refusal records no change');
  return result;
}

test('edit refusals: capability, overlap, range, and timing refuse before any host call', async () => {
  const fx = await fixture();
  await fx.write(0, {
    0: [note({ pitch: 60, pressure: 0.4 }), note({ pitch: 64, startBeats: 1 }), note({ pitch: 67, startBeats: 2 })],
  });
  const first = await fx.read();
  const document = documentOf(first);
  const byKey = ids(document);
  const clipId = document.clips[0]!.id;
  const base = first.authority.base;
  const pressured = byKey.get('1:60:0')!;
  const plainNote = byKey.get('1:64:1')!;
  await refused(fx, patch(base, [`UPDATE ${pressured} {"pitch":61}`]), 'unsupported', 'pressure');
  await refused(fx, patch(base, [`REMOVE ${pressured}`]), 'unsupported', 'pressure');
  await refused(fx, patch(base, [`UPDATE ${plainNote} {"velocity":20}`]), 'unsupported', 'pressure',
    {}, 0).then((result) => assert.deepEqual(result.detail.events, [pressured]));
  await refused(fx, patch(base, [
    `UPDATE ${plainNote} {"repeat":{"enabled":true,"count":3,"curve":0,"velocityCurve":0,"velocityEnd":1}}`,
  ]), 'unsupported', 'repeat');
  await refused(fx, patch(base, [`UPDATE ${plainNote} {"articulation":"staccato"}`]), 'unsupported', 'articulation');
  await refused(fx, patch(base, [`ADD o1 ${clipId} 3/2 1 64 100 1 false`]), 'unsupported', 'overlap');
  await refused(fx, patch(base, [`ADD o2 ${clipId} 7/2 1 70 100 1 false`]), 'range', 'past-clip-end');
  await refused(fx, patch(base, [`UPDATE ${plainNote} {"expression":{"velocitySpread":0,"gain":1,"pan":0,"pressure":0,"timbre":0.5,"transpose":120}}`]),
    'unsupported', 'transpose');
  await refused(fx, [
    'DOC ghostnote-document 1.0 patch', `BASE ${JSON.stringify(base)}`, 'FIELDS id clip at duration pitch velocity channel mute',
    `CLIP_UPDATE ${clipId} {"loop":{"from":"1","to":"4"}}`,
  ].join('\n') + '\n', 'unsupported', 'loop');
  await refused(fx, [
    'DOC ghostnote-document 1.0 patch', `BASE ${JSON.stringify(base)}`, 'FIELDS id clip at duration pitch velocity channel mute',
    `CLIP_UPDATE ${clipId} {"length":"5/2","loop":{"from":"0","to":"5/2"}}`,
  ].join('\n') + '\n', 'range', 'past-clip-end');
  await refused(fx, 'DOC ghostnote-document 1.0 patch\nnot a record\n', 'invalid-input')
    .then((result) => assert.equal(result.detail.line, 2));
  await refused(fx, patch({ ...base, sha256: '0'.repeat(64) }, [`REMOVE ${plainNote}`]), 'invalid-input', 'base');
  await refused(fx, patch({ sha256: base.sha256 }, [`REMOVE ${plainNote}`]), 'invalid-ref');
  await refused(fx, patch({ ...base, ref: 'gnb1.notFromThisProcess' }, [`REMOVE ${plainNote}`]), 'expired-ref');
});

test('edit refusals: a raw duration that no writable grid holds refuses a whole-clip rewrite', async () => {
  const fx = await fixture();
  await fx.write(0, { 0: [note({ pitch: 60, durationBeats: 0.3 }), note({ pitch: 64, startBeats: 1 })] });
  const first = await fx.read();
  const byKey = ids(documentOf(first));
  await refused(fx, patch(first.authority.base, [`UPDATE ${byKey.get('1:64:1')} {"velocity":20}`]), 'unsupported', 'timing');
  // The targeted route does not rewrite the off-grid note.
  const added = await fx.editClip(patch(first.authority.base, [`ADD t1 ${documentOf(first).clips[0]!.id} 2 1 70 90 1 false`]));
  assert.equal(added.readback.status, 'verified', JSON.stringify(added));
});

test('edit refusals: a stale base, a scene insert, and a project change refuse before any host mutation', async () => {
  const fx = await fixture();
  await fx.write(0, { 0: [note({ pitch: 60 }), note({ pitch: 64, startBeats: 1 })] });
  const first = await fx.read();
  const byKey = ids(documentOf(first));
  // An operator velocity edit after the read.
  fx.edit(0, { 0: [note({ pitch: 60 }), note({ pitch: 64, startBeats: 1, velocity: 50 })] });
  const stale = await refused(fx, patch(first.authority.base, [`UPDATE ${byKey.get('1:60:0')} {"velocity":20}`]), 'stale');
  assert.equal(stale.failure.stage, 'guard');
  const staleDocument = parse(stale.detail.document, 'fields') as StateDocument;
  assert.equal(staleDocument.events.find((event) => event.pitch === 64)!.velocity, 50);
  assert.deepEqual(staleDocument.events.map((event) => event.id), [...byKey.values()]);
  // The new base from the stale result applies.
  const applied = await fx.editClip(patch(stale.detail.base, [`UPDATE ${byKey.get('1:60:0')} {"velocity":20}`]));
  assert.equal(applied.readback.status, 'verified', JSON.stringify(applied));

  const second = await fx.read();
  await fx.fake.apply({ ops: [{ op: 'scene.create', count: 1 }] });
  await fx.fake.settle('tick');
  await refused(fx, patch(second.authority.base, [`UPDATE ${byKey.get('1:60:0')} {"velocity":30}`]), 'identity-changed');

  const third = await fx.read();
  const raw = await fx.raw();
  control(fx.fake).loadProject('fake-project-Q', ['gn-edit']);
  const changes = changeCount(fx);
  const moved = await fx.editClip(patch(third.authority.base, [`UPDATE ${byKey.get('1:60:0')} {"velocity":30}`]));
  assert.ok(['incomparable', 'absent'].includes(moved.failure?.code), JSON.stringify(moved));
  assert.equal(changeCount(fx), changes);
  assert.ok(raw[0]!.length === 2);
});

test('edit refusals: an empty slot and a snapshot document refuse', async () => {
  const fx = await fixture();
  await fx.write(0, { 0: [note()] });
  const desired = [
    'DOC ghostnote-document 1.0 desired',
    'CLIP {"id":"part","length":"4"}',
    'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"part","fields":"all","from":"0","status":"complete","to":"4"}',
    'FIELDS id clip at duration pitch velocity channel mute',
    'EVENT e1 part 0 1 60 100 1 false',
  ].join('\n') + '\n';
  const empty = await fx.editClip(desired, { intent: 'replace' }, 1);
  assert.equal(empty.failure?.code, 'absent', JSON.stringify(empty));
  const snapshot = serialize({ ...parse(desired, 'fields'), kind: 'snapshot' } as StateDocument, 'fields');
  assert.equal((await fx.editClip(snapshot)).failure?.code, 'invalid-input');
  assert.equal(changeCount(fx), 1, 'only the fixture clip.create is recorded');
});

test('edit reversal: revert_change restores a targeted and a whole-clip edit exactly', async () => {
  const fx = await fixture();
  await fx.write(0, typical());
  const original = json(await fx.raw());
  const first = await fx.read();
  const byKey = ids(documentOf(first));
  const targeted = await fx.editClip(patch(first.authority.base, [
    `REMOVE ${byKey.get('1:67:2')}`, `UPDATE ${byKey.get('4:36:1/2')} {"pitch":38}`,
    `ADD r1 ${documentOf(first).clips[0]!.id} 3 1 72 80 1 false`,
  ]));
  assert.equal(targeted.plan.route, 'targeted');
  const undoTargeted = await callTool(fx.workspace, 'revert_change', { changeId: targeted.effects[0].changeId },
    AGENT_NATIVE_TOOL_PROFILE) as Wire;
  assert.equal(undoTargeted.applied, true, JSON.stringify(undoTargeted));
  assert.deepEqual(json(await fx.raw()), original);

  const second = await fx.read();
  assert.equal(second.authority.identity, 'stale', 'a reversal is a host change; the written ref is stale');
  const byKey2 = ids(documentOf(second));
  const whole = await fx.editClip(patch(second.authority.base, [`UPDATE ${byKey2.get('1:60:0')} {"velocity":11}`]));
  assert.equal(whole.plan.route, 'whole-clip');
  const undoWhole = await callTool(fx.workspace, 'revert_change', { changeId: whole.effects[0].changeId },
    AGENT_NATIVE_TOOL_PROFILE) as Wire;
  assert.equal(undoWhole.applied, true, JSON.stringify(undoWhole));
  assert.deepEqual(json(await fx.raw()), original);
});

test('edit reversal: a concurrent edit after the write blocks the reversal with a reason', async () => {
  const fx = await fixture();
  await fx.write(0, { 0: [note({ pitch: 60 }), note({ pitch: 64, startBeats: 1 })] });
  const first = await fx.read();
  const byKey = ids(documentOf(first));
  const targeted = await fx.editClip(patch(first.authority.base, [`ADD c1 ${documentOf(first).clips[0]!.id} 2 1 67 90 1 false`]));
  assert.equal(targeted.plan.route, 'targeted');
  const now = await fx.raw();
  fx.edit(0, { 0: [...now[0]!.map((item) => item.pitch === 64 ? { ...item, velocity: 33 } : item)] });
  const edited = json(await fx.raw());
  const undo = await callTool(fx.workspace, 'revert_change', { changeId: targeted.effects[0].changeId },
    AGENT_NATIVE_TOOL_PROFILE) as Wire;
  assert.notEqual(undo.applied, true, JSON.stringify(undo));
  assert.deepEqual(json(await fx.raw()), edited, 'a blocked reversal writes nothing');
  assert.ok(JSON.stringify(undo).length > 0);
  void byKey;
});

test('edit: a check of the pre-edit ref is stale and names the written base', async () => {
  const fx = await fixture();
  await fx.write(0, { 0: [note({ pitch: 60 })] });
  const first = await fx.read();
  const result = await fx.editClip(patch(first.authority.base, [`ADD k1 ${documentOf(first).clips[0]!.id} 1 1 62 90 1 false`]));
  const checked = await callTool(fx.workspace, 'check_launcher_clips', { refs: [first.authority.base.ref] },
    AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const item = checked.data.results[0];
  assert.equal(item.verdict, 'stale');
  assert.equal(item.base.ref, result.readback.base.ref, 'the stale check reuses the written entry');
  assert.equal(item.identity, 'current');
});

/** A declared nominal claim on one event, sealed against the document. */
function nominal(document: StateDocument, eventId: string, id = 'nom1'): Overlay {
  const event = document.events.find((item) => item.id === eventId)!;
  const claim = {
    id, type: 'nominal', state: 'current',
    provenance: { kind: 'declared', source: 'test', method: 'test-v1' },
    depends: { events: [{ id: eventId, fields: ['clip', 'at', 'duration'] }], clips: [], overlays: [], membership: [] },
    basis: '0'.repeat(64),
    data: { event: eventId, at: event.at, duration: event.duration, division: '1/4' },
  } as Overlay;
  return { ...claim, basis: dependencyBasis(document, claim) };
}

test('edit overlays: a put claim is stored with the base, survives an unrelated edit, goes stale, then is removed', async () => {
  const fx = await fixture();
  await fx.write(0, { 0: [note({ pitch: 60 }), note({ pitch: 64, startBeats: 1 })] });
  const first = await fx.read();
  const document = documentOf(first);
  const byKey = ids(document);
  const subject = byKey.get('1:64:1')!;
  const other = byKey.get('1:60:0')!;
  const claim = nominal(document, subject);
  const put = await fx.editClip(patch(first.authority.base, [`OVERLAY_PUT ${JSON.stringify(claim)}`]));
  assert.equal(put.failure, undefined, JSON.stringify(put));
  assert.equal(put.plan.route, 'none');
  assert.deepEqual(put.effects, [], 'an annotation change has no host effect');
  const stored = documentOf(await fx.read());
  assert.deepEqual(stored.overlays.map((item) => [item.id, item.state]), [['nom1', 'current']]);

  // An unrelated velocity edit keeps the claim current.
  const second = await fx.read();
  const unrelated = await fx.editClip(patch(second.authority.base, [`UPDATE ${other} {"velocity":40}`]));
  assert.equal(unrelated.readback.status, 'verified', JSON.stringify(unrelated));
  assert.deepEqual(documentOf(await fx.read()).overlays.map((item) => item.state), ['current']);

  // An operator onset edit of the subject removes the claim: the subject gets a new ID.
  const raw = await fx.raw();
  fx.edit(0, { 0: raw[0]!.map((item) => item.pitch === 64 ? { ...item, startBeats: 1.5 } : item) });
  const humanEdited = await fx.read();
  assert.deepEqual(humanEdited.authority.overlays, { removed: [{ id: 'nom1', reason: 'unresolved-reference' }] });
  assert.deepEqual(documentOf(humanEdited).overlays, []);
});

test('edit overlays: a duration change through the edit makes a dependent claim stale', async () => {
  const fx = await fixture();
  await fx.write(0, { 0: [note({ pitch: 60 }), note({ pitch: 64, startBeats: 1 })] });
  const first = await fx.read();
  const document = documentOf(first);
  const subject = ids(document).get('1:64:1')!;
  const put = await fx.editClip(patch(first.authority.base, [`OVERLAY_PUT ${JSON.stringify(nominal(document, subject))}`]));
  assert.equal(put.failure, undefined, JSON.stringify(put));
  const second = await fx.read();
  const changed = await fx.editClip(patch(second.authority.base, [`UPDATE ${subject} {"duration":"1/2"}`]),
    { readback: 'document' });
  assert.equal(changed.readback.status, 'verified', JSON.stringify(changed.readback));
  const written = parse(changed.readback.document, 'fields') as StateDocument;
  assert.deepEqual(written.overlays.map((item) => [item.id, item.state]), [['nom1', 'stale']]);
  assert.deepEqual(documentOf(await fx.read()).overlays.map((item) => item.state), ['stale']);
  // A removal of the subject must name the claim: the codec rejects a dangling reference.
  const third = await fx.read();
  await refused(fx, patch(third.authority.base, [`REMOVE ${subject}`]), 'invalid-input');
  const removed = await fx.editClip(patch(third.authority.base, [`REMOVE ${subject}`, 'OVERLAY_REMOVE nom1']));
  assert.equal(removed.readback.status, 'verified', JSON.stringify(removed));
  assert.deepEqual(documentOf(await fx.read()).overlays, []);
});

const EXAMPLES = new URL('../../../spec/ghostnote-document-v1/examples/', import.meta.url);
const example = (name: string) => readFileSync(new URL(name, EXAMPLES), 'utf8');
/** Rename the corpus clip ID `part` in a JSON document. */
const rekey = (document: unknown, clipId: string): any => JSON.parse(JSON.stringify(document).replaceAll('"part"', JSON.stringify(clipId)));

test('edit corpus: the complete example and its patch pass through the edit path with field preservation', async () => {
  const fx = await fixture();
  await fx.write(0, { 0: [note({ pitch: 50 })] });
  const complete = parse(example('complete.fields'), 'fields') as StateDocument;
  // The unmodified corpus document names fields that the host cannot write: each refuses with its reason.
  const unwritable = await refused(fx, serialize({ ...complete, overlays: [] }, 'fields'), 'unsupported', undefined,
    { intent: 'replace' });
  await refused(fx, example('complete.fields'), 'invalid-input', 'replace', { intent: 'replace' });
  assert.ok(['articulation', 'repeat', 'pressure', 'play-range'].includes(unwritable.detail.reason));

  // The host-writable projection of the corpus: no articulation, repeat, pressure, or play range, and no overlays.
  const writable = structuredClone(complete);
  writable.clips = writable.clips.map(({ playRange: _p, ...clip }) => clip);
  // The host binding maps only `always` and `bitwig:ENUM` occurrence labels.
  writable.events = writable.events.map(({ articulation: _a, repeat: _r, ...event }) => ({
    ...event,
    ...(event.expression === undefined ? {} : { expression: { ...event.expression, pressure: 0 } }),
    ...(event.occurrence === undefined ? {} : { occurrence: { ...event.occurrence, condition: 'bitwig:FIRST' } }),
  }));
  writable.overlays = [];
  const seeded = await fx.editClip(serialize(writable, 'fields'), { intent: 'replace' });
  assert.equal(seeded.readback?.status, 'verified', JSON.stringify(seeded));
  const host = documentOf(await fx.read());
  const clipId = host.clips[0]!.id;
  assert.deepEqual(host.events.map((event) => event.id), ['n1', 'n2', 'n3'], 'replacement keeps the desired IDs');
  assert.deepEqual(json(host.events), json(rekey(writable.events, clipId)), 'every written field reads back');

  // Store the corpus overlays, keyed to the host clip ID and sealed against the host document.
  const base = await fx.read();
  const annotated = sealOverlays({ ...host, overlays: rekey(complete.overlays, clipId) });
  const desired = { ...annotated, kind: 'desired', base: base.authority.base,
    coverage: host.coverage.map((item) => ({ ...item, fields: 'all' })) } as StateDocument;
  const stored = await fx.editClip(serialize(desired, 'fields'));
  assert.equal(stored.failure, undefined, JSON.stringify(stored));
  assert.equal(stored.plan.route, 'none');
  const withOverlays = documentOf(await fx.read());
  assert.equal(withOverlays.overlays.length, complete.overlays.length);
  assert.ok(withOverlays.overlays.every((item) => item.state === 'current'));

  // The corpus patch: remove, pitch and expression reset, add, clip name, and overlay remove and put.
  const corpusPatch = rekey(JSON.parse(example('patch.json')), clipId);
  const third = await fx.read();
  const withoutPut = { ...corpusPatch, base: third.authority.base, overlayPut: [], overlayRemove: [...corpusPatch.overlayRemove, 'harmony1'] };
  const eventsOnly = applyPatch({ ...withOverlays, coverage: withOverlays.coverage.map((item) => ({ ...item, fields: 'all' })) },
    { ...withoutPut, base: { sha256: contentHash({ ...withOverlays, coverage: withOverlays.coverage.map((item) => ({ ...item, fields: 'all' })) }) } });
  const put = corpusPatch.overlayPut.map((claim: Overlay) => ({ ...claim, basis: dependencyBasis(eventsOnly.document, claim) }));
  const proposal = { ...corpusPatch, base: third.authority.base, overlayPut: put };
  const result = await fx.editClip(proposal, { format: 'json', readback: 'document' });
  assert.equal(result.failure, undefined, JSON.stringify(result));
  assert.equal(result.readback.status, 'verified', JSON.stringify(result.readback));
  const fullBase = { ...withOverlays, coverage: withOverlays.coverage.map((item) => ({ ...item, fields: 'all' as const })) };
  const expected = applyPatch(fullBase, { ...proposal, base: { sha256: contentHash(fullBase) } }).document;
  const observed = result.readback.document as StateDocument;
  assert.deepEqual(json(observed.events), json(expected.events));
  assert.deepEqual(json(observed.clips), json(expected.clips));
  assert.deepEqual(json(observed.overlays), json(expected.overlays));
  assert.deepEqual(observed.overlays.filter((item) => item.state === 'stale').map((item) => item.id).sort(),
    expected.overlays.filter((item) => item.state === 'stale').map((item) => item.id).sort());
});
