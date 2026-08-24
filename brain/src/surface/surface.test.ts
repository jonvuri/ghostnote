/**
 * The tool surface, offline — the coverage it had none of until session 3d.
 *
 * Until now the MCP server's only exercise was `probe:e09`, which needs a live
 * DAW, a fixture project and a human to run it. Everything here runs in
 * milliseconds against the Phase-0 fake, through the SAME code path the server
 * registers, so a case that passes here passes over the wire.
 *
 * The session's exit criteria, and where each one is:
 *
 *   T-roundtrip  1. a batch of note edits applies, verifies and reverts end to
 *                   end THROUGH THE TOOLS, with no probe involved
 *   T-record     2. every batch that applied is recorded, and no tool can reach
 *                   a route around the recording
 *   T-moved      3. every reversal is planned against the launcher window, and
 *                   `moved` is produced by the surface for the first time — a
 *                   clip replaced by an identical one is REFUSED
 *   T-partition  4. the partition is asserted: names, annotations, and what each
 *                   tool may emit
 *   T-words      5/6. no name, description, parameter or emitted text uses a
 *                   banned word — the mechanisms, or this project's own jargon
 *   T-surface    7. every tool runs offline
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { control } from '../adapters/fake/control.js';
import { ProjectModel } from '../adapters/fake/model.js';
import {
  AddressUnresolvedError, BankWindowOverflowError, BlindSpotError, ContractVersionError,
  InvalidOpError, NOTE_PROP_FIDELITY, SlotOccupiedError, StaleAddressError, WireDriftError,
  addressKey, chain as chainAt, clip as clipAt, clipMetadata as metadataAt,
  notes as notesAt, scene as sceneAt, slot as slotAt, track as trackAt,
  type BitwigAdapter, type NoteRecord, type Op,
} from '../contract/index.js';
import { StaleExtensionError } from '../deploy.js';
import { Executor, UnprotectedWriteError } from '../engine/index.js';
import { decodeObservationRecord, FakeObservationStore } from '../observation/index.js';
import {
  ChangesetNotFoundError, EmptySliceError, Stash, type BoundaryVerdict,
} from '../stash/index.js';
import { refusalOf, verdictSentence } from './report.js';
import { SURFACE_WORDS_BANNED, bannedWordsIn } from './naming.js';
import {
  ANNOTATIONS, REMOVAL_OPS, TOOLS, WRITE_TOOLS_THAT_MAY_REMOVE, callTool, registerTools,
} from './tools.js';
import { TOOL_DESCRIPTION_VERSION } from './description-cohort.js';
import { captureWorkspaceChanges, workspaceOf, type Workspace } from './workspace.js';
import { formatStatus, type StatusTarget } from './status.js';

const HERE = dirname(fileURLToPath(import.meta.url));

interface Fixture {
  readonly fake: FakeAdapter;
  readonly stash: Stash;
  readonly workspace: Workspace;
  readonly observationStore: FakeObservationStore;
  readonly trackA: string;
  readonly trackB: string;
  /** Every op whose adapter call reached staging, in order — how `emits` is checked. */
  readonly sent: Op[];
  /** Product status values in push order. */
  readonly statuses: string[];
}

/**
 * ⚠ The ONE place a fixture is allowed to stop being the fake's own behaviour,
 * and it may only weaken an OBSERVATION — never a write.
 *
 * A destructive tool has to say something true when its confirming readback does
 * not arrive, and that state is unreachable through a cooperative fake: the fake
 * always answers completely and always answers correctly. So this hook rewrites
 * one numbered `devices()` answer, which is exactly what a live blind spot or a
 * delete that did not take effect looks like from the tool's side.
 */
interface FixtureHooks {
  readonly devices?: (
    call: number,
    actual: Awaited<ReturnType<FakeAdapter['devices']>>,
  ) => Awaited<ReturnType<FakeAdapter['devices']>>;
  readonly statusPush?: (value: string, target: StatusTarget) => Promise<void>;
  /** Inject a state change before a numbered revision read. */
  readonly beforeRevision?: (call: number, fake: FakeAdapter) => void;
}

/** Two tracks, eight rows, nothing written yet. */
function fixture(
  hooks: FixtureHooks = {},
  observationStore = new FakeObservationStore(),
): Fixture {
  const fake = new FakeAdapter({ tracks: ['gn-A', 'gn-B'], scenes: 8 });
  const sent: Op[] = [];
  let deviceReads = 0;
  let revisionReads = 0;
  // ⚠ A spy rather than a stub: everything is the fake's own behaviour, and the
  // only addition is a record of what was asked for. A stub here would let a
  // tool's declared `emits` be checked against a world that does not push back.
  const watched: BitwigAdapter = {
    hello: () => fake.hello(),
    resolve: (refs) => fake.resolve(refs),
    tracks: () => fake.tracks(),
    devices: async (trackRef) => {
      const actual = await fake.devices(trackRef);
      deviceReads += 1;
      return hooks.devices?.(deviceReads, actual) ?? actual;
    },
    drumPads: (container) => fake.drumPads(container),
    read: (sel) => fake.read(sel),
    settle: (budget) => fake.settle(budget),
    revision: () => {
      revisionReads += 1;
      hooks.beforeRevision?.(revisionReads, fake);
      return fake.revision();
    },
    contentSince: (since) => fake.contentSince(since),
    preserveSelection: (work) => fake.preserveSelection(work),
    showClipInEditor: (clipRef, verifiedAt) => fake.showClipInEditor(clipRef, verifiedAt),
    close: () => fake.close(),
    apply: async (batch) => {
      const receipt = await fake.apply(batch);
      sent.push(...batch.ops);
      return receipt;
    },
  };
  const stash = new Stash({ now: () => 1 });
  const statuses: string[] = [];
  let n = 0;
  const executor = new Executor(watched, { newId: () => `change-${++n}`, now: () => 1_000_000 });
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter: watched,
    executor,
    stash,
    observationStore,
    observationCaptureOptions: { newId: () => `observation-${++n}`, now: () => 1_000_000 },
    statusSink: {
      push: async (value, target) => {
        await hooks.statusPush?.(value, target);
        statuses.push(value);
      },
    },
  });
  const [a, b] = fake.model.visibleTracks();
  return {
    fake, stash, workspace, observationStore,
    trackA: a!.channelId, trackB: b!.channelId, sent, statuses,
  };
}

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, ...over,
});

/** Every JSON an agent could be handed, so the word guard can read all of it. */
const emitted: string[] = [];

async function call(fx: Fixture, name: string, args: unknown = {}): Promise<Record<string, unknown>> {
  const result = await callTool(fx.workspace, name, args) as Record<string, unknown>;
  emitted.push(`${name}: ${JSON.stringify(result)}`);
  return result;
}

const refused = (result: Record<string, unknown>): boolean => result['refused'] === true;

// --- exit criterion 4: the partition ----------------------------------------

test('T-partition: the names are the boundary, and no verb sits on two of them', () => {
  const names = TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length, 'two tools share a name');

  const byClass = {
    read: TOOLS.filter((t) => t.kind === 'read').map((t) => t.name),
    focus: TOOLS.filter((t) => t.kind === 'focus').map((t) => t.name),
    write: TOOLS.filter((t) => t.kind === 'write').map((t) => t.name),
    destructive: TOOLS.filter((t) => t.kind === 'destructive').map((t) => t.name),
  };
  // ⚠ Not vacuous: a partition with an empty side would pass every check below.
  assert.ok(byClass.read.length > 0 && byClass.focus.length > 0
    && byClass.write.length > 0 && byClass.destructive.length > 0);

  // ⚠⚠ The host's "don't ask again for this tool" is a blanket grant on a NAME
  // (E20c), so a destructive verb sharing a name with a benign one would hand out
  // destruction with the benign grant.
  const benign = new Set([...byClass.read, ...byClass.focus, ...byClass.write]);
  for (const name of byClass.destructive) {
    assert.equal(benign.has(name), false, `${name} is both destructive and benign`);
  }
});

function schemaPaths(
  value: unknown,
  matches: (key: string, item: unknown) => boolean,
  path: readonly string[] = [],
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => schemaPaths(item, matches, [...path, String(index)]));
  }
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => [
    ...(matches(key, item) ? [[...path, key].join('.')] : []),
    ...schemaPaths(item, matches, [...path, key]),
  ]);
}

test('D01: every public tool schema uses only homogeneous arrays', () => {
  assert.equal(TOOLS.length, 46);
  const incompatible: string[] = [];
  for (const tool of TOOLS) {
    const validator = tool.inputValidator ?? z.object(tool.inputSchema);
    const current = z.toJSONSchema(validator, { io: 'input' });
    const draft7 = z.toJSONSchema(validator, { target: 'draft-7', io: 'input' });
    incompatible.push(
      ...schemaPaths(current, (key) => key === 'prefixItems')
        .map((path) => `${tool.name}: ${path}`),
      ...schemaPaths(draft7, (key, item) => key === 'items' && Array.isArray(item))
        .map((path) => `${tool.name}: ${path}`),
    );
  }
  assert.deepEqual(incompatible, []);
});

test('D01: recurrence remains one exact length-and-mask pair on all five tools', () => {
  const lowLevel = (lengthAndMask: readonly number[]) => ({ clips: [{
    trackId: 'track-a', row: 0, lengthBeats: 4,
    notes: [{
      startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1,
      recurrence: lengthAndMask,
    }],
  }] });
  const musical = (lengthAndMask: readonly number[]) => ({
    schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
    targets: [{
      clip: { trackId: 'track-a', row: 0 }, channel: 0, write: 'merge',
      operations: [{ op: 'generate', source: { kind: 'notes', notes: [{
        startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1,
        recurrence: lengthAndMask,
      }] } }],
    }],
  });
  const inputFor = (name: string, recurrence: readonly number[]) => {
    if (name === 'write_notes') return lowLevel(recurrence);
    if (name === 'add_clip') return lowLevel(recurrence);
    if (name === 'start_clip_music_operation') {
      return { operation: 'generation', patch: musical(recurrence) };
    }
    return musical(recurrence);
  };

  for (const name of [
    'generate_clip_music', 'transform_clip_music', 'start_clip_music_operation',
    'write_notes', 'add_clip',
  ]) {
    const tool = TOOLS.find((candidate) => candidate.name === name)!;
    const validator = tool.inputValidator ?? z.object(tool.inputSchema);
    assert.equal(validator.safeParse(inputFor(name, [4, 5])).success, true, name);
    assert.equal(validator.safeParse(inputFor(name, [4])).success, false, name);
    assert.equal(validator.safeParse(inputFor(name, [4, 5, 6])).success, false, name);
  }
});

test('T-partition: every tool carries the annotations its class implies', () => {
  for (const spec of TOOLS) {
    const expected = ANNOTATIONS[spec.kind];
    if (spec.kind === 'read') {
      assert.equal(expected.readOnlyHint, true, `${spec.name} must be readOnlyHint`);
      assert.equal(expected.destructiveHint, false);
    }
    if (spec.kind === 'destructive') {
      assert.equal(expected.destructiveHint, true, `${spec.name} must be destructiveHint`);
      assert.equal(expected.readOnlyHint, false);
    }
    if (spec.kind === 'focus') {
      assert.equal(expected.readOnlyHint, false, `${spec.name} changes UI focus`);
      assert.equal(expected.destructiveHint, false);
      assert.equal(expected.idempotentHint, true, `${spec.name} has the same result when repeated`);
    }
    if (spec.kind === 'write') {
      assert.equal(expected.readOnlyHint, false, `${spec.name} writes`);
      assert.equal(expected.destructiveHint, false, `${spec.name} is not the destructive surface`);
    }
  }
  // ⚠ Nothing may READ its own annotations into existence: they come from the
  // class table, so this also proves the table has an entry for every class.
  assert.deepEqual(Object.keys(ANNOTATIONS).sort(), ['destructive', 'focus', 'read', 'write']);
});

test('T-partition: only a destructive tool may remove, and the one crossing is named', () => {
  for (const spec of TOOLS) {
    const removes = spec.emits.filter((op) => REMOVAL_OPS.has(op));
    if (spec.kind === 'destructive') {
      assert.ok(removes.length > 0, `${spec.name} is on the destructive surface and removes nothing`);
      continue;
    }
    if (spec.kind === 'read') {
      assert.deepEqual([...spec.emits], [], `${spec.name} is a read tool and must write nothing`);
      continue;
    }
    if (spec.kind === 'focus') {
      assert.deepEqual([...spec.emits], [], `${spec.name} changes no project content`);
      continue;
    }
    if (removes.length > 0) {
      assert.ok(
        spec.name in WRITE_TOOLS_THAT_MAY_REMOVE,
        `${spec.name} can emit ${removes.join(', ')} from the ordinary write surface without an `
        + 'entry in WRITE_TOOLS_THAT_MAY_REMOVE. Widening a benign tool to remove things is the '
        + 'failure this design cannot recover from — the operator may already have granted it.',
      );
    }
  }
  // The exemption list must not outlive its members either.
  for (const name of Object.keys(WRITE_TOOLS_THAT_MAY_REMOVE)) {
    const spec = TOOLS.find((t) => t.name === name);
    assert.ok(spec !== undefined, `${name} is exempted and does not exist`);
    assert.ok(
      spec!.emits.some((op) => REMOVAL_OPS.has(op)),
      `${name} no longer removes anything — drop the exemption rather than leaving it standing`,
    );
  }
});

test('T-device-alternate lifecycle: 3f-i hands stable identities and event operations to 3g', () => {
  // 3g owns the wording review and version freeze. This closes 3f on the
  // mechanical cohort beneath that wording: public identity, permission grain,
  // input identity and the typed contract events each operation can emit.
  const expected = [
    ['inspect_device_alternates', 'read', [], ['trackId', 'containerPosition']],
    ['create_device_alternates', 'write',
      ['device.insert', 'chain.rename', 'chain.create'],
      ['trackId', 'containerType', 'names']],
    ['fill_device_alternate', 'write', ['chain.relocate'],
      ['trackId', 'containerPosition', 'alternateName', 'sourceDevicePositions', 'mode']],
    ['switch_device_alternate', 'write', ['chain.activate'],
      ['trackId', 'containerPosition', 'alternateName']],
    ['keep_device_alternate', 'destructive',
      ['chain.relocate', 'device.delete', 'device.relocate'],
      ['trackId', 'containerPosition', 'alternateName']],
    ['remove_device_alternate', 'destructive',
      ['device.insert', 'chain.rename', 'chain.create', 'chain.relocate',
        'chain.activate', 'device.delete', 'device.relocate'],
      ['trackId', 'containerPosition', 'alternateName', 'containerType']],
  ];
  const actual = expected.map(([name]) => {
    const spec = TOOLS.find((tool) => tool.name === name)!;
    return [spec.name, spec.kind, [...spec.emits], Object.keys(spec.inputSchema)];
  });
  assert.deepEqual(actual, expected);
});

test('2g: only confirmed creation, musical, and track-copy specs declare observation results', () => {
  assert.deepEqual(
    TOOLS.filter((spec) => spec.observation !== undefined)
      .map((spec) => [spec.name, spec.observation]),
    [
      ['generate_clip_music', 'musical-generation'],
      ['transform_clip_music', 'musical-transformation'],
      ['copy_clip_down', 'clip-block'],
      ['copy_track', 'copy-track'],
      ['create_device_alternates', 'device-alternate'],
    ],
  );
});

