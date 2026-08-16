/**
 * Phase 1 session 5d repair — pan control and selection interference.
 *
 * Cursor 0 runs the production executor. Cursor 1 reads each result through an
 * independent handle. The interference arm changes selection through ordinary
 * slot selection calls while the production stages run.
 */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import {
  addressKey, clip, notes as notesAt, scene, slot, track,
  type NoteRecord,
} from '../contract/index.js';
import { Executor } from '../engine/executor.js';
import { emptyObservationRecord, encodeObservationRecord } from '../observation/index.js';
import { check, client, failureCount, note, pollUntil } from './lib.js';

const PROJECT = 'gn-scale-test';
const WRITER_CURSOR = '0';
const WITNESS_CURSOR = '1';
const ROWS = 10;
const EMPTY_RECORD = encodeObservationRecord(emptyObservationRecord());
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

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly channelId: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
}

interface Cell extends Selection {
  readonly channelId: string;
  readonly name: string;
}

const selection = async (): Promise<Selection> =>
  (await client.request('selection.status')) as Selection;

async function select(target: Selection): Promise<void> {
  await client.request('slot.select', { ...target, mechanism: 'slot' });
  const settled = await pollUntil(async () => {
    const current = await selection();
    return current.trackIndex === target.trackIndex && current.slotIndex === target.slotIndex;
  });
  if (!settled.ok) {
    throw new Error(`selection did not reach track ${target.trackIndex}, row ${target.slotIndex}`);
  }
}

async function hasContent(target: Selection): Promise<boolean> {
  const result = (await client.request('slot.status', {
    trackIndex: target.trackIndex,
    slotIndex: target.slotIndex,
  })) as { hasContent: boolean };
  return result.hasContent;
}

function requestedNotes(offset: number): NoteRecord[] {
  const pans = [-0.5, -0.25, 0.25, 0.5] as const;
  return Array.from({ length: 40 }, (_, i) => ({
    startBeats: (i % 8) * 0.5,
    pitch: 40 + i,
    velocity: 80 + (i % 20),
    durationBeats: 0.25,
    pan: pans[(i + offset) % pans.length],
  }));
}

function exactPans(got: readonly NoteRecord[], wanted: readonly NoteRecord[]): boolean {
  return wanted.every((expected) => got.some((actual) =>
    actual.pitch === expected.pitch
    && Math.abs(actual.startBeats - expected.startBeats) <= 2e-3
    && actual.pan !== undefined
    && Math.abs(actual.pan - (expected.pan ?? 0)) <= 2e-3));
}

async function readNotes(adapter: LiveAdapter, target: ReturnType<typeof notesAt>) {
  const snapshot = await adapter.read([target]);
  const value = snapshot.entries[addressKey(target)]?.value;
  return value?.of === 'notes' ? value.notes : [];
}

