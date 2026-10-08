/** 8h3c acceptance. Use an owned unsaved project. Refuse the saved anchor. */
import assert from 'node:assert/strict';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeError } from '../client.js';
import type { Transport } from '../adapters/live/transport.js';
import type { Frame } from '../adapters/live/wiremap.js';
import { decodeNoteFrame, notesByChannel, type NoteFrame, type RawNoteFields } from '../adapters/live/clip-read.js';
import { AddressUnresolvedError, addressKey, clip, notes, scene, slot, track, noteReadStart, type NoteRecord } from '../contract/index.js';
import { readFineClipNotes, reconcileExactNoteScans, type E131Context } from './e131-diagnostic.js';
import { decodeVerboseNote } from '../adapters/live/encoder.js';
import { Executor } from '../engine/executor.js';

/** 8h3c2: the target row of the paired, selection, and queue cases. The fifth CLI argument sets it. */
let ROW = 0;
/** The `clip-reader-v1` page size of the E230 runs. The evidence verifiers decode at this limit. */
const RECORDED_PAGE = 131_072;

type Wire = Record<string, any>;
export interface Call { method: string; params?: Wire; sent: number; received: number; bytes: number; reply: Wire; wire: string }

/** Record full response bytes, including JSON-RPC framing and queuedMs. */
export class WireTransport implements Transport {
  private socket?: net.Socket;
  private buffer = '';
  private serial = 0;
  private pending = new Map<string, { resolve(value: unknown): void; reject(error: Error): void;
    timer: ReturnType<typeof setTimeout>; call: Call }>();
  readonly calls: Call[] = [];
  private async connect(): Promise<void> {
    if (this.socket) return;
    this.socket = net.createConnection({ port: 8686, host: '127.0.0.1' });
    this.socket.setEncoding('utf8');
    this.socket.on('data', (data: string) => {
      this.buffer += data;
      for (;;) {
        const end = this.buffer.indexOf('\n');
        if (end < 0) break;
        const line = this.buffer.slice(0, end); this.buffer = this.buffer.slice(end + 1);
        const reply = JSON.parse(line) as Wire;
        const pending = this.pending.get(String(reply.id));
        if (!pending) continue;
        clearTimeout(pending.timer); this.pending.delete(String(reply.id));
        pending.call.received = performance.now(); pending.call.bytes = Buffer.byteLength(line + '\n');
        pending.call.reply = reply; pending.call.wire = line;
        // 8i3: the product transport throws BridgeError with the reply code; the adapter classifies some codes.
        if (reply.error) pending.reject(new BridgeError(Number(reply.error.code), String(reply.error.message)));
        else pending.resolve(reply.result);
      }
    });
    this.socket.on('error', (error) => { for (const pending of this.pending.values()) pending.reject(error); });
    await new Promise<void>((resolve, reject) => { this.socket!.once('connect', resolve); this.socket!.once('error', reject); });
  }
  async send(frame: Frame): Promise<unknown> {
    return this.sendRecorded(frame);
  }
  async sendRecorded(frame: Frame, owned?: Call[]): Promise<unknown> {
    await this.connect();
    const id = String(++this.serial);
    const call: Call = { method: frame.method, ...(frame.params ? { params: frame.params } : {}),
      sent: performance.now(), received: -1, bytes: 0, reply: {}, wire: '' };
    this.calls.push(call);
    owned?.push(call);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`timeout: ${frame.method}`)); }, frame.timeoutMs ?? 60_000);
      this.pending.set(id, { resolve, reject, timer, call });
      this.socket!.write(JSON.stringify({ jsonrpc: '2.0', id, method: frame.method, params: frame.params }) + '\n');
    });
  }
  async close(): Promise<void> { this.socket?.destroy(); this.socket = undefined; }
}
const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const request = async (method: string, params?: Wire, owned?: Call[]): Promise<Wire> =>
  await transport.sendRecorded({ method, ...(params ? { params } : {}) }, owned) as Wire;
const rawByCell = (rows: readonly RawNoteFields[]): readonly RawNoteFields[] => [...rows].sort((a, b) =>
  Number(a.channel) - Number(b.channel) || Number(a.cell) - Number(b.cell) || Number(a.pitch) - Number(b.pitch));
const midiVelocity = (rows: readonly RawNoteFields[]): number =>
  Math.round(Number(rows.find(row => row.channel === 0 && row.cell === 0 && row.pitch === 48)!.velocity) * 127);
