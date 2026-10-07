/**
 * 8h4a4 cursor identity. Live driver for the cursor target check by `trackChannelId` (E240 defect).
 * Use an owned unsaved project for writes; the anchor mode is read-only (D29).
 *
 *   setup <state.json>                tracks before, in, in2, and after, each with a Polysynth and declared clips
 *                                     in rows 0 and 1. Then the operator groups in and in2 with Cmd+G.
 *   matrix <out> <state.json> <view>  on each track: the cursor-pointed reads (clip, launch, play, metadata,
 *                                     notes), a note insert and remove, a clip.update and restore, the note
 *                                     observer arm, and a device read, reuse, and param.set and restore. The
 *                                     device step first points cursor 0 at the empty group track (see there).
 *                                     view: expanded or collapsed (operator state of the group)
 *   collapsed-rows <out> <state.json> with the group collapsed: each cursor-pointed address alone, from a fresh
 *                                     adapter, on rows 0 and 1 of in, in2, and after, with the wire calls
 *   anchor <out>                      read-only, in gn-scale-test: the cursor-pointed reads of row 0 of gn-A,
 *                                     gn-E16 (inside the collapsed Group 5), and gn-sel (after the group); then
 *                                     the metadata of gn-E16 row 1 from a fresh adapter (expected to refuse)
 *   cleanup <out> <state.json>        delete every track that the entry list does not hold
 *   verify-offline <dir>              check every 8h4a4 claim from the retained artifacts
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import {
  addressKey, clip, clipLaunch, clipMetadata, clipPlay, device, notes, param, scene, slot, track,
  type Address, type ClipAddress,
} from '../contract/index.js';
import { EXACT_CLIP_COLORS } from '../contract/clip-color.js';
import type { E131Context } from './e131-diagnostic.js';
import { WireTransport, type Call } from './phase8h3c-promotion.js';
import { declared, type Wire } from './phase8h3c2-rows-lib.js';

export const CURSOR_IDENTITY = 'cursor-channel-id-v1';
const NORMAL: [number, string] = [87, 'ca139a3e62a55e68'];
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const KEYS = ['before', 'in', 'in2', 'after'] as const;
const ROWS = [0, 1] as const;
const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const request = async (method: string, params?: Wire, owned?: Call[]): Promise<Wire> =>
  await transport.sendRecorded({ method, ...(params ? { params } : {}) }, owned) as Wire;
const pause = async (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const load = async (path: string): Promise<Wire> => JSON.parse(await readFile(path, 'utf8'));
const save = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(value, null, 1) + '\n');
};
const artifact = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, gzipSync(JSON.stringify(value) + '\n'));
};
const gz = async (path: string): Promise<Wire> => JSON.parse(gunzipSync(await readFile(path)).toString('utf8'));
const failure = (error: unknown): string => error instanceof Error ? `${error.name}: ${error.message}` : String(error);
async function until(next: () => Promise<Wire>, done: (value: Wire) => boolean, limit = 30_000): Promise<Wire> {
  const started = performance.now();
  for (;;) {
    const value = await next(); if (done(value)) return value;
    assert(performance.now() - started < limit, `live state did not settle: ${JSON.stringify(value).slice(0, 400)}`);
    await pause(50);
  }
}

/** The normal profile, the 8h4a4 marker, and (unless read-only) an owned unsaved project. */
async function guard(project?: string): Promise<Wire> {
  const hello = await request('contract.hello');
  assert.equal(hello.runtimeProfile, 'normal-v1');
  assert.deepEqual([hello.methodCount, hello.methodsHash], NORMAL);
  const mark = await request('revision.get');
  if (project) assert.equal(mark.project, project);
  else assert(/^New \d+$/.test(mark.project), `use an owned unsaved project, got ${mark.project}`);
  const rig = await request('rig.info');
  assert.equal(rig.cursorIdentity, CURSOR_IDENTITY, 'the deployed extension lacks the 8h4a4 marker');
  await adapter.hello();
  return { hello, mark, rig };
}
async function rowOf(id: string): Promise<Wire> {
  const found = ((await request('track.list')).tracks as Wire[]).find(row => row.channelId === id);
  assert(found, `track ${id} is absent`); return found;
}
async function createTrack(name: string): Promise<string> {
  const before = new Set(((await request('track.list')).tracks as Wire[]).map(row => row.channelId));
  await request('track.create', { position: 0 });
  const after = await until(() => request('track.list'),
    value => (value.tracks as Wire[]).some(row => row.index === 0 && !before.has(row.channelId)));
  const id = String((after.tracks as Wire[]).find(row => row.index === 0)!.channelId);
  await request('track.setName', { trackIndex: 0, name }); return id;
}
const clipAt = async (id: string, row: number): Promise<ClipAddress> =>
  clip(slot(track(id), scene(row, Number((await request('revision.get')).sceneEpoch))));

