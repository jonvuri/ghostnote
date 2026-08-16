import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RecordingTransport } from '../adapters/live/transport.js';
import { WIRE } from '../adapters/live/wiremap.js';
import { LiveStatusSink, ProductStatus, formatStatus, type StatusTarget } from './status.js';

const TARGET: StatusTarget = { generation: 'generation-1', project: 'Project A' };
const OTHER_TARGET: StatusTarget = { generation: 'generation-1', project: 'Project B' };

test('4a status: the live sink sends one status-only frame', async () => {
  const transport = new RecordingTransport().willReturn({
    accepted: true,
    generation: TARGET.generation,
    projectName: TARGET.project,
  });
  const sink = new LiveStatusSink(transport, async () => TARGET);
  await sink.push('Track copy · change-1', TARGET);
  assert.deepEqual(transport.frames, [{
    method: WIRE.statusPush,
    params: {
      value: 'Track copy · change-1',
      expectedGeneration: TARGET.generation,
      expectedProject: TARGET.project,
    },
  }]);
});

test('4a follow-up: a project switch prevents the status frame', async () => {
  const transport = new RecordingTransport();
  const sink = new LiveStatusSink(transport, async () => OTHER_TARGET);

  await assert.rejects(
    sink.push('Track copy · change-1', TARGET),
    /status target changed from Project A to Project B/,
  );
  assert.deepEqual(transport.frames, []);
});

test('4a follow-up: a reconnect to a new extension prevents the status frame', async () => {
  const transport = new RecordingTransport();
  const restarted = { generation: 'generation-2', project: TARGET.project };
  const sink = new LiveStatusSink(transport, async () => restarted);

  await assert.rejects(
    sink.push('Track copy · change-1', TARGET),
    /status target changed/,
  );
  assert.deepEqual(transport.frames, []);
});

test('4a follow-up: an unknown project identity fails closed', async () => {
  const transport = new RecordingTransport();
  const unknown = { generation: TARGET.generation, project: '' };
  const sink = new LiveStatusSink(transport, async () => unknown);

  await assert.rejects(
    sink.push('Track copy · change-1', unknown),
    /status target identity is unavailable/,
  );
  assert.deepEqual(transport.frames, []);
});

test('4a follow-up: the extension identity reply must match the write', async () => {
  const transport = new RecordingTransport().willReturn({
    accepted: true,
    generation: OTHER_TARGET.generation,
    projectName: OTHER_TARGET.project,
  });
  const sink = new LiveStatusSink(transport, async () => TARGET);

  await assert.rejects(
    sink.push('Track copy · change-1', TARGET),
    /acknowledged the status update for a different project/,
  );
});

test('4a follow-up: a switch during the wire call reports the extension refusal', async () => {
  const transport = new RecordingTransport().willReturn({
    accepted: false,
    error: 'status target does not match the foreground project',
    generation: OTHER_TARGET.generation,
    projectName: OTHER_TARGET.project,
  });
  const sink = new LiveStatusSink(transport, async () => TARGET);

  await assert.rejects(
    sink.push('Track copy · change-1', TARGET),
    /status target does not match the foreground project/,
  );
});

test('4a status: mixed managed results share one factual label', async () => {
  const values: string[] = [];
  const status = new ProductStatus({ push: async (value) => { values.push(value); } });
  await status.publish({
    categories: ['device-alternate'], changeId: 'change-1', seq: 1, target: TARGET,
    groupKey: 'instruction-1',
  });
  await status.publish({
    categories: ['clip-alternate'], changeId: 'change-2', seq: 2, target: TARGET,
    groupKey: 'instruction-1',
  });
  assert.deepEqual(values, [
    formatStatus(['device-alternate'], 'change-1'),
    formatStatus(['device-alternate', 'clip-alternate'], 'change-2'),
  ]);
});

test('4a status: a slower older write cannot replace the latest project write', async () => {
  const values: string[] = [];
  const status = new ProductStatus({ push: async (value) => { values.push(value); } });
  await status.publish({ categories: ['change'], changeId: 'change-2', seq: 2, target: TARGET });
  await status.publish({
    categories: ['track-copy'], changeId: 'change-1', seq: 1, target: TARGET,
  });
  assert.deepEqual(values, [formatStatus(['change'], 'change-2')]);
});

