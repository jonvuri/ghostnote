/**
 * 8h4c document edit limb. Live driver. Use an owned unsaved project; refuse the saved anchor (D29).
 * The identity registry is in process memory, so one `accept` run spans the operator steps. The driver detects
 * each operator step by polling host state; it prints the instruction and waits.
 *
 *   accept <dir>   create gn-8h4c-edit. Then, each from a rewritten typical clip with a palette colour:
 *                  A  sparse patches: add, remove, velocity, pitch, 1/512 nudge, expression, gain 0/0.5/8, properties;
 *                  B  the operator draws pressure on one note; a desired document replaces the clip around it;
 *                  C  refusals: pressure, repeat, overlap, past the clip end, a stale base (operator edit), a scene
 *                     append, and a project switch (operator). A raw read before and after shows no change;
 *                  D  cost of one read and one 16-note insertion; revert_change of a targeted and a whole-clip edit;
 *                     a concurrent edit blocks a reversal.
 *                  Every result is compared with an independent raw `clip.read`.
 *                  GN_8H4C_UNATTENDED=1 (8h4c2 rerun) skips the operator steps that add nothing new: the B pressure
 *                  steps and the C project switch. A raw writer-cursor note stands in for the C stale edit.
 *   pressure <dir> <inspector>   read the first note through both host routes after the operator set inspector
 *                 Pressure on it (E236: the host reports 0)
 *   worst <dir> [notes]   whole-clip replacement at the reader limits (default 131,072 notes over 8,192 beats)
 *   cost <dir>     profile one read and one 16-note insertion on a rewritten typical clip: executor phases and
 *                  wire calls (8h4c2)
 *   verify-offline <dir>  recompute the claims from the retained artifacts
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { decodeNoteFrame, type NoteFrame, type RawNoteFields } from '../adapters/live/clip-read.js';
import { clip, clipMetadata, scene, slot, supportedClipColors, track, type ClipAddress } from '../contract/index.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import type { E131Context } from './e131-diagnostic.js';
import { WireTransport } from './phase8h3c-promotion.js';
import { typicalNotes } from './phase8h3e-snapshots-lib.js';
import { parse, serialize, type Event, type StateDocument } from '../document/index.js';
import { NORMAL, agreement, eventKey, rawDiff, rowKey, type Wire } from './phase8h4b-document-read-lib.js';

const SCHEMA = 'phase8h4c-edit-v1';
const PAGE = 131_072;
const ANCHOR = 'gn-scale-test';
const NAME = 'gn-8h4c-edit';
const ROW = 0;
const transport = new WireTransport();
/** Executor phases and wire calls, for the `cost` profile (8h4c2). */
const phases: Wire[] = [];
const wire: Wire[] = [];
const send = transport.send.bind(transport);
transport.send = async (frame) => {
  const started = performance.now();
  try { return await send(frame); } finally { wire.push({ method: frame.method, at: started, ms: performance.now() - started }); }
};
const adapter = new LiveAdapter({ transport });
const stash = new Stash();
const workspace = workspaceOf({
  ready: async () => undefined, adapter, stash,
  executor: new Executor(adapter, { onTiming: (event) => phases.push({ ...event, at: performance.now() }) }),
  observationStore: new FakeObservationStore(),
});
const request = async (method: string, params?: Wire): Promise<Wire> =>
  await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
const tool = async (name: string, args: Wire): Promise<Wire> =>
  await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
