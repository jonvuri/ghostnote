/**
 * E17 — WHAT DOES THE UI ACTUALLY SELECT? Human eyes as the readback.
 *
 * ⚠ **Why this is the right instrument.** Bitwig's UI selection is the argument
 * every named action consumes, and it is the one object in this whole
 * investigation we cannot read: `DeviceChain.addIsSelectedInEditorObserver` is
 * documented current but was lost at init to being marked beside a deprecated
 * sibling (rules 9/13). Every claim about what our setters "select" has therefore
 * been an inference from what an ACTION did afterwards — and `e17q` showed how
 * badly that can mislead: it recorded our layer setters as "hitting the
 * container", when an equally good explanation is that they did nothing and the
 * device panel simply acted on the track's current device.
 *
 * ⇒ ⚠ **A human looking at the screen is a better instrument than an action with
 * a confounded outcome.** This probe fires NO actions and changes NO structure.
 * It only sets a selection and asks what moved.
 *
 * ⚠ **What is actually proven today, which is narrower than "cursors drive the
 * UI":**
 *   TRACK    `CursorTrack.selectChannel` → UI selection ● (E16j watched `Group`
 *            wrap exactly that track)
 *   DEVICE   `Device.selectInEditor` → UI ● — ⚠ but that is NOT a cursor method.
 *            `CursorDevice.selectDevice` has never been tested against the UI at
 *            all; it was only ever INFERRED not to work.
 *   LAYER    both candidates untested against eyes.
 * So the device case is not the precedent it was treated as, and the "odd"
 * asymmetry may not exist — it may be that only `selectInEditor`-family calls
 * ever drove the UI, and cursors never did except for tracks.
 *
 * ⚠ **Questions are OPEN, not yes/no.** A "is the chain selected? [y/N]" invites
 * the answer the probe is hoping for; E16's rows E1/E5 are decided by what the
 * human actually perceived, and `lib.ask` echoes answers verbatim so they can go
 * into FINDINGS as reports rather than as someone's summary of a report.
 *
 * ⚠ Each arm RESETS the selection to a known place first, because setting the
 * selection to where it already is looks identical to setting nothing.
 *
 * ⚠ Run IN YOUR OWN TERMINAL — needs a TTY, and you need to be looking at Bitwig.
 *
 * Silent and non-destructive: no actions, no inserts, no deletes. The one
 * exception is the FINAL gated step, which fires `Duplicate` only if you report
 * that some mechanism really did select a chain — and undoes it immediately.
 */
import { client, check, note, failureCount, pollUntil, ask } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const SUBJECT = 'gn-lay4';

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
interface LayerList { layers: { index: number; name: string; devices: { name: string }[] }[]; count: number }

await client.connect();
const tracks = await list();
const subject = tracks.find((t) => t.name === SUBJECT);
const other = tracks.find((t) => t.name === 'gn-lay');
if (!subject || !other) { console.log('REFUSING: run e17-setup first.'); process.exit(1); }

/** Point our device cursor at the container so `layerBank0` resolves. Our cursor only. */
async function scopeToContainer(): Promise<void> {
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
}

/**
 * Park the UI selection somewhere KNOWN and visibly different from any chain, so
 * that "nothing changed" is distinguishable from "it was already there".
 * `device.selectInEditor` is the one device-level setter proven to drive the UI.
 */
async function resetSelection(): Promise<void> {
  await scopeToContainer();
  await req('device.selectInEditor', { deviceIndex: 0 });
  await new Promise((r) => setTimeout(r, 700));
}

const answers: { label: string; answer: string }[] = [];

