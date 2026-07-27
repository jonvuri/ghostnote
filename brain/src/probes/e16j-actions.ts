/**
 * E16j — can a NAMED ACTION create a group track? An independent re-test of D13.
 *
 * ⚠ **The assumption under test is a standing rule.** Rule 6 / D13 says "no named
 * actions, ever", and row E3 leans on it: `createParentTrack` is init-only, so if
 * actions are also out then **only a human can bring a group into existence**, and
 * track-based takes can only ever be plain sibling tracks. That is a load-bearing
 * ○ derived from E6, and this spike has already overturned two conclusions by
 * re-testing them, so it gets one honest re-test on an independent path.
 *
 * ⚠ **Deliberately NOT an extension of `e06*`.** Those probes are the record of
 * the sitting that established D13; re-running them would re-measure E6's own
 * reasoning. This asks the same question with a different instrument, a different
 * target action, and a control E6 did not have.
 *
 * ## What is genuinely new since E6
 *
 * 1. **The target action was never probed.** E6 named `Group`/`Ungroup` as the
 *    no-typed-API residual and tested *neither*. `Create Group Track` ("Add Group
 *    Track") is a **Project** action — the category E6 saw WORK when foregrounded
 *    (`Create Scene`) — and it is the one whose absence actually constrains E16.
 * 2. **E6's blocker 4 ("zero readback") does not hold for this case.** `invoke()`
 *    still returns nothing useful, but a **`track.list` diff** tells us everything:
 *    group creation is *observable* even though the call is mute. E6 generalised
 *    from actions whose effects were hard to see; that generalisation is not
 *    binding here.
 * 3. **A same-category, same-observable POSITIVE CONTROL.** `Create Instrument
 *    Track` is a Project action that makes a *track*, verified by the *same*
 *    `track.list` diff as the target, and it has an exact typed twin
 *    (`track.create` → `application.createInstrumentTrack`) that is already known
 *    to work headless. E6's control was `Create Scene`, a different category of
 *    object read through a different oracle. This one isolates "the action channel
 *    is live right now" from "this particular action does something", which E6
 *    could not do.
 *
 * ## ⚠ How the focus question is asked — and what we will NOT do about it
 *
 * The user's constraint for this sitting: **Bitwig being the frontmost OS app must
 * not be load-bearing, and we will not touch OS-level focus — no `osascript`, no
 * focus detection, no bringing Bitwig up programmatically.** If foreground turns
 * out to be a hard precondition, the answer is to **abandon named actions**, not
 * to build a precondition check around them. (The predecessor handoff proposed
 * exactly such a check; it is declined, and this file is the record of that.)
 *
 * So focus state is established **from inside the experiment**, by the positive
 * control, and never by asking the OS:
 *
 *   - The control is invoked **first and last** in each phase, bracketing the
 *     trials. Two hits ⇒ the action channel was live for the whole window. Two
 *     misses ⇒ it was dead for the whole window.
 *   - `bg` mode therefore **self-validates**: if the control FIRES in a run that
 *     claims to be backgrounded, the run is void and says so, instead of quietly
 *     reporting a foreground result under a background label.
 *   - `fg` mode needs a human to click on Bitwig and leave it there. That is the
 *     human moving their own window, which is not something we automate.
 *
 * ## Running it
 *
 *   npm run probe:e16j -- bg     ← the CONTROL. Run it with Bitwig BEHIND
 *                                  something else (a terminal in front is enough).
 *                                  Needs no TTY and no human.
 *   npm run probe:e16j -- fg     ← run this yourself, then click on Bitwig and
 *                                  leave it frontmost for ~60s. Prints a countdown.
 *
 * ⚠ **Run `bg` FIRST.** Without the negative control a foreground success proves
 * nothing about the mechanism.
 *
 * ## The selection hazard is live (E6's seven orphans)
 *
 * Actions fire against the UI selection, and `cursor.pointTrack` → `selectChannel`
 * *sets* that selection. So every trial deliberately parks the selection on a
 * throwaway track this probe creates (`gn-J`) — never `gn-A`/`gn-B`, never the
 * `gn-E16` fixture — and every trial is followed by a full stray sweep. Nothing is
 * deleted without checking first that it is ours: a new **group** is only removed
 * once the collapse oracle proves every child is disposable, and a vanished
 * baseline track aborts the run rather than being cleaned around.
 *
 * Verified ONLY by `track.list` diff (standing rule 1). `invoke()`'s return value
 * is recorded and believed about *nothing*.
 */
