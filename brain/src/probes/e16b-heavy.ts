/**
 * E16 rows B and C2 — does a duplicate carry STATE, and what does a realistic
 * one cost?
 *
 * Row A proved a track can be duplicated and that an ordinary instrument track's
 * clips and mixer strip come with it. That is not the question kill criterion 2
 * asks. The question is **opaque plugin state**: a CLAP/VST3 whose patch the
 * host cannot see, and D1's surgically-authored modulator, which E11g proved
 * survives save→restart but which duplication has never been asked about.
 *
 * So this builds the deliberately hard fixture `SPIKE-E16 §5 row B` specifies —
 * two formats of the same expensive synth, a native device, an authored
 * modulator, clips in three scenes, non-default mixer state — duplicates it, and
 * reads every property back **through a cursor that did not make it** (standing
 * rule 3a; two spike findings were wrong for exactly this reason).
 *
 * ⚠ The fixture is deliberately LEFT IN PLACE at the end. §9 says it is reusable
 * for Phases 4 and 5 whatever E16 decides, and rebuilding it costs ~10s of
 * plugin loading every run.
 *
 * Duplicates are deleted. The fixture track `gn-E16` is not.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';
import { resolve as resolvePath } from 'node:path';

const REPO = resolvePath(import.meta.dirname, '..', '..');
// E11g's fixture: Zebra3 as a CLAP with a surgically-authored LFO modulator
// inside it. One file covers B2 (opaque plugin state) and B3 (D1's modulator).
const ZEBRA_CLAP_LFO = resolvePath(REPO, 'fixtures', 'Zebra3', 'gn_zebra3clap_one_lfo.bwpreset');
// Zebra3 again, as a VST3 this time, so B2 covers both formats. The ID is the
// VST3 class UID out of Bitwig's own plugin cache — there is no enumeration API.
const ZEBRA_VST3_ID = 'D39D5B69D6AF42FA123456785A334D44';
const POLYSYNTH_UUID = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
// A NATIVE device carrying a surgically-authored LFO, whose modulation E7d
// already proved is observable through the remote page (F1FREQ sweeping while
// its base value holds). The Zebra3 CLAP fixture also carries an authored LFO,
// but nothing it modulates is visible on a remote page, so it can answer "is the
// modulator THERE" and not "is it still LIVE". This one answers both.
const POLY_LFO = resolvePath(REPO, 'fixtures', 'Polysynth', 'modtest.bwpreset');
const FIXTURE = 'gn-E16';

type TrackRow = { index: number; name: string; position: number; type: string; channelId: string };
type TrackList = { tracks: TrackRow[]; count: number; itemCount: number; bankSize: number };
type DeviceRow = { index: number; name: string; exists: boolean };
type DirectParam = { id: string; name: string; value?: number; displayed?: string };
type Remote = { index: number; exists: boolean; name: string; value?: number; modulatedValue?: number };

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const list = async () => (await req('track.list')) as TrackList;
const resolveId = async (channelId: string) =>
  (await req('track.resolveByChannelId', { channelId })) as { found: boolean; index?: number };
const devices = async () =>
  ((await req('device.list', { cursor: '0' })) as { devices: DeviceRow[]; count: number });
const mixer = async (trackIndex: number) => (await req('branch.mixer', { trackIndex })) as
  { volume: number; pan: number; color: string; sends: { value: number }[] };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

await client.connect();
console.log('connected\n');

// ---------------------------------------------------------------- the fixture
console.log('-- building / finding the hard fixture');
let all = await list();
if (all.itemCount > all.bankSize) {
  console.log('REFUSING: project exceeds the bank window (standing rule 5).');
  process.exit(1);
}
let fixture = all.tracks.find((t) => t.name === FIXTURE);
let built = false;
if (fixture === undefined) {
  const before = all.count;
  await req('track.create', { position: before });
  await pollUntil(async () => (await list()).count === before + 1, 8000, 100);
  const after = await list();
  const known = new Set(all.tracks.map((t) => t.channelId));
  const fresh = after.tracks.find((t) => !known.has(t.channelId))!;
  await req('track.setName', { trackIndex: fresh.index, name: FIXTURE });
  await pollUntil(async () => (await list()).tracks.some((t) => t.name === FIXTURE), 4000, 100);
  fixture = (await list()).tracks.find((t) => t.name === FIXTURE)!;
  built = true;
}
const fixtureId = fixture.channelId;
note(`fixture: [${fixture.index}] "${fixture.name}" ${fixtureId}${built ? ' (created)' : ' (reused)'}`);

await req('cursor.pointTrack', { cursor: '0', trackIndex: fixture.index });
await pollUntil(async () => {
  const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
  return s.trackPosition === fixture!.position;
}, 4000, 100);

// ⚠ Rebuilt from empty every run, not topped up. The first version appended
// whatever was missing, which on the second run turned a 3-device chain into a
// 7-device one and left the comparison reading a device nobody meant to build.
// A fixture that drifts is worse than one that costs 3s to rebuild — and it
// costs far less than that, because Bitwig caches the plugin scan (~45ms).
const EXPECTED = ['Zebra3', 'Zebra3', 'Polysynth'];
let chain = await devices();
if (JSON.stringify(chain.devices.map((d) => d.name)) !== JSON.stringify(EXPECTED)) {
  note(`chain is [${chain.devices.map((d) => d.name).join(', ')}]; rebuilding from empty`);
  for (let guard = 0; guard < 16 && (await devices()).count > 0; guard++) {
    const first = (await devices()).devices[0]!;
    const n = (await devices()).count;
    await req('device.delete', { cursor: '0', deviceIndex: first.index });
    await pollUntil(async () => (await devices()).count < n, 6000, 100);
  }
  const t0 = Date.now();
  await req('device.insertFile', { cursor: '0', path: ZEBRA_CLAP_LFO });
  await pollUntil(async () => (await devices()).count >= 1, 20000, 200);
  note(`  Zebra3 CLAP + authored LFO loaded (${Date.now() - t0}ms)`);
  const t1 = Date.now();
  await req('device.insertVst3', { cursor: '0', vst3Id: ZEBRA_VST3_ID });
  const vst = await pollUntil(async () => (await devices()).count >= 2, 30000, 200);
  note(`  Zebra3 VST3 ${vst.ok ? 'loaded' : 'DID NOT APPEAR'} (${Date.now() - t1}ms)`);
  const t2 = Date.now();
  await req('device.insertFile', { cursor: '0', path: POLY_LFO });
  await pollUntil(async () => (await devices()).count >= 3, 15000, 200);
  note(`  Polysynth + surgically-authored LFO loaded (${Date.now() - t2}ms)`);
  chain = await devices();
}
note(`chain: ${chain.devices.map((d) => d.name).join(' → ')}`);
check('the fixture is exactly [CLAP+LFO, VST3, native+authored-LFO]',
  JSON.stringify(chain.devices.map((d) => d.name)) === JSON.stringify(EXPECTED),
  { names: chain.devices.map((d) => d.name) });

// Clips in three scenes, so B4 is asked of more than one slot.
for (const slot of [0, 1, 2]) {
  const has = async () =>
    ((await req('slot.status', { trackIndex: fixture!.index, slotIndex: slot })) as { hasContent: boolean }).hasContent;
  if (!(await has())) {
    await req('clip.create', { trackIndex: fixture.index, slotIndex: slot, lengthBeats: 4 });
    await pollUntil(has, 6000, 100);
  }
}
const NOTES: Record<number, [number, number, number, number][]> = {
  0: [[0, 60, 100, 1], [4, 64, 90, 1], [8, 67, 80, 1]],
  1: [[0, 62, 110, 2], [8, 65, 70, 1]],
  2: [[2, 59, 120, 1], [6, 71, 60, 2]],
};
for (const slot of [0, 1, 2]) {
  await req('slot.select', { trackIndex: fixture.index, slotIndex: slot, mechanism: 'slot' });
  await req('cursor.pointToClipOf', { cursor: '0', from: 'follower' });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { sceneIndex: number; exists: boolean };
    return s.exists && s.sceneIndex === slot;
  }, 4000, 100);
  await req('cursor.setNotes', { cursor: '0', notes: NOTES[slot] });
}
await req('branch.setMixer', {
  trackIndex: fixture.index, volume: 0.58, pan: 0.42, color: [0.15, 0.75, 0.55],
});
const fixtureMixer = await mixer(fixture.index);
note(`fixture mixer: vol=${fixtureMixer.volume.toFixed(3)} pan=${fixtureMixer.pan.toFixed(3)} color=${fixtureMixer.color}`);

// ------------------------------------------------- snapshot the ORIGINAL
console.log('\n-- snapshot: the original, read through cursor 0');
const snapshot = async (trackIndex: number, label: string) => {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await wait(400);
  const chain = await devices();
  // ⚠ NOT `.filter(d => d.exists)`. `device.list` rows carry `index` and `name`
  // only — the handler already drops non-existent slots — so filtering on a
  // field that is always `undefined` empties the list, and a comparison of two
  // empty lists PASSES. The first run of this probe did exactly that and
  // reported a green B1 that had checked nothing.
  const names = chain.devices.map((d) => d.name);

  // The opaque half: DirectParameter is the format-agnostic route (E4b) and is
  // the only way to see inside a CLAP/VST3 at all.
  await req('devcursor.selectAt', { deviceIndex: 0 });
  await wait(700);
  const dl = (await req('directparam.list')) as { params: DirectParam[]; count: number };
  const sample = dl.params.slice(0, 12).map((p) => `${p.id}=${p.value?.toFixed(4) ?? '?'}`);

  // The modulator half: pages, and whether anything is LIVE (base value still,
  // modulatedValue sweeping — the E7 oracle).
  //
  // ⚠ The clip has to be LAUNCHED first. A per-voice modulator outputs nothing
  // while the project is silent (E7e), so scanning a stopped project reports
  // "no modulation" on a perfectly live LFO — which is a false negative, and on
  // the copy it would be a false PASS by symmetry.
  const rl = (await req('remote.list')) as { deviceName: string; pageNames: string[]; remotes: Remote[] };

  // The liveness scan runs on the device that actually CARRIES the authored
  // modulator, found by looking for its page rather than by index. A bare
  // Polysynth shows [OSC1, OSC2, MIX, …]; one with a surgical LFO shows an extra
  // `LFO` page (E11g's own oracle). Selecting by index picked the bare one on
  // the previous run and reported a confident "no modulation".
  let modIndex = chain.devices[chain.devices.length - 1]!.index;
  for (const d of chain.devices) {
    await req('devcursor.selectAt', { deviceIndex: d.index });
    await wait(600);
    const pages = ((await req('remote.list')) as { pageNames: string[] }).pageNames;
    if (pages.includes('LFO') && d.name === 'Polysynth') {
      modIndex = d.index;
      break;
    }
  }
  await req('devcursor.selectAt', { deviceIndex: modIndex });
  await wait(700);
  await req('slot.launch', { trackIndex, slotIndex: 0 });
  await wait(1500);
  const modPage = (await req('remote.list')) as { deviceName: string; pageNames: string[] };
  const divergence: string[] = [];
  for (let pg = 0; pg < modPage.pageNames.length; pg++) {
    await req('remote.selectPage', { index: pg });
    await wait(250);
    for (let s = 0; s < 5; s++) {
      const l = (await req('remote.list')) as { remotes: Remote[] };
      for (const rc of l.remotes) {
        if (rc.exists && rc.value !== undefined && rc.modulatedValue !== undefined) {
          const d = Math.abs(rc.modulatedValue - rc.value);
          if (d > 1e-3) divergence.push(`${modPage.pageNames[pg]}/${rc.name}:${d.toFixed(3)}`);
        }
      }
      // Second oracle, independent of which page is selected: the 16 typed
      // Polysynth handles carry modulatedValue directly (E7's original method).
      const pm = (await req('param.modulated')) as
        { params: { id: string; value: number; modulatedValue: number }[] };
      for (const p of pm.params) {
        const d = Math.abs(p.modulatedValue - p.value);
        if (d > 1e-3) divergence.push(`param/${p.id}:${d.toFixed(3)}`);
      }
      await wait(140);
    }
  }
  note(`  ${label} modulator device="${modPage.deviceName}" pages=${JSON.stringify(modPage.pageNames)}`);
  const clips: Record<number, unknown> = {};
  for (const slot of [0, 1, 2]) {
    await req('slot.select', { trackIndex, slotIndex: slot, mechanism: 'slot' });
    await req('cursor.pointToClipOf', { cursor: '0', from: 'follower' });
    await wait(250);
    clips[slot] = ((await req('cursor.getNotes', { cursor: '0' })) as { notes: unknown[] }).notes;
  }
  note(`${label}: devices=[${names.join(', ')}] directParams=${dl.count} `
    + `pages=${JSON.stringify(rl.pageNames)} liveMod=${divergence.length > 0 ? divergence.slice(0, 3).join(',') : 'none'}`);
  return {
    names, directCount: dl.count, sample, pageNames: rl.pageNames, deviceName: rl.deviceName,
    modPages: modPage.pageNames, divergence, clips,
  };
};

const before = await snapshot(fixture.index, 'original');

// --------------------------------------------------- C2: duplicate it, timed
console.log('\n-- C2: duplicate the heavy fixture, transport ROLLING');
await req('transport.play');
await wait(500);
const playing = (await req('transport.status')) as { isPlaying: boolean };
note(`transport isPlaying=${playing.isPlaying}`);

const beforeList = await list();
const beforeIds = new Set(beforeList.tracks.map((t) => t.channelId));
const srcIndex = (await resolveId(fixtureId)).index!;
const t0 = Date.now();
await req('branch.duplicateTrack', {
  trackIndex: srcIndex, route: 'hostDuplicate', undoName: 'ghostnote E16 branch',
});
const appeared = await pollUntil(async () => (await list()).count === beforeList.count + 1, 30000, 50);
const msVisible = Date.now() - t0;
check('C2: the heavy track duplicates at all', appeared.ok, { ms: msVisible });
if (!appeared.ok) {
  console.log('\n⚠ the heavy duplicate never appeared — stopping before the comparison.');
  await req('transport.stop');
  process.exit(1);
}
const copy = (await list()).tracks.find((t) => !beforeIds.has(t.channelId))!;
note(`copy: [${copy.index}] "${copy.name}" pos=${copy.position} ${copy.channelId}`);

// Visible ≠ usable. The number that matters for an agent round-trip is when the
// copy's devices can actually be read back.
const t1 = Date.now();
await req('cursor.pointTrack', { cursor: '0', trackIndex: copy.index });
const usable = await pollUntil(async () => (await devices()).count >= chain.count, 30000, 100);
const msUsable = msVisible + (Date.now() - t1);
check('C2: the copy becomes READABLE (devices enumerate)', usable.ok, { msTotal: msUsable });
note(`C2 latency: visible in ${msVisible}ms, device chain readable at ~${msUsable}ms`);
check('C2 KILL CRITERION 3 — under the 5s agent-chat budget', msUsable < 5000, { msUsable });

// ----------------------------------------------------- B: does state survive?
console.log('\n-- rows B1/B2/B3/B4: what came across');
const after = await snapshot((await resolveId(copy.channelId)).index!, 'copy');

check('B1: the device chain is identical, in order',
  JSON.stringify(after.names) === JSON.stringify(before.names),
  { original: before.names, copy: after.names });
check('B2: the opaque plugin exposes the same parameter COUNT',
  after.directCount === before.directCount,
  { original: before.directCount, copy: after.directCount });
check('B2: opaque plugin parameter VALUES match (the patch came across)',
  JSON.stringify(after.sample) === JSON.stringify(before.sample),
  { original: before.sample.slice(0, 4), copy: after.sample.slice(0, 4) });
check('B3: the CLAP\'s authored modulator page came across',
  JSON.stringify(after.pageNames) === JSON.stringify(before.pageNames),
  { original: before.pageNames, copy: after.pageNames });
check('B3: the native device\'s authored modulator pages came across',
  JSON.stringify(after.modPages) === JSON.stringify(before.modPages),
  { original: before.modPages, copy: after.modPages });
// ⚠ No "…|| the original showed none either" escape clause. If the ORIGINAL is
// not modulating, this row is INCONCLUSIVE and must say so — a green built out
// of two silences is the exact failure standing rule 1 exists to prevent.
if (before.divergence.length === 0) {
  check('B3: INCONCLUSIVE — the ORIGINAL showed no live modulation, so the copy proves nothing',
    false, { hint: 'is a clip playing? does the LFO actually target a parameter?' });
} else {
  check('B3: modulation is LIVE on the copy (base still, modulatedValue sweeping)',
    after.divergence.length > 0,
    { originalLive: before.divergence.slice(0, 3), copyLive: after.divergence.slice(0, 3) });
}
for (const slot of [0, 1, 2]) {
  check(`B4: clip in scene ${slot} carried its notes`,
    JSON.stringify(after.clips[slot]) === JSON.stringify(before.clips[slot]),
    { original: before.clips[slot], copy: after.clips[slot] });
}
const copyMixer = await mixer((await resolveId(copy.channelId)).index!);
check('B5: mixer state carried on the heavy track',
  Math.abs(copyMixer.volume - fixtureMixer.volume) < 0.005 && copyMixer.color === fixtureMixer.color,
  { volume: copyMixer.volume, color: copyMixer.color });

// --------------------------------------------------------------- E5: audible?
console.log('\n-- E5: is the copy audible the moment it exists?');
const vu = (await req('branch.vu', { reset: false })) as
  { tracks: { name: string; channelId: string; now: number; hold: number; mute: boolean }[] };
const copyVu = vu.tracks.find((t) => t.channelId === copy.channelId);
note(`copy VU: now=${copyVu?.now} hold=${copyVu?.hold} mute=${copyVu?.mute}`);
check('E5: the copy arrives UNMUTED — nothing pre-mutes a branch for us',
  copyVu?.mute === false, { mute: copyVu?.mute });

// ------------------------------------------------------------------- cleanup
console.log('\n-- cleanup: the copy goes, the fixture stays');
await req('transport.stop');
const copyAt = await resolveId(copy.channelId);
if (copyAt.found) {
  const n = (await list()).count;
  await req('track.delete', { trackIndex: copyAt.index });
  const removed = await pollUntil(async () => (await list()).count === n - 1, 8000, 100);
  check('the duplicate was deleted', removed.ok);
}
check('the fixture track survived for reuse', (await resolveId(fixtureId)).found === true);
console.log(`>>> ${FIXTURE} LEFT IN PLACE deliberately (§9: reusable for Phases 4/5). <<<`);

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
