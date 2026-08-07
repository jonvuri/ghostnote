/**
 * E18 §3.1 — ⚠ does a REBUILD glitch the audio? A blind, placebo-controlled ear test.
 *
 * **The last unpriced item on the operator's bar**, and the one their wording put
 * first: *"low on (or free of) intermediate states that are undesirable or glitchy"*.
 *
 * E16 measured the TRACK model's answer with the same method and got **5/5 audible
 * on track forks vs 0/3 on placebo** — so a real number exists on the other side of
 * this comparison, which is what makes the ear test worth running at all.
 *
 * ⚠⚠ **RUN 1 (2026-08-03) WAS VOID, and the operator diagnosed why:**
 *
 * > *"The control likely didn't glitch because before we were using heavy tracks with
 * > Zebra instances… Glitching is most likely a function of heavy plugin
 * > initialization, and maybe unpredictable even then."*
 *
 * ⚠ **The record confirms it.** E16 C5's 5/5 was measured forking `gn-E16` —
 * *"two Zebra3s and a Polysynth"*. Run 1's control forked a track of four NATIVE
 * Bitwig devices, which is a far lighter engine event. 0/1 on the control voided
 * the run, exactly as designed.
 *
 * ⚠⚠ **And the consequence is bigger than the control.** If glitching is a function
 * of heavy plugin INITIALIZATION, then run 1's REBUILD arms were also too light to
 * be a fair test — they migrated native devices. The realistic worst case is a take
 * container holding the user's actual patch, which is exactly where a Zebra lives.
 * ⇒ **both** the control and the arms under test are rebuilt around a real plugin.
 *
 * ### ⚠⚠ The hypothesis turns COPY vs MOVE into the interesting question
 *
 * If instantiation is the mechanism, the two rebuild verbs should differ:
 *
 *     MOVE   relocates the EXISTING instance   → no instantiation → predicted clean
 *     COPY   creates a SECOND instance         → instantiation    → predicted glitch
 *
 * ⚠ That is a real product fork, not a curiosity. `e18c` proved both verbs work, and
 * the earlier reasoning preferred COPY because it never drops the device out of the
 * signal path. If COPY glitches and MOVE does not, the two desirable properties are
 * in direct conflict and the operator has a genuine choice to make. Run 1 could not
 * have seen it — it used COPY only.
 *
 * ⚠ `e18f` also gives a specific suspect: the container DELETE is 1688 ms, the
 * heaviest single step.
 *
 * ### ⚠⚠ The method, which is the whole point
 *
 * §3.4e already recorded why a naive ear trial is worthless: a null result *"cannot
 * distinguish 'no glitch' from 'this listener and rig could not have heard one
 * anyway'"*. Two things fix that, and both are non-negotiable here:
 *
 * 1. ⚠ **A PLACEBO arm.** Some trials do nothing at all and still ask the question.
 *    A listener who reports a glitch on placebo is pattern-matching, and their
 *    positives on the real arms are worth nothing. This is what E16's 0/3 bought.
 * 2. ⚠ **BLIND, and randomised.** The operator is not told which arm is which until
 *    the end. ⚠ Knowing that "this is the delete" is exactly how a 1688 ms pause
 *    becomes a remembered click.
 *
 * ⚠ **A POSITIVE CONTROL is included too**, and it is what makes a null result mean
 * something. E16 measured that duplicating a TRACK glitches audibly 5/5 — so one arm
 * does that. If the operator misses the known-audible arm, the rig or the listening
 * conditions cannot resolve a glitch and **every other arm this session is void**.
 * That is the difference between "no glitch" and "no measurement".
 *
 * ### Arms (order randomised, labels hidden) — 8 trials
 *
 *     CONTROL      ×2  fork `gn-E16` itself — E16 C5's EXACT fixture, 5/5 audible
 *     REBUILD-COPY ×2  a full reduce carrying a Zebra3, migrated by COPY
 *     REBUILD-MOVE ×2  the same reduce, migrated by MOVE
 *     PLACEBO      ×2  nothing happens; the same pause, the same question
 *
 * ⚠ **TWO control trials, not one.** The operator's *"maybe unpredictable even
 * then"* is the reason: a stochastic effect sampled once can miss by luck, and run 1
 * spent an entire listening session discovering that a single control trial has no
 * margin. E16 got 5/5, so two should both fire — and if they split 1/2, that is
 * itself the finding that the effect is unreliable.
 *
 * ⚠ **This probe needs a HUMAN and a SOUND SOURCE.** It refuses on a non-TTY rather
 * than inventing an answer from an empty pipe — E16 rows E1/E5 are decided by what
 * the operator HEARD, and a probe that fabricates that is the rows-A–C trap in
 * another costume.
 */
