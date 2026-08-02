/**
 * E17 — THE PRIMER SWEEP. Can anything WE call put focus in a container's chain list?
 *
 * ⚠ **The model this tests, corrected after the operator caught it.** A named action
 * resolves as **the selected item inside the focused region** — two independent
 * things, both required:
 *
 *   FOCUS      which REGION receives the action (arranger / device row / chain list).
 *              ⚠ Only ever established by a human click, so far.
 *   SELECTION  which ITEM within that region. ⚠ Ours already —
 *              `DeviceChain.selectInEditor()`, verified by observer.
 *
 * Once a chain list is focused, we can re-point freely: `e17aa` (clicked Organ,
 * selected Phase-4, Phase-4 duplicated), `e17ab` (one click, three different chains),
 * `e17ae` (one click, then grow/shrink across four chains). Selection was never the
 * problem. **The only missing piece is focus**, and this sweeps every candidate that
 * might supply it.
 *
 * ⚠ **`Device.selectInEditor()` is the reason to think it is possible**: it appears
 * to both focus the device row AND select a device — one call, proven in `e17t`.
 * If chains have an equivalent, we have not found it.
 *
 * **The reset is `pointTrack` away-and-back**, proven to destroy chain focus
 * (`e17ag` arm 5) while a same-track re-point is harmless (arm 4). That makes the
 * sweep OFFLINE: no restart between arms. ⚠ A true cold restart is the follow-up for
 * anything that looks promising — a `pointTrack` reset is not proof of a cold state.
 *
 * ⚠ **Every arm is bracketed by its own negative control.** After the reset and
 * before the primer, we fire once with NO primer: that must read ○. If it does not,
 * the reset failed and the arm is void rather than positive.
 *
 * ⚠ **Full state is captured before and after every fire** — track count AND ids,
 * the subject's device list, and its chain contents. The outcome must be exactly one
 * of: UNCHANGED (the control state) or CHAIN+1 of the named target (success).
 * ⚠ Anything else — a track added or deleted, a container duplicated, a chain count
 * off by more than one — ABORTS. `e17ag` deleted a track and scored it ●● because it
 * had no such guard.
 *
 * ⚠ Two human clicks only: one at the start and one at the end, as the positive
 * control that the recipe is live in this sitting. Everything between is automatic.
 *
 * ⚠ Run IN YOUR OWN TERMINAL — needs a TTY. Bitwig FOREGROUND throughout.
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
const tracks0 = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
const matches = tracks0.filter((t) => t.name === SUBJECT);
if (matches.length !== 1) {
  console.log(`\n⚠⚠ REFUSING: ${matches.length} tracks named ${SUBJECT}. Run npm run probe:e17-reap`);
  process.exit(1);
}
const subject = matches[0]!;
// ⚠ Pick an EMPTY track for the reset, by name, and never track 0. The first run
// used `find(name !== SUBJECT)`, which selected track 0 — the track literally named
// `Instrument Layer`, carrying EIGHT stacked containers of four chains each (a
// documented leftover, untouched by any E17 probe). Flashing to it ten times looked
// exactly like our actions piling up there, and the operator reasonably flagged it.
// An empty track makes the reset visually unambiguous.
const RESET_PREF = ['gn-B', 'gn-conf-B', 'gn-A'];
const other = RESET_PREF.map((n) => tracks0.find((t) => t.name === n)).find((t) => t)
  ?? tracks0.find((t) => t.index > 0 && t.name !== SUBJECT && !/Master/i.test(t.type));
if (!other) { console.log('REFUSING: need a second track for the reset.'); process.exit(1); }
note(`reset track: ${other.name} [${other.index}]`);

// ⚠ Every OTHER track's contents, so an action landing off-subject cannot hide.
// `snapshot()` verified the track list by IDENTITY but never looked inside any track
// but the subject — so a `Duplicate` on the reset track would have read as ○
// everywhere. The operator caught the gap by eye before it ever bit.
async function offSubjectFingerprint(): Promise<string> {
  const now = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
  const parts: string[] = [];
  for (const t of now) {
    if (t.channelId === subject.channelId || /Master/i.test(t.type)) continue;
    await pointTrack(t.index);
    const d = await devs();
    parts.push(`${t.name}:${d.count}/${d.itemCount}:${d.devices.map((x) => x.name).join('+')}`);
  }
  return parts.join('|');
}

async function pointTrack(trackIndex: number): Promise<void> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === trackIndex;
  }, 4000, 150);
  await new Promise((r) => setTimeout(r, 350));
}
/** ⚠ Re-resolve by channelId — indices shift if a track is ever added or removed. */
async function subjectIndex(): Promise<number> {
  const now = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
  const t = now.find((x) => x.channelId === subject.channelId);
  if (!t) { console.log('\n⚠⚠ ABORTING: the subject track is GONE.'); process.exit(1); }
  return t.index;
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
async function scopeContainer(tag: string): Promise<number> {
  const d = await devs();
  const at = d.devices.findIndex((x) => x.name === 'Instrument Layer');
  if (at < 0) {
    console.log(`\n⚠⚠ ABORTING at ${tag}: no Instrument Layer — got [${d.devices.map((x) => x.name).join(', ')}]`);
    process.exit(1);
  }
  await req('devcursor.selectAt', { deviceIndex: at });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === 'Instrument Layer';
  }, 6000, 150);
  if (!ok.ok) { console.log(`\n⚠⚠ ABORTING at ${tag}: cannot scope to the container.`); process.exit(1); }
  return at;
}
const selState = async () => (await req('layer.selectionState')) as SelState;

