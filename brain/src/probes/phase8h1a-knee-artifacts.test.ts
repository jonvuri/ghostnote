/** Check the retained 8h1a artifacts against the claims in E225. Each value is recomputed from raw samples. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fixtureSoundingCells, selectLimit, verifyArm, type Wire } from './phase8h1a-knee-lib.js';
import { ORIGINAL_CONFIG_SHA256 } from './phase8g5-consumers-lib.js';

const DATA = join(process.cwd(), '..', 'context', 'evidence', 'data', 'phase8h1a-knee');
const read = (path: string): Wire => JSON.parse(readFileSync(join(DATA, path), 'utf8')) as Wire;
const noteSteps = (sample: Wire): number =>
  Number(((sample.top as Wire[]).find(row => String(row.name).endsWith('proxy.NoteStep')) ?? { instances: 0 }).instances);
const heapAt = (arm: Wire, label: string): Wire => (arm.heaps as Wire[]).find(row => row.label === label)!;
const MiB = 2 ** 20;

test('8h1a artifacts: the original config is recorded for restoration', () => {
  assert.equal(read('config-entry.json').originalSha256, ORIGINAL_CONFIG_SHA256);
});

test('8h1a artifacts: occupancy arms are exact and their summary is recomputed', () => {
  const points = [1000, 4096, 16384, 65536, 131072].map(count => verifyArm(read(`arm-occupancy-${count}.json`)));
  for (const point of points) assert.equal(point.exact, true, String(point.value));
  // E131 pairs only up to its 4,096-note source limit.
  assert(points[0]!.exactReadMs! > 40_000 && points[1]!.exactReadMs! > 40_000);
  assert.equal(points[2]!.exactReadMs, undefined);
  assert.deepEqual((read('summary-occupancy.json').selection as Wire).occupancy, selectLimit(points));
  assert(points[4]!.warmReadMs! > 3_000 && points[4]!.warmReadMs! < 3_500, 'the 131,072-note warm read is about 3.3 s');
});

test('8h1a artifacts: width costs no heap at constant sounding cells', () => {
  const after = [524_288, 1_048_576, 4_194_304].map(width => {
    const arm = read(`width/arm-width-${width}.json`);
    assert.equal(verifyArm(arm).exact, true);
    return { live: Number(heapAt(arm, 'after-cold-bind').liveBytes), steps: noteSteps(heapAt(arm, 'after-cold-bind')) };
  });
  for (const row of after) {
    assert(Math.abs(row.live - after[0]!.live) < 4 * MiB, 'live heap stays within 4 MiB across a 8x width range');
    assert(Math.abs(row.steps - 2 * fixtureSoundingCells(4096, 1_048_576)) < 512, 'two proxies hold one step per sounding cell');
  }
  const selection = read('width/summary-width.json').selection as Wire;
  assert.equal((selection.width as Wire).largestPassing, 4_194_304);
});

test('8h1a artifacts: a bound proxy holds one host step per sounding cell', () => {
  const arm = read('width/arm-sustain-1048576.json');
  assert.equal(verifyArm(arm).exact, true);
  const added = noteSteps(heapAt(arm, 'after-cold-bind')) - noteSteps(heapAt(arm, 'arm-entry'));
  assert.equal(added, arm.soundingCells); assert.equal(added, 1_048_576);
  const bytes = Number(heapAt(arm, 'after-cold-bind').liveBytes) - Number(heapAt(arm, 'arm-entry').liveBytes);
  const perCell = bytes / added;
  assert(perCell > 300 && perCell < 400, `about 350 bytes per sounding cell, measured ${perCell.toFixed(0)}`);
});

test('8h1a artifacts: observer allocation is linear and the cursor slot bank is half of it', () => {
  const live = [512, 1024, 2048, 4096].map(count => Number((read(`observers/load-${count}.json`).heap as Wire).liveBytes));
  for (let index = 1; index < live.length; index++) assert(live[index]! > live[index - 1]!);
  const perObserver = (live[3]! - live[0]!) / (4096 - 512);
  assert(perObserver > 60 * 1024 && perObserver < 80 * 1024, `about 70 KiB per observer, measured ${(perObserver / 1024).toFixed(1)}`);
  const cursor0 = Number((read('observers/load-4096-cursor0.json').heap as Wire).liveBytes);
  assert(live[3]! - cursor0 > 120 * MiB, 'zero cursor slots remove more than 120 MiB at 4,096 observers');
  const arm = read('observers/arm-4096-cursor0.json');
  assert.equal(verifyArm(arm).exact, true, 'a binding without a cursor slot bank reads exactly');
  // Open finding: enrichment host work grows with allocated observers.
  const host = (path: string): number => {
    const rows = (read(path).warmReads as Wire[]).map(row => Number(row.enrichmentHostWorkMs)).sort((a, b) => a - b);
    return rows[Math.floor(rows.length / 2)]!;
  };
  assert(host('observers/arm-4096-cursor0.json') > 4 * host('width/arm-width-131072.json'));
});

test('8h1a artifacts: unsubscribed observers have no measurable cost', () => {
  for (const count of [512, 1024, 2048, 4096]) {
    const arms = read(`observers/control-${count}.json`).arms as Wire[];
    const live = arms.map(arm => Number((arm.heap as Wire).liveBytes));
    assert(Math.max(...live) - Math.min(...live) < 8 * MiB, `${count}: subscription does not change the live heap`);
    for (const arm of arms) assert(Number(arm.pingP95Ms) < 30);
  }
});

test('8h1a artifacts: bursts drain inside the host-work limit and restore the fixture', () => {
  for (const name of ['burst-native-occ4096', 'burst-reconstruct-occ16384', 'burst-reconstruct-occ65536']) {
    const burst = read(`${name}.json`);
    assert.equal(burst.error, undefined); assert.equal(burst.complete, false); assert.equal(burst.eligible, false);
    const phases = burst.phases as Wire[];
    assert.deepEqual(phases.map(phase => phase.to), [12, 0]);
    for (const phase of phases) {
      assert.deepEqual((phase.read as Wire).issues, []);
      assert.equal((phase.drain as Wire).coordinates, 262_144);
      assert(Number((phase.drain as Wire).drainMs) < 1_000);
    }
  }
});