const pause = async (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const say = (value: Wire): void => console.log(JSON.stringify(value));
const changes = (): number => workspace.changes.list().length;
const unattended = process.env.GN_8H4C_UNATTENDED === '1';

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
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], NORMAL);
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project) && mark.project !== ANCHOR, `use an owned unsaved project, got ${mark.project}`);
  const rig = await request('rig.info');
  assert.equal(rig.clipReader?.revision, 'clip-reader-v3');
  await adapter.hello();
  return { hello, mark, rig };
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
async function emptySlot(id: string, row: number): Promise<number> {
  const index = await indexOf(id);
  if ((await request('slot.status', { trackIndex: index, slotIndex: row })).hasContent === true) {
    await request('slot.delete', { trackIndex: index, slotIndex: row });
    await until(() => request('slot.status', { trackIndex: index, slotIndex: row }), value => value.hasContent !== true);
  }
  return index;
}
/** Give the clip an exact palette colour, so a property edit can be reversed (E83). */
async function paletteColour(id: string, row: number): Promise<void> {
  const target = await clipOf(id, row);
  const value = Object.values((await adapter.read([clipMetadata(target)])).entries)[0]!.value;
  assert(value.of === 'clipMetadata');
  const { red, green, blue } = supportedClipColors()[0]!;
  await adapter.apply({ ops: [{ op: 'clip.update', clip: target, metadata: { ...value.metadata, color: { red, green, blue } } }] });
  await adapter.settle('noteWrite'); await pause(300);
}
/** Write the typical clip (E231 density: 256 notes on 16 channels over 64 beats) with the fine writer cursor. */
async function writeTypical(id: string, row: number): Promise<RawNoteFields[]> {
  const index = await emptySlot(id, row);
  await request('clip.create', { trackIndex: index, slotIndex: row, lengthBeats: 64 });
  await until(() => request('slot.status', { trackIndex: index, slotIndex: row }), value => value.hasContent === true);
  await (adapter as unknown as E131Context).pointAtClip(await clipOf(id, row), index, new Map(), 'fine');
  await request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 / 4 });
  for (const [channel, notes] of typicalNotes(0).entries()) await request('cursor.setNotes', { cursor: 'fine', channel, notes });
  await pause(500);
  await paletteColour(id, row);
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
/** Wait for an operator edit: the raw read differs from `before` and holds for two more reads. */
async function operatorEdit(id: string, before: RawNoteFields[], step: string, instruction: string): Promise<RawNoteFields[]> {
  say({ operator: step, instruction });
  for (;;) {
    const now = await rawRead(id, ROW);
    if (!sameRows(before, now)) {
      await pause(1500);
      const settled = await rawRead(id, ROW);
      await pause(1500);
      if (sameRows(settled, await rawRead(id, ROW))) return settled;
    }
    await pause(500);
  }
}

// --- documents -------------------------------------------------------------------

const documentOf = (fields: string): StateDocument => parse(fields, 'fields') as StateDocument;
/** The event at a host channel and beat (the typical clip has one note per channel and beat). */
function at(document: StateDocument, hostChannel: number, beat: number): Event {
  const found = document.events.filter((event) => (event.channel ?? 1) - 1 === hostChannel
    && eventKey(event).endsWith(`:${beat * 512}`));
  assert.equal(found.length, 1, `one event on host channel ${hostChannel} at beat ${beat}`);
  return found[0]!;
}
function patchText(base: Wire, lines: string[]): string {
  return ['DOC ghostnote-document 1.0 patch', `BASE ${JSON.stringify({ sha256: base.sha256, ref: base.ref })}`,
    'FIELDS id clip at duration pitch velocity channel mute', ...lines].join('\n') + '\n';
}
const expression = (over: Wire = {}) => JSON.stringify({ velocitySpread: 0, gain: 1, pan: 0, pressure: 0, timbre: 0.5,
  transpose: 0, ...over });

/** Read through the tool, with wall time. */
async function read(id: string): Promise<Wire> {
  const started = performance.now();
  const result = await tool('read_launcher_clip', { trackId: id, row: ROW });
  assert.equal(result.failure, undefined, JSON.stringify(result).slice(0, 600));
  return { result, wallMs: performance.now() - started };
}

/** One edit through the tool, with wall time, the independent raw read, and its checks. */
async function edit(id: string, name: string, document: string, extra: Wire = {}): Promise<Wire> {
  const before = await rawRead(id, ROW);
  const changeCount = changes();
  const started = performance.now();
  const result = await tool('edit_launcher_clip', { trackId: id, row: ROW, document, readback: 'document', ...extra });
  const wallMs = performance.now() - started;
  const after = await rawRead(id, ROW);
  const record: Wire = { name, document, result, wallMs, before, after, changes: [changeCount, changes()],
    resultBytes: Buffer.byteLength(JSON.stringify(result)) };
  const issues = result.failure === undefined && result.readback?.document !== undefined
    ? agreement(result.readback.document, after) : [];
  say({ step: name, code: result.failure?.code, reason: result.detail?.reason, route: result.plan?.route,
    status: result.readback?.status, discrepancies: result.readback?.discrepancies?.length, agreement: issues.length,
    wallMs: Math.round(wallMs), toolMs: result.timing === undefined ? undefined : Math.round(result.timing.totalMs) });
  return record;
}

// --- accept -------------------------------------------------------------------------

