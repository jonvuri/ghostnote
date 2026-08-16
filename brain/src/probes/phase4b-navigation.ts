/** Focused live check for explicit navigation from a recorded clip change. */
import { createInterface } from 'node:readline/promises';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { check, client as bridge, failureCount, note } from './lib.js';

const transport = new StdioClientTransport({ command: 'npx', args: ['tsx', 'src/mcp-server.ts'] });
const mcp = new Client({ name: 'phase4b-navigation-probe', version: '0.0.1' });
const readline = createInterface({ input: process.stdin, output: process.stdout });

const parse = (result: unknown): Record<string, unknown> => {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  const payload = content.find((part) => part.type === 'text')?.text ?? '{}';
  return JSON.parse(payload) as Record<string, unknown>;
};
const call = async (name: string, args: Record<string, unknown> = {}) =>
  parse(await mcp.callTool({ name, arguments: args }));

let trackId: string | undefined;
let rows: number[] = [];
let observationBefore = '';

async function restoreStatus(): Promise<void> {
  const at = await bridge.request('revision.get') as { generation?: string; project?: string };
  const restored = await bridge.request('status.push', {
    value: 'Change · 4a-live-check',
    expectedGeneration: at.generation,
    expectedProject: at.project,
  }) as { accepted?: boolean };
  check('4b-P8: Last change returns to the documented baseline', restored.accepted === true, restored);
}

async function cleanup(): Promise<void> {
  if (trackId !== undefined && rows.length > 0) {
    const occupied: { trackId: string; row: number }[] = [];
    for (const row of rows) {
      const state = await call('read_clip', { trackId, row });
      if (state['clipExists'] === true) occupied.push({ trackId, row });
    }
    if (occupied.length > 0) await call('delete_clip', { clips: occupied });
    const final = await Promise.all(rows.map((row) => call('read_clip', { trackId, row })));
    check('4b-P7: every probe clip is removed', final.every((item) => item['clipExists'] === false), final);
  }
  await restoreStatus();
  if (observationBefore !== '') {
    const after = await call('read_observation_record');
    check('4b-P9: navigation leaves the observation record exact',
      after['canonicalJson'] === observationBefore, after);
  }
}

try {
  await bridge.connect();
  await mcp.connect(transport);
  const observation = await call('read_observation_record');
  observationBefore = observation['canonicalJson'] as string;

  const listed = await call('list_tracks') as {
    tracks?: { trackId: string; name: string; kind: string }[];
  };
  const tracks = (listed.tracks ?? [])
    .filter((track) => track.kind === 'Instrument' || track.kind === 'Hybrid')
    .sort((left, right) => Number(right.name === 'gn-A') - Number(left.name === 'gn-A'));
  const connection = await call('check_connection') as {
    rows?: { addressable: number; inProject: number | null };
  };
  const rowCount = Math.min(
    connection.rows?.addressable ?? 0,
    connection.rows?.inProject ?? connection.rows?.addressable ?? 0,
  );
  for (const track of tracks) {
    const empty: number[] = [];
    for (let row = 0; row < rowCount; row += 1) {
      const state = await call('read_clip', { trackId: track.trackId, row });
      if (state['readable'] === true && state['clipExists'] === false) empty.push(row);
      if (empty.length === 2) break;
    }
    if (empty.length === 2) {
      trackId = track.trackId;
      rows = empty;
      break;
    }
  }
  check('4b-P0: two empty launcher targets are positively read',
    trackId !== undefined && rows.length === 2, { trackId, rows });
  if (trackId === undefined || rows.length !== 2) throw new Error('no two empty launcher rows');

  const created = await call('add_clip', {
    clips: rows.map((row, index) => ({
      trackId,
      row,
      lengthBeats: 16,
      notes: [
        { startBeats: 0, pitch: 36 + index * 12, velocity: 100, durationBeats: 1 },
        { startBeats: 15, pitch: 84 - index * 12, velocity: 100, durationBeats: 1 },
      ],
    })),
  });
  check('4b-P1: one recorded change creates two clip targets',
    created['applied'] === true && typeof created['changeId'] === 'string', created);

  const ambiguous = await call('show_changed_clip', { changeId: created['changeId'] });
  check('4b-P2: an ambiguous change returns both candidates and does not navigate',
    ambiguous['ambiguous'] === true
      && Array.isArray(ambiguous['availableTargets'])
      && ambiguous['availableTargets'].length === 2,
    ambiguous);

  const selectedTarget = { trackId, row: rows[1] };
  const beforeCount = (await call('list_changes') as { changes?: unknown[] }).changes?.length;
  const shown = await call('show_changed_clip', {
    changeId: created['changeId'], target: selectedTarget,
  });
  const afterCount = (await call('list_changes') as { changes?: unknown[] }).changes?.length;
  check('4b-P3: an explicit durable target requests Edit layout and navigation',
    shown['navigated'] === true
      && shown['layoutRequested'] === 'EDIT',
    shown);
  check('4b-P4: UI focus creates no recorded project change', beforeCount === afterCount,
    { beforeCount, afterCount });

  console.log('Confirm in Bitwig:');
  console.log(`  1. The detail editor shows launcher row ${rows[1] + 1} on the selected track.`);
  console.log('  2. Bitwig is in the Edit layout.');
  console.log('  3. Both notes fit in the editor view.');
  const confirmation = await readline.question('Type yes after all three checks pass: ');
  check('4b-P5: the editor target, layout, and fitted content are confirmed by the operator',
    confirmation.trim().toLowerCase() === 'yes', { confirmation });

  const deleted = await call('delete_clip', { clips: [{ trackId, row: rows[0] }] });
  const missing = await call('show_changed_clip', { changeId: deleted['changeId'] });
  check('4b-P6: a recorded target with no current clip refuses without redirecting',
    missing['navigated'] === false && /no longer holds a clip/.test(String(missing['why'])), missing);
} catch (error) {
  check('4b-PX: the focused live check completed without an unexpected failure', false, {
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  });
} finally {
  try { await cleanup(); } catch (error) {
    check('4b-P7: cleanup completed without an unexpected failure', false, {
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
  }
  readline.close();
  try { await mcp.close(); } catch { /* process may already be closed */ }
  bridge.disconnect();
}

note(`Phase 4b navigation: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
process.exit(failureCount() === 0 ? 0 : 1);
