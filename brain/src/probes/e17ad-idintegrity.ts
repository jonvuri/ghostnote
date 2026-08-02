/**
 * E17 §1b — is a chain's `channelId` REALLY not durable, or did we measure our own mess?
 *
 * ⚠ **Why this is re-opened, and the user is who asked.** §1b is now the ONLY
 * surviving reason to prefer tracks over layers — rows 3/4 flipped to ● in
 * `e17ab`, so the whole call rests on this one result. It deserves the same
 * scrutiny that broke §1a.
 *
 * ⚠ **The specific artifact `e17n` cannot rule out.** It reads chains via
 * `devcursor.selectAt(deviceIndex: 0)` and **never asserts how many containers are
 * on the track**. During the `e17k`→`e17p` window `gn-lay4` carried STACKED
 * DUPLICATE containers. If index 0 held a different container at snapshot than at
 * verify, we compared **two different containers** — and a duplicate has identical
 * chain NAMES with different IDS. That is precisely the observed pattern:
 * *"names survive, ids all change"*. The artifact and the finding predict the
 * same table.
 *
 * ⚠ Three disjoint id sets across two cycles argues against it — the swap would
 * have to happen twice — but "argues against" is not "rules out", and §1b is
 * load-bearing enough to need better.
 *
 * **PHASE 1 asks the question `e17n` never asked, and needs no restart at all:**
 * ⚠ **is `channelId` stable WITHIN one session?** If a plain re-scope changes it,
 * then "does not survive a restart" is the wrong framing entirely — it would not
 * be an identity at all, and §1b would be TRUE but for a stronger reason. If it is
 * rock stable across every perturbation short of a reload, the restart result gets
 * much more credible.
 *
 * **PHASE 2 re-does the persistence test with the precondition `e17n` lacked:**
 * a STRUCTURAL FINGERPRINT — container count, chain count, chain names, device
 * contents — captured at both ends. ⚠ The verify REFUSES to compare ids unless the
 * fingerprint matches, so "we read a different container" can never again
 * masquerade as "the ids changed".
 *
 * ⚠ TRACK ids are captured alongside as the in-run control (E2f). If track ids
 * also changed, the reader is broken rather than the chains.
 *
 *   (no args)   PHASE 1 + write the snapshot   ⚠ run BEFORE saving and quitting
 *   verify      PHASE 2 comparison             run after reopening
 *
 * Silent and READ-ONLY: no actions, no inserts, no deletes, no foreground needed.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const SNAP = join(tmpdir(), 'gn-e17ad-idintegrity.json');
const MODE = process.argv[2] === 'verify' ? 'verify' : 'snapshot';
const SUBJECTS = ['gn-lay4', 'gn-lay', 'gn-sel'];

interface TrackRow { index: number; name: string; type: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number; itemCount: number }
interface LayerRow { index: number; name: string; channelId?: string | boolean; devices: { name: string }[] }
interface LayerList { layers: LayerRow[]; count: number }

interface ChainRec { index: number; name: string; channelId: string; devices: string[] }
interface TrackRec {
  name: string; channelId: string;
  containerCount: number; containerItemCount: number; containerName: string;
  chains: ChainRec[];
}

const list = async () => ((await req('track.list')) as { tracks: TrackRow[] }).tracks;

async function pointAt(trackIndex: number): Promise<void> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === trackIndex;
  }, 4000, 150);
  await new Promise((r) => setTimeout(r, 300));
}

async function devicesOn(trackIndex: number): Promise<DevList> {
  await pointAt(trackIndex);
  let last = '';
  let out: DevList = { devices: [], count: 0, itemCount: 0 };
  await pollUntil(async () => {
    out = (await req('device.list', { cursor: '0' })) as DevList;
    const n = out.devices.map((d) => d.name).join(',');
    const stable = n === last;
    last = n;
    return stable;
  }, 4000, 200);
  return out;
}

/**
 * ⚠ Reads a track's chains AND the structural fingerprint around them — the thing
 * `e17n` omitted. `containerCount`/`containerItemCount` are what make a
 * different-container read detectable instead of invisible.
 */