/** ⚠ FULL state — tracks by identity, devices, chains. The guard e17ag lacked. */
interface Snap { trackCount: number; trackIds: string; devices: string[]; chains: string[] }
async function snapshot(tag: string): Promise<Snap> {
  const t = ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
  await pointTrack(await subjectIndex());
  const d = await devs();
  await scopeContainer(tag);
  const l = (await req('layer.list')) as LayerList;
  return {
    trackCount: t.length,
    trackIds: t.map((x) => x.channelId).sort().join(','),
    devices: d.devices.map((x) => x.name),
    chains: l.layers.map((x) => x.devices[0]?.name ?? '—'),
  };
}
const show = (s: Snap) => `tracks=${s.trackCount} devices=[${s.devices.join(',')}] chains=[${s.chains.join(' ')}]`;

/**
 * ⚠ Exactly two outcomes are legal. Everything else aborts rather than being scored.
 */
function classify(before: Snap, after: Snap, target: string): 'UNCHANGED' | 'CHAIN+1' | string {
  if (after.trackIds !== before.trackIds) {
    return `ANOMALY: the TRACK LIST changed (${before.trackCount} -> ${after.trackCount})`;
  }
  if (after.devices.join() !== before.devices.join()) {
    return `ANOMALY: the DEVICE list changed [${before.devices.join(',')}] -> [${after.devices.join(',')}]`;
  }
  if (after.chains.join() === before.chains.join()) return 'UNCHANGED';
  if (after.chains.length !== before.chains.length + 1) {
    return `ANOMALY: chains went ${before.chains.length} -> ${after.chains.length} (expected +0 or +1)`;
  }
  const gained = after.chains.filter((c) => c === target).length - before.chains.filter((c) => c === target).length;
  if (gained !== 1) return `ANOMALY: a chain appeared but it was not ${target} — [${after.chains.join(' ')}]`;
  return 'CHAIN+1';
}

/** ⚠ The reset: cross-track pointTrack. Destroys chain focus (e17ag arm 5). */
async function reset(): Promise<void> {
  await pointTrack(other!.index);
  await pointTrack(await subjectIndex());
}

interface Result { label: string; verdict: string; negOk: boolean }
const results: Result[] = [];

/**
 * Reset → (negative control) → primer → select a chain → Duplicate → classify.
 * ⚠ The negative control runs INSIDE the arm so the reset is proven for THIS arm.
 */
