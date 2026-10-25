/**
 * B08 scrollable-scope probe. Run only after probe:hello passes and the
 * identified gn-b08 scratch track holds the expected containers.
 *
 *   npm run probe:b08-scope -- --project NAME --generation ID --track-id ID \
 *     --expect FILE.json --out NEW_DIRECTORY
 *
 * FILE.json: { "resting": Container, "far": Container } where a Container is
 * { position, name, chains: [{ name, devices: [names] }] }. `resting` sits at
 * top-level position 0; `far` at position 3 or later with more chains than the
 * probe's layer window and one chain with more devices than its device window.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { BridgeClient } from '../client.js';
import { readProbeGolden } from '../tools/wire-golden.js';
import { compareDeployment, deployedAtMs } from '../deploy.js';
import { runScopeScrollProbe, type Container } from './b08-scope-scroll-lib.js';

const { values } = parseArgs({ options: {
  project: { type: 'string' }, generation: { type: 'string' }, 'track-id': { type: 'string' },
  expect: { type: 'string' }, out: { type: 'string' },
} });
if (!values.project || !values.generation || !values['track-id'] || !values.expect || !values.out) {
  throw new Error('required: --project NAME --generation ID --track-id ID --expect FILE --out NEW_DIRECTORY');
}
const expectation = JSON.parse(readFileSync(values.expect, 'utf8')) as { resting: Container; far: Container };
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
  record('entry', { hello, stats, expectation });
  // Cursor track 0 must sit on the identified scratch track; the probe's banks hang off it.
  const tracks = await client.request('track.list') as { tracks: { index: number; name: string; channelId: string }[] };
  const scratch = tracks.tracks.find((track) => track.channelId === values['track-id']);
  if (scratch === undefined || !scratch.name.startsWith('gn-b08')) throw new Error('the identified track is not a listed gn-b08 scratch track');
  await client.request('cursor.pointTrack', { cursor: '0', trackIndex: scratch.index });
  await setTimeout(500);
  record('cursor-pointed', { scratch });
  const verdict = await runScopeScrollProbe({
    wire: (method, params) => client.request(method, params),
    wait: (ms) => setTimeout(ms),
    now: () => performance.now(),
    record,
    target: { project: values.project, generation: values.generation, trackId: values['track-id'] },
    resting: expectation.resting,
    far: expectation.far,
  });
  record('verdict', verdict);
  console.log(JSON.stringify(verdict, null, 2));
} catch (error) {
  record('failure', { error: String(error) });
  throw error;
} finally {
  client.disconnect();
}
