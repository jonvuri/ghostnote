/**
 * 8i9 overlay authoring and creation (E256). Offline bench and live driver.
 *
 *   bench [notes]   offline, fake adapter: add_launcher_clip with a nominal and a groove claim on each note.
 *                   The typical case (28 notes, 56 claims), the control without claims, and the largest admitted
 *                   case at `notes` (default 16,384): the most pairs under the codec limits, and role claims with
 *                   a membership dependency up to the D44 expansion limit. Brain heap with --expose-gc.
 *   live <dir>      live, normal profile, owned unsaved project: on a new track, the typical add with and
 *                   without claims, a read, an overlay-only edit (a revised nominal claim; its groove goes
 *                   stale), a dependency edit, a claim removal, the
 *                   reversal, then the largest admitted add and its reversal. Notes and claims are checked
 *                   independently on each readback. The track is deleted in `finally`.
 *
 * Each live step records its wall time, its wire calls, and its turns.
 *
 *   node --expose-gc --import tsx src/probes/phase8i9-overlay-add.ts bench [notes]
 *   node --import tsx src/probes/phase8i9-overlay-add.ts live <dir>
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { checkCreation } from '../bindings/launcher-clip-edit.js';
import { dependencyExpansion, parseSealable } from '../bindings/overlay-seal.js';
import { parse, sealOverlays, LIMITS, type StateDocument } from '../document/index.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf, type Workspace } from '../surface/workspace.js';
import { WRITE_LIMITS } from '../surface/write-limits.js';
import { WireTransport } from './phase8h3c-promotion.js';
import { wireSummary } from './phase8h4g-inventory.js';

type Wire = Record<string, any>;
const SCHEMA = 'phase8i9-overlay-add-v1';
const ANCHOR = 'gn-scale-test';
const say = (value: unknown): void => console.log(JSON.stringify(value));

// --- documents -------------------------------------------------------------------

/**
 * One desired document of `notes` notes, with a nominal and a groove claim on the first `pairs` notes, without
 * basis. Notes run on 16 channels, one beat apart, 1/4 beat long (16,384 notes fill the 2,097,152-cell reader
 * limit, as in E248), each 1/128 beat late on its nominal onset. Even notes have a
 * known-source groove (declared, resolved: the template is the lateness); odd notes an unknown-source one
 * (measured, unresolved residuals).
 */
export function overlayDocument(notes: number, pairs: number, clipId = 'bass', roles = 0): string {
  const perChannel = Math.ceil(notes / 16);
  const length = Math.max(32, perChannel);
  const events: string[] = [];
  const claims: string[] = [];
  for (let n = 0; n < notes; n += 1) {
    const channel = n % 16;
    const k = Math.floor(n / 16);
    const id = `b${n}`;
    events.push(`EVENT ${id} ${clipId} ${k * 128 + 1}/128 1/4 ${36 + ((k + channel) % 48)} ${80 + (n % 40)} ${channel + 1} false`);
    if (n >= pairs) continue;
    const depends = (overlays: string[]) => ({ events: [{ id, fields: ['at', 'clip', 'duration'] }], clips: [], overlays,
      membership: [] });
    const known = n % 2 === 0;
    claims.push(`OVERLAY ${JSON.stringify({ id: `nom-${id}`, type: 'nominal', state: 'current',
      provenance: { kind: 'declared', source: 'phase8i9', method: 'authored-quarters' }, depends: depends([]),
      data: { event: id, at: String(k), duration: '1/4', division: '1/4' } })}`);
    claims.push(`OVERLAY ${JSON.stringify({ id: `groove-${id}`, type: 'groove', state: 'current',
      provenance: known ? { kind: 'declared', source: 'phase8i9', method: 'late-template' }
        : { kind: 'measured', source: 'phase8i9', method: 'cell-only-observation' },
      depends: depends([`nom-${id}`]),
      data: { event: id, nominal: `nom-${id}`, intent: known ? 'resolved' : 'unresolved', phase: '0',
        template: known ? '1/128' : '0', cross: '0', local: '0', unassigned: known ? '0' : '1/128',
        durationIntent: '0', durationUnassigned: '0',
        ...(known ? { sourceAt: `${k * 128 + 1}/128`, sourceDuration: '1/4', atDelta: '0', durationDelta: '0' }
          : { atDelta: null, durationDelta: null }) } })}`);
  }
  // Role claims with a membership dependency: each projects every event ID of the clip (the expansion limit).
  for (let r = 0; r < roles; r += 1) {
    claims.push(`OVERLAY ${JSON.stringify({ id: `role-${r}`, type: 'role', state: 'current',
      provenance: { kind: 'declared', source: 'phase8i9', method: 'membership' },
      depends: { events: [], clips: [{ id: clipId, fields: ['length'] }], overlays: [], membership: [clipId] },
      data: { clip: clipId, label: `role ${r}`, events: [] } })}`);
  }
  return ['DOC ghostnote-document 1.0 desired', `CLIP {"id":"${clipId}","length":"${length}","loop":{"from":"0","to":"${length}"}}`,
    `COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"${clipId}","fields":"all","from":"0","status":"complete","to":"${length}"}`,
    'FIELDS id clip at duration pitch velocity channel mute', ...events, ...claims].join('\n') + '\n';
}

