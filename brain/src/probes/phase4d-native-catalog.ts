/** Phase 4 session 4d: resolve the supported native cohort against Bitwig. */
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { BridgeClient } from '../client.js';
import type { NativeCatalog, NativeResolution, NativeResolutionDevice } from '../native-catalog/catalog.js';
import { check, failureCount, note, pollUntil } from './lib.js';

const PROJECT = '26.05-2 moon';
const TRACK_NAME = 'gn-4d-native-catalog';
const ASSET_DIR = join(import.meta.dirname, '..', '..', 'assets', 'native-devices');
const CATALOG_PATH = join(ASSET_DIR, 'catalog.json');
const RESOLUTION_PATH = join(ASSET_DIR, 'live-resolution.json');
const WRITE = process.argv.includes('--write');
const COHORT = [
  { uuid: 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef', name: 'Polysynth', typed: true },
  { uuid: '468bc14b-b2e7-45a1-9666-e83117fe404e', name: 'Sampler', typed: false },
] as const;

interface TrackRow {
  readonly index: number;
  readonly name: string;
  readonly type: string;
  readonly channelId: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
  readonly mixerTrackIndex: number;
}

interface DirectReply {
  readonly params: readonly { readonly id: string; readonly name?: string; readonly value?: number }[];
  readonly count: number;
  readonly generation: number;
  readonly idsGeneration: number;
  readonly deviceExists: boolean;
  readonly deviceName: string;
  readonly trackChannelId: string;
  readonly deviceIndex: number;
  readonly observedTrackChannelId?: string;
  readonly observedDeviceName?: string;
  readonly observedDeviceIndex: number;
}

interface TypedReply {
  readonly params: readonly {
    readonly id: string;
    readonly exists: boolean;
    readonly name?: string;
    readonly value?: number;
    readonly displayed?: string;
    readonly modulatedValue?: number;
    readonly hasAutomation?: boolean;
    readonly origin?: number;
    readonly discreteValueCount?: number;
    readonly discreteValueNames?: readonly string[];
  }[];
  readonly deviceName: string;
}

const bridge = new BridgeClient();
const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as NativeCatalog;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let ownedTrackId: string | undefined;
let entrySelection: Selection | undefined;
let entryTrackCount = 0;
const resolved: NativeResolutionDevice[] = [];

async function tracks(): Promise<readonly TrackRow[]> {
  return ((await bridge.request('track.list')) as { readonly tracks: readonly TrackRow[] }).tracks;
}

async function restoreSelection(): Promise<void> {
  if (entrySelection === undefined || entrySelection.trackIndex < 0 || entrySelection.slotIndex < 0) return;
  await bridge.request('slot.select', {
    trackIndex: entrySelection.trackIndex,
    slotIndex: entrySelection.slotIndex,
    mechanism: 'track',
  });
  await wait(150);
}

async function stableDirect(
  deviceIndex: number,
  name: string,
  targetTrackIndex: number,
  detour: TrackRow,
): Promise<DirectReply> {
  await bridge.request('devcursor.pin', { pinned: false });
  await bridge.request('cursor.pinTrack', { cursor: '0', pinned: false });
  await bridge.request('cursor.pointTrack', { cursor: '0', trackIndex: detour.index });
  const detoured = await pollUntil(async () => {
    const status = await bridge.request('devcursor.status') as DirectReply;
    return status.trackChannelId === detour.channelId;
  }, 5000, 100);
  if (!detoured.ok) throw new Error(`device cursor did not detour through ${detour.name}`);
  await wait(250);
  await bridge.request('directparam.list', { begin: true });

  await bridge.request('cursor.pointTrack', { cursor: '0', trackIndex: targetTrackIndex });
  const returned = await pollUntil(async () => {
    const list = await bridge.request('device.list', { cursor: 0 }) as {
      readonly devices: readonly { readonly index: number; readonly name: string }[];
      readonly trackChannelId: string;
    };
    return list.trackChannelId === ownedTrackId
      && list.devices.some((device) => device.index === deviceIndex && device.name === name);
  }, 5000, 100);
  if (!returned.ok) throw new Error(`device cursor did not return to ${name}`);
  await bridge.request('devcursor.selectAt', { deviceIndex });
  await bridge.request('cursor.pinTrack', { cursor: '0', pinned: true });
  await bridge.request('devcursor.pin', { pinned: true });
  const confirmed = await pollUntil(async () => {
    const status = await bridge.request('devcursor.status') as DirectReply & {
      readonly exists?: boolean; readonly name?: string; readonly isPinned?: boolean;
      readonly cursorTrackPinned?: boolean;
    };
    return status.exists === true && status.name === name && status.deviceIndex === deviceIndex
      && status.trackChannelId === ownedTrackId && status.isPinned === true
      && status.cursorTrackPinned === true;
  }, 5000, 100);
  if (!confirmed.ok) throw new Error(`device cursor did not confirm ${name}`);
  await wait(250);

  let prior = '';
  let last: DirectReply | undefined;
  for (let attempt = 0; attempt < 40; attempt++) {
    await wait(100);
    const reply = await bridge.request('directparam.list', {}) as DirectReply;
    last = reply;
    const ids = JSON.stringify(reply.params);
    const targetMatches = reply.deviceExists && reply.deviceName === name
      && reply.deviceIndex === deviceIndex && reply.observedDeviceName === name
      && (reply.observedDeviceIndex < 0 || reply.observedDeviceIndex === deviceIndex)
      && reply.idsGeneration === reply.generation
      && reply.observedTrackChannelId === ownedTrackId;
    if (targetMatches && reply.count > 8 && ids === prior) return reply;
    prior = targetMatches ? ids : '';
  }
  throw new Error(`DirectParameter inventory did not settle for ${name}: ${JSON.stringify({
    count: last?.count,
    generation: last?.generation,
    idsGeneration: last?.idsGeneration,
    deviceExists: last?.deviceExists,
    deviceName: last?.deviceName,
    deviceIndex: last?.deviceIndex,
    trackChannelId: last?.trackChannelId,
    observedTrackChannelId: last?.observedTrackChannelId,
    observedDeviceName: last?.observedDeviceName,
    observedDeviceIndex: last?.observedDeviceIndex,
  })}`);
}

async function createOwnedTrack(): Promise<number> {
  const before = await tracks();
  await bridge.request('track.create', { position: before.length });
  const created = await pollUntil(async () => (await tracks()).length === before.length + 1, 5000, 100);
  if (!created.ok) throw new Error('owned track did not appear');
  const after = await tracks();
  const row = [...after].reverse().find((candidate) => candidate.type === 'Instrument');
  if (row === undefined) throw new Error('created Instrument track was not found');
  ownedTrackId = row.channelId;
  await bridge.request('track.setName', { trackIndex: row.index, name: TRACK_NAME });
  const renamed = await pollUntil(async () => (await tracks()).some((candidate) =>
    candidate.channelId === ownedTrackId && candidate.name === TRACK_NAME), 5000, 100);
  if (!renamed.ok) throw new Error('owned track rename did not settle');
  return row.index;
}

async function cleanup(): Promise<void> {
  if (ownedTrackId !== undefined) {
    const found = await bridge.request('track.resolveByChannelId', { channelId: ownedTrackId }) as {
      readonly found: boolean; readonly index?: number; readonly name?: string;
    };
    if (found.found && found.index !== undefined && found.name === TRACK_NAME) {
      await bridge.request('track.delete', { trackIndex: found.index });
      await pollUntil(async () => !(await tracks()).some((row) => row.channelId === ownedTrackId), 5000, 100);
    }
    ownedTrackId = undefined;
  }
  await restoreSelection();
}

try {
  await bridge.connect();
  const host = await bridge.request('host.info') as { readonly hostVersion?: string };
  const revision = await bridge.request('revision.get') as { readonly project: string };
  check('4d-L1: the accepted project and catalog Bitwig version are live',
    revision.project === PROJECT && host.hostVersion === catalog.bitwigVersion,
    { project: revision.project, host: host.hostVersion, catalog: catalog.bitwigVersion });
  entrySelection = await bridge.request('selection.status') as Selection;
  const entryTracks = await tracks();
  entryTrackCount = entryTracks.length;
  const detour = entryTracks.find((row) => row.type === 'Instrument');
  if (detour === undefined) throw new Error('the entry project has no Instrument track for the cursor detour');

  const trackIndex = await createOwnedTrack();
  await bridge.request('cursor.pinTrack', { cursor: '0', pinned: false });
  await bridge.request('cursor.pointTrack', { cursor: '0', trackIndex });
  await wait(150);
  await bridge.request('cursor.pinTrack', { cursor: '0', pinned: true });

  for (let index = 0; index < COHORT.length; index++) {
    const expected = COHORT[index]!;
    await bridge.request('device.insertBitwig', { cursor: '0', uuid: expected.uuid });
    const inserted = await pollUntil(async () => {
      const list = await bridge.request('device.list', { cursor: 0 }) as {
        readonly devices: readonly { readonly index: number; readonly name: string }[];
        readonly trackChannelId: string;
      };
      return list.trackChannelId === ownedTrackId
        && list.devices.some((device) => device.index === index && device.name === expected.name);
    }, 8000, 150);
    if (!inserted.ok) throw new Error(`${expected.name} did not insert at index ${index}`);

    const direct = await stableDirect(index, expected.name, trackIndex, detour);
    let typedIds: string[] = [];
    if (expected.typed) {
      let typed = await bridge.request('param.list') as TypedReply;
      for (let attempt = 0; attempt < 20 && typed.deviceName !== expected.name; attempt++) {
        await wait(100);
        typed = await bridge.request('param.list') as TypedReply;
      }
      typedIds = [...new Set(typed.params.filter((param) => param.exists).map((param) => param.id))].sort();
      const generatedIds = new Set(typed.params.map((param) => param.id));
      const priorResolution = catalog.devices.find((device) => device.uuid === expected.uuid)?.parameterResolution;
      const expectedTypedIds = priorResolution?.status === 'live-resolved'
        ? priorResolution.typedResolvedIds
        : typedIds;
      const completeMetadata = typed.params.filter((param) => param.exists).every((param) =>
        typeof param.name === 'string' && typeof param.value === 'number'
        && typeof param.displayed === 'string' && typeof param.modulatedValue === 'number'
        && typeof param.hasAutomation === 'boolean' && typeof param.origin === 'number'
        && typeof param.discreteValueCount === 'number' && Array.isArray(param.discreteValueNames));
      check('4d-L2: supported Polysynth typed handles exist and report typed metadata',
        expectedTypedIds.every((id) => generatedIds.has(id) && typedIds.includes(id))
          && typedIds.length > 8 && completeMetadata,
        {
          catalogStatus: priorResolution?.status,
          generated: generatedIds.size,
          expected: expectedTypedIds.length,
          existing: typedIds.length,
          completeMetadata,
        });
    }

    const catalogDevice = catalog.devices.find((device) => device.uuid === expected.uuid);
    if (catalogDevice === undefined) throw new Error(`catalog has no ${expected.name}`);
    const directIds = direct.params.map((param) => param.id).sort();
    const directCandidates = new Set(directIds.flatMap((id) =>
      id.startsWith('CONTENTS/') ? [id.slice('CONTENTS/'.length)] : []));
    const candidateSet = new Set(catalogDevice.candidateParameterIds);
    const falselyLive = catalogDevice.parameterResolution.status === 'live-resolved'
      ? catalogDevice.parameterResolution.resolvedIds.filter((id) => !directCandidates.has(id))
      : [];
    check(`4d-L${index + 3}: ${expected.name} resolves with no catalog id falsely reported live`,
      directIds.length > 8 && falselyLive.length === 0,
      {
        candidates: candidateSet.size,
        direct: directIds.length,
        overlap: [...directCandidates].filter((id) => candidateSet.has(id)).length,
        falselyLive,
      });
    resolved.push({ uuid: expected.uuid, name: expected.name, directParameterIds: directIds, typedParameterIds: typedIds });
  }

  await cleanup();
  const finalSelection = await bridge.request('selection.status') as Selection;
  check('4d-L5: cleanup restores the project shape and entry selection',
    (await tracks()).length === entryTrackCount
      && finalSelection.trackIndex === entrySelection.trackIndex
      && finalSelection.slotIndex === entrySelection.slotIndex,
    { entrySelection, finalSelection, trackCount: (await tracks()).length });

  if (WRITE && failureCount() === 0) {
    const resolution: NativeResolution = {
      schemaVersion: 1,
      bitwigVersion: catalog.bitwigVersion,
      sourceFingerprint: catalog.source.fingerprint,
      resolvedAt: new Date().toISOString().slice(0, 10),
      devices: resolved,
    };
    writeFileSync(RESOLUTION_PATH, `${JSON.stringify(resolution, null, 2)}\n`);
    note(`wrote ${RESOLUTION_PATH}`);
  }
} catch (error) {
  check('4d-LX: the native catalog proof completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  try { await cleanup(); } catch (error) {
    check('4d-L6: failure cleanup removes the owned track and restores selection', false,
      error instanceof Error ? error.message : String(error));
  }
  bridge.disconnect();
}

console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
if (failureCount() > 0) process.exitCode = 1;
