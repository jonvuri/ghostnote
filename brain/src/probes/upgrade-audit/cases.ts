/** Small product cases. Each write has a separate read. */
import assert from 'node:assert/strict';
import { EVENT_DEFAULTS, parse, serialize, type StateDocument } from '../../document/index.js';
import { volumeRawOfDb } from '../../contract/index.js';
import { canonical, equal, type Bag } from './safety.js';

/** Compare a host export with the source. Keep the original route multiset. */
export function requireAddedAttackRoute(source: Bag, exported: Bag): void {
  assert(source.supported && exported.supported, 'Preset inspection must be complete');
  const routes = (inventory: Bag) => inventory.modulation.flatMap((location: Bag) => {
    const family = location.modulators.filter((modulator: Bag) => modulator.category === 'LFO');
    const labels = family.map((modulator: Bag) => modulator.name);
    const numbered = labels.every((name: string, index: number) => name === `LFO ${index + 1}`);
    assert(labels.every((name: string) => name === 'LFO') || numbered, 'Unexpected LFO labels or order');
    return location.modulators.flatMap((modulator: Bag) => modulator.routes.map((route: Bag) => ({
      location: location.location, modulatorPosition: modulator.position,
      modulator: modulator.category === 'LFO' ? 'LFO' : modulator.name,
      target: route.target, rangeLo: route.rangeLo, rangeHi: route.rangeHi,
      amount: Math.round(route.amount * 1e6) / 1e6 })));
  });
  const remaining = routes(exported);
  for (const route of routes(source)) {
    const index = remaining.findIndex((candidate: Bag) => canonical(candidate) === canonical(route));
    assert(index >= 0, 'A retained source route was lost in the host export'); remaining.splice(index, 1);
  }
  assert.equal(remaining.length, 1, 'One new route required');
  assert.equal(remaining[0].modulatorPosition, source.modulation[0].modulators.length, 'New route belongs to the appended modulator');
  assert.equal(remaining[0].target.parameter?.parameterId, 'CONTENTS/AMP_ATTACK_TIME');
  assert(Math.abs(remaining[0].amount - 0.3) < 1e-5, 'Host-saved attack route amount');
}

export interface AuditCase {
  state: Bag;
  read(name: string, args: Bag): Promise<Bag>;
  write(name: string, args: Bag, refusalCodes?: string[]): Promise<Bag>;
  id(role: string): string;
  clip(role: string, row?: number): Promise<Bag>;
  devices(role: string): Promise<Bag[]>;
  controls(role: string, position: number): Promise<Bag>;
  mixer(role: string): Promise<Bag>;
  own(role: string, operation: () => Promise<Bag>): Promise<void>;
  forget(role: string): void;
  save(name: string, value: unknown): void;
  inspectEditedSampler(role: string, source: Bag): Promise<Bag>;
}

export function desiredFixture(): Bag {
  return { format: 'ghostnote-document', version: '1.0', kind: 'desired',
    clips: [{ id: 'c1', length: '4', loop: { from: '0', to: '4' } }],
    coverage: [{ clip: 'c1', channels: Array.from({ length: 16 }, (_, i) => i + 1), fields: 'all',
      status: 'complete', from: '0', to: '4' }],
    events: [
      { id: 'n1', clip: 'c1', at: '0', duration: '1/2', pitch: 60, velocity: 90, channel: 1 },
      { id: 'n2', clip: 'c1', at: '17/16', duration: '7/16', pitch: 64, velocity: 83, channel: 2,
        expression: { ...EVENT_DEFAULTS.expression, gain: 0.8, pan: -0.25, timbre: 0.4, transpose: 0.25 } },
      { id: 'n3', clip: 'c1', at: '2', duration: '1/4', pitch: 67, velocity: 75, channel: 1 },
      { id: 'n4', clip: 'c1', at: '49/16', duration: '5/16', pitch: 72, velocity: 86, channel: 2 }], overlays: [] };
}
export function documentOf(read: Bag): StateDocument {
  return parse(typeof read.data.document === 'string' ? read.data.document : JSON.stringify(read.data.document),
    typeof read.data.document === 'string' ? 'fields' : 'json') as StateDocument;
}
/** Session-local IDs and base references are not musical content. */
export function musical(document: Bag): Bag {
  return { clips: document.clips.map(({ id: _id, ...clip }: Bag) => clip),
    events: document.events.map(({ id: _id, clip: _clip, ...event }: Bag) => event)
      .sort((a: Bag, b: Bag) => JSON.stringify(a).localeCompare(JSON.stringify(b))) };
}
const patch = (read: Bag, id: string, velocity: number): string => [
  'DOC ghostnote-document 1.0 patch', `BASE ${JSON.stringify(read.authority.base)}`,
  'FIELDS id clip at duration pitch velocity channel', `UPDATE ${id} {"velocity":${velocity}}`, ''].join('\n');
