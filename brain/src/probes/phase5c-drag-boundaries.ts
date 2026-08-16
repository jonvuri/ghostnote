/**
 * Phase 1 session 5c — human clip-drag observer boundaries.
 *
 * Each arm has a separate arm/read command. The arm records one observer mark
 * and prepares one owned clip. The read command scores the human drag, restores
 * the clip and selection, and removes the owned clip.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import { deltaComplete, type RevisionMark } from '../contract/index.js';
import { emptyObservationRecord, encodeObservationRecord } from '../observation/index.js';
import { check, client, failureCount, note, pollUntil } from './lib.js';

const MODE = process.argv[2] ?? '';
const MODES = ['arm-cross', 'read-cross', 'arm-below', 'read-below'] as const;
if (!MODES.includes(MODE as (typeof MODES)[number])) {
  console.log('usage: phase5c-drag-boundaries.ts arm-cross|read-cross|arm-below|read-below');
  process.exit(2);
}

const CROSS_STATE = path.join(os.tmpdir(), 'ghostnote-phase5c-cross.json');
const BELOW_STATE = path.join(os.tmpdir(), 'ghostnote-phase5c-below.json');
const CONFIG_PATH = path.join(os.homedir(), '.ghostnote', 'rig.json');
const JAR = path.resolve('../extension/build/libs/ghostnote-0.0.1.bwextension');
const DEPLOYED = path.join(
  os.homedir(), 'Documents', 'Bitwig Studio', 'Extensions', 'ghostnote-0.0.1.bwextension');
const PROJECT = 'gn-scale-test';
const STATUS = 'Change · 4a-live-check';
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
const TRACK_A_ID = 'd61c23c2-4f85-4eee-bc08-8bb9baf6ff63';
const TRACK_B_ID = '78a40fcf-3eae-48fc-badf-1ff18900166b';
const CLIP_TRACK_IDS = [
  TRACK_A_ID,
  TRACK_B_ID,
  'd367ac16-b7bd-4662-971f-fe924ec033a3',
  '9a88b37d-337a-4ef2-96a8-a147419d7cda',
  '6fb96670-abde-4958-9147-f573a4b43918',
  '98ba8aa3-dbce-4e51-8bb2-de9302542b6e',
  '4a6a024a-f213-48f1-9029-532fc077d857',
] as const;

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly channelId: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
}

interface OwnedClip {
  readonly sourceTrackId: string;
  readonly sourceRow: number;
  readonly destinationTrackId: string;
  readonly destinationRow: number;
}

interface CrossState extends OwnedClip {
  readonly mark: RevisionMark;
  readonly selection: Selection;
  readonly observation: string;
}

interface BelowState extends CrossState {
  readonly originalConfig: string | null;
  readonly narrowScenes: number;
  readonly narrowStamp: string;
}

interface ConfigView {
  readonly scenes: number;
  readonly stamp: string;
}

const selection = async (): Promise<Selection> =>
  (await client.request('selection.status')) as Selection;

const slotHas = async (trackIndex: number, slotIndex: number): Promise<boolean> =>
  ((await client.request('slot.status', { trackIndex, slotIndex })) as { hasContent: boolean })
    .hasContent;

const observation = async (): Promise<string> => {
  const reply = (await client.request('observation.read')) as {
    available?: boolean;
    value?: string;
  };
  if (reply.available !== true || typeof reply.value !== 'string') {
    throw new Error('the observation record is unavailable');
  }
  return reply.value;
};

/** Convert only the legacy uninitialized value to the documented empty record. */
async function ensureObservationBaseline(): Promise<string> {
  const before = await observation();
  if (before === EMPTY_RECORD) return before;
  if (before !== '') return before;

  const accepted = (await client.request('observation.replace', {
    value: EMPTY_RECORD,
  })) as { accepted?: boolean };
  if (accepted.accepted !== true) throw new Error('the empty observation record was not accepted');
  const settled = await pollUntil(async () => (await observation()) === EMPTY_RECORD, 8000, 100);
  if (!settled.ok) throw new Error('the empty observation record did not settle');
  note('Initialized the empty observation store to the documented schema-v1 value.');
  return observation();
}

