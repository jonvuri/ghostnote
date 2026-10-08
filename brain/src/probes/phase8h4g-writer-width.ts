/**
 * 8h4g step 6: the writer cursor width (E248). Live driver, normal profile, owned unsaved project (refuses the
 * saved anchor, D29). Each command creates its own track and deletes it.
 *
 *   entry <dir>      hello, rig.info, and the Bitwig heap after a full collection
 *   reviewer <dir>   512 notes on a 2,048-beat clip, four beats apart, duration 1/512: add, then change every
 *                    velocity (whole-clip). Records the wall time, the page checks, and the turns of each call.
 *   far <dir>        correctness at the far end of the widest window: a 8,192-beat clip with a note on the last
 *                    1/512 cell, a beat-96 note (E46), and a 1/64 note row over 16 beats (E44). Then an
 *                    expression change on the far note (setNoteProps) and its removal (clearStep).
 *   heap <dir> [notes] [mixed]  retained heap of a held writer: `notes` one-beat notes on the 1/512 grid
 *                    (512 sounding cells each), read after the add with the writer still held, then after the
 *                    track is deleted.
 *
 * Each command writes `<command>-<fineSteps>.json` so that the widths sit side by side.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { parse, serialize, type StateDocument } from '../document/index.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { WireTransport } from './phase8h3c-promotion.js';
import { wireSummary } from './phase8h4g-inventory.js';
import { NORMAL_8H4F } from './phase8h4f-measure.js';

type Wire = Record<string, any>;
const SCHEMA = 'phase8h4g-writer-width-v1';
const ANCHOR = 'gn-scale-test';
const execute = promisify(execFile);
const say = (value: unknown): void => console.log(JSON.stringify(value));
const EXPRESSION = (pan: number) => `{"expression":{"velocitySpread":0,"gain":1,"pan":${pan},"pressure":0,"timbre":0.5,"transpose":0}}`;

const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
  observationStore: new FakeObservationStore(),
});
const tool = async (name: string, args: Wire) => await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;

async function bitwigPid(): Promise<string> {
  const { stdout } = await execute('pgrep', ['-f', 'BitwigStudio --launch']);
  const pids = stdout.trim().split('\n').filter(Boolean);
  assert.equal(pids.length, 1, 'expected one Bitwig JVM process');
  return pids[0]!;
}

/** The live heap after a full collection (E225 method), and the host NoteStep proxies. */
async function liveHeap(): Promise<{ liveMb: number; noteSteps: number }> {
  const { stdout } = await execute('jcmd', [await bitwigPid(), 'GC.class_histogram'], { maxBuffer: 64 << 20 });
  const total = /Total\s+(\d+)\s+(\d+)/.exec(stdout);
  assert(total !== null, 'unexpected class histogram');
  const steps = /^\s*\d+:\s+(\d+)\s+\d+\s+com\.bitwig\.flt\.control_surface\.proxy\.NoteStep\b/m.exec(stdout);
  return { liveMb: Math.round(Number(total[2]) / 1048576), noteSteps: steps === null ? 0 : Number(steps[1]) };
}

/** ZGC used heap in MiB, sampled every 100 ms until `stop` (no collection; includes garbage, E246 method). */
function sampleHeap(): { stop: () => Promise<{ peakUsedMb: number; maxMb: number; samples: number }> } {
  let running = true;
  let peak = 0; let max = 0; let samples = 0;
  const loop = (async () => {
    const pid = await bitwigPid();
    while (running) {
      const { stdout } = await execute('jcmd', [pid, 'GC.heap_info']);
      const found = /used (\d+)M, capacity \d+M, max capacity (\d+)M/.exec(stdout);
      if (found !== null) { peak = Math.max(peak, Number(found[1])); max = Number(found[2]); samples += 1; }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  })();
  return { stop: async () => { running = false; await loop; return { peakUsedMb: peak, maxMb: max, samples }; } };
}

async function guard(): Promise<Wire> {
  const hello = await transport.send({ method: 'contract.hello' }) as Wire;
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [...NORMAL_8H4F]);
  const mark = await transport.send({ method: 'revision.get' }) as Wire;
  assert(/^New \d+$/.test(mark.project) && mark.project !== ANCHOR, `use an owned unsaved project, got ${mark.project}`);
  const rig = await transport.send({ method: 'rig.info' }) as Wire;
  const stats = await transport.send({ method: 'rig.stats' }) as Wire;
  await adapter.hello();
  return { hello: [hello.runtimeProfile, hello.methodCount, hello.methodsHash], project: mark.project,
    fineSteps: rig.fineSteps, rigConstructMicros: stats.rigConstructMicros, initMicros: stats.initMicros,
    initEpochMs: stats.initEpochMs };
}

