/**
 * 8i2 collapsed-group live verification (D34, D43). Live driver for `gn-scale-test` on the D43 build. Product tools
 * only; raw requests are reads (selection, pins, track list) between the timed tools.
 *
 *   setup <state.json>          three owned tracks (a, b, deep), each with clips in rows 0 and 1, and Tool on a and
 *                               b. Then the operator groups a and b (Cmd+G), and groups deep three times (an inner
 *                               group inside a middle group inside an outer group).
 *   expanded <dir> <state.json> the control arm, every group expanded (also Group 5): the reads, the checks, the
 *                               targeted edit and its revert, and the device route. Records the documents.
 *   collapsed <dir> <state.json> the same matrix with every group collapsed. Each document must equal the control arm.
 *   delete <dir> <state.json>   groups collapsed: point a finder and a pool cursor at b, delete b, then read a.
 *   delete-control <dir> <state.json> setup|run   two top-level scratch tracks: delete one with no owned cursor
 *                               on it, then one after read_devices; each reports the mixer selection.
 *   switch <dir> <state.json>   after the operator switched to another project and back: the pins, then the reads.
 *   cleanup <dir> <state.json>  delete every track that is not in the E234 baseline; check the baseline.
 *   verify-offline <dir>        check every E251 claim from the retained artifacts.
 *
 * After each tool, the driver reads the selection, the collapse state (`track.list` `hidden`), the unpinned owned
 * cursor tracks, and `rig.stats` (`repins`, `untargeted`). Without a host event, a re-pin comes only from a cursor
 * without a track that gets one: the repins rise by the fall of `untargeted`.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { parse, type StateDocument } from '../document/index.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { WireTransport, type Call } from './phase8h3c-promotion.js';
import { wireSummary } from './phase8h4g-inventory.js';
import { NORMAL_8H4F } from './phase8h4f-measure.js';

type Wire = Record<string, any>;
const SCHEMA = 'phase8i2-groups-v1';
const PROJECT = 'gn-scale-test';
const BASELINE = '../context/evidence/data/phase8h4a5-cursor/baseline-final.json';
const E16 = 'e75d9383-425e-4bff-9ca6-802bb9caed02';
const NAMES = { a: 'gn-8i2-a', b: 'gn-8i2-b', deep: 'gn-8i2-deep' } as const;
const say = (value: unknown): void => console.log(JSON.stringify(value));

/** A small fixture clip: four notes, distinct for each track and row. */
function fixtureDesired(seed: number): string {
  const events = [0, 1, 2, 3].map((beat) =>
    `EVENT n${beat} c1 ${beat} 1/2 ${48 + seed + beat * 3} ${80 + beat} ${1 + (beat % 2)}`);
  return ['DOC ghostnote-document 1.0 desired', 'CLIP {"id":"c1","length":"4","loop":{"from":"0","to":"4"}}',
    'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"c1","fields":"all","status":"complete","from":"0","to":"4"}',
    'FIELDS id clip at duration pitch velocity channel', ...events].join('\n') + '\n';
}

function patchText(base: Wire, lines: string[]): string {
  return ['DOC ghostnote-document 1.0 patch', `BASE ${JSON.stringify({ sha256: base.sha256, ref: base.ref })}`,
    'FIELDS id clip at duration pitch velocity channel mute', ...lines].join('\n') + '\n';
}

/** The content of a read document: clips and events, with no clip or event ID (each process assigns its own). */
function content(text: string): string {
  const doc = parse(text, 'fields') as StateDocument;
  return JSON.stringify({ clips: doc.clips.map(({ id: _id, ...rest }) => rest),
    events: doc.events.map(({ id: _id, clip: _clip, ...rest }) => rest)
    .sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))) });
}

/** The wire call sequence: method, gap after the previous reply, and duration (ms). */
function sequence(calls: readonly Call[]): string[] {
  let last = calls[0]?.sent ?? 0;
  return calls.map((call) => {
    const gap = Math.round(call.sent - last);
    const ms = Math.round((call.received < 0 ? call.sent : call.received) - call.sent);
    last = Math.max(last, call.received);
    return `${call.method} +${gap} ${ms}`;
  });
}

const changeIdOf = (change: Wire): string | undefined => change.effects?.[0]?.changeId
  ?? change.next?.revert?.changeId ?? change.next?.revert?.[0]?.changeId;

