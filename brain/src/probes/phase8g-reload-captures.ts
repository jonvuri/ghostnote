/** Verify a new controller instance from paired captures. Continuity stays unproved. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { identityEndpoint } from './phase8g-identity-fence.js';
import { INVENTORY_REVISION } from './phase8g-inventory-controls.js';
import { MUTATION_MARKER } from './phase8g-shadow-mutations.js';

type Wire = Record<string, unknown>;
export const AUTHORITY_REVISION = '8g-authority-transition-v1';
function object(value: unknown, name: string): Wire {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`); return value as Wire;
}
function text(value: unknown, name: string): string { assert(typeof value === 'string' && value.trim().length > 0, `${name} is unavailable`); return value; }
function epoch(value: unknown, name: string): number { assert(Number.isSafeInteger(value) && Number(value) > 0, `${name} is invalid`); return Number(value); }
function closedClaims(value: Wire): void {
  for (const flag of ['wholeSessionComplete', 'eligible', 'complete', 'identityDetectionProved', 'identityContinuityProved',
    'projectContinuityProved', 'hostInputFenceProved', 'absentCallbackDetectionProved'])
    if (Object.hasOwn(value, flag)) assert.equal(value[flag], false, `${flag} cannot be proved by a reload capture`);
}
function capture(value: unknown): { raw: Wire; root: Wire; info: Wire; stats: Wire; tracks: Wire; scenes: Wire; owner: string; at: number } {
  const raw = object(value, 'reload capture'); closedClaims(raw);
  const root = object(raw.root, 'root'), info = object(raw.info, 'info'), stats = object(raw.stats, 'stats');
  for (const record of [root, info]) closedClaims(record);
  assert.equal(info.complete, false); assert.equal(info.eligible, false); assert.equal(info.instrumentationRevision, MUTATION_MARKER);
  assert.equal(root.identityDetectionProved, false); assert.equal(root.hostInputFenceProved, false);
  assert.equal(root.callbacksChangedDuringRead, false); assert.equal(root.sequenceBeforeRead, root.sequenceAfterRead);
  assert.equal(stats.runtimeProfile, 'phase-8-probe-v1');
  const tracks = object(raw.tracks, 'tracks'), values = tracks.tracks as Wire[], scenes = object(raw.scenes, 'scenes');
  assert(Array.isArray(values) && values.length === 5); assert.equal(tracks.count, 5); assert.equal(tracks.itemCount, 5);
  assert.equal(tracks.bankSize, 256); assert.equal(scenes.sceneCount, 8);
  const ids = values.map((track, index) => {
    assert.equal(track.index, index); assert.equal(track.position, index); text(track.name, 'track name'); text(track.type, 'track type');
    const id = text(track.channelId, 'track UUID'); assert.match(id, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/); return id;
  });
  assert.equal(new Set(ids).size, 5); const owned = values.filter(track => track.name === 'gn-8g-reuse'); assert.equal(owned.length, 1);
  const owner = text(owned[0]!.channelId, 'owned track UUID'), at = Date.parse(text(raw.captured, 'capture timestamp'));
  assert(Number.isFinite(at));
  for (const field of ['extensionInitNonce', 'probeInstanceNonce']) text(root[field], field);
  text(info.initDomain, 'core init domain');
  assert(epoch(root.probeInitAtMs, 'probe init time') <= at); assert(epoch(stats.initEpochMs, 'extension init time') <= at);
  identityEndpoint(root, owner);
  return { raw, root, info, stats, tracks, scenes, owner, at };
}
/** Equal endpoint inputs and a new instance prove only the measured reload case. */
export function verifyReloadCaptures(beforeValue: unknown, afterValue: unknown): Wire {
  const before = capture(beforeValue), after = capture(afterValue);
  assert(after.at >= before.at, 'the after capture precedes the before capture');
  assert.equal(after.owner, before.owner); assert.deepEqual(after.tracks, before.tracks, 'ordered track census changed');
  assert.deepEqual(after.scenes, before.scenes, 'scene census changed');
  assert.deepEqual(identityEndpoint(after.root, after.owner), identityEndpoint(before.root, before.owner), 'root and four-chain endpoint inputs changed');
  for (const field of ['extensionInitNonce', 'probeInstanceNonce']) assert.notEqual(after.root[field], before.root[field], `${field} did not change`);
  assert.notEqual(after.info.initDomain, before.info.initDomain, 'core init domain did not change');
  assert(epoch(after.root.probeInitAtMs, 'new probe init time') > epoch(before.root.probeInitAtMs, 'old probe init time'));
  const initialized = epoch(after.stats.initEpochMs, 'new extension init time');
  assert(initialized > epoch(before.stats.initEpochMs, 'old extension init time')); assert(initialized > before.at, 'new extension initialization must follow the before capture');
  assert.equal(after.info.authorityBindingRevision, AUTHORITY_REVISION); assert.equal(after.info.inventoryControlRevision, INVENTORY_REVISION);
  assert.equal(after.info.inventoryControlMaximumBatchCells, 64);
  return { researchOnly: true, complete: false, eligible: false, wholeSessionComplete: false,
    loadedInstanceNonceChanged: true, coreInitDomainChanged: true, initTimesChanged: true,
    endpointInputsEqual: true, orderedTrackCensusEqual: true, sceneCount: 8, chainUUIDsEqual: true,
    authorityBindingRevision: AUTHORITY_REVISION, inventoryControlRevision: INVENTORY_REVISION,
    projectContinuityProved: false, identityDetectionProved: false, identityContinuityProved: false, hostInputFenceProved: false,
    absentCallbackDetectionProved: false, ownedTrackId: before.owner,
    beforeExtensionInitNonce: before.root.extensionInitNonce, afterExtensionInitNonce: after.root.extensionInitNonce,
    beforeCoreInitDomain: before.info.initDomain, afterCoreInitDomain: after.info.initDomain,
    beforeInitEpochMs: before.stats.initEpochMs, afterInitEpochMs: after.stats.initEpochMs };
}
async function main(): Promise<void> {
  assert.equal(process.argv[2], 'verify', 'use verify <before.json> <after.json>');
  const before = process.argv[3], after = process.argv[4]; assert(before && after && before !== after, 'verification needs two separate capture paths');
  const values = await Promise.all([readFile(before, 'utf8'), readFile(after, 'utf8')]);
  console.log(JSON.stringify(verifyReloadCaptures(JSON.parse(values[0]!), JSON.parse(values[1]!)), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch(error => { console.error(error); process.exitCode = 1; });
