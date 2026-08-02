/**
 * E17 — is the chain a HUMAN selects the same object our `selectInEditor()` sets?
 *
 * ⚠ **The one question left standing.** `e17l`: a human clicks a chain and OUR
 * named actions then work on it (Copy+Paste 4→5, Delete 4→3 by channelId).
 * `e17u`: our `DeviceChain.selectInEditor()` moves a highlight the human can SEE.
 * `e17v`/`e17x`: named actions ignore that highlight completely — the device
 * panel's current DEVICE decides in all four cells.
 *
 * ⇒ So a human's click and our call both produce something the human describes as
 * a selected chain, and only one of them is actionable. **Either they are two
 * different states, or they are one state and the actions read a third thing.**
 * Nothing measured so far can tell those apart, because until this restart there
 * was no reader for "does Bitwig consider this chain selected".
 *
 * ⚠ **Now there are TWO readers, and they can disagree — which is the point.**
 *   1. `layer.selectionState` → `DeviceChain.addIsSelectedInEditorObserver`,
 *      documented current, finally attached (it died at init to being marked
 *      beside its @Deprecated sibling in one try block; they are now split).
 *   2. `app.selectionNotifications` → Bitwig's OWN device-layer selection
 *      notification, read by the operator's eyes.
 * One instrument agreeing with itself is not evidence (rule 10).
 *
 * **How to read the outcome:**
 *   HUMAN sets the flag, WE do not  ⇒ our call writes a lookalike state. The hunt
 *       narrows to what the click writes, and rows 3/4 are reopenable.
 *   BOTH set it                     ⇒ the selection genuinely IS the same object,
 *       and the actions read a THIRD thing. That moves the whole investigation off
 *       selection and onto dispatch — a different and more interesting problem.
 *   NEITHER sets it                 ⇒ the observer reports something other than
 *       what the DAW means by a layer selection; fall back to the notification.
 *
 * ⚠ Also settled here, cheaply: `DeviceChain.select()` — the fourth setter,
 * @Deprecated, never once called. Expected to throw. Recorded either way, because
 * `e17o` is what happens when a mechanism is scored without being exercised.
 *
 * ⚠ NO NAMED ACTIONS ARE FIRED unless an arm actually shows a difference, and then
 * only behind an explicit gate. Nothing is created or deleted otherwise.
 * ⚠ Run IN YOUR OWN TERMINAL — needs a TTY and your hands in Bitwig.
 */
import { client, check, note, failureCount, pollUntil, ask } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const SUBJECT = 'gn-lay4';

interface TrackRow { index: number; name: string; type: string; channelId: string }
interface LayerList { layers: { index: number; name: string; devices: { name: string }[] }[]; count: number }
interface SelRow { index: number; selectedInEditor: boolean; selected: boolean }
interface SelState {
  editorObserver: string; legacyObserver: string; layers: SelRow[];
  cursorDeviceName?: string; cursorLayerExists?: boolean | string; cursorLayerName?: string;
}

await client.connect();
const tracks = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
const subject = tracks.find((t) => t.name === SUBJECT);
if (!subject) { console.log(`REFUSING: ${SUBJECT} not found.`); process.exit(1); }

async function scope(): Promise<void> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex: subject!.index });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === subject!.index;
  }, 4000, 150);
  await req('devcursor.selectAt', { deviceIndex: 0 });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === 'Instrument Layer';
  }, 6000, 150);
  if (!ok.ok) { console.log('REFUSING: cursor not on the container (the e16o trap).'); process.exit(1); }
}

/** ⚠ The cheap read. Does NOT walk the device banks, so it cannot perturb what it measures. */
async function selState(): Promise<SelState> {
  return (await req('layer.selectionState')) as SelState;
}
const flagsOf = (s: SelState, names: string[]) =>
  s.layers.slice(0, names.length)
    .map((r) => `${names[r.index] ?? r.index}:${r.selectedInEditor ? 'EDITOR' : '·'}${r.selected ? '/sel' : ''}`)
    .join('  ');