import { client, check, note, failureCount, pollUntil, ask, askYesNo, waitForEnter } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TRACK = 'gn-B';
/** ⚠ E16 C5's exact fixture — `[Instrument Layer, Zebra3, Polysynth]`. */
const CONTROL_TRACK = 'gn-E16';
const PRESET = '/Users/jonvuri/Development/ghostnote/brain/fixtures/InstrumentLayer/gn_layer_4chain.bwpreset';
/** ⚠ The heavy plugin the operator's hypothesis is about. Loads in ~358 ms. */
const ZEBRA = '/Users/jonvuri/Development/ghostnote/brain/fixtures/Zebra3/gn_zebra3clap_bare.bwpreset';
/** Every trial is padded to this, so its DURATION cannot say which arm it was. */
const TRIAL_FLOOR_MS = 7000;

interface TrackRow { index: number; name: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number }
interface ChainRow { index: number; name: string; devices: { index: number; name: string }[] }
interface Inventory { scopes: { slot: number; status: string; deviceName: string; chains: ChainRow[] }[]; trackName: string }

const trackList = async () => ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
const idsOf = (t: TrackRow[]) => t.map((x) => x.channelId).sort().join(',');
let subject!: TrackRow;

async function bail(message: string): Promise<never> {
  console.log(`\n⚠⚠⚠ ABORTING: ${message}`);
  process.exit(1);
}

async function pointSubject(): Promise<void> {
  const row = (await trackList()).find((t) => t.channelId === subject.channelId);
  if (!row) await bail(`"${TRACK}" is gone.`);
  await req('cursor.pointTrack', { cursor: '0', trackIndex: row!.index });
  await wait(650);
}

async function devs(): Promise<DevList> {
  let last = ' ';
  let out: DevList = { devices: [], count: 0 };
  await pollUntil(async () => {
    out = (await req('device.list', { cursor: '0' })) as DevList;
    const n = out.devices.map((d) => d.name).join(',');
    const stable = n === last; last = n; return stable;
  }, 5000, 200);
  return out;
}

async function scopeCursor(slot: number, tag: string): Promise<void> {
  await req('devcursor.selectAt', { deviceIndex: slot });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean };
    return s.exists;
  }, 6000, 150);
  if (!ok.ok) await bail(`${tag}: the device cursor never landed on slot ${slot}.`);
}

async function clearTrack(): Promise<void> {
  await pointSubject();
  let d = await devs();
  for (let g = 0; g < 14 && d.count > 0; g++) {
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
    await pollUntil(async () => (await devs()).count < d.count, 6000, 200);
    d = await devs();
  }
}

/**
 * Build the OLD take container and put a real plugin in it.
 *
 * ⚠ The Zebra3 is the point. Run 1's rebuild arms migrated only native devices, and
 * if the operator's instantiation hypothesis is right that made them too light to
 * glitch regardless of what the rebuild does. A take container in real use holds the
 * patch the human has been working on.
 */
async function buildOld(): Promise<void> {
  await clearTrack();
  await req('device.insertFile', { cursor: '0', path: PRESET });
  await pollUntil(async () => (await devs()).count === 1, 15000, 200);
  await wait(500);
  await scopeCursor(0, 'load zebra');
  await req('layer.insertFile', { layerIndex: 0, path: ZEBRA });
  // Wait for the plugin to actually be in the chain, not just for the call to return.
  await pollUntil(async () => {
    const inv = (await req('chain.inventory')) as Inventory;
    return (inv.scopes[0]?.chains[0]?.devices.length ?? 0) >= 2;
  }, 20000, 300);
  await wait(700);
}