import { client, check, note, failureCount, pollUntil, trackedRequest } from './lib.js';

const req = trackedRequest();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type TrackRow = { index: number; name: string; position: number; type: string; channelId: string };
type Listing = { tracks: TrackRow[]; count: number; itemCount: number; bankSize: number };
type ActionRow = { id: string; name: string; category: string };

const list = async () => (await req('track.list')) as Listing;
const invoke = async (id: string) =>
  (await req('app.invokeAction', { id })) as { resolved: boolean; resolvedName?: string };
const resolve = async (channelId: string) =>
  (await req('track.resolveByChannelId', { channelId })) as
    { found: boolean; index?: number; name?: string; type?: string };
const layout = (l: Listing) =>
  l.tracks.map((t) => `${t.position}:${t.name}${t.type === 'Group' ? '*' : ''}`).join('  ');
const ids = (l: Listing) => new Set(l.tracks.map((t) => t.channelId));

const SUBJECT = 'gn-J';

// ─────────────────────────────────────────────────────────────── window state
/**
 * ⚠ The state label is the HUMAN'S report of where their Bitwig window is, and
 * **nothing in this probe can verify it.** That is deliberate: verifying it means
 * asking the OS, and this sitting rules that out. So the label is recorded
 * verbatim, the trials are reported as fired/missed without presuming a
 * direction, and the honesty of the row rests on the human having read the
 * instruction — which is the same footing as every other ear-row in this spike.
 *
 * "Backgrounded" is NOT one state, and the states are not evidence for each
 * other. `behind` (visible but not focused) is the everyday case; `min` and
 * `space` are the ones that would break an agent silently while the human is
 * doing something else on their machine.
 */
const STATES: Record<string, string> = {
  bg: 'Bitwig visible but BEHIND another window (not frontmost)',
  fg: 'Bitwig FRONTMOST — you click on it and hold it there',
  min: 'Bitwig MINIMISED to the Dock',
  space: 'Bitwig on ANOTHER Space / hidden behind a fullscreen window',
};
const MODE = (process.argv[2] ?? '').toLowerCase();
if (!STATES[MODE]) {
  console.log('usage: npm run probe:e16j -- <state>\n');
  for (const [k, v] of Object.entries(STATES)) console.log(`  ${k.padEnd(6)} ${v}`);
  console.log('\n⚠ run `bg` first — it is the control, and it needs no human.');
  process.exit(2);
}

await client.connect();
console.log(`connected — window state (as reported by you): ${MODE.toUpperCase()} — ${STATES[MODE]}\n`);

// ═══════════════════════════════════════════════ 0. preflight
console.log('-- 0. preflight');

const boot = await list();
note(`bank: count=${boot.count} itemCount=${boot.itemCount} bankSize=${boot.bankSize}`);
// Standing rule 5: a partially-visible project makes every diff below a lie.
if (boot.itemCount !== boot.count) {
  console.log('REFUSING: the bank window does not show the whole project '
    + `(itemCount=${boot.itemCount}, visible=${boot.count}). Every verdict here is a `
    + 'track.list DIFF, and a diff over a partial project cannot tell "created" from '
    + '"scrolled into view".');
  process.exit(1);
}
// Headroom for: the subject, a control track ×2, and a group.
if (boot.bankSize - boot.count < 4) {
  console.log(`REFUSING: only ${boot.bankSize - boot.count} free bank slots; this probe needs 4.`);
  process.exit(1);
}

/**
 * Resolve every action id LIVE (standing rule 1) — the handoff lists them, and a
 * document is not the API. Category comes from Bitwig, not from our expectations.
 */
