/**
 * 8i7 (E257): read_track_mixer and set_track_mixer on the fake adapter. Units, limits, refusals before any write,
 * no-op fields, partial writes, readback failure, and the guarded reversal of each field.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { fakeMixerOf } from '../adapters/fake/model.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { VOLUME_DB_MAX, VOLUME_RAW_MAX, track as trackAt } from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from './tools.js';
import { workspaceOf, type Workspace } from './workspace.js';

type Wire = Record<string, any>;

class CountingAdapter extends FakeAdapter {
  calls = 0;
  failReadAfterApply = false;
  private applied = false;
  override async apply(...args: Parameters<FakeAdapter['apply']>) {
    this.calls++;
    const receipt = await super.apply(...args);
    this.applied = true;
    return receipt;
  }
  override async read(...args: Parameters<FakeAdapter['read']>) {
    this.calls++;
    if (this.failReadAfterApply && this.applied) throw new Error('the bridge timed out');
    return super.read(...args);
  }
  override async revision(...args: Parameters<FakeAdapter['revision']>) { this.calls++; return super.revision(...args); }
  override async resolve(...args: Parameters<FakeAdapter['resolve']>) { this.calls++; return super.resolve(...args); }
  override async tracks(...args: Parameters<FakeAdapter['tracks']>) { this.calls++; return super.tracks(...args); }
}

function fixture(names = ['gn-pad', 'gn-chords']) {
  const fake = new CountingAdapter({ tracks: names, scenes: 2 });
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `m-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(), documents: new IdentityRegistry(),
  });
  const rows = fake.model.visibleTracks().filter((row) => names.includes(row.name));
  const call = async (name: string, args: Wire, ws: Workspace = workspace): Promise<Wire> =>
    await callTool(ws, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  return { fake, workspace, rows, ids: rows.map((row) => row.channelId), call };
}

test('8i7 read: the fresh-track mixer in public units, with the host display', async () => {
  const { ids, call } = fixture();
  const read = await call('read_track_mixer', { trackIds: ids });
  assert.equal(read.failure, undefined, JSON.stringify(read));
  assert.equal(read.schema, 'ghostnote-track-mixer/1');
  assert.deepEqual(read.data.tracks[0], {
    trackId: ids[0], name: 'gn-pad', kind: 'Instrument',
    volume: { db: -10, display: '-10.0 dB', automated: false }, pan: { value: 0, automated: false },
    mute: false, solo: false,
  });
});

test('8i7 set: -18 dB and -12 dB land exactly, readback verifies, and omitted fields stay', async () => {
  const { fake, rows, ids, call } = fixture();
  fakeMixerOf(rows[1]!).pan = 0.25;
  const set = await call('set_track_mixer', { tracks: [
    { trackId: ids[0], volumeDb: -18 }, { trackId: ids[1], volumeDb: -12, mute: true }] });
  assert.equal(set.failure, undefined, JSON.stringify(set));
  assert.equal(set.applied, true);
  assert.equal(set.readback.status, 'verified');
  assert.deepEqual(set.readback.tracks[0].fields.volume,
    { status: 'verified', requestedDb: -18, db: -18, display: '-18.0 dB' });
  assert.deepEqual(set.readback.tracks[1].fields.mute, { status: 'verified', requested: true, value: true });
  assert.equal(set.effects.length, 1, 'one change for the whole call');
  assert.equal(fakeMixerOf(rows[0]!).volume, 10 ** (-18 / 60));
  assert.equal(fakeMixerOf(rows[1]!).pan, 0.25, 'an omitted field is not written');
  assert.deepEqual(set.warnings.map((item: Wire) => item.code), ['immediate-playback']);
  assert.equal(set.next.revert.changeId, set.effects[0].changeId);
  void fake;
});

test('8i7 set: silence, unity, the maximum, and pan extremes; a reported maximum goes back unchanged', async () => {
  const { rows, ids, call } = fixture();
  const set = await call('set_track_mixer', { tracks: [
    { trackId: ids[0], volumeDb: '-inf', pan: -1 }, { trackId: ids[1], volumeDb: VOLUME_DB_MAX, pan: 1 }] });
  assert.equal(set.readback.status, 'verified', JSON.stringify(set));
  assert.equal(fakeMixerOf(rows[0]!).volume, 0);
  assert.equal(fakeMixerOf(rows[1]!).volume, VOLUME_RAW_MAX);
  assert.equal(set.readback.tracks[0].fields.volume.db, '-inf');
  assert.equal(set.readback.tracks[0].fields.volume.display, '-Inf dB');
  const read = await call('read_track_mixer', { trackIds: [ids[1]] });
  assert.equal(read.data.tracks[0].volume.display, '+6.0 dB');
  const again = await call('set_track_mixer', { tracks: [{ trackId: ids[1], volumeDb: read.data.tracks[0].volume.db }] });
  assert.equal(again.failure, undefined, JSON.stringify(again));
  assert.equal(again.readback.status, 'unchanged');
  const unity = await call('set_track_mixer', { tracks: [{ trackId: ids[1], volumeDb: 0 }] });
  assert.equal(unity.readback.tracks[0].fields.volume.display, '0.0 dB');
});

test('8i7 set: a field that holds the requested value is not written, and an all-unchanged call records nothing', async () => {
  const { workspace, ids, call } = fixture();
  const same = await call('set_track_mixer', { tracks: [{ trackId: ids[0], volumeDb: -10, mute: false }] });
  assert.equal(same.failure, undefined, JSON.stringify(same));
  assert.equal(same.applied, false);
  assert.equal(same.readback.status, 'unchanged');
  assert.deepEqual(same.effects, []);
  assert.equal(workspace.changes.list().length, 0);
  const mixed = await call('set_track_mixer', { tracks: [{ trackId: ids[0], volumeDb: -10, solo: true }] });
  assert.equal(mixed.readback.tracks[0].fields.volume.status, 'unchanged');
  assert.equal(mixed.readback.tracks[0].fields.solo.status, 'verified');
});

test('8i7 input: limits, duplicates, empty entries, and ranges refuse before any read or write', async () => {
  const { fake, ids, call } = fixture();
  const cases: [Wire, string, string][] = [
    [{ tracks: Array.from({ length: 9 }, (_, index) => ({ trackId: `t${index}`, mute: true })) }, 'outside-limit', 'set'],
    [{ tracks: [{ trackId: ids[0], mute: true }, { trackId: ids[0], solo: true }] }, 'invalid-input', 'set'],
    [{ tracks: [{ trackId: ids[0] }] }, 'invalid-input', 'set'],
    [{ tracks: [{ trackId: ids[0], volumeDb: 6.1 }] }, 'range', 'set'],
    [{ tracks: [{ trackId: ids[0], volumeDb: -121 }] }, 'range', 'set'],
    [{ tracks: [{ trackId: ids[0], pan: 1.5 }] }, 'range', 'set'],
    [{ trackIds: Array.from({ length: 9 }, (_, index) => `t${index}`) }, 'outside-limit', 'read'],
    [{ trackIds: [ids[0], ids[0]] }, 'invalid-input', 'read'],
  ];
  for (const [input, code, tool] of cases) {
    fake.calls = 0;
    const result = await call(tool === 'set' ? 'set_track_mixer' : 'read_track_mixer', input);
    assert.equal(result.failure?.code, code, JSON.stringify(result).slice(0, 400));
    assert.equal(result.failure.stage, 'input');
    assert.equal(fake.calls, 0, `${code}: nothing was read or written`);
  }
  const range = await call('set_track_mixer', { tracks: [{ trackId: ids[0], volumeDb: 7 }] });
  assert.deepEqual(range.detail, { trackId: ids[0], field: 'volumeDb', requested: 7, minimum: -120, maximum: 6.0206,
    silence: '-inf' });
});

test('8i7 guard: automation, an unsupported kind, and an absent track refuse before any write', async () => {
  const { fake, rows, ids, call, workspace } = fixture();
  fakeMixerOf(rows[1]!).volumeAutomated = true;
  const automated = await call('set_track_mixer', { tracks: [
    { trackId: ids[0], volumeDb: -18 }, { trackId: ids[1], volumeDb: -12 }] });
  assert.equal(automated.failure.code, 'unsupported');
  assert.deepEqual(automated.detail, { reason: 'automation', fields: [{ trackId: ids[1], field: 'volume' }] });
  assert.equal(fakeMixerOf(rows[0]!).volume, 0.6812920690579614, 'the first track was not written either');
  assert.equal(workspace.changes.list().length, 0);
  const pan = await call('set_track_mixer', { tracks: [{ trackId: ids[1], pan: 0.5 }] });
  assert.equal(pan.readback.status, 'verified', 'pan has no automation, so it stays writable');
  assert.equal((await call('read_track_mixer', { trackIds: [ids[1]] })).data.tracks[0].volume.automated, true);

  const master = fake.model.tracks.find((row) => row.type === 'Master');
  if (master !== undefined) {
    const refused = await call('set_track_mixer', { tracks: [{ trackId: master.channelId, mute: true }] });
    assert.equal(refused.failure.code, 'unsupported');
    assert.equal(refused.detail.reason, 'track-kind');
  }
  const absent = await call('read_track_mixer', { trackIds: ['missing-track'] });
  assert.equal(absent.failure.code, 'absent');
});

test('8i7 identity: the trackId survives rename and reorder; a deleted track is absent', async () => {
  const { workspace, ids, call } = fixture(['gn-a', 'gn-b', 'gn-c']);
  await workspace.apply([{ op: 'track.rename', track: trackAt(ids[2]!), name: 'gn-renamed' }]);
  const set = await call('set_track_mixer', { tracks: [{ trackId: ids[2], volumeDb: -6 }] });
  assert.equal(set.readback.tracks[0].name, 'gn-renamed');
  assert.equal(set.readback.status, 'verified');
  await workspace.apply([{ op: 'track.delete', track: trackAt(ids[0]!) }], {
    clearance: { kind: 'directed-destruction', tool: 'delete_track' } as never });
  const read = await call('read_track_mixer', { trackIds: [ids[2]] });
  assert.equal(read.data.tracks[0].volume.db, -6, 'a lower deletion moves the bank row, not the address');
  assert.equal((await call('read_track_mixer', { trackIds: [ids[0]] })).failure.code, 'absent');
});

test('8i7 reversal: revert_change restores each field; a field that a person changed since stays', async () => {
  const { rows, ids, call } = fixture();
  const set = await call('set_track_mixer', { tracks: [
    { trackId: ids[0], volumeDb: -18, pan: -0.5 }, { trackId: ids[1], solo: true }] });
  const changeId = set.effects[0].changeId;
  // A person moves the pan of the first track after the write.
  fakeMixerOf(rows[0]!).pan = 0.75;
  const check = await call('check_revert', { changeId });
  assert.equal(check.failure, undefined, JSON.stringify(check));
  const reverted = await call('revert_change', { changeId });
  assert.equal(reverted.failure, undefined, JSON.stringify(reverted));
  assert.equal(fakeMixerOf(rows[0]!).volume, 0.6812920690579614, 'volume is back');
  assert.equal(fakeMixerOf(rows[0]!).pan, 0.75, 'the person\'s pan stays');
  assert.equal(fakeMixerOf(rows[1]!).solo, false, 'solo is back');
  assert.ok((reverted.readback.notRestored as Wire[]).some((item) => item.where?.mixerField === 'pan'),
    JSON.stringify(reverted.readback));
  assert.equal(fakeMixerOf(rows[1]!).volume, 0.6812920690579614, 'an unrelated field is unchanged');
});

test('8i7 reversal: automation added after the write blocks the reversal of that field only', async () => {
  const { rows, ids, call } = fixture();
  const set = await call('set_track_mixer', { tracks: [{ trackId: ids[0], volumeDb: -12, mute: true }] });
  fakeMixerOf(rows[0]!).volumeAutomated = true;
  const reverted = await call('revert_change', { changeId: set.effects[0].changeId });
  assert.equal(fakeMixerOf(rows[0]!).mute, false, 'mute is back');
  assert.equal(fakeMixerOf(rows[0]!).volume, 10 ** (-12 / 60), 'the automated volume stays');
  assert.ok((reverted.readback.notRestored as Wire[]).some((item) => item.where?.mixerField === 'volume'),
    JSON.stringify(reverted).slice(0, 800));
});

test('8i7 partial: a field that Bitwig refuses at execution keeps the other writes and names the change', async () => {
  const { rows, ids, call, workspace } = fixture();
  // Automation arrives between the tool read and the write.
  const racing: Workspace = { ...workspace, apply: async (ops, options) => {
    fakeMixerOf(rows[1]!).volumeAutomated = true;
    return workspace.apply(ops, options);
  } };
  const result = await call('set_track_mixer', { tracks: [
    { trackId: ids[0], volumeDb: -18 }, { trackId: ids[1], volumeDb: -12 }] }, racing);
  assert.equal(result.failure.code, 'partial', JSON.stringify(result).slice(0, 800));
  assert.equal(result.failure.effects.length, 1);
  assert.equal(result.detail.tracks[0].fields.volume.status, 'verified');
  assert.equal(result.detail.tracks[1].fields.volume.status, 'differs');
  assert.equal(fakeMixerOf(rows[0]!).volume, 10 ** (-18 / 60));
  assert.equal(fakeMixerOf(rows[1]!).volume, 0.6812920690579614);
});

test('8i8 readback: a verify read that fails keeps the write and reports readback unavailable', async () => {
  const { fake, rows, ids, call } = fixture();
  fake.failReadAfterApply = true;
  const result = await call('set_track_mixer', { tracks: [{ trackId: ids[0], volumeDb: -18 }] });
  assert.equal(result.failure, undefined, JSON.stringify(result).slice(0, 800));
  assert.equal(result.readback.status, 'unavailable');
  assert.equal(result.effects.length, 1);
  assert.ok(result.warnings.some((item: Wire) => item.code === 'readback-unavailable'));
  assert.equal(result.readback.tracks[0].fields.volume.status, 'unavailable');
  assert.equal(fakeMixerOf(rows[0]!).volume, 10 ** (-18 / 60), 'the write is in the project');
});

/** The fake applies the batch, then a person acts before the executor's verify read. */
class EditAfterApplyAdapter extends CountingAdapter {
  afterApply: (() => void) | undefined;
  override async apply(...args: Parameters<FakeAdapter['apply']>) {
    const receipt = await super.apply(...args);
    this.afterApply?.();
    this.afterApply = undefined;
    return receipt;
  }
}