type ArmKind = 'REBUILD-COPY' | 'REBUILD-MOVE' | 'PLACEBO' | 'CONTROL';

/**
 * ⚠⚠ SETUP, done BEFORE the listener is asked to pay attention.
 *
 * Run 2's flaw, and it was mine: `buildOld()` ran INSIDE the measured window, so a
 * rebuild trial's window contained *clear the previous container → insert a 4-chain
 * preset → insert a Zebra3* **and then** the rebuild. Roughly half the window was
 * fixture, and step 3 is the single heaviest instantiation in the whole probe —
 * exactly the event the operator's hypothesis points at.
 *
 * ⇒ Run 2's "the rebuild is audible" could not distinguish the REBUILD from its own
 * SETUP, and the copy-vs-move comparison was never clean either: both arms shared
 * eight device instantiations before the verb under test ever fired.
 *
 * Splitting setup from the fired act is the whole fix. Nothing else changes.
 */
async function prepareArm(kind: ArmKind): Promise<void> {
  if (kind === 'REBUILD-COPY' || kind === 'REBUILD-MOVE') {
    await buildOld();
    // ⚠ The NEW container is built here too. It is a heavy insert (4 devices) and it
    // is NOT the question — the question is migrate-and-delete. Leaving it in the
    // window would reproduce the same confound one step further along.
    await req('device.insertFile', { cursor: '0', path: PRESET });
    await pollUntil(async () => (await devs()).count === 2, 15000, 200);
    await wait(600);
  }
  // CONTROL and PLACEBO need no setup: the fork IS the act, and placebo has none.
}

/** Do the measured work of one arm. Returns a one-line description for the reveal. */
async function performArm(kind: ArmKind): Promise<string> {
  switch (kind) {
    case 'REBUILD-COPY':
    case 'REBUILD-MOVE': {
      const verb = kind === 'REBUILD-COPY' ? 'copy' : 'move';
      // ⚠ Both containers already exist (built in prepareArm). The measured window
      // is exactly MIGRATE + DELETE-OLD — the two steps a production reduce runs
      // that a track fork does not, and nothing else.
      // ⚠ Migrate the ZEBRA specifically: chain 0 is [Phase-4, Zebra3], so the
      // plugin is device index 1. This is the step the hypothesis is about.
      await req('chain.move', {
        srcSlot: 0, srcLayer: 0, srcDevice: 1,
        dst: 'chain', dstSlot: 1, dstLayer: 0, verb,
      });
      await pollUntil(async () => {
        const inv = (await req('chain.inventory')) as Inventory;
        return (inv.scopes[1]?.chains[0]?.devices.length ?? 0) >= 2;
      }, 15000, 300);
      await wait(400);
      // Delete the OLD container — e18f's heaviest step, and now it is destroying
      // a plugin instance too (on the MOVE arm the Zebra has already left).
      await pointSubject();
      const now = await devs();
      const old = now.devices.find((x) => x.name === 'Instrument Layer');
      if (old) {
        await req('device.delete', { cursor: '0', deviceIndex: old.index });
        await pollUntil(async () => (await devs()).count === 1, 12000, 200);
      }
      return `a full reduce carrying a Zebra3, migrated by ${verb.toUpperCase()}`
        + (verb === 'copy' ? ' (instantiates a SECOND instance)' : ' (relocates the existing instance)');
    }
    case 'PLACEBO': {
      // Duration is equalised for every arm by the trial loop, so this just returns.
      return 'NOTHING — placebo';
    }
    case 'CONTROL': {
      /**
       * ⚠⚠ The control forks `gn-E16` — E16 C5's EXACT fixture, not an approximation.
       *
       * Run 1 forked `gn-B` carrying four NATIVE devices and read clean, voiding the
       * session. E16's 5/5 was `gn-E16`: *"two Zebra3s and a Polysynth"*. A positive
       * control whose job is "prove a glitch is detectable here" has to reproduce the
       * condition under which a glitch was actually observed — anything lighter is
       * not a control, it is a third placebo wearing a label.
       */
      const beforeRows = await trackList();
      const beforeIds = new Set(beforeRows.map((t) => t.channelId));
      const heavy = beforeRows.find((t) => t.name === CONTROL_TRACK);
      if (!heavy) {
        await bail(`CONTROL: "${CONTROL_TRACK}" is not in the project. It is E16 C5's fixture and `
          + 'the only known-audible arm available — refusing to run without it.');
      }
      await req('branch.duplicateTrack', { trackIndex: heavy!.index });
      await pollUntil(async () => (await trackList()).length !== beforeRows.length, 10000, 250);
      await wait(600);

      /**
       * ⚠ Remove ONLY what this arm created, and by IDENTITY each time.
       *
       * Deleting by a remembered index is the `e17ag` failure verbatim: that probe
       * trusted an index across a structural op and destroyed a whole track while
       * reporting success. Every pass re-reads the list, finds a channelId that was
       * NOT in the baseline, and deletes that — so a shifted bank cannot cost the
       * operator a track of their own.
       */
      for (let guard = 0; guard < 4; guard++) {
        const now = await trackList();
        const stray = now.find((t) => !beforeIds.has(t.channelId));
        if (!stray) break;
        await req('track.delete', { trackIndex: stray.index });
        await pollUntil(async () =>
          !(await trackList()).some((t) => t.channelId === stray.channelId), 8000, 250);
        await wait(400);
      }
      const leftover = (await trackList()).filter((t) => !beforeIds.has(t.channelId));
      if (leftover.length > 0) {
        await bail(`CONTROL: could not remove the fork(s) ${leftover.map((t) => t.name).join(', ')}. `
          + 'Refusing to continue with an unclean project.');
      }
      return `forking ${CONTROL_TRACK} (Zebra3 + Polysynth) — E16 C5's exact fixture, 5/5 audible`;
    }
  }
}

