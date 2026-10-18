/** Fixed 9a attachment workflow. Native editing remains probe-only. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import { compareDeployment, deployedAtMs } from '../deploy.js';

type Wire = Record<string, any>;
type Request = (method: string, params?: Wire) => Promise<Wire>;
export const ATTACHMENT_CALLS = ['contract.hello', 'rig.info', 'rig.stats', 'host.info', 'revision.get',
  'selection.status', 'track.list', 'cursor.pointTrack', 'devcursor.status', 'device.list',
  'probe.gridRead', 'probe.gridRead', 'probe.gridRead', 'probe.gridModuleAttach',
  'probe.gridRead', 'probe.gridRead', 'selection.status', 'probe.gridRead'];
const node = (graph: Wire, id: number): Wire => { const n = graph.nodes.find((n: Wire) => n.id === id); assert.ok(n); return n; };
const property = (n: Wire, id: number): Wire => { const p = n.properties.find((p: Wire) => p.id === id); assert.ok(p); return p; };
const scalar = (n: Wire, id: number): any => property(n, id).value.data;
export function expectedAttachment(before: Wire, receipt: Wire): Wire[] {
  assert.equal(receipt.stage, 'complete'); assert.equal(receipt.uncertain, false);
  for (const key of ['factoryAttempted', 'factoryReturned', 'ownershipProved', 'initializationHelpersPresent',
    'editStartAttempted', 'editStartReturned', 'editAdmitted', 'editOwned', 'insertionAttempted',
    'insertionReturned', 'closeAttempted', 'closeReturned', 'closeAccepted', 'editClosed']) assert.equal(receipt[key], true, key);
  assert.equal(receipt.disposeAttempted, false); assert.equal(receipt.disposalVerified, false);
  assert.equal(receipt.ownedObjects, 77);
  const detached = receipt.capture0;
  assert.deepEqual(detached.nodes, receipt.capture1.nodes);
  for (const capture of [detached, receipt.capture1]) {
    assert.equal(capture.complete, true); assert.equal(capture.errorCount, 0); assert.equal(capture.nodes.length, 8);
  }
  assert.equal(detached.root, 0);
  assert.deepEqual(detached.nodes.map((n: Wire) => n.id), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(detached.nodes.map((n: Wire) => n.className), ['module', 'module_contents', 'audio_source_atom',
    'bipolar_toggleable_decimal_value_atom', 'boolean_panel_value', 'audio_destination_atom', 'nitro_atom', 'boolean_value_atom']);
  const m = node(detached, 0), contents = node(detached, 1);
  assert.equal(scalar(m, 404), 'Amplify'); assert.equal(Number(scalar(m, 6679)), 0); assert.equal(Number(scalar(m, 6680)), 0);
  assert.equal(scalar(m, 6977), true); assert.deepEqual(property(m, 406).refs, [1]);
  assert.equal(scalar(contents, 6369), 'a6cd650b-c4de-46c6-8741-c07a0a9bfec2');
  assert.deepEqual(property(contents, 173).refs, [2, 3, 4, 5, 6, 7]);
  for (const id of [712, 949]) assert.equal(scalar(node(detached, 3), id), 1);
  for (const [id, field] of [[3, 6406], [4, 6386], [7, 210], [7, 953]]) assert.equal(scalar(node(detached, id!), field!), false);
  assert.deepEqual(property(node(detached, 5), 7125).refs, []);
  assert.equal(scalar(node(detached, 5), 7234), 0); assert.equal(Number(scalar(node(detached, 6), 14)), 0);
  const members: number[] = property(node(before, before.root), 6428).refs;
  assert.equal(members.length, 4); assert.equal(before.nodes.length, 53);
  assert.ok(!members.map(id => scalar(node(before, id), 15)).includes(scalar(m, 15)));
  assert.equal(receipt.attached.uuid, scalar(m, 15)); assert.equal(receipt.attached.parentsVerified, true);
  assert.equal(receipt.attached.selectionUnchanged, true);
  const managedId = receipt.attached.managedObjectId;
  assert.ok(Number.isInteger(managedId) && managedId > 0 && managedId <= 0x7fffffff);
  assert.equal(receipt.attached.managedObjectRegistered, true);
  assert.ok(!before.nodes.some((n: Wire) => n.properties.some((p: Wire) => p.id === 14 && Number(p.value.data) === managedId)));
  const expected = structuredClone(before.nodes) as Wire[];
  assert.deepEqual(expected.map(n => n.id), Array.from({ length: 53 }, (_, i) => i));
  const membership = property(expected[before.root]!, 6428); membership.refs.push(53); membership.count = 5;
  for (const original of detached.nodes as Wire[]) {
    const n = structuredClone(original); n.id += 53;
    for (const p of n.properties) if (p.refs) p.refs = p.refs.map((id: number) => id + 53);
    if (n.id === 53) property(n, 6679).value.data = '2';
    if (n.id === 59) property(n, 14).value.data = String(managedId);
    expected.push(n);
  }
  return expected;
}
export async function attach(request: Request, options: {
  observedAt: number; deployedAt: number | undefined; save: (name: string, value: unknown) => void;
  settle: () => Promise<void>; verifyFiles: () => void;
}): Promise<void> {
  let epoch: string | undefined, wireFailed = false, complete = false;
  const call: Request = async (method, params) => {
    try { return await request(method, params); } catch (error) { wireFailed = true; throw error; }
  };
  const { save } = options;
  try {
    const hello = await call('contract.hello'), rig = await call('rig.info'), stats = await call('rig.stats');
    const host = await call('host.info'), revision = await call('revision.get'), selection = await call('selection.status');
    const tracks = await call('track.list'); save('entry', { hello, rig, stats, host, revision, selection, tracks });
    assert.equal(hello.runtimeProfile, 'phase-8-probe-v1'); assert.equal(hello.methodCount, 117);
    assert.equal(hello.methodsHash, 'b899e5d3d75a791d'); assert.equal(rig.gridReadProbe, '9a-grid-attachment-v11');
    assert.equal(compareDeployment(options.deployedAt, stats.initEpochMs ?? -1).state, 'fresh');
    assert.equal(revision.project, 'gn-grid-spike');
    const matches = tracks.tracks.filter((t: Wire) => t.name === 'grid-probe'); assert.equal(matches.length, 1);
    const track = matches[0]; assert.ok(!track.hidden);
    await call('cursor.pointTrack', { cursor: '0', trackIndex: track.index }); await options.settle();
    assert.equal((await call('devcursor.status')).trackChannelId, track.channelId, 'Cursor must settle in one poll');
    const devices = await call('device.list', { cursor: 0 }); save('devices', devices);
    assert.equal(devices.itemCount, devices.count);
    const grids = devices.devices.filter((d: Wire) => d.name === 'Poly Grid'); assert.equal(grids.length, 1);
    const target = { project: revision.project, trackId: track.channelId, trackName: track.name, deviceIndex: grids[0].index, deviceName: 'Poly Grid' };
    save('target', target);
    const bound = await call('probe.gridRead', { operation: 'bind', ...target }); save('binding', bound); epoch = bound.epoch;
    const reads: Wire[] = [];
    for (let i = 0; i < 2; i++) {
      const read = await call('probe.gridRead', { operation: 'attachmentRead', ...target, epoch }); save(`capture-${i}`, read);
      assert.equal(read.graph.complete, true); assert.equal(read.graph.errorCount, 0); assert.ok(read.witness); reads.push(read);
    }
    assert.deepEqual(reads[0]!.graph.nodes, reads[1]!.graph.nodes); assert.deepEqual(reads[0]!.witness, reads[1]!.witness);
    const before = reads[1]!, graph = before.graph;
    const moduleUuids = property(node(graph, graph.root), 6428).refs.map((id: number) => scalar(node(graph, id), 15));
    const command = await call('probe.gridModuleAttach', { ...target, epoch, moduleUuids, expectedNodes: graph.nodes,
      expectedWitness: before.witness, engineInactiveObservedAt: options.observedAt });
    save('attach-command', command); assert.deepEqual(command.graph.nodes, graph.nodes); assert.deepEqual(command.witness, before.witness);
    assert.equal(command.writeStatus, 'attached; independent readback required');
    const expected = expectedAttachment(graph, command.lifecycle), witness = structuredClone(before.witness);
    witness.moduleUuids.push(command.lifecycle.attached.uuid); witness.rectangles.push(command.lifecycle.attached.rectangle);
    for (let i = 0; i < 2; i++) {
      const after = await call('probe.gridRead', { operation: 'attachmentRead', ...target, epoch }); save(`attach-readback-${i}`, after);
      assert.equal(after.graph.complete, true); assert.equal(after.graph.errorCount, 0);
      assert.deepEqual(after.graph.nodes, expected); assert.deepEqual(after.witness, witness);
    }
    options.verifyFiles();
    const selected = await call('selection.status'); save('selection-after', selected); assert.deepEqual(selected, selection);
    complete = true;
  } finally {
    if (epoch && !wireFailed) await call('probe.gridRead', { operation: 'release', epoch, uncertain: !complete });
    if (wireFailed) {
      try { save('failure-status', await request('probe.gridRead', { operation: 'attachmentStatus' })); }
      catch (error) { save('failure-status-error', { error: String(error) }); }
    }
  }
}
export async function recover(request: Request, target: Wire, save: (name: string, value: unknown) => void): Promise<void> {
  const bound = await request('probe.gridRead', { operation: 'recoveryBind', ...target }); save('recovery-binding', bound);
  try {
    for (let i = 0; i < 2; i++) save(`recovery-${i}`, await request('probe.gridRead', { operation: 'recoveryRead', ...target, epoch: bound.epoch }));
  } finally { await request('probe.gridRead', { operation: 'recoveryRelease', epoch: bound.epoch }); }
}
function fingerprint(path: string) {
  assert.ok(isAbsolute(path)); const stat = lstatSync(path); assert.ok(stat.isFile() && stat.size <= 32 * 1024 * 1024);
  const bytes = readFileSync(path); return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
async function main() {
  const [mode, input, output] = process.argv.slice(2);
  assert.ok(mode === 'attach' || mode === 'recover', 'Usage: attach <entry.json> <new-output> | recover <target.json> <new-output>');
  assert.ok(input && output && isAbsolute(input) && isAbsolute(output));
  assert.ok(lstatSync(input).isFile() && lstatSync(input).size <= 8192);
  const config = JSON.parse(readFileSync(input, 'utf8')); mkdirSync(output);
  const save = (name: string, data: unknown) => writeFileSync(join(output, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx' });
  const client = new BridgeClient(), calls: Wire[] = [];
  const request: Request = async (method, params = {}) => {
    const start = performance.now();
    try { const result = await client.request(method, params) as Wire;
      calls.push({ method, ms: performance.now() - start, bytes: Buffer.byteLength(JSON.stringify(result)) }); return result;
    } catch (error) { calls.push({ method, ms: performance.now() - start, error: String(error) }); throw error; }
  };
  try {
    if (mode === 'recover') await recover(request, config, save);
    else {
      assert.equal(config.project, 'gn-grid-spike'); assert.equal(config.engineInactive, true);
      const observedAt = Date.parse(config.observedAt); assert.ok(Date.now() - observedAt >= 0 && Date.now() - observedAt <= 60_000);
      const files = { project: fingerprint(config.projectPath), preset: fingerprint(config.presetPath), backup: fingerprint(config.backupPath) };
      for (const file of [files.project, files.backup]) assert.equal(file.sha256, 'af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f');
      assert.equal(files.preset.sha256, '1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9');
      save('files', files); save('ui-entry', config);
      await attach(request, { observedAt, deployedAt: deployedAtMs(), save, settle: () => new Promise(r => setTimeout(r, 150)),
        verifyFiles: () => { const after = { project: fingerprint(config.projectPath), preset: fingerprint(config.presetPath), backup: fingerprint(config.backupPath) };
          save('files-after', after); assert.deepEqual(after, files); } });
      assert.deepEqual(calls.map(c => c.method), ATTACHMENT_CALLS);
    }
    console.log(JSON.stringify({ status: mode === 'attach' ? 'attachment-readback-agrees' : 'recovery-evidence-only', output, calls: calls.length }));
  } finally { save('calls', { calls, sequentialWireCalls: calls.length }); client.disconnect(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
