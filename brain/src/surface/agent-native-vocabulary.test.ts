/**
 * 8h4f: one address, health, result, and error vocabulary over the complete agent-native-v1 list.
 *
 * Every tool has one case. A case with a missing target must return the failure envelope with a stable code; a
 * case without a target must return a result with its schema. A new tool without a case fails this test.
 */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { z } from 'zod';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { FAILURE_CODES } from './agent-native-result.js';
import { MEASURED_BODY_SCHEMAS, measuredBody } from './agent-native-retained.js';
import { AGENT_NATIVE_TOOL_PROFILE, AGENT_NATIVE_TOOLS, callTool } from './tools.js';
import { workspaceOf } from './workspace.js';

type Wire = Record<string, any>;
const MISSING = 'missing-track';
const SHA = '0'.repeat(64);
const DOCUMENT = ['DOC ghostnote-document 1.0 desired', 'CLIP {"id":"c1","length":"4","loop":{"from":"0","to":"4"}}',
  'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"c1","fields":"all","from":"0","status":"complete","to":"4"}',
  'FIELDS id clip at duration pitch velocity channel', 'EVENT n0 c1 0 1/2 60 100 1'].join('\n') + '\n';
const deviceAt = { trackId: MISSING, devicePosition: 0 };
const PRESET = fileURLToPath(new URL('../../fixtures/Polysynth/mp_bare.bwpreset', import.meta.url));