const pause = async (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const load = async (path: string): Promise<Wire> => JSON.parse(await readFile(path, 'utf8'));
const save = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 1) + '\n');
};
const artifact = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, gzipSync(JSON.stringify(value) + '\n'));
};
async function guard(research = false): Promise<Wire> {
  const hello = await request('contract.hello');
  assert.equal(hello.runtimeProfile, research ? 'phase-8-probe-v1' : 'normal-v1');
  assert.equal(hello.methodCount, research ? 98 : 87);
  assert.equal(hello.methodsHash, research ? '659635435255b259' : 'ca139a3e62a55e68');
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project), `use an owned unsaved project, got ${mark.project}`);
  const rig = await request('rig.info');
  assert.equal(rig.clipReader?.revision, 'clip-reader-v1');
  assert.equal(rig.clipReader?.closeRule, 'confirm-before-release-v1');
  assert.equal(rig.clipReader?.width, 4_194_304); assert.equal(rig.clipReader?.grid, 1 / 512);
  assert.equal(rig.clipReader?.page, RECORDED_PAGE);
  await adapter.hello();
  return { hello, mark, rig, stats: await request('rig.stats') };
}
async function indexOf(id: string, owned?: Call[]): Promise<number> {
  const list = await request('track.list', undefined, owned);
  const found = list.tracks.find((row: Wire) => row.channelId === id);
  assert(found, `owned track ${id} is absent`); return found.index;
}
function address(id: string, row = 0) { return clip(slot(track(id), scene(row, 0))); }
async function clipAddress(id: string, row = ROW) {
  const mark = await request('revision.get');
  return clip(slot(track(id), scene(row, mark.sceneEpoch)));
}
async function bind(id: string, row = ROW, cursor = 'fine'): Promise<void> {
  const target = await clipAddress(id, row);
  const context = adapter as unknown as E131Context;
  await context.pointAtClip(target, await indexOf(id), new Map(), cursor);
}
async function capture(id: string, row = ROW, deadlineMs?: number, diagnosticFault?: string): Promise<Wire> {
  const before = await request('selection.status');
  const calls: Call[] = [], started = performance.now();
  const result = await request('clip.read', { trackIndex: await indexOf(id, calls), row, channelId: id,
    ...(deadlineMs === undefined ? {} : { deadlineMs }),
    ...(diagnosticFault === undefined ? {} : { diagnosticFault }) }, calls);
  const rows: RawNoteFields[] = [];
  if (!result.refused) {
    let frame = result.frame as NoteFrame;
    for (;;) {
      rows.push(...decodeNoteFrame(frame, RECORDED_PAGE));
      if (frame.next < 0) break;
      frame = await request('clip.readPage', { readId: result.readId, from: frame.next }, calls) as NoteFrame;
    }
  }
  const wallMs = performance.now() - started;
  const after = await request('selection.status');
  return { result, rows, before, after, wallMs, bytes: calls.reduce((sum, call) => sum + call.bytes, 0), calls };
}
async function setup(path: string): Promise<Wire> {
  const entry = await guard();
  const before = await request('track.list');
  await request('track.create', { position: 0 }); await pause(500);
  const after = await request('track.list');
  const added = after.tracks.filter((row: Wire) => !before.tracks.some((old: Wire) => old.channelId === row.channelId));
  assert.equal(added.length, 1);
  const state = { schema: 'phase8h3c-state-v1', entry, trackId: added[0].channelId,
    entryTracks: before.tracks, entrySelection: await request('selection.status') };
  await save(path, state);
  await request('track.setName', { trackIndex: added[0].index, name: 'gn-8h3c-owned' });
  await request('clip.create', { trackIndex: added[0].index, slotIndex: 0, lengthBeats: 4 });
  await pause(500); return state;
}
async function smoke(out: string, statePath: string): Promise<void> {
  const state = await setup(statePath);
  const reports: Wire[] = [];
  try {
    await bind(state.trackId);
    await request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 / 4 });
    await request('cursor.setNotes', { cursor: 'fine', channel: 15, notes: [[4, 127, 100, 0.25]] });
    await pause(250);
    for (let i = 0; i < 3; i += 1) {
      const report = await capture(state.trackId); reports.push(report);
      await artifact(out, { schema: 'phase8h3c-smoke-v1', state, reports, calls: transport.calls });
      assert.equal(report.result.refused, undefined, `MASTER PARK FAILED: ${JSON.stringify(report.result)}`);
      assert.equal(report.rows.length, 1); assert.equal(report.rows[0].cell, 512);
      assert.equal(report.rows[0].channel, 15); assert.equal(report.rows[0].pitch, 127);
      assert(report.result.parkMs >= 0);
      assert.equal(report.result.closeRule, 'confirm-before-release-v1');
      assert.equal(report.result.afterClose, 0);
      assert.equal(report.result.releaseOn, 0);
      assert.equal(report.result.releaseSustain, 0);
      assert.equal(report.result.releaseCallbacks, report.result.releaseEmpty);
      assert.deepEqual([report.after.trackIndex, report.after.slotIndex, report.after.mixerTrackIndex],
        [report.before.trackIndex, report.before.slotIndex, report.before.mixerTrackIndex]);
    }
    console.log(JSON.stringify({ smoke: 'pass', reports: reports.map((report) => ({ wallMs: report.wallMs,
      parkMs: report.result.parkMs, parkPolls: report.result.parkPolls, selection: report.result.selection })) }));
  } finally { await artifact(out, { schema: 'phase8h3c-smoke-v1', state, reports, calls: transport.calls }); }
}
function normalized(note: NoteRecord): NoteRecord {
  return { ...note, startBeats: noteReadStart(note.startBeats), releaseVelocity: note.releaseVelocity ?? 0,
    isChanceEnabled: note.isChanceEnabled ?? false, isOccurrenceEnabled: note.isOccurrenceEnabled ?? false,
    isRecurrenceEnabled: note.isRecurrenceEnabled ?? false, isRepeatEnabled: note.isRepeatEnabled ?? false };
}
/**
 * 8h3c2: for a target row other than 0, put a distinct clip in row 0: 3 beats, one note at pitch 100 on
 * channel 9. A bind of row 0 then fails every content check of the case.
 */
