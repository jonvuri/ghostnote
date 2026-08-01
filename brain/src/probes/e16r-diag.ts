/**
 * E16 §3.4a diagnostic — WHICH tracks does the bank window contain past its ceiling?
 *
 * ⚠ `e16r` asked the wrong question and its own FAIL said so. It checked whether
 * the NEWEST track resolved after each create, assuming a window anchored at
 * position 0 — under which the newest, once past the ceiling, never resolves.
 * The measurement disagreed: at itemCount 17 and 18 the newest track DID
 * resolve, and only from 19 did it stop. A fixed window cannot produce that.
 *
 * Two hypotheses fit the data, and they have very different consequences:
 *
 *   FIXED     the window is positions 0..bankSize-1. The first 16 always
 *             resolve; anything created past that never does. Standing rule 5 is
 *             a simple ceiling.
 *   SCROLLING the window MOVES — e.g. following the selection, which
 *             `track.create` sets. Then which tracks are addressable changes
 *             with no structural op at all, and ⚠ **a `channelId` that resolved
 *             when a snapshot was taken may not resolve when the write lands.**
 *             That is a much sharper hazard than a ceiling, and standing rule 5
 *             would need to say something stronger than "detect overflow".
 *
 * The discriminator: **fill the bank to EXACTLY its size, learning every
 * `channelId` while they are all still visible, then create past it and watch
 * which of the KNOWN ids drop out.** Fixed predicts none drop out; scrolling
 * predicts the earliest do.
 *
 * ⚠ This probe also exists because of the second thing `e16r` got wrong, and
 * that one is a finding rather than a defect — see the cleanup note at the foot.
 *
 * Silent; refuses while the transport rolls. Cleans up by KEEP-set rather than
 * by remembering what it made, for the reason below.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type TrackRow = { index: number; name: string; channelId: string; type: string };
type TrackList = { tracks: TrackRow[]; count: number; itemCount: number; bankSize: number };
const list = async () => (await req('track.list')) as TrackList;
const resolves = async (id: string) =>
  ((await req('track.resolveByChannelId', { channelId: id })) as { found: boolean }).found;

await client.connect();
console.log('connected\n');

if (((await req('transport.status')) as { isPlaying: boolean }).isPlaying) {
  console.log('REFUSING: transport is rolling.');
  process.exit(1);
}

await req('branch.contentFilter', { filter: 'ALL_CHANNELS' });
await wait(400);

const start = await list();
/** Everything that was here before — the KEEP set, and the cleanup oracle. */
const KEEP = new Set(start.tracks.map((t) => t.channelId));
const bankSize = start.bankSize;
note(`start: ${start.count} visible / ${start.itemCount} itemCount / bankSize ${bankSize}`);

async function createOne(): Promise<void> {
  const before = (await list()).itemCount;
  await req('track.create', { position: before });
  await pollUntil(async () => (await list()).itemCount > before, 10000, 80);
  await wait(120);
}

// ==========================================================================
// 1. fill to EXACTLY bankSize, learning every id while all are visible
// ==========================================================================
console.log('-- 1. fill the bank to exactly its size, learning every channelId');
while ((await list()).itemCount < bankSize) await createOne();

const full = await list();
const KNOWN = full.tracks.map((t) => ({ id: t.channelId, name: t.name }));
check('at exactly bankSize, every track in the project is visible and knowable',
  full.count === bankSize && full.itemCount === bankSize && KNOWN.length === bankSize,
  { visible: full.count, itemCount: full.itemCount, bankSize });
note(`learned ${KNOWN.length} channelIds while they were all still addressable`);

// ==========================================================================
// 2. push PAST the ceiling and watch which KNOWN ids survive
// ==========================================================================
console.log('\n-- 2. create past the ceiling; which of the known 16 still resolve?');
console.log('');
console.log('  itemCount  visible  known-resolving  first-known  last-known');

const rows: {
  itemCount: number; visible: number; resolving: number;
  first: boolean; last: boolean; dropped: string[];
}[] = [];
for (let extra = 1; extra <= 5; extra++) {
  await createOne();
  const l = await list();
  let resolving = 0;
  /** ⚠ Named, not counted. "two known tracks fell out" is an observation; WHICH
   *  two is the finding, and counting them would have thrown it away. */
  const dropped: string[] = [];
  for (const k of KNOWN) {
    if (await resolves(k.id)) resolving++;
    else dropped.push(k.name);
  }
  const first = await resolves(KNOWN[0]!.id);
  const last = await resolves(KNOWN[KNOWN.length - 1]!.id);
  rows.push({ itemCount: l.itemCount, visible: l.count, resolving, first, last, dropped });
  console.log(`  ${String(l.itemCount).padStart(9)}  ${String(l.count).padStart(7)}  `
    + `${String(resolving).padStart(15)}  ${first ? '●' : '○'}${' '.repeat(10)}  ${last ? '●' : '○'}`
    + `   dropped: ${dropped.join(', ') || '—'}`);
}

// ==========================================================================
// 3. the verdict
// ==========================================================================
console.log('');
const lastRow = rows[rows.length - 1]!;
const anyKnownDropped = rows.some((r) => r.resolving < KNOWN.length);
const firstDropped = rows.some((r) => !r.first);

/**
 * ⚠ The third model, which the first version of this probe did not have and
 * therefore mis-classified as "PARTIAL/OTHER".
 *
 * A window anchored at position 0 does NOT imply that a known track keeps
 * resolving, because creating tracks REORDERS positions: Bitwig's flat bank puts
 * the regular tracks first, then the FX returns, then the Master, and every new
 * regular track is inserted BEFORE that tail. So the tail's positions rise, and
 * the tail is what crosses the ceiling first — while position 0 never moves.
 *
 * That is still a fixed, anchored window. It is "FIXED, and the tail is pushed
 * out of it", which is a different and much more pointed statement than either
 * of the two hypotheses this probe started with.
 */
