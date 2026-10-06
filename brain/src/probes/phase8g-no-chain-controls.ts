// 8h3e removed the research wire or rig configuration that this live driver uses. Live use needs the
// earlier research build of its own session. Its retained artifacts and offline checks do not need a host.
/** Check fail-closed no-chain diagnostics on the owned saved B project. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';

type Wire = Record<string, unknown>;
interface Track { channelId: string; name: string; index: number; position: number; type: string }
export const NO_CHAIN_ROOT = '1d13c40a-bc97-4f2f-b2f9-d14b2de7ef24';
export const NO_CHAIN_MAIN_IDS = ['29050218-0162-416b-ae10-0ea69adf1198', '38908264-b11a-4161-9d8d-70482b9e5ad1'] as const;
export const NO_CHAIN_FX_ID = '7361d54f-6540-408d-a933-f9412253bca3';
export const NO_CHAIN_PROJECT = '/tmp/ghostnote-8g-chain-projects/B/identity/identity.bwproject';
export const NO_CHAIN_MARKER = '8g-shadow-physical-hints-v5';
const OUTPUT = '/tmp/ghostnote-8g-no-chain-v5-results.json';
const SAVE_OUTPUT = '/tmp/ghostnote-8g-no-chain-save-v5-results.json';
const WIDTH = 2048, SCENES = 8, bridge = new BridgeClient();
const wait = async (): Promise<void> => await new Promise(resolve => setTimeout(resolve, 50));
async function request<T = Wire>(method: string, params?: Wire): Promise<T> { return await bridge.request(method, params) as T; }
async function shadow(operation: string, params: Wire = {}): Promise<Wire> { return await request('cache.shadow', { operation, ...params }); }
function read(root: Wire, name: string): unknown {
  const value = (root.current as Wire)[name] as Wire; assert.equal(value.status, 'read'); return value.value;
}
function closed(value: Wire): void { assert.equal(value.complete, false); assert.equal(value.eligible, false); }
function unknown(value: Wire): void {
  closed(value); assert.equal(value.instrumentationRevision, NO_CHAIN_MARKER);
  assert.equal(value.optionalLifecycleWitnessSupported, true); assert.equal(value.identityWitnessAvailable, false);
  assert.equal(value.identityContinuityProved, false); assert.equal(value.hostInputFenceProved, false);
  assert.equal(value.lifecycleFallback, 'project-lifecycle-fence-unproved');
}
/** The six old signals and this empty witness window do not prove loaded-instance continuity. */
export function verifyNoChainRoot(root: Wire): void {
  assert.equal(root.instrumentationRevision, '8g-root-existing-chain-v1'); assert.equal(root.identityDetectionProved, false);
  assert.equal(root.hostInputFenceProved, false); assert.equal(read(root, 'rootChannelId'), NO_CHAIN_ROOT);
  assert.equal(read(root, 'masterChannelId'), NO_CHAIN_ROOT); assert.equal(read(root, 'projectExists'), true); assert.equal(read(root, 'rootExists'), true);
  assert.equal(typeof read(root, 'projectName'), 'string'); assert.equal(typeof read(root, 'hasActiveEngine'), 'boolean');
  assert.equal(root.callbacksChangedDuringRead, false); assert.equal(root.sequenceBeforeRead, root.sequenceAfterRead);
  assert.equal(typeof root.extensionInitNonce, 'string'); assert(Number.isSafeInteger(root.automaticIdentityEpoch));
  const witness = root.existingChainWitnesses as Wire, current = witness.current as Wire;
  assert.equal(witness.trackWindow, 4); assert.equal(witness.deviceWindowPerTrack, 4); assert.equal(witness.layerWindowPerDevice, 4);
  assert.equal(witness.candidateCount, 0); assert.deepEqual(witness.candidates, []);
  assert.equal(witness.loadedInstanceIdentityProved, false); assert.equal(witness.scopeComplete, false);
  for (const [i, id] of NO_CHAIN_MAIN_IDS.entries()) {
    for (const [field, expected] of [['exists', true], ['channelId', id], ['deviceCount', 0]] as const) {
      const value = current[`chainWitness.track.${i}.${field}`] as Wire; assert.equal(value.status, 'read'); assert.equal(value.value, expected);
    }
  }
}
function census(value: Wire): Track[] {
  assert.equal(value.count, 4); assert.equal(value.itemCount, 4); assert(Number(value.bankSize) >= 4);
  const tracks = value.tracks as Track[]; assert.equal(tracks.length, 4);
  assert.equal(new Set(tracks.map(track => track.channelId)).size, 4);
  for (const track of tracks) {
    assert(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(track.channelId));
    assert.equal(typeof track.name, 'string'); assert(Number.isSafeInteger(track.index) && track.index >= 0);
  }
  const ids = [...NO_CHAIN_MAIN_IDS, NO_CHAIN_FX_ID, NO_CHAIN_ROOT];
  assert.deepEqual(tracks.map(track => track.channelId), ids);
  assert.deepEqual(tracks.map(track => track.name), ['Inst 1', 'Audio 2', 'FX 1', 'Master']);
  return tracks;
}
export function verifyNoChainBaseline(value: Wire): void {
  verifyNoChainRoot(value.root as Wire); unknown(value.cache as Wire); assert.equal(value.scenes, SCENES);
  const tracks = census(value.trackList as Wire), slots = value.slots as Wire[];
  assert.equal((value.scan as Wire).slotsWithContent, 0); assert.equal(slots.length, 4 * SCENES);
  const expected = tracks.flatMap(track => Array.from({ length: SCENES }, (_, row) => `${track.channelId}:${row}`)).sort();
  assert.deepEqual(slots.map(slot => `${slot.id}:${slot.row}`).sort(), expected);
  for (const slot of slots) { assert.equal(slot.hasContent, false); assert.equal(typeof slot.exists, 'boolean'); }
  const disk = value.disk as Wire; assert.equal(disk.path, NO_CHAIN_PROJECT); assert(Number(disk.bytes) > 0); assert(/^[a-f0-9]{64}$/.test(String(disk.sha256)));
}
function noOutput(value: Wire): void {
  closed(value); assert.equal(value.terminal, true); assert.equal(value.phase, 'refused'); assert.equal(value.authorityAvailable, false);
  assert.equal(value.fallbackPerformed, false); assert.equal(value.readMode, 'refuse'); assert.equal(value.authorityNotes, undefined);
  assert.equal(value.authorityMetadata, undefined); assert.equal(value.diagnosticSnapshot, undefined);
}
export function verifyNoChainReport(report: Wire): number {
  assert.equal(report.researchOnly, true); closed(report); assert.equal(report.identityDetectionProved, false);
  assert.equal(report.hostInputFenceProved, false); assert.equal(report.noChainScope, 'owned-B-fixed-main-track-window');
  assert.equal(typeof report.ended, 'string'); assert.equal(report.fixtureRestored, true); assert.equal(report.error, undefined); assert.equal(report.cleanupError, undefined);
  verifyNoChainBaseline(report.before as Wire); verifyNoChainBaseline(report.after as Wire);
  const before = report.before as Wire, after = report.after as Wire;
  assert.deepEqual(after.trackList, before.trackList); assert.deepEqual(after.slots, before.slots);
  assert.equal(report.createdTrackId, NO_CHAIN_MAIN_IDS[0]); assert.equal(report.createdRow, 0); assert.equal(report.createdClipCount, 1);
  assert.equal((report.createdSlot as Wire).hasContent, true);
  const acquires = report.acquireRefusals as Wire[]; assert.equal(acquires.length, 2);
  for (const value of acquires) { unknown(value); assert.equal(value.poolDecision, 'refused'); assert.equal(value.reason, 'identity-witness-unavailable'); assert.equal(value.resident, 0); }
  const manual = report.manual as Wire;
  if (manual.mode === 'history-refusal') { closed(manual.result as Wire); assert.equal((manual.result as Wire).reason, 'populated-canary-required-for-rebind'); }
  else { assert.equal(manual.mode, 'settled-reuse-refusal'); closed(manual.result as Wire);
    assert.equal((manual.result as Wire).reason, 'identity-unverified-requires-forced-canary'); }
  assert.equal((manual.result as Wire).authorityAvailable, false); assert.equal((manual.result as Wire).readMode, 'refuse');
  const exact = report.exact as Wire; unknown(exact); assert.equal(exact.terminal, true); assert.equal(exact.phase, 'acquired');
  assert.equal(exact.authorityAvailable, true); assert.equal(exact.fallbackPerformed, true); assert.equal(exact.readMode, 'exact-fallback');
  assert.equal(exact.cacheResidenceAdmitted, false); assert.equal(exact.cacheMembershipUsed, false); assert.equal(exact.resident, 0);
  assert.deepEqual(exact.address, { trackId: NO_CHAIN_MAIN_IDS[0], row: 0 });
  const coverage = exact.coverage as Wire; assert.equal(coverage.startCell, 0); assert.equal(coverage.width, WIDTH); assert.equal(coverage.allChannels, true);
  assert.equal(coverage.timingBasis, '1/512-beat'); assert.equal(exact.scannedCoordinates, WIDTH * 128); assert.equal(exact.totalCoordinates, WIDTH * 128);
  assert.equal(exact.authorityNoteCount, 0); assert.deepEqual(exact.authorityNotes, []); assert.equal(exact.diagnosticSnapshot, undefined);
  const metadata = exact.authorityMetadata as Wire; assert.equal(typeof metadata.name, 'string');
  for (const field of ['playStart', 'playStop', 'loopStart', 'loopLength']) assert(Number.isFinite(metadata[field]));
  const cacheBefore = report.beforeExact as Wire;
  assert.equal(exact.entries, cacheBefore.entries); assert.equal(exact.occupiedCoordinates, cacheBefore.occupiedCoordinates);
  assert.equal(Number(report.exactHostCalls), WIDTH * 128 * 16);
  for (const value of report.scopeRefusals as Wire[]) { noOutput(value); assert.equal(value.reason, 'authority-coverage-unavailable'); }
  assert.equal((report.scopeRefusals as Wire[]).length, 2);
  noOutput(report.afterScopeRefusal as Wire);
  const cancel = report.cancelled as Wire; assert.equal((cancel.active as Wire).phase, 'scanning'); assert(Number((cancel.active as Wire).scannedCoordinates) > 0);
  for (const value of cancel.after as Wire[]) { noOutput(value); assert.equal(value.reason, 'no-chain-control-cancel'); }
  assert.equal((cancel.after as Wire[]).length, 2);
  return 1;
}
export function verifyNoChainSave(report: Wire): void {
  assert.equal(report.researchOnly, true); closed(report); assert.equal(report.manualSaveConfirmed, true); assert.equal(typeof report.ended, 'string');
  verifyNoChainBaseline(report.before as Wire); verifyNoChainBaseline(report.after as Wire);
  const before = report.before as Wire, after = report.after as Wire;
  assert.deepEqual(after.trackList, before.trackList); assert.deepEqual(after.slots, before.slots);
  const a = before.cache as Wire, b = after.cache as Wire;
  assert.equal(a.initDomain, b.initDomain); assert.equal(a.projectGeneration, b.projectGeneration);
  assert.equal((before.root as Wire).extensionInitNonce, (after.root as Wire).extensionInitNonce);
  assert.equal((before.root as Wire).automaticIdentityEpoch, (after.root as Wire).automaticIdentityEpoch);
  assert.equal(report.identityDetectionProved, false); assert.equal(report.hostInputFenceProved, false);
}
async function disk(): Promise<Wire> {
  const value = await readFile(NO_CHAIN_PROJECT); return { path: NO_CHAIN_PROJECT, bytes: value.length, sha256: createHash('sha256').update(value).digest('hex') };
}
async function baseline(): Promise<Wire> {
  const root = await shadow('rootSnapshot'); verifyNoChainRoot(root);
  const trackList = await request('track.list'), tracks = census(trackList), scenes = (await request('scene.count')).sceneCount;
  assert.equal(scenes, SCENES); const slots: Wire[] = [];
  for (const track of tracks) for (let row = 0; row < SCENES; row++) {
    const slot = await request('slot.status', { trackIndex: track.index, slotIndex: row }); slots.push({ id: track.channelId, row, exists: slot.exists, hasContent: slot.hasContent });
  }
  const value = { root, trackList, scenes, slots, scan: await request('rig.scanTracks'), cache: await shadow('info'), disk: await disk() };
  verifyNoChainBaseline(value); return value;
}
async function guard(before: Wire): Promise<Track> {
  verifyNoChainRoot(await shadow('rootSnapshot'));
  const tracks = await request('track.list'); assert.deepEqual(tracks, before.trackList); assert.equal((await request('scene.count')).sceneCount, SCENES);
  return census(tracks).find(track => track.channelId === NO_CHAIN_MAIN_IDS[0])!;
}
async function poll(readValue: () => Promise<Wire>, done: (value: Wire) => boolean): Promise<Wire> {
  const started = performance.now();
  for (;;) { const value = await readValue(); if (done(value)) return value; assert(performance.now() - started < 45_000, `poll expired: ${JSON.stringify(value)}`); await wait(); }
}
async function save(path: string, value: Wire): Promise<void> { await writeFile(path, JSON.stringify(value, null, 2) + '\n'); }
async function run(): Promise<void> {
  const before = await baseline(), track = await guard(before);
  const report: Wire = { started: new Date().toISOString(), researchOnly: true, complete: false, eligible: false, identityDetectionProved: false,
    hostInputFenceProved: false, noChainScope: 'owned-B-fixed-main-track-window', before, createdTrackId: track.channelId, createdRow: 0, createdClipCount: 0 };
  let creationIssued = false;
  try {
    await save(OUTPUT, report); creationIssued = true; report.creationIssued = true; await save(OUTPUT, report);
    await request('clip.create', { trackIndex: track.index, slotIndex: 0, lengthBeats: 4 });
    report.createdSlot = await poll(() => request('slot.status', { trackIndex: track.index, slotIndex: 0 }), value => value.hasContent === true);
    report.createdClipCount = 1;
    report.acquireRefusals = [await shadow('acquire', { trackIndex: track.index, row: 0 }), await shadow('acquire', { trackIndex: track.index, row: 0 })];
    let manual = await shadow('point', { index: 0, trackIndex: track.index, row: 0 });
    if (manual.reason === 'populated-canary-required-for-rebind') report.manual = { mode: 'history-refusal', result: manual };
    else { manual = await poll(() => shadow('poll', { index: 0 }), value => ['settled', 'complete', 'retired'].includes(String(value.phase)));
      assert.notEqual(manual.phase, 'retired'); report.manual = { mode: 'settled-reuse-refusal', settled: manual, result: await shadow('point', { index: 0, trackIndex: track.index, row: 0 }) }; }
    await shadow('retire', { index: 0 }); await shadow('retire', { index: 1 });
    report.beforeExact = await shadow('info');
    let exact = await shadow('exactStart', { trackIndex: track.index, row: 0 });
    exact = await poll(async () => exact.terminal === true ? exact : (exact = await shadow('exactPoll')), value => value.terminal === true);
    report.exact = exact; report.exactHostCalls = Number(exact.authorityGetStepCalls) - Number((report.beforeExact as Wire).authorityGetStepCalls);
    await save(OUTPUT, report);
    report.scopeRefusals = [];
    for (const coverage of [{ startCell: 0, width: WIDTH + 1, allChannels: true, fields: [], unsupportedFields: [], timingBasis: '1/512-beat' },
      { startCell: 0, width: WIDTH, allChannels: true, fields: ['portableRepeat'], unsupportedFields: [], timingBasis: '1/512-beat' }])
      (report.scopeRefusals as Wire[]).push(await shadow('exactStart', { trackIndex: track.index, row: 0, coverage }));
    report.afterScopeRefusal = await shadow('exactPoll');
    let active = await shadow('exactStart', { trackIndex: track.index, row: 0 });
    active = await poll(async () => active.terminal === true ? active : (active = await shadow('exactPoll')),
      value => value.terminal === true || Number(value.scannedCoordinates) > 0);
    await shadow('exactCancel', { reason: 'no-chain-control-cancel' });
    report.cancelled = { active, after: [await shadow('exactPoll'), await shadow('exactPoll')] }; await save(OUTPUT, report);
  } catch (error) { report.error = String(error); throw error; }
  finally {
    try {
      await shadow('exactCancel', { reason: 'no-chain-cleanup' });
      const current = await guard(before);
      if (creationIssued && (await request('slot.status', { trackIndex: current.index, slotIndex: 0 })).hasContent === true) {
        await request('slot.delete', { trackIndex: current.index, slotIndex: 0 });
        await poll(() => request('slot.status', { trackIndex: current.index, slotIndex: 0 }), value => value.hasContent === false);
      }
      report.after = await baseline(); report.fixtureRestored = true;
    } catch (error) { report.cleanupError = String(error); report.fixtureRestored = false; }
    report.ended = new Date().toISOString(); await save(OUTPUT, report);
  }
  console.log(`No-chain control passes ${verifyNoChainReport(report)} independent empty acquisition; fixture restored.`);
}
async function savePrepare(): Promise<void> {
  const report: Wire = { started: new Date().toISOString(), researchOnly: true, complete: false, eligible: false,
    identityDetectionProved: false, hostInputFenceProved: false, before: await baseline() };
  await save(SAVE_OUTPUT, report); console.log('Save preparation captured. Manually save B, then run save-finish --manual-save-confirmed.');
}
async function saveFinish(confirmed: boolean): Promise<void> {
  assert.equal(confirmed, true, 'save-finish requires an explicit manual save confirmation');
  const report = JSON.parse(await readFile(SAVE_OUTPUT, 'utf8')) as Wire;
  report.after = await baseline(); report.manualSaveConfirmed = true; report.ended = new Date().toISOString();
  await save(SAVE_OUTPUT, report); verifyNoChainSave(report); console.log('Manual save preserved the local project domain; the no-chain witness remains unknown.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void (async () => { switch (process.argv[2]) {
    case 'run': await run(); break;
    case 'verify': console.log(`Verified ${verifyNoChainReport(JSON.parse(await readFile(process.argv[3] ?? OUTPUT, 'utf8')) as Wire)} no-chain empty acquisition.`); break;
    case 'save-prepare': await savePrepare(); break;
    case 'save-finish': await saveFinish(process.argv[3] === '--manual-save-confirmed'); break;
    case 'save-verify': verifyNoChainSave(JSON.parse(await readFile(process.argv[3] ?? SAVE_OUTPUT, 'utf8')) as Wire); console.log('Verified manual save control.'); break;
    default: throw new Error('Use run, verify [file], save-prepare, save-finish --manual-save-confirmed, or save-verify [file].');
  } })().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
