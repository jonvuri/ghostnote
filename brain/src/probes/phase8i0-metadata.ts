/**
 * 8i0 clip metadata and colour tolerance (E249, D42). Live driver, normal profile, owned unsaved project (refuses
 * the saved anchor, D29). It works only on a track that it adds, and deletes that track at the end.
 *
 *   colour <dir>    a live RGB sample across the byte range through set_launcher_clip_properties; writes
 *                   colour.json with the requested and observed bytes of each sample
 *   measure <dir>   the normal property path (name, colour, and length calls and one reversal) and the
 *                   duplicate extension path (copy, extend, and insert 153 notes, then reverse) from an
 *                   off-palette colour, 3 runs; writes measure.json with each wire sequence
 *
 * Each call records the wall time, the turns, the cold reads, the write stages, and the wire sequence
 * (method, start, duration). It also records the `cursor.setClipMetadata` frames that it sent.
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
type Rgb = { red: number; green: number; blue: number };
const SCHEMA = 'phase8i0-metadata-v1';
const ANCHOR = 'gn-scale-test';
const TRACK = 'gn-8i0-meta';
/** The E83 failure, an off-palette colour that reads back one byte low. */
const OFF_PALETTE: Rgb = { red: 145, green: 105, blue: 78 };

const say = (value: unknown): void => console.log(JSON.stringify(value));

/** Every `cursor.setClipMetadata` frame in the params of one wire call. */
function metadataFrames(value: unknown, out: Wire[] = []): Wire[] {
  if (Array.isArray(value)) for (const item of value) metadataFrames(item, out);
  else if (value !== null && typeof value === 'object') {
    const record = value as Wire;
    if (record.method === 'cursor.setClipMetadata') out.push(record.params);
    else for (const item of Object.values(record)) metadataFrames(item, out);
  }
  return out;
}

async function session() {
  const transport = new WireTransport();
  const adapter = new LiveAdapter({ transport });
  const workspace = workspaceOf({
    ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
    observationStore: new FakeObservationStore(),
  });
  const request = async (method: string, params?: Wire): Promise<Wire> =>
    await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
  const rows: Wire[] = [];
  const call = async (step: string, tool: string, args: Wire): Promise<Wire> => {
    const from = transport.calls.length;
    const started = performance.now();
    const result = await callTool(workspace, tool, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
    const ms = performance.now() - started;
    const calls = transport.calls.slice(from);
    const wire = wireSummary(calls);
    const row = { step, tool, ok: result.failure === undefined, ms: Math.round(ms), calls: calls.length,
      turns: wire.turns, wireMs: wire.wireMs, clipReads: wire.clipReads, stages: wire.stages,
      setters: calls.flatMap((item) => metadataFrames(item.params)),
      sequence: calls.map((item) => [item.method, Math.round(item.sent - started),
        Math.round((item.received < 0 ? item.sent : item.received) - item.sent)]) };
    rows.push(row);
    say({ ...row, sequence: undefined });
    assert(row.ok, `${step} ${tool}: ${JSON.stringify(result).slice(0, 800)}`);
    return result;
  };

  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [...NORMAL_8H4F]);
  const rig = await request('rig.info');
  assert.equal(rig.clipMetadataWrite, 'owned-fields-v1', 'deploy the 8i0 build');
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project) && mark.project !== ANCHOR, `use an owned unsaved project, got ${mark.project}`);
  await adapter.hello();
  const tracks = ((await request('track.list')).tracks as Wire[]).map((row) => row.name);
  assert(!tracks.includes(TRACK), `${TRACK} is left from an earlier run; delete it first`);
  const trackId = (await call('add-track', 'add_tracks', { tracks: [{ name: TRACK }] })).readback.tracks[0].trackId as string;
  const entry = { hello, project: mark.project, tracksBefore: tracks };
  return { call, rows, trackId, entry, request };
}