async function adapter(): Promise<LiveAdapter> {
  const result = new LiveAdapter({ transport: new BridgeTransport(client) });
  await result.hello();
  return result;
}

async function tracks(): Promise<TrackRow[]> {
  const reply = (await client.request('track.list')) as { tracks: TrackRow[] };
  const matches = reply.tracks.length === Object.keys(TRACKS).length
    && reply.tracks.every((row) => TRACKS[row.channelId] === row.name);
  check('5c-L0: all fixture identities match the documented baseline', matches,
    reply.tracks.map(({ index, name, channelId }) => ({ index, name, channelId })));
  if (!matches) throw new Error('fixture identity mismatch');
  return reply.tracks;
}

function trackIndex(list: readonly TrackRow[], channelId: string): number {
  const row = list.find((item) => item.channelId === channelId);
  if (row === undefined) throw new Error(`track ${channelId} is not in the bank`);
  return row.index;
}

async function checkBaseline(list: readonly TrackRow[]): Promise<void> {
  const info = (await client.request('rig.info')) as {
    scenes: number;
    sceneCount: number;
  };
  const mark = (await client.request('revision.get')) as { project?: string };
  const record = await ensureObservationBaseline();
  check('5c-L1: the project and scene window match the baseline',
    mark.project === PROJECT && info.scenes === 16 && info.sceneCount === 10,
    { project: mark.project, scenes: info.scenes, sceneCount: info.sceneCount });
  check('5c-L2: the observation record is the exact empty schema-v1 value',
    record === EMPTY_RECORD, { value: record });
  if (list.length !== 10 || mark.project !== PROJECT || info.scenes !== 16
      || info.sceneCount !== 10 || record !== EMPTY_RECORD) {
    throw new Error('live project baseline mismatch');
  }
}

async function select(target: Selection): Promise<void> {
  if (target.trackIndex < 0 || target.slotIndex < 0) return;
  await client.request('slot.select', {
    trackIndex: target.trackIndex,
    slotIndex: target.slotIndex,
    mechanism: 'slot',
  });
  const settled = await pollUntil(async () => {
    const at = await selection();
    return at.trackIndex === target.trackIndex && at.slotIndex === target.slotIndex;
  });
  if (!settled.ok) {
    throw new Error(`selection did not return to track ${target.trackIndex}, row ${target.slotIndex}`);
  }
}

async function resetStatus(): Promise<void> {
  const at = (await client.request('revision.get')) as {
    generation?: string;
    project?: string;
  };
  const result = (await client.request('status.push', {
    value: STATUS,
    expectedGeneration: at.generation,
    expectedProject: at.project,
  })) as { accepted?: boolean };
  check('5c-L9: Last change returns to the documented baseline', result.accepted === true, result);
}

async function requireStopped(): Promise<void> {
  const state = (await client.request('transport.status')) as { isPlaying?: boolean };
  check('5c-L3: the transport is stopped before the probe clip is made', state.isPlaying === false,
    state);
  if (state.isPlaying !== false) throw new Error('stop the transport before this measurement');
}

async function findCrossTarget(list: readonly TrackRow[]): Promise<{
  readonly sourceTrackId: string;
  readonly destinationTrackId: string;
  readonly row: number;
}> {
  for (let row = 9; row >= 2; row -= 1) {
    for (const sourceTrackId of CLIP_TRACK_IDS) {
      const source = trackIndex(list, sourceTrackId);
      if (await slotHas(source, row)) continue;
      for (const destinationTrackId of CLIP_TRACK_IDS) {
        if (destinationTrackId === sourceTrackId) continue;
        const destination = trackIndex(list, destinationTrackId);
        if (!(await slotHas(destination, row))) {
          return { sourceTrackId, destinationTrackId, row };
        }
      }
    }
  }
  throw new Error('the documented clip tracks have no shared empty row from 2 through 9');
}

