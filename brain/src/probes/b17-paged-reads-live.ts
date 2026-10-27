/** B17 session 2, read-only fixture check. After controller replacement and probe:hello:
 * node --import tsx src/probes/b17-paged-reads-live.ts --out NEW_DIRECTORY [--track gn-b17r] [--devices 17]
 * Fixture in gn-scale-test: at least 17 top-level devices; the last is a container with six chains,
 * at least one containing five devices. Prepare and remove the fixture separately.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { compareDeployment, deployedAtMs } from '../deploy.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { WireTransport } from './phase8h3c-promotion.js';
import { NORMAL_B17 } from './phase8h4f-measure.js';

type Wire = Record<string, any>;
const { values } = parseArgs({ options: {
  out: { type: 'string' }, track: { type: 'string', default: 'gn-b17r' },
  devices: { type: 'string', default: '17' },
} });
assert(values.out, 'required: --out NEW_DIRECTORY');
const deviceCount = Number(values.devices);
assert(Number.isSafeInteger(deviceCount) && deviceCount >= 17 && deviceCount <= 32, '--devices must be 17–32');
const containerPosition = deviceCount - 1;
mkdirSync(values.out, { recursive: false });
const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({ ready: async () => undefined, adapter, executor: new Executor(adapter),
  stash: new Stash(), observationStore: new FakeObservationStore(), documents: new IdentityRegistry() });
let sequence = 0;
const record = (label: string, data: unknown) => {
  writeFileSync(join(values.out!, `${String(sequence++).padStart(3, '0')}-${label}.json`), JSON.stringify(data, null, 2) + '\n');
  console.log(label);
};
const request = async (method: string, params?: Wire): Promise<Wire> => await transport.send({ method, params }) as Wire;
async function tool(label: string, name: string, args: Wire = {}): Promise<Wire> {
  const from = transport.calls.length, start = performance.now();
  const result = await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  record(label, { result, ms: performance.now() - start, turns: transport.calls.length - from,
    calls: transport.calls.slice(from) });
  assert.equal(result.failure, undefined, JSON.stringify(result));
  return result;
}
try {
  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [...NORMAL_B17]);
  const stats = await request('rig.stats');
  const deployment = compareDeployment(deployedAtMs(), stats.initEpochMs);
  assert.equal(deployment.state, 'fresh', deployment.detail);
  const rig = await request('rig.info');
  assert.equal(rig.containerScopeRoute, 'paged-windows-v3');
  assert.equal(rig.containerScopeStatus.open, false);
  assert(rig.windowWriteBlock == null);
  record('entry', { hello, stats, rig, deployment });
  await adapter.hello();
  const connection = await tool('connection', 'check_bitwig_connection');
  assert.equal(connection.target.project, 'gn-scale-test');
  const tracks = await request('track.list');
  const candidates = tracks.tracks.filter((row: Wire) => row.name === values.track);
  assert.equal(candidates.length, 1, 'one named fixture track');
  const target = candidates[0];
  const selection = await request('selection.status');
  record('before', { tracks, selection, target });
  const before = await tool('read-devices', 'read_devices', { trackId: target.channelId });
  assert.equal(before.coverage.status, 'complete');
  assert.equal(before.coverage.devicePages, 2);
  assert.equal(before.data.devices.length, deviceCount);
  const container = before.data.devices[containerPosition].container;
  assert.equal(container?.layerChains.length, 6);
  assert(container.layerChains.some((chain: Wire) => chain.devices.length === 5));
  assert(container.layerChains.every((chain: Wire) => chain.devicesComplete));

  // One isolated scope reading gives the ledger's wire-turn cost and the extension's page counts.
  const start = performance.now(), from = transport.calls.length;
  const raw = await request('chain.observe', { position: containerPosition, expectedTrackChannelId: target.channelId });
  record('isolated-overflow-observe', { raw, ms: performance.now() - start, turns: transport.calls.length - from });
  assert.equal(raw.scope.paged, true);
  assert.equal(raw.scope.chainPages, 2);
  assert.deepEqual(raw.scope.chains.map((chain: Wire) => chain.index), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(raw.scope.chains.map((chain: Wire) => [chain.name, chain.devices.map((device: Wire) => device.name)]),
    container.layerChains.map((chain: Wire) => [chain.name, chain.devices.map((device: Wire) => device.name)]));
  const rawInventory = await request('chain.inventory');
  record('restored-windows', rawInventory);
  const scope = rawInventory.scopes.find((item: Wire) => item.position === containerPosition);
  assert.equal(scope.chainWindowPosition, 0);
  assert(scope.chains.every((chain: Wire) => chain.deviceWindowPosition === 0));
  const after = await tool('read-devices-repeat', 'read_devices', { trackId: target.channelId });
  assert.deepEqual(after.data, before.data);
  assert.deepEqual((await request('track.list')).tracks, tracks.tracks);
  const selectedAfter = await request('selection.status');
  record('selection-after', selectedAfter);
  for (const field of ['trackIndex', 'slotIndex', 'mixerTrackIndex', 'mixerChannelId', 'project']) {
    assert.equal(selectedAfter[field], selection[field], `preserved selection: ${field}`);
  }
  const exit = await request('rig.info');
  assert.equal(exit.containerScopeStatus.open, false);
  assert(exit.windowWriteBlock == null);
  record('exit', exit);
  record('result', { passed: true, fixtureRetained: values.track, deviceCount, containerPosition, projectWrites: 0 });
} finally {
  await transport.close();
}
