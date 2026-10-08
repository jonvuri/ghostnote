/**
 * 8h4e device structure migration (E238). Live driver, normal profile, owned unsaved project (refuses the saved
 * anchor, D29). Every step calls the agent-native-v1 tools through the MCP dispatch path, with wall time and
 * result bytes.
 *
 *   recipes <dir>    A/B audition and winner collapse with the generic limbs, on fresh structure for each step:
 *                    compose (2 layer chains), controls read and write, solo exclusive/on/off, duplicate, rename,
 *                    the typed single-chain delete refusal, move out, delete the container, restore the position
 *   benchmark <dir>  equivalent 2- and 4-chain Instrument Layer requests through the offline and the staged
 *                    backend, each verified and reverted, 2 runs each
 *   clap <dir>       a CLAP plug-in (u-he Diva): read_device_controls (display), a set_device_controls write,
 *                    and its revert. The operator turns the audio engine on in the owned project first.
 *   verify-offline <dir>  recompute the claims from the retained artifacts
 *
 * Each command makes its own tracks and deletes them at the end.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { composeDevices } from '../surface/agent-native-devices.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { WireTransport } from './phase8h3c-promotion.js';

type Wire = Record<string, any>;
const SCHEMA = 'phase8h4e-devices-v1';
export const NORMAL_8H4E = ['normal-v1', 89, '0ef817f4bac8a8a7'] as const;
const ANCHOR = 'gn-scale-test';
const DIVA = 'com.u-he.Diva';

const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
  observationStore: new FakeObservationStore(),
});
const request = async (method: string, params?: Wire): Promise<Wire> =>
  await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
const say = (value: unknown): void => console.log(JSON.stringify(value));

interface Step { step: string; tool: string; ms: number; bytes: number; ok: boolean; code?: string; status?: string }
const steps: Step[] = [];
const results: Record<string, unknown> = {};

function record(step: string, tool: string, ms: number, result: Wire): Step {
  const failed = result.failure !== undefined || result.refused === true;
  const entry: Step = { step, tool, ms: Math.round(ms), bytes: Buffer.byteLength(JSON.stringify(result)), ok: !failed,
    ...(result.failure?.code === undefined ? {} : { code: result.failure.code }),
    ...(typeof result.readback?.status === 'string' ? { status: result.readback.status } : {}) };
  steps.push(entry); say(entry); results[step] = result;
  return entry;
}

/** One tool call. `expect: 'failure'` records a refusal as the expected outcome. */
async function call(step: string, name: string, args: Wire, expect: 'success' | 'failure' = 'success'): Promise<Wire> {
  const started = performance.now();
  const result = await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const entry = record(step, name, performance.now() - started, result);
  if (expect === 'success') assert(entry.ok, `${step} ${name}: ${JSON.stringify(result).slice(0, 800)}`);
  else assert(!entry.ok, `${step} ${name} must refuse: ${JSON.stringify(result).slice(0, 400)}`);
  return result;
}

async function guard(): Promise<Wire> {
  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [...NORMAL_8H4E]);
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project) && mark.project !== ANCHOR, `use an owned unsaved project, got ${mark.project}`);
  await adapter.hello();
  return { hello, mark };
}

async function newTrack(name: string): Promise<string> {
  // 8h4f renamed add_track to add_tracks; its readback names the new trackId.
  const added = await call(`add-track-${name}`, 'add_tracks', { tracks: [{ name }] });
  return added.readback.tracks[0].trackId as string;
}

const save = async (dir: string, name: string, extra: Wire): Promise<void> => {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), JSON.stringify({ schema: SCHEMA, steps, results, ...extra }, null, 1) + '\n');
};

const containerOf = (read: Wire, position: number): Wire => read.data.devices[position].container;
const chainNames = (read: Wire, position: number): string[] =>
  containerOf(read, position).layerChains.map((item: Wire) => item.name);
