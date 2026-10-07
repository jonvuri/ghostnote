/**
 * 8h4c2 reader heap ladder and sounding-cell limit. Live driver. Use an owned unsaved project; refuse the saved
 * anchor (D29).
 *
 *   ladder <dir> <cellsPerNote...>   for each rung, write 4,096 notes (16 channels x 256, legato) of the given
 *                  length in 1/512-beat cells, then read the clip with `clip.read` and its pages. `jcmd GC.heap_info`
 *                  samples the Bitwig Java heap before, during, and after the read. Stop at the first failure.
 *   limit <dir>    with the 8h4c2 build: a clip at the sounding-cell limit reads; a clip one note above it
 *                  refuses `sounding-cell-limit`; the extension answers after both.
 *
 * Each rung deletes its clip. The track `gn-8h4c2-ladder` is deleted at the end. The operator closes the
 * project without saving.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { decodeNoteFrame, type NoteFrame } from '../adapters/live/clip-read.js';
import { CLIP_READ_SOUNDING_CELLS, clip, scene, slot, track } from '../contract/index.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import type { E131Context } from './e131-diagnostic.js';
import { WireTransport } from './phase8h3c-promotion.js';
import type { Wire } from './phase8h4b-document-read-lib.js';

const execute = promisify(execFile);
const SCHEMA = 'phase8h4c2-ladder-v1';
const ANCHOR = 'gn-scale-test';
const NAME = 'gn-8h4c2-ladder';
const ROW = 0;
const NOTES = 4_096;
const PAGE = 131_072;
const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, executor: new Executor(adapter), stash: new Stash(),
  observationStore: new FakeObservationStore(),
});
const request = async (method: string, params?: Wire): Promise<Wire> =>
  await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
const pause = async (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const say = (value: Wire): void => console.log(JSON.stringify(value));

async function until(next: () => Promise<Wire>, done: (value: Wire) => boolean, limit = 30_000): Promise<Wire> {
  const started = performance.now();
  for (;;) {
    const value = await next(); if (done(value)) return value;
    assert(performance.now() - started < limit, `live state did not settle: ${JSON.stringify(value).slice(0, 400)}`);
    await pause(50);
  }
}

async function bitwigPid(): Promise<string> {
  const { stdout } = await execute('pgrep', ['-f', 'BitwigStudio --launch']);
  const pids = stdout.trim().split('\n').filter(Boolean);
  assert.equal(pids.length, 1, 'expected one Bitwig JVM process');
  return pids[0]!;
}

/** Used and capacity of the Bitwig ZGC heap, in MiB. No collection. */
async function heapInfo(pid: string): Promise<{ at: number; usedMb: number; capacityMb: number; maxMb: number }> {
  const { stdout } = await execute('jcmd', [pid, 'GC.heap_info']);
  const found = /used (\d+)M, capacity (\d+)M, max capacity (\d+)M/.exec(stdout);
  assert(found !== null, `unexpected heap_info: ${stdout.slice(0, 200)}`);
  return { at: Date.now(), usedMb: Number(found[1]), capacityMb: Number(found[2]), maxMb: Number(found[3]) };
}

async function guard(): Promise<Wire> {
  const hello = await request('contract.hello');
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project) && mark.project !== ANCHOR, `use an owned unsaved project, got ${mark.project}`);
  const rig = await request('rig.info');
  await adapter.hello();
  const pid = await bitwigPid();
  const { stdout } = await execute('jcmd', [pid, 'VM.command_line']);
  const jvmArgs = /jvm_args: (.*)/.exec(stdout)?.[1] ?? '';
  return { hello: [hello.runtimeProfile, hello.methodCount, hello.methodsHash], mark, clipReader: rig.clipReader,
    jvm: { args: jvmArgs.split(' ').filter((arg) => /^-X|^-XX/.test(arg)), heap: await heapInfo(pid) } };
}

async function trackIndex(id: string): Promise<number> {
  const found = ((await request('track.list')).tracks as Wire[]).find(row => row.channelId === id);
  assert(found !== undefined, `track ${id} is missing`);
  return Number(found.index);
}

