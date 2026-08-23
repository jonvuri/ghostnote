/**
 * Phase 5d live proof for explicit container-list cross-device routing.
 *
 * The probe retargets the outer Chain LFO to the nested Polysynth filter. It
 * verifies the outer LFO page and the exact nested remote control. It then
 * reverses the take and restores the exact entry track list.
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { track, type Op, type TrackAddress, type TrackState } from '../contract/index.js';
import {
  Executor, authorModulatorEdit, type ModulatorAuthoringHost,
} from '../engine/index.js';
import { check, failureCount, note } from './lib.js';

const TRACK_NAME = 'gn-p5d-container-routing-proof';
const TEMPLATE = join(
  homedir(),
  'Documents',
  'Bitwig Studio',
  'Library',
  'Presets',
  'Chain',
  'gn_crossdev_outer.bwpreset',
);
const TARGET = 'CONTENTS/DEVICE_CHAIN/Chain/DEVICE_CHAIN/0:CONTENTS/F1FREQ';

const adapter = new LiveAdapter();
let ownedTrack: TrackAddress | undefined;
let entryTracks: readonly TrackState[] = [];

function sameTracks(left: readonly TrackState[], right: readonly TrackState[]): boolean {
  return JSON.stringify(left.map((item) => [item.channelId, item.name, item.position, item.type]))
    === JSON.stringify(right.map((item) => [item.channelId, item.name, item.position, item.type]));
}

try {
  if (!existsSync(TEMPLATE)) throw new Error(`the human-saved E11e template is absent: ${TEMPLATE}`);
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
  const result = await authorModulatorEdit(host, {
    track: ownedTrack,
    templatePath: TEMPLATE,
    listIndex: 0,
    edit: { kind: 'retarget', index: 0, target: TARGET },
    pageWitnesses: [{ pageName: 'LFO', expectedCount: 1 }],
    behaviorWitnesses: [{
      expected: 'active',
      pageName: 'FILTER',
      controlName: 'Filt Freq',
      nestedDevice: { slotName: 'CHAIN', chainIndex: 0 },
      samples: 10,
      sampleIntervalMs: 80,
      inventoryAttempts: 10,
      inventoryRetryMs: 300,
      minimumDivergence: 1e-3,
    }],
    expectedChain: [],
    expectedEnabledChain: [],
  });

  check('5d-L1: list 0 was selected and only its outer LFO route changed',
    result.edit.listIndex === 0
      && result.edit.modulatorsBefore.length === 1
      && result.edit.modulatorsBefore[0]?.routing?.target
        === 'CONTENTS/DEVICE_CHAIN/Chain/DEVICE_CHAIN/1:CONTENTS/MIX'
      && result.edit.modulatorsAfter[0]?.routing?.target === TARGET,
    result.edit);
  check('5d-L2: the checkpoint applied with one structural device mint',
    result.take.report.applied
      && result.minted?.kind === 'device'
      && result.edit.structural
      && result.edit.restoreFidelity === 'exact',
    { report: result.take.report, minted: result.minted, edit: result.edit });
  check('5d-L3: the outer LFO page and nested filter behavior both pass',
    result.verification.verified,
    result.verification);
  const behavior = result.verification.behaviors[0];
  if (behavior?.selector !== undefined) {
    note(`nested selector ${behavior.selector.pageIndex}:${JSON.stringify(behavior.selector.pageName)}`
      + `/${behavior.selector.controlIndex}:${JSON.stringify(behavior.selector.controlName)}`
      + ` divergence=${behavior.maximumDivergence.toFixed(6)}`
      + ` baseSpread=${behavior.baseSpread.toFixed(6)}`);
  }

  const reversal = await executor.revertUnchecked(result.take);
  const afterReversal = await adapter.devices(ownedTrack);
  check('5d-L4: reversal restores the empty owned track',
    reversal.unrestored.length === 0
      && afterReversal.devicesComplete
      && afterReversal.devices.length === 0,
    { unrestored: reversal.unrestored, devices: afterReversal });
} catch (error) {
  check('5d-LX: the focused live proof completed without an unexpected failure', false,
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
      check('5d-cleanup: owned-state cleanup completed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('5d-cleanup: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks,
      final: finalTracks,
    });
  } catch (error) {
    check('5d-cleanup: the exact entry track list is restored', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
}

console.log(failureCount() === 0 ? '\nPhase 5d: ALL PASS' : `\nPhase 5d: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
