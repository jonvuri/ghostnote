/**
 * Phase 5b live proof for checkpointed Tier-1 topology editors.
 *
 * The probe creates one owned track. It applies and reverses replace, retarget,
 * and delete in sequence. It then removes the track and compares the exact
 * entry track list.
 */
import { join } from 'node:path';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { track, type Op, type TrackAddress, type TrackState } from '../contract/index.js';
import { FIXTURE_DIR } from '../bwmod/fixtures.js';
import {
  Executor, authorModulatorEdit, type ModulatorAuthoringHost,
  type ModulatorEditRequest,
} from '../engine/index.js';
import { check, failureCount, note } from './lib.js';

const TRACK_NAME = 'gn-p5b-topology-proof';
const TEMPLATE = join(FIXTURE_DIR, 'Polysynth', 'modtest.bwpreset');

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
  const baseRequest = {
    track: ownedTrack,
    templatePath: TEMPLATE,
    expectedChain: [],
    expectedEnabledChain: [],
  } as const;

  const cases: readonly {
    readonly key: string;
    readonly request: ModulatorEditRequest;
  }[] = [
    {
      key: 'replace',
      request: {
        ...baseRequest,
        edit: { kind: 'replace', index: 0, donorId: 'classiclfo-poly' },
        pageWitnesses: [
          { pageName: 'Classic LFO', expectedCount: 1 },
          { pageName: 'Vibrato', expectedCount: 0 },
        ],
      },
    },
    {
      key: 'retarget',
      request: {
        ...baseRequest,
        edit: { kind: 'retarget', index: 2, target: 'CONTENTS/F1RESO' },
        behaviorWitnesses: [
          {
            expected: 'inactive', parameterId: 'CONTENTS/F1FREQ', parameterName: 'Filter Frequency',
            samples: 10, sampleIntervalMs: 80, minimumDivergence: 1e-3,
          },
          {
            expected: 'active', parameterId: 'CONTENTS/F1RESO', parameterName: 'Filter Resonance',
            samples: 10, sampleIntervalMs: 80, minimumDivergence: 1e-3,
          },
        ],
      },
    },
    {
      key: 'delete',
      request: {
        ...baseRequest,
        edit: { kind: 'delete', index: 2 },
        pageWitnesses: [
          { pageName: 'LFO', expectedCount: 0 },
          { pageName: 'Vibrato', expectedCount: 1 },
        ],
        behaviorWitnesses: [{
          expected: 'inactive', parameterId: 'CONTENTS/F1FREQ', parameterName: 'Filter Frequency',
          samples: 10, sampleIntervalMs: 80, minimumDivergence: 1e-3,
        }],
      },
    },
  ];

  for (const item of cases) {
    const result = await authorModulatorEdit(host, item.request);
    check(`5b-${item.key}: the checkpoint applied with one observed device mint`,
      result.take.report.applied && result.minted?.kind === 'device', {
        report: result.take.report,
        minted: result.minted,
      });
    check(`5b-${item.key}: the structural report and live proof pass`,
      result.edit.structural && result.verification.verified, {
        edit: result.edit,
        verification: result.verification,
      });
    for (const behavior of result.verification.behaviors) {
      if (behavior.selector !== undefined) {
        note(`${item.key}: ${JSON.stringify(behavior.selector.directId)}`
          + ` divergence=${behavior.maximumDivergence.toFixed(6)}`
          + ` baseSpread=${behavior.baseSpread.toFixed(6)}`);
      }
    }

    const reversal = await executor.revertUnchecked(result.take);
    const afterReversal = await adapter.devices(ownedTrack);
    check(`5b-${item.key}: reversal restores the empty owned track`,
      reversal.unrestored.length === 0
        && afterReversal.devicesComplete
        && afterReversal.devices.length === 0,
      { unrestored: reversal.unrestored, devices: afterReversal });
  }
} catch (error) {
  check('5b-LX: the focused live proof completed without an unexpected failure', false,
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
      check('5b-L4: owned-state cleanup completed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('5b-L4: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks,
      final: finalTracks,
    });
  } catch (error) {
    check('5b-L4: the exact entry track list is restored', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
}

console.log(failureCount() === 0 ? '\nPhase 5b: ALL PASS' : `\nPhase 5b: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
