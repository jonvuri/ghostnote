/**
 * E4h — Can template presets live OUTSIDE the Bitwig Library, shipped with
 * the project repo?
 *
 * E4f gate 2 showed an unregistered copy in /tmp loads. This settles the
 * practical questions that follow if templates become repo assets:
 *
 *   A. absolute path inside the repo                  — the shipping case
 *   B. RELATIVE path                                  — what does it resolve against?
 *   C. spaces / non-ASCII in the path                 — real filenames
 *   D. a non-.bwpreset extension                      — does Bitwig sniff or trust?
 *   E. a missing file                                 — error or silent no-op?
 *   F. is the file still needed AFTER loading?        — self-containment
 *
 * F matters most: if the project holds a live reference to the file, presets
 * become a runtime dependency rather than a build-time asset.
 *
 * Creates and removes a temp dir inside the repo; restores fixtures.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  client, check, note, failureCount, pollUntil, point, ensureFixtureTracks,
} from './lib.js';

const MECH = 'trackThenSlot';
const TEMPLATE = path.join(process.env.HOME!, 'Documents', 'Bitwig Studio', 'Library',
  'Presets', 'Instrument Layer', 'gn test - instrument layer 4.bwpreset');
// Simulate a repo asset directory: <repo>/assets/presets/
const REPO = path.resolve('..');
const ASSETS = path.join(REPO, 'assets', 'presets');

const devList = async () => (await client.request('device.list', { cursor: '0' })) as any;
const layers = async () => (await client.request('layer.list')) as any;

async function clearDevices() {
  let l = await devList();
  for (let g = 0; g < 12 && l.count > 0; g++) {
    await client.request('device.delete', { cursor: '0', deviceIndex: l.devices[0].index });
    await pollUntil(async () => (await devList()).count < l.count, 5000);
    l = await devList();
  }
  return l.count === 0;
}

/** Returns the chain contents, or null if nothing loaded. */
async function loadChains(p: string): Promise<string[] | null> {
  await clearDevices();
  try {
    await client.request('device.insertFile', { cursor: '0', path: p });
  } catch (e) {
    note(`  bridge error: ${(e as Error).message}`);
    return null;
  }
  const ok = await pollUntil(async () => (await devList()).count > 0, 12000);
  if (!ok.ok) return null;
  await client.request('devcursor.selectAt', { deviceIndex: 0 });
  await pollUntil(async () => (await layers()).count > 0, 8000);
  await new Promise((r) => setTimeout(r, 1000));
  return (await layers()).layers.map((x: any) =>
    x.devices.map((d: any) => d.name).join('+') || '(empty)');
}

await client.connect();
console.log('connected\n');
const { trackA } = await ensureFixtureTracks();
await point('0', trackA, 0, MECH);

if (!fs.existsSync(TEMPLATE)) {
  console.log(`template not found at ${TEMPLATE}`);
  process.exit(1);
}
fs.mkdirSync(ASSETS, { recursive: true });
note(`simulated repo asset dir: ${ASSETS}`);

// ============================================ A. absolute path in the repo
console.log('\n-- A. absolute path to a repo asset (the shipping case)');
const repoPreset = path.join(ASSETS, 'layer4.bwpreset');
fs.copyFileSync(TEMPLATE, repoPreset);
const a = await loadChains(repoPreset);
note(`chains: ${a ? a.join(', ') : 'NOTHING'}`);
check('A: a preset stored in the project repo loads by absolute path',
  a !== null && a.length === 4, { chains: a });

// ============================================ B. relative path
console.log('\n-- B. relative path — what does the extension resolve against?');
const rel = path.relative(process.cwd(), repoPreset);
note(`sending relative path: "${rel}"`);
const b = await loadChains(rel);
check('B: a RELATIVE path does NOT load (paths must be absolute)',
  b === null, { loaded: b });
note('the extension runs inside Bitwig, so any relative path resolves against');
note('Bitwig\'s working directory, not the brain\'s. ⇒ the brain must always');
note('send absolute paths — resolve repo assets before crossing the bridge.');

// ============================================ C. spaces + non-ASCII
console.log('\n-- C. spaces and non-ASCII in the filename');
const oddDir = path.join(ASSETS, 'shape templates');
fs.mkdirSync(oddDir, { recursive: true });
const oddPath = path.join(oddDir, 'layer4 — stack (v1).bwpreset');
fs.copyFileSync(TEMPLATE, oddPath);
const c = await loadChains(oddPath);
check('C: spaces, an em dash and parentheses in the path are fine',
  c !== null && c.length === 4, { chains: c });

// ============================================ D. wrong extension
console.log('\n-- D. does the extension matter, or is content sniffed?');
const noExt = path.join(ASSETS, 'layer4.template');
fs.copyFileSync(TEMPLATE, noExt);
const d = await loadChains(noExt);
check('D: a non-.bwpreset extension does NOT load — Bitwig dispatches on the '
  + 'FILENAME, not the content',
  d === null, { chains: d });
note('⇒ repo assets must keep the .bwpreset extension. Byte-identical content');
note('  under another name is silently ignored, like every other insertFile');
note('  rejection — so this would surface only as "nothing happened".');

// ============================================ E. missing file
console.log('\n-- E. a path that does not exist');
const missing = path.join(ASSETS, 'does-not-exist.bwpreset');
const e = await loadChains(missing);
check('E: a missing file loads nothing (verify by readback — it may not throw)',
  e === null, { result: e });
note('insertFile gives no negative acknowledgement, matching the documented');
note('"some things may not make sense to insert… nothing happens" semantics.');

// ============================================ F. self-containment
console.log('\n-- F. is the file still needed after loading?');
const keepPath = path.join(ASSETS, 'ephemeral.bwpreset');
fs.copyFileSync(TEMPLATE, keepPath);
const before = await loadChains(keepPath);
check('F: loaded from the ephemeral copy', before !== null && before.length === 4, { chains: before });

fs.rmSync(keepPath, { force: true });
note(`deleted the source file; re-reading the loaded structure…`);
await new Promise((r) => setTimeout(r, 800));
const after = (await layers()).layers.map((x: any) =>
  x.devices.map((d: any) => d.name).join('+') || '(empty)');
check('F: the structure survives deletion of the preset file',
  after.length === 4 && after.join() === (before ?? []).join(), { before, after });

// and it is still driveable
await client.request('devcursor.selectFirstInLayer', { layerIndex: 1 });
const live = await pollUntil(async () =>
  ((await client.request('directparam.list')) as any).count > 0, 8000);
const dp = (await client.request('directparam.list')) as any;
check('F: devices inside it are still live after the file is gone',
  live.ok && dp.count > 0, { params: dp.count });
note('⇒ presets are a BUILD-TIME asset: insertFile copies the content into the');
note('  project. Nothing keeps a reference to the file afterwards.');
note('(Caveat: verified in-session. A project save + reload would confirm it');
note(' fully — samples in particular can be referenced rather than embedded.)');

// ============================================ cleanup
console.log('\n-- cleanup');
check('gn-A devices removed', await clearDevices());
await point('0', trackA, 0, MECH);
await client.request('cursor.clearNotes', { cursor: '0' });
await client.request('cursor.setNotes', { cursor: '0', notes: [[0, 60, 100, 1]] });
fs.rmSync(path.join(REPO, 'assets'), { recursive: true, force: true });
note('removed the simulated asset dir — repo left clean');

console.log(failureCount() === 0 ? '\nE4h: all checks passed' : `\nE4h: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
