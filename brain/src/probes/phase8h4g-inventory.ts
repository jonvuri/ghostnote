/**
 * 8h4g cost inventory (E247). Live driver, normal profile, owned unsaved project (refuses the saved anchor, D29).
 * One call of each agent-native-v1 tool through the MCP dispatch path, on fresh tracks that the driver deletes.
 * Each call records the wall time, every wire call with its time, the host turns, the cold reads, the write
 * stages, the brain CPU time, the idle time (settles and polls), and the result bytes.
 *
 *   inventory <dir>       the typical case of each tool; writes inventory.json
 *   add-worst <dir> [notes]   add_launcher_clip of the largest admitted clip (default 16,384 notes)
 *   plan-bench <notes>    offline: the 8h4g planner profile of a whole-clip velocity edit on the fake adapter
 *   verify-offline <dir>  recompute the per-tool rows from inventory.json
 *
 * A turn is a group of wire calls that are in flight together (E246: a mark sends two calls in one turn).
 * Idle time is the wall time outside every wire call and outside brain CPU time: fixed settles and poll waits.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { FakeAdapter } from '../adapters/fake/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { FIXTURE_DIR } from '../bwmod/fixtures.js';
import { clip, clipMetadata, scene, slot, supportedClipColors, track, type NoteRecord } from '../contract/index.js';
import { parse, serialize, type StateDocument } from '../document/index.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf, type Workspace } from '../surface/workspace.js';
import { WireTransport, type Call } from './phase8h3c-promotion.js';
import { typicalNotes } from './phase8h3e-snapshots-lib.js';
import { NORMAL_8H4F } from './phase8h4f-measure.js';

type Wire = Record<string, any>;
const SCHEMA = 'phase8h4g-inventory-v1';
const ANCHOR = 'gn-scale-test';
const POLY_BARE = join(FIXTURE_DIR, 'Polysynth', 'mp_bare.bwpreset');
const POLY_MODTEST = join(FIXTURE_DIR, 'Polysynth', 'modtest.bwpreset');

const say = (value: unknown): void => console.log(JSON.stringify(value));

export interface Row {
  step: string; tool: string; ok: boolean; code?: string; ms: number; bytes: number;
  calls: number; turns: number; wireMs: number; brainMs: number; idleMs: number;
  clipReads: number; stages: number; methods: Record<string, number>;
  /** Each wire call: method, start and duration in ms from the tool call start. */
  sequence: [string, number, number][];
}

/** Turns, wire busy time, and method counts of the wire calls of one tool call. */
export function wireSummary(calls: readonly Pick<Call, 'method' | 'sent' | 'received'>[]) {
  let turns = 0;
  let busy = 0;
  let end = -Infinity;
  let start = 0;
  for (const call of [...calls].sort((a, b) => a.sent - b.sent)) {
    const received = call.received < 0 ? call.sent : call.received;
    if (call.sent >= end) {
      if (end > -Infinity) busy += end - start;
      turns += 1; start = call.sent; end = received;
    } else end = Math.max(end, received);
  }
  if (end > -Infinity) busy += end - start;
  const methods: Record<string, number> = {};
  for (const call of calls) methods[call.method] = (methods[call.method] ?? 0) + 1;
  return { turns, wireMs: Math.round(busy), methods,
    clipReads: (methods['clip.read'] ?? 0), stages: (methods['batch.run'] ?? 0) };
}

const reduced = (n: number, d: number): string => {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(n, d);
  return d / g === 1 ? `${n / g}` : `${n / g}/${d / g}`;
};

/** The E231 typical clip (256 notes on 16 channels over 64 beats) as a desired document. */
export function typicalDesired(): string {
  const events = typicalNotes(0).flatMap((notes, channel) => notes.map(([step, pitch, velocity]) =>
    `EVENT t${channel + 1}-${step} c1 ${reduced(step!, 4)} 1/8 ${pitch} ${velocity} ${channel + 1}`));
  return ['DOC ghostnote-document 1.0 desired', 'CLIP {"id":"c1","length":"64","loop":{"from":"0","to":"64"}}',
    'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"c1","fields":"all","status":"complete","from":"0","to":"64"}',
    'FIELDS id clip at duration pitch velocity channel', ...events].join('\n') + '\n';
}