const solos = (read: Wire, position: number): boolean[] =>
  containerOf(read, position).layerChains.map((item: Wire) => item.solo);

async function recipes(dir: string): Promise<void> {
  const guarded = await guard();
  const trackId = await newTrack('gn-8h4e-ab');
  try {
    // A/B audition. 1: compose named layer chains (the offline path).
    const composed = await call('ab-compose', 'compose_devices', { trackId, containerKind: 'Instrument Layer',
      layerChains: [{ name: 'A', devices: [{ source: { kind: 'native', name: 'Polysynth' } }] },
        { name: 'B', devices: [{ source: { kind: 'native', name: 'Phase-4' } }] }] });
    assert.equal(composed.readback.status, 'verified');
    let read = await call('ab-read-1', 'read_devices', { trackId });
    assert.deepEqual(chainNames(read, 0), ['A', 'B']);
    // 2: ordinary device edits on each layer chain, with the display text of the full inventory.
    for (const chain of ['A', 'B']) {
      const target = { trackId, devicePosition: 0, route: [{ through: 'layer-chain', name: chain, devicePosition: 0 }] };
      const controls = await call(`ab-controls-${chain}`, 'read_device_controls', { device: target });
      assert.equal(controls.standing, 'stable');
      results[`ab-controls-${chain}-summary`] = { count: controls.parameters.length, displayComplete: controls.displayComplete,
        withDisplay: controls.parameters.filter((item: Wire) => typeof item.display === 'string').length };
      const again = await call(`ab-controls-${chain}-same-target`, 'read_device_controls', { device: target });
      assert.equal(again.standing, 'stable');
      const first = controls.parameters[0] as Wire;
      await call(`ab-set-${chain}`, 'set_device_controls', { settings: [{ kind: 'direct', device: target,
        parameterId: first.id, normalizedValue: first.normalizedValue > 0.5 ? 0.25 : 0.75 }] });
    }
    // 3 and 4: exclusive solo for each audition, then on and off.
    for (const [step, layerChain, mode, expected] of [
      ['ab-solo-A', 'A', 'exclusive', [true, false]], ['ab-solo-B', 'B', 'exclusive', [false, true]],
      ['ab-solo-B-again', 'B', 'exclusive', [false, true]], ['ab-solo-A-on', 'A', 'on', [true, true]],
      ['ab-solo-B-off', 'B', 'off', [true, false]], ['ab-solo-A-off', 'A', 'off', [false, false]],
    ] as const) {
      const solo = await call(step, 'set_layer_chain_solo', { trackId, containerPosition: 0, layerChain, mode });
      assert.equal(solo.readback.status, step === 'ab-solo-B-again' ? 'already-set' : 'verified', JSON.stringify(solo));
      read = await call(`${step}-read`, 'read_devices', { trackId });
      assert.deepEqual(solos(read, 0), [...expected]);
    }
    // Branch: duplicate one layer chain, then name the copy.
    await call('ab-duplicate', 'duplicate_layer_chain', { trackId, containerPosition: 0, layerChain: 'B', name: 'B copy' });
    read = await call('ab-duplicate-read', 'read_devices', { trackId });
    assert.deepEqual([...chainNames(read, 0)].sort(), ['A', 'B', 'B copy']);
    await call('ab-rename', 'rename_layer_chain', { trackId, containerPosition: 0, layerChain: 'B copy', name: 'C' });
    read = await call('ab-rename-read', 'read_devices', { trackId });
    assert.deepEqual([...chainNames(read, 0)].sort(), ['A', 'B', 'C']);
    // The typed single-chain delete refuses before a write.
    const refusal = await call('delete-layer-chain-refusal', 'delete_device',
      { devices: [{ trackId, devicePosition: 0, layerChain: 'C' }] }, 'failure');
    assert.equal(refusal.failure.code, 'unsupported');
    assert.equal(refusal.detail.reason, 'layer-chain-delete');
    read = await call('delete-layer-chain-refusal-read', 'read_devices', { trackId });
    assert.deepEqual([...chainNames(read, 0)].sort(), ['A', 'B', 'C']);

    // Winner collapse of B. Add one device after the container, so the restore has a position to prove.
    await call('collapse-add-tail', 'add_devices', { trackId, devices: [{ kind: 'native', name: 'Tool' }] });
    read = await call('collapse-read-1', 'read_devices', { trackId });
    assert.deepEqual(read.data.devices.map((item: Wire) => item.name), ['Instrument Layer', 'Tool']);
    const winner = containerOf(read, 0).layerChains.find((item: Wire) => item.name === 'B');
    const winnerDevices = winner.devices.map((item: Wire) => item.name);
    await call('collapse-move-out', 'move_devices', { trackId, devices: winnerDevices.map((_: string, index: number) => ({
      from: 'layer-chain', containerPosition: 0, layerChain: 'B', devicePosition: index })), destination: { to: 'track-end' } });
    read = await call('collapse-read-2', 'read_devices', { trackId });
    assert.deepEqual(containerOf(read, 0).layerChains.find((item: Wire) => item.name === 'B').devices, []);
    assert.deepEqual(read.data.devices.map((item: Wire) => item.name), ['Instrument Layer', 'Tool', ...winnerDevices]);
    const deleted = await call('collapse-delete-container', 'delete_device', { devices: [{ trackId, devicePosition: 0 }] });
    results['collapse-removed-layer-chains'] = deleted.readback.removedLayerChains;
    read = await call('collapse-read-3', 'read_devices', { trackId });
    assert.deepEqual(read.data.devices.map((item: Wire) => item.name), ['Tool', ...winnerDevices]);
    await call('collapse-restore', 'move_devices', { trackId, devices: winnerDevices.map((_: string, index: number) => ({
      from: 'top-level', devicePosition: 1 + index })), destination: { to: 'top-level-position', devicePosition: 0 } });
    read = await call('collapse-read-final', 'read_devices', { trackId });
    assert.deepEqual(read.data.devices.map((item: Wire) => item.name), [...winnerDevices, 'Tool']);
  } finally {
    await call('cleanup', 'delete_track', { trackIds: [trackId] });
  }
  await save(dir, 'recipes.json', { guard: guarded });
}