const changeIds = (reply: Bag): string[] => {
  if (reply.parameterChanges) return reply.parameterChanges.flatMap((item: Bag) => item.changes.map((c: Bag) => c.changeId));
  if (reply.change?.changeId) return [reply.change.changeId];
  return (reply.effects ?? []).map((item: Bag) => item.changeId);
};
async function revert(a: AuditCase, reply: Bag): Promise<void> {
  const ids = changeIds(reply); assert(ids.length > 0, 'No in-session reversal identity');
  for (const changeId of ids.reverse()) await a.write('revert_change', { changeId });
}
const at = (a: AuditCase, role: string, row = 0) => ({ trackId: a.id(role), row });
const values = (read: Bag) => read.parameters.map((p: Bag) => [p.id, p.name, p.normalizedValue]);

export async function setup(a: AuditCase): Promise<void> {
  for (const role of ['sentinel', 'notes', 'spare', 'devices', 'single', 'multi']) {
    await a.own(role, () => a.write('add_tracks', { tracks: [{ name: `${a.state.prefix}${role}` }] }));
  }
  for (const role of ['sentinel', 'notes', 'single', 'multi']) {
    await a.write('add_launcher_clip', { ...at(a, role), format: 'json', document: desiredFixture() });
    const read = documentOf(await a.clip(role));
    assert.equal(read.events.length, 4);
    equal(musical(read), musical(parse(JSON.stringify(desiredFixture()), 'json') as StateDocument), 'Fixture note content');
  }
  await a.write('set_track_mixer', { tracks: ['sentinel', 'notes', 'spare', 'devices', 'single', 'multi']
    .map(role => ({ trackId: a.id(role), volumeDb: -18, mute: true })) });
  for (const role of ['single', 'multi']) {
    await a.write('add_devices', { trackId: a.id(role), devices: [{ kind: 'preset', path: a.state.config.presets[role].copy }] });
    equal((await a.devices(role)).map(item => item.name), ['Sampler'], 'Loaded Sampler identity');
    const controls = await a.controls(role, 0);
    assert(controls.parameters.some((p: Bag) => p.id === 'CONTENTS/AMP_ATTACK_TIME'), 'Sampler attack target missing');
  }
}

export async function notes(a: AuditCase): Promise<void> {
  const first = await a.clip('notes'), before = documentOf(first), subject = before.events[0]!;
  const edited = await a.write('edit_launcher_clip', { ...at(a, 'notes'), document: patch(first, subject.id, 55) });
  const after = documentOf(await a.clip('notes'));
  const expected = { ...before, events: before.events.map(event => event.id === subject.id ? { ...event, velocity: 55 } : event) };
  equal(musical(after), musical(expected), 'Sparse edit and unrelated expressive notes');
  const staleBefore = await a.clip('notes');
  await a.write('edit_launcher_clip', { ...at(a, 'notes'), document: patch(first, subject.id, 44) }, ['stale-base', 'stale', 'target-changed']);
  equal(musical(documentOf(await a.clip('notes'))), musical(documentOf(staleBefore)), 'Stale refusal changes nothing');
  await revert(a, edited);
  equal(musical(documentOf(await a.clip('notes'))), musical(before), 'Sparse reversal');
  const fresh = await a.clip('notes'), doc = documentOf(fresh);
  const desired = { ...doc, kind: 'desired', base: fresh.authority.base,
    coverage: doc.coverage.map(item => ({ ...item, fields: 'all' })),
    events: doc.events.map((event, i) => i === 2 ? { ...event, velocity: 52 } : event) } as StateDocument;
  const replaced = await a.write('edit_launcher_clip', { ...at(a, 'notes'),
    document: serialize(desired, 'fields'), readback: 'document' });
  equal(musical(documentOf(await a.clip('notes'))), musical(desired), 'Desired write preserves unrelated notes');
  await revert(a, replaced);
  equal(musical(documentOf(await a.clip('notes'))), musical(before), 'Desired reversal');
}