test('3g-d: one direct mixed instruction keeps two confirmed event identities', async () => {
  const fx = fixture();
  const begun = await call(fx, 'record_observation', {
    operation: 'begin',
    requestedScope: 'mixed',
    rawScope: { request: 'Change the sound and its launcher clip.', writes: ['device', 'clip'] },
  });
  await call(fx, 'add_clip', {
    clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4, notes: [note()] }],
  });
  const device = await call(fx, 'create_device_alternates', {
    trackId: fx.trackB, containerType: 'effect', names: ['clean', 'wide'],
  });
  const clip = await call(fx, 'copy_clip_down', {
    trackId: fx.trackA, row: 0, quantization: '1', mode: 'continue_or_synced',
  });
  assert.equal(typeof device['managedEventId'], 'string');
  assert.equal(typeof clip['managedEventId'], 'string');
  assert.notEqual(device['managedEventId'], clip['managedEventId']);

  await call(fx, 'inspect_device_alternates', {
    trackId: fx.trackB,
    containerPosition: (device['structure'] as { container: { devicePosition: number } })
      .container.devicePosition,
  });
  await call(fx, 'record_observation', {
    operation: 'enrich',
    instructionId: begun['instructionId'],
    rationale: 'Both requested objects were changed independently.',
    operatorResponse: 'accepted',
  });

  const stored = decodeObservationRecord((await fx.observationStore.read()).value);
  assert.equal(stored.entries.length, 3, 'inspection and ordinary setup add no result rows');
  const instruction = stored.entries[0];
  assert.equal(instruction?.type, 'instruction-observation');
  assert.deepEqual(
    instruction?.type === 'instruction-observation' ? instruction.rawScope : undefined,
    { request: 'Change the sound and its launcher clip.', writes: ['device', 'clip'] },
  );
  assert.deepEqual(
    instruction?.type === 'instruction-observation' ? instruction.resultIds : [],
    [device['managedEventId'], clip['managedEventId']],
  );
  const events = stored.entries.slice(1);
  assert.deepEqual(events.map((entry) => entry.type), ['managed-event', 'managed-event']);
  assert.deepEqual(
    events.map((entry) => entry.type === 'managed-event' ? entry.structure : undefined),
    ['device-alternate', 'clip-block'],
  );
  assert.equal(new Set(events.map((entry) => entry.correlationId)).size, 1);
  assert.equal(new Set(events.map((entry) => entry.type === 'instruction-observation'
    ? '' : entry.executionId)).size, 2);
  assert.ok(stored.entries.every((entry) => entry.descriptionVersion === TOOL_DESCRIPTION_VERSION));
});

test('3g-d: track copy is ordinary use, and refusals and no-action context add no event', async () => {
  const fx = fixture();
  const refusedCreation = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA, containerType: 'effect', names: ['same', 'same'],
  });
  assert.equal(refusedCreation['refused'], true);
  const copied = await call(fx, 'copy_track', { trackId: fx.trackA, name: 'ordinary copy' });
  assert.equal(typeof copied['ordinaryUseId'], 'string');

  const veto = await call(fx, 'record_observation', {
    operation: 'begin', requestedScope: 'unsupported', rawScope: 'Change project tempo.',
  });
  await call(fx, 'record_observation', {
    operation: 'enrich', instructionId: veto['instructionId'], operatorResponse: 'vetoed',
  });
  const silent = await call(fx, 'record_observation', {
    operation: 'begin', requestedScope: 'device-only', rawScope: { devices: [] },
  });
  await call(fx, 'record_observation', {
    operation: 'enrich', instructionId: silent['instructionId'],
  });

  const stored = decodeObservationRecord((await fx.observationStore.read()).value);
  assert.deepEqual(stored.entries.map((entry) => entry.type), [
    'ordinary-use', 'instruction-observation', 'instruction-observation',
  ]);
  assert.equal(stored.entries[0]?.type === 'ordinary-use'
    ? stored.entries[0].result.copiedTrackId
    : undefined, (copied['copied'] as { trackId: string }).trackId);
  assert.deepEqual(
    stored.entries.filter((entry) => entry.type === 'instruction-observation')
      .map((entry) => entry.operatorResponse),
    ['vetoed', 'silent'],
  );
});

test('3g-d: an inserted but unconfirmed device container creates no managed event', async () => {
  const fx = fixture();
  for (const id of [
    'a9ffacb5-33e9-4fc7-8621-b1af31e410ef',
    'f2dcfe9a-7b66-4c84-984a-b25685a1c21a',
  ]) {
    assert.equal((await call(fx, 'add_device', {
      devices: [{ trackId: fx.trackA, from: 'bitwig', id }],
    }))['applied'], true);
  }
  const result = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA, containerType: 'effect', names: ['outside view'],
  });
  assert.equal(result['creationConfirmed'], undefined);
  assert.equal(result['managedEventId'], undefined);
  assert.equal((await fx.observationStore.read()).value, '');
});

test('3g-d: a record failure reports a confirmed project write as partial success', async () => {
  const fx = fixture({}, new FakeObservationStore(1));
  const result = await call(fx, 'copy_track', { trackId: fx.trackA, name: 'surviving copy' });
  assert.equal(result['partialSuccess'], true);
  const projectWrite = result['projectWrite'] as {
    succeeded: boolean; result: { copyConfirmed: boolean; copied: { trackId: string } };
  };
  assert.equal(projectWrite.succeeded, true);
  assert.equal(projectWrite.result.copyConfirmed, true);
  assert.ok(fx.fake.model.visibleTracks().some(
    (track) => track.channelId === projectWrite.result.copied.trackId,
  ));
  assert.equal(
    (result['observationUpdate'] as { succeeded: boolean }).succeeded,
    false,
  );
});

test('3g-d: MCP registration uses the same instrumented executor as direct calls', async () => {
  const fx = fixture();
  const handlers = new Map<string, (args: unknown) => Promise<unknown>>();
  const server = {
    registerTool(name: string, _surface: unknown, handler: (args: unknown) => Promise<unknown>) {
      handlers.set(name, handler);
    },
  };
  registerTools(server as never, fx.workspace);
  const response = await handlers.get('copy_track')!({
    trackId: fx.trackA, name: 'MCP copy',
  }) as { content: { text: string }[] };
  const result = JSON.parse(response.content[0]!.text) as Record<string, unknown>;
  assert.equal(typeof result['ordinaryUseId'], 'string');
  const stored = decodeObservationRecord((await fx.observationStore.read()).value);
  assert.equal(stored.entries.length, 1);
  assert.equal(stored.entries[0]?.type, 'ordinary-use');
});

test('3g-e: raw view and descriptive report use the same complete record', async () => {
  const fx = fixture();
  const begun = await call(fx, 'record_observation', {
    operation: 'begin', requestedScope: 'device-only', rawScope: 'Compare a sound.',
  });
  const copied = await call(fx, 'copy_track', { trackId: fx.trackA, name: 'coarse copy' });
  await call(fx, 'record_observation', {
    operation: 'enrich',
    instructionId: begun['instructionId'],
    operatorResponse: 'vetoed',
  });

  const raw = await call(fx, 'read_observation_record') as {
    record: { entries: unknown[] };
    canonicalJson: string;
  };
  const stored = (await fx.observationStore.read()).value;
  assert.equal(raw.canonicalJson, stored);
  assert.deepEqual(raw.record, decodeObservationRecord(stored));
  assert.equal(raw.record.entries.length, 2);

  const report = await call(fx, 'report_observations') as {
    totals: Record<string, number>;
    managedEvents: Record<string, number>;
    ordinaryUses: Record<string, number>;
    operatorResponses: Record<string, number>;
    crossTab: { descriptionVersion: string; actualResults: Record<string, number> }[];
  };
  assert.equal(report.totals['entries'], raw.record.entries.length);
  assert.equal(report.totals['managedEvents'], 0);
  assert.equal(report.totals['ordinaryUses'], 1);
  assert.deepEqual(report.managedEvents, { deviceAlternate: 0, clipBlock: 0 });
  assert.deepEqual(report.ordinaryUses, { copyTrack: 1 });
  assert.deepEqual(report.operatorResponses, { silent: 0, accepted: 0, vetoed: 1 });
  assert.deepEqual(report.crossTab[0]?.actualResults, {
    deviceAlternateEvents: 0,
    clipBlockEvents: 0,
    copyTrackUses: 1,
    generationUses: 0,
    transformationUses: 0,
  });
  assert.equal(report.crossTab[0]?.descriptionVersion, TOOL_DESCRIPTION_VERSION);
  assert.equal(typeof copied['ordinaryUseId'], 'string');
});

test('3g-e cleanup regression: several track removals run from high position to low', async () => {
  const fx = fixture();
  const removed = await call(fx, 'delete_track', {
    trackIds: [fx.trackA, fx.trackB],
  });
  assert.equal(removed['applied'], true);
  assert.deepEqual(
    fx.sent.filter((op) => op.op === 'track.delete')
      .map((op) => op.op === 'track.delete' ? op.track.channelId : undefined),
    [fx.trackB, fx.trackA],
  );
  assert.equal(fx.fake.model.visibleTracks().some((track) => track.channelId === fx.trackA), false);
  assert.equal(fx.fake.model.visibleTracks().some((track) => track.channelId === fx.trackB), false);

  const duplicateFx = fixture();
  const refusedDuplicate = await call(duplicateFx, 'delete_track', {
    trackIds: [duplicateFx.trackA, duplicateFx.trackA],
  });
  assert.equal(refusedDuplicate['refused'], true);
  assert.deepEqual(duplicateFx.sent, []);
  assert.ok(duplicateFx.fake.model.visibleTracks().some(
    (track) => track.channelId === duplicateFx.trackA,
  ));
});

test('4a: status names track, device, clip, mixed, and reversal changes', async () => {
  const copyFx = fixture();
  const copied = await call(copyFx, 'copy_track', {
    trackId: copyFx.trackA, name: 'ordinary copy',
  });
  const namingId = (copied['namingChange'] as { changeId: string }).changeId;
  assert.equal(copyFx.statuses.at(-1), formatStatus(['track-copy'], namingId));

  const mixedFx = fixture();
  await call(mixedFx, 'add_clip', {
    clips: [{ trackId: mixedFx.trackA, row: 0, lengthBeats: 4, notes: [note()] }],
  });
  mixedFx.statuses.length = 0;
  const begun = await call(mixedFx, 'record_observation', {
    operation: 'begin', requestedScope: 'mixed', rawScope: 'Change sound and clip.',
  });
  const device = await call(mixedFx, 'create_device_alternates', {
    trackId: mixedFx.trackB, containerType: 'effect', names: ['clean', 'wide'],
  });
  assert.equal(device['creationConfirmed'], true);
  assert.match(mixedFx.statuses.at(-1) ?? '', /^Device alternate · change-/);
  const clip = await call(mixedFx, 'copy_clip_down', {
    trackId: mixedFx.trackA, row: 0, quantization: '1', mode: 'continue_or_synced',
  });
  assert.equal(clip['creationConfirmed'], true);
  assert.equal(
    mixedFx.statuses.at(-1),
    formatStatus(['device-alternate', 'clip-alternate'], clip['changeId'] as string),
  );
  await call(mixedFx, 'record_observation', {
    operation: 'enrich', instructionId: begun['instructionId'], complete: true,
  });

  const revertFx = fixture();
  const renamed = await call(revertFx, 'rename_track', {
    tracks: [{ trackId: revertFx.trackA, name: 'renamed' }],
  });
  const reversed = await call(revertFx, 'revert_change', { changeId: renamed['changeId'] });
  assert.equal(
    revertFx.statuses.at(-1),
    formatStatus(['reversal'], reversed['changeId'] as string),
  );
});

test('4a: refusal and a zero-write reversal preserve the prior status', async () => {
  const fx = fixture();
  const copied = await call(fx, 'copy_track', { trackId: fx.trackA, name: 'copy' });
  const prior = fx.statuses.at(-1);

  const refused = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA, containerType: 'effect', names: ['same', 'same'],
  });
  assert.equal(refused['refused'], true);
  assert.equal(fx.statuses.at(-1), prior);

  const zero = await call(fx, 'revert_change', { changeId: copied['changeId'] });
  assert.equal(zero['applied'], false);
  assert.match(zero['nothingToPutBack'] as string, /nothing was written/);
  assert.equal(fx.statuses.at(-1), prior);
});

test('4a follow-up: a project-bound status failure is returned with the tool result', async () => {
  let target: StatusTarget | undefined;
  const fx = fixture({
    statusPush: async (_value, pushedTarget) => {
      target = pushedTarget;
      throw new Error('status target changed from Project A to Project B');
    },
  });
  const expectedTarget = await fx.fake.revision();
  const renamed = await call(fx, 'rename_track', {
    tracks: [{ trackId: fx.trackA, name: 'renamed without status' }],
  });

  assert.equal(renamed['applied'], true);
  assert.deepEqual(target, {
    generation: expectedTarget.generation,
    project: expectedTarget.project,
  });
  assert.deepEqual(renamed['statusUpdate'], {
    succeeded: false,
    error: 'status target changed from Project A to Project B',
  });
  assert.deepEqual(fx.statuses, []);
});

test('4a: concurrent execution scopes capture only their own recorded changes', async () => {
  const fx = fixture();
  let releaseFirst!: () => void;
  let firstRecorded!: () => void;
  const release = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const recorded = new Promise<void>((resolve) => { firstRecorded = resolve; });

  const first = captureWorkspaceChanges(fx.workspace, async (scoped) => {
    const change = await scoped.apply([{
      op: 'track.rename', track: trackAt(fx.trackA), name: 'first concurrent rename',
    }]);
    firstRecorded();
    await release;
    return change.take.id;
  });
  await recorded;
  const second = await captureWorkspaceChanges(fx.workspace, async (scoped) => {
    const change = await scoped.apply([{
      op: 'track.rename', track: trackAt(fx.trackB), name: 'second concurrent rename',
    }]);
    return change.take.id;
  });
  releaseFirst();
  const firstDone = await first;

  assert.deepEqual(firstDone.changes.map((change) => change.take.id), [firstDone.result]);
  assert.deepEqual(second.changes.map((change) => change.take.id), [second.result]);
  assert.notEqual(firstDone.result, second.result);
});

// --- exit criterion 7: it all runs, and what it sends is what it declared ----

test('4e-surface: plugin formats are explicit and the generic source is rejected', async () => {
  const fx = fixture();
  await call(fx, 'add_device', { devices: [
    {
      trackId: fx.trackA,
      from: 'vst3',
      id: 'D39D5B69D6AF42FA123456785A334D44',
    },
    { trackId: fx.trackA, from: 'clap', id: 'com.u-he.Zebra3' },
  ] });

  assert.deepEqual(
    fx.sent.filter((op) => op.op === 'device.insert').map((op) =>
      op.op === 'device.insert' ? op.source : undefined),
    [
      { from: 'vst3', classUid: 'D39D5B69D6AF42FA123456785A334D44' },
      { from: 'clap', id: 'com.u-he.Zebra3' },
    ],
  );
  await assert.rejects(call(fx, 'add_device', {
    devices: [{ trackId: fx.trackA, from: 'plugin', id: 'com.u-he.Zebra3' }],
  }));
});

