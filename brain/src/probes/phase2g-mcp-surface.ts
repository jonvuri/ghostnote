/** Live public-path smoke for the Phase 2 musical tools. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { check, client as bridge, failureCount, note } from './lib.js';

const transport = new StdioClientTransport({ command: 'npx', args: ['tsx', 'src/mcp-server.ts'] });
const mcp = new Client({ name: 'phase2g-musical-smoke', version: '1.0.0' });

const parse = (value: unknown): Record<string, unknown> => {
  const content = (value as { content?: { type: string; text?: string }[] }).content ?? [];
  const text = content.find((item) => item.type === 'text')?.text;
  if (text === undefined) throw new Error('the MCP call returned no text result');
  return JSON.parse(text) as Record<string, unknown>;
};

const call = async (name: string, args: Record<string, unknown> = {}) =>
  parse(await mcp.callTool({ name, arguments: args }));

let trackId: string | undefined;
let row: number | undefined;
let createdChangeId: string | undefined;
let generatedChangeId: string | undefined;
let transformedChangeId: string | undefined;
let observationBefore = '';
let mcpConnected = false;

async function restoreChange(changeId: string | undefined): Promise<void> {
  if (changeId === undefined) return;
  const result = await call('revert_change', { changeId });
  check(`2g cleanup restores ${changeId}`, result['applied'] === true, result);
}

async function restoreProjectSurface(): Promise<void> {
  await restoreChange(transformedChangeId);
  transformedChangeId = undefined;
  await restoreChange(generatedChangeId);
  generatedChangeId = undefined;
  await restoreChange(createdChangeId);
  createdChangeId = undefined;

  if (trackId !== undefined && row !== undefined) {
    const state = await call('read_clip', { trackId, row });
    if (state['clipExists'] === true) {
      const removed = await call('delete_clip', { clips: [{ trackId, row }] });
      check('2g cleanup removes only its own remaining clip', removed['applied'] === true, removed);
    }
    const final = await call('read_clip', { trackId, row });
    check('2g cleanup leaves the selected slot empty', final['clipExists'] === false, final);
  }

  if (observationBefore !== '') {
    const replaced = await bridge.request('observation.replace', { value: observationBefore }) as {
      accepted?: boolean;
    };
    const observed = await bridge.request('observation.read') as { value?: string };
    check('2g cleanup restores the exact raw observation value',
      replaced.accepted === true && observed.value === observationBefore,
      { replaced, observed: observed.value });
  }

  await bridge.request('slot.select', { trackIndex: 0, slotIndex: 1, mechanism: 'slot' });
  const selection = await bridge.request('selection.status') as {
    trackIndex?: number; slotIndex?: number;
  };
  check('2g cleanup restores selection',
    selection.trackIndex === 0 && selection.slotIndex === 1, selection);
  const at = await bridge.request('revision.get') as { generation?: string; project?: string };
  const status = await bridge.request('status.push', {
    value: 'Change · 4a-live-check',
    expectedGeneration: at.generation,
    expectedProject: at.project,
  }) as { accepted?: boolean };
  check('2g cleanup restores Last change', status.accepted === true, status);
  const playback = await bridge.request('transport.status') as { isPlaying?: boolean };
  check('2g cleanup leaves transport stopped', playback.isPlaying === false, playback);
}

try {
  await bridge.connect();
  const stored = await bridge.request('observation.read') as { value?: string };
  observationBefore = stored.value ?? '';
  await mcp.connect(transport);
  mcpConnected = true;

  const listed = await mcp.listTools();
  const musicTools = listed.tools.filter((tool) => tool.name.endsWith('_clip_music'));
  check('2g-L1: one generation and one transformation tool cross MCP',
    musicTools.map((tool) => tool.name).join(',')
      === 'generate_clip_music,transform_clip_music',
    musicTools.map((tool) => ({ name: tool.name, annotations: tool.annotations })));
  check('2g-L2: both musical tools are ordinary non-destructive writes',
    musicTools.every((tool) => tool.annotations?.destructiveHint === false
      && tool.annotations?.readOnlyHint === false),
    musicTools.map((tool) => ({ name: tool.name, annotations: tool.annotations })));

  const listedTracks = await call('list_tracks') as {
    tracks?: { trackId: string; kind: string }[];
  };
  const connection = await call('check_connection') as {
    rows?: { addressable: number; inProject: number | null };
  };
  const rowCount = Math.min(
    connection.rows?.addressable ?? 0,
    connection.rows?.inProject ?? connection.rows?.addressable ?? 0,
  );
  for (const track of listedTracks.tracks ?? []) {
    if (track.kind !== 'Instrument' && track.kind !== 'Hybrid') continue;
    for (let candidate = 0; candidate < rowCount; candidate += 1) {
      const state = await call('read_clip', { trackId: track.trackId, row: candidate });
      if (state['readable'] === true && state['clipExists'] === false) {
        trackId = track.trackId;
        row = candidate;
        break;
      }
    }
    if (trackId !== undefined) break;
  }
  check('2g-L3: an empty live launcher slot is positively read',
    trackId !== undefined && row !== undefined, { trackId, row });
  if (trackId === undefined || row === undefined) throw new Error('no empty instrument slot is visible');

  const created = await call('add_clip', {
    clips: [{ trackId, row, lengthBeats: 4 }],
  });
  createdChangeId = created['changeId'] as string;
  check('2g-L4: the exact clip tool creates the container',
    created['applied'] === true && typeof createdChangeId === 'string', created);

  const generated = await call('generate_clip_music', {
    schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
    targets: [{
      clip: { trackId, row }, channel: 15, write: 'merge',
      operations: [{
        op: 'generate', source: { kind: 'chord', symbol: 'Cm', octave: 4 },
        placement: { kind: 'stack', startBeats: 0, durationBeats: 1 }, velocity: 90,
      }],
    }],
  });
  generatedChangeId = (generated['changes'] as { changeId: string }[])[0]?.changeId;
  check('2g-L5: generation applies through the public tool',
    generated['applied'] === true && typeof generatedChangeId === 'string', generated);

  const transformed = await call('transform_clip_music', {
    schema: 'ghostnote-musical-patch', version: 1, protection: { kind: 'direct' },
    targets: [{
      clip: { trackId, row }, channel: 15, write: 'replace',
      operations: [{ op: 'transpose', semitones: 7 }],
    }],
  });
  transformedChangeId = (transformed['changes'] as { changeId: string }[])[0]?.changeId;
  check('2g-L6: transformation applies through the public tool',
    transformed['applied'] === true && typeof transformedChangeId === 'string', transformed);

  const read = await call('read_clip', { trackId, row, channel: 15 });
  check('2g-L7: the ordinary client reads the transformed notes',
    read['clipExists'] === true
      && Array.isArray(read['notes'])
      && read['notes'].length === 3,
    read);

  const opened = await call('show_changed_clip', {
    changeId: transformedChangeId,
    target: { trackId, row },
  });
  check('2g-L8: the ordinary client opens the changed clip in Bitwig',
    opened['navigated'] === true && opened['layoutRequested'] === 'EDIT', opened);

  await restoreChange(transformedChangeId);
  transformedChangeId = undefined;
  const restored = await call('read_clip', { trackId, row, channel: 15 });
  check('2g-L9: reversal restores the generated chord',
    Array.isArray(restored['notes']) && restored['notes'].length === 3, restored);
} catch (error) {
  check('2g-LX: the live MCP smoke completed without an unexpected failure', false, {
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  });
} finally {
  try {
    if (mcpConnected) await restoreProjectSurface();
  } catch (error) {
    check('2g cleanup completed without an unexpected failure', false, {
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
  }
  try { await mcp.close(); } catch { /* The child can already be closed. */ }
  bridge.disconnect();
}

note(`Phase 2 session 2g MCP surface: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
