/**
 * E14 — the in-Bitwig UI probe, rows A–G.
 *
 * PHASE-0 §Scope item 5, exit criterion 3. D4 put the entire §8g privilege
 * separation and the A/B take workflow on the Studio I/O panel, and marked the
 * whole claim ◐ doc-only. Standing rule 10: nothing is banked until probed.
 *
 * ⚠ D4 names the wrong panel — Bitwig 5.0 moved the per-controller surface to a
 * pane on the top-right controller icons and renamed the old one. See the note at
 * the head of the INTERACTIVE section; it cost a sitting to discover.
 *
 * ⚠ Reading the javadoc before writing this changed three rows. Recorded here
 * because the probe is now shaped around the corrections, and a reader comparing
 * it to PHASE-0-SESSION-2.md's table will otherwise wonder why:
 *
 *   C. `Setting` — the interface owning show/hide/enable/disable — is an ORPHAN.
 *      Nothing in the published API returns it, extends it or links to it, and
 *      `getEnumSetting` returns `SettableEnumValue`, which does not declare it as
 *      a supertype. So row C is not "does reflow work"; it is first "does the
 *      undocumented downcast succeed at all", and reflow is a follow-up question
 *      that only gets asked if it does.
 *   F. `NotificationSettings`' own javadoc says "By default all notifications are
 *      disabled", and its `setShouldShow*` methods govern notifications the
 *      CONTROLLER requests. Turning off something already off cannot suppress
 *      E1's spray. The plausible lever is `getUserNotificationsEnabled()`, so the
 *      row tests that, and tests the documented one as the control.
 *   G. `deleteObjects`/`duplicateObjects` are on `ControllerHost`, not
 *      `Application`, and their ENTIRE javadoc is "It will delete multiple object
 *      within one undo step" — nothing at all about what `undoName` does. So the
 *      count is measured programmatically and the name has to be read off
 *      Bitwig's history by eye.
 *
 * Sequenced automated-first so the unattended half is done before the human is
 * needed, per PHASE-0-FOUNDATION's method note. The persistence half of row A
 * lives in `e14-verify.ts`, because it needs a save + reopen in between.
 *
 *   npm run probe:e14
 *
 * ⚠ Requires the E14 build: `cd extension && ./gradlew copyExtension`, then
 * `npm run probe:hello` to confirm the deployment matches the golden.
 * ⚠ Writes clips into gn-A scenes 2–4 for row G and deletes them again. The
 * fixture clips at scenes 0/1 are not touched.
 */
import {
  client, check, note, failureCount, pollUntil, ask, askYesNo, waitForEnter,
  ensureFixtureTracks,
} from './lib.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SETTLE = 400;

/**
 * ⚠ Added after row A1 killed Bitwig mid-run and the probe died with a bare
 * `Connection closed with request 17 in flight` — true, but it buried the
 * finding under a stack trace and said nothing about which call had done it.
 *
 * A probe of ◐ doc-only surface should expect to find a fatal one, so a dropped
 * connection is a RESULT here, not an accident. This turns it into a legible one
 * and names the suspect.
 */
let lastMethod = '(none yet)';
const request = async (method: string, params?: Record<string, unknown>): Promise<unknown> => {
  lastMethod = method;
  return client.request(method, params);
};
for (const signal of ['uncaughtException', 'unhandledRejection'] as const) {
  process.on(signal, (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Connection closed') || message.includes('ECONNREFUSED')) {
      console.log(`\n${'!'.repeat(72)}`);
      console.log(` THE BRIDGE DIED during "${lastMethod}".`);
      console.log('');
      console.log(' Something in that call took the extension — or Bitwig — down. That is');
      console.log(' a finding, not a bug in the probe: check whether Bitwig is still');
      console.log(' running, then read the crash report at');
      console.log('   ~/Library/Application Support/Bitwig/Bitwig Studio/crash-report/');
      console.log(' Record the verdict for that row and do NOT simply re-run the call.');
      console.log('!'.repeat(72));
    } else {
      console.log(`\nunexpected failure after "${lastMethod}": ${message}`);
    }
    process.exit(1);
  });
}

type Status = Record<string, unknown> & {
  available: boolean;
  error?: string;
  revertFires: number;
  takeValue: string;
  takeChanges: number;
  statusValue: string;
  statusChanges: number;
  statusUserEdited: boolean;
  settingCount: number;
  slotCount: number;
  settingCastWorks: { signal: boolean; enum: boolean; string: boolean };
};

