/**
 * E17 — SCRUTINISE "priming". It is a description, not a mechanism.
 *
 * ⚠ **The operator's objection, and it is the right one.** `e17ab` cold showed a
 * chain action does nothing until a human clicks, and that `cursor.pointTrack`
 * to another track breaks it again. But *"priming"* explains nothing, and the odd
 * part is that **a project reload and a track-cursor move have the SAME effect**.
 * A real mechanism should say why those two are the same thing.
 *
 * **The hypothesis worth killing:** what the click actually does is give KEYBOARD
 * FOCUS to the device panel's chain-lane widget, which is what `invokeAction`
 * dispatches against. Under that reading the two are trivially the same: a reload
 * has never rendered the widget, and switching tracks re-renders the panel for a
 * different track and throws the old widget away. Coming back builds a fresh one
 * with no focus. ⚠ That is a story, and five of my stories have already died — so
 * this probe measures rather than argues.
 *
 * ⚠ **A DIFFERENT ACTION on purpose.** Every priming observation so far used
 * `Duplicate`. This uses **`Delete`** — independently proven ● (`e17ab` ROW 4,
 * `e17ae` SHRINK ×3) — so "priming" cannot be a quirk of one action.
 *
 * **Six arms, alternating ○/● so each negative is bracketed by a positive:**
 *   1 COLD          fresh project, no click at all              expect ○
 *   2 ⚠ TRACK CLICK you click the TRACK HEADER, not a chain     ⚠ the discriminator
 *   3 CHAIN CLICK   you click a chain lane                      expect ●
 *   4 SAME-TRACK    our `pointTrack` to the SAME track          specificity control
 *   5 CROSS-TRACK   our `pointTrack` away and back              expect ○
 *   6 RE-PRIME      you click a chain again                     expect ● (recoverable)
 *
 * ⚠ **Arm 2 is the one that could break the story open.** If clicking the TRACK
 * header primes it, "priming" is about the device panel being live for that track,
 * not about chain lanes — and it sits in direct tension with arm 5, because our
 * `pointTrack` also selects a track and yet destroys it. If a human selecting a
 * track primes while our selecting the same track does not, then the difference is
 * not "which track is selected" at all, and the focus story survives.
 *
 * ⚠ **MUST BE RUN IMMEDIATELY AFTER OPENING THE PROJECT**, with no clicks in
 * Bitwig beforehand — arm 1 is meaningless otherwise, which is exactly how
 * `e17ab`'s first run went wrong.
 *
 * ⚠ Run IN YOUR OWN TERMINAL — needs a TTY and your hands.
 * Silent: nothing is launched and the transport is never touched.
 */
import { client, check, note, failureCount, pollUntil, waitForEnter, ask } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const SUBJECT = 'gn-lay4';

interface TrackRow { index: number; name: string; type: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number; itemCount: number }
interface LayerList { layers: { index: number; name: string; devices: { name: string }[] }[]; count: number }
interface SelRow { index: number; selectedInEditor: boolean }
interface SelState { editorObserver: string; layers: SelRow[] }

await client.connect();
const tracks = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
const matches = tracks.filter((t) => t.name === SUBJECT);
if (matches.length !== 1) {
  console.log(`\n⚠⚠ REFUSING: ${matches.length} tracks named ${SUBJECT}. Run npm run probe:e17-reap`);
  for (const m of matches) console.log(`     [${m.index}] ${m.name} ${m.channelId.slice(0, 8)}`);
  process.exit(1);
}
const subject = matches[0]!;
const other = tracks.find((t) => t.name !== SUBJECT && t.type !== 'master' && t.type !== 'Master');
if (!other) { console.log('REFUSING: need a second track.'); process.exit(1); }
const baseIds = new Set(tracks.map((t) => t.channelId));

async function pointTrack(trackIndex: number): Promise<void> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === trackIndex;
  }, 4000, 150);
  await new Promise((r) => setTimeout(r, 350));
}
async function devs(): Promise<DevList> {
  let last = '';
  let out: DevList = { devices: [], count: 0, itemCount: 0 };
  await pollUntil(async () => {
    out = (await req('device.list', { cursor: '0' })) as DevList;
    const n = out.devices.map((d) => d.name).join(',');
    const stable = n === last; last = n; return stable;
  }, 4000, 200);
  return out;
}
/**
 * ⚠ REFUSES rather than reading the wrong thing. The old version ignored its poll
 * result and silently read whatever container happened to be at the index — which
 * is how `gn-sel`'s 2 chains got reported as `gn-lay4` losing two.
 */
