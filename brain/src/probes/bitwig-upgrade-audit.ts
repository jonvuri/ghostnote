/** Normal-product upgrade audit. See the section 2A/2B runbook before live use. */
import assert from 'node:assert/strict';
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { execFileSync } from 'node:child_process';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import { inspectPresetModulation } from '../engine/preset-modulation-inspection.js';
import { readMeta } from '../bwmod/index.js';
import { COMPOSITION_TARGETS } from '../composition/targets.js';
import { Executor } from '../engine/executor.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { wireSummary } from './phase8h4g-inventory.js';
import { CASES, documentOf, musical, requireAddedAttackRoute, type AuditCase } from './upgrade-audit/cases.js';
import { AuditTransport } from './upgrade-audit/transport.js';
import { Evidence, LIMITS, PROJECT, SWITCH_PROJECT, assertMayRun, assertOwned, assertRefusal, assertVerification,
  assertVersion, canonical, checkProcessEntry, equal, sha, validateBounds, type Bag } from './upgrade-audit/safety.js';

const ROOT = resolve(import.meta.dirname, '../../..');
const GOLDEN = JSON.parse(readFileSync(join(ROOT, 'extension/methods.golden.json'), 'utf8')) as Bag;
const REQUIRED = ['setup', 'notes', 'clips', 'mixer', 'controls', 'structure', 'sampler',
  'selection-after', 'group-restored', 'switch-back', 'reopen', 'sampler-observation', 'cleanup-saved'];
const compactSelection = (selection: Bag, rows: Bag[]): Bag => ({
  mixer: rows.find(row => row.channelId === selection.mixerChannelId)?.name ?? null,
  track: rows.find(row => row.index === selection.trackIndex)?.name ?? null, slot: selection.slotIndex,
});
export function comparable(snapshot: Bag, selection = true): Bag {
  return { scenes: snapshot.scenes, ...(selection ? { selection: snapshot.selection } : {}),
    tracks: snapshot.tracks.map(({ id: _id, index: _index, ...row }: Bag) => row) };
}
export function preserved(snapshot: Bag, names: string[]): Bag {
  return { ...snapshot, tracks: snapshot.tracks.filter((row: Bag) => !names.includes(row.name)) };
}
export function requireEntrySelection(snapshot: Bag): void {
  const selected = snapshot.tracks.find((row: Bag) => row.name === snapshot.selection.track);
  assert(selected && selected.clips.some((clip: Bag) => clip.row === snapshot.selection.slot && !clip.occupied),
    'Select an empty Launcher slot on a preserved entry track before preflight');
  assert(snapshot.tracks.some((row: Bag) => row.name === snapshot.selection.mixer), 'A preserved mixer selection is required');
}
/** Recovery is limited to the first clip creation with no entry slot selected. */
export function validateEmptySelectionRecovery(state: Bag, before: Bag, writes: Bag[]): void {
  assert(!state.pendingWrite && !state.recovery, 'Uncertain or previously started recovery');
  equal(state.completed, ['preflight'], 'Only the first setup attempt can use this recovery');
  assert(state.failure?.command === 'run' && state.failure?.arg === 'setup'
    && state.failure.error.includes('add_launcher_clip: selection changed'), 'Different failure needs a separate recovery');
  equal(state.entry.selection, { mixer: before.selection.mixer, track: null, slot: -1 }, 'Original empty-slot selection required');
  equal(state.owned.map((row: Bag) => row.role), ['sentinel', 'notes', 'spare', 'devices', 'single', 'multi'], 'Exact setup ownership required');
  equal(writes.map(row => row.name), [...Array(6).fill('add_tracks'), 'add_launcher_clip'], 'Unexpected setup write sequence');
  const clip = writes[6]!;
  assert(clip.result.applied === true && clip.result.readback?.status === 'verified'
    && clip.result.warnings?.some((warning: Bag) => warning.code === 'slot-selection-moved'
      && warning.message.includes('no slot was selected before the call')), 'Known selection warning required');
  equal(clip.result.target, { trackId: state.owned[0].id, row: 0 }, 'Known created clip required');
  equal(state.inspection.snapshot.selection, { mixer: state.entry.selection.mixer, track: state.owned[0].name, slot: 0 },
    'Inspection must show only the known slot move');
  equal(comparable(before, false), comparable(state.inspection.snapshot, false), 'State changed since inspection');
  equal(before.selection, { mixer: state.entry.selection.mixer, track: state.entry.selection.mixer, slot: 0 },
    'Select the first empty slot on the original mixer track for recovery');
  requireEntrySelection(before);
  equal(comparable(preserved(before, state.owned.map((row: Bag) => row.name)), false), comparable(state.entry, false),
    'Preserved content changed before recovery');
}
function hashFile(path: string): string { return sha(readFileSync(path)); }
export function validateControlReplyRecovery(state: Bag, before: Bag, calls: Bag[]): string {
  assert(!state.recovery, 'Recovery already started');
  assert(state.failure?.command === 'run' && state.failure.arg === 'controls'
    && state.failure.error.includes('set_device_controls: verification failed'), 'Different failure requires a separate recovery');
  equal(state.completed, ['preflight', 'setup', 'notes', 'clips', 'mixer'], 'Unexpected completed cases');
  const writes = calls.filter(row => !row.name.startsWith('read_'));
  equal(writes.map(row => row.name), ['add_devices', 'set_device_controls'], 'Unexpected control write sequence');
  const control = writes[1]!;
  equal(state.pendingWrite, { name: control.name, args: control.args, commandId: control.commandId }, 'Pending intent differs');
  assert(control.result.applied === true && control.result.verified === true && control.result.partialSuccess === false,
    'A complete boolean verification reply is required');
  const track = state.owned.find((row: Bag) => row.role === 'devices'); assert(track);
  const setting = control.args.settings[0];
  assert.equal(control.args.settings.length, 1);
  equal(setting.device, { trackId: track.id, devicePosition: 0 }, 'Unexpected changed device');
  equal(writes[0]!.args, { trackId: track.id, devices: [
    { kind: 'native', name: 'Polysynth' }, { kind: 'native', name: 'Polysynth' }, state.config.plugin] }, 'Known insert sequence required');
  assert(writes[0]!.result.applied === true && writes[0]!.result.readback?.status === 'verified', 'Insert readback required');
  equal(comparable(before), comparable(state.inspection.snapshot), 'State changed since inspection');
  const current = before.tracks.find((row: Bag) => row.id === track.id); assert(current);
  equal(current.devices.map((row: Bag) => row.name), ['Polysynth', 'Polysynth', 'Diva'], 'Known inserted devices required');
  for (const position of [0, 1, 2]) {
    const initial = calls.find(row => row.name === 'read_device_controls'
      && row.args.device.trackId === track.id && row.args.device.devicePosition === position); assert(initial);
    const expected = initial.result.parameters.map((p: Bag) => ({ id: p.id, name: p.name,
      normalizedValue: position === 0 && p.id === setting.parameterId ? setting.normalizedValue : p.normalizedValue,
      discreteValueCount: p.discreteValueCount }));
    assert(expected.some((p: Bag) => position !== 0 || p.id === setting.parameterId));
    equal(current.controls.find((row: Bag) => row.position === position)?.parameters, expected, 'Independent control state differs');
  }
  const restored = { ...before, tracks: before.tracks.map((row: Bag) => row.id === track.id ? { ...row, devices: [], controls: [] } : row) };
  equal(comparable(restored), comparable(state.last), 'Material outside inserted devices changed');
  return track.id;
}