async function accept(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const entry = await guard();
  const existing = ((await request('track.list')).tracks as Wire[]).find(row => row.name === NAME);
  const id = existing === undefined ? await createTrack(NAME) : String(existing.channelId);
  const resume = process.env.GN_8H4C_FROM === 'B';
  const out: Wire = resume
    ? { ...JSON.parse(gunzipSync(await readFile(join(dir, 'accept.json.gz'))).toString('utf8')), resumedAt: 'B', entryB: entry }
    : { schema: SCHEMA, entry, trackId: id, row: ROW };
  if (resume) assert.equal(out.trackId, id, 'resume needs the same fixture track');
  const save = async () => writeFile(join(dir, 'accept.json.gz'), gzipSync(JSON.stringify(out) + '\n'));
  if (!resume) await matrixA(id, out, save);

  // B. Bitwig does not report pressure (E236). The operator sets it and confirms it visually after a targeted
  // desired document replaces the clip around that note.
  const rawB = resume ? await rawRead(id, ROW) : await writeTypical(id, ROW);
  if (!resume && !unattended) await flag(dir, 'B-pressure', `In ${NAME}, open the clip in scene 1 in the editor. Select the first `
    + 'note: beat 1.1.1, pitch C1 (36), MIDI channel 1. In the inspector, set Pressure to about 50 percent.');
  assert.equal(rawB.length, 256, 'B starts from the typical clip');
  const readB = await read(id);
  const docB = documentOf(readB.result.data.document);
  const keep = at(docB, 0, 0);
  const desiredB: StateDocument = {
    ...docB, kind: 'desired', base: readB.result.authority.base,
    coverage: docB.coverage.map((item) => ({ ...item, fields: 'all' })),
    events: [keep, ...Array.from({ length: 16 }, (_, c) => ({
      id: `b${c + 1}`, clip: keep.clip, at: '17/8', duration: '1/4', pitch: 72 + c, velocity: 80 + c, channel: c + 1,
    }))],
  };
  const b = await edit(id, 'B-desired', serialize(desiredB, 'fields'));
  if (!unattended) await flag(dir, 'B-check', 'In the editor, select the first note (C1 at 1.1.1) again. Report the Pressure value '
    + 'that the inspector shows. The other 255 old notes are gone and 16 new notes stand near beat 1.3.');
  out.B = { rawB, read: readB, desired: b, pressureReported: process.env.GN_8H4C_PRESSURE ?? null };
  await save();
  await refusalsAndReversal(id, out, save, keep);
}

/** Wait for the operator: print the instruction, then wait for the flag file. */
async function flag(dir: string, step: string, instruction: string): Promise<void> {
  say({ operator: step, instruction, flag: join(dir, `go-${step}`) });
  for (;;) {
    try { await readFile(join(dir, `go-${step}`)); return; } catch { await pause(500); }
  }
}

async function matrixA(id: string, out: Wire, save: () => Promise<void>): Promise<void> {
  // A. Sparse patches from one rewritten clip. Each edit uses the base of the previous readback.
  out.rawA = await writeTypical(id, ROW);
  const first = await read(id);
  let base = first.result.authority.base;
  let document = documentOf(first.result.data.document);
  const clipId = document.clips[0]!.id;
  const steps: Wire[] = [];
  const step = async (name: string, lines: (doc: StateDocument) => string[], extra: Wire = {}) => {
    const record = await edit(id, name, patchText(base, lines(document)), extra);
    record.baseDocument = serialize(document, 'fields');
    steps.push(record);
    if (record.result.failure === undefined) {
      base = record.result.readback.base;
      document = documentOf(record.result.readback.document);
    }
    return record;
  };
  await step('A1-add', () => [`ADD a1 ${clipId} 1 1/2 80 90 1 false`]);
  await step('A2-remove', (doc) => [`REMOVE ${at(doc, 0, 60).id}`]);
  await step('A3-velocity', (doc) => [`UPDATE ${at(doc, 0, 8).id} {"velocity":64}`]);
  await step('A4-pitch', (doc) => [`UPDATE ${at(doc, 0, 12).id} {"pitch":37}`]);
  await step('A5-nudge', (doc) => [`UPDATE ${at(doc, 0, 16).id} {"at":"8193/512"}`]);
  await step('A6-expression', (doc) => [`UPDATE ${at(doc, 0, 20).id} {"expression":${expression({
    velocitySpread: 0.1, gain: 0.5, pan: -0.5, timbre: 0.25, transpose: 3 })}}`]);
  await step('A6-gain', (doc) => [
    `UPDATE ${at(doc, 0, 24).id} {"expression":${expression({ gain: 0 })}}`,
    `UPDATE ${at(doc, 0, 28).id} {"expression":${expression({ gain: 0.5 })}}`,
    `UPDATE ${at(doc, 0, 32).id} {"expression":${expression({ gain: 8 })}}`,
  ]);
  await step('A7-properties', () => [`CLIP_UPDATE ${clipId} {"name":"gn-8h4c-a7","length":"72","loop":{"from":"0","to":"72"}}`]);
  out.A = { first, steps };
  await save();
}

