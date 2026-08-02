/**
 * E17 row 6 — is a DeviceLayer's `solo()` CONTAINER-scoped or PROJECT-global?
 *
 * ⚠ **The question is SCOPE, not whether the flag sets.** `layer.setMixer`
 * already writes `solo` and E16w proved the `Channel` mixer works on a layer
 * chain (mute ●). Track solo is project-global, which would make it useless
 * here — soloing take B would silence the drums. If `DeviceLayer.solo()` is
 * scoped to its container, it is the mutually-exclusive selection gesture the
 * user asked for in session 5's closing exchange: one call, no selector, no
 * routing, and a single readable "which one is live" instead of N mute flags
 * (E16m's problem, and the thing §4.4 exists to replace).
 *
 * Evidence FOR container scoping: `DrumPadBank.hasSoloedPads()` and
 * `clearSoloedPads()` — solo state scoped to one device, so Bitwig does model it.
 * ⚠ Evidence AGAINST, and it is worth stating before the measurement rather than
 * after: `DeviceLayerBank` declares exactly ONE member (`getChannel`). Bitwig
 * gave drum pads a container-scoped solo vocabulary and gave device layers none.
 *
 * ⚠ **This is measured SILENTLY, and that is a deliberate upgrade on the
 * handoff's method.** The handoff specifies the master as oracle with an
 * unrelated track playing — necessary if ears are the instrument. But
 * `isMutedBySolo()` is marked at init and both `branch.mixer` and `branch.vu`
 * report it per track, which answers the scope question DIRECTLY: if soloing a
 * layer chain flips another track's `mutedBySolo`, the solo is project-global.
 * No noise, no ear trial, no listener-sensitivity caveat.
 *
 * ⚠ **And the control is not optional — it is rows D–G trap 6 and session 5
 * shipped that mistake once** (`fxOnChain0: 0` vs `fxOnChain1: 0` passing as a
 * green). "No other track flipped" is exactly what a solo that does nothing at
 * all looks like. So a TRACK solo is fired first, through the same oracle, and
 * it must flip other tracks — proving the check CAN fail before it is trusted.
 *
 * Silent: nothing is launched and the transport is never touched. Every mixer
 * value touched is recorded and restored.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
interface VuRow { name: string; channelId: string; mute: boolean; mutedBySolo: boolean }
const vu = async () => ((await req('branch.vu', { reset: false })) as { tracks: VuRow[] }).tracks;
interface LayerRow { index: number; name: string; solo?: boolean | string; mute?: boolean | string }
interface LayerList { layers: LayerRow[]; count: number; cursorDeviceName?: string }
const layers = async () => (await req('layer.list')) as LayerList;

/** Which OTHER tracks are currently silenced by somebody's solo — named, not counted. */
async function silencedBySolo(exclude: string): Promise<string[]> {
  return (await vu()).filter((t) => t.mutedBySolo && t.name !== exclude).map((t) => t.name);
}

async function selectContainer(trackIndex: number, expect = 'Instrument Layer'): Promise<void> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === trackIndex;
  }, 4000, 150);
  await req('devcursor.selectAt', { deviceIndex: 0 });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === expect;
  }, 6000, 150);
  if (!ok.ok) {
    console.log(`\nREFUSING: cursor is not on "${expect}" — ${JSON.stringify(await req('devcursor.status'))}`);
    process.exit(1);
  }
}

await client.connect();
const tracks = await list();
const lay = tracks.find((t) => t.name === 'gn-lay');
if (!lay) { console.log('REFUSING: run e17-setup first.'); process.exit(1); }

// ==========================================================================
console.log('\n-- baseline: nobody is soloed, nobody is muted-by-solo');
const base = await vu();
const preSoloed = base.filter((t) => t.mutedBySolo).map((t) => t.name);
note(`${base.length} tracks; muted-by-solo at baseline: ${preSoloed.length ? preSoloed.join(', ') : 'none'}`);
check('PRECONDITION: no solo is active, so any flip below is ours',
  preSoloed.length === 0, { preSoloed });
