/** Offline checks for audit refusal, ownership, and product recipes. No bridge is used. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listChains } from '../bwmod/index.js';
import { fakeMixerOf } from '../adapters/fake/model.js';
import { inspectPresetModulation } from '../engine/preset-modulation-inspection.js';
import { FakeAdapter } from '../adapters/fake/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { comparable, forkRecovered, prepare, report, requireEntrySelection, validateConfig, validateControlReplyRecovery, validateEmptySelectionRecovery, validateGroupFixture, validateGroupSnapshotRecovery, validateSamplerNameRecovery, validateStructureRecovery } from './bitwig-upgrade-audit.js';

test('preflight requires an empty selected slot on a preserved track', () => {
  const snapshot = { selection: { mixer: 'entry', track: null as string | null, slot: -1 },
    tracks: [{ name: 'entry', clips: [{ row: 0, occupied: false }] }] };
  assert.throws(() => requireEntrySelection(snapshot), /Select an empty Launcher slot/);
  snapshot.selection.track = 'entry'; snapshot.selection.slot = 0;
  requireEntrySelection(snapshot);
  snapshot.tracks[0]!.clips[0]!.occupied = true;
  assert.throws(() => requireEntrySelection(snapshot), /Select an empty Launcher slot/);
});

test('empty-selection recovery admits only the observed setup failure and unchanged content', async () => {
  const owned = ['sentinel', 'notes', 'spare', 'devices', 'single', 'multi']
    .map(role => ({ role, id: role, name: `test-${role}`, type: 'Instrument' }));
  const entry = { scenes: 8, selection: { mixer: 'entry', track: null, slot: -1 },
    tracks: [{ name: 'entry', id: 'entry', clips: [{ row: 0, occupied: false }] }] };
  const before = { ...entry, selection: { mixer: 'entry', track: 'entry', slot: 0 },
    tracks: [...entry.tracks, ...owned.map(row => ({ ...row, clips: [] }))] };
  const state = { completed: ['preflight'], owned, entry,
    inspection: { snapshot: { ...before, selection: { mixer: 'entry', track: 'test-sentinel', slot: 0 } } },
    failure: { command: 'run', arg: 'setup', error: 'add_launcher_clip: selection changed' } };
  const writes = [...Array.from({ length: 6 }, () => ({ name: 'add_tracks' })),
    { name: 'add_launcher_clip', result: { applied: true, readback: { status: 'verified' },
      target: { trackId: 'sentinel', row: 0 }, warnings: [{ code: 'slot-selection-moved', message: 'no slot was selected before the call' }] } }];
  validateEmptySelectionRecovery(state, before, writes);
  assert.throws(() => validateEmptySelectionRecovery({ ...state, pendingWrite: {} }, before, writes), /Uncertain/);
  assert.throws(() => validateEmptySelectionRecovery({ ...state, recovery: {} }, before, writes), /previously started/);
  assert.throws(() => validateEmptySelectionRecovery(state, { ...before, scenes: 7 }, writes), /State changed/);
  assert.throws(() => validateEmptySelectionRecovery(state, { ...before, selection: entry.selection }, writes), /Select the first/);
  assert.throws(() => validateEmptySelectionRecovery(state, before, writes.slice(0, 6)), /write sequence/);
  const bad = structuredClone(writes); (bad[6] as Bag).result.warnings = [];
  assert.throws(() => validateEmptySelectionRecovery(state, before, bad), /Known selection warning/);
  const { Audit } = await import('./bitwig-upgrade-audit.js');
  const dir = mkdtempSync(join(tmpdir(), 'gn-upgrade-recovery-'));
  try {
    const evidence = new Evidence(dir), recoveryState = structuredClone(state) as Bag;
    for (const row of writes) evidence.append('tools.jsonl', row);
    const audit = new Audit(evidence, recoveryState);
    const current = structuredClone(before) as Bag;
    audit.start = async () => {};
    audit.snapshot = async () => structuredClone(current);
    audit.rows = async () => current.tracks.map((row: Bag) => ({ ...row, channelId: row.id }));
    const deleted: string[] = [];
    audit.write = async (name, args) => {
      assert.equal(name, 'delete_track');
      assert.equal(args.trackIds.length, 1);
      const id = args.trackIds[0]; assert(owned.some(row => row.id === id));
      deleted.push(id); current.tracks = current.tracks.filter((row: Bag) => row.id !== id);
      return {};
    };
    await audit.recoverEmptySelection();
    equal(deleted, [...owned].reverse().map(row => row.id), 'Delete only the owned tracks in reverse order');
    equal(recoveryState.failure, state.failure, 'Keep the original failure');
    assert.equal(recoveryState.recovery.completed, true);
    assert.equal(recoveryState.owned.length, 0);
    await assert.rejects(audit.recoverEmptySelection(), /previously started/);
    assert.equal(deleted.length, 6);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
import { CASES, desiredFixture, documentOf, musical, requireAddedAttackRoute, type AuditCase } from './upgrade-audit/cases.js';
import { Evidence, LIMITS, assertMayRun, assertOwned, assertRefusal, assertVerification, assertVersion, checkProcessEntry, equal, validateBounds, type Bag } from './upgrade-audit/safety.js';

test('write verification admits boolean and combined verdicts and refuses false or unknown verdicts', () => {
  for (const verified of [true, { passed: true }]) assertVerification({ verified }, 'test');
  for (const verified of [false, { passed: false }, {}, null]) assert.throws(() => assertVerification({ verified }, 'test'));
  assertVerification({}, 'test');
});

test('structure recovery requires independently proved disable and restores before removal', async () => {
  const { Audit } = await import('./bitwig-upgrade-audit.js');
  const dir = mkdtempSync(join(tmpdir(), 'gn-structure-recovery-'));
  try {
    const selection = { mixer: 'entry', track: 'entry', slot: 0 };
    const track = { id: 'mine', name: 'owned-devices', type: 'Instrument', devices: [], controls: [] };
    const last = { selection, scenes: 8, tracks: [track] };
    const device = { devicePosition: 0, name: 'FX Layer', enabled: false, container: { layerChains: [
      { name: 'A', devices: [{ name: 'Polysynth' }, { name: 'Delay+' }] },
      { name: 'B', devices: [{ name: 'Tool' }, { name: 'Delay+' }] },
    ] } };
    const before = { ...last, tracks: [{ ...track, devices: [device] }] };
    const args = { settings: [{ trackId: 'mine', devicePosition: 0, enabled: false }] };
    const calls = ['compose_devices', 'add_devices', 'copy_devices', 'move_devices', 'set_device_enabled']
      .map(name => ({ name, commandId: 'failed', args, result: { applied: true, readback: { status: 'differs' } } }));
    const state: Bag = { completed: ['preflight', 'setup', 'notes', 'clips', 'mixer', 'controls'], last,
      owned: [{ role: 'devices', id: 'mine', name: track.name, type: 'Instrument' }], inspection: { snapshot: before },
      failure: { command: 'run', arg: 'structure', commandId: 'failed', error: 'set_device_enabled: readback unavailable or differs' },
      pendingWrite: { name: 'set_device_enabled', args, commandId: 'failed' } };
    assert.equal(validateStructureRecovery(state, before, calls), 'mine');
    const different = structuredClone(before); different.tracks[0]!.devices[0]!.enabled = true;
    assert.throws(() => validateStructureRecovery({ ...state, inspection: { snapshot: different } }, different, calls), /Independent disabled/);
    assert.throws(() => validateStructureRecovery({ ...state, recovery: {} }, before, calls), /previously started/);
    assert.throws(() => validateStructureRecovery(state, before, calls.slice(1)), /Exact structure/);
    const evidence = new Evidence(dir);
    for (const call of calls) evidence.append('tools.jsonl', call);
    const audit = new Audit(evidence, state); let removed = false; let enabled = false;
    audit.start = async () => {};
    audit.snapshot = async () => structuredClone(removed ? last : before);
    audit.rows = async () => [{ channelId: 'mine', name: track.name, type: 'Instrument' }];
    audit.devices = async () => removed ? [] : [{ ...device, enabled }];
    const writes: string[] = [];
    audit.write = async (name, input) => {
      writes.push(name);
      if (name === 'set_device_enabled') {
        equal(input, { settings: [{ trackId: 'mine', devicePosition: 0, enabled: true }] }, 'Restore only; never repeat disable');
        enabled = true;
      } else { assert.equal(name, 'delete_device'); assert(enabled); removed = true; }
      return {};
    };
    await audit.recoverStructureReadback();
    equal(writes, ['set_device_enabled', 'delete_device'], 'Bounded recovery sequence');
    assert.equal(state.recovery.completed, true); assert(state.recovery.resolvedIntent); assert(state.failure);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('control recovery proves the completed write and preserves passed cases in a separate record', async () => {
  const { Audit } = await import('./bitwig-upgrade-audit.js');
  const dir = mkdtempSync(join(tmpdir(), 'gn-control-recovery-'));
  try {
    const selection = { mixer: 'entry', track: 'entry', slot: 0 };
    const row = { id: 'mine', index: 1, name: 'owned-devices', type: 'Instrument', devices: [], controls: [] };
    const last = { scenes: 8, selection, tracks: [row] };
    const before = { ...last, tracks: [{ ...row, devices: ['Polysynth', 'Polysynth', 'Diva'].map((name, devicePosition) => ({ name, devicePosition })),
      controls: [0, 1, 2].map(position => ({ position, parameters: [{ id: 'p', name: 'Control', normalizedValue: position === 0 ? 0.25 : 0.5 }] })) }] };
    const plugin = { kind: 'clap', id: 'com.u-he.Diva' };
    const args = { settings: [{ kind: 'direct', device: { trackId: 'mine', devicePosition: 0 }, parameterId: 'p', normalizedValue: 0.25 }] };
    const writes = [
      { commandId: 'failed', name: 'add_devices', args: { trackId: 'mine', devices: [{ kind: 'native', name: 'Polysynth' }, { kind: 'native', name: 'Polysynth' }, plugin] }, result: { applied: true, readback: { status: 'verified' } } },
      ...[0, 1, 2].map(devicePosition => ({ commandId: 'failed', name: 'read_device_controls', args: { device: { trackId: 'mine', devicePosition } }, result: { parameters: [{ id: 'p', name: 'Control', normalizedValue: 0.5 }] } })),
      { commandId: 'failed', name: 'set_device_controls', args, result: { applied: true, partialSuccess: false, verified: true } },
    ];
    const state: Bag = { schema: 'bitwig-upgrade-audit-v1', prefix: 'owned-', config: { plugin },
      owned: [{ role: 'devices', id: 'mine', name: row.name, type: 'Instrument' }],
      completed: ['preflight', 'setup', 'notes', 'clips', 'mixer'], entry: last, last,
      inspection: { snapshot: before }, pendingWrite: { name: 'set_device_controls', args, commandId: 'failed' },
      failure: { command: 'run', arg: 'controls', commandId: 'failed', error: 'set_device_controls: verification failed' } };
    assert.equal(validateControlReplyRecovery(state, before, writes), 'mine');
    const wrong = structuredClone(before); wrong.tracks[0]!.controls[0]!.parameters[0]!.normalizedValue = 0.75;
    assert.throws(() => validateControlReplyRecovery({ ...state, inspection: { snapshot: wrong } }, wrong, writes), /Independent control/);
    assert.throws(() => validateControlReplyRecovery({ ...state, pendingWrite: {} }, before, writes), /Pending intent/);
    const missing = structuredClone(writes); (missing.at(-1) as Bag).result.verified = false;
    assert.throws(() => validateControlReplyRecovery(state, before, missing), /complete boolean/);
    const evidence = new Evidence(join(dir, 'source'));
    for (const write of writes) evidence.append('tools.jsonl', write);
    for (const name of ['entry', 'setup', 'notes', 'clips', 'mixer']) evidence.save(name + '.json', last);
    const audit = new Audit(evidence, state); let removed = false;
    audit.start = async () => {};
    audit.snapshot = async () => structuredClone(removed ? last : before);
    audit.rows = async () => [{ channelId: 'mine', name: row.name, type: 'Instrument' }];
    audit.devices = async () => removed ? [] : before.tracks[0]!.devices;
    audit.write = async (name, input) => {
      assert.equal(name, 'delete_device');
      equal(input, { devices: [2, 1, 0].map(devicePosition => ({ trackId: 'mine', devicePosition })) }, 'Only inserted devices');
      assert.equal(state.pendingWrite, undefined); assert(state.recovery.resolvedIntent);
      removed = true; return { verified: true };
    };
    await audit.recoverControlReply();
    assert(state.failure); assert.equal(state.recovery.completed, true);
    const target = join(dir, 'continuation'); forkRecovered(evidence.dir, target);
    const fresh = new Evidence(target).load('state.json');
    equal(fresh.completed, state.completed, 'Retain proved cases');
    assert.equal(fresh.failure, undefined); assert.equal(fresh.pendingWrite, undefined);
    assert.equal(evidence.load('state.json').failure.commandId, 'failed');
    assert.equal(fresh.inheritedFrom.proof.length, 7);
    assert.throws(() => forkRecovered(evidence.dir, target), /new continuation/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('process entry permits idle MCP servers and the current driver ancestry', () => {
  const rows = [
    { pid: 10, ppid: 1, command: 'node --import tsx src/mcp-server.ts' },
    { pid: 20, ppid: 1, command: 'node tsx src/probes/bitwig-upgrade-audit.ts run' },
    { pid: 21, ppid: 20, command: 'node src/probes/bitwig-upgrade-audit.ts run' },
  ];
  assert.equal(checkProcessEntry(rows, 21, 'p99\nf1\nTST=LISTEN\n').candidates.length, 3);
  assert.throws(() => checkProcessEntry([...rows,
    { pid: 30, ppid: 1, command: 'node --import tsx src/probes/gn-hello.ts' }], 21,
  'p99\nTST=LISTEN\n'), /Competing probe/);
});

test('process entry refuses any established bridge connection and absent inventory', () => {
  for (const client of [10, 99, 1234]) {
    assert.throws(() => checkProcessEntry([], 21,
      `p99\nf1\nTST=LISTEN\np${client}\nf2\nTST=ESTABLISHED\n`), /connected client/);
  }
  assert.throws(() => checkProcessEntry([], 21, ''), /no bridge listener/);
  assert.throws(() => checkProcessEntry([], 21, 'TST=ESTABLISHED\n'), /no process identity/);
});

function fixture() {
  const fake = new FakeAdapter({ tracks: ['notes', 'spare', 'devices'], scenes: 8 });
  const base = workspaceOf({ ready: async () => undefined, adapter: fake, stash: new Stash(),
    executor: new Executor(fake), observationStore: new FakeObservationStore(), documents: new IdentityRegistry() });
  const ws = { ...base, async apply(ops: Parameters<typeof base.apply>[0], run?: Parameters<typeof base.apply>[1]) {
    const result = await base.apply(ops, run);
    for (const op of ops) if (op.op === 'device.insert' && op.source.from === 'file') {
      const inspection = inspectPresetModulation(readFileSync(op.source.path));
      const mint = result.take.receipt.minted[0];
      if (mint?.kind === 'device') {
        const row = fake.model.visibleTracks().find(row => row.channelId === mint.track.channelId)!;
        const device = row.devices[mint.chainIndex]!;
        if (inspection.supported) {
          device.name = inspection.host.name;
          if (inspection.host.name === 'Sampler') {
            device.paramsLive = true;
            device.params = [{ id: 'CONTENTS/AMP_ATTACK_TIME', name: 'AEG Attack Time', value: 0.4,
              hasAutomation: false, modulatedValue: 0.4 }];
            device.remotePages = inspection.modulation.flatMap(location => location.modulators.map((modulator, i) => ({
              name: location.modulators.length > 1 ? `${modulator.name} ${i + 1}` : modulator.name, controls: [{ name: 'Rate', value: 0.5, modulatedValue: 0.5, hasAutomation: false }] })));
          }
        }
        if (op.expectedDeviceName === 'FX Layer') {
          device.name = 'FX Layer'; device.chains = listChains(readFileSync(op.source.path)).map((_, i) => ({
            id: fake.model.mintChannelId(), name: `Seed ${i}`, solo: false, devices: [] }));
        } else if (inspection.supported && inspection.containerKind) device.chains = inspection.entries.map(entry => ({
          id: fake.model.mintChannelId(), name: entry.name, solo: false,
          devices: entry.devices.map(child => ({ name: child.name, enabled: true, paramsLive: true, params: [] })) }));
      }
    }
    return result;
  } };
  const state: Bag = { prefix: 'test-', config: { plugin: { kind: 'clap', id: 'com.u-he.Diva' } },
    owned: fake.model.visibleTracks().map(row => ({ role: row.name, id: row.channelId })) };
  const tool = async (name: string, args: Bag) => await callTool(ws, name, args, AGENT_NATIVE_TOOL_PROFILE) as Bag;
  const a: AuditCase = {
    state,
    id(role) { const found = state.owned.find((row: Bag) => row.role === role); assert(found); return found.id; },
    async read(name, args) { const read = await tool(name, args); assert(!read.failure, JSON.stringify(read)); return read; },
    async write(name, args, refusalCodes) {
      validateBounds(name, args);
      const before = fake.model.revision, read = await tool(name, args);
      if (refusalCodes) { assertRefusal(read, fake.model.revision === before ? 0 : 1, refusalCodes); }
      else {
        assert(!read.failure, `${name}: ${JSON.stringify(read)}`);
        assertVerification(read, name);
        assert(read.applied !== false, `${name}: ${JSON.stringify(read)}`);
        if (read.readback?.status) assert(['verified', 'unchanged', 'already-set'].includes(read.readback.status), `${name}: ${JSON.stringify(read)}`);
      }
      return read;
    },
    async clip(role, row = 0) { return a.read('read_launcher_clip', { trackId: a.id(role), row, format: 'json', diagnostic: true }); },
    async devices(role) { return (await a.read('read_devices', { trackId: a.id(role) })).data.devices; },
    async controls(role, devicePosition) { return a.read('read_device_controls', { device: { trackId: a.id(role), devicePosition } }); },
    async mixer(role) {
      const row = fake.model.visibleTracks().find(row => row.channelId === a.id(role))!;
      const m = fakeMixerOf(row); return { volumeRaw: m.volume, panRaw: m.pan, mute: m.mute, solo: m.solo };
    },
    async own(role, operation) {
      const prior = fake.model.visibleTracks().map(row => row.channelId); await operation();
      const row = fake.model.visibleTracks().find(row => !prior.includes(row.channelId))!;
      assert(row); state.owned.push({ role, id: row.channelId });
    },
    forget(role) { state.owned = state.owned.filter((row: Bag) => row.role !== role); },
    save() {},
    async inspectEditedSampler() { throw new Error('Host export requires operator evidence'); },
  };
  return { a, fake, tool };
}
for (const name of ['notes', 'clips', 'mixer', 'controls']) test(`audit recipe ${name}: real product dispatch on fake host`, async () => {
  const { a } = fixture();
  await a.write('add_launcher_clip', { trackId: a.id('notes'), row: 0, format: 'json', document: desiredFixture() });
  const before = musical(documentOf(await a.clip('notes')));
  await CASES[name]!(a);
  equal(musical(documentOf(await a.clip('notes'))), before, 'Full note content restored');
});
test('audit structure recipe: current schemas, nested source and destination proof', async () => {
  const { a } = fixture(); await CASES.structure!(a); equal(await a.devices('devices'), [], 'No owned device residue');
});
test('a reused name never grants ownership', () => {
  const owned = [{ id: 'original', name: 'mine', type: 'Instrument' }];
  assert.throws(() => assertOwned(owned, [{ channelId: 'replacement', name: 'mine', type: 'Instrument' }]));
  assertOwned(owned, [{ channelId: 'original', name: 'mine', type: 'Instrument' }]);
});
test('failed, interrupted, and completed cases cannot resume', () => {
  for (const state of [{ failure: { error: 'timeout' } }, { active: { name: 'notes' } }, { completed: ['notes'] }]) {
    assert.throws(() => assertMayRun({ completed: [], ...state }, 'notes'));
  }
});
test('a refusal with a write or partial effect fails', () => {
  assert.throws(() => assertRefusal({ failure: { code: 'stale' } }, 1, ['stale']));
  assert.throws(() => assertRefusal({ failure: { code: 'stale', effects: [{}] } }, 0, ['stale']));
  assertRefusal({ failure: { code: 'stale', effects: [] } }, 0, ['stale']);
});
test('probe bounds reject excessive work before dispatch', () => {
  assert.throws(() => validateBounds('set_device_controls', { settings: Array(17).fill({}) }));
  assert.throws(() => validateBounds('add_launcher_clip', { row: 8 }));
  assert.throws(() => validateBounds('add_launcher_clip', { document: { events: Array(257) } }));
  assert.throws(() => validateBounds('compose_devices', { layerChains: [{ devices: Array(3).fill({ source: { kind: 'clap' } }) }] }));
  validateBounds('compose_devices', { layerChains: [{ devices: [{ source: { kind: 'native' } }] }] });
});
test('stable exact 6.1 build and section 1 handoff are required', () => {
  for (const version of ['6.0.6', '6.1.x', '6.1 Beta 1', undefined]) assert.throws(() => assertVersion(version));
  assertVersion('6.1'); assertVersion('6.1.2');
  assert.throws(() => validateConfig({ version: '6.1.2', operatorHandoff: false }));
});
test('persistence comparison ignores only transient track identities and indices', () => {
  const snapshot = { scenes: 8, selection: { mixer: 'sentinel' }, tracks: [{ id: 'old', index: 0, name: 'sentinel', mixer: { mute: true } }] };
  const fresh = structuredClone(snapshot); fresh.tracks[0]!.id = 'new'; fresh.tracks[0]!.index = 1;
  equal(comparable(snapshot), comparable(fresh), 'Reacquisition');
  fresh.tracks[0]!.mixer.mute = false; assert.throws(() => equal(comparable(snapshot), comparable(fresh), 'Mixer loss'));
});
test('offline preparation copies and inventories both donors without a live config', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gn-upgrade-test-'));
  try {
    prepare(dir);
    const config = JSON.parse(readFileSync(join(dir, 'config.example.json'), 'utf8'));
    assert.equal(config.operatorHandoff, false);
    for (const role of ['single', 'multi']) {
      const record = JSON.parse(readFileSync(join(dir, `donor-${role}.json`), 'utf8'));
      assert.equal(record.inspection.supported, true); assert.equal(record.removedTargets.length, 3);
      assert.equal(record.meta.device_name, 'Sampler');
      assert(record.meta.referenced_packaged_file_ids.length > 0);
      assert.notEqual(config.presets[role].copy, config.presets[role].source);
    }
    assert.throws(() => prepare(dir));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('evidence cap reserves failure space and never truncates existing records', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gn-upgrade-cap-'));
  try {
    const e = new Evidence(dir); e.save('kept.json', { value: 'original' });
    e.bytes = LIMITS.evidenceBytes - LIMITS.reserveBytes;
    assert.throws(() => e.append('wire.jsonl', { extra: true }));
    e.save('failure.json', { error: 'cap' }, true);
    assert.equal(e.load('kept.json').value, 'original');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('offline success and incomplete live rows are never upgrade acceptance', () => {
  assert.equal(report({ completed: [], cleaned: true }).status, 'not-accepted');
  assert.equal(report({ completed: ['notes'], failure: { error: 'failed' } }).status, 'not-accepted');
});

test('runtime write guard refuses a different project, selection, or owned identity before dispatch', async () => {
  const { Audit } = await import('./bitwig-upgrade-audit.js');
  const dir = mkdtempSync(join(tmpdir(), 'gn-upgrade-guard-'));
  try {
    const state: Bag = { config: { version: '6.1.2' }, owned: [{ id: 'mine', name: 'owned', type: 'Instrument' }] };
    const audit = new Audit(new Evidence(dir), state);
    let sent = 0;
    const row = { index: 0, channelId: 'mine', name: 'owned', type: 'Instrument' };
    let project = 'original-project';
    audit.request = async method => {
      if (method === 'selection.status') return { project, mixerChannelId: 'mine', trackIndex: 0, slotIndex: 0 };
      if (method === 'host.info') return { hostVersion: '6.1.2' };
      if (method === 'rig.stats') return { initEpochMs: -1 };
      if (method === 'cursor.playState') return { isPlaying: false };
      if (method === 'track.list') return { tracks: [row] };
      sent++; throw new Error('Unexpected dispatch');
    };
    await assert.rejects(audit.write('delete_track', { trackIds: ['mine'] }), /Project changed/);
    project = 'gn-upgrade-audit'; row.channelId = 'replacement';
    await assert.rejects(audit.write('delete_track', { trackIds: ['mine'] }), /Owned identity changed/);
    row.channelId = 'mine'; (audit as any).selection = { mixer: 'somebody-else', track: 'owned', slot: 0 };
    await assert.rejects(audit.write('delete_track', { trackIds: ['mine'] }), /selection changed/);
    assert.equal(sent, 0); assert.equal(state.pendingWrite, undefined);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('cleanup cannot adopt unowned state after an inspection', async () => {
  const { Audit } = await import('./bitwig-upgrade-audit.js');
  const dir = mkdtempSync(join(tmpdir(), 'gn-upgrade-clean-'));
  try {
    const snapshot = { scenes: 8, selection: {}, tracks: [{ id: 'unknown', name: 'user-work', devices: [] }] };
    const state = { owned: [], inspection: { snapshot }, entry: { ...snapshot, tracks: [] } };
    const audit = new Audit(new Evidence(dir), state);
    audit.start = async () => {}; audit.snapshot = async () => snapshot; audit.rows = async () => [];
    let writes = 0; audit.write = async () => { writes++; return {}; };
    await assert.rejects(audit.cleanup(), /Unowned material changed/); assert.equal(writes, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Sampler recipe checks an independent export before each supported reversal', async () => {
  const { a, fake } = fixture();
  let inspections = 0;
  a.state.config.presets = {};
  for (const [role, name] of [['single', 'gn_sampler_one_lfo'], ['multi', 'gn_sampler_multi_one_lfo']]) {
    await a.own(role!, () => a.write('add_tracks', { tracks: [{ name: `test-${role}` }] }));
    const path = join(import.meta.dirname, '../../fixtures/Sampler', name + '.bwpreset');
    a.state.config.presets[role!] = { copy: path };
    await a.write('add_devices', { trackId: a.id(role!), devices: [{ kind: 'preset', path }] });
  }
  a.inspectEditedSampler = async (role, source) => {
    inspections++;
    const row = fake.model.visibleTracks().find(row => row.channelId === a.id(role))!;
    assert.equal(row.devices.length, 2, 'The edited host stays until inspection');
    assert.equal(row.devices[1]!.remotePages!.length, source.modulation[0].modulators.length + 1);
    return { simulatedHostExport: true };
  };
  await CASES.sampler!(a); assert.equal(inspections, 2);
  for (const role of ['single', 'multi']) assert.equal((await a.devices(role)).length, 1);
});

test('host export must keep original routes and add the exact attack amount', () => {
  const source = inspectPresetModulation(readFileSync(join(import.meta.dirname, '../../fixtures/Sampler/gn_sampler_one_lfo.bwpreset'))) as Bag;
  const host = structuredClone(source);
  const modulator = structuredClone(host.modulation[0].modulators[0]);
  modulator.position = 1; modulator.routes[0].amount = 0.3; host.modulation[0].modulators.push(modulator);
  requireAddedAttackRoute(source, host);
  host.modulation[0].modulators.forEach((item: Bag, index: number) => { item.name = `LFO ${index + 1}`; });
  requireAddedAttackRoute(source, host);
  for (const mutate of [
    (value: Bag) => { value.modulation[0].modulators[0].routes = []; },
    (value: Bag) => { value.modulation[0].modulators[0].name = 'Other LFO'; },
    (value: Bag) => { value.modulation[0].modulators[1].name = 'LFO 3'; },
    (value: Bag) => { value.modulation[0].modulators[0].position = 5; },
    (value: Bag) => { value.modulation[0].modulators[1].routes[0].amount = 0.7; },
    (value: Bag) => { value.modulation[0].modulators[1].routes[0].target.parameter.parameterId = 'CONTENTS/PLAY_MODE'; },
    (value: Bag) => { value.modulation[0].modulators[0].routes[0].rangeHi = 999; },
  ]) {
    const bad = structuredClone(host); mutate(bad); assert.throws(() => requireAddedAttackRoute(source, bad));
  }
});


test('Sampler recovery requires the exact inserted pair, preserved content, and both selections', () => {
  const selection = { mixer: 'Inst 1', track: 'Inst 1', slot: 0 };
  const parameter = { id: 'CONTENTS/AMP_ATTACK_TIME', name: 'Gated Attack Time', normalizedValue: 0 };
  const original = { id: 'single', devices: [{ devicePosition: 0, name: 'Sampler', enabled: true }],
    controls: [{ position: 0, parameters: [parameter] }] };
  const last = { selection, scenes: 8, tracks: [original] };
  const before = structuredClone(last);
  before.tracks[0]!.devices.push({ devicePosition: 1, name: 'Sampler', enabled: true });
  before.tracks[0]!.controls.push({ position: 1, parameters: [parameter] });
  const args = { trackId: 'single', presetPath: '/copy.bwpreset', location: { kind: 'self' },
    operation: { kind: 'add', modulator: 'lfo', target: 'sampler-amp-attack', amount: 0.3 } };
  const call = { name: 'edit_preset_modulation', commandId: 'failed', args, result: {
    applied: true, failure: { stage: 'readback' }, observed: { insertedDevicePosition: 1 },
    verified: { insertedHost: true, pages: true },
  } };
  const state: Bag = { last, inspection: { snapshot: before }, owned: [{ role: 'single', id: 'single' }],
    config: { presets: { single: { copy: '/copy.bwpreset' } } },
    completed: ['preflight', 'setup', 'notes', 'clips', 'mixer', 'controls', 'structure'],
    failure: { arg: 'sampler', error: 'AEG Attack Time differs from Gated Attack Time' },
    pendingWrite: { name: call.name, commandId: call.commandId, args } };
  assert.equal(validateSamplerNameRecovery(state, before, [call]), 'single');
  const selected = structuredClone(before); selected.selection.mixer = 'single';
  assert.throws(() => validateSamplerNameRecovery(state, selected, [call]), /both mixer and Launcher/);
  const changed = structuredClone(before); changed.tracks[0]!.controls[1]!.parameters[0]!.normalizedValue = 0.2;
  assert.throws(() => validateSamplerNameRecovery({ ...state, inspection: { snapshot: changed } }, changed, [call]), /base controls/);
  assert.throws(() => validateSamplerNameRecovery(state, before, [call, call]), /Only the failed/);
  assert.throws(() => validateSamplerNameRecovery({ ...state, recovery: {} }, before, [call]), /started recovery/);
});


test('snapshot keeps group aggregate slots and reads only child clip documents', async () => {
  const { Audit } = await import('./bitwig-upgrade-audit.js');
  const { a } = fixture();
  await a.write('add_launcher_clip', { trackId: a.id('notes'), row: 0, format: 'json', document: desiredFixture() });
  const dir = mkdtempSync(join(tmpdir(), 'gn-group-snapshot-'));
  try {
    const rows = [
      { index: 0, channelId: 'group', name: 'test-group', type: 'Group' },
      { index: 1, channelId: a.id('notes'), name: 'test-notes', type: 'Instrument', hidden: true },
    ];
    const audit = new Audit(new Evidence(dir), { owned: [] });
    let slotReads = 0; let clipReads = 0;
    audit.request = async (method, args) => {
      if (method === 'track.list') return { tracks: rows };
      if (method === 'scene.count') return { sceneCount: 8 };
      if (method === 'selection.status') return { project: 'audit', mixerChannelId: 'group', trackIndex: 1, slotIndex: 0 };
      if (method === 'track.mixer') return { tracks: rows.map(row => ({ channelId: row.channelId, volumeRaw: 0.5, panRaw: 0, mute: true, solo: false })) };
      assert.equal(method, 'slot.status'); slotReads++; return { hasContent: args!.slotIndex === 0 };
    };
    audit.read = async (name, args) => {
      if (name === 'read_devices') return { coverage: { status: 'complete' }, data: { devices: [] } };
      assert.equal(name, 'read_launcher_clip'); assert.equal(args.trackId, a.id('notes')); clipReads++;
      return a.clip('notes', args.row);
    };
    const result = await audit.snapshot();
    assert.equal(slotReads, 16); assert.equal(clipReads, 1);
    equal(result.tracks[0].clips, Array.from({ length: 8 }, (_, row) => ({ row, occupied: row === 0, kind: 'group-launcher' })), 'Aggregate slot representation');
    assert(result.tracks[1].clips[0].music.events.length > 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('group recovery retains the exact pre-write failure and forks its checkpoint', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gn-group-recovery-'));
  try {
    const original = { scenes: 8, selection: { mixer: 'Inst 1', track: 'Inst 1', slot: 0 }, tracks: [
      { id: 'notes', index: 0, name: 'test-notes', type: 'Instrument', hidden: false, devices: [], clips: [] },
      { id: 'spare', index: 1, name: 'test-spare', type: 'Instrument', hidden: false, devices: [], clips: [] },
    ] };
    const grouped = { ...original, selection: { ...original.selection, mixer: 'test-group' }, tracks: [
      { id: 'group', index: 0, name: 'test-group', type: 'Group', hidden: false, devices: [],
        clips: Array.from({ length: 8 }, (_, row) => ({ row, occupied: row === 0, kind: 'group-launcher' })) },
      ...original.tracks.map(row => ({ ...row, index: row.index + 1, hidden: true })),
    ] };
    const state: Bag = { prefix: 'test-', schema: 'bitwig-upgrade-audit-v1', config: {}, owned: [],
      completed: ['preflight', 'group-before'], checkpoint: original, last: original, entry: original, pause: 'group',
      failure: { command: 'checkpoint', arg: 'group-after', error: 'read_launcher_clip: group-slot', commandId: 'failed' } };
    const calls = [{ name: 'read_launcher_clip', result: { failure: { code: 'group-slot', effects: [] } } }];
    validateGroupSnapshotRecovery(state, calls); validateGroupFixture(state, grouped);
    assert.throws(() => validateGroupSnapshotRecovery({ ...state, pendingWrite: {} }, calls), /pre-write/);
    assert.throws(() => validateGroupSnapshotRecovery(state, [...calls, { name: 'set_track_mixer' }]), /read-only/);
    const changed = structuredClone(grouped); changed.tracks[2]!.hidden = false;
    assert.throws(() => validateGroupFixture(state, changed), /hidden/);
    const empty = structuredClone(grouped); empty.tracks[0]!.clips = [];
    assert.throws(() => validateGroupFixture(state, empty));
    state.recovery = { kind: 'group-snapshot', completed: true, after: grouped };
    const evidence = new Evidence(join(dir, 'source'));
    evidence.save('state.json', state); evidence.save('entry.json', original);
    evidence.save('group-before.json', { snapshot: original }); evidence.save('group-snapshot-recovery.json', state.recovery);
    forkRecovered(evidence.dir, join(dir, 'continuation'));
    const next = new Evidence(join(dir, 'continuation')).load('state.json');
    equal(next.checkpoint, original, 'Keep original restoration checkpoint');
    assert.equal(next.pause, 'group'); assert.equal(next.failure, undefined);
    assert.equal(evidence.load('state.json').failure.commandId, 'failed');
    equal(next.last, grouped, 'Keep complete group inspection');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
