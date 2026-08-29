/** Phase 5m sampled-preset footprint checks for newly routed zoo donors. */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { addModulator, extractModulator, stubValues, validate } from '../bwmod/index.js';
import { fixture } from '../bwmod/fixtures.js';
import { track, type TrackAddress, type TrackState } from '../contract/index.js';
import { check, failureCount, note } from './lib.js';

const TRACK_NAME = 'gn-p5m-zoo-footprints';
const BASE = fixture('Sampler/gn_sampler_bare');
const TIER_ONE_BASE = fixture('Polysynth/mp_bare');
const ZOO = fixture('Polysynth/gn-preset-zoo');
const OUT = mkdtempSync(join(tmpdir(), 'gn-p5m-footprints-'));
const measurements = [
  { index: 10, name: 'Classic LFO', predicted: 0x0e },
  { index: 13, name: 'Expressions', predicted: 0x13 },
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

  for (const measurement of measurements) {
    const extracted = extractModulator(ZOO, measurement.index);
    const outcomes: { candidate: number; loaded: boolean }[] = [];
    for (const candidate of [measurement.predicted - 1, measurement.predicted, measurement.predicted + 1]) {
      const donor = { ...extracted, footprint: candidate };
      const edited = addModulator(BASE, donor, { target: 'CONTENTS/AMP_ATTACK_TIME', amount: 0.5 });
      const validation = validate(edited, { reference: BASE, stubDelta: candidate });
      check(`${measurement.name} delta 0x${candidate.toString(16)} passes the offline gate`, validation.ok, validation);
      check(`${measurement.name} relocates every sampled reference`,
        stubValues(edited).every((value, index) => value === stubValues(BASE)[index]! + candidate),
        { before: stubValues(BASE), after: stubValues(edited) });

      const path = join(OUT, `${measurement.index}-${candidate}.bwpreset`);
      writeFileSync(path, edited);
      const receipt = await adapter.apply({ ops: [{
        op: 'device.insert', track: ownedTrack, source: { from: 'file', path },
        expectedChain: [], expectedEnabledChain: [],
      }] });
      await adapter.settle('insertFile');
      const devices = await adapter.devices(ownedTrack);
      const loaded = devices.devicesComplete && devices.devices.length === 1;
      outcomes.push({ candidate, loaded });
      note(`${measurement.name} delta=0x${candidate.toString(16)}: ${loaded ? 'LOAD' : 'REJECT'}`);
      if (loaded) {
        await adapter.apply({ ops: [{
          op: 'device.delete',
          device: { kind: 'device', track: ownedTrack, chainIndex: devices.devices[0]!.index },
        }] });
        await adapter.settle('insertFile');
      } else {
        check(`${measurement.name} rejected insert reports no minted device`, receipt.minted[0] === undefined, receipt);
      }
    }
    if (measurement.name === 'Expressions') {
      check('Expressions keeps its Tier-1-only standing across the bounded bracket',
        outcomes.every((item) => !item.loaded), outcomes);
    } else {
      check(`${measurement.name} footprint is exactly 0x${measurement.predicted.toString(16)}`,
        outcomes.filter((item) => item.loaded).length === 1
          && outcomes.find((item) => item.loaded)?.candidate === measurement.predicted,
        outcomes);
    }
  }

  const wavetable = extractModulator(ZOO, 41);
  const incomplete = addModulator(
    TIER_ONE_BASE,
    { ...wavetable, footprint: 0 },
    { target: 'CONTENTS/F1FREQ', amount: 0.5 },
  );
  const incompletePath = join(OUT, 'wavetable-raw-object.bwpreset');
  writeFileSync(incompletePath, incomplete);
  const wavetableReceipt = await adapter.apply({ ops: [{
    op: 'device.insert', track: ownedTrack, source: { from: 'file', path: incompletePath },
    expectedChain: [], expectedEnabledChain: [],
  }] });
  await adapter.settle('insertFile');
  const wavetableDevices = await adapter.devices(ownedTrack);
  check('Wavetable LFO raw object transplant rejects without its companion state',
    wavetableReceipt.minted[0] === undefined
      && wavetableDevices.devicesComplete
      && wavetableDevices.devices.length === 0,
    { wavetableReceipt, wavetableDevices });
} catch (error) {
  check('5m-footprint-LX: the live check completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (ownedTrack !== undefined) {
    try {
      const devices = await adapter.devices(ownedTrack);
      for (const item of [...devices.devices].reverse()) {
        await adapter.apply({ ops: [{
          op: 'device.delete', device: { kind: 'device', track: ownedTrack, chainIndex: item.index },
        }] });
        await adapter.settle('insertFile');
      }
      await adapter.apply({ ops: [{ op: 'track.delete', track: ownedTrack }] });
      await adapter.settle('trackStruct');
    } catch (error) {
      check('5m-footprint-cleanup: owned-state cleanup completed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('5m-footprint-cleanup: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks, final: finalTracks,
    });
  } catch (error) {
    check('5m-footprint-cleanup: the exact entry track list is restored', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
}

console.log(failureCount() === 0 ? '\nPhase 5m footprints: ALL PASS' : `\nPhase 5m footprints: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
