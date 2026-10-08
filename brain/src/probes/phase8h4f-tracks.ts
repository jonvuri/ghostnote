/**
 * 8h4f track-kind arms (E239). Live driver, probe profile, owned unsaved project (refuses the saved anchor, D29).
 *
 *   arms <dir>            four arms through the product executor path (`track.create`, `track.duplicate`):
 *                           control    duplicate an instrument track (the E16 kind) with a device and a note clip
 *                           audio-new  create an audio track (`track.create` kind audio)
 *                           audio-dup  duplicate the operator's audio track (an audio clip in row 0)
 *                           hybrid-dup duplicate the operator's Hybrid track, after the driver adds a device and a
 *                                      note clip
 *                         Each arm checks fresh identity, type, content, routing (sends and input kind), mixer
 *                         state, audibility (VU), cost (wall time and wire calls), and bounded mint readback.
 *   verify-offline <dir>  recompute the verdicts of the two retained runs (arms-run1.json, arms-run2.json)
 *
 * Fixture (the operator): one Audio track with an audio clip in Launcher row 0, one Hybrid track, and one FX
 * track, in an owned unsaved project. The driver deletes every track that it creates. It stops the transport
 * with the probe-only named action "Stop Transport" around each audibility phase.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { track as trackAt, type Op } from '../contract/index.js';
import { directedDestruction } from '../engine/index.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { WireTransport } from './phase8h3c-promotion.js';

type Wire = Record<string, any>;
const SCHEMA = 'phase8h4f-tracks-v1';
export const PROBE_8H4F = ['phase-8-probe-v1', 107, 'a4c9dcd1499f498a'] as const;
const ANCHOR = 'gn-scale-test';
const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const AUDIBLE_MS = 1500;
/** The source mixer state that a fresh track cannot satisfy by its defaults (E16 row B5). */
const MARK = { volume: 0.62, pan: 0.35, color: [0.9, 0.2, 0.4], sendValue: 0.42, sendMode: 'PRE' } as const;

const NOTES = ['DOC ghostnote-document 1.0 desired', 'CLIP {"id":"c1","length":"4","loop":{"from":"0","to":"4"}}',
  'COVERAGE {"channels":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"clip":"c1","fields":"all","from":"0","status":"complete","to":"4"}',
  'FIELDS id clip at duration pitch velocity channel',
  ...Array.from({ length: 8 }, (_, i) => `EVENT n${i} c1 ${i}/2 1/2 ${60 + (i % 4) * 4} 110 1`)].join('\n') + '\n';

const transport = new WireTransport();
const adapter = new LiveAdapter({ transport });
const workspace = workspaceOf({
  ready: async () => undefined, adapter, stash: new Stash(), executor: new Executor(adapter),
  observationStore: new FakeObservationStore(),
});
const request = async (method: string, params?: Wire): Promise<Wire> =>
  await transport.send({ method, ...(params ? { params } : {}) }) as Wire;
