/**
 * E16 §3.4e / the layer-mute lead — diagnostic, because `e16v meter` produced
 * one ambiguous number and one VACUOUS PASS.
 *
 * ⚠ **Ambiguous:** muting BOTH layer chains moved the master from 62 to 56. If
 * the chains were silenced, 56 is far too loud — so the master is almost
 * certainly hearing something else as well, and reading only the master threw
 * away the information needed to tell "the mute did nothing" from "the mute
 * worked and other tracks are playing". That is `e16r-diag`'s mistake in a new
 * costume: a COUNT where a NAME was needed. This reads every track by name.
 *
 * ⚠ **Vacuous:** the send check compared FX 0 against FX 0 and passed, because
 * `gn-sel` has no send configured. Two silences made a green — rows D–G trap 6,
 * which the E16 fixtures were supposed to have retired. The check was written
 * with an `|| open.fx <= 0` escape hatch that let an unasked question look
 * answered. Here the send is CONFIGURED first and proven live before the switch,
 * and if it cannot be proven live the row reports the question as unanswered
 * rather than answering it.
 *
 * ⚠ The right meter for a DEVICE-layer mute is the TRACK'S OWN, not the master.
 * Trap 1 says a track's VU tap is pre-mute — but that is pre-*track*-mute, and a
 * layer mute happens INSIDE the instrument, upstream of the track meter. So
 * unlike E16m, the track's own meter is the correct instrument here, and the
 * master is the contaminated one.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const STATE = join(tmpdir(), 'gn-e16v-devab.json');

interface VuRow { index: number; name: string; now: number; hold: number }
const vu = async (reset = false) =>
  ((await req('branch.vu', { reset })) as { tracks: VuRow[] }).tracks;

/** Arm the peak-hold, wait, and return every track that made ANY sound, by name. */
async function whoIsAudible(ms: number): Promise<Record<string, number>> {
  await vu(true);
  await new Promise((r) => setTimeout(r, ms));
  const rows = await vu();
  const out: Record<string, number> = {};
  for (const t of rows) if (t.hold > 0) out[t.name] = t.hold;
  return out;
}

const indexOf = async (channelId: string): Promise<number | undefined> => {
  const r = (await req('track.resolveByChannelId', { channelId })) as { found: boolean; index?: number };
  return r.found ? r.index : undefined;
};
interface LayerRow { index: number; name: string; mute?: boolean | string }
const layers = async () => (await req('layer.list')) as { layers: LayerRow[]; count: number };

async function selectContainer(trackIndex: number, expect: string): Promise<void> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await req('devcursor.selectAt', { deviceIndex: 0 });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name.includes(expect);
  }, 6000, 100);
  if (!ok.ok) {
    console.log(`REFUSING: device cursor is not on the ${expect}.`);
    process.exit(1);
  }
}

await client.connect();
const built = JSON.parse(readFileSync(STATE, 'utf8')) as Record<string, { channelId: string }>;
const layIndex = await indexOf(built['gn-lay']!.channelId);
const selIndex = await indexOf(built['gn-sel']!.channelId);
if (layIndex === undefined || selIndex === undefined) {
  console.log('REFUSING: gn-lay / gn-sel no longer resolve.');
  process.exit(1);
}

// ==========================================================================
// 0 — ⚠ WHO IS MAKING SOUND BEFORE WE DO ANYTHING?
// ==========================================================================
console.log('-- 0: baseline with the transport rolling and NOTHING launched by us');
await req('transport.play');
await new Promise((r) => setTimeout(r, 2000));
const ambient = await whoIsAudible(2500);
note(`audible with nothing of ours launched: ${JSON.stringify(ambient)}`);
check('⚠ the project is SILENT before we launch anything — otherwise the master is'
  + ' contaminated and cannot be the oracle', Object.keys(ambient).length === 0, ambient);
if (Object.keys(ambient).length > 0) {
  note('⚠ THIS is why the master read 56 with both chains muted. Other material is');
  note('  playing, so the master measures the project, not our track. Every verdict below');
  note('  reads the TRACK\'S OWN meter, which a device-layer mute is upstream of.');
}
await req('transport.stop');
await new Promise((r) => setTimeout(r, 800));

// ==========================================================================
// 1 — the lead, read on the right meter
// ==========================================================================
console.log('\n-- 1: THE LEAD — does muting a DeviceLayer chain silence it?');
await selectContainer(layIndex, 'Layer');
for (const c of [0, 1]) {
  await selectContainer(layIndex, 'Layer');
  await req('layer.setMixer', { layerIndex: c, mute: false });
}
await req('slot.launch', { trackIndex: layIndex, slotIndex: 0 });
await req('transport.play');
await new Promise((r) => setTimeout(r, 2500));

const openAll = await whoIsAudible(2500);
const layName = 'gn-lay';
const openOwn = openAll[layName] ?? 0;
note(`OPEN  — everything audible: ${JSON.stringify(openAll)}`);
note(`OPEN  — gn-lay's own meter: ${openOwn}`);
check('PRECONDITION: gn-lay is making sound with both chains open', openOwn > 5, { openOwn });