async function scopeContainer(tag: string): Promise<void> {
  const d = await devs();
  const at = d.devices.findIndex((x) => x.name === 'Instrument Layer');
  if (at < 0) {
    console.log(`\n⚠⚠ ABORTING at ${tag}: no Instrument Layer on the cursor's track`
      + ` — got [${d.devices.map((x) => x.name).join(', ')}]. The cursor is not where it should be.`);
    process.exit(1);
  }
  await req('devcursor.selectAt', { deviceIndex: at });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === 'Instrument Layer';
  }, 6000, 150);
  if (!ok.ok) { console.log(`\n⚠⚠ ABORTING at ${tag}: could not scope to the container.`); process.exit(1); }
}
/** ⚠ Cursor-free — the only read between a selection and an action. */
const selState = async () => (await req('layer.selectionState')) as SelState;
async function chains(): Promise<{ count: number; contents: string[] }> {
  const l = (await req('layer.list')) as LayerList;
  return { count: l.count, contents: l.layers.map((x) => x.devices[0]?.name ?? '—') };
}
/**
 * ⚠⚠ Track-level integrity, BOTH directions.
 *
 * The first version of this checked only for tracks ADDED and was blind to tracks
 * REMOVED — so when arm 2's `Delete` destroyed `gn-lay4` outright it reported
 * `●● REMOVED Sampler`. The chain reading came from `gn-sel`, which slid into
 * index 9 and happens to hold exactly 2 chains, giving the impossible `4 -> 2`.
 *
 * ⇒ A probe that fires `Delete` MUST verify the subject still exists, by
 * channelId, before believing anything it reads afterwards.
 */
async function trackIntegrity(tag: string): Promise<'ok' | 'added' | 'SUBJECT-DELETED'> {
  const now = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
  if (!now.some((t) => t.channelId === subject.channelId)) {
    note(`⚠⚠⚠ ${tag}: THE SUBJECT TRACK WAS DELETED (${subject.channelId.slice(0, 8)}).`);
    note('   The action targeted the TRACK, not a chain. Undoing immediately.');
    await req('app.undo');
    await new Promise((r) => setTimeout(r, 1800));
    const back = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
    const ok = back.some((t) => t.channelId === subject.channelId);
    note(`   undo ${ok ? 'restored the track (channelId intact)' : '⚠ DID NOT RESTORE IT'}`);
    if (!ok) { console.log('\n⚠⚠ ABORTING: the subject track is gone. Reopen the saved project.'); process.exit(1); }
    return 'SUBJECT-DELETED';
  }
  const o = now.find((t) => !baseIds.has(t.channelId));
  if (o) {
    note(`⚠⚠ ${tag}: the action FORKED A TRACK — ${o.name} ${o.channelId.slice(0, 8)}. Reaping.`);
    await req('track.delete', { trackIndex: o.index });
    await pollUntil(async () =>
      !((await req('track.list')) as { tracks: TrackRow[] }).tracks.some((t) => t.channelId === o.channelId), 6000, 200);
    return 'added';
  }
  return 'ok';
}

/** ⚠ Re-resolve the subject by channelId — indices shift when a track is deleted. */
async function subjectIndex(): Promise<number> {
  const now = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
  const t = now.find((x) => x.channelId === subject.channelId);
  if (!t) { console.log('\n⚠⚠ ABORTING: the subject track is gone.'); process.exit(1); }
  return t.index;
}

await pointTrack(subject.index);
await scopeContainer("baseline");
const base = await chains();
console.log('');
console.log('='.repeat(72));
console.log(` ${SUBJECT}:  ${base.contents.map((n, i) => `${i}=${n}`).join('   ')}`);
console.log(' ⚠ The action under test is DELETE (not Duplicate) — proven ● in e17ab/e17ae,');
console.log('   so "priming" cannot be a quirk of one action. Every delete is undone.');
console.log('='.repeat(72));
check('PRECONDITION: 4 chains with distinct contents',
  base.count === 4 && new Set(base.contents).size === 4, { contents: base.contents });
