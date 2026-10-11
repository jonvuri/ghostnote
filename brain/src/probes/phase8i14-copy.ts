/**
 * 8i14 clip copy to any row (E263). Live driver for the owned project gn-scale-test, scratch tracks only.
 *
 *   probe <dir>    research profile (`ghostnote probe`): the raw `slot.copyTo` cases. The driver reads every slot of
 *                  every track, the track list, the scene count, the selection, and the content events before and
 *                  after each case. A copy is proved by occupancy and by the clip content, not by the reply.
 *   restore-scenes delete the empty scenes after the baseline rows (a failed run).
 *   accept <dir>   normal profile, 8i14 build: `copy_launcher_clips` to a row that is not the next row, the
 *                  refusals, the reverts, and the measurements of one clip and of the largest admitted case.
 *
 * Each mode adds and deletes its own tracks (`gn-8i14-*`). The playing-source case leaves the transport playing;
 * the operator stops it.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { clip as clipAt, clipLaunch, scene as sceneAt, slot as slotAt, track as trackAt } from '../contract/address.js';
import { addressKey } from '../contract/index.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { WireTransport } from './phase8h3c-promotion.js';
import { NORMAL_8I14 } from './phase8h4f-measure.js';
import { typicalDesired, wireSummary, worstDesired } from './phase8h4g-inventory.js';

type Wire = Record<string, any>;
const SCHEMA = 'phase8i14-copy-v1';
const ANCHOR = 'gn-scale-test';
const PREFIX = 'gn-8i14-';
/** The scene count of the gn-scale-test baseline. */
const SCENES = 10;
const say = (value: unknown): void => console.log(JSON.stringify(value));
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A small clip: four notes from `pitch`. */
function smallDesired(pitch: number): string {
  const events = [0, 1, 2, 3].map((beat) => `EVENT n${beat} c1 ${beat} 1/2 ${pitch + beat} ${80 + beat} 1`);
  return ['DOC ghostnote-document 1.0 desired', 'CLIP {"id":"c1","length":"4","loop":{"from":"0","to":"4"}}',
    'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"c1","fields":"all","status":"complete","from":"0","to":"4"}',
    'FIELDS id clip at duration pitch velocity channel', ...events].join('\n') + '\n';
}

