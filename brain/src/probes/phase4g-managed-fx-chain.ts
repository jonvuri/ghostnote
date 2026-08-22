/** Phase 4 session 4g: prove one managed mixed-format top-level chain. */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeClient } from '../client.js';
import {
  addressKey, device, deviceEnabled, failures, fullyApplied, track,
  type ObservedDevice, type Op, type ParamAddress, type TrackAddress,
} from '../contract/index.js';
import {
  Executor, ManagedFxChainError, buildManagedFxChain, reverseManagedFxChain,
  type ManagedFxChainCheckpoint, type ManagedFxChainHost, type ManagedFxChainRecovery,
} from '../engine/index.js';
import { check, failureCount, note, pollUntil } from './lib.js';

const PROJECT = '26.05-2 moon';
const TRACK_NAME = 'gn-4g-managed-fx-chain';
const TOOL = 'e67b9c56-838d-4fba-8e3e-ae4e02cccbcb';
const DELAY_PLUS = 'f2baa2a8-36c5-4a79-b1d9-a4e461c45ee9';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const EQ_PLUS = 'e4815188-ba6f-4d14-bcfc-2dcb8f778ccb';
const VST3_CLASS_UID = 'D39D5B69D6AF42FA123456785A334D44';
const CLAP_ID = 'com.u-he.Zebra3';
const SAMPLER_PRESET = fileURLToPath(
  new URL('../../fixtures/Sampler/gn_sampler_no_sample.bwpreset', import.meta.url),
);
const TOLERANCE = 2e-3;

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

const bridge = new BridgeClient();
const adapter = new LiveAdapter();
const executor = new Executor(adapter);
const host: ManagedFxChainHost = {
  devices: (target) => adapter.devices(target),
  read: (addresses) => adapter.read(addresses),
  async apply(ops, options) {
    return { take: await executor.run(ops, options) };
  },
};

let competitor: LiveAdapter | undefined;
let ownedTrackId: string | undefined;
let entryTracks: readonly TrackRow[] = [];
let entrySelection: Selection | undefined;
let entryChain: readonly ObservedDevice[] | undefined;
let checkpoint: ManagedFxChainCheckpoint | undefined;
let reversed = false;
let seedsRemoved = false;
let cleanupTrackRemoved = false;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const errorText = (error: unknown) => error instanceof Error
  ? `${error.name}: ${error.message}` : String(error);