async function refusalsAndReversal(id: string, out: Wire, save: () => Promise<void>, keep: Event): Promise<void> {
  // C. Refusals. Each needs an unchanged raw read and no change record.
  const refusals: Wire[] = [];
  const refuse = async (name: string, document: string) => { const record = await edit(id, name, document); refusals.push(record); return record; };
  const readC = await read(id);
  const docC = documentOf(readC.result.data.document);
  const baseC = readC.result.authority.base;
  const plainC = docC.events.find((event) => event.id === 'b2')!;
  await refuse('C-pressure-value', patchText(baseC, [`UPDATE ${plainC.id} {"expression":${expression({ pressure: 0.3 })}}`]));
  await refuse('C-repeat', patchText(baseC, [
    `UPDATE ${plainC.id} {"repeat":{"enabled":true,"count":3,"curve":0,"velocityCurve":0,"velocityEnd":1}}`]));
  await refuse('C-overlap', patchText(baseC, [`ADD c1 ${keep.clip} 35/16 1 72 90 1 false`]));
  await refuse('C-past-end', patchText(baseC, [`ADD c2 ${keep.clip} 127/2 1 90 90 1 false`]));

  const staleRead = await read(id);
  const rawStale = await rawRead(id, ROW);
  if (unattended) await outsideNote(id, [14, 83, 90, 0.25]);
  else await operatorEdit(id, rawStale, 'C-stale', 'In the same clip, change the velocity of the note at pitch C4 (72), '
    + 'the lowest note of the stack near beat 1.3, to about 50 percent. Change nothing else.');
  const stale = await refuse('C-stale', patchText(staleRead.result.authority.base, [`UPDATE b1 {"velocity":30}`]));
  stale.staleDocument = stale.result.detail?.document;

  const sceneRead = await read(id);
  const scenes = Number((await request('scene.count')).sceneCount);
  await request('scene.create', { count: 1 });
  await until(() => request('scene.count'), value => Number(value.sceneCount) === scenes + 1);
  await pause(500);
  await refuse('C-scene', patchText(sceneRead.result.authority.base, [`UPDATE b1 {"velocity":31}`]));
  await request('scene.delete', { sceneIndex: scenes });
  await until(() => request('scene.count'), value => Number(value.sceneCount) === scenes);
  await pause(500);

  if (unattended) {
    out.C = { read: readC, refusals, skipped: ['C-project'] };
  } else {
    await projectSwitch(id, refusals);
    out.C = { read: readC, refusals };
  }
  await save();

  // D. Cost, reversal, and a blocked reversal.
  const rawD = await writeTypical(id, ROW);
  const costRead = await read(id);
  const docD = documentOf(costRead.result.data.document);
  const clipD = docD.clips[0]!.id;
  const insert = Array.from({ length: 16 }, (_, c) => `ADD i${c + 1} ${clipD} 33/2 1/4 96 100 ${c + 1} false`);
  const cost = await edit(id, 'D-cost-16-notes', patchText(costRead.result.authority.base, insert));
  out.D = { rawD, costRead: { wallMs: costRead.wallMs, toolMs: costRead.result.timing.totalMs }, cost };
  await reversals(id, out, save, clipD, cost);
}

/** C. The operator switches the project: the base ref is incomparable. */
async function projectSwitch(id: string, refusals: Wire[]): Promise<void> {
  const projectRead = await read(id);
  const project = String((await request('revision.get')).project);
  const rawProject = await rawRead(id, ROW);
  say({ operator: 'C-project', instruction: 'Switch Bitwig to another open project tab (or create one with File > New). '
    + `Stay there until the driver says to switch back to ${project}.` });
  await until(() => request('revision.get'), value => value.project !== project, 600_000);
  await pause(1500);
  const changeCount = changes();
  const switched = await tool('edit_launcher_clip', { trackId: id, row: ROW,
    document: patchText(projectRead.result.authority.base, [`UPDATE b1 {"velocity":32}`]) });
  say({ step: 'C-project', code: switched.failure?.code, stage: switched.failure?.stage });
  say({ operator: 'C-project-back', instruction: `Switch Bitwig back to ${project}.` });
  await until(() => request('revision.get'), value => value.project === project, 600_000);
  await pause(1500);
  await adapter.hello();
  refusals.push({ name: 'C-project', result: switched, before: rawProject, after: await rawRead(id, ROW),
    changes: [changeCount, changes()] });
}

/** A note written through the raw writer cursor: an edit outside Ghostnote. */
async function outsideNote(id: string, note: number[]): Promise<void> {
  await (adapter as unknown as E131Context).pointAtClip(await clipOf(id, ROW), await indexOf(id), new Map(), 'fine');
  await request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 / 4 });
  await request('cursor.setNotes', { cursor: 'fine', channel: 0, notes: [note] });
  await pause(800);
}

