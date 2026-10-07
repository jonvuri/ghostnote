/** E138: live cache identity and lifecycle probe. */
import { createHash } from 'node:crypto';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { decodeVerboseNote } from '../adapters/live/encoder.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import { BridgeClient } from '../client.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callExperimental7b } from './phase7b-profile.js';
import { workspaceOf } from '../surface/workspace.js';
import {
  CacheLifecycleRegistry,
  type ClipAddress as LifecycleAddress,
  type ClipCandidate,
  type ContentEvent as LifecycleContentEvent,
} from './phase8d-cache-lifecycle-lib.js';
import { check, failureCount, note, pollUntil } from './lib.js';

const PROFILE = 'phase-8-probe-v1';
const METHOD_COUNT = 95;
const METHOD_HASH = '226dd8c1467c7c3b';
const TRACK_NAME = 'gn-e138-cache-lifecycle';
const HELPER_NAME = 'gn-e138-cache-helper';
const GRID = 1 / 512;
const STEPS = 2_048;
const OBSERVER = 'observer';
const READER = 'fine';
const WRITER = '0';

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly type: string;
  readonly channelId: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
  readonly mixerTrackIndex?: number;
}

interface Revision {
  readonly generation: string;
  readonly project: string;
  readonly sceneEpoch: number;
  readonly sceneCount: number;
  readonly contentEpoch: number;
  readonly contentEvents: readonly {
    readonly seq: number;
    readonly channelId: string;
    readonly slotIndex: number;
    readonly filled: boolean;
  }[];
}

interface WireNote extends Record<string, number | boolean | string> {
  readonly x: number;
  readonly y: number;
  readonly channel: number;
  readonly duration: number;
}

interface StepDataRead {
  readonly generation: number;
  readonly callbacks: number;
  readonly sincePrepareMicros: number;
  readonly lastCallbackMicros?: number;
}

interface EnrichedRead {
  readonly notes: readonly WireNote[];
  readonly count: number;
  readonly coordinateCount: number;
  readonly scanMicros: number;
  readonly generation: number;
  readonly callbacks: number;
  readonly stable: boolean;
  readonly clipExists?: boolean;
}

interface NormalizedNote extends Record<string, unknown> {
  readonly channel: number;
  readonly pitch: number;
  readonly startTick: number;
  readonly durationTicks: number;
}

interface AcquisitionResult {
  readonly clip: { readonly notes: readonly (NormalizedNote & { readonly eventId: string })[] };
  readonly timing: { readonly totalMs: number };
}

interface ArmResult {
  readonly label: string;
  readonly cacheCount: number;
  readonly authorityCount: number;
  readonly e131Difference: boolean | 'unavailable-empty-slot';
}