/** One case for each tool: the input and the expected envelope. */
const CASES: Readonly<Record<string, { readonly input: Wire; readonly expect: 'success' | 'failure' }>> = {
  list_modulator_types: { input: {}, expect: 'success' },
  check_bitwig_connection: { input: {}, expect: 'success' },
  list_tracks: { input: {}, expect: 'success' },
  list_changes: { input: {}, expect: 'success' },
  check_revert: { input: { changeId: 'no-such-change' }, expect: 'failure' },
  launch_clip: { input: { trackId: MISSING, row: 0, quantization: 'none', mode: 'default' }, expect: 'failure' },
  add_tracks: { input: { tracks: [{ name: 'gn-audio', kind: 'audio' }] }, expect: 'success' },
  duplicate_track: { input: { trackId: MISSING, name: 'copy' }, expect: 'failure' },
  rename_track: { input: { tracks: [{ trackId: MISSING, name: 'x' }] }, expect: 'failure' },
  add_scenes: { input: { count: 1 }, expect: 'success' },
  wrap_existing_device_modulation: { input: { ...deviceAt, expectedDeviceOrder: [{ name: 'X', enabled: true }],
    containerKind: 'FX Layer', entryName: 'Layer 1',
    modulators: [{ modulator: 'lfo', target: { parameterId: 'CONTENTS/P1', parameterName: 'P' }, amount: 0.5 }] }, expect: 'failure' },
  reverse_existing_device_modulation_wrap: { input: { checkpoint: { schemaVersion: 1, state: 'wrapped', trackId: MISSING,
    containerKind: 'FX Layer', entryName: 'Layer 1', currentEntryName: 'Layer 1', containerInsertChangeId: 'none',
    insertedContainerPosition: 0, currentContainerPosition: 0, originalDeviceOrder: [{ name: 'X', enabled: true }],
    device: { originalPosition: 0, name: 'X', enabled: true,
      parameterFingerprint: { algorithm: 'sha256', sha256: SHA, parameterCount: 1 } } } }, expect: 'failure' },
  set_device_enabled: { input: { settings: [{ ...deviceAt, enabled: false }] }, expect: 'failure' },
  revert_change: { input: { changeId: 'no-such-change' }, expect: 'failure' },
  delete_track: { input: { trackIds: [MISSING] }, expect: 'failure' },
  delete_scene: { input: { rows: [40] }, expect: 'failure' },
  delete_device: { input: { devices: [deviceAt] }, expect: 'failure' },
  read_launcher_clip: { input: { trackId: MISSING, row: 0 }, expect: 'failure' },
  check_launcher_clips: { input: { refs: ['no-such-ref'] }, expect: 'success' },
  edit_launcher_clip: { input: { trackId: MISSING, row: 0, document: DOCUMENT }, expect: 'failure' },
  add_launcher_clip: { input: { trackId: MISSING, row: 0, document: DOCUMENT }, expect: 'failure' },
  copy_launcher_clips: { input: { copies: [{ source: { trackId: MISSING, row: 0 }, destination: { trackId: MISSING,
    row: 1 } }] }, expect: 'failure' },
  move_launcher_clips: { input: { trackId: MISSING, firstRow: 0, lastRow: 0, destinationFirstRow: 1 }, expect: 'failure' },
  set_launcher_clip_launch_settings: { input: { clips: [{ trackId: MISSING, row: 0, quantization: 'none',
    mode: 'default' }] }, expect: 'failure' },
  set_launcher_clip_properties: { input: { clips: [{ trackId: MISSING, row: 0, properties: { name: 'x' } }] },
    expect: 'failure' },
  delete_launcher_clip: { input: { clips: [{ trackId: MISSING, row: 0 }] }, expect: 'failure' },
  show_launcher_clip_in_detail_editor: { input: { trackId: MISSING, row: 0 }, expect: 'failure' },
  read_devices: { input: { trackId: MISSING }, expect: 'failure' },
  read_device_controls: { input: { device: deviceAt }, expect: 'failure' },
  set_device_controls: { input: { settings: [{ kind: 'direct', device: deviceAt, parameterId: 'P1',
    normalizedValue: 0.5 }] }, expect: 'failure' },
  read_preset_modulation: { input: { presetPath: '/no/such/preset.bwpreset' }, expect: 'failure' },
  edit_preset_modulation: { input: { trackId: MISSING, presetPath: PRESET,
    fingerprint: { algorithm: 'sha256', sha256: SHA, byteLength: 1 }, location: { kind: 'self' },
    operation: { kind: 'delete', position: 0 }, structuralCheck: { kind: 'inserted-host' } }, expect: 'failure' },
  add_devices: { input: { trackId: MISSING, devices: [{ kind: 'native', name: 'Polysynth' }] }, expect: 'failure' },
  compose_devices: { input: { trackId: MISSING, containerKind: 'FX Layer', layerChains: [
    { name: 'A', devices: [{ source: { kind: 'native', name: 'EQ+' } }] }] }, expect: 'failure' },
  duplicate_layer_chain: { input: { trackId: MISSING, containerPosition: 0, layerChain: 'A', name: 'B' }, expect: 'failure' },
  rename_layer_chain: { input: { trackId: MISSING, containerPosition: 0, layerChain: 'A', name: 'B' }, expect: 'failure' },
  move_devices: { input: { trackId: MISSING, devices: [{ from: 'top-level', devicePosition: 0 }],
    destination: { to: 'layer-chain', containerPosition: 0, layerChain: 'A' } }, expect: 'failure' },
  copy_devices: { input: { trackId: MISSING, devices: [{ from: 'top-level', devicePosition: 0 }],
    destination: { to: 'layer-chain', containerPosition: 0, layerChain: 'A' } }, expect: 'failure' },
  set_layer_chain_solo: { input: { trackId: MISSING, containerPosition: 0, layerChain: 'A', mode: 'exclusive' },
    expect: 'failure' },
};

/** The expected code of each failure case: absent (a missing target), except these. */
const CODES: Readonly<Record<string, string>> = {
  edit_launcher_clip: 'invalid-ref',
  reverse_existing_device_modulation_wrap: 'unsupported',
};

/** Project-index and implementation names that no public input uses (interface audit, target conventions). */
const BANNED_INPUT_NAMES = /^(channelId|trackIndex|slotIndex|sceneIndex|clipIndex|chainIndex|index|cursor\w*|alternate\w*|take\w*|stash\w*)$/;

function properties(schema: unknown, out: { name: string; siblings: string[] }[] = []): typeof out {
  if (Array.isArray(schema)) {
    for (const item of schema) properties(item, out);
  } else if (schema !== null && typeof schema === 'object') {
    const record = schema as Record<string, unknown>;
    const props = record['properties'];
    if (props !== null && typeof props === 'object') {
      const names = Object.keys(props);
      for (const name of names) out.push({ name, siblings: names });
    }
    for (const value of Object.values(record)) properties(value, out);
  }
  return out;
}