async function inventory(dir: string): Promise<void> {
  const transport = new WireTransport();
  const adapter = new LiveAdapter({ transport });
  const workspace = workspaceOf({
    ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
    observationStore: new FakeObservationStore(),
  });
  const request = async (method: string, params?: Wire): Promise<Wire> =>
    await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
  const rows: Row[] = [];
  const call = async (step: string, tool: string, args: Wire, required = true): Promise<Wire> => {
    const from = transport.calls.length;
    const cpu = process.cpuUsage();
    const started = performance.now();
    const result = await callTool(workspace, tool, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
    const ms = performance.now() - started;
    const used = process.cpuUsage(cpu);
    const brainMs = (used.user + used.system) / 1000;
    const wire = wireSummary(transport.calls.slice(from));
    const ok = result.failure === undefined && result.refused !== true && result.partialSuccess !== true;
    const row: Row = { step, tool, ok, ...(result.failure?.code === undefined ? {} : { code: result.failure.code }),
      ms: Math.round(ms), bytes: Buffer.byteLength(JSON.stringify(result)), calls: transport.calls.length - from,
      turns: wire.turns, wireMs: wire.wireMs, brainMs: Math.round(brainMs),
      idleMs: Math.max(0, Math.round(ms - wire.wireMs - brainMs)), clipReads: wire.clipReads, stages: wire.stages,
      methods: wire.methods, sequence: transport.calls.slice(from).map((item) => [item.method,
        Math.round(item.sent - started), Math.round((item.received < 0 ? item.sent : item.received) - item.sent)]) };
    rows.push(row);
    say({ ...row, methods: undefined, sequence: undefined });
    if (required) assert(ok, `${step} ${tool}: ${JSON.stringify(result).slice(0, 800)}`);
    return result;
  };

  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [...NORMAL_8H4F]);
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project) && mark.project !== ANCHOR, `use an owned unsaved project, got ${mark.project}`);
  await adapter.hello();
  const save = async (): Promise<void> => {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'inventory.json'), JSON.stringify({ schema: SCHEMA, hello, project: mark.project, rows }, null, 1) + '\n');
  };

  const created: string[] = [];
  try {
    await call('connection', 'check_bitwig_connection', {});
    await call('tracks', 'list_tracks', {});
    const clips = (await call('add-tracks', 'add_tracks', { tracks: [{ name: 'gn-8h4g-clips' }] })).readback.tracks[0].trackId as string;
    created.push(clips);

    // Scenes first: a scene change makes every earlier change record stale (scene epoch).
    await call('add-scene', 'add_scenes', { count: 1 });
    const scenes = (await adapter.revision()).window.scenes.count;
    await call('delete-scene', 'delete_scene', { rows: [scenes - 1] });

    // Launcher clips: the typical clip (256 notes on 16 channels).
    await call('add-clip-typical', 'add_launcher_clip', { trackId: clips, row: 0, document: typicalDesired() });
    // Setup, not measured: a palette colour, so a clip property change can be reversed (E83).
    const target = clip(slot(track(clips), scene(0, (await adapter.revision()).sceneEpoch)));
    const metadata = Object.values((await adapter.read([clipMetadata(target)])).entries)[0]!.value;
    assert(metadata.of === 'clipMetadata');
    const { red, green, blue } = supportedClipColors()[0]!;
    await adapter.apply({ ops: [{ op: 'clip.update', clip: target, metadata: { ...metadata.metadata, color: { red, green, blue } } }] });
    await call('clip-props', 'set_launcher_clip_properties', { clips: [{ trackId: clips, row: 0,
      properties: { name: 'gn-inv' } }] });
    let read = await call('read-clip', 'read_launcher_clip', { trackId: clips, row: 0 });
    await call('read-clip-repeat', 'read_launcher_clip', { trackId: clips, row: 0 });
    const doc = () => parse(read.data.document as string, 'fields') as StateDocument;
    const patch = (lines: string[]) => ['DOC ghostnote-document 1.0 patch',
      `BASE ${JSON.stringify({ sha256: read.authority.base.sha256, ref: read.authority.base.ref })}`,
      'FIELDS id clip at duration pitch velocity channel mute', ...lines].join('\n') + '\n';
    const clipId = doc().clips[0]!.id;
    const targeted = await call('edit-targeted-16', 'edit_launcher_clip', { trackId: clips, row: 0,
      document: patch(Array.from({ length: 16 }, (_, c) => `ADD i${c + 1} ${clipId} 33/2 1/4 96 100 ${c + 1} false`)) });
    read = await call('read-clip-2', 'read_launcher_clip', { trackId: clips, row: 0 });
    const one = doc().events[0]!;
    await call('edit-whole-1', 'edit_launcher_clip', { trackId: clips, row: 0,
      document: patch([`UPDATE ${one.id} {"velocity":70}`]) });
    read = await call('read-clip-3', 'read_launcher_clip', { trackId: clips, row: 0 });
    await call('check-clips-1', 'check_launcher_clips', { refs: [read.authority.base.ref] });
    await call('launch-settings', 'set_launcher_clip_launch_settings', { clips: [{ trackId: clips, row: 0,
      quantization: '1', mode: 'default' }] });
    await call('copy-clip', 'copy_launcher_clips', { copies: [{ source: { trackId: clips, row: 0 },
      destination: { trackId: clips, row: 1 } }] });
    await call('move-clip', 'move_launcher_clips', { trackId: clips, firstRow: 1, lastRow: 1, destinationFirstRow: 2 });
    await call('show-clip', 'show_launcher_clip_in_detail_editor', { trackId: clips, row: 0 });
    await call('delete-clip', 'delete_launcher_clip', { clips: [{ trackId: clips, row: 2 }] });
    await call('changes', 'list_changes', {});
    await call('check-revert', 'check_revert', { changeId: targeted.effects[0].changeId });
    await call('revert-targeted', 'revert_change', { changeId: targeted.effects[0].changeId }, false);
    // Tracks.
    await call('rename-track', 'rename_track', { tracks: [{ trackId: clips, name: 'gn-8h4g-clips-2' }] });
    const copy = (await call('duplicate-track', 'duplicate_track', { trackId: clips, name: 'gn-8h4g-copy' })).readback.copy.trackId as string;
    created.push(copy);

    // Devices on a second fresh track.
    const devices = (await call('add-tracks-2', 'add_tracks', { tracks: [{ name: 'gn-8h4g-devices' }] })).readback.tracks[0].trackId as string;
    created.push(devices);
    await call('add-device', 'add_devices', { trackId: devices, devices: [{ kind: 'native', name: 'Polysynth' }] });
    await call('read-devices-1', 'read_devices', { trackId: devices });
    const controls = await call('read-controls', 'read_device_controls', { device: { trackId: devices, devicePosition: 0 } });
    await call('read-controls-same', 'read_device_controls', { device: { trackId: devices, devicePosition: 0 } });
    const first = (controls.parameters as Wire[]).find((item) => item.discreteValueCount === undefined
      && typeof item.normalizedValue === 'number')!;
    await call('set-controls-1', 'set_device_controls', { settings: [{ kind: 'direct', device: { trackId: devices, devicePosition: 0 },
      parameterId: first.id, normalizedValue: first.normalizedValue > 0.5 ? 0.25 : 0.75 }] });
    const disabled = await call('device-enabled', 'set_device_enabled', { settings: [{ trackId: devices, devicePosition: 0, enabled: false }] });
    await call('revert-enabled', 'revert_change', { changeId: disabled.effects[0].changeId }, false);
    const order = (await call('read-devices-2', 'read_devices', { trackId: devices })).data.devices
      .map((item: Wire) => ({ name: item.name, enabled: item.enabled }));
    const wrapped = await call('wrap', 'wrap_existing_device_modulation', { trackId: devices, devicePosition: 0,
      expectedDeviceOrder: order, containerKind: 'FX Layer', entryName: 'Layer 1',
      modulators: [{ modulator: 'lfo', target: { parameterId: first.id, parameterName: first.name }, amount: 0.3 }] }, false);
    if (wrapped.reversalCheckpoint !== undefined) {
      await call('wrap-reverse', 'reverse_existing_device_modulation_wrap', { checkpoint: wrapped.reversalCheckpoint }, false);
    }
    await call('compose-2', 'compose_devices', { trackId: devices, containerKind: 'Instrument Layer', containerPosition: 1,
      layerChains: [{ name: 'A', devices: [{ source: { kind: 'native', name: 'Polysynth' } }] },
        { name: 'B', devices: [{ source: { kind: 'native', name: 'Phase-4' } }] }] }, false);
    let structure = await call('read-devices-3', 'read_devices', { trackId: devices });
    const at = (structure.data.devices as Wire[]).findIndex((item) => item.name === 'Instrument Layer');
    if (at >= 0) {
      await call('solo', 'set_layer_chain_solo', { trackId: devices, containerPosition: at, layerChain: 'A', mode: 'exclusive' }, false);
      await call('rename-chain', 'rename_layer_chain', { trackId: devices, containerPosition: at, layerChain: 'B', name: 'C' }, false);
      await call('duplicate-chain', 'duplicate_layer_chain', { trackId: devices, containerPosition: at, layerChain: 'C', name: 'D' }, false);
      await call('copy-device', 'copy_devices', { trackId: devices, devices: [{ from: 'layer-chain', containerPosition: at,
        layerChain: 'A', devicePosition: 0 }], destination: { to: 'layer-chain', containerPosition: at, layerChain: 'C' } }, false);
      await call('move-device', 'move_devices', { trackId: devices, devices: [{ from: 'layer-chain', containerPosition: at,
        layerChain: 'C', devicePosition: 0 }], destination: { to: 'track-end' } }, false);
      structure = await call('read-devices-4', 'read_devices', { trackId: devices });
      const container = (structure.data.devices as Wire[]).findIndex((item) => item.name === 'Instrument Layer');
      await call('delete-device', 'delete_device', { devices: [{ trackId: devices, devicePosition: container }] }, false);
    }
    await call('modulator-types', 'list_modulator_types', {});
    const preset = await call('read-preset', 'read_preset_modulation', { presetPath: POLY_MODTEST }, false);
    const bare = await call('read-preset-bare', 'read_preset_modulation', { presetPath: POLY_BARE }, false);
    if (bare.fingerprint !== undefined) {
      await call('edit-preset', 'edit_preset_modulation', { trackId: devices, presetPath: POLY_BARE, fingerprint: bare.fingerprint,
        location: { kind: 'self' }, operation: { kind: 'add', modulator: 'lfo', target: 'polysynth-filter-frequency', amount: 0.3 } }, false);
    }
    void preset;
  } finally {
    if (created.length > 0) await call('delete-tracks', 'delete_track', { trackIds: [...created].reverse() }, false);
    await save();
    await transport.close();
  }
}