test('4i-surface: native, VST3, CLAP, and preset inserts use ordinary tools and clean up exactly', async () => {
  const fx = fixture();
  const presetPath = join(HERE, '../../fixtures/Sampler/gn_sampler_bare.bwpreset');
  const added = await call(fx, 'add_device', { devices: [
    { trackId: fx.trackA, from: 'bitwig', id: 'native-device-uuid' },
    { trackId: fx.trackA, from: 'vst3', id: 'D39D5B69D6AF42FA123456785A334D44' },
    { trackId: fx.trackA, from: 'clap', id: 'com.u-he.Zebra3' },
    { trackId: fx.trackA, from: 'preset', path: presetPath },
  ] }) as {
    applied: boolean;
    added: { source: string; position: number }[];
  };
  assert.equal(added.applied, true, JSON.stringify(added));
  assert.deepEqual(added.added.map((item) => item.source), ['bitwig', 'vst3', 'clap', 'preset']);
  assert.deepEqual(added.added.map((item) => item.position), [0, 1, 2, 3]);

  const inspected = await call(fx, 'inspect_devices', { trackId: fx.trackA }) as {
    complete: boolean; devices: { position: number }[];
  };
  assert.equal(inspected.complete, true);
  assert.deepEqual(inspected.devices.map((item) => item.position), [0, 1, 2, 3]);

  const removed = await call(fx, 'delete_device', {
    devices: [0, 1, 2, 3].map((position) => ({ trackId: fx.trackA, position })),
  }) as { applied: boolean; verified: boolean };
  assert.equal(removed.applied, true, JSON.stringify(removed));
  assert.equal(removed.verified, true);
  assert.deepEqual(fx.fake.model.findByChannelId(fx.trackA)!.track.devices, []);
});

test('4i-surface: discovery returns more than eight ids and scalar writes verify and reverse', async () => {
  const fx = fixture();
  await call(fx, 'add_device', {
    devices: [{ trackId: fx.trackA, from: 'bitwig', id: 'metadata-device' }],
  });
  const modelDevice = fx.fake.model.findByChannelId(fx.trackA)!.track.devices[0]!;
  Object.assign(modelDevice.params[0]!, {
    display: '50.0 %',
    modulatedValue: 0.7,
    hasAutomation: true,
    origin: 0,
    discreteValueCount: 2,
    discreteValueNames: ['Off', 'On'],
  });
  modelDevice.remotePages = [{
    name: 'Filter',
    controls: [{ name: 'Cutoff', value: 0.25, modulatedValue: 0.4, hasAutomation: true }],
  }];

  const inventory = await call(fx, 'inspect_device_parameters', {
    device: { trackId: fx.trackA, devicePosition: 0 },
  }) as {
    standing: string;
    parameters: Array<Record<string, unknown>>;
    warnings: unknown[];
  };
  assert.equal(inventory.standing, 'stable');
  assert.ok(inventory.parameters.length > 8);
  assert.deepEqual(inventory.parameters[0], {
    id: 'P1',
    name: 'Param 1',
    normalizedValue: 0.5,
    display: '50.0 %',
    modulatedValue: 0.7,
    hasAutomation: true,
    origin: 0,
    discreteValueCount: 2,
    discreteValueNames: ['Off', 'On'],
  });
  assert.ok(inventory.warnings.length >= 2);

  const remotes = await call(fx, 'inspect_device_parameters', {
    device: { trackId: fx.trackA, devicePosition: 0 },
    view: 'remote-controls',
  }) as {
    standing: string;
    remotePages: { name: string; controls: { name: string }[] }[];
    warnings: unknown[];
  };
  assert.equal(remotes.standing, 'stable');
  assert.equal(remotes.remotePages[0]?.name, 'Filter');
  assert.equal(remotes.remotePages[0]?.controls[0]?.name, 'Cutoff');
  assert.ok(remotes.warnings.length >= 2);

  const set = await call(fx, 'set_parameter', { settings: [
    {
      kind: 'direct',
      device: { trackId: fx.trackA, devicePosition: 0 },
      parameterId: 'P1',
      normalizedValue: 0.75,
    },
    {
      kind: 'remote',
      device: { trackId: fx.trackA, devicePosition: 0 },
      pagePosition: 0,
      pageName: 'Filter',
      controlPosition: 0,
      controlName: 'Cutoff',
      normalizedValue: 0.6,
    },
  ] }) as {
    verified: boolean; changes: { changeId: string }[];
  };
  assert.equal(set.verified, true, JSON.stringify(set));
  assert.equal(modelDevice.params[0]!.value, 0.75);
  assert.equal(modelDevice.remotePages[0]!.controls[0]!.value, 0.6);

  const bypass = await call(fx, 'set_device_enabled', {
    settings: [{ trackId: fx.trackA, devicePosition: 0, enabled: false }],
  }) as { verified: boolean; changes: { changeId: string }[] };
  assert.equal(bypass.verified, true, JSON.stringify(bypass));
  assert.equal(modelDevice.enabled, false);

  assert.equal((await call(fx, 'revert_change', {
    changeId: bypass.changes[0]!.changeId,
  }))['applied'], true);
  assert.equal((await call(fx, 'revert_change', {
    changeId: set.changes[1]!.changeId,
  }))['applied'], true);
  assert.equal((await call(fx, 'revert_change', {
    changeId: set.changes[0]!.changeId,
  }))['applied'], true);
  assert.equal(modelDevice.enabled, true);
  assert.equal(modelDevice.params[0]!.value, 0.5);
  assert.equal(modelDevice.remotePages[0]!.controls[0]!.value, 0.25);
});

test('d02-s2-surface: nested and drum-pad DirectParameters verify and reverse', async () => {
  const fx = fixture();
  const track = fx.fake.model.findByChannelId(fx.trackA)!.track;
  const depth2 = {
    name: 'Leaf', paramsLive: true,
    params: [{ id: 'P2', name: 'Depth 2', value: 0.2 }],
  };
  const depth1 = {
    name: 'Inner container', paramsLive: true,
    params: [{ id: 'P1', name: 'Depth 1', value: 0.1 }],
    chains: [{ name: 'Inner', solo: false, id: 'd02-inner', devices: [depth2] }],
  };
  track.devices.push({
    name: 'Outer container', paramsLive: true, params: [],
    chains: [{ name: 'Outer', solo: false, id: 'd02-outer', devices: [depth1] }],
  });
  const pads: import('../adapters/fake/model.js').FakeDevice[][] = [];
  const padDevice = {
    name: 'Pad synth', paramsLive: true,
    params: [{ id: 'PAD1', name: 'Pad tone', value: 0.3 }],
  };
  pads[3] = [padDevice];
  track.devices.push({ name: 'Drum Machine', paramsLive: true, params: [], drumPads: pads });

  const result = await call(fx, 'set_parameter', { settings: [
    {
      kind: 'direct',
      device: {
        trackId: fx.trackA, devicePosition: 0,
        route: [{ through: 'named-container-entry', name: 'Outer', devicePosition: 0 }],
      },
      parameterId: 'P1', normalizedValue: 0.6,
    },
    {
      kind: 'direct',
      device: {
        trackId: fx.trackA, devicePosition: 0,
        route: [
          { through: 'named-container-entry', name: 'Outer', devicePosition: 0 },
          { through: 'named-container-entry', name: 'Inner', devicePosition: 0 },
        ],
      },
      parameterId: 'P2', normalizedValue: 0.7,
    },
    {
      kind: 'direct',
      device: {
        trackId: fx.trackA, devicePosition: 1,
        route: [{ through: 'drum-pad', channel: 3 }],
      },
      parameterId: 'PAD1', normalizedValue: 0.8,
    },
  ] }) as { verified: boolean; changes: { changeId: string }[] };

  assert.equal(result.verified, true, JSON.stringify(result));
  assert.deepEqual([depth1.params[0]!.value, depth2.params[0]!.value, padDevice.params[0]!.value],
    [0.6, 0.7, 0.8]);
  for (const change of [...result.changes].reverse()) {
    const reversed = await call(fx, 'revert_change', { changeId: change.changeId });
    assert.equal(reversed['applied'], true, JSON.stringify(reversed));
  }
  assert.deepEqual([depth1.params[0]!.value, depth2.params[0]!.value, padDevice.params[0]!.value],
    [0.1, 0.2, 0.3]);
});

test('d02-s3-surface: one stable cohort keeps scalar receipts and exact reversal', async () => {
  const fx = fixture();
  const device = {
    name: 'Cohort synth', paramsLive: true,
    params: Array.from({ length: 4 }, (_, index) => ({
      id: `P${index + 1}`, name: `Parameter ${index + 1}`, value: 0.1 * (index + 1),
    })),
  };
  fx.fake.model.findByChannelId(fx.trackA)!.track.devices.push(device);
  const baseline = device.params.map((parameter) => parameter.value);
  const generationBefore = fx.fake.model.parameterObservationGeneration;
  const requested = [0.55, 0.65, 0.75, 0.85];

  const result = await call(fx, 'set_parameter', {
    settings: device.params.map((parameter, index) => ({
      kind: 'direct',
      device: { trackId: fx.trackA, devicePosition: 0 },
      parameterId: parameter.id,
      normalizedValue: requested[index],
    })),
  }) as { verified: boolean; changes: { changeId: string }[] };

  assert.equal(result.verified, true, JSON.stringify(result));
  assert.equal(new Set(result.changes.map((change) => change.changeId)).size, 4);
  assert.equal(
    fx.fake.model.parameterObservationGeneration - generationBefore,
    2,
    'one complete preflight and one complete readback',
  );
  assert.deepEqual(device.params.map((parameter) => parameter.value), requested);

  const second = await call(fx, 'revert_change', { changeId: result.changes[1]!.changeId });
  assert.equal(second['applied'], true, JSON.stringify(second));
  assert.deepEqual(device.params.map((parameter) => parameter.value), [0.55, 0.2, 0.75, 0.85]);
  for (const index of [3, 2, 0]) {
    const reversed = await call(fx, 'revert_change', { changeId: result.changes[index]!.changeId });
    assert.equal(reversed['applied'], true, JSON.stringify(reversed));
  }
  assert.deepEqual(device.params.map((parameter) => parameter.value), baseline);
});

test('d02-s3-surface: mixed routes keep order and a failed cohort stops later settings', async () => {
  const fx = fixture();
  const track = fx.fake.model.findByChannelId(fx.trackA)!.track;
  track.devices.push(
    { name: 'First', paramsLive: true, params: [{ id: 'A', name: 'A', value: 0.1 }] },
    { name: 'Second', paramsLive: true, params: [{ id: 'B', name: 'B', value: 0.2 }] },
  );

  const result = await call(fx, 'set_parameter', { settings: [
    {
      kind: 'direct', device: { trackId: fx.trackA, devicePosition: 0 },
      parameterId: 'A', normalizedValue: 0.6,
    },
    {
      kind: 'direct', device: { trackId: fx.trackA, devicePosition: 1 },
      parameterId: 'missing', normalizedValue: 0.7,
    },
    {
      kind: 'direct', device: { trackId: fx.trackA, devicePosition: 1 },
      parameterId: 'B', normalizedValue: 0.8,
    },
  ] }) as { partialSuccess: boolean; verified: boolean; changes: { changeId: string }[] };

  assert.equal(result.partialSuccess, true, JSON.stringify(result));
  assert.equal(result.verified, false);
  assert.equal(result.changes.length, 1);
  assert.deepEqual(fx.sent.filter((op) => op.op === 'param.set').map((op) =>
    op.op === 'param.set' ? op.param.device.chainIndex : -1), [0]);
  assert.deepEqual(track.devices.map((item) => item.params[0]!.value), [0.6, 0.2]);
});