async function findBelowTarget(list: readonly TrackRow[]): Promise<{
  readonly trackId: string;
  readonly rows: readonly [number, number];
}> {
  for (const trackId of CLIP_TRACK_IDS) {
    const track = trackIndex(list, trackId);
    const empty: number[] = [];
    for (let row = 9; row >= 2; row -= 1) {
      if (!(await slotHas(track, row))) empty.push(row);
      if (empty.length === 2) return { trackId, rows: [empty[0]!, empty[1]!] };
    }
  }
  throw new Error('no documented clip track has two empty rows from 2 through 9');
}

async function createOwned(track: number, row: number): Promise<void> {
  if (await slotHas(track, row)) throw new Error('the claimed source row is no longer empty');
  await client.request('clip.create', { trackIndex: track, slotIndex: row, lengthBeats: 4 });
  const landed = await pollUntil(() => slotHas(track, row), 8000, 100);
  if (!landed.ok) throw new Error('the owned clip did not appear');
}

/** Restore only from an unambiguous expected state. Never guess which clip is ours. */
async function removeOwned(owned: OwnedClip): Promise<boolean> {
  const list = await tracks();
  const sourceTrack = trackIndex(list, owned.sourceTrackId);
  const destinationTrack = trackIndex(list, owned.destinationTrackId);
  let source = await slotHas(sourceTrack, owned.sourceRow);
  let destination = await slotHas(destinationTrack, owned.destinationRow);

  if (!source && destination) {
    await client.request('slot.moveTo', {
      trackIndex: destinationTrack,
      slotIndex: owned.destinationRow,
      toTrackIndex: sourceTrack,
      toSlotIndex: owned.sourceRow,
    });
    const restored = await pollUntil(async () =>
      (await slotHas(sourceTrack, owned.sourceRow))
      && !(await slotHas(destinationTrack, owned.destinationRow)), 8000, 100);
    source = await slotHas(sourceTrack, owned.sourceRow);
    destination = await slotHas(destinationTrack, owned.destinationRow);
    check('5c-L7: the moved clip returns to its owned source', restored.ok,
      { source, destination });
  } else {
    check('5c-L7: the clip is in one unambiguous cleanup position', source && !destination,
      { source, destination });
  }

  if (!source || destination) {
    note('Cleanup stopped. The two slots do not identify the owned clip without a guess.');
    return false;
  }
  await client.request('slot.delete', { trackIndex: sourceTrack, slotIndex: owned.sourceRow });
  const removed = await pollUntil(async () => !(await slotHas(sourceTrack, owned.sourceRow)),
    8000, 100);
  check('5c-L8: the owned probe clip is removed', removed.ok);
  return removed.ok;
}

async function restoreSurface(state: CrossState): Promise<void> {
  await select(state.selection);
  check('5c-L10: the original selection is restored', true, state.selection);
  check('5c-L11: the observation record remains exact',
    (await observation()) === state.observation);
  await resetStatus();
}