/** Group slots expose aggregate occupancy, not independent clip documents. */
export function validateGroupFixture(state: Bag, snapshot: Bag): void {
  const names = [state.prefix + 'notes', state.prefix + 'spare'];
  const groups = snapshot.tracks.filter((row: Bag) => row.name === state.prefix + 'group');
  assert.equal(groups.length, 1); const group = groups[0];
  assert.equal(group.type, 'Group'); assert.equal(group.devices.length, 0);
  assert.equal(group.clips.length, snapshot.scenes);
  assert(group.clips.every((clip: Bag, index: number) => clip.kind === 'group-launcher'
    && clip.row === index && typeof clip.occupied === 'boolean'), 'Complete group aggregate slots required');
  const children = snapshot.tracks.filter((row: Bag) => names.includes(row.name));
  assert.equal(children.length, 2);
  assert(children.every((row: Bag, index: number) => row.hidden && row.index === group.index + index + 1),
    'The two named children must be hidden directly after the group');
  const normalized = { ...comparable(snapshot, false), tracks: snapshot.tracks
    .filter((row: Bag) => row.id !== group.id)
    .map(({ id: _id, index: _index, ...row }: Bag) => names.includes(row.name) ? { ...row, hidden: false } : row) };
  equal(normalized, comparable(state.checkpoint, false), 'Group action changed unrelated state');
}
export function validateGroupSnapshotRecovery(state: Bag, calls: Bag[]): void {
  assert(!state.recovery && !state.active && !state.pendingWrite && state.pause === 'group', 'Only a pre-write group failure is admitted');
  assert(state.failure?.command === 'checkpoint' && state.failure.arg === 'group-after'
    && state.failure.error.includes('group-slot'), 'Known group snapshot refusal required');
  assert(state.completed.includes('group-before') && !state.completed.includes('group-after'));
  assert(calls.length > 0 && calls.every(call => call.name.startsWith('read_')), 'Recovery requires read-only tool evidence');
  assert(calls.some(call => call.name === 'read_launcher_clip' && call.result.failure?.code === 'group-slot'
    && call.result.failure.effects?.length === 0), 'Side-effect-free group refusal required');
}
/** Keep the failed record. Carry proved cases into a separate attempt after recovery. */
export function forkRecovered(sourceDir: string, targetDir: string): void {
  assert(!existsSync(join(sourceDir, 'driver.lock')), 'Source driver is running');
  assert(!existsSync(targetDir), 'Use a new continuation directory');
  const state = JSON.parse(readFileSync(join(sourceDir, 'state.json'), 'utf8')) as Bag;
  assert(['control-reply', 'structure-readback', 'sampler-name', 'group-snapshot'].includes(state.recovery?.kind)
    && state.recovery.completed === true && !state.pendingWrite, 'Completed fixture recovery required');
  const grouped = state.recovery.kind === 'group-snapshot';
  if (grouped) validateGroupFixture(state, state.recovery.after);
  else equal(comparable(state.recovery.after), comparable(state.last), 'Recovered fixture differs');
  const inherited = state.inheritedFrom?.proof ?? [];
  for (const item of inherited) assert.equal(hashFile(item.path), item.sha256, 'Inherited source changed');
  const sources = ['state.json', `${state.recovery.kind}-recovery.json`, 'entry.json',
    ...state.completed.filter((name: string) => name !== 'preflight').map((name: string) => name + '.json')]
    .filter(name => existsSync(join(sourceDir, name)));
  const proof = [...inherited, ...sources.map(name => ({ path: join(sourceDir, name), sha256: hashFile(join(sourceDir, name)) }))];
  for (const name of state.completed) assert(proof.some(item => item.path.endsWith('/' + (name === 'preflight' ? 'entry' : name) + '.json')),
    `Missing inherited evidence for ${name}`);
  const evidence = new Evidence(targetDir);
  evidence.save('inherited-evidence.json', { sourceDir, proof, completed: state.completed,
    reason: 'Keep proved cases after independent recovery. The failed case must run from its start.' });
  evidence.save('config.json', state.config);
  evidence.save('state.json', { schema: state.schema, prefix: state.prefix, owned: state.owned,
    completed: state.completed, config: state.config, entry: state.entry, last: state.recovery.after,
    ...(grouped ? { pause: 'group', checkpoint: state.checkpoint } : {}),
    preparedAt: new Date().toISOString(), limits: LIMITS, inheritedFrom: { sourceDir, proof } });
}
export function validateStructureRecovery(state: Bag, before: Bag, calls: Bag[]): string {
  assert(!state.recovery && state.pendingWrite?.name === 'set_device_enabled', 'Different or previously started recovery');
  assert(state.failure?.arg === 'structure' && state.failure.error.includes('set_device_enabled: readback unavailable or differs'),
    'Known enabled readback failure required');
  equal(state.completed, ['preflight', 'setup', 'notes', 'clips', 'mixer', 'controls'], 'Unexpected completed cases');
  const writes = calls.filter(row => !row.name.startsWith('read_'));
  equal(writes.map(row => row.name), ['compose_devices', 'add_devices', 'copy_devices', 'move_devices', 'set_device_enabled'],
    'Exact structure write sequence required');
  const last = writes.at(-1)!;
  equal(state.pendingWrite, { name: last.name, args: last.args, commandId: last.commandId }, 'Pending intent differs');
  assert(last.result.applied === true && last.result.readback?.status === 'differs', 'Known completed write reply required');
  const track = state.owned.find((row: Bag) => row.role === 'devices'); assert(track);
  equal(last.args, { settings: [{ trackId: track.id, devicePosition: 0, enabled: false }] }, 'Known disabled target required');
  equal(comparable(before), comparable(state.inspection.snapshot), 'State changed since inspection');
  const current = before.tracks.find((row: Bag) => row.id === track.id); assert(current);
  assert.equal(current.devices.length, 1);
  const container = current.devices[0];
  equal([container.name, container.enabled], ['FX Layer', false], 'Independent disabled state required');
  equal(container.container.layerChains.map((chain: Bag) => ({ name: chain.name, devices: chain.devices.map((device: Bag) => device.name) })),
    [{ name: 'A', devices: ['Polysynth', 'Delay+'] }, { name: 'B', devices: ['Tool', 'Delay+'] }], 'Exact owned structure required');
  const restored = { ...before, tracks: before.tracks.map((row: Bag) => row.id === track.id ? { ...row, devices: [], controls: [] } : row) };
  equal(comparable(restored), comparable(state.last), 'Material outside the owned container changed');
  return track.id;
}
export function validateSamplerNameRecovery(state: Bag, before: Bag, calls: Bag[]): string {
  assert(!state.recovery && state.pendingWrite?.name === 'edit_preset_modulation', 'Different or started recovery');
  assert(state.failure?.arg === 'sampler' && state.failure.error.includes('Gated Attack Time')
    && state.failure.error.includes('AEG Attack Time'), 'Known Sampler name failure required');
  equal(state.completed, ['preflight', 'setup', 'notes', 'clips', 'mixer', 'controls', 'structure'], 'Unexpected completed cases');
  const writes = calls.filter(row => !row.name.startsWith('read_'));
  assert.equal(writes.length, 1, 'Only the failed Sampler insertion is admitted');
  const call = writes[0]!;
  equal(state.pendingWrite, { name: call.name, args: call.args, commandId: call.commandId }, 'Pending intent differs');
  const track = state.owned.find((row: Bag) => row.role === 'single'); assert(track);
  assert.equal(call.args.trackId, track.id);
  assert.equal(call.args.presetPath, state.config.presets.single.copy);
  equal(call.args.location, { kind: 'self' }, 'Expected self target');
  equal(call.args.operation, { kind: 'add', modulator: 'lfo', target: 'sampler-amp-attack', amount: 0.3 }, 'Exact operation required');
  assert(call.result.applied === true && call.result.failure?.stage === 'readback'
    && call.result.observed?.insertedDevicePosition === 1 && call.result.verified?.insertedHost === true
    && call.result.verified?.pages === true, 'Known inserted host and page evidence required');
  equal(comparable(before, false), comparable(state.inspection.snapshot, false), 'Content changed since inspection');
  equal(before.selection, state.last.selection, 'Restore both mixer and Launcher selection');
  const current = before.tracks.find((row: Bag) => row.id === track.id); assert(current);
  equal(current.devices, [0, 1].map(devicePosition => ({ devicePosition, name: 'Sampler', enabled: true })), 'Exact Sampler pair required');
  equal(current.controls.map((row: Bag) => row.position), [0, 1], 'Both control banks required');
  equal(current.controls[0].parameters, current.controls[1].parameters, 'Inserted base controls differ');
  assert(current.controls[1].parameters.some((p: Bag) => p.id === 'CONTENTS/AMP_ATTACK_TIME' && p.name === 'Gated Attack Time'));
  const restored = { ...before, tracks: before.tracks.map((row: Bag) => row.id === track.id
    ? { ...row, devices: row.devices.slice(0, 1), controls: row.controls.slice(0, 1) } : row) };
  equal(comparable(restored), comparable(state.last), 'Material outside the inserted Sampler changed');
  return track.id;
}