function workspace() {
  const fake = new FakeAdapter({ tracks: ['gn-a'], scenes: 4 });
  let id = 0;
  return workspaceOf({
    ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `v-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(), documents: new IdentityRegistry(),
  });
}

test('8h4f vocabulary: every agent-native-v1 tool declares its schema and envelope', () => {
  assert.equal(AGENT_NATIVE_TOOLS.length, 39);
  assert.deepEqual(Object.keys(CASES).sort(), AGENT_NATIVE_TOOLS.map((spec) => spec.name).sort(),
    'each tool has exactly one vocabulary case');
  for (const spec of AGENT_NATIVE_TOOLS) {
    const contract = spec.resultContract as Wire | undefined;
    assert.equal(contract?.['profile'], AGENT_NATIVE_TOOL_PROFILE, spec.name);
    assert.match(String(contract?.['schema']), /^ghostnote-[a-z-]+\/\d+$/, spec.name);
    assert.ok(spec.name === spec.name.toLowerCase() && !/clip(?!s?$)|_clip_/.test(spec.name.replace('launcher_clip', '')),
      `${spec.name}: a clip tool names the Launcher scope`);
  }
});

test('8h4f vocabulary: public inputs use trackId, row, and devicePosition, not project indexes', () => {
  for (const spec of AGENT_NATIVE_TOOLS) {
    const schema = z.toJSONSchema(spec.inputValidator ?? z.object(spec.inputSchema), { target: 'draft-7', io: 'input' });
    for (const { name, siblings } of properties(schema)) {
      assert.doesNotMatch(name, BANNED_INPUT_NAMES, `${spec.name}: input ${name}`);
      // A project device address uses devicePosition. `position` stays only inside a saved preset path.
      if (siblings.includes('trackId')) assert.notEqual(name, 'position', `${spec.name}: a device address uses devicePosition`);
    }
  }
});

test('8h4f vocabulary: each tool answers with its schema, and each failure with a stable code', async () => {
  for (const spec of AGENT_NATIVE_TOOLS) {
    const item = CASES[spec.name]!;
    const result = await callTool(workspace(), spec.name, item.input, AGENT_NATIVE_TOOL_PROFILE) as Wire;
    const contract = spec.resultContract as Wire;
    const text = JSON.stringify(result).slice(0, 400);
    assert.equal(result['schema'], contract['schema'], `${spec.name}: ${text}`);
    if (item.expect === 'failure') {
      assert.ok(FAILURE_CODES.includes(result['failure']?.code), `${spec.name} must fail with a stable code: ${text}`);
      assert.equal(result['failure'].code, CODES[spec.name] ?? 'absent', `${spec.name}: ${text}`);
      assert.ok(Array.isArray(result['failure'].effects), spec.name);
      assert.equal(typeof result['failure'].stage, 'string', spec.name);
      assert.equal(result['refused'] === true && MEASURED_BODY_SCHEMAS[spec.name] === undefined, false, spec.name);
    } else {
      assert.equal(result['failure'], undefined, `${spec.name} must succeed: ${text}`);
    }
  }
});

test('8h4f add_tracks makes an audio track; duplicate_track refuses an unproved kind before a write', async () => {
  const ws = workspace();
  const added = await callTool(ws, 'add_tracks', { tracks: [{ name: 'gn-audio', kind: 'audio' }, { name: 'gn-inst' }] },
    AGENT_NATIVE_TOOL_PROFILE) as Wire;
  assert.equal(added['readback'].status, 'verified', JSON.stringify(added));
  assert.deepEqual(added['readback'].tracks.map((item: Wire) => [item.name, item.kind]),
    [['gn-audio', 'Audio'], ['gn-inst', 'Instrument']]);
  assert.equal(added['effects'].length, 2, 'the creation and the naming are two changes');
  const audio = added['readback'].tracks[0].trackId as string;
  const copy = await callTool(ws, 'duplicate_track', { trackId: audio, name: 'gn-audio copy' },
    AGENT_NATIVE_TOOL_PROFILE) as Wire;
  assert.equal(copy['readback'].status, 'verified', JSON.stringify(copy));
  assert.equal(copy['readback'].copy.kind, 'Audio');
  const listed = await callTool(ws, 'list_tracks', {}, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const master = (listed['data'].tracks as Wire[]).find((item) => item.kind === 'Master');
  if (master !== undefined) {
    const before = (listed['data'].tracks as Wire[]).length;
    const refused = await callTool(ws, 'duplicate_track', { trackId: master.trackId, name: 'x' },
      AGENT_NATIVE_TOOL_PROFILE) as Wire;
    assert.equal(refused['failure'].code, 'unsupported');
    assert.equal(refused['detail'].reason, 'track-kind');
    assert.equal(((await callTool(ws, 'list_tracks', {}, AGENT_NATIVE_TOOL_PROFILE) as Wire)['data'].tracks as Wire[]).length,
      before, 'nothing was written');
  }
  const changes = await callTool(ws, 'list_changes', {}, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  assert.equal(changes['coverage'].total, 4);
  const places = (changes['data'].changes as Wire[]).flatMap((item) => item.places as Wire[]);
  assert.ok(places.every((place) => ['track', 'scene', 'launcher_clip', 'device', 'device_control'].includes(place.what)));
});

test('8h4f review P2: a wrap stage that the revision guard rejects returns target-changed with no effect', async () => {
  const fake = new FakeAdapter({ tracks: ['gn-wrap'], scenes: 1 });
  const row = fake.model.visibleTracks()[0]!;
  row.devices.push({ name: 'Polysynth', enabled: true, paramsLive: true, params: [{ id: 'CONTENTS/P1', name: 'Cutoff', value: 0.5 }] });
  let id = 0;
  const base = workspaceOf({
    ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `w-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(), documents: new IdentityRegistry(),
  });
  // A stale revision guard: the executor rejects the first stage whole.
  const ws = { ...base, apply: (ops: Parameters<typeof base.apply>[0], run?: Parameters<typeof base.apply>[1]) =>
    base.apply(ops, { ...run, ifRevision: -1 }) };
  const result = await callTool(ws, 'wrap_existing_device_modulation', { trackId: row.channelId, devicePosition: 0,
    expectedDeviceOrder: [{ name: 'Polysynth', enabled: true }], containerKind: 'FX Layer', entryName: 'Layer 1',
    modulators: [{ modulator: 'lfo', target: { parameterId: 'CONTENTS/P1', parameterName: 'Cutoff' }, amount: 0.5 }] },
  AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const text = JSON.stringify(result).slice(0, 600);
  assert.equal(result['complete'], false, text);
  assert.equal(result['failure']?.code, 'target-changed', text);
  assert.deepEqual(result['failure'].effects, []);
  assert.deepEqual(row.devices.map((item) => item.name), ['Polysynth'], 'nothing was written');
});

test('8h4f review P1: a throw after a recorded write keeps its effects', async () => {
  const fake = new FakeAdapter({ tracks: ['gn-throw'], scenes: 1 });
  const row = fake.model.visibleTracks()[0]!;
  let id = 0;
  const ws = workspaceOf({
    ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `t-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(), documents: new IdentityRegistry(),
  });
  // The shape of runModulatorAuthoring: a recorded write, then a verification that throws.
  const stable = { ...AGENT_NATIVE_TOOLS.find((spec) => spec.name === 'edit_preset_modulation')!,
    run: async (workspace: typeof ws) => {
      await workspace.apply([{ op: 'track.rename', track: { kind: 'track', channelId: row.channelId }, name: 'renamed' }]);
      throw new Error('verification aborted after the insertion');
    } } as never;
  const result = await measuredBody(stable, 'ghostnote-test/1').run(ws, {} as never) as Wire;
  assert.equal(result['failure'].code, 'partial', JSON.stringify(result));
  assert.equal(result['failure'].effects.length, 1);
  assert.equal(result['failure'].effects[0].changeId, ws.changes.list()[0]!.id);
  assert.equal(result['diagnostic'].error, 'verification aborted after the insertion');
});