interface ArmOpts {
  /**
   * ⚠ MUST be false for a human-primed arm. The first version of this probe called
   * `reset()` unconditionally at the top of every arm, so the opening positive
   * control went: operator clicks a chain lane → reset immediately cross-track
   * `pointTrack`s → the focus they just created is destroyed → fire → ○. The
   * control reset away the very thing it existed to verify, and the run refused
   * one arm in. `withNegControl: false` was already threaded through; the reset
   * was not.
   */
  reset: boolean;
  negControl: boolean;
}

async function arm(label: string, primer: (() => Promise<void>) | null,
  opts: ArmOpts = { reset: true, negControl: true }): Promise<Result> {
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`  ${label}`);
  if (opts.reset) await reset();
  else note('   ⚠ NO reset — this arm is testing focus that already exists');

  let negOk = true;
  if (opts.negControl) {
    const nb = await snapshot(`${label} neg-before`);
    await scopeContainer(`${label} neg`);
    const target0 = nb.chains[2] ?? nb.chains[0]!;
    await req('layer.select', { layerIndex: nb.chains.indexOf(target0), where: 'editor' });
    await new Promise((r) => setTimeout(r, 700));
    await req('app.invokeAction', { id: 'Duplicate' });
    await new Promise((r) => setTimeout(r, 1800));
    const na = await snapshot(`${label} neg-after`);
    const nv = classify(nb, na, target0);
    negOk = nv === 'UNCHANGED';
    note(`   negative control (reset, no primer): ${nv}${negOk ? ' ●' : ' ⚠ THE RESET DID NOT WORK'}`);
    if (nv !== 'UNCHANGED' && nv !== 'CHAIN+1') {
      console.log(`\n⚠⚠ ABORTING: ${nv}`); process.exit(1);
    }
    if (nv === 'CHAIN+1') {
      // Undo the accidental growth so the arm still starts clean.
      await req('app.undo'); await new Promise((r) => setTimeout(r, 1600));
    }
  }

  const before = await snapshot(`${label} before`);
  note(`   BEFORE ${show(before)}`);
  await scopeContainer(`${label} primer`);
  if (primer) await primer();
  await new Promise((r) => setTimeout(r, 600));

  // ⚠ Aim at a chain, verify the flag, fire. Nothing cursor-moving in between.
  await scopeContainer(`${label} select`);
  const idx = 2 < before.chains.length ? 2 : 0;
  const target = before.chains[idx]!;
  await req('layer.select', { layerIndex: idx, where: 'editor' });
  await new Promise((r) => setTimeout(r, 700));
  const at = await selState();
  const flagOk = at.layers.find((r) => r.index === idx)?.selectedInEditor === true;
  note(`   target ${target} (chain ${idx});  flag: ${flagOk ? '● SET' : '⚠ NOT SET'}`);
  await req('app.invokeAction', { id: 'Duplicate' });
  await new Promise((r) => setTimeout(r, 1900));

  const after = await snapshot(`${label} after`);
  note(`   AFTER  ${show(after)}`);
  const verdict = classify(before, after, target);
  console.log(`   ⇒ ${verdict === 'CHAIN+1' ? `●● CHAIN +1 (${target}) — THE PRIMER WORKED`
    : verdict === 'UNCHANGED' ? '○ unchanged — no focus established' : `⚠⚠ ${verdict}`}`);
  if (verdict !== 'UNCHANGED' && verdict !== 'CHAIN+1') {
    console.log('\n⚠⚠ ABORTING on an anomalous end state — not scoring it.');
    process.exit(1);
  }
  if (verdict === 'CHAIN+1') {
    await req('app.undo'); await new Promise((r) => setTimeout(r, 1700));
    const back = await snapshot(`${label} undo`);
    if (back.chains.join() !== before.chains.join()) {
      console.log(`\n⚠⚠ ABORTING: undo did not restore — [${back.chains.join(' ')}]`);
      process.exit(1);
    }
  }
  const r = { label, verdict, negOk };
  results.push(r);
  return r;
}

