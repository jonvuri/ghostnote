/**
 * B18 live acceptance: a read's note IDs survive CONTENT_LOG Launcher content events and re-mint, visibly, one
 * event past the bound. Derived from the E393 driver (`r01-r3-event-window.ts`), which stays as recorded.
 *
 * The driver owns one scratch instrument track. It writes a seed clip at row 0 through the product tools and reads
 * it, then churns rows 1..K of the scratch track until an exact number of content events follows the last read of
 * row 0, and reads row 0 again. Product tools cost about 0.9 s per event (ledger), so the churn uses the raw
 * normal-profile `slot.copyTo` (row 0 to an empty row) and `slot.delete` on the scratch track only, after
 * confirming the track index by channelId. Each phase waits until the content epoch reaches exactly its target;
 * any extra event aborts the run. It also measures `revision.get` reply bytes and time for a plain mark and for
 * windows of each size. At the end it deletes the scratch track and checks that the track list matches entry.
 *
 *   b18-event-window.ts <expected project name> [targets, default 24,25,1000,max,max+1]
 */
import assert from 'node:assert/strict';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { CONTENT_LOG } from '../contract/index.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { WireTransport, type Call } from './phase8h3c-promotion.js';

type Wire = Record<string, any>;
const [expectedProject, targetArg] = process.argv.slice(2);
if (expectedProject === undefined) throw new Error('Usage: b18-event-window.ts <expected project name> [targets]');
const TARGETS = (targetArg ?? '24,25,1000,max,max+1').split(',').map((t) =>
  t === 'max' ? CONTENT_LOG : t === 'max+1' ? CONTENT_LOG + 1 : Number(t));
assert.ok(TARGETS.every((t) => Number.isInteger(t) && t > 0), `targets: ${TARGETS}`);
// B18 adds no wire method: the normal surface keeps B17's 93 methods and hash. rig.info carries the marker.
const NORMAL = ['normal-v1', 93, 'd6decf985f6b1f36'];
const TRACK = 'gn-b18-window';
/** Churn rows per round. Rows must already exist; a copy past the scene count could add a scene. */
const MAX_ROWS = 16;

const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
  observationStore: new FakeObservationStore(),
});
const log: Wire[] = [];
const note = (entry: Wire): void => { log.push(entry); console.error(JSON.stringify(entry)); };
const raw = async (method: string, params?: Wire, owned?: Call[]): Promise<Wire> =>
  await transport.sendRecorded({ method, ...(params ? { params } : {}) }, owned) as Wire;
