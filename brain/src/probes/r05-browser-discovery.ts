/** Run only after probe:hello and creation/verification of one owned gn-r05-* track. */
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { BridgeClient } from '../client.js';
import { readProbeGolden } from '../tools/wire-golden.js';
import { compareDeployment, deployedAtMs } from '../deploy.js';
import { BROWSER_WAITS, discoverBrowserNames } from './r05-browser-discovery-lib.js';

const { values } = parseArgs({ options: {
  project: { type: 'string' }, generation: { type: 'string' }, 'track-id': { type: 'string' }, out: { type: 'string' },
} });
if (!values.project || !values.generation || !values['track-id'] || !values.out) {
  throw new Error('required: --project NAME --generation ID --track-id ID --out NEW_DIRECTORY');
}
const output = values.out;
mkdirSync(output, { recursive: false }); // Refuse to overwrite an earlier attempt.
const client = new BridgeClient();
const started = performance.now();
let sequence = 0;
function record(label: string, value: unknown) {
  writeFileSync(join(output, `${String(sequence++).padStart(3, '0')}-${label}.json`),
    `${JSON.stringify({ elapsedMs: performance.now() - started, value }, null, 2)}\n`);
}
try {
  const hello = await client.request('contract.hello') as { runtimeProfile: string; methodCount: number; methodsHash: string };
  const golden = readProbeGolden();
  if (hello.runtimeProfile !== golden.identity || hello.methodsHash !== golden.methodsHash || hello.methodCount !== golden.count) {
    throw new Error('live probe profile differs from the active golden');
  }
  const stats = await client.request('rig.stats') as { initEpochMs: number };
  const deployment = compareDeployment(deployedAtMs(), stats.initEpochMs);
  if (deployment.state !== 'fresh') throw new Error(`probe freshness unconfirmed: ${deployment.detail}`);
  record('entry', { hello, stats, waitsMs: BROWSER_WAITS });
  const verdict = await discoverBrowserNames({
    request: params => client.request('probe.browserDiscovery', params),
    wait: ms => setTimeout(ms), record,
    target: { project: values.project, generation: values.generation, trackId: values['track-id'] },
    token: randomUUID(),
  });
  record('verdict', verdict);
  console.log(JSON.stringify(verdict, null, 2));
} catch (error) {
  record('failure', { error: String(error) });
  throw error;
} finally {
  client.disconnect();
}