/** The largest admitted add: `count` notes on 16 channels, one note each beat (the `worst` fixture shape). */
export function worstDesired(count: number): string {
  const perChannel = Math.ceil(count / 16);
  const length = Math.max(64, perChannel);
  const events: string[] = [];
  for (let channel = 0, n = 0; channel < 16; channel += 1) {
    for (let k = 0; k < perChannel && n < count; k += 1, n += 1) {
      events.push(`EVENT w${channel + 1}-${k} c1 ${k} 1/4 ${36 + ((k + channel) % 48)} 100 ${channel + 1}`);
    }
  }
  return ['DOC ghostnote-document 1.0 desired', `CLIP {"id":"c1","length":"${length}","loop":{"from":"0","to":"${length}"}}`,
    `COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"c1","fields":"all","status":"complete","from":"0","to":"${length}"}`,
    'FIELDS id clip at duration pitch velocity channel', ...events].join('\n') + '\n';
}

async function addWorst(dir: string, count: number): Promise<void> {
  const transport = new WireTransport();
  const adapter = new LiveAdapter({ transport });
  const workspace = workspaceOf({
    ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
    observationStore: new FakeObservationStore(),
  });
  const hello = await transport.send({ method: 'contract.hello' }) as Wire;
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [...NORMAL_8H4F]);
  const mark = await transport.send({ method: 'revision.get' }) as Wire;
  assert(/^New \d+$/.test(mark.project) && mark.project !== ANCHOR, `use an owned unsaved project, got ${mark.project}`);
  await adapter.hello();
  const tool = async (name: string, args: Wire) => await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const trackId = (await tool('add_tracks', { tracks: [{ name: 'gn-8h4g-add-worst' }] })).readback.tracks[0].trackId as string;
  try {
    const document = worstDesired(count);
    const from = transport.calls.length;
    const started = performance.now();
    const result = await tool('add_launcher_clip', { trackId, row: 0, document });
    const ms = performance.now() - started;
    const wire = wireSummary(transport.calls.slice(from));
    const out = { schema: `${SCHEMA}-add-worst`, hello, project: mark.project, count, documentBytes: Buffer.byteLength(document),
      ms: Math.round(ms), status: result.readback?.status, code: result.failure?.code, timing: result.timing,
      calls: transport.calls.length - from, turns: wire.turns, methods: wire.methods };
    say(out);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `add-worst-${count}.json`), JSON.stringify(out, null, 1) + '\n');
    assert.equal(result.readback?.status, 'verified', JSON.stringify(result).slice(0, 600));
  } finally {
    await tool('delete_track', { trackIds: [trackId] });
    await transport.close();
  }
}