const bridge = new BridgeClient();
const adapter = new LiveAdapter({ transport: new BridgeTransport(bridge) });
const workspace = workspaceOf({
  ready: async () => undefined,
  adapter,
  executor: new Executor(adapter),
  stash: new Stash(),
  observationStore: new FakeObservationStore(),
});
const registry = new CacheLifecycleRegistry();
const ownedTrackIds = new Set<string>();
const arms: ArmResult[] = [];
const costs = { incrementalRepairMs: 0, completeRebuildMs: 0 };

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const bag = value as Record<string, unknown>;
    return `{${Object.keys(bag).sort().map((key) => `${JSON.stringify(key)}:${stable(bag[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};
const digest = (value: unknown): string =>
  createHash('sha256').update(stable(value), 'utf8').digest('hex');
const address = (channelId: string, row: number): LifecycleAddress => ({ channelId, row });

async function tracks(): Promise<readonly TrackRow[]> {
  return (await bridge.request('track.list') as { readonly tracks: readonly TrackRow[] }).tracks;
}

async function revision(): Promise<Revision> {
  return await bridge.request('revision.get') as Revision;
}

async function sceneCount(): Promise<number> {
  return (await bridge.request('scene.count') as { readonly sceneCount: number }).sceneCount;
}

async function scanSummary(): Promise<{
  readonly existing: number;
  readonly slotsWithContent: number;
  readonly sceneCount: number;
}> {
  return await bridge.request('rig.scanTracks') as {
    readonly existing: number;
    readonly slotsWithContent: number;
    readonly sceneCount: number;
  };
}

async function resolveTrack(channelId: string): Promise<TrackRow | undefined> {
  const row = await bridge.request('track.resolveByChannelId', { channelId }) as {
    readonly found: boolean;
    readonly index?: number;
    readonly name?: string;
    readonly type?: string;
  };
  return row.found && row.index !== undefined
    ? { index: row.index, name: row.name ?? '', type: row.type ?? '', channelId }
    : undefined;
}

async function createTrack(name: string): Promise<TrackRow> {
  const before = await tracks();
  await bridge.request('track.create', { position: before.length });
  const appeared = await pollUntil(async () => (await tracks()).length === before.length + 1);
  if (!appeared.ok) throw new Error(`track ${name} did not appear`);
  const prior = new Set(before.map((item) => item.channelId));
  const added = (await tracks()).filter((item) => !prior.has(item.channelId));
  if (added.length !== 1) throw new Error(`track ${name} identity is ambiguous`);
  ownedTrackIds.add(added[0]!.channelId);
  await bridge.request('track.setName', { trackIndex: added[0]!.index, name });
  const renamed = await pollUntil(async () => (await resolveTrack(added[0]!.channelId))?.name === name);
  if (!renamed.ok) throw new Error(`track ${name} did not rename`);
  return (await resolveTrack(added[0]!.channelId))!;
}

async function deleteTrack(channelId: string): Promise<void> {
  const found = await resolveTrack(channelId);
  if (found === undefined) return;
  await bridge.request('track.delete', { trackIndex: found.index });
  const gone = await pollUntil(async () => (await resolveTrack(channelId)) === undefined);
  if (!gone.ok) throw new Error(`owned track ${channelId} did not delete`);
}

async function createClip(trackIndex: number, row: number): Promise<void> {
  await bridge.request('clip.create', { trackIndex, slotIndex: row, lengthBeats: 4 });
  const ready = await pollUntil(async () => (
    await bridge.request('slot.status', { trackIndex, slotIndex: row }) as { hasContent: boolean }
  ).hasContent);
  if (!ready.ok) throw new Error(`clip ${trackIndex}:${row} did not appear`);
}

async function occupiedRows(trackIndex: number, count: number): Promise<number[]> {
  const found: number[] = [];
  for (let row = 0; row < count; row += 1) {
    const status = await bridge.request('slot.status', { trackIndex, slotIndex: row }) as {
      readonly hasContent: boolean;
    };
    if (status.hasContent) found.push(row);
  }
  return found;
}

async function pointAndPin(cursor: string, trackIndex: number, row: number): Promise<void> {
  await bridge.request('cursor.pin', { cursor, pinned: false });
  await bridge.request('cursor.pinTrack', { cursor, pinned: false });
  await bridge.request('cursor.pointTrack', { cursor, trackIndex });
  await bridge.request('slot.select', { trackIndex, slotIndex: row, mechanism: 'track' });
  const pointed = await pollUntil(async () => {
    const status = await bridge.request('cursor.status', { cursor }) as {
      readonly exists: boolean;
      readonly trackPosition: number;
      readonly sceneIndex: number;
    };
    return status.exists && status.trackPosition === trackIndex && status.sceneIndex === row;
  }, 4_000, 50);
  if (!pointed.ok) throw new Error(`${cursor} did not point to ${trackIndex}:${row}`);
  await bridge.request('cursor.pinTrack', { cursor, pinned: true });
  await bridge.request('cursor.pin', { cursor, pinned: true });
  const pinned = await pollUntil(async () => {
    const status = await bridge.request('cursor.status', { cursor }) as {
      readonly trackPosition: number;
      readonly sceneIndex: number;
      readonly cursorTrackPinned?: boolean;
      readonly isPinned?: boolean;
    };
    return status.trackPosition === trackIndex && status.sceneIndex === row
      && status.cursorTrackPinned === true && status.isPinned === true;
  }, 4_000, 50);
  if (!pinned.ok) throw new Error(`${cursor} did not pin to ${trackIndex}:${row}`);
}

async function prepareWriter(trackIndex: number, row: number): Promise<void> {
  await pointAndPin(WRITER, trackIndex, row);
  await bridge.request('cursor.setStepSize', { cursor: WRITER, stepSize: GRID });
  await bridge.request('cursor.scrollToStep', { cursor: WRITER, step: 0 });
  await wait(144);
}

async function writeFixture(trackIndex: number, row: number): Promise<void> {
  await prepareWriter(trackIndex, row);
  await bridge.request('cursor.setNotes', {
    cursor: WRITER, channel: 0, notes: [[0, 60, 100, 64 / 512], [256, 67, 92, 32 / 512]],
  });
  await bridge.request('cursor.setNotes', {
    cursor: WRITER, channel: 5, notes: [[64, 64, 90, 96 / 512]],
  });
  await wait(200);
}

function normalized(notes: readonly WireNote[]): NormalizedNote[] {
  return notes.map((item) => {
    const decoded = decodeVerboseNote(item, GRID) as unknown as Record<string, unknown>;
    const startBeats = decoded['startBeats'] as number;
    const durationBeats = decoded['durationBeats'] as number;
    const pitch = decoded['pitch'] as number;
    const velocity = decoded['velocity'] as number;
    const { startBeats: _start, durationBeats: _duration, pitch: _pitch, ...fields } = decoded;
    return {
      channel: item.channel,
      pitch,
      startTick: Math.round(startBeats * 512),
      durationTicks: Math.max(1, Math.round(durationBeats * 512)),
      velocity,
      ...fields,
    };
  }).sort((left, right) => left.channel - right.channel
    || left.startTick - right.startTick || left.pitch - right.pitch);
}

function normalizedE131(notes: AcquisitionResult['clip']['notes']): NormalizedNote[] {
  return notes.map(({ eventId: _eventId, ...item }) => item)
    .sort((left, right) => left.channel - right.channel
      || left.startTick - right.startTick || left.pitch - right.pitch);
}

async function readCurrent(cursor: string): Promise<WireNote[]> {
  const result = await bridge.request('cursor.getNotesVerboseAllChannels', {
    cursor, maxX: STEPS,
  }) as {
    readonly clipExists?: boolean;
    readonly channels: readonly { readonly notes: readonly WireNote[] }[];
  };
  return result.channels.flatMap((channel) => channel.notes);
}

async function authority(trackIndex: number, row: number): Promise<NormalizedNote[]> {
  await pointAndPin(READER, trackIndex, row);
  await bridge.request('cursor.setStepSize', { cursor: READER, stepSize: GRID });
  await bridge.request('cursor.scrollToStep', { cursor: READER, step: 0 });
  await wait(144);
  return normalized(await readCurrent(READER));
}

async function settleObserver(minimumCallbacks = 0): Promise<StepDataRead> {
  const started = performance.now();
  for (;;) {
    const read = await bridge.request('stepdata.observer.read') as StepDataRead;
    const quietMicros = read.lastCallbackMicros === undefined
      ? 0 : read.sincePrepareMicros - read.lastCallbackMicros;
    if (read.callbacks >= minimumCallbacks && quietMicros >= 250_000) return read;
    if (performance.now() - started > 4_000) return read;
    await wait(25);
  }
}

async function enrich(read: StepDataRead): Promise<EnrichedRead> {
  return await bridge.request('stepdata.observer.enrich', {
    generation: read.generation,
    callbacks: read.callbacks,
  }) as EnrichedRead;
}

async function bindObserver(
  trackIndex: number, row: number, canaryRow: number,
): Promise<{ readonly notes: NormalizedNote[]; readonly elapsedMs: number }> {
  const started = performance.now();
  await pointAndPin(OBSERVER, trackIndex, canaryRow);
  await bridge.request('cursor.setStepSize', { cursor: OBSERVER, stepSize: GRID });
  await bridge.request('cursor.scrollToStep', { cursor: OBSERVER, step: 0 });
  await wait(250);
  const prepared = await bridge.request('stepdata.observer.prepare') as StepDataRead;
  await pointAndPin(OBSERVER, trackIndex, row);
  const settled = await settleObserver(Math.max(1, prepared.callbacks + 1));
  const result = await enrich(settled);
  check('observer binding is stable and target-scoped', result.stable && result.clipExists !== false,
    { row, callbacks: result.callbacks, count: result.count });
  return { notes: normalized(result.notes), elapsedMs: performance.now() - started };
}

async function mutationCache(action: () => Promise<void>): Promise<NormalizedNote[]> {
  const before = await bridge.request('stepdata.observer.read') as StepDataRead;
  await action();
  const settled = await settleObserver(before.callbacks + 1);
  check('mutation produced and drained an observer callback', settled.callbacks > before.callbacks,
    { before: before.callbacks, after: settled.callbacks });
  const result = await enrich(settled);
  check('mutation enrichment stayed stable', result.stable, result);
  return normalized(result.notes);
}

async function compareArm(
  label: string,
  cached: readonly NormalizedNote[],
  track: TrackRow,
  row: number,
): Promise<NormalizedNote[]> {
  const currentTrack = await resolveTrack(track.channelId);
  if (currentTrack === undefined) throw new Error(`track vanished before ${label}`);
  const exact512 = await authority(currentTrack.index, row);
  check(`${label}: normalized cache matches a fresh settled 1/512 scan`,
    stable(cached) === stable(exact512), { cache: cached.length, authority: exact512.length });
  const acquisition = await callExperimental7b(workspace, 'acquire_clip_note_source', {
    trackId: track.channelId, row,
  }) as AcquisitionResult;
  const e131 = normalizedE131(acquisition.clip.notes);
  const different = stable(e131) !== stable(exact512);
  note(`${label}: E131 diagnostic ${different ? 'DIFFERS' : 'matches'}; ${acquisition.timing.totalMs.toFixed(3)} ms`);
  arms.push({
    label,
    cacheCount: cached.length,
    authorityCount: exact512.length,
    e131Difference: different,
  });
  return exact512;
}

function eventsSince(before: Revision, after: Revision): LifecycleContentEvent[] {
  return after.contentEvents.filter((event) => event.seq > before.contentEpoch).map((event) => ({
    sequence: event.seq,
    address: address(event.channelId, event.slotIndex),
    filled: event.filled,
  }));
}

async function candidate(track: TrackRow, row: number): Promise<ClipCandidate> {
  const current = await resolveTrack(track.channelId);
  if (current === undefined) throw new Error('candidate track is absent');
  return { address: address(track.channelId, row), fingerprint: digest(await authority(current.index, row)) };
}

async function completeOwnedCandidates(): Promise<ClipCandidate[]> {
  const result: ClipCandidate[] = [];
  const count = await sceneCount();
  for (const channelId of ownedTrackIds) {
    const track = await resolveTrack(channelId);
    if (track === undefined) continue;
    for (const row of await occupiedRows(track.index, count)) {
      result.push(await candidate(track, row));
    }
  }
  return result;
}

async function compareDeletedArm(label: string, cached: readonly NormalizedNote[]): Promise<void> {
  await wait(250);
  const fine = normalized(await readCurrent(READER));
  check(`${label}: cache and the settled held 1/512 scan are empty`,
    cached.length === 0 && fine.length === 0, { cache: cached.length, authority: fine.length });
  note(`${label}: E131 diagnostic is unavailable because the launcher slot is empty`);
  arms.push({
    label,
    cacheCount: cached.length,
    authorityCount: fine.length,
    e131Difference: 'unavailable-empty-slot',
  });
}

async function cleanup(
  baselineTrackIds: readonly string[],
  baselineScenes: number,
  entrySelection: Selection,
): Promise<void> {
  for (const channelId of [...ownedTrackIds]) await deleteTrack(channelId);
  let count = await sceneCount();
  while (count > baselineScenes) {
    await bridge.request('scene.delete', { sceneIndex: count - 1 });
    const expected = count - 1;
    const settled = await pollUntil(async () => await sceneCount() === expected);
    if (!settled.ok) throw new Error(`scene cleanup did not reach ${expected}`);
    count = expected;
  }
  const baseline = new Set(baselineTrackIds);
  const remaining = await tracks();
  const entryTrack = remaining.find((item) => item.index === entrySelection.trackIndex)
    ?? remaining.find((item) => baseline.has(item.channelId));
  if (entryTrack !== undefined && entrySelection.slotIndex < count) {
    await bridge.request('slot.select', {
      trackIndex: entryTrack.index, slotIndex: entrySelection.slotIndex, mechanism: 'track',
    });
  }
}

async function run(): Promise<void> {
  await bridge.connect();
  const hello = await bridge.request('contract.hello') as {
    readonly runtimeProfile: string;
    readonly methodCount: number;
    readonly methodsHash: string;
  };
  check('8d starts on the exact probe archive before a profile-specific call',
    hello.runtimeProfile === PROFILE && hello.methodCount === METHOD_COUNT
      && hello.methodsHash === METHOD_HASH,
    hello);
  if (hello.runtimeProfile !== PROFILE || hello.methodCount !== METHOD_COUNT
      || hello.methodsHash !== METHOD_HASH) {
    throw new Error('the exact Phase 8 probe archive is not live');
  }

  const baselineTracks = await tracks();
  const baselineTrackIds = baselineTracks.map((item) => item.channelId);
  const baselineScenes = await sceneCount();
  const baselineScan = await scanSummary();
  const entrySelection = await bridge.request('selection.status') as Selection;
  if (baselineTracks.some((item) => item.name.startsWith('gn-e138-'))) {
    throw new Error('an E138 fixture already exists; cleanup refused');
  }
  if (baselineScan.slotsWithContent !== 0) {
    throw new Error('the live project is not the empty 8d scratch baseline');
  }
  if (baselineScenes + 6 >= 128) throw new Error('the scene window has no safe fixture room');

  let source: TrackRow | undefined;
  try {
    const entryRevision = await revision();
    registry.beginProject(entryRevision.generation, {
      name: entryRevision.project,
      trackIds: baselineTrackIds,
    });

    source = await createTrack(TRACK_NAME);
    await bridge.request('scene.create', { count: 5 });
    const scenesReady = await pollUntil(async () => await sceneCount() === baselineScenes + 5);
    if (!scenesReady.ok) throw new Error('fixture scenes did not appear');
    source = (await resolveTrack(source.channelId))!;
    const canaryRow = 0;
    let targetRow = baselineScenes + 1;
    await createClip(source.index, canaryRow);
    await prepareWriter(source.index, canaryRow);
    await bridge.request('cursor.setNotes', {
      cursor: WRITER, channel: 15, notes: [[1, 119, 71, 1 / 512]],
    });
    await createClip(source.index, targetRow);
    await writeFixture(source.index, targetRow);

    let bound = await bindObserver(source.index, targetRow, canaryRow);
    let exact = await compareArm('clip create and initial replay', bound.notes, source, targetRow);
    let rebuild = registry.startRebuild();
    registry.finishRebuild(rebuild, [{
      address: address(source.channelId, targetRow), fingerprint: digest(exact),
    }]);
    const logicalId = registry.entries()[0]!.logicalId;

    let cached = await mutationCache(async () => {
      await prepareWriter((await resolveTrack(source!.channelId))!.index, targetRow);
      await bridge.request('cursor.setNotes', {
        cursor: WRITER, channel: 2, notes: [[128, 72, 88, 48 / 512]],
      });
    });
    exact = await compareArm('note add', cached, source, targetRow);
    registry.updateContent(address(source.channelId, targetRow), digest(exact));

    cached = await mutationCache(async () => {
      await prepareWriter((await resolveTrack(source!.channelId))!.index, targetRow);
      await bridge.request('cursor.setNoteProps', {
        cursor: WRITER, channel: 0, x: 0, y: 60,
        props: { velocity: 0.55, duration: 80 / 512, chance: 0.63, isChanceEnabled: true },
      });
    });
    exact = await compareArm('field-only edit', cached, source, targetRow);
    registry.updateContent(address(source.channelId, targetRow), digest(exact));

    cached = await mutationCache(async () => {
      await prepareWriter((await resolveTrack(source!.channelId))!.index, targetRow);
      await bridge.request('cursor.clearNote', {
        cursor: WRITER, channel: 2, x: 128, y: 72,
      });
      await bridge.request('cursor.setNotes', {
        cursor: WRITER, channel: 2, notes: [[160, 73, 88, 48 / 512]],
      });
    });
    exact = await compareArm('note move', cached, source, targetRow);
    registry.updateContent(address(source.channelId, targetRow), digest(exact));

    cached = await mutationCache(async () => {
      await prepareWriter((await resolveTrack(source!.channelId))!.index, targetRow);
      await bridge.request('cursor.clearNote', {
        cursor: WRITER, channel: 5, x: 64, y: 64,
      });
    });
    exact = await compareArm('note remove', cached, source, targetRow);
    registry.updateContent(address(source.channelId, targetRow), digest(exact));

    cached = await mutationCache(async () => {
      await prepareWriter((await resolveTrack(source!.channelId))!.index, targetRow);
      await bridge.request('cursor.clearNotes', { cursor: WRITER });
    });
    exact = await compareArm('clip clear', cached, source, targetRow);
    const cleared = registry.updateContent(address(source.channelId, targetRow), digest(exact));
    check('clip clear preserves logical identity', cleared.logicalId === logicalId);

    cached = await mutationCache(async () => {
      await writeFixture((await resolveTrack(source!.channelId))!.index, targetRow);
    });
    exact = await compareArm('clip refill', cached, source, targetRow);
    registry.updateContent(address(source.channelId, targetRow), digest(exact));

    const beforeDuplicate = await revision();
    const occupiedBefore = await occupiedRows((await resolveTrack(source.channelId))!.index, await sceneCount());
    await bridge.request('slot.duplicateClip', {
      trackIndex: (await resolveTrack(source.channelId))!.index,
      slotIndex: targetRow,
      route: 'slot',
    });
    const duplicateReady = await pollUntil(async () => {
      const rows = await occupiedRows((await resolveTrack(source!.channelId))!.index, await sceneCount());
      return rows.length > occupiedBefore.length;
    });
    if (!duplicateReady.ok) throw new Error('clip duplicate did not appear');
    const occupiedAfter = await occupiedRows((await resolveTrack(source.channelId))!.index, await sceneCount());
    const duplicateRows = occupiedAfter.filter((row) => !occupiedBefore.includes(row));
    if (duplicateRows.length !== 1) throw new Error(`clip duplicate row is ambiguous: ${duplicateRows}`);
    const duplicateRow = duplicateRows[0]!;
    const afterDuplicate = await revision();
    const duplicateCandidate = await candidate(source, duplicateRow);
    const duplicateTransition = registry.reconcileContentEvents(
      eventsSince(beforeDuplicate, afterDuplicate),
      [{ address: address(source.channelId, targetRow), fingerprint: digest(exact) }, duplicateCandidate],
    );
    check('clip duplicate mints a new logical identity',
      duplicateTransition.minted.length === 1 && duplicateTransition.preserved.length === 0,
      duplicateTransition);
    bound = await bindObserver((await resolveTrack(source.channelId))!.index, duplicateRow, canaryRow);
    const duplicateExact = await compareArm('clip duplicate', bound.notes, source, duplicateRow);
    check('duplicated clip content is identical', stable(duplicateExact) === stable(exact));
    check('identical candidates are ambiguous without address events',
      registry.candidateAmbiguity(digest(exact), [
        { address: address(source.channelId, targetRow), fingerprint: digest(exact) },
        { address: address(source.channelId, duplicateRow), fingerprint: digest(duplicateExact) },
      ]) === 'many');

    const moveRow = baselineScenes + 3;
    bound = await bindObserver((await resolveTrack(source.channelId))!.index, targetRow, canaryRow);
    const beforeMove = await revision();
    await bridge.request('slot.moveTo', {
      trackIndex: (await resolveTrack(source.channelId))!.index,
      slotIndex: targetRow,
      toTrackIndex: (await resolveTrack(source.channelId))!.index,
      toSlotIndex: moveRow,
    });
    const moved = await pollUntil(async () => {
      const current = (await resolveTrack(source!.channelId))!;
      const from = await bridge.request('slot.status', {
        trackIndex: current.index, slotIndex: targetRow,
      }) as { hasContent: boolean };
      const to = await bridge.request('slot.status', {
        trackIndex: current.index, slotIndex: moveRow,
      }) as { hasContent: boolean };
      return !from.hasContent && to.hasContent;
    });
    if (!moved.ok) throw new Error('clip move did not settle');
    const afterMove = await revision();
    const moveCandidate = await candidate(source, moveRow);
    const moveTransition = registry.reconcileContentEvents(
      eventsSince(beforeMove, afterMove),
      [duplicateCandidate, moveCandidate],
    );
    check('one empty-fill pair preserves the moved clip identity',
      moveTransition.kind === 'move' && moveTransition.preserved.includes(logicalId),
      moveTransition);
    targetRow = moveRow;
    bound = await bindObserver((await resolveTrack(source.channelId))!.index, targetRow, canaryRow);
    exact = await compareArm('clip move', bound.notes, source, targetRow);

    await pointAndPin(READER, (await resolveTrack(source.channelId))!.index, duplicateRow);
    await bridge.request('cursor.setStepSize', { cursor: READER, stepSize: GRID });
    await bridge.request('cursor.scrollToStep', { cursor: READER, step: 0 });
    await wait(144);
    await bindObserver((await resolveTrack(source.channelId))!.index, duplicateRow, canaryRow);
    const observerBeforeClipDelete = await bridge.request('stepdata.observer.read') as StepDataRead;
    const beforeClipDelete = await revision();
    await bridge.request('slot.delete', {
      trackIndex: (await resolveTrack(source.channelId))!.index, slotIndex: duplicateRow,
    });
    await pollUntil(async () => !(
      await bridge.request('slot.status', {
        trackIndex: (await resolveTrack(source!.channelId))!.index, slotIndex: duplicateRow,
      }) as { hasContent: boolean }
    ).hasContent);
    const afterClipDelete = await revision();
    const deletedTransition = registry.reconcileContentEvents(
      eventsSince(beforeClipDelete, afterClipDelete),
      [{ address: address(source.channelId, targetRow), fingerprint: digest(exact) }],
    );
    check('clip deletion retires its logical identity',
      deletedTransition.kind === 'delete' && deletedTransition.retired.length === 1,
      deletedTransition);
    const observerAfterClipDelete = await settleObserver(observerBeforeClipDelete.callbacks + 1);
    await compareDeletedArm(
      'clip delete', normalized((await enrich(observerAfterClipDelete)).notes),
    );
    bound = await bindObserver((await resolveTrack(source.channelId))!.index, targetRow, canaryRow);
    exact = await compareArm('clip move after deletion repair', bound.notes, source, targetRow);

    const replaceRow = baselineScenes + 4;
    await createClip((await resolveTrack(source.channelId))!.index, replaceRow);
    await prepareWriter((await resolveTrack(source.channelId))!.index, replaceRow);
    await bridge.request('cursor.setNotes', {
      cursor: WRITER, channel: 7, notes: [[32, 81, 77, 16 / 512]],
    });
    await wait(200);
    const replaceCandidate = await candidate(source, replaceRow);
    rebuild = registry.startRebuild();
    registry.finishRebuild(rebuild, [moveCandidate, replaceCandidate],
      'continuous-same-address');
    const replacedId = registry.entries()
      .find((entry) => entry.address.row === replaceRow)!.logicalId;
    const beforeReplace = await revision();
    await bridge.request('slot.delete', {
      trackIndex: (await resolveTrack(source.channelId))!.index, slotIndex: replaceRow,
    });
    await pollUntil(async () => !(
      await bridge.request('slot.status', {
        trackIndex: (await resolveTrack(source!.channelId))!.index, slotIndex: replaceRow,
      }) as { hasContent: boolean }
    ).hasContent);
    await bridge.request('slot.moveTo', {
      trackIndex: (await resolveTrack(source.channelId))!.index,
      slotIndex: targetRow,
      toTrackIndex: (await resolveTrack(source.channelId))!.index,
      toSlotIndex: replaceRow,
    });
    await pollUntil(async () => (
      await bridge.request('slot.status', {
        trackIndex: (await resolveTrack(source!.channelId))!.index, slotIndex: replaceRow,
      }) as { hasContent: boolean }
    ).hasContent);
    const afterReplace = await revision();
    const afterReplaceCandidate = await candidate(source, replaceRow);
    const replacement = registry.reconcileContentEvents(
      eventsSince(beforeReplace, afterReplace),
      [afterReplaceCandidate],
    );
    check('replacement retires the old destination identity',
      replacement.retired.includes(replacedId)
        && registry.entries().every((entry) => entry.logicalId !== replacedId),
      replacement);
    targetRow = replaceRow;
    bound = await bindObserver((await resolveTrack(source.channelId))!.index, targetRow, canaryRow);
    exact = await compareArm('clip replacement', bound.notes, source, targetRow);

    await bridge.request('scene.create', { count: 1 });
    await pollUntil(async () => await sceneCount() === baselineScenes + 6);
    registry.insertScene(baselineScenes + 5);
    bound = await bindObserver((await resolveTrack(source.channelId))!.index, targetRow, canaryRow);
    exact = await compareArm('scene create after observed clip', bound.notes, source, targetRow);
    await bridge.request('scene.delete', { sceneIndex: baselineScenes + 5 });
    await pollUntil(async () => await sceneCount() === baselineScenes + 5);
    registry.deleteScene(baselineScenes + 5);
    bound = await bindObserver((await resolveTrack(source.channelId))!.index, targetRow, canaryRow);
    exact = await compareArm('scene delete after observed clip', bound.notes, source, targetRow);

    const helper = await createTrack(HELPER_NAME);
    registry.trackPositionChanged();
    source = (await resolveTrack(source.channelId))!;
    bound = await bindObserver(source.index, targetRow, canaryRow);
    exact = await compareArm('track create and address re-resolution', bound.notes, source, targetRow);

    const oldIds = new Set((await tracks()).map((item) => item.channelId));
    await bridge.request('branch.duplicateTrack', {
      trackIndex: source.index,
      expectedChannelId: source.channelId,
      route: 'channelDuplicate',
    });
    const trackDuplicated = await pollUntil(async () => (await tracks()).length === oldIds.size + 1);
    if (!trackDuplicated.ok) throw new Error('track duplicate did not settle');
    const trackCopy = (await tracks()).filter((item) => !oldIds.has(item.channelId));
    if (trackCopy.length !== 1) throw new Error('duplicated track identity is ambiguous');
    ownedTrackIds.add(trackCopy[0]!.channelId);
    const copyAuthority = await authority(trackCopy[0]!.index, targetRow);
    check('track duplicate mints a fresh channel identity and copies clip content',
      trackCopy[0]!.channelId !== source.channelId && stable(copyAuthority) === stable(exact),
      { source: source.channelId, copy: trackCopy[0]!.channelId });
    bound = await bindObserver(trackCopy[0]!.index, targetRow, canaryRow);
    await compareArm('track duplicate clip', bound.notes, trackCopy[0]!, targetRow);

    const callbackBeforeSceneDelete = registry.bind(address(source.channelId, targetRow));
    const repairStarted = performance.now();
    await bridge.request('scene.delete', { sceneIndex: baselineScenes });
    await pollUntil(async () => await sceneCount() === baselineScenes + 4);
    registry.deleteScene(baselineScenes);
    targetRow -= 1;
    check('a callback token from before scene compaction is rejected',
      !registry.acceptsCallback(callbackBeforeSceneDelete));
    const staleStatus = await bridge.request('cursor.status', { cursor: OBSERVER }) as {
      readonly sceneIndex: number;
    };
    check('scene compaction leaves the held proxy scene index stale',
      staleStatus.sceneIndex === targetRow + 1,
      { held: staleStatus.sceneIndex, current: targetRow });
    source = (await resolveTrack(source.channelId))!;
    bound = await bindObserver(source.index, targetRow, canaryRow);
    costs.incrementalRepairMs = performance.now() - repairStarted;
    exact = await compareArm('scene delete before observed clip', bound.notes, source, targetRow);

    const beforeGroupIds = new Set((await tracks()).map((item) => item.channelId));
    const groupAction = await bridge.request('app.invokeAction', {
      id: 'Create Group Track',
    }) as { readonly resolved: boolean };
    if (!groupAction.resolved) throw new Error('Create Group Track action did not resolve');
    const grouped = await pollUntil(async () => (await tracks()).length === beforeGroupIds.size + 1);
    if (!grouped.ok) throw new Error('group track did not settle');
    const group = (await tracks()).filter((item) =>
      !beforeGroupIds.has(item.channelId) && item.type === 'Group');
    if (group.length !== 1) throw new Error('created group identity is ambiguous');
    ownedTrackIds.add(group[0]!.channelId);
    const fullStarted = performance.now();
    const groupRebuild = registry.groupTopologyChanged();
    source = (await resolveTrack(source.channelId))!;
    const fullCandidates = await completeOwnedCandidates();
    const currentCandidate = fullCandidates.find((item) =>
      item.address.channelId === source!.channelId && item.address.row === targetRow);
    if (currentCandidate === undefined) throw new Error('complete rebuild missed the observed clip');
    registry.finishRebuild(groupRebuild, fullCandidates);
    bound = await bindObserver(source.index, targetRow, canaryRow);
    costs.completeRebuildMs = performance.now() - fullStarted;
    exact = await compareArm('track group change and complete rebuild', bound.notes, source, targetRow);

    const interrupted = registry.startRebuild();
    const callbackBeforeAbort = registry.bind(address(source.channelId, targetRow));
    check('an interrupted rebuild invalidates its staging result', registry.abortRebuild(interrupted));
    check('late work from an interrupted rebuild is rejected',
      !registry.acceptsCallback(callbackBeforeAbort)
        && !registry.finishRebuild(interrupted, fullCandidates));
    const retry = registry.startRebuild();
    registry.finishRebuild(retry, await completeOwnedCandidates());
    bound = await bindObserver(source.index, targetRow, canaryRow);
    await compareArm('failed rebuild recovery', bound.notes, source, targetRow);

    await pointAndPin(READER, source.index, targetRow);
    await bridge.request('cursor.setStepSize', { cursor: READER, stepSize: GRID });
    await bridge.request('cursor.scrollToStep', { cursor: READER, step: 0 });
    await wait(144);
    bound = await bindObserver(source.index, targetRow, canaryRow);
    const observerBeforeDelete = await bridge.request('stepdata.observer.read') as StepDataRead;
    const beforeSceneAt = await revision();
    await bridge.request('scene.delete', { sceneIndex: targetRow });
    await pollUntil(async () => await sceneCount() === baselineScenes + 3);
    registry.deleteScene(targetRow);
    const observerAfterDelete = await settleObserver(observerBeforeDelete.callbacks + 1);
    const deletedCache = normalized((await enrich(observerAfterDelete)).notes);
    await compareDeletedArm('scene delete at observed clip', deletedCache);
    const afterSceneAt = await revision();
    check('scene-at deletion produces an empty launcher event for the observed clip',
      eventsSince(beforeSceneAt, afterSceneAt).some((item) => !item.filled));

    const duplicateCurrent = await resolveTrack(trackCopy[0]!.channelId);
    if (duplicateCurrent !== undefined) {
      registry.deleteTrack(duplicateCurrent.channelId);
      await deleteTrack(duplicateCurrent.channelId);
      check('track deletion removes its durable identity',
        (await resolveTrack(duplicateCurrent.channelId)) === undefined);
    }
    await deleteTrack(helper.channelId);

    note(`incremental repair ${costs.incrementalRepairMs.toFixed(3)} ms; complete rebuild ${costs.completeRebuildMs.toFixed(3)} ms`);
  } finally {
    await cleanup(baselineTrackIds, baselineScenes, entrySelection);
    const finalTracks = await tracks();
    const finalScan = await scanSummary();
    check('probe cleanup restores the exact baseline track identities',
      stable(finalTracks.map((item) => item.channelId).sort())
        === stable([...baselineTrackIds].sort()),
      { before: baselineTrackIds, after: finalTracks.map((item) => item.channelId) });
    check('probe cleanup restores the scene and empty-launcher baseline',
      finalScan.sceneCount === baselineScenes
        && finalScan.slotsWithContent === baselineScan.slotsWithContent,
      { before: baselineScan, after: finalScan });
    console.log(`E138_LIFECYCLE_MATRIX ${JSON.stringify({ arms, costs })}`);
    await adapter.close();
  }
}

try {
  await run();
} catch (error) {
  check('E138 lifecycle matrix completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  try {
    await adapter.close();
  } catch {
    // The main error is more useful than a second close error.
  }
}

console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
process.exit(failureCount() === 0 ? 0 : 1);