// ==========================================================================
console.log('');
console.log('='.repeat(72));
const start = await snapshot('start');
console.log(` ${SUBJECT}: ${show(start)}`);
console.log(' ⚠ Reset between arms is pointTrack away-and-back. Two clicks needed from you,');
console.log('   at the very start and the very end, as the positive control.');
console.log('='.repeat(72));
const boot = await selState();
check('PRECONDITION: the selection reader is attached',
  String(boot.editorObserver).startsWith('observing:'), { status: boot.editorObserver });
// ⚠ Baseline for every OTHER track, checked again at the end.
const offBefore = await offSubjectFingerprint();
await pointTrack(await subjectIndex());
note(`off-subject baseline captured (${offBefore.split('|').length} tracks)`);
check('PRECONDITION: 4 chains, distinct, one container',
  start.chains.length === 4 && new Set(start.chains).size === 4 && start.devices.length === 1,
  { state: show(start) });
if (start.chains.length !== 4) { console.log('REFUSING: fixture is not the 4-chain baseline.'); process.exit(1); }

// ==========================================================================
console.log(`\n${'─'.repeat(72)}`);
console.log('  POSITIVE CONTROL (opening) — a human click. Proves the recipe is live NOW.');
await waitForEnter('  Click any chain lane in gn-lay4\'s Instrument Layer, then Enter and hands off');
const posA = await arm('POS-A: human chain-lane click', null, { reset: false, negControl: false });
check('⚠ OPENING CONTROL: a human click primes it — the recipe is live in this sitting',
  posA.verdict === 'CHAIN+1', { verdict: posA.verdict });
if (posA.verdict !== 'CHAIN+1') {
  console.log('\n⚠⚠ REFUSING: the human-primed control failed, so every ○ below would be');
  console.log('  environmental. Is Bitwig foreground, with the device panel open?');
  process.exit(1);
}

// ==========================================================================
console.log(`\n${'='.repeat(72)}`);
console.log(' THE CANDIDATES — each preceded by a reset and its own negative control');
console.log('='.repeat(72));

await arm('A: device.selectInEditor(container), then select a chain', async () => {
  const at = await scopeContainer('A');
  await req('device.selectInEditor', { deviceIndex: at });
  note('   primer: device.selectInEditor(container) — the call that focuses the DEVICE row (e17t)');
});

await arm('B: Channel.selectInMixer() on the chain, then selectInEditor', async () => {
  await req('layer.select', { layerIndex: 2, where: 'mixer' });
  note('   primer: layer.select(mixer) — e17s called this "scopes the panel INTO the chain"');
});

// ⚠ CAVEAT specific to this arm, stated so a ○ is read correctly. The primer moves
// `cursorDevice0` INSIDE chain 2, but `layer.select` requires that cursor to be ON
// the container — so the `scopeContainer` that follows necessarily moves it back,
// undoing the primer's CURSOR effect before the fire. Any UI-FOCUS effect should
// survive (our device cursor does not drive the UI — `e17r` arm D), which is the
// thing under test. ⚠ But a ○ here means "no lasting focus effect", NOT "the cursor
// was never inside the chain".
await arm('C: devcursor.selectFirstInLayer(2) — move the device cursor INSIDE the chain', async () => {
  await req('devcursor.selectFirstInLayer', { layerIndex: 2 });
  await new Promise((r) => setTimeout(r, 500));
  const s = (await req('devcursor.status')) as { exists: boolean; name: string };
  note(`   primer: devcursor.selectFirstInLayer(2) → cursor now on ${JSON.stringify(s.name)}`);
  note('   ⚠ the re-scope below moves the cursor back; only a lasting FOCUS effect can show here');
});

await arm('D: layer.selectLegacy(2) — DeviceChain.select(), @Deprecated but it RETURNS', async () => {
  const r = await req('layer.selectLegacy', { layerIndex: 2 }) as { legacySelect?: string };
  note(`   primer: layer.selectLegacy -> ${r.legacySelect}`);
});

