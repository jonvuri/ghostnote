/**
 * E14 row H — `HardwareSurface` + the `extension-dev: true` simulated GUI.
 *
 *   npm run probe:e14-hw
 *
 * ⚠ **SPECULATIVE, AND GATED BEHIND SETUP NO PRODUCT CAN IMPOSE.** Even a
 * perfect ● here ships behind `extension-dev : true` in the user's own
 * `config.json`, a Bitwig restart, and two right-click menu items. Row H must
 * not become load-bearing whatever it measures; PHASE-0 §Scope item 5 timeboxes
 * it at ~20 minutes for that reason.
 *
 * **Why it has real motivation rather than curiosity.** Rows A–G found that
 * Bitwig's per-controller pane CANNOT be pinned and closes on click-away — the
 * one real negative in E14, and what sent A/B take navigation to the Phase-3 web
 * view (D14). The simulated hardware GUI is a *window*, not a pop-over, so it is
 * the only candidate for a **persistent, clickable** surface inside Bitwig. So
 * the decisive question is H4 below — does it stay open — and everything else
 * only matters if it does.
 *
 * ⚠ **The mechanism question, which the javadoc half-answers already.**
 * `HardwareAction.isSupported()` is documented as "has a `HardwareActionMatcher`
 * that can detect it". This panel sets **no matcher** — it cannot, because
 * ghostnote declares zero MIDI ports — so `isSupported()` is PREDICTED false on
 * every button. The row's actual question is whether the simulator fires the
 * action ANYWAY, i.e. whether it synthesises presses directly rather than
 * routing them through a matcher. So the finding is the PAIR
 * (`pressedSupported`, `presses`), not a bare yes/no about clicking.
 *
 * **Run `probe:e14-gfx` first.** Row I needs none of this setup, so it costs
 * nothing to bank before touching config.json.
 *
 * ⚠ Setup, all of it required before the interactive half:
 *   1. add `extension-dev : true` to
 *      ~/Library/Application Support/Bitwig/Bitwig Studio/config.json
 *   2. restart Bitwig
 *   3. Settings > Controllers, right-click ghostnote > "Simulate device connected"
 *   4. right-click again > "Show simulated hardware GUI"
 * The automated half below runs without any of it, and answers more than you
 * would expect — layout, the output pipeline, and rendering are all measurable
 * with no GUI at all.
 */
import { mkdirSync } from 'node:fs';

import { check, client, failureCount, note, ask, askYesNo, waitForEnter, trackedRequest } from './lib.js';
import { convertArtifact } from './ppm.js';

const request = trackedRequest();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ARTIFACTS = new URL('../../.tmp/e14/', import.meta.url).pathname;
mkdirSync(ARTIFACTS, { recursive: true });

const banner = (title: string) => {
  console.log(`\n${'='.repeat(72)}`);
  console.log(` ${title}`);
  console.log('='.repeat(72));
};

interface ButtonRow {
  index: number;
  label: string;
  presses: number;
  releases: number;
  id: string;
  x: number; y: number; width: number; height: number;
  pressed: boolean | string;
  pressedSupported: boolean | string;
  releasedSupported: boolean | string;
  light: { wanted: boolean; currentValue: boolean | string; lastSentValue: boolean | string };
}
interface LineRow {
  index: number;
  wanted: string;
  currentValue: string;
  lastSentValue: string;
  maxChars: number | string;
}
interface HwStatus {
  available: boolean;
  error?: string;
  constructMicros?: number;
  physicalWidthMm?: number;
  physicalHeightMm?: number;
  currentTake?: number;
  lastPressedIndex?: number;
  updateHardwareCalls?: number;
  updateHardwareFailures?: number;
  updateHardwareDisabled?: boolean;
  updateHardwareError?: string;
  buttons?: ButtonRow[];
  textLines?: LineRow[];
  pixelDisplay?: { width: number; height: number; renderCount: number; lastRender: Record<string, unknown> };
  surfaceControlCount?: number | string;
  surfaceOutputCount?: number | string;
}

const status = async (): Promise<HwStatus> => (await request('ui.hwStatus')) as HwStatus;
const totalPresses = (s: HwStatus) => (s.buttons ?? []).reduce((n, b) => n + b.presses, 0);

// ---------------------------------------------------------------- preflight

const hello = (await request('contract.hello')) as { methodsHash: string; methodCount: number };
note(`extension: ${hello.methodCount} wire methods, hash ${hello.methodsHash}`);