async function setup(statePath: string): Promise<void> {
  const entry = await guard();
  const state: Wire = { schema: 'phase8h4a4-state-v1', entry, entryTracks: (await request('track.list')).tracks,
    tracks: {} };
  // Created at position 0 in reverse, so the bank order is before, in, in2, after.
  for (const key of [...KEYS].reverse()) {
    const id = await createTrack(`gn-8h4a4-${key}`);
    for (const row of ROWS) {
      const d = declared(row), index = Number((await rowOf(id)).index);
      await request('clip.create', { trackIndex: index, slotIndex: row, lengthBeats: d.beats });
      await until(() => request('slot.status', { trackIndex: index, slotIndex: row }), value => value.hasContent === true);
      await (adapter as unknown as E131Context).pointAtClip(await clipAt(id, row), index, new Map(), 'fine');
      await request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 / 4 });
      await request('cursor.setNotes', { cursor: 'fine', channel: d.channel,
        notes: [[d.step, d.pitch, 100, 0.25]] });
      await pause(250);
    }
    const index = Number((await rowOf(id)).index);
    await request('cursor.pointTrack', { cursor: '0', trackIndex: index });
    await pause(100);
    await request('device.insertBitwig', { cursor: '0', uuid: POLYSYNTH });
    await until(() => request('device.list', { cursor: '0' }),
      value => value.trackChannelId === id && (value.devices as Wire[] | undefined)?.[0]?.name === 'Polysynth');
    state.tracks[key] = id; await save(statePath, state);
  }
  console.log(JSON.stringify(state.tracks));
  console.log('Operator: select gn-8h4a4-in and gn-8h4a4-in2 and press Cmd+G.');
}

/** One step: its result, or its error. A failed step never loses the record. */
async function step(record: Wire[], label: Wire, run: () => Promise<Wire>): Promise<void> {
  const started = performance.now();
  try {
    const value = await run();
    record.push({ ...label, ok: true, ms: Math.round(performance.now() - started), ...value });
  } catch (error) {
    record.push({ ...label, ok: false, ms: Math.round(performance.now() - started), error: failure(error) });
  }
  const last = record.at(-1)!;
  console.log(JSON.stringify({ ...label, ok: last.ok, ...(last.ok ? {} : { error: last.error }) }));
}
const entryOf = (snapshot: Awaited<ReturnType<LiveAdapter['read']>>, address: Address): Wire | undefined =>
  snapshot.entries[addressKey(address)] as Wire | undefined;

/** The cursor-pointed reads of one row. Each address must read with the declared clip. */
async function cursorReads(id: string, row: number): Promise<Wire> {
  const d = declared(row), c = await clipAt(id, row);
  const addresses = [clip(c.slot), clipLaunch(c), clipPlay(c), clipMetadata(c), notes(c, d.channel)];
  const snapshot = await adapter.read(addresses);
  const values = Object.fromEntries(addresses.map(a => [a.kind, entryOf(snapshot, a)?.value]));
  assert.equal(values.clip?.exists, true, 'clip');
  assert.equal(values.clipLaunch?.of, 'clipLaunch', 'clipLaunch');
  assert.equal(values.clipPlay?.of, 'clipPlay', 'clipPlay');
  assert.equal(values.clipMetadata?.metadata?.lengthBeats, d.beats, 'clipMetadata length');
  const read = values.notes?.notes as Wire[] | undefined;
  assert.deepEqual(read?.map(n => [n.startBeats, n.pitch]), [[d.step / 4, d.pitch]], 'notes');
  return { values };
}