export async function clips(a: AuditCase): Promise<void> {
  const source = musical(documentOf(await a.clip('notes')));
  await a.write('copy_launcher_clips', { copies: [{ source: at(a, 'notes'), destination: at(a, 'notes', 4) }] });
  equal(musical(documentOf(await a.clip('notes', 4))), source, 'Nonadjacent copy');
  equal(musical(documentOf(await a.clip('notes'))), source, 'Source preserved');
  await a.write('copy_launcher_clips', { copies: [{ source: at(a, 'notes'), destination: at(a, 'notes', 4) }] }, ['collision', 'occupied']);
  equal(musical(documentOf(await a.clip('notes', 4))), source, 'Occupied destination preserved');
  await a.write('move_launcher_clips', { trackId: a.id('notes'), firstRow: 4, lastRow: 4, destinationFirstRow: 6 });
  equal(musical(documentOf(await a.clip('notes', 6))), source, 'Moved clip content');
  assert.equal((await a.clip('notes', 4)).data.occupancy, 'empty');
  await a.write('move_launcher_clips', { trackId: a.id('notes'), firstRow: 6, lastRow: 6, destinationFirstRow: 4 });
  await a.write('delete_launcher_clip', { clips: [at(a, 'notes', 4)] });
  assert.equal((await a.clip('notes', 4)).data.occupancy, 'empty');
  await a.own('duplicate', () => a.write('duplicate_track', { trackId: a.id('notes'), name: `${a.state.prefix}duplicate` }));
  equal(musical(documentOf(await a.clip('duplicate'))), source, 'Track copy');
  await a.write('delete_track', { trackIds: [a.id('duplicate')] });
  a.forget('duplicate');
  equal(musical(documentOf(await a.clip('notes'))), source, 'Track source preserved');
}

export async function mixer(a: AuditCase): Promise<void> {
  const before = await a.mixer('notes');
  const changed = await a.write('set_track_mixer', { tracks: [{ trackId: a.id('notes'),
    volumeDb: -12, pan: -0.4, mute: false, solo: true }] });
  const after = await a.mixer('notes');
  assert(Math.abs(after.volumeRaw - volumeRawOfDb(-12)) < 1e-8);
  assert(Math.abs(after.panRaw + 0.4) < 1e-8 && after.mute === false && after.solo === true);
  await revert(a, changed);
  equal(await a.mixer('notes'), before, 'Raw mixer restored');
}

export async function controls(a: AuditCase): Promise<void> {
  const added = await a.write('add_devices', { trackId: a.id('devices'), devices: [
    { kind: 'native', name: 'Polysynth' }, { kind: 'native', name: 'Polysynth' }, a.state.config.plugin] });
  assert.equal((await a.devices('devices')).length, 3);
  const initial = [];
  for (let position = 0; position < 3; position++) initial.push(await a.controls('devices', position));
  for (let position = 0; position < 3; position++) {
    const current = await a.controls('devices', position);
    const parameter = current.parameters.find((p: Bag) => p.writable !== false && !p.hasAutomation
      && typeof p.normalizedValue === 'number' && p.discreteValueCount === undefined);
    assert(parameter, 'No bounded continuous control is available');
    const value = parameter.normalizedValue < 0.5 ? 0.75 : 0.25;
    const changed = await a.write('set_device_controls', { settings: [{ kind: 'direct',
      device: { trackId: a.id('devices'), devicePosition: position }, parameterId: parameter.id, normalizedValue: value }] });
    // Read the other same-type instance first. Then reacquire the changed target.
    const other = position === 0 ? 1 : 0;
    equal(values(await a.controls('devices', other)), values(initial[other]!), 'Other instance preserved');
    const read = await a.controls('devices', position);
    assert(Math.abs(read.parameters.find((p: Bag) => p.id === parameter.id).normalizedValue - value) < 1e-6);
    await revert(a, changed);
    equal(values(await a.controls('devices', position)), values(initial[position]!), 'Control restored');
  }
  await revert(a, added);
  equal(await a.devices('devices'), [], 'Devices removed');
}

