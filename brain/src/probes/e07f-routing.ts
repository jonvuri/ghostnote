/**
 * E7f — last-ditch sweep: is there ANY runtime angle on creating/changing a
 * modulation ROUTING TARGET?
 *
 * Offline recall (member-search-index, all versions) found no route-creating
 * member. This probe covers the remaining LIVE angles:
 *   A. named actions mentioning map/learn/modulat/assign (E6 says actions are
 *      unusable anyway; this documents whether the residual even exists)
 *   B. the mapping-completion idiom headless: isBeingMapped.set(true) then
 *      Parameter.touch(true/false) as the programmatic "touch a param"
 *   C. (optional, user-assisted) same as B with Bitwig FOREGROUNDED — E6
 *      showed GUI-state gates flip when the app is frontmost. Enable with
 *      GN_FOREGROUND=1 once the user confirms Bitwig is frontmost.
 */
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';

const MECH = 'trackThenSlot';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';

type RemoteList = {
  remotes: { index: number; exists: boolean; name?: string; value?: number; isBeingMapped?: boolean }[];
  existing: number; pageCount: number; selectedPageIndex: number; pageNames: string[]; deviceName: string;
};
type ParamList = { params: { id: string; exists: boolean; value?: number }[] };
const remoteList = async () => (await client.request('remote.list')) as RemoteList;
const paramList = async () => (await client.request('param.list')) as ParamList;
const devList = async () =>
  (await client.request('device.list', { cursor: '0' })) as { count: number };

async function clearDevices() {
  let l = await devList();
  for (let g = 0; g < 8 && l.count > 0; g++) {
    await client.request('device.delete', { cursor: '0', deviceIndex: 0 });
    await pollUntil(async () => (await devList()).count < l.count, 4000);
    l = await devList();
  }
  return l.count === 0;
}

await client.connect();
console.log('connected\n');
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

// ---- A. named-action residual
console.log('-- A. named actions mentioning mapping/learn/modulator');
for (const filter of ['map', 'learn', 'modulat', 'assign']) {
  const r = (await client.request('app.actions', { filter })) as
    { matched: number; actions: { id: string; name: string; category: string }[] };
  note(`filter "${filter}": ${r.matched} — ` +
    (r.actions.slice(0, 6).map((a) => a.id).join(', ') || '(none)'));
}
note('(E6: actions are foreground+focus-gated and selection-coupled — even a hit');
note(' here would be unusable; this documents the residual only.)');

// ---- B. mapping-completion idiom, headless
console.log('\n-- B. isBeingMapped + Parameter.touch() as the mapping gesture (headless)');
await clearDevices();
await client.request('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
await pollUntil(async () => (await devList()).count === 1, 8000);
await client.request('devcursor.selectAt', { deviceIndex: 0 });
await pollUntil(async () => (await remoteList()).deviceName.toLowerCase().includes('poly'), 6000);
await new Promise((r) => setTimeout(r, 700));

const foreground = process.env.GN_FOREGROUND === '1';
const label = foreground ? 'FOREGROUND' : 'headless';
const r0 = (await remoteList()).remotes.find((r) => r.exists)!;
note(`${label}: remote[${r0.index}]="${r0.name}" — enter mapping mode, then touch F1FREQ`);

await client.request('remote.setMapping', { index: r0.index, mapping: true });
await new Promise((r) => setTimeout(r, 300));
const latched = (await remoteList()).remotes.find((r) => r.index === r0.index)?.isBeingMapped;
note(`isBeingMapped after set(true): ${latched}`);

// the "touch": controller-side touch + an actual value write, then release
await client.request('param.touch', { id: 'F1FREQ', touched: true });
await client.request('param.set', { id: 'F1FREQ', value: 0.35 });
await new Promise((r) => setTimeout(r, 300));
await client.request('param.touch', { id: 'F1FREQ', touched: false });
await new Promise((r) => setTimeout(r, 500));

const after = (await remoteList()).remotes.find((r) => r.index === r0.index)!;
note(`after touch-gesture: isBeingMapped=${after.isBeingMapped}, remote name="${after.name}"`);

// did a mapping form? drive the remote; see if F1FREQ follows
const f1Before = (await paramList()).params.find((p) => p.id === 'F1FREQ')?.value ?? -1;
await client.request('remote.set', { index: r0.index, value: f1Before > 0.5 ? 0.15 : 0.9 });
await new Promise((r) => setTimeout(r, 600));
const f1After = (await paramList()).params.find((p) => p.id === 'F1FREQ')?.value ?? -1;
const mapped = Math.abs(f1After - f1Before) > 0.05
  && !/osc1pitch/i.test(after.name ?? 'osc1pitch') === false; // name unchanged = original mapping
note(`drive remote[${r0.index}] hard: F1FREQ ${f1Before.toFixed(3)} -> ${f1After.toFixed(3)}`);

const routeFormed = latched === true || Math.abs(f1After - f1Before) > 0.05;
check(`${label}: touch-gesture does NOT complete a mapping (expected negative)`,
  !routeFormed, { latched, f1Before: f1Before.toFixed(3), f1After: f1After.toFixed(3) });
// make sure we left no mapping mode behind
await client.request('remote.setMapping', { index: r0.index, mapping: false });

// ---- cleanup
console.log('\n-- cleanup');
check('gn-A devices removed', await clearDevices());
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });

console.log(failureCount() === 0 ? '\nE7f: all checks passed' : `\nE7f: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