test('T-surface: every tool runs offline, and emits only what it declares', async () => {
  const fx = fixture();
  const ran = new Set<string>();

  /** Run one tool and check what actually went out against its declaration. */
  const exercise = async (name: string, args: unknown): Promise<Record<string, unknown>> => {
    const before = fx.sent.length;
    const result = await call(fx, name, args);
    const spec = TOOLS.find((t) => t.name === name)!;
    const sent = fx.sent.slice(before).map((op) => op.op);
    for (const op of sent) {
      assert.ok(
        spec.emits.includes(op),
        `${name} sent ${op}, which is not in its declared emits [${spec.emits.join(', ')}]`,
      );
    }
    ran.add(name);
    return result;
  };

  // -- reading first: an agent with no ids has nowhere else to start.
  const connection = await exercise('check_connection', {});
  assert.equal(connection['reachable'], true);

  const rawObservations = await exercise('read_observation_record', {}) as {
    record: { entries: unknown[] };
  };
  assert.deepEqual(rawObservations.record.entries, []);
  assert.equal((await exercise('report_observations', {}) as {
    totals: { entries: number };
  }).totals.entries, 0);

  const listed = await exercise('list_tracks', {}) as {
    tracks: { trackId: string; name: string }[];
  };
  assert.ok(listed.tracks.some((t) => t.trackId === fx.trackA && t.name === 'gn-A'));
  assert.equal(listed.tracks.length, 4, 'two instrument tracks, an effect return and the master');

  // -- writing.
  const created = await exercise('add_clip', {
    clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4, notes: [note({ pitch: 64 })] }],
  });
  assert.equal(created['applied'], true, JSON.stringify(created));

  assert.equal(
    (await exercise('write_notes', {
      clips: [{ trackId: fx.trackA, row: 0, notes: [note({ startBeats: 1, pitch: 67 })] }],
    }))['applied'],
    true,
  );

  const read = await exercise('read_clip', { trackId: fx.trackA, row: 0 }) as {
    clipExists: boolean; lengthBeats: number; notes: NoteRecord[];
  };
  assert.equal(read.clipExists, true);
  // ⚠ An id that names nothing must not read as an empty slot: both are simply
  // absent from a snapshot, and only one of them is worth telling an agent.
  const nowhere = await call(fx, 'read_clip', { trackId: 'no-such-track', row: 0 });
  assert.equal(nowhere['readable'], false);
  assert.match(nowhere['why'] as string, /does not name a track/);
  assert.equal(read.lengthBeats, 4);
  assert.deepEqual(read.notes.map((n) => n.pitch).sort(), [64, 67]);

  const geometry = await exercise('inspect_clip_block', {
    trackId: fx.trackA, firstRow: 0, lastRow: 0,
  }) as { contiguous: boolean; boundaryBelow: string };
  assert.equal(geometry.contiguous, true);
  assert.equal(geometry.boundaryBelow, 'empty');

  const copied = await exercise('copy_clip_down', {
    trackId: fx.trackA,
    row: 0,
    quantization: '1',
    mode: 'continue_or_synced',
    useLoopStartAsQuantizationReference: false,
  });
  assert.equal(copied['applied'], true, JSON.stringify(copied));
  assert.equal(copied['clickLaunchVerified'], true, JSON.stringify(copied));

  const focused = await exercise('show_changed_clip', {
    changeId: copied['changeId'], target: { trackId: fx.trackA, row: 1 },
  });
  assert.equal(focused['navigated'], true, JSON.stringify(focused));
  assert.deepEqual(focused['target'], { trackId: fx.trackA, row: 1 });

  assert.equal((await exercise('set_clip_launch', {
    clips: [{
      trackId: fx.trackA,
      row: 1,
      quantization: '1/4',
      mode: 'from_start',
      useLoopStartAsQuantizationReference: true,
    }],
  }))['applied'], true);

  const metadata = {
    name: 'gn-long', color: { red: 31, green: 159, blue: 223 },
    lengthBeats: 16, playStartBeats: 2, loopEnabled: true,
    loopStartBeats: 1, loopEndBeats: 17,
  };
  const metadataResult = await exercise('set_clip_metadata', {
    clips: [{ trackId: fx.trackA, row: 1, metadata }],
  }) as {
    applied: boolean;
    clips: { metadata: typeof metadata; metadataVerified: boolean }[];
  };
  assert.equal(metadataResult.applied, true);
  assert.equal(metadataResult.clips[0]?.metadataVerified, true);
  assert.deepEqual(metadataResult.clips[0]?.metadata, metadata);

  const launched = await exercise('launch_clip', {
    trackId: fx.trackA, row: 1, quantization: 'none', mode: 'from_start',
  }) as { applied: boolean; playback: { isPlaying: boolean } };
  assert.equal(launched.applied, true);
  assert.equal(launched.playback.isPlaying, true);

  const generated = await exercise('generate_clip_music', {
    schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
    targets: [{
      clip: { trackId: fx.trackA, row: 0 }, channel: 1, write: 'merge',
      operations: [{
        op: 'generate', source: { kind: 'chord', symbol: 'Cm', octave: 4 },
        placement: { kind: 'stack', startBeats: 0, durationBeats: 1 }, velocity: 90,
      }],
    }],
  });
  assert.equal(generated['applied'], true, JSON.stringify(generated));
  assert.equal(typeof generated['musicalUseId'], 'string');

  const transformed = await exercise('transform_clip_music', {
    schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
    targets: [{
      clip: { trackId: fx.trackA, row: 1 }, channel: 0, write: 'replace',
      operations: [{ op: 'transpose', semitones: 12 }],
    }],
  });
  assert.equal(transformed['applied'], true, JSON.stringify(transformed));
  assert.equal(typeof transformed['musicalUseId'], 'string');

  const backgroundStartAt = fx.sent.length;
  const background = await exercise('start_clip_music_operation', {
    operation: 'generation',
    patch: {
      schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
      targets: [{
        clip: { trackId: fx.trackA, row: 0 }, channel: 2, write: 'merge',
        operations: [{
          op: 'generate', source: { kind: 'notes', notes: [note({ pitch: 71 })] },
        }],
      }],
    },
  });
  const operationId = background['operationId'] as string;
  assert.equal(background['terminal'], false);
  const finished = await fx.workspace.operations.wait(operationId);
  assert.equal(finished.state, 'completed', JSON.stringify(finished));
  const startSpec = TOOLS.find((tool) => tool.name === 'start_clip_music_operation')!;
  for (const op of fx.sent.slice(backgroundStartAt).map((item) => item.op)) {
    assert.ok(startSpec.emits.includes(op), `background start sent undeclared ${op}`);
  }

  const inspectedOperation = await exercise('inspect_clip_music_operation', { operationId });
  assert.equal(inspectedOperation['state'], 'completed');
  assert.equal(inspectedOperation['terminal'], true);
  const cancelledOperation = await exercise('cancel_clip_music_operation', { operationId });
  assert.equal(cancelledOperation['state'], 'completed', 'late cancellation keeps the completed result');
  assert.equal(cancelledOperation['terminal'], true);

  assert.equal((await exercise('erase_notes', {
    clips: [{ trackId: fx.trackA, row: 0 }],
  }))['applied'], true);

  const moved = await exercise('move_clip_block', {
    trackId: fx.trackA, firstRow: 0, lastRow: 1, destinationFirstRow: 2,
  }) as { applied: boolean; movedTo: { firstRow: number; lastRow: number } };
  assert.equal(moved.applied, true, JSON.stringify(moved));
  assert.deepEqual(moved.movedTo, {
    firstRow: 2, lastRow: 3, firstBitwigSceneRow: 3, lastBitwigSceneRow: 4,
  });

  const renamed = await exercise('rename_track', {
    tracks: [{ trackId: fx.trackB, name: 'gn-B renamed' }],
  });
  assert.equal(renamed['applied'], true);
  const renameChangeId = renamed['changeId'] as string;

  const addedTrack = await exercise('add_track', { names: ['gn-C', 'gn-D'] }) as {
    applied: boolean;
    creationConfirmed: boolean;
    namesConfirmed: boolean;
    created: { trackId: string; requestedName: string; nameConfirmed: boolean }[];
    namingChange: { applied: boolean };
  };
  assert.equal(addedTrack.applied, true);
  assert.equal(addedTrack.creationConfirmed, true);
  assert.equal(addedTrack.namesConfirmed, true);
  assert.equal(addedTrack.namingChange.applied, true);
  assert.equal(addedTrack.created.length, 2, 'every new track reports the id it actually got');
  assert.deepEqual(
    addedTrack.created.map(({ requestedName, nameConfirmed }) => ({ requestedName, nameConfirmed })),
    [
      { requestedName: 'gn-C', nameConfirmed: true },
      { requestedName: 'gn-D', nameConfirmed: true },
    ],
  );

  assert.equal((await exercise('add_scenes', { count: 1 }))['applied'], true);

  const addedDevice = await exercise('add_device', {
    devices: [{ trackId: fx.trackA, from: 'bitwig', id: 'gn-test-device' }],
  }) as { applied: boolean; added: { devicePosition: number }[] };
  assert.equal(addedDevice.applied, true);
  assert.equal(addedDevice.added[0]?.devicePosition, 0, 'the position is read back, never assumed');

  const devices = await exercise('inspect_devices', { trackId: fx.trackA }) as {
    complete: boolean; devices: { position: number; name: string; enabled: boolean }[];
  };
  assert.equal(devices.complete, true);
  assert.deepEqual(devices.devices[0], {
    position: 0, name: 'gn-test-device', enabled: true,
  });

  const parameterInventory = await exercise('inspect_device_parameters', {
    device: { trackId: fx.trackA, devicePosition: 0 },
  }) as {
    standing: string; parameters: { id: string }[];
  };
  assert.equal(parameterInventory.standing, 'stable');
  assert.ok(parameterInventory.parameters.length > 8);
  assert.equal((await exercise('set_parameter', {
    settings: [{
      kind: 'direct',
      device: { trackId: fx.trackA, devicePosition: 0 },
      parameterId: parameterInventory.parameters[0]!.id,
      normalizedValue: 0.25,
    }],
  }))['verified'], true);

  assert.equal((await exercise('set_device_enabled', {
    settings: [{ trackId: fx.trackA, devicePosition: 0, enabled: false }],
  }))['verified'], true);

  const authored = await exercise('author_modulators', {
    trackId: fx.trackA,
    presetPath: join(HERE, '../../fixtures/Polysynth/mp_bare.bwpreset'),
    operation: {
      kind: 'add', modulator: 'lfo', target: 'polysynth-filter-frequency', amount: 1,
    },
  }) as { applied: boolean; change: { changeId: string } };
  assert.equal(authored.applied, true, JSON.stringify(authored));
  assert.equal((await callTool(fx.workspace, 'revert_change', {
    changeId: authored.change.changeId,
  }) as Record<string, unknown>)['applied'], true);

  const composed = await exercise('compose_device_structure', {
    trackId: fx.trackA,
    entries: [{ deviceName: 'Sampler' }],
  }) as { applied: boolean; change: { changeId: string } };
  assert.equal(composed.applied, true, JSON.stringify(composed));
  assert.equal((await callTool(fx.workspace, 'revert_change', {
    changeId: composed.change.changeId,
  }) as Record<string, unknown>)['applied'], true);

  const drumMachine = await exercise('compose_drum_machine', {
    trackId: fx.trackA,
    pads: [
      { midiNote: 36, deviceName: 'v1 Kick' },
      { midiNote: 38, deviceName: 'v1 Snare' },
    ],
  }) as { applied: boolean; verification: { verified: boolean }; change: { changeId: string } };
  assert.equal(drumMachine.applied, true, JSON.stringify(drumMachine));
  assert.equal(drumMachine.verification.verified, true, JSON.stringify(drumMachine));
  assert.equal((await callTool(fx.workspace, 'revert_change', {
    changeId: drumMachine.change.changeId,
  }) as Record<string, unknown>)['applied'], true);

  const createdAlternates = await exercise('create_device_alternates', {
    trackId: fx.trackA,
    containerType: 'instrument',
    names: ['gn-tool-source', 'gn-tool-alt'],
  }) as {
    applied: boolean;
    containerKind: string;
    routing: string;
    structure: {
      container: { devicePosition: number };
      containerKind: string;
      routing: string;
      alternates: { name: string }[];
    };
  };
  assert.equal(createdAlternates.applied, true, JSON.stringify(createdAlternates));
  assert.equal(createdAlternates.containerKind, 'Instrument Layer');
  assert.equal(createdAlternates.structure.containerKind, 'Instrument Layer');
  assert.match(createdAlternates.routing, /parallel/);
  assert.match(createdAlternates.routing, /same MIDI input/);
  assert.match(createdAlternates.routing, /does not map MIDI notes/);
  assert.deepEqual(
    createdAlternates.structure.alternates.map((item) => item.name),
    ['gn-tool-source', 'gn-tool-alt'],
  );

  const inspected = await exercise('inspect_device_alternates', {
    trackId: fx.trackA,
    containerPosition: createdAlternates.structure.container.devicePosition,
  }) as {
    readable: boolean;
    complete: boolean;
    exclusiveActive: string | null;
    alternates: { soloed: boolean | null }[];
  };
  assert.equal(inspected.readable, true);
  assert.equal(inspected.complete, true);
  assert.equal(inspected.exclusiveActive, null,
    'two open siblings are not mislabeled as one exclusively active alternate');
  assert.deepEqual(inspected.alternates.map((item) => item.soloed), [false, false]);

  const filled = await exercise('fill_device_alternate', {
    trackId: fx.trackA,
    containerPosition: createdAlternates.structure.container.devicePosition,
    alternateName: 'gn-tool-source',
    sourceDevicePositions: [0],
    mode: 'move',
  }) as {
    applied: boolean;
    finalContainerPosition: number;
    structure: { alternates: { name: string; devices: { name: string }[] }[] };
  };
  assert.equal(filled.applied, true, JSON.stringify(filled));
  assert.equal(filled.finalContainerPosition, 0);
  assert.equal(filled.structure.alternates[0]?.devices.length, 1);

  const effectAlternates = await call(fx, 'create_device_alternates', {
    trackId: fx.trackB,
    containerType: 'effect',
    names: ['gn-effect-source', 'gn-effect-remove', 'gn-effect-alt'],
  }) as { applied: boolean; structure: { container: { devicePosition: number } } };
  assert.equal(effectAlternates.applied, true, JSON.stringify(effectAlternates));

  const reduced = await exercise('remove_device_alternate', {
    trackId: fx.trackB,
    containerPosition: effectAlternates.structure.container.devicePosition,
    alternateName: 'gn-effect-remove',
    containerType: 'effect',
  }) as {
    applied: boolean;
    originalContainerRemoved: boolean;
    replacementPositionConfirmed: boolean;
    finalStructure: { alternates: { name: string }[] };
  };
  assert.equal(reduced.applied, true, JSON.stringify(reduced));
  assert.equal(reduced.originalContainerRemoved, true);
  assert.equal(reduced.replacementPositionConfirmed, true);
  assert.deepEqual(
    reduced.finalStructure.alternates.map((item) => item.name),
    ['gn-effect-source', 'gn-effect-alt'],
  );

  const switched = await exercise('switch_device_alternate', {
    trackId: fx.trackA,
    containerPosition: filled.finalContainerPosition,
    alternateName: 'gn-tool-alt',
  }) as { applied: boolean; exclusiveActive: string; exclusiveStateConfirmed: boolean };
  assert.equal(switched.applied, true, JSON.stringify(switched));
  assert.equal(switched.exclusiveActive, 'gn-tool-alt');
  assert.equal(switched.exclusiveStateConfirmed, true);

  const collapsed = await exercise('keep_device_alternate', {
    trackId: fx.trackA,
    containerPosition: filled.finalContainerPosition,
    alternateName: 'gn-tool-source',
  }) as { applied: boolean; containerRemoved: boolean; finalPositionConfirmed: boolean };
  assert.equal(collapsed.applied, true, JSON.stringify(collapsed));
  assert.equal(collapsed.containerRemoved, true);
  assert.equal(collapsed.finalPositionConfirmed, true);

  // -- the record of all of it, and putting one of them back.
  const changes = await exercise('list_changes', { limit: 200 }) as { changes: { changeId: string }[] };
  assert.ok(changes.changes.length >= 8);

  const renameChange = changes.changes.find((c) => c.changeId === renameChangeId);
  assert.ok(renameChange !== undefined, 'the rename is in the record');
  const check = await exercise('check_revert', { changeId: renameChangeId }) as {
    fullyRestorable: boolean;
  };
  assert.equal(check.fullyRestorable, true);
  assert.equal((await exercise('revert_change', { changeId: renameChangeId }))['applied'], true);
  assert.equal(fx.fake.model.tracks[1]?.name, 'gn-B', 'the rename really was put back');

  const copiedTrack = await exercise('copy_track', {
    trackId: fx.trackA, name: 'gn-A copy',
  }) as {
    applied: boolean;
    copyConfirmed: boolean;
    nameConfirmed: boolean;
    copied: { trackId: string };
  };
  assert.equal(copiedTrack.applied, true, JSON.stringify(copiedTrack));
  assert.equal(copiedTrack.copyConfirmed, true, JSON.stringify(copiedTrack));
  assert.equal(copiedTrack.nameConfirmed, true, JSON.stringify(copiedTrack));
  assert.notEqual(copiedTrack.copied.trackId, fx.trackA, 'the copy receives a fresh durable id');

  // -- destroying.
  assert.equal((await exercise('delete_device', {
    devices: [{ trackId: fx.trackA, position: 0 }],
  }))['applied'], true);
  assert.equal((await call(fx, 'delete_device', {
    devices: [{
      trackId: fx.trackB,
      position: effectAlternates.structure.container.devicePosition,
    }],
  }))['applied'], true);

  assert.equal((await exercise('delete_clip', {
    clips: [{ trackId: fx.trackA, row: 2 }],
  }))['applied'], true);

  assert.equal((await exercise('delete_scene', { rows: [8] }))['applied'], true);

  assert.equal((await exercise('delete_track', {
    trackIds: [addedTrack.created[0]!.trackId, copiedTrack.copied.trackId],
  }))['applied'], true);

  const observation = await exercise('record_observation', {
    operation: 'begin', requestedScope: 'unsupported', rawScope: 'No project change.',
  });
  assert.equal((await exercise('record_observation', {
    operation: 'enrich', instructionId: observation['instructionId'], operatorResponse: 'vetoed',
  }))['recorded'], true);

  // ⚠ The coverage claim, asserted rather than assumed: a tool added without a
  // case here fails this, which is the only way "the surface has offline
  // coverage" stays true after today.
  assert.deepEqual(
    TOOLS.map((t) => t.name).filter((n) => !ran.has(n)),
    [],
    'a registered tool has no offline case',
  );
});