test('4a status: overlapping pushes finish with the latest project write', async () => {
  const values: string[] = [];
  let releaseFirst!: () => void;
  let firstStarted!: () => void;
  const release = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const started = new Promise<void>((resolve) => { firstStarted = resolve; });
  const status = new ProductStatus({
    push: async (value) => {
      values.push(value);
      if (values.length === 1) {
        firstStarted();
        await release;
      }
    },
  });

  const first = status.publish({
    categories: ['track-copy'], changeId: 'change-1', seq: 1, target: TARGET,
  });
  await started;
  const second = status.publish({
    categories: ['change'], changeId: 'change-2', seq: 2, target: TARGET,
  });
  releaseFirst();
  await Promise.all([first, second]);

  assert.deepEqual(values, [
    formatStatus(['track-copy'], 'change-1'),
    formatStatus(['change'], 'change-2'),
  ]);
});

test('4a status: an older mixed result enriches the latest write without replacing its id', async () => {
  const values: string[] = [];
  const status = new ProductStatus({ push: async (value) => { values.push(value); } });
  await status.publish({
    categories: ['clip-alternate'], changeId: 'change-2', seq: 2, target: TARGET,
    groupKey: 'instruction-1',
  });
  await status.publish({
    categories: ['device-alternate'], changeId: 'change-1', seq: 1, target: TARGET,
    groupKey: 'instruction-1',
  });
  assert.deepEqual(values, [
    formatStatus(['clip-alternate'], 'change-2'),
    formatStatus(['clip-alternate', 'device-alternate'], 'change-2'),
  ]);
});

test('4a follow-up: grouped results do not cross a project boundary', async () => {
  const values: string[] = [];
  const status = new ProductStatus({ push: async (value) => { values.push(value); } });
  await status.publish({
    categories: ['device-alternate'], changeId: 'change-1', seq: 1, target: TARGET,
    groupKey: 'instruction-1',
  });
  await status.publish({
    categories: ['clip-alternate'], changeId: 'change-2', seq: 2, target: OTHER_TARGET,
    groupKey: 'instruction-1',
  });
  assert.deepEqual(values, [
    formatStatus(['device-alternate'], 'change-1'),
    formatStatus(['clip-alternate'], 'change-2'),
  ]);
});

test('4a status: the extension repairs edits locally and has no polling path', () => {
  const source = readFileSync(join(
    process.cwd(), '..', 'extension', 'src', 'main', 'java', 'com', 'ghostnote',
    'extension', 'UiPanel.java',
  ), 'utf8');
  assert.match(source, /statusText\.addValueObserver\(this::statusChanged\)/);
  assert.match(source, /createdStatusStore\.addValueObserver\(this::storedStatusChanged\)/);
  assert.match(source, /statusText\.set\(lastPushedStatus\)/);
  assert.doesNotMatch(source, /scheduleTask|Timer|Bridge|Socket/);
});

test('4a follow-up: the extension checks project identity before the setting write', () => {
  const source = readFileSync(join(
    process.cwd(), '..', 'extension', 'src', 'main', 'java', 'com', 'ghostnote',
    'extension', 'handlers', 'StatusHandlers.java',
  ), 'utf8');
  const identityCheck = source.indexOf('if (expectedGeneration.isEmpty()');
  const settingWrite = source.indexOf('panel.pushStatus(value)');
  assert.ok(identityCheck >= 0);
  assert.ok(settingWrite > identityCheck);
  assert.match(source, /result\.addProperty\("generation", rig\.epochGeneration\)/);
  assert.match(source, /result\.addProperty\("projectName", projectName\)/);
});

test('4a status: product construction has one visible field and hidden owned state', () => {
  const root = join(
    process.cwd(), '..', 'extension', 'src', 'main', 'java', 'com', 'ghostnote', 'extension',
  );
  const panel = readFileSync(join(root, 'UiPanel.java'), 'utf8');
  const extension = readFileSync(join(root, 'GhostnoteExtension.java'), 'utf8');
  assert.equal((panel.match(/getStringSetting\(/g) ?? []).length, 3);
  assert.match(panel, /"Last change"/);
  assert.match(panel, /"Last change value"/);
  assert.match(panel, /"Observation record"/);
  assert.match(panel, /hideable\.hide\(\)/);
  assert.match(panel, /hideableStatusStore\.hide\(\)/);
  assert.doesNotMatch(panel, /getSignalSetting|getEnumSetting|Slot|Hardware|Bitmap/);
  assert.doesNotMatch(extension, /HardwarePanel\.create|DisplayWindow\.create/);
});