/** Equivalent requests: N layer chains of one native instrument each, appended to an empty track. */
const benchmarkRequest = (trackId: string, chains: number): Wire => ({
  trackId, containerKind: 'Instrument Layer',
  layerChains: ['Polysynth', 'Phase-4', 'FM-4', 'Organ'].slice(0, chains)
    .map((name, index) => ({ name: `L${index + 1}`, devices: [{ source: { kind: 'native', name } }] })),
});

async function benchmark(dir: string): Promise<void> {
  const guarded = await guard();
  const trackId = await newTrack('gn-8h4e-bench');
  const runs: Wire[] = [];
  try {
    for (let run = 0; run < 2; run += 1) {
      for (const chains of [2, 4]) {
        for (const backend of ['offline', 'staged'] as const) {
          const step = `bench-${chains}-${backend}-${run}`;
          const started = performance.now();
          const result = await composeDevices(workspace, benchmarkRequest(trackId, chains) as never, { backend }) as Wire;
          const ms = performance.now() - started;
          record(step, 'compose_devices', ms, result);
          assert.equal(result.readback?.status, 'verified', `${step}: ${JSON.stringify(result).slice(0, 800)}`);
          assert.equal(result.readback.backend, backend);
          const read = await call(`${step}-read`, 'read_devices', { trackId });
          assert.deepEqual(chainNames(read, 0), benchmarkRequest(trackId, chains).layerChains.map((item: Wire) => item.name));
          const reverted = await call(`${step}-revert`, 'revert_change', { changeId: result.next.revert.changeId });
          const after = await call(`${step}-after`, 'read_devices', { trackId });
          assert.deepEqual(after.data.devices, [], `${step}: the revert left ${JSON.stringify(after.data.devices)}`);
          runs.push({ chains, backend, run, ms: Math.round(ms), stages: result.effects.length,
            revertMs: steps.at(-2)!.ms, revertComplete: reverted.complete ?? reverted.applied });
        }
      }
    }
  } finally {
    await call('cleanup', 'delete_track', { trackIds: [trackId] });
  }
  await save(dir, 'benchmark.json', { guard: guarded, runs });
}