/** Does the tool admit the document? The parse, the D44 expansion limit, and the creation check, as add runs them. */
function admitted(text: string): boolean {
  try {
    const { document, seal } = parseSealable(text, 'fields');
    if (dependencyExpansion(document, seal) > WRITE_LIMITS.claimDependencyExpansion) return false;
    checkCreation(document, seal);
    return true;
  } catch (error) {
    if ((error as { rule?: string }).rule === 'R28') return false;
    throw error;
  }
}

/** The role claims that fill the expansion limit next to `pairs` claim pairs on `notes` notes. */
function rolesFor(notes: number, pairs: number): number {
  try {
    const { document, seal } = parseSealable(overlayDocument(notes, pairs), 'fields');
    return Math.max(0, Math.floor((WRITE_LIMITS.claimDependencyExpansion - dependencyExpansion(document, seal)) / notes));
  } catch (error) {
    if ((error as { rule?: string }).rule === 'R28') return 0;
    throw error;
  }
}

/**
 * The largest admitted case on `notes` notes: the most claim pairs under the codec limits (claim count and the
 * 8 MiB native input bound), with role claims that fill the D44 expansion limit.
 */
export function largestCase(notes: number): { pairs: number; roles: number; bytes: number; units: number } {
  let low = 0;
  let high = Math.min(notes, LIMITS.overlays / 2);
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (admitted(overlayDocument(notes, middle, 'bass', rolesFor(notes, middle)))) low = middle; else high = middle - 1;
  }
  const roles = rolesFor(notes, low);
  const text = overlayDocument(notes, low, 'bass', roles);
  const { document, seal } = parseSealable(text, 'fields');
  return { pairs: low, roles, bytes: Buffer.byteLength(text), units: dependencyExpansion(document, seal) };
}

/** Notes and claims of a readback, checked apart: the sent notes (live clip ID), and current claims with R22 bases. */
function checkReadback(document: StateDocument, sent: string): { notes: number; claims: number; stale: string[] } {
  const proposal = parse(sent.replace(/^OVERLAY .*\n/gm, ''), 'fields') as StateDocument;
  const clip = document.clips[0]!.id;
  assert.deepEqual(document.events.map((event) => ({ ...event, clip: 'x' })),
    proposal.events.map((event) => ({ ...event, clip: 'x' })), 'the notes read back as sent');
  // One seal of the whole read: each current claim has the R22 basis that the codec computes.
  assert.deepEqual(sealOverlays(document).overlays.map((claim) => claim.basis),
    document.overlays.map((claim) => claim.basis), 'each current claim has the R22 basis');
  assert.ok(document.events.every((event) => event.clip === clip));
  return { notes: document.events.length, claims: document.overlays.length,
    stale: document.overlays.filter((item) => item.state === 'stale').map((item) => item.id).sort() };
}

// --- offline bench ---------------------------------------------------------------

function fakeWorkspace(): { workspace: Workspace; trackId: string } {
  const fake = new FakeAdapter({ tracks: ['gn-bench'], scenes: 4 });
  let id = 0;
  const workspace = workspaceOf({ ready: async () => undefined, adapter: fake,
    executor: new Executor(fake, { newId: () => `b-${++id}`, now: () => id }),
    stash: new Stash({ now: () => id }), observationStore: new FakeObservationStore(), documents: new IdentityRegistry() });
  return { workspace, trackId: fake.model.visibleTracks()[0]!.channelId };
}

const heap = (): number => {
  (globalThis as { gc?: () => void }).gc?.();
  return process.memoryUsage().heapUsed;
};