// --- exit criterion 1: end to end through the tools --------------------------

test('T-roundtrip: notes applied, verified and put back, entirely through the tools', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', { clips: [{ trackId: fx.trackA, row: 2, lengthBeats: 4 }] });
  const written = await call(fx, 'write_notes', {
    clips: [{ trackId: fx.trackA, row: 2, notes: [note({ pitch: 60 }), note({ startBeats: 2, pitch: 63 })] }],
  });
  assert.equal(written['applied'], true);
  const changeId = written['changeId'] as string;

  // Verified by reading it back through the surface, not by trusting the receipt.
  const after = await call(fx, 'read_clip', { trackId: fx.trackA, row: 2 }) as { notes: NoteRecord[] };
  assert.deepEqual(after.notes.map((n) => n.pitch).sort(), [60, 63]);

  // What the undo would do, before doing it.
  const preview = await call(fx, 'check_revert', { changeId }) as {
    fullyRestorable: boolean; wouldWriteAnything: boolean; wouldNotRestore: unknown[];
  };
  assert.equal(preview.fullyRestorable, true);
  assert.equal(preview.wouldWriteAnything, true);
  assert.deepEqual(preview.wouldNotRestore, []);

  const undone = await call(fx, 'revert_change', { changeId });
  assert.equal(undone['applied'], true);

  const restored = await call(fx, 'read_clip', { trackId: fx.trackA, row: 2 }) as {
    clipExists: boolean; notes: NoteRecord[];
  };
  assert.deepEqual(restored.notes, [], 'the clip is back to empty');
  assert.equal(restored.clipExists, true, 'and the clip itself is untouched — only its notes moved');
});

test('2i follow-up: complete public clip metadata readback and reversal are exact', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', {
    clips: [{ trackId: fx.trackA, row: 2, lengthBeats: 32, notes: [note({ pitch: 64 })] }],
  });
  const target = clipAt(slotAt(trackAt(fx.trackA), sceneAt(2, 1)));
  const before = await fx.fake.read([metadataAt(target), notesAt(target)]);
  const metadata = {
    name: 'gn-four-phrases', color: { red: 31, green: 159, blue: 223 },
    lengthBeats: 128, playStartBeats: 2, loopEnabled: true,
    loopStartBeats: 1, loopEndBeats: 129,
  };

  const changed = await call(fx, 'set_clip_metadata', {
    clips: [{ trackId: fx.trackA, row: 2, metadata }],
  }) as { changeId: string; clips: { metadataVerified: boolean }[] };
  assert.equal(changed.clips[0]?.metadataVerified, true);
  assert.equal((await call(fx, 'revert_change', { changeId: changed.changeId }))['applied'], true);

  const restored = await fx.fake.read([metadataAt(target), notesAt(target)]);
  assert.deepEqual(restored.entries[addressKey(metadataAt(target))], before.entries[addressKey(metadataAt(target))]);
  assert.deepEqual(restored.entries[addressKey(notesAt(target))], before.entries[addressKey(notesAt(target))]);
});

test('T-roundtrip: a partial undo touches only what it was scoped to', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', {
    clips: [
      { trackId: fx.trackA, row: 0, lengthBeats: 4 },
      { trackId: fx.trackB, row: 0, lengthBeats: 4 },
    ],
  });
  const written = await call(fx, 'write_notes', {
    clips: [
      { trackId: fx.trackA, row: 0, notes: [note({ pitch: 60 })] },
      { trackId: fx.trackB, row: 0, notes: [note({ pitch: 72 })] },
    ],
  });

  await call(fx, 'revert_change', {
    changeId: written['changeId'],
    scope: { trackId: fx.trackA },
  });

  const a = await call(fx, 'read_clip', { trackId: fx.trackA, row: 0 }) as { notes: NoteRecord[] };
  const b = await call(fx, 'read_clip', { trackId: fx.trackB, row: 0 }) as { notes: NoteRecord[] };
  assert.deepEqual(a.notes, [], 'the scoped track was put back');
  assert.deepEqual(b.notes.map((n) => n.pitch), [72], 'and the other one was left alone');
});

test('4b: one verified clip target opens explicitly without recording a change', async () => {
  const fx = fixture();
  const made = await call(fx, 'add_clip', {
    clips: [{ trackId: fx.trackA, row: 2, lengthBeats: 4, notes: [note()] }],
  });
  const beforeChanges = fx.stash.list().length;
  const beforeRevision = (await fx.fake.revision()).revision;
  const beforeObservation = JSON.stringify((await fx.workspace.observations.snapshot()).record);
  const beforeStatuses = fx.statuses.length;

  const result = await call(fx, 'show_changed_clip', { changeId: made['changeId'] });

  assert.equal(result['navigated'], true, JSON.stringify(result));
  assert.equal(result['layoutRequested'], 'EDIT');
  assert.equal(result['layoutConfirmed'], true);
  assert.deepEqual(result['target'], { trackId: fx.trackA, row: 2 });
  assert.equal(fx.stash.list().length, beforeChanges, 'UI focus creates no stash entry');
  assert.equal((await fx.fake.revision()).revision, beforeRevision, 'UI focus creates no revision bump');
  assert.equal(JSON.stringify((await fx.workspace.observations.snapshot()).record), beforeObservation,
    'UI focus creates no observation event');
  assert.equal(fx.statuses.length, beforeStatuses, 'UI focus publishes no project-change status');
  assert.deepEqual(fx.fake.lastNavigation, clipAt(slotAt(trackAt(fx.trackA), sceneAt(2, 1))));
});

test('4b review: an occupied replacement during final verification does not navigate', async () => {
  let armed = false;
  let navigationMarks = 0;
  let targetTrackId = '';
  const fx = fixture({
    beforeRevision: (_call, fake) => {
      if (!armed || ++navigationMarks !== 2) return;
      control(fake).replaceClipInPlace(targetTrackId, 2);
    },
  });
  targetTrackId = fx.trackA;
  const made = await call(fx, 'add_clip', {
    clips: [{ trackId: fx.trackA, row: 2, lengthBeats: 4, notes: [note()] }],
  });
  armed = true;

  const result = await call(fx, 'show_changed_clip', { changeId: made['changeId'] });

  assert.equal(result['navigated'], false);
  assert.match(result['why'] as string, /changed while/);
  assert.equal(fx.fake.lastNavigation, undefined);
});

test('4b review: a project switch during final verification does not navigate', async () => {
  let armed = false;
  let navigationMarks = 0;
  const fx = fixture({
    beforeRevision: (_call, fake) => {
      if (!armed || ++navigationMarks !== 2) return;
      // Keep the same track ids to model a copied project with matching coordinates.
      fake.model.project = 'fake-project-B';
    },
  });
  const made = await call(fx, 'add_clip', {
    clips: [{ trackId: fx.trackA, row: 2, lengthBeats: 4, notes: [note()] }],
  });
  armed = true;

  const result = await call(fx, 'show_changed_clip', { changeId: made['changeId'] });

  assert.equal(result['navigated'], false);
  assert.match(result['why'] as string, /changed while/);
  assert.equal(fx.fake.lastNavigation, undefined);
});

test('4b: a multi-clip change returns candidates until one is selected', async () => {
  const fx = fixture();
  const made = await call(fx, 'add_clip', {
    clips: [
      { trackId: fx.trackA, row: 0, lengthBeats: 4 },
      { trackId: fx.trackB, row: 3, lengthBeats: 4 },
    ],
  });

  const ambiguous = await call(fx, 'show_changed_clip', { changeId: made['changeId'] });
  assert.equal(ambiguous['navigated'], false);
  assert.equal(ambiguous['ambiguous'], true);
  assert.deepEqual(ambiguous['availableTargets'], [
    { trackId: fx.trackA, row: 0 },
    { trackId: fx.trackB, row: 3 },
  ]);
  assert.equal(fx.fake.lastNavigation, undefined, 'ambiguity never chooses by order');

  const selected = await call(fx, 'show_changed_clip', {
    changeId: made['changeId'], target: { trackId: fx.trackB, row: 3 },
  });
  assert.equal(selected['navigated'], true, JSON.stringify(selected));
  assert.deepEqual(selected['target'], { trackId: fx.trackB, row: 3 });
});

test('4b: a move exposes its occupied destination, not its empty source', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', {
    clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4, notes: [note()] }],
  });
  const moved = await call(fx, 'move_clip_block', {
    trackId: fx.trackA, firstRow: 0, lastRow: 0, destinationFirstRow: 2,
  });

  const shown = await call(fx, 'show_changed_clip', { changeId: moved['changeId'] });

  assert.equal(shown['navigated'], true, JSON.stringify(shown));
  assert.deepEqual(shown['target'], { trackId: fx.trackA, row: 2 });
  assert.deepEqual(shown['availableTargets'], [{ trackId: fx.trackA, row: 2 }]);
});

test('4b: unsupported, missing, moved, stale, and unknown changes do not navigate', async () => {
  const fx = fixture();
  const renamed = await call(fx, 'rename_track', {
    tracks: [{ trackId: fx.trackB, name: 'renamed' }],
  });
  const unsupported = await call(fx, 'show_changed_clip', { changeId: renamed['changeId'] });
  assert.equal(unsupported['supported'], false);

  await call(fx, 'add_clip', {
    clips: [{ trackId: fx.trackB, row: 4, lengthBeats: 4 }],
  });
  const deletedChange = await call(fx, 'delete_clip', {
    clips: [{ trackId: fx.trackB, row: 4 }],
  });
  const deleted = await call(fx, 'show_changed_clip', { changeId: deletedChange['changeId'] });
  assert.equal(deleted['navigated'], false);
  assert.match(deleted['why'] as string, /no longer holds a clip/);

  const missingChange = await call(fx, 'add_clip', {
    clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4 }],
  });
  const track = fx.fake.model.findByChannelId(fx.trackA)!.track;
  fx.fake.model.setSlotContent(track, 0, false);
  const missing = await call(fx, 'show_changed_clip', { changeId: missingChange['changeId'] });
  assert.equal(missing['navigated'], false);
  assert.equal(missing['mismatch'], 'moved');

  const movedChange = await call(fx, 'add_clip', {
    clips: [{ trackId: fx.trackA, row: 1, lengthBeats: 4 }],
  });
  control(fx.fake).dragClip(fx.trackA, 1, 2);
  const moved = await call(fx, 'show_changed_clip', { changeId: movedChange['changeId'] });
  assert.equal(moved['navigated'], false);
  assert.equal(moved['mismatch'], 'moved');

  const staleChange = await call(fx, 'write_notes', {
    clips: [{ trackId: fx.trackA, row: 2, notes: [note({ pitch: 72 })] }],
  });
  control(fx.fake).restartExtension();
  const stale = await call(fx, 'show_changed_clip', { changeId: staleChange['changeId'] });
  assert.equal(stale['navigated'], false);
  assert.match(stale['why'] as string, /restarted/);

  const unknown = await call(fx, 'show_changed_clip', { changeId: 'not-a-change' });
  assert.ok(refused(unknown));
  assert.equal(fx.fake.lastNavigation, undefined);
});

// --- exit criterion 2: nothing that applied goes unrecorded ------------------

test('T-record: every batch that applied is in the record, and no tool can go around it', async () => {
  const fx = fixture();
  assert.deepEqual(fx.stash.list(), []);

  await call(fx, 'add_clip', { clips: [{ trackId: fx.trackA, row: 1, lengthBeats: 2 }] });
  await call(fx, 'write_notes', { clips: [{ trackId: fx.trackA, row: 1, notes: [note()] }] });
  await call(fx, 'delete_clip', { clips: [{ trackId: fx.trackA, row: 1 }] });

  assert.equal(fx.stash.list().length, 3, 'one record per batch that reached Bitwig');
  // ⚠ A refused batch writes nothing and records nothing — there is no world to
  // put back. The count above must not move.
  const refusal = await call(fx, 'write_notes', {
    clips: [{ trackId: fx.trackA, row: 1, notes: [note()] }],
  });
  assert.ok(refused(refusal), 'the clip was deleted, so this write has nowhere to land');
  assert.equal(fx.stash.list().length, 3);

  // ⚠ The structural half. A tool receives a `Workspace`, and a `Workspace` has
  // no executor to call and no way to record — or to FORGET, which is the
  // destructive mutation here: the record is the only "before" an unbranched
  // write has.
  const workspace = fx.workspace as unknown as Record<string, unknown>;
  assert.equal('executor' in workspace, false, 'a tool could bypass the recording');
  assert.equal('apply' in workspace, true, 'and the check is not vacuous');
  for (const banned of ['record', 'forget']) {
    assert.equal(banned in (fx.workspace.changes as object), false, `${banned} is reachable`);
  }
  assert.ok(Object.isFrozen(fx.workspace));
});

test('T-copy-track: copy and explicit naming are ordinary recorded edits, and reversal keeps the copy', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', {
    clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4, notes: [note({ pitch: 73 })] }],
  });

  const before = fx.stash.list().length;
  const result = await call(fx, 'copy_track', {
    trackId: fx.trackA, name: 'gn-A explicit copy',
  }) as {
    changeId: string;
    copyConfirmed: boolean;
    nameConfirmed: boolean;
    copied: { trackId: string };
    namingChange: { changeId: string; applied: boolean };
    automaticReversal: string;
  };

  assert.equal(result.copyConfirmed, true, JSON.stringify(result));
  assert.equal(result.nameConfirmed, true, JSON.stringify(result));
  assert.notEqual(result.copied.trackId, fx.trackA);
  assert.notEqual(result.namingChange.changeId, result.changeId);
  assert.equal(fx.stash.list().length, before + 2,
    'the structural copy and its typed rename are both in ordinary change history');

  const source = fx.fake.model.findByChannelId(fx.trackA)?.track;
  const copy = fx.fake.model.findByChannelId(result.copied.trackId)?.track;
  assert.equal(source?.name, 'gn-A', 'the source is not renamed');
  assert.equal(copy?.name, 'gn-A explicit copy');
  assert.deepEqual([...copy!.slots[0]!.notes.values()], [...source!.slots[0]!.notes.values()],
    'the source contents travel with the track');

  const preview = await call(fx, 'check_revert', { changeId: result.changeId }) as {
    fullyRestorable: boolean; wouldWriteAnything: boolean; wouldNotRestore: unknown[];
  };
  assert.equal(preview.fullyRestorable, false);
  assert.equal(preview.wouldWriteAnything, false);
  assert.ok(preview.wouldNotRestore.length > 0, 'the preview says the copied track remains');

  const reversed = await call(fx, 'revert_change', { changeId: result.changeId });
  assert.equal(reversed['applied'], false);
  assert.ok(fx.fake.model.findByChannelId(result.copied.trackId),
    'automatic reversal does not delete a copied track');
  assert.match(result.automaticReversal, /delete_track/);
});

