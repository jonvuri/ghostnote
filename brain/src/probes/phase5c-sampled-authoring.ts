/**
 * Phase 5c live proof for checkpointed sampled-preset authoring.
 *
 * The probe adds and deletes one LFO on multisample Sampler presets. Each edit
 * moves all four sample reference stubs by the measured LFO footprint. The
 * probe verifies live behavior, reverses both takes, and removes its track.
 */
import { join } from 'node:path';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { track, type Op, type TrackAddress, type TrackState } from '../contract/index.js';
import { FIXTURE_DIR } from '../bwmod/fixtures.js';
import {
  Executor, authorModulatorAdd, authorModulatorEdit, type ModulatorAuthoringHost,
} from '../engine/index.js';
import { check, failureCount, note } from './lib.js';

const TRACK_NAME = 'gn-p5c-sampled-proof';
const BARE = join(FIXTURE_DIR, 'Sampler', 'gn_sampler_multi_bare.bwpreset');
const ONE_LFO = join(FIXTURE_DIR, 'Sampler', 'gn_sampler_multi_one_lfo.bwpreset');

const adapter = new LiveAdapter();
let ownedTrack: TrackAddress | undefined;
let entryTracks: readonly TrackState[] = [];

function sameTracks(left: readonly TrackState[], right: readonly TrackState[]): boolean {
  return JSON.stringify(left.map((item) => [item.channelId, item.name, item.position, item.type]))
    === JSON.stringify(right.map((item) => [item.channelId, item.name, item.position, item.type]));
}

try {
  const hello = await adapter.hello();
  note(`Bitwig ${hello.host?.version ?? 'unknown'}; contract ${hello.contractVersion}`);
  entryTracks = await adapter.tracks();

  const created = await adapter.apply({ ops: [{ op: 'track.create', name: TRACK_NAME }] });
  await adapter.settle('trackStruct');
  const mint = created.minted[0];
  if (mint?.kind !== 'track') throw new Error('the owned track returned no durable id');
  ownedTrack = track(mint.channelId);

  const executor = new Executor(adapter);
  const host: ModulatorAuthoringHost = {
    read: (addresses) => adapter.read(addresses),
    async apply(ops: readonly Op[], options) {
      return { take: await executor.run(ops, options) };
    },
  };

  const added = await authorModulatorAdd(host, {
    track: ownedTrack,
    templatePath: BARE,
    donorId: 'lfo-sampler',
    routing: { target: 'CONTENTS/AMP_ATTACK_TIME', amount: 1 },
    witness: {
      parameterId: 'CONTENTS/AMP_ATTACK_TIME', parameterName: 'Amp Attack', samples: 10,
      sampleIntervalMs: 80, minimumDivergence: 1e-3,
    },
    expectedChain: [],
    expectedEnabledChain: [],
  });
  check('5c-add: the checkpoint and exact active witness pass',
    added.take.report.applied && added.minted?.kind === 'device' && added.verification.verified,
    { report: added.take.report, minted: added.minted, verification: added.verification });
  const addRelocation = added.edit.stubRelocation;
  check('5c-add: all four stubs moved by the measured inserted footprint',
    addRelocation?.stubCount === 4
      && addRelocation.insertedFootprint === 0x10
      && addRelocation.removedFootprint === 0
      && addRelocation.delta === 0x10
      && addRelocation.after.every(
        (value, index) => value === addRelocation.before[index]! + 0x10,
      ), addRelocation);
  if (added.verification.selector !== undefined) {
    note(`add ${JSON.stringify(added.verification.selector.directId)}`
      + ` divergence=${added.verification.maximumDivergence.toFixed(6)}`
      + ` baseSpread=${added.verification.baseSpread.toFixed(6)}`);
  }
  const addReversal = await executor.revertUnchecked(added.take);
  const afterAddReversal = await adapter.devices(ownedTrack);
  check('5c-add: reversal restores the empty owned track',
    addReversal.unrestored.length === 0
      && afterAddReversal.devicesComplete
      && afterAddReversal.devices.length === 0,
    { unrestored: addReversal.unrestored, devices: afterAddReversal });

  const deleted = await authorModulatorEdit(host, {
    track: ownedTrack,
    templatePath: ONE_LFO,
    edit: { kind: 'delete', index: 0, removedFootprint: 0x10 },
    pageWitnesses: [{ pageName: 'LFO', expectedCount: 0 }],
    behaviorWitnesses: [{
      expected: 'inactive', parameterId: 'CONTENTS/AMP_ATTACK_TIME', parameterName: 'Amp Attack', samples: 10,
      sampleIntervalMs: 80, minimumDivergence: 1e-3,
    }],
    expectedChain: [],
    expectedEnabledChain: [],
  });
  check('5c-delete: the checkpoint and exact inactive witnesses pass',
    deleted.take.report.applied && deleted.minted?.kind === 'device'
      && deleted.verification.verified,
    { report: deleted.take.report, minted: deleted.minted, verification: deleted.verification });
  const deleteRelocation = deleted.edit.stubRelocation;
  check('5c-delete: all four stubs moved by the measured removed footprint',
    deleteRelocation?.stubCount === 4
      && deleteRelocation.insertedFootprint === 0
      && deleteRelocation.removedFootprint === 0x10
      && deleteRelocation.delta === -0x10
      && deleteRelocation.after.every(
        (value, index) => value === deleteRelocation.before[index]! - 0x10,
      ), deleteRelocation);
  for (const behavior of deleted.verification.behaviors) {
    if (behavior.selector !== undefined) {
      note(`delete ${JSON.stringify(behavior.selector.directId)}`
        + ` divergence=${behavior.maximumDivergence.toFixed(6)}`
        + ` baseSpread=${behavior.baseSpread.toFixed(6)}`);
    }
  }
  const deleteReversal = await executor.revertUnchecked(deleted.take);
  const afterReversal = await adapter.devices(ownedTrack);
  check('5c-delete: reversal restores the empty owned track',
    deleteReversal.unrestored.length === 0
      && afterReversal.devicesComplete
      && afterReversal.devices.length === 0,
    { unrestored: deleteReversal.unrestored, devices: afterReversal });
} catch (error) {
  check('5c-LX: the focused live proof completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (ownedTrack !== undefined) {
    try {
      const devices = await adapter.devices(ownedTrack);
      for (const device of [...devices.devices].reverse()) {
        await adapter.apply({ ops: [{
          op: 'device.delete',
          device: { kind: 'device', track: ownedTrack, chainIndex: device.index },
        }] });
        await adapter.settle('trackStruct');
      }
      await adapter.apply({ ops: [{ op: 'track.delete', track: ownedTrack }] });
      await adapter.settle('trackStruct');
    } catch (error) {
      check('5c-cleanup: owned-state cleanup completed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('5c-cleanup: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks,
      final: finalTracks,
    });
  } catch (error) {
    check('5c-cleanup: the exact entry track list is restored', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
}

console.log(failureCount() === 0 ? '\nPhase 5c: ALL PASS' : `\nPhase 5c: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