const status = async (): Promise<Status> => (await request('ui.status')) as Status;

const banner = (title: string) => {
  console.log(`\n${'='.repeat(72)}`);
  console.log(` ${title}`);
  console.log('='.repeat(72));
};

// ---------------------------------------------------------------- setup

const { trackA } = await ensureFixtureTracks();
note(`fixtures: gn-A=${trackA}`);

const hello = (await request('contract.hello')) as { methodsHash: string; methodCount: number };
note(`extension: ${hello.methodCount} wire methods, hash ${hello.methodsHash}`);
// ⚠ This was an EXACT `methodsHash` pin — c251f81240b78a42, then 5343039c7fe670cc
// once `ui.signalFire` was DELETED after row A1 crashed Bitwig. It broke the moment
// rows H/I added seven more wire methods, and it would have broken on every
// legitimate addition after that: a hard `process.exit(1)` before any row ran.
//
// That is the wrong trade. These probes are the live regression suite (see
// `wiremap.ts` — the whole reason no wire method is ever renamed), and a suite
// that stops running is worth nothing. So the check now asserts what the hash was
// only ever a PROXY for: that the deployed extension does not carry the method
// that killed Bitwig, and does carry the surface rows A–G drive. Neither drifts
// when the wire grows.
const registered = (await request('rig.methods')) as { methods: string[]; count: number };
const hasForbidden = registered.methods.includes('ui.signalFire');
check('the deployed extension does NOT carry ui.signalFire (E14-A1, WIRE_METHODS_FORBIDDEN)',
  !hasForbidden, { methodCount: registered.count, hash: hello.methodsHash });
if (hasForbidden) {
  console.log('\n⚠ STOP — and do not run any row below. That deployment predates the A1');
  console.log('  finding and still registers a method that crashes Bitwig UNCATCHABLY,');
  console.log('  from Bitwig\'s own thread, with whatever is unsaved. Redeploy first:');
  console.log('  cd extension && ./gradlew copyExtension');
  client.disconnect();
  process.exit(1);
}
const missing = ['ui.status', 'ui.set', 'ui.visibility', 'ui.addSetting', 'ui.notifications',
  'ui.showInEditor', 'ui.panelLayout', 'ui.deleteObjects', 'ui.duplicateObjects']
  .filter((m) => !registered.methods.includes(m));
check('the deployed extension carries the rows A–G wire surface', missing.length === 0, { missing });
if (missing.length > 0) {
  console.log('\nStale extension. Rebuild and redeploy before continuing:');
  console.log('  cd extension && ./gradlew copyExtension');
  client.disconnect();
  process.exit(1);
}

// ⚠ Asked before anything else, and it is not boilerplate caution. Row A1
// crashed Bitwig outright with an unsaved project open, and it did so through a
// call whose javadoc gave no hint — `Signal.fire()` threw on Bitwig's own thread,
// where the handler's try/catch could not reach it. Several rows below drive
// surface that is equally ◐ doc-only and equally untested: `deleteObjects`,
// `duplicateObjects`, `showInEditor`, `setPanelLayout`. Any of them could do the
// same, and a save costs nothing next to re-doing the sitting.
await waitForEnter('SAVE THE PROJECT IN BITWIG NOW (Cmd-S).\n'
  + '     Row A1 of this probe crashed Bitwig once already, from a call the javadoc\n'
  + '     did not warn about. Several rows below are just as unproven.');

const first = await status();
if (!first.available) {
  // The E7-Finding-0 hazard, realised. Nothing below can mean anything.
  check('the UI panel built at init', false, { error: first.error });
  console.log('\nE14: the panel failed to construct — no row can be probed. Aborting.');
  client.disconnect();
  process.exit(1);
}
check('the UI panel built at init without taking the extension down', true,
  { settings: first.settingCount, slots: first.slotCount, micros: first.constructMicros });

// ================================================================ AUTOMATED

banner('AUTOMATED — no interaction needed yet');

// ---------------------------------------------------------------- row C (part 1)

