/**
 * 8h4d musical and clip surface migration. Live driver. Use an owned unsaved project; refuse the saved anchor (D29).
 *
 *   workflow <dir>  an E45/E48-style workflow on one typical clip, first through stable-v1, then through
 *                   agent-native-v1: read, copy to the next scene, a 16-note insertion into the copy, launch, show,
 *                   and revert of the edit and the copy. Each tool call records wall time and result bytes. Then,
 *                   agent-native-v1 only: add_launcher_clip (and add_clip on stable-v1 for comparison), and one
 *                   background edit through inspect_operation. Every step ends at the raw baseline: an independent
 *                   raw `clip.read` of the source equals its first read, and the work rows are empty.
 *                   The normal profile has no transport stop: the operator stops playback after the run.
 *   verify-offline <dir>  recompute the claims from the retained artifact
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { decodeNoteFrame, type NoteFrame, type RawNoteFields } from '../adapters/live/clip-read.js';
import { clip, clipMetadata, scene, slot, supportedClipColors, track, type ClipAddress } from '../contract/index.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, STABLE_TOOL_PROFILE, callTool, type ToolProfile } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import type { E131Context } from './e131-diagnostic.js';
import { WireTransport } from './phase8h3c-promotion.js';
import { typicalNotes } from './phase8h3e-snapshots-lib.js';
import { parse, type StateDocument } from '../document/index.js';
import { NORMAL, rawDiff, rowKey, type Wire } from './phase8h4b-document-read-lib.js';

const SCHEMA = 'phase8h4d-workflow-v1';
const PAGE = 131_072;
const ANCHOR = 'gn-scale-test';
const NAME = 'gn-8h4d-workflow';
const SOURCE = 0;
const COPY = 1;
const ADDED = 2;
const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
  observationStore: new FakeObservationStore(),
});
const request = async (method: string, params?: Wire): Promise<Wire> =>
  await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
const pause = async (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const say = (value: Wire): void => console.log(JSON.stringify(value));

interface Step { profile: string; phase: string; step: string; tool: string; ms: number; bytes: number; ok: boolean; code?: string }
const steps: Step[] = [];
/** `workflow` for the compared workflow; `extra` for the add, background, and launch measurements. */
let phase = 'workflow';

/** One tool call through the MCP dispatch path, timed, with its JSON result size. */
async function call(profile: ToolProfile, step: string, name: string, args: Wire): Promise<Wire> {
  const started = performance.now();
  const result = await callTool(workspace, name, args, profile) as Wire;
  const ms = performance.now() - started;
  const failed = result.failure !== undefined || result.refused === true;
  const record: Step = { profile, phase, step, tool: name, ms: Math.round(ms), bytes: Buffer.byteLength(JSON.stringify(result)),
    ok: !failed, ...(result.failure?.code === undefined ? {} : { code: result.failure.code }) };
  steps.push(record); say(record);
  assert(!failed, `${name}: ${JSON.stringify(result).slice(0, 600)}`);
  return result;
}

async function until(next: () => Promise<Wire>, done: (value: Wire) => boolean, limit = 30_000): Promise<Wire> {
  const started = performance.now();
  for (;;) {
    const value = await next(); if (done(value)) return value;
    assert(performance.now() - started < limit, `live state did not settle: ${JSON.stringify(value).slice(0, 400)}`);
    await pause(50);
  }
}