async function arm(label: string, what: string, fire: () => Promise<void>): Promise<string> {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  ARM: ${label}`);
  console.log(`       (${what})`);
  await resetSelection();
  await fire();
  await new Promise((r) => setTimeout(r, 800));
  const a = await ask(
    '  Look at the Instrument Layer on gn-lay4. What appears SELECTED / highlighted now?\n'
    + '     — a whole chain lane? which one (Phase-4 / Polysynth / Organ / Sampler)?\n'
    + '     — a device inside a chain? which?\n'
    + '     — the Instrument Layer container itself?\n'
    + '     — the track? something else? or no visible change from the container?',
  );
  answers.push({ label, answer: a });
  return a;
}

console.log('');
console.log('='.repeat(70));
console.log(' ⚠ Have gn-lay4 visible with its Instrument Layer open, so you can see all');
console.log(' four chains: Phase-4, Polysynth, Organ, Sampler.');
console.log('');
console.log(' Before each arm I park the selection on the CONTAINER, then fire ONE');
console.log(' selection call. Nothing is created, deleted or duplicated.');
console.log('='.repeat(70));

await scopeToContainer();
const l = (await req('layer.list')) as LayerList;
note(`${SUBJECT}: ${l.count} chains — ${l.layers.map((x) => `${x.index}:${x.name}`).join(' ')}`);
check(`PRECONDITION: ${SUBJECT} shows its four distinct chains`, l.count === 4, { count: l.count });

// ==========================================================================
// CALIBRATION — establish that the reset itself is visible, so later "no change"
// answers mean something. Without this, every arm's answer is uncalibrated.
console.log(`\n${'─'.repeat(70)}`);
console.log('  CALIBRATION — does the RESET itself do anything visible?');
await req('cursor.pointTrack', { cursor: '0', trackIndex: other.index });
await new Promise((r) => setTimeout(r, 800));
await ask('  I have pointed the track cursor at gn-lay. What is selected in Bitwig now?');
await resetSelection();
const calib = await ask('  Now I have called `Device.selectInEditor` on gn-lay4\'s Instrument Layer.\n'
  + '     What is selected now? (this is the one setter already proven to drive the UI)');
answers.push({ label: 'CALIBRATION device.selectInEditor(container)', answer: calib });

// ==========================================================================
await arm('A  layer.select(editor)', 'DeviceChain.selectInEditor() on chain 1 — Polysynth',
  async () => { await req('layer.select', { layerIndex: 1, where: 'editor' }); });

await arm('B  layer.select(mixer)', 'Channel.selectInMixer() on chain 1 — Polysynth',
  async () => { await req('layer.select', { layerIndex: 1, where: 'mixer' }); });

await arm('C  layer.pointCursor', 'CursorDeviceLayer.selectChannel(chain 1) — the cursor route',
  async () => { await req('layer.pointCursor', { layerIndex: 1 }); });

// ⚠ The one that tests the ASYMMETRY the user flagged: for TRACKS the cursor
// drives the UI. Does our DEVICE cursor do the same? Never tested against eyes —
// it was only ever inferred not to, from row 1 being unreachable.
await arm('D  devcursor.selectAt(0)', 'CursorDevice.selectDevice(container) — is the DEVICE cursor a driver?',
  async () => {
    await req('cursor.pointTrack', { cursor: '0', trackIndex: other!.index });
    await new Promise((r) => setTimeout(r, 600));
    await scopeToContainer();
  });

await arm('E  devcursor.selectFirstInLayer(1)', 'moves our device cursor INSIDE chain 1',
  async () => {
    await req('devcursor.selectFirstInLayer', { layerIndex: 1 });
    await pollUntil(async () => {
      const s = (await req('devcursor.status')) as { exists: boolean; name: string };
      return s.exists && s.name === 'Polysynth';
    }, 6000, 200);
  });

// ==========================================================================
console.log(`\n${'='.repeat(70)}`);
console.log(' WHAT YOU REPORTED');
for (const a of answers) console.log(`   ${a.label.padEnd(38)} ${JSON.stringify(a.answer)}`);
console.log('='.repeat(70));

// ==========================================================================
// ⚠ GATED PAYOFF. Only if a mechanism really did select a chain is it worth
// firing an action — and then it is worth it immediately, because that closes
// rows 3 and 4 in the same sitting.
const which = await ask(
  '\n  Did ANY arm (A–E) visibly select a CHAIN LANE rather than a device/container?\n'
  + '     Answer with the letter, or "none".');
const letter = which.trim().toUpperCase()[0] ?? '';
if (!'ABCDE'.includes(letter)) {
  note('⇒ No mechanism selects a chain. That is the finding, and it is now an');
  note('  OBSERVATION rather than an inference from a confounded action outcome.');
  note('  ⚠ It also means e17q\'s "our setters hit the container" reading should be');
  note('  replaced: they do nothing, and the container was ambient state.');
} else {
  const fire: Record<string, () => Promise<void>> = {
    A: async () => { await req('layer.select', { layerIndex: 1, where: 'editor' }); },
    B: async () => { await req('layer.select', { layerIndex: 1, where: 'mixer' }); },
    C: async () => { await req('layer.pointCursor', { layerIndex: 1 }); },
    D: async () => { await scopeToContainer(); },
    E: async () => { await req('devcursor.selectFirstInLayer', { layerIndex: 1 }); },
  };
  console.log(`\n  ⚠ Arm ${letter} selected a chain. Firing `
    + '`Duplicate` against it — this is rows 3 and 4 reopening.');
  await scopeToContainer();
  const before = (await req('layer.list')) as LayerList;
  await resetSelection();
  await fire[letter]!();
  await new Promise((r) => setTimeout(r, 700));
  await req('app.invokeAction', { id: 'Duplicate' });
  await new Promise((r) => setTimeout(r, 2000));
  await scopeToContainer();
  const after = (await req('layer.list')) as LayerList;
  const grew = after.count > before.count;
  note(`chains ${before.count} -> ${after.count}`);
  check(`⚠⚠ arm ${letter} + Duplicate CREATES A CHAIN — rows 3 and 4 reopen`,
    grew, { before: before.count, after: after.count });
  if (grew) {
    await req('app.undo');
    await new Promise((r) => setTimeout(r, 1500));
    await scopeToContainer();
    note(`undone: ${((await req('layer.list')) as LayerList).count} chains`);
  }
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative`);
process.exit(0);
