import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  percentile, requireFullTrackWindow, stableDeviceRead, type DeviceRead,
} from './phase4a-device-scale-lib.js';

const row = (trackChannelId: string, itemCount: number): DeviceRead => ({
  trackChannelId,
  trackPosition: 7,
  itemCount,
  bankSize: 16,
  count: itemCount,
  devices: Array.from({ length: itemCount }, (_, index) => ({ index, name: `Device ${index}` })),
});

test('4a sweep ignores a prior-track reply and needs two equal expected-track replies', async () => {
  const replies = [row('prior', 8), row('expected', 4), row('expected', 4)];
  const stable = await stableDeviceRead('expected', async () => replies.shift()!);
  assert.equal(stable.stable, true);
  assert.equal(stable.attempts, 3);
  assert.equal(stable.trackChannelId, 'expected');
  assert.equal(stable.itemCount, 4);
});

test('4a sweep reports a row that does not stabilize within the attempt bound', async () => {
  let count = 0;
  const unstable = await stableDeviceRead('expected', async () => row('expected', count++), 4);
  assert.equal(unstable.stable, false);
  assert.equal(unstable.attempts, 4);
});

test('4a sweep includes the visible count in its stability check', async () => {
  const first = row('expected', 4);
  const replies = [first, { ...first, count: 3 }, first];
  const unstable = await stableDeviceRead('expected', async () => replies.shift()!, 3);
  assert.equal(unstable.stable, false);
});

test('4a full-window guard refuses a blind measurement', () => {
  assert.doesNotThrow(() => requireFullTrackWindow(52, 64));
  assert.throws(() => requireFullTrackWindow(52, 16), /measurement window has 16/);
});

test('4a percentile sorts samples and uses the E5 rank rule', () => {
  assert.equal(percentile([8, 1, 5, 3], 0.5), 5);
  assert.equal(percentile([8, 1, 5, 3], 0.95), 8);
});

test('4a live replies self-name the cursor track and rig.stats reports resources', () => {
  const devices = readFileSync('../extension/src/main/java/com/ghostnote/extension/handlers/DeviceHandlers.java', 'utf8');
  const core = readFileSync('../extension/src/main/java/com/ghostnote/extension/handlers/CoreHandlers.java', 'utf8');
  assert.match(devices, /"trackChannelId"/);
  assert.match(devices, /"bankSize"/);
  assert.match(core, /"deviceSlots"/);
  assert.match(core, /"typedParameterHandles"/);
  assert.match(core, /"remotePageCursors"/);
  assert.match(core, /"directParameterObservers"/);
});

test('4a selected defaults match in RigConfig and the fake model', () => {
  const config = readFileSync('../extension/src/main/java/com/ghostnote/extension/RigConfig.java', 'utf8');
  const fake = readFileSync('src/adapters/fake/model.ts', 'utf8');
  assert.match(config, /tracks = 256/);
  assert.match(config, /scenes = 128/);
  assert.match(config, /cursorPool = 8/);
  assert.match(config, /deviceBank = 16/);
  assert.match(config, /fineSteps = 512/);
  assert.match(config, /noteReadSteps = 2048/);
  assert.match(config, /paramHandles = 64/);
  assert.match(config, /remotePages = 16/);
  assert.match(fake, /trackBankSize = 256/);
  assert.match(fake, /sceneBankSize = 128/);
  assert.match(fake, /deviceBankSize = 16/);
});
