/** Focused Phase 5g proof for owned-template composition and exact reversal. */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { listChains, modulatorListOffsets, stubValues } from '../bwmod/index.js';
import { track, type Op, type TrackAddress, type TrackState } from '../contract/index.js';
import {
  Executor, buildOwnedTemplateComposition, type OwnedTemplateCompositionHost,
} from '../engine/index.js';
import { check, failureCount, note } from './lib.js';

const TRACK_NAME = 'gn-p5g-owned-composition';
const adapter = new LiveAdapter();
const executor = new Executor(adapter);
let ownedTrack: TrackAddress | undefined;
let entryTracks: readonly TrackState[] = [];

const entries = [
  {
    deviceName: 'Polysynth',
    modulators: [{
      kind: 'add' as const,
      modulator: 'lfo' as const,
      target: 'polysynth-filter-frequency' as const,
      amount: 1,
    }],
  },
  {
    deviceName: 'Sampler',
    modulators: [{
      kind: 'add' as const,
      modulator: 'lfo' as const,
      target: 'sampler-amp-attack' as const,
      amount: 1,
    }],
  },
] as const;

function sameTracks(left: readonly TrackState[], right: readonly TrackState[]): boolean {
  return JSON.stringify(left.map((item) => [item.channelId, item.name, item.position, item.type]))
    === JSON.stringify(right.map((item) => [item.channelId, item.name, item.position, item.type]));
}

function insertedOnce(ops: readonly Op[]): boolean {
  return ops.length === 1 && ops[0]?.op === 'device.insert';
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

  const calls: Op[][] = [];
  const host: OwnedTemplateCompositionHost = {
    read: (addresses) => adapter.read(addresses),
    async apply(ops, options) {
      calls.push([...ops]);
      return { take: await executor.run(ops, options) };
    },
  };
  let validated: Buffer | undefined;
  const result = await buildOwnedTemplateComposition(host, {
    track: ownedTrack,
    entries,
    expectedChain: [],
    expectedEnabledChain: [],
  }, {
    onValidated(preset) { validated = preset; },
  });

  check('5g-L1: the executor records one structural insertion',
    calls.length === 1 && insertedOnce(calls[0]!)
      && result.take.report.applied && result.composition.structural,
    { calls, report: result.take.report, composition: result.composition });
  check('5g-L2: the validated preset keeps two entries and three exact modulator lists',
    validated !== undefined
      && listChains(validated).length === 2
      && modulatorListOffsets(validated).length === 3,
    validated === undefined ? { validated: false } : {
      chains: listChains(validated),
      listCount: modulatorListOffsets(validated).length,
    });
  check('5g-L3: the composed Sampler is sample-less',
    validated !== undefined && stubValues(validated).length === 0,
    { referenceStubs: validated === undefined ? 'no preset' : stubValues(validated) });
  check('5g-L4: complete live structure matches the request in exact order',
    result.verification.structure.verified
      && result.verification.structure.containerName === 'Instrument Layer'
      && JSON.stringify(result.verification.structure.entries.map((entry) => entry.deviceNames))
        === JSON.stringify([['Polysynth'], ['Sampler']]),
    result.verification.structure);
  check('5g-L5: every requested modulator page is present exactly once',
    result.verification.witnesses.length === 2
      && result.verification.witnesses.every((witness) => witness.pages.verified),
    result.verification.witnesses.map((witness) => ({
      page: witness.request.modulatorPage,
      pages: witness.pages,
    })));
  check('5g-L6: both exact active routes have stable unautomated bases and positive divergence',
    result.verification.verified
      && result.verification.witnesses.every((witness) =>
        witness.behavior?.verified === true
        && witness.behavior.maximumDivergence > 0
        && witness.behavior.baseSpread <= 2e-3
        && witness.behavior.samples.every((sample) => sample.hasAutomation === false)),
    result.verification.witnesses.map((witness) => witness.behavior));

  const reversed = await executor.revertUnchecked(result.take);
  const afterReverse = await adapter.devices(ownedTrack);
  check('5g-L7: reversal removes the observed container with no unrestored state',
    reversed.unrestored.length === 0
      && afterReverse.devicesComplete
      && afterReverse.devices.length === 0,
    { reversed, afterReverse });
} catch (error) {
  check('5g-LX: the focused live proof completed without an unexpected failure', false,
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
      check('5g-cleanup: owned content was removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('5g-cleanup: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks,
      final: finalTracks,
    });
  } catch (error) {
    check('5g-cleanup: the exact entry track list is restored', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
}

console.log(failureCount() === 0 ? '\nPhase 5g: ALL PASS' : `\nPhase 5g: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