const all = (await req('app.actions')) as { actions: ActionRow[]; total: number };
const byId = new Map(all.actions.map((a) => [a.id, a]));
const WANT = {
  control: 'Create Instrument Track',   // Project — the positive control
  target: 'Create Group Track',         // Project — the thing we actually want
  wrap: 'Group',                        // Editing — ⚠ acts on the selection
  focusTracks: 'focus_track_header_area', // Panel Management — the E6 diag4 precedent
} as const;
note(`${all.total} actions enumerated`);
let missing = false;
for (const [role, id] of Object.entries(WANT)) {
  const a = byId.get(id);
  if (!a) { missing = true; console.log(`      MISSING action id for ${role}: "${id}"`); continue; }
  note(`${role.padEnd(12)} "${a.id}" — ${a.name} [${a.category}]`);
}
check('every action id this probe needs resolves live (not taken from the handoff)', !missing);
if (missing) process.exit(1);
// The whole design of the control rests on it sharing a category with the target.
check('⚠ the positive control shares the target\'s CATEGORY (else it controls for nothing)',
  byId.get(WANT.control)!.category === byId.get(WANT.target)!.category,
  { control: byId.get(WANT.control)!.category, target: byId.get(WANT.target)!.category });

/** Every group expanded, so `found:false` can only ever mean DELETED (trap 12). */
async function expandAllGroups(): Promise<void> {
  for (const g of (await list()).tracks.filter((t) => t.type === 'Group')) {
    const r = await resolve(g.channelId);
    if (r.found) await req('branch.setMixer', { trackIndex: r.index, groupExpanded: true });
  }
  await wait(600);
}
await expandAllGroups();

/**
 * A throwaway subject the actions are allowed to eat.
 *
 * ⚠ Not `gn-A`/`gn-B`: `Group` wraps the selection and a wrapping group can only
 * be removed by a delete that CASCADES to its children (E3), so the selected
 * track has to be one whose loss costs nothing. `gn-J` exists only for this probe.
 */
async function ensureSubject(): Promise<string> {
  const found = (await list()).tracks.find((t) => t.name === SUBJECT && t.type === 'Instrument');
  if (found) return found.channelId;
  const before = await list();
  await req('track.create', { position: before.count });
  const grew = await pollUntil(async () => (await list()).count === before.count + 1, 6000, 150);
  if (!grew.ok) throw new Error(`creating ${SUBJECT} did not settle`);
  const after = await list();
  const fresh = after.tracks.find((t) => !ids(before).has(t.channelId));
  if (!fresh) throw new Error(`created ${SUBJECT} but could not identify it by channelId`);
  await req('track.setName', { trackIndex: fresh.index, name: SUBJECT });
  await pollUntil(async () =>
    (await list()).tracks.some((t) => t.channelId === fresh.channelId && t.name === SUBJECT), 4000, 150);
  // ⚠ The subject needs a CLIP, purely so the selection guard can read it back —
  // see `selectSubject`. Never launched, so it never makes a sound.
  const at = await resolve(fresh.channelId);
  if (at.found) {
    await req('clip.create', { trackIndex: at.index, slotIndex: 0, lengthBeats: 4 });
    await pollUntil(async () =>
      ((await req('slot.status', { trackIndex: (await resolve(fresh.channelId)).index, slotIndex: 0 })) as
        { hasContent: boolean }).hasContent, 4000, 150);
  }
  return fresh.channelId;
}
let subjectId = await ensureSubject();
note(`subject: ${SUBJECT} = ${subjectId}`);

/**
 * `protectedIds` is what must survive the run. `disposable` is what we are allowed
 * to destroy — the subject, plus anything that appears while we are invoking
 * things. Nothing is ever deleted unless it is in `disposable`.
 */
const baseline = await list();
const protectedIds = new Set([...ids(baseline)].filter((c) => c !== subjectId));
const disposable = new Set<string>([subjectId]);
note(`baseline: ${layout(baseline)}`);
note(`protected: ${protectedIds.size} tracks; disposable: ${SUBJECT}`);

// ═══════════════════════════════════════════════ helpers: selection, diff, cleanup

/**
 * Park the UI selection on the subject, and prove the cursor got there.
 *
 * ⚠ **Two dead ends here, both of which produced a false alarm on the first run
 * of this probe** — the guard shouted "could not park the selection" on every
 * trial while the selection was demonstrably right (`Group` wrapped exactly
 * `gn-J`, twice). A guard that cries wolf is worse than no guard, so:
 *
 *  - `cursor.status.trackName` is built from `clip.getTrack()` — the CLIP
 *    cursor's track. On a freshly created track with no clips it reads `""` with
 *    `trackExists:false`, forever. That is why the subject is given a clip below.
 *  - `cursor.status.cursorTrackPosition` reads `CursorTrack.position()`, which is
 *    ⚠ **a different coordinate system from the flat bank's `Track.position()`**.
 *    Measured: a fresh track reported `position:8` in `track.list` and
 *    `cursorTrackPosition:7`, because the flat bank counts `gn-E16` (nested
 *    inside `Group 7`) as its own row and the cursor's ordinal does not. The two
 *    agree only for tracks that sit before every group with children, which is
 *    exactly how such a comparison survives testing and then breaks in the field.
 *    Standing rule 2 in miniature: these are ordinals, so do not compare them.
 *
 * What is left is the name, read through a clip the subject actually has.
 */