console.log('\n-- C1. is a settings value object also a `Setting`? (the orphan-interface question)');
note(`cast results: ${JSON.stringify(first.settingCastWorks)}`);
const castWorks = first.settingCastWorks.enum && first.settingCastWorks.string && first.settingCastWorks.signal;
// ⚠ NOT asserted as a pass/fail expectation — this is a measurement, and ○ is a
// legitimate answer that changes D4's UI story rather than failing the probe.
// The javadoc actively predicts ○: `Setting` has no declared relationship to any
// of these types. A ● here means Bitwig's implementation classes provide it
// anyway, which is worth knowing precisely because it is undocumented.
note(castWorks
  ? 'VERDICT C1: ● the downcast works on all three kinds — runtime show/hide is reachable'
  : 'VERDICT C1: ○ the downcast FAILS — there is no runtime show/hide, and pre-allocated'
    + ' take slots would be a fixed wall of rows');

if (castWorks) {
  const hidden = await request('ui.visibility', { setting: 'slot:0', action: 'hide' });
  note(`hide slot:0 -> ${JSON.stringify(hidden)}`);
  const disabled = await request('ui.visibility', { setting: 'slot:1', action: 'disable' });
  note(`disable slot:1 -> ${JSON.stringify(disabled)}`);
}

// ---------------------------------------------------------------- row C (part 2)

console.log('\n-- C2. can a setting be created AFTER init?');
// No javadoc forbids it and none permits it. It matters a lot: if settings can
// be added on demand, the pre-allocation idiom (§3a, third occurrence) is
// unnecessary for takes and D4's UI gets simpler.
const late = (await request('ui.addSetting', { label: 'Late probe' })) as { accepted: boolean; error?: string };
note(`ui.addSetting -> ${JSON.stringify(late)}`);
note(late.accepted
  ? 'the call did not throw — whether a ROW APPEARED is a question for the human below'
  : `refused: ${late.error}`);

// ---------------------------------------------------------------- row B (push)

console.log('\n-- B1. can the EXTENSION write the enum (push), not just observe it?');
// The half that decides whether an A/B take switcher can stay in sync with the
// take store. An observable-but-unwritable chooser drifts the moment anything
// other than a click changes the current take.
const beforePush = await status();
// ⚠ Must differ from whatever is already there, or the observer never fires and
// the check fails for the wrong reason. It failed exactly that way on the first
// real run: the setting still read "C" from a PREVIOUS session, so pushing "C"
// was a no-op. That is itself a small piece of evidence for row A3 — document
// state survived a Bitwig restart — but as a B1 assertion it was meaningless.
const target = beforePush.takeValue === 'C' ? 'A' : 'C';
await request('ui.set', { setting: 'take', value: target });
await sleep(SETTLE);
const afterPush = await status();
note(`take: "${beforePush.takeValue}" -> "${afterPush.takeValue}" (changes ${beforePush.takeChanges} -> ${afterPush.takeChanges})`);
check('VERDICT B1: the extension can SET the enum setting and observes its own write',
  afterPush.takeValue === target && afterPush.takeChanges > beforePush.takeChanges,
  { pushed: target, value: afterPush.takeValue, changes: afterPush.takeChanges });

// ---------------------------------------------------------------- row D (push)

console.log('\n-- D1. can a String setting carry a status readout?');
const marker = `written ${new Date().toISOString().slice(11, 19)}`;
await request('ui.set', { setting: 'status', value: marker });
await sleep(SETTLE);
const afterStatus = await status();
note(`status: "${afterStatus.statusValue}" userEdited=${afterStatus.statusUserEdited}`);
check('VERDICT D1: the extension can push text into the status display',
  afterStatus.statusValue === marker, { got: afterStatus.statusValue, want: marker });
// There is no read-only String setting, so the risk is not that we cannot write
// it — it is that the user can, and we would not know. `statusUserEdited`
// compares the observed value against the last one we pushed, which is the only
// mechanism available.
check('a push does not read back as a user edit (so a real edit is distinguishable)',
  afterStatus.statusUserEdited === false, { userEdited: afterStatus.statusUserEdited });

// ---------------------------------------------------------------- row A (privilege)

