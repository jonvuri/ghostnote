/** Phase 5l live proof for semantic outer and nested modulator locations. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { FIXTURE_DIR } from '../bwmod/fixtures.js';
import { track, type Op, type TrackAddress, type TrackState } from '../contract/index.js';
import {
  Executor, authorSemanticModulatorEdit, inspectPresetModulation,
  type ModulatorAuthoringHost, type SemanticModulatorEditRequest,
} from '../engine/index.js';
import { check, failureCount, note } from './lib.js';

const TRACK_NAME = 'gn-p5l-semantic-topology';
const NESTED_TEMPLATE = join(FIXTURE_DIR, 'InstrumentLayer', 'gn_layer_4chain.bwpreset');
const OUTER_TARGET = 'CONTENTS/DEVICE_CHAIN/Polysynth/DEVICE_CHAIN/0:CONTENTS/F1FREQ';

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

  const outerBytes = await readFile(NESTED_TEMPLATE);
  const outerInspection = inspectPresetModulation(outerBytes);
  if (!outerInspection.supported) throw new Error(outerInspection.why);
  const outerLocation = outerInspection.modulation[0]?.location;
  if (outerLocation?.kind !== 'container') {
    throw new Error('the outer template has no semantic container location');
  }
  const outer = await authorSemanticModulatorEdit(host, {
    track: ownedTrack,
    templatePath: NESTED_TEMPLATE,
    fingerprint: outerInspection.fingerprint,
    location: outerLocation,
    edit: {
      kind: 'add',
      donorId: 'random-sampler',
      routing: { target: OUTER_TARGET, amount: 1 },
    },
    pageWitnesses: [{ pageName: 'Random', expectedCount: 1 }],
    expectedChain: [],
    expectedEnabledChain: [],
  });
  check('5l-L1: the semantic outer add loads its exact Random page',
    outer.verification.verified
      && outer.edit.location.kind === 'container'
      && outer.edit.siblingInventoriesUnchanged,
    { edit: outer.edit, verification: outer.verification });
  const outerReversal = await executor.revertUnchecked(outer.take);
  let devices = await adapter.devices(ownedTrack);
  check('5l-L2: outer reversal restores the empty owned track',
    outerReversal.unrestored.length === 0
      && devices.devicesComplete
      && devices.devices.length === 0,
    { outerReversal, devices });

  const nestedBytes = await readFile(NESTED_TEMPLATE);
  const nestedInspection = inspectPresetModulation(nestedBytes);
  if (!nestedInspection.supported) throw new Error(nestedInspection.why);
  const nestedLocation = nestedInspection.modulation[2]?.location;
  if (nestedLocation?.kind !== 'entry') {
    throw new Error('the owned template has no first-entry semantic location');
  }
  const nestedRequest: SemanticModulatorEditRequest = {
    track: ownedTrack,
    templatePath: NESTED_TEMPLATE,
    fingerprint: nestedInspection.fingerprint,
    location: nestedLocation,
    edit: { kind: 'retarget', index: 0, target: 'CONTENTS/F1FREQ' },
    pageWitnesses: [{
      pageName: 'Vibrato',
      expectedCount: 1,
      nestedDevice: { chainName: 'Polysynth', chainIndex: 0 },
    }],
    expectedChain: [],
    expectedEnabledChain: [],
  };
  const nested = await authorSemanticModulatorEdit(host, nestedRequest);
  check('5l-L3: the semantic nested retarget keeps its exact nested page',
    nested.verification.verified
      && nested.edit.location.kind === 'entry'
      && nested.edit.modulatorsBefore[0]?.routes[0]?.target.standing === 'resolved'
      && nested.edit.modulatorsBefore[0]?.routes[0]?.target.parameter.parameterId === 'CONTENTS/PITCH'
      && nested.edit.modulatorsAfter[0]?.routes[0]?.target.standing === 'resolved'
      && nested.edit.modulatorsAfter[0]?.routes[0]?.target.parameter.parameterId === 'CONTENTS/F1FREQ'
      && nested.edit.siblingInventoriesUnchanged,
    { edit: nested.edit, verification: nested.verification });
  const nestedReversal = await executor.revertUnchecked(nested.take);
  devices = await adapter.devices(ownedTrack);
  check('5l-L4: nested reversal restores the empty owned track',
    nestedReversal.unrestored.length === 0
      && devices.devicesComplete
      && devices.devices.length === 0,
    { nestedReversal, devices });
} catch (error) {
  check('5l-LX: the focused live proof completed without an unexpected failure', false,
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
      check('5l-cleanup: owned content was removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('5l-cleanup: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks,
      final: finalTracks,
    });
  } catch (error) {
    check('5l-cleanup: the exact entry track list is restored', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
}

console.log(failureCount() === 0 ? '\nPhase 5l: ALL PASS' : `\nPhase 5l: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
