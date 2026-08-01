/**
 * E16 §3.4h / row C4 — what does a branch COST on disk, and does Bitwig
 * deduplicate a fork's device state?
 *
 * Owed since row C, which recorded a baseline and stopped: *"per-branch delta is
 * NOT measured; it needs a second human ⌘S with branches live"*. A save cannot be
 * triggered from the API, so this is three commands with a human between them.
 *
 * ⚠ **The old baseline is STALE and must not be reused.** C4 recorded 385,619
 * bytes at 0 branches on 2026-07-26 13:12; the project on disk is now 403,236
 * from 16:01 that day and has been churned through two further sessions. So this
 * takes its own baseline rather than differencing against a number that
 * describes a different project.
 *
 * ⚠ **The byte count is not the interesting part.** The question underneath it
 * is whether a fork's plugin state is stored PER COPY or shared: `gn-E16` is two
 * Zebra3s and a Polysynth and cost ~45KB when it arrived, so four forks landing
 * at ~180KB and at ~5KB are different worlds for the branch budget. The
 * track-native model makes every branch a real track, and B2 established that
 * opaque plugin state duplicates faithfully — faithfully is exactly what would
 * make it expensive.
 *
 * The heavy fixture is forked on purpose: it is the worst case, and the worst
 * case is what bounds a budget. A bare track would measure the floor of a fork
 * rather than the cost of branching real work.
 *
 *   npx tsx src/probes/e16u-filesize.ts baseline   # after a ⌘S
 *   npx tsx src/probes/e16u-filesize.ts fork       # makes N forks (silent)
 *   npx tsx src/probes/e16u-filesize.ts read       # after a second ⌘S
 *   npx tsx src/probes/e16u-filesize.ts cleanup    # deletes the forks again
 *
 * Silent: duplicates tracks with the transport stopped and refuses while it
 * rolls (C5's glitch is audible and a duplication burst is not a thing to do
 * under someone's ears without asking).
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';

import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const STATE = join(tmpdir(), 'gn-e16u-filesize.json');
const PROJECT = join(homedir(), 'Documents', 'Bitwig Studio', 'Projects',
  'gn-scale-test', 'gn-scale-test.bwproject');

/** The heavy fixture: two Zebra3s and a Polysynth (~45KB when it arrived, C4). */
const SUBJECT = 'gn-E16';
const FORKS = 4;
/** ⚠ Never reaped by this probe — the sandbox's one protected pair. */
const PROTECTED = new Set([SUBJECT, 'Group 7']);

type TrackRow = { index: number; name: string; channelId: string; type: string };
const list = async () => (await req('track.list')) as
  { tracks: TrackRow[]; count: number; itemCount: number; bankSize: number };

const projectStat = () => {
  const s = statSync(PROJECT);
  return { bytes: s.size, mtime: s.mtime.toISOString() };
};

const mode = process.argv[2] ?? 'read';
await client.connect();

// ==========================================================================
if (mode === 'baseline') {
  const st = projectStat();
  const l = await list();
  const subject = l.tracks.find((t) => t.name === SUBJECT);
  if (!subject) {
    console.log(`REFUSING: no track named ${SUBJECT} — the heavy fixture is the subject and`);
    console.log('a different one would measure a different question.');
    process.exit(1);
  }
  writeFileSync(STATE, JSON.stringify({
    bytes: st.bytes, mtime: st.mtime, trackCount: l.count,
    subjectChannelId: subject.channelId, forkIds: [] as string[],
  }, null, 2));
  console.log('BASELINE RECORDED');
  note(`${PROJECT}`);
  note(`${st.bytes.toLocaleString()} bytes, saved ${st.mtime}`);
  note(`${l.count} tracks (itemCount ${l.itemCount}, bankSize ${l.bankSize})`);
  note(`subject: ${SUBJECT} at bank ${subject.index}`);
  note('⚠ if that mtime is not from the ⌘S you just did, the baseline is stale — re-save.');
  process.exit(0);
}

// ==========================================================================
if (mode === 'fork') {
  const base = JSON.parse(readFileSync(STATE, 'utf8'));
  const rolling = (await req('transport.status')) as { isPlaying: boolean };
  if (rolling.isPlaying) {
    console.log('REFUSING: the transport is rolling and a duplication burst GLITCHES the');
    console.log('audio (C5, 5/5 vs 0/3 placebo). Stop the transport and re-run.');
    process.exit(1);
  }

  const forkIds: string[] = [];
  for (let i = 0; i < FORKS; i++) {
    const before = await list();
    const beforeIds = new Set(before.tracks.map((t) => t.channelId));
    const subjectIndex = before.tracks.find((t) => t.channelId === base.subjectChannelId)?.index;
    if (subjectIndex === undefined) {
      console.log(`REFUSING: ${SUBJECT} no longer resolves — stopping at ${i} forks.`);
      break;
    }
    // ⚠ Every fork duplicates the ORIGINAL, not the previous fork, so all four
    // are the same weight. Forking a fork would measure a chain, not a lineage.
    await req('branch.duplicateTrack', { trackIndex: subjectIndex });
    const grew = await pollUntil(async () => (await list()).count === before.count + 1, 15000, 100);
    if (!grew.ok) {
      console.log(`REFUSING: fork ${i + 1} did not appear within 15s — stopping.`);
      break;
    }
    const fresh = (await list()).tracks.find((t) => !beforeIds.has(t.channelId));
    if (fresh) {
      forkIds.push(fresh.channelId);
      // ⚠ Name it, so the cleanup can never guess. E16r minted three tracks it
      // could not identify and had to sweep them by hand against a KEEP set.
      await req('track.setName', { trackIndex: fresh.index, name: `e16u-fork-${i + 1}` });
    }
  }

  const after = await list();
  writeFileSync(STATE, JSON.stringify({ ...base, forkIds, trackCountAfter: after.count }, null, 2));
  console.log(`FORKED ${forkIds.length} of ${FORKS}`);
  note(`tracks ${base.trackCount} -> ${after.count} (itemCount ${after.itemCount}, bank ${after.bankSize})`);
  check('every fork was identified and named, so cleanup cannot guess',
    forkIds.length === FORKS, { forkIds });
  check('⚠ the bank did not overflow — every fork is addressable (standing rule 5)',
    after.count <= after.bankSize && after.itemCount === after.count,
    { count: after.count, itemCount: after.itemCount, bankSize: after.bankSize });
  note('⚠ now ⌘S again, then run `read`.');
  process.exit(failureCount() === 0 ? 0 : 1);
}

