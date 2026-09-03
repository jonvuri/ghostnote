/** Phase 5t live matrix for compact modulator placement and page families. */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import {
  addModulator, donorType, listDonorTypes, listModulators, listSupportedDonorTypes,
  loadDonor, replaceModulator, validate,
  type DonorType,
} from '../bwmod/index.js';
import { FIXTURE_DIR } from '../bwmod/fixtures.js';
import { instanceGroupOffset, instanceIdOffset } from '../bwmod/stream.js';
import { composeExistingDeviceWrapperPreset } from '../composition/index.js';
import { OWNED_FX_LAYER_TEMPLATE_PATH } from '../composition/assets.js';
import {
  addressKey, clip, device, remote, remotes, scene, slot, track,
  type TrackAddress, type TrackState,
} from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool } from '../surface/tools.js';
import { workspaceOf, type Workspace } from '../surface/workspace.js';
import { check, client, failureCount, note, pollUntil } from './lib.js';
import { phase5tWitnessPolicy } from './phase5t-witness-policy.js';

const TRACK_NAME = 'gn-p5t-grid-generalization';
const TARGET = { parameterId: 'CONTENTS/F1FREQ', parameterName: 'Filter Frequency' } as const;
const COHORT_SIZE = 14;

type PublicLocation =
  | { readonly kind: 'self' }
  | { readonly kind: 'container'; readonly name: string };

interface PublicAuthoringResult {
  readonly applied?: boolean;
  readonly edited?: {
    readonly after?: readonly {
      readonly name: string;
      readonly instanceGroup: number;
      readonly instanceId: number;
    }[];
  };
  readonly observed?: {
    readonly pages?: { readonly verified?: boolean; readonly actualPages?: readonly string[] };
  };
  readonly verified?: { readonly passed?: boolean; readonly pages?: boolean };
  readonly change?: { readonly changeId?: string };
}

interface PublicWrapperResult {
  readonly complete?: boolean;
  readonly verification?: {
    readonly scalarFingerprint?: { readonly preserved?: boolean };
    readonly pages?: { readonly verified?: boolean; readonly actualPages?: readonly string[] };
    readonly behaviors?: readonly { readonly verified?: boolean }[];
  };
  readonly reversalCheckpoint?: unknown;
}

function sameTracks(left: readonly TrackState[], right: readonly TrackState[]): boolean {
  return JSON.stringify(left.map((item) => [item.channelId, item.name, item.position, item.type]))
    === JSON.stringify(right.map((item) => [item.channelId, item.name, item.position, item.type]));
}

function donorPair(type: DonorType): string {
  const bytes = loadDonor(type.donorId).bytes;
  return `${bytes.readUInt8(instanceGroupOffset(bytes, 0, bytes.length))}:`
    + `${bytes.readUInt8(instanceIdOffset(bytes, 0, bytes.length))}`;
}

function slotPair(index: number): string {
  return `${Math.floor(index / 3)}:${index % 3}`;
}

/** Make three bounded cohorts where every donor leaves its saved zoo pair. */
function relocatedCohorts(types: readonly DonorType[]): readonly (readonly DonorType[])[] {
  const remaining = [...types].reverse();
  const cohorts: DonorType[][] = [];
  while (remaining.length > 0) {
    const cohort: DonorType[] = [];
    while (cohort.length < COHORT_SIZE && remaining.length > 0) {
      const slot = cohort.length;
      const found = remaining.findIndex((type) => donorPair(type) !== slotPair(slot));
      if (found < 0) throw new Error(`no relocated donor fits compact slot ${slotPair(slot)}`);
      cohort.push(remaining.splice(found, 1)[0]!);
    }
    cohorts.push(cohort);
  }
  return cohorts;
}

function pageChecks(names: readonly string[]): readonly { pageName: string; expectedCount: number }[] {
  return [...new Set(names)].map((pageName) => ({
    pageName,
    expectedCount: names.filter((name) => name === pageName).length,
  }));
}

