/**
 * 8i7 track mixer (E257). Live driver, normal profile, owned unsaved project (refuses the saved anchor, D29).
 *
 *   measure <dir>   Create 8 instrument tracks (gn-8i7-m0..m7). Measure read_track_mixer, set_track_mixer, and
 *                   revert_change for 1 and 8 tracks with all four fields; silence, -120, -18, -12, unity, and the
 *                   maximum; every other track kind in the project (one reversible field each); the automation
 *                   refusal; and the guarded reversal after an unrecorded edit. An independent raw `track.mixer`
 *                   call checks each written value. Selection and group folding must not change. The driver deletes
 *                   the tracks it created in finally and restores every field of the operator's tracks.
 *   hold <dir>      Create one track gn-8i7-ui and set it to -18 dB, pan -0.5, mute on, for an operator UI check.
 *                   The next `release` deletes it.
 *   release [name]  Delete gn-8i7-ui, or the named driver track (for example gn-8h4c-edit after a cost rerun).
 *   trial-setup     Create the fresh-agent trial tracks Pad and Chords (fresh mixer values).
 *   trial-state [all]  Print the raw mixer of the trial tracks (the independent check of the trial). With `all`,
 *                   print every track and the selection (the check that no other track changed).
 *   trial-cleanup   Delete the trial tracks.
 *   stats           Print rig.stats: init time and heap.
 *
 * Each record prints the wire calls with their start offset and duration (ms).
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { VOLUME_RAW_MAX, volumeRawOfDb } from '../contract/index.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { WireTransport } from './phase8h3c-promotion.js';
import { wireSummary } from './phase8h4g-inventory.js';

type Wire = Record<string, any>;
const SCHEMA = 'phase8i7-mixer-v1';
const ANCHOR = 'gn-scale-test';
const say = (value: unknown): void => console.log(JSON.stringify(value));

const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
  observationStore: new FakeObservationStore(), documents: new IdentityRegistry(),
});
const request = async (method: string, params?: Wire): Promise<Wire> =>
  await transport.send({ method, ...(params ? { params } : {}) }) as Wire;

interface Timed { result: Wire; ms: number; wire: ReturnType<typeof wireSummary>; sequence: string[] }

/** One tool call with its wall time, its wire summary, and its call sequence (method@start+duration). */
async function tool(name: string, args: Wire, allowFailure = false): Promise<Timed> {
  const from = transport.calls.length;
  const started = performance.now();
  const result = await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const ms = Math.round(performance.now() - started);
  const calls = transport.calls.slice(from);
  if (!allowFailure) assert(result.failure === undefined, `${name}: ${JSON.stringify(result).slice(0, 800)}`);
  return { result, ms, wire: wireSummary(calls),
    sequence: calls.map((call) => `${call.method}@${Math.round(call.sent - started)}+${Math.round(call.received - call.sent)}`) };
}

/** The independent host read: one raw `track.mixer` call, outside every tool and the executor. */
async function raw(ids: readonly string[]): Promise<Map<string, Wire>> {
  const list = (await request('track.list')).tracks as Wire[];
  const rows = ids.map((id) => {
    const row = list.find((item) => item.channelId === id);
    assert(row !== undefined, `track ${id} is not in the bank`);
    return { trackIndex: row.index, channelId: id };
  });
  const reply = await request('track.mixer', { tracks: rows });
  return new Map((reply.tracks as Wire[]).map((row) => [row.channelId as string, row]));
}

const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

/** The project, the selection, and the folding and order of every track: these must not change. */
async function context(): Promise<Wire> {
  const selection = await request('selection.status');
  const list = (await request('track.list')).tracks as Wire[];
  return {
    // The selection counters: a mixer tool moves no selection, so none of them may change.
    selection: { trackIndex: selection.trackIndex, slotIndex: selection.slotIndex,
      mixerTrackIndex: selection.mixerTrackIndex, changes: selection.changes, revision: selection.revision },
    tracks: list.map((row) => ({ id: row.channelId, name: row.name, type: row.type, position: row.position,
      hidden: row.hidden === true })),
  };
}

async function stats(): Promise<Wire> {
  const s = await request('rig.stats');
  return { profile: s.runtimeProfile, rigConstructMicros: s.rigConstructMicros, initMicros: s.initMicros,
    heapUsedMb: s.heapUsedMb, heapMaxMb: s.heapMaxMb, tracks: s.config?.tracks };
}

