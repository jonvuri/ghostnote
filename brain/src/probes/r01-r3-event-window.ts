/**
 * R01 round 3 (E393 follow-up): does a read's identity survive exactly 24 Launcher content events and
 * re-mint at 25 (the extension's CONTENT_LOG ring), and does concurrency change the outcome?
 *
 * The driver owns one scratch instrument track. It writes a seed clip at row 0 and reads it, then
 * churns row 1 with add/delete pairs until an exact number of content events follows the last read
 * of row 0, and reads row 0 again. It deletes the scratch track at the end and checks that the track
 * list matches the entry state.
 *
 *   r01-r3-event-window.ts <expected project name>
 */
import assert from 'node:assert/strict';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { WireTransport } from './phase8h3c-promotion.js';

type Wire = Record<string, any>;
const [expectedProject] = process.argv.slice(2);
if (expectedProject === undefined) throw new Error('Usage: r01-r3-event-window.ts <expected project name>');
// The deployed build is main's B17 normal build (93 methods); this probe's paths are unchanged from 92.
const NORMAL = ['normal-v1', 93, 'd6decf985f6b1f36'];
const TRACK = 'gn-r3-window';

const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
  observationStore: new FakeObservationStore(),
});
const log: Wire[] = [];
const note = (entry: Wire): void => { log.push(entry); console.error(JSON.stringify(entry)); };
const epoch = async (): Promise<number> => (await adapter.revision()).contentEpoch;