async function selectSubject(): Promise<boolean> {
  const r = await resolve(subjectId);
  if (!r.found) return false;
  await req('cursor.pinTrack', { cursor: 0, pinned: false });
  await req('cursor.pointTrack', { cursor: '0', trackIndex: r.index });
  const ok = await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackName?: string; trackExists?: boolean };
    return s.trackExists === true && s.trackName === SUBJECT;
  }, 3000, 150);
  return ok.ok;
}

/** Which channelIds leave the bank when this group folds — i.e. its children. */
async function childrenOf(channelId: string): Promise<string[]> {
  const open = await resolve(channelId);
  if (!open.found) return [];
  const before = ids(await list());
  await req('branch.setMixer', { trackIndex: open.index, groupExpanded: false });
  await wait(1500);
  const folded = ids(await list());
  const shut = await resolve(channelId);
  if (shut.found) await req('branch.setMixer', { trackIndex: shut.index, groupExpanded: true });
  await wait(1500);
  return [...before].filter((c) => c !== channelId && !folded.has(c));
}

async function deleteById(channelId: string): Promise<boolean> {
  const r = await resolve(channelId);
  if (!r.found) return true;
  await req('track.delete', { trackIndex: r.index });
  // Trap 10: POLL, never a fixed wait — a fixed wait mis-targeted the next delete.
  return (await pollUntil(async () => !(await resolve(channelId)).found, 6000, 150)).ok;
}

let aborted = false;

/**
 * Sweep after EVERY trial, not at the end. E6 accumulated seven orphan duplicates
 * of a fixture before anyone noticed the mechanism, precisely because the check
 * came last.
 */
async function sweep(before: Listing): Promise<{ appeared: TrackRow[]; groups: TrackRow[] }> {
  // A group that is born FOLDED would hide its children, and a hidden child looks
  // exactly like a deleted one (trap 12). Open everything before believing a diff.
  await expandAllGroups();
  const after = await list();
  const beforeIds = ids(before);
  const appeared = after.tracks.filter((t) => !beforeIds.has(t.channelId));
  const vanished = [...beforeIds].filter((c) => !ids(after).has(c));

  for (const t of appeared) disposable.add(t.channelId);

  if (vanished.length > 0) {
    console.log('');
    console.log('!'.repeat(72));
    console.log(' A TRACK DISAPPEARED and it was not hidden by a fold. Stopping here rather');
    console.log(' than cleaning up around it — the sandbox is throwaway but an unexplained');
    console.log(' deletion is a finding, not litter.');
    console.log(`   vanished channelIds: ${vanished.join(', ')}`);
    console.log(`   before: ${layout(before)}`);
    console.log(`   after:  ${layout(after)}`);
    console.log('!'.repeat(72));
    aborted = true;
    return { appeared, groups: [] };
  }

  const groups = appeared.filter((t) => t.type === 'Group');

  // ⚠ Deleting a group CASCADES to its children (E3). Never fire that at anything
  // we did not create.
  for (const g of groups) {
    const kids = await childrenOf(g.channelId);
    const notOurs = kids.filter((c) => !disposable.has(c));
    note(`new group "${g.name}" wraps ${kids.length} track(s)`
      + `${kids.length ? `: ${kids.map((c) => after.tracks.find((t) => t.channelId === c)?.name ?? c).join(', ')}` : ''}`);
    if (notOurs.length > 0) {
      console.log('');
      console.log('!'.repeat(72));
      console.log(` REFUSING TO CLEAN UP: the new group "${g.name}" contains ${notOurs.length}`);
      console.log(' track(s) this probe did not create, and deleting a group cascades.');
      console.log(' Ungroup it by hand in Bitwig (or ⌘Z) before running anything else.');
      console.log(`   not ours: ${notOurs.map((c) => after.tracks.find((t) => t.channelId === c)?.name ?? c).join(', ')}`);
      console.log('!'.repeat(72));
      aborted = true;
      return { appeared, groups };
    }
  }

  // Groups first: the cascade takes their children with them, so the follow-up
  // deletes below simply find those already gone.
  for (const g of groups) await deleteById(g.channelId);
  for (const t of appeared) if (t.type !== 'Group') await deleteById(t.channelId);

  // The subject may have gone down with a group that wrapped it.
  if (!(await resolve(subjectId)).found) {
    disposable.delete(subjectId);
    subjectId = await ensureSubject();
    disposable.add(subjectId);
    note(`${SUBJECT} was consumed by the cleanup and has been recreated`);
  }

  const settled = await list();
  const strays = settled.tracks.filter((t) => !protectedIds.has(t.channelId) && t.channelId !== subjectId);
  if (strays.length > 0) note(`⚠ strays still present: ${strays.map((t) => t.name).join(', ')}`);
  return { appeared, groups };
}

