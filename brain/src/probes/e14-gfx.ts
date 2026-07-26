/**
 * E14 row I — `host.createBitmap` + `GraphicsOutput` + `showDisplayWindow()`.
 *
 *   npm run probe:e14-gfx
 *
 * ⚠ **SPECULATIVE, AND BITWIG SAYS SO FIRST.** `showDisplayWindow`'s own
 * javadoc: *"You should see this as a debug utility rather than a Control
 * Surface API feature."* Whatever this probe measures, row I must not become
 * load-bearing — a ● here buys a reopened question, never a plan. PHASE-0
 * §Scope item 5 timeboxes it at ~20 minutes for that reason.
 *
 * **Why it is worth 20 minutes.** Rows A–G settled that the human surface is
 * real but that Bitwig's controller pane CANNOT be pinned — it closes on
 * click-away — which is what sent A/B take navigation to the Phase-3 web view
 * (D14). Rows H and I are the two candidates for a surface that STAYS. So the
 * decisive question here is not "does it draw"; it is **"does the window
 * persist"**, and everything else is only interesting if it does.
 *
 * ⚠ **Run this BEFORE row H** — it needs no simulated device and no restart, so it
 * costs nothing to answer first, and if row H's setup goes wrong row I is already
 * banked. `probe:e14-hw` is the other half.
 *
 * ⚠ **CORRECTION, 2026-07-25.** This header used to assert that row I "needs no
 * `extension-dev` flag". That was OUR OWN JAVADOC INFERENCE — the flag is
 * documented only against `HardwareSurface` simulation — and it was never
 * measured. Since `showDisplayWindow` is a debug utility by Bitwig's own words,
 * "gated behind the debug flag" was a live hypothesis, and the first run happened
 * on a machine with no `config.json` at all, which left the ○ confounded.
 * Re-run with `extension-dev : true` set and the simulated device connected:
 * **identical result, no window.** The verdict now holds under both conditions.
 * Standing rule 10's clause about doc passes applies to our own inferences too.
 *
 * **What does not need a human.** `Bitmap.saveToDiskAsPPM` is the only export
 * the graphics API has, so every render is dumped, converted to PNG beside it,
 * and summarised. That turns "renders text and paths acceptably" from a yes/no
 * in a transcript into an artifact in `brain/.tmp/e14/` — and it catches the
 * failure mode that is invisible from the extension side, where a render reports
 * `rendered: true`, returns plausible font metrics, and draws a blank rectangle.
 */
import { mkdirSync } from 'node:fs';

import { check, client, failureCount, note, ask, askYesNo, trackedRequest } from './lib.js';
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

interface RenderReport {
  scene: string;
  rendered: boolean;
  renderMicros: number;
  error?: string;
  textError?: string;
  textWidth: number;
  textHeight: number;
  fontAscent: number;
  fontHeight: number;
}
interface RenderResult {
  scene: string;
  width: number;
  height: number;
  callMicros: number;
  renderCount: number;
  render: RenderReport;
  savedTo?: string;
}
interface BitmapStatus {
  available: boolean;
  error?: string;
  constructMicros?: number;
  width?: number;
  height?: number;
  shown?: boolean;
  showCalls?: number;
  renderCount?: number;
  lateCreateResult?: string;
  lastRender?: RenderReport;
}

const status = async (): Promise<BitmapStatus> => (await request('ui.bitmapStatus')) as BitmapStatus;

// ---------------------------------------------------------------- preflight

const hello = (await request('contract.hello')) as { methodsHash: string; methodCount: number };
note(`extension: ${hello.methodCount} wire methods, hash ${hello.methodsHash}`);
note('⚠ if this hash is not what `npm run wire:golden` reports, the deployed build predates');
note('  rows H/I: `cd extension && ./gradlew copyExtension`, then `npm run probe:hello`.');

const first = await status();
if (!first.available) {
  // Not a probe failure — `host.createBitmap` refusing at init IS row I's answer,
  // and a clean synchronous refusal is the good failure mode (compare E14-C2,
  // and its opposite in E14-A1).
  check('VERDICT I0: ○ host.createBitmap failed at init — row I is closed here', false,
    { error: first.error });
  console.log('\nNothing below can run. That refusal is the finding; record it and stop.');
  client.disconnect();
  process.exit(1);
}
check('VERDICT I0: ● host.createBitmap(640x320, ARGB32) succeeded at init', true,
  { micros: first.constructMicros, size: `${first.width}x${first.height}` });

// ================================================================ AUTOMATED

banner('AUTOMATED — renders and artifacts, no interaction needed');