function checkCopies(config: Bag): void {
  for (const preset of Object.values(config.presets) as Bag[]) {
    assert.equal(hashFile(preset.copy), preset.sha256, 'Copied fixture changed');
  }
}
export function validateConfig(config: Bag): void {
  assertVersion(config.version);
  assert(config.operatorHandoff === true, 'Section 1 handoff is required.');
  assert(config.recovery606Checked === true && config.noMissingAssets === true, 'Recovery or assets not confirmed');
  assert.equal(config.appPath, '/Applications/Bitwig Studio.app');
  for (const key of ['backupPath', 'workingPath', 'jarPath', 'archivePath', 'deployedArchivePath', 'projectFile']) {
    assert(typeof config[key] === 'string' && config[key].startsWith('/'), `Absolute ${key} required`);
  }
  assert(config.projectFile.startsWith(config.workingPath + '/') && config.projectFile.endsWith(`${PROJECT}.bwproject`));
  assert(config.jarPath.startsWith(config.appPath + '/'));
  for (const key of ['jarSha256', 'archiveSha256']) assert(/^[a-f0-9]{64}$/.test(config[key]), key);
  assert(Number.isFinite(config.replacedAfterMs) && config.replacedAfterMs > 0, 'Controller replacement time required');
  assert(config.processCheck?.portOwnerPid > 0 && typeof config.processCheck?.checkedAt === 'string'
    && config.processCheck?.noCompetingClients === true, 'Session process and port check required');
  assert(config.playbackStopped === true, 'Operator must stop playback before each live command');
  assert(['clap', 'vst3'].includes(config.plugin?.kind) && typeof config.plugin.id === 'string');
  for (const role of ['single', 'multi']) {
    const preset = config.presets[role];
    assert(preset?.copy && preset?.sha256 && preset?.source, `${role} fixture required`);
    assert.notEqual(resolve(preset.copy), resolve(preset.source));
  }
}

/** This command copies repository fixtures only. It does not inspect the installed app. */
export function prepare(dir: string): void {
  assert(!existsSync(join(dir, 'state.json')), 'Use a new evidence directory');
  const evidence = new Evidence(dir), presets: Bag = {};
  const retained = readdirSync(join(ROOT, 'brain/fixtures/Sampler')).filter(name => name.endsWith('.bwpreset'))
    .map(name => {
      const bytes = readFileSync(join(ROOT, 'brain/fixtures/Sampler', name));
      return { name, sha256: sha(bytes), inventory: inspectPresetModulation(bytes) };
    });
  evidence.save('retained-sampler-catalog.json', { compositionTargets: COMPOSITION_TARGETS, retained,
    scope: 'Repository Sampler presets and named composition targets. This is not a host parameter inventory.' });
  mkdirSync(join(dir, 'fixtures'), { recursive: true });
  for (const [role, name] of [['single', 'gn_sampler_one_lfo'], ['multi', 'gn_sampler_multi_one_lfo']]) {
    const source = join(ROOT, 'brain/fixtures/Sampler', name + '.bwpreset');
    const copy = join(dir, 'fixtures', name + '.bwpreset');
    assert(!existsSync(copy), 'Do not overwrite a copied donor');
    copyFileSync(source, copy);
    const bytes = readFileSync(copy), inspection = inspectPresetModulation(bytes);
    assert(inspection.supported, `${name} has no supported inventory`);
    presets[role!] = { source, copy, sha256: sha(bytes), bytes: bytes.length };
    evidence.save(`donor-${role}.json`, { inspection, meta: Object.fromEntries(readMeta(bytes)),
      removedTargets: ['Play Mode', 'Freeze Playhead', 'Envelope Mode'].map(target => ({ target,
        presentInRetainedInventory: canonical(inspection).toLowerCase().includes(target.toLowerCase()),
        verdict: 'Retained source only; host migration and resource resolution require section 2B.' })) });
  }
  evidence.save('config.example.json', { version: 'REPLACE_WITH_EXACT_6.1.x', operatorHandoff: false,
    recovery606Checked: false, noMissingAssets: false,
    backupPath: '/Users/jonvuri/Bitwig Upgrade Backups/2026-10-21-pre-6.1',
    workingPath: '/Users/jonvuri/Bitwig Upgrade Work/2026-10-21',
    appPath: '/Applications/Bitwig Studio.app', jarPath: '/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar',
    jarSha256: '', archivePath: join(ROOT, 'extension/build/libs/ghostnote-0.0.1.bwextension'),
    deployedArchivePath: '/Users/jonvuri/Documents/Bitwig Studio/Extensions/ghostnote-0.0.1.bwextension',
    archiveSha256: '', replacedAfterMs: 0, playbackStopped: false,
    projectFile: `/Users/jonvuri/Bitwig Upgrade Work/2026-10-21/${PROJECT}/${PROJECT}.bwproject`,
    processCheck: { checkedAt: '', portOwnerPid: 0, noCompetingClients: false },
    plugin: { kind: 'clap', id: 'com.u-he.Diva' }, presets });
  evidence.save('state.json', { schema: 'bitwig-upgrade-audit-v1', prefix: `gn-ua-${randomUUID().slice(0, 8)}-`,
    owned: [], completed: [], preparedAt: new Date().toISOString(), limits: LIMITS });
  console.log('Offline fixtures prepared. Complete config.example.json after the section 1 handoff and normal controller replacement.');
}