/** D. Reversal of a targeted and a whole-clip edit, and a concurrent edit that blocks a reversal. */
async function reversals(id: string, out: Wire, save: () => Promise<void>, clipD: string, cost: Wire): Promise<void> {
  const preTargeted = await rawRead(id, ROW);
  const docT = documentOf(cost.result.readback.document);
  const targeted = await edit(id, 'D-targeted', patchText(cost.result.readback.base, [
    `REMOVE ${at(docT, 1, 1 / 4).id}`, `UPDATE ${at(docT, 2, 1 / 2).id} {"pitch":99}`, `ADD t1 ${clipD} 3/2 1/2 77 70 4 false`]));
  const revertTargeted = await tool('revert_change', { changeId: targeted.result.effects[0].changeId });
  const afterTargeted = await rawRead(id, ROW);
  say({ step: 'D-revert-targeted', applied: revertTargeted.applied, restored: sameRows(preTargeted, afterTargeted) });

  const wholeRead = await read(id);
  const docW = documentOf(wholeRead.result.data.document);
  const preWhole = await rawRead(id, ROW);
  const whole = await edit(id, 'D-whole', patchText(wholeRead.result.authority.base, [`UPDATE ${at(docW, 3, 3 / 4).id} {"velocity":45}`]));
  const revertWhole = await tool('revert_change', { changeId: whole.result.effects[0].changeId });
  const afterWhole = await rawRead(id, ROW);
  say({ step: 'D-revert-whole', applied: revertWhole.applied, restored: sameRows(preWhole, afterWhole) });

  const concurrentRead = await read(id);
  const concurrent = await edit(id, 'D-concurrent-edit', patchText(concurrentRead.result.authority.base,
    [`ADD k1 ${clipD} 5/2 1/2 81 90 1 false`]));
  // A concurrent edit outside Ghostnote, in the same channel.
  await outsideNote(id, [14, 83, 90, 0.25]);
  const preBlocked = await rawRead(id, ROW);
  const revertBlocked = await tool('revert_change', { changeId: concurrent.result.effects[0].changeId });
  const afterBlocked = await rawRead(id, ROW);
  say({ step: 'D-revert-blocked', applied: revertBlocked.applied, unchanged: sameRows(preBlocked, afterBlocked) });
  out.D = { ...out.D, preTargeted, targeted, revertTargeted, afterTargeted, preWhole, whole, revertWhole, afterWhole,
    concurrent, preBlocked, revertBlocked, afterBlocked };
  await save();

  // Cleanup: the fixture track. The operator closes the project without saving.
  await request('track.delete', { trackIndex: await indexOf(id) });
  out.stats = (await request('rig.stats')).clipReader;
  await save();
  const result = verify(out);
  console.log(JSON.stringify(result, null, 1));
  if (result.issues.length > 0) process.exitCode = 1;
}