/**
 * One trial: park the selection, invoke, watch `track.list`, sweep.
 *
 * `fired` is decided by the PROJECT, never by `invoke()`'s return — which
 * resolves the action and tells us nothing about whether it did anything.
 */
interface TrialResult { fired: boolean; appeared: TrackRow[]; madeGroup: boolean; resolved: boolean; ms: number }

async function trial(label: string, actionId: string, opts: { expectGroup?: boolean } = {}): Promise<TrialResult> {
  console.log(`\n  · ${label}  → invoke("${actionId}")`);
  const parked = await selectSubject();
  if (!parked) note(`⚠ could not park the selection on ${SUBJECT} — the trial runs anyway, `
    + 'but an Editing action may hit something else');
  const before = await list();
  const beforeIds = ids(before);

  const r = await invoke(actionId);
  const changed = await pollUntil(async () => {
    const now = await list();
    return now.tracks.some((t) => !beforeIds.has(t.channelId));
  }, 4000, 200);

  const after = await list();
  const appeared = after.tracks.filter((t) => !beforeIds.has(t.channelId));
  const madeGroup = appeared.some((t) => t.type === 'Group');
  note(`invoke → ${JSON.stringify(r)}`);
  note(`project → ${appeared.length ? `appeared: ${appeared.map((t) => `${t.name}(${t.type})`).join(', ')} in ${changed.ms}ms` : `NOTHING in ${changed.ms}ms`}`);
  if (opts.expectGroup && appeared.length > 0 && !madeGroup) {
    note('⚠ something appeared but none of it is a Group — read the names above');
  }

  await sweep(before);
  return { fired: appeared.length > 0, appeared, madeGroup, resolved: r.resolved, ms: changed.ms };
}

// ═══════════════════════════════════════════════ 1. hold the window
if (MODE === 'bg') {
  console.log('');
  note('CONTROL RUN — Bitwig visible but not frontmost. Needs no human: running this');
  note('from a terminal already puts something else in front.');
} else {
  console.log('');
  console.log('='.repeat(72));
  console.log(` OVER TO YOU — put Bitwig into this state and LEAVE it there:`);
  console.log('');
  console.log(`   ${STATES[MODE]}`);
  console.log('');
  console.log('   Hold it until this terminal prints "PHASE COMPLETE" (about a minute).');
  console.log('   Nothing here touches OS focus — you move your own window. The probe');
  console.log('   works out afterwards whether the action channel was live, from the');
  console.log('   positive control alone.');
  console.log('='.repeat(72));
  for (let s = 15; s > 0; s--) {
    process.stdout.write(`\r   starting in ${String(s).padStart(2)}s … `);
    await wait(1000);
  }
  console.log('\r   go.                    ');
}

// ═══════════════════════════════════════════════ 2. the trials
console.log(`\n-- 1. trials (${MODE.toUpperCase()})`);

const openCal = await trial(`control OPEN   [${byId.get(WANT.control)!.category}]`, WANT.control);
if (aborted) { console.log('\nABORTED — see above.'); process.exit(1); }

const target = await trial(`TARGET         [${byId.get(WANT.target)!.category}]`, WANT.target, { expectGroup: true });
if (aborted) { console.log('\nABORTED — see above.'); process.exit(1); }

const wrap = await trial(`wrap selection [${byId.get(WANT.wrap)!.category}]`, WANT.wrap, { expectGroup: true });
if (aborted) { console.log('\nABORTED — see above.'); process.exit(1); }

