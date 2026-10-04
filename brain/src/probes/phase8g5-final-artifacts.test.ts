import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DIRECTORY, PINS, verifyFinalArtifacts, verifyRole } from './phase8g5-final-artifacts.js';
import type { Wire } from './phase8g5-consumers-lib.js';

const read = (file: string): Wire => JSON.parse(readFileSync(new URL(file, DIRECTORY), 'utf8')) as Wire;
const consumers = read('consumers.json');
const row = (report: Wire, label: string): Wire => (report.cases as Wire[]).find(value => value.label === label)!;
function refuses(mutate: (report: Wire) => void, role: Parameters<typeof verifyRole>[0] = 'consumers', file = 'consumers.json'): void {
  const report = structuredClone(file === 'consumers.json' ? consumers : read(file)); mutate(report);
  assert.throws(() => verifyRole(role, report));
}

test('all retained 8g5 files keep their bytes and meanings', async () => {
  const result = await verifyFinalArtifacts();
  assert.equal(result.files, 11); assert.equal(result.eligible, false);
});

test('a changed byte with a rehashed report still needs its meaning check', async () => {
  const pin = PINS.find(value => value.file === 'consumers.json')!;
  const mutated = structuredClone(consumers); (row(mutated, 'warm-read-only').comparison as Wire).comparison = 'field-mismatch';
  const bytes = Buffer.from(JSON.stringify(mutated));
  await assert.rejects(verifyFinalArtifacts(async file => file === pin.file ? bytes : readFileSync(new URL(file, DIRECTORY))), /size|hash/);
  assert.throws(() => verifyRole('consumers', mutated));
});

test('consumer mutants refuse', () => {
  // Equal wrong cache and authority values.
  refuses(report => { const value = row(report, 'field-only').comparison as Wire;
    for (const notes of [(value.diagnosticSnapshot as Wire).notes, value.authorityNotes] as Wire[][]) {
      const note = notes.find(item => item.channel === 3 && item.cell === 768)!; (note.fields as Wire).velocity = .5; } });
  refuses(report => { (row(report, 'public-patch').staleApply as Wire).applied = true; });
  refuses(report => { (row(report, 'cold-read-only').comparison as Wire).eligible = true; });
  refuses(report => { (row(report, 'unhealthy-window').comparison as Wire).authorityNotes = []; });
  refuses(report => { (row(report, 'native-delete').retainedAfterChange as Wire).historicalSnapshot = {}; });
  refuses(report => { (row(report, 'unhealthy-exact').exact as Wire).cacheMembershipUsed = true; });
  refuses(report => { ((row(report, 'unavailable-authority').exactRefusals as Wire[])[0]!).readMode = 'exact-fallback'; });
  refuses(report => { ((report.pureControls as Wire).decisions as Wire).staleBase = { mode: 'shadow-preparation-only', reason: 'current', overlayCurrent: true }; });
  // A non-legacy stable writer effect, such as a changed pan, is not accepted.
  refuses(report => { const raw = row(report, 'public-patch').raw as Wire;
    const note = ((raw.channels as Wire[])[0]!.notes as Wire[]).find(item => item.x === 512)!; note.pan = .75; });
  refuses(report => { (report.cases as Wire[]).splice(4, 1); });
});

test('diagnostic mutants refuse', () => {
  refuses(report => { const trials = report.trials as Wire[]; ((trials.at(-1)!.exact as Wire).authorityNotes as Wire[]).push({ channel: 0, cell: 8, pitch: 72, fields: {} }); },
    'detour-oracle-diagnostic', 'detour-window-exact-1-oracle-budget-diagnostic.json');
  refuses(report => { report.shadowMarker = '8g2b-shadow-step-delta-v1'; }, 'detour', 'detour-same-callback.json');
  refuses(report => { const patch = (report.cases as Wire[])[2]!; (patch.application as Wire).applied = false; },
    'stable-writer-diagnostic', 'consumers-2-stable-writer-diagnostic.json');
  refuses(report => { report.stateValuesRestored = false; }, 'protected-baseline', 'new3-final-baseline.json');
  refuses(report => { (report.info as Wire).mismatches = 1; }, 'research-final', 'research-final-info.json');
});