async function clap(dir: string): Promise<void> {
  const guarded = await guard();
  const trackId = await newTrack('gn-8h4e-clap');
  try {
    await call('clap-add', 'add_devices', { trackId, devices: [{ kind: 'clap', id: DIVA }] });
    const target = { trackId, devicePosition: 0 };
    const controls = await call('clap-controls', 'read_device_controls', { device: target });
    assert.equal(controls.standing, 'stable', 'turn the audio engine on in the owned project');
    results['clap-controls-summary'] = { count: controls.parameters.length, displayComplete: controls.displayComplete,
      withDisplay: controls.parameters.filter((item: Wire) => typeof item.display === 'string').length };
    await call('clap-controls-same-target', 'read_device_controls', { device: target });
    const first = (controls.parameters as Wire[]).find((item) => item.discreteValueCount === undefined) ?? controls.parameters[0];
    const set = await call('clap-set', 'set_device_controls', { settings: [{ kind: 'direct', device: target,
      parameterId: first.id, normalizedValue: first.normalizedValue > 0.5 ? 0.25 : 0.75 }] });
    assert.equal(set.verified, true, 'a CLAP write completes with the listed ID');
    const readback = await call('clap-controls-after', 'read_device_controls', { device: target });
    results['clap-written'] = { id: first.id, before: first.normalizedValue,
      after: (readback.parameters as Wire[]).find((item) => item.id === first.id) };
    await call('clap-revert', 'revert_change', { changeId: set.parameterChanges[0].changes[0].changeId });
  } finally {
    await call('cleanup', 'delete_track', { trackIds: [trackId] });
  }
  await save(dir, 'clap.json', { guard: guarded });
}

export async function verifyOffline(dir: string): Promise<Wire> {
  const load = async (name: string): Promise<Wire> => JSON.parse(await readFile(join(dir, name), 'utf8'));
  const recipesRun = await load('recipes.json');
  const ok = (run: Wire, step: string) => run.steps.find((item: Wire) => item.step === step);
  for (const step of ['ab-compose', 'ab-solo-A', 'ab-solo-B', 'ab-solo-A-on', 'ab-solo-B-off', 'ab-duplicate', 'ab-rename',
    'collapse-move-out', 'collapse-delete-container', 'collapse-restore']) {
    assert.equal(ok(recipesRun, step)?.ok, true, step);
  }
  assert.equal(ok(recipesRun, 'delete-layer-chain-refusal')?.code, 'unsupported');
  const bench = await load('benchmark.json');
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
  const summary: Wire = {};
  for (const chains of [2, 4]) {
    for (const backend of ['offline', 'staged']) {
      const ms = bench.runs.filter((item: Wire) => item.chains === chains && item.backend === backend).map((item: Wire) => item.ms);
      assert.equal(ms.length, 2);
      summary[`${chains}-${backend}`] = { runs: ms, median: median(ms) };
    }
  }
  return { recipes: 'pass', benchmark: summary };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [command, dir] = process.argv.slice(2);
  assert(dir !== undefined, 'give an output directory');
  const run = command === 'recipes' ? recipes(dir) : command === 'benchmark' ? benchmark(dir)
    : command === 'clap' ? clap(dir) : command === 'verify-offline' ? verifyOffline(dir).then(say)
      : Promise.reject(new Error(`unknown command ${command}`));
  run.then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
}