async function noteRoundTrip(id: string): Promise<Wire> {
  const c = await clipAt(id, 1), d = declared(1);
  const marker = { startBeats: 2, pitch: 72, velocity: 100, durationBeats: 0.25 };
  const insert = await adapter.apply({ ops: [{ op: 'note.insert', clip: c, channel: d.channel, notes: [marker] }] });
  const inserted = entryOf(await adapter.read([notes(c, d.channel)]), notes(c, d.channel))?.value.notes as Wire[];
  assert(inserted.some(n => n.startBeats === 2 && n.pitch === 72), 'the inserted note is absent');
  const remove = await adapter.apply({ ops: [{ op: 'note.remove', clip: c, channel: d.channel, notes: [marker] }] });
  const after = entryOf(await adapter.read([notes(c, d.channel)]), notes(c, d.channel))?.value.notes as Wire[];
  assert.deepEqual(after.map(n => [n.startBeats, n.pitch]), [[d.step / 4, d.pitch]], 'the clip did not restore');
  return { insertOk: insert.stages.flatMap(s => s.ops).every(op => op.ok),
    removeOk: remove.stages.flatMap(s => s.ops).every(op => op.ok), inserted: inserted.length };
}

async function clipUpdate(id: string): Promise<Wire> {
  const c = await clipAt(id, 0);
  const before = entryOf(await adapter.read([clipMetadata(c)]), clipMetadata(c))?.value.metadata as Wire;
  const color = EXACT_CLIP_COLORS[3]!.color;
  const changed = { ...before, name: `gn-8h4a4-${id.slice(0, 6)}`, color };
  await adapter.apply({ ops: [{ op: 'clip.update', clip: c, metadata: changed as never }] });
  const read = entryOf(await adapter.read([clipMetadata(c)]), clipMetadata(c))?.value.metadata as Wire;
  assert.equal(read.name, changed.name); assert.deepEqual(read.color, color);
  // A launcher clip's default colour is outside the palette, so the restore keeps the palette colour.
  await adapter.apply({ ops: [{ op: 'clip.update', clip: c, metadata: { ...changed, name: before.name } as never }] });
  const restored = entryOf(await adapter.read([clipMetadata(c)]), clipMetadata(c))?.value.metadata as Wire;
  assert.equal(restored.name, before.name);
  return { before, restored };
}

/** The note observer arm on the bank index: the extension now confirms only the channelId. */
async function observerArm(id: string): Promise<Wire> {
  const c = await clipAt(id, 1), index = Number((await rowOf(id)).index);
  const prepared = await request('note.observer.prepare');
  await (adapter as unknown as E131Context).pointAtClip(c, index, new Map(), 'observer');
  const armed = await request('note.observer.arm', { generation: prepared.generation, trackId: id,
    trackIndex: index, slotIndex: 1 });
  assert(Number.isInteger(armed.afterSequence), `the arm returned ${JSON.stringify(armed)}`);
  return { index, armed };
}

async function deviceRoundTrip(id: string): Promise<Wire> {
  const d = device(track(id), 0);
  // 8h4a4 finding: the DirectParameter ID observer fires only when the ID list
  // changes. Every fixture track has a Polysynth, so a read after another
  // Polysynth never settles. Point cursor 0 at the empty group track first.
  const group = ((await request('track.list')).tracks as Wire[]).find(row => row.type === 'Group');
  assert(group, 'the fixture has no group track');
  await request('cursor.pinTrack', { cursor: '0', pinned: false });
  await request('cursor.pointTrack', { cursor: '0', trackIndex: group.index });
  await pause(300);
  const first = entryOf(await adapter.read([d]), d)?.value;
  assert.equal(first?.device?.name, 'Polysynth');
  const p = first.device.params?.[0] as Wire | undefined;
  assert(p, 'the device read has no parameter');
  const address = param(d, String(p.id));
  const trace: string[] = [];
  const reuse = new LiveAdapter({ transport, onTrace: event => trace.push(event.action) });
  await reuse.hello();
  await reuse.preserveSelection(async () => { await reuse.read([address]); await reuse.read([address]); });
  const target = p.value < 0.5 ? p.value + 0.25 : p.value - 0.25;
  const guardChain = { expectedName: 'Polysynth', expectedChain: ['Polysynth'], expectedEnabledChain: [true] };
  await adapter.apply({ ops: [{ op: 'param.set', param: address, value: target, ...guardChain }] });
  const written = entryOf(await adapter.read([address]), address)?.value.param.value as number;
  await adapter.apply({ ops: [{ op: 'param.set', param: address, value: p.value, ...guardChain }] });
  const restored = entryOf(await adapter.read([address]), address)?.value.param.value as number;
  assert(Math.abs(written - target) < 1e-3, `param.set read ${written}, wanted ${target}`);
  assert(Math.abs(restored - p.value) < 1e-3, `param restore read ${restored}, wanted ${p.value}`);
  return { hop: group.index, param: p.id, base: p.value, written, restored, reused: trace.filter(a => a === 'device-reuse').length };
}