// ==========================================================================
console.log('');
console.log('='.repeat(78));
console.log(' E18 §3.1 — does a REBUILD glitch? Blind, placebo-controlled, with a');
console.log('            known-audible positive control.');
console.log('='.repeat(78));

if (!process.stdin.isTTY) {
  console.log('\n⚠⚠ REFUSING: this probe is decided by what a human HEARS, and stdin is not a TTY.');
  console.log('   Run it directly in your own terminal:  npm run probe:e18h');
  process.exit(1);
}

await client.connect();
const hello = (await req('contract.hello')) as { methodCount: number };
note(`wire: ${hello.methodCount} methods`);

const hits = (await trackList()).filter((t) => t.name === TRACK);
if (hits.length !== 1) { console.log(`⚠⚠ REFUSING: ${hits.length} tracks named "${TRACK}".`); process.exit(1); }
subject = hits[0]!;
const baseTrackIds = idsOf(await trackList());

console.log('');
console.log('  SET UP, please:');
console.log(`   1. Get audio PLAYING and audible — on a track that is NOT gn-B and NOT ${CONTROL_TRACK}.`);
console.log(`      ⚠ Not ${CONTROL_TRACK}: the control FORKS it, and a doubled/thicker sound would`);
console.log('        tell you which arm you are on. Playing elsewhere isolates the ENGINE event,');
console.log('        which is the thing being measured.');
console.log('   2. Set a level you could hear a click over. Headphones help.');
console.log('   3. ⚠ Do NOT watch the screen during a trial. Listen only.');
console.log('   4. ⚠ A GLITCH is a click, dropout, stutter or crackle. A change in LEVEL or');
console.log('      thickness is NOT a glitch — answer no to those.');
console.log('');
await waitForEnter('Ready when audio is playing');