function requireCondition(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function chainShape(devices: readonly ObservedDevice[]) {
  return devices.map((item) => ({
    index: item.index,
    name: item.name,
    ...(item.enabled === undefined ? {} : { enabled: item.enabled }),
  }));
}

function sameChain(left: readonly ObservedDevice[], right: readonly ObservedDevice[]): boolean {
  return JSON.stringify(chainShape(left)) === JSON.stringify(chainShape(right));
}

function sameTracks(left: readonly TrackRow[], right: readonly TrackRow[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameSelection(left: Selection | undefined, right: Selection | undefined): boolean {
  return left !== undefined && right !== undefined
    && left.trackIndex === right.trackIndex
    && left.slotIndex === right.slotIndex
    && left.mixerTrackIndex === right.mixerTrackIndex;
}

async function tracks(): Promise<readonly TrackRow[]> {
  return ((await bridge.request('track.list')) as {
    readonly tracks: readonly TrackRow[];
  }).tracks;
}

async function resolveOwned(): Promise<TrackRow | undefined> {
  if (ownedTrackId === undefined) return undefined;
  return (await tracks()).find((row) => row.channelId === ownedTrackId);
}

async function completeChain(target: TrackAddress): Promise<readonly ObservedDevice[]> {
  const bank = await adapter.devices(target);
  if (!bank.devicesComplete || bank.bankSize === undefined) {
    throw new Error('the complete scratch device chain is not visible');
  }
  if (!bank.devices.every((item, index) => item.index === index)) {
    throw new Error('the scratch device chain did not report contiguous positions');
  }
  return chainShape(bank.devices);
}

async function readEnabled(target: ReturnType<typeof device>): Promise<boolean> {
  const address = deviceEnabled(target);
  const snapshot = await adapter.read([address]);
  const entry = snapshot.entries[addressKey(address)];
  if (entry?.value.of !== 'deviceEnabled') {
    throw new Error(`enabled state is unavailable at ${addressKey(address)}`);
  }
  return entry.value.enabled;
}

async function readParameter(address: ParamAddress): Promise<number | undefined> {
  const snapshot = await adapter.read([address]);
  const entry = snapshot.entries[addressKey(address)];
  return entry?.value.of === 'param' ? entry.value.param.value : undefined;
}

async function createOwnedTrack(): Promise<TrackAddress> {
  const before = await tracks();
  await bridge.request('track.create', { position: before.length });
  const created = await pollUntil(async () => (await tracks()).length === before.length + 1, 5000, 100);
  if (!created.ok) throw new Error('the owned scratch track did not appear');
  const known = new Set(before.map((row) => row.channelId));
  const fresh = (await tracks()).filter((row) => !known.has(row.channelId));
  if (fresh.length !== 1) throw new Error(`expected one fresh track identity, found ${fresh.length}`);
  ownedTrackId = fresh[0]!.channelId;
  await bridge.request('track.setName', { trackIndex: fresh[0]!.index, name: TRACK_NAME });
  const renamed = await pollUntil(async () => (await resolveOwned())?.name === TRACK_NAME, 5000, 100);
  if (!renamed.ok) throw new Error('the owned scratch track name did not settle');
  const target = track(ownedTrackId);
  const initial = await completeChain(target);
  if (initial.length !== 0) throw new Error(`the owned scratch chain was not empty: ${JSON.stringify(initial)}`);
  return target;
}

async function insertFixtureDevice(
  target: TrackAddress,
  uuid: string,
  expectedName: string,
  expectedIndex: number,
): Promise<void> {
  const receipt = await adapter.apply({
    ops: [{ op: 'device.insert', track: target, source: { from: 'bitwig', uuid } }],
  });
  const minted = receipt.minted[0];
  if (!fullyApplied(receipt) || minted?.kind !== 'device' || minted.chainIndex !== expectedIndex) {
    throw new Error(`fixture ${expectedName} did not mint at ${expectedIndex}: ${JSON.stringify(failures(receipt))}`);
  }
  const chain = await completeChain(target);
  if (chain[expectedIndex]?.name !== expectedName) {
    throw new Error(`fixture position ${expectedIndex} was ${chain[expectedIndex]?.name ?? 'empty'}, expected ${expectedName}`);
  }
}

async function deleteExact(target: TrackAddress, index: number, expectedName: string): Promise<void> {
  const receipt = await adapter.apply({
    ops: [{ op: 'device.delete', device: device(target, index), expectedName }],
  });
  if (!fullyApplied(receipt)) {
    throw new Error(`device ${index}:${expectedName} did not delete: ${JSON.stringify(failures(receipt))}`);
  }
}

async function seedEntry(target: TrackAddress): Promise<readonly ObservedDevice[]> {
  await insertFixtureDevice(target, TOOL, 'Tool', 0);
  await insertFixtureDevice(target, DELAY_PLUS, 'Delay+', 1);
  const chain = await completeChain(target);
  if (chain.map((item) => item.name).join('|') !== 'Tool|Delay+') {
    throw new Error(`the entry fixture was ${JSON.stringify(chainShape(chain))}`);
  }
  return chain;
}

async function proveIncompleteBankRefusal(
  target: TrackAddress,
  expected: readonly ObservedDevice[],
): Promise<void> {
  let applyCalls = 0;
  const incomplete: ManagedFxChainHost = {
    async devices(trackRef) {
      return { ...(await host.devices(trackRef)), devicesComplete: false };
    },
    read: (addresses) => host.read(addresses),
    async apply(ops, options) {
      applyCalls++;
      return host.apply(ops, options);
    },
  };
  let caught: unknown;
  try {
    await buildManagedFxChain(incomplete, {
      track: target,
      devices: [{ token: 'never-written', source: { from: 'bitwig', uuid: POLYSYNTH } }],
    });
  } catch (error) {
    caught = error;
  }
  const after = await completeChain(target);
  const ok = caught instanceof ManagedFxChainError
    && caught.stage === 'preflight'
    && /complete top-level/.test(caught.message)
    && applyCalls === 0
    && sameChain(after, expected);
  check('4g-L3: an incomplete device bank refuses before any write', ok, {
    error: caught === undefined ? undefined : errorText(caught),
    applyCalls,
    chain: chainShape(after),
  });
  if (!ok) throw new Error('the incomplete-bank refusal did not hold');
}

async function recoverConcurrentTail(
  target: TrackAddress,
  expected: readonly ObservedDevice[],
  recovery: ManagedFxChainRecovery,
): Promise<readonly string[]> {
  const chain = await completeChain(target);
  if (!sameChain(chain.slice(0, expected.length), expected)) {
    throw new Error('the concurrent fixture changed an entry device');
  }
  const tail = chain.slice(expected.length).map((item) => item.name);
  if (JSON.stringify(tail) !== JSON.stringify(['EQ+', 'Polysynth'])) {
    throw new Error(`the concurrent fixture has an unknown tail: ${JSON.stringify(tail)}`);
  }
  const owned = recovery.inserted;
  if (owned.length !== 1
    || owned[0]?.token !== 'concurrent-target'
    || owned[0].name !== 'Polysynth'
    || owned[0].current.chainIndex !== expected.length) {
    throw new Error(`the concurrent recovery handle is not exact: ${JSON.stringify(owned)}`);
  }
  const sentinel = chain[expected.length]!;
  if (sentinel.index !== expected.length || sentinel.name !== 'EQ+') {
    throw new Error(`the concurrent EQ+ sentinel moved: ${JSON.stringify(sentinel)}`);
  }
  await deleteExact(target, sentinel.index, 'EQ+');
  const managedState = await completeChain(target);
  if (!sameChain(managedState, recovery.final.devices)) {
    throw new Error('the concurrent recovery boundary did not return after sentinel cleanup');
  }
  const reversal = await reverseManagedFxChain(host, recovery);
  const restored = await completeChain(target);
  if (!sameChain(restored, expected)) {
    throw new Error('the concurrent recovery did not restore the entry chain');
  }
  return reversal.deleted;
}

async function proveConcurrentEditRefusal(
  target: TrackAddress,
  expected: readonly ObservedDevice[],
): Promise<void> {
  competitor = new LiveAdapter();
  await competitor.hello();
  let fired = false;
  let competingApplied = false;
  let competingRelocated = false;
  let guardedTarget: ParamAddress | undefined;
  let shiftedTarget: ParamAddress | undefined;
  let beforeValue: number | undefined;
  const concurrent: ManagedFxChainHost = {
    devices: (trackRef) => host.devices(trackRef),
    read: (addresses) => host.read(addresses),
    async apply(ops: readonly Op[], options) {
      const scalar = ops.find(
        (op): op is Extract<Op, { op: 'param.set' }> => op.op === 'param.set',
      );
      if (!fired && scalar !== undefined) {
        if (scalar.param.device.chain !== undefined
            || scalar.param.device.chainIndex !== expected.length) {
          throw new Error(`the concurrent scalar target was not the appended device: ${addressKey(scalar.param)}`);
        }
        guardedTarget = scalar.param;
        shiftedTarget = {
          ...scalar.param,
          device: device(target, scalar.param.device.chainIndex + 1),
        };
        beforeValue = await readParameter(scalar.param);
        fired = true;
        const competing = await competitor!.apply({
          ops: [{ op: 'device.insert', track: target, source: { from: 'bitwig', uuid: EQ_PLUS } }],
        });
        competingApplied = fullyApplied(competing);
        if (!competingApplied) {
          throw new Error(`the competing EQ+ edit failed: ${JSON.stringify(failures(competing))}`);
        }
        const beforeMove = await completeChain(target);
        const beforeMoveEnabled = beforeMove.map((item) => {
          if (item.enabled === undefined) {
            throw new Error(`the competing move did not observe enabled state at ${item.index}`);
          }
          return item.enabled;
        });
        const competingMove = await competitor!.apply({
          ops: [{
            op: 'device.relocate',
            track: target,
            sourceFromEnd: 0,
            expectedName: 'EQ+',
            before: device(target, scalar.param.device.chainIndex),
            expectedChain: beforeMove.map((item) => item.name),
            expectedEnabledChain: beforeMoveEnabled,
          }],
        });
        competingRelocated = fullyApplied(competingMove);
        if (!competingRelocated) {
          throw new Error(`the competing EQ+ relocation failed: ${JSON.stringify(failures(competingMove))}`);
        }
      }
      return host.apply(ops, options);
    },
  };

  let caught: unknown;
  try {
    await buildManagedFxChain(concurrent, {
      track: target,
      devices: [{
        token: 'concurrent-target',
        source: { from: 'bitwig', uuid: POLYSYNTH },
        position: 1,
        parameters: [{ name: 'OSC1 Pulse Width', value: 0.91 }],
      }],
    });
  } catch (error) {
    caught = error;
  }

  const shiftedValue = shiftedTarget === undefined ? undefined : await readParameter(shiftedTarget);
  const changedChain = await completeChain(target);
  const expectedChangedNames = [...expected.map((item) => item.name), 'EQ+', 'Polysynth'];
  const recovery = caught instanceof ManagedFxChainError ? caught.partial : undefined;
  const refused = caught instanceof ManagedFxChainError
    && caught.stage === 'scalar'
    && /(revision guard|top-level device(?: enabled)? chain changed|parameter id is not in the confirmed device inventory)/
      .test(caught.message)
    && recovery?.failedStage === 'scalar'
    && fired
    && competingApplied
    && competingRelocated
    && beforeValue !== undefined
    && shiftedValue !== undefined
    && Math.abs(beforeValue - shiftedValue) <= TOLERANCE
    && JSON.stringify(changedChain.map((item) => item.name)) === JSON.stringify(expectedChangedNames);

  requireCondition(recovery !== undefined, 'the concurrent refusal did not return a recovery handle');
  const recoveryDeleted = await recoverConcurrentTail(target, expected, recovery);
  const restored = await completeChain(target);
  check('4g-L4: a concurrent chain edit rejects the stale scalar target and cleans up',
    refused
      && JSON.stringify(recoveryDeleted) === JSON.stringify(['concurrent-target'])
      && sameChain(restored, expected), {
      error: caught === undefined ? undefined : errorText(caught),
      fired,
      competingApplied,
      competingRelocated,
      guardedTarget,
      shiftedTarget,
      beforeValue,
      shiftedValue,
      changedChain: chainShape(changedChain),
      recoveryDeleted,
      restored: chainShape(restored),
    });
  await competitor.close();
  competitor = undefined;
  if (!refused || !sameChain(restored, expected)) {
    throw new Error('the concurrent-edit refusal did not hold');
  }
}

async function removeEntrySeeds(target: TrackAddress, expected: readonly ObservedDevice[]): Promise<void> {
  const before = await completeChain(target);
  if (!sameChain(before, expected)) {
    throw new Error('fixture cleanup requires the exact entry chain');
  }
  for (const item of [...before].sort((left, right) => right.index - left.index)) {
    await deleteExact(target, item.index, item.name);
  }
  const after = await completeChain(target);
  if (after.length !== 0) throw new Error(`fixture cleanup left ${JSON.stringify(chainShape(after))}`);
  seedsRemoved = true;
}

async function restoreEntrySelection(): Promise<void> {
  const entry = entrySelection;
  if (entry === undefined) return;
  if (entry.mixerTrackIndex !== undefined) {
    await bridge.request('cursor.pin', { cursor: 'fine', pinned: false });
    try {
      await bridge.request('cursor.pinTrack', { cursor: 'fine', pinned: false });
      try {
        await bridge.request('cursor.pointTrack', { cursor: 'fine', trackIndex: entry.mixerTrackIndex });
        if (entry.trackIndex >= 0 && entry.slotIndex >= 0) {
          await bridge.request('slot.select', {
            trackIndex: entry.trackIndex,
            slotIndex: entry.slotIndex,
            mechanism: 'track',
          });
        }
        await wait(150);
      } finally {
        await bridge.request('cursor.pinTrack', { cursor: 'fine', pinned: true });
      }
    } finally {
      await bridge.request('cursor.pin', { cursor: 'fine', pinned: true });
    }
    return;
  }
  if (entry.trackIndex < 0 || entry.slotIndex < 0) return;
  await bridge.request('slot.select', {
    trackIndex: entry.trackIndex,
    slotIndex: entry.slotIndex,
    mechanism: 'track',
  });
  await wait(150);
}

async function cleanup(): Promise<void> {
  try {
    if (competitor !== undefined) {
      await competitor.close().catch(() => undefined);
      competitor = undefined;
    }
    const row = await resolveOwned();
    if (row !== undefined && row.name !== TRACK_NAME) {
      throw new Error(`owned track ${row.channelId} changed name to "${row.name}"; cleanup refused`);
    }
    if (row !== undefined && checkpoint !== undefined && !reversed) {
      try {
        await reverseManagedFxChain(host, checkpoint);
        reversed = true;
      } catch (error) {
        note(`managed reversal during cleanup refused: ${errorText(error)}`);
      }
    }
    if (row !== undefined && entryChain !== undefined && !seedsRemoved) {
      const current = await completeChain(track(row.channelId));
      if (sameChain(current, entryChain)) {
        await removeEntrySeeds(track(row.channelId), entryChain);
      }
    }
    const current = await resolveOwned();
    if (current !== undefined) {
      await bridge.request('track.delete', { trackIndex: current.index });
      const removed = await pollUntil(async () => (await resolveOwned()) === undefined, 5000, 100);
      cleanupTrackRemoved = removed.ok;
    }
  } finally {
    await restoreEntrySelection();
  }
}

try {
  await bridge.connect();
  await adapter.hello();
  const revision = await adapter.revision();
  entryTracks = await tracks();
  entrySelection = await bridge.request('selection.status') as Selection;
  check('4g-L1: the accepted project and extension contract are live',
    revision.project === PROJECT && existsSync(SAMPLER_PRESET), {
      project: revision.project,
      preset: SAMPLER_PRESET,
      tracks: entryTracks.length,
    });
  requireCondition(revision.project === PROJECT, `expected project ${PROJECT}, got ${revision.project}`);
  requireCondition(existsSync(SAMPLER_PRESET), `preset fixture is absent: ${SAMPLER_PRESET}`);

  const owned = await createOwnedTrack();
  entryChain = await seedEntry(owned);
  const delayEnabled = await readEnabled(device(owned, 1));
  check('4g-L2: the owned scratch track has two independently observed entry devices',
    entryChain.length === 2
      && entryChain[0]?.name === 'Tool'
      && entryChain[1]?.name === 'Delay+'
      && entryChain[1]?.enabled === delayEnabled,
    { trackId: owned.channelId, chain: chainShape(entryChain), delayEnabled });

  await proveIncompleteBankRefusal(owned, entryChain);
  await proveConcurrentEditRefusal(owned, entryChain);

  checkpoint = await buildManagedFxChain(host, {
    track: owned,
    devices: [
      {
        token: 'native-polysynth',
        source: { from: 'bitwig', uuid: POLYSYNTH },
        position: 1,
        parameters: [{ name: 'OSC1 Pulse Width', value: 0.61 }],
      },
      {
        token: 'preset-sampler',
        source: { from: 'file', path: SAMPLER_PRESET },
        parameters: [{ directId: 'CONTENTS/TRANSPOSE', value: 0.64 }],
      },
      {
        token: 'zebra3-vst3',
        source: { from: 'vst3', classUid: VST3_CLASS_UID },
        position: 2,
        parameters: [{ directId: 'CONTENTS/PID111', value: 0.62 }],
      },
      {
        token: 'zebra3-clap',
        source: { from: 'clap', id: CLAP_ID },
        position: 3,
        parameters: [{ directId: 'CONTENTS/PID111', value: 0.63 }],
      },
    ],
    existingEnabled: [{
      device: device(owned, 1),
      expectedName: 'Delay+',
      enabled: !delayEnabled,
    }],
  });

  const finalNames = checkpoint.final.devices.map((item) => item.name);
  const mintedPositions = checkpoint.inserted.map((item) => item.minted.chainIndex);
  const currentPositions = checkpoint.inserted.map((item) => item.current.chainIndex);
  check('4g-L5: native, VST3, CLAP, and preset devices reach intended observed positions',
    JSON.stringify(finalNames) === JSON.stringify([
      'Tool', 'Polysynth', 'Zebra3', 'Zebra3', 'Delay+', 'Sampler',
    ])
      && JSON.stringify(mintedPositions) === JSON.stringify([2, 3, 4, 5])
      && JSON.stringify(currentPositions) === JSON.stringify([1, 5, 2, 3]), {
      finalNames,
      inserted: checkpoint.inserted,
    });

  const parameters = checkpoint.scalars.filter((item) => item.kind === 'parameter');
  const parameterTokens = new Set(parameters.map((item) => item.token));
  const expectedTokens = checkpoint.inserted.map((item) => item.token);
  check('4g-L6: every inserted device receives one changed and verified parameter setting',
    parameters.length === expectedTokens.length
      && expectedTokens.every((token) => parameterTokens.has(token))
      && parameters.every((item) => item.took
        && item.readback !== undefined
        && Math.abs(item.readback - item.requested) <= TOLERANCE
        && Math.abs(item.before - item.requested) > TOLERANCE)
      && checkpoint.report.nonTaking.length === 0
      && checkpoint.report.failed.length === 0, {
      parameters: parameters.map((item) => ({
        token: item.token,
        selector: item.selector,
        before: item.before,
        requested: item.requested,
        readback: item.readback,
        took: item.took,
      })),
      nonTaking: checkpoint.report.nonTaking,
      failed: checkpoint.report.failed,
    });

  const enabled = checkpoint.scalars.find(
    (item) => item.kind === 'enabled' && item.owner === 'entry',
  );
  check('4g-L7: entry bypass and checkpoint promises are explicit and exact',
    enabled?.kind === 'enabled'
      && enabled.before === delayEnabled
      && enabled.requested === !delayEnabled
      && enabled.readback === !delayEnabled
      && enabled.took
      && JSON.stringify(checkpoint.report.promises) === JSON.stringify({
        insertedDevice: 'delete-current-observed-owned-position',
        scalar: 'restore-entry-base-or-remove-with-owned-device',
        existingDeviceDelete: 'none',
      }), {
      enabled,
      promises: checkpoint.report.promises,
      warnings: checkpoint.report.warnings,
    });

  const reversal = await reverseManagedFxChain(host, checkpoint);
  reversed = true;
  const independentEntry = await completeChain(owned);
  check('4g-L8: reversal restores scalars and deletes non-contiguous owned positions safely',
    reversal.complete
      && JSON.stringify(reversal.deleted) === JSON.stringify([
        'preset-sampler', 'zebra3-clap', 'zebra3-vst3', 'native-polysynth',
      ])
      && reversal.restoredScalars.length === 1
      && sameChain(reversal.after.devices, entryChain)
      && sameChain(independentEntry, entryChain), {
      deleted: reversal.deleted,
      restoredScalars: reversal.restoredScalars,
      after: chainShape(independentEntry),
    });

  await removeEntrySeeds(owned, entryChain);
  check('4g-L9: fixture cleanup restores the exact empty scratch chain',
    seedsRemoved && (await completeChain(owned)).length === 0);
} catch (error) {
  check('4g-LX: the managed FX-chain proof completed without an unexpected failure', false,
    errorText(error));
} finally {
  try {
    await cleanup();
  } catch (error) {
    check('4g-L9: fixture cleanup restores the exact empty scratch chain', false, errorText(error));
  }
  const finalTracks = await tracks().catch(() => []);
  const finalSelection = await bridge.request('selection.status').catch(() => undefined) as Selection | undefined;
  check('4g-L10: cleanup removes the owned track and restores the accepted baseline',
    ownedTrackId !== undefined
      && cleanupTrackRemoved
      && !finalTracks.some((row) => row.channelId === ownedTrackId)
      && sameTracks(finalTracks, entryTracks)
      && sameSelection(finalSelection, entrySelection), {
      entryTrackCount: entryTracks.length,
      finalTrackCount: finalTracks.length,
      ownedTrackId,
      entrySelection,
      finalSelection,
    });
  await adapter.close();
  bridge.disconnect();
}

note(`Phase 4 session 4g live proof: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
if (failureCount() > 0) process.exitCode = 1;
