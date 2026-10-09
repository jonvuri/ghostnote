/**
 * 8i5: a remote selector names host page and control positions. A page lists only the slots that hold a control,
 * so the inventory is compact and a host position is not an array position.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import type { FakeDevice } from '../adapters/fake/model.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { resolveRemoteSelector, type RemotePageState } from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from './tools.js';
import { workspaceOf } from './workspace.js';

type Wire = Record<string, any>;

/** Blur as Bitwig reported it on 2026-10-09: `Common` holds controls at host positions 0, 1, 2, 3, and 7. */
function blur(): FakeDevice {
  const control = (index: number, name: string, value: number) => ({ index, name, value, modulatedValue: value });
  return {
    name: 'Blur', enabled: true, paramsLive: true, params: [{ id: 'CONTENTS/MIX', name: 'Mix', value: 0.5 }],
    remotePages: [
      { name: 'Common', controls: [
        control(0, 'Size', 0.2), control(1, 'Time', 0.3), control(2, 'Feedback', 0.4),
        control(3, 'Damping', 0.1), control(7, 'Mix', 0.5),
      ] },
      { name: 'Tone', controls: [control(2, 'Low Cut', 0.0), control(5, 'High Cut', 1.0)] },
    ],
  };
}

function fixture(device: FakeDevice = blur()) {
  const fake = new FakeAdapter({ tracks: ['gn-blur'], scenes: 1 });
  const row = fake.model.visibleTracks()[0]!;
  row.devices.push(device);
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `c-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(), documents: new IdentityRegistry(),
  });
  return { fake, row, device, workspace, trackId: row.channelId };
}

const setting = (trackId: string, pagePosition: number, pageName: string, controlPosition: number,
  controlName: string, normalizedValue: number) => ({
  kind: 'remote', device: { trackId, devicePosition: 0 }, pagePosition, pageName, controlPosition, controlName,
  normalizedValue,
});

const pages = (controls: RemotePageState['controls']): RemotePageState[] => [{ index: 0, name: 'Common', controls }];
const remote = (index: number, name: string) => ({ index, name, value: 0, modulatedValue: 0, isBeingMapped: false });

test('8i5 selector: the resolver uses host indices and checks names and uniqueness', () => {
  const sparse = pages([remote(0, 'Size'), remote(3, 'Damping'), remote(7, 'Mix')]);
  const at = (controlIndex: number, controlName: string, pageName = 'Common') =>
    resolveRemoteSelector(sparse, { pageIndex: 0, pageName, controlIndex, controlName });
  const found = at(7, 'Mix');
  assert.equal(found.found && found.control.name, 'Mix');
  assert.deepEqual(at(2, 'Mix'), { found: false, reason: 'absent' }, 'array position 2 is not host position 2');
  assert.deepEqual(at(3, 'Mix'), { found: false, reason: 'changed' }, 'a stale name refuses');
  assert.deepEqual(at(7, 'Mix', 'Tone'), { found: false, reason: 'changed' }, 'a stale page name refuses');
  assert.deepEqual(resolveRemoteSelector(sparse, { pageIndex: 4, pageName: 'Common', controlIndex: 7,
    controlName: 'Mix' }), { found: false, reason: 'absent' });
  const duplicate = pages([remote(7, 'Mix'), remote(7, 'Mix')]);
  assert.deepEqual(resolveRemoteSelector(duplicate, { pageIndex: 0, pageName: 'Common', controlIndex: 7,
    controlName: 'Mix' }), { found: false, reason: 'ambiguous' });
});

test('8i5 Blur: the returned Common/Mix selector at position 7 writes, verifies, and reverses', async () => {
  const fx = fixture();
  const read = await callTool(fx.workspace, 'read_device_controls', {
    device: { trackId: fx.trackId, devicePosition: 0 }, view: 'remote-controls' }, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const common = read['remotePages'][0];
  assert.deepEqual(common.controls.map((item: Wire) => [item.position, item.name]),
    [[0, 'Size'], [1, 'Time'], [2, 'Feedback'], [3, 'Damping'], [7, 'Mix']]);

  const set = await callTool(fx.workspace, 'set_device_controls', { settings: [
    setting(fx.trackId, 0, 'Common', 7, 'Mix', 0.8),
    setting(fx.trackId, 1, 'Tone', 5, 'High Cut', 0.6),
  ] }, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  assert.equal(set['verified'], true, JSON.stringify(set).slice(0, 600));
  assert.equal(set['failure'], undefined);
  assert.equal(fx.device.remotePages![0]!.controls[4]!.value, 0.8, 'the exact Mix control changed');
  assert.equal(fx.device.remotePages![0]!.controls[3]!.value, 0.1, 'Damping, at array position 3, is unchanged');
  assert.equal(fx.device.remotePages![1]!.controls[1]!.value, 0.6);

  const changeIds = (set['parameterChanges'] as Wire[]).flatMap((route) => route['changes'].map((item: Wire) =>
    item['changeId'] as string));
  for (const changeId of changeIds.reverse()) {
    assert.equal((await callTool(fx.workspace, 'revert_change', { changeId }, AGENT_NATIVE_TOOL_PROFILE) as Wire)
      ['applied'], true);
  }
  assert.equal(fx.device.remotePages![0]!.controls[4]!.value, 0.5);
  assert.equal(fx.device.remotePages![1]!.controls[1]!.value, 1.0);
});

test('8i5 Blur: invalid, stale, and ambiguous selectors refuse before any write with a known code', async () => {
  const cases: { readonly name: string; readonly settings: Wire[]; readonly code: string; readonly reason: string;
    readonly mutate?: (device: FakeDevice) => void }[] = [
    { name: 'array position', settings: [setting('', 0, 'Common', 4, 'Mix', 0.8)], code: 'absent',
      reason: 'remote-selector-absent' },
    { name: 'stale control name', settings: [setting('', 0, 'Common', 7, 'Wet', 0.8)], code: 'target-changed',
      reason: 'remote-selector-changed' },
    { name: 'stale page name', settings: [setting('', 0, 'Overview', 7, 'Mix', 0.8)], code: 'target-changed',
      reason: 'remote-selector-changed' },
    { name: 'duplicate index', settings: [setting('', 0, 'Common', 7, 'Mix', 0.8)], code: 'target-changed',
      reason: 'remote-selector-ambiguous',
      mutate: (device) => { device.remotePages![0]!.controls.push({ index: 7, name: 'Mix', value: 0.5 }); } },
  ];
  for (const item of cases) {
    const fx = fixture();
    item.mutate?.(fx.device);
    const result = await callTool(fx.workspace, 'set_device_controls', {
      settings: item.settings.map((entry) => ({ ...entry, device: { trackId: fx.trackId, devicePosition: 0 } })),
    }, AGENT_NATIVE_TOOL_PROFILE) as Wire;
    const text = `${item.name}: ${JSON.stringify(result).slice(0, 500)}`;
    assert.equal(result['failure']?.code, item.code, text);
    assert.equal(result['reason'], item.reason, text);
    assert.equal(result['nothingWasWritten'], true, text);
    assert.deepEqual(result['failure'].effects, [], text);
    assert.equal(fx.workspace.changes.list().length, 0, text);
    assert.equal(fx.device.remotePages![0]!.controls[4]!.value, 0.5, text);
  }
});

test('8i5 Blur: a later stale selector keeps earlier verified writes as a partial result', async () => {
  const fx = fixture();
  fx.device.params.push({ id: 'CONTENTS/SIZE', name: 'Size', value: 0.2 });
  const result = await callTool(fx.workspace, 'set_device_controls', { settings: [
    { kind: 'direct', device: { trackId: fx.trackId, devicePosition: 0 }, parameterId: 'CONTENTS/MIX',
      normalizedValue: 0.9 },
    setting(fx.trackId, 0, 'Common', 7, 'Wet', 0.8),
  ] }, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const text = JSON.stringify(result).slice(0, 600);
  assert.equal(result['failure']?.code, 'partial', text);
  assert.equal(result['partialSuccess'], true, text);
  assert.equal(result['failure'].effects.length, 1, text);
  assert.equal(fx.device.params[0]!.value, 0.9);
  assert.equal(fx.device.remotePages![0]!.controls[4]!.value, 0.5);
});