async function fixtureTrack(): Promise<string> {
  const existing = ((await request('track.list')).tracks as Wire[]).find(row => row.name === NAME);
  if (existing !== undefined) return String(existing.channelId);
  const before = new Set(((await request('track.list')).tracks as Wire[]).map(row => row.channelId));
  await request('track.create', { position: 0 });
  const after = await until(() => request('track.list'),
    value => (value.tracks as Wire[]).some(row => row.index === 0 && !before.has(row.channelId)));
  const id = String((after.tracks as Wire[]).find(row => row.index === 0)!.channelId);
  await request('track.setName', { trackIndex: 0, name: NAME });
  return id;
}

async function emptySlot(id: string): Promise<number> {
  const index = await trackIndex(id);
  if ((await request('slot.status', { trackIndex: index, slotIndex: ROW })).hasContent === true) {
    await request('slot.delete', { trackIndex: index, slotIndex: ROW });
    await until(() => request('slot.status', { trackIndex: index, slotIndex: ROW }), value => value.hasContent !== true);
  }
  return index;
}

/**
 * `notes` legato notes of `cells` cells each, 16 channels, one step per note. A step is one note length, so
 * 256 notes for each channel fit the 2,048-step writer window.
 */
async function writeFixture(id: string, cells: number, notes: number): Promise<{ lengthBeats: number; cells: number }> {
  const beats = cells / 512;
  const perChannel = Math.ceil(notes / 16);
  assert(perChannel <= 2048, 'one writer window for each channel');
  const lengthBeats = Math.max(4, perChannel * beats);
  const index = await emptySlot(id);
  await request('clip.create', { trackIndex: index, slotIndex: ROW, lengthBeats });
  await until(() => request('slot.status', { trackIndex: index, slotIndex: ROW }), value => value.hasContent === true);
  const target = clip(slot(track(id), scene(ROW, (await adapter.revision()).sceneEpoch)));
  await (adapter as unknown as E131Context).pointAtClip(target, index, new Map(), 'fine');
  await request('cursor.setStepSize', { cursor: 'fine', stepSize: beats });
  let written = 0;
  for (let channel = 0; channel < 16 && written < notes; channel += 1) {
    const count = Math.min(perChannel, notes - written);
    const rows = Array.from({ length: count }, (_, k) => [k, 36 + ((k + channel) % 48), 100, beats]);
    await request('cursor.setNotes', { cursor: 'fine', channel, notes: rows });
    written += count;
  }
  await pause(1500);
  // Move the writer off the fixture, so only the reader binds its steps.
  await request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 / 4 });
  return { lengthBeats, cells: written * cells };
}

/** One `clip.read` with its pages, with heap samples every 100 ms while it runs. */
async function sampledRead(id: string, pid: string): Promise<Wire> {
  const index = await trackIndex(id);
  const samples: Wire[] = [];
  let running = true;
  const sampler = (async () => {
    while (running) {
      try { samples.push(await heapInfo(pid)); } catch (error) { samples.push({ at: Date.now(), error: String(error) }); }
      await pause(100);
    }
  })();
  const started = performance.now();
  let reply: Wire | undefined;
  let error: string | undefined;
  let notes = 0;
  try {
    reply = await transport.send({ method: 'clip.read', params: { trackIndex: index, row: ROW, channelId: id },
      timeoutMs: 30_000 }) as Wire;
    if (reply.refused === undefined) {
      let frame = reply.frame as NoteFrame;
      for (;;) {
        notes += decodeNoteFrame(frame, PAGE).length;
        if (frame.next < 0) break;
        frame = await request('clip.readPage', { readId: reply.readId, from: frame.next }) as NoteFrame;
      }
    }
  } catch (caught) {
    error = String(caught);
  }
  const readMs = performance.now() - started;
  await pause(500);
  running = false;
  await sampler;
  const { frame: _frame, ...summary } = reply ?? {};
  return { readMs, error, notes, reply: summary, samples,
    peakUsedMb: Math.max(...samples.map((sample) => Number(sample.usedMb ?? 0))) };
}