async function matrix(out: string, statePath: string, view: string): Promise<void> {
  assert(view === 'expanded' || view === 'collapsed');
  const entry = await guard(), state = await load(statePath);
  const tracks = (await request('track.list')).tracks as Wire[];
  const report: Wire = { schema: 'phase8h4a4-matrix-v1', view, entry, tracks, steps: [] };
  try {
    for (const key of KEYS) {
      const id = String(state.tracks[key]), row = await rowOf(id);
      const at = { key, index: row.index };
      for (const r of ROWS) await step(report.steps, { ...at, step: 'reads', row: r }, () => cursorReads(id, r));
      await step(report.steps, { ...at, step: 'notes' }, () => noteRoundTrip(id));
      await step(report.steps, { ...at, step: 'clip.update' }, () => clipUpdate(id));
      await step(report.steps, { ...at, step: 'observer' }, () => observerArm(id));
      await step(report.steps, { ...at, step: 'device' }, () => deviceRoundTrip(id));
    }
    report.final = (await request('track.list')).tracks;
    report.selection = await request('selection.status');
  } finally { await artifact(out, report); }
}

async function collapsedRows(out: string, statePath: string): Promise<void> {
  const entry = await guard(), state = await load(statePath);
  const report: Wire = { schema: 'phase8h4a4-collapsed-rows-v1', entry, tracks: (await request('track.list')).tracks,
    steps: [] };
  try {
    for (const key of ['in', 'in2', 'after']) {
      const id = String(state.tracks[key]), index = (await rowOf(id)).index;
      for (const r of [1, 0]) {
        const c = await clipAt(id, r);
        for (const address of [clip(c.slot), clipLaunch(c), clipPlay(c), clipMetadata(c)]) {
          const start = transport.calls.length;
          // A fresh adapter holds no cursor memo, so each read points again.
          const fresh = new LiveAdapter({ transport });
          await fresh.hello();
          await step(report.steps, { key, index, row: r, kind: address.kind }, async () => {
            const value = entryOf(await fresh.read([address]), address)?.value;
            assert(value !== undefined, 'no entry');
            return { value };
          });
          report.steps.at(-1).statuses = transport.calls.slice(start).filter(x => x.method === 'cursor.status')
            .map(x => [x.reply.result?.trackChannelId, x.reply.result?.sceneIndex]);
        }
      }
      // A write to row 1 must refuse or land in row 1. Row 0 must not change.
      const c1 = await clipAt(id, 1), c0 = await clipAt(id, 0), d0 = declared(0), d1 = declared(1);
      const marker = { startBeats: 2, pitch: 72, velocity: 100, durationBeats: 0.25 };
      const fresh = new LiveAdapter({ transport });
      await fresh.hello();
      let landed = false;
      await step(report.steps, { key, index, row: 1, kind: 'note.insert' }, async () => {
        const receipt = await fresh.apply({ ops: [{ op: 'note.insert', clip: c1, channel: d1.channel, notes: [marker] }] });
        landed = true;
        return { ok: receipt.stages.flatMap(item => item.ops).every(op => op.ok) };
      });
      const check = new LiveAdapter({ transport });
      await check.hello();
      const snapshot = await check.read([notes(c0, d0.channel), notes(c1, d1.channel)]);
      const row0 = (entryOf(snapshot, notes(c0, d0.channel))?.value.notes as Wire[]).map(n => [n.startBeats, n.pitch]);
      const row1 = (entryOf(snapshot, notes(c1, d1.channel))?.value.notes as Wire[]).map(n => [n.startBeats, n.pitch]);
      report.steps.at(-1).after = { row0, row1 };
      assert.deepEqual(row0, [[d0.step / 4, d0.pitch]], `${key}: row 0 changed`);
      assert.deepEqual(row1, landed ? [[d1.step / 4, d1.pitch], [2, 72]] : [[d1.step / 4, d1.pitch]], `${key}: row 1`);
      if (landed) await check.apply({ ops: [{ op: 'note.remove', clip: c1, channel: d1.channel, notes: [marker] }] });
    }
  } finally { await artifact(out, report); }
}

