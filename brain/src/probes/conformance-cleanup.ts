/**
 * Cleanup after a live conformance run — same job as E2d did for E2c.
 *
 * `conformance.live.ts` creates fixture tracks and renames them (C-stage and
 * C-minted both rename or mint tracks by design), so a run can leave behind
 * `gn-conf-*`, `gn-renamed`, `gn-done` and default-named `Inst N` rows. Left
 * alone they accumulate until the project exceeds the bank window, at which
 * point standing rule 5 correctly refuses to operate on it — so cleaning up is
 * part of the run, not an afterthought.
 *
 *   npm run probe:conformance-cleanup
 *
 * ⚠ Deletes tracks. It only touches rows whose names match the generated
 * patterns below, and it re-resolves by channelId before every delete because
 * deleting a track RE-INDEXES the bank (E3).
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

/** Only names this probe's own runs generate. Nothing a human would type. */
const LITTER = /^(gn-conf-A|gn-conf-B|gn-renamed|gn-done|Inst \d+)$/;

type TrackRow = { index: number; name: string; type: string; channelId: string };
const list = async () =>
  (await client.request('track.list')) as { tracks: TrackRow[]; count: number; itemCount: number; bankSize: number };

const exactIds = new Set(process.argv.slice(2));
const before = await list();
note(`before: ${before.count} visible, itemCount=${before.itemCount}, bankSize=${before.bankSize}`);

const doomed = exactIds.size > 0
  ? before.tracks.filter((track) => exactIds.has(track.channelId))
  : before.tracks.filter((t) => t.type === 'Instrument' && LITTER.test(t.name));
if (exactIds.size > 0 && doomed.length !== exactIds.size) {
  const found = new Set(doomed.map((track) => track.channelId));
  throw new Error(`approved fixture ids not found: ${[...exactIds].filter((id) => !found.has(id)).join(', ')}`);
}
note(`litter: ${doomed.map((t) => t.name).join(', ') || '(none)'}`);

let deleted = 0;
for (const target of doomed) {
  // ⚠ Re-resolve every time: each delete shifts every index after it (E3).
  const current = (await list()).tracks.find((t) => t.channelId === target.channelId);
  if (!current) continue;
  await client.request('track.delete', { trackIndex: current.index });
  const gone = await pollUntil(
    async () => !(await list()).tracks.some((t) => t.channelId === target.channelId),
    3000,
  );
  if (gone.ok) deleted++;
  else note(`WARN: ${target.name} (${target.channelId}) did not disappear`);
}

const after = await list();
note(`after: ${after.count} visible, itemCount=${after.itemCount}, bankSize=${after.bankSize}`);
note(`remaining: ${after.tracks.map((t) => t.name).join(' | ')}`);

check('every litter track was deleted', deleted === doomed.length, { deleted, expected: doomed.length });
check('the project no longer overflows the bank window (rule 5)',
  after.itemCount <= after.bankSize, { itemCount: after.itemCount, bankSize: after.bankSize });
check('the Master row is visible again', after.tracks.some((t) => t.type === 'Master'), {
  types: after.tracks.map((t) => t.type),
});

client.disconnect();
console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
process.exit(failureCount() === 0 ? 0 : 1);
