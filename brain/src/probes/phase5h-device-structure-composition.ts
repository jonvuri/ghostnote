/** Focused Phase 5h proof through the public composition and reversal tools. */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { track, type TrackAddress, type TrackState } from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { check, failureCount, note } from './lib.js';

const TRACK_NAME = 'gn-p5h-public-composition';
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

  const stash = new Stash();
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter,
    executor: new Executor(adapter),
    stash,
    observationStore: new FakeObservationStore(),
  });
  const result = await callTool(workspace, 'compose_device_structure', {
    trackId: ownedTrack.channelId,
    entries: [
      {
        deviceName: 'Polysynth',
        modulators: [{
          kind: 'add', modulator: 'lfo',
          target: 'polysynth-filter-frequency', amount: 1,
        }],
      },
      {
        deviceName: 'Sampler',
        modulators: [{
          kind: 'add', modulator: 'lfo',
          target: 'sampler-amp-attack', amount: 1,
        }],
      },
    ],
  }) as {
    applied?: boolean;
    requested?: { entryOrder: readonly string[] };
    validated?: { entries: readonly { modulators: readonly { name: string }[] }[] };
    observed?: { verified: boolean; entryOrder: readonly string[] };
    verification?: { verified: boolean; witnesses: readonly {
      page: { verified: boolean };
      behavior?: { verified: boolean; maximumDivergence: number; baseSpread: number };
    }[] };
    change?: { changeId: string };
  };

  check('5h-L1: the public request records one insertion',
    result.applied === true
      && typeof result.change?.changeId === 'string'
      && stash.log.list().length === 1,
    result);
  check('5h-L2: requested and observed entry order agree exactly',
    JSON.stringify(result.requested?.entryOrder) === JSON.stringify(['Polysynth', 'Sampler'])
      && result.observed?.verified === true
      && JSON.stringify(result.observed.entryOrder) === JSON.stringify(['Polysynth', 'Sampler']),
    { requested: result.requested, observed: result.observed });
  check('5h-L3: the public inventory contains both added modulators',
    result.validated?.entries.length === 2
      && result.validated.entries.every((entry) =>
        entry.modulators.some((modulator) => modulator.name === 'LFO')),
    result.validated);
  check('5h-L4: every exact page and behavior witness passes',
    result.verification?.verified === true
      && result.verification.witnesses.length === 2
      && result.verification.witnesses.every((witness) =>
        witness.page.verified
        && witness.behavior?.verified === true
        && witness.behavior.maximumDivergence > 0
        && witness.behavior.baseSpread <= 2e-3),
    result.verification);

  if (result.change?.changeId !== undefined) {
    const reversed = await callTool(workspace, 'revert_change', {
      changeId: result.change.changeId,
    }) as { applied?: boolean; notRestored?: readonly unknown[] };
    const devices = await adapter.devices(ownedTrack);
    check('5h-L5: public reversal restores the empty owned track',
      reversed.applied === true
        && (reversed.notRestored?.length ?? 0) === 0
        && devices.devicesComplete
        && devices.devices.length === 0,
      { reversed, devices });
  }
} catch (error) {
  check('5h-LX: the focused public proof completed without an unexpected failure', false,
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
      check('5h-cleanup: owned content was removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('5h-cleanup: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks,
      final: finalTracks,
    });
  } catch (error) {
    check('5h-cleanup: the exact entry track list is restored', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
}

console.log(failureCount() === 0 ? '\nPhase 5h: ALL PASS' : `\nPhase 5h: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
