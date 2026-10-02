import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { verify } from './e216-delivery-coherence.js';

type Wire = Record<string, unknown>;
const data = new URL('../../../context/evidence/data/e216-delivery-coherence/', import.meta.url);
const load = async (name: string): Promise<Wire> => JSON.parse(await readFile(new URL(name, data), 'utf8')) as Wire;
const row = (summary: Wire, dwell: string): Wire => ((summary.detours as Wire).table as Wire[]).find(r => r.dwell === dwell)!;

test('E216 trial 2 retains seen separate-callback detours and unseen same-callback detours', async () => {
  const summary = verify(await load('trial-2.json'));
  assert.deepEqual(row(summary, '-1'), { dwell: '-1', trials: 5, seen: 3, unseenEndpointP: 2, endpointNotP: 0, commandError: 0, foreignContentTicks: 1, inTickChanges: 0 });
  for (const dwell of ['0', '1', '2', '5', '10', '20', '50', '100', '250', '500']) {
    assert.equal(row(summary, dwell).seen, 5); assert.equal(row(summary, dwell).foreignContentTicks, 0);
  }
  assert.deepEqual((summary.composition as Wire[]).map(r => r.finalSide), ['Q', 'Q', 'Q']);
  for (const spin of summary.spins as Wire[]) { assert.equal(spin.changesInsideCallback, 0); assert.equal(spin.eventsDuringSpin, 0); }
  assert.equal(summary.stoppedReason, 'toggle scratchStep delay=0 did not restore');
  assert.equal(summary.eligible, false); assert.equal(summary.hostFenceProved, false);
});

test('E216 focused run retains step delivery for every same-callback detour', async () => {
  const report = await load('focused-1.json'), summary = verify(report);
  assert.deepEqual(row(summary, '-1'), { dwell: '-1', trials: 30, seen: 11, unseenEndpointP: 19, endpointNotP: 0, commandError: 0, foreignContentTicks: 11, inTickChanges: 0 });
  for (const detour of report.detours as Wire[]) assert.equal((detour.summary as Wire).qWitnessOnStepEvents, 4);
  for (const toggle of summary.coalescing as Wire[]) {
    assert.equal(toggle.trials, 5); assert.equal(toggle.coalesced, toggle.delay === -1 ? 5 : 0);
  }
  assert.equal(summary.stoppedReason, null);
});