async function guard(): Promise<Wire> {
  const hello = await request('contract.hello');
  // 8h4f reruns this workflow on the current normal profile (89 methods since 8h4e).
  const current = [[...NORMAL], ['normal-v1', 89, '0ef817f4bac8a8a7']];
  assert(current.some((item) => JSON.stringify(item) === JSON.stringify([hello.runtimeProfile, hello.methodCount,
    hello.methodsHash])), `unexpected profile ${JSON.stringify(hello)}`);
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project) && mark.project !== ANCHOR, `use an owned unsaved project, got ${mark.project}`);
  await adapter.hello();
  return { hello, mark };
}
async function indexOf(id: string): Promise<number> {
  const found = ((await request('track.list')).tracks as Wire[]).find(row => row.channelId === id);
  assert(found !== undefined, `track ${id} is missing`);
  return Number(found.index);
}
async function clipOf(id: string, row: number): Promise<ClipAddress> {
  return clip(slot(track(id), scene(row, (await adapter.revision()).sceneEpoch)));
}
async function createTrack(name: string): Promise<string> {
  const before = new Set(((await request('track.list')).tracks as Wire[]).map(row => row.channelId));
  await request('track.create', { position: 0 });
  const after = await until(() => request('track.list'),
    value => (value.tracks as Wire[]).some(row => row.index === 0 && !before.has(row.channelId)));
  const id = String((after.tracks as Wire[]).find(row => row.index === 0)!.channelId);
  await request('track.setName', { trackIndex: 0, name }); return id;
}
async function occupied(id: string, row: number): Promise<boolean> {
  return (await request('slot.status', { trackIndex: await indexOf(id), slotIndex: row })).hasContent === true;
}
/** Write the typical clip (E231: 256 notes on 16 channels over 64 beats) with a palette colour. */
async function writeTypical(id: string, row: number): Promise<RawNoteFields[]> {
  const index = await indexOf(id);
  await request('clip.create', { trackIndex: index, slotIndex: row, lengthBeats: 64 });
  await until(() => request('slot.status', { trackIndex: index, slotIndex: row }), value => value.hasContent === true);
  await (adapter as unknown as E131Context).pointAtClip(await clipOf(id, row), index, new Map(), 'fine');
  await request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 / 4 });
  for (const [channel, notes] of typicalNotes(0).entries()) await request('cursor.setNotes', { cursor: 'fine', channel, notes });
  await pause(500);
  const target = await clipOf(id, row);
  const value = Object.values((await adapter.read([clipMetadata(target)])).entries)[0]!.value;
  assert(value.of === 'clipMetadata');
  const { red, green, blue } = supportedClipColors()[0]!;
  await adapter.apply({ ops: [{ op: 'clip.update', clip: target, metadata: { ...value.metadata, color: { red, green, blue } } }] });
  await adapter.settle('noteWrite'); await pause(300);
  const rows = await rawRead(id, row);
  assert.equal(rows.length, 256);
  return rows;
}
/** The independent raw read: `clip.read` and its pages, decoded. A read during an edit refuses; retry it. */
async function rawRead(id: string, row: number): Promise<RawNoteFields[]> {
  const index = await indexOf(id);
  let result = await request('clip.read', { trackIndex: index, row, channelId: id });
  for (let attempt = 0; result.refused !== undefined && attempt < 5; attempt++) {
    await pause(500);
    result = await request('clip.read', { trackIndex: index, row, channelId: id });
  }
  assert.equal(result.refused, undefined, `raw read refused: ${result.refused} ${result.message ?? ''}`);
  const rows: RawNoteFields[] = [];
  let frame = result.frame as NoteFrame;
  for (;;) {
    rows.push(...decodeNoteFrame(frame, PAGE));
    if (frame.next < 0) break;
    frame = await request('clip.readPage', { readId: result.readId, from: frame.next }) as NoteFrame;
  }
  return rows.sort((a, b) => rowKey(a) < rowKey(b) ? -1 : rowKey(a) > rowKey(b) ? 1 : 0);
}
const sameRows = (a: readonly RawNoteFields[], b: readonly RawNoteFields[]): boolean => {
  const d = rawDiff(a, b); return d.removed.length + d.added.length + d.changed.length === 0;
};

/** The baseline after each workflow: the source is unchanged and the work rows are empty. */
async function baseline(id: string, source: RawNoteFields[], label: string): Promise<Wire> {
  const now = await rawRead(id, SOURCE);
  const result = { label, sourceUnchanged: sameRows(source, now), copyEmpty: !(await occupied(id, COPY)),
    addedEmpty: !(await occupied(id, ADDED)) };
  say({ baseline: result });
  assert(result.sourceUnchanged && result.copyEmpty && result.addedEmpty, `baseline differs: ${JSON.stringify(result)}`);
  return result;
}

const STABLE_NOTES = Array.from({ length: 16 }, (_, channel) => ({
  trackId: '', row: COPY, channel, notes: [{ startBeats: 4.5, pitch: 96, velocity: 100, durationBeats: 0.25 }] }));

async function stableWorkflow(id: string): Promise<void> {
  const p = STABLE_TOOL_PROFILE;
  await call(p, 'read', 'read_clip', { trackId: id, row: SOURCE });
  const copied = await call(p, 'copy', 'copy_clip_down', { trackId: id, row: SOURCE, quantization: '1',
    mode: 'continue_or_synced' });
  const written = await call(p, 'edit', 'write_notes', { clips: STABLE_NOTES.map((item) => ({ ...item, trackId: id })) });
  await call(p, 'launch', 'launch_clip', { trackId: id, row: COPY, quantization: 'none', mode: 'from_start' });
  await call(p, 'show', 'show_changed_clip', { changeId: written.changeId });
  await call(p, 'revert', 'revert_change', { changeId: written.changeId });
  await call(p, 'revert', 'revert_change', { changeId: copied.changeId });
}