const first = await status();
if (!first.available) {
  // `createHardwareSurface()` throwing at init IS the row-H answer, and the
  // extension survived to report it — which is the E7-Finding-0 discipline
  // working rather than a probe failure.
  check('VERDICT H0: ○ the hardware surface failed to build — row H is closed here', false,
    { error: first.error });
  console.log('\nNothing below can run. Record that refusal as the verdict.');
  client.disconnect();
  process.exit(1);
}
check('VERDICT H0: ● createHardwareSurface() + 4 buttons, lights, text and a pixel display built at init',
  true, {
    micros: first.constructMicros,
    controls: first.surfaceControlCount,
    outputs: first.surfaceOutputCount,
    panelMm: `${first.physicalWidthMm}x${first.physicalHeightMm}`,
  });

// ================================================================ AUTOMATED

banner('AUTOMATED — no GUI, no simulated device, no setup needed yet');

// ---------------------------------------------------------------- H1: layout

console.log('\n-- H1. does setBounds() take? (the layout half, with no GUI open)');
// Worth asking WITHOUT the simulator, because `getX/getY/getWidth/getHeight`
// read back Bitwig's own physical model. If the model has our layout in it, then
// "does the GUI draw it" and "did we describe it" are separable questions — and
// a failure below can be attributed rather than guessed at.
const bounds = (first.buttons ?? []).map((b) => `${b.id} @(${b.x},${b.y}) ${b.width}x${b.height}mm`);
for (const line of bounds) note(line);
const laidOut = (first.buttons ?? []).every((b, i) =>
  typeof b.width === 'number' && b.width > 0 && typeof b.x === 'number' && b.x === 6 + i * 28);
check('VERDICT H1: setBounds round-trips through Bitwig\'s physical model',
  laidOut, { buttons: bounds.length, bounds });

// ---------------------------------------------------------------- H2: pipeline

console.log('\n-- H2. is the hardware OUTPUT pipeline running at all?');
// ⚠ The single most useful automated measurement here, and it needs no GUI.
// `lastSentValue()` only moves when Bitwig actually pushes output state, so
// `currentValue === lastSentValue` after a flush proves `updateHardware()` is
// being called and is doing something. If this is dead, every visual question
// below is dead too and the reason is known before anyone opens a window.
const flushBefore = first.updateHardwareCalls ?? 0;
await sleep(1000);
const flushAfter = (await status()).updateHardwareCalls ?? 0;
note(`updateHardware() calls over ~1s: ${flushBefore} -> ${flushAfter}`);
check('VERDICT H2a: Bitwig calls flush(), and updateHardware() does not throw',
  flushAfter > flushBefore, { before: flushBefore, after: flushAfter });

await request('ui.hwLight', { take: 2 });
await request('ui.hwText', { line: 0, text: 'E14 row H' });
await request('ui.hwText', { line: 1, text: 'pushed at ' + new Date().toISOString().slice(11, 19) });
await sleep(600);
const pushed = await status();
const light2 = pushed.buttons?.[2]?.light;
const line1 = pushed.textLines?.[1];
note(`light[2]: wanted=${light2?.wanted} current=${light2?.currentValue} lastSent=${light2?.lastSentValue}`);
note(`line[1]:  wanted="${line1?.wanted}" current="${line1?.currentValue}" lastSent="${line1?.lastSentValue}"`);
check('VERDICT H2b: a pushed light reaches the surface (currentValue === lastSentValue)',
  light2?.currentValue === true && light2?.lastSentValue === true, { light: light2 });
check('VERDICT H2c: a pushed text line reaches the surface',
  line1?.currentValue === line1?.wanted && line1?.lastSentValue === line1?.wanted, { line: line1 });
check('the take selection moved with it', pushed.currentTake === 2, { currentTake: pushed.currentTake });
if (pushed.updateHardwareFailures) {
  check('updateHardware() has not been disabled by repeated failures',
    !pushed.updateHardwareDisabled,
    { failures: pushed.updateHardwareFailures, error: pushed.updateHardwareError });
}

// ---------------------------------------------------------------- H3: matcher

console.log('\n-- H3. isSupported() with NO HardwareActionMatcher (the doc prediction)');
const supported = (first.buttons ?? []).map((b) => b.pressedSupported);
note(`pressedAction().isSupported() per button: ${JSON.stringify(supported)}`);
// ⚠ NOT a pass/fail expectation. The javadoc predicts false, and false is the
// INTERESTING answer: if presses still arrive in H5, the simulator bypasses the
// matcher entirely, which is the transferable mechanism finding.
note(supported.every((s) => s === false)
  ? 'as the javadoc predicts: no matcher, so no action is "supported"'
  : `⚠ unexpected — some action reports supported without a matcher: ${JSON.stringify(supported)}`);

