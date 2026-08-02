/**
 * E17 — does the "ambient highlight" MOVE? Vary the target, not just the setter.
 *
 * ⚠ **The user's objection, and it lands.** `e17r` reported chain 1 as
 * *"ambiently selected — highlighted, but the UI selection is still on the
 * track"*, and I read that as `cursorLayer0` binding. But **every arm in `e17r`
 * targeted chain 1.** If chain 1 was highlighted before any of it, then "the
 * cursor bound to chain 1" and "the highlight never moved and we did nothing" are
 * indistinguishable — the same setting-it-where-it-already-is failure the resets
 * were supposed to prevent, missed because I only ever varied the SETTER and
 * never the TARGET.
 *
 * ⇒ So: point at chains 3, 0 and 2 in turn and ask which one is lit.
 *
 * ⚠ **And read OUR OWN cursor beside each answer.** That is the real payload:
 *
 *   readback says Sampler, eyes say Sampler   ⇒ the highlight IS `cursorLayer0`,
 *       it moves, and we have a live pointer into the chain — worth knowing even
 *       if it drives no action.
 *   readback says Sampler, eyes say Polysynth ⇒ the highlight is some OTHER
 *       object and `cursorLayer0` is invisible. The `e17r` note about an "ambient
 *       highlight" would then be about something we have never identified.
 *   readback never changes either        ⇒ `layer.pointCursor` is inert, full
 *       stop, and `e17o`'s exists() flip was ambient too.
 *
 * ⚠ The readback is taken with `device.nesting`, which only READS `cursorDevice0`
 * and `cursorLayer0`. Using `layer.list` here would call `devcursor.selectAt`
 * first and could re-scope the very cursor being measured — `e17l` already hit
 * that, where our own read stole the human's selection.
 *
 * ⚠ The device cursor is scoped to the container ONCE, up front, and never
 * re-pointed mid-run for the same reason.
 *
 * No actions fired, nothing created or deleted. Pure observation.
 * ⚠ Run IN YOUR OWN TERMINAL — needs a TTY and your eyes on Bitwig.
 */
import { client, check, note, failureCount, pollUntil, ask } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const SUBJECT = 'gn-lay4';

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
interface LayerList { layers: { index: number; name: string; devices: { name: string }[] }[]; count: number }
interface Nesting { cursorLayerExists?: boolean | string; cursorLayerName?: string; name?: string }

/** Non-disturbing readback of our own layer cursor. */
const ourCursor = async (): Promise<string> => {
  const n = (await req('device.nesting')) as Nesting;
  return `exists=${n.cursorLayerExists} name=${JSON.stringify(n.cursorLayerName)} (device=${JSON.stringify(n.name)})`;
};

await client.connect();
const tracks = await list();
const subject = tracks.find((t) => t.name === SUBJECT);
if (!subject) { console.log(`REFUSING: ${SUBJECT} not found.`); process.exit(1); }

// Scope ONCE. Everything after this only reads.
await req('cursor.pointTrack', { cursor: '0', trackIndex: subject.index });
await pollUntil(async () => {
  const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
  return s.trackPosition === subject.index;
}, 4000, 150);
await req('devcursor.selectAt', { deviceIndex: 0 });
await pollUntil(async () => {
  const s = (await req('devcursor.status')) as { exists: boolean; name: string };
  return s.exists && s.name === 'Instrument Layer';
}, 6000, 150);
const l = (await req('layer.list')) as LayerList;
console.log('');
console.log('='.repeat(70));
console.log(` ${SUBJECT} chains:  ${l.layers.map((x) => `${x.index}=${x.devices[0]?.name}`).join('   ')}`);
console.log(' Nothing below fires an action or changes any structure.');
console.log('='.repeat(70));
check('PRECONDITION: four distinguishable chains', l.count === 4, { count: l.count });

const log: { label: string; ours: string; eyes: string }[] = [];

// ⚠ BASELINE FIRST — this is the question e17r never asked, and it is the one
// that decides whether anything that follows means anything.
console.log(`\n${'─'.repeat(70)}`);
note(`our cursor right now: ${await ourCursor()}`);
const base = await ask(
  '  BEFORE I touch anything: is any chain highlighted in the Instrument Layer?\n'
  + '     If so, which — Phase-4 / Polysynth / Organ / Sampler? Or none?');
log.push({ label: 'BASELINE (nothing done)', ours: await ourCursor(), eyes: base });

async function arm(label: string, fire: () => Promise<void>, expect: string): Promise<void> {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  ${label}   → aiming at ${expect}`);
  await fire();
  await new Promise((r) => setTimeout(r, 900));
  const ours = await ourCursor();
  note(`our cursor now: ${ours}`);
  const eyes = await ask(`  Which chain is highlighted now? (aiming at ${expect})`);
  log.push({ label, ours, eyes });
}

// ⚠ Deliberately NOT chain 1. Start far away from wherever the baseline sits.
await arm('A  layer.pointCursor(3)', async () => { await req('layer.pointCursor', { layerIndex: 3 }); }, 'Sampler');
await arm('B  layer.pointCursor(0)', async () => { await req('layer.pointCursor', { layerIndex: 0 }); }, 'Phase-4');
await arm('C  layer.pointCursor(2)', async () => { await req('layer.pointCursor', { layerIndex: 2 }); }, 'Organ');
await arm('D  layer.select(editor,3)', async () => { await req('layer.select', { layerIndex: 3, where: 'editor' }); }, 'Sampler');
await arm('E  devcursor.selectFirstInLayer(0)',
  async () => { await req('devcursor.selectFirstInLayer', { layerIndex: 0 }); }, 'Phase-4 (its DEVICE)');

// ==========================================================================
console.log(`\n${'='.repeat(70)}`);
console.log(' OUR READBACK  vs  YOUR EYES');
for (const r of log) {
  console.log(`   ${r.label}`);
  console.log(`      ours: ${r.ours}`);
  console.log(`      eyes: ${JSON.stringify(r.eyes)}`);
}
console.log('='.repeat(70));

const names = log.map((r) => r.ours);
const ourCursorMoved = new Set(names).size > 1;
check('⚠ OUR readback moves as the target changes — `layer.pointCursor` is not inert',
  ourCursorMoved, { readings: names });
note('⚠ Compare the two columns yourself before believing either. If our readback moves');
note('  and your eyes do not, the "ambient highlight" is some object we have never');
note('  identified and `cursorLayer0` is simply invisible — which would retire the');
note('  e17r note rather than confirm it.');

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative`);
process.exit(0);
