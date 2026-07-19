/**
 * E2e — Which NoteStep property write clobbers pressure?
 * (e02: pressure settles to 0 when set among 19 other props;
 *  e02b: pressure alone is stable. Isolate the interaction.)
 */
import { client, check, note, failureCount, pollUntil, point, ensureFixtureTracks } from './lib.js';

const MECH = 'trackThenSlot';
const settle = () => new Promise((r) => setTimeout(r, 300));

await client.connect();
console.log('connected\n');
const { trackA } = await ensureFixtureTracks();
const p = await point('0', trackA, 0, MECH);
check('cursor0 -> A0', p.ok);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });
await pollUntil(async () => ((await client.request('cursor.getNotesVerbose', { cursor: '0', maxX: 2 })) as any).count === 1);

const readPressure = async () => {
  const r = (await client.request('cursor.getNotesVerbose', { cursor: '0', maxX: 2 })) as any;
  return r.notes[0]?.pressure as number;
};
const setProp = (props: Record<string, unknown>) =>
  client.request('cursor.setNoteProps', { cursor: '0', x: 0, y: 60, props });

await setProp({ pressure: 0.6 });
await settle();
check('baseline: pressure alone settles to 0.6', Math.abs((await readPressure()) - 0.6) < 1e-3, { pressure: await readPressure() });

const others: [string, unknown][] = [
  ['velocity', 0.8], ['releaseVelocity', 0.5], ['velocitySpread', 0.1], ['duration', 0.75],
  ['gain', 0.7], ['pan', -0.25], ['timbre', 0.3], ['transpose', 1.5],
  ['chance', 0.45], ['isChanceEnabled', true],
  ['occurrence', 'FIRST'], ['isOccurrenceEnabled', true],
  ['recurrence', [4, 5]], ['isRecurrenceEnabled', true],
  ['isRepeatEnabled', true], ['repeatCount', 3], ['repeatCurve', 0.5],
  ['repeatVelocityCurve', -0.3], ['repeatVelocityEnd', 0.2],
];
const clobberers: string[] = [];
for (const [key, val] of others) {
  await setProp({ [key]: val });
  await settle();
  const pr = await readPressure();
  if (pr === undefined || Math.abs(pr - 0.6) > 1e-3) {
    clobberers.push(key);
    note(`CLOBBER: setting ${key}=${JSON.stringify(val)} changed pressure to ${pr}`);
    await setProp({ pressure: 0.6 });
    await settle();
    const restored = await readPressure();
    note(`  re-set pressure -> ${restored}`);
  }
}
check('pressure clobberers identified (or none)', true, { clobberers });

// restore A0 fingerprint
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });

console.log(failureCount() === 0 ? '\nE2e: done' : `\nE2e: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