if (preSoloed.length > 0) {
  console.log('REFUSING: something is already soloed. Clear it — otherwise the control cannot');
  console.log('distinguish "our solo did nothing" from "everything was already silenced".');
  process.exit(1);
}

// ==========================================================================
console.log('\n======== THE CONTROL — can this oracle SEE a project-global solo at all?');
note('⚠ Not optional. "No other track flipped" is also what a solo that does nothing looks');
note('like — two silences making a green, which is rows D–G trap 6 and which session 5');
note('shipped once. A TRACK solo is known project-global, so it MUST flip other tracks.');
await req('branch.setMixer', { trackIndex: lay.index, solo: true });
const flipped = await pollUntil(async () => (await silencedBySolo('gn-lay')).length > 0, 4000, 200);
const silencedByTrackSolo = await silencedBySolo('gn-lay');
note(`after soloing the TRACK gn-lay, muted-by-solo: ${silencedByTrackSolo.join(', ') || 'none'}`
  + `  (${flipped.ms} ms)`);
const oracleWorks = flipped.ok && silencedByTrackSolo.length > 0;
check('⚠ CONTROL: `isMutedBySolo` DOES report a project-global solo — the check can fail',
  oracleWorks, { silenced: silencedByTrackSolo });
await req('branch.setMixer', { trackIndex: lay.index, solo: false });
await pollUntil(async () => (await silencedBySolo('gn-lay')).length === 0, 4000, 200);
const cleared = await silencedBySolo('gn-lay');
check('CONTROL restored: clearing the track solo un-silences everything',
  cleared.length === 0, { stillSilenced: cleared });

// ==========================================================================
console.log('\n======== THE ROW — solo ONE CHAIN of gn-lay\'s Instrument Layer');
await selectContainer(lay.index);
const l0 = await layers();
note(`chains: ${l0.layers.map((x) => `${x.index}:solo=${x.solo}`).join(' ')}`);
check('PRECONDITION: the container is selected and its chains report a solo flag at all',
  l0.count === 2 && l0.layers.every((x) => typeof x.solo === 'boolean'),
  { count: l0.count, solos: l0.layers.map((x) => x.solo), cursorDeviceName: l0.cursorDeviceName });

await req('layer.setMixer', { layerIndex: 0, solo: true });
await new Promise((r) => setTimeout(r, 1200));
await selectContainer(lay.index);
const l1 = await layers();
const silencedByLayerSolo = await silencedBySolo('gn-lay');
note(`chain flags now: ${l1.layers.map((x) => `${x.index}:solo=${x.solo}`).join(' ')}`);
note(`tracks muted-by-solo: ${silencedByLayerSolo.join(', ') || 'NONE'}`);

const flagSet = l1.layers[0]?.solo === true;
check('ROW 6a: the solo FLAG reads back as set, so the API accepted the write',
  flagSet, { solos: l1.layers.map((x) => x.solo) });
// ⚠ The scope question, and both outcomes are informative.
const isGlobal = silencedByLayerSolo.length > 0;
check('⚠ ROW 6b: a layer solo is CONTAINER-scoped — it does NOT silence the rest of the'
  + ' project (which a track solo demonstrably does, above)',
  flagSet && !isGlobal, { silencedByLayerSolo, flagSet });

// ⚠ And the half that a scope check alone would miss: does it silence the SIBLING
// CHAIN? A solo that is neither global nor locally exclusive is inert, and that
// reads identically to "container-scoped" if only other TRACKS are inspected.
const siblingMutedBySolo = l1.layers[1]?.mute;
note(`⚠ sibling chain 1: mute=${siblingMutedBySolo} solo=${l1.layers[1]?.solo}`);
note('   (a layer chain has no `isMutedBySolo`; `DeviceLayerBank` declares one member.');
note('    So whether the sibling is actually SILENCED is not readable here — the mute');
note('    flag is unchanged either way, exactly as E16m found one level up, where a');
note('    child\'s own flag says nothing about whether its lineage is audible.)');

