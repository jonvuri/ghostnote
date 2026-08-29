/** Phase 5j live proof for exact native and plug-in DirectParameter targets. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { FIXTURE_DIR } from '../bwmod/fixtures.js';
import { track, type TrackAddress, type TrackState } from '../contract/index.js';
import { Executor, inspectPresetModulation } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool } from '../surface/tools.js';
import { workspaceOf, type Workspace } from '../surface/workspace.js';
import { check, failureCount, note } from './lib.js';

const TRACK_NAME = 'gn-p5j-general-targets';
const POLY_BARE = join(FIXTURE_DIR, 'Polysynth', 'mp_bare.bwpreset');
const ZEBRA_VST3_BARE = join(
  homedir(), 'Documents', 'Bitwig Studio', 'Library', 'Presets',
  'Zebra3', 'gn_zebra3vst_bare.bwpreset',
);
const requestedCase = process.argv[2] ?? 'all';

type PublicParameter = { readonly id: string; readonly name: string };

const adapter = new LiveAdapter();
let ownedTrack: TrackAddress | undefined;
let entryTracks: readonly TrackState[] = [];

function sameTracks(left: readonly TrackState[], right: readonly TrackState[]): boolean {
  return JSON.stringify(left.map((item) => [item.channelId, item.name, item.position, item.type]))
    === JSON.stringify(right.map((item) => [item.channelId, item.name, item.position, item.type]));
}

async function inspectTarget(
  workspace: Workspace,
  source: { readonly from: 'preset'; readonly path: string }
    | { readonly from: 'clap'; readonly id: string },
  parameterId?: string,
): Promise<PublicParameter> {
  const added = await callTool(workspace, 'add_device', {
    devices: [{ trackId: ownedTrack!.channelId, ...source }],
  }) as {
    readonly applied?: boolean;
    readonly added?: readonly { readonly position: number }[];
    readonly changes?: readonly { readonly changeId: string }[];
  };
  const position = added.added?.[0]?.position;
  const changeId = added.changes?.[0]?.changeId;
  if (added.applied !== true || position === undefined || changeId === undefined) {
    throw new Error(`discovery device insertion failed: ${JSON.stringify(added)}`);
  }
  try {
    if (parameterId === undefined) {
      // Zebra exposes more than 2,000 parameters. Let its first observer
      // generation populate before a public inventory starts a fresh one.
      await new Promise((resolve) => setTimeout(resolve, 3_500));
    }
    let inventory: {
      readonly standing?: string;
      readonly parameters?: readonly PublicParameter[];
    } = {};
    for (let attempt = 0; attempt < 3; attempt++) {
      inventory = await callTool(workspace, 'inspect_device_parameters', {
        device: { trackId: ownedTrack!.channelId, devicePosition: position },
      }) as typeof inventory;
      if (inventory.standing === 'stable') break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const parameters = inventory.parameters ?? [];
    let target = parameterId === undefined
      ? undefined
      : parameters.find((parameter) => parameter.id === parameterId);
    if (parameterId === undefined && inventory.standing === 'stable') {
      const remotes = await callTool(workspace, 'inspect_device_parameters', {
        device: { trackId: ownedTrack!.channelId, devicePosition: position },
        view: 'remote-controls',
      }) as {
        readonly standing?: string;
        readonly remotePages?: readonly {
          readonly controls: readonly { readonly name: string }[];
        }[];
      };
      const remoteNames = (remotes.remotePages ?? []).flatMap((page) =>
        page.controls.map((control) => control.name));
      const counts = new Map<string, number>();
      for (const name of remoteNames) counts.set(name, (counts.get(name) ?? 0) + 1);
      const unsafe = /bypass|device on|preset|program|random|trigger|panic|output/i;
      target = parameters.find((parameter) =>
        /^CONTENTS\/PID[0-9a-f]+$/i.test(parameter.id)
        && counts.get(parameter.name) === 1
        && !unsafe.test(parameter.name));
      note(`selected plug-in target ${JSON.stringify(target)} from `
        + `${parameters.length} DirectParameters and ${remoteNames.length} remote controls`);
    }
    if (inventory.standing !== 'stable' || target === undefined) {
      const tail = parameterId?.match(/PID([0-9a-f]+)$/i)?.[1];
      const nearby = parameters.filter((parameter) =>
        (tail !== undefined && parameter.id.toLowerCase().includes(tail.toLowerCase()))
        || /cutoff/i.test(parameter.name));
      throw new Error(`target ${parameterId ?? '(remote intersection)'} was not in the stable inventory: `
        + `${JSON.stringify({ count: parameters.length, nearby, first: parameters.slice(0, 12) })}`);
    }
    return target;
  } finally {
    await callTool(workspace, 'revert_change', { changeId });
  }
}

async function prove(
  workspace: Workspace,
  label: string,
  presetPath: string,
  target: PublicParameter,
): Promise<void> {
  const inspection = inspectPresetModulation(await readFile(presetPath));
  if (!inspection.supported) throw new Error(inspection.why);
  const result = await callTool(workspace, 'author_modulators', {
    trackId: ownedTrack!.channelId,
    presetPath,
    fingerprint: inspection.fingerprint,
    location: inspection.modulation[0]!.location,
    operation: { kind: 'add', modulator: 'lfo', target: {
      parameterId: target.id,
      parameterName: target.name,
    }, amount: 1 },
  }) as {
    readonly applied?: boolean;
    readonly verified?: { readonly passed: boolean; readonly behaviors?: readonly unknown[] };
    readonly change?: { readonly changeId: string };
  };
  check(`5j-${label}: exact DirectParameter target loads and is active`,
    result.applied === true
      && result.verified?.passed === true
      && typeof result.change?.changeId === 'string', result);
  if (result.change?.changeId === undefined) return;
  const reversed = await callTool(workspace, 'revert_change', { changeId: result.change.changeId }) as {
    readonly applied?: boolean;
    readonly notRestored?: readonly unknown[];
  };
  const devices = await adapter.devices(ownedTrack!);
  check(`5j-${label}: reversal restores the empty owned track`,
    reversed.applied === true
      && (reversed.notRestored?.length ?? 0) === 0
      && devices.devicesComplete
      && devices.devices.length === 0,
    { reversed, devices });
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

  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter,
    executor: new Executor(adapter),
    stash: new Stash(),
    observationStore: new FakeObservationStore(),
  });

  if (requestedCase === 'all' || requestedCase === 'native') {
    const polyTarget = await inspectTarget(
      workspace, { from: 'preset', path: POLY_BARE }, 'CONTENTS/F1FREQ',
    );
    await prove(workspace, 'native', POLY_BARE, polyTarget);
  }
  if (requestedCase === 'all' || requestedCase === 'plugin') {
    const pluginTarget = await inspectTarget(
      workspace, { from: 'preset', path: ZEBRA_VST3_BARE }, 'CONTENTS/PID411',
    );
    await prove(workspace, 'plugin', ZEBRA_VST3_BARE, pluginTarget);
  }
  if (!['all', 'native', 'plugin'].includes(requestedCase)) {
    throw new Error(`unknown Session 5j case ${requestedCase}`);
  }
} catch (error) {
  check('5j-LX: the focused live proof completed without an unexpected failure', false,
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
        await adapter.settle('trackStruct');
      }
      await adapter.apply({ ops: [{ op: 'track.delete', track: ownedTrack }] });
      await adapter.settle('trackStruct');
    } catch (error) {
      check('5j-cleanup: owned content was removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('5j-cleanup: the exact entry track list is restored', sameTracks(finalTracks, entryTracks), {
      entry: entryTracks,
      final: finalTracks,
    });
  } catch (error) {
    check('5j-cleanup: the exact entry track list is restored', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
}

console.log(failureCount() === 0 ? '\nPhase 5j: ALL PASS' : `\nPhase 5j: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
