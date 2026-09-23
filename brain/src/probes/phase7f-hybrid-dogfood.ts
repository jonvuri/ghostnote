/** Phase 7f real-project audio-guided sound-design runner. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';

import {
  addressKey, clip as clipAt, clipMetadata, scene, slot, track as trackAt,
} from '../contract/index.js';
import { Session } from '../session.js';
import { callTool, STABLE_TOOL_PROFILE } from '../surface/tools.js';
import { workspaceOf, type Workspace } from '../surface/workspace.js';
import { PHASE_7F_AUDIO_GUIDED_PROFILE } from '../workstation/hybrid-run-record.js';

interface TrackResult {
  readonly trackId: string;
  readonly name: string;
  readonly kind: string;
  readonly position: number;
}

interface ParameterResult {
  readonly id: string;
  readonly name: string;
  readonly normalizedValue: number;
  readonly display?: string;
  readonly origin?: string;
  readonly modulatedValue?: number;
  readonly hasAutomation?: boolean;
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function call<T>(workspace: Workspace, name: string, args: unknown = {}): Promise<T> {
  return await callTool(workspace, name, args, STABLE_TOOL_PROFILE) as T;
}

async function exactClipMetadata(
  workspace: Workspace,
  trackId: string,
  row: number,
): Promise<unknown> {
  const at = await workspace.mark();
  const address = clipMetadata(clipAt(slot(trackAt(trackId), scene(row, at.sceneEpoch))));
  const snapshot = await workspace.read([address]);
  return snapshot.entries[addressKey(address)]?.value ?? null;
}

async function discover(
  workspace: Workspace,
  projectFile: string,
  trackName: string,
): Promise<unknown> {
  const bytes = await readFile(projectFile);
  const projectFileSha256 = createHash('sha256').update(bytes).digest('hex');
  const connection = await call<Record<string, unknown>>(workspace, 'check_connection');
  const listed = await call<{
    readonly tracks: readonly TrackResult[];
    readonly rows: { readonly inProject: number | null; readonly addressable: number };
  }>(workspace, 'list_tracks');
  const matches = listed.tracks.filter((track) => track.name === trackName);
  if (matches.length !== 1) throw new Error(`track ${trackName} matched ${matches.length} tracks`);
  const track = matches[0]!;
  if (listed.rows.inProject === null) throw new Error('the exact launcher row count is unavailable');
  const clips = [];
  for (let row = 0; row < listed.rows.inProject; row += 1) {
    const clip = await call<Record<string, unknown>>(workspace, 'read_clip', {
      trackId: track.trackId, row, channel: 0,
    });
    if (clip['clipExists'] === true) {
      clips.push({ row, ...clip, exactMetadata: await exactClipMetadata(workspace, track.trackId, row) });
    }
  }
  const devices = await call<{
    readonly complete: boolean;
    readonly devices: readonly { readonly position: number; readonly name: string; readonly enabled?: boolean }[];
  }>(workspace, 'inspect_devices', { trackId: track.trackId });
  if (!devices.complete) throw new Error('the keys device chain is not complete');
  const parameterInventories = [];
  for (const device of devices.devices) {
    const inventory = await call<{
      readonly standing: string;
      readonly deviceName?: string;
      readonly parameters?: readonly ParameterResult[];
      readonly warnings?: readonly unknown[];
      readonly elapsedMs?: number;
    }>(workspace, 'inspect_device_parameters', {
      device: { trackId: track.trackId, devicePosition: device.position }, view: 'direct',
    });
    parameterInventories.push({ device, ...inventory });
  }
  return {
    profile: PHASE_7F_AUDIO_GUIDED_PROFILE,
    project: {
      projectFile,
      projectName: basename(projectFile, '.bwproject'),
      projectFileSha256,
      projectFileBytes: bytes.byteLength,
    },
    connection,
    track,
    launcher: { rows: listed.rows, occupiedClips: clips },
    devices,
    parameterInventories,
  };
}

async function discoverCandidates(workspace: Workspace): Promise<unknown> {
  const listed = await call<{
    readonly tracks: readonly TrackResult[];
    readonly rows: { readonly inProject: number | null; readonly addressable: number };
  }>(workspace, 'list_tracks');
  if (listed.rows.inProject === null) throw new Error('the exact launcher row count is unavailable');
  const candidates = [];
  for (const track of listed.tracks) {
    if (track.kind !== 'Audio' && track.kind !== 'Instrument') continue;
    const occupiedRows = [];
    for (let row = 0; row < listed.rows.inProject; row += 1) {
      const clip = await call<Record<string, unknown>>(workspace, 'read_clip', {
        trackId: track.trackId, row, channel: 0,
      });
      if (clip['clipExists'] === true) {
        occupiedRows.push({
          row,
          lengthBeats: clip['lengthBeats'],
          playback: clip['playback'],
          exactMetadata: await exactClipMetadata(workspace, track.trackId, row),
        });
      }
    }
    if (occupiedRows.length === 0) continue;
    const devices = await call<{
      readonly complete: boolean;
      readonly devices: readonly { readonly position: number; readonly name: string; readonly enabled?: boolean }[];
    }>(workspace, 'inspect_devices', { trackId: track.trackId });
    if (!devices.complete || devices.devices.length === 0) continue;
    candidates.push({ track, occupiedRows, devices });
  }
  return { profile: PHASE_7F_AUDIO_GUIDED_PROFILE.profile, candidates };
}

const mode = process.argv[2] ?? 'discover';
const projectArgument = argument('--project-file');
if (projectArgument === undefined) {
  throw new Error('use --project-file with one absolute .bwproject path');
}
const projectFile = resolve(projectArgument);
if (extname(projectFile) !== '.bwproject') throw new Error('the project file must end in .bwproject');
if (mode !== 'discover' && mode !== 'candidates' && mode !== 'status') {
  throw new Error(`unsupported Phase 7f runner mode: ${mode}`);
}

const session = new Session();
try {
  await session.ready();
  const workspace = workspaceOf({
    ready: async () => { await session.ready(); },
    get adapter() { return session.bitwig; },
    get executor() { return session.executor; },
    stash: session.stash,
    observationStore: session.observations,
  });
  const result = mode === 'discover'
    ? await discover(workspace, projectFile, argument('--track-name') ?? 'keys')
    : mode === 'candidates'
      ? await discoverCandidates(workspace)
      : {
        connection: await call(workspace, 'check_connection'),
        transport: await session.client.request('transport.status', {}),
        recorder: await session.client.request('masterRecorder.status', {
          ownerToken: 'phase7f-status-check',
        }),
        target: await call(workspace, 'inspect_device_parameters', {
          device: {
            trackId: '2598ed2d-9e8c-40f4-8435-33609aad552a',
            devicePosition: 0,
          },
          view: 'direct',
        }),
        clipMetadata: await exactClipMetadata(
          workspace, '2598ed2d-9e8c-40f4-8435-33609aad552a', 6,
        ),
      };
  console.log(JSON.stringify(result, null, 2));
} finally {
  await session.close().catch(() => undefined);
}
