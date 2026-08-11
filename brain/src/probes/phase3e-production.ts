/**
 * Phase 1 session 3e — narrow live smoke through the production MCP surface.
 *
 * Claims five consecutive empty rows on gn-A, creates one source clip, and then
 * exercises the exact tools an agent receives: copy, inspect, launch, move, the
 * reported reverse call, and destructive cleanup. Every candidate cleanup row
 * was positively empty before the probe began. The transport is stopped on all
 * exits.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { check, client as bridge, failureCount, note } from './lib.js';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', 'src/mcp-server.ts'],
});
const mcp = new Client({ name: 'phase3e-production-probe', version: '0.0.1' });

const parse = (result: unknown): Record<string, unknown> => {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  const payload = content.find((part) => part.type === 'text')?.text ?? '{}';
  return JSON.parse(payload) as Record<string, unknown>;
};

const call = async (name: string, args: Record<string, unknown> = {}) =>
  parse(await mcp.callTool({ name, arguments: args }));

const applied = (result: Record<string, unknown>): boolean =>
  result['applied'] === true && result['refused'] !== true;

let trackId: string | undefined;
let firstRow: number | undefined;

async function stopTransport(): Promise<void> {
  try {
    await bridge.request('transport.stop');
  } catch {
    // The failed bridge call is already visible in the probe result.
  }
}

async function cleanup(): Promise<void> {
  await stopTransport();
  if (trackId === undefined || firstRow === undefined) return;
  // A failed overlapping move can leave either source or destination occupied.
  // All three rows were verified empty before the probe, so any current clips
  // in them belong to this run.
  const candidates = [firstRow, firstRow + 1, firstRow + 2];
  const occupied: { trackId: string; row: number }[] = [];
  for (const row of candidates) {
    const state = await call('read_clip', { trackId, row });
    if (state['clipExists'] === true) occupied.push({ trackId, row });
  }
  if (occupied.length === 0) return;
  const removed = await call('delete_clip', { clips: occupied });
  check('3e-P8: every clip created by the live smoke is removed', applied(removed), removed);
}

try {
  await bridge.connect();
  await mcp.connect(transport);

  const listed = await call('list_tracks') as {
    tracks?: { trackId: string; name: string; kind: string }[];
  };
  const candidates = (listed.tracks ?? [])
    .filter((track) => track.kind === 'Instrument' || track.kind === 'Hybrid')
    .sort((a, b) => Number(b.name === 'gn-A') - Number(a.name === 'gn-A'));
  check('3e-P0: the production surface resolves visible instrument tracks',
    candidates.length > 0, listed);
  if (candidates.length === 0) throw new Error('no instrument track is visible');

  const connection = await call('check_connection') as {
    rows?: { addressable: number; inProject: number | null };
  };
  const count = Math.min(
    connection.rows?.addressable ?? 0,
    connection.rows?.inProject ?? connection.rows?.addressable ?? 0,
  );
  const scanned: { name: string; emptyRows: number[] }[] = [];
  for (const track of candidates) {
    const empty: boolean[] = [];
    for (let row = 0; row < count; row++) {
      const state = await call('read_clip', { trackId: track.trackId, row });
      empty.push(state['readable'] === true && state['clipExists'] === false);
    }
    scanned.push({
      name: track.name,
      emptyRows: empty.flatMap((isEmpty, row) => isEmpty ? [row] : []),
    });
    for (let start = 0; start <= empty.length - 5; start++) {
      if (empty.slice(start, start + 5).every(Boolean)) {
        trackId = track.trackId;
        firstRow = start + 1;
        break;
      }
    }
    if (firstRow !== undefined) break;
  }
  check('3e-P1: five consecutive empty rows are positively read before mutation',
    firstRow !== undefined, { count, scanned });
  if (firstRow === undefined) throw new Error('no five-row empty region');

  const created = await call('add_clip', {
    clips: [{
      trackId,
      row: firstRow,
      lengthBeats: 16,
      notes: [{ startBeats: 0, pitch: 61, velocity: 100, durationBeats: 1 }],
    }],
  });
  check('3e-P2: a source clip is created through the production surface', applied(created), created);

  const copied = await call('copy_clip_down', {
    trackId,
    row: firstRow,
    quantization: '1',
    mode: 'continue_or_synced',
    useLoopStartAsQuantizationReference: false,
  });
  check('3e-P3: copy lands only after the next row is verified empty',
    applied(copied) && copied['clickLaunchVerified'] === true, copied);

  const geometry = await call('inspect_clip_block', {
    trackId, firstRow, lastRow: firstRow + 1,
  });
  check('3e-P4: copied clips are contiguous and bounded by empty slots',
    geometry['contiguous'] === true && geometry['boundedByEmptySlots'] === true, geometry);

  const sourceLaunch = await call('launch_clip', {
    trackId, row: firstRow, quantization: 'none', mode: 'from_start',
  });
  const alternateLaunch = await call('launch_clip', {
    trackId, row: firstRow + 1, quantization: 'none', mode: 'continue_or_synced',
  });
  const playback = alternateLaunch['playback'] as {
    isPlaying?: boolean; playingStep?: number; playPosition?: number;
  } | undefined;
  check('3e-P5: production launch reports the incoming clip playing with numeric position',
    applied(sourceLaunch) && applied(alternateLaunch)
      && playback?.isPlaying === true
      && typeof playback.playingStep === 'number'
      && typeof playback.playPosition === 'number',
    { sourceLaunch, alternateLaunch });
  await stopTransport();

  const moved = await call('move_clip_block', {
    trackId, firstRow, lastRow: firstRow + 1, destinationFirstRow: firstRow + 1,
  });
  check('3e-P6: an overlapping block move lands through the production surface',
    applied(moved), moved);

  const reverse = moved['reverse'] as Record<string, unknown> | undefined;
  const reverseTool = reverse?.['tool'];
  const reverseArgs = reverse === undefined
    ? undefined
    : Object.fromEntries(Object.entries(reverse).filter(([key]) => key !== 'tool'));
  const reversed = typeof reverseTool === 'string' && reverseArgs !== undefined
    ? await call(reverseTool, reverseArgs)
    : {};
  check('3e-P7: the exact reverse call reported by the move restores the block',
    applied(reversed), { reverse, reversed });
} catch (error) {
  check('3e-PX: the live production smoke completed without an unexpected failure', false, {
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  });
} finally {
  try { await cleanup(); } catch (error) {
    check('3e-P8: cleanup completed without an unexpected failure', false, {
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
  }
  try { await mcp.close(); } catch { /* process may already be closed */ }
  bridge.disconnect();
}

note(`Phase 3e production smoke: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