const say = (value: unknown): void => console.log(JSON.stringify(value));
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function tool(name: string, args: Wire): Promise<Wire> {
  const result = await callTool(workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  assert(result.failure === undefined && result.refused !== true, `${name}: ${JSON.stringify(result).slice(0, 600)}`);
  return result;
}

const tracks = async (): Promise<Wire[]> => (await request('track.list')).tracks as Wire[];
async function indexOf(channelId: string): Promise<number> {
  const found = await request('track.resolveByChannelId', { channelId });
  assert(found.found === true, `track ${channelId} does not resolve`);
  return found.index as number;
}
const mixer = async (channelId: string): Promise<Wire> => request('branch.mixer', { trackIndex: await indexOf(channelId) });
const slotsOf = async (channelId: string, rows: number): Promise<boolean[]> => {
  const index = await indexOf(channelId);
  const out: boolean[] = [];
  for (let row = 0; row < rows; row++) out.push((await request('slot.status', { trackIndex: index, slotIndex: row })).hasContent);
  return out;
};
const devicesOf = async (channelId: string): Promise<string[]> =>
  ((await tool('read_devices', { trackId: channelId })).data.devices as Wire[]).map((item) => item.name);
const notesOf = async (channelId: string): Promise<string | null> => {
  const read = await callTool(workspace, 'read_launcher_clip', { trackId: channelId, row: 0 }, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  if (read.failure !== undefined) return `failure:${read.failure.code}`;
  // The event lines without the event and clip IDs: the registry mints IDs for each clip.
  return (read.data?.document as string ?? '').split('\n').filter((line) => line.startsWith('EVENT'))
    .map((line) => line.split(' ').filter((_, index) => index !== 1 && index !== 2).join(' ')).join('\n');
};

interface Applied { ms: number; wireCalls: number; minted: string | undefined; applied: boolean; changeId: string }

/** One product write through the executor, with its wall time and wire calls. */
async function applied(ops: readonly Op[], clearance?: ReturnType<typeof directedDestruction>): Promise<Applied> {
  const from = transport.calls.length;
  const started = performance.now();
  const change = await workspace.apply(ops, clearance === undefined ? undefined : { clearance });
  const minted = change.take.receipt.minted[0];
  return { ms: Math.round(performance.now() - started), wireCalls: transport.calls.length - from,
    minted: minted?.kind === 'track' ? minted.channelId : undefined, applied: change.take.report.applied,
    changeId: change.take.id };
}

const mixerFacts = (row: Wire): Wire => ({
  volume: row.volume, pan: row.pan, mute: row.mute, solo: row.solo, activated: row.activated, color: row.color,
  audioInput: row.audioInput, noteInput: row.noteInput,
  sends: (row.sends as Wire[]).map((send) => ({ value: send.value, enabled: send.enabled, preFader: send.preFader,
    sendMode: send.sendMode })),
});
const near = (left: number, right: number): boolean => Math.abs(left - right) < 0.005;

/** Give the source a non-default strip, so that a copy cannot match by fresh-track defaults. */
async function markSource(channelId: string): Promise<Wire> {
  const index = await indexOf(channelId);
  await request('branch.setMixer', { trackIndex: index, volume: MARK.volume, pan: MARK.pan, color: MARK.color, mute: false });
  const sends = (await mixer(channelId)).sends as Wire[];
  if (sends.length > 0) {
    await request('branch.setMixer', { trackIndex: index, sendIndex: 0, sendValue: MARK.sendValue, sendMode: MARK.sendMode });
  }
  for (let tries = 0; tries < 40; tries++) {
    const row = await mixer(channelId);
    if (near(row.volume, MARK.volume) && near(row.pan, MARK.pan)
        && (sends.length === 0 || near(row.sends[0].value, MARK.sendValue))) return mixerFacts(row);
    await sleep(50);
  }
  throw new Error('the source mixer mark did not land');
}

const vuOf = (vu: Wire, channelId: string): Wire | undefined =>
  (vu.tracks as Wire[]).find((row) => row.channelId === channelId);

/**
 * Stop every launcher clip and the transport through the probe-only named actions. Both depend on no selection
 * (standing rule 6 names the selection hazard). An action has no readback, so the transport state and the row-0
 * play state of each named track confirm it: after "Stop Transport" alone, a clip that played earlier resumes at
 * the next launch. A release tail decays before the next phase.
 */
async function stopAll(rows: readonly string[] = []): Promise<void> {
  await request('app.invokeAction', { id: 'stop_playback_of_all_tracks' });
  await request('app.invokeAction', { id: 'Stop Transport' });
  for (let tries = 0; tries < 80; tries++) {
    const vu = await request('branch.vu', {});
    // The release tail of the last phase decays first: each named track reads VU 0.
    let quiet = vu.isPlaying === false && rows.every((id) => (vuOf(vu, id)?.now ?? 0) === 0);
    for (const id of rows) {
      const state = await request('slot.playState', { trackIndex: await indexOf(id), slotIndex: 0 });
      quiet &&= state.isPlaying === false && state.isPlaybackQueued === false;
    }
    if (quiet) { await sleep(300); return; }
    await sleep(50);
  }
  throw new Error('the transport, a clip, or a release tail did not stop');
}

/**
 * Launch row 0 of `play` from silence, with `silent` muted and not playing. The VU hold of each track and of the
 * Master track over AUDIBLE_MS. The track VU reads before the mute, so only a silent start isolates one track; the
 * Master VU shows that the signal reaches the output.
 */
async function audible(play: string, silent: string, master: string): Promise<Wire> {
  await stopAll([play, silent]);
  await request('branch.setMixer', { trackIndex: await indexOf(silent), mute: true });
  await request('branch.setMixer', { trackIndex: await indexOf(play), mute: false });
  await sleep(100);
  await request('branch.vu', { reset: true });
  await request('slot.launchWithOptions', { trackIndex: await indexOf(play), slotIndex: 0, quantization: 'none',
    launchMode: 'default' });
  await sleep(AUDIBLE_MS);
  const vu = await request('branch.vu', {});
  await stopAll([play, silent]);
  return { played: vuOf(vu, play)?.hold ?? -1, muted: vuOf(vu, silent)?.hold ?? -1, master: vuOf(vu, master)?.hold ?? -1,
    isPlaying: vu.isPlaying };
}

interface Arm {
  readonly arm: string;
  readonly kind: string;
  readonly checks: Record<string, boolean>;
  readonly facts: Wire;
}

/** Duplicate `source` and compare the copy with it. The copy is deleted at the end. */
async function duplicationArm(arm: string, source: Wire, rows: number, notes: boolean, master: string): Promise<Arm> {
  const marked = await markSource(source.channelId);
  const before = await tracks();
  const sourceBefore = { slots: await slotsOf(source.channelId, rows), devices: await devicesOf(source.channelId),
    notes: notes ? await notesOf(source.channelId) : null, position: before.find((row) => row.channelId === source.channelId)!.position };
  const sceneCount = (await request('scene.count')).sceneCount;
  const write = await applied([{ op: 'track.duplicate', track: trackAt(source.channelId) }]);
  say({ arm, write });
  const copyId = write.minted;
  const facts: Wire = { source: { name: source.name, type: source.type, mixer: marked, ...sourceBefore }, write };
  const checks: Record<string, boolean> = { minted: copyId !== undefined };
  if (copyId === undefined) return { arm, kind: source.type, checks, facts };
  try {
    const after = await tracks();
    const copy = after.find((row) => row.channelId === copyId)!;
    const copyMixer = mixerFacts(await mixer(copyId));
    const copyState = { name: copy.name, type: copy.type, position: copy.position, mixer: copyMixer,
      slots: await slotsOf(copyId, rows), devices: await devicesOf(copyId), notes: notes ? await notesOf(copyId) : null };
    facts.copy = copyState;
    checks.freshIdentity = !before.some((row) => row.channelId === copyId) && after.length === before.length + 1;
    checks.sourceKept = after.some((row) => row.channelId === source.channelId);
    checks.sameType = copy.type === source.type;
    checks.adjacent = copy.position === sourceBefore.position + 1;
    checks.sceneCountKept = (await request('scene.count')).sceneCount === sceneCount;
    checks.content = JSON.stringify(copyState.slots) === JSON.stringify(sourceBefore.slots)
      && sourceBefore.slots[0] === true
      && JSON.stringify(copyState.devices) === JSON.stringify(sourceBefore.devices)
      && (!notes || (copyState.notes === sourceBefore.notes && (copyState.notes ?? '').length > 0));
    checks.mixer = near(copyMixer.volume, marked.volume) && near(copyMixer.pan, marked.pan)
      && copyMixer.mute === marked.mute && copyMixer.activated === marked.activated && copyMixer.color === marked.color;
    checks.routing = copyMixer.audioInput === marked.audioInput && copyMixer.noteInput === marked.noteInput
      && copyMixer.sends.length === marked.sends.length
      && copyMixer.sends.every((send: Wire, index: number) => near(send.value, marked.sends[index].value)
        && send.preFader === marked.sends[index].preFader && send.sendMode === marked.sends[index].sendMode
        && send.enabled === marked.sends[index].enabled);
    // E16 row E5: the copy arrives unmuted and audible when the source was.
    checks.arrivesAudible = copyMixer.mute === false && copyMixer.activated === true;
    const copyAlone = await audible(copyId, source.channelId, master);
    const sourceAlone = await audible(source.channelId, copyId, master);
    facts.audibility = { copyAlone, sourceAlone };
    checks.audible = [copyAlone, sourceAlone].every((phase) => phase.played > 0 && phase.master > 0 && phase.muted === 0);
    await request('branch.setMixer', { trackIndex: await indexOf(source.channelId), mute: false });
  } finally {
    const removed = await applied([{ op: 'track.delete', track: trackAt(copyId) }], directedDestruction('delete_track'));
    facts.cleanup = removed;
    checks.cleanup = !(await tracks()).some((row) => row.channelId === copyId);
  }
  return { arm, kind: source.type, checks, facts };
}

async function creationArm(): Promise<Arm> {
  const before = await tracks();
  const sceneCount = (await request('scene.count')).sceneCount;
  const write = await applied([{ op: 'track.create', name: 'gn-8h4f-audio', kind: 'audio' }]);
  say({ arm: 'audio-new', write });
  const id = write.minted;
  const checks: Record<string, boolean> = { minted: id !== undefined };
  const facts: Wire = { write };
  if (id === undefined) return { arm: 'audio-new', kind: 'Audio', checks, facts };
  try {
    const rename = await applied([{ op: 'track.rename', track: trackAt(id), name: 'gn-8h4f-audio' }]);
    const after = await tracks();
    const made = after.find((row) => row.channelId === id)!;
    const state = mixerFacts(await mixer(id));
    facts.rename = rename;
    facts.created = { name: made.name, type: made.type, position: made.position, mixer: state,
      slots: await slotsOf(id, 4), devices: await devicesOf(id) };
    checks.freshIdentity = !before.some((row) => row.channelId === id) && after.length === before.length + 1;
    checks.type = made.type === 'Audio';
    checks.named = made.name === 'gn-8h4f-audio';
    checks.sceneCountKept = (await request('scene.count')).sceneCount === sceneCount;
    checks.empty = facts.created.slots.every((has: boolean) => !has) && facts.created.devices.length === 0;
    checks.routing = state.audioInput === true && state.noteInput === false
      && state.sends.every((send: Wire) => send.value === 0 || send.value < 0.005);
    checks.mixerDefault = state.mute === false && state.solo === false && state.activated === true && near(state.pan, 0.5);
    // An empty track has nothing to play; the VU proves that it is silent, not that it can sound.
    await request('branch.vu', { reset: true });
    await sleep(500);
    const hold = vuOf(await request('branch.vu', {}), id)?.hold ?? -1;
    facts.silentHold = hold;
    checks.silentWithoutContent = hold === 0;
  } finally {
    facts.cleanup = await applied([{ op: 'track.delete', track: trackAt(id) }], directedDestruction('delete_track'));
    checks.cleanup = !(await tracks()).some((row) => row.channelId === id);
  }
  return { arm: 'audio-new', kind: 'Audio', checks, facts };
}

async function arms(dir: string): Promise<void> {
  const hello = await request('contract.hello');
  assert.deepEqual([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [...PROBE_8H4F]);
  const info = await request('rig.info');
  assert.deepEqual(info.trackCreateKinds, ['instrument', 'audio'], 'the 8h4f build marker');
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project) && mark.project !== ANCHOR, `use an owned unsaved project, got ${mark.project}`);
  await adapter.hello();
  const start = await tracks();
  const audio = start.filter((row) => row.type === 'Audio');
  const hybrid = start.filter((row) => row.type === 'Hybrid');
  assert.equal(audio.length, 1, 'exactly one Audio track (the fixture)');
  assert.equal(hybrid.length, 1, 'exactly one Hybrid track (the fixture)');
  assert(start.some((row) => row.type === 'Effect'), 'one FX track, for the send check');
  const master = start.find((row) => row.type === 'Master')!.channelId as string;
  await stopAll();
  const results: Arm[] = [];

  // Control: an instrument track with a device and a note clip, made by the product tools.
  const made = await applied([{ op: 'track.create', name: 'gn-8h4f-inst' }]);
  assert(made.minted !== undefined, 'the control track was minted');
  const control = made.minted;
  try {
    await tool('add_devices', { trackId: control, devices: [{ kind: 'bitwig', id: POLYSYNTH }] });
    await tool('add_launcher_clip', { trackId: control, row: 0, document: NOTES });
    const controlRow = (await tracks()).find((row) => row.channelId === control)!;
    results.push(await duplicationArm('control', controlRow, 4, true, master));
  } finally {
    await applied([{ op: 'track.delete', track: trackAt(control) }], directedDestruction('delete_track'));
  }
  results.push(await creationArm());
  results.push(await duplicationArm('audio-dup', audio[0]!, 4, false, master));
  // The Hybrid source gets an instrument and a note clip from the product tools, so that it can sound.
  const hybridId = hybrid[0]!.channelId as string;
  if ((await devicesOf(hybridId)).length === 0) {
    await tool('add_devices', { trackId: hybridId, devices: [{ kind: 'bitwig', id: POLYSYNTH }] });
  }
  if (!(await slotsOf(hybridId, 1))[0]) await tool('add_launcher_clip', { trackId: hybridId, row: 0, document: NOTES });
  results.push(await duplicationArm('hybrid-dup', (await tracks()).find((row) => row.channelId === hybridId)!, 4, true, master));

  const end = await tracks();
  const residue = end.filter((row) => !start.some((item) => item.channelId === row.channelId));
  for (const arm of results) say({ arm: arm.arm, kind: arm.kind, checks: arm.checks });
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'arms.json'), JSON.stringify({ schema: SCHEMA, hello, project: mark.project,
    fixture: start.map((row) => ({ name: row.name, type: row.type })), arms: results,
    residue: residue.map((row) => row.channelId) }, null, 1) + '\n');
  say({ written: join(dir, 'arms.json'), residue: residue.length,
    passed: results.map((arm) => [arm.arm, Object.values(arm.checks).every(Boolean)]) });
}

/** The verdict of each arm from the retained artifact. */
export function verdicts(artifact: Wire): Record<string, boolean> {
  assert.equal(artifact.schema, SCHEMA);
  return Object.fromEntries((artifact.arms as Arm[]).map((arm) => [arm.arm, Object.values(arm.checks).every(Boolean)]));
}

async function verifyOffline(dir: string): Promise<void> {
  for (const name of ['arms-run1.json', 'arms-run2.json']) {
    const artifact = JSON.parse(await readFile(join(dir, name), 'utf8')) as Wire;
    assert.deepEqual(artifact.residue, []);
    const verdict = verdicts(artifact);
    assert.deepEqual(verdict, { control: true, 'audio-new': true, 'audio-dup': true, 'hybrid-dup': true });
    say({ [name]: verdict, writeMs: (artifact.arms as Arm[]).map((arm) => [arm.arm, arm.facts.write.ms, arm.facts.write.wireCalls]) });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [command, dir] = process.argv.slice(2);
  try {
    if (command === 'arms' && dir) await arms(dir);
    else if (command === 'verify-offline' && dir) await verifyOffline(dir);
    else throw new Error('usage: phase8h4f-tracks.ts arms|verify-offline <dir>');
  } finally {
    transport.close?.();
  }
}