function session() {
  const transport = new WireTransport();
  const adapter = new LiveAdapter({ transport });
  const workspace = workspaceOf({
    ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
    observationStore: new FakeObservationStore(),
  });
  const request = async (method: string, params?: Wire): Promise<Wire> =>
    await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
  const tool = async (name: string, args: Wire): Promise<Wire> =>
    await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const must = async (name: string, args: Wire): Promise<Wire> => {
    const result = await tool(name, args);
    assert(result.failure === undefined, `${name}: ${JSON.stringify(result).slice(0, 800)}`);
    return result;
  };
  const tracks = async (): Promise<Wire[]> => (await request('track.list')).tracks as Wire[];
  const indexOf = async (trackId: string): Promise<number> => {
    const row = (await tracks()).find((item) => item.channelId === trackId);
    assert(row !== undefined, `no track ${trackId}`);
    return row.index as number;
  };
  /** The occupancy of every slot of every track that has slots: `name: x..x......`. Calls sent together. */
  const grid = async (): Promise<Record<string, string>> => {
    const list = (await tracks()).filter((row) => row.type !== 'Master' && row.type !== 'Effect');
    const scenes = (await request('scene.count')).sceneCount as number;
    const cells = await Promise.all(list.flatMap((row) => Array.from({ length: scenes }, (_, index) =>
      request('slot.status', { trackIndex: row.index, slotIndex: index }).catch(() => ({ hasContent: null })))));
    return Object.fromEntries(list.map((row, n) => [`${row.name}#${row.channelId.slice(0, 4)}`,
      cells.slice(n * scenes, (n + 1) * scenes).map((cell) => cell.hasContent === true ? 'x'
        : cell.hasContent === false ? '.' : '?').join('')]));
  };
  const selection = async (): Promise<Wire> => {
    const s = await request('selection.status');
    return { track: s.trackIndex, slot: s.slotIndex, mixer: s.mixerChannelId };
  };
  /** The observable state around one case. */
  const state = async (): Promise<Wire> => {
    const mark = await request('revision.get');
    return { tracks: (await tracks()).map((row) => `${row.index}:${row.name}:${row.type}:${row.channelId.slice(0, 4)}`),
      scenes: (await request('scene.count')).sceneCount, grid: await grid(), selection: await selection(),
      contentEpoch: mark.contentEpoch, sceneEpoch: mark.sceneEpoch, revision: mark.revision,
      events: mark.contentEvents ?? mark.events };
  };
  /** The content of one clip: the host metadata, the launch settings, and the notes of each channel. */
  const content = async (trackId: string, row: number): Promise<Wire> => {
    const read = await tool('read_launcher_clip', { trackId, row, format: 'json', diagnostic: true });
    if (read.failure !== undefined) return { failure: read.failure.code, message: read.failure.message };
    if (read.diagnostic === undefined) return { occupancy: read.data?.occupancy ?? 'unknown' };
    const mark = await workspace.mark();
    const address = clipLaunch(clipAt(slotAt(trackAt(trackId), sceneAt(row, mark.sceneEpoch))));
    const launch = (await adapter.read([address])).entries[addressKey(address)]?.value as Wire | undefined;
    const channels = read.diagnostic.channels as Wire[];
    return { metadata: read.diagnostic.metadata, launch: launch?.launch ?? null,
      notes: channels.reduce((sum, item) => sum + item.notes.length, 0), channels: channels.length,
      body: JSON.stringify(channels) };
  };
  const same = (left: Wire, right: Wire): boolean => JSON.stringify(left) === JSON.stringify(right);
  /** Delete the scenes that a case added after the baseline rows. Refuse when one of them holds a clip. */
  const restoreScenes = async (): Promise<Wire> => {
    const scenes = (await request('scene.count')).sceneCount as number;
    if (scenes <= SCENES) return { scenes, deleted: 0 };
    const held = Object.entries(await grid()).filter(([, column]) => column.slice(SCENES).includes('x')).map(([name]) => name);
    assert.deepEqual(held, [], 'an added scene holds a clip; remove it by hand');
    const rows = Array.from({ length: scenes - SCENES }, (_, index) => scenes - 1 - index);
    const result = await must('delete_scene', { rows });
    return { scenes: (await request('scene.count')).sceneCount, deleted: rows.length, status: result.readback?.status };
  };
  return { transport, adapter, workspace, request, tool, must, tracks, indexOf, grid, selection, state, content, same, restoreScenes };
}

/** The slots that differ between two grids: `name#id:row before>after`. */
function gridDelta(before: Record<string, string>, after: Record<string, string>): string[] {
  const out: string[] = [];
  for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[name] ?? '', b = after[name] ?? '';
    for (let row = 0; row < Math.max(a.length, b.length); row += 1) {
      if (a[row] !== b[row]) out.push(`${name}:${row} ${a[row] ?? '-'}>${b[row] ?? '-'}`);
    }
  }
  return out;
}

async function requireAnchor(s: ReturnType<typeof session>, profile: string): Promise<Wire> {
  const hello = await s.request('contract.hello');
  assert.equal(hello.runtimeProfile, profile, `replace the controller: profile ${profile} is required`);
  const project = (await s.request('selection.status')).project;
  assert.equal(project, ANCHOR, `the owned project ${ANCHOR} is required, not ${project}`);
  assert.equal((await s.request('scene.count')).sceneCount, SCENES, 'the entry scene count');
  assert(!(await s.tracks()).some((row) => String(row.name).startsWith(PREFIX)), `a ${PREFIX} track is left; delete it first`);
  return hello;
}

