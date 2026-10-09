/**
 * 8i6 document format help (E255). Live driver, normal profile, owned unsaved project. It checks that the
 * templates of get_document_reference write through the unchanged live paths:
 *
 *   1. get_document_reference with no wire call (typical and largest request);
 *   2. add_launcher_clip with templates.desired in a new track, row 0;
 *   3. read_launcher_clip with reference ["Patch"], then a patch in the template form: BASE from authority.base,
 *      UPDATE of the read event, and one ADD row;
 *   4. one malformed patch (a NOTE row): code invalid-input with detail.repair and no wire call.
 *
 * Each step records its wall time and wire calls. The track is deleted in `finally`.
 *
 * The trial modes prepare and remove the owned track of the fresh agent trials: `trial-setup` adds the track
 * gn-8i6-trial with one 8-beat seed clip in row 0; `trial-state` prints the documents of rows 0..3;
 * `trial-cleanup` deletes the track.
 *
 *   node --import tsx src/probes/phase8i6-format-help.ts templates <dir>
 *   node --import tsx src/probes/phase8i6-format-help.ts trial-setup|trial-state|trial-cleanup
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { parse, type StateDocument } from '../document/index.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { WireTransport } from './phase8h3c-promotion.js';
import { wireSummary } from './phase8h4g-inventory.js';

type Wire = Record<string, any>;
const SCHEMA = 'phase8i6-format-help-v1';
const ANCHOR = 'gn-scale-test';
const say = (value: unknown): void => console.log(JSON.stringify(value));

const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
  observationStore: new FakeObservationStore(),
});
const request = async (method: string, params?: Wire): Promise<Wire> =>
  await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
const rows: Wire[] = [];

async function call(step: string, tool: string, args: Wire): Promise<Wire> {
  const from = transport.calls.length;
  const started = performance.now();
  const result = await callTool(workspace, tool, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  const ms = performance.now() - started;
  const calls = transport.calls.slice(from);
  const wire = wireSummary(calls);
  const row = {
    step, tool, ok: result.failure === undefined, ...(result.failure?.code === undefined ? {} : { code: result.failure.code }),
    ...(typeof result.readback?.status === 'string' ? { status: result.readback.status } : {}),
    ms: Math.round(ms), bytes: Buffer.byteLength(JSON.stringify(result)), calls: calls.length, turns: wire.turns,
    methods: wire.methods,
  };
  rows.push(row);
  say(row);
  return result;
}

async function guard(): Promise<Wire> {
  const hello = await request('contract.hello');
  assert.equal(hello.runtimeProfile, 'normal-v1');
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project) && mark.project !== ANCHOR, `use an owned unsaved project, got ${mark.project}`);
  await adapter.hello();
  return mark;
}

const TRIAL_TRACK = 'gn-8i6-trial';
/** The seed clip: eight one-beat C2 notes, velocity 96. */
const SEED = ['DOC ghostnote-document 1.0 desired', 'CLIP {"id":"seed","length":"8"}',
  'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"seed","fields":"all","from":"0",'
    + '"status":"complete","to":"8"}',
  'FIELDS id clip at duration pitch velocity channel mute',
  ...Array.from({ length: 8 }, (_, k) => `EVENT s${k} seed ${k} 1/2 36 96 1 false`)].join('\n') + '\n';

async function trialTrack(): Promise<string | undefined> {
  const listed = await call('list', 'list_tracks', {});
  return (listed.data?.tracks ?? listed.tracks ?? []).find((item: Wire) => item.name === TRIAL_TRACK)?.trackId;
}

async function trial(mode: string): Promise<void> {
  await guard();
  if (mode === 'trial-setup') {
    assert.equal(await trialTrack(), undefined, 'the trial track exists; run trial-cleanup first');
    const added = await call('add-track', 'add_tracks', { tracks: [{ name: TRIAL_TRACK }] });
    const trackId = added.readback.tracks[0].trackId as string;
    const seed = await call('seed', 'add_launcher_clip', { trackId, row: 0, document: SEED });
    assert.equal(seed.readback?.status, 'verified');
    say({ trackId });
  } else if (mode === 'trial-state') {
    const trackId = await trialTrack();
    assert.ok(trackId, 'no trial track');
    for (const row of [0, 1, 2, 3]) {
      const read = await call(`read-${row}`, 'read_launcher_clip', { trackId, row });
      console.log(`--- row ${row}: ${read.data?.occupancy}`);
      if (read.data?.document) console.log(read.data.document);
    }
  } else if (mode === 'trial-cleanup') {
    const trackId = await trialTrack();
    if (trackId !== undefined) await call('delete-track', 'delete_track', { trackIds: [trackId] });
  }
}

async function main(dir: string): Promise<void> {
  const mark = await guard();

  const typical = await call('reference-typical', 'get_document_reference', {});
  const largest = await call('reference-largest', 'get_document_reference', {
    sections: ['Patch', 'Timing overlays', 'Groups', 'Meter and tempo'] });
  assert.equal(rows[0]!.calls + rows[1]!.calls, 0, 'the reference makes no wire call');
  assert.ok(typical.data.templates.desired && largest.data.templates.patch);

  const added = await call('add-track', 'add_tracks', { tracks: [{ name: 'gn-8i6-format' }] });
  const trackId = added.readback.tracks[0].trackId as string;
  try {
    const add = await call('add-template', 'add_launcher_clip', { trackId, row: 0, document: typical.data.templates.desired });
    assert.equal(add.readback?.status, 'verified', JSON.stringify(add).slice(0, 800));

    const read = await call('read-with-patch', 'read_launcher_clip', { trackId, row: 0, reference: ['Patch'] });
    assert.match(read.reference, /^## Patch\n/);
    const document = parse(read.data.document, 'fields') as StateDocument;
    const clipId = document.clips[0]!.id;
    const eventId = document.events[0]!.id;
    const patch = ['DOC ghostnote-document 1.0 patch', `BASE ${JSON.stringify(read.authority.base)}`,
      'FIELDS id clip at duration pitch velocity channel mute', `ADD n2 ${clipId} 1 1/2 64 100 1 false`,
      `UPDATE ${eventId} {"pitch":62}`].join('\n') + '\n';
    const edit = await call('edit-template-form', 'edit_launcher_clip', { trackId, row: 0, document: patch });
    assert.equal(edit.readback?.status, 'verified', JSON.stringify(edit).slice(0, 800));

    const malformed = patch.replace(/^ADD /m, 'NOTE ');
    const refused = await call('edit-malformed', 'edit_launcher_clip', { trackId, row: 0, document: malformed });
    assert.equal(refused.failure?.code, 'invalid-input');
    assert.equal(refused.detail?.repair?.case, 'record-keyword');
    assert.equal(rows.at(-1)!.calls, 0, 'a refused document makes no wire call');

    const after = await call('read-after', 'read_launcher_clip', { trackId, row: 0 });
    const final = parse(after.data.document, 'fields') as StateDocument;
    assert.deepEqual(final.events.map((event) => [event.pitch, event.at, event.duration]).sort(),
      [[62, '0', '1'], [64, '1', '1/2']]);
  } finally {
    await call('delete-track', 'delete_track', { trackIds: [trackId] });
  }
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'format-help.json'), JSON.stringify({ schema: SCHEMA, project: mark.project, rows }, null, 1) + '\n');
}

const [mode, dir] = process.argv.slice(2);
if (mode === 'templates') await main(dir ?? '/tmp/phase8i6');
else await trial(mode ?? '');
process.exit(0);