/** `scratchOnly`: the mode adds and deletes its own tracks only, so the saved owned project is admitted (8i12). */
async function requireOwnedProject(scratchOnly = false): Promise<string> {
  const info = await request('rig.info');
  assert.equal(info.trackMixer, 'track-mixer-raw-v1', 'the 8i7 build marker');
  const hello = await request('contract.hello');
  assert.equal(hello.runtimeProfile, 'normal-v1');
  const connection = await tool('check_bitwig_connection', {});
  const project = connection.result.data?.project as string;
  assert(typeof project === 'string' && (scratchOnly ? project === ANCHOR : project !== ANCHOR),
    scratchOnly ? `the owned project ${ANCHOR} is required, not ${project}` : `an owned unsaved project is required, not ${project}`);
  return project;
}

async function addTracks(names: readonly string[]): Promise<string[]> {
  const added = await tool('add_tracks', { tracks: names.map((name) => ({ name })) });
  return (added.result.readback.tracks as Wire[]).map((item) => item.trackId as string);
}

async function deleteTracks(ids: readonly string[]): Promise<void> {
  if (ids.length > 0) await tool('delete_track', { trackIds: ids });
}

async function measure(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const project = await requireOwnedProject();
  const record: Wire = { schema: SCHEMA, project, stats: await stats() };
  const operator = ((await context()).tracks as Wire[]).filter((row) => row.type !== 'Master');
  const operatorPrior = await raw(operator.map((row) => row.id));
  const ids = await addTracks(Array.from({ length: 8 }, (_, index) => `gn-8i7-m${index}`));
  const created = new Set(ids);
  // The window of the mixer calls: a track creation or deletion moves the selection (E251), so it is outside.
  await new Promise((resolve) => setTimeout(resolve, 500));
  const before = await context();
  record.before = before;
  let after: Wire | undefined;
  try {
    // --- one track ------------------------------------------------------------------
    const read1 = await tool('read_track_mixer', { trackIds: [ids[0]] });
    const set1 = await tool('set_track_mixer', { tracks: [{ trackId: ids[0], volumeDb: -18 }] });
    const host1 = (await raw([ids[0]!])).get(ids[0]!)!;
    assert(near(host1.volumeRaw, volumeRawOfDb(-18)), `-18 dB raw: ${host1.volumeRaw}`);
    const revert1 = await tool('revert_change', { changeId: set1.result.effects[0].changeId });
    assert(near((await raw([ids[0]!])).get(ids[0]!)!.volumeRaw, read1.result.data.tracks[0].volume.db === -10
      ? volumeRawOfDb(-10) : volumeRawOfDb(read1.result.data.tracks[0].volume.db)), 'the reversal restored -10 dB');
    record.one = { read: summary(read1), set: summary(set1), revert: summary(revert1),
      host: { volumeRaw: host1.volumeRaw, display: host1.volumeDisplayed } };
    say({ one: { read: read1.ms, set: set1.ms, revert: revert1.ms, turns: [read1.wire.turns, set1.wire.turns,
      revert1.wire.turns], display: host1.volumeDisplayed } });

    // --- eight tracks, all fields ---------------------------------------------------------
    const values: Wire[] = [
      { volumeDb: '-inf', pan: -1, mute: true, solo: true }, { volumeDb: -120, pan: 1, mute: true, solo: true },
      { volumeDb: -18, pan: -0.5, mute: true, solo: true }, { volumeDb: -12, pan: 0.5, mute: true, solo: true },
      { volumeDb: 0, pan: 0.25, mute: true, solo: true }, { volumeDb: 6.0206, pan: -0.25, mute: true, solo: true },
      { volumeDb: -6, pan: 0.1, mute: true, solo: true }, { volumeDb: -3, pan: -0.1, mute: true, solo: true },
    ];
    const read8 = await tool('read_track_mixer', { trackIds: ids });
    const set8 = await tool('set_track_mixer', { tracks: ids.map((trackId, index) => ({ trackId, ...values[index] })) });
    assert.equal(set8.result.readback.status, 'verified', JSON.stringify(set8.result.readback).slice(0, 600));
    const host8 = await raw(ids);
    const observed = ids.map((id, index) => {
      const row = host8.get(id)!;
      const want = values[index]!;
      assert(near(row.volumeRaw, volumeRawOfDb(want.volumeDb)), `${id} volume`);
      assert(near(row.panRaw, want.pan) && row.mute === true && row.solo === true, `${id} pan, mute, solo`);
      return { volumeDb: want.volumeDb, volumeRaw: row.volumeRaw, volumeNormalized: row.volumeNormalized,
        display: row.volumeDisplayed, pan: row.panRaw };
    });
    assert(near(host8.get(ids[5]!)!.volumeRaw, VOLUME_RAW_MAX), 'the maximum is the host maximum');
    const solo = (await context()).selection;
    const revert8 = await tool('revert_change', { changeId: set8.result.effects[0].changeId });
    const back8 = await raw(ids);
    for (const id of ids) {
      const row = back8.get(id)!;
      assert(near(row.volumeRaw, volumeRawOfDb(-10)) && row.panRaw === 0 && row.mute === false && row.solo === false,
        `${id} is back`);
    }
    record.eight = { read: summary(read8), set: summary(set8), revert: summary(revert8), observed, selectionWhileSolo: solo };
    say({ eight: { read: read8.ms, set: set8.ms, revert: revert8.ms, turns: [read8.wire.turns, set8.wire.turns,
      revert8.wire.turns] }, observed: observed.map((item) => `${item.volumeDb} → ${item.display}`) });

    // --- no-op ---------------------------------------------------------------------------
    const same = await tool('set_track_mixer', { tracks: [{ trackId: ids[0], volumeDb: -10, pan: 0 }] });
    assert.equal(same.result.readback.status, 'unchanged');
    record.noop = summary(same);

    // --- guarded reversal after an unrecorded edit -----------------------------------------
    const guarded = await tool('set_track_mixer', { tracks: [{ trackId: ids[1], volumeDb: -12, pan: -0.5 }] });
    const index1 = ((await request('track.list')).tracks as Wire[]).find((row) => row.channelId === ids[1])!.index;
    // The edit goes straight to the host, as a person's edit does: no change record knows it.
    await request('batch.run', { ops: [{ method: 'track.setMixer', params: { trackIndex: index1,
      expectedChannelId: ids[1], panRaw: 0.75 } }] });
    const check = await tool('check_revert', { changeId: guarded.result.effects[0].changeId });
    const reverted = await tool('revert_change', { changeId: guarded.result.effects[0].changeId });
    const afterGuard = (await raw([ids[1]!])).get(ids[1]!)!;
    assert(near(afterGuard.volumeRaw, volumeRawOfDb(-10)), 'volume restored');
    assert(near(afterGuard.panRaw, 0.75), 'the unrecorded pan stays');
    record.guarded = { check: check.result.data, revert: summary(reverted), after: afterGuard };
    say({ guarded: { notRestored: reverted.result.readback.notRestored, pan: afterGuard.panRaw } });

    // --- the operator's tracks: each kind, one reversible field; automation refuses ----------
    record.kinds = [];
    for (const row of operator) {
      const prior = operatorPrior.get(row.id)!;
      const entry: Wire = { name: row.name, type: row.type, hidden: row.hidden, volumeAutomated: prior.volumeAutomated,
        panAutomated: prior.panAutomated };
      const read = await tool('read_track_mixer', { trackIds: [row.id] });
      entry.read = { ms: read.ms, data: read.result.data.tracks[0] };
      if (prior.volumeAutomated) {
        const refused = await tool('set_track_mixer', { tracks: [{ trackId: row.id, volumeDb: -18 }] }, true);
        assert.equal(refused.result.failure?.code, 'unsupported');
        assert.equal(refused.result.detail?.reason, 'automation');
        assert(near((await raw([row.id])).get(row.id)!.volumeRaw, prior.volumeRaw), 'nothing was written');
        entry.automationRefusal = { ms: refused.ms, turns: refused.wire.turns, detail: refused.result.detail };
      }
      const field = prior.panAutomated ? { mute: !prior.mute } : { pan: prior.panRaw === 0.5 ? 0.25 : 0.5 };
      const set = await tool('set_track_mixer', { tracks: [{ trackId: row.id, ...field }] });
      assert.equal(set.result.readback.status, 'verified', JSON.stringify(set.result).slice(0, 600));
      const revert = await tool('revert_change', { changeId: set.result.effects[0].changeId });
      const back = (await raw([row.id])).get(row.id)!;
      assert(back.panRaw === prior.panRaw && back.mute === prior.mute && near(back.volumeRaw, prior.volumeRaw),
        `${row.name} is back`);
      entry.set = { field, ms: set.ms, turns: set.wire.turns };
      entry.revert = { ms: revert.ms, turns: revert.wire.turns };
      record.kinds.push(entry);
      say({ kind: row.type, name: row.name, hidden: row.hidden, set: set.ms, revert: revert.ms,
        automation: entry.automationRefusal?.detail ?? null });
    }
    after = await context();
  } finally {
    await deleteTracks(ids);
    // Restore any operator field that a failed step left changed.
    const now = await raw(operator.map((row) => row.id));
    for (const row of operator) {
      const prior = operatorPrior.get(row.id)!;
      const current = now.get(row.id)!;
      const fix: Wire = {};
      if (!near(current.volumeRaw, prior.volumeRaw) && !prior.volumeAutomated) fix.volumeRaw = prior.volumeRaw;
      if (current.panRaw !== prior.panRaw && !prior.panAutomated) fix.panRaw = prior.panRaw;
      if (current.mute !== prior.mute) fix.mute = prior.mute;
      if (current.solo !== prior.solo) fix.solo = prior.solo;
      if (Object.keys(fix).length === 0) continue;
      const index = ((await request('track.list')).tracks as Wire[]).find((item) => item.channelId === row.id)!.index;
      await request('batch.run', { ops: [{ method: 'track.setMixer', params: { trackIndex: index,
        expectedChannelId: row.id, ...fix } }] });
      say({ restored: row.name, fix });
    }
  }
  record.after = after;
  const final = await context();
  record.final = final;
  record.unchanged = {
    selection: JSON.stringify(after?.selection) === JSON.stringify(before.selection),
    tracks: JSON.stringify(after?.tracks) === JSON.stringify(before.tracks),
    leftover: (final.tracks as Wire[]).filter((row) => created.has(row.id)).length };
  record.statsAfter = await stats();
  await writeFile(join(dir, 'mixer.json'), `${JSON.stringify(record, null, 2)}\n`);
  say({ selectionUnchanged: record.unchanged.selection, tracksUnchanged: record.unchanged.tracks,
    stats: record.stats, statsAfter: record.statsAfter });
}