export async function structure(a: AuditCase): Promise<void> {
  await a.write('compose_devices', { trackId: a.id('devices'), containerKind: 'FX Layer',
    layerChains: [{ name: 'A', devices: [{ source: { kind: 'native', name: 'Polysynth' } }] },
      { name: 'B', devices: [{ source: { kind: 'native', name: 'Tool' } }] }] });
  const baseline = await a.devices('devices');
  equal(baseline[0]?.container.layerChains.map((c: Bag) => c.devices.map((d: Bag) => d.name)),
    [['Polysynth'], ['Tool']], 'Nested composition');
  const added = await a.write('add_devices', { trackId: a.id('devices'), devices: [{ kind: 'native', name: 'Delay+' }] });
  assert(added.applied);
  await a.write('copy_devices', { trackId: a.id('devices'), devices: [{ from: 'top-level', devicePosition: 1 }],
    destination: { to: 'layer-chain', containerPosition: 0, layerChain: 'A' } });
  let read = await a.devices('devices');
  equal(read.map(d => d.name), ['FX Layer', 'Delay+'], 'Copy source preserved');
  equal(read[0]?.container.layerChains[0].devices.map((d: Bag) => d.name), ['Polysynth', 'Delay+'], 'Nested copy');
  await a.write('move_devices', { trackId: a.id('devices'), devices: [{ from: 'top-level', devicePosition: 1 }],
    destination: { to: 'layer-chain', containerPosition: 0, layerChain: 'B' } });
  read = await a.devices('devices');
  equal(read.map(d => d.name), ['FX Layer'], 'Move source removed');
  equal(read[0]?.container.layerChains.map((c: Bag) => c.devices.map((d: Bag) => d.name)),
    [['Polysynth', 'Delay+'], ['Tool', 'Delay+']], 'Nested move and preserved devices');
  const off = await a.write('set_device_enabled', { settings: [{ trackId: a.id('devices'), devicePosition: 0, enabled: false }] });
  assert.equal((await a.devices('devices'))[0]?.enabled, false);
  await revert(a, off);
  assert.equal((await a.devices('devices'))[0]?.enabled, true);
  await a.write('delete_device', { devices: [{ trackId: a.id('devices'), devicePosition: 0 }] });
  equal(await a.devices('devices'), [], 'Owned structure removed; no unsupported move reversal claimed');
}

export async function sampler(a: AuditCase): Promise<void> {
  for (const role of ['single', 'multi']) {
    const presetPath = a.state.config.presets[role].copy;
    const before = await a.read('read_preset_modulation', { presetPath });
    assert.equal(before.supported, true);
    const originalControls = values(await a.controls(role, 0));
    const edited = await a.write('edit_preset_modulation', { trackId: a.id(role), presetPath,
      fingerprint: before.fingerprint, location: { kind: 'self' }, operation: {
        kind: 'add', modulator: 'lfo', target: 'sampler-amp-attack', amount: 0.3 } });
    const devices = await a.devices(role);
    assert.equal(devices.length, 2, 'Preset edit inserts an owned device beside the original');
    const read = await a.controls(role, 1);
    assert(read.parameters.some((p: Bag) => p.id === 'CONTENTS/AMP_ATTACK_TIME'), 'New target exists');
    const remotes = await a.read('read_device_controls', { device: { trackId: a.id(role), devicePosition: 1 }, view: 'remote-controls' });
    const hostExport = await a.inspectEditedSampler(role, before);
    a.save(`sampler-${role}-edit.json`, { source: before, controls: read, remotes, hostExport });
    await revert(a, edited);
    equal((await a.devices(role)).map(d => d.name), ['Sampler'], 'Sampler edit reversal');
    equal(values(await a.controls(role, 0)), originalControls, 'Original Sampler controls preserved');
    equal((await a.read('read_preset_modulation', { presetPath })).fingerprint, before.fingerprint, 'Copied donor stays unchanged');
  }
}
export const CASES: Record<string, (audit: AuditCase) => Promise<void>> = { setup, notes, clips, mixer, controls, structure, sampler };
