/** Phase 4 session 4b: live triplet, expression, and selection regression. */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import {
  addressKey, clip, notes as notesAt, scene, slot, track, type NoteRecord,
} from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { check, client as bridge, failureCount, note } from './lib.js';

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly channelId: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
  readonly mixerTrackIndex?: number;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const sameSelection = (left: Selection, right: Selection): boolean =>
  left.trackIndex === right.trackIndex
    && left.slotIndex === right.slotIndex
    && left.mixerTrackIndex === right.mixerTrackIndex;

async function occupied(trackIndex: number, row: number): Promise<boolean> {
  const result = await bridge.request('slot.status', { trackIndex, slotIndex: row }) as {
    readonly hasContent: boolean;
  };
  return result.hasContent;
}

async function select(trackIndex: number, slotIndex: number): Promise<void> {
  await bridge.request('slot.select', { trackIndex, slotIndex, mechanism: 'track' });
}

async function restoreSelection(entry: Selection): Promise<void> {
  if (entry.mixerTrackIndex !== undefined) {
    await bridge.request('cursor.pin', { cursor: 'fine', pinned: false });
    await bridge.request('cursor.pinTrack', { cursor: 'fine', pinned: false });
    await bridge.request('cursor.pointTrack', {
      cursor: 'fine', trackIndex: entry.mixerTrackIndex,
    });
  }
  await select(entry.trackIndex, entry.slotIndex);
  await wait(150);
  if (entry.mixerTrackIndex !== undefined) {
    await bridge.request('cursor.pinTrack', { cursor: 'fine', pinned: true });
    await bridge.request('cursor.pin', { cursor: 'fine', pinned: true });
  }
}

await bridge.connect();
const adapter = new LiveAdapter({ transport: new BridgeTransport(bridge) });
const executor = new Executor(adapter);
let created = false;
let take: Awaited<ReturnType<Executor['run']>> | undefined;
let target: ReturnType<typeof clip> | undefined;
let targetIndex = -1;
let targetRow = -1;
let entrySelection: Selection | undefined;

try {
  await adapter.hello();
  const revision = await adapter.revision();
  if (revision.project !== '26.05-2 moon') {
    throw new Error(`expected project 26.05-2 moon, got ${revision.project}`);
  }
  const listed = await bridge.request('track.list') as { readonly tracks: readonly TrackRow[] };
  const lead = listed.tracks.find((row) => row.name === 'Lead');
  const harmony = listed.tracks.find((row) => row.name === 'Harmony');
  if (lead === undefined || harmony === undefined) throw new Error('the accepted source tracks are absent');
  targetIndex = lead.index;
  targetRow = 5;
  entrySelection = await bridge.request('selection.status') as Selection;
  check('4b-R1: the disposable regression target is empty',
    !(await occupied(targetIndex, targetRow)), { targetIndex, targetRow });
  if (await occupied(targetIndex, targetRow)) throw new Error('the disposable target is occupied');

  target = clip(slot(track(lead.channelId), scene(targetRow, revision.sceneEpoch)));
  await adapter.apply({ ops: [{ op: 'clip.create', slot: target.slot, lengthBeats: 4 }] });
  created = true;
  const wanted: NoteRecord = {
    startBeats: 1 / 6,
    pitch: 67,
    velocity: 91,
    durationBeats: 1 / 3,
    pan: -0.25,
  };
  const running = executor.run([{ op: 'note.write', clip: target, channel: 7, notes: [wanted] }]);
  await wait(10);
  for (const [trackIndex, row] of [
    [harmony.index, 0], [lead.index, 1], [harmony.index, 2], [lead.index, 3],
  ] as const) {
    await select(trackIndex, row);
    await wait(30);
  }
  take = await running;
  check('4b-R2: the write stays applied during selection interference',
    take.report.applied && take.report.disagreements.length === 0, take.report);

  const address = notesAt(target, 7);
  const snapshot = await adapter.read([address]);
  const value = snapshot.entries[addressKey(address)]?.value;
  const got = value?.of === 'notes' ? value.notes : [];
  const exact = got.length === 1
    && Math.abs(got[0]!.startBeats - wanted.startBeats) < 1e-9
    && Math.abs(got[0]!.durationBeats - wanted.durationBeats) < 1e-6
    && got[0]!.pitch === wanted.pitch
    && got[0]!.pan !== undefined
    && Math.abs(got[0]!.pan - wanted.pan!) < 2e-3;
  check('4b-R3: the dedicated reader preserves the triplet note and expression', exact, got);

  const reverted = await executor.revertUnchecked(take);
  take = undefined;
  const empty = await adapter.read([address]);
  const emptyValue = empty.entries[addressKey(address)]?.value;
  check('4b-R4: reversal restores the owned clip to empty',
    reverted.unrestored.length === 0
      && emptyValue?.of === 'notes' && emptyValue.notes.length === 0,
    { reverted: reverted.unrestored, emptyValue });

  await adapter.apply({ ops: [{ op: 'clip.delete', slot: target.slot }] });
  created = false;
  await restoreSelection(entrySelection);
  const finalSelection = await bridge.request('selection.status') as Selection;
  check('4b-R5: cleanup restores the target and entry selection',
    !(await occupied(targetIndex, targetRow)) && sameSelection(finalSelection, entrySelection),
    { entrySelection, finalSelection });
} catch (error) {
  check('4b-RX: the live regression completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (take !== undefined) {
    try { await executor.revertUnchecked(take); } catch {}
  }
  if (created && target !== undefined) {
    try { await adapter.apply({ ops: [{ op: 'clip.delete', slot: target.slot }] }); } catch {}
  }
  if (entrySelection !== undefined) {
    try { await restoreSelection(entrySelection); } catch {}
  }
  bridge.disconnect();
}

note(`Phase 4 session 4b read regression: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
