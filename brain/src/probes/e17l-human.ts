/**
 * E17 rows 3+4 — the discriminator only a human can supply.
 *
 * ⚠ **User report, 2026-08-01:** *"Selecting a layer, copying it, and pasting
 * directly at the same selection results in inserting a duplicate of that layer,
 * for me."* So the capability EXISTS. `e17k` drove that gesture from our side —
 * `layer.select` (both `selectInEditor` and `selectInMixer`) followed by
 * `Duplicate`, and by `Copy`+`Paste` — and got 4 → 4 on every route, with the
 * device-panel dispatch control ● in the same run.
 *
 * ⚠ **That ○ is UNINTERPRETABLE on its own, and must not be written up.** Two
 * completely different worlds produce it:
 *
 *   W1  `layer.select` does not reach Bitwig's UI selection the way
 *       `device.selectInEditor` does. Then the gesture is reachable in principle
 *       and we are missing a selection setter — which is exactly the shape row 1
 *       turned out to have, where the row was not ○ but UNREACHABLE.
 *   W2  the named actions do not act on a layer even when it IS selected, and the
 *       UI gesture is something `getActions()` does not expose. A real dead end.
 *
 * **There is no readback for the UI selection** — `DeviceChain.addIsSelectedInEditorObserver`
 * exists but was never allocated at init, and rule 13 means it cannot be added
 * without another Bitwig restart. So the only way to separate W1 from W2 is to
 * let a HUMAN set the selection and then fire the actions from here. That isolates
 * exactly one variable: who selected the layer.
 *
 * ARM A  human selects the layer AND does Copy+Paste by hand.
 *        Establishes what success looks like in `layer.list`, and confirms the
 *        report with our own instrument rather than on trust.
 * ARM B  ⚠ **the money arm.** Human selects the layer and stops. WE fire `Copy`
 *        and `Paste`. Growth ⇒ W1: the actions are fine, `layer.select` is the
 *        broken link. No growth ⇒ W2: the actions cannot drive this gesture.
 * ARM C  gated on B. Human selects, we fire `Delete`. If that removes a chain,
 *        row 4 reopens and the whole verdict is back in play.
 *
 * ⚠ Run this IN YOUR OWN TERMINAL — it needs a TTY, and `lib.ts` refuses rather
 * than reading an empty pipe as a confident answer (E16 rows E1/E5's lesson).
 * Bitwig will be in the foreground the whole time, because you are using it.
 *
 * Silent: nothing is launched and the transport is never touched.
 */
import { client, check, note, failureCount, pollUntil, ask, waitForEnter } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const SUBJECT = 'gn-lay4';

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => ((await req('track.list')) as { tracks: TrackRow[]; count: number });
interface LayerRow { index: number; name: string; channelId?: string | boolean; devices: { name: string }[] }
interface LayerList { layers: LayerRow[]; count: number }
const shapeOf = (l: LayerList) =>
  l.layers.map((x) => `${x.index}:[${x.devices.map((d) => d.name).join('+') || '—'}]`).join(' ');
const idsOf = (l: LayerList) => l.layers.map((x) => String(x.channelId).slice(0, 8));

await client.connect();
const tracks = (await list()).tracks;
const subject = tracks.find((t) => t.name === SUBJECT);
if (!subject) { console.log(`REFUSING: ${SUBJECT} not found — run e17-setup.`); process.exit(1); }

async function chains(): Promise<LayerList> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex: subject!.index });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === subject!.index;
  }, 4000, 150);
  await req('devcursor.selectAt', { deviceIndex: 0 });
  await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === 'Instrument Layer';
  }, 6000, 150);
  return (await req('layer.list')) as LayerList;
}

const start = await chains();
console.log('');
console.log('='.repeat(74));
console.log(` ${SUBJECT} — the Instrument Layer on it currently holds ${start.count} chains:`);
console.log(`   ${shapeOf(start)}`);
console.log(`   chain ids: ${idsOf(start).join(' ')}`);
console.log('='.repeat(74));
check(`PRECONDITION: ${SUBJECT} has a multi-chain Instrument Layer to work on`,
  start.count >= 2, { count: start.count });