const epoch = async (): Promise<number> => (await raw('revision.get')).contentEpoch as number;

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
let trackIndex = -1;
const filled = new Set<number>();
const entryTracks: Wire[] = [];
const replyCosts: Wire[] = [];
let churnOps = 0;
let churnMs = 0;
try {
  const hello = await raw('contract.hello');
  assert.deepEqual([hello['runtimeProfile'], hello['methodCount'], hello['methodsHash']], NORMAL, 'normal build');
  const info = await raw('rig.info');
  assert.equal(info['contentLog'], CONTENT_LOG, 'B18 build marker');
  await adapter.hello();
  const connection = await call('check_bitwig_connection', {});
  const project = connection.data?.project ?? connection.target?.project;
  assert.equal(project, expectedProject, `foreground project is ${project}`);
  entryTracks.push(...await trackRows());
  assert.ok(!entryTracks.some((t) => t.name === TRACK), 'scratch track name already exists');
  const entrySelection = await raw('selection.status');
  const entryMark = await adapter.revision();
  const scenes = entryMark.window.scenes.count;
  const rows = Math.min(MAX_ROWS, scenes - 1);
  assert.ok(rows >= 1, `the project needs at least two scenes (${scenes})`);
  note({ step: 'entry', project, tracks: entryTracks.length, scenes, churnRows: rows, contentLog: info['contentLog'],
    epoch: entryMark.contentEpoch, sceneEpoch: entryMark.sceneEpoch, selection: entrySelection });

  const added = await call('add_tracks', { tracks: [{ name: TRACK }] });
  trackId = (added.readback?.tracks ?? added.data?.tracks)[0].trackId as string;
  assert.ok(trackId, 'new trackId');
  const seeded = await call('add_launcher_clip', { trackId, row: 0, document: seed(60) });
  assert.equal(seeded.readback?.status, 'verified');

  const locate = async (): Promise<void> => {
    const listed = await raw('track.list');
    const matches = (listed.tracks as Wire[]).filter((t) => t.channelId === trackId);
    assert.equal(matches.length, 1, 'the scratch track is in the bank once');
    trackIndex = matches[0]!.index as number;
  };
  await locate();
  note({ step: 'track', trackId, trackIndex });

  /** Poll until the epoch equals `expected`. Any overshoot is an unexpected event and aborts. */
  async function settle(expected: number): Promise<void> {
    const deadline = performance.now() + 15_000;
    for (;;) {
      const now = await epoch();
      assert.ok(now <= expected, `unexpected content events: epoch ${now}, expected ${expected}`);
      if (now === expected) return;
      assert.ok(performance.now() < deadline, `epoch stuck at ${now}, expected ${expected}`);
    }
  }

  /** Churn rows 1..rows of the scratch track until exactly `target` content events follow `since`. */
  async function churn(since: number, target: number, label: string): Promise<number> {
    const started = performance.now();
    let now = await epoch();
    assert.ok(now - since <= target, `${label}: already ${now - since} events past the read`);
    let rounds = 0;
    while (now - since < target) {
      if (rounds++ % 64 === 0) await locate();
      const remaining = target - (now - since);
      if (filled.size > 0) {
        const batch = [...filled].slice(0, remaining);
        const replies = await Promise.all(batch.map((row) => raw('slot.delete', { trackIndex, slotIndex: row })));
        assert.equal(replies.length, batch.length);
        for (const row of batch) filled.delete(row);
        await settle(now + batch.length);
        now += batch.length;
      } else {
        const batch = Array.from({ length: Math.min(rows, remaining) }, (_, k) => k + 1);
        const replies = await Promise.all(batch.map((row) => raw('slot.copyTo',
          { trackIndex, slotIndex: 0, toTrackIndex: trackIndex, toSlotIndex: row })));
        for (const reply of replies) {
          assert.equal(reply['sourceHadContent'], true, 'copy source is the seed');
          assert.equal(reply['destHadContent'], false, 'copy destination is empty');
        }
        for (const row of batch) filled.add(row);
        await settle(now + batch.length);
        now += batch.length;
      }
      churnOps += 1;
    }
    const ms = performance.now() - started;
    churnMs += ms;
    note({ step: `${label}-churn`, events: now - since, ms: Math.round(ms), filledRows: filled.size });
    return now - since;
  }

  /** `revision.get` reply bytes and round-trip time for a plain mark and for the window since `since`. */
  async function measure(since: number, label: string): Promise<void> {
    const owned: Call[] = [];
    for (let k = 0; k < 5; k++) {
      await raw('revision.get', undefined, owned);
      await raw('revision.get', { since }, owned);
    }
    const of = (withSince: boolean) => owned.filter((c) => (c.params?.['since'] !== undefined) === withSince);
    const summary = (calls: Call[]) => {
      const ms = calls.map((c) => c.received - c.sent).sort((a, b) => a - b);
      return { bytes: calls[0]!.bytes, events: (calls[0]!.reply.result?.contentEvents ?? []).length,
        medianMs: Number(ms[Math.floor(ms.length / 2)]!.toFixed(2)), maxMs: Number(ms[ms.length - 1]!.toFixed(2)) };
    };
    const entry = { label, window: (await epoch()) - since, mark: summary(of(false)), delta: summary(of(true)) };
    replyCosts.push(entry);
    note({ step: `${label}-reply-cost`, ...entry });
  }

  async function readRow0(label: string): Promise<{ result: Wire; at: number }> {
    const before = await epoch();
    const started = performance.now();
    const result = await call('read_launcher_clip', { trackId, row: 0 });
    const ms = performance.now() - started;
    const at = await epoch();
    assert.equal(at, before, `${label}: content changed during the read`);
    note({ step: label, at, ms: Math.round(ms), ...identityOf(result) });
    return { result, at };
  }

  let last = await readRow0('read-base');
  const baseIds = identityOf(last.result).ids;
  let previousIds = baseIds;
  const summary: Wire[] = [];
  for (const target of TARGETS) {
    const label = `T${target}`;
    const gap = await churn(last.at, target, label);
    await measure(last.at, label);
    const sceneEpoch = (await adapter.revision()).sceneEpoch;
    assert.equal(sceneEpoch, entryMark.sceneEpoch, 'no scene changed');
    const priorRef = identityOf(last.result).ref;
    last = await readRow0(`${label}-read-after-${gap}`);
    const facts = identityOf(last.result);
    summary.push({ target, gap, identity: facts.identity, sameIds: JSON.stringify(facts.ids) === JSON.stringify(previousIds),
      sameRef: facts.ref === priorRef, retiredRefs: facts.retiredRefs,
      warnings: (facts.warnings as Wire[] | undefined)?.map((w) => w.code) });
    previousIds = facts.ids;
  }

  console.log(JSON.stringify({ version: 'b18-event-window-v1', date: new Date().toISOString(), build: NORMAL,
    contentLog: CONTENT_LOG, project, scenes, churnRows: rows, baseIds, summary, replyCosts,
    churn: { phases: churnOps, ms: Math.round(churnMs) }, log }, null, 2));
} finally {
  if (trackId !== undefined) {
    try {
      for (const row of [...filled]) {
        await raw('slot.delete', { trackIndex, slotIndex: row });
        filled.delete(row);
      }
      await call('delete_track', { trackIds: [trackId] });
      const after = await trackRows();
      const key = (rows: Wire[]): string => JSON.stringify(rows.map((t) => [t.trackId, t.name]));
      assert.equal(key(after), key(entryTracks), 'final track list differs from entry');
      const selection = await raw('selection.status');
      console.error(JSON.stringify({ step: 'cleanup', tracks: after.length, matchesEntry: true, selection }));
    } catch (error) {
      console.error(JSON.stringify({ step: 'cleanup-failed', trackId, error: String(error) }));
      process.exitCode = 1;
    }
  }
  await transport.close?.();
}