/** Recompute every claim from the artifact. */
export function verify(a: Wire): { issues: string[]; summary: Wire } {
  const issues: string[] = [];
  const applied = (record: Wire, route: string) => {
    const r = record.result;
    if (r.failure !== undefined) { issues.push(`${record.name}: failed ${r.failure.code} ${r.message}`); return; }
    if (r.plan.route !== route) issues.push(`${record.name}: route ${r.plan.route}, expected ${route}`);
    if (r.readback.status !== 'verified') issues.push(`${record.name}: readback ${r.readback.status}`);
    // Matrix A ran before the pressure warning existed (E236); it applies from B onward.
    const warned = (r.warnings ?? []).some((item: Wire) => item.code === 'pressure-unobservable');
    if (!String(record.name).startsWith('A') && warned !== (route === 'whole-clip')) {
      issues.push(`${record.name}: pressure warning ${warned}`);
    }
    if (r.readback.discrepancies.length > 0) issues.push(`${record.name}: ${JSON.stringify(r.readback.discrepancies).slice(0, 300)}`);
    issues.push(...agreement(r.readback.document, record.after).map((issue) => `${record.name}: ${issue}`));
    if (record.changes[1] !== record.changes[0] + (route === 'none' && r.effects.length === 0 ? 0 : 1)) {
      issues.push(`${record.name}: change records ${record.changes}`);
    }
  };
  /** IDs before and after an edit: every unnamed event keeps its ID. */
  const ids = (record: Wire, expect: { removed?: string[]; added?: string[]; kept?: string[] }) => {
    const before = documentOf(record.baseDocument);
    const after = documentOf(record.result.readback.document);
    const afterIds = new Set(after.events.map((event) => event.id));
    for (const event of before.events) {
      if (expect.removed?.includes(event.id)) { if (afterIds.has(event.id)) issues.push(`${record.name}: ${event.id} not removed`); continue; }
      if (!afterIds.has(event.id)) issues.push(`${record.name}: lost ID ${event.id}`);
    }
    for (const id of expect.added ?? []) if (!afterIds.has(id)) issues.push(`${record.name}: no added ID ${id}`);
    if (after.events.length !== before.events.length - (expect.removed?.length ?? 0) + (expect.added?.length ?? 0)) {
      issues.push(`${record.name}: event count ${after.events.length}`);
    }
  };
  const [a1, a2, a3, a4, a5, a6, a6g, a7] = a.A.steps as Wire[];
  applied(a1!, 'targeted'); ids(a1!, { added: ['a1'] });
  applied(a2!, 'targeted'); ids(a2!, { removed: [documentOf(a2!.baseDocument).events.find((e) => eventKey(e) === `0:${36 + (15 * 16) % 48}:${60 * 512}`)?.id ?? '?'] });
  applied(a3!, 'whole-clip'); ids(a3!, {});
  applied(a4!, 'targeted'); ids(a4!, {});
  applied(a5!, 'targeted'); ids(a5!, {});
  applied(a6!, 'whole-clip'); ids(a6!, {});
  applied(a6g!, 'whole-clip'); ids(a6g!, {});
  applied(a7!, 'none'); ids(a7!, {});
  const gains = (a6g!.after as RawNoteFields[]).filter((row) => row.channel === 0 && [24, 28, 32].includes(Number(row.cell) / 512))
    .map((row) => row.gain);
  if (JSON.stringify(gains) !== JSON.stringify([1e-323, Math.cbrt(0.5), 2])) issues.push(`gain raw ${JSON.stringify(gains)}`);
  const a7doc = documentOf(a7!.result.readback.document).clips[0]!;
  if (a7doc.name !== 'gn-8h4c-a7' || a7doc.length !== '72') issues.push(`A7 clip ${JSON.stringify(a7doc)}`);
  // Moved notes keep their ID at the new cell.
  const moved = (record: Wire, key: string) => {
    const id = documentOf(record.result.readback.document).events.find((event) => eventKey(event) === key)?.id;
    const prior = documentOf(record.baseDocument).events.map((event) => event.id);
    if (id === undefined || !prior.includes(id)) issues.push(`${record.name}: moved note at ${key} has ID ${id}`);
  };
  moved(a4!, `0:37:${12 * 512}`);
  moved(a5!, `0:${36 + (4 * 16) % 48}:8193`);

  const b = a.B.desired;
  applied(b, 'targeted');
  const keptBefore = (a.B.rawB as RawNoteFields[]).find((row) => row.channel === 0 && row.cell === 0 && row.pitch === 36);
  const keptAfter = (b.after as RawNoteFields[]).find((row) => row.channel === 0 && row.cell === 0 && row.pitch === 36);
  if (JSON.stringify(keptBefore) !== JSON.stringify(keptAfter)) issues.push('B: the kept note changed');
  if ((b.result.warnings ?? []).length > 0) issues.push('B: the targeted route warned');
  if ((b.after as RawNoteFields[]).length !== 17) issues.push(`B: ${b.after.length} notes`);
  if (new Set((b.after as RawNoteFields[]).map((row) => row.channel)).size !== 16) issues.push('B: not all 16 channels');

  const expected: Record<string, [string, string?]> = {
    'C-pressure-value': ['unsupported', 'pressure'],
    'C-repeat': ['unsupported', 'repeat'], 'C-overlap': ['unsupported', 'overlap'], 'C-past-end': ['range', 'past-clip-end'],
    'C-stale': ['stale'], 'C-scene': ['identity-changed'], 'C-project': ['incomparable'],
  };
  const skipped: string[] = a.C.skipped ?? [];
  for (const name of Object.keys(expected)) {
    if (!skipped.includes(name) && !(a.C.refusals as Wire[]).some((record) => record.name === name)) issues.push(`${name}: missing`);
  }
  for (const record of a.C.refusals as Wire[]) {
    const [code, reason] = expected[record.name]!;
    if (record.result.failure?.code !== code) issues.push(`${record.name}: code ${record.result.failure?.code}`);
    if (reason !== undefined && record.result.detail?.reason !== reason) issues.push(`${record.name}: reason ${record.result.detail?.reason}`);
    if ((record.result.failure?.effects ?? []).length > 0) issues.push(`${record.name}: effects`);
    if (!sameRows(record.before, record.after)) issues.push(`${record.name}: the raw read changed`);
    if (record.changes[0] !== record.changes[1]) issues.push(`${record.name}: a change was recorded`);
  }
  const stale = (a.C.refusals as Wire[]).find((record) => record.name === 'C-stale')!;
  if (typeof stale.staleDocument !== 'string') issues.push('C-stale: no new document');

  const d = a.D;
  applied(d.cost, 'targeted');
  applied(d.targeted, 'targeted');
  applied(d.whole, 'whole-clip');
  applied(d.concurrent, 'targeted');
  if (d.revertTargeted.applied !== true || !sameRows(d.preTargeted, d.afterTargeted)) issues.push('D: targeted reversal');
  if (d.revertWhole.applied !== true || !sameRows(d.preWhole, d.afterWhole)) issues.push('D: whole-clip reversal');
  if (d.revertBlocked.applied === true || !sameRows(d.preBlocked, d.afterBlocked)) issues.push('D: concurrent edit did not block');

  const timing = (record: Wire) => ({ wallMs: Math.round(record.wallMs), ...Object.fromEntries(
    Object.entries(record.result.timing ?? {}).map(([key, value]) => [key, Math.round(Number(value))])) });
  return {
    issues,
    summary: {
      cost: { readWallMs: Math.round(d.costRead.wallMs), edit: timing(d.cost),
        totalMs: Math.round(d.costRead.wallMs + d.cost.wallMs), e121ApplyMs: 16_044, targetMs: 8_000 },
      steps: [...a.A.steps, b, d.targeted, d.whole].map((record: Wire) => ({ name: record.name, route: record.result.plan?.route,
        ...timing(record), resultBytes: record.resultBytes })),
      refusals: (a.C.refusals as Wire[]).map((record) => [record.name, record.result.failure?.code, record.result.detail?.reason]),
      reversal: { targeted: d.revertTargeted.applied, whole: d.revertWhole.applied, blocked: d.revertBlocked.applied ?? false,
        blockedReason: d.revertBlocked.nothingToPutBack ?? d.revertBlocked.why ?? null },
    },
  };
}

