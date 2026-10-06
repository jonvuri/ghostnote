/**
 * Deployment smoke check — the FIRST thing run after any extension deploy.
 *
 * Order matters and this is why it is separate from every other probe: if a
 * handle marked at init() throws, `init()` aborts and the bridge never binds
 * (E7 Finding 0 — carrying a @Deprecated handle took the whole extension down).
 * A silent `ping` timeout after a deploy means the extension is DEAD, not slow,
 * and nothing else is worth running until this passes.
 *
 * It then selects the active golden from the runtime profile and diffs the
 * live method table against it.
 *
 *   npm run probe:hello
 *   npm run probe:hello -- --watch-marker 8h3d-watch-v1
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { compareDeployment, deployedAtMs } from '../deploy.js';
import { client, check, note, failureCount } from './lib.js';

console.log('-- A. the extension is alive (init() did not throw)');
const ping = (await client.request('ping')) as { pong: boolean; thread: string };
note(`ping -> ${JSON.stringify(ping)}`);
check('bridge answers and runs on the control-surface thread', ping.pong === true && /Control Surface/i.test(ping.thread), ping);

const rig = (await client.request('rig.info')) as Record<string, unknown>;
note(`rig.info -> ${JSON.stringify(rig)}`);
check('the rig constructed (so no marked handle threw at init — E7-0)', typeof rig['tracks'] === 'number', rig);

const reader = rig['clipReader'] as Record<string, unknown> | undefined;
check('the product clip reader has the required build marker and configuration',
  reader?.['revision'] === 'clip-reader-v1' && reader?.['closeRule'] === 'confirm-before-release-v1'
    && reader?.['openRule'] === 'subscribe-before-unpin-v1'
    && reader?.['format'] === 'notes-v1'
    && reader?.['width'] === 4_194_304 && reader?.['grid'] === 1 / 512,
  reader);

console.log('\n-- B. the contract handshake');
const hello = (await client.request('contract.hello')) as {
  contractVersion: number; extensionVersion: string; hostApiVersion: number;
  runtimeProfile: string; methodCount: number; methodsHash: string;
};
note(`contract.hello -> ${JSON.stringify(hello)}`);
check('contract version is v0', hello.contractVersion === 0, hello);
check('host API version is 25 (Bitwig 6.0.6)', hello.hostApiVersion === 25, hello);

const goldenFiles: Record<string, string> = {
  'normal-v1': 'methods.golden.json',
  'capture-v1': 'methods.capture.golden.json',
  'phase-8-probe-v1': 'methods.probe.golden.json',
};
const goldenFile = goldenFiles[hello.runtimeProfile];
check('runtime profile has an active golden', goldenFile !== undefined, hello);
if (goldenFile === undefined) throw new Error(`unknown runtime profile: ${hello.runtimeProfile}`);
const golden = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', '..', '..', 'extension', goldenFile), 'utf8'),
) as { identity: string; count: number; methodsHash: string; methods: string[] };
check('handshake identity matches the selected golden', hello.runtimeProfile === golden.identity,
  { live: hello.runtimeProfile, golden: golden.identity });

console.log('\n-- C. the wire method table matches its active golden');
const live = (await client.request('rig.methods')) as {
  runtimeProfile: string; methods: string[]; count: number; methodsHash: string;
};
const missing = golden.methods.filter((m) => !live.methods.includes(m));
const extra = live.methods.filter((m) => !golden.methods.includes(m));
note(`live: ${live.count} methods, hash ${live.methodsHash}`);
note(`golden: ${golden.count} methods, hash ${golden.methodsHash}`);
if (missing.length) note(`MISSING from live: ${missing.join(', ')}`);
if (extra.length) note(`EXTRA in live: ${extra.join(', ')}`);
check('every golden method is registered live', missing.length === 0, { missing });
check('live registers nothing the golden does not know about', extra.length === 0, { extra });
check('methodsHash agrees between brain and extension', live.methodsHash === golden.methodsHash,
  { live: live.methodsHash, golden: golden.methodsHash });
check('contract.hello and rig.methods agree', hello.methodsHash === live.methodsHash, { hello, live });
check('contract.hello and rig.methods identify the same runtime profile',
  hello.runtimeProfile === live.runtimeProfile, { hello, live });

console.log('\n-- D. bank-window overflow is observable (standing rule 5)');
const tracks = (await client.request('track.list')) as { count: number; itemCount?: number; bankSize?: number };
note(`track.list -> count=${tracks.count} itemCount=${tracks.itemCount} bankSize=${tracks.bankSize}`);
check('track.list reports itemCount (trackBank.itemCount() marked without throwing)',
  tracks.itemCount !== undefined, tracks);
check('track.list reports bankSize', tracks.bankSize !== undefined, tracks);

// ⚠⚠ E. IS BITWIG RUNNING THE BUILD THAT IS ON DISK?
//
// Last, and the most important check in this file, because it is the one whose
// ABSENCE cost a whole cycle: everything above passed green against a jar Bitwig
// had never loaded. `methodsHash` compares method NAMES, so a change that only
// adds fields to an existing reply leaves the whole table identical — and every
// field session 3 added was exactly that shape.
//
// ⚠ It is a CHECK and not a note, deliberately. A warning printed among passes
// is what "all green" already was; this has to be able to fail the run, or the
// next person trusts `ALL PASS` the way I did.
console.log('\n-- E. the running extension is the deployed one (deploy.ts)');
const stats = (await client.request('rig.stats')) as { initEpochMs?: number };
const deployment = compareDeployment(deployedAtMs(), stats.initEpochMs ?? -1);
note(deployment.detail);
check('the running extension is not older than the deployed file',
  deployment.state !== 'stale', deployment);
if (deployment.state === 'unknown') {
  note('⚠ UNCHECKED — see above. Absence of the file is not evidence of freshness.');
}

// A cached class can start after deployment. Check each requested marker.
// 8h3e: the probe profile keeps only the change-watch and fixture research operations.
const markerChecks = [
  ['--watch-marker', 'watchStatus', 'revision'],
] as const;
for (const [argument, operation, field] of markerChecks) {
  const markerArgument = process.argv.indexOf(argument);
  if (markerArgument === -1) continue;
  const expectedMarker = process.argv[markerArgument + 1];
  if (!expectedMarker || expectedMarker.startsWith('--')) throw new Error(`${argument} requires a value`);
  const result = await client.request('cache.shadow', { operation }) as Record<string, unknown>;
  check(`the running build has the requested ${field}`, result[field] === expectedMarker,
    { expected: expectedMarker, actual: result[field] });
}

client.disconnect();
console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
process.exit(failureCount() === 0 ? 0 : 1);