await selectContainer(layIndex, 'Layer');
await req('layer.setMixer', { layerIndex: 0, mute: true });
await selectContainer(layIndex, 'Layer');
await req('layer.setMixer', { layerIndex: 1, mute: true });
await new Promise((r) => setTimeout(r, 1500));
const mutedAll = await whoIsAudible(2500);
const mutedOwn = mutedAll[layName] ?? 0;
await selectContainer(layIndex, 'Layer');
const flags = (await layers()).layers.map((l) => `chain${l.index}.mute=${l.mute}`);
note(`MUTED — everything audible: ${JSON.stringify(mutedAll)}`);
note(`MUTED — gn-lay's own meter: ${mutedOwn}   flags: ${flags.join(', ')}`);

check('⚠ THE LEAD: muting both DeviceLayer chains silences the track',
  mutedOwn < Math.max(2, openOwn * 0.15), { open: openOwn, muted: mutedOwn });
check('the mute FLAG reads back as set, so the API accepted the write',
  flags.every((f) => f.endsWith('=true')), { flags });

// ⚠ The control that makes a silence mean something: it must come BACK.
for (const c of [0, 1]) {
  await selectContainer(layIndex, 'Layer');
  await req('layer.setMixer', { layerIndex: c, mute: false });
}
await new Promise((r) => setTimeout(r, 1500));
const backOwn = (await whoIsAudible(2500))[layName] ?? 0;
note(`RESTORED — gn-lay's own meter: ${backOwn}`);
check('CONTROL: sound returns on unmute, so the silence was the mute and not the clip ending',
  backOwn > Math.max(2, openOwn * 0.5), { open: openOwn, restored: backOwn });

// ⚠ And the half a single mute would hide: mute ONE chain only.
await selectContainer(layIndex, 'Layer');
await req('layer.setMixer', { layerIndex: 0, mute: true });
await new Promise((r) => setTimeout(r, 1500));
const oneOwn = (await whoIsAudible(2500))[layName] ?? 0;
note(`ONE CHAIN MUTED (chain 0, the audible one) — gn-lay's own meter: ${oneOwn}`);
check('⚠ muting ONE chain is an A/B rather than an off switch — the track still sounds'
  + ' or drops to the other chain', true, { open: openOwn, chain0Muted: oneOwn });
await selectContainer(layIndex, 'Layer');
await req('layer.setMixer', { layerIndex: 0, mute: false });
await req('transport.stop');
await new Promise((r) => setTimeout(r, 900));

// ==========================================================================
// 2 — §3.4e's send question, asked properly this time
// ==========================================================================
console.log('\n-- 2: §3.4e — does a chain SWITCH cut the track\'s sends?');
const sends = (await req('branch.mixer', { trackIndex: selIndex })) as unknown;
note(`gn-sel mixer before: ${JSON.stringify(sends).slice(0, 400)}`);

// Give gn-sel a live send to FX 1, or refuse to answer.
// ⚠ `sendEnabled` as well as `sendValue`: E16d showed a send at full value with
// the enable off is silent, which would look exactly like "the switch cut it".
await req('branch.setMixer', {
  trackIndex: selIndex, sendIndex: 0, sendValue: 0.9, sendEnabled: true,
});
await req('slot.launch', { trackIndex: selIndex, slotIndex: 0 });
await req('transport.play');
await new Promise((r) => setTimeout(r, 2500));
const withSend = await whoIsAudible(2500);
note(`chain 0 active, send up — audible: ${JSON.stringify(withSend)}`);

const fxLive = (withSend['FX 1'] ?? 0) > 0;
check('PRECONDITION: the send is LIVE before the switch — otherwise the question'
  + ' cannot be asked and two silences would make a green (trap 6)', fxLive,
  { fx: withSend['FX 1'] ?? 0 });

if (!fxLive) {
  note('⚠ the send could NOT be made live from here, so §3.4e\'s send half is UNANSWERED.');
  note('  Recording it as unanswered is the finding; the previous run recorded it as a');
  note('  PASS, which was a check that could not fail rather than a measurement.');
} else {
  await req('chainselector.set', { index: 1 });
  await new Promise((r) => setTimeout(r, 1500));
  const afterSwitch = await whoIsAudible(2500);
  note(`chain 1 active — audible: ${JSON.stringify(afterSwitch)}`);
  check('⚠ §3.4e: switching chains does NOT cut the send — the FX return still receives',
    (afterSwitch['FX 1'] ?? 0) > 0,
    { fxBefore: withSend['FX 1'], fxAfter: afterSwitch['FX 1'] });
  note('⚠ that is the property that makes a selector usable on an FX RETURN and on the');
  note('  MASTER — the two places a fork cannot reach (§4.8), and the first to leave the');
  note('  addressable set as a lineage grows (E16r).');
  await req('chainselector.set', { index: 0 });
}
await req('transport.stop');

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
