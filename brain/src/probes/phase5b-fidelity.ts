/**
 * Phase 1 session 5b — independent-handle note fidelity and gain.
 *
 * Cursor 0 is the only writer. Cursor 1 is the only read witness. The explicit
 * adapter partitions make it impossible for an executor read to select the
 * writing handle by accident.
 *
 * Use `npx tsx src/probes/phase5b-fidelity.ts measure` before a gain correction.
 * The default mode is the final live regression.
 */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import {
  NOTE_PROP_FIDELITY, addressKey, clip, notes as notesAt, scene, slot, track,
  type Address, type BatchRequest, type BitwigAdapter, type NoteRecord,
} from '../contract/index.js';
import { Executor } from '../engine/executor.js';
import { check, client, failureCount, note, pollUntil } from './lib.js';

const MEASURE_ONLY = process.argv[2] === 'measure';
const WRITER_CURSOR = '0';
const WITNESS_CURSOR = '1';
const TRACKS: Readonly<Record<string, string>> = {
  '98ba8aa3-dbce-4e51-8bb2-de9302542b6e': 'Instrument Layer',
  '4a6a024a-f213-48f1-9029-532fc077d857': 'Hybrid 2',
  'd61c23c2-4f85-4eee-bc08-8bb9baf6ff63': 'gn-A',
  '78a40fcf-3eae-48fc-badf-1ff18900166b': 'gn-B',
  'ae4caa0f-f689-4f17-88cf-a5ae0d9ebdd3': 'Group 5',
  'd367ac16-b7bd-4662-971f-fe924ec033a3': 'gn-lay',
  '9a88b37d-337a-4ef2-96a8-a147419d7cda': 'gn-lay4',
  '6fb96670-abde-4958-9147-f573a4b43918': 'gn-sel',
  '52bd865e-c958-4bda-b9d3-97d0ea2f463a': 'FX 1',
  '834e65ab-efa4-4bc6-ae9d-4eafd818d16e': 'Master',
};
const PROBE_TRACK_IDS = Object.entries(TRACKS)
  .filter(([, name]) => name.startsWith('gn-'))
  .map(([id]) => id);

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly channelId: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
}

const selection = async (): Promise<Selection> =>
  (await client.request('selection.status')) as Selection;

async function select(trackIndex: number, slotIndex: number): Promise<void> {
  await client.request('slot.select', { trackIndex, slotIndex, mechanism: 'slot' });
  const settled = await pollUntil(async () => {
    const current = await selection();
    return current.trackIndex === trackIndex && current.slotIndex === slotIndex;
  });
  if (!settled.ok) throw new Error(`selection did not reach track ${trackIndex}, row ${slotIndex}`);
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const close = (a: number, b: number, tolerance = 2e-3): boolean => Math.abs(a - b) <= tolerance;

/** Raw setter input, before the contract applies an inverse. */
async function setRawGain(trackIndex: number, row: number, value: number): Promise<void> {
  await client.request('cursor.pointTrack', { cursor: WRITER_CURSOR, trackIndex });
  await client.request('slot.select', { trackIndex, slotIndex: row, mechanism: 'track' });
  await sleep(200);
  await client.request('cursor.setStepSize', { cursor: WRITER_CURSOR, stepSize: 1 });
  await sleep(200);
  await client.request('cursor.setNoteProps', {
    cursor: WRITER_CURSOR, x: 0, y: 60, props: { gain: value },
  });
  await sleep(200);
}

/** Raw read through the cursor that no write path can allocate. */
async function rawWitnessGain(trackIndex: number, row: number): Promise<number | undefined> {
  await client.request('cursor.pointTrack', { cursor: WITNESS_CURSOR, trackIndex });
  await client.request('slot.select', { trackIndex, slotIndex: row, mechanism: 'track' });
  await sleep(200);
  await client.request('cursor.setStepSize', { cursor: WITNESS_CURSOR, stepSize: 1 });
  await sleep(200);
  const result = (await client.request('cursor.getNotesVerbose', {
    cursor: WITNESS_CURSOR, channel: 0,
  })) as { notes: Record<string, unknown>[] };
  const value = result.notes.find((item) => item['x'] === 0 && item['y'] === 60)?.['gain'];
  return typeof value === 'number' ? value : undefined;
}

/** An executor adapter whose reads can only use the witness partition. */
function independentlyRead(writer: BitwigAdapter, witness: BitwigAdapter): BitwigAdapter {
  return {
    hello: () => writer.hello(),
    resolve: (refs) => writer.resolve(refs),
    tracks: () => writer.tracks(),
    devices: (trackRef) => writer.devices(trackRef),
    read: (refs) => witness.read(refs),
    apply: (batch: BatchRequest) => writer.apply(batch),
    settle: (budget) => writer.settle(budget),
    revision: () => writer.revision(),
    contentSince: (since) => writer.contentSince(since),
    preserveSelection: (work) => writer.preserveSelection(work),
    showClipInEditor: (clipRef, verifiedAt) => writer.showClipInEditor(clipRef, verifiedAt),
    close: () => writer.close(),
  };
}

const exactNote = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0,
  pitch: 60,
  velocity: 96,
  durationBeats: 0.75,
  releaseVelocity: 0.4,
  velocitySpread: 0.2,
  gain: 0.7,
  pan: -0.25,
  timbre: 0.3,
  transpose: 2,
  chance: 0.6,
  isChanceEnabled: true,
  isMuted: true,
  isOccurrenceEnabled: true,
  occurrence: 'FIRST',
  isRecurrenceEnabled: true,
  recurrence: [4, 5],
  isRepeatEnabled: true,
  repeatCount: 3,
  repeatCurve: 0.2,
  repeatVelocityCurve: -0.1,
  repeatVelocityEnd: 0.8,
  ...over,
});

