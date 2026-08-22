/** Phase 4 session 4i: registered MCP device-surface proof and exact cleanup. */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { client as bridge, check, failureCount, note } from './lib.js';

const PROJECT = '26.05-2 moon';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const VST3_CLASS_UID = 'D39D5B69D6AF42FA123456785A334D44';
const CLAP_ID = 'com.u-he.Zebra3';
const SAMPLER_PRESET = fileURLToPath(
  new URL('../../fixtures/Sampler/gn_sampler_no_sample.bwpreset', import.meta.url),
);
const TRACK_NAME = `gn-4i-device-surface-${process.pid}`;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface TrackRow {
  readonly trackId: string;
  readonly name: string;
}

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
  readonly mixerTrackIndex: number;
}

const transport = new StdioClientTransport({ command: 'npx', args: ['tsx', 'src/mcp-server.ts'] });
const mcp = new Client({ name: 'phase4i-device-surface', version: '1.0.0' });
let connected = false;
let ownedTrackId: string | undefined;
let entrySelection: Selection | undefined;
let entryTrackIds: readonly string[] = [];

function parse(value: unknown): Record<string, unknown> {
  const content = (value as { content?: { type: string; text?: string }[] }).content ?? [];
  const raw = content.find((item) => item.type === 'text')?.text;
  if (raw === undefined) throw new Error('the MCP call returned no text result');
  return JSON.parse(raw) as Record<string, unknown>;
}

const call = async (name: string, args: Record<string, unknown> = {}) =>
  parse(await mcp.callTool({ name, arguments: args }));

async function tracks(): Promise<readonly TrackRow[]> {
  const result = await call('list_tracks') as { tracks?: readonly TrackRow[] };
  return result.tracks ?? [];
}

async function removeOwnedTrack(): Promise<void> {
  if (!connected || ownedTrackId === undefined) return;
  const present = (await tracks()).some((row) => row.trackId === ownedTrackId);
  if (!present) {
    ownedTrackId = undefined;
    return;
  }
  const inspected = await call('inspect_devices', { trackId: ownedTrackId }) as {
    complete?: boolean;
    devices?: readonly { position: number }[];
  };
  if (inspected.complete === true && (inspected.devices?.length ?? 0) > 0) {
    const removed = await call('delete_device', {
      devices: inspected.devices!.map((item) => ({
        trackId: ownedTrackId,
        position: item.position,
      })),
    });
    check('4i cleanup removes the complete owned device order',
      removed['verified'] === true, removed);
  }
  const deleted = await call('delete_track', { trackIds: [ownedTrackId] });
  check('4i cleanup removes the owned scratch track', deleted['applied'] === true, deleted);
  ownedTrackId = undefined;
}