test('T-copy-track: unsupported track kinds and a full bank refuse before the first write', async () => {
  const unsupported = fixture();
  const effect = unsupported.fake.model.visibleTracks().find((t) => t.type === 'Effect')!;
  const unsupportedBefore = unsupported.sent.length;
  const unsupportedResult = await call(unsupported, 'copy_track', {
    trackId: effect.channelId, name: 'not allowed',
  });
  assert.equal(refused(unsupportedResult), true);
  assert.equal(unsupported.sent.length, unsupportedBefore, 'unsupported kinds emit no op');

  const full = fixture();
  control(full.fake).setBankWindow(full.fake.model.trackCount);
  const idsBefore = full.fake.model.tracks.map((t) => t.channelId);
  const sentBefore = full.sent.length;
  const fullResult = await call(full, 'copy_track', {
    trackId: full.trackA, name: 'no room',
  });
  assert.equal(refused(fullResult), true);
  assert.equal(full.sent.length, sentBefore, 'capacity is checked before the adapter runs an op');
  assert.deepEqual(full.fake.model.tracks.map((t) => t.channelId), idsBefore,
    'no unaddressable copy is created');
});

test('T-record: no tool source mentions the executor or project-write recording call', async () => {
  // The `WIRE_METHODS_BANNED` idiom: the only real enforcement of a "never" is a
  // test that greps for it. `workspace.ts` names both because it is the one place
  // allowed to; every other file in the surface must not.
  const source = await readFile(join(HERE, 'tools.ts'), 'utf8');
  assert.doesNotMatch(source, /\bexecutor\b/i, 'tools.ts reaches for an executor');
  assert.doesNotMatch(
    source,
    /(?:stash|changes)\.record\(/,
    'tools.ts records a project write by hand rather than through apply',
  );
  assert.doesNotMatch(source, /planReversal/, 'tools.ts plans a reversal without the launcher window');
});

// --- exit criterion 3: the launcher window, and `moved` ----------------------

test('T-moved: a clip replaced by an identical one is REFUSED, not overwritten', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', { clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4 }] });
  const written = await call(fx, 'write_notes', {
    clips: [{ trackId: fx.trackA, row: 0, notes: [note({ pitch: 60 })] }],
  });
  const changeId = written['changeId'] as string;

  // ⚠ A person deletes the clip and puts an identical one in its place. Every
  // byte compares equal afterwards; the slot is nonetheless not holding the clip
  // we wrote, and a clip has no id of its own to tell us so.
  control(fx.fake).replaceClipInPlace(fx.trackA, 0);

  const preview = await call(fx, 'check_revert', { changeId }) as {
    fullyRestorable: boolean;
    wouldWriteAnything: boolean;
    wouldNotRestore: { why: string }[];
  };
  assert.equal(preview.fullyRestorable, false);
  assert.equal(preview.wouldWriteAnything, false);
  assert.match(preview.wouldNotRestore[0]!.why, /clip launcher reports this slot/);
  assert.match(preview.wouldNotRestore[0]!.why, /no id of its own/);

  const attempt = await call(fx, 'revert_change', { changeId }) as { applied: boolean };
  assert.equal(attempt.applied, false);
  assert.deepEqual(
    (await call(fx, 'read_clip', { trackId: fx.trackA, row: 0 }) as { notes: NoteRecord[] })
      .notes.map((n) => n.pitch),
    [60],
    'the notes are exactly as they were: refusing means not writing',
  );
});

test('T-moved: the CONTROL — without the launcher window the same case reads as ours', async () => {
  // ⚠ This is what makes the test above mean something. `planReversal` takes the
  // window optionally, and omitting it degrades the check to comparing contents —
  // which cannot see a move, because the contents are identical. So the same
  // situation, planned the way a caller who forgot would plan it, says the clip
  // is ours and offers to write over somebody else's.
  const fx = fixture();
  await call(fx, 'add_clip', { clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4 }] });
  const written = await call(fx, 'write_notes', {
    clips: [{ trackId: fx.trackA, row: 0, notes: [note({ pitch: 60 })] }],
  });
  const changeId = written['changeId'] as string;
  control(fx.fake).replaceClipInPlace(fx.trackA, 0);

  const current = await fx.fake.read(fx.stash.log.readSetFor(changeId));
  const blind = fx.stash.log.planReversal(changeId, current);
  assert.ok(blind.ops.length > 0, 'the content comparison alone sees nothing wrong');
  assert.deepEqual(blind.withheld, []);

  // ...and the surface's own path, which always passes the window, does not.
  const seeing = await fx.workspace.planRevert(changeId);
  assert.deepEqual(seeing.ops, []);
  assert.deepEqual(seeing.withheld.map((w) => w.verdict), ['moved']);
});

test('T-moved: an edit by somebody else inside our own write is reported, never overwritten', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', { clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4 }] });
  const written = await call(fx, 'write_notes', {
    clips: [{ trackId: fx.trackA, row: 0, notes: [note({ pitch: 60 })] }],
  });

  // A person plays another note into the same clip afterwards.
  await fx.fake.apply({ ops: [{ op: 'note.write', clip: clipAt(slotAt(trackAt(fx.trackA), sceneAt(0, 1))), notes: [note({ pitch: 62, startBeats: 3 })] }] });
  await fx.fake.settle('noteWrite');

  const attempt = await call(fx, 'revert_change', { changeId: written['changeId'] }) as {
    applied: boolean; wouldNotRestore: { why: string }[];
  };
  assert.equal(attempt.applied, false);
  assert.match(attempt.wouldNotRestore[0]!.why, /a person edited it/);
  assert.equal(
    (await call(fx, 'read_clip', { trackId: fx.trackA, row: 0 }) as { notes: NoteRecord[] })
      .notes.length,
    2,
    'both notes are still there',
  );
});

// --- refusals ----------------------------------------------------------------

test('T-refusal: writing into an unresolved slot refuses without claiming it is empty', async () => {
  const fx = fixture();
  const result = await call(fx, 'write_notes', {
    clips: [{ trackId: fx.trackA, row: 5, notes: [note()] }],
  });
  assert.ok(refused(result));
  assert.equal(result['nothingWasWritten'], true);
  assert.match(result['why'] as string, /could not be resolved safely/);
  assert.match(result['why'] as string, /Read the slot again/, 'the refusal names the way forward');
});

test('d02-s4-refusal: off-grid note timing names the cause and finest supported grid', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', {
    clips: [{ trackId: fx.trackA, row: 5, lengthBeats: 4 }],
  });
  const before = fx.sent.length;
  const result = await call(fx, 'write_notes', {
    clips: [{ trackId: fx.trackA, row: 5, notes: [note({ startBeats: 0.01 })] }],
  });

  assert.equal(result['refused'], true, JSON.stringify(result));
  assert.equal(result['nothingWasWritten'], true, JSON.stringify(result));
  assert.match(result['why'] as string, /Note timing caused the refusal/);
  assert.match(result['why'] as string, /startBeats or durationBeats/);
  assert.match(result['why'] as string, /finest supported grid is 0\.015625 beat \(1\/64 beat\)/);
  assert.equal(fx.sent.length, before, 'the off-grid note reaches no adapter write');
});

test('T-device-alternate names: every invalid name refuses before container insertion', async () => {
  const spec = TOOLS.find((tool) => tool.name === 'create_device_alternates')!;
  for (const names of [[' '], ['valid', '\t'], ['same', 'same']]) {
    const fx = fixture();
    const before = JSON.stringify(fx.fake.model.findByChannelId(fx.trackA)!.track.devices);
    const beforeChanges = fx.stash.list().length;
    const beforeSent = fx.sent.length;
    const result = await spec.run(fx.workspace, {
      trackId: fx.trackA,
      containerType: 'effect',
      names,
    } as never) as Record<string, unknown>;
    assert.equal(result['refused'], true, JSON.stringify(result));
    assert.equal(result['nothingWasWritten'], true, JSON.stringify(result));
    assert.equal(JSON.stringify(fx.fake.model.findByChannelId(fx.trackA)!.track.devices), before);
    assert.equal(fx.stash.list().length, beforeChanges);
    assert.equal(fx.sent.length, beforeSent);
  }

  assert.equal(z.object(spec.inputSchema).safeParse({
    trackId: 'track', containerType: 'effect', names: [' '],
  }).success, false, 'the public schema itself rejects a whitespace-only first name');
  assert.equal(z.object(spec.inputSchema).safeParse({
    trackId: 'track', containerType: 'effect', names: ['valid', '  '],
  }).success, false, 'the public schema itself rejects a whitespace-only later name');
});

test('T-device-alternate names: a requested name matching the shipped entry is still explicitly written', async () => {
  const fx = fixture();
  const beforeChanges = fx.stash.list().length;
  const beforeSent = fx.sent.length;
  const result = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA,
    containerType: 'effect',
    names: [ProjectModel.SHIPPED_CHAIN_NAME],
  }) as {
    applied: boolean;
    namingConfirmed: boolean;
    preparationChange?: { changeId: string };
    structure: { alternates: { name: string }[] };
  };
  assert.equal(result.applied, true, JSON.stringify(result));
  assert.equal(result.namingConfirmed, true);
  assert.equal(result.structure.alternates[0]?.name, ProjectModel.SHIPPED_CHAIN_NAME);
  assert.equal(typeof result.preparationChange?.changeId, 'string',
    'the untouched shipped name was changed away and explicitly restored');
  assert.deepEqual(
    fx.sent.slice(beforeSent).map((op) => op.op),
    ['device.insert', 'chain.rename', 'chain.rename'],
  );
  assert.equal(fx.stash.list().length, beforeChanges + 3,
    'both explicit naming writes travelled through the recorded executor path');
});

test('T-fill preflight: cumulative capacity refuses the whole request without state, history, or emitted writes', async () => {
  const fx = fixture();
  const made = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA, containerType: 'effect', names: ['destination'],
  }) as { structure: { container: { devicePosition: number } } };
  await call(fx, 'add_device', {
    devices: [
      { trackId: fx.trackA, from: 'bitwig', id: 'source-a' },
      { trackId: fx.trackA, from: 'bitwig', id: 'source-b' },
    ],
  });
  fx.fake.model.chainDeviceBankSize = 1;
  const track = fx.fake.model.findByChannelId(fx.trackA)!.track;
  const before = JSON.stringify(track.devices);
  const beforeChanges = fx.stash.list().length;
  const beforeSent = fx.sent.length;
  const beforeRevision = (await fx.fake.revision()).revision;

  const result = await call(fx, 'fill_device_alternate', {
    trackId: fx.trackA,
    containerPosition: made.structure.container.devicePosition,
    alternateName: 'destination',
    sourceDevicePositions: [1, 2],
    mode: 'copy',
  });
  assert.equal(result['refused'], true, JSON.stringify(result));
  assert.equal(result['nothingWasWritten'], true);
  assert.equal(JSON.stringify(track.devices), before, 'both sources and the destination are unchanged');
  assert.equal(fx.stash.list().length, beforeChanges, 'no change was recorded');
  assert.equal(fx.sent.length, beforeSent, 'no write batch was emitted by the adapter');
  assert.equal((await fx.fake.revision()).revision, beforeRevision, 'no stage ran');
});

test('T-fill preflight: a valid first source followed by an invalid source writes nothing', async () => {
  const fx = fixture();
  const made = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA, containerType: 'effect', names: ['destination'],
  }) as { structure: { container: { devicePosition: number } } };
  await call(fx, 'add_device', {
    devices: [{ trackId: fx.trackA, from: 'bitwig', id: 'source-a' }],
  });
  const track = fx.fake.model.findByChannelId(fx.trackA)!.track;
  const before = JSON.stringify(track.devices);
  const beforeChanges = fx.stash.list().length;
  const beforeSent = fx.sent.length;
  const beforeRevision = (await fx.fake.revision()).revision;

  const result = await call(fx, 'fill_device_alternate', {
    trackId: fx.trackA,
    containerPosition: made.structure.container.devicePosition,
    alternateName: 'destination',
    sourceDevicePositions: [1, 7],
    mode: 'move',
  });
  assert.equal(result['refused'], true, JSON.stringify(result));
  assert.equal(result['nothingWasWritten'], true);
  assert.equal(JSON.stringify(track.devices), before, 'the valid first source and destination are unchanged');
  assert.equal(fx.stash.list().length, beforeChanges);
  assert.equal(fx.sent.length, beforeSent);
  assert.equal((await fx.fake.revision()).revision, beforeRevision);
});

test('T-fill projection: non-sorted caller order preserves requested order through move compaction', async () => {
  const fx = fixture();
  await call(fx, 'add_device', {
    devices: [{ trackId: fx.trackA, from: 'bitwig', id: 'source-a' }],
  });
  const made = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA, containerType: 'effect', names: ['destination'],
  }) as { structure: { container: { devicePosition: number } } };
  await call(fx, 'add_device', {
    devices: [
      { trackId: fx.trackA, from: 'bitwig', id: 'source-b' },
      { trackId: fx.trackA, from: 'bitwig', id: 'source-c' },
    ],
  });

  const result = await call(fx, 'fill_device_alternate', {
    trackId: fx.trackA,
    containerPosition: made.structure.container.devicePosition,
    alternateName: 'destination',
    sourceDevicePositions: [3, 0],
    mode: 'move',
  }) as {
    applied: boolean;
    finalContainerPosition: number;
    structure: { alternates: { name: string; devices: { name: string }[] }[] };
  };
  assert.equal(result.applied, true, JSON.stringify(result));
  assert.equal(result.finalContainerPosition, 0);
  assert.deepEqual(
    result.structure.alternates[0]?.devices.map((item) => item.name),
    ['source-c', 'source-a'],
  );
  assert.deepEqual(
    fx.fake.model.findByChannelId(fx.trackA)!.track.devices.map((item) => item.name),
    [ProjectModel.FX_LAYER_UUID, 'source-b'],
  );
});

async function selectiveReductionFixture(
  fx: Fixture,
): Promise<{ position: number; track: NonNullable<ReturnType<ProjectModel['findByChannelId']>>['track'] }> {
  // The replacement temporarily sits after the anchor at position 2. Widening
  // this fake-only observer window models the already allocated live slot scope;
  // a separate case below proves the ordinary narrow window refuses pre-write.
  fx.fake.model.containerScopes = 3;
  const made = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA,
    containerType: 'effect',
    names: ['gn-keep-a', 'gn-remove', 'gn-keep-b'],
  }) as { applied: boolean; structure: { container: { devicePosition: number } } };
  assert.equal(made.applied, true, JSON.stringify(made));
  const position = made.structure.container.devicePosition;
  await call(fx, 'add_device', {
    devices: ['gn-anchor', 'gn-a1', 'gn-a2', 'gn-b1'].map((id) => ({
      trackId: fx.trackA, from: 'bitwig', id,
    })),
  });
  await call(fx, 'fill_device_alternate', {
    trackId: fx.trackA,
    containerPosition: position,
    alternateName: 'gn-keep-a',
    sourceDevicePositions: [2, 3],
    mode: 'move',
  });
  await call(fx, 'fill_device_alternate', {
    trackId: fx.trackA,
    containerPosition: position,
    alternateName: 'gn-keep-b',
    sourceDevicePositions: [2],
    mode: 'move',
  });
  const track = fx.fake.model.findByChannelId(fx.trackA)!.track;
  const chains = track.devices[position]!.chains!;
  Object.assign(chains.find((item) => item.name === 'gn-keep-a')!, {
    mute: true,
    solo: true,
    volume: 0.72,
    pan: 0.18,
    color: { red: 0.1, green: 0.2, blue: 0.3 },
  });
  Object.assign(chains.find((item) => item.name === 'gn-keep-b')!, {
    mute: false,
    solo: false,
    volume: 0.63,
    pan: 0.81,
    color: { red: 0.7, green: 0.6, blue: 0.5 },
  });
  return { position, track };
}

