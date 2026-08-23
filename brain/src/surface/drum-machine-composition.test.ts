import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { z } from 'zod';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { NATIVE_CATALOG_PATH } from '../composition/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import {
  drumMachineCompositionInputSchema, runDrumMachineComposition,
} from './drum-machine-composition.js';
import { callTool, TOOLS } from './tools.js';
import { workspaceOf, type Workspace } from './workspace.js';

const PADS = [
  { midiNote: 36, deviceName: 'v1 Kick' },
  { midiNote: 38, deviceName: 'v1 Snare' },
  { midiNote: 42, deviceName: 'v1 Hat' },
  { midiNote: 46, deviceName: 'v0 Hat' },
];

function fixture(): { readonly fake: FakeAdapter; readonly workspace: Workspace; readonly trackId: string } {
  const fake = new FakeAdapter({ tracks: ['Drums'], scenes: 1 });
  const trackId = fake.model.visibleTracks()[0]!.channelId;
  const stash = new Stash({ now: () => 1 });
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter: fake,
    executor: new Executor(fake, {
      newId: () => `drum-change-${stash.log.list().length + 1}`,
      now: () => 2,
    }),
    stash,
    observationStore: new FakeObservationStore(),
  });
  return { fake, workspace, trackId };
}

test('d02-s1-schema: public input exposes notes and names but no native ids or placement controls', () => {
  const tool = TOOLS.find((candidate) => candidate.name === 'compose_drum_machine');
  assert.ok(tool !== undefined);
  assert.equal(tool.kind, 'write');
  assert.deepEqual(tool.emits, ['device.insert', 'drumPad.insert']);
  const schema = JSON.stringify(z.toJSONSchema(z.object(drumMachineCompositionInputSchema)));
  for (const hidden of ['uuid', 'guid', 'preset', 'path', 'file', 'focus', 'selection', 'padChannel']) {
    assert.equal(schema.toLowerCase().includes(hidden.toLowerCase()), false, `${hidden} crossed the schema`);
  }
});

test('d02-s1-public: four notes reach four separate native pad devices and reverse as one change', async () => {
  const fx = fixture();
  const result = await callTool(fx.workspace, 'compose_drum_machine', {
    trackId: fx.trackId,
    pads: PADS,
  }) as Record<string, unknown>;

  assert.equal(result['applied'], true, JSON.stringify(result));
  assert.equal(result['containerKind'], 'Drum Machine');
  assert.equal((result['verification'] as { verified: boolean }).verified, true, JSON.stringify(result));
  assert.deepEqual(result['requested'], [
    { midiNote: 36, padChannel: 0, deviceName: 'v1 Kick' },
    { midiNote: 38, padChannel: 2, deviceName: 'v1 Snare' },
    { midiNote: 42, padChannel: 6, deviceName: 'v1 Hat' },
    { midiNote: 46, padChannel: 10, deviceName: 'v0 Hat' },
  ]);
  const track = fx.fake.model.findByChannelId(fx.trackId)!.track;
  assert.equal(track.devices.length, 1);
  assert.equal(track.devices[0]!.name, 'Drum Machine');
  assert.deepEqual(
    track.devices[0]!.drumPads!.map((devices, channel) =>
      devices[0] === undefined ? undefined : [channel, devices[0].name]).filter(Boolean),
    [[0, 'v1 Kick'], [2, 'v1 Snare'], [6, 'v1 Hat'], [10, 'v0 Hat']],
  );
  assert.equal(fx.workspace.changes.list().length, 1);

  const changeId = (result['change'] as { changeId: string }).changeId;
  const reversed = await callTool(fx.workspace, 'revert_change', { changeId }) as Record<string, unknown>;
  assert.equal(reversed['applied'], true, JSON.stringify(reversed));
  assert.deepEqual(reversed['caveats'], []);
  assert.deepEqual(track.devices, []);
});

test('d02-s1-refusals: duplicate and unreachable notes fail schema validation', async () => {
  for (const pads of [
    [{ midiNote: 36, deviceName: 'v1 Kick' }, { midiNote: 36, deviceName: 'v1 Snare' }],
    [{ midiNote: 35, deviceName: 'v1 Kick' }],
    [{ midiNote: 52, deviceName: 'v1 Kick' }],
  ]) {
    const fx = fixture();
    await assert.rejects(callTool(fx.workspace, 'compose_drum_machine', {
      trackId: fx.trackId,
      pads,
    }));
    assert.equal(fx.workspace.changes.list().length, 0);
  }
});