async function inspectLocation(workspace: Workspace, presetPath: string): Promise<{
  readonly fingerprint: { readonly algorithm: 'sha256'; readonly sha256: string; readonly byteLength: number };
  readonly location: PublicLocation;
}> {
  const inspection = await callTool(workspace, 'inspect_preset_modulation', { presetPath }) as {
    readonly supported?: boolean;
    readonly fingerprint?: {
      readonly algorithm: 'sha256'; readonly sha256: string; readonly byteLength: number;
    };
    readonly modulation?: readonly { readonly location: PublicLocation }[];
  };
  const location = inspection.modulation?.find((item) =>
    item.location.kind === 'self' || item.location.kind === 'container')?.location;
  if (inspection.supported !== true || inspection.fingerprint === undefined || location === undefined) {
    throw new Error(`preset inspection failed: ${JSON.stringify(inspection)}`);
  }
  return { fingerprint: inspection.fingerprint, location };
}

async function insertWithPageProof(
  workspace: Workspace,
  ownedTrack: TrackAddress,
  presetPath: string,
  names: readonly string[],
  operation: Record<string, unknown> = { kind: 'amount', position: 0, amount: 0.5 },
): Promise<PublicAuthoringResult> {
  const inspected = await inspectLocation(workspace, presetPath);
  return await callTool(workspace, 'author_modulators', {
    trackId: ownedTrack.channelId,
    presetPath,
    fingerprint: inspected.fingerprint,
    location: inspected.location,
    operation,
    pageChecks: pageChecks(names),
    behaviorChecks: [],
  }) as PublicAuthoringResult;
}

async function reversePublic(
  workspace: Workspace,
  adapter: LiveAdapter,
  ownedTrack: TrackAddress,
  label: string,
  result: PublicAuthoringResult,
): Promise<void> {
  const changeId = result.change?.changeId;
  if (changeId === undefined) return;
  const reversed = await callTool(workspace, 'revert_change', { changeId }) as {
    readonly applied?: boolean;
    readonly notRestored?: readonly unknown[];
  };
  const devices = await adapter.devices(ownedTrack);
  check(`${label}: public reversal restores the empty owned track`,
    reversed.applied === true && (reversed.notRestored?.length ?? 0) === 0
      && devices.devicesComplete && devices.devices.length === 0,
    { reversed, devices });
}

async function reverseWrapper(
  workspace: Workspace,
  adapter: LiveAdapter,
  ownedTrack: TrackAddress,
  label: string,
  result: PublicWrapperResult,
): Promise<void> {
  if (result.reversalCheckpoint === undefined) return;
  const reversed = await callTool(workspace, 'reverse_existing_device_modulation_wrap', {
    checkpoint: result.reversalCheckpoint,
  }) as { readonly complete?: boolean; readonly containerRemoved?: boolean };
  const devices = await adapter.devices(ownedTrack);
  check(`${label}: public wrapper reversal restores the source device`,
    reversed.complete === true && reversed.containerRemoved === true
      && devices.devicesComplete && devices.devices.length === 1
      && devices.devices[0]?.name === 'Polysynth',
    { reversed, devices });
}

async function proveOperatorControls(
  adapter: LiveAdapter,
  ownedTrack: TrackAddress,
  types: readonly DonorType[],
): Promise<void> {
  const container = device(ownedTrack, 0);
  for (const type of types.filter((item) => phase5tWitnessPolicy(item).operatorControl)) {
    const inventoryAddress = remotes(container);
    const before = await adapter.read([inventoryAddress]);
    const beforeValue = before.entries[addressKey(inventoryAddress)]?.value;
    const page = beforeValue?.of === 'remotes'
      ? beforeValue.remotes.pages.find((item) => item.name === type.publicName)
      : undefined;
    const control = page?.controls[0];
    if (page === undefined || control === undefined) {
      check(`5t-operator-${type.id}: one exact remote control is available`, false, before);
      continue;
    }

    const selector = remote(container, page.index, page.name, control.index, control.name);
    const changedValue = control.value < 0.5 ? 0.75 : 0.25;
    const changed = await adapter.apply({ ops: [{
      op: 'remote.set', remote: selector, value: changedValue, expectedName: 'FX Layer',
    }] });
    const changedSnapshot = await adapter.read([selector]);
    const changedRemote = changedSnapshot.entries[addressKey(selector)]?.value;
    check(`5t-operator-${type.id}: the declared operator control changes exactly`,
      changed.accepted && changedRemote?.of === 'remote'
        && Math.abs(changedRemote.remote.value - changedValue) <= 2e-3,
      { control: control.name, changed, changedRemote });

    const restored = await adapter.apply({ ops: [{
      op: 'remote.set', remote: selector, value: control.value, expectedName: 'FX Layer',
    }] });
    const restoredSnapshot = await adapter.read([selector]);
    const restoredRemote = restoredSnapshot.entries[addressKey(selector)]?.value;
    check(`5t-operator-${type.id}: the operator control restores exactly`,
      restored.accepted && restoredRemote?.of === 'remote'
        && Math.abs(restoredRemote.remote.value - control.value) <= 2e-3,
      { control: control.name, restored, restoredRemote });
  }
}