// ==========================================================================
console.log('\n======== ARM A — you do the WHOLE gesture, so we can see what success looks like');
console.log('  In Bitwig, on the track "gn-lay4", open the Instrument Layer and');
console.log('  SELECT ONE OF ITS LAYERS (the chain itself, not the device inside it).');
console.log('  Then Copy and Paste it, exactly as you described.');
await waitForEnter('  Do that now');
const afterA = await chains();
console.log(`   now ${afterA.count} chains: ${shapeOf(afterA)}`);
console.log(`   chain ids: ${idsOf(afterA).join(' ')}`);
const armA = afterA.count > start.count;
check('⚠ ARM A: the human gesture DOES create a chain, measured by us rather than reported',
  armA, { before: start.count, after: afterA.count });
if (!armA) {
  console.log('\n  ⚠ We did not see a new chain. Before going further — did the paste actually');
  console.log('  land? If it did and layer.list still says the old count, that is a READBACK');
  console.log('  finding (our instrument is blind to chains created this way) and is more');
  console.log('  important than the rest of this probe.');
  const saw = await ask('  Did you SEE a duplicate layer appear in Bitwig? [y/N]');
  if (saw.toLowerCase().startsWith('y')) {
    console.log('  ⚠⚠ RECORD THIS: the chain exists in the UI and `layer.list` cannot see it.');
    console.log('  Every E17 row that counted chains through that bank is then suspect.');
    process.exit(1);
  }
}

// ⚠ Try to put it back. Row 4 says WE cannot delete a chain — so if `app.undo`
// removes it, undo reaches something the typed API cannot, which is itself worth
// knowing and is the only cleanup available.
if (armA) {
  console.log('\n  -- attempting to undo it (row 4 says we cannot delete a chain any other way)');
  await req('app.undo');
  await new Promise((r) => setTimeout(r, 1500));
  const undone = await chains();
  console.log(`   after app.undo: ${undone.count} chains — ${shapeOf(undone)}`);
  check('⚠ INCIDENTAL: `app.undo` removes a chain that no typed delete could touch',
    undone.count === start.count, { before: afterA.count, after: undone.count });
}

// ==========================================================================
console.log('\n======== ARM B — ⚠ THE DISCRIMINATOR. You select; WE fire the actions.');
console.log('  Select the SAME layer again — just select it, click nothing else.');
console.log('  Do NOT copy and do NOT paste. Leave Bitwig in the foreground.');
await waitForEnter('  Select the layer and stop there');
const beforeB = await chains();
// ⚠ Reading layer.list re-points our own device cursor, which could disturb the
// human's selection. Ask them to confirm it survived rather than assuming.
const stillSelected = await ask('  ⚠ Is that layer STILL selected in Bitwig? (our readback may have'
  + ' moved the selection) [y/N]');
if (!stillSelected.toLowerCase().startsWith('y')) {
  console.log('  ⚠ RECORD THIS: our own `layer.list` read stole the selection. That is a');
  console.log('  finding about the instrument — any probe that reads before firing an action');
  console.log('  destroys the precondition it is testing. Re-select and press Enter.');
  await waitForEnter('  Re-select the layer');
}
console.log(`   before: ${beforeB.count} chains — ${shapeOf(beforeB)}`);
console.log('   firing Copy, then Paste, from here...');
await req('app.invokeAction', { id: 'Copy' });
await new Promise((r) => setTimeout(r, 1200));
await req('app.invokeAction', { id: 'Paste' });
await new Promise((r) => setTimeout(r, 1800));
const afterB = await chains();
console.log(`   after:  ${afterB.count} chains — ${shapeOf(afterB)}`);
console.log(`   chain ids: ${idsOf(afterB).join(' ')}`);
const armB = afterB.count > beforeB.count;
check('⚠ ARM B: our `Copy`+`Paste` act on a HUMAN-SET layer selection',
  armB, { before: beforeB.count, after: afterB.count });