// ---------------------------------------------------------------- H6: pixels

console.log('\n-- H6. does the embedded pixel display render? (256x64, no GUI needed)');
const pixelArtifacts: Record<string, ReturnType<typeof convertArtifact>> = {};
for (const scene of ['takes', 'text', 'paths'] as const) {
  const savePath = `${ARTIFACTS}hw-${scene}.ppm`;
  const result = (await request('ui.hwRender', { scene, savePath })) as {
    callMicros: number;
    render: { rendered: boolean; renderMicros: number; error?: string; textWidth: number; fontHeight: number };
  };
  const r = result.render;
  note(`scene "${scene}": rendered=${r.rendered} in ${r.renderMicros}us${r.error ? ` ERROR ${r.error}` : ''}`);
  const artifact = convertArtifact(savePath);
  pixelArtifacts[scene] = artifact;
  note(`  -> ${artifact.pngPath} (${artifact.distinctColors} colours,`
    + ` ${artifact.nonBackgroundPct}% non-background)`);
  check(`pixel display scene "${scene}" put pixels on the bitmap`,
    r.rendered && !r.error && artifact.distinctColors > 1 && artifact.nonBackgroundPct > 0.5,
    { rendered: r.rendered, error: r.error, colours: artifact.distinctColors });
}
check('VERDICT H6a: text is legible-sized at 256x64 (the font measured non-zero)',
  ((first.pixelDisplay?.lastRender as { textWidth?: number } | undefined)?.textWidth ?? 1) !== 0,
  { note: 'see the PNGs — 256x64 is a real controller screen size, not a poster' });
await request('ui.hwRender', { scene: 'takes' });

banner('Artifacts on disk — look at them before answering anything below');
for (const [scene, a] of Object.entries(pixelArtifacts)) {
  console.log(`  ${scene.padEnd(6)} ${a.pngPath}  (${a.width}x${a.height})`);
}

// ================================================================ INTERACTIVE

banner('INTERACTIVE — the simulated hardware GUI');
console.log(' ⚠ THIS IS THE PART THAT NEEDS SETUP, and the setup itself is the first');
console.log('   finding: a shipping product cannot ask a musician to do any of it.');
console.log('');
console.log('   1. add   extension-dev : true');
console.log('      to    ~/Library/Application Support/Bitwig/Bitwig Studio/config.json');
console.log('   2. restart Bitwig');
console.log('   3. Settings > Controllers, right-click the ghostnote entry');
console.log('        -> "Simulate device connected"');
console.log('   4. right-click again -> "Show simulated hardware GUI"');
console.log('');
console.log(' You are looking for a panel with four "Take A..D" buttons in a row, a');
console.log(' two-line text display under them, and a 256x64 graphic below that.');