// --- cost profile ------------------------------------------------------------------------

async function cost(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const entry = await guard();
  const existing = ((await request('track.list')).tracks as Wire[]).find(row => row.name === NAME);
  const id = existing === undefined ? await createTrack(NAME) : String(existing.channelId);
  const runs: Wire[] = [];
  for (let run = 0; run < 3; run += 1) {
    await writeTypical(id, ROW);
    phases.length = 0; wire.length = 0;
    const started = performance.now();
    const first = await read(id);
    const clipId = documentOf(first.result.data.document).clips[0]!.id;
    const insert = Array.from({ length: 16 }, (_, c) => `ADD i${c + 1} ${clipId} 33/2 1/4 96 100 ${c + 1} false`);
    const result = await tool('edit_launcher_clip', { trackId: id, row: ROW, document: patchText(first.result.authority.base, insert) });
    const totalMs = performance.now() - started;
    assert.equal(result.readback?.status, 'verified', JSON.stringify(result).slice(0, 400));
    const at = (value: number) => Math.round(value - started);
    const record = { totalMs, readMs: first.wallMs, timing: result.timing,
      phases: phases.map((item) => ({ phase: item.phase, ms: Math.round(item.elapsedMs), end: at(item.at) })),
      wire: wire.map((item) => ({ method: item.method, start: at(item.at), ms: Math.round(item.ms) })) };
    runs.push(record);
    const byMethod = new Map<string, number>();
    for (const item of record.wire) byMethod.set(item.method, (byMethod.get(item.method) ?? 0) + item.ms);
    say({ run, totalMs: Math.round(totalMs), timing: result.timing, phases: record.phases,
      wire: Object.fromEntries([...byMethod].sort((a, b) => b[1] - a[1]).slice(0, 8)), calls: record.wire.length });
  }
  await writeFile(join(dir, 'cost.json'), JSON.stringify({ schema: `${SCHEMA}-cost`, entry, trackId: id, runs }, null, 1) + '\n');
  await request('track.delete', { trackIndex: await indexOf(id) });
}

// --- pressure observability -------------------------------------------------------------

/**
 * The operator set inspector Pressure on the first note of the gn-8h4c-edit clip. Read that note through both
 * host routes: the cold `clip.read` capture and `cursor.getNotesVerbose` on a pinned cursor, three times each.
 */
async function pressure(dir: string, inspector: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const entry = await guard();
  const found = ((await request('track.list')).tracks as Wire[]).find(row => row.name === NAME);
  assert(found !== undefined, `${NAME} is missing`);
  const id = String(found.channelId);
  const cold: Wire[] = [];
  const verbose: Wire[] = [];
  for (let i = 0; i < 3; i++) {
    cold.push((await rawRead(id, ROW)).find((row) => row.channel === 0 && row.cell === 0 && row.pitch === 36)!);
    await (adapter as unknown as E131Context).pointAtClip(await clipOf(id, ROW), await indexOf(id), new Map(), 'fine');
    await request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 / 4 });
    const notes = (await request('cursor.getNotesVerbose', { cursor: 'fine', channel: 0 })).notes as Wire[];
    verbose.push(notes.find((note) => note.x === 0 && note.y === 36)!);
    await pause(500);
  }
  const out = { schema: `${SCHEMA}-pressure`, entry, trackId: id, inspector, cold, verbose };
  await writeFile(join(dir, 'pressure.json'), JSON.stringify(out, null, 1) + '\n');
  say({ step: 'pressure', inspector, cold: cold.map((row) => row.pressure), verbose: verbose.map((note) => note.pressure) });
}