const props = (trackId: string, row: number, properties: Wire) => ({ clips: [{ trackId, row, properties }] });
const colorOf = (result: Wire): Rgb => result.readback.clips[0].properties.color;
const off = (a: Rgb, b: Rgb): number =>
  Math.max(Math.abs(a.red - b.red), Math.abs(a.green - b.green), Math.abs(a.blue - b.blue));

/** The requested sample: endpoints, single-channel extremes, the E83 cases, and a stride across the byte range. */
function samples(): Rgb[] {
  const out: Rgb[] = [
    { red: 0, green: 0, blue: 0 }, { red: 255, green: 255, blue: 255 }, OFF_PALETTE,
    { red: 145, green: 105, blue: 77 }, { red: 145, green: 105, blue: 79 }, { red: 0, green: 0, blue: 255 },
    { red: 255, green: 0, blue: 0 }, { red: 0, green: 255, blue: 0 }, { red: 127, green: 128, blue: 129 },
    { red: 1, green: 254, blue: 128 }, { red: 217, green: 46, blue: 36 }, { red: 68, green: 200, blue: 255 },
  ];
  for (let i = 0; i < 24; i += 1) {
    out.push({ red: (i * 37 + 5) % 256, green: (i * 91 + 17) % 256, blue: (i * 53 + 200) % 256 });
  }
  return out;
}

async function colour(dir: string): Promise<void> {
  const { call, rows, trackId, entry } = await session();
  const results: Wire[] = [];
  try {
    await call('add-clip', 'add_launcher_clip', { trackId, row: 0, document: typicalDesired() });
    const first = await call('read-default', 'set_launcher_clip_properties', props(trackId, 0, { name: 'gn-8i0' }));
    const initial = colorOf(first);
    results.push({ requested: null, observed: initial, note: 'default colour of a new clip' });
    // The default colour as an explicit request.
    for (const requested of [{ ...initial, blue: initial.blue === 0 ? 1 : initial.blue - 1 }, initial, ...samples()]) {
      const result = await call('colour', 'set_launcher_clip_properties', props(trackId, 0, { color: requested }));
      const observed = colorOf(result);
      results.push({ requested, observed, status: result.readback.status, maxOff: off(requested, observed) });
    }
  } finally {
    await call('delete-track', 'delete_track', { trackIds: [trackId] });
  }
  const measured = results.filter((item) => item.requested !== null);
  const summary = {
    samples: measured.length,
    exact: measured.filter((item) => item.maxOff === 0).length,
    withinOne: measured.filter((item) => item.maxOff <= 1).length,
    verified: measured.filter((item) => item.status === 'verified' || item.status === 'unchanged').length,
    worst: Math.max(...measured.map((item) => item.maxOff)),
  };
  say({ summary });
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'colour.json'), JSON.stringify({ schema: `${SCHEMA}-colour`, ...entry, summary, results,
    rows }, null, 1) + '\n');
}