export class Audit implements AuditCase {
  readonly commandId = randomUUID();
  readonly transport: AuditTransport;
  readonly adapter: LiveAdapter;
  readonly workspace: ReturnType<typeof workspaceOf>;
  private init = -1;
  private selection: Bag | undefined;
  private cleanupMode = false;
  constructor(readonly evidence: Evidence, readonly state: Bag) {
    this.transport = new AuditTransport(evidence, this.commandId);
    this.adapter = new LiveAdapter({ transport: this.transport });
    this.workspace = workspaceOf({ ready: async () => undefined, adapter: this.adapter,
      stash: new Stash(), executor: new Executor(this.adapter), documents: new IdentityRegistry(),
      observationStore: new FakeObservationStore() });
  }
  save(name: string, value: unknown): void { this.evidence.save(name, value); }
  persist(): void { this.evidence.save('state.json', this.state, true); }
  async request(method: string, params?: Bag): Promise<Bag> { return await this.transport.send({ method, params }) as Bag; }
  async rows(): Promise<Bag[]> { return (await this.request('track.list')).tracks; }
  async start(project = PROJECT): Promise<void> {
    validateConfig(this.state.config); checkCopies(this.state.config);
    for (const proof of this.state.inheritedFrom?.proof ?? []) {
      assert.equal(hashFile(proof.path), proof.sha256, 'Inherited audit evidence changed');
    }
    const config = this.state.config;
    assert.equal(hashFile(config.jarPath), config.jarSha256, 'Installed jar changed');
    assert.equal(hashFile(config.archivePath), config.archiveSha256, 'Built archive changed');
    assert.equal(hashFile(config.deployedArchivePath), config.archiveSha256, 'Deployed archive differs');
    const owners = execFileSync('lsof', ['-nP', '-iTCP:8686', '-sTCP:LISTEN', '-t'], { encoding: 'utf8' })
      .trim().split(/\s+/).map(Number);
    equal([...new Set(owners)], [config.processCheck.portOwnerPid], 'Bridge port owner changed');
    const ownerCommand = execFileSync('ps', ['-p', String(owners[0]), '-o', 'command='], { encoding: 'utf8' }).trim();
    assert(ownerCommand.includes(config.appPath + '/Contents/'), 'Port owner is not the selected app');
    const processes = execFileSync('ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8' }).split('\n')
      .map(line => /^\s*(\d+)\s+(\d+)\s+(.+)$/.exec(line)).filter(match => match !== null)
      .map(match => ({ pid: Number(match[1]), ppid: Number(match[2]), command: match[3]! }));
    const sockets = execFileSync('lsof', ['-nP', '-iTCP:8686', '-FpcnT'], { encoding: 'utf8' });
    const candidates = processes.filter(row => /(?:tsx|node).*src\/(?:probes\/|mcp-server\.(?:ts|js))/.test(row.command));
    this.save(`${this.commandId}-processes.json`, { owners, ownerCommand, candidates, sockets });
    checkProcessEntry(processes, process.pid, sockets);
    await this.transport.connect();
    const hello = await this.request('contract.hello'), methods = await this.request('rig.methods');
    equal([hello.runtimeProfile, hello.methodCount, hello.methodsHash], [GOLDEN.identity, GOLDEN.count, GOLDEN.methodsHash], 'Normal contract');
    equal([...methods.methods].sort(), [...GOLDEN.methods].sort(), 'Exact normal method set');
    const host = await this.request('host.info'); assert.equal(host.hostVersion, config.version, 'Selected host version');
    assert.equal(host.hostApiVersion, 25, 'Compiled extension API');
    const rig = await this.request('rig.info'), stats = await this.request('rig.stats');
    for (const [key, value] of Object.entries({ clipCopy: 'copy-to-slot-v1', trackMixer: 'track-mixer-raw-v1',
      selectionEffects: 'mixer-restore-v1', writeGuard: 'batch-scene-guard-v1', selectionRule: 'selection-project-v1',
      parameterSettle: 'same-ids-switch-v1', groupPoint: 'expand-collapsed-point-v1', contentFilter: 'ALL_CHANNELS' })) {
      assert.equal(rig[key], value, `Build marker ${key}`);
    }
    assert.equal(rig.clipReader?.revision, 'clip-reader-v3');
    assert.equal(rig.clipReader?.closeRule, 'confirm-before-release-v1');
    assert.equal(rig.clipReader?.openRule, 'subscribe-before-unpin-v1');
    assert.equal(rig.cursorTrackPins?.rule, 'owned-tracks-pinned-v1');
    assert.equal(rig.cursorTrackPins?.unpinned?.length, 0);
    assert(stats.initEpochMs >= config.replacedAfterMs && stats.initEpochMs >= statSync(config.deployedArchivePath).mtimeMs,
      'Controller classes are not fresh');
    this.init = stats.initEpochMs;
    assert.equal((await this.request('selection.status')).project, project, 'Audit project guard');
    assert.equal((await this.request('cursor.playState', { cursor: 'fine' })).isPlaying, false, 'Stop playback before live work');
    await this.adapter.hello();
    this.save(`${this.commandId}-preflight.json`, { hello, methods, host, rig, stats, config });
  }
  async guard(): Promise<void> {
    assert(!this.state.failure || this.cleanupMode, 'Failure latch: inspect before cleanup');
    const selection = await this.request('selection.status');
    assert.equal(selection.project, PROJECT, 'Project changed before write');
    assert.equal((await this.request('host.info')).hostVersion, this.state.config.version);
    assert.equal((await this.request('rig.stats')).initEpochMs, this.init, 'Extension restarted');
    assert.equal((await this.request('cursor.playState', { cursor: 'fine' })).isPlaying, false, 'Stop playback before a write');
    const rows = await this.rows(); assertOwned(this.state.owned, rows);
    if (this.selection) equal(compactSelection(selection, rows), this.selection, 'Operator selection changed before write');
  }
  id(role: string): string {
    const item = this.state.owned.find((row: Bag) => row.role === role);
    assert(item, `No proved ownership for ${role}`); return item.id;
  }
  private async call(name: string, args: Bag): Promise<Bag> {
    const from = this.transport.calls.length, start = performance.now(), cpu = process.cpuUsage();
    const result = await callTool(this.workspace, name, args, AGENT_NATIVE_TOOL_PROFILE) as Bag;
    const elapsedMs = performance.now() - start, used = process.cpuUsage(cpu);
    const wire = wireSummary(this.transport.calls.slice(from));
    this.evidence.append('tools.jsonl', { commandId: this.commandId, name, args, elapsedMs,
      brainCpuMs: (used.user + used.system) / 1000, ...wire, result });
    return result;
  }
  async read(name: string, args: Bag): Promise<Bag> {
    assert(name.startsWith('read_') || name === 'check_bitwig_connection', 'Read-only operation required');
    const result = await this.call(name, args);
    assert(!result.failure, `${name}: ${JSON.stringify(result.failure)}`); return result;
  }
  async write(name: string, args: Bag, refusalCodes?: string[]): Promise<Bag> {
    validateBounds(name, args); await this.guard();
    // Every explicit target must be owned. Reversal IDs exist only in this workspace.
    const scan = (value: any): void => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (key === 'trackId') assert(this.state.owned.some((row: Bag) => row.id === child), 'Unowned write target');
        else if (key === 'trackIds') assert((child as string[]).every(id => this.state.owned.some((row: Bag) => row.id === id)), 'Unowned deletion');
        else scan(child);
      }
    };
    scan(args);
    if (name === 'revert_change') this.workspace.changes.require(args.changeId);
    this.state.pendingWrite = { name, args, commandId: this.commandId }; this.persist();
    const from = this.transport.calls.length, reply = await this.call(name, args);
    const writes = this.transport.calls.slice(from).filter(call => call.method === 'batch.run').length;
    if (refusalCodes) assertRefusal(reply, writes, refusalCodes);
    else {
      assert(!reply.failure && reply.applied !== false, `${name}: ${JSON.stringify(reply)}`);
      if (reply.readback?.status) assert(['verified', 'unchanged', 'already-set'].includes(reply.readback.status), `${name}: readback unavailable or differs`);
      assertVerification(reply, name);
    }
    delete this.state.pendingWrite; this.persist();
    const rows = await this.rows();
    const selected = compactSelection(await this.request('selection.status'), rows);
    if (this.selection) equal(selected, this.selection, `${name}: selection changed`);
    return reply;
  }
  async own(role: string, operation: () => Promise<Bag>): Promise<void> {
    assert(this.state.owned.length < LIMITS.tracks, 'Owned track bound');
    const before = await this.rows(), name = `${this.state.prefix}${role}`;
    assert(!before.some(row => row.name === name), 'Owned name collision');
    const reply = await operation(), after = await this.rows();
    const added = after.filter(row => !before.some(prior => prior.channelId === row.channelId));
    assert.equal(added.length, 1, 'Creation must add exactly one identity');
    const row = added[0]!; assert.equal(row.name, name); assert.equal(row.type, 'Instrument');
    const minted = reply.readback?.tracks?.map((r: Bag) => r.trackId) ?? [reply.readback?.copy?.trackId];
    assert(minted.includes(row.channelId), 'Independent track identity differs from creation receipt');
    this.state.owned.push({ role, id: row.channelId, name, type: row.type, createdIn: this.commandId }); this.persist();
  }
  forget(role: string): void {
    this.state.owned = this.state.owned.filter((row: Bag) => row.role !== role); this.persist();
  }
  async clip(role: string, row = 0): Promise<Bag> {
    return this.read('read_launcher_clip', { trackId: this.id(role), row, format: 'json', diagnostic: true });
  }
  async devices(role: string): Promise<Bag[]> { return this.deviceBank(this.id(role)); }
  private async deviceBank(id: string): Promise<Bag[]> {
    const read = await this.read('read_devices', { trackId: id });
    assert.equal(read.coverage.status, 'complete', 'Complete device bank required');
    return read.data.devices;
  }
  async controls(role: string, position: number): Promise<Bag> {
    const result = await this.read('read_device_controls', { device: { trackId: this.id(role), devicePosition: position } });
    assert.equal(result.standing, 'stable', 'Stable control identities required'); return result;
  }
  async inspectEditedSampler(role: string, source: Bag): Promise<Bag> {
    const path = join(this.state.config.workingPath, `${this.state.prefix}${role}-edited.bwpreset`);
    assert(!existsSync(path), 'Use a new host-export path');
    const started = Date.now();
    this.state.operatorPause = { role, path, started }; this.persist();
    const input = createInterface({ input: process.stdin, output: process.stdout });
    this.transport.pause();
    let answer: Bag;
    try {
      answer = JSON.parse(await input.question(`Use Save Preset to Library for the second Sampler on ${this.state.prefix}${role}, named ${this.state.prefix}${role}-edited. Copy that saved file to ${path}. `
        + 'Then enter one JSON line with operator, resourcesResolved, zonesChecked, details, and selectionRestored. No host calls run while waiting.\n'));
    } finally { input.close(); this.transport.resume(); }
    assert(answer.operator && answer.resourcesResolved === true && answer.zonesChecked === true
      && answer.selectionRestored === true && typeof answer.details === 'string' && answer.details.length > 20,
      'Actual sample, zone, and selection observations are required');
    assert(statSync(path).mtimeMs >= started && statSync(path).size <= 2 * 1024 ** 2, 'Fresh bounded host export required');
    const bytes = readFileSync(path), inspection = inspectPresetModulation(bytes);
    assert(inspection.supported, 'Host-saved preset inspection is unavailable');
    requireAddedAttackRoute(source, inspection);
    const resources = (data: Buffer) => Object.fromEntries([...readMeta(data)]
      .filter(([key]) => /^referenced_.*file/.test(key)));
    equal(resources(bytes), resources(readFileSync(this.state.config.presets[role].copy)),
      'Host export lost or changed a sample resource reference');
    const copy = join(this.evidence.dir, `sampler-${role}-host-export.bwpreset`);
    assert(!existsSync(copy)); assert(this.evidence.bytes + bytes.length < LIMITS.evidenceBytes - LIMITS.reserveBytes);
    copyFileSync(path, copy); this.evidence.bytes += bytes.length;
    delete this.state.operatorPause; this.persist();
    await this.guard();
    return { path, copy, sha256: sha(bytes), inspection, meta: Object.fromEntries(readMeta(bytes)), operator: answer };
  }
  async mixer(role: string): Promise<Bag> {
    const row = (await this.rows()).find(item => item.channelId === this.id(role)); assert(row);
    const raw = (await this.request('track.mixer', { tracks: [{ trackIndex: row.index, channelId: row.channelId }] })).tracks[0];
    return { volumeRaw: raw.volumeRaw, panRaw: raw.panRaw, mute: raw.mute, solo: raw.solo };
  }
  async snapshot(): Promise<Bag> {
    const selectionBefore = await this.request('selection.status'), rows = await this.rows();
    assert(rows.length <= 16, 'Snapshot track bound');
    const scenes = (await this.request('scene.count')).sceneCount;
    assert(scenes >= 7 && scenes <= LIMITS.scenes, 'Use seven or eight existing scene rows');
    const tracks: Bag[] = [];
    for (let offset = 0; offset < rows.length; offset += 8) {
      const part = rows.slice(offset, offset + 8);
      const mixer = (await this.request('track.mixer', { tracks: part.map(row => ({ trackIndex: row.index, channelId: row.channelId })) })).tracks;
      for (const row of part) {
        const m = mixer.find((item: Bag) => item.channelId === row.channelId); assert(m);
        const clips: Bag[] = [];
        if (!['Master', 'Effect'].includes(row.type)) for (let index = 0; index < scenes; index++) {
          const status = await this.request('slot.status', { trackIndex: row.index, slotIndex: index });
          assert(typeof status.hasContent === 'boolean', 'Unknown scene occupancy');
          if (row.type === 'Group') { clips.push({ row: index, occupied: status.hasContent, kind: 'group-launcher' }); continue; }
          if (!status.hasContent) { clips.push({ row: index, occupied: false }); continue; }
          const read = await this.read('read_launcher_clip', { trackId: row.channelId, row: index, format: 'json', diagnostic: true });
          const doc = documentOf(read); assert(doc.events.length <= LIMITS.notes, 'Snapshot note bound');
          assert(read.diagnostic, 'Independent full note read unavailable');
          clips.push({ row: index, occupied: true, music: musical(doc),
            metadata: read.diagnostic.metadata, channels: read.diagnostic.channels });
        }
        const devices = await this.deviceBank(row.channelId); assert(devices.length <= 4, 'Device snapshot bound');
        const controls: Bag[] = [];
        if (this.state.owned.some((o: Bag) => o.name === row.name)) for (const device of devices) {
          const read = await this.read('read_device_controls', { device: { trackId: row.channelId, devicePosition: device.devicePosition } });
          assert.equal(read.standing, 'stable');
          controls.push({ position: device.devicePosition, parameters: read.parameters.map((p: Bag) => ({
            id: p.id, name: p.name, normalizedValue: p.normalizedValue, discreteValueCount: p.discreteValueCount })) });
        }
        tracks.push({ id: row.channelId, index: row.index, name: row.name, type: row.type, hidden: row.hidden === true,
          mixer: { volumeRaw: m.volumeRaw, panRaw: m.panRaw, mute: m.mute, solo: m.solo }, clips, devices, controls });
      }
    }
    const selection = compactSelection(selectionBefore, rows);
    equal(compactSelection(await this.request('selection.status'), await this.rows()), selection, 'Snapshot moved selection');
    return { project: selectionBefore.project, scenes, selection, tracks };
  }
  async preflight(config: Bag): Promise<void> {
    assert(!this.state.config && !this.state.entry, 'Preflight is already sealed');
    this.state.config = config; await this.start();
    const snapshot = await this.snapshot();
    assert(snapshot.tracks.length <= 8);
    assert(snapshot.tracks.every((row: Bag) => row.devices.length === 0 && row.clips.every((clip: Bag) => !clip.occupied)),
      'Entry must be a fresh empty audit project');
    assert(!snapshot.tracks.some((row: Bag) => row.name.startsWith('gn-ua-')), 'Old audit material exists');
    requireEntrySelection(snapshot);
    this.state.entry = snapshot; this.state.last = snapshot;
    this.state.completed.push('preflight'); this.persist(); this.save('entry.json', snapshot);
  }
  async run(name: string): Promise<void> {
    assertMayRun(this.state, name); assert(CASES[name], 'Unknown case');
    assert(this.state.completed.includes('preflight'), 'Preflight required');
    if (name !== 'setup') assert(this.state.completed.includes('setup'), 'Setup required');
    assert(!this.state.pause, 'Complete the operator checkpoint first');
    await this.start();
    const before = await this.snapshot();
    equal(comparable(before), comparable(this.state.last), 'State changed between commands');
    assertOwned(this.state.owned, await this.rows());
    this.selection = before.selection;
    this.state.active = { name, commandId: this.commandId }; this.persist();
    await CASES[name]!(this);
    const after = await this.snapshot();
    const names = this.state.owned.map((row: Bag) => row.name);
    equal(comparable(preserved(after, names)), comparable(this.state.entry), 'Preserved entry changed');
    if (name !== 'setup') equal(comparable(after), comparable(before), 'Case did not restore the complete fixture');
    this.save(`${name}.json`, { before, after, passed: true });
    this.state.last = after; this.state.completed.push(name); delete this.state.active; this.persist();
  }
  async inspect(): Promise<void> {
    await this.start(); const snapshot = await this.snapshot();
    this.state.inspection = { snapshot, sha256: sha(canonical(snapshot)), at: new Date().toISOString() };
    this.save(`${this.commandId}-inspection.json`, this.state.inspection); this.persist();
    console.log('Read-only inspection saved. No write or automatic recovery was performed.');
  }
  async cleanup(): Promise<void> {
    assert(this.state.inspection, 'Run inspect before cleanup');
    assert(!this.state.cleaned, 'Cleanup already completed');
    assert(!this.state.pause || this.state.pause === 'save', 'Complete or restore the operator checkpoint before cleanup');
    await this.start(); const before = await this.snapshot();
    equal(before, this.state.inspection.snapshot, 'State changed since inspection');
    assertOwned(this.state.owned, await this.rows());
    const names = this.state.owned.map((row: Bag) => row.name);
    equal(comparable(preserved(before, names)), comparable(this.state.entry), 'Unowned material changed; inspect before cleanup');
    // An uncertain write requires a reviewed recovery change. Never adopt by name.
    assert(!this.state.pendingWrite, 'An uncertain write needs a reviewed recovery plan before deletion');
    this.cleanupMode = true; this.selection = before.selection;
    this.state.active = { name: 'cleanup', commandId: this.commandId }; this.persist();
    for (const item of [...this.state.owned].reverse()) {
      await this.write('delete_track', { trackIds: [item.id] });
      assert(!(await this.rows()).some(row => row.channelId === item.id), 'Deletion readback'); this.forget(item.role);
    }
    const after = await this.snapshot(); equal(comparable(after), comparable(this.state.entry), 'Final preserved state');
    this.save('cleanup.json', { before, after, passed: true });
    delete this.state.active; this.state.cleaned = true; this.state.last = after;
    this.state.pause = 'cleanup-save'; this.state.cleanedAt = Date.now(); this.persist();
    console.log(`Save the clean ${PROJECT} project. Then run checkpoint cleanup-saved.`);
  }
  async recoverEmptySelection(): Promise<void> {
    assert(this.state.inspection, 'Inspect the failed setup before recovery');
    await this.start(); const before = await this.snapshot();
    assert(statSync(join(this.evidence.dir, 'tools.jsonl')).size <= 2 * 1024 ** 2, 'Recovery tool log bound');
    const writes = readFileSync(join(this.evidence.dir, 'tools.jsonl'), 'utf8').trim().split('\n')
      .map(line => JSON.parse(line) as Bag)
      .filter(row => row.commandId === this.state.failure?.commandId && !row.name.startsWith('read_'));
    validateEmptySelectionRecovery(this.state, before, writes);
    assertOwned(this.state.owned, await this.rows());
    const target = { ...this.state.entry, selection: before.selection };
    this.state.recovery = { commandId: this.commandId, before, target, completed: false,
      reason: 'E258 no-entry-slot warning. The operator selected the original mixer track, row 0.' };
    this.persist(); this.cleanupMode = true; this.selection = before.selection;
    for (const item of [...this.state.owned].reverse()) {
      await this.write('delete_track', { trackIds: [item.id] });
      assert(!(await this.rows()).some(row => row.channelId === item.id), 'Recovery deletion readback');
      this.forget(item.role);
    }
    const after = await this.snapshot();
    equal(comparable(after), comparable(target), 'Recovery must preserve all content and the operator-selected slot');
    this.state.recovery.completed = true; this.state.recovery.after = after;
    this.state.cleaned = true; this.persist();
    this.save('empty-selection-recovery.json', this.state.recovery);
    console.log('Owned setup material removed. Content baseline restored; the original mixer track, row 0, remains selected. Keep this failed attempt. Prepare a new directory.');
  }
  async recoverControlReply(): Promise<void> {
    assert(this.state.inspection, 'Inspect before control recovery');
    await this.start(); const before = await this.snapshot();
    const path = join(this.evidence.dir, 'tools.jsonl');
    assert(statSync(path).size <= 2 * 1024 ** 2, 'Recovery tool log bound');
    const calls = readFileSync(path, 'utf8').trim().split('\n').map(line => JSON.parse(line) as Bag)
      .filter(row => row.commandId === this.state.failure?.commandId);
    const trackId = validateControlReplyRecovery(this.state, before, calls);
    assertOwned(this.state.owned, await this.rows());
    this.state.recovery = { kind: 'control-reply', commandId: this.commandId, before, completed: false,
      resolvedIntent: this.state.pendingWrite, resolution: 'Complete verified reply and independent control read agree.' };
    this.persist();
    delete this.state.pendingWrite; this.persist();
    this.cleanupMode = true; this.selection = before.selection;
    await this.write('delete_device', { devices: [2, 1, 0].map(devicePosition => ({ trackId, devicePosition })) });
    equal(await this.devices('devices'), [], 'Inserted devices removed');
    const after = await this.snapshot();
    equal(comparable(after), comparable(this.state.last), 'Complete fixture restored');
    this.state.recovery.completed = true; this.state.recovery.after = after; this.persist();
    this.save('control-reply-recovery.json', this.state.recovery);
    console.log('Inserted control-test devices removed. Complete fixture restored. Keep this failed record; fork-recovered creates a separate continuation.');
  }
  async recoverStructureReadback(): Promise<void> {
    assert(this.state.inspection, 'Complete inspection required');
    await this.start(); const before = await this.snapshot();
    const path = join(this.evidence.dir, 'tools.jsonl');
    assert(statSync(path).size <= 2 * 1024 ** 2, 'Recovery tool log bound');
    const calls = readFileSync(path, 'utf8').trim().split('\n').map(line => JSON.parse(line) as Bag)
      .filter(row => row.commandId === this.state.failure?.commandId);
    const trackId = validateStructureRecovery(this.state, before, calls);
    assertOwned(this.state.owned, await this.rows());
    this.state.recovery = { kind: 'structure-readback', commandId: this.commandId, before, completed: false,
      resolvedIntent: this.state.pendingWrite, resolution: 'Later complete independent inspection proves the disabled state.' };
    this.persist(); delete this.state.pendingWrite; this.persist();
    this.cleanupMode = true; this.selection = before.selection;
    await this.write('set_device_enabled', { settings: [{ trackId, devicePosition: 0, enabled: true }] });
    const enabled = await this.devices('devices');
    const prior = before.tracks.find((row: Bag) => row.id === trackId).devices;
    equal(enabled, prior.map((device: Bag) => ({ ...device, enabled: true })), 'Enabled restoration and nested content');
    this.save('enabled-recovery-readback.json', enabled);
    await this.write('delete_device', { devices: [{ trackId, devicePosition: 0 }] });
    equal(await this.devices('devices'), [], 'Owned container removed');
    const after = await this.snapshot(); equal(comparable(after), comparable(this.state.last), 'Complete fixture restored');
    this.state.recovery.completed = true; this.state.recovery.after = after; this.persist();
    this.save('structure-readback-recovery.json', this.state.recovery);
    console.log('Enabled state restored and owned container removed. Complete fixture restored. Keep this failed record; fork-recovered creates a separate continuation.');
  }
  async recoverSamplerName(exportPath: string): Promise<void> {
    assert(this.state.inspection, 'Complete inspection required');
    assert(statSync(exportPath).size <= 2 * 1024 ** 2, 'Bounded host export required');
    const bytes = readFileSync(exportPath), sourceBytes = readFileSync(this.state.config.presets.single.copy);
    const exported = inspectPresetModulation(bytes), source = inspectPresetModulation(sourceBytes);
    requireAddedAttackRoute(source, exported);
    assert.equal(readMeta(bytes).get('application_version_name'), this.state.config.version, 'Current host export required');
    const resources = (value: Buffer) => Object.fromEntries([...readMeta(value)].filter(([key]) => /^referenced_.*file/.test(key)));
    equal(resources(bytes), resources(sourceBytes), 'Sample references changed');
    await this.start(); const before = await this.snapshot();
    const log = join(this.evidence.dir, 'tools.jsonl');
    assert(statSync(log).size <= 2 * 1024 ** 2, 'Recovery tool log bound');
    const calls = readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line) as Bag)
      .filter(row => row.commandId === this.state.failure?.commandId);
    const trackId = validateSamplerNameRecovery(this.state, before, calls);
    assertOwned(this.state.owned, await this.rows());
    this.state.recovery = { kind: 'sampler-name', commandId: this.commandId, before, completed: false,
      resolvedIntent: this.state.pendingWrite, exportPath, exportSha256: sha(bytes), exported,
      resolution: 'Host export preserves both routes and sample references; complete live reads prove the exact inserted device.' };
    this.persist(); delete this.state.pendingWrite; this.persist();
    this.cleanupMode = true; this.selection = before.selection;
    await this.write('delete_device', { devices: [{ trackId, devicePosition: 1 }] });
    equal(await this.devices('single'), before.tracks.find((row: Bag) => row.id === trackId).devices.slice(0, 1), 'Original Sampler remains');
    const after = await this.snapshot(); equal(comparable(after), comparable(this.state.last), 'Complete fixture restored');
    this.state.recovery.completed = true; this.state.recovery.after = after; this.persist();
    this.save('sampler-name-recovery.json', this.state.recovery);
    console.log('Inserted Sampler removed after independent proof. Complete fixture restored. Keep this failure and fork a new continuation.');
  }
  async recoverGroupSnapshot(): Promise<void> {
    const path = join(this.evidence.dir, 'tools.jsonl');
    assert(statSync(path).size <= 2 * 1024 ** 2, 'Recovery tool log bound');
    const calls = readFileSync(path, 'utf8').trim().split('\n').map(line => JSON.parse(line) as Bag)
      .filter(row => row.commandId === this.state.failure?.commandId);
    validateGroupSnapshotRecovery(this.state, calls);
    await this.start(); const before = await this.snapshot();
    assertOwned(this.state.owned, await this.rows());
    validateGroupFixture(this.state, before);
    this.state.recovery = { kind: 'group-snapshot', commandId: this.commandId, completed: true, after: before,
      resolution: 'The failed checkpoint sent only readers. Complete group and child snapshots preserve the original fixture.' };
    this.persist(); this.save('group-snapshot-recovery.json', this.state.recovery);
    console.log('Read-only group inspection passed. No write was sent. Keep this failure and fork a separate continuation for group-after.');
  }
  async checkpoint(name: string, observation?: Bag): Promise<void> {
    assertMayRun(this.state, name);
    assert(this.state.completed.includes('setup'), 'Setup required');
    const away = name === 'switch-away';
    await this.start(away ? SWITCH_PROJECT : PROJECT);
    const before = await this.snapshot();
    this.state.active = { name, commandId: this.commandId }; this.persist();
    const finish = (snapshot: Bag) => {
      this.state.last = snapshot; this.state.completed.push(name); delete this.state.active; this.persist();
    };
    const pause = (kind: string, action: string) => {
      this.state.pause = kind; this.state.checkpoint = before;
      finish(before); console.log(action);
    };
    if (['selection-before', 'group-before', 'switch-before', 'save'].includes(name)) {
      assert(!this.state.pause, 'Another checkpoint is pending');
      equal(comparable(before), comparable(this.state.last), 'Checkpoint entry changed');
    }
    if (name === 'selection-before') {
      pause('selection', `Select the mixer track ${this.state.prefix}sentinel. Then run checkpoint selection-after.`);
    } else if (name === 'selection-after') {
      assert.equal(this.state.pause, 'selection');
      equal(comparable(before, false), comparable(this.state.checkpoint, false), 'Selection action changed content');
      assert.equal(before.selection.mixer, this.state.prefix + 'sentinel');
      assert.notEqual(canonical(before.selection), canonical(this.state.checkpoint.selection), 'No operator selection change observed');
      this.selection = before.selection; await CASES.mixer!(this);
      const after = await this.snapshot(); equal(comparable(after), comparable(before), 'Selection case readback');
      this.state.pause = 'selection-restore'; finish(after);
      console.log(`Restore the original selection ${JSON.stringify(this.state.checkpoint.selection)}. Then run checkpoint selection-restored.`);
    } else if (name === 'selection-restored') {
      assert.equal(this.state.pause, 'selection-restore');
      equal(comparable(before), comparable(this.state.checkpoint), 'Original selection not restored');
      delete this.state.pause; finish(before);
    } else if (name === 'group-before') {
      pause('group', `Group only ${this.state.prefix}notes and ${this.state.prefix}spare in a new group named ${this.state.prefix}group, then collapse it. Run checkpoint group-after.`);
    } else if (name === 'group-after') {
      assert.equal(this.state.pause, 'group');
      validateGroupFixture(this.state, before);
      this.selection = before.selection; await CASES.notes!(this);
      const after = await this.snapshot(); equal(comparable(after), comparable(before), 'Collapsed navigation changed folding or selection');
      this.save('group-after.json', { before, after }); this.state.pause = 'group-restore'; finish(after);
      console.log(`Ungroup the two audit tracks, remove the empty ${this.state.prefix}group, and restore selection ${JSON.stringify(this.state.checkpoint.selection)}. Then run checkpoint group-restored.`);
    } else if (name === 'group-restored') {
      assert.equal(this.state.pause, 'group-restore');
      equal(comparable(before), comparable(this.state.checkpoint), 'Group baseline not restored');
      delete this.state.pause; finish(before);
    } else if (name === 'switch-before') {
      pause('switch', `Open a separate empty ${SWITCH_PROJECT} project under ${this.state.config.workingPath}. Keep it stopped. Run checkpoint switch-away.`);
    } else if (name === 'switch-away') {
      assert.equal(this.state.pause, 'switch');
      assert(before.tracks.every((row: Bag) => !row.name.startsWith(this.state.prefix)), 'Old audit tracks survived project switch');
      this.save('switch-away.json', before); this.state.pause = 'switch-back';
      this.state.completed.push(name); delete this.state.active; this.persist();
      console.log(`Return to ${PROJECT}, stopped, with selection ${JSON.stringify(this.state.checkpoint.selection)}. Run checkpoint switch-back.`);
    } else if (name === 'switch-back' || name === 'reopen') {
      assert.equal(this.state.pause, name === 'reopen' ? 'reopen' : 'switch-back');
      equal(comparable(before), comparable(this.state.checkpoint), 'Project or persistence content differs');
      // A complete content comparison permits reacquisition. A name alone never does.
      for (const owned of this.state.owned) {
        const matches = before.tracks.filter((row: Bag) => row.name === owned.name && row.type === owned.type);
        assert.equal(matches.length, 1); owned.id = matches[0].id; owned.reacquiredIn = this.commandId;
      }
      this.persist(); assertOwned(this.state.owned, await this.rows());
      if (name === 'reopen') {
        assert.equal(hashFile(this.state.config.projectFile), this.state.savedFile.sha256, 'Saved file changed while reopening');
        this.save('persistence.json', { beforeSave: this.state.checkpoint, afterReopen: before,
          savedFile: this.state.savedFile, fileUnchangedOnReopen: true,
          limit: 'Normal readers do not expose sample zones or route amounts. Sampler operator evidence is separate.' });
      }
      this.selection = before.selection; await CASES.mixer!(this);
      const after = await this.snapshot(); equal(comparable(after), comparable(before), 'Fresh post-lifecycle write and reversal');
      delete this.state.pause; finish(after);
    } else if (name === 'save') {
      this.state.fileBeforeSave = { path: this.state.config.projectFile, sha256: hashFile(this.state.config.projectFile) };
      pause('save', `Save only ${PROJECT}. Then run checkpoint saved.`);
    } else if (name === 'saved') {
      assert.equal(this.state.pause, 'save');
      equal(comparable(before), comparable(this.state.checkpoint), 'Save changed live content');
      const file = this.state.config.projectFile, bytes = readFileSync(file);
      assert(bytes.length < 8 * 1024 ** 2, 'Saved fixture byte bound');
      const copy = join(this.evidence.dir, 'saved-project.bwproject');
      assert(!existsSync(copy), 'Saved checkpoint exists');
      assert(this.evidence.bytes + bytes.length < LIMITS.evidenceBytes - LIMITS.reserveBytes);
      copyFileSync(file, copy); this.evidence.bytes += bytes.length;
      this.state.savedFile = { path: file, sha256: sha(bytes), byteLength: bytes.length, copy };
      this.state.pause = 'reopen'; finish(before);
      console.log(`Close and reopen only ${PROJECT} from its full working path. Keep it stopped and restore the prior selection. Run checkpoint reopen.`);
    } else if (name === 'cleanup-saved') {
      assert.equal(this.state.pause, 'cleanup-save'); assert.equal(this.state.cleaned, true);
      equal(comparable(before), comparable(this.state.entry), 'Clean project changed');
      assert(statSync(this.state.config.projectFile).mtimeMs >= this.state.cleanedAt, 'Save the clean project first');
      if (this.state.savedFile) assert.notEqual(hashFile(this.state.config.projectFile), this.state.savedFile.sha256,
        'The saved project still contains the test fixture');
      this.save('clean-saved-file.json', { path: this.state.config.projectFile,
        sha256: hashFile(this.state.config.projectFile), observedAt: new Date().toISOString() });
      delete this.state.pause; finish(before);
    } else if (name === 'sampler-observation') {
      assert(!this.state.pause, 'Finish the current checkpoint');
      equal(comparable(before), comparable(this.state.last), 'Sampler observation changed project state');
      assert(observation?.operator && observation?.observedAt && observation?.playbackStopped === true);
      for (const role of ['single', 'multi']) {
        const report = observation[role];
        assert(report?.resourcesResolved === true && report?.zonesChecked === true && report?.audible === true,
          `${role}: resource, sample-zone, and listening evidence required`);
        assert(typeof report?.details === 'string' && report.details.trim().length > 20, 'Record the actual sample and zone observations');
        assert(report?.attackMappingBeforeSave === true && report?.attackMappingAfterReopen === true,
          `${role}: confirm the retained attack route before save and after reopen`);
        assert(Array.isArray(report.removedTargets) && report.removedTargets.length === 3);
        equal(report.removedTargets.map((r: Bag) => r.name).sort(), ['Envelope Mode', 'Freeze Playhead', 'Play Mode'], 'Three removed targets');
        for (const target of report.removedTargets) assert(['absent', 'refused', 'host-migrated'].includes(target.verdict)
          && typeof target.evidence === 'string' && target.evidence.length > 10, 'No silent successful preservation of removed targets');
      }
      assert(this.state.completed.includes('reopen'), 'Persistence check required before final Sampler observation');
      this.save('sampler-observation.json', observation); finish(before);
    } else throw new Error(`Unknown checkpoint: ${name}`);
    this.save(`${name}.json`, { snapshot: before, checkpoint: this.state.checkpoint, completedAt: new Date().toISOString() });
  }
}