function envelopePreset(
  source: Buffer,
  listIndex: number | undefined,
  pair: readonly [number, number],
): Buffer {
  const route = listIndex === undefined
    ? 'CONTENTS/F1FREQ'
    : 'CONTENTS/CHAIN_LIST/CHAIN0/DEVICE_CHAIN/0:CONTENTS/F1FREQ';
  const adjacent: readonly [number, number] = pair[0] === 0 && pair[1] === 0 ? [0, 1] : [0, 0];
  const envelope = listDonorTypes().find((type) => type.id === 'envelope-follower');
  if (envelope === undefined) throw new Error('the Envelope Follower donor is missing');
  let preset = addModulator(
    source,
    loadDonor(envelope.donorId),
    { target: route, amount: 0.5 },
    { ...(listIndex === undefined ? {} : { listIndex }), instanceGroup: pair[0], instanceId: pair[1] },
  );
  preset = addModulator(
    preset,
    loadDonor(donorType('lfo', 'add').donorId),
    { target: route, amount: 0.5 },
    {
      ...(listIndex === undefined ? {} : { listIndex }),
      instanceGroup: adjacent[0], instanceId: adjacent[1],
    },
  );
  const checked = validate(preset, {
    reference: source,
    ...(listIndex === undefined ? {} : { listIndex }),
  });
  if (!checked.ok) throw new Error(`Envelope Follower preset failed validation: ${checked.problems.join('; ')}`);
  return preset;
}

await client.connect();
const adapter = new LiveAdapter({ transport: new BridgeTransport(client) });
const keepAlive = setInterval(() => undefined, 1_000);
const temp = await mkdtemp(join(tmpdir(), 'gn-p5t-grid-'));
let ownedTrack: TrackAddress | undefined;
let entryTracks: readonly TrackState[] = [];
let entryTransportPlaying = false;
let transportStartedByProbe = false;