// ==========================================================================
console.log('');
console.log('='.repeat(72));
console.log(` ⚠ Have ${SUBJECT} open with its Instrument Layer showing all four chains.`);
console.log(' Nothing is created or deleted. No named action fires unless an arm below');
console.log(' actually shows a difference, and then only after you say so.');
console.log('='.repeat(72));

await scope();
const chains = (await req('layer.list')) as LayerList;
const NAMES = chains.layers.map((x) => x.devices[0]?.name ?? `chain${x.index}`);
note(`${SUBJECT}: ${chains.count} chains — ${NAMES.map((n, i) => `${i}=${n}`).join('  ')}`);
check('PRECONDITION: four distinguishable chains', chains.count === 4, { names: NAMES });

const boot = await selState();
note(`editor observer: ${boot.editorObserver}`);
note(`legacy observer: ${boot.legacyObserver}`);
const readerLive = String(boot.editorObserver).startsWith('observing:');
check('⚠⚠ THE INSTRUMENT: `addIsSelectedInEditorObserver` is attached this time',
  readerLive, { editor: boot.editorObserver, legacy: boot.legacyObserver });
if (!readerLive) {
  console.log('\nREFUSING: the reader did not attach, so the whole probe has no instrument.');
  console.log(`  status: ${boot.editorObserver}`);
  console.log('  ⚠ Did the extension actually reload? Rebuild + redeploy, then re-run.');
  process.exit(1);
}
note('⚠ NOTE the legacy observer is EXPECTED to read FAILED — it is @Deprecated.');
note('  It is reported so its failure is recorded rather than inferred.');

// Turn Bitwig's own notification on — the second, independent oracle.
const notif = await req('app.selectionNotifications', { deviceLayer: true, device: true, track: true });
note(`notifications: ${JSON.stringify(notif)}`);

const log: { arm: string; flags: string; cursor: string; eyes: string }[] = [];
const record = async (arm: string, eyes: string) => {
  await scope();
  const s = await selState();
  const flags = flagsOf(s, NAMES);
  const cursor = `${s.cursorLayerExists === true ? s.cursorLayerName : '(none)'}`;
  console.log(`      observer: ${flags}`);
  console.log(`      cursor:   ${cursor}`);
  log.push({ arm, flags, cursor, eyes });
};

// ==========================================================================
console.log(`\n${'─'.repeat(72)}`);
console.log('  BASELINE — before anything');
await record('BASELINE', '(not asked)');

// ==========================================================================
// ⚠ THE HUMAN ARM FIRST. Their click is the state proven actionable (e17l), so it
// is the reference the machine arm is compared against, not the other way round.
console.log(`\n${'─'.repeat(72)}`);
console.log('  ARM H — YOUR CLICK. This is the state e17l proved actionable.');
const wantH = NAMES[2] ?? NAMES[0];
const eyesH = await ask(
  `  Click the ${wantH} chain's LANE HEADER in the Instrument Layer — the chain\n`
  + '     itself, not the device inside it. Then tell me what Bitwig showed you:\n'
  + '     did a notification pop up? What did it say? And what looks selected now?');
await record(`ARM H: human clicked ${wantH}`, eyesH);

// ==========================================================================
console.log(`\n${'─'.repeat(72)}`);
console.log('  ARM C — OUR CALL, aimed at a DIFFERENT chain');
await scope();
const s0 = await selState();
const lit = s0.cursorLayerExists === true ? String(s0.cursorLayerName) : '';
// ⚠ Aim somewhere OTHER than whatever is lit — the error that cost this session
// four probes. Never a fixed index.
const idxC = NAMES.findIndex((n) => n !== lit);
const wantC = NAMES[idxC]!;
console.log(`      calling layer.select(${idxC}, editor) → ${wantC}   (currently ${lit || '?'})`);
await req('layer.select', { layerIndex: idxC, where: 'editor' });
await new Promise((r) => setTimeout(r, 900));
const eyesC = await ask(
  `  I called \`selectInEditor()\` on the ${wantC} chain. Same questions:\n`
  + '     did a notification pop up? What did it say? And what looks selected now?');