async function session(dir: string | undefined, statePath: string, mode: string) {
  const transport = new WireTransport();
  const adapter = new LiveAdapter({ transport });
  const workspace = workspaceOf({
    ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
    observationStore: new FakeObservationStore(),
  });
  const request = async (method: string, params?: Wire): Promise<Wire> =>
    await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [...NORMAL_8H4F]);
  const rig = await request('rig.info');
  assert.equal(rig.cursorTrackPins?.rule, 'owned-tracks-pinned-v1', 'deploy the 8i1 build');
  const mark = await request('revision.get');
  assert.equal(mark.project, PROJECT, `open "${PROJECT}"`);
  await adapter.hello();

  const tracks = async (): Promise<Wire[]> => (await request('track.list')).tracks as Wire[];
  /** The selection by channel ID, the hidden tracks, the unpinned cursors, and the pin counters. */
  const observe = async (): Promise<Wire> => {
    const list = await tracks();
    const s = await request('selection.status');
    const pins = (await request('rig.stats')).cursorTrackPins as Wire;
    const unpinned = (await request('revision.get')).unpinnedCursorTracks as string[];
    const at = (index: unknown) => (typeof index === 'number' && index >= 0 ? list[index]?.name ?? index : index);
    return { selection: { track: at(s.trackIndex), slot: s.slotIndex, mixer: at(s.mixerTrackIndex) },
      hidden: list.filter((row) => row.hidden === true).map((row) => row.name), unpinned,
      repins: pins.repins as number, untargeted: pins.untargeted as number };
  };
  const state: Wire = JSON.parse(await readFile(statePath, 'utf8').catch(() => '{}'));
  if (state.control !== undefined) {
    // Control documents from an earlier form of content() kept the clip IDs.
    for (const [key, value] of Object.entries(state.control as Record<string, string>)) {
      const doc = JSON.parse(value) as Wire;
      if (doc.clips[0]?.id === undefined) continue;
      state.control[key] = JSON.stringify({ clips: (doc.clips as Wire[]).map(({ id: _id, ...rest }) => rest),
        events: (doc.events as Wire[]).map(({ clip: _clip, ...rest }) => rest) });
    }
  }
  const rows: Wire[] = [];
  const entry = await observe();
  say({ mode, entry });
  assert.deepEqual(entry.unpinned, [], 'an owned cursor track is unpinned at the entry');
  let previous = entry;
  // The state that each step must keep. A host event (a structural write) sets it to the state after the event.
  let expected = entry;

  /** One timed tool call and its readback. `kept` false reports the selection without the requirement. */
  const call = async (step: string, tool: string, args: Wire, options: { kept?: boolean; event?: boolean } = {})
    : Promise<Wire> => {
    const from = transport.calls.length;
    const started = performance.now();
    const result = await callTool(workspace, tool, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
    const ms = performance.now() - started;
    const calls = transport.calls.slice(from);
    const wire = wireSummary(calls);
    const after = await observe();
    const reads = calls.filter((item) => item.method === 'clip.read');
    const row: Wire = { step, tool, ok: result.failure === undefined, code: result.failure?.code,
      failure: result.failure === undefined ? undefined : JSON.stringify(result.failure).slice(0, 1500),
      ms: Math.round(ms), calls: calls.length, turns: wire.turns, methods: wire.methods,
      clipReadMs: reads.map((item) => Math.round(item.received - item.sent)),
      groupPoints: calls.filter((item) => item.method === 'cursor.pointExpanded').length,
      pinTrackFrames: calls.filter((item) => item.method === 'cursor.pinTrack').length,
      readback: result.readback?.status, ...after,
      selectionKept: JSON.stringify(after.selection) === JSON.stringify(expected.selection),
      hiddenKept: JSON.stringify(after.hidden) === JSON.stringify(expected.hidden),
      repinDelta: after.repins - previous.repins, untargetedDelta: after.untargeted - previous.untargeted,
      sequence: sequence(calls) };
    previous = after;
    if (options.event === true) expected = after;
    rows.push(row);
    say(row);
    assert(row.ok, `${step} ${tool}: ${JSON.stringify(result).slice(0, 800)}`);
    assert.deepEqual(row.unpinned, [], `${step}: an owned cursor track is unpinned`);
    assert.equal(row.pinTrackFrames, 0, `${step}: a track pin frame was sent`);
    if (options.event !== true) {
      assert.equal(row.repinDelta + row.untargetedDelta, 0, `${step}: a re-pin that no new cursor target explains`);
      assert(row.hiddenKept, `${step}: the collapse state moved to ${JSON.stringify(row.hidden)}`);
    }
    if (options.kept !== false) assert(row.selectionKept, `${step}: the selection moved to ${JSON.stringify(row.selection)}`);
    if (row.readback !== undefined) assert.equal(row.readback, 'verified', `${step}: readback ${row.readback}`);
    return result;
  };
  const read = async (step: string, trackId: string, row: number): Promise<Wire> =>
    await call(step, 'read_launcher_clip', { trackId, row });

  const finish = async (extra: Wire = {}): Promise<void> => {
    const exit = await observe();
    if (dir !== undefined) {
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `${mode}.json`), JSON.stringify({ schema: SCHEMA, mode, hello, project: mark.project,
        entry, exit, rows, ...extra }, null, 1) + '\n');
    }
    await writeFile(statePath, JSON.stringify(state, null, 1) + '\n');
    await transport.close();
    say({ done: mode, exit });
  };
  return { request, tracks, observe, call, read, state, entry, rows, finish };
}