console.log('\n-- A1. can the EXTENSION press the human\'s revert button? (D4 / §8g)');
// ⚠ ALREADY ANSWERED — 2026-07-25 — AND THE MEASUREMENT MUST NOT BE REPEATED.
//
// This section used to call a `ui.signalFire` wire method. It ran once and
// CRASHED BITWIG, with an unsaved project open:
//
//     java.lang.IllegalStateException: This signal cannot be invoked
//       at com.bitwig.flt.control_surface.values.SignalProxy.doFire
//       at com.bitwig.flt.control_surface.proxy.ControlSurfaceObject$1.run
//       at com.bitwig.flt.app.BitwigStudioMain.main
//
// VERDICT A1 ○, and it STRENGTHENS D4 rather than weakening it: Bitwig refuses to
// let anything but a real click fire a `getDocumentState()` signal, so the agent
// cannot press the human's revert button even in principle. §8g's separation is
// structural after all — enforced by Bitwig, not by our restraint.
//
// The second half of the finding is the one with reach: the refusal arrives
// ASYNCHRONOUSLY, on Bitwig's own main thread, inside a runnable deferred from
// the call. The handler returned normally and its try/catch saw nothing. So a
// handler's try/catch is NOT a safety net for anything Bitwig defers — the only
// mechanism that works is validating arguments before calling, which is what
// `UiHandlers` now does throughout.
//
// The method is deleted, not banned: `WIRE_METHODS_FORBIDDEN` and two tests in
// `wiremap.test.ts` assert it is not registered anywhere.
note('VERDICT A1: ○ banked 2026-07-25 — Signal.fire() is REFUSED, and the refusal');
note('            crashes Bitwig from its own thread. D4 is stronger than claimed:');
note('            only a real human click can fire the button. NOT re-probed here.');

// ---------------------------------------------------------------- row G

console.log('\n-- G1. does deleteObjects(undoName, …) collapse to ONE undo entry?');
// E3 said "no grouping hook in the API"; D4 flagged that as too strong. This is
// the count half — the NAME needs eyes on Bitwig's history, below.
const SCENES = [2, 3, 4];
const hasContent = async (slotIndex: number) =>
  ((await request('slot.status', { trackIndex: trackA, slotIndex })) as { hasContent: boolean }).hasContent;

for (const slotIndex of SCENES) {
  if (!(await hasContent(slotIndex))) {
    await request('clip.create', { trackIndex: trackA, slotIndex, lengthBeats: 4 });
    await pollUntil(() => hasContent(slotIndex));
  }
}
note(`created clips at gn-A scenes ${SCENES.join(', ')}`);
await sleep(SETTLE);

await request('ui.deleteObjects', {
  undoName: 'ghostnote E14 batch delete',
  targets: SCENES.map((slotIndex) => ({ trackIndex: trackA, slotIndex })),
});
await sleep(SETTLE);
const goneAfterDelete = [];
for (const slotIndex of SCENES) goneAfterDelete.push(!(await hasContent(slotIndex)));
check('all three clips were deleted by one deleteObjects call',
  goneAfterDelete.every(Boolean), { gone: goneAfterDelete });

// ⚠ `app.undo` is a BANNED wire method for the contract (E3) and legal here:
// the probes that established a ban are exactly what keeps it honest, and this
// one is measuring the ban's own boundary.
await request('app.undo', { times: 1 });
await sleep(SETTLE);
const backAfterOneUndo = [];
for (const slotIndex of SCENES) backAfterOneUndo.push(await hasContent(slotIndex));
note(`after ONE undo: ${JSON.stringify(backAfterOneUndo)}`);
check('VERDICT G1: ONE undo restores all three — the delete really was one step',
  backAfterOneUndo.every(Boolean), { restored: backAfterOneUndo });

if (!backAfterOneUndo.every(Boolean)) {
  // Restore the fixture state before anything else runs, whatever happened.
  for (let i = 0; i < 4; i++) {
    if ((await Promise.all(SCENES.map(hasContent))).every(Boolean)) break;
    await request('app.undo', { times: 1 });
    await sleep(SETTLE);
  }
}

// ================================================================ INTERACTIVE