async function alive(): Promise<Wire> {
  const started = performance.now();
  const ping = await request('ping');
  const stats = await request('rig.stats');
  return { pingMs: performance.now() - started, pong: ping.pong, heapUsedMb: stats.heapUsedMb, heapMaxMb: stats.heapMaxMb,
    reader: { reads: stats.clipReader?.reads, refusals: stats.clipReader?.refusals, lastRefusal: stats.clipReader?.lastRefusal } };
}

async function rung(id: string, pid: string, cells: number, notes: number): Promise<Wire> {
  const fixture = await writeFixture(id, cells, notes);
  const before = await heapInfo(pid);
  const read = await sampledRead(id, pid);
  const after = await alive().catch((caught) => ({ error: String(caught) }));
  const record = { cellsPerNote: cells, notes, ...fixture, heapBefore: before, read, after };
  say({ rung: cells, notes, soundingCells: fixture.cells, readMs: Math.round(read.readMs), decoded: read.notes,
    refused: read.reply.refused, error: read.error, heapBeforeMb: before.usedMb, peakUsedMb: read.peakUsedMb,
    heapCloseMb: read.reply.heapCloseMb, alive: 'pong' in after });
  return record;
}

async function ladder(dir: string, rungs: number[]): Promise<void> {
  await mkdir(dir, { recursive: true });
  const entry = await guard();
  const pid = await bitwigPid();
  const id = await fixtureTrack();
  const out: Wire = { schema: SCHEMA, command: 'ladder', entry, trackId: id, notesPerRung: NOTES, rungs: [] };
  const save = async () => writeFile(join(dir, 'ladder.json'), JSON.stringify(out, null, 1) + '\n');
  try {
    for (const cells of rungs) {
      const record = await rung(id, pid, cells, NOTES);
      out.rungs.push(record);
      await save();
      if (record.read.error !== undefined || record.read.reply.refused !== undefined || !('pong' in record.after)) break;
      await emptySlot(id);
    }
  } finally {
    await save();
  }
  await emptySlot(id);
  await request('track.delete', { trackIndex: await trackIndex(id) });
}

/** The limit with the 8h4c2 build: quarter-beat notes (128 cells), at the limit and one note above it. */
async function limit(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const entry = await guard();
  assert.equal(entry.clipReader?.soundingCells, CLIP_READ_SOUNDING_CELLS, 'the 8h4c2 build is loaded');
  const pid = await bitwigPid();
  const id = await fixtureTrack();
  const at = CLIP_READ_SOUNDING_CELLS / 128;
  const out: Wire = { schema: SCHEMA, command: 'limit', entry, trackId: id, limit: CLIP_READ_SOUNDING_CELLS, rungs: [] };
  const save = async () => writeFile(join(dir, 'limit.json'), JSON.stringify(out, null, 1) + '\n');
  try {
    for (const notes of [at, at + 16]) {
      out.rungs.push(await rung(id, pid, 128, notes));
      await save();
    }
  } finally {
    await save();
  }
  // The read tool reports the limit as outside-limit.
  const tool = await callTool(workspace, 'read_launcher_clip', { trackId: id, row: ROW }, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  out.tool = { failure: tool.failure, message: tool.message, alive: await alive() };
  await save();
  say({ step: 'tool', code: tool.failure?.code, message: tool.message });
  const [admitted, refused] = out.rungs as Wire[];
  assert.equal(tool.failure?.code, 'outside-limit');
  assert.equal(admitted!.read.reply.refused, undefined, 'a clip at the limit reads');
  assert.equal(admitted!.read.notes, at);
  assert.equal(refused!.read.reply.refused, 'sounding-cell-limit', 'a clip above the limit refuses');
  assert('pong' in refused!.after, 'the extension answers after the refusal');
  await emptySlot(id);
  await request('track.delete', { trackIndex: await trackIndex(id) });
}

async function main(): Promise<void> {
  const [command, dir, ...rest] = process.argv.slice(2);
  try {
    switch (command) {
      case 'ladder': await ladder(dir!, rest.map(Number)); break;
      case 'limit': await limit(dir!); break;
      default: throw new Error('usage: phase8h4c2-ladder ladder <dir> <cellsPerNote...> | limit <dir>');
    }
  } finally { await transport.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