/** One timed tool call: wall time, turns, and the writer page checks (`cursor.status` after a grid settle). */
async function timed(step: string, name: string, args: Wire): Promise<{ row: Wire; result: Wire }> {
  const from = transport.calls.length;
  const started = performance.now();
  const result = await tool(name, args);
  const ms = Math.round(performance.now() - started);
  const wire = wireSummary(transport.calls.slice(from));
  const row = { step, tool: name, ms, status: result.readback?.status, code: result.failure?.code,
    route: result.plan?.route, calls: transport.calls.length - from, turns: wire.turns,
    scrolls: wire.methods['cursor.scrollToStep'] ?? 0, statusChecks: wire.methods['cursor.status'] ?? 0,
    stages: wire.stages, timing: result.timing };
  say(row);
  return { row, result };
}

async function withTrack<T>(name: string, body: (trackId: string) => Promise<T>): Promise<T> {
  const trackId = (await tool('add_tracks', { tracks: [{ name }] })).readback.tracks[0].trackId as string;
  try {
    return await body(trackId);
  } finally {
    await tool('delete_track', { trackIds: [trackId] });
  }
}

const desired = (length: string, events: string[]) => [
  'DOC ghostnote-document 1.0 desired', `CLIP {"id":"c1","length":"${length}","loop":{"from":"0","to":"${length}"}}`,
  `COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"c1","fields":"all","status":"complete","from":"0","to":"${length}"}`,
  'FIELDS id clip at duration pitch velocity channel', ...events].join('\n') + '\n';

const patch = (base: Wire, lines: string[]) => ['DOC ghostnote-document 1.0 patch',
  `BASE ${JSON.stringify({ sha256: base.sha256, ref: base.ref })}`,
  'FIELDS id clip at duration pitch velocity channel mute', ...lines].join('\n') + '\n';

const documentOf = (result: Wire): StateDocument => parse(result.data.document as string, 'fields') as StateDocument;