await record(`ARM C: our selectInEditor → ${wantC}`, eyesC);

// ==========================================================================
console.log(`\n${'─'.repeat(72)}`);
console.log('  ARM L — the FOURTH setter: `DeviceChain.select()`, @Deprecated, never tried');
await scope();
const sL = await selState();
const litL = sL.cursorLayerExists === true ? String(sL.cursorLayerName) : '';
const idxL = NAMES.findIndex((n) => n !== litL);
const wantL = NAMES[idxL]!;
const legacy = await req('layer.selectLegacy', { layerIndex: idxL }) as { legacySelect?: string };
console.log(`      layer.selectLegacy(${idxL}) → ${wantL}:  ${legacy.legacySelect}`);
await new Promise((r) => setTimeout(r, 800));
const eyesL = await ask(
  `  I called the deprecated \`select()\` aimed at ${wantL}. Did anything change on\n`
  + '     screen — a notification, a different chain highlighted, anything at all?');
await record(`ARM L: legacy select() → ${wantL}`, eyesL);
check('⚠ `DeviceChain.select()` is @Deprecated and throws — recorded, not assumed',
  String(legacy.legacySelect ?? '').startsWith('THREW'),
  { result: legacy.legacySelect });

// ==========================================================================
console.log(`\n${'='.repeat(72)}`);
console.log(' OBSERVER  vs  CURSOR  vs  YOUR EYES');
for (const r of log) {
  console.log(`   ${r.arm}`);
  console.log(`      observer: ${r.flags}`);
  console.log(`      cursor:   ${r.cursor}`);
  console.log(`      eyes:     ${JSON.stringify(r.eyes)}`);
}
console.log('='.repeat(72));

const humanRow = log.find((r) => r.arm.startsWith('ARM H'))!;
const callRow = log.find((r) => r.arm.startsWith('ARM C'))!;
const baseRow = log.find((r) => r.arm === 'BASELINE')!;
const humanSetFlag = humanRow.flags.includes('EDITOR') && humanRow.flags !== baseRow.flags;
const callSetFlag = callRow.flags.includes('EDITOR') && callRow.flags !== humanRow.flags;

console.log('');
if (humanSetFlag && !callSetFlag) {
  note('⇒ ⚠⚠ THE CLICK SETS THE FLAG AND OUR CALL DOES NOT. They are DIFFERENT states.');
  note('  Our `selectInEditor()` writes a lookalike the actions never read, and the');
  note('  actionable selection has an owner we have not found. Rows 3/4 REOPEN, and the');
  note('  next question is narrow: what does the click write that we can also write?');
} else if (humanSetFlag && callSetFlag) {
  note('⇒ ⚠⚠ BOTH set the same flag — so the selection really is ONE object, and the');
  note('  named actions read a THIRD thing entirely. That retires the whole "we cannot');
  note('  select a chain" framing: we can, identically to the human. The investigation');
  note('  moves off selection and onto how the device panel picks its target.');
} else if (!humanSetFlag && !callSetFlag) {
  note('⇒ ⚠ Neither moved the flag, including the human click that e17l PROVED');
  note('  actionable. So `addIsSelectedInEditorObserver` reports something other than');
  note('  what Bitwig means by a selected layer — the reader is not the instrument it');
  note('  looked like. ⚠ Fall back to what your eyes and the notification reported.');
} else {
  note('⇒ ⚠ Our call moved the flag and the human click did not, which fits no reading');
  note('  yet proposed. Do not record a verdict; this needs its own sitting.');
}
note('');
note('⚠ Compare the EYES column yourself before trusting any of the above. If Bitwig');
note('  announced a device-layer selection for one arm and not the other, that is the');
note('  answer regardless of what the observer flags say — two instruments, and the');
note('  one that can contradict the other is the one worth having.');

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