const setupDone = await askYesNo('Is the setup done and a simulated hardware GUI window open?');
if (!setupDone) {
  const why = await ask(
    'What happened? ("no menu item" / "menu item but no window" / "not attempted" / free text)');
  note(`VERDICT H4 (user-reported): the simulated GUI could not be opened — ${why}`);
  check('VERDICT H4: the simulated hardware GUI opens', false, { reported: why });
  console.log('\n○ Row H is closed on the GUI question. Note that H1, H2 and H6 above still');
  console.log('  stand: the surface builds, the output pipeline runs, and the pixel display');
  console.log('  renders. What is unproven is that a human can ever SEE or click any of it.');
} else {
  const looks = await ask(
    'What does the window actually show? Mention: the four buttons, their labels,'
    + ' the light colours, the two text lines, and the graphic. (free text)');
  note(`VERDICT H4 detail (user-reported): ${looks}`);
  check('VERDICT H4: the simulated hardware GUI opens and draws the laid-out panel',
    true, { reported: looks });

  const lightSeen = await askYesNo('Is the "Take C" button lit (green) while the other three are dark?');
  check('VERDICT H4b: OnOffHardwareLight state reaches the GUI',
    lightSeen, { pushedTake: 2, reportedByUser: lightSeen });
  const textSeen = await askYesNo('Do the two text lines show "E14 row H" and a "pushed at HH:MM:SS" line?');
  check('VERDICT H4c: HardwareTextDisplay lines reach the GUI',
    textSeen, { reportedByUser: textSeen });
  const pixelSeen = await askYesNo('Does the graphic area show a take strip with A/B/C/D chips?');
  check('VERDICT H4d: an embedded HardwarePixelDisplay renders in the GUI',
    pixelSeen, { reportedByUser: pixelSeen });

  // -------------------------------------------------------------- H5: clicks
  //
  // ⚠ THE ROW'S HEADLINE QUESTION. No MIDI matcher exists on any of these
  // actions — see the note at the top — so a press arriving here means the
  // simulator synthesises it directly.
  console.log('\n-- H5. does a HardwareButton with NO action matcher fire when CLICKED?');
  const beforeClicks = await status();
  await waitForEnter('Click "Take A" in the simulated GUI, then "Take D". Two clicks total.');
  const afterClicks = await status();
  const delta = totalPresses(afterClicks) - totalPresses(beforeClicks);
  note(`presses per button: ${JSON.stringify((afterClicks.buttons ?? []).map((b) => b.presses))}`);
  note(`releases per button: ${JSON.stringify((afterClicks.buttons ?? []).map((b) => b.releases))}`);
  check('VERDICT H5: a HardwareButton with NO HardwareActionMatcher fires on a click',
    delta >= 2, { pressDelta: delta, lastPressedIndex: afterClicks.lastPressedIndex });
  if (delta >= 2) {
    note(`⇒ the simulator BYPASSES the matcher: isSupported() is ${JSON.stringify(supported[0])}`
      + ' on every button and presses arrived anyway. That is the mechanism finding.');
  }
  const released = (afterClicks.buttons ?? []).reduce((n, b) => n + b.releases, 0)
    - (beforeClicks.buttons ?? []).reduce((n, b) => n + b.releases, 0);
  check('releasedAction fires too (so press/hold/release gestures are available)',
    released >= 2, { releaseDelta: released });

  const followed = await askYesNo(
    'Did the LIGHT and the graphic follow your clicks (last one you pressed lit, chip highlighted)?');
  check('VERDICT H5b: a click round-trips — extension observes it and pushes state back',
    followed, { reportedByUser: followed });

  // -------------------------------------------------------------- H4e: persistence
  //
  // ⚠ THE QUESTION THE WHOLE ROW EXISTS FOR. E14's one real negative was that
  // the controller pane closes on click-away, which is what moved take
  // navigation to the Phase-3 web view (D14). A window that also vanishes
  // changes nothing; a window that stays reopens that choice.
  console.log('\n-- H4e. does it PERSIST? (the reason row H is being probed at all)');
  const persistence = await ask(
    'Click into the Bitwig project — select a clip, edit a note, use the arranger.'
    + ' Does the simulated GUI STAY OPEN, or does it close/vanish? Say "stays" or "closes".');
  note(`VERDICT H4e (user-reported): the simulated GUI ${persistence}`);
  check('VERDICT H4e: the simulated hardware GUI persists while the user works',
    persistence.toLowerCase().startsWith('stay'), { reported: persistence });
  const survives = await ask(
    'Does it survive switching projects, or closing and reopening the project? Say what happens.');
  note(`VERDICT H4f (user-reported): across a project switch — ${survives}`);
}

// ---------------------------------------------------------------- verdict

banner('E14 row H — the verdict is a JOINT one, not a checklist');
console.log(' ⚠ Row H cannot be ● on the strength of the checks above alone. Three gates');
console.log('   have to clear together for it to mean anything:');
console.log('     - the GUI opens at all                        (H4)');
console.log('     - a matcher-less button fires on a click      (H5)');
console.log('     - the window PERSISTS while the user works    (H4e)');
console.log('   Any one of them ○ and the surface cannot host D5\'s A/B comparison, which');
console.log('   is the only reason it was probed.');
console.log('');
console.log(' ⚠ And even three ●s do NOT make row H load-bearing. `extension-dev : true`,');
console.log('   a restart, and two right-click menus are a setup cost no product can put on');
console.log('   a musician. D14 stands; a ● reopens a question rather than settling one.');

client.disconnect();
console.log(`\n${failureCount() === 0 ? 'E14 row H: all checks passed' : `E14 row H: ${failureCount()} FAILURE(S)`}`);
console.log('Read the VERDICT lines — several are measurements, and a ○ is a finding.');
process.exit(failureCount() === 0 ? 0 : 1);