try {
  const hello = await adapter.hello();
  note(`Bitwig ${hello.host?.version ?? 'unknown'}; contract ${hello.contractVersion}`);
  const entryTransport = await client.request('transport.status') as { readonly isPlaying?: boolean };
  entryTransportPlaying = entryTransport.isPlaying === true;
  check('5t-entry: transport starts at the stopped baseline', !entryTransportPlaying, entryTransport);
  if (entryTransportPlaying) throw new Error('the transport is not at the stopped baseline');
  entryTracks = await adapter.tracks();
  const created = await adapter.apply({ ops: [{ op: 'track.create', name: TRACK_NAME }] });
  const mint = created.minted[0];
  if (mint?.kind !== 'track') throw new Error('the owned track returned no durable id');
  ownedTrack = track(mint.channelId);
  await adapter.settle('trackStruct');

  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter,
    executor: new Executor(adapter),
    stash: new Stash(),
    observationStore: new FakeObservationStore(),
  });

  const types = listDonorTypes();
  const cohorts = relocatedCohorts(types);
  check('5t-offline: all 42 curated donors form three relocated cohorts',
    types.length === 42 && cohorts.length === 3
      && cohorts.flat().every((type, index) => donorPair(type) !== slotPair(index % COHORT_SIZE)),
    cohorts.map((cohort) => cohort.map((type) => type.id)));

  const fxSource = await readFile(OWNED_FX_LAYER_TEMPLATE_PATH);
  for (const [cohortIndex, cohort] of cohorts.entries()) {
    let preset: Buffer = Buffer.from(fxSource);
    for (const type of cohort) {
      preset = addModulator(
        preset,
        loadDonor(type.donorId),
        { target: 'CONTENTS/CHAIN_LIST/CHAIN0/DEVICE_CHAIN/0:CONTENTS/F1FREQ', amount: 0.5 },
        { listIndex: 0 },
      );
    }
    const modulators = listModulators(preset, 0);
    check(`5t-offline-${cohortIndex + 1}: pairs are compact through each row boundary`,
      modulators.length === cohort.length
        && modulators.every((item, index) =>
          `${item.instanceGroup}:${item.instanceId}` === slotPair(index)),
      modulators.map((item) => `${item.deviceName}@${item.instanceGroup}:${item.instanceId}`));
  }

  await adapter.apply({ ops: [{
    op: 'device.insert',
    track: ownedTrack,
    source: { from: 'bitwig', uuid: 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef' },
    expectedDeviceName: 'Polysynth',
    expectedChain: [],
    expectedEnabledChain: [],
  }] });
  await adapter.settle('deviceInsert');

  const supported = relocatedCohorts(listSupportedDonorTypes())[0]!;
  const policies = supported.map((type) => ({ type, policy: phase5tWitnessPolicy(type) }));
  check('5t-witness-policy: every supported donor has a declared live setup',
    policies.length === 12
      && policies.every((item) => item.policy.exactPage
        || item.policy.operatorControl || item.policy.targetDivergence),
    policies);

  const triggerRevision = await adapter.revision();
  const triggerSlot = slot(ownedTrack, scene(0, triggerRevision.sceneEpoch));
  const triggerClip = clip(triggerSlot);
  const triggerCreated = await adapter.apply({ ops: [{
    op: 'clip.create', slot: triggerSlot, lengthBeats: 4,
  }] });
  const triggerWritten = await adapter.apply({ ops: [{
    op: 'note.write', clip: triggerClip,
    notes: [{ startBeats: 0, pitch: 60, velocity: 100, durationBeats: 4 }],
  }] });
  transportStartedByProbe = true;
  const triggerLaunched = await adapter.apply({ ops: [{
    op: 'clip.launch', clip: triggerClip, quantization: 'none', mode: 'from_start',
  }] });
  const transportRunning = await pollUntil(async () =>
    ((await client.request('transport.status')) as { readonly isPlaying?: boolean }).isPlaying === true);
  check('5t-witness-trigger: one sustained note supplies every note and transport requirement',
    triggerCreated.accepted && triggerWritten.accepted && triggerLaunched.accepted
      && transportRunning.ok
      && policies.filter((item) => item.policy.sustainedNote).length === 5
      && policies.filter((item) => item.policy.runningTransport).length === 8,
    { triggerCreated, triggerWritten, triggerLaunched, transportRunning });
  if (!transportRunning.ok) throw new Error('the live witness trigger did not start transport');
  await new Promise((resolve) => setTimeout(resolve, 400));

  for (const [cohortIndex, cohort] of [supported].entries()) {
    const composed = await composeExistingDeviceWrapperPreset(cohort.map((type) => ({
      modulator: type.id,
      target: TARGET,
      amount: 0.5,
    })));
    const modulators = listModulators(composed.preset, 0);
    check(`5t-supported-${cohortIndex + 1}: offline pairs are compact through each row boundary`,
      modulators.length === cohort.length
        && modulators.every((item, index) =>
          `${item.instanceGroup}:${item.instanceId}` === slotPair(index)),
      modulators.map((item) => `${item.deviceName}@${item.instanceGroup}:${item.instanceId}`));
    const source = await adapter.devices(ownedTrack);
    const result = await callTool(workspace, 'wrap_existing_device_modulation', {
      trackId: ownedTrack.channelId,
      devicePosition: 0,
      expectedDeviceOrder: source.devices.map((item) => ({ name: item.name, enabled: item.enabled })),
      containerKind: 'FX Layer',
      entryName: 'Layer 1',
      modulators: cohort.map((type) => ({ modulator: type.id, target: TARGET, amount: 0.5 })),
    }) as PublicWrapperResult;
    check(`5t-supported-${cohortIndex + 1}: every exact public page passes live`,
      result.complete === true && result.verification?.pages?.verified === true
        && cohort.every((type) => result.verification?.pages?.actualPages?.some((name) =>
          name === type.publicName || name.startsWith(`${type.publicName} `))),
      result);
    check(`5t-supported-${cohortIndex + 1}: state and every active witness pass after the move`,
      result.verification?.scalarFingerprint?.preserved === true
        && result.verification.behaviors?.length === cohort.length
        && result.verification.behaviors.every((item) => item.verified === true),
      result.verification);
    await proveOperatorControls(adapter, ownedTrack, cohort);
    await reverseWrapper(workspace, adapter, ownedTrack, `5t-supported-${cohortIndex + 1}`, result);
  }

  await client.request('transport.stop');
  const transportStopped = await pollUntil(async () =>
    ((await client.request('transport.status')) as { readonly isPlaying?: boolean }).isPlaying === false);
  transportStartedByProbe = !transportStopped.ok;
  const triggerDeleted = await adapter.apply({ ops: [{ op: 'clip.delete', slot: triggerSlot }] });
  check('5t-witness-trigger: transport and trigger clip restore after the live cohort',
    transportStopped.ok && triggerDeleted.accepted,
    { transportStopped, triggerDeleted });

  const duplicateSource = await adapter.devices(ownedTrack);
  const duplicateResult = await callTool(workspace, 'wrap_existing_device_modulation', {
    trackId: ownedTrack.channelId,
    devicePosition: 0,
    expectedDeviceOrder: duplicateSource.devices.map((item) => ({
      name: item.name, enabled: item.enabled,
    })),
    containerKind: 'FX Layer',
    entryName: 'Layer 1',
    modulators: [
      ...Array.from({ length: 5 }, () => ({
        modulator: 'classic-lfo', target: TARGET, amount: 0.5,
      })),
      { modulator: 'lfo', target: TARGET, amount: 0.5 },
    ],
  }) as PublicWrapperResult;
  check('5t-duplicates: five numbered Classic LFO pages pass as one exact family',
    duplicateResult.verification?.pages?.verified === true,
    duplicateResult);
  await reverseWrapper(workspace, adapter, ownedTrack, '5t-duplicates', duplicateResult);

  await adapter.apply({ ops: [{
    op: 'device.delete',
    device: device(ownedTrack, 0),
    expectedName: 'Polysynth',
    expectedChain: ['Polysynth'],
    expectedEnabledChain: [true],
  }] });
  await adapter.settle('trackStruct');

  const polySource = await readFile(join(FIXTURE_DIR, 'Polysynth', 'mp_bare.bwpreset'));
  let replacementPreset = addModulator(
    polySource,
    loadDonor(donorType('classic-lfo', 'add').donorId),
    { target: 'CONTENTS/F1FREQ', amount: 0.5 },
  );
  replacementPreset = addModulator(
    replacementPreset,
    loadDonor(donorType('random', 'add').donorId),
    { target: 'CONTENTS/F1FREQ', amount: 0.5 },
  );
  const offlineReplacement = replaceModulator(
    replacementPreset, 1, loadDonor(donorType('classic-lfo', 'replace').donorId),
  );
  const replacementPath = join(temp, 'replacement.bwpreset');
  await writeFile(replacementPath, replacementPreset);
  const replacement = await insertWithPageProof(
    workspace,
    ownedTrack,
    replacementPath,
    ['Classic LFO', 'Classic LFO'],
    { kind: 'replace', position: 1, modulator: 'classic-lfo' },
  );
  check('5t-replace: replacement keeps the resident compact tile and both pages load',
    replacement.verified?.passed === true
      && listModulators(offlineReplacement)[1]?.deviceName === 'Classic LFO'
      && listModulators(offlineReplacement)[1]?.instanceGroup === 0
      && listModulators(offlineReplacement)[1]?.instanceId === 1,
    replacement);
  await reversePublic(workspace, adapter, ownedTrack, '5t-replace', replacement);

  for (const host of [
    { name: 'Polysynth', source: polySource, listIndex: undefined },
    { name: 'FX Layer', source: fxSource, listIndex: 0 },
  ] as const) {
    for (const pair of [[4, 0], [0, 0], [1, 0]] as const) {
      const preset = envelopePreset(host.source, host.listIndex, pair);
      const path = join(temp, `${host.name.replace(' ', '-').toLowerCase()}-${pair[0]}-${pair[1]}.bwpreset`);
      await writeFile(path, preset);
      if (host.listIndex === undefined) {
        const result = await insertWithPageProof(
          workspace, ownedTrack, path, ['Envelope Follower', 'LFO'],
        );
        const actual = result.observed?.pages?.actualPages ?? [];
        check(`5t-envelope-${host.name}-${pair[0]}:${pair[1]}: standing is pair-independent`,
          result.verified?.passed === false
            && actual.includes('LFO') && !actual.includes('Envelope Follower'),
          result);
        await reversePublic(
          workspace, adapter, ownedTrack, `5t-envelope-${host.name}-${pair[0]}:${pair[1]}`, result,
        );
      } else {
        const before = await adapter.devices(ownedTrack);
        const inserted = await adapter.apply({ ops: [{
          op: 'device.insert',
          track: ownedTrack,
          source: { from: 'file', path },
          expectedDeviceName: 'FX Layer',
          expectedChain: before.devices.map((item) => item.name),
          expectedEnabledChain: before.devices.map((item) => item.enabled as boolean),
        }] });
        await adapter.settle('insertFile');
        const minted = inserted.minted[0];
        if (minted?.kind !== 'device') throw new Error('the FX Layer discrimination row returned no device');
        const selector = remotes(device(ownedTrack, minted.chainIndex));
        const snapshot = await adapter.read([selector]);
        const value = snapshot.entries[addressKey(selector)]?.value;
        const pages = value?.of === 'remotes' ? value.remotes.pages.map((page) => page.name) : [];
        check(`5t-envelope-${host.name}-${pair[0]}:${pair[1]}: standing is pair-independent`,
          !pages.includes('Envelope Follower') && pages.includes('LFO'),
          { pages, unstable: snapshot.unstable });
        const current = await adapter.devices(ownedTrack);
        await adapter.apply({ ops: [{
          op: 'device.delete',
          device: device(ownedTrack, minted.chainIndex),
          expectedName: 'FX Layer',
          expectedChain: current.devices.map((item) => item.name),
          expectedEnabledChain: current.devices.map((item) => item.enabled as boolean),
        }] });
        await adapter.settle('trackStruct');
      }
    }
  }
} catch (error) {
  check('5t-LX: the live matrix completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (transportStartedByProbe) {
    try {
      await client.request('transport.stop');
      const stopped = await pollUntil(async () =>
        ((await client.request('transport.status')) as { readonly isPlaying?: boolean }).isPlaying === false);
      check('5t-cleanup: transport returns to the stopped baseline', stopped.ok, stopped);
      transportStartedByProbe = !stopped.ok;
    } catch (error) {
      check('5t-cleanup: transport returns to the stopped baseline', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  if (ownedTrack !== undefined) {
    try {
      const devices = await adapter.devices(ownedTrack);
      for (const item of [...devices.devices].reverse()) {
        await adapter.apply({ ops: [{
          op: 'device.delete',
          device: device(ownedTrack, item.index),
          expectedName: item.name,
        }] });
        await adapter.settle('trackStruct');
      }
      await adapter.apply({ ops: [{ op: 'track.delete', track: ownedTrack }] });
      await adapter.settle('trackStruct');
    } catch (error) {
      check('5t-cleanup: owned content was removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    const finalTransport = await client.request('transport.status') as { readonly isPlaying?: boolean };
    check('5t-cleanup: the exact entry track list and transport are restored',
      sameTracks(finalTracks, entryTracks)
        && finalTransport.isPlaying === entryTransportPlaying,
      { entry: entryTracks, final: finalTracks, finalTransport });
  } catch (error) {
    check('5t-cleanup: the exact entry track list and transport are restored', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
  await rm(temp, { recursive: true, force: true });
  clearInterval(keepAlive);
}

console.log(failureCount() === 0 ? '\nPhase 5t: ALL PASS' : `\nPhase 5t: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