// ==========================================================================
if (mode === 'read') {
  const base = JSON.parse(readFileSync(STATE, 'utf8'));
  const st = projectStat();
  const forks: number = base.forkIds?.length ?? 0;
  const delta = st.bytes - base.bytes;

  console.log('§3.4h — per-branch project file-size delta\n');
  note(`before: ${base.bytes.toLocaleString()} bytes, ${base.trackCount} tracks (${base.mtime})`);
  note(`after:  ${st.bytes.toLocaleString()} bytes, ${base.trackCountAfter} tracks (${st.mtime})`);
  note(`delta:  ${delta >= 0 ? '+' : ''}${delta.toLocaleString()} bytes over ${forks} forks`);
  if (forks > 0) note(`⇒ ${Math.round(delta / forks).toLocaleString()} bytes per fork`);

  check('the project was re-saved after the forks (mtime moved)', st.mtime !== base.mtime,
    { before: base.mtime, after: st.mtime });
  if (st.mtime === base.mtime) {
    console.log('\nREFUSING to report a delta: the file has not been saved since the baseline,');
    console.log('so this would be measuring nothing at all. ⌘S in Bitwig and re-run.');
    process.exit(1);
  }

  /**
   * ⚠ The interpretation, and it is the finding rather than the byte count.
   * `gn-E16` cost ~45KB when it arrived (C4), so a fork that costs about that
   * much stores its plugin state per copy; a fork that costs a fraction of it
   * shares. The threshold is deliberately generous in the "shared" direction so
   * a marginal result reports as unexplained rather than being rounded into a
   * story.
   */
  const perFork = forks > 0 ? delta / forks : 0;
  const FIXTURE_COST = 45_000;
  if (perFork > FIXTURE_COST * 0.6) {
    note('⚠ each fork costs roughly what the ORIGINAL costs ⇒ plugin state is stored PER');
    note('  COPY, not shared. The branch budget is a disk budget as well as a bank-window');
    note('  one, and a heavy lineage grows the project file linearly.');
  } else if (perFork < FIXTURE_COST * 0.15) {
    note('⚠ each fork costs far less than the original ⇒ Bitwig SHARES most of the device');
    note('  state between duplicates. Disk is then not a constraint on the branch budget,');
    note('  and the bank window (§3.4a) remains the binding one.');
  } else {
    note('⚠ between the two hypotheses — report the raw number and do NOT round it into a');
    note('  story. An unexplained ratio is a result (E16r\'s method note).');
  }
  note('⚠ save TIME is the user\'s report, not ours — ask for it, do not infer it from bytes.');
  process.exit(failureCount() === 0 ? 0 : 1);
}

// ==========================================================================
if (mode === 'cleanup') {
  const base = JSON.parse(readFileSync(STATE, 'utf8'));
  const ids: string[] = base.forkIds ?? [];
  let removed = 0;
  for (const channelId of ids) {
    const r = (await req('track.resolveByChannelId', { channelId })) as
      { found: boolean; index?: number; name?: string };
    if (!r.found || r.index === undefined) continue;
    // ⚠ Refuse to delete anything that is not one of ours, by NAME as well as by
    // id. The sandbox is throwaway but gn-E16 and Group 7 are not, and a reap
    // that trusts a stale index is how the wrong track dies.
    if (r.name !== undefined && PROTECTED.has(r.name)) {
      console.log(`REFUSING to delete "${r.name}" — protected.`);
      continue;
    }
    await req('track.delete', { trackIndex: r.index });
    await pollUntil(async () =>
      !((await req('track.resolveByChannelId', { channelId })) as { found: boolean }).found,
      8000, 100);
    removed++;
  }
  const after = await list();
  console.log(`CLEANED UP ${removed} of ${ids.length}`);
  check('the project is back to the track count it started with',
    after.count === base.trackCount, { before: base.trackCount, after: after.count });
  check(`${SUBJECT} and Group 7 are still there`,
    after.tracks.some((t) => t.name === SUBJECT) && after.tracks.some((t) => t.name === 'Group 7'),
    { names: after.tracks.map((t) => t.name) });
  note('⚠ the project file still holds the forks until you ⌘S again — which is fine, and');
  note('  is itself worth one look: does the file shrink back?');
  process.exit(failureCount() === 0 ? 0 : 1);
}

console.log('usage: e16u-filesize.ts baseline|fork|read|cleanup');
process.exit(2);