// --- worst case -----------------------------------------------------------------------

/** Whole-clip replacement at the reader limits: 16 channels, one note per beat, over 8,192 beats. */
async function worst(dir: string, count: number): Promise<void> {
  await mkdir(dir, { recursive: true });
  const entry = await guard();
  const existing = ((await request('track.list')).tracks as Wire[]).find(row => row.name === 'gn-8h4c-worst');
  const id = existing === undefined ? await createTrack('gn-8h4c-worst') : String(existing.channelId);
  const perChannel = Math.ceil(count / 16);
  const lengthBeats = Math.max(64, perChannel);
  const index = await emptySlot(id, ROW);
  await request('clip.create', { trackIndex: index, slotIndex: ROW, lengthBeats });
  await until(() => request('slot.status', { trackIndex: index, slotIndex: ROW }), value => value.hasContent === true);
  await (adapter as unknown as E131Context).pointAtClip(await clipOf(id, ROW), index, new Map(), 'fine');
  await request('cursor.setStepSize', { cursor: 'fine', stepSize: 1 });
  const writeStarted = performance.now();
  let written = 0;
  for (let channel = 0; channel < 16 && written < count; channel += 1) {
    // The fine writer window is 2,048 steps: scroll it, then write window-relative steps.
    for (let from = 0; from < perChannel && written < count; from += 2048) {
      await request('cursor.scrollToStep', { cursor: 'fine', step: from });
      const notes = Array.from({ length: Math.min(2048, perChannel - from, count - written) },
        (_, k) => [k, 36 + ((from + k + channel) % 48), 100, 0.25]);
      await request('cursor.setNotes', { cursor: 'fine', channel, notes });
      written += notes.length;
    }
  }
  await pause(2000);
  await paletteColour(id, ROW);
  const fixtureMs = performance.now() - writeStarted;
  const before = await rawRead(id, ROW);
  say({ step: 'worst-fixture', requested: count, written, read: before.length, lengthBeats, fixtureMs: Math.round(fixtureMs) });
  const readStarted = performance.now();
  const first = await tool('read_launcher_clip', { trackId: id, row: ROW });
  const readWallMs = performance.now() - readStarted;
  assert.equal(first.failure, undefined, JSON.stringify(first).slice(0, 600));
  const document = documentOf(first.data.document);
  // Every velocity changes: a field-only change of every note rewrites the whole clip.
  const desired: StateDocument = {
    ...document, kind: 'desired', base: first.authority.base,
    coverage: document.coverage.map((item) => ({ ...item, fields: 'all' })),
    events: document.events.map((event) => ({ ...event, velocity: event.velocity === 100 ? 90 : 100 })),
  };
  const text = serialize(desired, 'fields');
  const started = performance.now();
  const result = await tool('edit_launcher_clip', { trackId: id, row: ROW, document: text });
  const editWallMs = performance.now() - started;
  const after = await rawRead(id, ROW);
  const changed = after.filter((row) => Math.round(Number(row.velocity) * 127) === 90).length;
  const out = { schema: `${SCHEMA}-worst`, entry, trackId: id, requested: count, written, lengthBeats, fixtureMs,
    readWallMs, readToolMs: first.timing?.totalMs, documentBytes: Buffer.byteLength(text), editWallMs,
    result: { ...result, readback: result.readback === undefined ? undefined : { ...result.readback, document: undefined } },
    rawBefore: before.length, rawAfter: after.length, velocity90: changed };
  await writeFile(join(dir, `worst-${count}.json.gz`), gzipSync(JSON.stringify(out) + '\n'));
  say({ step: 'worst', notes: before.length, code: result.failure?.code, reason: result.detail?.reason,
    route: result.plan?.route, status: result.readback?.status, readWallMs: Math.round(readWallMs),
    editWallMs: Math.round(editWallMs), timing: result.timing, documentBytes: Buffer.byteLength(text) });
  await request('track.delete', { trackIndex: await indexOf(id) });
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  try {
    switch (command) {
      case 'accept': await accept(args[0]!); break;
      case 'worst': await worst(args[0]!, Number(args[1] ?? 131_072)); break;
      case 'pressure': await pressure(args[0]!, args[1] ?? ''); break;
      case 'cost': await cost(args[0]!); break;
      case 'verify-offline': {
        const a = JSON.parse(gunzipSync(await readFile(join(args[0]!, 'accept.json.gz'))).toString('utf8'));
        const result = verify(a);
        console.log(JSON.stringify(result, null, 1));
        if (result.issues.length > 0) process.exitCode = 1;
        break;
      }
      default: throw new Error('usage: phase8h4c-edit accept|worst|verify-offline <dir>');
    }
  } finally { await transport.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