const tp = (await req('transport.status')) as { isPlaying: boolean };
check('the transport is rolling (there is something to hear)', tp.isPlaying, tp);
if (!tp.isPlaying) {
  console.log('\n⚠⚠ REFUSING: the transport is stopped, so silence would be scored as "no glitch".');
  console.log('   That is the §3.4e trap — a null result that cannot distinguish "no glitch" from');
  console.log('   "nothing was audible anyway". Start playback and re-run.');
  process.exit(1);
}

// ⚠ Randomised so neither the operator nor the order can encode the answer.
// ⚠ TWO controls: the operator's "maybe unpredictable even then" means a stochastic
// effect sampled once can miss by luck, and run 1 spent a whole session finding out
// that one control trial has no margin.
const plan: ArmKind[] = [
  'CONTROL', 'CONTROL',
  'REBUILD-COPY', 'REBUILD-COPY',
  'REBUILD-MOVE', 'REBUILD-MOVE',
  'PLACEBO', 'PLACEBO',
];
for (let i = plan.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [plan[i], plan[j]] = [plan[j]!, plan[i]!];
}

const results: { n: number; kind: ArmKind; heard: boolean; what: string }[] = [];
for (let i = 0; i < plan.length; i++) {
  const kind = plan[i]!;
  console.log(`\n${'-'.repeat(78)}`);
  console.log(` TRIAL ${i + 1} of ${plan.length}`);
  console.log('-'.repeat(78));
  // ⚠ Setup happens BEFORE the listener is engaged, and is given time to settle, so
  // nothing it does can land inside the judged window (run 2's confound).
  await prepareArm(kind);
  await wait(2500);
  await waitForEnter('Listening? Press Enter and the trial runs immediately');
  /**
   * ⚠ Every trial occupies the SAME wall time, and the dry run is why.
   *
   * Measured: a rebuild arm takes ~5.0–5.3 s, the control fork ~0.9 s, the placebo
   * whatever it was told to. ⚠ **That difference is an information leak** — a
   * listener who notices the question arriving early has been told which arm they
   * are on, and the run stops being blind at exactly the moment blindness matters.
   * Padding to a fixed floor removes the cue without touching what the arm does.
   */
  const started = Date.now();
  const what = await performArm(kind);
  const elapsed = Date.now() - started;
  if (elapsed < TRIAL_FLOOR_MS) await wait(TRIAL_FLOOR_MS - elapsed);
  await wait(400);
  const heard = await askYesNo('Did you hear a glitch, click, dropout or stutter?');
  results.push({ n: i + 1, kind, heard, what });
  await clearTrack();
}

// ==========================================================================
console.log('\n' + '='.repeat(78));
console.log(' THE REVEAL');
console.log('='.repeat(78));
for (const r of results) {
  console.log(`  trial ${r.n}  ${r.heard ? '⚠ HEARD ' : '  clean '}  ${r.kind.padEnd(8)} ${r.what}`);
}

const tally = (k: ArmKind) => {
  const rows = results.filter((r) => r.kind === k);
  return { heard: rows.filter((r) => r.heard).length, n: rows.length };
};
const copyArm = tally('REBUILD-COPY');
const moveArm = tally('REBUILD-MOVE');
const placebo = tally('PLACEBO');
const control = tally('CONTROL');
const rebuild = { heard: copyArm.heard + moveArm.heard, n: copyArm.n + moveArm.n };

console.log('');
console.log(`  REBUILD-COPY  ${copyArm.heard}/${copyArm.n} heard   (instantiates a second instance)`);
console.log(`  REBUILD-MOVE  ${moveArm.heard}/${moveArm.n} heard   (relocates the existing one)`);
console.log(`  PLACEBO       ${placebo.heard}/${placebo.n} heard   ⚠ should be 0`);
console.log(`  CONTROL       ${control.heard}/${control.n} heard   ⚠ should be ${control.n} (E16: 5/5 on this fixture)`);
console.log('='.repeat(78));
console.log('');

// ⚠ The two gates that decide whether ANY of this is interpretable.
const placeboClean = placebo.heard === 0;
const controlHeard = control.heard === control.n;
check('⚠ GATE: the PLACEBO arms were clean — the listener is not pattern-matching', placeboClean,
  { placebo });
