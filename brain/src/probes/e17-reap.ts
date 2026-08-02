/**
 * E17 — reap an orphan track BY channelId, and refuse to guess.
 *
 * ⚠ **Why by id and never by name.** The project ended up with TWO tracks called
 * `gn-lay4` — `9a88b37d` (the real fixture, the one `e17ad`'s snapshot refers to)
 * and `4fbe7653` (an orphan created when a named `Duplicate` fired against the UI
 * TRACK selection: E6 blocker 3 / E16j's known hazard). Every probe resolves its
 * subject with `tracks.find(t => t.name === …)`, which silently returns the FIRST
 * match — so we were selecting a chain on one track and firing at another.
 *
 * ⚠ Deleting the wrong one destroys the fixture, so this takes an explicit
 * channelId and verifies before and after. No name lookup anywhere.
 *
 * Usage:  npm run probe:e17-reap            → list, flag duplicate names, delete nothing
 *         npm run probe:e17-reap <id8>      → delete exactly that track
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const TARGET = process.argv[2] ?? '';

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };

await client.connect();
const before = await list();
console.log(`\ncount=${before.count}`);
for (const x of before.tracks) {
  console.log(`  [${x.index}] ${x.name.padEnd(24)} ${x.type.padEnd(10)} ${x.channelId.slice(0, 8)}`);
}

// ⚠ Duplicate NAMES are the hazard, so name them explicitly rather than leaving it
// to whoever reads the list.
const byName = new Map<string, TrackRow[]>();
for (const t of before.tracks) byName.set(t.name, [...(byName.get(t.name) ?? []), t]);
const dupes = [...byName.entries()].filter(([, v]) => v.length > 1);
if (dupes.length > 0) {
  console.log('');
  for (const [name, rows] of dupes) {
    note(`⚠ DUPLICATE NAME "${name}": ${rows.map((r) => `[${r.index}]${r.channelId.slice(0, 8)}`).join('  ')}`);
  }
  note('⚠ Any probe resolving this subject by NAME is addressing the first match only.');
}

if (!TARGET) {
  console.log('\n  (no channelId given — nothing deleted)');
  console.log('  to delete one:  npm run probe:e17-reap -- <first 8 chars of channelId>');
  process.exit(0);
}

const victim = before.tracks.filter((t) => t.channelId.startsWith(TARGET));
check('the channelId matches EXACTLY ONE track — refusing on 0 or 2+', victim.length === 1,
  { target: TARGET, matched: victim.map((v) => `[${v.index}]${v.name}:${v.channelId.slice(0, 8)}`) });
if (victim.length !== 1) {
  console.log('\nREFUSING: ambiguous or absent. Nothing deleted.');
  process.exit(1);
}
const v = victim[0]!;
console.log(`\n  deleting [${v.index}] ${JSON.stringify(v.name)} ${v.type} ${v.channelId.slice(0, 8)}`);
await req('track.delete', { trackIndex: v.index });
const gone = await pollUntil(async () => !(await list()).tracks.some((t) => t.channelId === v.channelId), 6000, 200);

const after = await list();
check('the track is gone, verified by channelId not by count', gone.ok,
  { channelId: v.channelId.slice(0, 8) });
check('exactly one track was removed and nothing else changed',
  after.count === before.count - 1, { before: before.count, after: after.count });
console.log(`\ncount=${after.count}`);
for (const x of after.tracks) {
  console.log(`  [${x.index}] ${x.name.padEnd(24)} ${x.type.padEnd(10)} ${x.channelId.slice(0, 8)}`);
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative`);
process.exit(0);