async function probe(dir: string): Promise<void> {
  const s = session();
  const hello = await requireAnchor(s, 'phase-8-probe-v1');
  assert(((await s.request('rig.methods')).methods as string[]).includes('slot.copyTo'), 'deploy the 8i14 probe build');
  await s.adapter.hello();
  const rig = await s.request('rig.info');
  const entry = await s.state();
  const cases: Wire[] = [];
  const results: Wire = { schema: SCHEMA, mode: 'probe', hello, window: { tracks: rig.tracks, scenes: rig.scenes }, entry, cases };
  const save = async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'probe.json'), `${JSON.stringify(results, null, 2)}\n`);
  };
  const scratch: Record<string, string> = {};
  try {
    const added = await s.must('add_tracks', { tracks: [{ name: `${PREFIX}a` }, { name: `${PREFIX}b` },
      { name: `${PREFIX}audio`, kind: 'audio' }, { name: `${PREFIX}big` }] });
    for (const [n, key] of ['a', 'b', 'audio', 'big'].entries()) scratch[key] = added.readback.tracks[n].trackId;
    const { a, b, audio, big } = scratch as Record<'a' | 'b' | 'audio' | 'big', string>;

    // The rich source: notes on all 16 channels, and no clip field at its default.
    await s.must('add_launcher_clip', { trackId: a, row: 0, document: typicalDesired(), format: 'fields' });
    await s.must('set_launcher_clip_properties', { clips: [{ trackId: a, row: 0, properties: {
      name: 'gn-rich', color: { red: 20, green: 160, blue: 90 }, playStartBeats: 4, loopEnabled: false } }] });
    await s.must('set_launcher_clip_launch_settings', { clips: [{ trackId: a, row: 0, quantization: '1/4',
      mode: 'synced', useLoopStartAsQuantizationReference: true }] });
    await s.must('add_launcher_clip', { trackId: a, row: 5, document: smallDesired(60), format: 'fields' });
    await s.must('set_launcher_clip_properties', { clips: [{ trackId: a, row: 5, properties: { name: 'gn-small' } }] });
    const rich = await s.content(a, 0);
    const small = await s.content(a, 5);
    results.sources = { rich: { ...rich, body: undefined }, small: { ...small, body: undefined } };
    assert.equal(rich.channels, 16, 'the rich source has notes on 16 channels');

    interface Case { name: string; from: [string, number]; to: [string, number]; more?: [string, number][];
      expect?: Wire; undo?: boolean; waitMs?: number }
    /** One raw copy with the state before and after. `expect` is the source content that the destination must equal. */
    const run = async (item: Case): Promise<Wire> => {
      const params: Wire = { trackIndex: await s.indexOf(item.from[0]), slotIndex: item.from[1],
        toTrackIndex: await s.indexOf(item.to[0]), toSlotIndex: item.to[1] };
      if (item.more !== undefined) {
        params.sources = await Promise.all(item.more.map(async ([id, row]) => ({ trackIndex: await s.indexOf(id), slotIndex: row })));
      }
      const before = await s.state();
      const started = performance.now();
      let reply: Wire;
      try { reply = await s.request('slot.copyTo', params); } catch (error) { reply = { threw: String(error) }; }
      const replyMs = Math.round(performance.now() - started);
      // The first change of any slot or of the scene count, then a settle.
      let changedMs: number | null = null;
      for (let n = 0; n < 60 && changedMs === null; n += 1) {
        const now = await s.request('revision.get');
        if (now.contentEpoch !== before.contentEpoch || now.sceneEpoch !== before.sceneEpoch) {
          changedMs = Math.round(performance.now() - started);
        } else await pause(25);
      }
      await pause(item.waitMs ?? 400);
      const after = await s.state();
      const row: Wire = { case: item.name, params, reply, replyMs, changedMs,
        slots: gridDelta(before.grid, after.grid), tracksSame: s.same(before.tracks, after.tracks),
        scenes: [before.scenes, after.scenes], contentEvents: after.contentEpoch - before.contentEpoch,
        events: ((after.events ?? []) as Wire[]).filter((event) => event.seq > before.contentEpoch)
          .map((event) => `${event.trackIndex}:${event.slotIndex}:${event.filled ? 'filled' : 'emptied'}`),
        revision: [before.revision, after.revision],
        selection: { before: before.selection, after: after.selection, kept: s.same(before.selection, after.selection) } };
      const landed = (after.grid[Object.keys(after.grid).find((key) => key.endsWith(`#${item.to[0].slice(0, 4)}`))!] ?? '')[item.to[1]];
      row.destination = landed === 'x' ? 'occupied' : landed === '.' ? 'empty' : 'no-slot';
      if (item.expect !== undefined && landed === 'x') {
        const copy = await s.content(item.to[0], item.to[1]);
        row.copy = { ...copy, body: undefined };
        row.equal = { metadata: s.same(copy.metadata, item.expect.metadata), launch: s.same(copy.launch, item.expect.launch),
          notes: copy.body === item.expect.body };
        const source = await s.content(item.from[0], item.from[1]);
        row.sourceKept = s.same(source, item.expect);
      }
      if (item.undo === true && (row.slots.length > 0 || before.scenes !== after.scenes || !row.tracksSame)) {
        row.undo = await s.request('app.undo', { times: 1 });
        await pause(500);
        const undone = await s.state();
        row.undone = { slots: gridDelta(before.grid, undone.grid), scenes: undone.scenes, tracksSame: s.same(before.tracks, undone.tracks) };
      }
      cases.push(row);
      say({ ...row, copy: undefined });
      await save();
      return row;
    };

    // Same track, an empty row that is not the next row: down, then up.
    await run({ name: 'same-track-down', from: [a, 0], to: [a, 2], expect: rich });
    await run({ name: 'same-track-up', from: [a, 5], to: [a, 3], expect: small });
    // Another instrument track: the same row, then another row.
    await run({ name: 'other-track-same-row', from: [a, 0], to: [b, 0], expect: rich });
    await run({ name: 'other-track-other-row', from: [a, 0], to: [b, 4], expect: rich });
    // An occupied destination (row 2 holds the rich copy): is it replaced, and does an event fire?
    const replaced = await run({ name: 'occupied-destination', from: [a, 5], to: [a, 2], expect: small });
    replaced.replacedContent = replaced.equal;
    // Occupied rows before and after the destination (rows 3 and 5 hold the small clip).
    const neighbours = [await s.content(a, 3), await s.content(a, 5)];
    const boundary = await run({ name: 'occupied-neighbours', from: [a, 0], to: [a, 4], expect: rich });
    boundary.neighboursKept = s.same(neighbours, [await s.content(a, 3), await s.content(a, 5)]);
    // An audio track destination for a note clip.
    await run({ name: 'audio-destination', from: [a, 0], to: [audio, 0], expect: rich });
    // Several sources in one call.
    const several = await run({ name: 'two-sources', from: [a, 0], to: [b, 6], more: [[a, 5]], expect: rich });
    several.second = { row7: await s.content(b, 7), row11: await s.content(b, 11).then((item) => ({ ...item, body: undefined })) };
    // The second copy keeps its row offset from the first source and adds scenes. Remove its clip, then the scenes.
    if (several.scenes[1] > SCENES) {
      await s.must('delete_launcher_clip', { clips: [{ trackId: b, row: 11 }] }).catch((error) => { several.cleanupError = String(error); });
      several.scenesRestored = await s.restoreScenes();
    }
    // A row past the last scene, when the scene window has one.
    if (rig.scenes > SCENES) await run({ name: 'past-last-scene', from: [a, 0], to: [a, SCENES], undo: true });
    else cases.push({ case: 'past-last-scene', skipped: `the scene window is ${rig.scenes} rows` });
    // A group track slot (the baseline group "Group 5", an empty row). An undo restores the baseline.
    const group = (await s.tracks()).find((row) => row.type === 'Group');
    if (group !== undefined) {
      const column = (await s.grid())[`${group.name}#${group.channelId.slice(0, 4)}`]!;
      const free = column.lastIndexOf('.');
      if (free >= 0) await run({ name: 'group-destination', from: [a, 5], to: [group.channelId, free], undo: true });
    }
    // A playing source.
    await s.request('slot.launchWithOptions', { trackIndex: await s.indexOf(a), slotIndex: 0, quantization: 'none',
      launchMode: 'from_start' });
    let playing: Wire = {};
    for (let n = 0; n < 40 && playing.isPlaying !== true; n += 1) {
      await pause(50);
      playing = await s.request('slot.playState', { trackIndex: await s.indexOf(a), slotIndex: 0 });
    }
    const live = await run({ name: 'playing-source', from: [a, 0], to: [a, 7], expect: rich });
    live.sourcePlaying = { before: playing.isPlaying,
      after: (await s.request('slot.playState', { trackIndex: await s.indexOf(a), slotIndex: 0 })).isPlaying,
      copy: (await s.request('slot.playState', { trackIndex: await s.indexOf(a), slotIndex: 7 })).isPlaying };
    // A 16,384-note clip (the reader limit).
    await s.must('add_launcher_clip', { trackId: big, row: 0, document: worstDesired(16_384), format: 'fields' });
    const large = await s.content(big, 0);
    const largeCopy = await run({ name: 'notes-16384', from: [big, 0], to: [big, 3], expect: large, waitMs: 1500 });
    largeCopy.sourceNotes = large.notes;
    results.passed = cases.filter((row) => row.equal !== undefined).map((row) => `${row.case}: ${JSON.stringify(row.equal)}`);
  } finally {
    const ids = Object.values(scratch);
    if (ids.length > 0) results.cleanup = (await s.tool('delete_track', { trackIds: ids })).readback ?? 'failed';
    results.scenesRestored = await s.restoreScenes().catch((error) => String(error));
    const exit = await s.state();
    results.exit = { slots: gridDelta(entry.grid, exit.grid), tracksSame: s.same(entry.tracks, exit.tracks),
      scenes: exit.scenes, selection: exit.selection, selectionKept: s.same(entry.selection, exit.selection) };
    say(results.exit);
    await save();
    await s.transport.close();
  }
}