/** Offline planner profile on the fake adapter: the read and a whole-clip velocity edit of `count` notes. */
export async function planBench(count: number, dryRun = true): Promise<Wire> {
  const fake = new FakeAdapter({ tracks: ['gn-bench'], scenes: 2 });
  const trackId = (await fake.tracks())[0]!.channelId;
  let id = 0;
  const workspace: Workspace = workspaceOf({ ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `b-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(), documents: new IdentityRegistry() });
  const perChannel = Math.ceil(count / 16);
  const lengthBeats = Math.max(64, perChannel);
  await workspace.apply([{ op: 'clip.create', slot: slot(track(trackId), scene(0, (await fake.revision()).sceneEpoch)), lengthBeats }]);
  const target = fake.model.visibleTracks()[0]!.slots[0]!;
  for (let channel = 0, n = 0; channel < 16; channel += 1) {
    for (let k = 0; k < perChannel && n < count; k += 1, n += 1) {
      const note: NoteRecord = { startBeats: k, pitch: 36 + ((k + channel) % 48), velocity: 100, durationBeats: 0.25,
        releaseVelocity: 100 / 127, isChanceEnabled: true, isOccurrenceEnabled: true, isRecurrenceEnabled: true,
        isRepeatEnabled: true };
      target.notes.set(`${channel}:${note.pitch}:${note.startBeats}`, note);
    }
  }
  fake.model.revision += 1;
  const started = performance.now();
  const first = await callTool(workspace, 'read_launcher_clip', { trackId, row: 0 }, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const readMs = performance.now() - started;
  const document = parse(first.data.document, 'fields') as StateDocument;
  const desired: StateDocument = { ...document, kind: 'desired', base: first.authority.base,
    coverage: document.coverage.map((item) => ({ ...item, fields: 'all' })),
    events: document.events.map((event) => ({ ...event, velocity: event.velocity === 100 ? 90 : 100 })) };
  const edited = await callTool(workspace, 'edit_launcher_clip', { trackId, row: 0, document: serialize(desired, 'fields'),
    dryRun }, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  return { count, readMs: Math.round(readMs), route: edited.plan?.route, code: edited.failure?.code, timing: edited.timing };
}

async function verifyOffline(dir: string): Promise<Wire> {
  const data = JSON.parse(await readFile(join(dir, 'inventory.json'), 'utf8')) as { rows: Row[] };
  const issues: string[] = [];
  for (const row of data.rows) {
    if (row.turns > row.calls) issues.push(`${row.step}: more turns than calls`);
    if (row.idleMs > row.ms) issues.push(`${row.step}: idle above wall`);
  }
  return { rows: data.rows.length, failed: data.rows.filter((row) => !row.ok).map((row) => [row.step, row.code]), issues };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [command, arg] = process.argv.slice(2);
  const run = command === 'inventory' ? inventory(arg!)
    : command === 'add-worst' ? addWorst(arg!, Number(process.argv[4] ?? 16_384))
    : command === 'plan-bench' ? planBench(Number(arg ?? 16_384)).then(say)
      : command === 'verify-offline' ? verifyOffline(arg!).then(say)
        : Promise.reject(new Error('usage: phase8h4g-inventory inventory|plan-bench|verify-offline <arg>'));
  run.then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
}