const boot = await selState();
check('PRECONDITION: the selection reader is attached',
  String(boot.editorObserver).startsWith('observing:'), { status: boot.editorObserver });
if (base.count !== 4) { console.log('REFUSING: fixture is not the 4-chain baseline.'); process.exit(1); }

interface Arm { label: string; worked: boolean; before: number; after: number; removed: string }
const arms: Arm[] = [];

/** Select a chain and fire DELETE. Undo if it worked. ⚠ No cursor call in between. */
async function tryDelete(label: string): Promise<Arm> {
  await pointTrack(await subjectIndex());
  await scopeContainer(`${label} (before)`);
  const before = await chains();
  // ⚠ Always target the LAST chain, chosen from the live reading, never a fixed index.
  const idx = before.count - 1;
  const victim = before.contents[idx]!;
  await req('layer.select', { layerIndex: idx, where: 'editor' });
  await new Promise((r) => setTimeout(r, 800));
  const at = await selState();
  const flagOk = at.layers.find((r) => r.index === idx)?.selectedInEditor === true;
  console.log(`\n  ${label}`);
  note(`   target ${victim} (chain ${idx});  flag: ${flagOk ? '● SET' : '⚠ NOT SET'}`);
  await req('app.invokeAction', { id: 'Delete' });
  await new Promise((r) => setTimeout(r, 1900));

  // ⚠⚠ TRACK LEVEL FIRST, both directions. A deleted subject makes every reading
  // below it a reading of some OTHER track.
  const integrity = await trackIntegrity(label);
  if (integrity === 'SUBJECT-DELETED') {
    console.log(`   ⚠⚠ THE ACTION DELETED THE TRACK, not a chain — recorded as such, NOT as ●`);
    const a: Arm = { label, worked: false, before: before.count, after: before.count, removed: '(TRACK DELETED)' };
    arms.push(a);
    return a;
  }
  await pointTrack(await subjectIndex());
  await scopeContainer(`${label} (after)`);
  const after = await chains();

  // ⚠ A single `Delete` can only remove ONE chain. Anything else means we are not
  // reading what we think we are — `4 -> 2` is how the track deletion hid itself.
  const delta = after.count - before.count;
  if (delta < -1 || delta > 0) {
    console.log(`\n⚠⚠ ABORTING: one \`Delete\` changed the chain count by ${delta}. That is`);
    console.log('  impossible, so the reading is of the wrong object. Recording nothing.');
    process.exit(1);
  }
  const worked = delta === -1;
  console.log(`   ${before.count} -> ${after.count} chains   ${worked ? `●● REMOVED ${victim}` : '○ nothing'}`);
  if (worked) {
    await req('app.undo');
    await new Promise((r) => setTimeout(r, 1700));
    await scopeContainer("undo restore");
    const back = await chains();
    if (back.count !== before.count) note(`   ⚠ undo did not restore: ${back.count} chains`);
  }
  const a = { label, worked, before: before.count, after: after.count, removed: worked ? victim : '(none)' };
  arms.push(a);
  return a;
}

// ==========================================================================
console.log(`\n${'─'.repeat(72)}`);
console.log('  ARM 1 — COLD. No click since the project opened.');
console.log('  ⚠ If you have clicked ANYWHERE in Bitwig since opening this project, say so');
console.log('    now rather than pressing Enter — arm 1 is meaningless otherwise.');
const coldOk = await ask('  Have you clicked anything in Bitwig since opening the project? [y/N]');
if (coldOk.trim().toLowerCase().startsWith('y')) {
  console.log('\n  ⚠ REFUSING: the session is already warm. Quit Bitwig, reopen the project,');
  console.log('    and run this again before touching anything.');
  process.exit(1);
}
const a1 = await tryDelete('ARM 1 — COLD (no click at all)');

// ==========================================================================
console.log(`\n${'─'.repeat(72)}`);
console.log('  ⚠ ARM 2 — THE DISCRIMINATOR. Click the TRACK HEADER of gn-lay4 in the');
console.log('  arranger — the track name, NOT a chain lane, NOT inside the device panel.');
await waitForEnter('  Click gn-lay4\'s TRACK HEADER, then press Enter and hands off');
const a2 = await tryDelete('ARM 2 — after a TRACK-HEADER click (not a chain)');