async function accept(dir: string): Promise<void> {
  const s = session();
  const hello = await requireAnchor(s, 'normal-v1');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [...NORMAL_8I14], 'deploy the 8i14 build');
  assert.equal((await s.request('rig.info')).clipCopy, 'copy-to-slot-v1', 'deploy the 8i14 build');
  await s.adapter.hello();
  const mixer = async (): Promise<string> => {
    const list = await s.tracks();
    return JSON.stringify(((await s.request('track.mixer', { tracks: list.map((row) => ({ trackIndex: row.index,
      channelId: row.channelId })) })).tracks as Wire[]).map((item) => [item.channelId, item.volumeRaw, item.panRaw, item.mute, item.solo]));
  };
  const entry = { ...(await s.state()), mixer: await mixer() } as Wire;
  const rows: Wire[] = [];
  const results: Wire = { schema: SCHEMA, mode: 'accept', hello, entry: { ...entry, events: undefined }, rows };
  /** One timed tool call with its wire calls and the state change around it. */
  const call = async (step: string, name: string, args: Wire): Promise<Wire> => {
    const before = { ...(await s.state()), mixer: await mixer() } as Wire;
    const from = s.transport.calls.length;
    const started = performance.now();
    const result = await s.tool(name, args);
    const ms = Math.round(performance.now() - started);
    const calls = s.transport.calls.slice(from);
    const wire = wireSummary(calls);
    const after = { ...(await s.state()), mixer: await mixer() } as Wire;
    const row: Wire = { step, tool: name, ok: result.failure === undefined, code: result.failure?.code,
      stage: result.failure?.stage, status: result.readback?.status, ms, calls: calls.length, turns: wire.turns,
      writes: calls.filter((item) => item.method === 'batch.run').length,
      copyFrames: calls.filter((item) => item.method === 'batch.run').flatMap((item) =>
        ((item.params?.calls ?? item.params?.ops ?? []) as Wire[]).map((frame) => frame.method))
        .filter((method) => /^slot\.(copyTo|duplicateClip|delete)$/.test(method)),
      slots: gridDelta(before.grid, after.grid), scenes: [before.scenes, after.scenes],
      tracksSame: s.same(before.tracks, after.tracks), mixerSame: before.mixer === after.mixer,
      selectionKept: s.same(before.selection, after.selection), fidelity: result.fidelity ?? result.data?.fidelity,
      methods: wire.methods };
    rows.push(row);
    say({ ...row, methods: undefined });
    return result;
  };
  const save = async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'accept.json'), `${JSON.stringify(results, null, 2)}\n`);
  };
  const scratch: string[] = [];
  try {
    const added = await s.must('add_tracks', { tracks: ['a', 'b', 'big', 'big2'].map((key) => ({ name: `${PREFIX}${key}` })) });
    const [a, b, big, big2] = (added.readback.tracks as Wire[]).map((item) => item.trackId as string) as [string, string, string, string];
    scratch.push(a, b, big, big2);
    await s.must('add_launcher_clip', { trackId: a, row: 0, document: typicalDesired(), format: 'fields' });
    await s.must('set_launcher_clip_properties', { clips: [{ trackId: a, row: 0, properties: {
      name: 'gn-rich', color: { red: 20, green: 160, blue: 90 }, playStartBeats: 4, loopEnabled: false } }] });
    await s.must('set_launcher_clip_launch_settings', { clips: [{ trackId: a, row: 0, quantization: '1/4',
      mode: 'synced', useLoopStartAsQuantizationReference: true }] });
    for (const row of [3, 5]) await s.must('add_launcher_clip', { trackId: a, row, document: smallDesired(60 + row), format: 'fields' });
    const rich = await s.content(a, 0);
    const neighbours = [await s.content(a, 3), await s.content(a, 5)];
    const revert = async (step: string, change: Wire): Promise<void> => {
      const reverted = await call(step, 'revert_change', { changeId: change.effects[0].changeId });
      assert.equal(reverted.failure, undefined, JSON.stringify(reverted).slice(0, 600));
    };
    /** One copy of the rich clip, its content check, and its revert. */
    const copyAndRevert = async (step: string, destination: Wire, source: Wire = { trackId: a, row: 0 }): Promise<void> => {
      const copied = await call(step, 'copy_launcher_clips', { copies: [{ source, destination }] });
      assert.equal(copied.readback?.status, 'verified', JSON.stringify(copied).slice(0, 600));
      const row = rows.at(-1)!;
      const copy = await s.content(destination.trackId, destination.row);
      row.equal = { metadata: s.same(copy.metadata, rich.metadata), launch: s.same(copy.launch, rich.launch), notes: copy.body === rich.body };
      row.sourceKept = s.same(await s.content(source.trackId, source.row), rich);
      assert.deepEqual(row.equal, { metadata: true, launch: true, notes: true }, step);
      assert.equal(row.slots.length, 1, `${step}: one slot changes`);
      assert(row.writes === 1 && row.sourceKept && row.mixerSame && row.selectionKept && row.tracksSame, `${step}: ${JSON.stringify(row)}`);
      await revert(`${step}-revert`, copied);
      assert.deepEqual(rows.at(-1)!.slots.length, 1, `${step}: the revert empties one slot`);
    };
    // The next row: the baseline of the ledger (before 8i14, the `duplicateClip` route).
    await copyAndRevert('copy-next-row', { trackId: a, row: 1 });
    // A row that is not the next row, between two occupied rows; then another track.
    await copyAndRevert('copy-far-row', { trackId: a, row: 4 });
    assert(s.same(neighbours, [await s.content(a, 3), await s.content(a, 5)]), 'the neighbour clips stay');
    await copyAndRevert('copy-other-track', { trackId: b, row: 2 });
    // An empty Audio track that receives a note clip (raw setup): the host changes its type.
    const made = await s.must('add_tracks', { tracks: [{ name: `${PREFIX}was-audio`, kind: 'audio' }, { name: `${PREFIX}audio`, kind: 'audio' }] });
    const [wasAudio, audio] = (made.readback.tracks as Wire[]).map((item) => item.trackId as string) as [string, string];
    scratch.push(wasAudio, audio);
    const typeOf = async (id: string) => (await s.tracks()).find((row) => row.channelId === id)!.type as string;
    const typeBefore = await typeOf(wasAudio);
    await s.request('slot.copyTo', { trackIndex: await s.indexOf(a), slotIndex: 0, toTrackIndex: await s.indexOf(wasAudio), toSlotIndex: 0 });
    await pause(500);
    results.audioDestination = { before: typeBefore, after: await typeOf(wasAudio),
      equal: (await s.content(wasAudio, 0)).body === rich.body };
    say(results.audioDestination);
    // The Hybrid arms, on a scratch duplicate of a baseline Hybrid track.
    const model = (await s.tracks()).find((row) => row.type === 'Hybrid' && !String(row.name).startsWith(PREFIX));
    assert(model !== undefined, 'the baseline has a Hybrid track');
    const hybrid = (await s.must('duplicate_track', { trackId: model.channelId, name: `${PREFIX}hybrid` })).readback.copy.trackId as string;
    scratch.push(hybrid);
    assert.equal(await typeOf(hybrid), 'Hybrid');
    const column = Object.entries(await s.grid()).find(([key]) => key.endsWith(`#${hybrid.slice(0, 4)}`))![1];
    const free = [...column].map((cell, row) => cell === '.' ? row : -1).filter((row) => row >= 0);
    assert(free.length >= 3, `the Hybrid copy needs three empty rows: ${column}`);
    results.hybrid = { model: model.name, column, rows: free.slice(0, 3) };
    await copyAndRevert('instrument-to-hybrid', { trackId: hybrid, row: free[2] });
    // A source on the Hybrid track: a kept copy of the rich clip.
    const kept = await s.must('copy_launcher_clips', { copies: [{ source: { trackId: a, row: 0 }, destination: { trackId: hybrid, row: free[0] } }] });
    assert.equal(kept.readback.status, 'verified');
    await copyAndRevert('hybrid-same-track', { trackId: hybrid, row: free[2] }, { trackId: hybrid, row: free[0] });
    await copyAndRevert('hybrid-to-instrument', { trackId: b, row: 1 }, { trackId: hybrid, row: free[0] });
    assert.equal(await typeOf(hybrid), 'Hybrid');
    // The refusals: no write.
    const wrongType = await call('refuse-audio-track', 'copy_launcher_clips', { copies: [{ source: { trackId: a, row: 0 },
      destination: { trackId: audio, row: 0 } }] });
    assert.equal(wrongType.failure?.code, 'unsupported');
    assert(rows.at(-1)!.writes === 0 && rows.at(-1)!.slots.length === 0 && rows.at(-1)!.tracksSame, 'the track type refusal writes nothing');
    const occupied = await call('refuse-occupied', 'copy_launcher_clips', { copies: [{ source: { trackId: a, row: 0 },
      destination: { trackId: a, row: 3 } }] });
    assert.equal(occupied.failure?.code, 'occupied');
    assert(rows.at(-1)!.writes === 0 && rows.at(-1)!.slots.length === 0, 'the occupied refusal writes nothing');
    const absent = await call('refuse-missing-row', 'copy_launcher_clips', { copies: [{ source: { trackId: a, row: 0 },
      destination: { trackId: a, row: SCENES } }] });
    assert.equal(absent.failure?.code, 'absent');
    assert.equal(rows.at(-1)!.writes, 0);
    // The largest admitted case: 8 clips of 16,384 notes to another track.
    for (let row = 0; row < 8; row += 1) {
      await s.must('add_launcher_clip', { trackId: big, row, document: worstDesired(16_384), format: 'fields' });
    }
    const largest = await call('copy-8x16384', 'copy_launcher_clips', { copies: Array.from({ length: 8 }, (_, row) => ({
      source: { trackId: big, row }, destination: { trackId: big2, row: (row + 2) % 10 } })) });
    assert.equal(largest.readback?.status, 'verified', JSON.stringify(largest).slice(0, 600));
    assert.equal(rows.at(-1)!.slots.length, 8);
    const one = await s.content(big2, 2);
    rows.at(-1)!.firstCopyNotes = one.notes;
    assert.equal(one.body, (await s.content(big, 0)).body, 'the first large copy equals its source');
    await revert('copy-8x16384-revert', largest);
    assert.equal(rows.at(-1)!.slots.length, 8);
  } finally {
    await save();
    if (scratch.length > 0) results.cleanup = (await s.tool('delete_track', { trackIds: scratch })).readback ?? 'failed';
    results.scenesRestored = await s.restoreScenes().catch((error) => String(error));
    const exit = { ...(await s.state()), mixer: await mixer() } as Wire;
    results.exit = { slots: gridDelta(entry.grid, exit.grid), tracksSame: s.same(entry.tracks, exit.tracks),
      scenes: exit.scenes, mixerSame: entry.mixer === exit.mixer, selection: exit.selection,
      selectionKept: s.same(entry.selection, exit.selection) };
    say(results.exit);
    await save();
    await s.transport.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'probe' && dir !== undefined) await probe(dir);
  else if (mode === 'accept' && dir !== undefined) await accept(dir);
  else if (mode === 'restore-scenes') { const s = session(); await s.adapter.hello(); say(await s.restoreScenes()); await s.transport.close(); }
  else {
    console.error('usage: phase8i14-copy.ts probe|accept <dir> | restore-scenes');
    process.exitCode = 2;
  }
  process.exit();
}
