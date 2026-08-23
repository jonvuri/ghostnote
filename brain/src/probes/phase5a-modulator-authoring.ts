/**
 * Phase 5a live proof: one checkpointed `bwmod` add and exact remote witness.
 *
 * The probe creates one owned instrument track. It loads a routed Polysynth,
 * samples the returned `Filt Freq` selector, reverses the device take, and then
 * deletes the owned track. The final track list must equal the entry list.
 */
import { join } from 'node:path';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { track, type Op, type TrackAddress, type TrackState } from '../contract/index.js';
import { FIXTURE_DIR } from '../bwmod/fixtures.js';
import {
  Executor, authorModulatorAdd, type ModulatorAuthoringHost,
} from '../engine/index.js';
import { check, failureCount, note } from './lib.js';

const TRACK_NAME = 'gn-p5a-modulator-proof';

const adapter = new LiveAdapter();
let ownedTrack: TrackAddress | undefined;
let result: Awaited<ReturnType<typeof authorModulatorAdd>> | undefined;
let reversed = false;
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
  result = await authorModulatorAdd(host, {
    track: ownedTrack,
    templatePath: join(FIXTURE_DIR, 'Polysynth', 'mp_bare.bwpreset'),
    donorId: 'lfo-sampler',
    routing: { target: 'CONTENTS/F1FREQ', amount: 1 },
    witness: {
      pageName: 'FILTER',
      controlName: 'Filt Freq',
      samples: 10,
      sampleIntervalMs: 80,
      minimumDivergence: 1e-3,
    },
    expectedChain: [],
    expectedEnabledChain: [],
  });

  check('5a-L1: the executor checkpoint applied and observed one device mint',
    result.take.report.applied && result.minted?.kind === 'device', {
      report: result.take.report,
      minted: result.minted,
    });
  check('5a-L2: the take records a structural preset insert with exact absence restore',
    result.edit.structural && result.edit.restoreFidelity === 'exact', result.edit);
  check('5a-L3: one exact remote selector proves live modulation',
    result.verification.verified, result.verification);
  if (result.verification.selector !== undefined) {
    note(`selector page=${result.verification.selector.pageIndex} `
      + `${JSON.stringify(result.verification.selector.pageName)} control=`
      + `${result.verification.selector.controlIndex} `
      + `${JSON.stringify(result.verification.selector.controlName)}`);
    note(`maximum divergence=${result.verification.maximumDivergence.toFixed(6)} `
      + `base spread=${result.verification.baseSpread.toFixed(6)}`);
  }

  const reversal = await executor.revertUnchecked(result.take);
  reversed = true;
  const afterReversal = await adapter.devices(ownedTrack);
  check('5a-L4: reversal deletes the observed device and reports no unrestored state',
    reversal.unrestored.length === 0
      && afterReversal.devicesComplete
      && afterReversal.devices.length === 0,
    { unrestored: reversal.unrestored, devices: afterReversal });
} catch (error) {
  check('5a-LX: the focused live proof completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (!reversed && result?.minted !== undefined && ownedTrack !== undefined) {
    try {
      await adapter.apply({ ops: [{ op: 'device.delete', device: result.minted }] });
      await adapter.settle('trackStruct');
    } catch (error) {
      check('5a-L4: fallback device cleanup completed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  if (ownedTrack !== undefined) {
    try {
      await adapter.apply({ ops: [{ op: 'track.delete', track: ownedTrack }] });
      await adapter.settle('trackStruct');
    } catch (error) {
      check('5a-L5: owned track cleanup completed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('5a-L5: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks,
      final: finalTracks,
    });
  } catch (error) {
    check('5a-L5: the exact entry track list is restored', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
}

console.log(failureCount() === 0 ? '\nPhase 5a: ALL PASS' : `\nPhase 5a: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
