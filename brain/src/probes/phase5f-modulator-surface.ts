/** Phase 5f live proof through the public modulator tool. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { FIXTURE_DIR } from '../bwmod/fixtures.js';
import { track, type TrackAddress, type TrackState } from '../contract/index.js';
import { Executor, inspectPresetModulation } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { check, failureCount, note } from './lib.js';

const TRACK_NAME = 'gn-p5f-public-modulators';
const POLY_BARE = join(FIXTURE_DIR, 'Polysynth', 'mp_bare.bwpreset');
const POLY_MODTEST = join(FIXTURE_DIR, 'Polysynth', 'modtest.bwpreset');
const requestedCase = process.argv[2] ?? 'all';

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

  const cases = [
    {
      name: 'add',
      presetPath: POLY_BARE,
      operation: {
        kind: 'add', modulator: 'lfo', target: 'polysynth-filter-frequency', amount: 1,
      },
    },
    {
      name: 'replace',
      presetPath: POLY_MODTEST,
      operation: { kind: 'replace', position: 0, modulator: 'classic-lfo' },
      pageChecks: [
        { pageName: 'Classic LFO', expectedCount: 1 },
        { pageName: 'Vibrato', expectedCount: 0 },
      ],
    },
    {
      name: 'retarget',
      presetPath: POLY_MODTEST,
      operation: { kind: 'retarget', position: 2, target: 'polysynth-filter-resonance' },
      behaviorChecks: [
        { expected: 'inactive', target: 'polysynth-filter-frequency' },
        { expected: 'active', target: 'polysynth-filter-resonance' },
      ],
    },
    {
      name: 'delete',
      presetPath: POLY_MODTEST,
      operation: { kind: 'delete', position: 2 },
      pageChecks: [
        { pageName: 'LFO', expectedCount: 0 },
        { pageName: 'Vibrato', expectedCount: 1 },
      ],
      behaviorChecks: [{ expected: 'inactive', target: 'polysynth-filter-frequency' }],
    },
  ] as const;

  const selected = requestedCase === 'all'
    ? cases
    : cases.filter((item) => item.name === requestedCase);
  if (selected.length === 0) throw new Error(`unknown Phase 5f case ${requestedCase}`);
  for (const item of selected) {
    const inspection = inspectPresetModulation(await readFile(item.presetPath));
    if (!inspection.supported) throw new Error(inspection.why);
    const result = await callTool(workspace, 'author_modulators', {
      trackId: ownedTrack.channelId,
      presetPath: item.presetPath,
      fingerprint: inspection.fingerprint,
      location: inspection.modulation[0]!.location,
      operation: item.operation,
      ...('pageChecks' in item ? { pageChecks: item.pageChecks } : {}),
      ...('behaviorChecks' in item ? { behaviorChecks: item.behaviorChecks } : {}),
    }) as {
      applied?: boolean;
      verified?: { passed: boolean };
      change?: { changeId: string };
    };
    check(`5f-${item.name}: public insertion and exact witnesses pass`,
      result.applied === true && result.verified?.passed === true
        && typeof result.change?.changeId === 'string', result);
    if (result.change?.changeId !== undefined) {
      const reversed = await callTool(workspace, 'revert_change', {
        changeId: result.change.changeId,
      }) as { applied?: boolean; notRestored?: readonly unknown[] };
      const devices = await adapter.devices(ownedTrack);
      check(`5f-${item.name}: recorded reversal restores the empty owned track`,
        reversed.applied === true
          && (reversed.notRestored?.length ?? 0) === 0
          && devices.devicesComplete
          && devices.devices.length === 0,
        { reversed, devices });
    }
  }
} catch (error) {
  check('5f-LX: the public live proof completed without an unexpected failure', false,
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
      check('5f-cleanup: owned content was removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('5f-cleanup: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks,
      final: finalTracks,
    });
  } catch (error) {
    check('5f-cleanup: the exact entry track list is restored', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
}

console.log(failureCount() === 0 ? '\nPhase 5f: ALL PASS' : `\nPhase 5f: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