async function readTrack(name: string): Promise<TrackRec | null> {
  const tracks = await list();
  const t = tracks.find((x) => x.name === name);
  if (!t) return null;
  const d = await devicesOn(t.index);
  const at = d.devices.findIndex((x) => /Instrument (Layer|Selector)|FX Layer/.test(x.name));
  if (at < 0) return null;
  await req('devcursor.selectAt', { deviceIndex: at });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && /Instrument (Layer|Selector)|FX Layer/.test(s.name);
  }, 6000, 150);
  if (!ok.ok) return null;
  const l = (await req('layer.list')) as LayerList;
  return {
    name, channelId: t.channelId,
    containerCount: d.count, containerItemCount: d.itemCount,
    containerName: d.devices[at]!.name,
    chains: l.layers.map((x) => ({
      index: x.index, name: x.name, channelId: String(x.channelId),
      devices: x.devices.map((y) => y.name),
    })),
  };
}

/** The structural identity of a track, ids EXCLUDED. Two reads that differ here are not comparable. */
const fingerprint = (r: TrackRec) =>
  `containers=${r.containerCount}/${r.containerItemCount}:${r.containerName}`
  + `|chains=${r.chains.map((c) => `${c.index}:${c.name}:[${c.devices.join('+')}]`).join(',')}`;
const idsOf = (r: TrackRec) => r.chains.map((c) => c.channelId);

await client.connect();