async function anchor(out: string): Promise<void> {
  const entry = await guard('gn-scale-test');
  const tracks = (await request('track.list')).tracks as Wire[];
  const report: Wire = { schema: 'phase8h4a4-anchor-v1', entry, tracks, steps: [] };
  try {
    for (const name of ['gn-A', 'gn-E16', 'gn-sel']) {
      const row = tracks.find(t => t.name === name)!;
      await step(report.steps, { name, index: row.index, step: 'reads' }, async () => {
        const c = await clipAt(String(row.channelId), 0);
        const addresses = [clip(c.slot), clipLaunch(c), clipPlay(c), clipMetadata(c)];
        const snapshot = await adapter.read(addresses);
        const values = Object.fromEntries(addresses.map(a => [a.kind, entryOf(snapshot, a)?.value]));
        assert.equal(values.clip?.exists, true); assert.equal(values.clipMetadata?.of, 'clipMetadata');
        assert.equal(values.clipLaunch?.of, 'clipLaunch'); assert.equal(values.clipPlay?.of, 'clipPlay');
        return { values };
      });
    }
    // The collapsed-child limitation: a fresh point cannot reach another row (collapsed-rows).
    const e16 = tracks.find(t => t.name === 'gn-E16')!;
    await step(report.steps, { name: 'gn-E16', index: e16.index, step: 'row1-metadata' }, async () => {
      const c = await clipAt(String(e16.channelId), 1);
      const fresh = new LiveAdapter({ transport });
      await fresh.hello();
      return { value: entryOf(await fresh.read([clipMetadata(c)]), clipMetadata(c))?.value };
    });
    report.final = (await request('revision.get'));
  } finally { await artifact(out, report); }
}

async function cleanup(out: string, statePath: string): Promise<void> {
  const entry = await guard(), state = await load(statePath);
  const entryIds = (state.entryTracks as Wire[]).map(row => row.channelId);
  const deleted: string[] = [];
  for (;;) {
    const extra = ((await request('track.list')).tracks as Wire[]).find(row => !entryIds.includes(row.channelId));
    if (!extra) break;
    await request('track.delete', { trackIndex: extra.index });
    await until(() => request('track.list'), value => !(value.tracks as Wire[]).some(row => row.channelId === extra.channelId));
    deleted.push(String(extra.channelId));
  }
  const tracks = (await request('track.list')).tracks as Wire[];
  assert.deepEqual(tracks.map(row => row.channelId), entryIds, 'the owned project does not match its entry tracks');
  await artifact(out, { schema: 'phase8h4a4-cleanup-v1', entry, deleted, tracks, entryTracks: state.entryTracks });
  console.log(JSON.stringify({ deleted: deleted.length, tracks: tracks.length }));
}