/**
 * ⚠ The panel-focus sub-test, and it is a PREDICTION, not a fishing trip.
 * E6 diag4: an *Editing* action needed panel keyboard focus on top of foreground
 * (`Duplicate` fired only after `focus_or_toggle_clip_launcher`). The handoff
 * predicts a *Project* action should not. Running this only when the target
 * missed while the channel was live is what makes it a test of that prediction
 * rather than a second roll of the dice.
 */
let focusRetryTarget: TrialResult | null = null;
let focusRetryWrap: TrialResult | null = null;
if (openCal.fired && !target.fired) {
  console.log(`\n  · panel-focus retry: invoke("${WANT.focusTracks}") first, then the target again`);
  await invoke(WANT.focusTracks);
  await wait(800);
  focusRetryTarget = await trial('TARGET after panel focus', WANT.target, { expectGroup: true });
  if (aborted) { console.log('\nABORTED — see above.'); process.exit(1); }
}
if (openCal.fired && !wrap.fired) {
  console.log(`\n  · panel-focus retry for the Editing action (E6 diag4's exact shape)`);
  await invoke(WANT.focusTracks);
  await wait(800);
  focusRetryWrap = await trial('wrap after panel focus', WANT.wrap, { expectGroup: true });
  if (aborted) { console.log('\nABORTED — see above.'); process.exit(1); }
}

/**
 * ⚠ E6's OWN INSTRUMENT, re-run unchanged — because this probe disagrees with E6
 * and one of us has to be accounted for.
 *
 * `Create Scene` is the exact action `e06-diag2` invoked backgrounded and scored
 * as a silent no-op, and `e06-diag3` invoked foregrounded and scored as a 9→10
 * scene bump. If it now behaves like `Create Instrument Track`, E6's blocker 1 is
 * simply wrong (or stale) and the whole category is background-live. If it still
 * no-ops while a sibling Project action fires, then the gate was never
 * *foreground* at all — it is per-action, and E6 generalised from a sample of one.
 * Those are very different findings and only this trial separates them.
 *
 * ⚠ Cleaned up by `app.undo`, not `scene.delete`: the scene bank is a 16-row
 * WINDOW over a 99-scene project, so a scene appended at the end is not
 * addressable by `getScene(index)` at all. Verified by re-reading `scene.count`.
 */
const sceneCount = async () => ((await req('scene.count')) as { sceneCount: number }).sceneCount;
console.log('\n  · E6\'s instrument  [Project]  → invoke("Create Scene")  (oracle: scene.count)');
const scenesBefore = await sceneCount();
const sceneInvoke = await invoke('Create Scene');
const sceneGrew = await pollUntil(async () => (await sceneCount()) > scenesBefore, 4000, 200);
const scenesAfter = await sceneCount();
note(`invoke → ${JSON.stringify(sceneInvoke)}`);
note(`scene.count ${scenesBefore} → ${scenesAfter} in ${sceneGrew.ms}ms`);
const sceneFired = scenesAfter > scenesBefore;
if (sceneFired) {
  const undone = (await req('app.undo', { times: scenesAfter - scenesBefore })) as { undosPerformed: number };
  const back = await pollUntil(async () => (await sceneCount()) === scenesBefore, 4000, 200);
  note(`cleanup: ${undone.undosPerformed} undo(s) → scene.count ${await sceneCount()}`
    + `${back.ok ? '' : ' ⚠ NOT restored — a scene is left behind'}`);
}

const closeCal = await trial(`control CLOSE  [${byId.get(WANT.control)!.category}]`, WANT.control);
if (aborted) { console.log('\nABORTED — see above.'); process.exit(1); }

if (MODE !== 'bg') {
  console.log('\n' + '='.repeat(72));
  console.log(' PHASE COMPLETE — you can use your machine normally again.');
  console.log('='.repeat(72));
}

// ═══════════════════════════════════════════════ 3. verdict
console.log('\n-- 2. verdict');

const channelLive = openCal.fired && closeCal.fired;
const channelDead = !openCal.fired && !closeCal.fired;
note(`positive control: open ${openCal.fired ? 'FIRED' : 'missed'}, close ${closeCal.fired ? 'FIRED' : 'missed'}`);

check('the control brackets AGREE, so the focus state held for the whole window '
  + '(one hit and one miss means the human moved mid-run and nothing here is readable)',
  channelLive || channelDead, { openFired: openCal.fired, closeFired: closeCal.fired });

