/**
 * E15 — does `TrackBank.itemCount()` report the PROJECT's track count, or just
 * the bank window?
 *
 * Why it matters: standing rule 5 says bank-window overflow must be detected and
 * refused, never worked around — E5 found that with a 54-track project and a
 * 32-track bank, 22 tracks and 160 clips were simply INVISIBLE (not slow,
 * absent), and `channelId` resolves only inside the window. That makes an
 * oversized project a checkpoint blind spot: a revert could silently miss state
 * it never saw.
 *
 * But the rule is UNIMPLEMENTABLE without a true count. `track.list` iterates to
 * the configured bank size and filters on `exists()`, so "16 tracks exist" and
 * "16 are visible of 54" look identical. E5 measured overflow against a project
 * whose size it already knew — it never established what `itemCount()` reports.
 *
 * ⚠ Destructive-ish: creates tracks past the bank window and deletes them again.
 * Run against a scratch project.
 *
 *   npm run probe:e15
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

interface TrackListResult {
  tracks: { index: number; name: string; type: string; channelId: string }[];
  count: number;
  itemCount?: number;
  bankSize?: number;
}

const list = async () => (await client.request('track.list')) as TrackListResult;

console.log('-- A. baseline: does the extension report itemCount at all?');
const base = await list();
note(`count=${base.count} itemCount=${base.itemCount} bankSize=${base.bankSize}`);
check('track.list reports itemCount and bankSize (the Phase-0 additions)',
  base.itemCount !== undefined && base.bankSize !== undefined, base);

if (base.itemCount === undefined || base.bankSize === undefined) {
  note('=> the deployed extension predates the Phase-0 additions; redeploy and rerun.');
  process.exit(1);
}

const bankSize = base.bankSize;
const headroom = bankSize - base.count;
note(`bank window holds ${bankSize}; ${base.count} tracks visible; ${headroom} slots of headroom`);

console.log('\n-- B. fill the window, then push PAST it');
// Two beyond the window is enough to distinguish "capped at bankSize" from
// "reports the project total".
const toCreate = headroom + 2;
const created: string[] = [];
for (let i = 0; i < toCreate; i++) {
  const before = (await list()).count;
  await client.request('track.create', { position: before });
  await pollUntil(async () => (await list()).count > before || (await list()).count >= bankSize, 3000);
}

const full = await list();
note(`after creating ${toCreate}: count=${full.count} itemCount=${full.itemCount} bankSize=${bankSize}`);

check('the bank window saturates — visible count cannot exceed bankSize (E5)',
  full.count <= bankSize, { count: full.count, bankSize });

// THE question.
const capped = full.itemCount === bankSize || full.itemCount === full.count;
const reportsTotal = (full.itemCount ?? 0) > bankSize;

if (reportsTotal) {
  check('VERDICT ● itemCount reports the PROJECT total — rule 5 is implementable',
    true, { itemCount: full.itemCount, bankSize });
  note('=> LiveAdapter.refreshIndex\'s overflow guard is correct as written.');
} else if (capped) {
  check('VERDICT ○ itemCount is CAPPED at the window — rule 5 needs another signal',
    false, { itemCount: full.itemCount, bankSize });
  note('=> the overflow guard can never fire. Candidate fallbacks: compare against');
  note('   a scene-bank-style total, or treat "window exactly full" as suspicious');
  note('   and refuse, which is conservative but noisy. Record in FINDINGS.');
} else {
  check('VERDICT ◐ itemCount reports something unexpected', false,
    { itemCount: full.itemCount, count: full.count, bankSize });
}

console.log('\n-- C. cleanup: delete the tracks this probe created');
// Created tracks are the trailing Instrument rows with default auto-names.
for (const row of (await list()).tracks.filter((t) => /^Inst \d+$/.test(t.name)).reverse()) {
  if (created.length >= toCreate) break;
  await client.request('track.delete', { trackIndex: row.index });
  created.push(row.channelId);
  await pollUntil(async () => !(await list()).tracks.some((t) => t.channelId === row.channelId), 3000);
}
note(`deleted ${created.length} track(s)`);

const final = await list();
note(`final: count=${final.count} itemCount=${final.itemCount}`);

console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
process.exit(failureCount() === 0 ? 0 : 1);
