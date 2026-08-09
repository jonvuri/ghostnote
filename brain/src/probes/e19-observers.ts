/**
 * E19 — the observers as PRODUCT: does `revision.get` carry a mark the engine can
 * lean on, and does the live extension behave the way the fake was built to?
 *
 * ⚠ **What this is for, and what it is not.** The behaviour is already proven
 * offline (`contract/observers.test.ts`, 11 cases) and portably
 * (`contract/conformance/suite.ts`, `C-mark`/`C-content`). Neither of those can
 * vouch for the two things only Bitwig knows: that the callbacks fire at all
 * through the new durable-identity path, and that a note write into an existing
 * clip does NOT fire one. The second matters more than it looks — the detector's
 * entire value is that silence means something, so if Bitwig is noisier than the
 * fake, every batch looks like a concurrent edit and the mechanism is worthless.
 *
 * ⚠ E16s already measured the underlying callback. What is NEW here is the
 * shape session 3 gave it: `channelId` captured at callback time instead of a
 * bank index, the generation nonce, and both epochs on one mark. Those are OUR
 * code, and they are the part a live run can still falsify.
 *
 *     npm run probe:e19            # PART A only — typed, autonomous, silent
 *     npm run probe:e19-arm        # PART B: baseline for a human clip drag
 *     npm run probe:e19-read       # PART B: what the drag produced
 *
 * ⚠ Separate scripts rather than an argument, matching `probe:e18b-resnap` —
 * whether `npm run` forwards a bare argument has varied by npm version, and a
 * foreground probe that silently ran the wrong half would waste the one thing
 * this probe is expensive in, which is the operator's attention.
 *
 * ⚠⚠ **PART B IS FOREGROUND-GATED AND MUST NEVER BE STARTED OPPORTUNISTICALLY**
 * (HANDOFF-E18 §1, session-state preconditions). It requires a human at the
 * keyboard, in Bitwig, dragging a clip. Arrange it with the operator first.
 * PART A uses typed calls only — no named actions, no focus, no priming — so it
 * is safe to run unattended.
 *
 * Creates at most one clip on the fixture track and launches nothing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  client, check, note, failureCount, pollUntil, ensureFixtureTracks, getNotes, point,
} from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const STATE = join(tmpdir(), 'gn-e19-observers.json');
/** A row the fixture does not otherwise use, so leftovers cannot be misread. */
const PROBE_SLOT = 6;

interface WireEvent {
  seq: number;
  channelId: string;
  trackIndex: number;
  slotIndex: number;
  filled: boolean;
}
interface Mark {
  revision: number;
  generation: string;
  project: string;
  projectStatus: string;
  sceneEpoch: number;
  sceneCount: number;
  contentEpoch: number;
  contentEvents: WireEvent[];
}

const mark = async (): Promise<Mark> => (await req('revision.get')) as Mark;
const since = (m: Mark, from: number): WireEvent[] => m.contentEvents.filter((e) => e.seq > from);
const slotHas = async (trackIndex: number, slotIndex: number): Promise<boolean> =>
  ((await req('slot.status', { trackIndex, slotIndex })) as { hasContent: boolean }).hasContent;

const mode = process.argv[2] ?? 'a';
if (!['a', 'arm', 'read'].includes(mode)) {
  console.log('usage: e19-observers.ts [a|arm|read]');
  process.exit(2);
}

await client.connect();