banner('INTERACTIVE — Bitwig needs to be in front of you now');
// ⚠ D4 SAYS THE WRONG PLACE, and this cost one sitting before it was caught.
// D4 (and PHASE-0-SESSION-2's row table) locate the human surface in "Bitwig's
// Studio I/O panel", which is where `getDocumentState()` settings appeared up to
// Bitwig 4.x — the connected controllers were listed there, each with a
// disclosure triangle that opened its settings.
//
// Bitwig 5.0 moved it. From the 5.0 release notes: "Each controller connected is
// now shown with icons in the top right of the application window; clicking any
// icon opens a pane with access to: the controller's help and system-level
// settings … the Track / Device navigation and pinning options (previously in the
// Studio I/O Panel, which is now called the Output Monitoring Panel)".
//
// So the old panel still exists under a new name — 6.0.6 labels it "Studio
// Monitoring Panel" — but it no longer lists controllers at all. Both locations
// are asked about below, because "the old one is empty" is part of the finding
// and not just a wrong turn.
console.log(' The settings are NOT in the Studio/Output Monitoring Panel any more,');
console.log(' whatever D4 says — Bitwig 5.0 moved the per-controller surface.');
console.log('');
console.log('   Look at the TOP-RIGHT CORNER of the Bitwig window for a row of');
console.log('   controller icons, and click the ghostnote one. That opens the');
console.log('   controller pane, which is where its settings now live.');
console.log('');
console.log(` You are looking for categories: Takes, Enum shape, Status, Take slots (${first.slotCount} rows).`);

const where = await ask(
  'Where can you see the ghostnote settings? Answer "pane" (the top-right controller'
  + ' pane), "panel" (the Studio/Output Monitoring Panel), "both", or "nowhere".');
const w = where.toLowerCase();
const panelVisible = w.startsWith('pane') || w.startsWith('both') || w.startsWith('panel');
note(`VERDICT (location, user-reported): the document-state settings appear in "${where}"`);
// Recorded as a location finding, not just a precondition: it is a correction to
// D4, and Phase 1's control layer is designed against whichever answer this is.
check('VERDICT (precondition): the document-state settings are VISIBLE somewhere (D4)',
  panelVisible, { reportedLocation: where });

if (!panelVisible) {
  console.log('\nNothing below can be observed. Stopping so the rows stay ○ rather than wrong.');
  console.log('If they are nowhere at all, that is a hard ○ on D4 and Phase 1 needs');
  console.log('the Phase-3 web UI pulled forward — which PHASE-0 §Risks already');
  console.log('names as the fallback, and calls a reordering rather than a redesign.');
  client.disconnect();
  process.exit(1);
}

// The usability question the move creates, and it is load-bearing for D4. A
// docked panel can sit open beside your work; a pop-over pane triggered by an
// icon may close the moment you click elsewhere — which would make it a poor home
// for an A/B take switcher you are supposed to reach for constantly.
const persistence = await ask(
  'Does that surface STAY open while you work in Bitwig (click a clip, edit a note),'
  + ' or does it close as soon as you click away? Say "stays" or "closes".');
note(`VERDICT (persistence, user-reported): the surface ${persistence}`);
check('the human surface can stay visible while the user works (D4\'s take switcher)',
  persistence.toLowerCase().startsWith('stay'), { reported: persistence });

// ---------------------------------------------------------------- row A

console.log('\n-- A2. does a Signal button fire a callback when a HUMAN clicks it?');
const beforeClick = (await status()).revertFires;
await waitForEnter('Click the "Revert" button in the Takes category. Click it TWICE.');
const afterClick = (await status()).revertFires;
note(`revertFires: ${beforeClick} -> ${afterClick}`);
check('VERDICT A2: a Signal setting renders as a button and fires its observer on click',
  afterClick >= beforeClick + 2, { before: beforeClick, after: afterClick });

// ---------------------------------------------------------------- row B

console.log('\n-- B2. does an Enum render as a BUTTON GROUP, and where is the cutoff?');
console.log('   The "Enum shape" category holds one setting per option count:');
console.log('   2, 3, 4, 6, 8, 12 options. Look at how each is drawn.');
const groupCutoff = await ask(
  'Up to how many options is it drawn as a BUTTON GROUP rather than a dropdown?'
  + ' (a number, or "none" if they are all dropdowns)');
note(`VERDICT B2 (user-reported): button group up to ${groupCutoff} options`);
check('an Enum renders as a button group at SOME small option count (D4\'s A/B switcher)',
  groupCutoff.toLowerCase() !== 'none' && groupCutoff !== '',
  { reportedCutoff: groupCutoff });

