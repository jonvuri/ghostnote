/** Phase 5m live acceptance checks for the operator-authored modulator zoo. */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { addModulator, extractModulator, listModulators, validate } from '../bwmod/index.js';
import { FIXTURE_DIR, fixture } from '../bwmod/fixtures.js';
import { track, type TrackAddress, type TrackState } from '../contract/index.js';
import { check, failureCount, note } from './lib.js';

const TRACK_NAME = 'gn-p5m-preset-zoo-proof';
const PRESET = join(FIXTURE_DIR, 'Polysynth', 'gn-preset-zoo.bwpreset');
const OWNED_PRESET = fixture('Polysynth/gn-preset-zoo');
const BASE = fixture('Polysynth/mp_bare');
const OUT = mkdtempSync(join(tmpdir(), 'gn-p5m-zoo-'));

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

  const inserted = await adapter.apply({ ops: [{
    op: 'device.insert',
    track: ownedTrack,
    source: { from: 'file', path: PRESET },
    expectedChain: [],
    expectedEnabledChain: [],
  }] });
  await adapter.settle('insertFile');
  const devices = await adapter.devices(ownedTrack);
  check('5m-zoo-L1: Bitwig loads the operator-authored preset',
    inserted.minted[0]?.kind === 'device'
      && devices.devicesComplete
      && devices.devices.length === 1
      && devices.devices[0]?.name === 'Polysynth',
    { inserted, devices });

  if (devices.devices[0] !== undefined) {
    await adapter.apply({ ops: [{
      op: 'device.delete',
      device: { kind: 'device', track: ownedTrack, chainIndex: devices.devices[0].index },
    }] });
    await adapter.settle('insertFile');
  }

  const zoo = listModulators(OWNED_PRESET);
  for (const modulator of zoo) {
    if (modulator.deviceName === 'Wavetable LFO') continue;
    const donor = extractModulator(OWNED_PRESET, modulator.index);
    const edited = addModulator(BASE, donor, { target: 'CONTENTS/F1FREQ', amount: 0.5 });
    const validation = validate(edited);
    check(`5m-zoo-${modulator.index}: ${modulator.deviceName} passes the offline gate`, validation.ok, validation);
    const path = join(OUT, `${String(modulator.index).padStart(2, '0')}.bwpreset`);
    writeFileSync(path, edited);
    const receipt = await adapter.apply({ ops: [{
      op: 'device.insert',
      track: ownedTrack,
      source: { from: 'file', path },
      expectedChain: [],
      expectedEnabledChain: [],
    }] });
    await adapter.settle('insertFile');
    const planted = await adapter.devices(ownedTrack);
    check(`5m-zoo-${modulator.index}: ${modulator.deviceName} donor loads`,
      receipt.minted[0]?.kind === 'device'
        && planted.devicesComplete
        && planted.devices.length === 1
        && planted.devices[0]?.name === 'Polysynth',
      { receipt, planted });
    for (const item of [...planted.devices].reverse()) {
      await adapter.apply({ ops: [{
        op: 'device.delete',
        device: { kind: 'device', track: ownedTrack, chainIndex: item.index },
      }] });
      await adapter.settle('insertFile');
    }
  }
} catch (error) {
  check('5m-zoo-LX: the live check completed without an unexpected failure', false,
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
      check('5m-zoo-cleanup: owned-state cleanup completed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('5m-zoo-cleanup: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks,
      final: finalTracks,
    });
  } catch (error) {
    check('5m-zoo-cleanup: the exact entry track list is restored', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
}

console.log(failureCount() === 0 ? '\nPhase 5m zoo: ALL PASS' : `\nPhase 5m zoo: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