if (mode === 'a') {
  const { trackA } = await ensureFixtureTracks();
  const tracks = (await req('track.list')) as { tracks: { index: number; channelId: string }[] };
  const channelA = tracks.tracks.find((t) => t.index === trackA)?.channelId ?? '';
  check('E19-A0: the fixture track has a durable id to attribute events to', channelA !== '');

  // --- the mark's shape ------------------------------------------------------
  const m0 = await mark();
  check('E19-A1: the mark carries a generation nonce', typeof m0.generation === 'string' && m0.generation.length > 0, m0.generation);
  check('E19-A2: the mark carries both epochs', typeof m0.sceneEpoch === 'number' && typeof m0.contentEpoch === 'number',
    { sceneEpoch: m0.sceneEpoch, contentEpoch: m0.contentEpoch });
  // ⚠ Per init(), not per request. If this differs, every window in the system
  // reads as discontinuous and the whole mechanism fails closed forever.
  check('E19-A3: the generation is stable across calls', (await mark()).generation === m0.generation);
  // ⚠ The handle status FIRST — rule 13's lesson as instrumentation. "The project
  // is unnamed" and "we never obtained the handle" are indistinguishable in the
  // value, and three false ○s in E17 came from not being able to tell them apart.
  check('E19-A11a: the projectName handle was obtained at init',
    m0.projectStatus === 'marked', m0.projectStatus);
  check('E19-A11b: the mark names the project the epochs were counted in',
    typeof m0.project === 'string' && m0.project.length > 0, m0.project);
  // ⚠ NOT a bare equality. The first version of this check was
  // `(await mark()).project === m0.project`, and it PASSED against an extension
  // that had no such field at all — `undefined === undefined`. A check that
  // passes when the thing under test does not exist is worse than no check: it
  // reported green beside the two FAILs that were telling the truth. Stability
  // is only meaningful for a value that is there.
  const m1 = await mark();
  check('E19-A11c: the project name is a real value AND stable across calls',
    typeof m0.project === 'string' && m0.project.length > 0 && m1.project === m0.project,
    { first: m0.project, second: m1.project });
  // ⚠ §3.2.3: Bitwig delivers INITIAL values through the same callbacks, so a
  // resting project already has a nonzero epoch. Asserted so nobody later reads
  // "epoch > 0" as "something happened".
  note(`at rest: contentEpoch=${m0.contentEpoch}, sceneEpoch=${m0.sceneEpoch}, sceneCount=${m0.sceneCount}`);
  note(`project = ${JSON.stringify(m0.project)} (${m0.projectStatus})`);
  // ⚠ NOT probed here, and deliberately: confirming that loading a different
  // project changes this value needs the operator to open one, which makes it a
  // foreground arm. It belongs with PART B, not in the autonomous half.

  // --- a clip create is an occupancy event, attributed by identity -----------
  if (await slotHas(trackA, PROBE_SLOT)) {
    await req('slot.delete', { trackIndex: trackA, slotIndex: PROBE_SLOT });
    await pollUntil(async () => !(await slotHas(trackA, PROBE_SLOT)));
  }
  const before = await mark();
  await req('clip.create', { trackIndex: trackA, slotIndex: PROBE_SLOT, lengthBeats: 4 });
  await pollUntil(() => slotHas(trackA, PROBE_SLOT));
  const created = await mark();

  const fills = since(created, before.contentEpoch);
  check('E19-A4: a clip create fires exactly one occupancy event', fills.length === 1, fills);
  check('E19-A5: it is a FILL, at the slot we addressed',
    fills[0]?.filled === true && fills[0]?.slotIndex === PROBE_SLOT, fills[0]);
  // ⚠⚠ THE SESSION'S OWN CHANGE, and the one thing E16s never measured: the log
  // used to hold a bank INDEX, which names whatever slid into that slot after any
  // structural op (standing rule 2). If this fails, the detector is matching on a
  // key that goes wrong silently.
  check('E19-A6: the event names the track by DURABLE channelId, not a bank index',
    fills[0]?.channelId === channelA, { got: fills[0]?.channelId, want: channelA });

  // --- a note write into an EXISTING clip must be silent ---------------------
  // ⚠ Through `lib.point`, not by hand. It unpins first, uses the ONE mechanism
  // E1 proved works (track-then-slot), and POLLS `cursor.status` until the cursor
  // really is where we asked — so "the write went somewhere else" cannot be
  // mistaken for "Bitwig fired no event", which is the ambiguity E17 spent a
  // human-assisted probe to resolve.
  const landed = await point('0', trackA, PROBE_SLOT, 'trackThenSlot');
  check('E19-A7a: the cursor landed on the probe slot before writing', landed.ok, landed);
  const quietFrom = await mark();
  await req('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });
  await pollUntil(async () => (await getNotes('0')).length > 0);
  const afterNotes = await mark();
  // ⚠ The load-bearing negative. A detector that fired on every note write would
  // report every batch as a concurrent edit; the fake asserts this and only
  // Bitwig can confirm it.
  check('E19-A7: writing notes into an occupied clip fires NO occupancy event',
    since(afterNotes, quietFrom.contentEpoch).length === 0,
    since(afterNotes, quietFrom.contentEpoch));

  // --- a delete is the other direction --------------------------------------
  const delFrom = await mark();
  await req('slot.delete', { trackIndex: trackA, slotIndex: PROBE_SLOT });
  await pollUntil(async () => !(await slotHas(trackA, PROBE_SLOT)));
  const deleted = await mark();
  const empties = since(deleted, delFrom.contentEpoch);
  check('E19-A8: a clip delete fires an EMPTY at the same slot',
    empties.some((e) => !e.filled && e.slotIndex === PROBE_SLOT && e.channelId === channelA), empties);

  // --- a scene op moves the SCENE epoch, and is seen by an observer ----------
  //
  // ⚠⚠ STANDING RULE 5, ONE LEVEL DOWN — checked BEFORE the create, never after.
  //
  // The rule is written about tracks and it applies verbatim to scenes: a create
  // past the bank window mints a row nothing can address, un-cleanable, and
  // "detect and fail" runs after the damage. The first run of this probe learned
  // it the expensive way against a 99-scene project — `sceneBank.itemCount()`
  // reports the PROJECT total (99, exactly as `trackBank.itemCount()` does per
  // E15-A) while `sceneBank.getScene(i)` is bounded to the 16-wide WINDOW, so the
  // scene it appended landed at project index 99 and `scene.delete` answered
  // `Parameter index (=99) must be in the range 0 to 16`. The scene was stranded.
  //
  // ⚠ The budget is `sceneBankSize - sceneCount`, and it must have room for the
  // one we are about to add AND for that one to be addressable afterwards.
  const rigInfo = (await req('rig.info')) as { scenes: number; sceneCount: number };
  const sceneFrom = await mark();
  if (sceneFrom.sceneCount >= rigInfo.scenes) {
    check('E19-A9: a scene op moves the scene epoch', false,
      `SKIPPED — the project holds ${sceneFrom.sceneCount} scenes and the scene bank window is `
      + `${rigInfo.scenes}. A create would append past the window, where nothing can address or `
      + `delete it (standing rule 5). Reduce the project's scenes, or raise \`scenes\` in `
      + `~/.ghostnote/rig.json, and re-run.`);
    console.log(`E19 PART A: ${failureCount()} FAILED`);
    process.exit(1);
  }

  await req('scene.create', { count: 1 });
  await pollUntil(async () => (await mark()).sceneCount > sceneFrom.sceneCount);
  const sceneAfter = await mark();
  // ⚠ BOUND THE DELTA before deleting anything (method guard 4). One
  // `createScene()` cannot change the count by two, and if it did we are reading
  // the wrong number — in which case the cleanup below would delete a scene of
  // the operator's rather than ours. Abort, do not score, and leave it alone.
  const grew = sceneAfter.sceneCount - sceneFrom.sceneCount;
  if (grew !== 1) {
    console.log(`E19 PART A: ABORT — scene count moved by ${grew}, not 1. Nothing deleted.`);
    process.exit(2);
  }
  // ⚠ THE LIMIT SESSION 3 CLOSED. This counter used to live in the brain and bump
  // on our own ops only; it is now an observer, so it will also move for a scene
  // the HUMAN creates — which PART B is where that half gets confirmed.
  check('E19-A9: a scene op moves the scene epoch', sceneAfter.sceneEpoch !== sceneFrom.sceneEpoch,
    { before: sceneFrom.sceneEpoch, after: sceneAfter.sceneEpoch });
  check('E19-A10: and it is NOT a new generation', sceneAfter.generation === sceneFrom.generation);
  // ⚠ `sceneIndex` — what the handler actually reads, and it is a BANK index, not
  // a project one. They coincide only because the guard above refused to run
  // unless the project fits inside the window; without it this line is the one
  // that strands a scene.
  await req('scene.delete', { sceneIndex: sceneAfter.sceneCount - 1 });
  await pollUntil(async () => (await mark()).sceneCount === sceneFrom.sceneCount);

  console.log(failureCount() === 0 ? 'E19 PART A: PASS' : `E19 PART A: ${failureCount()} FAILED`);
  process.exit(failureCount() === 0 ? 0 : 1);
}

// --- PART B: the human ------------------------------------------------------
//
// ⚠ Split into `arm` and `read` so it is driven from a conversation rather than
// from a readline — the epoch lives in the EXTENSION, so it survives between
// invocations, and the baseline goes to disk so `read` cannot silently compare
// against the wrong number. Same shape as `e16s-human`, deliberately.

if (mode === 'arm') {
  const { trackA } = await ensureFixtureTracks();
  const tracks = (await req('track.list')) as { tracks: { index: number; channelId: string }[] };
  const channelA = tracks.tracks.find((t) => t.index === trackA)?.channelId ?? '';
  if (!(await slotHas(trackA, PROBE_SLOT))) {
    await req('clip.create', { trackIndex: trackA, slotIndex: PROBE_SLOT, lengthBeats: 4 });
    await pollUntil(() => slotHas(trackA, PROBE_SLOT));
  }
  const m = await mark();
  writeFileSync(STATE, JSON.stringify({
    trackA, channelA, slot: PROBE_SLOT,
    contentEpoch: m.contentEpoch, sceneEpoch: m.sceneEpoch, generation: m.generation,
    project: m.project,
    armedAt: new Date().toISOString(),
  }, null, 2));
  console.log('ARMED');
  note(`a clip is waiting on gn-A (bank index ${trackA}), scene row ${PROBE_SLOT}.`);
  note('DRAG it to a different scene row, then run `npm run probe:e19-read`.');
  note(`baseline: contentEpoch=${m.contentEpoch} sceneEpoch=${m.sceneEpoch} gen=${m.generation}`);
  note(`project = ${JSON.stringify(m.project)}`);
  note('⚠ OPTIONAL SECOND ARM: instead of dragging, open a DIFFERENT project and');
  note('  run read — it should report a project change, not an ordinary window.');
  process.exit(0);
}

const armed = JSON.parse(readFileSync(STATE, 'utf8')) as {
  trackA: number; channelA: string; slot: number;
  contentEpoch: number; sceneEpoch: number; generation: string; project: string;
};
const now = await mark();

// ⚠ FIRST, before anything is scored. A different generation means Bitwig
// restarted between arm and read, and every number below is incomparable rather
// than merely surprising — scoring it would be reading a difference that has no
// meaning (method guard 4: an impossible delta means abort, do not score).
if (now.generation !== armed.generation) {
  console.log('E19 PART B: ABORT — the extension restarted between arm and read.');
  note(`armed in ${armed.generation}, read in ${now.generation}. Re-arm and try again.`);
  process.exit(2);
}

// ⚠ The project check sits BESIDE the generation one, before scoring, and it is
// the more easily missed of the two: a project change leaves the counters
// climbing normally, so every number below would look reasonable and mean
// nothing. If the operator took the optional second arm, this is the PASS.
if (now.project !== armed.project) {
  console.log('E19 PART B: PROJECT CHANGED — this is the second arm, not a failure.');
  note(`armed in ${JSON.stringify(armed.project)}, read in ${JSON.stringify(now.project)}.`);
  note(`⚠ the epochs kept climbing: ${armed.contentEpoch} -> ${now.contentEpoch}, `
    + `same generation. Nothing but the project name separates this from a busy window.`);
  process.exit(0);
}

const events = since(now, armed.contentEpoch);
note(`events since arming: ${JSON.stringify(events)}`);

check('E19-B1: the human drag fired occupancy events at all', events.length > 0, events);
// ⚠ THE PAIR — E16s's finding, re-measured through the durable-identity path.
check('E19-B2: it arrives as a PAIR: one slot emptied, one filled',
  events.some((e) => !e.filled) && events.some((e) => e.filled), events);
check('E19-B3: the SOURCE slot is the one we armed',
  events.some((e) => !e.filled && e.slotIndex === armed.slot), events);
check('E19-B4: every event names the fixture track by durable id',
  events.every((e) => e.channelId === armed.channelA),
  { got: events.map((e) => e.channelId), want: armed.channelA });
// ⚠ THE ASYMMETRY, and the whole reason the content epoch exists: a move changes
// no scene count, so the count observer sits still through an edit that
// invalidates a positional clip address.
check('E19-B5: the SCENE epoch sat still through the move',
  now.sceneEpoch === armed.sceneEpoch, { before: armed.sceneEpoch, after: now.sceneEpoch });

console.log(failureCount() === 0 ? 'E19 PART B: PASS' : `E19 PART B: ${failureCount()} FAILED`);
process.exit(failureCount() === 0 ? 0 : 1);
