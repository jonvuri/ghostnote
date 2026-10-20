/** E300: check the retained V13 reader. Usage: <new absolute output directory>. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { BridgeClient, BridgeError } from '../client.js';
import { compareDeployment, deployedAtMs } from '../deploy.js';

type Wire = Record<string, any>;
const [output] = process.argv.slice(2);
assert.ok(output && isAbsolute(output), 'Use a new absolute output directory');
mkdirSync(output);
const client = new BridgeClient();
const calls: Wire[] = [];
const save = (name: string, value: unknown) =>
  writeFileSync(join(output, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });

async function request(method: string, params: Wire = {}): Promise<Wire> {
  const start = performance.now();
  try {
    const result = await client.request(method, params) as Wire;
    calls.push({ method, params, ms: performance.now() - start,
      bytes: Buffer.byteLength(JSON.stringify(result)) });
    return result;
  } catch (error) {
    calls.push({ method, params, ms: performance.now() - start, error: String(error) });
    throw error;
  }
}

async function state() {
  return {
    revision: await request('revision.get'),
    selection: await request('selection.status'),
    tracks: await request('track.list'),
    cursor: await request('devcursor.status'),
    engine: await request('probe.gridEngine', { operation: 'status' }),
  };
}

try {
  const hello = await request('contract.hello');
  const rig = await request('rig.info');
  const stats = await request('rig.stats');
  const host = await request('host.info');
  const deployment = compareDeployment(deployedAtMs(), stats.initEpochMs ?? -1);
  save('deployment', { at: new Date().toISOString(), hello, rig, stats, host, deployment });
  assert.equal(hello.runtimeProfile, 'phase-8-probe-v1');
  assert.equal(hello.methodCount, 118);
  assert.equal(hello.methodsHash, '2e939035ea90b8b0');
  assert.equal(rig.gridReadProbe, '9a-grid-audio-v13');
  assert.equal(deployment.state, 'fresh');
  const before = await state();
  save('before', before);
  assert.equal(before.engine.used, true, 'This diagnostic requires the used V13 session');
  assert.equal(before.engine.active, false);
  assert.equal(before.engine.locked, false);
  assert.equal(before.engine.epochOpen, false);
  assert.equal(before.engine.nativeUnfinished, false);
  assert.equal(before.engine.restored, true);
  assert.equal(before.revision.project, 'gn-grid-spike');
  const matches = before.tracks.tracks.filter((track: Wire) => track.name === 'grid-probe');
  assert.equal(matches.length, 1);
  assert.equal(before.cursor.trackChannelId, matches[0].channelId);
  // The used-session guard refuses before target resolution or document work.
  // Do not point a cursor, create a fixture, or use the audio protocol to read.
  let refused = false;
  try {
    const result = await request('probe.gridRead', {
      operation: 'bind', project: before.revision.project,
      trackId: matches[0].channelId, trackName: matches[0].name,
      deviceIndex: 0, deviceName: 'Poly Grid',
    });
    save('unexpected-binding', result);
    throw new Error('The V13 refusal did not occur; inspect before further work');
  } catch (error) {
    assert.ok(error instanceof BridgeError && error.message.includes('engine-session-owns-grid'),
      `Unexpected reader result: ${error}`);
    save('refusal', { code: error.code, message: error.message });
    refused = true;
  }
  const after = await state();
  save('after', after);
  assert.deepEqual(after, before, 'The preflight state changed');
  const result = { status: 'survey-blocked-before-fixture-setup', refused,
    preservedState: true, scratchTracksCreated: 0, graphCaptures: 0,
    next: '9b.2: prepare a separate scratch-target reader, then resume the survey' };
  save('result', result);
  console.log(JSON.stringify(result));
} catch (error) {
  save('failure', { error: String(error) });
  throw error;
} finally {
  save('calls', { calls, sequentialWireCalls: calls.length,
    wireMs: calls.reduce((total, call) => total + call.ms, 0) });
  client.disconnect();
}