function readState<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function writeState(file: string, state: CrossState | BelowState): void {
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

function configView(raw: string | null): ConfigView {
  const value = JSON.parse(raw ?? '{}') as { scenes?: unknown; stamp?: unknown };
  return {
    scenes: typeof value.scenes === 'number' ? value.scenes : 16,
    stamp: typeof value.stamp === 'string' ? value.stamp : 'default',
  };
}

async function deployConfig(raw: string | null, expected: ConfigView): Promise<boolean> {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  if (raw === null) fs.rmSync(CONFIG_PATH, { force: true });
  else fs.writeFileSync(CONFIG_PATH, raw);
  client.disconnect();
  execFileSync('cp', [JAR, DEPLOYED]);

  const start = Date.now();
  while (Date.now() - start <= 90_000) {
    try {
      const stats = (await client.request('rig.stats')) as {
        config: { scenes: number; stamp: string };
      };
      if (stats.config.scenes === expected.scenes && stats.config.stamp === expected.stamp) return true;
    } catch {
      // A reload closes the bridge before the new extension starts.
    }
    client.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function armCross(): Promise<void> {
  await client.connect();
  const originalSelection = await selection();
  let owned: OwnedClip | undefined;
  let armed = false;
  try {
    const list = await tracks();
    await checkBaseline(list);
    const originalObservation = await observation();
    await requireStopped();
    const target = await findCrossTarget(list);
    const sourceTrack = trackIndex(list, target.sourceTrackId);
    const row = target.row;
    owned = {
      sourceTrackId: target.sourceTrackId,
      sourceRow: row,
      destinationTrackId: target.destinationTrackId,
      destinationRow: row,
    };
    await createOwned(sourceTrack, row);
    await select({ trackIndex: sourceTrack, slotIndex: row });
    const live = await adapter();
    const mark = await live.revision();
    await live.close();
    writeState(CROSS_STATE, {
      ...owned,
      mark,
      selection: originalSelection,
      observation: originalObservation,
    });
    armed = true;
    console.log('ARMED: cross-track drag');
    note(`Drag the clip on ${TRACKS[target.sourceTrackId]}, zero-based row ${row}, horizontally to `
      + `${TRACKS[target.destinationTrackId]} row ${row}.`);
    note('Do not copy it. Reply when the source is empty and the destination is full.');
  } finally {
    if (!armed && owned !== undefined) {
      await removeOwned(owned);
      await select(originalSelection);
    }
  }
}

async function readCross(): Promise<void> {
  const state = readState<CrossState>(CROSS_STATE);
  await client.connect();
  const live = await adapter();
  try {
    const list = await tracks();
    const sourceTrack = trackIndex(list, state.sourceTrackId);
    const destinationTrack = trackIndex(list, state.destinationTrackId);
    const source = await slotHas(sourceTrack, state.sourceRow);
    const destination = await slotHas(destinationTrack, state.destinationRow);
    check('5c-C1: the human moved the clip across tracks', !source && destination,
      { source, destination });

    const delta = await live.contentSince(state.mark);
    check('5c-C2: the drag emits exactly source-empty then destination-fill',
      delta.events.length === 2
      && delta.events[0]?.channelId === state.sourceTrackId
      && delta.events[0]?.slotIndex === state.sourceRow
      && delta.events[0]?.filled === false
      && delta.events[1]?.channelId === state.destinationTrackId
      && delta.events[1]?.slotIndex === state.destinationRow
      && delta.events[1]?.filled === true,
      delta.events);
    check('5c-C3: the covered cross-track event window is complete', deltaComplete(delta), delta);
    const now = await live.revision();
    check('5c-C4: a clip drag does not move the scene epoch',
      now.sceneEpoch === state.mark.sceneEpoch,
      { before: state.mark.sceneEpoch, after: now.sceneEpoch });
  } finally {
    await removeOwned(state);
    await restoreSurface(state);
    await live.close();
    fs.rmSync(CROSS_STATE, { force: true });
  }
}

async function armBelow(): Promise<void> {
  await client.connect();
  const originalSelection = await selection();
  const originalConfig = fs.existsSync(CONFIG_PATH) ? fs.readFileSync(CONFIG_PATH, 'utf8') : null;
  let owned: OwnedClip | undefined;
  let configChanged = false;
  let armed = false;
  try {
    const list = await tracks();
    await checkBaseline(list);
    const originalObservation = await observation();
    await requireStopped();
    const target = await findBelowTarget(list);
    const sourceTrack = trackIndex(list, target.trackId);
    const [sourceRow, destinationRow] = target.rows;
    const narrowScenes = Math.min(sourceRow, destinationRow);
    if (narrowScenes < 2) throw new Error('the empty rows do not permit a safe narrow window');
    owned = {
      sourceTrackId: target.trackId,
      sourceRow,
      destinationTrackId: target.trackId,
      destinationRow,
    };
    await createOwned(sourceTrack, sourceRow);
    await select({ trackIndex: sourceTrack, slotIndex: sourceRow });

    const narrowStamp = `phase5c-below-${Date.now()}`;
    const parsed = JSON.parse(originalConfig ?? '{}') as Record<string, unknown>;
    const narrowRaw = JSON.stringify({ ...parsed, scenes: narrowScenes, stamp: narrowStamp });
    writeState(BELOW_STATE, {
      ...owned,
      mark: {} as RevisionMark,
      selection: originalSelection,
      observation: originalObservation,
      originalConfig,
      narrowScenes,
      narrowStamp,
    });
    configChanged = true;
    const reloaded = await deployConfig(narrowRaw, { scenes: narrowScenes, stamp: narrowStamp });
    check('5c-B1: the extension reloads with the narrowed scene window', reloaded,
      { scenes: narrowScenes, stamp: narrowStamp });
    if (!reloaded) throw new Error('the extension did not reload on the narrow config');

    const live = await adapter();
    await new Promise((resolve) => setTimeout(resolve, 300));
    const mark = await live.revision();
    await live.close();
    check('5c-B2: the mark reports an uncovered scene window before the drag',
      mark.window.scenes.count === 10 && mark.window.scenes.bankSize === narrowScenes,
      mark.window.scenes);
    if (mark.window.scenes.count !== 10 || mark.window.scenes.bankSize !== narrowScenes) {
      throw new Error('the narrowed mark does not describe the expected scene window');
    }
    writeState(BELOW_STATE, {
      ...owned,
      mark,
      selection: originalSelection,
      observation: originalObservation,
      originalConfig,
      narrowScenes,
      narrowStamp,
    });
    armed = true;
    console.log('ARMED: below-window drag');
    note(`The observer window ends before zero-based row ${sourceRow}.`);
    note(`Drag the clip on ${TRACKS[target.trackId]} row ${sourceRow} vertically to row `
      + `${destinationRow} on the same track.`);
    note('Do not copy it. Reply when the source is empty and the destination is full.');
  } finally {
    if (!armed) {
      if (configChanged) {
        const restored = await deployConfig(originalConfig, configView(originalConfig));
        check('5c-BX: the original config reloads after an arm failure', restored);
      }
      if (owned !== undefined) await removeOwned(owned);
      await select(originalSelection);
    }
  }
}

async function readBelow(): Promise<void> {
  const state = readState<BelowState>(BELOW_STATE);
  await client.connect();
  let configRestored = false;
  try {
    const live = await adapter();
    const delta = await live.contentSince(state.mark);
    await live.close();
    check('5c-B3: the below-window drag emits no content event', delta.events.length === 0,
      delta.events);
    check('5c-B4: the quiet result is explicitly incomplete because scenes are uncovered',
      delta.uncovered && delta.uncoveredIn === 'scenes' && !deltaComplete(delta)
      && !delta.truncated && !delta.discontinuous
      && delta.events.every((event) => event.channelId !== ''), delta);

    configRestored = await deployConfig(state.originalConfig, configView(state.originalConfig));
    const diskConfig = fs.existsSync(CONFIG_PATH) ? fs.readFileSync(CONFIG_PATH, 'utf8') : null;
    check('5c-B5: the exact prior config is restored and live',
      configRestored && diskConfig === state.originalConfig,
      { live: configRestored, exactFile: diskConfig === state.originalConfig,
        expected: configView(state.originalConfig) });
    if (!configRestored) throw new Error('the extension did not return to the prior config');

    const list = await tracks();
    const sourceTrack = trackIndex(list, state.sourceTrackId);
    const destinationTrack = trackIndex(list, state.destinationTrackId);
    const source = await slotHas(sourceTrack, state.sourceRow);
    const destination = await slotHas(destinationTrack, state.destinationRow);
    check('5c-B6: full-window readback proves the human drag happened below the window',
      !source && destination, { source, destination });
  } finally {
    if (!configRestored) {
      configRestored = await deployConfig(state.originalConfig, configView(state.originalConfig));
      check('5c-B5: the exact prior config is restored and live', configRestored,
        configView(state.originalConfig));
    }
    if (configRestored) {
      await removeOwned(state);
      await restoreSurface(state);
      fs.rmSync(BELOW_STATE, { force: true });
    } else {
      note('Cleanup paused because the original scene window is not live. Reload it before moving clips.');
    }
  }
}

try {
  if (MODE === 'arm-cross') await armCross();
  if (MODE === 'read-cross') await readCross();
  if (MODE === 'arm-below') await armBelow();
  if (MODE === 'read-below') await readBelow();
} catch (error) {
  check('5c-LX: the focused probe completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
}

note(`Phase 1 session 5c ${MODE}: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