const beforeTake = await status();
await waitForEnter(`Now click a DIFFERENT value on the "Take" chooser (it currently reads ${beforeTake.takeValue}).`);
const afterTake = await status();
note(`take: "${beforeTake.takeValue}" -> "${afterTake.takeValue}" (changes +${afterTake.takeChanges - beforeTake.takeChanges})`);
check('VERDICT B3: the extension OBSERVES a human changing the enum (pull)',
  afterTake.takeChanges > beforeTake.takeChanges && afterTake.takeValue !== beforeTake.takeValue,
  { from: beforeTake.takeValue, to: afterTake.takeValue });

// ---------------------------------------------------------------- row C

console.log('\n-- C3. does show/hide/enable/disable reflow the panel LIVE?');
if (!castWorks) {
  note('SKIPPED: the Setting downcast failed, so there is nothing to call. Row C is ○.');
} else {
  const slot0Hidden = await askYesNo('Is "Slot 1" MISSING from the Take slots category (it was hidden earlier)?');
  const slot1Disabled = await askYesNo('Is "Slot 2" present but GREYED OUT / uneditable?');
  check('VERDICT C3a: hide() removes a setting from the live panel', slot0Hidden, { reportedByUser: slot0Hidden });
  check('VERDICT C3b: disable() greys a setting out without removing it', slot1Disabled, { reportedByUser: slot1Disabled });

  await request('ui.visibility', { setting: 'slot:0', action: 'show' });
  await request('ui.visibility', { setting: 'slot:1', action: 'enable' });
  await sleep(SETTLE);
  const restored = await askYesNo('Did "Slot 1" REAPPEAR and "Slot 2" become editable again, without you touching anything?');
  check('VERDICT C3c: the panel reflows live, with no reopen and no project reload',
    restored, { reportedByUser: restored });
}

console.log(`\n-- C4. is the panel usable at ${first.slotCount} slots?`);
const usability = await ask(
  `With ${first.slotCount} slot rows plus the rest, how usable is the panel?`
  + ' (say: fine / cramped / unusable — and roughly how many rows fit without scrolling)');
note(`VERDICT C4 (user-reported) at uiSlots=${first.slotCount}: ${usability}`);
note('To sweep this: set "uiSlots" in ~/.ghostnote/rig.json, `touch` the deployed'
  + ' .bwextension to force a reload, and re-run. That is the E5 loop.');

// ⚠ Row C2's answer is ○, and the assertion is written so that ○ reads as a
// PASS. The first run reported it as a failure, which was misleading: "settings
// cannot be created after init" is the finding, and it arrives as a clean,
// synchronous, catchable refusal — "This can only be called during driver
// initialization". A silent no-op would have been the bad outcome, and that is
// what this actually checks for.
//
// The consequence is that pre-allocation is REQUIRED, not merely tidy: take slots
// have to exist at init and be revealed with `show()`, which is the §3a idiom on
// its third occurrence and now the only option rather than a preference.
if (late.accepted) {
  const lateAppeared = await askYesNo(
    'Is there a "Late" category with a "Late probe" row that appeared WITHOUT a reload?');
  check('VERDICT C2: ● a setting created after init appears in the panel', lateAppeared,
    { callAccepted: true, rowAppeared: lateAppeared });
} else {
  check('VERDICT C2: ○ settings are init-only, and say so LOUDLY rather than no-op',
    (late.error ?? '').toLowerCase().includes('initialization'),
    { refusedWith: late.error });
  note('⇒ pre-allocated take slots are mandatory, not a style choice: the panel must');
  note('  be built at init and revealed with show()/hide() (row C3 confirms that works).');
}

// ---------------------------------------------------------------- row D

console.log('\n-- D2. is a user-editable String setting survivable as a status display?');
await waitForEnter('Type something into the "Last change" field in the Status category.');
const edited = await status();
note(`status now "${edited.statusValue}", userEdited=${edited.statusUserEdited}`);
check('VERDICT D2: the extension can TELL that the user edited the status readout',
  edited.statusUserEdited === true && edited.statusValue !== marker,
  { value: edited.statusValue, userEdited: edited.statusUserEdited });
// Whether we can repair it is the other half: a status display the user can
// break and we cannot fix is worse than no status display.
await request('ui.set', { setting: 'status', value: marker });
await sleep(SETTLE);
const repaired = await status();
check('and can overwrite it again afterwards (the readout is repairable)',
  repaired.statusValue === marker, { got: repaired.statusValue });

// ---------------------------------------------------------------- row E