if (armB) {
  await req('app.undo');
  await new Promise((r) => setTimeout(r, 1500));
  note(`undone: ${(await chains()).count} chains`);
}

// ==========================================================================
console.log('\n======== ARM C — gated on B: does `Delete` remove one? (row 4 reopens if so)');
let armC = false;
if (!armB) {
  console.log('  SKIPPED. Arm B did not work, so a `Delete` here would fire against an');
  console.log('  unknown selection — and unlike a stray Duplicate, that destroys something');
  console.log('  real. E6 blocker 3 with the safety catch on.');
} else {
  const tracksBefore = await list();
  console.log('  Select the layer once more, then stop.');
  await waitForEnter('  Select the layer');
  const beforeC = await chains();
  const victim = String(beforeC.layers[1]?.channelId).slice(0, 8);
  console.log(`   before: ${beforeC.count} chains — ${shapeOf(beforeC)}`);
  console.log('   firing Delete from here...');
  await req('app.invokeAction', { id: 'Delete' });
  await new Promise((r) => setTimeout(r, 1800));
  const afterC = await chains();
  const tracksAfter = await list();
  console.log(`   after:  ${afterC.count} chains — ${shapeOf(afterC)}`);
  armC = afterC.count < beforeC.count;
  check('⚠⚠ ARM C: `Delete` on a selected layer REMOVES a chain — row 4 reopens',
    armC, { before: beforeC.count, after: afterC.count, victim });
  check('and no TRACK was destroyed', tracksAfter.count === tracksBefore.count,
    { before: tracksBefore.count, after: tracksAfter.count });
  if (armC) {
    await req('app.undo');
    await new Promise((r) => setTimeout(r, 1500));
    note(`undone: ${(await chains()).count} chains`);
  }
}

// ==========================================================================
console.log('\n' + '='.repeat(74));
console.log(' VERDICT');
console.log(`   ARM A  the human gesture creates a chain        ${armA ? '●' : '○'}`);
console.log(`   ARM B  OUR actions on a HUMAN-set selection     ${armB ? '●' : '○'}`);
console.log(`   ARM C  Delete on a human-set selection          ${armB ? (armC ? '●' : '○') : 'SKIPPED'}`);
console.log('');
if (armA && armB) {
  console.log(' ⇒ ⚠⚠ WORLD 1. The named actions DO reach a selected layer — so `layer.select`');
  console.log('   is the broken link, not the actions. Row 3 is UNREACHABLE, not closed,');
  console.log('   exactly as row 1 turned out to be. The next step is a selection setter that');
  console.log('   works: `DeviceChain.addIsSelectedInEditorObserver` would give the readback');
  console.log('   this probe had to ask a human for, and it needs one restart (rule 13).');
  if (armC) {
    console.log('   ⚠ AND ARM C MEANS ROW 4 REOPENS TOO — E17-VERDICT.md must be re-argued');
    console.log('     from scratch: the layer model would have a complete branch lifecycle.');
  }
} else if (armA && !armB) {
  console.log(' ⇒ WORLD 2. The gesture exists and `getActions()` does not expose it: our fire');
  console.log('   did nothing even against a selection YOU set, so the selection was never');
  console.log('   the problem. `Copy`/`Paste` as named actions are not the UI gesture.');
  console.log('   ⚠ That closes row 3 for us properly — a REACHABILITY ○ with the selection');
  console.log('   variable controlled, which is what the previous run could not claim.');
} else {
  console.log(' ⇒ Arm A did not reproduce, so nothing below it can be read. Check the');
  console.log('   instructions matched what you actually do in Bitwig before recording.');
}
console.log('='.repeat(74));
console.log(failureCount() === 0 ? 'ALL PASS' : `${failureCount()} checks reported a negative — read them individually`);
process.exit(0);