async function nativeWorkflow(id: string): Promise<Wire> {
  const p = AGENT_NATIVE_TOOL_PROFILE;
  await call(p, 'read', 'read_launcher_clip', { trackId: id, row: SOURCE });
  const copied = await call(p, 'copy', 'copy_launcher_clips', { copies: [{ source: { trackId: id, row: SOURCE },
    destination: { trackId: id, row: COPY } }] });
  const read = await call(p, 'edit', 'read_launcher_clip', { trackId: id, row: COPY });
  const clipId = (parse(read.data.document, 'fields') as StateDocument).clips[0]!.id;
  const patch = ['DOC ghostnote-document 1.0 patch', `BASE ${JSON.stringify(read.authority.base)}`,
    'FIELDS id clip at duration pitch velocity channel mute',
    ...Array.from({ length: 16 }, (_, c) => `ADD i${c} ${clipId} 9/2 1/4 96 100 ${c + 1} false`)].join('\n') + '\n';
  const edited = await call(p, 'edit', 'edit_launcher_clip', { trackId: id, row: COPY, document: patch });
  assert.equal(edited.readback.status, 'verified');
  await call(p, 'launch', 'launch_clip', { trackId: id, row: COPY, quantization: 'none', mode: 'from_start' });
  await call(p, 'show', 'show_launcher_clip_in_detail_editor', { trackId: id, row: COPY });
  await call(p, 'revert', 'revert_change', { changeId: edited.effects[0].changeId });
  await call(p, 'revert', 'revert_change', { changeId: copied.effects[0].changeId });
  return { edit: edited.timing, plan: edited.plan };
}

const ADD_DOCUMENT = ['DOC ghostnote-document 1.0 desired', 'CLIP {"id":"c1","length":"8","loop":{"from":"0","to":"8"}}',
  'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"c1","fields":"all","from":"0","status":"complete","to":"8"}',
  'FIELDS id clip at duration pitch velocity channel',
  ...Array.from({ length: 16 }, (_, c) => `EVENT n${c} c1 ${c}/2 1/4 ${60 + c} 100 ${c + 1}`)].join('\n') + '\n';

async function addComparison(id: string): Promise<Wire> {
  const stable = await call(STABLE_TOOL_PROFILE, 'add', 'add_clip', { clips: [{ trackId: id, row: ADDED, lengthBeats: 8,
    notes: Array.from({ length: 16 }, (_, c) => ({ startBeats: c / 2, pitch: 60 + c, velocity: 100, durationBeats: 0.25 })) }] });
  await call(STABLE_TOOL_PROFILE, 'revert', 'revert_change', { changeId: stable.changeId });
  const added = await call(AGENT_NATIVE_TOOL_PROFILE, 'add', 'add_launcher_clip', { trackId: id, row: ADDED,
    document: ADD_DOCUMENT });
  assert.equal(added.readback.status, 'verified', JSON.stringify(added).slice(0, 600));
  const read = await call(AGENT_NATIVE_TOOL_PROFILE, 'add', 'read_launcher_clip', { trackId: id, row: ADDED });
  const document = parse(read.data.document, 'fields') as StateDocument;
  for (const step of added.next.revert) {
    await call(AGENT_NATIVE_TOOL_PROFILE, 'revert', 'revert_change', { changeId: step.changeId });
  }
  return { plan: added.plan, timing: added.timing, clip: document.clips[0], events: document.events.length };
}

async function backgroundEdit(id: string): Promise<Wire> {
  const p = AGENT_NATIVE_TOOL_PROFILE;
  const read = await call(p, 'background', 'read_launcher_clip', { trackId: id, row: SOURCE });
  const document = parse(read.data.document, 'fields') as StateDocument;
  const desired = ['DOC ghostnote-document 1.0 patch', `BASE ${JSON.stringify(read.authority.base)}`,
    'FIELDS id clip at duration pitch velocity channel mute', ...document.events.slice(0, 64).map((event) => `UPDATE ${event.id} {"velocity":90}`)].join('\n') + '\n';
  const started = performance.now();
  const handle = await call(p, 'background', 'edit_launcher_clip', { trackId: id, row: SOURCE, document: desired, background: true });
  const handleMs = performance.now() - started;
  let polls = 0;
  let status: Wire;
  do {
    await pause(250); polls += 1;
    status = await callTool(workspace, 'inspect_operation', { operationId: handle.operation.operationId }, p) as Wire;
  } while (status.operation.terminal !== true);
  const doneMs = performance.now() - started;
  steps.push({ profile: p, phase, step: 'background', tool: 'inspect_operation', ms: Math.round(doneMs - handleMs),
    bytes: Buffer.byteLength(JSON.stringify(status)), ok: status.operation.state === 'completed' });
  assert.equal(status.operation.state, 'completed', JSON.stringify(status).slice(0, 600));
  const result = status.operation.result as Wire;
  assert.equal(result.readback?.status, 'verified', JSON.stringify(result).slice(0, 600));
  await call(p, 'revert', 'revert_change', { changeId: result.effects[0].changeId });
  return { handleMs: Math.round(handleMs), doneMs: Math.round(doneMs), polls, operationElapsedMs: status.operation.elapsedMs,
    route: result.plan.route, editTotalMs: Math.round(result.timing.totalMs) };
}