const droppedNames = new Set(rows.flatMap((r) => r.dropped));
const tailFirst = rows.length > 0 && !firstDropped && anyKnownDropped;
const model = !anyKnownDropped
  ? 'FIXED (nothing displaced)'
  : firstDropped ? 'SCROLLING'
    : tailFirst ? 'FIXED, TAIL PUSHED OUT'
      : 'PARTIAL/OTHER';

console.log(`   ⇒ the window behaves as: ${model}`);
console.log(`     tracks displaced, in order: ${[...droppedNames].join(', ') || 'none'}`);
if (model === 'FIXED, TAIL PUSHED OUT') {
  console.log('     Position 0 never moved, and the tracks that fell out came from the END.');
  console.log('     The window is anchored — but a flat bank orders regular tracks, then FX');
  console.log('     returns, then Master, and every new track is inserted BEFORE that tail.');
  console.log('     ⚠ So the FIRST things to leave the addressable set are the MASTER and the');
  console.log('     FX RETURNS — the master bus every audibility check in E16 reads, and the');
  console.log('     returns §4.8 says cannot be forked. You lose your measuring instrument');
  console.log('     before you lose your ordinary tracks.');
} else if (model === 'FIXED (nothing displaced)') {
  console.log('     Every known track kept resolving. Anchored ceiling; only NEW tracks fall');
  console.log('     outside. Standing rule 5 is a simple overflow refusal, as E5/E15-A framed it.');
} else if (model === 'SCROLLING') {
  console.log('     ⚠ Known tracks STOPPED resolving with no structural op touching them, and');
  console.log('     the EARLIEST went first. The window moves. A channelId that resolved when a');
  console.log('     snapshot was taken can be gone when the write lands, and standing rule 5');
  console.log('     needs to be re-stated as a per-operation precondition, not a startup check.');
} else {
  console.log('     ⚠ Known tracks dropped out but not from the front — the window is neither a');
  console.log('     simple anchor nor a simple scroll. Do not model it until this is explained.');
}

check('§3.4a diag: the window model is DETERMINED (this checks the reading, not the answer)',
  rows.length === 5,
  { model, rows, knownCount: KNOWN.length, displaced: [...droppedNames],
    reading: model === 'FIXED (nothing displaced)'
      ? 'anchored ceiling — rule 5 unchanged'
      : model === 'FIXED, TAIL PUSHED OUT'
        ? '⚠ anchored, but creating tracks pushes the TAIL out — and the tail is Master and '
          + 'the FX returns, i.e. the audibility oracle and the un-forkable buses'
        : '⚠ the addressable set is not stable under track creation' });

check('⚠ the OVERFLOW ITSELF is detectable — itemCount keeps counting past the window',
  lastRow.itemCount > bankSize && lastRow.visible <= bankSize,
  { itemCount: lastRow.itemCount, visible: lastRow.visible, bankSize });

/**
 * ⚠ A finding `e16r` produced by accident, and it is worth more than the row it
 * broke.
 *
 * `e16r` learned each new track's `channelId` by diffing `track.list`. Past the
 * ceiling a created track never appears there, so the diff yielded NOTHING and
 * three tracks were minted whose identity the probe never learned — and could
 * therefore never delete. They had to be swept by name against a KEEP set.
 *
 * ⇒ **A `track.create` past the bank window mints a track we cannot name.**
 * That is sharper than E5's "state outside the window is unsnapshottable": it is
 * unaddressable and un-cleanable, and `receipt.minted` (D16/E2c, which reports
 * the channelId a new track was FOUND at) silently has nothing to report. Under
 * the track-native model, where a fork IS a `track.create`, **a fork attempted
 * at the ceiling produces an orphan** — audible, CPU-consuming, and invisible to
 * us. Standing rule 5's refusal must therefore be checked BEFORE the create, not
 * after it.
 */
console.log('');
console.log('   ⚠ carried from e16r\'s own cleanup bug: a track.create PAST the window mints a');
console.log('     track whose channelId we never learn — `receipt.minted` has nothing to report,');
console.log('     and the track is unaddressable and un-cleanable. A fork at the ceiling is an');
console.log('     ORPHAN. Rule 5 must refuse BEFORE the create, not detect after it.');

// ==========================================================================
// cleanup — by KEEP set, because ids past the window were never learnable
// ==========================================================================
console.log('\n-- cleanup (by KEEP set — see above for why remembering is not enough)');
let removed = 0;
for (let pass = 0; pass < 10; pass++) {
  const l = await list();
  const strays = l.tracks.filter((t) => !KEEP.has(t.channelId));
  if (strays.length === 0 && l.itemCount === start.itemCount) break;
  for (const s of strays) {
    const at = (await req('track.resolveByChannelId', { channelId: s.channelId })) as
      { found: boolean; index?: number };
    if (!at.found || at.index === undefined) continue;
    await req('track.delete', { trackIndex: at.index });
    await pollUntil(async () => !(await resolves(s.channelId)), 8000, 100);
    removed++;
  }
}
await req('branch.contentFilter', { filter: 'ALL_VISIBLE_CHANNELS' });
const final = await list();
note(`removed ${removed} tracks`);
check('the project is back exactly as found',
  final.itemCount === start.itemCount,
  { before: start.itemCount, after: final.itemCount,
    names: final.tracks.map((t) => t.name).join(', ') });

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
