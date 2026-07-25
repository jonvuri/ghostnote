/**
 * Deployment smoke check — the FIRST thing run after any extension deploy.
 *
 * Order matters and this is why it is separate from every other probe: if a
 * handle marked at init() throws, `init()` aborts and the bridge never binds
 * (E7 Finding 0 — carrying a @Deprecated handle took the whole extension down).
 * A silent `ping` timeout after a deploy means the extension is DEAD, not slow,
 * and nothing else is worth running until this passes.
 *
 * It then diffs the live method table against extension/methods.golden.json,
 * which is what proves the Phase-0 handler split changed no wire behaviour.
 *
 *   npm run probe:hello
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { client, check, note, failureCount } from './lib.js';

const golden = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', '..', '..', 'extension', 'methods.golden.json'), 'utf8'),
) as { count: number; methodsHash: string; methods: string[] };

console.log('-- A. the extension is alive (init() did not throw)');
const ping = (await client.request('ping')) as { pong: boolean; thread: string };
note(`ping -> ${JSON.stringify(ping)}`);
check('bridge answers and runs on the control-surface thread', ping.pong === true && /Control Surface/i.test(ping.thread), ping);

const rig = (await client.request('rig.info')) as Record<string, unknown>;
note(`rig.info -> ${JSON.stringify(rig)}`);
check('the rig constructed (so no marked handle threw at init — E7-0)', typeof rig['tracks'] === 'number', rig);

console.log('\n-- B. the contract handshake');
const hello = (await client.request('contract.hello')) as {
  contractVersion: number; extensionVersion: string; hostApiVersion: number;
  methodCount: number; methodsHash: string;
};
note(`contract.hello -> ${JSON.stringify(hello)}`);
check('contract version is v0', hello.contractVersion === 0, hello);
check('host API version is 25 (Bitwig 6.0.6)', hello.hostApiVersion === 25, hello);

console.log('\n-- C. the wire method table matches the golden (the split was a no-op)');
const live = (await client.request('rig.methods')) as { methods: string[]; count: number; methodsHash: string };
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

console.log('\n-- D. bank-window overflow is observable (standing rule 5)');
const tracks = (await client.request('track.list')) as { count: number; itemCount?: number; bankSize?: number };
note(`track.list -> count=${tracks.count} itemCount=${tracks.itemCount} bankSize=${tracks.bankSize}`);
check('track.list reports itemCount (trackBank.itemCount() marked without throwing)',
  tracks.itemCount !== undefined, tracks);
check('track.list reports bankSize', tracks.bankSize !== undefined, tracks);

client.disconnect();
console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
process.exit(failureCount() === 0 ? 0 : 1);