// ==========================================================================
console.log(`\n${'─'.repeat(72)}`);
console.log('  ARM 3 — now click a CHAIN LANE header inside the Instrument Layer.');
await waitForEnter('  Click any chain lane, then press Enter and hands off');
const a3 = await tryDelete('ARM 3 — after a CHAIN-LANE click');

// ==========================================================================
console.log(`\n${'─'.repeat(72)}`);
console.log('  ARM 4 — SPECIFICITY: our `pointTrack` to the SAME track. Hands off.');
note('⚠ e17ab suggested a same-track re-point is harmless. If so, it is a track CHANGE');
note('  that matters, not the call itself — which the focus story predicts.');
await pointTrack(subject.index);
const a4 = await tryDelete('ARM 4 — after pointTrack to the SAME track');

// ==========================================================================
console.log(`\n${'─'.repeat(72)}`);
console.log('  ARM 5 — CROSS-TRACK: our `pointTrack` away and back. Hands off.');
await pointTrack(other.index);
await pointTrack(subject.index);
const a5 = await tryDelete(`ARM 5 — after pointTrack to ${other.name} and back`);

// ==========================================================================
console.log(`\n${'─'.repeat(72)}`);
console.log('  ARM 6 — RE-PRIME: click a chain lane again. Is arm 5 RECOVERABLE?');
await waitForEnter('  Click any chain lane, then press Enter and hands off');
const a6 = await tryDelete('ARM 6 — re-primed by a chain click');

// ==========================================================================
console.log(`\n${'─'.repeat(72)}`);
console.log(' restoring');
await scopeContainer("final");
const end = await chains();
note(`${SUBJECT}: ${end.count} chains — [${end.contents.join(' ')}]`);
check('the fixture is back to its 4-chain baseline',
  end.count === base.count && end.contents.join() === base.contents.join(),
  { base: base.contents, end: end.contents });

// ==========================================================================
console.log(`\n${'='.repeat(72)}`);
console.log(' DELETE reached the chain?');
for (const a of arms) console.log(`   ${a.worked ? '●' : '○'}  ${a.label.padEnd(52)} ${a.before}->${a.after}`);
console.log('='.repeat(72));
console.log('');

check('⚠ ARM 1: a COLD session cannot act on a chain (replicated with DELETE, not Duplicate)',
  !a1.worked, { before: a1.before, after: a1.after });
check('⚠ ARM 3: a CHAIN-LANE click enables it — the positive control that makes arm 1 mean something',
  a3.worked, { removed: a3.removed });
check('⚠ ARM 5: a CROSS-TRACK pointTrack breaks it again', !a5.worked, { before: a5.before, after: a5.after });
check('⚠ ARM 6: and a click RECOVERS it — arm 5 is a lost precondition, not damage',
  a6.worked, { removed: a6.removed });

console.log('');
if (a2.worked) {
  note('⚠⚠ A TRACK-HEADER CLICK IS ENOUGH. So this is NOT about chain lanes — any human');
  note('  interaction that makes the device panel live for that track will do.');
  note('  ⚠ And it sits in direct tension with arm 5: our `pointTrack` ALSO selects a');
  note('  track and yet destroys the state. ⇒ The difference is not WHICH track is');
  note('  selected — it is that a click delivers input focus and a cursor call does not.');
} else if (a3.worked) {
  note('⚠ A track-header click is NOT enough; it takes a click on a CHAIN LANE.');
  note('  ⇒ The precondition is specific to the chain widget, not to the panel or the');
  note('  track. That is a narrower and more brittle requirement than "prime the panel",');
  note('  and it means no track-level gesture can ever substitute.');
}
if (a4.worked && !a5.worked) {
  note('');
  note('⚠ Same-track pointTrack is HARMLESS; cross-track is fatal. So it is the track');
  note('  CHANGE that destroys it, not the call — consistent with the panel re-rendering');
  note('  for the new track and discarding the old widget. ⇒ A code path may re-point at');
  note('  the track it is already on, but must never leave and return.');
} else if (!a4.worked) {
  note('');
  note('⚠⚠ Even a SAME-TRACK pointTrack destroys it. Then `CursorTrack.selectChannel()`');
  note('  clears the state unconditionally, and any chain code path must not call it at');
  note('  all after priming — a much stricter rule than "do not change tracks".');
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