async function save(dir: string, name: string, value: Wire): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${name}.json`), JSON.stringify(value, null, 1) + '\n');
}

async function entry(dir: string): Promise<void> {
  const out: Wire = { schema: `${SCHEMA}-entry`, ...(await guard()), heap: await liveHeap() };
  say(out);
  await save(dir, `entry-${out.fineSteps}`, out);
}

/** The review case: each note on its own 512-step page at the 1/512 grid. */
export function reviewerDesired(): string {
  return desired('2048', Array.from({ length: 512 }, (_, k) =>
    `EVENT r${k} c1 ${k * 4} 1/512 ${36 + (k % 48)} 100 1`));
}

async function reviewer(dir: string): Promise<void> {
  const entered = await guard();
  const rows = await withTrack('gn-8h4g-reviewer', async (trackId) => {
    const add = await timed('add', 'add_launcher_clip', { trackId, row: 0, document: reviewerDesired() });
    assert.equal(add.result.readback?.status, 'verified', JSON.stringify(add.result).slice(0, 600));
    const read = await timed('read', 'read_launcher_clip', { trackId, row: 0 });
    const document = documentOf(read.result);
    const next: StateDocument = { ...document, kind: 'desired', base: read.result.authority.base,
      coverage: document.coverage.map((item) => ({ ...item, fields: 'all' })),
      events: document.events.map((event) => ({ ...event, velocity: 90 })) };
    const edit = await timed('edit', 'edit_launcher_clip', { trackId, row: 0, document: serialize(next, 'fields') });
    assert.equal(edit.result.plan?.route, 'whole-clip');
    assert.equal(edit.result.readback?.status, 'verified', JSON.stringify(edit.result).slice(0, 600));
    return [add.row, read.row, edit.row];
  });
  await save(dir, `reviewer-${entered.fineSteps}`, { schema: `${SCHEMA}-reviewer`, ...entered, rows });
}

async function far(dir: string): Promise<void> {
  const entered = await guard();
  const last = '8191+511/512';
  const lastAt = `${8191 * 512 + 511}/512`;
  const rows = await withTrack('gn-8h4g-far', async (trackId) => {
    const out: Wire[] = [];
    // The far note, an E46 later-page note, and an E44 row of 1/64 notes past the old 512-step window.
    const events = [`EVENT a c1 0 1/512 60 100 7`, `EVENT b c1 96 1/512 62 100 7`, `EVENT z c1 ${lastAt} 1/512 64 100 7`,
      ...Array.from({ length: 8 }, (_, k) => `EVENT v${k} c1 ${2 * k * 64 + 1}/64 1/64 ${48 + k} 100 1`)];
    const add = await timed('far-add', 'add_launcher_clip', { trackId, row: 0, document: desired('8192', events) });
    out.push(add.row);
    assert.equal(add.result.readback?.status, 'verified', JSON.stringify(add.result).slice(0, 600));
    let read = await timed('far-read', 'read_launcher_clip', { trackId, row: 0 });
    out.push(read.row);
    let document = documentOf(read.result);
    const at = (value: string) => document.events.find((event) => event.at === value) as Wire | undefined;
    assert.equal(document.events.length, 11, `far read: ${document.events.length} events`);
    assert(at(lastAt) !== undefined, `the far note at ${last} is missing`);
    // setNoteProps on the far note and on the beat-96 note.
    const props = await timed('far-props', 'edit_launcher_clip', { trackId, row: 0, document: patch(read.result.authority.base,
      [`UPDATE ${at(lastAt)!.id} ${EXPRESSION(-0.25)}`, `UPDATE ${at('96')!.id} ${EXPRESSION(0.5)}`]) });
    out.push(props.row);
    assert.equal(props.result.readback?.status, 'verified', JSON.stringify(props.result).slice(0, 800));
    read = await timed('far-read-2', 'read_launcher_clip', { trackId, row: 0 });
    document = documentOf(read.result);
    const pans = [at(lastAt)?.expression?.pan, at('96')?.expression?.pan];
    assert.deepEqual(pans, [-0.25, 0.5], `far pans ${JSON.stringify(pans)}`);
    // clearStep on the far note.
    const remove = await timed('far-remove', 'edit_launcher_clip', { trackId, row: 0,
      document: patch(read.result.authority.base, [`REMOVE ${at(lastAt)!.id}`]) });
    out.push(remove.row);
    assert.equal(remove.result.readback?.status, 'verified', JSON.stringify(remove.result).slice(0, 800));
    read = await timed('far-read-3', 'read_launcher_clip', { trackId, row: 0 });
    document = documentOf(read.result);
    assert.equal(document.events.length, 10);
    assert.equal(at(lastAt), undefined);
    return { rows: out, pans };
  });
  await save(dir, `far-${entered.fineSteps}`, { schema: `${SCHEMA}-far`, ...entered, ...rows });
}

async function heap(dir: string, count: number, mixed = false): Promise<void> {
  const entered = await guard();
  const before = await liveHeap();
  say({ step: 'heap-before', ...before });
  const out = await withTrack('gn-8h4g-heap', async (trackId) => {
    // One-beat notes on 1/512 starts: the writer grid is 1/512, 512 sounding cells for each note. `mixed`: channel 8
    // has whole-beat starts (the 1/4 grid), so the grids of the write are 1/512, 1/4, 1/512 (the review P1 case:
    // the last confirmed grid is not the last written grid).
    const events = Array.from({ length: count }, (_, k) => mixed && k % 16 === 7
      ? `EVENT h${k} c1 ${k >> 4} 1/4 ${36 + (k % 48)} 100 8`
      : `EVENT h${k} c1 ${(k >> 4) * 512 + 1}/512 1 ${36 + (k % 48)} 100 ${(k % 16) + 1}`);
    const length = String(Math.max(64, Math.ceil(count / 16) + 1));
    const sampler = sampleHeap();
    const add = await timed('heap-add', 'add_launcher_clip', { trackId, row: 0, document: desired(length, events) });
    const peak = await sampler.stop();
    say({ step: 'heap-peak', ...peak });
    assert.equal(add.result.readback?.status, 'verified', JSON.stringify(add.result).slice(0, 600));
    const held = await liveHeap();
    say({ step: 'heap-held', ...held });
    // The reader alone on the same clip: the share of the add peak that is not the writer.
    const readSampler = sampleHeap();
    const read = await timed('heap-read', 'read_launcher_clip', { trackId, row: 0 });
    const readPeak = await readSampler.stop();
    say({ step: 'heap-read-peak', ...readPeak });
    return { add: add.row, peak, held, read: read.row, readPeak, length };
  });
  const released = await liveHeap();
  say({ step: 'heap-released', ...released });
  await save(dir, `heap-${count}${mixed ? '-mixed' : ''}-${entered.fineSteps}`, { schema: `${SCHEMA}-heap`, ...entered, count, mixed,
    soundingCells: count * 512, before, ...out, released });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [command, dir, arg] = process.argv.slice(2);
  const run = command === 'entry' ? entry(dir!)
    : command === 'reviewer' ? reviewer(dir!)
      : command === 'far' ? far(dir!)
        : command === 'heap' ? heap(dir!, Number(arg ?? 1024), process.argv[5] === 'mixed')
          : Promise.reject(new Error('usage: phase8h4g-writer-width entry|reviewer|far|heap <dir> [notes]'));
  run.then(async () => { await transport.close(); process.exit(0); },
    (error) => { console.error(error); process.exit(1); });
}
