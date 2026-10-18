import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attach, recover, expectedAttachment, ATTACHMENT_CALLS } from './phase9a-grid-attachment.js';

type Wire = Record<string, any>;
const load = (path: string) => JSON.parse(readFileSync(new URL(`../../../context/evidence/data/${path}`, import.meta.url), 'utf8'));
const baseline = load('phase9a-grid-read/live-28-after-reload/capture-0.json').graph;
const factory = load('phase9a-grid-factory/live-87-factory-first/factory-command.json').lifecycle;
function fixture() {
  const life = structuredClone(factory);
  for (const key of ['editStartAttempted', 'editStartReturned', 'editAdmitted', 'editOwned', 'insertionAttempted',
    'insertionReturned', 'closeAttempted', 'closeReturned', 'closeAccepted', 'editClosed']) life[key] = true;
  life.disposeAttempted = false; life.disposalVerified = false; life.uncertain = false;
  const uuid = life.capture0.nodes[0].properties.find((p: Wire) => p.id === 15).value.data;
  life.attached = { uuid, managedObjectId: 4000, managedObjectRegistered: true, parentsVerified: true, selectionUnchanged: true, rectangle: { uuid, x: 2, y: 0, width: 1, height: 2 } };
  const witness = { moduleUuids: ['a', 'b', 'c', 'd'], rectangles: [], selection: { selected: [] } };
  const afterWitness = structuredClone(witness) as Wire; afterWitness.moduleUuids.push(uuid); afterWitness.rectangles.push(life.attached.rectangle);
  return { life, witness, afterWitness, after: { ...baseline, nodes: expectedAttachment(baseline, life) } };
}
async function run(mode = 'success') {
  const f = fixture(), calls: Wire[] = []; let reads = 0, selectionReads = 0;
  const request = async (method: string, params: Wire = {}): Promise<Wire> => {
    calls.push({ method, params });
    switch (method) {
      case 'contract.hello': return { runtimeProfile: 'phase-8-probe-v1', methodCount: 117, methodsHash: 'b899e5d3d75a791d' };
      case 'rig.info': return { gridReadProbe: '9a-grid-attachment-v11' };
      case 'rig.stats': return { initEpochMs: 2 };
      case 'host.info': return {};
      case 'revision.get': return { project: 'gn-grid-spike' };
      case 'selection.status': return { selected: mode === 'selection' ? selectionReads++ : 0 };
      case 'track.list': return { tracks: [{ name: 'grid-probe', index: 0, channelId: 'track' }] };
      case 'cursor.pointTrack': return {};
      case 'devcursor.status': return { trackChannelId: 'track' };
      case 'device.list': return { itemCount: 1, count: 1, devices: [{ name: 'Poly Grid', index: 0 }] };
      case 'probe.gridModuleAttach':
        if (mode === 'timeout') throw new Error('timeout');
        return { graph: baseline, witness: f.witness, lifecycle: f.life, writeStatus: 'attached; independent readback required' };
      case 'probe.gridRead':
        if (params.operation === 'attachmentRead') {
          const after = reads++ >= 2;
          if (after && mode === 'readback') return { graph: baseline, witness: f.witness };
          return { graph: after ? f.after : baseline, witness: after ? f.afterWitness : f.witness };
        }
        if (params.operation === 'attachmentStatus') return { writeLocked: true, nativeUnfinished: true };
        return { epoch: 'epoch' };
      default: throw new Error(method);
    }
  };
  const action = attach(request, { observedAt: Date.now(), deployedAt: 1, save: () => {}, settle: async () => {}, verifyFiles: () => {} });
  if (mode === 'success') await action; else await assert.rejects(action);
  return calls;
}
test('attachment success uses exactly 18 wire calls and five fixed live captures', async () => {
  const calls = await run(); assert.deepEqual(calls.map(c => c.method), ATTACHMENT_CALLS);
  assert.equal(calls.filter(c => c.params.operation === 'attachmentRead').length, 4);
  assert.deepEqual(calls.at(-1)!.params, { operation: 'release', epoch: 'epoch', uncertain: false });
});
test('readback or public selection mismatch locks at release', async () => {
  for (const mode of ['readback', 'selection']) {
    const calls = await run(mode); assert.equal(calls.at(-1)!.params.uncertain, true);
    assert.equal(calls.filter(c => c.method === 'probe.gridModuleAttach').length, 1);
  }
});
test('timeout asks only for cached status; no queued recovery or retry', async () => {
  const calls = await run('timeout');
  assert.deepEqual(calls.at(-1)!.params, { operation: 'attachmentStatus' });
  assert.equal(calls.filter(c => c.params.operation === 'attachmentRead').length, 2);
});
test('recovery has exactly four calls and keeps the original route', async () => {
  const calls: Wire[] = [], target = { trackId: 'same', deviceIndex: 0 };
  await recover(async (method, params) => { calls.push({ method, params }); return { epoch: 'fresh' }; }, target, () => {});
  assert.deepEqual(calls.map(c => c.params.operation), ['recoveryBind', 'recoveryRead', 'recoveryRead', 'recoveryRelease']);
  assert.ok(calls.every(c => c.method === 'probe.gridRead'));
  assert.ok(calls.slice(0, 3).every(c => c.params.trackId === 'same'));
});
test('independent receipt check rejects disposal and changed defaults', () => {
  const { life } = fixture(); life.disposeAttempted = true;
  assert.throws(() => expectedAttachment(baseline, life)); life.disposeAttempted = false;
  for (const capture of [life.capture0, life.capture1]) capture.nodes[3].properties.find((p: Wire) => p.id === 712).value.data = 0.5;
  assert.throws(() => expectedAttachment(baseline, life));
});
test('registered ID must be positive, fresh, and proved', () => {
  const { life } = fixture();
  for (const id of [undefined, 0, -1, 1.5, 0x80000000]) {
    const value = structuredClone(life); value.attached.managedObjectId = id;
    assert.throws(() => expectedAttachment(baseline, value));
  }
  const duplicate = structuredClone(life);
  duplicate.attached.managedObjectId = Number(baseline.nodes.flatMap((n: Wire) => n.properties).find((p: Wire) => p.id === 14).value.data);
  assert.throws(() => expectedAttachment(baseline, duplicate));
  life.attached.managedObjectRegistered = false;
  assert.throws(() => expectedAttachment(baseline, life));
});
test('V10 recovery differs only at the assigned managed ID', () => {
  const before = load('phase9a-grid-attachment/live-91-attach-first/capture-0.json');
  const command = load('phase9a-grid-attachment/live-91-attach-first/attach-command.json');
  // This models the new receipt. V10 did not prove registry identity in its command.
  command.lifecycle.attached.managedObjectId = 4000;
  command.lifecycle.attached.managedObjectRegistered = true;
  const expected = expectedAttachment(before.graph, command.lifecycle);
  for (const i of [0, 1]) {
    const recovery = load(`phase9a-grid-attachment/live-92-recovery/recovery-${i}.json`);
    assert.deepEqual(recovery.graph.nodes, expected);
  }
});