async function interference(targets: readonly Cell[]): Promise<number> {
  let changes = 0;
  for (let i = 0; i < 24; i += 1) {
    await select(targets[i % targets.length]!);
    changes += 1;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  return changes;
}

await client.connect();
const originalSelection = await selection();
const writer = new LiveAdapter({
  transport: new BridgeTransport(client), cursorRefs: [WRITER_CURSOR],
});
const witness = new LiveAdapter({
  transport: new BridgeTransport(client), cursorRefs: [WITNESS_CURSOR],
});
const executor = new Executor(writer);
let created = false;
let probe: Cell | undefined;

try {
  await writer.hello();
  await witness.hello();
  const listed = (await client.request('track.list')) as { tracks: TrackRow[] };
  const identitiesMatch = listed.tracks.length === Object.keys(TRACKS).length
    && listed.tracks.every((row) => TRACKS[row.channelId] === row.name);
  check('5dr-L0: all destructive fixture identities match the documented baseline',
    identitiesMatch, listed.tracks);
  if (!identitiesMatch) throw new Error('fixture identity mismatch');

  const rig = (await client.request('rig.info')) as { scenes?: number; sceneCount?: number };
  const mark = (await client.request('revision.get')) as { project?: string };
  const observation = (await client.request('observation.read')) as {
    available?: boolean; value?: string;
  };
  check('5dr-L1: project, rows, and observation record match the baseline',
    mark.project === PROJECT && rig.scenes === 16 && rig.sceneCount === ROWS
      && observation.available === true && observation.value === EMPTY_RECORD,
    { project: mark.project, rig, observation });
  if (mark.project !== PROJECT || rig.scenes !== 16 || rig.sceneCount !== ROWS
      || observation.available !== true || observation.value !== EMPTY_RECORD) {
    throw new Error('live project baseline mismatch');
  }

  const gnTracks = listed.tracks.filter((row) => row.name.startsWith('gn-'));
  for (let row = ROWS - 1; row >= 2 && probe === undefined; row -= 1) {
    for (const item of gnTracks) {
      const candidate = {
        trackIndex: item.index, slotIndex: row, channelId: item.channelId, name: item.name,
      };
      if (!(await hasContent(candidate))) {
        probe = candidate;
        break;
      }
    }
  }
  check('5dr-L2: the probe claims one slot proven empty by live readback',
    probe !== undefined, probe);
  if (probe === undefined) throw new Error('no empty probe slot');

  const interferenceCells: Cell[] = [];
  for (const item of gnTracks) {
    for (let row = 0; row < ROWS; row += 1) {
      const candidate = {
        trackIndex: item.index, slotIndex: row, channelId: item.channelId, name: item.name,
      };
      if ((candidate.trackIndex !== probe.trackIndex || candidate.slotIndex !== probe.slotIndex)
          && await hasContent(candidate)) {
        interferenceCells.push(candidate);
        break;
      }
    }
    if (interferenceCells.length >= 3) break;
  }
  check('5dr-L3: selection interference has occupied cells on three tracks',
    interferenceCells.length >= 3, interferenceCells);
  if (interferenceCells.length < 3) throw new Error('not enough occupied interference cells');

  const at = await writer.revision();
  const probeClip = clip(slot(track(probe.channelId), scene(probe.slotIndex, at.sceneEpoch)));
  const address = notesAt(probeClip);
  await writer.apply({ ops: [{ op: 'clip.create', slot: probeClip.slot, lengthBeats: 4 }] });
  created = true;

  const control = requestedNotes(0);
  const controlTake = await executor.run(control.map((item) => ({
    op: 'note.write' as const, clip: probeClip, notes: [item],
  })));
  const controlRead = await readNotes(witness, address);
  check('5dr-L4: all control pan values pass independent readback',
    controlTake.report.applied && controlTake.report.disagreements.length === 0
      && exactPans(controlRead, control),
    { report: controlTake.report, read: controlRead });
  const controlRevert = await executor.revertUnchecked(controlTake);
  check('5dr-L5: control revert restores the empty clip through the witness',
    controlRevert.unrestored.length === 0 && (await readNotes(witness, address)).length === 0,
    controlRevert.unrestored);

  await select(interferenceCells[0]!);
  const interferenceStart = await selection();
  const interfered = requestedNotes(1);
  const run = executor.run(interfered.map((item) => ({
    op: 'note.write' as const, clip: probeClip, notes: [item],
  })));
  const changes = await interference(interferenceCells);
  const interferenceTake = await run;
  const interferenceEnd = await selection();
  const writerRetry = await readNotes(writer, address);
  const interferenceRead = await readNotes(witness, address);
  check('5dr-L6: the interference arm changed selection repeatedly', changes === 24, { changes });
  check('5dr-L7: all interfered pan values pass independent readback',
    interferenceTake.report.applied && exactPans(interferenceRead, interfered),
    { report: interferenceTake.report, read: interferenceRead });
  check('5dr-L7a: a repeated writer read agrees with the independent handle',
    exactPans(writerRetry, interfered), { report: interferenceTake.report, writerRetry });
  check('5dr-L8: the executor restores the interference-arm entry selection',
    interferenceEnd.trackIndex === interferenceStart.trackIndex
      && interferenceEnd.slotIndex === interferenceStart.slotIndex,
    { interferenceStart, interferenceEnd });
  const interferenceRevert = await executor.revertUnchecked(interferenceTake);
  check('5dr-L9: interference revert restores the empty clip through the witness',
    interferenceRevert.unrestored.length === 0 && (await readNotes(witness, address)).length === 0,
    interferenceRevert.unrestored);
} catch (error) {
  check('5dr-LX: the focused repair probe completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (created && probe !== undefined) {
    try {
      const current = await writer.revision();
      const target = slot(track(probe.channelId), scene(probe.slotIndex, current.sceneEpoch));
      const address = notesAt(clip(target));
      const remaining = await readNotes(witness, address);
      if (remaining.length !== 0) throw new Error('the owned probe clip is not empty');
      await writer.apply({ ops: [{ op: 'clip.delete', slot: target }] });
      await writer.settle('trackStruct');
      check('5dr-L10: the owned probe clip is removed', !await hasContent(probe));
    } catch (error) {
      check('5dr-L10: the owned probe clip is removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  if (originalSelection.trackIndex >= 0 && originalSelection.slotIndex >= 0) {
    try {
      await select(originalSelection);
      check('5dr-L11: the probe restores the pre-run selection', true, originalSelection);
    } catch (error) {
      check('5dr-L11: the probe restores the pre-run selection', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  const observation = (await client.request('observation.read')) as {
    available?: boolean; value?: string;
  };
  check('5dr-L12: the observation record remains at its exact baseline',
    observation.available === true && observation.value === EMPTY_RECORD, observation);
  await writer.close();
}

note(`Phase 1 session 5d repair: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