async function benchOne(label: string, notes: number, pairs: number, roles = 0): Promise<Wire> {
  const { workspace, trackId } = fakeWorkspace();
  const document = overlayDocument(notes, pairs, 'bass', roles);
  const before = heap();
  const started = performance.now();
  const result = await callTool(workspace, 'add_launcher_clip', { trackId, row: 0, document, readback: 'document' },
    AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const ms = performance.now() - started;
  const unswept = process.memoryUsage().heapUsed - before;
  const retained = heap() - before;
  assert.equal(result.readback?.status, 'verified', JSON.stringify(result).slice(0, 600));
  const check = checkReadback(parse(result.readback.document, 'fields') as StateDocument, document);
  assert.equal(check.claims, pairs * 2 + roles);
  assert.deepEqual(check.stale, []);
  const reverted = performance.now();
  for (const step of result.next.revert) {
    const undone = await callTool(workspace, 'revert_change', { changeId: step.changeId }, AGENT_NATIVE_TOOL_PROFILE) as Wire;
    assert.equal(undone.failure, undefined, JSON.stringify(undone).slice(0, 300));
  }
  return { label, notes, claims: pairs * 2 + roles, roles, documentBytes: Buffer.byteLength(document), ms: Math.round(ms),
    planMs: Math.round(result.timing.planMs), revertMs: Math.round(performance.now() - reverted),
    heapRetainedMiB: Number((retained / 2 ** 20).toFixed(1)), heapAfterCallMiB: Number((unswept / 2 ** 20).toFixed(1)) };
}

async function bench(notes: number): Promise<void> {
  const largest = largestCase(notes);
  say({ schema: `${SCHEMA}-bench`, notes, largest });
  say(await benchOne('typical-control', 28, 0));
  say(await benchOne('typical', 28, 28));
  say(await benchOne('largest-control', notes, 0));
  say(await benchOne('largest-pairs', notes, largest.pairs));
  say(await benchOne('largest', notes, largest.pairs, largest.roles));
}

// --- live driver -----------------------------------------------------------------

async function live(dir: string): Promise<void> {
  const transport = new WireTransport();
  const adapter = new LiveAdapter({ transport });
  const workspace = workspaceOf({
    ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
    observationStore: new FakeObservationStore(),
  });
  const request = async (method: string): Promise<Wire> => await transport.send({ method }) as Wire;
  const rows: Wire[] = [];
  const call = async (step: string, tool: string, args: Wire): Promise<Wire> => {
    const from = transport.calls.length;
    const started = performance.now();
    const result = await callTool(workspace, tool, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
    const ms = performance.now() - started;
    const calls = transport.calls.slice(from);
    const wire = wireSummary(calls);
    const row = { step, tool, ok: result.failure === undefined,
      ...(result.failure?.code === undefined ? {} : { code: result.failure.code, message: result.message }),
      ...(typeof result.readback?.status === 'string' ? { status: result.readback.status } : {}),
      ...(result.plan?.route === undefined ? {} : { route: result.plan.route }),
      ms: Math.round(ms), ...(result.timing === undefined ? {} : { timing: result.timing }),
      bytes: Buffer.byteLength(JSON.stringify(result)), calls: calls.length, turns: wire.turns, methods: wire.methods };
    rows.push(row);
    say({ ...row, methods: undefined });
    return result;
  };

  const hello = await request('contract.hello');
  assert.equal(hello.runtimeProfile, 'normal-v1');
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project) && mark.project !== ANCHOR, `use an owned unsaved project, got ${mark.project}`);
  await adapter.hello();
  const tracksBefore = (await call('tracks-before', 'list_tracks', {})).data.tracks.map((item: Wire) => item.name);
  const trackId = (await call('add-track', 'add_tracks', { tracks: [{ name: 'gn-8i9-overlay' }] }))
    .readback.tracks[0].trackId as string;
  const checks: Wire = {};
  const read = async (step: string, row: number) => parse((await call(step, 'read_launcher_clip', { trackId, row }))
    .data.document, 'fields') as StateDocument;
  const base = async (row: number) => (await call(`base-${row}`, 'read_launcher_clip', { trackId, row })).authority.base;
  const patch = (b: Wire, rows: string[]) => ['DOC ghostnote-document 1.0 patch', `BASE ${JSON.stringify(b)}`,
    'FIELDS id clip at duration pitch velocity channel mute', ...rows].join('\n') + '\n';
  const notesOf = (document: StateDocument) => JSON.stringify(document.events);
  try {
    // 1. The typical add without claims: the fixed host cost of the same notes.
    const control = await call('add-typical-control', 'add_launcher_clip', { trackId, row: 0,
      document: overlayDocument(28, 0, 'control') });
    assert.equal(control.readback?.status, 'verified');
    for (const step of control.next.revert) await call('revert-control', 'revert_change', { changeId: step.changeId });

    // 2. The typical add with claims: no read before it, the agent clip ID.
    const sent = overlayDocument(28, 28);
    const added = await call('add-typical', 'add_launcher_clip', { trackId, row: 0, document: sent, readback: 'document' });
    assert.equal(added.readback?.status, 'verified', JSON.stringify(added).slice(0, 600));
    checks.add = checkReadback(parse(added.readback.document, 'fields') as StateDocument, sent);
    assert.equal(checks.add.claims, 56);
    assert.deepEqual(checks.add.stale, []);
    const changes: string[] = added.effects.map((effect: Wire) => effect.changeId);

    // 3. An independent read: the same notes and claims.
    const first = await read('read', 0);
    checks.read = checkReadback(first, sent);
    assert.deepEqual(first.overlays, (parse(added.readback.document, 'fields') as StateDocument).overlays);

    // 4. An overlay-only edit: a revised nominal claim on b0 (another method), no basis. No note write.
    const nominal = first.overlays.find((claim) => claim.id === 'nom-b0')!;
    const { basis: _basis, ...revised } = { ...nominal, provenance: { ...nominal.provenance, method: 'revised-quarters' } };
    const put = await call('edit-overlay-only', 'edit_launcher_clip', { trackId, row: 0,
      document: patch(await base(0), [`OVERLAY_PUT ${JSON.stringify(revised)}`]) });
    assert.equal(put.plan?.route, 'none', JSON.stringify(put).slice(0, 400));
    const afterPut = await read('read-after-put', 0);
    assert.equal(notesOf(afterPut), notesOf(first));
    checks.overlayOnly = checkReadback(afterPut, sent);
    // The groove of b0 depends on the full nominal envelope (R22), so the revised nominal makes it stale (R23).
    assert.deepEqual(checks.overlayOnly.stale, ['groove-b0']);

    // 5. A dependency edit: b1 duration. Only the claims of b1 go stale.
    const dependency = await call('edit-dependency', 'edit_launcher_clip', { trackId, row: 0,
      document: patch(await base(0), ['UPDATE b1 {"duration":"1/8"}']) });
    assert.equal(dependency.readback?.status, 'verified', JSON.stringify(dependency).slice(0, 400));
    if (dependency.effects?.[0]) changes.push(dependency.effects[0].changeId);
    const afterDependency = await read('read-after-dependency', 0);
    checks.dependency = { stale: afterDependency.overlays.filter((item) => item.state === 'stale').map((item) => item.id).sort() };
    assert.deepEqual(checks.dependency.stale, ['groove-b0', 'groove-b1', 'nom-b1']);

    // 6. A claim removal: the stale pair. No note changes.
    const removal = await call('edit-claim-removal', 'edit_launcher_clip', { trackId, row: 0,
      document: patch(await base(0), ['OVERLAY_REMOVE groove-b1', 'OVERLAY_REMOVE nom-b1']) });
    assert.equal(removal.failure, undefined, JSON.stringify(removal).slice(0, 400));
    const afterRemoval = await read('read-after-removal', 0);
    assert.equal(notesOf(afterRemoval), notesOf(afterDependency));
    checks.removal = { claims: afterRemoval.overlays.length };
    assert.equal(checks.removal.claims, 54);

    // 7. The reversal: the dependency edit, the content, then the creation.
    for (const changeId of changes.reverse()) await call('revert-typical', 'revert_change', { changeId });
    const empty = await call('read-reverted', 'read_launcher_clip', { trackId, row: 0 });
    checks.reverted = empty.data?.occupancy;
    assert.equal(checks.reverted, 'empty');

    // 8. The largest admitted add and its reversal.
    const notes = 16_384;
    const largest = largestCase(notes);
    const worstText = overlayDocument(notes, largest.pairs, 'bass', largest.roles);
    const worst = await call('add-largest', 'add_launcher_clip', { trackId, row: 1, document: worstText });
    assert.equal(worst.readback?.status, 'verified', JSON.stringify(worst).slice(0, 600));
    const worstRead = await read('read-largest', 1);
    checks.largest = { ...largest, ...checkReadback(worstRead, worstText) };
    assert.equal(checks.largest.claims, largest.pairs * 2 + largest.roles);
    for (const step of worst.next.revert) await call('revert-largest', 'revert_change', { changeId: step.changeId });
  } finally {
    await call('delete-track', 'delete_track', { trackIds: [trackId] });
    const tracksAfter = (await call('tracks-after', 'list_tracks', {})).data.tracks.map((item: Wire) => item.name);
    checks.baseline = JSON.stringify(tracksAfter) === JSON.stringify(tracksBefore);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'overlay-add.json'), JSON.stringify({ schema: SCHEMA, hello: {
      runtimeProfile: hello.runtimeProfile, methodCount: hello.methodCount, methodsHash: hello.methodsHash },
    project: mark.project, checks, rows }, null, 1) + '\n');
    say({ checks });
    await transport.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [command, arg] = process.argv.slice(2);
  const run = command === 'bench' ? bench(Number(arg ?? 16_384))
    : command === 'live' ? live(arg!)
      : Promise.reject(new Error('usage: phase8i9-overlay-add bench [notes] | live <dir>'));
  run.catch((error) => { console.error(error); process.exitCode = 1; });
}