try {
  await bridge.connect();
  const revision = await bridge.request('revision.get') as { project?: string };
  entrySelection = await bridge.request('selection.status') as Selection;
  check('4i-L1: the expected saved project and preset fixture are available',
    revision.project === PROJECT && existsSync(SAMPLER_PRESET), {
      project: revision.project,
      preset: SAMPLER_PRESET,
    });
  if (revision.project !== PROJECT) throw new Error(`expected ${PROJECT}, got ${revision.project ?? 'no project'}`);
  if (!existsSync(SAMPLER_PRESET)) throw new Error(`preset fixture is absent: ${SAMPLER_PRESET}`);

  await mcp.connect(transport);
  connected = true;
  const tools = await mcp.listTools();
  const cohort = [
    'inspect_devices', 'inspect_device_parameters', 'add_device',
    'set_parameter', 'set_device_enabled', 'delete_device',
  ];
  check('4i-L2: the six-tool cohort crosses registered MCP with the required partition',
    cohort.every((name) => tools.tools.some((tool) => tool.name === name))
      && tools.tools.find((tool) => tool.name === 'delete_device')?.annotations?.destructiveHint === true
      && cohort.filter((name) => name !== 'delete_device').every((name) =>
        tools.tools.find((tool) => tool.name === name)?.annotations?.destructiveHint === false),
    tools.tools.filter((tool) => cohort.includes(tool.name)).map((tool) => ({
      name: tool.name,
      annotations: tool.annotations,
    })),
  );

  entryTrackIds = (await tracks()).map((row) => row.trackId);
  const created = await call('add_track', { names: [TRACK_NAME] }) as {
    creationConfirmed?: boolean;
    namesConfirmed?: boolean;
    created?: readonly { trackId?: string }[];
  };
  ownedTrackId = created.created?.[0]?.trackId;
  check('4i-L3: ordinary MCP creates and names one owned empty track',
    created.creationConfirmed === true
      && created.namesConfirmed === true
      && typeof ownedTrackId === 'string', created);
  if (ownedTrackId === undefined) throw new Error('the owned track id was not returned');

  const sources = [
    { from: 'bitwig', id: POLYSYNTH },
    { from: 'vst3', id: VST3_CLASS_UID },
    { from: 'clap', id: CLAP_ID },
    { from: 'preset', path: SAMPLER_PRESET },
  ] as const;
  const positions: number[] = [];
  for (const source of sources) {
    const prior = await call('inspect_devices', { trackId: ownedTrackId }) as {
      complete?: boolean;
      devices?: readonly { name: string; enabled?: boolean }[];
    };
    if (prior.complete !== true
        || prior.devices?.every((item) => typeof item.enabled === 'boolean') !== true) {
      throw new Error(`the complete prior order was unavailable before ${source.from} insertion`);
    }
    const added = await call('add_device', {
      devices: [{
        trackId: ownedTrackId,
        ...source,
        expectedDevices: prior.devices.map((item) => ({
          name: item.name,
          enabled: item.enabled as boolean,
        })),
      }],
    }) as {
      applied?: boolean;
      added?: readonly { position?: number; source?: string }[];
      elapsedMs?: number;
    };
    const position = added.added?.[0]?.position;
    check(`4i-L4-${source.from}: explicit ${source.from} insertion has complete positional readback`,
      added.applied === true
        && added.added?.[0]?.source === source.from
        && typeof position === 'number', added);
    if (typeof position !== 'number') throw new Error(`${source.from} insertion returned no position`);
    positions.push(position);
    check(`4i-L4-${source.from}-timing: insertion reports complete public wall time`,
      typeof added.elapsedMs === 'number' && added.elapsedMs > 0, added);
    if (source.from === 'vst3' || source.from === 'clap') {
      check(`4i-L4-${source.from}-budget: plugin insertion stays within E61`,
        typeof added.elapsedMs === 'number' && added.elapsedMs <= 2_000, added);
    }
  }

  const order = await call('inspect_devices', { trackId: ownedTrackId }) as {
    complete?: boolean;
    devices?: readonly { position: number; enabled?: boolean }[];
  };
  check('4i-L5: complete device inspection reports all four current positions and enabled states',
    order.complete === true
      && order.devices?.map((item) => item.position).join(',') === positions.join(',')
      && order.devices.every((item) => typeof item.enabled === 'boolean'), order);

  const inventory = await call('inspect_device_parameters', {
    device: { trackId: ownedTrackId, devicePosition: positions[0] },
  }) as {
    standing?: string;
    parameters?: readonly { id: string; name: string; normalizedValue: number }[];
    elapsedMs?: number;
  };
  check('4i-L6: the public inventory discovers more than eight named DirectParameters',
    inventory.standing === 'stable'
      && (inventory.parameters?.length ?? 0) > 8
      && inventory.parameters?.every((item) => item.id !== '' && item.name !== '') === true,
    {
      standing: inventory.standing,
      parameterCount: inventory.parameters?.length,
      elapsedMs: inventory.elapsedMs,
    });
  check('4i-L6-budget: native inventory stays within E61',
    typeof inventory.elapsedMs === 'number' && inventory.elapsedMs <= 3_500,
    { elapsedMs: inventory.elapsedMs });

  const unsafe = /bypass|device on|preset|program|random|trigger|panic/i;
  const selected = inventory.parameters?.find((item) => !unsafe.test(item.name));
  if (selected === undefined) throw new Error('no safe public parameter was discovered');
  const requested = selected.normalizedValue <= 0.9
    ? selected.normalizedValue + 0.05
    : selected.normalizedValue - 0.05;
  const changed = await call('set_parameter', { settings: [{
    kind: 'direct',
    device: { trackId: ownedTrackId, devicePosition: positions[0] },
    parameterId: selected.id,
    normalizedValue: requested,
  }] }) as {
    verified?: boolean;
    changes?: readonly { changeId: string }[];
    elapsedMs?: number;
  };
  check('4i-L7: a returned DirectParameter id writes with exact readback',
    changed.verified === true && typeof changed.changes?.[0]?.changeId === 'string', changed);
  check('4i-L7-budget: top-level scalar replay stays within E61',
    typeof changed.elapsedMs === 'number' && changed.elapsedMs <= 6_000, changed);

  const bypassed = await call('set_device_enabled', { settings: [{
    trackId: ownedTrackId,
    devicePosition: positions[0],
    enabled: false,
  }] }) as { verified?: boolean; changes?: readonly { changeId: string }[] };
  check('4i-L8: bypass uses exact enabled-state readback',
    bypassed.verified === true && typeof bypassed.changes?.[0]?.changeId === 'string', bypassed);

  const restoredBypass = await call('revert_change', {
    changeId: bypassed.changes?.[0]?.changeId,
  });
  const restoredParameter = await call('revert_change', {
    changeId: changed.changes?.[0]?.changeId,
  });
  check('4i-L9: ordinary reversal restores both scalar bases exactly',
    restoredBypass['applied'] === true && restoredParameter['applied'] === true, {
      restoredBypass,
      restoredParameter,
    });

  const withRemotes = await call('inspect_device_parameters', {
    device: { trackId: ownedTrackId, devicePosition: positions[0] },
    view: 'remote-controls',
  }) as {
    standing?: string;
    remotePages?: readonly { name: string; controls: readonly { name: string }[] }[];
    elapsedMs?: number;
  };
  check('4i-L10-remotes: optional remote inspection returns exact selectors or explicit instability',
    (withRemotes.standing === 'stable'
      && (withRemotes.remotePages?.length ?? 0) > 0
      && withRemotes.remotePages?.every((page) =>
        page.name !== '' && page.controls.every((control) => control.name !== '')) === true)
      || (withRemotes.standing === 'unstable'
        && (withRemotes.remotePages?.length ?? 0) === 0),
    {
      standing: withRemotes.standing,
      remotePageCount: withRemotes.remotePages?.length,
      elapsedMs: withRemotes.elapsedMs,
    });
} catch (error) {
  check('4i-LX: the live public-device proof completed without an unexpected failure', false, {
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  });
} finally {
  try {
    await removeOwnedTrack();
  } catch (error) {
    check('4i cleanup completed without an unexpected failure', false, {
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
  }
  try {
    if (entrySelection !== undefined) {
      await bridge.request('cursor.pin', { cursor: 'fine', pinned: false });
      await bridge.request('cursor.pinTrack', { cursor: 'fine', pinned: false });
      await bridge.request('cursor.pointTrack', {
        cursor: 'fine', trackIndex: entrySelection.mixerTrackIndex,
      });
      await bridge.request('slot.select', {
        trackIndex: entrySelection.trackIndex,
        slotIndex: entrySelection.slotIndex,
        mechanism: 'track',
      });
      await wait(150);
      await bridge.request('cursor.pinTrack', { cursor: 'fine', pinned: true });
      await bridge.request('cursor.pin', { cursor: 'fine', pinned: true });
      const selection = await bridge.request('selection.status') as Selection;
      check('4i cleanup restores the exact entry selection',
        selection.trackIndex === entrySelection.trackIndex
          && selection.slotIndex === entrySelection.slotIndex
          && selection.mixerTrackIndex === entrySelection.mixerTrackIndex,
        { entrySelection, selection });
    }
    if (connected) {
      const finalTracks = await tracks();
      check('4i cleanup restores the exact entry track identities',
        finalTracks.map((row) => row.trackId).join(',') === entryTrackIds.join(','), {
          before: entryTrackIds,
          after: finalTracks.map((row) => row.trackId),
        });
    }
  } catch (error) {
    check('4i final baseline completed without an unexpected failure', false, {
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
  }
  try { await mcp.close(); } catch { /* The child can already be closed. */ }
  bridge.disconnect();
}

note(`Phase 4 session 4i device surface: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
