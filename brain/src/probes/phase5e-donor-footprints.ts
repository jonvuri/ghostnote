/** Phase 5e live footprint triangulation for the sampled-preset donor cohort. */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { track, type TrackAddress, type TrackState } from '../contract/index.js';
import { addModulator, loadDonor, stubValues, validate } from '../bwmod/index.js';
import { fixture } from '../bwmod/fixtures.js';
import { check, failureCount, note } from './lib.js';

const TRACK_NAME = 'gn-p5e-footprint-proof';
const BASE = fixture('Sampler/gn_sampler_bare');
const OUT = mkdtempSync(join(tmpdir(), 'gn-p5e-'));

const measurements = [
  { donorId: 'classiclfo-poly', predicted: 0x0c },
  { donorId: 'vibrato-poly', predicted: 0x0f },
] as const;

function sameTracks(left: readonly TrackState[], right: readonly TrackState[]): boolean {
  return JSON.stringify(left.map((item) => [item.channelId, item.name, item.position, item.type]))
    === JSON.stringify(right.map((item) => [item.channelId, item.name, item.position, item.type]));
}

const adapter = new LiveAdapter();
let ownedTrack: TrackAddress | undefined;
let entryTracks: readonly TrackState[] = [];

try {
  const hello = await adapter.hello();
  note(`Bitwig ${hello.host?.version ?? 'unknown'}; contract ${hello.contractVersion}`);
  entryTracks = await adapter.tracks();

  const created = await adapter.apply({ ops: [{ op: 'track.create', name: TRACK_NAME }] });
  await adapter.settle('trackStruct');
  const mint = created.minted[0];
  if (mint?.kind !== 'track') throw new Error('the owned track returned no durable id');
  ownedTrack = track(mint.channelId);

  const beforeStubs = stubValues(BASE);
  for (const measurement of measurements) {
    const donor = loadDonor(measurement.donorId);
    const outcomes: { candidate: number; loaded: boolean }[] = [];
    const candidates = [measurement.predicted - 1, measurement.predicted, measurement.predicted + 1];
    for (const candidate of candidates) {
      const edited = addModulator(BASE, { ...donor, footprint: candidate });
      const afterStubs = stubValues(edited);
      const validation = validate(edited, { reference: BASE, stubDelta: candidate });
      check(`${measurement.donorId} delta 0x${candidate.toString(16)} passes the offline gate`,
        validation.ok
          && afterStubs.every((value, index) => value === beforeStubs[index]! + candidate),
        { problems: validation.problems, beforeStubs, afterStubs });

      const path = join(OUT, `${measurement.donorId}-${candidate.toString(16)}.bwpreset`);
      writeFileSync(path, edited);
      const receipt = await adapter.apply({ ops: [{
        op: 'device.insert', track: ownedTrack, source: { from: 'file', path },
        expectedChain: [], expectedEnabledChain: [],
      }] });
      await adapter.settle('insertFile');
      const devices = await adapter.devices(ownedTrack);
      const loaded = devices.devicesComplete && devices.devices.length === 1;
      outcomes.push({ candidate, loaded });
      note(`${measurement.donorId} delta=0x${candidate.toString(16)}: ${loaded ? 'LOAD' : 'REJECT'}`);

      if (loaded) {
        await adapter.apply({ ops: [{
          op: 'device.delete',
          device: { kind: 'device', track: ownedTrack, chainIndex: devices.devices[0]!.index },
        }] });
        await adapter.settle('insertFile');
      } else {
        check(`${measurement.donorId} rejected insert reports no minted device`,
          receipt.minted[0] === undefined, receipt);
      }
    }
    check(`${measurement.donorId} footprint is exactly 0x${measurement.predicted.toString(16)}`,
      outcomes.filter((item) => item.loaded).length === 1
        && outcomes.find((item) => item.loaded)?.candidate === measurement.predicted,
      outcomes);
  }
} catch (error) {
  check('5e-LX: footprint triangulation completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (ownedTrack !== undefined) {
    try {
      const devices = await adapter.devices(ownedTrack);
      for (const item of [...devices.devices].reverse()) {
        await adapter.apply({ ops: [{
          op: 'device.delete',
          device: { kind: 'device', track: ownedTrack, chainIndex: item.index },
        }] });
        await adapter.settle('insertFile');
      }
      await adapter.apply({ ops: [{ op: 'track.delete', track: ownedTrack }] });
      await adapter.settle('trackStruct');
    } catch (error) {
      check('5e-cleanup: owned-state cleanup completed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('5e-cleanup: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks,
      final: finalTracks,
    });
  } catch (error) {
    check('5e-cleanup: the exact entry track list is restored', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
}

console.log(failureCount() === 0 ? '\nPhase 5e: ALL PASS' : `\nPhase 5e: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
