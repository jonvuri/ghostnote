/**
 * Adapter call budgets of the agent-native document tools (8h4c2 follow-up).
 *
 * Each live adapter call costs control-surface turns: a mark (`revision`,
 * `contentSince`) is one turn (E246: `revision.get` and `track.list` go out
 * together), a sourced read is one `clip.read` capture plus its marks and slot
 * checks, and an apply points a writer cursor. A new mark or read in a tool or
 * the executor adds about 24 ms for each turn. These budgets make such a change
 * visible offline. When a budget changes on purpose, update the expected counts
 * here and the performance ledger (context/contracts/GHOSTNOTE_PERFORMANCE_LEDGER.md)
 * in the same session, and state the cost in the E record.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { clip, scene, slot, track, type NoteRecord } from '../contract/index.js';
import { parse, type StateDocument } from '../document/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from './tools.js';
import { workspaceOf } from './workspace.js';

type Wire = Record<string, any>;
type Counts = Record<string, number>;

/** Counts the adapter calls that cost host turns. A sourced read is a `clip.read` capture. */
class CountingAdapter extends FakeAdapter {
  counts: Counts = {};
  private count(name: string): void { this.counts[name] = (this.counts[name] ?? 0) + 1; }
  override async revision(...args: Parameters<FakeAdapter['revision']>) { this.count('mark'); return super.revision(...args); }
  override async contentSince(...args: Parameters<FakeAdapter['contentSince']>) { this.count('delta'); return super.contentSince(...args); }
  override async tracks(...args: Parameters<FakeAdapter['tracks']>) { this.count('tracks'); return super.tracks(...args); }
  override async resolve(...args: Parameters<FakeAdapter['resolve']>) { this.count('resolve'); return super.resolve(...args); }
  override async apply(...args: Parameters<FakeAdapter['apply']>) { this.count('apply'); return super.apply(...args); }
  override async read(...args: Parameters<FakeAdapter['read']>) {
    this.count(args[1]?.sources === undefined ? 'read' : 'clipRead');
    return super.read(...args);
  }
}

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, releaseVelocity: 100 / 127,
  isChanceEnabled: true, isOccurrenceEnabled: true, isRecurrenceEnabled: true, isRepeatEnabled: true, ...over,
});

async function fixture() {
  const fake = new CountingAdapter({ tracks: ['gn-budget'], scenes: 4 });
  const [trackState] = await fake.tracks();
  const trackId = trackState!.channelId;
  let id = 0;
  const workspace = workspaceOf({
    ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `budget-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(),
    documents: new IdentityRegistry(),
  });
  for (const row of [0, 1]) {
    await workspace.apply([{ op: 'clip.create', slot: slot(track(trackId), scene(row, (await fake.revision()).sceneEpoch)), lengthBeats: 8 }]);
    const fakeSlot = fake.model.visibleTracks()[0]!.slots[row]!;
    for (let channel = 0; channel < 16; channel += 1) {
      for (let k = 0; k < 4; k += 1) {
        const item = note({ pitch: 60 + k, startBeats: k });
        fakeSlot.notes.set(`${channel}:${item.pitch}:${item.startBeats}`, item);
      }
    }
  }
  fake.model.revision += 1;
  const call = async (name: string, args: Wire): Promise<{ result: Wire; counts: Counts }> => {
    fake.counts = {};
    const result = await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
    return { result, counts: fake.counts };
  };
  return { trackId, call, clip: (row: number) => clip(slot(track(trackId), scene(row, 1))) };
}

const patch = (base: Wire, lines: string[]) => ['DOC ghostnote-document 1.0 patch',
  `BASE ${JSON.stringify({ sha256: base.sha256, ref: base.ref })}`,
  'FIELDS id clip at duration pitch velocity channel mute', ...lines].join('\n') + '\n';
const documentOf = (result: Wire) => parse(result.data.document as string, 'fields') as StateDocument;

test('call budget: read_launcher_clip, first and repeated', async () => {
  const fx = await fixture();
  const first = await fx.call('read_launcher_clip', { trackId: fx.trackId, row: 0 });
  assert.equal(first.result.failure, undefined);
  assert.deepEqual(first.counts, { mark: 1, tracks: 1, clipRead: 1, delta: 1 });
  // A repeated read also judges the prior ref: one more delta.
  const again = await fx.call('read_launcher_clip', { trackId: fx.trackId, row: 0 });
  assert.deepEqual(again.counts, { mark: 1, tracks: 1, clipRead: 1, delta: 2 });
});

test('call budget: check_launcher_clips reads all refs in one adapter read', async () => {
  const fx = await fixture();
  const refs = [];
  for (const row of [0, 1]) refs.push((await fx.call('read_launcher_clip', { trackId: fx.trackId, row })).result.authority.base.ref);
  const checked = await fx.call('check_launcher_clips', { refs });
  assert.equal(checked.result.failure, undefined);
  // Refs with one mark share one delta.
  assert.deepEqual(checked.counts, { mark: 2, clipRead: 1, delta: 1 });
});

test('call budget: edit_launcher_clip on the targeted, whole-clip, and property routes', async () => {
  const fx = await fixture();
  let read = (await fx.call('read_launcher_clip', { trackId: fx.trackId, row: 0 })).result;
  const clipId = documentOf(read).clips[0]!.id;
  // Targeted: the fresh read is the stash read (D38); the verify read is the readback.
  const targeted = await fx.call('edit_launcher_clip', { trackId: fx.trackId, row: 0,
    document: patch(read.authority.base, Array.from({ length: 16 }, (_, c) => `ADD i${c} ${clipId} 9/2 1/4 96 100 ${c + 1} false`)) });
  assert.equal(targeted.result.readback?.status, 'verified', JSON.stringify(targeted.result).slice(0, 300));
  assert.deepEqual(targeted.counts, { mark: 1, tracks: 1, clipRead: 2, delta: 3, apply: 1 });

  // Whole-clip: the executor reads the clip again before the write (D38).
  read = (await fx.call('read_launcher_clip', { trackId: fx.trackId, row: 0 })).result;
  const id = documentOf(read).events.find((event) => event.pitch === 60 && event.at === '0' && event.channel === undefined)!.id;
  const whole = await fx.call('edit_launcher_clip', { trackId: fx.trackId, row: 0,
    document: patch(read.authority.base, [`UPDATE ${id} {"velocity":70}`]) });
  assert.equal(whole.result.plan.route, 'whole-clip');
  assert.equal(whole.result.readback?.status, 'verified');
  assert.deepEqual(whole.counts, { mark: 2, tracks: 1, clipRead: 3, delta: 3, resolve: 1, apply: 1 });

  // A clip property change: also the executor stash read.
  read = (await fx.call('read_launcher_clip', { trackId: fx.trackId, row: 0 })).result;
  const named = await fx.call('edit_launcher_clip', { trackId: fx.trackId, row: 0,
    document: patch(read.authority.base, [`CLIP_UPDATE ${clipId} {"name":"budget"}`]) });
  assert.equal(named.result.readback?.status, 'verified');
  assert.deepEqual(named.counts, { mark: 2, tracks: 1, clipRead: 3, delta: 3, resolve: 1, apply: 1 });
});