test('T-selective-reduction: survivor names, multi-device order and signal position are rebuilt and proved', async () => {
  const fx = fixture();
  const { position, track } = await selectiveReductionFixture(fx);
  const oldContainer = track.devices[position]!;

  const result = await call(fx, 'remove_device_alternate', {
    trackId: fx.trackA,
    containerPosition: position,
    alternateName: 'gn-remove',
    containerType: 'effect',
  }) as {
    applied: boolean;
    originalContainerRemoved: boolean;
    replacementPositionConfirmed: boolean;
    finalDeviceOrder: string[];
    finalStructure: { alternates: { name: string; devices: { name: string }[] }[] };
    stateRestoration: { name: string; restored: string[]; reportedOnly: string[] }[];
    replacementContainerRole: { supplied: string; independentlyObserved: boolean };
    crossDeviceModulation: string;
  };

  assert.equal(result.applied, true, JSON.stringify(result));
  assert.equal(result.originalContainerRemoved, true);
  assert.equal(result.replacementPositionConfirmed, true);
  assert.deepEqual(result.finalDeviceOrder, [ProjectModel.FX_LAYER_UUID, 'gn-anchor']);
  assert.notEqual(track.devices[position], oldContainer, 'the old container object is gone');
  assert.deepEqual(
    result.finalStructure.alternates.map((item) => ({
      name: item.name,
      devices: item.devices.map((device) => device.name),
    })),
    [
      { name: 'gn-keep-a', devices: ['gn-a1', 'gn-a2'] },
      { name: 'gn-keep-b', devices: ['gn-b1'] },
    ],
  );
  assert.ok(result.stateRestoration.every((item) => item.restored.includes('solo')),
    'the one prior solo is restored exactly across all survivors');
  assert.ok(result.stateRestoration.some((item) => item.reportedOnly.includes('volume')),
    'state with no write route is reported rather than claimed restored');
  assert.deepEqual(result.replacementContainerRole,
    { supplied: 'effect', independentlyObserved: false });
  assert.equal(result.crossDeviceModulation, 'not measured and not claimed');
});

test('T-selective-reduction: every survivor state is required before the first replacement write', async () => {
  const fx = fixture();
  const made = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA,
    containerType: 'effect',
    names: ['gn-keep-a', 'gn-remove', 'gn-keep-b'],
  }) as { structure: { container: { devicePosition: number } } };
  const track = fx.fake.model.findByChannelId(fx.trackA)!.track;
  delete track.devices[made.structure.container.devicePosition]!.chains![2]!.volume;
  const before = JSON.stringify(track.devices);
  const sent = fx.sent.length;

  const result = await call(fx, 'remove_device_alternate', {
    trackId: fx.trackA,
    containerPosition: made.structure.container.devicePosition,
    alternateName: 'gn-remove',
    containerType: 'effect',
  });
  assert.equal(result['refused'], true, JSON.stringify(result));
  assert.equal(result['nothingWasWritten'], true);
  assert.match(String(result['why']), /mute, solo, volume, pan and colour/);
  assert.equal(JSON.stringify(track.devices), before);
  assert.equal(fx.sent.length, sent);
});

test('T-selective-reduction: an unobservable temporary container position refuses before insertion', async () => {
  const fx = fixture();
  const made = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA,
    containerType: 'effect',
    names: ['gn-keep-a', 'gn-remove', 'gn-keep-b'],
  }) as { structure: { container: { devicePosition: number } } };
  await call(fx, 'add_device', {
    devices: [{ trackId: fx.trackA, from: 'bitwig', id: 'gn-anchor' }],
  });
  const track = fx.fake.model.findByChannelId(fx.trackA)!.track;
  const before = JSON.stringify(track.devices);
  const sent = fx.sent.length;

  const result = await call(fx, 'remove_device_alternate', {
    trackId: fx.trackA,
    containerPosition: made.structure.container.devicePosition,
    alternateName: 'gn-remove',
    containerType: 'effect',
  });
  assert.equal(result['refused'], true, JSON.stringify(result));
  assert.equal(result['nothingWasWritten'], true);
  assert.match(String(result['why']), /outside the observable container scopes/);
  assert.equal(JSON.stringify(track.devices), before);
  assert.equal(fx.sent.length, sent);
});

test('T-selective-reduction: an unreadable old-container removal is partial, never completion', async () => {
  let armed = false;
  let armedReads = 0;
  const fx = fixture({
    devices: (_call, actual) => armed && ++armedReads === 2
      ? { ...actual, devices: [], devicesComplete: false }
      : actual,
  });
  const { position } = await selectiveReductionFixture(fx);
  armed = true;
  const result = await call(fx, 'remove_device_alternate', {
    trackId: fx.trackA,
    containerPosition: position,
    alternateName: 'gn-remove',
    containerType: 'effect',
  }) as {
    applied: boolean;
    originalContainerRemoved: boolean | null;
    replacementPositionConfirmed: boolean;
    stateRestoration: unknown[];
    replacementStructure: { alternates: { name: string }[] };
  };
  assert.equal(result.applied, false, JSON.stringify(result));
  assert.equal(result.originalContainerRemoved, null,
    'an incomplete reading claims neither removed nor not removed');
  assert.equal(result.replacementPositionConfirmed, false);
  assert.equal(result.stateRestoration.length, 2,
    'captured and final survivor state remains in every post-migration answer');
  assert.deepEqual(
    result.replacementStructure.alternates.map((item) => item.name),
    ['gn-keep-a', 'gn-keep-b'],
  );
});

test('T-collapse: a named multi-device winner replaces its container at the original position', async () => {
  const fx = fixture();
  const add = async (id: string) => call(fx, 'add_device', {
    devices: [{ trackId: fx.trackA, from: 'bitwig', id }],
  });
  await add('gn-before');
  const made = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA,
    containerType: 'effect',
    names: ['gn-winner', 'gn-loser'],
  }) as { applied: boolean; structure: { container: { devicePosition: number } } };
  assert.equal(made.applied, true, JSON.stringify(made));
  assert.equal(made.structure.container.devicePosition, 1);
  await add('gn-after');
  await add('gn-winner-a');
  await add('gn-winner-b');
  const filled = await call(fx, 'fill_device_alternate', {
    trackId: fx.trackA,
    containerPosition: 1,
    alternateName: 'gn-winner',
    sourceDevicePositions: [3, 4],
    mode: 'move',
  }) as { applied: boolean };
  assert.equal(filled.applied, true, JSON.stringify(filled));

  const result = await call(fx, 'keep_device_alternate', {
    trackId: fx.trackA,
    containerPosition: 1,
    alternateName: 'gn-winner',
  }) as {
    applied: boolean;
    containerRemoved: boolean;
    finalPositionConfirmed: boolean;
    finalDeviceOrder: string[];
    stateNotCarried: { name: string; mute: boolean; solo: boolean };
  };
  assert.equal(result.applied, true, JSON.stringify(result));
  assert.equal(result.containerRemoved, true);
  assert.equal(result.finalPositionConfirmed, true);
  assert.deepEqual(result.finalDeviceOrder,
    ['gn-before', 'gn-winner-a', 'gn-winner-b', 'gn-after']);
  assert.deepEqual(result.stateNotCarried.name, 'gn-winner');
  assert.equal(typeof result.stateNotCarried.mute, 'boolean');
  assert.equal(typeof result.stateNotCarried.solo, 'boolean');
});

test('T-collapse: unknown winner state refuses before any device moves', async () => {
  const fx = fixture();
  const made = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA,
    containerType: 'effect',
    names: ['gn-winner', 'gn-loser'],
  }) as { applied: boolean; structure: { container: { devicePosition: number } } };
  assert.equal(made.applied, true);
  const track = fx.fake.model.findByChannelId(fx.trackA)!.track;
  const winner = track.devices[made.structure.container.devicePosition]!.chains![0]!;
  delete winner.mute;
  const before = JSON.stringify(track.devices);
  const changes = fx.workspace.changes.list().length;
  const result = await call(fx, 'keep_device_alternate', {
    trackId: fx.trackA,
    containerPosition: made.structure.container.devicePosition,
    alternateName: 'gn-winner',
  });
  assert.equal(result['refused'], true);
  assert.equal(result['nothingWasWritten'], true);
  assert.equal(JSON.stringify(track.devices), before);
  assert.equal(fx.workspace.changes.list().length, changes);
});

test('T-collapse: an unprovable extraction overflow refuses before the first move', async () => {
  const fx = fixture();
  fx.fake.model.deviceBankSize = 8;
  const made = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA,
    containerType: 'effect',
    names: ['gn-winner'],
  }) as { structure: { container: { devicePosition: number } } };
  await call(fx, 'add_device', {
    devices: ['winner-a', 'winner-b'].map((id) => ({
      trackId: fx.trackA, from: 'bitwig', id,
    })),
  });
  await call(fx, 'fill_device_alternate', {
    trackId: fx.trackA,
    containerPosition: made.structure.container.devicePosition,
    alternateName: 'gn-winner',
    sourceDevicePositions: [1, 2],
    mode: 'move',
  });
  await call(fx, 'add_device', {
    devices: Array.from({ length: 7 }, (_, index) => ({
      trackId: fx.trackA, from: 'bitwig', id: `top-${index}`,
    })),
  });
  const track = fx.fake.model.findByChannelId(fx.trackA)!.track;
  const before = JSON.stringify(track.devices);
  const changes = fx.workspace.changes.list().length;
  const result = await call(fx, 'keep_device_alternate', {
    trackId: fx.trackA,
    containerPosition: made.structure.container.devicePosition,
    alternateName: 'gn-winner',
  });
  assert.equal(result['refused'], true, JSON.stringify(result));
  assert.equal(result['nothingWasWritten'], true);
  assert.match(String(result['why']), /beyond the observable bank/);
  assert.equal(JSON.stringify(track.devices), before);
  assert.equal(fx.workspace.changes.list().length, changes);
});

/**
 * A container, one named winner holding a device, and a top-level device that
 * shares the winner device's name — the shape whose restoration no name-sequence
 * readback can tell from a move that never happened.
 */
async function twinNamedCollapse(fx: Fixture): Promise<number> {
  const made = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA,
    containerType: 'effect',
    names: ['gn-winner'],
  }) as { structure: { container: { devicePosition: number } } };
  const position = made.structure.container.devicePosition;
  await call(fx, 'add_device', {
    devices: ['gn-twin', 'gn-twin'].map((id) => ({ trackId: fx.trackA, from: 'bitwig', id })),
  });
  await call(fx, 'fill_device_alternate', {
    trackId: fx.trackA,
    containerPosition: position,
    alternateName: 'gn-winner',
    sourceDevicePositions: [position + 2],
    mode: 'move',
  });
  return position;
}

test('T-collapse: a restoration two identical names could not prove refuses before the container goes', async () => {
  const fx = fixture();
  const position = await twinNamedCollapse(fx);
  const track = fx.fake.model.findByChannelId(fx.trackA)!.track;
  const before = JSON.stringify(track.devices);
  const changes = fx.workspace.changes.list().length;

  const result = await call(fx, 'keep_device_alternate', {
    trackId: fx.trackA,
    containerPosition: position,
    alternateName: 'gn-winner',
  });
  // ⚠ The refusal has to come BEFORE the container is destroyed. Afterwards
  // there is nothing to refuse with: the alternates are gone and the only
  // remaining question is whether the answer lies about the signal position.
  assert.equal(result['refused'], true, JSON.stringify(result));
  assert.equal(result['nothingWasWritten'], true);
  assert.match(String(result['why']), /both before and after the move/);
  assert.equal(JSON.stringify(track.devices), before);
  assert.equal(fx.workspace.changes.list().length, changes);
});

test('T-collapse: a container the readback still sees is reported as NOT removed, with its state', async () => {
  // The delete is acknowledged and the confirming reading still shows the
  // container: exactly what a refused or lost removal looks like from here.
  let extracted: Awaited<ReturnType<FakeAdapter['devices']>> | undefined;
  let armed = false;
  let armedReads = 0;
  const fx = fixture({
    devices: (_call, actual) => {
      if (armed && ++armedReads === 2) extracted = actual;
      return armed && armedReads === 3 && extracted !== undefined ? extracted : actual;
    },
  });
  await call(fx, 'add_device', { devices: [{ trackId: fx.trackA, from: 'bitwig', id: 'gn-before' }] });
  const made = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA, containerType: 'effect', names: ['gn-winner'],
  }) as { structure: { container: { devicePosition: number } } };
  const position = made.structure.container.devicePosition;
  await call(fx, 'add_device', { devices: [{ trackId: fx.trackA, from: 'bitwig', id: 'gn-kept' }] });
  await call(fx, 'fill_device_alternate', {
    trackId: fx.trackA,
    containerPosition: position,
    alternateName: 'gn-winner',
    sourceDevicePositions: [position + 1],
    mode: 'move',
  });
  armed = true;

  const result = await call(fx, 'keep_device_alternate', {
    trackId: fx.trackA,
    containerPosition: position,
    alternateName: 'gn-winner',
  }) as Record<string, unknown> & {
    stateNotCarried?: Record<string, unknown>;
  };
  assert.equal(result['applied'], false, JSON.stringify(result));
  assert.equal(result['containerRemoved'], false);
  assert.equal(result['finalPositionConfirmed'], false);
  assert.ok(result.stateNotCarried, 'the captured chain-level state must survive into every answer');
  assert.equal(result.stateNotCarried['name'], 'gn-winner');
  assert.equal(typeof result.stateNotCarried['mute'], 'boolean');
  assert.equal(typeof result.stateNotCarried['solo'], 'boolean');
  assert.equal(typeof result.stateNotCarried['volume'], 'number');
  assert.equal(typeof result.stateNotCarried['pan'], 'number');
  assert.ok(result.stateNotCarried['color']);
  assert.equal(result.stateNotCarried['sends'], 'none');
  assert.deepEqual(result['keptDevices'], ['gn-kept']);
});

