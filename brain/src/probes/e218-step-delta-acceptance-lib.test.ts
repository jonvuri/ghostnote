import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateArm, classifyTrial } from './e218-step-delta-acceptance-lib.js';

type Wire = Record<string, unknown>;
const p = [0, 128, 256, 384].map(cell => ({ channel: 0, cell, pitch: 60, fields: {} }));
const independent = { authorityAvailable: true, authorityNotes: p };

test('a confirmed P comparison equal to the independent read is clean', () => {
  const row: Wire = { compare: { comparison: 'match', stepWindowConfirmed: true, authorityNotes: p, diagnosticSnapshot: { notes: p } },
    status: { historicalSnapshot: { notes: p } }, independent, endpoint: 'P', injected: true };
  const s = classifyTrial(row);
  assert.equal(s.published, 3); assert.equal(s.foreignOutputs, 0); assert.equal(s.outputsDifferingFromAuthority, 0);
  assert.equal(s.independentOk, true); assert.equal(s.refusal, null);
});

test('Q notes or a set that differs from authority are foreign or differing', () => {
  const q = [{ channel: 0, cell: 1024, pitch: 72 }];
  const s = classifyTrial({ compare: { comparison: 'match', authorityNotes: q }, statusAfter: { historicalSnapshot: { notes: p.slice(1) } }, independent });
  assert.equal(s.foreignOutputs, 1); assert.equal(s.outputsDifferingFromAuthority, 2);
});

test('refusals expose no output and are counted by reason', () => {
  const rows = [{ refusal: 'step-window-changed' }, { compare: { comparison: 'step-window-changed', reason: 'step-window-changed' } },
    { exact: { reason: 'authority-step-window-changed' } }].map(r => ({ ...r, independent, summary: classifyTrial({ ...r, independent }) }));
  const a = aggregateArm(rows);
  assert.equal(a.published, 0); assert.equal(a.refused, 3);
  assert.deepEqual(a.refusals, { 'step-window-changed': 2, 'authority-step-window-changed': 1 });
  assert.equal(classifyTrial({ independent: { authorityAvailable: true, authorityNotes: [] } }).independentOk, false);
});

test('E218 retained reports verify with zero foreign or differing outputs', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const { verify } = await import('./e218-step-delta-acceptance.js');
  const dir = new URL('../../../context/evidence/data/e218-step-delta-acceptance/', import.meta.url);
  const names = (await readdir(dir)).filter(n => !n.startsWith('fixture') && !n.startsWith('config'));
  assert.equal(names.length, 10);
  for (const name of names) {
    const summary = verify(JSON.parse(await readFile(new URL(name, dir), 'utf8')) as Wire);
    assert.equal(summary.foreignOutputs, 0, name); assert.equal(summary.inventoryReason, 'inventory-outside-step-coverage', name);
    if (name !== 'native-1-diagnostic.json') {
      assert.equal(summary.outputsDifferingFromAuthority, 0, name); assert.equal(summary.independentFailures, 0, name);
      assert.equal(summary.stoppedReason, null, name);
    }
  }
  const window = verify(JSON.parse(await readFile(new URL('window-same-callback.json', dir), 'utf8')) as Wire);
  assert.deepEqual(window.refusals, { 'window-changed': 7, 'step-window-changed': 13 });
});