async function readNotes(adapter: BitwigAdapter, address: Address): Promise<readonly NoteRecord[]> {
  const snapshot = await adapter.read([address]);
  const value = snapshot.entries[addressKey(address)]?.value;
  return value?.of === 'notes' ? value.notes : [];
}

await client.connect();
const originalSelection = await selection();
const writer = new LiveAdapter({
  transport: new BridgeTransport(client), cursorRefs: [WRITER_CURSOR],
});
const witness = new LiveAdapter({
  transport: new BridgeTransport(client), cursorRefs: [WITNESS_CURSOR],
});
let created = false;
let probeRow: number | undefined;
let probeTrack: TrackRow | undefined;

try {
  await writer.hello();
  await witness.hello();
  const listed = (await client.request('track.list')) as { tracks: TrackRow[] };
  const identitiesMatch = listed.tracks.length === Object.keys(TRACKS).length
    && listed.tracks.every((row) => TRACKS[row.channelId] === row.name);
  check('5b-L0: all destructive fixture identities match the documented baseline', identitiesMatch,
    listed.tracks.map(({ index, name, channelId }) => ({ index, name, channelId })));
  if (!identitiesMatch) throw new Error('fixture identity mismatch');

  for (const trackId of PROBE_TRACK_IDS) {
    const candidate = listed.tracks.find((row) => row.channelId === trackId);
    if (candidate === undefined) continue;
    for (let row = 2; row < 10; row += 1) {
      const status = (await client.request('slot.status', {
        trackIndex: candidate.index, slotIndex: row,
      })) as { hasContent: boolean };
      if (!status.hasContent) {
        probeTrack = candidate;
        probeRow = row;
        break;
      }
    }
    if (probeTrack !== undefined) break;
  }
  check('5b-L1: the probe claims a slot proven empty by live readback',
    probeTrack !== undefined && probeRow !== undefined, { track: probeTrack?.name, row: probeRow });
  if (probeTrack === undefined || probeRow === undefined) throw new Error('no empty probe slot');

  const at = await writer.revision();
  const probeSlot = slot(track(probeTrack.channelId), scene(probeRow, at.sceneEpoch));
  const probeClip = clip(probeSlot);
  const address = notesAt(probeClip);
  await writer.apply({ ops: [{ op: 'clip.create', slot: probeSlot, lengthBeats: 4 }] });
  created = true;
  await writer.apply({ ops: [{
    op: 'note.write', clip: probeClip,
    notes: [{ startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1 }],
  }] });
  await writer.settle('noteWrite');

  const samples: { written: number; first?: number; repeated?: number }[] = [];
  for (const value of [0.1, 0.25, 0.4, 0.49, 0.5, 0.51, 0.6, 0.7, 1]) {
    await setRawGain(probeTrack.index, probeRow, 0);
    await setRawGain(probeTrack.index, probeRow, value);
    const first = await rawWitnessGain(probeTrack.index, probeRow);
    const repeated = await rawWitnessGain(probeTrack.index, probeRow);
    samples.push({ written: value, first, repeated });
  }
  check('5b-L2: repeated independent gain reads are stable at every measured input',
    samples.every((sample) => sample.first !== undefined && sample.repeated !== undefined
      && close(sample.repeated, sample.first)), samples);

  check('5b-L3: the measured curve proves one global read / 2 inverse',
    samples.every((sample) => sample.first !== undefined
      && close(sample.first, sample.written * 2)), samples);

  await setRawGain(probeTrack.index, probeRow, 0);
  const revertedGain = await rawWitnessGain(probeTrack.index, probeRow);
  check('5b-L4: the raw gain measurement reverts through the independent handle',
    revertedGain !== undefined && close(revertedGain, 0), { revertedGain });

  if (!MEASURE_ONLY) {
    const exact = Object.entries(NOTE_PROP_FIDELITY)
      .filter(([, fidelity]) => fidelity === 'exact').map(([property]) => property);
    check('5b-L5: the final table is 20 exact properties plus pressure unwritable',
      exact.length === 20 && NOTE_PROP_FIDELITY.gain === 'exact'
        && NOTE_PROP_FIDELITY.pressure === 'unwritable',
      NOTE_PROP_FIDELITY);

    await writer.apply({ ops: [{ op: 'note.clear', clip: probeClip }] });
    const authored = [exactNote(), exactNote({ startBeats: 2, pitch: 67, occurrence: 'LAST' })];
    await writer.apply({ ops: [{ op: 'note.write', clip: probeClip, notes: authored }] });
    await writer.settle('noteWrite');
    const baseline = await readNotes(witness, address);
    check('5b-L6: the independent handle reads every exact property, including gain',
      baseline.length === 2 && exact.every((property) => property === 'duration'
          ? baseline.some((item) => item.durationBeats !== undefined)
          : baseline.some((item) => property in item)),
      { exact, baseline });

    const executor = new Executor(independentlyRead(writer, witness));
    const take = await executor.run([
      { op: 'note.clear', clip: probeClip },
      { op: 'note.write', clip: probeClip, notes: [exactNote({ pitch: 72, gain: 0.25 })] },
    ]);
    check('5b-L7: the patch applies and verifies only through the witness handle',
      take.report.applied && take.report.disagreements.length === 0, take.report);
    const reverted = await executor.revertUnchecked(take);
    const restored = await readNotes(witness, address);
    check('5b-L8: all 20 exact properties return to their independent-read baseline',
      reverted.unrestored.length === 0 && JSON.stringify(restored) === JSON.stringify(baseline),
      { unrestored: reverted.unrestored, restored, baseline });

    const beforePressure = JSON.stringify(await readNotes(witness, address));
    let pressureRefused = false;
    try {
      await writer.apply({ ops: [{
        op: 'note.write', clip: probeClip,
        notes: [{ startBeats: 3, pitch: 74, velocity: 90, durationBeats: 0.5, pressure: 0.9 }],
      }] });
    } catch (error) {
      pressureRefused = error instanceof Error && /pressure cannot be written/.test(error.message);
    }
    const afterPressure = JSON.stringify(await readNotes(witness, address));
    check('5b-L9: pressure refuses before any mutation reaches Bitwig',
      pressureRefused && afterPressure === beforePressure, { pressureRefused });
  }
} catch (error) {
  check('5b-LX: the focused live probe completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (created && probeTrack !== undefined && probeRow !== undefined) {
    try {
      const current = await writer.revision();
      const target = slot(track(probeTrack.channelId), scene(probeRow, current.sceneEpoch));
      await writer.apply({ ops: [{ op: 'clip.delete', slot: target }] });
      await writer.settle('trackStruct');
      const status = (await client.request('slot.status', {
        trackIndex: probeTrack.index, slotIndex: probeRow,
      })) as { hasContent: boolean };
      check('5b-L10: the probe clip is removed', !status.hasContent);
    } catch (error) {
      check('5b-L10: the probe clip is removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  if (originalSelection.trackIndex >= 0 && originalSelection.slotIndex >= 0) {
    try {
      await select(originalSelection.trackIndex, originalSelection.slotIndex);
      check('5b-L11: the probe restores the pre-run selection', true, originalSelection);
    } catch (error) {
      check('5b-L11: the probe restores the pre-run selection', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  await writer.close();
}

note(`Phase 1 session 5b ${MEASURE_ONLY ? 'measurement' : 'regression'}: `
  + `${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