function summary(timed: Timed): Wire {
  return { ms: timed.ms, wire: timed.wire, sequence: timed.sequence,
    timing: timed.result.timing ?? null, status: timed.result.readback?.status ?? null };
}

async function hold(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await requireOwnedProject();
  const [id] = await addTracks(['gn-8i7-ui']);
  const set = await tool('set_track_mixer', { tracks: [{ trackId: id, volumeDb: -18, pan: -0.5, mute: true }] });
  const host = (await raw([id!])).get(id!)!;
  await writeFile(join(dir, 'hold.json'), `${JSON.stringify({ id, set: set.result.readback, host }, null, 2)}\n`);
  say({ id, readback: set.result.readback.tracks[0].fields, host: { display: host.volumeDisplayed, pan: host.panRaw,
    mute: host.mute } });
}

async function release(name = 'gn-8i7-ui'): Promise<void> {
  const list = (await request('track.list')).tracks as Wire[];
  await deleteTracks(list.filter((row) => row.name === name).map((row) => row.channelId as string));
}

const TRIAL = ['Pad', 'Chords'];
const trialIds = async (): Promise<string[]> => ((await request('track.list')).tracks as Wire[])
  .filter((row) => TRIAL.includes(row.name)).map((row) => row.channelId as string);

async function trial(mode: string, scope?: string): Promise<void> {
  if (mode === 'trial-setup') {
    assert.deepEqual(await trialIds(), [], 'a trial track exists; run trial-cleanup first');
    await requireOwnedProject(true);
    say({ created: await addTracks(TRIAL) });
  } else if (mode === 'trial-state') {
    const ids = scope === 'all'
      ? ((await request('track.list')).tracks as Wire[]).map((row) => row.channelId as string) : await trialIds();
    const names = new Map(((await request('track.list')).tracks as Wire[]).map((row) => [row.channelId, row.name]));
    for (const [id, row] of await raw(ids)) {
      say({ name: names.get(id), volumeRaw: row.volumeRaw, db: 60 * Math.log10(row.volumeRaw), display: row.volumeDisplayed,
        pan: row.panRaw, mute: row.mute, solo: row.solo });
    }
    if (scope === 'all') {
      const selection = await request('selection.status');
      say({ project: selection.project, slotTrackIndex: selection.trackIndex, slotIndex: selection.slotIndex,
        mixerTrackIndex: selection.mixerTrackIndex, mixerChannelId: selection.mixerChannelId });
    }
  } else {
    await deleteTracks(await trialIds());
  }
}

const [mode, dir] = process.argv.slice(2);
if (mode === 'measure') await measure(dir ?? '/tmp/phase8i7');
else if (mode === 'hold') await hold(dir ?? '/tmp/phase8i7');
else if (mode === 'release') await release(dir);
else if (mode === 'stats') say(await stats());
else if (mode?.startsWith('trial-')) await trial(mode, dir);
else throw new Error('usage: phase8i7-mixer.ts measure <dir> | hold <dir> | release | stats');
process.exit(0);
