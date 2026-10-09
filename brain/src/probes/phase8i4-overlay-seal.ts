/**
 * 8i4 overlay basis sealing (E253, D45). Live driver, normal profile, owned unsaved project (refuses the saved
 * anchor, D29). It works only on a track that it adds, and deletes that track at the end.
 *
 *   seal <dir>    a control whole-clip velocity edit, then agent-shaped claims without basis on one clip: a put of
 *                 a nominal and a dependent groove claim
 *                 in the call that moves their note, a later read, an unrelated edit (current), a dependency edit
 *                 (stale, not resealed), and a remove of both claims (no note change). Then it reverts every
 *                 write. Writes seal.json with each call and its wire sequence.
 *
 * Each call records the wall time, the turns, the cold reads, the write stages, and the wire sequence
 * (method, start, duration).
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { dependencyBasis, parse, type StateDocument } from '../document/index.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { WireTransport } from './phase8h3c-promotion.js';
import { typicalDesired, wireSummary } from './phase8h4g-inventory.js';
import { NORMAL_8H4F } from './phase8h4f-measure.js';

type Wire = Record<string, any>;
const SCHEMA = 'phase8i4-overlay-seal-v1';
const ANCHOR = 'gn-scale-test';
const TRACK = 'gn-8i4-seal';

const say = (value: unknown): void => console.log(JSON.stringify(value));

/** Literal claims without basis, as an agent writes them. */
const nominal = (event: string, at: string, duration: string) => JSON.stringify({
  id: 'nom1', type: 'nominal', state: 'current', provenance: { kind: 'declared', source: 'agent', method: 'author' },
  depends: { events: [{ id: event, fields: ['clip', 'at', 'duration'] }], clips: [], overlays: [], membership: [] },
  data: { event, at, duration, division: '1/4' },
});
const groove = (event: string, late: string) => JSON.stringify({
  id: 'groove1', type: 'groove', state: 'current', provenance: { kind: 'declared', source: 'agent', method: 'author' },
  depends: { events: [{ id: event, fields: ['clip', 'at', 'duration'] }], clips: [], overlays: ['nom1'], membership: [] },
  data: { event, nominal: 'nom1', atDelta: null, durationDelta: null, intent: 'unresolved', phase: '0', template: '0',
    cross: '0', local: '0', unassigned: late, durationIntent: '0', durationUnassigned: '0' },
});

const patch = (base: Wire, lines: string[]) => ['DOC ghostnote-document 1.0 patch',
  `BASE ${JSON.stringify({ sha256: base.sha256, ref: base.ref })}`,
  'FIELDS id clip at duration pitch velocity channel mute', ...lines].join('\n') + '\n';

const states = (document: StateDocument) => document.overlays.map((item) => [item.id, item.state]);

function assertSealed(document: StateDocument): void {
  for (const claim of document.overlays.filter((item) => item.state === 'current')) {
    assert.equal(claim.basis, dependencyBasis(document, claim), `${claim.id} has the R22 basis`);
  }
}

