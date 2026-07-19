/**
 * E4b — CLAP direct-parameter access via the format-agnostic DirectParameter
 * API on Device (addDirectParameter*Observer / setDirectParameterValueNormalized).
 * Tests the claim from E4 that CLAP params are unreachable — they are NOT, via
 * this older-but-live path. Also confirms the same path works on Bitwig devices.
 *
 * Inserts + deletes a CLAP Stochas on gn-A. Restores fixtures.
 */
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';

const MECH = 'trackThenSlot';
const CLAP_STOCHAS = 'org.surge-synth-team.stochas';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const near = (a: number, b: number, eps = 0.03) => Math.abs(a - b) <= eps;

type DParam = { id: string; name?: string; value?: number; displayed?: string };
type DList = { params: DParam[]; count: number; deviceExists: boolean; deviceName: string };
const dlist = async () => (await client.request('directparam.list')) as DList;
const devList = async () => (await client.request('device.list', { cursor: '0' })) as { count: number; devices: { index: number; name: string }[] };
async function clearDevices() {
  let l = await devList();
  for (let g = 0; g < 8 && l.count > 0; g++) {
    await client.request('device.delete', { cursor: '0', deviceIndex: l.devices[0].index });
    await pollUntil(async () => (await devList()).count < l.count, 4000);
    l = await devList();
  }
  return l.count === 0;
}

await client.connect();
console.log('connected\n');
const { trackA } = await ensureFixtureTracks();

// ============================================================ CLAP
console.log('-- CLAP: insert Stochas, enumerate params via DirectParameter API');
await point('0', trackA, 0, MECH);
check('gn-A chain cleared', await clearDevices());

await client.request('device.insertClap', { cursor: '0', clapId: CLAP_STOCHAS });
const inserted = await pollUntil(async () => (await devList()).count === 1, 8000);
check('CLAP Stochas inserted', inserted.ok, { settleMs: inserted.ms, devices: (await devList()).devices });
await client.request('devcursor.selectAt', { deviceIndex: 0 });

// DirectParameter observers populate asynchronously — poll for IDs
const enumerated = await pollUntil(async () => (await dlist()).count > 0, 8000);
const dl = await dlist();
note(`device cursor: exists=${dl.deviceExists} name="${dl.deviceName}"; direct params enumerated: ${dl.count}`);
check('CLAP params ENUMERATED via DirectParameter API (self-discovering, no IDs known upfront)',
  enumerated.ok && dl.count > 0, { count: dl.count });

const withName = dl.params.filter((p) => p.name && p.name.length > 0).length;
const withValue = dl.params.filter((p) => typeof p.value === 'number').length;
const withDisp = dl.params.filter((p) => p.displayed && p.displayed.length > 0).length;
note(`sample CLAP params: ` + dl.params.slice(0, 8).map((p) => `${p.id}:"${p.name}"=${p.displayed}(${p.value?.toFixed(2)})`).join(', '));
check('CLAP params self-describe (name + value + displayed)',
  withName > 0 && withValue > 0 && withDisp > 0, { count: dl.count, withName, withValue, withDisp });

// CLAP write attempt (best-effort; some plugins don't accept host param writes)
const ctarget = dl.params.find((p) => typeof p.value === 'number' && p.value! > 0.05 && p.value! < 0.95)
            ?? dl.params.find((p) => typeof p.value === 'number');
if (ctarget) {
  const before = ctarget.value!;
  const want = before > 0.5 ? 0.2 : 0.8;
  await client.request('directparam.set', { id: ctarget.id, value: want });
  const wrote = await pollUntil(async () => {
    const p = (await dlist()).params.find((x) => x.id === ctarget.id);
    return p ? near(p.value!, want) : false;
  }, 3000);
  const after = (await dlist()).params.find((x) => x.id === ctarget.id);
  note(`CLAP write "${ctarget.name}" ${before.toFixed(3)}->want ${want}: after=${after?.value?.toFixed(3)} (${wrote.ok ? 'took' : 'NO CHANGE — likely plugin-specific'})`);
}

// ============================================================ Bitwig via same path
console.log('\n-- same DirectParameter path on a Bitwig device (write + display validation)');
await clearDevices();
await client.request('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
await pollUntil(async () => (await devList()).count === 1, 6000);
await client.request('devcursor.selectAt', { deviceIndex: 0 });
await pollUntil(async () => (await dlist()).count > 0, 6000);
await new Promise((r) => setTimeout(r, 800)); // let name/value/display observers stream in
const bdl = await dlist();
note(`Polysynth via DirectParameter: ${bdl.count} params; sample: ` +
  bdl.params.slice(0, 5).map((p) => `${p.id}:"${p.name}"=${p.displayed}(${p.value?.toFixed(2)})`).join(', '));
check('DirectParameter API also enumerates Bitwig-device params (fully format-agnostic)',
  bdl.count > 0, { count: bdl.count });
const bDisp = bdl.params.filter((p) => p.displayed && p.displayed.length > 0).length;
check('display-value observer populates (on a device that reports displays)', bDisp > 0, { withDisplay: bDisp });

// write on a known-writable Bitwig param via DirectParameter; try resolutions
const fFreq = bdl.params.find((p) => p.id.includes('F1FREQ')) ?? bdl.params.find((p) => typeof p.value === 'number');
if (fFreq) {
  const before = fFreq.value!;
  let took = false; let usedRes = 0; let observed = before;
  for (const res of [128, 1, 1000000]) {
    const want = before > 0.5 ? 0.2 : 0.8;
    await client.request('directparam.set', { id: fFreq.id, value: want, resolution: res });
    const w = await pollUntil(async () => {
      const p = (await dlist()).params.find((x) => x.id === fFreq.id);
      return p ? near(p.value!, want) : false;
    }, 1500);
    observed = (await dlist()).params.find((x) => x.id === fFreq.id)!.value!;
    if (w.ok) { took = true; usedRes = res; break; }
  }
  check('DirectParameter WRITE works on a Bitwig param (setDirectParameterValueNormalized)',
    took, { id: fFreq.id, before: before.toFixed(3), observed: observed.toFixed(3), usedRes });
}

// ============================================================ cleanup
console.log('\n-- cleanup');
check('devices removed', await clearDevices());
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });

console.log(failureCount() === 0 ? '\nE4b: all checks passed' : `\nE4b: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