type Session = Awaited<ReturnType<typeof session>>;

async function setup(statePath: string): Promise<void> {
  const s = await session(undefined, statePath, 'setup');
  const before = await s.tracks();
  assert(!before.some((row) => Object.values(NAMES).includes(row.name)), 'owned tracks are left; run cleanup first');
  const added = await s.call('add-tracks', 'add_tracks',
    { tracks: [{ name: NAMES.a }, { name: NAMES.b }, { name: NAMES.deep }] }, { kept: false, event: true });
  const ids = Object.fromEntries((added.readback.tracks as Wire[]).map((row) => [row.name, row.trackId]));
  s.state.ids = { a: ids[NAMES.a], b: ids[NAMES.b], deep: ids[NAMES.deep] };
  for (const [key, seed] of [['a', 0], ['b', 1], ['deep', 2]] as const) {
    for (const row of [0, 1]) {
      await s.call(`add-clip-${key}-${row}`, 'add_launcher_clip',
        { trackId: s.state.ids[key], row, document: fixtureDesired(seed * 12 + row * 5) }, { kept: false, event: true });
    }
    if (key !== 'deep') {
      await s.call(`add-device-${key}`, 'add_devices',
        { trackId: s.state.ids[key], devices: [{ kind: 'native', name: 'Tool' }] }, { kept: false, event: true });
    }
  }
  await s.finish();
  console.log(`Operator: select ${NAMES.a} and ${NAMES.b}, press Cmd+G. Select ${NAMES.deep}, press Cmd+G; select the `
    + 'new group, press Cmd+G; select that new group, press Cmd+G (three levels). Expand every group, also Group 5. '
    + 'Then select a slot of gn-A.');
}