test('T-collapse: a removal no reading could confirm says so, and claims neither outcome', async () => {
  // The confirming reading comes back partial. Removed and not-removed are both
  // still possible, and the answer must be exactly that — not either one.
  let armed = false;
  let armedReads = 0;
  const fx = fixture({
    devices: (_call, actual) => armed && ++armedReads === 3
      ? { ...actual, devices: [], devicesComplete: false }
      : actual,
  });
  await call(fx, 'add_device', { devices: [{ trackId: fx.trackA, from: 'bitwig', id: 'gn-before' }] });
  const made = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA, containerType: 'effect', names: ['gn-winner'],
  }) as { structure: { container: { devicePosition: number } } };
  const position = made.structure.container.devicePosition;
  await call(fx, 'add_device', { devices: [{ trackId: fx.trackA, from: 'bitwig', id: 'gn-kept' }] });
  await call(fx, 'fill_device_alternate', {
    trackId: fx.trackA,
    containerPosition: position,
    alternateName: 'gn-winner',
    sourceDevicePositions: [position + 1],
    mode: 'move',
  });
  armed = true;

  const result = await call(fx, 'keep_device_alternate', {
    trackId: fx.trackA,
    containerPosition: position,
    alternateName: 'gn-winner',
  }) as Record<string, unknown> & { stateNotCarried?: Record<string, unknown> };
  assert.equal(result['applied'], false, JSON.stringify(result));
  assert.equal(result['containerRemoved'], null, 'an unreadable removal is neither true nor false');
  assert.equal(result['finalPositionConfirmed'], false);
  assert.ok(result.stateNotCarried);
  assert.equal(result.stateNotCarried['name'], 'gn-winner');
  assert.equal(result.stateNotCarried['sends'], 'none');
  assert.equal(result['crossDeviceModulation'], 'not measured and not claimed');
});

test('T-refusal: a write it could not put back is refused, and names what is in the way', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', { clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4 }] });
  // Written into an empty clip, so there is nothing it could fail to put back —
  // this one is allowed. What it leaves behind is not.
  assert.equal((await call(fx, 'write_notes', {
    clips: [{ trackId: fx.trackA, row: 0, notes: [note({ gain: 0.7 })] }],
  }))['applied'], true);
  // Only a human can add pressure. Put it into the fake model directly so the
  // refusal still covers a real lossy note property after gain became exact.
  const slotState = control(fx.fake).model.tracks[0]!.slots[0]!;
  const [key, existing] = [...slotState.notes.entries()][0]!;
  slotState.notes.set(key, { ...existing, pressure: 0.9 });

  const result = await call(fx, 'erase_notes', { clips: [{ trackId: fx.trackA, row: 0 }] });
  assert.ok(refused(result), 'the clip now holds a value that cannot be recorded exactly');
  const inTheWay = result['inTheWay'] as { where: { row: number }; why: string[] }[];
  assert.equal(inTheWay[0]?.where.row, 0);
  assert.match(inTheWay[0]!.why.join(' '), /pressure cannot be written/);
  // ⚠ And the notes are untouched: a refusal is not a partial application.
  assert.equal(
    (await call(fx, 'read_clip', { trackId: fx.trackA, row: 0 }) as { notes: NoteRecord[] }).notes.length,
    1,
  );
});

test('T-refusal: erase is clip-wide and rejects channel or beat-range selectors', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', { clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4 }] });
  await call(fx, 'write_notes', {
    clips: [{ trackId: fx.trackA, row: 0, channel: 9, notes: [note({ pitch: 69 })] }],
  });

  await assert.rejects(call(fx, 'erase_notes', {
    clips: [{ trackId: fx.trackA, row: 0, channel: 9 }],
  }), /Unrecognized key.*channel/);
  await assert.rejects(call(fx, 'erase_notes', {
    clips: [{ trackId: fx.trackA, row: 0, range: { fromBeat: 0, toBeat: 1 } }],
  }), /Unrecognized key.*range/);
  const channel = notesAt(clipAt(slotAt(trackAt(fx.trackA), sceneAt(0, 1))), 9);
  const snapshot = await fx.workspace.read([channel]);
  const entry = snapshot.entries[addressKey(channel)];
  assert.equal(entry?.value.of, 'notes');
  assert.equal(entry?.value.of === 'notes' ? entry.value.notes.length : 0, 1);
});

test('T-refusal: undoing something this session did not do is refused in terms an agent can act on', async () => {
  const fx = fixture();
  const result = await call(fx, 'revert_change', { changeId: 'not-a-change' });
  assert.ok(refused(result));
  assert.match(result['why'] as string, /list_changes/);
});

test('T-refusal: a slot that already holds a clip is refused rather than appended past the end', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', { clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4 }] });
  const result = await call(fx, 'add_clip', {
    clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4 }],
  });
  assert.ok(refused(result));
  assert.match(result['why'] as string, /already holds a clip/);
  assert.equal(fx.fake.model.sceneCount, 8, 'and the project did not grow a row');
});

test('T-clip-block: copy refuses an occupied next row before the wire call', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', {
    clips: [
      { trackId: fx.trackA, row: 0, lengthBeats: 4, notes: [note({ pitch: 60 })] },
      { trackId: fx.trackA, row: 1, lengthBeats: 4, notes: [note({ pitch: 72 })] },
    ],
  });
  const before = fx.sent.length;
  const result = await call(fx, 'copy_clip_down', {
    trackId: fx.trackA, row: 0, quantization: '1', mode: 'continue_or_synced',
  });
  assert.ok(refused(result));
  assert.match(result['why'] as string, /would replace it without any occupancy event/);
  assert.equal(fx.sent.length, before, 'the unsafe copy never reached the adapter');
  const destination = await call(fx, 'read_clip', {
    trackId: fx.trackA, row: 1,
  }) as { notes: NoteRecord[] };
  assert.deepEqual(destination.notes.map((n) => n.pitch), [72], 'the destination stayed intact');
});

test('T-clip-block: an overlapping move is ordered safely and its reported reverse works', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', {
    clips: [
      { trackId: fx.trackA, row: 1, lengthBeats: 4, notes: [note({ pitch: 60 })] },
      { trackId: fx.trackA, row: 2, lengthBeats: 4, notes: [note({ pitch: 72 })] },
    ],
  });
  const moved = await call(fx, 'move_clip_block', {
    trackId: fx.trackA, firstRow: 1, lastRow: 2, destinationFirstRow: 2,
  }) as { applied: boolean; reverse: Record<string, unknown> };
  assert.equal(moved.applied, true, JSON.stringify(moved));
  assert.equal((await call(fx, 'read_clip', {
    trackId: fx.trackA, row: 1,
  }))['clipExists'], false);
  assert.deepEqual(
    (await call(fx, 'read_clip', { trackId: fx.trackA, row: 2 }) as { notes: NoteRecord[] })
      .notes.map((n) => n.pitch),
    [60],
  );
  assert.deepEqual(
    (await call(fx, 'read_clip', { trackId: fx.trackA, row: 3 }) as { notes: NoteRecord[] })
      .notes.map((n) => n.pitch),
    [72],
  );

  const { tool: reverseTool, ...reverseArgs } = moved.reverse;
  const reversed = await call(fx, reverseTool as string, reverseArgs);
  assert.equal(reversed['applied'], true, JSON.stringify(reversed));
  assert.deepEqual(
    (await call(fx, 'read_clip', { trackId: fx.trackA, row: 1 }) as { notes: NoteRecord[] })
      .notes.map((n) => n.pitch),
    [60],
  );
  assert.deepEqual(
    (await call(fx, 'read_clip', { trackId: fx.trackA, row: 2 }) as { notes: NoteRecord[] })
      .notes.map((n) => n.pitch),
    [72],
  );
});

test('T-refusal: more rows than can be addressed is refused before anything happens', async () => {
  const fx = fixture();
  fx.fake.model.sceneBankSize = 8;
  const result = await call(fx, 'add_scenes', { count: 100 });
  assert.ok(refused(result));
  assert.match(result['why'] as string, /rig\.json/, 'the refusal names the only fix');
  assert.equal(fx.fake.model.sceneCount, 8);
});

// --- exit criteria 5 and 6: the words ---------------------------------------

test('T-words: no tool name, description or parameter uses a banned word', () => {
  const offenders: string[] = [];
  for (const spec of TOOLS) {
    // The JSON Schema is literally what an agent is handed, so scanning it covers
    // parameter names and every `.describe()` in one pass — including the nested
    // ones, which a hand-walk of the shape would miss.
    const schema = JSON.stringify(z.toJSONSchema(z.object(spec.inputSchema)));
    for (const [where, text] of [
      ['name', spec.name],
      ['title', spec.title],
      ['description', spec.description],
      ['schema', schema],
    ] as const) {
      for (const word of bannedWordsIn(text, `${spec.name}.${where}`)) {
        offenders.push(`${spec.name}.${where}: "${word}" — ${SURFACE_WORDS_BANNED[word]}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `\n${offenders.join('\n')}`);
});

test('T-words: nothing a tool EMITTED uses a banned word either', () => {
  // ⚠ The half that catches a leak nobody wrote: a receipt or a refusal that
  // forwards a sentence from inside the engine. `emitted` is filled by every
  // other test in this file, so the coverage of this guard is the coverage of the
  // suite — which is why T-surface asserts that every tool has a case.
  assert.ok(emitted.length > 20, 'the guard must have something to read');
  const offenders: string[] = [];
  for (const text of emitted) {
    for (const word of bannedWordsIn(text)) {
      offenders.push(`${word} in ${text.slice(0, 160)}`);
    }
  }
  assert.deepEqual(offenders, [], `\n${offenders.slice(0, 5).join('\n')}`);
});

test('T-words: no refusal redirects a change onto a retired mechanism', () => {
  // ⚠ The same assertion `executor.test.ts` makes about the engine's own refusal
  // text, made about everything this surface says. It overlaps the ban list on
  // purpose: this one is the sentence D18c actually forbids, and it should still
  // fail if somebody ever decides a word is "fine in context".
  for (const text of [...emitted, ...TOOLS.map((t) => t.description)]) {
    assert.doesNotMatch(text, /\bfork|\bchain|\bduplicate|track instead/i, text.slice(0, 160));
  }
});

test('2i: an unresolved note read does not claim that an occupied slot is empty', () => {
  const target = notesAt(clipAt(slotAt(trackAt('t-1'), sceneAt(0, 1))), 0);
  const result = refusalOf(new AddressUnresolvedError(target, 'exact scan failed'));

  assert.match(result.why, /does not prove that the slot is empty/);
  assert.doesNotMatch(result.why, /There is no clip/);
});

test('T-words: EVERY refusal the surface can produce is written in its own words', () => {
  // ⚠ The emitted-text guard above only reads what the suite happened to run.
  // This one enumerates the refusal catalogue directly, so a path nobody
  // exercised — a blind spot, a stale build, an unrecognised failure — is covered
  // too. Each error is built with a deliberately internal-sounding message, and
  // the assertion is that none of it comes out the other side.
  const marker = 'INTERNAL-TEXT-THAT-MUST-NOT-TRAVEL';
  const clip = clipAt(slotAt(trackAt('t-1'), sceneAt(0, 1)));
  const notesAddress = notesAt(clip, 0);
  const value = {
    address: notesAddress,
    key: addressKey(notesAddress),
    fidelity: 'lossy' as const,
    value: { of: 'notes' as const, notes: [note({ gain: 0.7 })] },
    caveats: [marker],
  };

  const catalogue: unknown[] = [
    new UnprotectedWriteError('lossy', [marker], marker, [value]),
    new SlotOccupiedError([clip]),
    new BlindSpotError('scenes', [clip], 8),
    new BankWindowOverflowError('tracks', 4, 40, 16),
    new StaleAddressError(clip, 1, 2),
    new AddressUnresolvedError(notesAddress, marker),
    new AddressUnresolvedError(trackAt('t-1'), marker),
    new ChangesetNotFoundError('nope'),
    new EmptySliceError([marker]),
    new InvalidOpError('scene.create', marker),
    new ContractVersionError(0, 1),
    new WireDriftError('aaa', 'bbb'),
    new StaleExtensionError({ state: 'stale', detail: marker } as never),
    new Error(marker),
  ];

  for (const error of catalogue) {
    const said = JSON.stringify(refusalOf(error));
    assert.deepEqual(bannedWordsIn(said), [], said);
    assert.equal(said.includes('nothingWasWritten'), true);
    // ⚠ The unrecognised-failure fallback is the ONE that may carry internal
    // text, and it says so by putting it under `unexpected` rather than under
    // `why` — a bug report, not a message.
    const forwarded = said.includes(marker);
    assert.equal(
      forwarded,
      error instanceof Error && error.constructor === Error,
      `a classified refusal forwarded internal wording: ${said}`,
    );
  }
});

test('T-words: every boundary verdict has a sentence of its own, in the surface\'s words', () => {
  // ⚠ A `Record` over the union rather than a list, so a verdict added later
  // fails to COMPILE here — the same reason `verdictSentence` is a switch.
  const all: Record<BoundaryVerdict, true> = {
    ours: true, superseded: true, changed: true, moved: true, undecidable: true,
    unverified: true, unread: true, blind: true, unseen: true,
  };
  for (const verdict of Object.keys(all) as BoundaryVerdict[]) {
    const said = verdictSentence(verdict);
    assert.deepEqual(bannedWordsIn(said), [], `${verdict}: ${said}`);
    if (verdict === 'ours') {
      assert.equal(said, '', 'the one verdict that needs no explanation is the one that is fine');
      continue;
    }
    assert.ok(said.length > 40, `${verdict} needs a real sentence, not a label`);
  }
});

test('T-words: the note input covers every writable property and none of the others', () => {
  const schema = z.toJSONSchema(z.object(TOOLS.find((t) => t.name === 'write_notes')!.inputSchema));
  const text = JSON.stringify(schema);
  for (const [prop, fidelity] of Object.entries(NOTE_PROP_FIDELITY)) {
    // `duration` is `durationBeats` on the surface; the contract names the API
    // property, the surface names the unit it is in.
    const key = prop === 'duration' ? 'durationBeats' : prop;
    const present = text.includes(`"${key}"`);
    if (fidelity === 'unwritable') {
      assert.equal(present, false,
        `${key} cannot be written through this API, so it must not be on the surface — a caller `
        + 'who set it would see it work on a read and lose it for real');
      continue;
    }
    assert.equal(present, true,
      `${key} can be written and is missing from the surface, so nothing can ask for it`);
  }
});

test('T-words: channel compatibility and exact gain wording match the Phase 2 contract', () => {
  const tool = TOOLS.find((candidate) => candidate.name === 'write_notes')!;
  const schema = z.toJSONSchema(z.object(tool.inputSchema));
  const text = JSON.stringify(schema);
  assert.match(text, /defaults to 0 for compatibility/);
  assert.match(text, /musical patch path always supplies this field/);
  assert.match(text, /Exact.*shared encoder writes the requested value divided by 2/);
  assert.doesNotMatch(text, /inverse.*never been measured/);
});

// --- the transport ------------------------------------------------------------

test('T-stdout: nothing in the surface writes to stdout', async () => {
  // ⚠ stdio uses STDOUT for the protocol itself, so one stray log breaks the
  // transport with no message anywhere — the failure mode is "the tool silently
  // stops existing". Named as a risk in the session plan, and cheap to hold.
  const files = [
    ...(await readdir(HERE)).filter((f) => f.endsWith('.ts')).map((f) => join(HERE, f)),
    join(HERE, '..', 'mcp-server.ts'),
  ];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    // ⚠ Comments are stripped first, and finding out why is the reason this note
    // exists: the guard's first version failed on the very comment warning
    // against `console.log`. A guard that fires on its own documentation gets
    // deleted rather than fixed.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    assert.doesNotMatch(code, /console\.log|process\.stdout\.write/, `${file} writes to stdout`);
  }
});
