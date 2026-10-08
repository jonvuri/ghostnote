/**
 * 8h4d: the Launcher clip and scene tools of `agent-native-v1`, the generic operation handle, observation
 * decoupling, and the D19 change-record rule, on the fake adapter.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { EXACT_CLIP_COLORS, scene, slot, track, type NoteRecord } from '../contract/index.js';
import { parse, type StateDocument } from '../document/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore, type StoredObservationRecord } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_RETIRED, AGENT_NATIVE_TOOL_PROFILE, STABLE_TOOL_PROFILE, callTool, toolsForProfile } from './tools.js';
import { workspaceOf } from './workspace.js';

type Wire = Record<string, any>;

/** A store whose every access fails: capture must not reach it, and a write result must not change. */
class FailingObservationStore extends FakeObservationStore {
  accesses = 0;
  override async read(): Promise<StoredObservationRecord> {
    this.accesses += 1;
    throw new Error('observation storage is unavailable');
  }
  override async replace(): Promise<StoredObservationRecord> {
    this.accesses += 1;
    throw new Error('observation storage is unavailable');
  }
}

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, releaseVelocity: 100 / 127,
  isChanceEnabled: true, isOccurrenceEnabled: true, isRecurrenceEnabled: true, isRepeatEnabled: true, ...over,
});

const PALETTE_RED = { ...EXACT_CLIP_COLORS[0]!.color };