// ==========================================================================
if (MODE === 'snapshot') {
  console.log('\n======== PHASE 1 — is `channelId` stable WITHIN one session?');
  note('⚠ The question e17n never asked. If a re-scope alone changes an id, then');
  note('  "does not survive a restart" is the wrong framing — it is not an identity');
  note('  at all. If it is rock stable here, the restart result gets more credible.');

  const SUBJ = 'gn-lay4';
  const readings: { label: string; ids: string[]; fp: string }[] = [];
  const take = async (label: string) => {
    const r = await readTrack(SUBJ);
    if (!r) { console.log(`REFUSING: cannot read ${SUBJ}.`); process.exit(1); }
    readings.push({ label, ids: idsOf(r), fp: fingerprint(r) });
    console.log(`  ${label.padEnd(46)} ${idsOf(r).map((s) => s.slice(0, 8)).join(' ')}`);
  };

  await take('1. first read');
  await take('2. immediately again');
  // ⚠ Re-scope the device cursor without leaving the track.
  await req('devcursor.selectAt', { deviceIndex: 0 });
  await new Promise((r) => setTimeout(r, 400));
  await take('3. after re-selecting the container');
  // ⚠ The perturbation that broke everything else this session.
  const tracks = await list();
  const other = tracks.find((x) => x.name !== SUBJ && x.type !== 'master')!;
  await pointAt(other.index);
  await pointAt(tracks.find((x) => x.name === SUBJ)!.index);
  await take('4. after a track-cursor round trip');
  await new Promise((r) => setTimeout(r, 2500));
  await take('5. after a 2.5s wait');

  const distinct = new Set(readings.map((r) => r.ids.join(',')));
  const fps = new Set(readings.map((r) => r.fp));
  check('⚠ the structure was identical across all five reads (so ids are comparable)',
    fps.size === 1, { fingerprints: [...fps] });
  check('⚠⚠ `channelId` is STABLE within a session across every perturbation',
    distinct.size === 1, { distinctIdSets: distinct.size, readings: readings.map((r) => r.ids[0]?.slice(0, 8)) });
  if (distinct.size > 1) {
    note('⚠⚠ IT IS NOT STABLE WITHIN A SESSION. §1b is TRUE but for a much stronger');
    note('  reason than "does not survive a restart": a chain `channelId` is not an');
    note('  identity at all, it is a per-read handle. ⚠ It also means e17n\'s restart');
    note('  comparison never measured persistence — it measured this.');
  } else {
    note('⇒ Stable in-session. So a change across a RESTART would be a real property,');
    note('  provided the structural fingerprint matches at both ends — which is what');
    note('  phase 2 enforces and e17n did not.');
  }

  // ==========================================================================
  console.log('\n======== PHASE 2 — snapshot, WITH the fingerprint e17n lacked');
  const snap: Record<string, TrackRec> = {};
  for (const name of SUBJECTS) {
    const r = await readTrack(name);
    if (!r) { note(`⚠ ${name}: no container, skipping`); continue; }
    snap[name] = r;
    console.log(`\n  ${name}   track id ${r.channelId.slice(0, 8)}   ${fingerprint(r)}`);
    for (const c of r.chains) {
      console.log(`      chain ${c.index} ${JSON.stringify(c.name).padEnd(14)} ${c.channelId.slice(0, 8)}  [${c.devices.join('+') || '—'}]`);
    }
    // ⚠ A stacked duplicate is exactly the artifact this probe exists to exclude.
    check(`${name}: exactly ONE container, so a different-container read is impossible`,
      r.containerCount === 1 && r.containerItemCount === 1,
      { count: r.containerCount, itemCount: r.containerItemCount });
  }
  writeFileSync(SNAP, JSON.stringify(snap, null, 2));
  console.log(`\n  snapshot written to ${SNAP}`);
  console.log('\n  ⚠ NOW: save the project, quit Bitwig, reopen it, then run');
  console.log('     npm run probe:e17ad-verify');
} else {
  // ==========================================================================
  console.log('\n======== PHASE 2 VERIFY — after the reload');
  if (!existsSync(SNAP)) { console.log(`REFUSING: no snapshot at ${SNAP}. Run the snapshot half first.`); process.exit(1); }
  const snap = JSON.parse(readFileSync(SNAP, 'utf8')) as Record<string, TrackRec>;

  let comparable = 0;
  let idsChanged = 0;
  let namesKept = 0;
  for (const [name, before] of Object.entries(snap)) {
    const after = await readTrack(name);
    console.log(`\n  ${name}`);
    if (!after) { note('  ⚠ cannot read it now — not comparable'); continue; }

    // ⚠⚠ THE GATE e17n DID NOT HAVE. Ids are only comparable if the structure is
    // identical; otherwise "different container" and "different ids" are the same
    // observation and nothing can be concluded.
    const fpBefore = fingerprint(before);
    const fpAfter = fingerprint(after);
    const same = fpBefore === fpAfter;
    console.log(`      before: ${fpBefore}`);
    console.log(`      after:  ${fpAfter}`);
    check(`${name}: the STRUCTURE is identical, so the ids are comparable at all`,
      same, { before: fpBefore, after: fpAfter });
    if (!same) {
      note('  ⚠ NOT COMPARABLE — the container or chain layout changed across the reload,');
      note('  so any id difference could be a different-object read. Recording nothing.');
      continue;
    }
    comparable++;

    const tBefore = before.channelId, tAfter = after.channelId;
    check(`${name}: the TRACK channelId is unchanged (E2f control — if this fails, the READER is broken)`,
      tBefore === tAfter, { before: tBefore.slice(0, 8), after: tAfter.slice(0, 8) });

    for (let i = 0; i < before.chains.length; i++) {
      const b = before.chains[i]!, a = after.chains[i]!;
      const idSame = b.channelId === a.channelId;
      const nameSame = b.name === a.name;
      if (!idSame) idsChanged++;
      if (nameSame) namesKept++;
      console.log(`      chain ${i} ${JSON.stringify(b.name).padEnd(14)}`
        + ` id ${b.channelId.slice(0, 8)} -> ${a.channelId.slice(0, 8)}  ${idSame ? '● same' : '⚠ CHANGED'}`
        + `   name ${nameSame ? '● kept' : `⚠ ${a.name}`}`);
    }
  }

  console.log('');
  check('⚠ at least one track was structurally comparable — otherwise this run says nothing',
    comparable > 0, { comparable });
  if (comparable > 0) {
    check('⚠⚠ §1b RE-CONFIRMED on a fingerprint-gated fixture: chain ids do NOT survive a reload',
      idsChanged > 0, { idsChanged, namesKept });
    if (idsChanged === 0) {
      note('⚠⚠ §1b IS WRONG. Chain ids DID survive, and e17n\'s result was the stacked-');
      note('  container artifact after all. ⇒ The last surviving reason to prefer tracks');
      note('  over layers collapses, and E17 must be re-argued end to end.');
    } else {
      note(`⇒ §1b stands: ${idsChanged} chain ids changed while ${namesKept} names survived, on a`);
      note('  fixture proven structurally identical at both ends. This time the artifact is');
      note('  excluded by construction rather than by argument.');
    }
  }
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