console.log('\n-- E. does showInEditor() actually navigate the user to a clip?');
console.log('   Three different API calls, deliberately tried one at a time:');
console.log('   ClipLauncherSlot.showInEditor (API 10), ClipLauncherSlotBank.showInEditor(int)');
console.log('   (API 1), and Clip.showInEditor (API 18).');
await waitForEnter('First, click some OTHER clip in Bitwig so we can see the navigation happen.');

const routes: Record<string, boolean> = {};
for (const via of ['slot', 'bank', 'clip'] as const) {
  if (via === 'clip') {
    // Clip.showInEditor acts on whatever the pool cursor holds, so point it
    // first — which is also the realistic shape: we show what we just wrote.
    await request('cursor.pointTrack', { cursor: '0', trackIndex: trackA });
    await request('slot.select', { trackIndex: trackA, slotIndex: 0, mechanism: 'track' });
    await sleep(SETTLE);
  }
  await request('ui.showInEditor', { trackIndex: trackA, slotIndex: 0, via });
  await sleep(SETTLE);
  routes[via] = await askYesNo(`via "${via}": did the detail editor move to gn-A scene 0?`);
  if (via !== 'clip') {
    await waitForEnter('Click some other clip again, to reset for the next route.');
  }
}
note(`VERDICT E1 (user-reported): ${JSON.stringify(routes)}`);
check('at least one showInEditor route navigates the user to the clip',
  Object.values(routes).some(Boolean), routes);

const layout = (await request('ui.panelLayout')) as { current: string; known: string[] };
note(`panel layout: current="${layout.current}", known=${JSON.stringify(layout.known)}`);
await request('ui.panelLayout', { layout: 'EDIT' });
await sleep(SETTLE);
const afterLayout = (await request('ui.panelLayout')) as { current: string };
note(`after setPanelLayout("EDIT"): current="${afterLayout.current}"`);
// ⚠ The javadoc warns the available layouts "depend on the active display
// profile", so a silent no-op is a real possibility and is why this is read back.
check('VERDICT E2: setPanelLayout moves the UI and panelLayout() reports it',
  afterLayout.current === 'EDIT', { before: layout.current, after: afterLayout.current });

await request('ui.panelLayout', { zoom: 'fit' });
await sleep(SETTLE);
const zoomed = await askYesNo('Did zoomToFit() visibly change the editor zoom?');
check('VERDICT E3: zoomToFit acts on the focused editor', zoomed, { reportedByUser: zoomed });

// ---------------------------------------------------------------- row F

console.log('\n-- F. notification hygiene — RE-SPECIFIED, and mostly moved out');
// ⚠ Row F asked whether `setShouldShow*Notifications(false)` suppresses "the
// spray our cursor pointing causes (E1's wart)". It does not, and it cannot,
// because the premise is a misreading of E1. E1's wart, verbatim:
//
//     **Pointing borrows the UI selection.** `selectSlot` visibly moves the
//     user's selection ... a UX wart under optimistic application.
//
// The selection MOVES. Nothing about notifications. This was run the long way
// first — six prompts asking the user to watch for popups under three
// conditions — and produced no spray in any of them, which is the correct
// result for a question about a thing that does not happen.
//
// The real question (PROJECT_PLAN §7: "whether the selection movement itself can
// be restored after a batch is unresolved") is measurable with no human at all,
// because E1 wired `addIsSelectedObserver` across the slot bank. It lives in
// `probe:e14-selection`, which answers it ● in four parts. The six prompts are
// gone from this sitting.
//
// What remains here is the one thing worth checking about the API itself: that
// the master switch reads, writes and restores, so a future need for it is not
// blocked on an unverified control.
const notifBefore = (await request('ui.notifications', {})) as { userNotificationsEnabled: unknown };
note(`userNotificationsEnabled starts: ${String(notifBefore.userNotificationsEnabled)}`);
const notifOff = (await request('ui.notifications', { enabled: false })) as { userNotificationsEnabled: unknown };
await sleep(SETTLE);
const notifOffRead = (await request('ui.notifications', {})) as { userNotificationsEnabled: unknown };
await request('ui.notifications', { enabled: true });
await sleep(SETTLE);
const notifRestored = (await request('ui.notifications', {})) as { userNotificationsEnabled: unknown };
note(`toggled: ${String(notifBefore.userNotificationsEnabled)} -> ${String(notifOffRead.userNotificationsEnabled)}`
  + ` -> ${String(notifRestored.userNotificationsEnabled)}`);