async function decoy(id: string): Promise<void> {
  if (ROW === 0) return;
  const idx = await indexOf(id), row = ROW;
  await request('slot.delete', { trackIndex: idx, slotIndex: 0 }); await pause(200);
  await request('clip.create', { trackIndex: idx, slotIndex: 0, lengthBeats: 3 }); await pause(300);
  ROW = 0;
  try {
    await bind(id); await request('cursor.setStepSize', { cursor: 'fine', stepSize: 0.25 });
    await request('cursor.setNotes', { cursor: 'fine', channel: 9, notes: [[1, 100, 100, 0.25]] });
  } finally { ROW = row; }
  await pause(250);
}
async function paired(out: string, statePath: string): Promise<void> {
  await guard(); const state = await load(statePath); const reports: Wire[] = [];
  await decoy(state.trackId);
  for (const bars of [1, 4, 16, 64]) for (const density of ['sparse', 'dense']) {
    const beats = bars * 4, spacing = density === 'sparse' ? 4 : 0.25;
    const idx = await indexOf(state.trackId);
    await request('slot.delete', { trackIndex: idx, slotIndex: ROW }); await pause(200);
    await request('clip.create', { trackIndex: idx, slotIndex: ROW, lengthBeats: beats }); await pause(300);
    await bind(state.trackId); await request('cursor.setStepSize', { cursor: 'fine', stepSize: 0.25 });
    for (let channel = 0; channel < 16; channel += 1) {
      await request('cursor.setNotes', { cursor: 'fine', channel,
        notes: Array.from({ length: beats / spacing }, (_, i) => [i * spacing * 4, 48 + channel, 100, 0.25]) });
    }
    await pause(300);
    const cold = await capture(state.trackId);
    assert.equal(cold.result.refused, undefined);
    const clipRef = await clipAddress(state.trackId);
    const diagnostic = adapter as unknown as E131Context;
    const rig = await request('rig.info');
    const context: E131Context = { steps: rig.noteReadSteps, transport,
      pointAtClip: diagnostic.pointAtClip.bind(adapter), readClipMetadata: diagnostic.readClipMetadata.bind(adapter),
      settle: adapter.settle.bind(adapter), timed: async (_phase, run) => run() };
    const before = await request('selection.status'), start = performance.now(), callStart = transport.calls.length;
    const control = await readFineClipNotes(context, clipRef, idx, new Map());
    const controlMs = performance.now() - start;
    const calls = transport.calls.slice(callStart), after = await request('selection.status');
    const coldNotes = notesByChannel(cold.rows);
    for (let channel = 0; channel < 16; channel += 1) {
      assert.deepEqual(coldNotes.get(channel), (control.get(channel) ?? []).map(normalized));
      assert.equal(coldNotes.get(channel)?.length, beats / spacing);
    }
    reports.push({ bars, density, cold, control: [...control], controlMs,
      controlBytes: calls.reduce((sum, call) => sum + call.bytes, 0), before, after, calls });
    await artifact(out, { schema: 'phase8h3c-paired-v1', row: ROW, state, reports });
    console.log(JSON.stringify({ bars, density, coldMs: cold.wallMs, controlMs, notes: cold.rows.length }));
  }
}
async function cleanup(out: string, statePath: string, research = false): Promise<void> {
  await guard(research); const state = await load(statePath);
  const idx = await indexOf(state.trackId);
  await request('track.delete', { trackIndex: idx }); await pause(500);
  const after = await request('track.list');
  assert(!after.tracks.some((row: Wire) => row.channelId === state.trackId));
  assert.deepEqual(after.tracks.map((row: Wire) => row.channelId), state.entryTracks.map((row: Wire) => row.channelId));
  await save(out, { schema: 'phase8h3c-cleanup-v1', after, state, stats: await request('rig.stats'), calls: transport.calls });
}
/** Read the saved anchor after owned-project closure. Send no writes. */
async function baseline(out: string): Promise<void> {
  const hello = await request('contract.hello'), mark = await request('revision.get');
  assert.equal(hello.runtimeProfile, 'normal-v1'); assert.equal(hello.methodCount, 87);
  assert.equal(hello.methodsHash, 'ca139a3e62a55e68'); assert.equal(mark.project, 'gn-scale-test');
  await save(out, { schema: 'phase8h3c-baseline-v1', hello, mark,
    tracks: await request('track.list'), rig: await request('rig.info'),
    stats: await request('rig.stats'), calls: transport.calls });
}
async function reset(id: string, beats = 4): Promise<void> {
  const idx = await indexOf(id);
  await request('slot.delete', { trackIndex: idx, slotIndex: ROW }); await pause(200);
  await request('clip.create', { trackIndex: idx, slotIndex: ROW, lengthBeats: beats }); await pause(300);
  await bind(id); await request('cursor.setStepSize', { cursor: 'fine', stepSize: 0.25 });
  await request('cursor.setNotes', { cursor: 'fine', channel: 0, notes: [[0, 48, 100, 0.25]] });
  await pause(250);
}
async function refusals(out: string, statePath: string): Promise<void> {
  await guard(); const state = await load(statePath);
  await reset(state.trackId, 8193);
  const width = await capture(state.trackId);
  assert.equal(width.result.refused, 'clip-beyond-reader-width');
  await reset(state.trackId);
  const deadline = await capture(state.trackId, 0, 1);
  assert.equal(deadline.result.refused, 'deadline');
  const recovered = await capture(state.trackId);
  assert.equal(recovered.result.refused, undefined);
  const start = transport.calls.length, coldAdapter = new LiveAdapter({ transport });
  let absentMessage = '';
  try { await coldAdapter.read([notes(await clipAddress(state.trackId), 0)]); }
  catch (error) { assert(error instanceof AddressUnresolvedError); absentMessage = error.message; }
  assert.match(absentMessage, /configuration is absent/);
  const absentCalls = transport.calls.slice(start);
  assert(!absentCalls.some(call => call.method === 'clip.read'));
  await artifact(out, { schema: 'phase8h3c-refusals-v1', width, deadline, recovered,
    absent: { message: absentMessage, calls: absentCalls }, calls: transport.calls });
}
async function selectionCases(out: string, statePath: string): Promise<void> {
  await guard(); const state = await load(statePath), reports: Wire[] = [];
  await decoy(state.trackId);
  await reset(state.trackId);
  const other = state.entryTracks.find((row: Wire) => row.type === 'Instrument'); assert(other);
  try {
    // Each entry selection differs from the target slot. For target row 1, the owned-track entry is row 0.
    for (const [id, row] of [[other.channelId, 1], [state.trackId, ROW === 1 ? 0 : 1], [other.channelId, 0]]) {
      const index = await indexOf(id as string);
      await request('slot.select', { trackIndex: index, slotIndex: row }); await pause(250);
      const read = await capture(state.trackId); reports.push({ id, row, read });
      assert.equal(read.result.refused, undefined); assert.equal(read.result.selection.changed, true);
      assert.deepEqual([read.after.trackIndex, read.after.slotIndex, read.after.mixerTrackIndex],
        [index, row, read.before.mixerTrackIndex]);
      assert.equal(read.rows.length, 1); assert.equal(read.rows[0].cell, 0); assert.equal(read.rows[0].pitch, 48);
    }
  } finally { await artifact(out, { schema: 'phase8h3c-selection-v1', row: ROW, state, reports, calls: transport.calls }); }
}
/** Inject capture events only. These cases do not claim a natural host fault. */
async function faults(out: string, statePath: string): Promise<void> {
  await guard(true); const state = await load(statePath), reports: Wire[] = [];
  await reset(state.trackId);
  for (const diagnosticFault of ['duplicate-cell', 'step-delta']) {
    const read = await capture(state.trackId, 0, undefined, diagnosticFault);
    reports.push({ diagnosticFault, read });
    await artifact(out, { schema: 'phase8h3c-synthetic-faults-v1', state, reports, calls: transport.calls });
    assert.equal(read.result.refused, diagnosticFault);
    assert.equal(read.result.diagnosticFault, diagnosticFault);
    const recovered = await capture(state.trackId);
    assert.equal(recovered.result.refused, undefined);
    reports.at(-1)!.recovered = recovered;
  }
  await artifact(out, { schema: 'phase8h3c-synthetic-faults-v1', state, reports, calls: transport.calls });
}
async function queueCases(out: string, statePath: string): Promise<void> {
  await guard(); const state = await load(statePath); const cases: Wire[] = [];
  try {
  await decoy(state.trackId);
  await reset(state.trackId, 256);
  // A large all-channel capture gives the second client a measured open window.
  for (let channel = 0; channel < 16; channel += 1) await request('cursor.setNotes', {
    cursor: 'fine', channel, notes: Array.from({ length: 1024 }, (_, i) => [i, 48 + channel, 100, 0.25]),
  });
  await pause(250);
  const edit = (velocity: number) => ({ method: 'cursor.setNoteProps', params: {
    cursor: 'fine', channel: 0, x: 0, y: 48, props: { velocity: velocity / 127 } } });
  async function openRead(): Promise<{ reading: Promise<Wire>; stats: Wire }> {
    const reading = capture(state.trackId);
    for (let i = 0; i < 30; i += 1) {
      const stats = await request('rig.stats');
      if (stats.clipReader.writeGate.readOpen) return { reading, stats };
    }
    await reading; throw new Error('read closed before the write case could enter the gate');
  }
  {
    const preWrite = await capture(state.trackId);
    assert.equal(preWrite.result.refused, undefined);
    const { reading, stats } = await openRead(), start = transport.calls.length;
    await transport.send(edit(64));
    const write = transport.calls.slice(start).find((call) => call.method === 'cursor.setNoteProps')!;
    const read = await reading;
    assert(write.reply.queuedMs > 0); assert.equal(read.result.refused, undefined);
    assert.equal(midiVelocity(read.rows), 100);
    const after = await capture(state.trackId);
    assert.equal(midiVelocity(after.rows), 64);
    assert.deepEqual(rawByCell(read.rows), rawByCell(preWrite.rows));
    cases.push({ name: 'in-replay-edit', preWrite, stats, write, read, after });
  }
  {
    await transport.send(edit(80));
    const read = await capture(state.trackId);
    assert.equal(read.result.refused, undefined);
    assert.equal(midiVelocity(read.rows), 80);
    cases.push({ name: 'earlier-write', read });
  }
  {
    const scheduled = await request('batch.run', { ops: [edit(64), edit(100)], delayMs: 150 });
    const read = await capture(state.trackId);
    assert.equal(read.result.refused, undefined);
    assert.equal(midiVelocity(read.rows), 100);
    const call = read.calls.find((call: Call) => call.method === 'clip.read');
    assert(call.reply.queuedMs > 0);
    cases.push({ name: 'delayed-batch', scheduled, read });
  }
  {
    const idx = await indexOf(state.trackId), start = transport.calls.length;
    const pendingRead = request('clip.read', { trackIndex: idx, row: ROW, channelId: state.trackId, deadlineMs: 1 });
    const pendingWrite = transport.send(edit(90));
    const [result] = await Promise.all([pendingRead, pendingWrite]);
    const calls = transport.calls.slice(start), write = calls.find(call => call.method === 'cursor.setNoteProps')!;
    assert.equal(result.refused, 'deadline'); assert(write.reply.queuedMs > 0);
    const after = await capture(state.trackId);
    assert.equal(after.result.refused, undefined);
    assert.equal(midiVelocity(after.rows), 90);
    cases.push({ name: 'deadline-releases-write', result, write, calls, after });
  }
  {
    const { reading, stats } = await openRead(), idx = await indexOf(state.trackId), start = transport.calls.length;
    const promises = Array.from({ length: 280 }, (_, i) => request('track.setName', {
      trackIndex: idx, name: `gn-8h3c-queue-${i}` }).then(() => ({ ok: true }), (error: Error) => ({ error: error.message })));
    const results = await Promise.all(promises), read = await reading, calls = transport.calls.slice(start);
    assert.equal(read.result.refused, undefined);
    assert(results.some((result) => 'error' in result && /queue is full/.test(result.error!)));
    const admitted = calls.filter((call) => call.method === 'track.setName' && !call.reply.error);
    assert(admitted.length <= 256); assert(admitted.every((call) => call.reply.queuedMs > 0));
    await pause(250);
    const names = await request('track.list');
    assert.equal(names.tracks.find((row: Wire) => row.channelId === state.trackId).name, admitted.at(-1)!.params!.name);
    cases.push({ name: 'full-queue-and-unclassified-write', stats, read, results, calls, names });
    await request('track.setName', { trackIndex: idx, name: 'gn-8h3c-owned' });
  }
  } finally { await artifact(out, { schema: 'phase8h3c-queue-v1', row: ROW, state, cases, calls: transport.calls }); }
}
async function disabled(out: string, statePath: string): Promise<void> {
  await guard(); const state = await load(statePath); await reset(state.trackId);
  await request('cursor.setNotes', { cursor: 'fine', channel: 3, notes: [[4, 62, 64, 0.75]] });
  await pause(250);
  await request('cursor.setNoteProps', { cursor: 'fine', channel: 3, x: 4, y: 62, props: {
    chance: 0.3, isChanceEnabled: false, occurrence: 'PREV', isOccurrenceEnabled: false,
    recurrence: [8, 85], isRecurrenceEnabled: false, repeatCount: -2, repeatCurve: 0.5,
    repeatVelocityCurve: -0.5, repeatVelocityEnd: 0.75, isRepeatEnabled: false, releaseVelocity: 0.5,
  } });
  await pause(250); await bind(state.trackId);
  const rawBefore = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 16 });
  const coldBefore = await capture(state.trackId);
  assert.equal(coldBefore.result.refused, undefined);
  const disabledNote = coldBefore.rows.find((row: Wire) => row.channel === 3);
  for (const flag of ['isChanceEnabled', 'isOccurrenceEnabled', 'isRecurrenceEnabled', 'isRepeatEnabled']) {
    assert.equal(disabledNote[flag], false);
  }
  assert.equal(disabledNote.recurrenceLength, 8); assert.equal(disabledNote.recurrenceMask, 85);
  const target = await clipAddress(state.trackId), channels = notesByChannel(coldBefore.rows);
  const executor = new Executor(adapter);
  const ops = [{ op: 'note.clear' as const, clip: target }, ...[...channels].filter(([, values]) => values.length > 0)
    .map(([channel, values]) => ({ op: 'note.write' as const, clip: target, channel,
      notes: channel === 0 ? values.map((note) => ({ ...note, pitch: note.pitch + 12 })) : values }))];
  const take = await executor.run(ops);
  await bind(state.trackId);
  await request('cursor.setStepSize', { cursor: 'fine', stepSize: 0.25 }); await pause(250);
  await bind(state.trackId);
  const rawAfter = await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 16 });
  const before = rawBefore.channels[3].notes, after = rawAfter.channels[3].notes;
  await artifact(out, { schema: 'phase8h3c-disabled-v1', rawBefore, coldBefore, take, rawAfter, calls: transport.calls });
  assert.deepEqual(after, before, 'disabled raw controls changed on the unmentioned channel');
  assert.equal(rawAfter.channels[0].notes[0].y, 60);
  assert.equal(take.report.applied, true); assert.deepEqual(take.report.disagreements, []);
  // Restore the normalized mixed-lattice onset and retain its D9 duration.
  const triplet = { startBeats: 1 / 6, pitch: 72, velocity: 100, durationBeats: 1 / 3 };
  const inserted = await executor.run([{ op: 'note.insert', clip: target, channel: 7, notes: [triplet] }]);
  assert.deepEqual(inserted.report.disagreements, []);
  const restored = await executor.run([{ op: 'note.clear', clip: target }, { op: 'note.write', clip: target,
    channel: 7, notes: [{ ...triplet, startBeats: noteReadStart(triplet.startBeats) }] }]);
  assert.deepEqual(restored.report.disagreements, []);
  const mixed = await capture(state.trackId);
  assert.equal(mixed.rows[0].cell, 85);
  await artifact(out, { schema: 'phase8h3c-disabled-v1', rawBefore, coldBefore, take, rawAfter,
    inserted, restored, mixed, calls: transport.calls });
}
function verifyCalls(calls: Call[]): void {
  for (const call of calls) {
    assert.equal(call.bytes, Buffer.byteLength(call.wire + '\n'));
    assert.deepEqual(call.reply, JSON.parse(call.wire));
    assert(call.received >= call.sent);
  }
}
function verifyCapture(report: Wire): RawNoteFields[] {
  verifyCalls(report.calls);
  const initial = report.calls.find((call: Call) => call.method === 'clip.read');
  assert(initial && !initial.reply.error);
  assert.deepEqual(report.result, initial.reply.result);
  assert.equal(report.bytes, report.calls.reduce((sum: number, call: Call) => sum + call.bytes, 0));
  assert(report.wallMs >= initial.received - initial.sent);
  if (report.result.refused) {
    assert.equal(report.result.frame, undefined);
    assert.deepEqual(report.rows, []);
    return [];
  }
  const rows: RawNoteFields[] = [], frames = [report.result.frame,
    ...report.calls.filter((call: Call) => call.method === 'clip.readPage').map((call: Call) => {
      assert.equal(call.params?.readId, report.result.readId);
      assert.equal(call.reply.result.readId, report.result.readId);
      assert.equal(call.params?.from, call.reply.result.from);
      return call.reply.result;
    })];
  for (const frame of frames) {
    assert.equal(frame.from, rows.length);
    assert.equal(frame.count, report.result.frame.count);
    const decoded = decodeNoteFrame(frame, RECORDED_PAGE); rows.push(...decoded);
    assert.equal(frame.next, rows.length < frame.count ? rows.length : -1);
  }
  assert.equal(rows.length, report.result.frame.count);
  assert.deepEqual(report.rows, rows);
  // 8h3c2: the capture is of the requested track and row.
  assert.equal(report.result.bound.channelId, initial.params.channelId);
  assert.equal(report.result.bound.row, initial.params.row);
  assert.equal(new Set(rows.map(row => `${row.channel}:${row.pitch}:${row.cell}`)).size, rows.length);
  assert.equal(report.result.closeRule, 'confirm-before-release-v1');
  assert.equal(report.result.afterClose, 0); assert.equal(report.result.duplicates, 0);
  assert.equal(report.result.releaseOn, 0); assert.equal(report.result.releaseSustain, 0);
  assert.equal(report.result.releaseCallbacks, report.result.releaseEmpty);
  assert(report.result.parkMs >= 0);
  assert.equal(report.result.selection.restored, true);
  assert.deepEqual([report.after.trackIndex, report.after.slotIndex, report.after.mixerTrackIndex],
    [report.before.trackIndex, report.before.slotIndex, report.before.mixerTrackIndex]);
  return rows;
}
/** 8h3c2: every clip read of an artifact requests its recorded row. Earlier artifacts have row 0. */
function verifyRow(data: Wire, calls: Call[]): void {
  const reads = calls.filter(call => call.method === 'clip.read');
  assert(reads.length > 0);
  for (const call of reads) assert.equal(call.params?.row, data.row ?? 0);
}
/** Recompute the E131 control from its saved raw scan replies. */
function replayControl(calls: Call[], id: string): Map<number, readonly NoteRecord[]> {
  verifyCalls(calls);
  const grids = new Map<number, Map<number, NoteRecord[]>>();
  let grid = 0, pageStart = 0;
  for (const call of calls) {
    if (call.method === 'cursor.setStepSize') grid = call.params!.stepSize;
    if (call.method === 'cursor.scrollToStep') pageStart = call.params!.step;
    if (call.method !== 'cursor.getNotesVerboseAllChannels') continue;
    assert(grid === 1 / 512 || grid === 1 / 768);
    const channels = grids.get(grid) ?? new Map<number, NoteRecord[]>(); grids.set(grid, channels);
    const result = call.reply.result;
    assert.equal(result.channels.length, 16);
    assert.equal(new Set(result.channels.map((channel: Wire) => channel.channel)).size, 16);
    let count = 0;
    for (const channel of result.channels) {
      assert.equal(channel.count, channel.notes.length); count += channel.count;
      const values = channels.get(channel.channel) ?? []; channels.set(channel.channel, values);
      values.push(...channel.notes.map((note: Wire) => {
        assert(note.x >= 0 && note.x < call.params!.maxX);
        return decodeVerboseNote({ ...note, x: note.x + pageStart }, grid);
      }));
    }
    assert.equal(result.count, count); assert.notEqual(result.clipExists, false);
  }
  assert.equal(grids.size, 2);
  const result = new Map<number, readonly NoteRecord[]>();
  for (let channel = 0; channel < 16; channel++) result.set(channel, reconcileExactNoteScans(address(id), channel,
    grids.get(1 / 512)!.get(channel) ?? [], grids.get(1 / 768)!.get(channel) ?? [], 1 / 512));
  return result;
}
export async function verifyPaired(path: string): Promise<void> {
  const data = JSON.parse(gunzipSync(await readFile(path)).toString('utf8')) as Wire;
  assert.equal(data.schema, 'phase8h3c-paired-v1'); assert.equal(data.reports.length, 8);
  verifyRow(data, data.reports.flatMap((report: Wire) => report.cold.calls));
  const cases = new Set<string>();
  for (const report of data.reports) {
    assert([1, 4, 16, 64].includes(report.bars)); assert(['sparse', 'dense'].includes(report.density));
    cases.add(`${report.bars}:${report.density}`);
    const rows = verifyCapture(report.cold), cold = notesByChannel(rows);
    const spacing = report.density === 'sparse' ? 4 : 0.25, expected = report.bars * 4 / spacing;
    assert.equal(rows.length, expected * 16);
    const control = replayControl(report.calls, data.state.trackId);
    assert.deepEqual(report.control, [...control]);
    assert.equal(report.controlBytes, report.calls.reduce((sum: number, call: Call) => sum + call.bytes, 0));
    assert(report.controlMs > 0);
    for (let channel = 0; channel < 16; channel++) {
      const values = cold.get(channel)!; assert.equal(values.length, expected);
      assert.deepEqual(values, control.get(channel)!.map(normalized));
      for (const [i, note] of values.entries()) {
        assert.equal(note.startBeats, i * spacing); assert.equal(note.pitch, 48 + channel);
        assert.equal(note.velocity, 100); assert.equal(note.durationBeats, 0.25);
      }
    }
  }
  assert.equal(cases.size, 8);
}
export async function verifyRefusals(path: string): Promise<void> {
  const data = JSON.parse(gunzipSync(await readFile(path)).toString('utf8')) as Wire;
  assert.equal(data.schema, 'phase8h3c-refusals-v1'); verifyCalls(data.calls);
  verifyCapture(data.width); verifyCapture(data.deadline); verifyCapture(data.recovered);
  assert.equal(data.width.result.refused, 'clip-beyond-reader-width');
  assert(data.width.result.bound.loopEndBeats > 8192);
  assert.equal(data.deadline.result.refused, 'deadline');
  assert.equal(data.deadline.calls.find((call: Call) => call.method === 'clip.read').params.deadlineMs, 1);
  assert.equal(data.recovered.result.refused, undefined);
  assert.match(data.absent.message, /configuration is absent/);
  verifyCalls(data.absent.calls); assert(!data.absent.calls.some((call: Call) => call.method === 'clip.read'));
}
export async function verifySelection(path: string): Promise<void> {
  const data = JSON.parse(gunzipSync(await readFile(path)).toString('utf8')) as Wire;
  assert.equal(data.schema, 'phase8h3c-selection-v1'); verifyCalls(data.calls); verifyRow(data, data.calls);
  assert.equal(data.reports.length, 3);
  for (const report of data.reports) {
    const rows = verifyCapture(report.read);
    assert.equal(rows.length, 1); assert.equal(rows[0]!.cell, 0); assert.equal(rows[0]!.pitch, 48);
    assert.equal(report.read.before.slotIndex, report.row);
    assert.equal(report.read.result.selection.changed, true);
    const tracks = report.read.calls.find((call: Call) => call.method === 'track.list').reply.result.tracks;
    const entry = tracks.find((row: Wire) => row.channelId === report.id);
    assert.equal(report.read.before.trackIndex, entry.index);
  }
}
export async function verifyFaults(path: string): Promise<void> {
  const data = JSON.parse(gunzipSync(await readFile(path)).toString('utf8')) as Wire;
  assert.equal(data.schema, 'phase8h3c-synthetic-faults-v1'); verifyCalls(data.calls);
  assert.equal(data.calls[0].reply.result.runtimeProfile, 'phase-8-probe-v1');
  assert.equal(data.reports.length, 2);
  for (const [i, fault] of ['duplicate-cell', 'step-delta'].entries()) {
    const report = data.reports[i]; verifyCapture(report.read); verifyCapture(report.recovered);
    assert.equal(report.diagnosticFault, fault); assert.equal(report.read.result.refused, fault);
    assert.equal(report.read.result.diagnosticFault, fault);
    assert.equal(report.read.calls.find((call: Call) => call.method === 'clip.read').params.diagnosticFault, fault);
    assert(report.read.result[fault === 'duplicate-cell' ? 'duplicates' : 'afterClose'] > 0);
    assert.equal(report.recovered.result.refused, undefined);
  }
}
export async function verifyQueue(path: string): Promise<void> {
  const data = JSON.parse(gunzipSync(await readFile(path)).toString('utf8')) as Wire;
  assert.equal(data.schema, 'phase8h3c-queue-v1'); verifyCalls(data.calls); verifyRow(data, data.calls);
  assert.equal(data.cases.length, 5);
  const named = new Map<string, Wire>(data.cases.map((entry: Wire) => [entry.name, entry]));
  const velocity = (report: Wire): number => {
    const rows = verifyCapture(report);
    return midiVelocity(rows);
  };
  const edit = named.get('in-replay-edit')!;
  assert(edit.stats.clipReader.writeGate.readOpen); verifyCalls([edit.write]);
  assert(edit.write.reply.queuedMs > 0);
  assert.equal(velocity(edit.read), 100); assert.equal(velocity(edit.after), 64);
  assert.deepEqual(rawByCell(verifyCapture(edit.read)), rawByCell(verifyCapture(edit.preWrite)));
  assert.equal(velocity(named.get('earlier-write')!.read), 80);
  const delayed = named.get('delayed-batch')!;
  assert.equal(velocity(delayed.read), 100);
  assert(delayed.read.calls.find((call: Call) => call.method === 'clip.read').reply.queuedMs > 0);
  const deadline = named.get('deadline-releases-write')!; verifyCalls(deadline.calls);
  assert.deepEqual(deadline.result, deadline.calls.find((call: Call) => call.method === 'clip.read').reply.result);
  assert.equal(deadline.result.refused, 'deadline'); assert(deadline.write.reply.queuedMs > 0);
  assert.equal(velocity(deadline.after), 90);
  const full = named.get('full-queue-and-unclassified-write')!;
  verifyCapture(full.read); verifyCalls(full.calls);
  assert(full.stats.clipReader.writeGate.readOpen);
  const writes = full.calls.filter((call: Call) => call.method === 'track.setName');
  assert.equal(writes.length, 280);
  const admitted = writes.filter((call: Call) => !call.reply.error);
  assert(admitted.length <= 256 && admitted.length > 0);
  assert(admitted.every((call: Call) => call.reply.queuedMs > 0));
  const refused = writes.filter((call: Call) => call.reply.error);
  assert(refused.length > 0 && refused.every((call: Call) => /queue is full/.test(call.reply.error.message)));
  assert.deepEqual(full.results, writes.map((call: Call) => call.reply.error
    ? { error: call.reply.error.message } : { ok: true }));
  const finalName = full.names.tracks.find((row: Wire) => row.channelId === data.state.trackId).name;
  assert.equal(finalName, admitted.at(-1).params.name);
}
export async function verifyDisabled(path: string): Promise<void> {
  const data = JSON.parse(gunzipSync(await readFile(path)).toString('utf8')) as Wire;
  assert.equal(data.schema, 'phase8h3c-disabled-v1'); verifyCalls(data.calls);
  const scans = data.calls.filter((call: Call) => call.method === 'cursor.getNotesVerboseAllChannels');
  assert.equal(scans.length, 2);
  assert.deepEqual(data.rawBefore, scans[0].reply.result); assert.deepEqual(data.rawAfter, scans[1].reply.result);
  const before = data.rawBefore.channels[3].notes, after = data.rawAfter.channels[3].notes;
  assert.equal(before.length, 1); assert.deepEqual(after, before);
  for (const flag of ['isChanceEnabled', 'isOccurrenceEnabled', 'isRecurrenceEnabled', 'isRepeatEnabled']) {
    assert.equal(before[0][flag], false);
  }
  assert.equal(before[0].recurrenceLength, 8); assert.equal(before[0].recurrenceMask, 85);
  assert.equal(before[0].chance, 0.3); assert.equal(before[0].occurrence, 'PREV');
  assert.equal(before[0].repeatCount, -2);
  assert.equal(data.rawAfter.channels[0].notes.length, 1);
  assert.equal(data.rawBefore.channels[0].notes[0].y, 48); assert.equal(data.rawAfter.channels[0].notes[0].y, 60);
  verifyCapture(data.coldBefore);
  const mixed = verifyCapture(data.mixed); assert.equal(mixed.length, 1);
  assert.equal(mixed[0]!.cell, 85); assert.equal(mixed[0]!.pitch, 72); assert.equal(mixed[0]!.channel, 7);
  assert(Math.abs((mixed[0]!.duration as number) - 1 / 3) < 1e-6);
  for (const take of [data.take, data.inserted, data.restored]) {
    assert.equal(take.report.applied, true); assert.deepEqual(take.report.disagreements, []);
  }
}
export async function verifySmoke(path: string): Promise<void> {
  const data = JSON.parse(gunzipSync(await readFile(path)).toString('utf8')) as Wire;
  assert.equal(data.schema, 'phase8h3c-smoke-v1'); assert.equal(data.reports.length, 3);
  for (const report of data.reports) {
    verifyCalls(report.calls);
    const call = report.calls.find((call: Call) => call.method === 'clip.read');
    assert.deepEqual(report.result, call.reply.result);
    assert.equal(report.result.refused, undefined);
    assert.deepEqual(report.rows, decodeNoteFrame(report.result.frame, RECORDED_PAGE));
    assert.equal(report.rows.length, 1); assert.equal(report.rows[0].cell, 512);
    assert.equal(report.rows[0].channel, 15); assert.equal(report.rows[0].pitch, 127);
    assert(report.result.parkMs >= 0 && report.result.batches === 1 && report.result.afterClose === 0);
    assert.equal(report.result.closeRule, 'confirm-before-release-v1');
    assert.equal(report.result.releaseOn, 0); assert.equal(report.result.releaseSustain, 0);
    assert.equal(report.result.releaseCallbacks, report.result.releaseEmpty);
    assert.equal(report.bytes, report.calls.reduce((sum: number, call: Call) => sum + call.bytes, 0));
  }
}
/** Check a stopped smoke run. A refusal is evidence of failure, not acceptance. */
export async function verifyStoppedSmoke(path: string, cleanupPath: string): Promise<void> {
  const data = JSON.parse(gunzipSync(await readFile(path)).toString('utf8')) as Wire;
  const cleanup = await load(cleanupPath);
  assert.equal(data.schema, 'phase8h3c-smoke-v1');
  assert.equal(data.reports.length, 1);
  assert(/^New \d+$/.test(data.state.entry.mark.project));
  assert.equal(data.state.entry.hello.runtimeProfile, 'normal-v1');
  assert.equal(data.state.entry.hello.methodCount, 87);
  assert.equal(data.state.entry.hello.methodsHash, 'ca139a3e62a55e68');
  assert.equal(data.state.entry.rig.clipReader.revision, 'clip-reader-v1');
  verifyCalls(data.calls);
  const report = data.reports[0];
  verifyCalls(report.calls);
  const call = report.calls.find((entry: Call) => entry.method === 'clip.read');
  assert.deepEqual(report.result, call.reply.result);
  assert.equal(call.params.channelId, data.state.trackId);
  assert.equal(report.result.refused, 'step-delta');
  assert.equal(report.result.frame, undefined);
  assert.equal(report.result.onsets, 1);
  assert.equal(report.result.batches, 1);
  assert(report.result.afterClose > 0);
  assert(report.result.parkMs >= 0 && report.result.bindMs > report.result.parkMs);
  assert.equal(report.result.selection.restored, true);
  assert.equal(report.result.bound.channelId, data.state.trackId);
  assert.equal(report.result.bound.row, 0);
  assert.deepEqual(report.rows, []);
  assert.deepEqual([report.after.trackIndex, report.after.slotIndex, report.after.mixerTrackIndex],
    [report.before.trackIndex, report.before.slotIndex, report.before.mixerTrackIndex]);
  assert.equal(report.bytes, report.calls.reduce((sum: number, entry: Call) => sum + entry.bytes, 0));
  assert.equal(data.calls.filter((entry: Call) => entry.method === 'clip.read').length, 1);
  const fixture = data.calls.find((entry: Call) => entry.method === 'cursor.setNotes');
  assert.deepEqual(fixture.params, { cursor: 'fine', channel: 15, notes: [[4, 127, 100, 0.25]] });
  assert.equal(cleanup.schema, 'phase8h3c-cleanup-v1');
  assert.equal(cleanup.state.trackId, data.state.trackId);
  verifyCalls(cleanup.calls);
  const after = cleanup.calls.find((entry: Call) => entry.method === 'track.list' &&
    !entry.reply.result.tracks.some((row: Wire) => row.channelId === data.state.trackId));
  assert.deepEqual(cleanup.after, after.reply.result);
  assert.deepEqual(cleanup.after.tracks.map((row: Wire) => row.channelId),
    data.state.entryTracks.map((row: Wire) => row.channelId));
  assert.deepEqual(cleanup.stats, cleanup.calls.filter((entry: Call) => entry.method === 'rig.stats').at(-1).reply.result);
  assert.equal(cleanup.stats.clipReader.open, false);
  assert.equal(cleanup.stats.clipReader.subscribed, false);
  assert.equal(cleanup.stats.clipReader.writeGate.readOpen, false);
  assert.equal(cleanup.stats.clipReader.writeGate.waiting, 0);
}
export async function verifyOffline(dir: string): Promise<void> {
  const manifest = await load(join(dir, 'offline.json'));
  assert.equal(manifest.schema, 'phase8h3c-offline-v1');
  const files: Record<string, string> = {};
  for (const [name, expected] of Object.entries(manifest.sha256)) {
    const bytes = await readFile(join(dir, name));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
    files[name] = name.endsWith('.gz') ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8');
  }
  const brain = files['brain-check.log.gz']!;
  assert.equal(Number(brain.match(/ℹ tests (\d+)/)?.[1]), manifest.brainTests);
  assert.equal(Number(brain.match(/ℹ pass (\d+)/)?.[1]), manifest.brainTests);
  assert.match(brain, /ℹ fail 0/);
  assert.match(files['extension-check.log.gz']!, /BUILD SUCCESSFUL/);
  assert.match(files['extension-check.log.gz']!, /Clip reader: (11|12|13) test groups passed/);
  const e228 = JSON.parse(files['e228.json']!);
  assert.equal(e228.verified, 1042); assert.equal(e228.soaked, 500); assert.equal(e228.playing, 250);
  assert.equal(JSON.parse(files['e229.json']!).trials, 50);
  assert(['pending-operator-replacement', 'stopped-smoke-step-delta', 'awaiting-confirm-before-release-replacement', 'passed'].includes(manifest.liveAcceptance));
  if (manifest.liveAcceptance === 'passed') {
    await verifySmoke(join(dir, 'smoke-confirm-before-release.json.gz'));
    await verifyPaired(join(dir, 'paired.json.gz'));
    await verifySelection(join(dir, 'selection.json.gz'));
    await verifyRefusals(join(dir, 'refusals.json.gz'));
    await verifyQueue(join(dir, 'queue.json.gz'));
    await verifyDisabled(join(dir, 'disabled.json.gz'));
    await verifyFaults(join(dir, 'faults.json.gz'));
    const cleanup = await load(join(dir, 'cleanup-confirm-before-release.json'));
    verifyCalls(cleanup.calls);
    const after = cleanup.calls.filter((call: Call) => call.method === 'track.list').at(-1).reply.result;
    assert.deepEqual(cleanup.after, after);
    assert.deepEqual(after.tracks.map((row: Wire) => row.channelId),
      cleanup.state.entryTracks.map((row: Wire) => row.channelId));
    const stats = cleanup.calls.filter((call: Call) => call.method === 'rig.stats').at(-1).reply.result;
    assert.deepEqual(cleanup.stats, stats);
    assert.equal(stats.clipReader.open, false); assert.equal(stats.clipReader.subscribed, false);
    assert.equal(stats.clipReader.writeGate.readOpen, false); assert.equal(stats.clipReader.writeGate.waiting, 0);
    assert.match(files['hello-normal-final.log']!, /ALL PASS/);
    assert.match(files['hello-probe.log']!, /ALL PASS/);
    const baseline = JSON.parse(files['baseline-final.json']!);
    verifyCalls(baseline.calls);
    assert.equal(baseline.mark.project, 'gn-scale-test');
    assert.equal(baseline.hello.runtimeProfile, 'normal-v1');
    assert.equal(baseline.hello.methodCount, 87); assert.equal(baseline.hello.methodsHash, 'ca139a3e62a55e68');
    for (const [field, method] of [['hello', 'contract.hello'], ['mark', 'revision.get'],
      ['tracks', 'track.list'], ['rig', 'rig.info'], ['stats', 'rig.stats']]) {
      assert.deepEqual(baseline[field!], baseline.calls.find((call: Call) => call.method === method).reply.result);
    }
    const originalTracks = JSON.parse(files['normal-hello-after-cleanup.log']!
      .split('\n').find(line => line.startsWith('PASS  track.list reports itemCount'))!.split('  ').at(-1)!);
    assert.deepEqual(baseline.tracks.tracks.map((row: Wire) => row.channelId),
      originalTracks.tracks.map((row: Wire) => row.channelId));
  }
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [command, out, state, row] = process.argv.slice(2);
  assert(out, 'artifact path required');
  if (row !== undefined) ROW = Number(row);
  try {
    if (command === 'verify-offline') await verifyOffline(out);
    else if (command === 'verify-smoke') await verifySmoke(out);
    else if (command === 'verify-paired') await verifyPaired(out);
    else if (command === 'verify-refusals') await verifyRefusals(out);
    else if (command === 'verify-selection') await verifySelection(out);
    else if (command === 'verify-faults') await verifyFaults(out);
    else if (command === 'verify-queue') await verifyQueue(out);
    else if (command === 'verify-disabled') await verifyDisabled(out);
    else if (command === 'verify-stopped-smoke') { assert(state); await verifyStoppedSmoke(out, state); }
    else if (command === 'smoke') { assert(state); await smoke(out, state); }
    else if (command === 'paired') { assert(state); await paired(out, state); }
    else if (command === 'refusals') { assert(state); await refusals(out, state); }
    else if (command === 'selection') { assert(state); await selectionCases(out, state); }
    else if (command === 'faults') { assert(state); await faults(out, state); }
    else if (command === 'queue') { assert(state); await queueCases(out, state); }
    else if (command === 'disabled') { assert(state); await disabled(out, state); }
    else if (command === 'cleanup') { assert(state); await cleanup(out, state); }
    else if (command === 'cleanup-probe') { assert(state); await cleanup(out, state, true); }
    else if (command === 'baseline') await baseline(out);
    else throw new Error(`unknown command ${command}`);
  } finally { await transport.close(); }
}