/** The read, check, edit, and device matrix of one arm. `control` holds the expanded documents. */
async function matrix(s: Session, arm: 'expanded' | 'collapsed'): Promise<void> {
  const ids = s.state.ids as Wire;
  const expectHidden = arm === 'collapsed';
  const list = await s.tracks();
  for (const id of [E16, ids.a, ids.b, ids.deep]) {
    assert.equal(list.find((row) => row.channelId === id)?.hidden === true, expectHidden,
      `${list.find((row) => row.channelId === id)?.name} is not ${arm}`);
  }
  const documents: Wire = {};
  const refs: string[] = [];
  for (const [key, id] of [['e16', E16], ['a', ids.a], ['deep', ids.deep]] as const) {
    for (const row of [0, 1]) {
      const result = await s.read(`read-${key}-${row}`, id, row);
      documents[`${key}-${row}`] = content(result.data.document);
      refs.push(result.authority.base.ref as string);
      const points = s.rows.at(-1)!.groupPoints as number;
      assert.equal(points, 0, `read-${key}-${row}: the reader sent a cursor.pointExpanded`);
    }
  }
  const check = await s.call('check', 'check_launcher_clips', { refs });
  const verdicts = (check.data.results as Wire[]).map((item: Wire) => item.verdict);
  assert.deepEqual(verdicts, refs.map(() => 'current'), `check verdicts ${JSON.stringify(check).slice(0, 600)}`);

  // The targeted edit and its revert, on row 1 of a and of deep.
  for (const key of ['a', 'deep'] as const) {
    const before = await s.read(`edit-read-${key}`, ids[key], 1);
    const doc = parse(before.data.document, 'fields') as StateDocument;
    const clipId = doc.clips[0]!.id;
    const inserts = Array.from({ length: 16 }, (_, c) => `ADD i${c + 1} ${clipId} 3/2 1/4 ${60 + c} 100 ${c + 1} false`);
    const edited = await s.call(`edit-${key}`, 'edit_launcher_clip',
      { trackId: ids[key], row: 1, document: patchText(before.authority.base, inserts) });
    const changeId = changeIdOf(edited);
    assert(typeof changeId === 'string', `edit-${key}: no change ID`);
    await s.call(`revert-edit-${key}`, 'revert_change', { changeId });
    const after = await s.read(`revert-read-${key}`, ids[key], 1);
    assert.equal(content(after.data.document), content(before.data.document), `revert-edit-${key}: not exact`);
  }

  // The device route: read_devices, set_device_enabled, and its revert on a.
  const devices = await s.call('devices-a', 'read_devices', { trackId: ids.a });
  const tool = devices.data.devices[0] as Wire;
  assert.equal(tool.name, 'Tool');
  const enabled = await s.call('enable-a', 'set_device_enabled',
    { settings: [{ trackId: ids.a, devicePosition: 0, enabled: tool.enabled === false }] });
  const enableId = changeIdOf(enabled);
  assert(typeof enableId === 'string', 'enable-a: no change ID');
  await s.call('revert-enable-a', 'revert_change', { changeId: enableId });
  const restored = await s.call('devices-a-after', 'read_devices', { trackId: ids.a });
  assert.equal(JSON.stringify(restored.data.devices), JSON.stringify(devices.data.devices), 'revert-enable-a: not exact');

  if (arm === 'expanded') s.state.control = documents;
  else {
    for (const [key, value] of Object.entries(documents)) {
      assert.equal(value, s.state.control?.[key], `${key}: the collapsed document differs from the control arm`);
    }
  }
}

async function arm(dir: string, statePath: string, which: 'expanded' | 'collapsed'): Promise<void> {
  const s = await session(dir, statePath, which);
  try { await matrix(s, which); } finally { await s.finish(); }
  if (which === 'expanded') {
    console.log('Operator: collapse every group: the inner, middle, and outer group of deep, the group of a and b, '
      + 'and Group 5. Then select a slot of gn-A.');
  }
}

/** The delete event: a finder and a pool cursor on b, then b is deleted, then a later read of a. */
async function deleteEvent(dir: string, statePath: string): Promise<void> {
  const s = await session(dir, statePath, 'delete');
  const ids = s.state.ids as Wire;
  let extra: Wire = {};
  try {
    const list = await s.tracks();
    // The first run (delete-first.json) deleted b and stopped on a driver check; a rerun continues after the delete.
    if (list.some((row) => row.channelId === ids.b)) {
      assert.equal(list.find((row) => row.channelId === ids.b)?.hidden, true, 'the group of b is not collapsed');
      await s.read('read-b-1', ids.b, 1);
      await s.call('devices-b', 'read_devices', { trackId: ids.b });
      await s.call('delete-b', 'delete_track', { trackIds: [ids.b] }, { kept: false, event: true });
    }
    // A later call: the extension pins again in a later task.
    const later = await s.observe();
    const result = await s.read('read-a-1', ids.a, 1);
    assert.equal(content(result.data.document), s.state.control['a-1'], 'read-a-1 differs from the control arm');
    await s.call('devices-a', 'read_devices', { trackId: ids.a });
    extra = { later };
    assert.deepEqual(later.unpinned, [], 'an owned cursor track is unpinned after the delete');
    delete ids.b;
  } finally { await s.finish(extra); }
  console.log('Operator: switch to another project (for example "New 2"), then switch back to gn-scale-test. '
    + 'Do not change the collapse state or the selection.');
}

const CONTROL = { quiet: 'gn-8i2-ctl-quiet', pointed: 'gn-8i2-ctl-pointed' } as const;

