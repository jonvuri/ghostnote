/**
 * 8i19 live read check (E269). Read one occupied Launcher clip of the open project, inline and with
 * documentOutputPath, alternately. The driver makes no project write; its document files are removed.
 *
 *   phase8i19-live-read.ts <track name> <row> [runs]
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { assertCurrentNormal } from './phase8h4f-measure.js';
import { WireTransport } from './phase8h3c-promotion.js';

type Wire = Record<string, any>;
const [trackName, rowText, runsText = '3'] = process.argv.slice(2);
if (trackName === undefined || rowText === undefined) throw new Error('Usage: phase8i19-live-read.ts <track name> <row> [runs]');
const row = Number(rowText), runs = Number(runsText);

const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
  observationStore: new FakeObservationStore(),
});
const directory = await mkdtemp(join(tmpdir(), 'gn-8i19-live-'));
const steps: Wire[] = [];
async function call(step: string, tool: string, args: Wire): Promise<Wire> {
  const from = transport.calls.length, started = performance.now();
  const result = await callTool(workspace, tool, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const entry = { step, tool, ms: Math.round(performance.now() - started), bytes: Buffer.byteLength(JSON.stringify(result)),
    wire: transport.calls.length - from, ...(result.timing === undefined ? {} : { readMs: Math.round(result.timing.readMs) }) };
  steps.push(entry); console.error(JSON.stringify(entry));
  assert.equal(result.failure, undefined, JSON.stringify(result).slice(0, 600));
  return result;
}

try {
  const hello = await transport.send({ method: 'contract.hello' }) as Wire;
  assertCurrentNormal(hello);
  const mark = await transport.send({ method: 'revision.get' }) as Wire;
  await adapter.hello();
  const tracks = await call('tracks', 'list_tracks', {});
  const matching = (tracks.data?.tracks ?? tracks.tracks ?? []).filter((item: Wire) => item.name === trackName);
  assert.equal(matching.length, 1, `track ${trackName}: ${matching.length} matches`);
  const trackId = matching[0].trackId as string;
  let inline: Wire | undefined;
  for (let run = 0; run < runs; run += 1) {
    inline = await call(`inline-${run}`, 'read_launcher_clip', { trackId, row });
    const path = join(directory, `${run}.gndoc`);
    const filed = await call(`file-${run}`, 'read_launcher_clip', { trackId, row, documentOutputPath: path });
    assert.equal(filed.data.documentFile.readback.status, 'verified');
    assert.equal(await readFile(path, 'utf8'), inline.data.document);
    assert.deepEqual(filed.authority.base, inline.authority.base);
  }
  const notes = (inline!.data.document as string).split('\n').filter((line) => line.startsWith('EVENT ')).length;
  console.log(JSON.stringify({ version: '8i19-live-read-v1', date: new Date().toISOString(),
    build: [hello['runtimeProfile'], hello['methodCount'], hello['methodsHash']], project: mark.project,
    target: { track: trackName, row }, notes, documentBytes: Buffer.byteLength(inline!.data.document), steps }, null, 2));
} finally {
  await rm(directory, { recursive: true, force: true });
  transport.close?.();
}