function fixture(observationStore: FakeObservationStore = new FakeObservationStore()) {
  const fake = new FakeAdapter({ tracks: ['gn-clips', 'gn-other'], scenes: 6 });
  const [first, second] = fake.model.visibleTracks();
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `clips-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore, documents: new IdentityRegistry(),
  });
  const trackId = first!.channelId;
  const native = async (name: string, args: Wire): Promise<Wire> =>
    await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const stable = async (name: string, args: Wire): Promise<Wire> =>
    await callTool(workspace, name, args, STABLE_TOOL_PROFILE) as Wire;
  const records = () => workspace.changes.list().length;
  /** A clip with four notes on channel 1 and the palette colour, written as an operator edit would. */
  const seed = async (row: number, lengthBeats = 8) => {
    const at = await fake.revision();
    await workspace.apply([{ op: 'clip.create', slot: slot(track(trackId), scene(row, at.sceneEpoch)), lengthBeats }]);
    const fakeSlot = fake.model.visibleTracks()[0]!.slots[row]!;
    for (let k = 0; k < 4; k += 1) fakeSlot.notes.set(`0:${60 + k}:${k}`, note({ pitch: 60 + k, startBeats: k }));
    fakeSlot.color = PALETTE_RED;
    fake.model.revision += 1;
  };
  const occupied = (row: number, trackIndex = 0) => fake.model.visibleTracks()[trackIndex]!.slots[row]?.hasContent === true;
  return { fake, workspace, trackId, otherId: second!.channelId, native, stable, records, seed, occupied };
}

const desired = (lines: string[], length = '8') => ['DOC ghostnote-document 1.0 desired',
  `CLIP ${JSON.stringify({ id: 'c1', length })}`,
  `COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"c1","fields":"all","from":"0","status":"complete","to":"${length}"}`,
  'FIELDS id clip at duration pitch velocity channel', ...lines.map((line) => `EVENT ${line}`)].join('\n') + '\n';

// --- profile ---------------------------------------------------------------------

test('8h4d profile: every retired tool has a replacement and is absent from agent-native-v1', () => {
  const native = new Set(toolsForProfile(AGENT_NATIVE_TOOL_PROFILE).map((spec) => spec.name));
  const stable = new Set(toolsForProfile(STABLE_TOOL_PROFILE).map((spec) => spec.name));
  for (const [name, replacement] of Object.entries(AGENT_NATIVE_RETIRED)) {
    assert.equal(stable.has(name), true, `${name} is a stable tool`);
    assert.equal(native.has(name), false, `${name} is retired`);
    assert.ok(replacement.length > 0);
  }
  for (const name of ['generate_clip_music', 'transform_clip_music', 'copy_clip_down', 'record_observation',
    'read_observation_record', 'report_observations']) assert.equal(native.has(name), false, name);
});

// --- add_launcher_clip -----------------------------------------------------------

test('8h4d add_launcher_clip: creates the clip and its notes in two changes and returns a usable base', async () => {
  const fx = fixture();
  const result = await fx.native('add_launcher_clip', { trackId: fx.trackId, row: 1,
    document: desired(['n1 c1 0 1 60 100 1', 'n2 c1 1 1/2 64 90 2', 'n3 c1 3 1 67 80 16']) });
  assert.equal(result.schema, 'ghostnote-launcher-clip-add/1', JSON.stringify(result).slice(0, 400));
  assert.equal(result.applied, true);
  assert.equal(result.effects.length, 2);
  assert.equal(result.readback.status, 'verified');
  assert.deepEqual(result.next.revert.map((item: Wire) => item.changeId),
    [result.effects[1].changeId, result.effects[0].changeId]);
  assert.equal(fx.occupied(1), true);
  const read = await fx.native('read_launcher_clip', { trackId: fx.trackId, row: 1 });
  assert.equal(read.authority.base.ref, result.readback.base.ref, 'the read is current on the added base');
  const document = parse(read.data.document, 'fields') as StateDocument;
  assert.deepEqual(document.events.map((event) => [event.pitch, event.channel ?? 1]), [[60, 1], [64, 2], [67, 16]]);
  assert.equal(document.clips[0]!.length, '8');

  // Revert in next.revert order: the content, then the creation, removes the clip.
  for (const step of result.next.revert) await fx.native('revert_change', { changeId: step.changeId });
  assert.equal(fx.occupied(1), false);
});

test('8h4d add_launcher_clip: an occupied slot, a missing row, and a patch refuse before any write', async () => {
  const fx = fixture();
  await fx.seed(0);
  const before = fx.records();
  const occupied = await fx.native('add_launcher_clip', { trackId: fx.trackId, row: 0, document: desired([]) });
  assert.equal(occupied.failure.code, 'occupied');
  assert.deepEqual(occupied.failure.effects, []);
  const missing = await fx.native('add_launcher_clip', { trackId: fx.trackId, row: 9, document: desired([]) });
  assert.equal(missing.failure.code, 'absent');
  const patch = await fx.native('add_launcher_clip', { trackId: fx.trackId, row: 2,
    document: 'DOC ghostnote-document 1.0 patch\nBASE {"sha256":"' + '0'.repeat(64) + '","ref":"x"}\n' });
  assert.equal(patch.failure.code, 'invalid-input');
  assert.equal(fx.records(), before, 'no change record');
  assert.equal(fx.occupied(2), false);
});

test('8h4d add_launcher_clip: a content refusal after creation reports the creation as its effect', async () => {
  const fx = fixture();
  const result = await fx.native('add_launcher_clip', { trackId: fx.trackId, row: 2,
    document: desired(['n1 c1 7 2 60 100 1']) });
  assert.equal(result.failure.code, 'range', JSON.stringify(result).slice(0, 300));
  assert.equal(result.failure.effects.length, 1);
  assert.equal(result.detail.revert.changeId, result.failure.effects[0].changeId);
  assert.equal(fx.occupied(2), true, 'the empty clip stays');
  await fx.native('revert_change', { changeId: result.detail.revert.changeId });
  assert.equal(fx.occupied(2), false);
});

// --- copy and move ---------------------------------------------------------------

test('8h4d copy_launcher_clips: copies below, reports occupancy, and guards the destination', async () => {
  const fx = fixture();
  await fx.seed(0);
  const pair = { source: { trackId: fx.trackId, row: 0 }, destination: { trackId: fx.trackId, row: 1 } };
  const dry = await fx.native('copy_launcher_clips', { copies: [pair], dryRun: true });
  assert.equal(dry.applied, false);
  assert.deepEqual(dry.occupancy, [{ source: { ...pair.source, occupancy: 'occupied' },
    destination: { ...pair.destination, occupancy: 'empty' } }]);
  assert.equal(fx.occupied(1), false);

  const copied = await fx.native('copy_launcher_clips', { copies: [pair] });
  assert.equal(copied.applied, true);
  assert.equal(copied.readback.status, 'verified');
  assert.equal(copied.effects.length, 1);
  assert.equal(fx.occupied(1), true);

  const records = fx.records();
  const blocked = await fx.native('copy_launcher_clips', { copies: [pair] });
  assert.equal(blocked.failure.code, 'occupied');
  assert.equal(blocked.occupancy[0].destination.occupancy, 'occupied');
  const far = await fx.native('copy_launcher_clips', { copies: [{ source: pair.source,
    destination: { trackId: fx.trackId, row: 3 } }] });
  assert.equal(far.failure.code, 'unsupported');
  assert.equal(far.detail.reason, 'copy-destination');
  const empty = await fx.native('copy_launcher_clips', { copies: [{ source: { trackId: fx.trackId, row: 3 },
    destination: { trackId: fx.trackId, row: 4 } }] });
  assert.equal(empty.failure.code, 'absent');
  assert.equal(fx.records(), records, 'refusals record nothing');

  await fx.native('revert_change', { changeId: copied.effects[0].changeId });
  assert.equal(fx.occupied(1), false);
});

test('8h4d move_launcher_clips: occupancy of source, destination, and boundary rows; the exact reverse', async () => {
  const fx = fixture();
  await fx.seed(0);
  await fx.seed(1);
  const args = { trackId: fx.trackId, firstRow: 0, lastRow: 1, destinationFirstRow: 3 };
  const dry = await fx.native('move_launcher_clips', { ...args, dryRun: true });
  assert.equal(dry.applied, false);
  assert.deepEqual(dry.occupancy.map((item: Wire) => [item.row, item.role, item.occupancy]), [
    [0, 'source', 'occupied'], [1, 'source', 'occupied'], [2, 'boundary', 'empty'],
    [3, 'destination', 'empty'], [4, 'destination', 'empty'], [5, 'boundary', 'empty'],
  ]);
  const moved = await fx.native('move_launcher_clips', args);
  assert.equal(moved.applied, true, JSON.stringify(moved).slice(0, 300));
  assert.equal(moved.readback.status, 'verified');
  assert.deepEqual([0, 1, 3, 4].map((row) => fx.occupied(row)), [false, false, true, true]);
  const { tool: _tool, ...reverse } = moved.next.reverse;
  const back = await fx.native('move_launcher_clips', reverse);
  assert.equal(back.applied, true);
  assert.deepEqual([0, 1, 3, 4].map((row) => fx.occupied(row)), [true, true, false, false]);

  await fx.seed(5);
  const blocked = await fx.native('move_launcher_clips', args);
  assert.equal(blocked.failure.code, 'occupied');
  assert.deepEqual(blocked.detail.rows, [5]);
  assert.equal(blocked.occupancy.find((item: Wire) => item.row === 5).occupancy, 'occupied');
  const edge = await fx.native('move_launcher_clips', { trackId: fx.trackId, firstRow: 0, lastRow: 0,
    destinationFirstRow: 5 });
  assert.equal(edge.failure.code, 'absent', 'the scene below the destination must exist');
});

// --- properties and launch settings ------------------------------------------------

test('8h4d set_launcher_clip_properties: one writer, loop end follows length, palette guard, exact revert', async () => {
  const fx = fixture();
  await fx.seed(0);
  const result = await fx.native('set_launcher_clip_properties', { clips: [{ trackId: fx.trackId, row: 0,
    properties: { name: 'verse', lengthBeats: 4 } }] });
  assert.equal(result.applied, true, JSON.stringify(result).slice(0, 300));
  assert.equal(result.readback.status, 'verified');
  const after = result.readback.clips[0].properties;
  assert.equal(after.name, 'verse');
  assert.equal(after.loopEndBeats, after.loopStartBeats + 4);

  const off = await fx.native('set_launcher_clip_properties', { clips: [{ trackId: fx.trackId, row: 0,
    properties: { color: { red: 1, green: 2, blue: 3 } } }] });
  assert.equal(off.failure.code, 'unsupported');
  assert.equal(off.detail.reason, 'clip-colour');
  assert.ok(Array.isArray(off.detail.supportedClipColors));
  const loop = await fx.native('set_launcher_clip_properties', { clips: [{ trackId: fx.trackId, row: 0,
    properties: { loopEndBeats: 99 } }] });
  assert.equal(loop.failure.code, 'invalid-input');

  await fx.native('revert_change', { changeId: result.effects[0].changeId });
  const read = await fx.native('read_launcher_clip', { trackId: fx.trackId, row: 0 });
  assert.equal((parse(read.data.document, 'fields') as StateDocument).clips[0]!.length, '8');
});

test('8h4d set_launcher_clip_launch_settings: verified readback and a recorded change', async () => {
  const fx = fixture();
  await fx.seed(0);
  const result = await fx.native('set_launcher_clip_launch_settings', { clips: [{ trackId: fx.trackId, row: 0,
    quantization: '1', mode: 'continue_or_synced' }] });
  assert.equal(result.applied, true, JSON.stringify(result).slice(0, 300));
  assert.equal(result.readback.status, 'verified');
  assert.equal(result.effects.length, 1);
  const empty = await fx.native('set_launcher_clip_launch_settings', { clips: [{ trackId: fx.trackId, row: 3,
    quantization: '1', mode: 'continue_or_synced' }] });
  assert.equal(empty.failure.code, 'absent');
});

test('8h4d delete_launcher_clip: destructive, reversible, and refuses an empty slot', async () => {
  const fx = fixture();
  await fx.seed(0);
  const spec = toolsForProfile(AGENT_NATIVE_TOOL_PROFILE).find((item) => item.name === 'delete_launcher_clip')!;
  assert.equal(spec.kind, 'destructive');
  const deleted = await fx.native('delete_launcher_clip', { clips: [{ trackId: fx.trackId, row: 0 }] });
  assert.equal(deleted.applied, true, JSON.stringify(deleted).slice(0, 300));
  assert.equal(deleted.readback.status, 'verified');
  assert.equal(fx.occupied(0), false);
  const again = await fx.native('delete_launcher_clip', { clips: [{ trackId: fx.trackId, row: 0 }] });
  assert.equal(again.failure.code, 'absent');
  await fx.native('revert_change', { changeId: deleted.effects[0].changeId });
  assert.equal(fx.occupied(0), true);
});

// --- D19: change records ---------------------------------------------------------

test('8h4d D19: reads, navigation, and a launch create no change record; each durable effect creates one', async () => {
  const fx = fixture();
  await fx.seed(0);
  const counted = async (name: string, args: Wire): Promise<{ result: Wire; added: number }> => {
    const before = fx.records();
    const result = await fx.native(name, args);
    assert.equal(result.failure, undefined, `${name}: ${JSON.stringify(result).slice(0, 300)}`);
    return { result, added: fx.records() - before };
  };
  const read = await counted('read_launcher_clip', { trackId: fx.trackId, row: 0 });
  const none: [string, Wire][] = [
    ['list_tracks', {}],
    ['read_launcher_clip', { trackId: fx.trackId, row: 0 }],
    ['check_launcher_clips', { refs: [read.result.authority.base.ref] }],
    ['show_launcher_clip_in_detail_editor', { trackId: fx.trackId, row: 0 }],
    ['launch_clip', { trackId: fx.trackId, row: 0, quantization: 'none', mode: 'from_start' }],
    ['copy_launcher_clips', { copies: [{ source: { trackId: fx.trackId, row: 0 },
      destination: { trackId: fx.trackId, row: 1 } }], dryRun: true }],
    ['move_launcher_clips', { trackId: fx.trackId, firstRow: 0, lastRow: 0, destinationFirstRow: 2, dryRun: true }],
  ];
  for (const [name, args] of none) assert.equal((await counted(name, args)).added, 0, name);
  const launched = await fx.native('launch_clip', { trackId: fx.trackId, row: 0, quantization: 'none', mode: 'from_start' });
  assert.deepEqual(launched.effects, []);
  assert.ok(launched.readback.playback !== null);
  const shown = await fx.native('show_launcher_clip_in_detail_editor', { trackId: fx.trackId, row: 0 });
  assert.deepEqual(shown.effects, []);

  const durable: [string, Wire][] = [
    ['add_launcher_clip', { trackId: fx.otherId, row: 0, document: desired(['n1 c1 0 1 60 100 1']) }],
    ['copy_launcher_clips', { copies: [{ source: { trackId: fx.trackId, row: 0 },
      destination: { trackId: fx.trackId, row: 1 } }] }],
    ['move_launcher_clips', { trackId: fx.trackId, firstRow: 0, lastRow: 1, destinationFirstRow: 3 }],
    ['set_launcher_clip_launch_settings', { clips: [{ trackId: fx.trackId, row: 3, quantization: '1', mode: 'from_start' }] }],
    ['set_launcher_clip_properties', { clips: [{ trackId: fx.trackId, row: 3, properties: { name: 'kept' } }] }],
    ['delete_launcher_clip', { clips: [{ trackId: fx.trackId, row: 4 }] }],
    ['add_scenes', { count: 1 }],
    ['delete_scene', { rows: [6] }],
  ];
  for (const [name, args] of durable) {
    const { result, added } = await counted(name, args);
    assert.equal(added, result.effects.length, name);
    assert.ok(added >= 1, name);
    for (const effect of result.effects) assert.equal(typeof effect.changeId, 'string', name);
  }
  const empty = await fx.native('launch_clip', { trackId: fx.trackId, row: 4, quantization: 'none', mode: 'from_start' });
  assert.equal(empty.failure.code, 'absent');
});

// --- observation decoupling ------------------------------------------------------

test('8h4d observation: agent-native-v1 copy_track does not touch the store; 8h4e retires the alternates', async () => {
  const store = new FailingObservationStore();
  const fx = fixture(store);
  const copied = await fx.native('copy_track', { trackId: fx.trackId, name: 'copy' });
  assert.equal(copied['copyConfirmed'], true, JSON.stringify(copied).slice(0, 300));
  const native = new Set(toolsForProfile(AGENT_NATIVE_TOOL_PROFILE).map((spec) => spec.name));
  assert.equal(native.has('create_device_alternates'), false);
  assert.equal(toolsForProfile(AGENT_NATIVE_TOOL_PROFILE).some((spec) => spec.observation === 'device-alternate'), false);
  for (const result of [copied]) {
    for (const key of ['ordinaryUseId', 'managedEventId', 'musicalUseId', 'observationFailure', 'observation']) {
      assert.equal(key in result, false, key);
    }
  }
  assert.equal(store.accesses, 0, 'no capture reached the store');
});

test('8h4d observation: the same storage failure still shows in stable-v1 (frozen behaviour)', async () => {
  const store = new FailingObservationStore();
  const fx = fixture(store);
  const copied = await fx.stable('copy_track', { trackId: fx.trackId, name: 'copy' });
  // stable-v1 wraps the write result in a partial-success envelope; agent-native-v1 returns it directly.
  assert.equal(copied['partialSuccess'], true);
  assert.equal(copied['projectWrite'].result.copyConfirmed, true);
  assert.ok(store.accesses > 0);
});

test('8h4d observation: the retired capture sites are not in agent-native-v1; their replacements capture nothing', async () => {
  const store = new FailingObservationStore();
  const fx = fixture(store);
  await fx.seed(0);
  const native = new Set(toolsForProfile(AGENT_NATIVE_TOOL_PROFILE).map((spec) => spec.name));
  for (const site of ['generate_clip_music', 'transform_clip_music', 'copy_clip_down']) assert.equal(native.has(site), false);
  const copied = await fx.native('copy_launcher_clips', { copies: [{ source: { trackId: fx.trackId, row: 0 },
    destination: { trackId: fx.trackId, row: 1 } }] });
  assert.equal(copied.applied, true);
  const read = await fx.native('read_launcher_clip', { trackId: fx.trackId, row: 0 });
  const edited = await fx.native('edit_launcher_clip', { trackId: fx.trackId, row: 0, document: [
    'DOC ghostnote-document 1.0 patch', `BASE ${JSON.stringify(read.authority.base)}`,
    'FIELDS id clip at duration pitch velocity channel',
    `ADD x1 ${(parse(read.data.document, 'fields') as StateDocument).clips[0]!.id} 6 1 72 100 1`].join('\n') + '\n' });
  assert.equal(edited.applied, true, JSON.stringify(edited).slice(0, 300));
  assert.equal(store.accesses, 0);
});

// --- background operations -------------------------------------------------------

test('8h4d operations: background edit returns a handle; inspect_operation returns the direct result', async () => {
  const fx = fixture();
  await fx.seed(0);
  const read = await fx.native('read_launcher_clip', { trackId: fx.trackId, row: 0 });
  const clipId = (parse(read.data.document, 'fields') as StateDocument).clips[0]!.id;
  const started = await fx.native('edit_launcher_clip', { trackId: fx.trackId, row: 0, background: true, document: [
    'DOC ghostnote-document 1.0 patch', `BASE ${JSON.stringify(read.authority.base)}`,
    'FIELDS id clip at duration pitch velocity channel', `ADD x1 ${clipId} 6 1 72 100 1`].join('\n') + '\n' });
  assert.equal(started.schema, 'ghostnote-operation/1');
  assert.equal(started.operation.operation, 'edit_launcher_clip');
  assert.equal(started.operation.terminal, false);
  await fx.workspace.operations.wait(started.operation.operationId);
  const done = await fx.native('inspect_operation', { operationId: started.operation.operationId });
  assert.equal(done.operation.state, 'completed');
  assert.equal(done.operation.result.schema, 'ghostnote-launcher-clip-edit/1');
  assert.equal(done.operation.result.readback.status, 'verified');
  assert.deepEqual(done.operation.changes.map((item: Wire) => item.changeId),
    done.operation.result.effects.map((item: Wire) => item.changeId));
  const repeated = await fx.native('cancel_operation', { operationId: started.operation.operationId });
  assert.equal(repeated.operation.state, 'completed', 'a terminal operation does not change');
  const unknown = await fx.native('inspect_operation', { operationId: 'nope' });
  assert.equal(unknown.failure.code, 'absent');
});

test('8h4d operations: a background add_launcher_clip cancelled before it starts makes no change', async () => {
  const fx = fixture();
  const before = fx.records();
  const started = await fx.native('add_launcher_clip', { trackId: fx.trackId, row: 0, background: true,
    document: desired(['n1 c1 0 1 60 100 1']) });
  const cancelled = await fx.native('cancel_operation', { operationId: started.operation.operationId });
  assert.equal(cancelled.operation.cancellationRequested, true);
  const done = await fx.workspace.operations.wait(started.operation.operationId);
  assert.equal(done.state, 'cancelled');
  assert.equal(fx.records(), before);
  assert.equal(fx.occupied(0), false);
});