async function measure(dir: string): Promise<void> {
  const { call, rows, trackId, entry } = await session();
  const runs: Wire[] = [];
  try {
    for (let run = 0; run < 3; run += 1) {
      const from = rows.length;
      await call('add-clip', 'add_launcher_clip', { trackId, row: 0, document: typicalDesired() });
      // Start from an off-palette colour, as the dogfood duplicate did.
      await call('setup-colour', 'set_launcher_clip_properties', props(trackId, 0, { color: OFF_PALETTE }));
      const name = await call('props-name', 'set_launcher_clip_properties', props(trackId, 0, { name: `gn-8i0-${run}` }));
      const length = await call('props-length', 'set_launcher_clip_properties', props(trackId, 0, { lengthBeats: 96 }));
      const colour = await call('props-colour', 'set_launcher_clip_properties',
        props(trackId, 0, { color: { red: 217, green: 46, blue: 36 } }));
      await call('props-revert', 'revert_change', { changeId: colour.effects[0].changeId });
      await call('props-revert-length', 'revert_change', { changeId: length.effects[0].changeId });

      // The dogfood path: duplicate the clip to an empty slot, extend it to twice its length, and add notes.
      await call('copy', 'copy_launcher_clips', { copies: [{ source: { trackId, row: 0 }, destination: { trackId, row: 1 } }] });
      const copyName = name.readback.clips[0].properties.name as string;
      const copied = await call('props-copy', 'set_launcher_clip_properties', props(trackId, 1, { name: copyName }));
      const read = await call('read-copy', 'read_launcher_clip', { trackId, row: 1 });
      const clipId = (parse(read.data.document as string, 'fields') as StateDocument).clips[0]!.id;
      const adds = Array.from({ length: 153 }, (_, k) =>
        `ADD x${k + 1} ${clipId} ${256 + k}/4 1/8 ${48 + (k * 7) % 36} ${70 + (k % 50)} ${1 + (k % 4)} false`);
      const patch = ['DOC ghostnote-document 1.0 patch',
        `BASE ${JSON.stringify({ sha256: read.authority.base.sha256, ref: read.authority.base.ref })}`,
        'FIELDS id clip at duration pitch velocity channel mute',
        `CLIP_UPDATE ${clipId} {"length":"128","loop":{"from":"0","to":"128"}}`, ...adds].join('\n') + '\n';
      const extended = await call('extend-insert-153', 'edit_launcher_clip', { trackId, row: 1, document: patch });
      assert.equal(extended.readback?.status, 'verified', JSON.stringify(extended.readback).slice(0, 600));
      const after = await call('read-extended', 'read_launcher_clip', { trackId, row: 1 });
      const props1 = await call('props-check', 'set_launcher_clip_properties', props(trackId, 1, { name: copyName }));
      await call('extend-revert', 'revert_change', { changeId: extended.effects[0].changeId });
      const reverted = await call('props-check-reverted', 'set_launcher_clip_properties',
        props(trackId, 1, { name: copyName }));
      runs.push({ run, colourAfterSetup: colorOf(name), colourOfCopy: colorOf(copied), colourAfterExtend: colorOf(props1),
        colourAfterRevert: colorOf(reverted), lengthAfterRevert: reverted.readback.clips[0].properties.lengthBeats,
        extendedLength: (parse(after.data.document as string, 'fields') as StateDocument).clips[0]!.length,
        rows: rows.slice(from).map((row) => row.step) });
      await call('delete-clips', 'delete_launcher_clip', { clips: [{ trackId, row: 0 }, { trackId, row: 1 }] });
    }
  } finally {
    await call('delete-track', 'delete_track', { trackIds: [trackId] });
  }
  for (const item of runs) {
    assert.deepEqual(item.colourAfterExtend, item.colourOfCopy, 'the extension wrote no colour');
    assert.deepEqual(item.colourAfterRevert, item.colourOfCopy, 'the reversal wrote no colour');
    assert.equal(item.lengthAfterRevert, 64);
  }
  const median = (step: string): number => {
    const values = rows.filter((row) => row.step === step).map((row) => row.ms).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)]!;
  };
  const summary = Object.fromEntries(['props-name', 'props-length', 'props-colour', 'props-revert', 'copy',
    'read-copy', 'extend-insert-153', 'extend-revert'].map((step) => [step, median(step)]));
  say({ summary, runs });
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'measure.json'), JSON.stringify({ schema: `${SCHEMA}-measure`, ...entry, summary, runs,
    rows }, null, 1) + '\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  const [mode, dir] = process.argv.slice(2);
  const run = mode === 'colour' ? colour : mode === 'measure' ? measure : undefined;
  if (run === undefined || dir === undefined) {
    console.error('usage: phase8i0-metadata.ts colour|measure <dir>');
    process.exit(2);
  }
  run(dir).then(() => process.exit(0), (error: unknown) => { console.error(error); process.exit(1); });
}