async function seal(dir: string): Promise<void> {
  const transport = new WireTransport();
  const adapter = new LiveAdapter({ transport });
  const workspace = workspaceOf({
    ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
    observationStore: new FakeObservationStore(),
  });
  const request = async (method: string, params?: Wire): Promise<Wire> =>
    await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
  const rows: Wire[] = [];
  const call = async (step: string, tool: string, args: Wire): Promise<Wire> => {
    const from = transport.calls.length;
    const started = performance.now();
    const result = await callTool(workspace, tool, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
    const ms = performance.now() - started;
    const calls = transport.calls.slice(from);
    const wire = wireSummary(calls);
    const row = { step, tool, ok: result.failure === undefined, ms: Math.round(ms), calls: calls.length,
      turns: wire.turns, wireMs: wire.wireMs, clipReads: wire.clipReads, stages: wire.stages,
      route: result.plan?.route, timing: result.timing,
      sequence: calls.map((item) => [item.method, Math.round(item.sent - started),
        Math.round((item.received < 0 ? item.sent : item.received) - item.sent)]) };
    rows.push(row);
    say({ ...row, sequence: undefined });
    assert(row.ok, `${step} ${tool}: ${JSON.stringify(result).slice(0, 800)}`);
    return result;
  };

  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [...NORMAL_8H4F]);
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project) && mark.project !== ANCHOR, `use an owned unsaved project, got ${mark.project}`);
  await adapter.hello();
  const tracksBefore = ((await request('track.list')).tracks as Wire[]).map((row) => row.name);
  assert(!tracksBefore.includes(TRACK), `${TRACK} is left from an earlier run; delete it first`);
  const trackId = (await call('add-track', 'add_tracks', { tracks: [{ name: TRACK }] })).readback.tracks[0].trackId as string;
  const at = { trackId, row: 0 };
  const read = async (step: string) => {
    const result = await call(step, 'read_launcher_clip', at);
    return { result, document: parse(result.data.document as string, 'fields') as StateDocument };
  };
  const changes: string[] = [];
  const findings: Wire = { project: mark.project };
  try {
    const added = await call('add-clip', 'add_launcher_clip', { ...at, document: typicalDesired() });
    for (const effect of added.effects as Wire[]) changes.push(effect.changeId);

    // Control: the same whole-clip velocity edit before the subject moves off the 1/4 grid.
    const control = await read('read-0');
    const [, controlOther] = control.document.events;
    const controlEdit = await call('control-edit', 'edit_launcher_clip', { ...at,
      document: patch(control.result.authority.base, [`UPDATE ${controlOther!.id} {"velocity":42}`]) });
    for (const effect of controlEdit.effects as Wire[]) changes.push(effect.changeId);

    const first = await read('read-1');
    const [subject, other] = first.document.events;
    assert(subject !== undefined && other !== undefined);
    const late = '1/16';
    // The call moves the subject late by 1/16 and states its nominal onset and groove (agent input, no basis).
    const lateAt = addRational(subject.at, late);
    const put = await call('put-claims', 'edit_launcher_clip', { ...at, readback: 'document',
      document: patch(first.result.authority.base, [`UPDATE ${subject.id} {"at":"${lateAt}"}`,
        `OVERLAY_PUT ${nominal(subject.id, subject.at, subject.duration)}`, `OVERLAY_PUT ${groove(subject.id, late)}`]) });
    for (const effect of put.effects as Wire[]) changes.push(effect.changeId);
    const written = parse(put.readback.document, 'fields') as StateDocument;
    assert.equal(put.readback.status, 'verified', JSON.stringify(put.readback));
    assert.deepEqual(states(written), [['groove1', 'current'], ['nom1', 'current']]);
    assertSealed(written);
    findings.put = { status: put.readback.status, route: put.plan.route, overlays: written.overlays };

    const second = await read('read-2');
    assert.deepEqual(JSON.parse(JSON.stringify(second.document.overlays)), JSON.parse(JSON.stringify(written.overlays)));
    assertSealed(second.document);

    const unrelated = await call('unrelated-edit', 'edit_launcher_clip', { ...at,
      document: patch(second.result.authority.base, [`UPDATE ${other.id} {"velocity":41}`]) });
    for (const effect of unrelated.effects as Wire[]) changes.push(effect.changeId);
    const third = await read('read-3');
    assert.deepEqual(states(third.document), [['groove1', 'current'], ['nom1', 'current']]);
    findings.unrelated = states(third.document);

    const dependency = await call('dependency-edit', 'edit_launcher_clip', { ...at,
      document: patch(third.result.authority.base, [`UPDATE ${subject.id} {"duration":"1/16"}`]) });
    for (const effect of dependency.effects as Wire[]) changes.push(effect.changeId);
    const fourth = await read('read-4');
    assert.deepEqual(states(fourth.document), [['groove1', 'stale'], ['nom1', 'stale']]);
    assert.deepEqual(fourth.document.overlays.map((item) => item.basis), written.overlays.map((item) => item.basis),
      'stale claims keep their sealed basis');
    findings.dependency = states(fourth.document);

    const removed = await call('remove-claims', 'edit_launcher_clip', { ...at,
      document: patch(fourth.result.authority.base, ['OVERLAY_REMOVE groove1', 'OVERLAY_REMOVE nom1']) });
    assert.deepEqual(removed.effects, [], 'a claim remove has no host effect');
    const fifth = await read('read-5');
    assert.deepEqual(fifth.document.overlays, []);
    assert.deepEqual(JSON.parse(JSON.stringify(fifth.document.events)), JSON.parse(JSON.stringify(fourth.document.events)),
      'a claim remove changes no note');
    findings.removed = { effects: removed.effects.length, notesUnchanged: true };

    for (const changeId of [...changes].reverse()) await call(`revert-${changeId}`, 'revert_change', { changeId });
    changes.length = 0;
  } finally {
    await call('delete-track', 'delete_track', { trackIds: [trackId] });
    const tracksAfter = ((await request('track.list')).tracks as Wire[]).map((row) => row.name);
    findings.baseline = JSON.stringify(tracksAfter) === JSON.stringify(tracksBefore);
    await transport.close();
  }
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'seal.json'), JSON.stringify({ schema: SCHEMA, hello, findings, rows }, null, 1) + '\n');
  say(findings);
}

/** a + b for two rational strings with power-of-two denominators. */
function addRational(a: string, b: string): string {
  const [an, ad = '1'] = a.split('/');
  const [bn, bd = '1'] = b.split('/');
  const n = BigInt(an!) * BigInt(bd) + BigInt(bn!) * BigInt(ad);
  const d = BigInt(ad) * BigInt(bd);
  const g = gcd(n < 0n ? -n : n, d);
  return d / g === 1n ? `${n / g}` : `${n / g}/${d / g}`;
}
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  const [command, dir] = process.argv.slice(2);
  const run = command === 'seal' ? seal(dir!) : Promise.reject(new Error('usage: phase8i4-overlay-seal seal <dir>'));
  run.catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
