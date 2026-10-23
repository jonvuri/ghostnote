import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { comparable, requireBaseline, BASELINE_TRACKS } from './phase9b-grid-doctor-614-baseline.js';
import { DATA } from './phase9b-grid-doctor-614.js';
import type { Wire } from './phase9b-grid-survey-read.js';

const check = (path: string) => JSON.parse(readFileSync(join(DATA, path), 'utf8'));
const recovery = check('614-guarded/recovery/baseline-check.json');
const secondPass = check('614-second-pass/baseline-check/baseline-check.json');

test('the recorded E339 recovery check and the 9b.6i check pass the baseline rules and agree', () => {
  requireBaseline(recovery); requireBaseline(secondPass);
  assert.deepEqual(comparable(secondPass), comparable(recovery));
  assert.deepEqual(BASELINE_TRACKS.map(([name]) => name), ['grid-probe', 'FX 1', 'Master']);
  // Counters restart with each extension instance; they are not baseline state.
  const restarted = structuredClone(secondPass); restarted.selection.revision = 1; restarted.selection.changes = 7;
  for (const m of restarted.control.modules) m.uuid = `reloaded-${m.index}`;
  assert.deepEqual(comparable(restarted), comparable(recovery));
  assert.ok(recovery.control.modules.every((m: Wire) => typeof m.uuid === 'string'), 'the capture keeps the uuid; the comparison drops it');
});

test('the baseline rules refuse scratch residue, an unmuted control, a used doctor, or a changed control', () => {
  const mutations: [(c: Wire) => void, RegExp][] = [
    [c => { c.tracks.tracks.splice(1, 0, { index: 1, name: 'gn-9b-write-x', type: 'Instrument', channelId: 'x' }); }, /baseline-tracks/],
    [c => { c.mixer.tracks[0].mute = false; }, /grid-probe-muted/],
    [c => { c.doctor.used = true; }, /doctor-used/],
    [c => { c.doctor.phase = 1; }, /doctor-phase/],
    [c => { c.control.moduleCount = 5; }, /5 !== 4/],
    [c => { c.status.bound = true; }, /reader-status/],
    [c => { c.selectionAfter = { ...c.selectionAfter, trackIndex: 0 }; }, /operator-selection-changed/],
    [c => { c.host.hostVersion = '6.0.6'; }, /host-version/],
    [c => { c.devices.devices.push({ index: 1, name: 'Amplify', enabled: true }); }, /control-device/],
  ];
  for (const [mutate, expected] of mutations) {
    const changed = structuredClone(secondPass); mutate(changed);
    assert.throws(() => requireBaseline(changed), expected);
  }
});