void notifOff;
check('VERDICT F: the notification master switch is writable AND restorable',
  notifOffRead.userNotificationsEnabled === false && notifRestored.userNotificationsEnabled === true,
  { start: notifBefore.userNotificationsEnabled, off: notifOffRead.userNotificationsEnabled,
    restored: notifRestored.userNotificationsEnabled });
note('⇒ There is no pointing-induced popup spray to suppress: the setShouldShow*');
note('  switches govern CONTROLLER-requested notifications, they are off by default,');
note('  and ghostnote enables none. See probe:e14-selection for E1\'s actual wart.');

// ---------------------------------------------------------------- row G (name)

console.log('\n-- G2. does the undo entry carry the NAME we gave it?');
for (const slotIndex of SCENES) {
  if (!(await hasContent(slotIndex))) {
    await request('clip.create', { trackIndex: trackA, slotIndex, lengthBeats: 4 });
    await pollUntil(() => hasContent(slotIndex));
  }
}
await sleep(SETTLE);
await request('ui.deleteObjects', {
  undoName: 'ghostnote E14 batch delete',
  targets: SCENES.map((slotIndex) => ({ trackIndex: trackA, slotIndex })),
});
await sleep(SETTLE);
const nameSeen = await ask(
  'Open Bitwig\'s Edit menu (or the History panel). What does the topmost UNDO entry say?');
note(`VERDICT G2 (user-reported): undo entry reads "${nameSeen}"`);
check('the undo entry carries the caller-supplied name',
  nameSeen.toLowerCase().includes('ghostnote'), { reported: nameSeen });

await request('app.undo', { times: 1 });
await sleep(SETTLE);

console.log('\n-- G3. duplicateObjects');
await request('ui.duplicateObjects', {
  undoName: 'ghostnote E14 batch duplicate',
  targets: [{ trackIndex: trackA, slotIndex: 2 }],
});
await sleep(SETTLE);
const dupName = await ask('What does the topmost UNDO entry say now?');
note(`VERDICT G3 (user-reported): undo entry reads "${dupName}"`);
check('duplicateObjects also names its undo step',
  dupName.toLowerCase().includes('ghostnote'), { reported: dupName });

// ---------------------------------------------------------------- cleanup

console.log('\n-- cleanup: removing the row-G scratch clips from gn-A scenes 2-4');
for (const slotIndex of [...SCENES, 5]) {
  if (await hasContent(slotIndex)) {
    await request('slot.delete', { trackIndex: trackA, slotIndex });
    await sleep(120);
  }
}
note('gn-A scenes 0 and 1 (the fixtures) were never touched');

// ---------------------------------------------------------------- handoff

banner('NEXT: the persistence half of row A');
const PERSIST_MARKER = `persist-${Date.now()}`;
await request('ui.set', { setting: 'status', value: PERSIST_MARKER });
await request('ui.set', { setting: 'take', value: 'B' });
await sleep(SETTLE);
console.log(` Wrote a marker into the panel: status="${PERSIST_MARKER}", take="B".`);
console.log('');
console.log(' Document state is claimed to persist INSIDE the project document');
console.log(' (D4), which is the whole reason takes could live there. To settle it:');
console.log('');
console.log('   1. Save the project in Bitwig (Cmd-S).');
console.log('   2. Close and reopen it — or restart Bitwig entirely, which is the');
console.log('      stronger test (E11g used exactly this shape for modulators).');
console.log('   3. Run:  npm run probe:e14-verify');
console.log('');
console.log(` The verify probe expects to find status="${PERSIST_MARKER}" and take="B".`);
console.log(' Copy that marker somewhere — it is also written to .e14-marker.');

const { writeFileSync } = await import('node:fs');
writeFileSync(new URL('../../.e14-marker', import.meta.url), `${PERSIST_MARKER}\n`, 'utf8');

client.disconnect();
console.log(`\n${failureCount() === 0 ? 'E14 rows A-G: all checks passed' : `E14 rows A-G: ${failureCount()} FAILURE(S)`}`);
console.log('Read the VERDICT lines above — several rows are measurements, and a ○');
console.log('there is a finding, not a bug.');
process.exit(failureCount() === 0 ? 0 : 1);