export async function verifyOffline(dir: string): Promise<Wire> {
  const summary: Wire = {};
  const state = await load(`${dir}/state.json`);
  for (const view of ['expanded', 'collapsed']) {
    const m = await gz(`${dir}/matrix-${view}.json.gz`);
    assert.equal(m.schema, 'phase8h4a4-matrix-v1'); assert.equal(m.view, view);
    assert.equal(m.entry.rig.cursorIdentity, CURSOR_IDENTITY);
    const group = (m.tracks as Wire[]).find(t => t.type === 'Group');
    assert(group, `${view}: the fixture has no group`);
    const index = Object.fromEntries((m.tracks as Wire[]).map(t => [t.channelId, t.index]));
    // Bank order: before, the group, in, in2, after. Only before has a bank index equal to its position.
    assert.deepEqual(KEYS.map(k => index[state.tracks[k]]), [0, 2, 3, 4]); assert.equal(group.index, 1);
    assert.equal((m.steps as Wire[]).length, KEYS.length * 6);
    const failed = (m.steps as Wire[]).filter(s => !s.ok).map(s => `${s.key}:${s.step}`);
    // Collapsed: a fresh point cannot reach row 1 of a child. The observer arm points
    // its own cursor there and refuses. The other row-1 steps reused pool cursors
    // that the expanded run had left on row 1 (see collapsed-rows).
    assert.deepEqual(failed, view === 'expanded' ? [] : ['in:observer', 'in2:observer'], `${view}: failed steps`);
    for (const s of (m.steps as Wire[]).filter(s => !s.ok)) assert.match(s.error, /^AddressUnresolvedError: .* row 1 did not confirm/);
    const device = (m.steps as Wire[]).filter(s => s.step === 'device');
    assert(device.every(s => s.ok && s.reused === 1 && Math.abs(s.restored - s.base) < 1e-3), `${view}: device`);
    summary[view] = { steps: m.steps.length, failed };
  }
  const rows = await gz(`${dir}/collapsed-rows.json.gz`);
  assert.equal(rows.schema, 'phase8h4a4-collapsed-rows-v1');
  const outcome = (rows.steps as Wire[]).map(s => `${s.key}:${s.row}:${s.kind}:${s.ok ? 'ok' : 'refused'}`);
  const kinds = ['clip', 'clipLaunch', 'clipPlay', 'clipMetadata'];
  const want = ['in', 'in2', 'after'].flatMap(key => [
    ...kinds.map(kind => `${key}:1:${kind}:${key === 'after' ? 'ok' : 'refused'}`),
    ...kinds.map(kind => `${key}:0:${kind}:ok`),
    `${key}:1:note.insert:${key === 'after' ? 'ok' : 'refused'}`,
  ]);
  assert.deepEqual(outcome, want);
  for (const s of (rows.steps as Wire[]).filter(s => !s.ok)) {
    assert.match(s.error, /^AddressUnresolvedError: .* row 1 did not confirm/);
  }
  for (const s of (rows.steps as Wire[]).filter(s => s.kind === 'note.insert')) {
    assert.deepEqual(s.after.row0, [[0, 60]], `${s.key}: row 0 changed`);
    assert.deepEqual(s.after.row1, s.ok ? [[0.25, 61], [2, 72]] : [[0.25, 61]], `${s.key}: row 1`);
  }
  summary.collapsedRows = { refused: outcome.filter(o => o.endsWith('refused')).length, total: outcome.length };
  const cleanup = await gz(`${dir}/cleanup.json.gz`);
  assert.deepEqual((cleanup.tracks as Wire[]).map(t => t.channelId), (cleanup.entryTracks as Wire[]).map(t => t.channelId));
  const a = await gz(`${dir}/anchor.json.gz`);
  assert.equal(a.entry.mark.project, 'gn-scale-test');
  assert.deepEqual((a.steps as Wire[]).map(s => [s.name, s.step, s.ok]), [['gn-A', 'reads', true],
    ['gn-E16', 'reads', true], ['gn-sel', 'reads', true], ['gn-E16', 'row1-metadata', false]]);
  assert.match(a.steps[3].error, /^AddressUnresolvedError: .* row 1 did not confirm/);
  summary.anchor = (a.steps as Wire[]).map(s => [s.name, s.index]);
  const baseline = await load(`${dir}/baseline-final.json`);
  assert.equal(baseline.project, 'gn-scale-test'); assert.equal(baseline.matchesE234, true);
  assert.equal(baseline.tracks.length, 11);
  for (const log of ['normal-hello.log', 'normal-hello-final.log']) {
    const hello = await readFile(`${dir}/${log}`, 'utf8');
    assert.match(hello, /ALL PASS/); assert.match(hello, /"cursorIdentity":"cursor-channel-id-v1"/);
    assert.match(hello, /"runtimeProfile":"normal-v1".*"methodCount":87,"methodsHash":"ca139a3e62a55e68"/);
  }
  return summary;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === 'setup') await setup(args[0]!);
    else if (command === 'matrix') await matrix(args[0]!, args[1]!, args[2]!);
    else if (command === 'collapsed-rows') await collapsedRows(args[0]!, args[1]!);
    else if (command === 'anchor') await anchor(args[0]!);
    else if (command === 'cleanup') await cleanup(args[0]!, args[1]!);
    else if (command === 'verify-offline') console.log(JSON.stringify(await verifyOffline(args[0]!), null, 1));
    else throw new Error(`unknown command ${command}`);
  } finally { await transport.close(); }
}
if (import.meta.url === pathToFileURL(process.argv[1]!).href) await main();