check('⚠ GATE: the positive CONTROL was heard — the rig can resolve a glitch at all', controlHeard,
  { control, note: 'E16 measured track duplication audible 5/5' });

if (!controlHeard) {
  note('⚠⚠ THE RUN IS VOID, not a null result. The known-audible arm was missed, so this rig and');
  note('   these listening conditions cannot resolve a glitch — and "we heard nothing on the');
  note('   rebuild" carries no information whatsoever. §3.4e names this exact trap.');
  if (control.heard > 0) {
    note(`⚠ But it fired ${control.heard}/${control.n}, so the effect EXISTS and is UNRELIABLE —`);
    note('  which is itself worth recording, and matches the operator\'s "maybe unpredictable".');
    note('  ⇒ next run needs more control trials to establish a rate, not a yes/no.');
  } else {
    note('⚠ 0/2 on E16\'s own fixture, where E16 measured 5/5. Something differs from that');
    note('  sitting beyond the fixture — buffer size, CPU headroom, or what was playing.');
    note('  ⚠ Do NOT weaken the gate to make the run pass; that would manufacture a result.');
  }
} else if (!placeboClean) {
  note('⚠⚠ THE RUN IS VOID. A glitch was reported on an arm where NOTHING HAPPENED, so the');
  note('   positives cannot be trusted either. Re-run with a longer settle between trials.');
} else if (rebuild.heard === 0) {
  note('⚠⚠ THE REBUILD IS INAUDIBLE, and this time it MEANS something: the placebo was clean');
  note('   and the known-audible control fired — on a fixture carrying a real plugin, so the');
  note('   arms were heavy enough to glitch if a rebuild could.');
  note('   ⇒ against the TRACK model\'s 5/5 audible fork (E16 C5), the layer rebuild WINS this');
  note('     row outright. It is the one place the rebuild is CHEAPER than a fork, and it');
  note('     partly offsets the 7-undo-step cost e18f measured.');
} else if (copyArm.heard > 0 && moveArm.heard === 0) {
  note('⚠⚠ THE VERB DECIDES, and the operator\'s mechanism is confirmed: COPY glitches, MOVE');
  note(`   does not (${copyArm.heard}/${copyArm.n} vs ${moveArm.heard}/${moveArm.n}). Instantiating a second`);
  note('   plugin instance is the audible event; relocating an existing one is free.');
  note('⚠⚠ AND THAT IS A REAL TRADE-OFF, not a free win. COPY was preferred precisely because');
  note('   it never drops the device out of the signal path; MOVE is silent but has a gap.');
  note('   ⇒ the operator now has to choose between an audible click and a momentary hole,');
  note('     and neither is strictly better. Record BOTH, decide neither (rule 10).');
} else if (moveArm.heard > 0 && copyArm.heard === 0) {
  note('⚠⚠ THE OPPOSITE OF THE PREDICTION: MOVE is audible and COPY is not. The instantiation');
  note('   mechanism does not explain that, so do NOT retrofit an explanation — record it and');
  note('   re-measure before building anything on it.');
} else {
  note(`⚠ THE REBUILD IS AUDIBLE on both verbs (copy ${copyArm.heard}/${copyArm.n}, move ${moveArm.heard}/${moveArm.n}),`);
  note('  with the placebo clean and the control heard, so the result stands. ⇒ the rebuild');
  note('  joins track forking as a gesture that cannot be performed silently during playback,');
  note('  and the layer model loses the advantage §3.4e provisionally credited it with.');
  note('⚠ Since MOVE instantiates nothing, the source is more likely the container insert or');
  note('  the 1688 ms delete than the migration itself (e18f\'s heaviest step).');
}

console.log('\n-- cleanup');
await clearTrack();
check(`${TRACK} is empty again`, (await devs()).count === 0, {});
check('the TRACK LIST is untouched by identity (the CONTROL arm forks and removes)',
  idsOf(await trackList()) === baseTrackIds, {});
const answer = await ask('Anything else you noticed that the yes/no did not capture? (Enter to skip)');
if (answer) note(`operator: "${answer}"`);

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