async function call(tool: string, args: Wire): Promise<Wire> {
  const result = await callTool(workspace, tool, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  if (result.failure !== undefined) throw new Error(`${tool}: ${JSON.stringify(result.failure).slice(0, 800)}`);
  return result;
}
const trackRows = async (): Promise<Wire[]> => {
  const listed = await call('list_tracks', {});
  return (listed.data?.tracks ?? listed.tracks ?? []) as Wire[];
};
const seed = (pitch: number): string => [
  'DOC ghostnote-document 1.0 desired',
  'CLIP {"id":"part","length":"4"}',
  'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"part","fields":"all","from":"0","status":"complete","to":"4"}',
  'FIELDS id clip at duration pitch velocity channel mute',
  `EVENT n1 part 0 1 ${pitch} 100 1 false`,
  `EVENT n2 part 1 1 ${pitch + 4} 100 1 false`,
  '',
].join('\n');

function identityOf(result: Wire): Wire {
  const a = result.authority ?? {};
  const ids = ((result.data?.document ?? '') as string).split('\n')
    .filter((line) => line.startsWith('EVENT ')).map((line) => line.split(' ')[1]);
  return { identity: a.identity, retained: a.retainedIds, minted: a.mintedIds, retiredRefs: a.retiredRefs,
    ref: a.base?.ref, ids, warnings: result.warnings };
}

let trackId: string | undefined;
let churnOccupied = false;
const entryTracks: Wire[] = [];
try {
  const hello = await transport.send({ method: 'contract.hello' }) as Wire;
  assert.deepEqual([hello['runtimeProfile'], hello['methodCount'], hello['methodsHash']], NORMAL, 'normal build');
  const mark = await transport.send({ method: 'revision.get' }) as Wire;
  await adapter.hello();
  const connection = await call('check_bitwig_connection', {});
  const project = connection.data?.project ?? connection.target?.project;
  assert.equal(project, expectedProject, `foreground project is ${project}`);
  entryTracks.push(...await trackRows());
  assert.ok(!entryTracks.some((t) => t.name === TRACK), 'scratch track name already exists');
  note({ step: 'entry', project, tracks: entryTracks.length, epoch: await epoch(), revisionMark: mark.revision });

  const added = await call('add_tracks', { tracks: [{ name: TRACK }] });
  trackId = (added.readback?.tracks ?? added.data?.tracks)[0].trackId as string;
  assert.ok(trackId, 'new trackId');
  note({ step: 'track', trackId });
  const seeded = await call('add_launcher_clip', { trackId, row: 0, document: seed(60) });
  assert.equal(seeded.readback?.status, 'verified');

  // Churn row 1 until exactly `target` content events follow `since`; each op's event count is logged.
  async function churn(since: number, target: number, label: string): Promise<number> {
    let now = await epoch();
    assert.ok(now - since <= target, `${label}: already ${now - since} events past the read`);
    while (now - since < target) {
      const before = now;
      if (churnOccupied) {
        await call('delete_launcher_clip', { clips: [{ trackId, row: 1 }] });
        churnOccupied = false;
      } else {
        await call('add_launcher_clip', { trackId, row: 1, document: seed(48) });
        churnOccupied = true;
      }
      now = await epoch();
      note({ step: `${label}-op`, op: churnOccupied ? 'add' : 'delete', events: now - before, sinceRead: now - since });
    }
    return now - since;
  }

  async function readRow0(label: string): Promise<{ result: Wire; at: number }> {
    const before = await epoch();
    const result = await call('read_launcher_clip', { trackId, row: 0 });
    const at = await epoch();
    assert.equal(at, before, `${label}: content changed during the read`);
    note({ step: label, at, ...identityOf(result) });
    return { result, at };
  }

  let last = await readRow0('read-base');
  const baseIds = identityOf(last.result).ids;

  // A: exactly 24 events, then a sequential read.
  let gap = await churn(last.at, 24, 'A');
  last = await readRow0(`A-read-after-${gap}`);
  const a = identityOf(last.result);

  // B: exactly 25 events, then a sequential read.
  gap = await churn(last.at, 25, 'B');
  last = await readRow0(`B-read-after-${gap}`);
  const b = identityOf(last.result);

  // C: exactly 24 events, then five concurrent reads.
  gap = await churn(last.at, 24, 'C');
  const cBefore = await epoch();
  const concurrentC = await Promise.all(Array.from({ length: 5 }, () => call('read_launcher_clip', { trackId, row: 0 })));
  const cAfter = await epoch();
  assert.equal(cAfter, cBefore, 'C: content changed during the reads');
  const c = concurrentC.map(identityOf);
  note({ step: `C-concurrent-after-${gap}`, reads: c });
  last = { result: concurrentC[concurrentC.length - 1]!, at: cAfter };

  // D: exactly 25 events, then five concurrent reads.
  gap = await churn(last.at, 25, 'D');
  const dBefore = await epoch();
  const concurrentD = await Promise.all(Array.from({ length: 5 }, () => call('read_launcher_clip', { trackId, row: 0 })));
  assert.equal(await epoch(), dBefore, 'D: content changed during the reads');
  const d = concurrentD.map(identityOf);
  note({ step: `D-concurrent-after-${gap}`, reads: d });

  console.log(JSON.stringify({ version: 'r01-r3-event-window-v1', date: new Date().toISOString(), build: NORMAL,
    project, baseIds,
    summary: {
      A24: { identity: a.identity, sameIds: JSON.stringify(a.ids) === JSON.stringify(baseIds) },
      B25: { identity: b.identity, retiredRefs: b.retiredRefs, sameIds: JSON.stringify(b.ids) === JSON.stringify(a.ids) },
      C24concurrent: c.map((r) => ({ identity: r.identity, ids: r.ids })),
      D25concurrent: d.map((r) => ({ identity: r.identity, ids: r.ids, retiredRefs: r.retiredRefs })),
    },
    log }, null, 2));
} finally {
  if (trackId !== undefined) {
    try {
      if (churnOccupied) await call('delete_launcher_clip', { clips: [{ trackId, row: 1 }] });
      await call('delete_track', { trackIds: [trackId] });
      const after = await trackRows();
      const key = (rows: Wire[]): string => JSON.stringify(rows.map((t) => [t.trackId, t.name]));
      assert.equal(key(after), key(entryTracks), 'final track list differs from entry');
      console.error(JSON.stringify({ step: 'cleanup', tracks: after.length, matchesEntry: true }));
    } catch (error) {
      console.error(JSON.stringify({ step: 'cleanup-failed', trackId, error: String(error) }));
      process.exitCode = 1;
    }
  }
  transport.close?.();
}