// ⚠ The six navigation actions from e17p, all ○ there but ALL measured under the
// broken harness (unfocused sessions, poisoned by our own pointTrack).
const NAV = ['Enter Group', 'Expand Item', 'Focus widget below', 'Focus widget to the right',
  'Select Next', 'toggle_children_expanded_state'];
for (const id of NAV) {
  await arm(`E: navigation action "${id}" (re-measured on the corrected harness)`, async () => {
    const at = await scopeContainer('E');
    await req('device.selectInEditor', { deviceIndex: at });
    await new Promise((r) => setTimeout(r, 400));
    await req('app.invokeAction', { id });
    note(`   primer: device.selectInEditor(container) + "${id}"`);
  });
}

// ⚠ Reference arm: the device-row focus regime, expected ◐ CONTAINER — which under
// the two-level model is a DIFFERENT anomaly, so `classify` will abort on it. That
// is the point: it proves focus went to the device row rather than the chain list.
console.log(`\n${'─'.repeat(72)}`);
console.log('  ⚠ NOTE: `focus_or_toggle_device_panel` is deliberately NOT swept — e17z arm B');
console.log('  already showed it focuses the DEVICE ROW (the container duplicated), and this');
console.log('  probe aborts on a device-list change by design.');

// ==========================================================================
console.log(`\n${'─'.repeat(72)}`);
console.log('  POSITIVE CONTROL (closing) — a human click again. Was the recipe live THROUGHOUT?');
await waitForEnter('  Click any chain lane again, then Enter and hands off');
const posB = await arm('POS-B: human chain-lane click', null, { reset: false, negControl: false });
check('⚠ CLOSING CONTROL: still live at the end — the ○s above are not drift',
  posB.verdict === 'CHAIN+1', { verdict: posB.verdict });

// ==========================================================================
const end = await snapshot('final');
check('the fixture is EXACTLY as it started, at all levels',
  end.trackIds === start.trackIds && end.devices.join() === start.devices.join()
  && end.chains.join() === start.chains.join(), { start: show(start), end: show(end) });

// ⚠⚠ Did anything land OFF the subject? A ○ on every arm is only meaningful if the
// actions did not quietly fire somewhere else — which nothing in `classify()` could
// have seen.
const offAfter = await offSubjectFingerprint();
await pointTrack(await subjectIndex());
check('⚠⚠ NO other track changed — the ○s mean "nothing happened", not "it fired elsewhere"',
  offAfter === offBefore, {
    changed: offBefore.split('|').filter((x, i) => x !== offAfter.split('|')[i]),
  });

console.log(`\n${'='.repeat(72)}`);
console.log(' PRIMER SWEEP');
for (const r of results) {
  const mark = r.verdict === 'CHAIN+1' ? '●●' : r.verdict === 'UNCHANGED' ? '○ ' : '⚠ ';
  console.log(`  ${mark} ${r.label.padEnd(60)} ${r.negOk ? '' : '(reset failed)'}`);
}
console.log('='.repeat(72));
const winners = results.filter((r) => r.verdict === 'CHAIN+1' && !r.label.startsWith('POS'));
console.log('');
if (winners.length > 0) {
  note('⚠⚠⚠ A PRIMER WORKS WITHOUT A HUMAN:');
  for (const w of winners) note(`     ${w.label}`);
  note('  ⇒ Rows 3/4 may be ● AUTONOMOUS after all. ⚠ A `pointTrack` reset is NOT a cold');
  note('  start — confirm the winner from a TRUE cold session (quit and reopen) before');
  note('  recording it. That is the one thing this offline sweep cannot establish.');
} else {
  note('⇒ ⚠ No API call we have puts focus in a chain list. With both human controls');
  note('  passing, that is a real ○ across all candidates rather than an environmental');
  note('  one. ⇒ Rows 3/4 stand at ◐ HUMAN-ASSISTED, and the missing capability is now');
  note('  named precisely: there is no chain equivalent of `Device.selectInEditor()`.');
  note('  ⚠ Still not proof of impossibility — it is a swept ○ over 10 candidates.');
}
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