/**
 * The delete control arm: two top-level scratch tracks. `quiet` gets no owned cursor; `pointed` gets a pool cursor
 * from read_devices. Each delete reports the mixer selection, so a host move is apart from a cursor that drives it.
 */
async function deleteControl(dir: string, statePath: string, phase: string): Promise<void> {
  const s = await session(dir, statePath, `delete-control-${phase}`);
  try {
    if (phase === 'setup') {
      const added = await s.call('add-control', 'add_tracks',
        { tracks: [{ name: CONTROL.quiet }, { name: CONTROL.pointed }] }, { kept: false, event: true });
      s.state.control_ids = Object.fromEntries((added.readback.tracks as Wire[]).map((row) => [row.name, row.trackId]));
    } else {
      const ids = s.state.control_ids as Wire;
      await s.call('delete-quiet', 'delete_track', { trackIds: [ids[CONTROL.quiet]] }, { kept: false, event: true });
      await s.call('devices-pointed', 'read_devices', { trackId: ids[CONTROL.pointed] }, { kept: false });
      await s.call('delete-pointed', 'delete_track', { trackIds: [ids[CONTROL.pointed]] }, { kept: false, event: true });
      await s.call('connection', 'check_bitwig_connection', {}, { kept: false });
      delete s.state.control_ids;
    }
  } finally { await s.finish(); }
  if (phase === 'setup') console.log('Operator: click the Group 10 track header, then a slot of gn-A.');
}

/** The project-switch event: poll the pins, then read the children. */
async function switchEvent(dir: string, statePath: string): Promise<void> {
  const s = await session(dir, statePath, 'switch');
  const ids = s.state.ids as Wire;
  try {
    await s.call('connection', 'check_bitwig_connection', {}, { event: true });
    for (const [key, id] of [['e16', E16], ['a', ids.a], ['deep', ids.deep]] as const) {
      const result = await s.read(`read-${key}-1`, id, 1);
      assert.equal(content(result.data.document), s.state.control[`${key}-1`], `read-${key}-1 differs`);
    }
    await s.call('devices-a', 'read_devices', { trackId: ids.a });
  } finally { await s.finish(); }
}

async function cleanup(dir: string, statePath: string): Promise<void> {
  const s = await session(dir, statePath, 'cleanup');
  const baseline = JSON.parse(await readFile(BASELINE, 'utf8')) as Wire;
  const known = new Set((baseline.tracks as Wire[]).map((row) => row.channelId));
  let extra: Wire = {};
  try {
    const extras = (await s.tracks()).filter((row) => !known.has(row.channelId));
    if (extras.length > 0) {
      await s.call('delete-fixtures', 'delete_track', { trackIds: extras.map((row) => row.channelId) },
        { kept: false, event: true });
    }
    const after = await s.tracks();
    const same = JSON.stringify(after.map((row) => [row.name, row.channelId, row.type]))
      === JSON.stringify((baseline.tracks as Wire[]).map((row) => [row.name, row.channelId, row.type]));
    const e16Hidden = after.find((row) => row.channelId === E16)?.hidden === true;
    extra = { deleted: extras.map((row) => row.name), matchesBaseline: same, group5Collapsed: e16Hidden };
    assert(same, 'the track list differs from the baseline');
    assert(e16Hidden, 'Group 5 is not collapsed');
  } finally { await s.finish(extra); }
}

/**
 * E251: check every claim from the retained artifacts. Each tool passed with no unpinned owned cursor and no track
 * pin frame; without a host event the re-pins equal the new cursor targets; the collapsed arm kept the selection and
 * the collapse state, and only its edits and reverts used `cursor.pointExpanded`; the read times stay within 20
 * percent of E241; a delete with no owned cursor on the track still moves the mixer selection (a host move).
 */
