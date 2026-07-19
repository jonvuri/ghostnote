/**
 * E0 — Toolchain bring-up probe.
 *
 * Requires: Bitwig running with the ghostnote controller added
 * (Settings > Controllers > Add Extension > ghostnote > ghostnote bridge).
 *
 * Verifies:
 *  1. TCP connect + ping round-trip
 *  2. host.info: API version, Bitwig version, extension-runtime JVM version
 *  3. echo: framing round-trip incl. unicode + long payloads
 *  4. malformed line -> -32700 error, connection stays usable (framing fix)
 *  5. unknown method -> -32601
 *  6. popup notification visible in Bitwig
 */
import { BridgeClient, BridgeError } from '../client.js';

const client = new BridgeClient();

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  ${JSON.stringify(detail)}` : ''}`);
  if (!ok) failures++;
}

try {
  await client.connect();
  console.log('connected to 127.0.0.1:8686\n');
} catch (err) {
  console.error('Could not connect — is Bitwig running with the ghostnote controller added?');
  console.error(String(err));
  process.exit(1);
}

// 1. ping
const pong = (await client.request('ping')) as { pong: boolean; thread: string };
check('ping', pong.pong === true, pong);

// 2. host info
const info = await client.request('host.info');
check('host.info', typeof (info as any).hostApiVersion === 'number', info);

// 3. echo framing round-trips
const payload = { unicode: 'ghost🎹nöte — ♯♭', nested: { a: [1, 2.5, null, 'x'] }, big: 'y'.repeat(20000) };
const echoed = (await client.request('echo', payload)) as typeof payload;
check('echo unicode', echoed.unicode === payload.unicode);
check('echo nested', JSON.stringify(echoed.nested) === JSON.stringify(payload.nested));
check('echo 20KB payload', echoed.big === payload.big);

// 4. malformed line does not poison the connection
const orphans = await client.sendRaw('{this is not json');
check('malformed line -> -32700', orphans.some((m) => m.error?.code === -32700), orphans);
const pongAfter = (await client.request('ping')) as { pong: boolean };
check('connection usable after malformed line', pongAfter.pong === true);

// 5. unknown method
try {
  await client.request('no.such.method');
  check('unknown method -> -32601', false);
} catch (err) {
  check('unknown method -> -32601', err instanceof BridgeError && err.code === -32601, String(err));
}

// 6. popup notification (visual check in Bitwig)
await client.request('notify', { message: 'ghostnote E0 probe: hello from the brain' });
console.log('\n-> check Bitwig for popup: "ghostnote E0 probe: hello from the brain"');

console.log(failures === 0 ? '\nE0 probe: all checks passed' : `\nE0 probe: ${failures} FAILURES`);
client.disconnect();
process.exit(failures === 0 ? 0 : 1);
