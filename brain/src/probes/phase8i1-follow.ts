/**
 * 8i1 reader and cursor follow-mode repair (E250, D43). Live driver for a project that was saved with the ghostnote
 * cursor records ("ice jungle"). In such a project an unpinned cursor follows the selection and drives it.
 *
 *   follow <dir>   reads of the existing clips and devices, then a scratch track with one clip and one device:
 *                  add, read, edit, properties, controls, the reversals, and the track delete. After each tool, the
 *                  driver reads the selection and every owned cursor track pin. The existing tracks are only read.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { parse, type StateDocument } from '../document/index.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { WireTransport } from './phase8h3c-promotion.js';
import { typicalDesired, wireSummary } from './phase8h4g-inventory.js';
import { NORMAL_8H4F } from './phase8h4f-measure.js';

type Wire = Record<string, any>;
const SCHEMA = 'phase8i1-follow-v1';
const PROJECT = 'ice jungle';
const TRACK = 'gn-8i1-scratch';
const say = (value: unknown): void => console.log(JSON.stringify(value));

function patchText(base: Wire, lines: string[]): string {
  return ['DOC ghostnote-document 1.0 patch', `BASE ${JSON.stringify({ sha256: base.sha256, ref: base.ref })}`,
    'FIELDS id clip at duration pitch velocity channel mute', ...lines].join('\n') + '\n';
}

async function follow(dir: string): Promise<void> {
  const transport = new WireTransport();
  const traces: string[] = [];
  const adapter = new LiveAdapter({ transport, onTrace: (event: Wire) => {
    if (String(event.action).startsWith('selection')) traces.push(`${event.action} ${event.target}`);
  } });
  const workspace = workspaceOf({
    ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
    observationStore: new FakeObservationStore(),
  });
  const request = async (method: string, params?: Wire): Promise<Wire> =>
    await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
  const rows: Wire[] = [];
  const selection = async (): Promise<Wire> => {
    const s = await request('selection.status');
    return { track: s.trackIndex, slot: s.slotIndex, mixer: s.mixerTrackIndex };
  };
  const pins = async (): Promise<string[]> => (await request('revision.get')).unpinnedCursorTracks as string[];

  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [...NORMAL_8H4F]);
  const rig = await request('rig.info');
  assert.equal(rig.cursorTrackPins?.rule, 'owned-tracks-pinned-v1', 'deploy the 8i1 build');
  const mark = await request('revision.get');
  assert.equal(mark.project, PROJECT, `open "${PROJECT}", a project saved with the cursor records`);
  await adapter.hello();
  const before = (await request('track.list')).tracks as Wire[];
  assert(!before.some((row) => row.name === TRACK), `${TRACK} is left from an earlier run; delete it first`);
  const entry = await selection();

  const call = async (step: string, tool: string, args: Wire, expectSelection = true): Promise<Wire> => {
    const from = transport.calls.length;
    traces.length = 0;
    const started = performance.now();
    const result = await callTool(workspace, tool, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
    const ms = performance.now() - started;
    const calls = transport.calls.slice(from);
    const wire = wireSummary(calls);
    const after = await selection();
    const unpinned = await pins();
    const row = { step, tool, ok: result.failure === undefined, code: result.failure?.code,
      failure: result.failure === undefined ? undefined : JSON.stringify(result.failure).slice(0, 1500), ms: Math.round(ms),
      calls: calls.length, turns: wire.turns, clipReads: wire.clipReads, pinTrackFrames: calls.filter((item) =>
        item.method === 'cursor.pinTrack').length, selection: after, selectionKept: JSON.stringify(after) ===
        JSON.stringify(entry), unpinned, traces: [...traces] };
    rows.push(row);
    say(row);
    assert(row.ok, `${step} ${tool}: ${JSON.stringify(result).slice(0, 800)}`);
    assert.deepEqual(unpinned, [], `${step}: an owned cursor track is unpinned`);
    assert.equal(row.pinTrackFrames, 0, `${step}: a track pin frame was sent`);
    if (expectSelection) assert(row.selectionKept, `${step}: the selection moved to ${JSON.stringify(after)}`);
    return result;
  };

  const results: Wire = { schema: SCHEMA, hello, project: mark.project, entry, rows };
  let trackId: string | undefined;
  try {
    await call('connection', 'check_bitwig_connection', {});
    for (const row of before.filter((item) => item.type === 'Instrument')) {
      for (const scene of [0, 1]) {
        const slot = await request('slot.status', { trackIndex: row.index, slotIndex: scene }).catch(() => undefined);
        if (slot?.hasContent !== true) continue;
        await call(`read-${row.name}-${scene}`, 'read_launcher_clip', { trackId: row.channelId, row: scene });
      }
      await call(`devices-${row.name}`, 'read_devices', { trackId: row.channelId });
    }
    // The scratch track: add_tracks can select the new track, so its selection is reported, not required.
    trackId = (await call('add-track', 'add_tracks', { tracks: [{ name: TRACK }] }, false))
      .readback.tracks[0].trackId as string;
    // Bitwig selects a clip that createNewLauncherClip makes, and the creation records no borrow, so the add leaves
    // the slot selection on the new clip (a host behaviour; the pins do not change it). Later steps start there.
    const added = await call('add-clip', 'add_launcher_clip', { trackId, row: 0, document: typicalDesired() }, false);
    const scratchEntry = await selection();
    const kept = (row: Wire) => JSON.stringify(row.selection) === JSON.stringify(scratchEntry);
    const step = async (name: string, tool: string, args: Wire): Promise<Wire> => {
      const result = await call(name, tool, args, false);
      assert(kept(rows.at(-1)!), `${name}: the selection moved to ${JSON.stringify(rows.at(-1)!.selection)}`);
      return result;
    };
    const read = await step('read-scratch', 'read_launcher_clip', { trackId, row: 0 });
    const doc = parse(read.data.document, 'fields') as StateDocument;
    const clipId = doc.clips[0]!.id;
    const inserts = Array.from({ length: 16 }, (_, c) => `ADD i${c + 1} ${clipId} 33/2 1/4 96 100 ${c + 1} false`);
    const edited = await step('edit', 'edit_launcher_clip',
      { trackId, row: 0, document: patchText(read.authority.base, inserts) });
    const named = await step('properties', 'set_launcher_clip_properties',
      { clips: [{ trackId, row: 0, properties: { name: 'gn-8i1' } }] });
    const device = await step('add-device', 'add_devices', { trackId, devices: [{ kind: 'native', name: 'Tool' }] });
    const target = { trackId, devicePosition: 0 };
    const controls = await step('controls', 'read_device_controls', { device: target });
    const first = controls.parameters[0] as Wire;
    const set = await step('set-control', 'set_device_controls', { settings: [{ kind: 'direct', device: target,
      parameterId: first.id, normalizedValue: first.normalizedValue > 0.5 ? 0.25 : 0.75 }] });
    for (const [name, change] of [['set-control', set], ['add-device', device], ['properties', named],
      ['edit', edited], ['add-clip', added]] as const) {
      const changeId = change.effects?.[0]?.changeId ?? change.parameterChanges?.[0]?.changes?.[0]?.changeId
        ?? change.next?.revert?.changeId ?? change.next?.revert?.[0]?.changeId;
      assert(typeof changeId === 'string', `${name}: no change ID in ${JSON.stringify(change).slice(0, 400)}`);
      await step(`revert-${name}`, 'revert_change', { changeId });
    }
  } finally {
    if (trackId !== undefined) await call('delete-track', 'delete_track', { trackIds: [trackId] }, false);
    const after = (await request('track.list')).tracks as Wire[];
    results.tracksRestored = JSON.stringify(after.map((row) => row.channelId))
      === JSON.stringify(before.map((row) => row.channelId));
    results.exit = await selection();
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'follow.json'), JSON.stringify(results, null, 1) + '\n');
    await transport.close();
  }
  assert(results.tracksRestored, 'the track list differs from the entry');
  say({ done: true, tracksRestored: results.tracksRestored, entry, exit: results.exit });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'follow' && dir !== undefined) await follow(dir);
  else throw new Error('usage: phase8i1-follow.ts follow <dir>');
  process.exit(0);
}