const artifacts: Record<string, ReturnType<typeof convertArtifact>> = {};
for (const scene of ['takes', 'text', 'paths'] as const) {
  const savePath = `${ARTIFACTS}gfx-${scene}.ppm`;
  const result = (await request('ui.bitmapRender', { scene, savePath })) as RenderResult;
  const r = result.render;
  note(`scene "${scene}": rendered=${r.rendered} in ${r.renderMicros}us`
    + ` (call ${result.callMicros}us)${r.error ? ` ERROR ${r.error}` : ''}`);

  // The programmatic half of "does text work", available before anyone looks at
  // anything: a font system that is dead reports zero-width extents while the
  // render still claims success.
  if (scene === 'takes') {
    note(`text extents for "Take B · 12 notes" @12px: w=${r.textWidth} h=${r.textHeight}`
      + ` ascent=${r.fontAscent} lineHeight=${r.fontHeight}${r.textError ? ` ERR ${r.textError}` : ''}`);
    check('VERDICT I3a: the default font face measures text (no loadFontFace needed)',
      r.textWidth > 0 && r.fontHeight > 0,
      { textWidth: r.textWidth, fontHeight: r.fontHeight, textError: r.textError });
  }

  check(`scene "${scene}" rendered without throwing`, r.rendered && !r.error,
    { rendered: r.rendered, error: r.error });

  const artifact = convertArtifact(savePath);
  artifacts[scene] = artifact;
  note(`  -> ${artifact.pngPath} (${artifact.magic} ${artifact.width}x${artifact.height},`
    + ` ${artifact.distinctColors} colours, ${artifact.nonBackgroundPct}% non-background)`);
  // ⚠ This is the check that catches a silent blank. Everything else about a
  // no-op render looks like success from the extension side.
  check(`scene "${scene}" actually put pixels on the bitmap`,
    artifact.distinctColors > 1 && artifact.nonBackgroundPct > 0.5,
    { colours: artifact.distinctColors, nonBackgroundPct: artifact.nonBackgroundPct });
}

// Text is drawn with the same calls in every scene, so if the font is dead the
// `text` scene is the one that collapses to a bare background — a second,
// independent reading of I3a that does not trust the extents query.
check('VERDICT I3b: the text ladder (8..24px) drew something at every size',
  (artifacts.text?.nonBackgroundPct ?? 0) > 1,
  { nonBackgroundPct: artifacts.text?.nonBackgroundPct });

const perf = (await request('ui.bitmapRender', { scene: 'takes' })) as RenderResult;
note(`re-render cost at 640x320: ${perf.render.renderMicros}us in-renderer,`
  + ` ${perf.callMicros}us wall — render #${perf.renderCount}`);

banner('The artifacts are on disk — look at them before answering anything below');
for (const [scene, a] of Object.entries(artifacts)) {
  console.log(`  ${scene.padEnd(6)} ${a.pngPath}`);
}

// ================================================================ INTERACTIVE

banner('INTERACTIVE — Bitwig needs to be in front of you now');
console.log(' No setup is required for this row: no config.json edit, no restart,');
console.log(' no simulated device. That is all row H, and it comes after this.');

const shown = (await request('ui.bitmapShow', {})) as { showCalls: number; renderCount: number };
note(`ui.bitmapShow -> showCalls=${shown.showCalls}, renderCount=${shown.renderCount}`);
await sleep(600);

const appeared = await askYesNo('Did a window appear showing the ghostnote take strip?');
check('VERDICT I1: showDisplayWindow() opens a window', appeared, { reportedByUser: appeared });

