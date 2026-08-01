/**
 * Sandbox housekeeping — report every track's mute state, and optionally clear it.
 *
 * ⚠ Written because `e16w-lead restore` replayed the WRONG baseline. It saves the
 * prior mute state each time `run` starts; the second run started with everything
 * already muted by the first, so "prior" recorded muted, and restoring re-muted
 * the project. **A restore that captures its baseline on every run overwrites the
 * only copy of the original state** — the baseline must be captured once, or not
 * trusted at all.
 *
 *   npx tsx src/probes/e16-unmute.ts          # report only
 *   npx tsx src/probes/e16-unmute.ts --clear  # unmute everything
 */
import { client, note } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const clear = process.argv.includes('--clear');

await client.connect();
const l = (await req('track.list')) as { tracks: { index: number; name: string; type: string }[] };
const muted: string[] = [];
for (const t of l.tracks) {
  const m = (await req('branch.mixer', { trackIndex: t.index })) as { mute: boolean };
  if (m.mute) muted.push(t.name);
}
note(`muted: ${muted.length ? muted.join(', ') : '(none)'}`);

if (clear) {
  for (const t of l.tracks) {
    if (t.type === 'Master') continue;
    await req('branch.setMixer', { trackIndex: t.index, mute: false });
  }
  await req('transport.stop');
  const still: string[] = [];
  for (const t of l.tracks) {
    const m = (await req('branch.mixer', { trackIndex: t.index })) as { mute: boolean };
    if (m.mute) still.push(t.name);
  }
  note(`after clearing, still muted: ${still.length ? still.join(', ') : '(none)'}`);
}
process.exit(0);