test('8i7 review: a refused setter owns nothing, so reversal keeps a person\'s later edit of that field', async () => {
  const fake = new EditAfterApplyAdapter({ tracks: ['gn-pad'], scenes: 2 });
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `r-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(), documents: new IdentityRegistry(),
  });
  const row = fake.model.visibleTracks().find((item) => item.name === 'gn-pad')!;
  const call = async (name: string, args: Wire): Promise<Wire> =>
    await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  // The pan setter refuses at execution (automation arrives after the tool read). Then the person removes the
  // automation and moves the pan before the readback.
  const racing: Workspace = { ...workspace, apply: async (ops, options) => {
    fakeMixerOf(row).panAutomated = true;
    fake.afterApply = () => { fakeMixerOf(row).panAutomated = false; fakeMixerOf(row).pan = 0.75; };
    return workspace.apply(ops, options);
  } };
  const set = await callTool(racing, 'set_track_mixer', { tracks: [{ trackId: row.channelId, volumeDb: -18, pan: -0.5 }] },
    AGENT_NATIVE_TOOL_PROFILE) as Wire;
  assert.equal(set.failure.code, 'partial', JSON.stringify(set).slice(0, 600));
  const reverted = await call('revert_change', { changeId: set.failure.effects[0].changeId });
  assert.equal(fakeMixerOf(row).pan, 0.75, 'the person\'s pan stays');
  assert.equal(fakeMixerOf(row).volume, 0.6812920690579614, 'the written volume is reversed');
  assert.equal(reverted.failure, undefined, JSON.stringify(reverted).slice(0, 600));
});

test('8i7 review: a project switch between the prior read and the write refuses before any setter', async () => {
  const { fake, rows, ids, workspace } = fixture();
  const switching: Workspace = { ...workspace, apply: async (ops, options) => {
    // A saved copy keeps the trackIds and the Ghostnote revision.
    fake.model.project = 'fake-project-copy';
    return workspace.apply(ops, options);
  } };
  const result = await callTool(switching, 'set_track_mixer', { tracks: [{ trackId: ids[0], volumeDb: -18 }] },
    AGENT_NATIVE_TOOL_PROFILE) as Wire;
  assert.equal(result.failure?.code, 'stale-address', JSON.stringify(result).slice(0, 600));
  assert.deepEqual(result.failure.effects, []);
  assert.equal(fakeMixerOf(rows[0]!).volume, 0.6812920690579614, 'nothing was written');
});