if (!appeared) {
  console.log('\n○ The window never appeared. Row I is closed, and the artifacts above still');
  console.log('  show what the renderer produced — so the verdict is "renders fine, cannot');
  console.log('  be displayed", which is a cleaner ○ than "nothing worked".');
  const why = await ask('Anything visible at all — a flash, a menu item, an error? (or "nothing")');
  note(`VERDICT I1 detail (user-reported): ${why}`);
} else {
  // ⚠ THE DECISIVE QUESTION. E14's one real negative was that the controller
  // pane closes on click-away, which is what moved take navigation to Phase 3
  // (D14). If this window also vanishes, rows H and I change nothing and Phase 3
  // owns the take UI outright. If it stays, D14's split is worth re-examining.
  console.log('\n-- I2. does it PERSIST? (the question the whole row exists to answer)');
  const persistence = await ask(
    'Click into the Bitwig project — select a clip, edit a note, use the arranger.'
    + ' Does the window STAY OPEN, or does it close/vanish? Say "stays" or "closes".');
  const persists = persistence.toLowerCase().startsWith('stay');
  note(`VERDICT I2 (user-reported): the window ${persistence}`);
  check('VERDICT I2: the display window persists while the user works in Bitwig',
    persists, { reported: persistence });

  const behaviour = await ask(
    'How does it behave as a window — always-on-top, behind Bitwig, its own dock/taskbar'
    + ' entry, resizable? (free text, or "unremarkable")');
  note(`VERDICT I2 detail (user-reported): ${behaviour}`);

  // ---------------------------------------------------------------- redraw
  console.log('\n-- I4. does an ALREADY-OPEN window redraw, with no second showDisplayWindow()?');
  console.log('   Each render stamps its own number into the image, so the answer is');
  console.log('   readable off the window rather than inferred.');
  const before = await status();
  for (const scene of ['paths', 'text', 'takes'] as const) {
    const r = (await request('ui.bitmapRender', { scene })) as RenderResult;
    note(`  rendered "${scene}" as render #${r.renderCount}`);
    await sleep(700);
  }
  const after = await status();
  const redrew = await askYesNo(
    `Did the window CONTENT change as those three scenes went by, ending on the take strip`
    + ` labelled "render #${after.renderCount}"?`);
  check('VERDICT I4: an open display window redraws on bitmap.render() alone',
    redrew, { renderCountBefore: before.renderCount, renderCountAfter: after.renderCount });
  check('and it did not need re-showing (showCalls unchanged across the redraws)',
    after.showCalls === before.showCalls, { before: before.showCalls, after: after.showCalls });

  // ---------------------------------------------------------------- legibility
  console.log('\n-- I3c. legibility, by eye this time');
  await request('ui.bitmapRender', { scene: 'text' });
  await sleep(500);
  const legible = await ask(
    'The window now shows the same string at 8, 10, 12, 14, 18 and 24px.'
    + ' Down to which size is it comfortably readable? (a number, or "none")');
  note(`VERDICT I3c (user-reported): legible down to ${legible}px`);
  const titled = (await request('ui.bitmapShow',
    { title: 'ghostnote — retitled mid-session' })) as { showCalls: number };
  await sleep(400);
  const titleChanged = await askYesNo('Did the window TITLE change (and did it stay the same window)?');
  check('setDisplayWindowTitle updates a window that is already open',
    titleChanged, { showCalls: titled.showCalls });
}

// ---------------------------------------------------------------- late create
//
// ⚠ SEQUENCED LAST, DELIBERATELY. `host.createBitmap` after init has no
// precedent: E14-C2 found document-state settings are init-only and refuse
// cleanly, but nothing says graphics allocation behaves the same — and E14-A1 is
// what an UNCLEAN refusal costs (Bitwig exited, unsaved project). Everything
// above is already measured by the time this runs, so a fatal outcome loses
// nothing but this one answer.

banner('LAST: can a bitmap be allocated AFTER init?');
console.log(' This is the only call in this probe with no precedent. E14-A1 crashed Bitwig');
console.log(' from a refusal delivered on Bitwig\'s own thread, where no try/catch reaches');
console.log(' it. Everything else is already measured, so declining costs one answer.');
const runLate = await askYesNo('SAVE THE PROJECT (Cmd-S), then run the late-allocation probe?');
if (runLate) {
  const late = (await request('ui.bitmapShow', { lateCreate: true })) as { lateCreateResult: string };
  note(`VERDICT I5: host.createBitmap after init -> ${late.lateCreateResult}`);
  check('the late-allocation attempt returned an answer instead of taking the DAW down',
    typeof late.lateCreateResult === 'string', { result: late.lateCreateResult });
} else {
  note('VERDICT I5: SKIPPED by the operator. Row I stands on I0–I4.');
}

// ---------------------------------------------------------------- handoff

banner('E14 row I — done');
console.log(' ⚠ Whatever the verdicts above, row I is NOT load-bearing. `showDisplayWindow`');
console.log('   is a debug utility by Bitwig\'s own javadoc, and D14 stands until something');
console.log('   supported replaces it. A ● reopens a question; it does not settle one.');
console.log('');
console.log(' Next: row H needs `extension-dev : true` in');
console.log('   ~/Library/Application Support/Bitwig/Bitwig Studio/config.json');
console.log(' then a Bitwig restart, then "Simulate device connected" and "Show simulated');
console.log(' hardware GUI" from the right-click menu in Settings > Controllers.');
console.log(' Then: npm run probe:e14-hw');

client.disconnect();
console.log(`\n${failureCount() === 0 ? 'E14 row I: all checks passed' : `E14 row I: ${failureCount()} FAILURE(S)`}`);
console.log('Read the VERDICT lines — several are measurements, and a ○ is a finding.');
process.exit(failureCount() === 0 ? 0 : 1);