// invoke() resolves regardless — recorded so the "it returned fine" trap stays visible.
check('⚠ `invoke()` resolved every action REGARDLESS of whether anything happened '
  + '(this is E6 blocker 4: the return value is not evidence)',
  openCal.resolved && target.resolved && wrap.resolved,
  { note: 'a resolved action that did nothing is indistinguishable from one that worked, '
    + 'from the return value alone — only the track.list diff separates them' });

/**
 * ⚠ **The report does NOT assert a direction, and that is on purpose.**
 *
 * The first version of this block failed the run when the control fired in `bg`
 * mode, on the assumption that a backgrounded action cannot work — E6's model.
 * It fired, three times out of three, and E6's own instrument fired with it. An
 * assertion that encodes the hypothesis turns a finding into a red X, so what
 * survives here are only checks that are true whichever way the world is:
 * internal consistency, and whether the two instruments agree with each other.
 * The direction is REPORTED, and it is written up by a human.
 */
const row = (label: string, fired: boolean, detail: string) =>
  note(`  ${fired ? 'FIRED ' : 'missed'}  ${label.padEnd(30)} ${detail}`);
note('');
note(`window state (your report, unverifiable here): ${MODE.toUpperCase()} — ${STATES[MODE]}`);
note('');
row('Create Instrument Track  open', openCal.fired, `[Project] ${openCal.appeared.map((t) => t.name).join(',') || '—'}`);
row('Create Group Track', target.fired, `[Project] ${target.madeGroup ? 'made a GROUP' : target.appeared.map((t) => t.name).join(',') || '—'}`);
row('Group (wrap selection)', wrap.fired, `[Editing] ${wrap.madeGroup ? 'made a GROUP' : wrap.appeared.map((t) => t.name).join(',') || '—'}`);
row('Create Scene  (E6 diag2/3)', sceneFired, `[Project] scene.count ${scenesBefore}→${scenesAfter}`);
row('Create Instrument Track close', closeCal.fired, `[Project] ${closeCal.appeared.map((t) => t.name).join(',') || '—'}`);

check('⚠ E6\'s own instrument and this probe\'s control AGREE — so whatever gates '
  + 'actions is a property of the STATE, not of the individual action (if they '
  + 'disagreed, E6 generalised from a sample of one)',
  sceneFired === openCal.fired,
  { createScene: sceneFired, createInstrumentTrack: openCal.fired });

check('the Editing action tracks the Project actions, so E6 blocker 2 (Editing '
  + 'actions need panel keyboard focus ON TOP of foreground) does not bite here',
  wrap.fired === openCal.fired,
  { editingGroup: wrap.fired, projectControl: openCal.fired,
    note: 'no focus action was invoked before it — `Group` acted on the track selection '
      + '`cursor.pointTrack` had just set, which is E6\'s hazard working as documented' });

if (focusRetryTarget) {
  check('the handoff\'s PREDICTION — a Project action should not need panel keyboard '
    + 'focus, so the retry should not rescue it',
    !focusRetryTarget.madeGroup,
    { note: 'if the retry DID rescue it, Project actions are focus-gated too' });
}

note('');
if (channelLive && target.madeGroup) {
  note(`⇒ in state ${MODE.toUpperCase()}, a named action CREATES A GROUP TRACK.`);
  note('  Row E3\'s "only a human can make a group" was true of the TYPED api only.');
  note('  ⚠ This does not make it usable — that turns on standing rule 6 / D13, and');
  note('  on whether every window state behaves alike. Both are the user\'s call.');
} else if (channelDead) {
  note(`⇒ in state ${MODE.toUpperCase()}, the action channel is DEAD — nothing fired,`);
  note('  while typed calls worked on the identical project moments earlier.');
}

// ═══════════════════════════════════════════════ 4. leave the project as we found it
console.log('\n-- 3. cleanup');
await deleteById(subjectId);
await expandAllGroups();
const final = await list();
const leftover = final.tracks.filter((t) => !protectedIds.has(t.channelId));
check('the project is back to its baseline — nothing this probe made survives it',
  leftover.length === 0 && [...protectedIds].every((c) => ids(final).has(c)),
  { leftover: leftover.map((t) => t.name), missing: [...protectedIds].filter((c) => !ids(final).has(c)) });
note(`final: ${layout(final)}`);

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