function totals(from: readonly Step[], profile: string): Wire {
  const own = from.filter((item) => item.profile === profile && item.phase === 'workflow');
  return { calls: own.length, ms: own.reduce((sum, item) => sum + item.ms, 0), bytes: own.reduce((sum, item) => sum + item.bytes, 0) };
}

/** Paired launches of the source clip: stable-v1 and agent-native-v1 alternate. */
async function launchPairs(id: string, pairs = 4): Promise<Wire> {
  const ms: Record<string, number[]> = { stable: [], native: [] };
  for (let k = 0; k < pairs; k++) {
    for (const [key, profile] of [['stable', STABLE_TOOL_PROFILE], ['native', AGENT_NATIVE_TOOL_PROFILE]] as const) {
      const before = steps.length;
      await call(profile, 'launch-pair', 'launch_clip', { trackId: id, row: SOURCE, quantization: 'none', mode: 'from_start' });
      ms[key]!.push(steps[before]!.ms);
    }
  }
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
  return { stable: ms.stable, native: ms.native, stableMedian: median(ms.stable!), nativeMedian: median(ms.native!) };
}

async function workflow(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const entry = await guard();
  assert((await adapter.revision()).window.scenes.count >= 3, 'the project needs at least three scenes');
  // A track left by an aborted run goes first.
  for (const row of ((await request('track.list')).tracks as Wire[]).filter((item) => item.name === NAME).reverse()) {
    await request('track.delete', { trackIndex: Number(row.index) });
  }
  const id = await createTrack(NAME);
  const source = await writeTypical(id, SOURCE);
  await stableWorkflow(id);
  const stableBaseline = await baseline(id, source, 'stable-v1');
  const native = await nativeWorkflow(id);
  const nativeBaseline = await baseline(id, source, 'agent-native-v1');
  phase = 'extra';
  const add = await addComparison(id);
  const addBaseline = await baseline(id, source, 'add');
  const background = await backgroundEdit(id);
  const backgroundBaseline = await baseline(id, source, 'background');
  const launches = await launchPairs(id);
  const out = {
    schema: SCHEMA, at: new Date().toISOString(), entry, trackId: id, steps,
    totals: { stable: totals(steps, STABLE_TOOL_PROFILE), native: totals(steps, AGENT_NATIVE_TOOL_PROFILE) },
    native, add, background, launches,
    baselines: [stableBaseline, nativeBaseline, addBaseline, backgroundBaseline],
  };
  await writeFile(join(dir, 'workflow.json'), JSON.stringify(out, null, 1) + '\n');
  say({ totals: out.totals, add, background, launches });
  await request('track.delete', { trackIndex: await indexOf(id) });
}

function verify(a: Wire): Wire {
  const issues: string[] = [];
  if (a.schema !== SCHEMA) issues.push('schema');
  for (const item of a.steps as Step[]) if (!item.ok) issues.push(`${item.profile} ${item.tool} failed`);
  for (const item of a.baselines as Wire[]) {
    if (!(item.sourceUnchanged && item.copyEmpty && item.addedEmpty)) issues.push(`baseline ${item.label}`);
  }
  const stable = totals(a.steps as Step[], STABLE_TOOL_PROFILE), native = totals(a.steps as Step[], AGENT_NATIVE_TOOL_PROFILE);
  if (JSON.stringify(stable) !== JSON.stringify(a.totals.stable)) issues.push('stable totals');
  if (JSON.stringify(native) !== JSON.stringify(a.totals.native)) issues.push('native totals');
  return { issues, stable, native, background: a.background, add: { plan: a.add.plan, events: a.add.events } };
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  try {
    switch (command) {
      case 'workflow': await workflow(args[0]!); break;
      case 'verify-offline': {
        const result = verify(JSON.parse(await readFile(join(args[0]!, 'workflow.json'), 'utf8')));
        console.log(JSON.stringify(result, null, 1));
        if (result.issues.length > 0) process.exitCode = 1;
        break;
      }
      default: throw new Error('usage: phase8h4d-workflow workflow|verify-offline <dir>');
    }
  } finally { await transport.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
