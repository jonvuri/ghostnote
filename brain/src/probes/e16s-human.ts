/**
 * E16 §3.4f, the human half — split into `arm` and `read` so it can be driven
 * from a conversation rather than from a readline.
 *
 * ⚠ **This is the experiment, not a supplement to it.** The threat model E16l
 * raised is a HUMAN swapping clips between scenes; `e16s`'s API moves are the
 * control that proves the instrument works. A run of `e16s` alone has measured
 * only our own writes.
 *
 * The epoch lives in the EXTENSION, not in this process, so it survives between
 * invocations — which is what lets the two halves be separate commands with a
 * human acting in between. The baseline is written to disk so `read` cannot
 * silently compare against the wrong number.
 *
 *   npx tsx src/probes/e16s-human.ts arm     # ensures a clip, records baseline
 *   ... the human drags the clip in Bitwig ...
 *   npx tsx src/probes/e16s-human.ts read    # what fired, and what it said
 *
 * Silent. Creates at most one clip and launches nothing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { client, check, note, failureCount, pollUntil, ensureFixtureTracks } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const STATE = join(tmpdir(), 'gn-e16s-human.json');
const HUMAN_SRC = 7;

interface Epoch { epoch: number; sceneCountChanges: number; sceneCount: number;
  selectionChanges: number; log: string[] }
const epoch = async () => (await req('slot.epoch')) as Epoch;
const slotHas = async (trackIndex: number, slotIndex: number): Promise<boolean> =>
  ((await req('slot.status', { trackIndex, slotIndex })) as { hasContent: boolean }).hasContent;

const mode = process.argv[2] ?? 'read';
if (mode !== 'arm' && mode !== 'read') {
  console.log('usage: e16s-human.ts arm|read');
  process.exit(2);
}

await client.connect();

if (mode === 'arm') {
  const { trackA } = await ensureFixtureTracks();
  if (!(await slotHas(trackA, HUMAN_SRC))) {
    await req('clip.create', { trackIndex: trackA, slotIndex: HUMAN_SRC, lengthBeats: 4 });
    await pollUntil(() => slotHas(trackA, HUMAN_SRC));
  }
  const e = await epoch();
  const undo = (await req('app.undoState')) as { canUndo: boolean };
  writeFileSync(STATE, JSON.stringify({
    trackA, slot: HUMAN_SRC, epoch: e.epoch,
    sceneCountChanges: e.sceneCountChanges, selectionChanges: e.selectionChanges,
    canUndo: undo.canUndo, armedAt: new Date().toISOString(),
  }, null, 2));
  console.log('ARMED');
  note(`a clip is waiting on gn-A (bank index ${trackA}), scene row ${HUMAN_SRC}.`);
  note(`baseline contentEpoch = ${e.epoch}, sceneCountChanges = ${e.sceneCountChanges}`);
  note('nothing here makes a sound and the transport stays stopped.');
  note('⚠ now DRAG that clip to an empty slot in a different scene row, then run `read`.');
  process.exit(0);
}

// ---- read ----------------------------------------------------------------
const base = JSON.parse(readFileSync(STATE, 'utf8')) as {
  trackA: number; slot: number; epoch: number; sceneCountChanges: number;
  selectionChanges: number; canUndo: boolean; armedAt: string;
};
const e = await epoch();
const undo = (await req('app.undoState')) as { canUndo: boolean };
const bumps = e.epoch - base.epoch;
const added = bumps <= 0 ? [] : e.log.slice(Math.max(0, e.log.length - bumps));

console.log(`armed at ${base.armedAt}\n`);
note(`contentEpoch ${base.epoch} -> ${e.epoch}  (${bumps >= 0 ? '+' : ''}${bumps})`);
note(`sceneCountChanges ${base.sceneCountChanges} -> ${e.sceneCountChanges}`);
note(`selectionChanges ${base.selectionChanges} -> ${e.selectionChanges}`);
note(`canUndo ${base.canUndo} -> ${undo.canUndo}`);
note(`what the observer saw: ${JSON.stringify(added)}`);

check('⚠ a HUMAN clip drag is DETECTABLE — the content observer fired', bumps > 0,
  { bumps, observed: added });

// ⚠ The observer must not merely fire; it must name the right slots. One that
// fires on the wrong slot is worse than one that stays silent, because it would
// be trusted. The comparison against what the human reports is the check.
check('the observer names specific slots rather than merely counting',
  added.length > 0 && added.every((s) => /^t\d+s\d+=(filled|emptied)$/.test(s)),
  { observed: added });

const pair = added.filter((s) => s.endsWith('=emptied')).length > 0
  && added.filter((s) => s.endsWith('=filled')).length > 0;
check('a drag reads as a PAIR — one slot emptied and one filled, so it is'
  + ' distinguishable from a bare create or delete', pair, { observed: added });

// §3.2.3 predicted this blind spot in the scene-count observer it proposed.
check('the SCENE-COUNT observer stayed still (§3.2.3\'s predicted blind spot, measured)',
  e.sceneCountChanges === base.sceneCountChanges,
  { before: base.sceneCountChanges, after: e.sceneCountChanges });

const stillThere = await slotHas(base.trackA, base.slot);
note(`the source slot (gn-A row ${base.slot}) now reads hasContent=${stillThere}`);
if (stillThere) {
  note('⚠ the clip did not leave its original slot — either nothing was dragged, or it');
  note('  was COPIED rather than moved. Say which; the two produce different logs and');
  note('  a copy would bump once, not twice.');
}

if (bumps === 0) {
  note('⚠ nothing fired. Then a human clip move is POLLED-only: §1\'s fingerprint');
  note('  re-location then recreate carries the entire weight, and §3.2.3\'s');
  note('  extension-side observer cannot be extended to cover this case.');
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
