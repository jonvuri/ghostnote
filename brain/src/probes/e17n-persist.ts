/**
 * E17 — do a layer chain's IDENTITY and NAME survive save + restart?
 *
 * ⚠ The E2f question, never once asked of layers. E2f established that a TRACK's
 * `channelId` is durable across sessions and made it the addressing key (D6);
 * E16w noticed in passing that layer chains have `channelId`s too and recorded
 * them as *"unprobed for durability across save/restart"*. `E17-VERDICT.md` §6
 * still lists it as owed, and it is load-bearing the moment layers are a branch
 * mechanism rather than a fixed fixture — because addressing a chain by INDEX
 * across sessions is exactly the trap D6 exists to prevent.
 *
 * ⚠ Row 5's other half, and it is the one that decides §1b's naming scheme.
 * `e17e` proved an explicitly-set layer name survives a CONTENT change, which
 * corrected E4c. It did not prove it survives a SAVE. A tag that evaporates on
 * reopen is worse than no tag, because it looks durable right up until it isn't —
 * and E16q had to prove exactly this for track names before the scheme could rest
 * on them.
 *
 * ⚠ This is free. A restart is owed anyway for `layer.pointCursor`, so the only
 * cost is capturing a baseline first. Not taking it would mean spending a whole
 * restart later on a question this one could have answered.
 *
 *   snapshot   ⚠ run BEFORE saving and quitting
 *   verify     run after reopening
 *
 * Silent: nothing is launched and the transport is never touched.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const SNAP = join(tmpdir(), 'gn-e17n-persist.json');
const SUBJECTS = ['gn-lay', 'gn-lay4', 'gn-sel'];

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
interface LayerRow { index: number; name: string; channelId?: string | boolean; devices: { name: string }[] }
interface LayerList { layers: LayerRow[]; count: number; layerSelectionStatus?: string }

async function chainsOf(trackIndex: number): Promise<LayerList | null> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === trackIndex;
  }, 4000, 150);
  await req('devcursor.selectAt', { deviceIndex: 0 });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && /Instrument (Layer|Selector)/.test(s.name);
  }, 6000, 150);
  if (!ok.ok) return null;
  return (await req('layer.list')) as LayerList;
}

interface Record_ {
  track: string;
  trackChannelId: string;
  chains: { index: number; name: string; channelId: string; devices: string[] }[];
}

const mode = process.argv[2] ?? 'snapshot';
await client.connect();

const capture = async (): Promise<Record_[]> => {
  const tracks = await list();
  const out: Record_[] = [];
  for (const name of SUBJECTS) {
    const t = tracks.find((x) => x.name === name);
    if (!t) { note(`⚠ ${name} not found`); continue; }
    const l = await chainsOf(t.index);
    if (!l) { note(`⚠ ${name}: no container`); continue; }
    out.push({
      track: name,
      trackChannelId: t.channelId,
      chains: l.layers.map((x) => ({
        index: x.index,
        name: x.name,
        channelId: String(x.channelId),
        devices: x.devices.map((d) => d.name),
      })),
    });
  }
  return out;
};

// ==========================================================================
if (mode === 'snapshot') {
  const snap = await capture();
  writeFileSync(SNAP, JSON.stringify(snap, null, 2));
  console.log('\n-- captured BEFORE save + restart');
  for (const r of snap) {
    console.log(`  ${r.track}  (track ${r.trackChannelId.slice(0, 8)})`);
    for (const c of r.chains) {
      console.log(`     chain ${c.index}  id=${c.channelId.slice(0, 8)}  name=${JSON.stringify(c.name)}`
        + `  [${c.devices.join('+') || '—'}]`);
    }
  }
  check('snapshot captured at least one multi-chain container',
    snap.some((r) => r.chains.length >= 2), { subjects: snap.map((r) => `${r.track}:${r.chains.length}`) });
  // ⚠ Name the thing that makes the test meaningful, so a later reader can see
  // whether it was actually set up rather than inferring it from a green.
  const tagged = snap.flatMap((r) => r.chains).filter((c) => c.name.includes('·'));
  note(tagged.length > 0
    ? `⚠ ${tagged.length} chain(s) carry a middle-dot lineage tag: ${tagged.map((c) => JSON.stringify(c.name)).join(', ')}`
    : '⚠ NO chain carries a middle-dot tag — the row-5 half of this test will prove nothing.');
  console.log(`\nwrote ${SNAP}`);
  console.log('⚠ NOW: save the project, quit Bitwig, reopen it, then run `verify`.');
  process.exit(failureCount() === 0 ? 0 : 1);
}

// ==========================================================================
if (mode === 'verify') {
  const before = JSON.parse(readFileSync(SNAP, 'utf8')) as Record_[];
  const after = await capture();
  console.log('\n-- comparing AFTER save + restart');

  for (const b of before) {
    const a = after.find((x) => x.track === b.track);
    console.log(`\n  ${b.track}`);
    if (!a) {
      check(`${b.track}: the track survived the restart`, false, {});
      continue;
    }
    check(`${b.track}: the TRACK's channelId is unchanged (E2f, re-confirmed)`,
      a.trackChannelId === b.trackChannelId,
      { before: b.trackChannelId.slice(0, 8), after: a.trackChannelId.slice(0, 8) });
    check(`${b.track}: the chain COUNT is unchanged`,
      a.chains.length === b.chains.length, { before: b.chains.length, after: a.chains.length });

    for (const bc of b.chains) {
      const ac = a.chains.find((x) => x.index === bc.index);
      if (!ac) { check(`${b.track} chain ${bc.index}: still present`, false, {}); continue; }
      console.log(`     chain ${bc.index}: id ${bc.channelId.slice(0, 8)} -> ${ac.channelId.slice(0, 8)}`
        + `   name ${JSON.stringify(bc.name)} -> ${JSON.stringify(ac.name)}`
        + `   [${ac.devices.join('+') || '—'}]`);
    }

    // ⚠ THE question: is a layer channelId a durable key or a session handle?
    const idsHeld = b.chains.every((bc) =>
      a.chains.find((x) => x.index === bc.index)?.channelId === bc.channelId);
    check(`⚠ ${b.track}: every CHAIN channelId survived save + restart — a layer has`
      + ' durable identity, so a chain can be addressed by id rather than index',
      idsHeld, {
        before: b.chains.map((c) => c.channelId.slice(0, 8)),
        after: a.chains.map((c) => c.channelId.slice(0, 8)),
      });

    const namesHeld = b.chains.every((bc) =>
      a.chains.find((x) => x.index === bc.index)?.name === bc.name);
    check(`${b.track}: every chain NAME survived save + restart`, namesHeld, {
      before: b.chains.map((c) => c.name), after: a.chains.map((c) => c.name),
    });
  }

  // ⚠ Row 5's decisive half, called out separately because it is the one that
  // decides whether §1b's lineage tag can live in a layer name at all.
  const tagBefore = before.flatMap((r) => r.chains).filter((c) => c.name.includes('·'));
  const tagAfter = after.flatMap((r) => r.chains).filter((c) => c.name.includes('·'));
  if (tagBefore.length === 0) {
    note('⚠ no tagged chain existed before the restart, so row 5\'s persistence half is'
      + ' UNANSWERED by this run — do not read the greens above as covering it.');
  } else {
    check('⚠⚠ ROW 5, the half `e17e` could not reach: a middle-dot lineage tag written into'
      + ' a LAYER name survives save + restart, exactly as E16q proved for track names',
      tagAfter.length === tagBefore.length
      && tagBefore.every((t) => tagAfter.some((x) => x.name === t.name)),
      { before: tagBefore.map((c) => c.name), after: tagAfter.map((c) => c.name) });
  }

  console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
  process.exit(failureCount() === 0 ? 0 : 1);
}

console.log('usage: e17n-persist.ts snapshot|verify');
process.exit(2);