export async function verifyOffline(dir: string): Promise<void> {
  const load = async (name: string): Promise<Wire> => JSON.parse(await readFile(join(dir, `${name}.json`), 'utf8'));
  const runs = Object.fromEntries(await Promise.all(['expanded', 'collapsed', 'delete-first', 'delete',
    'delete-control-run', 'switch', 'cleanup'].map(async (name) => [name, await load(name)] as const)));
  const events = new Set(['delete-b', 'delete-quiet', 'delete-pointed', 'delete-fixtures']);
  for (const [name, run] of Object.entries(runs)) {
    assert.equal(run.schema, SCHEMA);
    assert.deepEqual(run.exit.unpinned, [], `${name}: unpinned at the exit`);
    for (const row of run.rows as Wire[]) {
      assert(row.ok, `${name} ${row.step}`);
      assert.deepEqual(row.unpinned, [], `${name} ${row.step}: unpinned`);
      assert.equal(row.pinTrackFrames, 0, `${name} ${row.step}: track pin frame`);
      if (row.readback !== undefined) assert.equal(row.readback, 'verified', `${name} ${row.step}`);
      if (!events.has(row.step)) assert.equal(row.repinDelta + row.untargetedDelta, 0, `${name} ${row.step}: re-pins`);
    }
  }
  for (const name of ['expanded', 'collapsed'] as const) {
    const rows = runs[name].rows as Wire[];
    assert.equal(rows.length, 19, `${name}: matrix size`);
    for (const row of rows) {
      assert(row.selectionKept && row.hiddenKept, `${name} ${row.step}: selection or collapse state moved`);
      const pointed = name === 'collapsed' && /^(edit|revert-edit)-(a|deep)$/.test(row.step);
      assert.equal(row.groupPoints, pointed ? 1 : 0, `${name} ${row.step}: cursor.pointExpanded count`);
    }
  }
  assert.deepEqual(runs.collapsed.entry.hidden.filter((name: string) => name.startsWith('gn-')),
    ['gn-E16', 'gn-8i2-a', 'gn-8i2-b', 'gn-8i2-deep']);
  assert.deepEqual(runs.expanded.entry.hidden, []);
  // E241 medians: 262 ms in one group, 378 ms nested. The collapsed arm reads stay within 20 percent.
  const median = (values: number[]): number => [...values].sort((x, y) => x - y)[Math.floor(values.length / 2)]!;
  const readMs = (prefix: RegExp) => (runs.collapsed.rows as Wire[]).filter((row) => prefix.test(row.step))
    .flatMap((row) => row.clipReadMs as number[]);
  assert(median(readMs(/^read-(e16|a)-/)) <= 262 * 1.2, 'one-group read regressed');
  assert(median(readMs(/^read-deep-/)) <= 378 * 1.2, 'nested read regressed');
  // The delete control: no owned cursor on the quiet track (no re-pin), and the mixer selection still moved.
  const control = runs['delete-control-run'] as Wire;
  const quiet = (control.rows as Wire[]).find((row) => row.step === 'delete-quiet')!;
  assert.equal(quiet.repinDelta, 0);
  assert.notEqual(quiet.selection.mixer, control.entry.selection.mixer, 'the quiet delete kept the mixer selection');
  assert.equal(quiet.selection.slot, control.entry.selection.slot);
  const deleteB = (runs['delete-first'].rows as Wire[]).find((row) => row.step === 'delete-b')!;
  assert(deleteB.repinDelta > 0, 'the delete of b re-pinned no cursor');
  for (const name of ['delete', 'switch'] as const) {
    for (const row of runs[name].rows as Wire[]) assert(row.selectionKept && row.hiddenKept, `${name} ${row.step}`);
  }
  assert.equal(runs.cleanup.matchesBaseline, true);
  assert.equal(runs.cleanup.group5Collapsed, true);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [mode, a, b] = process.argv.slice(2);
  if (mode === 'setup' && a !== undefined) await setup(a);
  else if ((mode === 'expanded' || mode === 'collapsed') && a !== undefined && b !== undefined) await arm(a, b, mode);
  else if (mode === 'delete' && a !== undefined && b !== undefined) await deleteEvent(a, b);
  else if (mode === 'delete-control' && a !== undefined && b !== undefined && process.argv[5] !== undefined) {
    await deleteControl(a, b, process.argv[5]);
  } else if (mode === 'switch' && a !== undefined && b !== undefined) await switchEvent(a, b);
  else if (mode === 'verify-offline' && a !== undefined) await verifyOffline(a);
  else if (mode === 'cleanup' && a !== undefined && b !== undefined) await cleanup(a, b);
  else throw new Error('usage: phase8i2-groups.ts setup <state.json> | expanded|collapsed|delete|switch|cleanup <dir> <state.json>');
  process.exit(0);
}
