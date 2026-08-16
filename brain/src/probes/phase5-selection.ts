/**
 * Phase 1 session 5, B4 — one selection restore per executor pipeline.
 *
 * The probe creates one clip in a verified-empty fixture slot. It puts the UI
 * selection on gn-B, runs one note pipeline on a documented fixture track, and
 * verifies one borrow plus one restore. It removes the owned clip and restores
 * the selection on every exit.
 */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import {
  addressKey, clip, notes as notesAt, scene, slot, track, type NoteRecord,
} from '../contract/index.js';
import { Executor } from '../engine/executor.js';
import { check, client, failureCount, note, pollUntil } from './lib.js';

const TRACK_A_ID = 'd61c23c2-4f85-4eee-bc08-8bb9baf6ff63';
const TRACK_B_ID = '78a40fcf-3eae-48fc-badf-1ff18900166b';
const PROBE_TRACK_IDS = [
  TRACK_A_ID,
  TRACK_B_ID,
  'd367ac16-b7bd-4662-971f-fe924ec033a3',
  '9a88b37d-337a-4ef2-96a8-a147419d7cda',
  '6fb96670-abde-4958-9147-f573a4b43918',
] as const;

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly channelId: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
  readonly changes: number;
}

const selection = async (): Promise<Selection> =>
  (await client.request('selection.status')) as Selection;

async function select(trackIndex: number, slotIndex: number): Promise<Selection> {
  await client.request('slot.select', { trackIndex, slotIndex, mechanism: 'slot' });
  const settled = await pollUntil(async () => {
    const current = await selection();
    return current.trackIndex === trackIndex && current.slotIndex === slotIndex;
  });
  if (!settled.ok) throw new Error(`selection did not reach track ${trackIndex}, row ${slotIndex}`);
  return selection();
}

await client.connect();
const original = await selection();
const adapter = new LiveAdapter({ transport: new BridgeTransport(client) });
let created = false;
let probeRow: number | undefined;
let probeTrack: TrackRow | undefined;

try {
  await adapter.hello();
  const listed = (await client.request('track.list')) as { tracks: TrackRow[] };
  const trackA = listed.tracks.find((row) => row.channelId === TRACK_A_ID);
  const trackB = listed.tracks.find((row) => row.channelId === TRACK_B_ID);
  check('B4-L0: the destructive fixture identities match the documented baseline',
    trackA?.name === 'gn-A' && trackB?.name === 'gn-B', { trackA, trackB });
  if (trackA === undefined || trackB === undefined) throw new Error('fixture identity mismatch');

  for (const trackId of PROBE_TRACK_IDS) {
    const candidate = listed.tracks.find((row) => row.channelId === trackId);
    if (candidate === undefined) continue;
    for (let row = 2; row < 10; row += 1) {
      const occupied = ((await client.request('slot.status', {
        trackIndex: candidate.index,
        slotIndex: row,
      })) as { hasContent: boolean }).hasContent;
      if (!occupied) {
        probeTrack = candidate;
        probeRow = row;
        break;
      }
    }
    if (probeTrack !== undefined) break;
  }
  check('B4-L1: one probe slot is positively empty before mutation',
    probeTrack !== undefined && probeRow !== undefined,
    { track: probeTrack?.name, row: probeRow });
  if (probeTrack === undefined || probeRow === undefined) {
    throw new Error('no documented fixture track has an empty probe row from 2 through 9');
  }

  const at = await adapter.revision();
  const probeSlot = slot(track(probeTrack.channelId), scene(probeRow, at.sceneEpoch));
  const probeClip = clip(probeSlot);
  const address = notesAt(probeClip);
  const requestedBaseline: NoteRecord[] = [{
    startBeats: 0,
    pitch: 60,
    velocity: 100,
    durationBeats: 1,
  }];

  await adapter.apply({ ops: [{ op: 'clip.create', slot: probeSlot, lengthBeats: 4 }] });
  created = true;
  await adapter.apply({ ops: [{ op: 'note.write', clip: probeClip, notes: requestedBaseline }] });
  await adapter.settle('noteWrite');
  const baselineEntry = (await adapter.read([address])).entries[addressKey(address)]?.value;
  if (baselineEntry?.of !== 'notes') throw new Error('the baseline note did not read back');
  const baseline = baselineEntry.notes;

  const before = await select(trackB.index, 0);
  const take = await new Executor(adapter).run([{
    op: 'note.write',
    clip: probeClip,
    notes: [{ startBeats: 1, pitch: 67, velocity: 96, durationBeats: 0.5 }],
  }]);
  const restored = await selection();

  check('B4-L2: the executor pipeline applied and verified its note write',
    take.report.applied && take.report.disagreements.length === 0, take.report);
  check('B4-L3: one borrow and one restore replace three capture/restore pairs',
    restored.changes - before.changes === 2,
    { changes: restored.changes - before.changes });
  check('B4-L4: the pipeline restores the user to the original clip',
    restored.trackIndex === trackB.index && restored.slotIndex === 0,
    { before, restored });

  await new Executor(adapter).revertUnchecked(take);
  const final = await adapter.read([address]);
  const value = final.entries[addressKey(address)]?.value;
  check('B4-L5: cleanup reversal restores the owned clip content exactly',
    value?.of === 'notes' && JSON.stringify(value.notes) === JSON.stringify(baseline), value);
} catch (error) {
  check('B4-LX: the focused live probe completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (created && probeTrack !== undefined && probeRow !== undefined) {
    try {
      const current = await adapter.revision();
      const probeSlot = slot(track(probeTrack.channelId), scene(probeRow, current.sceneEpoch));
      await adapter.apply({ ops: [{ op: 'clip.delete', slot: probeSlot }] });
      await adapter.settle('trackStruct');
      const listed = (await client.request('track.list')) as { tracks: TrackRow[] };
      const trackIndex = listed.tracks.find((row) => row.channelId === probeTrack?.channelId)?.index;
      if (trackIndex === undefined) throw new Error('the probe track became unreachable during cleanup');
      const empty = !((await client.request('slot.status', {
        trackIndex,
        slotIndex: probeRow,
      })) as { hasContent: boolean }).hasContent;
      check('B4-L6: the probe clip is removed', empty);
    } catch (error) {
      check('B4-L6: the probe clip is removed', false,
        error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    }
  }
  if (original.trackIndex >= 0 && original.slotIndex >= 0) {
    try {
      const restored = await select(original.trackIndex, original.slotIndex);
      check('B4-L7: the probe restores the pre-run user selection',
        restored.trackIndex === original.trackIndex && restored.slotIndex === original.slotIndex,
        { original, restored });
    } catch (error) {
      check('B4-L7: the probe restores the pre-run user selection', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  await adapter.close();
}

note(`Phase 1 session 5 B4: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