test('d02-s1-refusal: unknown and ambiguous exact names write nothing', async () => {
  const unknown = fixture();
  const result = await callTool(unknown.workspace, 'compose_drum_machine', {
    trackId: unknown.trackId,
    pads: [{ midiNote: 36, deviceName: 'No Such Device' }],
  }) as Record<string, unknown>;
  assert.equal(result['refused'], true);
  assert.equal(result['nothingWasWritten'], true);
  assert.equal(unknown.workspace.changes.list().length, 0);

  const directory = await mkdtemp(join(tmpdir(), 'ghostnote-d02-s1-'));
  try {
    const catalog = JSON.parse(await readFile(NATIVE_CATALOG_PATH, 'utf8')) as {
      devices: Record<string, unknown>[];
    };
    const device = catalog.devices.find((item) => item['name'] === 'v1 Kick');
    assert.ok(device !== undefined);
    catalog.devices.push({ ...device });
    const catalogPath = join(directory, 'catalog.json');
    await writeFile(catalogPath, JSON.stringify(catalog));
    const ambiguous = fixture();
    const refused = await runDrumMachineComposition(ambiguous.workspace, {
      trackId: ambiguous.trackId,
      pads: [{ midiNote: 36, deviceName: 'v1 Kick' }],
    }, { catalogPath }) as Record<string, unknown>;
    assert.equal(refused['refused'], true);
    assert.equal(ambiguous.workspace.changes.list().length, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('d02-s1-readback: a changed nested device reports unverified without hiding the change', async () => {
  const fx = fixture();
  const base = fx.workspace;
  const workspace: Workspace = Object.freeze({
    ...base,
    async apply(
      ops: Parameters<Workspace['apply']>[0],
      options?: Parameters<Workspace['apply']>[1],
    ) {
      const change = await base.apply(ops, options);
      const track = fx.fake.model.findByChannelId(fx.trackId)!.track;
      const pad = track.devices[0]?.drumPads?.[0]?.[0];
      if (pad !== undefined) pad.name = 'Changed after write';
      return change;
    },
  });
  const result = await runDrumMachineComposition(workspace, {
    trackId: fx.trackId,
    pads: [{ midiNote: 36, deviceName: 'v1 Kick' }],
  }, { readbackAttempts: 1 }) as Record<string, unknown>;
  assert.equal((result['verification'] as { verified: boolean }).verified, false, JSON.stringify(result));
  assert.equal(fx.workspace.changes.list().length, 1);
});

test('d02-s1-readback: an unavailable post-write inventory reports the recorded partial change', async () => {
  const fx = fixture();
  const base = fx.workspace;
  const workspace: Workspace = Object.freeze({
    ...base,
    async drumPads() {
      throw new Error('fixture inventory failure');
    },
  });
  const result = await runDrumMachineComposition(workspace, {
    trackId: fx.trackId,
    pads: [{ midiNote: 36, deviceName: 'v1 Kick' }],
  }, { readbackAttempts: 1 }) as Record<string, unknown>;
  assert.equal((result['verification'] as { verified: boolean }).verified, false, JSON.stringify(result));
  assert.equal(typeof (result['change'] as { changeId?: string }).changeId, 'string');
  assert.equal(fx.workspace.changes.list().length, 1);
});

test('d02-s1-readback: extra pad content prevents a verified result', async () => {
  for (const addExtra of [
    (fx: ReturnType<typeof fixture>) => fx.fake.model.findByChannelId(fx.trackId)!
      .track.devices[0]!.drumPads![0]!.push({
        name: 'Human device', enabled: true, paramsLive: true, params: [],
      }),
    (fx: ReturnType<typeof fixture>) => fx.fake.model.findByChannelId(fx.trackId)!
      .track.devices[0]!.drumPads![1]!.push({
        name: 'Human device', enabled: true, paramsLive: true, params: [],
      }),
  ]) {
    const fx = fixture();
    const base = fx.workspace;
    const workspace: Workspace = Object.freeze({
      ...base,
      async apply(
        ops: Parameters<Workspace['apply']>[0],
        options?: Parameters<Workspace['apply']>[1],
      ) {
        const change = await base.apply(ops, options);
        addExtra(fx);
        return change;
      },
    });
    const result = await runDrumMachineComposition(workspace, {
      trackId: fx.trackId,
      pads: [{ midiNote: 36, deviceName: 'v1 Kick' }],
    }, { readbackAttempts: 1 }) as Record<string, unknown>;
    assert.equal((result['verification'] as { verified: boolean }).verified, false);
  }
});

test('d02-s1-partial: an unrecorded apply error does not claim that nothing was written', async () => {
  const fx = fixture();
  const workspace: Workspace = Object.freeze({
    ...fx.workspace,
    async apply(ops: Parameters<Workspace['apply']>[0]) {
      await fx.fake.apply({ ops });
      throw new Error('the completion receipt was lost');
    },
  });
  const result = await runDrumMachineComposition(workspace, {
    trackId: fx.trackId,
    pads: [{ midiNote: 36, deviceName: 'v1 Kick' }],
  }) as Record<string, unknown>;

  assert.equal(result['completionUnknown'], true);
  assert.equal(result['nothingWasWritten'], undefined);
  assert.equal(fx.fake.model.findByChannelId(fx.trackId)!.track.devices.length, 1);
  assert.equal(fx.workspace.changes.list().length, 0);
});

test('d02-s1-reversal: changed pad content blocks owned container removal', async () => {
  const fx = fixture();
  const result = await callTool(fx.workspace, 'compose_drum_machine', {
    trackId: fx.trackId,
    pads: PADS,
  }) as Record<string, unknown>;
  const track = fx.fake.model.findByChannelId(fx.trackId)!.track;
  track.devices[0]!.drumPads![0]![0]!.name = 'Human edit';
  const changeId = (result['change'] as { changeId: string }).changeId;
  const reversed = await callTool(fx.workspace, 'revert_change', { changeId }) as Record<string, unknown>;
  assert.match(
    ((reversed['failed'] as { error?: string }[] | undefined)?.[0]?.error ?? ''),
    /pad structure changed/,
  );
  assert.equal(track.devices.length, 1);
});

test('d02-s1-reversal: an extra nested pad device blocks owned container removal', async () => {
  const fx = fixture();
  const result = await callTool(fx.workspace, 'compose_drum_machine', {
    trackId: fx.trackId,
    pads: PADS,
  }) as Record<string, unknown>;
  const track = fx.fake.model.findByChannelId(fx.trackId)!.track;
  track.devices[0]!.drumPads![0]!.push({
    name: 'Human device', enabled: true, paramsLive: true, params: [],
  });
  const changeId = (result['change'] as { changeId: string }).changeId;
  const reversed = await callTool(fx.workspace, 'revert_change', { changeId }) as Record<string, unknown>;
  assert.match(
    ((reversed['failed'] as { error?: string }[] | undefined)?.[0]?.error ?? ''),
    /pad structure changed/,
  );
  assert.equal(track.devices.length, 1);
});