await req('layer.setMixer', { layerIndex: 0, solo: false });
await new Promise((r) => setTimeout(r, 800));
await selectContainer(lay.index);
const l2 = await layers();
check('restored: the chain solo is off again',
  l2.layers.every((x) => x.solo === false), { solos: l2.layers.map((x) => x.solo) });

// ==========================================================================
console.log('\n======== `SoloValue.toggle(exclusive)` — the exclusivity primitive itself');
note('The whole reason row 6 could have mattered: `toggle(true)` is what would make');
note('"switching to B silences A and C" one call rather than N mute writes.');
await selectContainer(lay.index);
const tg = await req('layer.soloToggle', { layerIndex: 0, exclusive: true });
note(`layer.soloToggle -> ${JSON.stringify(tg)}`);
await new Promise((r) => setTimeout(r, 1200));
await selectContainer(lay.index);
const l3 = await layers();
const silencedByToggle = await silencedBySolo('gn-lay');
note(`chain flags: ${l3.layers.map((x) => `${x.index}:solo=${x.solo}`).join(' ')}`);
note(`tracks muted-by-solo: ${silencedByToggle.join(', ') || 'NONE'}`);
const toggleWorks = l3.layers[0]?.solo === true;
check('`SoloValue.toggle(exclusive=true)` flips the chain\'s solo flag',
  toggleWorks, { solos: l3.layers.map((x) => x.solo) });
check('⚠ and toggle is not project-global either',
  !(silencedByToggle.length > 0), { silencedByToggle });

// ==========================================================================
console.log('\n-- restore every flag this probe touched');
await selectContainer(lay.index);
for (const x of (await layers()).layers) {
  if (x.solo === true) await req('layer.setMixer', { layerIndex: x.index, solo: false });
}
await req('branch.setMixer', { trackIndex: lay.index, solo: false });
await new Promise((r) => setTimeout(r, 600));
await selectContainer(lay.index);
const final = await layers();
const finalSilenced = (await vu()).filter((t) => t.mutedBySolo).map((t) => t.name);
check('CLEANUP: no chain solo and no track solo is left set',
  final.layers.every((x) => x.solo === false) && finalSilenced.length === 0,
  { chainSolos: final.layers.map((x) => x.solo), silenced: finalSilenced });

// ==========================================================================
console.log('\n======== VERDICT');
console.log(`  CONTROL  the oracle detects a project-global solo   ${oracleWorks ? '●' : '○'}`);
console.log(`  ROW 6a   the layer solo FLAG sets                   ${flagSet ? '●' : '○'}`);
console.log(`  ROW 6b   it is NOT project-global                   ${!isGlobal ? '●' : '○ ⚠ GLOBAL'}`);
console.log(`  toggle   SoloValue.toggle(exclusive) sets the flag  ${toggleWorks ? '●' : '○'}`);
if (!oracleWorks) {
  note('⚠ INCONCLUSIVE: the control failed, so a quiet result here means nothing.');
} else if (isGlobal) {
  note('⇒ ⚠ A layer solo is PROJECT-GLOBAL, which makes it useless for take selection:');
  note('  soloing take B would silence the drums. The A/B gesture stays mute-based.');
} else if (flagSet) {
  note('⇒ A layer solo SETS and is NOT project-global. ⚠ But "not global" is not the same');
  note('  as "usefully exclusive" — a layer chain exposes no `isMutedBySolo`, so whether');
  note('  the SIBLING chain is actually silenced cannot be read programmatically. That');
  note('  half needs ears, and it is the only part of this row that does.');
} else {
  note('⇒ The solo flag does not even set on a layer chain, so there is nothing to scope.');
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read them individually`);
process.exit(0);
