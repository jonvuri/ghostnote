// 8h3e removed the research wire or rig configuration that this live driver uses. Live use needs the
// earlier research build of its own session. Its retained artifacts and offline checks do not need a host.
/** Read optional loaded-chain witnesses on an owned identity fixture. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { BridgeClient } from '../client.js';

type Wire = Record<string, unknown>;
const MARKER = '8g-root-existing-chain-v1';
interface Candidate {
  readonly trackWindowIndex: number; readonly deviceWindowIndex: number; readonly layerWindowIndex: number;
  readonly trackChannelId: string | null; readonly trackName: string | null; readonly trackPosition: number | null;
  readonly trackDeviceCount: number | null; readonly deviceName: string | null; readonly devicePosition: number | null;
  readonly hasLayers: boolean | null; readonly layerCount: number | null;
  readonly chainChannelId: string | null; readonly chainName: string | null; readonly chainDeviceCount: number | null;
}
export interface CaptureSummary {
  readonly label: string; readonly projectName: string; readonly rootChannelId: string;
  readonly candidateCount: number; readonly readableCandidates: boolean; readonly endpointStable: boolean;
  readonly traceDrops: number; readonly traceComplete: boolean; readonly structuralFingerprint: string | null;
}
export interface PairSummary {
  readonly from: string; readonly to: string; readonly chainUUIDs: 'same' | 'different' | 'unknown';
  readonly reason: string; readonly comparedChains: number; readonly changedChainUUIDs: number;
  readonly traceComplete: boolean;
}
interface ParsedCapture { readonly summary: CaptureSummary; readonly candidates: readonly Candidate[]; readonly rootBound: boolean }
const bridge = new BridgeClient(), OUTPUT = '/tmp/ghostnote-8g-chain-witness-results.json';
function object(value: unknown, name: string): Wire {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`);
  return value as Wire;
}
function integer(value: unknown, name: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  assert(typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max, `${name} is out of bounds`);
  return value;
}
function text(value: unknown, name: string): string { assert.equal(typeof value, 'string', `${name} must be a string`); return value as string; }
function read(current: Wire, name: string): unknown {
  const row = object(current[name], `${name} read`); assert.equal(row.status, 'read', `${name} needs a successful read`);
  assert(Object.hasOwn(row, 'value'), `${name} needs its original value`); return row.value;
}
function nullable(value: unknown, kind: 'string' | 'number' | 'boolean', name: string): void {
  if (value === null) return;
  assert.equal(typeof value, kind, `${name} has the wrong type`);
  if (kind === 'number') integer(value, name);
}
function sourceValue(current: Wire, path: string, expected: unknown): void {
  const row = object(current[path], path);
  assert(Object.hasOwn(row, 'value'), `${path} must retain its value`);
  if (expected === null) { assert(row.value === null && row.status !== 'read', `${path} must explain its unknown candidate value`); }
  else { assert.equal(row.status, 'read'); assert.deepEqual(row.value, expected, `${path} differs from the candidate`); }
}
function parseCapture(value: unknown): ParsedCapture {
  const capture = object(value, 'capture'), label = text(capture.label, 'capture label');
  const snapshot = object(capture.snapshot, `${label} snapshot`), trace = object(capture.trace, `${label} trace`);
  for (const state of [snapshot, trace]) {
    assert.equal(state.instrumentationRevision, MARKER, 'the running root instrumentation marker must match');
    assert.equal(state.purpose, 'root-identity-research'); assert.equal(state.identityDetectionProved, false);
    text(state.extensionInitNonce, 'extensionInitNonce'); text(state.probeInstanceNonce, 'probeInstanceNonce');
    integer(state.sequence, 'sequence'); integer(state.callbackCount, 'callbackCount');
    integer(state.traceDroppedTotal, 'traceDroppedTotal'); integer(state.traceDroppedSinceClear, 'traceDroppedSinceClear');
    assert(Number(state.traceDroppedSinceClear) <= Number(state.traceDroppedTotal));
  }
  assert.equal(snapshot.extensionInitNonce, trace.extensionInitNonce); assert.equal(snapshot.probeInstanceNonce, trace.probeInstanceNonce);
  const before = integer(snapshot.sequenceBeforeRead, 'sequenceBeforeRead'), after = integer(snapshot.sequenceAfterRead, 'sequenceAfterRead');
  assert(after >= before); assert.equal(typeof snapshot.callbacksChangedDuringRead, 'boolean');
  assert.equal(snapshot.callbacksChangedDuringRead, before !== after); assert(Number(trace.sequence) >= after);
  const capacity = integer(trace.traceCapacity, 'traceCapacity', 1, 2048), retained = integer(trace.traceRetained, 'traceRetained', 0, capacity);
  assert(Array.isArray(trace.events)); assert.equal(trace.events.length, retained);
  let last = 0;
  for (const value of trace.events) { const event = object(value, 'trace event'); const sequence = integer(event.sequence, 'event sequence', 1);
    assert(sequence > last && sequence <= Number(trace.sequence), 'trace event sequence must increase'); last = sequence; }
  const current = object(snapshot.current, 'root current');
  for (const name of ['projectExists', 'rootExists', 'hasActiveEngine']) assert.equal(typeof read(current, name), 'boolean');
  const projectName = text(read(current, 'projectName'), 'projectName'), rootChannelId = text(read(current, 'rootChannelId'), 'rootChannelId');
  text(read(current, 'masterChannelId'), 'masterChannelId');
  const witness = object(snapshot.existingChainWitnesses, 'existingChainWitnesses');
  assert.equal(witness.loadedInstanceIdentityProved, false); assert.equal(witness.settlementProved, false); assert.equal(witness.scopeComplete, false);
  const tracks = integer(witness.trackWindow, 'trackWindow', 1, 4), devices = integer(witness.deviceWindowPerTrack, 'deviceWindowPerTrack', 1, 4);
  const layers = integer(witness.layerWindowPerDevice, 'layerWindowPerDevice', 1, 4);
  const count = integer(witness.candidateCount, 'candidateCount', 0, tracks * devices * layers); assert(Array.isArray(witness.candidates));
  assert.equal(witness.candidates.length, count); const witnessCurrent = object(witness.current, 'witness current');
  const candidates: Candidate[] = [], slots = new Set<string>();
  for (const value of witness.candidates) {
    const row = object(value, 'candidate');
    const t = integer(row.trackWindowIndex, 'trackWindowIndex', 0, tracks - 1), d = integer(row.deviceWindowIndex, 'deviceWindowIndex', 0, devices - 1);
    const l = integer(row.layerWindowIndex, 'layerWindowIndex', 0, layers - 1), slot = `${t}/${d}/${l}`;
    assert(!slots.has(slot), 'candidate window coordinates must be unique'); slots.add(slot);
    for (const key of ['trackChannelId', 'trackName', 'deviceName', 'chainChannelId', 'chainName']) nullable(row[key], 'string', key);
    for (const key of ['trackPosition', 'trackDeviceCount', 'devicePosition', 'layerCount', 'chainDeviceCount']) nullable(row[key], 'number', key);
    nullable(row.hasLayers, 'boolean', 'hasLayers');
    if (row.trackDeviceCount !== null && row.devicePosition !== null) assert(Number(row.devicePosition) < Number(row.trackDeviceCount));
    if (row.layerCount !== null) assert(Number(row.layerCount) > l, 'candidate must be within its source layer count');
    const tp = `chainWitness.track.${t}`, dp = `${tp}.device.${d}`, lp = `${dp}.layer.${l}`;
    for (const path of [`${tp}.exists`, `${dp}.exists`, `${lp}.exists`]) sourceValue(witnessCurrent, path, true);
    const mapping: Record<string, string> = { trackChannelId: `${tp}.channelId`, trackName: `${tp}.name`, trackPosition: `${tp}.position`,
      trackDeviceCount: `${tp}.deviceCount`, deviceName: `${dp}.name`, devicePosition: `${dp}.position`, hasLayers: `${dp}.hasLayers`,
      layerCount: `${dp}.layerCount`, chainChannelId: `${lp}.channelId`, chainName: `${lp}.name`, chainDeviceCount: `${lp}.deviceCount` };
    for (const [key, path] of Object.entries(mapping)) sourceValue(witnessCurrent, path, row[key]);
    candidates.push({ trackWindowIndex: t, deviceWindowIndex: d, layerWindowIndex: l,
      trackChannelId: row.trackChannelId as string | null, trackName: row.trackName as string | null,
      trackPosition: row.trackPosition as number | null, trackDeviceCount: row.trackDeviceCount as number | null,
      deviceName: row.deviceName as string | null, devicePosition: row.devicePosition as number | null,
      hasLayers: row.hasLayers as boolean | null, layerCount: row.layerCount as number | null,
      chainChannelId: row.chainChannelId as string | null, chainName: row.chainName as string | null,
      chainDeviceCount: row.chainDeviceCount as number | null });
  }
  candidates.sort((a, b) => a.trackWindowIndex - b.trackWindowIndex || a.deviceWindowIndex - b.deviceWindowIndex || a.layerWindowIndex - b.layerWindowIndex);
  const readable = count > 0 && candidates.every(candidate => Object.values(candidate).every(value => value !== null)
    && candidate.hasLayers === true && candidate.trackChannelId !== '' && candidate.chainChannelId !== '' && candidate.chainName !== '');
  const structure = candidates.map(({ chainChannelId: _uuid, ...source }) => source);
  const fingerprint = count > 0 && readable ? createHash('sha256').update(JSON.stringify(structure)).digest('hex') : null;
  const drops = Math.max(Number(snapshot.traceDroppedTotal), Number(trace.traceDroppedTotal));
  return { candidates, rootBound: read(current, 'projectExists') === true && read(current, 'rootExists') === true && rootChannelId !== '',
    summary: { label, projectName, rootChannelId, candidateCount: count, readableCandidates: readable,
      endpointStable: before === after && after === Number(snapshot.sequence) && after === Number(trace.sequence),
      traceDrops: drops, traceComplete: drops === 0, structuralFingerprint: fingerprint } };
}
function compare(a: ParsedCapture, b: ParsedCapture): PairSummary {
  const base = { from: a.summary.label, to: b.summary.label, comparedChains: 0, changedChainUUIDs: 0,
    traceComplete: a.summary.traceComplete && b.summary.traceComplete };
  if (!a.summary.endpointStable || !b.summary.endpointStable) return { ...base, chainUUIDs: 'unknown', reason: 'endpoint-sequence-changed' };
  if (!a.rootBound || !b.rootBound) return { ...base, chainUUIDs: 'unknown', reason: 'project-or-root-unbound' };
  if (!a.candidates.length || !b.candidates.length) return { ...base, chainUUIDs: 'unknown', reason: 'no-chain-witness' };
  if (!a.summary.readableCandidates || !b.summary.readableCandidates) return { ...base, chainUUIDs: 'unknown', reason: 'unreadable-source-or-chain' };
  if (a.summary.structuralFingerprint !== b.summary.structuralFingerprint) return { ...base, chainUUIDs: 'unknown', reason: 'source-structure-differs' };
  const changed = a.candidates.filter((candidate, index) => candidate.chainChannelId !== b.candidates[index]!.chainChannelId).length;
  return { ...base, comparedChains: a.candidates.length, changedChainUUIDs: changed,
    chainUUIDs: changed ? 'different' : 'same', reason: 'matched-source-structure' };
}
/** Compare observed UUIDs only for matched source structure. Do not infer project identity. */
export function verifyChainWitnessReport(value: unknown): { researchOnly: true; identityDetectionProved: false; captures: readonly CaptureSummary[]; pairs: readonly PairSummary[] } {
  const report = object(value, 'report'); assert.equal(report.researchOnly, true); assert.equal(report.identityDetectionProved, false);
  assert(Array.isArray(report.captures)); const captures = report.captures.map(parseCapture), pairs: PairSummary[] = [];
  for (let i = 0; i < captures.length; i++) for (let j = i + 1; j < captures.length; j++) pairs.push(compare(captures[i]!, captures[j]!));
  return { researchOnly: true, identityDetectionProved: false, captures: captures.map(capture => capture.summary), pairs };
}
async function request(method: string, params?: Wire): Promise<Wire> { return await bridge.request(method, params) as Wire; }
async function poll(read: () => Promise<Wire>, done: (value: Wire) => boolean): Promise<Wire> {
  const started = performance.now();
  for (;;) { const value = await read(); if (done(value)) return value;
    assert(performance.now() - started < 15_000, 'fixture operation did not settle'); await new Promise(resolve => setTimeout(resolve, 100)); }
}
async function capture(label: string): Promise<void> {
  const snapshot = await request('cache.shadow', { operation: 'rootSnapshot' });
  assert.equal(snapshot.instrumentationRevision, MARKER);
  const trace = await request('cache.shadow', { operation: 'rootTrace' });
  let report: Wire;
  try { report = JSON.parse(await readFile(OUTPUT, 'utf8')) as Wire; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    report = { researchOnly: true, identityDetectionProved: false, captures: [] }; }
  (report.captures as Wire[]).push({ label, at: new Date().toISOString(), snapshot, trace });
  await writeFile(OUTPUT, JSON.stringify(report, null, 2) + '\n');
  await request('cache.shadow', { operation: 'rootClearTrace' });
  const summary = parseCapture({ label, snapshot, trace }).summary;
  console.log(JSON.stringify({ ...summary, structuralFingerprint: summary.structuralFingerprint?.slice(0, 12) ?? null, rawFile: OUTPUT }));
}
async function setup(): Promise<void> {
  const root = await request('cache.shadow', { operation: 'rootSnapshot' });
  assert.equal(read(object(root.current, 'root current'), 'hasActiveEngine'), true,
    'activate the disposable project engine before fixture setup');
  const listed = await request('track.list');
  const tracks = listed.tracks as { index: number; name: string; channelId: string }[];
  const owned = tracks.find(track => track.name === 'gn-8g-chain-A');
  assert(owned && owned.index === 0, 'setup requires the owned named first track in the disposable A project');
  await request('cursor.pin', { cursor: '0', pinned: false });
  await request('cursor.pinTrack', { cursor: '0', pinned: false });
  await request('cursor.pointTrack', { cursor: '0', trackIndex: owned.index });
  await poll(() => request('cursor.status', { cursor: '0' }), value => value.trackExists === true && value.trackPosition === owned.index);
  await request('cursor.pinTrack', { cursor: '0', pinned: true });
  const devices = await request('device.list', { cursor: '0' });
  assert.equal(devices.count, 0, 'fixture setup refuses a track with existing devices');
  await request('device.insertFile', { cursor: '0', path: '/Users/jonvuri/Development/ghostnote/brain/fixtures/InstrumentLayer/gn_layer_4chain.bwpreset',
    expectedTrackChannelId: owned.channelId, expectedDeviceNames: [] });
  await poll(() => request('device.list', { cursor: '0' }), value => value.count === 1);
  const inventory = await poll(() => request('chain.inventory'), value => {
    const scopes = value.scopes as { chains: Wire[] }[]; return scopes[0]?.chains.length === 4;
  });
  const chains = (inventory.scopes as { chains: Wire[] }[])[0]!.chains;
  for (const [index, chain] of chains.entries()) {
    await request('chain.setName', { slot: 0, channelId: chain.channelId, name: `gn-8g-chain-${index}` });
  }
  await poll(() => request('chain.inventory'), value => (value.scopes as { chains: Wire[] }[])[0]!.chains
    .every((chain, index) => chain.name === `gn-8g-chain-${index}`));
  console.log('Four owned named chain witnesses are ready. Save the disposable A project before copying it.');
}
async function main(): Promise<void> {
  if (process.argv[2] === 'setup') await setup();
  else if (process.argv[2] === 'verify') console.log(JSON.stringify(verifyChainWitnessReport(JSON.parse(await readFile(process.argv[3] ?? OUTPUT, 'utf8'))), null, 2));
  else { assert.equal(process.argv[2], 'capture'); assert(process.argv[3]); await capture(process.argv.slice(3).join(' ')); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