export function report(state: Bag): Bag {
  const missing = [...REQUIRED, 'selection-restored'].filter(name => !state.completed.includes(name));
  return { status: !state.failure && state.cleaned && missing.length === 0 ? 'live-matrix-complete' : 'not-accepted',
    missing, failure: state.failure ?? null, active: state.active ?? null, pending: state.pause ?? null,
    cleaned: state.cleaned === true, note: 'Section 3 still records exact-build release notes and comparable performance results.' };
}

async function main(): Promise<void> {
  const [command, rawDir, arg, observationPath] = process.argv.slice(2);
  assert(rawDir, 'Usage: probe:upgrade-audit prepare|preflight|run|inspect|cleanup|recover-empty-selection|recover-control-reply|recover-structure-readback|recover-sampler-name|recover-group-snapshot|fork-recovered|checkpoint|report <dir> [config|case|checkpoint|new-dir] [observations.json]');
  const dir = resolve(rawDir);
  if (command === 'prepare') { prepare(dir); return; }
  if (command === 'fork-recovered') { assert(arg); forkRecovered(dir, resolve(arg)); return; }
  const evidence = new Evidence(dir), state = evidence.load('state.json');
  if (command === 'report') { const result = report(state); evidence.save('report.json', result); console.log(JSON.stringify(result, null, 2)); return; }
  const lock = join(dir, 'driver.lock');
  const fd = openSync(lock, 'wx');
  const audit = new Audit(evidence, state);
  try {
    if (command === 'preflight') { assert(arg); await audit.preflight(JSON.parse(readFileSync(resolve(arg), 'utf8'))); }
    else if (command === 'run') { assert(arg); await audit.run(arg); }
    else if (command === 'inspect') await audit.inspect();
    else if (command === 'cleanup') await audit.cleanup();
    else if (command === 'recover-empty-selection') await audit.recoverEmptySelection();
    else if (command === 'recover-control-reply') await audit.recoverControlReply();
    else if (command === 'recover-structure-readback') await audit.recoverStructureReadback();
    else if (command === 'recover-sampler-name') { assert(arg); await audit.recoverSamplerName(resolve(arg)); }
    else if (command === 'recover-group-snapshot') await audit.recoverGroupSnapshot();
    else if (command === 'checkpoint') {
      assert(arg); await audit.checkpoint(arg, observationPath ? JSON.parse(readFileSync(resolve(observationPath), 'utf8')) : undefined);
    } else throw new Error('Unknown command');
  } catch (error) {
    // Inspection must retain the first failure and the uncertain-write intent.
    state.failure ??= { command, arg, commandId: audit.commandId, error: String(error), at: new Date().toISOString() };
    evidence.save(`${audit.commandId}-failure.json`, { error: String(error), state }, true);
    audit.persist(); throw error;
  } finally {
    await audit.transport.close(); closeSync(fd); unlinkSync(lock);
  }
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => { console.error(String(error)); process.exitCode = 1; });
}
